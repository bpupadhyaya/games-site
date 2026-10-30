// Janggi 3D presenter. READS the game state (game.getState() + what view.js publishes in v3.frame / v3.marks), never writes it.
// One WebGL canvas sits behind the kit's transparent 2D canvas: a janggi board with white-brass fittings on the oiled-paper floor of a
// hanok room, lattice paper doors glowing behind. The camera is fitted to the layout's board rectangle (play / lesson / Auto Play /
// set-up) or hero rectangle (menu), so 2D HUD, taps and labels line up with the tilted board through v3.proj / v3.unproj.
// No WebGL, ?flat=1 or a lost context: v3.on = false and every screen draws the flat 2D art; a restored context rebuilds and returns.
import * as THREE from '../vendor3d/three.js';
import { v3 } from '../src/v3.js';
import { meta } from '../src/game.js';
import { layoutFor, GX, GY, D } from '../src/layout.js';
import { C, TOP, FEET, BX, BZ, sqPos, apothem, pieceGeo, pieceFaceMat, buildBoard, buildRoom, buildProps, buildLights, radialTex, markTextures } from './world.js';

const TAU = Math.PI * 2, D2R = Math.PI / 180;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = (f) => f * f * (3 - 2 * f);
const hash = (a, b = 0) => { let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
const TIERS = [{ name: 'high', dpr: 2, shadow: 2048, tex: 1024 }, { name: 'medium', dpr: 1.5, shadow: 1024, tex: 1024 }, { name: 'low', dpr: 1, shadow: 0, tex: 512 }];
const tick = () => new Promise((r) => setTimeout(r, 0));
const BOARD_SCENES = new Set(['play', 'lesson', 'autoplay']);
const START_COUNT = [0, 1, 2, 2, 2, 2, 2, 5];
const POOL = 80;

// A moved piece: lifted, carried with a slight lean into the travel direction, then put down firmly (the janggi "tak").
export function movePose(f, calm) {
  const u = clamp(f / 0.92, 0, 1), e = ease(u);        // arrives at 92 % of the move, the rest is the settle after the tak
  const up = Math.pow(Math.sin(Math.PI * u), 1.35);        // eased off the board and back down onto it (no snap at either end)
  return { e, lift: up * (calm ? 1.2 : 3.4), lean: calm ? 0 : 0.22 * Math.sin(TAU * u) * (u < 0.5 ? 1 : 0.6) };
}
// After the tak: a tiny rebound and a damped rock (wood on wood).
export function landPose(t) {
  if (t < 0 || t >= 0.3) return { y: 0, tilt: 0 };
  const s = t / 0.3, d = (1 - s) * (1 - s);
  return { y: Math.sin(s * Math.PI) * 0.22 * d, tilt: Math.sin(s * Math.PI * 2) * 0.05 * d };
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
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.82;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  let tier = qs.has('tier') ? clamp(Number(qs.get('tier')), 0, 2) : (navigator.hardwareConcurrency || 8) <= 4 ? 1 : 0;

  // the piece faces and the board watermark are painted once: wait for the embedded fonts first (never cache a fallback glyph)
  try { await Promise.race([Promise.all([document.fonts.load('700 40px "Janggi Serif"', '楚漢士象馬車包卒兵將棋'), document.fonts.load('700 40px "Cormorant Garamond"', 'KGEHRCS')]), new Promise((r) => setTimeout(r, 2500))]); } catch { /* paint with what is there */ }
  await tick();
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x2a1a10);
  scene.fog = new THREE.Fog(0x3a2614, 260, 900);
  const camera = new THREE.PerspectiveCamera(30, 1, 2, 3000);
  const lights = buildLights(scene);
  const buildEnv = () => { try { const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture; pm.dispose(); scene.environmentIntensity = 0.4; } catch { /* no IBL */ } };
  buildEnv();
  await tick();
  const room = buildRoom(scene, { quality: tier < 2 ? 1 : 0 });
  await tick();
  const props = buildProps(); scene.add(props.group);
  props.cup.position.set(BX + 13, 0, BZ - 6); props.cloth.position.set(-BX - 18, 0, -BZ + 12); props.cloth.rotation.y = 0.22;
  props.box.position.set(-BX - 34, 0, -BZ - 14); props.box.rotation.y = 0.5;

  // pieces: a pool of meshes; geometry + materials swapped per frame (at most 32 on the board, 30 captured beside it)
  const pieces = Array.from({ length: POOL }, () => { const m = new THREE.Mesh(pieceGeo(1), pieceFaceMat(1)); m.castShadow = true; m.receiveShadow = true; m.visible = false; scene.add(m); return m; });
  const flatQuad = new THREE.PlaneGeometry(1, 1); flatQuad.rotateX(-Math.PI / 2);
  const blobMat = new THREE.MeshBasicMaterial({ map: radialTex('20,10,4', 0.85), transparent: true, depthWrite: false, opacity: 0.55 });
  const blobs = Array.from({ length: POOL }, () => { const m = new THREE.Mesh(flatQuad, blobMat.clone()); m.renderOrder = 1; m.visible = false; scene.add(m); return m; });
  const MT = markTextures();
  const marksPool = Array.from({ length: 96 }, () => { const m = new THREE.Mesh(flatQuad, new THREE.MeshBasicMaterial({ map: MT.glow, transparent: true, depthWrite: false, fog: false })); m.renderOrder = 2; m.visible = false; scene.add(m); return m; });
  // a puff of fine dust where a piece is put down
  const dustT = radialTex('255,236,200', 0.8);
  const dust = Array.from({ length: 10 }, () => { const m = new THREE.Mesh(flatQuad, new THREE.MeshBasicMaterial({ map: dustT, transparent: true, depthWrite: false })); m.renderOrder = 3; m.visible = false; m.userData = { t: 9 }; scene.add(m); return m; });
  let dustI = 0;
  const puff = (x, z, s = 1, y = TOP) => { const m = dust[dustI++ % dust.length]; m.userData = { t: 0, x, z, s, y }; };
  // dust motes drifting in the daylight from the doors (menu / reading screens)
  const moteN = 140, moteGeo = new THREE.BufferGeometry(), moteP = new Float32Array(moteN * 3), moteSeed = [];
  for (let i = 0; i < moteN; i++) { moteSeed.push([hash(i, 1), hash(i, 2), hash(i, 3)]); }
  moteGeo.setAttribute('position', new THREE.BufferAttribute(moteP, 3));
  const motes = new THREE.Points(moteGeo, new THREE.PointsMaterial({ map: radialTex('255,240,210', 1, 64), size: 0.9, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending }));
  motes.frustumCulled = false; scene.add(motes);

  // boards are cached per (theme, language, texture size)
  const boards = new Map(); let board = null, boardKey = '';
  function setBoard(theme, lang) {
    const k = `${theme}|${lang}|${TIERS[tier].tex}`; if (k === boardKey) return;
    let b = boards.get(k); if (!b) { b = buildBoard(theme, lang, TIERS[tier].tex); boards.set(k, b); }
    if (board) scene.remove(board); board = b; boardKey = k; scene.add(b);
  }
  function applyTier() {
    const t = TIERS[tier];
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, t.dpr));
    renderer.shadowMap.enabled = t.shadow > 0; lights.sun.castShadow = t.shadow > 0;
    if (t.shadow) { lights.sun.shadow.mapSize.set(t.shadow, t.shadow); if (lights.sun.shadow.map) { lights.sun.shadow.map.dispose(); lights.sun.shadow.map = null; } }
    scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => { m.needsUpdate = true; }); });
  }
  applyTier();

  // ---------------------------------------------------------------- camera: yaw/tilt/fov per screen, distance + off-axis shift fitted to a rectangle
  const cur = { yaw: 0, tilt: 60, fov: 30, dist: 120, ox: 0, oy: 0, tx: 0, ty: TOP, tz: 0 };
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

  // ---------------------------------------------------------------- v3 hooks for the 2D layer (canonical flat-board space <-> screen)
  let flipNow = false;
  const canonToWorld = (cx, cy) => { let gx = (cx - GX) / D, gy = (cy - GY) / D; if (flipNow) { gx = 8 - gx; gy = 9 - gy; } return { x: (gx - 4) * C, z: (gy - 4.5) * C }; };
  const pa = { x: 0, y: 0 }, pb = { x: 0, y: 0 };
  v3.proj = (cx, cy, lift = 0) => {
    const w = canonToWorld(cx, cy), y = TOP + lift;
    const p = virt(toCss(camera, w.x, y, w.z, { x: 0, y: 0 }));
    toCss(camera, w.x - C / 2, y, w.z, pa); toCss(camera, w.x + C / 2, y, w.z, pb);
    p.k = Math.hypot(pb.x - pa.x, pb.y - pa.y) / cpu() / D; return p;
  };
  const ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -TOP), hit = new THREE.Vector3(), ndc = new THREE.Vector2();
  v3.unproj = (vx, vy) => {
    ndc.set(((vx * cpu() + offX()) / cssW()) * 2 - 1, 1 - ((vy * cpu() + offY()) / cssH()) * 2);
    ray.setFromCamera(ndc, camera);
    if (!ray.ray.intersectPlane(plane, hit)) return null;
    let gx = hit.x / C + 4, gy = hit.z / C + 4.5; if (flipNow) { gx = 8 - gx; gy = 9 - gy; }
    return { x: GX + gx * D, y: GY + gy * D };
  };

  // ---------------------------------------------------------------- pieces and marks
  let nP = 0, nB = 0;
  const fadeMats = new Map();
  const fadeMat = (p, set, lang, a) => {
    const k = `${p}|${set}|${lang}`; let m = fadeMats.get(k);
    if (!m) { m = pieceFaceMat(p, set, lang).map((x) => { const c = x.clone(); c.transparent = true; return c; }); fadeMats.set(k, m); }
    m[0].opacity = m[1].opacity = a; return m;
  };
  function put(p, x, y, z, yaw, o = {}) {
    if (nP >= POOL || !p) return;
    const t = Math.abs(p), m = pieces[nP++], F = v3.frame;
    m.geometry = pieceGeo(t);
    m.material = o.alpha !== undefined && o.alpha < 1 ? fadeMat(p, F.set, F.lang, Math.max(0, o.alpha)) : pieceFaceMat(p, F.set, F.lang);
    m.position.set(x, y, z); m.rotation.set(o.tx || 0, yaw, o.tz || 0, 'YXZ'); m.scale.setScalar(o.sc ?? 1); m.visible = true;
    if (nB < POOL && (o.blob ?? 1) > 0.02) {
      const base = o.base ?? TOP, lift = Math.max(0, y - base), b = blobs[nB++], s = apothem(t) * 2.9 * (1 + lift * 0.12);
      b.position.set(x + 0.25 + lift * 0.25, base + 0.03, z + 0.35 + lift * 0.3); b.scale.set(s, 1, s); b.visible = true;
      b.material.opacity = 0.6 * (o.blob ?? 1) * (1 - Math.min(0.7, lift * 0.12)) * (o.alpha ?? 1);
    }
  }
  let nM = 0;
  const markRGB = new THREE.Color();
  function mark(x, z, kind, rgb, size, a, y = TOP + 0.05, add = true) {
    if (nM >= marksPool.length) return;
    const m = marksPool[nM++], key = kind + add;
    if (m.userData.k !== key) { m.material.map = MT[kind] || MT.glow; m.material.blending = add ? THREE.AdditiveBlending : THREE.NormalBlending; m.material.needsUpdate = true; m.userData.k = key; }
    const [r, g, b] = rgb.split(',').map((v) => Number(v) / 255); markRGB.setRGB(r, g, b, THREE.SRGBColorSpace); m.material.color.copy(markRGB);
    m.material.opacity = clamp(a, 0, 1); m.position.set(x, y, z); m.scale.set(size, 1, size); m.visible = true;
  }

  let clock = 0, lastAnimSig = '', lastAnim = null, dtNow = 0; const impacts = [];
  const yawJit = (s) => (hash(s, 41) - 0.5) * 0.09;          // pieces never sit perfectly square
  const posJit = (s, k) => (hash(s, k) - 0.5) * 0.28;
  function drawPieces(F, calm) {
    const yaw0 = F.flip ? Math.PI : 0, b = F.board, a = F.anim, t = F.t;
    // a move just ended: dust where it was put down
    const sig = a ? `${a.type}|${a.from}|${a.to}` : '';
    if (sig !== lastAnimSig) { if (lastAnim && lastAnim.type === 'move' && !calm) { const q = sqPos(lastAnim.to); puff(q.x, q.z, 1); impacts.push({ x: q.x, z: q.z, t: 0, k: Math.abs(lastAnim.p) === 1 ? 1.3 : 1 }); } lastAnimSig = sig; lastAnim = a; }
    // the tak: a faint ring of light runs out through the wood where the piece was put down
    for (let i = impacts.length - 1; i >= 0; i--) { const im = impacts[i]; im.t += dtNow; const f = im.t / 0.38; if (f >= 1) { impacts.splice(i, 1); continue; } mark(im.x, im.z, 'ring', '255,236,190', C * (0.9 + f * 1.3) * im.k, 0.55 * (1 - f) * (1 - f), TOP + 0.04, true); }
    const dragSq = F.drag && F.drag.moved ? F.drag.sq : -1;
    for (let s = 0; s < 90; s++) {
      const p = b[s]; if (!p) continue;
      if (a && a.type === 'move' && s === a.to) continue;
      if (a && a.type === 'refuse' && s === a.from) continue;
      if (s === dragSq) continue;
      const q = sqPos(s); let y = TOP, tx = 0;
      if (F.land && F.land.sq === s && !calm) { const L = landPose(F.land.t); y += L.y; tx = L.tilt; }
      if (s === F.sel) { y += 1.1 + (calm ? 0 : Math.sin(t * 5) * 0.18); tx += F.flip ? -0.1 : 0.1; }
      put(p, q.x + posJit(s, 3), y, q.z + posJit(s, 5), yaw0 + yawJit(s), { tx, alpha: F.ghost && F.ghost.has(s) ? 0.35 : undefined });
    }
    if (a && a.type === 'move') {
      const f = clamp(a.t / a.dur, 0, 1), P = movePose(f, calm), A = sqPos(a.from), Bq = sqPos(a.to), dx = Bq.x - A.x, dz = Bq.z - A.z, L = Math.hypot(dx, dz) || 1;
      if (a.cap) {   // the taken piece is lifted off as the attacker arrives and carried to the side
        const g = clamp((f - 0.62) / 0.38, 0, 1), e = ease(g), side = a.cap > 0 ? -1 : 1;
        if (g < 1) put(a.cap, Bq.x + e * side * 6, TOP + Math.sin(Math.PI * g) * 3 + e * 1.5, Bq.z + e * side * 3, yaw0 + yawJit(a.to) + e * 0.6, { tx: e * 0.4, alpha: 1 - e });
      }
      put(a.p, A.x + dx * P.e, TOP + P.lift, A.z + dz * P.e, yaw0 + yawJit(a.from), { tx: (dz / L) * P.lean, tz: -(dx / L) * P.lean });
    } else if (a && a.type === 'refuse') {
      const f = clamp(a.t / a.dur, 0, 1), A = sqPos(a.from), Bq = sqPos(a.to);
      const out = f < 0.4 ? f / 0.4 : f < 0.6 ? 1 : 1 - (f - 0.6) / 0.4, e = ease(out) * 0.55;
      const shake = calm ? 0 : f >= 0.38 && f < 0.64 ? Math.sin(f * 110) * 0.35 : 0;
      put(a.p, A.x + (Bq.x - A.x) * e + shake, TOP + 1.2 * Math.sin(Math.PI * Math.min(1, f * 1.1)), A.z + (Bq.z - A.z) * e, yaw0);
      if (f > 0.34 && f < 0.7) mark(Bq.x, Bq.z, 'cross', '255,70,50', C * 0.7, 0.9 * (1 - Math.abs(f - 0.5) * 4), TOP + 0.06, false);
    }
    if (dragSq >= 0) { const w = canonToWorld(F.drag.x, F.drag.y - 46); put(b[dragSq], w.x, TOP + 2.6, w.z, yaw0, { tx: F.flip ? -0.12 : 0.12 }); }
    // captured pieces stand in neat rows on the floor beside their captor's side of the board
    if (F.caps) {
      const have = new Array(15).fill(0); for (let s = 0; s < 90; s++) if (b[s]) have[b[s] + 7]++;
      for (const side of [1, -1]) {   // side = captor
        let k = 0;
        for (const ty of [5, 6, 4, 3, 2, 7]) for (let n = have[-side * ty + 7]; n < START_COUNT[ty]; n++) {
          if (a && a.type === 'move' && a.cap === -side * ty && n === have[-side * ty + 7]) continue;
          const col = k % 2, row = (k / 2) | 0; k++;
          const x = side * (BX + 6 + col * 5.4), z = side * (BZ - 4 - row * 5.2);
          put(-side * ty, x + posJit(k, 9) * 2, 0, z, (side > 0 ? 0 : Math.PI) + yawJit(k * 3 + side) * 3, { base: 0 });
        }
      }
    }
  }

  // ---------------------------------------------------------------- per frame
  let game = null, lost = false, lastNow = 0, frameAvg = 16, slowFrames = 0, fadeIn = 0;
  function framing(state, L) {
    const calm = state.calm, t = state.t, drift = calm ? 0 : 1;
    const boardPts = (front) => [[-BX, TOP, -BZ], [BX, TOP, -BZ], [-BX, TOP, BZ], [BX, TOP, BZ], [-BX, FEET + 1, front * (BZ + 0.2)], [BX, FEET + 1, front * (BZ + 0.2)]];
    if (BOARD_SCENES.has(state.scene) || (state.scene === 'setup' && L.setup().board)) {
      let rc, flip;
      if (state.scene === 'setup') { const R = L.setup().board.rect; rc = rectCss(R); flip = state.setup.mode === 'vs' && state.setup.human === -1; }
      else { const BL = L.board(state.scene === 'lesson' ? 'lesson' : state.scene === 'autoplay' ? 'auto' : 'play'); rc = rectCss(BL.boardRect); flip = state.scene === 'play' && state.human === -1 && !state.two; }
      flipNow = flip;
      const tilt = L.wide ? 57 : 63, yaw = flip ? 180 : 0, front = flip ? -1 : 1;
      return fit(rc, boardPts(front), { yaw, tilt, fov: 28, tx: 0, ty: TOP, tz: 0 });
    }
    flipNow = false;
    if (state.scene === 'title' && v3.hero) {
      const base = { yaw: -22 + 7 * Math.sin(t * TAU / 34) * drift, tilt: (L.wide ? 12 : 17) + 2 * Math.sin(t * TAU / 23) * drift, fov: 34, tx: 0, ty: TOP * 0.7, tz: 0 };
      const pts = [[-BX, TOP, -BZ], [BX, TOP, -BZ], [-BX, 0, BZ], [BX, 0, BZ], [BX + 8, 0, BZ - 6]];
      return fit(rectCss(v3.hero), pts, base);
    }
    // reading / settings screens: the room, quietly, with the board off-centre
    const base = { yaw: -32 + 5 * Math.sin(t * TAU / 40) * drift, tilt: 20 + 2 * Math.sin(t * TAU / 29) * drift, fov: 36, tx: 0, ty: TOP * 0.6, tz: 0 };
    const rc = { x: cssW() * 0.15, y: cssH() * 0.35, w: cssW() * 0.7, h: cssH() * 0.45 };
    return fit(rc, [[-BX, TOP, -BZ], [BX, TOP, -BZ], [-BX, 0, BZ], [BX, 0, BZ]], base);
  }
  let wasBoard = null;
  function pre() {
    if (!game || lost) return;
    const state = game.getState(), L = layoutFor(meta.width, meta.height);
    const board = BOARD_SCENES.has(state.scene) || state.scene === 'setup';
    const vk = `${cssW()}x${cssH()}|${L.key}|${state.scene}|${state.human}|${state.two}`; if (vk !== viewKey) { viewKey = vk; snap = true; }
    if (wasBoard !== board) { wasBoard = board; snap = true; }
    const goal = framing(state, L);
    const now = performance.now(), dt = clamp((now - (lastNow || now)) / 1000, 0, 0.1);
    const k = snap || board ? 1 : 1 - Math.exp(-dt * 4);      // board screens are exact from their first frame (taps, labels)
    for (const key of Object.keys(goal)) cur[key] += (goal[key] - cur[key]) * k;
    snap = false;
    place(camera, cur);
    v3.marks.length = 0; v3.frame = null;
  }
  function post() {
    if (!game || lost) return;
    const now = performance.now(), dt = clamp((now - (lastNow || now)) / 1000, 0, 0.1); lastNow = now; clock += dt; dtNow = dt;
    const F = v3.frame || { board: null, set: 'boxwood', lang: 'ko', theme: 'hanji', calm: false, t: clock };
    v3.frame = F;
    const calm = F.calm;
    setBoard(F.theme || 'hanji', F.lang || 'ko');
    nP = 0; nB = 0; nM = 0;
    if (F.board) drawPieces(F, calm);
    for (const mk of v3.marks) {
      if (mk.sq === undefined || mk.sq < 0 || mk.sq > 89) continue;
      const q = sqPos(mk.sq); mark(q.x, q.z, mk.kind, mk.rgb, C * mk.s, mk.a, TOP + (mk.y ?? 0.05), mk.add !== false);
    }
    for (let i = nP; i < POOL; i++) pieces[i].visible = false;
    for (let i = nB; i < POOL; i++) blobs[i].visible = false;
    for (let i = nM; i < marksPool.length; i++) marksPool[i].visible = false;
    for (const m of dust) {
      const u = m.userData; if (!(u.t <= 0.55)) { m.visible = false; continue; }
      u.t += dt; const f = Math.min(1, u.t / 0.55), s = (2.2 + f * 5.5) * u.s;
      m.visible = true; m.position.set(u.x, u.y + 0.1 + f * 0.6, u.z); m.scale.set(s, 1, s); m.material.opacity = 0.5 * (1 - f) * (1 - f);
    }
    // motes drift slowly through the light shaft
    motes.visible = !calm;
    if (!calm) {
      for (let i = 0; i < moteN; i++) {
        const [a, b, c] = moteSeed[i], ph = clock * (0.02 + a * 0.03) + c * 10;
        moteP[i * 3] = -70 + a * 110 + Math.sin(ph * 2.1) * 4; moteP[i * 3 + 1] = 8 + ((b * 90 + clock * (0.6 + c)) % 90); moteP[i * 3 + 2] = -90 + c * 120 + Math.cos(ph * 1.7) * 4;
      }
      moteGeo.attributes.position.needsUpdate = true;
      room.lattice.material.opacity = 0.3 + 0.03 * Math.sin(clock * 0.4);    // a cloud passing outside, barely
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
  setBoard('hanji', 'ko'); await tick();
  for (const t of [1, 2, 3, 4, 5, 6, 7]) { pieceFaceMat(t); pieceFaceMat(-t); pieceGeo(t); }
  await tick();
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
