// The rules of Shagai. Pure and deterministic: this file is the single source of truth for what is legal and what a
// ride is worth. The Rules pages (content.js) are cross-checked against the numbers below; the computer (ai.js) and
// the screens (view.js) only read from here.

export const FACE_NAMES = ['Horse', 'Camel', 'Sheep', 'Goat'];
export const FACE_VALUE = [3, 2, 1, 1];       // strides a bone is worth by the side it shows
export const FACE_WEIGHT = [15, 15, 35, 35];  // chance (out of 100) of each side: the narrow sides are rarer
export const SAME_BONUS = { 2: 1, 3: 3, 4: 6 }; // bonus for a pair / trio / four of one side
export const FULL_HERD_BONUS = 4;             // one of each of the four sides
export const FINISH = 66;                     // reaching this station (or passing it) wins
export const BONES = 4;
export const TOSSES = 3;                      // a ride is a first toss plus up to two re-tosses
export const BUMP_BACK = 2;                   // stations a rival is flicked back when you end on it
export const MAX_RIDERS = 4;

// Special stations. A rider who ends a gallop on one gets its effect (once: effects never chain).
export const TILE_NAMES = { wind: 'Tailwind', burrow: 'Marmot burrow', stream: 'Stream', camp: 'Camp' };
export const TILES = {};
for (const [kind, at] of Object.entries({ camp: [5, 27, 40, 55], wind: [9, 21, 34, 47, 58], burrow: [13, 25, 38, 51, 62], stream: [17, 30, 44] })) for (const i of at) TILES[i] = kind;
export const WIND_FWD = 3, BURROW_BACK = 3;

export const deepClone = (o) => JSON.parse(JSON.stringify(o));

export function newGame({ humans = [true, false], levels = ['steady', 'sharp', 'beginner'], names } = {}) {
  const AI_NAMES = ['Naran', 'Saran', 'Tuya'];
  let ai = 0;
  const riders = humans.map((human, i) => ({
    name: human ? (humans.filter(Boolean).length > 1 ? `Rider ${i + 1}` : 'You') : (names?.[i] ?? AI_NAMES[ai]),
    human, level: human ? 'human' : levels[ai++ % levels.length], pos: 0, status: null,
  }));
  return { riders, turn: 0, rides: 0, winner: -1 };
}

// ---- tossing ---------------------------------------------------------------------------------------------------------
export function rollFace(rng) {
  let r = rng.int(100);
  for (let f = 0; f < 4; f++) { if (r < FACE_WEIGHT[f]) return f; r -= FACE_WEIGHT[f]; }
  return 3;
}
// toss every bone that is not held; held bones keep their side
export const tossBones = (rng, faces, hold) => Array.from({ length: BONES }, (_, i) => (hold && hold[i] && faces ? faces[i] : rollFace(rng)));

export const counts = (faces) => { const c = [0, 0, 0, 0]; for (const f of faces) c[f]++; return c; };

// What a set of four sides is worth. Returns the total strides and a readable breakdown.
export function scoreOf(faces) {
  const c = counts(faces);
  const base = c.reduce((s, n, f) => s + n * FACE_VALUE[f], 0);
  const combos = []; let bonus = 0;
  for (let f = 0; f < 4; f++) if (c[f] >= 2) { bonus += SAME_BONUS[c[f]]; combos.push({ face: f, n: c[f], bonus: SAME_BONUS[c[f]] }); }
  const full = c.every((n) => n === 1);
  if (full) { bonus += FULL_HERD_BONUS; combos.push({ full: true, bonus: FULL_HERD_BONUS }); }
  return { total: base + bonus, base, bonus, combos };
}
export function comboLabel(faces) {
  const { combos } = scoreOf(faces);
  if (!combos.length) return 'No combination';
  return combos.map((k) => (k.full ? 'Full herd' : `${['', '', 'Pair', 'Trio', 'Four'][k.n]} of ${FACE_NAMES[k.face].toLowerCase()}s`)).join(' + ');
}

// ---- a ride's gallop -----------------------------------------------------------------------------------------------
export const tossesFor = (g, pl) => TOSSES + (g.riders[pl].status === 'camp' ? 1 : g.riders[pl].status === 'stream' ? -1 : 0);

// Where a gallop of `strides` would end for rider pl, without changing anything.
export function previewGallop(g, pl, strides) {
  const from = g.riders[pl].pos, landed = from + strides;
  const out = { pl, from, strides, landed, effect: null, final: landed, finished: false, bumped: [], status: null };
  if (landed >= FINISH) { out.final = FINISH; out.finished = true; return out; }
  const kind = TILES[landed];
  if (kind === 'wind') { out.effect = { kind, to: Math.min(FINISH, landed + WIND_FWD) }; out.final = out.effect.to; }
  else if (kind === 'burrow') { out.effect = { kind, to: Math.max(0, landed - BURROW_BACK) }; out.final = out.effect.to; }
  else if (kind === 'stream' || kind === 'camp') { out.effect = { kind, to: landed }; out.status = kind; }
  if (out.final >= FINISH) { out.final = FINISH; out.finished = true; return out; }
  g.riders.forEach((r, q) => { if (q !== pl && r.pos === out.final) out.bumped.push({ pl: q, from: r.pos, to: Math.max(0, r.pos - BUMP_BACK) }); });
  return out;
}
export function applyGallop(g, res) {
  const me = g.riders[res.pl];
  me.status = res.status; // a ride's own status is cleared when the next ride starts (see beginRide)
  me.pos = res.final;
  for (const b of res.bumped) g.riders[b.pl].pos = b.to;
  if (res.finished) g.winner = res.pl;
}
// the next ride starts: a camp or stream status is spent
export function beginRide(g, pl) { const n = tossesFor(g, pl); g.riders[pl].status = null; return n; }

export function nextTurn(g) { g.turn = (g.turn + 1) % g.riders.length; g.rides++; }

export function ranking(g) {
  return g.riders.map((r, pl) => ({ pl, pos: r.pos })).sort((a, b) => (b.pl === g.winner) - (a.pl === g.winner) || b.pos - a.pos || a.pl - b.pl);
}
export const invariant = (g) => g.riders.every((r) => r.pos >= 0 && r.pos <= FINISH) && (g.winner < 0 || g.riders[g.winner].pos === FINISH);
