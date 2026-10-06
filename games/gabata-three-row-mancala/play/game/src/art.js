// Drawing helpers: themes, the painted wooden board, lit stones, panels, flat buttons, icons.
// Plain canvas 2D, no images, nothing here changes game state.

export const W = 720, H = 1560;
export const UI = '-apple-system, "SF Pro Text", "Segoe UI", Roboto, "Noto Sans Ethiopic", "Kefa", "Nyala", "Abyssinica SIL", system-ui, sans-serif';
export const DISPLAY = '"Palatino Linotype", Palatino, "Iowan Old Style", Georgia, "Times New Roman", "Noto Serif Ethiopic", "Noto Sans Ethiopic", "Kefa", "Nyala", serif';

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
    id: 'acacia', name: 'Carved Acacia', kind: 'acacia',
    bg: ['#150b06', '#2e1a0d', '#190d07'], glow: 'rgba(255,160,70,0.22)', fleck: '240,190,120',
    frame: ['#b06a3a', '#6f3a1b'], frameEdge: '#44200d', grain: 'rgba(55,24,8,0.24)', stud: '#e2b457',
    field: ['#3f2412', '#2b180a'], pit: ['#22120a', '#4b2c15'], pitRim: 'rgba(255,214,160,0.40)', inlay: '#d9a441',
    dan: ['#f3e8cf', '#e6cf9c', '#d29a55', '#bd5b33', '#a5ad6c'], danLo: '#5c3a1c',
    own: ['#f2b94a', '#5fc2b2'],
    accent: '#f2bd55', ink: '#faf0dc', win: '#ffd877',
    panel: ['rgba(56,30,16,0.96)', 'rgba(30,15,8,0.98)'], stroke: 'rgba(242,189,85,0.55)',
    btn: ['#68391e', '#4a2815'], btnOn: ['#2f8f7f', '#1f655a'], primary: ['#f4c261', '#d4922d'], primaryInk: '#3a2108',
  },
  {
    id: 'clay', name: 'Highland Clay', kind: 'clay',
    bg: ['#1a0b08', '#3b1a10', '#1b0b07'], glow: 'rgba(255,120,80,0.20)', fleck: '255,200,150',
    frame: ['#c97b4c', '#8a4526'], frameEdge: '#53230f', grain: 'rgba(90,35,12,0.26)', stud: '#f0d8a0',
    field: ['#5a2f1b', '#40200f'], pit: ['#35190d', '#6a3b22'], pitRim: 'rgba(255,225,180,0.45)', inlay: '#e9c77a',
    dan: ['#fbf3e0', '#f0dcae', '#e0b868', '#c9704a', '#8fb09a'], danLo: '#6a4326',
    own: ['#f4c85a', '#7fc8d9'],
    accent: '#f6cf74', ink: '#fbf1de', win: '#ffe08a',
    panel: ['rgba(64,30,18,0.96)', 'rgba(34,15,9,0.98)'], stroke: 'rgba(246,207,116,0.5)',
    btn: ['#7a3f24', '#58301b'], btnOn: ['#3a8e9f', '#27616e'], primary: ['#f6d17a', '#d8a248'], primaryInk: '#3a2108',
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
// Hole ids: row * 6 + col (row 0 = top, 2 = bottom; col 0 = left). Player 1 owns the bottom row and the right half of the
// middle row; Player 2 owns the top row and the left half of the middle row.
export const BW = 696, PAD = 24, ROW_H = 148, BH = PAD * 2 + 3 * ROW_H;
export const CELL_W = (BW - 2 * PAD) / 6;
export const HOLE_R = 50;
const OWN1 = new Set([12, 13, 14, 15, 16, 17, 9, 10, 11]);
export const holeOwner = (i) => (OWN1.has(i) ? 1 : 2);

export function cellRect(i) {
  const r = Math.floor(i / 6), c = i % 6;
  const cx = PAD + c * CELL_W + CELL_W / 2, cy = PAD + r * ROW_H + ROW_H / 2;
  return { x: cx - HOLE_R, y: cy - HOLE_R, w: HOLE_R * 2, h: HOLE_R * 2, cx, cy, r, c, owner: holeOwner(i) };
}
export const CELLS = Array.from({ length: 18 }, (_, i) => cellRect(i));

// geo: where the board sits on screen. sc = screen pixels per board unit.
export function boardGeo(x, y, w) {
  const sc = w / BW;
  return { x, y, w, h: BH * sc, sc, toLocal: (sx, sy) => [(sx - x) / sc, (sy - y) / sc], toScreen: (lx, ly) => [x + lx * sc, y + ly * sc] };
}
export function cellAt(geo, sx, sy) {
  const [lx, ly] = geo.toLocal(sx, sy);
  let best = -1, bd = Infinity;
  for (let i = 0; i < 18; i++) {
    const r = CELLS[i], d = Math.hypot(lx - r.cx, ly - r.cy);
    if (d <= HOLE_R + 12 && d < bd) { bd = d; best = i; }
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
  let rad = 9.8 * Math.sqrt(k);
  if (rad > 30) rad = 30 + (rad - 30) * 0.25;
  return [r.cx + Math.cos(ang) * rad, r.cy + Math.sin(ang) * rad * 0.92];
}

// ---- one seed: a lit, glossy bean. seed picks its tone, size and tilt so no two look alike.
export function drawDan(ctx, th, x, y, seed, o = {}) {
  const r0 = 12.5 + hash(seed, 3) * 2.0;
  const s = o.scale ?? 1, r = r0 * s;
  const col = th.dan[Math.floor(hash(seed, 7) * th.dan.length) % th.dan.length];
  const a = o.alpha ?? 1;
  ctx.save();
  ctx.globalAlpha = a;
  if (!o.noShadow) {
    ctx.fillStyle = 'rgba(0,0,0,0.34)';
    ctx.beginPath(); ctx.ellipse(x + 2.2, y + 4.2 + (o.lift ?? 0), r * 0.98, r * 0.62, 0, 0, Math.PI * 2); ctx.fill();
  }
  const yy = y - (o.lift ?? 0) * 0.5;
  const g = ctx.createRadialGradient(x - r * 0.36, yy - r * 0.42, r * 0.1, x, yy, r * 1.05);
  g.addColorStop(0, '#ffffff'); g.addColorStop(0.28, col); g.addColorStop(1, th.danLo);
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.ellipse(x, yy, r, r * 0.88, hash(seed, 5) * 3, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(40,20,8,0.38)'; ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
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

// The wooden board itself (frame, territories, carved holes). Draws in board units.
export function drawBoardBase(ctx, th, o = {}) {
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 30; ctx.shadowOffsetY = 14;
  ctx.fillStyle = th.frame[1];
  ctx.beginPath(); ctx.roundRect(0, 6, BW, BH, 30); ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.beginPath(); ctx.roundRect(0, 0, BW, BH, 30); ctx.clip();
  const g = ctx.createLinearGradient(0, 0, 0, BH);
  g.addColorStop(0, th.frame[0]); g.addColorStop(1, th.frame[1]);
  ctx.fillStyle = g; ctx.fillRect(0, 0, BW, BH);
  woodGrain(ctx, th, 0, 0, BW, BH, 34, 1);
  const fg = ctx.createLinearGradient(0, PAD - 8, 0, BH - PAD + 8);
  fg.addColorStop(0, th.field[0]); fg.addColorStop(1, th.field[1]);
  ctx.fillStyle = fg;
  ctx.beginPath(); ctx.roundRect(PAD - 10, PAD - 10, BW - 2 * PAD + 20, BH - 2 * PAD + 20, 24); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 3; ctx.stroke();
  ctx.strokeStyle = 'rgba(255,230,190,0.28)'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.roundRect(PAD - 12, PAD - 12, BW - 2 * PAD + 24, BH - 2 * PAD + 24, 26); ctx.stroke();
  ctx.restore();
  // the two territories: a soft tint and a thin inlaid outline in the player's colour
  const m = BW / 2, L = PAD - 6, R = BW - PAD + 6, T = PAD - 6, B = BH - PAD + 6, y1 = PAD + ROW_H, y2 = PAD + 2 * ROW_H;
  const tint = (owner, col) => {
    ctx.save();
    ctx.beginPath();
    if (owner === 2) { ctx.moveTo(L, T); ctx.lineTo(R, T); ctx.lineTo(R, y1); ctx.lineTo(m, y1); ctx.lineTo(m, y2); ctx.lineTo(L, y2); } else { ctx.moveTo(R, B); ctx.lineTo(L, B); ctx.lineTo(L, y2); ctx.lineTo(m, y2); ctx.lineTo(m, y1); ctx.lineTo(R, y1); }
    ctx.closePath();
    ctx.lineJoin = 'round';
    ctx.globalAlpha = 0.1; ctx.fillStyle = col; ctx.fill();
    ctx.globalAlpha = 0.5; ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.stroke();
    ctx.restore();
  };
  tint(2, th.own[1]); tint(1, th.own[0]);
  ctx.save();
  ctx.strokeStyle = 'rgba(255,235,200,0.35)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect(2, 2, BW - 4, BH - 4, 28); ctx.stroke();
  ctx.strokeStyle = th.frameEdge; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.roundRect(0, 0, BW, BH, 30); ctx.stroke();
  ctx.restore();
  // carved holes
  for (let i = 0; i < 18; i++) {
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
    vg.addColorStop(0, 'rgba(255,225,170,0.12)'); vg.addColorStop(1, 'rgba(0,0,0,0.45)');
    ctx.fillStyle = vg; ctx.fillRect(r.x, r.y, r.w, r.h);
    const sg = ctx.createLinearGradient(0, r.y, 0, r.y + 30);
    sg.addColorStop(0, 'rgba(0,0,0,0.55)'); sg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = sg; ctx.fillRect(r.x, r.y, r.w, 30);
    ctx.restore();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 2; pitPath(ctx, r, 0); ctx.stroke();
    ctx.save(); ctx.strokeStyle = th.own[r.owner - 1]; ctx.globalAlpha = 0.55; ctx.lineWidth = 2.2; pitPath(ctx, r, 4); ctx.stroke(); ctx.restore();
  }
  // direction chevrons between neighbouring holes of each player's circuit
  if (!o.noArrows) {
    for (const [p, list] of [[1, [12, 13, 14, 15, 16, 17, 11, 10, 9]], [2, [5, 4, 3, 2, 1, 0, 6, 7, 8]]]) {
      for (let k = 0; k < 8; k++) {
        const a = CELLS[list[k]], b = CELLS[list[k + 1]];
        const ang = Math.atan2(b.cy - a.cy, b.cx - a.cx), mx = (a.cx + b.cx) / 2, my = (a.cy + b.cy) / 2;
        if (Math.hypot(b.cx - a.cx, b.cy - a.cy) > CELL_W * 1.2) continue;
        ctx.save(); ctx.translate(mx, my); ctx.rotate(ang);
        ctx.fillStyle = th.own[p - 1]; ctx.globalAlpha = 0.75;
        ctx.beginPath(); ctx.moveTo(6, 0); ctx.lineTo(-4, -6.5); ctx.lineTo(-4, 6.5); ctx.closePath(); ctx.fill();
        ctx.restore();
      }
    }
  }
  for (const [sx, sy] of [[9, 9], [BW - 9, 9], [9, BH - 9], [BW - 9, BH - 9]]) {
    ctx.fillStyle = th.stud; ctx.beginPath(); ctx.arc(sx, sy, 3.8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.arc(sx + 0.8, sy + 1, 1.7, 0, Math.PI * 2); ctx.fill();
  }
}

// Seeds of every hole from a view. view: { cells[18] }
export function drawBoardStones(ctx, th, view) {
  for (let i = 0; i < 18; i++) {
    const n = view.cells[i];
    const items = [];
    for (let k = 0; k < n; k++) { const [x, y] = slotPos(i, k); items.push({ x, y, k }); }
    items.sort((a, b) => a.y - b.y);
    for (const it of items) drawDan(ctx, th, it.x, it.y, i * 53 + it.k);
  }
}

// Number pills on every hole. view: { cells, zoom }
export function drawBoardMarks(ctx, th, view, text) {
  const z = view.zoom ?? 1, fs = 22 * (1 + (z - 1) * 0.22);
  for (let i = 0; i < 18; i++) {
    const r = CELLS[i], n = view.cells[i];
    if (!n && !view.showZero) continue;
    const label = `${n}`;
    const w = Math.max(36, label.length * fs * 0.62 + 18), h = fs + 12;
    const px = r.cx, py = r.cy + HOLE_R - 2;
    ctx.fillStyle = 'rgba(8,4,2,0.7)';
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
    drawDan(ctx, th, h.x + Math.cos(a) * rad, h.y - lift + Math.sin(a) * rad * 0.7, 900 + k * 7, { noShadow: true, scale: 0.92 });
  }
  if (n > 1) {
    const fs = 22, w = String(n).length * fs * 0.62 + 20;
    ctx.fillStyle = th.accent; ctx.beginPath(); ctx.roundRect(h.x + 14, h.y - lift - 34, w, fs + 8, (fs + 8) / 2); ctx.fill();
    text(ctx, String(n), h.x + 14 + w / 2, h.y - lift - 34 + fs * 0.88 + 1, fs, th.primaryInk, { weight: 800 });
  }
  ctx.restore();
}
