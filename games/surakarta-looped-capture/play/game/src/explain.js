// Think: the search's best move plus a plain-English reason. Every claim is checked against the real position
// (a "saves a piece" really removes an attack on it, a "threat" really adds a capture) before it is said.
import { applyMove, attackedBy, other, countOf, onCircuit, captureRoute, sideName, result } from './rules.js';
import { createSearch, searchNow } from './ai.js';

// The level Think and Watch & Learn's reasons use: deeper than any opponent but Master, with a fixed node budget.
export const THINK_LEVEL = { id: 'think', name: 'Think', depth: 6, q: 4, noise: 0, nodes: 250000 };

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

export function reasonFor(st, mv, score) {
  const me = st.turn, opp = other(me), who = sideName(me), foe = sideName(opp);
  const after = applyMove(st, mv);
  const cap = st.cells[mv.to] !== 0;
  const r = result(after);
  const myNow = attackedBy(st.cells, me);        // their pieces I can capture now
  const hitNow = attackedBy(st.cells, opp);      // my pieces they can capture now
  const hitAfter = attackedBy(after.cells, opp); // my pieces they could capture after my move
  const myAfter = attackedBy(after.cells, me);   // their pieces I could capture after my move (if I moved again)
  const route = cap ? captureRoute(st.cells, mv.from, mv.to, me) : null;
  const head = cap ? `Capture with the glowing ${who} piece` : `Step the glowing ${who} piece`;
  if (r && r.winner === me) {
    if (r.why === 'captured') return { head, why: `This wins: it takes ${foe}'s last piece.` };
    if (r.why === 'blocked') return { head, why: `This wins: ${foe} is left with no legal move.` };
    return { head, why: `This ends the game with you ahead on pieces, so you win.` };
  }
  if (cap) {
    const hanging = hitAfter.has(mv.to);
    const others = [...hitAfter].filter((p) => p !== mv.to).length;
    if (!hanging && hitAfter.size === 0) return { head, why: `Wins a piece, and afterwards none of your pieces can be captured. A clean capture.` };
    if (!hanging) return { head, why: `Wins a piece, and the capturing piece itself is safe. ${plural(others, 'other piece of yours is', 'other pieces of yours are')} still under attack, but you have won a piece.` };
    return { head, why: `Wins a piece. ${foe} can capture back on that point, but looking ahead the exchange still leaves you better off${score > 150 ? ' by more than a piece' : ''}.` };
  }
  if (hitNow.size > 0 && hitAfter.size < hitNow.size) {
    if (hitAfter.size === 0) return { head, why: `Saves your pieces: ${plural(hitNow.size, 'piece of yours was', 'pieces of yours were')} open to capture, and after this move none is.` };
    return { head, why: `Reduces the danger: ${plural(hitNow.size, 'piece was', 'pieces were')} open to capture, now ${hitAfter.size}.` };
  }
  if (myAfter.size > myNow.size) {
    const safe = hitAfter.size === 0 ? ' and nothing of yours is under attack' : '';
    return { head, why: `Builds a threat: next turn you could capture ${plural(myAfter.size, 'piece', 'pieces')} of theirs${safe}.` };
  }
  if (!onCircuit(mv.from) && onCircuit(mv.to)) return { head, why: `Brings a piece out of a corner, which is on no circuit, onto a circuit where it can start to attack.` };
  if (hitAfter.size === 0 && hitNow.size === 0) return { head, why: `A quiet, safe move: none of your pieces can be captured and it improves your position.` };
  return { head, why: `The strongest move the search found: it keeps the balance and gives ${foe} the fewest chances.` };
}

// Finish a hint from a completed search result.
export function hintFrom(st, res) {
  if (!res.mv) return null;
  const mine = res.list.find((x) => x.mv.from === res.mv.from && x.mv.to === res.mv.to);
  const score = mine ? mine.s : 0;
  const { head, why } = reasonFor(st, res.mv, score);
  const route = st.cells[res.mv.to] !== 0 ? captureRoute(st.cells, res.mv.from, res.mv.to, st.turn) : null;
  return { mv: { from: res.mv.from, to: res.mv.to, cap: st.cells[res.mv.to] !== 0 }, head, why, route, score };
}

export const startHintSearch = (st, rng) => createSearch(st, THINK_LEVEL, rng);
export const hintNow = (st, rng) => hintFrom(st, searchNow(st, THINK_LEVEL, rng));
export { countOf };
