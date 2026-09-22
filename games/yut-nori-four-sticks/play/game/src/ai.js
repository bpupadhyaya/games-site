// The computer's brain. It searches every ORDER in which its held throws could be spent (which token, which shortcut),
// scores the position it ends in, and looks at the chance the rival can hit back. The search is a generator that
// is advanced a few leaves per frame, so it never blocks the UI. Work is counted in leaves, never in time.
import { HOME, PROB, THROW_VALUES, movesFor, applyMove, settle, clone, progress } from './rules.js';

// Personalities. prog: how much progress matters; safe: fear of being hit; hunt: wish to threaten rivals;
// stack: love of travelling together; bonus: value of an extra throw; noise: random wobble;
// slip: chance of playing a random legal turn instead of the best one.
export const LEVELS = [
  { id: 'beginner', name: 'Beginner', blurb: 'Plays quickly and often misses the best turn.', prog: 1, safe: 0.3, hunt: 0.1, stack: 0.2, bonus: 3, noise: 5, slip: 0.45 },
  { id: 'cautious', name: 'Cautious', blurb: 'Keeps tokens out of reach and stacks up for safety.', prog: 1, safe: 1.7, hunt: 0.1, stack: 1.2, bonus: 4, noise: 0.6, slip: 0 },
  { id: 'balanced', name: 'Balanced', blurb: 'Weighs speed and safety evenly.', prog: 1, safe: 1, hunt: 0.3, stack: 0.6, bonus: 5, noise: 0.6, slip: 0 },
  { id: 'aggressive', name: 'Aggressive', blurb: 'Chases captures and races ahead, whatever the risk.', prog: 1, safe: 0.3, hunt: 0.9, stack: 0.2, bonus: 9, noise: 0.6, slip: 0 },
  { id: 'master', name: 'Master', blurb: 'Reads every order of throws and the rival\'s chance to strike back.', prog: 1, safe: 1.15, hunt: 0.45, stack: 0.7, bonus: 6, noise: 0, slip: 0 },
];

const groupValue = (grp) => grp.n * (progress(grp.pos) + 5);
// Chance (0..1) that team `by` captures the stack standing on `pos` with its next single throw.
function hitChance(s, by, pos) {
  let p = 0;
  for (const v of THROW_VALUES) {
    if (movesFor(s, by, v).some((m) => m.to === pos)) p += PROB[v];
  }
  return p;
}

// Score a position from `me`'s point of view. s.turn may be either team.
export function evaluate(s, me, W) {
  const o = 1 - me;
  if (s.winner === me) return 1e6;
  if (s.winner === o) return -1e6;
  let mine = s.home[me] * 22, theirs = s.home[o] * 22, stackB = 0, danger = 0, hunt = 0;
  for (const grp of s.g[me]) { mine += grp.n * progress(grp.pos); if (grp.n > 1) stackB += grp.n - 1; }
  for (const grp of s.g[o]) theirs += grp.n * progress(grp.pos);
  // each position a stack could be hit from: exposure counts what would be lost
  for (const grp of s.g[me]) danger += hitChance(s, o, grp.pos) * groupValue(grp);
  for (const grp of s.g[o]) hunt += hitChance(s, me, grp.pos) * groupValue(grp);
  let v = W.prog * (mine - theirs) - W.safe * danger + W.hunt * hunt + W.stack * stackB;
  // an extra throw still owed to me is worth something
  if (s.turn === me && s.phase === 'throw') v += W.bonus;
  return v;
}


// Enumerate every way to spend the held throws. yields nothing; results are pushed to `out` as {first, value, n}.
function* search(s0, me, W, out, leafCap) {
  let leaves = 0;
  function* walk(s, first, seq) {
    if (leaves >= leafCap) return;
    const spent = s.turn !== me || s.phase !== 'move' || s.winner >= 0;
    if (spent) { leaves++; out.push({ first, seq, value: evaluate(s, me, W), s }); yield; return; }
    const seen = new Set();
    for (const v of s.pending) {
      if (seen.has(v)) continue; seen.add(v);
      for (const m of movesFor(s, me, v)) {
        const c = clone(s);
        applyMove(c, m); settle(c);
        yield* walk(c, first || m, seq.concat([m]));
        if (leaves >= leafCap) return;
      }
    }
  }
  yield* walk(s0, null, []);
}

// createThinker(state, levelIndex, rng): call .step(leafBudget) each frame until it returns {done:true, move, sequence}
export function createThinker(state, level, rng, opts = {}) {
  const W = LEVELS[level], me = state.turn, out = [];
  const gen = search(clone(state), me, W, out, opts.leafCap ?? 2500);
  let finished = false;
  return {
    out,
    step(budget = 60) {
      let n = 0;
      while (!finished && n < budget) { if (gen.next().done) finished = true; n++; }
      if (!finished) return { done: false };
      if (!out.length) return { done: true, move: null };
      let pick;
      if (W.slip && rng.chance(W.slip)) pick = rng.pick(out);
      else {
        let best = -Infinity;
        for (const r of out) { const val = r.value + (W.noise ? rng.range(-W.noise, W.noise) : 0); if (val > best) { best = val; pick = r; } }
      }
      return { done: true, move: pick.first, value: pick.value, all: out };
    },
  };
}
// Run to the end (tests, puzzles). Never used in the play loop.
export function chooseMove(state, level, rng) {
  const t = createThinker(state, level, rng); let r;
  do { r = t.step(1e9); } while (!r.done);
  return r.move;
}

// A short plain-language reason for a move (hints and the computer's explanation).
export function reasonFor(s, m) {
  const me = s.turn, o = 1 - me;
  if (s.g[o].some((g) => g.pos === m.to)) return 'This captures a rival: all of it goes back to the start, and you throw again.';
  if (m.to === HOME) return 'This brings a token home.';
  if (m.short) return 'The diagonal is a much shorter way round.';
  if (m.to !== 'wait' && s.g[me].some((g) => g.pos === m.to)) return 'Landing on your own token stacks them: they travel as one.';
  if (m.from === -1) return 'Brings a new token onto the board.';
  if (m.back) return 'A step back keeps this token out of trouble or lines up a hit.';
  const c = clone(s); applyMove(c, m);
  if (hitChance(c, o, m.to) < 0.2) return 'A safe landing: the rival is unlikely to reach it.';
  return 'The best mix of progress and safety.';
}
