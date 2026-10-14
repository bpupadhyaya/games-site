// Match rules on top of the engine: rounds of ten coins, whose coin it is, the chalk count and the win. Pure data + functions.
//
// A round is five coins a side, played one at a time with the sides alternating (the side that won fewer chalks starts the next round).
// The moment a coin has come to rest, every coin on the board that lies wholly in a bed and has not scored yet scores a chalk
// (sim.tally). Coins stay on the board until the round ends, as obstacles and as things to nudge; then they are picked up.
// First to `target` filled beds wins (9 in Full, 5 in Quick).
import { COINS_PER_SIDE, sweep, tally, bedsWon, chalkCount } from './sim.js';

export const TARGETS = { quick: 5, full: 9 };
export const MAX_ROUNDS = 14;
export const MAX_SOLO_ROUNDS = 18;

export function newMatch(cfg) {
  const sides = cfg.mode === 'solo' ? 1 : 2;
  const target = cfg.target === 5 ? 5 : 9;
  return {
    cfg, sides, target,
    chalks: Array.from({ length: sides }, () => Array(9).fill(0)),
    round: 0, starter: cfg.first ?? 0, idx: 0, side: sides === 1 ? 0 : (cfg.first ?? 0), table: [],
    placed: Array(sides).fill(0), swept: Array(sides).fill(0), knocked: Array(sides).fill(0), fell: Array(sides).fill(0),
    best: Array(sides).fill(0),            // most chalks won in one round
    got: Array(sides).fill(0),             // chalks won this round
    over: null,
  };
}
export const perRound = (m) => m.sides * COINS_PER_SIDE;
export const sideOf = (m) => (m.sides === 1 ? 0 : (m.starter + m.idx) % 2);
export const beds = (m) => m.chalks.map(bedsWon);
export const chalkTotals = (m) => m.chalks.map(chalkCount);

// A coin has come to rest: `table` is the board after the caller removed fallen coins and swept the blank run. Chalks are
// awarded now. Returns { kind: 'next' | 'round-end', awards, over }.
export function afterCoin(m, table, info = {}) {
  const s = m.side;
  m.table = table;
  m.placed[s]++;
  if (info.swept) m.swept[s] += info.swept;
  if (info.fell) m.fell[s] += info.fell;
  if (info.knocked) m.knocked[s] += info.knocked;
  const before = m.chalks.map((c) => c.slice());
  const awards = tally(m.chalks, table, m.sides);
  for (const a of awards) if (a.side >= 0) { m.got[a.side]++; m.best[a.side] = Math.max(m.best[a.side], m.got[a.side]); }
  // the target may be reached by either side; the first chalk (in play order) that completes it decides
  const ch = before.map((c) => c.slice());
  let winner = -1;
  for (const a of awards) {
    if (a.side < 0) continue;
    ch[a.side][a.bed]++;
    if (bedsWon(ch[a.side]) >= m.target) { winner = a.side; break; }
  }
  const result = { kind: 'next', awards, over: null };
  if (winner >= 0) {
    m.over = m.sides === 1 ? { win: 0, rounds: m.round + 1, beds: bedsWon(m.chalks[0]) } : { win: winner, beds: beds(m), chalks: chalkTotals(m), rounds: m.round + 1 };
    result.over = m.over; result.kind = 'round-end'; m.table = [];
    return result;
  }
  m.idx++;
  if (m.idx >= perRound(m)) return endRound(m, result);
  m.side = sideOf(m);
  return result;
}

function endRound(m, result) {
  result.kind = 'round-end';
  const limit = m.sides === 1 ? MAX_SOLO_ROUNDS : MAX_ROUNDS;
  if (m.round + 1 >= limit) {
    const nb = beds(m), ct = chalkTotals(m);
    if (m.sides === 1) m.over = { win: -1, rounds: m.round + 1, beds: nb[0], timeout: true };
    else {
      const win = nb[0] !== nb[1] ? (nb[0] > nb[1] ? 0 : 1) : ct[0] !== ct[1] ? (ct[0] > ct[1] ? 0 : 1) : -1;
      m.over = { win, beds: nb, chalks: ct, rounds: m.round + 1, timeout: true };
    }
    result.over = m.over; m.table = [];
    return result;
  }
  // the side that won fewer chalks this round starts the next (level: the other side starts)
  const g = m.got.slice();
  m.round++; m.idx = 0; m.table = []; m.got.fill(0);
  m.starter = m.sides === 1 ? 0 : g[0] === g[1] ? 1 - m.starter : g[0] < g[1] ? 0 : 1;
  m.side = sideOf(m);
  return result;
}

// What stays on the board after a coin, and what was swept away at once.
export function afterSweep(table) {
  const kept = sweep(table);
  return { kept, dead: table.filter((c) => !c.out && !kept.includes(c)) };
}
