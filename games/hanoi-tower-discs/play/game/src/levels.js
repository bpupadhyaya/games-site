// Level list. Chapter 0: the classic tower on three pegs (3 to 10 discs). Chapter 1: four pegs (3 to 8 discs).
// Chapter 2: scrambles, which start from a fixed, deterministic mixed-up position and ask for all discs on a
// named goal peg. Every minimum is computed exactly by the solver; nothing here is typed in by hand.
import { createRng } from '../kit/rng.js';
import { movesLeft, isSolved } from './solver.js';

export const CHAPTER_NAMES = ['The Classic Tower', 'Four Pegs', 'Scrambles'];
export const CHAPTER_BLURBS = [
  'Move the whole tower from A to C. Three to ten discs.',
  'A spare peg makes it quicker. A to D.',
  'The discs start mixed up. Gather them all on the gold peg.',
];

const SCRAMBLES = [[4, 3], [4, 3], [5, 3], [5, 3], [5, 4], [6, 3], [6, 4], [6, 3], [7, 3], [7, 4], [7, 3], [8, 3]];

export const LEVELS = [];
for (let n = 3; n <= 10; n++) LEVELS.push({ id: `c${n}`, ch: 0, n, P: 3, goal: 2, name: `${n} discs`, seed: 0 });
for (let n = 3; n <= 8; n++) LEVELS.push({ id: `f${n}`, ch: 1, n, P: 4, goal: 3, name: `${n} discs`, seed: 0 });
SCRAMBLES.forEach(([n, P], i) => LEVELS.push({ id: `s${i + 1}`, ch: 2, n, P, goal: (i * 2 + 1) % P, name: `Scramble ${i + 1}`, seed: 1000 + i * 77 + (i % 4) - ((1000 + i * 77) % 4) }));

// A deterministic mixed-up start for (n, P, goal): of 150 seeded tries, the position whose exact distance to the goal
// is closest to a target share of the full tower's minimum (the share cycles 40% to 85% by seed), never already solved.
export function scrambleStart(n, P, goal, seed) {
  const rng = createRng(seed >>> 0);
  const full = movesLeft(new Array(n).fill((goal + 1) % P), P, goal);
  const target = full * (0.4 + 0.15 * (seed % 4));
  let best = null, bestGap = Infinity;
  for (let t = 0; t < 150; t++) {
    const pegOf = Array.from({ length: n }, () => rng.int(P));
    if (isSolved(pegOf, goal)) continue;
    const gap = Math.abs(movesLeft(pegOf, P, goal) - target);
    if (gap < bestGap) { bestGap = gap; best = pegOf; }
  }
  return best ?? [...Array(n).keys()].map((d) => (d % 2 ? goal : (goal + 1) % P));
}

const starts = new Map();
export function levelStart(level) {
  let s = starts.get(level.id);
  if (!s) {
    s = level.seed ? scrambleStart(level.n, level.P, level.goal, level.seed) : new Array(level.n).fill(0);
    starts.set(level.id, s);
  }
  return [...s];
}

export const levelMin = (level) => movesLeft(levelStart(level), level.P, level.goal);

// The Daily Challenge: same day, same position for everyone. 3 or 4 pegs, 4 to 7 discs.
export function dailyLevel(day) {
  const r = createRng(((day * 2654435761) ^ 0x51ed270b) >>> 0);
  const P = r.chance(0.4) ? 4 : 3;
  const n = 4 + r.int(P === 4 ? 4 : 4);
  const goal = r.int(P);
  return { id: `daily-${day}`, ch: -1, n, P, goal, name: 'Daily Challenge', seed: ((day * 40503) ^ 0x2545f491) >>> 0 || 1 };
}

export function stars(moves, min) {
  if (moves <= min) return 3;
  if (moves <= Math.ceil(min * 1.5)) return 2;
  return 1;
}
