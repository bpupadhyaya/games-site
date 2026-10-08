// Mehen rules engine: pure, deterministic, no randomness (throws come from the caller). Every number the Rules pages quote
// comes from the constants below so the text cannot drift from the engine.
//
// Lion codes (one integer per lion):
//   0        off the board, waiting at the tail (the pen)
//   1..30    outbound, on that cell (cell 30 is the head)
//   101..130 returning (full journey only): cell = code - 100
//   200      home (finished)
export const TRACK = 30;                 // cells from the tail (1) to the head (30)
export const HEAD = TRACK;
export const LIONS = 2;                  // lions per player
export const MARBLES = 3;                // marbles each player starts with
export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 6;
export const STICKS = 4;
export const SAFE_STEP = 5;              // every fifth cell is a resting stone
export const EXTRA_AT = 4;               // a throw of 4 or more earns another throw
export const HOME = 200;
export const BACK = 100;
export const MAX_TURNS = 900;            // safety net, never reached in practice
export const MODES = ['short', 'full'];

export const isSafe = (cell) => cell >= 1 && cell % SAFE_STEP === 0;
export const SAFE_CELLS = Array.from({ length: TRACK }, (_, i) => i + 1).filter(isSafe);

// Four two-sided sticks: flats up = steps; no flats up counts as five.
export const FLAT_WAYS = [1, 4, 6, 4, 1];                       // ways to show 0..4 flats out of 16
export const throwValue = (flats) => (flats === 0 ? 5 : flats);
export const VALUE_P = (() => {
  const p = [0, 0, 0, 0, 0, 0, 0];
  FLAT_WAYS.forEach((w, f) => { p[throwValue(f)] += w / 16; });
  return p;
})();
export const THROW_VALUES = [1, 2, 3, 4, 5];

export const cellOf = (c) => (c >= HOME ? 0 : c >= BACK ? c - BACK : c);
export const isHome = (c) => c >= HOME;
export const isBack = (c) => c >= BACK && c < HOME;
export const onTrack = (c) => { const k = cellOf(c); return k >= 1 && k <= TRACK; };

// Game lengths: how far the lions run and how many each player has.
export const LENGTHS = [
  { id: 'quick', mode: 'short', lions: 1 },
  { id: 'classic', mode: 'short', lions: 2 },
  { id: 'long', mode: 'full', lions: 1 },
];
export const lengthOf = (id) => LENGTHS.find((l) => l.id === id) ?? LENGTHS[1];

export function newState(n, mode = 'short', lions = LIONS) {
  const players = Math.min(MAX_PLAYERS, Math.max(MIN_PLAYERS, n));
  return {
    n: players, mode, turn: 0, tn: 0, over: null, extra: false,
    lions: Array.from({ length: players }, () => Array(lions).fill(0)),
    marbles: Array(players).fill(MARBLES),
    last: null,
  };
}
export const clone = (st) => ({ ...st, lions: st.lions.map((a) => a.slice()), marbles: st.marbles.slice() });

// progress of one lion: 0 at the pen, TRACK at the head, double that when home in the full journey
export function progress(code, mode) {
  if (code >= HOME) return mode === 'full' ? 2 * TRACK : TRACK;
  if (code >= BACK) return TRACK + (TRACK - (code - BACK));
  return code;
}
export const goal = (mode) => (mode === 'full' ? 2 * TRACK : TRACK);
export const homeCount = (st, p) => st.lions[p].filter(isHome).length;
export const penCount = (st, p) => st.lions[p].filter((c) => c === 0).length;
export const totalProgress = (st, p) => st.lions[p].reduce((s, c) => s + progress(c, st.mode), 0);

// who stands on a cell (not the head in the full journey, where lions pass through together)
export function occupant(st, cell) {
  if (cell < 1 || cell > TRACK) return null;
  for (let p = 0; p < st.n; p++) for (let i = 0; i < st.lions[p].length; i++) if (onTrack(st.lions[p][i]) && cellOf(st.lions[p][i]) === cell && !isHome(st.lions[p][i])) return { p, i };
  return null;
}

// The move of one lion for `steps`, or null. { i, from, to, cap: { p, i } | null, kind }
export function lionMove(st, p, i, steps) {
  const c = st.lions[p][i];
  if (isHome(c) || steps < 1) return null;
  let to;
  if (!isBack(c)) {
    const t = c + steps;
    if (t > HEAD) return null;
    if (t === HEAD) to = st.mode === 'full' ? BACK + HEAD : HOME;
    else to = t;
  } else {
    const t = cellOf(c) - steps;
    to = t <= 0 ? HOME : BACK + t;
  }
  const cell = isHome(to) ? 0 : cellOf(to);
  let cap = null;
  if (cell >= 1 && cell < HEAD) {
    const o = occupant(st, cell);
    if (o) {
      if (o.p === p) return null;
      if (isSafe(cell)) return null;
      cap = o;
    }
  }
  // the head in the full journey holds any number of lions; arriving there is never blocked
  const kind = isHome(to) ? 'home' : cell === HEAD ? 'head' : cap ? 'capture' : isSafe(cell) ? 'safe' : c === 0 ? 'enter' : 'step';
  return { i, from: c, to, cap, kind, steps };
}

// All moves for a throw of `steps` (identical waiting lions count once).
export function movesFor(st, p, steps) {
  const out = [];
  let penDone = false;
  for (let i = 0; i < st.lions[p].length; i++) {
    if (st.lions[p][i] === 0) { if (penDone) continue; penDone = true; }
    const m = lionMove(st, p, i, steps);
    if (m) out.push(m);
  }
  return out;
}

// Every legal action for a throw: the move plus the marble nudge (adj -1, 0, +1) it uses.
export function actionsFor(st, p, value) {
  const out = [];
  for (const adj of [0, -1, 1]) {
    if (adj !== 0 && st.marbles[p] < 1) continue;
    const steps = value + adj;
    if (steps < 1) continue;
    for (const m of movesFor(st, p, steps)) out.push({ ...m, adj, value });
  }
  return out;
}

export function applyAction(st, act) {
  const p = st.turn;
  const nx = clone(st);
  nx.tn = st.tn + 1;
  nx.marbles[p] -= Math.abs(act.adj || 0);
  nx.lions[p][act.i] = act.to;
  const last = { p, i: act.i, from: act.from, to: act.to, kind: act.kind, adj: act.adj || 0, value: act.value, steps: act.steps, cap: null, won: false, marbleFrom: -1, marbleGain: 0, extra: false };
  if (act.cap) {
    const v = act.cap;
    nx.lions[v.p][v.i] = 0;
    last.cap = { p: v.p, i: v.i, cell: cellOf(st.lions[v.p][v.i]) };
    if (nx.marbles[v.p] > 0) { nx.marbles[v.p] -= 1; nx.marbles[p] += 1; last.marbleFrom = v.p; }
  }
  if (isHome(act.to)) { nx.marbles[p] += 1; last.marbleGain = 1; }
  if (nx.lions[p].every(isHome)) { nx.over = { winner: p, why: 'home' }; last.won = true; }
  else if (nx.tn >= MAX_TURNS) {
    let best = 0, bp = -1;
    for (let q = 0; q < nx.n; q++) { const s = totalProgress(nx, q); if (s > best) { best = s; bp = q; } }
    nx.over = { winner: Math.max(bp, 0), why: 'limit' };
  }
  last.extra = !nx.over && act.value >= EXTRA_AT;
  nx.extra = last.extra;
  if (!nx.over && !last.extra) nx.turn = (p + 1) % nx.n;
  nx.last = last;
  return nx;
}

// A throw that cannot be used: the turn passes (or, after a 4 or 5, the player throws again).
export function passTurn(st, value = 0) {
  const nx = clone(st);
  nx.tn = st.tn + 1;
  const extra = value >= EXTRA_AT;
  nx.extra = extra;
  if (!extra) nx.turn = (st.turn + 1) % st.n;
  nx.last = { p: st.turn, pass: true, value, extra };
  return nx;
}

// ----------------------------------------------------------------------------------------------- evaluation (AI, Think)
const pAt = (d) => (d >= 1 && d <= 6 ? VALUE_P[d] ?? 0 : 0);
// Chance that player q can land a lion exactly on `cell` with their next throw (marble nudges counted at a discount).
export function hitChance(st, q, cell) {
  let best = 0;
  const m = st.marbles[q] > 0;
  for (const c of st.lions[q]) {
    if (isHome(c)) continue;
    let d;
    if (isBack(c)) d = cellOf(c) - cell;
    else d = cell - c;
    if (d < 1) continue;
    const pr = pAt(d) + (m ? 0.55 * (pAt(d - 1) + pAt(d + 1)) : 0);
    best = Math.max(best, Math.min(0.95, pr));
  }
  return best;
}

function sideScore(st, p, risk) {
  let s = 0;
  for (const c of st.lions[p]) {
    s += progress(c, st.mode);
    const k = cellOf(c);
    if (!isHome(c) && k >= 1 && k < HEAD) {
      if (isSafe(k)) s += 1.4;
      else if (risk) {
        let h = 0;
        for (let q = 0; q < st.n; q++) if (q !== p) h = Math.max(h, hitChance(st, q, k));
        s -= h * (progress(c, st.mode) + 3.5);
      }
    }
    if (c === 0) s -= 0.5;
  }
  return s + st.marbles[p] * 3.2;
}

export function evaluate(st, p, risk = true) {
  if (st.over) return st.over.winner === p ? 10000 - st.tn : -10000 + st.tn;
  let others = 0;
  for (let q = 0; q < st.n; q++) if (q !== p) others += sideScore(st, q, risk);
  return sideScore(st, p, risk) - others / (st.n - 1);
}

// ----------------------------------------------------------------------------------------------- opponent levels
export const LEVELS = [
  { id: 'novice', depth: 0 },
  { id: 'skilled', depth: 1 },
  { id: 'expert', depth: 2 },
  { id: 'master', depth: 4 },
];
export const levelOf = (id) => LEVELS.find((l) => l.id === id) ?? LEVELS[1];

export function seeded(seed) {
  let s = (seed >>> 0) || 1;
  const next = () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  return { next, int: (n) => Math.floor(next() * n) };
}

// Expected value of the position `st` for root player `me`, searching `depth` more moves. A generator so Pause can freeze it:
// it yields now and then and the caller resumes it a slice at a time.
function* chance(st, me, depth, budget) {
  if (st.over) return evaluate(st, me);
  if (depth <= 0) return evaluate(st, me);
  const p = st.turn;
  let total = 0;
  for (const v of THROW_VALUES) {
    const acts = actionsFor(st, p, v);
    let best;
    if (!acts.length) best = yield* chance(passTurn(st, v), me, depth - 1, budget);
    else {
      best = p === me ? -Infinity : Infinity;
      for (const a of acts) {
        const val = yield* chance(applyAction(st, a), me, depth - 1, budget);
        if (p === me ? val > best : val < best) best = val;
        if (++budget.n % 700 === 0) yield;
      }
    }
    total += VALUE_P[v] * best;
  }
  return total;
}

// One decision for the player to move, given the throw: returns { act, scored: [{ act, score }], pass }.
export function* planGen(st, value, levelId, salt = 0) {
  const p = st.turn, L = levelOf(levelId);
  const acts = actionsFor(st, p, value);
  if (!acts.length) return { act: null, scored: [] };
  const rnd = seeded(0x9e3779b1 ^ (st.tn * 2654435761) ^ (salt * 40503) ^ (value * 977));
  const scored = [];
  const budget = { n: 0 };
  for (const a of acts) {
    const child = applyAction(st, a);
    let sc;
    if (L.depth <= 1) sc = evaluate(child, p);
    else if (child.over) sc = evaluate(child, p);
    else sc = yield* chance(child, p, L.depth - 1, budget);
    scored.push({ act: a, score: sc });
    yield;
  }
  if (L.id === 'novice') {
    // a casual player: mostly random, with a taste for captures and resting stones
    const w = scored.map((s) => 1 + (s.act.kind === 'capture' ? 1.5 : 0) + (s.act.kind === 'safe' ? 0.8 : 0) + (s.act.kind === 'home' ? 2 : 0) - (s.act.adj ? 0.7 : 0));
    let tot = w.reduce((a, b) => a + b, 0), r = rnd.next() * tot, k = 0;
    for (; k < w.length - 1; k++) { r -= w[k]; if (r <= 0) break; }
    return { act: scored[k].act, scored };
  }
  // small tie-break noise so the same position is not always answered identically (never worse than 0.05)
  let best = null, bv = -Infinity;
  for (const s of scored) { const sc = s.score + rnd.next() * 0.05 - (s.act.adj ? 0.02 : 0); s.tie = sc; if (sc > bv) { bv = sc; best = s; } }
  return { act: best.act, scored };
}

export function plan(st, value, levelId, salt = 0) {
  const g = planGen(st, value, levelId, salt);
  for (;;) { const r = g.next(); if (r.done) return r.value; }
}
