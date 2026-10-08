// Content tables: ports, goods, legs, seasons, lore and trivia. Pure data + small pure helpers.
import { DEG, hash01, wrap360 } from './core.js';

export const SEASONS = {
  kaskazi: { key: 'kaskazi', name: 'Kaskazi (north-east monsoon)', short: 'Kaskazi', from: 50, speed: 7.2, vary: 12, squall: 0.25, blurb: 'Steady wind from the north-east. It carries ships from Arabia and India down to East Africa.' },
  kusi: { key: 'kusi', name: 'Kusi (south-west monsoon)', short: 'Kusi', from: 225, speed: 9.6, vary: 10, squall: 0.55, blurb: 'Strong wind from the south-west. It carries ships from East Africa up to Arabia and India, and the sea is rough.' },
  between: { key: 'between', name: 'Between the monsoons', short: 'Between', from: 190, speed: 3.9, vary: 55, squall: 0.8, blurb: 'Light, shifting wind, long calms and sudden squalls while the monsoon changes sides.' },
};
// month index 0 = January
export const seasonOfMonth = (m) => (m >= 10 || m <= 2 ? 'kaskazi' : m >= 4 && m <= 8 ? 'kusi' : 'between');

export const GOODS = [
  { id: 'dates', name: 'Dates', base: 14, note: 'Sweet and long-lasting; Arabian groves feed the whole ocean.' },
  { id: 'cloth', name: 'Cotton cloth', base: 22, note: 'Printed and woven cloth, the most common trade good in the ocean.' },
  { id: 'pepper', name: 'Pepper', base: 34, note: 'Malabar pepper, small bags worth a lot.' },
  { id: 'timber', name: 'Mangrove timber', base: 12, note: 'Straight mangrove poles from the African coast, used for building roofs.' },
  { id: 'porcelain', name: 'Porcelain', base: 40, note: 'Fine bowls and dishes from China, packed in straw.' },
  { id: 'rice', name: 'Rice', base: 10, note: 'Sacks of rice for the cities of Arabia and Africa.' },
  { id: 'coir', name: 'Coir rope', base: 9, note: 'Rope and sewing cord twisted from coconut husk fibre.' },
  { id: 'resin', name: 'Aromatic resin', base: 28, note: 'Fragrant tree resin from southern Arabia and Somalia, burned as perfume.' },
];
export const GOOD_IDX = Object.fromEntries(GOODS.map((g, i) => [g.id, i]));

// lat/lon of the real harbour towns; mult = price multiplier of each good there (below 1 = cheap here, above 1 = dear here)
export const PORTS = [
  { id: 'kilwa', name: 'Kilwa', region: 'East Africa', lat: -8.96, lon: 39.51, far: false, mult: { timber: 0.55, rice: 0.94, cloth: 1.47, porcelain: 1.11, dates: 0.91, pepper: 1.2, resin: 1.05, coir: 0.75 }, blurb: 'A coral-stone island city on the Swahili coast, rich from the trade in gold and cloth.' },
  { id: 'mombasa', name: 'Mombasa', region: 'East Africa', lat: -4.06, lon: 39.67, far: false, mult: { timber: 0.55, rice: 0.9, cloth: 1.53, porcelain: 1.36, dates: 0.86, pepper: 1.46, resin: 0.66, coir: 0.94 }, blurb: 'An island harbour with a deep creek, the main stop for ships coming down from Arabia.' },
  { id: 'aden', name: 'Aden', region: 'Arabia', lat: 12.78, lon: 45.03, far: false, mult: { resin: 0.68, dates: 1.21, timber: 1.58, rice: 1.47, cloth: 0.94, coir: 1.37, pepper: 1.34, porcelain: 0.93 }, blurb: 'A volcanic harbour at the mouth of the Red Sea, where every ship stops to trade.' },
  { id: 'muscat', name: 'Muscat', region: 'Arabia', lat: 23.61, lon: 58.59, far: false, mult: { dates: 0.58, resin: 0.99, timber: 1.19, pepper: 0.91, porcelain: 1.45, cloth: 1.09, rice: 1.24, coir: 0.91 }, blurb: 'A rocky harbour ringed by hills, with date groves behind it.' },
  { id: 'surat', name: 'Surat', region: 'India', lat: 21.17, lon: 72.83, far: false, mult: { cloth: 0.6, rice: 0.81, dates: 1.34, timber: 1.6, resin: 1.12, porcelain: 1.21, pepper: 0.9, coir: 0.8 }, blurb: 'A river port of weavers and merchants in Gujarat.' },
  { id: 'calicut', name: 'Calicut', region: 'India', lat: 11.25, lon: 75.78, far: false, mult: { pepper: 0.55, coir: 0.55, rice: 0.73, dates: 1.6, porcelain: 1.45, resin: 1.6, cloth: 0.72, timber: 1.59 }, blurb: 'The pepper port of the Malabar coast, open to ships from every shore.' },
  { id: 'malacca', name: 'Malacca', region: 'South-East Asia', lat: 2.19, lon: 102.25, far: true, mult: { porcelain: 0.58, pepper: 1.26, cloth: 1.6, dates: 1.47, resin: 1.38, timber: 0.95, rice: 1.34, coir: 1.55 }, blurb: 'A great market town on the strait, where the winds of two oceans meet.' },
];
export const PORT_IDX = Object.fromEntries(PORTS.map((p, i) => [p.id, i]));

const PAIRS = [['kilwa', 'mombasa'], ['mombasa', 'aden'], ['aden', 'muscat'], ['muscat', 'surat'], ['surat', 'calicut'], ['mombasa', 'calicut'], ['aden', 'calicut'], ['calicut', 'malacca']];
const R_NM = 3440.065;
function geo(a, b) {
  const la1 = a.lat * DEG, la2 = b.lat * DEG, dl = (b.lon - a.lon) * DEG;
  const d = Math.acos(Math.min(1, Math.sin(la1) * Math.sin(la2) + Math.cos(la1) * Math.cos(la2) * Math.cos(dl))) * R_NM;
  const y = Math.sin(dl) * Math.cos(la2), x = Math.cos(la1) * Math.sin(la2) - Math.sin(la1) * Math.cos(la2) * Math.cos(dl);
  return { nm: d, bearing: wrap360(Math.atan2(y, x) / DEG) };
}
// Every leg exists in both directions. `dist` is the length of the playable passage in metres; `days` the calendar days it stands for.
export const LEGS = [];
for (const [a, b] of PAIRS) {
  const A = PORTS[PORT_IDX[a]], B = PORTS[PORT_IDX[b]], g = geo(A, B), g2 = geo(B, A);
  const dist = Math.round(520 + (g.nm - 300) * 0.5), days = Math.max(4, Math.round(g.nm / 115));
  const africa = a === 'kilwa' || a === 'mombasa' || b === 'kilwa' || b === 'mombasa';
  LEGS.push({ id: `${a}>${b}`, from: a, to: b, nm: Math.round(g.nm), bearing: g.bearing, dist, days, africa });
  LEGS.push({ id: `${b}>${a}`, from: b, to: a, nm: Math.round(g.nm), bearing: g2.bearing, dist, days, africa });
}
export const legById = (id) => LEGS.find((l) => l.id === id);
export const legsFrom = (portId) => LEGS.filter((l) => l.from === portId);
export const legSeaCurrent = (leg, season) => {
  if (leg.africa) return season === 'kusi' ? { dir: 20, mag: 0.8 } : season === 'kaskazi' ? { dir: 200, mag: 0.4 } : { dir: 20, mag: 0.3 };
  return season === 'kusi' ? { dir: 70, mag: 0.3 } : season === 'kaskazi' ? { dir: 250, mag: 0.3 } : { dir: 90, mag: 0.1 };
};
// Does this season carry a ship along this leg? (wind blows toward the destination side)
export function legFavour(leg, season) {
  const S = SEASONS[season];
  const toward = wrap360(S.from + 180);
  let d = Math.abs(((toward - leg.bearing + 540) % 360) - 180);
  if (season === 'between') return { rating: 'light', angle: d };
  return { rating: d < 70 ? 'fair' : d < 120 ? 'mixed' : 'foul', angle: d };
}

// ---- difficulty (assist) ------------------------------------------------------------------------------------------------------
export const LEVELS = [
  { name: 'Gentle', blurb: 'A forgiving sail, hints on the sheet slider, light hazards.', trimW: 36, hazard: 0.6, hint: true, err: 0.7 },
  { name: 'Seasoned', blurb: 'True sail behaviour, full hazards.', trimW: 29, hazard: 1.0, hint: true, err: 1.0 },
  { name: 'Master', blurb: 'A tight sail window and no trim guide; nothing is forgiven.', trimW: 22, hazard: 1.3, hint: false, err: 1.2 },
];

export const CREW_NAMES = ['Juma', 'Baraka', 'Zuberi', 'Amani', 'Tumaini', 'Faraji', 'Rehema', 'Hamisi', 'Bakari', 'Saidi', 'Nuru', 'Kassim'];
export const CREW_ROLES = [
  { id: 'navigator', name: 'Navigator', blurb: 'Steadier star sights and a smaller error circle.' },
  { id: 'sailmaker', name: 'Sailmaker', blurb: 'The sail strains and splits less.' },
  { id: 'sailor', name: 'Sailor', blurb: 'Dips the yard faster and pulls on the sweeps.' },
];

export const LORE = [
  { id: 'monsoon', title: 'The wind that turns', text: 'In summer the land of Arabia and India heats and the south-west wind blows toward it. In winter the land cools and the wind turns round and blows from the north-east. Sailors on the Swahili coast called the winter wind kaskazi and the summer wind kusi, and planned whole years around them.' },
  { id: 'lateen', title: 'The lateen sail', text: 'A lateen sail is a triangle of cloth hung from one long slanted yard. It sails well across the wind and can point up to about forty-five degrees from it. To change tack the crew dips the whole yard around the mast, which takes a few careful seconds.' },
  { id: 'kamal', title: 'The kamal', text: 'The kamal is a small wooden card on a cord with knots. The navigator bites the cord at the right knot, holds the card at arm\'s length and lines its lower edge with the horizon and its upper edge with the guiding star. The knot tells the latitude.' },
  { id: 'majid', title: 'Ahmad ibn Majid', text: 'Ahmad ibn Majid (about 1432 to 1500) was a famous pilot of the Indian Ocean. He wrote verse and manuals on stars, coasts, winds and seasons that sailors learned by heart. People called him the Lion of the Sea.' },
  { id: 'stitched', title: 'Sewn ships', text: 'Many ships of the western Indian Ocean were not nailed. The planks were stitched together with cord made from coconut husk, then sealed with fat and lime. Such a hull is flexible and survives hard waves and soft sandy landings.' },
  { id: 'isba', title: 'The finger', text: 'Navigators measured the height of a star in isba, which means finger. One isba is about one degree and a quarter. Each port had a known number of fingers for the guiding star, and a pilot who held that number sailed along that latitude.' },
  { id: 'types', title: 'Many kinds of dhow', text: 'Dhow is a broad name. The boom had a straight stem, the sambuk a plumb bow and square stern, the baghlah a carved high stern. All carried the lateen sail. Small ones fished the coast and big ones crossed the ocean.' },
  { id: 'mangrove', title: 'Mangrove poles', text: 'Straight poles cut in the mangrove swamps of East Africa were shipped to Arabia, where trees are few, and used as roof beams in houses for hundreds of years. They were one of the most steady cargoes on the kusi voyage north.' },
  { id: 'crux', title: 'Crux and the Pole Star', text: 'North of the equator the Pole Star stands still and low or high according to your latitude. South of the equator it sinks below the horizon, and sailors used the Southern Cross to find south from the way it stands.' },
  { id: 'pepper', title: 'Black gold', text: 'Pepper grows on vines on the Malabar hills near Calicut. A few sacks paid for a good part of a voyage, so Calicut grew rich on the trade, and ships came there from every coast.' },
  { id: 'porcelain', title: 'Bowls from far away', text: 'Chinese fleets under the admiral Zheng He visited East African and Arab ports in the early 1400s. Bowls and dishes from China have been found in the ruins of Kilwa and Mombasa, set into walls as decoration and kept as treasures.' },
  { id: 'kilwa', title: 'Kilwa\'s coins', text: 'Kilwa was among the first cities in sub-Saharan Africa to issue its own copper coins, in the fourteenth century. Its great stone palace and mosque ruins still stand on the island, a sign of how rich the monsoon trade made it.' },
];

export const TRIVIA = [
  { q: 'Which monsoon carries dhows from East Africa up to Arabia and India?', a: ['Kusi (south-west)', 'Kaskazi (north-east)', 'No wind at all'], c: 0, lore: 'monsoon' },
  { q: 'What is a lateen sail?', a: ['A square sail on a short yard', 'A triangular sail on one long slanted yard', 'A sail made of rope'], c: 1, lore: 'lateen' },
  { q: 'What did a navigator measure with the kamal?', a: ['The depth of the sea', 'The height of a star above the horizon', 'The speed of the wind'], c: 1, lore: 'kamal' },
  { q: 'What were many Indian Ocean ships sewn together with?', a: ['Iron nails', 'Leather straps', 'Cord of coconut husk'], c: 2, lore: 'stitched' },
  { q: 'Roughly how many degrees is one isba (one finger)?', a: ['About 1.25 degrees', 'About 10 degrees', 'About 45 degrees'], c: 0, lore: 'isba' },
  { q: 'What did East Africa export to Arabia as roof beams?', a: ['Mangrove poles', 'Bamboo', 'Glass'], c: 0, lore: 'mangrove' },
  { q: 'Which port was known for pepper?', a: ['Muscat', 'Calicut', 'Mombasa'], c: 1, lore: 'pepper' },
  { q: 'What do sailors dip when they change tack with a lateen sail?', a: ['The anchor', 'The yard', 'The rudder'], c: 1, lore: 'lateen' },
  { q: 'South of the equator, which star group helps find south?', a: ['The Southern Cross', 'The Big Dipper', 'Orion\'s belt'], c: 0, lore: 'crux' },
  { q: 'Who is called the Lion of the Sea?', a: ['Ahmad ibn Majid', 'A ship\'s cat', 'A harbour master'], c: 0, lore: 'majid' },
];

export const portById = (id) => PORTS[PORT_IDX[id]];
export const goodById = (id) => GOODS[GOOD_IDX[id]];
export { hash01 };
