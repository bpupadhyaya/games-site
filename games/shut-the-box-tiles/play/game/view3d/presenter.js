// Shut the Box 3D presenter. READS the game state (game.getState()) and what the 2D layer asked for this frame (src/v3.js), never writes
// game state; its only output is v3.tiles, the projected tap rectangle of every tile, so taps land exactly on the 3D tiles.
// One WebGL canvas sits behind the kit's transparent 2D canvas and is drawn in three passes, each with its own camera fitted to the
// rectangle the 2D layout gives it: the tavern table (whole screen), the box (play region / title hero), the dice tray (tray rectangle).
// No WebGL or a lost context: v3.on = false and every screen draws the flat 2D art; a restored context rebuilds the scene.
import * as THREE from '../vendor3d/three.js';
import * as B from '../vendor3d/board3d.js';
import { v3 } from '../src/v3.js';
import { meta } from '../src/game.js';
import { layoutFor } from '../src/layout.js';
import { TW, TH, FLOOR, TILE_Y, FACE_N, buildBox, buildTray, buildTable, buildDie, clearNumberTex, disposeDieMaps } from './world.js';

const D2R = Math.PI / 180, clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const TIERS = [{ name: 'high', dpr: 2, tex: 1024 }, { name: 'medium', dpr: 1.5, tex: 512 }, { name: 'low', dpr: 1, tex: 256 }];
const tick = () => new Promise((r) => setTimeout(r, 0));
const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const TRAY_D = 9.5, UP = new THREE.Vector3(0, 1, 0);

export async function createPresenter({ kitCanvas }) {
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;height:100dvh;display:block;pointer-events:none;z-index:0;visibility:hidden';
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' }); } catch (e) { console.warn('WebGL unavailable; flat 2D art', e); return { ok: false }; }
  if (!renderer.getContext()) return { ok: false };
  kitCanvas.parentElement.insertBefore(canvas, kitCanvas);
  kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
  renderer.autoClear = false;
  let tier = (navigator.hardwareConcurrency || 8) <= 4 ? 1 : 0;

  await tick();
  const scene = new THREE.Scene(); renderer.setClearColor(0x120706, 1);
  const key = new THREE.DirectionalLight(0xffe2b8, 2.3); key.position.set(-30, 60, 34); scene.add(key);
  const fill = new THREE.DirectionalLight(0x9db8ff, 0.45); fill.position.set(40, 30, -20); scene.add(fill);
  scene.add(new THREE.HemisphereLight(0xfff0d8, 0x2a1208, 0.5));
  const boxLamp = new THREE.PointLight(0xffb36a, 420, 120, 1.6); boxLamp.position.set(-8, 26, 10);
  const trayLamp = new THREE.PointLight(0xffb36a, 260, 90, 1.6); trayLamp.position.set(-6, 22, 8);
  scene.add(boxLamp, trayLamp);
  const env = B.createEnvironment(renderer, scene, { intensity: 0.42 });
  await tick();

  let texSize = TIERS[tier].tex;
  const table = buildTable(texSize); scene.add(table);
  const cams = { bg: new THREE.PerspectiveCamera(34, 1, 2, 800), box: new THREE.PerspectiveCamera(24, 1, 2, 800), tray: new THREE.PerspectiveCamera(24, 1, 2, 800) };
  await tick();

  let boxG = null, boxKey = '', trayG = null, trayKey = '';
  const dice = [buildDie(false, 1), buildDie(true, 1)], hdice = [buildDie(false, 1), buildDie(true, 1)];
  for (const d of [...dice, ...hdice]) scene.add(d);
  function setBox(n, cols, rows, bk, tk) {
    const k = `${n}|${cols}|${rows}|${bk}|${tk}|${texSize}`; if (k === boxKey) return;
    if (boxG) { scene.remove(boxG); boxG.userData.dispose(); }
    boxG = buildBox(n, cols, rows, bk, tk, texSize); boxKey = k; scene.add(boxG);
  }
  function setTray(W) {
    const k = `${W.toFixed(1)}|${texSize}`; if (k === trayKey) return;
    if (trayG) { scene.remove(trayG); trayG.userData.dispose(); }
    trayG = buildTray(W, TRAY_D, texSize); trayKey = k; scene.add(trayG);
  }
  function applyTier() {
    const t = TIERS[tier]; renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, t.dpr));
    if (t.tex !== texSize) { texSize = t.tex; boxKey = ''; trayKey = ''; }
  }
  applyTier();

  // ---------------------------------------------------------------- cameras
  const cssW = () => Math.max(1, window.innerWidth), cssH = () => Math.max(1, window.innerHeight);
  const _v = new THREE.Vector3(), _t = new THREE.Vector3();
  function place(cam, p) {
    const W = cssW(), H = cssH(), dir = _v.set(Math.sin(p.yaw * D2R) * Math.cos(p.tilt * D2R), Math.sin(p.tilt * D2R), Math.cos(p.yaw * D2R) * Math.cos(p.tilt * D2R));
    cam.fov = p.fov; cam.aspect = W / H; _t.set(p.tx, p.ty, p.tz);
    cam.position.copy(_t).addScaledVector(dir, p.dist); cam.up.set(0, 1, 0); cam.lookAt(_t);
    if (p.ox || p.oy) cam.setViewOffset(W, H, p.ox, p.oy, W, H); else cam.clearViewOffset();
    cam.updateProjectionMatrix(); cam.updateMatrixWorld(true);
  }
  const fitCam = new THREE.PerspectiveCamera();
  const toCss = (cam, x, y, z, out = { x: 0, y: 0 }) => { _v.set(x, y, z).project(cam); out.x = (_v.x + 1) / 2 * cssW(); out.y = (1 - _v.y) / 2 * cssH(); return out; };
  function fit(rc, pts, base) {                    // distance + off-axis shift so the points' bounding box fills the css rectangle rc
    const p = { ...base, ox: 0, oy: 0, dist: 120 }, q = { x: 0, y: 0 }; let bb = null;
    for (let it = 0; it < 9; it++) {
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
  const boxPts = (u, extra = []) => { const a = u.Wo / 2, b = u.Do / 2, pts = []; for (const y of [0, 2.4]) for (const sx of [-1, 1]) for (const sz of [-1, 1]) pts.push([sx * a, y, sz * b]); return pts.concat(extra); };

  // ---------------------------------------------------------------- per frame
  let loseExt = null, game = null, lost = false, lastNow = 0, clock = 0, fadeIn = 0, frameAvg = 16, slowFrames = 0, snap = true, viewKey = '', mode = 'bg', camBox = null, trayW = 20;
  const q0 = { x: 0, y: 0 };
  const BG = { yaw: 0, tilt: 62, fov: 34, dist: 96, ox: 0, oy: 0, tx: 0, ty: 0, tz: 4 };

  function pre() {
    if (!game || lost) return;
    const S = game.getState(), L = layoutFor(meta.width, meta.height), land = cssW() > cssH();
    const vk = `${cssW()}x${cssH()}|${meta.width}x${meta.height}`; if (vk !== viewKey) { viewKey = vk; snap = true; }
    // table camera (fixed); the props sit against its visible width
    place(cams.bg, BG);
    const halfH = Math.tan(17 * D2R) * 96, sc = clamp(halfH / 48, 0.5, 0.75);
    const ground = (fx, fy, out) => { _v.set(fx * 2 - 1, 1 - fy * 2, 0.5).unproject(cams.bg); _t.copy(_v).sub(cams.bg.position).normalize(); const k = -cams.bg.position.y / _t.y; return out.copy(cams.bg.position).addScaledVector(_t, k); };
    const tp = land ? [0.06, 0.2, 0.55, 0.9] : [0.13, 0.4, 0.88, 0.4], gp = new THREE.Vector3();
    ground(tp[0], tp[1], gp); table.userData.tank.position.set(gp.x, 0, gp.z); table.userData.tank.scale.setScalar(sc);
    ground(tp[2], tp[3], gp); table.userData.candle.position.set(gp.x, 0, gp.z); table.userData.candle.scale.setScalar(sc); table.userData.lamp.position.set(gp.x - 4, 14 * sc + 8, gp.z + 6);
    mode = 'bg'; v3.tiles = null; table.userData.tank.visible = table.userData.candle.visible = !(S.scene === 'play' && S.g);
    if (S.scene === 'play' && S.g) {
      mode = 'play';
      const n = S.g.n, bd = L.board(n), tr = L.play.tray;
      setBox(n, bd.cols, bd.rows, S.boxKey, S.tileKey);
      const u = boxG.userData;
      camBox = fit(rectCss(L.play.region), boxPts(u), { yaw: 0, tilt: land ? 50 : 54, fov: 24, tx: 0, ty: 1, tz: 0 }); place(cams.box, camBox);
      const out = [];
      for (const t of u.tiles) {   // projected tap rectangle of each cell
        let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
        for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const v = virt(toCss(cams.box, t.cx + sx * TW / 2, TILE_Y, t.cz + sz * TH / 2, q0)); x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y); }
        out.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
      }
      v3.tiles = out;
      trayW = clamp(TRAY_D * tr.w / tr.h, 12, 34); setTray(trayW);
      const a = trayW / 2 + 1.1, b = TRAY_D / 2 + 1.1, tp = []; for (const y of [0, 1.5]) for (const sx of [-1, 1]) for (const sz of [-1, 1]) tp.push([sx * a, y, sz * b]);
      place(cams.tray, fit(rectCss(tr), tp, { yaw: 0, tilt: 56, fov: 24, tx: 0, ty: 0.8, tz: 0 }));
    } else if (S.scene === 'title') {
      mode = 'title';
      const T = L.title(!!S.saved), t = S.t || 0;
      setBox(9, 3, 3, S.boxKey, S.tileKey);
      const u = boxG.userData, rc = rectCss({ x: T.hero.x, y: T.hero.y + T.hero.h * 0.03, w: T.hero.w, h: T.hero.h * 0.94 });
      place(cams.box, fit(rc, boxPts(u, [[u.Wo * 0.62, 0, u.Do / 2 + 6], [-u.Wo * 0.2, 0, u.Do / 2 + 6]]), { yaw: S.calm ? 0 : 5 * Math.sin(t * 0.5), tilt: land ? 40 : 42, fov: 24, tx: 0, ty: 1, tz: 0 }));
    }
  }

  // ---------------------------------------------------------------- tiles and dice
  const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _q3 = new THREE.Quaternion(), _n = new THREE.Vector3();
  const AX = [new THREE.Vector3(1, 0.3, 0.6).normalize(), new THREE.Vector3(0.5, 1, 0.4).normalize()];
  const NONE = { flip: 0, lift: 0, glow: 0, dim: 0, dx: 0 };
  function poseTiles(list, hero) {
    const tiles = boxG.userData.tiles;
    for (let i = 0; i < tiles.length; i++) {
      const t = tiles[i], s = hero ? { ...NONE, flip: list[i] || 0 } : list[i] || NONE, f = smooth(s.flip), arc = Math.sin(f * Math.PI);
      t.piv.rotation.set(f * Math.PI - 0.1 * s.lift * (1 - f), 0, 0);
      t.piv.position.set(t.cx + s.dx * 0.4, FLOOR + 0.3 + arc * 2.4 + s.lift * 0.9, t.cz);
      t.ts.material.opacity = 0.5 * (1 - 0.4 * arc); t.ts.scale.setScalar(1 + 0.1 * arc + s.lift * 0.08);
      t.tm.color.copy(t.base).multiplyScalar(1 - 0.62 * s.dim * (1 - f));
      if (s.lift > 0) { t.gm.color.setHex(0xffc440); t.gm.opacity = 0.95 * s.lift; } else if (s.glow > 0) { t.gm.color.setHex(0x6ee1ff); t.gm.opacity = s.glow * (0.65 + 0.35 * Math.sin(clock * 5)); } else t.gm.opacity = 0;
    }
  }
  function orient(g, red, v, yaw, spin) {
    _q.setFromUnitVectors(_n.set(...FACE_N[v]), UP); _q2.setFromAxisAngle(UP, yaw); _q3.setFromAxisAngle(AX[red ? 1 : 0], spin);
    g.userData.cube.quaternion.copy(_q3).multiply(_q2).multiply(_q);
  }
  function poseDie(g, red, o, size) {
    const half = size / 2, lift = o.air * half * 1.4, sh = g.userData.shadow;
    g.visible = true; g.scale.setScalar(size); g.position.set((o.xf - 0.5) * trayW, 0.82 + half + lift, (o.yf - 0.5) * TRAY_D * 0.85);
    orient(g, red, o.v, o.yaw * 1.4, o.spin);
    sh.position.set(0.25, -half - lift + 0.03, 0.35 + lift * 0.4); sh.scale.setScalar(1 + o.air * 0.4); sh.material.opacity = clamp(0.6 - o.air * 0.25, 0.2, 0.6) * o.fade;
  }
  function poseHeroDie(g, red, x, z, v, yaw, size) {
    g.visible = true; g.scale.setScalar(size); g.position.set(x, FLOOR - 0.15 + size / 2, z); orient(g, red, v, yaw, 0);
    g.userData.shadow.position.set(0.25, -size / 2 + 0.2, 0.35); g.userData.shadow.material.opacity = 0.55;
  }

  function post() {
    if (!game || lost) return;
    const now = performance.now(), dt = clamp((now - (lastNow || now)) / 1000, 0, 0.1); lastNow = now; clock += dt;
    const P = v3.play, H = v3.hero, calm = Boolean((P && P.calm) || (H && H.calm));
    const fl = 1 + (calm ? 0 : 0.07 * Math.sin(clock * 7.1) + 0.05 * Math.sin(clock * 13.3 + 1));
    table.userData.flame.scale.set(0.7 * fl, 1.5 * fl, 0.7 * fl); table.userData.halo.material.opacity = 0.7 * fl; table.userData.lamp.intensity = 500 * fl;
    const hide = () => { table.visible = false; if (boxG) boxG.visible = false; if (trayG) trayG.visible = false; boxLamp.visible = false; trayLamp.visible = false; for (const d of [...dice, ...hdice]) d.visible = false; };
    renderer.setSize(cssW(), cssH(), false); renderer.setViewport(0, 0, cssW(), cssH()); renderer.setScissorTest(false); renderer.clear();
    hide(); table.visible = true; renderer.render(scene, cams.bg);
    if (mode === 'play' && P && boxG) {
      poseTiles(P.tiles, false);
      hide(); renderer.clearDepth(); boxG.visible = true; boxLamp.visible = true; renderer.render(scene, cams.box);
      const dsz = P.dice[0] ? clamp(P.dice[0].sf * TRAY_D * 0.9, 2.4, 5.4) : 4.2;
      P.dice.forEach((o, i) => poseDie(dice[i], i === 1, o, dsz));
      const tr = rectCss(P.tray);
      hide(); renderer.clearDepth(); trayG.visible = true; trayLamp.visible = true; P.dice.forEach((o, i) => { dice[i].visible = true; });
      renderer.setScissorTest(true); renderer.setScissor(tr.x, cssH() - (tr.y + tr.h), tr.w, tr.h); renderer.render(scene, cams.tray); renderer.setScissorTest(false);
    } else if (mode === 'title' && H && boxG) {
      poseTiles(H.f, true);
      const u = boxG.userData;
      hide(); renderer.clearDepth(); boxG.visible = true; boxLamp.visible = true;
      poseHeroDie(hdice[0], false, u.Wo * 0.3, u.Do / 2 + 4.2, 4, 0.5, 4.2); poseHeroDie(hdice[1], true, -u.Wo * 0.04, u.Do / 2 + 3.6, 3, -0.4, 4.2);
      renderer.render(scene, cams.box);
    }
    if (fadeIn < 1) { fadeIn = Math.min(1, fadeIn + dt / 0.45); v3.fade = fadeIn; }
    const ft = dt * 1000; if (ft > 0) frameAvg = frameAvg * 0.95 + ft * 0.05;
    if (frameAvg > 26 && tier < 2) { if (++slowFrames > 90) { tier++; slowFrames = 0; frameAvg = 16; applyTier(); } } else slowFrames = 0;
  }

  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; v3.on = false; v3.tiles = null; canvas.style.visibility = 'hidden'; });
  canvas.addEventListener('webglcontextrestored', () => {
    lost = false; clearNumberTex(); disposeDieMaps(); B.disposeMaterialCache(); try { env.rebuild(); } catch { /* no IBL */ }
    boxKey = ''; trayKey = ''; fadeIn = 0; v3.fade = 0; v3.on = true; canvas.style.visibility = 'visible'; snap = true;
    scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => { if (m && m.isMaterial) { m.needsUpdate = true; for (const k of ['map', 'bumpMap']) if (m[k]) m[k].needsUpdate = true; } }); });
  });
  // the numerals use the Cinzel face: redraw them once it is available
  if (document.fonts && document.fonts.load) document.fonts.load('800 100px Cinzel').then(() => { clearNumberTex(); boxKey = ''; }).catch(() => {});

  await tick();
  try { setBox(9, 3, 3, 'oak', 'bone'); place(cams.bg, BG); renderer.compile(scene, cams.bg); } catch { /* compiled lazily */ }
  await tick();

  return {
    ok: true, renderer, scene,
    attach(g) { game = g; v3.on = true; v3.fade = 0; fadeIn = 0; canvas.style.visibility = 'visible'; snap = true; },
    pre, post,
    get tier() { return TIERS[tier].name; },
    loseContext() { const e = renderer.getContext().getExtension('WEBGL_lose_context'); e?.loseContext(); loseExt = e; return Boolean(e); },
    restoreContext() { loseExt?.restoreContext(); },
  };
}
