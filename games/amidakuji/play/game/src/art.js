// Drawing of the ladder, lanterns, bowls and trails. Pure drawing: reads geometry, never changes game state.
import { theme, LAMP, mix, rgba, rr, NUM, UI, CJK } from './ui.js';
import { idx } from './engine.js';
import { v3, rec, recording } from './v3.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const hash = (a, b) => { let h = (Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x7f4a7c15, 0xc2b2ae35)) >>> 0; h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d) >>> 0; h ^= h >>> 12; return (h >>> 0) / 4294967296; };

// ---- paths ---------------------------------------------------------------------------------------------------------------------------------
// Waypoints of a lantern travelling down its route (rt = line index after each row). w = time weight of the step ending at the point.
export function waypoints(geo, rt) {
  const { xs, ys, tokenY, bowlY, rows } = geo;
  let c = rt[0];
  const pts = [{ x: xs[c], y: tokenY, w: 0 }];
  for (let r = 0; r < rows; r++) {
    pts.push({ x: xs[c], y: ys[r], w: r === 0 ? 1.3 : 1 });
    if (rt[r + 1] !== c) { c = rt[r + 1]; pts.push({ x: xs[c], y: ys[r], w: 0.6 }); }
  }
  pts.push({ x: xs[c], y: bowlY, w: 1.3 });
  return pts;
}
export const pathLength = (pts) => pts.reduce((a, p) => a + p.w, 0);
// Position after travelling s weight units; also returns the index of the last waypoint passed.
export function samplePath(pts, s) {
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const w = pts[i].w;
    if (s <= acc + w || i === pts.length - 1) {
      const f = w > 0 ? clamp((s - acc) / w, 0, 1) : 1, a = pts[i - 1], b = pts[i], e = f * f * (3 - 2 * f) * 0.35 + f * 0.65;
      return { x: a.x + (b.x - a.x) * e, y: a.y + (b.y - a.y) * e, i };
    }
    acc += w;
  }
  const l = pts[pts.length - 1];
  return { x: l.x, y: l.y, i: pts.length - 1 };
}

export function trail(ctx, pts, upTo, color, width, alpha = 1) {
  if (upTo <= 0) return;
  if (recording()) { v3.trails.push({ pts, upTo, color, width, alpha }); return; }
  ctx.save();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  let acc = 0;
  ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) {
    const w = pts[i].w;
    if (acc + w <= upTo) { ctx.lineTo(pts[i].x, pts[i].y); acc += w; continue; }
    const f = w > 0 ? clamp((upTo - acc) / w, 0, 1) : 1;
    ctx.lineTo(pts[i - 1].x + (pts[i].x - pts[i - 1].x) * f, pts[i - 1].y + (pts[i].y - pts[i - 1].y) * f);
    break;
  }
  ctx.globalAlpha = alpha * 0.28; ctx.lineWidth = width * 2.6; ctx.strokeStyle = color; ctx.stroke();
  ctx.globalAlpha = alpha; ctx.lineWidth = width; ctx.strokeStyle = color; ctx.stroke();
  ctx.restore();
}

// ---- lantern and bowl ------------------------------------------------------------------------------------------------------------------------
// state: 'idle' | 'lit' | 'home' | 'wrong' | 'dim'. label: the number on it. sway: radians.
export function lantern(ctx, cx, cy, r, colorIdx, { label = '', state = 'idle', glow = 0, sway = 0, scale = 1, flat = false } = {}) {
  const T = theme(), col = LAMP[colorIdx % LAMP.length], dim = state === 'dim';
  const w = r * 0.92 * scale, h = r * 1.06 * scale;
  if (recording()) {
    v3.lanterns.push({ x: cx, y: cy, r, color: colorIdx % LAMP.length, label, state, glow, sway, scale });
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(sway); if (dim) ctx.globalAlpha = 0.5;
    if (label !== '') {
      ctx.font = `400 ${Math.max(10, r * 0.74)}px ${NUM}, ${CJK}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(2, r * 0.14); ctx.strokeStyle = rgba(col[2], 0.85); ctx.strokeText(String(label), 0, r * 0.04);
      ctx.fillStyle = '#fff8e6'; ctx.fillText(String(label), 0, r * 0.04);
    }
    if (state === 'wrong') { ctx.lineWidth = r * 0.14; ctx.strokeStyle = T.err; ctx.beginPath(); ctx.moveTo(-r * 0.5, -r * 0.5); ctx.lineTo(r * 0.5, r * 0.5); ctx.moveTo(r * 0.5, -r * 0.5); ctx.lineTo(-r * 0.5, r * 0.5); ctx.stroke(); }
    ctx.restore();
    return;
  }
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(sway);
  if (dim) ctx.globalAlpha = 0.5;
  if (!flat && (glow > 0 || state === 'lit' || state === 'home')) {
    const g = ctx.createRadialGradient(0, 0, r * 0.2, 0, 0, r * 2.4);
    const a = state === 'home' ? 0.55 : 0.22 + glow * 0.4;
    g.addColorStop(0, rgba(col[0], a)); g.addColorStop(1, rgba(col[0], 0));
    ctx.fillStyle = g; ctx.fillRect(-r * 2.4, -r * 2.4, r * 4.8, r * 4.8);
  }
  // cord and caps
  ctx.lineWidth = Math.max(1.5, r * 0.07); ctx.strokeStyle = T.ink; ctx.beginPath(); ctx.moveTo(0, -h - r * 0.3); ctx.lineTo(0, -h); ctx.stroke();
  const cap = (y, hh) => { rr(ctx, -w * 0.52, y, w * 1.04, hh, hh * 0.35); ctx.fillStyle = '#2a1a10'; ctx.fill(); };
  cap(-h - r * 0.12, r * 0.2);
  // body
  ctx.beginPath();
  ctx.moveTo(-w * 0.48, -h);
  ctx.bezierCurveTo(-w * 1.18, -h * 0.45, -w * 1.18, h * 0.45, -w * 0.48, h);
  ctx.lineTo(w * 0.48, h);
  ctx.bezierCurveTo(w * 1.18, h * 0.45, w * 1.18, -h * 0.45, w * 0.48, -h);
  ctx.closePath();
  const g2 = ctx.createRadialGradient(-w * 0.3, -h * 0.35, r * 0.1, 0, 0, r * 1.5);
  g2.addColorStop(0, col[0]); g2.addColorStop(0.5, col[1]); g2.addColorStop(1, col[2]);
  ctx.fillStyle = flat ? col[1] : g2; ctx.fill();
  ctx.lineWidth = Math.max(1, r * 0.05); ctx.strokeStyle = rgba(col[2], 0.9); ctx.stroke();
  // ribs
  if (!flat) {
    ctx.save(); ctx.clip();
    ctx.lineWidth = Math.max(1, r * 0.045); ctx.strokeStyle = rgba(col[2], 0.55);
    for (let k = -2; k <= 2; k++) { const y = (k / 3) * h; ctx.beginPath(); ctx.ellipse(0, y, w * 1.3, r * 0.12, 0, 0, Math.PI); ctx.stroke(); }
    ctx.restore();
  }
  cap(h - r * 0.08, r * 0.2);
  // tassel
  ctx.lineWidth = Math.max(1.5, r * 0.06); ctx.strokeStyle = '#f3d27a'; ctx.beginPath(); ctx.moveTo(0, h + r * 0.12); ctx.lineTo(0, h + r * 0.4); ctx.stroke();
  // label
  if (label !== '') {
    ctx.font = `400 ${Math.max(10, r * 0.78)}px ${NUM}, ${CJK}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillText(String(label), 0, r * 0.04 + r * 0.05);
    ctx.fillStyle = '#fff8e6'; ctx.fillText(String(label), 0, r * 0.04);
  }
  if (state === 'wrong') { ctx.lineWidth = r * 0.14; ctx.strokeStyle = T.err; ctx.beginPath(); ctx.moveTo(-r * 0.5, -r * 0.5); ctx.lineTo(r * 0.5, r * 0.5); ctx.moveTo(r * 0.5, -r * 0.5); ctx.lineTo(-r * 0.5, r * 0.5); ctx.stroke(); }
  ctx.restore();
}

export function bowl(ctx, cx, cy, r, colorIdx, { label = '', state = 'idle', pulse = 0, flat = false } = {}) {
  const T = theme(), col = LAMP[colorIdx % LAMP.length], w = r * 1.05, h = r * 0.8;
  if (recording()) {
    v3.bowls.push({ x: cx, y: cy, r, color: colorIdx % LAMP.length, label, state, pulse });
    ctx.save(); ctx.translate(cx, cy);
    if (label !== '') {
      ctx.font = `400 ${Math.max(10, r * 0.6)}px ${NUM}, ${CJK}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(2, r * 0.12); ctx.strokeStyle = 'rgba(30,12,4,0.8)'; ctx.strokeText(String(label), 0, h * 0.5);
      ctx.fillStyle = '#fff8e6'; ctx.fillText(String(label), 0, h * 0.5);
    }
    if (state === 'wrong') { ctx.lineWidth = r * 0.12; ctx.strokeStyle = T.err; ctx.beginPath(); ctx.moveTo(-r * 0.4, h * 0.1); ctx.lineTo(r * 0.4, h * 0.75); ctx.moveTo(r * 0.4, h * 0.1); ctx.lineTo(-r * 0.4, h * 0.75); ctx.stroke(); }
    ctx.restore();
    return;
  }
  ctx.save();
  ctx.translate(cx, cy);
  if (state === 'home' || pulse > 0) {
    const g = ctx.createRadialGradient(0, 0, r * 0.3, 0, 0, r * 2.2), a = state === 'home' ? 0.5 : pulse * 0.5;
    g.addColorStop(0, rgba('#ffd45a', a)); g.addColorStop(1, rgba('#ffd45a', 0));
    ctx.fillStyle = g; ctx.fillRect(-r * 2.2, -r * 2.2, r * 4.4, r * 4.4);
  }
  // body
  ctx.beginPath();
  ctx.moveTo(-w, -h * 0.35);
  ctx.bezierCurveTo(-w * 0.95, h * 0.9, -w * 0.4, h, 0, h);
  ctx.bezierCurveTo(w * 0.4, h, w * 0.95, h * 0.9, w, -h * 0.35);
  ctx.closePath();
  const g2 = ctx.createLinearGradient(0, -h, 0, h);
  g2.addColorStop(0, T.dark ? '#3b2a22' : '#6b4a35'); g2.addColorStop(1, T.dark ? '#140c09' : '#2b1a10');
  ctx.fillStyle = flat ? '#2b1a10' : g2; ctx.fill();
  // coloured band
  ctx.save(); ctx.clip();
  ctx.fillStyle = col[1]; ctx.fillRect(-w, -h * 0.35, w * 2, h * 0.5);
  ctx.fillStyle = rgba(col[0], 0.5); ctx.fillRect(-w, -h * 0.35, w * 2, h * 0.14);
  ctx.restore();
  // rim
  ctx.beginPath(); ctx.ellipse(0, -h * 0.35, w, h * 0.3, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#1b0f0a'; ctx.fill(); ctx.lineWidth = Math.max(1.5, r * 0.08); ctx.strokeStyle = col[0]; ctx.stroke();
  if (label !== '') {
    ctx.font = `400 ${Math.max(10, r * 0.62)}px ${NUM}, ${CJK}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff8e6'; ctx.fillText(String(label), 0, h * 0.42);
  }
  if (state === 'wrong') { ctx.lineWidth = r * 0.12; ctx.strokeStyle = T.err; ctx.beginPath(); ctx.moveTo(-r * 0.4, h * 0.1); ctx.lineTo(r * 0.4, h * 0.75); ctx.moveTo(r * 0.4, h * 0.1); ctx.lineTo(-r * 0.4, h * 0.75); ctx.stroke(); }
  ctx.restore();
}

// A letter slip (for Draw Lots): small folded paper with text; `hidden` shows the paper fold.
export function slip(ctx, cx, cy, w, h, text, { hidden = false, accent = '#f2c35b', size = 20, wrap } = {}) {
  const T = theme();
  ctx.save();
  rr(ctx, cx - w / 2, cy - h / 2, w, h, Math.min(12, h * 0.2));
  ctx.fillStyle = hidden ? mix(T.paper, T.bg1, 0.15) : T.paper; ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = hidden ? T.paperLine : accent; ctx.stroke();
  if (hidden) {
    ctx.strokeStyle = T.paperLine; ctx.lineWidth = 1.5;
    for (let k = 1; k < 4; k++) { ctx.beginPath(); ctx.moveTo(cx - w / 2 + 6, cy - h / 2 + (h * k) / 4); ctx.lineTo(cx + w / 2 - 6, cy - h / 2 + (h * k) / 4); ctx.stroke(); }
  } else if (text) {
    const lines = wrap ? wrap(text, w - 10, size) : [text];
    ctx.font = `600 ${size}px ${UI}`; ctx.fillStyle = T.text; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    lines.forEach((ln, i) => ctx.fillText(ln, cx, cy + (i - (lines.length - 1) / 2) * size * 1.12));
  }
  ctx.restore();
}

// ---- the ladder -------------------------------------------------------------------------------------------------------------------------------
// Lines as ink strokes with a faint width variation; rungs as brush strokes. cells: 0/1/2. o.fade fades the whole ladder (paper).
export function ladder(ctx, geo, cells, { slots = false, hl = null, cursor = null, popped = null, dimLines = false, mark = null, lineAlpha = 1 } = {}) {
  if (recording()) { v3.ladders.push({ geo, cells, slots, hl, cursor, popped, dimLines, mark, lineAlpha }); return; }
  const T = theme(), { n, rows, xs, ys, yTop, yBot, sp, rowGap } = geo;
  const lw = clamp(sp * 0.045, 3, 7), rw = clamp(rowGap * 0.2, 3.5, 8);
  ctx.save();
  ctx.lineCap = 'round';
  ctx.globalAlpha = lineAlpha;
  // vertical lines
  for (let i = 0; i < n; i++) {
    const x = xs[i];
    ctx.strokeStyle = T.dark ? 'rgba(0,0,0,0.35)' : 'rgba(0,0,0,0.12)'; ctx.lineWidth = lw + 4;
    ctx.beginPath(); ctx.moveTo(x + 1.5, yTop); ctx.lineTo(x + 1.5, yBot); ctx.stroke();
    ctx.strokeStyle = dimLines ? T.inkDim : T.ink; ctx.lineWidth = lw;
    ctx.beginPath(); ctx.moveTo(x, yTop - 2); ctx.lineTo(x, yBot + 2); ctx.stroke();
  }
  // slots (small dots where a rung may go)
  if (slots) {
    ctx.fillStyle = T.slot;
    for (let r = 0; r < rows; r++) for (let g = 0; g < n - 1; g++) {
      if (cells[idx(n, r, g)]) continue;
      ctx.beginPath(); ctx.arc((xs[g] + xs[g + 1]) / 2, ys[r], clamp(rowGap * 0.07, 2.2, 4.5), 0, 7); ctx.fill();
    }
  }
  if (hl) {   // a hint ring at a slot
    const x = (xs[hl.g] + xs[hl.g + 1]) / 2, y = ys[hl.r];
    ctx.strokeStyle = hl.kind === 'remove' ? T.err : T.accent; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.ellipse(x, y, sp * 0.4, Math.max(rowGap * 0.42, 12), 0, 0, 7); ctx.stroke();
    ctx.globalAlpha = 0.25 * lineAlpha; ctx.fillStyle = hl.kind === 'remove' ? T.err : T.accent; ctx.fill(); ctx.globalAlpha = lineAlpha;
  }
  if (cursor) {
    const x = (xs[cursor.g] + xs[cursor.g + 1]) / 2, y = ys[cursor.r];
    ctx.strokeStyle = T.text; ctx.lineWidth = 2; ctx.setLineDash([6, 6]);
    ctx.beginPath(); ctx.ellipse(x, y, sp * 0.36, Math.max(rowGap * 0.38, 10), 0, 0, 7); ctx.stroke(); ctx.setLineDash([]);
  }
  // rungs
  for (let r = 0; r < rows; r++) for (let g = 0; g < n - 1; g++) {
    const v = cells[idx(n, r, g)];
    if (!v) continue;
    const x0 = xs[g], x1 = xs[g + 1], y = ys[r], j = (hash(r * 31 + g, n) - 0.5) * rw * 0.5;
    const pop = popped && popped[idx(n, r, g)] !== undefined ? clamp(popped[idx(n, r, g)] / 0.25, 0, 1) : 1;
    ctx.save();
    ctx.translate((x0 + x1) / 2, y); ctx.scale(1, 0.4 + 0.6 * pop); ctx.translate(-(x0 + x1) / 2, -y);
    ctx.strokeStyle = T.dark ? 'rgba(0,0,0,0.35)' : 'rgba(0,0,0,0.12)'; ctx.lineWidth = rw + 3;
    ctx.beginPath(); ctx.moveTo(x0, y + 1.5); ctx.lineTo(x1, y + 1.5 + j); ctx.stroke();
    ctx.strokeStyle = v === 1 ? T.fixed : T.rung; ctx.lineWidth = rw;
    ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y + j); ctx.stroke();
    if (v === 1) {   // fixed rungs carry a small knot at each end
      ctx.fillStyle = T.dark ? '#3a3050' : '#fbf5e4'; ctx.strokeStyle = T.fixed; ctx.lineWidth = Math.max(1.5, rw * 0.4);
      for (const x of [x0, x1]) { ctx.beginPath(); ctx.arc(x, y + (x === x1 ? j : 0), rw * 0.9, 0, 7); ctx.fill(); ctx.stroke(); }
    }
    ctx.restore();
  }
  if (mark) {
    ctx.strokeStyle = T.accent; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(xs[mark] - sp * 0.2, yTop); ctx.lineTo(xs[mark] + sp * 0.2, yTop); ctx.stroke();
  }
  ctx.restore();
}

// Rope-and-rod: the little bar the lanterns hang from.
export function hangerBar(ctx, geo) {
  if (recording()) { v3.bars.push({ geo }); return; }
  const T = theme(), { xs, tokenY, tr } = geo, y = tokenY - tr * 1.55;
  const x0 = xs[0] - tr * 1.1, x1 = xs[xs.length - 1] + tr * 1.1;
  ctx.save();
  rr(ctx, x0, y - 5, x1 - x0, 10, 5);
  ctx.fillStyle = T.dark ? '#5b4630' : '#6b4a35'; ctx.fill();
  ctx.restore();
}

// Paper strip under the bowls (Draw Lots, hides the slips).
export function paperFold(ctx, geo, { open = 0 } = {}) {
  const T = theme(), { xs, bowlY, tr, sp } = geo;
  const ar = geo.area, x0 = Math.max(ar ? ar.x : -1e9, xs[0] - sp * 0.55), x1 = Math.min(ar ? ar.x + ar.w : 1e9, xs[xs.length - 1] + sp * 0.55), y = bowlY - tr * 1.1, h = tr * 2.6 * (1 - open * 0.6);
  ctx.save();
  rr(ctx, x0, y, x1 - x0, h, 12);
  ctx.fillStyle = T.paper; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = T.paperLine; ctx.stroke();
  ctx.strokeStyle = T.paperLine; ctx.lineWidth = 1.2; ctx.setLineDash([8, 8]);
  ctx.beginPath(); ctx.moveTo(x0 + 10, y + h / 2); ctx.lineTo(x1 - 10, y + h / 2); ctx.stroke(); ctx.setLineDash([]);
  ctx.restore();
}

// ---- documentation figures ----------------------------------------------------------------------------------------------------------------
// Each figure is a tiny real ladder drawn with the game's own pieces.
export function figure(ctx, r, kind, t) {
  rec.off++;
  try { figureInner(ctx, r, kind, t); } finally { rec.off--; }
}
function figureInner(ctx, r, kind, t) {
  const T = theme();
  ctx.save();
  rr(ctx, r.x, r.y, r.w, r.h, 20); ctx.fillStyle = T.dark ? 'rgba(0,0,0,0.28)' : 'rgba(60,40,10,0.07)'; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = T.line; ctx.stroke();
  ctx.beginPath(); ctx.rect(r.x + 2, r.y + 2, r.w - 4, r.h - 4); ctx.clip();
  const FIG = {
    trace: { n: 4, rows: 5, cells: { 0: [[1, 0], [3, 1]], 1: [[2, 2]] }, from: 0, labels: true },
    rungs: { n: 3, rows: 4, cells: { 1: [[1, 0]], 2: [[2, 1]] }, from: 1, labels: true, swap: [1, 0] },
    swap: { n: 2, rows: 3, cells: { 1: [[1, 0]] }, from: 0, labels: true, swap: [1, 0] },
    build: { n: 4, rows: 6, cells: { 1: [[0, 0], [3, 2]], 2: [[2, 1], [4, 0]] }, from: -1, labels: true, slots: true },
    budget: { n: 3, rows: 5, cells: { 1: [[1, 0]], 2: [[3, 1]] }, from: -1, labels: true, slots: true },
    follow: { n: 5, rows: 6, cells: { 1: [[0, 0], [1, 2], [3, 3], [4, 1]] }, from: 1, labels: false, ask: true },
    lots: { n: 4, rows: 6, cells: { 1: [[1, 0], [2, 2], [4, 1]], 2: [[3, 1]] }, from: -1, labels: true, fold: true },
    ink: { n: 4, rows: 5, cells: { 1: [[1, 0], [3, 2]], 2: [[2, 1]] }, from: -1, labels: false, slots: true },
  }[kind] ?? null;
  if (FIG) {
    const geo = ladderGeoFor(r, FIG.n, FIG.rows);
    const cells = new Array(FIG.rows * (FIG.n - 1)).fill(0);
    for (const v of Object.keys(FIG.cells)) for (const [row, g] of FIG.cells[v]) cells[row * (FIG.n - 1) + g] = Number(v);
    ladder(ctx, geo, cells, { slots: !!FIG.slots });
    if (FIG.fold) paperFold(ctx, geo);
    const used = new Set();
    // paths
    const rtOf = (s) => { const out = [s]; let p = s; for (let k = 0; k < FIG.rows; k++) { if (p < FIG.n - 1 && cells[k * (FIG.n - 1) + p]) p++; else if (p > 0 && cells[k * (FIG.n - 1) + p - 1]) p--; out.push(p); } return out; };
    if (FIG.from >= 0) {
      const rt = rtOf(FIG.from), pts = waypoints(geo, rt), len = pathLength(pts), s = ((t * 0.9) % (len + 2)) ;
      trail(ctx, pts, Math.min(s, len), LAMP[FIG.from][1], Math.max(3, geo.tr * 0.2), 1);
    }
    for (let i = 0; i < FIG.n; i++) {
      const dim = FIG.ask && i !== FIG.from;
      lantern(ctx, geo.xs[i], geo.tokenY, geo.tr, i, { label: FIG.labels || (FIG.ask && i === FIG.from) ? i + 1 : '', state: dim ? 'dim' : 'idle', flat: false });
      if (!FIG.fold) bowl(ctx, geo.xs[i], geo.bowlY, geo.tr * 0.9, FIG.ask ? i : i, { label: FIG.labels ? i + 1 : '' });
      used.add(i);
    }
  }
  ctx.restore();
}
function ladderGeoFor(r, n, rows) {
  // a light copy of ladderGeo that does not depend on layout.js (avoids a cycle): same proportions
  const sp = Math.max(24, Math.min(110, (r.w - 90) / Math.max(1, n - 1))), tr = clamp(sp * 0.36, 14, 38);
  const topZone = tr * 3.2, botZone = tr * 2.5, avail = r.h - topZone - botZone - 16, rowGap = Math.max(16, Math.min(70, avail / (rows + 0.4)));
  const lh = rowGap * (rows + 0.4), y0 = r.y + Math.max(8, (r.h - topZone - lh - botZone) / 2);
  const x0 = r.x + (r.w - sp * (n - 1)) / 2;
  const xs = Array.from({ length: n }, (_, i) => x0 + i * sp), yTop = y0 + topZone, yBot = yTop + lh;
  return { n, rows, sp, tr, xs, ys: Array.from({ length: rows }, (_, k) => yTop + (k + 0.7) * rowGap), yTop, yBot, rowGap, tokenY: yTop - tr * 1.35, bowlY: yBot + tr * 1.35 };
}
export { hash };
