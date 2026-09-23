// The board: three original premium themes. The WHOLE board — its drop shadow onto the table, the
// raised bevelled frame with an inlaid border line and engraved coordinates, sixty-four veneer squares
// with real (seeded, procedural) grain or veining, and a soft inner vignette — is baked once into one
// cached sprite per (theme, flip) and blitted with a single drawImage per frame. Overlays (legal-move
// dots, last move, selection, check) are drawn live on top. Deterministic: seeded LCG, no Math.random.
import { GRID_X, GRID_Y, INNER, SQ, BOARD_X, BOARD_Y, BOARD_SIZE, FRAME, W, H } from './layout.js';
import { FILES } from './rules.js';

export const THEME_NAMES = { walnut: 'Walnut & Maple', marble: 'Marble & Onyx', rosewood: 'Rosewood Night' };

// light/dark: [base, mid, deep] veneer colours; grain: [ink for light squares, ink for dark squares];
// frame: [lit, mid, deep] frame wood/stone; inlay: the border line metal; label: engraved text fill.
const THEME = {
  walnut: {
    kind: 'wood',
    light: ['#efdcb2', '#e6cf9d', '#d5b880'], dark: ['#8c5a35', '#6e4324', '#4b2a15'],
    grain: ['rgba(140,95,40,0.16)', 'rgba(30,14,4,0.19)'], figure: ['rgba(255,240,200,0.14)', 'rgba(255,200,140,0.10)'],
    frame: ['#5a3519', '#3a2110', '#1d1008'], frameGrain: 'rgba(255,200,140,0.09)', inlay: ['#f1cf7a', '#9a7028'], label: 'rgba(255,220,160,0.62)',
    bg: ['#2a1a0e', '#120b05'], felt: 'rgba(255,220,170,0.035)', pool: 'rgba(255,196,120,0.22)',
  },
  marble: {
    kind: 'stone',
    light: ['#f6f5f1', '#e9e7e1', '#d3d0c8'], dark: ['#4a4d55', '#30333a', '#1a1c20'],
    grain: ['rgba(120,122,130,0.20)', 'rgba(220,226,240,0.13)'], figure: ['rgba(255,255,255,0.16)', 'rgba(255,255,255,0.025)'],
    frame: ['#3c4046', '#25282d', '#111214'], frameGrain: 'rgba(220,226,240,0.05)', inlay: ['#e6ebf2', '#8a929e'], label: 'rgba(226,232,242,0.62)',
    bg: ['#1c1e24', '#0a0b0e'], felt: 'rgba(200,210,240,0.03)', pool: 'rgba(190,205,240,0.16)',
  },
  rosewood: {
    kind: 'wood',
    light: ['#f2e2c2', '#e6cd9c', '#cfad72'], dark: ['#6a2632', '#4a1722', '#2a0b12'],
    grain: ['rgba(150,90,40,0.14)', 'rgba(20,4,8,0.22)'], figure: ['rgba(255,240,210,0.12)', 'rgba(255,150,120,0.08)'],
    frame: ['#2a1216', '#170a0d', '#080304'], frameGrain: 'rgba(255,170,130,0.08)', inlay: ['#f0b070', '#8a4a22'], label: 'rgba(255,205,170,0.62)',
    bg: ['#1e0a0d', '#0a0304'], felt: 'rgba(255,190,170,0.03)', pool: 'rgba(255,150,110,0.18)',
  },
};
export const boardThemeOf = (name) => THEME[name] ?? THEME.walnut;

const TAU = Math.PI * 2;
const lcg = (seed) => { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); };
function newCanvas(w, h) { return typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : null; }
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

const boardCache = new Map(), tileCache = new Map(), backdropCache = new Map();
export function invalidateArt() { boardCache.clear(); tileCache.clear(); backdropCache.clear(); }

// ---- one veneer square ------------------------------------------------------------------------------
// variant 0..3 changes the seed so neighbouring squares of the same colour never repeat a pattern.
function paintWood(ctx, size, light, T, variant) {
  const stops = light ? T.light : T.dark, rnd = lcg((light ? 0x51 : 0xa7) * 977 + variant * 131);
  const g = ctx.createLinearGradient(0, 0, size * 0.6, size);
  g.addColorStop(0, stops[0]); g.addColorStop(0.55, stops[1]); g.addColorStop(1, stops[2]);
  ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
  ctx.save(); ctx.beginPath(); ctx.rect(0, 0, size, size); ctx.clip();
  // figure: a couple of broad soft bands (the "flame" of the cut) running with the grain
  ctx.strokeStyle = light ? T.figure[0] : T.figure[1]; ctx.lineCap = 'round';
  for (let i = 0; i < 2; i++) {
    const x0 = rnd() * size; ctx.lineWidth = size * (0.10 + rnd() * 0.12);
    ctx.beginPath(); ctx.moveTo(x0, -4); ctx.bezierCurveTo(x0 + (rnd() - 0.5) * size * 0.5, size * 0.35, x0 + (rnd() - 0.5) * size * 0.5, size * 0.7, x0 + (rnd() - 0.5) * size * 0.3, size + 4); ctx.stroke();
  }
  // grain: many long thin lines running down the square, gently wandering; maple fine and straight,
  // walnut wider and wavier with a cathedral arch in some squares
  const n = light ? 16 : 11; ctx.strokeStyle = light ? T.grain[0] : T.grain[1];
  for (let i = 0; i < n; i++) {
    const x0 = ((i + 0.5) / n) * size + (rnd() - 0.5) * size * 0.08, wav = light ? 0.06 : 0.16;
    ctx.lineWidth = light ? 0.6 + rnd() * 0.9 : 0.7 + rnd() * 1.3; ctx.globalAlpha = 0.5 + rnd() * 0.5;
    ctx.beginPath(); ctx.moveTo(x0, -4);
    ctx.bezierCurveTo(x0 + (rnd() - 0.5) * size * wav, size * 0.33, x0 + (rnd() - 0.5) * size * wav, size * 0.66, x0 + (rnd() - 0.5) * size * wav * 0.5, size + 4);
    ctx.stroke();
  }
  if (!light && variant % 2 === 1) {
    // cathedral figure: nested arches, the classic crown-cut walnut look
    ctx.globalAlpha = 0.55; ctx.lineWidth = 1.2; const cx = size * (0.3 + rnd() * 0.4), cy = size * (0.2 + rnd() * 0.3);
    for (let k = 0; k < 4; k++) { const r = size * (0.16 + k * 0.13); ctx.beginPath(); ctx.moveTo(cx - r, size + 4); ctx.quadraticCurveTo(cx - r, cy, cx, cy); ctx.quadraticCurveTo(cx + r, cy, cx + r, size + 4); ctx.stroke(); }
  }
  ctx.restore();
  finishTile(ctx, size, light);
}
function paintStone(ctx, size, light, T, variant) {
  const stops = light ? T.light : T.dark, rnd = lcg((light ? 0x33 : 0xc1) * 613 + variant * 197);
  const g = ctx.createLinearGradient(0, 0, size, size * 0.8);
  g.addColorStop(0, stops[0]); g.addColorStop(0.5, stops[1]); g.addColorStop(1, stops[2]);
  ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
  ctx.save(); ctx.beginPath(); ctx.rect(0, 0, size, size); ctx.clip();
  // cloudy figure
  ctx.fillStyle = light ? T.figure[0] : T.figure[1];
  for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.ellipse(rnd() * size, rnd() * size, size * (0.15 + rnd() * 0.3), size * (0.08 + rnd() * 0.18), rnd() * Math.PI, 0, TAU); ctx.fill(); }
  // veins: branching random walks, a soft wide vein under a sharp thin one
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const vein = (x, y, ang, len, w, alpha) => {
    ctx.strokeStyle = light ? T.grain[0] : T.grain[1]; ctx.globalAlpha = alpha; ctx.lineWidth = w;
    ctx.beginPath(); ctx.moveTo(x, y);
    for (let k = 0; k < len; k++) { ang += (rnd() - 0.5) * 0.9; x += Math.cos(ang) * size * 0.06; y += Math.sin(ang) * size * 0.06; ctx.lineTo(x, y); }
    ctx.stroke();
    return [x, y, ang];
  };
  for (let i = 0; i < (light ? 3 : 2); i++) {
    const x = rnd() * size, y = rnd() < 0.5 ? -2 : size + 2, ang = y < 0 ? Math.PI * (0.25 + rnd() * 0.5) : -Math.PI * (0.25 + rnd() * 0.5);
    vein(x, y, ang, 22, size * 0.05, 0.25);
    const [bx, by, ba] = vein(x, y, ang, 22, 1.1, 0.9);
    vein(bx, by, ba + (rnd() - 0.5) * 1.6, 10, 0.8, 0.6);
  }
  ctx.restore();
  finishTile(ctx, size, light);
}
// a veneer square is a distinct inset panel: a hairline lit edge on top/left, a shadow on bottom/right
function finishTile(ctx, size, light) {
  ctx.globalAlpha = 1;
  const vg = ctx.createLinearGradient(0, 0, size, size);
  vg.addColorStop(0, `rgba(255,255,255,${light ? 0.10 : 0.07})`); vg.addColorStop(0.2, 'rgba(255,255,255,0)'); vg.addColorStop(0.85, 'rgba(0,0,0,0)'); vg.addColorStop(1, `rgba(0,0,0,${light ? 0.10 : 0.18})`);
  ctx.fillStyle = vg; ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = 'rgba(0,0,0,0.16)'; ctx.lineWidth = 1; ctx.strokeRect(0.5, 0.5, size - 1, size - 1);
}
function tile(themeName, light, variant, size) {
  const key = `${themeName}|${light ? 1 : 0}|${variant}|${size}`;
  let c = tileCache.get(key);
  if (c === undefined) {
    c = null;
    try {
      const cv = newCanvas(size, size);
      if (cv) { const T = boardThemeOf(themeName); (T.kind === 'stone' ? paintStone : paintWood)(cv.getContext('2d'), size, light, T, variant); c = cv; }
    } catch { c = null; }
    tileCache.set(key, c);
  }
  return c;
}

// ---- the whole board ---------------------------------------------------------------------------------
const MARGIN = 36; // room around the frame for the drop shadow
function paintBoard(ctx, themeName, flip, res = 1) {
  const T = boardThemeOf(themeName);
  const x = BOARD_X, y = BOARD_Y, S = BOARD_SIZE, R = 16;
  // drop shadow onto the table: stacked soft layers, offset down-right of the key light
  for (let i = 8; i >= 1; i--) { ctx.fillStyle = `rgba(0,0,0,${0.06 + i * 0.012})`; roundRect(ctx, x - i * 1.6 + 3, y - i * 1.2 + 7, S + i * 3.2, S + i * 2.4 + 2, R + i * 1.6); ctx.fill(); }
  // frame body: wood, lit from the upper left
  const g = ctx.createLinearGradient(x, y, x + S, y + S);
  g.addColorStop(0, T.frame[0]); g.addColorStop(0.5, T.frame[1]); g.addColorStop(1, T.frame[2]);
  ctx.fillStyle = g; roundRect(ctx, x, y, S, S, R); ctx.fill();
  // frame grain: long lines along each side, mitred at the corners
  ctx.save(); roundRect(ctx, x, y, S, S, R); ctx.clip();
  ctx.beginPath(); ctx.rect(GRID_X - 2, GRID_Y - 2, INNER + 4, INNER + 4); ctx.rect(x - 2, y - 2, S + 4, S + 4); ctx.clip('evenodd');
  const rnd = lcg(0xbeef); ctx.strokeStyle = T.frameGrain; ctx.lineCap = 'round';
  const sides = [[x, y, S, FRAME, true], [x, y + S - FRAME, S, FRAME, true], [x, y, FRAME, S, false], [x + S - FRAME, y, FRAME, S, false]];
  for (const [sx, sy, sw, sh, horiz] of sides) {
    ctx.save(); ctx.beginPath();
    if (horiz) { const top = sy === y; ctx.moveTo(sx, sy + (top ? 0 : sh)); ctx.lineTo(sx + sw, sy + (top ? 0 : sh)); ctx.lineTo(sx + sw - FRAME, sy + (top ? sh : 0)); ctx.lineTo(sx + FRAME, sy + (top ? sh : 0)); }
    else { const left = sx === x; ctx.moveTo(sx + (left ? 0 : sw), sy); ctx.lineTo(sx + (left ? 0 : sw), sy + sh); ctx.lineTo(sx + (left ? sw : 0), sy + sh - FRAME); ctx.lineTo(sx + (left ? sw : 0), sy + FRAME); }
    ctx.closePath(); ctx.clip();
    for (let i = 0; i < 9; i++) {
      const t = (i + 0.5) / 9; ctx.lineWidth = 0.7 + rnd() * 1.4; ctx.globalAlpha = 0.5 + rnd() * 0.5;
      ctx.beginPath();
      if (horiz) { const yy = sy + t * sh; ctx.moveTo(sx - 4, yy); ctx.bezierCurveTo(sx + sw * 0.33, yy + (rnd() - 0.5) * 5, sx + sw * 0.66, yy + (rnd() - 0.5) * 5, sx + sw + 4, yy + (rnd() - 0.5) * 3); }
      else { const xx = sx + t * sw; ctx.moveTo(xx, sy - 4); ctx.bezierCurveTo(xx + (rnd() - 0.5) * 5, sy + sh * 0.33, xx + (rnd() - 0.5) * 5, sy + sh * 0.66, xx + (rnd() - 0.5) * 3, sy + sh + 4); }
      ctx.stroke();
    }
    ctx.restore();
  }
  ctx.globalAlpha = 1;
  // mitre lines
  ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1;
  for (const [cx, cy, dx, dy] of [[x, y, 1, 1], [x + S, y, -1, 1], [x, y + S, 1, -1], [x + S, y + S, -1, -1]]) { ctx.beginPath(); ctx.moveTo(cx + dx * 3, cy + dy * 3); ctx.lineTo(cx + dx * FRAME, cy + dy * FRAME); ctx.stroke(); }
  ctx.restore();
  // outer bevel: lit top/left edge, dark bottom/right edge
  ctx.save(); roundRect(ctx, x, y, S, S, R); ctx.clip();
  ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,235,200,0.22)'; roundRect(ctx, x + 1.5, y + 1.5, S - 3, S - 3, R - 1); ctx.stroke();
  ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.45)'; roundRect(ctx, x + 3, y + 3, S - 3, S - 3, R - 1); ctx.stroke();
  ctx.restore();
  // inlaid border line (a thin metal strip let into a groove)
  const inset = 6.5;
  ctx.lineWidth = 2.6; ctx.strokeStyle = 'rgba(0,0,0,0.5)'; roundRect(ctx, x + inset, y + inset + 0.8, S - inset * 2, S - inset * 2, R - 5); ctx.stroke();
  const ig = ctx.createLinearGradient(x, y, x + S, y + S); ig.addColorStop(0, T.inlay[0]); ig.addColorStop(0.5, T.inlay[1]); ig.addColorStop(1, T.inlay[0]);
  ctx.lineWidth = 1.5; ctx.strokeStyle = ig; roundRect(ctx, x + inset, y + inset, S - inset * 2, S - inset * 2, R - 5); ctx.stroke();
  // tiles
  for (let rankFromTop = 0; rankFromTop < 8; rankFromTop++) {
    for (let file = 0; file < 8; file++) {
      const rank = 7 - rankFromTop, light = ((file + rank) % 2) === 1, variant = (file * 3 + rank * 5) & 3;
      const t = tile(themeName, light, variant, Math.round(SQ * res)), tx = GRID_X + file * SQ, ty = GRID_Y + rankFromTop * SQ;
      if (t) ctx.drawImage(t, tx, ty, SQ, SQ); else { ctx.fillStyle = light ? T.light[1] : T.dark[1]; ctx.fillRect(tx, ty, SQ, SQ); }
    }
  }
  // the playing field sits in a shallow well: inner lip shadow on top/left, soft light on bottom/right,
  // plus a gentle radial vignette so the board has depth
  ctx.save(); ctx.beginPath(); ctx.rect(GRID_X, GRID_Y, INNER, INNER); ctx.clip();
  const lip = 9;
  const top = ctx.createLinearGradient(0, GRID_Y, 0, GRID_Y + lip); top.addColorStop(0, 'rgba(0,0,0,0.40)'); top.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = top; ctx.fillRect(GRID_X, GRID_Y, INNER, lip);
  const left = ctx.createLinearGradient(GRID_X, 0, GRID_X + lip, 0); left.addColorStop(0, 'rgba(0,0,0,0.34)'); left.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = left; ctx.fillRect(GRID_X, GRID_Y, lip, INNER);
  const bot = ctx.createLinearGradient(0, GRID_Y + INNER - 5, 0, GRID_Y + INNER); bot.addColorStop(0, 'rgba(255,255,255,0)'); bot.addColorStop(1, 'rgba(255,255,255,0.10)'); ctx.fillStyle = bot; ctx.fillRect(GRID_X, GRID_Y + INNER - 5, INNER, 5);
  const vg = ctx.createRadialGradient(GRID_X + INNER * 0.5, GRID_Y + INNER * 0.45, INNER * 0.25, GRID_X + INNER * 0.5, GRID_Y + INNER * 0.5, INNER * 0.78);
  vg.addColorStop(0, 'rgba(255,245,225,0.05)'); vg.addColorStop(0.6, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.22)');
  ctx.fillStyle = vg; ctx.fillRect(GRID_X, GRID_Y, INNER, INNER);
  ctx.restore();
  ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = 1.5; ctx.strokeRect(GRID_X - 0.75, GRID_Y - 0.75, INNER + 1.5, INNER + 1.5);
  // coordinates, engraved into the frame — must track `flip` (Flip Board mirrors file and rank)
  ctx.font = `700 ${Math.round(FRAME * 0.50)}px Georgia, 'Times New Roman', serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const engrave = (txt, tx, ty) => {
    ctx.fillStyle = 'rgba(255,240,210,0.18)'; ctx.fillText(txt, tx + 0.7, ty + 0.9);   // lit lower edge of the cut
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillText(txt, tx - 0.4, ty - 0.5);         // the shadowed cut
    ctx.fillStyle = T.label; ctx.fillText(txt, tx, ty);
  };
  for (let f = 0; f < 8; f++) {
    const tx = GRID_X + f * SQ + SQ / 2, letter = FILES[flip ? 7 - f : f];
    engrave(letter, tx, y + FRAME * 0.52); engrave(letter, tx, y + S - FRAME * 0.50);
  }
  for (let r = 0; r < 8; r++) {
    const ty = GRID_Y + (7 - r) * SQ + SQ / 2, num = String(flip ? 8 - r : r + 1);
    engrave(num, x + FRAME * 0.5, ty); engrave(num, x + S - FRAME * 0.5, ty);
  }
}
// res = device pixels per virtual pixel the sprite is baked at (1..3), so the grain and the engraved
// coordinates stay crisp on 2x/3x phones instead of being upscaled from a 1x bake.
export function boardSprite(themeName, flip, res = 1) {
  const key = `${themeName}|${flip ? 1 : 0}|${res}`;
  let c = boardCache.get(key);
  if (c === undefined) {
    c = null;
    try {
      const size = BOARD_SIZE + MARGIN * 2, cv = newCanvas(Math.ceil(size * res), Math.ceil(size * res));
      if (cv) { const cctx = cv.getContext('2d'); cctx.scale(res, res); cctx.translate(MARGIN - BOARD_X, MARGIN - BOARD_Y); paintBoard(cctx, themeName, flip, res); c = cv; }
    } catch { c = null; }
    boardCache.set(key, c);
  }
  return c;
}
export function drawBoard(ctx, themeName, flip, res = 1) {
  const c = boardSprite(themeName, flip, res);
  if (c) ctx.drawImage(c, BOARD_X - MARGIN, BOARD_Y - MARGIN, BOARD_SIZE + MARGIN * 2, BOARD_SIZE + MARGIN * 2);
  else paintBoard(ctx, themeName, flip, 1);
}
// The sprite's outer box (for callers that place the board somewhere other than its layout slot).
export const BOARD_SPRITE = { margin: MARGIN, size: BOARD_SIZE + MARGIN * 2 };

// ---- the table under everything: a felt surface with a soft pool of light -----------------------------
function paintBackdropInto(ctx, T, hue) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, hue[0]); g.addColorStop(1, hue[1]);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const pool = ctx.createRadialGradient(W * 0.42, BOARD_Y + BOARD_SIZE * 0.35, 40, W * 0.5, BOARD_Y + BOARD_SIZE * 0.5, W * 0.95);
  pool.addColorStop(0, T.pool); pool.addColorStop(0.55, T.pool.replace(/[\d.]+\)$/, '0.06)')); pool.addColorStop(1, 'rgba(0,0,0,0.35)');
  ctx.fillStyle = pool; ctx.fillRect(0, 0, W, H);
  // felt: a fine speckle, seeded (a texture rather than a flat fill)
  const rnd = lcg(0x5eed); ctx.fillStyle = T.felt;
  for (let i = 0; i < 9000; i++) { const x = rnd() * W, y = rnd() * H, r = 0.6 + rnd() * 1.2; ctx.fillRect(x, y, r, r); }
  ctx.fillStyle = 'rgba(0,0,0,0.05)';
  for (let i = 0; i < 6000; i++) { const x = rnd() * W, y = rnd() * H, r = 0.6 + rnd() * 1.4; ctx.fillRect(x, y, r, r); }
  // dither: break the 8-bit banding a large dark radial gradient always shows (seeded, once)
  try {
    const id = ctx.getImageData(0, 0, W, H), d = id.data, r2 = lcg(0xd17e);
    for (let i = 0; i < d.length; i += 4) { const n = (r2() - 0.5) * 7; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
    ctx.putImageData(id, 0, 0);
  } catch { /* no ImageData in this environment: the plain gradient is still fine */ }
}
export function drawBackdrop(ctx, themeName, hue) {
  const T = boardThemeOf(themeName), key = `${themeName}|${hue[0]}|${hue[1]}`;
  let c = backdropCache.get(key);
  if (c === undefined) {
    c = null;
    try { const cv = newCanvas(W, H); if (cv) { paintBackdropInto(cv.getContext('2d'), T, hue); c = cv; } } catch { c = null; }
    backdropCache.set(key, c);
  }
  if (c) ctx.drawImage(c, 0, 0); else paintBackdropInto(ctx, T, hue);
}

// ---- overlays: legal-move dots/rings, last-move marks, selection glow, check glow ----------------------
export function drawDot(ctx, x, y) {
  ctx.fillStyle = 'rgba(20,14,8,0.30)'; ctx.beginPath(); ctx.arc(x, y, SQ * 0.15, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, SQ * 0.15, 0, TAU); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.beginPath(); ctx.arc(x - 3, y - 4, SQ * 0.15 * 0.4, 0, TAU); ctx.fill();
}
export function drawCaptureRing(ctx, x, y) { ctx.strokeStyle = 'rgba(200,50,35,0.7)'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(x, y, SQ * 0.44, 0, TAU); ctx.stroke(); ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, SQ * 0.44 + 3, 0, TAU); ctx.stroke(); }
export function drawSquareTint(ctx, x, y, rgba) { ctx.fillStyle = rgba; ctx.fillRect(x, y, SQ, SQ); }
export function drawCornerMarks(ctx, x, y, rgba) {
  const l = SQ * 0.24, w = 4.5;
  ctx.strokeStyle = rgba; ctx.lineWidth = w; ctx.lineCap = 'round';
  for (const [cx, cy, dx, dy] of [[x + 3, y + 3, 1, 0], [x + 3, y + 3, 0, 1], [x + SQ - 3, y + 3, -1, 0], [x + SQ - 3, y + 3, 0, 1], [x + 3, y + SQ - 3, 1, 0], [x + 3, y + SQ - 3, 0, -1], [x + SQ - 3, y + SQ - 3, -1, 0], [x + SQ - 3, y + SQ - 3, 0, -1]]) {
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + dx * l, cy + dy * l); ctx.stroke();
  }
}
export function drawCheckGlow(ctx, x, y, pulse) {
  const r = SQ * (0.62 + pulse * 0.08);
  const g = ctx.createRadialGradient(x, y, SQ * 0.1, x, y, r);
  g.addColorStop(0, `rgba(230,60,40,${0.5 + pulse * 0.18})`); g.addColorStop(0.6, `rgba(210,40,30,${0.22 + pulse * 0.1})`); g.addColorStop(1, 'rgba(210,40,30,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
}
export function drawSelectGlow(ctx, x, y) {
  ctx.fillStyle = 'rgba(255, 214, 110, 0.30)'; ctx.fillRect(x, y, SQ, SQ);
  ctx.strokeStyle = 'rgba(255, 214, 110, 0.85)'; ctx.lineWidth = 3; ctx.strokeRect(x + 1.5, y + 1.5, SQ - 3, SQ - 3);
}
