// Silk Road Trader: the rules engine. Pure functions over a JSON state `S`. Randomness only from the rng handed in. No drawing here.
import { LIMIT_DAYS, CAMEL_LOADS, UNITS_PER_LOAD, START, PRICES, IMPACT, MAX, GOODS, GOOD_IDX, BASE, CITIES, LEGS, PACES, PEOPLE, RANKS, oddsWord } from './data.js';
import { EVENTS, EVENT_BY_ID } from './events.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const GID = GOODS.map((g) => g.id);

// ---------------------------------------------------------------------------------------------------------------- new journey
export function newJourney(rng) {
  const S = {
    v: 1, day: 0, city: 0, dir: 1, over: null, silver: START.silver, camels: START.camels, guards: START.guards, str: START.strength,
    water: 0, food: 0, goods: Object.fromEntries(GID.map((g) => [g, 0])), rep: START.rep, customs: START.customs, tongues: START.tongues,
    mood: CITIES.map(() => GID.map(() => Math.round((0.9 + rng.next() * 0.2) * 1000) / 1000)),
    imp: CITIES.map(() => GID.map(() => 1)),
    news: {}, ledger: {}, did: {}, trip: null, seenEv: [], rival: { mood: 0, met: 0, roll: Math.round(rng.next() * 1000) / 1000 },
    j: { cities: [], people: [], goods: Object.fromEntries(GID.map((g) => [g, { bought: 0, sold: 0, profit: 0 }])), customs: [] },
    stats: { legs: 0, events: 0, earned: 0, spent: 0, best: 0 }, log: [], legsDone: 0, lastNews: null,
  };
  arrive(S, rng, 0, true);
  return S;
}

// ---------------------------------------------------------------------------------------------------------------- markets
export const sellFactor = (S) => 0.9 + 0.012 * S.tongues + 0.0006 * S.rep;
export function newsMult(S, c, g) {
  const n = S.news[c];
  return n && n.good === g && n.until > S.day ? n.mult : 1;
}
// Current list price (silver) of one unit of good g in city c, before the spread.
export function price(S, c, g) {
  const gi = GOOD_IDX[g];
  return Math.max(1, Math.round(BASE[g][c] * S.mood[c][gi] * S.imp[c][gi] * newsMult(S, c, g)));
}
// Total for buying / selling n units where each unit moves the price. Returns { total, avg, last, impAfter }.
export function quote(S, side, c, g, n) {
  const gi = GOOD_IDX[g];
  let imp = S.imp[c][gi], total = 0, last = 0;
  const m = S.mood[c][gi] * newsMult(S, c, g);
  for (let i = 0; i < n; i++) {
    const p = BASE[g][c] * m * imp;
    last = side === 'buy' ? Math.max(1, Math.round(p)) : Math.max(1, Math.round(p * sellFactor(S)));
    total += last;
    imp *= side === 'buy' ? IMPACT.buy : IMPACT.sell;
  }
  return { total, avg: n ? total / n : 0, last, impAfter: imp };
}
export const sellPrice = (S, c, g) => Math.max(1, Math.round(price(S, c, g) * sellFactor(S)));

export function passDays(S, n) {
  const k = 1 - Math.pow(1 - IMPACT.recover, n);
  for (let c = 0; c < S.imp.length; c++) for (let g = 0; g < GID.length; g++) S.imp[c][g] += (1 - S.imp[c][g]) * k;
}

// ---------------------------------------------------------------------------------------------------------------- caravan sums
export const people = (S) => 3 + S.guards;
export const capacity = (S) => S.camels * CAMEL_LOADS;
export const goodsLoads = (S) => GOODS.reduce((s, g) => s + S.goods[g.id] * g.loads, 0);
export const usedLoads = (S) => goodsLoads(S) + (S.water + S.food) / UNITS_PER_LOAD;
export const freeLoads = (S) => capacity(S) - usedLoads(S);
export const dailyWater = (S, dry = 1) => (0.4 * S.camels + 0.2 * people(S)) * dry;
export const dailyFood = (S) => 0.2 * S.camels + 0.4 * people(S);
export const supplyPrice = (S, kind, c = S.city) => Math.max(1, Math.round((kind === 'water' ? 1.2 : 2) * CITIES[c].supply * 10) / 10);
export const goodsValue = (S, c = S.city) => GOODS.reduce((s, g) => s + S.goods[g.id] * Math.round(BASE[g.id][c] * 0.9), 0);
export const dayTag = (S) => LIMIT_DAYS - S.day;

function note(S, text) { S.log.push({ d: S.day, t: text }); if (S.log.length > 60) S.log.shift(); }

// ---------------------------------------------------------------------------------------------------------------- trading
export function buy(S, g, n) {
  if (S.trip || S.over) return { ok: false, msg: 'Not now.' };
  const gd = GOODS[GOOD_IDX[g]];
  const space = Math.floor((freeLoads(S) + 1e-9) / gd.loads);
  let k = Math.min(n, space);
  if (k <= 0) return { ok: false, msg: 'No room on the camels.' };
  // reduce until affordable
  while (k > 0 && quote(S, 'buy', S.city, g, k).total > S.silver) k--;
  if (k <= 0) return { ok: false, msg: 'Not enough silver.' };
  const q = quote(S, 'buy', S.city, g, k);
  S.silver -= q.total; S.goods[g] += k; S.imp[S.city][GOOD_IDX[g]] = q.impAfter;
  S.j.goods[g].bought += k; S.stats.spent += q.total;
  const entry = S.j.goods[g]; entry.cost = (entry.cost ?? 0) + q.total; // running purchase cost for profit estimates
  entry.held = (entry.held ?? 0) + k;
  noteLedger(S, S.city);
  return { ok: true, n: k, total: q.total, msg: `Bought ${k} ${gd.name.toLowerCase()} for ${q.total}.` };
}
export function sell(S, g, n) {
  if (S.trip || S.over) return { ok: false, msg: 'Not now.' };
  const have = S.goods[g], k = Math.min(n, have);
  if (k <= 0) return { ok: false, msg: 'You have none to sell.' };
  const q = quote(S, 'sell', S.city, g, k);
  S.silver += q.total; S.goods[g] -= k; S.imp[S.city][GOOD_IDX[g]] = q.impAfter;
  const e = S.j.goods[g]; e.sold += k; S.stats.earned += q.total;
  const avgCost = (e.held ?? 0) > 0 ? (e.cost ?? 0) / e.held : 0;     // average cost of what is held (goods found or bought)
  e.profit += q.total - avgCost * k; e.cost = Math.max(0, (e.cost ?? 0) - avgCost * k); e.held = Math.max(0, (e.held ?? 0) - k);
  S.stats.best = Math.max(S.stats.best, Math.round(q.total / k));
  noteLedger(S, S.city);
  return { ok: true, n: k, total: q.total, msg: `Sold ${k} ${GOODS[GOOD_IDX[g]].name.toLowerCase()} for ${q.total}.` };
}
export function noteLedger(S, c) {
  const row = (S.ledger[c] ??= {});
  for (const g of GID) row[g] = { buy: price(S, c, g), sell: sellPrice(S, c, g), day: S.day, rumor: false };
}

// ---------------------------------------------------------------------------------------------------------------- caravan actions
export function buyCamel(S) {
  if (S.camels >= MAX.camels) return { ok: false, msg: 'A caravan of twelve camels is the most you can manage.' };
  if (S.silver < PRICES.camelBuy) return { ok: false, msg: 'Not enough silver.' };
  S.silver -= PRICES.camelBuy; S.camels += 1; S.str = Math.round((S.str * (S.camels - 1) + 80) / S.camels);
  return { ok: true, msg: 'A strong camel joins the caravan.' };
}
export function sellCamel(S) {
  if (S.camels <= 1) return { ok: false, msg: 'You need at least one camel.' };
  S.camels -= 1; S.silver += PRICES.camelSell;
  const dropped = enforceCapacity(S);
  return { ok: true, msg: 'Sold a camel.' + (dropped ? ' Some cargo had to be sold cheap.' : '') };
}
export function hireGuard(S) {
  if (S.guards >= MAX.guards) return { ok: false, msg: 'Four guards is the most the caravan can feed.' };
  if (S.silver < PRICES.guardWage * 2) return { ok: false, msg: 'Not enough silver.' };
  S.guards += 1; S.silver -= PRICES.guardWage * 2;
  return { ok: true, msg: `A guard joins at ${PRICES.guardWage} silver a day.` };
}
export function dismissGuard(S) { if (S.guards <= 0) return { ok: false, msg: 'No guards.' }; S.guards -= 1; return { ok: true, msg: 'A guard is paid off.' }; }
export function buySupply(S, kind, n) {
  if (S.trip) return { ok: false, msg: 'Not now.' };
  const p = supplyPrice(S, kind);
  let k = Math.min(n, Math.floor(freeLoads(S) * UNITS_PER_LOAD + 1e-9), Math.floor(S.silver / p));
  if (k <= 0) return { ok: false, msg: freeLoads(S) <= 0.05 ? 'No room on the camels.' : 'Not enough silver.' };
  S[kind] += k; S.silver -= Math.round(k * p); S.stats.spent += Math.round(k * p);
  return { ok: true, n: k, msg: `Bought ${k} ${kind === 'water' ? 'water' : 'provisions'}.` };
}
export function dumpSupply(S, kind, n) { const k = Math.min(n, S[kind]); S[kind] -= k; return { ok: k > 0, n: k, msg: '' }; }
export function restDay(S, rng) {
  if (S.trip || S.over) return { ok: false, msg: 'Not now.' };
  const cost = PRICES.restDay + people(S);
  if (S.silver < cost) return { ok: false, msg: 'Not enough silver.' };
  S.silver -= cost; S.str = clamp(S.str + 14, 0, 100);
  const d = spendCityDay(S);
  return { ok: true, msg: 'The camels rest and the crew sleeps well.' + (d ? ' Guards were paid.' : '') };
}
export function learnPhrases(S) {
  const key = 'phr' + S.city;
  if (S.trip || S.over) return { ok: false, msg: 'Not now.' };
  if (S.did[key]) return { ok: false, msg: 'You have already studied here.' };
  if (S.tongues >= MAX.tongues) return { ok: false, msg: 'You already speak well enough to be understood on the whole road.' };
  if (S.silver < PRICES.phrases) return { ok: false, msg: 'Not enough silver.' };
  S.silver -= PRICES.phrases; S.did[key] = 1; S.tongues += 1;
  spendCityDay(S);
  return { ok: true, msg: 'An evening of lessons with a local teacher.' };
}
export function askNews(S, rng) {
  const key = 'news' + S.city;
  if (S.trip || S.over) return { ok: false, msg: 'Not now.' };
  if (S.did[key]) return { ok: false, msg: 'You have already asked here.' };
  if (S.silver < PRICES.news) return { ok: false, msg: 'Not enough silver.' };
  S.silver -= PRICES.news; S.did[key] = 1;
  giveNews(S, rng, S.city, 1.0);
  return { ok: true, msg: 'Travellers tell you what goods cost in the neighbouring cities.' };
}
function spendCityDay(S) {
  S.day += 1; passDays(S, 1);
  const wage = S.guards * PRICES.guardWage; S.silver = Math.max(0, S.silver - wage); S.str = clamp(S.str, 0, 100);
  return wage;
}
// Reveal rumoured prices of the two neighbouring cities (fuzz shrinks with languages).
export function giveNews(S, rng, around, strength = 1) {
  const err = (0.2 - 0.03 * S.tongues) * strength;
  for (const c of [around - 1, around + 1, around - 2, around + 2]) {
    if (c < 0 || c > 8) continue;
    const dist = Math.abs(c - around);
    const row = (S.ledger[c] ??= {});
    for (const g of GID) {
      if (row[g] && !row[g].rumor && S.day - row[g].day < 5) continue;
      const e = (rng.next() * 2 - 1) * err * (dist === 2 ? 1.6 : 1);
      row[g] = { buy: Math.round(price(S, c, g) * (1 + e)), sell: Math.round(sellPrice(S, c, g) * (1 + e)), day: S.day, rumor: true };
    }
  }
  S.lastNews = S.day;
}
function enforceCapacity(S) {
  let dropped = 0;
  while (usedLoads(S) > capacity(S) + 1e-9) {
    // drop the least valuable load first
    const owned = GOODS.filter((g) => S.goods[g.id] > 0).sort((a, b) => BASE[a.id][S.city] / a.loads - BASE[b.id][S.city] / b.loads);
    if (owned.length) { const g = owned[0]; S.goods[g.id] -= 1; S.silver += Math.round(BASE[g.id][S.city] * 0.5); dropped += 1; if (S.j.goods[g.id].held) S.j.goods[g.id].held -= 1; }
    else if (S.food > 0) S.food = Math.max(0, S.food - 5);
    else S.water = Math.max(0, S.water - 5);
  }
  return dropped;
}

// ---------------------------------------------------------------------------------------------------------------- planning a trip
export const neighbours = (c) => [c - 1, c + 1].filter((x) => x >= 0 && x <= 8);
export const legIndex = (from, to) => Math.min(from, to);
export function legSpec(from, to, route = 'main') {
  const L = LEGS[legIndex(from, to)];
  return route === 'alt' && L.alt ? { ...L.alt, alt: true, base: L } : { ...L, alt: false };
}
export function plan(S, to, route = 'main', paceId = 'steady') {
  const spec = legSpec(S.city, to, route), pace = PACES.find((p) => p.id === paceId) ?? PACES[1];
  const days = Math.max(3, Math.round(spec.days * pace.mult * (S.str < 35 ? 1.2 : 1)));
  const water = Math.ceil(dailyWater(S, spec.dry) * days), food = Math.ceil(dailyFood(S) * days);
  const risk = clamp(spec.danger + pace.danger - 0.05 * S.guards - (S.rep - 20) / 500, 0.05, 0.9);
  return { to, route, pace: pace.id, spec, days, water, food, wages: S.guards * PRICES.guardWage * days, risk,
    enoughWater: S.water >= water, enoughFood: S.food >= food, riskWord: risk >= 0.5 ? 'High' : risk >= 0.32 ? 'Moderate' : 'Low' };
}
export function depart(S, rng, to, route = 'main', paceId = 'steady') {
  if (S.trip || S.over) return { ok: false, msg: 'Already on the road.' };
  if (!neighbours(S.city).includes(to)) return { ok: false, msg: 'No road goes there.' };
  const p = plan(S, to, route, paceId), L = p.spec;
  const nEv = 1 + (p.days >= 10 ? 1 : 0) + (rng.chance(0.35) ? 1 : 0);
  const evAt = [];
  for (let i = 0; i < nEv; i++) {
    const slot = Math.round(((i + 1) / (nEv + 1)) * p.days + (rng.next() - 0.5) * 1.2);
    evAt.push(clamp(slot, 1, Math.max(1, p.days - 1)));
  }
  evAt.sort((a, b) => a - b);
  for (let i = 1; i < evAt.length; i++) if (evAt[i] <= evAt[i - 1]) evAt[i] = Math.min(p.days - 1, evAt[i - 1] + 1);
  S.trip = { from: S.city, to, route, pace: p.pace, name: L.name, biome: L.biome, dry: L.dry, danger: L.danger, tags: L.tags, days: p.days, day: 0, evAt, evDone: 0, leg: legIndex(S.city, to), flash: null };
  S.did = {};   // per-city actions are per visit
  note(S, `Left ${CITIES[S.city].short} for ${CITIES[to].short} (${p.days} days).`);
  return { ok: true, plan: p };
}

// ---------------------------------------------------------------------------------------------------------------- travelling
function dayConsumption(S, trip) {
  const pace = PACES.find((p) => p.id === trip.pace) ?? PACES[1];
  const w = dailyWater(S, trip.dry), f = dailyFood(S), out = { thirsty: false, hungry: false };
  if (S.water >= w) S.water -= w; else { S.water = 0; out.thirsty = true; }
  if (S.food >= f) S.food -= f; else { S.food = 0; out.hungry = true; }
  let strain = pace.strain;
  if (usedLoads(S) > capacity(S) * 0.9) strain += 0.3;
  S.str -= strain;
  if (out.thirsty) S.str -= 6;
  if (out.hungry) S.str -= 3;
  const wage = S.guards * PRICES.guardWage;
  if (wage > S.silver) { if (S.guards > 0) { S.guards -= 1; S.rep = clamp(S.rep - 2, 0, 100); } } else S.silver -= wage;
  S.str = clamp(S.str, 0, 100);
  if (S.str <= 0.5) { S.camels -= 1; S.str = 30; out.lostCamel = true; enforceCapacity(S); }
  S.day += 1; passDays(S, 1);
  return out;
}
const eventOk = (S, ev, trip) => {
  if (!ev.tags?.some((t) => trip.tags.includes(t)) && !ev.tags?.includes('any')) return false;
  if (ev.legs && (trip.leg < ev.legs[0] || trip.leg > ev.legs[1])) return false;
  if (ev.once && S.seenEv.includes(ev.id)) return false;
  return true;
};
export function pickEvent(S, rng, trip) {
  let pool = EVENTS.filter((e) => eventOk(S, e, trip));
  if (S.trip.route === 'alt') pool = pool.filter((e) => e.id !== 'ferry');
  // events not yet seen first, so a journey does not repeat itself until it has to
  const fresh = pool.filter((e) => !S.seenEv.includes(e.id));
  const use = fresh.length ? fresh : pool;
  if (!use.length) return null;
  const w = use.map((e) => (e.rival ? 3 : e.once ? 2 : 1) * (e.id === 'bandits' ? 0.5 + trip.danger * 2 : 1));
  const sum = w.reduce((a, b) => a + b, 0);
  let r = rng.next() * sum;
  for (let i = 0; i < use.length; i++) { r -= w[i]; if (r <= 0) return use[i]; }
  return use[use.length - 1];
}
// Advance one day. Returns { event, arrived, thirsty, hungry, lostCamel, over }.
export function stepDay(S, rng) {
  const trip = S.trip;
  if (!trip) return {};
  trip.day += 1;
  const out = dayConsumption(S, trip);
  if (S.camels <= 0) { S.over = 'stranded'; S.trip = null; return { ...out, over: 'stranded' }; }
  const due = trip.evAt[trip.evDone];
  if (due !== undefined && trip.day >= due && trip.day < trip.days) {
    trip.evDone += 1;
    const ev = pickEvent(S, rng, trip);
    if (ev) { S.seenEv.push(ev.id); S.stats.events += 1; return { ...out, event: ev }; }
  }
  if (trip.day >= trip.days) return { ...out, arrived: true };
  return out;
}

// ---------------------------------------------------------------------------------------------------------------- events
export function odds(S, spec) {
  if (!spec) return null;
  let p = spec.base;
  for (const m of spec.mods ?? []) {
    if (m === 'guards') p += 0.07 * Math.min(S.guards, MAX.guards);
    else if (m === 'tongues') p += 0.05 * S.tongues;
    else if (m === 'customs') p += 0.035 * Math.min(S.customs, MAX.customs);
    else if (m === 'rep') p += S.rep / 500;
    else if (m === 'strength') p += (S.str - 60) / 250;
  }
  if (S.trip?.pace === 'quick') p -= 0.05;
  return clamp(p, 0.08, 0.95);
}
export function choicesFor(S, ev) {
  return ev.choices.map((c, i) => {
    const cost = c.cost ?? {};
    let ok = true, why = '';
    if (cost.silver && S.silver < cost.silver) { ok = false; why = 'Not enough silver'; }
    if (cost.water && S.water < cost.water) { ok = false; why = 'Not enough water'; }
    if (c.req?.guards && S.guards < c.req.guards) { ok = false; why = 'Needs a guard'; }
    if (c.req?.tongues && S.tongues < c.req.tongues) { ok = false; why = `Needs languages ${c.req.tongues}`; }
    if (c.req?.customs && S.customs < c.req.customs) { ok = false; why = `Needs customs ${c.req.customs}`; }
    const p = c.odds ? odds(S, c.odds) : null;
    return { i, label: c.label, sub: c.sub ?? '', cost, ok, why, p, word: p == null ? '' : oddsWord(p) };
  });
}
export function resolveChoice(S, rng, ev, i) {
  const c = ev.choices[i];
  const ch = choicesFor(S, ev)[i];
  if (!ch.ok) return null;
  if (c.cost?.silver) S.silver -= c.cost.silver;
  if (c.cost?.water) S.water -= c.cost.water;
  let win = true, out = c.win;
  if (c.odds) { win = rng.chance(ch.p); out = win ? c.win : c.lose; }
  const chips = applyFx(S, rng, out.fx ?? {});
  if (c.cost?.silver) chips.unshift({ k: 'silver', v: -c.cost.silver });
  if (c.cost?.water) chips.unshift({ k: 'water', v: -c.cost.water });
  if (ev.who && !S.j.people.includes(ev.who)) S.j.people.push(ev.who);
  if (ev.rival) S.rival.met = Math.max(S.rival.met, ev.rival);
  note(S, ev.title + ': ' + out.t);
  return { text: out.t, win: c.odds ? win : null, chips, p: ch.p, who: ev.who };
}
export function applyFx(S, rng, fx) {
  const chips = [], add = (k, v) => { if (v) chips.push({ k, v }); };
  if (fx.silver) { const before = S.silver; S.silver = Math.max(0, S.silver + fx.silver); add('silver', S.silver - before); }
  if (fx.water) { const before = S.water; S.water = clamp(S.water + fx.water, 0, Math.max(S.water, capacity(S) * UNITS_PER_LOAD)); add('water', Math.round(S.water - before)); }
  if (fx.food) { const before = S.food; S.food = clamp(S.food + fx.food, 0, Math.max(S.food, capacity(S) * UNITS_PER_LOAD)); add('food', Math.round(S.food - before)); }
  if (fx.str) { const before = S.str; S.str = clamp(S.str + fx.str, 1, 100); add('strength', Math.round(S.str - before)); }
  if (fx.rep) { const before = S.rep; S.rep = clamp(S.rep + fx.rep, 0, MAX.rep); add('reputation', S.rep - before); }
  if (fx.customs) { const before = S.customs; S.customs = clamp(S.customs + fx.customs, 0, MAX.customs); add('customs', S.customs - before); }
  if (fx.tongues) { const before = S.tongues; S.tongues = clamp(S.tongues + fx.tongues, 0, MAX.tongues); add('languages', S.tongues - before); }
  if (fx.camels) { const before = S.camels; S.camels = clamp(S.camels + fx.camels, 0, MAX.camels); add('camels', S.camels - before); enforceCapacity(S); }
  if (fx.guards !== undefined && fx.guards !== 0) { const before = S.guards; S.guards = clamp(S.guards + fx.guards, 0, MAX.guards); add('guards', S.guards - before); }
  if (fx.rival) S.rival.mood = clamp(S.rival.mood + fx.rival, -4, 6);
  if (fx.g) for (const [g, n] of Object.entries(fx.g)) {
    const gd = GOODS[GOOD_IDX[g]], room = Math.floor((freeLoads(S) + 1e-9) / gd.loads), k = Math.min(n, room);
    if (k > 0) { S.goods[g] += k; S.j.goods[g].held = (S.j.goods[g].held ?? 0) + k; add(g, k); }
  }
  if (fx.loss) {
    let lost = 0;
    for (const g of GOODS) { const n = S.goods[g.id], k = Math.floor(n * fx.loss + 0.5); if (k > 0) { S.goods[g.id] -= k; lost += k; if (S.j.goods[g.id].held) S.j.goods[g.id].held = Math.max(0, S.j.goods[g.id].held - k); } }
    if (!lost) { const best = GOODS.filter((g) => S.goods[g.id] > 0).sort((a, b) => BASE[b.id][S.city] - BASE[a.id][S.city])[0]; if (best) { S.goods[best.id] -= 1; lost = 1; } }
    if (lost) add('goods lost', -lost);
  }
  if (fx.days && S.trip) {
    const t = S.trip;
    if (fx.days > 0) { for (let d = 0; d < fx.days; d++) dayConsumption(S, t); t.days += fx.days; add('days', fx.days); }
    else { const nd = Math.max(t.day + 1, t.days + fx.days); add('days', nd - t.days); t.days = nd; }
  }
  if (fx.news) giveNews(S, rng, S.trip ? S.trip.to : S.city, 1);
  return chips;
}

// ---------------------------------------------------------------------------------------------------------------- arriving
export const MARKET_NEWS = [
  { good: 'silk', mult: 0.8, text: 'Several silk caravans arrived this week. Silk is cheap.' },
  { good: 'silk', mult: 1.25, text: 'A wedding season: buyers are paying more for silk.' },
  { good: 'paper', mult: 1.3, text: 'The scribes\' office needs paper. Prices have risen.' },
  { good: 'spice', mult: 1.25, text: 'A cooks\' fair has pushed up the price of spices.' },
  { good: 'spice', mult: 0.8, text: 'A ship from the south unloaded spices. They are cheap.' },
  { good: 'glass', mult: 1.3, text: 'A festival has emptied the glass stalls. Prices are high.' },
  { good: 'horse', mult: 1.25, text: 'The army is buying horses. Prices are high.' },
  { good: 'horse', mult: 0.8, text: 'A herd just arrived. Horses are cheap.' },
  { good: 'jade', mult: 1.25, text: 'A noble family is buying jade. Prices are high.' },
  { good: 'jade', mult: 0.8, text: 'A river carried down fresh jade. It is cheap.' },
];
export function arrive(S, rng, to, first = false) {
  const info = { first: false, custom: null, news: null, city: to };
  S.city = to; S.trip = null; S.did = {};
  if (!S.j.cities.includes(to)) { S.j.cities.push(to); info.first = true; info.custom = CITIES[to].custom; if (!first) { S.customs = clamp(S.customs + 1, 0, MAX.customs); S.j.customs.push(to); } }
  if (rng.chance(0.3)) {
    const n = rng.pick(MARKET_NEWS);
    S.news[to] = { good: n.good, mult: n.mult, until: S.day + 12, text: n.text };
    info.news = n.text;
  }
  noteLedger(S, to);
  if (!first) S.legsDone += 1;
  if (!first) note(S, `Reached ${CITIES[to].short} on day ${S.day}.`);
  return info;
}
export function cityNews(S) { const n = S.news[S.city]; return n && n.until > S.day ? n : null; }

// ---------------------------------------------------------------------------------------------------------------- ending and score
export function score(S) {
  const gv = goodsValue(S), assets = S.silver + gv + S.camels * 40;
  const parts = {
    silver: S.silver, goods: gv, camels: S.camels * 40,
    cities: 60 * (S.j.cities.length - 1), rep: 4 * S.rep, customs: 15 * S.customs, tongues: 20 * S.tongues,
    journal: 5 * (S.j.people.length + S.j.cities.length + GID.filter((g) => S.j.goods[g].sold > 0).length),
  };
  const total = Math.round(Object.values(parts).reduce((a, b) => a + b, 0));
  const rank = [...RANKS].reverse().find((r) => total >= r.min);
  return { parts, total, rank: rank.name, assets, rivalNet: Math.round(3000 + S.rival.roll * 1200) };
}
export function endJourney(S, reason = 'settled') { S.trip = null; S.over = reason; return score(S); }
export function daysLeft(S) { return LIMIT_DAYS - S.day; }
export { EVENT_BY_ID, PEOPLE, GOODS, CITIES, LEGS, PACES, GID };
