// Cosmetics are earned by playing, never sold. Dev mode unlocks everything.
export const UNLOCKS = {
  wood: { oak: { need: '' }, walnut: { need: 'Win one game against the computer.', wins: 1 }, ash: { need: 'Win three games against the computer.', wins: 3 } },
  set: { boxwood: { need: '' }, ivory: { need: 'Beat the Master or the Grandmaster.', badge: 'strong' } },
};
export function unlocked(state, group, key) {
  if (state.dev) return true;
  const u = UNLOCKS[group][key];
  if (!u || (!u.wins && !u.badge)) return true;
  if (u.wins) return state.stats.wins >= u.wins;
  return !!state.stats.badges[u.badge];
}
