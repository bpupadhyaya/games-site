// Procedural canvas textures for the 3D layer (no image files): bamboo grain, paper fibres, cloth twill, soft sprites.
// Everything is deterministic (seeded hash) so renders are reproducible.
import * as THREE from '../vendor3d/three.js';

export const hash = (n) => { let x = Math.imul(n | 0, 0x45d9f3b); x ^= x >>> 16; x = Math.imul(x, 0x45d9f3b); x ^= x >>> 16; return (x >>> 0) / 4294967296; };
const rng = (seed) => { let s = seed >>> 0; return () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };

export function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
export function tex(c, { repeat = null, srgb = true, aniso = 4, wrap = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (wrap) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  if (repeat) t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = aniso;
  return t;
}

// Bamboo culm: warm green/gold fibres running along v (vertical), darker node bands.
export function bambooCanvas(size = 256, base = ['#9bb85a', '#5f8a3a'], seed = 3, gold = false) {
  const c = canvas(size, size), g = c.getContext('2d'), r = rng(seed);
  const grd = g.createLinearGradient(0, 0, size, 0);
  const [a, b] = gold ? ['#e8cf7a', '#b88a30'] : base;
  grd.addColorStop(0, b); grd.addColorStop(0.35, a); grd.addColorStop(0.65, a); grd.addColorStop(1, b);
  g.fillStyle = grd; g.fillRect(0, 0, size, size);
  for (let i = 0; i < size * 1.2; i++) {
    const x = r() * size, w = 0.6 + r() * 1.6, al = 0.05 + r() * 0.12;
    g.fillStyle = r() < 0.5 ? `rgba(30,50,14,${al})` : `rgba(255,250,200,${al * 0.9})`;
    g.fillRect(x, 0, w, size);
  }
  return c;
}

// Paper / bamboo-strip / feather surface for a rotor blade. u runs root->tip (x), v across (y).
export function bladeCanvas(kind, seed = 1, w = 256, h = 96) {
  const c = canvas(w, h), g = c.getContext('2d'), r = rng(seed);
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
  if (kind === 'bamboo') {
    for (let i = 0; i < 70; i++) { const y = r() * h; g.fillStyle = `rgba(110,70,10,${0.05 + r() * 0.12})`; g.fillRect(0, y, w, 0.8 + r() * 1.6); }
    g.fillStyle = 'rgba(255,248,200,0.25)'; for (let i = 0; i < 20; i++) g.fillRect(0, r() * h, w, 1);
  } else if (kind === 'feather') {
    g.strokeStyle = 'rgba(60,100,150,0.35)'; g.lineWidth = 1;
    for (let i = 0; i < 58; i++) { const x = (i / 58) * w; g.beginPath(); g.moveTo(x, h / 2); g.lineTo(x + 28, 2); g.moveTo(x, h / 2); g.lineTo(x + 28, h - 2); g.stroke(); }
  } else if (kind === 'jade') {
    const gr = g.createRadialGradient(w * 0.4, h * 0.5, 4, w * 0.4, h * 0.5, w * 0.7); gr.addColorStop(0, 'rgba(255,255,255,0.7)'); gr.addColorStop(1, 'rgba(0,60,30,0.28)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(0,70,40,0.22)'; g.lineWidth = 1.2; for (let i = 0; i < 8; i++) { g.beginPath(); g.moveTo(r() * w, 0); g.bezierCurveTo(r() * w, h * 0.3, r() * w, h * 0.7, r() * w, h); g.stroke(); }
  } else {   // paper: long fibres + a center rib
    for (let i = 0; i < 220; i++) { const x = r() * w, y = r() * h, l = 6 + r() * 26, a = (r() - 0.5) * 0.7; g.strokeStyle = `rgba(90,60,40,${0.04 + r() * 0.09})`; g.lineWidth = 0.7; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); }
  }
  // centre rib + soft edge shading
  g.fillStyle = 'rgba(70,40,10,0.28)'; g.fillRect(0, h / 2 - 1, w, 2);
  const e = g.createLinearGradient(0, 0, 0, h); e.addColorStop(0, 'rgba(40,20,0,0.32)'); e.addColorStop(0.12, 'rgba(40,20,0,0)'); e.addColorStop(0.88, 'rgba(40,20,0,0)'); e.addColorStop(1, 'rgba(40,20,0,0.32)');
  g.fillStyle = e; g.fillRect(0, 0, w, h);
  return c;
}

export function clothCanvas(size = 128, c0 = '#27446f', c1 = '#16294a') {
  const c = canvas(size, size), g = c.getContext('2d');
  g.fillStyle = c0; g.fillRect(0, 0, size, size);
  for (let i = -size; i < size * 2; i += 4) { g.strokeStyle = 'rgba(255,255,255,0.07)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(i, 0); g.lineTo(i + size, size); g.stroke(); }
  for (let i = -size; i < size * 2; i += 4) { g.strokeStyle = c1; g.globalAlpha = 0.35; g.lineWidth = 1; g.beginPath(); g.moveTo(i, size); g.lineTo(i + size, 0); g.stroke(); g.globalAlpha = 1; }
  return c;
}

// soft round blob (alpha), used for shadows / glows / clouds
export function blobCanvas(rgb = '0,0,0', a = 0.6, size = 128, hard = 0.0) {
  const c = canvas(size, size), g = c.getContext('2d');
  const gr = g.createRadialGradient(size / 2, size / 2, size * 0.5 * hard, size / 2, size / 2, size / 2);
  gr.addColorStop(0, `rgba(${rgb},${a})`); gr.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = gr; g.fillRect(0, 0, size, size);
  return c;
}
export function cloudCanvas(seed = 1, w = 512, h = 160) {
  const c = canvas(w, h), g = c.getContext('2d'), r = rng(seed);
  for (let i = 0; i < 16; i++) {
    const x = w * (0.14 + 0.72 * r()), y = h * (0.42 + 0.22 * (r() - 0.5)), rad = h * (0.2 + 0.22 * r());
    const gr = g.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  return c;
}
export const leafShape = () => { const s = new THREE.Shape(); s.moveTo(0, -1); s.bezierCurveTo(0.9, -0.5, 0.9, 0.5, 0, 1); s.bezierCurveTo(-0.9, 0.5, -0.9, -0.5, 0, -1); return new THREE.ShapeGeometry(s, 4); };
