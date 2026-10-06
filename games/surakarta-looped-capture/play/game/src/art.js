// Drawing helpers: themes, lit round pieces, the looped board, panels, flat buttons, icons.
// Plain canvas 2D, no images, nothing here changes game state.
import { routePoints } from './rules.js';

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
export const easeIO = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
export const backOut = (t) => { const c = 1.9; return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2; };

// ---------------------------------------------------------------------------------------------------- themes
// slab: board face (top, bottom); outer / inner: the two circuit colours; light / dark: the two sides' pieces.
export const THEMES = [
  {
    id: 'teak', name: 'Carved Teak', kind: 'teak',
    bg: ['#150d08', '#2c1a10', '#170e08'], glow: 'rgba(255,160,80,0.26)', fleck: '240,190,120',
    slab: ['#c88a4e', '#9a6234'], edge: '#5c3416', side: '#3c2008', grain: 'rgba(70,34,8,0.30)',
    pit: '#4a2810', pitHi: 'rgba(255,225,180,0.55)', gridCol: 'rgba(60,30,8,0.55)', band: 'rgba(52,26,6,0.62)',
    outer: { line: '#e7b54e', glow: '255,196,90', ch: '#3a1c08' }, inner: { line: '#4fc6ae', glow: '110,240,210', ch: '#3a1c08' },
    light: { base: '#efe3c8', hi: '#ffffff', lo: '#a99a76', rim: '#fff6df', glow: '255,244,200' },
    dark: { base: '#a3282a', hi: '#ff8f84', lo: '#3f0a0c', rim: '#ffb4a6', glow: '255,110,100' },
    accent: '#f0c86a', ink: '#f8eedb', win: '#ffd877',
    panel: ['rgba(52,30,18,0.96)', 'rgba(30,17,10,0.98)'], stroke: 'rgba(240,200,110,0.55)',
    btn: ['#5c3d27', '#42291a'], btnOn: ['#2f8f7c', '#1e6556'], primary: ['#f2cd78', '#d9a443'], primaryInk: '#3a2410',
  },
  {
    id: 'batik', name: 'Batik Indigo', kind: 'batik',
    bg: ['#080d1a', '#121c3a', '#0a1020'], glow: 'rgba(110,150,255,0.24)', fleck: '200,215,255',
    slab: ['#243a78', '#162556'], edge: '#0d1636', side: '#080e24', grain: 'rgba(240,226,190,0.30)',
    pit: '#0b1230', pitHi: 'rgba(210,225,255,0.5)', gridCol: 'rgba(235,222,190,0.30)', band: 'rgba(240,226,190,0.55)',
    outer: { line: '#f0b97a', glow: '255,185,120', ch: '#0b1230' }, inner: { line: '#e9e1c8', glow: '235,235,220', ch: '#0b1230' },
    light: { base: '#f3ead2', hi: '#ffffff', lo: '#b3a583', rim: '#fffaea', glow: '255,245,210' },
    dark: { base: '#c2602e', hi: '#ffb98a', lo: '#561e08', rim: '#ffd0aa', glow: '255,150,90' },
    accent: '#f0c58a', ink: '#f5efe0', win: '#ffe7a8',
    panel: ['rgba(20,32,70,0.96)', 'rgba(10,18,44,0.98)'], stroke: 'rgba(240,200,140,0.5)',
    btn: ['#26407f', '#192c5c'], btnOn: ['#b45a2a', '#80391a'], primary: ['#f2c98a', '#d89f58'], primaryInk: '#2b1608',
  },
  {
    id: 'lacquer', name: 'Night Lacquer', kind: 'lacquer',
    bg: ['#060608', '#14121c', '#08080c'], glow: 'rgba(210,150,255,0.22)', fleck: '220,190,255',
    slab: ['#26232e', '#14121a'], edge: '#575066', side: '#07060a', grain: 'rgba(200,170,255,0.12)',
    pit: '#07060b', pitHi: 'rgba(190,170,255,0.45)', gridCol: 'rgba(200,185,240,0.22)', band: 'rgba(210,190,255,0.40)',
    outer: { line: '#ffcc66', glow: '255,205,110', ch: '#07060b' }, inner: { line: '#66e0ff', glow: '110,225,255', ch: '#07060b' },
    light: { base: '#d9e8e6', hi: '#ffffff', lo: '#7f9c9a', rim: '#f0ffff', glow: '190,255,250' },
    dark: { base: '#8a3fc4', hi: '#e2b0ff', lo: '#2a0c46', rim: '#e9c4ff', glow: '200,130,255' },
    accent: '#c9a8ff', ink: '#f1ecfb', win: '#fff0a8',
    panel: ['rgba(32,28,44,0.96)', 'rgba(16,14,24,0.98)'], stroke: 'rgba(200,170,255,0.5)',
    btn: ['#3a3452', '#282438'], btnOn: ['#2a8aa8', '#1b5d73'], primary: ['#c9a8ff', '#9a74e0'], primaryInk: '#170a2e',
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
const FLECKS = Array.from({ length: 40 }, (_, i) => [((i * 97) % 211) / 211, ((i * 53) % 173) / 173, 0.6 + ((i * 31) % 7) / 7, ((i * 13) % 11) / 11]);

// Full-screen backdrop for any live size (w, h in virtual units).
export function background(ctx, th, t, glowY = 700, w = W, h = H, glowX = w / 2) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, th.bg[0]); g.addColorStop(0.5, th.bg[1]); g.addColorStop(1, th.bg[2]);
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  const hg = ctx.createRadialGradient(glowX, glowY, 40, glowX, glowY, Math.max(640, w * 0.5));
  hg.addColorStop(0, th.glow); hg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = hg; ctx.fillRect(0, 0, w, h);
  const n = Math.round(30 * Math.max(1, (w * h) / (W * H)) ** 0.5);
  for (let i = 0; i < Math.min(n, FLECKS.length); i++) {
    const [fx, fy, s, ph] = FLECKS[i];
    const yy = (fy * h + t * (3 + s * 3)) % h;
    const a = 0.06 + 0.12 * (0.5 + 0.5 * Math.sin(t * 0.7 + ph * 9));
    ctx.fillStyle = `rgba(${th.fleck},${a})`;
    ctx.fillRect(fx * w, yy, 2.2 * s, 2.2 * s);
  }
  const r1 = Math.max(w, h) * 0.65;
  const vg = ctx.createRadialGradient(w / 2, h / 2, r1 * 0.55, w / 2, h / 2, r1);
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

// ---------------------------------------------------------------------------------------------------- the board
// The board is drawn in a square slab. The 6x6 grid sits in the middle; the corner loops swing out up to 2 units, so the
// slab spans 10 units: grid point (c, r) is at (x + (c + 2.5) u, y + (r + 2.5) u). `flip` turns the board half a turn
// (the board is symmetric, so this just puts the other side at the bottom).
export function boardGeo(x, y, side, flip = false) {
  const u = side / 10;
  const pt = (c, r) => (flip ? [x + (7.5 - c) * u, y + (7.5 - r) * u] : [x + (c + 2.5) * u, y + (r + 2.5) * u]);
  return { x, y, side, u, flip, pt, d: u * 0.74 };
}
export const pointXY = (geo, i) => geo.pt(i % 6, Math.floor(i / 6));

// The four loop arcs of a circuit of radius k: [cornerX, cornerY, startAngle], each sweeping 270 degrees outside the board.
const CORNERS = [[0, 0, Math.PI / 2], [5, 0, Math.PI], [0, 5, 0], [5, 5, Math.PI * 1.5]];

export function tracePath(ctx, geo, k) {
  const P = geo.pt;
  const line = (c0, r0, c1, r1) => { const a = P(c0, r0), b = P(c1, r1); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); };
  line(0, k, 5, k); line(0, 5 - k, 5, 5 - k); line(k, 0, k, 5); line(5 - k, 0, 5 - k, 5);
  for (const [cx, cy, a0] of CORNERS) {
    const c = P(cx, cy), r = k * geo.u;
    // flipping the board turns every angle by half a turn
    const s = geo.flip ? a0 + Math.PI : a0;
    ctx.moveTo(c[0] + r * Math.cos(s), c[1] + r * Math.sin(s));
    ctx.arc(c[0], c[1], r, s, s + Math.PI * 1.5);
  }
}

function kawung(ctx, cx, cy, s, col) {
  ctx.strokeStyle = col; ctx.lineWidth = Math.max(1, s * 0.07);
  for (let i = 0; i < 4; i++) {
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(i * Math.PI / 2 + Math.PI / 4);
    ctx.beginPath(); ctx.ellipse(s * 0.28, 0, s * 0.28, s * 0.14, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
  }
  ctx.fillStyle = col; ctx.beginPath(); ctx.arc(cx, cy, s * 0.06, 0, Math.PI * 2); ctx.fill();
}

function drawBand(ctx, th, x, y, side, u) {
  // an engraved band of four-petal motifs (a batik-style pattern) along the slab edge
  const m = u * 0.34, n = 20, step = (side - 2 * m) / n;
  ctx.save();
  ctx.strokeStyle = th.band; ctx.lineWidth = 1.4;
  rr(ctx, x + m * 0.45, y + m * 0.45, side - m * 0.9, side - m * 0.9, u * 0.3); ctx.stroke();
  rr(ctx, x + m * 1.55, y + m * 1.55, side - m * 3.1, side - m * 3.1, u * 0.2); ctx.stroke();
  for (let i = 0; i <= n; i++) {
    const t = m + i * step;
    const s = u * 0.24;
    kawung(ctx, x + t, y + m, s, th.band); kawung(ctx, x + t, y + side - m, s, th.band);
    if (i > 0 && i < n) { kawung(ctx, x + m, y + t, s, th.band); kawung(ctx, x + side - m, y + t, s, th.band); }
  }
  ctx.restore();
}

export function drawSlab(ctx, th, x, y, side, o = {}) {
  const r = side * 0.05, thick = o.thick ?? side * 0.035, u = side / 10;
  ctx.save();
  if (!o.flat) { ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = side * 0.05; ctx.shadowOffsetY = thick * 1.6; }
  ctx.fillStyle = th.side; rr(ctx, x, y + thick, side, side, r); ctx.fill();
  ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
  const g = ctx.createLinearGradient(x, y, x + side * 0.3, y + side);
  g.addColorStop(0, th.slab[0]); g.addColorStop(1, th.slab[1]);
  ctx.fillStyle = g; rr(ctx, x, y, side, side, r); ctx.fill();
  ctx.save();
  rr(ctx, x, y, side, side, r); ctx.clip();
  if (th.kind === 'teak') {
    ctx.strokeStyle = th.grain;
    for (let i = 0; i < 44; i++) {
      const yy = y + (i + 0.5) * (side / 44);
      ctx.lineWidth = 0.8 + (i % 4 === 0 ? 1.4 : 0) + (i % 7 === 0 ? 0.8 : 0);
      ctx.beginPath(); ctx.moveTo(x, yy);
      ctx.bezierCurveTo(x + side * 0.3, yy + Math.sin(i * 1.3) * 7, x + side * 0.65, yy - Math.cos(i * 1.7) * 9, x + side, yy + Math.sin(i * 0.6) * 6);
      ctx.stroke();
    }
  } else if (th.kind === 'batik') {
    // wax-resist dots (a dotted lattice) on indigo cloth
    ctx.fillStyle = th.grain;
    const sp = u * 0.5;
    for (let j = 0; j * sp < side; j++) for (let i = 0; i * sp < side; i++) {
      const px = x + i * sp + (j % 2 ? sp / 2 : 0), py = y + j * sp;
      ctx.beginPath(); ctx.arc(px, py, Math.max(0.9, u * 0.022), 0, Math.PI * 2); ctx.fill();
    }
  } else {
    const sg = ctx.createLinearGradient(x, y, x + side, y + side);
    sg.addColorStop(0, 'rgba(210,180,255,0.20)'); sg.addColorStop(0.45, 'rgba(210,180,255,0)'); sg.addColorStop(1, 'rgba(160,110,255,0.10)');
    ctx.fillStyle = sg; ctx.fillRect(x, y, side, side);
    ctx.fillStyle = th.grain;
    for (let i = 0; i < 60; i++) { const px = x + ((i * 97) % 101) / 101 * side, py = y + ((i * 53) % 89) / 89 * side; ctx.beginPath(); ctx.arc(px, py, 1.1 + (i % 3) * 0.5, 0, Math.PI * 2); ctx.fill(); }
  }
  if (side >= 220 && o.band !== false) drawBand(ctx, th, x, y, side, u);
  const bg = ctx.createLinearGradient(0, y, 0, y + side);
  bg.addColorStop(0, 'rgba(255,255,255,0.30)'); bg.addColorStop(0.1, 'rgba(255,255,255,0)'); bg.addColorStop(0.9, 'rgba(0,0,0,0)'); bg.addColorStop(1, 'rgba(0,0,0,0.25)');
  ctx.fillStyle = bg; ctx.fillRect(x, y, side, side);
  ctx.restore();
  ctx.strokeStyle = th.edge; ctx.lineWidth = 2; rr(ctx, x, y, side, side, r); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.26)'; ctx.lineWidth = 1.5; rr(ctx, x + 3, y + 3, side - 6, side - 6, r - 2); ctx.stroke();
  ctx.restore();
}

// The carved circuits: each is a dark channel with a lighter lip and a thin inlay of its colour. `dim` fades the inlay.
function groovePath(ctx, th, geo, k, w) {
  const c = k === 1 ? th.outer : th.inner;
  ctx.save();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); tracePath(ctx, geo, k);
  ctx.save(); ctx.translate(0, w * 0.45); ctx.strokeStyle = th.pitHi; ctx.globalAlpha = 0.55; ctx.lineWidth = w * 1.05; ctx.stroke(); ctx.restore();
  ctx.strokeStyle = c.ch; ctx.lineWidth = w * 1.25; ctx.stroke();
  ctx.strokeStyle = c.line; ctx.lineWidth = w * 0.5; ctx.globalAlpha = 0.95; ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = w * 0.12; ctx.save(); ctx.translate(0, -w * 0.12); ctx.stroke(); ctx.restore();
  ctx.restore();
}

export function drawBoard(ctx, th, geo, o = {}) {
  const { x, y, side, u } = geo;
  drawSlab(ctx, th, x, y, side, o);
  ctx.save();
  // thin grid: the 6x6 lines
  ctx.strokeStyle = th.gridCol; ctx.lineWidth = Math.max(1, u * 0.025);
  ctx.beginPath();
  for (let k = 0; k < 6; k++) { const a = geo.pt(0, k), b = geo.pt(5, k), c = geo.pt(k, 0), d = geo.pt(k, 5); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.moveTo(c[0], c[1]); ctx.lineTo(d[0], d[1]); }
  ctx.stroke();
  const w = Math.max(3.5, u * 0.15);
  groovePath(ctx, th, geo, 2, w);
  groovePath(ctx, th, geo, 1, w);
  // points: small carved pits
  for (let i = 0; i < 36; i++) {
    const [px, py] = pointXY(geo, i), r = u * 0.12;
    ctx.fillStyle = th.pit; ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = th.pitHi; ctx.globalAlpha = 0.6; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(px, py + 1, r, 0.2, Math.PI - 0.2); ctx.stroke(); ctx.globalAlpha = 1;
  }
  ctx.restore();
}

// A glowing trail along a route (list of nodes from rules.captureRoute). `from`..`to` are fractions of its length (0..1).
export function routeGeom(route, geo) {
  const pts = routePoints(route).map((p) => geo.pt(p.x, p.y));
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  return { pts, cum, len: cum[cum.length - 1] || 1 };
}
export function pointAlong(rg, s) {
  const t = Math.max(0, Math.min(rg.len, s));
  let i = 1;
  while (i < rg.cum.length - 1 && rg.cum[i] < t) i++;
  const a = rg.pts[i - 1], b = rg.pts[i], seg = rg.cum[i] - rg.cum[i - 1] || 1, f = (t - rg.cum[i - 1]) / seg;
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
}
export function strokeRoute(ctx, rg, s0, s1, color, glowRgb, w, a = 1) {
  if (s1 <= s0) return;
  ctx.save();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.globalAlpha = a;
  const trace = () => {
    ctx.beginPath();
    const p0 = pointAlong(rg, s0); ctx.moveTo(p0[0], p0[1]);
    for (let i = 1; i < rg.pts.length; i++) {
      if (rg.cum[i] <= s0) continue;
      if (rg.cum[i] >= s1) break;
      ctx.lineTo(rg.pts[i][0], rg.pts[i][1]);
    }
    const p1 = pointAlong(rg, s1); ctx.lineTo(p1[0], p1[1]);
  };
  ctx.shadowColor = `rgba(${glowRgb},0.95)`; ctx.shadowBlur = w * 3;
  trace(); ctx.strokeStyle = `rgba(${glowRgb},0.45)`; ctx.lineWidth = w * 1.8; ctx.stroke();
  ctx.shadowBlur = w; trace(); ctx.strokeStyle = color; ctx.lineWidth = w * 0.55; ctx.stroke();
  ctx.restore();
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
