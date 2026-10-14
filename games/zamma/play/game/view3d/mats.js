// Procedural canvases for the Zamma scene: sand surfaces with scratched lines, carved frame band, dunes, sky, soft sprites.
// Pure canvas code (browser only); no assets. One light from the upper left is baked only lightly: the real lights do the rest.
import * as THREE from '../vendor3d/three.js';
import { boardLines } from '../src/art.js';

const TAU = Math.PI * 2;
const lcg = (seed) => { let s = seed >>> 0 || 1; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); };
const cv = (w, h = w) => { const c = document.createElement('canvas'); c.width = Math.max(2, Math.round(w)); c.height = Math.max(2, Math.round(h)); return c; };
export function tex(canvas, { repeat, srgb = true, flipY = true, aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(canvas);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = aniso; t.flipY = flipY;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}

// Playing surface: (n + 0.2) cells square, one cell = 100 canvas units before scaling. Points sit at cell centres.
export function sandCanvases(pal, n, alq, seed = 1) {
  const G = n + 0.2, K = Math.max(70, Math.min(200, Math.floor(1536 / G))) / 100, W = Math.round(G * 100 * K);
  const map = cv(W), x = map.getContext('2d'), bump = cv(W), bx = bump.getContext('2d');
  const rnd = lcg(seed * 7919 + n * 31 + pal.name.length);
  x.save(); x.scale(K, K); bx.save(); bx.scale(K, K);
  const L = G * 100;
  const pg = x.createLinearGradient(0, 0, L, L); pg.addColorStop(0, pal.top[0]); pg.addColorStop(0.55, pal.top[1]); pg.addColorStop(1, pal.top[2]);
  x.fillStyle = pg; x.fillRect(0, 0, L, L);
  bx.fillStyle = '#808080'; bx.fillRect(0, 0, L, L);
  // wind ripples and a drift of grains
  for (let k = 0; k < 90; k++) {
    const y = rnd() * L, a = 0.04 + rnd() * 0.08, amp = 3 + rnd() * 9, ph = rnd() * 6, fr = 0.006 + rnd() * 0.012, lw = 1.5 + rnd() * 3;
    x.strokeStyle = rnd() < 0.6 ? `rgba(${pal.grain[0]},${pal.grain[1]},${pal.grain[2]},${a})` : `rgba(255,244,215,${a * 1.4})`; x.lineWidth = lw;
    bx.strokeStyle = rnd() < 0.5 ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.18)'; bx.lineWidth = lw;
    x.beginPath(); bx.beginPath(); x.moveTo(0, y); bx.moveTo(0, y);
    for (let px = 0; px <= L + 30; px += 30) { const py = y + Math.sin(px * fr + ph) * amp; x.lineTo(px, py); bx.lineTo(px, py); }
    x.stroke(); bx.stroke();
  }
  for (let k = 0; k < 5200; k++) {
    const px = rnd() * L, py = rnd() * L, s = 0.8 + rnd() * 1.8, d = rnd() < 0.5;
    x.fillStyle = d ? `rgba(${pal.grain[0]},${pal.grain[1]},${pal.grain[2]},${0.1 + rnd() * 0.22})` : `rgba(255,248,226,${0.12 + rnd() * 0.28})`; x.fillRect(px, py, s, s);
    bx.fillStyle = d ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.3)'; bx.fillRect(px, py, s, s);
  }
  // a few pebbles pressed into the surface
  for (let k = 0; k < 14; k++) {
    const px = rnd() * L, py = rnd() * L, r = 2 + rnd() * 3.5;
    x.fillStyle = 'rgba(70,52,34,0.5)'; x.beginPath(); x.ellipse(px, py, r, r * 0.8, rnd() * 3, 0, TAU); x.fill();
    bx.fillStyle = 'rgba(255,255,255,0.55)'; bx.beginPath(); bx.ellipse(px, py, r, r * 0.8, 0, 0, TAU); bx.fill();
  }
  const P = (r, c) => [10 + (c + 0.5) * 100, 10 + (r + 0.5) * 100];
  x.lineCap = bx.lineCap = 'round';
  const stroke = (c2, dx, dy, col, w, bcol) => {
    const go = (cx, color, ww) => { cx.strokeStyle = color; cx.lineWidth = ww; cx.beginPath(); boardLines(n, alq, (r0, c0, r1, c1) => { const a = P(r0, c0), b = P(r1, c1); cx.moveTo(a[0] + dx, a[1] + dy); cx.lineTo(b[0] + dx, b[1] + dy); }); cx.stroke(); };
    go(x, col, w); if (bcol) go(bx, bcol, w);
  };
  // the lines are scratched: dark groove, light lip below-right, and in the bump map a real furrow
  stroke(0, 2, 2.4, 'rgba(255,246,218,0.6)', 6, 'rgba(255,255,255,0.75)');
  stroke(0, 0, 0, pal.line, 5, 'rgba(0,0,0,0.95)');
  stroke(0, -0.6, -0.8, 'rgba(0,0,0,0.4)', 1.8, null);
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    const [px, py] = P(r, c), hg = x.createRadialGradient(px - 2, py - 2, 1, px, py, 15);
    hg.addColorStop(0, 'rgba(0,0,0,0.6)'); hg.addColorStop(0.7, 'rgba(0,0,0,0.3)'); hg.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = hg; x.beginPath(); x.arc(px, py, 15, 0, TAU); x.fill();
    const bg = bx.createRadialGradient(px, py, 1, px, py, 14); bg.addColorStop(0, 'rgba(0,0,0,0.85)'); bg.addColorStop(1, 'rgba(0,0,0,0)');
    bx.fillStyle = bg; bx.beginPath(); bx.arc(px, py, 14, 0, TAU); bx.fill();
  }
  { const [px, py] = P((n - 1) / 2, (n - 1) / 2);
    x.strokeStyle = pal.line; x.lineWidth = 3.4; x.beginPath(); x.arc(px, py, 26, 0, TAU); x.stroke();
    x.strokeStyle = 'rgba(255,246,218,0.6)'; x.lineWidth = 2; x.beginPath(); x.arc(px + 1.2, py + 1.8, 26, 0.1 * Math.PI, 0.9 * Math.PI); x.stroke();
    bx.strokeStyle = 'rgba(0,0,0,0.9)'; bx.lineWidth = 4; bx.beginPath(); bx.arc(px, py, 26, 0, TAU); bx.stroke(); }
  x.restore(); bx.restore();
  return { map, bump };
}

// the carved band of triangles on the frame top (transparent canvas laid over the frame)
export function bandCanvas(pal, n, size = 1536) {
  const c = cv(size), x = c.getContext('2d'), S = n + 1.1, u = size / S, mid = n / 2 + 0.325;
  const tri = (cx, cy, up, horiz) => {
    const s = 0.1 * u;
    x.beginPath();
    if (horiz) { x.moveTo(cx - s, cy + (up ? s * 0.8 : -s * 0.8)); x.lineTo(cx + s, cy + (up ? s * 0.8 : -s * 0.8)); x.lineTo(cx, cy + (up ? -s * 0.8 : s * 0.8)); }
    else { x.moveTo(cx + (up ? s * 0.8 : -s * 0.8), cy - s); x.lineTo(cx + (up ? s * 0.8 : -s * 0.8), cy + s); x.lineTo(cx + (up ? -s * 0.8 : s * 0.8), cy); }
    x.closePath();
    x.fillStyle = 'rgba(30,14,4,0.55)'; x.fill(); x.strokeStyle = 'rgba(255,236,190,0.5)'; x.lineWidth = 1.6; x.stroke();
  };
  const step = 0.27 * u, lo = 0.3 * u;
  for (let k = 0, px = lo; px < size - lo; px += step, k++) {
    const up = k % 2 === 0;
    tri(px, (S / 2 - mid) * u, up, true); tri(px, (S / 2 + mid) * u, !up, true);
    tri((S / 2 - mid) * u, px, up, false); tri((S / 2 + mid) * u, px, !up, false);
  }
  return c;
}

export function groundCanvases(size = 512) {
  const map = cv(size), x = map.getContext('2d'), bump = cv(size), bx = bump.getContext('2d'), r = lcg(77);
  x.fillStyle = '#d4b27a'; x.fillRect(0, 0, size, size); bx.fillStyle = '#808080'; bx.fillRect(0, 0, size, size);
  for (let k = 0; k < 70; k++) {
    const y = r() * size, a = 0.05 + r() * 0.1, amp = 4 + r() * 12, ph = r() * 6, fr = (2 + Math.floor(r() * 4)) * TAU / size, lw = 2 + r() * 5;
    x.strokeStyle = r() < 0.5 ? `rgba(120,80,40,${a})` : `rgba(255,236,190,${a * 1.2})`; x.lineWidth = lw;
    bx.strokeStyle = r() < 0.5 ? 'rgba(255,255,255,0.28)' : 'rgba(0,0,0,0.28)'; bx.lineWidth = lw;
    x.beginPath(); bx.beginPath();
    for (let px = 0; px <= size; px += 8) { const py = y + Math.sin(px * fr + ph) * amp; if (px) { x.lineTo(px, py); bx.lineTo(px, py); } else { x.moveTo(px, py); bx.moveTo(px, py); } }
    x.stroke(); bx.stroke();
  }
  for (let k = 0; k < 9000; k++) { const px = r() * size, py = r() * size; x.fillStyle = r() < 0.5 ? 'rgba(90,60,30,0.15)' : 'rgba(255,240,200,0.2)'; x.fillRect(px, py, 1.4, 1.4); bx.fillStyle = r() < 0.5 ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.3)'; bx.fillRect(px, py, 1.4, 1.4); }
  return { map, bump };
}

export function skyCanvas(w = 256, h = 512) {
  const c = cv(w, h), x = c.getContext('2d'), g = x.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#0f0c2a'); g.addColorStop(0.1, '#2a1c48'); g.addColorStop(0.18, '#7a3a5c'); g.addColorStop(0.25, '#d0644e'); g.addColorStop(0.31, '#ffa65a'); g.addColorStop(0.4, '#ffd08a'); g.addColorStop(1, '#ffd08a');
  x.fillStyle = g; x.fillRect(0, 0, w, h);
  const r = lcg(5);
  for (let k = 0; k < 60; k++) { x.fillStyle = `rgba(255,244,220,${0.25 + r() * 0.5})`; x.fillRect(r() * w, r() * h * 0.14, 1 + r(), 1 + r()); }
  return c;
}

export const blobCanvas = (rgb = '0,0,0', a = 1, size = 128) => {
  const c = cv(size), x = c.getContext('2d'), g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(0.5, `rgba(${rgb},${a * 0.45})`); g.addColorStop(1, `rgba(${rgb},0)`);
  x.fillStyle = g; x.fillRect(0, 0, size, size); return c;
};
export const ringCanvas = (rgb = '255,255,255', size = 128, inner = 0.7) => {
  const c = cv(size), x = c.getContext('2d'), g = x.createRadialGradient(size / 2, size / 2, size * 0.5 * inner * 0.8, size / 2, size / 2, size / 2);
  g.addColorStop(0, `rgba(${rgb},0)`); g.addColorStop(inner + 0.04, `rgba(${rgb},0.95)`); g.addColorStop(Math.min(0.98, inner + 0.2), `rgba(${rgb},0.4)`); g.addColorStop(1, `rgba(${rgb},0)`);
  x.fillStyle = g; x.fillRect(0, 0, size, size); return c;
};
// a soft pill with a darker core: the furrow a sliding stone ploughs
export const furrowCanvas = () => {
  const c = cv(128, 32), x = c.getContext('2d'), g = x.createLinearGradient(0, 0, 0, 32);
  g.addColorStop(0, 'rgba(60,36,14,0)'); g.addColorStop(0.5, 'rgba(60,36,14,0.8)'); g.addColorStop(1, 'rgba(60,36,14,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 32);
  const e = x.createLinearGradient(0, 0, 128, 0); e.addColorStop(0, 'rgba(0,0,0,1)'); e.addColorStop(0.15, 'rgba(0,0,0,0)'); e.addColorStop(0.85, 'rgba(0,0,0,0)'); e.addColorStop(1, 'rgba(0,0,0,1)');
  x.globalCompositeOperation = 'destination-out'; x.fillStyle = e; x.fillRect(0, 0, 128, 32);
  return c;
};
export const sparkCanvas = () => {
  const c = cv(64), x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,250,225,1)'); g.addColorStop(0.25, 'rgba(255,214,120,0.9)'); g.addColorStop(1, 'rgba(255,170,60,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  x.strokeStyle = 'rgba(255,244,200,0.9)'; x.lineWidth = 2; x.beginPath(); x.moveTo(32, 2); x.lineTo(32, 62); x.moveTo(2, 32); x.lineTo(62, 32); x.stroke();
  return c;
};
