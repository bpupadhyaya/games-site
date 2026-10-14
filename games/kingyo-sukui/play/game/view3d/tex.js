// Procedural canvas textures for the festival stall scene (no image files). Everything is deterministic (seeded by a hash).
import * as THREE from '../vendor3d/three.js';

export const TAU = Math.PI * 2;
export const hash = (a, b = 0, c = 0) => { const v = Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453; return v - Math.floor(v); };
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
export function texOf(c, { repeat = [1, 1], aniso = 8, srgb = true, wrap = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (wrap) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]); t.anisotropy = aniso;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ---- wood: long planks with grain, knots and seams (planks run along x) -------------------------------------------------------
export function woodCanvas({ w = 1024, h = 1024, planks = 5, base = [112, 70, 36], seed = 1, vertical = false } = {}) {
  const c = mk(w, h), g = c.getContext('2d');
  const ph = (vertical ? w : h) / planks;
  if (vertical) { g.translate(w, 0); g.rotate(Math.PI / 2); }
  const L = vertical ? h : w;
  for (let i = 0; i < planks; i++) {
    const y0 = i * ph, tone = hash(i, seed, 3);
    const b = base.map((v) => v * (0.82 + tone * 0.36));
    const gr = g.createLinearGradient(0, y0, 0, y0 + ph);
    gr.addColorStop(0, `rgb(${b[0] * 0.86 | 0},${b[1] * 0.86 | 0},${b[2] * 0.86 | 0})`);
    gr.addColorStop(0.5, `rgb(${b[0] | 0},${b[1] | 0},${b[2] | 0})`);
    gr.addColorStop(1, `rgb(${b[0] * 0.8 | 0},${b[1] * 0.8 | 0},${b[2] * 0.8 | 0})`);
    g.fillStyle = gr; g.fillRect(0, y0, L, ph);
    for (let k = 0; k < 64; k++) {
      const yy = y0 + hash(i, k, seed) * ph, amp = 2 + hash(i, k, 2) * 8, per = 1 + Math.floor(hash(i, k, 3) * 3), p0 = hash(i, k, 4) * TAU;
      g.beginPath();
      for (let x = 0; x <= L; x += 24) { const yv = yy + Math.sin((x / L) * TAU * per + p0) * amp; if (x) g.lineTo(x, yv); else g.moveTo(x, yv); }
      g.lineWidth = 0.6 + hash(i, k, 5) * 2;
      g.strokeStyle = hash(i, k, 6) > 0.45 ? `rgba(30,14,4,${0.1 + hash(i, k, 7) * 0.2})` : `rgba(255,214,150,${0.04 + hash(i, k, 8) * 0.07})`;
      g.stroke();
    }
    if (hash(i, seed, 9) > 0.5) {
      const kx = hash(i, seed, 10) * L, ky = y0 + ph * (0.3 + hash(i, 11) * 0.4);
      for (let r = 5; r > 0; r--) { g.beginPath(); g.ellipse(kx, ky, r * 8, r * 3.6, 0, 0, TAU); g.strokeStyle = `rgba(28,12,3,${0.12 + r * 0.05})`; g.lineWidth = 2; g.stroke(); }
    }
    g.fillStyle = 'rgba(8,3,0,0.85)'; g.fillRect(0, y0, L, 4);
    g.fillStyle = 'rgba(255,220,160,0.1)'; g.fillRect(0, y0 + 4, L, 3);
  }
  return c;
}

// ---- tub: glazed blue enamel floor with speckle and a few pebbles ----------------------------------------------------------------
export function tubFloorCanvas(size = 1024) {
  const c = mk(size, size), g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, size, size); gr.addColorStop(0, '#2b8fb0'); gr.addColorStop(1, '#17658c');
  g.fillStyle = gr; g.fillRect(0, 0, size, size);
  // soft mottling
  for (let k = 0; k < 90; k++) {
    const x = hash(k, 1) * size, y = hash(k, 2) * size, r = 30 + hash(k, 3) * 120;
    const rg = g.createRadialGradient(x, y, 0, x, y, r); const light = hash(k, 4) > 0.5;
    rg.addColorStop(0, light ? 'rgba(220,250,255,0.10)' : 'rgba(10,60,90,0.10)'); rg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = rg; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // pebbles and a few shells
  for (let k = 0; k < 70; k++) {
    const x = hash(k, 11) * size, y = hash(k, 12) * size, r = 7 + hash(k, 13) * 15, a = hash(k, 14) * Math.PI, tone = 120 + hash(k, 15) * 70;
    g.save(); g.translate(x, y); g.rotate(a);
    g.beginPath(); g.ellipse(3, 4, r * 1.2, r * 0.9, 0, 0, TAU); g.fillStyle = 'rgba(0,40,70,0.28)'; g.fill();
    g.beginPath(); g.ellipse(0, 0, r * 1.2, r * 0.9, 0, 0, TAU);
    const pg = g.createRadialGradient(-r * 0.3, -r * 0.3, 1, 0, 0, r * 1.3); pg.addColorStop(0, `rgb(${tone + 25},${tone + 18},${tone})`); pg.addColorStop(1, `rgb(${tone * 0.62 | 0},${tone * 0.6 | 0},${tone * 0.56 | 0})`);
    g.fillStyle = pg; g.fill(); g.restore();
  }
  return c;
}

// ---- tub wall (outer cypress boards and inner enamel are separate materials) ------------------------------------------------------
export function enamelCanvas(size = 256) {
  const c = mk(size, size), g = c.getContext('2d');
  g.fillStyle = '#3f9bc4'; g.fillRect(0, 0, size, size);
  for (let k = 0; k < 600; k++) { g.fillStyle = `rgba(255,255,255,${hash(k, 1) * 0.06})`; g.fillRect(hash(k, 2) * size, hash(k, 3) * size, 2, 2); }
  return c;
}

// ---- indigo cotton with a wave pattern (yukata sleeve, table cloth). `scale` = wave size in px ----------------------------------------
export function indigoCanvas({ size = 512, scale = 64, ink = '#16224a', paper = '#e9eef4', cloth = '#1d2c5e', seed = 3 } = {}) {
  const c = mk(size, size), g = c.getContext('2d');
  g.fillStyle = cloth; g.fillRect(0, 0, size, size);
  // woven thread
  for (let y = 0; y < size; y += 3) { g.fillStyle = `rgba(255,255,255,${0.025 + hash(y, seed) * 0.03})`; g.fillRect(0, y, size, 1); }
  for (let x = 0; x < size; x += 3) { g.fillStyle = `rgba(0,0,20,${0.04 + hash(x, seed, 2) * 0.05})`; g.fillRect(x, 0, 1, size); }
  // seigaiha (blue ocean waves): rows of overlapping concentric arcs, painted back to front
  const r = scale / 2, rows = Math.ceil(size / (r * 0.5)) + 2;
  for (let row = rows; row >= -1; row--) {
    for (let col = -1; col < size / scale + 2; col++) {
      const cx = col * scale + (row % 2 ? r : 0), cy = row * r * 0.5;
      for (let k = 4; k >= 1; k--) {
        g.beginPath(); g.arc(cx, cy + r * 0.5, r * (k / 4), Math.PI, TAU);
        g.fillStyle = k % 2 ? paper : ink; g.fill();
        g.lineWidth = 1.2; g.strokeStyle = 'rgba(10,20,60,0.6)'; g.stroke();
      }
    }
  }
  const sh = g.createLinearGradient(0, 0, size, size); sh.addColorStop(0, 'rgba(255,255,255,0.05)'); sh.addColorStop(1, 'rgba(0,0,30,0.1)');
  g.fillStyle = sh; g.fillRect(0, 0, size, size);
  return c;
}
// ---- table cloth: deep indigo, tiny woven crosses (kasuri) and pale border bands ---------------------------------------------------------
export function clothCanvas(size = 512) {
  const c = mk(size, size), g = c.getContext('2d');
  g.fillStyle = '#1a2756'; g.fillRect(0, 0, size, size);
  for (let y = 0; y < size; y += 2) { g.fillStyle = `rgba(255,255,255,${0.02 + hash(y, 9) * 0.03})`; g.fillRect(0, y, size, 1); }
  for (let x = 0; x < size; x += 2) { g.fillStyle = `rgba(0,0,20,${0.05 + hash(x, 8) * 0.06})`; g.fillRect(x, 0, 1, size); }
  const n = 16, st = size / n;
  g.strokeStyle = 'rgba(214,224,244,0.5)'; g.lineWidth = 2;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const x = (i + (j % 2 ? 0.5 : 0)) * st + st / 2, y = j * st + st / 2, r = 3.2 + hash(i, j, 4) * 0.6;
    g.beginPath(); g.moveTo(x - r, y); g.lineTo(x + r, y); g.moveTo(x, y - r); g.lineTo(x, y + r); g.stroke();
  }
  return c;
}
export function stripeCanvas({ size = 256, a = '#e8e2d2', b = '#1d2c5e', n = 8 } = {}) {
  const c = mk(size, size), g = c.getContext('2d');
  for (let i = 0; i < n; i++) { g.fillStyle = i % 2 ? b : a; g.fillRect((i * size) / n, 0, size / n + 1, size); }
  for (let y = 0; y < size; y += 3) { g.fillStyle = `rgba(0,0,0,${0.03 + hash(y, 7) * 0.04})`; g.fillRect(0, y, size, 1); }
  return c;
}

// ---- paper lantern (chochin): red-orange washi with ribs, black caps ------------------------------------------------------------------
export function lanternCanvas({ w = 256, h = 256, a = '#ff8f3a', b = '#d83a1a', ribs = 14 } = {}) {
  const c = mk(w, h), g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, b); gr.addColorStop(0.5, a); gr.addColorStop(1, b);
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
  g.strokeStyle = 'rgba(60,10,0,0.45)'; g.lineWidth = 2;
  for (let i = 1; i < 11; i++) { const y = (i / 11) * h; g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
  for (let k = 0; k < 700; k++) { g.fillStyle = `rgba(255,240,200,${hash(k, 5) * 0.06})`; g.fillRect(hash(k, 6) * w, hash(k, 7) * h, 3, 1); }
  void ribs;
  return c;
}

// ---- soft round sprite ------------------------------------------------------------------------------------------------------------
export function blobCanvas(size = 128, inner = 0.15, power = 1.6) {
  const c = mk(size, size), g = c.getContext('2d');
  const id = g.createImageData(size, size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const d = Math.hypot((x + 0.5) / size - 0.5, (y + 0.5) / size - 0.5) * 2, a = Math.pow(clamp(1 - (d - inner) / (1 - inner), 0, 1), power);
    const i = (y * size + x) * 4; id.data[i] = id.data[i + 1] = id.data[i + 2] = 0; id.data[i + 3] = a * 255;
  }
  g.putImageData(id, 0, 0);
  return c;
}
export function glowCanvas(size = 128, rgb = [255, 190, 110]) {
  const c = mk(size, size), g = c.getContext('2d');
  const rg = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  rg.addColorStop(0, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},1)`); rg.addColorStop(0.25, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0.45)`); rg.addColorStop(1, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0)`);
  g.fillStyle = rg; g.fillRect(0, 0, size, size);
  return c;
}

// ---- the paper of the poi: washi fibres, wetness, wear (cracks and holes growing from the rim) -------------------------------------------
// Drawn on demand into one 256 canvas (alpha = holes). paper 1 fresh .. 0 torn, wet 0..1, seed per sheet.
export function drawPaper(c, paper, wet, seed = 1) {
  const S = c.width, g = c.getContext('2d'), R = S / 2;
  g.clearRect(0, 0, S, S);
  g.save(); g.beginPath(); g.arc(R, R, R - 1, 0, TAU); g.clip();
  // base: cream washi, tinted blue-grey and darker (translucent) with wetness
  const rr = lerp(246, 190, wet), gg = lerp(240, 214, wet), bb = lerp(224, 228, wet);
  const bg = g.createRadialGradient(R * 0.8, R * 0.8, R * 0.1, R, R, R);
  bg.addColorStop(0, `rgb(${rr},${gg},${bb})`); bg.addColorStop(1, `rgb(${rr * 0.93 | 0},${gg * 0.94 | 0},${bb * 0.95 | 0})`);
  g.fillStyle = bg; g.fillRect(0, 0, S, S);
  // fibres
  g.lineCap = 'round';
  for (let k = 0; k < 260; k++) {
    const x = hash(k, seed, 1) * S, y = hash(k, seed, 2) * S, a = hash(k, seed, 3) * Math.PI, l = 6 + hash(k, seed, 4) * 22;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
    g.strokeStyle = hash(k, seed, 5) > 0.5 ? `rgba(120,100,70,${0.07 + 0.05 * (1 - wet)})` : `rgba(255,255,250,${0.18})`; g.lineWidth = 0.7 + hash(k, seed, 6); g.stroke();
  }
  // wet patches (darker, glassy) spreading from the centre as the paper soaks
  if (wet > 0.03) {
    const wg = g.createRadialGradient(R, R, 0, R, R, R * (0.4 + 0.75 * wet));
    wg.addColorStop(0, `rgba(120,170,205,${0.35 * wet})`); wg.addColorStop(1, 'rgba(120,170,205,0)');
    g.fillStyle = wg; g.fillRect(0, 0, S, S);
  }
  // wear: thin worn areas then cracks and torn notches from the rim, deterministic per sheet
  const wear = clamp(1 - paper, 0, 1);
  if (wear > 0.12) {
    const n = Math.floor(3 + wear * 9);
    for (let i = 0; i < n; i++) {
      const a = hash(i, seed, 20) * TAU, len = R * (0.18 + 0.7 * hash(i, seed, 21)) * clamp(wear * 1.5, 0.3, 1);
      g.beginPath(); g.moveTo(R + Math.cos(a) * (R - 1), R + Math.sin(a) * (R - 1));
      const steps = 6;
      for (let s = 1; s <= steps; s++) { const q = s / steps, j = (hash(i, s, seed) - 0.5) * 0.35; g.lineTo(R + Math.cos(a + j) * (R - 1 - len * q), R + Math.sin(a + j) * (R - 1 - len * q)); }
      g.strokeStyle = 'rgba(70,52,34,0.75)'; g.lineWidth = 1.6; g.stroke();
      g.strokeStyle = 'rgba(255,250,235,0.55)'; g.lineWidth = 0.7; g.stroke();
    }
  }
  // holes: erased with destination-out, ragged
  if (wear > 0.4) {
    g.globalCompositeOperation = 'destination-out';
    const holes = Math.floor((wear - 0.4) * 9);
    for (let i = 0; i < holes; i++) {
      const a = hash(i, seed, 30) * TAU, d = R * (0.2 + 0.6 * hash(i, seed, 31)), r0 = R * (0.04 + 0.1 * (wear - 0.35) * (0.5 + hash(i, seed, 32)));
      g.beginPath();
      for (let s = 0; s < 10; s++) { const q = (s / 10) * TAU, rr2 = r0 * (0.65 + 0.7 * hash(i, s, seed + 5)); const px = R + Math.cos(a) * d + Math.cos(q) * rr2, py = R + Math.sin(a) * d + Math.sin(q) * rr2; if (s) g.lineTo(px, py); else g.moveTo(px, py); }
      g.closePath(); g.fillStyle = '#000'; g.fill();
    }
    g.globalCompositeOperation = 'source-over';
  }
  g.restore();
}
