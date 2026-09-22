// Daily puzzle: "find the move that takes the most". The same position for everyone on a given day, from its own seeded
// stream (never env.rng, so playing other things cannot change it). Exactly one move takes the most; a move that makes
// a tuz counts the three pebbles it collects, like any capture.
import { newGame, applyMove, legalMoves, sow, clone } from './rules.js';

function mulberry(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export const isWeekend = (day) => { const w = (day + 3) % 7; return w === 5 || w === 6; };    // day 0 = Thursday 1 Jan 1970
export const gains = (g) => legalMoves(g).map((m) => { const r = sow(g.pits.slice(), g.kazan.slice(), g.tuz.slice(), g.turn, m, false); return { m, gain: r.gain, tuz: r.tuzMade >= 0 }; });

export function puzzleFor(day) {
  const rnd = mulberry(day * 7919 + 13), hard = isWeekend(day);
  for (let tries = 0; tries < 3000; tries++) {
    const g = newGame(), plies = 10 + Math.floor(rnd() * 50);
    for (let k = 0; k < plies && g.winner === null; k++) { const ms = legalMoves(g); applyMove(g, ms[Math.floor(rnd() * ms.length)]); }
    if (g.winner !== null || g.turn !== 0) continue;
    const gs = gains(g).sort((a, b) => b.gain - a.gain);
    if (gs.length < 3) continue;
    const top = gs[0].gain, second = gs[1].gain;
    if (top < (hard ? 12 : 6) || (hard ? second * 2 > top : second >= top)) continue;
    if (hard && gs.filter((x) => x.gain > 0).length < 2) continue;
    return { pits: g.pits.slice(), kazan: g.kazan.slice(), tuz: g.tuz.slice(), best: gs[0].m, gain: top, hard, tuzMove: gs[0].tuz };
  }
  const g = newGame(); g.pits = [8, 8, 8, 5, 8, 8, 6, 8, 8, 8, 5, 8, 8, 8, 8, 8, 8, 8]; g.kazan = [16, 16];
  return { pits: g.pits.slice(), kazan: g.kazan.slice(), tuz: [-1, -1], best: 6, gain: 6, hard, tuzMove: false };
}
export function puzzleGame(p) { const g = newGame(); g.pits = p.pits.slice(); g.kazan = p.kazan.slice(); g.tuz = p.tuz.slice(); g.turn = 0; return g; }
export { clone };
