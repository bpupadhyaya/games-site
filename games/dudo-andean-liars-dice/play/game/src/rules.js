// Dudo rules engine: pure, deterministic, no drawing. Players hold dice under cups; bids are { q, f } (quantity, face).
// Ones are "pacos" (aces): wild for every other face, except in a palifico round and when the bid is on ones.
export const START_DICE = 5;
export const MAX_PLAYERS = 6;

export function makePlayers(specs, dice = START_DICE) {
  return specs.map((s, i) => ({ id: i, name: s.name, kind: s.kind, level: s.level ?? 0, dice, hand: [], palUsed: false }));
}

export function newMatch(specs, dice = START_DICE) {
  const players = makePlayers(specs, dice);
  return { players, start: players.length * dice, dice, round: 0, opener: 0, turn: 0, bids: [], palifico: false, last: null };
}

export const alive = (st) => st.players.filter((p) => p.hand.length > 0 || p.dice > 0);
export const living = (st) => st.players.filter((p) => p.dice > 0);
export const totalDice = (st) => st.players.reduce((s, p) => s + p.dice, 0);
export const isOver = (st) => living(st).length <= 1;
export const winnerOf = (st) => (isOver(st) ? living(st)[0] ?? null : null);

export function rollHands(st, rng) {
  for (const p of st.players) p.hand = Array.from({ length: p.dice }, () => 1 + rng.int(6));
}

export function nextLiving(st, from) {
  const n = st.players.length;
  for (let k = 1; k <= n; k++) { const i = (from + k) % n; if (st.players[i].dice > 0) return i; }
  return from;
}

// Smallest legal quantity of face f after the previous bid (Infinity = not allowed).
export function minQty(prev, f, palifico) {
  if (!prev) return 1;
  if (palifico) return f === prev.f ? prev.q + 1 : Infinity;
  if (f === prev.f) return prev.q + 1;
  if (f === 1) return Math.ceil(prev.q / 2);
  if (prev.f === 1) return prev.q * 2 + 1;
  return f > prev.f ? prev.q : prev.q + 1;
}
export const isLegalBid = (st, q, f) => {
  const prev = st.bids.length ? st.bids[st.bids.length - 1] : null;
  return Number.isInteger(q) && q >= 1 && f >= 1 && f <= 6 && q <= totalDice(st) && q >= minQty(prev, f, st.palifico && Boolean(prev));
};
export const prevBid = (st) => (st.bids.length ? st.bids[st.bids.length - 1] : null);
export function legalBids(st) {
  const prev = prevBid(st), total = totalDice(st), out = [];
  for (let f = 1; f <= 6; f++) {
    const m = minQty(prev, f, st.palifico && Boolean(prev));
    if (m === Infinity) continue;
    for (let q = m; q <= total; q++) out.push({ q, f });
  }
  return out;
}
// Calzo (an exact-count call) is allowed while at least half of the starting dice are still in play.
export const canCalzo = (st) => st.bids.length > 0 && totalDice(st) * 2 >= st.start;
export const canDudo = (st) => st.bids.length > 0;

export const wildApplies = (st, f) => f !== 1 && !st.palifico;
export function countFace(st, f) {
  let c = 0;
  for (const p of st.players) for (const d of p.hand) if (d === f || (d === 1 && wildApplies(st, f))) c++;
  return c;
}
export const countIn = (hand, f, wild) => hand.reduce((s, d) => s + (d === f || (d === 1 && wild && f !== 1) ? 1 : 0), 0);

// ---- exact probability (binomial)
export function binomPmf(n, k, p) {
  if (k < 0 || k > n) return 0;
  let c = 1;
  for (let i = 1; i <= k; i++) c = (c * (n - k + i)) / i;
  return c * p ** k * (1 - p) ** (n - k);
}
export function probAtLeast(n, k, p) {
  if (k <= 0) return 1;
  if (k > n) return 0;
  let s = 0;
  for (let i = k; i <= n; i++) s += binomPmf(n, i, p);
  return Math.min(1, s);
}
export const faceChance = (st, f) => (wildApplies(st, f) ? 1 / 3 : 1 / 6);

// Probability a bid is true from a player's point of view (own hand known, the rest unknown).
export function bidProb(st, hand, bid) {
  const wild = wildApplies(st, bid.f);
  const own = countIn(hand, bid.f, wild);
  const unknown = totalDice(st) - hand.length;
  return probAtLeast(unknown, bid.q - own, faceChance(st, bid.f));
}
// Probability that the count is exactly the bid (for calzo).
export function exactProb(st, hand, bid) {
  const own = countIn(hand, bid.f, wildApplies(st, bid.f));
  const unknown = totalDice(st) - hand.length;
  return binomPmf(unknown, bid.q - own, faceChance(st, bid.f));
}

// ---- moves
export function place(st, who, q, f) { st.bids.push({ p: who, q, f }); st.turn = nextLiving(st, who); }

// Resolves a call. Returns { kind, caller, bidder, bid, actual, loser, gain, ... } and applies dice changes.
export function resolveCall(st, kind, caller) {
  const bid = prevBid(st);
  const actual = countFace(st, bid.f);
  const res = { kind, caller, bidder: bid.p, bid, actual, loser: -1, gainer: -1, palifico: false, eliminated: false };
  if (kind === 'dudo') res.loser = actual >= bid.q ? caller : bid.p;
  else if (actual === bid.q) res.gainer = caller;
  else res.loser = caller;
  if (res.loser >= 0) {
    const p = st.players[res.loser];
    p.dice -= 1;
    if (p.dice === 0) res.eliminated = true;
  } else if (res.gainer >= 0) {
    const p = st.players[res.gainer];
    if (p.dice < st.dice) p.dice += 1; else res.capped = true;
  }
  st.last = res;
  return res;
}

// Sets up the next round after a resolved call (rolls nothing). Returns the opener.
export function nextRound(st) {
  const res = st.last;
  let opener = res.loser >= 0 ? res.loser : res.caller;
  if (st.players[opener].dice === 0) opener = nextLiving(st, opener);
  st.palifico = false;
  if (res.loser >= 0 && !res.eliminated) {
    const p = st.players[res.loser];
    if (p.dice === 1 && !p.palUsed && living(st).length > 2) { p.palUsed = true; st.palifico = true; res.palifico = true; }
  }
  st.round += 1; st.opener = opener; st.turn = opener; st.bids = [];
  return opener;
}
