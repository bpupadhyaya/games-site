// Hawalis 3D presenter. READS the game's drawing state (v3.S), never writes it. One WebGL canvas sits behind the kit's transparent 2D
// canvas: a dark teak board with brass studs and pearl seeds on a Sadu rug in a bright majlis. The camera is fitted to the layout's board
// rectangle (play) or the hero rectangle (title), so the 2D HUD, count labels, rings and taps line up with the tilted board through
// v3.pt / v3.toLocal. No WebGL, ?flat=1 or a lost context: v3.on = false and every screen draws the flat 2D art; a restored context
// rebuilds the environment and the board and returns to 3D.
import * as THREE from '../vendor3d/three.js';
import { v3 } from '../src/v3.js';
import { meta } from '../src/layout.js';
import { playGeo } from '../src/view.js';
import { flightPos } from '../src/match.js';
import { CELLS } from '../src/art.js';
import {
  TOP, PR, BWC, BHC, toW, toL, seedSlot, buildBoard, buildRoom, buildDallah, buildFinjan, buildDates, buildLights, pearlGeos, pearlMaterial, pearlTone, radialTex, ringTex,
} from './world.js';

const TAU = Math.PI * 2, D2R = Math.PI / 180, CAP = 120;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const hash = (a, b = 0) => { let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
const TIERS = [{ name: 'high', dpr: 2, shadow: 2048, tex: 1024 }, { name: 'medium', dpr: 1.5, shadow: 1024, tex: 1024 }, { name: 'low', dpr: 1, shadow: 0, tex: 512 }];
const tick = () => new Promise((r) => setTimeout(r, 0));
const HAND_Y = TOP + 3.8;                               // the handful of pearls carried over the board
const BOUNCE = 0.32;                                    // seconds a dropped pearl hops and settles in its hole
// A dropped pearl: one hop that dies away (height in cm).
export const bounceY = (t) => (t < 0 || t >= BOUNCE ? 0 : Math.abs(Math.sin((t / BOUNCE) * Math.PI * 2)) * 0.45 * (1 - t / BOUNCE) ** 2);
// The handful: pearls packed in a little heap (offsets in cm).
const HANDFUL = [[0, 0, 0], [0.95, 0.05, 0.35], [-0.6, 0.05, 0.8], [-0.7, 0.02, -0.65], [0.45, 0.0, -0.95], [0.15, 0.95, 0.1], [-0.35, 0.9, -0.3], [0.5, 0.88, 0.45]];

export async function createPresenter({ kitCanvas }) {
  const qs = new URLSearchParams(location.search);
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;height:100dvh;display:block;pointer-events:none;z-index:0;visibility:hidden';
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: qs.has('icon') }); } catch (e) { console.warn('WebGL unavailable; flat 2D art', e); return { ok: false }; }
  if (!renderer.getContext()) return { ok: false };
  kitCanvas.parentElement.insertBefore(canvas, kitCanvas);
  kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  let tier = qs.has('tier') ? clamp(Number(qs.get('tier')), 0, 2) : (navigator.hardwareConcurrency || 8) <= 4 ? 1 : 0;

  await tick();
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x3a2a20);
  scene.fog = new THREE.Fog(0x4a3426, 260, 900);
  const camera = new THREE.PerspectiveCamera(30, 1, 2, 3000);
  const lights = buildLights(scene);
  const buildEnv = () => { try { const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture; pm.dispose(); scene.environmentIntensity = 0.55; } catch { /* no IBL */ } };
  buildEnv();
  await tick();
  buildRoom(scene, { quality: tier < 2 ? 1 : 0 });
  await tick();
  // props beside the board
  const props = new THREE.Group(); scene.add(props);
  const dallah = buildDallah(); dallah.position.set(-BWC / 2 - 17, 0, -BHC / 2 + 2); dallah.rotation.y = 0.5; props.add(dallah);
  const cups = [buildFinjan(), buildFinjan()]; cups[0].position.set(-BWC / 2 - 9, 0, BHC / 2 - 2); cups[1].position.set(-BWC / 2 - 15.5, 0, BHC / 2 + 4); props.add(...cups);
  const dates = buildDates(); dates.position.set(BWC / 2 + 17, 0, -BHC / 2 + 6); props.add(dates);
  props.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  await tick();

  // pearls: three shape variants, instanced, coloured per pearl
  const geos = pearlGeos(), pmat = pearlMaterial();
  const inst = geos.map((g) => { const m = new THREE.InstancedMesh(g, pmat, CAP); m.castShadow = true; m.receiveShadow = true; m.count = 0; m.frustumCulled = false; m.setColorAt(0, new THREE.Color(1, 1, 1)); scene.add(m); return m; });
  const flatQuad = new THREE.PlaneGeometry(1, 1); flatQuad.rotateX(-Math.PI / 2);
  const blobs = new THREE.InstancedMesh(flatQuad, new THREE.MeshBasicMaterial({ map: radialTex('0,0,0', 0.85), transparent: true, depthWrite: false, opacity: 0.55 }), 40);
  blobs.renderOrder = 1; blobs.frustumCulled = false; blobs.count = 0; scene.add(blobs);
  // marks: rings and glows lying in the holes (additive light)
  const rT = ringTex(), dT = radialTex('255,255,255', 1);
  const pool = (tex, n, order) => Array.from({ length: n }, () => { const m = new THREE.Mesh(flatQuad, new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); m.renderOrder = order; m.visible = false; scene.add(m); return m; });
  const rings = pool(rT, 48, 3), fills = pool(dT, 40, 2);
  // glints where a pearl lands
  const glints = pool(radialTex('255,244,220', 1), 16, 4); let glintI = 0;
  const glint = (x, y, z) => { const m = glints[glintI++ % glints.length]; m.userData = { t: 0, x, y, z }; };
  // dust motes drifting in the window light
  const moteN = 90, moteGeo = new THREE.BufferGeometry(), moteP = new Float32Array(moteN * 3);
  for (let i = 0; i < moteN; i++) { moteP[i * 3] = (hash(i, 1) - 0.5) * 160; moteP[i * 3 + 1] = 8 + hash(i, 2) * 70; moteP[i * 3 + 2] = (hash(i, 3) - 0.5) * 120; }
  moteGeo.setAttribute('position', new THREE.BufferAttribute(moteP, 3));
  const motes = new THREE.Points(moteGeo, new THREE.PointsMaterial({ map: radialTex('255,236,200', 1, 32), size: 0.9, transparent: true, depthWrite: false, opacity: 0.55, blending: THREE.AdditiveBlending, sizeAttenuation: true }));
  scene.add(motes);

  // boards are cached per theme (the painted top is the costly part)
  const boards = new Map(); let board = null, boardKey = '';
  function setBoard(theme) {
    const k = `${theme}|${TIERS[tier].tex}`; if (k === boardKey) return;
    let b = boards.get(k); if (!b) { b = buildBoard(theme, TIERS[tier].tex); boards.set(k, b); }
    if (board) scene.remove(board); board = b; boardKey = k; scene.add(b);
  }
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
  const cur = { yaw: 0, tilt: 50, fov: 30, dist: 140, ox: 0, oy: 0, tx: 0, ty: TOP, tz: 0 };
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

  // ---------------------------------------------------------------- v3 hooks for the 2D layer
  const pa = { x: 0, y: 0 }, pb = { x: 0, y: 0 };
  const ptOn = (lx, ly, lift = 0) => {
    const w = toW(lx, ly), y = TOP + lift;
    const p = virt(toCss(camera, w.x, y, w.z, { x: 0, y: 0 }));
    toCss(camera, w.x - 1.5, y, w.z, pa); toCss(camera, w.x + 1.5, y, w.z, pb);
    p.k = Math.hypot(pb.x - pa.x, pb.y - pa.y) / cpu() / (3 / 0.075); return p;    // virtual units per flat-board unit
  };
  const ray = new THREE.Raycaster(), hit = new THREE.Vector3(), ndc = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -TOP);
  const rayAt = (vx, vy) => { ndc.set(((vx * cpu() + offX()) / cssW()) * 2 - 1, 1 - ((vy * cpu() + offY()) / cssH()) * 2); ray.setFromCamera(ndc, camera); return ray.ray; };
  const toLocal = (vx, vy) => { plane.constant = -TOP; return rayAt(vx, vy).intersectPlane(plane, hit) ? toL(hit.x, hit.z) : null; };
  // a point floating at height y over the screen point (vx, vy): where captured pearls fly to (the player's plate)
  const liftedAt = (vx, vy, y, out) => { plane.constant = -y; return rayAt(vx, vy).intersectPlane(plane, out) ? out : null; };

  // ---------------------------------------------------------------- pearls
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
  const counts = [0, 0, 0]; let nBlob = 0;
  const begin = () => { counts[0] = counts[1] = counts[2] = 0; nBlob = 0; };
  function put(seed, x, y, z, sc = 1, shadow = 0) {
    const v = Math.floor(hash(seed, 17) * 3) % 3, m = inst[v]; if (counts[v] >= CAP) return;
    _e.set(hash(seed, 3) * TAU, hash(seed, 5) * TAU, 0); _q.setFromEuler(_e); _s.set(sc, sc, sc); _p.set(x, y, z);
    m.setMatrixAt(counts[v], _m.compose(_p, _q, _s)); m.setColorAt(counts[v], pearlTone(seed)); counts[v]++;
    if (shadow > 0.02 && nBlob < 40) {
      const lift = Math.max(0, y - TOP), s = PR * 2.6 * sc * (1 + lift * 0.12);
      _p.set(x + lift * 0.35, TOP + 0.03, z + lift * 0.25); _q.identity(); _s.set(s, 1, s); blobs.setMatrixAt(nBlob++, _m.compose(_p, _q, _s));
    }
  }
  function end() {
    for (let v = 0; v < 3; v++) { inst[v].count = counts[v]; inst[v].instanceMatrix.needsUpdate = true; if (inst[v].instanceColor) inst[v].instanceColor.needsUpdate = true; }
    blobs.count = nBlob; blobs.instanceMatrix.needsUpdate = true;
  }
  let clock = 0, lastM = null; const prevN = new Array(CELLS.length).fill(0); const landAt = new Map();
  const tgt = new THREE.Vector3();
  function drawMatch(M, S, calm) {
    const D = M.D, A = M.A, al = S.alpha ?? 1;
    if (M !== lastM) { lastM = M; for (let i = 0; i < CELLS.length; i++) prevN[i] = D.cells[i]; landAt.clear(); }
    begin();
    for (let i = 0; i < CELLS.length; i++) {
      const n = D.cells[i];
      if (n > prevN[i] && n - prevN[i] <= 3) for (let k = prevN[i]; k < n; k++) { landAt.set(i * 128 + k, clock); if (!calm) { const p = seedSlot(i, k); glint(p.x, p.y + PR * 0.6, p.z); } }
      prevN[i] = n;
      for (let k = 0; k < Math.min(n, 60); k++) {
        const p = seedSlot(i, k), t0 = landAt.get(i * 128 + k);
        const by = t0 === undefined || calm ? 0 : bounceY(clock - t0);
        put(i * 53 + k, p.x, p.y + by, p.z);
      }
    }
    for (const [key, t0] of landAt) if (clock - t0 > BOUNCE) landAt.delete(key);
    if (A) {
      // the handful glides over the board, bobbing a little, its shadow on the wood
      if (A.hand && A.hand.n > 0) {
        const h = A.hand, hx = h.px === undefined ? h.x : h.px + (h.x - h.px) * al, hy = h.py === undefined ? h.y : h.py + (h.y - h.py) * al, w = toW(hx, hy);
        const bob = calm ? 0 : Math.sin(clock * 9) * 0.12, show = Math.min(h.n, HANDFUL.length);
        for (let k = 0; k < show; k++) { const o = HANDFUL[k]; put(900 + k * 7, w.x + o[0] * 1.4, HAND_Y + bob + o[1] * 1.35, w.z + o[2] * 1.4, 1, 0); }
        if (nBlob < 40) { _p.set(w.x + 1.0, TOP + 0.03, w.z + 0.7); _q.identity(); _s.set(4.4, 1, 4.4); blobs.setMatrixAt(nBlob++, _m.compose(_p, _q, _s)); }
      }
      const geo = playGeo(S).geo;
      for (const f of A.flights) {
        if (f.delay > 0) continue;
        const [, , k] = flightPos(f, al);
        if (f.kind === 'drop') {
          const a = toW(f.from[0], f.from[1] + 30), b = seedSlot(f.cell, f.k), e = k * k;
          put(f.seed, a.x + (b.x - a.x) * e, HAND_Y + (b.y - HAND_Y) * e + Math.sin(k * Math.PI) * 0.6, a.z + (b.z - a.z) * e, 1, 1);
        } else {
          // captured: lifted out of the hole and flown in an arc up toward the player's plate, shrinking as it arrives
          const sw = toW(f.from[0], f.from[1]), [vx, vy] = geo.toScreen(f.to[0], f.to[1]);
          if (!liftedAt(vx, vy, TOP + 16, tgt)) tgt.set(sw.x, TOP + 16, sw.z);
          const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2, y0 = TOP + 0.2;
          put(f.seed, sw.x + (tgt.x - sw.x) * e, y0 + (tgt.y - y0) * e + Math.sin(k * Math.PI) * 9, sw.z + (tgt.z - sw.z) * e, k > 0.75 ? Math.max(0.01, 1 - (k - 0.75) / 0.25) : 1, 1 - k);
        }
      }
    }
    end();
  }
  function drawMarks(marks) {
    let r = 0, f = 0;
    for (const mk of marks) {
      if (mk.cell < 0 || mk.cell >= CELLS.length) continue;
      const c = CELLS[mk.cell], w = toW(c.cx, c.cy), fill = mk.kind === 'fill';
      const m = fill ? fills[f++] : rings[r++]; if (!m) continue;
      const s = fill ? 6.4 : 7.6 + (mk.grow || 0) * 0.16;
      m.visible = true; m.position.set(w.x, TOP + (fill ? -0.9 : 0.06), w.z); m.scale.set(s, 1, s);
      const [cr, cg, cb] = mk.rgb;
      m.material.color.setRGB(cr * cr * 1.3, cg * cg * 1.3, cb * cb * 1.3); m.material.opacity = clamp(mk.a, 0, 1);
    }
    for (; r < rings.length; r++) rings[r].visible = false;
    for (; f < fills.length; f++) fills[f].visible = false;
  }

  // ---------------------------------------------------------------- per frame
  let lost = false, lastNow = 0, frameAvg = 16, slowFrames = 0, fadeIn = 0, attached = false;
  const BOARD_PTS = (() => { const x = BWC / 2 - 1.3, z = BHC / 2 - 1.3; return [[-x, TOP, -z], [x, TOP, -z], [-x, TOP, z], [x, TOP, z]]; })();   // the playing field; the brass rim may run a hair past the rectangle
  const HERO_PTS = (() => { const x = BWC / 2, z = BHC / 2; return [[-x, TOP, -z], [x, TOP, -z], [-x, 0, z], [x, 0, z], [-x - 12, 20, -z + 2]]; })();
  const isBoard = (S) => (S.scene === 'play' || S.scene === 'auto') && S.match;
  function framing(S, L) {
    const t = S.t || clock;
    if (isBoard(S)) {
      const g = playGeo(S).geo, rc = rectCss({ x: g.x, y: g.y, w: g.w, h: g.h });
      return fit(rc, BOARD_PTS, { yaw: 0, tilt: L.land ? 64 : 62, fov: 28, tx: 0, ty: TOP, tz: 0 });
    }
    const base = { yaw: -24 + 7 * Math.sin(t * TAU / 34), tilt: 36 + 3 * Math.sin(t * TAU / 23), fov: 30, tx: 0, ty: TOP * 0.6, tz: 0 };
    let r = v3.hero;
    if (!r || S.scene !== 'title') r = L.land ? { x: L.w * 0.08, y: L.h * 0.2, w: L.w * 0.5, h: L.h * 0.6 } : { x: L.w * 0.06, y: L.h * 0.28, w: L.w * 0.88, h: L.h * 0.34 };
    return fit(rectCss(r), HERO_PTS, base);
  }
  function pre() {
    if (!attached || lost || !v3.S) return;
    const S = v3.S, L = { w: meta.width, h: meta.height, land: meta.width > meta.height };
    const vk = `${cssW()}x${cssH()}|${meta.width}x${meta.height}|${S.textIdx}|${S.scene === 'auto'}`; if (vk !== viewKey) { viewKey = vk; snap = true; }
    const goal = framing(S, L);
    const now = performance.now(), dt = clamp((now - (lastNow || now)) / 1000, 0, 0.1);
    const k = snap ? 1 : 1 - Math.exp(-dt * 6);
    for (const key of Object.keys(goal)) cur[key] += (goal[key] - cur[key]) * k;
    snap = false;
    place(camera, cur);
    v3.marks.length = 0;
  }
  function post() {
    if (!attached || lost || !v3.S) return;
    const now = performance.now(), dt = clamp((now - (lastNow || now)) / 1000, 0, 0.1); lastNow = now; clock += dt;
    const S = v3.S, calm = false;
    setBoard(S.themeId === 'sadu' ? 'sadu' : 'dhow');
    const M = isBoard(S) ? S.match : S.attract;
    if (M) drawMatch(M, S, calm); else { begin(); end(); }
    drawMarks(M ? v3.marks : []);
    for (const m of glints) {
      const u = m.userData; if (!u || !(u.t <= 0.35)) { m.visible = false; continue; }
      u.t += dt; const f = Math.min(1, u.t / 0.35), s = 1.2 + f * 2.2;
      m.visible = true; m.position.set(u.x, u.y, u.z); m.scale.set(s, 1, s); m.material.opacity = 0.9 * (1 - f) * (1 - f);
    }
    motes.rotation.y = clock * 0.01; motes.position.y = Math.sin(clock * 0.3) * 1.5;
    if (fadeIn < 1) { fadeIn = Math.min(1, fadeIn + dt / 0.45); v3.fade = fadeIn; }
    renderer.setSize(cssW(), cssH(), false);
    renderer.render(scene, camera);
    const ft = dt * 1000; if (ft > 0) frameAvg = frameAvg * 0.95 + ft * 0.05;
    if (frameAvg > 26 && tier < 2) { if (++slowFrames > 90) { tier++; slowFrames = 0; frameAvg = 16; applyTier(); } } else slowFrames = 0;
  }

  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; v3.on = false; canvas.style.visibility = 'hidden'; });
  canvas.addEventListener('webglcontextrestored', () => {
    lost = false; buildEnv(); for (const b of boards.values()) { scene.remove(b); b.userData.dispose(); } boards.clear(); board = null; boardKey = '';
    // canvas textures (rug, walls, glows) must be uploaded again into the new context
    scene.traverse((o) => { if (o.material) for (const m of [].concat(o.material)) for (const k of ['map', 'bumpMap']) if (m[k]) m[k].needsUpdate = true; });
    applyTier(); fadeIn = 0; v3.fade = 0; v3.on = true; canvas.style.visibility = 'visible'; snap = true;
  });

  await tick();
  setBoard('dhow'); await tick();
  place(camera, cur); try { renderer.compile(scene, camera); } catch { /* compiled lazily */ }
  await tick();

  return {
    ok: true, renderer, scene, camera,
    attach() { attached = true; v3.pt = ptOn; v3.toLocal = toLocal; v3.on = true; v3.fade = 0; fadeIn = 0; canvas.style.visibility = 'visible'; snap = true; },
    pre, post, place, cur,
    get tier() { return TIERS[tier].name; },
    loseContext() { const ext = renderer.getContext().getExtension('WEBGL_lose_context'); ext?.loseContext(); return ext; },
  };
}
