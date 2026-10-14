// The people of the village green: how each is dressed and built. Russian village kit of the period: linen shirts, plain trousers, flat caps.
// The batter takes the kit colours the player unlocked (palette), the six fielders and the team-mate who serves wear natural linen.

export const FIELDERS = [
  { ch: 'athlete_m', skin: 'light', hair: 'brown', top: '#f1ece0', bottoms: '#3b4a6b', cap: 0x4a3a28 },
  { ch: 'athlete_f', skin: 'light', hair: 'blond', top: '#ebe6d6', bottoms: '#4d3b2c' },
  { ch: 'athlete_m', skin: 'tan', hair: 'black', top: '#dfe9ee', bottoms: '#2f4a3c', cap: 0x5c4a30 },
  { ch: 'athlete_m', skin: 'light', hair: 'ginger', top: '#f4f1e6', bottoms: '#3b4a6b' },
  { ch: 'athlete_f', skin: 'tan', hair: 'brown', top: '#e8e3d2', bottoms: '#4d3b2c' },
  { ch: 'athlete_m', skin: 'light', hair: 'grey', top: '#e4ded0', bottoms: '#2f4a3c', cap: 0x4a3a28 },
];
export const SERVER = { ch: 'athlete_m', skin: 'tan', hair: 'blond', top: '#e8dfc6', bottoms: '#4a3a2c' };
export const BATTER = { ch: 'athlete_m', skin: 'light', hair: 'brown', bottoms: '#2c3550' };

// Villagers watching from beyond the side fences: x is the side (-1 left, +1 right), y the position along the green.
export const SPECTATORS = [
  { side: -1, y: 4.5, ch: 'athlete_f', skin: 'light', hair: 'brown', top: '#c9473a', bottoms: '#3a3550' },
  { side: -1, y: 8.0, ch: 'athlete_m', skin: 'tan', hair: 'black', top: '#4a7fd0', bottoms: '#2d2f3a', cap: 0x6a4a2a },
  { side: -1, y: 12.0, ch: 'athlete_f', skin: 'light', hair: 'blond', top: '#e8b73a', bottoms: '#3a3a4a' },
  { side: -1, y: 15.5, ch: 'athlete_m', skin: 'light', hair: 'ginger', top: '#7c5cc0', bottoms: '#3b3b44' },
  { side: 1, y: 5.5, ch: 'athlete_m', skin: 'light', hair: 'grey', top: '#3f9a6a', bottoms: '#33302a', cap: 0x30343c },
  { side: 1, y: 9.0, ch: 'athlete_f', skin: 'tan', hair: 'black', top: '#d97fa3', bottoms: '#2d3550' },
  { side: 1, y: 12.8, ch: 'athlete_m', skin: 'light', hair: 'brown', top: '#e9e3d3', bottoms: '#4a4538' },
  { side: 1, y: 16.5, ch: 'athlete_f', skin: 'light', hair: 'brown', top: '#cf6a2d', bottoms: '#2a3a55' },
];
