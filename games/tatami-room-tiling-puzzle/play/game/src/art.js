// Drawing of the room, the mats and the seasonal ambience. Pure canvas, no assets. Reads state, never changes it.
import { theme, mix, rgba, rr, txt, F } from './ui.js';
import { badVertices } from './tatami.js';

const fract = (v) => v - Math.floor(v);
const hash = (n) => fract(Math.sin(n * 127.1 + 311.7) * 43758.5453);

// ---- seasonal ambience (a pure function of time: no state, no randomness) -----------------------------------------------------------
export function ambient(ctx, w, h, t, calm = false) {
  const T = theme(), N = calm ? 10 : 24, sea = T.season;
  ctx.save();
  for (let i = 0; i < N; i++) {
    const a = hash(i + 1), b = hash(i + 50), c = hash(i + 99);
    const speed = sea === 'summer' ? 0 : 18 + c * 34, size = 5 + b * 9;
    let x, y, rot = 0;
    if (sea === 'summer') {
      x = a * w + Math.sin(t * 0.25 + i) * 40; y = ((b + Math.sin(t * 0.13 + i * 2) * 0.05) * h) % h;
      const glow = 0.35 + 0.65 * Math.max(0, Math.sin(t * (0.7 + c) + i * 3));
      const g = ctx.createRadialGradient(x, y, 0, x, y, size * 2.6);
      g.addColorStop(0, `rgba(235,255,170,${0.55 * glow})`); g.addColorStop(1, 'rgba(235,255,170,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, size * 2.6, 0, 7); ctx.fill();
      continue;
    }
    y = ((b * h + t * speed) % (h + 40)) - 20;
    x = a * w + Math.sin(t * (0.5 + c) + i * 2) * (sea === 'winter' ? 14 : 30);
    rot = t * (0.6 + c) + i;
    if (sea === 'spring') {
      ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.fillStyle = `rgba(255,${180 + c * 40 | 0},${200 + c * 30 | 0},0.5)`;
      ctx.beginPath(); ctx.ellipse(0, 0, size * 0.9, size * 0.5, 0, 0, 7); ctx.fill(); ctx.restore();
    } else if (sea === 'autumn') {
      ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.fillStyle = `rgba(${220 + c * 30 | 0},${90 + b * 70 | 0},${30 + a * 30 | 0},0.5)`;
      ctx.beginPath(); ctx.moveTo(0, -size); ctx.quadraticCurveTo(size * 0.9, -size * 0.2, 0, size); ctx.quadraticCurveTo(-size * 0.9, -size * 0.2, 0, -size); ctx.fill(); ctx.restore();
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.beginPath(); ctx.arc(x, y, size * 0.35 + 0.8, 0, 7); ctx.fill();
    }
  }
  ctx.restore();
}

// ---- one mat -------------------------------------------------------------------------------------------------------------------------
// (x, y, w, h) is the mat's rectangle. The woven top runs along the long side; cloth borders run along the long edges.
export function drawMat(ctx, x, y, w, h, { given = false, seed = 0, lift = 0, alpha = 1, tint = null, half = false, stand = false } = {}) {
  const T = theme(), inset = Math.min(w, h) * 0.04;
  x += inset; y += inset; w -= 2 * inset; h -= 2 * inset;
  const horiz = half ? !stand : w >= h, sh = Math.min(w, h), r = sh * 0.06, tone = hash(seed + 3);
  ctx.save();
  ctx.globalAlpha = alpha;
  const up = lift * sh * 0.09;
  // soft shadow
  rr(ctx, x + sh * 0.01, y + sh * 0.045 + up * 0.4, w, h, r + 1); ctx.fillStyle = `rgba(0,0,0,${0.28 + lift * 0.1})`; ctx.fill();
  y -= up;
  let base = given ? T.strawDeep : T.straw;
  base = mix(base, tone > 0.5 ? '#ffffff' : '#7a6a20', 0.05 + tone * 0.06);
  if (tint) base = mix(base, tint.c, tint.k);
  // the mat is a thick slab: a darker underside shows below the top face
  const th = sh * 0.045;
  rr(ctx, x, y + th, w, h, r); ctx.fillStyle = mix(base, '#1c1406', 0.55); ctx.fill();
  rr(ctx, x, y + th * 0.5, w, h, r); ctx.fillStyle = mix(base, '#1c1406', 0.35); ctx.fill();
  const g = horiz ? ctx.createLinearGradient(0, y, 0, y + h) : ctx.createLinearGradient(x, 0, x + w, 0);
  g.addColorStop(0, mix(base, '#000000', 0.12)); g.addColorStop(0.5, mix(base, '#ffffff', 0.1)); g.addColorStop(1, mix(base, '#000000', 0.16));
  rr(ctx, x, y, w, h, r); ctx.fillStyle = g; ctx.fill();
  // weave
  ctx.save(); rr(ctx, x, y, w, h, r); ctx.clip();
  const step = Math.max(2.4, sh * 0.075);
  ctx.lineWidth = Math.max(0.7, sh * 0.012);
  ctx.strokeStyle = 'rgba(70,60,20,0.22)'; ctx.beginPath();
  if (horiz) for (let yy = y + step; yy < y + h; yy += step) { ctx.moveTo(x, yy); ctx.lineTo(x + w, yy); }
  else for (let xx = x + step; xx < x + w; xx += step) { ctx.moveTo(xx, y); ctx.lineTo(xx, y + h); }
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,230,0.16)'; ctx.beginPath();
  if (horiz) for (let yy = y + step * 1.5; yy < y + h; yy += step) { ctx.moveTo(x, yy); ctx.lineTo(x + w, yy); }
  else for (let xx = x + step * 1.5; xx < x + w; xx += step) { ctx.moveTo(xx, y); ctx.lineTo(xx, y + h); }
  ctx.stroke();
  // straw fibres: short seeded flecks along the weave
  if (sh > 26) {
    ctx.lineWidth = Math.max(0.6, sh * 0.01);
    for (let i = 0; i < 26; i++) {
      const u = hash(seed * 7 + i * 3.1), v = hash(seed * 5 + i * 1.7 + 9), len = (0.05 + 0.1 * hash(i + seed)) * (horiz ? w : h);
      ctx.strokeStyle = i % 2 ? 'rgba(255,255,225,0.22)' : 'rgba(60,45,10,0.20)'; ctx.beginPath();
      if (horiz) { const px = x + u * (w - len), py = y + v * h; ctx.moveTo(px, py); ctx.lineTo(px + len, py); } else { const px = x + v * w, py = y + u * (h - len); ctx.moveTo(px, py); ctx.lineTo(px, py + len); }
      ctx.stroke();
    }
  }
  // cloth borders on the two long edges, with a satin sheen and a row of stitches
  const bw = Math.max(2, sh * 0.105);
  const sheen = (a, b, c, d, vertical) => { const gg = vertical ? ctx.createLinearGradient(a, 0, a + c, 0) : ctx.createLinearGradient(0, b, 0, b + d); gg.addColorStop(0, mix(T.heri, '#000000', 0.25)); gg.addColorStop(0.45, mix(T.heri, '#ffffff', 0.22)); gg.addColorStop(1, mix(T.heri, '#000000', 0.2)); ctx.fillStyle = gg; ctx.fillRect(a, b, c, d); };
  if (horiz) { sheen(x, y, w, bw, false); sheen(x, y + h - bw, w, bw, false); } else { sheen(x, y, bw, h, true); sheen(x + w - bw, y, bw, h, true); }
  if (sh > 30) {
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = Math.max(0.7, sh * 0.01); ctx.setLineDash([sh * 0.05, sh * 0.05]); ctx.beginPath();
    const o = bw * 0.5;
    if (horiz) { ctx.moveTo(x + r, y + o); ctx.lineTo(x + w - r, y + o); ctx.moveTo(x + r, y + h - o); ctx.lineTo(x + w - r, y + h - o); } else { ctx.moveTo(x + o, y + r); ctx.lineTo(x + o, y + h - r); ctx.moveTo(x + w - o, y + r); ctx.lineTo(x + w - o, y + h - r); }
    ctx.stroke(); ctx.setLineDash([]);
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = Math.max(0.8, sh * 0.012); ctx.beginPath();
  if (horiz) { ctx.moveTo(x, y + bw); ctx.lineTo(x + w, y + bw); ctx.moveTo(x, y + h - bw); ctx.lineTo(x + w, y + h - bw); } else { ctx.moveTo(x + bw, y); ctx.lineTo(x + bw, y + h); ctx.moveTo(x + w - bw, y); ctx.lineTo(x + w - bw, y + h); }
  ctx.stroke();
  // top-left light edge
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = Math.max(1, sh * 0.016); ctx.beginPath(); ctx.moveTo(x + r, y + 0.8); ctx.lineTo(x + w - r, y + 0.8); ctx.stroke();
  ctx.restore();
  rr(ctx, x, y, w, h, r); ctx.lineWidth = Math.max(1, sh * 0.02); ctx.strokeStyle = 'rgba(40,30,10,0.55)'; ctx.stroke();
  if (given) {   // a small stitched diamond marks mats that came with the puzzle
    const cx = x + w / 2, cy = y + h / 2, d = sh * 0.09;
    ctx.beginPath(); ctx.moveTo(cx, cy - d); ctx.lineTo(cx + d, cy); ctx.lineTo(cx, cy + d); ctx.lineTo(cx - d, cy); ctx.closePath();
    ctx.fillStyle = rgba(T.heri, 0.85); ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.stroke();
  }
  ctx.restore();
}

// ---- walls --------------------------------------------------------------------------------------------------------------------------------
function drawWalls(ctx, geo, B) {
  const T = theme(), { x, y, s, cols, rows } = geo, t = s * 0.3;
  const inRoom = (r, c) => r >= 0 && c >= 0 && r < rows && c < cols && B.room[r * cols + c];
  ctx.save();
  const wood = ctx.createLinearGradient(0, geo.y - t, 0, geo.y + geo.h + t);
  wood.addColorStop(0, mix(T.wall, '#ffffff', 0.08)); wood.addColorStop(1, mix(T.wall, '#000000', 0.2));
  ctx.fillStyle = wood;
  for (let r = -1; r <= rows; r++) for (let c = -1; c <= cols; c++) {
    if (inRoom(r, c)) continue;
    const cx = x + c * s, cy = y + r * s;
    const N = inRoom(r - 1, c), S = inRoom(r + 1, c), W = inRoom(r, c - 1), E = inRoom(r, c + 1);
    if (N) ctx.fillRect(cx - (W ? 0 : 0), cy, s, t);
    if (S) ctx.fillRect(cx, cy + s - t, s, t);
    if (W) ctx.fillRect(cx, cy, t, s);
    if (E) ctx.fillRect(cx + s - t, cy, t, s);
    if (!N && !S && !W && !E) {
      if (inRoom(r + 1, c + 1)) ctx.fillRect(cx + s - t, cy + s - t, t, t);
      if (inRoom(r + 1, c - 1)) ctx.fillRect(cx, cy + s - t, t, t);
      if (inRoom(r - 1, c + 1)) ctx.fillRect(cx + s - t, cy, t, t);
      if (inRoom(r - 1, c - 1)) ctx.fillRect(cx, cy, t, t);
    }
  }
  // lit inner lip: a light line along every room edge that faces a wall
  ctx.strokeStyle = rgba(T.wallTop, 0.95); ctx.lineWidth = Math.max(1.5, s * 0.03); ctx.lineCap = 'round'; ctx.beginPath();
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    if (!B.room[r * cols + c]) continue;
    const cx = x + c * s, cy = y + r * s;
    if (!inRoom(r - 1, c)) { ctx.moveTo(cx, cy); ctx.lineTo(cx + s, cy); }
    if (!inRoom(r + 1, c)) { ctx.moveTo(cx, cy + s); ctx.lineTo(cx + s, cy + s); }
    if (!inRoom(r, c - 1)) { ctx.moveTo(cx, cy); ctx.lineTo(cx, cy + s); }
    if (!inRoom(r, c + 1)) { ctx.moveTo(cx + s, cy); ctx.lineTo(cx + s, cy + s); }
  }
  ctx.stroke();
  ctx.restore();
}

// ---- the whole room ----------------------------------------------------------------------------------------------------------------------------
// opts: { fxDrop: Map-like id -> seconds since placed, ghost: {a,b,ok}, marks: {...}, hide: bool (paused), t, showNames, win: seconds }
export function drawRoom(ctx, geo, B, opts = {}) {
  const T = theme(), { s } = geo, t = opts.t ?? 0;
  drawWalls(ctx, geo, B);
  // floor
  for (let i = 0; i < B.n; i++) {
    if (!B.room[i]) continue;
    const r = geo.cell(i);
    ctx.fillStyle = T.floor; ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.strokeStyle = T.floorLine; ctx.lineWidth = Math.max(1, s * 0.016); ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
  }
  // soft shadow the walls throw onto the floor
  {
    const d = s * 0.14, inR = (r, c) => r >= 0 && c >= 0 && r < B.h && c < B.w && B.room[r * B.w + c];
    const strip = (x0, y0, x1, y1, w0, h0) => { const g = ctx.createLinearGradient(x0, y0, x1, y1); g.addColorStop(0, 'rgba(0,0,0,0.38)'); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(Math.min(x0, x1), Math.min(y0, y1), w0, h0); };
    for (let r = 0; r < B.h; r++) for (let c = 0; c < B.w; c++) {
      if (!B.room[r * B.w + c]) continue;
      const cx = geo.x + c * s, cy = geo.y + r * s;
      if (!inR(r - 1, c)) strip(cx, cy, cx, cy + d, s, d);
      if (!inR(r, c - 1)) strip(cx, cy, cx + d, cy, d, s);
      if (!inR(r + 1, c)) strip(cx, cy + s, cx, cy + s - d, s, d);
      if (!inR(r, c + 1)) strip(cx + s, cy, cx + s - d, cy, d, s);
    }
  }
  if (opts.showNames && s >= 40 && !opts.hide) {
    for (let i = 0; i < B.n; i++) {
      if (!B.room[i] || B.cov[i] >= 0) continue;
      const r = geo.cell(i), nm = String.fromCharCode(65 + Math.floor(i / B.w)) + ((i % B.w) + 1);
      txt(ctx, nm, r.x + r.w / 2, r.y + r.h / 2, { size: Math.max(F(17), s * 0.22), weight: 500, color: 'rgba(255,255,255,0.22)', align: 'center' });
    }
  }
  if (opts.hide) return;
  const marks = opts.marks;
  for (const tl of B.tiles) {
    if (!tl) continue;
    const a = geo.cell(tl.a), half = tl.a === tl.b, stand = !half && tl.b === tl.a + B.w, fx = opts.fxDrop?.[tl.id] ?? 99;
    const w = !half && !stand ? 2 * s : s, h = stand ? 2 * s : s;
    let lift = 0, alpha = 1, k = 1;
    if (fx < 0.22) { const u = fx / 0.22; lift = (1 - u) * 1.2; k = 1 + (1 - u) * 0.06; }
    let tint = null;
    if (marks?.tintTiles?.has(tl.id)) tint = marks.tintTiles.get(tl.id);
    const wave = opts.win > 0 ? Math.max(0, Math.sin(t * 5 - (tl.a % B.w + Math.floor(tl.a / B.w)) * 0.7)) : 0;
    if (wave > 0) lift = Math.max(lift, wave * 0.8);
    ctx.save();
    if (k !== 1) { const cx = a.x + w / 2, cy = a.y + h / 2; ctx.translate(cx, cy); ctx.scale(k, k); ctx.translate(-cx, -cy); }
    drawMat(ctx, a.x, a.y, w, h, { given: tl.given, seed: tl.a, lift, alpha, tint, half, stand });
    ctx.restore();
  }
  // ghost mat while a finger is down
  if (opts.ghost) {
    const g = opts.ghost, a = geo.cell(g.a), half = g.a === g.b, stand = !half && g.b === g.a + B.w;
    drawMat(ctx, a.x, a.y, !half && !stand ? 2 * s : s, stand ? 2 * s : s, { alpha: 0.62, half, stand, tint: g.ok ? { c: '#ffffff', k: 0.2 } : { c: '#ff4a3a', k: 0.5 } });
  }
  // hint marks
  if (marks) drawMarks(ctx, geo, B, marks, t);
  // four-corner points
  if (opts.showBad !== false) {
    const bad = opts.bad ?? badVertices(B);
    for (const v of bad) {
      const px = geo.x + v.c * s, py = geo.y + v.r * s, pulse = 0.5 + 0.5 * Math.sin(t * 6);
      const g = ctx.createRadialGradient(px, py, 0, px, py, s * 0.42);
      g.addColorStop(0, `rgba(255,60,50,${0.55 + 0.2 * pulse})`); g.addColorStop(1, 'rgba(255,60,50,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(px, py, s * 0.42, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.arc(px, py, s * 0.13, 0, 7); ctx.fillStyle = '#ff3b30'; ctx.fill(); ctx.lineWidth = Math.max(1.5, s * 0.03); ctx.strokeStyle = '#fff'; ctx.stroke();
    }
  }
}

function drawMarks(ctx, geo, B, m, t) {
  const T = theme(), s = geo.s, pulse = 0.5 + 0.5 * Math.sin(t * 5);
  if (m.cells) for (const c of m.cells) {
    const r = geo.cell(c);
    ctx.fillStyle = rgba(T.accent, 0.16 + 0.12 * pulse); ctx.fillRect(r.x, r.y, r.w, r.h);
    rr(ctx, r.x + 2, r.y + 2, r.w - 4, r.h - 4, s * 0.1); ctx.lineWidth = Math.max(2, s * 0.05); ctx.strokeStyle = T.accent; ctx.stroke();
  }
  if (m.answer) {
    const g = m.answer, a = geo.cell(g.a), half = g.a === g.b, stand = !half && g.b === g.a + B.w;
    const w = !half && !stand ? 2 * s : s, h = stand ? 2 * s : s;
    rr(ctx, a.x + 3, a.y + 3, w - 6, h - 6, s * 0.1); ctx.fillStyle = rgba(T.good, 0.26 + 0.14 * pulse); ctx.fill();
    ctx.setLineDash([s * 0.14, s * 0.1]); ctx.lineWidth = Math.max(2, s * 0.05); ctx.strokeStyle = T.good; ctx.stroke(); ctx.setLineDash([]);
  }
  if (m.wrong) {
    const g = m.wrong, a = geo.cell(g.a), half = g.a === g.b, stand = !half && g.b === g.a + B.w;
    const w = !half && !stand ? 2 * s : s, h = stand ? 2 * s : s;
    rr(ctx, a.x + 2, a.y + 2, w - 4, h - 4, s * 0.1); ctx.fillStyle = `rgba(255,70,60,${0.22 + 0.15 * pulse})`; ctx.fill();
    ctx.lineWidth = Math.max(2.5, s * 0.06); ctx.strokeStyle = T.err; ctx.stroke();
  }
  if (m.points) for (const v of m.points) {
    const px = geo.x + v.c * s, py = geo.y + v.r * s;
    ctx.beginPath(); ctx.arc(px, py, s * (0.17 + 0.04 * pulse), 0, 7); ctx.fillStyle = 'rgba(255,59,48,0.9)'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; ctx.stroke();
  }
}

// ---- small room for figures, title and result ------------------------------------------------------------------------------------------------
// Draws the pieces of a tiny room into `rect`. spec = { cols, rows, room?: 0/1[], tiles: [{a,b,given?}], points?: [{r,c}], okPoints?: [{r,c}] }
export function drawMini(ctx, rect, spec, { t = 0, fxDrop = {} } = {}) {
  const cols = spec.cols, rows = spec.rows, s = Math.min(rect.w / (cols + 0.6), rect.h / (rows + 0.6));
  const geo = { x: rect.x + (rect.w - cols * s) / 2, y: rect.y + (rect.h - rows * s) / 2, s, cols, rows, w: cols * s, h: rows * s };
  geo.cell = (i) => ({ x: geo.x + (i % cols) * s, y: geo.y + Math.floor(i / cols) * s, w: s, h: s });
  const room = spec.room ?? new Array(cols * rows).fill(1);
  const B = { w: cols, h: rows, n: cols * rows, room, cov: new Int16Array(cols * rows).fill(-1), tiles: [] };
  spec.tiles.forEach((tl, i) => { B.tiles.push({ a: tl.a, b: tl.b, id: i, given: !!tl.given }); B.cov[tl.a] = i; B.cov[tl.b] = i; });
  drawRoom(ctx, geo, B, { t, bad: spec.points ?? [], fxDrop });
  if (spec.okPoints) for (const v of spec.okPoints) {
    const px = geo.x + v.c * s, py = geo.y + v.r * s;
    ctx.beginPath(); ctx.arc(px, py, s * 0.15, 0, 7); ctx.fillStyle = '#34c98a'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; ctx.stroke();
  }
  return geo;
}
