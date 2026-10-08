// Text content: Rules pages, About, How to Play, and the Journal builders. Numbers come from data.js so the pages cannot drift from the engine.
import { LIMIT_DAYS, CAMEL_LOADS, UNITS_PER_LOAD, START, PRICES, IMPACT, MAX, GOODS, CITIES, LEGS, PACES, PEOPLE, RANKS, BASE } from './data.js';
import { sellFactor } from './engine.js';

const P = (p, dim) => ({ p, dim }), H = (h) => ({ h }), LI = (li) => ({ li }), SP = { sp: 1 };
const legLine = (i) => { const L = LEGS[i]; return `${CITIES[i].short} - ${CITIES[i + 1].short}: ${L.name}, ${L.days} days at a steady pace.` + (L.alt ? ` Or ${L.alt.name.toLowerCase()}: ${L.alt.days} days, but ${L.alt.dry >= 1.5 ? 'very dry' : 'higher up'} and more dangerous.` : ''); };

export const RULES = [
  { title: 'The journey', blocks: [
    P('You are a merchant travelling the Silk Road around the year 780, from the Tang capital Chang\'an in the east to Baghdad in the west, and you may travel back again.'),
    H('Goal'),
    P(`You have ${LIMIT_DAYS} days. When the day count reaches ${LIMIT_DAYS} the passes close with snow and the journey ends in the city you have reached. You can also end the journey yourself in any city with Settle here, and it ends if you lose every camel.`),
    P('Your score counts silver, goods, reputation, customs, languages and your journal, not only money. A rank from Peddler to Merchant Prince is given at the end.'),
    H('You start with'),
    LI(`${START.silver} silver, ${START.camels} camels at ${START.strength} strength, no guards and an empty purse of water and food.`),
    LI(`Reputation ${START.rep}, customs ${START.customs}, languages ${START.tongues}.`),
    LI('The journey begins in Chang\'an with 0 water, 0 provisions and no goods: plan and buy before you leave.'),
  ] },
  { title: 'Cities and roads', blocks: [
    P('Nine cities lie in a chain. From any city you can travel to the neighbour to the east or to the west. A road between two neighbours is a leg.'),
    ...LEGS.map((_, i) => LI(legLine(i))),
    H('Choosing a route'),
    P('On legs with an alternative you pick the main road or the alternative in the Road tab. The alternative is shorter but needs more water (dry factor) and has a higher chance of trouble.'),
    H('Choosing a pace'),
    ...PACES.map((p) => LI(`${p.name}: days x${p.mult}, strength loss ${p.strain} a day, trouble ${p.danger >= 0 ? '+' : ''}${Math.round(p.danger * 100)} percent. ${p.note}`)),
    P('If your camels are weaker than 35 strength, the leg takes 20 percent more days.'),
  ] },
  { title: 'Goods and prices', blocks: [
    P('Six goods can be traded. Each has a typical price in each city; your journey rolls each price up or down by up to ten percent, so no two journeys are the same.'),
    ...GOODS.map((g) => LI(`${g.name} (${g.unit}, ${g.loads} load${g.loads > 1 ? 's' : ''} each): ${g.trend}`)),
    H('How a price moves'),
    LI(`Each load you buy raises the price there by ${Math.round((IMPACT.buy - 1) * 1000) / 10} percent, each load you sell lowers it by ${Math.round((1 - IMPACT.sell) * 1000) / 10} percent.`),
    LI(`Every day prices recover ${Math.round(IMPACT.recover * 100)} percent of the way back to normal, in all cities.`),
    LI('Market news: now and then a city has a glut (price lower by 20 percent) or a shortage (higher by 25 to 30 percent) of one good for 12 days. It is shown when you arrive.'),
    H('Buying and selling'),
    LI('You buy at the list price. You sell at the list price times your selling factor.'),
    LI(`Selling factor = ${0.9} + 0.012 per language + 0.0006 per point of reputation. At the start it is ${Math.round(sellFactor({ tongues: START.tongues, rep: START.rep }) * 1000) / 10} percent.`),
    P('Selling a little in each city on the way earns more than selling everything in one place.'),
  ] },
  { title: 'The caravan', blocks: [
    H('Camels'),
    LI(`Each camel carries ${CAMEL_LOADS} loads. A camel costs ${PRICES.camelBuy} silver to buy and returns ${PRICES.camelSell} when sold. You can keep up to ${MAX.camels}, and at least one.`),
    LI('If a camel is sold or lost and you carry more than the camels can hold, the cheapest goods are left behind at half their base price.'),
    H('Cargo space'),
    LI(`Goods use their loads (horses use 2). Water and provisions also take space: ${UNITS_PER_LOAD} units fill one load. You cannot buy more than fits.`),
    H('Strength'),
    LI('Strength (0 to 100) is the health of the whole herd. A day on the road costs strength by pace (0.25, 0.9 or 1.9), plus 0.3 more when you carry more than 90 percent of what the camels can hold.'),
    LI('Going without water costs 6 strength a day, without provisions 3 a day. A rest day in a city restores 14.'),
    LI('If strength falls to zero, you lose a camel and strength returns to 30. With no camels left the journey ends.'),
    H('Guards'),
    LI(`A guard costs ${PRICES.guardWage * 2} silver to hire and ${PRICES.guardWage} silver a day in wages. Up to ${MAX.guards}. They improve odds against trouble, lower the chance of trouble on the road by 5 percent each, and eat supplies like any person.`),
    LI('If you cannot pay wages, a guard leaves and your reputation drops by 2.'),
  ] },
  { title: 'Water and provisions', blocks: [
    P('Each day on the road the caravan drinks and eats. People are you, two cameleers and any guards.'),
    LI('Water per day = (0.4 x camels + 0.2 x people) x the leg\'s dry factor.'),
    LI('Provisions per day = 0.2 x camels + 0.4 x people.'),
    P('The Road tab shows the water and provisions the chosen leg needs. A few extra units are wise: delays and events add days.'),
    H('Prices'),
    LI('Water costs 1.2 silver per unit and provisions 2 silver, times the city factor (0.8 in Samarkand up to 1.1 in Kashgar).'),
    H('When supplies run out'),
    P('You can keep travelling with no water or no provisions, but your camels weaken every day. Events can also give or take supplies.'),
    H('Dry factors'),
    ...LEGS.map((L, i) => LI(`${CITIES[i].short} - ${CITIES[i + 1].short}: ${L.dry}` + (L.alt ? ` (alternative ${L.alt.dry})` : ''))),
  ] },
  { title: 'In the city', blocks: [
    P('Each city has three tabs: Trade, Caravan and Road.'),
    H('Trade'),
    LI('Choose how many to move at once (x1, x5, All), then tap Buy or Sell on a good. You see the price here, how many you hold, and the best price you have seen or heard for it elsewhere.'),
    H('Caravan'),
    LI('Buy or sell camels, hire or pay off guards, buy water and provisions.'),
    LI(`Rest a day: costs ${PRICES.restDay} silver plus 1 per person, takes 1 day, restores 14 strength, and guards still draw wages.`),
    LI(`Learn phrases: costs ${PRICES.phrases} silver and 1 day, gives +1 language (maximum ${MAX.tongues}), once per city visit.`),
    LI(`Ask for news: costs ${PRICES.news} silver, once per city visit. Travellers tell you the prices in the neighbouring cities (up to two cities away). The report is not exact: it can be off by up to 20 percent, 3 percent less for each language you speak.`),
    H('Road'),
    LI('Choose east or west, the route and the pace, check supplies, and Depart. You can also end the journey here with Settle here.'),
  ] },
  { title: 'Encounters', blocks: [
    P('A leg has one to three encounters, more on long legs. Each is a short story with choices. The days at which they happen are fixed when you depart.'),
    H('Choices'),
    LI('Each choice shows what it costs and, when the result is uncertain, an odds word and a percentage.'),
    LI('A choice that needs a guard, languages or customs is greyed out until you have them. A choice that costs silver or water is greyed out if you cannot pay.'),
    H('Odds'),
    P('The chance of the good result is a base chance plus:'),
    LI('+7 percent per guard (up to 4)'),
    LI('+5 percent per language'),
    LI(`+3.5 percent per customs point (up to ${MAX.customs})`),
    LI('+1 percent per 5 points of reputation'),
    LI('Strength: + or - 1 percent per 2.5 points above or below 60'),
    LI('-5 percent while travelling at a quick pace'),
    P('The chance is never below 8 or above 95 percent. Safe means 85 percent or more, Likely 70 or more, Even 50 or more, Risky 30 or more, Long shot below 30.'),
    H('Results'),
    P('A result can change silver, water, provisions, strength, days, reputation, customs, languages, camels, goods, or the relation with the rival trader. The result screen lists every change.'),
    P('An event you have seen does not repeat until all the others of that kind have been seen. Some meetings happen at most once a journey.'),
  ] },
  { title: 'Reputation, customs, languages', blocks: [
    H('Reputation (0 to 100)'),
    LI('Starts at 20. Helping people, keeping promises and honest dealing raise it; hurried or unfair dealing lowers it.'),
    LI('Raises your selling factor and odds, and lowers trouble on the road slightly.'),
    H(`Customs (0 to ${MAX.customs})`),
    LI('You learn one custom the first time you reach each city, plus others from meetings. Some choices need customs, and it improves odds.'),
    H(`Languages (0 to ${MAX.tongues})`),
    LI('Languages raise your selling factor, odds in negotiations and the accuracy of news, and unlock some choices.'),
    H('The rival trader'),
    P('Vakhushu, a Sogdian merchant, may be met up to three times on the road. How you treat him is recorded and shown at the end. He does not change prices.'),
  ] },
  { title: 'Journal and map', blocks: [
    P('The Journal has four tabs: Cities, Goods, People and Ledger. Entries fill as you travel and are kept between journeys.'),
    LI('Cities: what each city is known for and the custom learned there.'),
    LI('Goods: the story of each good and what you bought, sold and earned.'),
    LI('People: everyone you meet on the road.'),
    LI('Ledger: the prices you have seen (exact, from your own visits) or heard (reports, marked heard) in every city, with the day.'),
    P('The Map shows your route, where you are and the days left.'),
  ] },
  { title: 'Score and ranks', blocks: [
    P('When the journey ends your score is the sum of:'),
    LI('Silver in your purse'),
    LI('Goods at about 90 percent of their base price in the city you are in'),
    LI('Camels at 40 silver each'),
    LI('60 per city reached after the first'),
    LI('4 per point of reputation'),
    LI('15 per customs point'),
    LI('20 per language'),
    LI('5 per journal entry (cities, people, goods sold)'),
    H('Ranks'),
    ...RANKS.map((r) => LI(`${r.name}: ${r.min} and above`)),
    P('Your best score and the number of journeys are saved on this device.'),
  ] },
  { title: 'Watch and Learn, Think', blocks: [
    H('Watch and Learn'),
    P('An experienced trader plays the first part of a journey (from Chang\'an to Samarkand) and tells you the reason for every decision: what to buy, what to sell, which road, how much to carry and which choice to make in each encounter.'),
    LI('Each decision has three beats: Think, Reveal (what could be done and what is chosen) and Act.'),
    LI('Pause stops everything where it is; Resume continues from the same point. Skip jumps to the next decision.'),
    LI('Watch and Learn is free and does not use the free preview time.'),
    H('Think (hint)'),
    P('The Think button in the city and in every encounter shows the single next step the advisor would take, with the reason. It never acts for you.'),
    H('Free preview and unlock'),
    P('The first 90 seconds of real play are free. After that the game asks you to unlock the full game once. Menus, Rules, About, Journal and Watch and Learn never use the preview time.'),
  ] },
];

export const ABOUT = [
  P('Silk Road Trader is a journey and trading game about the old caravan road across Eurasia, around the year 780.'),
  P('You lead a small caravan from Chang\'an through Lanzhou, Dunhuang, Turpan, Kashgar, Samarkand and Merv to Rayy and Baghdad. In every oasis city prices are different. You decide what to buy, how many camels and guards to take, how much water to carry, which road to follow and how to treat the people you meet.'),
  H('What is in it'),
  LI('Nine cities, six goods, eight roads, three with a second route.'),
  LI('More than twenty-five illustrated encounters with real choices and consequences.'),
  LI('A journal of cities, goods and people, and a ledger of prices.'),
  LI('Watch and Learn: an experienced trader plays and explains every decision.'),
  LI('A Rules page, text size up to 300 percent, portrait and landscape play on phones and tablets, works offline.'),
  H('About the history'),
  P('Stories and people are inspired by what we know of the road: goods like silk, paper, glass, spices, horses and jade, the Sogdian merchants who spoke many languages, caravan inns, and the oasis cities that kept the road alive. The characters and events are invented for the game.'),
  H('Credits'),
  LI('Design, painting and code: Arcforge.'),
  LI('Titles use the Cinzel typeface (SIL Open Font License).'),
  LI('All art and sound are drawn and synthesised on your device.'),
];

export const HOWTO = [
  H('The aim'),
  P('Cross the road, trade smartly, survive, and finish with the best score you can before the passes close at day 170.'),
  H('Each stop'),
  LI('Trade tab: buy goods that are cheap here and sell goods that are dear here. Prices rise or fall with every load you move.'),
  LI('Caravan tab: add camels for more space, guards for safety, buy water and provisions, rest the camels, learn phrases and ask for news.'),
  LI('Road tab: pick east or west, a route and a pace. Check that your water and provisions are enough, then Depart.'),
  H('On the road'),
  LI('Days pass by themselves. Encounters stop the caravan and ask you to choose. The odds word shows how likely the good outcome is.'),
  LI('Tap the lightbulb for a hint: it explains the next sensible step.'),
  H('Tips'),
  LI('Silk and paper gain value going west, spices and glass going east. Horses and jade are best bought around Kashgar and Samarkand.'),
  LI('Keep water and provisions for a few extra days. Encounters can delay you.'),
  LI('Reputation, customs and languages are worth score and make your odds better.'),
  LI('Watch and Learn on the main menu shows a whole opening with reasons.'),
];

// ---- journal builders -------------------------------------------------------------------------------------------------------------
const fmt = (n) => (Math.round(n) + '');
export function journalBlocks(tab, S, meta) {
  const cities = new Set([...(meta.cities ?? []), ...(S?.j.cities ?? [])]);
  const people = new Set([...(meta.people ?? []), ...(S?.j.people ?? [])]);
  if (tab === 'cities') {
    return [P(`Cities reached: ${cities.size} of ${CITIES.length}.`), ...CITIES.map((c) => ({ card: cities.has(c.id)
      ? { icon: 'city', id: c.id, title: c.name, sub: `Stop ${c.id + 1} of ${CITIES.length}`, lines: [c.known, 'Custom: ' + c.custom, `Typical prices here: silk ${BASE.silk[c.id]}, spices ${BASE.spice[c.id]}, horses ${BASE.horse[c.id]}.`] }
      : { icon: 'locked', title: `Stop ${c.id + 1}: not yet reached`, sub: '', lines: ['Travel along the road to learn about this city.'], dim: true } }))];
  }
  if (tab === 'goods') {
    return GOODS.map((g) => { const e = S?.j.goods[g.id]; const m = meta.goods?.[g.id];
      const bought = (e?.bought ?? 0) + (m?.bought ?? 0), sold = (e?.sold ?? 0) + (m?.sold ?? 0);
      return { card: { icon: 'good', id: g.id, title: g.name, sub: `${g.unit}, ${g.loads} load${g.loads > 1 ? 's' : ''} each`, lines: [g.fact, g.trend, `This journey: bought ${e?.bought ?? 0}, sold ${e?.sold ?? 0}${e ? `, profit ${fmt(e.profit)}` : ''}.`] } }; });
  }
  if (tab === 'people') {
    const met = Object.entries(PEOPLE).filter(([id]) => people.has(id));
    const out = [P(`People met: ${met.length} of ${Object.keys(PEOPLE).length}.`)];
    if (!met.length) out.push(P('Nobody yet. Travel the road and the people you meet will be written here.', true));
    for (const [id, p] of met) out.push({ card: { icon: 'portrait', look: p.look, title: p.name, sub: p.role, lines: [p.note] } });
    if (met.length < Object.keys(PEOPLE).length) out.push(P(`${Object.keys(PEOPLE).length - met.length} more are waiting on the road.`, true));
    return out;
  }
  // ledger
  if (!S) return [P('Start a journey to keep a ledger of prices.', ), P('Prices are written down each time you visit a city, and reports from travellers are marked heard.')];
  const out = [P(`Day ${S.day}. Prices as buy / sell. "heard" means a report, which may be off.`, true)];
  for (const g of GOODS) {
    out.push(H(g.name));
    for (const c of CITIES) { const e = S.ledger[c.id]?.[g.id]; out.push(LI(e ? `${c.short}: ${e.buy} / ${e.sell} (${e.rumor ? 'heard' : 'seen'} day ${e.day})` : `${c.short}: unknown`)); }
  }
  return out;
}
