// The five rivals, easiest first. sigA / sigP are the execution wobble (radians; fraction of power), `blunder` is the
// chance of an off-plan choice, `positions` the baseline spots they consider, `refine` how many shots they re-test.
export const PROFILES = [
  { id: 'louise', name: 'Louise', tag: 'Gentle and patient', stars: 1, sigA: 0.03, sigP: 0.07, blunder: 0.18, looseness: 3.0, positions: [-0.4, 0, 0.4], place: true, cut: false, refine: 1, robust: 0.3, think: [1.2, 2.2] },
  { id: 'pierre', name: 'Pierre', tag: 'Loves a big takeout', stars: 2, sigA: 0.024, sigP: 0.058, blunder: 0.13, looseness: 2.2, positions: [-0.5, 0, 0.5], place: true, cut: true, refine: 2, robust: 0.4, think: [1.0, 2.0] },
  { id: 'nora', name: 'Nora', tag: 'Steady all-rounder', stars: 3, sigA: 0.022, sigP: 0.054, blunder: 0.13, looseness: 1.4, positions: [-0.62, -0.3, 0, 0.3, 0.62], place: true, cut: true, refine: 3, robust: 0.5, think: [1.0, 2.4] },
  { id: 'gus', name: 'Gus', tag: 'Reads the angles', stars: 4, sigA: 0.015, sigP: 0.04, blunder: 0.1, looseness: 0.7, positions: [-0.62, -0.31, 0, 0.31, 0.62], place: true, cut: true, refine: 4, robust: 0.6, think: [1.4, 2.4] },
  { id: 'marguerite', name: 'Marguerite', tag: 'Rarely misses', stars: 5, sigA: 0.0055, sigP: 0.016, blunder: 0.02, looseness: 0.2, positions: [-0.66, -0.44, -0.22, 0, 0.22, 0.44, 0.66], place: true, cut: true, refine: 5, robust: 0.7, think: [1.5, 2.6] },
];
