// Bamboo Copter 3D presenter. READS the simulation (game.getState()) and what the 2D layer published in src/v3.js; never writes back.
// One WebGL canvas sits behind the kit's transparent 2D canvas: pass A draws the sky and the world (camera mapped so the z = 0 plane
// is exactly the 2D camera), pass B draws the toy and the two hands on top (own camera). HUD, text and menus stay on the 2D canvas.
// Fallbacks: no WebGL / assets fail / context lost -> v3.on = false and every screen draws with the 2D art; restored -> back to 3D.
import * as THREE from '../vendor3d/three.js';
import { v3 } from '../src/v3.js';
import { createWorld, createSky, RIGS } from './world.js';
import { COPTER_SCALE } from './toy.js';
import { PALS, FIT_M } from '../src/art.js';
import { groundAt } from '../src/sim.js';

const TIERS = [{ name: 'high', dpr: 2, q: 1 }, { name: 'medium', dpr: 1.5, q: 0.7 }, { name: 'low', dpr: 1, q: 0.45 }];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, k) => a + (b - a) * k;
const smooth = (t) => { const u = clamp(t, 0, 1); return u * u * (3 - 2 * u); };

export async function createPresenter({ kitCanvas, quality = 'high' }) {
  const noop = { wrap: (g) => g, ok: false };
  const qs = new URLSearchParams(location.search);
  if (qs.has('flat')) return noop;
  let createToy;
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100dvh;display:block;pointer-events:none;z-index:0';
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: qs.has('keep') });
  } catch (e) { console.warn('WebGL unavailable; 2D fallback', e); return noop; }
  if (!renderer.capabilities.isWebGL2 && !renderer.getContext()) return noop;
  kitCanvas.parentElement.insertBefore(canvas, kitCanvas);
  kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
  renderer.autoClear = false; renderer.localClippingEnabled = true;
  renderer.setClearColor(0x0d2417, 1);

  let tier = Math.max(0, TIERS.findIndex((t) => t.name === quality));
  if (qs.has('tier')) tier = clamp(Number(qs.get('tier')), 0, TIERS.length - 1);

  // ---- scenes
  const worldScene = new THREE.Scene();
  const world = createWorld({ quality: TIERS[tier].q });
  worldScene.add(world.group);
  const sky = createSky();
  const worldCam = new THREE.PerspectiveCamera(22, 1, 8, 4200);
  const toyScene = new THREE.Scene();
  const toyCam = new THREE.PerspectiveCamera(30, 1, 0.05, 80);
  const toyHemi = new THREE.HemisphereLight(0xffffff, 0x445533, 1.0), toyKey = new THREE.DirectionalLight(0xffffff, 3), toyRim = new THREE.DirectionalLight(0xbfdcff, 1.1);
  toyScene.add(toyHemi, toyKey, toyRim, toyKey.target);
  let toy = null, envTex = null, ready = false, lost = false, loadErr = null;

  function buildEnv() {
    const pm = new THREE.PMREMGenerator(renderer);
    if (envTex) envTex.dispose();
    envTex = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture; pm.dispose();
    toyScene.environment = envTex; worldScene.environment = envTex;
  }
  buildEnv();

  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; v3.on = false; }, false);
  canvas.addEventListener('webglcontextrestored', () => { buildEnv(); lost = false; v3.on = ready; }, false);

  // the toy (hands load a skinned mesh): the 2D art stays until it is ready
  const whenReady = (async () => {
    try {
      ({ createToy } = await import('./toy.js'));
      toy = await createToy({ skin: 'tan' });
      toyScene.add(toy.root);
      try { renderThumbs(); } catch (e) { console.warn('rotor thumbnails failed', e); }
      ready = true; v3.on = !lost;
    } catch (err) { loadErr = err; console.warn('3D toy unavailable; 2D fallback', err); }
  })();
  void loadErr;

  // lit renders of each rotor, once, for the trays, the collection and the illustrations (2D canvases, transparent background)
  function renderThumbs() {
    resize();
    const N = 256, dpr = renderer.getPixelRatio(), cam = new THREE.PerspectiveCamera(30, 1, 0.1, 60), img = [];
    const dir = new THREE.Vector3(0.0, 0.34, -0.94).normalize(), dist = 6.2;
    toyHemi.color.set('#e6f0ff'); toyHemi.groundColor.set('#7a8a5a'); toyHemi.intensity = 1.0; toyKey.color.set('#fff2d8'); toyKey.intensity = 2.8; toyKey.position.set(-3, 5, -4); toyRim.position.set(4, 3, 5);
    toyScene.environmentIntensity = 0.5;
    cam.position.copy(dir).multiplyScalar(dist); cam.lookAt(0, 0, 0); cam.updateMatrixWorld(true);
    const hubX = N / 2, hubY = N / 2, span = (0.7 / (6.2 * Math.tan((15 * Math.PI) / 180))) * N * 2 / 2 * 1;
    const vp = N / dpr, bufH = renderer.domElement.height;
    renderer.setViewport(0, 0, vp, vp); renderer.setScissor(0, 0, vp, vp); renderer.setScissorTest(true);
    const grab = (bg) => {
      renderer.setClearColor(bg, 1); renderer.clear(); renderer.render(toyScene, cam);
      const c = document.createElement('canvas'); c.width = N; c.height = N; const g = c.getContext('2d', { willReadFrequently: true });
      g.drawImage(renderer.domElement, 0, bufH - N, N, N, 0, 0, N, N);
      return g.getImageData(0, 0, N, N);
    };
    for (let i = 0; i < 6; i++) {
      toy.pose({ rotor: i, rev: 0.35 + i * 0.9, s: 0, tilt: 0, wob: 0, wobPh: 0, rub: 0, press: 0, hands: 0, release: 0, t: 0, roll: 0 }, 0);
      const k = grab(0x000000), w = grab(0xffffff), out = new ImageData(N, N);
      for (let p = 0; p < N * N * 4; p += 4) {
        const al = clamp(1 - (w.data[p] - k.data[p] + w.data[p + 1] - k.data[p + 1] + w.data[p + 2] - k.data[p + 2]) / 765, 0, 1);
        out.data[p + 3] = Math.round(al * 255);
        if (al > 0.004) { out.data[p] = clamp(k.data[p] / al, 0, 255); out.data[p + 1] = clamp(k.data[p + 1] / al, 0, 255); out.data[p + 2] = clamp(k.data[p + 2] / al, 0, 255); }
      }
      const c = document.createElement('canvas'); c.width = N; c.height = N; c.getContext('2d').putImageData(out, 0, 0); img.push(c);
    }
    renderer.setScissorTest(false);
    v3.thumbs = { img, size: N, hubX, hubY, span };
  }

  // ---- sizes
  let cw = 1, ch = 1, dprNow = 1;
  function resize() {
    const w = Math.max(1, Math.floor(window.innerWidth)), h = Math.max(1, Math.floor(window.innerHeight));
    const dpr = Math.min(window.devicePixelRatio || 1, TIERS[tier].dpr);
    if (w !== cw || h !== ch || dpr !== dprNow) { cw = w; ch = h; dprNow = dpr; renderer.setPixelRatio(dpr); renderer.setSize(w, h, false); }
  }

  const _v = new THREE.Vector3(), _d = new THREE.Vector3(), _hub = new THREE.Vector3();
  const DIR_F = new THREE.Vector3(0.0, 0.3, -0.95).normalize(), DIR_C = new THREE.Vector3(0.0, 0.72, -0.69).normalize();
  let clock = 0, last = null, rubPh = 0, wobPh = 0, handsK = 0, relK = 0, camE = 0, lastCharge = 0;
  const ema = { v: 16 };

  function placeToyCamera(rect, kpx, T, dt) {
    const Wv = rect.w * kpx, Hv = rect.h * kpx;
    // e: 1 = first-person cradle view, 0 = the flight view; eased so the camera glides while the toy lifts off
    const target = T.blend > 0.001 || T.hands > 0 ? 1 : 0;
    camE += (clamp(T.blend, 0, 1) - camE) * Math.min(1, dt * 12);
    const e = smooth(T.landed ? 0 : camE);
    void target;
    _d.copy(DIR_F).lerp(DIR_C, e).normalize();
    const dist = lerp(7.5, 4.2, e), sizePx = Math.max(8, T.size * kpx * 1.22);
    const fpx = sizePx * dist / COPTER_SCALE, fov = clamp((2 * Math.atan(Hv / (2 * fpx)) * 180) / Math.PI, 2, 140);
    toyCam.fov = fov; toyCam.aspect = Wv / Hv; toyCam.near = 0.05; toyCam.far = 120;
    toyCam.position.copy(_d).multiplyScalar(dist);
    _v.set(0, -0.22 * e, 0); toyCam.lookAt(_v);
    toyCam.updateProjectionMatrix(); toyCam.updateMatrixWorld(true);
    // lens shift: put the hub exactly where the 2D art puts it
    _hub.set(0, 0, 0).project(toyCam);
    const tx = ((T.x - rect.x) * kpx) / Wv * 2 - 1, ty = 1 - ((T.y - rect.y) * kpx) / Hv * 2;
    const m = toyCam.projectionMatrix.elements;
    m[8] -= tx - _hub.x; m[9] -= ty - _hub.y;
    toyCam.projectionMatrixInverse.copy(toyCam.projectionMatrix).invert();
    return e;
  }

  function frame(game) {
    const state = game.getState();
    const now = performance.now();
    let dt = last === null ? 0 : (now - last) / 1000; last = now; dt = clamp(dt, 0, 0.05);
    clock += dt;
    // quality: step down when frames are consistently slow
    if (dt > 0) { ema.v += (dt * 1000 - ema.v) * 0.05; if (ema.v > 30 && tier < TIERS.length - 1 && clock > 3) { tier++; ema.v = 16; resize(); } }
    if (!v3.on || !ready) { canvas.style.visibility = 'hidden'; return; }
    canvas.style.visibility = 'visible';
    resize();
    renderer.setScissorTest(false);
    const view = v3.view;
    if (!view) {  // a screen with no world behind it (should not happen): solid colour
      renderer.setViewport(0, 0, cw, ch); renderer.clear();
      return;
    }
    const ws = view.ws, rect = view.rect, kpx = cw / v3.W;
    const sc = ws.scene;
    renderer.setClearColor(PALS[sc].ground[2], 1);
    renderer.setViewport(0, 0, cw, ch); renderer.clear();
    const vx = rect.x * kpx, vy = ch - (rect.y + rect.h) * kpx, vw = rect.w * kpx, vh = rect.h * kpx;
    renderer.setViewport(vx, vy, vw, vh); renderer.setScissor(vx, vy, vw, vh); renderer.setScissorTest(true);

    // ---- pass A: sky + world
    world.setScene(sc);
    if (ws.cond) world.setCond(ws.cond);
    const ppm = rect.w / FIT_M;
    const g0 = ws.cond ? groundAt(ws.cond, 0) : 0;
    const horizonRow = clamp(rect.h * 0.5 - (ws.cam.y - (g0 + 0.5)) * ppm + 0 + (g0 + 0.5 - ws.cam.y) * 0, rect.h * 0.46, rect.h * 0.84);
    // 2D horizon: cam.Y(g0 + 0.5) = h/2 - (g0 + 0.5 - cam.y) * ppm
    const hzRow = rect.h * 0.5 + clamp(rect.h / 2 - (g0 + 0.5 - ws.cam.y) * ppm - rect.h * 0.5, -rect.h * 0.04, rect.h * 0.2);
    void horizonRow;
    const fovV = 22, visH = rect.h / ppm, D = visH / 2 / Math.tan((fovV * Math.PI) / 360);
    const dy = (hzRow - rect.h / 2) / ppm;
    worldCam.fov = fovV; worldCam.aspect = rect.w / rect.h; worldCam.near = Math.max(6, D * 0.1); worldCam.far = D + 3600;
    worldCam.position.set(ws.cam.x, ws.cam.y - dy, D); worldCam.rotation.set(0, 0, 0);
    worldCam.clearViewOffset(); worldCam.setViewOffset(vw, vh, 0, vh / 2 - (hzRow * kpx), vw, vh);
    worldCam.updateProjectionMatrix(); worldCam.updateMatrixWorld(true);
    worldScene.fog = new THREE.Fog(new THREE.Color(`rgb(${PALS[sc].haze})`), D + 60 * RIGS[sc].fog[0], D + 1500 * RIGS[sc].fog[1] + 300);
    const p = PALS[sc];
    sky.setScene(sc); sky.mat.uniforms.uRes.value.set(vw, vh); sky.mat.uniforms.uT.value = clock; sky.mat.uniforms.uHorizon.value = hzRow / rect.h;
    worldScene.environmentIntensity = RIGS[sc].env;
    const sunWorldX = ws.cam.x + (p.sun.x - 0.5) * FIT_M;
    world.update(clock, ws, { x: ws.cam.x, y: ws.cam.y, sunX: sunWorldX });
    renderer.render(sky.scene, sky.cam);
    renderer.render(worldScene, worldCam);

    // ---- pass B: the toy (and the hands)
    const T = v3.toy;
    renderer.clearDepth();
    if (T && toy) {
      const rig = RIGS[sc];
      toyHemi.color.set(rig.sky); toyHemi.groundColor.set(rig.gnd); toyHemi.intensity = rig.hi * 0.6;
      toyKey.color.set(rig.key); toyKey.intensity = rig.ki * 0.95;
      toyKey.position.set(-rig.dir[0] * 6, rig.dir[1] * 6 + 2, -rig.dir[2] * 6);
      toyRim.position.set(rig.dir[0] * 4, 3, 6); toyRim.intensity = 1.0;
      toyScene.environmentIntensity = rig.env * 0.55;
      const e = placeToyCamera(rect, kpx, T, dt);
      const spin = T.s;
      wobPh += dt * (5 + 18 * clamp(spin, 0, 1.2));
      rubPh += dt * (6 + 10 * clamp(T.press, 0, 1));
      const wob = T.landed ? 0 : T.blend > 0.5 ? 0.025 * clamp(T.charge, 0, 1) * (0.6 + 0.4 * Math.sin(clock * 31)) : 0.17 * Math.pow(clamp(1 - spin / 0.62, 0, 1), 1.4) + 0.012;
      const pressure = T.press, relase = clamp(1 - T.blend, 0, 1);
      handsK += (T.hands - handsK) * Math.min(1, dt * 20);
      toy.pose({
        rotor: T.rotor, rev: -T.rev, s: spin, tilt: T.landed ? 0 : T.tilt, wob, wobPh, rub: T.landed ? 0 : (T.rub || 0) * (T.blend > 0.5 ? 1 : 0), press: pressure,
        hands: T.hands > 0.01 ? 1 : 0, release: T.blend > 0.5 ? 0 : relase, t: clock, roll: T.roll,
      }, dt);
      void e; void lastCharge; void relK;
      renderer.render(toyScene, toyCam);
    }
    renderer.setScissorTest(false);
  }

  return {
    ok: true, whenReady, renderer, world, get toy() { return toy; }, get ready() { return ready; }, get tier() { return tier; },
    wrap(game) { const r = game.render.bind(game); game.render = (ctx, view) => { r(ctx, view); try { frame(game); } catch (err) { console.error('3D frame', err); v3.on = false; } }; return game; },
  };
}
