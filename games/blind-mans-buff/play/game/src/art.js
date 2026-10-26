// Blind Man's Buff: all painting that is not interface. A rococo garden party seen from above by candlelight: lit and shaded floors,
// furniture, hedges and a fountain; guests drawn from above and as front-view portraits. Pure canvas 2D, no DOM, no clock, no
// Math.random: everything depends only on its arguments (noise comes from `hash`).
import { ARENA } from './engine.js';

export const PAL = {
  ink: '#120f26', night: '#1c1838', plum: '#2e2147', rose: '#e58fab', roseDeep: '#b9486b', cream: '#fbf1dc', gold: '#e8c26a', goldDark: '#8f6a1c',
  powder: '#9cc3e6', sage: '#8fb08a', leaf: '#4d7a4a', leafDark: '#2b4d2c', candle: '#ffd9a0', text: '#fbf1dc', dim: 'rgba(251,241,220,0.66)',
  wood: '#8b5a35', woodDark: '#4a2c18', stone: '#d9d2c4', water: '#7ec3d8',
};
export const DISPLAY = '"Cormorant Garamond", Georgia, "Times New Roman", serif';
export const UI = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
export const TAU = Math.PI * 2;
export const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
// Deterministic noise in [0,1).
export const hash = (a, b = 0) => { let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const shade = (hex, f) => { const n = parseInt(hex.slice(1), 16); const c = (v) => clamp(Math.round(v * f), 0, 255); return `rgb(${c(n >> 16)},${c((n >> 8) & 255)},${c(n & 255)})`; };
const SKINS = ['#f6d9c0', '#eec19a', '#d49a72', '#9d6a46'];

// ---- cached backgrounds -----------------------------------------------------------------------------------------------------------------
const caches = new Map();
function cached(key, w, h, paint) {
  if (typeof OffscreenCanvas !== 'function') return null;
  let c = caches.get(key);
  if (c === undefined) {
    if (caches.size > 8) caches.clear();
    try { c = new OffscreenCanvas(Math.max(2, Math.round(w)), Math.max(2, Math.round(h))); paint(c.getContext('2d'), c.width, c.height); } catch { c = null; }
    caches.set(key, c);
  }
  return c;
}

// The floor of a venue at pixel size `px` (square). Light from the upper left.
function paintFloor(g, px, v) {
  const s = px / ARENA;
  g.save(); g.scale(s, s);
  if (v.floor === 'parquet') {
    const lg = g.createLinearGradient(0, 0, ARENA, ARENA); lg.addColorStop(0, '#b98a58'); lg.addColorStop(1, '#8e6238');
    g.fillStyle = lg; g.fillRect(0, 0, ARENA, ARENA);
    const T = 80;
    for (let y = 0; y < ARENA; y += T) for (let x = 0; x < ARENA; x += T) {
      const q = hash(x / T, y / T), dir = (x / T + y / T) % 2;
      g.fillStyle = `rgba(${q > 0.5 ? '255,226,170' : '60,30,10'},${0.1 + q * 0.12})`;
      if (dir) g.fillRect(x + 1, y + 1, T - 2, T - 2); else { g.fillRect(x + 1, y + 1, T - 2, T / 2 - 2); g.fillRect(x + 1, y + T / 2 + 1, T - 2, T / 2 - 2); }
      g.strokeStyle = 'rgba(40,20,8,0.28)'; g.lineWidth = 2; g.strokeRect(x, y, T, T);
    }
    // a rug
    g.fillStyle = 'rgba(112,40,62,0.88)'; g.beginPath(); g.roundRect(260, 260, 480, 480, 40); g.fill();
    g.strokeStyle = 'rgba(232,194,106,0.85)'; g.lineWidth = 8; g.beginPath(); g.roundRect(282, 282, 436, 436, 28); g.stroke();
    g.strokeStyle = 'rgba(232,194,106,0.4)'; g.lineWidth = 3; g.beginPath(); g.roundRect(310, 310, 380, 380, 20); g.stroke();
  } else if (v.floor === 'gravel') {
    const lg = g.createLinearGradient(0, 0, ARENA, ARENA); lg.addColorStop(0, '#9aa985'); lg.addColorStop(1, '#6f8465');
    g.fillStyle = lg; g.fillRect(0, 0, ARENA, ARENA);
    for (let i = 0; i < 700; i++) { const x = hash(i, 1) * ARENA, y = hash(i, 2) * ARENA; g.fillStyle = `rgba(${hash(i, 3) > 0.5 ? '30,60,30' : '210,230,170'},0.18)`; g.fillRect(x, y, 4 + hash(i, 4) * 6, 3); }
    // paths: a ring and a cross of pale gravel
    g.strokeStyle = '#d9cfae'; g.lineWidth = 120; g.beginPath(); g.arc(500, 500, 290, 0, TAU); g.stroke();
    g.lineWidth = 100; g.beginPath(); g.moveTo(500, 40); g.lineTo(500, 960); g.moveTo(40, 500); g.lineTo(960, 500); g.stroke();
    for (let i = 0; i < 1500; i++) { const x = hash(i, 5) * ARENA, y = hash(i, 6) * ARENA; g.fillStyle = `rgba(${hash(i, 7) > 0.5 ? '120,100,70' : '255,250,230'},0.22)`; g.fillRect(x, y, 3, 3); }
  } else if (v.floor === 'tiles') {
    const T = 100;
    for (let y = 0; y < ARENA; y += T) for (let x = 0; x < ARENA; x += T) {
      const dark = (x / T + y / T) % 2 === 0;
      g.fillStyle = dark ? '#3f7f84' : '#e7dcc0'; g.fillRect(x, y, T, T);
      const q = hash(x, y); g.fillStyle = `rgba(255,255,255,${0.04 + q * 0.07})`; g.fillRect(x, y, T, T / 2);
      g.strokeStyle = 'rgba(30,50,50,0.4)'; g.lineWidth = 2; g.strokeRect(x, y, T, T);
    }
  } else {
    const T = 125;
    for (let y = 0; y < ARENA; y += T) for (let x = 0; x < ARENA; x += T) {
      const dark = (x / T + y / T) % 2 === 0;
      g.fillStyle = dark ? '#2a2540' : '#e8e3ee'; g.fillRect(x, y, T, T);
      g.strokeStyle = dark ? 'rgba(255,255,255,0.16)' : 'rgba(80,60,110,0.22)'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(x + 20, y + T - 30); g.lineTo(x + T - 30, y + 20); g.stroke();
    }
    const sh = g.createRadialGradient(500, 500, 60, 500, 500, 620); sh.addColorStop(0, 'rgba(255,230,180,0.28)'); sh.addColorStop(1, 'rgba(255,230,180,0)');
    g.fillStyle = sh; g.fillRect(0, 0, ARENA, ARENA);
  }
  // candle pools of warm light and the soft edge of the walls
  const pools = [[200, 200], [800, 200], [200, 800], [800, 800]];
  for (const [x, y] of pools) { const p = g.createRadialGradient(x, y, 10, x, y, 300); p.addColorStop(0, 'rgba(255,214,150,0.26)'); p.addColorStop(1, 'rgba(255,214,150,0)'); g.fillStyle = p; g.fillRect(x - 300, y - 300, 600, 600); }
  const wall = g.createLinearGradient(0, 0, 0, ARENA);
  g.strokeStyle = 'rgba(20,10,30,0.55)'; g.lineWidth = 80; g.strokeRect(0, 0, ARENA, ARENA);
  g.strokeStyle = 'rgba(232,194,106,0.55)'; g.lineWidth = 5; g.strokeRect(38, 38, ARENA - 76, ARENA - 76);
  void wall;
  g.restore();
}

export function drawFloor(ctx, v, x, y, side) {
  const px = Math.round(side);
  const c = cached(`floor|${v.id}|${px}`, px, px, (g) => paintFloor(g, px, v));
  if (c) ctx.drawImage(c, x, y, side, side);
  else { ctx.fillStyle = '#8e6238'; ctx.fillRect(x, y, side, side); }
}

// ---- obstacles ---------------------------------------------------------------------------------------------------------------------------
function softShadow(ctx, x, y, w, h, rad, off = 8) {
  ctx.fillStyle = 'rgba(10,6,20,0.38)'; ctx.beginPath(); ctx.roundRect(x + off, y + off, w, h, rad); ctx.fill();
}
export function drawObstacle(ctx, o, t = 0) {
  ctx.save();
  if (o.k === 'r') {
    const { x, y, w, h } = o;
    if (o.art === 'sofa') {
      softShadow(ctx, x, y, w, h, 24);
      ctx.fillStyle = '#7e2f4b'; ctx.beginPath(); ctx.roundRect(x, y, w, h, 24); ctx.fill();
      ctx.fillStyle = '#a14566'; ctx.beginPath(); ctx.roundRect(x + 8, y + 8, w - 16, h - 16, 18); ctx.fill();
      ctx.strokeStyle = 'rgba(255,220,190,0.45)'; ctx.lineWidth = 2;
      for (let i = 1; i < 3; i++) { ctx.beginPath(); ctx.moveTo(x + (w * i) / 3, y + 10); ctx.lineTo(x + (w * i) / 3, y + h - 10); ctx.stroke(); }
      ctx.fillStyle = 'rgba(255,230,200,0.2)'; ctx.beginPath(); ctx.roundRect(x + 8, y + 8, w - 16, 18, 10); ctx.fill();
      ctx.strokeStyle = '#e8c26a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(x, y, w, h, 24); ctx.stroke();
    } else if (o.art === 'harpsichord') {
      softShadow(ctx, x, y, w, h, 18);
      ctx.fillStyle = '#2a1a14'; ctx.beginPath(); ctx.roundRect(x, y, w, h, 18); ctx.fill();
      const g = ctx.createLinearGradient(x, y, x + w, y + h); g.addColorStop(0, '#6b4226'); g.addColorStop(1, '#3a2012');
      ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(x + 6, y + 6, w - 12, h - 12, 14); ctx.fill();
      ctx.fillStyle = '#f4ecd8'; ctx.fillRect(x + 12, y + h - 36, w - 24, 26);
      ctx.fillStyle = '#1a1010'; for (let i = 1; i < 12; i++) if (i % 7 && i % 3) ctx.fillRect(x + 12 + (i * (w - 24)) / 12 - 3, y + h - 36, 6, 15);
      ctx.strokeStyle = '#e8c26a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(x + 6, y + 6, w - 12, h - 12, 14); ctx.stroke();
    } else if (o.art === 'hedge') {
      softShadow(ctx, x, y, w, h, 22, 7);
      const g = ctx.createLinearGradient(x, y, x, y + h); g.addColorStop(0, '#5e9a52'); g.addColorStop(1, '#2b5a2c');
      ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(x, y, w, h, 22); ctx.fill();
      for (let i = 0; i < Math.floor(w / 9); i++) { ctx.fillStyle = `rgba(${hash(i, x) > 0.5 ? '160,220,120' : '20,60,20'},0.35)`; ctx.beginPath(); ctx.arc(x + 8 + i * 9, y + 10 + hash(i, 3) * (h - 20), 6, 0, TAU); ctx.fill(); }
    } else if (o.art === 'bench') {
      softShadow(ctx, x, y, w, h, 12, 6);
      ctx.fillStyle = '#6d4a2a'; ctx.beginPath(); ctx.roundRect(x, y, w, h, 12); ctx.fill();
      ctx.strokeStyle = 'rgba(255,220,170,0.35)'; ctx.lineWidth = 2; for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(x + 5, y + (h * i) / 4); ctx.lineTo(x + w - 5, y + (h * i) / 4); ctx.stroke(); }
    } else if (o.art === 'planters') {
      softShadow(ctx, x, y, w, h, 14, 8);
      ctx.fillStyle = '#b5683c'; ctx.beginPath(); ctx.roundRect(x, y, w, h, 14); ctx.fill();
      ctx.fillStyle = '#7b4222'; ctx.beginPath(); ctx.roundRect(x + 4, y + 4, w - 8, h - 8, 10); ctx.fill();
      const n = Math.floor(w / 62);
      for (let i = 0; i < n; i++) {
        const cx = x + (w / n) * (i + 0.5), cy = y + h / 2;
        const g = ctx.createRadialGradient(cx - 6, cy - 8, 4, cx, cy, 34); g.addColorStop(0, '#8fd06c'); g.addColorStop(1, '#2f6a30');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, 31 + (i % 2) * 2, 0, TAU); ctx.fill();
        ctx.fillStyle = '#ffb038'; for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.arc(cx + Math.cos(k * 2.1 + i) * 15, cy + Math.sin(k * 2.1 + i) * 15, 6, 0, TAU); ctx.fill(); }
      }
    } else if (o.art === 'stage') {
      softShadow(ctx, x, y, w, h, 10, 8);
      ctx.fillStyle = '#5a3a24'; ctx.fillRect(x, y, w, h);
      ctx.fillStyle = '#7a1f3a'; ctx.fillRect(x, y, w, 26);
      for (let i = 0; i < 9; i++) { ctx.fillStyle = i % 2 ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.12)'; ctx.fillRect(x + (i * w) / 9, y, w / 9, 26); }
      ctx.fillStyle = 'rgba(255,220,160,0.25)'; ctx.fillRect(x + 6, y + 32, w - 12, h - 40);
      ctx.strokeStyle = '#e8c26a'; ctx.lineWidth = 4; ctx.strokeRect(x, y, w, h);
    } else { ctx.fillStyle = '#6d5a4a'; ctx.fillRect(x, y, w, h); }
  } else {
    const { x, y, r } = o;
    if (o.art === 'fountain') {
      ctx.fillStyle = 'rgba(10,6,20,0.34)'; ctx.beginPath(); ctx.arc(x + 9, y + 9, r, 0, TAU); ctx.fill();
      ctx.fillStyle = '#e0d9c8'; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
      ctx.fillStyle = '#a99f8c'; ctx.beginPath(); ctx.arc(x, y, Math.max(0, r - 10), 0, TAU); ctx.fill();
      const wg = ctx.createRadialGradient(x - 20, y - 20, 6, x, y, Math.max(0, r - 14)); wg.addColorStop(0, '#bff0ff'); wg.addColorStop(1, '#4f9db8');
      ctx.fillStyle = wg; ctx.beginPath(); ctx.arc(x, y, Math.max(0, r - 14), 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(x, y, 30 + i * 22 + ((t * 14 + i * 9) % 22), 0, TAU); ctx.globalAlpha = 0.5 - i * 0.12; ctx.stroke(); }
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#e8e2d0'; ctx.beginPath(); ctx.arc(x, y, 22, 0, TAU); ctx.fill(); ctx.fillStyle = '#c9c1ac'; ctx.beginPath(); ctx.arc(x, y, 12, 0, TAU); ctx.fill();
    } else if (o.art === 'tree') {
      ctx.fillStyle = 'rgba(10,6,20,0.3)'; ctx.beginPath(); ctx.arc(x + 8, y + 9, r, 0, TAU); ctx.fill();
      ctx.fillStyle = '#b5683c'; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
      const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 4, x, y, r * 0.9); g.addColorStop(0, '#9be070'); g.addColorStop(1, '#2d6a2f');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 0.82, 0, TAU); ctx.fill();
      ctx.fillStyle = '#ffa938'; for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.arc(x + Math.cos(k * 1.7 + x) * r * 0.45, y + Math.sin(k * 1.7 + x) * r * 0.45, 5, 0, TAU); ctx.fill(); }
    } else if (o.art === 'column') {
      ctx.fillStyle = 'rgba(10,6,20,0.4)'; ctx.beginPath(); ctx.arc(x + 9, y + 9, r, 0, TAU); ctx.fill();
      const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, 3, x, y, r); g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#a89fb8');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#e8c26a'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(x, y, Math.max(0, r - 5), 0, TAU); ctx.stroke();
      ctx.strokeStyle = 'rgba(80,60,110,0.35)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, r * 0.5, 0, TAU); ctx.stroke();
    } else if (o.art === 'table') {
      ctx.fillStyle = 'rgba(10,6,20,0.36)'; ctx.beginPath(); ctx.arc(x + 9, y + 9, r, 0, TAU); ctx.fill();
      const g = ctx.createRadialGradient(x - 20, y - 20, 4, x, y, r); g.addColorStop(0, '#fff8e8'); g.addColorStop(1, '#d4c3a0');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#e8c26a'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(x, y, Math.max(0, r - 8), 0, TAU); ctx.stroke();
      ctx.fillStyle = '#e8c26a'; ctx.beginPath(); ctx.arc(x, y, 14, 0, TAU); ctx.fill();
      ctx.fillStyle = '#ffd27a'; ctx.beginPath(); ctx.arc(x, y - 6, 7, 0, TAU); ctx.fill();
      for (let k = 0; k < 4; k++) { const a = k * (TAU / 4) + 0.6; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x + Math.cos(a) * (r - 24), y + Math.sin(a) * (r - 24), 7, 0, TAU); ctx.fill(); ctx.strokeStyle = '#c8a860'; ctx.lineWidth = 2; ctx.stroke(); }
    } else { // urn
      ctx.fillStyle = 'rgba(10,6,20,0.34)'; ctx.beginPath(); ctx.arc(x + 7, y + 8, r, 0, TAU); ctx.fill();
      const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 2, x, y, r); g.addColorStop(0, '#9ec8d8'); g.addColorStop(1, '#3e6f8a');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#e8c26a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, Math.max(0, r - 6), 0, TAU); ctx.stroke();
      ctx.fillStyle = '#3a8a3a'; for (let k = 0; k < 5; k++) { ctx.beginPath(); ctx.arc(x + Math.cos(k * 1.26) * 9, y + Math.sin(k * 1.26) * 9, 8, 0, TAU); ctx.fill(); }
    }
  }
  ctx.restore();
}

// ---- guests from above ----------------------------------------------------------------------------------------------------------------
// r = roster entry. (x, y) centre; s = body radius in drawing units. a = facing angle.
export function drawFigure(ctx, r, x, y, s, a, o = {}) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(a);
  const alpha = o.alpha ?? 1, skin = SKINS[r.skin] ?? SKINS[0];
  ctx.globalAlpha = alpha;
  if (!o.noShadow) { ctx.fillStyle = 'rgba(10,6,20,0.32)'; ctx.beginPath(); ctx.ellipse(s * 0.18, s * 0.22, s * 0.9, s * 1.15, 0, 0, TAU); ctx.fill(); }
  const sway = o.sway ?? 0;
  // arms (hands forward when walking)
  ctx.fillStyle = shade(r.outfit, 0.82);
  ctx.beginPath(); ctx.ellipse(s * (0.25 + sway * 0.2), -s * 0.86, s * 0.34, s * 0.2, 0.3, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.ellipse(s * (0.25 - sway * 0.2), s * 0.86, s * 0.34, s * 0.2, -0.3, 0, TAU); ctx.fill();
  // body: shoulders as an ellipse with a trimmed collar
  const bg = ctx.createLinearGradient(0, -s, 0, s); bg.addColorStop(0, shade(r.outfit, 1.12)); bg.addColorStop(1, shade(r.outfit, 0.78));
  ctx.fillStyle = bg; ctx.beginPath(); ctx.ellipse(0, 0, s * 0.62, s * 1.0, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = r.trim; ctx.lineWidth = Math.max(1.5, s * 0.1); ctx.beginPath(); ctx.ellipse(0, 0, s * 0.62, s * 1.0, 0, 0, TAU); ctx.stroke();
  // trinket seen from above
  if (r.trinket === 'scarf') { ctx.fillStyle = '#f0e0b8'; ctx.beginPath(); ctx.ellipse(s * 0.1, 0, s * 0.34, s * 0.54, 0, 0, TAU); ctx.fill(); }
  else if (r.trinket === 'pearls') { ctx.fillStyle = '#fff'; for (let k = 0; k < 7; k++) { const t = -1.2 + k * 0.4; ctx.beginPath(); ctx.arc(s * 0.28 + Math.cos(t) * s * 0.3, Math.sin(t) * s * 0.52, s * 0.08, 0, TAU); ctx.fill(); } }
  else if (r.trinket === 'rose') { ctx.fillStyle = '#d83a52'; ctx.beginPath(); ctx.arc(s * 0.38, s * 0.3, s * 0.15, 0, TAU); ctx.fill(); }
  else if (r.trinket === 'fan') { ctx.fillStyle = '#fff4c8'; ctx.beginPath(); ctx.moveTo(s * 0.5, s * 0.74); ctx.arc(s * 0.5, s * 0.74, s * 0.55, -1.2, -0.1); ctx.closePath(); ctx.fill(); ctx.strokeStyle = '#c8553d'; ctx.lineWidth = 1.5; ctx.stroke(); }
  else if (r.trinket === 'spectacles') { ctx.strokeStyle = '#2a2230'; ctx.lineWidth = Math.max(1.3, s * 0.06); ctx.beginPath(); ctx.arc(s * 0.72, -s * 0.2, s * 0.16, 0, TAU); ctx.moveTo(s * 0.72 + s * 0.32, s * 0.2); ctx.arc(s * 0.72, s * 0.2, s * 0.16, 0, TAU); ctx.stroke(); }
  // head
  const hr = s * 0.5;
  ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(s * 0.1, 0, hr, 0, TAU); ctx.fill();
  // headwear from above
  if (r.head === 'tricorn') {
    ctx.fillStyle = '#25202c'; ctx.beginPath(); ctx.moveTo(s * 0.1 + hr * 1.2, 0); ctx.lineTo(s * 0.1 - hr * 0.7, -hr * 1.15); ctx.lineTo(s * 0.1 - hr * 0.7, hr * 1.15); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#e8c26a'; ctx.lineWidth = Math.max(1.5, s * 0.07); ctx.stroke();
  } else if (r.head === 'plume') {
    ctx.fillStyle = '#c9a36a'; ctx.beginPath(); ctx.arc(s * 0.1, 0, hr * 1.35, 0, TAU); ctx.fill(); ctx.fillStyle = shade(r.outfit, 0.9); ctx.beginPath(); ctx.arc(s * 0.1, 0, hr * 0.8, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#fffaf0'; ctx.lineWidth = Math.max(2, s * 0.14); ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(s * 0.1 - hr * 0.2, -hr * 0.2); ctx.quadraticCurveTo(-s * 0.7, -hr * 1.1, -s * 1.2, -hr * 0.2); ctx.stroke();
  } else if (r.head === 'bonnet') {
    ctx.fillStyle = '#fbf3e6'; ctx.beginPath(); ctx.arc(s * 0.1, 0, hr * 1.12, 0, TAU); ctx.fill();
    ctx.strokeStyle = r.outfit; ctx.lineWidth = Math.max(1.5, s * 0.1); ctx.beginPath(); ctx.arc(s * 0.1, 0, hr * 1.12, 0.6, TAU - 0.6); ctx.stroke();
  } else if (r.head === 'wig') {
    ctx.fillStyle = '#f2ece0';
    for (let k = 0; k < 7; k++) { const t = (k / 7) * TAU; ctx.beginPath(); ctx.arc(s * 0.1 + Math.cos(t) * hr * 0.8, Math.sin(t) * hr * 0.8, hr * 0.55, 0, TAU); ctx.fill(); }
    ctx.beginPath(); ctx.arc(s * 0.1, 0, hr * 0.9, 0, TAU); ctx.fill();
  } else { // ribbon
    ctx.fillStyle = r.hair; ctx.beginPath(); ctx.arc(s * 0.05, 0, hr * 1.05, 0.5, TAU - 0.5); ctx.fill();
    ctx.fillStyle = '#e24a6a'; ctx.beginPath(); ctx.ellipse(-hr * 0.7, -hr * 0.5, hr * 0.5, hr * 0.26, -0.5, 0, TAU); ctx.ellipse(-hr * 0.7, hr * 0.5, hr * 0.5, hr * 0.26, 0.5, 0, TAU); ctx.fill();
  }
  if (r.trinket === 'spectacles') { ctx.strokeStyle = '#2a2230'; ctx.lineWidth = Math.max(1.3, s * 0.07); ctx.beginPath(); ctx.arc(s * 0.62, -hr * 0.35, hr * 0.28, 0, TAU); ctx.arc(s * 0.62, hr * 0.35, hr * 0.28, 0, TAU); ctx.stroke(); }
  ctx.restore();
}

// The blindfolded seeker, from above: dark-red coat, white blindfold, arms out when reaching (reach in 0..1, how far the sweep is).
export function drawSeeker(ctx, x, y, s, a, o = {}) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(a);
  ctx.fillStyle = 'rgba(10,6,20,0.34)'; ctx.beginPath(); ctx.ellipse(s * 0.18, s * 0.22, s * 0.95, s * 1.2, 0, 0, TAU); ctx.fill();
  const reach = o.reach ?? 0, ext = o.out ?? 0.3;       // ext 0.3 = arms half raised, 1 = fully out
  const sw = Math.sin((o.gait ?? 0)) * 0.3;
  ctx.lineCap = 'round';
  for (const sgn of [-1, 1]) {
    const ang = sgn * (0.45 + (1 - ext) * 0.5) * (1 - reach * 0.75) + sw * sgn * 0.3;
    const L = s * (0.9 + ext * 1.2 + reach * 0.4);
    ctx.strokeStyle = '#7c2a3e'; ctx.lineWidth = s * 0.42;
    ctx.beginPath(); ctx.moveTo(s * 0.1, sgn * s * 0.5); ctx.lineTo(s * 0.1 + Math.cos(ang) * L, sgn * s * 0.5 + Math.sin(ang) * L * (sgn > 0 ? 1 : 1)); ctx.stroke();
    ctx.fillStyle = '#eec19a'; ctx.beginPath(); ctx.arc(s * 0.1 + Math.cos(ang) * (L + s * 0.12), sgn * s * 0.5 + Math.sin(ang) * (L + s * 0.12), s * 0.26, 0, TAU); ctx.fill();
  }
  const bg = ctx.createLinearGradient(0, -s, 0, s); bg.addColorStop(0, '#a63c58'); bg.addColorStop(1, '#6a2238');
  ctx.fillStyle = bg; ctx.beginPath(); ctx.ellipse(0, 0, s * 0.64, s * 1.02, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#e8c26a'; ctx.lineWidth = Math.max(1.5, s * 0.1); ctx.beginPath(); ctx.ellipse(0, 0, s * 0.64, s * 1.02, 0, 0, TAU); ctx.stroke();
  ctx.fillStyle = '#eec19a'; ctx.beginPath(); ctx.arc(s * 0.12, 0, s * 0.5, 0, TAU); ctx.fill();
  ctx.fillStyle = '#2b2530'; ctx.beginPath(); ctx.arc(s * 0.12, 0, s * 0.5, 0, TAU); ctx.fill();
  ctx.fillStyle = '#eec19a'; ctx.beginPath(); ctx.arc(s * 0.02, 0, s * 0.38, 0, TAU); ctx.fill();   // back of the head: hair side
  ctx.fillStyle = '#6a3a1e'; ctx.beginPath(); ctx.arc(-s * 0.04, 0, s * 0.42, 0, TAU); ctx.fill();
  // the white blindfold band across the eyes (forward of the crown)
  ctx.fillStyle = '#fbf6ea'; ctx.beginPath(); ctx.roundRect(s * 0.22, -s * 0.52, s * 0.3, s * 1.04, s * 0.12); ctx.fill();
  ctx.fillStyle = '#e8c26a'; ctx.beginPath(); ctx.arc(-s * 0.3, s * 0.32, s * 0.12, 0, TAU); ctx.fill();   // the knot at the back
  ctx.restore();
}

// ---- front portraits -----------------------------------------------------------------------------------------------------------------
// A bust in a rounded frame. (cx, cy) centre of the frame, s = frame size. o: { dim, selected, ring }.
export function drawPortrait(ctx, r, cx, cy, s, o = {}) {
  ctx.save();
  ctx.translate(cx, cy);
  const half = s / 2, dim = o.dim ?? 0;
  ctx.beginPath(); ctx.roundRect(-half, -half, s, s, s * 0.14); ctx.clip();
  // backdrop: a garden-party tapestry tone
  const bg = ctx.createLinearGradient(0, -half, 0, half); bg.addColorStop(0, '#46557d'); bg.addColorStop(1, '#2a2547');
  ctx.fillStyle = bg; ctx.fillRect(-half, -half, s, s);
  const gl = ctx.createRadialGradient(0, -s * 0.1, s * 0.05, 0, -s * 0.1, s * 0.7); gl.addColorStop(0, 'rgba(255,214,150,0.35)'); gl.addColorStop(1, 'rgba(255,214,150,0)');
  ctx.fillStyle = gl; ctx.fillRect(-half, -half, s, s);
  const u = s / 100;
  const skin = SKINS[r.skin] ?? SKINS[0], skinD = shade(skin, 0.86);
  const bust = globalThis.__people3d && globalThis.__people3d.bust && !globalThis.__people3d.pending ? globalThis.__people3d.bust(r) : null;
  if (bust) {
    ctx.drawImage(bust, -half, -half, s, s);
    // what the picture cannot hold in 3D: the fan, the rose and the scarf ends, painted over the bust as in the clues
    if (r.trinket === 'rose') { ctx.fillStyle = '#d83a52'; ctx.beginPath(); ctx.arc(-24 * u, 40 * u, 7 * u, 0, TAU); ctx.fill(); ctx.fillStyle = '#f26a7f'; ctx.beginPath(); ctx.arc(-26 * u, 38 * u, 3.5 * u, 0, TAU); ctx.fill(); ctx.fillStyle = '#3a8a3a'; ctx.beginPath(); ctx.ellipse(-16 * u, 46 * u, 7 * u, 3 * u, 0.5, 0, TAU); ctx.fill(); }
    else if (r.trinket === 'fan') {
      ctx.fillStyle = '#fff1c4'; ctx.beginPath(); ctx.moveTo(30 * u, 52 * u); ctx.arc(30 * u, 52 * u, 30 * u, -2.5, -0.65); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#c8553d'; ctx.lineWidth = 1.4 * u; for (let k = 0; k < 6; k++) { const a = -2.5 + k * (1.85 / 5); ctx.beginPath(); ctx.moveTo(30 * u, 52 * u); ctx.lineTo(30 * u + Math.cos(a) * 30 * u, 52 * u + Math.sin(a) * 30 * u); ctx.stroke(); }
    } else if (r.trinket === 'scarf') { ctx.fillStyle = '#c8553d'; ctx.beginPath(); ctx.roundRect(6 * u, 30 * u, 9 * u, 22 * u, 4 * u); ctx.fill(); }
    if (dim > 0) { ctx.fillStyle = `rgba(14,10,30,${dim})`; ctx.fillRect(-half, -half, s, s); }
    ctx.restore();
    if (o.ring) { ctx.save(); ctx.strokeStyle = o.ring; ctx.lineWidth = Math.max(3, s * 0.05); ctx.beginPath(); ctx.roundRect(cx - half, cy - half, s, s, s * 0.14); ctx.stroke(); ctx.restore(); }
    return;
  }
  // hair behind
  if (r.head === 'wig') { ctx.fillStyle = '#efe9dc'; ctx.beginPath(); ctx.ellipse(0, -8 * u, 33 * u, 34 * u, 0, 0, TAU); ctx.fill(); for (const sx of [-1, 1]) { ctx.beginPath(); ctx.arc(sx * 28 * u, 14 * u, 10 * u, 0, TAU); ctx.arc(sx * 30 * u, 28 * u, 8 * u, 0, TAU); ctx.fill(); } }
  else if (r.head !== 'tricorn') { ctx.fillStyle = r.hair; ctx.beginPath(); ctx.ellipse(0, -4 * u, 27 * u, 29 * u, 0, 0, TAU); ctx.fill(); }
  // shoulders and collar
  const sg = ctx.createLinearGradient(0, 28 * u, 0, 56 * u); sg.addColorStop(0, shade(r.outfit, 1.1)); sg.addColorStop(1, shade(r.outfit, 0.7));
  ctx.fillStyle = sg; ctx.beginPath(); ctx.moveTo(-50 * u, 54 * u); ctx.quadraticCurveTo(-46 * u, 28 * u, -16 * u, 26 * u); ctx.lineTo(16 * u, 26 * u); ctx.quadraticCurveTo(46 * u, 28 * u, 50 * u, 54 * u); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = r.trim; ctx.lineWidth = 2.5 * u; ctx.beginPath(); ctx.moveTo(-18 * u, 26 * u); ctx.quadraticCurveTo(0, 42 * u, 18 * u, 26 * u); ctx.stroke();
  // neck, face
  ctx.fillStyle = skinD; ctx.fillRect(-8 * u, 14 * u, 16 * u, 16 * u);
  const fg = ctx.createRadialGradient(-8 * u, -8 * u, 4 * u, 0, 0, 30 * u); fg.addColorStop(0, shade(skin, 1.06)); fg.addColorStop(1, skinD);
  ctx.fillStyle = fg; ctx.beginPath(); ctx.ellipse(0, 0, 22 * u, 26 * u, 0, 0, TAU); ctx.fill();
  // face details
  ctx.fillStyle = '#2b2028'; ctx.beginPath(); ctx.ellipse(-8.5 * u, -3 * u, 2.3 * u, 3 * u, 0, 0, TAU); ctx.ellipse(8.5 * u, -3 * u, 2.3 * u, 3 * u, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = shade(r.hair, 0.9); ctx.lineWidth = 1.6 * u; ctx.beginPath(); ctx.moveTo(-13 * u, -9 * u); ctx.lineTo(-5 * u, -10 * u); ctx.moveTo(5 * u, -10 * u); ctx.lineTo(13 * u, -9 * u); ctx.stroke();
  ctx.fillStyle = 'rgba(230,90,110,0.35)'; ctx.beginPath(); ctx.arc(-14 * u, 6 * u, 4.5 * u, 0, TAU); ctx.arc(14 * u, 6 * u, 4.5 * u, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#a8453f'; ctx.lineWidth = 2 * u; ctx.beginPath(); ctx.arc(0, 8 * u, 6 * u, 0.25, Math.PI - 0.25); ctx.stroke();
  // headwear
  if (r.head === 'tricorn') {
    ctx.fillStyle = '#1f1a26'; ctx.beginPath(); ctx.moveTo(-36 * u, -12 * u); ctx.lineTo(0, -44 * u); ctx.lineTo(36 * u, -12 * u); ctx.quadraticCurveTo(0, -20 * u, -36 * u, -12 * u); ctx.fill();
    ctx.strokeStyle = '#e8c26a'; ctx.lineWidth = 2.6 * u; ctx.stroke();
    ctx.fillStyle = r.hair; ctx.beginPath(); ctx.ellipse(-22 * u, 4 * u, 5 * u, 11 * u, 0, 0, TAU); ctx.ellipse(22 * u, 4 * u, 5 * u, 11 * u, 0, 0, TAU); ctx.fill();
  } else if (r.head === 'plume') {
    ctx.fillStyle = '#c9a36a'; ctx.beginPath(); ctx.ellipse(0, -17 * u, 40 * u, 11 * u, -0.05, 0, TAU); ctx.fill();
    ctx.fillStyle = shade(r.outfit, 0.95); ctx.beginPath(); ctx.ellipse(0, -24 * u, 22 * u, 15 * u, 0, Math.PI, TAU); ctx.fill();
    ctx.strokeStyle = '#fffaf0'; ctx.lineWidth = 5 * u; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(10 * u, -30 * u); ctx.quadraticCurveTo(46 * u, -50 * u, 44 * u, -4 * u); ctx.stroke();
    ctx.strokeStyle = '#e24a6a'; ctx.lineWidth = 1.6 * u; ctx.beginPath(); ctx.moveTo(10 * u, -30 * u); ctx.quadraticCurveTo(46 * u, -50 * u, 44 * u, -4 * u); ctx.stroke();
  } else if (r.head === 'bonnet') {
    ctx.fillStyle = '#fbf3e6'; ctx.beginPath(); ctx.ellipse(0, -10 * u, 29 * u, 27 * u, 0, Math.PI * 0.85, Math.PI * 2.15); ctx.fill();
    ctx.strokeStyle = r.outfit; ctx.lineWidth = 3 * u; ctx.beginPath(); ctx.ellipse(0, -10 * u, 29 * u, 27 * u, 0, Math.PI * 0.85, Math.PI * 2.15); ctx.stroke();
    ctx.fillStyle = r.outfit; ctx.beginPath(); ctx.moveTo(-6 * u, 24 * u); ctx.lineTo(0, 30 * u); ctx.lineTo(6 * u, 24 * u); ctx.lineTo(0, 34 * u); ctx.fill();
    ctx.strokeStyle = '#fbf3e6'; ctx.lineWidth = 2 * u; ctx.beginPath(); ctx.moveTo(-24 * u, 8 * u); ctx.lineTo(-6 * u, 25 * u); ctx.moveTo(24 * u, 8 * u); ctx.lineTo(6 * u, 25 * u); ctx.stroke();
  } else if (r.head === 'wig') {
    ctx.fillStyle = '#f6f0e4'; for (let k = 0; k < 6; k++) { ctx.beginPath(); ctx.arc(-25 * u + k * 10 * u, -18 * u - Math.sin((k / 5) * Math.PI) * 14 * u, 11 * u, 0, TAU); ctx.fill(); }
    ctx.beginPath(); ctx.ellipse(0, -22 * u, 26 * u, 14 * u, 0, 0, TAU); ctx.fill();
  } else { // ribbon
    ctx.fillStyle = r.hair; ctx.beginPath(); ctx.ellipse(0, -16 * u, 26 * u, 14 * u, 0, Math.PI, TAU); ctx.fill();
    ctx.fillStyle = '#e24a6a'; ctx.beginPath(); ctx.ellipse(-12 * u, -30 * u, 12 * u, 7 * u, -0.5, 0, TAU); ctx.ellipse(12 * u, -30 * u, 12 * u, 7 * u, 0.5, 0, TAU); ctx.fill();
    ctx.fillStyle = '#b8304d'; ctx.beginPath(); ctx.arc(0, -29 * u, 4.5 * u, 0, TAU); ctx.fill();
  }
  // trinkets
  if (r.trinket === 'pearls') { ctx.fillStyle = '#fffdf6'; for (let k = 0; k < 9; k++) { const t = 0.35 + (k / 8) * (Math.PI - 0.7); ctx.beginPath(); ctx.arc(Math.cos(t) * -19 * u, 27 * u + Math.sin(t) * 9 * u, 3.1 * u, 0, TAU); ctx.fill(); } }
  else if (r.trinket === 'scarf') { ctx.fillStyle = '#f0e0b8'; ctx.beginPath(); ctx.roundRect(-17 * u, 20 * u, 34 * u, 11 * u, 5 * u); ctx.fill(); ctx.fillStyle = '#c8553d'; ctx.beginPath(); ctx.roundRect(6 * u, 26 * u, 9 * u, 22 * u, 4 * u); ctx.fill(); }
  else if (r.trinket === 'rose') { ctx.fillStyle = '#d83a52'; ctx.beginPath(); ctx.arc(-24 * u, 40 * u, 7 * u, 0, TAU); ctx.fill(); ctx.fillStyle = '#f26a7f'; ctx.beginPath(); ctx.arc(-26 * u, 38 * u, 3.5 * u, 0, TAU); ctx.fill(); ctx.fillStyle = '#3a8a3a'; ctx.beginPath(); ctx.ellipse(-16 * u, 46 * u, 7 * u, 3 * u, 0.5, 0, TAU); ctx.fill(); }
  else if (r.trinket === 'fan') {
    ctx.fillStyle = '#fff1c4'; ctx.beginPath(); ctx.moveTo(30 * u, 52 * u); ctx.arc(30 * u, 52 * u, 30 * u, -2.5, -0.65); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#c8553d'; ctx.lineWidth = 1.4 * u; for (let k = 0; k < 6; k++) { const a = -2.5 + k * (1.85 / 5); ctx.beginPath(); ctx.moveTo(30 * u, 52 * u); ctx.lineTo(30 * u + Math.cos(a) * 30 * u, 52 * u + Math.sin(a) * 30 * u); ctx.stroke(); }
  } else if (r.trinket === 'spectacles') {
    ctx.strokeStyle = '#2a2230'; ctx.lineWidth = 1.8 * u; ctx.beginPath(); ctx.arc(-8.5 * u, -3 * u, 7 * u, 0, TAU); ctx.moveTo(15.5 * u, -3 * u); ctx.arc(8.5 * u, -3 * u, 7 * u, 0, TAU); ctx.moveTo(-1.5 * u, -3 * u); ctx.lineTo(1.5 * u, -3 * u); ctx.stroke();
  }
  if (dim > 0) { ctx.fillStyle = `rgba(14,10,30,${dim})`; ctx.fillRect(-half, -half, s, s); }
  ctx.restore();
  if (o.ring) { ctx.save(); ctx.strokeStyle = o.ring; ctx.lineWidth = Math.max(3, s * 0.05); ctx.beginPath(); ctx.roundRect(cx - half, cy - half, s, s, s * 0.14); ctx.stroke(); ctx.restore(); }
}

// The unknown held guest: a dark outline shape in the seeker's hands with a question mark.
export function drawSilhouette(ctx, cx, cy, s, t = 0) {
  ctx.save(); ctx.translate(cx, cy);
  const u = s / 100, wob = Math.sin(t * 5) * 1.2 * u;
  ctx.fillStyle = '#0d0a1c'; ctx.beginPath(); ctx.ellipse(wob, -6 * u, 24 * u, 28 * u, 0, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-50 * u, 58 * u); ctx.quadraticCurveTo(-46 * u, 28 * u, -16 * u, 26 * u); ctx.lineTo(16 * u, 26 * u); ctx.quadraticCurveTo(46 * u, 28 * u, 50 * u, 58 * u); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(232,194,106,0.7)'; ctx.lineWidth = 2.5 * u; ctx.setLineDash([6 * u, 6 * u]); ctx.beginPath(); ctx.ellipse(wob, -6 * u, 24 * u, 28 * u, 0, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = PAL.gold; ctx.font = `700 ${34 * u}px ${DISPLAY}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('?', wob, -6 * u);
  ctx.restore();
}

// A quill feather for ratings. (x, y) centre, size = length.
export function drawFeather(ctx, x, y, size, filled, a = -0.6) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(a);
  const L = size / 2, W = size * 0.2;
  ctx.beginPath(); ctx.moveTo(0, L); ctx.bezierCurveTo(W * 1.5, L * 0.3, W * 1.6, -L * 0.6, 0, -L); ctx.bezierCurveTo(-W * 1.6, -L * 0.6, -W * 1.5, L * 0.3, 0, L); ctx.closePath();
  if (filled) { const g = ctx.createLinearGradient(-W, 0, W, 0); g.addColorStop(0, '#fff6dc'); g.addColorStop(0.5, '#e8c26a'); g.addColorStop(1, '#b98a2a'); ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = '#7a5410'; ctx.lineWidth = 2; ctx.stroke(); }
  else { ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fill(); ctx.strokeStyle = 'rgba(251,241,220,0.4)'; ctx.lineWidth = 2; ctx.stroke(); }
  ctx.strokeStyle = filled ? '#7a5410' : 'rgba(251,241,220,0.4)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, L * 1.1); ctx.lineTo(0, -L * 0.7); ctx.stroke();
  ctx.restore();
}

// ---- sound ripples and ear marks ------------------------------------------------------------------------------------------------------
const KIND_COL = { clap: '#fbf1dc', giggle: '#f6a0bc', step: '#a8d0f0', call: '#e8c26a', taunt: '#ffd27a' };
export function drawRipple(ctx, e, S, o = {}) {
  const life = e.kind === 'step' ? 0.9 : 1.7;
  if (e.age > life + 0.1) return;
  const k = e.age / life, col = KIND_COL[e.kind] ?? '#fff';
  const maxR = (e.kind === 'step' ? 80 : e.kind === 'call' ? 330 : 190) * S;
  ctx.save();
  for (let i = 0; i < 2; i++) {
    const kk = clamp(k - i * 0.18, 0, 1); if (kk <= 0) continue;
    ctx.strokeStyle = rgba(col, (1 - kk) * 0.85); ctx.lineWidth = Math.max(1.5, (5 - 3 * kk) * S * 2.2);
    ctx.beginPath(); ctx.arc(e.x * S, e.y * S, kk * maxR + 6 * S, 0, TAU); ctx.stroke();
  }
  ctx.restore();
  void o;
}
export function drawEarMark(ctx, m, S, bright = 1) {
  const f = clamp(1 - Math.pow(m.age / 8, 1.4), 0, 1);
  if (f <= 0) return;
  const col = KIND_COL[m.kind] ?? '#fff';
  ctx.save();
  ctx.strokeStyle = rgba(col, 0.55 * f * bright); ctx.lineWidth = Math.max(1.5, 2.4 * S * 2); ctx.setLineDash([8 * S * 2, 7 * S * 2]);
  ctx.beginPath(); ctx.arc(m.x * S, m.y * S, m.unc * S, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = rgba(col, 0.85 * f * bright); ctx.beginPath(); ctx.arc(m.x * S, m.y * S, Math.max(3, 8 * S), 0, TAU); ctx.fill();
  ctx.restore();
}

// ---- particles --------------------------------------------------------------------------------------------------------------------------
export function burst(list, rng, x, y, n, color, power = 1) {
  for (let i = 0; i < n; i++) {
    const a = rng.range(0, TAU), v = rng.range(60, 260) * power;
    list.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, life: rng.range(0.5, 1.1), t: 0, c: color, r: rng.range(2, 5) });
  }
  if (list.length > 160) list.splice(0, list.length - 160);
}
export function stepParticles(list, dt) {
  for (const p of list) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 260 * dt; p.vx *= 0.985; }
  for (let i = list.length - 1; i >= 0; i--) if (list[i].t >= list[i].life) list.splice(i, 1);
}
export function drawParticles(ctx, list) {
  for (const p of list) {
    const k = 1 - p.t / p.life; ctx.fillStyle = rgba(p.c, k); ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (0.5 + k), 0, TAU); ctx.fill();
  }
}

// A plain dusk backdrop for non-arena areas: indigo gradient with candle glow.
export function drawBackdrop(ctx, w, h, t = 0) {
  const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#2b2250'); g.addColorStop(0.55, '#1c1838'); g.addColorStop(1, '#120f26');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  const c = cached(`backdrop|${Math.round(w)}x${Math.round(h)}`, w, h, (gc, cw, ch) => {
    const u = Math.min(cw, ch);
    for (const [fx, fy, a] of [[0.15, 0.1, 0.22], [0.85, 0.18, 0.18], [0.5, 0.95, 0.16]]) {
      const r = gc.createRadialGradient(cw * fx, ch * fy, 4, cw * fx, ch * fy, u * 0.8); r.addColorStop(0, `rgba(255,200,130,${a})`); r.addColorStop(1, 'rgba(255,200,130,0)');
      gc.fillStyle = r; gc.fillRect(0, 0, cw, ch);
    }
    // a faint damask lattice
    gc.strokeStyle = 'rgba(232,194,106,0.06)'; gc.lineWidth = 2;
    const T = u / 6;
    for (let y = -T; y < ch + T; y += T) for (let x = -T; x < cw + T; x += T) { gc.beginPath(); gc.moveTo(x, y + T / 2); gc.lineTo(x + T / 2, y); gc.lineTo(x + T, y + T / 2); gc.lineTo(x + T / 2, y + T); gc.closePath(); gc.stroke(); }
  });
  if (c) ctx.drawImage(c, 0, 0, w, h);
  void t;
}
