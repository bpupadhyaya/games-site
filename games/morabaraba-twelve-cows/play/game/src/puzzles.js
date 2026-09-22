// The daily puzzle. Everyone gets the same one on a given day: it is grown from a day-seeded game between two careless computer
// players and kept only if the solver PROVES that the side to move can force a shot in n moves (n = 2, or 3 on weekends) with
// exactly one correct first move, and that no shot is available at once. maker.step() does a small fixed amount of work per call.
import { RULES as R } from './morabaraba.js';
import { fromRules, toRulesMove, gen, make, unmake, chooseMove, pop } from './engine.js';

const NONE = 31;
const stream = (seed) => { let s = (seed * 2654435761) >>> 0; const next = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); return { next, int: (n) => Math.floor(next() * n) }; };
export const isWeekend = (day) => day % 7 === 2 || day % 7 === 3;   // day 0 (1970-01-01) was a Thursday
const takeOf = (m) => m & 31;

// side to move can force a shot within n of its own moves against any reply (a shot by the other side breaks the plan)
function forced(p, n, ctx) {
  if (++ctx.nodes > ctx.limit) { ctx.over = true; return false; }
  const buf = new Int32Array(600), c = gen(p, buf), ms = Array.from(buf.subarray(0, c));
  for (const m of ms) if (takeOf(m) !== NONE) return true;
  if (n <= 1) return false;
  for (const m of ms) {
    make(p, m);
    const rb = new Int32Array(600), rc = gen(p, rb), replies = Array.from(rb.subarray(0, rc));
    let ok = rc > 0;
    for (const r of replies) { if (!ok) break; if (takeOf(r) !== NONE) { ok = false; break; } make(p, r); ok = forced(p, n - 1, ctx); unmake(p, r); if (ctx.over) { ok = false; break; } }
    unmake(p, m);
    if (ok) return true;
    if (ctx.over) return false;
  }
  return false;
}
// All first moves (rules moves) that keep a forced shot within n moves alive; null when the proof was too big.
export function forcingFirst(g, n, limit = 60000) {
  const p = fromRules(g), ctx = { nodes: 0, limit, over: false }, out = [], buf = new Int32Array(600), c = gen(p, buf), ms = Array.from(buf.subarray(0, c));
  for (const m of ms) {
    let ok;
    if (takeOf(m) !== NONE) ok = true;
    else if (n <= 1) ok = false;
    else {
      make(p, m); const rb = new Int32Array(600), rc = gen(p, rb), replies = Array.from(rb.subarray(0, rc)); ok = rc > 0;
      for (const r of replies) { if (takeOf(r) !== NONE) { ok = false; break; } make(p, r); const f = forced(p, n - 1, ctx); unmake(p, r); if (!f) { ok = false; break; } }
      unmake(p, m);
    }
    if (ctx.over) return null;
    if (ok) out.push(toRulesMove(m));
  }
  return out;
}

export const puzzleTitle = (pz) => `${pz.side === 1 ? 'Dark' : 'Light'} to move`;
export const puzzleGoal = (n) => `Shoot a cow in ${n} move${n === 1 ? '' : 's'}. Only one first move works.`;

const FALLBACK = () => {
  // a last resort that is always valid: Dark closes a mill at once (n = 1)
  const b = Array(24).fill(0); [0, 1, 20, 21].forEach((i) => { b[i] = 1; }); [4, 12, 13, 18, 9].forEach((i) => { b[i] = 2; });
  return { n: 1, side: 1, board: b, fallback: true };
};

export function createPuzzleMaker(day) {
  const n = isWeekend(day) ? 3 : 2;
  let rnd = stream(day), g = R.newGame(), plies = 0, games = 0, work = 0;
  return {
    step() {
      work++;
      if (work > 400) return { puzzle: FALLBACK() };
      const want = work > 250 ? 2 : n;
      if (g.winner || plies > 120) { g = R.newGame(); plies = 0; games++; rnd = stream(day * 131 + games); }
      if (g.hand[1] === 0 && g.hand[2] === 0 && plies >= 26 && R.count(g, 1) >= 4 && R.count(g, 2) >= 4) {
        const quick = forcingFirst(g, 1, 3000);
        if (quick && quick.length === 0) {
          let shorter = false;
          for (let k = 2; k < want && !shorter; k++) { const r = forcingFirst(g, k, 20000); if (!r || r.length > 0) shorter = true; }
          if (!shorter) { const f = forcingFirst(g, want, want === 3 ? 250000 : 40000); if (f && f.length === 1) return { puzzle: { n: want, side: g.turn, board: g.board.slice() } }; }
        }
      }
      const ms = R.legalMoves(g);
      R.apply(g, rnd.next() < 0.3 ? ms[rnd.int(ms.length)] : chooseMove(g, 0, rnd)); plies++;
      return { puzzle: null };
    },
  };
}
export function puzzleGame(pz) { const g = R.newGame(); g.board = pz.board.slice(); g.hand = [0, 0, 0]; g.turn = pz.side; return g; }
export { pop };
