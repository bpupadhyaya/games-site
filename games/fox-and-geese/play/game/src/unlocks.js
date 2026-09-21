// Cosmetic unlocks: earned by wins, never bought. Kept apart from game.js so the drawing code can read it too.
// `need` is what the player sees when a choice is still locked.
export const UNLOCKS = {
  board: { frost: { need: '' }, slate: { need: 'Win 1 game against the computer.' }, moss: { need: 'Win 3 games against the computer.' } },
  set: { classic: { need: '' }, dusk: { need: 'Beat the Hard or Master computer, as either side.' } },
};
export function unlocked(state, group, key) {
  if (state.dev) return true;
  const w = state.stats.wins, b = state.stats.badges;
  if (group === 'board') return key === 'frost' || (key === 'slate' && w >= 1) || (key === 'moss' && w >= 3);
  return key === 'classic' || !!(b.G2 || b.F2 || b.G3 || b.F3);
}

// Stars (one per side and computer level) are for the classic game or a harder one. The geese need a flock of 13 or fewer.
// The fox needs at least the flock listed here: the strong computer geese cannot be beaten by the fox at 13, so against
// Hard and Master the fox may use a smaller flock (fewer geese is easier for the fox).
const FOX_MIN_FLOCK = [13, 13, 9, 7];
export const starEarned = (side, level, flock) => (side === 'G' ? flock <= 13 : flock >= FOX_MIN_FLOCK[level]);
export const starNeed = (side, level) => (side === 'G' ? 'a flock of 13 or fewer' : `a flock of ${FOX_MIN_FLOCK[level]} or more`);
