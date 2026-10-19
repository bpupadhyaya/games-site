// Everything that is drawn each frame. Reads `state` (see game.js) and changes nothing.
// The look: an enamel field map set in a gold frame, on royal violet. One light, from the upper
// left. Static art (backdrop, board tiles and inlays) is painted once into cached layers.
import { inRect, host, TEXT_SCALES, AUTO_THINK_STEPS, SIBLINGS, layoutFor } from './layout.js';
import { PALETTES, regionColor } from './palettes.js';
import { RULES } from './content.js';

// W/H follow the live screen size (set at the top of render()); static layers are cached per size.
let W = 720, H = 1560;
const TAU = Math.PI * 2;
const DISPLAY = '"Cinzel", Georgia, "Times New Roman", serif';
const UI = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const CREAM = '#f7ecd0';
const DEFAULT_BG = ['#6a45d8', '#33207c', '#150b38'];

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const easeOut = (f) => 1 - (1 - f) ** 3;
const easeBack = (f) => 1 + 2.2 * (f - 1) ** 3 + 1.2 * (f - 1) ** 2;
function bounceOut(f) {
  const n = 7.5625, d = 2.75;
  if (f < 1 / d) return n * f * f;
  if (f < 2 / d) return n * (f -= 1.5 / d) * f + 0.75;
  if (f < 2.5 / d) return n * (f -= 2.25 / d) * f + 0.9375;
  return n * (f -= 2.625 / d) * f + 0.984375;
}

// ---------------------------------------------------------------------------------------------
// Cached layers
// ---------------------------------------------------------------------------------------------
const layers = new Map();
function layer(ctx, key, x, y, w, h, paint) {
  let c = layers.get(key);
  if (c === undefined) {
    c = null;
    try {
      if (typeof OffscreenCanvas !== 'undefined') {
        c = new OffscreenCanvas(Math.ceil(w * 2), Math.ceil(h * 2));
        const l = c.getContext('2d');
        l.scale(2, 2);
        l.translate(-x, -y);
        paint(l);
      }
    } catch {
      c = null;
    }
    if (layers.size > 16) layers.clear();
    layers.set(key, c);
  }
  if (c) ctx.drawImage(c, x, y, w, h);
  else paint(ctx);
}

// ---------------------------------------------------------------------------------------------
// Small drawing helpers
// ---------------------------------------------------------------------------------------------
// Text never goes below ~11 css px: host.px is css pixels per virtual unit (a small phone in landscape is ~0.54).
const minSize = () => Math.min(26, Math.ceil(11 / Math.max(0.3, host.px)));
function text(ctx, str, x, y, size, color = CREAM, font = UI, weight = 600, align = 'center') {
  size = Math.max(size, minSize());
  ctx.textAlign = align;
  ctx.font = `${weight} ${size}px ${font}`;
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
}

function goldFill(ctx, y0, y1) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, '#fff6c8');
  g.addColorStop(0.45, '#f7cd55');
  g.addColorStop(1, '#c4861a');
  return g;
}

// Display-face text in gold with a dark edge, so it reads on every backdrop (light ones included).
function goldText(ctx, str, x, y, size, maxW = 640, weight = 700) {
  ctx.textAlign = 'center';
  ctx.font = `${weight} ${size}px ${DISPLAY}`;
  const w = ctx.measureText(str).width;
  if (w > maxW) {
    size = Math.floor((size * maxW) / w);
    ctx.font = `${weight} ${size}px ${DISPLAY}`;
  }
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.shadowColor = 'rgba(8,2,30,0.75)';
  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = 5;
  ctx.strokeStyle = 'rgba(40,16,4,0.95)';
  ctx.lineWidth = Math.max(3, size * 0.09);
  ctx.strokeText(str, x, y);
  ctx.restore();
  ctx.fillStyle = goldFill(ctx, y - size * 0.8, y + size * 0.1);
  ctx.fillText(str, x, y);
}

function star4(ctx, x, y, r, alpha) {
  if (alpha <= 0 || r <= 0) return;
  ctx.fillStyle = `rgba(255,244,190,${alpha})`;
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.quadraticCurveTo(x, y, x, y + r);
  ctx.quadraticCurveTo(x, y, x - r, y);
  ctx.quadraticCurveTo(x, y, x, y - r);
  ctx.fill();
}

function flourish(ctx, cx, y, inner, outer) {
  for (const s of [-1, 1]) {
    const g = ctx.createLinearGradient(cx + s * inner, 0, cx + s * outer, 0);
    g.addColorStop(0, 'rgba(247,205,85,0.95)');
    g.addColorStop(1, 'rgba(247,205,85,0)');
    ctx.strokeStyle = g;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(cx + s * inner, y);
    ctx.lineTo(cx + s * outer, y);
    ctx.stroke();
    ctx.fillStyle = '#f7cd55';
    ctx.beginPath();
    ctx.moveTo(cx + s * inner, y - 6);
    ctx.lineTo(cx + s * (inner + 6), y);
    ctx.lineTo(cx + s * inner, y + 6);
    ctx.lineTo(cx + s * (inner - 6), y);
    ctx.closePath();
    ctx.fill();
  }
}

// A small golden crown, centred on (cx, cy), half-width r.
function drawCrown(ctx, cx, cy, r, o = {}) {
  ctx.save();
  ctx.translate(cx, cy);
  if (o.alpha !== undefined) ctx.globalAlpha *= o.alpha;
  if (o.shadow !== false) {
    ctx.fillStyle = 'rgba(10,2,30,0.38)';
    ctx.beginPath();
    ctx.ellipse(r * 0.06, r * 0.92 + (o.lift ?? 0), r * (1.02 - (o.lift ?? 0) / (r * 6)), r * 0.2, 0, 0, TAU);
    ctx.fill();
  }
  ctx.scale(o.sx ?? 1, o.sy ?? 1);
  if (o.rot) ctx.rotate(o.rot);
  const tips = [[-1.04, -0.42], [0, -0.82], [1.04, -0.42]];
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(-r * 0.92, r * 0.4);
  ctx.lineTo(tips[0][0] * r, tips[0][1] * r);
  ctx.lineTo(-r * 0.5, r * 0.02);
  ctx.lineTo(0, tips[1][1] * r);
  ctx.lineTo(r * 0.5, r * 0.02);
  ctx.lineTo(tips[2][0] * r, tips[2][1] * r);
  ctx.lineTo(r * 0.92, r * 0.4);
  ctx.closePath();
  const body = ctx.createLinearGradient(-r, -r * 0.8, r * 0.6, r * 0.5);
  body.addColorStop(0, '#fff8d0');
  body.addColorStop(0.4, '#f9d25c');
  body.addColorStop(1, '#c58a1c');
  ctx.fillStyle = body;
  ctx.strokeStyle = '#4a2a06';
  ctx.lineWidth = Math.max(1.5, r * 0.085);
  ctx.stroke();
  ctx.fill();
  // inner facets: the right-hand slope of each point sits in shade
  ctx.fillStyle = 'rgba(150,88,8,0.35)';
  ctx.beginPath();
  ctx.moveTo(0, tips[1][1] * r);
  ctx.lineTo(r * 0.5, r * 0.02);
  ctx.lineTo(r * 0.5, r * 0.4);
  ctx.lineTo(0, r * 0.4);
  ctx.closePath();
  ctx.fill();
  // band
  const band = ctx.createLinearGradient(0, r * 0.36, 0, r * 0.78);
  band.addColorStop(0, '#ffe58a');
  band.addColorStop(1, '#a96c0e');
  ctx.beginPath();
  ctx.roundRect(-r * 0.98, r * 0.36, r * 1.96, r * 0.4, r * 0.1);
  ctx.fillStyle = band;
  ctx.stroke();
  ctx.fill();
  // jewels on the band
  const jewel = (x, c0, c1, jr) => {
    const g = ctx.createRadialGradient(x - jr * 0.3, r * 0.52, 0.2, x, r * 0.56, jr);
    g.addColorStop(0, c0);
    g.addColorStop(1, c1);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, r * 0.56, jr, 0, TAU);
    ctx.fill();
  };
  jewel(0, '#ff9db0', o.conflict ? '#7a0018' : '#c2163d', r * 0.13);
  jewel(-r * 0.58, '#b9c8ff', '#3b3fc4', r * 0.095);
  jewel(r * 0.58, '#b9c8ff', '#3b3fc4', r * 0.095);
  // pearls on the points
  for (const [tx, ty] of tips) {
    const g = ctx.createRadialGradient(tx * r - r * 0.05, ty * r - r * 0.06, 0.2, tx * r, ty * r, r * 0.16);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.5, '#ffe9a0');
    g.addColorStop(1, '#b97f18');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(tx * r, ty * r, r * 0.15, 0, TAU);
    ctx.stroke();
    ctx.fill();
  }
  // glint along the left edge
  ctx.strokeStyle = 'rgba(255,255,255,0.75)';
  ctx.lineWidth = Math.max(1, r * 0.05);
  ctx.beginPath();
  ctx.moveTo(-r * 0.84, r * 0.26);
  ctx.lineTo(-r * 0.9, -r * 0.18);
  ctx.stroke();
  ctx.restore();
}

// ---------------------------------------------------------------------------------------------
// Backdrop
// ---------------------------------------------------------------------------------------------
function paintBackdrop(ctx, palette) {
  const bg = palette.bg ?? DEFAULT_BG;
  const g = ctx.createRadialGradient(W * 0.5, 300, 40, W * 0.5, 420, 1300);
  g.addColorStop(0, bg[0]);
  g.addColorStop(0.45, bg[1]);
  g.addColorStop(1, bg[2]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  if (palette.bg) {
    ctx.fillStyle = 'rgba(18,8,48,0.34)';
    ctx.fillRect(0, 0, W, H);
  }
  // woven lattice with a stud at every crossing, like a brocade wall-hanging
  ctx.strokeStyle = 'rgba(255,222,140,0.055)';
  ctx.lineWidth = 1.5;
  const S = 72;
  for (let x = -H; x < W + H; x += S) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + H, H);
    ctx.moveTo(x, 0);
    ctx.lineTo(x - H, H);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(255,226,150,0.10)';
  for (let y = 0; y <= H + S; y += S / 2) {
    for (let x = (Math.round(y / (S / 2)) % 2) * (S / 2); x <= W; x += S) {
      ctx.beginPath();
      ctx.moveTo(x, y - 5);
      ctx.lineTo(x + 5, y);
      ctx.lineTo(x, y + 5);
      ctx.lineTo(x - 5, y);
      ctx.closePath();
      ctx.fill();
    }
  }
  const v = ctx.createRadialGradient(W / 2, H * 0.42, 300, W / 2, H * 0.5, 1050);
  v.addColorStop(0, 'rgba(6,2,22,0)');
  v.addColorStop(1, 'rgba(6,2,22,0.72)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, W, H);
}

function drawBackdrop(ctx, state, palette) {
  layer(ctx, `bg:${state.palette}:${W}x${H}`, 0, 0, W, H, (l) => paintBackdrop(l, palette));
  // slow gold motes drifting upward
  for (let k = 0; k < 16; k++) {
    const ph = (state.t * (0.018 + (k % 5) * 0.004) + k * 0.173) % 1;
    const x = ((k * 197) % W) + Math.sin(state.t * 0.5 + k * 1.7) * 26;
    const y = H - ph * (H + 40);
    const a = Math.sin(ph * Math.PI) * (0.22 + (k % 3) * 0.1);
    star4(ctx, x, y, 5 + (k % 4) * 2.5, a);
  }
}

// ---------------------------------------------------------------------------------------------
// The board: enamel tiles, gold inlays between regions, gold frame
// ---------------------------------------------------------------------------------------------
function paintPattern(ctx, kind, x, y, cs, color) {
  if (kind === 0) return;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x + 3, y + 3, cs - 6, cs - 6, 4);
  ctx.clip();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = Math.max(1.6, cs * 0.032);
  const step = cs / 4;
  ctx.beginPath();
  if (kind === 1) {
    for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) {
      ctx.moveTo(x + cs * (0.2 + i * 0.3) + cs * 0.045, y + cs * (0.2 + j * 0.3));
      ctx.arc(x + cs * (0.2 + i * 0.3), y + cs * (0.2 + j * 0.3), cs * 0.045, 0, TAU);
    }
    ctx.fill();
  } else if (kind === 2 || kind === 4 || kind === 6) {
    for (let d = -cs; d < cs * 2; d += step) {
      if (kind !== 4) { ctx.moveTo(x + d, y + cs); ctx.lineTo(x + d + cs, y); }
      if (kind !== 2) { ctx.moveTo(x + d, y); ctx.lineTo(x + d + cs, y + cs); }
    }
    ctx.stroke();
  } else if (kind === 3 || kind === 5) {
    for (let d = step / 2; d < cs; d += step) {
      if (kind === 3) { ctx.moveTo(x, y + d); ctx.lineTo(x + cs, y + d); } else { ctx.moveTo(x + d, y); ctx.lineTo(x + d, y + cs); }
    }
    ctx.stroke();
  } else if (kind === 7) {
    ctx.arc(x + cs / 2, y + cs / 2, cs * 0.3, 0, TAU);
    ctx.moveTo(x + cs / 2 + cs * 0.14, y + cs / 2);
    ctx.arc(x + cs / 2, y + cs / 2, cs * 0.14, 0, TAU);
    ctx.stroke();
  } else if (kind === 8) {
    for (const k of [0.34, 0.17]) {
      ctx.moveTo(x + cs / 2, y + cs / 2 - cs * k);
      ctx.lineTo(x + cs / 2 + cs * k, y + cs / 2);
      ctx.lineTo(x + cs / 2, y + cs / 2 + cs * k);
      ctx.lineTo(x + cs / 2 - cs * k, y + cs / 2);
      ctx.closePath();
    }
    ctx.stroke();
  } else {
    for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) {
      const px = x + cs * (0.28 + i * 0.44), py = y + cs * (0.28 + j * 0.44), a = cs * 0.09;
      ctx.moveTo(px - a, py); ctx.lineTo(px + a, py); ctx.moveTo(px, py - a); ctx.lineTo(px, py + a);
    }
    ctx.stroke();
  }
  ctx.restore();
}

// geo = { x, y, px (board side in virtual px), n (cells per side) }
function paintBoard(ctx, geo, regions, palette, paletteIndex) {
  const { x: bx, y: by, px, n } = geo;
  const cs = px / n;
  const F = Math.max(12, px * 0.03); // frame thickness
  const patterned = palette.name === 'Colour-blind safe';
  // shadow on the wall
  ctx.save();
  ctx.shadowColor = 'rgba(4,0,20,0.7)';
  ctx.shadowBlur = 40;
  ctx.shadowOffsetY = 18;
  ctx.fillStyle = '#2a1604';
  ctx.beginPath();
  ctx.roundRect(bx - F, by - F, px + F * 2, px + F * 2, F * 1.1);
  ctx.fill();
  ctx.restore();
  // gold frame
  const fr = ctx.createLinearGradient(bx - F, by - F, bx + px + F, by + px + F);
  fr.addColorStop(0, '#fff0b0');
  fr.addColorStop(0.28, '#e9b640');
  fr.addColorStop(0.55, '#a8700f');
  fr.addColorStop(0.8, '#e2ab36');
  fr.addColorStop(1, '#8a5a0a');
  ctx.fillStyle = fr;
  ctx.beginPath();
  ctx.roundRect(bx - F, by - F, px + F * 2, px + F * 2, F * 1.1);
  ctx.fill();
  ctx.strokeStyle = '#3d2205';
  ctx.lineWidth = 2;
  ctx.stroke();
  // engraved line round the frame
  ctx.strokeStyle = 'rgba(80,44,4,0.7)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(bx - F / 2, by - F / 2, px + F, px + F, F * 0.6);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,246,200,0.7)';
  ctx.beginPath();
  ctx.roundRect(bx - F / 2 + 1.5, by - F / 2 + 1.5, px + F - 3, px + F - 3, F * 0.6);
  ctx.stroke();
  // the bed the tiles sit in
  ctx.fillStyle = '#1b0d05';
  ctx.beginPath();
  ctx.roundRect(bx - 3, by - 3, px + 6, px + 6, 6);
  ctx.fill();

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(bx, by, px, px, 5);
  ctx.clip();
  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      const id = regions[row * n + col];
      const x = bx + col * cs, y = by + row * cs;
      ctx.fillStyle = regionColor(palette, id, n, 22);
      ctx.fillRect(x, y, cs + 0.5, cs + 0.5);
      const g = ctx.createLinearGradient(x, y, x + cs * 0.6, y + cs);
      g.addColorStop(0, regionColor(palette, id, n, 61));
      g.addColorStop(0.5, regionColor(palette, id, n, 50));
      g.addColorStop(1, regionColor(palette, id, n, 38));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.roundRect(x + 1.5, y + 1.5, cs - 3, cs - 3, Math.max(3, cs * 0.07));
      ctx.fill();
      paintPattern(ctx, id % 10, x, y, cs, patterned ? 'rgba(10,6,30,0.42)' : 'rgba(255,255,255,0.11)');
      // enamel bevel: lit top-left, shaded bottom-right
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(255,255,255,0.34)';
      ctx.beginPath();
      ctx.moveTo(x + 3.5, y + cs - 5);
      ctx.lineTo(x + 3.5, y + 3.5);
      ctx.lineTo(x + cs - 5, y + 3.5);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(0,0,0,0.26)';
      ctx.beginPath();
      ctx.moveTo(x + cs - 3.5, y + 5);
      ctx.lineTo(x + cs - 3.5, y + cs - 3.5);
      ctx.lineTo(x + 5, y + cs - 3.5);
      ctx.stroke();
    }
  }
  // one sheen over the whole plate
  const sheen = ctx.createRadialGradient(bx + px * 0.15, by + px * 0.05, 10, bx + px * 0.25, by + px * 0.2, px * 0.95);
  sheen.addColorStop(0, 'rgba(255,255,255,0.20)');
  sheen.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = sheen;
  ctx.fillRect(bx, by, px, px);
  const shade = ctx.createLinearGradient(bx, by, bx + px, by + px);
  shade.addColorStop(0.55, 'rgba(10,0,40,0)');
  shade.addColorStop(1, 'rgba(10,0,40,0.22)');
  ctx.fillStyle = shade;
  ctx.fillRect(bx, by, px, px);
  ctx.restore();

  // gold inlay wherever two regions meet
  const inlay = (color, width, dx, dy) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let row = 0; row < n; row++) {
      for (let col = 0; col < n; col++) {
        const i = row * n + col, x = bx + col * cs + dx, y = by + row * cs + dy;
        if (col < n - 1 && regions[i] !== regions[i + 1]) { ctx.moveTo(x + cs, y); ctx.lineTo(x + cs, y + cs); }
        if (row < n - 1 && regions[i] !== regions[i + n]) { ctx.moveTo(x, y + cs); ctx.lineTo(x + cs, y + cs); }
      }
    }
    ctx.stroke();
  };
  const wIn = Math.max(5, cs * 0.085);
  inlay('rgba(20,8,0,0.92)', wIn + 4, 0, 0.8);
  inlay('#d9a233', wIn, 0, 0);
  inlay('rgba(255,246,196,0.9)', Math.max(1.2, wIn * 0.28), -wIn * 0.22, -wIn * 0.22);
  // amethyst studs at the frame corners
  for (const [u, v] of [[0, 0], [1, 0], [1, 1], [0, 1]]) {
    const cx = bx - F / 2 + u * (px + F), cy = by - F / 2 + v * (px + F), r = F * 0.34;
    const g = ctx.createRadialGradient(cx - r * 0.4, cy - r * 0.4, 0.5, cx, cy, r);
    g.addColorStop(0, '#f1dcff');
    g.addColorStop(0.5, '#a66bff');
    g.addColorStop(1, '#3f1a8c');
    ctx.fillStyle = g;
    ctx.strokeStyle = '#3d2205';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, TAU);
    ctx.fill();
    ctx.stroke();
  }
  return paletteIndex;
}

function drawBoardBase(ctx, geo, regions, palette, paletteIndex) {
  const F = Math.max(12, geo.px * 0.03) + 64;
  layer(ctx, `board:${paletteIndex}:${geo.x}:${geo.y}:${geo.px}:${regions.join('')}`, geo.x - F, geo.y - F, geo.px + F * 2, geo.px + F * 2, (l) => paintBoard(l, geo, regions, palette, paletteIndex));
}

function drawRuledOut(ctx, x, y, cs, f) {
  if (f <= 0) return;
  ctx.fillStyle = `rgba(14,6,40,${0.27 * f})`;
  ctx.beginPath();
  ctx.roundRect(x + 1.5, y + 1.5, cs - 3, cs - 3, Math.max(3, cs * 0.07));
  ctx.fill();
  const r = cs * 0.085 * (0.6 + 0.4 * f), cx = x + cs / 2, cy = y + cs / 2;
  ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(2.4, cs * 0.04);
  ctx.strokeStyle = `rgba(8,2,26,${0.55 * f})`;
  ctx.beginPath();
  ctx.moveTo(cx - r, cy - r + 1.5); ctx.lineTo(cx + r, cy + r + 1.5);
  ctx.moveTo(cx + r, cy - r + 1.5); ctx.lineTo(cx - r, cy + r + 1.5);
  ctx.stroke();
  ctx.strokeStyle = `rgba(255,240,214,${0.7 * f})`;
  ctx.beginPath();
  ctx.moveTo(cx - r, cy - r); ctx.lineTo(cx + r, cy + r);
  ctx.moveTo(cx + r, cy - r); ctx.lineTo(cx - r, cy + r);
  ctx.stroke();
}

// A crown on a cell; `age` = seconds since it was placed (drops in, lands with a squash, sparkles).
function drawPlacedCrown(ctx, cx, cy, cs, age, o = {}) {
  const f = clamp01(age / 0.5), b = bounceOut(f);
  const lift = (1 - b) * cs * 0.75;
  const land = age > 0.17 && age < 0.36 ? Math.sin(((age - 0.17) / 0.19) * Math.PI) * 0.16 : 0;
  // warm glow on the tile
  const glow = ctx.createRadialGradient(cx, cy, 1, cx, cy, cs * 0.62);
  glow.addColorStop(0, o.conflict ? `rgba(255,70,100,${0.55 + 0.25 * (o.pulse ?? 0)})` : 'rgba(255,236,160,0.5)');
  glow.addColorStop(1, o.conflict ? 'rgba(255,70,100,0)' : 'rgba(255,236,160,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(cx - cs / 2, cy - cs / 2, cs, cs);
  const r = cs * 0.3;
  drawCrown(ctx, cx + (o.shake ?? 0), cy - cs * 0.03 - lift - (o.hop ?? 0), r, { lift: lift + (o.hop ?? 0), sx: 1 + land, sy: 1 - land, conflict: o.conflict, alpha: Math.min(1, f * 4) });
  if (age > 0.15 && age < 0.85) {
    const s = (age - 0.15) / 0.7;
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * TAU + 0.4, d = cs * (0.25 + 0.42 * easeOut(s));
      star4(ctx, cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.85, cs * 0.11 * (1 - s) + 1, 1 - s);
    }
  }
}

function drawBoardMarks(ctx, state, geo) {
  const { size, cells, conflicts, cellT, t } = state;
  const cs = geo.px / size;
  const conflictSet = new Set(conflicts);
  const pulse = 0.5 + 0.5 * Math.sin(t * 6);
  const solved = state.scene === 'solved';
  // the cell under the finger
  if (state.scene === 'playing' && state.ptr.down) {
    const col = Math.floor((state.ptr.x - geo.x) / cs), row = Math.floor((state.ptr.y - geo.y) / cs);
    if (col >= 0 && col < size && row >= 0 && row < size) {
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.fillRect(geo.x + col * cs, geo.y + row * cs, cs, cs);
    }
  }
  for (let i = 0; i < cells.length; i++) {
    if (cells[i] !== 'x') continue;
    const x = geo.x + (i % size) * cs, y = geo.y + Math.floor(i / size) * cs;
    drawRuledOut(ctx, x, y, cs, solved ? 0.55 : clamp01((t - (cellT[i] ?? -9)) / 0.22));
  }
  // a band of light crossing the plate now and then
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(geo.x, geo.y, geo.px, geo.px, 5);
  ctx.clip();
  const sweep = ((t * 0.16) % 1) * 3 - 1;
  if (sweep < 1.6) {
    const sx = geo.x + sweep * geo.px;
    const g = ctx.createLinearGradient(sx - 120, geo.y, sx + 120, geo.y + 160);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.5, `rgba(255,255,255,${solved ? 0.22 : 0.11})`);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(geo.x, geo.y, geo.px, geo.px);
  }
  ctx.restore();
  for (let i = 0; i < cells.length; i++) {
    if (cells[i] !== 'crown') continue;
    const col = i % size, row = Math.floor(i / size);
    const cx = geo.x + col * cs + cs / 2, cy = geo.y + row * cs + cs / 2;
    const age = t - (cellT[i] ?? -9);
    const bad = conflictSet.has(i);
    if (bad) {
      ctx.strokeStyle = `rgba(255,84,112,${0.65 + 0.35 * pulse})`;
      ctx.lineWidth = Math.max(3, cs * 0.06);
      ctx.beginPath();
      ctx.roundRect(cx - cs / 2 + 5, cy - cs / 2 + 5, cs - 10, cs - 10, cs * 0.12);
      ctx.stroke();
    }
    const wave = solved ? Math.max(0, Math.sin(state.sceneT * 5 - (col + row) * 0.55)) * cs * 0.16 * clamp01(2.2 - state.sceneT * 0.5) : 0;
    drawPlacedCrown(ctx, cx, cy, cs, age, { conflict: bad, pulse, hop: wave, shake: bad && age < 0.45 ? Math.sin(age * 60) * 3 * (1 - age / 0.45) : 0 });
    if (solved) {
      const tw = (state.sceneT * 1.3 + i * 0.37) % 1;
      star4(ctx, cx + cs * 0.24, cy - cs * 0.3, cs * 0.16 * Math.sin(tw * Math.PI), Math.sin(tw * Math.PI));
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Buttons, chips, icons
// ---------------------------------------------------------------------------------------------
const ICONS = {
  crown: (ctx, x, y, s) => drawCrown(ctx, x, y - s * 0.05, s * 0.46, { shadow: false }),
  grid: (ctx, x, y, s, c) => {
    ctx.fillStyle = c;
    const q = s * 0.26;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
      ctx.globalAlpha = (i + j) % 2 === 0 ? 1 : 0.55;
      ctx.beginPath();
      ctx.roundRect(x + i * q * 1.2 - q / 2, y + j * q * 1.2 - q / 2, q, q, 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  },
  calendar: (ctx, x, y, s, c) => {
    ctx.strokeStyle = c; ctx.fillStyle = c; ctx.lineWidth = 3; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.roundRect(x - s * 0.4, y - s * 0.34, s * 0.8, s * 0.74, 5); ctx.stroke();
    ctx.fillRect(x - s * 0.4, y - s * 0.34, s * 0.8, s * 0.2);
    ctx.fillRect(x - s * 0.22, y - s * 0.48, 4, s * 0.2); ctx.fillRect(x + s * 0.22 - 4, y - s * 0.48, 4, s * 0.2);
    ctx.beginPath(); ctx.arc(x, y + s * 0.14, s * 0.09, 0, TAU); ctx.fill();
  },
  bulb: (ctx, x, y, s, c) => {
    ctx.strokeStyle = c; ctx.fillStyle = c; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(x, y - s * 0.1, s * 0.27, Math.PI * 0.75, Math.PI * 0.25); ctx.closePath(); ctx.stroke();
    ctx.beginPath(); ctx.roundRect(x - s * 0.13, y + s * 0.2, s * 0.26, s * 0.16, 3); ctx.fill();
    for (const a of [-2.4, -1.57, -0.74]) { ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * s * 0.38, y - s * 0.1 + Math.sin(a) * s * 0.38); ctx.lineTo(x + Math.cos(a) * s * 0.48, y - s * 0.1 + Math.sin(a) * s * 0.48); ctx.stroke(); }
  },
  undo: (ctx, x, y, s, c) => {
    ctx.strokeStyle = c; ctx.fillStyle = c; ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(x + s * 0.02, y + s * 0.06, s * 0.3, Math.PI * 1.15, Math.PI * 0.55); ctx.stroke();
    const ax = x + s * 0.02 + Math.cos(Math.PI * 1.15) * s * 0.3, ay = y + s * 0.06 + Math.sin(Math.PI * 1.15) * s * 0.3;
    ctx.beginPath(); ctx.moveTo(ax - s * 0.17, ay + s * 0.1); ctx.lineTo(ax + s * 0.04, ay - s * 0.2); ctx.lineTo(ax + s * 0.17, ay + s * 0.12); ctx.closePath(); ctx.fill();
  },
};

function button(ctx, state, rect, label, o = {}) {
  const held = state.ptr.down && inRect(state.ptr.x, state.ptr.y, rect);
  const tau = o.id && state.press.id === o.id ? state.t - state.press.t : 9;
  const spring = tau < 0.7 ? -Math.cos(tau * 20) * Math.exp(-tau * 7) * 0.07 : 0;
  const depth = 10, push = held ? 7 : tau < 0.09 ? 7 * (1 - tau / 0.09) : 0;
  const R = Math.min(30, rect.h * 0.3);
  const primary = Boolean(o.primary);
  ctx.save();
  ctx.translate(rect.x + rect.w / 2, rect.y + rect.h / 2);
  ctx.scale(1 + spring, 1 + spring);
  ctx.translate(-rect.w / 2, -rect.h / 2);
  if (o.dim) ctx.globalAlpha *= 0.5;
  const fh = rect.h - depth; // face height
  // cast shadow
  ctx.save();
  ctx.shadowColor = primary ? 'rgba(255,190,60,0.35)' : 'rgba(4,0,20,0.6)';
  ctx.shadowBlur = primary ? 34 + 10 * Math.sin(state.t * 2.4) : 22;
  ctx.shadowOffsetY = 10;
  ctx.fillStyle = primary ? '#6b3f04' : '#1a0b45';
  ctx.beginPath(); ctx.roundRect(0, depth, rect.w, fh, R); ctx.fill();
  ctx.restore();
  // the side of the slab
  ctx.fillStyle = primary ? '#7a4a06' : '#23105c';
  ctx.beginPath(); ctx.roundRect(0, depth, rect.w, fh, R); ctx.fill();
  // face
  ctx.fillStyle = primary ? '#f5c23f' : '#6d43d6';   // flat face: no gloss, glint or inner outline
  ctx.beginPath(); ctx.roundRect(0, push, rect.w, fh, R); ctx.fill();
  ctx.strokeStyle = primary ? '#6b3f04' : '#f0c24c';
  ctx.lineWidth = primary ? 2 : 2.5;
  ctx.beginPath(); ctx.roundRect(0, push, rect.w, fh, R); ctx.stroke();

  // label (+ icon)
  let size = Math.min(o.size ?? 34, Math.max(minSize(), rect.h * 0.46)), ink = primary ? '#3a1d02' : CREAM;
  ctx.font = `700 ${size}px ${DISPLAY}`;
  let iconS = o.icon ? size * 1.5 : 0, gap = o.icon ? 16 : 0;
  let tw = ctx.measureText(label).width + (o.extra ?? 0);
  const maxTw = rect.w - 28 - iconS - gap;
  if (tw > maxTw) {                                    // shrink the label to fit the button (never below the readable floor)
    const k = Math.max(0.5, maxTw / tw);
    size = Math.max(minSize() * 0.9, size * k);
    ctx.font = `700 ${size}px ${DISPLAY}`;
    iconS = o.icon ? size * 1.5 : 0; gap = o.icon ? 16 * k : 0;
    tw = ctx.measureText(label).width + (o.extra ?? 0) * k;
  }
  let x0 = rect.w / 2 - (tw + iconS + gap) / 2;
  const cy = push + fh / 2;
  if (o.icon) { ctx.save(); ICONS[o.icon](ctx, x0 + iconS / 2, cy, iconS, ink); ctx.restore(); x0 += iconS + gap; }
  ctx.save();
  ctx.shadowColor = primary ? 'rgba(255,255,255,0.5)' : 'rgba(10,0,40,0.7)';
  ctx.shadowOffsetY = primary ? 1.5 : 2;
  ctx.shadowBlur = primary ? 0 : 3;
  text(ctx, label, x0, cy + size * 0.35, size, ink, DISPLAY, 700, 'left');
  ctx.restore();
  if (o.after) o.after(ctx, x0 + ctx.measureText(label).width, cy);
  ctx.restore();
}

// A status chip filling `r`: small caps label on the left, value on the right.
function chip(ctx, r, label, value) {
  const hh = r.h, big = hh >= 58;
  ctx.save();
  ctx.fillStyle = 'rgba(14,5,44,0.72)';
  ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 5;
  ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, hh, hh / 2); ctx.fill();
  ctx.restore();
  ctx.strokeStyle = 'rgba(240,194,76,0.75)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, hh, hh / 2); ctx.stroke();
  const ls = big ? 20 : 18, vs = big ? 30 : 26, pad = hh * 0.45;
  ctx.font = `700 ${Math.max(ls, minSize())}px ${DISPLAY}`;
  const lw = ctx.measureText(label).width;
  ctx.font = `700 ${vs}px ${UI}`;
  const vw = ctx.measureText(value).width;
  const k = Math.min(1, (r.w - 2 * pad - 8) / (lw + vw));
  text(ctx, label, r.x + pad, r.y + hh / 2 + 7 * k, ls * k, 'rgba(247,226,170,0.85)', DISPLAY, 700, 'left');
  text(ctx, value, r.x + r.w - pad, r.y + hh / 2 + 10 * k, vs * k, '#ffffff', UI, 700, 'right');
}

function swatches(palette, n) {
  return (ctx, x, cy) => {
    for (let k = 0; k < 5; k++) {
      const px = x + 26 + k * 25;
      ctx.fillStyle = regionColor(palette, Math.floor((k * n) / 5), n, 52);
      ctx.beginPath(); ctx.arc(px, cy, 12, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(255,240,200,0.9)'; ctx.lineWidth = 2; ctx.stroke();
    }
  };
}

function panel(ctx, x, y, w, h) {
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 44; ctx.shadowOffsetY = 16;
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, '#3a2290'); g.addColorStop(1, '#190b4a');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.roundRect(x, y, w, h, 34); ctx.fill();
  ctx.restore();
  ctx.strokeStyle = '#f0c24c'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.roundRect(x, y, w, h, 34); ctx.stroke();
}

function rays(ctx, cx, cy, r, t, alpha) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(t * 0.18);
  const g = ctx.createRadialGradient(0, 0, r * 0.15, 0, 0, r);
  g.addColorStop(0, `rgba(255,226,140,${alpha})`);
  g.addColorStop(1, 'rgba(255,226,140,0)');
  ctx.fillStyle = g;
  for (let k = 0; k < 12; k++) {
    ctx.rotate(TAU / 12);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(r, -r * 0.1); ctx.lineTo(r, r * 0.1); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

function wrapText(ctx, str, cx, y, maxWidth, lineHeight, size, color) {
  ctx.font = `500 ${size}px ${UI}`;
  let line = '';
  for (const word of str.split(' ')) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) { text(ctx, line, cx, y, size, color, UI, 500); line = word; y += lineHeight; } else line = test;
  }
  if (line) text(ctx, line, cx, y, size, color, UI, 500);
}

const clock = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

function highlight(ctx, x, y, cs, alpha = 0.24) {
  ctx.fillStyle = `rgba(255,255,255,${alpha})`;
  ctx.fillRect(x, y, cs, cs);
}

function drawRulesArt(ctx, name, state, palette) {
  if (!name) return;
  const cx = 360;
  if (name === 'board' || name === 'win') {
    const { geo: heroGeo, regions, crowns } = HERO;
    const geo = { x: cx - heroGeo.px / 2, y: 280, px: heroGeo.px, n: heroGeo.n };
    drawBoardBase(ctx, geo, regions, palette, `rules:${name}:${state.palette}`);
    const cs = geo.px / geo.n;
    crowns.forEach((i) => {
      const col = i % geo.n, row = Math.floor(i / geo.n);
      drawPlacedCrown(ctx, geo.x + col * cs + cs / 2, geo.y + row * cs + cs / 2, cs, 1);
    });
    if (name === 'win') {
      chip(ctx, { x: cx - 235, y: geo.y + geo.px + 34, w: 210, h: 62 }, 'TIME', '1:42');
      chip(ctx, { x: cx + 25, y: geo.y + geo.px + 34, w: 210, h: 62 }, 'MOVES', '11');
    }
  } else if (name === 'touch') {
    const n = 3, cell = 130;
    const geo = { x: cx - (n * cell) / 2, y: 340, px: n * cell, n };
    drawBoardBase(ctx, geo, new Array(9).fill(0), palette, `rulesTouch:${state.palette}`);
    for (let i = 0; i < 9; i++) {
      if (i === 4) continue;
      const col = i % 3, row = Math.floor(i / 3);
      highlight(ctx, geo.x + col * cell, geo.y + row * cell, cell);
    }
    drawPlacedCrown(ctx, geo.x + cell * 1.5, geo.y + cell * 1.5, cell, 1);
    text(ctx, 'Any crown on a lit cell would touch the centre crown', cx, geo.y + geo.px + 56, 22, 'rgba(250,240,215,0.85)', UI, 500);
  } else if (name === 'cycle') {
    const cell = 140, gap = 46;
    const totalW = cell * 3 + gap * 2;
    let x = cx - totalW / 2;
    const y = 380;
    const labels = ['Empty', 'Crossed out', 'Crown'];
    const marks = ['empty', 'x', 'crown'];
    marks.forEach((mark, k) => {
      const geo = { x, y, px: cell, n: 1 };
      drawBoardBase(ctx, geo, [0], palette, `rulesCycle:${k}:${state.palette}`);
      if (mark === 'x') drawRuledOut(ctx, x, y, cell, 1);
      else if (mark === 'crown') drawPlacedCrown(ctx, x + cell / 2, y + cell / 2, cell, 1);
      text(ctx, labels[k], x + cell / 2, y + cell + 40, 22, 'rgba(250,240,215,0.88)', UI, 600);
      if (k < 2) text(ctx, '→', x + cell + gap / 2, y + cell / 2 + 10, 34, 'rgba(240,194,76,0.85)');
      x += cell + gap;
    });
  } else if (name === 'autocross') {
    const { regions } = HERO;
    const n = HERO.geo.n, px = HERO.geo.px;
    const geo = { x: cx - px / 2, y: 280, px, n };
    drawBoardBase(ctx, geo, regions, palette, `rulesAuto:${state.palette}`);
    const cs = geo.px / n;
    const cRow = 1, cCol = 1;
    const crownIndex = cRow * n + cCol;
    const crownRegion = regions[crownIndex];
    for (let i = 0; i < n * n; i++) {
      if (i === crownIndex) continue;
      const row = Math.floor(i / n), col = i % n;
      const sameRow = row === cRow, sameCol = col === cCol;
      const sameRegion = regions[i] === crownRegion;
      const touching = Math.abs(row - cRow) <= 1 && Math.abs(col - cCol) <= 1;
      if (sameRow || sameCol || sameRegion || touching) drawRuledOut(ctx, geo.x + col * cs, geo.y + row * cs, cs, 1);
    }
    drawPlacedCrown(ctx, geo.x + cCol * cs + cs / 2, geo.y + cRow * cs + cs / 2, cs, 1);
  } else if (name === 'conflict') {
    const n = 4, cell = 110;
    const geo = { x: cx - (n * cell) / 2, y: 330, px: n * cell, n };
    // Each row is its own region, so the two illustrated crowns (different rows, different
    // columns, different regions) conflict for exactly one reason: they touch diagonally.
    const regions = Array.from({ length: n * n }, (_, i) => Math.floor(i / n));
    drawBoardBase(ctx, geo, regions, palette, `rulesConflict:${state.palette}`);
    // The pulsing red ring itself is drawn by drawBoardMarks in real play, not by
    // drawPlacedCrown (which only tints the crown's own jewel for `conflict`) — reproduced here
    // so this diagram matches what a real conflict actually looks like on the board.
    const pulse = 0.5 + 0.5 * Math.sin(state.t * 6);
    [5, 10].forEach((i) => {
      const col = i % n, row = Math.floor(i / n);
      const ccx = geo.x + col * cell + cell / 2, ccy = geo.y + row * cell + cell / 2;
      drawPlacedCrown(ctx, ccx, ccy, cell, 1, { conflict: true });
      ctx.strokeStyle = `rgba(255,84,112,${0.65 + 0.35 * pulse})`;
      ctx.lineWidth = Math.max(3, cell * 0.06);
      ctx.beginPath();
      ctx.roundRect(ccx - cell / 2 + 5, ccy - cell / 2 + 5, cell - 10, cell - 10, cell * 0.12);
      ctx.stroke();
    });
    text(ctx, 'Diagonally adjacent crowns both flash red', cx, geo.y + geo.px + 56, 22, 'rgba(250,240,215,0.85)', UI, 500);
  } else if (name === 'hintundo') {
    const hintR = { x: cx - 300, y: 460, w: 260, h: 130 };
    const undoR = { x: cx + 40, y: 460, w: 260, h: 130 };
    button(ctx, state, hintR, 'Hint', { size: 32, icon: 'bulb' });
    button(ctx, state, undoR, 'Undo', { size: 32, icon: 'undo' });
  } else if (name === 'colours') {
    const names = [0, 4, 6];
    const s = 130, gap = 40;
    const totalW = names.length * s + (names.length - 1) * gap;
    let x = cx - totalW / 2;
    const y = 380;
    names.forEach((idx, k) => {
      const p = PALETTES[idx];
      const geo = { x, y, px: s, n: 1 };
      // Region id 1 (not 0) so the Colour-blind safe swatch actually shows its pattern —
      // paintPattern in this file treats pattern kind 0 (id % 10 === 0) as "no pattern".
      drawBoardBase(ctx, geo, [1], p, `rulesPalette:${idx}`);
      text(ctx, p.name, x + s / 2, y + s + 36, 20, 'rgba(250,240,215,0.85)', UI, 600);
      x += s + gap;
    });
  } else if (name === 'modes') {
    const items = [['crown', '7×7 Endless'], ['calendar', 'Daily Puzzle'], ['grid', 'Expert 10×10']];
    const s = 92, gap = 90;
    const totalW = items.length * s + (items.length - 1) * gap;
    let x = cx - totalW / 2 + s / 2;
    const y = 460;
    items.forEach(([icon, label]) => {
      ICONS[icon](ctx, x, y, s, '#f7cd55');
      text(ctx, label, x, y + s * 0.85, 22, 'rgba(250,240,215,0.9)', UI, 600);
      x += s + gap;
    });
  } else if (name === 'generate') {
    const { geo: heroGeo, regions } = HERO;
    const geo = { x: cx - heroGeo.px / 2, y: 300, px: heroGeo.px, n: heroGeo.n };
    drawBoardBase(ctx, geo, regions, palette, `rulesGen:${state.palette}`);
    text(ctx, 'checked by a real solver before it is ever shown to you', cx, geo.y + geo.px + 54, 22, 'rgba(250,240,215,0.85)', UI, 500);
  }
}

// ---------------------------------------------------------------------------------------------
// Small shared helpers for the fluid layout
// ---------------------------------------------------------------------------------------------
let lockup = null; // the themed ARCFORGE lockup (web/brand/arcforge-lockup.png), set by main.js once loaded
export const setLockup = (img) => { lockup = img; };
const LOCKUP_ASPECT = 1200 / 327;

// Wraps `str` into lines no wider than maxW at the current font; returns the lines. A single word wider than maxW
// (a long hyphenated word at 300% text) is broken after a hyphen, else by characters, so nothing runs outside its panel.
export function wrapLines(ctx, str, maxW) {
  const lines = [];
  let line = '';
  const put = (tok) => {
    const test = line ? `${line} ${tok}` : tok;
    if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = tok; } else line = test;
  };
  for (const word of str.split(' ')) {
    if (ctx.measureText(word).width <= maxW) { put(word); continue; }
    let rest = word;
    while (ctx.measureText(rest).width > maxW) {
      let cut = 1;
      while (cut < rest.length && ctx.measureText(rest.slice(0, cut + 1)).width <= maxW) cut++;
      const h = rest.slice(0, cut).lastIndexOf('-');
      if (h >= 1) cut = h + 1;
      put(rest.slice(0, cut)); rest = rest.slice(cut);
      lines.push(line); line = '';
    }
    put(rest);
  }
  if (line) lines.push(line);
  return lines;
}

// A short note centred in `r`: wraps, and steps the size down (never below the readable floor) until it fits the box.
function note(ctx, str, r, size, color, weight = 500) {
  let s = Math.max(size, minSize());
  let lines;
  for (;;) {
    ctx.font = `${weight} ${s}px ${UI}`;
    lines = wrapLines(ctx, str, r.w);
    if (lines.length * s * 1.25 <= r.h + 1 || s <= minSize()) break;
    s -= 1;
  }
  const lh = s * 1.25, y0 = r.y + (r.h - lines.length * lh) / 2 + s * 0.95;
  lines.forEach((ln, i) => text(ctx, ln, r.x + r.w / 2, y0 + i * lh, s, color, UI, weight));
}

// A soft translucent card behind a group of controls (wide layouts).
function card(ctx, r) {
  ctx.save();
  ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, 28);
  const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
  g.addColorStop(0, 'rgba(32,18,78,0.55)'); g.addColorStop(1, 'rgba(11,6,30,0.7)');
  ctx.fillStyle = g; ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(247,205,85,0.3)'; ctx.stroke();
  ctx.restore();
}

// ---------------------------------------------------------------------------------------------
// Title screen hero: a small field that fills itself in, over and over
// ---------------------------------------------------------------------------------------------
const HERO = {
  geo: { x: 150, y: 414, px: 420, n: 5 }, // the art blocks in the Rules reader use this size
  regions: [0, 0, 1, 1, 1, 0, 0, 1, 2, 2, 3, 0, 1, 2, 2, 3, 3, 4, 4, 2, 3, 3, 4, 4, 4],
  crowns: [0, 7, 14, 16, 23],
};

function drawHero(ctx, state, palette, geo) {
  const { regions, crowns } = HERO;
  const cs = geo.px / geo.n, k = geo.px / 420;
  const bob = Math.sin(state.t * 1.1) * 5 * k;
  ctx.save();
  ctx.translate(0, bob);
  rays(ctx, geo.x + geo.px / 2, geo.y + geo.px / 2, geo.px * 1.0, state.t, 0.16);
  drawBoardBase(ctx, geo, regions, palette, state.palette);
  const phase = (state.t + 4.2) % 8.4;
  const out = clamp01((phase - 7.6) / 0.6); // everything lifts away before the loop restarts
  const ages = crowns.map((c, k2) => phase - (0.5 + k2 * 0.7));
  for (let i = 0; i < 25; i++) {
    if (crowns.includes(i)) continue;
    let f = 0;
    crowns.forEach((c, k2) => {
      const dr = Math.abs(Math.floor(i / 5) - Math.floor(c / 5)), dc = Math.abs((i % 5) - (c % 5));
      if (dr === 0 || dc === 0 || regions[i] === regions[c] || (dr <= 1 && dc <= 1)) f = Math.max(f, clamp01((ages[k2] - 0.2 - Math.max(dr, dc) * 0.05) / 0.25));
    });
    drawRuledOut(ctx, geo.x + (i % 5) * cs, geo.y + Math.floor(i / 5) * cs, cs, f * (1 - out));
  }
  crowns.forEach((c, k2) => {
    if (ages[k2] <= 0) return;
    ctx.save();
    ctx.globalAlpha = 1 - out;
    drawPlacedCrown(ctx, geo.x + (c % 5) * cs + cs / 2, geo.y + Math.floor(c / 5) * cs + cs / 2 - out * 30 * k, cs, ages[k2]);
    ctx.restore();
  });
  ctx.restore();
}

// ---------------------------------------------------------------------------------------------
// Scenes
// ---------------------------------------------------------------------------------------------
function drawTitle(ctx, state, manifest, palette, demoLimit, L) {
  const T = L.title, t = state.t, c = T.crown, k = c.r / 62;
  rays(ctx, c.x, c.y, c.r * 3.4, -t * 0.7, 0.2);
  drawCrown(ctx, c.x, c.y + Math.sin(t * 1.6) * 4 * k, c.r, { lift: (4 - Math.sin(t * 1.6) * 4) * k });
  const tw = (t * 0.8) % 1;
  star4(ctx, c.x + 58 * k, c.y - 45 * k, 20 * k * Math.sin(tw * Math.PI), Math.sin(tw * Math.PI));
  star4(ctx, c.x - 60 * k, c.y - 15 * k, 14 * k * Math.sin(((tw + 0.5) % 1) * Math.PI), Math.sin(((tw + 0.5) % 1) * Math.PI));
  const fo = Math.min(c.r * 4.8, T.titleMaxW / 2);
  flourish(ctx, c.x, c.y + 6 * k, Math.min(c.r * 1.77, fo - 40), fo);
  goldText(ctx, manifest.title.toUpperCase(), T.cx, T.titleY, T.titleSize, T.titleMaxW, 900);
  note(ctx, manifest.tagline ?? '', { x: T.cx - T.titleMaxW / 2, y: T.tagY - 22, w: T.titleMaxW, h: 56 }, 24, 'rgba(250,240,215,0.92)');

  if (T.hero) drawHero(ctx, state, palette, T.hero);

  const big = T.big;
  button(ctx, state, T.play7, 'Play 7 × 7', { primary: true, size: big ? 42 : 36, icon: 'crown' });
  button(ctx, state, T.expert, state.expertUnlocked ? 'Expert 10 × 10' : 'Expert 10 × 10 (locked)', { size: big ? 32 : 26, icon: big ? 'grid' : null, dim: !state.expertUnlocked });
  button(ctx, state, T.daily, 'Daily Puzzle', { size: big ? 32 : 26, icon: big ? 'calendar' : null });
  button(ctx, state, T.colour, 'Colours', { id: 'color', size: big ? 28 : 26 });
  button(ctx, state, T.rules, 'Rules', { id: 'rules', size: big ? 28 : 26 });
  button(ctx, state, T.auto, 'Auto Play — Watch & Learn', { id: 'auto', size: big ? 24 : 22 });

  const hintR = { x: T.footRow.x, y: T.hintY - 24, w: T.footRow.w, h: 30 };
  const hasPill = state.demo || state.totalSolved > 0;
  if (state.lockMessageTimer > 0) note(ctx, 'Solve 5 puzzles or buy the Expert Pack to unlock 10x10', hintR, 22, '#ffb3c0', 600);
  else if (!hasPill) note(ctx, T.wide && T.footRow.w < 460 ? 'Tap to rule out, tap again to crown.' : 'Tap a square to rule it out. Tap again to crown it.', hintR, 21, 'rgba(250,240,215,0.78)');
  // the themed ARCFORGE lockup directly under the last button (tap: Arcforge home), then the progress pill on the bottom line
  const lk = T.lockup;
  if (lockup && lockup.width) {
    ctx.save(); ctx.globalAlpha = lockPress > 0 ? 0.5 : 0.95;
    ctx.fillStyle = 'rgba(14,5,44,0.45)'; ctx.beginPath(); ctx.roundRect(lk.x - 10, lk.y - 4, lk.w + 20, lk.h + 8, 14); ctx.fill();
    ctx.drawImage(lockup, lk.x, lk.y, lk.w, lk.h); ctx.restore();
    if (lockPress > 0) lockPress--;
  }
  const fr = T.footRow;
  const str = state.demo ? `Free preview — ${demoLimit - state.demoSolves} puzzle(s) left` : state.totalSolved > 0 ? `Puzzles solved: ${state.totalSolved}` : '';
  if (str && !(state.lockMessageTimer > 0)) pill(ctx, fr, str);
}
export const pressLockup = () => { lockPress = 10; };
let lockPress = 0;

// A status pill right-aligned in `r`; the text shrinks to fit.
function pill(ctx, r, str) {
  let s = 22;
  const floor = minSize() * 0.85;
  ctx.font = `600 ${s}px ${UI}`;
  while (ctx.measureText(str).width + 40 > r.w && s > floor) { s -= 1; ctx.font = `600 ${s}px ${UI}`; }
  const w = Math.min(r.w, ctx.measureText(str).width + 40), h = Math.min(44, r.h);
  const x = r.x + (r.w - w) / 2, y = r.y + (r.h - h) / 2;
  ctx.fillStyle = 'rgba(14,5,44,0.7)';
  ctx.beginPath(); ctx.roundRect(x, y, w, h, h / 2); ctx.fill();
  ctx.strokeStyle = 'rgba(240,194,76,0.6)'; ctx.lineWidth = 1.5; ctx.stroke();
  text(ctx, str, x + w / 2, y + h / 2 + s * 0.35, s, 'rgba(250,240,215,0.92)', UI, 600);
}

function drawPlay(ctx, state, palette, L) {
  const { size } = state, P = L.play, B = P.board;
  const geo = { x: B.x, y: B.y, px: B.px, n: size };
  const isAuto = state.scene === 'auto';
  const A = isAuto ? state.auto : null;
  const solved = state.scene === 'solved' || (isAuto && A && A.sub === 'over');
  const placed = state.cells.reduce((k, c) => k + (c === 'crown' ? 1 : 0), 0);

  for (const r of P.panels) card(ctx, r);

  // header
  const mode = state.mode === 'daily' ? 'Daily Puzzle' : size >= 10 ? 'Expert' : 'Endless';
  const T = P.title;
  if (T.label) {
    if (!P.wide) flourish(ctx, T.x, T.label.y - 8, 190, 330);
    text(ctx, `${size} × ${size}`, T.x, T.label.y + 7, T.label.size, 'rgba(247,226,170,0.95)', DISPLAY, 700);
    goldText(ctx, mode.toUpperCase(), T.x, T.y, T.size, T.maxW, 800);
  } else goldText(ctx, `${mode.toUpperCase()}  ${size} × ${size}`, T.x, T.y, T.size, T.maxW, 800);
  P.chips.forEach((r, i) => {
    const kind = P.chipKinds[i];
    if (kind === 'time') chip(ctx, r, 'TIME', clock(solved ? state.solveTime : state.time));
    else if (kind === 'moves') chip(ctx, r, 'MOVES', String(solved ? state.solveMoves : state.moves));
    else chip(ctx, r, 'CROWNS', `${placed} / ${size}`);
  });

  // board (fixed surface: no settle-in scale)
  ctx.save();
  if (solved) rays(ctx, geo.x + geo.px / 2, geo.y + geo.px / 2, geo.px * 0.9, state.t, 0.2 * clamp01(state.sceneT));
  drawBoardBase(ctx, geo, state.regions, palette, state.palette);
  drawBoardMarks(ctx, state, geo);
  // Auto Play's REVEAL: a pulsing ring on the cell about to be crowned.
  if (isAuto && A && A.sub === 'reveal' && A.target >= 0) {
    const cs = geo.px / size, col = A.target % size, row = Math.floor(A.target / size);
    const cx = geo.x + col * cs + cs / 2, cy = geo.y + row * cs + cs / 2, pulse = 0.5 + 0.5 * Math.sin(state.t * 6);
    ctx.strokeStyle = `rgba(120,220,255,${0.7 + 0.3 * pulse})`;
    ctx.lineWidth = Math.max(4, cs * 0.08);
    ctx.beginPath(); ctx.roundRect(cx - cs / 2 + 4, cy - cs / 2 + 4, cs - 8, cs - 8, cs * 0.14); ctx.stroke();
  }
  ctx.restore();

  if (solved) { drawSolvedCard(ctx, state, L, geo, isAuto); return; }

  // crowns placed so far (tall portrait only: the other layouts show it as a chip)
  if (P.tally) {
    const tl = P.tally;
    text(ctx, `CROWNS  ${placed} / ${size}`, tl.cx, tl.labelY, 21, 'rgba(247,226,170,0.9)', DISPLAY, 700);
    const gap = Math.min(64, tl.maxW / size);
    for (let k = 0; k < size; k++) {
      const px = tl.cx + (k - (size - 1) / 2) * gap;
      if (k < placed) drawCrown(ctx, px, tl.rowY, gap * 0.3, {});
      else {
        ctx.fillStyle = 'rgba(14,5,44,0.6)';
        ctx.beginPath(); ctx.arc(px, tl.rowY + 4, gap * 0.2, 0, TAU); ctx.fill();
        ctx.strokeStyle = 'rgba(240,194,76,0.55)'; ctx.lineWidth = 2; ctx.stroke();
      }
    }
  }
  const sz = (r) => Math.min(36, r.h * 0.42);
  if (isAuto) {
    // Hint/Undo/Colours/Menu have no meaning in a spectator run: the same four slots become Exit/Pause/Skip/Think.
    const a = P.abtn;
    button(ctx, state, a.exit, 'Exit', { id: 'autoExit', size: sz(a.exit) });
    button(ctx, state, a.pause, A.paused ? 'Resume' : 'Pause', { id: 'autoPause', size: sz(a.pause) });
    button(ctx, state, a.skip, 'Skip', { id: 'autoSkip', size: sz(a.skip) });
    button(ctx, state, a.think, `Think ${AUTO_THINK_STEPS[state.autoThinkIdx]}s`, { id: 'autoThink', size: sz(a.think) });
    const label = A.paused ? 'Paused' : A.sub === 'think' ? 'Thinking...' : 'Revealing...';
    note(ctx, label, P.msg, 22, A.paused ? '#ffd08a' : 'rgba(120,220,255,0.95)', 600);
  } else {
    const b = P.btn;
    button(ctx, state, b.hint, 'Hint', { id: 'hint', size: sz(b.hint), icon: b.hint.w >= 150 ? 'bulb' : null });
    button(ctx, state, b.undo, 'Undo', { id: 'undo', size: sz(b.undo), icon: b.undo.w >= 150 ? 'undo' : null, dim: state.history.length === 0 });
    button(ctx, state, b.menu, 'Menu', { id: 'menu', size: sz(b.menu) });
    if (b.colour.w >= 300) button(ctx, state, b.colour, palette.name, { id: 'color', size: 27, extra: 150, after: swatches(palette, size) });
    else button(ctx, state, b.colour, 'Colours', { id: 'color', size: sz(b.colour) });
    const conflict = state.conflicts.length > 0;
    note(ctx, conflict ? 'Two crowns clash. Move one of the glowing crowns.' : 'One crown in every row, column and colour. None may touch.', P.msg, 22, conflict ? '#ffb3c0' : 'rgba(250,240,215,0.78)', conflict ? 600 : 500);
  }
}

// The finished-board card: crown, SOLVED, time and moves, "More from Arcforge" chips, and two buttons.
function drawSolvedCard(ctx, state, L, geo, isAuto) {
  const C = L.card, r = C.rect;
  if (C.overlay) {                                       // compact portrait: the card sits over the board, which dims behind it
    ctx.fillStyle = `rgba(8,3,26,${0.5 * clamp01(state.sceneT * 2)})`;
    ctx.fillRect(0, 0, W, H);
  }
  // gold sparks rising past the board
  for (let k = 0; k < 26; k++) {
    const ph = (state.sceneT * (0.22 + (k % 4) * 0.05) + k * 0.131) % 1;
    const x = geo.x + 30 + ((k * 149) % Math.max(60, geo.px - 60)) + Math.sin(state.sceneT * 2 + k) * 18;
    star4(ctx, x, geo.y + geo.px - ph * geo.px * 1.1, 7 + (k % 3) * 4, (1 - ph) * clamp01(state.sceneT * 2));
  }
  const f = easeOut(clamp01((state.sceneT - 0.25) / 0.55));
  ctx.save();
  ctx.globalAlpha = f;
  ctx.translate(0, (1 - f) * 70);
  panel(ctx, r.x, r.y, r.w, r.h);
  if (C.crown) drawCrown(ctx, C.crown.x, C.crown.y + Math.sin(state.t * 2) * 3, C.crown.r, {});
  goldText(ctx, 'SOLVED', r.x + r.w / 2, C.solvedY, C.solvedSize, r.w - 80, 900);
  if (r.w >= 420) {
    text(ctx, `Time ${clock(state.solveTime)}`, r.x + r.w * 0.3, C.statsY, 30, '#ffffff', UI, 700);
    text(ctx, `Moves ${state.solveMoves}`, r.x + r.w * 0.7, C.statsY, 30, '#ffffff', UI, 700);
  } else note(ctx, `Time ${clock(state.solveTime)}   Moves ${state.solveMoves}`, { x: r.x + 12, y: C.statsY - 24, w: r.w - 24, h: 34 }, 26, '#ffffff', 700);
  text(ctx, isAuto ? 'Watch & Learn' : state.hintsUsed ? `Hints used: ${state.hintsUsed}` : 'No hints used', r.x + r.w / 2, C.hintsY, 23, 'rgba(247,226,170,0.85)', UI, 500);
  // This free game's one natural advertising moment (paid games only, see SIBLINGS in layout.js).
  text(ctx, 'MORE FROM ARCFORGE', r.x + r.w / 2, C.moreY, 18, 'rgba(247,226,170,0.75)', DISPLAY, 700);
  SIBLINGS.forEach((g, i) => button(ctx, state, C.chips[i], g.title, { size: 20, id: `chip${i}` }));
  button(ctx, state, C.next, isAuto ? 'Play again' : state.demoLimitReached ? 'Continue' : 'Next puzzle', { id: 'next', size: 26, primary: true });
  button(ctx, state, C.menu, isAuto ? 'Exit' : 'Menu', { id: 'solvedMenu', size: 26 });
  ctx.restore();
}

function drawDemoLimit(ctx, state, L) {
  const r = L.demo.card, cx = r.x + r.w / 2;
  const f = easeOut(clamp01(state.sceneT / 0.5));
  ctx.save();
  ctx.globalAlpha = f;
  ctx.translate(0, (1 - f) * 60);
  rays(ctx, cx, r.y, 420, state.t, 0.18);
  panel(ctx, r.x, r.y, r.w, r.h);
  drawCrown(ctx, cx, r.y - 4 + Math.sin(state.t * 2) * 3, 64, {});
  goldText(ctx, "THAT'S THE FREE PREVIEW", cx, r.y + 160, 40, r.w - 80, 800);
  flourish(ctx, cx, r.y + 192, 120, Math.min(270, r.w / 2 - 20));
  note(ctx, 'Get the full game on iPhone and Android for unlimited puzzles, the Expert board and hints.', { x: r.x + 50, y: r.y + 230, w: r.w - 100, h: 200 }, 28, 'rgba(250,240,215,0.92)');
  ctx.restore();
}

// ---------------------------------------------------------------------------------------------
// Rules reference: ONE scrolling reader (drag, wheel, keys, scroll bar) with text zoom to 300%. Consecutive RULES entries with
// the same title (they were split into pages for the old paginated reader) are merged back into one section.
// Every illustration reuses this file's own board/crown/mark/button drawing, never a separate icon set. Pure: reads only the
// presentation clocks already on `state`, mutates nothing.
// ---------------------------------------------------------------------------------------------
export const rulesMetrics = { max: 0, view: 0 };
const SECTIONS = [];
for (const p of RULES) {
  const last = SECTIONS[SECTIONS.length - 1];
  if (last && last.title === p.title && !p.art) last.lines.push(...p.lines);
  else SECTIONS.push({ title: p.title, art: p.art, lines: [...p.lines] });
}
// Art blocks use the old 720-wide absolute coordinates: y0 = where the art starts, h = how tall the block is.
const ART = {
  board: { y0: 250, h: 500 }, win: { y0: 250, h: 580 }, touch: { y0: 312, h: 500 }, cycle: { y0: 350, h: 240 },
  autocross: { y0: 250, h: 500 }, conflict: { y0: 300, h: 550 }, hintundo: { y0: 440, h: 170 }, colours: { y0: 360, h: 220 },
  modes: { y0: 400, h: 160 }, generate: { y0: 270, h: 530 },
};

const flowCache = new Map();
function rulesFlow(ctx, scaleIdx, colW) {
  const key = `${scaleIdx}:${Math.round(colW)}`;
  let fl = flowCache.get(key);
  if (fl) return fl;
  const scale = TEXT_SCALES[scaleIdx] ?? 1;
  const tSize = Math.round(40 * Math.min(scale, 2)), bSize = Math.round(28 * scale), lh = Math.round(bSize * 1.34), pgap = Math.round(bSize * 0.7);
  const items = [];
  let y = 8;
  for (const sec of SECTIONS) {
    ctx.font = `800 ${tSize}px ${DISPLAY}`;
    const tl = wrapLines(ctx, sec.title, colW);
    const th = Math.round(tSize * 1.2);
    items.push({ kind: 'title', y: y + tSize, lines: tl, size: tSize, lh: th });
    y += tl.length * th + 14;
    if (sec.art && ART[sec.art]) {
      items.push({ kind: 'art', y, name: sec.art, h: ART[sec.art].h, y0: ART[sec.art].y0 });
      y += ART[sec.art].h + 10;
    }
    ctx.font = `500 ${bSize}px ${UI}`;
    sec.lines.forEach((para) => {
      const ls = wrapLines(ctx, para, colW);
      items.push({ kind: 'text', y: y + bSize, lines: ls, size: bSize, lh });
      y += ls.length * lh + pgap;
    });
    items.push({ kind: 'rule', y: y + 10 });
    y += 50;
  }
  fl = { items, height: y };
  if (flowCache.size > 12) flowCache.clear();
  flowCache.set(key, fl);
  return fl;
}

function drawRulesPage(ctx, state, manifest, palette, L) {
  const RL = L.rules, p = RL.panel, vp = RL.vp;
  const fl = rulesFlow(ctx, state.textScaleIdx, vp.w - 24);
  rulesMetrics.view = vp.h;
  rulesMetrics.max = fl.height - vp.h <= 8 ? 0 : Math.ceil(fl.height - vp.h);
  const scroll = Math.max(0, Math.min(state.rulesScroll || 0, rulesMetrics.max));

  // framed reader card
  ctx.save();
  ctx.beginPath(); ctx.roundRect(p.x, p.y, p.w, p.h, 28);
  const g = ctx.createLinearGradient(0, p.y, 0, p.y + p.h);
  g.addColorStop(0, 'rgba(32,18,78,0.6)'); g.addColorStop(1, 'rgba(11,6,30,0.76)');
  ctx.fillStyle = g; ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(247,205,85,0.32)'; ctx.stroke();
  ctx.restore();
  text(ctx, `${(manifest.title ?? 'CROWN FIELDS').toUpperCase()} — RULES`, p.x + p.w / 2, p.y + 36, 21, 'rgba(247,226,170,0.85)', DISPLAY, 700);
  flourish(ctx, p.x + p.w / 2, p.y + 52, 150, Math.min(330, p.w / 2 - 30));

  ctx.save();
  ctx.beginPath(); ctx.rect(vp.x, vp.y, vp.w, vp.h); ctx.clip();
  const cx = vp.x + vp.w / 2 - 12;
  for (const it of fl.items) {
    const top = it.y - scroll + vp.y, hgt = it.kind === 'art' ? it.h : it.kind === 'rule' ? 4 : it.lines.length * it.lh + it.size;
    if (top > vp.y + vp.h + 40 || top + hgt < vp.y - 40) continue;                         // off screen
    if (it.kind === 'title') {
      it.lines.forEach((ln, i) => goldText(ctx, ln, cx, vp.y + it.y - scroll + i * it.lh, it.size, vp.w - 24, 800));
    } else if (it.kind === 'art') {
      ctx.save();
      ctx.translate(cx - 360, vp.y + it.y - scroll - it.y0);
      drawRulesArt(ctx, it.name, state, palette);
      ctx.restore();
    } else if (it.kind === 'text') {
      ctx.font = `500 ${it.size}px ${UI}`; ctx.fillStyle = 'rgba(250,240,215,0.9)'; ctx.textAlign = 'center';
      it.lines.forEach((ln, i) => ctx.fillText(ln, cx, vp.y + it.y - scroll + i * it.lh));
    } else {
      flourish(ctx, cx, vp.y + it.y - scroll, 20, Math.min(220, vp.w / 2 - 40));
    }
  }
  ctx.restore();
  if (rulesMetrics.max > 0) {                                      // scroll bar
    const sb = RL.sb, th = Math.max(48, (sb.h * vp.h) / fl.height), ty = sb.y + (scroll / rulesMetrics.max) * (sb.h - th);
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.beginPath(); ctx.roundRect(sb.x, sb.y, sb.w, sb.h, sb.w / 2); ctx.fill();
    ctx.fillStyle = 'rgba(247,205,85,0.85)';
    ctx.beginPath(); ctx.roundRect(sb.x, ty, sb.w, th, sb.w / 2); ctx.fill();
  }
  button(ctx, state, RL.dec, 'A−', { id: 'textDec', size: 30, dim: state.textScaleIdx === 0 });
  button(ctx, state, RL.inc, 'A+', { id: 'textInc', size: 30, dim: state.textScaleIdx === TEXT_SCALES.length - 1 });
  button(ctx, state, RL.done, 'Done', { id: 'rulesDone', size: 32, primary: true });
}

export function render(ctx, state, manifest, demoLimit, view) {
  const L = layoutFor(view?.width ?? 720, view?.height ?? 1560);
  W = L.w; H = L.h;
  const palette = PALETTES[state.palette] ?? PALETTES[0];
  drawBackdrop(ctx, state, palette);
  if (state.scene === 'demo-limit') drawDemoLimit(ctx, state, L);
  else if (state.scene === 'title') drawTitle(ctx, state, manifest, palette, demoLimit, L);
  else if (state.scene === 'rules') drawRulesPage(ctx, state, manifest, palette, L);
  else drawPlay(ctx, state, palette, L);
  // eased fade between scenes
  const fade = 1 - clamp01(state.sceneT / 0.32);
  if (fade > 0 && state.scene !== 'solved') {
    ctx.fillStyle = `rgba(13,7,36,${fade * fade})`;
    ctx.fillRect(0, 0, W, H);
  }
}
