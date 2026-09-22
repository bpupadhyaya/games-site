// Daily deal: everyone gets the same puzzle on the same day (env.config.day). It is a real stock-empty, 2-player
// endgame with BOTH hands shown (a solved position, like a chess puzzle) where only one first move keeps you safe.
// Built by self-play from a day-seeded stream until the stock runs out, then verified with solve() (rules.js/ai.js
// minimax over the fully visible state). step() does a small bounded amount of work per call so generation never
// stalls a frame; it is fully deterministic (its own seeded stream, no clock).
import { newDeal, clone, apply, legalMoves } from './rules.js';
import { heuristicMove, solve } from './ai.js';

function stream(seed) {
  let s = (seed * 2654435761) >>> 0;
  const next = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  return { next, int: (n) => Math.floor(next() * n), chance: (p) => next() < p, pick: (a) => a[Math.floor(next() * a.length)], fork: () => stream((s ^ 0x9e3779b9) >>> 0), shuffle(a) { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(next() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; } };
}

// A hand-built fallback (always solvable, always exactly one correct first move): trump hearts, you (seat 0) to
// defend a trump lead with a low trump when a higher one would be wasted, everything else forced from there.
function fallback() {
  const H = 1, D = 2, S = 0, C = 3, card = (s, r) => s * 9 + r;
  const g = { n: 2, mode: 'pod', hands: [[card(H, 2), card(D, 6)], [card(H, 6), card(S, 8)]], stock: [], trump: H, trumpCard: card(H, 0), discard: [], table: [{ a: card(H, 6), d: -1 }], attacker: 1, defender: 0, actor: 0, phase: 'defend', taking: false, passes: 0, cap: 2, first: false, out: [false, false], finished: [], loser: -1, over: false, bout: 1, known: [[], []], refused: [] };
  return { game: g, you: 0, title: 'Seen through', goal: 'Find the one move that keeps you out of the fool\'s seat.' };
}

export function createPuzzleMaker(day) {
  const rnd = stream(day * 1000003 + 7);
  let plies = 0, attempts = 0, g = newDeal(rnd, 2, day % 2 ? 'pod' : 'per');
  return {
    step() {
      attempts++;
      if (attempts > 4000) return { puzzle: fallback() };
      if (g.over || plies > 60) { g = newDeal(rnd, 2, rnd.chance(0.5) ? 'pod' : 'per'); plies = 0; return { puzzle: null }; }
      if (g.stock.length === 0) {
        try {
          const res = solve(clone(g), 3200);
          const you = g.actor, want = 1; // value is +1 when seat 0 wins; flip for seat 1 to move
          const sign = you === 0 ? 1 : -1;
          const winners = res.filter((r) => r.value * sign === want);
          if (winners.length === 1 && res.length >= 2) {
            return { puzzle: { game: clone(g), you, title: you === g.attacker ? 'Force the win' : 'Stay out of it', goal: 'Only one move keeps you safe. The rest lose you the round.' } };
          }
        } catch { /* search too deep for this position; keep playing */ }
        if (g.hands[0].length + g.hands[1].length <= 2) { g = newDeal(rnd, 2, rnd.chance(0.5) ? 'pod' : 'per'); plies = 0; return { puzzle: null }; }
      }
      const ms = legalMoves(g);
      if (!ms.length) { g = newDeal(rnd, 2, rnd.chance(0.5) ? 'pod' : 'per'); plies = 0; return { puzzle: null }; }
      apply(g, rnd.chance(0.25) ? ms[rnd.int(ms.length)] : heuristicMove(g, rnd, 0));
      plies++;
      return { puzzle: null };
    },
  };
}

// The opponent's best reply during the daily puzzle: solved exactly (small position, always affordable).
export function bestReply(g) {
  try {
    const res = solve(clone(g), 60000);
    const sign = g.actor === 0 ? 1 : -1;
    let best = res[0], bv = -2;
    for (const r of res) if (r.value * sign > bv) { bv = r.value * sign; best = r; }
    return best.move;
  } catch { return legalMoves(g)[0]; }
}
