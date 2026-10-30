// Oware 3D presenter. READS what the 2D layer put into src/v3.js this frame (pit counts, loose seeds in flight, marks, the rectangle the board is
// fitted to), never writes game state. One WebGL canvas sits behind the kit's transparent 2D canvas: a clay courtyard, a woven mat, a carved board
// with twelve dished pits and two trays, and the seeds. The camera is fitted to the layout's rectangle; v3.toScreen / v3.pitNear hand the 2D layer
// the exact projection so taps, counts and labels line up with the picture. No WebGL, ?flat=1 or a lost context: v3.on = false and every screen
// draws the flat 2D art; a restored context rebuilds the scene and returns to 3D.
import * as THREE from '../vendor3d/three.js';
import { v3 } from '../src/v3.js';
import { meta } from '../src/game.js';
import { host, MID_Y, pitPos } from '../src/layout.js';
import { TOP, BW, BD, SEED_R, bowlY, TRAY_FLOOR, TRAY_Z, PIT_XZ, radialTex, buildRoom, buildLights, buildBoard, makeSeedKit } from './world.js';

const D2R = Math.PI / 180;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const TIERS = [{ name: 'high', dpr: 2, shadow: 2048, tex: 2048 }, { name: 'medium', dpr: 1.5, shadow: 1024, tex: 1536 }, { name: 'low', dpr: 1, shadow: 0, tex: 1024 }];
const tick = () => new Promise((r) => setTimeout(r, 0));
const MARK = { legal: '#ffe07a', hint: '#7dffaa', cap: '#ffb04a', ref: '#ff6a4a', kb: '#7dff9a' };
const MAXS = 72;
// resting offsets inside a pit: 19 per layer (1 + 6 + 12), layers shrink a little as they climb the dish
const LAT = [[0, 0]]; for (let k = 0; k < 6; k++) LAT.push([Math.cos(k * 1.0472 + 0.3) * 0.22, Math.sin(k * 1.0472 + 0.3) * 0.22]); for (let k = 0; k < 10; k++) LAT.push([Math.cos(k * 0.6283) * 0.355, Math.sin(k * 0.6283) * 0.355]);

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
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.8;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  let tier = qs.has('tier') ? clamp(Number(qs.get('tier')), 0, 2) : (navigator.hardwareConcurrency || 8) <= 4 ? 1 : 0;

  await tick();
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xb98055);
  scene.fog = new THREE.Fog(0xb98055, 70, 200);
  const camera = new THREE.PerspectiveCamera(24, 1, 1, 500);
  const lights = buildLights(scene);
  const buildEnv = () => { try { const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture; pm.dispose(); scene.environmentIntensity = 0.5; } catch { /* no IBL */ } };
  buildEnv();
  await tick();
  buildRoom(scene);
  await tick();

  // ---- seeds (one kit per set, built on demand), marks ----
  const kits = new Map(); let kit = null, kitKey = '';
  function setKit(set) {
    if (set === kitKey) return; kitKey = set;
    if (kit) { scene.remove(kit.im); if (kit.slit) scene.remove(kit.slit); }
    let k = kits.get(set); if (!k) { k = makeSeedKit(set, MAXS); kits.set(set, k); }
    kit = k; scene.add(k.im); if (k.slit) scene.add(k.slit);
  }
  const flatQuad = new THREE.PlaneGeometry(1, 1); flatQuad.rotateX(-Math.PI / 2);
  const mk = (draw) => { const c = document.createElement('canvas'); c.width = c.height = 128; draw(c.getContext('2d')); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };
  const TEX = {
    ring: mk((x) => { const g = x.createRadialGradient(64, 64, 40, 64, 64, 64); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.55, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); x.strokeStyle = '#fff'; x.lineWidth = 7; x.beginPath(); x.arc(64, 64, 52, 0, 7); x.stroke(); }),
    glow: radialTex('255,255,255', 1),
  };
  const marks = Array.from({ length: 24 }, () => { const m = new THREE.Mesh(flatQuad, new THREE.MeshBasicMaterial({ map: TEX.ring, transparent: true, depthWrite: false, fog: false })); m.renderOrder = 2; m.visible = false; scene.add(m); return m; });

  const boards = new Map(); let board = null, boardKey = '';
  function setBoard(wood) {
    const k = `${wood}|${TIERS[tier].tex}`; if (k === boardKey) return;
    let t = boards.get(k);
    if (!t) { t = buildBoard(wood, TIERS[tier].tex); boards.set(k, t); if (boards.size > 3) { const [k0, b0] = boards.entries().next().value; if (b0 !== t && b0 !== board) { b0.userData.dispose(); boards.delete(k0); } } }
    if (board) scene.remove(board); board = t; boardKey = k; scene.add(t);
  }
  function applyTier() {
    const t = TIERS[tier];
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, t.dpr));
    renderer.shadowMap.enabled = t.shadow > 0; lights.sun.castShadow = t.shadow > 0;
    if (t.shadow) { lights.sun.shadow.mapSize.set(t.shadow, t.shadow); if (lights.sun.shadow.map) { lights.sun.shadow.map.dispose(); lights.sun.shadow.map = null; } }
    scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => { if (m && m.isMaterial) m.needsUpdate = true; }); });
    boardKey = ''; if (board) { scene.remove(board); board = null; } setBoard(v3.wood || 'iroko');
  }
  applyTier();

  // ---- camera: elevation / fov per screen, distance and an off-axis shift fitted to a rectangle ----
  const cur = { yaw: 0, tilt: 56, fov: 24, dist: 60, ox: 0, oy: 0, tx: 0, ty: TOP, tz: 0 };
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
    const p = { ...base, ox: 0, oy: 0, dist: 60 }, q = { x: 0, y: 0 }; let bb = null;
    for (let it = 0; it < 9; it++) {
      place(fitCam, p); bb = { x0: 1e9, y0: 1e9, x1: -1e9, y1: -1e9 };
      for (const [x, y, z] of pts) { toCss(fitCam, x, y, z, q); bb.x0 = Math.min(bb.x0, q.x); bb.x1 = Math.max(bb.x1, q.x); bb.y0 = Math.min(bb.y0, q.y); bb.y1 = Math.max(bb.y1, q.y); }
      const s = Math.min(rc.w / Math.max(1, bb.x1 - bb.x0), rc.h / Math.max(1, bb.y1 - bb.y0));
      if (Math.abs(s - 1) < 0.002) break; p.dist /= s;
    }
    p.ox = (bb.x0 + bb.x1) / 2 - (rc.x + rc.w / 2); p.oy = (bb.y0 + bb.y1) / 2 - (rc.y + rc.h / 2); p.bw = bb.x1 - bb.x0; p.bh = bb.y1 - bb.y0;
    return p;
  }
  const cpu = () => meta.cssPerUnit || (Math.min(cssW(), cssH()) / 720);
  const offX = () => (cssW() - meta.width * cpu()) / 2, offY = () => (cssH() - meta.height * cpu()) / 2;
  const rectCss = (r) => ({ x: r.x * cpu() + offX(), y: r.y * cpu() + offY(), w: r.w * cpu(), h: r.h * cpu() });
  const virt = (q) => ({ x: (q.x - offX()) / cpu(), y: (q.y - offY()) / cpu() });
  const HW = BW / 2, HD = BD / 2;
  const PTS = [[-HW, TOP, -HD], [HW, TOP, -HD], [-HW, TOP, HD], [HW, TOP, HD], [-HW + 0.3, 0.1, HD], [HW - 0.3, 0.1, HD], [-HW, TOP - 0.62, HD], [HW, TOP - 0.62, HD]];
  const playCache = new Map();
  function playCam(rc) {
    const key = `${rc.x.toFixed(1)},${rc.y.toFixed(1)},${rc.w.toFixed(1)},${rc.h.toFixed(1)}|${cssW()}x${cssH()}|${cpu().toFixed(4)}`;
    let p = playCache.get(key);
    if (!p) { const r = rectCss(rc); for (let el = cssW() > cssH() ? 60 : 64; el >= 38; el -= 2) { p = fit(r, PTS, { yaw: 0, tilt: el, fov: 24, tx: 0, ty: TOP, tz: 0.2 }); if (p.bw >= r.w * 0.985 || p.bh >= r.h * 0.985) break; } playCache.set(key, p); if (playCache.size > 24) playCache.delete(playCache.keys().next().value); }
    return p;
  }

  // canonical (flat game's board units) <-> world
  const q0 = { x: 0, y: 0 }, c2w = (cx, cy) => [(cx - 360) / 100, (cy - MID_Y) / 100];
  v3.toScreen = (cx, cy, h = 0) => { const [wx, wz] = c2w(cx, cy), v = virt(toCss(camera, wx, TOP + h / 100, wz, q0)); return { x: v.x, y: v.y }; };
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  v3.pitNear = (sx, sy) => {
    const cx = sx * cpu() + offX(), cy = sy * cpu() + offY(); ndc.set(cx / cssW() * 2 - 1, -(cy / cssH() * 2 - 1)); ray.setFromCamera(ndc, camera);
    const o = ray.ray.origin, d = ray.ray.direction; if (d.y >= -1e-4) return -1;
    const t = (TOP - o.y) / d.y, bx = (o.x + d.x * t) * 100 + 360, by = (o.z + d.z * t) * 100 + MID_Y;
    let best = -1, bd = 1e9;
    for (let i = 0; i < 12; i++) { const p = pitPos(i), dx = Math.abs(bx - p.x), dy = Math.abs(by - p.y); if (dx > 54 || dy > 92) continue; const dd = dx * dx + dy * dy; if (dd < bd) { bd = dd; best = i; } }
    return best;
  };

  // ---- per frame content ----
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _e = new THREE.Euler(), _c = new THREE.Color();
  const PAL = { nuts: ['#c9772f', '#a85a22', '#7d3a14', '#e0944a'], cowries: ['#f6e8c6', '#efdcb2', '#ead3a2', '#f9eed2'], glass: ['#7fe3d8', '#6fa4ff', '#ffc65a', '#d89bff'] };
  let used = 0;
  function putSeed(x, y, z, v, rot) {
    if (used >= MAXS) return; const i = used++, k = kit;
    _e.set(k.sy < 0.9 && v3.seedSet !== 'nuts' ? 0 : Math.sin(rot * 3) * 0.2, rot, v3.seedSet === 'cowries' ? 0 : Math.cos(rot * 2) * 0.2, 'YXZ'); _q.setFromEuler(_e);
    k.im.setMatrixAt(i, _m.compose(_p.set(x, y, z), _q, _s.set(k.sx, k.sy, k.sz)));
    k.im.setColorAt(i, _c.set(PAL[v3.seedSet][v & 3]));
    if (k.slit) { _p.set(x, y + SEED_R * k.sy * 0.8, z); k.slit.setMatrixAt(i, _m.compose(_p, _q, _s.set(k.sx * 0.8, 0.2, 0.22))); }
  }
  function drawSeeds() {
    used = 0;
    const sy = kit.sy;
    for (let i = 0; i < 12; i++) {
      if (i === v3.hidePit) continue; const n = v3.pits[i], [px, pz] = PIT_XZ(i);
      for (let k = 0; k < n; k++) {
        const layer = Math.floor(k / 17), j = k % 17, sc = 1 - 0.14 * layer, o = LAT[j], jx = Math.sin(k * 12.9 + i) * 0.012, jz = Math.cos(k * 7.7 + i) * 0.012;
        const dx = o[0] * sc + jx, dz = o[1] * sc + jz;
        putSeed(px + dx, TOP + bowlY(Math.hypot(dx, dz)) + SEED_R * sy * 0.95 + layer * 0.19, pz + dz, k * 5 + i, k * 2.399963 + i);
      }
    }
    for (let p = 0; p < 2; p++) {
      const n = v3.store[p], tz = TRAY_Z[p];
      for (let k = 0; k < n; k++) { const layer = Math.floor(k / 28), j = k % 28, col = j % 14, row = Math.floor(j / 14); putSeed(-1.05 + col * 0.215 + row * 0.1, TRAY_FLOOR + SEED_R * sy * 0.95 + layer * 0.17, tz - 0.12 + row * 0.2, k * 3 + p, k * 1.7 + p); }
    }
    for (const f of v3.free) { const [wx, wz] = c2w(f.x, f.y); putSeed(wx, TOP + 0.13 + (f.h || 0) / 100, wz, f.v, f.rot || 0); }
    _m.makeScale(0, 0, 0); for (let i = used; i < MAXS; i++) { kit.im.setMatrixAt(i, _m); if (kit.slit) kit.slit.setMatrixAt(i, _m); }
    kit.im.instanceMatrix.needsUpdate = true; if (kit.im.instanceColor) kit.im.instanceColor.needsUpdate = true; if (kit.slit) kit.slit.instanceMatrix.needsUpdate = true;
  }
  function drawMarks() {
    let k = 0;
    for (const m of v3.marks) {
      if (k >= marks.length) break; const q = marks[k++], [px, pz] = PIT_XZ(m.pit), a = clamp(m.a ?? 1, 0, 1), glow = m.kind === 'hint' || m.kind === 'cap';
      q.visible = true; q.material.map = TEX.ring; q.material.opacity = a; q.material.blending = THREE.NormalBlending; q.material.color.set(MARK[m.kind] || '#fff');
      q.position.set(px, TOP + 0.04, pz); const r = m.kind === 'ref' ? 1.16 : 1.1; q.scale.set(r, 1, r);
      if (glow) { q.material.blending = THREE.AdditiveBlending; }
    }
    for (; k < marks.length; k++) marks[k].visible = false;
  }

  // ---- per frame (called once, after the 2D layer has drawn and filled v3.*) ----
  let loseExt = null, lost = false, lastNow = 0, frameAvg = 16, slowFrames = 0, mode = '', snap = true, viewKey = '', clock = 0;
  function post() {
    if (lost) return;
    const now = performance.now(), dt = clamp((now - (lastNow || now)) / 1000, 0, 0.1); lastNow = now; clock += dt;
    const fr = v3.frame;
    if (!fr) { canvas.style.visibility = 'hidden'; mode = ''; return; }          // a text page: the flat backdrop is drawn, nothing to render
    canvas.style.visibility = 'visible';
    const vk = `${cssW()}x${cssH()}|${meta.width}x${meta.height}`; if (vk !== viewKey) { viewKey = vk; snap = true; playCache.clear(); }
    setBoard(v3.wood || 'iroko'); setKit(v3.seedSet || 'nuts');
    let goal;
    if (fr.mode === 'title') goal = fit(rectCss(fr.rect), PTS, { yaw: -4 + 5 * Math.sin(clock * 0.25), tilt: 46 + 2 * Math.sin(clock * 0.15), fov: 26, tx: 0, ty: TOP, tz: 0.2 });
    else goal = playCam(fr.rect);
    if (fr.mode !== mode) { snap = true; mode = fr.mode; }
    const k = snap || fr.mode === 'play' ? 1 : 1 - Math.exp(-dt * 4);
    for (const key of ['yaw', 'tilt', 'fov', 'dist', 'ox', 'oy', 'tx', 'ty', 'tz']) cur[key] += (goal[key] - cur[key]) * k;
    snap = false;
    place(camera, cur);
    drawSeeds(); drawMarks();
    renderer.setSize(cssW(), cssH(), false);
    renderer.render(scene, camera);
    const ft = dt * 1000; if (ft > 0) frameAvg = frameAvg * 0.95 + ft * 0.05;
    if (frameAvg > 26 && tier < 2) { if (++slowFrames > 90) { tier++; slowFrames = 0; frameAvg = 16; applyTier(); } } else slowFrames = 0;
  }

  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; v3.on = false; host.c3 = false; canvas.style.visibility = 'hidden'; });
  canvas.addEventListener('webglcontextrestored', () => {
    lost = false; buildEnv(); for (const b of boards.values()) { if (board === b) scene.remove(b); b.userData.dispose(); } boards.clear(); board = null; boardKey = '';
    for (const k of kits.values()) k.dispose(); kits.clear(); kit = null; kitKey = '';
    applyTier(); v3.on = true; host.c3 = true; canvas.style.visibility = 'visible'; snap = true; playCache.clear();
  });

  await tick();
  place(camera, cur); try { renderer.compile(scene, camera); } catch { /* compiled lazily */ }
  await tick();
  return {
    ok: true, renderer, scene, camera, post,
    attach() { host.c3 = true; v3.on = true; snap = true; },
    get tier() { return TIERS[tier].name; },
    loseContext() { loseExt = renderer.getContext().getExtension('WEBGL_lose_context'); loseExt?.loseContext(); return Boolean(loseExt); },
    restoreContext() { loseExt?.restoreContext(); },
  };
}
