// Everything that is painted: the felt table, the cards, the card backs, the wells and the
// buttons. One light, from above. Static art is painted once into cached layers, so a frame
// is cheap. Nothing here changes the game.
import { W, H, CARD_W, CARD_H } from './layout.js';
import { rankLabel } from './deck.js';

export const FONT = '"Cormorant Garamond", Georgia, "Times New Roman", serif';
export const UI = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
export const CREAM = '#fbeedd';
export const GOLD = '#ffd35c';
export const ROSE = ['#ee6aa2', '#e0508f', '#9a1f5c'];
const TAU = Math.PI * 2;

// Card-back themes. Every theme is included with the game.
export const THEMES = [
  { id: 'classic', title: 'Classic', back: '#2255aa' },
  { id: 'sunset', title: 'Sunset', back: '#c9642f' },
  { id: 'ocean', title: 'Ocean', back: '#1a8f8f' },
  { id: 'rose', title: 'Rose', back: '#d6336c' },
  { id: 'violet', title: 'Violet', back: '#7048e8' },
  { id: 'forest', title: 'Forest', back: '#2f9e44' },
  { id: 'graphite', title: 'Graphite', back: '#495057' },
  { id: 'gold', title: 'Gold', back: '#d4a017' },
];

const STANDARD_INK = { S: '#121212', H: '#c0181f', D: '#c0181f', C: '#121212' };
// Four-colour deck: suit identity never depends on red-vs-black alone.
const FOUR_COLOR_INK = { S: '#121212', H: '#c0181f', D: '#1558b0', C: '#14713a' };
export const ink = (four, suit) => (four ? FOUR_COLOR_INK : STANDARD_INK)[suit];

// Table colours (index 0 is the original felt green and stays the default).
export const TABLES = [
  { name: 'Green', stops: ['#2f8f68', '#1d5f45', '#234a38'] },
  { name: 'Blue', stops: ['#3f78c8', '#245093', '#183a68'] },
  { name: 'Burgundy', stops: ['#a83a55', '#7a2340', '#4f1729'] },
  { name: 'Charcoal', stops: ['#4a5060', '#2c303c', '#1a1c24'] },
  { name: 'Purple', stops: ['#8b5cf6', '#5b21b6', '#2e1065'] },
  { name: 'Teal', stops: ['#2dd4bf', '#0f766e', '#134e4a'] },
  { name: 'Sunset', stops: ['#fb923c', '#c2410c', '#7c2d12'] },
  { name: 'Royal', stops: ['#6366f1', '#3730a3', '#1e1b4b'] },
  { name: 'Rose', stops: ['#fb7185', '#be123c', '#4c0519'] },
  { name: 'Midnight', stops: ['#1e3a8a', '#0f172a', '#020617'] },
];

function rgbOf(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [n >> 16, (n >> 8) & 0xff, n & 0xff];
}
export function mix(a, b, t) {
  const A = rgbOf(a), B = rgbOf(b);
  return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(',')})`;
}

function lcg(seed) {
  let s = seed >>> 0;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
}

function layer(w, h, scale, paint) {
  if (typeof OffscreenCanvas === 'undefined') return null;
  const c = new OffscreenCanvas(Math.ceil(w * scale), Math.ceil(h * scale));
  const lctx = c.getContext('2d');
  lctx.scale(scale, scale);
  paint(lctx);
  return c;
}

export function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// ---------------------------------------------------------------------------------------------
// The table: felt with a fine weave, a warm lamp above the middle and a soft vignette.
// ---------------------------------------------------------------------------------------------
function paintTable(ctx, index) {
  const [light, mid, dark] = TABLES[index].stops;
  // The brightest stop is pulled toward the middle one so the cloth stays rich, never glaring.
  const g = ctx.createRadialGradient(W / 2, H * 0.36, 80, W / 2, H * 0.5, H * 0.78);
  g.addColorStop(0, mix(light, mid, 0.62));
  g.addColorStop(0.55, mix(mid, dark, 0.15));
  g.addColorStop(1, dark);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // woven cloth: two fine diagonal threads and a scatter of fibres
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(255,255,255,0.030)';
  for (let x = -H; x < W; x += 7) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + H, H); ctx.stroke(); }
  ctx.strokeStyle = 'rgba(0,0,0,0.045)';
  for (let x = 0; x < W + H; x += 7) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x - H, H); ctx.stroke(); }
  const rnd = lcg(7 + index);
  for (let i = 0; i < 2600; i++) {
    const x = rnd() * W, y = rnd() * H, a = rnd() * TAU, l = 2 + rnd() * 4;
    ctx.strokeStyle = rnd() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)';
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); ctx.stroke();
  }

  const lamp = ctx.createRadialGradient(W / 2, H * 0.3, 40, W / 2, H * 0.36, 760);
  lamp.addColorStop(0, 'rgba(255,232,190,0.13)');
  lamp.addColorStop(1, 'rgba(255,232,190,0)');
  ctx.fillStyle = lamp;
  ctx.fillRect(0, 0, W, H);

  const vig = ctx.createRadialGradient(W / 2, H * 0.48, H * 0.3, W / 2, H * 0.5, H * 0.72);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(0,0,0,0.5)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, W, H);
}

let tableLayer = null, tableLayerIndex = -1;
export function drawTable(ctx, index) {
  if (tableLayerIndex !== index) {
    tableLayer = layer(W, H, 2, (l) => paintTable(l, index));
    tableLayerIndex = index;
  }
  if (tableLayer) ctx.drawImage(tableLayer, 0, 0, W, H);
  else paintTable(ctx, index);
}

// A small swatch of a table for the options sheet.
export function drawTableSwatch(ctx, r, index, active) {
  const [light, mid, dark] = TABLES[index].stops;
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  rr(ctx, r.x + 2, r.y + 5, r.w, r.h, 16); ctx.fill();
  const g = ctx.createLinearGradient(r.x, r.y, r.x + r.w, r.y + r.h);
  g.addColorStop(0, mix(light, mid, 0.4)); g.addColorStop(0.6, mid); g.addColorStop(1, dark);
  ctx.fillStyle = g;
  rr(ctx, r.x, r.y, r.w, r.h, 16); ctx.fill();
  ctx.strokeStyle = active ? GOLD : 'rgba(255,255,255,0.4)';
  ctx.lineWidth = active ? 7 : 2;
  ctx.stroke();
  if (active) tick(ctx, r.x + r.w / 2, r.y + r.h / 2, 20);
}

function tick(ctx, cx, cy, s) {
  ctx.save();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(cx - s, cy); ctx.lineTo(cx - s * 0.3, cy + s * 0.7); ctx.lineTo(cx + s, cy - s * 0.7);
  ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = 13; ctx.stroke();
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 7; ctx.stroke();
  ctx.restore();
}

// ---------------------------------------------------------------------------------------------
// Suit pips, drawn as shapes (crisp at any size, identical on every phone).
// ---------------------------------------------------------------------------------------------
export function pipPath(ctx, suit, cx, cy, s) {
  const X = (v) => cx + v * s, Y = (v) => cy + v * s;
  ctx.beginPath();
  if (suit === 'H') {
    ctx.moveTo(X(0), Y(0.48));
    ctx.bezierCurveTo(X(-0.1), Y(0.35), X(-0.52), Y(0.1), X(-0.52), Y(-0.18));
    ctx.bezierCurveTo(X(-0.52), Y(-0.4), X(-0.35), Y(-0.5), X(-0.24), Y(-0.5));
    ctx.bezierCurveTo(X(-0.11), Y(-0.5), X(0), Y(-0.42), X(0), Y(-0.28));
    ctx.bezierCurveTo(X(0), Y(-0.42), X(0.11), Y(-0.5), X(0.24), Y(-0.5));
    ctx.bezierCurveTo(X(0.35), Y(-0.5), X(0.52), Y(-0.4), X(0.52), Y(-0.18));
    ctx.bezierCurveTo(X(0.52), Y(0.1), X(0.1), Y(0.35), X(0), Y(0.48));
  } else if (suit === 'D') {
    ctx.moveTo(X(0), Y(-0.52));
    ctx.quadraticCurveTo(X(0.17), Y(-0.2), X(0.42), Y(0));
    ctx.quadraticCurveTo(X(0.17), Y(0.2), X(0), Y(0.52));
    ctx.quadraticCurveTo(X(-0.17), Y(0.2), X(-0.42), Y(0));
    ctx.quadraticCurveTo(X(-0.17), Y(-0.2), X(0), Y(-0.52));
  } else if (suit === 'S') {
    ctx.moveTo(X(0), Y(-0.52));
    ctx.bezierCurveTo(X(0.1), Y(-0.36), X(0.52), Y(-0.12), X(0.52), Y(0.14));
    ctx.bezierCurveTo(X(0.52), Y(0.34), X(0.37), Y(0.42), X(0.26), Y(0.42));
    ctx.bezierCurveTo(X(0.16), Y(0.42), X(0.08), Y(0.37), X(0.04), Y(0.28));
    ctx.lineTo(X(0.15), Y(0.52)); ctx.lineTo(X(-0.15), Y(0.52)); ctx.lineTo(X(-0.04), Y(0.28));
    ctx.bezierCurveTo(X(-0.08), Y(0.37), X(-0.16), Y(0.42), X(-0.26), Y(0.42));
    ctx.bezierCurveTo(X(-0.37), Y(0.42), X(-0.52), Y(0.34), X(-0.52), Y(0.14));
    ctx.bezierCurveTo(X(-0.52), Y(-0.12), X(-0.1), Y(-0.36), X(0), Y(-0.52));
  } else {
    const r = 0.245 * s;
    ctx.moveTo(X(0) + r, Y(-0.26)); ctx.arc(X(0), Y(-0.26), r, 0, TAU);
    ctx.moveTo(X(-0.27) + r, Y(0.1)); ctx.arc(X(-0.27), Y(0.1), r, 0, TAU);
    ctx.moveTo(X(0.27) + r, Y(0.1)); ctx.arc(X(0.27), Y(0.1), r, 0, TAU);
    ctx.moveTo(X(0) + 0.14 * s, Y(0)); ctx.arc(X(0), Y(0), 0.14 * s, 0, TAU);
    ctx.moveTo(X(0.04), Y(0.1)); ctx.lineTo(X(0.16), Y(0.52)); ctx.lineTo(X(-0.16), Y(0.52)); ctx.lineTo(X(-0.04), Y(0.1));
  }
  ctx.closePath();
}

export function drawPip(ctx, suit, cx, cy, s, color) {
  pipPath(ctx, suit, cx, cy, s);
  ctx.fillStyle = color;
  ctx.fill();
}

// ---------------------------------------------------------------------------------------------
// Cards. Painted once per face into a sprite (with its own soft shadow), then stamped.
// ---------------------------------------------------------------------------------------------
const PAD = 18;        // room around a sprite for the shadow
const RADIUS = 15;

function cardBody(ctx, x, y, shadow) {
  if (shadow) {
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.42)';
    ctx.shadowBlur = 9 * shadow;
    ctx.shadowOffsetY = 4 * shadow;
    ctx.fillStyle = '#f6efe0';
    rr(ctx, x, y, CARD_W, CARD_H, RADIUS); ctx.fill();
    ctx.restore();
  }
  const g = ctx.createLinearGradient(x, y, x, y + CARD_H);
  g.addColorStop(0, '#fffefb');
  g.addColorStop(1, '#f5ecd9');
  ctx.fillStyle = g;
  rr(ctx, x, y, CARD_W, CARD_H, RADIUS); ctx.fill();
  ctx.strokeStyle = 'rgba(52,38,24,0.75)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 1;
  rr(ctx, x + 1.6, y + 1.6, CARD_W - 3.2, CARD_H - 3.2, RADIUS - 1.5); ctx.stroke();
}

function paintFace(ctx, x, y, card, four, shadow) {
  cardBody(ctx, x, y, shadow);
  const color = ink(four, card.suit);
  // The top strip stays visible inside a stack: a heavy rank and its suit side by side.
  ctx.fillStyle = color;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.font = `800 54px ${UI}`;
  const label = rankLabel(card.rank);
  ctx.fillText(label, x + (label === '10' ? 4 : 9), y + 50, 50);
  drawPip(ctx, card.suit, x + 76, y + 31, 33, color);
  // Court cards carry a fine frame so they read as "picture" cards at a glance.
  if (card.rank > 10) {
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = color; ctx.lineWidth = 2;
    rr(ctx, x + 14, y + 64, CARD_W - 28, CARD_H - 78, 8); ctx.stroke();
    ctx.restore();
  }
  drawPip(ctx, card.suit, x + CARD_W / 2, y + 126, card.rank === 1 ? 108 : card.rank > 10 ? 84 : 96, color);
}

const BACK_PATTERNS = {
  classic(ctx, x, y, w, h) {                         // diamond lattice
    for (let i = -h; i < w + h; i += 16) {
      ctx.beginPath(); ctx.moveTo(x + i, y); ctx.lineTo(x + i + h, y + h); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x + i, y); ctx.lineTo(x + i - h, y + h); ctx.stroke();
    }
  },
  sunset(ctx, x, y, w, h) {                          // a low sun and its rays
    const cx = x + w / 2, cy = y + h * 0.72;
    for (let k = 0; k < 24; k++) { const a = (k / 24) * TAU; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * 30, cy + Math.sin(a) * 30); ctx.lineTo(cx + Math.cos(a) * 260, cy + Math.sin(a) * 260); ctx.stroke(); }
    ctx.beginPath(); ctx.arc(cx, cy, 24, 0, TAU); ctx.fill();
  },
  ocean(ctx, x, y, w, h) {                           // rows of scalloped waves
    for (let row = 0, yy = y + 6; yy < y + h + 16; yy += 15, row++) {
      for (let xx = x - 16 + (row % 2) * 13; xx < x + w + 16; xx += 26) { ctx.beginPath(); ctx.arc(xx, yy, 13, Math.PI, TAU); ctx.stroke(); }
    }
  },
  rose(ctx, x, y, w, h) {                            // a rosette over a field of dots
    for (let yy = y + 9; yy < y + h; yy += 18) for (let xx = x + 9 + (((yy - y - 9) / 18) % 2) * 9; xx < x + w; xx += 18) { ctx.beginPath(); ctx.arc(xx, yy, 2, 0, TAU); ctx.fill(); }
    const cx = x + w / 2, cy = y + h / 2;
    for (let k = 0; k < 8; k++) { const a = (k / 8) * TAU; ctx.beginPath(); ctx.ellipse(cx + Math.cos(a) * 20, cy + Math.sin(a) * 20, 20, 10, a, 0, TAU); ctx.stroke(); }
  },
  violet(ctx, x, y, w, h) {                          // four-point stars
    for (let row = 0, yy = y + 14; yy < y + h + 10; yy += 26, row++) {
      for (let xx = x + 12 + (row % 2) * 13; xx < x + w + 10; xx += 26) {
        ctx.beginPath(); ctx.moveTo(xx, yy - 9); ctx.quadraticCurveTo(xx, yy, xx + 9, yy); ctx.quadraticCurveTo(xx, yy, xx, yy + 9); ctx.quadraticCurveTo(xx, yy, xx - 9, yy); ctx.quadraticCurveTo(xx, yy, xx, yy - 9); ctx.fill();
      }
    }
  },
  forest(ctx, x, y, w, h) {                          // herringbone leaves
    for (let yy = y - 10; yy < y + h + 20; yy += 14) {
      for (let k = 0, xx = x; xx < x + w; xx += 20, k++) { ctx.beginPath(); ctx.moveTo(xx, yy + (k % 2 ? 10 : 0)); ctx.lineTo(xx + 20, yy + (k % 2 ? 0 : 10)); ctx.stroke(); }
    }
  },
  graphite(ctx, x, y, w, h) {                        // pinstripes
    for (let xx = x + 5; xx < x + w; xx += 9) { ctx.beginPath(); ctx.moveTo(xx, y); ctx.lineTo(xx, y + h); ctx.stroke(); }
  },
  gold(ctx, x, y, w, h) {                            // art-deco fans
    for (let row = 0, yy = y + h + 10; yy > y - 10; yy -= 22, row++) {
      for (let xx = x - 22 + (row % 2) * 22; xx < x + w + 44; xx += 44) for (const r of [22, 15, 8]) { ctx.beginPath(); ctx.arc(xx, yy, r, Math.PI, TAU); ctx.stroke(); }
    }
  },
};

function paintBack(ctx, x, y, theme, shadow) {
  cardBody(ctx, x, y, shadow);
  const ix = x + 8, iy = y + 8, iw = CARD_W - 16, ih = CARD_H - 16;
  const g = ctx.createLinearGradient(ix, iy, ix + iw * 0.4, iy + ih);
  g.addColorStop(0, mix(theme.back, '#ffffff', 0.16));
  g.addColorStop(1, mix(theme.back, '#000000', 0.22));
  ctx.save();
  rr(ctx, ix, iy, iw, ih, 9); ctx.fillStyle = g; ctx.fill(); ctx.clip();
  ctx.strokeStyle = 'rgba(255,255,255,0.30)';
  ctx.fillStyle = 'rgba(255,255,255,0.34)';
  ctx.lineWidth = 1.6;
  (BACK_PATTERNS[theme.id] || BACK_PATTERNS.classic)(ctx, ix, iy, iw, ih);
  ctx.restore();
  // a plain medallion in the middle keeps the pattern calm and gives the back a centre
  const cx = x + CARD_W / 2, cy = y + CARD_H / 2;
  if (theme.id !== 'sunset' && theme.id !== 'rose') {
    ctx.fillStyle = mix(theme.back, '#000000', 0.12);
    ctx.beginPath(); ctx.moveTo(cx, cy - 34); ctx.lineTo(cx + 25, cy); ctx.lineTo(cx, cy + 34); ctx.lineTo(cx - 25, cy); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 2; ctx.stroke();
    drawPip(ctx, 'S', cx, cy, 24, 'rgba(255,255,255,0.85)');
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 2;
  rr(ctx, ix + 5, iy + 5, iw - 10, ih - 10, 6); ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1;
  rr(ctx, ix, iy, iw, ih, 9); ctx.stroke();
}

const sprites = new Map();
function stamp(ctx, key, x, y, paint) {
  let s = sprites.get(key);
  if (s === undefined) {
    s = layer(CARD_W + PAD * 2, CARD_H + PAD * 2, 2, (l) => paint(l, PAD, PAD, 2));
    sprites.set(key, s);
  }
  if (s) ctx.drawImage(s, x - PAD, y - PAD, CARD_W + PAD * 2, CARD_H + PAD * 2);
  else paint(ctx, x, y, 1);
}

export function drawFace(ctx, x, y, card, four) {
  stamp(ctx, `${card.suit}${card.rank}${four ? 'f' : 't'}`, x, y, (c, px, py, sh) => paintFace(c, px, py, card, four, sh));
}
export function drawBack(ctx, x, y, theme) {
  stamp(ctx, `back-${theme.id}`, x, y, (c, px, py, sh) => paintBack(c, px, py, theme, sh));
}
// Painted directly (not from a sprite) so it stays sharp when the caller has scaled the canvas.
export function drawFaceLarge(ctx, x, y, card, four) { paintFace(ctx, x, y, card, four, 1.6); }
export function drawBackLarge(ctx, x, y, theme) { paintBack(ctx, x, y, theme, 1.6); }

// A soft extra shadow under a card that is in the air.
export function drawLiftShadow(ctx, x, y, amount) {
  ctx.fillStyle = `rgba(0,0,0,${0.16 * amount})`;
  rr(ctx, x + 4, y + 10 + 8 * amount, CARD_W - 4, CARD_H, RADIUS + 4); ctx.fill();
}

// The ring around a card the player picked or that the hint points at.
export function drawRing(ctx, x, y, strength = 1, h = CARD_H) {
  ctx.save();
  ctx.strokeStyle = `rgba(90,52,0,${0.8 * strength})`; ctx.lineWidth = 10;
  rr(ctx, x - 1, y - 1, CARD_W + 2, h + 2, RADIUS + 2); ctx.stroke();
  ctx.strokeStyle = GOLD; ctx.globalAlpha = 0.55 + 0.45 * strength; ctx.lineWidth = 6;
  ctx.stroke();
  ctx.restore();
}

// An empty place for a pile: a well pressed into the felt, with a mark of what goes there.
export function drawWell(ctx, x, y, mark, CARD_W_ = CARD_W) {
  ctx.save();
  rr(ctx, x, y, CARD_W_, CARD_H, RADIUS);
  ctx.fillStyle = 'rgba(0,0,0,0.24)'; ctx.fill();
  ctx.clip();
  const g = ctx.createLinearGradient(0, y, 0, y + 34);
  g.addColorStop(0, 'rgba(0,0,0,0.38)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(x, y, CARD_W_, 34);
  ctx.restore();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 2;
  rr(ctx, x, y, CARD_W_, CARD_H, RADIUS); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = 2;
  rr(ctx, x + 1, y + 2, CARD_W_ - 2, CARD_H - 1, RADIUS); ctx.stroke();
  const soft = 'rgba(255,255,255,0.30)';
  if (mark === 'recycle') {
    const cx = x + CARD_W_ / 2, cy = y + CARD_H / 2;
    ctx.strokeStyle = soft; ctx.lineWidth = 9; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(cx, cy, 34, -Math.PI * 0.35, Math.PI * 1.25); ctx.stroke();
    ctx.lineCap = 'butt';
    ctx.fillStyle = soft;
    ctx.beginPath(); ctx.moveTo(cx + 2, cy - 54); ctx.lineTo(cx + 36, cy - 30); ctx.lineTo(cx + 2, cy - 12); ctx.closePath(); ctx.fill();
  } else if (mark === 'K') {
    ctx.fillStyle = 'rgba(255,255,255,0.20)'; ctx.font = `800 72px ${UI}`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.fillText('K', x + CARD_W_ / 2, y + CARD_H / 2 + 28);
  } else if (mark) {
    drawPip(ctx, mark, x + CARD_W_ / 2, y + CARD_H / 2, 84, soft);
  }
}

// ---------------------------------------------------------------------------------------------
// Text and buttons
// ---------------------------------------------------------------------------------------------
export function text(ctx, str, x, y, size, color = CREAM, font = UI, weight = 700, align = 'center') {
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.font = `${weight} ${size}px ${font}`;
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
}

export function shadowText(ctx, str, x, y, size, color, font, weight) {
  text(ctx, str, x, y + 3, size, 'rgba(0,0,0,0.45)', font, weight);
  text(ctx, str, x, y, size, color, font, weight);
}

export function wrapText(ctx, str, cx, y, size, maxWidth, lineHeight, color = CREAM, weight = 600) {
  ctx.font = `${weight} ${size}px ${UI}`;
  const lines = [];
  let line = '';
  for (const word of str.split(' ')) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = word; } else line = test;
  }
  if (line) lines.push(line);
  lines.forEach((ln, i) => text(ctx, ln, cx, y + i * lineHeight, size, color, UI, weight));
  return lines.length;
}

const BUTTON_STYLES = {
  primary: { top: ROSE[0], mid: ROSE[1], bottom: ROSE[2], lip: '#5e0f36', rim: 'rgba(255,214,232,0.75)', label: '#ffffff' },
  quiet: { top: '#4a3540', mid: '#35232d', bottom: '#22141c', lip: '#0e070b', rim: 'rgba(251,238,221,0.5)', label: CREAM },
  active: { top: '#ffe9a3', mid: '#ffd35c', bottom: '#d9a21e', lip: '#7a5505', rim: 'rgba(255,250,225,0.9)', label: '#2a1a00' },
};

// A raised key: a dark lip below, a lit face, a bright rim along the top.
export function drawButton(ctx, r, label, { style = 'quiet', size = 32, radius = 22, sub = '' } = {}) {
  const s = BUTTON_STYLES[style];
  ctx.fillStyle = 'rgba(0,0,0,0.38)';
  rr(ctx, r.x + 2, r.y + 12, r.w - 4, r.h, radius); ctx.fill();
  ctx.fillStyle = s.lip;
  rr(ctx, r.x, r.y + 6, r.w, r.h, radius); ctx.fill();
  const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
  g.addColorStop(0, s.top); g.addColorStop(0.5, s.mid); g.addColorStop(1, s.bottom);
  ctx.fillStyle = g;
  rr(ctx, r.x, r.y, r.w, r.h, radius); ctx.fill();
  ctx.save();
  ctx.clip();
  const shine = ctx.createLinearGradient(0, r.y, 0, r.y + r.h * 0.5);
  shine.addColorStop(0, 'rgba(255,255,255,0.22)'); shine.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = shine; ctx.fillRect(r.x, r.y, r.w, r.h * 0.5);
  ctx.restore();
  ctx.strokeStyle = s.rim; ctx.lineWidth = 2;
  rr(ctx, r.x + 1, r.y + 1, r.w - 2, r.h - 2, radius - 1); ctx.stroke();
  const cy = r.y + r.h / 2 + size * 0.35 - (sub ? 14 : 0);
  if (style !== 'active') text(ctx, label, r.x + r.w / 2, cy + 2, size, 'rgba(0,0,0,0.4)', UI, 800);
  text(ctx, label, r.x + r.w / 2, cy, size, s.label, UI, 800);
  if (sub) text(ctx, sub, r.x + r.w / 2, cy + 34, 24, s.label, UI, 600);
}

// A dark engraved plate for quiet information (stats, notes).
export function drawPlate(ctx, cx, y, w, h) {
  rr(ctx, cx - w / 2, y, w, h, h / 2);
  ctx.fillStyle = 'rgba(0,0,0,0.30)'; ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.16)'; ctx.lineWidth = 2; ctx.stroke();
}

export function drawSheet(ctx, x, y, w, h) {
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  rr(ctx, x + 4, y + 14, w - 8, h, 34); ctx.fill();
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, '#3b2833'); g.addColorStop(1, '#1d1118');
  ctx.fillStyle = g;
  rr(ctx, x, y, w, h, 34); ctx.fill();
  ctx.strokeStyle = 'rgba(251,238,221,0.35)'; ctx.lineWidth = 2; ctx.stroke();
}
