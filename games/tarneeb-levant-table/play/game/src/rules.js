// Tarneeb rule book: pure functions over a plain-JSON hand object (so it can be cloned, saved, and searched).
// Cards are integers 0..51: suit = floor(c / 13) (0 spades, 1 hearts, 2 diamonds, 3 clubs), rank = c % 13 (0 = two ... 12 = ace).
// Seats: 0 South (you), 1 East, 2 North (your partner), 3 West. Play passes 0 -> 1 -> 2 -> 3 (counter-clockwise on screen).
// Teams: seats 0 and 2 are team 0 ("Us"), seats 1 and 3 are team 1 ("Them").
export const SUIT_NAMES = ['Spades', 'Hearts', 'Diamonds', 'Clubs'];
export const SUIT_CH = ['S', 'H', 'D', 'C'];
export const RANK_CH = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
export const SEAT_NAMES = ['You', 'East', 'Partner', 'West'];
export const suitOf = (c) => (c / 13) | 0;
export const rankOf = (c) => c % 13;
export const teamOf = (p) => p & 1;
export const cardName = (c) => `${RANK_CH[rankOf(c)]} of ${SUIT_NAMES[suitOf(c)]}`;
export const sortHand = (h) => h.sort((a, b) => suitOf(a) - suitOf(b) || rankOf(b) - rankOf(a));

// A fresh hand. `dealt` is the four hands (already shuffled by the caller from env.rng). Bidding starts with
// the player to the dealer's right, which in this seating order is dealer + 1.
export function newHand(dealt, dealer) {
  return {
    hands: dealt.map((h) => sortHand(h.slice())), dealer, phase: 'bid',
    bid: { turn: (dealer + 1) % 4, high: 0, by: -1, passed: [false, false, false, false], log: [null, null, null, null] },
    trump: -1, contract: 0, declarer: -1, leader: -1, turn: -1, trick: [], tricks: [0, 0], played: [], lastTrick: null, voids: [[], [], [], []],
  };
}

export function deal(rng, dealer) {
  const deck = rng.shuffle(Array.from({ length: 52 }, (_, i) => i));
  return newHand([0, 1, 2, 3].map((p) => deck.slice(p * 13, p * 13 + 13)), dealer);
}

// ---- bidding -------------------------------------------------------------------------------------------------
export const canBid = (H, n) => H.phase === 'bid' && n >= 7 && n <= 13 && n > H.bid.high;
export function whyNotBid(H, n) {
  if (n <= H.bid.high) return `Someone already bid ${H.bid.high}. You must bid more than that, or pass.`;
  return 'A bid is 7 to 13 tricks.';
}
// Apply a bid (n = 7..13) or a pass (n = 0) by the player whose turn it is. Returns 'won', 'next' or 'redeal' (all four pass).
export function bidAction(H, n) {
  const b = H.bid, p = b.turn;
  if (n === 0) { b.passed[p] = true; b.log[p] = 0; } else { b.high = n; b.by = p; b.log[p] = n; }
  const live = [0, 1, 2, 3].filter((q) => !b.passed[q]);
  if (b.high === 13 || (b.by >= 0 && live.length === 1 && live[0] === b.by)) {
    H.phase = 'trump'; H.declarer = b.by; H.contract = b.high; b.turn = b.by; return 'won';
  }
  if (live.length === 0) return 'redeal';
  let q = (p + 1) % 4; while (b.passed[q]) q = (q + 1) % 4;
  b.turn = q; return 'next';
}
export function setTrump(H, s) {
  H.trump = s; H.phase = 'play'; H.leader = H.declarer; H.turn = H.declarer;
}

// ---- play ----------------------------------------------------------------------------------------------------
export function legalPlays(H, p) {
  const hand = H.hands[p];
  if (H.trick.length === 0) return hand.slice();
  const ls = suitOf(H.trick[0].c), follow = hand.filter((c) => suitOf(c) === ls);
  return follow.length ? follow : hand.slice();
}
export function whyIllegal(H) {
  const ls = suitOf(H.trick[0].c);
  return `You must follow suit: ${SUIT_NAMES[ls]} was led and you hold ${SUIT_NAMES[ls]}. Play one of the glowing cards.`;
}
export function trickWinner(trick, trump) {
  let best = trick[0];
  const beats = (a, b) => {
    const at = suitOf(a.c) === trump, bt = suitOf(b.c) === trump;
    if (at !== bt) return at;
    if (suitOf(a.c) !== suitOf(b.c)) return false;
    return rankOf(a.c) > rankOf(b.c);
  };
  for (let i = 1; i < trick.length; i++) if (beats(trick[i], best)) best = trick[i];
  return best.p;
}
// Play card c by the player whose turn it is. Returns { done: false } or { done: true, winner, cards } when the trick completes.
export function playCard(H, c) {
  const p = H.turn, hand = H.hands[p];
  if (H.trick.length && suitOf(c) !== suitOf(H.trick[0].c)) { const s = suitOf(H.trick[0].c); if (!H.voids[p].includes(s)) H.voids[p].push(s); }
  hand.splice(hand.indexOf(c), 1);
  H.trick.push({ p, c }); H.played.push(c);
  if (H.trick.length < 4) { H.turn = (p + 1) % 4; return { done: false }; }
  const winner = trickWinner(H.trick, H.trump), cards = H.trick;
  H.tricks[teamOf(winner)]++;
  H.lastTrick = { cards, winner }; H.trick = []; H.leader = winner; H.turn = winner;
  if (H.hands.every((h) => h.length === 0)) H.phase = 'done';
  return { done: true, winner, cards };
}

// ---- scoring -------------------------------------------------------------------------------------------------
// Bidders who take at least their bid score the tricks they took (all 13 on a bid of 13 wins the game outright);
// bidders who fall short LOSE the amount of their bid; the other side always scores the tricks it took.
export function scoreHand(H) {
  const dt = teamOf(H.declarer), ot = 1 - dt, made = H.tricks[dt] >= H.contract, delta = [0, 0];
  delta[dt] = made ? H.tricks[dt] : -H.contract; delta[ot] = H.tricks[ot];
  return { made, delta, declarerTeam: dt, sweep: made && H.contract === 13 };
}
// After adding a hand's delta: which team has won the match (or -1)?
export function matchWinner(scores, target, res) {
  if (res && res.sweep) return res.declarerTeam;
  const a = scores[0] >= target, b = scores[1] >= target;
  if (a && b) return scores[0] === scores[1] ? -1 : scores[0] > scores[1] ? 0 : 1;
  return a ? 0 : b ? 1 : -1;
}
export const cloneHand = (H) => JSON.parse(JSON.stringify(H));
