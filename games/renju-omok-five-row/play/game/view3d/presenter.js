// Five in a Row 3D presenter. READS the game state (game.getState()), never writes it. One WebGL canvas sits behind the kit's transparent
// 2D canvas: a table-top goban under a warm lamp, real-size slate and shell stones, stone bowls on the title. The camera is fitted to the
// layout's board rectangle (play) or hero rectangle (menus), so the 2D HUD, marks and taps line up with the tilted board through v3.pt /
// v3.pick. No WebGL, ?flat=1 or a lost context: v3.on = false and every screen draws the flat 2D art; a restored context returns to 3D.
import * as THREE from '../vendor3d/three.js';
import { v3 } from '../src/v3.js';
import { meta } from '../src/game.js';
import { layoutFor } from '../src/layout.js';
import { SHOW } from '../src/screens.js';
import { BLACK } from '../src/rules.js';
import { SX, SZ, T, TOP, STONE_R, STONE_H, boardSize, cross, makeMaterials, stoneGeometry, buildBoard, buildBowl, radialTex } from './world.js';

const TAU = Math.PI * 2, D2R = Math.PI / 180, MAXN = 19 * 19;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const hash = (a, b = 0) => { let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
const TIERS = [{ name: 'high', dpr: 2, shadow: 2048, top: 2048 }, { name: 'medium', dpr: 1.5, shadow: 1024, top: 2048 }, { name: 'low', dpr: 1, shadow: 0, top: 1024 }];
const tick = () => new Promise((r) => setTimeout(r, 0));   // yield: the flat title stays interactive while the scene builds in slices
const DROP = 0.46;                                          // seconds: a placed stone slides in, touches down, rocks and settles

// A stone placed by hand: it arrives from the player's side a little tilted, touches the wood at 0.16 s, makes a tiny rebound and rocks flat.
export function dropPose(t) {
  if (t >= DROP) return { y: 0, z: 0, tilt: 0, squash: 1, contact: 1 };
  if (t < 0.16) { const u = t / 0.16, e = u * u; return { y: 2.6 * (1 - e), z: 0.9 * (1 - u) * (1 - u), tilt: 0.24 * (1 - u), squash: 1, contact: 0 }; }
  const s = (t - 0.16) / (DROP - 0.16), damp = (1 - s) * (1 - s);
  return { y: Math.abs(Math.sin(s * Math.PI * 2.2)) * 0.16 * damp, z: 0, tilt: Math.sin(s * Math.PI * 5) * 0.07 * damp, squash: 1 - 0.06 * Math.max(0, 1 - s * 5), contact: s };
}

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
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.02;
  renderer.setClearColor(0x0b1116, 1);
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  let tier = qs.has('tier') ? clamp(Number(qs.get('tier')), 0, 2) : (navigator.hardwareConcurrency || 8) <= 4 ? 1 : 0;

  await tick();
  // ---------------------------------------------------------------- scene, lamp, environment
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b1116);
  scene.fog = new THREE.Fog(0x0b1116, 170, 430);
  const camera = new THREE.PerspectiveCamera(26, 1, 5, 1200);
  const lamp = new THREE.SpotLight(0xffd2a0, 3.6, 0, 0.42, 0.95, 0);
  lamp.position.set(-38, 105, 52); lamp.target.position.set(0, TOP, 0);
  lamp.shadow.bias = -0.0002; lamp.shadow.normalBias = 0.02; lamp.shadow.radius = 4;
  Object.assign(lamp.shadow.camera, { near: 60, far: 260 });
  const hemi = new THREE.HemisphereLight(0xe8d8c0, 0x20160e, 0.32);
  const rim = new THREE.DirectionalLight(0x9fb8ff, 0.9); rim.position.set(40, 45, -90);
  const fill = new THREE.DirectionalLight(0xffb27a, 0.32); fill.position.set(70, 30, 60);
  const glint = new THREE.PointLight(0xffe6b0, 0, 14, 1.6);
  scene.add(lamp, lamp.target, hemi, rim, fill, glint);
  let envTex = null;
  const buildEnv = () => { try { const pm = new THREE.PMREMGenerator(renderer); envTex = pm.fromScene(new THREE.RoomEnvironment(), 0.05).texture; pm.dispose(); scene.environment = envTex; scene.environmentIntensity = 0.24; } catch { /* no IBL */ } };
  buildEnv();

  await tick();
  // ---------------------------------------------------------------- materials, table, stones
  let look = '', mats = null, stoneMats = null;
  const stoneGeo = stoneGeometry();
  const table = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), new THREE.MeshStandardMaterial({ color: 0x1c2a33 }));
  table.rotation.x = -Math.PI / 2; table.receiveShadow = true; scene.add(table);
  const blackI = new THREE.InstancedMesh(stoneGeo, new THREE.MeshStandardMaterial(), MAXN), whiteI = new THREE.InstancedMesh(stoneGeo, new THREE.MeshStandardMaterial(), MAXN);
  for (const m of [blackI, whiteI]) { m.castShadow = true; m.receiveShadow = true; m.count = 0; m.frustumCulled = false; scene.add(m); }
  const flatQuad = new THREE.PlaneGeometry(1, 1); flatQuad.rotateX(-Math.PI / 2);
  const blobTex = radialTex('0,0,0', 0.85), ringTex = radialTex('255,255,255', 0.9, 0.8), haloTex = radialTex('255,214,120', 0.9);
  const blobs = new THREE.InstancedMesh(flatQuad, new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, opacity: 0.55 }), MAXN);
  blobs.renderOrder = 1; blobs.frustumCulled = false; blobs.count = 0; scene.add(blobs);
  const fx = [];                                            // additive halos / shock rings lying on the wood
  const fxMesh = (tex) => { const m = new THREE.Mesh(flatQuad, new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); m.renderOrder = 2; m.visible = false; scene.add(m); fx.push(m); return m; };
  const halos = Array.from({ length: 9 }, () => fxMesh(haloTex));
  const shock = fxMesh(ringTex);
  const ghost = new THREE.Mesh(stoneGeo, new THREE.MeshStandardMaterial({ transparent: true, opacity: 0.5, depthWrite: false })); ghost.visible = false; scene.add(ghost);
  const bowls = new THREE.Group(); scene.add(bowls);

  function setLook(wood, stones) {
    const k = `${wood}|${stones}`; if (k === look) return; look = k;
    mats = makeMaterials(wood, stones);
    table.material = mats.cloth;
    stoneMats = { black: mats.black.clone(), white: mats.white.clone() };
    blackI.material = stoneMats.black; whiteI.material = stoneMats.white;
    ghost.material.dispose(); ghost.material = mats.black.clone(); ghost.material.transparent = true; ghost.material.depthWrite = false;
    while (bowls.children.length) bowls.remove(bowls.children[0]);
    bowls.add(buildBowl(true, mats, stoneGeo, 7), buildBowl(false, mats, stoneGeo, 19));
    boards.clear(); if (boardObj) { scene.remove(boardObj); boardObj = null; boardKey = ''; }
  }
  // boards are cached per size / wood / coordinates (the top texture is the costly part)
  const boards = new Map(); let boardObj = null, boardKey = '';
  function setBoard(n, wood, coords) {
    const k = `${n}|${wood}|${coords ? 1 : 0}|${TIERS[tier].top}`; if (k === boardKey) return;
    let b = boards.get(k); if (!b) { b = buildBoard(n, wood, coords, mats, TIERS[tier].top); boards.set(k, b); if (boards.size > 3) boards.delete(boards.keys().next().value); }
    if (boardObj) scene.remove(boardObj); boardObj = b; boardKey = k; scene.add(b);
    const { w, d } = boardSize(n);
    bowls.children[0].position.set(-w * 0.36, 0, d / 2 + 8.2); bowls.children[1].position.set(w * 0.36, 0, d / 2 + 6.4);
  }
  function applyTier() {
    const t = TIERS[tier];
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, t.dpr));
    renderer.shadowMap.enabled = t.shadow > 0; lamp.castShadow = t.shadow > 0;
    if (t.shadow) { lamp.shadow.mapSize.set(t.shadow, t.shadow); if (lamp.shadow.map) { lamp.shadow.map.dispose(); lamp.shadow.map = null; } }
    blobs.material.opacity = t.shadow ? 0.42 : 0.62;
    scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => { m.needsUpdate = true; }); });
  }
  applyTier();

  await tick();
  // ---------------------------------------------------------------- camera fitting (yaw/tilt/fov fixed per screen, distance + off-axis shift fitted to a rectangle)
  const cur = { yaw: 0, tilt: 63, fov: 26, dist: 90, ox: 0, oy: 0, tx: 0, ty: TOP, tz: 0 };
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
  function fit(rectCss, pts, base) {
    const p = { ...base, ox: 0, oy: 0, dist: 100 }, q = { x: 0, y: 0 };
    let bb = null;
    for (let it = 0; it < 5; it++) {
      place(fitCam, p);
      bb = { x0: 1e9, y0: 1e9, x1: -1e9, y1: -1e9 };
      for (const [x, y, z] of pts) { toCss(fitCam, x, y, z, q); bb.x0 = Math.min(bb.x0, q.x); bb.x1 = Math.max(bb.x1, q.x); bb.y0 = Math.min(bb.y0, q.y); bb.y1 = Math.max(bb.y1, q.y); }
      const s = Math.min(rectCss.w / Math.max(1, bb.x1 - bb.x0), rectCss.h / Math.max(1, bb.y1 - bb.y0));
      if (Math.abs(s - 1) < 0.002) break;
      p.dist /= s;
    }
    p.ox = (bb.x0 + bb.x1) / 2 - (rectCss.x + rectCss.w / 2); p.oy = (bb.y0 + bb.y1) / 2 - (rectCss.y + rectCss.h / 2);
    return p;
  }
  // virtual units (kit fluid viewport) <-> CSS pixels
  const cpu = () => meta.cssPerUnit || (Math.min(cssW(), cssH()) / 720);
  const offX = () => (cssW() - meta.width * cpu()) / 2, offY = () => (cssH() - meta.height * cpu()) / 2;
  const rectCss = (r) => ({ x: r.x * cpu() + offX(), y: r.y * cpu() + offY(), w: r.w * cpu(), h: r.h * cpu() });

  // ---------------------------------------------------------------- v3 hooks for the 2D layer
  let shownN = 15;
  const pa = { x: 0, y: 0 }, pb = { x: 0, y: 0 };
  const virt = (q) => ({ x: (q.x - offX()) / cpu(), y: (q.y - offY()) / cpu() });
  function cellAtCentre() { toCss(camera, -SX / 2, TOP, 0, pa); toCss(camera, SX / 2, TOP, 0, pb); return Math.hypot(pb.x - pa.x, pb.y - pa.y) / cpu(); }
  v3.pt = (n, idx, lift = 0) => {
    const c = cross(n, idx), y = TOP + lift * STONE_H;
    const p = virt(toCss(camera, c.x, y, c.z, { x: 0, y: 0 }));
    toCss(camera, c.x - SX / 2, y, c.z, pa); toCss(camera, c.x + SX / 2, y, c.z, pb); const cx = Math.hypot(pb.x - pa.x, pb.y - pa.y) / cpu();
    toCss(camera, c.x, y, c.z - SX / 2, pa); toCss(camera, c.x, y, c.z + SX / 2, pb); const cz = Math.hypot(pb.x - pa.x, pb.y - pa.y) / cpu();
    p.k = cx / (v3.cell || cx); p.fy = cz / Math.max(1e-6, cx); return p;
  };
  const ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -TOP), hit = new THREE.Vector3(), ndc = new THREE.Vector2();
  v3.pick = (n, vx, vy, slack = 0.5) => {
    ndc.set(((vx * cpu() + offX()) / cssW()) * 2 - 1, 1 - ((vy * cpu() + offY()) / cssH()) * 2);
    ray.setFromCamera(ndc, camera);
    if (!ray.ray.intersectPlane(plane, hit)) return -1;
    const ex = hit.x / SX + (n - 1) / 2, ey = hit.z / SZ + (n - 1) / 2, gx = Math.round(ex), gy = Math.round(ey);
    if (gx < 0 || gy < 0 || gx >= n || gy >= n) { if (ex < -slack || ey < -slack || ex > n - 1 + slack || ey > n - 1 + slack) return -1; return clamp(gy, 0, n - 1) * n + clamp(gx, 0, n - 1); }
    return gy * n + gx;
  };

  // ---------------------------------------------------------------- stones on the board
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
  let clock = 0, cellsSig = '', gameSig = '', prevCount = 0;
  const placed = new Map();                 // idx -> presenter clock when it appeared (drop animation)
  let lastContact = -1, shockT = 9, shockAt = null;
  function stoneMatrix(n, idx, pose, out) {
    const c = cross(n, idx), jx = (hash(idx, 31) - 0.5) * 0.14, jz = (hash(idx, 37) - 0.5) * 0.14;      // hand-placed: never perfectly centred
    _p.set(c.x + jx, TOP + pose.y, c.z + jz + pose.z);
    _e.set(-pose.tilt, hash(idx, 41) * TAU, 0); _q.setFromEuler(_e); _s.set(1, pose.squash, 1);
    return out.compose(_p, _q, _s);
  }
  function writeStones(n, cells, ageOf, alpha = 1) {
    let nb = 0, nw = 0, nbl = 0, anim = false;
    for (let i = 0; i < n * n; i++) {
      const c = cells[i]; if (!c) continue;
      const age = ageOf(i), pose = dropPose(age); if (age < DROP) anim = true;
      if (age >= 0.16 && age < 0.2 && lastContact !== i) { lastContact = i; shockT = 0; shockAt = cross(n, i); }
      stoneMatrix(n, i, pose, _m);
      if (c === BLACK) blackI.setMatrixAt(nb++, _m); else whiteI.setMatrixAt(nw++, _m);
      const cc = cross(n, i), sz = STONE_R * (2.5 + pose.y * 0.35);
      _p.set(cc.x + 0.18, TOP + 0.01, cc.z + 0.22); _q.identity(); _s.set(sz, 1, sz); _m.compose(_p, _q, _s); blobs.setMatrixAt(nbl++, _m);
    }
    blackI.count = nb; whiteI.count = nw; blobs.count = nbl;
    blackI.instanceMatrix.needsUpdate = true; whiteI.instanceMatrix.needsUpdate = true; blobs.instanceMatrix.needsUpdate = true;
    for (const m of [stoneMats.black, stoneMats.white]) { const tr = alpha < 1; if (m.transparent !== tr) { m.transparent = tr; m.needsUpdate = true; } m.opacity = alpha; }
    blobs.material.opacity = (TIERS[tier].shadow ? 0.42 : 0.62) * alpha;
    return anim;
  }
  function halosOn(n, line, k, t) {
    halos.forEach((h, j) => {
      const i = line[j]; h.visible = i !== undefined && k > 0; if (!h.visible) return;
      const c = cross(n, i), s = STONE_R * 4.2 * (0.9 + 0.1 * Math.sin(t * 5 + j * 0.6));
      h.position.set(c.x, TOP + 0.02, c.z); h.scale.set(s, 1, s); h.material.opacity = 0.55 * k;
    });
  }

  // ---------------------------------------------------------------- per-frame
  let game = null, lost = false, lastNow = 0, frameAvg = 16, slowFrames = 0, fadeIn = 0;
  function framing(state, L) {
    const sc = state.scene, n = shownN, { w, d } = boardSize(n), calm = state.set.calm;
    if ((sc === 'play' || sc === 'over') && L.play) {
      const pts = [[-w / 2, TOP, -d / 2], [w / 2, TOP, -d / 2], [-w / 2, TOP, d / 2], [w / 2, TOP, d / 2], [-w / 2, TOP - T * 0.5, d / 2], [w / 2, TOP - T * 0.5, d / 2]];
      return fit(rectCss(L.play.board), pts, { yaw: 0, tilt: L.play.mode === 'wide' || L.play.mode === 'side' ? 62 : 64, fov: 26, tx: 0, ty: TOP, tz: 0 });
    }
    const t = state.t, drift = calm ? 0 : 1, r = v3.hero ?? { x: L.U.x0 + 30, y: L.U.y0 + 30, w: L.U.w - 60, h: L.U.h * 0.62 };
    const pts = [[-w / 2, TOP, -d / 2], [w / 2, TOP, -d / 2], [-w / 2, 0, d / 2], [w / 2, 0, d / 2], [-w * 0.36 - 6.6, 0, d / 2 + 8.2], [-w * 0.36, 0, d / 2 + 14.8], [w * 0.36 + 6.6, 0, d / 2 + 6.4], [w * 0.36, 0, d / 2 + 13]];
    const rc = rectCss(r), m = Math.min(rc.w, rc.h) * 0.05; rc.x += m; rc.y += m; rc.w -= 2 * m; rc.h -= 2 * m;
    return fit(rc, pts, { yaw: -10 + 5 * Math.sin(t * TAU / 26) * drift, tilt: 48 + 2 * Math.sin(t * TAU / 17) * drift, fov: 30, tx: 0, ty: TOP * 0.5, tz: 4 });
  }
  function pre() {
    if (!game || lost) return;
    const state = game.getState(), L = layoutFor(meta.width, meta.height);
    const vk = `${cssW()}x${cssH()}|${L.key}`; if (vk !== viewKey) { viewKey = vk; snapNext = true; }
    shownN = state.scene === 'play' || state.scene === 'over' ? state.game.n : 15;
    // v3.hero is set while the 2D layer draws; use last frame's value for framing (it only changes with the layout)
    const goal = framing(state, L);
    const now = performance.now(), dt = clamp((now - (lastNow || now)) / 1000, 0, 0.1);
    const a = snapNext ? 1 : 1 - Math.exp(-dt * 7);
    for (const k of Object.keys(goal)) cur[k] += (goal[k] - cur[k]) * a;
    snapNext = false;
    place(camera, cur);
    v3.cell = cellAtCentre();
    moving = Math.abs(goal.dist - cur.dist) > 0.01 || Math.abs(goal.ox - cur.ox) > 0.3 || Math.abs(goal.oy - cur.oy) > 0.3 || Math.abs(goal.yaw - cur.yaw) > 0.01 || Math.abs(goal.tilt - cur.tilt) > 0.01;
  }
  let moving = false, heroWas = null;
  function post() {
    if (!game || lost) return;
    const now = performance.now(), dt = clamp((now - (lastNow || now)) / 1000, 0, 0.1); lastNow = now; clock += dt;
    const state = game.getState(), set = state.set, sc = state.scene, playing = sc === 'play' || sc === 'over';
    if (heroWas !== !!v3.hero) { heroWas = !!v3.hero; snapNext = snapNext || false; }
    setLook(set.wood, set.stones);
    setBoard(shownN, set.wood, set.coords);
    bowls.visible = !playing;
    let anim = false, n = shownN;
    if (playing) {
      const g = state.game, sig = g.cells.join(''), gs = `${g.mode}|${g.n}|${state.seat0}`;
      if (sig !== cellsSig) {
        const count = g.moves.length, grew = gs === gameSig && count === prevCount + 1;
        if (!grew) placed.clear(); else if (!set.calm) placed.set(g.moves[count - 1], clock);
        cellsSig = sig; gameSig = gs; prevCount = count;
      }
      anim = writeStones(n, g.cells, (i) => (placed.has(i) ? clock - placed.get(i) : 9));
      for (const [i, t0] of placed) if (clock - t0 > DROP) placed.delete(i);
      const won = g.winner && g.winner < 3 && g.line.length >= 2;
      halosOn(n, won ? g.line : [], won ? clamp(state.winT / 0.5, 0, 1) : 0, state.t);
      // a lamp glint runs along the winning five
      if (won && !set.calm) { const u = ((state.winT - 0.3) % 2.6) / 0.9; if (u >= 0 && u <= 1) { const a = cross(n, g.line[0]), b = cross(n, g.line[g.line.length - 1]); glint.position.set(a.x + (b.x - a.x) * u, TOP + 3.2, a.z + (b.z - a.z) * u); glint.intensity = 900 * Math.sin(u * Math.PI); } else glint.intensity = 0; anim = true; } else glint.intensity = 0;
      // translucent ghost stone where the player aims
      const aim = state.aim >= 0 ? state.aim : state.pending >= 0 ? state.pending : state.hover;
      if (sc === 'play' && aim >= 0 && aim < n * n && !g.cells[aim] && state.canPlay) {
        const blk = g.turn === BLACK, c = cross(n, aim);
        if (ghost.userData.blk !== blk) { ghost.userData.blk = blk; ghost.material.dispose(); ghost.material = (blk ? mats.black : mats.white).clone(); ghost.material.transparent = true; ghost.material.depthWrite = false; }
        ghost.material.opacity = state.aim >= 0 || state.pending >= 0 ? 0.62 : 0.4; ghost.position.set(c.x, TOP + 0.04, c.z); ghost.visible = true;
      } else ghost.visible = false;
    } else {
      // title / pages: the showcase plays the same 11-stone story as the flat art, on a 15 x 15 board
      ghost.visible = false; glint.intensity = 0; cellsSig = '';
      const t = state.t % (SHOW.length * 0.85 + 4.8), period = SHOW.length * 0.85 + 4.8, shown = Math.min(SHOW.length, Math.floor(t / 0.85) + 1);
      const fade = t > period - 1 ? clamp(1 - (t - (period - 1)), 0, 1) : 1, cells = new Array(225).fill(0);
      for (let k = 0; k < shown; k++) cells[SHOW[k][1] * 15 + SHOW[k][0]] = k % 2 === 0 ? 1 : 2;
      const ageOf = (i) => { const k = SHOW.findIndex(([x, y]) => y * 15 + x === i); return set.calm ? 9 : t - k * 0.85; };
      writeStones(15, cells, ageOf, fade);
      const lineK = shown === SHOW.length ? clamp((t - SHOW.length * 0.85 - 0.3) / 0.5, 0, 1) : 0;
      halosOn(15, lineK > 0 ? [8 * 15 + 6, 8 * 15 + 7, 8 * 15 + 8, 8 * 15 + 9, 8 * 15 + 10] : [], lineK * fade, state.t);
      anim = true;
    }
    // shock ring where a stone touched down
    shockT += dt;
    if (shockAt && shockT < 0.4 && !set.calm) { const u = shockT / 0.4, s = STONE_R * (2.2 + u * 2.6); shock.visible = true; shock.position.set(shockAt.x, TOP + 0.015, shockAt.z); shock.scale.set(s, 1, s); shock.material.opacity = 0.35 * (1 - u); anim = true; } else shock.visible = false;
    if (fadeIn < 1) { fadeIn = Math.min(1, fadeIn + dt / 0.35); v3.fade = fadeIn; anim = true; }
    renderer.setSize(cssW(), cssH(), false);
    renderer.render(scene, camera);
    // quality tiers: drop on sustained slow frames (never back up during a session)
    const ft = dt * 1000; if (ft > 0) frameAvg = frameAvg * 0.95 + ft * 0.05;
    if (frameAvg > 26 && tier < 2) { if (++slowFrames > 90) { tier++; slowFrames = 0; frameAvg = 16; applyTier(); boardKey = ''; } } else slowFrames = 0;
    void anim; void moving;
  }

  // ---------------------------------------------------------------- context loss: flat art takes over, then back to 3D
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; v3.on = false; canvas.style.visibility = 'hidden'; });
  canvas.addEventListener('webglcontextrestored', () => {
    lost = false; buildEnv(); look = ''; boards.clear(); boardKey = ''; boardObj && scene.remove(boardObj); boardObj = null;
    applyTier(); fadeIn = 0; v3.fade = 0; v3.on = true; canvas.style.visibility = 'visible'; snapNext = true;
  });

  // warm up: compile shaders and upload the default look before taking over, in small slices
  await tick();
  setLook('kaya', 'slate'); await tick(); setBoard(15, 'kaya', true); await tick();
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
