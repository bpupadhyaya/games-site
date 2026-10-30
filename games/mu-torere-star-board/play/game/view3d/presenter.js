// Mū Tōrere 3D presenter. READS the game state (game.getState()), never writes it. One WebGL canvas sits behind the kit's transparent 2D
// canvas: a carved tōtara star board with pāua inlay on a woven mat, on a grassy headland above the sea at dusk. The camera is fitted to the
// layout's board placement (play) or the title art's star (menu), so the 2D HUD, rings and taps line up with the tilted board through
// v3.pt / v3.pick. No WebGL, ?flat=1 or a lost context: v3.on = false and every screen draws the flat 2D art; a restored context
// rebuilds the environment and returns to 3D. The title runs its own little demonstration game (presentation only; rules.js is pure).
import * as THREE from '../vendor3d/three.js';
import { v3 } from '../src/v3.js';
import { meta } from '../src/game.js';
import { layoutFor, PR as PR2 } from '../src/layout.js';
import { newGame, applyMove } from '../src/rules.js';
import { rate } from '../src/solver.js';
import { TOP, PR, TIP, STONE_R, pointW, restY, buildBoard, stoneGeos, stoneMaterials, buildHeadland, buildLights, radialTex } from './world.js';

const TAU = Math.PI * 2, D2R = Math.PI / 180, CAP = 12;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const hash = (a, b = 0) => { let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
const TIERS = [{ name: 'high', dpr: 2, shadow: 2048, tex: 1024 }, { name: 'medium', dpr: 1.5, shadow: 1024, tex: 1024 }, { name: 'low', dpr: 1, shadow: 0, tex: 512 }];
const tick = () => new Promise((r) => setTimeout(r, 0));
const BOARD_SCENES = new Set(['play', 'over', 'lesson', 'auto', 'puzzle']);
const SETTLE = 0.32;
const ease = (f) => f * f * (3 - 2 * f);

// A move: the stone is lifted a finger's width, carried with a slight forward lean and set down (same timing as the flat art).
// A refused move travels part way, shudders and comes back.
export function movePose(a, calm) {
  const e = clamp(a.t / a.dur, 0, 1);
  if (a.refuse) { const out = Math.sin(e * Math.PI) * 0.42, shake = !calm && e > 0.5 ? Math.sin(e * 60) * 0.35 * (1 - e) : 0; return { k: out, lift: 0.9 * Math.sin(e * Math.PI), lean: 0, shake }; }
  const s = ease(e); return { k: s, lift: Math.sin(s * Math.PI) * (calm ? 1.2 : 2.6), lean: (calm ? 0 : 0.32) * Math.sin(Math.PI * s) * (s < 0.5 ? 1 : -0.5), shake: 0 };
}
// A set-down stone: two small damped rocks.
export function settlePose(t) {
  if (t >= SETTLE || t < 0) return { y: 0, tilt: 0 };
  const s = t / SETTLE, d = (1 - s) * (1 - s);
  return { y: Math.abs(Math.sin(s * Math.PI * 2)) * 0.18 * d, tilt: Math.sin(s * Math.PI * 4) * 0.07 * d };
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
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  let tier = qs.has('tier') ? clamp(Number(qs.get('tier')), 0, 2) : (navigator.hardwareConcurrency || 8) <= 4 ? 1 : 0;

  await tick();
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x9a8c80, 1500, 16000);
  const camera = new THREE.PerspectiveCamera(30, 1, 2, 12000);
  const lights = buildLights(scene);
  const buildEnv = () => { try { const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture; pm.dispose(); scene.environmentIntensity = 0.4; } catch { /* no IBL */ } };
  buildEnv();
  await tick();
  const land = buildHeadland(scene, { quality: tier < 2 ? 1 : 0 });
  await tick();
  const geos = stoneGeos(), mats = stoneMaterials();
  const inst = {};
  for (const k of [1, 2]) for (let v = 0; v < 3; v++) { const m = new THREE.InstancedMesh(geos[k][v], mats[k], CAP); m.castShadow = true; m.receiveShadow = true; m.count = 0; m.frustumCulled = false; scene.add(m); inst[`${k}${v}`] = m; }
  const flatQuad = new THREE.PlaneGeometry(1, 1); flatQuad.rotateX(-Math.PI / 2);
  const blobs = new THREE.InstancedMesh(flatQuad, new THREE.MeshBasicMaterial({ map: radialTex('20,6,0', 0.9), transparent: true, depthWrite: false, opacity: 0.5 }), CAP * 2);
  blobs.renderOrder = 1; blobs.frustumCulled = false; blobs.count = 0; scene.add(blobs);
  // rings (legal points, selection, hints, Auto Play reveal) as light lying in the hollows
  const ringC = document.createElement('canvas'); ringC.width = ringC.height = 128;
  { const x = ringC.getContext('2d'), g = x.createRadialGradient(64, 64, 18, 64, 64, 64); g.addColorStop(0, 'rgba(255,255,255,0.22)'); g.addColorStop(0.5, 'rgba(255,255,255,0.3)'); g.addColorStop(0.68, 'rgba(255,255,255,1)'); g.addColorStop(0.8, 'rgba(255,255,255,0.9)'); g.addColorStop(0.92, 'rgba(255,255,255,0.25)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); }
  const ringT = new THREE.CanvasTexture(ringC); ringT.colorSpace = THREE.SRGBColorSpace;
  const rings = Array.from({ length: 24 }, () => { const m = new THREE.Mesh(flatQuad, new THREE.MeshBasicMaterial({ map: ringT, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); m.renderOrder = 3; m.visible = false; scene.add(m); return m; });
  // a soft glint where a stone is set down
  const dustT = radialTex('255,226,180', 0.7);
  const dust = Array.from({ length: 6 }, () => { const m = new THREE.Mesh(flatQuad, new THREE.MeshBasicMaterial({ map: dustT, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); m.renderOrder = 2; m.visible = false; m.userData = { t: 9 }; scene.add(m); return m; });
  let dustI = 0;
  const puff = (x, z, s = 1) => { const m = dust[dustI++ % dust.length]; m.userData = { t: 0, x, z, s }; };

  let board = null;
  function setBoard() { if (board) return; board = buildBoard(TIERS[tier].tex); scene.add(board); }
  function applyTier() {
    const t = TIERS[tier];
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, t.dpr));
    renderer.shadowMap.enabled = t.shadow > 0; lights.sun.castShadow = t.shadow > 0;
    if (t.shadow) { lights.sun.shadow.mapSize.set(t.shadow, t.shadow); if (lights.sun.shadow.map) { lights.sun.shadow.map.dispose(); lights.sun.shadow.map = null; } }
    blobs.material.opacity = t.shadow ? 0.42 : 0.65;
    scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => { m.needsUpdate = true; }); });
  }
  applyTier();

  // ---------------------------------------------------------------- camera: yaw/tilt/fov per screen, distance + off-axis shift fitted to a rectangle
  const cur = { yaw: 0, tilt: 60, fov: 30, dist: 160, ox: 0, oy: 0, tx: 0, ty: TOP, tz: 0 };
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
    const p = { ...base, ox: 0, oy: 0, dist: 160 }, q = { x: 0, y: 0 }; let bb = null;
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
  const pa = { x: 0, y: 0 }, pb = { x: 0, y: 0 };
  // point i projected to virtual units; k = local scale vs the flat board's design units (a flat radius r draws as r * k)
  v3.pt = (i, lift = 0) => {
    const c = pointW(i), y = TOP + lift;
    const p = virt(toCss(camera, c.x, y, c.z, { x: 0, y: 0 }));
    toCss(camera, c.x - 2, y, c.z, pa); toCss(camera, c.x + 2, y, c.z, pb);
    p.k = Math.hypot(pb.x - pa.x, pb.y - pa.y) / cpu() / 4 * (PR / PR2); return p;
  };
  const ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -TOP), hit = new THREE.Vector3(), ndc = new THREE.Vector2();
  const ground = (vx, vy) => {
    ndc.set(((vx * cpu() + offX()) / cssW()) * 2 - 1, 1 - ((vy * cpu() + offY()) / cssH()) * 2);
    ray.setFromCamera(ndc, camera); return ray.ray.intersectPlane(plane, hit) ? hit : null;
  };
  // the board point under a virtual-unit point (same reach as the flat art: 74 of 240 design units), or -1
  v3.pick = (vx, vy) => {
    const h = ground(vx, vy); if (!h) return -1;
    let best = -1, bd = Infinity;
    for (let i = 0; i < 9; i++) { const p = pointW(i), d = Math.hypot(p.x - h.x, p.z - h.z); if (d < bd) { bd = d; best = i; } }
    return bd < PR * 74 / 240 ? best : -1;
  };

  // ---------------------------------------------------------------- stones
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
  const counts = {}; let nBlob = 0;
  const begin = () => { for (const k in inst) counts[k] = 0; nBlob = 0; };
  const variant = (i, k) => Math.floor(hash(i * 3 + k, 9) * 3);
  function put(kind, v, x, y, z, yaw, tiltX = 0, tiltZ = 0) {
    const key = `${kind}${v % 3}`, m = inst[key]; if (!m || counts[key] >= CAP) return;
    _e.set(tiltX, yaw, tiltZ, 'YXZ'); _q.setFromEuler(_e); _s.set(1, 1, 1); _p.set(x, y, z);
    m.setMatrixAt(counts[key]++, _m.compose(_p, _q, _s));
    if (nBlob < CAP * 2) {
      const lift = Math.max(0, y - restY()), s = STONE_R * 2.5 * (1 + lift * 0.12);
      _p.set(x + lift * 0.5, TOP + 0.04, z + lift * 0.6); _q.identity(); _s.set(s, 1, s); blobs.setMatrixAt(nBlob++, _m.compose(_p, _q, _s));
    }
  }
  function end() {
    for (const k in inst) { inst[k].count = counts[k]; inst[k].instanceMatrix.needsUpdate = true; }
    blobs.count = nBlob; blobs.instanceMatrix.needsUpdate = true;
  }
  const yawOf = (i) => hash(i, 41) * TAU;
  let clock = 0, lastAnim = null;
  const settled = new Map();
  function drawBoard(g, a, sel, drag, calm, t) {
    const R0 = restY();
    if (a !== lastAnim) {
      if (lastAnim && !lastAnim.refuse && !calm) { settled.set(lastAnim.to, clock); const c = pointW(lastAnim.to); puff(c.x, c.z, 1); }
      lastAnim = a;
    }
    begin();
    const skip = a ? (a.refuse ? a.from : a.to) : -1;
    for (let i = 0; i < 9; i++) {
      const k = g.board[i]; if (!k || i === skip || (drag && i === drag.from)) continue;
      const c = pointW(i), st = settled.has(i) ? settlePose(clock - settled.get(i)) : { y: 0, tilt: 0 };
      let y = R0 + st.y;
      if (sel === i) y += 1.6 + (calm ? 0 : Math.sin(t * 4) * 0.25);
      put(k, variant(i, k), c.x, y, c.z, yawOf(i * 7 + k), 0, st.tilt);
    }
    for (const [i, t0] of settled) if (clock - t0 > SETTLE) settled.delete(i);
    if (a) {
      const P = movePose(a, calm), p = pointW(a.from), q = pointW(a.to), dx = q.x - p.x, dz = q.z - p.z, L = Math.hypot(dx, dz) || 1;
      put(a.side, variant(a.from, a.side), p.x + dx * P.k + P.shake * (-dz / L), R0 + P.lift, p.z + dz * P.k + P.shake * (dx / L), yawOf(a.from * 7 + a.side), (dz / L) * P.lean, -(dx / L) * P.lean);
    }
    if (drag) put(drag.kind, variant(drag.from, drag.kind), drag.x, R0 + 3, drag.z, yawOf(drag.from * 7 + drag.kind), 0.08, 0);
    end();
  }
  function drawRings(marks, b) {
    let k = 0;
    for (const mk of marks) {
      if (k >= rings.length || mk.sq < 0 || mk.sq > 8) continue;
      const r = rings[k++], c = pointW(mk.sq), s = STONE_R * 2 * mk.r * (b && b[mk.sq] ? 1.25 : 1.05);
      r.visible = true; r.position.set(c.x, TOP + 0.12, c.z); r.scale.set(s, 1, s);
      const [cr, cg, cb] = mk.rgb.split(',').map((v) => Number(v) / 255);
      r.material.color.setRGB(cr * cr * 1.25, cg * cg * 1.25, cb * cb * 1.25); r.material.opacity = clamp(mk.a, 0, 1);
    }
    for (; k < rings.length; k++) rings[k].visible = false;
  }

  // ---------------------------------------------------------------- the title's own demonstration game (presentation only)
  const demo = { g: newGame(), anim: null, wait: 1.6, n: 0 };
  function demoStep(dt, calm) {
    if (calm) return;
    if (demo.anim) { demo.anim.t += dt; if (demo.anim.t >= demo.anim.dur) demo.anim = null; return; }
    demo.wait -= dt; if (demo.wait > 0) return;
    if (demo.g.winner || demo.n > 36) { demo.g = newGame(); demo.n = 0; demo.wait = 1.6; return; }
    // safe moves only (never one that loses by force), chosen by a fixed hash: the menu shows a thoughtful game
    const r = rate(demo.g.board, demo.g.turn), safe = r.filter((x) => x.v >= 0), pool = safe.length ? safe : r;
    const m = pool[Math.floor(hash(demo.n, 5) * pool.length)].m, side = demo.g.turn;
    applyMove(demo.g, m); demo.n++;
    demo.anim = { from: m.from, to: m.to, side, t: 0, dur: 0.6, refuse: false }; demo.wait = 2.2;
  }

  // ---------------------------------------------------------------- per frame
  let game = null, lost = false, lastNow = 0, frameAvg = 16, slowFrames = 0, fadeIn = 0;
  const isBoard = (state) => BOARD_SCENES.has(state.scene) && !!(state.scene === 'auto' ? state.auto : state.game);
  function framing(state, L) {
    const calm = state.calm, t = clock;
    if (isBoard(state)) {
      const kind = state.scene === 'auto' ? (state.auto?.phase === 'over' ? 'autoover' : 'auto') : state.scene;
      const B = L.play(kind).board, half = 338 * B.k, rc = rectCss({ x: B.cx - half, y: B.cy - half, w: 2 * half, h: 2 * half });
      const e = TIP + 1, pts = [];
      for (let i = 0; i < 8; i++) { const a = -Math.PI / 2 + i * TAU / 8; pts.push([Math.cos(a) * e, TOP, Math.sin(a) * e]); }
      pts.push([0, 0.4, e + 1]);
      return fit(rc, pts, { yaw: 0, tilt: L.mode === 'wide' ? 58 : 62, fov: 28, tx: 0, ty: TOP, tz: 0 });
    }
    const drift = calm ? 0 : 1;
    const base = { yaw: -14 + 8 * Math.sin(t * TAU / 34) * drift, tilt: (L.w > L.h ? 19 : 15) + 2 * Math.sin(t * TAU / 21) * drift, fov: L.w > L.h ? 40 : 56, tx: 0, ty: TOP * 0.6, tz: 0 };
    const pts = []; for (let i = 0; i < 8; i++) { const a = -Math.PI / 2 + i * TAU / 8; pts.push([Math.cos(a) * TIP, TOP, Math.sin(a) * TIP], [Math.cos(a) * TIP, 0, Math.sin(a) * TIP]); }
    let r = v3.hero; if (!r) { const U = L.U; r = { x: U.x0 + U.w * 0.2, y: U.y0 + U.h * 0.25, w: U.w * 0.6, h: U.h * 0.3 }; }
    return fit(rectCss(r), pts, base);
  }
  let wasBoard = null;
  function pre() {
    if (!game || lost) return;
    const state = game.getState(), L = layoutFor(meta.width, meta.height), board = isBoard(state);
    const vk = `${cssW()}x${cssH()}|${L.key}`; if (vk !== viewKey) { viewKey = vk; snap = true; }
    if (wasBoard !== board) { wasBoard = board; if (board) snap = true; }      // a board screen is exact from its first frame (taps, rings)
    const now = performance.now(), dt = clamp((now - (lastNow || now)) / 1000, 0, 0.1);
    const goal = framing(state, L);
    const k = snap || board ? 1 : 1 - Math.exp(-dt * 5);
    for (const key of Object.keys(goal)) cur[key] += (goal[key] - cur[key]) * k;
    snap = false;
    place(camera, cur);
    v3.marks.length = 0;
  }
  function post() {
    if (!game || lost) return;
    const now = performance.now(), dt = clamp((now - (lastNow || now)) / 1000, 0, 0.1); lastNow = now; clock += dt;
    const state = game.getState(), calm = state.calm, boardOn = isBoard(state);
    setBoard();
    let g, a = null, sel = -1, drag = null;
    if (boardOn) {
      const auto = state.scene === 'auto'; g = auto ? state.auto.game : state.game; a = auto ? state.auto.anim : state.anim;
      if (!auto) {
        sel = state.sel;
        if (state.drag && state.drag.moved) { const h = ground(state.drag.x, state.drag.y - 24); if (h) drag = { from: state.drag.from, kind: g.board[state.drag.from], x: h.x, z: h.z }; }
      }
    } else { demoStep(dt, calm); g = demo.g; a = demo.anim; }
    drawBoard(g, a || null, sel, drag, calm, state.t);
    if (boardOn && sel >= 0 && !a && !drag) v3.marks.push({ sq: sel, rgb: '255,226,140', r: 1.05, a: 0.95 });
    drawRings(boardOn ? v3.marks : [], g.board);
    for (const m of dust) {
      const u = m.userData; if (!(u.t <= 0.5)) { m.visible = false; continue; }
      u.t += dt; const f = Math.min(1, u.t / 0.5), s = (STONE_R * 2 + f * 5) * u.s;
      m.visible = true; m.position.set(u.x, TOP + 0.1 + f * 0.5, u.z); m.scale.set(s, 1, s); m.material.opacity = 0.4 * (1 - f) * (1 - f);
    }
    // the harakeke moves in the sea breeze
    if (!calm) land.bushes.forEach((b, i) => { b.rotation.z = Math.sin(clock * 0.9 + i * 1.7) * 0.025; b.rotation.x = Math.sin(clock * 0.7 + i) * 0.02; });
    if (fadeIn < 1) { fadeIn = Math.min(1, fadeIn + dt / 0.4); v3.fade = fadeIn; }
    renderer.setSize(cssW(), cssH(), false);
    renderer.render(scene, camera);
    const ft = dt * 1000; if (ft > 0) frameAvg = frameAvg * 0.95 + ft * 0.05;
    if (frameAvg > 26 && tier < 2) { if (++slowFrames > 90) { tier++; slowFrames = 0; frameAvg = 16; applyTier(); } } else slowFrames = 0;
  }

  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; v3.on = false; canvas.style.visibility = 'hidden'; });
  canvas.addEventListener('webglcontextrestored', () => {
    lost = false; buildEnv(); if (board) { scene.remove(board); board.userData.dispose(); board = null; }
    applyTier(); fadeIn = 0; v3.fade = 0; v3.on = true; canvas.style.visibility = 'visible'; snap = true;
  });

  await tick();
  setBoard(); await tick();
  place(camera, cur); try { renderer.compile(scene, camera); } catch { /* compiled lazily */ }
  await tick();

  return {
    ok: true, renderer, scene, camera,
    attach(g) { game = g; v3.on = true; v3.fade = 0; fadeIn = 0; canvas.style.visibility = 'visible'; snap = true; },
    pre, post,
    get tier() { return TIERS[tier].name; },
    get clock() { return clock; },
    loseContext() { const ext = renderer.getContext().getExtension('WEBGL_lose_context'); ext?.loseContext(); return ext; },
  };
}
