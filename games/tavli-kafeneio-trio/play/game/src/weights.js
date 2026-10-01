// Evaluation weights, one list per game (index = rules.js PORTES / PLAKOTO / FEVGA). Tuned by self-play; see ai.js for what each
// number multiplies. Portes (index 0) is judged by the trained network in portesnet.js instead, so its row is unused.
export const WEIGHTS = [
  [1, 0.3, -0.06, 0.22, -1, 0.32, -0.4, 5, 0.3],
  [1.25, 0.15, -0.05, -1, 0.1, 5, 0.3, 0.3],
  [-0.006, 0.1, -0.05, -0.05, 0.05, -0.015, 5, 0.3, 0.2, 0],
];
