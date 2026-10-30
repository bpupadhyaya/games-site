// Disc Flick Table 3D presenter. READS what the 2D layer asked for this frame (src/v3.js: table transform, discs, peg flashes) and never
// writes game state. One WebGL canvas sits behind the kit's transparent 2D canvas. The camera looks straight down and is fitted so the
// board plane (y = 0) maps to the 2D layer's board transform exactly: aiming, pulling and every tap stay pixel-true.
// No WebGL, ?flat=1 or a lost context: v3.ready = false and every screen draws the flat 2D art.
import * as THREE from '../vendor3d/three.js';
import { v3 } from '../src/v3.js';
import { R_DISC, R_BOARD } from '../src/sim.js';
import { buildCloth, buildBoard, makeDisc, buildLights, disposeGroup, DISC_H, CLOTH_Y } from './world.js';

const TIERS = [{ name: 'high', dpr: 2, shadow: 2048, tex: 2048 }, { name: 'medium', dpr: 1.5, shadow: 1024, tex: 1536 }, { name: 'low', dpr: 1, shadow: 0, tex: 1024 }];
const tick = () => new Promise((r) => setTimeout(r, 0));
const FOV = 38, TAN = Math.tan((FOV / 2) * Math.PI / 180);

export async function createPresenter({ kitCanvas }) {
  const qs = new URLSearchParams(location.search);
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;height:100dvh;display:block;pointer-events:none;z-index:0';
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' }); } catch (e) { console.warn('WebGL unavailable; flat 2D art', e); return { ok: false }; }
  if (!renderer.getContext()) return { ok: false };
  kitCanvas.parentElement.insertBefore(canvas, kitCanvas);
  kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.95; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  let tier = qs.has('tier') ? Math.max(0, Math.min(2, Number(qs.get('tier')))) : (navigator.hardwareConcurrency || 8) <= 4 ? 1 : 0;
  await tick();
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x1a0607);
  const camera = new THREE.PerspectiveCamera(FOV, 1, 50, 9000);
  const lights = buildLights(scene);
  try { const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture; pm.dispose(); scene.environmentIntensity = 0.28; } catch { /* no IBL */ }
  await tick();
  scene.add(buildCloth());
  const world = new THREE.Group(); scene.add(world);     // rotates with the 2D board
  let board = null;
  function applyTier() {
    const t = TIERS[tier];
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, t.dpr));
    renderer.shadowMap.enabled = t.shadow > 0; lights.sun.castShadow = t.shadow > 0;
    if (t.shadow) { lights.sun.shadow.mapSize.set(t.shadow, t.shadow); if (lights.sun.shadow.map) { lights.sun.shadow.map.dispose(); lights.sun.shadow.map = null; } }
    if (board) { world.remove(board); board.traverse((o) => o.material && o.material.map && o.material.map.dispose()); disposeGroup(board); }
    board = buildBoard(t.tex); world.add(board);
    scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => { m.needsUpdate = true; }); });
  }
  applyTier(); await tick();
  const pool = [[], []];         // per team
  const take = (team, i) => { const p = pool[team]; while (p.length <= i) { const d = makeDisc(team); d.visible = false; world.add(d); p.push(d); } return p[i]; };
  for (let i = 0; i < 6; i++) { take(0, i); take(1, i); }
  await tick();

  const cssW = () => Math.max(1, window.innerWidth), cssH = () => Math.max(1, window.innerHeight);
  let lastW = 0, lastH = 0;
  function place(T) {
    const W = cssW(), H = cssH(), cper = Math.min(W, H) / 720, k = Math.max(0.01, T.s * cper);   // css px per board unit on the board plane
    const dist = H / (2 * k * TAN);
    camera.aspect = W / H; camera.position.set(0, dist, 0); camera.up.set(0, 0, -1); camera.lookAt(0, 0, 0);
    camera.near = dist * 0.3; camera.far = dist * 2.5;
    camera.setViewOffset(W, H, -(T.cx * cper - W / 2), -(T.cy * cper - H / 2), W, H);
    camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
  }
  function frame() {
    const T = v3.table; if (!T) return;
    place(T); world.rotation.y = -(T.rot || 0);
    // pegs
    const pf = v3.pegFlash, pegs = board.userData.pegs;
    for (let i = 0; i < pegs.length; i++) pegs[i].userData.mat.emissiveIntensity = pf && pf[i] > 0.02 ? Math.min(1.6, pf[i] * 1.6) : 0;
    // discs
    const used = [0, 0];
    for (const D of v3.discs) {
      const d = take(D.team, used[D.team]++), sc = D.sc || 1;
      d.visible = D.a > 0.02; d.position.set(D.x, Math.max(-DISC_H * 2.2, D.lift || 0) - (D.sink || 0), D.y); d.scale.set(sc, Math.max(0.2, sc), sc);
      d.userData.face.rotation.z = -(D.spin || 0);
      d.userData.glow.material.opacity = Math.min(0.8, (D.glow || 0) * 0.8);
    }
    for (let t = 0; t < 2; t++) for (let i = used[t]; i < pool[t].length; i++) pool[t][i].visible = false;
    const sw = cssW(), sh = cssH(); if (sw !== lastW || sh !== lastH) { renderer.setSize(sw, sh, false); lastW = sw; lastH = sh; }
    renderer.render(scene, camera);
  }
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); v3.ready = false; });
  canvas.addEventListener('webglcontextrestored', () => { applyTier(); lastW = 0; v3.ready = true; });
  void R_DISC; void R_BOARD; void CLOTH_Y;
  return { ok: true, canvas, camera, frame, tier: () => TIERS[tier].name, setTier: (t) => { tier = t; applyTier(); } };
}
