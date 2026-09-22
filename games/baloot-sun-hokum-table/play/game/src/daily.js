// The daily deal: a five-trick endgame with every hand face up. A double-dummy solver PROVES the target is reachable
// (and that a natural-looking lead falls short), so the puzzle always has a real answer. Own seeded stream: everyone
// gets the same deal on the same day.
import { newDeck, suitOf, teamOf, legalFor, trickWinnerIdx, points, handSort, newHand, mk, SUIT_NAMES } from './rules.js';
import { policyPick } from './ai.js';

const lcg = (seed) => { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); };

export function makeSolver(ct, limit = Infinity) {
  const memo = new Map(); let nodes = 0;
  const mask = (h) => h.reduce((m, c) => m + 2 ** c, 0);
  function rec(hands, plays, turn, left) {
    if (plays.length === 4) {
      const w = plays[trickWinnerIdx(plays, ct)].seat;
      let pts = 0; for (const p of plays) pts += points(ct, p.card);
      if (left === 1) return teamOf(w) === 0 ? pts + 10 : 0;
      const sc = teamOf(w) === 0 ? pts : 0;
      return sc + rec(hands, [], w, left - 1);
    }
    let key;
    if (!plays.length) { key = hands.map(mask).join('|') + turn; const m = memo.get(key); if (m !== undefined) return m; }
    const legal = legalFor(hands[turn], plays, ct, turn), max = teamOf(turn) === 0;
    let best = max ? -1 : 1e9;
    for (const c of legal) {
      if (++nodes > limit) throw new Error('budget');
      const h = hands[turn], i = h.indexOf(c); h.splice(i, 1); plays.push({ seat: turn, card: c });
      const v = rec(hands, plays, (turn + 1) & 3, left);
      plays.pop(); h.splice(i, 0, c);
      if (max ? v > best : v < best) best = v;
    }
    if (key !== undefined) memo.set(key, best);
    return best;
  }
  return {
    // value (team 0 points from here) of the position after `plays` are on the table, `turn` to play
    value: (hands, plays, turn, left) => rec(hands.map((h) => h.slice()), plays.map((p) => ({ ...p })), turn, left),
    nodes: () => nodes, memo,
  };
}

// value of each legal first play for seat 0 (leading)
export function leadValues(ct, hands, solver) {
  const out = [];
  for (const c of legalFor(hands[0], [], ct, 0)) {
    const hs = hands.map((h) => h.slice()); hs[0] = hs[0].filter((x) => x !== c);
    out.push({ card: c, v: solver.value(hs, [{ seat: 0, card: c }], 1, hands[0].length) });
  }
  return out;
}

export const remainingPoints = (ct, hands) => hands.flat().reduce((s, c) => s + points(ct, c), 0) + 10;

// Puzzle maker: step() tries one candidate deal under a node budget and returns { puzzle } when it finds a good one.
export function createDailyMaker(day, tricks = 4, budget = 20000) {
  const rand = lcg(day * 7919 + 13);
  let tries = 0;
  return {
    tries: () => tries,
    step() {
      tries += 1;
      const deck = newDeck(); for (let i = 31; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
      const hokum = rand() < 0.7, trump = Math.floor(rand() * 4);
      const ct = { type: hokum ? 'hokum' : 'sun', trump: hokum ? trump : -1, buyer: rand() < 0.5 ? 0 : 1, round: 1 };
      const hands = [0, 1, 2, 3].map((s) => handSort(ct, deck.slice(s * tricks, s * tricks + tricks)));
      const solver = makeSolver(ct, budget);
      let lv;
      try { lv = leadValues(ct, hands, solver); } catch (e) { return { puzzle: null }; }
      const best = Math.max(...lv.map((x) => x.v));
      const winners = lv.filter((x) => x.v === best), losers = lv.filter((x) => x.v < best);
      if (winners.length !== 1 || !losers.length) return { puzzle: null };
      const total = remainingPoints(ct, hands);
      // the natural rule-of-thumb lead must fall short, so it is a real puzzle
      const natural = policyPick(ct, 0, hands[0], [], new Uint8Array(32));
      const nv = lv.find((x) => x.card === natural).v;
      if (nv >= best || best - Math.min(...lv.map((x) => x.v)) < 8 || best < 12) return { puzzle: null };
      return { puzzle: { day, tricks, ct, hands, best, target: best, total, answer: winners[0].card, natural, nv, tries } };
    },
  };
}

// Build the playable hand for a puzzle.
export function puzzleHand(p) {
  const H = newHand({ shuffle: (a) => a }, 3, [0, 0]);
  H.contract = { ...p.ct }; H.phase = 'play'; H.dbl = null; H.rest = []; H.floor = -1;
  H.hands = p.hands.map((h) => handSort(H.contract, h));
  H.trick = []; H.leader = 0; H.turn = 0; H.tricks = 8 - p.tricks; H.leader0 = 0;
  const inH = new Set(H.hands.flat()); H.played = newDeck().filter((c) => !inH.has(c));
  H.history = Array.from({ length: 8 - p.tricks }, () => ({ leader: 0, plays: [], winner: 0 }));
  return H;
}
// After a human play, the best answer for the seat to move (double dummy). `solver` keeps its memo per puzzle.
export function bestReply(H, solver) {
  const ct = H.contract, seat = H.turn, left = H.hands[0].length + (H.trick.some((p) => p.seat === 0) ? 0 : 0) + (H.trick.length && H.trick[0].seat === 0 ? 0 : 0);
  void left;
  const legal = legalFor(H.hands[seat], H.trick, ct, seat), max = teamOf(seat) === 0;
  const remaining = Math.max(...H.hands.map((h) => h.length)) + 0;
  let bestC = legal[0], bestV = max ? -1 : 1e9;
  for (const c of legal) {
    const hs = H.hands.map((h) => h.slice()); hs[seat] = hs[seat].filter((x) => x !== c);
    const plays = [...H.trick, { seat, card: c }];
    const v = solver.value(hs, plays, (seat + 1) & 3, remaining);
    if (max ? v > bestV : v < bestV) { bestV = v; bestC = c; }
  }
  return { card: bestC, value: bestV };
}
export { mk, suitOf, SUIT_NAMES };
