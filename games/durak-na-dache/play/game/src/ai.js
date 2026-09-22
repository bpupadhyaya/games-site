// Computer players. Levels: 1 Guest (mistakes), 2 Neighbour (sound heuristics), 3 Card Counter and 4 Old Hand
// (sample the hidden hands from what was seen, then play many quick games to the end with each candidate move).
// The search is TIME-SLICED: thinker.step() does a small fixed number of rollouts per frame and resumes next frame.
import { legalMoves, apply, clone, suitOf, rankOf, beats, cardName, RANK_LABELS, SUIT_NAMES, attackersOf } from './rules.js';

export const LEVELS = [
  { id: 1, name: 'Guest', blurb: 'Plays quickly and sometimes wastes a trump or picks up for no reason.' },
  { id: 2, name: 'Neighbour', blurb: 'Solid habits: beats cheaply, saves trumps, throws in low cards.' },
  { id: 3, name: 'Card Counter', blurb: 'Remembers every card played and tests moves against likely hidden hands.' },
  { id: 4, name: 'Old Hand', blurb: 'Counts, infers from pick-ups and refusals, and looks much deeper.' },
];
export const ROLLOUTS_PER_FRAME = { 3: 4, 4: 4 };
const WORLDS = { 3: 7, 4: 26 };

const val = (c, trump) => rankOf(c) + (suitOf(c) === trump ? 10 : 0);

// ---- the shared house-style policy (also used for rollouts) ------------------------------------------------------
export function heuristicMove(g, rng, noise = 0) {
  const moves = legalMoves(g);
  if (moves.length === 1) return moves[0];
  const p = g.actor, hand = g.hands[p], trump = g.trump;
  if (noise && rng && rng.chance(noise)) {
    const nt = moves.filter((m) => m.t !== 'take');
    return rng.pick(rng.chance(0.5) || !nt.length ? moves : nt);
  }
  if (g.phase === 'lead') {
    let best = null, bs = 1e9;
    for (const m of moves) {
      const same = hand.filter((c) => rankOf(c) === rankOf(m.c)).length;
      const s = val(m.c, trump) - (same > 1 ? 2.5 : 0);
      if (s < bs) { bs = s; best = m; }
    }
    return best;
  }
  if (g.phase === 'throw') {
    const defLeft = g.hands[g.defender].length;
    let best = null, bs = 1e9;
    for (const m of moves) if (m.t === 'atk') { const s = val(m.c, trump); if (s < bs) { bs = s; best = m; } }
    if (!best) return moves[moves.length - 1];
    const isTr = suitOf(best.c) === trump;
    if (g.taking) return !isTr || g.stock.length === 0 ? best : moves.find((m) => m.t === 'pass');
    const endgame = g.stock.length === 0;
    if (!isTr && (rankOf(best.c) <= 3 || defLeft <= 3 || endgame)) return best;
    if (isTr && endgame && hand.length <= 2) return best;
    return moves.find((m) => m.t === 'pass');
  }
  // defend
  const xf = moves.filter((m) => m.t === 'xfer');
  if (xf.length) {
    let b = null, bs = 1e9; for (const m of xf) { const s = val(m.c, trump); if (s < bs) { bs = s; b = m; } }
    if (suitOf(b.c) !== trump) return b;
  }
  const defs = moves.filter((m) => m.t === 'def');
  if (!defs.length) return moves.find((m) => m.t === 'take');
  const firstI = defs[0].i;
  let best = null, bs = 1e9;
  for (const m of defs) if (m.i === firstI) { const s = val(m.c, trump); if (s < bs) { bs = s; best = m; } }
  const isTr = suitOf(best.c) === trump;
  const beatCost = isTr ? 6 + rankOf(best.c) * 1.2 : rankOf(best.c) * 0.5;
  const takeCost = g.table.length * 1.6 + (g.stock.length === 0 ? 30 : 0) + (hand.length <= 3 ? 8 : 0);
  const worth = !isTr || beatCost <= takeCost + (g.stock.length > 10 ? 0 : 3) + (g.first ? -1 : 0);
  return worth || g.table.some((t) => suitOf(t.a) === trump) && !isTr ? best : moves.find((m) => m.t === 'take');
}

// ---- hidden-information sampling ------------------------------------------------------------------------------
export function sampleWorld(g, seat, rng, level) {
  const w = clone(g);
  const seen = new Set(g.hands[seat]);
  for (const c of g.discard) seen.add(c);
  for (const t of g.table) { seen.add(t.a); if (t.d >= 0) seen.add(t.d); }
  const stockLen = g.stock.length;
  const trumpInStock = stockLen > 0;
  if (trumpInStock) seen.add(g.trumpCard);
  const known = new Set();
  for (let q = 0; q < g.n; q++) if (q !== seat) for (const c of g.known[q]) known.add(c);
  const pool = [];
  for (let c = 0; c < 36; c++) if (!seen.has(c) && !known.has(c)) pool.push(c);
  for (let attempt = 0; attempt < (level >= 4 ? 6 : 1); attempt++) {
    const sh = rng.shuffle(pool);
    let k = 0, ok = true;
    for (let q = 0; q < g.n; q++) {
      if (q === seat) continue;
      const need = g.hands[q].length - g.known[q].length;
      w.hands[q] = g.known[q].concat(sh.slice(k, k + need)); k += need;
    }
    if (level >= 4) {
      // Soft inference: a player who picked up instead of beating probably could not (or would not) beat that card cheaply.
      for (const r of g.refused) {
        if (r.p === seat || r.a < 0 || suitOf(r.a) === g.trump) continue;
        if (w.hands[r.p].some((c) => beats(r.a, c, g.trump) && suitOf(c) !== g.trump) && rng.chance(0.75)) ok = false;
      }
    }
    const rest = sh.slice(k);
    w.stock = trumpInStock ? [g.trumpCard, ...rest.slice(0, stockLen - 1)] : [];
    if (ok || attempt === 5) break;
  }
  return w;
}

export function rollout(g0, move, seat, rng, noise = 0.04) {
  const g = clone(g0);
  apply(g, move);
  let steps = 0;
  while (!g.over && steps++ < 500) apply(g, heuristicMove(g, rng, noise));
  return g.over ? (g.loser === seat ? 0 : g.loser === -1 ? 0.5 : 1) : 0.5;
}

// ---- the time-sliced thinker ----------------------------------------------------------------------------------------
export function createThinker(g, seat, level, rng) {
  const moves = legalMoves(g);
  const r = rng.fork ? rng.fork() : rng;
  const T = { moves, done: false, choice: null, seat, level, worlds: 0, total: WORLDS[level] || 0, scores: moves.map(() => 0), tries: moves.map(() => 0), world: null, mi: 0, steps: 0 };
  const quick = () => {
    if (moves.length === 1) return moves[0];
    if (level <= 1) return heuristicMove(g, r, 0.55);
    return heuristicMove(g, r, 0);
  };
  if (moves.length === 1 || level <= 2) { T.choice = quick(); T.done = true; }
  else T.pref = heuristicMove(g, r, 0);
  T.progress = () => (T.done ? 1 : Math.min(1, (T.worlds * moves.length + T.mi) / (T.total * moves.length)));
  T.step = (n = ROLLOUTS_PER_FRAME[level] || 3) => {
    if (T.done) return T.choice;
    for (let i = 0; i < n && !T.done; i++) {
      if (T.mi === 0) T.world = sampleWorld(g, seat, r, level);
      T.scores[T.mi] += rollout(T.world, moves[T.mi], seat, r); T.tries[T.mi]++;
      T.steps++;
      T.mi++;
      if (T.mi >= moves.length) { T.mi = 0; T.worlds++; if (T.worlds >= T.total) T.done = true; }
    }
    if (T.done) {
      let bi = 0, bv = -1;
      moves.forEach((m, i) => {
        const v = T.scores[i] / Math.max(1, T.tries[i]) + (m === T.pref || sameMove(m, T.pref) ? 0.004 : 0);
        if (v > bv) { bv = v; bi = i; }
      });
      T.choice = moves[bi]; T.values = moves.map((_, i) => T.scores[i] / Math.max(1, T.tries[i]));
    }
    return T.done ? T.choice : null;
  };
  return T;
}
export const sameMove = (a, b) => !!a && !!b && a.t === b.t && a.c === b.c && a.i === b.i;

// ---- perfect-information solver (2 players, stock empty): used by the daily puzzle and the strongest endgame ----------
export function solve(g0, maxNodes = 200000) {
  const memo = new Map(); let nodes = 0;
  const key = (g) => `${g.hands[0].slice().sort().join(',')}|${g.hands[1].slice().sort().join(',')}|${g.table.map((t) => t.a + ':' + t.d).join(',')}|${g.phase}${g.actor}${g.attacker}${g.taking ? 1 : 0}${g.passes}${g.cap}`;
  const val0 = (g) => (g.loser === 0 ? -1 : g.loser === 1 ? 1 : 0);
  const rec = (g, alpha, beta) => {
    if (g.over) return val0(g);
    if (++nodes > maxNodes) throw new Error('budget');
    const k = key(g); if (memo.has(k)) return memo.get(k);
    const ms = legalMoves(g);
    let best = g.actor === 0 ? -2 : 2;
    for (const m of ms) {
      const h = clone(g); apply(h, m);
      const v = rec(h);
      if (g.actor === 0) { if (v > best) best = v; } else if (v < best) best = v;
      if (best === (g.actor === 0 ? 1 : -1)) break;
    }
    memo.set(k, best); return best;
  };
  const moves = legalMoves(g0);
  return moves.map((m) => { const h = clone(g0); apply(h, m); return { move: m, value: rec(h) }; });
}

// ---- hint reasons -----------------------------------------------------------------------------------------------------
export function explain(g, m) {
  const trump = g.trump, tn = SUIT_NAMES[trump];
  if (m.t === 'take') return g.table.some((t) => t.d < 0 && suitOf(t.a) === trump) ? 'Only a higher trump would beat it, and it would cost too much. Picking up is fine.' : 'Beating it would cost a trump; taking keeps your strong cards for later.';
  if (m.t === 'pass') return 'Nothing worth throwing in. Say Bito and let the round end.';
  if (m.t === 'xfer') return 'Same rank: pass the attack on to the next player and keep your other cards.';
  if (m.t === 'def') {
    const t = g.table[m.i];
    return suitOf(m.c) === trump && suitOf(t.a) !== trump ? `A trump beats any plain card. This is your cheapest one that works.` : `The cheapest card that beats it: a higher ${SUIT_NAMES[suitOf(t.a)].slice(0, -1)}. Keep your bigger cards.`;
  }
  if (g.phase === 'lead') {
    const same = g.hands[g.actor].filter((c) => rankOf(c) === rankOf(m.c)).length;
    return same > 1 ? `Lead a rank you hold twice (${RANK_LABELS[rankOf(m.c)]}): you can throw in the second one.` : 'Lead your lowest plain card. Save the trumps and the aces.';
  }
  return g.taking ? 'They are picking up anyway: every extra card is one more to carry.' : `The ${RANK_LABELS[rankOf(m.c)]} is already on the table, so they must beat it too, and it is cheap for you.`;
}

export { cardName, attackersOf };
