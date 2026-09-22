// The daily challenge: a fixed position and fixed throws; play the whole turn. Scored against the best turn the search finds.
import { createRng } from '../kit/rng.js';
import { newGame, applyMove, settle, clone } from './rules.js';
import { createThinker, LEVELS, reasonFor, evaluate } from './ai.js';

export const PUZZLE_W = LEVELS[4];
const defPrev = (p) => (p === 1 ? -1 : { 20: 5, 21: 20, 22: 21, 23: 22, 24: 23, 25: 10, 26: 25, 27: 22, 28: 27 }[p] ?? p - 1);

function candidate(rng, weekend) {
  const s = newGame(0), taken = new Set();
  for (const t of [0, 1]) {
    const onBoard = 1 + rng.int(3), home = rng.chance(0.25) ? 1 : 0;
    let placed = 0;
    while (placed < onBoard && s.wait[t] + home + placed < 4 + 1) {
      const pos = 1 + rng.int(28);
      if (taken.has(pos) || pos === 0) continue;
      taken.add(pos); s.g[t].push({ pos, n: 1, prev: defPrev(pos) }); placed++;
    }
    s.home[t] = home; s.wait[t] = 4 - home - placed;
  }
  const pick = () => rng.pick([1, 2, 2, 3, 3, 4, 1, 5, 2, -1].filter((v) => v !== -1 || rng.chance(0.4)));
  s.pending = weekend ? [pick(), pick(), pick()] : [pick(), pick()];
  s.phase = 'move';
  return s;
}
const label = (s, m) => {
  const r = reasonFor(s, m);
  if (r.startsWith('This captures')) return 'capture a rival';
  if (r.startsWith('This brings')) return 'bring a token home';
  if (r.startsWith('The diagonal')) return 'take the diagonal shortcut';
  if (r.startsWith('Landing')) return 'stack two tokens';
  if (r.startsWith('Brings a new')) return 'enter a new token';
  return 'advance safely';
};

// One candidate per step() so the title screen can grow it in the background without a hitch.
export function createPuzzleMaker(day) {
  const rng = createRng((Math.imul(day + 17, 2654435761) ^ 0x51ed270b) >>> 0);
  const weekend = ((day % 7) + 7) % 7 >= 2 && ((day % 7) + 7) % 7 <= 3; // 1970-01-01 was a Thursday: days 2,3 mod 7 = Sat, Sun
  let tries = 0;
  return {
    step() {
      tries++;
      const s = candidate(rng, weekend), th = createThinker(s, 4, rng, { leafCap: 900 });
      let r; do { r = th.step(1e9); } while (!r.done);
      const all = r.all; if (!all || all.length < 6) return tries > 60 ? { puzzle: fallback(rng) } : {};
      let best = all[0], worst = all[0];
      for (const x of all) { if (x.value > best.value) best = x; if (x.value < worst.value) worst = x; }
      const bt = bestText(s, best.seq);
      const hasPoint = bt.parts.some((p) => p === 'capture a rival' || p === 'take the diagonal shortcut' || p === 'bring a token home');
      if ((!hasPoint || best.value - worst.value < 8) && tries < 60) return {};
      // text of the best turn (replays it on a copy to word each step correctly)
      return { puzzle: { g: s, best: best.value, worst: worst.value, count: all.length, weekend, bestText: bt } };
    },
  };
}
function bestText(s0, seq) {
  const parts = []; const s = clone(s0);
  for (const m of seq) { parts.push(label(s, m)); applyMove(s, m); settle(s); }
  return { seq: seq.map((m) => m.v), parts };
}
function fallback(rng) {
  const s = newGame(0); s.g[0].push({ pos: 5, n: 1, prev: 4 }); s.g[1].push({ pos: 8, n: 1, prev: 7 }); s.wait = [3, 3]; s.pending = [2, 3]; s.phase = 'move';
  return { g: s, best: 0, worst: -99, count: 0, weekend: false, bestText: { seq: [3, 2], parts: ['take the diagonal shortcut', 'advance safely'] } };
}
export function rate(puzzle, finalState) {
  const v = evaluate(finalState, 0, PUZZLE_W), span = Math.max(1, puzzle.best - puzzle.worst), q = (v - puzzle.worst) / span;
  return v >= puzzle.best - 0.01 ? 3 : q >= 0.8 ? 2 : 1;
}
export const dayIsWeekend = (day) => { const d = ((day % 7) + 7) % 7; return d === 2 || d === 3; };
