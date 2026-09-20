// Levels are data. A tree is a base point, a depth scale and the perches on it (offsets from the base).
// Level 1: one tree. Level 2: many trees. Level 3 and up: a whole orchard. See design/GDD.md.
const FIVE = [{ dx: -190, dy: -134 }, { dx: -95, dy: -244 }, { dx: 0, dy: -324 }, { dx: 95, dy: -244 }, { dx: 190, dy: -134 }];
const THREE = [{ dx: -95, dy: -244 }, { dx: 0, dy: -324 }, { dx: 95, dy: -244 }];

// crown: canopy size. Small crowns on the many-tree levels so perches on trees behind stay visible.
const tree = (x, y, s, offs, crown = 0.6) => ({ x, y, s, offs, crown });

const ONE = [tree(360, 1190, 1.3, FIVE, 1)];
const MANY = [
  tree(200, 720, 0.7, THREE), tree(520, 720, 0.7, THREE),
  tree(130, 950, 0.9, THREE), tree(590, 950, 0.9, THREE),
  tree(360, 1190, 1.05, THREE),
];
const ORCHARD = [
  tree(100, 650, 0.55, THREE), tree(250, 650, 0.55, THREE), tree(470, 650, 0.55, THREE), tree(620, 650, 0.55, THREE),
  tree(170, 900, 0.75, THREE), tree(360, 900, 0.75, THREE), tree(550, 900, 0.75, THREE),
  tree(215, 1170, 0.95, THREE), tree(505, 1170, 0.95, THREE),
];

// diff: extra difficulty steps at the start (pull-back, flight, gap, threat kinds, volley size all key off it).
// feats: the one new idea this level teaches (and every level after it keeps).
//   seeds   golden seeds on far perches: tap when nothing threatens you to fly for one
//   archers fast arrows with a short warning
//   wind    stones drift sideways: the red ring shows where it will really land
//   nets    a net thrown over a whole tree
//   beaters a beater rattles your perch and flushes you off it
//   boss    the Master Hunter: the same fixed pattern every attempt, so you can learn it
const DEFS = [
  { name: 'Lone Oak', trees: ONE, startHunters: 2, maxHunters: 3, diff: 0, duration: 60, feats: {}, blurb: '' },
  { name: 'The Grove', trees: MANY, startHunters: 4, maxHunters: 8, diff: 5, duration: 60, feats: { seeds: 1 }, blurb: 'Now YOU choose: tap the perch you want to fly to. Grab the golden seeds!' },
  { name: 'The Orchard', trees: ORCHARD, startHunters: 5, maxHunters: 9, diff: 6, duration: 60, feats: { seeds: 1, archers: 1, hitback: 1 }, blurb: 'Archers! Close calls earn acorns: tap a hunter to knock him down.' },
  { name: 'Windy Grove', trees: MANY, startHunters: 5, maxHunters: 8, diff: 6, duration: 60, feats: { seeds: 1, archers: 1, wind: 0.85, hitback: 1 }, blurb: 'Wind! Stones drift. Trust the red ring, not the hunter.' },
  { name: 'The Master Hunter', trees: ORCHARD, startHunters: 7, maxHunters: 11, diff: 8, duration: 70, feats: { seeds: 1, archers: 1, wind: 0.5, boss: 1, hitback: 1 }, blurb: 'The Master Hunter. His pattern is the same every try: learn it.' },
  { name: 'Net Season', trees: ORCHARD, startHunters: 5, maxHunters: 9, diff: 7, duration: 60, feats: { seeds: 1, archers: 1, wind: 0.6, nets: 1, hitback: 1 }, blurb: 'Nets cover a whole tree. Leave it!' },
  { name: 'The Beaters', trees: ORCHARD, startHunters: 5, maxHunters: 9, diff: 7, duration: 60, feats: { seeds: 1, archers: 1, wind: 0.6, nets: 1, beaters: 1, hitback: 1 }, blurb: 'Beaters rattle your perch. Move before they flush you.' },
  { name: 'Master Hunter II', trees: ORCHARD, startHunters: 7, maxHunters: 10, diff: 7, duration: 70, feats: { seeds: 1, archers: 1, wind: 0.6, nets: 1, beaters: 1, boss: 1, hitback: 1 }, blurb: 'He has learned some new tricks.' },
];

export function levelDef(n) {
  const base = DEFS[Math.min(n, DEFS.length) - 1];
  if (n <= DEFS.length) return { ...base, n };
  // past the authored levels: the whole orchard with everything, every level a step harder
  const extra = n - DEFS.length;
  return { ...base, n, name: 'The Orchard ' + (extra + 1), trees: ORCHARD, startHunters: Math.min(9, 5 + extra), maxHunters: 11, diff: 7 + extra * 0.6, feats: { seeds: 1, archers: 1, wind: 0.7, nets: 1, beaters: 1, hitback: 1, boss: extra % 4 === 3 ? 1 : 0 }, blurb: '' };
}

// Flat perch list for a level: { x, y, s, tree, slot } where s is the depth scale.
export function buildPerches(def) {
  const list = [];
  def.trees.forEach((tr, ti) => tr.offs.forEach((o, oi) => list.push({ x: tr.x + o.dx * tr.s, y: tr.y + o.dy * tr.s, s: tr.s, tree: ti, slot: oi })));
  return list;
}
