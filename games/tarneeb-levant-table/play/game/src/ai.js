// The computer players. Bidding is by hand strength plus what the partner's bid says; card play uses trick-taking
// rules of thumb. Level 1 forgets what was played and blunders sometimes; level 2 counts cards; level 3 also tracks
// who is out of which suit; level 4 additionally searches: it deals the hidden cards out at random (respecting what
// it knows) and plays each candidate card to the end of the hand, a little per frame (a "thinker" object).
import { suitOf, rankOf, teamOf, legalPlays, trickWinner, cloneHand, scoreHand, playCard, SUIT_NAMES, RANK_CH, cardName } from './rules.js';

export const LEVELS = [null,
  { name: 'Easy', blurb: 'Forgets the cards, sometimes plays a careless card.', blunder: 0.3, count: false, voids: false, infer: false, noise: 1.6 },
  { name: 'Medium', blurb: 'Counts what has been played.', blunder: 0.08, count: true, voids: false, infer: false, noise: 0.8 },
  { name: 'Hard', blurb: 'Counts cards, tracks who is out of a suit, reads partner\'s bid.', blunder: 0, count: true, voids: true, infer: true, noise: 0.3 },
  { name: 'Master', blurb: 'Hard, plus it searches many possible deals before every important card.', blunder: 0, count: true, voids: true, infer: true, noise: 0.15, search: true },
];

const bySuit = (hand) => { const s = [[], [], [], []]; for (const c of hand) s[suitOf(c)].push(rankOf(c)); s.forEach((a) => a.sort((x, y) => y - x)); return s; };

// ---- bidding -------------------------------------------------------------------------------------------------
// Rough number of tricks this hand wins by itself with suit s as trump.
export function estTricks(hand, s) {
  const suits = bySuit(hand), tr = suits[s], n = tr.length; let t = 0;
  for (const r of tr) {
    if (r === 12) t += 1; else if (r === 11) t += n >= 2 ? 0.85 : 0.4; else if (r === 10) t += n >= 3 ? 0.6 : 0.2; else if (r === 9) t += n >= 4 ? 0.4 : 0.1;
  }
  if (n >= 4) t += (n - 3) * 0.75;
  let ruffs = Math.max(0, n - 1);
  for (let q = 0; q < 4; q++) {
    if (q === s) continue;
    const a = suits[q], m = a.length;
    if (a[0] === 12) t += 0.9; else if (a[0] === 11) t += m >= 2 ? (a.includes(12) ? 0.9 : 0.5) : 0.15;
    if (a.includes(11) && a[0] === 12) t += 0; else if (a[0] === 10 && a.includes(11)) t += 0.4;
    if (n >= 3 && ruffs > 0) { if (m === 0) { t += 0.9; ruffs--; } else if (m === 1 && a[0] < 12) { t += 0.45; ruffs--; } }
  }
  return t;
}
export function bestTrump(hand) {
  let best = 0, bv = -1;
  for (let s = 0; s < 4; s++) { const v = estTricks(hand, s) + bySuit(hand)[s].length * 0.05; if (v > bv) { bv = v; best = s; } }
  return { suit: best, tricks: estTricks(hand, best) };
}
// What would this player bid now? Returns { n, why } where n = 0 means pass.
export function chooseBid(H, p, level, rng) {
  const L = LEVELS[level], b = H.bid, hand = H.hands[p], mine = bestTrump(hand);
  const noise = (rng ? (rng.next() - 0.5) * 2 : 0) * L.noise;
  const partner = (p + 2) % 4;
  let total = mine.tricks + 2.6 + noise, why;
  if (L.infer && b.by === partner) total = mine.tricks + Math.max(1.5, b.high - 2.6) + noise;
  else if (L.infer && b.by >= 0) total = mine.tricks + 2.3 + noise;
  const want = Math.floor(total + 0.15), sn = SUIT_NAMES[mine.suit];
  const trumps = hand.filter((c) => suitOf(c) === mine.suit).length;
  if (b.by === partner && L.infer && !(mine.tricks >= 4.2 && want >= b.high + 1)) return { n: 0, why: `Your partner already bid ${b.high}. Your hand is not strong enough to overbid them, so pass.` };
  if (b.high === 0) {
    if (want < 7) return { n: 0, why: `Your hand looks worth about ${Math.max(0, Math.round(mine.tricks))} tricks alone, not enough with a partner's help to reach 7. Pass.` };
    const n = Math.min(want >= 13 && mine.tricks < 9 ? 10 : 13, want);
    return { n, why: `You hold ${trumps} ${sn.toLowerCase()} and about ${mine.tricks.toFixed(1)} sure tricks; with a partner's help ${n} is a fair bid.` };
  }
  const n = b.high + 1;
  if (want >= n && n <= 13 && (n <= 10 || mine.tricks >= 7)) why = `You can raise: your hand plus your partner should manage ${n} tricks with ${sn.toLowerCase()} as trump.`;
  else return { n: 0, why: `The bid is ${b.high}. Your hand is not strong enough to go higher, so pass.` };
  return { n, why };
}
export const chooseTrump = (hand) => bestTrump(hand).suit;

// ---- card play -----------------------------------------------------------------------------------------------
function view(H, p, L) {
  const hand = H.hands[p], mine = new Set(hand), seen = new Set(L.count ? H.played : []);
  const higherUnseen = (c) => { const s = suitOf(c); for (let r = rankOf(c) + 1; r < 13; r++) { const d = s * 13 + r; if (!mine.has(d) && !seen.has(d)) return true; } return false; };
  const outstanding = (s) => { let n = 0; for (let r = 0; r < 13; r++) { const d = s * 13 + r; if (!mine.has(d) && !seen.has(d)) n++; } return n; };
  return { hand, mine, seen, master: (c) => !higherUnseen(c), outstanding };
}
const byRank = (a, b) => rankOf(a) - rankOf(b);
const beats = (a, b, trump) => { const at = suitOf(a) === trump, bt = suitOf(b) === trump; if (at !== bt) return at; return suitOf(a) === suitOf(b) && rankOf(a) > rankOf(b); };

// The rule-of-thumb choice for player p. Returns { card, why }.
export function pickCard(H, p, level, rng) {
  const L = LEVELS[level], legal = legalPlays(H, p), trump = H.trump, V = view(H, p, L);
  if (legal.length === 1) return { card: legal[0], why: 'Only one card can be played.' };
  if (L.blunder && rng && rng.chance(L.blunder)) return { card: rng.pick(legal), why: '' };
  const trick = H.trick, myTeam = teamOf(p), declTeam = teamOf(H.declarer) === myTeam;
  const oppVoid = (s) => L.voids ? [1, 3].map((k) => (p + k) % 4).filter((q) => H.voids[q].includes(s)).length : 0;
  const partnerVoid = (s) => L.voids && H.voids[(p + 2) % 4].includes(s);
  const trumpsOut = V.outstanding(trump);
  const low = (a) => a.slice().sort(byRank)[0], high = (a) => a.slice().sort(byRank).reverse()[0];
  const nonTrump = legal.filter((c) => suitOf(c) !== trump);
  const dump = () => {
    const pool = nonTrump.length ? nonTrump : legal;
    // give up the least useful card: never a master, prefer the lowest rank
    return pool.slice().sort((a, b) => (V.master(a) ? 1 : 0) - (V.master(b) ? 1 : 0) || rankOf(a) - rankOf(b))[0];
  };
  if (trick.length === 0) {
    const tr = legal.filter((c) => suitOf(c) === trump);
    if (declTeam && trumpsOut > 0 && tr.length) {
      const top = high(tr);
      if (V.master(top)) return { card: top, why: 'You hold the highest trump left. Lead it to draw the opponents\' trumps out.' };
      if (tr.length >= 3 || p === H.declarer) return { card: top, why: 'Your side named trump: lead trump to draw the opponents\' trumps out before they can ruff your winners.' };
    }
    const masters = nonTrump.filter((c) => V.master(c) && (trumpsOut === 0 || !oppVoid(suitOf(c))));
    if (masters.length) return { card: high(masters), why: `The ${cardName(high(masters))} is the highest ${SUIT_NAMES[suitOf(high(masters))].toLowerCase().slice(0, -1)} left: lead it to take a sure trick.` };
    const mt = tr.filter((c) => V.master(c));
    if (mt.length && (trumpsOut > 0)) return { card: high(mt), why: 'Your trump is the highest left: it wins whenever you play it.' };
    const cnt = [0, 0, 0, 0]; for (const c of V.hand) cnt[suitOf(c)]++;
    const suits = [0, 1, 2, 3].filter((s) => s !== trump && legal.some((c) => suitOf(c) === s));
    if (suits.length) {
      suits.sort((a, b) => (cnt[b] - 3 * oppVoid(b) - (partnerVoid(b) ? 2 : 0)) - (cnt[a] - 3 * oppVoid(a) - (partnerVoid(a) ? 2 : 0)));
      const s = suits[0], c = low(legal.filter((x) => suitOf(x) === s));
      return { card: c, why: `Lead low from your longest side suit (${SUIT_NAMES[s].toLowerCase()}): it costs little and lets your partner win.` };
    }
    return { card: low(legal), why: 'You only have trumps left: lead the lowest.' };
  }
  const ls = suitOf(trick[0].c), winner = trickWinner(trick, trump), winCard = trick.find((t) => t.p === winner).c;
  const partnerWinning = teamOf(winner) === myTeam, left = 3 - trick.length;
  const winners = legal.filter((c) => beats(c, winCard, trump));
  const following = suitOf(legal[0]) === ls;
  if (following) {
    if (partnerWinning) {
      // will a later opponent be able to trump or beat partner's card? (they can only trump if known void and trumps remain)
      const later = [1, 2, 3].map((k) => (p + k) % 4).filter((q) => !trick.some((t) => t.p === q) && teamOf(q) !== myTeam);
      const ruffRisk = trumpsOut > 0 && suitOf(winCard) !== trump && later.some((q) => !L.voids || H.voids[q].includes(ls));
      const partnerSafe = left === 0 || (V.master(winCard) && !ruffRisk);
      if (partnerSafe) return { card: low(legal), why: 'Your partner is already winning this trick: play low and keep your strong cards.' };
      const m = winners.filter((c) => V.master(c));
      if (m.length && left > 0) return { card: low(m), why: 'Your partner\'s card could still be beaten: take the trick with a card nobody can beat.' };
      return { card: low(legal), why: 'Your partner is winning: play low.' };
    }
    if (winners.length === 0) return { card: low(legal), why: suitOf(winCard) === trump && suitOf(winCard) !== ls ? 'Someone has trumped this trick and you cannot beat it: play your lowest card.' : 'You cannot win this trick: play your lowest card and keep your strong ones.' };
    if (left === 0) return { card: low(winners), why: 'You play last: win the trick with the cheapest card that beats it.' };
    const m = winners.filter((c) => V.master(c));
    if (m.length) return { card: low(m), why: 'This card is the highest left in its suit: it wins the trick for sure.' };
    return { card: high(winners), why: 'Play high: others still to play could beat a small card.' };
  }
  // void in the suit led
  const tc = legal.filter((c) => suitOf(c) === trump), tw = tc.filter((c) => beats(c, winCard, trump));
  if (partnerWinning) {
    const safe = left === 0 || suitOf(winCard) === trump || V.master(winCard);
    if (safe || !tw.length) return { card: dump(), why: 'Your partner is winning: throw away a small card instead of trumping.' };
    return { card: dump(), why: 'Your partner is ahead: discard a small card.' };
  }
  if (tw.length) return { card: low(tw), why: `You have no ${SUIT_NAMES[ls].toLowerCase()}: trump it with your lowest trump that wins.` };
  return { card: dump(), why: `You have no ${SUIT_NAMES[ls].toLowerCase()} and cannot win: throw away your least useful card.` };
}

// ---- search (level 4) ----------------------------------------------------------------------------------------
// Deal the unseen cards to the other seats consistent with hand sizes and known voids.
function sampleWorld(H, p, rng) {
  const mine = new Set(H.hands[p]), seen = new Set(H.played), pool = [];
  for (let c = 0; c < 52; c++) if (!mine.has(c) && !seen.has(c)) pool.push(c);
  const others = [1, 2, 3].map((k) => (p + k) % 4);
  for (let attempt = 0; attempt < 25; attempt++) {
    const sh = rng.shuffle(pool), hands = {}; let ok = true;
    const need = others.map((q) => H.hands[q].length);
    for (const q of others) hands[q] = [];
    // constrained cards first: place each card in a seat that is not void in its suit and still has room
    for (const c of sh) {
      const opts = others.filter((q, i) => hands[q].length < need[i] && !H.voids[q].includes(suitOf(c)));
      if (!opts.length) { ok = false; break; }
      hands[opts[(rng.next() * opts.length) | 0]].push(c);
    }
    if (ok) return hands;
  }
  const sh = rng.shuffle(pool), hands = {}; let i = 0;
  for (const q of others) { hands[q] = sh.slice(i, i + H.hands[q].length); i += H.hands[q].length; }
  return hands;
}
function rollout(H, p, world, card, level) {
  const G = cloneHand(H);
  for (const q in world) G.hands[q] = world[q].slice();
  playCard(G, card);
  let guard = 60;
  while (G.phase === 'play' && guard-- > 0) playCard(G, pickCard(G, G.turn, 3, null).card);
  const r = scoreHand(G), me = teamOf(p);
  return r.delta[me] - r.delta[1 - me] + (r.sweep ? (r.declarerTeam === me ? 30 : -30) : 0);
}
// Cards that are interchangeable (adjacent in rank among the cards still unseen by p) are searched once.
function distinct(H, p, legal) {
  const mine = new Set(H.hands[p]), seen = new Set(H.played), out = [];
  for (const c of legal.slice().sort((a, b) => a - b)) {
    const prev = out[out.length - 1];
    if (prev !== undefined && suitOf(prev) === suitOf(c)) {
      let between = false; for (let d = prev + 1; d < c; d++) if (!mine.has(d) && !seen.has(d)) { between = true; break; }
      if (!between) continue;
    }
    out.push(c);
  }
  return out;
}
// A thinker does its work in small steps so the screen never stalls: call step() once per frame until done.
export function createThinker(H, p, level, rng) {
  const L = LEVELS[level], quick = pickCard(H, p, level, rng);
  const t = { done: false, result: quick, steps: 0, step() { if (!this.done) this.done = true; } };
  if (!L.search) { t.done = true; return t; }
  const legal = legalPlays(H, p), cands = distinct(H, p, legal);
  if (cands.length < 2) { t.done = true; return t; }
  const SAMPLES = cands.length > 5 ? 14 : 22, totals = cands.map(() => 0), worlds = [];
  let s = 0, k = 0; t.done = false;
  t.step = function () {
    if (this.done) return;
    this.steps++;
    for (let rep = 0; rep < 3 && s < SAMPLES; rep++) {   // three rollouts per frame (about 1 ms each)
      if (!worlds[s]) worlds[s] = sampleWorld(H, p, rng);
      totals[k] += rollout(H, p, worlds[s], cands[k], level);
      if (++k >= cands.length) { k = 0; s++; }
    }
    if (s >= SAMPLES) {
      let bi = 0; for (let i = 1; i < cands.length; i++) if (totals[i] > totals[bi] + 1e-9) bi = i;
      const heur = cands.includes(quick.card) ? cands.indexOf(quick.card) : -1;
      if (heur >= 0 && totals[heur] >= totals[bi] - 1e-9) bi = heur;
      this.result = { card: cands[bi], why: cands[bi] === quick.card ? quick.why : `Playing out ${SAMPLES} possible deals, the ${RANK_CH[rankOf(cands[bi])]} of ${SUIT_NAMES[suitOf(cands[bi])].toLowerCase()} scores best.` };
      this.done = true;
    }
  };
  return t;
}
