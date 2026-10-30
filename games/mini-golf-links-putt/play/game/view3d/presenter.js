// Mini Golf 3D presenter. READS what the 2D layer asked for this frame (src/v3.js `want`), never writes game state. One WebGL canvas sits
// behind the kit's transparent 2D canvas. The camera is orthographic and tilted, built from the very numbers the 2D layer uses for taps
// and the aim guide (src/v3.js makeCam3), so a touch lands exactly where the 3D ground is. No WebGL, ?flat=1 or a lost context:
// v3.on = false and every screen draws the flat 2D art; a restored context rebuilds the scene and returns to 3D.
import * as THREE from '../vendor3d/three.js';
import { v3, TILT } from '../src/v3.js';
import { meta } from '../src/game.js';
import { compileHole, moversAt, BR } from '../src/sim.js';
import { themeOf, BALL_COLORS, paintGround } from '../src/view.js';
import { COURSE_BY_ID } from '../src/courses.js';
import { makeMaterials, buildHole, groundPlane, seaRipples, disposeTextures } from './world.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const TIERS = [{ name: 'high', dpr: 2, shadow: 2048, tex: 1536 }, { name: 'medium', dpr: 1.5, shadow: 1024, tex: 1024 }, { name: 'low', dpr: 1, shadow: 0, tex: 768 }];
const tick = () => new Promise((r) => setTimeout(r, 0));
const LIGHTS = {
  heather: { sky: 0xb9a8e8, gnd: 0x2c4a2a, sunC: 0xffd9b0, sunI: 2.6, hemI: 1.0 },
  harbour: { sky: 0xcfe6ff, gnd: 0x1d4a64, sunC: 0xfff2dc, sunI: 2.9, hemI: 1.15 },
  mill: { sky: 0xffe7b0, gnd: 0x5a4a1a, sunC: 0xffc878, sunI: 3.0, hemI: 1.0 },
};

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
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  let tier = qs.has('tier') ? clamp(Number(qs.get('tier')), 0, 2) : (navigator.hardwareConcurrency || 8) <= 4 ? 1 : 0;

  await tick();
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 700);
  let mats = makeMaterials();
  const hemi = new THREE.HemisphereLight(0xffffff, 0x445544, 1), sun = new THREE.DirectionalLight(0xffffff, 2.5);
  sun.position.set(-26, 44, 22); sun.castShadow = true; sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.04;
  scene.add(hemi, sun, sun.target);
  const buildEnv = () => { try { const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture; pm.dispose(); scene.environmentIntensity = 0.35; } catch { /* no IBL */ } };
  buildEnv();
  await tick();

  // ---- balls: a glossy sphere with two dots on opposite sides so the roll reads
  const ballGeo = new THREE.SphereGeometry(BR, 28, 20), dotGeo = new THREE.CircleGeometry(BR * 0.3, 16);
  const balls = BALL_COLORS.map((c) => {
    const m = new THREE.Mesh(ballGeo, new THREE.MeshStandardMaterial({ color: c.base, roughness: 0.22, metalness: 0.05, transparent: true }));
    for (const sg of [1, -1]) { const d = new THREE.Mesh(dotGeo, new THREE.MeshStandardMaterial({ color: c.dot, roughness: 0.4 })); d.position.set(sg * BR * 0.985, 0, 0); d.rotation.y = sg * Math.PI / 2; m.add(d); }
    m.castShadow = true; m.visible = false; return m;
  });

  // ---- the hole cache (a few holes stay built; the table is shared)
  const world = new THREE.Group(); scene.add(world);
  balls.forEach((m) => world.add(m));
  const table = { feel: '', ground: null, sea: null };
  const cache = new Map(); let cur = null, curKey = '';
  function setHole(def) {
    const key = `${def.id}|${TIERS[tier].tex}`; if (key === curKey) return;
    let e = cache.get(key);
    if (!e) {
      const h = compileHole(def), feel = COURSE_BY_ID[def.course].feel, th = themeOf(def.course);
      e = buildHole({ def, h, theme: th, feel, mats, paint: (ctx) => paintGround(ctx, h, th), texSize: TIERS[tier].tex, quality: TIERS[tier].name });
      e.feel = feel; e.h = h; cache.set(key, e);
      if (cache.size > 5) { const k = cache.keys().next().value; const old = cache.get(k); if (old !== cur) { old.dispose(); cache.delete(k); } }
    }
    if (cur) world.remove(cur.group);
    cur = e; curKey = key; world.add(e.group);
    if (table.feel !== e.feel) setFeel(e.feel);
    const L = LIGHTS[e.feel] ?? LIGHTS.heather;
    hemi.color.set(L.sky); hemi.groundColor.set(L.gnd); hemi.intensity = L.hemI; sun.color.set(L.sunC); sun.intensity = L.sunI;
    const ext = e.span * 0.5 + 7;
    Object.assign(sun.shadow.camera, { left: -ext, right: ext, top: ext, bottom: -ext, near: 1, far: 140 });
    sun.shadow.camera.updateProjectionMatrix();
  }
  function setFeel(feel) {
    if (table.ground) { world.remove(table.ground); table.ground.geometry.dispose(); }
    if (table.sea) { world.remove(table.sea); table.sea.geometry.dispose(); table.sea = null; }
    table.ground = groundPlane(feel); world.add(table.ground);
    if (feel === 'harbour') { table.sea = seaRipples(); world.add(table.sea); }
    table.feel = feel;
  }
  function applyTier() {
    const t = TIERS[tier];
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, t.dpr));
    renderer.shadowMap.enabled = t.shadow > 0; sun.castShadow = t.shadow > 0;
    if (t.shadow) { sun.shadow.mapSize.set(t.shadow, t.shadow); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } }
    scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => { if (m && m.isMaterial) m.needsUpdate = true; }); });
  }
  applyTier();

  // ---- the camera is the 2D layer's affine matrix, in virtual units
  const cssW = () => Math.max(1, window.innerWidth), cssH = () => Math.max(1, window.innerHeight);
  const cpu = () => meta.cssPerUnit || (Math.min(cssW(), cssH()) / 720);
  const offX = () => (cssW() - meta.width * cpu()) / 2, offY = () => (cssH() - meta.height * cpu()) / 2;
  function placeCamera(cam, h) {
    const c = cpu(), s = cam.s, b = h.box;
    const [U0, V0] = cam.m2s((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2);      // the hole centre sits on the world origin
    const Lv = -offX() / c, Rv = (cssW() - offX()) / c, Tv = -offY() / c, Bv = (cssH() - offY()) / c;
    camera.left = (Lv - U0) / s; camera.right = (Rv - U0) / s; camera.top = -(Tv - V0) / s; camera.bottom = -(Bv - V0) / s;
    camera.position.set(0, Math.sin(TILT) * 300, Math.cos(TILT) * 300); camera.up.set(0, Math.cos(TILT), -Math.sin(TILT)); camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
    world.rotation.y = cam.rot ? -Math.PI / 2 : 0;
  }

  // ---- per frame
  let game = null, lost = false, lastNow = 0, frameAvg = 16, slowFrames = 0, clock = 0;
  const _ax = new THREE.Vector3();
  function pre() { if (!game || lost) return; v3.want = null; }
  function post() {
    if (!game || lost) return;
    const now = performance.now(), dt = clamp((now - (lastNow || now)) / 1000, 0, 0.1); lastNow = now; clock += dt;
    const w = v3.want; if (!w) { canvas.style.visibility = 'hidden'; return; }
    canvas.style.visibility = 'visible';
    setHole(w.def);
    placeCamera(w.cam, cur.h);
    cur.update(w, moversAt, clock);
    const fo = w.near ? 0.35 : 1; for (const m of cur.flagFade) m.opacity += (fo - m.opacity) * 0.3;
    const b0 = cur.h.box, hx = (b0.x0 + b0.x1) / 2, hy = (b0.y0 + b0.y1) / 2;
    balls.forEach((m) => { m.visible = false; });
    for (const bl of w.balls) {
      const m = balls[bl.ci]; if (!m || bl.hide) continue;
      const sunk = bl.mode === 'sunk' ? Math.min(1, bl.sink / 0.5) : 0;
      m.visible = true; m.position.set(bl.x - hx, BR - sunk * BR * 2.4, bl.y - hy);
      m.scale.setScalar(1 - 0.25 * sunk);
      m.material.opacity = bl.dim ? 0.9 : 1;
      _ax.set(-Math.sin(bl.hd || 0), 0, Math.cos(bl.hd || 0)); m.quaternion.setFromAxisAngle(_ax, -(bl.rot || 0));
    }
    renderer.setSize(cssW(), cssH(), false);
    renderer.render(scene, camera);
    const ft = dt * 1000; if (ft > 0) frameAvg = frameAvg * 0.95 + ft * 0.05;
    if (frameAvg > 26 && tier < 2) { if (++slowFrames > 90) { tier++; slowFrames = 0; frameAvg = 16; rebuild(); } } else slowFrames = 0;
  }
  function rebuild() {
    for (const e of cache.values()) e.dispose(); cache.clear(); if (cur) world.remove(cur.group); cur = null; curKey = '';
    applyTier();
  }

  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; v3.on = false; canvas.style.visibility = 'hidden'; });
  canvas.addEventListener('webglcontextrestored', () => {
    lost = false; disposeTextures(); mats = makeMaterials(); for (const e of cache.values()) e.dispose(); cache.clear(); if (cur) world.remove(cur.group); cur = null; curKey = '';
    table.feel = ''; buildEnv(); applyTier(); v3.on = true; canvas.style.visibility = 'visible';
  });

  await tick();
  return {
    ok: true, renderer, scene, camera,
    attach(g) { game = g; v3.on = true; canvas.style.visibility = 'visible'; },
    pre, post,
    get tier() { return TIERS[tier].name; },
  };
}
