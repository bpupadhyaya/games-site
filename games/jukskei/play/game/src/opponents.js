// The six rivals (all fictional). `ang` is the sideways shake of the throwing arm (radians, 1 sigma), `len` the error in throwing
// speed (fraction, 1 sigma; the distance error is about double). `blunder` is the chance of a misjudged choice, `bold` a taste for
// going for the stake, `think` the seconds a rival ponders in a normal match, `cands` the share of options the rival considers.
export const PROFILES = [
  { id: 'lindi', female: true, name: 'Lindi', tag: 'Learning the swing', stars: 1, ang: 0.05, len: 0.055, blunder: 0.24, windErr: 0.5, bold: -0.2, think: [1.3, 2.4], cands: 0.4, skin: 0, shirt: '#2f9d8f' },
  { id: 'pieter', name: 'Pieter', tag: 'Steady Sunday thrower', stars: 2, ang: 0.036, len: 0.04, blunder: 0.15, windErr: 0.35, bold: 0, think: [1.5, 2.8], cands: 0.55, skin: 1, shirt: '#7c8f3a' },
  { id: 'sipho', name: 'Sipho', tag: 'Reads the wind well', stars: 3, ang: 0.028, len: 0.03, blunder: 0.09, windErr: 0.22, bold: 0.1, think: [1.7, 3.2], cands: 0.75, skin: 2, shirt: '#c8532f' },
  { id: 'annelie', female: true, name: 'Annelie', tag: 'Goes for the stake', stars: 3, ang: 0.025, len: 0.027, blunder: 0.08, windErr: 0.2, bold: 0.5, think: [1.7, 3.2], cands: 0.75, skin: 3, shirt: '#8a4fb0' },
  { id: 'dawid', name: 'Oom Dawid', tag: 'Forty seasons at the lane', stars: 4, ang: 0.019, len: 0.021, blunder: 0.04, windErr: 0.12, bold: 0.15, think: [2.0, 3.6], cands: 1, skin: 1, shirt: '#3b6fb5' },
  { id: 'nomsa', female: true, name: 'Gogo Nomsa', tag: 'Provincial champion', stars: 5, ang: 0.014, len: 0.015, blunder: 0.015, windErr: 0.05, bold: 0.25, think: [2.2, 4.0], cands: 1, skin: 2, shirt: '#d9a33a' },
];
// the player's own arm: steady but human (a well-timed release keeps it this good)
export const HUMAN = { ang: 0.018, len: 0.018 };
export const LADDER = [
  { opp: 0, pitch: 'farm' }, { opp: 1, pitch: 'club' }, { opp: 2, pitch: 'river' }, { opp: 4, pitch: 'ridge' }, { opp: 5, pitch: 'daily' },
];
