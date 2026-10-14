// The workshop's order book: 24 commissions in four sets, each a fixed seed so everyone paints the same piece.
import { WHEELS, PANELS } from './geo.js';
import { COLORS, makeCommission, commissionSteps, freeCommission, pieceOf } from './puzzle.js';
import { BAKED } from './baked.js';

export const SETS = [
  { id: 'wheels', name: 'First Wheels', blurb: 'Sunbursts with the master already at work.' },
  { id: 'panels', name: 'Cart Panels', blurb: 'The painted sides of the cart, mirrored left to right.' },
  { id: 'yokes', name: 'Yoke Boards', blurb: 'Long narrow boards: everything balances around the middle.' },
  { id: 'masters', name: 'Master Wheels', blurb: 'Big wheels, many colours, fewer clues.' },
];
// [title, set, geometry, colours, forbid rules, distinct row, master strokes, tip]
const T = [
  ['Little Sunburst', 0, WHEELS.w1, 3, 0, 0, 2, 'Tap a pot, then tap a segment. One stroke paints every matching segment around the wheel.'],
  ['Four Quarters', 0, WHEELS.w1, 4, 0, 0, 1, 'Touching segments must differ. The hub touches every segment of the inner ring.'],
  ['Rim and Hub', 0, WHEELS.w2, 3, 1, 0, 2, 'A rule on the card can ban a colour from a ring. Watch the pot levels: they must end exactly empty.'],
  ['Spoke Dance', 0, WHEELS.w3, 4, 1, 0, 2, 'When a pot is low, ask where its last drops must go.'],
  ['Mirror Wheel', 0, WHEELS.w4, 4, 1, 1, 1, 'Mirrored wheels paint both halves of a stroke at once. One ring must use all different colours.'],
  ['Market Day', 0, WHEELS.w5, 5, 1, 1, 1, ''],
  ['Side Panel', 1, PANELS.p1, 3, 0, 0, 3, 'Panels mirror left to right: one stroke paints both sides.'],
  ['Coffee Blossom', 1, PANELS.p1, 4, 1, 0, 2, ''],
  ['Highland Dawn', 1, PANELS.p2, 4, 1, 1, 2, 'This panel also mirrors top to bottom, so each stroke paints four segments.'],
  ['Orchid Border', 1, PANELS.p3, 4, 1, 1, 2, ''],
  ['Cloud Forest', 1, PANELS.p3, 5, 2, 1, 1, ''],
  ['Fiesta Panel', 1, PANELS.p4, 5, 2, 1, 1, ''],
  ['Short Yoke', 2, PANELS.y1, 3, 0, 0, 2, 'A yoke board: the two halves mirror each other around the middle.'],
  ['Harvest Moon', 2, PANELS.y1, 4, 1, 1, 2, ''],
  ['Long Yoke', 2, PANELS.y2, 4, 1, 1, 2, ''],
  ['Hummingbird', 2, PANELS.y2, 5, 2, 1, 1, ''],
  ['Three-Row Yoke', 2, PANELS.y3, 5, 1, 1, 2, ''],
  ['Wide Yoke', 2, PANELS.y4, 5, 2, 1, 1, ''],
  ['Volcano Morning', 3, WHEELS.w6, 5, 2, 1, 1, ''],
  ['Rainy Season', 3, WHEELS.w9, 5, 2, 1, 1, ''],
  ['Twelve Spokes', 3, WHEELS.w8, 5, 2, 1, 2, ''],
  ['Grand Sunburst', 3, WHEELS.w7, 6, 2, 1, 1, ''],
  ['River Crossing', 3, WHEELS.w8, 6, 3, 1, 1, ''],
  ['Master Wheel', 3, WHEELS.w7, 6, 3, 1, 0, 'No clues on the wheel, only the rules and the pots. Start with the strictest ring.'],
];
export const CAMPAIGN = T.map(([title, set, geom, nc, forbid, distinct, givens, tip], i) => ({ id: `c${i + 1}`, n: i + 1, title, set, geom, nc, forbid, distinct: !!distinct, givens, tip }));
export const campaignAt = (id) => CAMPAIGN.find((c) => c.id === id) ?? null;
const cache = new Map();
export function commission(id) {
  let c = cache.get(id);
  if (c) return c;
  const d = campaignAt(id);
  // The 24 orders are pre-solved (baked.js, produced by this same generator and seed) so no phone ever waits on the search;
  // the generator stays as the fallback if an entry is missing.
  const b = BAKED[id];
  const made = b ? { geom: d.geom, forbid: d.forbid, distinct: d.distinct, givens: d.givens, seed: 4100 + d.n * 37, colors: b.colors, cons: b.cons, pots: b.pots, given: b.given, start: b.start, sol: b.sol, piece: pieceOf(d.geom) }
    : makeCommission({ geom: d.geom, colors: COLORS.slice(0, d.nc), forbid: d.forbid, distinct: d.distinct, givens: d.givens, seed: 4100 + d.n * 37 });
  c = { ...made, id, title: d.title, set: d.set, tip: d.tip, mode: 'commission' };
  if (cache.size > 40) cache.delete(cache.keys().next().value);
  cache.set(id, c);
  return c;
}
// Daily commission: a different piece every day, mid difficulty.
const DAILY_GEOMS = [WHEELS.w3, WHEELS.w4, WHEELS.w5, WHEELS.w6, WHEELS.w8, PANELS.p2, PANELS.p3, PANELS.p4, PANELS.y2, PANELS.y3];
const dailyDef = (day) => {
  const g = DAILY_GEOMS[((day % DAILY_GEOMS.length) + DAILY_GEOMS.length) % DAILY_GEOMS.length], nc = 4 + (day % 3);
  return { geom: g, colors: COLORS.slice(0, nc), forbid: 1 + (day % 2), distinct: true, givens: 1, seed: 9000 + day, fast: true };
};
const dailyCache = new Map();
const dailyWrap = (c, day) => ({ ...c, id: 'daily', title: 'Daily commission', set: -1, tip: '', mode: 'commission', daily: day });
export function dailyCommission(day) {
  let c = dailyCache.get(day);
  if (!c) { c = dailyWrap(makeCommission(dailyDef(day)), day); dailyCache.set(day, c); if (dailyCache.size > 8) dailyCache.delete(dailyCache.keys().next().value); }
  return c;
}
// Spread the search over frames: call dailyWarm(day) once per frame while idle; true when the commission is ready in the cache.
let warmJob = null;
export function dailyWarm(day) {
  if (dailyCache.has(day)) return true;
  if (!warmJob || warmJob.day !== day) warmJob = { day, it: commissionSteps(dailyDef(day)) };
  const r = warmJob.it.next();
  if (r.done) { dailyCache.set(day, dailyWrap(r.value, day)); warmJob = null; return true; }
  return false;
}
export const FREE_SHAPES = [
  { id: 'f2', name: 'Two-fold wheel', geom: { kind: 'wheel', rings: 3, sectors: 12, fold: 2, mirror: false, hub: true } },
  { id: 'f3', name: 'Three-fold wheel', geom: { kind: 'wheel', rings: 3, sectors: 12, fold: 3, mirror: false, hub: true } },
  { id: 'f4', name: 'Four-fold wheel', geom: { kind: 'wheel', rings: 4, sectors: 16, fold: 4, mirror: false, hub: true } },
  { id: 'f6', name: 'Six-fold mirror wheel', geom: { kind: 'wheel', rings: 4, sectors: 24, fold: 6, mirror: true, hub: true } },
  { id: 'f8', name: 'Eight-fold mirror wheel', geom: { kind: 'wheel', rings: 4, sectors: 32, fold: 8, mirror: true, hub: true } },
  { id: 'fp', name: 'Cart panel', geom: { kind: 'panel', cols: 8, rows: 5, mirrorX: true, mirrorY: true } },
];
export const freeChallenge = (shapeId) => ({ ...freeCommission((FREE_SHAPES.find((s) => s.id === shapeId) ?? FREE_SHAPES[1]).geom), title: 'Free painting', free: shapeId });
