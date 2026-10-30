// Intha Leg Rowing: 3D presenter. READS the simulation (game.getState()) and never writes back. One WebGL canvas sits behind the kit's
// transparent 2D canvas: Inle Lake at first light (karst hills, floating gardens, stilt houses, mist, glinting water) with real lit boats,
// a one-legged rower on each (a real 3D figure whose free leg wraps the oar shaft), the conical net, shoals, wakes and splashes.
// The 2D layer keeps the HUD (text, pad, meter) and draws the name tags / pops through v3.proj so they sit on the 3D scene.
// Fallbacks: no WebGL / context lost -> v3.on = false and every screen draws the flat 2D lake; restored -> back to 3D without a reload.
import * as THREE from '../vendor3d/three.js';
import { v3 } from '../src/v3.js';
import { layoutFor } from '../src/layout.js';
import { stageRectFor } from '../src/stagerect.js';
import { centreAt, halfWidthAt, LOOKS } from '../src/courses.js';
import { buildLake, makeBoat, makeFishPool, waterNormalTexture, blobTexture, hash, clamp, TAU } from './world.js';
import { loadRower } from './rower.js';

const LIB = '../vendor3d/index.js';
const tick = () => new Promise((r) => setTimeout(r, 0));   // yield so the flat title paints and stays interactive while the 3D scene builds
const SKY = { dawn: 'sky-peach', garden: 'sky-day', morning: 'sky-clear', fence: 'sky-day', mist: 'sky-overcast', noon: 'sky-clear', gold: 'sky-golden', regatta: 'sky-rose' };
const TOD = { dawn: 'dawn', garden: 'day', morning: 'day', fence: 'day', mist: 'day', noon: 'day', gold: 'dusk', regatta: 'dawn' };
const FEMALE = new Set(['Thida', 'Mya', 'Hla', 'Su', 'Phyu', 'Khin', 'Ei', 'Moe', 'Nu', 'Pyae', 'Cho', 'Yin']);
const TIERS = ['high', 'medium', 'low'];

function pickQuality() {
  try { const m = /[?&]q=(low|medium|high)/.exec(globalThis.location.search); if (m) return m[1]; } catch { /* ignore */ }
  const nav = globalThis.navigator || {};
  const weak = (nav.hardwareConcurrency && nav.hardwareConcurrency <= 6) || (nav.deviceMemory && nav.deviceMemory <= 4);
  let touch = false; try { touch = !!(globalThis.matchMedia && globalThis.matchMedia('(pointer: coarse)').matches); } catch { /* ignore */ }
  return weak || touch ? 'medium' : 'high';
}

export async function createPresenter({ kitCanvas, quality = pickQuality() }) {
  const noop = { wrap: (g) => g, ok: false };
  let V3;
  try { V3 = await import(LIB); } catch (e) { console.warn('view3d failed to load; 2D fallback', e); return noop; }
  const { createStage } = V3;
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100dvh;display:block;pointer-events:none;z-index:0';
  kitCanvas.parentElement.insertBefore(canvas, kitCanvas);
  let stage;
  try {
    stage = createStage({ canvas, quality, dprCap: 2, lighting: 'day', mode: 'continuous', shadows: quality !== 'low', shadowSize: 14 });
  } catch (e) { console.warn('WebGL unavailable; 2D fallback', e); canvas.remove(); return noop; }
  if (!stage.supported || !stage.renderer) { canvas.remove(); return noop; }
  kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
  const { scene, camera, renderer } = stage;
  camera.near = 0.3; camera.far = 700; camera.fov = 44; camera.updateProjectionMatrix();
  stage._shadowOffset.set(-9, 16, 7);
  stage.lights.rim.intensity = 0.7;
  let tier = TIERS.indexOf(quality); if (tier < 0) tier = 1;

  // ---- sky + distant hills (photographic layers from the shared scenery kit, centred on the camera) ---------------------------------------
  let scenery = null, sceneryKey = '';
  async function setScenery(themeId) {
    if (sceneryKey === themeId) return;
    sceneryKey = themeId;
    try {
      const sc = V3.buildScenery({
        layers: [{ t: 'sky', id: SKY[themeId] || 'sky-day' }, { t: 'backdrop', id: 'bd-karst', mix: ['bd-rice'] }, { t: 'band', id: 'band-hills-green', r: 95, h: 14, arc: [-170, -10] }],
        culture: 'east-asian', timeOfDay: TOD[themeId] || 'day', quality: TIERS[tier], wind: 0.3, shimmer: 0,
      });
      await sc.ready;
      if (scenery) { scene.remove(scenery.group); scenery.dispose(); }
      scenery = sc; scene.add(sc.group);
    } catch (e) { console.warn('scenery unavailable', e); }
  }

  // ---- water ------------------------------------------------------------------------------------------------------------------------------
  const normal = waterNormalTexture(256);
  normal.wrapS = normal.wrapT = THREE.RepeatWrapping; normal.repeat.set(70, 70);
  const waterMat = new THREE.MeshPhysicalMaterial({ color: 0x4aa6bc, roughness: 0.16, metalness: 0.04, normalMap: normal, normalScale: new THREE.Vector2(0.28, 0.28), envMapIntensity: 1.4, clearcoat: 0.5, clearcoatRoughness: 0.18 });
  const water = new THREE.Mesh(new THREE.PlaneGeometry(700, 700), waterMat); water.rotation.x = -Math.PI / 2; water.receiveShadow = true; scene.add(water);

  // horizon haze: a soft ring of mist that melts the water's far edge into the photographic hills
  const hazeCanvas = document.createElement('canvas'); hazeCanvas.width = 4; hazeCanvas.height = 128;
  const hazeTex = new THREE.CanvasTexture(hazeCanvas);
  const hazeMat = new THREE.MeshBasicMaterial({ map: hazeTex, transparent: true, side: THREE.BackSide, depthWrite: false, fog: false, toneMapped: false });
  const haze = new THREE.Mesh(new THREE.CylinderGeometry(105, 105, 46, 48, 1, true), hazeMat); haze.position.y = 8; haze.renderOrder = 1; haze.frustumCulled = false; scene.add(haze);
  function paintHaze(hex) {
    const g = hazeCanvas.getContext('2d'), c = new THREE.Color(hex), rgb = `${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)}`;
    const gr = g.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, `rgba(${rgb},0)`); gr.addColorStop(0.45, `rgba(${rgb},0.55)`); gr.addColorStop(0.62, `rgba(${rgb},0.95)`); gr.addColorStop(1, `rgba(${rgb},1)`);
    g.clearRect(0, 0, 4, 128); g.fillStyle = gr; g.fillRect(0, 0, 4, 128); hazeTex.needsUpdate = true;
  }

  // ---- lakes (built per course, cached), boats, fish, wakes, splashes -------------------------------------------------------------------
  const lakes = new Map(); let lake = null, lakeId = '';
  function ensureLake(C) {
    if (lakeId === C.id) return;
    if (!lakes.has(C.id)) {
      if (lakes.size >= 2) { const [k, v] = lakes.entries().next().value; scene.remove(v); v.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); lakes.delete(k); }
      const g = buildLake(C, C.theme, TIERS[tier]); g.userData.course = C; lakes.set(C.id, g); scene.add(g);
    }
    for (const [k, g] of lakes) g.visible = k === C.id;
    lake = lakes.get(C.id); lakeId = C.id;
    applyTheme(C);
    setScenery(C.themeId);
  }
  const wakeTex = blobTexture('255,255,255', 0.9, 64);
  const wakeGeo = new THREE.PlaneGeometry(1, 1); wakeGeo.rotateX(-Math.PI / 2);
  const WAKE_MAX = 200;
  const wakes = new THREE.InstancedMesh(wakeGeo, new THREE.MeshBasicMaterial({ map: wakeTex, transparent: true, opacity: 0.85, depthWrite: false }), WAKE_MAX);
  wakes.frustumCulled = false; wakes.renderOrder = 2; wakes.count = 0; scene.add(wakes);
  const splashes = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 6, 5), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2, transparent: true, opacity: 0.9 }), 160);
  splashes.frustumCulled = false; splashes.count = 0; scene.add(splashes);
  const fish = makeFishPool(220); scene.add(fish);
  const ripGeo = new THREE.RingGeometry(0.5, 0.56, 28); ripGeo.rotateX(-Math.PI / 2);
  const ripples = []; for (let i = 0; i < 14; i++) { const m = new THREE.Mesh(ripGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false })); m.renderOrder = 2; m.visible = false; scene.add(m); ripples.push(m); }
  const dashGeo = new THREE.BoxGeometry(0.4, 0.03, 0.12);
  const dashes = new THREE.InstancedMesh(dashGeo, new THREE.MeshBasicMaterial({ color: 0xffe278 }), 40); dashes.count = 0; dashes.frustumCulled = false; scene.add(dashes);
  const targetRing = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.0, 40), new THREE.MeshBasicMaterial({ color: 0xffe278, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false })); targetRing.rotation.x = -Math.PI / 2; targetRing.position.y = 0.05; targetRing.visible = false; scene.add(targetRing);
  const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpV = new THREE.Vector3(), tmpS = new THREE.Vector3(), tmpC = new THREE.Color(), tmpE = new THREE.Euler();
  const UP = new THREE.Vector3(0, 1, 0);

  // boats and riders per look index
  const slots = new Map();         // boat id -> { boat, rider, li }
  const riders = new Map();        // key -> rower (loaded lazily)
  const riderLoading = new Set();
  function slotFor(b) {
    const li = typeof b.look === 'number' ? b.look : 0;
    let s = slots.get(b.id);
    if (!s || s.li !== li) {
      if (s) { scene.remove(s.boat.group); if (s.rider) { s.rider.taken = false; s.rider.h.root.removeFromParent(); s.rider = null; } }
      const boat = makeBoat(LOOKS[li] ?? LOOKS[0], { seed: li });
      scene.add(boat.group);
      s = { boat, li, rider: null, sm: null, female: FEMALE.has(b.name) };
      slots.set(b.id, s);
    }
    if (!s.rider) {
      const key = `${li}:${s.female ? 1 : 0}:${b.id}`;
      const have = riders.get(key);
      if (have) { have.taken = true; s.rider = have; s.boat.model.add(have.h.root); have.h.root.visible = true; }
      else if (!riderLoading.has(key)) {
        riderLoading.add(key);
        loadRower(V3, stage, { look: LOOKS[li] ?? LOOKS[0], female: s.female, lod: tier === 0 ? 0 : 1 }).then((r) => { riders.set(key, r); riderLoading.delete(key); stage.invalidate(); }).catch((e) => { console.warn('rower failed', e); riderLoading.delete(key); });
      }
    }
    return s;
  }

  // ---- theme: lighting, fog, water colour -----------------------------------------------------------------------------------------------
  function applyTheme(C) {
    const th = C.theme, id = C.themeId, mist = id === 'mist';
    const tint = { dawn: ['#ffd9b0', 0.95], garden: ['#fff0d0', 1.05], morning: ['#fff6e0', 1.1], fence: ['#fff2d8', 1.08], mist: ['#f0f0ea', 0.95], noon: ['#ffffff', 1.2], gold: ['#ffcf90', 1.0], regatta: ['#ffd8c4', 1.0] }[id] || ['#fff4e0', 1.1];
    stage.setLighting('day', { exposure: 0.88, hemi: mist ? 0.8 : 0.62, keyI: 2.3 * tint[1], key: tint[0], sky: th.mist, fog: th.mist, hemiSky: th.mist, hemiGround: '#3a4a2a', rim: '#ffffff', rimI: 0.8 });
    scene.fog = new THREE.Fog(new THREE.Color(th.mist), mist ? 14 : 38, mist ? 70 : 150);
    paintHaze(th.mist);
    waterMat.color.set(th.water[1]);
    waterMat.color.lerp(new THREE.Color(th.deep), 0.45);
    stage.invalidate();
  }

  // ---- sizing / camera ------------------------------------------------------------------------------------------------------------------
  let W = 0, H = 0, lastL = null;
  function resize() { const w = Math.max(1, Math.floor(window.innerWidth)), h = Math.max(1, Math.floor(window.innerHeight)); if (w !== W || h !== H) { W = w; H = h; stage.resize(); } }
  const camPos = new THREE.Vector3();
  // frame the focus point F (world) so that `lat` metres either side fills the stage rect, with F at (ax, ay) of the rect.
  function frame(rect, L, F, o) {
    const k = W / L.w, rw = rect.w * k, land = rect.w > rect.h * 1.02;
    const pitch = (o.pitch * Math.PI) / 180, yaw = ((o.yaw || 0) * Math.PI) / 180;
    camera.fov = o.fov; camera.aspect = W / H; camera.clearViewOffset(); camera.updateProjectionMatrix();
    const dirH = o.dir ? new THREE.Vector3(o.dir[0], 0, o.dir[1]).normalize() : (land ? new THREE.Vector3(-Math.sin(yaw) * 0.55, 0, 0.9).normalize() : new THREE.Vector3(-Math.cos(yaw), 0, Math.sin(yaw)));
    let d = 20;
    const place = () => {
      camPos.set(F.x + dirH.x * Math.cos(pitch) * d, F.y + Math.sin(pitch) * d, F.z + dirH.z * Math.cos(pitch) * d);
      camera.position.copy(camPos); camera.lookAt(F); camera.updateMatrixWorld(); camera.updateProjectionMatrix();
    };
    // measure along the screen-horizontal ground direction (perpendicular to the view direction)
    const side = new THREE.Vector3(-dirH.z, 0, dirH.x).normalize();
    const span = land ? o.lat * 2 * clamp(rect.w / rect.h, 1, 2.2) : o.lat * 2;
    for (let it = 0; it < 5; it++) {
      place();
      const a = tmpV.copy(F).addScaledVector(side, -span / 2).project(camera).x, b = tmpS.copy(F).addScaledVector(side, span / 2).project(camera).x;
      d *= (Math.abs(b - a) / 2 * W) / rw;
    }
    place();
    const c = tmpV.copy(F).project(camera);
    const px0 = ((c.x + 1) / 2) * W, py0 = ((1 - c.y) / 2) * H;
    const cx = (rect.x + rect.w * o.ax) * k, cy = (rect.y + rect.h * o.ay) * k;
    camera.setViewOffset(W, H, px0 - cx, py0 - cy, W, H);
    camera.updateProjectionMatrix(); camera.updateMatrixWorld();
  }
  const _p = new THREE.Vector3();
  v3.proj = (s, n, y = 0) => {
    if (!lastL) return { x: -999, y: -999 };
    _p.set(s, y, n).project(camera);
    return { x: ((_p.x + 1) / 2) * lastL.w, y: ((1 - _p.y) / 2) * lastL.h };
  };

  // ---- per-frame world update -----------------------------------------------------------------------------------------------------------
  let clock = 0, lastT = 0, frames = 0, ema = 16, tierCool = 0;
  const lerp = (a, b, t) => a + (b - a) * t;
  function updateBoat(b, s, t, dt) {
    const bt = s.boat, g = bt.group;
    if (!s.sm) s.sm = { s: b.s, n: b.n, h: b.h, a: b.a, sway: b.sway, poise: b.poise, net: b.net || 0, v: b.v };
    const m = s.sm, k = dt > 0 ? 1 - Math.exp(-dt / 0.05) : 1;
    if (Math.abs(b.s - m.s) > 4 || Math.abs(b.n - m.n) > 4) { m.s = b.s; m.n = b.n; m.h = b.h; }
    m.s = lerp(m.s, b.s, k); m.n = lerp(m.n, b.n, k); m.h = lerp(m.h, b.h, k); m.a = lerp(m.a, b.a, 1 - Math.exp(-dt / 0.035)); m.sway = lerp(m.sway, b.sway, k); m.poise = lerp(m.poise, b.poise, k); m.net = lerp(m.net, b.net || 0, k); m.v = lerp(m.v, b.v, k);
    const swell = b.inSwell ? 1 : 0;
    const bob = Math.sin(t * 1.6 + b.id * 1.7) * 0.012 + swell * Math.sin(t * 3 + b.id) * 0.045;
    g.position.set(m.s, bob, m.n); g.rotation.set(0, -m.h, 0);
    bt.model.rotation.set(m.sway * 0.12 + swell * Math.sin(t * 2.3 + b.id) * 0.04, 0, -clamp(m.v, 0, 6) * 0.004 + swell * Math.sin(t * 3 + b.id) * 0.025);
    // the oar: a pivot at the post; the shaft sweeps through `ang` and dips to the water when in the stroke
    const ang = Math.PI / 2 + m.a * 0.72, dropEnd = b.inWater ? -0.06 : 0.1;
    s.oarDip = lerp(s.oarDip ?? dropEnd, dropEnd, dt > 0 ? 1 - Math.exp(-dt / 0.06) : 1);
    const LEN = 3.0, phi = Math.atan2(0.64 - s.oarDip, LEN);
    bt.oarPivot.rotation.set(0, -ang, -phi);
    const len = LEN / Math.cos(phi);
    bt.shaft.scale.x = len + 0.35; bt.shaft.position.x = (len - 0.35) / 2;
    bt.blade.position.x = len - 0.38; bt.blade.material.color.set(b.inWater ? '#7a5a2c' : '#a07a40');
    // net, pole, catch
    const me = b.id === 0, charge = m.net;
    const R = me ? 0.95 - charge * 0.18 : 0.42, Hh = me ? 1.5 : 0.8, cx = 0.4, cz = me ? 1.9 : 0.8;
    const nbob = Math.sin(t * 1.9 + b.id) * 0.02;
    bt.net.position.set(cx, nbob, cz);
    bt.cone.scale.set(R, Hh, R); bt.cone.position.y = Hh / 2 + 0.03;
    bt.mouth.scale.setScalar(R); bt.mouth.position.y = 0.03;
    bt.glow.scale.setScalar(R + 0.2); bt.glow.position.y = 0.04; bt.glow.material.opacity = me ? clamp(charge, 0, 1) * 0.9 : 0;
    const apex = new THREE.Vector3(cx, Hh + 0.03 + nbob, cz);
    bt.rib.forEach((r, i) => {
      const a = (i / bt.rib.length) * TAU, p0 = new THREE.Vector3(cx + Math.cos(a) * R, 0.03, cz + Math.sin(a) * R);
      const d = new THREE.Vector3().subVectors(apex, p0), L = d.length();
      r.position.copy(p0).addScaledVector(d, 0.5); r.quaternion.setFromUnitVectors(UP, d.normalize()); r.scale.set(1, L, 1);
    });
    const ps = new THREE.Vector3(-1.7, 1.08, 0.34);
    { const d = new THREE.Vector3().subVectors(apex, ps), L = d.length(); bt.pole.position.copy(ps).addScaledVector(d, 0.5); bt.pole.quaternion.setFromUnitVectors(UP, d.normalize()); bt.pole.scale.set(1, L, 1); s.poleStart = ps; s.poleEnd = apex; }
    bt.netMat.opacity = me ? 0.85 + charge * 0.15 : 0.7;
    bt.fishes.forEach((f, i) => { f.visible = i < Math.min(5, b.fish || 0); });
    if (s.rider) s.rider.pose(bt, { b, m, t, dt, s, ang, phi, len });
  }

  function updateFish(W_, me, t) {
    let n = 0; const col = new THREE.Color();
    for (const sh of W_.shoals) {
      if (sh.caught) continue;
      const near = Math.hypot(sh.s - (me.s + 0.4), sh.n - (me.n + 1.9)) < 2.3;
      const count = 6 + sh.size * 2;
      for (let i = 0; i < count && n < 220; i++, n++) {
        const h1 = hash(sh.id * 31 + i), h2 = hash(sh.id * 17 + i * 3 + 1);
        const sp = 0.5 + 0.9 * h1, a = t * sp * (i % 2 ? 1 : -1) + h2 * TAU, rr = 0.2 + 0.55 * h2 + 0.08 * Math.sin(t * 2 + i);
        const x = sh.s + Math.cos(a) * rr, z = sh.n + Math.sin(a) * rr * 0.85, dir = a + (i % 2 ? Math.PI / 2 : -Math.PI / 2);
        tmpQ.setFromEuler(tmpE.set(0, -dir, 0)); tmpV.set(x, -0.015 + 0.02 * Math.sin(t * 5 + i), z); tmpS.set(1.7, 0.5, 0.55);
        tmpM.compose(tmpV, tmpQ, tmpS); fish.setMatrixAt(n, tmpM);
        col.set(near ? '#fff4c8' : '#d6eef4'); fish.setColorAt(n, col);
      }
    }
    fish.count = n; fish.instanceMatrix.needsUpdate = true; if (fish.instanceColor) fish.instanceColor.needsUpdate = true;
    let r = 0;
    for (const sh of W_.shoals) {
      if (sh.caught) continue;
      for (let q = 0; q < 2 && r < ripples.length; q++, r++) {
        const ph = (t * 0.5 + q * 0.5 + sh.id * 0.17) % 1, m = ripples[r];
        m.visible = true; m.position.set(sh.s, 0.03, sh.n); m.scale.set(0.7 + ph * 1.5, 1, 0.6 + ph * 1.2); m.material.opacity = 0.5 * (1 - ph);
      }
    }
    for (; r < ripples.length; r++) ripples[r].visible = false;
  }

  const WHITE = new THREE.Color(0xffffff);
  function updateWakes(W_) {
    let n = 0; const col = new THREE.Color(), wc = new THREE.Color(lake ? lake.userData.course.theme.water[1] : '#7fb9c0');
    for (const b of W_.boats) {
      const hc = Math.cos(b.h), hs = Math.sin(b.h);
      for (const p of b.trail) {
        const age = W_.t - p.t; if (age > 3.4 || p.v < 0.4 || n >= WAKE_MAX - 6) continue;
        const k = 1 - age / 3.4, spread = 0.5 + age * 0.55, a = 0.55 * k * Math.min(1, p.v / 2.5);
        for (const sgn of [-1, 1]) {
          tmpQ.identity(); tmpV.set(p.s, 0.025, p.n + sgn * spread); tmpS.set(0.5 + age * 0.35, 1, 0.3 + age * 0.12); tmpM.compose(tmpV, tmpQ, tmpS); wakes.setMatrixAt(n, tmpM); col.copy(wc).lerp(WHITE, a); wakes.setColorAt(n++, col);
        }
      }
      if (b.v > 0.8 && n < WAKE_MAX - 6) {   // bow wave
        const bx = b.s + 2.7 * hc, bz = b.n + 2.7 * hs;
        for (const sgn of [-1, 1]) { tmpQ.setFromEuler(tmpE.set(0, -b.h + sgn * 0.5, 0)); tmpV.set(bx - 0.5 * hc + sgn * 0.3 * hs, 0.03, bz - 0.5 * hs - sgn * 0.3 * hc); tmpS.set(1.0, 1, 0.22); tmpM.compose(tmpV, tmpQ, tmpS); wakes.setMatrixAt(n, tmpM); col.copy(wc).lerp(WHITE, Math.min(0.8, b.v * 0.2)); wakes.setColorAt(n++, col); }
      }
    }
    wakes.count = n; wakes.instanceMatrix.needsUpdate = true; if (wakes.instanceColor) wakes.instanceColor.needsUpdate = true;
  }

  function updateSplash(parts) {
    let n = 0;
    for (const p of parts) {
      if (n >= 160) break;
      const u = p.life / p.max, y = 0.08 + Math.sin(Math.PI * Math.min(1, u * 1.2)) * 0.5 * (0.5 + p.r * 5);
      tmpQ.identity(); tmpV.set(p.s, y, p.n); const r = p.r * 1.3 * (1 - u * 0.5); tmpS.set(r, r, r); tmpM.compose(tmpV, tmpQ, tmpS); splashes.setMatrixAt(n, tmpM); tmpC.set(p.col); splashes.setColorAt(n++, tmpC);
    }
    splashes.count = n; splashes.instanceMatrix.needsUpdate = true; if (splashes.instanceColor) splashes.instanceColor.needsUpdate = true;
  }

  function updateLakeFx(world, W_, t) {
    const L = lake; if (!L) return;
    const Cc = L.userData.course;
    L.userData.gates.forEach((go, i) => {
      const res = W_.gateRes[i];
      go.lineMat.color.set(res === true ? '#7dffa6' : res === false ? '#ff8a7a' : '#ffffff'); go.lineMat.opacity = res == null ? 0.5 : 0.85;
      go.flags.forEach((f, j) => { f.rotation.y = Math.sin(t * 5 + i + j) * 0.25; });
    });
    L.userData.stakes.forEach((so, i) => {
      const w = W_.stakeWob[i] || 0;
      so.ring.material.opacity = 0.7 * w; const sc = 0.5 + (1 - w) * 2.2; so.ring.scale.set(sc, sc, sc);
      so.grp.rotation.z = Math.sin(t * 30) * 0.06 * w;
    });
    L.userData.swellFlags.forEach((f, i) => { f.rotation.y = Math.sin(t * 4 + i) * 0.3; });
    for (const c of L.userData.crests) {
      const w = c.w, len = w.s1 - w.s0, s = w.s0 + ((c.k * (len / 8) + t * 1.5) % len), fade = Math.min(1, (s - w.s0) / 1.5, (w.s1 - s) / 1.5);
      const sc = clamp(s, 0, Cc.length), cen = centreAt(Cc, sc), hw = halfWidthAt(Cc, sc) - 0.2;
      c.m.position.set(s, 0.045 + 0.03 * Math.sin(t * 2 + c.k), cen); c.m.scale.set(1, hw * 2, 1); c.m.material.opacity = 0.5 * fade;
      c.m.visible = world.camS > w.s0 - 40 && world.camS < w.s1 + 40;
    }
    if (L.userData.bunting) L.userData.bunting.forEach((f, i) => { f.rotation.y = Math.sin(t * 3.5 + i) * 0.3; });
  }

  // ---- the frame --------------------------------------------------------------------------------------------------------------------------
  function frameScene(state, Ly) {
    const sc = state.scene, calm = !!state.prefs?.calm;
    const world = sc === 'play' && state.pl ? state.pl : state.menu;
    if (!world) return false;
    const W_ = world.W, C = W_.course, me = W_.boats[0];
    if (lakeId !== C.id) ensureLake(C);
    if (!lake) return false;
    const rect = stageRectFor(state, Ly, Ly.w, Ly.h);
    v3.stage = rect;
    const now = performance.now(), dt = Math.min(0.1, Math.max(0, (now - lastT) / 1000)); lastT = now;
    const paused = sc === 'play' && state.pl?.paused;
    const dts = paused ? 0 : dt; clock += dts;
    ema = ema * 0.95 + dt * 1000 * 0.05; frames++; tierCool -= dt;
    if (frames > 120 && ema > 26 && tier < TIERS.length - 1 && tierCool <= 0) { tier++; tierCool = 4; frames = 60; ema = 16; stage.setQuality(TIERS[tier]); stage.invalidate(); }
    resize();
    for (const b of W_.boats) updateBoat(b, slotFor(b), clock, dts);
    for (const [id, s] of slots) s.boat.group.visible = id < W_.boats.length;
    updateFish(W_, me, clock);
    updateWakes(W_);
    updateSplash(world.parts || []);
    updateLakeFx(world, W_, clock);
    let nd = 0;
    if (world.reveal && sc === 'play') {
      const R = world.reveal;
      if (R.path) for (let i = 0; i + 1 < R.path.length && nd < 40; i++) {
        const a = R.path[i], b = R.path[i + 1], ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
        tmpQ.setFromEuler(tmpE.set(0, -ang, 0)); tmpV.set((a[0] + b[0]) / 2, 0.06, (a[1] + b[1]) / 2); tmpS.set(1, 1, 1); tmpM.compose(tmpV, tmpQ, tmpS); dashes.setMatrixAt(nd++, tmpM);
      }
      if (R.target) { const pulse = 0.6 + 0.4 * Math.sin(clock * 8); targetRing.visible = true; targetRing.position.x = R.target.s; targetRing.position.z = R.target.n; targetRing.scale.setScalar(1 + 0.15 * pulse); targetRing.material.opacity = pulse; } else targetRing.visible = false;
    } else targetRing.visible = false;
    dashes.count = nd; dashes.instanceMatrix.needsUpdate = true;
    const fx = world.camS ?? me.s, fz = world.camN ?? me.n;
    water.position.set(fx, 0, fz); haze.position.x = fx; haze.position.z = fz;
    const tile = 700 / 70;
    normal.offset.set((fx / tile + clock * 0.012) % 1, (-fz / tile + clock * 0.007) % 1);
    stage.setShadowTarget(fx, 0, fz);
    const land = rect.w > rect.h * 1.02;
    const F = new THREE.Vector3(fx + 0.3, 0.55, fz);
    if (sc === 'title') {
      const t = state.t ?? clock, drift = calm ? 0 : Math.sin(t * 0.22) * 8;
      const hero = new THREE.Vector3(fx - 1.2, 1.0, fz + 0.5);
      const a = (land ? 35 : 38) + drift;
      frame(rect, Ly, hero, { pitch: land ? 16 : 14, fov: 38, dir: [Math.cos((a * Math.PI) / 180), -Math.sin((a * Math.PI) / 180)], lat: land ? 3.6 : 3.4, ax: 0.5, ay: 0.62 });
    } else if (sc === 'play') {
      if (land) frame(rect, Ly, F, { pitch: 42, fov: 40, yaw: 0, lat: 3.4, ax: 0.32, ay: 0.55 });
      else frame(rect, Ly, F, { pitch: 40, fov: 42, yaw: 0, lat: 3.3, ax: 0.5, ay: 0.68 });
    } else frame(rect, Ly, F, land ? { pitch: 40, fov: 42, yaw: 0, lat: 7.5, ax: 0.5, ay: 0.55 } : { pitch: 46, fov: 44, yaw: 0, lat: 7.0, ax: 0.5, ay: 0.7 });
    { const a = v3.proj(me.s, me.n, 0), b = v3.proj(me.s + 1, me.n, 0), c = v3.proj(me.s, me.n + 1, 0); v3.ppm = Math.max(18, (Math.hypot(b.x - a.x, b.y - a.y) + Math.hypot(c.x - a.x, c.y - a.y)) / 2); }
    if (scenery) scenery.update(dts, camera);
    stage.update(dts);
    return true;
  }

  stage.onContextLost(() => { v3.on = false; });
  stage.onContextRestored(() => { try { if (lake) applyTheme(lake.userData.course); } catch { /* keep going */ } v3.on = true; W = 0; resize(); });

  // first build in slices so the flat title stays interactive
  try {
    await tick(); resize(); await tick();
    try { await renderer.compileAsync(scene, camera); } catch { /* the first frame compiles instead */ }
  } catch (e) { console.warn('3D init failed; 2D fallback', e); canvas.remove(); v3.on = false; return noop; }
  v3.on = true;

  // Offline icon render (developer tool via icon.html): a hero close-up of the rower on the stern, from the scene the game itself draws.
  async function renderIcon({ W: world, size = 2048, cam = {} }) {
    const C = world.course;
    ensureLake(C);
    await setScenery(C.themeId);
    for (let i = 0; i < 600; i++) {
      let all = true; for (const b of world.boats) { const s = slotFor(b); if (!s.rider) all = false; }
      if (all) break; await new Promise((r) => setTimeout(r, 50));
    }
    for (const [id, s] of slots) s.boat.group.visible = cam.solo ? id === 0 : id < world.boats.length;
    const me = world.boats[0];
    water.position.set(me.s, 0, me.n); haze.position.x = me.s; haze.position.z = me.n; stage.setShadowTarget(me.s, 0, me.n);
    let t = 0;
    for (let f = 0; f < 90; f++) { t += 1 / 60; for (const b of world.boats) updateBoat(b, slotFor(b), t, 1 / 60); updateFish(world, me, t); if (!cam.solo) updateWakes(world); else wakes.count = 0; updateLakeFx({ camS: me.s }, world, t); stage.update(1 / 60, { renderNow: false }); }
    updateSplash([]);
    if (cam.hide) for (const i of cam.hide) slots.get(0).boat.model.children[i].visible = false;
    renderer.setPixelRatio(1); renderer.setSize(size, size, false);
    camera.aspect = 1; camera.clearViewOffset(); camera.fov = cam.fov ?? 30; camera.updateProjectionMatrix();
    const F = new THREE.Vector3(me.s + (cam.fx ?? -1.5), cam.fy ?? 1.05, me.n + (cam.fz ?? 0.55));
    const az = ((cam.az ?? -38) * Math.PI) / 180, el = ((cam.el ?? 9) * Math.PI) / 180, d = cam.d ?? 7.4;
    camera.position.set(F.x + Math.cos(az) * Math.cos(el) * d, F.y + Math.sin(el) * d, F.z + Math.sin(az) * Math.cos(el) * d);
    camera.lookAt(F); camera.updateMatrixWorld();
    if (scenery) scenery.update(0.016, camera);
    stage.update(0, { renderNow: false });
    renderer.render(scene, camera);
    return canvas.toDataURL('image/png');
  }

  return {
    ok: true, stage, scene, camera, riders, slots, renderIcon,
    wrap(game) {
      return Object.assign({}, game, {
        render(ctx, view) {
          if (!v3.on) { game.render(ctx, view); return; }
          const state = game.getState();
          const Ly = layoutFor(view?.width ?? 720, view?.height ?? 1560);
          lastL = Ly;
          let ok = false;
          try { ok = frameScene(state, Ly); } catch (e) { console.warn('3D frame failed; 2D fallback', e); v3.on = false; }
          v3.live = ok;
          game.render(ctx, view);
        },
      });
    },
  };
}
