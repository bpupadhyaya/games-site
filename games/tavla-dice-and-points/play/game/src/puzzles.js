// The daily puzzle: a real position, a fixed roll, and one clearly best way to play it.
// Everyone gets the same puzzle on the same day (seeded by env.config.day). The puzzle is found by the same search the
// computer's Master level uses, and only kept when the best play beats every other play by a clear margin.
import { newGame, clone, expandRoll, key, isOver, winner } from './rules.js';
import { createThinker, contact, reasonFor } from './ai.js';

const mirror = (s) => { const n = clone(s); n.board = s.board.map((_, i) => -s.board[23 - i]); n.bar = [s.bar[1], s.bar[0]]; n.off = [s.off[1], s.off[0]]; return n; };
const lcg = (seed) => { let s = seed >>> 0; return { next: () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296) }; };

export function createPuzzleMaker(day) {
  const rng = lcg(day * 2654435761 + 12345), it = make(rng);
  let out = null;
  return { step() { if (out) return out; const r = it.next(); if (r.done) out = { puzzle: r.value }; return out || { puzzle: null }; } };
}
function* make(rng) {
  for (let attempt = 0; attempt < 60; attempt++) {
    // play a random game with the quick Club level to a random moment in the middle
    let s = newGame(), side = rng.next() < 0.5 ? 0 : 1, plies = 6 + Math.floor(rng.next() * 16), ok = true;
    for (let p = 0; p < plies && ok; p++) {
      const r = [1 + Math.floor(rng.next() * 6), 1 + Math.floor(rng.next() * 6)], t = createThinker(s, side, expandRoll(r), 1, rng);
      let res; do { res = t.step(); if (!res.done) yield; } while (!res.done);
      if (!res.cand) { side = 1 - side; continue; }
      s = res.cand.after; s.moves = 0; side = 1 - side;
      if (isOver(s)) ok = false;
    }
    if (!ok || !contact(s)) continue;
    const roll = [1 + Math.floor(rng.next() * 6), 1 + Math.floor(rng.next() * 6)], dice = expandRoll(roll);
    const t = createThinker(s, side, dice, 3, rng); let res; do { res = t.step(); if (!res.done) yield; } while (!res.done);
    const sc = res.scored; if (sc.length < 4 || sc.length > 70) continue;
    if (sc[0].v - sc[1].v < 0.16) continue;
    // the best play must not be the one the plain evaluation would also pick (otherwise it is no puzzle)
    let best = sc[0].c;
    if (side === 1) { const m = (i) => (i < 24 ? 23 - i : i); s = mirror(s); best = { steps: best.steps.map((x) => ({ ...x, from: m(x.from), to: m(x.to) })), after: mirror(best.after) }; side = 0; }
    return { pos: clone(s), side, roll, best: key(best.after), bestSteps: best.steps, why: reasonFor(s, best, side), n: sc.length };
  }
  // fallback: the opening 3-1 (make the 5 point), always valid
  const s = newGame(), dice = [3, 1], t = createThinker(s, 0, dice, 3, rng); let res; do { res = t.step(); } while (!res.done);
  return { pos: clone(s), side: 0, roll: [3, 1], best: key(res.cand.after), bestSteps: res.cand.steps, why: reasonFor(s, res.cand, 0), n: res.scored.length };
}
