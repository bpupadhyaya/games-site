// The scoring rule of Ampe in one place (used by the match engine, the AI calibration and the Learn lessons).
// Feet: 0 = LEFT, 1 = RIGHT. leader = index (0 or 1) of the player who leads this round.
// Same foot  -> the Leader scores and keeps the lead.
// Different  -> the other player (the Follower) scores and becomes the Leader.
export function resolveRound(leader, f0, f1) {
  const match = f0 === f1;
  const scorer = match ? leader : 1 - leader;
  return { match, scorer, leader: scorer };
}
