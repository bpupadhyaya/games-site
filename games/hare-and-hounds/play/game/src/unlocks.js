// Cosmetic unlocks: earned by winning, never bought. `need` is what the player sees when a choice is still locked.
export const UNLOCKS = {
  board: { autumn: { need: '' }, winter: { need: 'Win 1 game against the computer.' }, night: { need: 'Win 3 games against the computer.' } },
  set: { wild: { need: '' }, snow: { need: 'Beat the Hard or Master computer, as either side.' } },
};
export function unlocked(state, group, key) {
  if (state.dev) return true;
  const w = state.stats.wins, b = state.stats.badges;
  if (group === 'board') return key === 'autumn' || (key === 'winter' && w >= 1) || (key === 'night' && w >= 3);
  return key === 'wild' || !!(b.H2 || b.D2 || b.H3 || b.D3);
}
