// The four rivals, easiest first. `cands` = how many shots they try out with the real physics, `sigA` / `sigP` = the
// wobble of their execution (radians, fraction of power), `blunder` = chance of settling for a random decent shot,
// `reply` = how many of their best shots they re-test against the opponent's answer (0 = they do not look ahead).
export const PROFILES = [
  { id: 'pip', name: 'Pip', tag: 'Just learned to skate', stars: 1, cands: 12, sigA: 0.1, sigP: 0.2, blunder: 0.5, reply: 0, defend: 0.2, think: [1.0, 1.8], look: 0 },
  { id: 'marlow', name: 'Marlow', tag: 'Plays every Saturday', stars: 2, cands: 34, sigA: 0.055, sigP: 0.11, blunder: 0.24, reply: 0, defend: 0.5, think: [1.0, 2.0], look: 1 },
  { id: 'dale', name: 'Dale', tag: 'Loves a bank shot', stars: 3, cands: 80, sigA: 0.03, sigP: 0.07, blunder: 0.1, reply: 2, defend: 0.85, think: [1.2, 2.2], look: 2 },
  { id: 'jolene', name: 'Jolene', tag: 'Pond hockey legend', stars: 4, cands: 150, sigA: 0.011, sigP: 0.028, blunder: 0.01, reply: 4, defend: 1.0, think: [1.4, 2.6], look: 3 },
];
