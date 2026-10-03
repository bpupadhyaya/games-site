// Think: asks the engine for the best move and explains it with numbers it has just computed (never a guess).
import { legalMoves, outcome, scoreOf, other, SIDE } from './engine.js';
import { rankMoves } from './ai.js';

export const THINK_DEPTH = 6;

// Where a move reads on screen: which square from the left of its row, and which way along the screen.
export function moveWords(mv) {
  const bottom = mv.cell >= 1 && mv.cell <= 5;
  const col = bottom ? mv.cell : 12 - mv.cell; // 1..5 from the left of the row it sits in
  const dx = bottom ? mv.dir : -mv.dir;         // +1 = to the right on screen
  return { col, dx, bottom };
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
  if (o.quan > 0) return { code: 'quan', a: o.gain, b: oppAfter };
  if (o.gain > 0) return { code: 'capture', a: o.gain, b: oppAfter };
  if (oppAfter <= minOpp) return { code: 'safe', a: oppAfter, b: 0 };
  return { code: 'steady', a: oppAfter, b: lead };
}

export const sidesOf = SIDE;
