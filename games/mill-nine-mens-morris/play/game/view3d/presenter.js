// Nine Men's Morris 3D presenter. READS the game state (game.getState()) and what the 2D layer asked for this frame (src/v3.js: men,
// rings, mills, trays), never writes game state. One WebGL canvas sits behind the kit's transparent 2D canvas: a thick carved wood board,
// turned wooden men and two trays on a plank table in a candlelit tavern. On the play screens the camera is fitted to the layout's stage
// rectangle, and v3.at / v3.rack hand the 2D layer the stage position of every board point and tray slot as the live camera sees it, so
// taps, drags, rings and captions line up with the 3D scene. No WebGL, ?flat=1 or a lost context: v3.on = false and every screen draws
// the flat 2D art; a restored context rebuilds the scene and returns to 3D.
import * as THREE from '../vendor3d/three.js';
import { v3 } from '../src/v3.js';
import { meta } from '../src/game.js';
import { layoutFor } from '../src/layout.js';
import { NONE } from '../src/rules.js';
import { SP, HALF, TOP, MR, TRAY_D, TRAY_H, TRAY_OFF, pointWorld, slotWorld, radialTex, buildBoard, manGeo, manMaterials, setManSet, buildTray, buildTavern, buildLights } from './world.js';

const D2R = Math.PI / 180, CAP = 40;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const sm = (k) => k * k * (3 - 2 * k);
const hash = (a, b = 0) => { let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
const TIERS = [{ name: 'high', dpr: 2, shadow: 2048, tex: 1536 }, { name: 'medium', dpr: 1.5, shadow: 1024, tex: 1024 }, { name: 'low', dpr: 1, shadow: 0, tex: 512 }];
const tick = () => new Promise((r) => setTimeout(r, 0));
const SETTLE = 0.3;
// a position at rest for the document screens: [point, side]
const REST = [[0, 1], [3, 0], [5, 1], [9, 0], [12, 1], [14, 0], [16, 1], [18, 0], [20, 1], [21, 0], [22, 1], [23, 0], [7, 1], [10, 0], [2, 1]];

const colCache = new Map();
function parseCol(s) {
  let c = colCache.get(s); if (c) return c;
  c = (s.match(/[\d.]+/g) || ['255', '255', '255']).slice(0, 3).map((v) => Number(v) / 255);
  colCache.set(s, c); return c;
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
  scene.background = new THREE.Color(0x0c0704);
  scene.fog = new THREE.Fog(0x120a05, 260, 900);
  const camera = new THREE.PerspectiveCamera(30, 1, 2, 4000);
  const lights = buildLights(scene);
  const buildEnv = () => { try { const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture; pm.dispose(); scene.environmentIntensity = 0.3; } catch { /* no IBL */ } };
  buildEnv();
  await tick();
  const tavern = buildTavern(scene);
  await tick();
  const trays = { top: buildTray('oak'), bottom: buildTray('oak') };
  scene.add(trays.top); scene.add(trays.bottom);
  const geo = manGeo(); let setId = 'boxwood';
  const mats = manMaterials(setId);
  const inst = {};
  for (const k of [0, 1]) { const m = new THREE.InstancedMesh(geo, mats[k], CAP); m.castShadow = true; m.receiveShadow = true; m.count = 0; m.frustumCulled = false; scene.add(m); inst[k] = m; }
  const flatQuad = new THREE.PlaneGeometry(1, 1); flatQuad.rotateX(-Math.PI / 2);
  const blobs = new THREE.InstancedMesh(flatQuad, new THREE.MeshBasicMaterial({ map: radialTex('0,0,0', 0.9), transparent: true, depthWrite: false, opacity: 0.5 }), CAP * 2);
  blobs.renderOrder = 1; blobs.frustumCulled = false; blobs.count = 0; scene.add(blobs);
  // rings and glows: light lying on the board (under the men)
  const ringC = document.createElement('canvas'); ringC.width = ringC.height = 128;
  { const x = ringC.getContext('2d'), g = x.createRadialGradient(64, 64, 30, 64, 64, 64); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.55, 'rgba(255,255,255,0.15)'); g.addColorStop(0.74, 'rgba(255,255,255,1)'); g.addColorStop(0.86, 'rgba(255,255,255,0.85)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); }
  const ringT = new THREE.CanvasTexture(ringC); ringT.colorSpace = THREE.SRGBColorSpace;
  const discT = radialTex('255,255,255', 1);
  const marks = Array.from({ length: 64 }, () => { const m = new THREE.Mesh(flatQuad, new THREE.MeshBasicMaterial({ map: ringT, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); m.renderOrder = 2; m.visible = false; scene.add(m); return m; });
  // brass mill bars lying across the board
  const barMat = new THREE.MeshStandardMaterial({ color: 0xe9bb5e, metalness: 1, roughness: 0.26, emissive: 0xffa31a, emissiveIntensity: 0.5, envMapIntensity: 2 });
  const bars = Array.from({ length: 16 }, () => { const m = new THREE.Mesh(new THREE.BoxGeometry(1, 0.26, 0.5), barMat.clone()); m.castShadow = true; m.visible = false; scene.add(m); return m; });
  const dustT = radialTex('230,205,170', 0.8);
  const dust = Array.from({ length: 10 }, () => { const m = new THREE.Mesh(flatQuad, new THREE.MeshBasicMaterial({ map: dustT, transparent: true, depthWrite: false })); m.renderOrder = 2; m.visible = false; m.userData = { t: 9 }; scene.add(m); return m; });
  let dustI = 0;
  const puff = (x, z, s = 1) => { const m = dust[dustI++ % dust.length]; m.userData = { t: 0, x, z, s }; };

  // boards are cached per wood and texture size
  const boards = new Map(); let board = null, boardKey = '', woodId = 'oak';
  function setLook(wood, set) {
    if (set !== setId) { setId = set; setManSet(mats, set); }
    const k = `${wood}|${TIERS[tier].tex}`; if (k === boardKey) return;
    woodId = wood;
    let b = boards.get(k); if (!b) { b = buildBoard(wood, TIERS[tier].tex); boards.set(k, b); }
    if (board) scene.remove(board); board = b; boardKey = k; scene.add(b);
  }
  function applyTier() {
    const t = TIERS[tier];
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, t.dpr));
    renderer.shadowMap.enabled = t.shadow > 0; lights.sun.castShadow = t.shadow > 0;
    if (t.shadow) { lights.sun.shadow.mapSize.set(t.shadow, t.shadow); if (lights.sun.shadow.map) { lights.sun.shadow.map.dispose(); lights.sun.shadow.map = null; } }
    blobs.material.opacity = t.shadow ? 0.28 : 0.55;
    scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => { if (m && m.isMaterial) m.needsUpdate = true; }); });
    setLook(woodId, setId);
  }
  applyTier();

  // ---------------------------------------------------------------- camera
  const cur = { yaw: 0, tilt: 54, fov: 28, dist: 100, ox: 0, oy: 0, tx: 0, ty: TOP, tz: 0 };
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

  const B = HALF - 0.3, TW = 9 * 3.7 / 2 + 1.1;
  const boardPts = (kind) => {
    const pts = [[-B, TOP, -B], [B, TOP, -B], [-B, 0, B + 0.4], [B, 0, B + 0.4], [-B, 0, -B], [B, 0, -B]];
    const ty = TRAY_H + 1.2;
    for (const s of [-1, 1]) {
      if (kind === 'h') pts.push([-TW, ty, s * (TRAY_OFF + TRAY_D / 2)], [TW, ty, s * (TRAY_OFF + TRAY_D / 2)], [-TW, ty, s * (TRAY_OFF - TRAY_D / 2)], [TW, ty, s * (TRAY_OFF - TRAY_D / 2)]);
      else pts.push([s * (TRAY_OFF + TRAY_D / 2), ty, -TW], [s * (TRAY_OFF + TRAY_D / 2), ty, TW], [s * (TRAY_OFF - TRAY_D / 2), ty, -TW], [s * (TRAY_OFF - TRAY_D / 2), ty, TW]);
    }
    return pts;
  };
  const HERO_PTS = [[-B, TOP, -B], [B, TOP, -B], [-B, 0, B + 0.4], [B, 0, B + 0.4], [-B, 0, -B], [B, 0, -B]];
  const playCache = new Map();
  function playCam(L) {
    const key = `${L.key}|${cssW()}x${cssH()}|${cpu().toFixed(4)}`;
    let p = playCache.get(key);
    if (!p) {
      const r = L.play || L.stageRect, land = L.land, vert = L.racks === 'v';
      // leave room for the tray captions (above the top tray, below the bottom one, or above each column); the camera looks steeply down
      // so the square board uses the height of the play rect as well as its width
      const padT = (vert ? 50 : 60) * L.stage.s, padB = (vert ? 6 : 80) * L.stage.s;
      const rc = rectCss({ x: r.x + r.w * 0.02, y: r.y + padT, w: r.w * 0.96, h: r.h - padT - padB }), cands = [];
      for (let tl = 40; tl <= (land ? 68 : 74); tl += 4) cands.push(fit(rc, boardPts(L.racks), { yaw: 0, tilt: tl, fov: 28, tx: 0, ty: TOP, tz: 0 }));
      const near = Math.min(...cands.map((c) => c.dist)); p = cands.filter((c) => c.dist <= near * 1.02).pop();   // the steepest view that still gives the biggest board
      playCache.set(key, p); if (playCache.size > 24) playCache.delete(playCache.keys().next().value);
    }
    return p;
  }

  // ---------------------------------------------------------------- stage mapping (the 2D layer's coordinates for what the camera shows)
  const q0 = { x: 0, y: 0 };
  let curL = null, stageKind = 'h';
  const stageOf = (x, y, z, out) => { const v = virt(toCss(camera, x, y, z, q0)); const s = curL.toStage(v.x, v.y); out.x = s.x; out.y = s.y; return out; };
  const atCache = Array.from({ length: 24 }, () => ({ x: 0, y: 0, s: 1 }));
  const rackCache = { top: Array.from({ length: 9 }, () => ({ x: 0, y: 0, s: 1 })), bottom: Array.from({ length: 9 }, () => ({ x: 0, y: 0, s: 1 })) };
  const a0 = { x: 0, y: 0 }, a1 = { x: 0, y: 0 };
  function fillScale(o, x, y, z) { stageOf(x - SP / 2, y, z, a0); stageOf(x + SP / 2, y, z, a1); o.s = Math.hypot(a1.x - a0.x, a1.y - a0.y) / 96; }
  function updateMaps() {
    for (let i = 0; i < 24; i++) { const w = pointWorld(i), o = atCache[i]; stageOf(w.x, TOP, w.z, o); fillScale(o, w.x, TOP, w.z); }
    for (const which of ['top', 'bottom']) {
      const sg = which === 'top' ? -1 : 1, e = TRAY_OFF + sg * (TRAY_D / 2 + 0.6) * sg;
      if (stageKind === 'h') stageOf(0, TRAY_H, sg * (TRAY_OFF + TRAY_D / 2 + 0.6), labelC[which]); else stageOf(sg * TRAY_OFF, TRAY_H, -TW - 3.2, labelC[which]);
      void e;
    }
    for (const which of ['top', 'bottom']) for (let k = 0; k < 9; k++) { const w = slotWorld(stageKind, which, k), o = rackCache[which][k]; stageOf(w.x, TRAY_H + 0.1, w.z, o); fillScale(o, w.x, TRAY_H + 0.1, w.z); }
  }
  v3.at = (i) => atCache[i];
  v3.rack = (which, k) => rackCache[which][clamp(k, 0, 8)];
  const labelC = { top: { x: 0, y: 0 }, bottom: { x: 0, y: 0 } };
  v3.label = (which, kind) => {
    const c = labelC[which], s = rackCache[which][4].s;
    return { x: c.x, y: c.y + (kind === 'h' ? (which === 'top' ? -14 : 30) * Math.max(0.7, s) : -10), two: kind === 'v' };
  };
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), hitP = new THREE.Vector3();
  function stageToWorld(sx, sy, y) {
    const sc = curL.toScreen(sx, sy), cs = { x: sc.x * cpu() + offX(), y: sc.y * cpu() + offY() };
    ndc.set(cs.x / cssW() * 2 - 1, -(cs.y / cssH()) * 2 + 1); ray.setFromCamera(ndc, camera);
    const o = ray.ray.origin, d = ray.ray.direction; if (Math.abs(d.y) < 1e-4) return null;
    const t = (y - o.y) / d.y; return hitP.copy(o).addScaledVector(d, t);
  }

  // ---------------------------------------------------------------- men
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
  const counts = { 0: 0, 1: 0 }; let nBlob = 0;
  const begin = () => { counts[0] = counts[1] = 0; nBlob = 0; };
  function put(side, x, y, z, yaw, tx = 0, tz = 0, sc = 1, sy = 1, ground = TOP) {
    if (sc < 0.01 || counts[side] >= CAP) return;
    _e.set(tx, yaw, tz, 'YXZ'); _q.setFromEuler(_e); _s.set(sc, sc * sy, sc); _p.set(x, y, z);
    _m.compose(_p, _q, _s); inst[side].setMatrixAt(counts[side]++, _m);
    if (nBlob < CAP * 2) {
      const lift = Math.max(0, y - ground), s = MR * 2.7 * sc * (1 + lift * 0.12);
      _p.set(x + 0.2 + lift * 0.25, ground + 0.03, z + 0.18 + lift * 0.2); _q.identity(); _s.set(s, 1, s); blobs.setMatrixAt(nBlob++, _m.compose(_p, _q, _s));
    }
  }
  function end() { for (const k of [0, 1]) { inst[k].count = counts[k]; inst[k].instanceMatrix.needsUpdate = true; } blobs.count = nBlob; blobs.instanceMatrix.needsUpdate = true; }
  const yawOf = (i, side) => hash(i, side * 17) * 6.283;

  let clock = 0, mode = '';
  const settled = new Map(); let lastMove = null, takeFor = -1;
  function drawMen(playMode) {
    begin();
    const hideTo = v3.move ? v3.move.to : -1;
    let list = v3.pieces;
    if (!list.length && !playMode && mode === 'env') list = REST.map(([i, side]) => ({ side, i, lift: 0, sc: 1 }));
    for (const pc of list) {
      if (pc.i === hideTo) continue;
      const w = pointWorld(pc.i), st = settled.get(pc.i);
      let y = TOP + pc.lift * 1.8, tx = 0, sy = 1;
      if (st) {
        const s = (clock - st.t0) / SETTLE;
        if (s >= 1) settled.delete(pc.i);
        else { const d = (1 - s) * (1 - s); y += Math.abs(Math.sin(s * Math.PI * 2)) * 0.45 * d; sy = 1 - Math.sin(Math.min(1, s * 4) * Math.PI) * 0.06; tx = Math.sin(s * Math.PI * 4) * 0.05 * d; }
      }
      if (pc.sel) y += 0.7 + Math.sin(clock * 4) * 0.16;
      put(pc.side, w.x, y, w.z, yawOf(pc.i, pc.side), tx, 0, pc.sc, sy);
    }
    // the man in flight: from his tray (or his point) to the destination, in an arc; he settles with a small bounce
    const mv = v3.move;
    if (mv) {
      const e = sm(mv.f), hn = v3.hand?.[mv.rack]?.n ?? 0;
      const a = mv.from === NONE ? slotWorld(stageKind, mv.rack, clamp(hn, 0, 8)) : pointWorld(mv.from), b = pointWorld(mv.to);
      const y0 = mv.from === NONE ? TRAY_H + 0.05 : TOP, arc = Math.sin(Math.PI * mv.f) * (mv.fly ? 9 : 3.2);
      put(mv.side, a.x + (b.x - a.x) * e, y0 + (TOP - y0) * e + arc, a.z + (b.z - a.z) * e, yawOf(mv.to, mv.side) + e * 2.4, Math.sin(Math.PI * e) * 0.12, 0, 1, 1, TOP);
      lastMove = mv.to;
    } else if (lastMove !== null) { settled.set(lastMove, { t0: clock }); const lw = pointWorld(lastMove); puff(lw.x, lw.z, 0.7); lastMove = null; }
    // the man being taken: shudders, lifts, shrinks away
    const tk = v3.take;
    if (tk) {
      const w = pointWorld(tk.i), tf = tk.tf, sh = Math.sin(tf * 50) * 0.18 * (1 - tf);
      put(tk.side, w.x + sh, TOP + tf * 4.5, w.z, yawOf(tk.i, tk.side) + tf * 3, tf * 0.4, 0, 1 - tf * 0.55);
      if (takeFor !== tk.i) { takeFor = tk.i; puff(w.x, w.z, 1.3); }
    } else takeFor = -1;
    // the man under the finger
    const dr = v3.drag;
    if (dr) { const w = stageToWorld(dr.x, dr.y, TOP + 2.6); if (w) put(dr.side, w.x, TOP + 2.6, w.z, clock * 0.5, 0, 0, 1.06, 1, TOP); }
    // the trays hold the men still to place
    if (playMode && v3.hand) for (const which of ['top', 'bottom']) {
      const h = v3.hand[which]; if (!h) continue;
      for (let k = 0; k < h.n && k < 9; k++) { const w = slotWorld(stageKind, which, k); put(h.side, w.x, TRAY_H + 0.05, w.z, yawOf(k + (which === 'top' ? 40 : 0), h.side), 0, 0, 1, 1, TRAY_H); }
    }
    end();
  }
  function drawMarks(list) {
    let k = 0;
    const occ = new Set(v3.pieces.map((p) => p.i));
    for (const mk of list) {
      if (k >= marks.length || mk.i < 0 || mk.i >= 24) continue;
      const m = marks[k++], w = pointWorld(mk.i);
      let r = (mk.rad / 39) * MR;
      if (!mk.glow && occ.has(mk.i)) r = Math.max(r, MR * 1.18);
      const s = r * 2 * (mk.glow ? 1.25 : 1.12);
      m.visible = true; m.position.set(w.x, TOP + 0.1, w.z); m.scale.set(s, 1, s);
      m.material.map = mk.glow ? discT : ringT;
      const [cr, cg, cb] = parseCol(mk.rgb), a = clamp(mk.a ?? 1, 0, 1);
      m.material.color.setRGB(cr * cr * a * 1.2, cg * cg * a * 1.2, cb * cb * a * 1.2);
    }
    for (; k < marks.length; k++) marks[k].visible = false;
  }
  function drawBars(list) {
    let k = 0;
    for (const b of list) {
      if (k >= bars.length) break;
      const m = bars[k++], a = pointWorld(b.a), c = pointWorld(b.c), len = Math.hypot(c.x - a.x, c.z - a.z) + 1.4;
      m.visible = true; m.position.set((a.x + c.x) / 2, TOP + 0.14, (a.z + c.z) / 2); m.rotation.y = -Math.atan2(c.z - a.z, c.x - a.x); m.scale.set(len, 1, 1);
      m.material.emissiveIntensity = 0.35 + 0.35 * b.pulse;
    }
    for (; k < bars.length; k++) bars[k].visible = false;
  }

  // ---------------------------------------------------------------- per frame
  let game = null, lost = false, lastNow = 0, frameAvg = 16, slowFrames = 0, fadeIn = 0;
  function framing(state, L, t) {
    const sc = state.scene;
    if (sc === 'play' || sc === 'auto' || sc === 'over' || sc === 'lesson' || (sc === 'puzzle' && state.pz && state.pz.status !== 'making')) return { m: 'play', p: playCam(L) };
    if (sc === 'title') {
      const b = L.title(!!state.saved).board;
      if (b) {
        const rc = { x: b.cx - 400 * b.k, y: b.cy - 330 * b.k, w: 800 * b.k, h: 700 * b.k };
        const base = { yaw: -7 + 6 * Math.sin(t * Math.PI * 2 / 36), tilt: 40 + 2.5 * Math.sin(t * Math.PI * 2 / 23), fov: 30, tx: 0, ty: TOP, tz: 0 };
        return { m: 'title', p: fit(rectCss(rc), HERO_PTS, base) };
      }
    }
    // documents and menus without a board slot: the board at rest between the candles
    const U = L.U, land = L.land;
    const base = { yaw: -14 + 6 * Math.sin(t * Math.PI * 2 / 40), tilt: 30, fov: 32, tx: 0, ty: TOP, tz: 0 };
    const r = land ? { x: U.x0 + U.w * 0.04, y: U.y0 + U.h * 0.22, w: U.w * 0.5, h: U.h * 0.6 } : { x: U.x0 + U.w * 0.05, y: U.y0 + U.h * 0.3, w: U.w * 0.9, h: U.h * 0.42 };
    return { m: 'env', p: fit(rectCss(r), HERO_PTS, base) };
  }
  function pre() {
    if (!game || lost) return;
    const state = game.getState(), L = layoutFor(meta.width, meta.height); curL = L;
    const vk = `${cssW()}x${cssH()}|${meta.width}x${meta.height}|${L.mode}`; if (vk !== viewKey) { viewKey = vk; snap = true; }
    if (state.look) setLook(state.look.wood, state.look.set);
    if (stageKind !== L.racks) stageKind = L.racks;
    const now = performance.now(), dt = clamp((now - (lastNow || now)) / 1000, 0, 0.1);
    const goal = framing(state, L, clock);
    if (goal.m !== mode) { if (goal.m === 'play' || mode === '') snap = true; mode = goal.m; }
    const k = snap || goal.m === 'play' ? 1 : 1 - Math.exp(-dt * 4);
    for (const key of Object.keys(goal.p)) cur[key] += (goal.p[key] - cur[key]) * k;
    snap = false;
    place(camera, cur); updateMaps();
    v3.pieces.length = 0; v3.marks.length = 0; v3.bars.length = 0; v3.move = null; v3.take = null; v3.drag = null; v3.hand = null;
  }
  function post() {
    if (!game || lost) return;
    const now = performance.now(), dt = clamp((now - (lastNow || now)) / 1000, 0, 0.1); lastNow = now; clock += dt;
    const play = mode === 'play';
    // trays follow the layout (above and below the board, or one each side)
    for (const which of ['top', 'bottom']) {
      const g = trays[which], s = which === 'top' ? -1 : 1; g.visible = play;
      if (stageKind === 'h') { g.position.set(0, 0, s * TRAY_OFF); g.rotation.y = 0; } else { g.position.set(s * TRAY_OFF, 0, 0); g.rotation.y = Math.PI / 2; }
    }
    drawMen(play);
    drawMarks(play || mode === 'title' ? v3.marks : []);
    drawBars(v3.bars);
    for (const m of dust) {
      const u = m.userData; if (!(u.t <= 0.6)) { m.visible = false; continue; }
      u.t += dt; const f = Math.min(1, u.t / 0.6), s = (2 + f * 5) * u.s;
      m.visible = true; m.position.set(u.x, TOP + 0.15 + f * 0.5, u.z); m.scale.set(s, 1, s); m.material.opacity = 0.4 * (1 - f) * (1 - f);
    }
    // candle flames breathe; dust motes drift in the light
    tavern.userData.candles.forEach((c, i) => {
      const f = 1 + 0.07 * Math.sin(clock * 7.3 + i * 2) + 0.045 * Math.sin(clock * 13.1 + 1.7 + i) + 0.02 * Math.sin(clock * 23.7 + i * 4), u = c.userData;
      u.light.intensity = 900 * f; u.halo.material.opacity = clamp(0.8 + (f - 1) * 1.4, 0, 1); u.flame.scale.set(0.75 * (2 - f), 1.9 * f, 0.75 * (2 - f)); u.flame.position.x = Math.sin(clock * 3.1 + i) * 0.08;
    });
    { const pa = tavern.userData.dust.geometry.attributes.position, b = tavern.userData.base; for (let i = 0; i < pa.count; i++) pa.setXYZ(i, b[i * 3] + Math.sin(clock * 0.25 + i) * 3, 4 + ((b[i * 3 + 1] - 4 + clock * (0.8 + (i % 5) * 0.3)) % 46), b[i * 3 + 2] + Math.cos(clock * 0.2 + i * 1.3) * 3); pa.needsUpdate = true; }
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
    ok: true,
    attach(g) { game = g; v3.on = true; v3.fade = 0; fadeIn = 0; canvas.style.visibility = 'visible'; snap = true; },
    pre, post,
    get tier() { return TIERS[tier].name; },
  };
}
