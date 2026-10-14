// Pinisi rules engine: pure and deterministic. Everything random is a hash of (voyage seed, place, day), so a saved voyage
// replays exactly and the interface never needs a random stream. The state is plain JSON.

export const TUNE = {
  upkeep: 12,                // coins per day for crew and provisions
  slipStep: 0.04,          // price moves this much per unit bought (up) or sold (down)
  slipFloor: 0.5, slipCeil: 0.7, slipDecay: 0.9,   // slip is multiplied by this each day
  sellCut: 0.9,             // the merchant keeps 10%: you sell at 90% of the posted price
  nmPerUnit: 1600,          // chart distance of 1.0 in nautical miles
  strainRate: 60,           // hull points lost per 1.0 of overload
  leakBelow: 0.3, leakMod: 0.8,   // below 30% hull the ship leaks and sails 20% slower
  sinkAt: 0,
  repairCoins: 2, repairCoinsYard: 1,
  holdUpgrade: { bales: 4, cost: 140, max: 2 },
  sailUpgrade: { strain: 0.08, cost: 120, max: 2 },
  resale: 0.5,              // the ship counts for half its cost (scaled by hull condition) in the final score
  cargoValue: 0.8,          // unsold cargo counts at 80% when the voyage ends
  planks: 6,
  windMin: 0.15,
  squallStr: 1.55, squallP: 0.07,
  thinkSeconds: 6, thinkCooldown: 8,
};

export const GOODS = [
  { id: 'cloves', name: 'Cloves', base: 90 },
  { id: 'nutmeg', name: 'Nutmeg', base: 80 },
  { id: 'sandalwood', name: 'Sandalwood', base: 70 },
  { id: 'copra', name: 'Copra', base: 26 },
  { id: 'rice', name: 'Rice', base: 20 },
  { id: 'teak', name: 'Teak', base: 46 },
  { id: 'cloth', name: 'Cloth', base: 52 },
];

// Port order matters (indexes are saved). x, y on the chart 0..1 (east, south). f = price factor per good (low = grown here, high = wanted here).
export const PORTS = [
  { id: 'surabaya', name: 'Surabaya', x: 0.07, y: 0.74, r: 0.034, note: 'A big Java harbour that buys spice and sells cloth, rice and teak.', f: [1.45, 1.4, 1.3, 1.15, 0.65, 0.7, 0.6] },
  { id: 'makassar', name: 'Makassar', x: 0.25, y: 0.55, r: 0.034, note: 'The great trading port of south Sulawesi, home of the Bugis and Makassar sailors.', f: [1.2, 1.2, 1.15, 0.75, 0.7, 1.15, 1.25] },
  { id: 'bira', name: 'Bira', x: 0.4, y: 0.7, r: 0.03, yard: true, note: 'The village where pinisi hulls are built by hand on the beach.', f: [1.1, 1.1, 1.0, 1.0, 1.2, 0.6, 1.3] },
  { id: 'bima', name: 'Bima', x: 0.26, y: 0.88, r: 0.03, note: 'A sheltered bay on Sumbawa, a stop on the way to the east.', f: [1.2, 1.15, 0.85, 1.1, 0.75, 1.2, 1.35] },
  { id: 'kupang', name: 'Kupang', x: 0.52, y: 0.93, r: 0.03, note: 'Port of Timor, where sandalwood is cut and loaded.', f: [1.3, 1.2, 0.55, 1.2, 1.5, 1.3, 1.5] },
  { id: 'banda', name: 'Banda Neira', x: 0.75, y: 0.72, r: 0.026, note: 'A tiny island harbour, once the only home of nutmeg.', f: [1.2, 0.5, 1.2, 1.1, 1.6, 1.4, 1.55] },
  { id: 'ambon', name: 'Ambon', x: 0.8, y: 0.5, r: 0.03, note: 'A deep bay and a clove market in the Moluccas.', f: [0.55, 0.85, 1.2, 1.0, 1.5, 1.45, 1.5] },
  { id: 'ternate', name: 'Ternate', x: 0.67, y: 0.24, r: 0.026, note: 'A volcano island, famed for cloves.', f: [0.6, 0.9, 1.15, 0.95, 1.55, 1.5, 1.6] },
  { id: 'manado', name: 'Manado', x: 0.42, y: 0.12, r: 0.028, note: 'A northern port of coconut groves and copra.', f: [1.15, 1.15, 1.2, 0.55, 1.0, 1.25, 1.4] },
];

// Sea routes between ports (indexes into PORTS).
export const ROUTES = [[0, 1], [0, 3], [1, 2], [1, 8], [1, 3], [2, 3], [2, 4], [2, 5], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8], [2, 6]];

export const SIZES = {
  prahu: { name: 'Prahu', cap: 14, hp: 70, speed: 128, cost: 180, blurb: 'Small and nimble. Few bales, sails quickly.' },
  pinisi: { name: 'Pinisi', cap: 22, hp: 100, speed: 122, cost: 340, blurb: 'The classic two-masted trader. A good balance.' },
  grand: { name: 'Grand pinisi', cap: 32, hp: 130, speed: 112, cost: 560, blurb: 'A great hold and a strong hull, but slower.' },
};
export const TIMBERS = {
  ironwood: { name: 'Ironwood', hp: 1.25, spd: 0.94, cost: 90, blurb: 'Very hard. A strong hull, a little heavy.' },
  teak: { name: 'Teak', hp: 1.0, spd: 1.0, cost: 40, blurb: 'Steady and long lasting. No weakness.' },
  meranti: { name: 'Meranti', hp: 0.85, spd: 1.06, cost: 0, blurb: 'Light and cheap. Fast, but a weaker hull.' },
};
export const RIGS = {
  lean: { name: 'Lean rig', spd: 1.1, strain: 0.95, cost: 30, blurb: 'Taller sails: faster, but it strains in a blow.' },
  balanced: { name: 'Balanced rig', spd: 1.0, strain: 1.05, cost: 0, blurb: 'The usual seven-sail plan.' },
  storm: { name: 'Storm rig', spd: 0.92, strain: 1.25, cost: 50, blurb: 'Shorter, stouter sails. Slower, shrugs off gales.' },
};
export const SETTINGS = ['full', 'reef', 'anchor'];
export const SET_FACTOR = { full: 1, reef: 0.6, anchor: 0 };
export const SET_NAME = { full: 'Full sail', reef: 'Reef', anchor: 'Anchor' };
export const MODES = {
  quick: { name: 'Quick Run', days: 45, coins: 1000, months: [11], blurb: '45 days in the west monsoon.' },
  monsoon: { name: 'Monsoon Voyage', days: 120, coins: 1200, months: [11, 5], blurb: '120 days. Start in either monsoon.' },
};
export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const RANKS = [
  { name: 'Deckhand', min: 0 },
  { name: 'Mate', min: 0.25 },
  { name: 'Captain', min: 0.6 },
  { name: 'Master of the Pinisi', min: 1.0 },
];

// ---- small helpers -------------------------------------------------------------------------------------------------------------
const mix = (h) => { h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16; return h >>> 0; };
export function hash(seed, a = 0, b = 0, c = 0) {
  let h = mix((seed | 0) ^ 0x9e3779b9);
  h = mix(h ^ Math.imul((a | 0) + 1, 0x27d4eb2d));
  h = mix(h ^ Math.imul((b | 0) + 7, 0x165667b1));
  h = mix(h ^ Math.imul((c | 0) + 13, 0x85ebca77));
  return h / 4294967296;
}
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const TAU = Math.PI * 2;
export const angDiff = (a, b) => { let d = Math.abs(((a - b) % TAU + TAU) % TAU); if (d > Math.PI) d = TAU - d; return d; };

export const edges = ROUTES.map(([a, b]) => ({ a, b, dist: Math.round(Math.hypot(PORTS[a].x - PORTS[b].x, PORTS[a].y - PORTS[b].y) * TUNE.nmPerUnit / 10) * 10 }));
export function routesFrom(p) {
  const out = [];
  for (const e of edges) {
    if (e.a === p) out.push({ to: e.b, dist: e.dist });
    else if (e.b === p) out.push({ to: e.a, dist: e.dist });
  }
  return out;
}
export const routeDist = (a, b) => { const e = edges.find((q) => (q.a === a && q.b === b) || (q.a === b && q.b === a)); return e ? e.dist : 0; };
export function bearing(a, b) { return Math.atan2(PORTS[b].y - PORTS[a].y, PORTS[b].x - PORTS[a].x); }   // chart direction, y down

// ---- calendar, seasons, wind -------------------------------------------------------------------------------------------------------
export const monthOf = (v, day = v.day) => (v.startMonth + Math.floor(day / 30)) % 12;
export function seasonOf(month) {
  if (month === 11 || month <= 2) return 'west';
  if (month >= 5 && month <= 8) return 'east';
  return 'trans';
}
export const SEASON_NAME = { west: 'West monsoon', east: 'East monsoon', trans: 'Changing winds' };
const WEST_DIR = 0.3, EAST_DIR = -2.9;          // direction the wind blows TOWARD, chart radians (y down)

export function windAt(v, day = v.day) {
  const m = monthOf(v, day), s = seasonOf(m);
  const u = 0.5 * hash(v.seed, day, 1) + 0.5 * hash(v.seed, Math.floor(day / 3), 4);
  let dir, str;
  if (s === 'west') { dir = WEST_DIR; str = 0.55 + 0.75 * u; }
  else if (s === 'east') { dir = EAST_DIR; str = 0.55 + 0.75 * u; }
  else { dir = (hash(v.seed, Math.floor(day / 4), 5) - 0.5) * TAU; str = 0.3 + 0.6 * u; }
  dir += (hash(v.seed, day, 3) - 0.5) * 0.9;
  const squall = hash(v.seed, day, 2) < TUNE.squallP;
  if (squall) str = TUNE.squallStr;
  return { dir, str: Math.round(str * 100) / 100, squall, season: s };
}
export function windClass(str) {
  return str >= 1.4 ? 'gale' : str >= 1.1 ? 'strong' : str >= 0.75 ? 'fresh' : str >= 0.45 ? 'light' : 'calm';
}
export const CLASS_NAME = { calm: 'Calm', light: 'Light breeze', fresh: 'Fresh breeze', strong: 'Strong wind', gale: 'Gale' };

const POS = [[0, 0.8], [40, 0.95], [90, 1.0], [130, 0.78], [160, 0.45], [180, 0.3]];
// Speed factor from the angle between the course and the direction the wind blows toward (0 = wind dead astern, 180 = on the nose).
export function pointOfSail(angle) {
  const d = angle * 180 / Math.PI;
  for (let i = 1; i < POS.length; i++) if (d <= POS[i][0]) { const t = (d - POS[i - 1][0]) / (POS[i][0] - POS[i - 1][0]); return POS[i - 1][1] + (POS[i][1] - POS[i - 1][1]) * t; }
  return POS[POS.length - 1][1];
}
export const windPower = (w) => 0.25 + 0.75 * Math.max(TUNE.windMin, w);
export function pointName(angle) {
  const d = angle * 180 / Math.PI;
  return d < 30 ? 'running' : d < 70 ? 'broad reach' : d < 115 ? 'beam reach' : d < 150 ? 'close reach' : 'beating into the wind';
}

// What one sea day gives for a setting: distance run and hull points lost.
export function dayRun(v, setting, from = v.sea ? v.sea.from : v.loc, to = v.sea ? v.sea.to : v.loc, day = v.day) {
  const w = windAt(v, day), sh = v.ship;
  const ang = angDiff(bearing(from, to), w.dir), eff = pointOfSail(ang);
  const f = SET_FACTOR[setting], leak = sh.hp < sh.maxHp * TUNE.leakBelow ? TUNE.leakMod : 1;
  const dist = sh.speed * eff * windPower(w.str) * f * leak;
  const dmg = Math.max(0, w.str * f - sh.strain) * TUNE.strainRate;
  return { dist, dmg, eff, ang, w };
}
export function estDays(v, to) {
  const d = routeDist(v.loc, to), r = dayRun(v, 'full', v.loc, to, v.day);
  const w = windAt(v, v.day);
  const avg = Math.max(8, r.dist) * (w.squall ? 0.8 : 1);
  return Math.max(1, Math.ceil(d / avg));
}

// ---- ship and build ----------------------------------------------------------------------------------------------------------------
export function buildCost(b) { return SIZES[b.size].cost + TIMBERS[b.timber].cost + RIGS[b.rig].cost; }
export function shipSpec(b, q = 0.7) {
  const S = SIZES[b.size], T = TIMBERS[b.timber], R = RIGS[b.rig];
  const maxHp = Math.round(S.hp * T.hp * (0.9 + 0.2 * q));
  return {
    size: b.size, timber: b.timber, rig: b.rig, q: Math.round(q * 100) / 100,
    cap: S.cap, speed: Math.round(S.speed * T.spd * R.spd * (0.95 + 0.1 * q) * 10) / 10,
    maxHp, hp: maxHp, strain: Math.round((R.strain + 0.05 * q) * 100) / 100, cost: buildCost(b), holdUp: 0, sailUp: 0,
  };
}
// The plank-fitting task: a marker sweeps back and forth; tap when it is inside the bright zone.
export function newTask(seed) { return { i: 0, t: 0, res: [], seed, done: false }; }
export function taskState(task) {
  const i = Math.min(task.i, TUNE.planks - 1), speed = 0.55 + 0.1 * i;
  const ph = (task.t * speed) % 2, m = ph < 1 ? ph : 2 - ph;
  const hw = 0.13 - 0.01 * i, c = 0.25 + 0.5 * hash(task.seed, i, 9);
  return { m, c, hw, speed };
}
export function stepTask(task, dt) { if (!task.done) task.t += dt; }
export function tapTask(task) {
  if (task.done) return null;
  const s = taskState(task), err = Math.abs(s.m - s.c);
  const q = err <= s.hw * 0.35 ? 1 : err <= s.hw ? 0.8 - 0.3 * (err - s.hw * 0.35) / (s.hw * 0.65) : Math.max(0.2, 0.5 - (err - s.hw));
  const grade = q >= 0.99 ? 'perfect' : q >= 0.5 ? 'good' : 'rough';
  task.res.push({ q, grade }); task.i += 1;
  if (task.i >= TUNE.planks) task.done = true;
  return { q, grade, i: task.i - 1 };
}
export const taskQuality = (task) => (task.res.length ? task.res.reduce((s, r) => s + r.q, 0) / TUNE.planks : 0.7);

// ---- the voyage ------------------------------------------------------------------------------------------------------------------
export function newVoyage({ seed, mode, startMonth, build, quality }) {
  const M = MODES[mode], ship = shipSpec(build, quality);
  const coins = M.coins - ship.cost;
  return {
    seed, mode, startMonth, day: 0, endDay: M.days, coins, startCoins: M.coins, ship, hold: GOODS.map(() => 0), loc: 1,
    at: 'port', sea: null, slip: PORTS.map(() => GOODS.map(() => 0)), slipDay: PORTS.map(() => 0),
    stats: { legs: 0, bestProfit: 0, damage: 0, bought: 0, sold: 0 }, over: false, reason: '', log: [],
    lastBuy: GOODS.map(() => 0),        // average buy price of what is in the hold (for the profit read-out)
  };
}
export const holdCount = (v) => v.hold.reduce((s, n) => s + n, 0);
export const holdFree = (v) => v.ship.cap - holdCount(v);

function slipNow(v, p, g) {
  const days = v.day - v.slipDay[p];
  return v.slip[p][g] * Math.pow(TUNE.slipDecay, Math.max(0, days));
}
function baseAt(v, p, g, day = v.day) {
  const m = monthOf(v, day), mi = Math.floor((v.startMonth * 30 + day) / 30);
  const drift = 0.88 + 0.24 * hash(v.seed, p * 10 + g, mi, 11);
  void m;
  return GOODS[g].base * PORTS[p].f[g] * drift;
}
export function buyPrice(v, p, g) { return Math.max(1, Math.round(baseAt(v, p, g) * (1 + clamp(slipNow(v, p, g), -TUNE.slipFloor, TUNE.slipCeil)))); }
export function sellPrice(v, p, g) { return Math.max(1, Math.round(baseAt(v, p, g) * (1 + clamp(slipNow(v, p, g), -TUNE.slipFloor, TUNE.slipCeil)) * TUNE.sellCut)); }
// A calm read of "how good is this price": ratio against the average over all ports.
export function priceRatio(v, p, g) { return baseAt(v, p, g) / GOODS[g].base; }

function settleSlip(v, p) {
  for (let g = 0; g < GOODS.length; g++) v.slip[p][g] = slipNow(v, p, g);
  v.slipDay[p] = v.day;
}
export function buy(v, g, n) {
  if (v.at !== 'port' || v.over) return { n: 0, cost: 0 };
  settleSlip(v, v.loc);
  let bought = 0, cost = 0;
  while (bought < n && holdFree(v) > 0) {
    const p = buyPrice(v, v.loc, g);
    if (p > v.coins) break;
    v.coins -= p; cost += p; bought += 1; v.hold[g] += 1;
    v.slip[v.loc][g] += TUNE.slipStep;
  }
  if (bought) {
    const prev = v.hold[g] - bought;
    v.lastBuy[g] = (v.lastBuy[g] * prev + cost) / v.hold[g];
    v.stats.bought += bought;
  }
  return { n: bought, cost };
}
export function sell(v, g, n) {
  if (v.at !== 'port' || v.over) return { n: 0, cost: 0 };
  settleSlip(v, v.loc);
  let sold = 0, got = 0;
  while (sold < n && v.hold[g] > 0) {
    const p = sellPrice(v, v.loc, g);
    v.coins += p; got += p; sold += 1; v.hold[g] -= 1;
    v.slip[v.loc][g] -= TUNE.slipStep;
  }
  if (sold) { v.stats.sold += sold; if (v.hold[g] === 0) v.lastBuy[g] = 0; }
  return { n: sold, cost: got };
}
export function sellAll(v) {
  let got = 0;
  for (let g = 0; g < GOODS.length; g++) got += sell(v, g, v.hold[g]).cost;
  return got;
}
export function repairCost(v) { return (v.ship.maxHp - v.ship.hp) * (PORTS[v.loc].yard ? TUNE.repairCoinsYard : TUNE.repairCoins); }
export function repair(v, hp = Infinity) {
  if (v.at !== 'port' || v.over) return 0;
  const unit = PORTS[v.loc].yard ? TUNE.repairCoinsYard : TUNE.repairCoins;
  const n = Math.min(Math.ceil(hp === Infinity ? v.ship.maxHp : hp), v.ship.maxHp - v.ship.hp, Math.floor(v.coins / unit));
  if (n <= 0) return 0;
  v.ship.hp += n; v.coins -= n * unit; return n;
}
export function canUpgradeHold(v) { return v.at === 'port' && PORTS[v.loc].yard && v.ship.holdUp < TUNE.holdUpgrade.max && v.coins >= TUNE.holdUpgrade.cost; }
export function canUpgradeSail(v) { return v.at === 'port' && PORTS[v.loc].yard && v.ship.sailUp < TUNE.sailUpgrade.max && v.coins >= TUNE.sailUpgrade.cost; }
export function upgradeHold(v) { if (!canUpgradeHold(v)) return false; v.coins -= TUNE.holdUpgrade.cost; v.ship.cap += TUNE.holdUpgrade.bales; v.ship.holdUp += 1; return true; }
export function upgradeSail(v) { if (!canUpgradeSail(v)) return false; v.coins -= TUNE.sailUpgrade.cost; v.ship.strain = Math.round((v.ship.strain + TUNE.sailUpgrade.strain) * 100) / 100; v.ship.sailUp += 1; return true; }

// A day passes in port (waiting for the wind, or for prices to move).
export function waitDay(v) {
  if (v.at !== 'port' || v.over) return;
  v.day += 1; v.coins -= TUNE.upkeep;
  if (v.coins < 0) v.coins = 0;
  checkEnd(v);
}
export function depart(v, to) {
  if (v.at !== 'port' || v.over || !routeDist(v.loc, to)) return false;
  settleSlip(v, v.loc);
  v.at = 'sea'; v.sea = { from: v.loc, to, progress: 0, dist: routeDist(v.loc, to), days: 0, hold: null, holdClass: '', dmg: 0, last: null, startCoins: v.coins, startDay: v.day };
  return true;
}
// One sea day with a sail setting. Returns the event record for the interface.
export function sailDay(v, setting) {
  const s = v.sea; if (!s || v.over) return null;
  const r = dayRun(v, setting);
  s.progress = Math.min(s.dist, s.progress + r.dist);
  const dmg = Math.round(r.dmg);
  v.ship.hp = Math.max(0, v.ship.hp - dmg); s.dmg += dmg; v.stats.damage += dmg;
  v.day += 1; v.coins = Math.max(0, v.coins - TUNE.upkeep); s.days += 1;
  const ev = { setting, dist: Math.round(r.dist), dmg, wind: r.w, eff: r.eff, arrived: false, sunk: false, day: v.day };
  s.last = ev;
  if (v.ship.hp <= TUNE.sinkAt) { v.over = true; v.reason = 'sunk'; v.at = 'sea'; ev.sunk = true; return ev; }
  if (s.progress >= s.dist - 0.001) {
    v.loc = s.to; v.at = 'port'; v.sea = null; v.stats.legs += 1; ev.arrived = true; ev.port = v.loc;
    checkEnd(v);
  }
  return ev;
}
function checkEnd(v) {
  if (!v.over && v.day >= v.endDay && v.at === 'port') { v.over = true; v.reason = 'time'; }
}
// Final figures: cargo is valued at 80% of what it would fetch here; the ship counts at half its cost scaled by condition.
export function finalSale(v) {
  let cargo = 0;
  if (v.reason !== 'sunk') for (let g = 0; g < GOODS.length; g++) cargo += v.hold[g] * sellPrice(v, v.loc, g) * TUNE.cargoValue;
  const hull = v.reason === 'sunk' ? 0 : v.ship.cost * TUNE.resale * (v.ship.hp / v.ship.maxHp);
  let score = v.coins + cargo + hull;
  if (v.reason === 'sunk') score = v.coins * 0.5;
  return { coins: v.coins, cargo: Math.round(cargo), hull: Math.round(hull), score: Math.round(score), net: Math.round(score - v.startCoins) };
}
// Rank from the score relative to the starting purse (thresholds set from the computer captain's own results, see RANK_RATIO).
export const RANK_RATIO = { quick: [0.9, 1.2, 1.5], monsoon: [1.1, 1.6, 2.2] };
export function rankIndex(v, score) {
  const t = RANK_RATIO[v.mode], r = score / v.startCoins;
  return r >= t[2] ? 3 : r >= t[1] ? 2 : r >= t[0] ? 1 : 0;
}

// ---- the computer captain (Watch and Learn, and the Think hint) ----------------------------------------------------------------
// Looks at each neighbour: which cargo to load here, what it would fetch there, how many days it takes in the wind of today and the season.
export function planTrip(v) {
  const here = v.loc, options = [];
  for (const rt of routesFrom(here)) {
    const days = estDays(v, rt.to);
    // Simulate loading the hold unit by unit: the best margin first, with the price slipping as in the real market.
    const slipB = GOODS.map((_, g) => clamp(slipNow(v, here, g), -TUNE.slipFloor, TUNE.slipCeil)), slipS = GOODS.map(() => 0);
    let coins = v.coins + sellValue(v), free = v.ship.cap, profit = 0; const load = GOODS.map(() => 0);
    const arrive = v.day + days;
    const baseB = GOODS.map((_, g) => baseAt(v, here, g)), baseS = GOODS.map((_, g) => baseAt(v, rt.to, g, arrive));
    while (free > 0) {
      let best = -1, bm = 4;
      for (let g = 0; g < GOODS.length; g++) {
        const pb = baseB[g] * (1 + slipB[g]), ps = baseS[g] * (1 + slipS[g]) * TUNE.sellCut, m = ps - pb;
        if (m > bm && pb <= coins) { bm = m; best = g; }
      }
      if (best < 0) break;
      const pb = baseB[best] * (1 + slipB[best]);
      coins -= pb; free -= 1; load[best] += 1; profit += bm;
      slipB[best] += TUNE.slipStep; slipS[best] -= TUNE.slipStep;
    }
    const net = profit - TUNE.upkeep * days;
    options.push({ to: rt.to, days, dist: rt.dist, load, profit: Math.round(profit), net: Math.round(net), rate: net / days });
  }
  options.sort((a, b) => b.rate - a.rate);
  return options;
}
export function sellValue(v) {
  let s = 0; for (let g = 0; g < GOODS.length; g++) s += v.hold[g] * sellPrice(v, v.loc, g);
  return s;
}
// Best sail setting for today on the current leg, with a short reason.
export function bestSetting(v) {
  const hpFrac = v.ship.hp / v.ship.maxHp, k = hpFrac > 0.4 ? 2.2 : 4;
  let best = 'anchor', bu = -1e9; const rows = {};
  for (const s of SETTINGS) {
    const r = dayRun(v, s);
    rows[s] = r;
    let u = r.dist - k * r.dmg;
    if (s === 'anchor') u = -4;
    if (u > bu) { bu = u; best = s; }
  }
  const r = rows[best], w = r.w, cls = windClass(w.str);
  let why;
  if (best === 'anchor') why = w.squall ? 'A squall is on the way. Anchor in the lee and let it pass.' : 'Every sail setting costs more hull than it earns today. Wait it out.';
  else if (best === 'reef') why = `${CLASS_NAME[cls]} ${w.squall ? 'with a squall' : ''} would strain the rig. Reef the sails and keep the hull.`;
  else why = r.eff > 0.9 ? `${CLASS_NAME[cls]} on the beam: the best point of sail. Full sail pays.` : `${CLASS_NAME[cls]}: the rig can take it, so carry full sail.`;
  return { setting: best, why, rows };
}

// ---- evaluation for tests and tuning ---------------------------------------------------------------------------------------------
export function autoVoyage(v, maxSteps = 5000) {
  let steps = 0, waited = 0;
  while (!v.over && steps++ < maxSteps) {
    if (v.at === 'port') {
      sellAll(v);
      if (v.ship.hp < v.ship.maxHp * 0.6) repair(v);
      const opts = planTrip(v);
      const o = opts[0];
      if (o && o.net <= 0 && waited < 2) { waited += 1; waitDay(v); continue; }
      waited = 0;
      if (!o) { waitDay(v); continue; }
      for (let g = 0; g < GOODS.length; g++) if (o.load[g]) buy(v, g, o.load[g]);
      depart(v, o.to);
    } else {
      sailDay(v, bestSetting(v).setting);
    }
  }
  return v;
}
