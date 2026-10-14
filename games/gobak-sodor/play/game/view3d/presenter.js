// 3D presenter for Gobak Sodor (game-owned). It only READS what the 2D view hands over each frame (src/glhook.js: the court size, the
// cells people stand on, the red touch zones) and draws the sand court and real 3D people behind the transparent kit canvas.
// The kit canvas keeps the HUD, menus, rings, arrows and input; one oblique-orthographic camera maps the court's own 2D transform
// onto the ground plane, so every 2D mark lands exactly on the 3D cell it belongs to, on every screen size and in both orientations.
// Without WebGL2, with ?nogl, on context loss, or while the assets are slow (main.js waits at most 1.6 s) the 2D art plays instead.
import { gl } from '../src/glhook.js';
import { CX, cellY } from '../src/layout.js';
import { Person, KITS, SCALE } from './people.js';
import { buildSet, S } from './scene.js';

const LIB = '../vendor3d/index.js';
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

const LOOKS = [
  { ch: 'athlete_m', skin: 'tan', hair: 'black' }, { ch: 'athlete_f', skin: 'brown', hair: 'black' }, { ch: 'athlete_m', skin: 'light', hair: 'brown' },
  { ch: 'athlete_f', skin: 'tan', hair: 'black' }, { ch: 'athlete_m', skin: 'brown', hair: 'black' }, { ch: 'athlete_f', skin: 'light', hair: 'brown' },
  { ch: 'athlete_m', skin: 'deep', hair: 'black' }, { ch: 'athlete_f', skin: 'brown', hair: 'black' }, { ch: 'athlete_m', skin: 'tan', hair: 'brown' },
  { ch: 'athlete_f', skin: 'tan', hair: 'black' }, { ch: 'athlete_m', skin: 'deep', hair: 'black' },
];
// slots: 0-2 runners, 3-9 line guards (up to 7 with the pair on the top level), 10 the sodor guard
const NSLOT = 11;

function pickQuality() {
  try { const m = /[?&]q=(low|medium|high)/.exec(globalThis.location.search); if (m) return m[1]; } catch { /* ignore */ }
  const nav = globalThis.navigator || {};
  const weak = (nav.hardwareConcurrency && nav.hardwareConcurrency <= 4) || (nav.deviceMemory && nav.deviceMemory <= 3);
  const touch = (nav.maxTouchPoints | 0) > 0 || (globalThis.matchMedia && globalThis.matchMedia('(pointer: coarse)').matches);
  return weak ? 'low' : touch ? 'medium' : 'high';
}

export async function createPresenter({ kitCanvas, quality = pickQuality() }) {
  const none = { stage: null, wrap: (g) => g, ready_p: Promise.resolve(false) };
  let V3;
  try { V3 = await import(LIB); } catch (e) { console.warn('view3d failed to load; using the 2D fallback', e); return none; }
  const { createStage, loadHuman, createCrowd3d, board3d, THREE } = V3;
  const canvas = globalThis.document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;left:0;top:0;width:100vw;height:100dvh;display:block;pointer-events:none;z-index:0';
  kitCanvas.parentElement.insertBefore(canvas, kitCanvas);
  kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
  let stage;
  try { stage = createStage({ canvas, quality, dprCap: 2, lighting: 'day', mode: 'continuous', shadows: quality !== 'low', shadowSize: 9, preserveDrawingBuffer: /[?&](shot|pdb)=/.test(globalThis.location.search) }); } catch { canvas.remove(); return none; }
  if (!stage.supported) { canvas.remove(); return none; }
  const cam = stage.camera;
  stage.scene.fog = null;
  stage.scene.background = null;
  cam.updateProjectionMatrix = () => {};          // the projection below is ours (an oblique orthographic map of the court)
  stage.setLighting('day', { exposure: 1, hemi: 1.3, hemiSky: 0xfff6e4, hemiGround: 0xb08a58, key: 0xffe6bc, keyI: 2.5, rim: 0xbcd4ff, rimI: 0.55 });
  stage.scene.environment = null; stage.scene.environmentIntensity = 0;
  stage.renderer.toneMapping = 0;                   // none: the painted palette of the village reads as designed
  const L_ = stage.lights;
  if (L_ && L_.key && L_.key.shadow) { const sc = L_.key.shadow.camera; Object.assign(sc, { left: -9, right: 9, top: 13, bottom: -13, near: 1, far: 60 }); sc.updateProjectionMatrix(); L_.key.shadow.bias = -0.0005; L_.key.shadow.normalBias = 0.03; L_.key.shadow.radius = 4; }
  stage._shadowOffset.set(-6, 10, 3); stage.setShadowTarget(0, 0, 0);
  const useBlobs = !stage.renderer.shadowMap.enabled;
  const blobs = useBlobs && stage.enableBlobShadows ? stage.enableBlobShadows(NSLOT + 1, { radius: 0.5, opacity: 0.6 }) : null;

  const P = { stage, THREE, ready: false, lost: false, trace: null, people: [], set: null };
  // the licence text of the 3D layer for the About page (shown only when the 3D players are really on)
  try { fetch('./vendor3d/LICENSES.md').then((r) => (r.ok ? r.text() : '')).then((t) => { gl.licenses = t || ''; }).catch(() => {}); } catch { /* ignore */ }
  stage.onContextLost(() => { P.lost = true; gl.active = false; });
  stage.onContextRestored(() => { stage.scene.environment = null; P.lost = false; stage.resize(); stage.invalidate(); gl.active = P.ready; });

  // ---- static pieces: the screen-sized backdrop, the sand court, the pool of red zones --------------------------------------------------------
  const root = new THREE.Group(); stage.scene.add(root);
  const mkCanvas = (w, h) => { const c = globalThis.document.createElement('canvas'); c.width = Math.max(2, Math.round(w)); c.height = Math.max(2, Math.round(h)); return c; };
  const basic = (map, o = {}) => new THREE.MeshBasicMaterial({ map, toneMapped: false, fog: false, transparent: !!o.transparent, depthWrite: !!o.depthWrite });
  // A canvas texture is immutable once uploaded: a new size means a new texture (the old one is released).
  const setMap = (mesh, w, h, paint) => {
    const c = mkCanvas(w, h); paint(c.getContext('2d'), c.width, c.height);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    const old = mesh.material.map; mesh.material.map = t; mesh.material.needsUpdate = true; if (old) old.dispose();
  };
  const plane = (o = {}) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ toneMapped: false, fog: false, transparent: !!o.transparent, depthWrite: !!o.depthWrite, opacity: o.opacity ?? 1 })); m.rotation.x = -Math.PI / 2; m.visible = false; root.add(m); return m; };
  // the village: lit ground, court, bund, bamboo fence, home mat, trees, houses (scene.js); the children are a crowd3d below
  const set = buildSet({ THREE, B: board3d, quality, root }); P.set = set;
  let crowd = null, crowdKey = '';
  const proxy = new THREE.PerspectiveCamera(60, 1, 0.1, 400);       // the crowd's level-of-detail pass wants a perspective camera near the court
  proxy.position.set(0, 18, 14); proxy.lookAt(0, 0, 0); proxy.updateMatrixWorld(true);
  const buildCrowd = (ln, pitch) => {
    const { zFar, zHome } = set.layout(ln, pitch).bounds, key = `${ln}:${zFar.toFixed(1)}:${zHome.toFixed(1)}:${quality}`;
    if (key === crowdKey) return;
    crowdKey = key;
    if (crowd) { try { crowd.dispose(); } catch { /* ignore */ } crowd = null; }
    if (!createCrowd3d) return;
    try {
      crowd = createCrowd3d(stage, { points: set.crowdPoints(ln, pitch, quality !== 'low'), seed: 41, culture: 'south_asian', quality: quality === 'low' ? 'low' : 'medium', kids: 0.85, camera: proxy, viewportHeight: 3200,
        props: { flag: 0.15, phone: 0, child: 0 }, flagColors: ['#ffd24a', '#e2402f', '#38c9a8'], excitement: 0.45, reaction: { spread: 0.5, speed: 12 } });
    } catch (e) { console.warn('crowd3d unavailable', e); crowd = null; }
  };
  // the red touch zones: one rounded rectangle texture each, repainted only when its size changes (crisp at any court scale)
  const zones = [];
  for (let i = 0; i < 9; i++) { const m = plane({ transparent: true, opacity: 0.2 }); m.renderOrder = -1; m.userData = { key: '' }; zones.push(m); }
  const paintZone = (m, w, h) => {
    const k = 1.5;
    setMap(m, Math.max(8, w * k), Math.max(8, h * k), (g, cw, chh) => {
      g.fillStyle = '#ff543c'; g.beginPath(); g.roundRect(3, 3, cw - 6, chh - 6, 14 * k); g.fill();
      g.strokeStyle = '#ff2a10'; g.lineWidth = 5; g.stroke();
    });
  };

  // ---- the people ----------------------------------------------------------------------------------------------------------------------------
  const people = P.people;
  async function build() {
    const lod = quality === 'low' ? 2 : 1;
    const hs = await Promise.all(Array.from({ length: NSLOT }, (_, i) => { const lk = LOOKS[i]; return loadHuman({ character: lk.ch, kit: { ...KITS.runner }, skin: lk.skin, hair: lk.hair, scale: SCALE, lod, quality }); }));
    hs.forEach((h, i) => {
      h.groundClamp = 'auto'; h.footPlanting = true;
      h.play('idle', { fade: 0 });
      stage.add(h); stage.track(h);
      h.root.traverse((m) => { if (m.isMesh) { m.castShadow = true; } });
      const p = new Person(h);
      p.slot = i; h.root.visible = false;
      people.push(p);
    });
    P.ready = true; gl.active = !P.lost;
    stage.invalidate();
  }
  P.ready_p = build().then(() => true).catch((e) => { console.warn('view3d build failed', e); return false; });

  // ---- adaptive quality: a slow device drops the pixel ratio, never the game -------------------------------------------------------------------
  let perfN = 0, perfSum = 0, perfLast = 0, perfLevel = 0;
  function perfTick(now) {
    if (perfLast) { const d = now - perfLast; if (d < 250) { perfSum += d; perfN++; } }
    perfLast = now;
    if (perfN >= 90) {
      const avg = perfSum / perfN; perfN = 0; perfSum = 0;
      if (avg > 24 && perfLevel < 2) { perfLevel++; stage.renderer.setPixelRatio(perfLevel === 1 ? Math.min(1.25, stage.renderer.getPixelRatio()) : 1); stage.invalidate(); }
    }
  }

  // ---- the camera: ground plane = the court's 2D transform, height goes up the screen by `vk` (the cotangent of the pitch) -------------------
  function setCamera(F, vk) {
    const { cx, cy, f } = F.xf, Wv = F.W_, Hv = F.H_, a = f / S;
    const th = Math.atan2(1, vk), sn = Math.sin(th), cs = Math.cos(th), Dd = 40, near = Dd - 40, far = Dd + 40;
    cam.position.set(0, Dd * sn, Dd * cs); cam.up.set(0, 1, 0); cam.lookAt(0, 0, 0); cam.updateMatrixWorld(true);
    cam.projectionMatrix.set(
      2 * a / Wv, 0, 0, 2 * cx / Wv - 1,
      0, 2 * a / (sn * Hv), 0, 1 - 2 * cy / Hv,
      0, 0, -2 / (far - near), -(far + near) / (far - near),
      0, 0, 0, 1,
    );
    cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
    return { a, cx, cy };
  }

  const wxz = (X, Y, ch) => [(X - CX) * S, (Y - ch / 2) * S];
  const D = { lastT: null, rKey: null, beat: -1, look: null, res: '', home: 0 };
  function frame(game) {
    if (!P.ready || P.lost) return;
    const G = game.getState(), F = gl.frame;
    if (!F || !F.xf) { stage.setVisible(false); return; }
    // follow the kit canvas rectangle (the fluid viewport keeps it full screen, but never assume)
    const rc = kitCanvas.getBoundingClientRect();
    const st = canvas.style, w = Math.round(rc.width), h = Math.round(rc.height);
    if (w > 0 && h > 0 && (st.width !== w + 'px' || st.height !== h + 'px' || st.left !== Math.round(rc.left) + 'px' || st.top !== Math.round(rc.top) + 'px')) {
      st.left = Math.round(rc.left) + 'px'; st.top = Math.round(rc.top) + 'px'; st.width = w + 'px'; st.height = h + 'px'; stage.resize();
    }
    stage.setVisible(true);
    if (stage.scene.environment) { stage.scene.environment = null; stage.scene.environmentIntensity = 0; }
    const now = globalThis.performance.now();
    let dt = D.lastT === null ? 0 : G.t - D.lastT; D.lastT = G.t;
    if (G.menu || (G.auto && G.auto.paused)) dt = 0;
    if (P.manualDt != null) dt = P.manualDt;
    dt = clamp(dt, 0, 0.1);

    const ch = F.xf.ch, pitch = F.pitch;
    const vk = clamp(pitch / 92, 0.9, 1.25);
    gl.headUp = (1.8 * SCALE) / S * vk + 8;
    const M = setCamera(F, vk);

    // the village and the court (repainted only when the court size changes)
    set.layout(F.ln, pitch);
    buildCrowd(F.ln, pitch);
    stage.setShadowTarget(0, 0, 0);

    // red zones
    zones.forEach((m, i) => {
      const z = F.zones[i];
      if (!z) { m.visible = false; return; }
      const [x0, z0] = wxz(z.x, z.y, ch), [x1, z1] = wxz(z.x + z.w, z.y + z.h, ch);
      const zk = Math.round(z.w) + 'x' + Math.round(z.h);
      if (m.userData.key !== zk) { m.userData.key = zk; paintZone(m, z.w, z.h); }
      m.visible = true; m.position.set((x0 + x1) / 2, 0.012, (z0 + z1) / 2); m.scale.set(x1 - x0, z1 - z0, 1); m.material.opacity = clamp(z.alpha * 2.2, 0.14, 0.66);
    });

    // new round / new demo round: everybody is placed straight onto their cells
    const snap = D.rKey !== F.r || F.r.beat < D.beat;
    D.rKey = F.r; D.beat = F.r.beat;
    const used = new Set();
    const lineZ = []; for (let k = 0; k < F.ln; k++) lineZ.push((cellY(2 * k + 1, F.ln, pitch) - ch / 2) * S);
    const ctx = { get look() { return D.look; }, puff: (kind, x, z, k) => set.puff(kind, x, z, k) };
    let gi = 3;
    for (const e of F.people) {
      const slot = e.role === 'runner' ? e.id : e.role === 'sodor' ? 10 : gi++;
      if (slot >= NSLOT || !people[slot]) continue;
      const p = people[slot]; used.add(slot);
      if (e.role !== 'runner') { let best = null, bd = 1e9; for (const o of F.people) if (o.role === 'runner' && o.state !== 'out' && o.state !== 'home') { const dd = Math.hypot(o.X - e.X, (o.Y - e.Y) * 0.8); if (dd < bd) { bd = dd; best = o; } } const w2 = best && bd < 330 ? wxz(best.X, best.Y, ch) : null; D.look = w2 ? { x: w2[0], z: w2[1] } : null; } else D.look = null;
      const before = p.disp ? p.disp.z : null;
      p.drive(e, wxz(e.X, e.Y, ch), dt, snap || !p.h.root.visible, ctx);
      if (before !== null && !snap) for (const lz of lineZ) if ((before - lz) * (p.disp.z - lz) < 0) set.puff('chalk', p.disp.x, lz, 1);
    }
    people.forEach((p, i) => { if (!used.has(i)) p.h.root.visible = false; });
    for (const p of people) p.update(dt);
    // the crowd reacts to the round: a runner home or a finished round (presentation only, never fed back)
    const res = F.r.result ? F.r.result.kind : '';
    if (res !== D.res) { D.res = res; if (crowd && res) crowd.react(F.r.result.home > 0 ? 'ovation' : 'groan', { intensity: 1 }); }
    const homeN = F.r.home | 0;
    if (homeN > (D.home | 0) && crowd) crowd.react('cheer', { intensity: 0.9 });
    D.home = homeN;
    set.update(dt, cam);
    if (crowd) crowd.update(dt);
    if (blobs) { let bi = 0; for (const p of people) if (p.h.root.visible) blobs.set(bi++, p.pos.x, p.pos.z, 0.42, 0.012); blobs.mesh.count = bi; }
    stage.update(dt, { renderNow: false });
    for (const q of people) if (q.h.root.visible) q.post(dt);
    if (P.trace) traceFrame(dt);
    stage.render();
    perfTick(now);
  }

  // dev measurement hook (?dev=1): P.trace = [] records, per visible person and frame, the drawn root, speed, clip, cadence and joint poses
  const JOINTS = ['Pelvis', 'Spine1', 'Head', 'L_Thigh', 'L_Calf', 'L_Foot', 'R_Thigh', 'R_Calf', 'R_Foot', 'L_UpperArm', 'L_Forearm', 'L_Hand', 'R_UpperArm', 'R_Forearm', 'R_Hand'];
  const _q = new THREE.Quaternion(), _v = new THREE.Vector3();
  function traceFrame(dt) {
    people.forEach((p, i) => {
      if (!p.h.root.visible || !p.disp) return;
      const q = {}, pp = {};
      for (const n of JOINTS) { const b = p.h.bones[n.startsWith('Bip01') ? n : 'Bip01_' + n]; if (!b) continue; b.getWorldQuaternion(_q); q[n] = [_q.x, _q.y, _q.z, _q.w]; b.getWorldPosition(_v); pp[n] = [_v.x, _v.y, _v.z]; }
      const cur = p.h.layers.base.current;
      P.trace.push({ i, dt, x: p.disp.x, z: p.disp.z, sp: p.speed, mv: p.moving, clip: cur ? cur.clip.name : '', rate: cur ? cur.speed : 0, ct: cur ? cur.time : 0, dur: cur ? cur.clip.dur : 0, tgt: cur ? cur.target : 0, yaw: p.yaw, hd: p.heading, lat: p.lat, st: p.state, pl: (p.h.legs || []).map((l) => !!(l.planted && l.w > 0.8)), q, p: pp });
    });
  }

  P.wrap = (game) => {
    const r = game.render.bind(game);
    let warned = false;
    game.render = (ctx, view) => { r(ctx, view); try { frame(game); } catch (e) { if (!warned) { warned = true; console.error('3D frame failed', e && e.stack); } } };
    return game;
  };
  return P;
}
