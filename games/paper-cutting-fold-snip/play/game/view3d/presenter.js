// Paper Cutting 3D presenter. READS what the 2D layer described this frame (src/v3.js: desk, cutting mat, paper faces + the camera it uses
// for hit-testing) and never writes game state. One WebGL canvas sits behind the kit's transparent 2D canvas. The camera is built from
// the very same numbers as paperview.project() (focal = S / k, eye 1 / k above the table, tilt, yaw, centre), so every cut outline,
// punch ghost and scissors tip the 2D layer draws lines up with the 3D paper to the pixel, and taps map through unproject() unchanged.
// No WebGL, ?flat=1 or a lost context: v3.on = false and every screen draws the flat 2D art; a restored context rebuilds the scene.
import * as THREE from '../vendor3d/three.js';
import * as B from '../vendor3d/board3d.js';
import { v3, resetReq } from '../src/v3.js';
import { meta } from '../src/layout.js';
import { buildLights, buildSet, buildMat, matMaterial, layoutProps, PaperStack, MAT_H } from './world.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const TIERS = [{ name: 'high', dpr: 2, shadow: 2048, aa: true }, { name: 'medium', dpr: 1.5, shadow: 1024, aa: true }, { name: 'low', dpr: 1, shadow: 0, aa: false }];
const tick = () => new Promise((r) => setTimeout(r, 0));
const K = 0.22;                                      // perspective strength of paperview.makeCam

// Camera matrices from paperview's pinhole. Sheet point (x, y, z) -> three.js axes (x, z, y). Screen units are the virtual units the 2D layer draws in.
export function placeCamera(cam, c, vw, vh) {
  const ct = Math.cos(c.tilt), st = Math.sin(c.tilt), cy_ = Math.cos(c.yaw || 0), sy_ = Math.sin(c.yaw || 0), k = c.k ?? K, f = c.S / k;
  const V = new THREE.Matrix4().set(
    cy_, sy_, 0, -cy_ * c.cx,
    -st * sy_, st * cy_, -ct, st * sy_ * c.cx + ct * c.cy,
    -ct * sy_, ct * cy_, st, ct * sy_ * c.cx - st * c.cy - 1 / k,
    0, 0, 0, 1);
  const N = 0.4, F = 60, A = -(F + N) / (F - N), Bz = -2 * F * N / (F - N);
  const P = new THREE.Matrix4().set(
    2 * f / vw, 0, -(2 * c.x / vw - 1), 0,
    0, 2 * f / vh, -(1 - 2 * c.y / vh), 0,
    0, 0, A, Bz,
    0, 0, -1, 0);
  cam.matrixWorldInverse.copy(V); cam.matrixWorld.copy(V).invert(); cam.matrixWorldAutoUpdate = false;
  cam.projectionMatrix.copy(P); cam.projectionMatrixInverse.copy(P).invert();
  cam.position.setFromMatrixPosition(cam.matrixWorld);
}

export async function createPresenter({ kitCanvas }) {
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;height:100dvh;display:block;pointer-events:none;z-index:0;visibility:hidden';
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' }); } catch (e) { console.warn('WebGL unavailable; flat 2D art', e); return { ok: false }; }
  if (!renderer.getContext()) return { ok: false };
  const vig = document.createElement('div');       // soft darkening towards the corners: the lamp's pool of light
  vig.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:0;visibility:hidden;background:radial-gradient(ellipse at 50% 42%,rgba(0,0,0,0) 46%,rgba(8,3,1,0.42) 100%)';
  kitCanvas.parentElement.insertBefore(canvas, kitCanvas); kitCanvas.parentElement.insertBefore(vig, kitCanvas);
  kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  let tier = (navigator.hardwareConcurrency || 8) <= 4 ? 1 : 0;

  await tick();
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x120a07);
  const camera = new THREE.PerspectiveCamera(30, 1, 0.4, 60);
  const lights = buildLights(scene);
  const buildEnv = () => { try { const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture; pm.dispose(); scene.environmentIntensity = 0.22; } catch { /* no IBL */ } };
  buildEnv();
  await tick();
  const set = buildSet(tier); scene.add(set);
  await tick();
  const matG = buildMat(); matG.visible = false; set.add(matG);
  const paper = new PaperStack(); scene.add(paper.group);

  function applyTier() {
    const t = TIERS[tier];
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, t.dpr));
    renderer.shadowMap.enabled = t.shadow > 0; lights.sun.castShadow = t.shadow > 0;
    if (t.shadow) { lights.sun.shadow.mapSize.set(t.shadow, t.shadow); if (lights.sun.shadow.map) { lights.sun.shadow.map.dispose(); lights.sun.shadow.map = null; } }
    scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => { if (m && m.isMaterial) m.needsUpdate = true; }); });
  }
  applyTier();

  // ---------------------------------------------------------------- the frame
  let game = null, lost = false, lastNow = 0, clock = 0, frameAvg = 16, slowFrames = 0, fadeIn = 0, matSize = [0, 0];
  const vw = () => meta.width, vh = () => meta.height;
  const defCam = () => ({ x: vw() / 2, y: vh() * 0.46, S: Math.min(vw(), vh()) * 0.56, cx: 0, cy: 0.1, tilt: 0.56, yaw: 0.05 * Math.sin(clock * 0.2), roll: 0, k: K });
  // sheet-plane point under a virtual screen point for the roll-less camera (z = 0)
  const under = (c, sx, sy) => {
    const v = (sy - c.y) / c.S, st = Math.sin(c.tilt), ct = Math.cos(c.tilt);
    const y2 = v / (ct + c.k * st * v), f = 1 / (1 - c.k * y2 * st);
    return [c.cx + (sx - c.x) / (c.S * f), c.cy + y2];
  };
  const propsOn = (on) => { const P = set.userData.props; for (const k of ['scissors', 'folder', 'pad', 'chop', 'cup']) P[k].visible = on; P.scraps.forEach((o) => { o.visible = on; }); };
  function placeMat(req, c) {
    // the props belong to the title picture and to the screens without a board; the play mat fills the board, so there they would only peek out behind the panels
    propsOn(!req || Boolean(req.hero));
    if (!req) { matG.visible = false; layoutProps(set, c.cx, c.cy, 1.4, 1.4); return; }
    matG.visible = true;
    const a = under(c, req.x, req.y), b = under(c, req.x + req.w, req.y), d = under(c, req.x, req.y + req.h);
    const w = Math.max(0.2, Math.min(b[0] - a[0], 30)), dp = Math.max(0.2, Math.min(d[1] - a[1], 30));
    const mesh = matG.userData.mesh;
    if (Math.abs(w - matSize[0]) > 0.004 || Math.abs(dp - matSize[1]) > 0.004) {
      mesh.geometry.dispose(); mesh.geometry = B.slab(w, dp, MAT_H, Math.min(0.12, w * 0.05), 0.02, { uvScale: 1 }); matSize = [w, dp];
    }
    mesh.material = matMaterial(req.color, req.dark);
    matG.position.set(a[0] + w / 2, 0, a[1] + dp / 2);
    layoutProps(set, a[0] + w / 2, a[1] + dp / 2, w, dp);
  }
  function frame() {
    if (!game || lost) return;
    const now = performance.now(), dt = clamp((now - (lastNow || now)) / 1000, 0, 0.1); lastNow = now; clock += dt;
    const req = v3.req, job = req.paper;
    const c = job ? { ...job.cam, roll: 0 } : defCam();
    if (req.mat && req.mat.hero) { c.yaw = (c.yaw || 0) + 0.07 * Math.sin(clock * 0.31); c.tilt += 0.03 * Math.sin(clock * 0.23 + 1); }   // the title picture breathes: a slow drift of the camera
    // the table (desk, mat, props) sits at the paper's lowest point so the paper lies ON the mat
    let minZ = 0;
    if (job) { const r = paper.update(job, TIERS[tier].aa); minZ = r.minZ; paper.group.visible = true; } else paper.group.visible = false;
    const top = minZ - 0.004;
    set.position.set(0, top - MAT_H, 0);
    placeMat(req.mat ?? null, c);
    lights.sun.target.position.set(c.cx, top, c.cy); lights.sun.position.set(c.cx - 3.2, top + 5.4, c.cy - 2.6);
    lights.lamp.position.set(c.cx - 1.9, top + 2.4, c.cy - 1.4);
    lights.lamp.intensity = 22 * (1 + 0.025 * Math.sin(clock * 7.3) + 0.015 * Math.sin(clock * 13.1 + 1.7));
    placeCamera(camera, c, vw(), vh());
    if (fadeIn < 1) { fadeIn = Math.min(1, fadeIn + dt / 0.45); v3.fade = fadeIn; }
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    renderer.render(scene, camera);
    const ft = dt * 1000; if (ft > 0) frameAvg = frameAvg * 0.95 + ft * 0.05;
    if (frameAvg > 26 && tier < 2) { if (++slowFrames > 90) { tier++; slowFrames = 0; frameAvg = 16; applyTier(); } } else slowFrames = 0;
  }
  const pre = () => { if (!game || lost) return; resetReq(); };
  const post = () => frame();

  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; v3.on = false; canvas.style.visibility = vig.style.visibility = 'hidden'; });
  canvas.addEventListener('webglcontextrestored', () => { lost = false; buildEnv(); applyTier(); fadeIn = 0; v3.fade = 0; v3.on = true; canvas.style.visibility = vig.style.visibility = 'visible'; });

  await tick();
  placeCamera(camera, defCam(), vw(), vh()); try { renderer.compile(scene, camera); } catch { /* compiled lazily */ }
  await tick();
  let loseExt = null;
  return {
    ok: true, renderer, scene, camera,
    attach(g) { game = g; v3.on = true; v3.fade = 0; fadeIn = 0; canvas.style.visibility = vig.style.visibility = 'visible'; },
    pre, post,
    get tier() { return TIERS[tier].name; },
    loseContext() { loseExt = renderer.getContext().getExtension('WEBGL_lose_context'); loseExt?.loseContext(); return Boolean(loseExt); },
    restoreContext() { loseExt?.restoreContext(); },
  };
}
