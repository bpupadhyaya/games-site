// The five rivals, easiest first. sigA / sigP are the execution wobble (radians; fraction of power), `blunder` the chance of an
// off-plan choice, `angles` how many shooting-line spots they consider when the shooter is in hand, `refine` how many shots they
// re-test with small slips (to prefer shots that survive a shaky flick), `cut` whether they try cut shots.
export const PROFILES = [
  { id: 'kiran', name: 'Kiran', tag: 'Still learning the ring', stars: 1, sigA: 0.034, sigP: 0.085, blunder: 0.2, looseness: 3.0, angles: 2, cut: false, powers: [140, 330], refine: 1, robust: 0.3, think: [1.0, 2.0] },
  { id: 'sari', name: 'Sari', tag: 'Steady and careful', stars: 2, sigA: 0.026, sigP: 0.065, blunder: 0.14, looseness: 2.0, angles: 3, cut: true, powers: [140, 330], refine: 2, robust: 0.4, think: [1.0, 2.2] },
  { id: 'tomas', name: 'Tomas', tag: 'Loves a power break', stars: 3, sigA: 0.02, sigP: 0.05, blunder: 0.12, looseness: 1.3, angles: 4, cut: true, powers: [100, 260, 520], refine: 3, robust: 0.5, think: [1.0, 2.4] },
  { id: 'lena', name: 'Lena', tag: 'Reads every angle', stars: 4, sigA: 0.013, sigP: 0.036, blunder: 0.08, looseness: 0.7, angles: 6, cut: true, powers: [80, 200, 400, 700], refine: 4, robust: 0.6, think: [1.4, 2.4] },
  { id: 'hiro', name: 'Hiro', tag: 'Rarely misses', stars: 5, sigA: 0.005, sigP: 0.014, blunder: 0.02, looseness: 0.2, angles: 8, cut: true, powers: [60, 160, 320, 560, 900], refine: 5, robust: 0.7, think: [1.5, 2.6] },
];
