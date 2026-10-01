// The five rivals, easiest first. Numbers are execution noise (how far a throw strays from what was
// planned: `p` is a fraction of the pull range, `a` radians), a taste for shooting (`bias`), and how
// often they misjudge (`blunder`). Strength was calibrated by playing the rivals against each other
// offline: each rung beats the one below it about three games in four.
export const PROFILES = [
  { id: 'odette', name: 'Mémé Odette', tag: 'Gentle and patient', stars: 1, point: { p: 0.076, a: 0.042 }, shoot: { p: 0.084, a: 0.046 }, bias: -0.5, blunder: 0.15, think: [1.2, 2.2] },
  { id: 'marius', name: 'Marius', tag: 'Shoots first, asks later', stars: 2, point: { p: 0.064, a: 0.035 }, shoot: { p: 0.049, a: 0.027 }, bias: 0.25, blunder: 0.12, think: [1.0, 1.9] },
  { id: 'fanny', name: 'Fanny', tag: 'Unpredictable all-rounder', stars: 3, point: { p: 0.047, a: 0.026 }, shoot: { p: 0.047, a: 0.026 }, bias: 0.05, blunder: 0.13, think: [1.0, 2.6] },
  { id: 'camille', name: 'Camille', tag: 'A precise pointer', stars: 4, point: { p: 0.036, a: 0.02 }, shoot: { p: 0.054, a: 0.03 }, bias: -0.25, blunder: 0.075, think: [1.4, 2.4] },
  { id: 'champion', name: 'Le Champion', tag: 'Rarely misses', stars: 5, point: { p: 0.03, a: 0.0165 }, shoot: { p: 0.03, a: 0.0165 }, bias: 0.1, blunder: 0.025, think: [1.5, 2.6] },
];
