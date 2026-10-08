// Drawing for the scene: the lamp-lit floor, the folded paper tiles in perspective (lit faces, layered edges, soft contact
// shadows), the printed patterns and the dust / paper-fleck effects. Pure drawing, no state, no randomness at draw time.
import { MAT, THICK } from './sim.js';

export const FONT = "'Baskerville', 'Iowan Old Style', Georgia, 'Times New Roman', serif";
export const TAU = Math.PI * 2;
const lcg = (seed) => { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; };
const LIGHT = norm3(-0.35, -0.45, 0.82);
function norm3(x, y, z) { const l = Math.hypot(x, y, z); return { x: x / l, y: y / l, z: z / l }; }

// ---- printed patterns (drawn in a 100 x 100 box, origin top-left) --------------------------------------------------
const rr = (c, x, y, w, h, r) => { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); };
const poly = (c, pts) => { c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); };
const flower = (c, x, y, r, petal, centre) => {
  c.fillStyle = petal; for (let i = 0; i < 5; i++) { const a = (i / 5) * TAU - Math.PI / 2; c.beginPath(); c.ellipse(x + Math.cos(a) * r * 0.62, y + Math.sin(a) * r * 0.62, r * 0.5, r * 0.46, a, 0, TAU); c.fill(); }
  c.fillStyle = centre; c.beginPath(); c.arc(x, y, r * 0.24, 0, TAU); c.fill();
};
const starP = (c, x, y, R, r, n, rot = 0) => { const pts = []; for (let i = 0; i < n * 2; i++) { const a = rot + (i * Math.PI) / n - Math.PI / 2, q = i % 2 ? r : R; pts.push([x + Math.cos(a) * q, y + Math.sin(a) * q]); } poly(c, pts); };

export const PATTERNS = [
  { id: 'ribbon', name: 'Ribbon Bands', bg: '#f1e2bd', draw(c) {
    const cols = ['#2f7a62', '#d9742c', '#e8b84a', '#1f3f5c', '#b8473c'];
    for (let i = 0; i < 5; i++) { c.fillStyle = cols[i]; c.fillRect(0, i * 20, 100, 20); c.fillStyle = 'rgba(255,255,255,0.18)'; c.fillRect(0, i * 20, 100, 3); c.fillStyle = 'rgba(0,0,0,0.14)'; c.fillRect(0, i * 20 + 17, 100, 3); }
    c.strokeStyle = 'rgba(255,248,226,0.7)'; c.lineWidth = 2; for (let i = 1; i < 5; i++) { c.beginPath(); c.moveTo(0, i * 20); c.lineTo(100, i * 20); c.stroke(); } } },
  { id: 'lattice', name: 'Window Lattice', bg: '#e9d6a6', draw(c) {
    c.fillStyle = '#efe0b5'; c.fillRect(0, 0, 100, 100); c.strokeStyle = '#6b3d22'; c.lineWidth = 4.5; c.lineCap = 'square';
    for (let i = 0; i <= 5; i++) { c.beginPath(); c.moveTo(i * 20, 0); c.lineTo(i * 20, 100); c.moveTo(0, i * 20); c.lineTo(100, i * 20); c.stroke(); }
    c.lineWidth = 2.4; c.strokeStyle = '#a5683c'; for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) { const x = i * 20, y = j * 20; c.beginPath(); c.moveTo(x + 10, y + 3); c.lineTo(x + 17, y + 10); c.lineTo(x + 10, y + 17); c.lineTo(x + 3, y + 10); c.closePath(); c.stroke(); } } },
  { id: 'plum', name: 'Plum Blossom', bg: '#243656', draw(c) {
    const g = c.createLinearGradient(0, 0, 0, 100); g.addColorStop(0, '#2c4268'); g.addColorStop(1, '#1b2740'); c.fillStyle = g; c.fillRect(0, 0, 100, 100);
    c.strokeStyle = '#7a5538'; c.lineWidth = 3.4; c.lineCap = 'round'; c.beginPath(); c.moveTo(-4, 88); c.quadraticCurveTo(30, 66, 52, 56); c.quadraticCurveTo(76, 44, 104, 18); c.moveTo(52, 56); c.quadraticCurveTo(58, 80, 70, 98); c.moveTo(30, 69); c.quadraticCurveTo(26, 46, 34, 24); c.stroke();
    flower(c, 28, 40, 9, '#f4c9d0', '#e8a340'); flower(c, 70, 38, 11, '#f7d6dc', '#e8a340'); flower(c, 52, 56, 8, '#f1b9c4', '#e8a340'); flower(c, 76, 76, 7, '#f7d6dc', '#e8a340'); flower(c, 17, 70, 6, '#f1b9c4', '#e8a340'); flower(c, 40, 16, 6, '#f7d6dc', '#e8a340'); } },
  { id: 'bamboo', name: 'Bamboo Grove', bg: '#d8e6c8', draw(c) {
    const g = c.createLinearGradient(0, 0, 100, 0); g.addColorStop(0, '#e3edd0'); g.addColorStop(1, '#c9dcb6'); c.fillStyle = g; c.fillRect(0, 0, 100, 100);
    [[20, 6], [50, 10], [78, 5]].forEach(([x, w], k) => { const gr = c.createLinearGradient(x - w, 0, x + w, 0); gr.addColorStop(0, '#2d6a3e'); gr.addColorStop(0.5, '#6aa760'); gr.addColorStop(1, '#2d6a3e'); c.fillStyle = gr; c.fillRect(x - w / 2 - 2, 0, w + 4, 100);
      c.fillStyle = '#245633'; for (let j = 0; j < 4; j++) c.fillRect(x - w / 2 - 3, 14 + j * 24 + k * 5, w + 6, 3);
      c.fillStyle = '#4c8f4c'; for (let j = 0; j < 3; j++) { c.beginPath(); c.ellipse(x + w + 5, 26 + j * 28 + k * 4, 10, 3, -0.5, 0, TAU); c.ellipse(x - w - 5, 40 + j * 28, 9, 2.8, 0.5, 0, TAU); c.fill(); } }); } },
  { id: 'waves', name: 'Rolling Waves', bg: '#1d466c', draw(c) {
    c.fillStyle = '#1d466c'; c.fillRect(0, 0, 100, 100);
    for (let row = 0; row < 6; row++) for (let col = -1; col < 6; col++) { const cx = col * 20 + (row % 2) * 10, cy = row * 16 + 8; for (let k = 0; k < 4; k++) { c.beginPath(); c.arc(cx, cy + 6, 14 - k * 3.2, Math.PI, 0); c.fillStyle = ['#e9f2f1', '#9fcbd6', '#4f8fb1', '#2a628a'][k]; c.fill(); } }
    c.fillStyle = 'rgba(255,255,255,0.08)'; c.fillRect(0, 0, 100, 6); } },
  { id: 'patchwork', name: 'Patchwork Cloth', bg: '#efe2c2', draw(c) {
    const cols = ['#e07a52', '#f0c25a', '#4f9a82', '#8c5aa0', '#d8e6e0', '#4b6fa5', '#f2b8b8', '#9fb870']; const r = lcg(41);
    const xs = [0, 36, 64, 100], ys = [0, 30, 60, 100]; let k = 0;
    for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) { c.fillStyle = cols[(k++ * 3 + (r() * 3 | 0)) % 8]; c.fillRect(xs[i], ys[j], xs[i + 1] - xs[i], ys[j + 1] - ys[j]); }
    c.strokeStyle = '#fff6e0'; c.lineWidth = 2; c.setLineDash([3, 3]); for (let i = 1; i < 3; i++) { c.beginPath(); c.moveTo(xs[i], 0); c.lineTo(xs[i], 100); c.moveTo(0, ys[i]); c.lineTo(100, ys[i]); c.stroke(); } c.setLineDash([]);
    c.strokeStyle = 'rgba(0,0,0,0.16)'; c.lineWidth = 1; c.strokeRect(0.5, 0.5, 99, 99); } },
  { id: 'pine', name: 'Pine Needles', bg: '#3b2a1f', draw(c) {
    const g = c.createLinearGradient(0, 0, 0, 100); g.addColorStop(0, '#4a3322'); g.addColorStop(1, '#2d2018'); c.fillStyle = g; c.fillRect(0, 0, 100, 100);
    c.lineCap = 'round'; [[28, 62], [70, 36], [66, 80]].forEach(([x, y], k) => { for (let i = 0; i < 17; i++) { const a = -Math.PI * 0.95 + (i / 16) * Math.PI * 0.9, l = 17 + (i % 3) * 3; c.strokeStyle = ['#5f9b57', '#88c274', '#3f7a46'][i % 3]; c.lineWidth = 1.8; c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); c.stroke(); }
      c.strokeStyle = '#8a5a35'; c.lineWidth = 3.4; c.beginPath(); c.moveTo(x, y); c.lineTo(x + (k ? 14 : -14), y + 28); c.stroke(); }); } },
  { id: 'sun', name: 'Morning Sun', bg: '#f5d7a0', draw(c) {
    const g = c.createLinearGradient(0, 0, 0, 100); g.addColorStop(0, '#f6c98a'); g.addColorStop(1, '#f4e6c0'); c.fillStyle = g; c.fillRect(0, 0, 100, 100);
    c.strokeStyle = 'rgba(255,255,255,0.55)'; c.lineWidth = 3; for (let i = 0; i < 11; i++) { const a = Math.PI + (i / 10) * Math.PI; c.beginPath(); c.moveTo(50 + Math.cos(a) * 26, 62 + Math.sin(a) * 26); c.lineTo(50 + Math.cos(a) * 62, 62 + Math.sin(a) * 62); c.stroke(); }
    c.fillStyle = '#d9582c'; c.beginPath(); c.arc(50, 62, 22, Math.PI, 0); c.fill();
    [['#6d8a9e', 70, 0.7], ['#4c6b82', 82, 0.4], ['#2f4d63', 92, 0.2]].forEach(([col, y, o], i) => { c.fillStyle = col; c.beginPath(); c.moveTo(-5, 100); c.lineTo(-5, y); for (let x = 0; x <= 105; x += 15) c.lineTo(x, y - 8 - ((x / 15 + i) % 3) * 6); c.lineTo(105, 100); c.fill(); }); } },
  { id: 'turtle', name: 'Honeycomb', bg: '#5b6a2f', draw(c) {
    c.fillStyle = '#4e5c28'; c.fillRect(0, 0, 100, 100); const R = 13;
    for (let row = -1; row < 7; row++) for (let col = -1; col < 6; col++) { const cx = col * R * 1.74 + (row % 2) * R * 0.87, cy = row * R * 1.5 + 8; const hex = (rad) => { c.beginPath(); for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU + Math.PI / 6; const px = cx + Math.cos(a) * rad, py = cy + Math.sin(a) * rad; if (i) c.lineTo(px, py); else c.moveTo(px, py); } c.closePath(); };
      hex(R - 1); c.fillStyle = (row + col) % 2 ? '#d9b04a' : '#e9d28a'; c.fill(); hex(R * 0.55); c.fillStyle = (row + col) % 2 ? '#8c6a2a' : '#b8903c'; c.fill(); } } },
  { id: 'clouds', name: 'Curled Clouds', bg: '#2f7380', draw(c) {
    c.fillStyle = '#2b6c78'; c.fillRect(0, 0, 100, 100); c.lineCap = 'round';
    const cloud = (x, y, s, col) => { c.strokeStyle = col; c.lineWidth = 3.2 * s; c.beginPath(); c.arc(x, y, 8 * s, Math.PI * 0.9, Math.PI * 2.1); c.arc(x + 12 * s, y - 2 * s, 6 * s, Math.PI, Math.PI * 2.2); c.moveTo(x - 8 * s, y + 3 * s); c.bezierCurveTo(x - 16 * s, y + 6 * s, x - 14 * s, y - 8 * s, x - 6 * s, y - 6 * s); c.stroke(); c.beginPath(); c.moveTo(x - 8 * s, y + 8 * s); c.lineTo(x + 22 * s, y + 8 * s); c.stroke(); };
    cloud(24, 30, 1.3, '#f4ead0'); cloud(66, 56, 1.5, '#f3c46c'); cloud(26, 82, 1.1, '#9ed2d0'); cloud(78, 18, 0.9, '#9ed2d0'); } },
  { id: 'fan', name: 'Folding Fan', bg: '#f2dfc6', draw(c) {
    c.fillStyle = '#f2dfc6'; c.fillRect(0, 0, 100, 100); const cols = ['#d9742c', '#e8b84a', '#4f9a82', '#2f6a8c', '#8c5aa0', '#d9742c', '#e8b84a', '#4f9a82'];
    for (let i = 0; i < 8; i++) { const a0 = Math.PI + (i / 8) * Math.PI, a1 = Math.PI + ((i + 1) / 8) * Math.PI; c.beginPath(); c.moveTo(50, 92); c.arc(50, 92, 72, a0, a1); c.closePath(); c.fillStyle = cols[i]; c.fill(); c.strokeStyle = 'rgba(255,248,226,0.7)'; c.lineWidth = 1.2; c.stroke(); }
    c.fillStyle = '#6b3d22'; c.beginPath(); c.arc(50, 92, 8, 0, TAU); c.fill(); c.fillStyle = 'rgba(255,255,255,0.15)'; c.beginPath(); c.arc(50, 92, 28, Math.PI, 0); c.fill(); } },
  { id: 'stars', name: 'Night Stars', bg: '#2d2250', draw(c) {
    const g = c.createLinearGradient(0, 0, 100, 100); g.addColorStop(0, '#3a2c68'); g.addColorStop(1, '#1f1740'); c.fillStyle = g; c.fillRect(0, 0, 100, 100);
    for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) { starP(c, 17 + i * 33 + (j % 2) * 4, 17 + j * 33, 12, 5, 8, (i + j) * 0.2); c.fillStyle = (i + j) % 2 ? '#f4d77a' : '#fff1c0'; c.fill(); }
    c.fillStyle = 'rgba(255,240,200,0.7)'; const r = lcg(7); for (let i = 0; i < 18; i++) c.fillRect(r() * 98, r() * 98, 1.6, 1.6); } },
];

// ---- tile faces -------------------------------------------------------------------------------------------------
const PS = 100;
export function drawPatternFace(c, pat, alpha = 1) {
  const p = PATTERNS[pat] ?? PATTERNS[0];
  c.save(); c.globalAlpha = alpha; c.beginPath(); c.rect(0, 0, PS, PS); c.clip(); p.draw(c);
  // a folded tile: soft creases and a lighter rim so it reads as thick paper rather than a print
  c.strokeStyle = 'rgba(255,255,255,0.35)'; c.lineWidth = 3; c.strokeRect(1.5, 1.5, PS - 3, PS - 3);
  c.strokeStyle = 'rgba(0,0,0,0.20)'; c.lineWidth = 1.4; c.strokeRect(5, 5, PS - 10, PS - 10);
  const g = c.createLinearGradient(0, 0, PS, PS); g.addColorStop(0, 'rgba(255,255,255,0.14)'); g.addColorStop(0.5, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(0,0,0,0.12)'); c.fillStyle = g; c.fillRect(0, 0, PS, PS);
  c.restore();
}
export function drawReverseFace(c) {
  c.save(); c.beginPath(); c.rect(0, 0, PS, PS); c.clip();
  const g = c.createLinearGradient(0, 0, PS, PS); g.addColorStop(0, '#f3e8cb'); g.addColorStop(1, '#e2d3ae'); c.fillStyle = g; c.fillRect(0, 0, PS, PS);
  c.fillStyle = 'rgba(120,90,50,0.09)'; const r = lcg(3); for (let i = 0; i < 70; i++) { c.save(); c.translate(r() * PS, r() * PS); c.rotate(r() * 3); c.fillRect(0, 0, 4 + r() * 8, 0.8); c.restore(); }
  c.strokeStyle = 'rgba(90,64,34,0.34)'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(50, 4); c.lineTo(50, 96); c.moveTo(4, 50); c.lineTo(96, 50); c.stroke();
  c.strokeStyle = 'rgba(255,255,255,0.45)'; c.lineWidth = 1; c.beginPath(); c.moveTo(51.4, 4); c.lineTo(51.4, 96); c.moveTo(4, 51.4); c.lineTo(96, 51.4); c.stroke();
  c.strokeStyle = 'rgba(90,64,34,0.28)'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(4, 4); c.lineTo(30, 30); c.moveTo(96, 4); c.lineTo(70, 30); c.moveTo(4, 96); c.lineTo(30, 70); c.moveTo(96, 96); c.lineTo(70, 70); c.stroke();
  c.strokeStyle = 'rgba(90,64,34,0.34)'; c.lineWidth = 2; c.strokeRect(1, 1, PS - 2, PS - 2);
  c.restore();
}

// A flat tile picture (menus, collection, rules): face-on, with rounded corners and a drop shadow. size = side in px.
export function drawFlatTile(ctx, x, y, size, pat, o = {}) {
  const { reverse = false, alpha = 1, shadow = true, rot = 0, lock = false } = o;
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.globalAlpha = alpha;
  if (shadow) { rr(ctx, -size / 2 + size * 0.03, -size / 2 + size * 0.07, size, size, size * 0.06); ctx.fillStyle = 'rgba(20,10,4,0.38)'; ctx.fill(); }
  ctx.save(); rr(ctx, -size / 2, -size / 2, size, size, size * 0.06); ctx.clip(); ctx.translate(-size / 2, -size / 2); ctx.scale(size / PS, size / PS);
  if (reverse) drawReverseFace(ctx); else drawPatternFace(ctx, pat);
  ctx.restore();
  if (lock) { ctx.fillStyle = 'rgba(20,10,4,0.62)'; rr(ctx, -size / 2, -size / 2, size, size, size * 0.06); ctx.fill(); ctx.fillStyle = '#f3e6c8'; ctx.font = `700 ${Math.round(size * 0.34)}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('?', 0, 0); }
  ctx.restore();
}

// ---- projected tile ---------------------------------------------------------------------------------------------
const FACES = [
  { id: 'bottom', idx: [0, 3, 2, 1] }, { id: 'top', idx: [4, 5, 6, 7] }, { id: 'sv-', idx: [0, 1, 5, 4] },
  { id: 'su+', idx: [1, 2, 6, 5] }, { id: 'sv+', idx: [2, 3, 7, 6] }, { id: 'su-', idx: [3, 0, 4, 7] },
];
const LOCAL = [[-0.5, -0.5, 0], [0.5, -0.5, 0], [0.5, 0.5, 0], [-0.5, 0.5, 0], [-0.5, -0.5, THICK], [0.5, -0.5, THICK], [0.5, 0.5, THICK], [-0.5, 0.5, THICK]];

// Local point of a tile -> world, applying: the pivot (theta about the edge whose outward normal is `lift`), a flight pitch about
// the tile's own x axis, the yaw, the position. `t.z` is the height of the tile's underside when lying (0 on the floor).
export function tileToWorld(t, u, v, w) {
  const th = t.theta || 0;
  if (th > 0 && t.lift) {
    const nx = t.lift.x, ny = t.lift.y, d = u * nx + v * ny + 0.5, tu = u - nx * (d - 0.5), tv = v - ny * (d - 0.5);
    const a = -0.5 + d * Math.cos(th) - w * Math.sin(th);
    u = tu + nx * a; v = tv + ny * a; w = d * Math.sin(th) + w * Math.cos(th) + THICK * (1 - Math.cos(th)) / 2;
  }
  if (t.pitch) {
    const cp = Math.cos(t.pitch), sp = Math.sin(t.pitch), cz = THICK / 2;
    const v2 = v * cp - (w - cz) * sp, w2 = v * sp + (w - cz) * cp + cz; v = v2; w = w2;
  }
  const c = Math.cos(t.yaw), s = Math.sin(t.yaw);
  return { x: t.x + u * c - v * s, y: t.y + u * s + v * c, z: (t.z || 0) + w };
}

const cross = (a, b, c) => { const ux = b.x - a.x, uy = b.y - a.y, uz = b.z - a.z, vx = c.x - a.x, vy = c.y - a.y, vz = c.z - a.z; return { x: uy * vz - uz * vy, y: uz * vx - ux * vz, z: ux * vy - uy * vx }; };

function hull(pts) {
  const p = pts.slice().sort((a, b) => a.x - b.x || a.y - b.y); const cr = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lo = []; for (const q of p) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  const up = []; for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}

// The tile's shadow on the floor (cast by the lamp up and to the left, so it falls right and away).
export function drawTileShadow(ctx, cam, t, strength = 1) {
  const pts = LOCAL.map(([u, v, w]) => { const q = tileToWorld(t, u, v, w); return { x: q.x + q.z * 0.5, y: q.y + q.z * 0.36 }; });
  const h = hull(pts).map((p) => cam.proj(p.x, p.y, 0));
  const lift = Math.min(1, Math.max(...LOCAL.map(([u, v, w]) => tileToWorld(t, u, v, w).z)) / 1.6);
  ctx.save();
  const path = () => { ctx.beginPath(); h.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.closePath(); };
  const k = cam.unit(t.y);
  ctx.filter = 'none';
  ctx.shadowColor = `rgba(24,10,2,${0.5 * strength * (1 - 0.35 * lift)})`; ctx.shadowBlur = FX.soft ? k * (0.1 + 0.28 * lift) : 0;
  ctx.fillStyle = `rgba(24,10,2,${0.30 * strength})`; path(); ctx.fill();
  ctx.shadowBlur = 0; ctx.fillStyle = `rgba(16,6,0,${0.26 * strength * (1 - lift * 0.6)})`; path(); ctx.fill();
  ctx.restore();
}

// One tile: t = { x, y, z, yaw, theta, lift:{x,y}, pitch, pat, alpha }. Draws visible faces back to front.
export function drawTile(ctx, cam, t) {
  const W = LOCAL.map(([u, v, w]) => tileToWorld(t, u, v, w));
  const P = W.map((q) => cam.proj(q.x, q.y, q.z));
  const eye = cam.eye;
  const vis = [];
  for (const f of FACES) {
    const [a, b, c, d] = f.idx.map((i) => W[i]);
    const n = cross(a, b, c), nl = Math.hypot(n.x, n.y, n.z) || 1; n.x /= nl; n.y /= nl; n.z /= nl;
    const cx = (a.x + b.x + c.x + d.x) / 4, cy = (a.y + b.y + c.y + d.y) / 4, cz = (a.z + b.z + c.z + d.z) / 4;
    if (n.x * (eye.x - cx) + n.y * (eye.y - cy) + n.z * (eye.z - cz) <= 0) continue;
    vis.push({ f, n, depth: (cx - eye.x) ** 2 + (cy - eye.y) ** 2 + (cz - eye.z) ** 2 });
  }
  vis.sort((p, q) => q.depth - p.depth);
  ctx.save(); if (t.alpha !== undefined) ctx.globalAlpha = t.alpha;
  for (const { f, n } of vis) {
    const pts = f.idx.map((i) => P[i]);
    const lit = Math.max(0, n.x * LIGHT.x + n.y * LIGHT.y + n.z * LIGHT.z), b = 0.5 + 0.5 * lit;
    const path = () => { ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.closePath(); };
    if (f.id === 'top' || f.id === 'bottom') {
      // whichever big face looks up: the printed side is the tile's own top; the plain side is its underside
      const idx = f.id === 'top' ? { o: 7, xx: 6, yy: 4 } : { o: 3, xx: 2, yy: 0 };
      const o = P[idx.o], px = P[idx.xx], py = P[idx.yy];
      ctx.save(); path(); ctx.clip();
      ctx.transform((px.x - o.x) / PS, (px.y - o.y) / PS, (py.x - o.x) / PS, (py.y - o.y) / PS, o.x, o.y);
      if (f.id === 'top') drawPatternFace(ctx, t.pat); else drawReverseFace(ctx);
      ctx.restore();
      path(); ctx.fillStyle = `rgba(14,6,0,${(1 - b) * 0.75})`; ctx.fill();
      if (lit > 0.7) { path(); ctx.fillStyle = `rgba(255,244,214,${(lit - 0.7) * 0.28})`; ctx.fill(); }
      ctx.strokeStyle = 'rgba(255,248,226,0.30)'; ctx.lineWidth = 1; path(); ctx.stroke();
    } else {
      // the side shows the folded layers
      path(); ctx.fillStyle = '#e6d8b4'; ctx.fill();
      const p0 = pts[0], p1 = pts[1], p3 = pts[3], p2 = pts[2];
      ctx.strokeStyle = 'rgba(120,88,48,0.55)'; ctx.lineWidth = Math.max(0.6, cam.S * 0.0016);
      for (let i = 1; i < 6; i++) { const k = i / 6; ctx.beginPath(); ctx.moveTo(p0.x + (p3.x - p0.x) * k, p0.y + (p3.y - p0.y) * k); ctx.lineTo(p1.x + (p2.x - p1.x) * k, p1.y + (p2.y - p1.y) * k); ctx.stroke(); }
      path(); ctx.fillStyle = `rgba(30,14,2,${(1 - b) * 0.8})`; ctx.fill();
      ctx.strokeStyle = 'rgba(70,44,20,0.5)'; ctx.lineWidth = 1; path(); ctx.stroke();
    }
  }
  ctx.restore();
}

// ---- the floor -------------------------------------------------------------------------------------------------
const YW = 13;
// A paper-screen wall at the far end of the room: warm backlit panels in a dark timber lattice.
function drawWall(ctx, cam, W, H) {
  const P = (x, z) => cam.proj(x, YW, z);
  const top = P(0, 6.5).y, bot = P(0, 0).y;
  const g = ctx.createLinearGradient(0, top, 0, bot); g.addColorStop(0, '#2a1a10'); g.addColorStop(0.5, '#4a2e18'); g.addColorStop(1, '#6b4624');
  ctx.fillStyle = g; ctx.fillRect(0, Math.max(0, top), W, Math.max(0, bot - Math.max(0, top)));
  for (let i = -5; i <= 5; i++) for (let j = 0; j < 2; j++) {
    const x0 = i * 3 - 1.35, x1 = i * 3 + 1.35, z0 = 0.3 + j * 2.9, z1 = z0 + 2.6, a = P(x0, z1), b = P(x1, z0);
    const lit = 0.55 + 0.45 * Math.abs(Math.sin(i * 2.1 + j));
    const pg = ctx.createLinearGradient(0, a.y, 0, b.y); pg.addColorStop(0, `rgba(255,224,160,${0.22 * lit})`); pg.addColorStop(1, `rgba(255,200,120,${0.5 * lit})`);
    ctx.fillStyle = pg; ctx.fillRect(a.x, a.y, b.x - a.x, b.y - a.y);
    ctx.strokeStyle = 'rgba(40,22,10,0.8)'; ctx.lineWidth = Math.max(1, cam.S * 0.0035); ctx.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y);
    ctx.strokeStyle = 'rgba(40,22,10,0.5)'; ctx.lineWidth = Math.max(1, cam.S * 0.0018);
    ctx.beginPath(); for (let k = 1; k < 3; k++) { ctx.moveTo(a.x + ((b.x - a.x) * k) / 3, a.y); ctx.lineTo(a.x + ((b.x - a.x) * k) / 3, b.y); ctx.moveTo(a.x, a.y + ((b.y - a.y) * k) / 3); ctx.lineTo(b.x, a.y + ((b.y - a.y) * k) / 3); } ctx.stroke();
  }
}

export function drawFloor(ctx, cam, W, H, t = 0, glow = { x: 0, y: 2.6 }) {
  const bg = ctx.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#15100d'); bg.addColorStop(1, '#241810');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  drawWall(ctx, cam, W, H);
  const q = (x, y) => cam.proj(x, y, 0);
  const quad = (x0, y0, x1, y1) => { const a = q(x0, y0), b = q(x1, y0), c = q(x1, y1), d = q(x0, y1); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.closePath(); };
  // dark timber around the mat
  const ny = Math.max(-12, cam.nearY); quad(-26, ny, 26, YW); const wg = ctx.createLinearGradient(0, 0, 0, H); wg.addColorStop(0, '#3a2616'); wg.addColorStop(0.6, '#4a301b'); wg.addColorStop(1, '#2c1b0f'); ctx.fillStyle = wg; ctx.fill();
  ctx.lineWidth = 1; for (let i = -12; i <= 12; i++) { const x = i * 1.15; const a = q(x, ny), b = q(x, YW); ctx.strokeStyle = i % 2 ? 'rgba(0,0,0,0.30)' : 'rgba(255,220,170,0.05)'; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
  // the oiled-paper sheet: warm, slightly translucent amber with long fibre strips and a rolled edge
  const m = { x0: MAT.x0 - 0.45, x1: MAT.x1 + 0.45, y0: MAT.y0 - 0.45, y1: MAT.y1 + 0.45 };
  quad(m.x0 - 0.12, m.y0 - 0.12, m.x1 + 0.12, m.y1 + 0.12); ctx.fillStyle = 'rgba(12,6,2,0.55)'; ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = FX.soft ? cam.S * 0.05 : 0; ctx.fill(); ctx.shadowBlur = 0;
  quad(m.x0, m.y0, m.x1, m.y1);
  const sheet = ctx.createLinearGradient(0, cam.proj(0, m.y1, 0).y, 0, cam.proj(0, m.y0, 0).y); sheet.addColorStop(0, '#c88a2c'); sheet.addColorStop(0.55, '#dba548'); sheet.addColorStop(1, '#e9bd62'); ctx.fillStyle = sheet; ctx.fill();
  ctx.save(); quad(m.x0, m.y0, m.x1, m.y1); ctx.clip();
  const r = lcg(11);
  for (let i = 0; i < 26; i++) { const x = m.x0 + r() * (m.x1 - m.x0), a = q(x, m.y0), b = q(x + (r() - 0.5) * 0.4, m.y1); ctx.strokeStyle = r() > 0.5 ? 'rgba(120,70,12,0.16)' : 'rgba(255,230,160,0.16)'; ctx.lineWidth = 1 + r() * 2; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
  for (let i = 0; i < 90; i++) { const x = m.x0 + r() * (m.x1 - m.x0), y = m.y0 + r() * (m.y1 - m.y0), a = q(x, y), b = q(x + 0.2 + r() * 0.3, y + (r() - 0.5) * 0.08); ctx.strokeStyle = 'rgba(110,60,10,0.18)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
  // sheet seams (where two sheets of paper meet)
  for (const sy of [1.2, 3.8]) { const a = q(m.x0, sy), b = q(m.x1, sy); ctx.strokeStyle = 'rgba(100,56,8,0.34)'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); const a2 = q(m.x0, sy + 0.03), b2 = q(m.x1, sy + 0.03); ctx.strokeStyle = 'rgba(255,236,170,0.4)'; ctx.beginPath(); ctx.moveTo(a2.x, a2.y); ctx.lineTo(b2.x, b2.y); ctx.stroke(); }
  // lamp glow
  const g = q(glow.x, glow.y), gr = ctx.createRadialGradient(g.x, g.y, 0, g.x, g.y, cam.S * 0.62);
  gr.addColorStop(0, 'rgba(255,238,180,0.42)'); gr.addColorStop(0.5, 'rgba(255,214,130,0.14)'); gr.addColorStop(1, 'rgba(255,200,110,0)'); ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
  ctx.restore();
  quad(m.x0, m.y0, m.x1, m.y1); ctx.strokeStyle = 'rgba(88,48,10,0.8)'; ctx.lineWidth = 2.4; ctx.stroke();
  ctx.strokeStyle = 'rgba(255,230,160,0.4)'; ctx.lineWidth = 1; quad(m.x0 + 0.05, m.y0 + 0.05, m.x1 - 0.05, m.y1 - 0.05); ctx.stroke();
  // vignette
  const vg = ctx.createRadialGradient(W / 2, H * 0.46, Math.min(W, H) * 0.3, W / 2, H * 0.46, Math.max(W, H) * 0.78); vg.addColorStop(0, 'rgba(10,4,0,0)'); vg.addColorStop(1, 'rgba(10,4,0,0.62)'); ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  void t;
}

// ---- effects (world space) ---------------------------------------------------------------------------------------
// kinds: 0 dust puff, 1 paper fleck, 2 wind ring on the floor, 3 confetti scrap
export function drawFx(ctx, cam, list) {
  for (const p of list) {
    const k = p.t / p.max, a = 1 - k;
    if (p.kind === 2) {
      const rad = p.size * (0.25 + k * 0.9), c = cam.proj(p.x, p.y, 0.01), e = cam.proj(p.x + rad, p.y, 0.01), f = cam.proj(p.x, p.y + rad, 0.01);
      ctx.save(); ctx.strokeStyle = `rgba(255,246,214,${0.7 * a * a})`; ctx.lineWidth = Math.max(1.5, cam.S * 0.007 * a);
      ctx.beginPath(); ctx.ellipse(c.x, c.y, Math.abs(e.x - c.x), Math.abs(f.y - c.y), 0, 0, TAU); ctx.stroke(); ctx.restore();
    } else {
      const q = cam.proj(p.x, p.y, p.z), u = cam.unit(p.y) * p.size;
      ctx.save();
      if (p.kind === 0) { const gr = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, u * (0.6 + k)); gr.addColorStop(0, `rgba(255,236,190,${0.4 * a})`); gr.addColorStop(1, 'rgba(255,236,190,0)'); ctx.fillStyle = gr; ctx.fillRect(q.x - u * 2, q.y - u * 2, u * 4, u * 4); }
      else { ctx.translate(q.x, q.y); ctx.rotate(p.rot + p.t * p.spin); ctx.globalAlpha = Math.min(1, a * 1.6); ctx.fillStyle = p.col; ctx.fillRect(-u * 0.5, -u * 0.3, u, u * 0.6); }
      ctx.restore();
    }
  }
}
export function stepFx(list, dt) {
  for (const p of list) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.vz -= (p.kind === 1 || p.kind === 3 ? 6 : 0) * dt; if (p.z < 0.02 && p.kind !== 2) { p.z = 0.02; p.vz = 0; p.vx *= 0.8; p.vy *= 0.8; } p.vx *= 0.97; p.vy *= 0.97; }
  for (let i = list.length - 1; i >= 0; i--) if (list[i].t >= list[i].max) list.splice(i, 1);
}

// Render quality: blurred soft shadows are costly on high-density touch screens, so main.js turns them off there by default.
export const FX = { soft: true };
