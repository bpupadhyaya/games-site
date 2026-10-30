// Costa Rican Painted Oxcart 3D presenter. READS what the 2D layer reports (src/v3.js), never writes game state.
// One WebGL canvas sits behind the kit's transparent 2D canvas: the lit workbench scene (planked bench, the sculpted wheel / panel /
// yoke with real painted segments, brush, rag, paint stains, dust in the lamp light) and a screen-space HUD scene (carved plaques,
// lacquered buttons, glass paint jars) drawn in the same frame. Built in slices after the flat 2D boot, then cross-faded in.
// Fallbacks: no WebGL / context lost -> v3.on = false and every screen draws with the flat 2D art; context restored -> back to 3D.
import * as THREE from '../vendor3d/three.js';
import * as B from '../vendor3d/board3d.js';
import { v3 } from '../src/v3.js';
import * as M from './models.js';
import { PAINT } from '../src/art.js';
import { PANEL_STRETCH } from '../src/layout.js';
const PAINT_HEX = Object.fromEntries(Object.entries(PAINT).map(([k, v]) => [k, v.base]));

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const TIERS = [{ name: 'high', dpr: 2, shadow: 2048 }, { name: 'medium', dpr: 1.5, shadow: 1024 }, { name: 'low', dpr: 1, shadow: 0 }];
const LOOKS3 = {
  workshop: { bg: 0x1a0d05, fog: 0x1c0f06, key: 0xffe2b0, keyI: 3.0, hemi: [0xffe6c8, 0x3a2412, 0.75], rim: 0xffa860, rimI: 1.1, lamp: 0xffb060, lampI: 9, expo: 1.05, tint: '#ffffff', env: 0.38 },
  daylight: { bg: 0x6a5a44, fog: 0x7a6a52, key: 0xfff4e2, keyI: 3.6, hemi: [0xfff6e6, 0x8a7458, 1.1], rim: 0xcfe4ff, rimI: 0.9, lamp: 0xfff0d0, lampI: 2, expo: 1.1, tint: '#ffffff', env: 0.55 },
  night: { bg: 0x070b18, fog: 0x080c1c, key: 0x8fb0ff, keyI: 1.5, hemi: [0x6a88c8, 0x1a1c30, 0.5], rim: 0x6f8fff, rimI: 1.2, lamp: 0xffa860, lampI: 11, expo: 1.0, tint: '#b8c4e8', env: 0.22 },
};

export async function createPresenter({ kitCanvas, quality = 'high', instant = false }) {
  const tick = () => new Promise((r) => setTimeout(r, 0));
  const qs = new URLSearchParams(location.search);
  const canvas = document.createElement('canvas');
  canvas.style.cssText = `position:fixed;inset:0;width:100vw;height:100dvh;display:block;pointer-events:none;z-index:0;opacity:${instant ? 1 : 0};transition:opacity .38s ease-out`;
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: !!qs.get('keep') }); } catch (e) { console.warn('WebGL unavailable; 2D fallback', e); return { ok: false }; }
  kitCanvas.parentElement.insertBefore(canvas, kitCanvas);
  kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.autoClear = false;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  let tier = Math.max(0, TIERS.findIndex((t) => t.name === quality));
  if (qs.has('tier')) tier = clamp(Number(qs.get('tier')), 0, TIERS.length - 1);
  const fail = (e) => { console.warn('3D init failed; 2D fallback', e); canvas.remove(); v3.on = false; return { ok: false }; };

  // ------------------------------------------------------------ bench scene
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.5, 220);
  scene.fog = new THREE.Fog(0x1c0f06, 16, 60);
  const hemi = new THREE.HemisphereLight(0xffe6c8, 0x3a2412, 0.75);
  const key = new THREE.DirectionalLight(0xffe2b0, 3.0); key.castShadow = true;
  key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02; key.shadow.radius = 4;
  const rim = new THREE.DirectionalLight(0xffa860, 1.1); rim.position.set(7, 5, -9);
  const fill = new THREE.DirectionalLight(0xbfd0ff, 0.35); fill.position.set(6, 4, 8);
  const lamp = new THREE.PointLight(0xffb060, 9, 22, 1.6); lamp.position.set(-3.5, 3.6, 2.5);
  scene.add(hemi, key, key.target, rim, fill, lamp);

  let tableMat;
  try {
    const pl = M.plankTextures();
    tableMat = new THREE.MeshStandardMaterial({ map: pl.map, bumpMap: pl.bump, bumpScale: 0.6, roughness: 0.62, color: 0xffffff });
  } catch (e) { return fail(e); }
  const table = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), tableMat); table.rotation.x = -Math.PI / 2; table.receiveShadow = true; scene.add(table);
  const pieceRoot = new THREE.Group(); scene.add(pieceRoot);
  // contact shadow under the piece (soft blob in addition to the shadow map)
  const blob = B.contactShadow(1.4, 0.55); blob.renderOrder = 0; scene.add(blob);
  await tick();

  // set dressing
  const props = new THREE.Group(); scene.add(props);
  const brush = M.buildBrush('#d63a2a'), rag = M.buildRag(), brush2 = M.buildBrush('#2168d4');
  const stains = [['#dc3a2c', 0.14], ['#f8c623', 0.1], ['#2168d4', 0.12], ['#1fa35d', 0.08], ['#f58a20', 0.09]].map(([c, r], i) => M.buildStain(c, r, i + 1));
  props.add(brush, rag, brush2, ...stains);
  const studs = []; for (let i = 0; i < 3; i++) { const s = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 7), M.brassMat()); s.scale.y = 0.55; s.castShadow = true; studs.push(s); props.add(s); }
  function placeProps(hx, hz, hero = false) {
    if (hero) {   // title: the tools rest at the flanks, clear of the lettering below
      brush.position.set(-hx - 0.95, 0, 0.35); brush.rotation.y = 1.2; brush.scale.setScalar(0.8);
      brush2.position.set(hx + 1.7, 0, -0.9); brush2.rotation.y = -1.0; brush2.scale.setScalar(0.7);
      rag.position.set(hx + 0.95, 0.03, 0.55); rag.rotation.y = -0.5; rag.scale.setScalar(0.8);
      [[-hx - 0.7, -0.75], [hx + 0.7, -0.15], [-hx - 0.45, 0.95], [hx + 0.5, 1.0], [-0.4, -hz - 0.7]].forEach(([x, z], i) => stains[i].position.set(x, 0.002, z));
      [[-hx - 0.3, 0.1], [hx + 0.35, 0.4], [-hx * 0.5, -hz - 0.5]].forEach(([x, z], i) => studs[i].position.set(x, 0.022, z));
      return;
    }
    brush.scale.setScalar(1); rag.scale.setScalar(1);
    const f = Math.max(hx, hz * 1.4), e = 0.9 + f * 0.1;
    brush.position.set(-hx - 0.5 - e * 0.2, 0, hz + 0.95 + e * 0.1); brush.rotation.y = 0.22;
    brush2.position.set(hx * 0.2, 0, hz + 1.65 + e * 0.1); brush2.rotation.y = -0.1; brush2.scale.setScalar(0.9);
    rag.position.set(hx + 0.7, 0.03, hz + 0.7); rag.rotation.y = -0.35;
    [[-hx * 0.55, hz + 0.65], [hx * 0.8, hz + 1.5], [-hx - 0.9, 0.2], [hx + 1.05, -hz * 0.4], [hx * 0.1, -hz - 0.8]].forEach(([x, z], i) => stains[i].position.set(x, 0.002, z));
    [[-hx * 0.3, hz + 0.45], [hx * 0.45, hz + 0.5], [-hx - 0.35, -0.4]].forEach(([x, z], i) => studs[i].position.set(x, 0.022, z));
  }
  placeProps(1, 1);
  // dust motes in the lamp light
  const N = 90, dustPos = new Float32Array(N * 3), dustV = new Float32Array(N * 3);
  const rnd = (i, k) => { const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return x - Math.floor(x); };
  for (let i = 0; i < N; i++) { dustPos[i * 3] = (rnd(i, 1) - 0.5) * 9; dustPos[i * 3 + 1] = rnd(i, 2) * 4; dustPos[i * 3 + 2] = (rnd(i, 3) - 0.5) * 7; dustV[i * 3] = (rnd(i, 4) - 0.5) * 0.06; dustV[i * 3 + 1] = 0.02 + rnd(i, 5) * 0.05; dustV[i * 3 + 2] = (rnd(i, 6) - 0.5) * 0.05; }
  const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  const dc = document.createElement('canvas'); dc.width = dc.height = 64; { const x = dc.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,236,200,1)'); g.addColorStop(1, 'rgba(255,236,200,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); }
  const dt0 = new THREE.CanvasTexture(dc);
  const dust = new THREE.Points(dg, new THREE.PointsMaterial({ map: dt0, size: 0.1, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  dust.frustumCulled = false; scene.add(dust);
  await tick();

  // ------------------------------------------------------------ HUD scene (ortho, virtual units)
  const hud = new THREE.Scene(), hudCam = new THREE.PerspectiveCamera();
  const hl = new THREE.DirectionalLight(0xfff0d8, 2.0); hl.position.set(-500, 800, 1000);
  const hf = new THREE.DirectionalLight(0xffc890, 0.5); hf.position.set(700, -300, 600);
  hud.add(new THREE.HemisphereLight(0xffe8cc, 0x2a1608, 0.8), hl, hf);
  const leather = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
    x.fillStyle = '#2d190c'; x.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 2200; i++) { x.fillStyle = i % 2 ? 'rgba(255,214,160,0.05)' : 'rgba(0,0,0,0.12)'; x.fillRect(rnd(i, 7) * 256, rnd(i, 8) * 256, 1 + rnd(i, 9) * 2.4, 1 + rnd(i, 10) * 2.4); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 2); return t;
  })();
  const mats = {
    frame: B.material('darkWood', { color: '#7a4a26', color2: '#9a6434', seed: 8, repeat: [3, 1], roughness: 0.42 }),
    trim: new THREE.MeshStandardMaterial({ color: '#d9a93a', metalness: 0.9, roughness: 0.3, envMapIntensity: 1.2 }),
    face: new THREE.MeshStandardMaterial({ map: leather, color: '#ffffff', roughness: 0.82 }),
    inset: new THREE.MeshStandardMaterial({ color: '#170c05', roughness: 0.9 }),
    insetFace: new THREE.MeshStandardMaterial({ map: leather, color: '#b8a898', roughness: 0.9 }),
    accent: new THREE.MeshPhysicalMaterial({ color: '#ffc43a', roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.1, emissive: '#7a4600', emissiveIntensity: 0.45 }),
    solid: new THREE.MeshPhysicalMaterial({ color: '#5c3519', envMapIntensity: 0.45, roughness: 0.4, clearcoat: 1, clearcoatRoughness: 0.14 }),
    active: new THREE.MeshPhysicalMaterial({ color: '#2f7d5c', envMapIntensity: 0.45, roughness: 0.34, clearcoat: 1, clearcoatRoughness: 0.12, emissive: '#0a2a1c', emissiveIntensity: 0.6 }),
    off: new THREE.MeshStandardMaterial({ color: '#2c1c10', roughness: 0.9 }),
    flash: new THREE.MeshPhysicalMaterial({ color: '#fff0c4', roughness: 0.3, clearcoat: 1, emissive: '#ffd880', emissiveIntensity: 0.7 }),
    rimTrim: new THREE.MeshStandardMaterial({ color: '#c99a2e', metalness: 0.85, roughness: 0.34, envMapIntensity: 1.2 }),
  };
  const flatQuad = new THREE.PlaneGeometry(1, 1);
  const blobTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(0,0,0,0.9)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
  const vig = new THREE.Mesh(flatQuad, (() => {
    const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d'), g = x.createRadialGradient(128, 128, 60, 128, 128, 182);
    g.addColorStop(0, 'rgba(8,3,0,0)'); g.addColorStop(1, 'rgba(8,3,0,0.62)'); x.fillStyle = g; x.fillRect(0, 0, 256, 256);
    return new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false });
  })());
  vig.position.z = -900; hud.add(vig);
  const scrim = new THREE.Mesh(flatQuad, new THREE.MeshBasicMaterial({ color: 0x060200, transparent: true, opacity: 0, depthWrite: false })); scrim.position.z = -820; hud.add(scrim);
  const geoCache = new Map();
  const slabG = (w, d, h, rad, bev) => {
    const k = `${Math.round(w)}|${Math.round(d)}|${h}|${Math.round(rad)}|${bev}`; let g = geoCache.get(k);
    if (!g) { if (geoCache.size > 160) { for (const v of geoCache.values()) v.dispose(); geoCache.clear(); } g = B.slab(Math.max(2, w), Math.max(2, d), h, Math.min(rad, w / 2 - 0.5, d / 2 - 0.5), bev, { seg: 3, per: 5 }); geoCache.set(k, g); }
    return g;
  };
  const ROT = Math.PI / 2;
  const hudPanels = [], hudButtons = [], hudJars = [];
  function panelAt(i) {
    let p = hudPanels[i];
    if (!p) { const g = new THREE.Group(), outer = new THREE.Mesh(flatQuad, mats.frame), trim = new THREE.Mesh(flatQuad, mats.trim), inner = new THREE.Mesh(flatQuad, mats.face); g.add(outer, trim, inner); hud.add(g); p = { g, outer, trim, inner }; hudPanels.push(p); }
    return p;
  }
  function placePanel(i, pn, W, H) {
    const p = panelAt(i), r = pn.r; p.g.visible = true; p.g.userData.clip = pn.clip;
    const cx = r.x + r.w / 2, cy = -(r.y + r.h / 2), z = -700, rad = pn.rad;
    if (pn.kind === 'inset') {
      p.outer.geometry = slabG(r.w, r.h, 6, rad, 3); p.outer.material = mats.inset; p.outer.rotation.x = ROT; p.outer.position.set(cx, cy, z);
      p.trim.visible = false;
      p.inner.geometry = slabG(r.w - 5, r.h - 5, 8, Math.max(3, rad - 3), 2.5); p.inner.material = mats.insetFace; p.inner.rotation.x = ROT; p.inner.position.set(cx, cy, z);
    } else {
      const ins = 7, dep = 14; p.trim.visible = true;
      p.outer.geometry = slabG(r.w, r.h, dep, rad, 5); p.outer.material = mats.frame; p.outer.rotation.x = ROT; p.outer.position.set(cx, cy, z);
      p.trim.geometry = slabG(r.w - ins * 1.1, r.h - ins * 1.1, dep + 1.5, Math.max(4, rad - ins * 0.5), 1.6); p.trim.rotation.x = ROT; p.trim.position.set(cx, cy, z);
      p.inner.geometry = slabG(r.w - ins * 2.1, r.h - ins * 2.1, dep + 2.2, Math.max(3, rad - ins), 2.2); p.inner.material = mats.face; p.inner.rotation.x = ROT; p.inner.position.set(cx, cy, z);
    }
  }
  function buttonAt(i) {
    let b = hudButtons[i];
    if (!b) { const g = new THREE.Group(), body = new THREE.Mesh(flatQuad, mats.solid), rimM = new THREE.Mesh(flatQuad, mats.rimTrim); g.add(rimM, body); hud.add(g); b = { g, body, rim: rimM }; hudButtons.push(b); }
    return b;
  }
  function placeButton(i, bt) {
    const b = buttonAt(i), r = bt.r; b.g.visible = true; b.g.userData.clip = bt.clip;
    const cx = r.x + r.w / 2, cy = -(r.y + r.h / 2), rad = Math.min(bt.rad, r.h / 2.4), z = -400, dep = bt.flash > 0.2 ? 9 : 18;
    b.rim.geometry = slabG(r.w, r.h, dep - 3, rad, 4); b.rim.rotation.x = ROT; b.rim.position.set(cx, cy, z);
    b.body.geometry = slabG(r.w - 7, r.h - 7, dep, Math.max(3, rad - 2), 6); b.body.rotation.x = ROT; b.body.position.set(cx, cy, z);
    b.body.material = bt.disabled ? mats.off : bt.flash > 0.25 ? mats.flash : bt.accent ? mats.accent : bt.active ? mats.active : mats.solid;
    b.rim.material = bt.accent ? mats.rimTrim : mats.trim;
  }
  function jarAt(i) {
    let j = hudJars[i];
    if (!j) { const tilt = new THREE.Group(), jar = M.buildJar(); tilt.add(jar); const sh = new THREE.Mesh(flatQuad, new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, opacity: 0.55, depthWrite: false })); hud.add(tilt, sh); j = { tilt, jar, sh, lvl: 1, id: '' }; hudJars.push(j); }
    return j;
  }
  function placeJar(i, jr, dt, clock) {
    const j = jarAt(i), r = jr.r; j.tilt.visible = j.sh.visible = true; j.tilt.userData.clip = j.sh.userData.clip = jr.clip;
    const bw = r.w, bodyH = r.bodyH, lift = jr.sel ? r.h * 0.04 : 0, sx = jr.shake ? Math.sin(clock * 60) * bw * 0.04 : 0;
    j.tilt.rotation.x = 0.42; j.tilt.position.set(r.x + r.w / 2 + sx, -(r.bodyY + r.bodyH) + lift, -330);
    j.jar.scale.set(bw * 0.98, (bodyH + r.lidH * 0.8) / 1.19, bw * 0.98);
    const target = jr.frac <= 0 ? 0 : Math.max(0.12, jr.frac);
    j.lvl += (target - j.lvl) * (1 - Math.exp(-dt * 9));
    const paint = j.jar.userData.paint; paint.scale.y = Math.max(0.001, j.lvl); paint.position.y = j.lvl / 2; paint.visible = j.lvl > 0.01;
    if (j.id !== jr.id) { j.id = jr.id; paint.material = M.paintMat(jr.id); }
    j.sh.scale.set(bw * 1.1, bw * 0.4, 1); j.sh.position.set(r.x + r.w / 2 + bw * 0.06, -(r.bodyY + r.bodyH) - bw * 0.1 + lift, -340);
    j.jar.userData.glass.opacity = jr.empty ? 0.08 : 0.14;
  }

  // ------------------------------------------------------------ environment (rebuilt on context restore by board3d)
  let envHandle = null;
  const buildEnv = () => { envHandle = B.createEnvironment(renderer, scene, { intensity: 0.38 }); hud.environment = scene.environment; hud.environmentIntensity = 0.3; };
  try { buildEnv(); } catch (e) { return fail(e); }
  await tick();

  // ------------------------------------------------------------ pieces
  const cache = new Map();   // geometry key -> built piece
  let active = null, appear = 1, lastKey = '';
  function pieceFor(P) {
    const k = JSON.stringify(P.geom);
    let pc = cache.get(k);
    if (!pc) {
      if (cache.size >= 6) { const [ok, ov] = cache.entries().next().value; pieceRoot.remove(ov.group); ov.group.traverse((o) => { if (o.geometry) o.geometry.dispose?.(); }); cache.delete(ok); }
      pc = M.buildPiece(P); pc.cells.forEach((c) => { c.col = undefined; }); pieceRoot.add(pc.group); cache.set(k, pc);
    }
    return pc;
  }

  let W = 1, H = 1, dprNow = 1, hudW = 0, hudH = 0, wantTier = tier;
  function resize() {
    const w = Math.max(1, Math.floor(window.innerWidth)), h = Math.max(1, Math.floor(window.innerHeight));
    const dpr = Math.min(window.devicePixelRatio || 1, TIERS[tier].dpr);
    if (w !== W || h !== H || dpr !== dprNow) { W = w; H = h; dprNow = dpr; renderer.setPixelRatio(dpr); renderer.setSize(w, h, false); camera.aspect = w / h; }
  }
  function setHudProjection(Wp, Hp) {
    const n = 1, f = 2200, m = hudCam.projectionMatrix;
    m.set(2 / Wp, 0, 0, -1, 0, 2 / Hp, 0, 1, 0, 0, -2 / (f - n), -(f + n) / (f - n), 0, 0, 0, 1);
    hudCam.projectionMatrixInverse.copy(m).invert();
  }
  const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3(), ray = new THREE.Vector3(), orig = new THREE.Vector3();
  let vw = 720, vh = 1280, fitted = null, stretchOn = false;
  function fitCamera(rect, hx, hz, topY, pitchDeg, fov, yawDeg, shift = 0, round = false) {
    const asp0 = (2 * hx) / (2 * hz);
    const k = W / vw, p = (pitchDeg * Math.PI) / 180, yaw = (yawDeg * Math.PI) / 180, lookY = topY * 0.5;
    camera.fov = fov; camera.clearViewOffset(); camera.aspect = W / H; camera.updateProjectionMatrix();
    const cs = [];   // the footprint is rotation invariant (a circle for wheels), so a spinning hero never pulses the zoom
    if (round) { for (let i = 0; i < 24; i++) { const an = (i / 24) * TAU; for (const y of [0, topY + 0.1]) cs.push([Math.cos(an) * hx, y, Math.sin(an) * hx]); } }
    else for (const sx of [-1, 1]) for (const sz of [-1, 1]) for (const y of [0, topY + 0.1]) cs.push([sx * hx, y, sz * hz]);
    let d = 12;
    // Portrait wide panels: stretch the projection vertically (project/unproject use the same matrix, so taps stay exact).
    const sy = stretchOn && !round && H >= W * 1.12 ? Math.max(1, Math.min(PANEL_STRETCH, (rect.h / rect.w) * asp0 * 0.98)) : 1;
    const stretch = () => { if (sy !== 1) { const e = camera.projectionMatrix.elements; e[5] *= sy; e[9] *= sy; camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert(); } };
    const place = () => {
      camera.position.set(Math.sin(yaw) * Math.cos(p) * d, lookY + Math.sin(p) * d, Math.cos(yaw) * Math.cos(p) * d);
      camera.lookAt(0, lookY, 0); camera.updateMatrixWorld(); camera.updateProjectionMatrix(); stretch();
    };
    const bbox = () => {
      let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
      for (const c of cs) { tmp.set(c[0], c[1], c[2]).project(camera); const X = ((tmp.x + 1) / 2) * W, Y = ((1 - tmp.y) / 2) * H; x0 = Math.min(x0, X); x1 = Math.max(x1, X); y0 = Math.min(y0, Y); y1 = Math.max(y1, Y); }
      return [x0, x1, y0, y1];
    };
    for (let it = 0; it < 6; it++) {
      place(); const [x0, x1, y0, y1] = bbox();
      d *= Math.max((x1 - x0) / (rect.w * k * 0.985), (y1 - y0) / (rect.h * k * 0.985));
    }
    place();
    const [x0, x1, y0, y1] = bbox();
    const tx = (rect.x + rect.w / 2) * k, ty = (rect.y + rect.h / 2) * k + shift * k;
    camera.setViewOffset(W, H, (x0 + x1) / 2 - tx, (y0 + y1) / 2 - ty, W, H);
    camera.updateProjectionMatrix(); stretch(); camera.updateMatrixWorld();
    const dist = camera.position.length(); scene.fog.near = dist * 1.25; scene.fog.far = dist * 3.4;
  }
  const topOf = () => (active ? active.top : 0.2);
  const frameToLocal = (u, v) => (active.kind === 'wheel' ? [u, v] : [u - active.half[0] + 0.34, v - active.half[1] + 0.34]);
  v3.project = (u, v) => {
    const [x, z] = frameToLocal(u, v);
    tmp.set(x, topOf(), z); pieceRoot.localToWorld(tmp); tmp.project(camera);
    return [((tmp.x + 1) / 2) * vw, ((1 - tmp.y) / 2) * vh];
  };
  v3.unproject = (vx, vy) => {
    orig.copy(camera.position); ray.set((vx / vw) * 2 - 1, 1 - (vy / vh) * 2, 0.5).unproject(camera).sub(orig).normalize();
    if (Math.abs(ray.y) < 1e-5) return [-9, -9];
    const t = (topOf() - orig.y) / ray.y; tmp2.copy(orig).addScaledVector(ray, t); pieceRoot.worldToLocal(tmp2);
    const x = tmp2.x, z = tmp2.z;
    return active.kind === 'wheel' ? [x, z] : [x + active.half[0] - 0.34, z + active.half[1] - 0.34];
  };
  let pieceThisFrame = false, clock = 0, lastT = 0, ema = 16, frames = 0, look = '';
  v3.setPiece = (req, w, h) => {
    if (!v3.on) return false;
    vw = w; vh = h; resize();
    const P = req.P, pc = pieceFor(P);
    if (active && active !== pc) active.group.visible = false;
    active = pc; pc.group.visible = true; pieceThisFrame = true;
    const key2 = JSON.stringify(P.geom) + (req.hero ? 'h' : 'p');
    if (key2 !== lastKey) { lastKey = key2; appear = 0; }
    const hero = !!req.hero, wheel = pc.kind === 'wheel';
    pieceRoot.rotation.y = -(req.rot || 0); pieceRoot.updateMatrixWorld(true);
    const sway = hero ? Math.sin(clock * 0.22) * 5 : 0;
    stretchOn = !hero && !wheel;
    fitCamera(req.rect, pc.half[0], pc.half[1], pc.top, hero ? 50 : wheel ? (w > h ? 52 : 56) : (w > h ? 55 : 68), 30, sway, 0, wheel);
    placeProps(pc.half[0], pc.half[1], hero);
    const sh = Math.max(pc.half[0], pc.half[1]) + 1.4;
    Object.assign(key.shadow.camera, { left: -sh, right: sh, top: sh, bottom: -sh, near: 1, far: 60 }); key.shadow.camera.updateProjectionMatrix();
    blob.scale.set((pc.half[0] * 1.12) / 1.4, (pc.half[1] * 1.12) / 1.4, 1); blob.rotation.z = pieceRoot.rotation.y;
    // piece appearance + state
    const G = M.glowMats(), time = req.t || clock;
    G.hi.opacity = 0.32 + 0.3 * (0.5 + 0.5 * Math.sin(time * 6)); G.sel.opacity = 0.42;
    const drop = appear < 1 ? (1 - Math.min(1, appear)) : 0; pieceRoot.position.y = drop * drop * 0.9;
    for (const c of pc.cells) {
      const col = req.a[c.orbit] || '', pop = req.pop ? req.pop[c.id] : 99, age = pop == null ? 99 : pop;
      if (c.col !== col) {
        c.col = col; c.mesh.material = col ? M.paintMat(col) : M.bareMat(c.id);
        if (c.petal) { c.petal.visible = !!col; if (col) c.petal.material = M.petalMat(col); }
        if (c.dot) c.dot.visible = !!col;
      }
      const popping = age < 0.42 && !!col, lift = popping ? Math.sin(Math.min(1, age / 0.42) * Math.PI) * 0.06 : 0;
      c.mesh.position.y = c.y0 + lift;
      if (c.petal) c.petal.position.y = c.y0 + pc.depth + (pc.kind === 'wheel' ? 0.011 : 0.0) + lift + (pc.kind === 'wheel' ? 0 : 0.0);
      if (c.dot) c.dot.position.y = c.y0 + pc.depth + 0.016 + lift;
      let gl = null;
      if (req.hi && req.hi.has(c.orbit)) gl = G.hi; else if (req.sel && req.sel.has(c.orbit)) gl = G.sel; else if (popping) { gl = G.pop; G.pop.opacity = 0.55 * (1 - age / 0.42); }
      if (gl) { const m = M.glowFor(pc, c); m.material = gl; m.visible = true; m.position.y = pc.top + 0.012 + lift; } else if (c.glow) c.glow.visible = false;
      const peg = req.given && req.given.has(c.orbit) && (pc.kind !== 'wheel' || c.c.shape === 'sector');
      if (peg) { const pg = M.pegFor(pc, c); pg.visible = true; } else if (c.peg) c.peg.visible = false;
    }
    // the brush on the bench is loaded with the paint in hand
    const tuft = brush.children[2]?.material, want = req.pick && PAINT_HEX[req.pick];
    if (tuft && want) { tuft.color.set(want); brush2.children[2].material.color.set(want); }
    // unit: pixels per frame unit
    const a = v3.project(0, 0), b = v3.project(1, 0);
    v3.fit = { rect: { x: req.rect.x, y: req.rect.y, w: req.rect.w, h: req.rect.h }, unit: Math.hypot(b[0] - a[0], b[1] - a[1]) || 100 };
    return true;
  };

  // ------------------------------------------------------------ frame
  function applyLook(id, calm) {
    const L = LOOKS3[id] ?? LOOKS3.workshop;
    scene.fog.color.setHex(L.fog); renderer.setClearColor(L.bg, 1);
    key.color.setHex(L.key); key.intensity = L.keyI; rim.color.setHex(L.rim); rim.intensity = L.rimI;
    hemi.color.setHex(L.hemi[0]); hemi.groundColor.setHex(L.hemi[1]); hemi.intensity = L.hemi[2];
    lamp.color.setHex(L.lamp); lamp.intensity = L.lampI; renderer.toneMappingExposure = L.expo;
    tableMat.color.set(L.tint); scene.environmentIntensity = L.env;
    key.position.set(id === 'night' ? 5 : -5, 11, 7.5); key.target.position.set(0, 0, 0);
    look = id;
  }
  function applyTier() {
    const t = TIERS[tier];
    renderer.shadowMap.enabled = t.shadow > 0; key.castShadow = t.shadow > 0;
    if (t.shadow) { key.shadow.mapSize.set(t.shadow, t.shadow); if (key.shadow.map) { key.shadow.map.dispose(); key.shadow.map = null; } }
    W = 0; scene.traverse((o) => { if (o.material) { const ms = Array.isArray(o.material) ? o.material : [o.material]; ms.forEach((m) => { m.needsUpdate = true; }); } });
  }
  applyTier();

  const clipKey = (c) => (c ? `${c.x}|${c.y}|${c.w}|${c.h}` : '');
  v3.present = (w, h, s) => {
    if (!v3.on) return;
    vw = w; vh = h; resize();
    const now = performance.now(), dt = Math.min(0.1, Math.max(0, (now - lastT) / 1000)); lastT = now; clock += dt;
    const calm = !!s?.prefs?.calm;
    ema = ema * 0.95 + dt * 1000 * 0.05; frames++;
    if (frames > 90 && ema > 30 && tier < TIERS.length - 1) { tier++; applyTier(); frames = 0; ema = 16; }
    if (!pieceThisFrame) {
      if (active) active.group.visible = false;
      stretchOn = false;
      fitCamera({ x: 0, y: 0, w: vw, h: vh * 0.8 }, 1.7, 1.2, 0.2, 52, 30, 0);
      placeProps(1.7, 1.2); v3.fit = null; blob.scale.set(0.001, 0.001, 1);
    }
    pieceThisFrame = false;
    appear = Math.min(1, appear + dt / 0.5);
    const lk = v3.look || 'workshop'; if (lk !== look) applyLook(lk, calm);
    lamp.intensity = LOOKS3[look].lampI * (1 + (calm ? 0 : Math.sin(clock * 9.3) * 0.025 + Math.sin(clock * 5.1) * 0.02));
    // dust
    dust.visible = !calm;
    if (!calm) {
      const p = dg.attributes.position;
      for (let i = 0; i < N; i++) {
        p.array[i * 3] += dustV[i * 3] * dt + Math.sin(clock * 0.4 + i) * 0.0008; p.array[i * 3 + 1] += dustV[i * 3 + 1] * dt; p.array[i * 3 + 2] += dustV[i * 3 + 2] * dt;
        if (p.array[i * 3 + 1] > 4.2) p.array[i * 3 + 1] = 0.05;
      }
      p.needsUpdate = true;
    }
    // HUD
    if (hudW !== vw || hudH !== vh) { hudW = vw; hudH = vh; setHudProjection(vw, vh); vig.scale.set(vw * 1.02, vh * 1.02, 1); vig.position.set(vw / 2, -vh / 2, -900); }
    let n = 0;
    for (const p of v3.panels) placePanel(n++, p, vw, vh);
    for (let i = n; i < hudPanels.length; i++) hudPanels[i].g.visible = false;
    n = 0; for (const b of v3.buttons) placeButton(n++, b);
    for (let i = n; i < hudButtons.length; i++) hudButtons[i].g.visible = false;
    n = 0; for (const j of v3.jars) placeJar(n++, j, dt, clock);
    for (let i = n; i < hudJars.length; i++) hudJars[i].tilt.visible = hudJars[i].sh.visible = false;
    scrim.visible = v3.scrim > 0; scrim.material.opacity = v3.scrim; scrim.scale.set(vw * 2, vh * 2, 1); scrim.position.set(vw / 2, -vh / 2, -820);
    // draw
    renderer.setViewport(0, 0, W, H); renderer.setScissorTest(false);
    renderer.clear(true, true, true);
    renderer.render(scene, camera);
    renderer.clearDepth();
    // HUD: one pass for everything unclipped (plus the vignette and scrim), then one scissored pass per scrolling body
    const groups = new Map([['', { clip: null, objs: [] }]]);
    const reg = (obj) => { const c = obj.userData.clip || null, k = clipKey(c); if (!groups.has(k)) groups.set(k, { clip: c, objs: [] }); groups.get(k).objs.push(obj); };
    for (let i = 0; i < v3.panels.length; i++) reg(hudPanels[i].g);
    for (let i = 0; i < v3.buttons.length; i++) reg(hudButtons[i].g);
    for (let i = 0; i < v3.jars.length; i++) { reg(hudJars[i].tilt); reg(hudJars[i].sh); }
    const list = [...groups.values()], all = list.flatMap((g) => g.objs), k = W / vw;
    for (const g of list) {
      if (list.length > 1) { for (const o of all) o.visible = false; for (const o of g.objs) o.visible = true; }
      if (g.clip) { renderer.setScissorTest(true); renderer.setScissor(Math.floor(g.clip.x * k), Math.floor(H - (g.clip.y + g.clip.h) * k), Math.ceil(g.clip.w * k), Math.ceil(g.clip.h * k)); } else renderer.setScissorTest(false);
      vig.visible = !g.clip; scrim.visible = !g.clip && v3.scrim > 0;
      renderer.render(hud, hudCam);
      if (g.clip) renderer.clearDepth();
    }
    renderer.setScissorTest(false);
  };

  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); v3.on = false; });
  canvas.addEventListener('webglcontextrestored', () => {
    try { envHandle?.rebuild(); hud.environment = scene.environment; hud.environmentIntensity = 0.3; } catch (e) { /* no reflections, still playable */ }
    try { applyTier(); } catch (e) { /* ignore */ }
    W = 0; resize(); look = ''; v3.on = true;
  });

  // compile every program once, off the first interactive frame
  try {
    resize(); setHudProjection(720, 1280);
    camera.position.set(0, 8, 8); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
    applyLook(v3.look || 'workshop', false);
    if (renderer.compileAsync) { await renderer.compileAsync(scene, camera); await renderer.compileAsync(hud, hudCam); }
    else { renderer.compile(scene, camera); renderer.compile(hud, hudCam); }
  } catch (e) { console.warn('compile', e); }
  await tick();
  v3.on = true;
  requestAnimationFrame(() => { canvas.style.opacity = '1'; });
  return { ok: true, renderer, scene, camera, hud, setTier(t) { tier = clamp(t, 0, 2); applyTier(); }, get tier() { return tier; } };
}
