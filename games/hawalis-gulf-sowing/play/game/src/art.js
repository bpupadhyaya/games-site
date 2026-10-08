// Drawing helpers: themes, the painted wooden board, lit stones, panels, flat buttons, icons.
// Plain canvas 2D, no images, nothing here changes game state.
import { N, CIRCUIT } from './engine.js';

export const W = 720, H = 1560;
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
// bg: three background stops; frame/field/pit: the board wood, its inlay and the carved holes; seeds: the seed colours;
// own: the two players' territory colours (index 0 = Player 1, bottom); the rest is the shared UI palette.
export const THEMES = [
  {
    id: 'dhow', name: 'Dhow Teak', kind: 'dhow',
    bg: ['#05131a', '#0d2c36', '#06161c'], glow: 'rgba(255,170,80,0.20)', fleck: '190,235,240',
    frame: ['#a2602f', '#5b2e14'], frameEdge: '#3a1b0a', grain: 'rgba(48,20,6,0.26)', stud: '#e9bd5a',
    field: ['#3b2212', '#26150a'], pit: ['#1d1008', '#47290f'], pitRim: 'rgba(255,214,150,0.42)', inlay: '#e0ac45',
    dan: ['#fffdf6', '#f3ead8', '#e6dac3', '#dcd0bb', '#d3dad8'], danLo: '#6f6150',
    own: ['#f2b84b', '#4fcfc3'],
    accent: '#f0bd58', ink: '#faf1de', win: '#ffd877',
    panel: ['rgba(18,40,48,0.96)', 'rgba(8,22,28,0.98)'], stroke: 'rgba(240,189,88,0.55)',
    btn: ['#27505a', '#1b3a43'], btnOn: ['#2f8f7f', '#1f655a'], primary: ['#f5c566', '#d49630'], primaryInk: '#34200a',
  },
  {
    id: 'sadu', name: 'Sadu Weave', kind: 'sadu',
    bg: ['#1a0b09', '#3b1712', '#1a0a08'], glow: 'rgba(255,130,80,0.20)', fleck: '255,205,160',
    frame: ['#8c3326', '#4a160f'], frameEdge: '#2e0c07', grain: 'rgba(40,10,6,0.30)', stud: '#efd9a0',
    field: ['#3a1a14', '#26100b'], pit: ['#1d0c08', '#4a2316'], pitRim: 'rgba(255,225,185,0.44)', inlay: '#ead3a2',
    dan: ['#fbf0d6', '#efd9a8', '#dcb87e', '#c48a52', '#e8e2cf'], danLo: '#5e3a1c',
    own: ['#f4c85a', '#6fd0d8'],
    accent: '#f3cd7a', ink: '#fbf0de', win: '#ffe08a',
    panel: ['rgba(58,24,18,0.96)', 'rgba(30,12,9,0.98)'], stroke: 'rgba(243,205,122,0.5)',
    btn: ['#6c2c22', '#4c1d16'], btnOn: ['#2f8d98', '#216770'], primary: ['#f4cf84', '#d5a049'], primaryInk: '#3a2008',
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
const FLECKS = Array.from({ length: 30 }, (_, i) => [((i * 97) % 211) / 211, ((i * 53) % 173) / 173, 0.6 + ((i * 31) % 7) / 7, ((i * 13) % 11) / 11]);

// Fills the whole live screen (w x h, default the phone canvas); glowY is the height of the soft light behind the board.
export function background(ctx, th, t, glowY = 700, w = W, h = H) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, th.bg[0]); g.addColorStop(0.5, th.bg[1]); g.addColorStop(1, th.bg[2]);
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  const hg = ctx.createRadialGradient(w / 2, glowY, 40, w / 2, glowY, Math.max(640, w * 0.62));
  hg.addColorStop(0, th.glow); hg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = hg; ctx.fillRect(0, 0, w, h);
  const n = Math.round(FLECKS.length * Math.max(1, (w * h) / (W * H)));
  for (let i = 0; i < n; i++) {
    const f = FLECKS[i % FLECKS.length], s = f[2], ph = f[3] + Math.floor(i / FLECKS.length) * 0.37;
    const x = ((f[0] + Math.floor(i / FLECKS.length) * 0.618) % 1) * w, yy = (f[1] * h + t * (3 + s * 3)) % h;
    const a = 0.06 + 0.12 * (0.5 + 0.5 * Math.sin(t * 0.7 + ph * 9));
    ctx.fillStyle = `rgba(${th.fleck},${a})`;
    ctx.fillRect(x, yy, 2.2 * s, 2.2 * s);
  }
  const hy = Math.hypot(w, h);
  const vg = ctx.createRadialGradient(w / 2, h / 2, hy * 0.33, w / 2, h / 2, hy * 0.6);
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
  const size = o.size ?? 28, line = o.line ?? size * 1.22, subs = o.sub ?? [];
  const total = lines.length * line + (subs.length ? subs.length * size * 0.78 + 4 : 0);
  let ty = y + (r.h - total) / 2 + size * 0.9;
  for (const ln of lines) { text(ctx, ln, r.x + r.w / 2, ty, size, color, { weight: 700 }); ty += line; }
  for (const ln of subs) { ty += size * 0.04; text(ctx, ln, r.x + r.w / 2, ty, size * 0.62, kind === 'primary' ? alpha(th.primaryInk, 0.78) : 'rgba(246,236,214,0.72)', { weight: 500 }); ty += size * 0.78; }
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
// Hole ids: row * 7 + col (row 0 = top, 3 = bottom; col 0 = left). Player 1 owns the two bottom rows (row 3 is its outer row, row 2
// its inner row); Player 2 owns the two top rows (row 0 outer, row 1 inner). A carved channel runs between the two halves.
export const BW = 696, PAD = 30, ROW_H = 126, MID = 36, BH = PAD * 2 + 4 * ROW_H + MID;
export const CELL_W = (BW - 2 * PAD) / 7;
export const HOLE_R = 41;
export const holeOwner = (i) => (i >= 14 ? 1 : 2);

export function cellRect(i) {
  const r = Math.floor(i / 7), c = i % 7;
  const cx = PAD + c * CELL_W + CELL_W / 2, cy = PAD + r * ROW_H + ROW_H / 2 + (r >= 2 ? MID : 0);
  return { x: cx - HOLE_R, y: cy - HOLE_R, w: HOLE_R * 2, h: HOLE_R * 2, cx, cy, r, c, owner: holeOwner(i) };
}
export const CELLS = Array.from({ length: N }, (_, i) => cellRect(i));

// geo: where the board sits on screen. sc = screen pixels per board unit.
export function boardGeo(x, y, w) {
  const sc = w / BW;
  return { x, y, w, h: BH * sc, sc, toLocal: (sx, sy) => [(sx - x) / sc, (sy - y) / sc], toScreen: (lx, ly) => [x + lx * sc, y + ly * sc] };
}
export function cellAt(geo, sx, sy) {
  const [lx, ly] = geo.toLocal(sx, sy);
  let best = -1, bd = Infinity;
  for (let i = 0; i < N; i++) {
    const r = CELLS[i], d = Math.hypot(lx - r.cx, ly - r.cy);
    if (d <= HOLE_R + 6 && d < bd) { bd = d; best = i; }
  }
  return best;
}

const GOLDEN = 2.399963;
const frac = (v) => v - Math.floor(v);
const hash = (a, b) => frac(Math.sin(a * 127.1 + b * 311.7) * 43758.5453);

// Where the k-th seed of a hole lies (board units).
export function slotPos(cell, k) {
  const r = CELLS[cell];
  const ang = k * GOLDEN + cell * 0.9;
  let rad = 8.4 * Math.sqrt(k);
  if (rad > 25) rad = 25 + (rad - 25) * 0.25;
  return [r.cx + Math.cos(ang) * rad, r.cy + Math.sin(ang) * rad * 0.93];
}

// ---- one seed: a lit pearl. seed picks its tone, size and tilt so no two look alike.
export function drawDan(ctx, th, x, y, seed, o = {}) {
  const r0 = 10.6 + hash(seed, 3) * 1.6;
  const s = o.scale ?? 1, r = r0 * s;
  const col = th.dan[Math.floor(hash(seed, 7) * th.dan.length) % th.dan.length];
  const a = o.alpha ?? 1;
  ctx.save();
  ctx.globalAlpha = a;
  if (!o.noShadow) {
    ctx.fillStyle = 'rgba(0,0,0,0.38)';
    ctx.beginPath(); ctx.ellipse(x + 2.0, y + 3.8 + (o.lift ?? 0), r * 0.98, r * 0.6, 0, 0, Math.PI * 2); ctx.fill();
  }
  const yy = y - (o.lift ?? 0) * 0.5;
  const g = ctx.createRadialGradient(x - r * 0.36, yy - r * 0.42, r * 0.08, x, yy, r * 1.08);
  g.addColorStop(0, '#ffffff'); g.addColorStop(0.3, col); g.addColorStop(1, th.danLo);
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.ellipse(x, yy, r, r * 0.94, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(30,16,6,0.34)'; ctx.lineWidth = 1;
  ctx.stroke();
  // a faint rose-and-sea sheen at the lower rim, like a pearl
  ctx.fillStyle = 'rgba(160,215,230,0.22)';
  ctx.beginPath(); ctx.ellipse(x + r * 0.28, yy + r * 0.42, r * 0.42, r * 0.2, 0.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.78)';
  ctx.beginPath(); ctx.ellipse(x - r * 0.34, yy - r * 0.4, r * 0.24, r * 0.14, -0.6, 0, Math.PI * 2); ctx.fill();
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
  ctx.beginPath(); ctx.arc(r.cx, r.cy, HOLE_R + grow, 0, Math.PI * 2);
}

// A woven band of small diamonds along a straight run (the Sadu pattern of the Gulf's weavers), one path, one fill.
function diamondRun(ctx, x0, y0, x1, y1, step, size) {
  const len = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.floor(len / step)), dx = (x1 - x0) / len, dy = (y1 - y0) / len, m = (len - (n - 1) * step) / 2;
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const cx = x0 + dx * (m + i * step), cy = y0 + dy * (m + i * step);
    ctx.moveTo(cx - size, cy); ctx.lineTo(cx, cy - size); ctx.lineTo(cx + size, cy); ctx.lineTo(cx, cy + size); ctx.closePath();
  }
  ctx.fill();
}

// The wooden board itself (frame, territories, carved holes). Draws in board units.
export function drawBoardBase(ctx, th, o = {}) {
  const midY0 = PAD + 2 * ROW_H, midY1 = midY0 + MID;
  // body with a deep soft shadow
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 34; ctx.shadowOffsetY = 16;
  ctx.fillStyle = th.frame[1];
  ctx.beginPath(); ctx.roundRect(0, 6, BW, BH, 32); ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.beginPath(); ctx.roundRect(0, 0, BW, BH, 32); ctx.clip();
  const g = ctx.createLinearGradient(0, 0, 0, BH);
  g.addColorStop(0, th.frame[0]); g.addColorStop(1, th.frame[1]);
  ctx.fillStyle = g; ctx.fillRect(0, 0, BW, BH);
  woodGrain(ctx, th, 0, 0, BW, BH, 40, 1);
  // plank seams
  ctx.strokeStyle = 'rgba(0,0,0,0.28)'; ctx.lineWidth = 2;
  for (const sx of [BW * 0.333, BW * 0.667]) { ctx.beginPath(); ctx.moveTo(sx, 0); ctx.lineTo(sx, PAD - 6); ctx.moveTo(sx, BH - PAD + 6); ctx.lineTo(sx, BH); ctx.stroke(); }
  // the recessed playing field
  const fg = ctx.createLinearGradient(0, PAD - 8, 0, BH - PAD + 8);
  fg.addColorStop(0, th.field[0]); fg.addColorStop(1, th.field[1]);
  ctx.fillStyle = fg;
  ctx.beginPath(); ctx.roundRect(PAD - 12, PAD - 12, BW - 2 * PAD + 24, BH - 2 * PAD + 24, 22); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = 3.5; ctx.stroke();
  // inner shadow along the top and left of the recess, a lit lip along the bottom and right (depth)
  ctx.save();
  ctx.beginPath(); ctx.roundRect(PAD - 12, PAD - 12, BW - 2 * PAD + 24, BH - 2 * PAD + 24, 22); ctx.clip();
  const sh = ctx.createLinearGradient(0, PAD - 12, 0, PAD + 26); sh.addColorStop(0, 'rgba(0,0,0,0.5)'); sh.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = sh; ctx.fillRect(0, PAD - 12, BW, 40);
  const sl = ctx.createLinearGradient(PAD - 12, 0, PAD + 20, 0); sl.addColorStop(0, 'rgba(0,0,0,0.38)'); sl.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = sl; ctx.fillRect(PAD - 12, 0, 32, BH);
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,225,180,0.30)'; ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.roundRect(PAD - 14, PAD - 14, BW - 2 * PAD + 28, BH - 2 * PAD + 28, 24); ctx.stroke();
  // the woven diamond band round the frame
  ctx.fillStyle = th.inlay; ctx.globalAlpha = 0.85;
  diamondRun(ctx, 40, 15, BW - 40, 15, 17, 5.2); diamondRun(ctx, 40, BH - 15, BW - 40, BH - 15, 17, 5.2);
  diamondRun(ctx, 15, 44, 15, BH - 44, 17, 5.2); diamondRun(ctx, BW - 15, 44, BW - 15, BH - 44, 17, 5.2);
  ctx.globalAlpha = 1;
  ctx.restore();
  // the two territories: a soft tint and a thin inlaid outline in the player's colour
  const L = PAD - 8, R = BW - PAD + 8, T = PAD - 8, B = BH - PAD + 8;
  const tint = (col, y0, y1) => {
    ctx.save();
    ctx.beginPath(); ctx.roundRect(L, y0, R - L, y1 - y0, 16); ctx.lineJoin = 'round';
    ctx.globalAlpha = 0.10; ctx.fillStyle = col; ctx.fill();
    ctx.globalAlpha = 0.5; ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.stroke();
    ctx.restore();
  };
  tint(th.own[1], T, midY0 - 6); tint(th.own[0], midY1 + 6, B);
  // the carved channel between the halves, with a brass inlay line and a row of small diamonds
  ctx.save();
  const cg = ctx.createLinearGradient(0, midY0, 0, midY1);
  cg.addColorStop(0, 'rgba(0,0,0,0.5)'); cg.addColorStop(0.5, 'rgba(0,0,0,0.18)'); cg.addColorStop(1, 'rgba(0,0,0,0.42)');
  ctx.fillStyle = cg; ctx.fillRect(PAD - 8, midY0 - 2, BW - 2 * PAD + 16, MID + 4);
  ctx.strokeStyle = th.inlay; ctx.globalAlpha = 0.7; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(PAD + 4, (midY0 + midY1) / 2); ctx.lineTo(BW - PAD - 4, (midY0 + midY1) / 2); ctx.stroke();
  ctx.globalAlpha = 0.95; ctx.fillStyle = th.inlay;
  diamondRun(ctx, PAD + 20, (midY0 + midY1) / 2, BW - PAD - 20, (midY0 + midY1) / 2, CELL_W, 8);
  ctx.restore();
  ctx.save();
  ctx.strokeStyle = 'rgba(255,235,200,0.35)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect(2, 2, BW - 4, BH - 4, 30); ctx.stroke();
  ctx.strokeStyle = th.frameEdge; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.roundRect(0, 0, BW, BH, 32); ctx.stroke();
  ctx.restore();
  // carved holes
  for (let i = 0; i < N; i++) {
    const r = CELLS[i];
    const pg = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
    pg.addColorStop(0, th.pit[0]); pg.addColorStop(1, th.pit[1]);
    pitPath(ctx, r, 0);
    ctx.save();
    ctx.shadowColor = th.pitRim; ctx.shadowBlur = 0; ctx.shadowOffsetY = 2.5;
    ctx.fillStyle = pg; ctx.fill();
    ctx.restore();
    ctx.save();
    pitPath(ctx, r, 0); ctx.clip();
    const vg = ctx.createRadialGradient(r.cx, r.cy + 10, 8, r.cx, r.cy, HOLE_R * 1.1);
    vg.addColorStop(0, 'rgba(255,225,170,0.12)'); vg.addColorStop(1, 'rgba(0,0,0,0.5)');
    ctx.fillStyle = vg; ctx.fillRect(r.x, r.y, r.w, r.h);
    const sg = ctx.createLinearGradient(0, r.y, 0, r.y + 28);
    sg.addColorStop(0, 'rgba(0,0,0,0.6)'); sg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = sg; ctx.fillRect(r.x, r.y, r.w, 28);
    ctx.restore();
    ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = 2; pitPath(ctx, r, 0); ctx.stroke();
    ctx.save(); ctx.strokeStyle = th.own[r.owner - 1]; ctx.globalAlpha = r.r === 1 || r.r === 2 ? 0.85 : 0.5; ctx.lineWidth = r.r === 1 || r.r === 2 ? 2.8 : 2; pitPath(ctx, r, 3.5); ctx.stroke(); ctx.restore();
  }
  // direction chevrons between neighbouring holes of each player's circuit
  if (!o.noArrows) {
    for (const p of [1, 2]) {
      const list = CIRCUIT[p];
      for (let k = 0; k < list.length; k++) {
        const a = CELLS[list[k]], b = CELLS[list[(k + 1) % list.length]];
        const ang = Math.atan2(b.cy - a.cy, b.cx - a.cx);
        let mx = (a.cx + b.cx) / 2, my = (a.cy + b.cy) / 2;
        if (Math.abs(b.cy - a.cy) > 20) { // the corner steps between the outer and the inner row
          my = (a.cy + b.cy) / 2;
        }
        ctx.save(); ctx.translate(mx, my); ctx.rotate(ang);
        ctx.fillStyle = th.own[p - 1]; ctx.globalAlpha = 0.8;
        ctx.beginPath(); ctx.moveTo(6.5, 0); ctx.lineTo(-3.5, -6.5); ctx.lineTo(-3.5, 6.5); ctx.closePath(); ctx.fill();
        ctx.restore();
      }
    }
  }
  // brass studs, like the studded doors of the Gulf: corners and the middle of each long edge
  for (const [sx, sy] of [[10, 10], [BW - 10, 10], [10, BH - 10], [BW - 10, BH - 10], [BW / 2, 9], [BW / 2, BH - 9], [9, BH / 2], [BW - 9, BH / 2]]) {
    const sg = ctx.createRadialGradient(sx - 1.2, sy - 1.4, 0.5, sx, sy, 5);
    sg.addColorStop(0, '#fff3c8'); sg.addColorStop(0.5, th.stud); sg.addColorStop(1, '#5a3a10');
    ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(sx, sy, 4.6, 0, Math.PI * 2); ctx.fill();
  }
}

// Seeds of every hole from a view. view: { cells[N] }
export function drawBoardStones(ctx, th, view) {
  for (let i = 0; i < N; i++) {
    const n = view.cells[i];
    const items = [];
    for (let k = 0; k < n; k++) { const [x, y] = slotPos(i, k); items.push({ x, y, k }); }
    items.sort((a, b) => a.y - b.y);
    for (const it of items) drawDan(ctx, th, it.x, it.y, i * 53 + it.k);
  }
}

// Number pills on every hole. view: { cells, zoom }
export function drawBoardMarks(ctx, th, view, text) {
  const z = view.zoom ?? 1, fs = 21 * (1 + (z - 1) * 0.22);
  for (let i = 0; i < N; i++) {
    const r = CELLS[i], n = view.cells[i];
    if (!n && !view.showZero) continue;
    const label = `${n}`;
    const w = Math.max(34, label.length * fs * 0.62 + 18), h = fs + 11;
    const px = r.cx, py = r.cy + HOLE_R + 2;
    ctx.fillStyle = 'rgba(8,4,2,0.74)';
    ctx.beginPath(); ctx.roundRect(px - w / 2, py - h / 2, w, h, h / 2); ctx.fill();
    ctx.strokeStyle = th.own[r.owner - 1]; ctx.globalAlpha = 0.7; ctx.lineWidth = 1.5; ctx.stroke(); ctx.globalAlpha = 1;
    text(ctx, label, px, py + fs * 0.34, fs, th.ink, { weight: 800 });
  }
}

export function ringCell(ctx, i, col, lw, a = 1, grow = 0) {
  ctx.save(); ctx.globalAlpha = a; ctx.strokeStyle = col; ctx.lineWidth = lw;
  pitPath(ctx, CELLS[i], grow); ctx.stroke(); ctx.restore();
}
export function fillCell(ctx, i, col, a) {
  ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = col; pitPath(ctx, CELLS[i], 0); ctx.fill(); ctx.restore();
}

// A stack of seeds carried in the "hand": up to 7 drawn, the rest implied by the number.
export function drawHand(ctx, th, h, text) {
  const n = h.n;
  if (n <= 0) return;
  const lift = 30 + (h.lift ?? 0);
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.30)';
  ctx.beginPath(); ctx.ellipse(h.x + 4, h.y + 12, 26, 12, 0, 0, Math.PI * 2); ctx.fill();
  const show = Math.min(7, n);
  for (let k = 0; k < show; k++) {
    const a = k * GOLDEN, rad = k === 0 ? 0 : 7.5 + k * 1.0;
    drawDan(ctx, th, h.x + Math.cos(a) * rad, h.y - lift + Math.sin(a) * rad * 0.7, 900 + k * 7, { noShadow: true, scale: 0.95 });
  }
  if (n > 1) {
    const fs = 22, w = String(n).length * fs * 0.62 + 20;
    ctx.fillStyle = th.accent; ctx.beginPath(); ctx.roundRect(h.x + 14, h.y - lift - 34, w, fs + 8, (fs + 8) / 2); ctx.fill();
    text(ctx, String(n), h.x + 14 + w / 2, h.y - lift - 34 + fs * 0.88 + 1, fs, th.primaryInk, { weight: 800 });
  }
  ctx.restore();
}
