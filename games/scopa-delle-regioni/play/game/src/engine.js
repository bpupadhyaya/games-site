// The computer players. Four levels; the two strongest count cards (everything captured or on the table is public).
// Search is a generator advanced a few "nodes" per frame, so a frame never stalls (game.js sets the budget).
import { captures, legalPlays, applyPlay, clone, rankOf, suitOf, teamOf, SETTEBELLO, cardName, RANK_NAMES, SUIT_EN } from './rules.js';

export const LEVELS = [
  { name: 'Novizio', blurb: 'Learning the rules. Often lays down a card when it could capture.' },
  { name: 'Amico', blurb: 'Takes the biggest capture it sees, but never looks at what it leaves you.' },
  { name: 'Esperto', blurb: 'Counts the cards left and avoids leaving you an easy sweep.' },
  { name: 'Maestro', blurb: 'Counts cards, imagines your hidden hand many times over, and plans a full round ahead.' },
];

// How much a card is worth to hold in a pile (cards, coins, the sette bello, primiera all in one number).
export function worth(c) {
  const r = rankOf(c); let w = 1;
  if (suitOf(c) === 0) w += 1.4;
  if (c === SETTEBELLO) w += 7;
  else if (r === 7) w += 1.6; else if (r === 6) w += 0.9; else if (r === 1) w += 0.6; else if (r === 5) w += 0.3;
  return w;
}
const SCOPA_W = 6;
const tableClear = (g, take) => take.length > 0 && g.table.length === take.length;
export function playValue(g, p) {
  if (!p.take.length) return 0;
  let v = worth(p.card); for (const t of p.take) v += worth(t);
  const last = g.deck.length === 0 && g.hands.reduce((a, h) => a + h.length, 0) === 1;
  if (tableClear(g, p.take) && !last) v += SCOPA_W;
  return v;
}
// What the cards the player cannot see look like: everything not in my hand, on the table or already captured.
export function unseen(g, seat) {
  const known = new Set([...g.hands[seat], ...g.table, ...g.piles[0], ...g.piles[1]]), out = [];
  for (let c = 0; c < 40; c++) if (!known.has(c)) out.push(c);
  return out;
}
// Expected value of the best capture a hidden hand of `k` cards could take from `table` (independent-card estimate).
function dangerOf(table, pool, k, g) {
  if (!pool.length || k <= 0) return 0;
  const byRank = new Map();
  for (const c of pool) byRank.set(rankOf(c), (byRank.get(rankOf(c)) || 0) + 1);
  const opts = [];
  for (const [r, n] of byRank) {
    const caps = captures(table, r === 0 ? 0 : (0 * 10 + r - 1)); // suit-independent: a coin of that rank
    let best = 0;
    for (const t of caps) { let v = 1.2 + t.reduce((a, x) => a + worth(x), 0); if (t.length === table.length) v += SCOPA_W; if (v > best) best = v; }
    if (best > 0) opts.push({ v: best, p: 1 - Math.pow(1 - n / pool.length, k) });
  }
  opts.sort((a, b) => b.v - a.v);
  let e = 0, none = 1; for (const o of opts) { e += o.v * o.p * none; none *= 1 - o.p; }
  return e;
}
const afterTable = (g, p) => (p.take.length ? g.table.filter((t) => !p.take.includes(t)) : g.table.concat([p.card]));

function pickRandom(g, rng) { const pl = legalPlays(g); return pl[rng.int(pl.length)]; }
function greedy(g, rng, noise = 0) {
  let best = null, bv = -1e9;
  for (const p of legalPlays(g)) { const v = playValue(g, p) - (p.take.length ? 0 : worth(p.card) * 0.15) + rng.next() * noise; if (v > bv) { bv = v; best = p; } }
  return best;
}
// Esperto-style scoring of one play, with the parts kept so a hint can say why.
export function explain(g, p, seat) {
  const pool = unseen(g, seat), tbl = afterTable(g, p), others = g.n - 1;
  const hidden = g.hands.reduce((a, h, s) => a + (s === seat ? 0 : h.length), 0);
  const opp = g.n === 4 ? g.hands[(seat + 1) % 4].length : g.hands[(seat + 1) % g.n].length;
  void others; void hidden;
  const gain = playValue(g, p), danger = dangerOf(tbl, pool, Math.min(3, opp), g);
  let shed = 0;
  if (!p.take.length) { shed = -worth(p.card) * 0.5; if (tbl.reduce((a, t) => a + rankOf(t), 0) <= 10 && tbl.length) shed -= 3.5; }
  const keep = g.hands[seat].filter((c) => c !== p.card).reduce((a, c) => a + (rankOf(c) === 7 || suitOf(c) === 0 ? 0.35 : 0), 0);
  return { gain, danger, shed, total: gain - danger * 0.9 + shed + (p.take.length ? 0 : keep * 0.3) };
}
function esperto(g, rng, seat) {
  let best = null, bv = -1e9;
  for (const p of legalPlays(g, seat)) { const v = explain(g, p, seat).total + rng.next() * 0.25; if (v > bv) { bv = v; best = p; } }
  return best;
}
// The hint: the Esperto choice plus one plain sentence about it.
export function hintFor(g, seat, rng) {
  const p = esperto(g, rng, seat), e = explain(g, p, seat);
  let why;
  if (p.take.length) {
    const all = [p.card, ...p.take];
    if (tableClear(g, p.take)) why = 'this clears the table: a scopa, one extra point.';
    else if (all.includes(SETTEBELLO)) why = 'it wins the 7 of coins, the sette bello: a point on its own.';
    else { const coins = all.filter((c) => suitOf(c) === 0).length, sevens = all.filter((c) => rankOf(c) === 7).length; why = coins ? `it wins ${coins} coin${coins > 1 ? 's' : ''}, and most coins is a point.` : sevens ? 'sevens are the best cards for primiera.' : `it takes ${all.length} cards, and most cards is a point.`; }
  } else why = e.danger < 2 ? 'nothing can be captured, and this card leaves your opponent very little.' : 'nothing can be captured, so lay down the card that gives the least away.';
  return { play: p, why };
}

// A world where the unseen cards are dealt out at random to the other seats (and the deck).
function sampleWorld(g, seat, rng) {
  const w = clone(g), pool = rng.shuffle(unseen(g, seat));
  for (let s = 0; s < g.n; s++) if (s !== seat) { const k = g.hands[s].length; w.hands[s] = pool.splice(0, k); }
  w.deck = pool; return w;
}
const value = (g, res, seat, sign) => { let v = 0; for (const c of res.gained) v += worth(c); if (res.scopa) v += SCOPA_W; return sign * v; };
// Maestro: imagine K worlds; in each, play the candidate, then let everyone else answer greedily until it is my turn again.
function* maestro(g, rng, seat, counter) {
  const plays = legalPlays(g, seat);
  if (plays.length === 1) { yield; return plays[0]; }
  const K = plays.length > 3 ? 18 : 26, tot = new Array(plays.length).fill(0);
  const cnt = g.hands.reduce((a, h) => a + h.length, 0) + g.deck.length;
  for (let k = 0; k < K; k++) {
    const w0 = sampleWorld(g, seat, rng);
    for (let i = 0; i < plays.length; i++) {
      const w = clone(w0), p = plays[i], me = teamOf(w, seat);
      const r = applyPlay(w, seat, p.card, p.take); let v = value(w, r, seat, 1);
      if (!p.take.length) v -= worth(p.card) * 0.1;
      let guard = 0;
      while (!r.roundEnd && !r.dealt && w.turn !== seat && guard++ < 4 && w.hands[w.turn].length) {
        const q = greedy(w, rng, 0.2), s = w.turn, rr = applyPlay(w, s, q.card, q.take);
        v += value(w, rr, s, teamOf(w, s) === me ? 1 : -1); if (rr.roundEnd || rr.dealt) break;
      }
      // in the final hand the world is fully known: also answer with my own best next capture
      if (w.hands[seat].length && w.turn === seat && !r.dealt) { const q = greedy(w, rng, 0); if (q) v += playValue(w, q) * 0.5; }
      tot[i] += v; counter.n += 1;
      if (counter.n % 40 === 0) yield;
    }
  }
  void cnt;
  let bi = 0; for (let i = 1; i < plays.length; i++) if (tot[i] > tot[bi]) bi = i;
  return plays[bi];
}

// createThinker(game, level, rng, seat) -> { step(budget) -> {play} | {}, nodes() }
export function createThinker(g, level, rng, seat = g.turn) {
  const counter = { n: 0 }; let gen = null, done = null;
  const snap = clone(g);
  if (level === 3) gen = maestro(snap, rng, seat, counter);
  else { done = level === 0 ? (rng.chance(0.4) ? pickRandom(snap, rng) : greedy(snap, rng, 6)) : level === 1 ? greedy(snap, rng, 1.2) : esperto(snap, rng, seat); }
  return {
    nodes: () => counter.n,
    step(budget = 300) {
      if (done) return { play: done };
      const target = counter.n + budget;
      for (;;) { const r = gen.next(); if (r.done) { done = r.value; return { play: done }; } if (counter.n >= target) return {}; }
    },
  };
}
void cardName; void RANK_NAMES; void SUIT_EN;
