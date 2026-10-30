// Toguz Kumalak 3D presenter. READS the game state (game.getState()), never writes it. One WebGL canvas sits behind the kit's
// transparent 2D canvas: the carved board on a shyrdak inside a yurt, daylight falling through the shanyrak. The camera is fitted to
// the layout's board rectangle (play) or hero rectangle (title), so the 2D HUD, counts and taps line up with the tilted board through
// v3.pt / v3.unproject. No WebGL, ?flat=1 or a lost context: v3.on = false and every screen draws the flat 2D art; a restored context
// rebuilds the environment and the board and returns to 3D.
import * as THREE from '../vendor3d/three.js';
import { v3 } from '../src/v3.js';
import { meta } from '../src/game.js';
import { layoutFor } from '../src/layout.js';
import { U, TOP, BOARD, toWorld, pitWorld, pitSlot, kazanSlot, buildBoard, pebbleGeos, pebbleMaterials, TINT3, buildYurt, buildLights, buildTuz, waveFlag, radialTex, hash } from './world.js';

const TAU = Math.PI * 2, D2R = Math.PI / 180, CAP = 240;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = (f) => f * f * (3 - 2 * f);
const TIERS = [{ name: 'high', dpr: 2, shadow: 2048, tex: 1024 }, { name: 'medium', dpr: 1.5, shadow: 1024, tex: 1024 }, { name: 'low', dpr: 1, shadow: 0, tex: 512 }];
const tick = () => new Promise((r) => setTimeout(r, 0));
const BOARD_SCENES = new Set(['play', 'over', 'lesson', 'puzzle']);
const IDLE = { pits: new Array(18).fill(9), kazan: [0, 0], tuz: [-1, -1] };

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
  scene.background = new THREE.Color(0x2a1d16);
  const camera = new THREE.PerspectiveCamera(30, 1, 2, 3000);
  const lights = buildLights(scene);
  const buildEnv = () => { try { const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture; pm.dispose(); scene.environmentIntensity = 0.32; } catch { /* no IBL */ } };
  buildEnv();
  await tick();
  const yurt = buildYurt(scene, { quality: tier < 2 ? 1 : 0 });
  await tick();
  const geos = pebbleGeos(), mats = pebbleMaterials();
  const inst = geos.map((g) => { const m = new THREE.InstancedMesh(g, mats.stones, CAP); m.castShadow = true; m.receiveShadow = true; m.count = 0; m.frustumCulled = false; m.setColorAt(0, new THREE.Color()); scene.add(m); return m; });
  let setName = 'stones';
  const flatQuad = new THREE.PlaneGeometry(1, 1); flatQuad.rotateX(-Math.PI / 2);
  const blobs = new THREE.InstancedMesh(flatQuad, new THREE.MeshBasicMaterial({ map: radialTex('20,8,0', 0.9), transparent: true, depthWrite: false, opacity: 0.5 }), 40);
  blobs.renderOrder = 1; blobs.frustumCulled = false; blobs.count = 0; scene.add(blobs);
  // glows on the pit rims (legal pits, hint, capture, keyboard cursor) as light lying on the wood
  const ringC = document.createElement('canvas'); ringC.width = ringC.height = 128;
  { const x = ringC.getContext('2d'), g = x.createRadialGradient(64, 64, 30, 64, 64, 64); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.55, 'rgba(255,255,255,0.12)'); g.addColorStop(0.74, 'rgba(255,255,255,1)'); g.addColorStop(0.84, 'rgba(255,255,255,0.75)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); }
  const ringT = new THREE.CanvasTexture(ringC); ringT.colorSpace = THREE.SRGBColorSpace;
  const rings = Array.from({ length: 24 }, () => { const m = new THREE.Mesh(flatQuad, new THREE.MeshBasicMaterial({ map: ringT, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); m.renderOrder = 3; m.visible = false; scene.add(m); return m; });
  const tuz = [buildTuz(0), buildTuz(1)]; tuz.forEach((t) => { t.visible = false; scene.add(t); });

  // the board is cached per wood (its height field and textures are the costly part)
  const boards = new Map(); let board = null, boardKey = '';
  function setBoard(wood) {
    const k = `${wood}|${TIERS[tier].tex}`; if (k === boardKey) return;
    let b = boards.get(k); if (!b) { b = buildBoard(wood, TIERS[tier].tex); boards.set(k, b); }
    if (board) scene.remove(board); board = b; boardKey = k; scene.add(b);
  }
  function setPebbles(name) {
    if (name === setName || !mats[name]) return; setName = name;
    for (const m of inst) m.material = mats[name];
  }
  function applyTier() {
    const t = TIERS[tier];
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, t.dpr));
    renderer.shadowMap.enabled = t.shadow > 0; lights.sun.castShadow = t.shadow > 0;
    if (t.shadow) { lights.sun.shadow.mapSize.set(t.shadow, t.shadow); if (lights.sun.shadow.map) { lights.sun.shadow.map.dispose(); lights.sun.shadow.map = null; } }
    blobs.material.opacity = t.shadow ? 0.32 : 0.55;
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
  v3.pt = (cx, cy, lift = 0) => {
    const w = toWorld(cx, cy), y = TOP + lift;
    const p = virt(toCss(camera, w.x, y, w.z, { x: 0, y: 0 }));
    toCss(camera, w.x - 2, y, w.z, pa); toCss(camera, w.x + 2, y, w.z, pb);
    p.s = Math.hypot(pb.x - pa.x, pb.y - pa.y) / cpu() / (4 / U); return p;
  };
  const ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -TOP), hit = new THREE.Vector3(), ndc = new THREE.Vector2();
  v3.unproject = (vx, vy) => {
    ndc.set(((vx * cpu() + offX()) / cssW()) * 2 - 1, 1 - ((vy * cpu() + offY()) / cssH()) * 2);
    ray.setFromCamera(ndc, camera);
    if (!ray.ray.intersectPlane(plane, hit)) return null;
    return { x: hit.x / U + 360, y: hit.z / U + 750 };
  };

  // ---------------------------------------------------------------- pebbles
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _c = new THREE.Color();
  const counts = [0, 0, 0]; let nBlob = 0;
  const begin = () => { counts[0] = counts[1] = counts[2] = 0; nBlob = 0; };
  function put(o, dy = 0, spin = 0, blob = 0) {
    const gi = o.g, m = inst[gi]; if (counts[gi] >= CAP) return;
    _e.set(o.tx + spin * 0.7, o.yaw + spin, o.tz, 'YXZ'); _q.setFromEuler(_e); _s.set(1, 1, 1); _p.set(o.x, o.y + dy, o.z);
    m.setMatrixAt(counts[gi], _m.compose(_p, _q, _s));
    const b = 0.86 + 0.24 * hash(Math.round(o.x * 37 + o.z * 91), o.v);
    _c.setHex(TINT3[setName][o.v]).multiplyScalar(b); m.setColorAt(counts[gi]++, _c);
    if (blob > 0 && nBlob < 40) { const s = 1.8 + blob * 0.12; _p.set(o.x + blob * 0.2, TOP + 0.05, o.z - blob * 0.2); _q.identity(); _s.set(s, 1, s); blobs.setMatrixAt(nBlob++, _m.compose(_p, _q, _s)); }
  }
  function end() {
    inst.forEach((m, i) => { m.count = counts[i]; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; });
    blobs.count = nBlob; blobs.instanceMatrix.needsUpdate = true;
  }
  // a handful of pebbles carried above the board (no hand: the pebbles themselves travel, as in the flat art)
  function hand(n, x, y, z, t, calm) {
    const k = Math.min(n, 22);
    for (let j = 0; j < k; j++) {
      const layer = j < 7 ? 0 : j < 15 ? 1 : 2, jj = layer === 0 ? j : layer === 1 ? j - 7 : j - 15, cap = layer === 0 ? 7 : 8, a = jj * 2.4 + layer, rr = Math.sqrt((jj + 0.5) / cap) * (1.6 - layer * 0.35);
      const jig = calm ? 0 : Math.sin(t * 9 + j) * 0.05;
      put({ x: x + Math.cos(a) * rr, y: y + layer * 0.7 + jig, z: z + Math.sin(a) * rr, yaw: j * 1.3, tx: (hash(j, 2) - 0.5) * 0.6, tz: (hash(j, 3) - 0.5) * 0.6, v: j % 4, g: j % 3 }, 0, 0, j === 0 ? Math.max(0.1, y - TOP) : 0);
    }
  }
  let clock = 0;
  function drawBoard(sh, A, calm, t) {
    begin();
    const capPit = A && A.phase === 'cap' ? (A.r.capture > 0 ? A.r.last : A.r.tuzMade) : -1;
    for (let i = 0; i < 18; i++) {
      const n = sh.pits[i]; if (n <= 0 || i === capPit) continue;
      for (let k = 0; k < n; k++) {
        let dy = 0;
        if (A && A.lastDrop === i && k === n - 1 && !calm && A.dropT < 0.24) {       // the dropped pebble falls in and gives one small bounce
          const f = A.dropT / 0.24; dy = f < 0.62 ? 2.6 * (1 - (f / 0.62) ** 2) : 0.28 * Math.sin(Math.PI * (f - 0.62) / 0.38);
        }
        put(pitSlot(i, k), dy);
      }
    }
    for (const pl of [0, 1]) for (let k = 0; k < sh.kazan[pl]; k++) put(kazanSlot(pl, k));
    v3.handAt = null;
    if (A) {
      const r = A.r, o = pitWorld(r.pit);
      if (A.phase === 'lift' || A.phase === 'sow') {
        let x, z, y;
        if (A.phase === 'lift') { const f = Math.min(1, A.timer / Math.max(0.01, calm ? 0.11 : 0.22)), e = ease(f); x = o.x; z = o.z; y = TOP - 1.2 + e * 5.2 + (calm ? 0 : Math.sin(Math.PI * f) * 0.6); }
        else {
          const from = A.idx === 0 ? o : pitWorld(r.path[A.idx - 1]), to = pitWorld(r.path[Math.min(A.idx, r.path.length - 1)]), f = Math.min(1, A.timer / A.sd), e = ease(f);
          x = from.x + (to.x - from.x) * e; z = from.z + (to.z - from.z) * e; y = TOP + 4 + (calm ? 0 : Math.sin(Math.PI * f) * 1.8);
        }
        if (A.n > 0) hand(A.n, x, y, z, t, calm);
        v3.handAt = { x: x / U + 360, y: z / U + 750, lift: y - TOP + 2.2 };
      }
      if (A.phase === 'cap') {
        const c = capPit, cnt = r.capture > 0 ? r.capture : 3, f = Math.min(1, A.timer / Math.max(0.01, calm ? 0.17 : 0.34));
        for (let k = 0; k < cnt; k++) {
          const a = pitSlot(c, k), b = kazanSlot(r.player, sh.kazan[r.player] + k), fk = clamp((f - (k % 6) * 0.03) / 0.85, 0, 1), e = ease(fk);
          put({ ...a, x: a.x + (b.x - a.x) * e, y: a.y + (b.y - a.y) * e + Math.sin(Math.PI * e) * (calm ? 3 : 9), z: a.z + (b.z - a.z) * e }, 0, calm ? 0 : e * 5, Math.sin(Math.PI * e) * 6);
        }
      }
    }
    end();
    // tuz markers (the flag rises with a little overshoot when a tuz is won, then flutters)
    for (const pl of [0, 1]) {
      const T = tuz[pl], at = sh.tuz[pl]; T.visible = at >= 0; if (!T.visible) continue;
      const w = pitWorld(at); T.position.set(w.x, 0, w.z);
      const raise = A && A.flagOwner === pl ? clamp(A.flagT, 0, 1) : 1, e = raise >= 1 ? 1 : 1 - Math.pow(1 - raise, 3) * Math.cos(raise * 7);
      T.userData.staff.scale.set(1, Math.max(0.02, e), 1);
      waveFlag(T.userData.flag, clock + pl, calm ? 0 : 1);
    }
  }
  function drawRings(marks) {
    let k = 0;
    for (const mk of marks) {
      if (k >= rings.length || mk.pit < 0 || mk.pit > 17) continue;
      const r = rings[k++], w = pitWorld(mk.pit), s = mk.s || 1;
      r.visible = true; r.position.set(w.x, TOP + 0.12, w.z); r.scale.set(30 * U * 2.5 * s, 1, 42 * U * 2.3 * s);
      const [cr, cg, cb] = mk.rgb.split(',').map((v) => Number(v) / 255);
      r.material.color.setRGB(cr * cr * 1.2, cg * cg * 1.2, cb * cb * 1.2); r.material.opacity = clamp(mk.a, 0, 1);
    }
    for (; k < rings.length; k++) rings[k].visible = false;
  }

  // ---------------------------------------------------------------- per frame
  let game = null, lost = false, lastNow = 0, frameAvg = 16, slowFrames = 0, fadeIn = 0, wasBoard = null;
  const isBoard = (state) => BOARD_SCENES.has(state.scene);
  const hx = BOARD.w / 2, hz = BOARD.d / 2;
  function framing(state, L) {
    const calm = state.calm, t = state.t;
    if (isBoard(state)) {
      const B = L.board, rc = rectCss({ x: B.x, y: B.y, w: B.w, h: B.h });
      const pts = [[-hx, TOP, -hz], [hx, TOP, -hz], [-hx, TOP, hz], [hx, TOP, hz], [-hx, 0.4, hz], [hx, 0.4, hz]];
      return fit(rc, pts, { yaw: 0, tilt: L.land ? 57 : 62, fov: 34, tx: 0, ty: TOP, tz: 0 });
    }
    const drift = calm ? 0 : 1;
    if (v3.hero) {
      const base = { yaw: -12 + 8 * Math.sin(t * TAU / 34) * drift, tilt: 19 + 2.5 * Math.sin(t * TAU / 21) * drift, fov: 40, tx: 0, ty: TOP, tz: 0 };
      const pts = [[-hx, TOP, -hz], [hx, TOP, -hz], [-hx, 0, hz], [hx, 0, hz]];
      return fit(rectCss(v3.hero), pts, base);
    }
    // reading screens: the room itself, a slow look round the yurt
    const base = { yaw: -25 + 10 * Math.sin(t * TAU / 40) * drift, tilt: L.land ? 22 : 28, fov: 40, tx: 0, ty: 20, tz: -10 };
    return { ...base, dist: L.land ? 260 : 320, ox: 0, oy: 0 };
  }
  function pre() {
    if (!game || lost) return;
    const state = game.getState(), L = layoutFor(meta.width, meta.height), bs = isBoard(state);
    const vk = `${cssW()}x${cssH()}|${L.mode}|${L.w}x${L.h}|${v3.hero ? 'h' : ''}`; if (vk !== viewKey) { viewKey = vk; snap = true; }
    if (wasBoard !== bs) { wasBoard = bs; snap = true; }      // a board screen is exact from its first frame (taps, glows)
    const goal = framing(state, L);
    const now = performance.now(), dt = clamp((now - (lastNow || now)) / 1000, 0, 0.1);
    const k = snap || bs ? 1 : 1 - Math.exp(-dt * 4);
    for (const key of Object.keys(goal)) cur[key] += (goal[key] - cur[key]) * k;
    snap = false;
    camera.near = bs ? Math.max(2, cur.dist * 0.7) : 2;       // roof poles between the camera and the board are clipped away
    place(camera, cur);
    v3.marks.length = 0;
  }
  function post() {
    if (!game || lost) return;
    const now = performance.now(), dt = clamp((now - (lastNow || now)) / 1000, 0, 0.1); lastNow = now; clock += dt;
    const state = game.getState(), calm = state.calm, bs = isBoard(state);
    setBoard(state.wood === 'birch' ? 'birch' : 'walnut'); setPebbles(state.seeds);
    drawBoard(bs ? state.shown : IDLE, bs ? state.anim : null, calm, state.t);
    drawRings(v3.marks);
    if (!calm) {                                     // motes turn slowly in the light
      yurt.motes.rotation.y = clock * 0.02; yurt.motes.position.y = Math.sin(clock * 0.3) * 1.5;
      yurt.shaft.material.opacity = 0.3 + 0.03 * Math.sin(clock * 0.7);
    }
    if (fadeIn < 1) { fadeIn = Math.min(1, fadeIn + dt / 0.4); v3.fade = fadeIn; }
    renderer.setSize(cssW(), cssH(), false);
    renderer.render(scene, camera);
    const ft = dt * 1000; if (ft > 0) frameAvg = frameAvg * 0.95 + ft * 0.05;
    if (frameAvg > 26 && tier < 2) { if (++slowFrames > 90) { tier++; slowFrames = 0; frameAvg = 16; applyTier(); } } else slowFrames = 0;
  }

  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; v3.on = false; canvas.style.visibility = 'hidden'; });
  canvas.addEventListener('webglcontextrestored', () => {
    lost = false; buildEnv(); for (const b of boards.values()) { scene.remove(b); b.userData.dispose(); } boards.clear(); board = null; boardKey = '';
    applyTier(); fadeIn = 0; v3.fade = 0; v3.on = true; canvas.style.visibility = 'visible'; snap = true;
  });

  await tick();
  setBoard('walnut'); await tick();
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
