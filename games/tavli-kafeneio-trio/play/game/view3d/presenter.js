// Tavli 3D presenter. READS the game state (game.getState()) and what view.js recorded this frame (v3.rec / v3.tray / v3.hero);
// never writes game state. One WebGL canvas sits behind the kit's transparent 2D canvas: the olive-ash tavli case with its cobalt and
// cream lacquered points on a checked cloth and a marble kafeneio table in island window light, marble and wenge checkers, and a
// blue felt tray where two enamel dice are thrown. The camera is fitted to the layout's board rectangle (play) or the title's hero
// rectangle, and taps / labels go through layout `proj` (the same camera). No WebGL, ?flat=1 or a lost context: v3.on = false and every
// screen is the flat 2D art; a restored context rebuilds and returns.
import * as THREE from '../vendor3d/three.js';
import { v3 } from '../src/v3.js';
import { meta } from '../src/game.js';
import { layoutFor, proj, TRAY, pointGeom, SLOT, PLEN } from '../src/layout.js';
import { K, wx, wz, cxOf, cyOf, LR, FH, FY, TY, CR, CT, DIE, PLANE_Y, baseAt, buildBoard, checkerKit, diceKit, buildRoom, buildLights, radialTex, ringTex, pointGlowGeo, triGlowTex, tex } from './world.js';

const TAU = Math.PI * 2, D2R = Math.PI / 180;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = (f) => f * f * (3 - 2 * f);
const hash = (a, b = 0) => { let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
const TIERS = [{ name: 'high', dpr: 2, shadow: 2048, tex: 1.5 }, { name: 'medium', dpr: 1.5, shadow: 1024, tex: 1.2 }, { name: 'low', dpr: 1, shadow: 0, tex: 0.9 }];
const tick = () => new Promise((r) => setTimeout(r, 0));
const LIFT = K * 1.4;                    // cm per unit of the flat art's "lift"
const SETTLE = 0.34;
const BOARD_SCENES = new Set(['play', 'over']);

export async function createPresenter({ kitCanvas }) {
  const qs = new URLSearchParams(location.search);
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;height:100dvh;display:block;pointer-events:none;z-index:0;visibility:hidden;opacity:0';
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' }); } catch (e) { console.warn('WebGL unavailable; flat 2D art', e); return { ok: false }; }
  if (!renderer.getContext()) return { ok: false };
  kitCanvas.parentElement.insertBefore(canvas, kitCanvas);
  const vig = document.createElement('div');
  vig.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:0;visibility:hidden;background:radial-gradient(ellipse at 50% 48%, rgba(0,0,0,0) 55%, rgba(4,12,30,0.45) 100%)';
  kitCanvas.parentElement.insertBefore(vig, kitCanvas);
  kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.92;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.autoClear = false;
  let tier = qs.has('tier') ? clamp(Number(qs.get('tier')), 0, 2) : (navigator.hardwareConcurrency || 8) <= 4 ? 1 : 0;

  await tick();
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x2a4a74);
  scene.fog = new THREE.Fog(0x2a4a74, 420, 900);
  const camera = new THREE.PerspectiveCamera(30, 1, 1, 900);
  const lights = buildLights(scene);
  const buildEnv = () => { try { const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture; pm.dispose(); scene.environmentIntensity = 0.4; } catch { /* no IBL */ } };
  buildEnv();
  await tick();
  const room = buildRoom(scene);
  await tick();
  let board = buildBoard(TIERS[tier].tex); scene.add(board);
  await tick();

  // ---------------------------------------------------------------- checkers (pool), glows, dust, steam
  const CK = checkerKit();
  const pieces = Array.from({ length: 40 }, () => { const g = CK.make(); g.visible = false; scene.add(g); return g; });
  const flatQuad = new THREE.PlaneGeometry(1, 1); flatQuad.rotateX(-Math.PI / 2);
  const addQ = (map, n, ro, geo = flatQuad) => Array.from({ length: n }, () => { const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, side: THREE.DoubleSide })); m.renderOrder = ro; m.visible = false; scene.add(m); return m; });
  const ringT = ringTex(), glowT = radialTex('255,255,255', 1, 128);
  const triGlows = addQ(triGlowTex(), 8, 2, pointGlowGeo()), rings = addQ(ringT, 24, 3), discs = addQ(glowT, 12, 3), dots = addQ(glowT, 40, 3), trayGlow = addQ(glowT, 1, 2)[0];
  const blobT = radialTex('0,0,0', 0.9, 64);
  const blobs = Array.from({ length: 6 }, () => { const m = new THREE.Mesh(flatQuad, new THREE.MeshBasicMaterial({ map: blobT, transparent: true, depthWrite: false, opacity: 0.45 })); m.renderOrder = 1; m.visible = false; scene.add(m); return m; });
  const dustT = radialTex('240,235,220', 0.8);
  const dust = Array.from({ length: 10 }, () => { const m = new THREE.Mesh(flatQuad, new THREE.MeshBasicMaterial({ map: dustT, transparent: true, depthWrite: false })); m.renderOrder = 2; m.visible = false; m.userData = { t: 9 }; scene.add(m); return m; });
  let dustI = 0; const puff = (x, y, z, s = 1) => { const m = dust[dustI++ % dust.length]; m.userData = { t: 0, x, y, z, s }; };
  // steam over the coffee
  const steamT = radialTex('255,250,240', 0.5, 64);
  const steam = Array.from({ length: 7 }, (_, i) => { const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: steamT, transparent: true, depthWrite: false, opacity: 0 })); m.userData = { ph: i / 7 }; scene.add(m); return m; });
  // two dice resting on the cloth for the title (thrown again every few seconds)
  const DK = diceKit();
  const titleDice = [0, 1].map((i) => { const d = DK.make(i === 0); scene.add(d); return d; });

  // ---------------------------------------------------------------- the dice tray (own scene, own camera)
  const trayScene = new THREE.Scene();
  const trayCam = new THREE.PerspectiveCamera(24, 1, 1, 200);
  trayScene.environment = scene.environment; trayScene.environmentIntensity = 0.45;
  const leather = (() => { const c = document.createElement('canvas'); c.width = 512; c.height = 256; const x = c.getContext('2d'); const g = x.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, '#0c3562'); g.addColorStop(1, '#1b5a98'); x.fillStyle = g; x.fillRect(0, 0, 512, 256); let sd = 7; const r = () => ((sd = (Math.imul(sd, 1664525) + 1013904223) >>> 0) / 4294967296); for (let i = 0; i < 9000; i++) { x.fillStyle = `rgba(${r() > 0.5 ? '200,220,255' : '0,0,0'},${r() * 0.07})`; x.fillRect(r() * 512, r() * 256, 1 + r() * 2, 1 + r() * 2); } return tex(c); })();
  const trayFloor = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshStandardMaterial({ map: leather, roughness: 0.85 })); trayFloor.rotation.x = -Math.PI / 2; trayFloor.receiveShadow = true; trayScene.add(trayFloor);
  trayScene.add(new THREE.HemisphereLight(0xe4f0ff, 0x1a2a44, 0.9));
  const tKey = new THREE.DirectionalLight(0xfff0d2, 2.4); tKey.position.set(-12, 30, -6); tKey.castShadow = true; Object.assign(tKey.shadow.camera, { left: -20, right: 20, top: 12, bottom: -12, near: 5, far: 80 }); tKey.shadow.mapSize.set(1024, 1024); tKey.shadow.radius = 3; tKey.shadow.bias = -0.0005; trayScene.add(tKey);
  const tFill = new THREE.DirectionalLight(0xa8c4ff, 0.5); tFill.position.set(16, 10, 18); trayScene.add(tFill);
  const trayDice = [0, 1].map(() => [DK.make(true), DK.make(false)].map((d) => { d.visible = false; trayScene.add(d); return d; }));
  const dimMat = new Map();
  const setDim = (mesh, dim) => { const mats = mesh.userData.base || (mesh.userData.base = mesh.material); if (!dim) { mesh.material = mats; return; } let dm = dimMat.get(mats); if (!dm) { dm = mats.map((m) => { const c = m.clone(); c.color = new THREE.Color(0.42, 0.4, 0.38); return c; }); dimMat.set(mats, dm); } mesh.material = dm; };

  function applyTier() {
    const t = TIERS[tier];
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, t.dpr));
    renderer.shadowMap.enabled = t.shadow > 0; lights.key.castShadow = t.shadow > 0; tKey.castShadow = t.shadow > 0;
    if (t.shadow) { lights.key.shadow.mapSize.set(t.shadow, t.shadow); if (lights.key.shadow.map) { lights.key.shadow.map.dispose(); lights.key.shadow.map = null; } }
    for (const s of [scene, trayScene]) s.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => { m.needsUpdate = true; }); });
  }
  applyTier();

  // ---------------------------------------------------------------- camera: yaw/tilt/fov per screen, distance + off-axis shift fitted to a rectangle
  const cur = { yaw: 0, tilt: 62, fov: 30, dist: 120, ox: 0, oy: 0, tx: 0, ty: 0, tz: 0 };
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
    const p = { ...base, ox: 0, oy: 0, dist: 120 }, q = { x: 0, y: 0 }; let bb = null;
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

  // ---------------------------------------------------------------- canonical <-> screen through the camera (layout proj)
  const ray = new THREE.Raycaster(), hit = new THREE.Vector3(), ndc = new THREE.Vector2();
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -PLANE_Y);
  const projPt = (x, y) => virt(toCss(camera, wx(x), PLANE_Y, wz(y), { x: 0, y: 0 }));
  const projInv = (vx, vy) => {
    ndc.set(((vx * cpu() + offX()) / cssW()) * 2 - 1, 1 - ((vy * cpu() + offY()) / cssH()) * 2);
    ray.setFromCamera(ndc, camera);
    if (!ray.ray.intersectPlane(plane, hit)) return { x: -999, y: -999 };
    return { x: cxOf(hit.x), y: cyOf(hit.z) };
  };

  // ---------------------------------------------------------------- pieces
  const prevPos = new Map();
  let clock = 0, lastMover = null, landAt = null;
  const posOf = (p) => {
    // world placement of one recorded checker: base surface, shingle level, lift, tilt
    let x = wx(p.x), y, rz = 0;
    const z = wz(p.y);
    if (p.off) {                                                          // borne off: on edge, leaning in a row in the felt tray
      const lean = 1.05; rz = lean; y = TY + Math.sin(lean) * CR - Math.cos(lean) * CT * 0.5 + 0.02; x -= Math.cos(lean) * CR * 0.7;
    } else {
      y = baseAt(p.x, p.y) + (p.lvl || 0) * CT * 0.6 + (p.lift || 0) * LIFT;
      if (p.lvl) rz = -(p.dir || 1) * 0.15;
    }
    return { x, y, z, rx: 0, rz };
  };
  function drawPieces(rec, dt) {
    let n = 0, nb = 0;
    const set = CK.mats[rec.set] || CK.mats.classic;
    const put = (p, P, key) => {
      if (n >= pieces.length) return null;
      const g = pieces[n++]; g.visible = true;
      let sq = 1, rock = 0;
      if (landAt && clock - landAt.t < SETTLE && Math.hypot(P.x - landAt.x, P.z - landAt.z) < 1.0) { const s = (clock - landAt.t) / SETTLE, d = (1 - s) * (1 - s); sq = 1 - 0.22 * Math.sin(s * Math.PI) * d; rock = Math.sin(s * Math.PI * 3) * 0.07 * d; }
      // lean into the direction of travel while it flies
      const pp = prevPos.get(key); let lx = 0, lz = 0;
      if (pp && dt > 0 && key >= 700) { const vx = (P.x - pp.x) / dt, vz = (P.z - pp.z) / dt; lz = clamp(-vx * 0.012, -0.35, 0.35); lx = clamp(vz * 0.012, -0.35, 0.35); }
      if (key >= 700) prevPos.set(key, { x: P.x, z: P.z });
      g.position.set(P.x, P.y, P.z); g.scale.set(1, sq, 1); g.rotation.set(P.rx + lx + rock, P.rz ? 0 : hash(key, 5) * TAU, P.rz + lz);
      const M = set[p.s]; g.children[0].material = M.body; g.children[1].material = M.top;
      return g;
    };
    for (const p of rec.pieces) put(p, posOf(p), p.key);
    const flyer = (m) => {
      const under = baseAt(m.x, m.y), P = { x: wx(m.x), z: wz(m.y), y: under + m.lift * LIFT, rx: 0, rz: 0 };
      put(m, P, m.key);
      if (nb < blobs.length) { const bl = blobs[nb++], h = Math.max(0, P.y - under), s2 = CR * 2.4 * (1 + h * 0.12); bl.visible = true; bl.position.set(P.x + h * 0.35, under + 0.02, P.z + h * 0.15); bl.scale.set(s2, 1, s2); bl.material.opacity = 0.5 / (1 + h * 0.3); }
      return P;
    };
    let mp = null;
    if (rec.mover) mp = flyer(rec.mover);
    if (rec.hitMover) flyer(rec.hitMover);
    if (rec.drag) { const b = baseAt(rec.drag.x, rec.drag.y), P = { x: wx(rec.drag.x), z: wz(rec.drag.y), y: b + 1.6, rx: 0, rz: 0 }; put({ s: 0 }, P, 710); if (nb < blobs.length) { const bl = blobs[nb++]; bl.visible = true; bl.position.set(P.x + 0.6, b + 0.02, P.z + 0.3); bl.scale.set(CR * 2.6, 1, CR * 2.6); bl.material.opacity = 0.35; } }
    // a landing: a squash and a rock that dies away, and a puff of dust
    if (lastMover && !rec.mover && !rec.calm) { landAt = { t: clock, x: lastMover.x, z: lastMover.z }; puff(lastMover.x, lastMover.y - CT * 0.2, lastMover.z, 1); }
    lastMover = mp;
    for (; n < pieces.length; n++) pieces[n].visible = false;
    for (; nb < blobs.length; nb++) blobs[nb].visible = false;
  }
  const col = (m, r, g, b, a = 1) => m.material.color.setRGB(r * a, g * a, b * a);
  function drawMarks(rec) {
    const pu = rec.calm ? 0.8 : 0.62 + 0.38 * Math.sin(clock * 5);
    let k = 0;
    for (const idx of rec.dests) {
      if (k >= triGlows.length) break;
      const m = triGlows[k++], g = pointGeom(idx);
      m.visible = true; m.position.set(wx(g.edge), FY + 0.03, wz(g.y)); m.scale.set(g.dir * PLEN * K, 1, (SLOT / 2 - 3) * K); col(m, 1.0, 0.78, 0.32, 0.6 * pu);
    }
    for (; k < triGlows.length; k++) triGlows[k].visible = false;
    let r = 0, d = 0, o = 0;
    const ring = (x, y, s, rr, gg, bb, a, h = 0.05) => { if (r >= rings.length) return; const m = rings[r++]; m.visible = true; m.position.set(wx(x), baseAt(x, y) + h, wz(y)); m.scale.set(s, 1, s); col(m, rr, gg, bb, a); };
    const disc = (x, y, s, rr, gg, bb, a) => { if (d >= discs.length) return; const m = discs[d++]; m.visible = true; m.position.set(wx(x), baseAt(x, y) + 0.06, wz(y)); m.scale.set(s, 1, s); col(m, rr, gg, bb, a); };
    for (const p of rec.pieces) {
      if (p.sel) ring(p.x, p.y, CR * 3.1, 1, 0.9, 0.5, 1, (p.lvl || 0) * CT * 0.6 + 0.04);
      else if (p.src) ring(p.x, p.y, CR * 2.9, 1, 0.8, 0.35, 0.6 * pu, (p.lvl || 0) * CT * 0.6 + 0.04);
    }
    for (const q of rec.rings) {
      if (q.kind === 'land') { ring(q.x, q.y, CR * 2.6 * (0.95 + 0.05 * pu), 1, q.hit ? 0.35 : 0.85, q.hit ? 0.25 : 0.45, 0.9 * pu); disc(q.x, q.y, CR * 1.9, 1, 0.82, 0.4, 0.35 * pu); }
      else ring(q.x, q.y, CR * 3.2, 0.45, 0.9, 1, 1);
    }
    for (const mv of rec.moves) {
      ring(mv.from.x, mv.from.y, CR * 3.2, 0.45, 1, 0.65, 1, 0.8);
      disc(mv.to.x, mv.to.y, CR * 2.6, 0.45, 1, 0.65, 0.6 * pu); ring(mv.to.x, mv.to.y, CR * 2.8, 0.45, 1, 0.65, 1);
      for (let i = 1; i < 7 && o < dots.length; i++) { const f = i / 7, x = mv.from.x + (mv.to.x - mv.from.x) * f, y = mv.from.y + (mv.to.y - mv.from.y) * f, m = dots[o++]; m.visible = true; m.position.set(wx(x), Math.max(baseAt(x, y), FY) + 0.9 + Math.sin(f * Math.PI) * 1.2, wz(y)); m.scale.set(0.7, 1, 0.7); col(m, 0.45, 1, 0.65, rec.calm ? 0.8 : 0.5 + 0.5 * Math.sin(clock * 6 - i * 0.8)); }
    }
    for (; r < rings.length; r++) rings[r].visible = false;
    for (; d < discs.length; d++) discs[d].visible = false;
    for (; o < dots.length; o++) dots[o].visible = false;
    trayGlow.visible = rec.trayGlow > 0;
    if (trayGlow.visible) { const T = TRAY.me; trayGlow.position.set(wx(T.x + T.w / 2), TY + 0.05, wz(T.y + T.h / 2)); trayGlow.scale.set(T.w * K * 1.15, 1, T.h * K * 2.2); col(trayGlow, 1, 0.8, 0.4, 0.75 * rec.trayGlow); }
  }
  const hideMarks = () => { for (const a of [triGlows, rings, discs, dots]) for (const m of a) m.visible = false; trayGlow.visible = false; };

  // ---------------------------------------------------------------- the dice tray pass
  const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), R2 = new THREE.Raycaster(), _hp = new THREE.Vector3(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _ax = new THREE.Vector3();
  const DIE_U = 66;                      // the flat die sprite's size in virtual units: the 3D die keeps about that size on screen
  function renderTray(calm) {
    const T = v3.tray; if (!T || !T.dice) return;
    const rc = rectCss(T.DI), W = cssW(), H = cssH(); if (rc.w < 4 || rc.h < 4) return;
    const unit = DIE / DIE_U * 1.05, th = T.DI.h * unit, tw = T.DI.w * unit, tilt = 58 * D2R;
    trayCam.aspect = rc.w / rc.h; trayCam.clearViewOffset();
    const dist = (th * 0.5) / Math.tan(trayCam.fov * D2R / 2);
    trayCam.position.set(0, Math.sin(tilt) * dist, Math.cos(tilt) * dist); trayCam.lookAt(0, 0, 0); trayCam.updateProjectionMatrix(); trayCam.updateMatrixWorld(true);
    trayFloor.scale.set(tw * 1.8, th * 2.6, 1);
    for (const pair of trayDice) for (const d of pair) d.visible = false;
    const at = (vx, vy) => { R2.setFromCamera(ndc.set(((vx - T.DI.x) / T.DI.w) * 2 - 1, 1 - ((vy - T.DI.y) / T.DI.h) * 2), trayCam); return R2.ray.intersectPlane(floorPlane, _hp) ? _hp.clone() : new THREE.Vector3(); };
    T.dice.forEach((dd, k) => {
      const d = trayDice[k][dd.ivory ? 0 : 1]; d.visible = true; setDim(d, dd.dim);
      const p = at(dd.x, dd.y), f = dd.f ?? 1, rolling = f < 1;
      const rest = DK.restQ(dd.v, dd.rot * 2 + k * 0.4);
      if (rolling && !calm) { const e = ease(f); _ax.set(hash(k, 21) - 0.5, 0.3, hash(k, 22) - 0.5).normalize(); _q2.setFromAxisAngle(_ax, (1 - e) * (12 + k * 5)); _q.copy(rest).premultiply(_q2); }
      else _q.copy(rest);
      d.quaternion.copy(_q); d.position.set(p.x, DIE / 2 + (dd.lift || 0) * unit * 0.8, p.z);
    });
    // the felt warms a little when it is your turn to throw
    trayFloor.material.color.setScalar(T.ready && !calm ? 1 + 0.25 * (T.pulse || 0) : 1);
    renderer.setScissorTest(true);
    renderer.setViewport(rc.x, H - rc.y - rc.h, rc.w, rc.h); renderer.setScissor(rc.x, H - rc.y - rc.h, rc.w, rc.h);
    renderer.clear(); renderer.render(trayScene, trayCam);
    renderer.setScissorTest(false); renderer.setViewport(0, 0, W, H);
  }

  // ---------------------------------------------------------------- framing
  const CASE_PTS = (() => { const out = []; for (const x of [LR.x, LR.x + LR.w]) for (const y of [LR.y, LR.y + LR.h]) { out.push([wx(x), FH, wz(y)]); out.push([wx(x), 0, wz(y)]); } return out; })();
  let lastHero = null;
  function framing(state, L) {
    const sc = state.scene, t = state.t, calm = state.calm;
    if (BOARD_SCENES.has(sc)) {
      const rc = rectCss(L.board);
      return fit(rc, CASE_PTS, L.rot ? { yaw: -90, tilt: 63, fov: 26, tx: 0, ty: FY, tz: 0 } : { yaw: 0, tilt: 63, fov: 26, tx: 0, ty: FY, tz: 0 });
    }
    const drift = calm ? 0 : 1;
    const base = { yaw: -22 + 7 * Math.sin(t * TAU / 40) * drift, tilt: 30 + 3 * Math.sin(t * TAU / 27) * drift, fov: 30, tx: 0, ty: 1, tz: 0 };
    const pts = [[wx(LR.x) - 1, 0, wz(LR.y + LR.h) + 2], [wx(LR.x + LR.w) + 1, 0, wz(LR.y + LR.h) + 2], [wx(LR.x), FH, wz(LR.y)], [wx(LR.x + LR.w), FH, wz(LR.y)], [-40, 0, 24], [40, 0, -34]];
    let r = lastHero; const T = L.titleFor(!!state.saved);
    if (T.hero) r = T.hero;
    if (!r) r = { x: L.ux0, y: L.uy0 + 200, w: L.ux1 - L.ux0, h: 400 };
    const rc = rectCss(r), gx = rc.w * 0.03, gy = rc.h * 0.04; rc.x += gx; rc.w -= 2 * gx; rc.y += gy; rc.h -= 2 * gy;
    return fit(rc, pts, base);
  }

  // ---------------------------------------------------------------- per frame
  let game = null, lost = false, lastNow = 0, frameAvg = 16, slowFrames = 0, fadeIn = 0, lastBoard = null;
  function pre() {
    if (!game || lost) return;
    const state = game.getState(), L = layoutFor(meta.width, meta.height, state.autoMode), onBoard = BOARD_SCENES.has(state.scene);
    const vk = `${cssW()}x${cssH()}|${L.key}`; if (vk !== viewKey) { viewKey = vk; snap = true; }
    if (lastBoard !== onBoard) { lastBoard = onBoard; snap = true; }
    const goal = framing(state, L);
    const now = performance.now(), dt = clamp((now - (lastNow || now)) / 1000, 0, 0.1);
    const k = snap || onBoard ? 1 : 1 - Math.exp(-dt * 5);
    for (const key of Object.keys(goal)) cur[key] += (goal[key] - cur[key]) * k;
    snap = false;
    place(camera, cur);
  }
  function post() {
    if (!game || lost) return;
    const now = performance.now(), dt = clamp((now - (lastNow || now)) / 1000, 0, 0.1); lastNow = now; clock += dt;
    const state = game.getState(), calm = state.calm, rec = v3.rec, onBoard = BOARD_SCENES.has(state.scene);
    lastHero = v3.hero || lastHero;
    if (rec) { drawPieces(rec, dt); if (onBoard) drawMarks(rec); else hideMarks(); }
    else if (onBoard) { for (const p of pieces) p.visible = false; hideMarks(); for (const b of blobs) b.visible = false; }
    else hideMarks();                                                      // reader pages keep the last title still life behind them
    // title dice: on the kilim beside the board; thrown again every nine seconds
    titleDice.forEach((d, i) => {
      d.visible = !onBoard; if (onBoard) return;
      const cyc = Math.floor(clock / 9), u = calm ? 1 : clamp((clock % 9) / 1.1, 0, 1), e = 1 - (1 - u) * (1 - u);
      const v = [[5, 3], [6, 6], [4, 1], [6, 5], [3, 2]][cyc % 5][i];
      const rx = 23 + i * 3.4, rz = 14 + i * 1.4, sx = rx - 9, sz = rz - 3;
      const hop = Math.abs(Math.sin(u * Math.PI * 2.5)) * (1 - u) * 3.2;
      _q.copy(DK.restQ(v, 0.5 + i * 0.7)); if (u < 1) { _ax.set(0.3, 0.5, 0.8 - i).normalize(); _q2.setFromAxisAngle(_ax, (1 - e) * 14); _q.premultiply(_q2); }
      d.quaternion.copy(_q); d.position.set(sx + (rx - sx) * e, -0.36 + DIE / 2 + hop, sz + (rz - sz) * e);
    });
    for (const m of dust) {
      const u = m.userData; if (!(u.t <= 0.55)) { m.visible = false; continue; }
      u.t += dt; const f = Math.min(1, u.t / 0.55), s = (CR * 2 + f * 3) * u.s;
      m.visible = true; m.position.set(u.x, u.y + 0.05 + f * 0.25, u.z); m.scale.set(s, 1, s); m.material.opacity = 0.45 * (1 - f) * (1 - f);
    }
    const tp = room.cup.position;
    steam.forEach((m) => { const ph = (m.userData.ph + clock * 0.12) % 1; m.visible = !calm; m.position.set(tp.x + Math.sin(ph * 9 + m.userData.ph * 20) * (0.3 + ph * 1.0), tp.y + 5.5 + ph * 8, tp.z + Math.cos(ph * 7) * 0.4); m.scale.setScalar(1.5 + ph * 4); m.material.opacity = 0.16 * Math.sin(ph * Math.PI); });
    if (fadeIn < 1) { fadeIn = Math.min(1, fadeIn + dt / 0.45); v3.fade = fadeIn; canvas.style.opacity = String(fadeIn); }
    renderer.setSize(cssW(), cssH(), false);
    renderer.clear(); renderer.render(scene, camera);
    if (rec && v3.tray) renderTray(calm);
    const ft = dt * 1000; if (ft > 0) frameAvg = frameAvg * 0.95 + ft * 0.05;
    if (frameAvg > 28 && tier < 2) { if (++slowFrames > 90) { tier++; slowFrames = 0; frameAvg = 16; applyTier(); } } else slowFrames = 0;
  }

  const setProj = (on) => { proj.pt = on ? projPt : null; proj.inv = on ? projInv : null; };
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; v3.on = false; setProj(false); canvas.style.visibility = 'hidden'; vig.style.visibility = 'hidden'; });
  canvas.addEventListener('webglcontextrestored', () => {
    lost = false; buildEnv(); trayScene.environment = scene.environment;
    scene.remove(board); board.userData.dispose(); board = buildBoard(TIERS[tier].tex); scene.add(board);
    applyTier(); fadeIn = 0; v3.fade = 0; v3.on = true; setProj(true); canvas.style.visibility = 'visible'; vig.style.visibility = 'visible'; snap = true;
  });

  place(camera, cur); try { renderer.compile(scene, camera); renderer.compile(trayScene, trayCam); } catch { /* compiled lazily */ }
  await tick();

  return {
    ok: true, renderer, scene, camera,
    attach(g) { game = g; v3.on = true; v3.fade = 0; fadeIn = 0; setProj(true); canvas.style.visibility = 'visible'; vig.style.visibility = 'visible'; snap = true; },
    pre, post,
    get tier() { return TIERS[tier].name; },
    loseContext() { const ext = renderer.getContext().getExtension('WEBGL_lose_context'); ext?.loseContext(); return ext; },
  };
}
