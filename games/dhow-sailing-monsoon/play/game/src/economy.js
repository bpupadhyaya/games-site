// The Career layer: calendar, markets, cargo, crew, the shipyard and the logbook. Pure functions over a plain `camp` object.
import { clamp, hash01, MON3, MONTHS } from './core.js';
import { GOODS, PORTS, PORT_IDX, LEGS, legById, legsFrom, seasonOfMonth, SEASONS, LORE, TRIVIA, GOOD_IDX } from './data.js';

export const START_MONTH = 2;            // March
export const GOAL_COINS = 3000, GOAL_REP = 60, MONTH_LIMIT = 36;
export const WAGE = { sailors: 1.0, navigator: 1.6, sailmaker: 1.3 };
export const HIRE = { sailors: 30, navigator: 90, sailmaker: 70 };
export const CREW_MAX = { sailors: 5, navigator: 1, sailmaker: 1 };
export const WATER_PRICE = 5, HULL_PRICE = 1.3, SAIL_PRICE = 1.6, PORT_FEE = 8;
export const HOLD_STEPS = [20, 26, 32], HOLD_COST = [0, 140, 260];
export const BARREL = 0.2;

export function newCamp(seed) {
  const cargo = {}; const cost = {};
  for (const g of GOODS) { cargo[g.id] = 0; cost[g.id] = 0; }
  return {
    v: 1, seed, port: 'kilwa', day: 0, coins: 320, rep: 10, hull: 100, sail: 100, hold: 0, barrels: 5, morale: 80,
    cargo, cost, crew: { sailors: 3, navigator: 0, sailmaker: 0 }, log: [{ day: 0, text: 'You take command of a dhow in Kilwa.' }], lore: ['monsoon'],
    stats: { voyages: 0, delivered: 0, bestProfit: 0, wrecks: 0, helped: 0, sights: 0, trivia: 0 }, visited: { kilwa: true }, talked: 0, finished: false, farOpen: false,
  };
}
export const monthOf = (camp) => (START_MONTH + Math.floor(camp.day / 30)) % 12;
export const yearOf = (camp) => 1 + Math.floor((START_MONTH * 30 + camp.day) / 360);
export const monthsElapsed = (camp) => Math.floor(camp.day / 30);
export const dateText = (camp) => `${MON3[monthOf(camp)]}, year ${yearOf(camp)}`;
export const seasonNow = (camp) => seasonOfMonth(monthOf(camp));
export const holdMax = (camp) => HOLD_STEPS[camp.hold];
export const cargoUnits = (camp) => GOODS.reduce((n, g) => n + camp.cargo[g.id], 0);
export const crewCount = (camp) => camp.crew.sailors + camp.crew.navigator + camp.crew.sailmaker + 1;
export const dailyWage = (camp) => camp.crew.sailors * WAGE.sailors + camp.crew.navigator * WAGE.navigator + camp.crew.sailmaker * WAGE.sailmaker;
export const dominantGood = (camp) => { let b = null, n = 0; for (const g of GOODS) if (camp.cargo[g.id] > n) { n = camp.cargo[g.id]; b = g.id; } return b; };
export const portOpen = (camp, id) => !PORTS[PORT_IDX[id]].far || camp.farOpen;
export const legsOpen = (camp) => legsFrom(camp.port).filter((l) => portOpen(camp, l.to));

// ---- markets ---------------------------------------------------------------------------------------------------------------------------
// Market pressure: units you bought here push the price up, units you sold push it down; it fades with a half-life of 25 days.
// This is what stops one shuttle between two ports from being the only sensible plan.
export const HEAT_PER_UNIT = 0.006, HEAT_HALF_DAYS = 25;
export function heatOf(camp, portId, goodId) {
  const h = camp.heat?.[`${portId}|${goodId}`]; if (!h) return 0;
  return h.v * Math.pow(0.5, Math.max(0, camp.day - h.day) / HEAT_HALF_DAYS);
}
function addHeat(camp, portId, goodId, units) {
  camp.heat ??= {}; const v = heatOf(camp, portId, goodId) + units; camp.heat[`${portId}|${goodId}`] = { v, day: camp.day };
}
export function midPrice(camp, portId, goodId) {
  const P = PORTS[PORT_IDX[portId]], G = GOODS[GOOD_IDX[goodId]];
  const m = P.mult[goodId] ?? 1, mo = monthsElapsed(camp), pi = PORT_IDX[portId], gi = GOOD_IDX[goodId];
  const drift = (hash01(camp.seed * 131 + pi * 977 + gi * 61 + mo * 17) - 0.5) * 0.26;
  const wave = 0.06 * Math.sin((monthOf(camp) + gi * 1.7 + pi) * 0.9);
  const press = clamp(1 + HEAT_PER_UNIT * heatOf(camp, portId, goodId), 0.55, 1.6);
  return Math.max(2, G.base * m * (1 + drift + wave) * press);
}
export const buyPrice = (camp, portId, goodId) => Math.max(1, Math.round(midPrice(camp, portId, goodId) * (1.06 - 0.1 * camp.rep / 100)));
export const sellPrice = (camp, portId, goodId) => Math.max(1, Math.round(midPrice(camp, portId, goodId) * (0.94 + 0.1 * camp.rep / 100)));
export function buy(camp, goodId, n) {
  const room = holdMax(camp) - cargoUnits(camp);
  let bought = 0, spent = 0;
  for (let i = 0; i < n; i++) {
    const p = Math.round(buyPrice(camp, camp.port, goodId) * (1 + 0.012 * (bought + (camp._slip?.[goodId] ?? 0))));
    if (camp.coins < p || room - bought <= 0) break;
    camp.coins -= p; spent += p; bought += 1;
  }
  if (bought) addHeat(camp, camp.port, goodId, bought);
  if (bought) { const tot = camp.cost[goodId] * camp.cargo[goodId] + spent; camp.cargo[goodId] += bought; camp.cost[goodId] = tot / camp.cargo[goodId]; }
  return { bought, spent };
}
// The goal is judged on coins in hand, also right after a sale (cargo unsold does not count). True the moment it is first reached.
export function checkGoal(camp) {
  if (camp.finished || camp.coins < GOAL_COINS || camp.rep < GOAL_REP) return false;
  camp.finished = true; addLog(camp, 'Named Master Nakhoda of the monsoon seas.'); return true;
}
// What a lot would cost / pay in total (same arithmetic as buy and sell, nothing is changed).
export function quoteBuy(camp, goodId, n) {
  const room = holdMax(camp) - cargoUnits(camp); let spent = 0, k = 0;
  for (; k < n && k < room; k++) { const p = Math.round(buyPrice(camp, camp.port, goodId) * (1 + 0.012 * (k + (camp._slip?.[goodId] ?? 0)))); if (camp.coins < spent + p) break; spent += p; }
  return { n: k, total: spent };
}
export function quoteSell(camp, goodId, n) {
  n = Math.min(n, camp.cargo[goodId]); let got = 0;
  for (let i = 0; i < n; i++) got += Math.max(1, Math.round(sellPrice(camp, camp.port, goodId) * (1 - 0.012 * i)));
  return { n, total: got };
}
// A broke captain with an empty hold is staked by a harbour merchant once in a while, so a bad voyage never ends the career.
export const RESCUE = 120;
export function rescue(camp) {
  if (camp.coins >= 25 || cargoUnits(camp) > 0) return false;
  camp.coins += RESCUE; camp.rep = clamp(camp.rep - 3, 0, 100); camp.stats.rescued = (camp.stats.rescued ?? 0) + 1;
  addLog(camp, `A merchant of ${PORTS[PORT_IDX[camp.port]].name} stakes you ${RESCUE} coins.`); return true;
}
export function sell(camp, goodId, n) {
  let sold = 0, got = 0;
  n = Math.min(n, camp.cargo[goodId]);
  for (let i = 0; i < n; i++) { const p = Math.max(1, Math.round(sellPrice(camp, camp.port, goodId) * (1 - 0.012 * sold))); camp.coins += p; got += p; sold += 1; }
  if (sold) addHeat(camp, camp.port, goodId, -sold);
  camp.cargo[goodId] -= sold; if (!camp.cargo[goodId]) camp.cost[goodId] = 0;
  return { sold, got, goal: checkGoal(camp), rescued: rescue(camp) };
}

// ---- shipyard and crew ---------------------------------------------------------------------------------------------------------------------
export function buyWater(camp, n) { let k = 0; while (k < n && camp.barrels < 6 && camp.coins >= WATER_PRICE) { camp.coins -= WATER_PRICE; camp.barrels += 1; k++; } return k; }
export function repairHull(camp) { const need = 100 - camp.hull, cost = Math.ceil(need * HULL_PRICE); if (need <= 0) return 0; if (camp.coins >= cost) { camp.coins -= cost; camp.hull = 100; return cost; } const pts = Math.floor(camp.coins / HULL_PRICE); camp.coins -= Math.ceil(pts * HULL_PRICE); camp.hull += pts; return pts; }
export function repairSail(camp) { const need = 100 - camp.sail, cost = Math.ceil(need * SAIL_PRICE); if (need <= 0) return 0; if (camp.coins >= cost) { camp.coins -= cost; camp.sail = 100; return cost; } const pts = Math.floor(camp.coins / SAIL_PRICE); camp.coins -= Math.ceil(pts * SAIL_PRICE); camp.sail += pts; return pts; }
export function upgradeHold(camp) { if (camp.hold >= 2) return false; const c = HOLD_COST[camp.hold + 1]; if (camp.coins < c) return false; camp.coins -= c; camp.hold += 1; return true; }
export function hire(camp, role) { if (camp.crew[role] >= CREW_MAX[role] || camp.coins < HIRE[role]) return false; camp.coins -= HIRE[role]; camp.crew[role] += 1; camp.morale = Math.min(100, camp.morale + 2); return true; }
export function dismiss(camp, role) { const min = role === 'sailors' ? 1 : 0; if (camp.crew[role] <= min) return false; camp.crew[role] -= 1; return true; }
export function addLog(camp, text) { camp.log.push({ day: camp.day, text }); if (camp.log.length > 80) camp.log.shift(); }
export function unlockLore(camp, id) { if (!id || camp.lore.includes(id) || !LORE.find((l) => l.id === id)) return false; camp.lore.push(id); return true; }
export function nextTrivia(camp) { return TRIVIA[(camp.stats.voyages + camp.stats.trivia + PORT_IDX[camp.port] * 3) % TRIVIA.length]; }

export const passage = (camp, legId, season) => {
  const leg = legById(legId);
  return { leg, season, seed: (camp.seed * 31 + camp.stats.voyages * 977 + camp.day) >>> 0 };
};

// ---- the end of a voyage ----------------------------------------------------------------------------------------------------------------------------
// Applies the sim's result to the career. Returns a summary for the arrival screen.
export function applyVoyage(camp, V, leg) {
  const r = V.result, sum = { rows: [], notes: [], how: r.how, stars: r.stars };
  const extraDays = r.ratio > 1.5 ? Math.round(leg.days * 0.25) : 0;
  const days = leg.days + extraDays + (r.how === 'arrived' ? 0 : 5);
  camp.day += days;
  const wages = Math.round(dailyWage(camp) * days);
  camp.stats.voyages += 1; camp.stats.sights += r.sights; camp.stats.helped += r.helped;
  camp.hull = clamp(Math.round(V.hull), 0, 100); camp.sail = clamp(Math.round(V.sail), 0, 100); camp.morale = clamp(Math.round(V.morale), 5, 100);
  camp.barrels = clamp(Math.round(V.water / BARREL * 10) / 10, 0, 6);
  const lostFrac = r.cargoLost;
  let lostUnits = 0;
  for (const g of GOODS) { const n = camp.cargo[g.id], l = Math.round(n * lostFrac); camp.cargo[g.id] = n - l; lostUnits += l; if (!camp.cargo[g.id]) camp.cost[g.id] = 0; }
  if (r.how === 'arrived') {
    camp.port = leg.to; camp.visited[leg.to] = true; camp.stats.delivered += 1;
    camp.coins = Math.max(0, camp.coins - wages - PORT_FEE);
    camp.rep = clamp(camp.rep + r.rep, 0, 100);
    sum.rows.push({ label: 'Passage time', value: `${Math.round(r.t)} s (par ${Math.round(V.par)})` }, { label: 'Calendar days', value: String(days) }, { label: 'Crew wages and port fee', value: `-${wages + PORT_FEE} coins` });
    if (lostUnits) sum.notes.push(`${lostUnits} cargo units were lost on the way.`);
    addLog(camp, `${PORTS[PORT_IDX[leg.from]].name} to ${PORTS[PORT_IDX[leg.to]].name} in ${days} days${r.stars === 3 ? ', a fine passage' : ''}.`);
  } else {
    camp.stats.wrecks += r.how === 'wrecked' ? 1 : 0;
    for (const g of GOODS) { const l = Math.round(camp.cargo[g.id] * 0.5); camp.cargo[g.id] -= l; }
    const fine = r.how === 'wrecked' ? 60 : 40;
    camp.coins = Math.max(0, camp.coins - fine - wages);
    camp.rep = clamp(camp.rep - 6, 0, 100); camp.hull = Math.max(camp.hull, 35); camp.sail = Math.max(camp.sail, 40);
    camp.port = leg.from;
    sum.rows.push({ label: 'Days lost', value: String(days) }, { label: 'Costs', value: `-${fine + wages} coins` });
    sum.notes.push(r.how === 'wrecked' ? 'The hull gave way. A fishing boat towed you back, half the cargo was lost.' : r.how === 'thirst' ? 'The water ran out. You turned back and paid for water, and half the cargo spoiled.' : 'You were too long at sea and turned back with the cargo spoiled.');
    addLog(camp, r.how === 'wrecked' ? `Wrecked on the way to ${PORTS[PORT_IDX[leg.to]].name}.` : `Turned back from ${PORTS[PORT_IDX[leg.to]].name}.`);
  }
  if (camp.rep >= GOAL_REP && camp.stats.delivered >= 3 && !camp.farOpen) { camp.farOpen = true; sum.notes.push('Your name is known now. Malacca opens to you.'); addLog(camp, 'Malacca opens to your ship.'); }
  if (checkGoal(camp)) sum.notes.push('You have become a Master Nakhoda!');
  if (rescue(camp)) sum.notes.push(`A merchant of ${PORTS[PORT_IDX[camp.port]].name} stakes you ${RESCUE} coins to start again.`);
  sum.days = days;
  return sum;
}
export const netWorth = (camp) => Math.round(camp.coins + GOODS.reduce((n, g) => n + camp.cargo[g.id] * g.base, 0) + camp.hold * 40);
export const rankOf = (camp) => { const w = netWorth(camp) + camp.rep * 12; return w > 4200 ? 'Master Nakhoda' : w > 2800 ? 'Famed Captain' : w > 1600 ? 'Respected Captain' : w > 900 ? 'Trading Captain' : 'Young Captain'; };
export { MONTHS, SEASONS, LEGS };
