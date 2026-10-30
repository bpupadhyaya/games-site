// Halma 3D presenter. READS what the 2D layer put into src/v3.js this frame (the pegs on show, square marks, the rectangle the board is fitted to), never writes game
// state. One WebGL canvas sits behind the kit's transparent 2D canvas: a warm daylit table, a maple board with brass-edged frame and stained camps, and lathe-turned
// lacquered pegs. The camera is fitted to the layout's rectangle; v3.toScreen / v3.cellAt hand the 2D layer the exact projection so taps, drags, labels and the finger
// magnifier line up with the picture. No WebGL, ?flat=1 or a lost context: v3.on = false and every screen draws the flat 2D art; a restored context rebuilds the scene.
import * as THREE from '../vendor3d/three.js';
import { v3 } from '../src/v3.js';
import { meta } from '../src/game.js';
import { host } from '../src/layout.js';
import { FRW, TOP, PEG_H, buildRoom, buildLights, buildBoard, makePegKit, radialTex } from './world.js';
import { VARIANTS } from '../src/rules.js';

const D2R = Math.PI / 180;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const TIERS = [{ name: 'high', dpr: 2, shadow: 2048, tex: 2048 }, { name: 'medium', dpr: 1.5, shadow: 1024, tex: 1536 }, { name: 'low', dpr: 1, shadow: 0, tex: 1024 }];
const tick = () => new Promise((r) => setTimeout(r, 0));
const MARK = { sel: '#fff2a8', dest: '#fffbd0', hop: '#ffc542', hint: '#6dffa0', last: '#ffd890', star: '#ffe27a', lesson: '#ff7a55', cursor: '#7dff9a', ripple: '#fff6dc', ring: '#fff6c0' };

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
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.85;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  let tier = qs.has('tier') ? clamp(Number(qs.get('tier')), 0, 2) : (navigator.hardwareConcurrency || 8) <= 4 ? 1 : 0;

  await tick();
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x3a2415);
  scene.fog = new THREE.Fog(0x4a2e1a, 140, 330);   // the camera sits ~60-100 units away: the fog only softens the far table edge
  const camera = new THREE.PerspectiveCamera(24, 1, 1, 500);
  const lights = buildLights(scene);
  const buildEnv = () => { try { const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture; pm.dispose(); scene.environmentIntensity = 0.55; } catch { /* no IBL */ } };
  buildEnv();
  await tick();
  buildRoom(scene);
  await tick();

  // ---- pegs (pooled per seat), contact shadows, marks ----
  let kit = makePegKit();
  const pool = new Map();
  const flatQuad = new THREE.PlaneGeometry(1, 1); flatQuad.rotateX(-Math.PI / 2);
  const mk = (draw) => { const c = document.createElement('canvas'); c.width = c.height = 128; draw(c.getContext('2d')); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };
  const TEX = {
    sq: mk((x) => { const g = x.createRadialGradient(64, 64, 20, 64, 64, 70); g.addColorStop(0, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0.0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); x.strokeStyle = '#fff'; x.lineWidth = 8; x.beginPath(); x.roundRect(10, 10, 108, 108, 14); x.stroke(); }),
    dot: mk((x) => { const g = x.createRadialGradient(64, 64, 8, 64, 64, 50); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.7, 'rgba(255,255,255,0.9)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.beginPath(); x.arc(64, 64, 50, 0, 7); x.fill(); }),
    ring: mk((x) => { x.fillStyle = 'rgba(255,255,255,0.22)'; x.beginPath(); x.arc(64, 64, 52, 0, 7); x.fill(); x.strokeStyle = '#fff'; x.lineWidth = 12; x.beginPath(); x.arc(64, 64, 50, 0, 7); x.stroke(); }),
    star: mk((x) => { x.fillStyle = '#fff'; x.beginPath(); for (let k = 0; k < 10; k++) { const r = k % 2 ? 22 : 50, a = -Math.PI / 2 + k * Math.PI / 5; k ? x.lineTo(64 + Math.cos(a) * r, 64 + Math.sin(a) * r) : x.moveTo(64 + Math.cos(a) * r, 64 + Math.sin(a) * r); } x.closePath(); x.fill(); }),
    blob: mk((x) => { const g = x.createRadialGradient(64, 64, 6, 64, 64, 64); g.addColorStop(0, 'rgba(0,0,0,0.7)'); g.addColorStop(0.6, 'rgba(0,0,0,0.35)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); }),
  };
  const markPool = [], blobPool = [];
  const markMat = (tx) => new THREE.MeshBasicMaterial({ map: tx, transparent: true, depthWrite: false, fog: false });
  const growMark = () => { const m = new THREE.Mesh(flatQuad, markMat(TEX.sq)); m.renderOrder = 2; m.visible = false; scene.add(m); markPool.push(m); return m; };
  const growBlob = () => { const m = new THREE.Mesh(flatQuad, markMat(TEX.blob)); m.renderOrder = 1; m.visible = false; scene.add(m); blobPool.push(m); return m; };

  // boards are built per rule set + wood and kept (switching between the title hero and a game does not rebuild)
  const boards = new Map(); let board = null, boardN = 10, HW = 5;
  function useBoard(variant, key) {
    const bk = `${variant}|${key}|${TIERS[tier].tex}`;
    if (!boards.has(bk)) { if (boards.size >= 3) { const [k0, b0] = boards.entries().next().value; scene.remove(b0); b0.userData.dispose(); boards.delete(k0); } const b = buildBoard(VARIANTS[variant].n, TIERS[tier].tex, variant, key); b.visible = false; scene.add(b); boards.set(bk, b); }
    for (const b of boards.values()) b.visible = false;
    board = boards.get(bk); board.visible = true; boardN = VARIANTS[variant].n; HW = boardN / 2;
  }
  function applyTier() {
    const t = TIERS[tier];
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, t.dpr));
    renderer.shadowMap.enabled = t.shadow > 0; lights.sun.castShadow = t.shadow > 0;
    if (t.shadow) { lights.sun.shadow.mapSize.set(t.shadow, t.shadow); if (lights.sun.shadow.map) { lights.sun.shadow.map.dispose(); lights.sun.shadow.map = null; } }
    scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => { if (m && m.isMaterial) m.needsUpdate = true; }); });
    for (const b of boards.values()) { scene.remove(b); b.userData.dispose(); } boards.clear(); board = null;
  }
  applyTier();

  // ---- camera: elevation / fov per screen, distance and an off-axis shift fitted to a rectangle ----
  const cur = { yaw: 0, tilt: 54, fov: 24, dist: 60, ox: 0, oy: 0, tx: 0, ty: TOP, tz: 0 };
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
  // what the fit keeps inside the rectangle: the slab corners on the table and the heads of the pegs on the far row
  const ptsFor = (n) => { const a = n / 2 + FRW; return [[-a, TOP, -a], [a, TOP, -a], [-a, TOP, a], [a, TOP, a], [-a, 0, a], [a, 0, a], [-a + 0.4, TOP + PEG_H, -n / 2 + 0.5], [a - 0.4, TOP + PEG_H, -n / 2 + 0.5]]; };
  const playCache = new Map();
  function playCam(rc, n) {
    const key = `${n}|${rc.x.toFixed(1)},${rc.y.toFixed(1)},${rc.w.toFixed(1)},${rc.h.toFixed(1)}|${cssW()}x${cssH()}|${cpu().toFixed(4)}`;
    let p = playCache.get(key);
    if (!p) {
      const r = rectCss(rc), land = cssW() > cssH(), pts = ptsFor(n);
      if (!land) p = fit(r, pts, { yaw: 0, tilt: 58, fov: 24, tx: 0, ty: TOP, tz: 0 });   // portrait: the width limits the board, a low-ish tilt shows the turned pegs
      else for (let el = 54; el <= 74; el += 2) {                                   // landscape: as low as it can be while still filling the rectangle
        p = fit(r, pts, { yaw: 0, tilt: el, fov: 24, tx: 0, ty: TOP, tz: 0 });
        if (p.bh >= r.h * 0.985) break;
      }
      if (land && p.bh < r.h * 0.985 && p.bw < r.w * 0.985) { /* wide screen: width is spare, fine */ }
      playCache.set(key, p); if (playCache.size > 24) playCache.delete(playCache.keys().next().value);
    }
    return p;
  }

  // cell coordinates (column + 0.5, row + 0.5) <-> world; picking uses a plane at mid peg height so a tap on a head still lands on its own square
  const q0 = { x: 0, y: 0 }, PICK_Y = TOP + 0.4;
  v3.toScreen = (cx, cy, h = 0) => { const v = virt(toCss(camera, cx - HW, TOP + h, cy - HW, q0)); return { x: v.x, y: v.y }; };
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  v3.cellAt = (sx, sy) => {
    const cx = sx * cpu() + offX(), cy = sy * cpu() + offY(); ndc.set(cx / cssW() * 2 - 1, -(cy / cssH() * 2 - 1)); ray.setFromCamera(ndc, camera);
    const o = ray.ray.origin, d = ray.ray.direction; if (d.y >= -1e-4) return null;
    const t = (PICK_Y - o.y) / d.y; return { x: o.x + d.x * t + HW, y: o.z + d.z * t + HW };
  };
  const snapC = document.createElement('canvas'), snapX = snapC.getContext('2d');
  v3.vToSnap = (x, y) => { const pr = canvas.width / cssW(); return { x: (x * cpu() + offX()) * pr, y: (y * cpu() + offY()) * pr }; };

  // ---- per frame content ----
  function drawPieces() {
    const used = new Map(); let b = 0;
    for (const p of v3.pieces) {
      const arr = pool.get(p.seat) || (pool.set(p.seat, []), pool.get(p.seat)), n = used.get(p.seat) || 0; used.set(p.seat, n + 1);
      let m = arr[n]; if (!m) { m = kit.make(p.seat); scene.add(m); arr.push(m); }
      const sc = p.s ?? 1, lift = p.lift || 0;
      m.visible = true; m.position.set(p.x - HW, TOP + lift * 0.5, p.y - HW); m.scale.set(sc * 0.9, sc * 0.9, sc * 0.9);
      const bl = blobPool[b] || growBlob(); b++; bl.visible = true; bl.position.set(p.x - HW + lift * 0.12 + 0.04, TOP + 0.008, p.y - HW + lift * 0.12 + 0.04); const r = 0.95 * sc * (1 + lift * 0.2); bl.scale.set(r, 1, r); bl.material.opacity = (0.55 - lift * 0.15) * clamp(sc, 0, 1);
    }
    for (const [k, arr] of pool) for (let i = used.get(k) || 0; i < arr.length; i++) arr[i].visible = false;
    for (; b < blobPool.length; b++) blobPool[b].visible = false;
  }
  function drawMarks() {
    let k = 0;
    for (const m of v3.marks) {
      const q = markPool[k] || growMark(); k++;
      const a = clamp(m.a ?? 1, 0, 1), dot = m.kind === 'dest', star = m.kind === 'star', ring = m.kind === 'hop' || m.kind === 'ring' || m.kind === 'lesson' || m.kind === 'ripple';
      q.visible = true; q.material.map = dot ? TEX.dot : star ? TEX.star : ring ? TEX.ring : TEX.sq; q.material.opacity = a; q.material.color.set(MARK[m.kind] || '#fff');
      q.material.blending = m.kind === 'last' ? THREE.AdditiveBlending : THREE.NormalBlending;
      q.position.set(m.x - HW, TOP + 0.014 + (dot ? 0.004 : 0), m.y - HW); const sc = dot ? 0.3 : star ? 0.42 : m.kind === 'ripple' ? (m.sc || 0.7) : ring ? 0.86 : 0.98; q.scale.set(sc, 1, sc);
    }
    for (; k < markPool.length; k++) markPool[k].visible = false;
  }

  // ---- per frame (called once, after the 2D layer has drawn and filled v3.*) ----
  let loseExt = null, lost = false, lastNow = 0, frameAvg = 16, slowFrames = 0, mode = '', snap = true, viewKey = '', clock = 0;
  function post() {
    if (lost) return;
    const now = performance.now(), dt = clamp((now - (lastNow || now)) / 1000, 0, 0.1); lastNow = now; clock += dt;
    const fr = v3.frame;
    if (!fr) { canvas.style.visibility = 'hidden'; mode = ''; return; }          // a text page: the flat backdrop is drawn, nothing to render
    canvas.style.visibility = 'visible';
    useBoard(fr.variant || 'classic', fr.boardKey || 'maple');
    const vk = `${cssW()}x${cssH()}|${meta.width}x${meta.height}`; if (vk !== viewKey) { viewKey = vk; snap = true; playCache.clear(); }
    let goal;
    if (fr.mode === 'title') goal = fit(rectCss(fr.rect), ptsFor(boardN), { yaw: -10 + 14 * Math.sin(clock * 0.22), tilt: 42 + 3 * Math.sin(clock * 0.15), fov: 26, tx: 0, ty: TOP, tz: 0 });
    else goal = playCam(fr.rect, boardN);
    if (fr.mode !== mode) { snap = true; mode = fr.mode; }
    const k = snap || fr.mode === 'play' ? 1 : 1 - Math.exp(-dt * 4);
    for (const key2 of ['yaw', 'tilt', 'fov', 'dist', 'ox', 'oy', 'tx', 'ty', 'tz']) cur[key2] += (goal[key2] - cur[key2]) * k;
    snap = false;
    place(camera, cur);
    drawPieces(); drawMarks();
    renderer.setSize(cssW(), cssH(), false);
    renderer.render(scene, camera);
    if (v3.wantSnap) { if (snapC.width !== canvas.width || snapC.height !== canvas.height) { snapC.width = canvas.width; snapC.height = canvas.height; } snapX.drawImage(canvas, 0, 0); v3.snap = { canvas: snapC, k: (canvas.width / cssW()) * cpu() }; }
    const ft = dt * 1000; if (ft > 0) frameAvg = frameAvg * 0.95 + ft * 0.05;
    if (frameAvg > 26 && tier < 2) { if (++slowFrames > 90) { tier++; slowFrames = 0; frameAvg = 16; applyTier(); } } else slowFrames = 0;
  }

  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; v3.on = false; host.c3 = false; canvas.style.visibility = 'hidden'; });
  canvas.addEventListener('webglcontextrestored', () => {
    lost = false; buildEnv();
    for (const arr of pool.values()) for (const m of arr) scene.remove(m); pool.clear(); kit.dispose(); kit = makePegKit();
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
void radialTex;
