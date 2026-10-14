// All the words of the game: About, How to Play, the Rules pages. Numbers come from engine.js (the same constants the engine uses).
// Blocks: { h: heading } { p: paragraph } { li: bullet } { fig: name, hh: height in units } { sp: space }
import { TUNE, GOODS, PORTS, SIZES, TIMBERS, RIGS, MODES, RANK_RATIO, RANKS, SET_FACTOR, pointOfSail, windPower, edges } from './engine.js';

const pct = (v) => `${Math.round(v * 100)}%`;
const f2 = (v) => (Math.round(v * 100) / 100).toString();

export const ABOUT = [
  { h: 'Pinisi' },
  { p: 'A game of building, sailing and trading. You build a pinisi, the two-masted wooden trading schooner of South Sulawesi, then sail it round an archipelago chart, buying spice and cargo where it is cheap and selling where it is wanted, with the monsoon deciding how fast you go.' },
  { h: 'Where it comes from' },
  { p: 'The pinisi is built by hand by the Bugis and Makassar boatbuilders of Bira, Tana Beru and Ara on the south coast of Sulawesi, Indonesia. The craft of building these ships without plans, from remembered proportions, has been recognised by UNESCO as a living tradition. For centuries such ships carried cloves, nutmeg, sandalwood, copra, rice, timber and cloth between the islands of Indonesia.' },
  { p: 'This game is an original, simplified take on that world. It shows the craft and the trade routes, with a few shipwrights at work on the beach, and does not depict any ceremony or any real person. The ports are real places; the prices, routes and weather are invented for play.' },
  { h: 'How it sounds and looks' },
  { p: 'Every sound is synthesised on your device while you play: no recordings and no licensed music. The sea, islands, ships and shipyard are rendered in real time in 3D.' },
  { h: 'Made for playing' },
  { li: 'Turn by turn: nothing happens until you choose, so you can play at your own pace.' },
  { li: 'Think points at the best next move and says why.' },
  { li: 'Watch and Learn plays a whole short voyage for you and explains each choice. Pause it at any time.' },
  { li: 'Large text and reduced-motion options. No ads. Works offline.' },
  { sp: 1 },
  { p: 'Pinisi is part of Arcforge, a collection of world heritage games.' },
];

// The 3D layer's licence credits (vendor3d/LICENSES.md), appended to About by main.js when the file has loaded.
export function addLicences(md) {
  const blocks = [{ h: '3D credits' }];
  for (const raw of String(md).split(/\n+/)) {
    const line = raw.replace(/[`*_>#|]/g, '').replace(/\s+/g, ' ').trim();
    if (line.length > 3 && !/^-+$/.test(line)) blocks.push({ p: line });
  }
  if (!ABOUT.some((b) => b.h === '3D credits')) ABOUT.push(...blocks);
}

export const HOWTO = [
  { h: 'Play in four steps' },
  { li: 'Build: at the shipyard choose a hull size, a timber and a rig, then fit the six planks by tapping when the marker is in the bright zone.' },
  { li: 'Trade: in port, buy goods that are cheap here and sell goods that are dear. A green CHEAP tag marks a good price to buy; a gold DEAR tag marks a good price to sell.' },
  { li: 'Choose a route: tap a connected island on the chart, read its distance and days, then Set Sail.' },
  { li: 'Sail: each sea day pick Full sail, Reef or Anchor. Read the wind arrow against your course first.' },
  { h: 'Reading the wind' },
  { li: 'The wind arrow shows where the wind blows toward. Wind from behind or from the side drives you; wind on the nose crawls.' },
  { li: 'Strong wind with full sail strains the rig and costs hull points. Reef to protect the ship; anchor to wait out a squall.' },
  { li: 'The monsoon blows one way for months. Plan trips to travel with it.' },
  { h: 'Tips' },
  { li: 'Fill the hold with a mix of goods: prices fall as you sell and rise as you buy.' },
  { li: 'Repair is cheapest at Bira, where the ships are built.' },
  { li: 'Stuck? Tap Think. It rings the best route or the best sail setting and says why.' },
  { li: 'Keyboard: 1, 2, 3 choose Full, Reef, Anchor at sea. H is Think, Space pauses.' },
];

const goodsRows = GOODS.map((g) => ({ li: `${g.name}: base price ${g.base}.` }));
const sizeRows = Object.values(SIZES).map((s) => ({ li: `${s.name}: ${s.cap} bales, ${s.hp} hull points, ${s.speed} nm a day, ${s.cost} coins. ${s.blurb}` }));
const timberRows = Object.values(TIMBERS).map((s) => ({ li: `${s.name}: hull x${s.hp}, speed x${s.spd}, ${s.cost} coins. ${s.blurb}` }));
const rigRows = Object.values(RIGS).map((s) => ({ li: `${s.name}: speed x${s.spd}, strain limit ${s.strain}, ${s.cost} coins. ${s.blurb}` }));
const longest = edges.reduce((a, e) => (e.dist > a.dist ? e : a), edges[0]);

export const RULES = [
  {
    title: 'The voyage',
    blocks: [
      { p: 'You captain one ship through a voyage that lasts a fixed number of days. Every day at sea and every day waiting in port counts. When the days run out and you are in port, the voyage ends and your score is worked out.' },
      { li: `${MODES.quick.name}: ${MODES.quick.days} days, ${MODES.quick.coins} coins to spend on the ship and cargo, starting in the west monsoon.` },
      { li: `${MODES.monsoon.name}: ${MODES.monsoon.days} days, ${MODES.monsoon.coins} coins, starting in the west or the east monsoon.` },
      { p: 'You start in Makassar with an empty hold. The calendar starts in December (west monsoon) or June (east monsoon); each 30 days is one month.' },
      { fig: 'chart', hh: 360 },
      { p: `The chart has ${PORTS.length} ports and ${edges.length} sea routes. You can only sail along a route between two ports; the longest is ${longest.dist} nautical miles (nm).` },
    ],
  },
  {
    title: 'The shipyard',
    blocks: [
      { p: 'Before the voyage you build your ship. The cost of the three choices is taken from your starting coins, and what is left buys cargo. Each choice changes four numbers: hold (bales), speed (nm per day), hull points and strain limit.' },
      { fig: 'ship', hh: 250 },
      { h: 'Size' }, ...sizeRows,
      { h: 'Timber' }, ...timberRows,
      { h: 'Rig' }, ...rigRows,
      { h: 'Fitting the planks' },
      { p: `The hull has ${TUNE.planks} strakes of planking. A marker sweeps across a bar; tap when it is inside the bright zone. A tap inside the centre of the zone is perfect (full quality), inside the zone is good, outside is rough (at least 20%). The zone narrows and the marker speeds up with each plank.` },
      { p: 'The average fit gives your craft quality from 0 to 100%. Speed is multiplied by 0.95 + 0.10 x quality, hull points by 0.90 + 0.20 x quality, and the strain limit rises by 0.05 x quality.' },
    ],
  },
  {
    title: 'Ports and trade',
    blocks: [
      { p: 'Each port has its own price for each of the seven goods. A port that grows a good sells it cheaply; a port that wants it pays well. Prices also drift each month by up to 12% either way.' },
      { fig: 'goods', hh: 190 },
      ...goodsRows,
      { p: 'In port you may buy and sell in lots of 1, 5 or as many as fit (Max). Your hold has a fixed number of bales; every bale takes one place.' },
      { li: `The price you see is for one bale. Each bale you buy raises that price by ${pct(TUNE.slipStep)}; each bale you sell lowers it by ${pct(TUNE.slipStep)}. The effect fades by ${pct(1 - TUNE.slipDecay)} a day.` },
      { li: `When you sell, the merchant keeps ${pct(1 - TUNE.sellCut)}: you receive ${pct(TUNE.sellCut)} of the posted price.` },
      { li: `A CHEAP tag appears when the local price is 75% or less of the usual price for that good; DEAR when it is 130% or more.` },
      { p: 'Buying here and selling there is the whole business. Mix goods, because a full hold of one good drives its price down quickly.' },
    ],
  },
  {
    title: 'Wind and seasons',
    blocks: [
      { p: 'Wind has a direction and a strength. Both are worked out for each day from the calendar and the voyage seed, so tomorrow is always the same if you replay a voyage.' },
      { li: 'West monsoon (December to March): the wind blows toward the east and a little south.' },
      { li: 'East monsoon (June to September): the wind blows toward the west and a little north.' },
      { li: `Changing winds (April, May, October, November): weaker winds from any direction.` },
      { p: `Each day the wind is Calm, Light, Fresh, Strong or a Gale. A squall is a short gale (strength ${TUNE.squallStr}); about 1 day in ${Math.round(1 / TUNE.squallP)} has one and it is shown a day ahead.` },
      { h: 'Points of sail' },
      { p: 'What matters is the angle between your course and the direction the wind blows toward. The pinisi goes fastest with the wind on the beam and is slow when it must sail into the wind:' },
      { fig: 'points', hh: 210 },
      { li: `Wind astern (0 degrees): x${f2(pointOfSail(0))}. Broad reach (40 degrees): x${f2(pointOfSail(40 * Math.PI / 180))}. Beam reach (90 degrees): x${f2(pointOfSail(Math.PI / 2))}.` },
      { li: `Close reach (130 degrees): x${f2(pointOfSail(130 * Math.PI / 180))}. Nearly into the wind (160 degrees): x${f2(pointOfSail(160 * Math.PI / 180))}. Straight into the wind: x${f2(pointOfSail(Math.PI))}.` },
    ],
  },
  {
    title: 'A day at sea',
    blocks: [
      { p: 'Once you leave port, each day you choose one of three sail settings. The day then plays out and the ship moves along the route.' },
      { li: `Full sail: sets all canvas (factor ${SET_FACTOR.full}).` },
      { li: `Reef: shortens sail (factor ${SET_FACTOR.reef}), slower but gentler on the rig.` },
      { li: 'Anchor: stay where you are. No distance, no strain.' },
      { p: `Distance run = ship speed x point of sail x wind power x sail factor, where wind power = 0.25 + 0.75 x wind strength (strength below ${TUNE.windMin} counts as ${TUNE.windMin}). For example a Pinisi in a fresh breeze (0.9) on a beam reach under full sail runs about ${Math.round(SIZES.pinisi.speed * windPower(0.9))} nm.` },
      { p: `Strain: if wind strength x sail factor is above your strain limit, the rig is overloaded and the hull loses (overload x ${TUNE.strainRate}) points that day. Reefing or anchoring in a blow prevents it.` },
      { li: `A hull below ${pct(TUNE.leakBelow)} of its points leaks and sails ${pct(1 - TUNE.leakMod)} slower.` },
      { li: 'A hull at 0 points sinks: the voyage ends and only half your coins count.' },
      { p: 'Hold keeps your sail setting until the weather changes, so a long steady spell takes one tap. You can always take over.' },
    ],
  },
  {
    title: 'Upkeep, repair and the yard',
    blocks: [
      { li: `Upkeep: ${TUNE.upkeep} coins every day, at sea or in port, for crew and provisions. Coins never fall below zero.` },
      { li: `Repair: ${TUNE.repairCoins} coins per hull point in any port, ${TUNE.repairCoinsYard} coin per point at Bira, where the ships are built.` },
      { li: `Bira yard: a bigger hold (+${TUNE.holdUpgrade.bales} bales, ${TUNE.holdUpgrade.cost} coins, up to ${TUNE.holdUpgrade.max} times) and stronger sailcloth (+${TUNE.sailUpgrade.strain} strain limit, ${TUNE.sailUpgrade.cost} coins, up to ${TUNE.sailUpgrade.max} times).` },
      { li: 'Waiting a day in port costs upkeep but lets the wind and prices change.' },
      { p: 'Your voyage is saved each time you reach a port, so you can leave and Continue later.' },
    ],
  },
  {
    title: 'Score and ranks',
    blocks: [
      { p: `When the voyage ends: score = coins + ${pct(TUNE.cargoValue)} of what the cargo would fetch where you stand + ${pct(TUNE.resale)} of the ship's cost scaled by its hull condition. A sunk ship scores half its coins.` },
      { p: 'Your rank depends on your score compared with the coins you started with:' },
      { li: `${MODES.quick.name}: ${RANKS[0].name} below x${RANK_RATIO.quick[0]}, ${RANKS[1].name} from x${RANK_RATIO.quick[0]}, ${RANKS[2].name} from x${RANK_RATIO.quick[1]}, ${RANKS[3].name} from x${RANK_RATIO.quick[2]}.` },
      { li: `${MODES.monsoon.name}: ${RANKS[0].name} below x${RANK_RATIO.monsoon[0]}, ${RANKS[1].name} from x${RANK_RATIO.monsoon[0]}, ${RANKS[2].name} from x${RANK_RATIO.monsoon[1]}, ${RANKS[3].name} from x${RANK_RATIO.monsoon[2]}.` },
      { p: 'Best scores are kept on this device.' },
    ],
  },
  {
    title: 'Think, Watch and Learn, controls',
    blocks: [
      { h: 'Think' },
      { p: 'In port, Think rings the route the computer captain would take and shows the cargo and why. At sea it points at the best sail setting for today and says why. It never acts for you and can be used as often as you like.' },
      { h: 'Watch and Learn' },
      { p: 'The computer captain sails a short voyage. At each step it goes through three beats: Think (what it sees), Reveal (what it picked and why) and Act (it does it). You can set how long Think lasts in Settings, from 1 to 10 seconds. Pause freezes everything, including the lesson.' },
      { h: 'Controls' },
      { li: 'Touch: tap buttons and islands. Drag the list in port to scroll.' },
      { li: 'Keyboard: 1, 2, 3 at sea for Full, Reef, Anchor; H Think; Space or Escape pause.' },
      { li: 'Text size: every text screen has A- and A+ buttons, up to 300%.' },
      { sp: 1 },
      { p: 'Free preview: the full game starts with a 90 second preview of real play. Menus, Rules, Watch and Learn and the result never use up the preview.' },
    ],
  },
];
