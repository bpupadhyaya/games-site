// Morabaraba 3D presenter. READS the game state (game.getState()), never writes it. One WebGL canvas sits behind the kit's
// transparent 2D canvas: a sandstone board on the red earth of the veld at sundown, carved Nguni cattle as the cows, the two herds
// waiting in rows beside the board. The camera is fitted to the layout's stage rectangle (board screens) or hero rectangle (title),
// tilted so the board has depth; taps reach the board through v3.pick / v3.pt (a ray onto the board face).
// All motion runs on the game's own clock (state.t and the move animation's own t), like the flat art.
// No WebGL, ?flat=1 or a lost context: v3.on = false and every screen draws the flat 2D art; a restored context rebuilds and returns.
import * as THREE from '../vendor3d/three.js';
import { meta } from '../src/game.js';
import { layoutFor, v3 } from '../src/layout.js';
import { sceneKind, boardOf } from '../src/view.js';
import { RULES as R } from '../src/morabaraba.js';
import { SP, HALF, GROUND, COW, pointXZ, penSlot, cowGeometry, cowMaterial, radialTex, ringTex, blobTex, beamTex, buildSlab, buildWorld, buildLights } from './world.js';

const TAU = Math.PI * 2, D2R = Math.PI / 180;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (f) => f * f * (3 - 2 * f);
const TIERS = [{ name: 'high', dpr: 2, shadow: 2048 }, { name: 'medium', dpr: 1.5, shadow: 1024 }, { name: 'low', dpr: 1, shadow: 0 }];
const tick = () => new Promise((r) => setTimeout(r, 0));
const CAP = 32;
// the title's little game: Dark holds the top row as a mill, Light presses on the left
const HERO = [1, 1, 1, 0, 0, 2, 0, 2, 0, 2, 0, 0, 1, 0, 0, 0, 2, 0, 0, 0, 1, 0, 0, 0];

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
  scene.background = new THREE.Color(0x3a1626);
  scene.fog = new THREE.Fog(0x9a4a3a, 380, 1700);
  const camera = new THREE.PerspectiveCamera(30, 1, 2, 4000);
  const env = buildWorld(scene);
  const lights = buildLights(scene, env.sun);
  const buildEnv = () => { try { const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture; pm.dispose(); scene.environmentIntensity = 0.28; } catch { /* no IBL */ } };
  buildEnv();
  await tick();
  const slab = buildSlab(); scene.add(slab);
  await tick();

  // ---------------------------------------------------------------- instanced pieces
  const inst = (geo, mat, cap = CAP, shadow = true) => { const m = new THREE.InstancedMesh(geo, mat, cap); m.castShadow = shadow; m.receiveShadow = shadow; m.count = 0; m.frustumCulled = false; scene.add(m); return m; };
  const cowMat = cowMaterial();
  const cows = { 1: inst(cowGeometry(1), cowMat), 2: inst(cowGeometry(2), cowMat) };
  for (const s of [1, 2]) cows[s].setColorAt(0, new THREE.Color(1, 1, 1));
  await tick();
  const flatQuad = new THREE.PlaneGeometry(1, 1); flatQuad.rotateX(-Math.PI / 2);
  const additive = (map) => new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, toneMapped: false });
  const blobs = inst(flatQuad, new THREE.MeshBasicMaterial({ map: blobTex(), transparent: true, depthWrite: false, opacity: 0.55 }), 64, false); blobs.renderOrder = 2;
  const rings = inst(flatQuad, additive(ringTex()), 40, false); rings.renderOrder = 3; rings.setColorAt(0, new THREE.Color());
  const beams = inst(flatQuad, additive(beamTex()), 24, false); beams.renderOrder = 3; beams.setColorAt(0, new THREE.Color());
  // the herd on the horizon (silhouettes walking slowly in the low sun)
  const herdMat = new THREE.MeshStandardMaterial({ color: 0x1a0c10, roughness: 1 });
  const herd = new THREE.InstancedMesh(cowGeometry(1, { plinth: false }), herdMat, 9); herd.frustumCulled = false; scene.add(herd);
  // particles: red dust when a cow lands or is shot, golden glints when a mill closes
  const dustT = radialTex('190,110,80', 0.85), glintT = radialTex('255,214,140', 1);
  const parts = Array.from({ length: 70 }, () => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: dustT, transparent: true, depthWrite: false, fog: false })); s.visible = false; s.userData = { life: 0 }; s.renderOrder = 6; scene.add(s); return s; });
  let partI = 0;
  const emit = (map, x, y, z, vx, vy, vz, size, life, grow = 1, add = false) => {
    const s = parts[partI++ % parts.length];
    if (s.material.map !== map || (s.material.blending === THREE.AdditiveBlending) !== add) { s.material.map = map; s.material.blending = add ? THREE.AdditiveBlending : THREE.NormalBlending; s.material.needsUpdate = true; }
    s.userData = { life, age: 0, x, y, z, vx, vy, vz, size, grow, dust: map === dustT }; s.visible = true;
  };
  const dust = (x, y, z, n = 7, k = 1) => { for (let i = 0; i < n; i++) { const a = (i / n) * TAU + x; emit(dustT, x + Math.cos(a) * 2, y + 0.4, z + Math.sin(a) * 2, Math.cos(a) * 5 * k, 1.5 + (i % 3), Math.sin(a) * 5 * k, 2.2 * k, 0.9, 2.6); } };
  // motes drifting through the low sun
  const MOTES = 60, moteSeed = Array.from({ length: MOTES }, (_, k) => [((k * 37) % 23) / 23, ((k * 53) % 29) / 29, ((k * 71) % 31) / 31, ((k * 13) % 17) / 17]);
  const moteGeo = new THREE.BufferGeometry(); moteGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MOTES * 3), 3));
  const motes = new THREE.Points(moteGeo, new THREE.PointsMaterial({ map: radialTex('255,220,170', 1, 64), size: 0.9, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  motes.frustumCulled = false; motes.renderOrder = 7; scene.add(motes);
  const moveMotes = (t, span) => { const a = moteGeo.attributes.position; for (let k = 0; k < MOTES; k++) { const [u, v, w, q] = moteSeed[k]; a.setXYZ(k, (u - 0.5) * span + Math.sin(t * 0.13 + q * 9) * 4, 2 + w * 30 + Math.sin(t * 0.09 + u * 7) * 3, (v - 0.5) * span + Math.cos(t * 0.11 + w * 5) * 4); } a.needsUpdate = true; };

  function applyTier() {
    const t = TIERS[tier];
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, t.dpr));
    renderer.shadowMap.enabled = t.shadow > 0; lights.sun.castShadow = t.shadow > 0;
    if (t.shadow) { lights.sun.shadow.mapSize.set(t.shadow, t.shadow); if (lights.sun.shadow.map) { lights.sun.shadow.map.dispose(); lights.sun.shadow.map = null; } }
    scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => { if (m && m.isMaterial) m.needsUpdate = true; }); });
  }
  applyTier();

  // ---------------------------------------------------------------- camera: yaw/tilt/fov per screen, distance + off-axis shift fitted to a rectangle
  const cur = { yaw: 0, tilt: 55, fov: 30, dist: 150, ox: 0, oy: 0, tx: 0, ty: 0, tz: 0 };
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
    for (let it = 0; it < 10; it++) {
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

  // ---------------------------------------------------------------- v3 hooks for the 2D layer (only while a board screen is framed)
  let boardOn = false;
  v3.pt = (i) => { const c = pointXZ(i); return virt(toCss(camera, c.x, 0, c.z, { x: 0, y: 0 })); };
  v3.penLabel = (which, end = false) => { const n = which === 'bottom'; return virt(toCss(camera, end ? -29 : 0, n ? GROUND : GROUND + 5.6, n ? (end ? HALF + 9.5 : HALF + 17.6) : -(end ? HALF + 9.5 : HALF + 17.2), { x: 0, y: 0 })); };
  const ray = new THREE.Raycaster(), hit = new THREE.Vector3(), ndc = new THREE.Vector2(), planes = [new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), new THREE.Plane(new THREE.Vector3(0, 1, 0), -3.2)];
  const onPlane = (vx, vy, k) => { ndc.set(((vx * cpu() + offX()) / cssW()) * 2 - 1, 1 - ((vy * cpu() + offY()) / cssH()) * 2); ray.setFromCamera(ndc, camera); return ray.ray.intersectPlane(planes[k], hit) ? hit : null; };
  v3.pick = (vx, vy) => {
    if (!boardOn) return -1;
    let best = -1, bd = Infinity;
    for (const [k, lim] of [[0, SP * 0.56], [1, SP * 0.46]]) {
      const h = onPlane(vx, vy, k); if (!h) continue;
      for (let i = 0; i < 24; i++) { const c = pointXZ(i), d = Math.hypot(c.x - h.x, c.z - h.z); if (d < lim && d < bd) { bd = d; best = i; } }
    }
    return best;
  };

  // ---------------------------------------------------------------- per-frame instance building
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _c = new THREE.Color();
  const WHITE = new THREE.Color(1, 1, 1), DIM = new THREE.Color(0.42, 0.36, 0.34);
  const GOLD = new THREE.Color(1.0, 0.78, 0.32), GREEN = new THREE.Color(0.35, 1.0, 0.55), RED = new THREE.Color(1.0, 0.3, 0.22), PALE = new THREE.Color(0.9, 0.72, 0.4);
  const all = [cows[1], cows[2], blobs, rings, beams];
  const cnt = new Map();
  const begin = () => { for (const m of all) cnt.set(m, 0); };
  const put = (m, x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx, color = null) => {
    const k = cnt.get(m); if (k >= m.instanceMatrix.count) return;
    _e.set(rx, ry, rz, 'YXZ'); _q.setFromEuler(_e); _s.set(sx, sy, sz); _p.set(x, y, z);
    m.setMatrixAt(k, _m.compose(_p, _q, _s)); if (m.instanceColor) m.setColorAt(k, color || WHITE);
    cnt.set(m, k + 1);
  };
  const end = () => { for (const [m, k] of cnt) { m.count = k; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; } };
  const faceYaw = (side) => (side === 1 ? 0 : Math.PI);   // Dark looks right, Light looks left (as on the flat art)
  // one cow: base centre at (x, y, z); roll tips it over sideways
  function cow(side, x, y, z, o = {}) {
    const s = (o.s ?? 1) * 1.2, yaw = (o.yaw ?? faceYaw(side)), lift = o.lift ?? 0;
    put(cows[side], x, y + lift, z, 0, yaw, o.roll ?? 0, s, s * (o.sy ?? 1), s, o.color);
    if (o.blob !== false) { const b = 7.2 * s * (1 + lift * 0.04), a = 1 / (1 + lift * 0.12); put(blobs, x + 0.5, y + 0.03, z + 0.4, 0, 0, 0, b * a, 1, b * 0.78 * a); }
  }
  const glow = (i, color, t, size = 1, y = 0.06) => { const c = pointXZ(i), s = SP * 0.95 * size * (1 + 0.05 * Math.sin(t * 6)); put(rings, c.x, y, c.z, 0, 0, 0, s, 1, s, color); };
  function beam(a, b, color, w = 2.0) { const p = pointXZ(a), q = pointXZ(b), dx = q.x - p.x, dz = q.z - p.z, L = Math.hypot(dx, dz); put(beams, (p.x + q.x) / 2, 0.08, (p.z + q.z) / 2, 0, -Math.atan2(dz, dx), 0, L + 3, 1, w, color); }

  let lastLand = null, lastShot = null, lastMillKey = '';
  function drawBoard(state, t) {
    const scene0 = state.scene, auto = scene0 === 'auto', D = state.auto, g = auto ? D.game : state.game, a = auto ? D.anim : state.anim;
    const board = auto ? g.board : boardOf(state), calm = state.calm;
    const bottom = state.two || auto ? 1 : state.human, top = 3 - bottom, pulse = calm ? 0.5 : 0.5 + 0.5 * Math.sin(t * 6);
    // the pens: cows still to place stand in two rows; cows that were shot lie on their side, darkened
    for (const [which, side] of [['top', top], ['bottom', bottom]]) {
      const lost = g.shots[3 - side];
      for (let i = 0; i < 12; i++) {
        const p = penSlot(which, i);
        if (i < g.hand[side]) cow(side, p.x, p.y, p.z, { s: 0.9 });
        else if (i >= 12 - lost) cow(side, p.x, p.y + 0.9, p.z, { s: 0.8, roll: side === 1 ? 1.45 : -1.45, color: DIM, blob: false });
      }
    }
    // mills held: a warm beam along the line, and a burst of glints when one closes
    if (scene0 !== 'over') {
      let key = '';
      for (const s of [1, 2]) for (const k of R.heldMills(board, s)) { const m = R.mills[k]; key += k + ','; beam(m[0], m[2], _c.copy(GOLD).multiplyScalar(0.55 + pulse * 0.25), 2.4); }
      if (key !== lastMillKey) {
        const old = lastMillKey.split(','), added = key.split(',').filter((k) => k && !old.includes(k)); lastMillKey = key;
        if (!calm) for (const k of added) for (const i of R.mills[Number(k)]) { const c = pointXZ(i); for (let j = 0; j < 5; j++) emit(glintT, c.x + (j - 2) * 0.8, 3 + j * 0.5, c.z, (j - 2) * 1.2, 6 + j, 0, 0.9, 1.0, 0.3, true); }
      }
    }
    // highlights (same rules as the flat art)
    const humanTurn = !g.winner && (state.two || g.turn === state.human);
    if (!auto) {
      if (state.sel >= 0 && !a && !state.take) for (const m of R.basicMoves(g)) if (m.from === state.sel) glow(m.to, _c.copy(GOLD).multiplyScalar(0.7 + pulse * 0.3), t);
      if (state.hint && !a) { glow(state.hint.to, GREEN, t, 1.15); if (state.hint.from >= 0) glow(state.hint.from, GREEN, t, 1.15); }
      if (state.lessonGlow && !a) for (const i of state.lessonGlow) glow(i, _c.copy(GOLD).multiplyScalar(0.7 + pulse * 0.3), t, 1.1);
      if (state.marks && humanTurn && !state.take && scene0 !== 'over' && scene0 !== 'lesson') for (const i of state.threats || []) glow(i, _c.copy(RED).multiplyScalar(0.55 + pulse * 0.3), t, 0.85);
      if (state.take) for (const i of state.take.opts) glow(i, _c.copy(RED).multiplyScalar(0.8 + pulse * 0.4), t, 1.35, 0.1);
      if (state.kb && scene0 !== 'over') glow(state.cursor, GREEN, t, 1.25, 0.12);
    } else if (D.phase === 'reveal' && D.moves) {
      const ch = D.chosen, isChosen = (m) => ch && m.type === ch.type && m.to === ch.to && (m.from ?? -1) === (ch.from ?? -1);
      for (const m of D.moves) if (!isChosen(m)) glow(m.to, _c.copy(PALE).multiplyScalar(0.45 + pulse * 0.2), t, 0.9);
      if (ch) { glow(ch.to, GREEN, t, 1.3); if (ch.from >= 0) glow(ch.from, GREEN, t, 1.15); }
    }
    // cows on the board
    const moving = a && a.t < a.mdur && a.type !== 'shot';
    for (let i = 0; i < 24; i++) {
      const k = board[i], c = pointXZ(i);
      if (!k) {
        if (a && a.take === i && a.t >= a.mdur && a.t < a.mdur + a.sdur) {
          // shot: the cow is jolted up, tips over and sinks away in a puff of dust
          const f = clamp01((a.t - a.mdur) / a.sdur), up = Math.sin(Math.PI * Math.min(1, f * 1.4)) * 4.5;
          if (lastShot !== a) { lastShot = a; if (!calm) dust(c.x, 0, c.z, 10, 1.2); }
          cow(a.tside, c.x, 0, c.z, { lift: up, roll: (a.tside === 1 ? 1 : -1) * 1.5 * smooth(f), s: Math.max(0.05, 1 - smooth(clamp01((f - 0.45) / 0.55))) });
        }
        continue;
      }
      if (moving && a.to === i) continue;
      if (!auto && state.drag && state.drag.moved && state.drag.from === i) continue;
      if (a && a.type === 'refuse' && a.from === i) continue;
      const sel = !auto && state.sel === i, lift = sel ? 2.2 + (calm ? 0 : Math.sin(t * 4) * 0.35) : 0;
      const quiver = !auto && state.take && state.take.opts.includes(i) && !calm ? Math.sin(t * 22 + i) * 0.05 : 0;   // the cows that may be shot quiver
      cow(k, c.x, 0, c.z, { lift, roll: quiver });
    }
    // the cow in motion
    if (a && a.type !== 'shot' && a.t < a.mdur + 0.0001) {
      const f = clamp01(a.t / a.mdur), e = smooth(f), to = pointXZ(a.to);
      let from;
      if (a.type === 'place') { const p = penSlot(a.pen || 'bottom', clamp(a.hand, 0, 11)); from = { x: p.x, y: p.y, z: p.z }; } else { const p = pointXZ(a.from); from = { x: p.x, y: 0, z: p.z }; }
      if (a.type === 'refuse') {
        const reach = a.to === a.from ? 0 : board[a.to] ? 0.55 : 0.92, out = f < 0.4 ? f / 0.4 : f < 0.6 ? 1 : 1 - (f - 0.6) / 0.4, ee = smooth(out) * reach;
        const shake = calm ? 0 : f >= 0.36 && f < 0.64 ? Math.sin(f * 90) * 0.5 : a.to === a.from ? Math.sin(f * 40) * 0.6 * (1 - f) : 0;
        cow(board[a.from] || a.kind, from.x + (to.x - from.x) * ee + shake, 0, from.z + (to.z - from.z) * ee, { lift: 2.4 * Math.sin(Math.PI * Math.min(1, f * 1.1)), roll: shake * 0.12 });
      } else {
        const hop = a.type === 'fly' ? 16 : a.type === 'place' ? 11 : 3.2, arc = Math.sin(Math.PI * f) * hop;
        const y = from.y + (0 - from.y) * e + arc;
        // anticipation: a small crouch before leaving; a squash on landing
        const sy = f < 0.12 ? 1 - 0.1 * Math.sin(Math.PI * f / 0.12) : f > 0.9 ? 1 - 0.12 * Math.sin(Math.PI * (f - 0.9) / 0.1) : 1;
        const dx = to.x - from.x, pitch = clamp(dx * 0.02, -0.3, 0.3) * Math.sin(Math.PI * f);
        cow(a.kind, from.x + dx * e, y, from.z + (to.z - from.z) * e, { sy, roll: -pitch * (a.kind === 1 ? 1 : -1), s: a.type === 'place' ? 0.9 + 0.1 * e : 1 });
      }
      if (f > 0.95 && lastLand !== a && a.type !== 'refuse') { lastLand = a; if (!calm) dust(to.x, 0, to.z, 7, 0.8); }
    }
    // a cow being dragged follows the finger, held up off the board
    if (!auto && state.drag && state.drag.moved) {
      const h = onPlane(state.drag.x, state.drag.y, 0), k = g.board[state.drag.from];
      if (h && k) cow(k, clamp(h.x, -HALF - 6, HALF + 6), 0, clamp(h.z, -HALF - 6, HALF + 6), { lift: 4 });
    }
  }
  // the title: a game in progress; a Light cow steps in and out of the line every few seconds
  function drawHero(t, calm) {
    for (let i = 0; i < 24; i++) { if (!HERO[i] || i === 9) continue; const c = pointXZ(i); cow(HERO[i], c.x, 0, c.z); }
    const cyc = calm ? 0 : t % 7, a = pointXZ(9), b = pointXZ(10);
    let f = 0; if (cyc > 2 && cyc < 2.6) f = (cyc - 2) / 0.6; else if (cyc >= 2.6 && cyc < 5) f = 1; else if (cyc >= 5 && cyc < 5.6) f = 1 - (cyc - 5) / 0.6;
    const e = smooth(f), hop = Math.sin(Math.PI * f) * 3.2;
    cow(2, a.x + (b.x - a.x) * e, 0, a.z + (b.z - a.z) * e, { lift: f > 0 && f < 1 ? hop : 0 });
    beam(0, 2, _c.copy(GOLD).multiplyScalar(0.6 + 0.2 * Math.sin(t * 2.4)), 2.4);
    glow(8, _c.copy(RED).multiplyScalar(0.45 + 0.2 * Math.sin(t * 3)), t, 0.85);
  }
  function drawHerd(t, calm) {
    for (let k = 0; k < 9; k++) {
      const x = ((k * 70 + (calm ? 0 : t) * 2.2) % 640) - 320, z = -520 - (k % 3) * 22, step = calm ? 0 : t * 3.2 + k * 1.7;
      _e.set(0, 0, Math.sin(step) * 0.04, 'YXZ'); _q.setFromEuler(_e); _s.setScalar(2.6 + (k % 3) * 0.2); _p.set(x, GROUND - 1.6 + Math.abs(Math.sin(step)) * 0.3, z);
      herd.setMatrixAt(k, _m.compose(_p, _q, _s));
    }
    herd.instanceMatrix.needsUpdate = true;
  }

  // ---------------------------------------------------------------- framing per screen
  const HERO_SCENES = new Set(['title', 'info', 'demo-limit']);
  const isBoard = (st) => !HERO_SCENES.has(st.scene) && !(st.scene === 'puzzle' && st.pz?.status === 'making');
  function framing(st, L, board, t) {
    if (board) {
      const S = L.scene(sceneKind(st.scene)), rc = rectCss(S.stage);
      const pts = [[-HALF, 0, -HALF], [HALF, 0, -HALF], [-HALF, GROUND, HALF], [HALF, GROUND, HALF], [-26, GROUND + 5, -(HALF + 16)], [26, GROUND + 5, -(HALF + 16)], [-26, GROUND, HALF + 16], [26, GROUND, HALF + 16]];
      return fit(rc, pts, { yaw: 0, tilt: L.wide ? 44 : 47, fov: 30, tx: 0, ty: 0, tz: 0 });
    }
    const T = L.title(!!st.saved), drift = st.calm ? 0 : 1;
    const base = { yaw: -16 + 9 * Math.sin(t * TAU / 34) * drift, tilt: (L.wide ? 11 : 9) + 2 * Math.sin(t * TAU / 23) * drift, fov: L.wide ? 40 : 44, tx: 0, ty: 0, tz: 0 };
    const pts = [[-HALF, 0, -HALF], [HALF, 0, -HALF], [-HALF, GROUND, HALF], [HALF, GROUND, HALF], [0, COW.h + 1, 0]];
    const hr = T.heroRect, zoom = L.wide ? 1 : 1.32, rc = { x: hr.x - hr.w * (zoom - 1) / 2, y: hr.y, w: hr.w * zoom, h: hr.h };
    return fit(rectCss(rc), pts, base);
  }

  // ---------------------------------------------------------------- per frame
  let game = null, lost = false, lastNow = 0, frameAvg = 16, slowFrames = 0, fadeIn = 0, lastT = 0;
  function pre() {
    if (!game || lost) return;
    const state = game.getState(), L = layoutFor(meta.width, meta.height), board = isBoard(state);
    boardOn = board && state.scene !== 'over';
    Object.assign(cur, framing(state, L, board, state.t));
    place(camera, cur);
  }
  function post() {
    if (!game || lost) return;
    const now = performance.now(), dt = clamp((now - (lastNow || now)) / 1000, 0, 0.1); lastNow = now;
    const state = game.getState(), board = isBoard(state), t = state.t, gdt = clamp(t - lastT, 0, 0.1); lastT = t;
    begin();
    if (board) drawBoard(state, t); else drawHero(t, state.calm);
    end();
    drawHerd(t, state.calm);
    moveMotes(t, board ? 90 : 70);
    for (const s of parts) {
      if (!s.visible) continue;
      const u = s.userData; u.age += gdt; if (u.age >= u.life) { s.visible = false; continue; }
      const f = u.age / u.life; u.vy += (u.dust ? -2.5 : -6) * gdt; u.vx *= 0.97; u.vz *= 0.97; u.x += u.vx * gdt; u.y = Math.max(0.2, u.y + u.vy * gdt); u.z += u.vz * gdt;
      s.position.set(u.x, u.y, u.z); const sz = u.size * (1 + f * u.grow); s.scale.set(sz, sz, 1); s.material.opacity = (1 - f) * (1 - f) * (u.dust ? 0.7 : 1);
    }
    if (fadeIn < 1) { fadeIn = Math.min(1, fadeIn + dt / 0.45); v3.fade = fadeIn; }
    renderer.setSize(cssW(), cssH(), false);
    renderer.render(scene, camera);
    const ft = dt * 1000; if (ft > 0) frameAvg = frameAvg * 0.95 + ft * 0.05;
    if (frameAvg > 26 && tier < 2) { if (++slowFrames > 90) { tier++; slowFrames = 0; frameAvg = 16; applyTier(); } } else slowFrames = 0;
  }

  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; v3.on = false; canvas.style.visibility = 'hidden'; });
  canvas.addEventListener('webglcontextrestored', () => { lost = false; buildEnv(); applyTier(); fadeIn = 0; v3.fade = 0; v3.on = true; canvas.style.visibility = 'visible'; });

  await tick();
  place(camera, cur); try { renderer.compile(scene, camera); } catch { /* compiled lazily */ }
  await tick();

  return {
    ok: true, renderer, scene, camera,
    attach(g) { game = g; v3.on = true; v3.fade = 0; fadeIn = 0; canvas.style.visibility = 'visible'; },
    pre, post,
    get tier() { return TIERS[tier].name; },
    loseContext() { const ext = renderer.getContext().getExtension('WEBGL_lose_context'); ext?.loseContext(); return ext; },
  };
}
