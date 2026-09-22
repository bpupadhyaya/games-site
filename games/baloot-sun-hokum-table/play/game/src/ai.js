// The computer players: bidding, doubling and card play at four levels. Work is counted in ROLLOUTS (never time) so
// the game stays deterministic, and a thinker's step() does a small fixed amount of work so a frame is never blocked.
//   1 Beginner : rules of thumb, blunders now and then, thin bidding
//   2 Casual   : sound rules of thumb, does not count cards
//   3 Skilled  : the same rules with card counting (knows which high cards are still out) and better bidding
//   4 Expert   : samples the hidden hands consistent with what it has seen and plays each choice out many times
import { suitOf, rankOf, mk, teamOf, nextSeat, legalFor, trickWinnerIdx, strength, points, isTrump, handSort, cardShort, SUIT_NAMES, RANK_LABEL, bidOptions, findDecls, hasBaloot, newDeck, cardName } from './rules.js';

export const LEVELS = [
  { id: 1, name: 'Beginner', blurb: 'Learns the ropes: bids thinly and slips up now and then.', blunder: 0.3, track: false, bidBias: -1.5, worlds: 0 },
  { id: 2, name: 'Casual', blurb: 'Sound rules of thumb, but does not count cards.', blunder: 0.08, track: false, bidBias: 0, worlds: 0 },
  { id: 3, name: 'Skilled', blurb: 'Counts cards and knows which high cards are still out.', blunder: 0, track: true, bidBias: 0, worlds: 0 },
  { id: 4, name: 'Expert', blurb: 'Imagines the hidden hands and plays each option out many times.', blunder: 0, track: true, bidBias: 0, worlds: 36 },
];

const EMPTY = new Uint8Array(32);
// ---- the card-play policy (used at every level, and inside the Expert's rollouts) ---------------------------------
const pcount = (ct, c) => points(ct, c);
function isMaster(ct, c, played, hand) {
  const s = suitOf(c), st = strength(ct, c);
  for (let r = 0; r < 8; r++) { const d = mk(s, r); if (d !== c && !played[d] && !hand.includes(d) && strength(ct, d) > st) return false; }
  return true;
}
function unseenTrumps(ct, played, hand) {
  if (ct.type !== 'hokum') return 0; let n = 0;
  for (let r = 0; r < 8; r++) { const d = mk(ct.trump, r); if (!played[d] && !hand.includes(d)) n++; }
  return n;
}
const lowest = (ct, cs) => cs.reduce((a, b) => (pcount(ct, b) - pcount(ct, a) || strength(ct, b) - strength(ct, a)) < 0 ? b : a);

export function policyPick(ct, seat, hand, plays, played) {
  const legal = legalFor(hand, plays, ct, seat);
  if (!legal.length) return hand[0] ?? 0; // defensive: a corrupted/short-circuited simulation should never crash the search
  if (legal.length === 1) return legal[0];
  const team = teamOf(seat);
  if (!plays.length) {
    if (ct.type === 'hokum') {
      const tr = legal.filter((c) => suitOf(c) === ct.trump);
      const out = unseenTrumps(ct, played, hand);
      if (tr.length && out > 0) {
        const top = tr.reduce((a, b) => (strength(ct, b) > strength(ct, a) ? b : a));
        if (isMaster(ct, top, played, hand) && (ct.buyer === seat || teamOf(ct.buyer) === team || tr.length >= 3)) return top;
      }
    }
    const nt = legal.filter((c) => !isTrump(ct, c));
    const masters = nt.filter((c) => isMaster(ct, c, played, hand));
    if (masters.length) return masters.reduce((a, b) => (pcount(ct, b) > pcount(ct, a) ? b : a));
    if (nt.length) {
      // give up a low card from the suit where we hold the least; prefer suits whose top cards are all still out
      return lowest(ct, nt);
    }
    return lowest(ct, legal);
  }
  const w = trickWinnerIdx(plays, ct), win = plays[w], partnerWins = teamOf(win.seat) === team, last = plays.length === 3;
  const tp = plays.reduce((s, p) => s + pcount(ct, p.card), 0);
  const winners = legal.filter((c) => trickWinnerIdx([...plays, { seat, card: c }], ct) === plays.length);
  const cheapest = (cs) => cs.reduce((a, b) => (strength(ct, b) < strength(ct, a) ? b : a));
  if (partnerWins) {
    if (last || isMaster(ct, win.card, played, hand)) {
      // feed the partner: most points, but keep trumps if we can
      const nt = legal.filter((c) => !isTrump(ct, c));
      const pool = nt.length ? nt : legal;
      return pool.reduce((a, b) => (pcount(ct, b) > pcount(ct, a) || (pcount(ct, b) === pcount(ct, a) && strength(ct, b) < strength(ct, a)) ? b : a));
    }
    const mw = winners.filter((c) => isMaster(ct, c, played, hand));
    if (mw.length && tp >= 10) return cheapest(mw);
    return lowest(ct, legal);
  }
  if (winners.length) {
    if (last) return cheapest(winners);
    const cw = cheapest(winners);
    if (isMaster(ct, cw, played, hand) || tp >= 8) return cw;
    const mw = winners.filter((c) => isMaster(ct, c, played, hand));
    if (mw.length && tp >= 4) return cheapest(mw);
    return lowest(ct, legal);
  }
  return lowest(ct, legal);
}

// ---- hidden-information bookkeeping ------------------------------------------------------------------------
export function playedMask(H) { const m = new Uint8Array(32); for (const c of H.played) m[c] = 1; return m; }
export function findVoids(H) {
  const v = [new Uint8Array(4), new Uint8Array(4), new Uint8Array(4), new Uint8Array(4)], ct = H.contract;
  const scan = (plays) => {
    const led = suitOf(plays[0].card);
    for (let i = 1; i < plays.length; i++) {
      const p = plays[i];
      if (suitOf(p.card) !== led) {
        v[p.seat][led] = 1;
        if (ct.type === 'hokum' && led !== ct.trump) {
          const wi = trickWinnerIdx(plays.slice(0, i), ct);
          if (teamOf(plays[wi].seat) !== teamOf(p.seat) && suitOf(p.card) !== ct.trump) v[p.seat][ct.trump] = 1;
        }
      }
    }
  };
  // Daily-deal history can include placeholder "already played" entries with no recorded plays.
  for (const t of H.history) if (t.plays && t.plays.length > 1) scan(t.plays);
  if (H.trick.length > 1) scan(H.trick);
  return v;
}
// Deal the unseen cards to the other seats, consistent with what has been seen. `rng` is env.rng.
export function sampleWorld(H, seat, rng, voids, known) {
  const mask = playedMask(H), mine = H.hands[seat];
  const U = [];
  for (let c = 0; c < 32; c++) if (!mask[c] && !mine.includes(c)) U.push(c);
  const others = [0, 1, 2, 3].filter((s) => s !== seat);
  const need = {}; others.forEach((s) => (need[s] = H.hands[s].length));
  const hands = [[], [], [], []]; hands[seat] = mine.slice();
  const pre = [];
  for (const [c, s] of known) { const i = U.indexOf(c); if (i >= 0 && s !== seat) { U.splice(i, 1); hands[s].push(c); need[s] -= 1; } }
  void pre;
  for (let attempt = 0; attempt < 12; attempt++) {
    const pool = rng.shuffle(U), h = others.map((s) => hands[s].slice()), nd = others.map((s) => need[s]);
    let ok = true;
    // place the most constrained cards first: cards of suits some seat is void in
    pool.sort((a, b) => (voidCount(voids, others, suitOf(b)) - voidCount(voids, others, suitOf(a))));
    for (const c of pool) {
      const cand = [];
      others.forEach((s, i) => { if (nd[i] > 0 && !(attempt < 10 && voids[s][suitOf(c)])) for (let k = 0; k < nd[i]; k++) cand.push(i); });
      if (!cand.length) { ok = false; break; }
      const i = cand[rng.int(cand.length)]; h[i].push(c); nd[i] -= 1;
    }
    if (ok) { others.forEach((s, i) => (hands[s] = h[i])); return hands; }
  }
  return null;
}
const voidCount = (voids, others, s) => others.reduce((n, o) => n + voids[o][s], 0);

// ---- playouts ----------------------------------------------------------------------------------------------
function playoutFrom(sim, track) {
  const { ct, hands } = sim;
  for (;;) {
    while (sim.plays.length < 4) {
      const s = sim.turn;
      if (!hands[s].length) return sim; // defensive: an inconsistent sampled world should never crash or hang the search
      const c = policyPick(ct, s, hands[s], sim.plays, track ? sim.played : EMPTY);
      const h = hands[s], i = h.indexOf(c);
      if (i >= 0) { h[i] = h[h.length - 1]; h.pop(); } else h.pop();
      sim.plays.push({ seat: s, card: c }); sim.played[c] = 1; sim.turn = nextSeat(s);
    }
    const w = sim.plays[trickWinnerIdx(sim.plays, ct)].seat;
    let pts = 0; for (const p of sim.plays) pts += points(ct, p.card);
    sim.tricks += 1; if (sim.tricks === 8) pts += 10;
    sim.taken[teamOf(w)] += pts; sim.plays = []; sim.turn = w;
    if (sim.tricks === 8) return sim;
  }
}
const cloneSim = (s) => ({ ct: s.ct, hands: s.hands.map((h) => h.slice()), plays: s.plays.slice(), turn: s.turn, played: s.played.slice(), taken: s.taken.slice(), tricks: s.tricks });
export function simFrom(H, hands) {
  return { ct: H.contract, hands: hands.map((h) => h.slice()), plays: H.trick.map((p) => ({ ...p })), turn: H.turn, played: Uint8Array.from(playedMask(H)), taken: H.taken.slice(), tricks: H.tricks };
}

// ---- bidding evaluation -------------------------------------------------------------------------------------
// Rough "how many trick points can I count on" numbers. Calibrated by self-play (see design/GDD.md).
export function sunStrength(hand) {
  let sc = 0;
  for (let s = 0; s < 4; s++) {
    const cs = hand.filter((c) => suitOf(c) === s), has = (r) => cs.some((c) => rankOf(c) === r), n = cs.length;
    if (has(7)) sc += 3; if (has(3)) sc += has(7) || (has(6) && n >= 2) ? 2 : n >= 3 ? 0.9 : 0.3;
    if (has(6)) sc += has(7) || has(3) ? 1.2 : n >= 2 ? 0.5 : 0.1; if (has(5)) sc += n >= 3 ? 0.6 : 0.2;
    if (n >= 4 && (has(7) || has(3))) sc += 1;
  }
  return sc;
}
export function hokumStrength(hand, trump) {
  const tr = hand.filter((c) => suitOf(c) === trump), has = (r) => tr.some((c) => rankOf(c) === r);
  let sc = 0;
  if (has(4)) sc += 4.5; if (has(2)) sc += has(4) ? 3.5 : tr.length >= 3 ? 2.5 : 1.2;
  if (has(7)) sc += 1.8; if (has(3)) sc += 1.2; if (has(6) && has(5)) sc += 1.5; else if (has(6) || has(5)) sc += 0.4;
  sc += Math.max(0, tr.length - 2) * 1.4;
  for (let s = 0; s < 4; s++) if (s !== trump) { const cs = hand.filter((c) => suitOf(c) === s); if (cs.some((c) => rankOf(c) === 7)) sc += 1.6; if (cs.length === 0 && tr.length >= 3) sc += 1.0; }
  return sc;
}

// Heuristic bid for levels 1-3. `hand` is the 5 cards; for a Hokum on the turned-up card the buyer also gets it.
export function heuristicBid(H, seat, level) {
  const L = LEVELS[level - 1], hand = H.hands[seat], floor = H.floor;
  const opts = bidOptions(H);
  const teamAhead = H.scores[teamOf(seat)] - H.scores[1 - teamOf(seat)];
  let bestSun = sunStrength(hand) * (H.round === 1 ? 1 : 1) + (H.round === 2 ? 0 : 0);
  const sunT = 8.6 - L.bidBias - (teamAhead < -40 ? 1 : 0) + (teamAhead > 40 ? 0.6 : 0);
  let best = { t: 'pass' }, bestGap = -99;
  if (opts.some((o) => o.t === 'sun') && bestSun >= sunT) { best = { t: 'sun' }; bestGap = bestSun - sunT; }
  for (const o of opts) {
    if (o.t !== 'hokum') continue;
    const h2 = H.round === 1 ? [...hand, floor] : hand;
    const thr = (H.round === 1 ? 8.4 : 9.2) - L.bidBias - (teamAhead < -40 ? 1 : 0);
    const st = hokumStrength(h2, o.suit) + (hasBaloot(h2, { type: 'hokum', trump: o.suit }) ? 0.5 : 0);
    if (st >= thr && st - thr > bestGap && best.t !== 'sun') { best = o; bestGap = st - thr; }
  }
  return best;
}
export function bidReason(H, seat, a) {
  const hand = H.hands[seat];
  if (a.t === 'pass') return 'Nothing here is strong enough to promise more than half the points, so pass.';
  if (a.t === 'sun') return `Sun has no trump, so it needs high cards everywhere: ${hand.filter((c) => rankOf(c) === 7).length} ace(s) and the tens behind them make it playable.`;
  const h2 = H.round === 1 ? [...hand, H.floor] : hand, tr = h2.filter((c) => suitOf(c) === a.suit);
  const top = tr.filter((c) => [4, 2].includes(rankOf(c))).map(cardShort).join(' and ');
  return `${SUIT_NAMES[a.suit]} as trump: you would hold ${tr.length} trump${top ? ' including ' + top : ''}. In trump the Jack and 9 are the two highest cards.`;
}

// ---- Expert bidding: complete the deal at random and play it out ----------------------------------------------
function bidWorld(H, seat, opt, rng) {
  const mine = H.hands[seat].slice(), floor = H.floor;
  const pool = [];
  const known = new Set([...mine, floor]);
  for (let c = 0; c < 32; c++) if (!known.has(c)) pool.push(c);
  const p = rng.shuffle(pool);
  const type = opt.t, trump = type === 'hokum' ? opt.suit : -1;
  const ct = { type, trump, buyer: seat, round: H.round };
  const hands = [[], [], [], []];
  hands[seat] = [...mine, floor, p.pop(), p.pop()];
  for (let s = 0; s < 4; s++) if (s !== seat) { for (let k = 0; k < 8; k++) hands[s].push(p.pop()); }
  // (when the floor card goes to a partner's or opponent's contract the numbers differ slightly; good enough for a bid)
  const sim = { ct, hands, plays: [], turn: nextSeat(H.dealer), played: new Uint8Array(32), taken: [0, 0], tricks: 0 };
  playoutFrom(sim, true);
  const mt = teamOf(seat), my = sim.taken[mt], their = sim.taken[1 - mt];
  const total = my + their;
  const g = type === 'sun' ? 26 : 16;
  return (my - their) / total * g;             // margin in game points
}

// ---- thinkers ----------------------------------------------------------------------------------------------
// createThinker(kind, H, seat, level, rng) -> { step() -> { done, action } }
// kind: 'bid' | 'play' | 'double'. `action`: bid {t,suit} | {card, why} | {raise}
export function createThinker(kind, H, seat, level, rng, opts = {}) {
  const L = LEVELS[level - 1];
  if (kind === 'bid') return bidThinker(H, seat, level, rng, opts);
  if (kind === 'double') return doubleThinker(H, seat, level, rng);
  return playThinker(H, seat, L, rng, opts);
}

function bidThinker(H, seat, level, rng, opts) {
  const L = LEVELS[level - 1];
  if (level < 4 && !opts.hint) {
    const a = heuristicBid(H, seat, level);
    // a beginner sometimes bids wrongly
    return { step: () => ({ done: true, action: (level === 1 && rng.chance(0.12)) ? rng.pick(bidOptions(H)) : a }) };
  }
  if (opts.hint) { const a = heuristicBid(H, seat, 3); return { step: () => ({ done: true, action: a, why: bidReason(H, seat, a) }) }; }
  void L;
  const options = bidOptions(H).filter((o) => o.t !== 'pass');
  // cheap pre-filter: only evaluate options whose heuristic strength is not hopeless
  const hand = H.hands[seat];
  const cand = options.filter((o) => o.t === 'sun' ? sunStrength(hand) >= 5 : hokumStrength(H.round === 1 ? [...hand, H.floor] : hand, o.suit) >= 5.5);
  const acc = cand.map(() => 0), N = 20; let n = 0;
  const base = heuristicBid(H, seat, 3);
  return {
    step() {
      if (!cand.length) return { done: true, action: { t: 'pass' } };
      for (let k = 0; k < 2 && n < N; k++, n++) cand.forEach((o, i) => { acc[i] += bidWorld(H, seat, o, rng); });
      if (n < N) return { done: false };
      let bi = -1, bv = 0.8;
      cand.forEach((o, i) => { const m = acc[i] / N; if (m > bv) { bv = m; bi = i; } });
      // a Sun bid outranks Hokum, so favour Hokum unless Sun is clearly better
      const a = bi >= 0 ? cand[bi] : (base.t !== 'pass' && cand.some((o) => o.t === base.t && (o.suit ?? -1) === (base.suit ?? -1)) && false ? base : { t: 'pass' });
      return { done: true, action: a };
    },
  };
}

function doubleThinker(H, seat, level, rng) {
  const ct = H.contract, d = H.dbl, hand = H.hands[seat], team = teamOf(seat), mine = team === teamOf(ct.buyer);
  const done = (raise) => ({ step: () => ({ done: true, action: { raise } }) });
  if (level < 2) return done(false);
  const rung = d.rung;
  // strength of MY hand against their contract / for our contract
  let strong;
  if (ct.type === 'hokum') {
    const tr = hand.filter((c) => suitOf(c) === ct.trump), has = (r) => tr.some((c) => rankOf(c) === r);
    strong = (has(4) ? 2 : 0) + (has(2) ? 1.5 : 0) + Math.max(0, tr.length - 2) + hand.filter((c) => rankOf(c) === 7 && suitOf(c) !== ct.trump).length * 0.6;
    if (!mine) strong += 0.0;
  } else strong = sunStrength(hand) / 2.5;
  if (rung === 0 && !mine) return done(level >= 3 && strong >= 4.6 && rng.chance(0.7));
  if (rung === 1 && mine) return done(level >= 3 && strong >= 5.4);
  if (rung === 2 && !mine) return done(level >= 4 && strong >= 5.6);
  if (rung === 3 && mine) return done(false);
  return done(false);
}

function playThinker(H, seat, L, rng, opts) {
  const ct = H.contract, hand = H.hands[seat], legal = legalFor(hand, H.trick, ct, seat);
  const mask = L.track ? playedMask(H) : EMPTY;
  const pick = () => policyPick(ct, seat, hand, H.trick, mask);
  const finish = (card) => ({ done: true, action: { card, why: opts.hint ? playReason(H, seat, card) : '' } });
  if (legal.length === 1) return { step: () => finish(legal[0]) };
  const worlds = opts.hint ? Math.max(L.worlds, 24) : L.worlds;
  if (!worlds) {
    return { step: () => finish(rng.chance(L.blunder) ? rng.pick(legal) : pick()) };
  }
  // Expert: imagine the hidden hands and play each legal card out
  const voids = findVoids(H), known = [];
  if (ct.type !== 'sun' || true) { if (!playedMask(H)[H.floor] && !hand.includes(H.floor) && ct.buyer !== seat) known.push([H.floor, ct.buyer]); }
  const acc = new Float64Array(legal.length); let n = 0, tries = 0;
  const heur = pick();
  return {
    step() {
      for (let k = 0; k < 2 && n < worlds; k++) {
        tries++;
        const hs = sampleWorld(H, seat, rng, voids, known);
        if (!hs) { if (tries > worlds * 3) n = worlds; continue; }
        const base = simFrom(H, hs);
        n++;
        legal.forEach((c, i) => {
          const s = cloneSim(base), h = s.hands[seat]; const hi = h.indexOf(c); if (hi >= 0) h.splice(hi, 1); else h.pop();
          s.plays.push({ seat, card: c }); s.played[c] = 1; s.turn = nextSeat(seat);
          if (s.plays.length === 4) {                    // complete the trick (we were last)
            const w = s.plays[trickWinnerIdx(s.plays, ct)].seat; let pts = 0; for (const p of s.plays) pts += points(ct, p.card);
            s.tricks += 1; if (s.tricks === 8) pts += 10; s.taken[teamOf(w)] += pts; s.plays = []; s.turn = w;
            if (s.tricks < 8) playoutFrom(s, true);
          } else playoutFrom(s, true);
          const t = teamOf(seat); acc[i] += s.taken[t] - s.taken[1 - t];
        });
      }
      if (n < worlds) return { done: false };
      let bi = 0; legal.forEach((c, i) => { if (acc[i] > acc[bi]) bi = i; });
      const hi = legal.indexOf(heur);
      if (hi >= 0 && acc[hi] >= acc[bi] - 0.5 * n) bi = hi;      // prefer the rule of thumb when it is within noise
      return finish(legal[bi]);
    },
  };
}

// One-sentence reason for a play (used by hints and the coach).
export function playReason(H, seat, card) {
  const ct = H.contract, hand = H.hands[seat], plays = H.trick, legal = legalFor(hand, plays, ct, seat), played = playedMask(H);
  const S = SUIT_NAMES[suitOf(card)];
  if (legal.length === 1) return `It is your only legal card: ${plays.length ? 'the rules of following suit leave you no choice.' : ''}`.trim();
  if (!plays.length) {
    if (ct.type === 'hokum' && suitOf(card) === ct.trump) return `Lead your top trump to pull the opponents' trumps out of their hands.`;
    if (isMaster(ct, card, played, hand)) return `The ${cardName(card)} is the highest ${S} still out, so it should win the trick.`;
    return `Lead a low ${S} to give away as few points as possible and find out who holds the strength.`;
  }
  const w = trickWinnerIdx(plays, ct), win = plays[w], team = teamOf(seat);
  const wins = trickWinnerIdx([...plays, { seat, card }], ct) === plays.length;
  const tp = plays.reduce((s, p) => s + points(ct, p.card), 0);
  if (teamOf(win.seat) === team) {
    if (points(ct, card) >= 3) return 'Your partner is winning this trick, so add points with this card: they all go to your side.';
    return 'Your partner is winning this trick: save your good cards and play low.';
  }
  if (wins) {
    if (isTrump(ct, card) && suitOf(plays[0].card) !== ct.trump) return `You have no ${SUIT_NAMES[suitOf(plays[0].card)]}: cut with a trump to win ${tp} point${tp === 1 ? '' : 's'}.`;
    return `This is the cheapest card that still wins the trick${tp ? ` (${tp} point${tp === 1 ? '' : 's'} on the table)` : ''}.`;
  }
  return 'You cannot win this trick: throw away your least valuable card and keep the strong ones.';
}

export { handSort, findDecls, RANK_LABEL, newDeck };
