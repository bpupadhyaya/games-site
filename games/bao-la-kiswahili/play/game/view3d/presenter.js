// Bao la Kiswahili 3D presenter. READS the game state (game.getState()), never writes it. One WebGL canvas sits behind the kit's transparent
// 2D canvas: a carved teak bao board on a kanga cloth, seeds resting in its pits, on a coral-stone veranda with a lattice screen and a
// carved Zanzibar door. The camera is fitted to the layout's board rectangle (play) or hero rectangle (title), so the 2D HUD, rings and
// taps line up with the tilted board through v3.pit / v3.pick. No WebGL, ?flat=1 or a lost context: v3.on = false and every screen draws
// the flat 2D art; a restored context rebuilds the environment and returns to 3D.
import * as THREE from '../vendor3d/three.js';
import { v3 } from '../src/v3.js';
import { meta } from '../src/game.js';
import { layoutFor, GEOMS } from '../src/layout.js';
import { newGame } from '../src/rules.js';
import { PITCH2D, COLW, WROW, TOP, RIM, SEED_R, HX, HZ, BOARD_Y, SX, PITS, pitWorld, localToWorld, buildBoard, seedKit, seedSlot, tintOf, SEEDSETS3, buildVeranda, buildLights, radialTex } from './world.js';

const TAU = Math.PI * 2, D2R = Math.PI / 180, CAP = 150, R0 = BOARD_Y + RIM;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const TIERS = [{ name: 'high', dpr: 2, shadow: 2048, tex: 2048 }, { name: 'medium', dpr: 1.5, shadow: 1024, tex: 1536 }, { name: 'low', dpr: 1, shadow: 0, tex: 1024 }];
const tick = () => new Promise((r) => setTimeout(r, 0));
const BOARD_SCENES = new Set(['play', 'over', 'lesson', 'autoplay', 'autoplay-over']);
const START = newGame();

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
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.82;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  let tier = qs.has('tier') ? clamp(Number(qs.get('tier')), 0, 2) : (navigator.hardwareConcurrency || 8) <= 4 ? 1 : 0;

  await tick();
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a120d);
  scene.fog = new THREE.Fog(0x2a1a10, 260, 900);
  const camera = new THREE.PerspectiveCamera(30, 1, 2, 3000);
  const lights = buildLights(scene);
  const buildEnv = () => { try { const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture; pm.dispose(); scene.environmentIntensity = 0.5; } catch { /* no IBL */ } };
  buildEnv();
  await tick();
  const set = buildVeranda(scene, { quality: tier < 2 ? 1 : 0 });
  await tick();

  // ---- boards (cached per wood) and seeds (one instanced mesh per set)
  const boards = new Map(); let board = null, boardKey = '';
  function setBoard(wood) {
    const k = `${wood}|${TIERS[tier].tex}`; if (k === boardKey) return;
    let b = boards.get(k); if (!b) { b = buildBoard(wood, TIERS[tier].tex); boards.set(k, b); }
    if (board) scene.remove(board); board = b; boardKey = k; scene.add(b);
  }
  const kits = {}, inst = {};
  for (const s of SEEDSETS3) { kits[s] = seedKit(s); const m = new THREE.InstancedMesh(kits[s].geo, kits[s].mat, CAP); m.castShadow = true; m.receiveShadow = true; m.count = 0; m.frustumCulled = false; m.setColorAt(0, new THREE.Color(1, 1, 1)); scene.add(m); inst[s] = m; }
  const flatQuad = new THREE.PlaneGeometry(1, 1); flatQuad.rotateX(-Math.PI / 2);
  const blobs = new THREE.InstancedMesh(flatQuad, new THREE.MeshBasicMaterial({ map: radialTex('0,0,0', 0.9), transparent: true, depthWrite: false, opacity: 0.5 }), 40);
  blobs.renderOrder = 1; blobs.frustumCulled = false; blobs.count = 0; scene.add(blobs);
  // rings (legal pits, selection, hints) as light lying in the pits; the nyumba is square
  const ringTex = (sq) => {
    const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
    const g = x.createRadialGradient(64, 64, 20, 64, 64, 64); g.addColorStop(0, 'rgba(255,255,255,0.22)'); g.addColorStop(0.55, 'rgba(255,255,255,0.35)'); g.addColorStop(0.7, 'rgba(255,255,255,1)'); g.addColorStop(0.84, 'rgba(255,255,255,0.9)'); g.addColorStop(0.94, 'rgba(255,255,255,0.3)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    if (!sq) { x.fillStyle = g; x.fillRect(0, 0, 128, 128); } else {
      for (let i = 0; i < 6; i++) { x.strokeStyle = `rgba(255,255,255,${i < 2 ? 1 : 0.35 - i * 0.04})`; x.lineWidth = 7 - i; x.beginPath(); x.roundRect(14 + i * 1.5, 14 + i * 1.5, 100 - i * 3, 100 - i * 3, 18); x.stroke(); }
      x.fillStyle = 'rgba(255,255,255,0.18)'; x.beginPath(); x.roundRect(18, 18, 92, 92, 16); x.fill();
    }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  };
  const ringTs = [ringTex(false), ringTex(true)];
  const rings = Array.from({ length: 48 }, () => { const m = new THREE.Mesh(flatQuad, new THREE.MeshBasicMaterial({ map: ringTs[0], transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); m.renderOrder = 3; m.visible = false; scene.add(m); return m; });
  const ringBurst = Array.from({ length: 6 }, () => { const m = new THREE.Mesh(flatQuad, new THREE.MeshBasicMaterial({ map: ringTs[0], transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, color: 0xffd78a })); m.renderOrder = 3; m.visible = false; m.userData = { t: 9 }; scene.add(m); return m; });
  let burstI = 0, lastBurst = -9;
  const burst = (x, z, s = 1) => { if (clock - lastBurst < 0.5) return; lastBurst = clock; const m = ringBurst[burstI++ % ringBurst.length]; m.userData = { t: 0, x, z, s }; };
  function applyTier() {
    const t = TIERS[tier];
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, t.dpr));
    renderer.shadowMap.enabled = t.shadow > 0; lights.sun.castShadow = t.shadow > 0;
    if (t.shadow) { lights.sun.shadow.mapSize.set(t.shadow, t.shadow); if (lights.sun.shadow.map) { lights.sun.shadow.map.dispose(); lights.sun.shadow.map = null; } }
    blobs.material.opacity = t.shadow ? 0.4 : 0.6;
    scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => { m.needsUpdate = true; }); });
  }
  applyTier();

  // ---------------------------------------------------------------- camera: yaw/tilt/fov per screen, distance + off-axis shift fitted to a rectangle
  const cur = { yaw: 0, tilt: 60, fov: 28, dist: 200, ox: 0, oy: 0, tx: 0, ty: TOP * 0.5, tz: 0 };
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
    const p = { ...base, ox: 0, oy: 0, dist: 200 }, q = { x: 0, y: 0 }; let bb = null;
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
  let geomNow = GEOMS.tall, gk = 1;
  const pa = { x: 0, y: 0 }, pb = { x: 0, y: 0 };
  const project = (x, y, z) => {
    const p = virt(toCss(camera, x, y, z, { x: 0, y: 0 }));
    toCss(camera, x - COLW / 2, y, z, pa); toCss(camera, x + COLW / 2, y, z, pb);
    p.k = Math.hypot(pb.x - pa.x, pb.y - pa.y) / cpu() / (PITCH2D * gk); return p;
  };
  v3.pit = (p, r, lift = 0) => { const P = pitWorld(p, r); return project(P.x, R0 + lift, P.z); };
  v3.at = (lx, ly, lift = 0) => { const w = localToWorld(lx, ly, geomNow); return project(w.x, R0 + lift, w.z); };
  const ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -R0), hit = new THREE.Vector3(), ndc = new THREE.Vector2();
  v3.pick = (p, vx, vy) => {
    ndc.set(((vx * cpu() + offX()) / cssW()) * 2 - 1, 1 - ((vy * cpu() + offY()) / cssH()) * 2);
    ray.setFromCamera(ndc, camera);
    if (!ray.ray.intersectPlane(plane, hit)) return -1;
    let best = -1, bd = 1e9;
    for (let r = 0; r < 16; r++) {
      const P = pitWorld(p, r), dx = Math.abs(hit.x - P.x), dz = Math.abs(hit.z - P.z);
      if (dx > COLW * 0.56 || dz > WROW * 0.56) continue;
      const d = dx * dx + dz * dz; if (d < bd) { bd = d; best = r; }
    }
    return best;
  };

  // ---------------------------------------------------------------- seeds
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _c = new THREE.Color();
  let set3 = 'mbono'; const counts = {}; let nBlob = 0;
  const begin = () => { for (const s of SEEDSETS3) counts[s] = 0; nBlob = 0; };
  function seed(x, y, z, yaw, tx, tz, v, sc = 1, blob = 0) {
    const m = inst[set3]; if (counts[set3] >= CAP) return;
    _e.set(tx, yaw, tz, 'YXZ'); _q.setFromEuler(_e); _s.set(sc, sc, sc); _p.set(x, y, z);
    const i = counts[set3]++; m.setMatrixAt(i, _m.compose(_p, _q, _s)); m.setColorAt(i, _c.copy(tintOf(set3, v)));
    if (blob > 0 && nBlob < 40) { const s = SEED_R * 3.2 * (1 + (y - R0) * 0.08) * blob; blobs.setMatrixAt(nBlob++, _m.compose(_p.set(x + 0.35, R0 + 0.02, z + 0.5), _q.identity(), _s.set(s, 1, s))); }
  }
  function end() {
    for (const s of SEEDSETS3) { inst[s].count = counts[s]; inst[s].instanceMatrix.needsUpdate = true; if (inst[s].instanceColor) inst[s].instanceColor.needsUpdate = true; }
    blobs.count = nBlob; blobs.instanceMatrix.needsUpdate = true;
  }
  let clock = 0;
  function drawPosition(pos, state, A) {
    begin();
    const calm = state.calm, sh = state.shake;
    for (const P of PITS) {
      const n = pos.pits[P.p][P.r]; if (n <= 0) continue;
      const key = P.p * 16 + P.r, show = Math.min(n, 52);
      let dx = 0; if (sh && sh.p === P.p && sh.r === P.r && !calm) dx = Math.sin(sh.t * 60) * 0.5 * (1 - sh.t / 0.6);
      for (let k = 0; k < show; k++) {
        const s = seedSlot(key, k); let pop = 0;
        if (A && A.last && A.last.p === P.p && A.last.r === P.r && k === n - 1 && A.last.t < 0.14 && !calm) pop = 0.9 * (1 - A.last.t / 0.14);
        seed(P.x + s.x + dx, BOARD_Y + s.y + pop, P.z + s.z, s.rot, s.tx, s.tz, s.v);
      }
    }
    for (let p = 0; p < 2; p++) {   // the stores: seeds not yet put on the board lie in the trough
      const T = p === 0 ? geomNow.TRAY.s : geomNow.TRAY.n, n = pos.stock[p];
      for (let k = 0; k < n; k++) {
        const w = localToWorld(T.x + 260 + (k % 11) * 28 + (Math.floor(k / 11) % 2) * 9, T.y + 25 + Math.floor(k / 11) * 28, geomNow);
        seed(w.x, BOARD_Y + RIM - 1.5 + SEED_R * 0.82, w.z, (k * 2.39) % TAU, 0.2 * Math.sin(k), 0.2 * Math.cos(k * 1.7), (k * 3 + p) % 4);
      }
    }
    const V = A && A.vis;
    if (V) {
      if (V.place) {
        const P = V.place, e = P.f * P.f * (3 - 2 * P.f), a = localToWorld(P.x0 + (P.x1 - P.x0) * e, P.y0 + (P.y1 - P.y0) * e, geomNow), lift = Math.sin(Math.PI * e) * 6.5;
        seed(a.x, R0 + SEED_R * 0.9 + lift, a.z, e * 5, 0.3 * Math.sin(e * 6), 0, 1, 1.05, 0.9);
      }
      if (V.hand && V.hand.n > 0) {
        const H2 = V.hand, w = localToWorld(H2.x, H2.y, geomNow), n = Math.min(H2.n, 9), lift = 4.2 + (H2.hop || 0) * SX * 1.1;
        for (let k = 0; k < n; k++) { const a = k * 2.4 + clock * (calm ? 0 : 0.6), rd = 0.95 * Math.sqrt(k + 0.3); seed(w.x + Math.cos(a) * rd, R0 + lift + (k % 3) * 0.55, w.z + Math.sin(a) * rd, a * 1.7, 0.3 * k, 0.2 * k, (k * 3) % 4, 1, k === 0 ? 2.2 : 0); }
      }
      if (V.cap && !calm && V.cap.f < 0.25) { const w = localToWorld(V.cap.q.x, V.cap.q.y, geomNow); burst(w.x, w.z, 1); }
    }
    end();
  }
  function drawRings(marks) {
    let k = 0;
    for (const mk of marks) {
      if (k >= rings.length) break;
      const P = pitWorld(mk.p, mk.r), sq = mk.r === 4, r = rings[k++], s = (sq ? 9.2 : 8.8) * (mk.big || 1);
      r.visible = true; r.position.set(P.x, R0 + 0.12, P.z); r.scale.set(s, 1, s); r.material.map = ringTs[sq ? 1 : 0];
      const [cr, cg, cb] = mk.rgb.split(',').map((v) => Number(v) / 255);
      r.material.color.setRGB(cr * cr * 1.3, cg * cg * 1.3, cb * cb * 1.3);   // squared: keeps the hue saturated under additive light
      r.material.opacity = clamp(mk.a, 0, 1);
    }
    for (; k < rings.length; k++) rings[k].visible = false;
  }

  // ---------------------------------------------------------------- per frame
  let game = null, lost = false, lastNow = 0, frameAvg = 16, slowFrames = 0, fadeIn = 0;
  const isBoard = (state) => BOARD_SCENES.has(state.scene);
  const padPts = (pad) => { const x = HX + pad, z = HZ + pad; return [[-x, 0, -z], [x, 0, -z], [-x, TOP, -z], [x, TOP, -z], [-x, 0, z], [x, 0, z], [-x, TOP, z], [x, TOP, z]]; };
  function framing(state, L) {
    const calm = state.calm, t = state.t;
    if (isBoard(state)) {
      const g = GEOMS[L.geom], F = g.FRAME, k = L.grp.k, rc = rectCss({ x: L.grp.ox + F.x * k, y: L.grp.oy + F.y * k, w: F.w * k, h: F.h * k });
      const asp = rc.w / rc.h, tilt = clamp(Math.asin(clamp((2 * HX) / (2 * HZ) / asp, 0.2, 1)) / D2R, 46, 69);
      return fit(rc, padPts(3.5), { yaw: 0, tilt, fov: 28, tx: 0, ty: TOP * 0.5, tz: 0 });
    }
    const drift = calm ? 0 : 1;
    const base = { yaw: -9 + 7 * Math.sin(t * TAU / 34) * drift, tilt: 34 + 2.5 * Math.sin(t * TAU / 21) * drift, fov: 32, tx: 0, ty: TOP * 0.5, tz: 0 };
    let r = v3.hero;
    if (!r) { const U = L.U; r = L.land ? { x: U.x0 + U.w * 0.1, y: U.y0 + U.h * 0.25, w: U.w * 0.5, h: U.h * 0.6 } : { x: U.x0 + U.w * 0.04, y: U.y0 + U.h * 0.36, w: U.w * 0.92, h: U.h * 0.34 }; }
    return fit(rectCss(r), padPts(1), base);
  }
  let wasBoard = null;
  function pre() {
    if (!game || lost) return;
    const state = game.getState(), L = layoutFor(meta.width, meta.height), board = isBoard(state);
    geomNow = GEOMS[L.geom]; gk = L.grp.k || 1;
    const vk = `${cssW()}x${cssH()}|${L.key}`; if (vk !== viewKey) { viewKey = vk; snap = true; }
    if (wasBoard !== board) { wasBoard = board; snap = true; }
    const goal = framing(state, L);
    const now = performance.now(), dt = clamp((now - (lastNow || now)) / 1000, 0, 0.1);
    const k = snap || board ? 1 : 1 - Math.exp(-dt * 5);
    for (const key of Object.keys(goal)) cur[key] += (goal[key] - cur[key]) * k;
    snap = false;
    place(camera, cur);
    v3.marks.length = 0;
  }
  function post() {
    if (!game || lost) return;
    const now = performance.now(), dt = clamp((now - (lastNow || now)) / 1000, 0, 0.1); lastNow = now; clock += dt;
    const state = game.getState(), calm = state.calm, board = isBoard(state);
    setBoard(state.wood || 'teak'); set3 = SEEDSETS3.includes(state.seeds) ? state.seeds : 'mbono';
    if (board && state.shown) drawPosition(state.shown, state, state.anim || null);
    else if (!board) drawPosition({ pits: START.pits, stock: START.stock }, state, null);
    else { begin(); end(); }
    drawRings(board ? v3.marks : []);
    for (const m of ringBurst) {
      const u = m.userData; if (!(u.t <= 0.7)) { m.visible = false; continue; }
      u.t += dt; const f = Math.min(1, u.t / 0.7);
      m.visible = true; m.position.set(u.x, R0 + 0.15, u.z); const s = (6 + f * 8) * u.s; m.scale.set(s, 1, s); m.material.opacity = 0.9 * (1 - f) * (1 - f);
    }
    // the light moves: dust motes drift in the sun, the sun sways a little so the lattice shadow slowly crawls over the cloth
    if (!calm) {
      const a = set.dust.geometry.attributes.position.array;
      for (let i = 0; i < a.length; i += 3) { a[i + 1] += dt * (0.5 + (i % 7) * 0.06); a[i] += dt * 0.35; if (a[i + 1] > 70) a[i + 1] = 4; if (a[i] > 60) a[i] = -60; }
      set.dust.geometry.attributes.position.needsUpdate = true;
      lights.sun.position.x = -148 + Math.sin(clock * 0.09) * 12; lights.sun.intensity = 3.1 + Math.sin(clock * 0.7) * 0.12;
    }
    if (fadeIn < 1) { fadeIn = Math.min(1, fadeIn + dt / 0.4); v3.fade = fadeIn; }
    renderer.setSize(cssW(), cssH(), false);
    renderer.render(scene, camera);
    const ft = dt * 1000; if (ft > 0) frameAvg = frameAvg * 0.95 + ft * 0.05;
    if (frameAvg > 26 && tier < 2) { if (++slowFrames > 90) { tier++; slowFrames = 0; frameAvg = 16; setBoard(state.wood || 'teak'); applyTier(); } } else slowFrames = 0;
  }

  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; v3.on = false; canvas.style.visibility = 'hidden'; });
  canvas.addEventListener('webglcontextrestored', () => {
    lost = false; buildEnv(); applyTier();
    scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => { for (const k of ['map', 'bumpMap']) if (m[k]) m[k].needsUpdate = true; }); });
    fadeIn = 0; v3.fade = 0; v3.on = true; canvas.style.visibility = 'visible'; snap = true;
  });

  await tick();
  setBoard('teak'); await tick();
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
