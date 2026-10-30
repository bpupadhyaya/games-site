// Surakarta 3D presenter. READS the game state (game.getState()) and what the 2D layer asked for this frame (src/v3.js: pieces and
// rings), never writes game state. One WebGL canvas sits behind the kit's transparent 2D canvas: a carved teak board with the two
// looped circuits inlaid in brass and jade, on a batik cloth in a night pendopo. On the play screens the camera is fitted to the
// layout's board rectangle and v3.geo hands the 2D layer a projection of the tilted board (pt(c, r) for ANY grid coordinate, so
// capture trails round the loops, rings and taps line up with the 3D board). No WebGL, ?flat=1 or a lost context: v3.on = false and
// every screen draws the flat 2D art; a restored context rebuilds the scene and returns to 3D.
import * as THREE from '../vendor3d/three.js';
import { v3 } from '../src/v3.js';
import { meta } from '../src/game.js';
import { layoutFor } from '../src/layout.js';
import { TEXT_SCALES } from '../src/ui.js';
import { themeById } from '../src/art.js';
import { S as SP, HALF, TOP, BASE, PR, RAIL_Z, RAIL_TOP, SLOT, gridPos, pointPos, radialTex, buildBoard, pieceGeos, pieceMaterials, setPieceTheme, buildRail, buildLamp, buildPendopo, buildLights } from './world.js';

const D2R = Math.PI / 180, CAP = 40;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const sm = (k) => k * k * (3 - 2 * k);
const hash = (a, b = 0) => { let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
const TIERS = [{ name: 'high', dpr: 2, shadow: 2048, tex: 1536 }, { name: 'medium', dpr: 1.5, shadow: 1024, tex: 1024 }, { name: 'low', dpr: 1, shadow: 0, tex: 512 }];
const tick = () => new Promise((r) => setTimeout(r, 0));
const SETTLE = 0.34, FLIGHT = 0.7;
const START = (() => { const a = new Array(36).fill(0); for (let c = 0; c < 6; c++) { a[c] = 2; a[6 + c] = 2; a[24 + c] = 1; a[30 + c] = 1; } return a; })();
const LAMP = { x: -29, z: -36 };
const RAIL_Y = BASE - 0.02, SOCKET_Y = RAIL_Y + RAIL_TOP - 0.32;

const colCache = new Map();
function parseCol(s) {
  let c = colCache.get(s); if (c) return c;
  const m = /^#([0-9a-f]{6})$/i.exec(s);
  if (m) c = [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16) / 255);
  else { const n = (s.match(/[\d.]+/g) || ['255', '255', '255']).slice(0, 3).map(Number); c = n.map((v) => v / 255); }
  colCache.set(s, c); return c;
}

// 3x3 homography taking 4 source points to 4 destination points (a plane seen through a perspective camera is exactly this)
function homography(src, dst) {
  const A = [], b = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = src[i], [u, v] = dst[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v);
  }
  for (let i = 0; i < 8; i++) {
    let p = i; for (let r = i + 1; r < 8; r++) if (Math.abs(A[r][i]) > Math.abs(A[p][i])) p = r;
    [A[i], A[p]] = [A[p], A[i]]; [b[i], b[p]] = [b[p], b[i]];
    for (let r = i + 1; r < 8; r++) { const f = A[r][i] / A[i][i]; for (let c = i; c < 8; c++) A[r][c] -= f * A[i][c]; b[r] -= f * b[i]; }
  }
  const h = new Array(8);
  for (let i = 7; i >= 0; i--) { let s = b[i]; for (let c = i + 1; c < 8; c++) s -= A[i][c] * h[c]; h[i] = s / A[i][i]; }
  return h;
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
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.95;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  let tier = qs.has('tier') ? clamp(Number(qs.get('tier')), 0, 2) : (navigator.hardwareConcurrency || 8) <= 4 ? 1 : 0;

  await tick();
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x07121c);
  scene.fog = new THREE.Fog(0x0b1a24, 300, 1300);
  const camera = new THREE.PerspectiveCamera(30, 1, 2, 5000);
  const lights = buildLights(scene);
  const buildEnv = () => { try { const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture; pm.dispose(); scene.environmentIntensity = 0.34; } catch { /* no IBL */ } };
  buildEnv();
  await tick();
  buildPendopo(scene);
  await tick();
  const lamp = buildLamp(); lamp.position.set(LAMP.x, 0.9, LAMP.z); scene.add(lamp);
  [0, 1].forEach((k) => { const g = buildRail(); g.position.set(0, RAIL_Y, k ? -RAIL_Z : RAIL_Z); if (k) g.rotation.y = Math.PI; scene.add(g); });
  await tick();
  const geos = pieceGeos();
  let th = themeById('teak'), themeId = 'teak';
  const mats = pieceMaterials(th);
  const inst = {};
  for (const k of ['1', '2', 'gold']) { const m = new THREE.InstancedMesh(geos[k], mats[k], CAP); m.castShadow = true; m.receiveShadow = true; m.count = 0; m.frustumCulled = false; scene.add(m); inst[k] = m; }
  const flatQuad = new THREE.PlaneGeometry(1, 1); flatQuad.rotateX(-Math.PI / 2);
  const blobs = new THREE.InstancedMesh(flatQuad, new THREE.MeshBasicMaterial({ map: radialTex('0,0,0', 0.9), transparent: true, depthWrite: false, opacity: 0.5 }), CAP);
  blobs.renderOrder = 1; blobs.frustumCulled = false; blobs.count = 0; scene.add(blobs);
  // rings and discs: light lying on the board surface (under the stones)
  const ringC = document.createElement('canvas'); ringC.width = ringC.height = 128;
  { const x = ringC.getContext('2d'), g = x.createRadialGradient(64, 64, 30, 64, 64, 64); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.55, 'rgba(255,255,255,0.15)'); g.addColorStop(0.74, 'rgba(255,255,255,1)'); g.addColorStop(0.86, 'rgba(255,255,255,0.85)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); }
  const ringT = new THREE.CanvasTexture(ringC); ringT.colorSpace = THREE.SRGBColorSpace;
  const discT = radialTex('255,255,255', 1);
  const marks = Array.from({ length: 64 }, () => { const m = new THREE.Mesh(flatQuad, new THREE.MeshBasicMaterial({ map: ringT, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); m.renderOrder = 2; m.visible = false; scene.add(m); return m; });
  // a puff of fine dust where a capturing stone settles
  const dustT = radialTex('230,205,170', 0.8);
  const dust = Array.from({ length: 10 }, () => { const m = new THREE.Mesh(flatQuad, new THREE.MeshBasicMaterial({ map: dustT, transparent: true, depthWrite: false })); m.renderOrder = 2; m.visible = false; m.userData = { t: 9 }; scene.add(m); return m; });
  let dustI = 0;
  const puff = (x, z, s = 1) => { const m = dust[dustI++ % dust.length]; m.userData = { t: 0, x, z, s }; };

  // boards are cached per theme and texture size
  const boards = new Map(); let board = null, boardKey = '';
  function setTheme(id) {
    const k = `${id}|${TIERS[tier].tex}`; if (k === boardKey) return;
    th = themeById(id); themeId = id; v3.theme = id;
    let b = boards.get(k); if (!b) { b = buildBoard(th, TIERS[tier].tex); boards.set(k, b); }
    if (board) scene.remove(board); board = b; boardKey = k; scene.add(b);
    setPieceTheme(mats, th);
  }
  function applyTier() {
    const t = TIERS[tier];
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, t.dpr));
    renderer.shadowMap.enabled = t.shadow > 0; lights.sun.castShadow = t.shadow > 0;
    if (t.shadow) { lights.sun.shadow.mapSize.set(t.shadow, t.shadow); if (lights.sun.shadow.map) { lights.sun.shadow.map.dispose(); lights.sun.shadow.map = null; } }
    blobs.material.opacity = t.shadow ? 0.3 : 0.6;
    scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => { if (m && m.isMaterial) m.needsUpdate = true; }); });
    setTheme(themeId);
  }
  applyTier();

  // ---------------------------------------------------------------- camera: yaw/tilt/fov per screen, distance + off-axis shift fitted to a rectangle
  const cur = { yaw: 0, tilt: 60, fov: 26, dist: 120, ox: 0, oy: 0, tx: 0, ty: TOP, tz: 0 };
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
    const p = { ...base, ox: 0, oy: 0, dist: 140 }, q = { x: 0, y: 0 }; let bb = null;
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
  const rectCss = (r) => ({ x: r.x * cpu() + offX(), y: r.y * cpu() + offY(), w: r.w * cpu(), h: r.h * cpu() });
  const virt = (q) => ({ x: (q.x - offX()) / cpu(), y: (q.y - offY()) / cpu() });

  // the board (and the two capture rails) must all be in view
  const B = HALF - 0.2, RZ = RAIL_Z + 3.4, RY = RAIL_Y + 0.6;
  const BOARD_PTS = [[-B, TOP, -B], [B, TOP, -B], [-B, TOP, B], [B, TOP, B], [-B, BASE, B + 0.5], [B, BASE, B + 0.5], [-B, RY, RZ], [B, RY, RZ], [-B, RY, -RZ], [B, RY, -RZ]];
  const HERO_PTS = [[-B, TOP, -B], [B, TOP, -B], [-B, BASE, B + 0.5], [B, BASE, B + 0.5]];
  const playCache = new Map();
  function playCam(rc) {
    const key = `${rc.x},${rc.y},${rc.w}|${cssW()}x${cssH()}|${cpu().toFixed(4)}`;
    let p = playCache.get(key);
    if (!p) {
      const land = cssW() > cssH();
      p = fit(rectCss(rc), BOARD_PTS, { yaw: 0, tilt: land ? 56 : 60, fov: 26, tx: 0, ty: TOP, tz: 0 });
      playCache.set(key, p); if (playCache.size > 24) playCache.delete(playCache.keys().next().value);
    }
    return p;
  }

  // The board plane (y = TOP) as the live camera sees it, as a homography world (x, z) -> virtual units. Recomputed once per frame
  // after the camera is placed, so taps, trails and rings use exactly what is on screen.
  let H8 = null, hKey = 0;
  const q0 = { x: 0, y: 0 };
  function updateH() {
    const g = [[-2, -2], [7, -2], [7, 7], [-2, 7]], src = [], dst = [];
    for (const [a, b] of g) { const w = gridPos(a, b); src.push([w.x, w.z]); const v = virt(toCss(camera, w.x, TOP, w.z, q0)); dst.push([v.x, v.y]); }
    H8 = homography(src, dst); hKey++;
  }
  const apply = (x, z) => { const h = H8, d = h[6] * x + h[7] * z + 1; return [(h[0] * x + h[1] * z + h[2]) / d, (h[3] * x + h[4] * z + h[5]) / d]; };
  v3.geo = (x, y, side, flip) => {
    if (!H8) updateH();
    const f = Boolean(flip);
    const pt = (c, r) => { const w = gridPos(c, r, f); return apply(w.x, w.z); };
    const sp = (c, r) => { const a = pt(c - 0.5, r), b = pt(c + 0.5, r), e = pt(c, r - 0.5), g = pt(c, r + 0.5); return [Math.hypot(b[0] - a[0], b[1] - a[1]), Math.hypot(g[0] - e[0], g[1] - e[1])]; };
    const [hx, vy] = sp(2.5, 2.5), u = (hx + vy) / 2;
    // nearest board point under (px, py) by the local ellipse of its cell; -1 when none is close enough
    const hit = (px, py) => {
      let best = -1, bd = 0.66;
      for (let i = 0; i < 36; i++) {
        const c = i % 6, r = Math.floor(i / 6), p = pt(c, r), s = sp(c, r), d = Math.hypot((px - p[0]) / s[0], (py - p[1]) / s[1]);
        if (d < bd) { bd = d; best = i; }
      }
      return best;
    };
    return { x, y, side, u, flip: f, pt, d: u * 0.74, hit, p3: true, key: `3d${hKey}` };
  };

  // ---------------------------------------------------------------- stones
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
  const counts = {}; let nBlob = 0;
  const dbg = qs.has('dev') ? [] : null;               // dev only: every stone placed this frame (motion checks)
  const begin = () => { for (const k in inst) counts[k] = 0; nBlob = 0; if (dbg) dbg.length = 0; };
  function put(who, x, y, z, yaw, tx = 0, tz = 0, sc = 1, sy = 1, ground = null) {
    if (sc < 0.01) return;
    const key = String(who), m = inst[key]; if (counts[key] >= CAP) return;
    _e.set(tx, yaw, tz, 'YXZ'); _q.setFromEuler(_e); _s.set(sc, sc * sy, sc); _p.set(x, y, z);
    _m.compose(_p, _q, _s); m.setMatrixAt(counts[key]++, _m);
    if (dbg) dbg.push([who, x, y, z]);
    if (who === 2 && counts.gold < CAP) inst.gold.setMatrixAt(counts.gold++, _m);
    if (nBlob < CAP) {
      const g0 = ground ?? TOP, lift = Math.max(0, y - g0), s = PR * 2.6 * sc * (1 + lift * 0.1);
      _p.set(x + 0.2 + lift * 0.2, g0 + 0.03, z + 0.18 + lift * 0.16); _q.identity(); _s.set(s, 1, s); blobs.setMatrixAt(nBlob++, _m.compose(_p, _q, _s));
    }
  }
  function end() {
    for (const k in inst) { inst[k].count = counts[k]; inst[k].instanceMatrix.needsUpdate = true; }
    blobs.count = nBlob; blobs.instanceMatrix.needsUpdate = true;
  }
  const yawOf = (i, who) => hash(i, who * 17) * 6.283;
  const slotPos = (rail, j) => { const x = (j - 5.5) * SLOT; return { x: rail ? -x : x, z: rail ? -RAIL_Z : RAIL_Z }; };
  const railOf = (captor, flip) => ((captor === 1) !== Boolean(flip) ? 0 : 1);

  let clock = 0;
  const flyingPrev = new Map(), settled = new Map(), flights = new Map(), fired = new Set();
  function drawPieces(list, playMode) {
    begin();
    const onBoard = { 1: 0, 2: 0 }, pending = { 1: 0, 2: 0 };
    let flip = false;
    const seen = new Set(), keysNow = new Set();
    for (const pc of list) {
      flip = Boolean(pc.flip);
      const sc = pc.sc ?? 1;
      if (pc.cap != null) {
        const w = pointPos(pc.i, pc.flip), key = `${pc.i}|${pc.who}`;
        keysNow.add(key);
        if (playMode) {
          // a captured stone waits (trembling) until the capturer has arrived, then leaves for its captor's rail
          if (pc.cap === 'go' && !flights.has(key) && !fired.has(key)) { flights.set(key, { who: pc.who, x: w.x, z: w.z, bk: railOf(pc.who === 1 ? 2 : 1, pc.flip), t0: clock, yaw: yawOf(pc.i, pc.who) }); fired.add(key); }
          if (flights.has(key) || fired.has(key)) continue;
          pending[pc.who]++;
          const tr = Math.sin(clock * 38) * 0.05;
          put(pc.who, w.x + tr, TOP + 0.12, w.z, yawOf(pc.i, pc.who), 0, 0, sc);
        } else {
          // attract loop on the title: the stone is lifted off and fades
          const e = sm(clamp(pc.cap, 0, 1)); pending[pc.who]++;
          put(pc.who, w.x, TOP + e * 5, w.z, yawOf(pc.i, pc.who) + e * 2, e * 0.5, 0, sc * (1 - e));
        }
        continue;
      }
      onBoard[pc.who]++;
      const w = pointPos(pc.i, pc.flip);
      const key = `${pc.i}`; seen.add(key);
      if (pc.a) {
        // the capturer glides along its circuit (round the loops too), a hair above the board, leaning into the turn
        const p = pc.a.g ? gridPos(pc.a.g[0], pc.a.g[1], pc.flip) : w, q = pc.a.g2 ? gridPos(pc.a.g2[0], pc.a.g2[1], pc.flip) : w;
        const dx = q.x - p.x, dz = q.z - p.z, L = Math.hypot(dx, dz) || 1, k = clamp(pc.a.k, 0, 1), cap = pc.a.kind === 'cap';
        const lift = cap ? 0.35 + Math.sin(Math.PI * k) * 0.55 : Math.sin(Math.PI * k) * 0.5;
        const lean = (cap ? 0.16 : 0.08) * Math.sin(Math.PI * Math.min(1, k * 1.1));
        put(pc.who, p.x, TOP + lift, p.z, yawOf(pc.a.from, pc.who) + k * 3, (dz / L) * lean, -(dx / L) * lean, sc);
        flyingPrev.set(key, cap);
        continue;
      }
      if (flyingPrev.has(key)) { const cap = flyingPrev.get(key); flyingPrev.delete(key); settled.set(key, { t0: clock, amp: cap ? 1 : 0.5 }); if (cap) puff(w.x, w.z, 0.9); }
      let y = TOP, tx = 0, sy = 1;
      const st = settled.get(key);
      if (st) {
        const s = (clock - st.t0) / SETTLE;
        if (s >= 1) settled.delete(key);
        else { const d = (1 - s) * (1 - s); y += Math.abs(Math.sin(s * Math.PI * 2)) * 0.3 * d * st.amp; sy = 1 - Math.sin(Math.min(1, s * 4) * Math.PI) * 0.07 * st.amp; tx = Math.sin(s * Math.PI * 4) * 0.06 * d * st.amp; }
      }
      if (pc.sel) y += 0.9 + Math.sin(clock * 4) * 0.18;
      put(pc.who, w.x, y, w.z, yawOf(pc.i, pc.who), tx, 0, sc, sy);
    }
    for (const k of flyingPrev.keys()) if (!seen.has(k)) flyingPrev.delete(k);
    for (const k of [...fired]) if (!keysNow.has(k) && !flights.has(k)) fired.delete(k);
    // flights to the rails; a finished flight becomes a settled prisoner
    const active = { 1: 0, 2: 0 };
    for (const [key, f] of [...flights]) { if (clock - f.t0 >= FLIGHT) { flights.delete(key); if (!keysNow.has(key)) fired.delete(key); } else active[f.who]++; }
    const tot = v3.totals, taken = { 1: 0, 2: 0 };
    for (const who of [1, 2]) taken[who] = playMode ? clamp((tot[who] ?? 12) - onBoard[who] - pending[who] - active[who], 0, 12) : 0;
    const order = { 1: 0, 2: 0 };
    for (const f of flights.values()) {
      const e = sm((clock - f.t0) / FLIGHT), j = clamp(taken[f.who] + order[f.who]++, 0, 11), d = slotPos(f.bk, j);
      const arc = Math.sin(Math.PI * e) * 9;
      put(f.who, f.x + (d.x - f.x) * e, TOP + (SOCKET_Y - TOP) * e + arc, f.z + (d.z - f.z) * e, f.yaw + e * 2.4, e * 0.6 * (1 - e), e * 0.4 * (1 - e), 1, 1, TOP);
    }
    // the rails: each holds the stones its owner has taken, in the order they were taken
    for (const who of [1, 2]) {
      const bk = railOf(who === 1 ? 2 : 1, flip);
      for (let j = 0; j < taken[who]; j++) { const d = slotPos(bk, j); put(who, d.x, SOCKET_Y, d.z, hash(j, who) * 6.28, 0, 0, 1, 1, RAIL_Y + RAIL_TOP); }
    }
    end();
  }
  function drawMarks(list) {
    let k = 0;
    const occ = new Set(v3.pieces.filter((p) => p.cap == null && !p.a).map((p) => `${p.i}|${p.flip ? 1 : 0}`));
    for (const mk of list) {
      if (k >= marks.length || mk.i < 0 || mk.i >= 36) continue;
      const m = marks[k++], w = pointPos(mk.i, mk.flip);
      let r = mk.r * 0.74 * SP;
      if (!mk.fill && occ.has(`${mk.i}|${mk.flip ? 1 : 0}`)) r = Math.max(r, PR * 1.28);
      const s = r * 2 * (mk.fill ? 1.35 : 1.18);
      m.visible = true; m.position.set(w.x, TOP + 0.08, w.z); m.scale.set(s, 1, s);
      m.material.map = mk.fill ? discT : ringT;
      const [cr, cg, cb] = parseCol(mk.col), a = clamp(mk.a ?? 1, 0, 1) * (mk.fill ? 1.1 : 1);
      m.material.color.setRGB(cr * cr * a * 1.3, cg * cg * a * 1.3, cb * cb * a * 1.3);
    }
    for (; k < marks.length; k++) marks[k].visible = false;
  }

  // ---------------------------------------------------------------- per frame
  let loseExt = null;
  let game = null, lost = false, lastNow = 0, frameAvg = 16, slowFrames = 0, fadeIn = 0, mode = '';
  function framing(state, L, t) {
    if ((state.scene === 'play' || state.scene === 'auto') && state.match) {
      const P = L.play(TEXT_SCALES[state.textIdx] ?? 1, state.scene === 'auto');
      // tablets: the rails may tuck under the plates, so the board itself can be larger
      const e = Math.min(cssW(), cssH()) >= 600 ? 0.16 * P.board.side : 0.04 * P.board.side;
      return { m: 'play', p: playCam({ x: P.board.x - e / 2, y: P.board.y - e / 2, w: P.board.side + e, h: P.board.side + e }) };
    }
    if (state.scene === 'title' && !state.overlay) {
      const h = L.menu.hero, sc = h.sc;
      const g = L.mode === 'compact' ? 1.3 : 1, rc = { x: h.tx + (360 - 302 * g) * sc, y: h.ty + (330 - (g - 1) * 140) * sc, w: 604 * g * sc, h: 520 * g * sc };
      const base = { yaw: -9 + 6 * Math.sin(t * Math.PI * 2 / 34), tilt: 41 + 2.5 * Math.sin(t * Math.PI * 2 / 21), fov: 30, tx: 0, ty: TOP, tz: 0 };
      return { m: 'title', p: fit(rectCss(rc), HERO_PTS, base) };
    }
    // documents and menus without a board slot: the pendopo, the board at rest on its cloth under the lamp
    const U = L.U, land = L.wide;
    const base = { yaw: -20 + 5 * Math.sin(t * Math.PI * 2 / 40), tilt: 27, fov: 34, tx: 0, ty: TOP, tz: 0 };
    const pts = [[-B, TOP, -B], [B, TOP, -B], [-B, BASE, B + 0.5], [B, BASE, B + 0.5], [LAMP.x, 22, LAMP.z]];
    const r = land ? { x: U.x0 + U.w * 0.08, y: U.y0 + U.h * 0.2, w: U.w * 0.5, h: U.h * 0.62 } : { x: U.x0 + U.w * 0.06, y: U.y0 + U.h * 0.32, w: U.w * 0.88, h: U.h * 0.4 };
    return { m: 'env', p: fit(rectCss(r), pts, base) };
  }
  function pre() {
    if (!game || lost) return;
    const state = game.getState(), L = layoutFor(state.size[0], state.size[1]);
    const vk = `${cssW()}x${cssH()}|${state.size.join('x')}|${L.mode}`; if (vk !== viewKey) { viewKey = vk; snap = true; }
    if (state.theme && state.theme !== themeId) setTheme(state.theme);
    const now = performance.now(), dt = clamp((now - (lastNow || now)) / 1000, 0, 0.1);
    const goal = framing(state, L, clock);
    if (goal.m !== mode) { if (goal.m === 'play' || mode === '') snap = true; mode = goal.m; }
    const k = snap || goal.m === 'play' ? 1 : 1 - Math.exp(-dt * 4);
    for (const key of Object.keys(goal.p)) cur[key] += (goal.p[key] - cur[key]) * k;
    snap = false;
    place(camera, cur); updateH();
    v3.pieces.length = 0; v3.marks.length = 0;
  }
  function post() {
    if (!game || lost) return;
    const now = performance.now(), dt = clamp((now - (lastNow || now)) / 1000, 0, 0.1); lastNow = now; clock += dt;
    // screens without a board in play show the starting position at rest
    const list = v3.pieces.length || mode === 'play' ? v3.pieces : START.map((who, i) => (who ? { who, i } : null)).filter(Boolean);
    drawPieces(list, mode === 'play');
    drawMarks(mode === 'play' ? v3.marks : []);
    for (const m of dust) {
      const u = m.userData; if (!(u.t <= 0.6)) { m.visible = false; continue; }
      u.t += dt; const f = Math.min(1, u.t / 0.6), s = (2 + f * 6) * u.s;
      m.visible = true; m.position.set(u.x, TOP + 0.15 + f * 0.5, u.z); m.scale.set(s, 1, s); m.material.opacity = 0.45 * (1 - f) * (1 - f);
    }
    // the lamp is only drawn where the camera can see it well (menus, documents); its light always burns
    for (const c of lamp.children) if (!c.isLight) c.visible = mode === 'env';
    // the lamp breathes: a slow flicker of the flame
    const f = 1 + 0.06 * Math.sin(clock * 7.3) + 0.04 * Math.sin(clock * 13.1 + 1.7) + 0.02 * Math.sin(clock * 23.7);
    lamp.userData.light.intensity = 2600 * f; lamp.userData.halo.material.opacity = clamp(0.8 + (f - 1) * 1.4, 0, 1); lamp.userData.flame.scale.set(0.8 * (2 - f), 1.9 * f, 0.8 * (2 - f));
    if (fadeIn < 1) { fadeIn = Math.min(1, fadeIn + dt / 0.45); v3.fade = fadeIn; }
    renderer.setSize(cssW(), cssH(), false);
    renderer.render(scene, camera);
    const ft = dt * 1000; if (ft > 0) frameAvg = frameAvg * 0.95 + ft * 0.05;
    if (frameAvg > 26 && tier < 2) { if (++slowFrames > 90) { tier++; slowFrames = 0; frameAvg = 16; applyTier(); } } else slowFrames = 0;
  }

  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; v3.on = false; canvas.style.visibility = 'hidden'; });
  canvas.addEventListener('webglcontextrestored', () => {
    lost = false; buildEnv(); for (const b of boards.values()) { if (board === b) scene.remove(b); b.userData.dispose(); } boards.clear(); board = null; boardKey = '';
    applyTier(); fadeIn = 0; v3.fade = 0; v3.on = true; canvas.style.visibility = 'visible'; snap = true; playCache.clear();
  });

  await tick();
  place(camera, cur); try { renderer.compile(scene, camera); } catch { /* compiled lazily */ }
  await tick();

  return {
    ok: true, renderer, scene, camera,
    attach(g) { game = g; v3.on = true; v3.fade = 0; fadeIn = 0; canvas.style.visibility = 'visible'; snap = true; },
    pre, post,
    get tier() { return TIERS[tier].name; },
    get puts() { return dbg; },
    loseContext() { loseExt = renderer.getContext().getExtension('WEBGL_lose_context'); loseExt?.loseContext(); return Boolean(loseExt); },
    restoreContext() { loseExt?.restoreContext(); },
  };
}
