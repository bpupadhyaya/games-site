// The Daily Deal: an open-hand puzzle (all four hands face up, five cards each). You (South) lead; you and North must
// win at least `target` of the five tricks against the best possible defence. The library is generated and checked by
// the solver (test/gen-puzzles.mjs); the day number picks one, the same for everybody.
import { PUZZLE_DATA } from './puzzle-data.js';
import { newHand, playCard, legalPlays, SUIT_NAMES } from './rules.js';
import { makeSolver } from './solver.js';

export const puzzleFor = (day) => {
  const i = ((day * 37 + 11) % PUZZLE_DATA.length + PUZZLE_DATA.length) % PUZZLE_DATA.length, [hands, trump, target] = PUZZLE_DATA[i];
  return { index: i, hands, trump, target };
};
export function puzzleHand(pz) {
  const H = newHand(pz.hands, 3);
  H.phase = 'play'; H.trump = pz.trump; H.declarer = 0; H.contract = pz.target; H.leader = 0; H.turn = 0;
  return H;
}
export const puzzleText = (pz) => `All hands are face up. ${SUIT_NAMES[pz.trump]} are trump and you lead. You and your partner must win at least ${pz.target} of the 5 tricks against the best defence.`;

// The solving side of a live puzzle: judges your cards and plays the other three seats perfectly.
export function createPuzzleBrain(pz) {
  const sv = makeSolver(pz.trump);
  const ns = (H) => H.tricks[0];
  return {
    need: (H) => pz.target - ns(H),
    // can team 0 still reach the target from here?
    alive(H) { return sv.can(H.hands, H.turn, H.trick, pz.target - ns(H)); },
    // the winning first card (for the reveal / hint): a card of `H.turn` that keeps the target reachable
    good(H) { return sv.goodMoves(H.hands, H.turn, H.trick, pz.target - ns(H)); },
    // the card a computer seat plays: partner keeps the target alive, opponents try to stop it
    pick(H) {
      const g = sv.goodMoves(H.hands, H.turn, H.trick, pz.target - ns(H));
      const pool = g.length ? g : legalPlays(H, H.turn);
      return pool.slice().sort((a, b) => a - b)[0];
    },
  };
}
export { playCard };
