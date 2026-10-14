// Scene art: tile wall, wooden bench, dough, carved moulds, cookies, trays, the oven window.
// Pure canvas drawing; nothing here changes game state. Everything is a function of its arguments so it is deterministic and pausable.
import { K, TYPES } from './engine.js';
import { T, mix, rgba, rr, clamp } from './ui.js';
import { active as on3, put } from './v3.js';

const TAU = Math.PI * 2;
export const FILL_COL = { date: '#6a3318', walnut: '#c79d62', pistachio: '#8cba4a' };
export const TYPE_DOT = { date: '#8a4a26', walnut: '#d2a468', pistachio: '#94c24f' };

// ---- carved patterns (three per cookie type) --------------------------------------------------------------------------------------------
export const PATTERNS = {
  date: [{ id: 'palm', name: 'Palm frond' }, { id: 'wheat', name: 'Wheat ear' }, { id: 'lattice', name: 'Lattice' }],
  walnut: [{ id: 'rosette', name: 'Rosette' }, { id: 'wheel', name: 'Wheel' }, { id: 'daisy', name: 'Daisy' }],
  pistachio: [{ id: 'zigzag', name: 'Zigzag ring' }, { id: 'garden', name: 'Garden' }, { id: 'scallop', name: 'Scallop' }],
};
export const UNLOCK = { date: [0, 5, 12], walnut: [0, 7, 16], pistachio: [0, 9, 20] };

export function dims(type, r) {
  if (type === 'date') return { rx: r * 1.02, ry: r * 0.74 };
  if (type === 'walnut') return { rx: r * 0.92, ry: r * 0.92 };
  return { rx: r * 0.96, ry: r * 0.96 };
}

const ellPath = (ctx, x, y, a, b, rot = 0) => { ctx.moveTo(x + Math.cos(rot) * a, y + Math.sin(rot) * a); ctx.ellipse(x, y, Math.max(0.5, a), Math.max(0.5, b), rot, 0, TAU); };
function hatch(ctx, P, slope, step, R) {
  const C = R * Math.sqrt(1 + slope * slope);
  for (let c = -C; c <= C + 1e-6; c += step) {
    const a = 1 + slope * slope, b = 2 * c * slope, cc = c * c - R * R, disc = b * b - 4 * a * cc;
    if (disc <= 0) continue;
    const sq = Math.sqrt(disc), v1 = (-b - sq) / (2 * a), v2 = (-b + sq) / (2 * a);
    ctx.moveTo(P.x(c + slope * v1), P.y(v1)); ctx.lineTo(P.x(c + slope * v2), P.y(v2));
  }
}
// Adds the carved lines of pattern `id` to the current path. (cx, cy) centre, rx/ry half sizes.
export function carve(ctx, id, cx, cy, rx, ry) {
  const P = { x: (u) => cx + u * rx, y: (v) => cy + v * ry }, m = Math.min(rx, ry);
  const ring = (rad) => ellPath(ctx, cx, cy, rx * rad, ry * rad);
  switch (id) {
    case 'palm': {
      ctx.moveTo(P.x(-0.8), P.y(0)); ctx.lineTo(P.x(0.8), P.y(0));
      for (let k = -3; k <= 3; k++) {
        const x = k * 0.2, len = 0.54 - Math.abs(k) * 0.05;
        ctx.moveTo(P.x(x), P.y(0)); ctx.lineTo(P.x(x + 0.2), P.y(-len));
        ctx.moveTo(P.x(x), P.y(0)); ctx.lineTo(P.x(x + 0.2), P.y(len));
      }
      ring(0.9); break;
    }
    case 'wheat': {
      ctx.moveTo(P.x(-0.84), P.y(0)); ctx.lineTo(P.x(0.84), P.y(0));
      for (let k = -3; k <= 3; k++) { const x = k * 0.21 + 0.04; ellPath(ctx, P.x(x), P.y(-0.28), rx * 0.14, ry * 0.075, -0.65); ellPath(ctx, P.x(x), P.y(0.28), rx * 0.14, ry * 0.075, 0.65); }
      ring(0.92); break;
    }
    case 'lattice': { hatch(ctx, P, 0.85, 0.3, 0.8); hatch(ctx, P, -0.85, 0.3, 0.8); ring(0.9); break; }
    case 'rosette': {
      for (let k = 0; k < 8; k++) { const a = (k * TAU) / 8; ellPath(ctx, P.x(Math.cos(a) * 0.46), P.y(Math.sin(a) * 0.46), m * 0.31, m * 0.13, a); }
      ellPath(ctx, cx, cy, m * 0.11, m * 0.11); ring(0.92); break;
    }
    case 'wheel': {
      ring(0.86); ring(0.3); ellPath(ctx, cx, cy, m * 0.09, m * 0.09);
      for (let k = 0; k < 12; k++) { const a = (k * TAU) / 12; ctx.moveTo(P.x(Math.cos(a) * 0.3), P.y(Math.sin(a) * 0.3)); ctx.lineTo(P.x(Math.cos(a) * 0.86), P.y(Math.sin(a) * 0.86)); }
      break;
    }
    case 'daisy': {
      for (let k = 0; k < 12; k++) { const a = (k * TAU) / 12; ellPath(ctx, P.x(Math.cos(a) * 0.68), P.y(Math.sin(a) * 0.68), m * 0.2, m * 0.075, a); }
      ring(0.4);
      for (let k = 0; k < 8; k++) { const a = (k * TAU) / 8 + 0.2; ellPath(ctx, P.x(Math.cos(a) * 0.2), P.y(Math.sin(a) * 0.2), m * 0.035, m * 0.035); }
      ring(0.95); break;
    }
    case 'zigzag': {
      const n = 16;
      for (let k = 0; k <= n * 2; k++) { const a = (k * TAU) / (n * 2), rad = k % 2 ? 0.8 : 0.58; (k ? ctx.lineTo : ctx.moveTo).call(ctx, P.x(Math.cos(a) * rad), P.y(Math.sin(a) * rad)); }
      ring(0.4); ellPath(ctx, cx, cy, m * 0.1, m * 0.1); ring(0.92); break;
    }
    case 'garden': {
      for (let k = 0; k < 4; k++) { const a = Math.PI / 4 + (k * Math.PI) / 2; ellPath(ctx, P.x(Math.cos(a) * 0.44), P.y(Math.sin(a) * 0.44), m * 0.3, m * 0.13, a); }
      for (let k = 0; k < 4; k++) { const a = (k * Math.PI) / 2; ellPath(ctx, P.x(Math.cos(a) * 0.74), P.y(Math.sin(a) * 0.74), m * 0.075, m * 0.075); }
      ellPath(ctx, cx, cy, m * 0.13, m * 0.13); ring(0.93); break;
    }
    case 'scallop': {
      for (let k = 0; k < 12; k++) { const a = (k * TAU) / 12; ellPath(ctx, P.x(Math.cos(a) * 0.72), P.y(Math.sin(a) * 0.72), m * 0.2, m * 0.2); }
      ring(0.46);
      for (let k = 0; k < 6; k++) { const a = (k * TAU) / 6; ctx.moveTo(cx, cy); ctx.lineTo(P.x(Math.cos(a) * 0.34), P.y(Math.sin(a) * 0.34)); }
      break;
    }
    default: ring(0.8);
  }
}

// ---- doneness colours --------------------------------------------------------------------------------------------------------------------
const BAKE = [[0, '#f3e4bd'], [0.5, '#efd7a1'], [0.78, '#e9c986'], [0.89, '#e4bf78'], [1.0, '#d9a85a'], [1.15, '#c08a3f'], [1.3, '#8a5122'], [1.5, '#2c170a']];
export function bakeColor(b) {
  if (b <= 0) return BAKE[0][1];
  for (let i = 1; i < BAKE.length; i++) if (b <= BAKE[i][0]) { const a = BAKE[i - 1], c = BAKE[i]; return mix(a[1], c[1], (b - a[0]) / (c[0] - a[0])); }
  return BAKE[BAKE.length - 1][1];
}

// ---- backdrop: tile wall + bench -------------------------------------------------------------------------------------------------------
export function drawWall(ctx, x, y, w, h, t = 0) {
  if (on3()) return;                      // the 3D backdrop replaces the flat wall
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, '#176b6e'); g.addColorStop(1, T.tile1);
  ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  const s = clamp(w / 11, 46, 76);
  ctx.strokeStyle = 'rgba(255,236,190,0.13)'; ctx.lineWidth = 2; ctx.beginPath();
  for (let i = -1; i * s < w + h + s; i++) { ctx.moveTo(x + i * s, y); ctx.lineTo(x + i * s - h, y + h); ctx.moveTo(x + i * s - h, y); ctx.lineTo(x + i * s, y + h); }
  ctx.stroke();
  // a small four-petal flower in every second diamond
  ctx.fillStyle = 'rgba(255,236,190,0.10)'; ctx.beginPath();
  const cols = Math.ceil(w / s) + 1, rows = Math.ceil(h / s) + 1;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    if ((r + c) % 2) continue;
    const px = x + c * s, py = y + r * s + s / 2;
    for (let k = 0; k < 4; k++) { const a = (k * Math.PI) / 2; ctx.moveTo(px + Math.cos(a) * s * 0.2, py + Math.sin(a) * s * 0.2); ctx.ellipse(px + Math.cos(a) * s * 0.12, py + Math.sin(a) * s * 0.12, s * 0.1, s * 0.045, a, 0, TAU); }
  }
  ctx.fill();
  // warm lamp glow from above
  const lg = ctx.createRadialGradient(x + w / 2, y, 0, x + w / 2, y, Math.max(w, h) * 0.8);
  lg.addColorStop(0, T.lamp); lg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = lg; ctx.fillRect(x, y, w, h);
  ctx.restore();
  void t;
}
const speck = (i) => { const a = Math.sin(i * 127.1 + 311.7) * 43758.5453; return a - Math.floor(a); };
export function drawBench(ctx, r) {
  if (on3()) { put(ctx, { k: 'bench', r }); return; }
  ctx.save();
  rr(ctx, r.x, r.y, r.w, r.h, 26); ctx.clip();
  const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
  g.addColorStop(0, '#a46f3f'); g.addColorStop(0.5, T.wood0); g.addColorStop(1, '#6a4425');
  ctx.fillStyle = g; ctx.fillRect(r.x, r.y, r.w, r.h);
  // planks and grain
  const ph = Math.max(70, r.h / 5);
  ctx.strokeStyle = 'rgba(40,22,8,0.42)'; ctx.lineWidth = 2.5; ctx.beginPath();
  for (let y = r.y + ph; y < r.y + r.h; y += ph) { ctx.moveTo(r.x, y); ctx.lineTo(r.x + r.w, y); }
  ctx.stroke();
  ctx.strokeStyle = 'rgba(60,34,12,0.16)'; ctx.lineWidth = 1.5; ctx.beginPath();
  for (let i = 0; i < 26; i++) {
    const y = r.y + speck(i * 3 + 1) * r.h, x0 = r.x + speck(i * 3 + 2) * r.w * 0.6, len = r.w * (0.2 + speck(i * 3 + 3) * 0.4);
    ctx.moveTo(x0, y); ctx.bezierCurveTo(x0 + len * 0.3, y - 4, x0 + len * 0.7, y + 4, x0 + len, y);
  }
  ctx.stroke();
  // flour dust
  ctx.fillStyle = 'rgba(255,248,232,0.22)'; ctx.beginPath();
  for (let i = 0; i < 70; i++) { const x = r.x + speck(i + 50) * r.w, y = r.y + speck(i + 90) * r.h, s = 1 + speck(i + 130) * 3; ctx.moveTo(x + s, y); ctx.arc(x, y, s, 0, TAU); }
  ctx.fill();
  // soft vignette
  const vg = ctx.createRadialGradient(r.x + r.w / 2, r.y + r.h / 2, Math.min(r.w, r.h) * 0.3, r.x + r.w / 2, r.y + r.h / 2, Math.max(r.w, r.h) * 0.75);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.38)');
  ctx.fillStyle = vg; ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.restore();
  rr(ctx, r.x, r.y, r.w, r.h, 26); ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,230,180,0.28)'; ctx.stroke();
}

// ---- cookies ---------------------------------------------------------------------------------------------------------------------------
// o: type, pat (index), b (bake level), clarity 0..1 (how sharp the print is), dust (icing sugar), lift 0..1, ghost
export function drawCookie(ctx, cx, cy, r, o = {}) {
  if (on3()) { put(ctx, { k: 'cookie', cx, cy, r, o }); return; }
  const { type = 'date', pat = 0, b = 0.4, clarity = 1, dust = false, lift = 0, scale = 1, alpha = 1, unit = false } = o;
  const d = unit ? { rx: r * scale, ry: r * scale } : dims(type, r * scale), { rx, ry } = d;
  ctx.save();
  ctx.globalAlpha = alpha;
  // contact shadow
  if (!unit) {
    ctx.fillStyle = `rgba(20,10,2,${0.34 - lift * 0.14})`;
    ctx.beginPath(); ctx.ellipse(cx + r * 0.05, cy + ry * 0.2 + lift * r * 0.14 + r * 0.08, rx * 1.02, ry * 0.98, 0, 0, TAU); ctx.fill();
  }
  const base = bakeColor(b);
  const g = ctx.createRadialGradient(cx - rx * 0.35, cy - ry * 0.42, r * 0.05, cx, cy, Math.max(rx, ry) * 1.25);
  g.addColorStop(0, mix(base, '#ffffff', type === 'dome' ? 0.5 : 0.35)); g.addColorStop(0.55, base); g.addColorStop(1, mix(base, '#3a1c06', 0.45));
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, TAU); ctx.fill();
  // rim bevel
  ctx.lineWidth = Math.max(1.5, r * 0.05); ctx.strokeStyle = 'rgba(255,250,235,0.34)';
  ctx.beginPath(); ctx.ellipse(cx - r * 0.012, cy - r * 0.012, rx * 0.97, ry * 0.97, 0, Math.PI * 0.95, Math.PI * 1.75); ctx.stroke();
  ctx.strokeStyle = 'rgba(70,32,6,0.34)';
  ctx.beginPath(); ctx.ellipse(cx + r * 0.012, cy + r * 0.012, rx * 0.97, ry * 0.97, 0, -Math.PI * 0.05, Math.PI * 0.75); ctx.stroke();
  // carved print: dark groove then a light lip, both scaled by clarity
  const id = (PATTERNS[type][pat] ?? PATTERNS[type][0]).id, lw = Math.max(1.4, r * 0.052);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const dark = mix(base, '#2a1204', 0.55);
  ctx.lineWidth = lw; ctx.strokeStyle = rgba(hexOf(dark), 0.25 + 0.6 * clarity);
  ctx.beginPath(); carve(ctx, id, cx + lw * 0.35, cy + lw * 0.35, rx * 0.9, ry * 0.9); ctx.stroke();
  ctx.lineWidth = lw * 0.7; ctx.strokeStyle = `rgba(255,250,232,${0.15 + 0.5 * clarity})`;
  ctx.beginPath(); carve(ctx, id, cx - lw * 0.3, cy - lw * 0.3, rx * 0.9, ry * 0.9); ctx.stroke();
  if (type === 'dome') { // specular
    ctx.fillStyle = 'rgba(255,255,255,0.20)'; ctx.beginPath(); ctx.ellipse(cx - rx * 0.32, cy - ry * 0.4, rx * 0.26, ry * 0.15, -0.6, 0, TAU); ctx.fill();
  }
  if (dust) { // icing sugar
    ctx.fillStyle = 'rgba(255,255,250,0.55)'; ctx.beginPath();
    for (let i = 0; i < 16; i++) { const a = speck(i + 7) * TAU, rad = Math.sqrt(speck(i + 31)) * 0.82; ctx.moveTo(cx + Math.cos(a) * rad * rx + 1.4, cy + Math.sin(a) * rad * ry); ctx.arc(cx + Math.cos(a) * rad * rx, cy + Math.sin(a) * rad * ry, Math.max(1, r * 0.032), 0, TAU); }
    ctx.fill();
  }
  ctx.restore();
}
const hexOf = (c) => (c[0] === '#' ? c : rgbToHex(c));
function rgbToHex(c) {
  const v = c.slice(c.indexOf('(') + 1, c.indexOf(')')).split(',').map((n) => Math.round(Number(n)));
  return '#' + v.map((n) => n.toString(16).padStart(2, '0')).join('');
}
// A ghost slot on the tray: a dashed outline of the type's shape plus a small filling dot.
export function drawGhost(ctx, cx, cy, r, type, o = {}) {
  const { rx, ry } = dims(type, r), { glow = 0, t = 0 } = o;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, TAU); ctx.fill();
  ctx.setLineDash([Math.max(4, r * 0.18), Math.max(4, r * 0.14)]);
  ctx.lineWidth = Math.max(2, r * 0.07); ctx.strokeStyle = glow ? `rgba(255,214,120,${0.7 + 0.3 * Math.sin(t * 8)})` : 'rgba(40,52,56,0.55)';
  ctx.beginPath(); ctx.ellipse(cx, cy, rx * 0.98, ry * 0.98, 0, 0, TAU); ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = TYPE_DOT[type]; ctx.beginPath(); ctx.arc(cx, cy, Math.max(4, r * 0.15), 0, TAU); ctx.fill();
  ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.stroke();
  if (glow) { ctx.fillStyle = `rgba(255,214,120,${0.16 + 0.12 * Math.sin(t * 8)})`; ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, TAU); ctx.fill(); }
  ctx.restore();
}

// ---- carved moulds --------------------------------------------------------------------------------------------------------------------
export function drawMould(ctx, cx, cy, r, type, pat = 0, o = {}) {
  if (on3()) { put(ctx, { k: 'mould', cx, cy, r, type, pat, o }); return; }
  const { shake = 0, lift = 0, handle = true, dim = false, flat = false } = o;
  const { rx, ry } = dims(type, r * 0.86);
  ctx.save();
  ctx.globalAlpha = dim ? 0.55 : 1;
  const x = cx + shake, y = cy - lift;
  // shadow on the bench
  if (!flat) {
    ctx.fillStyle = `rgba(20,10,2,${0.32 - lift / (r * 2)})`;
    ctx.beginPath(); ctx.ellipse(cx + r * 0.06, cy + r * 0.12 + lift * 0.4, r * 1.12, r * 1.04, 0, 0, TAU); ctx.fill();
  }
  // block
  if (handle) {
    const hw = r * 0.34, hl = r * 0.95;
    const hg = ctx.createLinearGradient(x - hw, 0, x + hw, 0);
    hg.addColorStop(0, '#7a4a24'); hg.addColorStop(0.5, '#b07a48'); hg.addColorStop(1, '#6a3f1d');
    rr(ctx, x - hw, y + r * 0.6, hw * 2, hl, hw * 0.5); ctx.fillStyle = hg; ctx.fill();
    ctx.strokeStyle = 'rgba(30,14,2,0.55)'; ctx.lineWidth = 2; ctx.stroke();
  }
  const bg = ctx.createRadialGradient(x - r * 0.4, y - r * 0.45, r * 0.1, x, y, r * 1.2);
  bg.addColorStop(0, '#c58e55'); bg.addColorStop(0.6, '#9a6334'); bg.addColorStop(1, '#5e3a1d');
  ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(x, y, r * 1.08, 0, TAU); ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,225,170,0.35)'; ctx.beginPath(); ctx.arc(x - 1, y - 1, r * 1.06, Math.PI * 0.9, Math.PI * 1.75); ctx.stroke();
  ctx.strokeStyle = 'rgba(25,10,0,0.55)'; ctx.beginPath(); ctx.arc(x + 1, y + 1, r * 1.06, -Math.PI * 0.1, Math.PI * 0.7); ctx.stroke();
  // the cavity: darker wood, carved lines in light and dark
  const cg = ctx.createRadialGradient(x - rx * 0.3, y - ry * 0.3, r * 0.05, x, y, Math.max(rx, ry) * 1.2);
  cg.addColorStop(0, '#6b4121'); cg.addColorStop(1, '#3a210d');
  ctx.fillStyle = cg; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, TAU); ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(20,8,0,0.7)'; ctx.stroke();
  const id = (PATTERNS[type][pat] ?? PATTERNS[type][0]).id, lw = Math.max(1.5, r * 0.055);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(14,5,0,0.85)'; ctx.lineWidth = lw; ctx.beginPath(); carve(ctx, id, x, y, rx * 0.9, ry * 0.9); ctx.stroke();
  ctx.strokeStyle = 'rgba(214,160,100,0.55)'; ctx.lineWidth = lw * 0.5; ctx.beginPath(); carve(ctx, id, x - lw * 0.5, y - lw * 0.5, rx * 0.9, ry * 0.9); ctx.stroke();
  ctx.restore();
}

// ---- dough ---------------------------------------------------------------------------------------------------------------------------
export function drawDough(ctx, cx, cy, R, o = {}) {
  if (on3()) { put(ctx, { k: 'dough', cx, cy, R, o }); return; }
  const { type = 'date', amount = 0, target = -1, band = 0.1, seal = 0, st = 'fill', t = 0, bins = null, hollow = true } = o;
  ctx.save();
  if (!o.flat) { ctx.fillStyle = 'rgba(20,10,2,0.3)'; ctx.beginPath(); ctx.ellipse(cx + R * 0.05, cy + R * 0.12, R * 1.04, R * 0.98, 0, 0, TAU); ctx.fill(); }
  const g = ctx.createRadialGradient(cx - R * 0.35, cy - R * 0.4, R * 0.1, cx, cy, R * 1.15);
  g.addColorStop(0, '#fff0cc'); g.addColorStop(0.6, T.dough); g.addColorStop(1, '#c9a468');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(90,50,10,0.35)'; ctx.stroke();
  if (st === 'fill' && hollow) {
    // the cup and the growing mound of filling
    const cup = R * 0.66;
    const cg = ctx.createRadialGradient(cx - cup * 0.2, cy - cup * 0.25, cup * 0.1, cx, cy, cup);
    cg.addColorStop(0, '#d9bb83'); cg.addColorStop(1, '#a98650');
    ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(cx, cy, cup, 0, TAU); ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(70,40,8,0.4)'; ctx.stroke();
    const mr = cup * (0.22 + 0.78 * amount);
    drawFilling(ctx, type, cx, cy, mr, t);
    if (target >= 0) {
      const tr = cup * (0.22 + 0.78 * target), r0 = cup * (0.22 + 0.78 * clamp(target - band, 0, 1)), r1 = cup * (0.22 + 0.78 * clamp(target + band, 0, 1));
      ctx.fillStyle = 'rgba(255,214,110,0.22)'; ctx.beginPath(); ctx.arc(cx, cy, r1, 0, TAU); ctx.arc(cx, cy, Math.max(0.1, r0), 0, TAU, true); ctx.fill();
      ctx.setLineDash([9, 7]); ctx.lineWidth = 3.5; ctx.strokeStyle = '#ffd45a'; ctx.beginPath(); ctx.arc(cx, cy, tr, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    }
  } else if (st !== 'fill') {
    // closed ball: a plump mound with a little seam
    const mg = ctx.createRadialGradient(cx - R * 0.3, cy - R * 0.35, R * 0.05, cx, cy, R * 0.9);
    mg.addColorStop(0, '#fff6dc'); mg.addColorStop(0.7, T.dough); mg.addColorStop(1, '#d4b074');
    ctx.fillStyle = mg; ctx.beginPath(); ctx.arc(cx, cy, R * 0.86, 0, TAU); ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(120,80,20,0.35)';
    if (seal < 1) { ctx.beginPath(); ctx.moveTo(cx - R * 0.32, cy); ctx.lineTo(cx + R * 0.32, cy); ctx.moveTo(cx, cy - R * 0.32); ctx.lineTo(cx, cy + R * 0.32); ctx.stroke(); }
  }
  if (bins) {
    // sealed rim: little crimps coloured by how true the finger ran
    const n = bins.length;
    for (let i = 0; i < n; i++) {
      const v = bins[i];
      if (v < 0) continue;
      const a = -Math.PI / 2 + (i + 0.5) * (TAU / n), x = cx + Math.cos(a) * R * 0.97, y = cy + Math.sin(a) * R * 0.97;
      ctx.fillStyle = v > 0.7 ? '#9be08a' : v > 0.4 ? '#ffd45a' : '#ff8a6a';
      ctx.save(); ctx.translate(x, y); ctx.rotate(a); rr(ctx, -R * 0.05, -R * 0.1, R * 0.1, R * 0.2, R * 0.04); ctx.fill(); ctx.restore();
    }
  }
  ctx.restore();
}
export function drawFilling(ctx, type, cx, cy, r, t = 0) {
  ctx.save();
  const col = FILL_COL[type];
  const g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.35, r * 0.05, cx, cy, r * 1.1);
  g.addColorStop(0, mix(col, '#ffffff', 0.35)); g.addColorStop(0.7, col); g.addColorStop(1, mix(col, '#000000', 0.4));
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill();
  if (type !== 'date') { // crumbly: ground nuts
    ctx.fillStyle = type === 'walnut' ? 'rgba(110,70,30,0.55)' : 'rgba(40,90,20,0.5)';
    ctx.beginPath();
    for (let i = 0; i < 18; i++) { const a = speck(i + 3) * TAU, rad = Math.sqrt(speck(i + 20)) * 0.82 * r, s = Math.max(1.5, r * 0.07); ctx.moveTo(cx + Math.cos(a) * rad + s, cy + Math.sin(a) * rad); ctx.arc(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad, s, 0, TAU); }
    ctx.fill();
  } else { ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.beginPath(); ctx.ellipse(cx - r * 0.3, cy - r * 0.35, r * 0.28, r * 0.14, -0.6, 0, TAU); ctx.fill(); }
  void t;
  ctx.restore();
}

// ---- trays --------------------------------------------------------------------------------------------------------------------------
export function trayGeo(rect, cols, rows) {
  const pad = Math.max(12, Math.min(rect.w, rect.h) * 0.06);
  const cw = (rect.w - 2 * pad) / cols, ch = (rect.h - 2 * pad) / rows;
  const r = Math.min(cw, ch) * 0.42;
  const cell = (i) => ({ cx: rect.x + pad + (i % cols + 0.5) * cw, cy: rect.y + pad + (Math.floor(i / cols) + 0.5) * ch, r, cw, ch });
  const at = (x, y) => {
    const c = Math.floor((x - rect.x - pad) / cw), rw = Math.floor((y - rect.y - pad) / ch);
    return c < 0 || rw < 0 || c >= cols || rw >= rows ? -1 : rw * cols + c;
  };
  return { rect, cell, at, cols, rows, cw, ch, r };
}
export function drawTrayBody(ctx, r) {
  ctx.save();
  rr(ctx, r.x + 3, r.y + 7, r.w, r.h, 20); ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fill();
  const g = ctx.createLinearGradient(r.x, r.y, r.x + r.w * 0.5, r.y + r.h);
  g.addColorStop(0, T.steel0); g.addColorStop(1, T.steel1);
  rr(ctx, r.x, r.y, r.w, r.h, 20); ctx.fillStyle = g; ctx.fill();
  ctx.lineWidth = 2.5; ctx.strokeStyle = 'rgba(255,255,255,0.55)'; rr(ctx, r.x + 1.5, r.y + 1.5, r.w - 3, r.h - 3, 19); ctx.stroke();
  // inner baking paper
  const ix = r.x + 10, iy = r.y + 10, iw = r.w - 20, ih = r.h - 20;
  rr(ctx, ix, iy, iw, ih, 12); ctx.fillStyle = '#f2ead6'; ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(80,60,30,0.35)'; ctx.stroke();
  ctx.restore();
}
// Draws a tray with ghosts and cookies. o: b (bake level shown for cookies, null = raw dough), pats {type: idx}, glow: Set of slot ids, t, hot: slot index to pulse
export function drawTray(ctx, rect, tray, o = {}) {
  const { b = null, pats = {}, glow = null, t = 0, dust = false } = o;
  if (on3()) {
    put(ctx, { k: 'tray', rect, tray, o });
    return trayGeo({ x: rect.x + 10, y: rect.y + 10, w: rect.w - 20, h: rect.h - 20 }, tray.cols, tray.rows);
  }
  drawTrayBody(ctx, rect);
  const geo = trayGeo({ x: rect.x + 10, y: rect.y + 10, w: rect.w - 20, h: rect.h - 20 }, tray.cols, tray.rows);
  tray.slots.forEach((s, i) => {
    const c = geo.cell(i);
    if (s.st === 'empty') drawGhost(ctx, c.cx, c.cy, c.r, s.type, { glow: glow && glow.has(i) ? 1 : 0, t });
    else {
      const bb = b === null ? 0.12 : b;
      drawCookie(ctx, c.cx, c.cy, c.r, { type: s.type, pat: pats[s.type] | 0, b: bb, clarity: 0.35 + 0.65 * s.q, dust: dust && b !== null && b > 0.7 && b < 1.15 });
    }
  });
  return geo;
}

// ---- peel (the flat paddle the knocked-out cookie lands on) ------------------------------------------------------------------------------
export function drawPeel(ctx, cx, cy, r) {
  if (on3()) { put(ctx, { k: 'peel', cx, cy, r }); return; }
  ctx.save();
  ctx.fillStyle = 'rgba(20,10,2,0.3)'; rr(ctx, cx - r * 1.3 + 4, cy - r * 1.1 + 8, r * 2.6, r * 2.2, r * 0.5); ctx.fill();
  const g = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
  g.addColorStop(0, '#d9b078'); g.addColorStop(1, '#a87a46');
  rr(ctx, cx - r * 1.3, cy - r * 1.1, r * 2.6, r * 2.2, r * 0.5); ctx.fillStyle = g; ctx.fill();
  ctx.lineWidth = 2.5; ctx.strokeStyle = 'rgba(60,32,8,0.45)'; ctx.stroke();
  ctx.fillStyle = 'rgba(255,248,232,0.22)';
  ctx.beginPath(); for (let i = 0; i < 20; i++) { const x = cx + (speck(i + 60) - 0.5) * r * 2.3, y = cy + (speck(i + 80) - 0.5) * r * 1.9; ctx.moveTo(x + 2, y); ctx.arc(x, y, 1 + speck(i) * 2.2, 0, TAU); }
  ctx.fill();
  ctx.restore();
}

// ---- oven ----------------------------------------------------------------------------------------------------------------------------
export const GAUGE_STOPS = [
  [0, K.B_RAW, '#6f9fc4', 'Raw'], [K.B_RAW, K.WIN0, '#d9c27a', 'Nearly'], [K.WIN0, K.WIN1, '#8fe0a0', 'Pale gold'],
  [K.WIN1, K.B_BROWN, '#e0a040', 'Golden'], [K.B_BROWN, K.B_BURN, '#b0602a', 'Brown'], [K.B_BURN, K.B_AUTO, '#3a1a0a', 'Burnt'],
];
// Horizontal bake gauge: rect r, level b (0..B_AUTO)
export function drawGauge(ctx, r, b, o = {}) {
  if (on3()) { put(ctx, { k: 'gauge', r, b, o }); return; }
  const { active = true, pulse = 0 } = o, span = K.B_AUTO;
  ctx.save();
  rr(ctx, r.x, r.y, r.w, r.h, r.h / 2); ctx.clip();
  for (const [a, c, col] of GAUGE_STOPS) { ctx.fillStyle = col; ctx.globalAlpha = active ? 1 : 0.45; ctx.fillRect(r.x + (a / span) * r.w, r.y, ((c - a) / span) * r.w + 0.6, r.h); }
  ctx.globalAlpha = 1;
  ctx.restore();
  rr(ctx, r.x, r.y, r.w, r.h, r.h / 2); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.stroke();
  if (active) {
    const x = r.x + clamp(b / span, 0, 1) * r.w;
    ctx.fillStyle = '#fff'; ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x, r.y - 3); ctx.lineTo(x + r.h * 0.42, r.y - r.h * 0.5); ctx.lineTo(x - r.h * 0.42, r.y - r.h * 0.5); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillRect(x - 1.5, r.y, 3, r.h);
    if (pulse) { ctx.strokeStyle = `rgba(255,255,255,${0.5 + 0.4 * Math.sin(pulse * 8)})`; ctx.lineWidth = 3; rr(ctx, r.x - 3, r.y - 3, r.w + 6, r.h + 6, r.h / 2 + 3); ctx.stroke(); }
  }
}
// The oven window: a tiled arch with a glowing mouth. tray (or null) drawn small inside with live colour b.
export function drawOven(ctx, r, tray, b, t, o = {}) {
  const { pats = {}, hot = false } = o;
  if (on3()) {
    put(ctx, { k: 'oven', r, tray, b, t, o });
    if (hot) { ctx.save(); ctx.strokeStyle = `rgba(143,224,160,${0.55 + 0.4 * Math.sin(t * 9)})`; ctx.lineWidth = 5; rr(ctx, r.x - 3, r.y - 3, r.w + 6, r.h + 6, 25); ctx.stroke(); ctx.restore(); }
    return;
  }
  ctx.save();
  rr(ctx, r.x + 3, r.y + 6, r.w, r.h, 22); ctx.fillStyle = 'rgba(0,0,0,0.38)'; ctx.fill();
  const g = ctx.createLinearGradient(r.x, r.y, r.x, r.y + r.h);
  g.addColorStop(0, '#c86f45'); g.addColorStop(1, '#8e4528');
  rr(ctx, r.x, r.y, r.w, r.h, 22); ctx.fillStyle = g; ctx.fill();
  ctx.lineWidth = 2.5; ctx.strokeStyle = 'rgba(255,225,180,0.4)'; ctx.stroke();
  // mouth
  const m = { x: r.x + r.w * 0.07, y: r.y + r.h * 0.14, w: r.w * 0.86, h: r.h * 0.72 };
  const mg = ctx.createLinearGradient(0, m.y, 0, m.y + m.h);
  const heat = tray ? 1 : 0.35;
  mg.addColorStop(0, `rgba(255,${170 + 40 * heat | 0},60,1)`); mg.addColorStop(1, `rgba(${120 + 100 * heat | 0},40,10,1)`);
  rr(ctx, m.x, m.y, m.w, m.h, m.h * 0.45); ctx.fillStyle = mg; ctx.fill();
  ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(40,16,4,0.85)'; ctx.stroke();
  if (tray) {
    ctx.save(); rr(ctx, m.x, m.y, m.w, m.h, m.h * 0.45); ctx.clip();
    const tw = m.w * 0.84, th = Math.min(m.h * 0.8, tw / (tray.cols / tray.rows) * 1.0);
    const tr = { x: m.x + (m.w - tw) / 2, y: m.y + (m.h - th) / 2, w: tw, h: th };
    drawTray(ctx, tr, tray, { b, pats, t });
    ctx.restore();
  } else {
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    const fl = 0.5 + 0.5 * Math.sin(t * 3);
    ctx.beginPath(); ctx.ellipse(m.x + m.w / 2, m.y + m.h * 0.82, m.w * 0.3, m.h * 0.1 * (0.8 + 0.3 * fl), 0, 0, TAU); ctx.fill();
  }
  if (hot) { ctx.strokeStyle = `rgba(143,224,160,${0.55 + 0.4 * Math.sin(t * 9)})`; ctx.lineWidth = 5; rr(ctx, r.x - 3, r.y - 3, r.w + 6, r.h + 6, 25); ctx.stroke(); }
  ctx.restore();
}
