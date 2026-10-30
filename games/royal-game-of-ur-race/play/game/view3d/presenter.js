// Royal Game of Ur 3D presenter. READS the game state (game.getState()) and what view.js recorded this frame (v3.rec / v3.tray /
// v3.hero); never writes game state. One WebGL canvas sits behind the kit's transparent 2D canvas: the inlaid board of Ur on a
// cedar table by a clay oil lamp, shell and jet counters, and a lined tray where four pyramid dice are thrown. The camera is fitted
// to the layout's board rectangle (play) or hero rectangle (title), and taps / labels go through v3.toBoard / v3.toScreen.
// No WebGL, ?flat=1 or a lost context: v3.on = false and every screen draws the flat 2D art; a restored context rebuilds and returns.
import * as THREE from '../vendor3d/three.js';
import { v3 } from '../src/v3.js';
import { meta } from '../src/game.js';
import { layoutFor, X0, CW, YB, YT, isPlayable as playable2d } from '../src/layout.js';
import { C, TOP, PR, TRAY_Y, bw, bz, fromW, cellPos, buildBoard, buildTrays, pieceKit, dieKit, buildRoom, buildLights, radialTex, glowSquareTex, trayFloorTex } from './world.js';

const TAU = Math.PI * 2, D2R = Math.PI / 180;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = (f) => f * f * (3 - 2 * f);
const hash = (a, b = 0) => { let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
const TIERS = [{ name: 'high', dpr: 2, shadow: 2048, tex: 512 }, { name: 'medium', dpr: 1.5, shadow: 1024, tex: 512 }, { name: 'low', dpr: 1, shadow: 0, tex: 256 }];
const tick = () => new Promise((r) => setTimeout(r, 0));
const LIFT_CM = 2.6;                     // one unit of the flat art's "lift" = this many cm above the board
const SETTLE = 0.32;

// The board scene of a state (same rule as view.js) and its layout kind
export function boardKindOf(state) {
  const sc = state.scene;
  const board = sc === 'play' || sc === 'over' || sc === 'lesson' || (sc === 'puzzle' && state.pz?.status !== 'making') || sc === 'autoplay' || sc === 'autoplay-over';
  if (!board) return null;
  return sc === 'autoplay' || sc === 'autoplay-over' ? 'auto' : sc === 'lesson' || sc === 'puzzle' ? 'text' : 'play';
}
// is a BOARD-space point on the inlaid squares (vs the side trays / table)
const onSquares = (bx, by) => {
  if (bx < X0 - 4 || bx > X0 + 3 * CW + 4 || by < YT - 4 || by > YB + 4) return false;
  const lane = clamp(Math.floor((bx - X0) / CW), 0, 2), c = clamp(Math.floor((YB - by) / 122), 0, 7); return playable2d(lane, c);
};
// A thrown die: tumbles in from the side, bounces twice, rocks and settles on the face that leaves its result tip up.
export function dieThrow(k, f, calm) {
  const e = ease(clamp(f / 0.82, 0, 1)), h1 = hash(k, 3), h2 = hash(k, 7);
  const hop = calm ? 0 : Math.abs(Math.cos(e * Math.PI * 2.5)) * (1 - e) * (1 - e) * 4.2;
  const rock = f > 0.82 && !calm ? Math.sin((f - 0.82) / 0.18 * Math.PI * 3) * (1 - (f - 0.82) / 0.18) * 0.12 : 0;
  return { dx: (1 - e) * (-7 - h1 * 4), dz: (1 - e) * (h2 - 0.5) * 5, y: hop, spin: (1 - e) * (calm ? 2 : 9 + h1 * 6), rock };
}

export async function createPresenter({ kitCanvas }) {
  const qs = new URLSearchParams(location.search);
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;height:100dvh;display:block;pointer-events:none;z-index:0;visibility:hidden;opacity:0';
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' }); } catch (e) { console.warn('WebGL unavailable; flat 2D art', e); return { ok: false }; }
  if (!renderer.getContext()) return { ok: false };
  kitCanvas.parentElement.insertBefore(canvas, kitCanvas);
  const vig = document.createElement('div');                       // a soft lens vignette over the 3D scene (under the 2D layer)
  vig.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:0;visibility:hidden;background:radial-gradient(ellipse at 50% 46%, rgba(0,0,0,0) 52%, rgba(4,2,1,0.55) 100%)';
  kitCanvas.parentElement.insertBefore(vig, kitCanvas);
  kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.autoClear = false;
  let tier = qs.has('tier') ? clamp(Number(qs.get('tier')), 0, 2) : (navigator.hardwareConcurrency || 8) <= 4 ? 1 : 0;

  await tick();
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b0705);
  scene.fog = new THREE.Fog(0x0b0705, 150, 420);
  const camera = new THREE.PerspectiveCamera(30, 1, 1, 900);
  const lights = buildLights(scene);
  const buildEnv = () => { try { const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture; pm.dispose(); scene.environmentIntensity = 0.28; } catch { /* no IBL */ } };
  buildEnv();
  await tick();
  const room = buildRoom(scene);
  room.lamp.updateMatrixWorld(true);
  lights.flameL.position.copy(room.lamp.localToWorld(room.flame.position.clone()));
  await tick();
  let board = buildBoard(TIERS[tier].tex); scene.add(board);
  const trays = buildTrays(); scene.add(trays);
  await tick();

  // ---------------------------------------------------------------- counters (pool), ghosts, glows
  const PK = pieceKit();
  const ghostMats = PK.sides.map((m) => { const body = m.body.clone(), top = m.top.clone(); body.transparent = true; body.opacity = 0.38; body.depthWrite = false; top.opacity = 0.38; top.depthWrite = false; return { body, top }; });
  const makePiece = () => { const g = new THREE.Group(), b = new THREE.Mesh(PK.body), t = new THREE.Mesh(PK.cap); b.castShadow = true; b.receiveShadow = true; t.receiveShadow = true; g.add(b, t); g.visible = false; scene.add(g); return g; };
  const pieces = Array.from({ length: 24 }, makePiece);
  const flatQuad = new THREE.PlaneGeometry(1, 1); flatQuad.rotateX(-Math.PI / 2);
  const add = (map, n, ro) => Array.from({ length: n }, () => { const m = new THREE.Mesh(flatQuad, new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); m.renderOrder = ro; m.visible = false; scene.add(m); return m; });
  const glowT = radialTex('255,255,255', 1, 128), ringC = document.createElement('canvas'); ringC.width = ringC.height = 128;
  { const x = ringC.getContext('2d'), g = x.createRadialGradient(64, 64, 30, 64, 64, 64); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.6, 'rgba(255,255,255,0.15)'); g.addColorStop(0.78, 'rgba(255,255,255,1)'); g.addColorStop(0.9, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); }
  const ringT = new THREE.CanvasTexture(ringC); ringT.colorSpace = THREE.SRGBColorSpace;
  const pieceGlows = add(ringT, 16, 3), cellGlows = add(glowSquareTex(), 6, 3), dots = add(glowT, 20, 3), rings = add(ringT, 4, 3), homeGlows = add(glowSquareTex(), 2, 3);
  const blobT = radialTex('0,0,0', 0.85, 64);
  const blobs = Array.from({ length: 24 }, () => { const m = new THREE.Mesh(flatQuad, new THREE.MeshBasicMaterial({ map: blobT, transparent: true, depthWrite: false, opacity: 0.5 })); m.renderOrder = 1; m.visible = false; scene.add(m); return m; });
  const dustT = radialTex('230,205,170', 0.85);
  const dust = Array.from({ length: 12 }, () => { const m = new THREE.Mesh(flatQuad, new THREE.MeshBasicMaterial({ map: dustT, transparent: true, depthWrite: false })); m.renderOrder = 2; m.visible = false; m.userData = { t: 9 }; scene.add(m); return m; });
  let dustI = 0; const puff = (x, y, z, s = 1) => { const m = dust[dustI++ % dust.length]; m.userData = { t: 0, x, y, z, s }; };
  // motes drifting in the lamp light
  const NM = 90, mp = new Float32Array(NM * 3), mseed = [];
  for (let i = 0; i < NM; i++) mseed.push([hash(i, 1), hash(i, 2), hash(i, 3)]);
  const motesG = new THREE.BufferGeometry(); motesG.setAttribute('position', new THREE.BufferAttribute(mp, 3));
  const motes = new THREE.Points(motesG, new THREE.PointsMaterial({ map: radialTex('255,220,170', 1, 32), size: 0.45, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.55, fog: false })); motes.frustumCulled = false; scene.add(motes);

  // ---------------------------------------------------------------- dice: the tray (own scene, own camera) and a set lying on the table for the title
  const DK = dieKit();
  const trayScene = new THREE.Scene(); trayScene.background = new THREE.Color(0x1d0c08);
  const trayCam = new THREE.PerspectiveCamera(26, 1, 1, 200);
  trayScene.environment = scene.environment; trayScene.environmentIntensity = 0.5;
  const floorT = trayFloorTex(); floorT.repeat.set(3, 1.5);
  const trayFloor = new THREE.Mesh(new THREE.PlaneGeometry(200, 120), new THREE.MeshStandardMaterial({ map: floorT, roughness: 0.95 })); trayFloor.rotation.x = -Math.PI / 2; trayFloor.receiveShadow = true; trayScene.add(trayFloor);
  trayScene.add(new THREE.HemisphereLight(0xffe0c0, 0x1a0c06, 0.9));
  const tKey = new THREE.DirectionalLight(0xffd7a8, 2.6); tKey.position.set(14, 30, 10); tKey.castShadow = true; Object.assign(tKey.shadow.camera, { left: -30, right: 30, top: 20, bottom: -20, near: 5, far: 80 }); tKey.shadow.mapSize.set(1024, 1024); tKey.shadow.radius = 3; tKey.shadow.bias = -0.0005; trayScene.add(tKey);
  const tRim = new THREE.DirectionalLight(0x9fb8ff, 0.6); tRim.position.set(-20, 12, -20); trayScene.add(tRim);
  const trayDice = [0, 1, 2, 3].map(() => { const d = DK.make(); trayScene.add(d); return d; });
  const tipGlowT = radialTex('255,214,120', 1, 64);
  const tipGlows = trayDice.map(() => { const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: tipGlowT, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); m.scale.setScalar(2.2); m.visible = false; trayScene.add(m); return m; });
  const trayBlobs = trayDice.map(() => { const m = new THREE.Mesh(flatQuad, new THREE.MeshBasicMaterial({ map: blobT, transparent: true, depthWrite: false, opacity: 0.55 })); trayScene.add(m); return m; });

  function applyTier() {
    const t = TIERS[tier];
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, t.dpr));
    renderer.shadowMap.enabled = t.shadow > 0; lights.key.castShadow = t.shadow > 0; tKey.castShadow = t.shadow > 0;
    if (t.shadow) { lights.key.shadow.mapSize.set(t.shadow, t.shadow); if (lights.key.shadow.map) { lights.key.shadow.map.dispose(); lights.key.shadow.map = null; } }
    for (const b of blobs) b.material.opacity = t.shadow ? 0.32 : 0.55;
    for (const s of [scene, trayScene]) s.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => { m.needsUpdate = true; }); });
  }
  applyTier();

  // ---------------------------------------------------------------- camera: yaw/tilt/fov per screen, distance + off-axis shift fitted to a rectangle
  const cur = { yaw: 0, tilt: 56, fov: 30, dist: 90, ox: 0, oy: 0, tx: 0, ty: 0, tz: 0 };
  let snap = true, viewKey = '';
  const _v = new THREE.Vector3(), _t = new THREE.Vector3(), cssW = () => Math.max(1, window.innerWidth), cssH = () => Math.max(1, window.innerHeight);
  function place(cam, p, W = cssW(), H = cssH()) {
    const dir = _v.set(Math.sin(p.yaw * D2R) * Math.cos(p.tilt * D2R), Math.sin(p.tilt * D2R), Math.cos(p.yaw * D2R) * Math.cos(p.tilt * D2R));
    cam.fov = p.fov; cam.aspect = W / H; _t.set(p.tx, p.ty, p.tz);
    cam.position.copy(_t).addScaledVector(dir, p.dist); cam.up.set(0, 1, 0); cam.lookAt(_t);
    if (p.ox || p.oy) cam.setViewOffset(W, H, p.ox, p.oy, W, H); else cam.clearViewOffset();
    cam.updateProjectionMatrix(); cam.updateMatrixWorld(true);
  }
  const fitCam = new THREE.PerspectiveCamera();
  const toCss = (cam, x, y, z, out = { x: 0, y: 0 }) => { _v.set(x, y, z).project(cam); out.x = (_v.x + 1) / 2 * cssW(); out.y = (1 - _v.y) / 2 * cssH(); return out; };
  function fit(rc, pts, base) {
    const p = { ...base, ox: 0, oy: 0, dist: 90 }, q = { x: 0, y: 0 }; let bb = null;
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
  const ray = new THREE.Raycaster(), hit = new THREE.Vector3(), ndc = new THREE.Vector2();
  const planeTop = new THREE.Plane(new THREE.Vector3(0, 1, 0), -TOP), planeTray = new THREE.Plane(new THREE.Vector3(0, 1, 0), -TRAY_Y);
  v3.toBoard = (vx, vy) => {
    ndc.set(((vx * cpu() + offX()) / cssW()) * 2 - 1, 1 - ((vy * cpu() + offY()) / cssH()) * 2);
    ray.setFromCamera(ndc, camera);
    if (!ray.ray.intersectPlane(planeTop, hit)) return null;
    let p = fromW(hit.x, hit.z);
    if (!onSquares(p.x, p.y) && ray.ray.intersectPlane(planeTray, hit)) p = fromW(hit.x, hit.z);     // beside the board: the tray bed
    return p;
  };
  v3.toScreen = (bx, by, lift = 0) => virt(toCss(camera, bw(bx), (onSquares(bx, by) ? TOP : TRAY_Y) + lift, bz(by)));

  // ---------------------------------------------------------------- pieces
  const baseY = new Map(), prevLift = new Map(), landed = new Map(), prevPos = new Map();
  let clock = 0;
  function drawPieces(rec, dt) {
    let n = 0, ng = 0, nb = 0;
    const seen = new Set();
    for (const p of rec.pieces) {
      if (n >= pieces.length) break;
      const g = pieces[n++], side = p.s, sc = clamp(p.r / 40, 0.5, 1.2), key = p.key ?? -1 - n;
      const x = bw(p.x), z = bz(p.y), goal = onSquares(p.x, p.y) ? TOP : TRAY_Y;
      let by = goal;
      if (key >= 0 && !p.dim) {
        seen.add(key);
        const was = baseY.get(key); by = was === undefined ? goal : was + (goal - was) * (1 - Math.exp(-dt * 16)); baseY.set(key, by);
        const pl = prevLift.get(key) ?? 0;
        if (pl > 0.12 && p.lift < 0.04 && !rec.calm) { landed.set(key, clock); puff(x, goal, z, sc); }
        prevLift.set(key, p.lift);
      }
      const lift = Math.max(0, p.lift) * LIFT_CM;
      // a landing: a small squash and a rock that dies away; a hop leans into its direction of travel
      let sq = 1, tx = 0, tz = 0;
      const lt = landed.has(key) ? clock - landed.get(key) : 9;
      if (lt < SETTLE) { const s = lt / SETTLE, d = (1 - s) * (1 - s); sq = 1 - 0.3 * Math.sin(s * Math.PI) * d; tx = Math.sin(s * Math.PI * 3) * 0.08 * d; }
      const pp = prevPos.get(key);
      if (pp && key >= 0 && p.lift > 0.05 && dt > 0) { const vx = (x - pp.x) / dt, vz = (z - pp.z) / dt; tz = clamp(-vx * 0.006, -0.3, 0.3); tx += clamp(vz * 0.006, -0.3, 0.3); }
      if (key >= 0) prevPos.set(key, { x, z });
      g.visible = true; g.position.set(x, by + lift, z); g.scale.set(sc, sc * sq, sc); g.rotation.set(tx, hash(key + 9, 3) * TAU, tz);
      const M = p.dim ? ghostMats[side] : PK.sides[side]; g.children[0].material = M.body; g.children[1].material = M.top;
      g.children[0].castShadow = !p.dim;
      if (p.glow && ng < pieceGlows.length) {
        const m = pieceGlows[ng++], pu = rec.calm ? 0.8 : 0.65 + 0.35 * Math.sin(rec.t * 5);
        m.visible = true; m.position.set(x, by + 0.03, z); m.scale.setScalar(PR * 2 * sc * (1.75 + (rec.calm ? 0 : 0.08 * Math.sin(rec.t * 5)))); m.material.color.setRGB(1.0 * pu, 0.78 * pu, 0.3 * pu);
      }
      if (!p.dim && lift > 0.05 && nb < blobs.length) { const b = blobs[nb++], s = PR * 2.3 * sc * (1 + lift * 0.08); b.visible = true; b.position.set(x + lift * 0.25, by + 0.02, z + lift * 0.2); b.scale.set(s, 1, s); b.material.opacity = 0.42 / (1 + lift * 0.25); }
    }
    for (; n < pieces.length; n++) pieces[n].visible = false;
    for (; ng < pieceGlows.length; ng++) pieceGlows[ng].visible = false;
    for (; nb < blobs.length; nb++) blobs[nb].visible = false;
    for (const k of [...baseY.keys()]) if (!seen.has(k)) { baseY.delete(k); prevLift.delete(k); prevPos.delete(k); }
    for (const [k, t0] of landed) if (clock - t0 > SETTLE) landed.delete(k);
  }
  const col = (m, rgb, a = 1) => { const [r, g, b] = rgb.split(',').map((v) => Number(v) / 255); m.material.color.setRGB(r * r * 1.4 * a, g * g * 1.4 * a, b * b * 1.4 * a); };
  function drawMarks(rec) {
    let k = 0;
    for (const c of rec.cells) { if (k >= cellGlows.length) break; const m = cellGlows[k++], p = cellPos(c.lane, c.c); m.visible = true; m.position.set(p.x, TOP + 0.04, p.z); m.scale.set(C * 0.98, 1, C * 0.98); col(m, c.rgb, c.a); }
    for (; k < cellGlows.length; k++) cellGlows[k].visible = false;
    k = 0;
    for (const d of rec.dots) { if (k >= dots.length) break; const m = dots[k++]; m.visible = true; m.position.set(bw(d.x), TOP + 0.05, bz(d.y)); m.scale.set(1.1, 1, 1.1); col(m, d.rgb, 0.9); }
    for (; k < dots.length; k++) dots[k].visible = false;
    k = 0;
    for (const h of rec.homes) { if (k >= homeGlows.length) break; const m = homeGlows[k++]; m.visible = true; m.position.set(bw(h.s === 0 ? 63 : 657), TRAY_Y + 0.05, bz(451)); m.scale.set(bw(118) - bw(8), 1, bz(576) - bz(326)); col(m, h.rgb, h.a); }
    for (; k < homeGlows.length; k++) homeGlows[k].visible = false;
    k = 0;
    for (const r of rec.rings) { if (k >= rings.length) break; const m = rings[k++], s = PR * 2 * (1.2 + 2.4 * r.f); m.visible = true; m.position.set(bw(r.x), TOP + 0.06, bz(r.y)); m.scale.set(s, 1, s); col(m, r.rgb, 1 - r.f); }
    for (; k < rings.length; k++) rings[k].visible = false;
  }
  const hideMarks = () => { for (const a of [pieceGlows, cellGlows, dots, rings, homeGlows]) for (const m of a) m.visible = false; };
  // the title's still life: a game in progress on the board
  const SHOW = { pieces: [], cells: [], dots: [], homes: [], rings: [], calm: false, t: 0 };
  { const sq = (s, p) => { const lane = p >= 5 && p <= 12 ? 1 : s === 0 ? 0 : 2, c = p <= 4 ? 4 - p : p <= 12 ? p - 5 : p === 13 ? 7 : 6; return { x: X0 + lane * CW + CW / 2, y: YB - c * 122 - 61 }; };
    [[0, 2], [0, 6], [0, 8], [1, 3], [1, 10], [1, 13]].forEach(([s, p], i) => { const q = sq(s, p); SHOW.pieces.push({ x: q.x, y: q.y, r: 40, s, lift: 0, key: 100 + i }); });
    for (let k = 0; k < 3; k++) { SHOW.pieces.push({ x: 64, y: YB - 44 - k * 62, r: 30, s: 0, lift: 0, key: 110 + k }); SHOW.pieces.push({ x: 656, y: YB - 44 - k * 62, r: 30, s: 1, lift: 0, key: 120 + k }); } }

  // ---------------------------------------------------------------- the dice tray pass
  const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _ax = new THREE.Vector3(), _w = new THREE.Vector3(), _hp = new THREE.Vector3();
  const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), R2 = new THREE.Raycaster();
  function placeDieAt(d, x, z, quat, yOff) {
    d.quaternion.copy(quat);
    let lo = 1e9; for (const v of DK.verts) { _w.copy(v).applyQuaternion(quat); lo = Math.min(lo, _w.y); }
    d.position.set(x, -lo + yOff, z);
  }
  const tableDice = [0, 1, 2, 3].map((k) => { const d = DK.make(); const q = DK.restQ(k % 2 === 0, hash(k, 6) * TAU); placeDieAt(d, 12 + k * 2.7 + hash(k, 4), 19 + hash(k, 5) * 3, q, 0); scene.add(d); return d; });
  function renderTray(state, calm) {
    const T = v3.tray; if (!T) return;
    const rc = rectCss(T.rect), W = cssW(), H = cssH(); if (rc.w < 4 || rc.h < 4) return;
    const unit = 3.1 / Math.max(10, T.dice[1].x - T.dice[0].x);     // cm per virtual unit, from the dice spacing (3.1 cm apart)
    const th = T.rect.h * unit, tilt = 42 * D2R;
    trayCam.fov = 26; trayCam.aspect = rc.w / rc.h;
    const dist = (th * 0.5) / Math.tan(trayCam.fov * D2R / 2) * 1.02;
    trayCam.position.set(0, Math.sin(tilt) * dist, Math.cos(tilt) * dist); trayCam.lookAt(0, 0, 0); trayCam.updateProjectionMatrix(); trayCam.updateMatrixWorld(true);
    const d = state.dice, rolling = d.phase === 'rolling', f = rolling ? clamp(d.t / d.dur, 0, 1) : 1;
    T.dice.forEach((c, k) => {
      // where the 2D layout wants this die: a ray through that point onto the tray floor
      const nx = ((c.x - T.rect.x) / T.rect.w) * 2 - 1, ny = 1 - ((c.y + 6 - T.rect.y) / T.rect.h) * 2;
      R2.setFromCamera(ndc.set(nx, ny), trayCam); if (!R2.ray.intersectPlane(floorPlane, _hp)) return;
      const val = d.phase === 'none' ? 0 : d.vals[k], rest = DK.restQ(val === 1, k * 0.9 + hash(k, 11) * 0.8 + (d.phase === 'none' ? 0 : hash(Math.round(d.total * 7 + k), 2)));
      const dc = trayDice[k], th2 = rolling ? dieThrow(k, f, calm) : { dx: 0, dz: 0, y: 0, spin: 0, rock: 0 };
      _ax.set(hash(k, 21) - 0.5, 0.4, hash(k, 22) - 0.5).normalize(); _q2.setFromAxisAngle(_ax, th2.spin); _q.copy(rest).premultiply(_q2);
      if (th2.rock) { _ax.set(1, 0, 0.3).normalize(); _q2.setFromAxisAngle(_ax, th2.rock); _q.premultiply(_q2); }
      placeDieAt(dc, _hp.x + th2.dx, _hp.z + th2.dz, _q, th2.y);
      // a counted die: its gold tip, now pointing up, glints once the dice have settled
      const tg = tipGlows[k], on = d.phase !== 'none' && val === 1 && f >= 1;
      tg.visible = on; if (on) { tg.position.set(dc.position.x, dc.position.y + DK.top + 0.1, dc.position.z); tg.material.opacity = calm ? 0.7 : 0.55 + 0.25 * Math.sin(clock * 3 + k); }
      const b = trayBlobs[k], s = 3.4 / (1 + th2.y * 0.15); b.position.set(dc.position.x + th2.y * 0.3, 0.01, dc.position.z + th2.y * 0.2); b.scale.set(s, 1, s);
    });
    // a soft warm pulse on the floor when it is the player's turn to throw
    trayScene.background.setRGB(0.11 + (T.ready && !calm ? 0.03 * (0.5 + 0.5 * Math.sin(clock * 5)) : 0), 0.045, 0.03);
    renderer.setScissorTest(true);
    renderer.setViewport(rc.x, H - rc.y - rc.h, rc.w, rc.h); renderer.setScissor(rc.x, H - rc.y - rc.h, rc.w, rc.h);
    renderer.clear(); renderer.render(trayScene, trayCam);
    renderer.setScissorTest(false); renderer.setViewport(0, 0, W, H);
  }

  // ---------------------------------------------------------------- per frame
  let game = null, lost = false, lastNow = 0, frameAvg = 16, slowFrames = 0, fadeIn = 0, lastHero = null, lastBoard = null;
  const BLOCK_PTS = (() => { const out = []; for (const bx of [8, 712]) for (const by of [326, 1306]) out.push([bw(bx), 0, bz(by)]); for (const bx of [X0 - 10, X0 + 3 * CW + 10]) for (const by of [YT - 10, YB + 10]) out.push([bw(bx), TOP, bz(by)]); return out; })();
  function framing(state, L) {
    const kind = boardKindOf(state), t = state.t, calm = state.calm;
    if (kind) {
      const B = L.board(kind), rc = rectCss(B.rect);
      return fit(rc, BLOCK_PTS, B.rot ? { yaw: -90, tilt: 56, fov: 28, tx: 0, ty: TOP, tz: 0 } : { yaw: 0, tilt: 57, fov: 28, tx: 0, ty: TOP, tz: 0 });
    }
    const drift = calm ? 0 : 1;
    const base = { yaw: 24 + 7 * Math.sin(t * TAU / 34) * drift, tilt: 30 + 3 * Math.sin(t * TAU / 23) * drift, fov: 32, tx: 0, ty: 1, tz: 2 };
    const pts = [[-7, 0, bz(1306) + 1], [7, 0, bz(1306) + 1], [-7, TOP, bz(330) - 1], [7, TOP, bz(330) - 1], [12, 5, -27]];
    let r = lastHero; const U = L.U;
    if (r && r.h < 300 && !L.land) r = { x: U.x0, y: U.y0 + U.h * 0.12, w: U.w, h: U.h * 0.62 };     // a short art strip (tablet portrait): the scene sits behind the menu
    if (!r) r = L.land ? { x: U.x0, y: U.y0, w: U.w * 0.55, h: U.h } : { x: U.x0, y: U.y0 + U.h * 0.1, w: U.w, h: U.h * 0.6 };
    const rc = rectCss(r), gx = rc.w * 0.06, gy = rc.h * 0.04; rc.x += gx; rc.w -= 2 * gx; rc.y += gy; rc.h -= 2 * gy;
    return fit(rc, pts, base);
  }
  function pre() {
    if (!game || lost) return;
    const state = game.getState(), L = layoutFor(meta.width, meta.height), kind = boardKindOf(state);
    const vk = `${cssW()}x${cssH()}|${L.key}`; if (vk !== viewKey) { viewKey = vk; snap = true; }
    if (lastBoard !== !!kind) { lastBoard = !!kind; snap = true; }
    const goal = framing(state, L);
    const now = performance.now(), dt = clamp((now - (lastNow || now)) / 1000, 0, 0.1);
    const k = snap || kind ? 1 : 1 - Math.exp(-dt * 5);
    for (const key of Object.keys(goal)) cur[key] += (goal[key] - cur[key]) * k;
    snap = false;
    place(camera, cur);
  }
  function post() {
    if (!game || lost) return;
    const now = performance.now(), dt = clamp((now - (lastNow || now)) / 1000, 0, 0.1); lastNow = now; clock += dt;
    const state = game.getState(), calm = state.calm, rec = v3.rec;
    lastHero = v3.hero;
    if (rec) { drawPieces(rec, dt); drawMarks(rec); }
    else { hideMarks(); SHOW.t = state.t; SHOW.calm = calm; drawPieces(SHOW, dt); }
    for (const d of tableDice) d.visible = !rec;
    for (const m of dust) {
      const u = m.userData; if (!(u.t <= 0.55)) { m.visible = false; continue; }
      u.t += dt; const f = Math.min(1, u.t / 0.55), s = (PR * 2 + f * 3.2) * u.s;
      m.visible = true; m.position.set(u.x, u.y + 0.05 + f * 0.25, u.z); m.scale.set(s, 1, s); m.material.opacity = 0.5 * (1 - f) * (1 - f);
    }
    // the lamp: flame flicker moves the warm light; motes drift through it
    const fl = calm ? 1 : 0.86 + 0.09 * Math.sin(clock * 9.1) + 0.05 * Math.sin(clock * 15.7 + 1) + 0.03 * Math.sin(clock * 23.3);
    lights.flameL.intensity = 260 * fl; room.flame.scale.set(1.5 * (0.95 + 0.05 * fl), 3.2 * fl, 1); room.halo.material.opacity = 0.75 + 0.25 * fl;
    room.flame.position.x = calm ? 0 : Math.sin(clock * 3.3) * 0.08;
    for (let i = 0; i < NM; i++) {
      const [a, b, c] = mseed[i], tt = calm ? 0 : clock;
      mp[i * 3] = -22 + a * 48 + Math.sin(tt * 0.13 + a * 9) * 2; mp[i * 3 + 1] = 2 + ((b * 26 + tt * (0.3 + c * 0.4)) % 26); mp[i * 3 + 2] = -30 + c * 52 + Math.cos(tt * 0.11 + b * 7) * 2;
    }
    motesG.attributes.position.needsUpdate = true; motes.visible = !calm;
    if (fadeIn < 1) { fadeIn = Math.min(1, fadeIn + dt / 0.42); v3.fade = fadeIn; canvas.style.opacity = String(fadeIn); }
    renderer.setSize(cssW(), cssH(), false);
    renderer.clear(); renderer.render(scene, camera);
    if (rec) renderTray(state, calm);
    const ft = dt * 1000; if (ft > 0) frameAvg = frameAvg * 0.95 + ft * 0.05;
    if (frameAvg > 28 && tier < 2) { if (++slowFrames > 90) { tier++; slowFrames = 0; frameAvg = 16; applyTier(); } } else slowFrames = 0;
  }

  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; v3.on = false; canvas.style.visibility = 'hidden'; vig.style.visibility = 'hidden'; });
  canvas.addEventListener('webglcontextrestored', () => {
    lost = false; buildEnv(); trayScene.environment = scene.environment;
    scene.remove(board); board.userData.dispose(); board = buildBoard(TIERS[tier].tex); scene.add(board);
    applyTier(); fadeIn = 0; v3.fade = 0; v3.on = true; canvas.style.visibility = 'visible'; vig.style.visibility = 'visible'; snap = true;
  });

  place(camera, cur); try { renderer.compile(scene, camera); renderer.compile(trayScene, trayCam); } catch { /* compiled lazily */ }
  await tick();

  return {
    ok: true, renderer, scene, camera,
    attach(g) { game = g; v3.on = true; v3.fade = 0; fadeIn = 0; canvas.style.visibility = 'visible'; vig.style.visibility = 'visible'; snap = true; },
    pre, post,
    get tier() { return TIERS[tier].name; },
    loseContext() { const ext = renderer.getContext().getExtension('WEBGL_lose_context'); ext?.loseContext(); return ext; },
  };
}
