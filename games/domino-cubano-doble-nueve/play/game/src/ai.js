// Partner-inference AI (the game's own distinct mechanic — see design/GDD.md). Because this
// ruleset never draws, a pass is provable information: a seat that passes when the ends were
// (L, R) is holding NO tile touching L or R, for the rest of the hand. `missing[seat]` only ever
// grows, so it is a real, checkable deduction model, not flavor text.
import { legalPlays } from './rules.js';
import { pipValue, PARTNER_OF, OPPONENTS_OF } from './rules.js';

export const DIFFICULTY = { CASUAL: 0, CLUB: 1, TORNEO: 2 };

export function createPassModel() {
  return [new Set(), new Set(), new Set(), new Set()];
}

// Call whenever a seat passes, with the ends open at that moment (never null — the opener always
// has a legal first play, so a pass can only happen once a line already exists).
export function recordPass(missing, seat, ends) {
  missing[seat].add(ends.left);
  missing[seat].add(ends.right);
}

// Picks the best legal (tile, side) for an AI seat, or null if it must pass.
export function chooseAIPlay(seat, hand, ends, missing, difficulty, rng) {
  const options = legalPlays(hand, ends);
  if (!options.length) return null;

  const partner = PARTNER_OF(seat);
  const opponents = OPPONENTS_OF(seat);

  let best = [];
  let bestScore = -Infinity;
  for (const option of options) {
    const exposed = option.side === 'left'
      ? (option.tile.a === ends.left ? option.tile.b : option.tile.a)
      : (option.tile.a === ends.right ? option.tile.b : option.tile.a);

    let score = pipValue(option.tile); // shed heavy tiles first, every tier

    if (difficulty >= DIFFICULTY.CLUB) {
      for (const opp of opponents) if (missing[opp].has(exposed)) score += 3; // starve a dead-for-them number
    }
    if (difficulty >= DIFFICULTY.TORNEO) {
      if (!missing[partner].has(exposed)) score += 2; // leave a number the partner might still hold
    }

    if (score > bestScore) { best = [option]; bestScore = score; }
    else if (score === bestScore) best.push(option);
  }
  return rng.pick(best);
}
