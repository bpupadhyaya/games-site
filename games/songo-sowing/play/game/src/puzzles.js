// Daily puzzle: "find the move that captures the most". The same position for everyone on a given day, from its own
// seeded stream (never env.rng, so playing other things cannot change it). Exactly one move captures the most.
import { newGame, applyMove, legalMoves, sow, clone } from './rules.js';

function mulberry(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export const isWeekend = (day) => { const w = (day + 3) % 7; return w === 5 || w === 6; };    // day 0 = Thursday 1 Jan 1970
export const gains = (g) => legalMoves(g).map((m) => { const p = g.pits.slice(); return { m, gain: sow(p, g.turn, m).gain }; });

export function puzzleFor(day) {
  const rnd = mulberry(day * 7919 + 13), hard = isWeekend(day);
  for (let tries = 0; tries < 4000; tries++) {
    const g = newGame(), plies = 8 + Math.floor(rnd() * 24);
    for (let k = 0; k < plies && g.winner === null; k++) { const ms = legalMoves(g); applyMove(g, ms[Math.floor(rnd() * ms.length)]); }
    if (g.winner !== null || g.turn !== 0) continue;
    const gs = gains(g).sort((a, b) => b.gain - a.gain);
    if (gs.length < 3) continue;
    const top = gs[0].gain, second = gs[1].gain;
    if (top < (hard ? 5 : 3) || (hard ? second * 2 > top : second >= top)) continue;
    if (hard && gs.filter((x) => x.gain > 0).length < 2) continue;
    return { pits: g.pits.slice(), store: g.store.slice(), best: gs[0].m, gain: top, hard };
  }
  return { pits: [3, 3, 2, 6, 3, 3, 4, 4, 1, 1, 4, 4], store: [5, 5], best: 3, gain: 4, hard };
}
export function puzzleGame(p) { const g = newGame(); g.pits = p.pits.slice(); g.store = p.store.slice(); g.turn = 0; return g; }
export { clone };
