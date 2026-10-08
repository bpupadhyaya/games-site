// Content tables: the rival crews, the three regattas (rivers) and the race lengths. All names are invented.
export const CREWS = [
  { id: 'jade-heron', name: 'Jade Heron', hue: 150, plan: 'steady', skill: 0.0 },
  { id: 'red-carp', name: 'Red Carp', hue: 5, plan: 'fast', skill: 0.01 },
  { id: 'bamboo-hawks', name: 'Bamboo Hawks', hue: 95, plan: 'late', skill: 0.0 },
  { id: 'lotus-kings', name: 'Lotus Kings', hue: 320, plan: 'erratic', skill: 0.02 },
  { id: 'harbour-tigers', name: 'Harbour Tigers', hue: 28, plan: 'fast', skill: 0.02 },
  { id: 'silver-eels', name: 'Silver Eels', hue: 200, plan: 'steady', skill: 0.03 },
  { id: 'lantern-oars', name: 'Lantern Oars', hue: 50, plan: 'late', skill: 0.03 },
  { id: 'storm-petrels', name: 'Storm Petrels', hue: 235, plan: 'erratic', skill: 0.03 },
  { id: 'iron-cranes', name: 'Iron Cranes', hue: 270, plan: 'steady', skill: 0.045 },
  { id: 'canal-dragons', name: 'Canal Dragons', hue: 175, plan: 'late', skill: 0.05 },
  { id: 'night-herons', name: 'Night Herons', hue: 215, plan: 'fast', skill: 0.05 },
  { id: 'golden-koi', name: 'Golden Koi', hue: 42, plan: 'steady', skill: 0.06 },
];
export const PLAN_TEXT = { steady: 'Steady pace the whole way', fast: 'Fast start, tires late', late: 'Slow start, strong finish', erratic: 'Streaky: hot and cold' };
export const crewById = (id) => CREWS.find((c) => c.id === id) ?? CREWS[0];

// theme: the look of a river (used by the 3D arena and the 2D fallback)
export const THEMES = {
  town: { id: 'town', name: 'River Town', sub: 'Morning regatta', sky: 0x9fd0ee, fog: 0xcfe6f2, water: [0.05, 0.36, 0.42], sun: [0.8, 0.85, 0.7], bank: 0x5d8a46, drift: 0.25, time: 'day' },
  harbour: { id: 'harbour', name: 'Harbour Lanterns', sub: 'Evening regatta', sky: 0xf0a56a, fog: 0xe8b890, water: [0.03, 0.22, 0.34], sun: [1.0, 0.62, 0.38], bank: 0x4a6a3c, drift: 0.4, time: 'evening' },
  canal: { id: 'canal', name: 'Grand Canal', sub: 'Night festival', sky: 0x0b1530, fog: 0x14223d, water: [0.02, 0.1, 0.2], sun: [0.45, 0.55, 0.9], bank: 0x24332c, drift: 0.55, time: 'night' },
};
export const THEME_LIST = [THEMES.town, THEMES.harbour, THEMES.canal];

export const ROUNDS = [
  { id: 'heat', name: 'Heat', len: 400, P0: 0.80, level: 0, advance: 2 },
  { id: 'semi', name: 'Semifinal', len: 500, P0: 0.745, level: 1, advance: 2 },
  { id: 'final', name: 'Final', len: 600, P0: 0.70, level: 2, advance: 4 },
];
// regattas: three rivers, each with 3 rounds; rivals drawn from CREWS
export const REGATTAS = [
  { id: 'town', theme: 'town', name: 'River Town Regatta', base: 2, crews: ['jade-heron', 'red-carp', 'bamboo-hawks', 'lotus-kings', 'harbour-tigers', 'silver-eels'] },
  { id: 'harbour', theme: 'harbour', name: 'Harbour Lantern Regatta', base: 4.5, crews: ['harbour-tigers', 'silver-eels', 'lantern-oars', 'storm-petrels', 'iron-cranes', 'red-carp'] },
  { id: 'canal', theme: 'canal', name: 'Grand Canal Festival', base: 7, crews: ['iron-cranes', 'canal-dragons', 'night-herons', 'golden-koi', 'storm-petrels', 'lantern-oars'] },
];
export const QUICK_LENGTHS = [
  { id: 'sprint', name: 'Sprint', len: 300, P0: 0.78 }, { id: 'heat', name: 'Heat', len: 400, P0: 0.76 },
  { id: 'classic', name: 'Classic', len: 500, P0: 0.74 }, { id: 'long', name: 'Long', len: 600, P0: 0.72 },
];
export const QUICK_LEVELS = [
  { id: 'easy', name: 'Easy', level: 2 }, { id: 'medium', name: 'Medium', level: 4.5 }, { id: 'hard', name: 'Hard', level: 7 }, { id: 'expert', name: 'Expert', level: 9.3 },
];
export const DRUM_CHARTS = [
  { id: 'steady', name: 'Steady Hands', level: 3, segs: [[12, 66, 78, 'STEADY'], [14, 76, 88, 'UP'], [12, 66, 78, 'SETTLE'], [14, 80, 92, 'PUSH']] },
  { id: 'surge', name: 'Rising Tide', level: 5.5, segs: [[10, 64, 74, 'STEADY'], [14, 80, 92, 'UP'], [10, 70, 80, 'HOLD'], [14, 88, 100, 'PUSH'], [10, 72, 84, 'SETTLE'], [14, 92, 104, 'SPRINT']] },
  { id: 'festival', name: 'Festival Finale', level: 8, segs: [[10, 70, 80, 'STEADY'], [14, 84, 96, 'UP'], [10, 64, 76, 'EASE'], [14, 92, 104, 'PUSH'], [10, 74, 86, 'HOLD'], [16, 98, 110, 'SPRINT']] },
];
