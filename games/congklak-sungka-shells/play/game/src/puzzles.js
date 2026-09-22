// Daily puzzle: "find the house that collects the most in one turn". The same position for everyone on a given day, from its own
// seeded stream (never env.rng, so playing other things cannot change it). Exactly one house collects the most.
import { newGame, applyMove, applyOpening, legalMoves, outcomeOf, clone } from './rules.js';

function mulberry(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export const isWeekend = (day) => { const w = (day + 3) % 7; return w === 5 || w === 6; };    // day 0 = Thursday 1 Jan 1970
export const gains = (g) => legalMoves(g).map((m) => ({ m, gain: outcomeOf(g, m).gain }));

export function puzzleFor(day) {
  const rnd = mulberry(day * 7919 + 13), hard = isWeekend(day), pick = (a) => a[Math.floor(rnd() * a.length)];
  for (let tries = 0; tries < 6000; tries++) {
    const g = newGame('single'); applyOpening(g, pick(legalMoves(g, 0)), pick(legalMoves(g, 1)));
    const plies = 6 + Math.floor(rnd() * 22);
    for (let k = 0; k < plies && g.phase === 'play'; k++) applyMove(g, pick(legalMoves(g)), false);
    if (g.phase !== 'play' || g.turn !== 0) continue;
    const gs = gains(g).sort((a, b) => b.gain - a.gain);
    if (gs.length < 3) continue;
    const top = gs[0].gain, second = gs[1].gain;
    if (top < (hard ? 7 : 4) || (hard ? second * 2 > top : second >= top)) continue;
    return { b: g.b.slice(), burnt: g.burnt.slice(), best: gs[0].m, gain: top, hard };
  }
  return { b: [0, 3, 0, 0, 2, 5, 0, 0, 1, 4, 6, 2, 0, 5, 3, 20], burnt: new Array(16).fill(false), best: 4, gain: 8, hard };
}
export function puzzleGame(p) { const g = newGame('single'); g.b = p.b.slice(); g.burnt = p.burnt.slice(); g.opening = false; g.turn = 0; return g; }
export { clone };
