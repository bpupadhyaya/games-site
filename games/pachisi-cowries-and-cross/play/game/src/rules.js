// THE RULE BOOK. Pure and deterministic; nothing here draws or reads the clock. Everything else asks this file.
//
// Board: a cross of four arms (0 bottom, 1 right, 2 top, 3 left), each arm 3 lanes wide and R squares long, plus a
// central square. The outer track has A = 2R+1 squares per arm (R out along the left lane, the tip square in the
// middle, R back along the right lane): T = 4A squares in all, travelled ANTICLOCKWISE.
// A pawn of the player whose home arm is `a` starts on that arm's start square (j = R+1, the first square after the
// arm's tip), races T squares (positions 0..T-1), then climbs the seven-square middle lane of its own arm
// (positions T..T+R-2) and stops in the centre (position END = T+R-1), which needs an EXACT count
// (Pachisi has no throw of 1, so a pawn one square short goes home on any throw).
// pos: -1 = waiting in the yard, 0..END-1 = on the way, END = home.

export const MODES = {
  pachisi: { name: 'Pachisi', R: 8, safeJ: [2, 9, 14], blocks: true, cap: 2, captureAll: false, bonusOnCapture: true, bonusOnHome: true },
  ludo: { name: 'Ludo mode', R: 6, safeJ: [2, 7], blocks: false, cap: 0, captureAll: true, bonusOnCapture: false, bonusOnHome: false },
};

const geoCache = {};
export function geo(mode) {
  if (geoCache[mode]) return geoCache[mode];
  const m = MODES[mode], R = m.R, A = 2 * R + 1, T = 4 * A;
  const safe = new Set();
  for (let a = 0; a < 4; a++) for (const j of m.safeJ) safe.add(A * a + j);
  return (geoCache[mode] = { ...m, mode, A, T, hc: R - 1, END: T + R - 1, safe });
}

// value -> mouths up, and back
const UP_TO_VALUE = { 0: 12, 1: 10, 2: 2, 3: 3, 4: 4, 5: 25, 6: 6 };
export const GRACE_VALUES = { pachisi: [10, 25, 6, 12], ludo: [6] };
export const isGrace = (mode, v) => GRACE_VALUES[mode].includes(v);
export const valueOfUp = (up) => UP_TO_VALUE[up];
export const upOfValue = (v) => Number(Object.keys(UP_TO_VALUE).find((k) => UP_TO_VALUE[k] === v));
// how likely each throw value is (used by the computer to judge danger)
export function throwOdds(mode) {
  if (mode === 'ludo') return { 1: 1 / 6, 2: 1 / 6, 3: 1 / 6, 4: 1 / 6, 5: 1 / 6, 6: 1 / 6 };
  const c = [1, 6, 15, 20, 15, 6, 1], o = {};
  c.forEach((n, up) => { o[UP_TO_VALUE[up]] = n / 64; });
  return o;
}

// The throw. Pachisi: six shells, each mouth up or down. Ludo: one die (shells[0] is the die value).
export function rollThrow(mode, rng, forcedValue = null) {
  if (mode === 'ludo') {
    const value = forcedValue ?? rng.int(6) + 1;
    return { value, grace: isGrace(mode, value), shells: [value], up: value };
  }
  let up;
  if (forcedValue != null) up = upOfValue(forcedValue);
  else { up = 0; for (let i = 0; i < 6; i++) if (rng.chance(0.5)) up++; }
  const order = rng.shuffle([0, 1, 2, 3, 4, 5]), shells = [0, 0, 0, 0, 0, 0];
  for (let k = 0; k < up; k++) shells[order[k]] = 1;
  const value = UP_TO_VALUE[up];
  return { value, grace: isGrace(mode, value), shells, up };
}

export const seatsFor = (n) => (n === 2 ? [0, 2] : n === 3 ? [0, 1, 2] : [0, 1, 2, 3]);
export const COLOUR_NAMES = ['Red', 'Green', 'Gold', 'Indigo'];

export function newGame({ mode = 'pachisi', players = 2, pieces = 4, humans = [true], levels = [], names = [] } = {}) {
  const arms = seatsFor(players);
  return {
    mode, n: pieces,
    players: arms.map((arm, i) => ({ arm, human: !!humans[i], level: levels[i] ?? 'balanced', name: names[i] ?? (humans[i] ? 'You' : COLOUR_NAMES[arm]) })),
    pos: arms.map(() => Array.from({ length: pieces }, () => -1)),
    turn: 0, winner: -1, throws: 0, captures: 0,
  };
}

// which outer square (0..T-1) is a pawn of player `pl` on at position p? (null in yard, home lane or centre)
export function trackIndex(g, pl, p) {
  const G = geo(g.mode);
  if (p < 0 || p >= G.T) return null;
  return (G.A * g.players[pl].arm + G.R + 1 + p) % G.T;
}

// squares -> pawns standing there: Map(trackIndex -> [[player, pawn], ...])
export function trackMap(g) {
  const m = new Map();
  g.pos.forEach((ps, pl) => ps.forEach((p, i) => { const t = trackIndex(g, pl, p); if (t != null) { if (!m.has(t)) m.set(t, []); m.get(t).push([pl, i]); } }));
  return m;
}

function rivalsOn(list, pl) {
  const by = {};
  for (const [q, i] of list) if (q !== pl) (by[q] ||= []).push(i);
  return by;
}

// A move, or the plain-language reason there is none. `map` may be passed to avoid rebuilding it.
export function checkMove(g, pl, i, value, grace, map = trackMap(g)) {
  const G = geo(g.mode), p = g.pos[pl][i], no = (code, text) => ({ ok: false, code, text });
  if (p === G.END) return no('done', 'That pawn is already home in the centre.');
  if (p < 0) {
    if (!grace) return no('grace', g.mode === 'ludo' ? `You threw ${value}. A pawn leaves the yard only on a 6.` : `You threw ${value}. A pawn enters the board only on a grace throw (1, 5, 6 or no mouths up).`);
    return { ok: true, move: { pl, i, from: -1, to: 0, enter: true, caps: [], value } };
  }
  let q = p + value;
  // no throw counts 1, so a pawn one square short of the centre goes home on any throw (house rule of this version)
  if (q > G.END && g.mode === 'pachisi' && G.END - p === 1) q = G.END;
  if (q > G.END) return no('exact', `Too far: this pawn needs exactly ${G.END - p} to reach the centre, and you threw ${value}.`);
  for (let s = p + 1; s <= Math.min(q, G.T - 1); s++) {
    const t = (G.A * g.players[pl].arm + G.R + 1 + s) % G.T, here = map.get(t) || [];
    if (G.blocks && !G.safe.has(t)) {
      const by = rivalsOn(here, pl);
      if (Object.values(by).some((a) => a.length >= 2)) return no(s === q ? 'blockland' : 'block', s === q ? 'A rival block (two pawns of one colour) sits there. You cannot land on it.' : 'A rival block (two pawns of one colour) is in the way. Pawns cannot jump over a block.');
    }
  }
  const caps = [];
  if (q < G.T) {
    const t = trackIndex(g, pl, q), here = map.get(t) || [];
    if (!G.safe.has(t)) {
      if (G.cap && here.filter(([o]) => o === pl).length >= G.cap) return no('full', 'Two of your own pawns already stand there. Only two may share a square.');
      const by = rivalsOn(here, pl);
      for (const o of Object.keys(by)) for (const k of by[o]) caps.push([Number(o), k]);
    }
  }
  return { ok: true, move: { pl, i, from: p, to: q, enter: false, caps, value } };
}

// All legal moves for the player to move: one entry per distinct starting square.
export function legalMoves(g, value, grace, pl = g.turn) {
  const map = trackMap(g), out = [], seen = new Set();
  g.pos[pl].forEach((p, i) => {
    if (seen.has(p)) return;
    const r = checkMove(g, pl, i, value, grace, map);
    if (r.ok) { seen.add(p); out.push(r.move); }
  });
  return out;
}

// Why the player cannot move at all: the most useful single reason.
export function noMoveReason(g, value, grace, pl = g.turn) {
  const map = trackMap(g), rs = g.pos[pl].map((_, i) => checkMove(g, pl, i, value, grace, map)).filter((r) => !r.ok && r.code !== 'done');
  if (!rs.length) return 'Every pawn is already home.';
  const order = ['block', 'blockland', 'full', 'exact', 'grace'];
  rs.sort((a, b) => order.indexOf(a.code) - order.indexOf(b.code));
  const onBoard = g.pos[pl].some((p) => p >= 0 && p < geo(g.mode).END);
  if (rs[0].code === 'grace' && onBoard) return rs[0].text;
  return rs[0].text;
}

// Apply a legal move (mutates). Returns what happened.
export function applyMove(g, m) {
  const G = geo(g.mode);
  g.pos[m.pl][m.i] = m.to;
  for (const [o, k] of m.caps) g.pos[o][k] = -1;
  if (m.caps.length) g.captures += m.caps.length;
  const home = m.to === G.END;
  const won = g.pos[m.pl].every((p) => p === G.END);
  if (won) g.winner = m.pl;
  const bonus = !won && (isGrace(g.mode, m.value) || (G.bonusOnCapture && m.caps.length > 0) || (G.bonusOnHome && home));
  return { captured: m.caps.length, home, won, bonus };
}

export function nextTurn(g) { g.turn = (g.turn + 1) % g.players.length; }

export const progressOf = (g, pl) => g.pos[pl].reduce((s, p) => s + (p < 0 ? 0 : p + 1), 0);
export const homeCount = (g, pl) => g.pos[pl].filter((p) => p === geo(g.mode).END).length;

export const clone = (o) => JSON.parse(JSON.stringify(o));

// sanity check used by the tests: no illegal states
export function invariant(g) {
  const G = geo(g.mode), map = trackMap(g);
  for (const ps of g.pos) for (const p of ps) if (!(p >= -1 && p <= G.END)) return 'position out of range';
  if (G.blocks) for (const [t, list] of map) {
    if (G.safe.has(t)) continue;
    const c = {};
    for (const [pl] of list) c[pl] = (c[pl] || 0) + 1;
    const ks = Object.keys(c);
    if (ks.length > 1) return 'two colours share an unmarked square';
    if (c[ks[0]] > G.cap) return 'too many pawns on an unmarked square';
  }
  return null;
}
