// The 3D presenter: reads state.v3 (published by the game each frame) and draws the courtyard behind the kit's transparent 2D canvas.
// It never writes back to the game. If WebGL is missing, the context is lost or the layer fails to load, game.setGl(false) keeps the
// painted courtyard on screen; the game plays exactly the same.
import { THREE, board3d as B } from '../vendor3d/index.js';
import { CAM3 } from '../src/cam3.js';
import { buildRoom, setAct, updateRoom, resetGlow, resetFlame, clamp } from './room.js';
import { createDancer } from './dancer.js';
import { createPots } from './pots.js';
import { createBand } from './band.js';
import { createFx } from './fx.js';

const T = THREE;

export async function createPresenter({ kitCanvas, quality = 'medium', force2d = false, headless = false }) {
  const win = globalThis;
  const none = { ok: false, wrap: (g) => g, quality };
  if (force2d) return none;
  let renderer;
  const canvas = win.document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;left:0;top:0;width:100vw;height:100vh;height:100dvh;display:block;pointer-events:none;z-index:0;visibility:hidden';
  try {
    kitCanvas.parentElement.insertBefore(canvas, kitCanvas);
    kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
    renderer = new T.WebGLRenderer({ canvas, antialias: quality !== 'low', powerPreference: 'high-performance', alpha: false, preserveDrawingBuffer: headless });
    if (!renderer.getContext()) throw new Error('no context');
  } catch (e) { canvas.remove(); return none; }
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = quality !== 'low';
  renderer.shadowMap.type = T.PCFShadowMap;

  const room = buildRoom({ quality });
  const scene = room.scene;
  const camera = new T.PerspectiveCamera(30, 1, 0.5, 140);
  B.createEnvironment(renderer, scene, { intensity: 0.5 });
  const fx = createFx(scene);
  const api = { ok: true, ready: false, lost: false, failed: false, quality, canvas, renderer, room, scene, camera, fx, dancer: null, pots: null, band: null, frameMs: 0, wrap: null, cameraOverride: null };
  let W = 0, H = 0, dprNow = 0, lastT = null, clock = 0, costAvg = 0, costN = 0, degraded = false, lastEvKey = null, lastSeq = 0, shake = 0;

  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); api.lost = true; });
  canvas.addEventListener('webglcontextrestored', () => {
    api.lost = false; dprNow = 0; resetGlow(); resetFlame();
    scene.traverse((o) => { if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { m.needsUpdate = true; }); });
  });

  // heavy parts load in the background; the painted courtyard is shown until everything is ready
  (async () => {
    try {
      api.dancer = await createDancer(scene, { quality });
      api.pots = createPots(scene, { quality });
      api.band = await createBand(scene, camera, { quality });
      api.ready = true;
    } catch (e) { console.warn('3D courtyard failed to load; using the painted one', e); api.failed = true; }
  })();

  const resize = () => {
    const w = win.innerWidth, h = win.innerHeight;
    const cap = degraded ? 1 : quality === 'high' ? 2 : quality === 'medium' ? 1.75 : 1.25;
    const dpr = Math.min(win.devicePixelRatio || 1, cap);
    if (w === W && h === H && dpr === dprNow) return;
    W = w; H = h; dprNow = dpr; renderer.setPixelRatio(dpr); renderer.setSize(w, h, false);
  };

  function setCamera(v) {
    const { D, EH, PITCH } = CAM3;
    const sp = Math.sin(PITCH), cp = Math.cos(PITCH), depth0 = EH * sp + D * cp, F = v.ppm * depth0;
    camera.aspect = v.w / v.h;
    camera.fov = 2 * Math.atan(v.h / 2 / F) * 180 / Math.PI;
    camera.near = 1; camera.far = 140;
    camera.position.set(0, EH, D); camera.rotation.set(-PITCH, 0, 0, 'XYZ');
    if (v.shake > 0 && !v.calm) { const k = v.shake * 0.035; camera.position.x += Math.sin(clock * 90) * k; camera.position.y += Math.cos(clock * 70) * k * 0.8; }
    camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
    const p = new T.Vector3(0, 0, 0).project(camera);
    const wantX = (2 * v.ox) / v.w - 1, wantY = 1 - (2 * v.oy) / v.h;
    const e = camera.projectionMatrix.elements;
    e[8] -= wantX - p.x; e[9] -= wantY - p.y;
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
    if (api.cameraOverride) {
      const o = api.cameraOverride; camera.fov = o.fov || 30; camera.near = 0.1; camera.far = 140; camera.aspect = o.aspect || camera.aspect;
      camera.position.set(...o.eye); camera.up.set(0, 1, 0); camera.lookAt(...o.at); camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
    }
  }

  // glowing footprint inlays and the guide cone, driven by v.targets / v.guide
  const markers = [];
  const markerTex = (() => {
    const c = win.document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d');
    const rg = g.createRadialGradient(64, 64, 8, 64, 64, 62); rg.addColorStop(0, 'rgba(255,255,255,0.85)'); rg.addColorStop(0.7, 'rgba(255,255,255,0.35)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = rg; g.fillRect(0, 0, 128, 128);
    g.fillStyle = 'rgba(30,18,0,0.55)';
    const foot = (cx, cy, rot) => { g.save(); g.translate(cx, cy); g.rotate(rot); g.beginPath(); g.ellipse(0, 8, 11, 20, 0, 0, 6.283); g.fill(); for (let i = 0; i < 5; i++) { g.beginPath(); g.arc(-11 + i * 5.5, -17 - Math.abs(i - 1) * 1.4, i === 0 ? 4.2 : 3.2, 0, 6.283); g.fill(); } g.restore(); };
    foot(50, 66, -0.08); foot(78, 62, 0.08);
    const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t;
  })();
  for (let i = 0; i < 3; i++) {
    const m = new T.Mesh(new T.PlaneGeometry(0.62, 0.62), new T.MeshBasicMaterial({ map: markerTex, transparent: true, depthWrite: false, blending: T.AdditiveBlending, color: 0xffd45a, opacity: 0 }));
    m.rotation.x = -Math.PI / 2; m.position.y = 0.012; m.renderOrder = 4; scene.add(m);
    const ring = B.glowRing(0.34, '#ffe08a'); ring.position.y = 0.014; scene.add(ring); ring.visible = false;
    markers.push({ m, ring });
  }
  const guide = new T.Mesh(new T.CylinderGeometry(0.0001, 0.11, 0.28, 16), new T.MeshBasicMaterial({ color: 0xffe07a, transparent: true, opacity: 0.9 }));
  guide.rotation.x = Math.PI; guide.visible = false; scene.add(guide);
  function updateMarkers(v, clk) {
    for (let i = 0; i < markers.length; i++) {
      const t = v.targets[i], mk = markers[i];
      if (!t || !v.playing) { mk.m.material.opacity = 0; mk.ring.visible = false; continue; }
      const a = t.first ? 0.95 : 0.5, k = t.k;
      mk.m.position.x = t.x; mk.m.position.z = 0.0;
      mk.m.material.opacity = a * (0.45 + 0.55 * k); mk.m.material.color.set(t.first ? 0xffd45a : 0x8ff0e6);
      const s = t.first ? 1.0 + 0.08 * Math.sin(clk * 7) : 0.85; mk.m.scale.setScalar(s * (1.1 - 0.15 * k));
      mk.ring.visible = true; mk.ring.position.x = t.x; mk.ring.position.z = 0.0; mk.ring.pulse(clk, 4); mk.ring.scale.multiplyScalar(1 + 0.8 * (1 - k)); mk.ring.setColor(t.first ? '#ffe08a' : '#8ff0e6');
      mk.ring.material.opacity = a * (0.3 + 0.7 * k);
    }
    if (v.guide !== null && v.guide !== undefined) { guide.visible = true; guide.position.set(clamp(v.guide, -1.7, 1.7), 0.22 + 0.04 * Math.sin(clk * 6), 0.1); } else guide.visible = false;
  }

  function frame(game) {
    const st = game.getState(), v0 = st.v3;
    const usable = api.ok && api.ready && !api.lost && !api.failed && !!v0 && v0.on;
    game.setGl(usable);
    if (!usable) { canvas.style.visibility = 'hidden'; return; }
    const t0 = win.performance.now();
    resize();
    let dt = lastT === null ? 0 : st.t - lastT; lastT = st.t;
    if (dt < 0 || dt > 0.25) dt = 0;
    dt = Math.min(dt, 1 / 20);
    // the sim clock is frozen while paused / thinking: so is the presentation (clothes stop mid-air, as in a still photograph)
    if (v0.frozen) dt = 0;
    clock += dt;
    // events: only those that arrived since the last frame (the log of a different world is not replayed)
    const key = v0.ev;
    if (key !== lastEvKey) { lastEvKey = key; lastSeq = key.length ? key[key.length - 1].n : 0; }
    const fresh = key.filter((e) => e.n > lastSeq);
    if (fresh.length) lastSeq = fresh[fresh.length - 1].n;

    setAct(room, v0.act);
    const dc = api.dancer, pots = api.pots, band = api.band;
    const v = Object.assign({}, v0, { evSeq: lastSeq });
    for (const e of fresh) {
      if (e.type === 'step' && e.q !== 'miss') fx.petals(new T.Vector3(e.x, 0.05, 0.05), e.q === 'perfect' ? 10 : 5, [0xffb52e, 0xff6f9c, 0xffe08a, 0xff8a1f], e.q === 'perfect' ? 1.1 : 0.8);
      if (e.type === 'fall') shake = 1;
    }
    dc.update(v, dt, clock, pots, fresh, fx);
    v.yawSpin = dc.S.yawSpin;
    pots.update(v, dt, dc.S.pivot, dc.S.headQ, fresh, fx, clock);
    for (const e of fresh) if (e.type === 'pot' && e.ok) fx.sparks(pots.top.clone(), 14, 1.0);
    band.update(v, dt, clock, fresh);
    if (api.onFrame) api.onFrame({ dt, clock, v });
    updateRoom(room, v, dt, clock);
    updateMarkers(v, clock);
    fx.update(dt);
    setCamera(v);
    fx.setScale(camera, H);
    room.key.target.position.set(v.x * 0.5, 1.4, 0); room.key.target.updateMatrixWorld();
    canvas.style.visibility = 'visible';
    renderer.render(scene, camera);
    shake = Math.max(0, shake - dt * 2);
    const ms = win.performance.now() - t0;
    costAvg = costN ? costAvg * 0.96 + ms * 0.04 : ms; costN++; api.frameMs = costAvg;
    if (!degraded && costN > 150 && costAvg > 15 && quality !== 'low') {
      degraded = true; renderer.shadowMap.enabled = false; room.key.castShadow = false; dprNow = 0;
      scene.traverse((o) => { if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { m.needsUpdate = true; }); });
    }
  }

  api.wrap = (game) => {
    game.setGl(false);
    const r = game.render.bind(game);
    game.render = (ctx, view) => {
      r(ctx, view);                      // the 2D overlay of THIS frame; it also publishes state.v3 for the 3D frame below
      try { frame(game); } catch (err) { if (!game.__v3err) { game.__v3err = 1; console.warn('3D frame error', err); } api.failed = true; game.setGl(false); canvas.style.visibility = 'hidden'; }
    };
    return game;
  };
  api.loseContext = (ms = 1500) => {
    const gl = renderer.getContext(), ext = gl.getExtension('WEBGL_lose_context');
    if (!ext) return false;
    ext.loseContext(); setTimeout(() => ext.restoreContext(), ms);
    return true;
  };
  return api;
}
