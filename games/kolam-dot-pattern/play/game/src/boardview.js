// Drawing a Kolam board: the floor patch, faint rings, dots, gap marks and the glowing powder line. Reads what it is given, changes nothing.
import { arcCurve, loopSeq } from './board.js';
import { alpha, clamp01, rr } from './art.js';

// Where the board sits: scale S (pixels per dot spacing) and the offset so the board is centred in `area`.
export function boardGeo(B, area, pad = 30) {
  const bw = B.bounds.w, bh = B.bounds.h;
  const S = Math.max(14, Math.min((area.w - pad * 2) / bw, (area.h - pad * 2) / bh, B.dots.length <= 12 ? 150 : 112));
  return { S, ox: area.x + area.w / 2 - B.cx * S, oy: area.y + area.h / 2 - B.cy * S, area };
}
export const toScreen = (g, x, y) => [g.ox + x * g.S, g.oy + y * g.S];
export const toUnit = (g, px, py) => [(px - g.ox) / g.S, (py - g.oy) / g.S];

// ---- curve helpers (unit coordinates, 8 numbers)
export const reverse = (c) => [c[6], c[7], c[4], c[5], c[2], c[3], c[0], c[1]];
export function front(c, t) { // the part of the curve from 0 to t
  const l = (a, b) => a + (b - a) * t;
  const x01 = l(c[0], c[2]), y01 = l(c[1], c[3]), x12 = l(c[2], c[4]), y12 = l(c[3], c[5]), x23 = l(c[4], c[6]), y23 = l(c[5], c[7]);
  const x012 = l(x01, x12), y012 = l(y01, y12), x123 = l(x12, x23), y123 = l(y12, y23);
  return [c[0], c[1], x01, y01, x012, y012, l(x012, x123), l(y012, y123)];
}
const part = (c, a, b) => { // [a, b] of the curve
  if (b <= a) return null;
  const f = b >= 1 ? c : front(c, b);
  if (a <= 0) return f;
  const r = reverse(f); // from b back to 0; take its front (1 - a / b) then reverse
  return reverse(front(r, 1 - a / b));
};

// Builds one path through seq = [{ c, dir }] for the length range [a, b] (in arcs). Does not stroke.
export function linePath(ctx, g, seq, a, b) {
  ctx.beginPath();
  const n = seq.length;
  let lx = 1e9, ly = 1e9;
  const X = (x) => g.ox + x * g.S, Y = (y) => g.oy + y * g.S;
  for (let i = Math.max(0, Math.floor(a)); i < n && i < b; i++) {
    const s0 = Math.max(a - i, 0), s1 = Math.min(b - i, 1);
    const full = seq[i].dir === 1 ? reverse(seq[i].c) : seq[i].c;
    const c = part(full, s0, s1);
    if (!c) continue;
    if (Math.abs(c[0] - lx) + Math.abs(c[1] - ly) > 1e-4) ctx.moveTo(X(c[0]), Y(c[1]));
    ctx.bezierCurveTo(X(c[2]), Y(c[3]), X(c[4]), Y(c[5]), X(c[6]), Y(c[7]));
    lx = c[6]; ly = c[7];
  }
}

// The powder line: soft halo, body and bright core. Stroke the current path in layers.
export function powder(ctx, th, w, k = 1, core = 1) {
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = `rgba(${th.halo},${0.05 * k})`; ctx.lineWidth = w * 4.2; ctx.stroke();
  ctx.strokeStyle = `rgba(${th.halo},${0.10 * k})`; ctx.lineWidth = w * 2.5; ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = alpha(th.powder, 0.55); ctx.lineWidth = w * 1.3; ctx.stroke();
  ctx.strokeStyle = th.powder; ctx.lineWidth = w; ctx.stroke();
  ctx.strokeStyle = alpha(th.powderCore, 0.9 * core); ctx.lineWidth = w * 0.42; ctx.stroke();
}

// ---- the board pieces
export function drawPad(ctx, th, B, g) {
  const m = 0.62;
  const x = g.ox + (B.bounds.minX - (m - 0.5)) * g.S, y = g.oy + (B.bounds.minY - (m - 0.5)) * g.S;
  const w = (B.bounds.w + (m - 0.5) * 2) * g.S, h = (B.bounds.h + (m - 0.5) * 2) * g.S;
  ctx.fillStyle = th.pad; rr(ctx, x, y, w, h, Math.min(40, g.S * 0.9)); ctx.fill();
  ctx.strokeStyle = th.padEdge; ctx.lineWidth = 1.5; rr(ctx, x, y, w, h, Math.min(40, g.S * 0.9)); ctx.stroke();
}

export function drawRings(ctx, th, B, g) {
  ctx.strokeStyle = th.ring; ctx.lineWidth = Math.max(1, g.S * 0.018);
  ctx.beginPath();
  for (const d of B.dots) { const [x, y] = toScreen(g, d.x, d.y); ctx.moveTo(x + g.S * 0.5, y); ctx.arc(x, y, g.S * 0.5, 0, Math.PI * 2); }
  ctx.stroke();
}

// wrap[i] in 0..1: how much of dot i is wrapped (glows as it fills); lit[i] adds a ripple glow (completion)
export function drawDots(ctx, th, B, g, wrap, lit = null, t = 0) {
  const r = Math.max(3.2, g.S * 0.075);
  for (let i = 0; i < B.dots.length; i++) {
    const d = B.dots[i];
    const [x, y] = toScreen(g, d.x, d.y);
    const w = wrap ? wrap[i] : 0, l = lit ? lit[i] : 0;
    const a = Math.max(w * 0.55, l);
    if (a > 0.02) {
      const R = g.S * (0.3 + 0.18 * l);
      const rg = ctx.createRadialGradient(x, y, 0, x, y, R);
      rg.addColorStop(0, `rgba(${th.halo},${0.55 * a})`); rg.addColorStop(1, `rgba(${th.halo},0)`);
      ctx.fillStyle = rg; ctx.fillRect(x - R, y - R, R * 2, R * 2);
    }
    ctx.fillStyle = th.dot; ctx.globalAlpha = 0.72 + 0.28 * Math.max(w, l);
    ctx.beginPath(); ctx.arc(x, y, r * (1 + 0.45 * l), 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }
}

// a mark on a gap: the two strands drawn small, in the gate's own frame
export function drawMarkGlyph(ctx, th, x, y, R, ux, uy, state, a = 1) {
  ctx.save();
  ctx.translate(x, y); ctx.rotate(Math.atan2(uy, ux));
  ctx.globalAlpha = a;
  ctx.fillStyle = 'rgba(8,8,10,0.78)'; ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = th.mark; ctx.lineWidth = Math.max(1.5, R * 0.13); ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.stroke();
  ctx.lineWidth = Math.max(2, R * 0.17); ctx.lineCap = 'round';
  const k = R * 0.55;
  ctx.beginPath();
  if (state === 0) { // hug: )(  - two lines that each bend round their own dot
    ctx.moveTo(-k * 0.55, -k); ctx.quadraticCurveTo(0, 0, -k * 0.55, k);
    ctx.moveTo(k * 0.55, -k); ctx.quadraticCurveTo(0, 0, k * 0.55, k);
    ctx.moveTo(0, 0);
  } else if (state === 1) { // cross
    ctx.moveTo(-k, -k); ctx.lineTo(k, k); ctx.moveTo(k, -k); ctx.lineTo(-k, k);
  } else { // cup: a U above and an upside-down U below, touching in the middle
    ctx.moveTo(-k, -k); ctx.quadraticCurveTo(0, k * 0.0 + 0.05 * k, k, -k);
    ctx.moveTo(-k, k); ctx.quadraticCurveTo(0, -0.05 * k, k, k);
  }
  ctx.stroke();
  ctx.restore();
}

export function drawMarks(ctx, th, B, g, marks, fade = 1) {
  const R = Math.max(8, Math.min(20, g.S * 0.2));
  for (const k of Object.keys(marks)) {
    const gt = B.gates[Number(k)];
    const [x, y] = toScreen(g, gt.x, gt.y);
    drawMarkGlyph(ctx, th, x, y, R, gt.ux, gt.uy, marks[k], fade);
  }
}

// ---- curves for a trail or a whole solution
export function curveFor(B, a, st) { // st(gate) -> state or -1
  const s0 = st(a.g0), s1 = st(a.g1);
  return arcCurve(B, a, s0 < 0 ? 0 : s0, s1 < 0 ? 0 : s1);
}

// A finished pattern as one powder line: the walk of the single loop. reveal in 0..1 draws it progressively along its length.
export function patternSeq(B, states) {
  return loopSeq(B, states).map(({ arc, dir }) => ({ arc, dir, c: curveFor(B, B.arcs[arc], (gi) => states[gi]) }));
}
export function drawPattern(ctx, th, g, seq, reveal = 1, w = 4, k = 1) {
  const n = seq.length;
  linePath(ctx, g, seq, 0, n * clamp01(reveal));
  powder(ctx, th, w, k);
}
