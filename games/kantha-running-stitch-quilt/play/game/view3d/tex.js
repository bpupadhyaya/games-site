// Procedural canvas textures for the quilt scene (no image files). Deterministic: everything is seeded by a hash.
import * as THREE from '../vendor3d/three.js';

export const TAU = Math.PI * 2;
export const hash = (a, b = 0, c = 0) => { const v = Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453; return v - Math.floor(v); };
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export const mk = (w, h = w) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
export function texOf(c, { repeat = [1, 1], aniso = 8, srgb = true, wrap = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (wrap) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]); t.anisotropy = aniso;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
export const hexRgb = (h) => { const s = h.startsWith('#') ? h.slice(1) : h; const n = s.length === 3 ? s.split('').map((c) => c + c).join('') : s; return [parseInt(n.slice(0, 2), 16), parseInt(n.slice(2, 4), 16), parseInt(n.slice(4, 6), 16)]; };

// value noise on an integer lattice with smooth interpolation (seeded)
export function vnoise(x, y, seed = 0) {
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
  const a = hash(xi, yi, seed), b = hash(xi + 1, yi, seed), c = hash(xi, yi + 1, seed), d = hash(xi + 1, yi + 1, seed);
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export const fbm = (x, y, seed = 0, oct = 3) => { let s = 0, a = 0.5, f = 1; for (let i = 0; i < oct; i++) { s += a * vnoise(x * f, y * f, seed + i * 7); a *= 0.5; f *= 2; } return s; };

// ---- woven cotton: albedo + normal map from one height field ------------------------------------------------------------------------
//   opts: { size, c0, c1 (two dye tones, mottled), pitch (px per thread), seed, stripes: [{ edge: 'top'|'left'|'bottom'|'right', at, w, color }],
//           fringe: px (strands beyond the body, transparent canvas), body: inset px of the cloth body (for fringe), strength }
export function clothTextures({ size = 1024, c0 = '#f6efdc', c1 = '#e6dac0', pitch = 5, seed = 1, stripes = [], fringe = 0, strength = 1.5, slub = 0.5 } = {}) {
  const a = mk(size), g = a.getContext('2d');
  const img = g.createImageData(size, size), d = img.data;
  const h = new Float32Array(size * size);
  const A = hexRgb(c0), B = hexRgb(c1);
  const nt = Math.ceil(size / pitch) + 2;
  const tone = new Float32Array(nt * 2);
  for (let i = 0; i < nt * 2; i++) tone[i] = 0.9 + 0.2 * hash(i, seed, 3) + (hash(i, seed, 4) > 0.93 ? slub * 0.18 * (hash(i, seed, 5) - 0.5) * 2 : 0);
  const body = fringe > 0 ? fringe : 0, inner = size - 2 * body;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = x / pitch, j = y / pitch, ci = Math.floor(i), cj = Math.floor(j), fu = i - ci, fv = j - cj;
      const par = (ci + cj) & 1;
      const sx = Math.sin(Math.PI * fu), sy = Math.sin(Math.PI * fv);
      // the visible thread: weft (horizontal) over on even cells, warp (vertical) over on odd cells
      const over = par ? sx * (0.55 + 0.45 * sy) : sy * (0.55 + 0.45 * sx);
      const th = (par ? tone[ci] : tone[nt + cj]) * (0.94 + 0.12 * hash(ci, cj, seed));
      const hh = (par ? 1 : -1) * 0.5 * sx * sy;
      h[y * size + x] = 0.5 + hh;
      const mott = fbm(x / size * 6, y / size * 6, seed, 3), mix = clamp(mott * 1.25 - 0.1, 0, 1);
      const shade = th * (0.74 + 0.4 * over);
      const o = (y * size + x) * 4;
      d[o] = clamp((A[0] + (B[0] - A[0]) * mix) * shade, 0, 255);
      d[o + 1] = clamp((A[1] + (B[1] - A[1]) * mix) * shade, 0, 255);
      d[o + 2] = clamp((A[2] + (B[2] - A[2]) * mix) * shade, 0, 255);
      d[o + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  // stripes (sari borders): bands along an edge of the body
  for (const s of stripes) {
    g.save();
    g.globalAlpha = s.alpha ?? 0.95;
    g.fillStyle = s.color;
    const at = body + s.at * inner, w = s.w * inner;
    if (s.edge === 'top') g.fillRect(body, at, inner, w); else if (s.edge === 'bottom') g.fillRect(body, size - at - w, inner, w);
    else if (s.edge === 'left') g.fillRect(at, body, w, inner); else g.fillRect(size - at - w, body, w, inner);
    g.restore();
    // re-apply the weave shading over the dye
    g.save(); g.globalCompositeOperation = 'multiply'; g.globalAlpha = 0.55;
    const wv = mk(64); const wg = wv.getContext('2d'); wg.fillStyle = '#fff'; wg.fillRect(0, 0, 64, 64);
    for (let t = 0; t < 64; t += pitch) { wg.fillStyle = `rgba(80,60,40,${0.25 + 0.1 * hash(t, seed)})`; wg.fillRect(t, 0, 1.4, 64); wg.fillRect(0, t, 64, 1.4); }
    g.fillStyle = g.createPattern(wv, 'repeat');
    if (s.edge === 'top') g.fillRect(body, at, inner, w); else if (s.edge === 'bottom') g.fillRect(body, size - at - w, inner, w);
    else if (s.edge === 'left') g.fillRect(at, body, w, inner); else g.fillRect(size - at - w, body, w, inner);
    g.restore();
  }
  if (body > 0) {
    // fringe: crop the body to a rectangle and add loose strands beyond each edge
    const out = mk(size), og = out.getContext('2d');
    og.drawImage(a, 0, 0);
    og.globalCompositeOperation = 'destination-in'; og.fillStyle = '#000'; og.fillRect(body, body, inner, inner);
    og.globalCompositeOperation = 'source-over';
    const colAt = (x, y) => { const p = g.getImageData(clamp(x | 0, 0, size - 1), clamp(y | 0, 0, size - 1), 1, 1).data; return `rgba(${p[0]},${p[1]},${p[2]},0.95)`; };
    const edges = [[0, 1], [0, -1], [1, 0], [-1, 0]];
    for (let e = 0; e < 4; e++) {
      const n = Math.floor(inner / 5.5);
      for (let k = 0; k < n; k++) {
        const t = body + (k / n) * inner + hash(k, e, seed) * 3, len = body * (0.3 + 0.55 * hash(k, e, seed + 9)), curl = (hash(k, e, seed + 3) - 0.5) * 4;
        let x0, y0, dx, dy;
        if (e === 0) { x0 = t; y0 = body + 1; dx = curl / len; dy = -1; }
        else if (e === 1) { x0 = t; y0 = body + inner - 1; dx = curl / len; dy = 1; }
        else if (e === 2) { x0 = body + 1; y0 = t; dx = -1; dy = curl / len; }
        else { x0 = body + inner - 1; y0 = t; dx = 1; dy = curl / len; }
        og.beginPath(); og.moveTo(x0, y0); og.quadraticCurveTo(x0 + dx * len * 0.5 + curl * 0.3 * (dy ? 1 : 0), y0 + dy * len * 0.5 + curl * 0.3 * (dx ? 1 : 0), x0 + dx * len + curl * (dy ? 1 : 0), y0 + dy * len + curl * (dx ? 1 : 0));
        og.strokeStyle = colAt(x0 - dx * 6, y0 - dy * 6); og.lineWidth = 1.1 + hash(k, e, seed + 5) * 0.9; og.stroke();
      }
    }
    void edges;
    g.clearRect(0, 0, size, size); g.drawImage(out, 0, 0);
  }
  // normal map from the height field (Sobel)
  const n = mk(size), ng = n.getContext('2d'), nimg = ng.createImageData(size, size), nd = nimg.data;
  const S = strength;
  for (let y = 0; y < size; y++) {
    const y0 = (y === 0 ? size - 1 : y - 1) * size, y1 = (y === size - 1 ? 0 : y + 1) * size, yc = y * size;
    for (let x = 0; x < size; x++) {
      const x0 = x === 0 ? size - 1 : x - 1, x1 = x === size - 1 ? 0 : x + 1;
      const dx = (h[yc + x1] - h[yc + x0]) * S, dy = (h[y1 + x] - h[y0 + x]) * S;
      const l = 1 / Math.hypot(dx, dy, 1), o = (y * size + x) * 4;
      nd[o] = (-dx * l * 0.5 + 0.5) * 255; nd[o + 1] = (dy * l * 0.5 + 0.5) * 255; nd[o + 2] = (l * 0.5 + 0.5) * 255; nd[o + 3] = 255;
    }
  }
  ng.putImageData(nimg, 0, 0);
  return { albedo: a, normal: n };
}

// ---- thread: twisted plies (greyscale, tinted by the material colour) ---------------------------------------------------------------
export function twistCanvas(size = 64) {
  const c = mk(size, size), g = c.getContext('2d');
  g.fillStyle = '#d2d2d2'; g.fillRect(0, 0, size, size);
  g.lineCap = 'round';
  for (let k = -2; k <= 3; k++) {
    // diagonal plies: u runs along the thread, v around it
    const x0 = (k * size) / 2;
    g.beginPath(); g.moveTo(x0, 0); g.lineTo(x0 + size * 0.5, size); g.lineWidth = size * 0.17; g.strokeStyle = '#ffffff'; g.stroke();
    g.beginPath(); g.moveTo(x0 + size * 0.25, 0); g.lineTo(x0 + size * 0.75, size); g.lineWidth = size * 0.07; g.strokeStyle = '#8a8a8a'; g.stroke();
  }
  return c;
}

// ---- planks of dark teak for the floor/table ------------------------------------------------------------------------------------------
export function woodCanvas({ w = 1024, h = 1024, planks = 5, base = [112, 70, 36], seed = 1 } = {}) {
  const c = mk(w, h), g = c.getContext('2d');
  const ph = h / planks;
  for (let i = 0; i < planks; i++) {
    const y0 = i * ph, tone = hash(i, seed, 3), b = base.map((v) => v * (0.82 + tone * 0.36));
    const gr = g.createLinearGradient(0, y0, 0, y0 + ph);
    gr.addColorStop(0, `rgb(${b[0] * 0.86 | 0},${b[1] * 0.86 | 0},${b[2] * 0.86 | 0})`); gr.addColorStop(0.5, `rgb(${b[0] | 0},${b[1] | 0},${b[2] | 0})`); gr.addColorStop(1, `rgb(${b[0] * 0.8 | 0},${b[1] * 0.8 | 0},${b[2] * 0.8 | 0})`);
    g.fillStyle = gr; g.fillRect(0, y0, w, ph);
    for (let k = 0; k < 70; k++) {
      const yy = y0 + hash(i, k, seed) * ph, amp = 2 + hash(i, k, 2) * 8, per = 1 + Math.floor(hash(i, k, 3) * 3), p0 = hash(i, k, 4) * TAU;
      g.beginPath();
      for (let x = 0; x <= w; x += 24) { const yv = yy + Math.sin((x / w) * TAU * per + p0) * amp; if (x) g.lineTo(x, yv); else g.moveTo(x, yv); }
      g.lineWidth = 0.6 + hash(i, k, 5) * 2;
      g.strokeStyle = hash(i, k, 6) > 0.45 ? `rgba(30,14,4,${0.1 + hash(i, k, 7) * 0.2})` : `rgba(255,214,150,${0.04 + hash(i, k, 8) * 0.07})`;
      g.stroke();
    }
    g.fillStyle = 'rgba(8,3,0,0.85)'; g.fillRect(0, y0, w, 4);
    g.fillStyle = 'rgba(255,220,160,0.1)'; g.fillRect(0, y0 + 4, w, 3);
  }
  return c;
}

// ---- soft glow sprite ----------------------------------------------------------------------------------------------------------------
export function glowCanvas(size = 64, rgb = [255, 220, 140]) {
  const c = mk(size), g = c.getContext('2d');
  const rg = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  rg.addColorStop(0, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},1)`); rg.addColorStop(0.4, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0.35)`); rg.addColorStop(1, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0)`);
  g.fillStyle = rg; g.fillRect(0, 0, size, size);
  return c;
}
// A ribbon cross-section: bright in the middle, soft to the sides (v across the ribbon)
export function ribbonCanvas(size = 64) {
  const c = mk(4, size), g = c.getContext('2d');
  const lg = g.createLinearGradient(0, 0, 0, size);
  lg.addColorStop(0, 'rgba(255,255,255,0)'); lg.addColorStop(0.5, 'rgba(255,255,255,1)'); lg.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = lg; g.fillRect(0, 0, 4, size);
  return c;
}
