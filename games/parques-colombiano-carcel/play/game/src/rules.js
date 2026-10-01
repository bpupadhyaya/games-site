// THE RULE BOOK for Parqués (Colombian rules, as implemented in this game). Pure and deterministic; nothing here draws
// or reads the clock. Everything else (AI, UI, the in-app Rules pages) asks this file.
//
// Board: a cross of four arms (0 bottom, 1 right, 2 top, 3 left). The outer track has 68 squares (17 per arm: 8 up the
// left lane, the tip, 8 back down the right lane), travelled ANTICLOCKWISE. Each seat owns one arm:
//   position p = 0 is the seat's SALIDA (start square: the first square after its arm's tip), p = 0..67 is the outer
//   track (p = 67 is the tip of its own arm), p = 68..74 is the seven-square home lane up the middle of its own arm, and
//   p = END (75) is the CORONA in the centre. Exactly: a piece needs an exact die to reach the corona.
// pos: -1 = in the CÁRCEL (jail), 0..74 = on the way, END = home.
//
// A roll is two dice. Each die is its own move ("an action"): choose a die, choose a piece. A die nobody can use is lost.
// A PAIR (both dice equal) lets a die free a piece from the cárcel (any number of pieces, one per die), and earns another
// roll. Three pairs in a row: that roll is void and your most advanced piece on the outer track goes back to the cárcel.

export const T = 68, A = 17, R = 8, END = 75, LANE_FIRST = 68;
export const SAFE_J = [9, 3]; // per arm: its salida (j = 9) and one seguro (j = 3)
export const SEAT_NAMES = ['Yellow', 'Blue', 'Red', 'Green'];
export const SEAT_ES = ['Amarillo', 'Azul', 'Rojo', 'Verde'];
export const PIECES = 4;
export const TRIES = 3; // rolls per turn to find a pair while no piece is on the board

export const SAFE = new Set();
for (let a = 0; a < 4; a++) for (const j of SAFE_J) SAFE.add(A * a + j);
export const isSalida = (t) => t % A === 9;
export const isSafe = (t) => SAFE.has(t);

export const seatsFor = (n) => (n === 2 ? [0, 2] : n === 3 ? [0, 1, 2] : [0, 1, 2, 3]);

export function newGame({ players = 2, humans = [true], levels = [], names = [] } = {}) {
  const arms = seatsFor(players);
  return {
    players: arms.map((arm, i) => ({ arm, human: !!humans[i], level: levels[i] ?? 'balanced', name: names[i] ?? (humans[i] ? 'You' : SEAT_NAMES[arm]) })),
    pos: arms.map(() => Array.from({ length: PIECES }, () => -1)),
    turn: 0, winner: -1, rolls: 0, captures: 0, turns: 0,
  };
}

export const clone = (g) => ({ ...g, players: g.players, pos: g.pos.map((a) => a.slice()) });
export const deepClone = (o) => JSON.parse(JSON.stringify(o));

// which outer square (0..67) is a piece of player `pl` on at position p? (null in jail, home lane or corona)
export function trackIndex(g, pl, p) {
  if (p < 0 || p >= T) return null;
  return (A * g.players[pl].arm + R + 1 + p) % T;
}
export const salidaOf = (g, pl) => trackIndex(g, pl, 0);

// squares -> pieces standing there: Map(trackIndex -> [[player, piece], ...])
export function trackMap(g) {
  const m = new Map();
  g.pos.forEach((ps, pl) => ps.forEach((p, i) => { const t = trackIndex(g, pl, p); if (t != null) { if (!m.has(t)) m.set(t, []); m.get(t).push([pl, i]); } }));
  return m;
}
function rivalsBy(list, pl) { const by = {}; for (const [q, i] of list) if (q !== pl) (by[q] ||= []).push(i); return by; }

export const onBoard = (g, pl) => g.pos[pl].some((p) => p >= 0 && p < END);
export const homeCount = (g, pl) => g.pos[pl].filter((p) => p === END).length;
export const jailCount = (g, pl) => g.pos[pl].filter((p) => p < 0).length;
export const progressOf = (g, pl) => g.pos[pl].reduce((s, p) => s + (p < 0 ? 0 : p + 1), 0);

// One die applied to one piece: {ok:true, move} or {ok:false, code, text} (the plain-language reason).
export function checkMove(g, pl, i, value, pair, map = trackMap(g)) {
  const p = g.pos[pl][i], no = (code, text) => ({ ok: false, code, text });
  if (p === END) return no('done', 'That piece is already home on the corona.');
  if (p < 0) {
    if (!pair) return no('pair', `A piece leaves the cárcel only with a pair (two equal dice). You rolled ${value}.`);
    const t = salidaOf(g, pl), caps = [];
    for (const [o, k] of (map.get(t) || [])) if (o !== pl) caps.push([o, k]);
    return { ok: true, move: { pl, i, from: -1, to: 0, enter: true, caps, value } };
  }
  const q = p + value;
  if (q > END) return no('exact', `Too far: this piece needs exactly ${END - p} or less to reach the corona, and this die is ${value}.`);
  for (let s = p + 1; s <= Math.min(q, T - 1); s++) {
    const t = trackIndex(g, pl, s);
    if (isSafe(t)) continue;
    const by = rivalsBy(map.get(t) || [], pl);
    if (Object.values(by).some((a) => a.length >= 2)) return no(s === q ? 'blockland' : 'block', s === q ? 'A rival barrier (two pieces of one colour) sits there. You cannot land on it.' : 'A rival barrier (two pieces of one colour) is in the way. Pieces cannot pass a barrier.');
  }
  const caps = [];
  if (q < T) {
    const t = trackIndex(g, pl, q), here = map.get(t) || [];
    if (!isSafe(t)) {
      if (here.filter(([o]) => o === pl).length >= 2) return no('full', 'Two of your own pieces already stand there. Only two may share a square.');
      for (const [o, k] of here) if (o !== pl) caps.push([o, k]);
    }
  }
  return { ok: true, move: { pl, i, from: p, to: q, enter: false, caps, value } };
}

// All legal actions for the dice still unused. `rem` = [v|null, v|null]. One entry per distinct (starting square, die value).
export function legalMoves(g, rem, pair, pl = g.turn) {
  const map = trackMap(g), out = [], seen = new Set();
  rem.forEach((v, di) => {
    if (v == null) return;
    g.pos[pl].forEach((p, i) => {
      const key = `${p}|${v}`;
      if (seen.has(key)) return;
      const r = checkMove(g, pl, i, v, pair, map);
      if (r.ok) { seen.add(key); out.push({ ...r.move, di }); }
    });
  });
  return out;
}

// Why nothing can move: the most useful single reason.
export function noMoveReason(g, rem, pair, pl = g.turn) {
  const map = trackMap(g), rs = [];
  rem.forEach((v) => { if (v != null) g.pos[pl].forEach((_, i) => { const r = checkMove(g, pl, i, v, pair, map); if (!r.ok && r.code !== 'done') rs.push(r); }); });
  if (!rs.length) return 'Every piece is already home.';
  const order = ['block', 'blockland', 'full', 'exact', 'pair'];
  rs.sort((a, b) => order.indexOf(a.code) - order.indexOf(b.code));
  return rs[0].text;
}

// Apply a legal action (mutates g). Returns what happened.
export function applyMove(g, m) {
  g.pos[m.pl][m.i] = m.to;
  for (const [o, k] of m.caps) g.pos[o][k] = -1;
  g.captures += m.caps.length;
  const home = m.to === END, won = g.pos[m.pl].every((p) => p === END);
  if (won) g.winner = m.pl;
  return { captured: m.caps.length, home, won, freed: m.enter };
}

// Third pair in a row: the most advanced piece still on the outer track goes back to the cárcel.
export function pairPenalty(g, pl) {
  let bi = -1, bp = -1;
  g.pos[pl].forEach((p, i) => { if (p >= 0 && p < T && p > bp) { bp = p; bi = i; } });
  if (bi < 0) return null;
  g.pos[pl][bi] = -1;
  return { i: bi, from: bp };
}

export const nextTurn = (g) => { g.turn = (g.turn + 1) % g.players.length; g.turns++; };

// sanity check used by the tests
export function invariant(g) {
  const map = trackMap(g);
  for (const ps of g.pos) for (const p of ps) if (!(p >= -1 && p <= END)) return 'position out of range';
  for (const [t, list] of map) {
    if (isSafe(t)) continue;
    const c = {};
    for (const [pl] of list) c[pl] = (c[pl] || 0) + 1;
    const ks = Object.keys(c);
    if (ks.length > 1) return 'two colours share an unmarked square';
    if (c[ks[0]] > 2) return 'too many pieces on an unmarked square';
  }
  return null;
}
