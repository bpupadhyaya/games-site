// Seega 3D presenter. READS what view.js publishes in v3.frame (and game.getState() for the screen), never writes game state.
// One WebGL canvas sits behind the kit's transparent 2D canvas: a carved stone board on a kilim at a desert camp at dusk, a brass
// lantern beside it. The camera is fitted to the layout's board rectangle (play) or the title's hero rectangle, so the 2D HUD,
// marks and taps line up with the tilted board through v3.pt / v3.pick. No WebGL, ?flat=1 or a lost context: v3.on = false and
// every screen draws the flat 2D art; a restored context rebuilds the environment and returns to 3D.
import * as THREE from '../vendor3d/three.js';
import { v3 } from '../src/v3.js';
import { meta } from '../src/game.js';
import { setSize, playLayout, AREA, SCREEN } from '../src/layout.js';
import { TEXT_SCALES } from '../src/ui.js';
import { dateAngle } from '../src/art.js';
import { DROP_T, SLIDE_T } from '../src/match.js';
import {
  N, P, H, TOP, FLOOR, POCKET, PEB_H, DATE_H, LANTERN_POS, pocketPos, cellAtWorld, restY, hash,
  buildBoard, stoneGeos, stoneMaterials, buildRug, buildSand, buildSky, buildSilhouettes, buildLantern, buildLights, radialTex,
} from './world.js';

const TAU = Math.PI * 2, D2R = Math.PI / 180, CAP = 40, PIECES = 12, POCKET_LIFT = 1.9;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const sstep = (k) => k * k * (3 - 2 * k);
const TIERS = [{ name: 'high', dpr: 2, shadow: 2048, tex: 1024 }, { name: 'medium', dpr: 1.5, shadow: 1024, tex: 1024 }, { name: 'low', dpr: 1, shadow: 0, tex: 512 }];
const tick = () => new Promise((r) => setTimeout(r, 0));
const SETTLE = 0.32;

// Off-board stones lie in two loose heaps on the kilim, pebbles left of the board and date stones right (12 spots each).
export function pileSpot(who, k) {
  const sx = who === 1 ? -1 : 1, cx = sx * (H + 15), cz = 7;
  if (k < 8) { const a = k * TAU / 8 + (who === 1 ? 0.3 : 0.9), r = 4.6 + (k % 2) * 1.2; return { x: cx + Math.cos(a) * r, y: 0.3, z: cz + Math.sin(a) * r * 1.15, yaw: hash(k, who) * TAU, tilt: 0 }; }
  const a = (k - 8) * TAU / 4 + 0.6; return { x: cx + Math.cos(a) * 2.2, y: 1.7, z: cz + Math.sin(a) * 2.4, yaw: hash(k, who + 7) * TAU, tilt: (hash(k, 3) - 0.5) * 0.5 };
}
export function settlePose(t) {
  if (t >= SETTLE || t < 0) return { y: 0, tilt: 0 };
  const s = t / SETTLE, d = (1 - s) * (1 - s);
  return { y: Math.abs(Math.sin(s * Math.PI * 2)) * 0.28 * d, tilt: Math.sin(s * Math.PI * 4) * 0.08 * d };
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
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  let tier = qs.has('tier') ? clamp(Number(qs.get('tier')), 0, 2) : (navigator.hardwareConcurrency || 8) <= 4 ? 1 : 0;

  await tick();
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x6e4656, 700, 4600);
  const camera = new THREE.PerspectiveCamera(32, 1, 2, 12000);
  const lights = buildLights(scene);
  const buildEnv = () => { try { const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture; pm.dispose(); scene.environmentIntensity = 0.14; } catch { /* no IBL */ } };
  buildEnv();
  await tick();
  const sky = buildSky(); scene.add(sky); scene.add(buildSilhouettes());
  await tick();
  const sand = buildSand({ quality: tier < 2 ? 1 : 0 }); scene.add(sand);
  await tick();
  const rug = buildRug(); scene.add(rug);
  const lantern = buildLantern(); lantern.position.copy(LANTERN_POS); lantern.rotation.y = 0.4; scene.add(lantern);
  await tick();
  const geos = stoneGeos();
  let themeId = 'sand', mats = stoneMaterials(themeId);
  const inst = {};
  for (const k of [1, 2]) for (let v = 0; v < 3; v++) { const m = new THREE.InstancedMesh(geos[k][v], mats[k], CAP); m.castShadow = true; m.receiveShadow = true; m.count = 0; m.frustumCulled = false; scene.add(m); inst[`${k}${v}`] = m; }
  const quad = new THREE.PlaneGeometry(1, 1); quad.rotateX(-Math.PI / 2);
  const blobs = new THREE.InstancedMesh(quad, new THREE.MeshBasicMaterial({ map: radialTex('0,0,0', 0.9), transparent: true, depthWrite: false, opacity: 0.45 }), CAP * 2);
  blobs.renderOrder = 1; blobs.frustumCulled = false; blobs.count = 0; scene.add(blobs);
  // marks: light laid round a pocket mouth (ring) or on its floor (fill)
  const sqTex = (fill) => {
    const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
    if (fill) { const g = x.createRadialGradient(64, 64, 8, 64, 64, 70); g.addColorStop(0, 'rgba(255,255,255,0.95)'); g.addColorStop(0.75, 'rgba(255,255,255,0.6)'); g.addColorStop(1, 'rgba(255,255,255,0.1)'); x.fillStyle = g; x.beginPath(); x.roundRect(10, 10, 108, 108, 20); x.fill(); }
    else { x.shadowColor = '#fff'; x.shadowBlur = 12; x.strokeStyle = '#fff'; x.lineWidth = 7; x.beginPath(); x.roundRect(14, 14, 100, 100, 18); x.stroke(); x.stroke(); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  };
  const pool = (t, n) => Array.from({ length: n }, () => { const m = new THREE.Mesh(quad, new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); m.renderOrder = 3; m.visible = false; scene.add(m); return m; });
  const rings = pool(sqTex(false), 40), fills = pool(sqTex(true), 30);
  const dustT = radialTex('226,190,140', 0.85);
  const dust = Array.from({ length: 18 }, () => { const m = new THREE.Mesh(quad, new THREE.MeshBasicMaterial({ map: dustT, transparent: true, depthWrite: false })); m.renderOrder = 2; m.visible = false; m.userData = { t: 9 }; scene.add(m); return m; });
  let dustI = 0;
  const puff = (x, y, z, s = 1) => { const m = dust[dustI++ % dust.length]; m.userData = { t: 0, x, y, z, s }; };

  const boards = new Map(); let board = null, boardKey = '';
  function setTheme(id) {
    const k = `${id}|${TIERS[tier].tex}`; if (k === boardKey) return;
    let b = boards.get(k); if (!b) { b = buildBoard(id, TIERS[tier].tex); boards.set(k, b); }
    if (board) scene.remove(board); board = b; boardKey = k; scene.add(b);
    if (id !== themeId) { themeId = id; mats = stoneMaterials(id); for (const key in inst) inst[key].material = mats[key[0]]; }
  }
  function applyTier() {
    const t = TIERS[tier];
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, t.dpr));
    renderer.shadowMap.enabled = t.shadow > 0; lights.lamp.castShadow = t.shadow > 0;
    if (t.shadow) { lights.lamp.shadow.mapSize.set(t.shadow, t.shadow); if (lights.lamp.shadow.map) { lights.lamp.shadow.map.dispose(); lights.lamp.shadow.map = null; } }
    blobs.material.opacity = t.shadow ? 0.32 : 0.55;
    scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => { m.needsUpdate = true; }); });
  }
  applyTier();

  // ---------------------------------------------------------------- camera: yaw/tilt/fov per screen, distance + off-axis shift fitted to a rectangle
  const cur = { yaw: 0, tilt: 58, fov: 32, dist: 120, ox: 0, oy: 0, tx: 0, ty: TOP, tz: 0 };
  let snap = true, viewKey = '';
  const _v = new THREE.Vector3(), _t = new THREE.Vector3(), cssW = () => Math.max(1, window.innerWidth), cssH = () => Math.max(1, window.innerHeight);
  function place(cam, p) {
    const W = cssW(), Hh = cssH(), dir = _v.set(Math.sin(p.yaw * D2R) * Math.cos(p.tilt * D2R), Math.sin(p.tilt * D2R), Math.cos(p.yaw * D2R) * Math.cos(p.tilt * D2R));
    cam.fov = p.fov; cam.aspect = W / Hh; _t.set(p.tx, p.ty, p.tz);
    cam.position.copy(_t).addScaledVector(dir, p.dist); cam.up.set(0, 1, 0); cam.lookAt(_t);
    if (p.ox || p.oy) cam.setViewOffset(W, Hh, p.ox, p.oy, W, Hh); else cam.clearViewOffset();
    cam.updateProjectionMatrix(); cam.updateMatrixWorld(true);
  }
  const fitCam = new THREE.PerspectiveCamera();
  const toCss = (cam, x, y, z, out = { x: 0, y: 0 }) => { _v.set(x, y, z).project(cam); out.x = (_v.x + 1) / 2 * cssW(); out.y = (1 - _v.y) / 2 * cssH(); return out; };
  function fit(rc, pts, base) {
    const p = { ...base, ox: 0, oy: 0, dist: 150 }, q = { x: 0, y: 0 }; let bb = null;
    for (let it = 0; it < 7; it++) {
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
  let flatCell = 100;                        // the flat board's square size (virtual units) for the current play layout
  const pa = { x: 0, y: 0 }, pb = { x: 0, y: 0 };
  v3.pt = (i, lift = 0) => {
    const c = pocketPos(i), y = TOP + lift;
    const p = virt(toCss(camera, c.x, y, c.z, { x: 0, y: 0 }));
    toCss(camera, c.x - P / 2, y, c.z, pa); toCss(camera, c.x + P / 2, y, c.z, pb);
    const cell = Math.hypot(pb.x - pa.x, pb.y - pa.y) / cpu(); p.k = cell / flatCell; p.cell = cell; return p;
  };
  const ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -TOP), hit = new THREE.Vector3(), ndc = new THREE.Vector2();
  v3.pick = (vx, vy) => {
    ndc.set(((vx * cpu() + offX()) / cssW()) * 2 - 1, 1 - ((vy * cpu() + offY()) / cssH()) * 2);
    ray.setFromCamera(ndc, camera);
    if (!ray.ray.intersectPlane(plane, hit)) return -1;
    return cellAtWorld(hit.x, hit.z);
  };

  // ---------------------------------------------------------------- stones
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
  const counts = {}; let nBlob = 0;
  const begin = () => { for (const k in inst) counts[k] = 0; nBlob = 0; };
  function put(who, v, x, y, z, yaw, tiltX = 0, tiltZ = 0, sc = 1, floorY = FLOOR) {
    const key = `${who}${v % 3}`, m = inst[key]; if (!m || counts[key] >= CAP) return;
    _e.set(tiltX, yaw, tiltZ, 'YXZ'); _q.setFromEuler(_e); _s.set(sc, sc, sc); _p.set(x, y, z);
    m.setMatrixAt(counts[key]++, _m.compose(_p, _q, _s));
    if (nBlob < CAP * 2 && sc > 0.05) {
      const half = (who === 1 ? PEB_H : DATE_H) * 0.5, lift = Math.max(0, y - half - floorY), s = 5.2 * sc * (1 + lift * 0.08), k = clamp(1 - lift / 14, 0, 1);
      if (k > 0.02) { _p.set(x + lift * 0.25, floorY + 0.04, z + lift * 0.3); _q.identity(); _s.set(s * (who === 2 ? 1.15 : 1), 1, s); blobs.setMatrixAt(nBlob++, _m.compose(_p, _q, _s)); }
    }
  }
  function end() {
    for (const k in inst) { inst[k].count = counts[k]; inst[k].instanceMatrix.needsUpdate = true; }
    blobs.count = nBlob; blobs.instanceMatrix.needsUpdate = true;
  }
  const yawOf = (who, i) => (who === 2 ? -dateAngle(i) : hash(i, 41) * TAU);
  const jit = (i, s) => (hash(i, s) - 0.5) * 0.5;
  const variant = (i) => i % 3;
  const puffed = new WeakSet();
  let clock = 0;
  function drawStones(F) {
    begin();
    const cells = F.cells, onB = { 1: 0, 2: 0 }, fly = { 1: 0, 2: 0 };
    for (let i = 0; i < cells.length; i++) if (cells[i]) onB[cells[i]]++;
    for (const g of F.ghosts) fly[g.who]++;
    const pile = { 1: Math.max(0, PIECES - onB[1] - fly[1]), 2: Math.max(0, PIECES - onB[2] - fly[2]) };
    for (const who of [1, 2]) for (let k = 0; k < pile[who]; k++) { const s = pileSpot(who, k); put(who, k + who, s.x, s.y + (who === 1 ? PEB_H : DATE_H) * 0.5, s.z, s.yaw, s.tilt, 0, 1, 0.3); }
    for (let i = 0; i < cells.length; i++) {
      const who = cells[i]; if (!who) continue;
      const c = pocketPos(i), R = restY(who), a = F.anim ? F.anim[i] : null;
      let x = c.x + jit(i, 3), y = R, z = c.z + jit(i, 5), tx = 0, tz = 0, yaw = yawOf(who, i);
      if (a && a.kind === 'drop') {
        // placement: the stone is taken from its heap beside the board and set down in the pocket
        const k = clamp(a.t / DROP_T, 0, 1), src = pileSpot(who, pile[who]), e = sstep(k);
        if (k < 1) { x = src.x + (x - src.x) * e; z = src.z + (z - src.z) * e; y = (src.y + 1.2) + (R - src.y - 1.2) * k + Math.sin(Math.PI * k) * 9; yaw += (1 - e) * 1.4; tx = (1 - e) * 0.35; }
        else { const st = settlePose(a.t - DROP_T); y += st.y; tz = st.tilt; if (!puffed.has(a)) { puffed.add(a); puff(c.x, FLOOR + 0.3, c.z, 0.8); } }
      } else if (a && a.kind === 'slide' && a.from >= 0) {
        const k = clamp(a.t / SLIDE_T, 0, 1), f = pocketPos(a.from), e = sstep(k);
        if (k < 1) {
          const dx = c.x - f.x, dz = c.z - f.z, L = Math.hypot(dx, dz) || 1;
          x = f.x + dx * e; z = f.z + dz * e; y = R + Math.sin(Math.PI * k) * POCKET_LIFT;
          const lean = Math.sin(Math.PI * k) * 0.22 * (k < 0.5 ? 1 : -0.7); tx = (dz / L) * lean; tz = -(dx / L) * lean;
        } else { const st = settlePose(a.t - SLIDE_T); y += st.y; tz = st.tilt; if (!puffed.has(a)) { puffed.add(a); puff(c.x, FLOOR + 0.3, c.z, 0.6); } }
      }
      if (F.sel === i) y += 1.5 + Math.sin(clock * 4) * 0.25;
      if (F.win && F.win.who === who) { const ph = F.win.t * 5 - ((i % N) + Math.floor(i / N)) * 0.6; if (ph > 0 && ph < Math.PI * 3) y += Math.max(0, Math.sin(ph)) * 1.6 * Math.exp(-ph * 0.15); }
      put(who, variant(i), x, y, z, yaw, tx, tz);
    }
    // captured stones: a short tremble, then lifted out of the pocket and set down on their own heap beside the board
    const seen = { 1: 0, 2: 0 };
    for (const g of F.ghosts) {
      const c = pocketPos(g.cell), R = restY(g.who), dst = pileSpot(g.who, pile[g.who] + seen[g.who]++), yaw = yawOf(g.who, g.cell);
      if (g.k <= 0) { const tr = (g.pre ?? 0) > 0.4 ? Math.sin(clock * 70) * 0.12 : 0; put(g.who, variant(g.cell), c.x + tr, R, c.z, yaw); continue; }
      const k = clamp(g.k, 0, 1), e = sstep(k), hy = dst.y + (g.who === 1 ? PEB_H : DATE_H) * 0.5;
      put(g.who, variant(g.cell), c.x + (dst.x - c.x) * e, R + (hy - R) * k + Math.sin(Math.PI * k) * 12, c.z + (dst.z - c.z) * e, yaw + e * (dst.yaw - yaw), Math.sin(Math.PI * k) * 0.5, 0, 1, k < 0.5 ? FLOOR : 0.3);
    }
    end();
  }
  function drawMarks(list) {
    let nr = 0, nf = 0;
    for (const mk of list) {
      if (mk.sq < 0 || mk.sq >= N * N) continue;
      const c = pocketPos(mk.sq), [r, g, b] = mk.rgb.split(',').map((v) => Number(v) / 255), a = clamp(mk.a, 0, 1);
      if (mk.fill && nf < fills.length) { const m = fills[nf++]; m.visible = true; m.position.set(c.x, FLOOR + 0.06, c.z); m.scale.set(POCKET * 0.98, 1, POCKET * 0.98); m.material.color.setRGB(r * r * a, g * g * a, b * b * a); }
      if ((!mk.fill || mk.ring) && nr < rings.length) { const m = rings[nr++]; m.visible = true; m.position.set(c.x, TOP + 0.07, c.z); const s = POCKET * (mk.grow ?? 1.18); m.scale.set(s, 1, s); m.material.color.setRGB(r * r * 1.3 * a, g * g * 1.3 * a, b * b * 1.3 * a); }
    }
    for (let i = nr; i < rings.length; i++) rings[i].visible = false;
    for (let i = nf; i < fills.length; i++) fills[i].visible = false;
  }

  // ---------------------------------------------------------------- per frame
  let game = null, lost = false, lastNow = 0, frameAvg = 16, slowFrames = 0, fadeIn = 0, mode = '';
  const boardPts = (e = H) => [[-e, TOP, -e], [e, TOP, -e], [-e, TOP, e], [e, TOP, e], [-e, 0, e + 0.3], [e, 0, e + 0.3]];
  function framing(state) {
    const t = clock;
    if (mode === 'board') {
      const B = playLayout(TEXT_SCALES[state.textIdx] ?? 1).board; flatCell = (B.side * 0.88) / N;
      const pad = B.side * 0.02, rc = rectCss({ x: B.x - pad, y: B.y - pad, w: B.side + 2 * pad, h: B.side + 2 * pad });
      return fit(rc, boardPts(H + 0.4), { yaw: 0, tilt: SCREEN.land ? 52 : 57, fov: 30, tx: 0, ty: TOP, tz: 0 });
    }
    const base = { yaw: -14 + 7 * Math.sin(t * TAU / 34), tilt: 27 + 2 * Math.sin(t * TAU / 23), fov: 38, tx: -2, ty: TOP * 0.6, tz: 0 };
    let r = mode === 'title' ? v3.hero : null;
    if (!r) { const U = AREA; r = SCREEN.land ? { x: U.x0 + U.w * 0.06, y: U.y0 + U.h * 0.32, w: U.w * 0.52, h: U.h * 0.6 } : { x: U.x0 + U.w * 0.06, y: U.y0 + U.h * 0.36, w: U.w * 0.88, h: U.h * 0.34 }; }
    { const h = Math.min(r.h, r.w * (SCREEN.land ? 0.8 : 0.78)); r = { x: r.x + r.w * 0.04, y: r.y + (r.h - h) * 0.7, w: r.w * 0.92, h }; base.fov = SCREEN.land ? 46 : 50; }     // portrait: the board sits low, the dunes and sky open above it
    const rc = rectCss(r);
    const pts = SCREEN.land ? [[-H - 10, 0, H], [H + 10, 0, H], [-H, TOP, -H], [H, TOP, -H]] : [[-H - 1, 0, H], [H + 1, 0, H], [-H, TOP, -H], [H, TOP, -H]];
    return fit(rc, pts, base);
  }
  let wasBoard = null;
  function pre() {
    if (!game || lost) return;
    const state = game.getState();
    setSize(meta.width, meta.height);
    const isBoard = Boolean((state.scene === 'play' || state.scene === 'auto') && state.match);
    mode = isBoard ? 'board' : state.scene === 'title' ? 'title' : 'env';
    const vk = `${cssW()}x${cssH()}|${state.textIdx}`; if (vk !== viewKey) { viewKey = vk; snap = true; }
    if (wasBoard !== isBoard) { wasBoard = isBoard; snap = true; }
    if (state.theme) setTheme(state.theme);
    lantern.visible = mode !== 'board';        // on the play page the lantern stands just out of frame; its light stays
    const goal = framing(state);
    const now = performance.now(), dt = clamp((now - (lastNow || now)) / 1000, 0, 0.1);
    const k = snap || mode === 'board' ? 1 : 1 - Math.exp(-dt * 4);
    for (const key of Object.keys(goal)) cur[key] += (goal[key] - cur[key]) * k;
    snap = false;
    place(camera, cur);
    v3.marks.length = 0; v3.frame = null;
  }
  function post() {
    if (!game || lost) return;
    const now = performance.now(), dt = clamp((now - (lastNow || now)) / 1000, 0, 0.1); lastNow = now;
    const F = v3.frame, frozen = Boolean(F && F.frozen);
    if (!frozen) clock += dt;
    if (F && F.cells) drawStones(F); else { begin(); end(); }
    drawMarks(F && F.mode === 'board' ? v3.marks : []);
    for (const m of dust) {
      const u = m.userData; if (!(u.t <= 0.7)) { m.visible = false; continue; }
      if (!frozen) u.t += dt; const f = Math.min(1, u.t / 0.7), s = (3 + f * 7) * u.s;
      m.visible = true; m.position.set(u.x, u.y + f * 0.9, u.z); m.scale.set(s, 1, s); m.material.opacity = 0.6 * (1 - f) * (1 - f);
    }
    // the flame breathes; the stars twinkle
    const fl = 1 + 0.06 * Math.sin(clock * 11.3) + 0.04 * Math.sin(clock * 17.1 + 1.3) + 0.03 * Math.sin(clock * 5.7);
    lights.lamp.intensity = lights.lamp.userData.base * fl; lights.glow.intensity = lights.glow.userData.base * fl;
    lantern.userData.flame.scale.set(1, fl, 1); lantern.userData.halo.material.opacity = clamp(0.85 + (fl - 1) * 1.5, 0, 1);
    sky.material.uniforms.uTime.value = clock;
    if (fadeIn < 1) { fadeIn = Math.min(1, fadeIn + dt / 0.45); v3.fade = fadeIn; }
    renderer.setSize(cssW(), cssH(), false);
    renderer.render(scene, camera);
    const ft = dt * 1000; if (ft > 0) frameAvg = frameAvg * 0.95 + ft * 0.05;
    if (frameAvg > 26 && tier < 2) { if (++slowFrames > 90) { tier++; slowFrames = 0; frameAvg = 16; applyTier(); boardKey = ''; setTheme(themeId); } } else slowFrames = 0;
  }

  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; v3.on = false; canvas.style.visibility = 'hidden'; });
  canvas.addEventListener('webglcontextrestored', () => {
    lost = false; buildEnv(); for (const b of boards.values()) { scene.remove(b); b.userData.dispose(); } boards.clear(); board = null; boardKey = ''; setTheme(themeId);
    applyTier(); fadeIn = 0; v3.fade = 0; v3.on = true; canvas.style.visibility = 'visible'; snap = true;
  });

  await tick();
  setTheme('sand'); await tick();
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
