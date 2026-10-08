// The eight years (levels) of Rice Terraces: four in the Cordillera of the Philippines, four in Bali.
// A level is pure data: the grid of plots (R tiers from the spring downhill, C plots across), which gates are blocked, the spring, the labour, the weather,
// the neighbours and the targets. Everything the simulation (farm.js) and the picture (view3d) need to know about the hillside is here.
export const SEASONS = [
  { id: 'soak', name: 'Soak', len: 40, blurb: 'Flood the fields so the soil turns to soft mud.' },
  { id: 'plant', name: 'Plant', len: 40, blurb: 'Transplant the seedlings into the mud.' },
  { id: 'grow', name: 'Grow', len: 60, blurb: 'Keep the water steady, weed, watch the walls.' },
  { id: 'gold', name: 'Golden', len: 50, blurb: 'Drain the fields and harvest the gold.' },
];

export const CHAPTERS = [
  { id: 'cordillera', name: 'The Cordillera', place: 'Philippines', blurb: 'Stone-walled terraces cut into the mountains, kept alive by the whole village.', walls: 'stone', tint: 0x6f8f55 },
  { id: 'bali', name: 'Bali', place: 'Indonesia', blurb: 'Terraces that share one river through a council of farmers: the subak.', walls: 'earth', tint: 0x8aa845 },
];

// gate keys: feed 'f<c>', spill 'd<r>_<c>' (from tier r down to r+1; on the last tier it is the valley outlet), side 's<r>_<c>' (between plot c and c+1 on tier r)
// blocked: gates that are plugged shut for this year. owners: plot index -> neighbour group (1, 2) for plots tended by neighbours.
const L = (o) => o;
export const LEVELS = [
  // ---- the Cordillera ----------------------------------------------------------------------------------------------------------------------------
  L({ id: 'c1', chapter: 0, year: 1, name: 'First Steps', R: 2, C: 2, seed: 101, spring: 1.5, lr: 0.22, lab0: 4, farmers: 2, blocked: [], owners: {}, valleyNeed: 0, wallBase: 0.9,
      weather: [{ t: 110, dur: 18, kind: 'rain' }], pests: [], workDay: true, speedUp: 1,
      story: { who: 'Lola Dalisay', role: 'keeper of the old terrace', look: 'f', text: 'My grandmother lifted these stones one by one. Come: the spring is awake. Open the gates and let the water walk down the steps.' } }),
  L({ id: 'c2', chapter: 0, year: 2, name: 'The Long Wall', R: 3, C: 2, seed: 102, spring: 1.8, lr: 0.22, lab0: 4, farmers: 2, blocked: ['d0_1'], owners: {}, valleyNeed: 0, wallBase: 0.8,
      weather: [{ t: 60, dur: 14, kind: 'rain' }, { t: 130, dur: 22, kind: 'storm' }], pests: [{ t: 95, plot: 3 }], workDay: true, speedUp: 1,
      story: { who: 'Mang Kalinga', role: 'wall builder', look: 'm', text: 'One gate is plugged with stone this year, so the water must find another way. Watch the sky too: a storm tests every wall.' } }),
  L({ id: 'c3', chapter: 0, year: 3, name: 'Typhoon Season', R: 3, C: 3, seed: 103, spring: 2.2, lr: 0.24, lab0: 4, farmers: 3, blocked: ['d0_1', 's1_0'], owners: {}, valleyNeed: 5, wallBase: 0.72,
      weather: [{ t: 55, dur: 16, kind: 'rain' }, { t: 100, dur: 24, kind: 'dry' }, { t: 150, dur: 22, kind: 'storm' }], pests: [{ t: 90, plot: 4 }, { t: 125, plot: 1 }], workDay: true, speedUp: 1,
      story: { who: 'Ate Maymay', role: 'weaver and farmer', look: 'f', text: 'The village below drinks what we let go. Leave them a little water at the bottom, and keep the walls strong before the typhoon comes.' } }),
  L({ id: 'c4', chapter: 0, year: 4, name: 'The Mountain Village', R: 4, C: 3, seed: 104, spring: 2.7, lr: 0.28, lab0: 5, farmers: 4, blocked: ['d0_1', 'd1_2', 's2_1'], owners: {}, valleyNeed: 8, wallBase: 0.68,
      weather: [{ t: 40, dur: 16, kind: 'rain' }, { t: 95, dur: 20, kind: 'storm' }, { t: 140, dur: 22, kind: 'dry' }, { t: 185, dur: 18, kind: 'storm' }], pests: [{ t: 85, plot: 5 }, { t: 100, plot: 8 }, { t: 130, plot: 2 }], workDay: true, speedUp: 1,
      story: { who: 'Apo Lakay', role: 'village elder', look: 'm', text: 'Four tiers, three storms in the sky, and the whole village to feed. We do this together: your hands, your neighbours, and the mountain.' } }),
  // ---- Bali ----------------------------------------------------------------------------------------------------------------------------------------
  L({ id: 'b1', chapter: 1, year: 1, name: 'The First Canal', R: 2, C: 3, seed: 201, spring: 2.0, lr: 0.22, lab0: 4, farmers: 2, blocked: [], owners: { 2: 1, 5: 1 }, valleyNeed: 4, wallBase: 0.95,
      weather: [{ t: 120, dur: 16, kind: 'rain' }], pests: [], workDay: false, speedUp: 1,
      story: { who: 'Bu Made', role: 'canal keeper', look: 'f', text: 'In the subak every farmer shares one river. The fields on the right belong to a neighbour: when their rice is thirsty, so is ours.' } }),
  L({ id: 'b2', chapter: 1, year: 2, name: 'Shared Water', R: 3, C: 3, seed: 202, spring: 2.2, lr: 0.22, lab0: 4, farmers: 3, blocked: ['s0_0', 'd1_1'], owners: { 1: 1, 4: 1, 7: 1 }, valleyNeed: 6, wallBase: 0.9,
      weather: [{ t: 70, dur: 14, kind: 'rain' }, { t: 140, dur: 22, kind: 'dry' }], pests: [{ t: 100, plot: 6 }], workDay: false, speedUp: 1,
      story: { who: 'Pak Wayan', role: 'farmer', look: 'm', text: 'Our neighbour tends the middle column. Fair is fair: count their water as your own, and the harvest feast will be loud and long.' } }),
  L({ id: 'b3', chapter: 1, year: 3, name: 'The Dry Months', R: 3, C: 4, seed: 203, spring: 2.3, lr: 0.24, lab0: 4, farmers: 3, blocked: ['d0_2', 's1_1', 's2_2'], owners: { 3: 1, 7: 1, 11: 1, 2: 2, 6: 2, 10: 2 }, valleyNeed: 8, wallBase: 0.88,
      weather: [{ t: 45, dur: 40, kind: 'dry' }, { t: 120, dur: 14, kind: 'rain' }, { t: 160, dur: 20, kind: 'dry' }], pests: [{ t: 95, plot: 5 }, { t: 120, plot: 9 }], workDay: false, speedUp: 1,
      story: { who: 'Ni Luh', role: 'water measurer', look: 'f', text: 'When the river thins, we share by turns. Two neighbours, one spring: open for them, close for them, and keep your own rice alive.' } }),
  L({ id: 'b4', chapter: 1, year: 4, name: 'The Water Council', R: 4, C: 4, seed: 204, spring: 3.1, lr: 0.28, lab0: 5, farmers: 4, blocked: ['d0_1', 's1_2', 'd2_3', 's3_0'], owners: { 2: 1, 6: 1, 10: 1, 14: 1, 3: 2, 7: 2, 11: 2, 15: 2 }, valleyNeed: 10, wallBase: 0.85,
      weather: [{ t: 35, dur: 14, kind: 'rain' }, { t: 80, dur: 24, kind: 'dry' }, { t: 135, dur: 20, kind: 'storm' }, { t: 180, dur: 12, kind: 'rain' }], pests: [{ t: 80, plot: 5 }, { t: 110, plot: 9 }, { t: 125, plot: 13 }], workDay: false, speedUp: 1,
      story: { who: 'Pak Ketut', role: 'council farmer', look: 'm', text: 'Sixteen fields, three families, one river. Everyone at the council wants the same thing: that nobody goes hungry. Show them how the water can do it.' } }),
];

for (const l of LEVELS) if (l.valleyNeed > 0) l.valleyNeed = Math.round(0.28 * l.spring * 190);   // the valley's fair share: about a quarter of the year's spring water
export const levelById = (id) => LEVELS.find((l) => l.id === id) || LEVELS[0];
export const levelIndex = (id) => Math.max(0, LEVELS.findIndex((l) => l.id === id));
export const chapterLevels = (ci) => LEVELS.filter((l) => l.chapter === ci);

// plot names: tier letter + number (A1 is the top-left plot)
export const plotName = (lv, i) => `${String.fromCharCode(65 + Math.floor(i / lv.C))}${(i % lv.C) + 1}`;
export const plotRC = (lv, i) => ({ r: Math.floor(i / lv.C), c: i % lv.C });
export const plotIndex = (lv, r, c) => r * lv.C + c;
export function gateList(lv) {
  const out = [];
  for (let c = 0; c < lv.C; c++) out.push({ id: `f${c}`, kind: 'f', r: -1, c });
  for (let r = 0; r < lv.R; r++) for (let c = 0; c < lv.C; c++) out.push({ id: `d${r}_${c}`, kind: 'd', r, c });
  for (let r = 0; r < lv.R; r++) for (let c = 0; c < lv.C - 1; c++) out.push({ id: `s${r}_${c}`, kind: 's', r, c });
  return out;
}
