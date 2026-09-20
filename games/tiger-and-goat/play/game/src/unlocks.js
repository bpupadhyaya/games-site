// Cosmetic unlocks: earned by wins, never bought. Kept apart from game.js so the drawing code can read it too.
// `need` is what the player sees when a choice is still locked.
export const UNLOCKS = {
  wood: { teak: { need: '' }, walnut: { need: 'Win 1 game against the computer.' }, ash: { need: 'Win 3 games against the computer.' } },
  set: { classic: { need: '' }, snow: { need: 'Beat the Hard or Master computer, as either side.' } },
};
export function unlocked(state, group, key) {
  if (state.dev) return true;
  const w = state.stats.wins, b = state.stats.badges;
  if (group === 'wood') return key === 'teak' || (key === 'walnut' && w >= 1) || (key === 'ash' && w >= 3);
  return key === 'classic' || !!(b.G2 || b.T2 || b.G3 || b.T3);
}
