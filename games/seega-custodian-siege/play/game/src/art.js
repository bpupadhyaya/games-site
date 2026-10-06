// Drawing helpers: themes, lit stones (pebbles and date stones), the carved sand board, panels, flat buttons, icons.
// Plain canvas 2D, no images, nothing here changes game state.
import { N, NN, CENTRE } from './rules.js';
import { hasArabic } from './lang.js';
import { SCREEN } from './layout.js';

export const UI = '-apple-system, "SF Pro Text", "Segoe UI", Roboto, system-ui, sans-serif';
export const DISPLAY = '"Palatino Linotype", Palatino, "Iowan Old Style", Georgia, "Times New Roman", serif';

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
// bg: three background stops; slab: board face (top, bottom); pit: the carved squares; p / d: pebble and date-stone colours.
export const THEMES = [
  {
    id: 'sand', name: 'Sandstone', kind: 'sand',
    bg: ['#1a0f08', '#3a2112', '#1c1008'], glow: 'rgba(255,170,80,0.30)', fleck: '255,210,150',
    slab: ['#e8c88e', '#c79a58'], edge: '#8a5e2c', side: '#6a4520', vein: 'rgba(138,94,44,0.22)',
    pit: ['#b98a4c', '#d8b077'], pitEdge: '#8a5e2c', pitLip: 'rgba(255,236,196,0.85)', carve: '#7a4f22', band: '#9b6a30',
    p: { base: '#ece6d6', hi: '#ffffff', lo: '#8c8372', glow: '255,244,214' },
    d: { base: '#9b5a2c', hi: '#e6a86c', lo: '#46200c', glow: '255,170,100' },
    accent: '#f0c46a', ink: '#f8ecd4', win: '#ffd877',
    panel: ['rgba(58,36,20,0.97)', 'rgba(34,20,11,0.98)'], stroke: 'rgba(240,196,106,0.55)',
    btn: ['#6a4526', '#4c3019'], btnOn: ['#3f8f78', '#296a58'], primary: ['#f2cf7a', '#d9a444'], primaryInk: '#3a2410',
  },
  {
    id: 'basalt', name: 'Basalt and Copper', kind: 'basalt',
    bg: ['#0b0c10', '#1b1c24', '#0d0e13'], glow: 'rgba(255,150,90,0.22)', fleck: '230,200,170',
    slab: ['#4a4a52', '#2c2c33'], edge: '#16161b', side: '#0f0f13', vein: 'rgba(255,255,255,0.05)',
    pit: ['#1d1d23', '#33333b'], pitEdge: '#0e0e12', pitLip: 'rgba(210,205,225,0.28)', carve: '#9a6a44', band: '#b7773f',
    p: { base: '#d9dfe9', hi: '#ffffff', lo: '#707890', glow: '210,225,255' },
    d: { base: '#c2652b', hi: '#f6a66c', lo: '#5e2810', glow: '255,150,80' },
    accent: '#f1a56a', ink: '#f2ece4', win: '#ffd09a',
    panel: ['rgba(38,38,48,0.97)', 'rgba(20,20,27,0.98)'], stroke: 'rgba(241,165,106,0.5)',
    btn: ['#3f3f4c', '#2c2c36'], btnOn: ['#b5602c', '#85411a'], primary: ['#f1a56a', '#cf7a3a'], primaryInk: '#2a1608',
  },
  {
    id: 'oasis', name: 'Oasis Night', kind: 'oasis',
    bg: ['#04100f', '#0d2b2a', '#061615'], glow: 'rgba(110,230,200,0.22)', fleck: '170,240,220',
    slab: ['#2f6d68', '#1b4643'], edge: '#0c2523', side: '#08191a', vein: 'rgba(190,255,235,0.10)',
    pit: ['#143432', '#26605b'], pitEdge: '#0a2120', pitLip: 'rgba(190,255,235,0.35)', carve: '#7fd3b8', band: '#58b9a0',
    p: { base: '#f3eddc', hi: '#ffffff', lo: '#9a937f', glow: '255,248,220' },
    d: { base: '#a8452f', hi: '#f1936f', lo: '#4a160b', glow: '255,140,100' },
    accent: '#8fe3c8', ink: '#e9f6f0', win: '#fff0a8',
    panel: ['rgba(14,48,46,0.97)', 'rgba(8,30,29,0.98)'], stroke: 'rgba(143,227,200,0.5)',
    btn: ['#1f5a55', '#154340'], btnOn: ['#a8452f', '#7a2c1b'], primary: ['#8fe3c8', '#55b99c'], primaryInk: '#06231f',
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

export function background(ctx, th, t, glowY = 700, dunes = false) {
  const W = SCREEN.width, H = SCREEN.height, half = Math.hypot(W, H) / 2;
  glowY = Math.min(glowY, H * 0.5);
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, th.bg[0]); g.addColorStop(0.5, th.bg[1]); g.addColorStop(1, th.bg[2]);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const hg = ctx.createRadialGradient(W / 2, glowY, 40, W / 2, glowY, 660 * Math.max(1, W / 720));
  hg.addColorStop(0, th.glow); hg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = hg; ctx.fillRect(0, 0, W, H);
  if (dunes) {
    // two soft dune ridges at the foot of the screen
    ctx.save();
    const dh = Math.min(260, H * 0.3);
    for (let k = 0; k < 2; k++) {
      const y0 = H - dh + k * dh * 0.27, c = k ? 'rgba(0,0,0,0.30)' : 'rgba(0,0,0,0.18)';
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
  const vg = ctx.createRadialGradient(W / 2, H / 2, half * 0.65, W / 2, H / 2, half * 1.19);
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

// ---------------------------------------------------------------------------------------------------- the stones
// A pebble (side 1) is a round, speckled limestone pebble; a date stone (side 2) is a pointed, grooved oval. Both are lit
// from the upper left, with an extruded edge and a soft contact shadow. `d` is the pebble diameter.
// o: { scale, alpha, glow (0..1), lift (0..1: raised off the board), ghost, cell (varies the date stone's angle) }
const SPECKS = [[-0.18, -0.12, 0.05], [0.14, 0.1, 0.04], [0.02, -0.26, 0.035], [-0.1, 0.22, 0.045], [0.24, -0.1, 0.03], [-0.28, 0.06, 0.03]];
export const dateAngle = (i) => (((i * 37) % 11) - 5) * 0.09 - 0.35;

function lensPath(ctx, cx, cy, ang, L, Wd) {
  // a date stone: a long oval with softly rounded ends
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(ang);
  ctx.beginPath();
  ctx.moveTo(-L / 2, 0);
  ctx.bezierCurveTo(-L / 2, -Wd * 0.46, -L * 0.3, -Wd / 2, 0, -Wd / 2);
  ctx.bezierCurveTo(L * 0.3, -Wd / 2, L / 2, -Wd * 0.46, L / 2, 0);
  ctx.bezierCurveTo(L / 2, Wd * 0.46, L * 0.3, Wd / 2, 0, Wd / 2);
  ctx.bezierCurveTo(-L * 0.3, Wd / 2, -L / 2, Wd * 0.46, -L / 2, 0);
  ctx.closePath();
  ctx.restore();
}
// lensPath leaves the transform restored, but the path is recorded in device space: it is safe to fill afterwards.

export function drawStone(ctx, th, who, cx, cy, d, o = {}) {
  const col = who === 1 ? th.p : th.d;
  const sc = (o.scale ?? 1) * (1 + 0.1 * (o.lift ?? 0));
  const a = o.alpha ?? 1;
  if (a <= 0.01 || sc <= 0.01) return;
  const depth = d * 0.1 * sc;
  const lift = (o.lift ?? 0) * d * 0.16;
  const y = cy - lift;
  ctx.save();
  ctx.globalAlpha = a * (o.ghost ? 0.42 : 1);
  if (!o.noShadow) {
    ctx.fillStyle = 'rgba(0,0,0,0.30)';
    ctx.beginPath(); ctx.ellipse(cx + d * 0.05, cy + depth + d * 0.1 + lift * 0.4, d * 0.48 * sc * (1 - (o.lift ?? 0) * 0.15), d * 0.2 * sc, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.translate(cx, y); ctx.scale(sc, sc); if (o.rot) ctx.rotate(o.rot); ctx.translate(-cx, -y);
  const steps = Math.max(2, Math.round(depth / 1.6));
  const glow = o.glow ? `rgba(${col.glow},${clamp01(o.glow)})` : null;
  if (who === 1) {
    const R = d / 2;
    for (let k = steps; k >= 1; k--) {
      ctx.fillStyle = k === steps ? dark(col.lo, 0.3) : col.lo;
      ctx.beginPath(); ctx.arc(cx, y + (depth * k) / steps, R, 0, Math.PI * 2); ctx.fill();
    }
    const g = ctx.createRadialGradient(cx - R * 0.35, y - R * 0.4, R * 0.1, cx, y, R * 1.05);
    g.addColorStop(0, col.hi); g.addColorStop(0.35, col.base); g.addColorStop(1, mix(col.base, col.lo, 0.8));
    if (glow) { ctx.shadowColor = glow; ctx.shadowBlur = 26; }
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, y, R, 0, Math.PI * 2); ctx.fill();
    ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0;
    ctx.fillStyle = alpha(col.lo, 0.38);
    for (const [sx, sy, sr] of SPECKS) { ctx.beginPath(); ctx.arc(cx + sx * d, y + sy * d, sr * d, 0, Math.PI * 2); ctx.fill(); }
    ctx.strokeStyle = alpha(col.lo, 0.5); ctx.lineWidth = d * 0.02; ctx.beginPath(); ctx.arc(cx, y, R - d * 0.01, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath(); ctx.ellipse(cx - R * 0.36, y - R * 0.42, R * 0.24, R * 0.13, -0.7, 0, Math.PI * 2); ctx.fill();
  } else {
    const ang = o.ang ?? dateAngle(o.cell ?? 0);
    const L = d * 1.12, Wd = d * 0.64;
    for (let k = steps; k >= 1; k--) {
      lensPath(ctx, cx, y + (depth * k) / steps, ang, L, Wd);
      ctx.fillStyle = k === steps ? dark(col.lo, 0.3) : col.lo; ctx.fill();
    }
    lensPath(ctx, cx, y, ang, L, Wd);
    const g = ctx.createLinearGradient(cx - L * 0.3, y - Wd * 0.7, cx + L * 0.3, y + Wd * 0.7);
    g.addColorStop(0, col.hi); g.addColorStop(0.4, col.base); g.addColorStop(1, mix(col.base, col.lo, 0.8));
    if (glow) { ctx.shadowColor = glow; ctx.shadowBlur = 26; }
    ctx.fillStyle = g; ctx.fill();
    ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0;
    ctx.strokeStyle = alpha(col.lo, 0.6); ctx.lineWidth = d * 0.02; ctx.stroke();
    // the long groove of a date stone: a dark channel with a light lip below it, and fine ridges either side
    ctx.save(); ctx.translate(cx, y); ctx.rotate(ang); ctx.lineCap = 'round';
    ctx.strokeStyle = alpha(col.lo, 0.35); ctx.lineWidth = d * 0.012;
    for (const k of [-0.2, 0.2]) { ctx.beginPath(); ctx.moveTo(-L * 0.32, d * k * 0.9); ctx.quadraticCurveTo(0, d * (k * 0.9 + 0.025), L * 0.32, d * k * 0.9); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(255,255,255,0.32)'; ctx.lineWidth = d * 0.035; ctx.beginPath(); ctx.moveTo(-L * 0.36, d * 0.03); ctx.lineTo(L * 0.36, d * 0.03); ctx.stroke();
    ctx.strokeStyle = alpha(col.lo, 0.92); ctx.lineWidth = d * 0.045; ctx.beginPath(); ctx.moveTo(-L * 0.36, 0); ctx.lineTo(L * 0.36, 0); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath(); ctx.ellipse(-L * 0.16, -Wd * 0.24, L * 0.17, Wd * 0.07, -0.05, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------------------------------- the board
export function boardGeo(x, y, side) {
  const m = side * 0.06;
  const cell = (side - 2 * m) / N;
  const centers = [];
  for (let i = 0; i < NN; i++) centers.push([x + m + cell * ((i % N) + 0.5), y + m + cell * (Math.floor(i / N) + 0.5)]);
  return { x, y, side, m, cell, n: N, centers, d: cell * 0.68 };
}

const GRAIN = Array.from({ length: 70 }, (_, i) => [((i * 61) % 97) / 97, ((i * 29) % 89) / 89, 0.6 + ((i * 17) % 5) / 5]);

export function drawSlab(ctx, th, x, y, side, o = {}) {
  const r = side * 0.05, thick = o.thick ?? side * 0.04;
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
  for (let i = 0; i < 18; i++) { // strata, like layered stone or wind-rippled sand
    const yy = y + (i + 0.5) * (side / 18);
    ctx.lineWidth = 1 + (i % 3 === 0 ? 1.4 : 0);
    ctx.beginPath(); ctx.moveTo(x, yy);
    ctx.bezierCurveTo(x + side * 0.3, yy + Math.sin(i * 1.3) * 9, x + side * 0.65, yy - Math.cos(i * 1.9) * 10, x + side, yy + Math.sin(i * 0.7) * 7);
    ctx.stroke();
  }
  ctx.fillStyle = th.kind === 'sand' ? 'rgba(120,80,30,0.16)' : 'rgba(255,255,255,0.08)';
  for (const [gx, gy, gs] of GRAIN) ctx.fillRect(x + gx * side, y + gy * side, 1.6 * gs, 1.6 * gs);
  if (side >= 300 && o.border !== false) zigzagBand(ctx, th, x, y, side, side * 0.06);
  const bg = ctx.createLinearGradient(0, y, 0, y + side);
  bg.addColorStop(0, 'rgba(255,255,255,0.32)'); bg.addColorStop(0.1, 'rgba(255,255,255,0)'); bg.addColorStop(0.9, 'rgba(0,0,0,0)'); bg.addColorStop(1, 'rgba(0,0,0,0.25)');
  ctx.fillStyle = bg; ctx.fillRect(x, y, side, side);
  ctx.restore();
  ctx.strokeStyle = th.edge; ctx.lineWidth = 2; rr(ctx, x, y, side, side, r); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.24)'; ctx.lineWidth = 1.5; rr(ctx, x + 3, y + 3, side - 6, side - 6, r - 2); ctx.stroke();
  ctx.restore();
}

// A band of small triangles pressed into the slab around the pits, like a woven edging.
function zigzagBand(ctx, th, x, y, side, m) {
  const u = Math.max(5, m * 0.32), inset = m * 0.2;
  ctx.save();
  ctx.strokeStyle = th.band; ctx.globalAlpha = th.kind === 'sand' ? 0.6 : 0.8; ctx.lineWidth = Math.max(1.5, u * 0.22); ctx.lineJoin = 'miter';
  const edge = (x0, y0, dx, dy) => {
    const len = side - inset * 2;
    const n = Math.floor(len / (u * 2)), start = (len - n * u * 2) / 2;
    ctx.beginPath();
    for (let i = 0; i <= n * 2; i++) {
      const s = start + i * u, t = (i % 2) * u * 1.2;
      const px = x0 + dx * s - dy * t, py = y0 + dy * s + dx * t;
      if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
    }
    ctx.stroke();
  };
  edge(x + inset, y + inset, 1, 0);
  edge(x + side - inset, y + inset, 0, 1);
  edge(x + side - inset, y + side - inset, -1, 0);
  edge(x + inset, y + side - inset, 0, -1);
  ctx.restore();
}

// The 25 carved pockets. The centre pocket carries a carved diamond: the safe square.
export function drawPits(ctx, th, geo, o = {}) {
  const { cell, centers } = geo;
  const sz = cell * 0.9, rad = cell * 0.12;
  for (let i = 0; i < NN; i++) {
    const [cx, cy] = centers[i];
    const x = cx - sz / 2, y = cy - sz / 2;
    ctx.save();
    ctx.fillStyle = th.pitLip; rr(ctx, x, y + 2.2, sz, sz, rad); ctx.fill();
    const g = ctx.createLinearGradient(x, y, x + sz * 0.4, y + sz);
    g.addColorStop(0, th.pit[0]); g.addColorStop(1, th.pit[1]);
    ctx.fillStyle = g; rr(ctx, x, y, sz, sz, rad); ctx.fill();
    // inner shadow along the top and left walls
    ctx.save(); rr(ctx, x, y, sz, sz, rad); ctx.clip();
    ctx.strokeStyle = 'rgba(0,0,0,0.38)'; ctx.lineWidth = sz * 0.1;
    ctx.beginPath(); ctx.moveTo(x - 2, y + sz * 0.02); ctx.lineTo(x + sz + 2, y + sz * 0.02); ctx.moveTo(x + sz * 0.02, y - 2); ctx.lineTo(x + sz * 0.02, y + sz + 2); ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = th.pitEdge; ctx.lineWidth = 1.6; rr(ctx, x, y, sz, sz, rad); ctx.stroke();
    ctx.restore();
    if (i === CENTRE && !o.noCentre) {
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(Math.PI / 4);
      for (let k = 0; k < 2; k++) {
        const q = sz * (k ? 0.22 : 0.34);
        ctx.strokeStyle = th.carve; ctx.globalAlpha = 0.85; ctx.lineWidth = Math.max(2, sz * 0.035);
        ctx.strokeRect(-q, -q, q * 2, q * 2);
        ctx.strokeStyle = th.pitLip; ctx.globalAlpha = 0.5; ctx.lineWidth = 1.2; ctx.strokeRect(-q + 1.5, -q + 2.5, q * 2, q * 2);
      }
      ctx.restore();
    }
  }
}

// Whole board with stones, for small illustrations. cells: string of ./X/O (25 chars, '/' and spaces ignored) or an array.
// o: { hl: [i], dots: [i], arrows: [[from, to]], marks: [i] (red X on stones about to be captured), who }
export function drawMiniBoard(ctx, th, x, y, side, cells, o = {}) {
  const geo = boardGeo(x, y, side);
  drawSlab(ctx, th, x, y, side, { flat: true, thick: side * 0.03, border: side >= 260 });
  drawPits(ctx, th, geo);
  const arr = typeof cells === 'string' ? cells.replace(/[\s/]/g, '').split('').map((ch) => (ch === 'X' ? 1 : ch === 'O' ? 2 : 0)) : cells;
  for (const i of o.hl ?? []) {
    const [cx, cy] = geo.centers[i];
    ctx.save(); ctx.fillStyle = alpha(th.accent, 0.28); rr(ctx, cx - geo.cell * 0.45, cy - geo.cell * 0.45, geo.cell * 0.9, geo.cell * 0.9, geo.cell * 0.12); ctx.fill();
    ctx.strokeStyle = th.accent; ctx.lineWidth = Math.max(2, side * 0.01); ctx.setLineDash([8, 6]); ctx.stroke(); ctx.restore();
  }
  for (const i of o.dots ?? []) {
    const [cx, cy] = geo.centers[i];
    ctx.save(); ctx.fillStyle = alpha(th.accent, 0.9); ctx.beginPath(); ctx.arc(cx, cy, geo.cell * 0.1, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }
  arr.forEach((v, i) => { if (v) { const [cx, cy] = geo.centers[i]; drawStone(ctx, th, v, cx, cy, geo.d, { noShadow: side < 200, cell: i }); } });
  for (const i of o.marks ?? []) { const [cx, cy] = geo.centers[i]; drawCross(ctx, cx, cy, geo.cell * 0.3); }
  for (const [a, b] of o.arrows ?? []) arrowBetween(ctx, th.accent, geo.centers[a], geo.centers[b], geo.cell * 0.28);
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
