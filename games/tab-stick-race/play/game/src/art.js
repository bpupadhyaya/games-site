// Drawing helpers: themes, lit round pieces, the looped board, panels, flat buttons, icons.
// Plain canvas 2D, no images, nothing here changes game state.
import { COLS, ROWS, cellOf, isSafe } from './rules.js';

// The live virtual size (fluid viewport): the short side is 720 units, the long side follows the screen. `setSize` is called by the game each frame.
export let W = 720, H = 1560;
export function setSize(w, h) { W = Math.round(w); H = Math.round(h); }
export const UI = '-apple-system, "SF Pro Text", "Segoe UI", Roboto, "Geeza Pro", "Noto Sans Arabic", system-ui, sans-serif';
export const DISPLAY = '"Palatino Linotype", Palatino, "Iowan Old Style", Georgia, "Geeza Pro", "Noto Naskh Arabic", "Times New Roman", serif';

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
export const easeIO = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
export const backOut = (t) => { const c = 1.9; return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2; };

// ---------------------------------------------------------------------------------------------------- themes
// Each theme: page background, the carved board (sq: two sandstone-like tones, frame, inlay), the felt mat, the sticks and the
// two sides' stones (light = Ivory, dark = Clay), plus the UI colours.
export const THEMES = [
  {
    id: 'sand', name: 'Sand and Inlay', ar: 'رمل وترصيع',
    bg: ['#170f0a', '#33211a', '#1a110c'], glow: 'rgba(255,170,90,0.25)', fleck: '245,200,140',
    sq: ['#e3cc9a', '#d2b57c'], sqEdge: '#9b7a45', frame: ['#4a2c1a', '#2c180d'], frameHi: '#8a5a38', inlay: '#e0b44c', groove: 'rgba(120,84,40,0.5)', side: '#1d0f07',
    star: ['#2f9c97', '#e0b44c'], mark: ['#f4efe2', '#2f9c97'],
    felt: ['#1f5c4a', '#134034'], feltEdge: '#d8b45a', feltFleck: '120,190,160',
    stickFlat: '#f1e6c8', stickFlatLo: '#cdbd93', bark: ['#3b2012', '#8a5230'], notch: '#5a3a20',
    light: { base: '#efe3c8', hi: '#ffffff', lo: '#a99a76', rim: '#fff6df', glow: '255,244,200' },
    dark: { base: '#b4532a', hi: '#ffa77a', lo: '#4a1a08', rim: '#ffc9a8', glow: '255,140,90' },
    accent: '#f0c86a', ink: '#f8eedb', win: '#ffd877',
    panel: ['rgba(60,36,22,0.96)', 'rgba(32,19,11,0.98)'], stroke: 'rgba(240,200,110,0.55)',
    btn: ['#6a4630', '#4a2f20'], btnOn: ['#2d8f87', '#1c6560'], primary: ['#f2cd78', '#d9a443'], primaryInk: '#3a2410',
  },
  {
    id: 'lapis', name: 'Lapis Night', ar: 'ليل اللازورد',
    bg: ['#070b18', '#10193a', '#080d1e'], glow: 'rgba(110,150,255,0.24)', fleck: '200,215,255',
    sq: ['#34518f', '#2a4380'], sqEdge: '#162955', frame: ['#1b2240', '#0d1228'], frameHi: '#4b5c9a', inlay: '#ecc765', groove: 'rgba(220,230,255,0.28)', side: '#080b1a',
    star: ['#ecc765', '#f4efe2'], mark: ['#f4efe2', '#ecc765'],
    felt: ['#23306a', '#141c44'], feltEdge: '#ecc765', feltFleck: '170,190,255',
    stickFlat: '#f3ecd6', stickFlatLo: '#cfc7ac', bark: ['#2a1a10', '#7a4a2a'], notch: '#4a3320',
    light: { base: '#f3ead2', hi: '#ffffff', lo: '#b3a583', rim: '#fffaea', glow: '255,245,210' },
    dark: { base: '#c2602e', hi: '#ffb98a', lo: '#561e08', rim: '#ffd0aa', glow: '255,150,90' },
    accent: '#ecc765', ink: '#f5efe0', win: '#ffe7a8',
    panel: ['rgba(24,34,72,0.96)', 'rgba(12,18,44,0.98)'], stroke: 'rgba(236,199,101,0.5)',
    btn: ['#2c427e', '#1d2f5c'], btnOn: ['#b8782a', '#7f4f1a'], primary: ['#f0d080', '#d9aa4a'], primaryInk: '#2b1c08',
  },
  {
    id: 'palm', name: 'Date Palm', ar: 'نخيل',
    bg: ['#0c120a', '#1d2a16', '#0d140b'], glow: 'rgba(170,220,110,0.2)', fleck: '210,235,170',
    sq: ['#d8c58e', '#c3a964'], sqEdge: '#7d6a34', frame: ['#3d4a22', '#222c12'], frameHi: '#7c9048', inlay: '#e8cf7a', groove: 'rgba(80,90,30,0.45)', side: '#10170a',
    star: ['#a63a2a', '#e8cf7a'], mark: ['#f4efe2', '#a63a2a'],
    felt: ['#7b2a2a', '#4f1717'], feltEdge: '#e8cf7a', feltFleck: '220,150,140',
    stickFlat: '#f2e9cc', stickFlatLo: '#cfc196', bark: ['#34261a', '#835a34'], notch: '#5a4024',
    light: { base: '#f0e6cb', hi: '#ffffff', lo: '#a89a70', rim: '#fff6df', glow: '255,244,200' },
    dark: { base: '#5a7a34', hi: '#b5d68a', lo: '#1f3010', rim: '#cde8a8', glow: '170,230,110' },
    accent: '#e8cf7a', ink: '#f6f0dc', win: '#ffe58a',
    panel: ['rgba(40,52,24,0.96)', 'rgba(22,30,12,0.98)'], stroke: 'rgba(232,207,122,0.5)',
    btn: ['#4d5f2c', '#364420'], btnOn: ['#a63a2a', '#7a261a'], primary: ['#e8cf7a', '#c9a64a'], primaryInk: '#2b2408',
  },
];
export const themeById = (id) => THEMES.find((t) => t.id === id) ?? THEMES[0];

export function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }

const ARABIC_RE = /[\u0600-\u06FF]/;
export function text(ctx, str, x, y, size, color = '#fff', o = {}) {
  ctx.direction = ARABIC_RE.test(str) ? 'rtl' : 'ltr';
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

// The three full-screen gradients (sky, glow, vignette) never change, so they are painted once into an off-screen picture (1x, the
// gradients are smooth) and copied; only the drifting flecks are drawn live. Without an off-screen canvas everything is drawn live.
const BGS = new Map();
function paintBackdrop(ctx, th, glowY) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, th.bg[0]); g.addColorStop(0.5, th.bg[1]); g.addColorStop(1, th.bg[2]);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const hg = ctx.createRadialGradient(W / 2, glowY, 40, W / 2, glowY, 640);
  hg.addColorStop(0, th.glow); hg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = hg; ctx.fillRect(0, 0, W, H);
  const vr = Math.max(W, H) * 0.65;
  const vg = ctx.createRadialGradient(W / 2, H / 2, vr * 0.55, W / 2, H / 2, vr);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.5)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
}
export function background(ctx, th, t, glowY = 700) {
  let drawn = false;
  if (typeof OffscreenCanvas !== 'undefined') {
    const key = `${th.id}|${glowY}|${W}x${H}`;
    let cv = BGS.get(key);
    if (!cv) {
      cv = new OffscreenCanvas(W, H);
      const g = cv.getContext('2d');
      if (g) { paintBackdrop(g, th, glowY); BGS.set(key, cv); while (BGS.size > 3) BGS.delete(BGS.keys().next().value); } else cv = null;
    }
    if (cv) { ctx.drawImage(cv, 0, 0, W, H); drawn = true; }
  }
  if (!drawn) paintBackdrop(ctx, th, glowY);
  for (const [fx, fy, s, ph] of FLECKS) {
    const x = fx * W, yy = (fy * H + t * (3 + s * 3)) % H;
    const a = 0.06 + 0.12 * (0.5 + 0.5 * Math.sin(t * 0.7 + ph * 9));
    ctx.fillStyle = `rgba(${th.fleck},${a})`;
    ctx.fillRect(x, yy, 2.2 * s, 2.2 * s);
  }
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
  const col = kind === 'primary' ? th.primary : kind === 'on' ? th.btnOn : kind === 'danger' ? ['#c9503f', '#8e2b27'] : th.btn;
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
  } else if (name === 'eye') {
    ctx.beginPath(); ctx.moveTo(-r * 0.85, 0); ctx.quadraticCurveTo(0, -r * 0.8, r * 0.85, 0); ctx.quadraticCurveTo(0, r * 0.8, -r * 0.85, 0); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, r * 0.24, 0, Math.PI * 2); ctx.fill();
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
// A round, domed stone seen slightly from above, lit from the upper left. d = diameter.
// o: { scale, alpha, glow (0..1), lift (0..1), ghost, noShadow, ring (colour string) }
export function drawPiece(ctx, th, who, cx, cy, d, o = {}) {
  const col = who === 1 ? th.light : th.dark;
  const sc = (o.scale ?? 1) * (1 + 0.1 * (o.lift ?? 0));
  const a = o.alpha ?? 1;
  if (a <= 0.01 || sc <= 0.01) return;
  const R = (d / 2) * sc, depth = d * 0.1 * sc, lift = (o.lift ?? 0) * d * 0.2;
  const y = cy - lift;
  ctx.save();
  ctx.globalAlpha = a * (o.ghost ? 0.4 : 1);
  if (!o.noShadow) {
    ctx.fillStyle = 'rgba(0,0,0,0.34)';
    ctx.beginPath(); ctx.ellipse(cx + d * 0.04, cy + depth + d * 0.08 + lift * 0.5, R * 0.98, R * 0.62, 0, 0, Math.PI * 2); ctx.fill();
  }
  // side wall
  ctx.fillStyle = col.lo;
  ctx.beginPath(); ctx.arc(cx, y + depth, R, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = col.lo; ctx.fillRect(cx - R, y, R * 2, depth);
  // top face
  if (o.glow) { ctx.shadowColor = `rgba(${col.glow},${clamp01(o.glow)})`; ctx.shadowBlur = d * 0.5; }
  const g = ctx.createRadialGradient(cx - R * 0.35, y - R * 0.4, R * 0.1, cx, y, R * 1.05);
  g.addColorStop(0, col.hi); g.addColorStop(0.45, col.base); g.addColorStop(1, mix(col.base, col.lo, 0.8));
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(cx, y, R, 0, Math.PI * 2); ctx.fill();
  ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0;
  // rim and a shallow dish in the face
  ctx.strokeStyle = alpha(col.rim.length === 7 ? col.rim : '#ffffff', 0.55); ctx.lineWidth = Math.max(1.2, d * 0.03);
  ctx.beginPath(); ctx.arc(cx, y, R - d * 0.02, Math.PI * 0.95, Math.PI * 1.75); ctx.stroke();
  const dish = ctx.createLinearGradient(cx - R * 0.5, y - R * 0.5, cx + R * 0.5, y + R * 0.5);
  dish.addColorStop(0, 'rgba(0,0,0,0.20)'); dish.addColorStop(1, 'rgba(255,255,255,0.14)');
  ctx.fillStyle = dish;
  ctx.beginPath(); ctx.arc(cx, y, R * 0.6, 0, Math.PI * 2); ctx.fill();
  if (who === 1) { // pale shell: soft ridges
    ctx.strokeStyle = 'rgba(120,100,60,0.22)'; ctx.lineWidth = Math.max(1, d * 0.02);
    for (let k = 0; k < 7; k++) { const an = -Math.PI * 0.75 + k * (Math.PI * 1.5 / 6); ctx.beginPath(); ctx.moveTo(cx + Math.cos(an) * R * 0.2, y + Math.sin(an) * R * 0.2 + R * 0.1); ctx.lineTo(cx + Math.cos(an) * R * 0.58, y + Math.sin(an) * R * 0.58 + R * 0.1); ctx.stroke(); }
  }
  // specular
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.beginPath(); ctx.ellipse(cx - R * 0.38, y - R * 0.46, R * 0.2, R * 0.1, -0.7, 0, Math.PI * 2); ctx.fill();
  if (o.ring) { ctx.strokeStyle = o.ring; ctx.lineWidth = Math.max(3, d * 0.08); ctx.beginPath(); ctx.arc(cx, y, R + d * 0.1, 0, Math.PI * 2); ctx.stroke(); }
  ctx.restore();
}


// ---------------------------------------------------------------------------------------------------- static layer cache
// Big static pictures (the carved board, the felt) are painted once into an off-screen canvas at 2x and then copied each frame.
// Where no off-screen canvas exists (tests, headless Node) the picture is simply painted directly. Pure drawing: no game state.
const LAYERS = new Map();
function layer(ctx, key, x, y, w, h, paint) {
  if (typeof OffscreenCanvas === 'undefined') return false;
  let c = LAYERS.get(key);
  if (!c) {
    const pad = 44, cv = new OffscreenCanvas(Math.ceil((w + pad * 2) * 2), Math.ceil((h + pad * 2) * 2)), g = cv.getContext('2d');
    if (!g) return false;
    g.scale(2, 2); g.translate(pad - x, pad - y); g.textBaseline = 'alphabetic';
    paint(g);
    c = { cv, pad };
    LAYERS.set(key, c);
    if (LAYERS.size > 10) LAYERS.delete(LAYERS.keys().next().value);
  }
  ctx.drawImage(c.cv, 0, 0, c.cv.width, c.cv.height, x - c.pad, y - c.pad, w + c.pad * 2, h + c.pad * 2);
  return true;
}

// ---------------------------------------------------------------------------------------------------- the board
// A 4 x 7 board of sandstone squares in a carved frame. Square `sq` is a path index (rules.js). `flip` turns the board half a turn so
// that the human's own side is at the bottom when they play Clay.
export function boardGeo(x, y, w, flip = false) {
  const m = w * 0.04, s = (w - 2 * m) / COLS, h = ROWS * s + 2 * m;
  const sqXY = (sq) => {
    const { r, c } = cellOf(sq);
    return flip ? [x + m + (COLS - 1 - c + 0.5) * s, y + m + (r + 0.5) * s] : [x + m + (c + 0.5) * s, y + h - m - (r + 0.5) * s];
  };
  return { x, y, w, h, m, s, d: s * 0.78, flip, sqXY, u: s };
}

function star8(ctx, cx, cy, R, r, rot = 0) {
  ctx.beginPath();
  for (let i = 0; i < 16; i++) { const a = rot + (i * Math.PI) / 8 - Math.PI / 2, rad = i % 2 ? r : R; ctx.lineTo(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad); }
  ctx.closePath();
}

// Chevron (">" shaped arrow) pointing in direction `dir` (radians).
function chevron(ctx, cx, cy, size, dir, color, lw) {
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(dir); ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(-size * 0.35, -size * 0.5); ctx.lineTo(size * 0.35, 0); ctx.lineTo(-size * 0.35, size * 0.5); ctx.stroke(); ctx.restore();
}

export function drawBoard(ctx, th, geo, o = {}) {
  const key = `board|${th.id}|${geo.x}|${geo.y}|${geo.w}|${geo.flip ? 1 : 0}|${o.flat ? 1 : 0}`;
  if (!o.flat && layer(ctx, key, geo.x, geo.y, geo.w, geo.h, (g) => paintBoard(g, th, geo, o))) return;
  paintBoard(ctx, th, geo, o);
}
function paintBoard(ctx, th, geo, o = {}) {
  const { x, y, w, h, m, s } = geo;
  ctx.save();
  // frame
  if (!o.flat) { ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = w * 0.05; ctx.shadowOffsetY = w * 0.025; }
  ctx.fillStyle = th.side; rr(ctx, x, y + w * 0.016, w, h, w * 0.04); ctx.fill();
  ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
  const fg = ctx.createLinearGradient(x, y, x + w * 0.2, y + h);
  fg.addColorStop(0, th.frame[0]); fg.addColorStop(1, th.frame[1]);
  ctx.fillStyle = fg; rr(ctx, x, y, w, h, w * 0.04); ctx.fill();
  ctx.save(); rr(ctx, x, y, w, h, w * 0.04); ctx.clip();
  ctx.strokeStyle = th.frameHi; ctx.globalAlpha = 0.16; ctx.lineWidth = 1;
  for (let i = 0; i < 26; i++) { const yy = y + (i + 0.5) * (h / 26); ctx.beginPath(); ctx.moveTo(x, yy); ctx.bezierCurveTo(x + w * 0.3, yy + Math.sin(i * 1.3) * 3, x + w * 0.65, yy - Math.cos(i * 1.7) * 3, x + w, yy + Math.sin(i) * 2); ctx.stroke(); }
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = 1.5; rr(ctx, x + 2, y + 2, w - 4, h - 4, w * 0.04 - 2); ctx.stroke();
  // brass inlay line round the playing field
  ctx.strokeStyle = th.inlay; ctx.globalAlpha = 0.9; ctx.lineWidth = Math.max(1.5, w * 0.004);
  rr(ctx, x + m * 0.42, y + m * 0.42, w - m * 0.84, h - m * 0.84, 6); ctx.stroke(); ctx.globalAlpha = 1;
  // squares
  for (let sq = 0; sq < ROWS * COLS; sq++) {
    const [cx, cy] = geo.sqXY(sq), { r, c } = cellOf(sq);
    const k = (r + c) % 2;
    const g = ctx.createLinearGradient(cx - s / 2, cy - s / 2, cx + s / 2, cy + s / 2);
    g.addColorStop(0, th.sq[k]); g.addColorStop(1, mix(th.sq[k], '#000000', 0.12));
    ctx.fillStyle = g; rr(ctx, cx - s / 2 + 1, cy - s / 2 + 1, s - 2, s - 2, 5); ctx.fill();
    ctx.strokeStyle = th.sqEdge; ctx.lineWidth = 1.2; ctx.globalAlpha = 0.7; rr(ctx, cx - s / 2 + 1, cy - s / 2 + 1, s - 2, s - 2, 5); ctx.stroke(); ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.fillRect(cx - s / 2 + 4, cy - s / 2 + 2, s - 8, 1.5);
    // sandstone speckle (fixed pattern)
    ctx.fillStyle = 'rgba(90,60,20,0.16)';
    for (let q = 0; q < 6; q++) { const px = cx - s / 2 + ((sq * 37 + q * 53) % 83) / 83 * (s - 8) + 4, py = cy - s / 2 + ((sq * 91 + q * 29) % 79) / 79 * (s - 8) + 4; ctx.fillRect(px, py, 1.6, 1.6); }
  }
  // the path: a shallow carved groove through the middle of every square, snake by snake
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = th.groove; ctx.lineWidth = Math.max(2, s * 0.045); ctx.globalAlpha = 0.8;
  ctx.beginPath();
  for (let sq = 0; sq < ROWS * COLS; sq++) { const [cx, cy] = geo.sqXY(sq); if (sq === 0) ctx.moveTo(cx, cy); else ctx.lineTo(cx, cy); }
  ctx.stroke(); ctx.restore();
  // safe squares: an eight-point star, inlaid
  for (let sq = 0; sq < ROWS * COLS; sq++) {
    if (!isSafe(sq)) continue;
    const [cx, cy] = geo.sqXY(sq);
    ctx.fillStyle = th.star[0]; star8(ctx, cx, cy, s * 0.43, s * 0.2); ctx.fill();
    ctx.strokeStyle = th.star[1]; ctx.lineWidth = Math.max(1.5, s * 0.03); star8(ctx, cx, cy, s * 0.43, s * 0.2); ctx.stroke();
    ctx.fillStyle = th.star[1]; ctx.beginPath(); ctx.arc(cx, cy, s * 0.07, 0, Math.PI * 2); ctx.fill();
  }
  // entry chevrons: where each side's pieces come on (they run along the row)
  const dirRight = geo.flip ? Math.PI : 0;
  for (const [sq, side] of [[0, 0], [ROWS * COLS - 1, 1]]) {
    const [cx, cy] = geo.sqXY(sq), col = side === 0 ? th.light.base : th.dark.base;
    ctx.save(); ctx.globalAlpha = 0.95;
    chevron(ctx, cx - (geo.flip ? -s * 0.28 : s * 0.28), cy, s * 0.34, dirRight, side === 0 ? '#f8f0da' : mix(th.dark.base, '#000', 0.1), Math.max(3, s * 0.07));
    ctx.restore();
    void col;
  }
  // exits: a small arrow in the frame at the far end of each side's run
  const left = geo.flip ? x + w - m * 0.5 : x + m * 0.5;
  for (const [sq, side] of [[ROWS * COLS - 1, 0], [0, 1]]) {
    const [, cy] = geo.sqXY(sq);
    ctx.save(); ctx.fillStyle = side === 0 ? '#f4ead0' : th.dark.hi;
    const dir = geo.flip ? 1 : -1;
    ctx.beginPath(); ctx.moveTo(left + dir * m * 0.28, cy - m * 0.3); ctx.lineTo(left - dir * m * 0.28, cy); ctx.lineTo(left + dir * m * 0.28, cy + m * 0.3); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------------------------------- the felt mat and the sticks
export function drawFelt(ctx, th, r) {
  if (layer(ctx, `felt|${th.id}|${r.x}|${r.y}|${r.w}|${r.h}`, r.x, r.y, r.w, r.h, (g) => paintFelt(g, th, r))) return;
  paintFelt(ctx, th, r);
}
function paintFelt(ctx, th, r) {
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 8;
  const g = ctx.createRadialGradient(r.x + r.w / 2, r.y + r.h * 0.5, 30, r.x + r.w / 2, r.y + r.h * 0.5, r.w * 0.75);
  g.addColorStop(0, th.felt[0]); g.addColorStop(1, th.felt[1]);
  ctx.fillStyle = g; rr(ctx, r.x, r.y, r.w, r.h, 30); ctx.fill();
  ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
  ctx.save(); rr(ctx, r.x, r.y, r.w, r.h, 30); ctx.clip();
  // felt fibres: a fixed scatter of short strokes
  ctx.strokeStyle = `rgba(${th.feltFleck},0.10)`; ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i < 150; i++) {
    const px = r.x + ((i * 97) % 211) / 211 * r.w, py = r.y + ((i * 53) % 173) / 173 * r.h, a = ((i * 29) % 17) / 17 * Math.PI;
    ctx.moveTo(px, py); ctx.lineTo(px + Math.cos(a) * 7, py + Math.sin(a) * 7);
  }
  ctx.stroke();
  // a quiet embroidered star in the middle
  ctx.globalAlpha = 0.18; ctx.strokeStyle = th.feltEdge; ctx.lineWidth = 2;
  const cx = r.x + r.w / 2, cy = r.y + r.h / 2, R = Math.min(r.w, r.h) * 0.36;
  star8(ctx, cx, cy, R, R * 0.58); ctx.stroke(); star8(ctx, cx, cy, R * 0.62, R * 0.36, Math.PI / 8); ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy, R * 1.12, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
  // stitched border
  ctx.strokeStyle = th.feltEdge; ctx.globalAlpha = 0.7; ctx.lineWidth = 2.5; ctx.setLineDash([9, 7]);
  rr(ctx, r.x + 12, r.y + 12, r.w - 24, r.h - 24, 22); ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

// One throwing stick seen from above: a half-round rod (a split cane). Its cross-section is a half disc; `roll` turns it about its
// long axis, so the flat (carved) face and the round back come into view with the right foreshortening and shading.
// cx, cy: centre; L, Wd: length and width; yaw: turn on the felt; z: height above the felt (0..1.1) makes it a little larger.
const SEG = 12, STRIPS = 11;
export function drawStick(ctx, th, cx, cy, L, Wd, yaw, roll, z = 0) {
  const sc = 1 + 0.26 * z, R = Wd / 2;
  const c = Math.cos(roll), sn = Math.sin(roll);
  // boundary of the cross-section, each segment tagged flat / arc with its outward normal
  const pts = [];
  for (let k = 0; k <= SEG; k++) { const a = (k / SEG) * Math.PI; pts.push({ u: R * Math.cos(a), v: R * Math.sin(a), nu: Math.cos(a), nv: Math.sin(a), flat: false }); }
  const segs = [];
  const rot = (u, v) => [u * c - v * sn, u * sn + v * c];
  for (let k = 0; k < SEG; k++) {
    const a = pts[k], b = pts[k + 1], am = ((k + 0.5) / SEG) * Math.PI;
    const [au, av] = rot(a.u, a.v), [bu, bv] = rot(b.u, b.v), [nu, nv] = rot(Math.cos(am), Math.sin(am));
    segs.push({ au, av, bu, bv, nu, nv, flat: false });
  }
  { const [au, av] = rot(-R, 0), [bu, bv] = rot(R, 0), [nu, nv] = rot(0, -1); segs.push({ au, av, bu, bv, nu, nv, flat: true }); }
  let umin = Infinity, umax = -Infinity;
  for (const g of segs) { umin = Math.min(umin, g.au, g.bu); umax = Math.max(umax, g.au, g.bu); }
  const span = umax - umin;
  ctx.save();
  ctx.translate(cx, cy); ctx.rotate(yaw); ctx.scale(sc, sc);
  const hw = span / 2, mid = (umin + umax) / 2;
  // lighting from the upper left of the screen, expressed in the stick's own frame
  const lu = -0.5, lv = 0.8;           // the light is fixed in the stick's own frame, so a cached picture of the stick is exact
  const ln = Math.hypot(lu, lv), LU = lu / ln, LV = lv / ln;
  ctx.beginPath(); ctx.roundRect(mid - hw, -L / 2, span, L, [hw * 0.9, hw * 0.9, hw * 0.9, hw * 0.9]); ctx.save(); ctx.clip();
  const du = span / STRIPS;
  let fa = Infinity, fb = -Infinity;
  for (let i = 0; i < STRIPS; i++) {
    const uc = umin + (i + 0.5) * du;
    let top = -Infinity, face = null;
    for (const g of segs) {
      const lo = Math.min(g.au, g.bu), hi = Math.max(g.au, g.bu);
      if (uc < lo || uc > hi || hi - lo < 1e-6) continue;
      const tt = (uc - g.au) / (g.bu - g.au), v = g.av + (g.bv - g.av) * tt;
      if (v > top) { top = v; face = g; }
    }
    if (!face) continue;
    const lam = Math.max(0, face.nu * LU + face.nv * LV);
    let col;
    if (face.flat) { col = mix(th.stickFlatLo, th.stickFlat, 0.45 + 0.55 * lam); fa = Math.min(fa, uc - du / 2); fb = Math.max(fb, uc + du / 2); }
    else col = mix(th.bark[0], th.bark[1], 0.15 + 0.85 * lam);
    ctx.fillStyle = col; ctx.fillRect(uc - du / 2 - 0.4, -L / 2, du + 0.8, L);
  }
  // the carved face: three bands of notches, only where the flat face shows
  if (fb > fa && fb - fa > 5) {
    ctx.fillStyle = th.notch;
    for (const t of [-0.3, 0, 0.3]) { const yy = t * L; ctx.fillRect(fa + 1.5, yy - 3.5, fb - fa - 3, 2.2); ctx.fillRect(fa + 1.5, yy + 1.3, fb - fa - 3, 2.2); }
    ctx.fillStyle = th.notch; ctx.globalAlpha = 0.5; ctx.fillRect(fa + 1.5, -L / 2 + L * 0.06, fb - fa - 3, 1.6); ctx.fillRect(fa + 1.5, L / 2 - L * 0.06 - 1.6, fb - fa - 3, 1.6); ctx.globalAlpha = 1;
  } else {
    // bark: a few dark grain lines along the rod
    ctx.strokeStyle = 'rgba(20,8,0,0.35)'; ctx.lineWidth = 1.2;
    for (let q = 1; q < 4; q++) { const ux = mid - hw + (span * q) / 4; ctx.beginPath(); ctx.moveTo(ux, -L / 2); ctx.lineTo(ux + Math.sin(q) * 2, 0); ctx.lineTo(ux, L / 2); ctx.stroke(); }
  }
  // soft shading toward the ends (the rod is rounded there)
  const eg = ctx.createLinearGradient(0, -L / 2, 0, L / 2);
  eg.addColorStop(0, 'rgba(0,0,0,0.28)'); eg.addColorStop(0.08, 'rgba(0,0,0,0)'); eg.addColorStop(0.92, 'rgba(0,0,0,0)'); eg.addColorStop(1, 'rgba(0,0,0,0.3)');
  ctx.fillStyle = eg; ctx.fillRect(mid - hw, -L / 2, span, L);
  ctx.restore();
  ctx.strokeStyle = 'rgba(25,12,4,0.65)'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.roundRect(mid - hw, -L / 2, span, L, [hw * 0.9, hw * 0.9, hw * 0.9, hw * 0.9]); ctx.stroke();
  ctx.restore();
  return { span: span * sc, flat: fb > fa };
}

// ---- cached stick pictures --------------------------------------------------------------------------------------------------
// A stick costs about 40 canvas operations (strips, clip, gradient, notches). A throw draws four of them every frame, so each
// roll angle (72 steps; two neighbours are blended, so the turn stays smooth) is painted once into a small off-screen picture and
// drawn with a single image copy. The pictures are baked a few per frame in the background (`bakeSticks`); until a set is complete
// the live drawing is used, so nothing ever waits. Where no off-screen canvas exists (tests) the live drawing is always used.
const SPR_STEPS = 72, SPR_S = 1.5, SPR_PAD = 6, TAU_ = Math.PI * 2;
const SPRITES = new Map();
export const stickDims = (matH) => { const L = Math.min(250, matH * 0.64); return { L, Wd: L * 0.19 }; };
const sprKey = (th, L, Wd) => `${th.id}|${Math.round(L)}|${Math.round(Wd * 10)}`;
// Paints up to `n` missing pictures of the set for this theme and size. Returns how many are still missing.
export function bakeSticks(th, L, Wd, n = 6) {
  if (typeof OffscreenCanvas === 'undefined') return 0;
  const key = sprKey(th, L, Wd);
  let set = SPRITES.get(key);
  if (!set) {
    set = { list: new Array(SPR_STEPS).fill(null), done: 0, w: Wd + SPR_PAD * 2, h: L + SPR_PAD * 2 };
    SPRITES.set(key, set);
    while (SPRITES.size > 2) SPRITES.delete(SPRITES.keys().next().value);
  }
  for (let k = 0; k < SPR_STEPS && n > 0; k++) {
    if (set.list[k]) continue;
    const cv = new OffscreenCanvas(Math.ceil(set.w * SPR_S), Math.ceil(set.h * SPR_S)), g = cv.getContext('2d');
    if (!g) return SPR_STEPS - set.done;
    g.scale(SPR_S, SPR_S); g.translate(set.w / 2, set.h / 2);
    drawStick(g, th, 0, 0, L, Wd, 0, (k / SPR_STEPS) * TAU_, 0);
    set.list[k] = cv; set.done++; n--;
  }
  return SPR_STEPS - set.done;
}
export function drawStickCached(ctx, th, cx, cy, L, Wd, yaw, roll, z = 0) {
  const set = SPRITES.get(sprKey(th, L, Wd));
  if (!set || set.done < SPR_STEPS) { drawStick(ctx, th, cx, cy, L, Wd, yaw, roll, z); return; }
  const u = ((((roll / TAU_) % 1) + 1) % 1) * SPR_STEPS, k0 = Math.floor(u) % SPR_STEPS, f = u - Math.floor(u), k1 = (k0 + 1) % SPR_STEPS;
  const sc = 1 + 0.26 * z;
  ctx.save();
  ctx.translate(cx, cy); ctx.rotate(yaw); ctx.scale(sc, sc);
  ctx.drawImage(set.list[k0], -set.w / 2, -set.h / 2, set.w, set.h);
  if (f > 0.03) { ctx.globalAlpha = f; ctx.drawImage(set.list[k1], -set.w / 2, -set.h / 2, set.w, set.h); }
  ctx.restore();
}

// Shadow of a stick on the felt. The higher it is, the further it falls and the softer it gets.
export function drawStickShadow(ctx, cx, cy, L, Wd, yaw, z) {
  ctx.save();
  ctx.translate(cx + 16 * z + 3, cy + 26 * z + 5); ctx.rotate(yaw);
  const sc = 1 + 0.2 * z;
  ctx.fillStyle = `rgba(0,0,0,${0.3 - 0.12 * Math.min(1, z)})`;
  ctx.filter = 'none';
  ctx.beginPath(); ctx.roundRect(-Wd * sc * (0.5 + 0.2 * z), -L * sc / 2, Wd * sc * (1 + 0.4 * z), L * sc, Wd * 0.5); ctx.fill();
  ctx.restore();
}

// A puff of felt fibre / dust where a stick lands (local, short).
export function drawDust(ctx, parts) {
  for (const q of parts) {
    if (q.shape !== 'dust') continue;
    const a = clamp01(q.life / q.max);
    const g = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, q.size);
    g.addColorStop(0, `rgba(235,225,200,${0.34 * a})`); g.addColorStop(1, 'rgba(235,225,200,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(q.x, q.y, q.size, 0, Math.PI * 2); ctx.fill();
  }
}
