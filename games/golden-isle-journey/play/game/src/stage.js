// The shadow-theatre stage: painted-light skies, parallax silhouette layers, cloth screen texture,
// vignette, light motes. Everything here is stateless: it draws from (time, scroll) only.

import { lighten, darken, mix, sprite, stats } from './paint/kit.js';
import { skyP, ridgeP, treeP, skylineP, hallP, cloudP, banyanP } from './scenery.js';
export { wall, gardenTree, moon, softBlob, banner } from './scenery.js';
export { dome } from './scenery.js';
export const W = 720;
export const H = 1560;
export const TAU = Math.PI * 2;
export const INK = '#150a12';
export const GOLD = '#f2c46a';

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (t) => { const c = clamp(t, 0, 1); return c * c * (3 - 2 * c); };
// Stateless pseudo-random in [0,1) from an integer: decoration only, never gameplay.
export const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

export const PAL = {
  dawn:   { sky: ['#2b1a3a', '#a8486a', '#f59a4c', '#ffd98a'], glow: '255,214,140', far: '#7a3a52', mid: '#4a2038', near: '#22101f' },
  palace: { sky: ['#2a0f1c', '#7a2a2a', '#d9772e', '#f7c368'], glow: '255,196,110', far: '#6a2a2a', mid: '#3f1620', near: '#1d0a12' },
  day:    { sky: ['#274a5a', '#6fa08a', '#e8c878', '#fbe7a8'], glow: '255,236,170', far: '#4f7a5e', mid: '#2c4a3a', near: '#13241d' },
  forest: { sky: ['#0f2a26', '#2f6a4a', '#a8b85a', '#eedc8a'], glow: '238,230,150', far: '#2f5a44', mid: '#173528', near: '#0a1a14' },
  dusk:   { sky: ['#1a1440', '#5a2a6a', '#e0604a', '#ffc070'], glow: '255,180,100', far: '#3a2a5a', mid: '#231a44', near: '#110c26' },
  night:  { sky: ['#05081c', '#0f1a40', '#24305e', '#4a4a7a'], glow: '190,200,255', far: '#16204a', mid: '#0c1230', near: '#05081a' },
  ember:  { sky: ['#1a0508', '#5a0f10', '#c43a18', '#ff9a3a'], glow: '255,140,60', far: '#5a1612', mid: '#300a0c', near: '#140406' },
  sea:    { sky: ['#101a44', '#3a3a7a', '#c8688a', '#ffc890'], glow: '255,200,150', far: '#2a3a72', mid: '#182450', near: '#0a1230' },
};

// A soft pool of light (the lamp behind the screen).
export function light(ctx, x, y, r, rgb, alpha = 0.6) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(${rgb},${alpha})`);
  g.addColorStop(0.45, `rgba(${rgb},${alpha * 0.35})`);
  g.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

export function sun(ctx, x, y, r, rgb = '255,236,190') {
  light(ctx, x, y, r * 5, rgb, 0.55);
  ctx.fillStyle = `rgba(${rgb},0.95)`;
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
}

export function stars(ctx, alpha, t, top = 0, bottom = H * 0.6) {
  if (alpha <= 0.01) return;
  for (let i = 0; i < 70; i++) {
    const x = hash(i * 3 + 1) * W, y = top + hash(i * 3 + 2) * (bottom - top);
    const tw = 0.55 + 0.45 * Math.sin(t * (0.8 + hash(i) * 2) + i);
    ctx.fillStyle = `rgba(255,240,210,${alpha * tw * (0.4 + hash(i * 7) * 0.6)})`;
    const r = 1 + hash(i * 5) * 1.8;
    ctx.fillRect(x - r / 2, y - r / 2, r, r);
  }
}

// A row of repeating things along a scrolling strip. draw(i, x) is called for each visible index.
export function strip(scroll, gap, draw, margin = 1) {
  const first = Math.floor(scroll / gap) - margin;
  const last = Math.floor((scroll + W) / gap) + margin;
  for (let i = first; i <= last; i++) draw(i, i * gap - scroll);
}

export function lamp(ctx, x, y, s, t, rgb = '255,200,120', ink = INK) {
  const fl = 0.85 + 0.15 * Math.sin(t * 9 + x);
  light(ctx, x, y, 120 * s * fl, rgb, 0.5);
  const lg = ctx.createLinearGradient(0, y, 0, y + 18 * s); lg.addColorStop(0, '#f6d070'); lg.addColorStop(1, '#7a4a10'); ctx.fillStyle = lg;
  ctx.beginPath(); ctx.moveTo(x - 14 * s, y); ctx.quadraticCurveTo(x, y + 18 * s, x + 14 * s, y); ctx.closePath(); ctx.fill();
  ctx.fillStyle = `rgba(${rgb},0.95)`;
  ctx.beginPath(); ctx.moveTo(x, y - 20 * s * fl); ctx.quadraticCurveTo(x + 7 * s, y - 6 * s, x, y); ctx.quadraticCurveTo(x - 7 * s, y - 6 * s, x, y - 20 * s * fl); ctx.fill();
}

// Layered sea with moving crests. y = horizon of this band.
export function sea(ctx, { y, t = 0, scroll = 0, colors, crest = '255,220,170', bands = 5, bottom = H }) {
  for (let b = 0; b < bands; b++) {
    const by = y + ((bottom - y) * b * b) / (bands * bands) ;
    const amp = 5 + b * 5, wl = 70 + b * 50, sp = (0.3 + b * 0.25);
    ctx.fillStyle = colors[Math.min(b, colors.length - 1)];
    ctx.beginPath(); ctx.moveTo(0, bottom);
    for (let x = 0; x <= W + 20; x += 20) ctx.lineTo(x, by + Math.sin((x + scroll * sp) / wl + t * (0.8 + b * 0.2) + b * 2) * amp);
    ctx.lineTo(W + 20, bottom); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = `rgba(${crest},${0.10 + b * 0.04})`; ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = 0; x <= W + 20; x += 20) {
      const yy = by + Math.sin((x + scroll * sp) / wl + t * (0.8 + b * 0.2) + b * 2) * amp;
      if (x === 0) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }
}

// Drifting light motes. kind: 'ember' (rise), 'firefly' (wander), 'petal' (fall), 'dust' (slow drift).
export function motes(ctx, { n = 30, t = 0, rgb = '255,200,120', kind = 'dust', top = 0, bottom = H, rm = false, scroll = 0 }) {
  const count = rm ? Math.ceil(n / 3) : n;
  for (let i = 0; i < count; i++) {
    const a = hash(i * 9 + 1), b = hash(i * 9 + 2), c = hash(i * 9 + 3);
    let x, y;
    const span = bottom - top;
    if (kind === 'ember') { y = bottom - ((t * (40 + a * 90) + b * span) % span); x = a * W + Math.sin(t * (0.6 + c) + i) * 40; }
    else if (kind === 'petal') { y = top + ((t * (50 + a * 70) + b * span) % span); x = c * W + Math.sin(t * (0.8 + a) + i) * 60; }
    else if (kind === 'firefly') { x = a * W + Math.sin(t * (0.3 + b * 0.5) + i) * 90; y = top + b * span + Math.cos(t * (0.4 + c * 0.4) + i * 2) * 60; }
    else { x = a * W + t * (6 + c * 10); y = top + b * span + Math.sin(t * 0.3 + i) * 30; }
    x = (((x - scroll * (0.2 + c * 0.3)) % W) + W) % W;
    const tw = 0.5 + 0.5 * Math.sin(t * (1 + c * 3) + i * 1.7);
    const r = kind === 'petal' ? 5 : 1.6 + c * 2.4;
    ctx.fillStyle = `rgba(${rgb},${(0.25 + 0.6 * tw) * (kind === 'dust' ? 0.5 : 1)})`;
    ctx.beginPath();
    if (kind === 'petal') ctx.ellipse(x, y, r, r * 0.5, t * (1 + a) + i, 0, TAU); else ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
  }
}

// The cloth screen: a faint weave over everything, then the dark edges of the lamp's reach.
export function cloth(ctx) {
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(255,240,210,0.030)';
  ctx.beginPath();
  for (let y = 0; y < H; y += 7) { ctx.moveTo(0, y + 0.5); ctx.lineTo(W, y + 0.5); }
  ctx.stroke();
  ctx.strokeStyle = 'rgba(20,5,0,0.045)';
  ctx.beginPath();
  for (let x = 0; x < W; x += 7) { ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, H); }
  ctx.stroke();
}

export function vignette(ctx, strength = 0.72) {
  const g = ctx.createRadialGradient(W / 2, H * 0.48, H * 0.26, W / 2, H * 0.5, H * 0.72);
  g.addColorStop(0, 'rgba(8,2,6,0)');
  g.addColorStop(0.7, `rgba(8,2,6,${strength * 0.45})`);
  g.addColorStop(1, `rgba(8,2,6,${strength})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

export function finish(ctx, strength) { cloth(ctx); vignette(ctx, strength); }

// Soft contact shadow under a figure.
export function shadow(ctx, x, y, w, alpha = 0.35) {
  ctx.fillStyle = `rgba(0,0,0,${alpha})`;
  ctx.beginPath(); ctx.ellipse(x, y, w, w * 0.16, 0, 0, TAU); ctx.fill();
}

export function shakeOffset(t, amount, rm) {
  if (rm || amount <= 0) return [0, 0];
  return [Math.sin(t * 61) * amount, Math.cos(t * 47) * amount];
}

// Gold filigree border used on the title, cards and end screens.
export function filigree(ctx, x, y, w, h, alpha = 0.8) {
  ctx.save();
  ctx.strokeStyle = `rgba(242,196,106,${alpha})`;
  ctx.lineWidth = 2.5;
  rr(ctx, x, y, w, h, 18); ctx.stroke();
  ctx.lineWidth = 1.2;
  rr(ctx, x + 9, y + 9, w - 18, h - 18, 12); ctx.stroke();
  ctx.fillStyle = `rgba(242,196,106,${alpha})`;
  for (const [cx, cy] of [[x, y], [x + w, y], [x, y + h], [x + w, y + h]]) {
    ctx.beginPath(); ctx.moveTo(cx, cy - 12); ctx.lineTo(cx + 12, cy); ctx.lineTo(cx, cy + 12); ctx.lineTo(cx - 12, cy); ctx.closePath(); ctx.fill();
  }
  const n = Math.floor(w / 46);
  for (let i = 1; i < n; i++) {
    const px = x + (w * i) / n;
    for (const py of [y, y + h]) { ctx.beginPath(); ctx.arc(px, py, i % 2 ? 3 : 5, 0, TAU); ctx.fill(); }
  }
  ctx.restore();
}

export function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// Shafts of light fanning from a point (additive), for depth behind silhouettes. `dir` is the
// central angle in radians (Math.PI / 2 points straight down the screen).
export function rays(ctx, { x, y, dir = Math.PI / 2, n = 7, len = 1500, spread = 1.1, rgb = '255,200,120', alpha = 0.16, t = 0, rm = false }) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < n; i++) {
    const a = dir + (i / (n - 1) - 0.5) * spread + (rm ? 0 : Math.sin(t * 0.35 + i * 1.7) * 0.03);
    const w = 0.035 + 0.03 * hash(i * 7 + 1);
    const g = ctx.createLinearGradient(x, y, x + Math.cos(a) * len, y + Math.sin(a) * len);
    g.addColorStop(0, `rgba(${rgb},${alpha * (0.6 + 0.4 * hash(i * 3 + 2))})`); g.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a - w) * len, y + Math.sin(a - w) * len); ctx.lineTo(x + Math.cos(a + w) * len, y + Math.sin(a + w) * len); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}


// ---- painted, cached scenery (see scenery.js): same call signatures the chapters always used ----
export const sky = skyP;
export const ridge = ridgeP;
export const treeline = treeP;
export const skyline = skylineP;
export const clouds = cloudP;
export const banyan = banyanP;
export function hall(ctx, o) {
  hallP(ctx, o);
  if (o.lamps === false) return;
  const { scroll = 0, top = 0, gap = 240, t = 0, lampRgb = '255,200,120' } = o;
  strip(scroll, gap, (i, x) => {
    const lx = x + gap / 2, ly = top + 250 + hash(i) * 60, sw = Math.sin(t * 0.9 + i) * 6;
    ctx.strokeStyle = 'rgba(240,190,90,0.6)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(lx, top + 40); ctx.lineTo(lx + sw, ly); ctx.stroke();
    lamp(ctx, lx + sw, ly, 1, t + i, lampRgb, '#7a4a1a');
  });
}
