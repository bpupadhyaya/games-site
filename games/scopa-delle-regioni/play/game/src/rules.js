// Scopa rule book. Pure and deterministic: every random choice takes the env.rng passed in.
// A card is an id 0..39: suit = floor(id / 10) (0 coins, 1 cups, 2 swords, 3 batons), rank = id % 10 + 1
// (1 Ace .. 7, then 8 Fante, 9 Cavallo, 10 Re). A card's value is its rank.
export const SUITS = ['denari', 'coppe', 'spade', 'bastoni'];
export const SUIT_EN = ['coins', 'cups', 'swords', 'batons'];
export const RANK_NAMES = ['', 'Ace', '2', '3', '4', '5', '6', '7', 'Fante', 'Cavallo', 'Re'];
export const suitOf = (id) => Math.floor(id / 10);
export const rankOf = (id) => (id % 10) + 1;
export const cardId = (suit, rank) => suit * 10 + rank - 1;
export const cardName = (id) => `${RANK_NAMES[rankOf(id)]} of ${SUIT_EN[suitOf(id)]}`;
export const SETTEBELLO = cardId(0, 7);
export const PRIMIERA = [0, 16, 12, 13, 14, 15, 18, 21, 10, 10, 10];
export const teamOf = (g, seat) => (g.n === 4 ? seat % 2 : seat);
export const teams = (g) => (g.n === 4 ? 2 : g.n);

export function newMatch(n, target) {
  return { n, target, dealer: 0, turn: 0, hands: [], table: [], deck: [], piles: [[], []], scope: [0, 0], lastCapture: -1, score: [0, 0], round: 0, phase: 'play', winner: null, summary: null, plays: 0 };
}
export const clone = (g) => JSON.parse(JSON.stringify(g));

export function dealNext(g) { for (let s = 0; s < g.n; s++) for (let k = 0; k < 3; k++) g.hands[s].push(g.deck.pop()); }

// Start a round: shuffle, lay four cards on the table (re-deal if three or more Kings appear), deal three each.
export function startRound(g, rng) {
  for (;;) {
    const d = rng.shuffle(Array.from({ length: 40 }, (_, i) => i));
    const table = d.slice(0, 4);
    if (table.filter((c) => rankOf(c) === 10).length >= 3) continue;
    g.table = table; g.deck = d.slice(4); break;
  }
  g.hands = Array.from({ length: g.n }, () => []);
  g.piles = [[], []]; g.scope = [0, 0]; g.lastCapture = -1; g.phase = 'play'; g.summary = null; g.round += 1;
  dealNext(g);
  g.dealer = g.round === 1 ? g.dealer : (g.dealer + 1) % g.n;
  g.turn = (g.dealer + 1) % g.n;
  return g;
}

// All legal captures for playing `card` on `table`. A table card of the same rank must be taken ALONE (the
// single-card match rule); otherwise every set of table cards adding up to the rank. Empty list => must lay it down.
export function captures(table, card) {
  const r = rankOf(card), same = table.filter((t) => rankOf(t) === r);
  if (same.length) return same.map((t) => [t]);
  const items = table.filter((t) => rankOf(t) < r).sort((a, b) => a - b), out = [];
  const go = (i, sum, pick) => {
    if (sum === r) { out.push(pick.slice()); return; }
    for (let j = i; j < items.length; j++) { const v = rankOf(items[j]); if (sum + v > r) continue; pick.push(items[j]); go(j + 1, sum + v, pick); pick.pop(); }
  };
  go(0, 0, []);
  return out;
}
// Every play of a hand: {card, take:[...]} (take empty => laying down).
export function legalPlays(g, seat = g.turn) {
  const out = [];
  for (const c of g.hands[seat]) { const caps = captures(g.table, c); if (caps.length) for (const t of caps) out.push({ card: c, take: t }); else out.push({ card: c, take: [] }); }
  return out;
}
// Why is `take` not allowed for `card`? null when fine, else a plain sentence.
export function whyNot(g, card, take) {
  const caps = captures(g.table, card), r = rankOf(card), key = (a) => a.slice().sort((x, y) => x - y).join(',');
  if (!take.length) return caps.length ? 'You can capture with that card, so you must: TAP the glowing table cards.' : null;
  if (caps.some((c) => key(c) === key(take))) return null;
  const sum = take.reduce((a, t) => a + rankOf(t), 0), same = g.table.filter((t) => rankOf(t) === r);
  if (same.length && !(take.length === 1 && rankOf(take[0]) === r)) return `A ${RANK_NAMES[r]} is on the table, so you must take a matching ${RANK_NAMES[r]} on its own.`;
  if (sum !== r) return `Those add up to ${sum}, not ${r}.`;
  return 'That is not a legal capture.';
}

const lastPlayOfRound = (g) => g.deck.length === 0 && g.hands.every((h) => h.length === 0);

// Apply a play (must be legal). Returns what happened, for the animation and the messages.
export function applyPlay(g, seat, card, take) {
  const h = g.hands[seat], i = h.indexOf(card); h.splice(i, 1);
  const team = teamOf(g, seat), res = { seat, card, take: take.slice(), scopa: false, dealt: false, roundEnd: false, tableBefore: g.table.slice(), gained: [] };
  g.plays += 1;
  if (take.length) {
    g.table = g.table.filter((t) => !take.includes(t));
    g.piles[team].push(card, ...take); res.gained = [card, ...take]; g.lastCapture = seat;
    if (g.table.length === 0 && !lastPlayOfRound(g)) { g.scope[team] += 1; res.scopa = true; }
  } else g.table.push(card);
  if (g.hands.every((x) => x.length === 0)) {
    if (g.deck.length) { dealNext(g); res.dealt = true; }
    else {
      res.roundEnd = true;
      if (g.table.length && g.lastCapture >= 0) { const lt = teamOf(g, g.lastCapture); g.piles[lt].push(...g.table); res.swept = g.table.slice(); res.sweptTo = g.lastCapture; g.table = []; }
    }
  }
  g.turn = (seat + 1) % g.n;
  return res;
}

export function primieraOf(pile) {
  const best = [0, 0, 0, 0];
  for (const c of pile) best[suitOf(c)] = Math.max(best[suitOf(c)], PRIMIERA[rankOf(c)]);
  return best.every((b) => b > 0) ? best.reduce((a, b) => a + b, 0) : 0;
}
// Score the finished round: returns the summary (also stored on g) and adds to g.score.
export function scoreRound(g) {
  const T = teams(g), per = [], cat = (vals, min = 0) => { const m = Math.max(...vals); return vals.filter((v) => v === m).length === 1 && m > min ? vals.indexOf(m) : -1; };
  for (let t = 0; t < T; t++) { const p = g.piles[t]; per.push({ cards: p.length, coins: p.filter((c) => suitOf(c) === 0).length, sette: p.includes(SETTEBELLO), prim: primieraOf(p), scope: g.scope[t], pts: 0 }); }
  const winners = { carte: cat(per.map((x) => x.cards)), denari: cat(per.map((x) => x.coins)), sette: per.findIndex((x) => x.sette), primiera: cat(per.map((x) => x.prim)) };
  for (const k of Object.keys(winners)) if (winners[k] >= 0) per[winners[k]].pts += 1;
  for (const x of per) x.pts += x.scope;
  per.forEach((x, t) => { g.score[t] += x.pts; });
  g.summary = { per, winners };
  g.phase = 'roundOver';
  const top = Math.max(...g.score);
  if (top >= g.target && g.score.filter((s) => s === top).length === 1) { g.winner = g.score.indexOf(top); g.phase = 'over'; }
  return g.summary;
}
