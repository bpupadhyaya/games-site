// Shared procedural art for the 3D scene: canvas textures, deterministic noise, small mesh helpers. No state, no sim access.
import { THREE } from '../vendor3d/index.js';

export const TAU = Math.PI * 2;
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export const hash = (n) => { n = Math.imul((n | 0) ^ ((n | 0) >>> 15), 2246822507); n = Math.imul(n ^ (n >>> 13), 3266489909); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };
export const hash2 = (a, b) => hash(Math.imul(a | 0, 73856093) ^ Math.imul(b | 0, 19349663));
export const noise = (x, seed = 0) => { const i = Math.floor(x), f = x - i, a = hash(i * 374761393 + seed), b = hash((i + 1) * 374761393 + seed), s = f * f * (3 - 2 * f); return a + (b - a) * s; };
export const fbm = (x, seed = 0) => noise(x, seed) * 0.56 + noise(x * 2.07, seed + 11) * 0.3 + noise(x * 4.3, seed + 23) * 0.14;
// 2D value noise
export const noise2 = (x, y, seed = 0) => {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const h = (a, b) => hash2(a + seed * 31, b);
  return lerp(lerp(h(ix, iy), h(ix + 1, iy), sx), lerp(h(ix, iy + 1), h(ix + 1, iy + 1), sx), sy);
};
export const rngOf = (seed) => { let s = (seed >>> 0) || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; };

const hasDom = () => typeof globalThis.document !== 'undefined';
export function canvas(w, h = w) { const c = globalThis.document.createElement('canvas'); c.width = w; c.height = h; return c; }
export function tex(c, { repeat, srgb = true, aniso = 4 } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = aniso;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}
const cache = new Map();
const memo = (k, f) => { if (!cache.has(k)) cache.set(k, f()); return cache.get(k); };

/** Woven basket: diagonal bamboo strips with ribs. */
export function weaveTexture() {
  return memo('weave', () => {
    const c = canvas(256), g = c.getContext('2d'), r = rngOf(5);
    g.fillStyle = '#c99a52'; g.fillRect(0, 0, 256, 256);
    for (let k = 0; k < 2; k++) {
      for (let i = -16; i < 32; i++) {
        const o = i * 16; g.save(); g.translate(0, 0); g.beginPath();
        g.fillStyle = `rgb(${196 + r() * 40 | 0},${142 + r() * 40 | 0},${70 + r() * 30 | 0})`;
        const s = k ? 1 : -1;
        g.moveTo(o, 0); g.lineTo(o + 12, 0); g.lineTo(o + 12 + s * 256, 256); g.lineTo(o + s * 256, 256); g.closePath();
        if ((i + k) % 2) g.fill();
        g.restore();
      }
    }
    g.strokeStyle = 'rgba(60,32,8,0.55)'; g.lineWidth = 1.4;
    for (let i = -16; i < 32; i++) { g.beginPath(); g.moveTo(i * 16, 0); g.lineTo(i * 16 + 256, 256); g.stroke(); g.beginPath(); g.moveTo(i * 16, 0); g.lineTo(i * 16 - 256, 256); g.stroke(); }
    g.fillStyle = 'rgba(90,50,14,0.5)';
    for (const y of [60, 130, 200]) g.fillRect(0, y, 256, 7);   // horizontal hoops
    const t = tex(c, { repeat: [3, 1.2] }); return t;
  });
}
export function burlapTexture(base = '#d8c79a') {
  return memo('burlap' + base, () => {
    const c = canvas(128), g = c.getContext('2d'), r = rngOf(9);
    g.fillStyle = base; g.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 64; i++) { g.fillStyle = `rgba(60,40,10,${0.05 + r() * 0.08})`; g.fillRect(0, i * 2, 128, 1); g.fillRect(i * 2, 0, 1, 128); }
    return tex(c, { repeat: [2, 2] });
  });
}
export function stripeTexture(a = '#c9473a', b = '#f1c14a', c2 = '#3a5a9a') {
  return memo('stripe' + a + b + c2, () => {
    const c = canvas(128), g = c.getContext('2d');
    g.fillStyle = a; g.fillRect(0, 0, 128, 128);
    g.fillStyle = b; g.fillRect(0, 40, 128, 14); g.fillStyle = c2; g.fillRect(0, 80, 128, 10);
    for (let i = 0; i < 128; i += 2) { g.fillStyle = 'rgba(0,0,0,0.06)'; g.fillRect(i, 0, 1, 128); }
    return tex(c);
  });
}
/** Fine speckle for terrain detail (tileable). */
export function detailTexture() {
  return memo('detail', () => {
    const c = canvas(256), g = c.getContext('2d'), r = rngOf(21);
    g.fillStyle = '#9a9a9a'; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 5200; i++) { const v = 120 + r() * 100; g.fillStyle = `rgba(${v},${v},${v},0.5)`; const s = 1 + r() * 2.4; g.fillRect(r() * 256, r() * 256, s, s * (0.6 + r())); }
    for (let i = 0; i < 90; i++) { g.fillStyle = 'rgba(40,40,40,0.18)'; g.beginPath(); g.ellipse(r() * 256, r() * 256, 5 + r() * 12, 2 + r() * 5, r() * 3, 0, TAU); g.fill(); }
    return tex(c, { repeat: [1, 1], aniso: 4 });
  });
}
/** Dry-stone wall texture (courses of irregular stones). */
export function stoneTexture(base = '#9b9183') {
  return memo('stone' + base, () => {
    const c = canvas(256), g = c.getContext('2d'), r = rngOf(33);
    g.fillStyle = '#3c352c'; g.fillRect(0, 0, 256, 256);
    let y = 0;
    while (y < 256) {
      const h = 26 + r() * 20; let x = -r() * 30;
      while (x < 256) {
        const w = 32 + r() * 44, v = 0.82 + r() * 0.3;
        g.fillStyle = shadeHex(base, v); g.beginPath(); g.roundRect(x + 1.5, y + 1.5, w - 3, h - 3, 7); g.fill();
        g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(x + 4, y + 3, w - 9, 3);
        x += w;
      }
      y += h;
    }
    return tex(c, { repeat: [1, 1] });
  });
}
export function shadeHex(hex, k) {
  const c = new THREE.Color(hex); c.multiplyScalar(k); return `#${c.getHexString()}`;
}
/** Soft radial sprite texture (smoke, mist, dust, glow). */
export function softTexture(rgb = '255,255,255', a = 1) {
  return memo('soft' + rgb + a, () => {
    const c = canvas(64), g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, `rgba(${rgb},${a})`); gr.addColorStop(0.45, `rgba(${rgb},${a * 0.4})`); gr.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    return tex(c, {});
  });
}
export function cloudTexture() {
  return memo('cloud', () => {
    const c = canvas(256, 128), g = c.getContext('2d'), r = rngOf(77);
    for (let i = 0; i < 16; i++) {
      const x = 40 + r() * 176, y = 50 + r() * 34, rr = 18 + r() * 26;
      const gr = g.createRadialGradient(x, y, 0, x, y, rr); gr.addColorStop(0, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(x - rr, y - rr, rr * 2, rr * 2);
    }
    return tex(c, {});
  });
}
export function waterTexture() {
  return memo('water', () => {
    const c = canvas(256), g = c.getContext('2d'), r = rngOf(55);
    g.fillStyle = '#3d7f92'; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 70; i++) {
      const y = r() * 256, x = r() * 256, w = 20 + r() * 60;
      g.strokeStyle = `rgba(230,250,255,${0.15 + r() * 0.3})`; g.lineWidth = 1 + r() * 2.2;
      g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + w / 2, y + (r() - 0.5) * 8, x + w, y); g.stroke();
      g.beginPath(); g.moveTo(x - 256, y); g.quadraticCurveTo(x - 256 + w / 2, y + (r() - 0.5) * 8, x - 256 + w, y); g.stroke();
    }
    return tex(c, { repeat: [3, 3] });
  });
}
export function terraceTexture() {
  return memo('terrace', () => {
    const c = canvas(256), g = c.getContext('2d'), r = rngOf(63);
    g.fillStyle = '#b4b4b4'; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 10; i++) { g.fillStyle = i % 2 ? 'rgba(0,0,0,0.13)' : 'rgba(255,255,255,0.1)'; g.fillRect(0, i * 25.6, 256, 25.6); g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, i * 25.6, 256, 2); }
    for (let i = 0; i < 4000; i++) { const v = 100 + r() * 130; g.fillStyle = `rgba(${v},${v},${v},0.35)`; g.fillRect(r() * 256, r() * 256, 1 + r() * 2, 1 + r() * 2); }
    for (let i = 0; i < 70; i++) { g.fillStyle = 'rgba(0,0,0,0.16)'; g.fillRect(r() * 256, Math.floor(r() * 10) * 25.6, 4 + r() * 18, 25.6); }
    return tex(c, { repeat: [1, 1], aniso: 8 });
  });
}
export function flagTexture() { return null; }

export const hasCanvas = hasDom;
