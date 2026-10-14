// The six club rivals. Noise is the shake in the bowling hand: `ang` is the heading error (radians, 1 sigma), `len` the speed error
// (fraction of the weight, 1 sigma; distance error is about double). `blunder` is the chance of a misjudged choice, `drive` a taste for
// firing at the head, `think` the seconds a rival ponders in a normal match.
export const PROFILES = [
  { id: 'pip', name: 'Pip', tag: 'Nervous newcomer', stars: 1, ang: 0.008, len: 0.016, blunder: 0.22, drive: -0.4, think: [1.4, 2.6], cands: 0.45 },
  { id: 'maeve', name: 'Maeve', tag: 'Tea-and-biscuits regular', stars: 2, ang: 0.0058, len: 0.011, blunder: 0.14, drive: -0.25, think: [1.6, 3.0], cands: 0.6 },
  { id: 'alf', name: 'Alf', tag: 'Fifty years on this green', stars: 3, ang: 0.0045, len: 0.008, blunder: 0.09, drive: 0.05, think: [1.8, 3.4], cands: 0.8 },
  { id: 'rangi', name: 'Rangi', tag: 'Fearless fire-away player', stars: 3, ang: 0.004, len: 0.0075, blunder: 0.08, drive: 0.45, think: [1.8, 3.4], cands: 0.8 },
  { id: 'dougal', name: 'Dougal', tag: 'Counts every centimetre', stars: 4, ang: 0.003, len: 0.0055, blunder: 0.04, drive: 0.1, think: [2.0, 3.8], cands: 1 },
  { id: 'wren', name: 'Dame Wren', tag: 'County champion', stars: 5, ang: 0.0018, len: 0.0035, blunder: 0.015, drive: 0.2, think: [2.2, 4.2], cands: 1 },
];
// the player's own hand: steady but human
export const HUMAN = { ang: 0.0030, len: 0.0075 };
export const LADDER = [
  { opp: 0, green: 'village' }, { opp: 1, green: 'tourney' }, { opp: 2, green: 'heavy' }, { opp: 4, green: 'seaside' }, { opp: 5, green: 'daily' },
];
