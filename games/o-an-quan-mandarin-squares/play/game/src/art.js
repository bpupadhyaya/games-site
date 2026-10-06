// Drawing helpers: themes, the painted wooden board, lit stones, panels, flat buttons, icons.
// Plain canvas 2D, no images, nothing here changes game state.

export const W = 720, H = 1560;
// The live screen size (virtual units): layout.js setSize() keeps it current, background() fills all of it.
export const VIEW = { w: 720, h: 1560 };
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
// bg: three background stops; frame/field/pit: the board wood, its inlay and the carved squares; dan: the small stones;
// quan: the mandarin stone (base, highlight, shadow); the rest is the shared UI palette.
export const THEMES = [
  {
    id: 'lacquer', name: 'Lacquer & Gold', kind: 'lacquer',
    bg: ['#150a07', '#2c150d', '#190b08'], glow: 'rgba(255,150,70,0.24)', fleck: '240,190,120',
    frame: ['#b5683a', '#7a3a1d'], frameEdge: '#4a200f', grain: 'rgba(60,24,10,0.22)', stud: '#e8c15a',
    field: ['#4a2210', '#341608'], pit: ['#2a1108', '#4d2512'], pitRim: 'rgba(255,214,160,0.40)', inlay: '#e0b050', mandPit: ['#241008', '#512812'],
    dan: ['#f2ead6', '#ddd1b4', '#cdbd9a', '#e6dcc2', '#b9c6b4'], danLo: '#6b5d44',
    quan: { base: '#2fae8a', hi: '#b9fbe3', lo: '#0c4c3b', ring: '#f1cf72' },
    accent: '#f0c565', ink: '#f8eedb', win: '#ffd877',
    panel: ['rgba(52,26,16,0.96)', 'rgba(30,14,9,0.98)'], stroke: 'rgba(240,197,101,0.55)',
    btn: ['#5c3320', '#43251a'], btnOn: ['#2f9a80', '#1f6c59'], primary: ['#f2cf7a', '#d8a346'], primaryInk: '#3a2108',
  },
  {
    id: 'bamboo', name: 'Bamboo & Jade', kind: 'bamboo',
    bg: ['#08150f', '#14342a', '#0a1913'], glow: 'rgba(240,220,140,0.18)', fleck: '240,230,170',
    frame: ['#dcb26a', '#a97a35'], frameEdge: '#5e3f14', grain: 'rgba(110,70,20,0.26)', stud: '#f5e6b0',
    field: ['#7b5a2a', '#5d4120'], pit: ['#4e3416', '#8c6a37'], pitRim: 'rgba(255,240,200,0.5)', inlay: '#2f8a68', mandPit: ['#46300f', '#8a6430'],
    dan: ['#fbf5e4', '#ece2c8', '#d9ceb0', '#f2ead4', '#c7d6c4'], danLo: '#7a6a4a',
    quan: { base: '#c7473c', hi: '#ffc2b6', lo: '#6a1712', ring: '#f6dc8a' },
    accent: '#f2d27a', ink: '#f6efdc', win: '#ffe08a',
    panel: ['rgba(18,48,38,0.96)', 'rgba(10,30,24,0.98)'], stroke: 'rgba(242,210,122,0.5)',
    btn: ['#27503f', '#1b3a2d'], btnOn: ['#b8433a', '#862b25'], primary: ['#f2d27a', '#d6a548'], primaryInk: '#33220c',
  },
];
export const themeById = (id) => THEMES.find((t) => t.id === id) ?? THEMES[0];

export function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }

export function text(ctx, str, x, y, size, color = '#fff', o = {}) {
  ctx.font = `${o.weight ?? 600} ${size}px ${o.font ?? UI}`;
  ctx.textAlign = o.align ?? 'center';
  ctx.textBaseline = o.base ?? 'alphabetic';
  if (o.shadow) { ctx.shadowColor = o.shadow; ctx.shadowBlur = o.blur ?? 6; ctx.shadowOffsetY = o.dy ?? 2; }
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
  if (o.shadow) { ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0; }
}

// ---------------------------------------------------------------------------------------------------- background
const FLECKS = Array.from({ length: 30 }, (_, i) => [((i * 97) % 211) / 211 * W, ((i * 53) % 173) / 173 * H, 0.6 + ((i * 31) % 7) / 7, ((i * 13) % 11) / 11]);

export function background(ctx, th, t, glowY = 700) {
  const w = VIEW.w, h = VIEW.h, sx = w / W, sh = Math.hypot(w, h) / Math.hypot(W, H);
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, th.bg[0]); g.addColorStop(0.5, th.bg[1]); g.addColorStop(1, th.bg[2]);
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  const gy = glowY * h / H, gr = 640 * Math.max(1, sx * 0.8);
  const hg = ctx.createRadialGradient(w / 2, gy, 40, w / 2, gy, gr);
  hg.addColorStop(0, th.glow); hg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = hg; ctx.fillRect(0, 0, w, h);
  for (const [x, y, s, ph] of FLECKS) {
    const yy = ((y * h / H) + t * (3 + s * 3)) % h;
    const a = 0.06 + 0.12 * (0.5 + 0.5 * Math.sin(t * 0.7 + ph * 9));
    ctx.fillStyle = `rgba(${th.fleck},${a})`;
    ctx.fillRect(x * sx, yy, 2.2 * s, 2.2 * s);
  }
  const vg = ctx.createRadialGradient(w / 2, h / 2, 560 * sh, w / 2, h / 2, 1020 * sh);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.5)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, w, h);
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

// The small second line of a button: 62 percent of the label, but never under ~22 units (readable on a small phone).
export const subSize = (size) => Math.max(size * 0.62, Math.min(22, size * 0.8));

// Flat buttons: one solid fill, a hairline border, a darker underside strip when at rest. No gloss shape.
// kind: primary | normal | on | danger | ghost
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
  const size = o.size ?? 28, line = o.line ?? size * 1.22, subs = o.sub ?? [], ss = subSize(size);
  const total = lines.length * line + (subs.length ? subs.length * ss * 1.26 + 4 : 0);
  let ty = y + (r.h - total) / 2 + size * 0.9;
  for (const ln of lines) { text(ctx, ln, r.x + r.w / 2, ty, size, color, { weight: 700 }); ty += line; }
  for (const ln of subs) { ty += size * 0.04; text(ctx, ln, r.x + r.w / 2, ty, ss, kind === 'primary' ? alpha(th.primaryInk, 0.78) : 'rgba(246,236,214,0.72)', { weight: 500 }); ty += ss * 1.26; }
  ctx.restore();
}

export function star(ctx, x, y, r, fill, stroke) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 ? r * 0.46 : r;
    ctx.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad);
  }
  ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1.5; ctx.stroke(); }
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

// ---------------------------------------------------------------------------------------------------- the board
// Everything on the board is drawn in "board units": the board is BW x BH units and is scaled to fit its screen rectangle.
// Ring order: 0 = left mandarin square, 1..5 = bottom row left to right, 6 = right mandarin square, 7..11 = top row right to left.
export const BW = 696, BH = 374, PAD = 14, PIT_W = 96, ROW_H = 170, ROW_GAP = 6;
const CELL_X0 = PAD + PIT_W + 4;
export const CELL_W = (BW - 2 * CELL_X0) / 5;

export function cellRect(i) {
  if (i === 0) return { x: PAD, y: PAD, w: PIT_W, h: 2 * ROW_H + ROW_GAP, cx: PAD + PIT_W / 2, cy: BH / 2, mand: true };
  if (i === 6) return { x: BW - PAD - PIT_W, y: PAD, w: PIT_W, h: 2 * ROW_H + ROW_GAP, cx: BW - PAD - PIT_W / 2, cy: BH / 2, mand: true };
  const bottom = i <= 5;
  const col = bottom ? i - 1 : 11 - i;
  const x = CELL_X0 + col * CELL_W, y = PAD + (bottom ? ROW_H + ROW_GAP : 0);
  return { x, y, w: CELL_W, h: ROW_H, cx: x + CELL_W / 2, cy: y + ROW_H / 2, mand: false, top: !bottom };
}
export const CELLS = Array.from({ length: 12 }, (_, i) => cellRect(i));

// geo: where the board sits on screen. sc = screen pixels per board unit.
export function boardGeo(x, y, w) {
  const sc = w / BW;
  return { x, y, w, h: BH * sc, sc, toLocal: (sx, sy) => [(sx - x) / sc, (sy - y) / sc], toScreen: (lx, ly) => [x + lx * sc, y + ly * sc] };
}
export function cellAt(geo, sx, sy) {
  const [lx, ly] = geo.toLocal(sx, sy);
  for (let i = 0; i < 12; i++) {
    const r = CELLS[i];
    if (lx >= r.x - 2 && lx <= r.x + r.w + 2 && ly >= r.y - 2 && ly <= r.y + r.h + 2) return i;
  }
  return -1;
}

const GOLDEN = 2.399963;
const frac = (v) => v - Math.floor(v);
const hash = (a, b) => frac(Math.sin(a * 127.1 + b * 311.7) * 43758.5453);

// Where the k-th small stone of a square lies (board units). hasQ: a mandarin stone sits in the middle of that square.
export function slotPos(cell, k, hasQ) {
  const r = CELLS[cell];
  const ang = k * GOLDEN + cell * 0.9;
  let rad = 11.6 * Math.sqrt(k);
  if (rad > 40) rad = 40 + (rad - 40) * 0.25;
  let sx = 1, sy = r.mand ? 1.7 : 1.3;
  if (hasQ) { rad = 44 + 10.5 * Math.sqrt(k); if (rad > 62) rad = 62 + (rad - 62) * 0.3; sx = 0.7; sy = 1.6; }
  else if (r.mand) { rad = 12 * Math.sqrt(k); if (rad > 52) rad = 52 + (rad - 52) * 0.3; sx = 1.0; sy = 1.75; }
  return [r.cx + Math.cos(ang) * rad * sx, r.cy + Math.sin(ang) * rad * sy * 0.8];
}

// ---- one small stone (dan): a lit pebble. seed picks its tone, size and tilt so no two look alike.
export function drawDan(ctx, th, x, y, seed, o = {}) {
  const r0 = 16.8 + hash(seed, 3) * 2.4;
  const s = o.scale ?? 1, r = r0 * s;
  const col = th.dan[Math.floor(hash(seed, 7) * th.dan.length) % th.dan.length];
  const a = o.alpha ?? 1;
  ctx.save();
  ctx.globalAlpha = a;
  if (!o.noShadow) {
    const lf = o.lift ?? 0;
    ctx.fillStyle = 'rgba(0,0,0,0.16)';
    ctx.beginPath(); ctx.ellipse(x + 3.2, y + 6 + lf, r * 1.18, r * 0.82, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.26)';
    ctx.beginPath(); ctx.ellipse(x + 2.4, y + 4.4 + lf, r * 0.98, r * 0.62, 0, 0, Math.PI * 2); ctx.fill();
  }
  const yy = y - (o.lift ?? 0) * 0.5;
  const g = ctx.createRadialGradient(x - r * 0.36, yy - r * 0.42, r * 0.1, x, yy, r * 1.05);
  g.addColorStop(0, '#ffffff'); g.addColorStop(0.28, col); g.addColorStop(1, th.danLo);
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.ellipse(x, yy, r, r * 0.9, hash(seed, 5) * 3, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(40,24,10,0.35)'; ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.beginPath(); ctx.ellipse(x - r * 0.34, yy - r * 0.4, r * 0.24, r * 0.14, -0.6, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

// ---- the mandarin stone (quan): large, polished, ringed in gold.
export function drawQuan(ctx, th, x, y, o = {}) {
  const r = 34 * (o.scale ?? 1), q = th.quan, yy = y - (o.lift ?? 0) * 0.5;
  ctx.save();
  ctx.globalAlpha = o.alpha ?? 1;
  ctx.fillStyle = 'rgba(0,0,0,0.38)';
  ctx.beginPath(); ctx.ellipse(x + 3, y + 7 + (o.lift ?? 0), r * 1.0, r * 0.62, 0, 0, Math.PI * 2); ctx.fill();
  if (o.glow) { ctx.shadowColor = th.accent; ctx.shadowBlur = 26 * o.glow; }
  const g = ctx.createRadialGradient(x - r * 0.34, yy - r * 0.4, r * 0.1, x, yy, r * 1.05);
  g.addColorStop(0, q.hi); g.addColorStop(0.4, q.base); g.addColorStop(1, q.lo);
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x, yy, r, 0, Math.PI * 2); ctx.fill();
  ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0;
  ctx.strokeStyle = q.ring; ctx.lineWidth = 3.2;
  ctx.beginPath(); ctx.arc(x, yy, r - 1.6, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,240,190,0.55)'; ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.arc(x, yy, r * 0.62, 0, Math.PI * 2); ctx.stroke();
  // a small diamond inlay in the centre
  ctx.fillStyle = q.ring; ctx.globalAlpha = (o.alpha ?? 1) * 0.9;
  ctx.beginPath(); ctx.moveTo(x, yy - r * 0.26); ctx.lineTo(x + r * 0.2, yy); ctx.lineTo(x, yy + r * 0.26); ctx.lineTo(x - r * 0.2, yy); ctx.closePath(); ctx.fill();
  ctx.globalAlpha = (o.alpha ?? 1) * 0.6; ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.ellipse(x - r * 0.38, yy - r * 0.45, r * 0.26, r * 0.15, -0.6, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function woodGrain(ctx, th, x, y, w, h, n, seed) {
  ctx.save();
  ctx.strokeStyle = th.grain;
  for (let i = 0; i < n; i++) {
    const yy = y + (i + 0.5) * (h / n);
    ctx.lineWidth = 0.8 + (i % 3 === 0 ? 1.2 : 0);
    ctx.beginPath(); ctx.moveTo(x, yy);
    ctx.bezierCurveTo(x + w * 0.3, yy + Math.sin(i + seed) * 4, x + w * 0.65, yy - Math.cos(i * 1.7 + seed) * 5, x + w, yy + Math.sin(i * 0.6 + seed) * 4);
    ctx.stroke();
  }
  ctx.restore();
}

function pitPath(ctx, r, grow = 0) {
  const x = r.x + 4 - grow, y = r.y + 4 - grow, w = r.w - 8 + grow * 2, h = r.h - 8 + grow * 2;
  if (r.mand) {
    const left = r.cx < BW / 2;
    ctx.beginPath(); ctx.roundRect(x, y, w, h, left ? [64, 26, 26, 64] : [26, 64, 64, 26]);
  } else { ctx.beginPath(); ctx.roundRect(x, y, w, h, 34); }
}

// The wooden board itself (frame, inlay, carved squares). Draws in board units.
export function drawBoardBase(ctx, th, o = {}) {
  // soft shadow on the table
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 30; ctx.shadowOffsetY = 14;
  ctx.fillStyle = th.frame[1];
  ctx.beginPath(); ctx.roundRect(0, 6, BW, BH, 28); ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.beginPath(); ctx.roundRect(0, 0, BW, BH, 28); ctx.clip();
  const g = ctx.createLinearGradient(0, 0, 0, BH);
  g.addColorStop(0, th.frame[0]); g.addColorStop(1, th.frame[1]);
  ctx.fillStyle = g; ctx.fillRect(0, 0, BW, BH);
  woodGrain(ctx, th, 0, 0, BW, BH, 30, 1);
  // inner field (the dark recessed play area)
  const fg = ctx.createLinearGradient(0, PAD - 6, 0, BH - PAD + 6);
  fg.addColorStop(0, th.field[0]); fg.addColorStop(1, th.field[1]);
  ctx.fillStyle = fg;
  ctx.beginPath(); ctx.roundRect(PAD - 6, PAD - 6, BW - 2 * PAD + 12, BH - 2 * PAD + 12, 22); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 3; ctx.stroke();
  ctx.strokeStyle = 'rgba(255,230,190,0.28)'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.roundRect(PAD - 8, PAD - 8, BW - 2 * PAD + 16, BH - 2 * PAD + 16, 24); ctx.stroke();
  ctx.restore();
  // top bevel highlight and edge
  ctx.save();
  ctx.strokeStyle = 'rgba(255,235,200,0.35)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect(2, 2, BW - 4, BH - 4, 26); ctx.stroke();
  ctx.strokeStyle = th.frameEdge; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.roundRect(0, 0, BW, BH, 28); ctx.stroke();
  ctx.restore();
  // river inlay between the two rows
  const ry = PAD + ROW_H + ROW_GAP / 2;
  ctx.save();
  ctx.strokeStyle = th.inlay; ctx.globalAlpha = 0.85; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(CELL_X0 + 6, ry); ctx.lineTo(BW - CELL_X0 - 6, ry); ctx.stroke();
  ctx.fillStyle = th.inlay;
  for (let i = 0; i <= 5; i++) {
    const dx = CELL_X0 + i * CELL_W;
    ctx.beginPath(); ctx.moveTo(dx, ry - 4); ctx.lineTo(dx + 4, ry); ctx.lineTo(dx, ry + 4); ctx.lineTo(dx - 4, ry); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
  // carved squares
  for (let i = 0; i < 12; i++) {
    const r = CELLS[i];
    const pg = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
    const pc = r.mand ? th.mandPit : th.pit;
    pg.addColorStop(0, pc[0]); pg.addColorStop(1, pc[1]);
    pitPath(ctx, r, 0);
    ctx.save();
    ctx.shadowColor = th.pitRim; ctx.shadowBlur = 0; ctx.shadowOffsetY = 2.5;
    ctx.fillStyle = pg; ctx.fill();
    ctx.restore();
    ctx.save();
    pitPath(ctx, r, 0); ctx.clip();
    const vg = ctx.createRadialGradient(r.cx, r.cy + 10, 10, r.cx, r.cy, Math.max(r.w, r.h) * 0.62);
    vg.addColorStop(0, 'rgba(255,225,170,0.12)'); vg.addColorStop(1, 'rgba(0,0,0,0.42)');
    ctx.fillStyle = vg; ctx.fillRect(r.x, r.y, r.w, r.h);
    // dark inner shadow along the upper edge
    const sg = ctx.createLinearGradient(0, r.y, 0, r.y + 28);
    sg.addColorStop(0, 'rgba(0,0,0,0.55)'); sg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = sg; ctx.fillRect(r.x, r.y, r.w, 28);
    ctx.restore();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 2; pitPath(ctx, r, 0); ctx.stroke();
    if (r.mand) {
      ctx.save(); ctx.strokeStyle = th.inlay; ctx.globalAlpha = 0.8; ctx.lineWidth = 2.5; pitPath(ctx, r, -7); ctx.stroke(); ctx.restore();
    }
  }
  // brass studs in the corners
  for (const [sx, sy] of [[8, 8], [BW - 8, 8], [8, BH - 8], [BW - 8, BH - 8]]) {
    ctx.fillStyle = th.stud; ctx.beginPath(); ctx.arc(sx, sy, 3.6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.arc(sx + 0.8, sy + 1, 1.6, 0, Math.PI * 2); ctx.fill();
  }
}

// Stones of every square from a view. view: { cells[12], q[2], hidden: {cell: n} (stones of that cell not drawn: still in the air) }
export function drawBoardStones(ctx, th, view) {
  for (let i = 0; i < 12; i++) {
    const n = view.cells[i], hasQ = i === 0 ? view.q[0] === 1 : i === 6 ? view.q[1] === 1 : false;
    const items = [];
    for (let k = 0; k < n; k++) { const [x, y] = slotPos(i, k, hasQ); items.push({ x, y, k }); }
    if (hasQ) items.push({ x: CELLS[i].cx, y: CELLS[i].cy, k: -1 });
    items.sort((a, b) => (a.k === -1 ? -1e6 : a.y) - (b.k === -1 ? -1e6 : b.y));
    for (const it of items) {
      if (it.k === -1) drawQuan(ctx, th, it.x, it.y, { glow: view.quanGlow ?? 0 });
      else {
        // a stone that has just landed hops a little and settles
        const b = view.bounce ? view.bounce[`${i}:${it.k}`] : undefined;
        let hop = 0;
        if (b !== undefined) { const u = Math.min(1, b / 0.3); hop = Math.sin(u * Math.PI) * (1 - u) * 15; }
        drawDan(ctx, th, it.x, it.y - hop, i * 53 + it.k, { lift: hop * 1.2 });
      }
    }
  }
}

// Number pills on every square, and the highlight rings. view: { counts, sel, legal:Set, hint, pulse, zoom }
export function drawBoardMarks(ctx, th, view, text) {
  const z = view.zoom ?? 1, fs = Math.min(52, Math.max(21 * (1 + (z - 1) * 0.28), 21 / (view.sc ?? 1)));   // never smaller than ~21 screen units, however small the board is drawn
  for (let i = 0; i < 12; i++) {
    const r = CELLS[i], n = view.cells[i];
    const hasQ = i === 0 ? view.q[0] === 1 : i === 6 ? view.q[1] === 1 : false;
    if (!n && !hasQ && !view.showZero) continue;
    const label = `${n}`;
    const w = Math.max(34, label.length * fs * 0.62 + 18) + (hasQ ? 20 : 0), h = fs + 12;
    const px = r.cx, py = r.top ? r.y + 20 : r.y + r.h - 20;
    ctx.fillStyle = 'rgba(8,4,2,0.62)';
    ctx.beginPath(); ctx.roundRect(px - w / 2, py - h / 2, w, h, h / 2); ctx.fill();
    if (hasQ) { ctx.fillStyle = th.quan.base; ctx.beginPath(); ctx.arc(px - w / 2 + 14, py, 5.5, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = th.quan.ring; ctx.lineWidth = 1.6; ctx.stroke(); }
    text(ctx, label, px + (hasQ ? 7 : 0), py + fs * 0.34, fs, th.ink, { weight: 800 });
  }
}

export function ringCell(ctx, i, col, lw, a = 1, grow = 0) {
  ctx.save(); ctx.globalAlpha = a; ctx.strokeStyle = col; ctx.lineWidth = lw;
  pitPath(ctx, CELLS[i], grow); ctx.stroke(); ctx.restore();
}
export function fillCell(ctx, i, col, a) {
  ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = col; pitPath(ctx, CELLS[i], 0); ctx.fill(); ctx.restore();
}

// An arrow lying along the row from a square in a direction (dx = +1 right on screen, -1 left), for hints.
export function dirArrow(ctx, col, i, dx, a = 1) {
  const r = CELLS[i], y = r.cy + (r.top ? 38 : -38);
  const x0 = r.cx + dx * 4, x1 = r.cx + dx * 56;
  ctx.save(); ctx.globalAlpha = a; ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 7; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1 - dx * 8, y); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x1 + dx * 8, y); ctx.lineTo(x1 - dx * 10, y - 13); ctx.lineTo(x1 - dx * 10, y + 13); ctx.closePath(); ctx.fill();
  ctx.restore();
}

// A stack of stones carried in the "hand": up to 7 drawn, the rest implied by the number.
export function drawHand(ctx, th, h, text) {
  const n = h.n;
  if (n <= 0) return;
  const lift = 30 + (h.lift ?? 0);
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.14)';
  ctx.beginPath(); ctx.ellipse(h.x + 5, h.y + 14, 38, 18, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.beginPath(); ctx.ellipse(h.x + 4, h.y + 12, 28, 12, 0, 0, Math.PI * 2); ctx.fill();
  const show = Math.min(7, n);
  for (let k = 0; k < show; k++) {
    const a = k * GOLDEN, rad = k === 0 ? 0 : 9 + k * 1.2;
    drawDan(ctx, th, h.x + Math.cos(a) * rad, h.y - lift + Math.sin(a) * rad * 0.7, 900 + k * 7, { noShadow: true, scale: 0.95 });
  }
  if (n > 1) {
    const fs = Math.min(40, Math.max(22, 21 / (h.sc ?? 1))), w = String(n).length * fs * 0.62 + 20;
    ctx.fillStyle = th.accent; ctx.beginPath(); ctx.roundRect(h.x + 14, h.y - lift - 34, w, fs + 8, (fs + 8) / 2); ctx.fill();
    text(ctx, String(n), h.x + 14 + w / 2, h.y - lift - 34 + fs * 0.88 + 1, fs, th.primaryInk, { weight: 800 });
  }
  ctx.restore();
}
