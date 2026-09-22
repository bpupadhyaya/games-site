// The daily deal: a fixed position for the day, checked by trying every play. The best play must beat every other
// by at least 2 puzzle points, so there is exactly one right answer.
import { newMatch, legalPlays, rankOf, suitOf, SETTEBELLO } from './rules.js';
export const isWeekend = (day) => { const d = (day + 4) % 7; return d === 5 || d === 6; };  // day 0 (1970-01-01) was a Thursday
const lcg = (seed) => { let s = (seed * 2654435761 + 12345) >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); };
// Puzzle value of taking cards: 1 per card, +1 per coin, +1 per 7, +4 for the 7 of coins, +3 for a scopa.
export function pv(g, p) {
  if (!p.take.length) return 0;
  let v = 0; for (const c of [p.card, ...p.take]) { v += 1 + (suitOf(c) === 0 ? 1 : 0) + (rankOf(c) === 7 ? 1 : 0) + (c === SETTEBELLO ? 4 : 0); }
  if (g.table.length === p.take.length) v += 3;
  return v;
}
export function puzzleFor(day) {
  const rnd = lcg(day), hard = isWeekend(day);
  for (let tries = 0; tries < 4000; tries++) {
    const d = Array.from({ length: 40 }, (_, i) => i);
    for (let i = 39; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [d[i], d[j]] = [d[j], d[i]]; }
    const g = newMatch(2, 11); g.hands = [d.slice(0, 3), d.slice(3, 6)]; g.table = d.slice(6, hard ? 12 : 10); g.deck = d.slice(12, 40); g.turn = 0;
    const plays = legalPlays(g, 0).map((p) => ({ ...p, v: pv(g, p) })).sort((a, b) => b.v - a.v);
    const caps = plays.filter((p) => p.take.length);
    if (caps.length < (hard ? 5 : 3) || plays[0].v - plays[1].v < 2 || !plays[0].take.length) continue;
    return { hard, day, best: { card: plays[0].card, take: plays[0].take.slice() }, value: plays[0].v, game: g, options: caps.length };
  }
  return null;
}
export const puzzleGame = (p) => JSON.parse(JSON.stringify(p.game));
