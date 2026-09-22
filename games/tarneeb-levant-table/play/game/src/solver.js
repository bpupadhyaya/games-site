// Double-dummy solver for the small open-hand puzzles (all four hands face up, a handful of cards each).
// canMake asks: with best play by all four, can team 0 (South + North) still win at least `need` more tricks?
import { suitOf, rankOf, trickWinner } from './rules.js';

export function makeSolver(trump) {
  const memo = new Map();
  const legal = (hand, trick) => {
    if (!trick.length) return hand;
    const ls = suitOf(trick[0].c), f = hand.filter((c) => suitOf(c) === ls);
    return f.length ? f : hand;
  };
  // cards of the same suit next to each other among the cards still in play play identically: try one of each run
  const distinct = (moves, alive) => {
    const out = [];
    for (const c of moves.slice().sort((a, b) => a - b)) {
      const prev = out[out.length - 1];
      if (prev !== undefined && suitOf(prev) === suitOf(c)) {
        let between = false; for (let d = prev + 1; d < c; d++) if (alive.has(d)) { between = true; break; }
        if (!between) continue;
      }
      out.push(c);
    }
    return out;
  };
  const step = (h, turn, trick, c) => {
    const nh = h.map((x, i) => (i === turn ? x.filter((y) => y !== c) : x)), nt = trick.concat([{ p: turn, c }]);
    if (nt.length < 4) return { h: nh, turn: (turn + 1) % 4, trick: nt, won: 0 };
    const w = trickWinner(nt, trump);
    return { h: nh, turn: w, trick: [], won: (w & 1) === 0 ? 1 : 0 };
  };
  function can(h, turn, trick, need) {
    const left = h[turn].length;
    if (need <= 0) return true;
    if (need > left) return false;
    const key = `${turn}|${h.map((x) => x.join(',')).join('/')}|${trick.map((t) => t.c).join(',')}|${need}`;
    const m = memo.get(key); if (m !== undefined) return m;
    const alive = new Set(); for (const x of h) for (const c of x) alive.add(c); for (const t of trick) alive.add(t.c);
    const moves = distinct(legal(h[turn], trick), alive), ns = (turn & 1) === 0;
    let res = !ns;
    for (const c of moves) {
      const s = step(h, turn, trick, c), r = can(s.h, s.turn, s.trick, need - s.won);
      if (ns && r) { res = true; break; }
      if (!ns && !r) { res = false; break; }
    }
    memo.set(key, res); return res;
  }
  // the most tricks team 0 can win from this position
  const best = (h, turn, trick) => { let k = h[turn].length; while (k > 0 && !can(h, turn, trick, k)) k--; return k; };
  // all cards of `turn` (legal, distinct) that keep `need` makeable for team 0 (or, for team 1, that keep it from being made)
  function goodMoves(h, turn, trick, need) {
    const alive = new Set(); for (const x of h) for (const c of x) alive.add(c); for (const t of trick) alive.add(t.c);
    const ns = (turn & 1) === 0, out = [];
    for (const c of legal(h[turn], trick)) {
      const s = step(h, turn, trick, c), r = can(s.h, s.turn, s.trick, need - s.won);
      if (ns ? r : !r) out.push(c);
    }
    void alive; return out;
  }
  return { can, best, goodMoves };
}
