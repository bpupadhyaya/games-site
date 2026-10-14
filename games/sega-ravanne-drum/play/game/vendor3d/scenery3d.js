// scenery3d: a shared scenery kit. Layered parallax backdrops + ground + props from photographic textures that were
// derived from the owner reference set (see docs/SCENERY.md), tone-matched to the rig lighting.
//
//   import { buildScenery, SCENERY_PRESET_NAMES } from './vendor3d/index.js';
//   const sc = buildScenery({ preset: 'alpine-meadow', timeOfDay: 'day', season: 'summer', quality: 'high' });
//   stage.scene.add(sc.group);                 // textures stream in; sc.ready resolves when done
//   each frame:  sc.update(dt, stage.camera);  // clouds drift, foliage sways, water shimmers, far layers follow the camera
//
// Options: preset | layers (array, same schema as presets: see catalogue.json "presetDefs"), culture (swap backdrop/sky by
// culture), timeOfDay ('dawn'|'day'|'dusk'|'night'), season ('spring'|'summer'|'autumn'|'winter'), quality ('low'|'medium'|'high'),
// wind (0..1, default .6), clouds (drift speed, default 1), shimmer (0..1), radius (backdrop radius, default 120), seed, base (asset URL).
// Units are metres; the play area is ~ 30 x 30 m around the origin, +y up, ground at y = 0.
import * as THREE from './three.js';

const HERE = import.meta.url;
export function defaultSceneryBase() { return new URL('../assets3d/scenery/', HERE).href; }
export const SCENERY_PRESET_NAMES = ['steppe-arena', 'alpine-meadow', 'village-street', 'courtyard', 'beach', 'riverbank', 'terraced-hills', 'desert-dusk', 'snow-field', 'tea-house', 'tatami-room', 'temple-yard', 'market-square', 'canal-polder', 'savanna-plain'];

const TAU = Math.PI * 2;
const hasDom = () => typeof globalThis.document !== 'undefined' && typeof globalThis.document.createElement === 'function';
function rngOf(seed) { let s = (seed >>> 0) || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
const lerp = (a, b, t) => a + (b - a) * t;
const rad = (d) => (d * Math.PI) / 180;

// ---- time of day / season / grade tints (multiplied onto photographic layers; lights use the same colours)
export const TIME_OF_DAY = {
  dawn:  { photo: [1.0, 0.86, 0.80], ground: [1.0, 0.88, 0.82], haze: '#f0c6a8', sun: '#ffd2a8', sunI: 0.9, amb: '#8a7f96', ambI: 0.55 },
  day:   { photo: [1.0, 1.0, 1.0],   ground: [1.0, 1.0, 1.0],   haze: '#cfe0ee', sun: '#fff4e0', sunI: 1.15, amb: '#a9bcd0', ambI: 0.7 },
  dusk:  { photo: [1.0, 0.76, 0.62], ground: [1.0, 0.74, 0.60], haze: '#e7a37a', sun: '#ff9c5c', sunI: 0.85, amb: '#7d6a8c', ambI: 0.5 },
  night: { photo: [0.30, 0.38, 0.62], ground: [0.28, 0.34, 0.55], haze: '#1c2540', sun: '#8aa4ff', sunI: 0.35, amb: '#3a4a7a', ambI: 0.45 },
};
const SEASON = {
  spring: [1.0, 1.02, 1.0], summer: [1, 1, 1], autumn: [1.08, 0.94, 0.80], winter: [0.92, 0.98, 1.10],
};
const GRADE = { steppe: [1.08, 1.0, 0.78], desert: [1.1, 0.9, 0.75], warm: [1.08, 0.97, 0.84], cool: [0.9, 0.97, 1.08] };
const QUALITY = {
  low:    { seg: 32, aniso: 1, density: 0.5, snow: 0.25, water: false },
  medium: { seg: 48, aniso: 4, density: 0.8, snow: 0.6, water: true },
  high:   { seg: 72, aniso: 8, density: 1.0, snow: 1.0, water: true },
};

// ---- procedural textures (canvas; plain colours when there is no DOM so the pure parts run under node)
function cv(w, h = w) { const c = globalThis.document.createElement('canvas'); c.width = w; c.height = h; return c; }
function canvasTex(c, { repeat = [1, 1], srgb = true } = {}) {
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
const PROC = {
  wood(rep = [6, 6]) {
    if (!hasDom()) return null; const c = cv(256), g = c.getContext('2d'), r = rngOf(7);
    for (let i = 0; i < 8; i++) { const y = i * 32; const v = 96 + r() * 28; g.fillStyle = `rgb(${v + 38},${v + 10},${v - 30})`; g.fillRect(0, y, 256, 31);
      g.strokeStyle = 'rgba(40,20,5,.35)'; for (let k = 0; k < 7; k++) { g.beginPath(); const yy = y + 3 + r() * 24; g.moveTo(0, yy); g.bezierCurveTo(80, yy + r() * 5 - 2, 170, yy + r() * 5 - 2, 256, yy); g.stroke(); }
      g.fillStyle = 'rgba(20,10,0,.55)'; g.fillRect(0, y + 30, 256, 2); g.fillRect(r() * 256, y, 2, 31); }
    return canvasTex(c, { repeat: rep });
  },
  tatami(rep = [4, 6]) {
    if (!hasDom()) return null; const c = cv(256, 512), g = c.getContext('2d'), r = rngOf(11);
    g.fillStyle = '#b9b27a'; g.fillRect(0, 0, 256, 512);
    for (let i = 0; i < 1400; i++) { g.fillStyle = `rgba(${150 + r() * 60},${150 + r() * 50},${80 + r() * 40},.28)`; g.fillRect(r() * 256, r() * 512, 1 + r() * 2, 30 + r() * 100); }
    g.fillStyle = '#23301f'; g.fillRect(0, 0, 256, 6); g.fillRect(0, 506, 256, 6); g.fillRect(0, 252, 256, 8);
    g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(126, 0, 4, 512);
    return canvasTex(c, { repeat: rep });
  },
  shoji(rep = [1, 1]) {
    if (!hasDom()) return null; const c = cv(512, 256), g = c.getContext('2d');
    g.fillStyle = '#f4efe0'; g.fillRect(0, 0, 512, 256);
    g.strokeStyle = '#4b3420'; g.lineWidth = 6; for (let x = 0; x <= 512; x += 64) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 256); g.stroke(); }
    for (let y = 0; y <= 256; y += 51) { g.beginPath(); g.moveTo(0, y); g.lineTo(512, y); g.stroke(); }
    g.lineWidth = 10; g.strokeRect(0, 0, 512, 256);
    return canvasTex(c, { repeat: rep });
  },
  plaster(rep = [4, 1]) {
    if (!hasDom()) return null; const c = cv(256, 256), g = c.getContext('2d'), r = rngOf(5);
    g.fillStyle = '#e6dcc6'; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(${120 + r() * 80},${110 + r() * 70},${90 + r() * 60},.07)`; g.fillRect(r() * 256, r() * 256, 4 + r() * 18, 4 + r() * 18); }
    return canvasTex(c, { repeat: rep });
  },
  barrel() {
    if (!hasDom()) return null; const c = cv(128, 128), g = c.getContext('2d'), r = rngOf(2);
    g.fillStyle = '#7a4d27'; g.fillRect(0, 0, 128, 128);
    for (let x = 0; x < 128; x += 16) { const v = r() * 30; g.fillStyle = `rgba(${50 + v},${20 + v / 2},0,.35)`; g.fillRect(x, 0, 2, 128); }
    g.fillStyle = '#2b2b2b'; g.fillRect(0, 14, 128, 8); g.fillRect(0, 106, 128, 8);
    return canvasTex(c);
  },
  radial() {
    if (!hasDom()) return null; const c = cv(64), g = c.getContext('2d'); const gr = g.createRadialGradient(32, 32, 4, 32, 32, 31);
    gr.addColorStop(0, '#fff'); gr.addColorStop(0.55, '#fff'); gr.addColorStop(1, '#000'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c);
  },
  detail() {                                              // tileable fbm greyscale for the near-ground micro detail layer
    if (!hasDom()) return null; const N = 128, c = cv(N), g = c.getContext('2d'), img = g.createImageData(N, N), r = rngOf(99);
    const oct = [[8, 1], [16, 0.6], [32, 0.4], [64, 0.25]].map(([n, w]) => { const a = new Float32Array(n * n); for (let i = 0; i < a.length; i++) a[i] = r(); return [n, w, a]; });
    const sm = (x) => x * x * (3 - 2 * x);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      let v = 0, ws = 0;
      for (const [n, w, a] of oct) { const fx = (x / N) * n, fy = (y / N) * n, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = sm(fx - x0), ty = sm(fy - y0);
        const A = a[(y0 % n) * n + (x0 % n)], B = a[(y0 % n) * n + ((x0 + 1) % n)], C = a[(((y0 + 1) % n)) * n + (x0 % n)], D = a[(((y0 + 1) % n)) * n + ((x0 + 1) % n)];
        v += w * (lerp(lerp(A, B, tx), lerp(C, D, tx), ty)); ws += w; }
      const k = Math.max(0, Math.min(255, (v / ws) * 255 * 1.0)), i = (y * N + x) * 4; img.data[i] = img.data[i + 1] = img.data[i + 2] = k; img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0); return canvasTex(c, { srgb: false });
  },
  shaft() {                                               // daylight spill on the floor of a room
    if (!hasDom()) return null; const c = cv(64, 128), g = c.getContext('2d'); const gr = g.createLinearGradient(0, 0, 0, 128);
    gr.addColorStop(0, 'rgba(255,240,200,.95)'); gr.addColorStop(1, 'rgba(255,220,160,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 128);
    const m = g.createLinearGradient(0, 0, 64, 0); m.addColorStop(0, 'rgba(0,0,0,1)'); m.addColorStop(.2, 'rgba(0,0,0,0)'); m.addColorStop(.8, 'rgba(0,0,0,0)'); m.addColorStop(1, 'rgba(0,0,0,1)');
    g.globalCompositeOperation = 'destination-out'; g.fillStyle = m; g.fillRect(0, 0, 64, 128); return canvasTex(c);
  },
  glow() {
    if (!hasDom()) return null; const c = cv(64), g = c.getContext('2d'); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,214,140,1)'); gr.addColorStop(0.35, 'rgba(255,170,70,.45)'); gr.addColorStop(1, 'rgba(255,150,40,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return canvasTex(c);
  },
  fadeV(top = 0.0, bottom = 1.0, pivot = 0.25) {          // vertical alpha gradient (white), used as alphaMap
    if (!hasDom()) return null; const c = cv(4, 128), g = c.getContext('2d'); const gr = g.createLinearGradient(0, 0, 0, 128);
    const a = (v) => `rgb(${Math.round(v * 255)},${Math.round(v * 255)},${Math.round(v * 255)})`;
    gr.addColorStop(0, a(top)); gr.addColorStop(pivot, a(bottom)); gr.addColorStop(1, a(bottom)); g.fillStyle = gr; g.fillRect(0, 0, 4, 128);
    const t = new THREE.CanvasTexture(c); return t;
  },
  hazeStrip(color) {
    if (!hasDom()) return null; const c = cv(4, 128), g = c.getContext('2d'); const gr = g.createLinearGradient(0, 0, 0, 128);
    const col = new THREE.Color(color), rgb = `${Math.round(col.r * 255)},${Math.round(col.g * 255)},${Math.round(col.b * 255)}`;
    gr.addColorStop(0, `rgba(${rgb},0)`); gr.addColorStop(0.65, `rgba(${rgb},.55)`); gr.addColorStop(1, `rgba(${rgb},.9)`); g.fillStyle = gr; g.fillRect(0, 0, 4, 128);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  },
  flake() {
    if (!hasDom()) return null; const c = cv(32), g = c.getContext('2d'); const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 32, 32); return canvasTex(c);
  },
};

// ---- shader tweaks
function addSway(material, uniforms, { amp = 0.35, speed = 1.3, phase = 0 } = {}) {
  material.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = uniforms.time; sh.uniforms.uWind = uniforms.wind; sh.uniforms.uAmp = { value: amp }; sh.uniforms.uSpeed = { value: speed }; sh.uniforms.uPhase = { value: phase };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;uniform float uWind;uniform float uAmp;uniform float uSpeed;uniform float uPhase;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nfloat sw = uv.y * uv.y;\ntransformed.x += (sin(uTime * uSpeed + uPhase + position.y * 0.35) * 0.7 + sin(uTime * uSpeed * 2.3 + uPhase * 1.7) * 0.3) * uAmp * uWind * sw;');
  };
  material.customProgramCacheKey = () => 'sway';
}
function addHaze(material, uniforms, { near = 40, far = 130, detail = null } = {}) {   // distance fade of the ground to the horizon haze colour (+ near micro detail)
  material.onBeforeCompile = (sh) => {
    sh.uniforms.uHaze = uniforms.haze; sh.uniforms.uNear = { value: near }; sh.uniforms.uFar = { value: far };
    sh.uniforms.uDetail = { value: detail }; sh.uniforms.uDetailOn = { value: detail ? 1 : 0 };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWp;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvWp = (modelMatrix * vec4(transformed,1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWp;uniform vec3 uHaze;uniform float uNear;uniform float uFar;uniform sampler2D uDetail;uniform float uDetailOn;')
      .replace('#include <dithering_fragment>', 'if (uDetailOn > 0.5) { float d1 = texture2D(uDetail, vWp.xz * 0.43).r; float d2 = texture2D(uDetail, vWp.xz * 0.11).r; float d3 = texture2D(uDetail, vWp.xz * 0.021).r; float nf = 1.0 - smoothstep(14.0, 75.0, length(vWp.xz - cameraPosition.xz)); gl_FragColor.rgb *= (mix(1.0, 0.62 + 0.76 * d1, nf) * (0.78 + 0.44 * d2) * (0.86 + 0.28 * d3)); }\ngl_FragColor.rgb = mix(gl_FragColor.rgb, uHaze, smoothstep(uNear, uFar, length(vWp.xz)) * 0.92);\n#include <dithering_fragment>');
  };
  material.customProgramCacheKey = () => 'haze';
}

// ---- texture loading with a shared cache per base URL
const texCache = new Map();
function loadTexture(url, { aniso = 4, repeat, srgb = true, mirror = false, clampT } = {}) {
  const key = url + (mirror ? '|m' : '');
  let p = texCache.get(key);
  if (!p) {
    p = new Promise((res, rej) => new THREE.TextureLoader().load(url, (t) => { if (srgb) t.colorSpace = THREE.SRGBColorSpace; res(t); }, undefined, rej));
    texCache.set(key, p);
  }
  return p.then((t) => { const c = t.clone(); c.needsUpdate = true; c.anisotropy = aniso; c.wrapS = THREE.RepeatWrapping; c.wrapT = (repeat && repeat[1] > 1) || clampT === false ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping; if (repeat) c.repeat.set(repeat[0], repeat[1]); return c; });
}
const jsonCache = new Map();
export function loadSceneryCatalogue(base = defaultSceneryBase()) {
  if (!jsonCache.has(base)) jsonCache.set(base, fetch(base + 'catalogue.json').then((r) => { if (!r.ok) throw new Error('scenery catalogue ' + r.status); return r.json(); }));
  return jsonCache.get(base);
}
/** Find the best asset id for { kind, culture, season, tags }. */
export function pickScenery(cat, { kind, culture, season, tag } = {}) {
  let best = null, score = -1;
  for (const a of cat.assets) {
    if (kind && a.kind !== kind) continue;
    let s = 0; if (culture && a.culture === culture) s += 4; else if (a.culture === 'any') s += 1;
    if (season && a.season === season) s += 2; if (tag && a.tags.includes(tag)) s += 1;
    if (s > score) { score = s; best = a; }
  }
  return best ? best.id : null;
}

// ---- main entry
export function buildScenery(opts = {}) {
  const q = QUALITY[opts.quality || 'high'] || QUALITY.high;
  const tod = TIME_OF_DAY[typeof opts.timeOfDay === 'string' ? opts.timeOfDay : 'day'] || TIME_OF_DAY.day;
  const R = opts.radius || 120;
  const group = new THREE.Group(); group.name = 'scenery';
  const uniforms = { time: { value: 0 }, wind: { value: opts.wind ?? 0.6 }, haze: { value: new THREE.Color(tod.haze) } };
  const follow = [], tickers = [], disposables = [], swayCards = [];
  const base = opts.base || defaultSceneryBase();
  const state = { tod: typeof opts.timeOfDay === 'string' ? opts.timeOfDay : 'day', season: opts.season || 'summer', cloudSpeed: opts.clouds ?? 1, shimmer: opts.shimmer ?? 1 };
  const photoMats = [], groundMats = [];
  const out = {
    group, ready: null, uniforms, preset: opts.preset || null, state,
    lights: { sun: tod.sun, sunIntensity: tod.sunI, ambient: tod.amb, ambientIntensity: tod.ambI, haze: tod.haze },
    /** Add matching lights to a scene if the game's rig has none (optional). */
    addLights(scene) {
      const a = new THREE.HemisphereLight(tod.amb, 0x4a4030, tod.ambI); const d = new THREE.DirectionalLight(tod.sun, tod.sunI); d.position.set(-30, 50, 20);
      scene.add(a, d); return { a, d };
    },
    setTimeOfDay(name) {
      const t = TIME_OF_DAY[name]; if (!t) return; state.tod = name; uniforms.haze.value.set(t.haze);
      for (const m of photoMats) m.color.setRGB(...mul(t.photo, m.userData.grade));
      for (const m of groundMats) m.color.setRGB(...mul(t.ground, m.userData.grade));
    },
    setWind(v) { uniforms.wind.value = v; },
    update(dt, camera) {
      uniforms.time.value += dt;
      if (camera) for (const o of follow) { o.position.x = camera.position.x; o.position.z = camera.position.z; }
      for (const f of tickers) f(dt, camera);
    },
    dispose() { group.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) { const ms = Array.isArray(o.material) ? o.material : [o.material]; ms.forEach((m) => { for (const k of ['map', 'alphaMap']) if (m[k]) m[k].dispose(); m.dispose(); }); } }); },
  };
  const mul = (a, b) => [a[0] * (b ? b[0] : 1), a[1] * (b ? b[1] : 1), a[2] * (b ? b[2] : 1)];
  const seasonMul = SEASON[state.season] || SEASON.summer;

  out.ready = (async () => {
    const cat = opts.catalogue || (await loadSceneryCatalogue(base));
    const byId = new Map(cat.assets.map((a) => [a.id, a]));
    let def = opts.layers ? { layers: opts.layers, culture: opts.culture } : cat.presetDefs[opts.preset];
    if (!def) throw new Error(`scenery3d: unknown preset "${opts.preset}"`);
    let layers = def.layers.map((l) => ({ ...l }));
    const sOver = (def.seasons && def.seasons[state.season]) || null;
    for (const L of layers) {
      if (sOver && sOver[L.t] && L.t === 'sky' || sOver && sOver[L.t] && L.t === 'backdrop') L.id = sOver[L.t];
      if (L.season && L.season[state.season]) Object.assign(L, L.season[state.season]);
      if (opts.culture && opts.culture !== def.culture && L.t === 'backdrop') { const pid = pickScenery(cat, { kind: 'backdrop', culture: opts.culture, season: state.season }); if (pid) L.id = pid; }
    }
    let hazeHex = def.haze || tod.haze; uniforms.haze.value.set(hazeHex);
    const tex = (id, o) => loadTexture(base + byId.get(id).file, { aniso: q.aniso, ...o });
    const tint = (L) => { const g = L.grade ? GRADE[L.grade] : null; return [(g ? g[0] : 1) * seasonMul[0], (g ? g[1] : 1) * seasonMul[1], (g ? g[2] : 1) * seasonMul[2]]; };
    const photoMat = (map, L, extra = {}) => {
      const m = new THREE.MeshBasicMaterial({ map, toneMapped: false, fog: false, ...extra });
      m.userData.grade = tint(L); m.color.setRGB(...mul(tod.photo, m.userData.grade)); photoMats.push(m); return m;
    };
    const groundMat = (map, L, extra = {}) => {
      const { detail: _d, ...rest } = extra; extra = { ...rest, detail: _d };
      const m = new THREE.MeshLambertMaterial({ map, ...rest }); m.userData.grade = tint(L); m.color.setRGB(...mul(tod.ground, m.userData.grade)); groundMats.push(m); addHaze(m, uniforms, { near: 35, far: R * 0.95, detail: extra.detail === false ? null : detailTex }); return m;
    };
    const detailTex = PROC.detail();
    let skyId = null;
    let horizonY = -0.05;

    for (const L of layers) {
      const rnd = rngOf((L.seed || 1) * 7919 + (opts.seed || 0));
      if (L.t === 'sky') {
        skyId = L.id; let map = await tex(L.id, { repeat: [2, 1] });
        const hgt = R * 1.0;
        let capCol = new THREE.Color(hazeHex);
        if (hasDom() && map.image && map.image.width) {
          // compose: clean zenith gradient on top, photo faded into it, so no texel is ever stretched towards the pole
          const img = map.image, W = 1024, H = 512, c = cv(W, H), g = c.getContext('2d');
          const s = cv(8, 8), sg = s.getContext('2d'); sg.drawImage(img, 0, 0, img.width, Math.max(1, img.height * 0.12), 0, 0, 8, 8);
          const d = sg.getImageData(0, 0, 8, 8).data; let r = 0, gg = 0, b = 0; for (let i = 0; i < 256; i += 4) { r += d[i]; gg += d[i + 1]; b += d[i + 2]; }
          r /= 64; gg /= 64; b /= 64;
          const z = `rgb(${Math.round(r * 0.78)},${Math.round(gg * 0.84)},${Math.round(b * 0.96)})`, mid = `rgb(${Math.round(r)},${Math.round(gg)},${Math.round(b)})`;
          const gr = g.createLinearGradient(0, 0, 0, H * 0.62); gr.addColorStop(0, z); gr.addColorStop(1, mid); g.fillStyle = gr; g.fillRect(0, 0, W, H);
          const ph = cv(W, Math.round(H * 0.6)), pg = ph.getContext('2d');
          pg.drawImage(img, 0, 0, W, ph.height);
          pg.globalCompositeOperation = 'destination-in'; const mk = pg.createLinearGradient(0, 0, 0, ph.height); mk.addColorStop(0, 'rgba(0,0,0,0)'); mk.addColorStop(0.45, 'rgba(0,0,0,1)'); mk.addColorStop(1, 'rgba(0,0,0,1)');
          pg.fillStyle = mk; pg.fillRect(0, 0, W, ph.height);
          g.drawImage(ph, 0, H - ph.height);
          map = canvasTex(c, { repeat: [1, 1] }); map.wrapT = THREE.ClampToEdgeWrapping; map.anisotropy = q.aniso;
          capCol = new THREE.Color(r / 255 * 0.78, gg / 255 * 0.84, b / 255 * 0.96).convertSRGBToLinear();
        }
        const geo = new THREE.CylinderGeometry(R * 1.25, R * 1.25, hgt, q.seg, 1, true);
        const m = photoMat(map, L, { side: THREE.BackSide, depthWrite: false });
        const mesh = new THREE.Mesh(geo, m); mesh.renderOrder = -20; mesh.position.y = hgt / 2 - R * 0.05; group.add(mesh); follow.push(mesh);
        const cm = new THREE.Mesh(new THREE.CircleGeometry(R * 1.25, q.seg), new THREE.MeshBasicMaterial({ color: capCol, toneMapped: false, fog: false, side: THREE.DoubleSide, depthWrite: false }));
        cm.rotation.x = Math.PI / 2; cm.position.y = hgt - R * 0.05; cm.renderOrder = -21; group.add(cm); follow.push(cm);
        photoMats.push(cm.material); cm.material.userData.grade = [1, 1, 1];
        tickers.push((dt) => { map.offset.x = (map.offset.x + dt * 0.004 * state.cloudSpeed) % 1; });
      } else if (L.t === 'backdrop') {
        const a = byId.get(L.id); const aspect = a.size[0] / a.size[1];
        let map = await tex(L.id, { repeat: [3, 1] }); map.offset.x = 0.25;   // view axis (-z) lands on the middle of a mirrored half
        const circ = TAU * R, hgt = circ / (3 * aspect);
        if (hasDom() && map.image && map.image.width && L.compose !== false) {
          // 360 degree panorama from un-mirrored crops with per-segment scale / shift / brightness jitter (no symmetric twins);
          // L.mix lists extra backdrop ids of the same family that are interleaved.
          const ids = [L.id, ...(L.mix || [])].filter((i) => byId.has(i));
          const imgs = [];
          for (const i of ids) imgs.push(i === L.id ? map.image : (await tex(i, {})).image);
          const CW = 2048, CH = Math.max(64, Math.round(CW / (3 * aspect))), c = cv(CW, CH), g = c.getContext('2d');
          const N = 6, segW = CW / N, ov = segW * 0.28, r2 = rngOf(((L.seed || 1) * 97 + 13) >>> 0);
          const order = []; for (let i = 0; i < N; i++) order.push(i % imgs.length);
          g.fillStyle = '#888'; g.fillRect(0, 0, CW, CH);
          const hz = a.horizon ?? 0.62;
          for (let i = 0; i < N + 1; i++) {
            const im = imgs[order[i % N]], iw = im.width, ih = im.height;
            const sx0 = [0, 0.1, 0.03, 0.14, 0.06, 0.18][i % 6] * iw * 0.5;             // window start inside the un-mirrored half
            const sw = iw * 0.5 * (0.78 + 0.2 * r2());                                       // crop width (zoom jitter)
            const sc = 0.9 + 0.22 * r2(), dh = CH * sc, dy = (CH * hz) - dh * hz + (r2() - 0.5) * CH * 0.05;   // scale about the horizon
            const x = i * segW - ov / 2; const w = segW + ov;
            const seg = cv(Math.ceil(w), CH), sgx = seg.getContext('2d');
            sgx.filter = `brightness(${(0.93 + 0.14 * r2()).toFixed(2)}) saturate(${(0.92 + 0.16 * r2()).toFixed(2)})`;
            sgx.drawImage(im, sx0, 0, sw, ih, 0, dy, seg.width, dh);
            sgx.filter = 'none';
            sgx.globalCompositeOperation = 'destination-in';
            const mk = sgx.createLinearGradient(0, 0, seg.width, 0); const e = ov / seg.width;
            mk.addColorStop(0, 'rgba(0,0,0,0)'); mk.addColorStop(e, 'rgba(0,0,0,1)'); mk.addColorStop(1 - e, 'rgba(0,0,0,1)'); mk.addColorStop(1, 'rgba(0,0,0,0)');
            sgx.fillStyle = mk; sgx.fillRect(0, 0, seg.width, CH);
            g.drawImage(seg, x, 0);
            if (i === 0) g.drawImage(seg, CW + x, 0);                                       // wrap the first segment's left feather over the end
          }
          const nm = canvasTex(c, { repeat: [1, 1] }); nm.wrapT = THREE.ClampToEdgeWrapping; nm.anisotropy = q.aniso; nm.offset.x = 0.0; map = nm;
        }
        const geo = new THREE.CylinderGeometry(R, R, hgt, q.seg, 1, true);
        const alpha = PROC.fadeV(0.0, 1.0, 0.28);
        const m = photoMat(map, L, { side: THREE.BackSide, transparent: true, alphaMap: alpha, depthWrite: false });
        const mesh = new THREE.Mesh(geo, m); mesh.renderOrder = -15; mesh.position.y = 3 + ((a.horizon ?? 0.62) - 0.5) * hgt; horizonY = hgt;
        group.add(mesh); follow.push(mesh);
        // haze ring blends the bottom of the photo into the ground edge
        const hz = PROC.hazeStrip(hazeHex);
        if (hz) {
          const hm = new THREE.MeshBasicMaterial({ map: hz, transparent: true, side: THREE.BackSide, depthWrite: false, fog: false, toneMapped: false });
          const hmesh = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.985, R * 0.985, hgt * 0.16, q.seg, 1, true), hm); hmesh.position.y = 3 + 0.05 * hgt; hmesh.renderOrder = -14;
          group.add(hmesh); follow.push(hmesh); tickers.push(() => { hm.color.set(1, 1, 1); });
          out._hazeMat = hm;
        }
      } else if (L.t === 'band') {
        const a = byId.get(L.id); const aspect = a.size[0] / a.size[1];
        const arc = L.arc || [0, 360]; const span = arc[1] - arc[0]; const r = L.r || 70, h = L.h || 14;
        const map = await tex(L.id, { repeat: [Math.max(1, (rad(span) * r) / (h * aspect)), 1] });
        const full = span >= 359;
        const segs = Math.max(8, Math.round(q.seg * span / 360));
        const geo = new THREE.CylinderGeometry(r, r, h, segs, 1, true, rad(arc[0]) - Math.PI / 2, rad(span));
        if (!full) {                                   // soft horizontal ends so partial arcs never show a hard edge
          const pc = geo.attributes.position.count, col = new Float32Array(pc * 4), pos = geo.attributes.position;
          for (let i = 0; i < pc; i++) { const col_i = i % (segs + 1); const u = col_i / segs; const e = Math.min(1, Math.min(u, 1 - u) / 0.14); col.set([1, 1, 1, e * e * (3 - 2 * e)], i * 4); }
          geo.setAttribute('color', new THREE.BufferAttribute(col, 4));
        }
        const m = photoMat(map, L, { side: THREE.BackSide, transparent: true, alphaTest: 0.02, depthWrite: false, vertexColors: !full });
        const mesh = new THREE.Mesh(geo, m); mesh.position.y = h / 2 - 0.4 + (L.y || 0); mesh.renderOrder = -10;
        group.add(mesh);
      } else if (L.t === 'ground') {
        const size = L.size || 160;
        const rp = Math.round((L.shape === 'plane' ? size : size * 2) / (L.tile || 4.5));
        const map = await tex(L.id, { repeat: [rp, L.shape === 'plane' ? Math.round((L.depth || size) / (L.tile || 4.5)) : rp], clampT: false });
        const geo = L.shape === 'plane' ? new THREE.PlaneGeometry(size, L.depth || size) : new THREE.CircleGeometry(size, q.seg);
        const m = groundMat(map, L);
        const mesh = new THREE.Mesh(geo, m); mesh.rotation.x = -Math.PI / 2; mesh.position.set(L.x || 0, 0, L.z || 0); mesh.receiveShadow = true; mesh.renderOrder = -5;
        group.add(mesh);
      } else if (L.t === 'ground-patch') {
        const map = await tex(L.id, { repeat: [2, 2], clampT: false });
        const n = Math.round((L.count || 8) * q.density);
        for (let i = 0; i < n; i++) {
          const a = rnd() * TAU, r = lerp(L.r[0], L.r[1], rnd()), s = lerp(L.size[0], L.size[1], rnd());
          const m = groundMat(map, L, { transparent: true, alphaMap: PROC.radial() });
          m.depthWrite = false; m.polygonOffset = true; m.polygonOffsetFactor = -2;
          const mesh = new THREE.Mesh(new THREE.CircleGeometry(s, 20), m); mesh.rotation.x = -Math.PI / 2; mesh.rotation.z = rnd() * TAU;
          mesh.position.set(Math.cos(a) * r, 0.02, Math.sin(a) * r); mesh.renderOrder = -4; group.add(mesh);
        }
      } else if (L.t === 'water') {
        if (!q.water && state.tod !== 'night') { /* low quality still draws a flat water plane */ }
        const map = await tex(L.id, { repeat: [Math.max(2, L.w / 14), Math.max(1, L.d / 14)], clampT: false });
        const geo = new THREE.PlaneGeometry(L.w, L.d);
        const m = new THREE.MeshBasicMaterial({ map, toneMapped: false, color: new THREE.Color(...mul(tod.ground, [0.92, 1.0, 1.08])) });
        m.userData.grade = [0.92, 1.0, 1.08]; photoMats.push(m);
        const mesh = new THREE.Mesh(geo, m); mesh.rotation.x = -Math.PI / 2; mesh.position.set(L.x || 0, 0.03, L.z || 0); mesh.renderOrder = -3; group.add(mesh);
        const map2 = map.clone(); map2.needsUpdate = true; map2.repeat.set(map.repeat.x * 1.7, map.repeat.y * 1.7);
        const m2 = new THREE.MeshBasicMaterial({ map: map2, transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
        const mesh2 = new THREE.Mesh(geo, m2); mesh2.rotation.x = -Math.PI / 2; mesh2.position.set(L.x || 0, 0.045, L.z || 0); mesh2.renderOrder = -2;
        if (q.water && L.shimmer !== 0) group.add(mesh2);
        let t = 0;
        tickers.push((dt) => {
          t += dt; map.offset.x = (t * 0.012) % 1; map.offset.y = (t * 0.004) % 1;
          map2.offset.x = (-t * 0.02) % 1; map2.offset.y = (t * 0.015) % 1; m2.opacity = (0.18 + 0.14 * (0.5 + 0.5 * Math.sin(t * 1.7))) * state.shimmer;
        });
      } else if (L.t === 'cutouts') {
        const a = byId.get(L.id); const aspect = a.size[0] / a.size[1]; const map = await tex(L.id);
        const n = Math.round((L.count || 4) * q.density) || 1;
        const arc = L.arc || [0, 360];
        for (let i = 0; i < n; i++) {
          const ang = rad(lerp(arc[0], arc[1], (i + rnd() * 0.8) / n)), r = lerp(L.r[0], L.r[1], rnd());
          const h = lerp(L.scale[0], L.scale[1], rnd()), w = h * aspect;
          const geo = new THREE.PlaneGeometry(w, h, 1, 4); geo.translate(0, h / 2, 0);
          const m = photoMat(map, L, { transparent: true, alphaTest: 0.35, side: THREE.DoubleSide });
          if (L.sway) addSway(m, uniforms, { amp: (L.sway || 0.5) * h * 0.06, speed: 1.0 + rnd() * 0.6, phase: rnd() * TAU });
          const mesh = new THREE.Mesh(geo, m); mesh.position.set(Math.cos(ang) * r, -0.15, Math.sin(ang) * r); mesh.renderOrder = -2;
          swayCards.push(mesh); group.add(mesh);
        }
      } else if (L.t === 'ring' || L.t === 'scatter') {
        placeProps(L, rnd, group, { uniforms, tickers, tod, q, photoMats, hang: L.hang, shadowed: false });
      } else if (L.t === 'walls') {
        const map = PROC.plaster([10, 1]);
        const hf = L.half, hh = L.h; const gap = L.gap || null;
        const mat = (tintHex) => { const m = new THREE.MeshLambertMaterial({ map, color: new THREE.Color(tintHex || '#ffffff') }); groundMats.push(m); m.userData.grade = [1, 1, 1]; return m; };
        const sides = [[0, -hf, 0], [0, hf, Math.PI], [-hf, 0, Math.PI / 2], [hf, 0, -Math.PI / 2]];
        sides.forEach(([x, z, ry], i) => {
          const centerDeg = (Math.atan2(z, x) * 180) / Math.PI; const inGap = gap && ((centerDeg + 360) % 360 >= gap[0] && (centerDeg + 360) % 360 <= gap[1]);
          if (inGap) return;
          const w = new THREE.Mesh(new THREE.BoxGeometry(hf * 2, hh, 0.8), mat(L.tint)); w.position.set(x, hh / 2, z); w.rotation.y = ry; w.castShadow = true; w.receiveShadow = true; group.add(w);
          const cap = new THREE.Mesh(new THREE.BoxGeometry(hf * 2 + 0.6, 0.3, 1.2), mat('#6b5a48')); cap.position.set(x, hh + 0.1, z); cap.rotation.y = ry; group.add(cap);
        });
      } else if (L.t === 'room') {
        await buildRoom(L, { group, tex, byId, uniforms, tickers, photoMats, tod, q, follow });
      } else if (L.t === 'snow') {
        const n = Math.round((L.count || 200) * q.snow); const pos = new Float32Array(n * 3); const r = rngOf(17);
        for (let i = 0; i < n; i++) { pos[i * 3] = (r() - 0.5) * 60; pos[i * 3 + 1] = r() * 25; pos[i * 3 + 2] = (r() - 0.5) * 60; }
        const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        const pm = new THREE.PointsMaterial({ size: 0.28, map: PROC.flake(), transparent: true, depthWrite: false, color: 0xffffff, opacity: 0.9, toneMapped: false });
        const pts = new THREE.Points(g, pm); pts.frustumCulled = false; group.add(pts); follow.push(pts);
        tickers.push((dt) => { const p = g.attributes.position; for (let i = 0; i < n; i++) { let y = p.getY(i) - dt * (1.2 + (i % 5) * 0.2); if (y < 0) y += 25; p.setY(i, y); p.setX(i, p.getX(i) + Math.sin(uniforms.time.value + i) * dt * 0.3); } p.needsUpdate = true; });
      }
    }
    // billboards face the camera about Y (cheap), applied after sway so the shear stays in card space
    if (swayCards.length) tickers.push((dt, cam) => { if (!cam) return; for (const m of swayCards) m.rotation.y = Math.atan2(cam.position.x - m.position.x, cam.position.z - m.position.z); });
    out.horizonHeight = horizonY; out.skyId = skyId;
    return out;
  })();
  return out;
}

// ---- 3D props (procedural geometry + derived textures)
function placeProps(L, rnd, group, ctx) {
  const n = Math.max(1, Math.round((L.count || 6) * (L.t === 'scatter' ? ctx.q.density : 1)));
  const arc = L.arc || [0, 360];
  for (let i = 0; i < n; i++) {
    const f = L.t === 'ring' ? (i + 0.5) / n : rnd();
    const ang = rad(lerp(arc[0], arc[1], f)), r = lerp(L.r[0], L.r[1], rnd());
    const o = makeProp(L.kind, rnd, ctx, L);
    if (!o) continue;
    o.position.set(Math.cos(ang) * r, ctx.hang ? 0 : 0, Math.sin(ang) * r);
    if (L.kind === 'fence') o.rotation.y = -ang;                       // tangent to the ring
    else o.rotation.y = rnd() * TAU;
    group.add(o);
  }
}
const _geo = {};
function g(key, make) { return _geo[key] || (_geo[key] = make()); }
function makeProp(kind, rnd, ctx, L) {
  const grp = new THREE.Group();
  const lam = (c, extra = {}) => new THREE.MeshLambertMaterial({ color: c, ...extra });
  if (kind === 'barrel') {
    const m = lam(0xffffff, { map: PROC.barrel() });
    const geo = new THREE.CylinderGeometry(0.42, 0.42, 0.95, 18); const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) { const y = p.getY(i); const s = 1 + 0.16 * (1 - Math.abs(y) / 0.475); p.setX(i, p.getX(i) * s); p.setZ(i, p.getZ(i) * s); } geo.computeVertexNormals();
    const b = new THREE.Mesh(geo, m); b.position.y = 0.475; b.castShadow = true; grp.add(b);
  } else if (kind === 'crate') {
    const m = lam(0xffffff, { map: PROC.wood([1, 1]) }); const s = lerp(0.6, 1.0, rnd());
    const b = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), m); b.position.y = s / 2; b.castShadow = true; grp.add(b);
  } else if (kind === 'fence') {
    const m = lam(0xffffff, { map: PROC.wood([1, 1]) });
    for (let k = -1; k <= 1; k += 2) { const post = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.1, 0.14), m); post.position.set(k * 1.0, 0.55, 0); post.castShadow = true; grp.add(post); }
    for (const y of [0.4, 0.82]) { const rail = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.1, 0.07), m); rail.position.set(0, y, 0); grp.add(rail); }
  } else if (kind === 'lantern') {
    const col = new THREE.Color('#ffcf7a');
    const paper = new THREE.MeshBasicMaterial({ color: col, toneMapped: false });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.2, 0.55, 14), paper);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 2.2, 8), lam(0x3b2a1c));
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0, 0.3, 0.22, 14), lam(0x2a1d14));
    if (ctx.hang) { body.position.y = 3.6; cap.position.y = 3.98; const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 1.4, 4), lam(0x222222)); cord.position.y = 4.7; grp.add(cord); }
    else { post.position.y = 1.1; body.position.y = 2.35; cap.position.y = 2.72; grp.add(post); }
    grp.add(body, cap);
    const glow = PROC.glow();
    if (glow) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: ctx.tod.sunI < 0.6 ? 0.95 : 0.35, toneMapped: false })); sp.scale.set(1.6, 1.6, 1); sp.position.copy(body.position); grp.add(sp); }
  } else if (kind === 'flag') {
    const cols = L.colors || ['#c0392b', '#ffffff'];
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 3.2, 8), lam(0xdddddd)); pole.position.y = 1.6; grp.add(pole);
    const cloth = new THREE.MeshLambertMaterial({ color: new THREE.Color(cols[Math.floor(rnd() * cols.length)]), side: THREE.DoubleSide });
    const geo = new THREE.PlaneGeometry(1.0, 0.6, 10, 1); geo.translate(0.5, 0, 0);
    const f = new THREE.Mesh(geo, cloth); f.position.set(0.04, 2.8, 0); grp.add(f);
    const ph = rnd() * TAU, p = geo.attributes.position, base = Float32Array.from(p.array);
    ctx.tickers.push(() => { const t = ctx.uniforms.time.value, w = ctx.uniforms.wind.value; for (let i = 0; i < p.count; i++) { const x = base[i * 3]; p.setZ(i, Math.sin(t * 3 + x * 3 + ph) * 0.12 * x * (0.4 + w)); } p.needsUpdate = true; });
  } else if (kind === 'haystack') {
    const m = lam(0xd6b85a);
    const b = new THREE.Mesh(new THREE.SphereGeometry(1.2, 14, 10, 0, TAU, 0, Math.PI / 2), m); b.scale.set(1, 1.15, 1); b.castShadow = true; grp.add(b);
  } else return null;
  grp.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return grp;
}

// ---- interiors (tatami room, tea house)
async function buildRoom(L, { group, tex, byId, uniforms, tickers, photoMats, tod, q, follow }) {
  const [W, D, H] = L.size || [12, 10, 4.5];
  const floorTex = L.floor === 'tatami' ? PROC.tatami([Math.round(W / 1.8), Math.round(D / 3.6)]) : PROC.wood([Math.round(W / 2.2), Math.round(D / 2.2)]);
  const wallTex = L.walls === 'shoji' ? PROC.shoji([Math.round(W / 4), 1]) : PROC.plaster([4, 1]);
  const floorM = new THREE.MeshLambertMaterial({ map: floorTex, color: floorTex ? 0xffffff : 0xb49a6a });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), floorM); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; group.add(floor);
  const wallM = new THREE.MeshLambertMaterial({ map: wallTex, color: wallTex ? 0xffffff : 0xe6dcc6, side: THREE.DoubleSide });
  const dark = new THREE.MeshLambertMaterial({ color: 0x4a301b });
  // back wall (-z) with a window opening showing the outside view; side walls; front open (camera side)
  const back = new THREE.Mesh(new THREE.PlaneGeometry(W, H), wallM); back.position.set(0, H / 2, -D / 2); group.add(back);
  for (const sx of [-1, 1]) { const s = new THREE.Mesh(new THREE.PlaneGeometry(D, H), wallM); s.position.set(sx * W / 2, H / 2, 0); s.rotation.y = -sx * Math.PI / 2; group.add(s); }
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshLambertMaterial({ color: 0x7a5a38, emissive: 0x3a2a18, side: THREE.DoubleSide })); ceil.position.y = H; ceil.rotation.x = Math.PI / 2; group.add(ceil);
  if (L.beams) for (let i = -2; i <= 2; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.32, D), dark); b.position.set(i * (W / 5), H - 0.16, 0); group.add(b); }
  for (const x of [-W / 2, W / 2]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.34, H, 0.34), dark); p.position.set(x, H / 2, -D / 2); group.add(p); }
  // outside view: sky dome + backdrop seen through a large window in the back wall
  if (L.window && byId.has(L.window)) {
    const map = await tex(L.window, { repeat: [1, 1] });
    const ww = W * 0.5, wh = H * 0.62;
    const m = new THREE.MeshBasicMaterial({ map, toneMapped: false });
    map.repeat.set(0.5, 1); map.offset.set(0, 0);                      // one un-mirrored half
    m.userData.grade = [1, 1, 1]; photoMats.push(m); m.color.setRGB(...tod.photo);
    const view = new THREE.Mesh(new THREE.PlaneGeometry(ww, wh), m); view.position.set(0, H * 0.5, -D / 2 + 0.03); group.add(view);
    const bar = (w, h, x, y) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.18), dark); o.position.set(x, y, -D / 2 + 0.07); group.add(o); };
    bar(ww + 0.4, 0.2, 0, H * 0.5 + wh / 2 + 0.1); bar(ww + 0.4, 0.2, 0, H * 0.5 - wh / 2 - 0.1); bar(0.2, wh, -ww / 2 - 0.1, H * 0.5); bar(0.2, wh, ww / 2 + 0.1, H * 0.5); bar(0.08, wh, 0, H * 0.5); bar(ww, 0.08, 0, H * 0.5);
  }
  // interior lighting: warm fill, daylight spill from the window, lantern pools
  group.add(new THREE.HemisphereLight(0xfff1dc, 0x7a5a3a, 1.5));
  const amb = new THREE.AmbientLight(0xffe4bc, 0.9); group.add(amb);
  const sun = new THREE.DirectionalLight(0xfff0cf, 1.6 * Math.max(0.35, tod.sunI)); sun.position.set(-2, H * 0.9, -D / 2 - 6); sun.target.position.set(0, 0, D * 0.15); group.add(sun, sun.target);
  const warm = new THREE.PointLight(0xffd9a0, 40, W * 1.4, 1.5); warm.position.set(0, H - 0.7, 0.5); group.add(warm);
  const sh = PROC.shaft();
  if (sh) { const sp = new THREE.Mesh(new THREE.PlaneGeometry(W * 0.5, D * 0.62), new THREE.MeshBasicMaterial({ map: sh, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    sp.rotation.x = -Math.PI / 2; sp.rotation.z = Math.PI; sp.position.set(0, 0.03, -D / 2 + D * 0.31 + 0.2); group.add(sp); }
  const glow = PROC.glow();
  if (glow && L.beams !== undefined) for (let i = 0; i < 4; i++) { const gx = -W * 0.3 + i * W * 0.2; const pool = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 4.2), new THREE.MeshBasicMaterial({ map: glow, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    pool.rotation.x = -Math.PI / 2; pool.position.set(gx, 0.04, -D * 0.12 + (i % 2) * 2.4); group.add(pool); const pl = new THREE.PointLight(0xffb866, 14, 7, 1.6); pl.position.set(gx, 2.4, pool.position.z); group.add(pl); }
  // wainscot + warmer beams read as wall structure under the lamps
  const wain = new THREE.MeshLambertMaterial({ map: PROC.wood([Math.round(W / 2), 1]), color: 0xd9b58a });
  const wb = new THREE.Mesh(new THREE.BoxGeometry(W, 1.0, 0.12), wain); wb.position.set(0, 0.5, -D / 2 + 0.07); group.add(wb);
  for (const sx of [-1, 1]) { const ws = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.0, D), wain); ws.position.set(sx * (W / 2 - 0.07), 0.5, 0); group.add(ws); }
}
