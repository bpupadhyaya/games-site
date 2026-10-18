// A slow, exact mate solver used to PROVE the daily puzzles (offline in design/tools/gen-puzzles.mjs, and in tests).
// It is not used while playing. side to move must force checkmate (or stalemate: a loss in Xiangqi) within n of its own moves.
import { legalPacked, genInto } from './rules.js';

function mk(b, m) { const f = m & 127, t = m >> 7, c = b[t]; b[t] = b[f]; b[f] = 0; return c; }
function um(b, m, c) { const f = m & 127, t = m >> 7; b[f] = b[t]; b[t] = c; }

export function canMate(b, side, n, ctx) {
  if (++ctx.nodes > ctx.limit) throw new Error('limit');
  const moves = legalPacked(b, side);
  // try mating moves first, then the rest
  for (const m of moves) {
    const c = mk(b, m), opp = legalPacked(b, -side);
    if (opp.length === 0) { um(b, m, c); return true; }
    let ok = false;
    if (n > 1) {
      ok = true;
      for (const r of opp) { const c2 = mk(b, r); const w = canMate(b, side, n - 1, ctx); um(b, r, c2); if (!w) { ok = false; break; } }
    }
    um(b, m, c);
    if (ok) return true;
  }
  return false;
}
// Every first move that forces mate within n moves (null if the node limit is hit).
export function matingMoves(board, side, n, limit = 3e6) {
  const b = board.slice(), ctx = { nodes: 0, limit }, out = [];
  try {
    for (const m of legalPacked(b, side)) {
      const c = mk(b, m), opp = legalPacked(b, -side);
      let ok = opp.length === 0;
      if (!ok && n > 1) { ok = true; for (const r of opp) { const c2 = mk(b, r); const w = canMate(b, side, n - 1, ctx); um(b, r, c2); if (!w) { ok = false; break; } } }
      um(b, m, c);
      if (ok) out.push(m);
    }
  } catch (e) { if (e.message === 'limit') return null; throw e; }
  return out;
}
// smallest n <= max such that side can force mate, else 0
export function mateDistance(board, side, max, limit) {
  for (let n = 1; n <= max; n++) { const r = matingMoves(board, side, n, limit); if (r === null) return -1; if (r.length) return n; }
  return 0;
}
// Full solution tree of a mate-in-n: { "from-to": { reply: "from-to" | null, next: {...} | null } }
export function solutionTree(board, side, n, limit = 3e6) {
  const firsts = matingMoves(board, side, n, limit), tree = {};
  for (const m of firsts) {
    const b = board.slice(); mk(b, m);
    const opp = legalPacked(b, -side), key = (m & 127) + '-' + (m >> 7);
    if (opp.length === 0) { tree[key] = { reply: null, next: null }; continue; }
    let bestR = null, bestD = -1;
    for (const r of opp) {                                // the defender picks the reply that delays mate the longest
      const b2 = b.slice(); mk(b2, r);
      let d = 0; for (let k = 1; k < n; k++) { if (matingMoves(b2, side, k, limit).length) { d = k; break; } }
      if (d > bestD) { bestD = d; bestR = r; }
    }
    const b2 = b.slice(); mk(b2, bestR);
    tree[key] = { reply: (bestR & 127) + '-' + (bestR >> 7), next: solutionTree(b2, side, bestD, limit) };
  }
  return tree;
}
