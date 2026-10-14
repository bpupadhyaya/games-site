// Patolli rules engine: pure data and functions, no drawing, no randomness (throws are made by game.js with env.rng).
//
// The board is a 9 x 9 grid with a plus-shaped cross carved in it: a 3 x 3 centre and four arms, each 3 wide and 3 long.
// The outer track is a loop of 32 squares that runs clockwise round the outline of the cross (eight per arm). Each seat owns one
// arm. A piece's PROGRESS is a number: 0 = waiting in the pit, 1..32 = on the loop (1 is the seat's own arm mouth), 33..35 = the three
// squares of the seat's own spine going in towards the centre, 36 = home. A throw of v moves one piece from p to p + v.
export const GRID = 9;
export const QUARTER = 8;
export const LOOP = 32;
export const HOME = 36;
export const SPINE_FROM = 33;

// Beans: five beans, each with one marked face. Marked faces up -> steps. Reconstructed table (the sources give no scale).
export const BEANS = 5;
export const STEPS = [5, 1, 2, 3, 4, 10];
export const BONUS_MARKS = 5;                         // five marked faces: ten steps and the beans are thrown again
export const MAX_CHAIN = 3;                           // at most three extra throws in a row
export const ODDS = [1, 5, 10, 10, 5, 1].map((n) => n / 32);   // chance of 0..5 marked faces up
export const STEP_ODDS = new Map();                   // steps -> chance
STEPS.forEach((s, k) => STEP_ODDS.set(s, (STEP_ODDS.get(s) ?? 0) + ODDS[k]));
export const TRAP_BACK = 4;
export const PIECE_CHOICES = [3, 4, 6];
export const DEFAULT_PIECES = 4;
export const RULE_KEYS = ['traps', 'boosts'];
export const RULE_INFO = {
  traps: { name: 'Trap squares', short: 'Landing on a trap throws the piece back four squares.' },
  boosts: { name: 'Corner stones', short: 'Landing on a centre corner earns another throw.' },
};
export const fullRules = () => ({ traps: true, boosts: true });

const rot = (x, y) => [GRID - 1 - y, x];
const rotN = (xy, n) => { let p = xy; for (let i = 0; i < n; i++) p = rot(p[0], p[1]); return p; };
const ARM0 = [[4, 0], [5, 0], [5, 1], [5, 2], [5, 3], [6, 3], [7, 3], [8, 3]];
const SPINE0 = [[4, 1], [4, 2], [4, 3]];
export const LOOP_XY = [];
for (let k = 0; k < 4; k++) for (const xy of ARM0) LOOP_XY.push(rotN(xy, k));
export const SPINE_XY = [0, 1, 2, 3].map((k) => SPINE0.map((xy) => rotN(xy, k)));
export const SEAT_ARMS = { 2: [0, 2], 3: [0, 1, 2], 4: [0, 1, 2, 3] };
export const armsFor = (n) => SEAT_ARMS[Math.max(2, Math.min(4, n))];

export const isEntry = (idx) => idx % QUARTER === 0;
export const isTrap = (idx) => idx % QUARTER === 6;
export const isBoost = (idx) => idx % QUARTER === 4;
export const entryIdx = (arm) => arm * QUARTER;
export const loopIdx = (arm, p) => (arm * QUARTER + p - 1) % LOOP;

// Where a piece with progress p is: zone 'pit' | 'loop' | 'spine' | 'home'.
export function where(arm, p) {
  if (p <= 0) return { zone: 'pit' };
  if (p <= LOOP) return { zone: 'loop', idx: loopIdx(arm, p) };
  if (p < HOME) return { zone: 'spine', k: p - SPINE_FROM };
  return { zone: 'home' };
}

export const marksToSteps = (marks) => STEPS[Math.max(0, Math.min(BEANS, marks))];

// players: [{ seat, arm, pieces: [progress...] }]. Returns Map loopIdx -> [{ seat, j }]
export function occupancy(players) {
  const occ = new Map();
  for (const pl of players) {
    pl.pieces.forEach((p, j) => {
      if (p >= 1 && p <= LOOP) {
        const i = loopIdx(pl.arm, p);
        if (!occ.has(i)) occ.set(i, []);
        occ.get(i).push({ seat: pl.seat, j });
      }
    });
  }
  return occ;
}

const hasPair = (list) => {
  const n = new Map();
  for (const o of list) n.set(o.seat, (n.get(o.seat) ?? 0) + 1);
  for (const c of n.values()) if (c >= 2) return true;
  return false;
};

// Everything that can happen if `seat` throws `v`. One move per distinct progress value (pieces on the same square are alike).
export function legalMoves(players, seat, v, rules = fullRules()) {
  const me = players.find((q) => q.seat === seat), occ = occupancy(players), out = [], seen = new Set();
  const foesAt = (idx) => (occ.get(idx) ?? []).filter((o) => o.seat !== seat);
  const blocked = (idx) => !isEntry(idx) && hasPair(foesAt(idx));
  me.pieces.forEach((p, j) => {
    if (p >= HOME || seen.has(p)) return;
    seen.add(p);
    const np = p + v;
    const m = { seat, j, from: p, to: Math.min(np, HOME), cap: null, capAt: null, trap: false, slideTo: null, boost: false, finish: false, pair: false, v };
    if (np >= HOME) { m.finish = true; out.push(m); return; }
    if (np <= LOOP) {
      const idx = loopIdx(me.arm, np);
      if (blocked(idx)) return;
      const foes = foesAt(idx);
      if (!isEntry(idx) && foes.length >= 1) {
        const f = foes[0];
        m.cap = { seat: f.seat, j: f.j, p: players.find((q) => q.seat === f.seat).pieces[f.j] }; m.capAt = 'land';
      }
      m.pair = (occ.get(idx) ?? []).some((o) => o.seat === seat && !(o.j === j));
      if (rules.boosts && isBoost(idx)) m.boost = true;
      if (rules.traps && isTrap(idx)) {
        m.trap = true;
        for (let t = Math.max(1, np - TRAP_BACK); t < np; t++) {
          const ti = loopIdx(me.arm, t);
          if (blocked(ti)) continue;
          m.slideTo = t;
          if (!m.cap && !isEntry(ti)) {
            const f = foesAt(ti)[0];
            if (f) { m.cap = { seat: f.seat, j: f.j, p: players.find((q) => q.seat === f.seat).pieces[f.j] }; m.capAt = 'slide'; }
          }
          break;
        }
        if (m.slideTo === null) m.trap = false;
      }
    }
    out.push(m);
  });
  return out;
}

export const finalP = (m) => (m.slideTo !== null ? m.slideTo : m.to);

// Apply a move to the players (mutates). Returns the captured victim or null.
export function applyMove(players, m) {
  const me = players.find((q) => q.seat === m.seat);
  me.pieces[m.j] = finalP(m);
  if (m.cap) { players.find((q) => q.seat === m.cap.seat).pieces[m.cap.j] = 0; return m.cap; }
  return null;
}

export const homeCount = (pl) => pl.pieces.filter((p) => p >= HOME).length;
export const allHome = (pl) => pl.pieces.every((p) => p >= HOME);
export const pitCount = (pl) => pl.pieces.filter((p) => p <= 0).length;

// ---- computer judgement ------------------------------------------------------------------------------------------------------------------
// Chance that, on the opponents' next throw, some opponent piece can land on loop square idx.
export function danger(players, seat, idx) {
  if (isEntry(idx)) return 0;
  const reach = new Set();
  for (const o of players) {
    if (o.seat === seat) continue;
    for (const p of o.pieces) {
      if (p >= HOME || p > LOOP) continue;
      const from = p <= 0 ? (entryIdx(o.arm) - 1 + LOOP) % LOOP : loopIdx(o.arm, p);
      const d = (idx - from + LOOP) % LOOP;
      if (d >= 1 && p + d <= LOOP && STEP_ODDS.has(d)) reach.add(d);
    }
  }
  let pr = 0;
  for (const d of reach) pr += STEP_ODDS.get(d);
  return Math.min(0.95, pr);
}

export function evalMove(players, m, rules = fullRules()) {
  const me = players.find((q) => q.seat === m.seat), fp = finalP(m);
  let s = m.to - m.from;
  if (m.finish) s += 7;
  if (m.cap) s += m.cap.p * 1.15 + 5;
  if (m.boost) s += 3.4;
  if (m.trap) s -= (m.to - fp) * 1.0 + 0.4;
  const here = (pp) => (pp >= 1 && pp <= LOOP ? loopIdx(me.arm, pp) : -1);
  const mates = (idx, j) => (idx < 0 ? 0 : me.pieces.filter((pp, k) => k !== j && pp >= 1 && pp <= LOOP && loopIdx(me.arm, pp) === idx).length);
  const iFrom = here(m.from), iTo = here(fp);
  if (iFrom >= 0) {
    const mm = mates(iFrom, m.j);
    if (mm === 0) s += danger(players, m.seat, iFrom) * (m.from + 5);
    else if (mm === 1) s -= danger(players, m.seat, iFrom) * (m.from + 5);       // leaves its partner alone on the square
  }
  if (iTo >= 0 && !m.finish) {
    const mm = mates(iTo, m.j);
    if (mm >= 1) s += 2.2;
    else s -= danger(players, m.seat, iTo) * (fp + 5);
  }
  return s;
}

// Score every move; best = index of the highest. `noise(i)` may add a small jitter for computer seats.
export function rankMoves(players, moves, rules, noise) {
  const scores = moves.map((m, i) => evalMove(players, m, rules) + (noise ? noise(i) : 0));
  let best = 0;
  scores.forEach((s, i) => { if (s > scores[best]) best = i; });
  return { scores, best };
}

// A pure-chance estimate used by hints: turns still needed by all unfinished pieces of a seat.
export function turnsToGo(pl) {
  let steps = 0;
  for (const p of pl.pieces) steps += Math.max(0, HOME - Math.max(p, 0));
  return steps / 2.8;
}
