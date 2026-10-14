// The whole chute as a real lit 3D scene (presentation only: reads the run state, never writes back).
//
// One WebGL scene holds the ice floor, banked walls with a coloured rim, snow shoulders, pines, bend signs, start line, finish arch, ice ruts,
// the racing line, mountains, sky, falling snow and the rider's spray, plus the rider / sled / ghost from luger.js. The camera reproduces the
// 2D chute's camera exactly (same follow distance, lateral drift, bank roll and focal length) so the HUD, which is laid over the picture, and
// every gameplay readout stay where they were. The 2D picture (render.js) remains the fallback and the loading picture.
import { createStage, THREE } from '../vendor3d/index.js';
import { createLuger } from './luger.js';
import { SEG, HW, at, nrefAt } from '../src/track.js';

const { Vector3, Color } = THREE;
const WALL_H = 1.15;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const hash = (i) => { let x = (i * 374761393 + 668265263) | 0; x = (x ^ (x >>> 13)) * 1274126177 | 0; return ((x ^ (x >>> 16)) >>> 0) / 4294967296; };
const nowMs = () => globalThis.performance.now();
const tick = () => new Promise((r) => { let done = false; const f = () => { if (!done) { done = true; r(); } }; if (globalThis.requestAnimationFrame) globalThis.requestAnimationFrame(f); setTimeout(f, 40); });
const srgb = (c, k = 1) => new Color().setRGB(clamp(c[0] / 255 * k, 0, 1), clamp(c[1] / 255 * k, 0, 1), clamp(c[2] / 255 * k, 0, 1), THREE.SRGBColorSpace);
const hexRgb = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const mix3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const cv = (w, h = w) => { const c = globalThis.document.createElement('canvas'); c.width = w; c.height = h; return c; };
const rng = (seed) => { let s = seed >>> 0 || 1; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; };

const SUN = new Vector3(0.52, 0.62, -0.58).normalize();       // direction TO the sun (scene axes)
const tiltOf = (T, i) => clamp(HW * Math.tan(T.bank[Math.min(i, T.N - 1)]) * 0.55, -2.3, 2.3);

// ------------------------------------------------------------------ textures
function tex(canvas, { srgbMap = true, rep = true, aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(canvas);
  if (rep) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = srgbMap ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = aniso; t.needsUpdate = true;
  return t;
}
function iceCanvas() {
  const c = cv(512), g = c.getContext('2d'), r = rng(11);
  g.fillStyle = '#f4fafe'; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 34; i++) { const x = r() * 512, y = r() * 512, rad = 40 + r() * 120; const gr = g.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, `rgba(150,196,230,${0.10 + r() * 0.12})`); gr.addColorStop(1, 'rgba(150,196,230,0)'); g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2); }
  for (let i = 0; i < 40; i++) { const x = r() * 512; g.strokeStyle = `rgba(110,160,205,${0.16 + r() * 0.28})`; g.lineWidth = 0.6 + r() * 1.6; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + (r() - 0.5) * 6, 512); g.stroke(); }
  for (let i = 0; i < 18; i++) { const x = r() * 512; g.strokeStyle = `rgba(255,255,255,${0.5 + r() * 0.4})`; g.lineWidth = 0.8 + r(); g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 512); g.stroke(); }
  for (let i = 0; i < 220; i++) { const x = r() * 512, y = r() * 512, l = 6 + r() * 26; g.strokeStyle = `rgba(${r() < 0.5 ? '255,255,255' : '120,170,210'},${0.12 + r() * 0.3})`; g.lineWidth = 0.6; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 6, y + l); g.stroke(); }
  return c;
}
function snowCanvas() {
  const c = cv(512), g = c.getContext('2d'), r = rng(5);
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 90; i++) { const x = r() * 512, y = r() * 512, rad = 20 + r() * 70; const gr = g.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, `rgba(176,205,232,${0.1 + r() * 0.14})`); gr.addColorStop(1, 'rgba(176,205,232,0)'); g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2); }
  for (let i = 0; i < 1400; i++) { g.fillStyle = r() < 0.55 ? 'rgba(255,255,255,0.9)' : 'rgba(150,185,220,0.22)'; const s = 0.6 + r() * 1.6; g.fillRect(r() * 512, r() * 512, s, s); }
  return c;
}
function labelTexture(draw, w = 256, h = 256) { const c = cv(w, h); draw(c.getContext('2d'), w, h); return tex(c, { rep: false, aniso: 4 }); }
function glowTexture(inner = 'rgba(255,248,224,1)', outer = 'rgba(255,240,200,0)') {
  const c = cv(128), g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, inner); gr.addColorStop(0.25, inner.replace(/[\d.]+\)$/, '0.5)')); gr.addColorStop(1, outer); g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  return tex(c, { rep: false });
}

// ------------------------------------------------------------------ the chute geometry
// station profile beyond a wall's top edge: [outward metres, height relative to the wall base (floor edge)]
const SHOULDER = [[0.62, 0.04], [1.5, -0.3], [3.2, -0.8], [6, -1.5], [10, -2.5], [16, -4.0], [24, -6.2], [34, -9.0], [44, -12.5]];

class Mesher {
  constructor() { this.pos = []; this.col = []; this.uv = []; this.idx = []; }
  // rows: array of point lists (same length each); points { p:[x,y,z], c:Color, uv:[u,v] }
  grid(rows) {
    if (rows.length < 2) return;
    const base = this.pos.length / 3, K = rows[0].length;
    for (const row of rows) for (const q of row) { this.pos.push(q.p[0], q.p[1], q.p[2]); this.col.push(q.c.r, q.c.g, q.c.b); this.uv.push(q.uv[0], q.uv[1]); }
    for (let i = 0; i < rows.length - 1; i++) for (let k = 0; k < K - 1; k++) {
      const a = base + i * K + k, b = a + 1, c = a + K, d = c + 1;
      this.idx.push(a, c, b, b, c, d);
    }
  }
  geometry() {
    if (!this.pos.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setIndex(this.idx);
    g.computeVertexNormals();
    g.computeBoundingSphere();
    return g;
  }
}

function pineGeometry() {
  const parts = [];
  const add = (geo, y) => { geo.translate(0, y, 0); parts.push(geo); };
  add(new THREE.CylinderGeometry(0.16, 0.24, 1.4, 7, 1), 0.7);
  const tiers = [[1.7, 2.6, 1.5], [1.4, 2.3, 2.7], [1.1, 2.0, 3.8], [0.78, 1.7, 4.8]];
  for (const [r, h, y] of tiers) add(new THREE.CylinderGeometry(0, r, h, 9, 1), y + h * 0.5 - 0.2);
  let n = 0; for (const g of parts) n += g.attributes.position.count;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3), idx = [];
  let off = 0;
  parts.forEach((g, pi) => {
    const p = g.attributes.position, nn = g.attributes.normal, ix = g.index;
    for (let i = 0; i < p.count; i++) {
      pos.set([p.getX(i), p.getY(i), p.getZ(i)], (off + i) * 3); nor.set([nn.getX(i), nn.getY(i), nn.getZ(i)], (off + i) * 3);
      let c;
      if (pi === 0) c = [0.2, 0.12, 0.07];
      else {
        const [, h, y] = tiers[pi - 1], t = clamp((p.getY(i) - (y - 0.2)) / h, 0, 1);       // 0 at the tier's skirt, 1 at its tip
        const snow = clamp(0.1 + 1.08 * t * t, 0, 1);
        c = [lerp(0.05, 0.92, snow), lerp(0.16, 0.95, snow), lerp(0.12, 0.98, snow)].map((v) => v * lerp(0.62, 1, t));
      }
      col.set(c, (off + i) * 3);
    }
    for (let i = 0; i < ix.count; i++) idx.push(ix.getX(i) + off);
    off += p.count;
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setIndex(idx);
  return geo;
}

export async function createWorld({ quality = 'medium', base } = {}) {
  const canvas = globalThis.document.createElement('canvas');
  const stage = createStage({ canvas, container: globalThis.document.body, quality, dprCap: 1, shadows: true, shadowSize: 11, lighting: 'day' });
  if (!stage.supported) return null;
  const { renderer, scene, camera } = stage;
  const api = { ready: false, lost: false, stage, renderer, quality, luger: null, readyAt: 0, W: 0, H: 0, slow: false };
  stage.onContextLost(() => { api.lost = true; });
  stage.onContextRestored(() => { api.lost = false; buildEnv(); });
  camera.near = 0.25; camera.far = 1600;
  renderer.toneMapping = THREE.NoToneMapping; renderer.toneMappingExposure = 1.0;

  // ---- lights (the stage's own rig, re-aimed at the sun)
  const L = stage.lights;
  L.hemi.color.set(0xcfe4ff); L.hemi.groundColor.set(0xdfe9f5); L.hemi.intensity = 1.0;
  L.key.color.set(0xfff0d6); L.key.intensity = 2.0;
  L.rim.color.set(0xa9c8ff); L.rim.intensity = 0.7;
  stage._shadowOffset.copy(SUN).multiplyScalar(34);
  if (L.key.shadow) {
    Object.assign(L.key.shadow.camera, { left: -11, right: 11, top: 11, bottom: -11, near: 1, far: 90 });
    L.key.shadow.camera.updateProjectionMatrix();
    L.key.shadow.bias = -0.0003; L.key.shadow.normalBias = 0.035;
  }

  // ---- reflections on the ice: a sky gradient with a bright sun patch (rebuilt on context restore)
  function buildEnv() {
    try {
      const es = new THREE.Scene();
      const sky = new THREE.Mesh(new THREE.SphereGeometry(10, 24, 12), new THREE.ShaderMaterial({
        side: THREE.BackSide, depthWrite: false,
        uniforms: { sun: { value: SUN.clone() } },
        vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
        fragmentShader: 'varying vec3 vP; uniform vec3 sun; void main(){ float h = clamp(vP.y*0.5+0.5,0.0,1.0); vec3 top = vec3(0.30,0.52,0.86), hor = vec3(0.86,0.92,0.98), low = vec3(0.78,0.86,0.95); vec3 c = mix(low, hor, smoothstep(0.30,0.52,h)); c = mix(c, top, smoothstep(0.52,0.9,h)); float s = max(dot(normalize(vP), sun),0.0); c += vec3(1.0,0.93,0.75)*(pow(s,48.0)*6.0 + pow(s,6.0)*0.35); gl_FragColor = vec4(c,1.0); }',
      }));
      es.add(sky);
      const pm = new THREE.PMREMGenerator(renderer);
      if (scene.environment && scene.environment.dispose) { try { scene.environment.dispose(); } catch { /* lost */ } }
      scene.environment = pm.fromScene(es, 0.02).texture;
      scene.environmentIntensity = 0.55;
      pm.dispose();
    } catch (e) { /* keep going without image based light */ }
  }
  buildEnv();
  await tick();

  // ---- textures and materials
  const iceT = tex(iceCanvas()), snowT = tex(snowCanvas());
  const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  iceT.anisotropy = snowT.anisotropy = aniso;
  const mIce = new THREE.MeshPhysicalMaterial({ map: iceT, vertexColors: true, roughness: 0.2, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.12, bumpMap: iceT, bumpScale: 0.35, envMapIntensity: 0.75, side: THREE.DoubleSide });
  const mWall = new THREE.MeshStandardMaterial({ map: snowT, vertexColors: true, roughness: 0.42, metalness: 0, envMapIntensity: 0.9, side: THREE.DoubleSide });
  const mRim = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.38, metalness: 0.05, side: THREE.DoubleSide });
  const mSnow = new THREE.MeshStandardMaterial({ map: snowT, vertexColors: true, roughness: 0.92, metalness: 0, bumpMap: snowT, bumpScale: 0.6, envMapIntensity: 0.5, side: THREE.DoubleSide });
  const mPine = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0 });
  const pineGeo = pineGeometry();
  await tick();

  // ---- sky dome, sun, mountains: they travel with the camera
  const backdrop = new THREE.Group(); scene.add(backdrop);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(1300, 32, 20), new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false, toneMapped: false }));
  dome.renderOrder = -20; dome.frustumCulled = false; backdrop.add(dome);
  const sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), blending: THREE.AdditiveBlending, depthWrite: false, fog: false, transparent: true, opacity: 0.95 }));
  sunSprite.scale.set(520, 520, 1); sunSprite.position.copy(SUN).multiplyScalar(1100); sunSprite.renderOrder = -19; backdrop.add(sunSprite);
  const mountains = new THREE.Group(); backdrop.add(mountains);
  const paintDome = (pal) => {
    const g = dome.geometry, p = g.attributes.position, c = [];
    const top = srgb(hexRgb(pal.sky0)), hor = srgb(hexRgb(pal.sky1)), fog = srgb(pal.fog);
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i) / 1300, col = new Color();
      if (y < 0.0) col.copy(fog); else if (y < 0.1) col.copy(fog).lerp(hor, y / 0.1); else col.copy(hor).lerp(top, clamp((y - 0.1) / 0.6, 0, 1) ** 0.8);
      c.push(col.r, col.g, col.b);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
  };
  const buildMountains = (pal, seedBase) => {
    while (mountains.children.length) { const o = mountains.children.pop(); o.geometry.dispose(); o.material.dispose(); }
    const fog = srgb(pal.fog), rock = srgb(pal.mount), snow = srgb(pal.snow);
    for (let layer = 0; layer < 3; layer++) {
      const R = [1000, 780, 560][layer], amp = [330, 270, 200][layer], n = 220, pos = [], col = [], idx = [];
      const r = rng(seedBase * 13 + layer * 7 + 3);
      const ph = [r() * 6, r() * 6, r() * 6];
      for (let i = 0; i <= n; i++) {
        const a = (i / n) * Math.PI * 2;
        const rough = Math.abs(Math.sin(a * 3 + ph[0]) * 0.55 + Math.sin(a * 7.3 + ph[1]) * 0.3 + Math.sin(a * 17 + ph[2]) * 0.15);
        const ridge = (1 - Math.abs(Math.sin(a * 5.1 + ph[1] * 2))) ** 2.2;
        const h = amp * (0.28 + 0.5 * rough + 0.45 * ridge) * (0.9 + 0.2 * hash(i + layer * 400));
        const x = Math.cos(a) * R, z = Math.sin(a) * R;
        const lit = 0.78 + 0.28 * Math.max(0, (Math.cos(a) * SUN.x + Math.sin(a) * SUN.z));
        const haze = [0.62, 0.45, 0.28][layer];
        for (const [y, t] of [[-120, 0], [h * 0.35, 0.35], [h * 0.68, 0.7], [h, 1]]) {
          const c = new Color().copy(fog).lerp(rock, clamp(t * 1.6, 0, 1) * (1 - haze * 0.55));
          c.lerp(snow, clamp((t - 0.45) / 0.45, 0, 1) * 0.92);
          c.multiplyScalar(lit);
          c.lerp(fog, haze * 0.6 * (1 - t * 0.4));
          pos.push(x, y, z); col.push(c.r, c.g, c.b);
        }
      }
      for (let i = 0; i < n; i++) for (let k = 0; k < 3; k++) { const a = i * 4 + k, b = a + 4; idx.push(a, b, a + 1, a + 1, b, b + 1); }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx);
      const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, fog: false }));
      m.renderOrder = -10 + layer; m.frustumCulled = false; mountains.add(m);
    }
  };

  // ---- particles: falling snow (camera box) and the rider's spray (world space)
  const partMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { scale: { value: 600 }, tex: { value: glowTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0)') } },
    vertexShader: 'attribute float size; attribute float alpha; varying float vA; uniform float scale; void main(){ vA = alpha; vec4 mv = modelViewMatrix*vec4(position,1.0); gl_PointSize = size*scale/max(0.5,-mv.z); gl_Position = projectionMatrix*mv; }',
    fragmentShader: 'varying float vA; uniform sampler2D tex; void main(){ vec4 t = texture2D(tex, gl_PointCoord); gl_FragColor = vec4(vec3(0.97,0.99,1.0), t.a*vA); }',
  });
  const mkPoints = (n) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3)); g.setAttribute('size', new THREE.BufferAttribute(new Float32Array(n), 1)); g.setAttribute('alpha', new THREE.BufferAttribute(new Float32Array(n), 1));
    const p = new THREE.Points(g, partMat); p.frustumCulled = false; p.renderOrder = 6; scene.add(p); return p;
  };
  const NSNOW = quality === 'low' ? 120 : 260, NSPRAY = 90;
  const snow = mkPoints(NSNOW), spray = mkPoints(NSPRAY);
  const snowSeed = Array.from({ length: NSNOW }, (_, i) => [hash(i * 3 + 1), hash(i * 3 + 2), hash(i * 3 + 3)]);
  const sp = Array.from({ length: NSPRAY }, () => ({ x: 0, y: -999, z: 0, vx: 0, vy: 0, vz: 0, life: 9, max: 1, size: 1 }));
  let spHead = 0;

  // ---- per-track scenery
  const trackGroups = new Map();
  let curGroup = null, rutGroup = null, rutKey = null;

  function buildTrackGroup(T) {
    const G = new THREE.Group(); G.name = `track-${T.id}`;
    const N = T.N, pal = T.pal;
    const cFloor = pal.floor, cWall = pal.wall, cWallDark = pal.wallDark, cSnow = pal.snow, cFog = pal.fog;
    const rimC = hexRgb(pal.rim), rimAlt = mix3(rimC, [255, 255, 255], 0.62);
    const CH = 36;                                     // samples per chunk (72 m): frustum culling and instancing groups
    const P = (i, nu, h) => {
      const psi = T.psi[i], tl = tiltOf(T, i);
      return [T.px[i] + Math.cos(psi) * nu, T.H[i] - tl * (nu / HW) + h, -(T.py[i] - Math.sin(psi) * nu)];
    };
    const trees = [];
    for (let c0 = 0; c0 < N; c0 += CH) {
      const c1 = Math.min(N, c0 + CH);
      const mi = new Mesher(), mw = new Mesher(), mr = new Mesher(), ms = new Mesher();
      const rowsI = [], rowsW = [[], []], rowsR = [[], []], rowsS = [[], []];
      for (let i = c0; i <= c1; i++) {
        const s = i * SEG, ii = Math.min(i, N - 1), bank = T.bank[ii], kk = T.k[ii];
        const band = (i % 6 < 3) ? 1 : 0.972;
        const fl = [];
        for (const [nu, sh] of [[-HW, 0.84], [-HW * 0.5, 0.94], [0, 1.0], [HW * 0.5, 0.94], [HW, 0.86]]) {
          const c = mix3(cFloor, [120, 170, 220], 0.32);
          fl.push({ p: P(i, nu, 0), c: srgb(c, band * sh * 0.78), uv: [(nu / HW + 1) / 2, s / 7] });
        }
        rowsI.push(fl);
        for (const side of [-1, 1]) {
          const si = side < 0 ? 0 : 1;
          const outer = side < 0 ? bank > 0 : bank < 0;
          const hh = WALL_H + (outer ? Math.min(1.1, Math.abs(bank) * 1.1) : 0);
          const innerSide = Math.sign(kk) === side;
          const R = Math.max(1, 1 / Math.max(1e-4, Math.abs(kk)) - HW);
          const f = innerSide ? clamp(0.8 * R / 44, 0.25, 1) : 1;          // lateral compression on the inside of tight bends
          const edgeY = T.H[i] - tiltOf(T, i) * side;
          const place = (off, h) => { const nu = side * (HW + off * (off > 0.7 ? f : 1)); const p = P(i, nu, 0); p[1] = edgeY + h; return p; };
          const shade = (side < 0 ? 1.0 : 0.88) * (outer ? 0.94 : 1) * band;
          rowsW[si].push([[0, 0, 0.62], [0.08, hh * 0.45, 0.88], [0.17, hh, 1.0]].map(([off, h, t]) => ({ p: place(off, h), c: srgb(mix3(cWallDark, mix3(cWall, cWallDark, 0.3), t), shade * 0.92), uv: [s / 5, h / 2.2] })));
          const rc = (i % 10) < 5 ? rimC : rimAlt;
          rowsR[si].push([[0.17, hh], [0.3, hh + 0.09], [0.62, hh + 0.04]].map(([off, h], q) => ({ p: place(off, h), c: srgb(rc, band * (q === 1 ? 1.08 : 0.96)), uv: [0, 0] })));
          const srow = [];
          SHOULDER.forEach(([off, h], q) => {
            const nz = (Math.sin(s * 0.043 + off * 0.31 + side) * 0.5 + Math.sin(s * 0.097 - off * 0.17) * 0.3) * Math.min(1.1, 0.12 + off * 0.045);
            const p = place(off, hh + h + nz);
            const c = mix3(cSnow, cFog, clamp(off / 70, 0, 0.5));
            srow.push({ p, c: srgb(c, 0.97 + 0.03 * band), uv: [p[0] / 5.5, p[2] / 5.5] });
            if ((q === 3 || q === 5) && i < c1) {
              const hsh = hash(i * 31 + q * 7 + side * 5 + T.id.length);
              if (hsh < (q === 3 ? 0.2 : 0.28)) {
                trees.push({ chunk: Math.floor(c0 / CH), x: p[0] + (hash(i + 9) - 0.5) * 3, y: p[1] - 0.1, z: p[2] + (hash(i + 19) - 0.5) * 3, s: 0.5 + hash(i * 17 + q) * 0.7, r: hash(i * 5 + q) * 6.28, t: hash(i * 3) });
              }
            }
          });
          rowsS[si].push(srow);
        }
      }
      mi.grid(rowsI);
      for (const si of [0, 1]) { mw.grid(rowsW[si]); mr.grid(rowsR[si]); ms.grid(rowsS[si]); }
      const add = (m, mat, name) => {
        const g = m.geometry(); if (!g) return;
        const o = new THREE.Mesh(g, mat); o.name = name; o.receiveShadow = true; G.add(o);
      };
      add(mi, mIce, 'ice'); add(mw, mWall, 'wall'); add(mr, mRim, 'rim'); add(ms, mSnow, 'snow');
    }
    // pines: one instanced mesh per chunk
    const byChunk = new Map();
    for (const t of trees) { if (!byChunk.has(t.chunk)) byChunk.set(t.chunk, []); byChunk.get(t.chunk).push(t); }
    const m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), sc = new Vector3(), ps = new Vector3(), up = new Vector3(0, 1, 0);
    const treeBase = srgb(pal.tree, 1);
    for (const [, list] of byChunk) {
      const im = new THREE.InstancedMesh(pineGeo, mPine, list.length);
      list.forEach((t, k) => {
        q4.setFromAxisAngle(up, t.r); sc.set(t.s * (0.85 + t.t * 0.3), t.s * (0.9 + t.t * 0.4), t.s * (0.85 + t.t * 0.3)); ps.set(t.x, t.y, t.z);
        m4.compose(ps, q4, sc); im.setMatrixAt(k, m4);
        const tone = 0.78 + 0.4 * t.t; im.setColorAt(k, new Color(tone * (0.8 + treeBase.r * 0.6), tone * (0.9 + treeBase.g * 0.5), tone));
      });
      im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
      im.computeBoundingSphere(); G.add(im);
    }
    // racing line ribbons (shown only while thinking / watching)
    const line = new THREE.Group(); line.name = 'line'; line.visible = false;
    {
      const mk = (hw, hgt, color, op) => {
        const m = new Mesher(), rows = [];
        for (let i = 0; i < N; i++) { const nu = nrefAt(T, i * SEG); rows.push([-1, 1].map((sd) => ({ p: P(i, nu + sd * hw, hgt), c: new Color(1, 1, 1), uv: [0, 0] }))); }
        m.grid(rows);
        const o = new THREE.Mesh(m.geometry(), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, side: THREE.DoubleSide }));
        o.renderOrder = 3; o.frustumCulled = false; return o;
      };
      line.add(mk(0.5, 0.035, 0xffe9a0, 0.28)); line.add(mk(0.15, 0.045, 0xffe27a, 0.95));
      G.add(line);
    }
    G.userData.line = line; G.userData.T = T; G.userData.P = P;
    return G;
  }

  // decoration that depends on the game's own lists (lines, signs): built once per track
  function decorate(G, V) {
    if (G.userData.decorated) return;
    G.userData.decorated = true;
    const T = G.userData.T, P = G.userData.P, deco = new THREE.Group(); G.add(deco);
    const idxOf = (s) => clamp(Math.round(s / SEG), 0, T.N - 2);
    const post = new THREE.MeshStandardMaterial({ color: 0xe8eef4, roughness: 0.35, metalness: 0.4 });
    for (const Lr of V.lines || []) {
      const i = idxOf(Lr.s), i2 = i + 1;
      const cells = 8, mk = new Mesher(), rows = [];
      for (let q = 0; q <= cells; q++) {
        const nu = -HW + (2 * HW * q) / cells;
        rows.push([{ p: P(i, nu, 0.02), c: new Color(1, 1, 1), uv: [q / cells, 0] }, { p: P(i2, nu, 0.02), c: new Color(1, 1, 1), uv: [q / cells, 1] }]);
      }
      mk.grid(rows);
      const cvv = cv(256, 64), g = cvv.getContext('2d');
      for (let q = 0; q < 8; q++) for (let r = 0; r < 2; r++) { g.fillStyle = (q + r) % 2 ? '#0f1b2a' : '#ffffff'; g.fillRect(q * 32, r * 32, 32, 32); }
      const t = tex(cvv, { rep: false, aniso: 4 }); t.magFilter = THREE.NearestFilter;
      const o = new THREE.Mesh(mk.geometry(), new THREE.MeshStandardMaterial({ map: t, roughness: 0.3, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3, side: THREE.DoubleSide }));
      o.receiveShadow = true; deco.add(o);
      // gate posts and the banner across the chute (start gate / finish arch)
      const psi = T.psi[i], bank = T.bank[i], tl = tiltOf(T, i);
      const grp = new THREE.Group(); grp.position.set(T.px[i], T.H[i], -T.py[i]); grp.rotation.y = -psi; deco.add(grp);
      const hh = (side) => WALL_H + ((side < 0 ? bank > 0 : bank < 0) ? Math.min(1.1, Math.abs(bank) * 1.1) : 0);
      const top = Lr.arch ? 4.6 : 6.6;
      for (const side of [-1, 1]) {
        const pm = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, top, 10), post);
        pm.position.set(side * (HW + 0.45), -tl * side + hh(side) * 0.9 + top / 2, 0); pm.castShadow = true; grp.add(pm);
      }
      const label = Lr.label || '';
      const bt = labelTexture((gx, w, h) => {
        const gr = gx.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#ef5a40'); gr.addColorStop(1, '#a8281a'); gx.fillStyle = gr; gx.fillRect(0, 0, w, h);
        gx.fillStyle = 'rgba(255,255,255,0.14)'; gx.fillRect(0, 0, w, h * 0.12);
        gx.fillStyle = '#ffffff'; gx.font = `900 ${Math.round(h * 0.56)}px system-ui, sans-serif`; gx.textAlign = 'center'; gx.textBaseline = 'middle'; gx.fillText(label, w / 2, h * 0.54);
      }, 512, 128);
      const bw = 2 * (HW + 0.45), bh = Lr.arch ? 1.2 : 0.9;
      const yb = (hh(-1) + hh(1)) / 2 * 0.9 + top - bh / 2 - 0.1;
      const banner = new THREE.Mesh(new THREE.PlaneGeometry(bw, bh), new THREE.MeshStandardMaterial({ map: bt, roughness: 0.55, side: THREE.DoubleSide }));
      banner.position.set(0, yb, 0); banner.castShadow = true; grp.add(banner);
      const beam = new THREE.Mesh(new THREE.BoxGeometry(bw, 0.14, 0.2), post); beam.position.set(0, yb + bh / 2 + 0.07, 0); grp.add(beam);
    }
    for (const sg of V.signs || []) {
      const i = idxOf(sg.s), psi = T.psi[i], bank = T.bank[i], side = sg.dir;
      const outer = side < 0 ? bank > 0 : bank < 0;
      const hh = WALL_H + (outer ? Math.min(1.1, Math.abs(bank) * 1.1) : 0);
      const grp = new THREE.Group();
      const pos = P(i, side * (HW + 1.6), 0);
      grp.position.set(pos[0], T.H[i] - tiltOf(T, i) * side + hh - 0.5, pos[2]); grp.rotation.y = -psi; deco.add(grp);
      const tx = labelTexture((gx, w, h) => {
        gx.fillStyle = '#f2f5f9'; gx.fillRect(0, 0, w, h);
        gx.strokeStyle = '#d63f2c'; gx.lineWidth = 16; gx.strokeRect(10, 10, w - 20, h - 20);
        gx.fillStyle = '#14243a'; gx.font = '900 112px system-ui, sans-serif'; gx.textAlign = 'center'; gx.textBaseline = 'middle'; gx.fillText(String(sg.n), w * 0.4, h * 0.54);
        gx.fillStyle = '#d63f2c'; gx.beginPath();
        const ax = w * 0.78, ay = h * 0.54, s = 42 * sg.dir; gx.moveTo(ax - s, ay - 52); gx.lineTo(ax + s, ay); gx.lineTo(ax - s, ay + 52); gx.closePath(); gx.fill();
      }, 256, 256);
      const board = new THREE.Mesh(new THREE.PlaneGeometry(1.25, 1.25), new THREE.MeshStandardMaterial({ map: tx, roughness: 0.5 }));
      board.position.set(0, 2.15, 0.05); board.castShadow = true; grp.add(board);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 2.6, 8), new THREE.MeshStandardMaterial({ color: 0x4a5565, roughness: 0.5, metalness: 0.4 }));
      pole.position.set(0, 1.3, 0); grp.add(pole);
    }
  }

  function ensureTrack(V) {
    const T = V.T;
    let G = trackGroups.get(T.id);
    if (!G) {
      G = buildTrackGroup(T);
      trackGroups.set(T.id, G);
      if (trackGroups.size > 2) for (const [id, g] of trackGroups) if (id !== T.id && g !== curGroup) { scene.remove(g); g.traverse((o) => { if (o.geometry && o.geometry !== pineGeo) o.geometry.dispose(); }); trackGroups.delete(id); break; }
    }
    if (curGroup !== G) {
      if (curGroup) scene.remove(curGroup);
      if (rutGroup && rutGroup.parent) rutGroup.parent.remove(rutGroup);
      rutGroup = null; rutKey = null;
      scene.add(G); curGroup = G;
      paintDome(T.pal); buildMountains(T.pal, T.id.length + T.id.charCodeAt(0));
      const fc = srgb(T.pal.fog);
      scene.fog = new THREE.Fog(fc, 70, 430);
      scene.background = fc;
      L.hemi.color.copy(srgb(mix3(hexRgb(T.pal.sky1), [255, 255, 255], 0.35)));
      L.hemi.groundColor.copy(srgb(mix3(T.pal.snow, T.pal.fog, 0.3)));
    }
    if (!V.noDecor) decorate(G, V);
    return G;
  }

  // ice ruts: dark patches with a glint; the list is replaced for each run, a patch hides when its rut is spent
  function syncRuts(G, V) {
    const key = V.ruts || null;
    if (key !== rutKey) {
      if (rutGroup) { G.remove(rutGroup); rutGroup.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); rutGroup = null; }
      rutKey = key;
      if (key) {
        rutGroup = new THREE.Group(); G.add(rutGroup);
        const T = V.T, P = G.userData.P;
        key.forEach((r) => {
          const i = clamp(Math.round(r.s / SEG), 1, T.N - 3), m = new Mesher(), rows = [];
          for (let d = -1; d <= 2; d++) rows.push([-0.95, 0.95].map((sd) => ({ p: P(i + d, r.n + sd, 0.025), c: new Color(1, 1, 1), uv: [0, 0] })));
          m.grid(rows);
          const patch = new THREE.Mesh(m.geometry(), new THREE.MeshBasicMaterial({ color: 0x3f6f9c, transparent: true, opacity: 0.3, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, side: THREE.DoubleSide }));
          patch.renderOrder = 2;
          const gm = new Mesher(), rows2 = [];
          for (let d = -1; d <= 2; d++) rows2.push([r.n + 0.2, r.n + 0.26].map((nu) => ({ p: P(i + d, nu, 0.035), c: new Color(1, 1, 1), uv: [0, 0] })));
          gm.grid(rows2);
          const glint = new THREE.Mesh(gm.geometry(), new THREE.MeshBasicMaterial({ color: 0xeaf6ff, transparent: true, opacity: 0.5, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3, side: THREE.DoubleSide }));
          glint.renderOrder = 2;
          const g = new THREE.Group(); g.add(patch, glint); g.userData.rut = r; rutGroup.add(g);
        });
      }
    }
    if (rutGroup) for (const g of rutGroup.children) g.visible = !g.userData.rut.done;
  }

  // ---- the rider, loaded last (shares this stage)
  api.luger = await createLuger({ quality, base, stage });
  if (api.luger) {
    api.luger.rig.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
    api.luger.ghostRig.traverse((o) => { if (o.isMesh) o.castShadow = false; });
  }
  await tick();

  // soft contact shadow under the sled (always on; the real shadow map adds the crisp one where enabled)
  const blob = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: glowTexture('rgba(10,30,60,0.55)', 'rgba(10,30,60,0)'), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }));
  blob.renderOrder = 4; scene.add(blob);

  /** Build the track's scene and precompile shaders so the first real frame doesn't hitch. */
  api.prepare = async (V) => {
    try { ensureTrack({ ...V, noDecor: true }); } catch (e) { console.warn('world3d track build failed', e); return false; }
    await tick();
    try { if (renderer.compileAsync) await renderer.compileAsync(scene, camera); else renderer.compile(scene, camera); } catch (e) { /* ignore */ }
    return true;
  };

  // ---- one frame ---------------------------------------------------------------------------------------------------------------
  const v1 = new Vector3(), v2 = new Vector3();
  let lastWall = 0;
  const cost = { ema: 0, n: 0, low: false };
  const camState = { nc: 0, roll: 0 };
  const sm = { yaw: NaN, roll: NaN, vy: 0, vr: 0 };

  /** Renders the scene for V into the 2D context (virtual units SW x H). Returns the sled's screen output or null on failure. */
  api.draw = function (ctx, SW, H, V, alpha = 1) {
    if (api.lost || stage.contextLost || !api.luger) return null;
    const t0 = nowMs();
    const T = V.T;
    const G = ensureTrack(V);
    G.userData.line.visible = !!V.line;
    if (scene.fog) { scene.fog.near = V.fogNear || 70; scene.fog.far = V.fogFar || 430; }
    syncRuts(G, V);
    const cam = V.cam || camState;
    // ---- camera: the 2D chute's camera, in real coordinates
    const CAM_BACK = V.camBack || 5.0;
    const F = Math.min(SW, H) * 1.06 * (1 + 0.04 * clamp(V.v / 36, 0, 1.2));
    const land = SW > H;
    const hy = H * (V.hyFrac || (land ? 0.38 : 0.34));
    const CAM_H = V.hyFrac ? (V.sledFrac * H - hy) * CAM_BACK / F : clamp((0.66 * H - hy) * CAM_BACK / F, 1.1, 3.0);
    const cx = SW / 2;
    const sc = Math.max(1, V.s - CAM_BACK);
    const psiC = at(T.psi, sc), bankS = at(T.bank, V.s);
    if (V.fixedCam) { cam.nc = V.cam.nc; cam.roll = V.cam.roll; } else { cam.nc += (V.n * 0.5 - cam.nc) * 0.12; cam.roll += (bankS * 0.42 - (V.u || 0) * 0.04 - cam.roll) * 0.1; }
    const gC = at(T.g, sc);
    const tl = clamp(HW * Math.tan(at(T.bank, sc)) * 0.55, -2.3, 2.3);
    const camX = at(T.px, sc) + Math.cos(psiC) * cam.nc, camZ = at(T.py, sc) - Math.sin(psiC) * cam.nc;
    const camY = at(T.H, sc) + CAM_H - tl * (cam.nc / HW);
    const shakeX = V.shake ? Math.sin(V.t * 71) * V.shake * 9 : 0, shakeY = V.shake ? Math.cos(V.t * 83) * V.shake * 6 : 0;
    camera.position.set(camX, camY, -camZ);
    camera.rotation.order = 'YXZ';
    camera.rotation.set(-Math.atan(gC), -psiC, -cam.roll);
    camera.updateMatrixWorld(true);
    // backing size
    const m = ctx.getTransform(), ppu = Math.hypot(m.a, m.b) || 1;
    const maxPx = quality === 'low' ? 720 : quality === 'high' ? 1500 : 1180;
    let k = Math.min(1, maxPx / (Math.max(SW, H) * ppu));
    if (api.slow) k = Math.min(k, 0.7);
    const pw = Math.max(64, Math.round(SW * ppu * k)), ph = Math.max(64, Math.round(H * ppu * k));
    if (api.W !== pw || api.H !== ph) { renderer.setPixelRatio(1); renderer.setSize(pw, ph, false); api.W = pw; api.H = ph; partMat.uniforms.scale.value = ph * 0.9; }
    // projection: focal F, principal point (cx, hy) moved so that rolling happens about the lower screen where the sled is
    const Py = H * 0.72, a = -cam.roll, dx = 0, dy = Py - hy;
    const qx = cx - (dx * Math.cos(a) - dy * Math.sin(a)) + shakeX, qy = Py - (dx * Math.sin(a) + dy * Math.cos(a)) + shakeY;
    const e = camera.projectionMatrix.elements, near = camera.near, far = camera.far;
    camera.aspect = SW / H;
    e[0] = 2 * F / SW; e[5] = 2 * F / H; e[8] = -(2 * qx / SW - 1); e[9] = -(1 - 2 * qy / H);
    e[10] = -(far + near) / (far - near); e[14] = -2 * far * near / (far - near); e[11] = -1; e[15] = 0; e[1] = e[2] = e[3] = e[4] = e[6] = e[7] = e[12] = e[13] = 0;
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
    // ---- sled and ghost
    const sledAt = (s, n) => {
      const psi = at(T.psi, s), tlt = clamp(HW * Math.tan(at(T.bank, s)) * 0.55, -2.3, 2.3);
      const x = at(T.px, s) + Math.cos(psi) * n, zPlan = at(T.py, s) - Math.sin(psi) * n, y = at(T.H, s) - tlt * (n / HW);
      return { x, y, zPlan, psi, tilt: tlt, pitch: Math.atan2(at(T.H, s + 1) - at(T.H, s - 1), 2) };
    };
    const VIS = 1.3;
    const S = sledAt(V.s, V.n);
    // the sled's slip angle and lean-roll are sim values that can step: damped springs keep the picture smooth
    const dts = lastWall ? clamp((nowMs() - lastWall) / 1000, 0.001, 0.05) : 0.016;
    const yawT = Math.atan2(V.vn || 0, Math.max(3, V.v)), rollT = (V.u || 0) * 0.1;
    if (!isFinite(sm.yaw)) { sm.yaw = yawT; sm.roll = rollT; sm.vy = sm.vr = 0; }
    for (let q = 0; q < 3; q++) {
      const h = dts / 3, w = 9;
      sm.vy += (w * w * (yawT - sm.yaw) - 2 * w * sm.vy) * h; sm.yaw += sm.vy * h;
      sm.vr += (w * w * (rollT - sm.roll) - 2 * w * sm.vr) * h; sm.roll += sm.vr * h;
    }
    const yaw = sm.yaw;
    const roll = Math.atan2(S.tilt, HW) * 0.9 * 0.75 + sm.roll;
    const lg = api.luger;
    lg.placeRig({ ghost: false, X: S.x, Y: S.y, Z: S.zPlan, heading: S.psi + yaw * 0.6 + (V.sledYaw || 0), pitch: S.pitch, roll, scale: VIS, rider: V.rider, t: V.t });
    if (V.ghost) {
      const Gs = sledAt(V.ghost.s, V.ghost.n);
      lg.placeRig({ ghost: true, X: Gs.x, Y: Gs.y, Z: Gs.zPlan, heading: Gs.psi, pitch: Gs.pitch, roll: Math.atan2(Gs.tilt, HW) * 0.7, scale: VIS, t: V.t });
    } else lg.ghostRig.visible = false;
    blob.position.set(S.x, S.y + 0.03, -S.zPlan);
    blob.rotation.order = 'YXZ'; blob.rotation.set(-Math.PI / 2 + S.pitch * 0.5, -(S.psi + yaw * 0.6), 0);
    blob.scale.set(1.9 * VIS, 3.1 * VIS, 1);
    stage.setShadowTarget(S.x, S.y, -S.zPlan);
    // ---- backdrop and particles
    backdrop.position.set(camX, camY - 30, -camZ);
    const dtw = lastWall ? clamp((nowMs() - lastWall) / 1000, 0, 0.1) : 0.016; lastWall = nowMs();
    const spd = V.v || 0;
    {
      const pa = snow.geometry.attributes.position, sa = snow.geometry.attributes.size, aa = snow.geometry.attributes.alpha;
      const tt = V.t;
      for (let q = 0; q < NSNOW; q++) {
        const r = snowSeed[q];
        const w = (tt * (0.5 + r[0] * 0.6) * 0.5 + r[1]) % 1, depth = 3 + r[2] * 40;
        v1.set((r[0] * 2 - 1) * depth * 0.7 + Math.sin(tt * 0.7 + q) * 0.4, (0.8 - w * 1.6) * depth * 0.45 + 1.0, -depth).applyMatrix4(camera.matrixWorld);
        pa.setXYZ(q, v1.x, v1.y, v1.z); sa.setX(q, 0.035 + r[1] * 0.04); aa.setX(q, 0.35 + 0.5 * (1 - depth / 43));
      }
      pa.needsUpdate = sa.needsUpdate = aa.needsUpdate = true;
    }
    {
      const emit = (n, kick) => {
        for (let q = 0; q < n; q++) {
          const p = sp[spHead = (spHead + 1) % NSPRAY];
          const side = (hash(spHead * 7 + Math.floor(V.t * 60)) < 0.5 ? -1 : 1);
          const fx = Math.sin(S.psi), fz = -Math.cos(S.psi), rx = Math.cos(S.psi), rz = Math.sin(S.psi);
          p.x = S.x - fx * 1.4 * VIS + rx * side * 0.25; p.y = S.y + 0.08; p.z = -S.zPlan - fz * 1.4 * VIS + rz * side * 0.25;
          const r1 = hash(spHead * 13 + 1), r2 = hash(spHead * 17 + 2);
          p.vx = -fx * (1 + r1 * 2) + rx * side * (0.8 + r2 * 1.4) * kick; p.vz = -fz * (1 + r1 * 2) + rz * side * (0.8 + r2 * 1.4) * kick; p.vy = 0.7 + r2 * 1.6 * kick;
          p.life = 0; p.max = 0.45 + r1 * 0.5; p.size = 0.12 + r2 * 0.14;
        }
      };
      if (V.rider && V.rider.ph !== 'ready' && spd > 6) emit(Math.min(3, Math.round(spd / 14)), 1);
      if (V.hitFlag) emit(4, 2.4);
      const pa = spray.geometry.attributes.position, sa = spray.geometry.attributes.size, aa = spray.geometry.attributes.alpha;
      for (let q = 0; q < NSPRAY; q++) {
        const p = sp[q];
        p.life += dtw;
        if (p.life >= p.max) { pa.setXYZ(q, 0, -9999, 0); aa.setX(q, 0); continue; }
        p.x += p.vx * dtw; p.y += p.vy * dtw; p.z += p.vz * dtw; p.vy -= 3.2 * dtw;
        const f = p.life / p.max;
        pa.setXYZ(q, p.x, p.y, p.z); sa.setX(q, p.size * (1 + f * 1.8)); aa.setX(q, 0.7 * (1 - f));
      }
      pa.needsUpdate = sa.needsUpdate = aa.needsUpdate = true;
    }
    // ---- render
    renderer.render(scene, camera);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.drawImage(renderer.domElement, 0, 0, SW, H);
    ctx.restore();
    // screen output for the HUD: where the sled's floor point lands and its scale (same meaning as the 2D picture's)
    v2.set(S.x, S.y, -S.zPlan).applyMatrix4(camera.matrixWorldInverse);
    const depth = Math.max(0.3, -v2.z);
    v1.set(S.x, S.y, -S.zPlan).project(camera);
    const out = { x: (v1.x * 0.5 + 0.5) * SW, y: (0.5 - v1.y * 0.5) * H, k: F / depth };
    V.out = out;
    // frame cost guard: drop shadows and resolution once if the 3D picture stays expensive
    const ms = nowMs() - t0;
    cost.ema = cost.n ? cost.ema * 0.95 + ms * 0.05 : ms; cost.n++;
    if (!cost.low && cost.n > 120 && cost.ema > 12) {
      cost.low = true; api.slow = true;
      if (renderer.shadowMap.enabled) { renderer.shadowMap.enabled = false; L.key.castShadow = false; scene.traverse((o) => { if (o.material) for (const mm of [].concat(o.material)) mm.needsUpdate = true; }); }
    }
    return out;
  };

  api.ready = true;
  api.readyAt = nowMs();
  api.fade = () => clamp((nowMs() - api.readyAt) / 450, 0, 1);
  return api;
}
