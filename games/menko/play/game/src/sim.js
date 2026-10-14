// Menko engine: pure and deterministic (randomness only from the rng handed in). The floor is a 640 x 640 square seen from
// above; discs are circles of radius R. Slam = choose a disc, an aim point and a strength; the disc lands at aim + scatter,
// then the air gust rolls against every rival disc within reach. Everything the Rules page says is implemented here.
export const FLOOR = 640;
export const R = 44;                 // disc radius
export const WALL = 8;               // a disc centre stays this far plus R from the edge
export const COVER = 1.3;            // landing within COVER * R of a rival disc centre = lands on top (cover)
export const RUG = { x: 320, y: 320, r: 118 };
export const RUG_BONUS = 1.3;        // resistance multiplier for a disc whose centre is on the rug
export const G0 = 52;                // gust fall-off distance
export const STRIKE_GAP = 3;         // a gap this small counts as a rim strike
export const STRIKE_BONUS = 1.2;
export const POWER_MIN = 0.2, POWER_MAX = 1;

// 12 motifs x 2 colourways = 24 original designs. w = weight dots (2-4), stars = score value (1-3).
const DEF = [
  // id, motif, name, weight, stars, colourway
  ['sun-a', 'sun', 'Rising Sun', 3, 2, 0], ['sun-b', 'sun', 'Harvest Sun', 4, 3, 1],
  ['wave-a', 'wave', 'Blue Wave', 2, 1, 0], ['wave-b', 'wave', 'Night Wave', 3, 2, 1],
  ['moon-a', 'moon', 'Pale Moon', 2, 1, 0], ['moon-b', 'moon', 'Red Moon', 4, 2, 1],
  ['peak-a', 'mountain', 'Snow Peak', 3, 1, 0], ['peak-b', 'mountain', 'Dusk Peak', 4, 3, 1],
  ['carp-a', 'fish', 'Gold Carp', 2, 1, 0], ['carp-b', 'fish', 'Silver Carp', 3, 2, 1],
  ['crane-a', 'crane', 'White Crane', 2, 3, 0], ['crane-b', 'crane', 'Red Crane', 3, 1, 1],
  ['maple-a', 'leaf', 'Maple Leaf', 3, 1, 0], ['maple-b', 'leaf', 'Ginkgo Leaf', 2, 2, 1],
  ['bloom-a', 'flower', 'Cherry Blossom', 2, 2, 0], ['bloom-b', 'flower', 'Camellia', 4, 1, 1],
  ['lamp-a', 'lantern', 'Paper Lantern', 3, 1, 0], ['lamp-b', 'lantern', 'Night Lantern', 4, 2, 1],
  ['star-a', 'star', 'Lucky Star', 2, 2, 0], ['star-b', 'star', 'Comet', 3, 3, 1],
  ['fan-a', 'fan', 'Folding Fan', 4, 1, 0], ['fan-b', 'fan', 'Summer Fan', 2, 1, 1],
  ['kite-a', 'kite', 'Diamond Kite', 3, 2, 0], ['kite-b', 'kite', 'Festival Kite', 4, 1, 1],
];
export const DESIGNS = DEF.map(([id, motif, name, w, stars, ink], i) => ({ i, id, motif, name, w, stars, ink }));

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const clampPos = (v) => clamp(v, R + WALL, FLOOR - R - WALL);
export const onRug = (x, y) => Math.hypot(x - RUG.x, y - RUG.y) <= RUG.r;

export const makeFloor = () => ({ cards: [], nextId: 1 });
export const addCard = (floor, design, side, x, y, spin = 0) => {
  const c = { id: floor.nextId++, d: design, side, x, y, spin };
  floor.cards.push(c);
  return c;
};

// ---- the numbers ------------------------------------------------------------------------------------------------------
export const scatterRadius = (power, w) => 8 + 46 * Math.pow(power, 1.3) * (0.8 + 0.07 * w);
export const gustAt = (power, w, gap, strike) => power * (0.5 + 0.17 * w) * Math.exp(-Math.max(0, gap) / G0) * (strike ? STRIKE_BONUS : 1);
export const resistOf = (card) => (0.4 + 0.15 * DESIGNS[card.d].w) * (onRug(card.x, card.y) ? RUG_BONUS : 1);
export const JITTER_LO = 0.8, JITTER_HI = 1.2;   // each rival disc rolls its gust times a factor in [0.8, 1.2]

// ---- landing ------------------------------------------------------------------------------------------------------
// Where does a slam land? `p` is the scattered aim. Returns { x, y, cover: card|null, strike: bool }.
export function landAt(floor, side, px, py) {
  let x = clampPos(px), y = clampPos(py);
  for (const c of floor.cards) {
    if (c.side !== side && Math.hypot(x - c.x, y - c.y) < COVER * R) return { x, y, cover: c, strike: false };
  }
  for (let pass = 0; pass < 8; pass++) {
    let moved = false;
    for (const c of floor.cards) {
      let dx = x - c.x, dy = y - c.y, d = Math.hypot(dx, dy);
      if (d < 2 * R) {
        if (d < 1e-6) { dx = 1; dy = 0; d = 1; }
        x = c.x + (dx / d) * 2 * R; y = c.y + (dy / d) * 2 * R;
        const cx = clampPos(x), cy = clampPos(y);
        if (cx !== x || cy !== y) { x = cx; y = cy; }
        moved = true;
      }
    }
    if (!moved) break;
  }
  let strike = false;
  for (const c of floor.cards) if (c.side !== side && Math.hypot(x - c.x, y - c.y) - 2 * R <= STRIKE_GAP) strike = true;
  return { x, y, cover: null, strike };
}

// The actual slam. Consumes rng in a fixed order: scatter radius, scatter angle, then one jitter per rival disc.
export function resolveSlam(floor, side, design, aimX, aimY, power, rng) {
  const w = DESIGNS[design].w, s = scatterRadius(power, w);
  const rr = s * Math.sqrt(rng.next()), a = rng.next() * Math.PI * 2;
  const land = landAt(floor, side, aimX + Math.cos(a) * rr, aimY + Math.sin(a) * rr);
  const flips = [];
  if (!land.cover) {
    for (const c of floor.cards) {
      const j = JITTER_LO + (JITTER_HI - JITTER_LO) * rng.next();
      if (c.side === side) continue;
      const gap = Math.hypot(land.x - c.x, land.y - c.y) - 2 * R;
      const gust = gustAt(power, w, gap, land.strike && gap <= STRIKE_GAP) * j, res = resistOf(c);
      flips.push({ id: c.id, gust, res, gap, hit: gust >= res });
    }
  }
  return { land, scatter: s, flips: flips.filter((f) => f.hit), tried: flips };
}

// A deterministic picture of the odds for the aiming screen and the computer rivals: 18 scatter samples (golden-angle
// spiral) x 3 jitter levels. Returns { s, p: Map(cardId -> flip chance 0..1), pCover, exp }.
const SAMPLES = 18, JIT = [0.88, 1.0, 1.12];
export function previewSlam(floor, side, design, aimX, aimY, power, stars = null) {
  const w = DESIGNS[design].w, s = scatterRadius(power, w);
  const p = new Map(), tgt = floor.cards.filter((c) => c.side !== side);
  for (const c of tgt) p.set(c.id, 0);
  let cover = 0;
  for (let i = 0; i < SAMPLES; i++) {
    const r = s * Math.sqrt((i + 0.5) / SAMPLES), a = i * 2.399963;
    const land = landAt(floor, side, aimX + Math.cos(a) * r, aimY + Math.sin(a) * r);
    if (land.cover) { cover++; continue; }
    for (const c of tgt) {
      const gap = Math.hypot(land.x - c.x, land.y - c.y) - 2 * R;
      if (gap > 4 * G0) continue;
      const g = gustAt(power, w, gap, land.strike && gap <= STRIKE_GAP), res = resistOf(c);
      let n = 0;
      for (const j of JIT) if (g * j >= res) n++;
      if (n) p.set(c.id, p.get(c.id) + n / JIT.length);
    }
  }
  let exp = 0;
  for (const c of tgt) { const v = p.get(c.id) / SAMPLES; p.set(c.id, v); exp += v * DESIGNS[c.d].stars; }
  const pc = cover / SAMPLES;
  void stars;
  return { s, p, pCover: pc, exp };
}

// A legal lay spot for a disc: not overlapping another disc, inside the floor. Moves the request the least.
export function layPoint(floor, x, y) {
  x = clampPos(x); y = clampPos(y);
  for (let pass = 0; pass < 10; pass++) {
    let moved = false;
    for (const c of floor.cards) {
      const dx = x - c.x, dy = y - c.y, d = Math.hypot(dx, dy);
      if (d < 2 * R + 2) {
        const nx = d < 1e-6 ? 1 : dx / d, ny = d < 1e-6 ? 0 : dy / d;
        x = clampPos(c.x + nx * (2 * R + 2)); y = clampPos(c.y + ny * (2 * R + 2)); moved = true;
      }
    }
    if (!moved) break;
  }
  return { x, y };
}
export const layBlocked = (floor, x, y) => floor.cards.some((c) => Math.hypot(x - c.x, y - c.y) < 2 * R + 2 - 0.01);

// ---- dealing / scoring ------------------------------------------------------------------------------------------
export function deal(rng, n) {
  const idx = rng.shuffle(DESIGNS.map((d) => d.i));
  return [idx.slice(0, n), idx.slice(n, 2 * n)];
}
export const starsOf = (design) => DESIGNS[design].stars;
