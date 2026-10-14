// The rivals, easiest first. Each has execution noise per throw style (metres of miss along and across the throw), a taste for
// shots (`bias`, added to the value of shot candidates), how often they misjudge (`blunder`) and how long they think.
export const PROFILES = [
  { id: 'rafael', name: 'Don Rafael', tag: 'Gentle and forgiving', stars: 1, noise: { roll: [0.55, 0.3], lob: [0.7, 0.35], shot: [1.0, 0.5] }, bias: -0.5, blunder: 0.26, think: [1.4, 2.4] },
  { id: 'carmen', name: 'Doña Carmen', tag: 'Patient, loves a soft lob', stars: 2, noise: { roll: [0.4, 0.22], lob: [0.42, 0.24], shot: [0.8, 0.4] }, bias: -0.25, blunder: 0.17, think: [1.2, 2.2] },
  { id: 'joaquin', name: 'Joaquín', tag: 'Likes to shoot', stars: 3, noise: { roll: [0.3, 0.17], lob: [0.32, 0.19], shot: [0.36, 0.2] }, bias: 0.35, blunder: 0.13, think: [1.0, 1.9] },
  { id: 'mariela', name: 'Mariela', tag: 'Sharp all-rounder', stars: 4, noise: { roll: [0.2, 0.12], lob: [0.22, 0.13], shot: [0.3, 0.16] }, bias: 0, blunder: 0.07, think: [1.2, 2.2] },
  { id: 'maestro', name: 'El Maestro', tag: 'Reads every patch of sand', stars: 5, noise: { roll: [0.11, 0.07], lob: [0.12, 0.08], shot: [0.17, 0.1] }, bias: 0.05, blunder: 0.02, think: [1.5, 2.6] },
];
export const OPPONENT_NAMES = ['Don Rafael', 'Doña Carmen', 'Joaquín', 'Mariela', 'El Maestro'];
