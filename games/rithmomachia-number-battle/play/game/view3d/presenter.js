// Rithmomachia 3D presenter. READS the game state (game.getState()), never writes it. One WebGL canvas sits behind the kit's transparent
// 2D canvas: the illuminated board on a scholar's desk by candlelight. The camera is fitted to the layout's board rectangle (play) or the
// title's hero rectangle, so the 2D HUD, badges and taps line up with the tilted board through v3.pt / v3.pick. No WebGL, ?flat=1 or a lost
// context: v3.on = false and every screen draws the flat 2D art; a restored context rebuilds the environment and returns to 3D.
import * as THREE from '../vendor3d/three.js';
import { v3 } from '../src/v3.js';
import { meta } from '../src/game.js';
import { layoutFor } from '../src/layout.js';
import { newGame, startBoard, sideOf, shapeOf, valOf } from '../src/rules.js';
import { S, TOP, PH, HX, HZ, sqPos, buildBoard, pieceGeos, pieceMaterials, numberMaterial, clearNumberCache, buildDesk, buildLights, radialTex } from './world.js';

const TAU = Math.PI * 2, D2R = Math.PI / 180;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = (f) => f * f * (3 - 2 * f);
const TIERS = [{ name: 'high', dpr: 2, shadow: 2048, tex: 2048 }, { name: 'medium', dpr: 1.5, shadow: 1024, tex: 2048 }, { name: 'low', dpr: 1, shadow: 0, tex: 1024 }];
const tick = () => new Promise((r) => setTimeout(r, 0));
const BOARD_SCENES = new Set(['play', 'over', 'lesson']);
const SETTLE = 0.38;

// A landed piece: a small damped bounce and rock (pure, sampled at 60 Hz by the smoothness check).
export function settlePose(t) {
  if (t >= SETTLE || t < 0) return { y: 0, tilt: 0 };
  const s = t / SETTLE, d = (1 - s) * (1 - s);
  return { y: Math.abs(Math.sin(s * Math.PI * 2)) * 0.32 * d, tilt: Math.sin(s * Math.PI * 3) * 0.07 * d };
}
// The moving piece over its glide: lift off, arc (higher for longer jumps), lean into the travel, touch down.
export function glidePose(f, dist, calm) {
  const e = ease(f), h = (calm ? 0.8 : 1.6) + Math.min(3.2, dist * 0.55);
  return { e, lift: Math.sin(Math.PI * e) * h, lean: calm ? 0 : 0.22 * Math.sin(Math.PI * e) * (e < 0.5 ? 1 : -0.7) };
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
  scene.background = new THREE.Color(0x140c09);
  scene.fog = new THREE.Fog(0x140c09, 260, 620);
  const camera = new THREE.PerspectiveCamera(30, 1, 2, 2000);
  const lights = buildLights(scene);
  const buildEnv = () => { try { const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture; pm.dispose(); scene.environmentIntensity = 0.32; } catch { /* no IBL */ } };
  buildEnv();
  await tick();
  const desk = buildDesk(scene);
  await tick();
  let board = buildBoard(TIERS[tier].tex); scene.add(board);
  await tick();
  const geos = pieceGeos(), mats = pieceMaterials();
  const blobGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), blobMat = new THREE.MeshBasicMaterial({ map: radialTex('0,0,0', 0.85), transparent: true, depthWrite: false, opacity: 0.5 });
  let camYaw = 0;

  // ---------------------------------------------------------------- piece pool (one group per piece shown this frame)
  const pool = new Map(); let used = new Map();
  function makePiece(code) {
    const side = sideOf(code), sh = shapeOf(code), G = geos[sh], grp = new THREE.Group();
    const body = new THREE.Mesh(G.body, mats[side]); body.castShadow = true; body.receiveShadow = true;
    const inlay = new THREE.Mesh(G.inlay, mats.gold); inlay.receiveShadow = true;
    const decal = new THREE.Mesh(G.decal, numberMaterial(side, valOf(code))); decal.renderOrder = 2;
    const tilt = new THREE.Group(); tilt.add(body, inlay);
    const dec = new THREE.Group(); dec.add(decal); tilt.add(dec);
    const blob = new THREE.Mesh(blobGeo, blobMat); blob.renderOrder = 1;
    grp.add(tilt); scene.add(grp, blob);
    return { grp, tilt, dec, blob, code };
  }
  function acquire(code) {
    let list = pool.get(code); if (!list) { list = []; pool.set(code, list); }
    const n = used.get(code) || 0; used.set(code, n + 1);
    if (!list[n]) list[n] = makePiece(code);
    return list[n];
  }
  // place a piece: world x/z, lift above `base` (board top), yaw (triangle direction), tilt, scale
  function put(code, x, z, { lift = 0, base = TOP, yaw = null, tiltX = 0, tiltZ = 0, sc = 1 } = {}) {
    const p = acquire(code), side = sideOf(code);
    p.grp.visible = true; p.grp.position.set(x, base + lift, z); p.grp.scale.setScalar(Math.max(0.001, sc));
    p.tilt.rotation.set(tiltX, yaw ?? (side === 1 ? 0 : Math.PI), tiltZ, 'YXZ');
    p.dec.rotation.y = camYaw * D2R - p.tilt.rotation.y;                 // numbers always read upright from the camera
    const bs = (sc * 4.4) * (1 + lift * 0.08);
    p.blob.visible = true; p.blob.position.set(x + lift * 0.25, Math.min(base, TOP) + 0.03 + (base < TOP ? base : 0) * 0, z + lift * 0.3); p.blob.scale.set(bs, 1, bs);
    if (base !== TOP) p.blob.position.y = base + 0.03;
    return p;
  }
  function endPieces() {
    for (const [code, list] of pool) { const n = used.get(code) || 0; for (let k = n; k < list.length; k++) { list[k].grp.visible = false; list[k].blob.visible = false; } }
    used = new Map();
  }

  // ---------------------------------------------------------------- marks: glowing tiles, rings, dots lying on the vellum
  const mkT = (draw) => { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); draw(x); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };
  const TEX = {
    tile: mkT((x) => { x.fillStyle = 'rgba(255,255,255,0.5)'; x.fillRect(6, 6, 116, 116); x.strokeStyle = 'rgba(255,255,255,1)'; x.lineWidth = 8; x.strokeRect(9, 9, 110, 110); }),
    ring: mkT((x) => { x.strokeStyle = '#fff'; x.lineWidth = 12; x.beginPath(); x.arc(64, 64, 52, 0, TAU); x.stroke(); x.fillStyle = 'rgba(255,255,255,0.2)'; x.fill(); }),
    dash: mkT((x) => { x.strokeStyle = '#fff'; x.lineWidth = 10; x.setLineDash([18, 12]); x.beginPath(); x.arc(64, 64, 54, 0, TAU); x.stroke(); }),
    dot: mkT((x) => { const g = x.createRadialGradient(64, 64, 0, 64, 64, 62); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.42, 'rgba(255,255,255,0.95)'); g.addColorStop(0.58, 'rgba(255,255,255,0.3)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); }),
  };
  const markGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const markMeshes = Array.from({ length: 70 }, () => { const m = new THREE.Mesh(markGeo, new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); m.renderOrder = 3; m.visible = false; scene.add(m); return m; });
  function drawMarks(marks) {
    let k = 0;
    for (const q of marks) {
      if (k >= markMeshes.length || q.sq < 0 || q.sq > 127) continue;
      const m = markMeshes[k++], p = sqPos(q.sq), s = S * (q.kind === 'tile' ? 0.98 : q.kind === 'dot' ? 0.5 : 1.0) * (q.r || 1);
      m.visible = true; m.material.map = TEX[q.kind] || TEX.ring; m.position.set(p.x, TOP + (q.kind === 'tile' ? 0.04 : 0.06), p.z); m.scale.set(s, 1, s);
      const [r, g, b] = q.rgb.split(',').map((v) => Number(v) / 255); m.material.color.setRGB(r * r * 1.3, g * g * 1.3, b * b * 1.3); m.material.opacity = clamp(q.a ?? 1, 0, 1);
    }
    for (; k < markMeshes.length; k++) markMeshes[k].visible = false;
  }

  // ---------------------------------------------------------------- particles: landing dust and gold-leaf flakes from a capture
  const dustT = radialTex('230,205,165', 0.75);
  const dust = Array.from({ length: 10 }, () => { const m = new THREE.Mesh(markGeo, new THREE.MeshBasicMaterial({ map: dustT, transparent: true, depthWrite: false })); m.renderOrder = 2; m.visible = false; m.userData = { t: 9 }; scene.add(m); return m; });
  let dustI = 0;
  const puff = (x, z, s = 1) => { const m = dust[dustI++ % dust.length]; m.userData = { t: 0, x, z, s }; };
  const flakeMat = new THREE.MeshStandardMaterial({ color: 0xf2cf6a, metalness: 1, roughness: 0.25, side: THREE.DoubleSide, envMapIntensity: 2 });
  const flakes = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.42, 0.26), flakeMat, 96); flakes.count = 0; flakes.frustumCulled = false; scene.add(flakes);
  const bursts = [];
  const burst = (x, y, z, seed) => { bursts.push({ x, y, z, t: 0, seed }); if (bursts.length > 6) bursts.shift(); };

  function applyTier() {
    const t = TIERS[tier];
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, t.dpr));
    renderer.shadowMap.enabled = t.shadow > 0; lights.sun.castShadow = t.shadow > 0;
    if (t.shadow) { lights.sun.shadow.mapSize.set(t.shadow, t.shadow); if (lights.sun.shadow.map) { lights.sun.shadow.map.dispose(); lights.sun.shadow.map = null; } }
    blobMat.opacity = t.shadow ? 0.3 : 0.6;
    scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => { m.needsUpdate = true; }); });
  }
  applyTier();

  // ---------------------------------------------------------------- camera: yaw/tilt/fov per screen, distance + off-axis shift fitted to a rectangle
  const cur = { yaw: 0, tilt: 60, fov: 30, dist: 150, ox: 0, oy: 0, tx: 0, ty: TOP, tz: 0 };
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
    const p = { ...base, ox: 0, oy: 0, dist: 150 }, q = { x: 0, y: 0 }; let bb = null;
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

  // ---------------------------------------------------------------- v3 hooks for the 2D layer
  let cellUnits = 40;
  const pa = { x: 0, y: 0 }, pb = { x: 0, y: 0 }, q1 = { x: 0, y: 0 }, q2 = { x: 0, y: 0 };
  v3.pt = (i, lift = 0) => {
    const c = sqPos(i), y = TOP + lift;
    const p = virt(toCss(camera, c.x, y, c.z, { x: 0, y: 0 }));
    toCss(camera, c.x - S / 2, y, c.z, pa); toCss(camera, c.x + S / 2, y, c.z, pb); toCss(camera, c.x, y, c.z - S / 2, q1); toCss(camera, c.x, y, c.z + S / 2, q2);
    p.k = Math.max(Math.hypot(pb.x - pa.x, pb.y - pa.y), Math.hypot(q2.x - q1.x, q2.y - q1.y)) / cpu() / cellUnits; return p;
  };
  const ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -TOP), hit = new THREE.Vector3(), ndc = new THREE.Vector2();
  const rayAt = (vx, vy, h) => {
    ndc.set(((vx * cpu() + offX()) / cssW()) * 2 - 1, 1 - ((vy * cpu() + offY()) / cssH()) * 2);
    ray.setFromCamera(ndc, camera); plane.constant = -h;
    return ray.ray.intersectPlane(plane, hit);
  };
  v3.pick = (vx, vy) => {
    if (!rayAt(vx, vy, TOP + PH * 0.5)) return -1;
    const c = Math.floor(hit.x / S + 4), r = Math.floor(hit.z / S + 8);
    return c < 0 || c > 7 || r < 0 || r > 15 ? -1 : r * 8 + c;
  };

  // ---------------------------------------------------------------- the board's pieces
  let clock = 0, lastAnim = null, landed = false;
  const settled = new Map();
  const startCodes = startBoard().filter(Boolean);
  const trayList = { 1: [], 2: [] };            // codes in each capturer's tray, in the order they arrived
  function syncTrays(g, flying) {
    for (const side of [1, 2]) {
      const opp = 3 - side, have = new Map();
      for (const p of g.board) if (p && sideOf(p) === opp) have.set(p, (have.get(p) || 0) + 1);
      const lostM = new Map(); for (const p of startCodes) if (sideOf(p) === opp) { const h = have.get(p) || 0; if (h > 0) have.set(p, h - 1); else lostM.set(p, (lostM.get(p) || 0) + 1); }
      for (const p of flying) if ((lostM.get(p) || 0) > 0) lostM.set(p, lostM.get(p) - 1);
      const keep = [];
      for (const p of trayList[side]) if ((lostM.get(p) || 0) > 0) { keep.push(p); lostM.set(p, lostM.get(p) - 1); }
      for (const [p, n] of lostM) for (let k = 0; k < n; k++) keep.push(p);
      trayList[side] = keep.slice(0, 10);
    }
  }
  function drawPieces(g, a, state, board) {
    const calm = state.calm, sel = board ? state.sel : -1, t = state.t;
    if (a !== lastAnim) { lastAnim = a; landed = false; }
    if (a && !landed && a.t >= a.glide) {
      landed = true; settled.set(a.to, clock);
      if (!calm) { const p = sqPos(a.to); puff(p.x, p.z, a.caps.length ? 1.3 : 0.8); a.caps.forEach((c, j) => { const q = sqPos(c.sq); burst(q.x, TOP + PH, q.z, c.sq + j); }); }
    }
    syncTrays(g, a ? a.caps.map((c) => c.code) : []);
    const dragging = board && state.drag && sel >= 0;
    for (let i = 0; i < 128; i++) {
      const k = g.board[i]; if (!k) continue;
      if (a && i === a.to) continue;
      if (dragging && i === sel) continue;
      const p = sqPos(i), st = settled.has(i) && !a ? settlePose(clock - settled.get(i)) : { y: 0, tilt: 0 };
      let lift = st.y;
      if (sel === i) lift += 1.4 + (calm ? 0 : Math.sin(t * 3) * 0.2);
      put(k, p.x, p.z, { lift, tiltX: st.tilt });
    }
    for (const [i, t0] of settled) if (clock - t0 > SETTLE + 0.6) settled.delete(i);
    for (const side of [1, 2]) trayList[side].forEach((code, k) => { const w = desk.trays[side].slot(k); put(code, w.x, w.z, { base: w.y, yaw: (side === 1 ? 0 : Math.PI) + (k % 3 - 1) * 0.18 }); });
    if (a) {
      // pieces taken: they stay until the mover lands, then pop up, tumble and fly into the capturer's tray
      const span = Math.max(0.3, a.dur - a.glide);
      a.caps.forEach((c, j) => {
        const p = sqPos(c.sq);
        if (a.t < a.glide) { put(c.code, p.x, p.z); return; }
        const slot = desk.trays[a.side].slot(trayList[a.side].length + j);
        const f = clamp((a.t - a.glide - j * 0.05) / (span - 0.05 * (a.caps.length - 1)), 0, 1);
        if (f >= 1) { put(c.code, slot.x, slot.z, { base: slot.y, yaw: a.side === 1 ? 0 : Math.PI }); return; }
        const m = ease(clamp((f - 0.15) / 0.85, 0, 1)), y = TOP + (slot.y - TOP) * m + Math.sin(Math.PI * Math.min(1, f * 1.05)) * 10;
        put(c.code, p.x + (slot.x - p.x) * m, p.z + (slot.z - p.z) * m, { base: y, tiltX: calm ? 0 : Math.sin(f * Math.PI) * 1.2 * (j % 2 ? 1 : -1), tiltZ: calm ? 0 : Math.sin(f * Math.PI) * 0.5, sc: 1 });
      });
      const p0 = sqPos(a.from), p1 = sqPos(a.to), f = clamp(a.t / a.glide, 0, 1), dist = Math.hypot(p1.x - p0.x, p1.z - p0.z) / S;
      const code = g.board[a.to];
      if (code) {
        if (f < 1) {
          const P = glidePose(f, dist, calm), dx = p1.x - p0.x, dz = p1.z - p0.z, L = Math.hypot(dx, dz) || 1;
          put(code, p0.x + dx * P.e, p0.z + dz * P.e, { lift: P.lift, tiltX: (dz / L) * P.lean, tiltZ: -(dx / L) * P.lean });
        } else { const st = settlePose(a.t - a.glide); put(code, p1.x, p1.z, { lift: st.y, tiltX: st.tilt }); }
      }
    }
    if (dragging) { const code = g.board[sel]; if (code && rayAt(state.drag.x, state.drag.y, TOP + 3)) put(code, hit.x, hit.z, { lift: 3, tiltX: -0.12 }); }
    endPieces();
  }

  // ---------------------------------------------------------------- framing
  let game = null, lost = false, lastNow = 0, frameAvg = 16, slowFrames = 0, fadeIn = 0;
  const titleG = newGame();
  function framing(state, L) {
    const calm = state.calm, t = state.t;
    if (BOARD_SCENES.has(state.scene)) {
      const B = L.board, tall = B.tall, yaw = (tall ? 0 : 90) + (L.flip ? 180 : 0);
      const e = 0.3, pts = [[-HX - e, TOP, -HZ - e], [HX + e, TOP, -HZ - e], [-HX - e, TOP, HZ + e], [HX + e, TOP, HZ + e], [-HX, 0, HZ + 0.4], [HX, 0, HZ + 0.4]];
      const rc = rectCss({ x: B.x, y: B.y, w: B.W, h: B.h });
      return fit(rc, pts, { yaw, tilt: tall ? (L.mode === 'tall-side' ? 60 : 63) : 56, fov: 28, tx: 0, ty: TOP, tz: 0 });
    }
    const drift = calm ? 0 : 1, doc = state.scene === 'doc';
    const base = { yaw: -22 + 8 * Math.sin(t * TAU / 34) * drift, tilt: (doc ? 46 : 36) + 3 * Math.sin(t * TAU / 23) * drift, fov: 30, tx: 0, ty: TOP, tz: 0 };
    const pts = [[-HX - 6, TOP, -HZ - 4], [HX + 6, TOP, -HZ - 4], [-HX - 6, TOP, HZ + 2], [HX + 6, TOP, HZ + 2], [-HX - 17, 22, -HZ + 16]];
    let r = v3.hero;
    if (!r) { const U = L.U; r = { x: U.x0 + U.w * 0.08, y: U.y0 + U.h * 0.12, w: U.w * 0.84, h: U.h * 0.76 }; }
    return fit(rectCss(r), pts, base);
  }
  let wasBoard = null;
  function pre() {
    if (!game || lost) return;
    const state = game.getState(), L = layoutFor(meta.width, meta.height, state.flip), board = BOARD_SCENES.has(state.scene);
    cellUnits = L.cell;
    const vk = `${cssW()}x${cssH()}|${L.key}`; if (vk !== viewKey) { viewKey = vk; snap = true; }
    if (wasBoard !== board) { wasBoard = board; snap = true; }      // a board screen is exact from its first frame (taps, marks)
    const goal = framing(state, L);
    const now = performance.now(), dt = clamp((now - (lastNow || now)) / 1000, 0, 0.1);
    const k = snap || board ? 1 : 1 - Math.exp(-dt * 4);
    for (const key of Object.keys(goal)) cur[key] += (goal[key] - cur[key]) * k;
    snap = false; camYaw = cur.yaw;
    place(camera, cur);
    v3.marks.length = 0;
  }
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
  function post() {
    if (!game || lost) return;
    const now = performance.now(), dt = clamp((now - (lastNow || now)) / 1000, 0, 0.1); lastNow = now; clock += dt;
    const state = game.getState(), calm = state.calm, board = BOARD_SCENES.has(state.scene);
    drawPieces(board ? state.game : titleG, board ? state.anim : null, state, board);
    drawMarks(board ? v3.marks : []);
    for (const m of dust) {
      const u = m.userData; if (!(u.t <= 0.6)) { m.visible = false; continue; }
      u.t += dt; const f = Math.min(1, u.t / 0.6), s = (3 + f * 7) * u.s;
      m.visible = true; m.position.set(u.x, TOP + 0.1 + f * 0.6, u.z); m.scale.set(s, 1, s); m.material.opacity = 0.6 * (1 - f) * (1 - f);
    }
    let nf = 0;
    for (const b of bursts) {
      b.t += dt; if (b.t > 1.1) continue;
      for (let j = 0; j < 14 && nf < 96; j++) {
        const an = b.seed * 1.7 + j * 0.45, sp = 6 + (j % 4) * 2.2, tt = b.t;
        _p.set(b.x + Math.cos(an) * sp * tt * 0.9, Math.max(TOP + 0.05, b.y + 9 * tt - 14 * tt * tt + 1), b.z + Math.sin(an) * sp * tt * 0.9);
        _e.set(an + tt * 9, tt * 7 + j, tt * 5); _q.setFromEuler(_e); const sc = Math.max(0.01, 1 - Math.max(0, tt - 0.7) / 0.4); _s.set(sc, sc, sc);
        flakes.setMatrixAt(nf++, _m.compose(_p, _q, _s));
      }
    }
    flakes.count = nf; flakes.instanceMatrix.needsUpdate = true;
    for (const c of desk.candles) {                     // candle flames flicker (held still with Calm)
      const fl = calm ? 0 : Math.sin(clock * 11 + c.seed) * 0.5 + Math.sin(clock * 17.3 + c.seed * 2) * 0.3 + Math.sin(clock * 5.1) * 0.2;
      c.flame.scale.set(1.3 + fl * 0.06, 2.9 + fl * 0.22, 1); c.light.intensity = c.i0 * (1 + fl * 0.07); c.glow.material.opacity = 0.5 + fl * 0.04;
    }
    if (fadeIn < 1) { fadeIn = Math.min(1, fadeIn + dt / 0.4); v3.fade = fadeIn; }
    renderer.setSize(cssW(), cssH(), false);
    renderer.render(scene, camera);
    const ft = dt * 1000; if (ft > 0) frameAvg = frameAvg * 0.95 + ft * 0.05;
    if (frameAvg > 26 && tier < 2) { if (++slowFrames > 90) { tier++; slowFrames = 0; frameAvg = 16; applyTier(); } } else slowFrames = 0;
  }

  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; v3.on = false; canvas.style.visibility = 'hidden'; });
  canvas.addEventListener('webglcontextrestored', () => {
    lost = false; buildEnv();
    scene.remove(board); board.userData.dispose(); board = buildBoard(TIERS[tier].tex); scene.add(board);
    for (const list of pool.values()) for (const p of list) scene.remove(p.grp, p.blob);
    pool.clear(); clearNumberCache();
    applyTier(); fadeIn = 0; v3.fade = 0; v3.on = true; canvas.style.visibility = 'visible'; snap = true;
  });

  await tick();
  place(camera, cur); try { renderer.compile(scene, camera); } catch { /* compiled lazily */ }
  await tick();

  return {
    ok: true, renderer, scene, camera,
    attach(gm) { game = gm; v3.on = true; v3.fade = 0; fadeIn = 0; canvas.style.visibility = 'visible'; snap = true; },
    pre, post,
    get tier() { return TIERS[tier].name; },
    loseContext() { const ext = renderer.getContext().getExtension('WEBGL_lose_context'); ext?.loseContext(); return ext; },
  };
}
