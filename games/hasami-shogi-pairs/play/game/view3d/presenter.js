// Hasami Shogi 3D presenter. READS the game state (game.getState()), never writes it. One WebGL canvas sits behind the kit's transparent
// 2D canvas: a kaya shogi-ban on a tatami floor under a warm paper lamp, wedge koma at real size, two komadai holding the captured
// pieces. The camera is fitted to the layout's board rectangle (play) or hero rectangle (menus), so the 2D HUD, marks and taps line up
// with the tilted board through v3.pt / v3.pick. When the human plays White the camera walks round to White's side of the board.
// No WebGL, ?flat=1 or a lost context: v3.on = false and every screen draws the flat 2D art; a restored context returns to 3D.
import * as THREE from '../vendor3d/three.js';
import { v3 } from '../src/v3.js';
import { meta } from '../src/game.js';
import { layoutFor } from '../src/layout.js';
import { LESSONS } from '../src/content.js';
import { SX, SZ, BW, BD, TOP, LEG, KH0, STAND, sqPos, radialTex, makeMaterials, buildBoard, buildFloor, buildStand, komaGeometry, komaMaterials } from './world.js';

const TAU = Math.PI * 2, D2R = Math.PI / 180;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = (f) => f * f * (3 - 2 * f);
const hash = (a, b = 0) => { let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
const TIERS = [{ name: 'high', dpr: 2, shadow: 2048, top: 2048 }, { name: 'medium', dpr: 1.5, shadow: 1024, top: 2048 }, { name: 'low', dpr: 1, shadow: 0, top: 1024 }];
const tick = () => new Promise((r) => setTimeout(r, 0));          // yield: the flat title stays interactive while the scene builds in slices
const BG = 0x120c08;

// The title showcase (same story as the flat hero): Black closes a sandwich on three White pieces, they leave, the board resets.
const SHOW_FIXED = [[0, 0, 2], [0, 1, 2], [0, 3, 2], [0, 7, 2], [0, 8, 2], [8, 0, 1], [8, 2, 1], [8, 5, 1], [8, 7, 1], [8, 8, 1], [4, 2, 1], [1, 6, 2], [6, 1, 1]];
const SHOW_CAPS = [[4, 3], [4, 4], [4, 5]];
const SHOW_FROM = 6 * 9 + 6, SHOW_TO = 4 * 9 + 6;

export async function createPresenter({ kitCanvas }) {
  const qs = new URLSearchParams(location.search);
  const noop = { ok: false };
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;height:100dvh;display:block;pointer-events:none;z-index:0;visibility:hidden';
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' }); } catch (e) { console.warn('WebGL unavailable; flat 2D art', e); return noop; }
  kitCanvas.parentElement.insertBefore(canvas, kitCanvas);
  kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  renderer.setClearColor(BG, 1);
  renderer.shadowMap.type = THREE.PCFShadowMap;
  let tier = qs.has('tier') ? clamp(Number(qs.get('tier')), 0, 2) : (navigator.hardwareConcurrency || 8) <= 4 ? 1 : 0;
  try { await document.fonts.load('700 40px "Cormorant Garamond"'); } catch { /* fallback serif */ }

  await tick();
  // ---------------------------------------------------------------- scene, lamp, environment
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(BG);
  scene.fog = new THREE.Fog(BG, 120, 330);
  const camera = new THREE.PerspectiveCamera(28, 1, 4, 1200);
  const lamp = new THREE.SpotLight(0xffd6a6, 4.2, 0, 0.36, 0.75, 0);       // a paper andon lamp, high and to the left front
  lamp.position.set(-34, 92, 46); lamp.target.position.set(0, TOP, 0);
  lamp.shadow.bias = -0.0003; lamp.shadow.normalBias = 0.02; lamp.shadow.radius = 4;
  Object.assign(lamp.shadow.camera, { near: 50, far: 220 });
  const hemi = new THREE.HemisphereLight(0xf2e2c4, 0x2a1c10, 0.22);
  const rim = new THREE.DirectionalLight(0xa9c2ff, 0.85); rim.position.set(40, 40, -90);
  const fill = new THREE.DirectionalLight(0xffb27a, 0.3); fill.position.set(70, 30, 60);
  scene.add(lamp, lamp.target, hemi, rim, fill);
  const buildEnv = () => { try { const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.05).texture; pm.dispose(); scene.environmentIntensity = 0.2; } catch { /* no IBL */ } };
  buildEnv();

  await tick();
  // ---------------------------------------------------------------- world
  let wood = '', mats = null, board = null;
  const boards = new Map();
  const floorG = new THREE.Group(), standB = new THREE.Group(), standW = new THREE.Group();
  scene.add(floorG, standB, standW);
  function setWood(w) {
    if (w === wood) return; wood = w;
    mats = makeMaterials(w);
    floorG.clear(); floorG.add(buildFloor(mats));
    standB.clear(); standB.add(buildStand(mats)); standW.clear(); standW.add(buildStand(mats));
    if (board) scene.remove(board);
    const k = `${w}|${TIERS[tier].top}`; board = boards.get(k); if (!board) { board = buildBoard(w, mats, TIERS[tier].top); boards.set(k, board); }
    scene.add(board);
  }
  standB.position.set(BW / 2 + 11, 0, BD / 2 - 9); standB.rotation.y = 0.12;
  standW.position.set(-(BW / 2 + 11), 0, -(BD / 2 - 9)); standW.rotation.y = 0.12;

  const kGeo = komaGeometry();
  const kMats = new Map();
  const komaMat = (side, style, faces, rot, flash = false) => {
    const k = `${side}|${style}|${faces}|${rot ? 1 : 0}|${flash ? 1 : 0}`; let m = kMats.get(k);
    if (!m) { m = komaMaterials(side, style, faces, rot); if (flash) m = m.map((x) => { x.emissive = new THREE.Color(0xffe2a0); x.emissiveIntensity = 0; return x; }); kMats.set(k, m); }
    return m;
  };
  const flatQuad = new THREE.PlaneGeometry(1, 1); flatQuad.rotateX(-Math.PI / 2);
  const blobTex = radialTex('0,0,0', 0.9), glowTex = radialTex('255,214,120', 0.95), ringTex = radialTex('255,255,255', 0.95, 0.72), redRing = radialTex('236,70,40', 1, 0.7), dotTex = radialTex('255,246,214', 1);
  // a soft-edged square for square tints
  const sqTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.filter = 'blur(3px)'; x.fillRect(6, 6, 52, 52); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();

  // pools
  const pieces = [], blobs = [];
  function pieceAt(n) {
    while (pieces.length <= n) {
      const m = new THREE.Mesh(kGeo, komaMat(1, 'classic', 'en', false)); m.castShadow = true; m.receiveShadow = true; m.visible = false; scene.add(m); pieces.push(m);
      const b = new THREE.Mesh(flatQuad, new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, opacity: 0.5 })); b.renderOrder = 1; b.visible = false; scene.add(b); blobs.push(b);
    }
    return pieces[n];
  }
  const decals = [];
  function decalAt(n) {
    while (decals.length <= n) { const d = new THREE.Mesh(flatQuad, new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, opacity: 0.5 })); d.renderOrder = 2; d.visible = false; scene.add(d); decals.push(d); }
    return decals[n];
  }
  const chips = Array.from({ length: 14 }, (_, i) => { const m = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.12, 0.2), new THREE.MeshStandardMaterial({ color: i % 2 ? 0xe9c27c : 0x8a5a2c, roughness: 0.6 })); m.visible = false; m.castShadow = true; scene.add(m); return m; });
  let np = 0, nd = 0, nc = 0;

  function applyTier() {
    const t = TIERS[tier];
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, t.dpr));
    renderer.shadowMap.enabled = t.shadow > 0; lamp.castShadow = t.shadow > 0;
    if (t.shadow) { lamp.shadow.mapSize.set(t.shadow, t.shadow); if (lamp.shadow.map) { lamp.shadow.map.dispose(); lamp.shadow.map = null; } }
    scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => { m.needsUpdate = true; }); });
  }
  applyTier();

  await tick();
  // ---------------------------------------------------------------- camera fitting (yaw/tilt/fov fixed per screen, distance + off-axis shift fitted to a rectangle)
  const cur = { yaw: 0, tilt: 58, fov: 28, dist: 90, ox: 0, oy: 0, tx: 0, ty: TOP, tz: 0 };
  let snapNext = true, viewKey = '';
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
    const p = { ...base, ox: 0, oy: 0, dist: 100 }, q = { x: 0, y: 0 };
    let bb = null;
    for (let it = 0; it < 6; it++) {
      place(fitCam, p);
      bb = { x0: 1e9, y0: 1e9, x1: -1e9, y1: -1e9 };
      for (const [x, y, z] of pts) { toCss(fitCam, x, y, z, q); bb.x0 = Math.min(bb.x0, q.x); bb.x1 = Math.max(bb.x1, q.x); bb.y0 = Math.min(bb.y0, q.y); bb.y1 = Math.max(bb.y1, q.y); }
      const s = Math.min(rc.w / Math.max(1, bb.x1 - bb.x0), rc.h / Math.max(1, bb.y1 - bb.y0));
      if (Math.abs(s - 1) < 0.002) break;
      p.dist /= s;
    }
    p.ox = (bb.x0 + bb.x1) / 2 - (rc.x + rc.w / 2); p.oy = (bb.y0 + bb.y1) / 2 - (rc.y + rc.h / 2);
    return p;
  }
  const cpu = () => meta.cssPerUnit || (Math.min(cssW(), cssH()) / 720);
  const offX = () => (cssW() - meta.width * cpu()) / 2, offY = () => (cssH() - meta.height * cpu()) / 2;
  const rectCss = (r) => ({ x: r.x * cpu() + offX(), y: r.y * cpu() + offY(), w: r.w * cpu(), h: r.h * cpu() });
  const virt = (q) => ({ x: (q.x - offX()) / cpu(), y: (q.y - offY()) / cpu() });

  // ---------------------------------------------------------------- v3 hooks for the 2D layer
  let cell2d = 60;
  const pa = { x: 0, y: 0 }, pb = { x: 0, y: 0 };
  v3.pt = (i, lift = 0) => {
    const c = sqPos(i), y = TOP + lift, p = virt(toCss(camera, c.x, y, c.z));
    toCss(camera, c.x - SX / 2, y, c.z, pa); toCss(camera, c.x + SX / 2, y, c.z, pb);
    p.k = Math.hypot(pb.x - pa.x, pb.y - pa.y) / cpu() / cell2d; return p;
  };
  const ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -TOP), hit = new THREE.Vector3(), ndc = new THREE.Vector2();
  const ground = (vx, vy) => {
    ndc.set(((vx * cpu() + offX()) / cssW()) * 2 - 1, 1 - ((vy * cpu() + offY()) / cssH()) * 2);
    ray.setFromCamera(ndc, camera);
    return ray.ray.intersectPlane(plane, hit) ? { x: hit.x, z: hit.z } : null;
  };
  v3.ground = ground;
  v3.pick = (vx, vy) => {
    const h = ground(vx, vy); if (!h) return -1;
    const c = Math.floor(h.x / SX + 4.5), r = Math.floor(h.z / SZ + 4.5);
    return c < 0 || c > 8 || r < 0 || r > 8 ? -1 : r * 9 + c;
  };

  // ---------------------------------------------------------------- pieces
  // put one koma: side, square centre (x, z), lift (cm), yaw jitter, lean (radians, toward travel), scale, flash 0..1
  function koma(side, set, x, z, o = {}) {
    const m = pieceAt(np), b = blobs[np]; np++;
    const rot = set.faces !== 'jp' && ((side === 2) !== set.flip);
    const flash = (o.flash || 0) > 0;
    m.material = komaMat(side, set.style, set.faces, rot, flash);
    if (flash) for (const mm of m.material) mm.emissiveIntensity = o.flash * 0.9;
    const s = o.scale ?? 1, lift = o.lift ?? 0, y0 = o.y ?? TOP;
    m.position.set(x, y0 + lift, z); m.scale.set(s, s * (o.squash ?? 1), s);
    m.rotation.set(o.leanX ?? 0, (side === 2 ? Math.PI : 0) + (o.yaw ?? 0), o.leanZ ?? 0, 'YXZ');
    m.visible = s > 0.01;
    const bs = (2.9 + lift * 0.5) * s; b.position.set(x + 0.25 + lift * 0.25, y0 + 0.012, z + 0.3 + lift * 0.3); b.scale.set(bs, 1, bs * 1.1);
    b.material.opacity = (TIERS[tier].shadow ? 0.42 : 0.62) * clamp(1 - lift / 6, 0.15, 1) * Math.min(1, s * 1.3); b.visible = m.visible;
    return m;
  }
  const jitter = (i, salt = 0) => ({ jx: (hash(i, 31 + salt) - 0.5) * 0.22, jz: (hash(i, 37 + salt) - 0.5) * 0.2, yaw: (hash(i, 41 + salt) - 0.5) * 0.07 });
  function boardPiece(side, set, i, o = {}) { const c = sqPos(i), j = jitter(i, side); return koma(side, set, c.x + j.jx, c.z + j.jz, { yaw: j.yaw, ...o }); }
  // captured pieces lying on a komadai, scattered the way a player drops them
  function standPieces(stand, side, count, set) {
    const topY = STAND.h + 0.15, cs = Math.cos(stand.rotation.y), sn = Math.sin(stand.rotation.y);
    for (let k = 0; k < Math.min(count, 18); k++) {
      const col = k % 4, row = Math.floor(k / 4) % 4, layer = Math.floor(k / 16);
      const lx = (col - 1.5) * 3.2 + (hash(k, 3) - 0.5) * 0.8, lz = (row - 1.5) * 3.4 + (hash(k, 4) - 0.5) * 0.8;
      koma(side, set, stand.position.x + lx * cs + lz * sn, stand.position.z - lx * sn + lz * cs, { y: topY + layer * KH0, yaw: (stand === standB ? Math.PI : 0) + stand.rotation.y + (hash(k, 5) - 0.5) * 0.5 });
    }
  }
  function decal(x, z, w, d, tex, color, opacity, additive = false, y = TOP + 0.012) {
    const m = decalAt(nd++); m.visible = true;
    if (m.material.map !== tex) { m.material.map = tex; m.material.needsUpdate = true; }
    const bl = additive ? THREE.AdditiveBlending : THREE.NormalBlending; if (m.material.blending !== bl) { m.material.blending = bl; m.material.needsUpdate = true; }
    m.material.color.set(color); m.material.opacity = opacity; m.position.set(x, y, z); m.scale.set(w, 1, d);
  }
  const sqDecal = (i, color, op, additive = false) => { const c = sqPos(i); decal(c.x, c.z, SX * 1.06, SZ * 1.06, sqTex, color, op, additive); };
  function chipsAt(x, z, f, seed) {
    for (let j = 0; j < 5 && nc < chips.length; j++) {
      const ch = chips[nc++], ang = seed * 1.7 + j * 1.25, sp = 2.2 + 1.6 * ((j * 5 + seed) % 3) / 2;
      ch.visible = f < 1; ch.position.set(x + Math.cos(ang) * sp * f, TOP + 0.2 + Math.sin(Math.PI * Math.min(1, f * 1.2)) * 3.2, z + Math.sin(ang) * sp * f);
      ch.rotation.set(f * 9 + j, f * 7, j); const s = Math.max(0.01, 1 - f); ch.scale.set(s, s, s);
    }
  }
  // a captured piece: a warm flash and a swell, then it hops up, turns over and shrinks away with wood chips flying off
  function capturedPiece(side, set, i, f, k, calm) {
    const c = sqPos(i);
    if (f < 0.22) { const e = f / 0.22; boardPiece(side, set, i, { flash: e, scale: 1 + 0.08 * e, lift: 0.15 * e }); return; }
    const g = (f - 0.22) / 0.78, e = ease(g), dir = k % 2 ? 1 : -1;
    boardPiece(side, set, i, { flash: 1 - g, lift: Math.sin(Math.PI * Math.min(1, g * 1.4)) * 3.6 + g * 1.5, scale: Math.max(0, 1.08 - 1.1 * e), leanZ: calm ? 0 : dir * e * 2.2, leanX: calm ? 0 : -e * 0.6 });
    if (!calm) chipsAt(c.x, c.z, g, k + i);
  }

  // ---------------------------------------------------------------- per-frame
  let game = null, lost = false, lastNow = 0, frameAvg = 16, slowFrames = 0, fadeIn = 0, shake = 0;
  const shock = { t: 9, x: 0, z: 0 };
  function framing(state, L) {
    const sc = state.scene;
    if ((sc === 'play' || sc === 'over' || sc === 'lesson') && L.board) {
      cell2d = L.board.cell;
      const fz = state.flip ? -1 : 1;
      const pts = [[-BW / 2, TOP, -BD / 2], [BW / 2, TOP, -BD / 2], [-BW / 2, TOP, BD / 2], [BW / 2, TOP, BD / 2], [-BW / 2, LEG + 1.5, fz * BD / 2], [BW / 2, LEG + 1.5, fz * BD / 2]];
      const rb = rectCss(L.board.rect), gw = L.land ? 1 : 1.08; rb.x -= rb.w * (gw - 1) / 2; rb.y -= rb.h * (gw - 1) / 2; rb.w *= gw; rb.h *= gw;   // portrait: the slab's frame may crop at the screen edge so the grid itself fills >= 90% of the width
      return fit(rb, pts, { yaw: state.flip ? 180 : 0, tilt: L.land ? 60 : 72, fov: 28, tx: 0, ty: TOP, tz: 0 });
    }
    const t = state.t, drift = state.calm ? 0 : 1, r = v3.hero ?? { x: L.U.x0 + 30, y: L.U.y0 + 30, w: L.U.w - 60, h: L.U.h * 0.62 };
    // wide hero (landscape): board and both komadai; narrow hero (portrait): the board fills it and the stands crop at the edges
    const rr = rectCss(r), wide = rr.w > rr.h * 1.6, sx = BW / 2 + 11;
    const pts = [[-BW / 2, TOP, -BD / 2], [BW / 2, TOP, -BD / 2], [-BW / 2, 0, BD / 2 + 2], [BW / 2, 0, BD / 2 + 2]];
    if (wide) pts.push([sx, STAND.h, BD / 2 - 9], [-sx, STAND.h, -(BD / 2 - 9)]);
    const rc = rectCss(r), m = Math.min(rc.w, rc.h) * 0.03; rc.x += m; rc.y += m; rc.w -= 2 * m; rc.h -= 2 * m;
    return fit(rc, pts, { yaw: -14 + 6 * Math.sin(t * TAU / 28) * drift, tilt: 40 + 3 * Math.sin(t * TAU / 19) * drift, fov: 30, tx: 0, ty: TOP * 0.6, tz: 0 });
  }
  function pre() {
    if (!game || lost) return;
    const state = game.getState(), L = layoutFor(meta.width, meta.height, state.flip);
    const vk = `${cssW()}x${cssH()}|${L.key}|${state.scene === 'play' || state.scene === 'over' || state.scene === 'lesson' ? 'p' : 't'}`;
    const goal = framing(state, L);
    const now = performance.now(), dt = clamp((now - (lastNow || now)) / 1000, 0, 0.1);
    if (vk !== viewKey) { const resized = viewKey && viewKey.split('|')[0] !== vk.split('|')[0]; viewKey = vk; if (resized) snapNext = true; }
    let a = snapNext ? 1 : 1 - Math.exp(-dt * 6);
    // turning round (Black <-> White) or menu <-> board: the camera travels instead of cutting
    if (!snapNext && Math.abs(goal.yaw - cur.yaw) > 90) a = 1 - Math.exp(-dt * 4);
    for (const k of Object.keys(goal)) cur[k] += (goal[k] - cur[k]) * a;
    snapNext = false;
    const sh = { ...cur }; if (shake > 0) { sh.ox += Math.sin(shake * 90) * shake * 14; sh.oy += Math.cos(shake * 70) * shake * 9; }
    place(camera, sh);
    scene.fog.near = cur.dist * 0.95 + 20; scene.fog.far = cur.dist * 2.1 + 140;     // depth falloff follows the framing distance
  }
  function post() {
    if (!game || lost) return;
    const now = performance.now(), dt = clamp((now - (lastNow || now)) / 1000, 0, 0.1); lastNow = now;
    const state = game.getState(), sc = state.scene, playing = sc === 'play' || sc === 'over' || sc === 'lesson', calm = state.calm;
    const set = { style: state.style, faces: state.faces, flip: playing ? !!state.flip : false };
    setWood(state.wood);
    np = 0; nd = 0; nc = 0;
    const pulse = calm ? 0.6 : 0.5 + 0.5 * Math.sin(state.t * 5);
    if (playing) {
      const g = state.game, a = state.anim, over = sc === 'over', isLesson = sc === 'lesson';
      // square tints lie on the wood, under the pieces
      if (g.last && !a && !isLesson) for (const q of [g.last.from, g.last.to]) sqDecal(q, 0xffcf6a, 0.26);
      if (isLesson && !state.lesson.done && LESSONS[state.lesson.i].target !== undefined) { const c = sqPos(LESSONS[state.lesson.i].target); decal(c.x, c.z, SX * 1.05, SX * 1.05, redRing, 0xffffff, 0.7 + 0.3 * pulse); }
      if (state.sel >= 0 && !a && !over) {
        sqDecal(state.sel, 0xffe07a, 0.35 + pulse * 0.2, true);
        for (const m of state.selMoves) {
          const c = sqPos(m.to);
          if (m.caps) { decal(c.x, c.z, SX * 1.0, SX * 1.0, redRing, 0xffffff, 0.75 + pulse * 0.25); decal(c.x, c.z, SX * 0.8, SX * 0.8, glowTex, 0xff6a3a, 0.35, true); }
          else decal(c.x, c.z, 0.95, 0.95, dotTex, 0xfff2cc, 0.7 + pulse * 0.2);
        }
      }
      if (state.hint && !a) for (const q of [state.hint.from, state.hint.to]) sqDecal(q, 0x5ae696, 0.35 + pulse * 0.2, true);
      if (state.kb && !over) { const c = sqPos(state.cursor); decal(c.x, c.z, SX * 1.1, SX * 1.1, ringTex, 0x7dff9a, 0.9); }
      // pieces
      const dragging = state.drag && state.sel >= 0, movingTo = a ? a.to : -1;
      for (let i = 0; i < 81; i++) {
        const k = g.board[i]; if (!k || i === movingTo || (dragging && i === state.sel)) continue;
        const sel = state.sel === i && !a && !over;
        boardPiece(k, set, i, { lift: sel ? 0.9 + (calm ? 0 : Math.sin(state.t * 3) * 0.12) : 0, leanX: sel ? -0.05 : 0 });
      }
      if (a) {
        for (const [n, q] of a.caps.entries()) { if (a.t < a.glide) boardPiece(3 - a.side, set, q); else capturedPiece(3 - a.side, set, q, (a.t - a.glide) / 0.55, n, calm); }
        const p0 = sqPos(a.from), p1 = sqPos(a.to), f = clamp(a.t / a.glide, 0, 1), e = ease(f), dist = Math.hypot((p1.x - p0.x) / SX, (p1.z - p0.z) / SZ);
        const x = p0.x + (p1.x - p0.x) * e, z = p0.z + (p1.z - p0.z) * e, j = jitter(a.to, a.side);
        let lift, squash = 1, lean = 0;
        if (f < 1) { lift = Math.sin(Math.PI * f) * (a.jump ? 2.6 : 0.7 + Math.min(0.8, dist * 0.09)) + 0.35 * (1 - f); lean = Math.sin(Math.PI * f) * 0.16; }
        else { const s = clamp((a.t - a.glide) / 0.16, 0, 1); lift = Math.sin(s * Math.PI) * 0.18 * (1 - s); squash = 1 - 0.07 * Math.sin(s * Math.PI) * (1 - s); }
        // lean into the direction of travel (the leading edge dips a little: a hand slides the piece)
        const dx = p1.x - p0.x, dz = p1.z - p0.z, dl = Math.hypot(dx, dz) || 1, yawBase = a.side === 2 ? Math.PI : 0;
        const lx = (dz / dl) * lean, lz = -(dx / dl) * lean, cs = Math.cos(-yawBase), sn = Math.sin(-yawBase);
        koma(a.side, set, x + j.jx * e, z + j.jz * e, { lift, squash, yaw: j.yaw * e, leanX: lx * cs - lz * sn, leanZ: lx * sn + lz * cs });
        if (a.t >= a.glide && shock.t > 0.5 && a.t - a.glide < 0.05) { shock.t = 0; shock.x = p1.x; shock.z = p1.z; if (a.caps.length && !calm) shake = 0.35; }
        if (a.caps.length && !calm && a.t > a.glide) { const ff = (a.t - a.glide) / 0.8; if (ff < 1) decal(p1.x, p1.z, SX * (2 + 4 * ff), SX * (2 + 4 * ff), glowTex, 0xffd28a, 0.65 * (1 - ff), true); }
      }
      if (dragging) { const p = ground(state.drag.x, state.drag.y) || sqPos(state.sel); koma(g.board[state.sel] || g.turn, set, p.x, p.z + SZ * 0.15, { lift: 1.8, leanX: -0.08 }); }
      // komadai: each side's stand holds the pieces it has captured (they arrive once the capture has played)
      const flying = a && a.t < a.glide + 0.55 ? a.caps.length : 0;
      standPieces(standB, 2, g.lost[2] - (a && a.side === 1 ? flying : 0), set);
      standPieces(standW, 1, g.lost[1] - (a && a.side === 2 ? flying : 0), set);
    } else {
      // title / pages: the showcase sandwich
      const T = calm ? 1.5 : state.t % 9, glideStart = 1.4, glideEnd = 2.1, resetA = 6.4, resetB = 7.3;
      for (const [r, c, s] of SHOW_FIXED) boardPiece(s, set, r * 9 + c);
      let n = 0;
      for (const [r, c] of SHOW_CAPS) {
        const i = r * 9 + c;
        if (T < glideEnd) boardPiece(2, set, i);
        else if (T < glideEnd + 0.55) capturedPiece(2, set, i, (T - glideEnd) / 0.55, n, calm);
        else if (T > resetB - 0.2) { const u = clamp((T - (resetB - 0.2 + n * 0.12)) / 0.35, 0, 1); boardPiece(2, set, i, { scale: ease(u), lift: (1 - u) * 1.5 }); }
        n++;
      }
      const p0 = sqPos(SHOW_FROM), p1 = sqPos(SHOW_TO);
      let x = p0.x, z = p0.z, lift = 0, glow = 0;
      if (T < glideStart) { lift = clamp((T - 0.9) / 0.5, 0, 1) * 0.9; glow = T > 0.9 ? 1 : 0; }
      else if (T < glideEnd) { const f = (T - glideStart) / (glideEnd - glideStart), e = ease(f); x += (p1.x - p0.x) * e; z += (p1.z - p0.z) * e; lift = 0.9 * (1 - f) + Math.sin(Math.PI * f) * 0.6; }
      else if (T < resetA) { x = p1.x; z = p1.z; const s = clamp((T - glideEnd) / 0.16, 0, 1); lift = Math.sin(s * Math.PI) * 0.18 * (1 - s); }
      else { const f = clamp((T - resetA) / 0.9, 0, 1), e = ease(f); x = p1.x + (p0.x - p1.x) * e; z = p1.z + (p0.z - p1.z) * e; lift = Math.sin(Math.PI * f) * 0.8; }
      if (glow) decal(p0.x, p0.z, SX * 1.6, SX * 1.6, glowTex, 0xffd28a, 0.45 + 0.2 * pulse, true);
      koma(1, set, x, z, { lift });
      if (T >= glideEnd && T < glideEnd + 0.05 && shock.t > 0.5) { shock.t = 0; shock.x = p1.x; shock.z = p1.z; if (!calm) shake = 0.25; }
      if (T > glideEnd && T < glideEnd + 0.8 && !calm) { const ff = (T - glideEnd) / 0.8; decal(p1.x - SX * 1.5, p1.z, SX * (3 + 5 * ff), SX * (2 + 4 * ff), glowTex, 0xffd28a, 0.6 * (1 - ff), true); }
      standPieces(standB, 2, (T > glideEnd + 0.55 && T < resetB) ? 5 : 2, set);
      standPieces(standW, 1, 1, set);
    }
    // landing ring on the wood
    shock.t += dt; shake = Math.max(0, shake - dt);
    if (shock.t < 0.42 && !calm) { const u = shock.t / 0.42, s = SX * (1 + u * 1.6); decal(shock.x, shock.z, s, s, ringTex, 0xfff0c8, 0.5 * (1 - u), true); }
    for (let i = np; i < pieces.length; i++) { pieces[i].visible = false; blobs[i].visible = false; }
    for (let i = nd; i < decals.length; i++) decals[i].visible = false;
    for (let i = nc; i < chips.length; i++) chips[i].visible = false;
    if (fadeIn < 1) { fadeIn = Math.min(1, fadeIn + dt / 0.35); v3.fade = fadeIn; }
    renderer.setSize(cssW(), cssH(), false);
    renderer.render(scene, camera);
    // quality tiers: drop on sustained slow frames (never back up during a session)
    const ft = dt * 1000; if (ft > 0) frameAvg = frameAvg * 0.95 + ft * 0.05;
    if (frameAvg > 26 && tier < 2) { if (++slowFrames > 90) { tier++; slowFrames = 0; frameAvg = 16; applyTier(); const w = wood; wood = ''; setWood(w); } } else slowFrames = 0;
  }

  // ---------------------------------------------------------------- context loss: flat art takes over, then back to 3D
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; v3.on = false; canvas.style.visibility = 'hidden'; });
  canvas.addEventListener('webglcontextrestored', () => {
    lost = false; buildEnv(); boards.clear(); kMats.clear(); const w = wood; wood = ''; board && scene.remove(board); board = null; setWood(w || 'kaya'); applyTier(); fadeIn = 0; v3.fade = 0; v3.on = true; canvas.style.visibility = 'visible'; snapNext = true;
  });

  // warm up: compile shaders and upload the default look before taking over, in small slices
  await tick();
  setWood('kaya'); await tick();
  for (const s of [1, 2]) for (const r of [false, true]) komaMat(s, 'classic', 'en', r);
  pieceAt(40); await tick();
  place(camera, cur); try { renderer.compile(scene, camera); } catch { /* compiled lazily */ }
  await tick();

  return {
    ok: true,
    renderer, scene, camera, lamp,
    attach(g) { game = g; v3.on = true; v3.fade = 0; fadeIn = 0; canvas.style.visibility = 'visible'; snapNext = true; },
    pre, post,
    get tier() { return TIERS[tier].name; },
    loseContext() { const ext = renderer.getContext().getExtension('WEBGL_lose_context'); ext?.loseContext(); return ext; },
  };
}
