// Fanorona 3D presenter. READS the game state (peek) and the 2D view's hand-off (src/v3.js); never writes the sim.
// One WebGL canvas behind the kit's transparent 2D canvas: the carved rosewood board on a woven mat under a baobab sunset, the turned stones.
// The camera is fitted to the layout's board area (play), or the title's hero rectangle (menu), and tapped points go through it (v3.pick).
// No WebGL, ?flat=1 or a lost context: v3.on = false and every screen draws the flat 2D art; a restored context returns to 3D.
import * as THREE from '../vendor3d/three.js';
import { v3 } from '../src/v3.js';
import { layoutFor, canonXY, S0 } from '../src/layout.js';
import { meta } from '../src/game.js';
import { ROWS, COLS } from '../src/rules.js';
import { themeOf } from '../src/art.js';
import {
  SP, TOP, BOARD_W, BOARD_L, pointW, hash, buildBoard, buildScenery, buildLights, stoneMats, makeStone, radialTex, ringTex, FOG,
} from './world.js';

const TAU = Math.PI * 2, D2R = Math.PI / 180;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const easeInOut = (t) => { t = clamp(t, 0, 1); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
const easeOut = (t) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
const TIERS = [{ name: 'high', dpr: 2, shadow: 2048, field: 1536 }, { name: 'medium', dpr: 1.5, shadow: 1024, field: 1024 }, { name: 'low', dpr: 1, shadow: 0, field: 1024 }];
const tick = () => new Promise((r) => setTimeout(r, 0));
const POOL = 26;

export async function createPresenter({ kitCanvas, getState }) {
  const qs = new URLSearchParams(location.search);
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;height:100dvh;display:block;pointer-events:none;z-index:0;visibility:hidden';
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' }); } catch (e) { console.warn('WebGL unavailable; flat 2D art', e); return { ok: false }; }
  if (!renderer.getContext()) return { ok: false };
  kitCanvas.parentElement.insertBefore(canvas, kitCanvas);
  kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  let tier = qs.has('tier') ? clamp(Number(qs.get('tier')), 0, 2) : (navigator.hardwareConcurrency || 8) <= 4 ? 1 : 0;

  await tick();
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(FOG, 480, 2300);
  const camera = new THREE.PerspectiveCamera(28, 1, 4, 5000);
  const lights = buildLights(scene);
  const buildEnv = () => { try { const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture; pm.dispose(); scene.environmentIntensity = 0.35; } catch { /* no IBL */ } };
  buildEnv();
  await tick();
  scene.add(buildScenery());
  await tick();

  // the board (built per theme, cached) and the stone pools
  const root = new THREE.Group(); scene.add(root);
  const sets = new Map(); let set = null, themeKey = '';
  const stones = { 1: [], 2: [] };
  function setTheme(name) {
    if (name === themeKey) return; themeKey = name;
    if (set) { set.board.visible = false; for (const s of [...set.p1, ...set.p2]) s.visible = false; }
    let s = sets.get(name);
    if (!s) {
      const T = themeOf(name), M = stoneMats(T), board = buildBoard(T, TIERS[tier].field);
      root.add(board);
      const mk = (side) => Array.from({ length: POOL }, () => { const o = makeStone(side, M); o.visible = false; scene.add(o); return o; });
      s = { T, M, board, p1: mk(1), p2: mk(2) }; sets.set(name, s);
    }
    set = s; set.board.visible = true; stones[1] = set.p1; stones[2] = set.p2;
  }
  const flat = new THREE.PlaneGeometry(1, 1); flat.rotateX(-Math.PI / 2);
  const rT = ringTex(), dT = radialTex('255,255,255', 1);
  const pool = (tex, n, order) => Array.from({ length: n }, () => { const m = new THREE.Mesh(flat, new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); m.renderOrder = order; m.visible = false; scene.add(m); return m; });
  const rings = pool(rT, 48, 5), fills = pool(dT, 48, 4);

  // dust in the sunlight, and sparks / dust puffs when stones land or are taken
  const MOTES = 90, moteGeo = new THREE.BufferGeometry(), moteP = new Float32Array(MOTES * 3); moteGeo.setAttribute('position', new THREE.BufferAttribute(moteP, 3));
  const motes = new THREE.Points(moteGeo, new THREE.PointsMaterial({ map: radialTex('255,214,150', 1, 32), size: 1.9, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.55, fog: false })); motes.frustumCulled = false; scene.add(motes);
  const SPK = 56, spkGeo = new THREE.BufferGeometry(), spkP = new Float32Array(SPK * 3), spkC = new Float32Array(SPK * 3); spkGeo.setAttribute('position', new THREE.BufferAttribute(spkP, 3)); spkGeo.setAttribute('color', new THREE.BufferAttribute(spkC, 3));
  const spk = new THREE.Points(spkGeo, new THREE.PointsMaterial({ map: radialTex('255,255,255', 1, 32), size: 2.6, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); spk.frustumCulled = false; scene.add(spk);
  const sparks = Array.from({ length: SPK }, () => ({ t: 9, x: 0, y: -50, z: 0, vx: 0, vy: 0, vz: 0, c: [1, 0.8, 0.4] })); let spkI = 0;
  function burst(x, z, n, col, up = 22) {
    for (let k = 0; k < n; k++) { const s = sparks[spkI++ % SPK], a = hash(spkI, 3) * TAU, v = 6 + hash(spkI, 4) * 16; Object.assign(s, { t: 0, x: x + Math.cos(a) * 1.5, y: TOP + 1.5, z: z + Math.sin(a) * 1.5, vx: Math.cos(a) * v, vz: Math.sin(a) * v, vy: up * (0.4 + hash(spkI, 5)), c: col }); }
  }
  function updateFx(t, dt) {
    for (let i = 0; i < MOTES; i++) { const a = hash(i, 4) * TAU, r = 30 + hash(i, 3) * 170, sp = 0.02 + hash(i, 7) * 0.04; moteP[i * 3] = Math.cos(a + t * sp) * r + Math.sin(t * 0.5 + i) * 5; moteP[i * 3 + 1] = 8 + ((hash(i, 2) * 90 + t * (2 + hash(i, 8) * 3)) % 90); moteP[i * 3 + 2] = Math.sin(a + t * sp) * r * 0.7 - 20; }
    moteGeo.attributes.position.needsUpdate = true;
    for (let i = 0; i < SPK; i++) {
      const s = sparks[i]; s.t += dt;
      if (s.t > 0.9) { spkP[i * 3 + 1] = -50; spkC[i * 3] = spkC[i * 3 + 1] = spkC[i * 3 + 2] = 0; continue; }
      s.x += s.vx * dt; s.z += s.vz * dt; s.vx *= 0.95; s.vz *= 0.95; s.vy -= 55 * dt; s.y = Math.max(TOP + 0.3, s.y + s.vy * dt);
      const f = 1 - s.t / 0.9; spkP[i * 3] = s.x; spkP[i * 3 + 1] = s.y; spkP[i * 3 + 2] = s.z; spkC[i * 3] = s.c[0] * f; spkC[i * 3 + 1] = s.c[1] * f; spkC[i * 3 + 2] = s.c[2] * f;
    }
    spkGeo.attributes.position.needsUpdate = true; spkGeo.attributes.color.needsUpdate = true;
  }
  function applyTier() {
    const t = TIERS[tier];
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, t.dpr));
    renderer.shadowMap.enabled = t.shadow > 0; lights.key.castShadow = t.shadow > 0;
    if (t.shadow) { lights.key.shadow.mapSize.set(t.shadow, t.shadow); if (lights.key.shadow.map) { lights.key.shadow.map.dispose(); lights.key.shadow.map = null; } }
    scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => { m.needsUpdate = true; }); });
  }

  // ---------------------------------------------------------------- camera: tilt/yaw/fov per screen, distance + off-axis shift fitted to a rectangle
  const cur = { yaw: 0, tilt: 52, fov: 28, dist: 220, ox: 0, oy: 0, tx: 0, ty: TOP, tz: 0 };
  let snap = true, viewKey = '', orient = 'h', flip = false;
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
    const p = { ...base, ox: 0, oy: 0, dist: 200 }, q = { x: 0, y: 0 }; let bb = null;
    for (let it = 0; it < 10; it++) {
      place(fitCam, p); bb = { x0: 1e9, y0: 1e9, x1: -1e9, y1: -1e9 };
      for (const [x, y, z] of pts) { toCss(fitCam, x, y, z, q); bb.x0 = Math.min(bb.x0, q.x); bb.x1 = Math.max(bb.x1, q.x); bb.y0 = Math.min(bb.y0, q.y); bb.y1 = Math.max(bb.y1, q.y); }
      const s = Math.min(rc.w / Math.max(1, bb.x1 - bb.x0), rc.h / Math.max(1, bb.y1 - bb.y0));
      if (Math.abs(s - 1) < 0.002) break; p.dist /= s;
    }
    p.ox = (bb.x0 + bb.x1) / 2 - (rc.x + rc.w / 2); p.oy = (bb.y0 + bb.y1) / 2 - (rc.y + rc.h / 2);
    return p;
  }
  const cpu = () => Math.min(cssW(), cssH()) / 720;
  const offX = () => (cssW() - meta.width * cpu()) / 2, offY = () => (cssH() - meta.height * cpu()) / 2;
  const rectCss = (r) => ({ x: r.x * cpu() + offX(), y: r.y * cpu() + offY(), w: r.w * cpu(), h: r.h * cpu() });
  const virt = (q) => ({ x: (q.x - offX()) / cpu(), y: (q.y - offY()) / cpu() });

  // canonical board units (the 2D layout's frame, which already includes orientation and flip) <-> world
  const mid = () => (orient === 'h' ? [4 * S0, 2 * S0] : [2 * S0, 4 * S0]);
  const cw = (cx, cy) => { const [mx, my] = mid(); return { x: (cx - mx) / S0 * SP, z: (cy - my) / S0 * SP }; };
  const wp = (p) => { const c = canonXY(p, flip, orient); return cw(c.x, c.y); };
  const _a = { x: 0, y: 0 }, _b = { x: 0, y: 0 }, _c = { x: 0, y: 0 };
  v3.cv = (cx, cy, lift = 0) => { const w = cw(cx, cy); return virt(toCss(camera, w.x, TOP + lift, w.z, { x: 0, y: 0 })); };
  const kAt = () => { toCss(camera, -SP / 2, TOP, 0, _a); toCss(camera, SP / 2, TOP, 0, _b); return Math.hypot(_b.x - _a.x, _b.y - _a.y) / cpu() / S0; };
  v3.pick = (x, y, fl, tolFrac, ori) => {
    orient = ori; flip = !!fl;
    const px = x * cpu() + offX(), py = y * cpu() + offY(); let best = -1, bd = tolFrac * tolFrac;
    for (let p = 0; p < ROWS * COLS; p++) {
      const w = wp(p); toCss(camera, w.x, TOP + 1.2, w.z, _c); toCss(camera, w.x - SP / 2, TOP + 1.2, w.z, _a); toCss(camera, w.x + SP / 2, TOP + 1.2, w.z, _b);
      const sx = Math.hypot(_b.x - _a.x, _b.y - _a.y); toCss(camera, w.x, TOP + 1.2, w.z - SP / 2, _a); toCss(camera, w.x, TOP + 1.2, w.z + SP / 2, _b); const sy = Math.hypot(_b.x - _a.x, _b.y - _a.y);
      const d = ((px - _c.x) / Math.max(1, sx)) ** 2 + ((py - _c.y) / Math.max(1, sy)) ** 2;
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  };
  const rcast = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -(TOP + 3)), hit = new THREE.Vector3();
  const unproject = (vx, vy) => { const px = vx * cpu() + offX(), py = vy * cpu() + offY(); ndc.set(px / cssW() * 2 - 1, -(py / cssH()) * 2 + 1); rcast.setFromCamera(ndc, camera); return rcast.ray.intersectPlane(plane, hit) ? hit : null; };

  // ---------------------------------------------------------------- framing per screen
  const boardScene = (S) => S.scene === 'play' || S.scene === 'learn' || S.scene === 'auto';
  const heroScene = (S) => S.scene === 'title';
  const boxPts = (o) => { const x = (o === 'h' ? BOARD_W : BOARD_L) / 2, z = (o === 'h' ? BOARD_L : BOARD_W) / 2, h = TOP + 5; return [[-x, TOP - 3, -z], [x, TOP - 3, -z], [-x, TOP - 3, z], [x, TOP - 3, z], [-x, h, -z], [x, h, -z]]; };
  function framing(S, L, t) {
    if (boardScene(S)) { const a = L.board.area, m = 0.045 * Math.min(a.w, a.h); return fit(rectCss({ x: a.x + m, y: a.y + m, w: a.w - 2 * m, h: a.h - 2 * m }), boxPts(L.board.orient), { yaw: 0, tilt: L.board.orient === 'v' ? 54 : 50, fov: L.board.orient === 'v' ? 17 : 24, tx: 0, ty: TOP, tz: 0 }); }
    const r = v3.hero || { x: 0, y: L.h * 0.08, w: L.w, h: L.h * 0.5 };
    const low = { x: r.x + r.w * 0.04, y: r.y + r.h * 0.5, w: r.w * 0.92, h: r.h * 0.46 };
    return fit(rectCss(low), boxPts('h'), { yaw: 10 * Math.sin(t * TAU / 38), tilt: 9 + 1.2 * Math.sin(t * TAU / 27), fov: 48, tx: 0, ty: TOP, tz: 0 });
  }

  // ---------------------------------------------------------------- stones
  let clock = 0, lastAnim = null; const fxDone = new WeakSet();
  function stoneItems(S, hero) {
    const items = [];
    if (hero) {
      const d = v3.heroDemo; if (!d) return items;
      for (let p = 0; p < ROWS * COLS; p++) {
        const side = d.board[p]; if (!side) continue;
        let w = pointW(p), y = 0, s = 1;
        if (p === d.from) { const a = pointW(d.from), b = pointW(d.to), e = easeInOut(d.mv) * (1 - easeInOut(d.back)); w = { x: a.x + (b.x - a.x) * e, z: a.z + (b.z - a.z) * e }; y = Math.sin(Math.PI * clamp(d.mv, 0, 1)) * (1 - d.back) * 3.4; }
        if (d.victims.includes(p)) { const e = easeOut(d.pop) * (1 - easeOut(d.back)); s = Math.max(0.001, 1 - e); y = e * 2; }
        items.push({ side, x: w.x, z: w.z, y, s });
      }
      return items;
    }
    const an = S.anim, vb = S.vboard, hideFrom = an ? an.from : -1, dragP = S.drag && S.drag.moved ? S.drag.p : -1;
    const victims = an && an.t > an.slide ? new Set(an.victims) : null;
    for (let p = 0; p < ROWS * COLS; p++) {
      const side = vb[p]; if (!side || p === hideFrom || p === dragP) continue;
      if (an && an.to === p && an.t < an.slide) continue;
      const w = wp(p); let y = 0, s = 1;
      if (S.sel === p) y = 1.4 + Math.sin(clock * 3.2) * 0.25;
      if (victims && victims.has(p)) { const k = easeOut((an.t - an.slide) / an.pop); s = Math.max(0.001, 1 - k); y = k * 2.4; }
      items.push({ side, x: w.x, z: w.z, y, s });
    }
    if (an) {
      const a = wp(an.from), b = wp(an.to), k = easeInOut(an.t / an.slide), kk = clamp(an.t / an.slide, 0, 1), lift = Math.sin(Math.PI * kk);
      items.push({ side: an.side, x: a.x + (b.x - a.x) * k, z: a.z + (b.z - a.z) * k, y: lift * 3.4, s: 1 + lift * 0.05 });
    }
    if (S.drag && S.drag.moved) { const q = unproject(S.drag.x, S.drag.y - 24); if (q) items.push({ side: S.g.turn, x: q.x, z: q.z, y: 3.2, s: 1.06 }); }
    return items;
  }
  function updateStones(S, hero) {
    const items = stoneItems(S, hero), used = { 1: 0, 2: 0 };
    for (const it of items) {
      const o = stones[it.side]?.[used[it.side]++]; if (!o) continue;
      o.visible = true; o.position.set(it.x, TOP + 0.02 + it.y, it.z); o.scale.setScalar(it.s);
    }
    for (const side of [1, 2]) for (let i = used[side]; i < POOL; i++) stones[side][i].visible = false;
    // fx: a puff where a stone lands, sparks where stones are taken
    const an = hero ? null : S.anim;
    if (lastAnim && lastAnim !== an && !hero) { const w = wp(lastAnim.to); burst(w.x, w.z, 6, [1, 0.72, 0.4], 9); }
    if (an && an.t > an.slide && !fxDone.has(an)) { fxDone.add(an); for (const v of an.victims) { const w = wp(v); burst(w.x, w.z, 7, an.side === 1 ? [0.5, 0.35, 0.3] : [1, 0.9, 0.6], 20); } }
    lastAnim = an;
  }
  function drawMarks(marks, t) {
    let r = 0, f = 0;
    for (const mk of marks) {
      const w = cw(mk.x, mk.y), ring = mk.dot ? null : rings[r++], fill = fills[f++]; if ((!mk.dot && !ring) || !fill) continue;
      const [cr, cg, cb] = mk.rgb.split(',').map((v) => Number(v) / 255), size = 2 * (mk.r / S0) * SP;
      const fs = mk.dot ? size * 1.7 : size * 1.25;
      fill.visible = true; fill.position.set(w.x, TOP + 0.5, w.z); fill.scale.set(fs, 1, fs); fill.material.color.setRGB(cr, cg, cb); fill.material.opacity = clamp(mk.a * (mk.dot ? 0.95 : 0.26), 0, 1);
      if (ring) { const s = size / 0.78 * (1 + Math.sin(t * 4) * 0.015); ring.visible = true; ring.position.set(w.x, TOP + 0.55, w.z); ring.scale.set(s, 1, s); ring.material.color.setRGB(cr, cg, cb); ring.material.opacity = clamp(mk.a + 0.2, 0, 1); }
    }
    for (; r < rings.length; r++) rings[r].visible = false;
    for (; f < fills.length; f++) fills[f].visible = false;
  }

  // ---------------------------------------------------------------- per frame
  let lost = false, lastNow = 0, frameAvg = 16, slowFrames = 0, fadeIn = 0, attached = false, active = false;
  function pre() {
    if (!attached || lost) return;
    const S = getState(); if (!S) return;
    const L = layoutFor(meta.width, meta.height);
    orient = boardScene(S) ? L.board.orient : 'h'; flip = boardScene(S) && !!S.flip;
    const vk = `${cssW()}x${cssH()}|${L.key}|${boardScene(S)}`; if (vk !== viewKey) { viewKey = vk; snap = true; }
    const now = performance.now(), dt = clamp((now - (lastNow || now)) / 1000, 0, 0.1);
    const goal = framing(S, L, clock + dt);
    const k = snap ? 1 : 1 - Math.exp(-dt * 4.5);
    for (const key of Object.keys(goal)) cur[key] += (goal[key] - cur[key]) * k;
    snap = false;
    place(camera, cur);
    root.rotation.y = orient === 'v' ? -Math.PI / 2 : 0;
    v3.k = kAt();
    v3.marks.length = 0;
    active = boardScene(S) || heroScene(S);
  }
  function post() {
    if (!attached || lost) return;
    const S = getState(); if (!S) return;
    const now = performance.now(), dt = clamp((now - (lastNow || now)) / 1000, 0, 0.1); lastNow = now; clock += dt;
    if (!active) { canvas.style.visibility = 'hidden'; return; }                       // reading pages / settings are opaque 2D: no GPU work
    canvas.style.visibility = 'visible';
    setTheme(S.theme === 'ebony' || S.theme === 'paper' ? S.theme : 'rosewood');
    const hero = heroScene(S);
    updateStones(S, hero);
    drawMarks(hero ? [] : v3.marks, clock);
    updateFx(clock, dt);
    if (fadeIn < 1) { fadeIn = Math.min(1, fadeIn + dt / 0.5); v3.fade = fadeIn; canvas.style.opacity = String(fadeIn); } else canvas.style.opacity = '1';
    renderer.setSize(cssW(), cssH(), false);
    renderer.render(scene, camera);
    const ft = dt * 1000; if (ft > 0) frameAvg = frameAvg * 0.95 + ft * 0.05;
    if (frameAvg > 26 && tier < 2) { if (++slowFrames > 90) { tier++; slowFrames = 0; frameAvg = 16; applyTier(); } } else slowFrames = 0;
  }

  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; v3.on = false; canvas.style.visibility = 'hidden'; });
  canvas.addEventListener('webglcontextrestored', () => {
    lost = false; buildEnv();
    scene.traverse((o) => { if (o.material) for (const m of [].concat(o.material)) for (const kk of ['map', 'bumpMap']) if (m[kk]) m[kk].needsUpdate = true; });
    applyTier(); fadeIn = 0; v3.fade = 0; v3.on = true; canvas.style.visibility = 'visible'; snap = true;
  });

  setTheme('rosewood'); await tick();
  applyTier();
  place(camera, cur); try { renderer.compile(scene, camera); } catch { /* compiled lazily */ }
  await tick();

  return {
    ok: true, renderer, scene, camera, cur,
    attach() { attached = true; v3.on = true; v3.fade = 0; fadeIn = 0; snap = true; },
    pre, post, place,
    get tier() { return TIERS[tier].name; },
    loseContext() { const ext = renderer.getContext().getExtension('WEBGL_lose_context'); ext?.loseContext(); return ext; },
    restoreContext(ext) { ext?.restoreContext(); },
  };
}
