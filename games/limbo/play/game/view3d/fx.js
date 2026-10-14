// Small procedural textures and particle pools for the limbo beach (presentation only; nothing here touches the simulation).
import * as THREE from '../vendor3d/three.js';

const cv = (w, h = w) => { const c = globalThis.document.createElement('canvas'); c.width = w; c.height = h; return c; };
export const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (t) => t * t * (3 - 2 * t);
export function rngOf(seed) { let a = (seed >>> 0) || 1; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const tex = (c, { srgb = true, repeat = null, aniso = 4 } = {}) => {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  t.anisotropy = aniso; return t;
};

// soft round glow (white; tint with the material colour)
export function glowTexture(size = 128, hard = 0.0) {
  const c = cv(size), g = c.getContext('2d');
  const r = g.createRadialGradient(size / 2, size / 2, size * hard * 0.5, size / 2, size / 2, size / 2);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.35, 'rgba(255,255,255,0.45)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, size, size);
  return tex(c);
}

// a flame: teardrop with a white-yellow core fading to orange and transparent red tips. Drawn once; sprites animate it.
export function flameTexture(seed = 3) {
  const W = 96, H = 192, c = cv(W, H), g = c.getContext('2d');
  const R = rngOf(seed);
  const layer = (sx, col0, col1, alpha) => {
    const grd = g.createLinearGradient(0, H, 0, 0);
    grd.addColorStop(0, col0); grd.addColorStop(0.55, col1); grd.addColorStop(1, 'rgba(255,60,0,0)');
    g.fillStyle = grd; g.globalAlpha = alpha;
    g.beginPath(); g.moveTo(W / 2, 4);
    g.bezierCurveTo(W / 2 + 6 * sx, H * 0.28, W * 0.92 * (0.5 + 0.5 * sx), H * 0.5, W * 0.76 * (0.5 + 0.5 * sx) + W * 0.1, H * 0.78);
    g.bezierCurveTo(W * 0.66, H * 0.98, W * 0.34, H * 0.98, W * 0.24 + W * 0.1 * (1 - sx), H * 0.78);
    g.bezierCurveTo(W * 0.08 * (1 + (1 - sx)), H * 0.5, W / 2 - 6 * sx, H * 0.28, W / 2, 4);
    g.fill();
  };
  g.filter = 'blur(2px)';
  layer(1, 'rgba(255,90,20,0.0)', 'rgba(255,140,40,0.85)', 0.9);
  layer(0.8, 'rgba(255,170,50,0.2)', 'rgba(255,200,80,0.95)', 0.95);
  layer(0.5, 'rgba(255,240,170,0.4)', 'rgba(255,255,230,1)', 1);
  g.filter = 'none'; g.globalAlpha = 1;
  void R;
  return tex(c);
}

// sand: warm grains, soft ripple lines (as colour and as bump)
export function sandTextures(seed = 5) {
  const S = 512, c = cv(S), g = c.getContext('2d'), b = cv(S), bg = b.getContext('2d');
  const R = rngOf(seed);
  g.fillStyle = '#e6c08a'; g.fillRect(0, 0, S, S);
  bg.fillStyle = '#808080'; bg.fillRect(0, 0, S, S);
  const img = g.getImageData(0, 0, S, S), d = img.data;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const i = (y * S + x) * 4;
    const rip = Math.sin((y + Math.sin(x * 0.045) * 9 + Math.sin(x * 0.013) * 22) * 0.09) * 0.5 + 0.5;
    const n = (R() - 0.5) * 26 + (rip - 0.5) * 16;
    d[i] = clamp(d[i] + n, 0, 255); d[i + 1] = clamp(d[i + 1] + n * 0.95, 0, 255); d[i + 2] = clamp(d[i + 2] + n * 0.85, 0, 255);
  }
  g.putImageData(img, 0, 0);
  const bi = bg.getImageData(0, 0, S, S), bd = bi.data;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const i = (y * S + x) * 4;
    const rip = Math.sin((y + Math.sin(x * 0.045) * 9 + Math.sin(x * 0.013) * 22) * 0.09) * 0.5 + 0.5;
    const v = 128 + (rip - 0.5) * 70 + (R() - 0.5) * 40;
    bd[i] = bd[i + 1] = bd[i + 2] = clamp(v, 0, 255); bd[i + 3] = 255;
  }
  bg.putImageData(bi, 0, 0);
  const map = tex(c, { repeat: [14, 10], aniso: 8 });
  const bump = tex(b, { srgb: false, repeat: [14, 10], aniso: 8 });
  return { map, bump };
}

// a palm frond: central rib and fine leaflets, alpha-cut
export function frondTexture() {
  const W = 128, H = 512, c = cv(W, H), g = c.getContext('2d');
  g.clearRect(0, 0, W, H);
  const R = rngOf(11);
  for (let i = 0; i < 70; i++) {
    const t = i / 69, y = H - 8 - t * (H - 30);
    const len = (W / 2 - 4) * Math.sin(Math.PI * (0.12 + 0.88 * t) * 0.92) * (0.5 + 0.5 * (1 - t * 0.5));
    for (const s of [-1, 1]) {
      const droop = 14 + 10 * t;
      const grd = g.createLinearGradient(W / 2, y, W / 2 + s * len, y - droop);
      grd.addColorStop(0, '#2c5a1e'); grd.addColorStop(0.6, '#3f7a28'); grd.addColorStop(1, '#6fa63a');
      g.strokeStyle = grd; g.lineWidth = 3.2 - t * 1.3 + R() * 0.6; g.lineCap = 'round';
      g.beginPath(); g.moveTo(W / 2, y); g.quadraticCurveTo(W / 2 + s * len * 0.6, y - droop * 0.2, W / 2 + s * len, y - droop); g.stroke();
    }
  }
  g.strokeStyle = '#4b3a1c'; g.lineWidth = 4; g.beginPath(); g.moveTo(W / 2, H); g.lineTo(W / 2, 6); g.stroke();
  return tex(c);
}

// palm trunk bark with ring scars
export function barkTexture() {
  const W = 64, H = 256, c = cv(W, H), g = c.getContext('2d');
  g.fillStyle = '#6a5438'; g.fillRect(0, 0, W, H);
  const R = rngOf(23);
  for (let i = 0; i < 16; i++) {
    const y = i * (H / 16);
    const gr = g.createLinearGradient(0, y, 0, y + H / 16);
    gr.addColorStop(0, 'rgba(30,18,8,0.65)'); gr.addColorStop(0.18, 'rgba(30,18,8,0)'); gr.addColorStop(1, 'rgba(255,230,180,0.18)');
    g.fillStyle = gr; g.fillRect(0, y, W, H / 16);
  }
  for (let i = 0; i < 160; i++) { g.fillStyle = `rgba(${R() < 0.5 ? '20,12,4' : '150,125,90'},${0.1 + R() * 0.15})`; g.fillRect(R() * W, R() * H, 1 + R() * 2, 2 + R() * 6); }
  return tex(c, { repeat: [1, 1] });
}

// bamboo: pale gold with darker nodes (u along the circumference, v along the length: nodes are rings)
export function bambooTexture(nodes = 5) {
  const W = 64, H = 256, c = cv(W, H), g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, W, 0);
  gr.addColorStop(0, '#b98a35'); gr.addColorStop(0.4, '#f0cf78'); gr.addColorStop(0.7, '#e2b958'); gr.addColorStop(1, '#a8782c');
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  const R = rngOf(31);
  for (let i = 0; i < 120; i++) { g.fillStyle = `rgba(90,56,10,${0.05 + R() * 0.12})`; g.fillRect(R() * W, R() * H, 1, 8 + R() * 30); }
  for (let n = 0; n <= nodes; n++) {
    const y = (n / nodes) * H;
    g.fillStyle = 'rgba(70,40,6,0.7)'; g.fillRect(0, y - 3, W, 6);
    g.fillStyle = 'rgba(255,240,170,0.35)'; g.fillRect(0, y + 3, W, 2);
  }
  return tex(c, { repeat: [1, 1] });
}

// woven batik / stripe cloth for the wrap, headband and sash (white-ish so the look colour tints it)
export function clothTexture() {
  const W = 128, H = 64, c = cv(W, H), g = c.getContext('2d');
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, W, H);
  g.fillStyle = 'rgba(0,0,0,0.12)';
  for (let i = 0; i < 8; i++) g.fillRect(i * (W / 8), 0, 3, H);
  g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(0, H - 12, W, 6); g.fillRect(0, 6, W, 3);
  g.fillStyle = 'rgba(255,255,255,0.7)';
  for (let i = 0; i < 8; i++) { g.beginPath(); g.moveTo(i * (W / 8) + 8, 22); g.lineTo(i * (W / 8) + 14, 36); g.lineTo(i * (W / 8) + 2, 36); g.fill(); }
  return tex(c);
}

// ------------------------------------------------------------------------------------------------ particle pool
// One THREE.Points object with per-particle size / colour / alpha, all integrated on the CPU (pool of fixed size).
const PV = `
attribute float aSize; attribute vec4 aCol;
varying vec4 vCol;
uniform float uScale;
void main(){ vCol = aCol; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = aSize * uScale / max(0.1, -mv.z); gl_Position = projectionMatrix * mv; }`;
const PF = `
uniform sampler2D uMap; varying vec4 vCol;
void main(){ vec4 t = texture2D(uMap, gl_PointCoord); gl_FragColor = vec4(vCol.rgb, vCol.a * t.a * t.r); if (gl_FragColor.a < 0.003) discard; }`;

export class Particles {
  constructor(n, { additive = false, map, scale = 600, gravity = -1.5, drag = 0.6 } = {}) {
    this.n = n; this.gravity = gravity; this.drag = drag;
    this.pos = new Float32Array(n * 3); this.vel = new Float32Array(n * 3);
    this.life = new Float32Array(n); this.max = new Float32Array(n);
    this.size0 = new Float32Array(n); this.size1 = new Float32Array(n);
    this.col = new Float32Array(n * 3); this.a0 = new Float32Array(n);
    this.grow = new Float32Array(n);
    this.aSize = new Float32Array(n); this.aCol = new Float32Array(n * 4);
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.geo.setAttribute('aSize', new THREE.BufferAttribute(this.aSize, 1));
    this.geo.setAttribute('aCol', new THREE.BufferAttribute(this.aCol, 4));
    this.mat = new THREE.ShaderMaterial({
      vertexShader: PV, fragmentShader: PF, transparent: true, depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      uniforms: { uMap: { value: map }, uScale: { value: scale } },
    });
    this.points = new THREE.Points(this.geo, this.mat);
    this.points.frustumCulled = false; this.points.renderOrder = additive ? 20 : 12;
    this.cursor = 0;
  }
  emit(x, y, z, vx, vy, vz, life, size0, size1, r, g, b, a = 1) {
    const i = this.cursor; this.cursor = (this.cursor + 1) % this.n;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    this.life[i] = life; this.max[i] = life; this.size0[i] = size0; this.size1[i] = size1;
    this.col[i * 3] = r; this.col[i * 3 + 1] = g; this.col[i * 3 + 2] = b; this.a0[i] = a;
  }
  update(dt, wind = 0) {
    const g = this.gravity, dr = Math.exp(-this.drag * dt);
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] <= 0) { this.aCol[i * 4 + 3] = 0; this.aSize[i] = 0; continue; }
      this.life[i] -= dt;
      const k = 1 - Math.max(0, this.life[i]) / this.max[i];
      this.vel[i * 3 + 1] += g * dt; this.vel[i * 3] += wind * dt;
      this.vel[i * 3] *= dr; this.vel[i * 3 + 1] *= dr; this.vel[i * 3 + 2] *= dr;
      this.pos[i * 3] += this.vel[i * 3] * dt; this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt; this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      if (this.groundY !== undefined && this.pos[i * 3 + 1] < this.groundY) { this.pos[i * 3 + 1] = this.groundY; this.vel[i * 3 + 1] *= -0.25; this.vel[i * 3] *= 0.6; this.vel[i * 3 + 2] *= 0.6; }
      this.aSize[i] = lerp(this.size0[i], this.size1[i], k);
      const fade = Math.min(1, (1 - k) * 3) * Math.min(1, k * 12 + 0.15);
      this.aCol[i * 4] = this.col[i * 3]; this.aCol[i * 4 + 1] = this.col[i * 3 + 1]; this.aCol[i * 4 + 2] = this.col[i * 3 + 2];
      this.aCol[i * 4 + 3] = this.a0[i] * fade;
    }
    this.geo.attributes.position.needsUpdate = true; this.geo.attributes.aSize.needsUpdate = true; this.geo.attributes.aCol.needsUpdate = true;
  }
  clear() { this.life.fill(0); this.aCol.fill(0); this.aSize.fill(0); this.geo.attributes.aCol.needsUpdate = true; this.geo.attributes.aSize.needsUpdate = true; }
}
