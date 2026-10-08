// Silk Road Trader: static data. Cities, goods, legs, people and the rule constants. No logic that touches state lives here.
// Setting: around the year 780. A merchant crosses Eurasia from the Tang capital Chang'an to the new Abbasid city of Baghdad.

export const LIMIT_DAYS = 170;               // snow closes the passes: the journey ends on this day
export const CAMEL_LOADS = 6;                // cargo loads one camel carries
export const UNITS_PER_LOAD = 10;            // water / provision units that fill one load of space
export const START = { silver: 800, camels: 4, guards: 0, strength: 85, rep: 20, customs: 0, tongues: 1 };
export const PRICES = { camelBuy: 85, camelSell: 55, guardWage: 3, restDay: 8, phrases: 14, news: 10 };
export const IMPACT = { sell: 0.975, buy: 1.02, recover: 0.06 };    // per load: price factor; per day: share of the gap closed
export const MAX = { guards: 4, camels: 12, tongues: 5, customs: 8, rep: 100 };

export const GOODS = [
  { id: 'silk', name: 'Silk', unit: 'bolts', loads: 1, short: 'Silk', hue: 340,
    fact: 'Woven in China, silk was light, durable and worth far more the farther west it travelled. A caravan could carry a fortune in a few dozen bolts.',
    trend: 'Cheap in Chang\'an, dearer with every city you cross to the west.' },
  { id: 'paper', name: 'Paper', unit: 'reams', loads: 1, short: 'Paper', hue: 45,
    fact: 'Paper was invented in China. Papermakers worked in Samarkand within a few decades of the year 751, and the craft then spread west toward Baghdad.',
    trend: 'Dear in the west, cheap in China, with a dip in Samarkand where it is made.' },
  { id: 'spice', name: 'Spices', unit: 'sacks', loads: 1, short: 'Spices', hue: 18,
    fact: 'Pepper, cinnamon and cloves reached Baghdad by sea and by land from India and the islands, then travelled east for cooks and healers.',
    trend: 'Cheap near Baghdad, much dearer the farther east you carry it.' },
  { id: 'glass', name: 'Glass', unit: 'crates', loads: 1, short: 'Glass', hue: 188,
    fact: 'Glassmakers of Persia and Syria blew bottles and bowls that were prized in China, where such clear glass was rare. Packing it well mattered.',
    trend: 'Cheap in the west, dear in China.' },
  { id: 'horse', name: 'Horses', unit: 'horses', loads: 2, short: 'Horses', hue: 28,
    fact: 'The horses of the Ferghana valley were famous across Asia and the Chinese court paid dearly for them. Each horse is led on a rope and takes two loads of space.',
    trend: 'Cheap around Kashgar and Samarkand, dear in China and Baghdad.' },
  { id: 'jade', name: 'Jade', unit: 'pieces', loads: 1, short: 'Jade', hue: 150,
    fact: 'Jade from the rivers near Khotan and Kashgar was carved into ornaments and seals in China, where it was valued above gold.',
    trend: 'Cheapest near Kashgar, dear in Chang\'an.' },
];
export const GOOD_IDX = Object.fromEntries(GOODS.map((g, i) => [g.id, i]));

// Base price per bolt / ream / sack / crate / horse / piece in silver, by city index 0..8 (Chang'an .. Baghdad).
export const BASE = {
  silk:  [36, 44, 54, 66, 82, 100, 118, 136, 158],
  paper: [20, 24, 30, 38, 50, 40, 56, 72, 90],
  spice: [170, 154, 138, 122, 104, 86, 66, 50, 38],
  glass: [150, 134, 118, 102, 84, 66, 48, 36, 28],
  horse: [230, 205, 170, 125, 80, 68, 100, 130, 165],
  jade:  [125, 108, 90, 62, 34, 62, 78, 90, 100],
};

export const CITIES = [
  { id: 0, name: "Chang'an", short: 'Chang\'an', biome: 'loess', sky: 'day', supply: 1.0, camel: 'bactrian', skyline: 'tang',
    known: 'The Tang capital, a city of straight avenues and walled wards. Merchants from across Asia trade in its Western Market.',
    custom: 'Greet the gate officers with a bow and show your travel pass before anything else.' },
  { id: 1, name: 'Lanzhou', short: 'Lanzhou', biome: 'loess', sky: 'day', supply: 0.9, camel: 'bactrian', skyline: 'river',
    known: 'A crossing of the Yellow River where goods and people ride rafts of inflated sheepskins.',
    custom: 'Pay the ferry fee first, then load the rafts one camel at a time.' },
  { id: 2, name: 'Dunhuang', short: 'Dunhuang', biome: 'gobi', sky: 'dusk', supply: 1.0, camel: 'bactrian', skyline: 'fort',
    known: 'The last great oasis before the desert. Roads from the north and south meet here, and the surrounding cliffs hold painted galleries.',
    custom: 'Hang a freshly filled water skin on every camel before leaving the springs.' },
  { id: 3, name: 'Turpan', short: 'Turpan', biome: 'dunes', sky: 'day', supply: 0.9, camel: 'bactrian', skyline: 'adobe',
    known: 'A hot basin where underground channels bring snow-melt to vineyards. Grapes are dried here into raisins.',
    custom: 'Ask before drinking from a channel shaft; the water is shared by schedule.' },
  { id: 4, name: 'Kashgar', short: 'Kashgar', biome: 'dunes', sky: 'dawn', supply: 1.1, camel: 'bactrian', skyline: 'mountainTown',
    known: 'The last town before the high mountains, with a famous livestock bazaar and jade from nearby rivers.',
    custom: 'Bargain over tea. Hurrying the seller is thought rude.' },
  { id: 5, name: 'Samarkand', short: 'Samarkand', biome: 'valley', sky: 'day', supply: 0.8, camel: 'bactrian', skyline: 'sogdian',
    known: 'Home of the Sogdian merchants, who carried goods and languages along the whole road. Papermakers have set up workshops here.',
    custom: 'Sogdians seal a deal with a written contract and witnesses. Ask for one.' },
  { id: 6, name: 'Merv', short: 'Merv', biome: 'karakum', sky: 'dusk', supply: 0.85, camel: 'bactrian', skyline: 'merv',
    known: 'A walled oasis city fed by canals from the river, known for its libraries and its cotton and melons.',
    custom: 'Register your goods with the market inspector before you sell.' },
  { id: 7, name: 'Rayy', short: 'Rayy', biome: 'plain', sky: 'day', supply: 1.0, camel: 'dromedary', skyline: 'hill',
    known: 'A market city at the foot of the Persian highlands, where glassmakers and potters sell to caravans.',
    custom: 'A guest accepts at least a sip of what the host offers.' },
  { id: 8, name: 'Baghdad', short: 'Baghdad', biome: 'tigris', sky: 'dusk', supply: 0.9, camel: 'dromedary', skyline: 'round',
    known: 'The Round City, newly founded by the Abbasid ruler on the river Tigris. Its markets are crowded with brokers and boats.',
    custom: 'Agree prices through a broker, who is paid by both sides.' },
];

// Legs: leg i joins city i and city i+1. days = steady pace. dry = water multiplier. danger = base chance of trouble.
export const LEGS = [
  { name: "The Wei valley road", days: 7, dry: 0.7, danger: 0.2, biome: 'loess', tags: ['civil', 'plain'] },
  { name: 'The Hexi corridor', days: 10, dry: 1.0, danger: 0.3, biome: 'gobi', tags: ['desert', 'river'],
    alt: null },
  { name: 'The northern road by Hami', days: 8, dry: 1.1, danger: 0.35, biome: 'gobi', tags: ['desert'],
    alt: { name: 'The desert shortcut', days: 6, dry: 1.8, danger: 0.5, biome: 'dunes', tags: ['desert'] } },
  { name: 'The rim of the great sand sea', days: 12, dry: 1.4, danger: 0.35, biome: 'dunes', tags: ['desert'] },
  { name: 'Through the Ferghana valley', days: 11, dry: 0.8, danger: 0.4, biome: 'valley', tags: ['mountain', 'plain'],
    alt: { name: 'The high Pamir pass', days: 8, dry: 0.6, danger: 0.55, biome: 'snow', tags: ['mountain'] } },
  { name: 'Across the Karakum scrub', days: 9, dry: 1.2, danger: 0.3, biome: 'karakum', tags: ['desert'] },
  { name: 'The caravan road to the highlands', days: 10, dry: 1.2, danger: 0.35, biome: 'karakum', tags: ['desert', 'civil'],
    alt: { name: 'The salt-desert shortcut', days: 7, dry: 1.9, danger: 0.5, biome: 'dunes', tags: ['desert'] } },
  { name: 'The river plain to the Tigris', days: 9, dry: 0.9, danger: 0.25, biome: 'plain', tags: ['civil', 'river', 'plain'] },
];

export const PACES = [
  { id: 'slow', name: 'Slow', mult: 1.3, strain: 0.25, danger: -0.05, note: 'More days, camels rest as they walk.' },
  { id: 'steady', name: 'Steady', mult: 1.0, strain: 0.9, danger: 0, note: 'The usual pace.' },
  { id: 'quick', name: 'Quick', mult: 0.8, strain: 1.9, danger: 0.12, note: 'Fewer days, tired camels, more risk.' },
];

export const PEOPLE = {
  lu: { name: 'Inspector Lu', role: 'Gate officer, Chang\'an', look: { skin: '#e2b896', hat: 'official', robe: '#7c2b3a', beard: 0, age: 0.6 }, note: 'Careful and fair. Respects a trader with papers in order.' },
  zhao: { name: 'Zhao', role: 'Ferryman, Yellow River', look: { skin: '#d6a47c', hat: 'straw', robe: '#5a6b52', beard: 1, age: 0.7 }, note: 'Has crossed the river thousands of times and knows every eddy.' },
  anar: { name: 'Anar', role: 'Desert guide', look: { skin: '#c68e63', hat: 'turban', robe: '#9b6b3a', beard: 2, age: 0.8 }, note: 'Reads the sand, the wind and the stars. Says little.' },
  mahan: { name: 'Mahan', role: 'Sogdian merchant', look: { skin: '#d9a982', hat: 'sogdian', robe: '#2f5f8a', beard: 2, age: 0.55 }, note: 'Writes his contracts in three languages and keeps his word in all of them.' },
  vakhu: { name: 'Vakhushu', role: 'Rival trader', look: { skin: '#cf9a74', hat: 'sogdian', robe: '#8a2f3c', beard: 1, age: 0.45 }, note: 'Clever, quick and always one stop ahead of you. Not a villain, only a rival.' },
  tamar: { name: 'Tamar', role: 'Caravanserai keeper', look: { skin: '#d2a07a', hat: 'veil', robe: '#a05a3a', beard: 0, age: 0.6, female: true }, note: 'Runs a courtyard inn for caravans. Hears all the news of the road.' },
  saleh: { name: 'Saleh', role: 'Camel breeder', look: { skin: '#b9845a', hat: 'turban', robe: '#c7a15a', beard: 2, age: 0.7 }, note: 'Can tell a camel\'s trouble from the way it walks.' },
  roxana: { name: 'Roxana', role: 'Healer from Rayy', look: { skin: '#d4a27a', hat: 'veil', robe: '#3f7a6a', beard: 0, age: 0.5, female: true }, note: 'Knows the herbs of the highlands and the remedies for road sickness.' },
  bay: { name: 'Bay Temir', role: 'Horse breeder, Ferghana', look: { skin: '#c1895e', hat: 'fur', robe: '#6b3f2a', beard: 1, age: 0.65 }, note: 'Raises the famous horses of the valley and will not sell a poor one.' },
  sher: { name: 'Captain Sher', role: 'Toll keeper of the pass', look: { skin: '#b98a63', hat: 'fur', robe: '#4a4f66', beard: 2, age: 0.6 }, note: 'Stern, but a fair price is a fair price.' },
  ahmad: { name: 'Ahmad', role: 'Papermaker, Samarkand', look: { skin: '#d9ad88', hat: 'sogdian', robe: '#d4c8a8', beard: 1, age: 0.5 }, note: 'Beats rag pulp into sheets and says the secret is patience.' },
  lian: { name: 'Lian', role: 'Interpreter and scribe', look: { skin: '#e0b894', hat: 'scholar', robe: '#35527a', beard: 0, age: 0.35, female: true }, note: 'Speaks five languages and writes in three scripts.' },
  karim: { name: 'Karim of the Red Ridge', role: 'Road chief', look: { skin: '#b4805a', hat: 'turban', robe: '#5b2a2a', beard: 2, age: 0.55 }, note: 'Leads riders who take a toll from caravans. Prefers a bargain to a fight.' },
  aydar: { name: 'Elder Aydar', role: 'Herder of the steppe', look: { skin: '#c9946c', hat: 'fur', robe: '#7a5a3a', beard: 2, age: 0.9 }, note: 'Offers milk tea and asks every guest for news.' },
  ibrahim: { name: 'Ibrahim', role: 'Glassblower, Rayy', look: { skin: '#cf9d78', hat: 'cap', robe: '#6a4b8a', beard: 1, age: 0.5 }, note: 'Blows bottles so thin they ring like bells.' },
  hasan: { name: 'Hasan', role: 'Market broker, Baghdad', look: { skin: '#c8956b', hat: 'turban', robe: '#2b6b5f', beard: 1, age: 0.5 }, note: 'Takes a little from both sides and makes sure both sides leave pleased.' },
  wen: { name: 'Wen', role: 'Post-relay courier', look: { skin: '#dcb08a', hat: 'official', robe: '#3b4f7a', beard: 0, age: 0.3 }, note: 'Rides between relay stations with sealed letters and has no time to talk, but always has the latest rumour.' },
  mei: { name: 'Mei', role: 'Silk reeler, Chang\'an', look: { skin: '#e4bd9a', hat: 'straw', robe: '#b0547a', beard: 0, age: 0.4, female: true }, note: 'Draws silk thread from cocoons so fine that it hardly weighs anything.' },
  dilnoza: { name: 'Dilnoza', role: 'Dyer, Samarkand', look: { skin: '#d6a47e', hat: 'veil', robe: '#24608a', beard: 0, age: 0.45, female: true }, note: 'Her hands are blue to the wrist from the indigo vats.' },
  bilge: { name: 'Bilge', role: 'Steppe archer', look: { skin: '#bd8a62', hat: 'fur', robe: '#7a3a2a', beard: 0, age: 0.35, female: true }, note: 'Shoots from the saddle at full gallop and laughs when she misses.' },
  farid: { name: 'Farid', role: 'Melon seller, Merv', look: { skin: '#c99a70', hat: 'cap', robe: '#9a7a2a', beard: 1, age: 0.4 }, note: 'Says the melons of Merv are so sweet that they keep the flies awake.' },
  yusuf: { name: 'Yusuf', role: 'Young camel-driver', look: { skin: '#c28e66', hat: 'cap', robe: '#5a7a4a', beard: 0, age: 0.12 }, note: 'Twelve years old and already better with camels than most grown men.' },
  nasrin: { name: 'Nasrin', role: 'Star reader', look: { skin: '#d1a07a', hat: 'veil', robe: '#2a3560', beard: 0, age: 0.55, female: true }, note: 'Travels by night and names every star.' },
};

export const RANKS = [
  { min: 0, name: 'Peddler' }, { min: 1400, name: 'Caravaner' }, { min: 2400, name: 'Trader' },
  { min: 3300, name: 'Merchant' }, { min: 4400, name: 'Master Trader' }, { min: 5600, name: 'Merchant Prince' },
];

// Odds words from a success chance.
export const oddsWord = (p) => (p >= 0.85 ? 'Safe' : p >= 0.7 ? 'Likely' : p >= 0.5 ? 'Even' : p >= 0.3 ? 'Risky' : 'Long shot');
