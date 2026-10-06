// Drawing helpers: themes, lit round pieces, the carved and inlaid board, panels, flat buttons, icons.
// Plain canvas 2D, no images, nothing here changes game state.
import { NN, SEGMENTS, rc, CENTRE } from './rules.js';
import { hasArabic } from './lang.js';
import { screen } from './layout.js';

// The Arabic names come last in each stack: Geeza Pro (Apple), Noto Sans/Naskh Arabic and Droid Arabic Naskh (Android), Tahoma and
// Segoe UI (Windows), so Arabic text is drawn with a real Arabic face on every platform instead of whatever the browser guesses.
export const UI = '-apple-system, "SF Pro Text", "Segoe UI", Roboto, system-ui, "Geeza Pro", "Noto Sans Arabic", "Noto Naskh Arabic", "Droid Arabic Naskh", Tahoma, sans-serif';
export const DISPLAY = '"Palatino Linotype", Palatino, "Iowan Old Style", Georgia, "Times New Roman", "Geeza Pro", "Noto Naskh Arabic", "Noto Sans Arabic", "Droid Arabic Naskh", serif';

const hexRgb = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
export function mix(h, o, t) {
  const a = hexRgb(h), b = hexRgb(o);
  return `rgb(${Math.round(a[0] + (b[0] - a[0]) * t)},${Math.round(a[1] + (b[1] - a[1]) * t)},${Math.round(a[2] + (b[2] - a[2]) * t)})`;
}
export const light = (h, t) => mix(h, '#ffffff', t);
export const dark = (h, t) => mix(h, '#000000', t);
export const alpha = (h, a) => { const c = hexRgb(h); return `rgba(${c[0]},${c[1]},${c[2]},${a})`; };
export const clamp01 = (v) => Math.max(0, Math.min(1, v));
export const ease = (t) => 1 - (1 - t) ** 3;
export const backOut = (t) => { const c = 1.9; return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2; };


// ---------------------------------------------------------------------------------------------------- themes
// bg: three background stops; slab: board face (top, bottom); groove: the carved channel; inlay: the metal line set in it;
// p / d: the light and dark pieces.
export const THEMES = [
  {
    id: 'cedar', name: 'Cedar and Brass', kind: 'wood',
    bg: ['#150c07', '#321c10', '#170d07'], glow: 'rgba(255,170,90,0.28)', fleck: '255,210,150',
    slab: ['#c98b52', '#9c6535'], edge: '#5c3416', side: '#3a2008', vein: 'rgba(80,40,10,0.26)',
    groove: '#3b1f0b', lip: 'rgba(255,226,180,0.55)', inlay: '#e6bf68', inlayHi: '#fff1c4', band: 'rgba(60,30,8,0.55)', bandHi: 'rgba(255,230,185,0.35)', pit: '#4a2810',
    p: { base: '#efe4ca', hi: '#ffffff', lo: '#a89873', rim: '#fff7e0', glow: '255,244,200' },
    d: { base: '#8c2b22', hi: '#ef8a76', lo: '#3a0d0a', rim: '#ffb8a6', glow: '255,120,100' },
    accent: '#f0c86a', ink: '#f8eedb', win: '#ffd877',
    panel: ['rgba(54,31,18,0.97)', 'rgba(30,17,10,0.98)'], stroke: 'rgba(240,200,110,0.55)',
    btn: ['#5e3e27', '#43291a'], btnOn: ['#2f8f7c', '#1e6556'], primary: ['#f2cd78', '#d9a443'], primaryInk: '#3a2410',
  },
  {
    id: 'tile', name: 'Alhambra Blue', kind: 'tile',
    bg: ['#060d1c', '#0f2250', '#08122a'], glow: 'rgba(110,160,255,0.26)', fleck: '200,220,255',
    slab: ['#1f4a9a', '#143272'], edge: '#0a1b46', side: '#07112e', vein: 'rgba(255,255,255,0.07)',
    groove: '#091a42', lip: 'rgba(190,215,255,0.38)', inlay: '#f4efe0', inlayHi: '#ffffff', band: 'rgba(244,239,224,0.55)', bandHi: 'rgba(255,255,255,0.18)', pit: '#0a1a44',
    p: { base: '#f6efdc', hi: '#ffffff', lo: '#b3a583', rim: '#fffaea', glow: '255,245,210' },
    d: { base: '#d1782f', hi: '#ffc48a', lo: '#5a2208', rim: '#ffd9b0', glow: '255,160,90' },
    accent: '#f3cf86', ink: '#f5f0e2', win: '#ffe7a8',
    panel: ['rgba(18,38,86,0.97)', 'rgba(9,20,52,0.98)'], stroke: 'rgba(243,207,134,0.5)',
    btn: ['#23468f', '#183270'], btnOn: ['#b8642a', '#85411a'], primary: ['#f3cf86', '#d9a550'], primaryInk: '#2b1a08',
  },
  {
    id: 'ebony', name: 'Ebony and Ivory', kind: 'ebony',
    bg: ['#060507', '#15111a', '#08060a'], glow: 'rgba(230,190,255,0.20)', fleck: '230,210,255',
    slab: ['#2b2530', '#17131c'], edge: '#5a4f66', side: '#07050a', vein: 'rgba(210,190,255,0.08)',
    groove: '#08060b', lip: 'rgba(200,185,235,0.30)', inlay: '#e8dcc0', inlayHi: '#ffffff', band: 'rgba(232,220,192,0.42)', bandHi: 'rgba(255,255,255,0.14)', pit: '#08060b',
    p: { base: '#e8e2d0', hi: '#ffffff', lo: '#8f8770', rim: '#ffffff', glow: '240,235,210' },
    d: { base: '#2f9c8e', hi: '#8ff0df', lo: '#0a3a34', rim: '#bff8ec', glow: '120,240,220' },
    accent: '#e0c27a', ink: '#f3eefb', win: '#fff0a8',
    panel: ['rgba(34,28,42,0.97)', 'rgba(16,13,22,0.98)'], stroke: 'rgba(224,194,122,0.5)',
    btn: ['#3b3348', '#282234'], btnOn: ['#2a8aa0', '#1b5d70'], primary: ['#e0c27a', '#b99a4e'], primaryInk: '#241a06',
  },
];
export const themeById = (id) => THEMES.find((t) => t.id === id) ?? THEMES[0];

export function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }

export function text(ctx, str, x, y, size, color = '#fff', o = {}) {
  ctx.font = `${o.weight ?? 600} ${size}px ${o.font ?? UI}`;
  ctx.textAlign = o.align ?? 'center';
  ctx.textBaseline = o.base ?? 'alphabetic';
  ctx.direction = hasArabic(str) ? 'rtl' : 'ltr';
  if (o.shadow) { ctx.shadowColor = o.shadow; ctx.shadowBlur = o.blur ?? 6; ctx.shadowOffsetY = o.dy ?? 2; }
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
  if (o.shadow) { ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0; }
}

// ---------------------------------------------------------------------------------------------------- background
const FLECKS = Array.from({ length: 34 }, (_, i) => [((i * 97) % 211) / 211, ((i * 53) % 173) / 173, 0.6 + ((i * 31) % 7) / 7, ((i * 13) % 11) / 11]);

export function background(ctx, th, t, glowY = 700, dunes = false, glowX = null) {
  const W = screen.w, H = screen.h, gx = glowX ?? W / 2;
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, th.bg[0]); g.addColorStop(0.5, th.bg[1]); g.addColorStop(1, th.bg[2]);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const hg = ctx.createRadialGradient(gx, glowY, 40, gx, glowY, 660);
  hg.addColorStop(0, th.glow); hg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = hg; ctx.fillRect(0, 0, W, H);
  if (dunes) {
    // two soft dune ridges at the foot of the screen
    ctx.save();
    for (let k = 0; k < 2; k++) {
      const y0 = H - 260 + k * 70, c = k ? 'rgba(0,0,0,0.30)' : 'rgba(0,0,0,0.18)';
      ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(0, H);
      for (let x = 0; x <= W; x += 20) ctx.lineTo(x, y0 + Math.sin(x * 0.011 + k * 2.1) * 34 + Math.sin(x * 0.027 + k) * 12);
      ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }
  for (const [fx, fy, s, ph] of FLECKS) {
    const xx = (fx * W + t * (6 + s * 5)) % W, yy = (fy * H + t * (2 + s * 2)) % H;
    const a = 0.06 + 0.12 * (0.5 + 0.5 * Math.sin(t * 0.7 + ph * 9));
    ctx.fillStyle = `rgba(${th.fleck},${a})`;
    ctx.fillRect(xx, yy, 2.2 * s, 2.2 * s);
  }
  const vg = ctx.createRadialGradient(W / 2, H / 2, 560, W / 2, H / 2, Math.max(1020, Math.hypot(W, H) * 0.62));
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.5)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
}

// ---------------------------------------------------------------------------------------------------- panels and buttons
export function panel(ctx, th, x, y, w, h, o = {}) {
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = o.blur ?? 26; ctx.shadowOffsetY = 10;
  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, th.panel[0]); g.addColorStop(1, th.panel[1]);
  ctx.fillStyle = g; rr(ctx, x, y, w, h, o.r ?? 26); ctx.fill();
  ctx.restore();
  ctx.strokeStyle = th.stroke; ctx.lineWidth = 2; rr(ctx, x, y, w, h, o.r ?? 26); ctx.stroke();
}

// Flat buttons: one solid fill, a hairline border, a darker underside strip when at rest. No gloss shape.
export function button(ctx, th, r, lines, kind = 'normal', o = {}) {
  ctx.save();
  if (o.disabled) ctx.globalAlpha = 0.38;
  const press = o.pressed ? 2 : 0;
  const y = r.y + press;
  const rad = o.radius ?? 18;
  const col = kind === 'primary' ? th.primary : kind === 'on' ? th.btnOn : kind === 'danger' ? ['#c9503f', '#8e2b27'] : kind === 'ghost' ? ['rgba(255,255,255,0.05)', 'rgba(255,255,255,0.05)'] : th.btn;
  if (!press) { ctx.fillStyle = 'rgba(0,0,0,0.38)'; rr(ctx, r.x, r.y + 4, r.w, r.h, rad); ctx.fill(); }
  ctx.fillStyle = press ? col[1] : col[0];
  rr(ctx, r.x, y, r.w, r.h, rad); ctx.fill();
  ctx.strokeStyle = kind === 'primary' ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.16)'; ctx.lineWidth = 1.5;
  rr(ctx, r.x, y, r.w, r.h, rad); ctx.stroke();
  const color = kind === 'primary' ? th.primaryInk : th.ink;
  const size = o.size ?? 28, line = o.line ?? size * 1.22, subs = o.sub ?? [];
  const total = lines.length * line + (subs.length ? subs.length * size * 0.78 + 4 : 0);
  let ty = y + (r.h - total) / 2 + size * 0.9;
  for (const ln of lines) { text(ctx, ln, r.x + r.w / 2, ty, size, color, { weight: 700 }); ty += line; }
  for (const ln of subs) { ty += size * 0.04; text(ctx, ln, r.x + r.w / 2, ty, size * 0.62, kind === 'primary' ? alpha(th.primaryInk, 0.78) : 'rgba(246,236,214,0.72)', { weight: 500 }); ty += size * 0.78; }
  ctx.restore();
}

// ---------------------------------------------------------------------------------------------------- icons (centred at x,y, size s)
export function icon(ctx, name, x, y, s, color = '#fff') {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = color; ctx.fillStyle = color;
  ctx.lineWidth = Math.max(2.5, s * 0.1); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const r = s / 2;
  if (name === 'undo') {
    ctx.beginPath(); ctx.arc(r * 0.05, r * 0.1, r * 0.62, Math.PI * 1.15, Math.PI * 2.1); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-r * 0.72, -r * 0.15); ctx.lineTo(-r * 0.48, -r * 0.62); ctx.moveTo(-r * 0.72, -r * 0.15); ctx.lineTo(-r * 0.16, -r * 0.1); ctx.stroke();
  } else if (name === 'hint') {
    ctx.beginPath(); ctx.arc(0, -r * 0.2, r * 0.55, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-r * 0.28, r * 0.52); ctx.lineTo(r * 0.28, r * 0.52); ctx.moveTo(-r * 0.2, r * 0.8); ctx.lineTo(r * 0.2, r * 0.8); ctx.stroke();
  } else if (name === 'reset') {
    ctx.beginPath(); ctx.arc(0, 0, r * 0.7, Math.PI * 0.3, Math.PI * 2.05); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(r * 0.78, -r * 0.55); ctx.lineTo(r * 0.78, -r * 0.05); ctx.lineTo(r * 0.28, -r * 0.1); ctx.stroke();
  } else if (name === 'pause') {
    ctx.fillRect(-r * 0.5, -r * 0.62, r * 0.36, r * 1.24); ctx.fillRect(r * 0.14, -r * 0.62, r * 0.36, r * 1.24);
  } else if (name === 'play') {
    ctx.beginPath(); ctx.moveTo(-r * 0.4, -r * 0.65); ctx.lineTo(r * 0.7, 0); ctx.lineTo(-r * 0.4, r * 0.65); ctx.closePath(); ctx.fill();
  } else if (name === 'back') {
    ctx.beginPath(); ctx.moveTo(r * 0.45, -r * 0.7); ctx.lineTo(-r * 0.4, 0); ctx.lineTo(r * 0.45, r * 0.7); ctx.stroke();
  } else if (name === 'minus') {
    ctx.beginPath(); ctx.moveTo(-r * 0.6, 0); ctx.lineTo(r * 0.6, 0); ctx.stroke();
  } else if (name === 'plus') {
    ctx.beginPath(); ctx.moveTo(-r * 0.6, 0); ctx.lineTo(r * 0.6, 0); ctx.moveTo(0, -r * 0.6); ctx.lineTo(0, r * 0.6); ctx.stroke();
  } else if (name === 'lock') {
    ctx.beginPath(); ctx.arc(0, -r * 0.2, r * 0.38, Math.PI, 0); ctx.stroke();
    rr(ctx, -r * 0.6, -r * 0.2, r * 1.2, r * 0.95, 5); ctx.fill();
  } else if (name === 'check') {
    ctx.beginPath(); ctx.moveTo(-r * 0.6, 0); ctx.lineTo(-r * 0.15, r * 0.45); ctx.lineTo(r * 0.65, -r * 0.5); ctx.stroke();
  } else if (name === 'stop') {
    rr(ctx, -r * 0.55, -r * 0.55, r * 1.1, r * 1.1, 6); ctx.fill();
  } else if (name === 'auto') { // two stones dropping: a quick "place the rest" glyph
    ctx.beginPath(); ctx.arc(-r * 0.4, r * 0.25, r * 0.3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(r * 0.4, r * 0.25, r * 0.3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-r * 0.4, -r * 0.7); ctx.lineTo(-r * 0.4, -r * 0.2); ctx.moveTo(r * 0.4, -r * 0.7); ctx.lineTo(r * 0.4, -r * 0.2); ctx.stroke();
  }
  ctx.restore();
}

export function drawParticles(ctx, parts) {
  for (const q of parts) {
    const a = clamp01(q.life / (q.max * 0.6));
    ctx.globalAlpha = a;
    ctx.fillStyle = q.color;
    if (q.shape === 'ring') {
      ctx.strokeStyle = q.color; ctx.lineWidth = q.w ?? 4;
      ctx.beginPath(); ctx.arc(q.x, q.y, q.size, 0, Math.PI * 2); ctx.stroke();
    } else if (q.shape === 'chip') {
      ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.rot);
      ctx.fillRect(-q.size, -q.size * 0.5, q.size * 2, q.size);
      ctx.restore();
    } else {
      ctx.beginPath(); ctx.arc(q.x, q.y, q.size * (0.4 + 0.6 * a), 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

// ---------------------------------------------------------------------------------------------------- the pieces
// A round, domed piece seen slightly from above, lit from the upper left. Light pieces carry a turned ring, Dark pieces a carved
// carved diamond, so the two sides differ in pattern as well as colour. d = diameter.
// o: { scale, alpha, glow (0..1), lift (0..1: raised off the board), ghost, noShadow, rot }
function diamond(ctx, cx, cy, r) {
  ctx.beginPath(); ctx.moveTo(cx, cy - r); ctx.lineTo(cx + r * 0.78, cy); ctx.lineTo(cx, cy + r); ctx.lineTo(cx - r * 0.78, cy); ctx.closePath();
}
export function drawPiece(ctx, th, who, cx, cy, d, o = {}) {
  const col = who === 1 ? th.p : th.d;
  const sc = (o.scale ?? 1) * (1 + 0.1 * (o.lift ?? 0));
  const a = o.alpha ?? 1;
  if (a <= 0.01 || sc <= 0.01) return;
  const R = (d / 2) * sc, depth = d * 0.11 * sc, lift = (o.lift ?? 0) * d * 0.24;
  const y = cy - lift;
  ctx.save();
  ctx.globalAlpha = a * (o.ghost ? 0.42 : 1);
  if (!o.noShadow) {
    ctx.fillStyle = 'rgba(0,0,0,0.34)';
    ctx.beginPath(); ctx.ellipse(cx + d * 0.04, cy + depth + d * 0.09 + lift * 0.5, R * 0.98, R * 0.6, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = col.lo;
  ctx.beginPath(); ctx.arc(cx, y + depth, R, 0, Math.PI * 2); ctx.fill();
  ctx.fillRect(cx - R, y, R * 2, depth);
  if (o.glow) { ctx.shadowColor = `rgba(${col.glow},${clamp01(o.glow)})`; ctx.shadowBlur = d * 0.5; }
  const g = ctx.createRadialGradient(cx - R * 0.35, y - R * 0.4, R * 0.1, cx, y, R * 1.05);
  g.addColorStop(0, col.hi); g.addColorStop(0.45, col.base); g.addColorStop(1, mix(col.base, col.lo, 0.8));
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(cx, y, R, 0, Math.PI * 2); ctx.fill();
  ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0;
  ctx.strokeStyle = alpha(col.rim, 0.55); ctx.lineWidth = Math.max(1.2, d * 0.03);
  ctx.beginPath(); ctx.arc(cx, y, R - d * 0.02, Math.PI * 0.95, Math.PI * 1.75); ctx.stroke();
  // the carved device: flat, crisp, one pass (no doubled copies)
  ctx.save(); ctx.translate(cx, y); if (o.rot) ctx.rotate(o.rot); ctx.translate(-cx, -y);
  if (who === 1) {
    ctx.strokeStyle = alpha(col.lo, 0.5); ctx.lineWidth = Math.max(1.2, d * 0.035);
    ctx.beginPath(); ctx.arc(cx, y, R * 0.62, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, y, R * 0.34, 0, Math.PI * 2); ctx.stroke();
  } else {
    ctx.fillStyle = alpha(col.lo, 0.62);
    diamond(ctx, cx, y, R * 0.68); ctx.fill();
    ctx.fillStyle = alpha(col.hi, 0.5);
    diamond(ctx, cx, y, R * 0.34); ctx.fill();
  }
  ctx.restore();
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.beginPath(); ctx.ellipse(cx - R * 0.4, y - R * 0.5, R * 0.2, R * 0.1, -0.7, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

// ---------------------------------------------------------------------------------------------------- the board
// A square slab. A band of small diamonds runs round the edge, inside it the 5x5 points are joined by carved channels with a thin
// metal inlay: every row and column, and the diagonals that pass only through the alternate points.
export function boardGeo(x, y, side, flip = false) {
  const m = side * 0.115;
  const u = (side - 2 * m) / 4;
  const centers = [];
  for (let i = 0; i < NN; i++) { const c = i % 5, r = Math.floor(i / 5); centers.push(flip ? [x + m + u * (4 - c), y + m + u * (4 - r)] : [x + m + u * c, y + m + u * r]); }
  return { x, y, side, m, u, centers, d: u * 0.64, cell: u, flip };
}

const GRAIN = Array.from({ length: 80 }, (_, i) => [((i * 61) % 97) / 97, ((i * 29) % 89) / 89, 0.6 + ((i * 17) % 5) / 5]);

function starBand(ctx, th, x, y, side, m) {
  // a row of small diamonds along each edge, between two engraved rules
  const inset = m * 0.5, n = 12, step = (side - 2 * inset) / n, s = m * 0.2;
  ctx.save();
  ctx.strokeStyle = th.band; ctx.lineWidth = Math.max(1.2, side * 0.004);
  rr(ctx, x + inset * 0.55, y + inset * 0.55, side - inset * 1.1, side - inset * 1.1, side * 0.02); ctx.stroke();
  rr(ctx, x + inset * 1.45, y + inset * 1.45, side - inset * 2.9, side - inset * 2.9, side * 0.012); ctx.stroke();
  ctx.fillStyle = th.band;
  for (let i = 0; i <= n; i++) {
    const t = inset + i * step;
    for (const [px, py] of [[x + t, y + inset], [x + t, y + side - inset]]) { diamond(ctx, px, py, s * 0.85); ctx.fill(); }
    if (i > 0 && i < n) for (const [px, py] of [[x + inset, y + t], [x + side - inset, y + t]]) { diamond(ctx, px, py, s * 0.85); ctx.fill(); }
  }
  ctx.restore();
}

export function drawSlab(ctx, th, x, y, side, o = {}) {
  const r = side * 0.045, thick = o.thick ?? side * 0.04, m = side * 0.115;
  ctx.save();
  if (!o.flat) { ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = side * 0.06; ctx.shadowOffsetY = thick * 1.6; }
  ctx.fillStyle = th.side; rr(ctx, x, y + thick, side, side, r); ctx.fill();
  ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
  const g = ctx.createLinearGradient(x, y, x + side * 0.3, y + side);
  g.addColorStop(0, th.slab[0]); g.addColorStop(1, th.slab[1]);
  ctx.fillStyle = g; rr(ctx, x, y, side, side, r); ctx.fill();
  ctx.save();
  rr(ctx, x, y, side, side, r); ctx.clip();
  ctx.strokeStyle = th.vein;
  if (th.kind === 'tile') {
    // zellige: a lattice of small tiles
    const t = side / 20;
    ctx.lineWidth = 1;
    for (let i = 0; i <= 20; i++) { ctx.beginPath(); ctx.moveTo(x + i * t, y); ctx.lineTo(x + i * t, y + side); ctx.moveTo(x, y + i * t); ctx.lineTo(x + side, y + i * t); ctx.stroke(); }
  } else {
    for (let i = 0; i < 22; i++) {
      const yy = y + (i + 0.5) * (side / 22);
      ctx.lineWidth = 0.8 + (i % 4 === 0 ? 1.4 : 0) + (i % 7 === 0 ? 0.8 : 0);
      ctx.beginPath(); ctx.moveTo(x, yy);
      ctx.bezierCurveTo(x + side * 0.3, yy + Math.sin(i * 1.3) * 7, x + side * 0.65, yy - Math.cos(i * 1.7) * 9, x + side, yy + Math.sin(i * 0.6) * 6);
      ctx.stroke();
    }
  }
  ctx.fillStyle = th.kind === 'wood' ? 'rgba(90,50,15,0.14)' : 'rgba(255,255,255,0.06)';
  for (const [gx, gy, gs] of GRAIN) ctx.fillRect(x + gx * side, y + gy * side, 1.6 * gs, 1.6 * gs);
  if (side >= 220 && o.border !== false) starBand(ctx, th, x, y, side, m);
  const bg = ctx.createLinearGradient(0, y, 0, y + side);
  bg.addColorStop(0, 'rgba(255,255,255,0.30)'); bg.addColorStop(0.1, 'rgba(255,255,255,0)'); bg.addColorStop(0.9, 'rgba(0,0,0,0)'); bg.addColorStop(1, 'rgba(0,0,0,0.25)');
  ctx.fillStyle = bg; ctx.fillRect(x, y, side, side);
  ctx.restore();
  ctx.strokeStyle = th.edge; ctx.lineWidth = 2; rr(ctx, x, y, side, side, r); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.24)'; ctx.lineWidth = 1.5; rr(ctx, x + 3, y + 3, side - 6, side - 6, r - 2); ctx.stroke();
  ctx.restore();
}

// The carved channels with their inlay, and the 25 points as small rosettes.
export function drawLines(ctx, th, geo) {
  const { centers, u } = geo;
  const w = Math.max(3, u * 0.075);
  const path = () => { ctx.beginPath(); for (const [a, b] of SEGMENTS) { ctx.moveTo(centers[a][0], centers[a][1]); ctx.lineTo(centers[b][0], centers[b][1]); } };
  ctx.save();
  ctx.lineCap = 'round';
  path(); ctx.save(); ctx.translate(0, w * 0.5); ctx.strokeStyle = th.lip; ctx.lineWidth = w * 2.1; ctx.stroke(); ctx.restore();
  ctx.strokeStyle = th.groove; ctx.lineWidth = w * 2.1; path(); ctx.stroke();
  ctx.strokeStyle = th.inlay; ctx.lineWidth = w * 0.95; path(); ctx.stroke();
  ctx.strokeStyle = th.inlayHi; ctx.globalAlpha = 0.55; ctx.lineWidth = w * 0.22; ctx.save(); ctx.translate(0, -w * 0.2); path(); ctx.stroke(); ctx.restore();
  ctx.globalAlpha = 1;
  for (let i = 0; i < NN; i++) {
    const [px, py] = centers[i], big = (rc(i)[0] + rc(i)[1]) % 2 === 0, r = u * (big ? 0.2 : 0.15);
    ctx.fillStyle = th.lip; ctx.beginPath(); ctx.arc(px, py + 1.6, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = th.pit; ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = th.inlay; ctx.lineWidth = Math.max(1.4, u * 0.03); ctx.beginPath(); ctx.arc(px, py, r * 0.62, 0, Math.PI * 2); ctx.stroke();
    if (i === CENTRE) { ctx.fillStyle = th.inlay; diamond(ctx, px, py, r * 0.6); ctx.fill(); }
  }
  ctx.restore();
}

// Whole board with pieces, for small illustrations. cells: string of ./X/O (25 chars, '/' and spaces ignored) or an array.
// o: { hl: [i], dots: [i], arrows: [[from, to]], marks: [i] (red X on pieces about to be captured) }
export function drawMiniBoard(ctx, th, x, y, side, cells, o = {}) {
  const geo = boardGeo(x, y, side);
  drawSlab(ctx, th, x, y, side, { flat: true, thick: side * 0.03, border: side >= 260 });
  drawLines(ctx, th, geo);
  const arr = typeof cells === 'string' ? cells.replace(/[\s/]/g, '').split('').map((ch) => (ch === 'X' ? 1 : ch === 'O' ? 2 : 0)) : cells;
  for (const i of o.hl ?? []) {
    const [cx, cy] = geo.centers[i];
    ctx.save(); ctx.fillStyle = alpha(th.accent, 0.3); ctx.beginPath(); ctx.arc(cx, cy, geo.u * 0.42, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = th.accent; ctx.lineWidth = Math.max(2, side * 0.01); ctx.setLineDash([8, 6]); ctx.stroke(); ctx.restore();
  }
  for (const i of o.dots ?? []) {
    const [cx, cy] = geo.centers[i];
    ctx.save(); ctx.fillStyle = alpha(th.accent, 0.95); ctx.beginPath(); ctx.arc(cx, cy, geo.u * 0.12, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }
  arr.forEach((v, i) => { if (v) { const [cx, cy] = geo.centers[i]; drawPiece(ctx, th, v, cx, cy, geo.d, { noShadow: side < 200 }); } });
  for (const i of o.marks ?? []) { const [cx, cy] = geo.centers[i]; drawCross(ctx, cx, cy, geo.u * 0.2); }
  for (const [a, b] of o.arrows ?? []) arrowBetween(ctx, th.accent, geo.centers[a], geo.centers[b], geo.u * 0.3);
  return geo;
}

export function drawCross(ctx, cx, cy, r, color = '#ff6a54') {
  ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = Math.max(3, r * 0.34); ctx.lineCap = 'round';
  ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 5;
  ctx.beginPath(); ctx.moveTo(cx - r, cy - r); ctx.lineTo(cx + r, cy + r); ctx.moveTo(cx + r, cy - r); ctx.lineTo(cx - r, cy + r); ctx.stroke();
  ctx.restore();
}

function arrowBetween(ctx, color, p0, p1, pad) {
  const dx = p1[0] - p0[0], dy = p1[1] - p0[1], len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len;
  arrow(ctx, color, p0[0] + ux * pad, p0[1] + uy * pad, p1[0] - ux * pad, p1[1] - uy * pad);
}
export function arrow(ctx, color, x0, y0, x1, y1, lw = 6) {
  ctx.save(); ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = lw; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  const a = Math.atan2(y1 - y0, x1 - x0);
  ctx.beginPath(); ctx.moveTo(x1 + Math.cos(a) * 6, y1 + Math.sin(a) * 6);
  ctx.lineTo(x1 - Math.cos(a - 0.5) * 20, y1 - Math.sin(a - 0.5) * 20);
  ctx.lineTo(x1 - Math.cos(a + 0.5) * 20, y1 - Math.sin(a + 0.5) * 20);
  ctx.closePath(); ctx.fill(); ctx.restore();
}
