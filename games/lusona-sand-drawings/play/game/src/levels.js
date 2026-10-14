// The level ladder. Every level is generated on the spot from its number (see mirror.js makeLevel), so the list below is all there is:
// field size, how many tiles the shuffle turned (that is the "par"), how many tiles are set in stone, and whether the answer is a half-turn picture.
export const LEVELS = (() => {
  const t = [];
  const add = (W, H, flips, locks, sym) => t.push({ W, H, flips, locks, sym });
  [[3, 3, 2, 0], [3, 3, 3, 0], [3, 4, 3, 0], [4, 4, 3, 0], [4, 4, 4, 1], [3, 5, 4, 1]].forEach(([W, H, f, l]) => add(W, H, f, l, 'turn'));
  [[4, 5, 4, 1], [5, 5, 4, 1], [5, 5, 5, 2], [4, 6, 5, 2], [5, 5, 6, 3], [5, 6, 5, 2]].forEach(([W, H, f, l]) => add(W, H, f, l, 'turn'));
  [[5, 6, 6, 3], [6, 6, 6, 3], [5, 7, 6, 4], [6, 6, 7, 4], [6, 6, 8, 5], [5, 7, 7, 5]].forEach(([W, H, f, l]) => add(W, H, f, l, 'turn'));
  [[6, 7, 7, 5], [6, 7, 8, 6], [7, 7, 8, 6], [6, 8, 8, 7], [7, 7, 9, 8], [7, 7, 10, 9]].forEach(([W, H, f, l]) => add(W, H, f, l, 'none'));
  [[7, 8, 10, 9], [7, 8, 11, 10], [8, 8, 10, 10], [7, 8, 12, 12], [8, 8, 12, 12], [8, 8, 14, 14]].forEach(([W, H, f, l]) => add(W, H, f, l, 'none'));
  return t;
})();
export const TIER_NAMES = ['First lines', 'Small fields', 'Steady hands', 'Long loops', 'Wide fields'];
export const tierOf = (n) => Math.min(TIER_NAMES.length - 1, Math.floor(n / 6));
export const levelSeed = (n) => 1000 + n * 37;
