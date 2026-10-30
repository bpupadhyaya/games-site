// Konane 3D presenter. READS the game state (game.getState()), never writes it. One WebGL canvas sits behind the kit's transparent
// 2D canvas: a papamū pecked into a lava boulder on a golden-hour beach, basalt and coral pebbles resting in their cups. The camera is
// fitted to the layout's board rectangle (play) or hero rectangle (title), so the 2D HUD, rings and taps line up with the tilted rock
// through v3.pt / v3.pick. No WebGL, ?flat=1 or a lost context: v3.on = false and every screen draws the flat 2D art; a restored
// context rebuilds the environment and returns to 3D.
import * as THREE from '../vendor3d/three.js';
import { v3 } from '../src/v3.js';
import { meta } from '../src/game.js';
import { layoutFor, GRID, cellSize } from '../src/layout.js';
import { stoneVariant } from '../src/art.js';
import { C, TOP, STONE_R, cupPos, rockHalf, restY, buildRock, stoneGeos, stoneMaterials, buildBeach, buildBowl, buildLights, radialTex } from './world.js';

const TAU = Math.PI * 2, D2R = Math.PI / 180, CAP = 110, CUP_LIFT = 0.55;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const hash = (a, b = 0) => { let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
const TIERS = [{ name: 'high', dpr: 2, shadow: 2048, tex: 1024 }, { name: 'medium', dpr: 1.5, shadow: 1024, tex: 1024 }, { name: 'low', dpr: 1, shadow: 0, tex: 512 }];
const tick = () => new Promise((r) => setTimeout(r, 0));
const BOARD_SCENES = new Set(['play', 'over', 'lesson', 'auto', 'puzzle']);
const SETTLE = 0.34;                                    // seconds a landed stone rocks and settles in its cup

// The jumping stone along its path (same timing as the flat art's animPos): an arc per hop with a forward lean.
export function hopPose(a, calm) {
  const hops = a.path.length - 1, per = a.dur / hops, k = Math.min(hops - 1, Math.floor(a.t / per)), f = clamp((a.t - k * per) / per, 0, 1), e = f * f * (3 - 2 * f);
  return { k, f, e, hop: k + f, lift: Math.sin(Math.PI * e) * (calm ? 1.6 : 3.4), lean: (calm ? 0 : 0.42) * Math.sin(Math.PI * e) * (e < 0.5 ? 1 : -0.6) };
}
// A landed stone: two small damped rocks and a hair of rebound.
export function settlePose(t) {
  if (t >= SETTLE || t < 0) return { y: 0, tilt: 0 };
  const s = t / SETTLE, d = (1 - s) * (1 - s);
  return { y: Math.abs(Math.sin(s * Math.PI * 2)) * 0.22 * d, tilt: Math.sin(s * Math.PI * 4) * 0.09 * d };
}

export async function createPresenter({ kitCanvas }) {
  const qs = new URLSearchParams(location.search);
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;height:100dvh;display:block;pointer-events:none;z-index:0;visibility:hidden';
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' }); } catch (e) { console.warn('WebGL unavailable; flat 2D art', e); return { ok: false }; }
  if (!renderer.getContext()) return { ok: false };
  kitCanvas.parentElement.insertBefore(canvas, kitCanvas);
  kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.88;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  let tier = qs.has('tier') ? clamp(Number(qs.get('tier')), 0, 2) : (navigator.hardwareConcurrency || 8) <= 4 ? 1 : 0;

  await tick();
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xd88a6a, 700, 4800);
  const camera = new THREE.PerspectiveCamera(30, 1, 2, 9000);
  const lights = buildLights(scene);
  const buildEnv = () => { try { const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture; pm.dispose(); scene.environmentIntensity = 0.35; } catch { /* no IBL */ } };
  buildEnv();
  await tick();
  const beach = buildBeach(scene, { quality: tier < 2 ? 1 : 0 });
  await tick();
  const geos = stoneGeos(), mats = stoneMaterials();
  const inst = {};
  for (const k of [1, 2]) for (let v = 0; v < 3; v++) { const m = new THREE.InstancedMesh(geos[k][v], mats[k], CAP); m.castShadow = true; m.receiveShadow = true; m.count = 0; m.frustumCulled = false; scene.add(m); inst[`${k}${v}`] = m; }
  const flatQuad = new THREE.PlaneGeometry(1, 1); flatQuad.rotateX(-Math.PI / 2);
  const blobs = new THREE.InstancedMesh(flatQuad, new THREE.MeshBasicMaterial({ map: radialTex('0,0,0', 0.9), transparent: true, depthWrite: false, opacity: 0.5 }), CAP * 2);
  blobs.renderOrder = 1; blobs.frustumCulled = false; blobs.count = 0; scene.add(blobs);
  // rings (legal squares, selection, hints) as light lying in the cups
  const ringC = document.createElement('canvas'); ringC.width = ringC.height = 128;
  { const x = ringC.getContext('2d'), g = x.createRadialGradient(64, 64, 20, 64, 64, 64); g.addColorStop(0, 'rgba(255,255,255,0.25)'); g.addColorStop(0.5, 'rgba(255,255,255,0.35)'); g.addColorStop(0.68, 'rgba(255,255,255,1)'); g.addColorStop(0.82, 'rgba(255,255,255,0.9)'); g.addColorStop(0.92, 'rgba(255,255,255,0.3)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); }
  const ringT = new THREE.CanvasTexture(ringC); ringT.colorSpace = THREE.SRGBColorSpace;
  const rings = Array.from({ length: 64 }, () => { const m = new THREE.Mesh(flatQuad, new THREE.MeshBasicMaterial({ map: ringT, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); m.renderOrder = 3; m.visible = false; scene.add(m); return m; });
  // dust: grit puffs where a stone lands
  const dustT = radialTex('214,190,160', 0.8);
  const dust = Array.from({ length: 14 }, () => { const m = new THREE.Mesh(flatQuad, new THREE.MeshBasicMaterial({ map: dustT, transparent: true, depthWrite: false })); m.renderOrder = 2; m.visible = false; m.userData = { t: 9 }; scene.add(m); return m; });
  let dustI = 0;
  const puff = (x, z, s = 1) => { const m = dust[dustI++ % dust.length]; m.userData = { t: 0, x, z, s }; };
  // calabash bowls with spare stones beside the rock
  const bowls = new THREE.Group(); scene.add(bowls);
  bowls.add(buildBowl(1, geos, mats, 10, 3), buildBowl(2, geos, mats, 10, 9));

  // rocks are cached per size (the height field and its texture are the costly part)
  const rocks = new Map(); let rock = null, rockKey = '';
  function setRock(n) {
    const k = `${n}|${TIERS[tier].tex}`; if (k === rockKey) return;
    let r = rocks.get(k); if (!r) { r = buildRock(n, TIERS[tier].tex); rocks.set(k, r); }
    if (rock) scene.remove(rock); rock = r; rockKey = k; scene.add(r);
    const h = rockHalf(n);
    bowls.children[0].position.set(-h - 16, 0, h * 0.35); bowls.children[1].position.set(h + 15, 0, h * 0.1);
    bowls.children[0].rotation.y = 0.4; bowls.children[1].rotation.y = 2.1;
  }
  function applyTier() {
    const t = TIERS[tier];
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, t.dpr));
    renderer.shadowMap.enabled = t.shadow > 0; lights.sun.castShadow = t.shadow > 0;
    if (t.shadow) { lights.sun.shadow.mapSize.set(t.shadow, t.shadow); if (lights.sun.shadow.map) { lights.sun.shadow.map.dispose(); lights.sun.shadow.map = null; } }
    blobs.material.opacity = t.shadow ? 0.38 : 0.6;
    scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => { m.needsUpdate = true; }); });
  }
  applyTier();

  // ---------------------------------------------------------------- camera: yaw/tilt/fov per screen, distance + off-axis shift fitted to a rectangle
  const cur = { yaw: 0, tilt: 58, fov: 30, dist: 120, ox: 0, oy: 0, tx: 0, ty: TOP, tz: 0 };
  let snap = true, viewKey = '';
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
    const p = { ...base, ox: 0, oy: 0, dist: 120 }, q = { x: 0, y: 0 }; let bb = null;
    for (let it = 0; it < 6; it++) {
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
  const rectCss = (r) => ({ x: r.x * cpu() + offX(), y: r.y * cpu() + offY(), w: r.w * cpu(), h: r.h * cpu() });
  const virt = (q) => ({ x: (q.x - offX()) / cpu(), y: (q.y - offY()) / cpu() });

  // ---------------------------------------------------------------- v3 hooks for the 2D layer
  let shownN = 6;
  const pa = { x: 0, y: 0 }, pb = { x: 0, y: 0 };
  v3.pt = (n, i, lift = 0) => {
    const c = cupPos(n, i), y = TOP + lift;
    const p = virt(toCss(camera, c.x, y, c.z, { x: 0, y: 0 }));
    toCss(camera, c.x - C / 2, y, c.z, pa); toCss(camera, c.x + C / 2, y, c.z, pb);
    p.k = Math.hypot(pb.x - pa.x, pb.y - pa.y) / cpu() / cellSize(n); return p;
  };
  const ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -TOP), hit = new THREE.Vector3(), ndc = new THREE.Vector2();
  v3.pick = (n, vx, vy) => {
    ndc.set(((vx * cpu() + offX()) / cssW()) * 2 - 1, 1 - ((vy * cpu() + offY()) / cssH()) * 2);
    ray.setFromCamera(ndc, camera);
    if (!ray.ray.intersectPlane(plane, hit)) return -1;
    const gx = Math.round(hit.x / C + (n - 1) / 2), gz = Math.round(hit.z / C + (n - 1) / 2);
    return gx < 0 || gz < 0 || gx >= n || gz >= n ? -1 : gz * n + gx;
  };
  // flat-art canonical coordinates (layout GRID) -> world
  const toWorld = (n, x, y) => { const c = cellSize(n); return { x: ((x - GRID.x) / c - n / 2) * C, z: ((y - GRID.y) / c - n / 2) * C }; };
  const cupXY = (n, i) => { const c = cellSize(n), gx = i % n, gy = (i - gx) / n; return { x: GRID.x + (gx + 0.5) * c, y: GRID.y + (gy + 0.5) * c }; };

  // ---------------------------------------------------------------- stones
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
  const counts = {}; let nBlob = 0;
  const begin = () => { for (const k in inst) counts[k] = 0; nBlob = 0; };
  function put(kind, v, x, y, z, yaw, tiltX = 0, tiltZ = 0, sc = 1, blobK = 1) {
    const key = `${kind}${v % 3}`, m = inst[key]; if (counts[key] >= CAP) return;
    _e.set(tiltX, yaw, tiltZ, 'YXZ'); _q.setFromEuler(_e); _s.set(sc, sc, sc); _p.set(x, y, z);
    m.setMatrixAt(counts[key]++, _m.compose(_p, _q, _s));
    if (blobK > 0.02 && nBlob < CAP * 2) {
      const lift = Math.max(0, y - restY()), s = STONE_R * 2.5 * sc * (1 + lift * 0.1) * blobK;
      _p.set(x + 0.3 + lift * 0.3, TOP - CUP_LIFT, z + 0.4 + lift * 0.45); _q.identity(); _s.set(s, 1, s); blobs.setMatrixAt(nBlob++, _m.compose(_p, _q, _s));
    }
  }
  function end() {
    for (const k in inst) { inst[k].count = counts[k]; inst[k].instanceMatrix.needsUpdate = true; }
    blobs.count = nBlob; blobs.instanceMatrix.needsUpdate = true;
  }
  const yawOf = (i) => hash(i, 41) * TAU, jit = (i, s) => (hash(i, s) - 0.5) * 0.35;
  let clock = 0, lastAnim = null, lastHop = -1;
  const settled = new Map();                 // square -> clock when a stone landed there (settle wobble)
  function drawBoard(g, a, sel, calm, t) {
    const n = g.n, R0 = restY();
    if (a !== lastAnim) {                     // a jump just finished: dust in the landing cup + the settle wobble
      if (lastAnim && lastAnim.type === 'jump' && !calm) { settled.set(lastAnim.to, clock); const c = cupPos(n, lastAnim.to); puff(c.x, c.z, 1); }
      lastAnim = a; lastHop = 0;
    }
    begin();
    for (let i = 0; i < g.b.length; i++) {
      const k = g.b[i]; if (!k) continue;
      if (a && a.type === 'jump' && i === a.path[a.path.length - 1]) continue;
      if (a && a.type === 'refuse' && a.from === i) continue;
      const c = cupPos(n, i), st = settled.has(i) ? settlePose(clock - settled.get(i)) : { y: 0, tilt: 0 };
      let y = R0 + st.y;
      if (sel === i) y += 1.5 + (calm ? 0 : Math.sin(t * 4) * 0.25);
      put(k, stoneVariant(i), c.x + jit(i, 3), y, c.z + jit(i, 5), yawOf(i), 0, st.tilt);
    }
    for (const [i, t0] of settled) if (clock - t0 > SETTLE) settled.delete(i);
    if (a && a.type === 'jump') {
      const P = hopPose(a, calm), p = cupXY(n, a.path[P.k]), q = cupXY(n, a.path[P.k + 1]), wp = toWorld(n, p.x, p.y), wq = toWorld(n, q.x, q.y);
      if (P.k > lastHop && !calm) { const c = cupPos(n, a.path[P.k]); puff(c.x, c.z, 0.8); }
      lastHop = Math.max(lastHop, P.k);
      const dx = wq.x - wp.x, dz = wq.z - wp.z, L = Math.hypot(dx, dz) || 1;
      // captured stones: picked off the rock once the jumper is over them, lifted away toward the player and set aside
      a.caps.forEach((cp, j) => {
        const f = clamp((P.hop - (j + 0.5)) / 0.55, 0, 1); if (f >= 1) return;
        const c = cupPos(n, cp.at), e = f * f * (3 - 2 * f), sc = f < 0.7 ? 1 : 1 - (f - 0.7) / 0.3;
        put(cp.kind, stoneVariant(cp.at), c.x + e * cp.side * 2.5 * (dz / L), R0 + e * (calm ? 3 : 8), c.z + e * 5 - e * cp.side * 2.5 * (dx / L) * 0, yawOf(cp.at) + e * 1.2, e * 0.5, 0, Math.max(0.01, sc), 1 - f);
      });
      put(a.kind, stoneVariant(a.path[0]), wp.x + dx * P.e, R0 + P.lift, wp.z + dz * P.e, yawOf(a.path[0]), (dz / L) * P.lean, -(dx / L) * P.lean);
    } else if (a && a.type === 'remove') {
      const f = clamp(a.t / a.dur, 0, 1), e = f * f * (3 - 2 * f), c = cupPos(n, a.at), sc = f < 0.65 ? 1 : 1 - (f - 0.65) / 0.35;
      put(a.kind, stoneVariant(a.at), c.x, R0 + e * (calm ? 3 : 7), c.z + e * 4, yawOf(a.at) + e * 0.8, e * 0.4, 0, Math.max(0.01, sc), 1 - f);
    } else if (a && a.type === 'refuse') {
      const f = clamp(a.t / a.dur, 0, 1), p = cupPos(n, a.from), q = cupPos(n, a.to);
      const out = f < 0.4 ? f / 0.4 : f < 0.6 ? 1 : 1 - (f - 0.6) / 0.4, e = out * out * (3 - 2 * out) * 0.45;
      const shake = calm ? 0 : f >= 0.36 && f < 0.64 ? Math.sin(f * 90) * 0.35 : 0;
      put(a.kind, stoneVariant(a.from), p.x + (q.x - p.x) * e + shake, R0 + 1.2 * Math.sin(Math.PI * f), p.z + (q.z - p.z) * e, yawOf(a.from));
    }
    end();
  }
  function drawRings(n, marks, b) {
    let k = 0;
    for (const mk of marks) {
      if (k >= rings.length || mk.sq < 0 || mk.sq >= n * n) continue;
      const r = rings[k++], c = cupPos(n, mk.sq), s = STONE_R * 2 * mk.r * (b && b[mk.sq] ? 1.6 : 1.22);   // around a stone the ring must clear its body
      r.visible = true; r.position.set(c.x, TOP - CUP_LIFT + 0.75, c.z); r.scale.set(s, 1, s);
      const [cr, cg, cb] = mk.rgb.split(',').map((v) => Number(v) / 255);
      r.material.color.setRGB(cr * cr * 1.25, cg * cg * 1.25, cb * cb * 1.25);   // squared: keeps the hue saturated under additive light r.material.opacity = clamp(mk.a, 0, 1);
    }
    for (; k < rings.length; k++) rings[k].visible = false;
  }

  // ---------------------------------------------------------------- per frame
  let game = null, lost = false, lastNow = 0, frameAvg = 16, slowFrames = 0, fadeIn = 0, shownG = null;
  const isBoard = (state) => BOARD_SCENES.has(state.scene) && !(state.scene === 'puzzle' && state.pz?.status === 'making');
  function framing(state, L) {
    const n = shownN, h = rockHalf(n), calm = state.calm, t = state.t;
    if (isBoard(state)) {
      const B = L.board;
      if (L.slim && !L.land) {
        // portrait play: the cup grid itself fills the width (the rock's rim runs off the screen edges)
        const ge = n * C / 2, gr = rectCss(L.area);
        return fit(gr, [[-ge, TOP, -ge], [ge, TOP, -ge], [-ge, TOP, ge], [ge, TOP, ge]], { yaw: 0, tilt: 68, fov: 28, tx: 0, ty: TOP, tz: 0 });
      }
      const e = h - 1.2, rc = rectCss({ x: B.x, y: B.y, w: 672 * B.s, h: 672 * B.s });
      const pts = [[-e, TOP, -e], [e, TOP, -e], [-e, TOP, e], [e, TOP, e], [-e, TOP - 4, e + 1.5], [e, TOP - 4, e + 1.5]];
      return fit(rc, pts, { yaw: 0, tilt: L.land ? 56 : 60, fov: 28, tx: 0, ty: TOP, tz: 0 });
    }
    const drift = calm ? 0 : 1;
    const base = { yaw: -16 + 6 * Math.sin(t * TAU / 30) * drift, tilt: 19 + 2 * Math.sin(t * TAU / 19) * drift, fov: 34, tx: 0, ty: TOP * 0.8, tz: 0 };
    const pts = [[-h, TOP, -h], [h, TOP, -h], [-h, 0, h], [h, 0, h], [-h - 6, 0, h * 0.35], [h + 5, 0, h * 0.1]];
    let r = v3.hero;
    if (!r) { const U = L.U; r = L.land ? { x: U.x0 + U.w * 0.12, y: U.y0 + U.h * 0.42, w: U.w * 0.5, h: U.h * 0.5 } : { x: U.x0 + U.w * 0.05, y: U.y0 + U.h * 0.5, w: U.w * 0.9, h: U.h * 0.36 }; }
    const rc = rectCss(r), gx = rc.w * 0.14, gy = rc.h * 0.14; rc.x -= gx; rc.w += 2 * gx; rc.y -= gy * 0.4; rc.h += 2 * gy;
    return fit(rc, pts, base);
  }
  let wasBoard = null;
  function pre() {
    if (!game || lost) return;
    const state = game.getState(), L = layoutFor(meta.width, meta.height, state.scene === 'play' || state.scene === 'over'), board = isBoard(state);
    const vk = `${cssW()}x${cssH()}|${L.key}`; if (vk !== viewKey) { viewKey = vk; snap = true; }
    shownG = board ? (state.scene === 'auto' && state.auto ? state.auto.game : state.game) : state.demo?.g ?? null;
    const prevN = shownN; shownN = shownG ? shownG.n : 6; if (prevN !== shownN) snap = true;
    if (wasBoard !== board) { wasBoard = board; if (board) snap = true; }      // a board screen is exact from its first frame (taps, rings)
    const goal = framing(state, L);
    const now = performance.now(), dt = clamp((now - (lastNow || now)) / 1000, 0, 0.1);
    const k = snap || board ? 1 : 1 - Math.exp(-dt * 5);
    for (const key of Object.keys(goal)) cur[key] += (goal[key] - cur[key]) * k;
    snap = false;
    place(camera, cur);
    v3.marks.length = 0;
  }
  function post() {
    if (!game || lost) return;
    const now = performance.now(), dt = clamp((now - (lastNow || now)) / 1000, 0, 0.1); lastNow = now; clock += dt;
    const state = game.getState(), calm = state.calm, board = isBoard(state);
    setRock(shownN);
    if (shownG) {
      const a = board ? (state.scene === 'auto' ? state.auto?.anim : state.anim) : state.demo?.anim;
      drawBoard(shownG, a || null, board ? state.sel : -1, calm, state.t);
    } else { begin(); end(); }
    if (board && state.sel >= 0 && !state.anim) v3.marks.push({ sq: state.sel, rgb: '255,226,140', r: 1.1, a: 0.95 });
    drawRings(shownN, board ? v3.marks : [], shownG?.b);
    for (const m of dust) {
      const u = m.userData; if (!(u.t <= 0.6)) { m.visible = false; continue; }
      u.t += dt; const f = Math.min(1, u.t / 0.6), s = (2.4 + f * 6) * u.s;
      m.visible = true; m.position.set(u.x, TOP - 0.2 + f * 0.8, u.z); m.scale.set(s, 1, s); m.material.opacity = 0.55 * (1 - f) * (1 - f);
    }
    // the sea moves: ripples drift toward the shore, the foam line breathes in and out
    if (!calm) { beach.seaBump.offset.y = (clock * 0.02) % 1; beach.seaBump.offset.x = Math.sin(clock * 0.1) * 0.02; beach.foamT.offset.x = (clock * 0.004) % 1; beach.foam.position.z = -150 + Math.sin(clock * 0.5) * 5; }
    if (fadeIn < 1) { fadeIn = Math.min(1, fadeIn + dt / 0.4); v3.fade = fadeIn; }
    renderer.setSize(cssW(), cssH(), false);
    renderer.render(scene, camera);
    const ft = dt * 1000; if (ft > 0) frameAvg = frameAvg * 0.95 + ft * 0.05;
    if (frameAvg > 26 && tier < 2) { if (++slowFrames > 90) { tier++; slowFrames = 0; frameAvg = 16; applyTier(); } } else slowFrames = 0;
  }

  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; v3.on = false; canvas.style.visibility = 'hidden'; });
  canvas.addEventListener('webglcontextrestored', () => {
    lost = false; buildEnv(); for (const r of rocks.values()) { scene.remove(r); r.userData.dispose(); } rocks.clear(); rock = null; rockKey = '';
    applyTier(); fadeIn = 0; v3.fade = 0; v3.on = true; canvas.style.visibility = 'visible'; snap = true;
  });

  await tick();
  setRock(6); await tick();
  place(camera, cur); try { renderer.compile(scene, camera); } catch { /* compiled lazily */ }
  await tick();

  return {
    ok: true, renderer, scene, camera,
    attach(g) { game = g; v3.on = true; v3.fade = 0; fadeIn = 0; canvas.style.visibility = 'visible'; snap = true; },
    pre, post,
    get tier() { return TIERS[tier].name; },
    loseContext() { const ext = renderer.getContext().getExtension('WEBGL_lose_context'); ext?.loseContext(); return ext; },
  };
}
