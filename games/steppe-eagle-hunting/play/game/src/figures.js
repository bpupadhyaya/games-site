// The living things of Steppe Eagle Hunting, drawn as layered feathers and fur: the golden eagle (in flight from behind, returning from the
// front, perched on the glove), the fox (always a silhouette, with a true running gait) and the hunter's arm and gauntlet.
// Pure canvas 2D, no DOM. Every motion here is a pure function of the numbers passed in (phase, bank, fold), so the sim stays deterministic.
import { roundPath } from './ui.js';

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
const grad = (ctx, x0, y0, x1, y1, stops) => { const g = ctx.createLinearGradient(x0, y0, x1, y1); stops.forEach(([o, c]) => g.addColorStop(o, c)); return g; };

export const PALETTES = [
  { name: 'Golden', body: '#7a4c24', dark: '#3b2514', mid: '#5e3a1c', light: '#d9a85a', nape: '#f0cd86', tail: '#4a2f18' },
  { name: 'Dark brown', body: '#4f321c', dark: '#25160a', mid: '#3c2514', light: '#a07a44', nape: '#c89a58', tail: '#2c1a0e' },
  { name: 'Pale', body: '#a67c4a', dark: '#5f3f20', mid: '#8a6234', light: '#f0d9a6', nape: '#f8e8c0', tail: '#7a5a30' },
  { name: 'White tail', body: '#5d3d28', dark: '#2a1a12', mid: '#47301f', light: '#caa272', nape: '#e8cc94', tail: '#efe9dc' },
];

// ---- one feather ----------------------------------------------------------------------------------------------------------------------
// From (x, y) toward angle a (0 = +x, PI/2 = +y), length L, width W. A rounded tip, a pale shaft and a darker edge. `tip` darkens the last third.
function feather(ctx, x, y, a, L, W, fill, o = {}) {
  const c = Math.cos(a), s = Math.sin(a), nx = -s, ny = c;
  const P = (d, w) => [x + c * d + nx * w, y + s * d + ny * w];
  ctx.beginPath();
  ctx.moveTo(...P(0, -W * 0.22));
  ctx.quadraticCurveTo(...P(L * 0.42, -W * 0.62), ...P(L * 0.9, -W * 0.36));
  ctx.quadraticCurveTo(...P(L * 1.04, -W * 0.18), ...P(L * 1.0, 0));
  ctx.quadraticCurveTo(...P(L * 1.04, W * 0.18), ...P(L * 0.9, W * 0.36));
  ctx.quadraticCurveTo(...P(L * 0.42, W * 0.62), ...P(0, W * 0.22));
  ctx.closePath();
  if (o.tip) {
    const t0 = P(0, 0), t1 = P(L, 0);
    ctx.fillStyle = grad(ctx, t0[0], t0[1], t1[0], t1[1], [[0, fill], [0.55, fill], [1, o.tip]]);
  } else ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = o.edge ?? 0.008; ctx.strokeStyle = o.line || 'rgba(14,7,2,0.55)'; ctx.stroke();
  if (o.shaft !== false) {
    const a0 = P(L * 0.05, 0), a1 = P(L * 0.94, 0);
    ctx.strokeStyle = o.shaftCol || 'rgba(255,236,190,0.35)'; ctx.lineWidth = 0.006; ctx.beginPath(); ctx.moveTo(...a0); ctx.lineTo(...a1); ctx.stroke();
  }
}

// ---- the golden eagle in flight ------------------------------------------------------------------------------------------------------
// Unit space: wingspan 2 (x from -1 to 1), head toward -y, tail toward +y; seen from behind and above (front: from in front and below, coming in).
// o: { flap -1..1 (wing-beat), lag (the hand's own flap, trails the arm), bank -0.6..0.6, fold 0..1 (1 = stoop), pal, alpha, front }
export function drawEagle(ctx, x, y, span, o = {}) {
  const { flap = 0, bank = 0, fold = 0, pal = PALETTES[0], alpha = 1, front = false } = o;
  const lag = o.lag ?? flap * 0.7;
  const u = span / 2;
  ctx.save(); ctx.translate(x, y); ctx.scale(u, front ? -u : u); ctx.rotate(bank * 0.35); ctx.globalAlpha = alpha;
  const under = front;                                           // underside showing: paler coverts, barred flight feathers
  const flightCol = under ? '#6a5036' : pal.mid;
  const darkCol = under ? '#2e2014' : pal.dark;
  const covertCol = under ? '#c9a46a' : pal.body;
  const barCol = under ? '#e8cf9c' : pal.light;

  // ---- tail: a fan of ten broad feathers with a pale banded base and a dark tip band
  {
    const n = 10, sp = lerp(0.3, 0.1, fold), L0 = lerp(0.56, 0.44, fold);
    for (let k = 0; k < n; k++) {
      const f = k / (n - 1), a = Math.PI / 2 + (f - 0.5) * 2 * sp, L = L0 * (1 - 0.1 * Math.abs(f - 0.5) * 2);
      feather(ctx, (f - 0.5) * 0.1, 0.3, a, L, lerp(0.11, 0.08, fold), pal.tail, { tip: darkCol, edge: 0.01 });
    }
    // pale barring at the tail base
    ctx.strokeStyle = 'rgba(240,222,180,0.35)'; ctx.lineWidth = 0.022;
    for (const d of [0.14, 0.24]) { ctx.beginPath(); ctx.moveTo(-0.09 - sp * 0.3, 0.3 + d); ctx.lineTo(0.09 + sp * 0.3, 0.3 + d); ctx.stroke(); }
  }

  // ---- the two wings (drawn in right-wing space, mirrored for the left)
  const wing = (side) => {
    const rel = side * bank;                                       // banking: one wing high, one low
    const f1 = flap * (1 - 0.35 * fold) + rel * 0.5, f2 = flap * (1 - 0.4 * fold) * 1.15 + rel * 0.55, f3 = lag * (1 - 0.45 * fold) * 1.2 + rel * 0.6;
    const th1 = lerp(-0.12, 1.1, fold), th2 = lerp(0.1, 1.36, fold), th3 = lerp(0.36, 1.5, fold);
    const l1 = 0.27, l2 = 0.3, e = (v) => Math.cos(clamp(v, -1.25, 1.25)), v = (len, th, el) => [len * Math.cos(th) * e(el), len * Math.sin(th) - len * Math.cos(th) * Math.sin(clamp(el, -1.25, 1.25)) * 0.62];
    const S = [0.1, -0.1];
    const d1 = v(l1, th1, f1), E = [S[0] + d1[0], S[1] + d1[1]];
    const d2 = v(l2, th2, f2), W = [E[0] + d2[0], E[1] + d2[1]];
    const wrist = (t) => (t < 0.48 ? [lerp(S[0], E[0], t / 0.48), lerp(S[1], E[1], t / 0.48), th1, f1] : [lerp(E[0], W[0], (t - 0.48) / 0.52), lerp(E[1], W[1], (t - 0.48) / 0.52), th2, f2]);
    ctx.save(); ctx.scale(side, 1);

    // secondaries: eleven rounded feathers hanging from the trailing edge of the arm
    for (let i = 10; i >= 0; i--) {
      const t = i / 10, [bx, by, th, el] = wrist(t);
      const Ls = lerp(0.34, 0.27, t) * (1 - 0.18 * fold), a = th + Math.PI / 2 - 0.2 - t * 0.05 + Math.sin(el * 1.1) * 0.08;
      feather(ctx, bx, by, a, Ls, 0.085, i % 2 ? flightCol : darkCol, { tip: darkCol });
    }
    // primaries: seven long fingered feathers fanned from the wrist, each lifted a little by the air
    const lens = [0.31, 0.38, 0.41, 0.4, 0.37, 0.33, 0.29];
    for (let i = 0; i < 7; i++) {
      const q = i / 6, a = th3 + lerp(-0.22, 0.52, q) + Math.sin(f3 * 1.2) * 0.07 * (1 - q) - f3 * 0.1 * (1 - q);
      const L = lens[i] * (1 - 0.2 * fold) * (0.96 + 0.04 * e(f3));
      const dx = Math.cos(a) * e(f3), dy = Math.sin(a) - Math.cos(a) * Math.sin(clamp(f3, -1.25, 1.25)) * 0.62, la = Math.atan2(dy, dx), LL = L * Math.hypot(dx, dy);
      feather(ctx, W[0] + 0.01 * i * Math.cos(th3 + 1.5), W[1] - 0.02 + 0.012 * i, la, LL, 0.072, i < 2 ? darkCol : flightCol, { tip: '#160c05', edge: 0.009 });
    }
    // coverts: three rows over the arm, a pale tawny bar across the middle ones
    const rows = [{ off: 0.2, L: 0.16, W: 0.075, n: 8, col: covertCol }, { off: 0.1, L: 0.12, W: 0.07, n: 8, col: barCol }, { off: -0.02, L: 0.085, W: 0.062, n: 8, col: pal.mid }];
    rows.forEach((r, ri) => {
      for (let i = r.n - 1; i >= 0; i--) {
        const t = (i + 0.4) / r.n, [bx, by, th, el] = wrist(t * 0.97 + 0.02);
        const nx = -Math.sin(th), ny = Math.cos(th);               // toward the trailing edge
        const ox = bx + nx * (r.off - 0.12) * 0.55 - Math.cos(th) * 0.0, oy = by + ny * (r.off - 0.12) * 0.55;
        feather(ctx, ox, oy - 0.03, th + Math.PI / 2 - 0.15, r.L, r.W, r.col, { shaft: false, edge: 0.006, line: 'rgba(14,7,2,0.4)' });
      }
    });
    // wrist patch, alula and the sunlit leading edge
    ctx.fillStyle = darkCol; ctx.beginPath(); ctx.ellipse(W[0] - 0.01, W[1] - 0.005, 0.05, 0.035, th2, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(255,226,160,0.62)'; ctx.lineWidth = 0.022; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(S[0], S[1] - 0.01); ctx.lineTo(E[0], E[1] - 0.012); ctx.lineTo(W[0], W[1] - 0.012); ctx.stroke();
    ctx.restore();
  };
  wing(-1); wing(1);

  // ---- body: a long plump back, the golden nape, a small hooked head
  const bw = 0.17 - fold * 0.045;
  ctx.beginPath();
  ctx.moveTo(0, -0.3);
  ctx.bezierCurveTo(bw * 0.7, -0.3, bw * 1.0, -0.2, bw, -0.06);
  ctx.bezierCurveTo(bw * 1.02, 0.12, bw * 0.7, 0.3, bw * 0.4, 0.42);
  ctx.lineTo(-bw * 0.4, 0.42);
  ctx.bezierCurveTo(-bw * 0.7, 0.3, -bw * 1.02, 0.12, -bw, -0.06);
  ctx.bezierCurveTo(-bw * 1.0, -0.2, -bw * 0.7, -0.3, 0, -0.3);
  ctx.closePath();
  ctx.fillStyle = under ? grad(ctx, -bw, 0, bw, 0, [[0, '#a98456'], [0.5, '#d5b784'], [1, '#8a6a42']]) : grad(ctx, -bw, 0, bw, 0, [[0, pal.dark], [0.45, pal.body], [0.8, pal.mid], [1, pal.dark]]);
  ctx.fill();
  ctx.lineWidth = 0.008; ctx.strokeStyle = 'rgba(12,6,2,0.55)'; ctx.stroke();
  // scalloped back feathers
  ctx.save(); ctx.clip();
  ctx.strokeStyle = under ? 'rgba(80,52,24,0.35)' : 'rgba(255,214,150,0.3)'; ctx.lineWidth = 0.011; ctx.lineCap = 'round';
  for (let r = 0; r < 7; r++) {
    const yy = -0.2 + r * 0.095, n = r < 2 ? 2 : 3, off = (r % 2) * 0.04;
    for (let k = -n; k <= n; k++) {
      const xx = k * 0.075 + off; if (Math.abs(xx) > bw * 0.95 * (1 - Math.abs(yy - 0.05) * 0.5)) continue;
      ctx.beginPath(); ctx.arc(xx, yy, 0.05, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
    }
  }
  ctx.restore();
  if (under) {   // pale belly streaks
    ctx.strokeStyle = 'rgba(110,76,40,0.45)'; ctx.lineWidth = 0.014; ctx.lineCap = 'round';
    for (let k = -3; k <= 3; k++) { ctx.beginPath(); ctx.moveTo(k * 0.04, -0.16); ctx.lineTo(k * 0.05, 0.1 + Math.abs(k) * -0.01); ctx.stroke(); }
  }
  // golden nape hackles over the shoulders
  ctx.fillStyle = under ? pal.light : pal.nape;
  for (let k = -3; k <= 3; k++) { feather(ctx, k * 0.026, -0.27, Math.PI / 2 + k * 0.28, 0.2, 0.06, k % 2 ? pal.nape : pal.light, { shaft: false, edge: 0.005, line: 'rgba(90,50,10,0.4)' }); }
  // neck and head
  const hy = -0.4;
  ctx.fillStyle = pal.body; ctx.beginPath(); ctx.ellipse(0, -0.33, 0.082, 0.07, 0, 0, 7); ctx.fill();
  ctx.fillStyle = grad(ctx, 0, hy - 0.08, 0, hy + 0.08, [[0, pal.body], [1, pal.mid]]);
  ctx.beginPath(); ctx.ellipse(0, hy, 0.088, 0.092, 0, 0, 7); ctx.fill(); ctx.strokeStyle = 'rgba(12,6,2,0.5)'; ctx.lineWidth = 0.007; ctx.stroke();
  if (front) {
    // face-on: pale cheeks, two dark-browed amber eyes, a yellow cere and a hooked bill pointing at the viewer
    ctx.fillStyle = pal.nape; ctx.beginPath(); ctx.ellipse(0, hy - 0.03, 0.062, 0.05, 0, 0, 7); ctx.fill();
    for (const s of [-1, 1]) {
      ctx.fillStyle = '#ffd36a'; ctx.beginPath(); ctx.ellipse(s * 0.036, hy + 0.0, 0.021, 0.017, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#120a03'; ctx.beginPath(); ctx.arc(s * 0.036, hy + 0.0, 0.0085, 0, 7); ctx.fill();
      ctx.strokeStyle = '#2a1708'; ctx.lineWidth = 0.014; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(s * 0.012, hy - 0.022); ctx.lineTo(s * 0.062, hy - 0.012); ctx.stroke();
    }
    ctx.fillStyle = '#d9b43c'; ctx.beginPath(); ctx.ellipse(0, hy + 0.04, 0.026, 0.02, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#26211c'; ctx.beginPath(); ctx.moveTo(-0.022, hy + 0.045); ctx.quadraticCurveTo(0, hy + 0.13, 0.022, hy + 0.045); ctx.quadraticCurveTo(0, hy + 0.03, -0.022, hy + 0.045); ctx.fill();
  } else {
    // from behind: the crown, the brow ridge above each eye and the bill tip showing past the head
    ctx.strokeStyle = pal.dark; ctx.lineWidth = 0.018; ctx.lineCap = 'round';
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s * 0.024, hy - 0.03); ctx.quadraticCurveTo(s * 0.062, hy - 0.04, s * 0.074, hy - 0.004); ctx.stroke(); }
    ctx.fillStyle = '#ffd36a'; ctx.beginPath(); ctx.arc(-0.07, hy - 0.002, 0.009, 0, 7); ctx.arc(0.07, hy - 0.002, 0.009, 0, 7); ctx.fill();
    ctx.fillStyle = '#d9b43c'; ctx.beginPath(); ctx.moveTo(-0.022, hy - 0.07); ctx.lineTo(0.022, hy - 0.07); ctx.lineTo(0.012, hy - 0.115); ctx.lineTo(-0.012, hy - 0.115); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#26211c'; ctx.beginPath(); ctx.moveTo(-0.014, hy - 0.1); ctx.lineTo(0.014, hy - 0.1); ctx.quadraticCurveTo(0.012, hy - 0.14, 0, hy - 0.145); ctx.quadraticCurveTo(-0.012, hy - 0.14, -0.014, hy - 0.1); ctx.fill();
  }
  // feet reaching out in front when the eagle stoops: yellow toes, black talons spread for the strike
  if (fold > 0.45) {
    const k = clamp((fold - 0.45) / 0.55, 0, 1), fy = -0.47 - 0.05 * k;
    for (const s of [-1, 1]) {
      ctx.strokeStyle = '#e0b83a'; ctx.lineWidth = 0.026; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(s * 0.05, -0.34); ctx.lineTo(s * 0.07, fy); ctx.stroke();
      for (let t = -1; t <= 1; t++) {
        const tx = s * 0.07 + t * 0.035 * k, ty = fy - 0.045 * k;
        ctx.strokeStyle = '#e0b83a'; ctx.lineWidth = 0.016; ctx.beginPath(); ctx.moveTo(s * 0.07, fy); ctx.lineTo(tx, ty); ctx.stroke();
        ctx.strokeStyle = '#17110c'; ctx.lineWidth = 0.011; ctx.beginPath(); ctx.moveTo(tx, ty); ctx.quadraticCurveTo(tx + t * 0.012, ty - 0.03 * k, tx + t * 0.004, ty - 0.05 * k); ctx.stroke();
      }
    }
  }
  ctx.restore();
}

// ---- the perched eagle on the glove --------------------------------------------------------------------------------------------------
// Seen from behind and to the side, facing +x (flip with `face`). (x, y) = the glove top; height = eagle height in px.
export function drawPerched(ctx, x, y, height, o = {}) {
  const { pal = PALETTES[0], face = 1, t = 0, alert = 0 } = o;
  const u = height / 200;
  ctx.save(); ctx.translate(x, y); ctx.scale(u * face, u);
  const breathe = Math.sin(t * 1.9) * 1.1, lean = alert * 5;
  const feat = (px, py, a, L, W, fill, tip) => feather(ctx, px, py, a, L, W, fill, { tip, edge: 1.3, shaft: false, line: 'rgba(14,7,2,0.5)' });
  // soft shadow of the bird on the glove
  ctx.fillStyle = 'rgba(30,14,4,0.35)'; ctx.beginPath(); ctx.ellipse(0, 4, 38, 9, 0, 0, 7); ctx.fill();
  // tail: ten long feathers hanging down behind, banded
  for (let i = 0; i < 9; i++) {
    const f = i / 8, a = Math.PI / 2 + 0.34 + (f - 0.5) * 0.4;
    feat(-22 + f * 10, -40, a, 108 - Math.abs(f - 0.5) * 20, 21, pal.tail, '#140b05');
  }
  ctx.strokeStyle = 'rgba(240,222,180,0.28)'; ctx.lineWidth = 3.4;
  for (const d of [18, 40]) { ctx.beginPath(); ctx.moveTo(-34 + d * 0.3, -40 + d); ctx.lineTo(0 + d * 0.3, -38 + d); ctx.stroke(); }
  // feathered thighs and yellow feet gripping the glove
  ctx.fillStyle = grad(ctx, -20, -50, 20, 0, [[0, pal.light], [1, pal.body]]);
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s * 8 - 10, -64); ctx.quadraticCurveTo(s * 22, -34, s * 14, -6); ctx.lineTo(s * 4 - 2, -6); ctx.quadraticCurveTo(s * 2, -36, s * 8 - 12, -60); ctx.closePath(); ctx.fill(); }
  for (const s of [-1, 1]) {
    const bx = s * 14 + 2;
    ctx.strokeStyle = '#e0b83a'; ctx.lineWidth = 8; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(bx, -10); ctx.lineTo(bx + 1, 0); ctx.stroke();
    for (let k = -1; k <= 1; k++) {
      ctx.strokeStyle = '#e0b83a'; ctx.lineWidth = 5.2; ctx.beginPath(); ctx.moveTo(bx + 1, 0); ctx.lineTo(bx + 1 + k * 6, 8); ctx.stroke();
      ctx.strokeStyle = '#17110c'; ctx.lineWidth = 3.4; ctx.beginPath(); ctx.moveTo(bx + 1 + k * 6, 8); ctx.quadraticCurveTo(bx + 2 + k * 6, 13, bx - 1 + k * 6, 16); ctx.stroke();
    }
  }
  // body: plump, upright, leaning slightly toward the quarry
  ctx.save(); ctx.translate(lean * 0.4, breathe);
  ctx.beginPath(); ctx.moveTo(-36, -22);
  ctx.bezierCurveTo(-62, -70, -52, -138, -12, -158); ctx.bezierCurveTo(26, -170, 56, -136, 50, -84); ctx.bezierCurveTo(46, -50, 30, -24, 12, -14); ctx.closePath();
  ctx.fillStyle = grad(ctx, -56, -140, 54, -10, [[0, pal.body], [0.55, pal.mid], [1, pal.dark]]); ctx.fill();
  ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(14,7,2,0.55)'; ctx.stroke();
  ctx.save(); ctx.clip();
  // scalloped breast and back feathers, lighter at the edge
  for (let r = 0; r < 9; r++) {
    for (let k = -3; k <= 3; k++) {
      const px = k * 17 + (r % 2) * 8 + 4, py = -150 + r * 15;
      ctx.strokeStyle = r < 5 ? 'rgba(255,220,160,0.24)' : 'rgba(255,200,130,0.18)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(px, py, 11, 0.12 * Math.PI, 0.88 * Math.PI); ctx.stroke();
    }
  }
  // chest light (the sun on the right)
  ctx.fillStyle = grad(ctx, 10, -150, 56, -20, [[0, 'rgba(255,230,170,0)'], [1, 'rgba(255,214,140,0.38)']]); ctx.fillRect(-80, -180, 160, 180);
  ctx.restore();
  // folded wing: coverts, then primary tips crossing the tail
  for (let i = 0; i < 6; i++) feat(-26 + i * 6, -110 + i * 4, Math.PI / 2 + 0.2 - i * 0.02, 108 - i * 4, 16, i % 2 ? pal.mid : pal.dark, '#120a04');
  ctx.fillStyle = pal.light; ctx.globalAlpha = 0.55;
  ctx.beginPath(); ctx.moveTo(-40, -118); ctx.quadraticCurveTo(-14, -126, 10, -114); ctx.quadraticCurveTo(-8, -96, -38, -92); ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1;
  for (let i = 0; i < 4; i++) feat(-38 + i * 8, -122 + i * 2, Math.PI / 2 + 0.08, 54, 15, pal.body, pal.mid);
  // the golden nape and head, turned to look at the quarry
  const hx = 18 + alert * 8, hy = -172 - alert * 4;
  for (let k = 0; k < 7; k++) feat(hx - 22 + k * 6, hy + 4, Math.PI * 0.62 + k * 0.1, 30, 11, k % 2 ? pal.nape : pal.light, pal.light);
  ctx.fillStyle = grad(ctx, hx - 22, hy - 20, hx + 20, hy + 20, [[0, pal.body], [1, pal.mid]]);
  ctx.beginPath(); ctx.ellipse(hx, hy, 24, 21, -0.1, 0, 7); ctx.fill(); ctx.strokeStyle = 'rgba(14,7,2,0.5)'; ctx.lineWidth = 1.4; ctx.stroke();
  ctx.fillStyle = pal.nape; ctx.globalAlpha = 0.75; ctx.beginPath(); ctx.ellipse(hx - 9, hy + 6, 15, 11, 0.5, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
  // bill: yellow cere, dark hooked tip, gape line
  ctx.fillStyle = '#d9b43c'; ctx.beginPath(); ctx.moveTo(hx + 14, hy - 6); ctx.quadraticCurveTo(hx + 34, hy - 8, hx + 42, hy + 2); ctx.lineTo(hx + 36, hy + 9); ctx.quadraticCurveTo(hx + 24, hy + 6, hx + 12, hy + 8); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#26211c'; ctx.beginPath(); ctx.moveTo(hx + 30, hy - 7); ctx.quadraticCurveTo(hx + 48, hy - 6, hx + 46, hy + 8); ctx.quadraticCurveTo(hx + 47, hy + 18, hx + 40, hy + 24); ctx.quadraticCurveTo(hx + 40, hy + 14, hx + 36, hy + 9); ctx.quadraticCurveTo(hx + 38, hy + 2, hx + 30, hy - 7); ctx.fill();
  ctx.strokeStyle = '#1a1208'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(hx + 14, hy + 7); ctx.lineTo(hx + 34, hy + 8); ctx.stroke();
  ctx.fillStyle = '#4a3a22'; ctx.beginPath(); ctx.arc(hx + 30, hy - 2, 1.8, 0, 7); ctx.fill();
  // eye: amber iris, black pupil, a catch-light, under a heavy brow
  const er = 6.2 + alert * 0.8;
  ctx.fillStyle = '#e8a82a'; ctx.beginPath(); ctx.arc(hx + 6, hy - 4, er, 0, 7); ctx.fill();
  ctx.fillStyle = '#100803'; ctx.beginPath(); ctx.arc(hx + 7, hy - 4, er * 0.52, 0, 7); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.beginPath(); ctx.arc(hx + 9, hy - 6.4, 1.5, 0, 7); ctx.fill();
  ctx.strokeStyle = pal.dark; ctx.lineWidth = 4.4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(hx - 6, hy - 13); ctx.quadraticCurveTo(hx + 8, hy - 18, hx + 22, hy - 8); ctx.stroke();
  ctx.restore();
  // a thin leather jess from the leg to the glove
  ctx.strokeStyle = '#8a5a2c'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(14, -6); ctx.quadraticCurveTo(26, 10, 22, 22); ctx.stroke();
  ctx.restore();
}

// ---- the fox: a silhouette, always -------------------------------------------------------------------------------------------------------
// mode: 'listen' (head up), 'warn' (crouched, tail flick), 'run'. dir: -1 faces left, 1 faces right. size = body length in px.
// The gait is a true diagonal gallop: legs hinge at hip and knee, the spine rises and falls and the brush streams behind.
export function drawFox(ctx, x, y, size, o = {}) {
  const { dir = 1, mode = 'listen', t = 0, alpha = 1, mark = false } = o;
  const run = mode === 'forage' || mode === 'pounce' || mode === 'bolt' || mode === 'dodge' || mode === 'bwarn';
  const fast = mode === 'bolt' || mode === 'dodge';
  const u = size / 100;
  const crouch = mode === 'warn' ? 14 : 0, ph = t * (fast ? 14 : 8);
  const bob = run ? Math.abs(Math.sin(ph)) * (fast ? -6 : -3) : 0, c = crouch + bob;
  const hy = (mode === 'listen' ? -66 : -50) + crouch * 0.8 + bob * 0.6;
  ctx.save(); ctx.translate(x, y); ctx.scale(dir * u, u); ctx.globalAlpha = alpha;
  ctx.fillStyle = 'rgba(70,95,140,0.35)'; ctx.beginPath(); ctx.ellipse(6, 2, 52 - (run ? 0 : 4), 9, 0, 0, 7); ctx.fill();
  const ink = '#2b2430';
  ctx.fillStyle = ink; ctx.strokeStyle = ink; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  // legs: thigh to knee to paw, swinging in opposite pairs; far legs a little darker
  const leg = (hx, hyy, off, far) => {
    const sw = run ? Math.sin(ph + off) : 0, lift = run ? Math.max(0, Math.cos(ph + off)) : 0;
    const kx = hx + sw * (fast ? 13 : 8) + 3, ky = hyy + 13 - lift * 5, fx = hx + sw * (fast ? 22 : 13), fy = Math.min(-1, -2 - lift * (fast ? 14 : 9)) + (run ? 0 : 0);
    ctx.strokeStyle = far ? '#1d1822' : ink; ctx.lineWidth = 7.4;
    ctx.beginPath(); ctx.moveTo(hx, hyy); ctx.lineTo(kx, ky); ctx.lineWidth = 5.6; ctx.lineTo(fx, fy); ctx.stroke();
    ctx.fillStyle = far ? '#1d1822' : ink; ctx.beginPath(); ctx.ellipse(fx + 2.5, fy, 5.2, 2.6, 0, 0, 7); ctx.fill();
  };
  const legTop = -30 + c;
  leg(-28, legTop, Math.PI, true); leg(30, legTop, 0, true);
  // tail: a streaming brush with a pale tip
  const tw = run ? Math.sin(ph * 0.5) * 5 : Math.sin(t * 5) * (mode === 'warn' ? 12 : 3);
  const tl = run ? 96 : 88;
  ctx.fillStyle = ink; ctx.beginPath(); ctx.moveTo(-34, -44 + c);
  ctx.bezierCurveTo(-58, -58 + tw, -tl + 14, -46 + tw * 1.3 + c * 0.3, -tl, -38 + tw * 1.5 + c * 0.3);
  ctx.bezierCurveTo(-tl + 16, -22 + tw * 0.8 + c * 0.2, -58, -26 + tw * 0.4, -34, -33 + c); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#e8dcc8'; ctx.beginPath(); ctx.moveTo(-tl + 22, -42 + tw * 1.4 + c * 0.3); ctx.quadraticCurveTo(-tl - 4, -44 + tw * 1.5 + c * 0.3, -tl - 6, -36 + tw * 1.5 + c * 0.3);
  ctx.quadraticCurveTo(-tl + 6, -26 + tw * 1.0, -tl + 22, -30 + tw * 0.9 + c * 0.2); ctx.closePath(); ctx.fill();
  // body, neck and head as one outline
  ctx.fillStyle = ink; ctx.beginPath();
  ctx.moveTo(-38, -36 + c);
  ctx.bezierCurveTo(-46, -52 + c, -26, -58 + c, -4, -56 + c);
  ctx.bezierCurveTo(14, -55 + c, 26, -54 + c, 34, -56 + c);
  ctx.bezierCurveTo(40, -58 + c, 42, hy + 12, 46, hy + 6);
  ctx.bezierCurveTo(48, hy - 4, 52, hy - 8, 58, hy - 6);
  ctx.bezierCurveTo(66, hy - 4, 76, hy + 2, 80, hy + 6);
  ctx.bezierCurveTo(79, hy + 10, 70, hy + 11, 62, hy + 11);
  ctx.bezierCurveTo(56, hy + 12, 52, hy + 16, 48, hy + 22);
  ctx.bezierCurveTo(46, -40 + c, 40, -30 + c, 30, -28 + c);
  ctx.bezierCurveTo(14, -26 + c, -10, -26 + c, -26, -28 + c);
  ctx.bezierCurveTo(-34, -29 + c, -38, -32 + c, -38, -36 + c);
  ctx.closePath(); ctx.fill();
  // ears
  ctx.beginPath(); ctx.moveTo(47, hy - 3); ctx.lineTo(48, hy - 24); ctx.lineTo(57, hy - 6); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(54, hy - 5); ctx.lineTo(60, hy - 22); ctx.lineTo(63, hy - 3); ctx.closePath(); ctx.fill();
  leg(-17, legTop, 0, false); leg(38, legTop, Math.PI, false);
  // warm rim light along the back and the crown
  ctx.strokeStyle = 'rgba(224,138,64,0.8)'; ctx.lineWidth = 2.6;
  ctx.beginPath(); ctx.moveTo(-34, -50 + c); ctx.bezierCurveTo(-18, -57 + c, 12, -56 + c, 34, -57 + c); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(51, hy - 7); ctx.bezierCurveTo(56, hy - 8, 64, hy - 5, 72, hy); ctx.stroke();
  ctx.restore();
  if (mark) {   // a gentle sighted marker over the fox
    ctx.save(); ctx.fillStyle = '#ffd36a'; ctx.strokeStyle = 'rgba(20,30,60,0.9)'; ctx.lineWidth = 3; ctx.beginPath();
    const my = y - size * 0.9 - 8 - 3 * Math.sin(t * 6); ctx.moveTo(x - 8, my - 12); ctx.lineTo(x + 8, my - 12); ctx.lineTo(x, my); ctx.closePath(); ctx.stroke(); ctx.fill(); ctx.restore();
  }
}

// ---- the hunter's arm and gauntlet -------------------------------------------------------------------------------------------------------
// A quilted deep-red coat sleeve with folds, a fur cuff and a thick leather gauntlet with stitching and a thumb. Returns the glove top point.
export function drawArm(ctx, g, o = {}) {
  const { raise = 0, t = 0 } = o;
  const { w, h } = g, u = g.unit;
  const gx = o.x ?? w * (g.land ? 0.3 : 0.32), gy = (o.y ?? h - (g.land ? 150 : 200) * u) - raise * 30 * u + Math.sin(t * 1.3) * 1.5 * u;
  ctx.save();
  // sleeve
  ctx.fillStyle = grad(ctx, gx - 130 * u, gy, gx + 70 * u, h, [[0, '#8a2230'], [0.55, '#661520'], [1, '#3e0c14']]);
  ctx.beginPath(); ctx.moveTo(gx - 160 * u, h + 20); ctx.bezierCurveTo(gx - 120 * u, gy + 150 * u, gx - 70 * u, gy + 100 * u, gx - 52 * u, gy + 78 * u);
  ctx.lineTo(gx + 44 * u, gy + 84 * u); ctx.bezierCurveTo(gx + 60 * u, gy + 130 * u, gx + 96 * u, gy + 190 * u, gx + 110 * u, h + 20); ctx.closePath(); ctx.fill();
  // quilting and fold shading
  ctx.save(); ctx.clip();
  ctx.strokeStyle = 'rgba(255,170,150,0.18)'; ctx.lineWidth = 2 * u;
  for (let i = -3; i <= 5; i++) { ctx.beginPath(); ctx.moveTo(gx - 160 * u + i * 40 * u, gy + 90 * u); ctx.lineTo(gx - 100 * u + i * 40 * u, h + 20); ctx.stroke(); }
  for (let j = 0; j < 6; j++) { const yy = gy + (96 + j * 38) * u; ctx.beginPath(); ctx.moveTo(gx - 200 * u, yy); ctx.quadraticCurveTo(gx, yy + 14 * u, gx + 200 * u, yy - 4 * u); ctx.stroke(); }
  ctx.fillStyle = 'rgba(20,0,6,0.28)'; ctx.beginPath(); ctx.moveTo(gx + 20 * u, gy + 84 * u); ctx.lineTo(gx + 110 * u, h + 20); ctx.lineTo(gx + 40 * u, h + 20); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(255,200,170,0.18)'; ctx.beginPath(); ctx.moveTo(gx - 60 * u, gy + 86 * u); ctx.lineTo(gx - 150 * u, h + 20); ctx.lineTo(gx - 100 * u, h + 20); ctx.lineTo(gx - 30 * u, gy + 90 * u); ctx.closePath(); ctx.fill();
  ctx.restore();
  // fox-fur cuff: a soft band with many strokes
  const cx = gx - 6 * u, cy = gy + 58 * u;
  ctx.fillStyle = grad(ctx, cx, cy - 20 * u, cx, cy + 40 * u, [[0, '#f1e6d0'], [1, '#bfae92']]);
  roundPath(ctx, cx - 66 * u, cy - 6 * u, 124 * u, 46 * u, 22 * u); ctx.fill();
  ctx.lineCap = 'round';
  for (let i = 0; i < 26; i++) {
    const fx = cx - 60 * u + i * 4.6 * u, a = (i % 3 - 1) * 0.12;
    ctx.strokeStyle = i % 2 ? 'rgba(120,96,60,0.55)' : 'rgba(255,255,255,0.65)'; ctx.lineWidth = 2 * u;
    ctx.beginPath(); ctx.moveTo(fx, cy - 4 * u); ctx.lineTo(fx + a * 20 * u, cy - 15 * u + (i % 4) * 2 * u); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(fx, cy + 34 * u); ctx.lineTo(fx + a * 14 * u, cy + 46 * u - (i % 3) * 2 * u); ctx.stroke();
  }
  // gauntlet: flared cuff, back of the hand, a thumb folded in, stitched seam
  ctx.fillStyle = grad(ctx, gx - 60 * u, gy - 6 * u, gx + 56 * u, gy + 62 * u, [[0, '#b98240'], [0.5, '#8c5b2a'], [1, '#5a3517']]);
  ctx.beginPath(); ctx.moveTo(gx - 58 * u, gy + 62 * u); ctx.bezierCurveTo(gx - 72 * u, gy + 6 * u, gx - 40 * u, gy - 12 * u, gx - 4 * u, gy - 8 * u);
  ctx.bezierCurveTo(gx + 40 * u, gy - 8 * u, gx + 66 * u, gy + 6 * u, gx + 58 * u, gy + 34 * u); ctx.bezierCurveTo(gx + 56 * u, gy + 50 * u, gx + 50 * u, gy + 58 * u, gx + 46 * u, gy + 62 * u); ctx.closePath(); ctx.fill();
  ctx.lineWidth = 2.2 * u; ctx.strokeStyle = 'rgba(32,16,4,0.7)'; ctx.stroke();
  ctx.save(); ctx.clip();
  ctx.fillStyle = 'rgba(255,226,170,0.38)'; ctx.beginPath(); ctx.ellipse(gx - 14 * u, gy + 4 * u, 44 * u, 9 * u, -0.08, 0, 7); ctx.fill();   // sun on the knuckles
  ctx.strokeStyle = 'rgba(40,20,6,0.5)'; ctx.lineWidth = 2 * u;
  for (const fx of [-24, -4, 16, 36]) { ctx.beginPath(); ctx.moveTo(gx + fx * u, gy - 4 * u); ctx.lineTo(gx + (fx + 2) * u, gy + 22 * u); ctx.stroke(); }
  ctx.setLineDash([5 * u, 5 * u]); ctx.strokeStyle = 'rgba(240,210,150,0.65)'; ctx.lineWidth = 1.6 * u;
  ctx.beginPath(); ctx.moveTo(gx - 52 * u, gy + 44 * u); ctx.quadraticCurveTo(gx, gy + 36 * u, gx + 44 * u, gy + 44 * u); ctx.stroke(); ctx.setLineDash([]);
  ctx.restore();
  // thumb
  ctx.fillStyle = grad(ctx, gx + 30 * u, gy + 10 * u, gx + 66 * u, gy + 50 * u, [[0, '#a8743a'], [1, '#5f3a19']]);
  ctx.beginPath(); ctx.moveTo(gx + 40 * u, gy + 24 * u); ctx.bezierCurveTo(gx + 62 * u, gy + 16 * u, gx + 76 * u, gy + 30 * u, gx + 66 * u, gy + 50 * u); ctx.bezierCurveTo(gx + 58 * u, gy + 58 * u, gx + 48 * u, gy + 52 * u, gx + 44 * u, gy + 46 * u); ctx.closePath(); ctx.fill();
  ctx.lineWidth = 1.8 * u; ctx.strokeStyle = 'rgba(32,16,4,0.7)'; ctx.stroke();
  ctx.restore();
  return { x: gx - 4 * u, y: gy + 2 * u };
}
