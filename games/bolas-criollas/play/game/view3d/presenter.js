// Bolas Criollas 3D presenter. It READS the game state (game.getState()) and never writes it. One WebGL canvas sits behind the kit's
// transparent 2D canvas; the 2D layer draws the HUD and two framed "windows" (the whole-cancha strip and the loupe) that this file fills
// with the same lit scene seen through two cameras whose numbers come from src/proj.js, so every overlay lines up exactly.
//
// Scene: a packed-earth cancha with a painted wooden border at dusk, glossy marbled-resin bolas and a small mingo, palms, bunting, string
// lights, village houses, onlookers (crowd3d). Menus use a low hero camera on the same scene with the attract game rolling.
// Fallbacks: no WebGL / context lost -> v3.on = false and every screen draws with the flat 2D art; context restored -> back to 3D.
import * as THREE from '../vendor3d/three.js';
import * as B from '../vendor3d/board3d.js';
import { buildScenery } from '../vendor3d/scenery3d.js';
import { createCrowd3d } from '../vendor3d/crowd3d.js';
import { v3 } from '../src/v3.js';
import { layoutFor } from '../src/layout.js';
import { R_BALL, R_MINGO } from '../src/sim.js';
import { stripView, loupeView } from '../src/view.js';
import { COURT, buildGround, repaintGround, buildBoards, buildBall, buildPalm, buildBunting, buildLightString, buildHouse, softTexture } from './models.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const gust = (t, k = 0) => 0.5 + 0.5 * Math.sin(t * 0.7 + k) * Math.sin(t * 0.23 + k * 2.1);
const TIERS = [
  { name: 'high', dpr: 2, shadow: 2048, crowd: 'high', people: 34, fx: true, scenery: 'medium' },
  { name: 'medium', dpr: 1.5, shadow: 1024, crowd: 'medium', people: 22, fx: true, scenery: 'low' },
  { name: 'low', dpr: 1, shadow: 0, crowd: 'low', people: 12, fx: false, scenery: 'low' },
];
const PAGES = new Set(['howto', 'about', 'rules']);

export async function createPresenter({ kitCanvas, quality = 'high' }) {
  const noop = { wrap: (g) => g, ok: false };
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100dvh;display:block;pointer-events:none;z-index:0';
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: false }); }
  catch (e) { console.warn('WebGL unavailable; 2D fallback', e); return noop; }
  kitCanvas.parentElement.insertBefore(canvas, kitCanvas);
  kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.setClearColor(0x2a1d3c, 1);
  const qs = new URLSearchParams(location.search);
  let tier = Math.max(0, TIERS.findIndex((t) => t.name === quality));
  if (qs.has('tier')) tier = clamp(Number(qs.get('tier')), 0, TIERS.length - 1);

  // ---------------------------------------------------------------- scene and lights
  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 260);
  cam.rotation.order = 'YXZ';
  const rig = B.lightingRig(scene, 'duskOutdoor', {
    renderer, shadow: TIERS[tier].shadow, extent: 11, target: [8, 0, 0], fog: { near: 40, far: 150 },
    overrides: { bg: 0x2b2147, fog: 0xa9708a, key: 0xffb26a, keyI: 2.9, keyPos: [-7, 5.5, 6], hemi: 0.62, hemiSky: 0xffc8a8, hemiGround: 0x4a3030, fill: 0x8aa0ff, fillI: 0.55, fillPos: [8, 4, 8], rim: 0xa7b6ff, rimI: 1.4, rimPos: [10, 6, -12], exposure: 1.0, env: 0.5 },
  });
  B.createEnvironment(renderer, scene, { intensity: 0.5 });
  const glowTex = softTexture('255,255,255', 0.95), ringTex = softTexture('255,255,255', 0.95, 128, true), dustTex = softTexture('255,255,255', 0.8, 64);
  const flat = new THREE.PlaneGeometry(1, 1); flat.rotateX(-Math.PI / 2);

  // distant world from the shared scenery kit: dusk sky, coastal hills, village rows (the cancha ground and plaza are ours)
  let scenery = null;
  try {
    scenery = buildScenery({
      layers: [
        { t: 'sky', id: 'sky-rose' }, { t: 'backdrop', id: 'bd-beach' },
        { t: 'band', id: 'band-village-row', r: 38, h: 14, arc: [-168, -112] }, { t: 'band', id: 'band-village-row', r: 40, h: 14, arc: [-68, -12] },
        { t: 'band', id: 'band-hills-green', r: 70, h: 22, arc: [-175, -5] },
        { t: 'cutouts', id: 'tr-round-tree', count: 5, r: [34, 52], scale: [7, 10], seed: 5, sway: 0.3, arc: [-165, -15] },
      ],
      timeOfDay: 'dusk', quality: TIERS[tier].scenery, wind: 0.6, clouds: 0.5, seed: 4, radius: 150,
    });
    scenery.group.position.set(8, -0.04, 0); scene.add(scenery.group);
    scenery.ready.catch((e) => console.warn('scenery failed', e));
  } catch (e) { console.warn('scenery unavailable', e); scenery = null; }

  // ---------------------------------------------------------------- the plaza ground (swept earth, fine grain) and the cancha
  {
    const c = document.createElement('canvas'); c.width = c.height = 512; const x = c.getContext('2d');
    x.fillStyle = '#5a4640'; x.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 5200; i++) { const a = hash(i + 3), b = hash(i + 91), l = hash(i + 7) < 0.5; x.fillStyle = l ? `rgba(190,150,120,${0.12 + hash(i) * 0.2})` : `rgba(30,18,16,${0.15 + hash(i + 5) * 0.25})`; x.fillRect(a * 512, b * 512, 1 + hash(i + 11) * 3, 1 + hash(i + 13) * 2); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(70, 50); t.anisotropy = 8;
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(140, 100), new THREE.MeshStandardMaterial({ map: t, roughness: 1, envMapIntensity: 0.3 }));
    pl.rotation.x = -Math.PI / 2; pl.position.set(8, -0.03, -20); pl.receiveShadow = true; scene.add(pl);
  }
  const ground = buildGround({ patches: [] }); scene.add(ground);
  scene.add(buildBoards());
  

  // palms (trunk + crown of fronds), houses, posts with bunting and string lights
  const palms = [];
  for (const [x, z, h, s] of [[-3.6, -3.8, 7.5, 1], [4.8, -4.6, 8.4, 2], [11.5, -4.2, 6.8, 3], [18.8, -3.6, 8.0, 4], [-6.5, 2.5, 6.6, 5], [20.5, 3.4, 7.4, 6]]) {
    const p = buildPalm(h, s, 0.5 * (s % 2 ? 1 : -1)); p.position.set(x, 0, z); p.rotation.y = s * 1.3; scene.add(p); palms.push(p);
  }
  [[-9, -13, 6, 4, 3.4, '#e6b866', '#8a3a28'], [-1.5, -15, 5, 5, 3.9, '#5fb8ae', '#6a3020'], [6, -14, 7, 4.4, 3.0, '#e2877a', '#7a3a2a'], [14, -16, 5.5, 4.4, 4.2, '#f2e0b0', '#8a3a28'], [22, -13.5, 6.5, 4, 3.2, '#9cc27a', '#6a3020'], [29, -15, 5, 4, 3.6, '#e8a05c', '#7a3a2a']]
    .forEach(([x, z, w, d, h, wall, roof], i) => { const g = buildHouse(w, d, h, wall, roof, i); g.position.set(x, 0, z); scene.add(g); });
  const poleMat = new THREE.MeshStandardMaterial({ color: '#4a2a18', roughness: 0.9 });
  const lights = [], bunting = [];
  const pole = (x, z, h) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, h, 8), poleMat); m.position.set(x, h / 2, z); m.castShadow = true; scene.add(m); };
  pole(-1.8, -3.2, 4.0); pole(8, -3.4, 4.2); pole(17.8, -3.2, 4.0);
  const V3 = THREE.Vector3;
  const bt1 = buildBunting(new V3(-1.8, 3.95, -3.2), new V3(8, 4.15, -3.4), 18, 0.55, 3); scene.add(bt1); bunting.push(bt1);
  const bt2 = buildBunting(new V3(8, 4.15, -3.4), new V3(17.8, 3.95, -3.2), 18, 0.55, 8); scene.add(bt2); bunting.push(bt2);
  const ls1 = buildLightString(new V3(-1.8, 3.7, -3.2), new V3(8, 3.9, -3.4), 14, 0.7, glowTex, 3); scene.add(ls1); lights.push(ls1);
  const ls2 = buildLightString(new V3(8, 3.9, -3.4), new V3(17.8, 3.7, -3.2), 14, 0.7, glowTex, 6); scene.add(ls2); lights.push(ls2);
  const warm = new THREE.PointLight(0xffb870, 6, 16, 1.6); warm.position.set(8, 3.4, -2.4); scene.add(warm);

  // onlookers: real 3D people (crowd3d) standing behind the far border
  let crowd = null;
  function makeCrowd() {
    if (crowd) { try { crowd.dispose(); } catch { /* ignore */ } crowd = null; }
    try {
      crowd = createCrowd3d({ scene, camera: cam, renderer }, {
        free: { area: [-2.5, -6.8, 17.5, -4.3], y: 0, count: TIERS[tier].people, face: [8, 0, 0], walkers: 0 },
        count: TIERS[tier].people, seed: 29, culture: 'latin_american', quality: TIERS[tier].crowd, props: { flag: 0, phone: 0.1, child: 0.08 }, excitement: 0.25, viewportHeight: 800,
      });
    } catch (e) { console.warn('crowd unavailable', e); crowd = null; }
  }
  makeCrowd();

  // ---------------------------------------------------------------- balls
  const NB = 10;
  const blobMat = () => new THREE.MeshBasicMaterial({ map: glowTex, color: 0x000000, transparent: true, depthWrite: false, opacity: 0.55 });
  const makeEntry = (team, kind) => {
    const r = kind === 'mingo' ? R_MINGO : R_BALL, m = buildBall(team, kind, r), blob = new THREE.Mesh(flat, blobMat());
    blob.renderOrder = 2; blob.position.y = 0.006; blob.visible = false; m.visible = false; scene.add(m, blob);
    return { m, blob, r, px: 0, pz: 0, inited: false, keep: false };
  };
  const ballsByTeam = [[], []];
  for (let i = 0; i < NB; i++) { ballsByTeam[0].push(makeEntry(0, 'ball')); ballsByTeam[1].push(makeEntry(1, 'ball')); }
  const mingos = [makeEntry(0, 'mingo'), makeEntry(0, 'mingo'), makeEntry(0, 'mingo')];
  const heroProps = [makeEntry(0, 'ball'), makeEntry(1, 'ball'), makeEntry(0, 'ball'), makeEntry(1, 'ball'), makeEntry(0, 'mingo')];
  const _q = new THREE.Quaternion(), _ax = new THREE.Vector3();
  function placeBall(e, x, y, z, o = {}) {
    const m = e.m;
    m.visible = true; m.position.set(x, z, y);
    const s = o.scale ?? 1; m.scale.setScalar(s);
    if (e.inited && !o.noRoll) {
      const dx = x - e.px, dz = y - e.pz, d = Math.hypot(dx, dz);
      if (d < 1.4 && d > 1e-5) { _ax.set(dz, 0, -dx).normalize(); _q.setFromAxisAngle(_ax, d / e.r); m.quaternion.premultiply(_q); }
    } else if (!e.inited) { m.rotation.set(hash(x * 7 + y) * TAU, hash(y * 3 + 1) * TAU, hash(x + 5) * TAU); }
    e.px = x; e.pz = y; e.inited = true;
    const h = Math.max(0, z - e.r);
    e.blob.visible = true; e.blob.position.set(x, 0.006, y);
    e.blob.scale.setScalar(e.r * (2.6 + h * 1.4) * s); e.blob.material.opacity = (0.62 / (1 + h * 3.2)) * s;
  }
  const hideBalls = () => {
    for (const e of [...ballsByTeam[0], ...ballsByTeam[1], ...mingos, ...heroProps]) { e.m.visible = false; e.blob.visible = false; if (!e.keep) e.inited = false; }
  };

  // ---------------------------------------------------------------- aim marks, flight dots, sprites
  const mark = (tx, color, op = 0.9) => { const m = new THREE.Mesh(flat, new THREE.MeshBasicMaterial({ map: tx, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: op, fog: false })); m.renderOrder = 4; m.visible = false; scene.add(m); return m; };
  const aimOuter = mark(ringTex, 0xffffff), aimInner = mark(ringTex, 0xff7a4d), aimGlow = mark(glowTex, 0xffd9a0, 0.5), restRing = mark(ringTex, 0xffffff, 0.8);
  const heldGlow = mark(ringTex, 0xffe9a0, 0.8);
  const dotMat = new THREE.SpriteMaterial({ map: glowTex, color: 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, opacity: 0.95 });
  const dots = []; for (let i = 0; i < 90; i++) { const s = new THREE.Sprite(dotMat); s.visible = false; s.scale.setScalar(0.07); s.renderOrder = 5; scene.add(s); dots.push(s); }
  const ripples = []; for (let i = 0; i < 6; i++) ripples.push({ m: mark(ringTex, 0xfff0c8, 0.9), t: 9, x: 0, z: 0 });
  const NS = 120;
  const sprites = []; for (let i = 0; i < NS; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: dustTex, color: 0xdcb58a, transparent: true, depthWrite: false, opacity: 0, fog: true }));
    s.visible = false; s.renderOrder = 6; scene.add(s); sprites.push(s);
  }
  const trail = [];   // presentation-only puffs behind a fast rolling ball
  let trailAcc = 0;

  // ---------------------------------------------------------------- cameras and drawing
  let W = 1, H = 1, dprNow = 1, clock = 0, lastT = 0, frames = 0, ema = 16;
  function setCam(c) {
    cam.rotation.set(-c.pitch, 0, 0); cam.fov = c.fovDeg; cam.aspect = c.aspect; cam.position.set(c.x, c.y, c.z); cam.updateProjectionMatrix(); cam.updateMatrixWorld();
  }
  function aimLight(x, z, ext) {
    rig.key.target.position.set(x, 0, z); rig.key.position.set(x - 7, 5.5, z + 6);
    const s = rig.key.shadow.camera; if (s.right !== ext) { s.left = -ext; s.right = ext; s.top = ext; s.bottom = -ext; s.updateProjectionMatrix(); }
    rig.key.target.updateMatrixWorld();
  }
  function drawView(rectCss, c, ext, fx, fz) {
    aimLight(fx, fz, ext); setCam(c);
    const x = Math.round(rectCss.x), y = Math.round(H - (rectCss.y + rectCss.h)), w = Math.round(rectCss.w), h = Math.round(rectCss.h);
    renderer.setViewport(x, y, w, h); renderer.setScissor(x, y, w, h); renderer.setScissorTest(true);
    renderer.render(scene, cam);
  }
  const HP = (qs.get('hero') || '').split('_').map(Number);
  const heroPose = (aspect, t, calm) => {
    const portrait = aspect < 1.2, sw = calm ? 0 : 1;
    if (HP.length >= 7 && HP.every((v) => Number.isFinite(v))) return { x: HP[0], y: HP[1], z: HP[2], aim: [HP[3], HP[4], HP[5]], fovDeg: HP[6], aspect };
    return { x: -1.0 + 0.2 * Math.sin(t * 0.16) * sw, y: 0.7 + 0.05 * Math.sin(t * 0.31) * sw, z: 1.1 + 0.18 * Math.sin(t * 0.12) * sw, aim: [7, 0.5, -0.4], fovDeg: portrait ? 62 : 40, aspect };
  };
  function drawHero(t, calm) {
    const h = heroPose(W / H, t, calm);
    aimLight(8, 0, 11);
    cam.rotation.set(0, 0, 0); cam.fov = h.fovDeg; cam.aspect = h.aspect; cam.position.set(h.x, h.y, h.z); cam.lookAt(h.aim[0], h.aim[1], h.aim[2]); cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    renderer.setScissorTest(false); renderer.setViewport(0, 0, W, H);
    renderer.render(scene, cam);
  }

  // ---------------------------------------------------------------- frame
  let lastPhase = '';
  const seenBurst = { t: -1 };
  function ambient(calm) {
    const t = clock, wind = calm ? 0.3 : gust(t, 0);
    for (const p of palms) for (const h of p.userData.fronds) { const u = h.userData; u.f.rotation.x = u.base + (calm ? 0 : Math.sin(t * 1.2 + u.ph) * u.amp * (0.6 + wind * 1.6)); h.rotation.z = calm ? 0 : Math.cos(t * 0.8 + u.ph) * u.amp * 0.6; }
    for (const b of bunting) for (const f of b.userData.flags) { f.rotation.x = calm ? 0 : Math.sin(t * 2.1 + f.userData.ph) * (0.18 + 0.3 * wind); f.rotation.y = calm ? 0 : Math.sin(t * 1.4 + f.userData.ph * 1.7) * 0.25 * (0.5 + wind); }
    for (const l of lights) for (const b of l.userData.bulbs) b.s.material.opacity = 0.62 + (calm ? 0.1 : 0.25 * (0.5 + 0.5 * Math.sin(t * 2.3 + b.ph)));
    warm.intensity = 6 * (0.92 + (calm ? 0 : 0.08 * Math.sin(t * 3.7)));
  }
  function present(state, L, dt) {
    const sc = state.scene, calm = !!(state.settings && state.settings.calm);
    const inPlay = sc === 'play' && state.w;
    const world = inPlay ? state.w : state.att ? state.att.w : null;
    const parts = inPlay ? state.parts : state.att ? state.att.parts : [];
    if (world) repaintGround(ground, world.surf);
    hideBalls();
    let held = false;
    if (world) {
      const used = [0, 0]; let mi = 0;
      for (const b of world.balls) {
        if (b.st === 'out' && b.fade >= 0.5) continue;
        const fadeK = b.st === 'out' ? Math.max(0.001, 1 - b.fade * 2) : 1;
        if (b.k) placeBall(mingos[Math.min(mi++, mingos.length - 2)], b.x, b.y, b.z, { scale: fadeK });
        else { const team = b.side === 1 ? 1 : 0; placeBall(ballsByTeam[team][Math.min(used[team]++, NB - 2)], b.x, b.y, b.z, { scale: fadeK }); }
        const sp = Math.hypot(b.vx, b.vy);
        if (b.st !== 'out' && sp > 2.0 && b.z <= b.r + 0.02 && TIERS[tier].fx && trail.length < 40 && !state.paused) {
          trailAcc += dt * sp;
          if (trailAcc > 0.3) { trailAcc = 0; trail.push({ x: b.x - (b.vx / sp) * 0.12, y: b.y - (b.vy / sp) * 0.12, z: 0.03, t: 0, max: 0.7, s: 0.12 + sp * 0.012 }); }
        }
      }
      if (inPlay && state.m && (state.m.phase === 'aim' || state.m.phase === 'mingo') && !state.paused) {
        const mg = state.m.phase === 'mingo', e = mg ? mingos[mingos.length - 1] : ballsByTeam[state.m.turn === 1 ? 1 : 0][NB - 1];
        held = true;
        placeBall(e, -0.05, 0, (mg ? R_MINGO : R_BALL) + 0.015 + 0.012 * Math.sin(clock * 2.4), { noRoll: true });
        e.m.rotation.y += dt * 0.6;
        heldGlow.visible = true; heldGlow.position.set(-0.05, 0.014, 0); heldGlow.scale.setScalar(0.5 + 0.04 * Math.sin(clock * 4)); heldGlow.material.opacity = 0.5 + 0.3 * Math.sin(clock * 3);
      }
    }
    if (!held) heldGlow.visible = false;
    if (!inPlay) {
      [[0.35, 0.62], [0.85, -0.38], [1.55, 0.3], [2.4, -0.22], [3.4, 0.08]].forEach(([x, z], i) => {
        const e = heroProps[i]; e.keep = true; placeBall(e, x, z, e.r + 0.001, { noRoll: true });
        if (!e.set) { e.set = true; e.m.rotation.set(hash(i + 1) * TAU, hash(i + 9) * TAU, hash(i + 4) * TAU); }
      });
    }
    // ---- aim marks and the dotted flight
    const g = inPlay ? state.guide : null, pv = inPlay ? state.preview : null;
    const showAim = !!g && state.humanTurn && !state.paused;
    for (const m of [aimOuter, aimInner, aimGlow]) m.visible = showAim;
    restRing.visible = false;
    dots.forEach((d) => { d.visible = false; });
    if (showAim) {
      const pulse = 0.5 + 0.5 * Math.sin(clock * 6);
      aimOuter.position.set(g.tx, 0.02, g.ty); aimOuter.scale.setScalar(0.5 + pulse * 0.03); aimOuter.material.opacity = 0.45 + 0.25 * pulse;
      aimInner.position.set(g.tx, 0.021, g.ty); aimInner.scale.setScalar(0.27); aimInner.material.opacity = 0.7;
      aimGlow.position.set(g.tx, 0.018, g.ty); aimGlow.scale.setScalar(0.9); aimGlow.material.opacity = 0.1 + 0.08 * pulse;
      if (pv && pv.path.length > 1 && !(state.settings && state.settings.calm)) {
        let n = 0;
        for (let i = 0; i < pv.path.length && n < dots.length; i++) { const p = pv.path[i], d = dots[n++]; d.visible = true; d.position.set(p.x, Math.max(0.03, p.z), p.y); d.scale.setScalar(i % 3 === 0 ? 0.085 : 0.06); }
      }
      if (pv && pv.rest && !pv.rest.out && Math.hypot(pv.rest.x - g.tx, pv.rest.y - g.ty) > 0.08) { restRing.visible = true; restRing.position.set(pv.rest.x, 0.02, pv.rest.y); restRing.scale.setScalar(0.36); restRing.material.opacity = 0.55 + 0.3 * pulse; }
    }
    // ---- sim particles + our own trail puffs
    let si = 0;
    for (const p of parts) {
      if (si >= NS) break;
      const s = sprites[si++], a = Math.max(0, 1 - p.t / p.max);
      s.visible = true; s.position.set(p.x, Math.max(0.02, p.z), p.y);
      if (p.kind === 1) { s.material.color.setHex(0xfff0b8); s.material.blending = THREE.AdditiveBlending; s.material.opacity = a; s.scale.setScalar(0.07 + 0.05 * a); }
      else {
        const col = p.col ? p.col.split(',').map(Number) : [226, 184, 134];
        s.material.color.setRGB(col[0] / 255, col[1] / 255, col[2] / 255); s.material.blending = THREE.NormalBlending; s.material.opacity = a * 0.55; s.scale.setScalar((0.16 + p.size * 0.08) * (1 + p.t * 2.6));
      }
      if (p.kind === 1 && p.t < 0.03 && seenBurst.t !== Math.round(clock * 20)) { seenBurst.t = Math.round(clock * 20); const r = ripples.find((q) => q.t > 0.6); if (r) { r.t = 0; r.x = p.x; r.z = p.y; } }
    }
    for (let i = trail.length - 1; i >= 0; i--) {
      const q = trail[i]; q.t += dt; if (q.t >= q.max) { trail.splice(i, 1); continue; }
      if (si >= NS) continue;
      const s = sprites[si++], a = 1 - q.t / q.max;
      s.visible = true; s.position.set(q.x, q.z + q.t * 0.12, q.y); s.material.color.setHex(0xd8b184); s.material.blending = THREE.NormalBlending; s.material.opacity = a * 0.35; s.scale.setScalar(q.s * (1 + q.t * 2.2));
    }
    for (; si < NS; si++) sprites[si].visible = false;
    for (const r of ripples) { r.t += dt; if (r.t < 0.6) { r.m.visible = true; r.m.position.set(r.x, 0.022, r.z); r.m.scale.setScalar(0.25 + r.t * 1.6); r.m.material.opacity = 0.8 * (1 - r.t / 0.6); } else r.m.visible = false; }

    // ---- the onlookers react when an end is scored or the match is won
    if (crowd && state.m) {
      const ph = state.m.phase;
      if (ph === 'score' && lastPhase !== 'score') crowd.react('cheer', { intensity: 0.7, origin: [8, 0, -3], radius: 40 });
      if (ph === 'over' && lastPhase !== 'over') crowd.react('ovation', { intensity: 1, origin: [8, 0, -3], radius: 40 });
      lastPhase = ph;
    }
    ambient(calm);
    if (scenery) scenery.update(calm ? 0 : dt, cam);
    if (PAGES.has(sc)) return;   // reader pages sit on a plain night backdrop: no 3D this frame
    // ---- draw
    const k = W / L.w, css = (r) => ({ x: r.x * k, y: r.y * k, w: r.w * k, h: r.h * k });
    if (inPlay && state.m) {
      const P = L.play, sv = stripView(P.strip), lv = loupeView(P.loupe, state.loupe.uc, state.loupe.half);
      if (crowd) crowd.update(state.paused ? 0 : dt, cam);
      drawView(css(P.strip), sv.cam, 11, COURT.len / 2, 0);
      drawView(css(P.loupe), lv.cam, 4.2, clamp(state.loupe.uc, 1, 15), 0);
    } else {
      if (crowd) crowd.update(dt, cam);
      drawHero(clock, calm);
    }
  }

  function prepare() {
    const w = Math.max(1, Math.floor(window.innerWidth)), h = Math.max(1, Math.floor(window.innerHeight));
    const dpr = Math.min(window.devicePixelRatio || 1, TIERS[tier].dpr);
    if (w !== W || h !== H || dpr !== dprNow) { W = w; H = h; dprNow = dpr; renderer.setPixelRatio(dpr); renderer.setSize(w, h, false); }
  }
  function applyTier() {
    const t = TIERS[tier];
    renderer.shadowMap.enabled = t.shadow > 0; rig.key.castShadow = t.shadow > 0;
    if (t.shadow) { rig.key.shadow.mapSize.set(t.shadow, t.shadow); if (rig.key.shadow.map) { rig.key.shadow.map.dispose(); rig.key.shadow.map = null; } }
    W = 0;
    scene.traverse((o) => { if (o.material) for (const m of [].concat(o.material)) m.needsUpdate = true; });
    if (crowd) crowd.setQuality(t.crowd);
  }

  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); v3.on = false; });
  canvas.addEventListener('webglcontextrestored', () => { W = 0; applyTier(); v3.on = true; });   // B.createEnvironment rebuilds scene.environment itself

  try { applyTier(); }
  catch (e) { console.warn('3D init failed; 2D fallback', e); canvas.remove(); v3.on = false; return noop; }
  v3.on = true;

  return {
    ok: true, renderer, scene, camera: cam, rig, canvas, get tier() { return tier; }, setTier(t) { tier = clamp(t, 0, TIERS.length - 1); applyTier(); makeCrowd(); },
    wrap(game) {
      return Object.assign({}, game, {
        render(ctx, view) {
          const state = game.getState();
          if (!v3.on) { game.render(ctx, view); return; }
          const L = layoutFor(view?.width ?? 720, view?.height ?? 1560);
          const now = performance.now(), dt = Math.min(0.1, Math.max(0, (now - lastT) / 1000)); lastT = now; clock += dt;
          ema = ema * 0.95 + dt * 1000 * 0.05; frames++;
          if (frames > 90 && ema > 30 && tier < TIERS.length - 1) { tier++; applyTier(); makeCrowd(); frames = 0; ema = 16; }
          v3.scene = state.scene;
          game.render(ctx, view);
          try { prepare(); present(state, L, dt); } catch (e) { console.warn('3D present failed', e); v3.on = false; }
        },
      });
    },
  };
}
