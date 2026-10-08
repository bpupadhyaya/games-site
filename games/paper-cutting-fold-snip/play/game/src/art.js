// UI drawing helpers: the lantern-lit desk, the cream cutting mat, flat clean buttons (no inner gloss), panels, icons, stars, paper confetti.
// Palette: deep ink-brown desk with a warm lantern glow, cream rice-paper cards, vermilion and gold accents, jade for "done".
import { unitShape, SHAPES } from './shapes.js';

export const UI = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
export const DISPLAY = '"Songti SC", "Noto Serif SC", "Hiragino Mincho ProN", Georgia, "Times New Roman", serif';
export const INK = '#2b1b18';
export const INK2 = 'rgba(43,27,24,0.74)';
export const INK3 = 'rgba(43,27,24,0.5)';
export const CARD = '#f9f1e0';
export const CARD2 = '#efe2c8';
export const EDGE = '#d8bf93';
export const VERM = '#c8261c';
export const VERM_D = '#9c1a14';
export const DARK = '#3a2420';
export const GOLD = '#d6a13a';
export const MOSS = '#2f7d63';
export const CREAM_TEXT = '#f6e9cf';

export const clamp01 = (v) => Math.max(0, Math.min(1, v));
export const ease = (t) => 1 - (1 - t) ** 3;
export const easeIO = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
export const backOut = (t) => { const c = 1.7; return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2; };

export function rr(ctx, x, y, w, h, r) {
  const k = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + k, y); ctx.lineTo(x + w - k, y); ctx.arcTo(x + w, y, x + w, y + k, k);
  ctx.lineTo(x + w, y + h - k); ctx.arcTo(x + w, y + h, x + w - k, y + h, k);
  ctx.lineTo(x + k, y + h); ctx.arcTo(x, y + h, x, y + h - k, k);
  ctx.lineTo(x, y + k); ctx.arcTo(x, y, x + k, y, k);
  ctx.closePath();
}

export function text(ctx, str, x, y, size, color, o = {}) {
  ctx.font = `${o.weight ?? 600} ${size}px ${o.font ?? UI}`;
  ctx.textAlign = o.align ?? 'center';
  ctx.textBaseline = 'alphabetic';
  if (o.shadow) { ctx.save(); ctx.fillStyle = o.shadow; ctx.fillText(str, x, y + (o.sy ?? 2)); ctx.restore(); }
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
}

// ---- the desk ------------------------------------------------------------------------------------------------------------------------
let latticeTile = null, latticeTried = false;
function lattice() {
  if (latticeTried) return latticeTile;
  latticeTried = true;
  if (typeof OffscreenCanvas === 'undefined') return null;
  // a window lattice: a grid of thin cream lines with small squares in the cells
  const c = new OffscreenCanvas(120, 120), g = c.getContext('2d');
  g.strokeStyle = 'rgba(255,220,170,0.05)'; g.lineWidth = 2;
  for (let i = 0; i <= 120; i += 60) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 120); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(120, i); g.stroke(); }
  g.strokeStyle = 'rgba(255,220,170,0.035)';
  g.strokeRect(14, 14, 32, 32); g.strokeRect(74, 74, 32, 32); g.strokeRect(74, 14, 32, 32); g.strokeRect(14, 74, 32, 32);
  latticeTile = c;
  return latticeTile;
}

// The desk: ink-brown lacquer lit by a lantern. `lx, ly` = where the glow falls.
export function desk(ctx, w, h, t = 0, lx = 0.5, ly = 0.2) {
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, '#2a1715'); g.addColorStop(1, '#170d0e');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  const tl = lattice();
  if (tl) { const p = ctx.createPattern(tl, 'repeat'); if (p) { ctx.fillStyle = p; ctx.fillRect(0, 0, w, h); } }
  const r = Math.max(w, h), pulse = 0.92 + 0.08 * Math.sin(t * 0.9);
  const lg = ctx.createRadialGradient(w * lx, h * ly, r * 0.02, w * lx, h * ly, r * 0.78 * pulse);
  lg.addColorStop(0, 'rgba(255,150,70,0.34)'); lg.addColorStop(0.45, 'rgba(210,70,40,0.14)'); lg.addColorStop(1, 'rgba(210,70,40,0)');
  ctx.fillStyle = lg; ctx.fillRect(0, 0, w, h);
  const vg = ctx.createRadialGradient(w / 2, h / 2, r * 0.3, w / 2, h / 2, r * 0.85);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.45)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, w, h);
}

let matTile = null, matTried = false;
function matNoise() {
  if (matTried) return matTile;
  matTried = true;
  if (typeof OffscreenCanvas === 'undefined') return null;
  const c = new OffscreenCanvas(128, 128), g = c.getContext('2d');
  for (let i = 0; i < 520; i++) {
    const x = (i * 73) % 128, y = (i * 41 + ((i * 7) % 13) * 5) % 128, l = 3 + (i % 9);
    g.strokeStyle = i % 2 ? 'rgba(120,90,50,0.05)' : 'rgba(255,255,255,0.07)'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + l, y + ((i % 5) - 2)); g.stroke();
  }
  matTile = c;
  return matTile;
}

// The cutting mat the paper lies on: a rounded card in the paper's mat colour, with fibre grain, ruler ticks and a soft edge.
export function mat(ctx, r, color, o = {}) {
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 8;
  ctx.fillStyle = color; rr(ctx, r.x, r.y, r.w, r.h, 26); ctx.fill();
  ctx.restore();
  ctx.save(); rr(ctx, r.x, r.y, r.w, r.h, 26); ctx.clip();
  const tl = matNoise();
  if (tl) { const p = ctx.createPattern(tl, 'repeat'); if (p) { ctx.fillStyle = p; ctx.fillRect(r.x, r.y, r.w, r.h); } }
  const g = ctx.createRadialGradient(r.x + r.w * 0.5, r.y + r.h * 0.4, Math.min(r.w, r.h) * 0.2, r.x + r.w * 0.5, r.y + r.h * 0.5, Math.max(r.w, r.h) * 0.75);
  g.addColorStop(0, 'rgba(255,255,255,0.1)'); g.addColorStop(1, 'rgba(60,30,10,0.16)');
  ctx.fillStyle = g; ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.strokeStyle = o.dark ? 'rgba(255,230,190,0.16)' : 'rgba(110,60,30,0.16)'; ctx.lineWidth = 1.5;
  for (let i = 1; i < 24; i++) { const x = r.x + (r.w * i) / 24, len = i % 4 === 0 ? 14 : 7; ctx.beginPath(); ctx.moveTo(x, r.y + 8); ctx.lineTo(x, r.y + 8 + len); ctx.stroke(); }
  for (let i = 1; i < 32; i++) { const y = r.y + (r.h * i) / 32, len = i % 4 === 0 ? 14 : 7; ctx.beginPath(); ctx.moveTo(r.x + 8, y); ctx.lineTo(r.x + 8 + len, y); ctx.stroke(); }
  ctx.restore();
  ctx.strokeStyle = o.dark ? 'rgba(255,230,190,0.25)' : 'rgba(120,70,30,0.3)'; ctx.lineWidth = 2; rr(ctx, r.x, r.y, r.w, r.h, 26); ctx.stroke();
}

export function panel(ctx, x, y, w, h, o = {}) {
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = o.blur ?? 24; ctx.shadowOffsetY = o.dy ?? 8;
  ctx.fillStyle = o.fill ?? CARD; rr(ctx, x, y, w, h, o.r ?? 26); ctx.fill();
  ctx.restore();
  ctx.strokeStyle = o.edge ?? EDGE; ctx.lineWidth = 2; rr(ctx, x, y, w, h, o.r ?? 26); ctx.stroke();
}

const KINDS = {
  normal: { fill: CARD, edge: EDGE, ink: INK, shade: '#bfa579' },
  primary: { fill: VERM, edge: VERM_D, ink: '#fff4e4', shade: VERM_D },
  on: { fill: DARK, edge: '#1d100e', ink: '#f6e9cf', shade: '#1d100e' },
  gold: { fill: GOLD, edge: '#a97b22', ink: '#2b1b18', shade: '#a97b22' },
  danger: { fill: '#f6ddd2', edge: '#c47a68', ink: '#8e2f1d', shade: '#c47a68' },
  quiet: { fill: 'rgba(249,241,224,0.6)', edge: 'rgba(216,191,147,0.7)', ink: INK, shade: 'rgba(150,120,80,0.5)' },
};

// A flat button: solid fill, 2px edge, a solid drop edge underneath (no gloss shape).
export function button(ctx, r, lines, kind = 'normal', o = {}) {
  const k = KINDS[kind] ?? KINDS.normal;
  const down = o.pressed ? 3 : 0, dis = o.disabled;
  ctx.save();
  if (dis) ctx.globalAlpha = 0.45;
  ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 4 - down;
  ctx.fillStyle = k.shade; rr(ctx, r.x, r.y + 4 - down, r.w, r.h, o.r ?? 20); ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.fillStyle = k.fill; rr(ctx, r.x, r.y + down, r.w, r.h - 4 + (o.pressed ? 1 : 0), o.r ?? 20); ctx.fill();
  ctx.strokeStyle = k.edge; ctx.lineWidth = 2; ctx.stroke();
  const size = o.size ?? 28, line = o.line ?? size * 1.2;
  const L = lines ?? [];
  const sub = o.sub ?? [];
  const subSize = size * 0.62;
  const total = L.length * line + (sub.length ? sub.length * subSize * 1.25 + 4 : 0);
  let ty = r.y + down + (r.h - 4) / 2 - total / 2 + size * 0.86;
  for (const s of L) { text(ctx, s, r.x + r.w / 2, ty, size, k.ink, { weight: 700 }); ty += line; }
  if (sub.length) { ty += 2; for (const s of sub) { text(ctx, s, r.x + r.w / 2, ty - size * 0.1, subSize, kind === 'primary' ? 'rgba(255,244,228,0.85)' : INK2, { weight: 600 }); ty += subSize * 1.25; } }
  ctx.restore();
}
export const kindInk = (kind) => (KINDS[kind] ?? KINDS.normal).ink;

export function star(ctx, x, y, r, fill, stroke) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rad = i % 2 ? r * 0.46 : r; ctx.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad); }
  ctx.closePath();
  ctx.fillStyle = fill; ctx.fill();
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = Math.max(1, r * 0.1); ctx.lineJoin = 'round'; ctx.stroke(); }
}

// A punch outline (the same unit shapes the game cuts with), centred at cx, cy, about `size` px tall, turned by `turn` eighths of a circle.
export function shapeIcon(ctx, name, cx, cy, size, color, turn = 0, fill = true) {
  const pts = unitShape(name), a = (turn * Math.PI) / 4, c = Math.cos(a), s = Math.sin(a), k = size / 3;
  ctx.save(); ctx.beginPath();
  pts.forEach(([x, y], i) => { const X = cx + (x * c - y * s) * k, Y = cy + (x * s + y * c) * k; ctx[i ? 'lineTo' : 'moveTo'](X, Y); });
  ctx.closePath();
  if (fill) { ctx.fillStyle = color; ctx.fill(); } else { ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.lineJoin = 'round'; ctx.stroke(); }
  ctx.restore();
}

// Line icons on a 100 unit grid scaled to `size`.
export function icon(ctx, name, cx, cy, size, color = INK, lw = 0) {
  const s = size / 100;
  ctx.save();
  ctx.translate(cx, cy); ctx.scale(s, s);
  ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = lw || 9; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const P = (pts, close) => { ctx.beginPath(); pts.forEach(([x, y], i) => ctx[i ? 'lineTo' : 'moveTo'](x, y)); if (close) ctx.closePath(); };
  if (name === 'back') { P([[18, -36], [-20, 0], [18, 36]]); ctx.stroke(); }
  else if (name === 'pause') { ctx.fillRect(-26, -32, 18, 64); ctx.fillRect(8, -32, 18, 64); }
  else if (name === 'play') { P([[-20, -34], [30, 0], [-20, 34]], true); ctx.fill(); }
  else if (name === 'hint') {
    ctx.beginPath(); ctx.arc(0, -8, 28, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-14, 30); ctx.lineTo(14, 30); ctx.moveTo(-10, 42); ctx.lineTo(10, 42); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-8, 22); ctx.lineTo(-8, 10); ctx.lineTo(0, 0); ctx.lineTo(8, 10); ctx.lineTo(8, 22); ctx.lineWidth = 6; ctx.stroke();
  } else if (name === 'undo') {
    ctx.beginPath(); ctx.arc(4, 4, 30, Math.PI * 1.05, Math.PI * 2.25); ctx.stroke();
    P([[-26, -18], [-26, 6], [-2, 0]], true); ctx.fill();
  } else if (name === 'restart') {
    ctx.beginPath(); ctx.arc(0, 0, 30, -Math.PI * 0.35, Math.PI * 1.45); ctx.stroke();
    P([[22, -44], [32, -14], [6, -20]], true); ctx.fill();
  } else if (name === 'clear') { P([[-26, -26], [26, 26]]); ctx.stroke(); P([[26, -26], [-26, 26]]); ctx.stroke(); }
  else if (name === 'turn') {
    ctx.beginPath(); ctx.arc(0, 4, 30, -Math.PI * 0.9, Math.PI * 0.55); ctx.stroke();
    P([[-34, -36], [-34, -6], [-6, -22]], true); ctx.fill();
  } else if (name === 'scissors') {
    ctx.lineWidth = 8;
    ctx.beginPath(); ctx.arc(-22, 28, 14, 0, 6.2832); ctx.stroke(); ctx.beginPath(); ctx.arc(22, 28, 14, 0, 6.2832); ctx.stroke();
    P([[-14, 18], [26, -40]]); ctx.stroke(); P([[14, 18], [-26, -40]]); ctx.stroke();
  } else if (name === 'punch') {
    ctx.lineWidth = 8; P([[0, -42], [0, -4]]); ctx.stroke(); ctx.fillRect(-18, -50, 36, 12);
    ctx.beginPath(); ctx.arc(0, 18, 24, 0, 6.2832); ctx.stroke(); ctx.beginPath(); ctx.arc(0, 18, 8, 0, 6.2832); ctx.fill();
  } else if (name === 'fold') {
    P([[-34, -34], [34, -34], [34, 34], [-34, 34]], true); ctx.lineWidth = 7; ctx.stroke(); P([[-34, 34], [34, -34]]); ctx.setLineDash([9, 8]); ctx.stroke(); ctx.setLineDash([]);
    P([[-34, -34], [34, -34], [-34, 34]], true); ctx.fill();
  } else if (name === 'unfold') {
    P([[-36, 8], [0, -30], [36, 8]]); ctx.stroke(); P([[-36, 38], [0, 0], [36, 38]]); ctx.stroke();
  } else if (name === 'lock') {
    rr(ctx, -26, -6, 52, 40, 8); ctx.fill();
    ctx.beginPath(); ctx.arc(0, -8, 17, Math.PI, 0); ctx.stroke();
  } else if (name === 'check') { P([[-28, 2], [-8, 24], [30, -22]]); ctx.stroke(); }
  else if (name === 'save') { P([[-30, 30], [-30, -30], [20, -30], [30, -20], [30, 30]], true); ctx.stroke(); ctx.fillRect(-14, 4, 28, 26); }
  else if (name === 'gallery') { rr(ctx, -34, -30, 68, 60, 8); ctx.stroke(); P([[-22, 22], [-6, 0], [6, 14], [14, 6], [26, 22]]); ctx.stroke(); ctx.beginPath(); ctx.arc(14, -12, 7, 0, 6.2832); ctx.fill(); }
  else if (name === 'sheet') { P([[-30, -30], [30, -30], [30, 30], [-30, 30]], true); ctx.stroke(); }
  else if (name === 'speed') { P([[-30, -26], [-4, 0], [-30, 26]]); ctx.stroke(); P([[4, -26], [30, 0], [4, 26]]); ctx.stroke(); }
  ctx.restore();
}

// ---- particles (paper confetti and dust) ----------------------------------------------------------------------------------------------------
export function addBurst(list, rng, x, y, n, colors, o = {}) {
  for (let i = 0; i < n; i++) {
    const a = o.dir != null ? o.dir + (rng.next() - 0.5) * (o.spread ?? 1.2) : rng.next() * Math.PI * 2, sp = (o.min ?? 60) + rng.next() * ((o.max ?? 300) - (o.min ?? 60));
    list.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (o.up ?? 0), life: 0, max: (o.life ?? 1) * (0.6 + rng.next() * 0.6), c: colors[rng.int(colors.length)], r: (o.size0 ?? 4) + rng.next() * ((o.size1 ?? 8) - (o.size0 ?? 4)), rot: rng.next() * 6.28, vr: (rng.next() - 0.5) * 12, g: o.g ?? 520, shape: o.shape ?? 'tile' });
  }
}
export function stepParticles(list, dt) {
  for (const p of list) { p.life += dt; p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= Math.exp(-dt * 0.8); p.rot += p.vr * dt; }
  for (let i = list.length - 1; i >= 0; i--) if (list[i].life >= list[i].max) list.splice(i, 1);
}
export function drawParticles(ctx, list) {
  for (const p of list) {
    const k = 1 - p.life / p.max;
    ctx.save(); ctx.globalAlpha = Math.min(1, k * 1.6); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = p.c;
    if (p.shape === 'dot') { ctx.beginPath(); ctx.arc(0, 0, p.r * 0.6 * (0.5 + k * 0.5), 0, 6.2832); ctx.fill(); }
    else if (p.shape === 'chip') { ctx.beginPath(); ctx.moveTo(0, -p.r * 0.7); ctx.lineTo(p.r * 0.55, p.r * 0.5); ctx.lineTo(-p.r * 0.55, p.r * 0.4); ctx.closePath(); ctx.fill(); }
    else { ctx.fillRect(-p.r / 2, -p.r * 0.32, p.r, p.r * 0.64); }
    ctx.restore();
  }
}
export { SHAPES };
