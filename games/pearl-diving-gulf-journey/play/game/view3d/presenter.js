// The 3D presenter: reads game.getState() (the season S, the scene, the layout rectangles) and draws the sea, the dhow, the harbour, the crew and the sea floor.
// It never writes back. Animation advances by the sim clock difference, so it pauses with the game. The WebGL canvas sits behind the kit canvas.
import { buildSky, buildSea, buildDhow, buildLamp, buildHarbour, waveH, MOODS, DECK_Y, boatZ, soft } from './world.js';
import { buildUnder } from './under.js';
import { createPerson, followPerson, playClip } from './crew.js';

const LIB = '../vendor3d/index.js';
const QP = (k, d) => { try { const m = new RegExp('[?&]' + k + '=([-0-9.]+)').exec(globalThis.location.search); return m ? Number(m[1]) : d; } catch { return d; } };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const TAU = Math.PI * 2;
const angDiff = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));

function pickQuality() {
  try { const m = /[?&]q=(low|medium|high)/.exec(globalThis.location.search); if (m) return m[1]; } catch { /* ignore */ }
  const nav = globalThis.navigator || {};
  // Touch devices (phones, tablets) start on 'medium' (shadows on, a coarser sea grid); low-memory or few-core ones on 'low'. The pixel budget then adapts to the measured frame time (see frame()).
  let touch = false; try { touch = !!(globalThis.matchMedia && globalThis.matchMedia('(pointer: coarse)').matches) || (nav.maxTouchPoints || 0) > 0; } catch { /* ignore */ }
  const veryWeak = (nav.deviceMemory && nav.deviceMemory <= 3) || (nav.hardwareConcurrency && nav.hardwareConcurrency <= 4);
  if (touch) return veryWeak ? 'low' : 'medium';
  const weak = (nav.hardwareConcurrency && nav.hardwareConcurrency <= 6) || (nav.deviceMemory && nav.deviceMemory <= 4);
  return weak ? 'medium' : 'high';
}

export async function createPresenter({ kitCanvas, quality }) {
  quality = quality || pickQuality();
  const fallback = { stage: null, wrap: (g) => g, ready: () => false, busy: () => false };
  let V3L;
  try { V3L = await import(LIB); } catch (e) { console.warn('view3d failed to load; using the 2D fallback', e); return fallback; }
  const { createStage, THREE } = V3L;
  const canvas = globalThis.document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100dvh;display:block;pointer-events:none;z-index:0;visibility:hidden';
  kitCanvas.parentElement.insertBefore(canvas, kitCanvas);
  kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
  const stage = createStage({ canvas, quality, dprCap: 2, lighting: 'day', shadowSize: 16 });
  if (!stage.supported) { canvas.remove(); return fallback; }
  if (quality !== 'high') stage.renderer.shadowMap.enabled = quality === 'medium';
  const renderer = stage.renderer, camera = stage.camera, scene = stage.scene;
  stage.onContextLost(() => {});
  stage.onContextRestored(() => { sizeKey = ''; stage.invalidate(); });
  camera.far = 6000; camera.near = 0.2; camera.updateProjectionMatrix();
  scene.environment = null;
  const seaAmp = { v: 0.1 };
  const V = (x, y, z) => new THREE.Vector3(x, y, z);

  // ---- the world ---------------------------------------------------------------------------------------------------------------------------------------------
  const sky = buildSky(THREE, quality); stage.add(sky.root);
  const sea = buildSea(THREE, quality); stage.add(sea.mesh); stage.add(sea.lid);
  const boatGroup = new THREE.Group(); boatGroup.rotation.order = 'YXZ'; stage.add(boatGroup);
  const dhow = buildDhow(THREE, quality); boatGroup.add(dhow.root);
  sea.hull.hw = 2.2; sea.hull.hl = 7.6; sea.hull.on = true;
  const lamp = buildLamp(THREE); lamp.group.position.set(0.3, DECK_Y + 1.3, 1.6); boatGroup.add(lamp.group);
  const harbour = buildHarbour(THREE, quality, dhow.root); harbour.root.visible = false; stage.add(harbour.root);
  const under = buildUnder(THREE, quality); under.root.visible = false; stage.add(under.root); under.dv = { x: 0, y: 0, head: new THREE.Vector3(), waist: new THREE.Vector3(), slack: 0, on: false, stoneY: -5, beds: [] };
  // the rope that runs from the deck into the sea (for the dive and the haul), the ripples where it enters, and a flash when a shell is picked
  const ropeG = new THREE.CylinderGeometry(0.03, 0.03, 1, 5); ropeG.translate(0, 0.5, 0);
  const seaRope = new THREE.Mesh(ropeG, new THREE.MeshStandardMaterial({ color: 0xe6d6a2, roughness: 0.9 })); seaRope.visible = false; stage.add(seaRope);
  const ripples = Array.from({ length: 3 }, () => { const m = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 28), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.visible = false; stage.add(m); return m; });
  const flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: soft(THREE, 'rgba(255,250,215,1)', 'rgba(255,240,170,0)', 64), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); flash.visible = false; stage.add(flash);
  const basket = new THREE.Group(); { const bm = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.11, 0.2, 10, 1, true), new THREE.MeshStandardMaterial({ color: 0x8a6a3a, roughness: 0.9, side: THREE.DoubleSide })); basket.add(bm); basket.userData.shells = []; for (let i = 0; i < 12; i++) { const sm2 = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 5), new THREE.MeshStandardMaterial({ color: i % 4 === 0 ? 0xcfc3a0 : 0x5a5a48, roughness: 0.6 })); sm2.position.set(Math.cos(i * 1.9) * 0.06, 0.05 + (i % 3) * 0.03, Math.sin(i * 1.9) * 0.06); sm2.visible = false; basket.add(sm2); basket.userData.shells.push(sm2); } basket.visible = false; stage.add(basket); }

  // ---- the crew (loaded in the background; the sea and the boat show at once) ------------------------------------------------------------------------------------------------------
  const crew = {}; let crewReady = false;
  const SPEC = [
    { name: 'hamad', dress: 'robe', robe: '#f3efe2', skin: 'clay', hair: 'grey', cloth: '#f6f2e8' },
    { name: 'khalifa', dress: 'robe', robe: '#e9e4d4', skin: 'wood', hair: 'grey', cloth: '#f0ecdf' },
    { name: 'rashid', dress: 'robe', robe: '#efe6cc', skin: 'brown', hair: 'black', cloth: '#e8dfc4' },
    { name: 'salim', dress: 'bare', skin: 'tan', hair: 'black', wrap: '#e8dfc8', stripe: '#c0532f', vest: '#eee8d8' },
    { name: 'yusuf', dress: 'bare', skin: 'brown', hair: 'black', wrap: '#ece4d2', stripe: '#2d6a8a', vest: '#e4ddc8' },
    { name: 'jassim', dress: 'robe', robe: '#3b4452', skin: 'clay', hair: 'grey', cloth: '#f6f2e8' },
  ];
  async function loadCrew() {
    for (const sp of SPEC) {
      const a = await createPerson({ ...sp, quality: (sp.name === 'yusuf' || sp.name === 'salim') && quality === 'high' ? 'high' : quality === 'low' ? 'low' : 'medium' });
      a.h.root.visible = false; if (sp.name === 'jassim') { harbour.root.add(a.h.root); a.parent = 'harbour'; } else { boatGroup.add(a.h.root); a.parent = 'boat'; } stage.track(a.h);
      stage.add(a.robe); if (a.sleeves) stage.add(a.sleeves); if (a.cloth) stage.add(a.cloth);
      crew[sp.name] = a; a.h.play('sea_idle', { fade: 0 }); a.clip = 'sea_idle'; a.shown = false;
    }
    crewReady = true; stage.invalidate();
  }
  loadCrew().catch((e) => console.warn('3D crew failed to load', e));
  const reparent = (a, where) => { if (!a || a.parent === where || a.parent === 'harbour') return; const p = where === 'boat' ? boatGroup : under.root; p.add(a.h.root); a.parent = where; };

  // ---- the mood: sky, light and sea colours blend smoothly between scenes -------------------------------------------------------------------------------
  const cur = { top: new THREE.Color(), mid: new THREE.Color(), hor: new THREE.Color(), fog: new THREE.Color(), sun: new THREE.Color(), hemiSky: new THREE.Color(), hemiGround: new THREE.Color(), key: new THREE.Color(), seaDeep: new THREE.Color(), seaShallow: new THREE.Color(), sunAz: 0, sunEl: 0.5, hemi: 1, keyI: 3, exposure: 1, stars: 0 };
  const tgt = {}; let moodName = '';
  const COLS = ['top', 'mid', 'hor', 'fog', 'sun', 'hemiSky', 'hemiGround', 'key', 'seaDeep', 'seaShallow'], NUMS = ['sunAz', 'sunEl', 'hemi', 'keyI', 'exposure', 'stars'];
  const setMood = (name, snap) => {
    if (name === moodName && !snap) return; moodName = name; const m = MOODS[name];
    Object.assign(tgt, m);
    if (snap) { for (const k of COLS) cur[k].set(m[k]); for (const k of NUMS) cur[k] = m[k]; }
  };
  const tc = new THREE.Color();
  const blend = (dt) => {
    const k = 1 - Math.exp(-dt * 1.6);
    for (const key of COLS) cur[key].lerp(tc.set(tgt[key]), k);
    for (const key of NUMS) cur[key] = lerp(cur[key], tgt[key], k);
  };
  const moodNow = () => ({ top: '#' + cur.top.getHexString(), mid: '#' + cur.mid.getHexString(), hor: '#' + cur.hor.getHexString(), sun: '#' + cur.sun.getHexString(), sunAz: cur.sunAz, sunEl: cur.sunEl, stars: cur.stars, seaDeep: '#' + cur.seaDeep.getHexString(), seaShallow: '#' + cur.seaShallow.getHexString() });

  // ---- sizes ---------------------------------------------------------------------------------------------------------------------------------------------------
  let cssW = 0, cssH = 0, scaleV = 1, sizeKey = '';
  let MAX_PIXELS = QP('maxpx', quality === 'high' ? 3.2e6 : quality === 'medium' ? 2.0e6 : 1.2e6);   // adapted down at run time when frames run long
  const perf = { last: 0, acc: 0, n: 0, fps: 60, floor: 0.5e6 };
  function layout() {
    const r = kitCanvas.getBoundingClientRect();
    const cw = r.width || globalThis.innerWidth, ch = r.height || globalThis.innerHeight;
    const short = Math.min(cw, ch), w = Math.round(cw * 720 / short);
    const sk = `${cw}x${ch}`;
    if (sk !== sizeKey) {
      sizeKey = sk; cssW = cw; cssH = ch; stage.resize();
      const want = Math.max(1, Math.min(globalThis.devicePixelRatio || 1, QP('maxpx', 0) ? 3 : 2, Math.sqrt(MAX_PIXELS / Math.max(1, cw * ch))));
      if (Math.abs(renderer.getPixelRatio() - want) > 0.01 || renderer.domElement.width !== Math.round(cw * want)) { renderer.setPixelRatio(want); renderer.setSize(cw, ch, false); }
      stage.invalidate();
    }
    scaleV = cw / w;
  }

  // ---- camera ----------------------------------------------------------------------------------------------------------------------------------------------
  const cam = { pos: new THREE.Vector3(0, 4, 30), look: new THREE.Vector3(0, 3, 0), fov: 38, init: false };
  function applyCam(spec, region, dt, snap) {
    const k = snap || !cam.init ? 1 : 1 - Math.exp(-dt * (spec.k ?? 3));
    cam.pos.lerp(spec.pos, k); cam.look.lerp(spec.look, k); cam.fov = lerp(cam.fov, spec.fov, k); cam.init = true;
    const cw = cssW, ch = cssH;
    camera.clearViewOffset?.();
    camera.position.copy(cam.pos); camera.lookAt(cam.look);
    const rw = region.w * scaleV, rh = region.h * scaleV, rx = region.x * scaleV, ry = region.y * scaleV;
    const fullFov = (2 * Math.atan(Math.tan((cam.fov * Math.PI) / 360) * (ch / Math.max(1, rh))) * 180) / Math.PI;
    camera.fov = Math.min(110, fullFov); camera.aspect = cw / ch;
    const dx = rx + rw / 2 - cw / 2, dy = ry + rh / 2 - ch / 2;
    if (camera.setViewOffset) camera.setViewOffset(cw, ch, -dx, -dy, cw, ch);
    camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
  }

  let animT = 0, lastSimT = null, ready = false, frames = 0, setName = '', pullT = 9, pullHand = 0, flashT = 9;
  const seen = {};
  const dirOf = (name) => { const arr = name.split('.'); return arr; };
  void dirOf;

  // which set, mood and camera for the state
  function plan(s) {
    const S = s.S, sc = s.scene, ph = S && sc === 'play' ? S.phase : '';
    const out = { set: 'sea', mood: 'dawn', cam: null, visible: true, ph };
    if (['rules', 'about', 'howto', 'journal', 'necklace'].includes(sc)) { out.visible = false; return out; }
    const orbit = (r, hgt, ly, fov, sp = 0.04, a0 = 0.5, cx = 0) => { const a = a0 + animT * sp; return { pos: V(cx + Math.sin(a) * r, hgt, Math.cos(a) * r), look: V(cx, ly, 0), fov, k: 1.5 }; };
    if (sc === 'title' || sc === 'settings' || sc === 'demolimit' || !S) { out.mood = 'dawn'; out.cam = orbit(25, 4.4, 3.2, 36, 0.03, 0.7); return out; }
    const D = S.D;
    switch (ph) {
      case 'intro': case 'prov': case 'trade': case 'budget': out.set = 'harbour'; out.mood = 'gold'; out.cam = { pos: V(-3 + Math.sin(animT * 0.03) * 4, 3.4, 27), look: V(-3, 3.3, 2), fov: 40, k: 1.2 }; break;
      case 'season': out.set = 'harbour'; out.mood = 'dawn'; out.cam = { pos: V(-4 + Math.sin(animT * 0.03) * 4, 3.0, 25), look: V(-3, 3.5, 2), fov: 40, k: 1.2 }; break;
      case 'plan': out.mood = 'dawn'; out.cam = orbit(25, 3.6, 3.0, 40, 0.03, 0.4); break;
      case 'song': out.mood = 'day'; out.cam = { pos: V(-4.4, 2.4, 6.8), look: V(0.1, 1.9, 1.5), fov: 42, k: 2 }; break;
      case 'dive':
        if (D && D.phase !== 'breath') {
          out.set = 'under'; out.mood = 'under';
          const dx = clamp(under.dv.x, -7, 7), fy = clamp(-under.dv.y, -D.depth + 1.6, -0.5), by = -D.depth;
          const mid = D.phase === 'bottom' ? by + 1.6 : fy + 0.2;
          out.cam = { pos: V(dx * 0.96, mid + (D.phase === 'bottom' ? 0.5 : -0.6), 5.8 + D.depth * 0.13), look: V(dx * 0.98, mid - (D.phase === 'bottom' ? 0.15 : 0.9), 0), fov: 48, k: D.phase === 'bottom' ? 2.4 : 4 };
        } else { out.mood = 'day'; out.cam = { pos: V(6.6, 2.1, 4.6), look: V(1.7, 1.55, 0.9), fov: 42, k: 2 }; }
        break;
      case 'divedone': out.mood = 'day'; out.cam = { pos: V(6.8, 2.3, 4.8), look: V(1.7, 1.45, 0.9), fov: 42, k: 2 }; break;
      case 'haul': case 'haulDone': out.mood = 'day'; out.cam = { pos: V(7.4, 2.7, 3.6), look: V(2.2, 0.9, 0.9), fov: 46, k: 2 }; break;
      case 'open': out.mood = 'dusk'; out.cam = { pos: V(-3.6, 2.2, 6.6), look: V(0.2, 1.4, 0.9), fov: 44, k: 2 }; break;
      case 'tale': out.mood = 'dusk'; out.cam = orbit(22, 3.0, 3.2, 42, 0.03, 2.2); break;
      case 'daysum': out.mood = 'night'; out.cam = orbit(22, 3.0, 3.4, 42, 0.03, 2.2); break;
      default: out.cam = orbit(26, 4, 3, 38);
    }
    return out;
  }

  // ---- the crew's poses --------------------------------------------------------------------------------------------------------------------------------------------------------
  const tmpP = new THREE.Vector3(), tmpQ = new THREE.Quaternion(), wp = new THREE.Vector3(), wp2 = new THREE.Vector3();
  const faceTo = (a, x, z) => { const p = a.h.root.position; a.h.setFacing(Math.atan2(x - p.x, z - p.z)); };
  const placeBoat = (a, x, y, z, yaw) => { a.h.groundClamp = 'auto'; a.h.setPosition(x, y, z); a.h.setFacing(yaw); a.h.root.rotation.x = 0; };
  const loc = (x, y, z) => boatGroup.localToWorld(V(x, y, z));
  // a sweep (long oar) for the seated rower: pivots at the gunwale, the inboard end follows his hands
  const oar = new THREE.Group(), oarShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1, 8), new THREE.MeshStandardMaterial({ color: 0x8a5a2b, roughness: 0.8 })), oarBlade = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0x9a6a36, roughness: 0.8 }));
  oarShaft.castShadow = true; oar.add(oarShaft, oarBlade); oar.visible = false; stage.add(oar);
  const _h1 = V(), _h2 = V(), _pv = V(), _dir = V(), _a2 = V(), _b2 = V();
  function oarFor(a, px, py, pz) {
    a.h.bonePosition('L_Hand', _h1); a.h.bonePosition('R_Hand', _h2); _h1.add(_h2).multiplyScalar(0.5); _pv.copy(loc(px, py, pz));
    _dir.subVectors(_h1, _pv); if (_dir.lengthSq() < 1e-4) return; _dir.normalize();
    _a2.copy(_pv).addScaledVector(_dir, -1.7); _b2.copy(_h1).addScaledVector(_dir, 0.14);
    _dd.subVectors(_b2, _a2); const len = _dd.length(); _qq.setFromUnitVectors(_up, _dd.clone().normalize());
    oarShaft.position.set(0, 0, 0); oar.position.copy(_a2); oar.quaternion.copy(_qq); oarShaft.scale.set(1, len, 1); oarShaft.position.y = len / 2;
    oarBlade.scale.set(0.2, 0.7, 0.035); oarBlade.position.y = 0.35; oar.visible = true;
  }
  const reach = (a, side, pt, pole) => { a.h.setReach(side, pt, { weight: 1, pole }); };
  const LAB = QP('lab', 0), LABCLIPS = ['sea_idle', 'sea_sing', 'sea_clap', 'sea_stir', 'sea_steer', 'sea_breathe', 'sea_haul', 'sea_hold', 'dv_sink', 'dv_swim', 'dv_pick', 'dv_rise', 'sea_sit', 'sea_sit_clap', 'sea_sit_sing', 'sea_sit_stir', 'sea_row', 'idle_relaxed', 'cheer'];
  function crewPoses(s, P, dt) {
    const S = s.S, ph = P.ph, set = P.set;
    if (LAB) { const names = ['hamad', 'khalifa', 'rashid', 'salim', 'yusuf']; names.forEach((n, i) => { const a = crew[n]; if (!a) return; a.want = true; a.h.groundClamp = 'auto'; a.h.setPosition(-3.2 + i * 1.6, DECK_Y, 3.0); a.h.setFacing(0.3); a.h.root.rotation.x = 0; playClip(a, LABCLIPS[(LAB - 1 + i) % LABCLIPS.length]); }); return; }
    for (const a of Object.values(crew)) { a.want = false; }
    oar.visible = false;
    const show = (n, yes = true) => { const a = crew[n]; if (a) a.want = yes; return a; };
    const camL = boatGroup.worldToLocal(camera.position.clone());
    const toCam = (a, k = 1) => { const p = a.h.root.position; const yaw = Math.atan2(camL.x - p.x, camL.z - p.z); a.h.setFacing(yaw * k + (1 - k) * a.h.root.rotation.y); };
    if (set === 'harbour') {
      const m = show('jassim'), hh = show('hamad'); void hh;
      if (m) { m.inHarbour = true; }
      return;
    }
    if (set === 'under') {
      const y = show('yusuf'); if (y) underDiver(y, S, dt);
      const sa = show('salim'); void sa;
      return;
    }
    const ham = show('hamad'), kha = show('khalifa'), ras = show('rashid'), sal = show('salim'), yus = show('yusuf');
    // the captain stands at the tiller on the poop deck, the cook at his pot
    if (ham) { placeBoat(ham, 0.1, 1.86, boatZ(0.1), 0.12); playClip(ham, 'sea_steer'); }
    if (ras) { placeBoat(ras, -1.15, DECK_Y, -2.7, Math.PI); playClip(ras, 'sea_sit_stir'); }
    if (ph === 'song' && S.G) {
      const G = S.G, call = G.step === 'call' || G.step === 'intro';
      placeBoat(kha, -0.3, DECK_Y, 2.3, 0); toCam(kha, 0.85); playClip(kha, call ? 'sea_sing' : 'sea_clap');
      placeBoat(sal, -1.5, DECK_Y, 1.1, 0); toCam(sal, 0.8); playClip(sal, G.step === 'answer' ? 'sea_sit_clap' : 'sea_sit');
      placeBoat(yus, 1.0, DECK_Y, 1.5, 0); toCam(yus, 0.85); playClip(yus, G.step === 'answer' ? 'sea_sit_clap' : 'sea_sit');
      return;
    }
    if (ph === 'open') {
      const lx = 0.3, lz = 1.6;
      placeBoat(kha, -1.0, DECK_Y, 2.6, 0); faceTo(kha, lx, lz); playClip(kha, 'sea_sit_sing');
      placeBoat(sal, 1.3, DECK_Y, 2.5, 0); faceTo(sal, lx, lz); playClip(sal, 'sea_sit');
      placeBoat(yus, 1.1, DECK_Y, 0.4, 0); faceTo(yus, lx, lz); playClip(yus, 'sea_sit_clap');
      return;
    }
    if (ph === 'dive' && S.D && S.D.phase === 'breath') {
      placeBoat(yus, 1.62, DECK_Y, 0.9, Math.PI / 2); playClip(yus, 'sea_breathe');
      placeBoat(sal, 1.55, DECK_Y, -0.35, Math.PI / 2); playClip(sal, 'sea_hold');
      placeBoat(kha, -0.6, DECK_Y, 2.4, 0); toCam(kha, 0.7); playClip(kha, 'sea_sing');
      return;
    }
    if (ph === 'haul' || ph === 'haulDone') {
      const H = S.H;
      placeBoat(yus, 1.5, DECK_Y, 0.9, Math.PI / 2); playClip(yus, 'sea_haul');
      placeBoat(kha, -0.6, DECK_Y, 2.4, 0); toCam(kha, 0.7); playClip(kha, 'sea_idle');
      if (H && ph === 'haulDone') { placeBoat(sal, 1.6, DECK_Y, -0.2, Math.PI / 2 + 0.4); playClip(sal, 'sea_clap'); } else if (sal) sal.want = false;
      return;
    }
    if (ph === 'divedone') { placeBoat(yus, 1.55, DECK_Y, 0.9, 1.2); playClip(yus, 'sea_breathe'); placeBoat(sal, 1.5, DECK_Y, -0.3, Math.PI / 2); playClip(sal, 'sea_idle'); placeBoat(kha, -0.6, DECK_Y, 2.4, 0); toCam(kha, 0.7); playClip(kha, 'sea_idle'); return; }
    // ambient: the crew about their business, looking out over the water
    placeBoat(kha, -0.6, DECK_Y, 2.4, 0.3); toCam(kha, 0.6); playClip(kha, 'sea_idle');
    placeBoat(sal, 1.2, DECK_Y, 3.6, Math.PI / 2 + 0.5); playClip(sal, 'sea_sit');
    placeBoat(yus, 1.35, DECK_Y, 1.7, 0); playClip(yus, 'sea_row'); oarFor(yus, 2.1, 1.25, 1.95);
  }
  // the diver under the water: pose and place from the dive state
  const dvState = { pitch: 0, yaw: 0.4, x: 0, init: false };
  function underDiver(a, S, dt) {
    const D = S.D; if (!D) return;
    reparent(a, 'under');
    let pitch = 0, yawT = 0.55, clip = 'dv_sink', hover = 0.95;
    const moving = D.phase === 'bottom' && D.tx !== null, dirx = D.tx !== null ? Math.sign(D.tx - D.x) : 0;
    if (D.phase === 'descend') { clip = 'dv_sink'; pitch = 0.05; yawT = 0.5; }
    else if (D.phase === 'bottom') {
      if (moving) { clip = 'dv_swim'; pitch = 1.36; yawT = dirx >= 0 ? Math.PI / 2 : -Math.PI / 2; hover = 0.7; }
      else if (D.at >= 0 && D.beds[D.at] && D.beds[D.at].left > 0 || D.pick) { clip = 'dv_pick'; pitch = 1.1; yawT = D.beds[D.at] && D.beds[D.at].x < D.x ? -0.9 : 0.9; hover = 0.62; }
      else { clip = 'dv_swim'; pitch = 0.55; yawT = 0.7; hover = 0.85; }
    } else if (D.phase === 'ascend') { clip = 'dv_rise'; pitch = 0.0; yawT = 0.5; }
    const k = 1 - Math.exp(-dt * 5);
    dvState.pitch = dvState.init ? lerp(dvState.pitch, pitch, k) : pitch; dvState.yaw = dvState.init ? dvState.yaw + angDiff(dvState.yaw, yawT) * k : yawT; dvState.init = true;
    let dx = D.x, depthY = D.y;
    if (D.phase === 'ascend') { const f = ease(D.pt / Math.max(0.1, D.ta)); dx = D.x * (1 - clamp(f * 1.6, 0, 1)); depthY = D.depth * (1 - f); }
    playClip(a, clip, { fade: 0.25 });
    // the pelvis is the pivot: the body hangs from it along the lean
    const floorY = -D.depth + under.floorH(dx, 0);
    let py = D.phase === 'bottom' ? floorY + hover : -depthY + 0.95;
    if (D.phase === 'descend') py = -depthY + 0.95;
    a.h.setFacing(dvState.yaw); a.h.root.rotation.x = dvState.pitch;
    const ca = Math.cos(dvState.pitch), sa2 = Math.sin(dvState.pitch), ox = Math.sin(dvState.yaw) * sa2 * 0.9, oz = Math.cos(dvState.yaw) * sa2 * 0.9;
    a.h.groundClamp = 'off'; a.h.root.position.set(dx - ox, py - 0.9 * ca, -oz);
    under.dv.x = dx; under.dv.y = D.phase === 'bottom' ? D.depth - hover : depthY;
  }

  const dvPose = { head: V(0, -1, 0), waist: V(0, -1, 0) };
  const tmpA = new THREE.Vector3();
  function frame(game) {
    { const now = globalThis.performance.now(); if (perf.last) { const d = Math.min(250, now - perf.last); perf.acc += d; perf.n++; if (perf.n >= 45) { const avg = perf.acc / perf.n; perf.fps = 1000 / avg; if (avg > 36 && MAX_PIXELS > perf.floor && !QP('maxpx', 0)) { MAX_PIXELS = Math.max(perf.floor, MAX_PIXELS * 0.72); sizeKey = ''; } perf.acc = 0; perf.n = 0; } } perf.last = now; }
    const s = game.getState();
    const nowT = s.t; let dt = lastSimT === null ? 0 : nowT - lastSimT; lastSimT = nowT;
    dt = clamp(dt, 0, 0.1);
    if (dt > 0) animT += dt;
    frames++;
    layout();
    const P = plan(s);
    if (LAB) { P.set = 'sea'; P.mood = 'day'; P.cam = { pos: V(0, 2.2, 8.5), look: V(0, 1.6, 3.0), fov: 40, k: 9 }; P.visible = true; }
    game.setView3d?.(P.visible && frames > 1);
    stage.setVisible(P.visible);
    if (!P.visible) return;
    const S = s.S, wind = S ? S.wind : 1;
    // which set is on stage
    const isUnder = P.set === 'under', isHarbour = P.set === 'harbour';
    if (setName !== P.set) { setName = P.set; for (const a of Object.values(crew)) { if (a.parent !== 'boat' && !isUnder) reparent(a, 'boat'); } }
    under.root.visible = isUnder; sky.root.visible = !isUnder; sea.mesh.visible = !isUnder; sea.lid.visible = isUnder; harbour.root.visible = isHarbour;
    dhow.root.visible = true; dhow.hull.material.emissive.set(isUnder ? 0x5a3a26 : 0x000000);
    setMood(P.mood, !cam.init);
    blend(Math.max(dt, 1 / 120));
    seaAmp.v = lerp(seaAmp.v, [0.1, 0.2, 0.38, 0.65][wind] ?? 0.2, 0.03);
    const L = stage.lights, M = moodNow();
    L.hemi.color.copy(cur.hemiSky); L.hemi.groundColor.copy(cur.hemiGround); L.hemi.intensity = cur.hemi;
    L.key.color.copy(cur.key); L.key.intensity = cur.keyI; L.rim.color.copy(cur.hemiSky); L.rim.intensity = 0.6;
    renderer.toneMappingExposure = cur.exposure;
    scene.background = cur.fog;
    if (!scene.fog) stage.setSky(cur.fog, cur.fog);
    scene.fog.color.copy(cur.fog);
    const D = S && S.D;
    if (isUnder) { scene.fog.near = 2; scene.fog.far = 20 + (D ? D.depth * 1.6 : 12); } else { scene.fog.near = 120; scene.fog.far = 2400; }
    const sd = sky.sunDir; stage._shadowOffset.set(sd.x * 20, Math.max(6, sd.y * 24), sd.z * 20); stage.setShadowTarget(0, isUnder ? -(D ? D.depth : 8) : 0, 0);
    if (!isUnder) sky.paint(M);
    const t = animT;
    // the boat rides the swell; for the dive it is turned broadside over the diver, in the harbour it lies by the jetty
    const h0 = waveH(0, 0, t, seaAmp.v), hF = waveH(0, 6, t, seaAmp.v), hB = waveH(0, -6, t, seaAmp.v), hL = waveH(2, 0, t, seaAmp.v), hR = waveH(-2, 0, t, seaAmp.v);
    const pitch = -(hF - hB) / 12 * 0.8, roll = (hL - hR) / 4 * 0.8, yBob = h0 * 0.8 - 0.05;
    if (isUnder) { boatGroup.position.set(-0.9, yBob, 2.1); boatGroup.rotation.set(0, Math.PI / 2, 0); sea.hull.on = false; }
    else if (isHarbour) { boatGroup.position.set(-2.0, yBob * 0.3 - 0.05, 6.4); boatGroup.rotation.set(pitch * 0.3, Math.PI / 2 + 0.06, roll * 0.3); sea.hull.x = -2.0; sea.hull.z = 6.4; sea.hull.yaw = Math.PI / 2 + 0.06; sea.hull.on = true; }
    else { boatGroup.position.set(0, yBob, 0); boatGroup.rotation.set(pitch, 0, roll); sea.hull.x = 0; sea.hull.z = 0; sea.hull.yaw = 0; sea.hull.on = true; }
    boatGroup.updateMatrixWorld(true);
    dhow.sailUpdate(t, clamp(0.25 + wind * 0.3, 0, 1), 1);
    const lit = clamp(cur.stars * 1.2 + (moodName === 'dusk' ? 0.6 : 0), 0, 1); lamp.group.visible = lit > 0.05 && !isUnder; lamp.glow.material.opacity = lit * (0.85 + 0.15 * Math.sin(t * 9));
    // events: pulls and picks
    const Hh = S && S.H, Dd = D;
    if (Hh && Hh.ev) for (const e of Hh.ev) { const key = 'H' + e.id; if (seen[key]) continue; seen[key] = 1; if (e.type === 'pull') { pullT = 0; pullHand = 1 - pullHand; } }
    if (Dd && Dd.ev) for (const e of Dd.ev) { const key = 'D' + e.id; if (seen[key]) continue; seen[key] = 1; if (e.type === 'got') flashT = 0; }
    pullT += dt; flashT += dt;
    // the sea floor and its beds
    if (D && isUnder) {
      if (under.bedsKey !== `${S.dayNo}|${D.bankId}`) { under.bedsKey = `${S.dayNo}|${D.bankId}`; under.setBeds(D.beds); under.setDepth(D.depth); dvState.init = false; }
    }
    // the crew
    if (crewReady) {
      under.dv = under.dv || { x: 0, y: 0 };
      crewPoses(s, P, dt);
      for (const a of Object.values(crew)) {
        const on = !!a.want && !(isHarbour && a.name !== 'jassim' && a.name !== 'hamad');
        followPerson(a, on);
        if (a.name === 'jassim' && on) { a.h.setPosition(harbour.merchantAt.x, harbour.merchantAt.y, harbour.merchantAt.z); a.h.setFacing(harbour.merchantAt.yaw); a.parent === 'boat' && (void 0); }
      }
      if (S && !isUnder && !isHarbour) ropePoses(S, Hh, t);
      else seaRope.visible = false;
      // the diver's hands on the rope, the basket on his hip
      if (isUnder && D) {
        const y = crew.yusuf; if (y) { const w = y.h.bonePosition('Pelvis', dvPose.waist.clone()); dvPose.waist.copy(w); const hd = y.h.bonePosition('Head', dvPose.head.clone()); dvPose.head.copy(hd); }
        basket.visible = true; basket.position.copy(dvPose.waist).add(V(0.0, -0.06, 0.18)); basket.rotation.set(0.5, 0, 0);
        basket.userData.shells.forEach((m, i) => { m.visible = i < D.basket.length; });
      } else basket.visible = false;
    }
    // the under-water set
    if (isUnder && D) {
      const stoneY = D.phase === 'descend' ? -D.y - 0.9 : -D.depth + 0.2;
      const waist = dvPose.waist, slack = D.phase === 'bottom' ? 0.8 : D.phase === 'ascend' ? 0.05 : 0.2;
      under.dv.head = dvPose.head; under.dv.waist = waist; under.dv.slack = slack; under.dv.on = true; under.dv.stoneY = Math.max(-D.depth + 0.2, stoneY); under.dv.beds = D.beds;
      under.update(t, dt, under.dv, cam.pos);
      if (flashT < 0.6) { flash.visible = true; flash.position.copy(waist).add(V(0.15, -0.35, 0.3)); const k = flashT / 0.6; flash.scale.setScalar(0.4 + 1.4 * k); flash.material.opacity = 1 - k; } else flash.visible = false;
      // the hull of the boat above, seen from below
    } else flash.visible = false;
    applyCam(P.cam, s.viewRect, dt, false);
    camera.getWorldPosition(tmpA);
    if (!isUnder) { sky.update(M, t, tmpA); sea.update(t, seaAmp.v, { seaDeep: M.seaDeep, seaShallow: M.seaShallow, hor: M.hor }, tmpA); }
    else { sea.lid.position.y = 0.02; sea.lid.visible = true; }
    if (isHarbour) harbour.update(t, M, tmpA);
    stage.update(dt);
    ready = crewReady && frames > 2;
  }
  // the rope from the deck into the sea (the dive's breath-up and the haul)
  function ropePoses(S, H, t) {
    const ph = S.phase; let show = false;
    if ((ph === 'haul' || ph === 'haulDone') && crew.yusuf) {
      const y = crew.yusuf, a0 = loc(2.12, 1.38, 0.9), water = loc(3.4, 0.0, 0.9);
      const f = H ? clamp(H.prog / Math.max(1, H.need), 0, 1) : 0, depthNow = H ? H.depth * (1 - f) : 6;
      const bottom = loc(3.6, -Math.min(depthNow, 16), 0.95);
      // hands on the rope, hand over hand: each tap makes the near hand sweep in
      const u = (hand, side) => { const on = hand === pullHand; const k = clamp(pullT / 0.5, 0, 1); return on ? lerp(0.5, 0.12, ease(k)) : lerp(0.12, 0.5, ease(k)); };
      const pt = (uu) => a0.clone().lerp(water, uu);
      const pole = (side) => loc(1.1, 1.0, side === 'L' ? 0.5 : 1.4);
      if (H && H.phase !== 'wait') { reach(y, 'L', pt(u(0)), pole('L')); reach(y, 'R', pt(u(1)), pole('R')); } else { reach(y, 'L', pt(0.12), pole('L')); reach(y, 'R', pt(0.28), pole('R')); }
      setSeg(seaRope, a0, bottom, 0.5); show = true;
      // ripples where the rope enters the sea
      ripples.forEach((m, i) => { const k = ((t * 0.6 + i / 3) % 1); m.visible = true; m.position.set(water.x, 0.06, water.z); m.scale.setScalar(0.3 + k * 2.2); m.material.opacity = (1 - k) * 0.5; });
      // Salim comes up the rope
      const sl = crew.salim;
      if (ph === 'haul' && sl && H) { const sd = depthNow; const vis = sd < 2.2 && H.phase === 'haul'; sl.want = vis; if (vis) { reparent(sl, 'boat'); sl.h.groundClamp = 'off'; const w = boatGroup.worldToLocal(V(0, 0, 0)); void w; sl.h.setPosition(3.35, -sd + 0.9 - 0.4, 0.95); sl.h.root.rotation.x = 0; sl.h.setFacing(-Math.PI / 2); playClip(sl, 'dv_rise'); } }
    } else {
      ripples.forEach((m) => { m.visible = false; });
      if (ph === 'dive' && S.D && S.D.phase === 'breath' && crew.salim) {
        const sl = crew.salim, a0 = loc(2.12, 1.38, 0.7), water = loc(3.3, 0, 0.9);
        reach(sl, 'L', a0.clone().lerp(water, 0.12), loc(1.2, 1.0, 0.1)); reach(sl, 'R', a0.clone().lerp(water, 0.3), loc(1.2, 1.0, 1.0));
        setSeg(seaRope, a0, loc(3.5, -3, 0.95), 0.5); show = true;
      }
    }
    seaRope.visible = show;
    if (!(ph === 'haul' || ph === 'haulDone' || (ph === 'dive' && S.D && S.D.phase === 'breath'))) { for (const n of ['yusuf', 'salim']) { const a = crew[n]; if (a) { a.h.setReach('L', null); a.h.setReach('R', null); } } }
  }
  const _up = V(0, 1, 0), _qq = new THREE.Quaternion(), _dd = new THREE.Vector3();
  function setSeg(mesh, a, b, r) { _dd.subVectors(b, a); const len = _dd.length() || 1e-3; _qq.setFromUnitVectors(_up, _dd.multiplyScalar(1 / len)); mesh.position.copy(a); mesh.quaternion.copy(_qq); mesh.scale.set(r / 0.03 * 0.06, len, r / 0.03 * 0.06); }
  stage.setMode('continuous');
  return { stage, ready: () => ready, busy: () => false, wrap(game) { const r = game.render.bind(game); game.render = (ctx, view) => { r(ctx, view); frame(game); }; return game; }, fps: () => ({ fps: perf.fps, budget: MAX_PIXELS, quality }), stats: () => ({ calls: renderer.info.render.calls, tris: renderer.info.render.triangles }), crew, camera };
}
