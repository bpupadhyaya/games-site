// Think: the solver's best move plus a plain-English reason. Every reason is checked against the position
// (a "block" really stops a win, a "fork" really leaves two winning squares) before it is said.
import { SPECS, applyMove, result, other, wordsOf, isPlacing, nameOf, legalMoves, countOf } from './rules.js';
import { scoreMoves } from './solver.js';
import { winSquares, winMoves, forkMoves, lineMoves, lineCount, markName, lineKind } from './analysis.js';
import { bestMoves } from './ai.js';

const cap = (s) => s[0].toUpperCase() + s.slice(1);

export function reasonFor(st, mv, list = scoreMoves(st)) {
  const me = st.turn, opp = other(me), M = markName(me), O = markName(opp), mode = st.mode, sp = SPECS[mode];
  const after = applyMove(st, mv);
  const r = result(after);
  const where = wordsOf(mode, mv.to);
  const mine = list.find((x) => x.mv.from === mv.from && x.mv.to === mv.to);
  const s = mine ? mine.s : 0;
  const unique = list.filter((x) => x.s >= (s > 0 ? 1 : 0)).length === 1 && list.length > 1;
  const slide = mv.from >= 0;
  const act = slide ? `Slide ${wordsOf(mode, mv.from)} to ${where}` : `Play ${where}`;

  if (r && r.winner === me) return { head: act, why: `This wins: it makes ${lineKind(mode, r.line)}.` };
  if (r && r.winner === opp) {
    return { head: act, why: sp.misere ? `Every move completes three in a row here, so this one cannot be helped.` : `Every move loses here.` };
  }
  const oppWins = winSquares(st, opp);
  if (oppWins.length && !winMoves(after, opp).length) {
    return { head: act, why: `This blocks ${O}'s ${sp.size === 3 ? 'three' : 'four'} in a row${slide ? '' : ` at ${where}`}. ${cap(O)} was about to win there.` };
  }
  if (sp.misere) {
    const risky = lineMoves(st, me).length;
    if (s > 0) return { head: act, why: `A winning move. Whatever ${O} does, ${O} is eventually left with only moves that complete three in a row.` };
    if (s === 0 && unique) return { head: act, why: `The only move that does not lose. Completing three in a row loses here, so it keeps as many safe squares as possible.` };
    return { head: act, why: risky ? `Completing three in a row loses here. This move keeps you safe and keeps the game level.` : `Nothing is at risk yet. This keeps the game level with perfect play.` };
  }
  const myWins = winMoves(after, opp).length ? [] : winSquares(after, me);
  if (myWins.length >= 2) return { head: act, why: `This creates a fork: two different ways to win at once. ${cap(O)} can only stop one of them.` };
  const oppForks = forkMoves(st, opp);
  if (oppForks.length && !forkMoves(after, opp).length) {
    if (oppForks.some((f) => f.to === mv.to && f.from === -1)) return { head: act, why: `This blocks a fork. ${cap(O)} was about to play here and threaten two lines at once.` };
    if (myWins.length === 1) return { head: act, why: `This makes a threat that ${O} must answer, which also stops ${O}'s fork.` };
    return { head: act, why: `This stops a fork. It leaves ${O} no move that threatens two lines at once.` };
  }
  if (myWins.length === 1) return { head: act, why: `This makes a threat: ${O} must block at ${wordsOf(mode, myWins[0])}.` };
  if (s > 0) return { head: act, why: `This keeps a forced win. Against best play ${M} wins from here.` };
  if (s < 0 && !slide) return { head: act, why: `This position is lost against perfect play. This move holds out the longest.` };
  if (s < 0) return { head: act, why: `This position is lost against perfect play. This move holds out the longest.` };
  if (unique) return { head: act, why: `The only move that does not lose. Every other move gives ${O} a forced win.` };
  if (!slide && isPlacing(st)) {
    const lc = lineCount(mode)[mv.to];
    if (mode !== 'quad' && mv.to === 4) return { head: act, why: `The centre lies on four lines, more than any other point, and it keeps the game level with perfect play.` };
    if (mode !== 'quad' && mv.to % 2 === 0) return { head: act, why: `A corner lies on three lines and keeps the game level with perfect play.` };
    return { head: act, why: `This point lies on ${lc} winning lines and keeps the game level with perfect play.` };
  }
  return { head: act, why: `A safe move: it keeps the game level with perfect play.` };
}

// The hint for the player to move: the solver's best move (ties: the move on the most lines), with its reason.
export function hint(st) {
  const list = scoreMoves(st);
  if (!list.length) return null;
  const lc = lineCount(st.mode);
  const best = bestMoves(st, list).sort((a, b) => lc[b.mv.to] - lc[a.mv.to] || a.mv.to - b.mv.to);
  const mv = best[0].mv;
  const { head, why } = reasonFor(st, mv, list);
  return { mv, head, why, score: best[0].s };
}

// Short sentence for Watch & Learn: what the opponent-AI is about to do and why.
export function describe(st, mv, list) {
  const { head, why } = reasonFor(st, mv, list);
  return { head, why };
}
export { nameOf, legalMoves, countOf };
