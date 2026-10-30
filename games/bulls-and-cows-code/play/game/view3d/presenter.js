// Bulls and Cows 3D presenter. READS what the 2D layer asked for this frame (src/v3.js: pegs, sockets, lids, clue pips, trays) and draws it lit
// in 3D behind the kit's transparent 2D canvas. It never writes game state; taps keep using the flat layout rectangles, which the camera maps
// exactly (a perspective camera looking straight down: the board plane is 1 unit = 1 layout pixel, only the tops of pegs shift by a few pixels).
// No WebGL or a lost context: v3.on = false and every screen draws the flat 2D art; a restored context rebuilds the scene.
import * as THREE from '../vendor3d/three.js';
import * as B from '../vendor3d/board3d.js';
import { v3 } from '../src/v3.js';
import { meta } from '../src/game.js';
import * as W from './world.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const TIERS = [{ name: 'high', dpr: 2, shadow: 2048 }, { name: 'medium', dpr: 1.5, shadow: 1024 }, { name: 'low', dpr: 1, shadow: 512 }];
const tick = () => new Promise((r) => setTimeout(r, 0));
const DIST = 2400;

export async function createPresenter({ kitCanvas }) {
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;height:100dvh;display:block;pointer-events:none;z-index:0;visibility:hidden';
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' }); } catch (e) { console.warn('WebGL unavailable; flat 2D art', e); return { ok: false }; }
  if (!renderer.getContext()) return { ok: false };
  kitCanvas.parentElement.insertBefore(canvas, kitCanvas);
  kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.85;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  let tier = (navigator.hardwareConcurrency || 8) <= 4 ? 1 : 0;

  await tick();
  const scene = new THREE.Scene(); renderer.setClearColor(0x120a06, 1);
  const key = new THREE.DirectionalLight(0xffe6c0, 2.0); key.castShadow = true; key.shadow.bias = -0.0004; key.shadow.normalBias = 1.2; key.shadow.camera.near = 200; key.shadow.camera.far = 4200; scene.add(key, key.target);
  const fill = new THREE.DirectionalLight(0x9db8ff, 0.4); fill.position.set(700, 900, 500); scene.add(fill);
  scene.add(new THREE.HemisphereLight(0xfff0d8, 0x2a1810, 0.35));
  const env = B.createEnvironment(renderer, scene, { intensity: 0.3 });
  const cam = new THREE.PerspectiveCamera(20, 1, 200, 6000); cam.up.set(0, 0, -1);
  await tick();

  const root = new THREE.Group(); scene.add(root);
  const pools = { peg: [], hole: [], lid: [], bull: [], cow: [], none: [] };
  const make = { peg: W.makePeg, hole: W.makeHole, lid: W.makeLid, bull: () => W.makePip('bull'), cow: () => W.makePip('cow'), none: () => W.makePip('none') };
  const slabs = new Map();       // id -> { key, g }
  let table = null, lookKey = '';

  function applyTier() { const t = TIERS[tier]; renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, t.dpr)); key.shadow.mapSize.set(t.shadow, t.shadow); if (key.shadow.map) { key.shadow.map.dispose(); key.shadow.map = null; } }
  applyTier();

  const cssW = () => Math.max(1, window.innerWidth), cssH = () => Math.max(1, window.innerHeight);
  const cpu = () => Math.min(cssW(), cssH()) / 720;
  function place() {
    const hv = cssH() / cpu(), wv = cssW() / cpu(), cx = meta.width / 2, cz = meta.height / 2;
    cam.fov = 2 * Math.atan(hv / 2 / DIST) * 180 / Math.PI; cam.aspect = cssW() / cssH();
    cam.position.set(cx, DIST, cz); cam.lookAt(cx, 0, cz); cam.updateProjectionMatrix(); cam.updateMatrixWorld(true);
    const R = Math.max(wv, hv) * 1.05; const sc = key.shadow.camera; sc.left = -R; sc.right = R; sc.top = R; sc.bottom = -R; sc.updateProjectionMatrix();
    return { cx, cz };
  }
  function setLook(T) {
    if (lookKey === T.name && table) return;
    lookKey = T.name;
    if (table) { root.remove(table); table.geometry.dispose(); }
    for (const s of slabs.values()) { root.remove(s.g); s.g.userData.dispose(); } slabs.clear();
    W.dropMats(); table = W.buildTable(T); root.add(table);
    for (const k of Object.keys(pools)) { for (const o of pools[k]) root.remove(o); pools[k].length = 0; }
  }
  function setSlabs(T) {
    const seen = new Set();
    for (const s of v3.slabs) {
      const k = `${Math.round(s.w)}x${Math.round(s.h)}|${s.r}|${T.name}`; let e = slabs.get(s.id);
      if (!e || e.key !== k) { if (e) { root.remove(e.g); e.g.userData.dispose(); } e = { key: k, g: W.buildSlab(s.w, s.h, s.r, T) }; slabs.set(s.id, e); root.add(e.g); }
      e.g.visible = true; e.g.position.set(s.x + s.w / 2, 0, s.y + s.h / 2); seen.add(s.id);
    }
    for (const [id, e] of slabs) if (!seen.has(id)) e.g.visible = false;
  }
  const count = {};
  function take(kind) {
    const i = count[kind]++, p = pools[kind]; let o = p[i];
    if (!o) { o = make[kind](); p.push(o); root.add(o); }
    o.visible = true; return o;
  }
  function pose(T, t) {
    for (const k of Object.keys(pools)) count[k] = 0;
    for (const it of v3.items) {
      const r = it.d / 2, a = it.a === undefined ? 1 : it.a;
      if (it.k === 'hole') {
        const o = take('hole'), u = o.userData, rr = r * 1.0; o.position.set(it.x, 0, it.y); o.scale.setScalar(rr);
        u.d.material = W.holeMat(T); u.c.material = it.hot ? W.hotMat() : W.brassMat(); u.c.scale.setScalar(1.0);
      } else if (it.k === 'peg') {
        const o = take('peg'), u = o.userData, rp = r * 0.94 * it.scale, op = clamp((1 - it.dim) * (it.ghost ? 0.55 : 1) * a, 0.1, 1);
        o.position.set(it.x, it.lift * it.d * 0.22, it.y); o.scale.setScalar(rp);
        u.body.material = W.pegMat(it.digit, op); u.decal.material = W.decalMat(it.digit, String(it.digit), op); u.body.castShadow = op > 0.9;
        u.ring.visible = Boolean(it.ring); if (it.ring) { u.ring.material = W.ringMat(it.ring); u.ring.scale.setScalar(1.17 / 0.94 * 0.94); }
      } else if (it.k === 'lid') {
        const o = take('lid'), u = o.userData, op = clamp(a * (1 - Math.max(0, (it.open - 0.7) / 0.3)), 0.05, 1);
        o.position.set(it.x, it.open * it.d * 0.7, it.y); o.scale.setScalar(r * 0.98); o.rotation.set(0, 0, -it.open * 1.45);
        u.body.material = W.lidMat(op); u.decal.material = W.decalMat(0, '?', op);
      } else if (it.k === 'pip') {
        const kind = it.kind === 'bull' ? 'bull' : it.kind === 'cow' ? 'cow' : 'none', o = take(kind), ps = r * 0.95 * clamp(it.pop, 0.02, 1.3);
        o.position.set(it.x, 0, it.y); o.scale.setScalar(ps);
      }
    }
    for (const k of Object.keys(pools)) for (let i = count[k]; i < pools[k].length; i++) pools[k][i].visible = false;
    void t;
  }

  let game = null, lost = false, lastNow = 0, clock = 0, fadeIn = 0, frameAvg = 16, slowFrames = 0, loseExt = null;
  function pre() { /* the 2D layer collects items while it renders; everything is drawn in post() */ }
  function post() {
    if (!game || lost) return;
    const now = performance.now(), dt = clamp((now - (lastNow || now)) / 1000, 0, 0.1); lastNow = now; clock += dt;
    if (fadeIn < 1) { fadeIn = Math.min(1, fadeIn + dt / 0.45); v3.fade = fadeIn; }
    if (!v3.items || !v3.look) { canvas.style.visibility = 'hidden'; return; }
    canvas.style.visibility = 'visible';
    const T = v3.look; setLook(T);
    const { cx, cz } = place(), S = game.getState(), calm = S.prefs && S.prefs.calm, sway = calm ? 0 : Math.sin(clock * 0.35) * (v3.scene === 'title' ? 160 : 60);
    key.position.set(cx - 650 + sway, 1500, cz - 560); key.target.position.set(cx, 0, cz); key.target.updateMatrixWorld();
    setSlabs(T); pose(T, clock);
    renderer.setSize(cssW(), cssH(), false); renderer.render(scene, cam);
    const ft = dt * 1000; if (ft > 0) frameAvg = frameAvg * 0.95 + ft * 0.05;
    if (frameAvg > 26 && tier < 2) { if (++slowFrames > 90) { tier++; slowFrames = 0; frameAvg = 16; applyTier(); } } else slowFrames = 0;
  }

  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; v3.on = false; v3.items = null; canvas.style.visibility = 'hidden'; });
  canvas.addEventListener('webglcontextrestored', () => {
    lost = false; W.dropMats(); W.refreshDigits(); B.disposeMaterialCache(); try { env.rebuild(); } catch { /* no IBL */ }
    lookKey = ''; fadeIn = 0; v3.fade = 0; v3.on = true; applyTier();
    scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => { if (m && m.isMaterial) { m.needsUpdate = true; for (const k of ['map', 'bumpMap']) if (m[k]) m[k].needsUpdate = true; } }); });
  });
  // the numerals use the Fredoka face: redraw them once it is available
  if (document.fonts && document.fonts.load) document.fonts.load('700 100px Fredoka').then(() => W.refreshDigits()).catch(() => {});

  await tick();
  return {
    ok: true, renderer, scene,
    attach(g) { game = g; v3.on = true; v3.fade = 0; fadeIn = 0; },
    pre, post,
    get tier() { return TIERS[tier].name; },
    loseContext() { const e = renderer.getContext().getExtension('WEBGL_lose_context'); e?.loseContext(); loseExt = e; return Boolean(e); },
    restoreContext() { loseExt?.restoreContext(); },
  };
}
