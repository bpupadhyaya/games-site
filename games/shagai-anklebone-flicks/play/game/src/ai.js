// The computer riders. They plan a ride with exact expectation over the bones (every way to hold some bones and re-toss the
// rest, up to the tosses left), so a good computer genuinely weighs "keep the pair" against "chase a horse".
// Levels: beginner (often errs), steady (best expected strides), sharp (also reads the track: wind, burrows, streams, bumps).
import { FACE_NAMES, FACE_VALUE, FACE_WEIGHT, BONES, FINISH, scoreOf, previewGallop, counts } from './rules.js';

export const LEVELS = ['beginner', 'steady', 'sharp'];
export const LEVEL_NAMES = { beginner: 'Easy', steady: 'Steady', sharp: 'Sharp', mixed: 'Mixed' };

// ---- the expectation tables (built once) -----------------------------------------------------------------------------
const key = (c) => c.join('');
const fact = [1, 1, 2, 6, 24];
function vectors(total) { const out = []; for (let a = 0; a <= total; a++) for (let b = 0; a + b <= total; b++) for (let c = 0; a + b + c <= total; c++) out.push([a, b, c, total - a - b - c]); return out; }
const P = FACE_WEIGHT.map((w) => w / 100);
// ROLL[r] = every multiset of r freshly tossed bones with its probability
const ROLL = [0, 1, 2, 3, 4].map((r) => vectors(r).map((v) => ({ v, p: (fact[r] / v.reduce((q, n) => q * fact[n], 1)) * v.reduce((q, n, f) => q * Math.pow(P[f], n), 1) })));
const STATES = vectors(BONES);
const SUBS = new Map(STATES.map((s) => [key(s), [0, 1, 2, 3, 4].flatMap(vectors).filter((h) => h.every((n, f) => n <= s[f]))]));

// utility of ending a ride with these sides, for rider pl. `mode` 'strides' counts raw strides; 'track' reads the board.
function utilityOf(g, pl, mode) {
  const memo = new Map();
  return (c) => {
    const k = key(c); if (memo.has(k)) return memo.get(k);
    const faces = []; c.forEach((n, f) => { for (let i = 0; i < n; i++) faces.push(f); });
    const strides = scoreOf(faces).total;
    let u = strides;
    if (mode === 'track') {
      const r = previewGallop(g, pl, strides);
      u = r.finished ? 100 : r.final - r.from;
      for (const b of r.bumped) u += (g.riders[b.pl].pos >= 30 ? 3.2 : 2.4);
      if (r.status === 'camp') u += 1.6; else if (r.status === 'stream') u -= 1.6;
    } else if (g.riders[pl].pos + strides >= FINISH) u = 100;
    memo.set(k, u); return u;
  };
}

// W[k](state) = best value of a ride from this state with k re-tosses left, plus the best action.
function plan(g, pl, faces, tossesLeft, mode) {
  const U = utilityOf(g, pl, mode), tables = [new Map()];
  for (const s of STATES) tables[0].set(key(s), { v: U(s), act: 'gallop' });
  const layer = (prev) => {
    const cur = new Map();
    for (const s of STATES) {
      let best = { v: U(s), act: 'gallop' };
      for (const h of SUBS.get(key(s))) {
        const r = BONES - h.reduce((t, n) => t + n, 0); if (r === 0) continue;
        let e = 0;
        for (const o of ROLL[r]) e += o.p * prev.get(key(h.map((n, f) => n + o.v[f]))).v;
        if (e > best.v + 1e-9) best = { v: e, act: 'toss', hold: h };
      }
      cur.set(key(s), best);
    }
    return cur;
  };
  for (let k = 1; k <= tossesLeft; k++) tables.push(layer(tables[k - 1]));
  const here = tables[tossesLeft].get(key(counts(faces)));
  return { ...here, now: U(counts(faces)), U };
}

// which physical bones to hold so that the multiset `h` is kept
function holdMask(faces, h) { const left = h.slice(); return faces.map((f) => { if (left[f] > 0) { left[f]--; return true; } return false; }); }

// The best ride action: { gallop: bool, hold: [bool x4], ev, now, why }
export function bestAction(g, pl, faces, tossesLeft, mode = 'track') {
  if (tossesLeft <= 0) return { gallop: true, hold: faces.map(() => true), ev: scoreOf(faces).total, now: scoreOf(faces).total };
  const p = plan(g, pl, faces, tossesLeft, mode), now = scoreOf(faces).total;
  if (p.act === 'gallop') return { gallop: true, hold: faces.map(() => true), ev: p.v, now };
  return { gallop: false, hold: holdMask(faces, p.hold), held: p.hold, ev: p.v, now, evNow: p.now };
}

export function chooseAction(g, pl, faces, tossesLeft, level, rng) {
  const mode = level === 'sharp' ? 'track' : 'strides';
  const best = bestAction(g, pl, faces, tossesLeft, mode);
  if (level === 'beginner' && tossesLeft > 0 && rng.chance(0.4)) {
    // a hasty or random choice
    if (rng.chance(0.4)) return { gallop: true, hold: faces.map(() => true), ev: best.now, now: best.now };
    const hold = faces.map(() => rng.chance(0.5));
    if (hold.every(Boolean)) hold[rng.int(BONES)] = false;
    return { gallop: false, hold, ev: best.now, now: best.now };
  }
  return best;
}

// Plain-English reason for the Hint button and for Watch & Learn
export function describeAction(g, pl, faces, a, tossesLeft) {
  const sc = scoreOf(faces).total, r = previewGallop(g, pl, sc);
  if (a.gallop) {
    const tail = r.finished ? ' That reaches the finish!' : (r.effect?.kind === 'wind' ? ' It ends on a tailwind.' : r.effect?.kind === 'burrow' ? ' It ends in a marmot burrow.' : r.effect?.kind === 'camp' ? ' It ends at a camp.' : r.effect?.kind === 'stream' ? ' It ends in a stream.' : '') + (r.bumped.length ? ' It flicks a rival back.' : '');
    return tossesLeft > 0 ? `Gallop now for ${sc} strides: another toss is not expected to do better.${tail}` : `Gallop for ${sc} strides.${tail}`;
  }
  const keep = a.held ? a.held.map((n, f) => (n ? `${n} ${FACE_NAMES[f].toLowerCase()}${n > 1 ? 's' : ''}` : null)).filter(Boolean).join(' and ') : '';
  return keep ? `Keep ${keep} and toss the rest: about ${a.ev.toFixed(1)} strides expected, against ${a.now} if you gallop now.` : `Toss all four bones again: about ${a.ev.toFixed(1)} strides expected, against ${a.now} now.`;
}
export { FACE_VALUE };
