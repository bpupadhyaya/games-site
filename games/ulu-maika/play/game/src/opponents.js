// The rivals, easiest first. `ang` and `pow` are the spread of the release (radians, and power fraction) the rival cannot help;
// `blunder` is how often they misjudge the roll; `think` is the seconds they take over a roll.
export const PROFILES = [
  { id: 'kai', name: 'Kai', tag: 'Gentle and forgiving', stars: 1, ang: 0.024, pow: 0.07, blunder: 0.22, think: [1.4, 2.4] },
  { id: 'leilani', name: 'Leilani', tag: 'Patient, rarely rushes', stars: 2, ang: 0.016, pow: 0.05, blunder: 0.14, think: [1.2, 2.2] },
  { id: 'makoa', name: 'Makoa', tag: 'Rolls hard and straight', stars: 3, ang: 0.011, pow: 0.04, blunder: 0.09, think: [1.0, 1.9] },
  { id: 'noelani', name: 'Noelani', tag: 'Sharp all-rounder', stars: 4, ang: 0.0072, pow: 0.025, blunder: 0.05, think: [1.2, 2.2] },
  { id: 'nalu', name: 'Nalu', tag: 'Reads every slope', stars: 5, ang: 0.0036, pow: 0.012, blunder: 0.015, think: [1.5, 2.6] },
];
