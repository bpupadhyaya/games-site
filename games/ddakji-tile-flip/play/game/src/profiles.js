// The six rivals: how steady their hand is (tremor added to the scatter), how well they judge the throw (noise on their own
// estimate), how long they take, the weight of their tile, and the printed pattern their tile wears (also what you win).
export const PROFILES = [
  { name: 'Jiho', tag: 'Learning the ropes', stars: 1, tremor: 0.20, noise: 0.5, think: [1.0, 2.0], mass: 0.94, pat: 3, flat: 0.3 },
  { name: 'Soo-ah', tag: 'Quick and cheerful', stars: 2, tremor: 0.13, noise: 0.28, think: [1.2, 2.4], mass: 0.97, pat: 1, flat: 0.5 },
  { name: 'Min-jun', tag: 'Loves a big slap', stars: 3, tremor: 0.09, noise: 0.16, think: [1.4, 2.8], mass: 1.0, pat: 4, flat: 0.7 },
  { name: 'Ha-rin', tag: 'Patient and precise', stars: 4, tremor: 0.055, noise: 0.08, think: [1.8, 3.4], mass: 1.03, pat: 6, flat: 0.85 },
  { name: 'Dae-ho', tag: 'Neighbourhood champion', stars: 5, tremor: 0.03, noise: 0.03, think: [2.0, 3.6], mass: 1.07, pat: 10, flat: 1 },
  { name: 'Halmeoni', tag: 'Folded tiles for sixty years', stars: 5, tremor: 0.012, noise: 0.0, think: [2.2, 4.0], mass: 1.1, pat: 5, flat: 1 },
];
export const HOME = { name: 'You', mass: 1 };

// Twelve patterns: who owns what. Index = art.js PATTERNS. Start with ribbon bands.
export const UNLOCKS = [
  { pat: 0, how: 'Your first tile' },
  { pat: 2, how: 'Flip your first tile' },
  { pat: 7, how: 'Flip 10 tiles in all' },
  { pat: 8, how: 'Flip 30 tiles in all' },
  { pat: 9, how: 'Fold a tile with 90% crispness' },
  { pat: 11, how: 'Win a full match 3 to 0, or win 3 matches in a row' },
  ...PROFILES.map((p, i) => ({ pat: p.pat, how: `Beat ${p.name}`, rival: i })),
];
