// The rule book for Baloot (Saudi ruleset, score only). Pure and deterministic. Documented in design/GDD.md.
// Seats 0..3 run COUNTER-CLOCKWISE: 0 = you (south), 1 = right (east), 2 = partner (north), 3 = left (west).
// Teams: seats 0 and 2 (team 0) against seats 1 and 3 (team 1). A card is an int: suit * 8 + rank.
// Suits: 0 spades, 1 hearts, 2 diamonds, 3 clubs. Ranks (natural order): 0=7 1=8 2=9 3=10 4=J 5=Q 6=K 7=A.

export const SUITS = ['S', 'H', 'D', 'C'];
export const SUIT_NAMES = ['Spades', 'Hearts', 'Diamonds', 'Clubs'];
export const RANK_LABEL = ['7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
export const SEAT_NAMES = ['You', 'Right', 'Partner', 'Left'];
export const suitOf = (c) => c >> 3;
export const rankOf = (c) => c & 7;
export const mk = (s, r) => s * 8 + r;
export const teamOf = (seat) => seat & 1;
export const nextSeat = (s) => (s + 1) & 3;
export const cardName = (c) => `${RANK_LABEL[rankOf(c)]} of ${SUIT_NAMES[suitOf(c)]}`;
export const cardShort = (c) => `${RANK_LABEL[rankOf(c)]}${'♠♥♦♣'[suitOf(c)]}`;
export const TARGETS = [152, 61];

// Strength order (higher index = stronger) and card points.
const SUN_ORD = [0, 1, 2, 4, 5, 6, 3, 7].map((_, i) => i); // placeholder replaced below
const SUN_STR = [0, 1, 2, 6, 3, 4, 5, 7];       // by rank: 7 8 9 10 J Q K A -> 10 beats K
const TRUMP_STR = [0, 1, 6, 4, 7, 2, 3, 5];     // by rank: 7 8 9 10 J Q K A -> J, 9, A, 10, K, Q, 8, 7
const SUN_PTS = [0, 0, 0, 10, 2, 3, 4, 11];
const TRUMP_PTS = [0, 0, 14, 10, 20, 3, 4, 11];
void SUN_ORD;

export const isTrump = (ct, c) => ct.type === 'hokum' && suitOf(c) === ct.trump;
export const strength = (ct, c) => (isTrump(ct, c) ? TRUMP_STR[rankOf(c)] + 10 : SUN_STR[rankOf(c)]);
export const points = (ct, c) => (isTrump(ct, c) ? TRUMP_PTS : SUN_PTS)[rankOf(c)];
export const handSort = (ct, cards) => [...cards].sort((a, b) => (suitOf(a) - suitOf(b)) || (strength(ct, b) - strength(ct, a)));

export function newDeck() { const d = []; for (let i = 0; i < 32; i++) d.push(i); return d; }

// ---- trick primitives (used by the game, the computer and the solver) --------------------------------------
// plays: [{ seat, card }] in order. Returns the index in plays of the winning play.
export function trickWinnerIdx(plays, ct) {
  const led = suitOf(plays[0].card);
  let best = 0;
  for (let i = 1; i < plays.length; i++) {
    const a = plays[i].card, b = plays[best].card;
    const at = isTrump(ct, a), bt = isTrump(ct, b);
    if (at && !bt) best = i;
    else if (at === bt && suitOf(a) === (bt ? ct.trump : led) && (bt || suitOf(b) === led) && strength(ct, a) > strength(ct, b)) best = i;
    else if (!at && !bt && suitOf(a) === led && suitOf(b) !== led) best = i;
  }
  return best;
}

// The cards `seat` may play. hand = its cards, plays = the trick so far.
export function legalFor(hand, plays, ct, seat) {
  if (!plays.length) return hand.slice();
  const led = suitOf(plays[0].card);
  const follow = hand.filter((c) => suitOf(c) === led);
  const hok = ct.type === 'hokum';
  if (follow.length) {
    if (hok && led === ct.trump) {                       // trump led: go higher if you can
      const top = Math.max(...plays.filter((p) => suitOf(p.card) === led).map((p) => strength(ct, p.card)));
      const higher = follow.filter((c) => strength(ct, c) > top);
      return higher.length ? higher : follow;
    }
    return follow;
  }
  if (!hok) return hand.slice();
  const trumps = hand.filter((c) => suitOf(c) === ct.trump);
  if (!trumps.length) return hand.slice();
  const w = trickWinnerIdx(plays, ct);
  if (teamOf(plays[w].seat) === teamOf(seat)) return hand.slice();   // partner is winning: no duty to trump
  const played = plays.filter((p) => suitOf(p.card) === ct.trump);
  if (played.length) {
    const top = Math.max(...played.map((p) => strength(ct, p.card)));
    const higher = trumps.filter((c) => strength(ct, c) > top);
    return higher.length ? higher : trumps;
  }
  return trumps;
}

// Plain-language reason a card cannot be played (or '' when it can).
export function whyNot(hand, plays, ct, seat, card) {
  const legal = legalFor(hand, plays, ct, seat);
  if (legal.includes(card)) return '';
  if (!plays.length) return 'That is not one of your cards.'; // defensive: should be unreachable in real play
  const led = suitOf(plays[0].card), S = SUIT_NAMES[led];
  const follow = hand.filter((c) => suitOf(c) === led);
  if (follow.length) {
    if (ct.type === 'hokum' && led === ct.trump) return `Trump was led and a higher trump is in your hand: you must play a higher trump than the ${cardShort(plays.filter((p) => suitOf(p.card) === led).sort((a, b) => strength(ct, b.card) - strength(ct, a.card))[0].card)}.`;
    return `${S} was led and you hold ${S}: you must follow suit.`;
  }
  const trumps = hand.filter((c) => suitOf(c) === ct.trump);
  if (trumps.length && suitOf(card) !== ct.trump) return `You have no ${S}, an opponent is winning and you hold trump (${SUIT_NAMES[ct.trump]}): you must cut with a trump.`;
  return `A higher trump than the one on the table is in your hand: you must overtrump.`;
}

// Points in a finished set of tricks etc. -------------------------------------------------------------------
export const trickPoints = (plays, ct) => plays.reduce((s, p) => s + points(ct, p.card), 0);

// ---- declarations ----------------------------------------------------------------------------------------
// Game-point values: [Hokum, Sun].
export const DECL = {
  sira: { name: 'Sira', v: [2, 4], rank: 1 }, fifty: { name: 'Fifty', v: [5, 10], rank: 2 },
  hundred: { name: 'Hundred', v: [10, 20], rank: 3 }, four: { name: 'Four hundred', v: [0, 40], rank: 4 },
};
// Best non-overlapping set of declarations in an 8-card hand: sets of four (aces, kings, queens, tens) then runs.
export function findDecls(hand, ct) {
  const out = [], used = new Set();
  const hok = ct.type === 'hokum';
  for (const r of [7, 6, 5, 3]) {
    const set = [0, 1, 2, 3].map((s) => mk(s, r));
    if (set.every((c) => hand.includes(c))) {
      const kind = r === 7 && !hok ? 'four' : 'hundred';
      out.push({ kind, cards: set, top: r, label: r === 7 && !hok ? 'Four aces (400)' : `Four ${RANK_LABEL[r]}s (100)` });
      set.forEach((c) => used.add(c));
      // a four-of-a-kind keeps those cards out of runs
    }
  }
  for (let s = 0; s < 4; s++) {
    let run = [];
    const flush = () => {
      if (run.length >= 3) {
        const kind = run.length >= 5 ? 'hundred' : run.length === 4 ? 'fifty' : 'sira';
        const cards = run.length > 5 ? run.slice(-5) : run;
        out.push({ kind, cards: cards.map((r) => mk(s, r)), top: cards[cards.length - 1], label: `${DECL[kind].name} in ${SUIT_NAMES[s]}` });
      }
      run = [];
    };
    for (let r = 0; r < 8; r++) { const c = mk(s, r); if (hand.includes(c) && !used.has(c)) run.push(r); else flush(); }
    flush();
  }
  return out;
}
export const declValue = (d, ct) => DECL[d.kind].v[ct.type === 'sun' ? 1 : 0];
export const hasBaloot = (hand, ct) => ct.type === 'hokum' && hand.includes(mk(ct.trump, 5)) && hand.includes(mk(ct.trump, 6));

// ---- a hand (one deal): bidding, doubling, play ------------------------------------------------------------
// H is plain JSON.
export function newHand(rng, dealer, scores, cards) {
  const deck = cards ? cards.slice() : rng.shuffle(newDeck());
  const hands = [[], [], [], []];
  for (let k = 0; k < 20; k++) hands[(dealer + 1 + (k % 4)) & 3].push(deck[k]);
  return {
    dealer, scores: scores || [0, 0], phase: 'bid', round: 1, floor: deck[20], rest: deck.slice(21),
    hands, turn: nextSeat(dealer), bidIdx: 0, hokumBid: null, bidLog: [],
    contract: null, mult: 1, matchCall: false, dbl: null,
    trick: [], leader: nextSeat(dealer), tricks: 0, taken: [0, 0], cardsTaken: [[], []], lastWinner: -1,
    declared: [[], [], [], []], declShown: null, declWin: -1, baloot: [false, false, false, false], played: [],
    history: [], result: null, leader0: nextSeat(dealer), playedBy: {},
  };
}

export function bidOptions(H) {
  const o = [{ t: 'pass' }];
  if (!H.hokumBid) {
    if (H.round === 1) o.push({ t: 'hokum', suit: suitOf(H.floor) });
    else for (let s = 0; s < 4; s++) if (s !== suitOf(H.floor)) o.push({ t: 'hokum', suit: s });
  }
  o.push({ t: 'sun' });
  return o;
}

function contractFor(H, buyer, type, suit) {
  H.contract = { type, trump: type === 'hokum' ? suit : -1, buyer, round: H.round };
  // the buyer takes the turned-up card, then 2 more; the others get 3
  const rest = H.rest.slice();
  for (let k = 0; k < 4; k++) {
    const seat = (H.dealer + 1 + k) & 3;
    if (seat === buyer) { H.hands[seat].push(H.floor, rest.shift(), rest.shift()); } else { H.hands[seat].push(rest.shift(), rest.shift(), rest.shift()); }
  }
  H.rest = [];
  const buyerTeam = teamOf(buyer);
  const canDouble = type === 'hokum' || (H.scores[buyerTeam] > 100 && H.scores[1 - buyerTeam] < 100);
  H.dbl = canDouble ? { rung: 0, asks: [nextSeat(buyer), (buyer + 3) & 3], doubler: -1 } : null;
  if (H.dbl) { H.phase = 'double'; H.turn = H.dbl.asks[0]; } else startPlay(H);
}

export function applyBid(H, a) {
  const seat = H.turn;
  H.bidLog.push({ seat, t: a.t, suit: a.suit ?? -1, round: H.round });
  if (a.t === 'sun') { contractFor(H, seat, 'sun', -1); return; }
  if (a.t === 'hokum') H.hokumBid = { seat, suit: a.suit };
  H.bidIdx += 1;
  if (H.bidIdx < 4) { H.turn = nextSeat(seat); return; }
  if (H.hokumBid) { contractFor(H, H.hokumBid.seat, 'hokum', H.hokumBid.suit); return; }
  if (H.round === 1) { H.round = 2; H.bidIdx = 0; H.turn = nextSeat(H.dealer); return; }
  H.phase = 'redeal';
}

// doubling ladder: rung 0 defenders "Double" (x2), 1 buyer "Three" (x3), 2 the doubler "Four" (x4), 3 buyer "Match call".
export const RUNG = ['Double', 'Three', 'Four', 'Match call'];
export function applyDouble(H, raise) {
  const d = H.dbl, seat = H.turn, buyer = H.contract.buyer;
  if (raise) {
    H.mult = d.rung + 2; if (d.rung === 0) d.doubler = seat;
    if (d.rung === 3) { H.matchCall = true; startPlay(H); return; }
    d.rung += 1;
    const to = d.rung === 1 ? buyer : d.rung === 2 ? d.doubler : buyer;
    d.asks = [to]; H.turn = to; return;
  }
  d.asks.shift();
  if (d.asks.length) { H.turn = d.asks[0]; return; }
  startPlay(H);
}

function startPlay(H) {
  H.phase = 'play'; H.turn = H.leader = nextSeat(H.dealer); H.trick = [];
  H.hands = H.hands.map((h) => handSort(H.contract, h));
}

export const legalCards = (H, seat) => legalFor(H.hands[seat], H.trick, H.contract, seat);

// What declarations the seat may announce (only before its first card of the first trick).
export function declOptions(H, seat) {
  if (H.tricks !== 0 || H.hands[seat].length !== 8 || H.declared[seat].length) return [];
  return findDecls(H.hands[seat], H.contract);
}
export function declare(H, seat) { H.declared[seat] = declOptions(H, seat); }

function resolveDecls(H) {
  // the team with the best declaration counts all of theirs. Ties go to the team that leads earlier.
  const ct = H.contract;
  const best = [null, null];
  for (let k = 0; k < 4; k++) {
    const seat = (H.leader0 + k) & 3;
    for (const d of H.declared[seat]) {
      const key = DECL[d.kind].rank * 100 + d.top, t = teamOf(seat);
      if (!best[t] || key > best[t]) best[t] = key;
    }
  }
  let win = -1;
  if (best[0] !== null && best[1] !== null) win = best[0] > best[1] ? 0 : best[1] > best[0] ? 1 : teamOf(H.leader0);
  else if (best[0] !== null) win = 0; else if (best[1] !== null) win = 1;
  H.declWin = win;
  void ct;
}

// Play a legal card. Returns { winner, done } when a trick completes, else null.
export function playCard(H, card) {
  const seat = H.turn, ct = H.contract;
  if (H.tricks === 0 && H.trick.length === 0) H.leader0 = seat;
  H.hands[seat] = H.hands[seat].filter((c) => c !== card);
  H.trick.push({ seat, card }); H.played.push(card);
  H.playedBy[card] = seat;
  if (ct.type === 'hokum' && suitOf(card) === ct.trump && (rankOf(card) === 5 || rankOf(card) === 6)) {
    const other = mk(ct.trump, rankOf(card) === 5 ? 6 : 5);
    if (H.playedBy[other] === seat) H.baloot[seat] = true;
  }
  if (H.trick.length < 4) { H.turn = nextSeat(seat); return null; }
  const w = H.trick[trickWinnerIdx(H.trick, ct)].seat, t = teamOf(w);
  let pts = trickPoints(H.trick, ct);
  H.tricks += 1;
  if (H.tricks === 8) { pts += 10; H.lastWinner = w; }
  H.taken[t] += pts; H.cardsTaken[t].push(...H.trick.map((p) => p.card));
  H.history.push({ leader: H.leader, plays: H.trick.slice(), winner: w });
  H.trick = []; H.leader = w; H.turn = w;
  if (H.tricks === 2) resolveDecls(H);
  if (H.tricks === 8) { H.phase = 'done'; H.result = scoreHand(H); return { winner: w, done: true }; }
  return { winner: w, done: false };
}
// (trick-by-trick tally of wins per team, for the kaboot check)
export function trickWins(H) { const w = [0, 0]; for (const h of H.history) w[teamOf(h.winner)] += 1; return w; }

// Rounding: nearest ten; a half rounds down for the buyer and up for the defenders.
function toGame(raw, isBuyer, sun) {
  const q = raw / 10, f = Math.floor(q), frac = q - f;
  const g = frac > 0.5 ? f + 1 : frac < 0.5 ? f : (isBuyer ? f : f + 1);
  return sun ? g * 2 : g;
}

export function scoreHand(H) {
  const ct = H.contract, buyerTeam = teamOf(ct.buyer), def = 1 - buyerTeam, sun = ct.type === 'sun';
  const wins = trickWins(H);
  const decl = [0, 0];
  if (H.declWin >= 0) for (let s = 0; s < 4; s++) if (teamOf(s) === H.declWin) for (const d of H.declared[s]) decl[H.declWin] += declValue(d, ct);
  const baloot = [0, 0];
  for (let s = 0; s < 4; s++) if (H.baloot[s]) baloot[teamOf(s)] += 2;
  let game = [0, 0], kaboot = -1;
  if (wins[0] === 8 || wins[1] === 8) {
    kaboot = wins[0] === 8 ? 0 : 1;
    game[kaboot] = sun ? 44 : 25;
  } else {
    game[buyerTeam] = toGame(H.taken[buyerTeam], true, sun);
    game[def] = toGame(H.taken[def], false, sun);
  }
  const cardG = game.slice();
  game[0] += decl[0]; game[1] += decl[1];
  let buyerWon = kaboot >= 0 ? kaboot === buyerTeam : game[buyerTeam] > game[def];
  const out = [0, 0];
  if (buyerWon) { out[0] = game[0]; out[1] = game[1]; }
  else { out[def] = game[0] + game[1]; }
  // baloot points always stay with the holder
  for (let t = 0; t < 2; t++) out[t] = out[t] * H.mult + baloot[t];
  return { taken: H.taken.slice(), cardG, decl, baloot, kaboot, buyerTeam, buyerWon, mult: H.mult, matchCall: H.matchCall, delta: out, wins };
}

// ---- match -------------------------------------------------------------------------------------------------
// Returns winning team or -1. A match call that succeeds wins the match at once.
export function matchWinner(scores, target, result) {
  if (result && result.matchCall) { const w = result.buyerWon ? result.buyerTeam : 1 - result.buyerTeam; return w; }
  if (scores[0] >= target || scores[1] >= target) return scores[0] === scores[1] ? -1 : scores[0] > scores[1] ? 0 : 1;
  return -1;
}
