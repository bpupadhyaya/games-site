// Think: asks the engine for the best move and explains it with numbers it has just computed (never a guess).
import { legalMoves, outcome, scoreOf, other, isInner, colOf, takeable, play } from './engine.js';
import { rankMoves } from './ai.js';

export const THINK_DEPTH = 8;

// Where a move reads on screen: its row (0 the outer row, 1 the inner row) and its column counted from the left (1 to 7).
export function moveWords(mv) {
  return { row: isInner(mv.cell) ? 1 : 0, col: colOf(mv.cell) + 1 };
}

// The opponent's strongest immediate answer (points they gain on their next turn), 1 turn deep.
export function bestReply(st) {
  if (st.over) return 0;
  let best = 0;
  for (const m of legalMoves(st)) best = Math.max(best, outcome(st, m).gain);
  return best;
}

export function hint(st) {
  const ranked = rankMoves(st, THINK_DEPTH);
  let top = -Infinity;
  for (const r of ranked) if (r.v > top) top = r.v;
  const best = ranked.find((r) => r.v >= top - 1e-9);
  return { mv: best.mv, ...reasonFor(st, best.mv, ranked) };
}

// A reason: { code, a, b } where code names the template in content.js and a/b are the verified numbers.
export function reasonFor(st, mv, ranked) {
  const me = st.turn, o = outcome(st, mv);
  const replies = ranked ?? rankMoves(st, 2);
  const oppAfter = bestReply(o.after);
  let minOpp = Infinity;
  for (const r of replies) minOpp = Math.min(minOpp, bestReply(outcome(st, r.mv).after));
  const lead = scoreOf(o.after, me) - scoreOf(o.after, other(me));
  if (o.after.over) {
    const w = o.after.over.winner;
    return { code: w === me ? 'endWin' : w === 0 ? 'endDraw' : 'endLoss', a: o.gain, b: lead };
  }
  if (o.got > 0) return { code: 'capture', a: o.got, b: oppAfter };
  if (legalMoves(st).length === 1) return { code: 'only', a: 0, b: 0 };
  if (oppAfter <= minOpp) return { code: oppAfter === 0 ? 'safe0' : 'safe', a: oppAfter, b: 0 };
  return { code: 'steady', a: oppAfter, b: lead };
}

// Seeds the player to move could capture by landing in this hole as the last seed (used by the lessons and the Rules art).
export const threatAt = (st, p, hole) => takeable(st, p, hole).reduce((a, h) => a + st.cells[h], 0);
export { play };
