// The rivals, easiest first. Numbers are execution noise: how far a throw strays from what was planned
// (`p` is a fraction of the pull range, `a` radians), a taste for hitting (`bias`), how often they misjudge
// (`blunder`) and how long they think. Strength is calibrated by playing the rungs against each other offline.
export const PROFILES = [
  { id: 'gino', name: 'Nonno Gino', tag: 'Just learning, very forgiving', stars: 1, point: { p: 0.1, a: 0.04 }, hit: { p: 0.13, a: 0.05 }, bias: -0.9, blunder: 0.26, think: [1.4, 2.4] },
  { id: 'lucia', name: 'Nonna Lucia', tag: 'Gentle and patient', stars: 2, point: { p: 0.085, a: 0.033 }, hit: { p: 0.11, a: 0.045 }, bias: -0.6, blunder: 0.18, think: [1.2, 2.2] },
  { id: 'marco', name: 'Marco', tag: 'Loves a big hit', stars: 2, point: { p: 0.068, a: 0.027 }, hit: { p: 0.08, a: 0.03 }, bias: 0.3, blunder: 0.14, think: [1.0, 1.9] },
  { id: 'giulia', name: 'Giulia', tag: 'A steady all-rounder', stars: 3, point: { p: 0.058, a: 0.022 }, hit: { p: 0.07, a: 0.026 }, bias: 0, blunder: 0.12, think: [1.0, 2.4] },
  { id: 'enzo', name: 'Enzo', tag: 'A precise pointer', stars: 4, point: { p: 0.036, a: 0.014 }, hit: { p: 0.052, a: 0.019 }, bias: -0.2, blunder: 0.07, think: [1.4, 2.4] },
  { id: 'maestro', name: 'Il Maestro', tag: 'Rarely misses', stars: 5, point: { p: 0.022, a: 0.008 }, hit: { p: 0.034, a: 0.012 }, bias: 0.05, blunder: 0.02, think: [1.5, 2.6] },
];
// the friendly partner in team games, and the second member of a rival team
export const PARTNER = { id: 'tommaso', name: 'Tommaso', tag: 'Your steady partner', stars: 3, point: { p: 0.05, a: 0.019 }, hit: { p: 0.065, a: 0.024 }, bias: 0, blunder: 0.1, think: [1.0, 2.0] };
export const TOUR_NAMES = ['Paolo', 'Chiara', 'Gianni', 'Sofia', 'Bruno', 'Elena', 'Luca'];
