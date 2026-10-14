// The 3D presenter: reads state.v3 (published by the game each frame) and draws the pit behind the kit's transparent 2D canvas.
// It never writes back to the game. If WebGL is missing, the context is lost or the layer fails to load, game.setGl(false) keeps the
// painted pit on screen; the game plays exactly the same.
import { THREE } from '../vendor3d/index.js';
import { makeCam } from '../src/cam.js';
import { buildRoom } from './room.js';
import { loadCircle, updateCircle, setCircleLod } from './crew.js';

const T = THREE;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export async function createPresenter({ kitCanvas, quality = 'high', force2d = false }) {
  const win = globalThis;
  const none = { ok: false, wrap: (g) => g, quality };
  if (force2d) return none;
  let renderer;
  const canvas = win.document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;left:0;top:0;width:100vw;height:100vh;height:100dvh;display:block;pointer-events:none;z-index:0;visibility:hidden';
  try {
    kitCanvas.parentElement.insertBefore(canvas, kitCanvas);
    kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
    renderer = new T.WebGLRenderer({ canvas, antialias: quality !== 'low', powerPreference: 'high-performance', alpha: false });
    if (!renderer.getContext()) throw new Error('no context');
  } catch (e) { canvas.remove(); return none; }
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = quality !== 'low';
  renderer.shadowMap.type = T.PCFShadowMap;

  const room = buildRoom({ quality });
  const camera = new T.PerspectiveCamera(34, 1, 0.5, 120);
  const api = { ok: true, ready: false, lost: false, failed: false, quality, canvas, renderer, room, circle: null, frameMs: 0, wrap: null };
  let W = 0, H = 0, dprNow = 0, lastT = null, clock = 0, shakeClock = 0, costAvg = 0, costN = 0, degraded = false;

  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); api.lost = true; });
  canvas.addEventListener('webglcontextrestored', () => { api.lost = false; dprNow = 0; });

  // the circle loads in the background; the painted pit is shown until it is ready
  loadCircle(room.scene, room, { quality, camera }).then((c) => { api.circle = c; api.ready = true; }).catch((e) => { console.warn('3D circle failed to load; using the painted pit', e); api.failed = true; });

  const resize = () => {
    const w = win.innerWidth, h = win.innerHeight;
    const cap = degraded ? 1 : quality === 'high' ? 2 : quality === 'medium' ? 1.6 : 1.25;
    const dpr = Math.min(win.devicePixelRatio || 1, cap);
    if (w === W && h === H && dpr === dprNow) return;
    W = w; H = h; dprNow = dpr; renderer.setPixelRatio(dpr); renderer.setSize(w, h, false);
  };

  function frame(game) {
    const st = game.getState();
    let v = st.v3;
    if (v && api.forceActs) v = { ...v, acts: api.forceActs };                     // art tools only (icon, shots): hold a chosen pose
    const usable = api.ok && api.ready && !api.lost && !api.failed && !!v && v.on;
    game.setGl(usable);
    if (!usable) { canvas.style.visibility = 'hidden'; return; }
    const t0 = win.performance.now();
    resize();
    // presentation clock: follows the sim clock (st.t), frozen while the game is paused
    let dt = lastT === null ? 0 : st.t - lastT; lastT = st.t;
    if (dt < 0 || dt > 0.25) dt = 0;
    dt = Math.min(dt, 0.05);
    const frozen = !!v.frozen;
    if (frozen) dt = 0; else clock += dt;
    shakeClock += dt;

    // camera: the same pure maths the 2D overlay uses (src/cam.js), so glyphs sit exactly where the athletes stand
    const cam = makeCam(v.w, v.h, v.pit);
    camera.aspect = v.w / v.h;
    camera.position.set(0, cam.D * cam.se, cam.D * cam.ce);
    if (v.shake > 0) { const k = v.shake * 0.05; camera.position.x += Math.sin(shakeClock * 90) * k; camera.position.y += Math.cos(shakeClock * 70) * k * 0.8; }
    if (v.scene === 'title' && !api.cameraOverride) camera.position.x += Math.sin(clock * 0.28) * 0.3;      // the hero scene breathes: a slow drift
    camera.lookAt(0, 0, 0);
    camera.near = Math.max(0.5, cam.D - 14); camera.far = cam.D + 70;
    camera.updateProjectionMatrix();
    const e = camera.projectionMatrix.elements;
    e[8] -= (2 * cam.ox) / v.w; e[9] += (2 * cam.oy) / v.h;
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
    if (api.cameraOverride) {                         // art tools only (store icon / close-ups): a free camera
      const o = api.cameraOverride; camera.fov = o.fov || 34; camera.near = 0.1; camera.far = 100;
      camera.position.set(...o.eye); camera.lookAt(...o.at); camera.updateProjectionMatrix();
    }
    camera.updateMatrixWorld(true);

    if (api.circle) { setCircleLod(api.circle, api.cameraOverride ? 999 : cam.ppm); updateCircle(api.circle, v, dt, clock); }

    // room: beat pulse ring, unison inlay and lamp flicker
    const pr = room.pulse, pk = clamp(v.pulse || 0, 0, 1);
    pr.visible = pk > 0.01; if (pr.visible) { pr.scale.setScalar(1.0 + (1 - pk) * 1.9); pr.material.opacity = pk * 0.55; }
    room.inlay.material.opacity = 0.18 + 0.5 * clamp(v.unison ?? 0, 0, 1) + 0.15 * pk;
    room.lamps.forEach((sp, k) => { sp.material.opacity = 0.85 + 0.15 * Math.sin(clock * 3.1 + k * 1.7); });

    canvas.style.visibility = 'visible';
    renderer.render(room.scene, camera);

    // frame-cost guard: a slow device drops to the cheap tier once (no shadows, DPR 1)
    const ms = win.performance.now() - t0;
    costAvg = costN ? costAvg * 0.96 + ms * 0.04 : ms; costN++; api.frameMs = costAvg;
    if (!degraded && costN > 120 && costAvg > 14 && quality !== 'low') {
      degraded = true; renderer.shadowMap.enabled = false; room.key.castShadow = false; dprNow = 0;
      room.scene.traverse((o) => { if (o.material) o.material.needsUpdate = true; });
    }
  }

  api.wrap = (game) => {
    game.setGl(false);
    const r = game.render.bind(game);
    game.render = (ctx, view) => {
      r(ctx, view);                      // the 2D overlay of THIS frame (glyphs, HUD); it also publishes state.v3 for the 3D frame below
      try { frame(game); } catch (err) { if (!game.__v3err) { game.__v3err = 1; console.warn('3D frame error', err); } api.failed = true; game.setGl(false); canvas.style.visibility = 'hidden'; }
    };
    return game;
  };
  // test hook: simulate losing the context (and restoring it)
  api.loseContext = (ms = 1500) => {
    const gl = renderer.getContext(), ext = gl.getExtension('WEBGL_lose_context');
    if (!ext) return false;
    ext.loseContext(); setTimeout(() => ext.restoreContext(), ms);
    return true;
  };
  return api;
}
