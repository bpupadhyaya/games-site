// Judging a finished stroke: ORDER (was it the right next stroke), SHAPE (distance to the model path and its direction),
// RHYTHM (the width envelope the player's speed made vs the envelope of that stroke type) and, in compositions, TONE (ink density, dry brush).
import { LESSONS, TYPES, targetPath, pathLen, resample, envAt } from './lessons.js';
import { toneBand } from './brush.js';

export const JUDGE = {
  tolDefault: 10,                  // model units (0..100 box): mean distance at which a stroke is "fair"
  full: 0.35, zero: 1.6,           // shape score is 1 at 0.35 x tol and 0 at 1.6 x tol
  rhythmSpan: 0.55,                // mean envelope difference at which rhythm reaches 0
  minLen: 0.45,                    // a stroke under 45% of the model length is "too short"
  weights: { shape: 0.5, rhythm: 0.3, order: 0.2 },
  weightsTone: { shape: 0.45, rhythm: 0.25, order: 0.15, tone: 0.15 },
  orderPenalty: 0.35,              // order score when the stroke was written out of order
  stars: [0.45, 0.62, 0.8],        // average score needed for 1, 2, 3 stars
  samples: 20,
};
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

// Drawn centreline in page units, without the lift-off tail and without rest samples at the same spot.
function centerline(st) {
  const pts = [];
  for (const s of st.s) { const q = pts[pts.length - 1]; if (!q || Math.hypot(s.x - q[0], s.y - q[1]) > 1.2) pts.push([s.x, s.y]); }
  return pts.length > 1 ? pts : [[st.s[0].x, st.s[0].y], [st.s[0].x + 0.1, st.s[0].y + 0.1]];
}

function meanDist(a, b) { let s = 0; for (let i = 0; i < a.length; i++) s += Math.hypot(a[i][0] - b[i][0], a[i][1] - b[i][1]); return s / a.length; }
function nearestMean(a, dense) {
  let s = 0;
  for (const p of a) { let m = 1e9; for (const q of dense) { const d = (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2; if (d < m) m = d; } s += Math.sqrt(m); }
  return s / a.length;
}

// Distance (page units) between a drawn stroke and one model stroke. Closed shapes may start anywhere and run either way.
export function strokeDistance(lesson, idx, st) {
  const tgt = targetPath(lesson, idx), n = JUDGE.samples, T = resample(tgt, n), D = resample(centerline(st), n), closed = !!lesson.strokes[idx].closed;
  if (closed) {
    let best = 1e9;
    for (const dir of [1, -1]) for (let sh = 0; sh < n; sh++) {
      const rot = D.map((_, i) => D[((dir === 1 ? i : n - 1 - i) + sh + n) % n]);
      best = Math.min(best, meanDist(T, rot));
    }
    return { dist: best, rev: false, near: best };
  }
  const fwd = meanDist(T, D), rev = meanDist(T, D.slice().reverse()), near = nearestMean(D, T.length > 1 ? resample(tgt, 60) : tgt);
  return { dist: 0.5 * fwd + 0.5 * near, rev: rev < fwd * 0.6 && near < fwd, near, fwd, startOff: Math.hypot(D[0][0] - T[0][0], D[0][1] - T[0][1]), endOff: Math.hypot(D[n - 1][0] - T[n - 1][0], D[n - 1][1] - T[n - 1][1]), len: pathLen(centerline(st)) / (pathLen(tgt) || 1) };
}
const tolUnits = (lesson, idx) => (lesson.strokes[idx].tol ?? lesson.tol ?? JUDGE.tolDefault) * (lesson.box.w / 100);

// Width profile of the drawn stroke in `bins` bins along its length, normalised to its own average.
export function widthProfile(st, bins = 12) {
  const s = st.s, L = s[s.length - 1].d || 1, sum = new Array(bins).fill(0), cnt = new Array(bins).fill(0);
  for (const q of s) { const b = Math.min(bins - 1, Math.floor((q.d / L) * bins)); sum[b] += q.w; cnt[b] += 1; }
  const out = [];
  for (let i = 0; i < bins; i++) out.push(cnt[i] ? sum[i] / cnt[i] : i ? out[i - 1] : s[0].w);
  const mean = out.reduce((a, b) => a + b, 0) / bins || 1;
  return out.map((v) => v / mean);
}
export function envProfile(type, bins = 12) {
  const out = []; for (let i = 0; i < bins; i++) out.push(envAt(type, (i + 0.5) / bins));
  const mean = out.reduce((a, b) => a + b, 0) / bins;
  return out.map((v) => v / mean);
}

export function judgeStroke(lesson, expected, st, doneSet) {
  const idx = lesson.strokes;
  const dist = strokeDistance(lesson, expected, st);
  const tol = tolUnits(lesson, expected);
  // order: does another unfinished stroke fit clearly better?
  let chosen = expected, order = 1, orderMsg = null;
  let best = { i: expected, d: dist.dist };
  for (let j = 0; j < idx.length; j++) {
    if (j === expected || doneSet.has(j)) continue;
    const dj = strokeDistance(lesson, j, st).dist;
    if (dj < best.d * 0.7 && dj < tolUnits(lesson, j) * 1.2) best = { i: j, d: dj };
  }
  if (best.i !== expected) { chosen = best.i; order = JUDGE.orderPenalty; orderMsg = `Stroke order: write stroke ${expected + 1} (${TYPES[idx[expected].type].name}) first.`; }
  const sd = chosen === expected ? dist : strokeDistance(lesson, chosen, st);
  const t = tolUnits(lesson, chosen), stype = idx[chosen].type;
  let shape = clamp(1 - (sd.dist - JUDGE.full * t) / ((JUDGE.zero - JUDGE.full) * t), 0, 1);
  if (!lesson.strokes[chosen].closed && sd.len < JUDGE.minLen) shape *= clamp(sd.len / JUDGE.minLen, 0.2, 1);
  const prof = widthProfile(st), env = envProfile(stype);
  let diff = 0; for (let i = 0; i < prof.length; i++) diff += Math.abs(prof[i] - env[i]); diff /= prof.length;
  const rhythm = clamp(1 - diff / JUDGE.rhythmSpan, 0, 1);
  const want = idx[chosen].tone;
  let tone = null;
  if (want) {
    const band = toneBand(st.tone), order3 = ['pale', 'mid', 'dark'], gap = Math.abs(order3.indexOf(band) - order3.indexOf(want));
    tone = gap === 0 ? 1 : gap === 1 ? 0.55 : 0.2;
    if (idx[chosen].dry) { const lo = st.s.reduce((a, q) => a + q.l, 0) / st.s.length; tone = tone * (lo < 0.5 ? 1 : 0.6); }
  }
  const W = tone === null ? JUDGE.weights : JUDGE.weightsTone;
  const score = W.shape * shape + W.rhythm * rhythm + W.order * order + (tone === null ? 0 : W.tone * tone);
  // coaching: name the biggest gap
  let msg = orderMsg;
  if (!msg) {
    if (shape < 0.5 && sd.rev) msg = 'This stroke runs the other way: start at the numbered dot.';
    else if (shape < 0.5 && sd.len < JUDGE.minLen) msg = 'Pull the stroke longer, following the guide to its end.';
    else if (shape < 0.5) msg = 'Follow the model path more closely. Look at where it starts and where it turns.';
    else if (tone !== null && tone < 0.6) msg = want === 'dark' ? 'This part wants dark ink: grind, then dip again.' : want === 'pale' ? 'This part wants pale ink: touch the water first.' : 'Aim for a middle tone: a little water in the ink.';
    else if (rhythm < 0.7) {
      const regions = [[0, 3, 'start'], [3, 9, 'mid'], [9, 12, 'end']].map(([a, b, name]) => ({ name, d: avg(prof, a, b) - avg(env, a, b) }));
      regions.sort((p, q) => Math.abs(q.d) - Math.abs(p.d));
      const r = regions[0];
      msg = r.name === 'start' ? (r.d < 0 ? 'Press longer at the start: slow down as the tip lands.' : 'Land lighter: start a little faster.')
        : r.name === 'end' ? (r.d > 0 ? 'Lift sooner and keep moving as you lift.' : 'Pause and press before you lift at the end.')
          : (r.d > 0 ? 'Move a little faster through the middle.' : 'Keep an even, unhurried pace through the middle.');
    } else if (score >= 0.85) msg = 'Well written. Steady hand.';
    else msg = 'Good stroke. Keep the pace even and lift cleanly.';
  }
  return { chosen, shape, rhythm, order, tone, score, msg, ordered: order === 1, dist: sd.dist };
}
const avg = (a, i, j) => { let s = 0; for (let k = i; k < j; k++) s += a[k]; return s / (j - i); };

export function starsFor(avgScore, orderErrors) {
  const [a, b, c] = JUDGE.stars;
  if (avgScore >= c && orderErrors <= 1) return 3;
  if (avgScore >= b) return 2;
  if (avgScore >= a) return 1;
  return 0;
}
export { LESSONS };
