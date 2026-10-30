// Pachisi 3D presenter. READS what the 2D layer put into src/v3.js this frame (pawns, marks, the throw, the rectangle the table is fitted to),
// never writes game state. One WebGL canvas sits behind the kit's transparent 2D canvas: a sunlit sandstone courtyard, a teak platform with
// the embroidered cloth cross, brass yard bowls, turned wooden pawns, and the cowries (or the die) tumbling onto a rug. The camera is fitted
// to the layout's rectangle; v3.toScreen hands the 2D layer the exact projection so taps, labels and marks line up with the picture, and
// layout.js MAT (the throw zone) is kept equal to the projected rug. No WebGL, ?flat=1 or a lost context: v3.on = false and every screen
// draws the flat 2D art; a restored context rebuilds the scene and returns to 3D.
import * as THREE from '../vendor3d/three.js';
import { v3 } from '../src/v3.js';
import { meta } from '../src/game.js';
import { host, MAT, L } from '../src/layout.js';
import { geo } from '../src/rules.js';
import { paintCowrySprite, COWRY_SIZE } from '../src/pieces.js';
const cowrySprite = (which) => { const c = document.createElement('canvas'); c.width = COWRY_SIZE.w; c.height = COWRY_SIZE.h; paintCowrySprite(c.getContext('2d'), which); return c; };
import { PT, TOP, RUG_W, RUG_D, RUG_PX, PAWN_H, extent, slabHalf, rugZ, radialTex, buildRoom, buildLights, buildTable, pawnMaterials, makePawn, makeCowry, cowryTextures, makeDie, DIE_UP, COWRY_H, DIE_S } from './world.js';
import { yardOffset } from '../src/layout.js';

const D2R = Math.PI / 180;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const TIERS = [{ name: 'high', dpr: 2, shadow: 2048, tex: 2048 }, { name: 'medium', dpr: 1.5, shadow: 1024, tex: 1536 }, { name: 'low', dpr: 1, shadow: 0, tex: 1024 }];
const tick = () => new Promise((r) => setTimeout(r, 0));
const MARK_COL = { dest: '#ffe07a', cap: '#ff5a44', sel: '#fff0a0', glow: '#ffd36a', glowSel: '#fff3b0', dot: '#fff0b0', ping: '#ffdca0', turn: '#ffd45a' };

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
  scene.background = new THREE.Color(0xcfa876);
  scene.fog = new THREE.Fog(0xcfa876, 90, 220);
  const camera = new THREE.PerspectiveCamera(24, 1, 1, 600);
  const lights = buildLights(scene);
  const buildEnv = () => { try { const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture; pm.dispose(); scene.environmentIntensity = 0.55; } catch { /* no IBL */ } };
  buildEnv();
  await tick();
  buildRoom(scene);
  await tick();

  // ---- pawns, cowries, die (pools) ----
  const pawnPool = [[], [], [], []], ghostPool = [[], [], [], []], pawnMats = [0, 1, 2, 3].map((a) => pawnMaterials(a, false)), ghostMats = [0, 1, 2, 3].map((a) => pawnMaterials(a, true));
  let pawnUsed = [0, 0, 0, 0], ghostUsed = [0, 0, 0, 0];
  const takePawn = (arm, ghost) => {
    const pool = (ghost ? ghostPool : pawnPool)[arm], n = (ghost ? ghostUsed : pawnUsed)[arm]++;
    if (n >= pool.length) { const g = makePawn(arm, ghost ? ghostMats[arm] : pawnMats[arm]); g.traverse((o) => { if (ghost) o.castShadow = false; }); scene.add(g); pool.push(g); }
    const g = pool[n]; g.visible = true; return g;
  };
  const cTex = cowryTextures({ back: cowrySprite('back'), mouth: cowrySprite('mouth') });
  const cowries = Array.from({ length: 6 }, () => { const c = makeCowry(cTex); c.visible = false; scene.add(c); return c; });
  const die = makeDie(); die.visible = false; scene.add(die);

  const flatQuad = new THREE.PlaneGeometry(1, 1); flatQuad.rotateX(-Math.PI / 2);
  const mk = (draw) => { const c = document.createElement('canvas'); c.width = c.height = 128; draw(c.getContext('2d')); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };
  const TEX = {
    ring: mk((x) => { x.strokeStyle = '#fff'; x.lineWidth = 20; x.beginPath(); x.arc(64, 64, 50, 0, 7); x.stroke(); x.fillStyle = 'rgba(255,255,255,0.4)'; x.beginPath(); x.arc(64, 64, 50, 0, 7); x.fill(); }),
    sel: mk((x) => { x.strokeStyle = '#fff'; x.lineWidth = 17; x.beginPath(); x.arc(64, 64, 46, 0, 7); x.stroke(); x.fillStyle = 'rgba(255,255,255,0.38)'; x.beginPath(); x.arc(64, 64, 46, 0, 7); x.fill(); }),
    glow: radialTex('255,255,255', 1),
    dot: mk((x) => { x.fillStyle = '#fff'; x.beginPath(); x.arc(64, 64, 22, 0, 7); x.fill(); }),
    turn: mk((x) => { x.strokeStyle = '#fff'; x.lineWidth = 6; x.beginPath(); x.arc(64, 64, 58, 0, 7); x.stroke(); const g = x.createRadialGradient(64, 64, 40, 64, 64, 64); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(255,255,255,0.7)'); x.fillStyle = g; x.beginPath(); x.arc(64, 64, 64, 0, 7); x.fill(); }),
  };
  const marks = Array.from({ length: 140 }, () => { const m = new THREE.Mesh(flatQuad, new THREE.MeshBasicMaterial({ map: TEX.dot, transparent: true, depthWrite: false, fog: false })); m.renderOrder = 2; m.visible = false; scene.add(m); return m; });

  const tables = new Map(); let table = null, tableKey = '';
  function setTable(mode) {
    const k = `${mode}|${TIERS[tier].tex}`; if (k === tableKey) return;
    let t = tables.get(k);
    if (!t) { t = buildTable(mode, TIERS[tier].tex); tables.set(k, t); if (tables.size > 3) { const [k0, b0] = tables.entries().next().value; if (b0 !== t && b0 !== table) { b0.userData.dispose(); tables.delete(k0); } } }
    if (table) scene.remove(table); table = t; tableKey = k; scene.add(t);
  }
  function applyTier() {
    const t = TIERS[tier];
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, t.dpr));
    renderer.shadowMap.enabled = t.shadow > 0; lights.sun.castShadow = t.shadow > 0;
    if (t.shadow) { lights.sun.shadow.mapSize.set(t.shadow, t.shadow); if (lights.sun.shadow.map) { lights.sun.shadow.map.dispose(); lights.sun.shadow.map = null; } }
    scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => { if (m && m.isMaterial) m.needsUpdate = true; }); });
    tableKey = ''; if (table) { scene.remove(table); table = null; } setTable(v3.mode || 'pachisi');
  }
  applyTier();

  // ---- camera: elevation / fov per screen, distance and an off-axis shift fitted to a rectangle ----
  const cur = { yaw: 0, tilt: 56, fov: 24, dist: 60, ox: 0, oy: 0, tx: 0, ty: PT, tz: 4 };
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

  const ptsFor = (mode, withRug) => {
    const SH = slabHalf(mode), E = extent(mode), a = [[-SH, 0.25, SH], [SH, 0.25, SH], [-SH, PT, -SH], [SH, PT, -SH], [-E, TOP + PAWN_H, -E * 0.7], [E, TOP + PAWN_H, -E * 0.7], [-E, TOP, 0], [E, TOP, 0]];
    if (withRug) { const z0 = rugZ(mode) - RUG_D / 2, z1 = rugZ(mode) + RUG_D / 2; a.push([-RUG_W / 2, 0.1, z1], [RUG_W / 2, 0.1, z1], [-RUG_W / 2, 0.1, z0], [RUG_W / 2, 0.1, z0]); }
    return a;
  };
  const playCache = new Map();
  function playCam(rc, mode, land) {
    const key = `${mode}|${rc.x.toFixed(1)},${rc.y.toFixed(1)},${rc.w.toFixed(1)},${rc.h.toFixed(1)}|${cssW()}x${cssH()}|${cpu().toFixed(4)}`;
    let p = playCache.get(key);
    if (!p) {
      const r = rectCss(rc), pts = ptsFor(mode, true), zc = (slabHalf(mode) - 2) / 2 + 1;
      for (let el = land ? 62 : 68; el >= 36; el -= 3) { p = fit(r, pts, { yaw: 0, tilt: el, fov: 24, tx: 0, ty: PT, tz: zc }); if (p.bw >= r.w * 0.985 || p.bh >= r.h * 0.985 && el < 50) break; }
      playCache.set(key, p); if (playCache.size > 24) playCache.delete(playCache.keys().next().value);
    }
    return p;
  }

  // canonical (flat game's board units) <-> world, screen projection of a point h squares above the cloth
  const q0 = { x: 0, y: 0 };
  const c2w = (cx, cy) => [(cx - v3.gcx) / v3.cell, (cy - v3.gcy) / v3.cell];
  v3.toScreen = (cx, cy, h = 0) => { const [wx, wz] = c2w(cx, cy), v = virt(toCss(camera, wx, TOP + h, wz, q0)); return { x: v.x, y: v.y }; };
  function updateScale() { const a = v3.toScreen(v3.gcx, v3.gcy), b = v3.toScreen(v3.gcx + v3.cell, v3.gcy); v3.cellPx = Math.max(10, Math.hypot(b.x - a.x, b.y - a.y)); }
  function updateRug(mode) {
    const z0 = rugZ(mode) - RUG_D / 2, z1 = rugZ(mode) + RUG_D / 2; let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const [x, z] of [[-RUG_W / 2, z0], [RUG_W / 2, z0], [-RUG_W / 2, z1], [RUG_W / 2, z1]]) { const v = virt(toCss(camera, x, 0.1, z, q0)); x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y); }
    v3.mat = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }; Object.assign(MAT, v3.mat);
  }

  // ---- per frame content ----
  const _col = new THREE.Color(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _e = new THREE.Euler(), UP = new THREE.Vector3(0, 1, 0), ZAX = new THREE.Vector3(0, 0, 1);
  function baseY(mode, wx, wz) {
    const R = geo(mode).R, rad = R / 2 - 0.5;
    for (let a = 0; a < 4; a++) { const [ux, uy] = yardOffset(mode, a); if (Math.hypot(wx - ux, wz - uy) < rad * 0.9) return PT + 0.35; }
    return TOP;
  }
  function drawPieces(list, mode) {
    for (const arr of pawnPool) for (const g of arr) g.visible = false; for (const arr of ghostPool) for (const g of arr) g.visible = false;
    pawnUsed = [0, 0, 0, 0]; ghostUsed = [0, 0, 0, 0];
    for (const pc of list) {
      const [wx, wz] = c2w(pc.x, pc.y), g = takePawn(pc.arm, (pc.a ?? 1) < 0.99), s = pc.s || 1;
      g.position.set(wx, baseY(mode, wx, wz) + (pc.lift || 0) / v3.cell, wz); g.scale.setScalar(s * 1.12);
    }
  }
  function drawMarks(list, mode) {
    let k = 0;
    for (const m of list) {
      if (k >= marks.length) break;
      const q = marks[k++], [wx, wz] = c2w(m.x, m.y), kind = m.kind, a = clamp(m.a ?? 1, 0, 1), by = baseY(mode, wx, wz);
      q.visible = true; q.material.opacity = a; q.material.blending = THREE.NormalBlending; q.rotation.y = 0;
      _col.set(MARK_COL[kind] || '#fff'); q.material.color.copy(_col);
      let r = 0.95, y = by + 0.03, map = TEX.ring;
      if (kind === 'dest') { r = 0.95; map = TEX.ring; q.material.opacity = Math.max(a, 0.75); }
      else if (kind === 'cap') { r = 1.0; map = TEX.ring; y += 0.01; }
      else if (kind === 'sel') { r = 1.0; map = TEX.sel; y += 0.02; }
      else if (kind === 'glow' || kind === 'glowSel') { r = 1.9; map = TEX.glow; q.material.blending = THREE.AdditiveBlending; y += 0.015; }
      else if (kind === 'dot') { r = 0.22; map = TEX.dot; y += 0.04; }
      else if (kind === 'ping') { r = m.r || 1; map = TEX.ring; y += 0.05; }
      else if (kind === 'turn') { r = m.r || 3.5; map = TEX.turn; q.material.blending = THREE.AdditiveBlending; y = PT + 0.5; }
      q.material.map = map; q.position.set(wx, y, wz); q.scale.set(r * 2, 1, r * 2);
    }
    for (; k < marks.length; k++) marks[k].visible = false;
  }
  const FX = RUG_W / RUG_PX.w;
  let dieFinal = null;
  function drawDice(list, mode) {
    const rz = rugZ(mode); let ci = 0, anyDie = false;
    for (const it of list) {
      const wx = it.x * FX, wz = rz + it.y * FX, yy = (it.z || 0) * FX * 1.1;
      if (it.kind === 'cowry') {
        const c = cowries[ci++]; if (!c) continue; c.visible = true;
        c.position.set(wx, 0.12 + COWRY_H / 2 + yy, wz);
        c.quaternion.setFromAxisAngle(UP, -it.rot).multiply(_q.setFromAxisAngle(ZAX, it.phi));
      } else {
        anyDie = true; die.visible = true; die.position.set(wx, 0.12 + DIE_S / 2 + yy, wz);
        const f = DIE_UP[it.face] || DIE_UP[1]; _e.set(f[0], f[1], f[2], 'XYZ'); _q2.setFromEuler(_e);
        die.quaternion.setFromAxisAngle(UP, -it.rot).multiply(_q2);
        if (it.tumble) { _q.setFromAxisAngle(_v.set(0.7, 0.2, 0.6).normalize(), it.tumble); die.quaternion.premultiply(_q); }
      }
    }
    for (let i = ci; i < 6; i++) cowries[i].visible = false;
    if (!anyDie) die.visible = false;
  }

  // ---- per frame (called once, after the 2D layer has drawn and filled v3.frame / pieces / marks / dice) ----
  let loseExt = null, lost = false, lastNow = 0, frameAvg = 16, slowFrames = 0, mode = '', snap = true, viewKey = '', clock = 0;
  function post() {
    if (lost) return;
    const now = performance.now(), dt = clamp((now - (lastNow || now)) / 1000, 0, 0.1); lastNow = now; clock += dt;
    const fr = v3.frame;
    if (!fr) { canvas.style.visibility = 'hidden'; mode = ''; return; }          // a text page: the flat backdrop is drawn, nothing to render
    canvas.style.visibility = 'visible';
    const gm = v3.mode || 'pachisi';
    const vk = `${cssW()}x${cssH()}|${meta.width}x${meta.height}`; if (vk !== viewKey) { viewKey = vk; snap = true; playCache.clear(); }
    setTable(gm);
    let goal;
    if (fr.mode === 'title') goal = fit(rectCss(fr.rect), ptsFor(gm, false), { yaw: -5 + 4 * Math.sin(clock * 0.2), tilt: 44 + 2 * Math.sin(clock * 0.13), fov: 26, tx: 0, ty: PT, tz: 0 });
    else goal = playCam(fr.rect, gm, cssW() > cssH());
    if (fr.mode !== mode) { snap = true; mode = fr.mode; }
    const k = snap || fr.mode === 'play' ? 1 : 1 - Math.exp(-dt * 4);
    for (const key of ['yaw', 'tilt', 'fov', 'dist', 'ox', 'oy', 'tx', 'ty', 'tz']) cur[key] += (goal[key] - cur[key]) * k;
    snap = false;
    place(camera, cur); updateScale();
    const rug = table.getObjectByName('rug'); rug.visible = fr.mode === 'play';
    if (fr.mode === 'play') updateRug(gm);
    table.userData.rugMat.emissiveIntensity = 0.28 * v3.rugGlow;
    drawPieces(v3.pieces, gm); drawMarks(v3.marks, gm);
    if (fr.mode === 'play') drawDice(v3.dice, gm); else { for (const c of cowries) c.visible = false; die.visible = false; }
    renderer.setSize(cssW(), cssH(), false);
    renderer.render(scene, camera);
    const ft = dt * 1000; if (ft > 0) frameAvg = frameAvg * 0.95 + ft * 0.05;
    if (frameAvg > 26 && tier < 2) { if (++slowFrames > 90) { tier++; slowFrames = 0; frameAvg = 16; applyTier(); } } else slowFrames = 0;
  }

  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; v3.on = false; host.c3 = false; L.key = ''; canvas.style.visibility = 'hidden'; });
  canvas.addEventListener('webglcontextrestored', () => {
    lost = false; buildEnv(); for (const b of tables.values()) { if (table === b) scene.remove(b); b.userData.dispose(); } tables.clear(); table = null; tableKey = '';
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
