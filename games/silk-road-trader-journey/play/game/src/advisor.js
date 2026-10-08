// The trade advisor: one next step with a plain reason. Drives Watch & Learn and the Think hint. Never consumes the rng.
import { BASE, CITIES, GOODS, GOOD_IDX, LEGS, PRICES, LIMIT_DAYS, UNITS_PER_LOAD, CAMEL_LOADS, MAX, oddsWord } from './data.js';
import * as E from './engine.js';

const GI = (g) => GOODS[GOOD_IDX[g]];
const money = (n) => `${Math.round(n)} silver`;
const GOODNAME = (g) => GI(g).name.toLowerCase();

// Cities ahead in `dir` that can still be reached in time (steady pace), nearest first, at most `max`.
export function ahead(S, dir, max = 4) {
  const out = []; let days = 0, c = S.city;
  for (let k = 0; k < max; k++) {
    const nx = c + dir;
    if (nx < 0 || nx > 8) break;
    days += LEGS[Math.min(c, nx)].days; c = nx;
    if (days > E.daysLeft(S) - 1) break;
    out.push({ c, days });
  }
  return out;
}
// What a good is typically worth in a city once sold (before price moves), as a guide.
const typical = (S, g, c) => BASE[g][c] * (0.9 + 0.012 * S.tongues + 0.0006 * S.rep) * 0.99;
const bestAhead = (S, g, dir, max = 4) => {
  let best = { v: 0, c: -1 };
  for (const a of ahead(S, dir, max)) { const v = typical(S, g, a.c); if (v > best.v) best = { v, c: a.c }; }
  return best;
};

function goalFor(S, ctx) {
  if (ctx.goal !== undefined && ctx.goal !== null) return ctx.goal;
  return S.dir > 0 ? 8 : 0;
}

export function wantGuards(danger) { return danger >= 0.45 ? 2 : danger >= 0.3 ? 1 : 0; }

// ctx: { goal: city index to head for and finish at (optional), finish: bool }
export function advise(S, ctx = {}) {
  if (S.over) return { act: 'done', label: 'The journey is over.', why: '' };
  const goal = goalFor(S, ctx);
  const city = S.city, name = CITIES[city].short;
  let dir = S.dir;
  // Turn around at the far end of a full journey.
  if (ctx.goal === undefined || ctx.goal === null) {
    if (dir > 0 && (city === 8 || E.daysLeft(S) < (LEGS.slice(city, 8).reduce((s, l) => s + l.days, 0)) + 22)) dir = -1;
  }
  const finish = (city === goal && ctx.goal !== undefined && ctx.goal !== null) || (dir < 0 && ahead(S, dir, 1).length === 0) || (dir > 0 && ahead(S, dir, 1).length === 0);
  const next = city + dir;

  // Cash the next two legs will need (supplies and wages).
  const nextC0 = Math.max(0, Math.min(8, next)), pc0 = E.plan(S, nextC0, 'main', 'steady');
  const next2 = Math.max(0, Math.min(8, next + dir)), pc2 = next2 !== nextC0 ? E.plan({ ...S, city: nextC0 }, next2, 'main', 'steady') : pc0;
  const legCash = (p) => p.water * E.supplyPrice(S, 'water') + p.food * E.supplyPrice(S, 'food') + p.wages;
  const cashNeed = Math.max(0, (S.water >= pc0.water ? 0 : (pc0.water - S.water) * E.supplyPrice(S, 'water')) + (S.food >= pc0.food ? 0 : (pc0.food - S.food) * E.supplyPrice(S, 'food')) + 25);
  const reserve0 = Math.round(legCash(pc0) * 1.2 + legCash(pc2) * 0.9 + 30);
  if (!finish && S.silver < cashNeed + 20 && Object.values(S.goods).some((n) => n > 0)) {
    // short of cash for the road: sell the good whose price here is closest to its price ahead
    let pick = null;
    for (const g of GOODS) { if (S.goods[g.id] <= 0) continue; const here = E.sellPrice(S, city, g.id), ab = bestAhead(S, g.id, dir).v || here; const loss = (ab - here) / ab; if (!pick || loss < pick.loss) pick = { g, here, loss }; }
    if (pick) { const n = Math.min(S.goods[pick.g.id], Math.max(1, Math.ceil((cashNeed + 40 - S.silver) / pick.here))); return { act: 'sell', good: pick.g.id, n, label: `Sell ${n} ${GOODNAME(pick.g.id)}`, why: `Cash is short for the road ahead (supplies cost about ${Math.round(cashNeed)}). Sell a little ${GOODNAME(pick.g.id)} here, where the price is closest to what it fetches ahead.` }; }
  }
  // 1. Sell what is worth selling here.
  for (const g of GOODS) {
    const have = S.goods[g.id];
    if (have <= 0) continue;
    const here = E.sellPrice(S, city, g.id), aheadBest = bestAhead(S, g.id, dir);
    const hold = !finish && aheadBest.c >= 0 && here < aheadBest.v * 0.85;
    if (!hold) {
      // spread the cargo over the cities ahead that pay about as well: sell a share here
      const k = finish ? 0 : ahead(S, dir, 3).filter((a) => typical(S, g.id, a.c) >= here * 0.9).length;
      let want = finish ? have : Math.max(1, Math.ceil(have / (k + 1)));
      let n = 0, p0 = here, imp = S.imp[city][GOOD_IDX[g.id]];
      const m = S.mood[city][GOOD_IDX[g.id]] * E.newsMult(S, city, g.id);
      while (n < want) {
        const unit = BASE[g.id][city] * m * imp * E.sellFactor(S);
        if (n > 0 && !finish && unit < p0 * 0.88) break;
        n += 1; imp *= 0.975;
      }
      n = Math.max(1, n);
      const why = finish ? `This is the end of the trip, so the ${GOODNAME(g.id)} should be sold: ${here} each here.`
        : aheadBest.c < 0 ? `${GI(g.id).name} will not sell better ahead, so sell here at ${here} each.`
        : `${GI(g.id).name} fetches ${here} here, close to what the cities ahead usually pay (about ${Math.round(aheadBest.v)}). Sell ${n} now and keep the rest for the next markets: each sale lowers the price a little, so spreading sales earns more.`;
      return { act: 'sell', good: g.id, n, label: `Sell ${n} ${GOODNAME(g.id)}`, why };
    }
  }
  if (finish) {
    if (!S.trip && !ctx.keepGoing) return { act: 'settle', label: `Settle in ${name}`, why: `This is the end of the road for this trip: goods are sold and the journey can be counted.` };
  }

  const nextC = Math.max(0, Math.min(8, next));
  const route = 'main';
  // supplies for the coming leg decide how much room goods may take
  const pc = E.plan(S, nextC, route, 'steady');
  const supplyLoads = (Math.max(0, pc.water * 1.1 + 2 - S.water) + Math.max(0, pc.food * 1.1 + 2 - S.food)) / UNITS_PER_LOAD;
  const reserve = reserve0;

  // 2. Guards for dangerous legs.
  const want = wantGuards(pc.spec.danger);
  if (S.guards < want && S.silver > reserve + 80 && S.did['g' + city] !== 1) return { act: 'guard', label: 'Hire a guard', why: `The road to ${CITIES[nextC].short} is ${pc.riskWord.toLowerCase()} risk. A guard improves the odds against riders and thieves for ${PRICES.guardWage} silver a day.` };
  if (S.guards > want + 0 && S.guards > 0 && want === 0) return { act: 'dismiss', label: 'Pay off a guard', why: `The next road is calm. A guard costs ${PRICES.guardWage} silver a day and eats supplies.` };

  // 3. Cargo: the good with the best expected margin per load.
  let cand = null;
  const free = E.freeLoads(S) - supplyLoads - 1.0;
  for (const g of GOODS) {
    const b = E.price(S, city, g.id) * 1.0, ab = bestAhead(S, g.id, dir, 4);
    if (!ab.v || ab.c < 0) continue;
    const margin = ab.v * 0.86 - b * 1.06;
    const per = margin / g.loads;
    if (margin <= b * 0.18) continue;
    const held = S.goods[g.id] * g.loads;
    if (held >= 0.6 * E.capacity(S)) continue;
    if (!cand || per > cand.per) cand = { g, b, ab, margin, per, held };
  }
  if (cand && free >= cand.g.loads - 1e-9 && S.silver - reserve > cand.b) {
    const cap = 0.6 * E.capacity(S) - cand.held;
    let n = Math.floor(Math.min(free, cap) / cand.g.loads);
    n = Math.min(n, Math.floor((S.silver - reserve) / (cand.b * 1.08)), 14);
    if (n >= 1) return { act: 'buy', good: cand.g.id, n, label: `Buy ${n} ${GOODNAME(cand.g.id)}`,
      why: `${cand.g.name} costs ${cand.b} here and usually sells for about ${Math.round(cand.ab.v)} in ${CITIES[cand.ab.c].short}. Buying ${n} keeps room for water and food.` };
  }
  if (cand && free < cand.g.loads && S.camels < 8 && S.silver - reserve > PRICES.camelBuy + cand.b * 6 && !S.did['cm' + city]) return { act: 'camel', label: 'Buy a camel', why: `There is more profit to carry (${cand.g.name}) than room to carry it. A camel adds ${CAMEL_LOADS} loads for ${PRICES.camelBuy} silver.` };

  // 4. Supplies.
  const needW = Math.ceil(pc.water * 1.1 + 2), needF = Math.ceil(pc.food * 1.1 + 2);
  const room = Math.floor(E.freeLoads(S) * UNITS_PER_LOAD + 1e-9);
  if ((S.water < needW || S.food < needF) && room < 1) {
    const g = GOODS.filter((x) => S.goods[x.id] > 0).sort((a, b) => E.sellPrice(S, city, a.id) / a.loads - E.sellPrice(S, city, b.id) / b.loads)[0];
    if (g) return { act: 'sell', good: g.id, n: 1, label: `Sell 1 ${GOODNAME(g.id)}`, why: 'The camels are full and the road needs more water and food. Sell a little cargo to make room for supplies.' };
  }
  if (S.water < needW) { const n = Math.max(1, Math.min(room, Math.ceil(needW - S.water))); return { act: 'water', n, label: `Buy ${n} water`, why: `The ${pc.days}-day road to ${CITIES[nextC].short} uses about ${pc.water} water for the caravan. Buy enough with a small margin.` }; }
  if (S.food < needF) { const n = Math.max(1, Math.min(room, Math.ceil(needF - S.food))); return { act: 'food', n, label: `Buy ${n} provisions`, why: `The road needs about ${pc.food} provisions for people and animals. A small margin covers delays.` }; }

  // 5. Rest, languages, news.
  if (S.str < 60 && E.daysLeft(S) > pc.days + 12) return { act: 'rest', label: 'Rest a day', why: `The camels are tired (strength ${Math.round(S.str)}). A day of rest restores 14 strength so they walk better.` };
  if (S.tongues < 3 && S.silver > reserve + 120 && E.daysLeft(S) > 50 && !S.did['phr' + city] && (ctx.phrases ?? true)) return { act: 'phrases', label: 'Learn phrases', why: 'Languages improve prices, odds in bargaining and the accuracy of news. An evening with a teacher costs a day and 14 silver.' };
  const known = S.ledger[nextC] && Object.values(S.ledger[nextC]).some(Boolean);
  if (!known && S.silver > reserve + 30 && !S.did['news' + city] && nextC !== city) return { act: 'news', label: 'Ask for news', why: `Nobody on the team has seen ${CITIES[nextC].short}'s market yet. For ${PRICES.news} silver travellers will tell what things cost there.` };

  // 6. Go.
  const plan = { to: nextC, route, pace: S.str < 50 ? 'slow' : E.daysLeft(S) < pc.days + 14 ? 'quick' : 'steady' };
  const alt = LEGS[Math.min(city, nextC)].alt;
  const why = (alt ? `Take the ${LEGS[Math.min(city, nextC)].name.toLowerCase()}: it is a few days longer than the ${alt.name.toLowerCase()} but has wells and fewer dangers. ` : '')
    + `Pace ${plan.pace}: ${plan.pace === 'slow' ? 'the camels are tired' : plan.pace === 'quick' ? 'time is short' : 'a steady pace keeps the camels fit'}.`;
  return { act: 'depart', ...plan, label: `Depart for ${CITIES[nextC].short}`, why };
}

// ---------------------------------------------------------------------------------------------------------------- event choices
export function fxValue(S, fx = {}) {
  let v = 0;
  v += fx.silver ?? 0; v += (fx.water ?? 0) * 2; v += (fx.food ?? 0) * 3; v += (fx.str ?? 0) * 4;
  v -= (fx.days ?? 0) * 35; v += (fx.rep ?? 0) * 6; v += (fx.customs ?? 0) * 14; v += (fx.tongues ?? 0) * 22; v += (fx.camels ?? 0) * 75;
  v -= (fx.loss ?? 0) * (E.goodsValue(S) + 60); v += (fx.rival ?? 0) * 4;
  for (const [g, n] of Object.entries(fx.g ?? {})) v += n * BASE[g][S.city] * 0.45;
  return v;
}
export function adviseChoice(S, ev) {
  const list = E.choicesFor(S, ev);
  let best = null;
  list.forEach((ch, i) => {
    if (!ch.ok) return;
    const c = ev.choices[i];
    const ev1 = ch.p == null ? fxValue(S, c.win.fx) : ch.p * fxValue(S, c.win.fx) + (1 - ch.p) * fxValue(S, c.lose.fx);
    const val = ev1 - (c.cost?.silver ?? 0) - (c.cost?.water ?? 0) * 2;
    if (!best || val > best.val) best = { i, val, ch };
  });
  best ??= { i: 0, val: 0, ch: list[0] };
  const c = ev.choices[best.i], ch = best.ch;
  const bits = [];
  if (ch.p != null) bits.push(`${oddsWord(ch.p)} (${Math.round(ch.p * 100)} percent)`);
  if (c.cost?.silver) bits.push(`costs ${c.cost.silver} silver`);
  const fx = c.win.fx ?? {};
  if (fx.rep > 0) bits.push('builds reputation'); if (fx.customs > 0) bits.push('teaches customs'); if (fx.tongues > 0) bits.push('improves languages');
  return { act: 'choice', i: best.i, label: c.label, why: `${c.label}: the best expected result of the options${bits.length ? ' - ' + bits.join(', ') : ''}.` };
}

// ---------------------------------------------------------------------------------------------------------------- applying a step
export function applyStep(S, rng, st) {
  switch (st.act) {
    case 'sell': return E.sell(S, st.good, st.n);
    case 'buy': return E.buy(S, st.good, st.n);
    case 'camel': S.did['cm' + S.city] = 1; return E.buyCamel(S);
    case 'guard': S.did['g' + S.city] = 1; return E.hireGuard(S);
    case 'dismiss': return E.dismissGuard(S);
    case 'water': return E.buySupply(S, 'water', st.n);
    case 'food': return E.buySupply(S, 'food', st.n);
    case 'rest': return E.restDay(S, rng);
    case 'phrases': return E.learnPhrases(S);
    case 'news': return E.askNews(S, rng);
    case 'depart': S.dir = st.to > S.city ? 1 : -1; return E.depart(S, rng, st.to, st.route, st.pace);
    case 'settle': E.endJourney(S, 'settled'); return { ok: true };
    default: return { ok: false };
  }
}
