// Stage: renderer + scene + lighting + ground/sky helpers + resize + on-demand rendering + context-loss handling.
import * as THREE from './three.js';
import { LOD_POLICY } from './lod.js';
import { createBlobShadows } from './blob.js';

export function webglSupported() {
  try {
    const c = globalThis.document.createElement('canvas');
    return !!(globalThis.WebGL2RenderingContext && c.getContext('webgl2'));
  } catch { return false; }
}

const QUALITY = {
  low: { dpr: 1, shadow: 0, aa: false, env: false, pcf: false },
  medium: { dpr: 1.5, shadow: 1024, aa: true, env: true, pcf: true },
  high: { dpr: 2, shadow: 2048, aa: true, env: true, pcf: true },
};

const LIGHT_PRESETS = {
  day: { sky: 0x9cc3e8, fog: 0xb9d3ea, hemiSky: 0xcfe6ff, hemiGround: 0x4d6a3a, hemi: 0.9, key: 0xfff0d8, keyI: 3.0, rim: 0xbfd8ff, rimI: 1.6, exposure: 1.0 },
  evening: { sky: 0xf0b27a, fog: 0xf3c9a0, hemiSky: 0xffd9b0, hemiGround: 0x4a4a38, hemi: 0.7, key: 0xffc58a, keyI: 3.0, rim: 0x9db6ff, rimI: 1.1, exposure: 1.0 },
  night: { sky: 0x0d1630, fog: 0x14203f, hemiSky: 0x5a6ea8, hemiGround: 0x1d2430, hemi: 0.55, key: 0xdfe8ff, keyI: 2.4, rim: 0x6f8cff, rimI: 1.2, exposure: 1.0 },
  indoor: { sky: 0x2b2f38, fog: 0x2b2f38, hemiSky: 0xffffff, hemiGround: 0x555555, hemi: 0.8, key: 0xfff4e0, keyI: 2.8, rim: 0xcad8ff, rimI: 1.2, exposure: 1.0 },
};

/** Returns a stage. If WebGL2 is unavailable, `stage.supported === false` and every method is a harmless no-op so the game can fall back to its 2D art. */
export function createStage(opts = {}) {
  const supported = webglSupported();
  const q = QUALITY[opts.quality || 'high'] || QUALITY.high;
  const dprCap = Math.min(opts.dprCap ?? 2, 2);
  const doc = globalThis.document;
  const stage = {
    supported,
    contextLost: false,
    quality: opts.quality || 'high',
    mode: opts.mode || 'continuous',
    dirty: true,
    humans: [],
    callbacks: { contextLost: [], contextRestored: [] },
    stats: { frames: 0, renders: 0 },
  };
  if (!supported) {
    const noop = () => stage;
    Object.assign(stage, { scene: null, camera: null, renderer: null, canvas: null, add: noop, remove: noop, track: noop, setAutoLOD: noop, setQuality: noop, enableBlobShadows: noop, invalidate: noop, resize: noop, render: noop, update: noop, start: noop, stop: noop, dispose: noop, setSize: noop, setLighting: noop, addGround: noop, setSky: noop, setMode: noop, setVisible: noop, setShadowTarget: noop, onContextLost: noop, onContextRestored: noop, failed: true, ok: false });
    return stage;
  }
  stage.ok = true;
  stage.failed = false;

  let canvas = opts.canvas || null;
  const container = opts.container || (canvas ? canvas.parentElement : doc.body);
  if (!canvas) {
    canvas = doc.createElement('canvas');
    canvas.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;display:block;touch-action:none;';
    if (container !== doc.body && getComputedStyle(container).position === 'static') container.style.position = 'relative';
    container.insertBefore(canvas, container.firstChild);
  }
  stage.canvas = canvas;
  stage.container = container;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: q.aa, alpha: !!opts.transparent, powerPreference: 'high-performance', preserveDrawingBuffer: !!opts.preserveDrawingBuffer });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  if (q.shadow && opts.shadows !== false) { renderer.shadowMap.enabled = true; renderer.shadowMap.type = q.pcf ? THREE.PCFShadowMap : THREE.BasicShadowMap; }
  stage.renderer = renderer;

  const scene = new THREE.Scene();
  stage.scene = scene;
  const camera = new THREE.PerspectiveCamera(opts.fov || 38, 1, 0.1, 160);
  camera.position.set(0, 1.6, 5);
  stage.camera = camera;

  if (q.env) {
    const pm = new THREE.PMREMGenerator(renderer);
    scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.35;
    pm.dispose();
  }

  const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1);
  const key = new THREE.DirectionalLight(0xffffff, 3);
  key.position.set(-5, 9, 6);
  const sh = opts.shadowSize || 4;
  if (renderer.shadowMap.enabled) {
    key.castShadow = true;
    key.shadow.mapSize.set(q.shadow, q.shadow);
    Object.assign(key.shadow.camera, { left: -sh, right: sh, top: sh, bottom: -sh, near: 1, far: 30 });
    key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02; key.shadow.radius = 3;
  }
  const rim = new THREE.DirectionalLight(0xffffff, 1.5);
  rim.position.set(5, 4, -7);
  scene.add(hemi, key, key.target, rim);
  stage.lights = { hemi, key, rim };
  stage._shadowOffset = new THREE.Vector3(-5, 9, 6);

  stage.setLighting = (name = 'day', extra = {}) => {
    const p = { ...(LIGHT_PRESETS[name] || LIGHT_PRESETS.day), ...extra };
    hemi.color.set(p.hemiSky); hemi.groundColor.set(p.hemiGround); hemi.intensity = p.hemi;
    key.color.set(p.key); key.intensity = p.keyI; rim.color.set(p.rim); rim.intensity = p.rimI;
    renderer.toneMappingExposure = p.exposure;
    stage.setSky(p.sky, p.fog);
    stage.invalidate();
    return stage;
  };

  /** Sky as a flat colour (and matching fog). fog: colour or null for none; near/far metres. */
  stage.setSky = (color, fogColor = color, { near = 20, far = 80 } = {}) => {
    if (color === null) { scene.background = null; } else scene.background = new THREE.Color(color);
    scene.fog = fogColor === null ? null : new THREE.Fog(fogColor, near, far);
    stage.invalidate();
    return stage;
  };

  /** Keep the key light and its shadow box centred on a point (call each frame with the action centre). */
  stage.setShadowTarget = (x, y, z) => {
    key.target.position.set(x, y, z);
    key.position.set(x + stage._shadowOffset.x, y + stage._shadowOffset.y, z + stage._shadowOffset.z);
    rim.position.set(x + 5, y + 4, z - 7);
    stage.invalidate();
    return stage;
  };

  /** kind: 'grass' | 'sand' | 'court' | 'flat'. Returns the mesh. */
  stage.addGround = ({ kind = 'grass', size = 200, color, repeat = 40, y = 0 } = {}) => {
    const tex = groundTexture(doc, kind, color);
    tex.repeat.set(repeat, repeat);
    tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95, metalness: 0 }));
    m.rotation.x = -Math.PI / 2; m.position.y = y; m.receiveShadow = true;
    scene.add(m);
    stage.invalidate();
    return m;
  };

  /** A flat strip (pitch, court, lane): width x length metres centred at (x,z). */
  stage.addStrip = ({ width = 3, length = 20, x = 0, z = 0, color = 0xc9b48a, y = 0.003 } = {}) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(width, length), new THREE.MeshStandardMaterial({ color, roughness: 1 }));
    m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); m.receiveShadow = true;
    scene.add(m);
    return m;
  };

  stage.add = (o) => { scene.add(o.root || o); stage.invalidate(); return o; };
  stage.remove = (o) => { scene.remove(o.root || o); stage.invalidate(); return o; };
  stage.track = (h) => { if (!stage.humans.includes(h)) { stage.humans.push(h); if (h.setQuality && !h.tier) h.lodPolicy = stage.lodPolicy; } return h; };
  stage.invalidate = () => { stage.dirty = true; };

  // ------------------------------------------------------------ sizing
  let cssW = 0, cssH = 0;
  stage.setSize = (w, h) => {
    cssW = w; cssH = h;
    const dpr = Math.min(globalThis.devicePixelRatio || 1, dprCap, QUALITY[stage.quality].dpr);
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    camera.aspect = w / Math.max(1, h);
    camera.updateProjectionMatrix();
    stage.invalidate();
  };
  stage.resize = () => {
    const r = canvas.getBoundingClientRect();
    const w = Math.round(r.width || container.clientWidth || globalThis.innerWidth);
    const h = Math.round(r.height || container.clientHeight || globalThis.innerHeight);
    if (w && h && (w !== cssW || h !== cssH)) stage.setSize(w, h);
  };
  const onResize = () => stage.resize();
  globalThis.addEventListener('resize', onResize);
  let ro = null;
  if (globalThis.ResizeObserver) { ro = new globalThis.ResizeObserver(onResize); ro.observe(canvas); }
  stage.resize();
  globalThis.requestAnimationFrame?.(() => stage.resize());

  // ------------------------------------------------------------ render modes
  /** 'continuous' renders every frame; 'ondemand' renders only after invalidate()/animating humans (battery friendly for idle scenes). */
  stage.setMode = (m) => { stage.mode = m; stage.invalidate(); return stage; };
  stage.render = () => {
    if (stage.contextLost) return false;
    renderer.render(scene, camera);
    stage.stats.renders++;
    stage.dirty = false;
    return true;
  };
  /** Deterministic step: advance tracked humans by dt, then render if needed. Returns true when it rendered. */
  stage.update = (dt, { renderNow = true } = {}) => {
    stage.stats.frames++;
    let moving = false;
    const vh = renderer.domElement.height / renderer.getPixelRatio();
    if (stage.autoLOD) { camera.updateMatrixWorld(); for (const h of stage.humans) if (h.lodSets && h.lodSets.ready && h.lodAuto !== false) h.autoLOD(camera, vh, stage.lodPolicy); }
    for (const h of stage.humans) { if (h.update(dt)) moving = true; }
    if (stage.blobs) stage.blobs.sync(stage.humans);
    if (moving && stage.humans.length) stage.dirty = true;
    if (!renderNow) return false;
    if (stage.mode === 'continuous' || stage.dirty) return stage.render();
    return false;
  };
  // ------------------------------------------------------------ quality tiers, automatic LOD, blob shadows
  /** Choose the LOD of every tracked human from its size on screen each update. Policy follows the quality tier unless overridden. */
  stage.setAutoLOD = (on = true, policy) => { stage.autoLOD = on; if (policy) stage.lodPolicy = policy; stage.invalidate(); return stage; };
  stage.lodPolicy = LOD_POLICY[opts.quality || 'high'] || LOD_POLICY.high;
  stage.autoLOD = !!opts.autoLOD;
  /** One blob shadow per tracked human in a SINGLE instanced draw call (use with shadows off on low-end devices). */
  stage.enableBlobShadows = (max = 32, o = {}) => { if (!stage.blobs) { stage.blobs = createBlobShadows(max, o); scene.add(stage.blobs.mesh); } return stage.blobs; };
  /** 'low' | 'medium' | 'high': pixel ratio cap, shadow maps, LOD thresholds and blob shadows together; also applied to tracked humans. */
  stage.setQuality = (tier) => {
    const t = QUALITY[tier] ? tier : 'high'; const qq = QUALITY[t];
    stage.quality = t; stage.tier = t;
    renderer.shadowMap.enabled = !!qq.shadow && opts.shadows !== false;
    key.castShadow = renderer.shadowMap.enabled;
    if (key.castShadow && key.shadow.mapSize.x !== qq.shadow) { key.shadow.mapSize.set(qq.shadow, qq.shadow); key.shadow.map?.dispose(); key.shadow.map = null; }
    stage.lodPolicy = LOD_POLICY[t];
    scene.traverse((o) => { if (o.material) for (const m of [].concat(o.material)) m.needsUpdate = true; });
    for (const h of stage.humans) h.setQuality(t);
    if (t === 'low') stage.enableBlobShadows(); else if (stage.blobs) stage.blobs.mesh.visible = false;
    if (stage.blobs && t === 'low') stage.blobs.mesh.visible = true;
    const dprCapT = Math.min(dprCap, qq.dpr);
    renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio || 1, dprCapT)); renderer.setSize(cssW || canvas.clientWidth, cssH || canvas.clientHeight, false);
    stage.invalidate();
    return stage;
  };
  stage.setVisible = (v) => { canvas.style.visibility = v ? 'visible' : 'hidden'; if (v) stage.invalidate(); };

  // rAF loop helper for presenters that don't have their own: onFrame(dt) runs first, then render. dt is clamped.
  let raf = 0, last = 0, running = false;
  const tick = (now) => {
    if (!running) return;
    raf = globalThis.requestAnimationFrame(tick);
    const dt = Math.min(0.05, last ? (now - last) / 1000 : 0);
    last = now;
    stage._onFrame?.(dt);
    stage.update(dt);
  };
  stage.start = (onFrame) => { stage._onFrame = onFrame || null; if (!running) { running = true; last = 0; raf = globalThis.requestAnimationFrame(tick); } return stage; };
  stage.stop = () => { running = false; globalThis.cancelAnimationFrame?.(raf); };

  // ------------------------------------------------------------ context loss
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); stage.contextLost = true; for (const f of stage.callbacks.contextLost) f(); });
  canvas.addEventListener('webglcontextrestored', () => { stage.contextLost = false; stage.invalidate(); for (const f of stage.callbacks.contextRestored) f(); });
  stage.onContextLost = (f) => { stage.callbacks.contextLost.push(f); return stage; };
  stage.onContextRestored = (f) => { stage.callbacks.contextRestored.push(f); return stage; };
  let loseExt = null;   // getExtension returns null while the context is lost, so keep the object
  stage.loseContextForTest = () => { loseExt = renderer.getContext().getExtension('WEBGL_lose_context'); loseExt?.loseContext(); };
  stage.restoreContextForTest = () => loseExt?.restoreContext();

  stage.dispose = () => {
    stage.stop();
    globalThis.removeEventListener('resize', onResize);
    ro?.disconnect();
    renderer.dispose();
    canvas.remove?.();
  };

  stage.setLighting(opts.lighting || 'day');
  return stage;
}

function groundTexture(doc, kind, colorOverride) {
  const c = doc.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d');
  const pal = { grass: ['#4f8a3a', '#5b9a43'], sand: ['#d9c08f', '#d1b784'], court: ['#3f6fa8', '#3b6aa0'], flat: ['#7a7a7a', '#7a7a7a'] }[kind] || ['#4f8a3a', '#5b9a43'];
  const [a, b] = colorOverride ? [colorOverride, colorOverride] : pal;
  const stripes = kind === 'grass' ? 8 : 1;
  for (let i = 0; i < stripes; i++) { g.fillStyle = i % 2 ? a : b; g.fillRect(0, (i * 512) / stripes, 512, 512 / stripes + 1); }
  const img = g.getImageData(0, 0, 512, 512);
  let s = 12345;
  const amp = kind === 'grass' ? 0.12 : 0.05;
  for (let i = 0; i < img.data.length; i += 4) { s = (s * 1664525 + 1013904223) >>> 0; const n = ((s >>> 24) - 128) * amp; img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n; }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
