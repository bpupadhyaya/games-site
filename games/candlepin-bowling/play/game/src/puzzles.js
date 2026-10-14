// Sixteen hand-checked Wood Puzzles: layouts of standing pins and lying pins (wood), a ball budget for three stars, and one
// known solution (the Hint button finds its own). Checked offline with the same physics: budget-1 puzzles have a roll that clears
// the deck even with a small hand tremor; budget-2 puzzles have no one-ball clear that survives it but a two-ball one exists.
// wood entries: { i: which pin, x, y: metres (y is the distance from the foul line), a: angle in radians }.
export const PUZZLES = [
  { title: "Corner Pair", standing: [3, 4], wood: [{ i: 2, x: -0.436, y: 17.798, a: 2.28 }], budget: 1, sol: { x0: -0.4, aim: -0.45, pace: 0, curve: -1 } },
  { title: "Two on the Rail", standing: [3, 6], wood: [], budget: 1, sol: { x0: -0.4, aim: -0.4, pace: 0, curve: 1 } },
  { title: "Pocket Pins", standing: [1, 3, 7], wood: [], budget: 1, sol: { x0: -0.2, aim: -0.225, pace: 2, curve: -1 } },
  { title: "Back Row Spare", standing: [7, 8, 9], wood: [], budget: 2, sol: { x0: -0.4, aim: 0.05, pace: 0, curve: 0 } },
  { title: "Wood Bridge", standing: [0, 2, 3, 5], wood: [{ i: 6, x: 0.373, y: 18.108, a: 1.77 }], budget: 1, sol: { x0: 0, aim: -0.05, pace: 1, curve: 0 } },
  { title: "Behind the Wood", standing: [0, 1, 5], wood: [{ i: 8, x: 0.258, y: 17.994, a: 2.78 },{ i: 4, x: 0.041, y: 17.562, a: 0.43 }], budget: 1, sol: { x0: -0.4, aim: 0.2, pace: 1, curve: 0 } },
  { title: "Kickback", standing: [3, 4, 5], wood: [{ i: 1, x: -0.166, y: 17.513, a: 2.15 }], budget: 2, sol: { x0: -0.4, aim: -0.125, pace: 0, curve: 0 } },
  { title: "Tip and Run", standing: [3, 4, 6, 9], wood: [{ i: 2, x: -0.461, y: 17.528, a: 1.02 }], budget: 2, sol: { x0: -0.4, aim: -0.475, pace: 1, curve: 0 } },
  { title: "Deadwood Deflect", standing: [0, 3, 8, 9], wood: [{ i: 7, x: 0.335, y: 17.57, a: 1.96 },{ i: 6, x: -0.194, y: 18.005, a: 0.17 },{ i: 5, x: 0.411, y: 18.57, a: 1.23 }], budget: 1, sol: { x0: -0.4, aim: -0.1, pace: 2, curve: -1 } },
  { title: "The Long Way", standing: [1, 3, 4, 6, 7], wood: [{ i: 9, x: 0.086, y: 17.413, a: 0.36 },{ i: 0, x: 0.327, y: 18.03, a: 2.93 },{ i: 2, x: -0.371, y: 17.671, a: 2.94 }], budget: 1, sol: { x0: -0.4, aim: -0.225, pace: 2, curve: 1 } },
  { title: "Split Decision", standing: [1, 2, 5, 6, 8], wood: [{ i: 0, x: 0.42, y: 17.459, a: 0.44 },{ i: 7, x: -0.444, y: 18.275, a: 0.33 }], budget: 2, sol: { x0: -0.4, aim: -0.3, pace: 1, curve: 0 } },
  { title: "Lobster Trap", standing: [2, 4, 5, 6, 7], wood: [{ i: 9, x: 0.047, y: 17.989, a: 0.61 },{ i: 0, x: -0.414, y: 18.257, a: 2.31 },{ i: 1, x: 0.048, y: 17.537, a: 1.76 }], budget: 2, sol: { x0: -0.4, aim: -0.5, pace: 2, curve: 0 } },
  { title: "Harbor Master", standing: [0, 1, 2, 4, 6, 9], wood: [{ i: 8, x: -0.149, y: 17.621, a: 2.1 },{ i: 7, x: 0.194, y: 17.905, a: 2.11 },{ i: 3, x: -0.346, y: 17.924, a: 1.56 },{ i: 5, x: 0.319, y: 17.546, a: 0.46 }], budget: 1, sol: { x0: -0.4, aim: 0.025, pace: 1, curve: 0 } },
  { title: "Maritime Mess", standing: [2, 4, 6, 8, 9], wood: [{ i: 3, x: -0.372, y: 18.767, a: 2.4 },{ i: 0, x: 0.267, y: 17.494, a: 0.29 },{ i: 5, x: 0.109, y: 17.96, a: 1.31 }], budget: 2, sol: { x0: -0.4, aim: 0.125, pace: 2, curve: 0 } },
  { title: "Nor'easter", standing: [0, 2, 4, 5, 8, 9], wood: [{ i: 7, x: -0.007, y: 17.452, a: 1.92 },{ i: 6, x: 0.391, y: 17.529, a: 0.29 },{ i: 3, x: 0.324, y: 18.089, a: 0.71 }], budget: 1, sol: { x0: 0.4, aim: 0.275, pace: 2, curve: 1 } },
  { title: "Cleanup Hitter", standing: [0, 5, 7, 8, 9], wood: [{ i: 6, x: -0.01, y: 17.49, a: 1.46 },{ i: 1, x: -0.286, y: 18.098, a: 1.69 },{ i: 3, x: -0.478, y: 17.411, a: 0.85 },{ i: 4, x: 0.436, y: 18.412, a: 1.37 }], budget: 2, sol: { x0: -0.4, aim: -0.4, pace: 0, curve: 0 } },
];
