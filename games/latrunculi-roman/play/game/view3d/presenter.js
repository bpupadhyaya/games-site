// Ludus Latrunculorum 3D presenter. READS what the 2D layer shows (v3.frame, set by view.js each render: the match, the title's
// attract game, or a plain room view) and never writes game state. One WebGL canvas sits behind the kit's transparent 2D canvas:
// a marble tabula on a black marble table in a lamp-lit Roman room. The camera is fitted to the layout's board rectangle (play) or
// hero rectangle (title), so the 2D HUD keeps its places; taps reach the tilted board through v3.pick. No WebGL, ?flat=1 or a lost
// context: v3.on = false and every screen draws the flat 2D art; a restored context rebuilds the environment and returns to 3D.
import * as THREE from '../vendor3d/three.js';
import { v3 } from '../src/v3.js';
import { meta } from '../src/game.js';
import { CAP_T } from '../src/match.js';
import { N, C, HALF, FACE_Y, SOL_R, DUX_R, LAMP, cellPos, cellAtWorld, buildBoard, pieceGeos, pieceMaterials, buildRoom, buildLights, radialTex, hash } from './world.js';

const TAU = Math.PI * 2, D2R = Math.PI / 180, CAP = 40;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const sstep = (k) => k * k * (3 - 2 * k);
const TIERS = [{ name: 'high', dpr: 2, shadow: 2048, tex: 1024 }, { name: 'medium', dpr: 1.5, shadow: 1024, tex: 1024 }, { name: 'low', dpr: 1, shadow: 0, tex: 512 }];
const tick = () => new Promise((r) => setTimeout(r, 0));
const SIDE = [0, 1, 2, 1, 2];

// A slide along the board (same timing as the flat art): eased at both ends, a hair of lift, leaning into the move then settling back.
export function slidePose(k) {
  const e = sstep(k) * 0.6 + k * 0.4;
  return { e, lift: Math.sin(k * Math.PI) * 0.45, lean: 0.16 * Math.sin(k * Math.PI * 2) * (1 - k) };
}
// After landing: a small damped rock and rebound.
export function settlePose(t) {
  if (t < 0 || t > 0.36) return { y: 0, tilt: 0 };
  const s = t / 0.36, d = (1 - s) * (1 - s);
  return { y: Math.abs(Math.sin(s * Math.PI * 2)) * 0.12 * d, tilt: Math.sin(s * Math.PI * 3) * 0.07 * d };
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
  renderer.shadowMap.type = THREE.PCFShadowMap;
  let tier = qs.has('tier') ? clamp(Number(qs.get('tier')), 0, 2) : (navigator.hardwareConcurrency || 8) <= 4 ? 1 : 0;

  await tick();
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0c0807);
  scene.fog = new THREE.Fog(0x0c0807, 260, 900);
  const camera = new THREE.PerspectiveCamera(30, 1, 2, 3000);
  const lights = buildLights(scene);
  const buildEnv = () => { try { const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture; pm.dispose(); scene.environmentIntensity = 0.32; } catch { /* no IBL */ } };
  buildEnv();
  await tick();
  const room = buildRoom(scene, { quality: tier < 2 ? 1 : 0 });
  await tick();
  const geos = pieceGeos(), mats = pieceMaterials();
  const inst = {
    s1: new THREE.InstancedMesh(geos.sol, mats[1], CAP), s2: new THREE.InstancedMesh(geos.sol, mats[2], CAP),
    d1: new THREE.InstancedMesh(geos.dux, mats[1], 4), d2: new THREE.InstancedMesh(geos.dux, mats[2], 4),
    band: new THREE.InstancedMesh(geos.band, mats.gold, 8), stud: new THREE.InstancedMesh(geos.stud, mats.gold, 8),
  };
  for (const m of Object.values(inst)) { m.castShadow = true; m.receiveShadow = true; m.count = 0; m.frustumCulled = false; scene.add(m); }
  const flatQuad = new THREE.PlaneGeometry(1, 1); flatQuad.rotateX(-Math.PI / 2);
  const blobs = new THREE.InstancedMesh(flatQuad, new THREE.MeshBasicMaterial({ map: radialTex('0,0,0', 0.85), transparent: true, depthWrite: false, opacity: 0.55 }), CAP * 2);
  blobs.renderOrder = 2; blobs.frustumCulled = false; blobs.count = 0; scene.add(blobs);

  // ---- board marks (light / paint lying on the marble) -----------------------------------------------------------
  const mkT = (draw) => { const c = document.createElement('canvas'); c.width = c.height = 128; draw(c.getContext('2d')); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };
  const markTex = {
    fill: mkT((x) => { x.fillStyle = '#fff'; x.shadowColor = '#fff'; x.shadowBlur = 10; x.fillRect(10, 10, 108, 108); }),
    ring: mkT((x) => { x.strokeStyle = '#fff'; x.lineWidth = 9; x.shadowColor = '#fff'; x.shadowBlur = 8; x.strokeRect(12, 12, 104, 104); }),
    dot: mkT((x) => { x.fillStyle = '#fff'; x.shadowColor = '#fff'; x.shadowBlur = 10; x.beginPath(); x.arc(64, 64, 30, 0, TAU); x.fill(); }),
    cross: mkT((x) => { x.strokeStyle = '#fff'; x.lineCap = 'round'; x.lineWidth = 16; x.beginPath(); x.moveTo(30, 30); x.lineTo(98, 98); x.moveTo(98, 30); x.lineTo(30, 98); x.stroke(); }),
    circle: mkT((x) => { x.strokeStyle = '#fff'; x.lineWidth = 9; x.shadowColor = '#fff'; x.shadowBlur = 10; x.beginPath(); x.arc(64, 64, 52, 0, TAU); x.stroke(); }),
    glow: radialTex('255,255,255', 1),
  };
  const markPool = Array.from({ length: 140 }, () => { const m = new THREE.Mesh(flatQuad, new THREE.MeshBasicMaterial({ map: markTex.fill, transparent: true, depthWrite: false, fog: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2 })); m.renderOrder = 3; m.visible = false; m.userData.t = 'fill'; scene.add(m); return m; });
  const arrowMat = () => new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, fog: false, toneMapped: false, side: THREE.DoubleSide });
  const headShape = new THREE.Shape(); headShape.moveTo(0, 0.5); headShape.lineTo(1, 0); headShape.lineTo(0, -0.5); headShape.closePath();
  const headGeo = new THREE.ShapeGeometry(headShape); headGeo.rotateX(-Math.PI / 2);
  const arrows = Array.from({ length: 4 }, () => { const s = new THREE.Mesh(flatQuad, arrowMat()), h = new THREE.Mesh(headGeo, arrowMat()); s.renderOrder = h.renderOrder = 4; s.visible = h.visible = false; scene.add(s, h); return { s, h }; });

  // ---- particles: glints that fly from a taken soldier, marble dust where a counter lands ----------------------------
  const glintT = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,230,170,0.7)'); g.addColorStop(1, 'rgba(255,200,120,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); x.fillStyle = 'rgba(255,250,230,0.9)'; x.fillRect(31, 4, 2, 56); x.fillRect(4, 31, 56, 2); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const sparkGeo = new THREE.PlaneGeometry(1, 1);
  const sparks = Array.from({ length: 48 }, () => { const m = new THREE.Mesh(sparkGeo, new THREE.MeshBasicMaterial({ map: glintT, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); m.renderOrder = 6; m.visible = false; m.userData = { life: 0 }; scene.add(m); return m; });
  let sparkI = 0;
  const dustT = radialTex('235,225,205', 0.9);
  const dust = Array.from({ length: 12 }, () => { const m = new THREE.Mesh(flatQuad, new THREE.MeshBasicMaterial({ map: dustT, transparent: true, depthWrite: false })); m.renderOrder = 2; m.visible = false; m.userData = { t: 9 }; scene.add(m); return m; });
  let dustI = 0;
  const puff = (x, z, s = 1) => { const m = dust[dustI++ % dust.length]; m.userData = { t: 0, x, z, s }; };
  const burst = (x, y, z, n, seed) => {
    for (let k = 0; k < n; k++) {
      const m = sparks[sparkI++ % sparks.length], a = hash(seed, k) * TAU, sp = 6 + hash(seed, k + 50) * 14;
      m.userData = { life: 0.55 + hash(seed, k + 90) * 0.5, age: 0, x, y, z, vx: Math.cos(a) * sp, vy: 8 + hash(seed, k + 7) * 14, vz: Math.sin(a) * sp, s: 0.7 + hash(seed, k + 3) * 0.9 };
    }
  };

  // ---- board (cached per theme + orientation) --------------------------------------------------------------------
  const boards = new Map(); let board = null, boardKey = '';
  function setBoard(themeId, flip) {
    const k = `${themeId}|${flip ? 1 : 0}|${TIERS[tier].tex}`; if (k === boardKey) return;
    let b = boards.get(k); if (!b) { b = buildBoard(themeId, flip, TIERS[tier].tex); boards.set(k, b); }
    if (board) scene.remove(board); board = b; boardKey = k; scene.add(b);
  }
  function applyTier() {
    const t = TIERS[tier];
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, t.dpr));
    renderer.shadowMap.enabled = t.shadow > 0; lights.key.castShadow = t.shadow > 0;
    if (t.shadow) { lights.key.shadow.mapSize.set(t.shadow, t.shadow); if (lights.key.shadow.map) { lights.key.shadow.map.dispose(); lights.key.shadow.map = null; } }
    blobs.material.opacity = t.shadow ? 0.5 : 0.7;
    scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => { m.needsUpdate = true; }); });
  }
  applyTier();

  // ---- camera: yaw/tilt/fov per screen, distance + off-axis shift fitted to a rectangle (css px) ----------------------
  const cur = { yaw: 0, tilt: 58, fov: 30, dist: 140, ox: 0, oy: 0, tx: 0, ty: FACE_Y, tz: 0 };
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
  const toCss = (cam, x, y, z, out) => { _v.set(x, y, z).project(cam); out.x = (_v.x + 1) / 2 * cssW(); out.y = (1 - _v.y) / 2 * cssH(); return out; };
  function fit(rc, pts, base) {
    const p = { ...base, ox: 0, oy: 0, dist: 140 }, q = { x: 0, y: 0 }; let bb = null;
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

  // ---- v3 hooks --------------------------------------------------------------------------------------------------
  const ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -FACE_Y), hit = new THREE.Vector3(), ndc = new THREE.Vector2();
  let pickFlip = false;
  v3.pick = (vx, vy) => {
    ndc.set(((vx * cpu() + offX()) / cssW()) * 2 - 1, 1 - ((vy * cpu() + offY()) / cssH()) * 2);
    ray.setFromCamera(ndc, camera);
    if (!ray.ray.intersectPlane(plane, hit)) return -1;
    return cellAtWorld(hit.x, hit.z, pickFlip);
  };

  // ---- pieces ----------------------------------------------------------------------------------------------------
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
  const counts = {}; let nBlob = 0;
  const begin = () => { for (const k in inst) counts[k] = 0; nBlob = 0; };
  const restY = FACE_Y;
  function put(code, x, y, z, yaw = 0, tiltX = 0, tiltZ = 0, sc = 1, blobK = 1, floor = restY) {
    const who = SIDE[code], dux = code >= 3, key = (dux ? 'd' : 's') + who, m = inst[key]; if (!m || counts[key] >= m.instanceMatrix.count) return;
    _e.set(tiltX, yaw, tiltZ, 'YXZ'); _q.setFromEuler(_e); _s.set(sc, sc, sc); _p.set(x, y, z); _m.compose(_p, _q, _s);
    m.setMatrixAt(counts[key]++, _m);
    if (dux) { inst.band.setMatrixAt(counts.band++, _m); inst.stud.setMatrixAt(counts.stud++, _m); }
    if (blobK > 0.02 && nBlob < CAP * 2) {
      const lift = Math.max(0, y - floor), r = (dux ? DUX_R : SOL_R) * 2.7 * sc * (1 + lift * 0.12) * blobK;
      _p.set(x + 0.25 + lift * 0.35, floor + 0.02, z + 0.3 + lift * 0.4); _q.identity(); _s.set(r, 1, r); blobs.setMatrixAt(nBlob++, _m.compose(_p, _q, _s));
    }
  }
  function end() { for (const k in inst) { inst[k].count = counts[k]; inst[k].instanceMatrix.needsUpdate = true; } blobs.count = nBlob; blobs.instanceMatrix.needsUpdate = true; }
  const yawOf = (i) => (hash(i, 41) - 0.5) * 0.6;
  // taken soldiers are stacked on the table beside the board, three to a stack, on the side of the player who took them
  const traySlot = (takerBottom, k) => {
    const st = Math.floor(k / 3), lv = k % 3, col = st % 2, row = Math.floor(st / 2);
    const sx = takerBottom ? 1 : -1;
    return { x: sx * (HALF + 4.0 + col * 3.8), y: 0.01 + lv * 1.2, z: sx * (HALF - 3.2 - row * 3.8) };
  };

  let clock = 0, fdt = 0;
  const landed = new WeakSet(), burstDone = new WeakSet();
  // a selected counter rises a little; the rise is eased (no pop up or down), per square
  const selLift = new Float32Array(64);
  const easeLift = (sel) => { const k = 1 - Math.exp(-fdt * 14); for (let i = 0; i < 64; i++) selLift[i] += ((i === sel ? 0.9 : 0) - selLift[i]) * k; };
  function drawMatch(f) {
    const M = f.M, st = M.st, cells = st.cells, flip = !!f.flip, bottom = flip ? 2 : 1;
    begin();
    easeLift(f.sel);
    const ghosts = M.ghosts || [];
    for (let i = 0; i < cells.length; i++) {
      const code = cells[i]; if (!code) continue;
      const p = cellPos(i, flip), a = M.anim ? M.anim[i] : null;
      let x = p.x, z = p.z, y = restY, tx = 0, tz = 0;
      if (a && a.from >= 0 && a.t < a.dur) {
        const q = cellPos(a.from, flip), k = clamp(a.t / a.dur, 0, 1), P = slidePose(k), dx = p.x - q.x, dz = p.z - q.z, L = Math.hypot(dx, dz) || 1;
        x = q.x + dx * P.e; z = q.z + dz * P.e; y += P.lift + selLift[a.from] * (1 - P.e); tx = (dz / L) * P.lean; tz = -(dx / L) * P.lean;
      } else if (a && a.from >= 0) {
        const S = settlePose(a.t - a.dur); y += S.y; tz = S.tilt;
        if (!landed.has(a)) { landed.add(a); puff(p.x, p.z, code >= 3 ? 1.2 : 1); }
      }
      y += selLift[i] * (1 + Math.sin(clock * 4) * 0.13);
      // the enclosed dux topples over once the closing move lands
      if (M.enclose && M.enclose.cell === i && f.over) {
        const k = clamp((M.enclose.t - M.enclose.delay) / 0.6, 0, 1), e = 1 - Math.pow(1 - k, 3);
        put(code, x + e * 0.9, y + e * 0.9, z + e * 0.4, yawOf(i), 0, -e * 1.25); continue;
      }
      put(code, x, y, z, yawOf(i), tx, tz);
    }
    // taken soldiers: lifted off the board once the sandwich closes and carried to their stack beside the board
    const lost = { 1: 15, 2: 15 };
    for (const c of cells) if (c === 1 || c === 2) lost[c]--;
    const pending = { 1: 0, 2: 0 };
    for (const g of ghosts) if (g.code === 1 || g.code === 2) pending[g.code]++;
    const placed = { 1: Math.max(0, lost[1] - pending[1]), 2: Math.max(0, lost[2] - pending[2]) };
    for (const w of [1, 2]) for (let k = 0; k < placed[w]; k++) { const s = traySlot(w !== bottom, k); put(w, s.x, s.y, s.z, hash(k, w) * 0.8, 0, 0, 1, 0.8, 0); }
    const seen = { 1: 0, 2: 0 };
    for (const g of ghosts) {
      const p = cellPos(g.cell, flip), w = g.code;
      if (g.t < g.delay) { put(g.code, p.x, restY, p.z, yawOf(g.cell)); if (w === 1 || w === 2) seen[w]++; continue; }
      if (!burstDone.has(g)) { burstDone.add(g); burst(p.x, restY + 1, p.z, 10, g.cell * 7 + Math.round(clock * 10)); puff(p.x, p.z, 1.4); }
      const k = clamp((g.t - g.delay) / CAP_T, 0, 1), e = sstep(k);
      if (w === 1 || w === 2) {
        const s = traySlot(w !== bottom, placed[w] + seen[w]++);
        put(w, p.x + (s.x - p.x) * e, restY + (s.y - restY) * e + Math.sin(k * Math.PI) * 7, p.z + (s.z - p.z) * e, yawOf(g.cell) + e * 2.4, Math.sin(k * Math.PI) * 0.6, 0, 1, 1 - Math.sin(k * Math.PI) * 0.5, restY + (0 - restY) * e);
      } else put(g.code, p.x, restY + e * 3, p.z, 0, 0, 0, Math.max(0.01, 1 - e));
    }
    end();
  }
  // the title's attract game: { cells, moving: { from, to, k, code }, ghosts: [{ cell, code, k }] }
  function drawAttract(att) {
    begin();
    const cells = att.cells;
    for (let i = 0; i < cells.length; i++) if (cells[i]) { const p = cellPos(i); put(cells[i], p.x, restY, p.z, yawOf(i)); }
    for (const g of att.ghosts) { const p = cellPos(g.cell), e = sstep(g.k); put(g.code, p.x, restY + Math.sin(g.k * Math.PI) * 5, p.z + e * 6, yawOf(g.cell) + e * 2, e * 0.5, 0, Math.max(0.01, 1 - e * e)); }
    if (att.moving) { const a = cellPos(att.moving.from), b = cellPos(att.moving.to), P = slidePose(att.moving.k); put(att.moving.code, a.x + (b.x - a.x) * P.e, restY + P.lift, a.z + (b.z - a.z) * P.e, yawOf(att.moving.from)); }
    end();
  }

  // on the white Carrara slab light marks wash out: deepen them and make them more opaque there
  let lightBoard = false;
  const tone = (rgb, a, t) => { const c = rgb.split(',').map((v) => Number(v) / 255); if (!lightBoard || t === 'glow') return [c, a]; return [c.map((v) => v * 0.78), Math.min(1, a * (t === 'fill' ? 2.1 : 1.4))]; };
  function drawMarks(flip) {
    let k = 0;
    for (const mk of v3.marks) {
      if (k >= markPool.length || mk.i < 0 || mk.i >= N * N) continue;
      const m = markPool[k++], p = cellPos(mk.i, flip), t = mk.type, s = C * (mk.grow ?? (t === 'dot' ? 0.3 : t === 'cross' ? 0.5 : t === 'circle' ? 0.95 : t === 'glow' ? 1.25 : 0.94));
      m.visible = true; if (m.userData.t !== t) { m.material.map = markTex[t] || markTex.fill; m.material.needsUpdate = true; m.userData.t = t; }
      m.position.set(p.x, FACE_Y + (t === 'cross' ? 1.7 : t === 'circle' ? 0.06 : 0.02), p.z); m.scale.set(s, 1, s);
      const [[r, g, b], a] = tone(mk.rgb, mk.a, t);
      m.material.color.setRGB(r, g, b); m.material.opacity = clamp(a, 0, 1);
      m.material.blending = t === 'glow' ? THREE.AdditiveBlending : THREE.NormalBlending;
      m.renderOrder = t === 'cross' ? 7 : 3; m.material.depthTest = t !== 'cross';
    }
    for (; k < markPool.length; k++) markPool[k].visible = false;
    let j = 0;
    for (const ar of v3.arrows) {
      if (j >= arrows.length) break;
      const A = arrows[j++], a = cellPos(ar.from, flip), b = cellPos(ar.to, flip), dx = b.x - a.x, dz = b.z - a.z, L = Math.hypot(dx, dz) || 1, ux = dx / L, uz = dz / L;
      const pad = C * 0.38, head = C * 0.42, x0 = a.x + ux * pad, z0 = a.z + uz * pad, x1 = b.x - ux * pad, z1 = b.z - uz * pad, len = Math.max(0.1, Math.hypot(x1 - x0, z1 - z0) - head);
      const [[r, g, bl], aa] = tone(ar.rgb, ar.a, 'arrow'), yaw = Math.atan2(-uz, ux);
      A.s.visible = A.h.visible = true;
      A.s.position.set(x0 + ux * len / 2, FACE_Y + 2.0, z0 + uz * len / 2); A.s.rotation.set(0, yaw, 0); A.s.scale.set(len, 1, C * 0.2);
      A.h.position.set(x0 + ux * len, FACE_Y + 2.0, z0 + uz * len); A.h.rotation.set(0, yaw, 0); A.h.scale.set(head * 1.15, 1, C * 0.52);
      for (const o of [A.s, A.h]) { o.material.color.setRGB(r * (lightBoard ? 0.8 : 1), g * (lightBoard ? 0.8 : 1), bl * (lightBoard ? 0.8 : 1)); o.material.opacity = clamp(aa, 0, 1); }
    }
    for (; j < arrows.length; j++) arrows[j].s.visible = arrows[j].h.visible = false;
  }

  // ---- per frame -------------------------------------------------------------------------------------------------
  let game = null, lost = false, lastNow = 0, frameAvg = 16, slowFrames = 0, fadeIn = 0, lastKind = '';
  function framing(f) {
    const t = clock, drift = f.calm ? 0 : 1, e = HALF;
    if (f.kind === 'board') {
      const B = f.rect, rc = rectCss({ x: B.x, y: B.y, w: B.side, h: B.side });
      const pts = [[-e, FACE_Y, -e], [e, FACE_Y, -e], [-e, FACE_Y, e], [e, FACE_Y, e], [-e, 0.2, e + 0.4], [e, 0.2, e + 0.4]];
      return fit(rc, pts, { yaw: 0, tilt: f.wide ? 54 : 60, fov: 28, tx: 0, ty: FACE_Y, tz: 0 });
    }
    if (f.kind === 'title') {
      const rc = rectCss(f.hero), mx = rc.w * 0.05, my = rc.h * 0.04; rc.x += mx; rc.w -= 2 * mx; rc.y += my; rc.h -= 2 * my;
      const tall = f.hero.h > f.hero.w * 0.85;
      const pts = tall ? [[-e, FACE_Y, -e], [e, FACE_Y, -e], [-e, 0, e], [e, 0, e]] : [[-e, FACE_Y, -e], [e, FACE_Y, -e], [-e, 0, e], [e, 0, e], [LAMP.x + 4, LAMP.y + 6, LAMP.z], [-36, 0, 12]];
      const base = { yaw: -14 + 7 * Math.sin(t * TAU / 34) * drift, tilt: (tall ? 33 : 26) + 3 * Math.sin(t * TAU / 21) * drift, fov: 30, tx: 0, ty: FACE_Y * 0.7, tz: 0 };
      return fit(rc, pts, base);
    }
    const rc = { x: 0, y: cssH() * 0.15, w: cssW(), h: cssH() * 0.7 };
    const pts = [[-e - 20, 0, -e], [e + 20, 0, -e], [-e - 20, 0, e], [e + 20, 0, e]];
    return fit(rc, pts, { yaw: 24 + 10 * Math.sin(t * TAU / 40) * drift, tilt: 30, fov: 34, tx: 0, ty: FACE_Y, tz: 0 });
  }
  const _cq = new THREE.Vector3();
  function pre() { if (!game || lost) return; v3.marks.length = 0; v3.arrows.length = 0; }
  function post() {
    if (!game || lost) return;
    const now = performance.now(), dt = clamp((now - (lastNow || now)) / 1000, 0, 0.1); lastNow = now; clock += dt; fdt = dt;
    const f = v3.frame || { kind: 'env', theme: 'carrara' }, board = f.kind === 'board';
    setBoard(f.theme || 'carrara', board && f.flip); lightBoard = (f.theme || 'carrara') === 'carrara';
    pickFlip = board && !!f.flip;
    const vk = `${cssW()}x${cssH()}|${meta.width}x${meta.height}`; if (vk !== viewKey) { viewKey = vk; snap = true; }
    if (f.kind !== lastKind) { lastKind = f.kind; snap = true; }
    const goal = framing(f);
    const k = snap || board ? 1 : 1 - Math.exp(-dt * 4);
    for (const key of Object.keys(goal)) cur[key] += (goal[key] - cur[key]) * k;
    snap = false;
    place(camera, cur);
    if (board) drawMatch(f); else if (f.kind === 'title' && f.att) drawAttract(f.att); else { begin(); end(); }
    if (!board) { v3.marks.length = 0; v3.arrows.length = 0; }
    drawMarks(pickFlip);
    for (const m of sparks) {
      const u = m.userData; if (!(u.life > 0) || u.age >= u.life) { m.visible = false; continue; }
      u.age += dt; u.vy -= 40 * dt; u.x += u.vx * dt; u.y += u.vy * dt; u.z += u.vz * dt; if (u.y < FACE_Y + 0.2) { u.y = FACE_Y + 0.2; u.vy *= -0.35; u.vx *= 0.6; u.vz *= 0.6; }
      const fa = 1 - u.age / u.life;
      m.visible = true; m.position.set(u.x, u.y, u.z); m.quaternion.copy(camera.quaternion); m.scale.setScalar(u.s * (0.6 + fa * 0.6)); m.material.opacity = fa;
    }
    for (const m of dust) {
      const u = m.userData; if (!(u.t <= 0.55)) { m.visible = false; continue; }
      u.t += dt; const q = Math.min(1, u.t / 0.55), s = (2.2 + q * 4.5) * u.s;
      m.visible = true; m.position.set(u.x, FACE_Y + 0.05 + q * 0.4, u.z); m.scale.set(s, 1, s); m.material.opacity = 0.42 * (1 - q) * (1 - q);
    }
    // flames turn to the camera and flicker; the lamp light breathes with them
    camera.getWorldPosition(_cq);
    for (const fl of room.flames) { fl.rotation.set(0, Math.atan2(_cq.x - fl.position.x, _cq.z - fl.position.z), 0); fl.material.uniforms.uT.value = clock; }
    for (const h of room.halos) h.quaternion.copy(camera.quaternion);
    const fk = 1 + 0.06 * Math.sin(clock * 11.3) + 0.04 * Math.sin(clock * 17.9 + 1.3) + 0.03 * Math.sin(clock * 5.1);
    lights.lamp.intensity = lights.lamp.userData.base * fk; lights.cand.intensity = lights.cand.userData.base * (2 - fk);
    if (fadeIn < 1) { fadeIn = Math.min(1, fadeIn + dt / 0.45); v3.fade = fadeIn; }
    renderer.setSize(cssW(), cssH(), false);
    renderer.render(scene, camera);
    const ft = dt * 1000; if (ft > 0) frameAvg = frameAvg * 0.95 + ft * 0.05;
    if (frameAvg > 26 && tier < 2) { if (++slowFrames > 90) { tier++; slowFrames = 0; frameAvg = 16; applyTier(); boardKey = ''; } } else slowFrames = 0;
  }

  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; v3.on = false; canvas.style.visibility = 'hidden'; });
  canvas.addEventListener('webglcontextrestored', () => {
    lost = false; buildEnv(); for (const b of boards.values()) { scene.remove(b); b.userData.dispose(); } boards.clear(); board = null; boardKey = '';
    applyTier(); fadeIn = 0; v3.fade = 0; v3.on = true; canvas.style.visibility = 'visible'; snap = true;
  });

  await tick();
  setBoard('carrara', false); await tick();
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
