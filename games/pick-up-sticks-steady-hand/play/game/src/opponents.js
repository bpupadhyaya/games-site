// The five rivals, easiest first. Their hand: `tremor` (a steady wobble, in units) and `flinch` (jolts per second). `speeds` are the
// pulling speeds they consider (units per second; pulling faster than about 105 drags the sticks you ride over), `sample` how many
// candidate pulls they look at, `refine` how many of the best they re-test with their own shaky hand, `blunder` the chance of an
// off-plan choice, `think` their pause before a pull (seconds).
export const PROFILES = [
  { id: 'pip', name: 'Pip', tag: 'Still learning the heap', stars: 1, tremor: 1.1, flinch: 0.35, speeds: [90, 115, 145], sample: 20, refine: 1, trials: 2, blunder: 0.3, think: [1.0, 2.0] },
  { id: 'mei', name: 'Mei', tag: 'Steady and careful', stars: 2, tremor: 1.0, flinch: 0.3, speeds: [75, 100, 125], sample: 40, refine: 2, trials: 3, blunder: 0.18, think: [1.0, 2.2] },
  { id: 'anselm', name: 'Anselm', tag: 'Patient, loves the big sticks', stars: 3, tremor: 0.9, flinch: 0.2, speeds: [65, 90, 115], sample: 90, refine: 3, trials: 3, blunder: 0.1, think: [1.0, 2.4] },
  { id: 'rosa', name: 'Rosa', tag: 'Reads the whole heap', stars: 4, tremor: 0.7, flinch: 0.15, speeds: [50, 75, 100], sample: 200, refine: 4, trials: 4, blunder: 0.05, think: [1.4, 2.4] },
  { id: 'wen', name: 'Wen', tag: 'Hands like still water', stars: 5, tremor: 0.5, flinch: 0.06, speeds: [40, 60, 90], sample: 400, refine: 5, trials: 5, blunder: 0.01, think: [1.5, 2.6] },
];
