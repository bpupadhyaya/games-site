// Procedural canvas textures (no image files): fur, woven cloth, sand grain, mud brick, glazed tile, roof tile.
import { THREE } from '../vendor3d/index.js';

const cache = new Map();
const hash = (n) => { n = Math.imul(n ^ (n >>> 15), 0x85ebca6b); n = Math.imul(n ^ (n >>> 13), 0xc2b2ae35); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };
function canvasTex(key, size, draw, repeat = [1, 1], srgb = true) {
  let t = cache.get(key); if (t) return t;
  const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d'); draw(g, size);
  t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); t.anisotropy = 4;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace; cache.set(key, t); return t;
}
export function disposeTextures() { for (const t of cache.values()) t.dispose(); cache.clear(); }

// Fur: fine vertical strands with soft value noise; shaggy = longer, clumped strands.
export const furTexture = (shaggy) => canvasTex('fur' + shaggy, 256, (g, S) => {
  g.fillStyle = '#d8d0c4'; g.fillRect(0, 0, S, S);
  for (let i = 0; i < (shaggy ? 2600 : 3400); i++) {
    const x = hash(i * 3 + 1) * S, y = hash(i * 7 + 2) * S, l = (shaggy ? 10 : 4) + hash(i * 11) * (shaggy ? 18 : 6), v = 150 + hash(i * 13) * 105;
    g.strokeStyle = `rgba(${v},${v * 0.96},${v * 0.9},0.55)`; g.lineWidth = shaggy ? 1.6 : 1; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (hash(i) - 0.5) * 4, y + l); g.stroke();
  }
}, [2, 2]);

// Woven cloth for bales, rugs and robes: base colour, stripes or a lozenge (ikat-like) band in the second colour, weave grain.
export const clothTexture = (a, b, kind) => canvasTex('cl' + a + b + kind, 128, (g, S) => {
  g.fillStyle = a; g.fillRect(0, 0, S, S);
  g.fillStyle = b;
  if (kind === 'silk') { for (let y = 10; y < S; y += 32) g.fillRect(0, y, S, 5); g.globalAlpha = 0.5; for (let x = 0; x < S; x += 16) { g.beginPath(); g.moveTo(x, 20); g.lineTo(x + 8, 28); g.lineTo(x, 36); g.lineTo(x - 8, 28); g.fill(); } g.globalAlpha = 1; }
  else if (kind === 'rug') { g.fillRect(0, 0, S, 10); g.fillRect(0, S - 10, S, 10); for (let x = 8; x < S; x += 24) { g.beginPath(); g.moveTo(x, S / 2 - 18); g.lineTo(x + 12, S / 2); g.lineTo(x, S / 2 + 18); g.lineTo(x - 12, S / 2); g.fill(); } }
  else if (kind === 'robe') { g.globalAlpha = 0.35; for (let y = 0; y < S; y += 22) g.fillRect(0, y, S, 2); g.globalAlpha = 1; }
  else if (kind === 'crate') { g.fillStyle = '#8a6438'; g.fillRect(0, 0, S, S); g.fillStyle = 'rgba(40,24,10,0.6)'; for (let y = 0; y < S; y += 32) g.fillRect(0, y, S, 3); g.fillStyle = b; g.globalAlpha = 0.85; g.fillRect(S * 0.3, S * 0.3, S * 0.4, S * 0.4); g.globalAlpha = 1; }
  else if (kind === 'bundle') { g.fillStyle = 'rgba(120,90,50,0.35)'; for (let y = 0; y < S; y += 6) g.fillRect(0, y, S, 1); g.fillStyle = b; g.fillRect(S * 0.45, 0, 8, S); }
  else if (kind === 'sack') { g.fillStyle = 'rgba(0,0,0,0.12)'; for (let i = 0; i < 40; i++) g.fillRect(hash(i) * S, hash(i + 9) * S, 30, 2); g.fillStyle = b; g.globalAlpha = 0.6; g.fillRect(0, S * 0.15, S, 6); g.globalAlpha = 1; }
  else if (kind === 'wrap') { g.fillStyle = 'rgba(0,0,0,0.08)'; for (let y = 0; y < S; y += 12) g.fillRect(0, y, S, 4); }
  else if (kind === 'felt') { g.fillStyle = 'rgba(0,0,0,0.06)'; for (let i = 0; i < 300; i++) g.fillRect(hash(i) * S, hash(i + 3) * S, 3, 3); g.strokeStyle = b; g.lineWidth = 3; for (let y = S * 0.6; y < S; y += 14) { g.beginPath(); for (let x = 0; x <= S; x += 8) g.lineTo(x, y + Math.sin(x * 0.2) * 3); g.stroke(); } }
  // weave grain
  const d = g.getImageData(0, 0, S, S); for (let i = 0; i < d.data.length; i += 4) { const n = ((i >> 2) % 2 ^ ((i >> 2) / S | 0) % 2) ? 10 : -10; d.data[i] += n; d.data[i + 1] += n; d.data[i + 2] += n; } g.putImageData(d, 0, 0);
});

// Ground grain: sand ripples / gravel speckle in grey values (multiplied by the terrain vertex colours).
export const groundTexture = (kind) => canvasTex('gr' + kind, 512, (g, S) => {
  g.fillStyle = '#e8e8e8'; g.fillRect(0, 0, S, S);
  if (kind === 'sand') {
    for (let y = 0; y < S; y += 3) { g.strokeStyle = `rgba(${hash(y) > 0.5 ? '255,255,255' : '120,110,100'},${0.1 + hash(y + 5) * 0.12})`; g.lineWidth = 1.4; g.beginPath(); for (let x = 0; x <= S; x += 8) g.lineTo(x, y + Math.sin(x * 0.045 + y * 0.31) * 4 + Math.sin(x * 0.013) * 6); g.stroke(); }
  }
  for (let i = 0; i < (kind === 'gravel' ? 9000 : 5000); i++) { const v = 90 + hash(i * 5) * 165, s = kind === 'gravel' ? 1 + hash(i) * 3 : 1; g.fillStyle = `rgba(${v},${v * 0.97},${v * 0.92},${kind === 'gravel' ? 0.45 : 0.25})`; g.fillRect(hash(i * 3) * S, hash(i * 7) * S, s, s); }
  if (kind === 'grass') for (let i = 0; i < 5000; i++) { const x = hash(i) * S, y = hash(i + 4) * S; g.strokeStyle = `rgba(${60 + hash(i + 2) * 120},${110 + hash(i + 6) * 100},60,0.35)`; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (hash(i + 8) - 0.5) * 3, y - 4 - hash(i + 9) * 6); g.stroke(); }
}, [1, 1], true);

// Sun-dried mud brick / rammed earth with courses, straw flecks and weathering streaks.
export const brickTexture = (col, rammed) => canvasTex('br' + col + rammed, 256, (g, S) => {
  g.fillStyle = col; g.fillRect(0, 0, S, S);
  if (rammed) { for (let y = 0; y < S; y += 26) { g.fillStyle = 'rgba(60,40,20,0.18)'; g.fillRect(0, y, S, 2); g.fillStyle = 'rgba(255,240,210,0.08)'; g.fillRect(0, y + 3, S, 8); } }
  else for (let y = 0, r = 0; y < S; y += 16, r++) { g.fillStyle = 'rgba(60,40,20,0.22)'; g.fillRect(0, y, S, 2); for (let x = (r % 2) * 16; x < S; x += 32) g.fillRect(x, y, 2, 16); }
  for (let i = 0; i < 1500; i++) { g.fillStyle = hash(i) > 0.5 ? 'rgba(255,240,200,0.12)' : 'rgba(50,30,10,0.12)'; g.fillRect(hash(i * 3) * S, hash(i * 5) * S, 1 + hash(i * 7) * 3, 1); }
  for (let i = 0; i < 18; i++) { const x = hash(i * 11) * S, gr = g.createLinearGradient(0, 0, 0, S); gr.addColorStop(0, 'rgba(60,40,20,0.16)'); gr.addColorStop(1, 'rgba(60,40,20,0)'); g.fillStyle = gr; g.fillRect(x, 0, 3 + hash(i) * 6, S * (0.3 + hash(i + 1) * 0.6)); }
});

// Glazed tile mosaic for the Sogdian and Persian portals (lapis, turquoise and white, a star-and-cross field).
export const tileTexture = (a = '#1d4f9a', b = '#3fb3c4') => canvasTex('ti' + a + b, 256, (g, S) => {
  g.fillStyle = a; g.fillRect(0, 0, S, S);
  for (let y = 0; y < S; y += 32) for (let x = 0; x < S; x += 32) {
    g.fillStyle = b; g.beginPath(); for (let k = 0; k < 8; k++) { const ang = k * Math.PI / 4, r = k % 2 ? 7 : 14; g.lineTo(x + 16 + Math.cos(ang) * r, y + 16 + Math.sin(ang) * r); } g.fill();
    g.fillStyle = '#f2ead6'; g.beginPath(); g.arc(x + 16, y + 16, 3, 0, Math.PI * 2); g.fill();
  }
  g.strokeStyle = 'rgba(255,255,255,0.18)'; for (let i = 0; i <= S; i += 8) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, S); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(S, i); g.stroke(); }
});

// Grey clay roof tiles in rows (Tang roofs).
export const roofTexture = (col = '#4a4e58') => canvasTex('rf' + col, 128, (g, S) => {
  g.fillStyle = col; g.fillRect(0, 0, S, S);
  for (let x = 0; x < S; x += 10) { const gr = g.createLinearGradient(x, 0, x + 10, 0); gr.addColorStop(0, 'rgba(0,0,0,0.35)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.12)'); gr.addColorStop(1, 'rgba(0,0,0,0.35)'); g.fillStyle = gr; g.fillRect(x, 0, 10, S); }
  for (let y = 0; y < S; y += 16) { g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, y, S, 2); }
});
