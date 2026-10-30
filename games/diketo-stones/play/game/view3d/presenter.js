// Diketo 3D presenter. READS what the 2D layer drew this frame (src/v3.js) and never writes game state. One WebGL canvas sits behind the
// kit's transparent 2D canvas: a swept-earth yard with a chalk circle and a hollow, lit by a low warm sun, with real glossy stones
// (clear-coated, speckled, soft shadows) and the larger throwing stone. The camera is a slightly tilted perspective camera solved from the
// 2D layout, and an affine fitted to it is handed back so every flat overlay (rings, routes, badges, particles, the hand ring) lands on the stones.
// No WebGL, ?flat=1 or a lost context: v3.on = false and the flat 2D art draws everything; a restored context returns to 3D without a reload.
import * as THREE from '../vendor3d/three.js';
import { v3 } from '../src/v3.js';
import { meta } from '../src/layout.js';
import { drawFloor, STONE_PAL } from '../src/art.js';
import { R, GHO_R, PIT, YARD_R } from '../src/sim.js';

const D2R = Math.PI / 180;
const CX = 330, CZ = 400;                         // the world point the camera looks at (middle of the 660 x 800 yard)
const TIERS = [{ dpr: 2, shadow: 2048 }, { dpr: 1.5, shadow: 1024 }, { dpr: 1, shadow: 0 }];
const tick = () => new Promise((r) => setTimeout(r, 0));
let seed = 7;
const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
const canvasOf = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const tex = (c, srgb = true) => { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };

function stoneTexture(P) {
  const c = canvasOf(256, 128), g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, P.hi); gr.addColorStop(0.5, P.mid); gr.addColorStop(1, P.lo);
  g.fillStyle = gr; g.fillRect(0, 0, 256, 128);
  for (let i = 0; i < 26; i++) { g.strokeStyle = `rgba(255,255,255,${0.05 + rnd() * 0.1})`; g.lineWidth = 1 + rnd() * 2; g.beginPath(); const y = rnd() * 128; g.moveTo(0, y); g.bezierCurveTo(80, y + (rnd() - 0.5) * 40, 170, y + (rnd() - 0.5) * 40, 256, y + (rnd() - 0.5) * 30); g.stroke(); }
  for (let i = 0; i < 260; i++) { g.fillStyle = rnd() < 0.7 ? P.dot : 'rgba(255,255,255,0.22)'; g.beginPath(); g.arc(rnd() * 256, rnd() * 128, 0.8 + rnd() * 2.2, 0, 7); g.fill(); }
  return tex(c);
}
function ghoTexture() {
  const c = canvasOf(256, 128), g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, '#fffdf2'); gr.addColorStop(0.55, '#f0e6cc'); gr.addColorStop(1, '#c9bb9a');
  g.fillStyle = gr; g.fillRect(0, 0, 256, 128);
  g.fillStyle = 'rgba(196,84,40,0.85)'; g.fillRect(0, 54, 256, 16);
  g.fillStyle = 'rgba(40,20,10,0.5)'; g.fillRect(0, 50, 256, 3); g.fillRect(0, 71, 256, 3);
  for (let i = 0; i < 140; i++) { g.fillStyle = 'rgba(120,100,70,0.2)'; g.beginPath(); g.arc(rnd() * 256, rnd() * 128, 0.8 + rnd() * 1.6, 0, 7); g.fill(); }
  return tex(c);
}
function rakeTexture() {                                    // the swept inside of the chalk circle: concentric broom strokes, lighter in the middle
  const S = 1024, c = canvasOf(S, S), g = c.getContext('2d'), m = S / 2;
  const rg = g.createRadialGradient(m, m, 0, m, m, m); rg.addColorStop(0, 'rgba(255,224,170,0.34)'); rg.addColorStop(0.7, 'rgba(255,214,150,0.16)'); rg.addColorStop(0.96, 'rgba(255,214,150,0.07)'); rg.addColorStop(1, 'rgba(255,214,150,0)');
  g.fillStyle = rg; g.beginPath(); g.arc(m, m, m, 0, 7); g.fill();
  for (let i = 0; i < 90; i++) {
    const r = 40 + rnd() * (m - 60), a0 = rnd() * 6.28, sp = 0.4 + rnd() * 1.6;
    g.strokeStyle = rnd() < 0.5 ? 'rgba(255,236,196,0.2)' : 'rgba(90,46,18,0.2)'; g.lineWidth = 0.8 + rnd() * 1.6;
    g.beginPath(); g.arc(m, m, r, a0, a0 + sp); g.stroke();
  }
  return tex(c);
}
function pitTexture() {                                    // the hollow seen from above: lit lip, deep floor, shadow wall on the far side
  const S = 512, c = canvasOf(S, S), g = c.getContext('2d'), m = S / 2;
  const o = g.createRadialGradient(m, m, m * 0.7, m, m, m); o.addColorStop(0, 'rgba(70,36,16,0.9)'); o.addColorStop(0.55, 'rgba(120,76,42,0.5)'); o.addColorStop(1, 'rgba(120,76,42,0)');
  g.fillStyle = o; g.beginPath(); g.arc(m, m, m, 0, 7); g.fill();
  const inner = m * 0.74, f = g.createRadialGradient(m + 30, m + 44, 10, m, m, inner);
  f.addColorStop(0, '#5a3119'); f.addColorStop(0.6, '#3b1d0d'); f.addColorStop(1, '#1d0c04');
  g.fillStyle = f; g.beginPath(); g.arc(m, m, inner, 0, 7); g.fill();
  g.save(); g.beginPath(); g.arc(m, m, inner, 0, 7); g.clip();
  g.strokeStyle = 'rgba(8,2,0,0.65)'; g.lineWidth = 70; g.beginPath(); g.arc(m + 30, m + 46, inner + 34, 0, 7); g.stroke(); g.restore();
  g.strokeStyle = 'rgba(255,226,180,0.5)'; g.lineWidth = 7; g.beginPath(); g.arc(m, m, inner - 2, 0.15, 1.5); g.stroke();
  return tex(c);
}
function ribbon(r, w, wob, y) {                             // a hand-chalked ring lying on the ground
  const N = 160, pos = [], idx = [];
  for (let i = 0; i <= N; i++) { const a = (i % N) / N * 6.2832, rr = r + wob * Math.sin(a * 5 + wob) * 0.6 + (rnd() - 0.5) * wob * 0.8, ww = w * (0.7 + rnd() * 0.6); pos.push(Math.cos(a) * (rr - ww / 2), y, Math.sin(a) * (rr - ww / 2), Math.cos(a) * (rr + ww / 2), y, Math.sin(a) * (rr + ww / 2)); }
  for (let i = 0; i < N; i++) { const k = i * 2; idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xfaf3e0, roughness: 1, transparent: true, opacity: 0.8, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
  mesh.receiveShadow = true; return mesh;
}

export async function createPresenter({ kitCanvas }) {
  const qs = new URLSearchParams(location.search), noop = { ok: false };
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;height:100dvh;display:block;pointer-events:none;z-index:0;visibility:hidden';
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' }); } catch (e) { console.warn('WebGL unavailable; flat 2D art', e); return noop; }
  if (!renderer.getContext()) return noop;
  kitCanvas.parentElement.insertBefore(canvas, kitCanvas);
  kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.82;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  const tier = qs.has('tier') ? Math.max(0, Math.min(2, Number(qs.get('tier')))) : (navigator.hardwareConcurrency || 8) <= 4 ? 1 : 0;
  await tick();

  const scene = new THREE.Scene();
  const BG = 0x24120a;
  scene.background = new THREE.Color(BG); scene.fog = new THREE.Fog(BG, 1100, 2600);
  const camera = new THREE.PerspectiveCamera(34, 1, 40, 5000);
  const sun = new THREE.DirectionalLight(0xffcf98, 2.6); sun.position.set(CX - 420, 760, CZ - 90); sun.target.position.set(CX, 0, CZ + 20);
  Object.assign(sun.shadow.camera, { left: -520, right: 520, top: 560, bottom: -560, near: 100, far: 2200 });
  sun.shadow.bias = -0.0006; sun.shadow.normalBias = 1.2; sun.shadow.radius = 4;
  const rim = new THREE.DirectionalLight(0x9db4ff, 0.7); rim.position.set(CX + 300, 260, CZ - 700);
  const hemi = new THREE.HemisphereLight(0xffd9b0, 0x2a1209, 0.5);
  scene.add(sun, sun.target, rim, hemi);
  const buildEnv = () => { try { const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture; pm.dispose(); scene.environmentIntensity = 0.4; } catch { /* no IBL */ } };
  buildEnv();
  await tick();

  // ---- the ground, the swept yard, the chalk circle, the hollow
  const flat = canvasOf(720, 1280); drawFloor(flat.getContext('2d'), 720, 1280);
  const groundTex = tex(flat); const bump = tex(flat, false);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1500, 2667), new THREE.MeshStandardMaterial({ map: groundTex, bumpMap: bump, bumpScale: 2.2, color: 0xc4a58f, roughness: 0.92, metalness: 0 }));
  ground.rotation.x = -Math.PI / 2; ground.position.set(CX, 0, CZ); ground.receiveShadow = true; scene.add(ground);
  const apron = new THREE.Mesh(new THREE.PlaneGeometry(14000, 14000), new THREE.MeshStandardMaterial({ color: 0x1c0d05, roughness: 1 }));   // dark earth past the yard so a low camera never shows an edge
  apron.rotation.x = -Math.PI / 2; apron.position.set(CX, -0.6, CZ); apron.receiveShadow = true; scene.add(apron);
  const vg = canvasOf(512, 512), vx = vg.getContext('2d'), vr = vx.createRadialGradient(256, 256, 120, 256, 256, 256);
  vr.addColorStop(0, 'rgba(12,5,1,0)'); vr.addColorStop(1, 'rgba(12,5,1,0.78)'); vx.fillStyle = vr; vx.fillRect(0, 0, 512, 512);
  const vig = new THREE.Mesh(new THREE.PlaneGeometry(1500, 2667), new THREE.MeshBasicMaterial({ map: tex(vg), transparent: true, depthWrite: false }));
  vig.rotation.x = -Math.PI / 2; vig.position.set(CX, 0.9, CZ); scene.add(vig);
  const swept = new THREE.Mesh(new THREE.CircleGeometry(YARD_R + 12, 96), new THREE.MeshStandardMaterial({ map: rakeTexture(), transparent: true, roughness: 1, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 }));
  swept.rotation.x = -Math.PI / 2; swept.position.set(PIT.x, 0.2, PIT.y); swept.receiveShadow = true; scene.add(swept);
  const chalk = new THREE.Group(); chalk.position.set(PIT.x, 0, PIT.y);
  chalk.add(ribbon(YARD_R, 7, 2.4, 0.5), ribbon(YARD_R - 1.5, 3.4, 1.6, 0.55), ribbon(YARD_R + 1.5, 2, 1.2, 0.6)); scene.add(chalk);
  const pit = new THREE.Group(); pit.position.set(PIT.x, 0, PIT.y);
  const decal = new THREE.Mesh(new THREE.CircleGeometry(PIT.r * 1.34, 72), new THREE.MeshStandardMaterial({ map: pitTexture(), transparent: true, roughness: 1, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 }));
  decal.rotation.x = -Math.PI / 2; decal.position.y = 0.7; decal.receiveShadow = true;
  const lip = new THREE.Mesh(new THREE.TorusGeometry(PIT.r, 5.5, 10, 72), new THREE.MeshStandardMaterial({ color: 0xb88452, roughness: 0.95 }));
  lip.rotation.x = -Math.PI / 2; lip.position.y = 1.6; lip.scale.z = 0.45; lip.receiveShadow = true; lip.castShadow = true;
  pit.add(decal, lip); scene.add(pit);
  await tick();

  // ---- stones
  const stoneMats = STONE_PAL.map((P) => new THREE.MeshPhysicalMaterial({ map: stoneTexture(P), color: 0xdcdcdc, roughness: 0.28, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 1.3 }));
  const sphere = new THREE.SphereGeometry(1, 36, 22);
  const gTex = ghoTexture();
  const stones = [], ghos = [];
  const stoneAt = (i) => { if (!stones[i]) { const m = new THREE.Mesh(sphere, stoneMats[0]); m.castShadow = true; m.receiveShadow = true; scene.add(m); stones[i] = m; } return stones[i]; };
  const ghoAt = (i) => { if (!ghos[i]) { const m = new THREE.Mesh(sphere, new THREE.MeshPhysicalMaterial({ map: gTex, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.06, transparent: true })); m.castShadow = true; m.receiveShadow = true; scene.add(m); ghos[i] = m; } return ghos[i]; };

  function applyTier() {
    const t = TIERS[tier];
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, t.dpr));
    renderer.shadowMap.enabled = t.shadow > 0; sun.castShadow = t.shadow > 0;
    if (t.shadow) { sun.shadow.mapSize.set(t.shadow, t.shadow); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } }
    scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => { m.needsUpdate = true; }); });
  }
  applyTier();

  // ---- css <-> virtual units (the kit's fluid mapping) and the camera solved from the 2D layout
  const cssW = () => Math.max(1, window.innerWidth), cssH = () => Math.max(1, window.innerHeight);
  const cpu = () => meta.cssPerUnit || Math.min(cssW() / meta.width, cssH() / meta.height);
  const offX = () => (cssW() - meta.width * cpu()) / 2, offY = () => (cssH() - meta.height * cpu()) / 2;
  const tmp = new THREE.Vector3();
  const toVirtual = (wx, wz) => { tmp.set(wx, 0, wz).project(camera); return [((tmp.x + 1) / 2 * cssW() - offX()) / cpu(), ((1 - tmp.y) / 2 * cssH() - offY()) / cpu()]; };
  let live = false;
  function setup(f) {
    const W = cssW(), H = cssH(), title = f.mode === 'title';
    const pitch = (title ? 46 : 67) * D2R, yaw = title ? Math.sin(performance.now() / 5200) * 5 * D2R : 0;
    const ppu = f.s * cpu() * (title ? 0.84 : 0.97);
    let tc = { x: (f.ox + CX * f.s) * cpu() + offX(), y: (f.oy + CZ * f.s) * cpu() + offY() };
    if (title) tc = W < H * 1.2 ? { x: W / 2, y: H * 0.8 } : { x: W * 0.27, y: H * 0.54 };   // hero view: the tilted yard sits low (portrait) or left (landscape), clear of the menu buttons
    const D = (H / 2) / (Math.tan(camera.fov * D2R / 2) * ppu);
    if (renderer.domElement.width !== Math.round(W * renderer.getPixelRatio())) renderer.setSize(W, H, false);
    camera.aspect = W / H; scene.fog.near = D * 1.15; scene.fog.far = D * 2.4; camera.far = D * 4; camera.near = D * 0.1;
    camera.position.set(CX + Math.sin(yaw) * Math.cos(pitch) * D, Math.sin(pitch) * D, CZ + Math.cos(yaw) * Math.cos(pitch) * D);
    camera.up.set(0, 1, 0); camera.lookAt(CX, 0, CZ);
    camera.setViewOffset(W, H, W / 2 - tc.x, H / 2 - tc.y, W, H); camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
    const [x0, y0] = toVirtual(CX, CZ), [x1, y1] = toVirtual(CX + 200, CZ), [x2, y2] = toVirtual(CX, CZ + 200);
    const a = (x1 - x0) / 200, b = (y1 - y0) / 200, c = (x2 - x0) / 200, d = (y2 - y0) / 200;
    return (lastAff = [a, b, c, d, x0 - a * CX - c * CZ, y0 - b * CX - d * CZ]);
  }

  let lastAff = null;
  const trackErr = () => {                                   // dev metric: how far (css px) the true perspective projection of each stone is from the affine the 2D overlays use
    const f = v3.frame, m = lastAff; if (!f || !m || !f.items.length) return null; let mx = 0;
    for (const it of f.items) { const [px, py] = toVirtual(it.x, it.y), ax = m[0] * it.x + m[2] * it.y + m[4], ay = m[1] * it.x + m[3] * it.y + m[5]; mx = Math.max(mx, Math.hypot(px - ax, py - ay) * cpu()); }
    return mx;
  };
  function post() {
    const f = v3.frame; if (!f || !live) return;
    const sc = f.pitR / PIT.r || 1; pit.scale.set(sc, 1, sc);
    let n = 0;
    for (const it of f.items) {
      const m = stoneAt(n++), P = it.id % STONE_PAL.length, k = it.sc;
      const rx = R * 1.14 * (1.04 + 0.07 * Math.sin(it.id * 1.9)) * k, rz = R * 1.14 * (0.94 - 0.05 * Math.cos(it.id * 2.3)) * k, h = R * 0.78 * k;
      m.material = stoneMats[P]; m.visible = true;
      m.scale.set(rx, h, rz); m.position.set(it.x, h * 0.92 + it.z * 0.8 - (it.inPit ? 7 : 0), it.y); m.rotation.set(0, -it.rot, 0);
    }
    for (; n < stones.length; n++) stones[n].visible = false;
    let g = 0;
    for (const o of f.ghos) {
      const m = ghoAt(g++); m.visible = o.alpha > 0.04; m.material.opacity = o.alpha;
      m.scale.setScalar(GHO_R * o.sc); m.position.set(o.x, GHO_R * 0.92 + o.z * 0.8, o.y); m.rotation.set(o.spin * 0.7, o.spin, 0.25);
    }
    for (; g < ghos.length; g++) ghos[g].visible = false;
    renderer.render(scene, camera);
    if (canvas.style.visibility !== 'visible') canvas.style.visibility = 'visible';
  }

  const gl = renderer.getContext(), loseExt = gl.getExtension('WEBGL_lose_context');
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); live = false; v3.on = false; v3.setup = null; canvas.style.visibility = 'hidden'; });
  canvas.addEventListener('webglcontextrestored', () => { buildEnv(); applyTier(); live = true; v3.setup = setup; v3.on = true; });
  live = true; v3.setup = setup; v3.on = true;
  return {
    ok: true, v3, post, camera, canvas,
    lose: () => loseExt,
    tierOf: () => tier, info: () => ({ calls: renderer.info.render.calls, triangles: renderer.info.render.triangles }), track: () => null, trackErr,
  };
}
