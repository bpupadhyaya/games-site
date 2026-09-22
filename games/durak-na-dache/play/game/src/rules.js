// Durak rules engine (pure, deterministic, JSON-friendly). Ruleset is documented in design/GDD.md.
// Card id = suit*9 + rank. Suits: 0 spades, 1 hearts, 2 diamonds, 3 clubs. Ranks: 0..8 = 6,7,8,9,10,J,Q,K,A.
export const SUIT_NAMES = ['spades', 'hearts', 'diamonds', 'clubs'];
export const RANK_LABELS = ['6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
export const RANK_WORDS = ['six', 'seven', 'eight', 'nine', 'ten', 'jack', 'queen', 'king', 'ace'];
export const suitOf = (c) => (c / 9) | 0;
export const rankOf = (c) => c % 9;
export const cardName = (c) => `${RANK_LABELS[rankOf(c)]} of ${SUIT_NAMES[suitOf(c)]}`;
export const beats = (a, d, trump) => {
  const sa = suitOf(a), sd = suitOf(d);
  return sd === sa ? rankOf(d) > rankOf(a) : (sd === trump && sa !== trump);
};
export const FULL_HAND = 6;

// Sort key for showing a hand: plain suits grouped (trump last), ascending rank.
export function sortHand(hand, trump) {
  return hand.slice().sort((x, y) => {
    const sx = suitOf(x) === trump ? 9 : suitOf(x), sy = suitOf(y) === trump ? 9 : suitOf(y);
    return sx - sy || rankOf(x) - rankOf(y);
  });
}

export function nextActive(g, seat) {
  for (let k = 1; k <= g.n; k++) { const s = (seat + k) % g.n; if (!g.out[s]) return s; }
  return -1;
}

export function newDeal(rng, n = 2, mode = 'pod') {
  const deck = rng.shuffle(Array.from({ length: 36 }, (_, i) => i));
  const stock = deck.slice();
  const hands = [];
  for (let p = 0; p < n; p++) hands.push([]);
  for (let r = 0; r < FULL_HAND; r++) for (let p = 0; p < n; p++) hands[p].push(stock.pop());
  const trumpCard = stock[0];
  const trump = suitOf(trumpCard);
  let attacker = 0, low = 99;
  for (let p = 0; p < n; p++) for (const c of hands[p]) if (suitOf(c) === trump && rankOf(c) < low) { low = rankOf(c); attacker = p; }
  const g = {
    n, mode, hands: hands.map((h) => sortHand(h, trump)), stock, trump, trumpCard, discard: [], table: [],
    attacker, defender: 0, actor: attacker, phase: 'lead', taking: false, passes: 0, cap: 5, first: true,
    out: new Array(n).fill(false), finished: [], loser: -1, over: false, bout: 1,
    known: hands.map(() => []), refused: [],
  };
  g.defender = nextActive(g, attacker);
  g.cap = Math.min(5, g.hands[g.defender].length);
  return g;
}

export const clone = (g) => ({
  ...g,
  hands: g.hands.map((h) => h.slice()), stock: g.stock.slice(), discard: g.discard.slice(),
  table: g.table.map((t) => ({ a: t.a, d: t.d })), out: g.out.slice(), finished: g.finished.slice(),
  known: g.known.map((k) => k.slice()), refused: g.refused.slice(),
});

// Attackers in throw-in order: from the current primary attacker clockwise, skipping the defender and finished players.
export function attackersOf(g) {
  const list = [];
  for (let k = 0; k < g.n; k++) { const s = (g.attacker + k) % g.n; if (s !== g.defender && !g.out[s]) list.push(s); }
  return list;
}

const ranksOnTable = (g) => { const r = new Set(); for (const t of g.table) { r.add(rankOf(t.a)); if (t.d >= 0) r.add(rankOf(t.d)); } return r; };

export function canTransfer(g) {
  if (g.mode !== 'per' || g.phase !== 'defend' || g.taking || !g.table.length) return false;
  if (g.table.some((t) => t.d >= 0)) return false;
  if (g.table.length + 1 > g.cap) return false;
  const nd = nextActive(g, g.defender);
  return nd >= 0 && nd !== g.defender && g.hands[nd].length >= g.table.length + 1;
}

export function legalMoves(g) {
  if (g.over) return [];
  const p = g.actor, hand = g.hands[p], out = [];
  if (g.phase === 'lead') { for (const c of hand) out.push({ t: 'atk', c }); return out; }
  if (g.phase === 'defend') {
    g.table.forEach((t, i) => { if (t.d < 0) for (const c of hand) if (beats(t.a, c, g.trump)) out.push({ t: 'def', c, i }); });
    if (canTransfer(g)) { const r = rankOf(g.table[0].a); for (const c of hand) if (rankOf(c) === r) out.push({ t: 'xfer', c }); }
    out.push({ t: 'take' });
    return out;
  }
  // throw-in phase
  if (g.table.length < g.cap) { const r = ranksOnTable(g); for (const c of hand) if (r.has(rankOf(c))) out.push({ t: 'atk', c }); }
  out.push({ t: 'pass' });
  return out;
}

// Explains why an action is refused, or returns '' when it is legal. move = {t, c, i}.
export function whyNot(g, move) {
  const p = g.actor;
  if (g.over) return 'The game is over.';
  if (move.t === 'atk') {
    if (g.phase === 'defend') return 'It is the defender\'s turn to answer.';
    if (g.phase === 'lead') return '';
    if (g.table.length >= g.cap) return `The table is full: at most ${g.cap} attacking cards this round.`;
    if (!ranksOnTable(g).has(rankOf(move.c))) return 'You can only throw in a rank that is already on the table.';
    return '';
  }
  if (move.t === 'def') {
    const t = g.table[move.i];
    if (!t || t.d >= 0) return 'That card is already beaten.';
    if (beats(t.a, move.c, g.trump)) return '';
    const sa = suitOf(t.a);
    if (suitOf(move.c) === sa) return `A ${RANK_LABELS[rankOf(move.c)]} is too low: you need a higher ${SUIT_NAMES[sa].slice(0, -1)}.`.replace('spade.', 'spade.');
    if (sa === g.trump) return 'A trump can only be beaten by a higher trump.';
    return `Beat it with a higher ${SUIT_NAMES[sa]} card or any trump (${SUIT_NAMES[g.trump]}).`;
  }
  if (move.t === 'xfer') {
    if (g.mode !== 'per') return 'Transfer is only allowed in Perevodnoy.';
    if (!canTransfer(g)) return 'You cannot transfer now: the next player needs enough cards, and nothing may be beaten yet.';
    if (rankOf(move.c) !== rankOf(g.table[0].a)) return 'To transfer, play a card of the same rank as the attack.';
    return '';
  }
  return p >= 0 ? '' : '';
}

// Applies a move to g IN PLACE (clone first when searching). Returns an event list for animation:
// {k:'play',p,c,i} attack card, {k:'beat',p,c,i}, {k:'xfer',p,c,to}, {k:'take',p,n}, {k:'bito',n}, {k:'pass',p}, {k:'draw',p,n}
export function apply(g, move) {
  const ev = [];
  const p = g.actor;
  const removeFrom = (seat, c) => {
    const h = g.hands[seat]; const i = h.indexOf(c); h.splice(i, 1);
    const k = g.known[seat].indexOf(c); if (k >= 0) g.known[seat].splice(k, 1);
  };
  if (move.t === 'atk') {
    removeFrom(p, move.c); g.table.push({ a: move.c, d: -1 }); ev.push({ k: 'play', p, c: move.c, i: g.table.length - 1 });
    if (g.phase === 'throw' && g.taking) { g.passes = 0; if (g.table.length >= g.cap) return finish(g, ev, true); }
    else { g.phase = 'defend'; g.actor = g.defender; g.passes = 0; }
  } else if (move.t === 'def') {
    removeFrom(p, move.c); g.table[move.i].d = move.c; ev.push({ k: 'beat', p, c: move.c, i: move.i });
    if (g.table.every((t) => t.d >= 0)) {
      if (!g.hands[g.defender].length || g.table.length >= g.cap) return finish(g, ev, false);
      g.phase = 'throw'; g.actor = g.attacker; g.passes = 0;
    }
  } else if (move.t === 'xfer') {
    const nd = nextActive(g, g.defender);
    removeFrom(p, move.c); g.table.push({ a: move.c, d: -1 });
    ev.push({ k: 'xfer', p, c: move.c, i: g.table.length - 1, to: nd });
    g.attacker = g.defender; g.defender = nd; g.actor = nd; g.phase = 'defend'; g.cap = Math.min(g.cap, g.hands[nd].length);
  } else if (move.t === 'take') {
    g.taking = true; g.phase = 'throw'; g.actor = g.attacker; g.passes = 0; ev.push({ k: 'takes', p });
    g.refused.push({ p, a: g.table.find((t) => t.d < 0)?.a ?? -1 });
    if (g.table.length >= g.cap) return finish(g, ev, true);
  } else if (move.t === 'pass') {
    ev.push({ k: 'pass', p });
    g.passes += 1;
    const list = attackersOf(g);
    if (g.passes >= list.length) return finish(g, ev, g.taking);
    g.actor = list[(list.indexOf(p) + 1) % list.length];
  }
  return settle(g, ev);
}

// A throw-in turn with nothing to throw is passed automatically.
function settle(g, ev) {
  let guard = 12;
  while (!g.over && g.phase === 'throw' && guard-- > 0) {
    const m = legalMoves(g);
    if (m.length > 1) break;
    const list = attackersOf(g);
    g.passes += 1;
    if (g.passes >= list.length) return finish(g, ev, g.taking);
    g.actor = list[(list.indexOf(g.actor) + 1) % list.length];
  }
  return ev;
}

function finish(g, ev, taken) {
  const d = g.defender;
  const cards = [];
  for (const t of g.table) { cards.push(t.a); if (t.d >= 0) cards.push(t.d); }
  if (taken) { for (const c of cards) { g.hands[d].push(c); g.known[d].push(c); } ev.push({ k: 'take', p: d, n: cards.length, cards }); }
  else { for (const c of cards) g.discard.push(c); ev.push({ k: 'bito', n: cards.length, cards }); }
  g.table = [];
  const order = attackersOf(g); order.push(d);
  for (const s of order) {
    let n = 0;
    while (g.hands[s].length < FULL_HAND && g.stock.length) {
      const c = g.stock.pop(); g.hands[s].push(c); n++;
      if (c === g.trumpCard) g.known[s].push(c);
    }
    if (n) ev.push({ k: 'draw', p: s, n });
    g.hands[s] = sortHand(g.hands[s], g.trump);
  }
  for (let s = 0; s < g.n; s++) if (!g.out[s] && !g.hands[s].length && !g.stock.length) { g.out[s] = true; g.finished.push(s); ev.push({ k: 'out', p: s }); }
  const alive = [];
  for (let s = 0; s < g.n; s++) if (!g.out[s]) alive.push(s);
  if (alive.length <= 1) { g.over = true; g.loser = alive.length ? alive[0] : -1; g.actor = -1; g.phase = 'over'; ev.push({ k: 'over', loser: g.loser }); return ev; }
  g.attacker = taken || g.out[d] ? nextActive(g, d) : d;
  g.defender = nextActive(g, g.attacker);
  g.actor = g.attacker; g.phase = 'lead'; g.taking = false; g.passes = 0; g.first = false; g.bout += 1;
  g.cap = Math.min(FULL_HAND, g.hands[g.defender].length);
  return ev;
}

export const otherCards = (g) => {
  // Cards not visible to seat p: everything that is not its hand, the discard, the table or the exposed trump card.
  const seen = new Set(g.discard); for (const t of g.table) { seen.add(t.a); if (t.d >= 0) seen.add(t.d); }
  return seen;
};
