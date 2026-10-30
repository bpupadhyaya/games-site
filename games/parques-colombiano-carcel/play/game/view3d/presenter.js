// Parqués 3D presenter. READS the game state (game.getState()) and the per-frame lists the 2D layer hands over in v3 (pieces, dice, light
// marks), never writes. One WebGL canvas sits behind the kit's transparent 2D canvas: the parqués board on a mochila cloth on a plank
// table, turned wooden pawns, ivory dice in a felt tray. The camera is fitted to the layout's board rectangle, so the 2D HUD lines up;
// taps are mapped back through the camera (v3.toBoard) to the square under the finger. No WebGL, ?flat=1 or a lost context: v3.on =
// false and every screen draws the flat 2D art; a restored context rebuilds the environment and returns to 3D.
import * as THREE from '../vendor3d/three.js';
import { v3 } from '../src/v3.js';
import { meta } from '../src/game.js';
import { BOARD, TRAY, CS } from '../src/layout.js';
import { SQ, HB, BT, R0, buildBoard, pawnKit, dieKit, faceQuat, buildTray, buildTable, buildLights, radialTex } from './world.js';

const TAU = Math.PI * 2, D2R = Math.PI / 180;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const TIERS = [{ name: 'high', dpr: 2, shadow: 2048, tex: 2048 }, { name: 'medium', dpr: 1.5, shadow: 1024, tex: 1536 }, { name: 'low', dpr: 1, shadow: 0, tex: 1024 }];
const tick = () => new Promise((r) => setTimeout(r, 0));
const BOARD_SCENES = new Set(['play', 'over', 'autoplay', 'autoplay-over']);
const PANELS = new Set(['setup', 'settings', 'how', 'about', 'rules', 'demo-limit']);
const TRAY_TOP = 2.05, UNIT_W = SQ / 34;

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
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.9;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  let tier = qs.has('tier') ? clamp(Number(qs.get('tier')), 0, 2) : (navigator.hardwareConcurrency || 8) <= 4 ? 1 : 0;

  await tick();
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a0d06);
  scene.fog = new THREE.Fog(0x2a1408, 1300, 2600);
  const camera = new THREE.PerspectiveCamera(28, 1, 20, 5000);
  const lights = buildLights(scene);
  const buildEnv = () => { try { const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture; pm.dispose(); scene.environmentIntensity = 0.55; } catch { /* no IBL */ } };
  buildEnv();
  await tick();
  const table = buildTable(scene, { quality: tier < 2 ? 1 : 0 });
  await tick();

  // ---- board (per texture tier), tray, pawns, dice
  const boards = new Map(); let boardRec = null, boardKey = '';
  function setBoard() {
    const k = String(TIERS[tier].tex); if (k === boardKey) return;
    let b = boards.get(k); if (!b) { b = buildBoard(TIERS[tier].tex); boards.set(k, b); }
    if (boardRec) scene.remove(boardRec.group); boardRec = b; boardKey = k; scene.add(b.group);
  }
  const tray = buildTray(); scene.add(tray);
  const kit = pawnKit();
  const pool = [0, 1, 2, 3].map((a) => ({ real: Array.from({ length: 6 }, () => { const g = kit.make(a, false); g.visible = false; scene.add(g); return g; }), ghost: (() => { const g = kit.make(a, true); g.visible = false; scene.add(g); return g; })() }));
  const dk = dieKit(); const diceM = [0, 1].map(() => { const m = new THREE.Mesh(dk.geo, dk.mats); m.castShadow = true; m.receiveShadow = true; m.visible = false; scene.add(m); return m; });
  const flatQuad = new THREE.PlaneGeometry(1, 1); flatQuad.rotateX(-Math.PI / 2);
  const blobs = new THREE.InstancedMesh(flatQuad, new THREE.MeshBasicMaterial({ map: radialTex('0,0,0', 0.9), transparent: true, depthWrite: false, opacity: 0.45 }), 40);
  blobs.renderOrder = 1; blobs.frustumCulled = false; blobs.count = 0; scene.add(blobs);

  // ---- light marks: rings (where a piece would land), glows under movable pieces, bursts on captures, pad outlines
  const ringTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); const g = x.createRadialGradient(64, 64, 20, 64, 64, 64); g.addColorStop(0, 'rgba(255,255,255,0.10)'); g.addColorStop(0.55, 'rgba(255,255,255,0.2)'); g.addColorStop(0.7, 'rgba(255,255,255,1)'); g.addColorStop(0.84, 'rgba(255,255,255,0.9)'); g.addColorStop(0.94, 'rgba(255,255,255,0.3)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const glowTex = radialTex('255,224,120', 1);
  const padTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); x.strokeStyle = '#fff'; x.lineWidth = 9; x.shadowColor = '#fff'; x.shadowBlur = 10; x.beginPath(); x.roundRect(10, 10, 108, 108, 18); x.stroke(); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const mark = (map, color) => { const m = new THREE.Mesh(flatQuad, new THREE.MeshBasicMaterial({ map, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); m.renderOrder = 3; m.visible = false; scene.add(m); return m; };
  const rings = Array.from({ length: 24 }, () => mark(ringTex, 0xffec96)), glows = Array.from({ length: 20 }, () => mark(glowTex, 0xffdc6e)), bursts = Array.from({ length: 6 }, () => mark(ringTex, 0xfff0b0));
  const padTurn = [0, 1, 2, 3].map(() => mark(padTex, 0xffec96)), padFlash = [0, 1, 2, 3].map(() => mark(padTex, 0xff6a5a));
  const jailC = [{ x: 57.5, z: 57.5 }, { x: 57.5, z: -57.5 }, { x: -57.5, z: -57.5 }, { x: -57.5, z: 57.5 }];   // jailOffset(arm) * SQ: bottom arm -> bottom-right, turning anticlockwise
  function applyTier() {
    const t = TIERS[tier];
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, t.dpr));
    renderer.shadowMap.enabled = t.shadow > 0; lights.sun.castShadow = t.shadow > 0;
    if (t.shadow) { lights.sun.shadow.mapSize.set(t.shadow, t.shadow); if (lights.sun.shadow.map) { lights.sun.shadow.map.dispose(); lights.sun.shadow.map = null; } }
    blobs.material.opacity = t.shadow ? 0.3 : 0.5;
    scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => { m.needsUpdate = true; }); });
  }
  applyTier();

  // ---------------------------------------------------------------- camera: tilt/yaw/fov per screen; distance + off-axis shift fitted to the board rectangle
  const cur = { yaw: 0, tilt: 58, fov: 28, dist: 500, ox: 0, oy: 0, tx: 0, ty: 2, tz: 0 };
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
    const p = { ...base, ox: 0, oy: 0, dist: 500 }, q = { x: 0, y: 0 }; let bb = null;
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
  const PAD = [[-HB, 0, -HB], [HB, 0, -HB], [-HB, BT + 9, -HB], [HB, BT + 9, -HB], [-HB, 0, HB], [HB, 0, HB], [-HB, BT + 9, HB], [HB, BT + 9, HB]];

  // ---------------------------------------------------------------- hooks for the 2D layer
  const bw = (bx, by) => ({ x: (bx - BOARD.cx) / CS * SQ, z: (by - BOARD.cy) / CS * SQ });
  v3.proj = (bx, by, lift = 0) => { const w = bw(bx, by); return virt(toCss(camera, w.x, R0 + lift * SQ / CS, w.z, { x: 0, y: 0 })); };
  const ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit = new THREE.Vector3(), ndc = new THREE.Vector2();
  function unproj(vx, vy, y, out = new THREE.Vector3()) {
    ndc.set(((vx * cpu() + offX()) / cssW()) * 2 - 1, 1 - ((vy * cpu() + offY()) / cssH()) * 2);
    ray.setFromCamera(ndc, camera); plane.constant = -y;
    if (!ray.ray.intersectPlane(plane, hit)) return out.set(0, y, 0);
    return out.copy(hit);
  }
  v3.toBoard = (vx, vy) => { const h = unproj(vx, vy, R0 + 3, new THREE.Vector3()); return { x: BOARD.cx + h.x / SQ * CS, y: BOARD.cy + h.z / SQ * CS }; };

  // ---------------------------------------------------------------- per frame
  let game = null, lost = false, lastNow = 0, frameAvg = 16, slowFrames = 0, fadeIn = 0, clock = 0, hidden = true;
  const isBoard = (state) => BOARD_SCENES.has(state.scene);
  function framing(state) {
    const S = BOARD.S, rc = rectCss({ x: BOARD.cx - S / 2, y: BOARD.cy - S / 2, w: S, h: S });
    if (isBoard(state)) return fit(rc, PAD, { yaw: 0, tilt: 50, fov: 28, tx: 0, ty: 2, tz: 0 });
    const t = state.t, drift = state.prefs?.calm ? 0 : 1;
    return fit(rc, PAD, { yaw: 7 * Math.sin(t * TAU / 38) * drift, tilt: 47 + 2.5 * Math.sin(t * TAU / 23) * drift, fov: 28, tx: 0, ty: 2, tz: 0 });
  }
  let wasBoard = null;
  function pre() {
    v3.items.length = 0; v3.dice.length = 0; v3.marks.length = 0;
    if (!game || lost) return;
    const state = game.getState(), board = isBoard(state), panel = PANELS.has(state.scene);
    if (panel !== hidden) { hidden = panel; canvas.style.visibility = panel ? 'hidden' : 'visible'; }
    const vk = `${cssW()}x${cssH()}|${Math.round(BOARD.cx)},${Math.round(BOARD.cy)},${Math.round(BOARD.S)}`; if (vk !== viewKey) { viewKey = vk; snap = true; }
    if (wasBoard !== board) { wasBoard = board; snap = true; }
    const goal = framing(state);
    const k = snap || board ? 1 : 0.35;
    for (const key of Object.keys(goal)) cur[key] += (goal[key] - cur[key]) * k;
    snap = false;
    place(camera, cur);
  }
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _ax = new THREE.Vector3();
  let nBlob = 0;
  const blob = (x, z, s, a = 1) => { if (nBlob >= 40) return; blobs.setMatrixAt(nBlob++, _m.compose(_p.set(x + 0.7, BT + 0.06, z + 1.0), _q.identity(), _s.set(s * a, 1, s * a))); };
  function drawPieces() {
    const used = [0, 0, 0, 0], ghosts = [0, 0, 0, 0];
    for (const P of pool) { for (const g of P.real) g.visible = false; P.ghost.visible = false; }
    nBlob = 0;
    for (const it of v3.items) {
      const P = pool[it.arm]; if (!P) continue;
      const w = bw(it.x, it.y), d = Math.max(Math.abs(w.x), Math.abs(w.z)), base = d < 15 ? 3.2 * (1 - d / 15) : 0;
      let g;
      if (it.alpha < 1) { if (ghosts[it.arm]++ > 0) continue; g = P.ghost; } else { if (used[it.arm] >= 6) continue; g = P.real[used[it.arm]++]; }
      const lift = it.lift * UNIT_W, sc = it.k * 1.42;
      g.visible = true; g.position.set(w.x, R0 + base + lift, w.z); g.scale.setScalar(sc); g.rotation.y = 0;
      blob(w.x, w.z, 9.5 * sc, it.alpha < 1 ? 0 : 1 / (1 + lift * 0.12));
    }
  }
  function drawMarks(state) {
    let nr = 0, ng = 0, nb = 0; for (const m of rings) m.visible = false; for (const m of glows) m.visible = false; for (const m of bursts) m.visible = false;
    for (const m of v3.marks) {
      const w = bw(m.x, m.y);
      if (m.k === 'ring' && nr < rings.length) { const r = rings[nr++], s = (14 + m.a * 2.4) * (m.sel ? 1.12 : 1); r.visible = true; r.position.set(w.x, R0 + 0.15, w.z); r.scale.set(s, 1, s); r.material.color.set(m.cap ? 0xff6a50 : 0xffec96); r.material.opacity = m.sel ? 1 : 0.55 + 0.3 * m.a; }
      else if (m.k === 'glow' && ng < glows.length - 2) { const r = glows[ng++]; r.visible = true; r.position.set(w.x, R0 + 0.12, w.z); r.scale.set(19, 1, 19); r.material.opacity = m.a; r.material.color.set(m.sel ? 0xfff5aa : 0xffdc6e); }
      else if (m.k === 'burst' && nb < bursts.length) { const r = bursts[nb++], s = 8 + m.f * 22; r.visible = true; r.position.set(w.x, R0 + 0.2, w.z); r.scale.set(s, 1, s); r.material.opacity = (1 - m.f) * (1 - m.f); }
    }
    const bd = boardRec;
    for (let a = 0; a < 4; a++) {
      const J = v3.jails[a], c = jailC[a], on = isBoard(state) || state.scene === 'title';
      padTurn[a].visible = on && J.turn; padFlash[a].visible = on && J.flash > 0;
      if (J.turn) { padTurn[a].position.set(c.x, BT + 0.2, c.z); padTurn[a].scale.set(62, 1, 62); padTurn[a].material.opacity = 0.6 + 0.35 * Math.sin(clock * 4); }
      if (J.flash > 0) { padFlash[a].position.set(c.x, BT + 0.25, c.z); padFlash[a].scale.set(58, 1, 58); padFlash[a].material.opacity = J.flash; }
      if (bd) bd.dim[a].visible = !J.active && state.scene !== 'title';
    }
  }
  const dieQ = new THREE.Quaternion(), yawQ = new THREE.Quaternion(), spinQ = new THREE.Quaternion(), Y = new THREE.Vector3(0, 1, 0);
  const tA = new THREE.Vector3(), tB = new THREE.Vector3(), tC = new THREE.Vector3(), tD = new THREE.Vector3();
  function drawTrayDice(state) {
    const on = isBoard(state) && TRAY.y < meta.height - 20;
    tray.visible = on; for (const m of diceM) m.visible = false;
    if (!on) return;
    const cx = TRAY.x + TRAY.w / 2, cy = TRAY.y + TRAY.h / 2;
    unproj(TRAY.x, cy, TRAY_TOP, tA); unproj(TRAY.x + TRAY.w, cy, TRAY_TOP, tB); unproj(cx, cy, TRAY_TOP, tC); unproj(cx, TRAY.y, TRAY_TOP, tD);
    const dz0 = tD.z; unproj(cx, TRAY.y + TRAY.h, TRAY_TOP, tD);
    tray.userData.fit(tC.x, tC.z, Math.abs(tB.x - tA.x) * 0.96, Math.abs(tD.z - dz0) * 0.92);
    const sx = Math.abs(tB.x - tA.x) / TRAY.w, size = 62 * sx;
    let ngl = 0;
    for (const d of v3.dice) {
      const m = diceM[d.id]; if (!m) continue;
      const sz = size * (d.used ? 0.92 : 1);
      unproj(d.x, d.y, TRAY_TOP + sz / 2, tA);
      const zl = (state.prefs?.calm ? 0 : d.z) * sx * 0.55;
      m.visible = true; m.scale.setScalar(sz); m.position.set(tA.x, TRAY_TOP + sz / 2 + zl, tA.z);
      yawQ.setFromAxisAngle(Y, -d.rot); dieQ.copy(yawQ).multiply(faceQuat(d.face));
      if (d.rolling && d.u < 0.72 && !state.prefs?.calm) { const f = 1 - d.u / 0.72; _ax.set(0.6 + d.id * 0.5, 1, 0.4 - d.id * 0.8).normalize(); spinQ.setFromAxisAngle(_ax, f * f * (9 + d.id * 4)); dieQ.premultiply(spinQ); }
      m.quaternion.copy(dieQ);
      blob(tA.x, tA.z, sz * 1.5, 1 / (1 + zl * 0.15));
      if (d.glow > 0) { const r = glows[glows.length - 1 - ngl++]; r.visible = true; r.position.set(tA.x, TRAY_TOP + 0.2, tA.z); r.scale.set(sz * 2.2, 1, sz * 2.2); r.material.opacity = 0.35 + 0.5 * d.glow; r.material.color.set(0xffd45a); }
    }
  }
  function post() {
    if (!game || lost) return;
    const now = performance.now(), dt = clamp((now - (lastNow || now)) / 1000, 0, 0.1); lastNow = now; clock += dt;
    const state = game.getState(), calm = state.prefs?.calm;
    if (hidden) { v3.items.length = 0; v3.dice.length = 0; v3.marks.length = 0; return; }
    setBoard();
    drawPieces(); drawTrayDice(state); drawMarks(state);
    blobs.count = nBlob; blobs.instanceMatrix.needsUpdate = true;
    if (!calm) {
      const a = table.dust.geometry.attributes.position.array;
      for (let i = 0; i < a.length; i += 3) { a[i + 1] += dt * (1.2 + (i % 7) * 0.16); a[i] += dt * 0.9; if (a[i + 1] > 130) a[i + 1] = 6; if (a[i] > 150) a[i] = -150; }
      table.dust.geometry.attributes.position.needsUpdate = true;
      lights.sun.position.x = -160 + Math.sin(clock * 0.07) * 14; lights.sun.intensity = 3.0 + Math.sin(clock * 0.6) * 0.1;
    }
    if (fadeIn < 1) { fadeIn = Math.min(1, fadeIn + dt / 0.4); v3.fade = fadeIn; }
    renderer.setSize(cssW(), cssH(), false);
    renderer.render(scene, camera);
    const ft = dt * 1000; if (ft > 0) frameAvg = frameAvg * 0.95 + ft * 0.05;
    if (frameAvg > 26 && tier < 2) { if (++slowFrames > 90) { tier++; slowFrames = 0; frameAvg = 16; setBoard(); applyTier(); } } else slowFrames = 0;
  }

  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; v3.on = false; canvas.style.visibility = 'hidden'; });
  canvas.addEventListener('webglcontextrestored', () => {
    lost = false; buildEnv(); applyTier();
    scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => { for (const k of ['map', 'bumpMap']) if (m[k]) m[k].needsUpdate = true; }); });
    fadeIn = 0; v3.fade = 0; v3.on = true; hidden = false; canvas.style.visibility = 'visible'; snap = true;
  });

  await tick();
  setBoard(); await tick();
  place(camera, cur); try { renderer.compile(scene, camera); } catch { /* compiled lazily */ }
  await tick();

  return {
    ok: true, renderer, scene, camera, v3,
    attach(g) { game = g; v3.on = true; v3.fade = 0; fadeIn = 0; hidden = false; canvas.style.visibility = 'visible'; snap = true; },
    pre, post,
    get tier() { return TIERS[tier].name; },
    loseContext() { const ext = renderer.getContext().getExtension('WEBGL_lose_context'); ext?.loseContext(); return ext; },
  };
}
