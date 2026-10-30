// Songo 3D presenter. It does not touch the game: the 2D layer (view.js) describes each frame's board in v3.scene, this file draws it lit and
// answers the projection questions (v3.at, v3.toBoard) so counts, rings and taps line up with the tilted board. One WebGL canvas sits behind
// the kit's transparent 2D canvas. The camera is fitted to the rectangle the layout gives the board.
// No WebGL or a lost context: v3.on = false and every screen draws the flat 2D art; a restored context rebuilds the environment.
import * as THREE from '../vendor3d/three.js';
import { v3 } from '../src/v3.js';
import { meta } from '../src/game.js';
import { K, TOPY, TRAY_D, SEED_R, toWorld, toCanon, seedSlot, seedKit, buildBoard, buildSetting, buildLights, glowTex } from './world.js';

const TAU = Math.PI * 2, D2R = Math.PI / 180, CAP = 150, R0 = TOPY + 0.05;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const TIERS = [{ name: 'high', dpr: 2, shadow: 2048, tex: 2048 }, { name: 'medium', dpr: 1.5, shadow: 1024, tex: 1536 }, { name: 'low', dpr: 1, shadow: 0, tex: 1024 }];
const tick = () => new Promise((r) => setTimeout(r, 0));
const MARK = { legal: [0.95, 0.66, 0.2], hint: [0.4, 0.95, 0.55], cap: [1, 0.62, 0.18], ref: [1, 0.35, 0.25], kb: [0.4, 1, 0.5] };

export async function createPresenter({ kitCanvas }) {
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;height:100dvh;display:block;pointer-events:none;z-index:0;visibility:hidden';
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' }); } catch (e) { console.warn('WebGL unavailable; flat 2D art', e); return { ok: false }; }
  if (!renderer.getContext()) return { ok: false };
  kitCanvas.parentElement.insertBefore(canvas, kitCanvas);
  kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.95;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  let tier = (navigator.hardwareConcurrency || 8) <= 4 ? 1 : 0;

  await tick();
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x050d09);
  scene.fog = new THREE.Fog(0x050d09, 330, 760);
  const camera = new THREE.PerspectiveCamera(30, 1, 2, 3000);
  const lights = buildLights(scene);
  const buildEnv = () => { try { const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture; pm.dispose(); scene.environmentIntensity = 0.32; } catch { /* no IBL */ } };
  buildEnv();
  await tick();

  // ---- boards and settings, cached per geometry (tall / long pitch) and wood
  const boards = new Map(), settings = new Map(); let board = null, boardKey = '', setting = null, settingKey = '', geoNow = null;
  const want = { geo: null, wood: 'camwood' };
  function ensure() {
    const geo = want.geo; if (!geo) return;
    const bk = `${geo.key}|${want.wood}|${TIERS[tier].tex}`;
    if (bk !== boardKey) {
      let b = boards.get(bk); if (!b) { b = buildBoard(geo, want.wood, TIERS[tier].tex); boards.set(bk, b); }
      if (board) board.visible = false; board = b; boardKey = bk; if (!b.parent) scene.add(b); b.visible = true;
    }
    if (geo.key !== settingKey) {
      let s = settings.get(geo.key); if (!s) { s = buildSetting(scene, geo, { quality: tier < 2 ? 1 : 0 }); settings.set(geo.key, s); }
      if (setting) setting.group.visible = false; setting = s; settingKey = geo.key; s.group.visible = true;
      const sh = lights.sun.shadow.camera; sh.left = -(s.hx + 16); sh.right = s.hx + 16; sh.top = s.hz + 16; sh.bottom = -(s.hz + 16); sh.updateProjectionMatrix();
    }
    geoNow = geo;
  }

  // ---- seeds (one instanced mesh per set, per-seed tint) and contact blobs
  const kits = {}; const kitOf = (set) => kits[set] || (kits[set] = seedKit(set));
  let setNow = 'stones'; const k0 = kitOf('stones');
  const seeds = new THREE.InstancedMesh(k0.geo, k0.mat, CAP); seeds.castShadow = true; seeds.receiveShadow = true; seeds.count = 0; seeds.frustumCulled = false; seeds.setColorAt(0, new THREE.Color(1, 1, 1)); scene.add(seeds);
  const flatQuad = new THREE.PlaneGeometry(1, 1); flatQuad.rotateX(-Math.PI / 2);
  const blobs = new THREE.InstancedMesh(flatQuad, new THREE.MeshBasicMaterial({ map: glowTex('0,0,0', 0.95), transparent: true, depthWrite: false, opacity: 0.45 }), 24);
  blobs.renderOrder = 1; blobs.frustumCulled = false; blobs.count = 0; scene.add(blobs);
  const ringTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
    const g = x.createRadialGradient(64, 64, 20, 64, 64, 64); g.addColorStop(0, 'rgba(255,255,255,0.12)'); g.addColorStop(0.55, 'rgba(255,255,255,0.28)'); g.addColorStop(0.7, 'rgba(255,255,255,1)'); g.addColorStop(0.84, 'rgba(255,255,255,0.9)'); g.addColorStop(0.94, 'rgba(255,255,255,0.3)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 128, 128); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const marks = Array.from({ length: 24 }, () => { const m = new THREE.Mesh(flatQuad, new THREE.MeshBasicMaterial({ map: ringTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); m.renderOrder = 3; m.visible = false; scene.add(m); return m; });
  function applyTier() {
    const t = TIERS[tier];
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, t.dpr));
    renderer.shadowMap.enabled = t.shadow > 0; lights.sun.castShadow = t.shadow > 0;
    if (t.shadow) { lights.sun.shadow.mapSize.set(t.shadow, t.shadow); if (lights.sun.shadow.map) { lights.sun.shadow.map.dispose(); lights.sun.shadow.map = null; } }
    blobs.material.opacity = t.shadow ? 0.4 : 0.6;
    scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => { m.needsUpdate = true; }); });
  }
  applyTier();

  // ---------------------------------------------------------------- camera: tilt / fov per view, distance + off-axis shift fitted to the board rectangle
  const cur = { yaw: 0, tilt: 54, fov: 30, dist: 100, ox: 0, oy: 0, tx: 0, ty: TOPY * 0.5, tz: 0 }; let curKind = '', rcKey = '', blend = 1, from = { ...cur };
  const _v = new THREE.Vector3(), _t = new THREE.Vector3(), cssW = () => Math.max(1, window.innerWidth), cssH = () => Math.max(1, window.innerHeight);
  function place(cam, p) {
    const W = cssW(), H = cssH(), dir = _v.set(Math.sin(p.yaw * D2R) * Math.cos(p.tilt * D2R), Math.sin(p.tilt * D2R), Math.cos(p.yaw * D2R) * Math.cos(p.tilt * D2R));
    cam.fov = p.fov; cam.aspect = W / H; _t.set(p.tx, p.ty, p.tz);
    cam.position.copy(_t).addScaledVector(dir, p.dist); cam.up.set(0, 1, 0); cam.lookAt(_t);
    if (p.ox || p.oy) cam.setViewOffset(W, H, p.ox, p.oy, W, H); else cam.clearViewOffset();
    cam.updateProjectionMatrix(); cam.updateMatrixWorld(true);
  }
  const fitCam = new THREE.PerspectiveCamera();
  const toCss = (cam, x, y, z, out = { x: 0, y: 0 }) => { _v.set(x, y, z).project(cam); out.x = (_v.x + 1) / 2 * cssW(); out.y = (1 - _v.y) / 2 * cssH(); return out; };
  function fit(rc, pts, base) {
    const p = { ...base, ox: 0, oy: 0, dist: 100 }, q = { x: 0, y: 0 }; let bb = null;
    for (let it = 0; it < 8; it++) {
      place(fitCam, p); bb = { x0: 1e9, y0: 1e9, x1: -1e9, y1: -1e9 };
      for (const [x, y, z] of pts) { toCss(fitCam, x, y, z, q); bb.x0 = Math.min(bb.x0, q.x); bb.x1 = Math.max(bb.x1, q.x); bb.y0 = Math.min(bb.y0, q.y); bb.y1 = Math.max(bb.y1, q.y); }
      const s = Math.min(rc.w / Math.max(1, bb.x1 - bb.x0), rc.h / Math.max(1, bb.y1 - bb.y0));
      if (Math.abs(s - 1) < 0.002) break; p.dist /= s;
    }
    p.ox = (bb.x0 + bb.x1) / 2 - (rc.x + rc.w / 2); p.oy = (bb.y0 + bb.y1) / 2 - (rc.y + rc.h / 2);
    return p;
  }
  const cpu = () => meta.cssPerUnit || (Math.min(cssW(), cssH()) / 720);
  const offX = () => (cssW() - meta.width * cpu()) / 2, offY = () => (cssH() - meta.height * cpu()) / 2;
  const virt = (q) => ({ x: (q.x - offX()) / cpu(), y: (q.y - offY()) / cpu() });
  const padPts = (hx, hz, pad) => { const x = hx + pad, z = hz + pad; return [[-x, 0, -z], [x, 0, -z], [-x, TOPY, -z], [x, TOPY, -z], [-x, 0, z], [x, 0, z], [-x, TOPY, z], [x, TOPY, z]]; };
  v3.frame = (rc0, kind, t, geo, wood) => {
    want.geo = geo; want.wood = wood || 'camwood'; ensure();
    const rc = { x: rc0.x * cpu() + offX(), y: rc0.y * cpu() + offY(), w: rc0.w * cpu(), h: rc0.h * cpu() };
    const hx = geo.frame.w * K / 2, hz = geo.frame.h * K / 2; let goal;
    if (kind === 'play') goal = fit(rc, padPts(hx, hz, 1.2), { yaw: 0, tilt: geo.long ? 50 : 56, fov: 28, tx: 0, ty: TOPY * 0.5, tz: 0 });
    else { const a = t || 0; goal = fit(rc, padPts(hx, hz, 1.2), { yaw: -9 + 6 * Math.sin(a * TAU / 34), tilt: 40 + 3 * Math.sin(a * TAU / 21), fov: 30, tx: 0, ty: TOPY * 0.5, tz: 0 }); }
    const key = `${kind}|${Math.round(rc.x)},${Math.round(rc.y)},${Math.round(rc.w)},${Math.round(rc.h)}|${cssW()}x${cssH()}`;
    if (curKind !== kind && curKind !== '') { blend = 0.0001; from = { ...cur }; } else if (key !== rcKey) blend = 1;
    curKind = kind; rcKey = key;
    if (blend < 1) { const e = blend * blend * (3 - 2 * blend); for (const k of Object.keys(goal)) cur[k] = from[k] + (goal[k] - from[k]) * e; } else Object.assign(cur, goal);
    place(camera, cur);
  };

  // ---------------------------------------------------------------- projection for the 2D layer
  const pa = { x: 0, y: 0 }, pb = { x: 0, y: 0 };
  v3.at = (cx, cy, lift = 0) => {
    const g = geoNow; if (!g) return { x: 0, y: 0, k: 1 };
    const w = toWorld(g, cx, cy), y = R0 + lift, p = virt(toCss(camera, w.x, y, w.z, { x: 0, y: 0 })), w2 = toWorld(g, cx + 1, cy);
    toCss(camera, w.x, y, w.z, pa); toCss(camera, w2.x, y, w2.z, pb);
    p.k = Math.hypot(pb.x - pa.x, pb.y - pa.y) / cpu(); return p;
  };
  const ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -R0), hit = new THREE.Vector3(), ndc = new THREE.Vector2();
  v3.toBoard = (vx, vy) => {
    if (!geoNow) return null;
    ndc.set(((vx * cpu() + offX()) / cssW()) * 2 - 1, 1 - ((vy * cpu() + offY()) / cssH()) * 2);
    ray.setFromCamera(ndc, camera);
    if (!ray.ray.intersectPlane(plane, hit)) return null;
    const c = toCanon(geoNow, hit.x, hit.z); return [c.cx, c.cy];
  };

  // ---------------------------------------------------------------- the frame
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
  let nSeed = 0, nBlob = 0, clock = 0;
  function seed(x, y, z, yaw, tx, tz, v, sc = 1, blob = 0) {
    if (nSeed >= CAP) return;
    _e.set(tx, yaw, tz, 'YXZ'); _q.setFromEuler(_e); _s.set(sc, sc, sc); _p.set(x, y, z);
    seeds.setMatrixAt(nSeed, _m.compose(_p, _q, _s)); seeds.setColorAt(nSeed, kitOf(setNow).tint(v)); nSeed++;
    if (blob > 0 && nBlob < 24) { const s = SEED_R * 3.2 * (1 + (y - R0) * 0.1) * blob; blobs.setMatrixAt(nBlob++, _m.compose(_p.set(x + 0.3, R0 + 0.03, z + 0.45), _q.identity(), _s.set(s, 1, s))); }
  }
  function drawScene(sc) {
    const g = geoNow, pitR = g.pitR * K;
    if (sc.set !== setNow) { const kt = kitOf(sc.set); seeds.geometry = kt.geo; seeds.material = kt.mat; setNow = sc.set; }
    nSeed = 0; nBlob = 0;
    const pitW = []; for (let i = 0; i < 14; i++) { const p = g.pit(i); pitW.push(toWorld(g, p.x, p.y)); }
    const capPit = sc.cap && sc.cap.skip ? sc.cap.pit : -1, land = sc.land;
    for (let i = 0; i < 14; i++) {
      const P = pitW[i], n = sc.pits[i]; if (n <= 0 || i === capPit) continue;
      for (let k = 0; k < n; k++) {
        const s = seedSlot(i, k, pitR); let x = P.x + s.x, y = s.y, z = P.z + s.z, rot = s.rot;
        if (land && land.pit === i && k === n - 1) {
          const f = clamp(land.f, 0, 1), e = 1 - (1 - f) * (1 - f), Q = pitW[land.from];
          x = P.x + (Q.x - P.x) * (1 - e) * 0.9 + s.x * e; z = P.z + (Q.z - P.z) * (1 - e) * 0.9 + s.z * e;
          y = s.y + Math.sin(Math.PI * Math.min(1, f * 1.35)) * (1 - f) * 2.6 + (1 - e) * 1.2; rot += (1 - e) * 4;
        }
        seed(x, y, z, rot, s.tx, s.tz, s.v, 1, k >= n - 3 ? 0.55 : 0);
      }
    }
    // stores: loose seeds resting on the trough floor
    const fy = TOPY - TRAY_D + SEED_R * 0.72;
    for (const p of [0, 1]) {
      const n = sc.store[p];
      for (let k = 0; k < n; k++) { const q = g.seedAt(p, k), W = toWorld(g, q.x, q.y); seed(W.x, fy + (k % 3) * 0.04, W.z, ((k * 97) % 360) * D2R, 0, 0, (k * 3 + p) % 4); }
    }
    // the sown handful in flight (rises from its house, hops along)
    if (sc.carry) {
      const C = sc.carry, W = toWorld(g, C.x, C.y), n = Math.min(C.n, 9), base = R0 + 2.6 + C.lift;
      for (let k = 0; k < n; k++) { const s = seedSlot(99, k, 4.6); seed(W.x + s.x * 0.8, base + (k > 5 ? 1.3 : 0) + (k % 3) * 0.15, W.z + s.z * 0.8, s.rot, s.tx, s.tz, s.v, 1, k === 0 ? 1.3 : 0); }
    }
    // captured house: its seeds arc to the store trough
    if (sc.cap) {
      const A = sc.cap, P = pitW[A.pit], tp = g.trayPos(A.player), T = toWorld(g, tp.x, tp.y), e = A.e;
      for (let k = 0; k < A.n; k++) { const s = seedSlot(A.pit, k, pitR), x = P.x + s.x + (T.x - P.x - s.x) * e, z = P.z + s.z + (T.z - P.z - s.z) * e, y = s.y + (fy - s.y) * e + Math.sin(Math.PI * e) * 7; seed(x, y, z, s.rot + e * 6, s.tx, s.tz, s.v, 1 + 0.12 * Math.sin(Math.PI * e), 0.8 * (1 - e)); }
    }
    seeds.count = nSeed; seeds.instanceMatrix.needsUpdate = true; if (seeds.instanceColor) seeds.instanceColor.needsUpdate = true;
    blobs.count = nBlob; blobs.instanceMatrix.needsUpdate = true;
    // rings and glows lying on the board
    let mi = 0;
    for (const m of sc.marks || []) {
      if (mi >= marks.length) break; const W = toWorld(g, m.x, m.y), mk = marks[mi++], col = MARK[m.kind] || MARK.legal;
      mk.visible = true; mk.position.set(W.x, R0 + 0.1, W.z); const s = pitR * 2.5 * (m.grow || 1); mk.scale.set(s, 1, s); mk.material.color.setRGB(col[0], col[1], col[2]); mk.material.opacity = clamp(m.a, 0, 1);
    }
    for (; mi < marks.length; mi++) marks[mi].visible = false;
  }

  let ema = 16, slow = 0, lastT = 0;
  const HERO = { pits: new Array(14).fill(5), store: [0, 0], marks: [], set: 'stones' };
  function render() {
    const now = performance.now(), dt = Math.min(0.1, Math.max(0, (now - (lastT || now)) / 1000)); lastT = now; clock += dt;
    if (blend < 1) blend = Math.min(1, blend + dt / 0.5);
    const W = cssW(), H = cssH(), pr = Math.min(window.devicePixelRatio || 1, TIERS[tier].dpr);
    if (canvas.width !== Math.round(W * pr) || canvas.height !== Math.round(H * pr)) { renderer.setPixelRatio(pr); renderer.setSize(W, H, false); }
    if (!geoNow) return;
    drawScene(v3.scene || HERO);
    if (setting) {   // the lamp breathes
      const f = 0.86 + 0.1 * Math.sin(clock * 9.1) + 0.06 * Math.sin(clock * 15.7 + 1) + 0.04 * Math.sin(clock * 3.3);
      setting.flame.scale.set(6.4 * f, 8.6 * f, 1); setting.core.scale.set(1.5 * f, 2.5 * f, 1); setting.pl.intensity = 760 + 220 * f;
      const pos = setting.motes.geometry.attributes.position, N = pos.count;
      for (let i = 0; i < N; i++) { const s = setting.seeds[i], u = (clock * (0.018 + s * 0.02) + s) % 1; pos.setXYZ(i, setting.lampPos.x + Math.sin(s * 40 + clock * 0.3) * 24 * (0.3 + u), 2 + u * 34, setting.lampPos.z + 8 + Math.cos(s * 31 + clock * 0.25) * 22 * (0.3 + u)); }
      pos.needsUpdate = true;
    }
    renderer.render(scene, camera);
    ema = ema * 0.97 + (dt * 1000) * 0.03; if (ema > 27 && tier < 2) { if (++slow > 60) { slow = 0; tier++; applyTier(); ema = 16; } } else slow = 0;
  }

  // ---------------------------------------------------------------- hooks used by main.js
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); v3.on = false; canvas.style.visibility = 'hidden'; });
  canvas.addEventListener('webglcontextrestored', () => { buildEnv(); applyTier(); canvas.style.visibility = 'visible'; v3.fade = 1; v3.on = true; });
  let fadeT = 0;
  return {
    ok: true,
    attach() { canvas.style.visibility = 'visible'; v3.fade = 0; fadeT = performance.now(); v3.on = true; },
    pre() {},
    post() { if (!v3.on) return; if (v3.fade < 1) v3.fade = Math.min(1, (performance.now() - fadeT) / 700); render(); },
    get tier() { return tier; },
    renderer, camera, scene,
  };
}
