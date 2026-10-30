// Marbles: Ring and Shoot 3D presenter (game-owned). It ONLY READS what the 2D layer published (src/v3.js: the world it drew
// and where); it never writes game state. One WebGL canvas sits behind the kit's transparent 2D canvas: this draws the lit
// schoolyard, the dirt ring and the marbles; the 2D layer keeps all text, HUD, input, aim guides and particles.
//
// Play camera: a perspective camera straight above the ring but displaced towards the player (off-axis lens). Its image plane is
// parallel to the ground, so the horizontal plane through the marbles' centres maps to the screen with exactly the same
// scale/offset as the 2D board (layout.js): every 2D guide, ring and touch lands on the 3D marbles, while anything with height
// (grass, stones, the marbles themselves) shows real depth and parallax. Menus use a free, slowly drifting tilted camera that
// frames the ring where the 2D layer drew its table.
// Fallbacks: no WebGL / init failure -> not created (2D table stays); context lost -> v3.on = false (2D) and restored -> rebuilt.
import * as THREE from '../vendor3d/three.js';
import { v3 } from '../src/v3.js';
import { meta } from '../src/layout.js';
import { buildYard, envScene, makeMarble, blobTexture, glowTexture, SUN, U } from './yard.js';

const TIERS = [{ name: 'high', dpr: 2, shadow: 2048 }, { name: 'medium', dpr: 1.5, shadow: 1024 }, { name: 'low', dpr: 1, shadow: 0 }];
const H_PLANE = 19.5 * U;           // the plane (through the marble centres) that maps exactly onto the 2D board
const SIDE_GLOW = [0x5ab4ff, 0xff8c50];

export async function createPresenter({ kitCanvas }) {
  const qs = new URLSearchParams(location.search);
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;height:100dvh;display:block;pointer-events:none;z-index:0;opacity:0';
  const vig = document.createElement('div');
  vig.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:0;opacity:0;background:radial-gradient(ellipse at 50% 46%, rgba(10,16,6,0) 52%, rgba(10,16,6,0.55) 100%)';
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: qs.has('keep') }); }
  catch (e) { console.warn('WebGL unavailable; 2D table kept', e); return { ok: false }; }
  kitCanvas.parentElement.insertBefore(canvas, kitCanvas); kitCanvas.parentElement.insertBefore(vig, kitCanvas);
  kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.setClearColor(0x2f4a24, 1);
  let tier = 0;
  if (qs.has('tier')) tier = Math.max(0, Math.min(2, Number(qs.get('tier'))));
  else if ((navigator.hardwareConcurrency || 8) <= 4) tier = 1;
  const nap = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));

  // ------------------------------------------------------------ scene, light, reflections
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x2a3d1e, 16, 42);
  const camera = new THREE.PerspectiveCamera(32, 1, 0.5, 120);
  const hemi = new THREE.HemisphereLight(0xd6e6ff, 0x5a6a2c, 0.75);
  const key = new THREE.DirectionalLight(0xffe0b0, 2.9);
  key.position.copy(SUN).multiplyScalar(14); key.target.position.set(0, 0, 0);
  Object.assign(key.shadow.camera, { left: -5.2, right: 5.2, top: 5.2, bottom: -5.2, near: 2, far: 30 });
  key.shadow.bias = -0.0003; key.shadow.normalBias = 0.004; key.shadow.radius = 3;
  const fill = new THREE.DirectionalLight(0xa9c4ff, 0.5); fill.position.set(6, 5, 7);
  const rim = new THREE.DirectionalLight(0xffc890, 0.9); rim.position.set(5, 3, -7);
  scene.add(hemi, key, key.target, fill, rim);
  const buildEnv = () => {
    const pm = new THREE.PMREMGenerator(renderer);
    if (scene.environment && scene.environment.dispose) { try { scene.environment.dispose(); } catch { /* lost */ } }
    scene.environment = pm.fromScene(envScene(), 0.015).texture; scene.environmentIntensity = 0.85; pm.dispose();
  };
  buildEnv();
  const applyTier = () => {
    const T = TIERS[tier];
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, T.dpr));
    renderer.shadowMap.enabled = T.shadow > 0; key.castShadow = T.shadow > 0;
    if (T.shadow) { key.shadow.mapSize.set(T.shadow, T.shadow); if (key.shadow.map) { key.shadow.map.dispose(); key.shadow.map = null; } }
    cssW = 0;
  };
  let cssW = 0, cssH = 0;
  applyTier();

  const yard = await buildYard(TIERS[tier].name, nap);
  scene.add(yard.root);
  await nap();

  // ------------------------------------------------------------ marbles
  const blobTex = blobTexture(), glowTex = glowTexture();
  const flat = new THREE.PlaneGeometry(1, 1); flat.rotateX(-Math.PI / 2);
  const ents = new Map(); let worldRef = null, ballsRef = null, builtTier = tier;
  const tmpV = new THREE.Vector3(), tmpQ = new THREE.Quaternion();
  const causticDir = new THREE.Vector2(-SUN.x, -SUN.z).normalize();
  function makeEnt(b) {
    const g = makeMarble(b, TIERS[tier].name);
    const blob = new THREE.Mesh(flat, new THREE.MeshBasicMaterial({ map: blobTex, color: 0x140c04, transparent: true, opacity: 0.6, depthWrite: false })); blob.renderOrder = 1;
    let caustic = null;
    if (g.userData.glass) { caustic = new THREE.Mesh(flat, new THREE.MeshBasicMaterial({ map: glowTex, color: new THREE.Color(g.userData.tint).lerp(new THREE.Color(0xfff2d0), 0.45), transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending })); caustic.renderOrder = 2; }
    const flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xfff6d0, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    scene.add(g, blob, flash); if (caustic) scene.add(caustic);
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(b.id * 1.3, b.id * 2.1, b.id * 0.7));
    return { g, blob, caustic, flash, q, x: b.x, y: b.y, kind: b.kind, side: b.side, seen: true };
  }
  function dropEnt(id) { const e = ents.get(id); scene.remove(e.g, e.blob, e.flash); if (e.caustic) { scene.remove(e.caustic); e.caustic.material.dispose(); } e.blob.material.dispose(); e.flash.material.dispose(); ents.delete(id); }
  function syncMarbles(w) {
    if (w !== worldRef || w.balls !== ballsRef || builtTier !== tier) { for (const id of [...ents.keys()]) dropEnt(id); if (w !== worldRef || w.balls !== ballsRef) yard.clearTracks(); worldRef = w; ballsRef = w.balls; builtTier = tier; }
    for (const e of ents.values()) e.seen = false;
    for (const b of w.balls) {
      if (b.mode !== 'live') continue;
      let e = ents.get(b.id);
      if (e && (e.kind !== b.kind || e.side !== b.side)) { dropEnt(b.id); e = null; }
      if (!e) { e = makeEnt(b); ents.set(b.id, e); }
      e.seen = true;
      const r = b.r * U, dx = (b.x - e.x) * U, dz = (b.y - e.y) * U, d = Math.hypot(dx, dz);
      // roll: about the axis perpendicular to the travel, by distance / radius (presentation only, from displayed positions)
      if (d > 1e-6 && d < 1.2) { tmpV.set(dz, 0, -dx).normalize(); tmpQ.setFromAxisAngle(tmpV, d / r); e.q.premultiply(tmpQ); }
      if (d > 0.004 && d < 1.2) yard.track(e.x, e.y, b.x, b.y, b.r);
      if ((b.heat || 0) > 0.5 && !e.scuffed) { yard.scuff(b.x, b.y, b.heat * 500); e.scuffed = true; } else if ((b.heat || 0) < 0.2) e.scuffed = false;
      e.x = b.x; e.y = b.y;
      const X = b.x * U, Z = b.y * U;
      e.g.position.set(X, r, Z); e.g.quaternion.copy(e.q);
      e.blob.position.set(X + 0.25 * r, 0.004, Z + 0.2 * r); e.blob.scale.setScalar(r * 2.7);
      if (e.caustic) { e.caustic.position.set(X + causticDir.x * r * 1.45, 0.005, Z + causticDir.y * r * 1.45); e.caustic.scale.set(r * 1.0, 1, r * 0.7); e.caustic.rotation.y = -Math.atan2(causticDir.y, causticDir.x); }
      const heat = b.heat || 0; e.flash.material.opacity = heat > 0.04 ? heat * 0.75 : 0; e.flash.visible = heat > 0.04;
      if (e.flash.visible) { e.flash.position.set(X, r * 1.3, Z); e.flash.scale.setScalar(r * (3 + heat * 3)); }
    }
    for (const [id, e] of ents) if (!e.seen) dropEnt(id);
  }

  // ------------------------------------------------------------ cameras
  function screenBox() {
    const k = meta.cssPerUnit || (window.innerWidth / meta.width), cw = window.innerWidth, ch = window.innerHeight;
    const x0 = -((cw - meta.width * k) / 2) / k, y0 = -((ch - meta.height * k) / 2) / k;
    return { x0, x1: x0 + cw / k, y0, y1: y0 + ch / k };
  }
  function lockCamera(T, box) {
    const S = T.sc / U;                         // virtual units per world unit
    const D = 15, ez = 0.42 * D, ex = 0, d = D - H_PLANE, n = 0.5;
    const X = (vx) => (vx - T.cx) / S, Z = (vy) => (vy - T.cy) / S;
    camera.position.set(ex, D, ez); camera.up.set(0, 0, -1); camera.lookAt(ex, 0, ez); camera.updateMatrixWorld();
    camera.near = n; camera.far = 120; scene.fog.near = 20; scene.fog.far = 60;
    camera.projectionMatrix.makePerspective((X(box.x0) - ex) * n / d, (X(box.x1) - ex) * n / d, -(Z(box.y0) - ez) * n / d, -(Z(box.y1) - ez) * n / d, n, 120);
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
  }
  function freeCamera(T, box, t) {
    const vw = box.x1 - box.x0, vh = box.y1 - box.y0, fov = 34;
    camera.fov = fov; camera.aspect = vw / vh; camera.near = 0.5; camera.far = 120; camera.up.set(0, 1, 0);
    const F = (vh / 2) / Math.tan((fov * Math.PI) / 360), span = Math.max(T.sc * 724 * 1.12, Math.min(vw, vh) * 0.98), Rw = 3.8;
    const dist = (2 * Rw * F) / span;
    const el = ((40 + 3 * Math.sin(t * 0.11)) * Math.PI) / 180, az = 0.42 * Math.sin(t * 0.045) + 0.12 * Math.sin(t * 0.13);
    camera.position.set(Math.sin(az) * Math.cos(el) * dist, Math.sin(el) * dist, Math.cos(az) * Math.cos(el) * dist);
    camera.lookAt(0, 0, 0); camera.updateProjectionMatrix(); camera.updateMatrixWorld();
    scene.fog.near = dist * 0.85; scene.fog.far = dist * 2.6;
    const nx = (2 * (T.cx - box.x0)) / vw - 1, ny = 1 - (2 * (T.cy - box.y0)) / vh;
    camera.projectionMatrix.elements[8] -= nx; camera.projectionMatrix.elements[9] -= ny;
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
  }

  // ------------------------------------------------------------ context loss
  let lost = false, readyAt = 0;
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; v3.on = false; v3.alpha = 0; canvas.style.opacity = '0'; vig.style.opacity = '0'; shown = false; }, false);
  canvas.addEventListener('webglcontextrestored', () => {
    try { buildEnv(); applyTier(); scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => { m.needsUpdate = true; for (const k of ['map', 'bumpMap', 'alphaMap']) if (m[k]) m[k].needsUpdate = true; }); }); } catch (err) { console.warn(err); }
    lost = false; readyAt = performance.now();
  }, false);

  // ------------------------------------------------------------ per-frame (called after every kit render)
  let last = performance.now(), time = 0, slow = 0, frames = 0, shown = false;
  readyAt = performance.now();
  const loseExt = qs.has('dev') ? renderer.getContext().getExtension('WEBGL_lose_context') : null;
  if (qs.has('dev')) window.__p3 = { v3, renderer, scene, camera, ents, tierOf: () => TIERS[tier].name, info: () => renderer.info.render, lose: () => loseExt };
  function frame() {
    const now = performance.now(), dt = Math.min(0.1, (now - last) / 1000); last = now; time += dt;
    if (lost) return;
    const T = v3.table;
    if (!v3.drawn || !T) { if (shown) { canvas.style.opacity = '0'; vig.style.opacity = '0'; shown = false; } return; }
    v3.on = true; v3.alpha = Math.min(1, (now - readyAt) / 450);   // crossfade the baked 2D table out
    if (!shown) { canvas.style.opacity = '1'; shown = true; }
    vig.style.opacity = T.lock ? '0.85' : '0.6';
    if (window.innerWidth !== cssW || window.innerHeight !== cssH) { cssW = window.innerWidth; cssH = window.innerHeight; renderer.setSize(cssW, cssH, false); }
    const box = screenBox();
    if (T.lock) lockCamera(T, box); else freeCamera(T, box, time);
    syncMarbles(T.w);
    yard.update(dt, time);
    const lg = yard.lineGlow.material;
    if (T.hand !== undefined && T.hand !== null) { lg.color.setHex(SIDE_GLOW[T.hand] ?? SIDE_GLOW[0]); lg.opacity = 0.13 + 0.07 * Math.sin(T.t * 4); } else lg.opacity = 0;
    renderer.render(scene, camera);
    // quality: drop a tier when frames are consistently slow (after a warm-up)
    frames++;
    if (!qs.has('tier') && frames > 90 && now - readyAt > 2500) { slow = slow * 0.95 + (dt > 0.026 ? 1 : 0) * 0.05; if (slow > 0.6 && tier < 2) { tier++; applyTier(); if (yard.blades) yard.blades.visible = tier < 2; slow = 0; frames = 0; } }
  }
  return { ok: true, frame, renderer, scene };
}
