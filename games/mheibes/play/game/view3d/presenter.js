// Mheibes 3D presenter. READS the game state (game.getState()), never writes it. One WebGL canvas sits behind the kit's transparent 2D canvas:
// a lit 3D majlis (carpet, plaster niche, tiled dado, cushions, pierced-brass lanterns, drapes, coffee set) plus a screen-space HUD scene of
// carved-wood plaques and lacquered buttons. The 2D layer keeps the people (drawn faces: the game IS reading expressions) and the text.
// Load: the page boots the flat 2D game at once; this module builds the scene in slices (await tick) and compiles shaders async, then crossfades.
// Fallbacks: no WebGL / context lost -> v3.on = false and every screen draws with the flat 2D art; context restored -> back to 3D.
import * as THREE from '../vendor3d/three.js';
import * as B from '../vendor3d/board3d.js';
import { v3 } from '../src/v3.js';
import { layoutFor } from '../src/layout.js';
import { buildRoom, animateRoom, setCarpet, blobCanvas } from './room.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const TIERS = [{ name: 'high', dpr: 2, shadow: 1024 }, { name: 'medium', dpr: 1.5, shadow: 0 }, { name: 'low', dpr: 1, shadow: 0 }];
const tick = () => new Promise((r) => setTimeout(r, 0));

function cv(w, h = w) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function velvetCanvas(S = 256, base = '#1b1546', hi = '#2c2368') {
  const c = cv(S), x = c.getContext('2d'); let s = 7; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const g = x.createLinearGradient(0, 0, S, S); g.addColorStop(0, hi); g.addColorStop(1, base); x.fillStyle = g; x.fillRect(0, 0, S, S);
  x.strokeStyle = 'rgba(246,207,117,0.07)'; x.lineWidth = 2;
  for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) { const cx = i * S / 4 + S / 8, cy = j * S / 4 + S / 8; x.beginPath(); x.moveTo(cx, cy - S / 9); x.lineTo(cx + S / 9, cy); x.lineTo(cx, cy + S / 9); x.lineTo(cx - S / 9, cy); x.closePath(); x.stroke(); }
  for (let k = 0; k < 2500; k++) { x.fillStyle = r() > 0.5 ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.12)'; x.fillRect(r() * S, r() * S, 1.5, 1.5); }
  return c;
}
const tex = (c, rep) => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); } return t; };

export async function createPresenter({ kitCanvas, quality = 'high' }) {
  const noop = { ok: false, init: async () => false, frame: () => {} };
  let renderer;
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100dvh;display:block;pointer-events:none;z-index:0;opacity:0;transition:opacity .45s ease';
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: false }); }
  catch (e) { console.warn('WebGL unavailable; 2D fallback', e); return noop; }
  kitCanvas.parentElement.insertBefore(canvas, kitCanvas);
  kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
  renderer.autoClear = false; renderer.setClearColor(0x0a0620, 1); renderer.shadowMap.type = THREE.PCFShadowMap;

  const qs = new URLSearchParams(location.search);
  let tier = Math.max(0, TIERS.findIndex((t) => t.name === quality));
  if (qs.has('tier')) tier = clamp(Number(qs.get('tier')), 0, TIERS.length - 1);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0620);
  scene.fog = new THREE.Fog(0x120a2a, 16, 34);
  const camera = new THREE.PerspectiveCamera(46, 1, 0.5, 80);
  let envHandle = null, U = null, carpetNow = 'garnet';
  const hud = new THREE.Scene(), hudCam = new THREE.PerspectiveCamera();
  const hudLight = new THREE.DirectionalLight(0xfff0d6, 1.7); hudLight.position.set(-500, 800, 1000);
  const hudFill = new THREE.DirectionalLight(0xffc890, 0.5); hudFill.position.set(700, -300, 600);
  hud.add(new THREE.HemisphereLight(0xffe6c8, 0x2a1a30, 0.7), hudLight, hudFill);
  function setHudProjection(Wp, Hp) {
    const n = 1, f = 2200, m = hudCam.projectionMatrix;
    m.set(2 / Wp, 0, 0, -1, 0, 2 / Hp, 0, 1, 0, 0, -2 / (f - n), -(f + n) / (f - n), 0, 0, 0, 1);
    hudCam.projectionMatrixInverse.copy(m).invert();
  }

  // ---------------------------------------------------------------- HUD plaques + buttons (virtual-unit space, y down)
  const hudPanels = [], hudButtons = [], geoCache = new Map();
  const slabG = (w, d, h, rad, bev) => {
    const k = `${Math.round(w)}|${Math.round(d)}|${h}|${Math.round(rad)}|${bev}`; let g = geoCache.get(k);
    if (!g) { if (geoCache.size > 150) { for (const v of geoCache.values()) v.dispose(); geoCache.clear(); } g = B.slab(w, d, h, rad, bev, { seg: 3, per: 5 }); geoCache.set(k, g); }
    return g;
  };
  const phys = (color, o = {}) => new THREE.MeshPhysicalMaterial({ color, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.12, ...o });
  const brassM = new THREE.MeshPhysicalMaterial({ color: 0xd8a640, metalness: 1, roughness: 0.3, envMapIntensity: 1.2 });
  const woodHud = B.material('darkWood', { color: '#5a3216', color2: '#8a5a2c', repeat: [2, 2], seed: 31 });
  const velvet = new THREE.MeshStandardMaterial({ map: tex(velvetCanvas()), roughness: 0.92 });
  const velvetCard = new THREE.MeshStandardMaterial({ map: tex(velvetCanvas(256, '#241a5a', '#3a2e86')), roughness: 0.9 });
  const velvetTag = new THREE.MeshStandardMaterial({ map: tex(velvetCanvas(256, '#150f38', '#221a58')), roughness: 0.9 });
  const BTN = {
    primary: phys('#e08a1c', { emissive: '#5a2a04', emissiveIntensity: 0.35 }), quiet: phys('#3a2d7a'), on: phys('#6a56b0'),
    dim: phys('#241c4e', { clearcoat: 0.3 }),
  };
  const ROT = Math.PI / 2;
  const scrim = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0x06031a, transparent: true, opacity: 0, depthWrite: false })); hud.add(scrim);
  const vigC = cv(256), vx = vigC.getContext('2d'), vg = vx.createRadialGradient(128, 128, 70, 128, 128, 186);
  vg.addColorStop(0, 'rgba(4,2,14,0)'); vg.addColorStop(1, 'rgba(4,2,14,0.7)'); vx.fillStyle = vg; vx.fillRect(0, 0, 256, 256);
  const vig = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: tex(vigC), transparent: true, depthWrite: false })); hud.add(vig);
  function panelAt(i) {
    let p = hudPanels[i];
    if (!p) { const g = new THREE.Group(), outer = new THREE.Mesh(new THREE.BufferGeometry(), woodHud), trim = new THREE.Mesh(new THREE.BufferGeometry(), brassM), inner = new THREE.Mesh(new THREE.BufferGeometry(), velvet); g.add(outer, trim, inner); hud.add(g); p = { g, outer, trim, inner }; hudPanels.push(p); }
    return p;
  }
  function placePanel(i, r, rad, kind) {
    const p = panelAt(i); p.g.visible = true;
    const cx = r.x + r.w / 2, cy = -(r.y + r.h / 2), z = -700, dep = kind === 'tag' ? 7 : 14, ins = kind === 'tag' ? 4 : kind === 'doc' ? 10 : 7;
    if (kind === 'inset') { p.outer.visible = p.trim.visible = false; p.inner.geometry = slabG(r.w, r.h, 6, rad, 2); p.inner.material = velvetTag; p.inner.rotation.x = ROT; p.inner.position.set(cx, cy, z); return; }
    p.outer.visible = p.trim.visible = true;
    p.outer.material = woodHud;
    p.outer.geometry = slabG(r.w, r.h, dep, rad, 5); p.outer.rotation.x = ROT; p.outer.position.set(cx, cy, z);
    p.trim.geometry = slabG(r.w - ins * 1.1, r.h - ins * 1.1, dep + 1.5, Math.max(4, rad - ins * 0.5), 1.6); p.trim.rotation.x = ROT; p.trim.position.set(cx, cy, z);
    p.inner.geometry = slabG(r.w - ins * 2.3, r.h - ins * 2.3, dep + 2.8, Math.max(3, rad - ins), 2.2); p.inner.rotation.x = ROT; p.inner.position.set(cx, cy, z);
    p.inner.material = kind === 'tag' ? velvetTag : kind === 'plaque' ? velvet : velvetCard;
  }
  function buttonAt(i) {
    let b = hudButtons[i];
    if (!b) { const g = new THREE.Group(), body = new THREE.Mesh(new THREE.BufferGeometry(), BTN.quiet), rim = new THREE.Mesh(new THREE.BufferGeometry(), brassM); g.add(rim, body); hud.add(g); b = { g, body, rim }; hudButtons.push(b); }
    return b;
  }
  function placeButton(i, bt, pressed) {
    const b = buttonAt(i), r = bt.r; b.g.visible = true;
    const cx = r.x + r.w / 2, cy = -(r.y + r.h / 2), rad = Math.min(bt.rad ?? 16, r.h / 2 - 1), z = -400, dep = pressed ? 8 : 18;
    b.rim.geometry = slabG(r.w, r.h, dep - 3, rad, 4); b.rim.rotation.x = ROT; b.rim.position.set(cx, cy, z);
    b.body.geometry = slabG(r.w - 7, r.h - 7, dep, Math.max(2, rad - 3), 6); b.body.rotation.x = ROT; b.body.position.set(cx, cy, z);
    b.body.material = BTN[bt.kind] ?? BTN.quiet; b.g.position.set(0, pressed ? -3 : 0, 0);
  }

  // ---------------------------------------------------------------- frame
  let W = 1, H = 1, dprNow = 1, hudW = 0, hudH = 0, clock = 0, lastT = 0, frames = 0, ema = 16;
  function resize() {
    const w = Math.max(1, Math.floor(window.innerWidth)), h = Math.max(1, Math.floor(window.innerHeight)), dpr = Math.min(window.devicePixelRatio || 1, TIERS[tier].dpr);
    if (w !== W || h !== H || dpr !== dprNow) { W = w; H = h; dprNow = dpr; renderer.setPixelRatio(dpr); renderer.setSize(w, h, false); camera.aspect = w / h; }
  }
  function applyTier() {
    const t = TIERS[tier];
    renderer.shadowMap.enabled = t.shadow > 0;
    if (U) { U.key.castShadow = t.shadow > 0; if (t.shadow && U.key.shadow.map) { U.key.shadow.map.dispose(); U.key.shadow.map = null; } }
    W = 0; scene.traverse((o) => { if (o.material) o.material.needsUpdate = true; });
  }
  // The wall base must sit on the 2D layout's horizon (art.js drawRoom used 20% portrait, 30% landscape of the height).
  const tv = new THREE.Vector3();
  function fitCamera(L) {
    const land = L.w >= L.h, aspect = W / H;
    const hz = land ? 0.46 : 0.36;
    // the camera frames the wall and the near end of the rug; wider screens pull back so the niche never dominates
    camera.fov = land ? 36 : 48; camera.aspect = aspect;
    const z = land ? 10.5 : 9.0;
    camera.position.set(0, land ? 2.6 : 2.5, z); camera.lookAt(0, land ? 1.9 : 1.8, -5);
    camera.clearViewOffset(); camera.updateProjectionMatrix(); camera.updateMatrixWorld();
    tv.set(0, 0, -5).project(camera);                       // ndc of the wall base
    const basePx = (1 - (tv.y * 0.5 + 0.5)) * H, wantPx = hz * H;
    camera.setViewOffset(W, H, 0, basePx - wantPx, W, H);
    camera.updateProjectionMatrix();
  }

  // ----- build in slices so the first interactive frame never waits on 3D
  async function build() {
    envHandle = B.createEnvironment(renderer, scene, { intensity: 0.5 }); await tick();
    U = buildRoom(scene, { carpet: 'garnet', shadows: true }); await tick();
    scene.environmentIntensity = 0.5;
    applyTier(); await tick();
    resize(); fitCamera(layoutFor(720, 1560));
    if (renderer.compileAsync) { try { await renderer.compileAsync(scene, camera); await renderer.compileAsync(hud, hudCam); } catch (e) { /* first render compiles */ } }
  }

  function present(state, L, dt) {
    resize();
    if (hudW !== L.w || hudH !== L.h) { hudW = L.w; hudH = L.h; setHudProjection(L.w, L.h); }
    fitCamera(L);
    if (state.carpet && state.carpet !== carpetNow) { carpetNow = state.carpet; setCarpet(U, carpetNow); }
    animateRoom(U, clock, dt, !!state.calm);
    let n = 0;
    for (const p of v3.panels) placePanel(n++, p.r, p.rad, p.kind);
    for (let i = n; i < hudPanels.length; i++) hudPanels[i].g.visible = false;
    n = 0; const pr = v3.pressed;
    for (const b of v3.buttons) { const pressed = !!pr && pr.x >= b.r.x && pr.x <= b.r.x + b.r.w && pr.y >= b.r.y && pr.y <= b.r.y + b.r.h; placeButton(n++, b, pressed); }
    for (let i = n; i < hudButtons.length; i++) hudButtons[i].g.visible = false;
    vig.scale.set(L.w * 1.5, L.h * 1.5, 1); vig.position.set(L.w / 2, -L.h / 2, -790);
    scrim.visible = v3.scrim > 0; scrim.material.opacity = v3.scrim; scrim.scale.set(L.w * 2, L.h * 2, 1); scrim.position.set(L.w / 2, -L.h / 2, -760);
    renderer.setViewport(0, 0, W, H);
    renderer.clear(true, true, true);
    renderer.render(scene, camera);
    renderer.clearDepth();
    hud.environment = scene.environment; hud.environmentIntensity = 0.3;
    renderer.render(hud, hudCam);
  }

  let ready = false;
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); v3.on = false; canvas.style.opacity = '0'; });
  canvas.addEventListener('webglcontextrestored', () => {
    try { envHandle.rebuild(); scene.environmentIntensity = 0.5; } catch (err) { /* no reflections, still playable */ }
    W = 0; resize(); v3.on = ready; canvas.style.opacity = '1';
  });

  const api = {
    ok: true, renderer, scene, camera,
    async init() {
      try { await build(); }
      catch (e) { console.warn('3D init failed; 2D fallback', e); canvas.remove(); v3.on = false; api.ok = false; return false; }
      ready = true; v3.on = true; requestAnimationFrame(() => { canvas.style.opacity = '1'; });
      return true;
    },
    // One frame: the 2D game draws (transparent canvas, reporting its plaques and buttons), then the 3D scene is rendered behind it.
    frame(game, ctx, view) {
      const state = game.getState();
      const L = layoutFor(view?.width ?? 720, view?.height ?? 1560);
      const now = performance.now(), dt = Math.min(0.1, Math.max(0, (now - lastT) / 1000)); lastT = now; clock += dt;
      ema = ema * 0.95 + dt * 1000 * 0.05; frames++;
      if (frames > 90 && ema > 30 && tier < TIERS.length - 1) { tier++; applyTier(); frames = 0; ema = 16; }
      v3.panels.length = 0; v3.buttons.length = 0; v3.scrim = 0;
      game.render(ctx, view);
      try { present(state, L, dt); } catch (e) { console.warn('3D present failed', e); v3.on = false; canvas.style.opacity = '0'; }
    },
  };
  void blobCanvas;
  return api;
}
