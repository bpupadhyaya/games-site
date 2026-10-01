// Truco Brasileiro: the rules engine. Pure functions over a plain-object hand `H` (JSON-serializable).
// Nothing here draws or reads input. game.js is the only file that decides WHEN these run.
//
// Cards are numbers 0..39:  suit * 10 + rank.  Rank index 0..9 is the base strength order of the
// 40-card Brazilian deck (8, 9, 10 removed):  4 5 6 7 Q J K A 2 3  (3 is the strongest plain card).
// Suit ids rise with manilha strength:  0 Diamonds < 1 Spades < 2 Hearts < 3 Clubs.

export const RANKS = ['4', '5', '6', '7', 'Q', 'J', 'K', 'A', '2', '3'];
export const SUIT_NAMES = ['Diamonds', 'Spades', 'Hearts', 'Clubs'];
export const SUIT_SYM = ['♦', '♠', '♥', '♣'];
export const MAN_NAMES = ['Pica-fumo', 'Espadilha', 'Copas', 'Zap']; // manilha name by suit id (Diamonds..Clubs)
export const TARGET = 12;
export const card = (suit, rank) => suit * 10 + rank;
export const suitOf = (c) => Math.floor(c / 10);
export const rankOf = (c) => c % 10;
export const cardShort = (c) => RANKS[rankOf(c)] + SUIT_SYM[suitOf(c)];
export const isRedSuit = (s) => s === 0 || s === 2;

// ---- the two dialects -------------------------------------------------------------------------------------
// vals[i] = what the hand is worth once stake level i is accepted. Level 0 is the opening value.
export const VARIANTS = {
  paulista: {
    id: 'paulista', name: 'Paulista', vals: [1, 3, 6, 9, 12], shouts: ['', 'Truco', 'Seis', 'Nove', 'Doze'],
    special: 11, specialVal: 3, specialRun: 1, specialName: 'Mão de Onze', turned: true, tieAll: 'void',
  },
  mineiro: {
    id: 'mineiro', name: 'Mineiro', vals: [2, 4, 8, 10, 12], shouts: ['', 'Truco', 'Seis', 'Nove', 'Jogo'],
    special: 10, specialVal: 4, specialRun: 2, specialName: 'Mão de Dez', turned: false, tieAll: 'mao',
  },
};

// ---- seats ---------------------------------------------------------------------------------------------------
// 4 players: seats 0 you, 1 right, 2 partner, 3 left. Teams are seat % 2.  2 players: seats 0 you, 1 opponent.
export const teamsFor = (n) => (n === 4 ? [0, 1, 0, 1] : [0, 1]);
export const posOf = (n, seat) => (n === 4 ? seat : seat === 0 ? 0 : 2); // where a seat sits at the table
export const partnerOf = (n, seat) => (n === 4 ? (seat + 2) % 4 : -1);

// ---- power -----------------------------------------------------------------------------------------------------
export function manilhaRankFor(variant, vira) { return variant === 'paulista' ? (rankOf(vira) + 1) % 10 : -1; }
export function buildPower(variant, manRank) {
  const pw = new Array(40);
  for (let c = 0; c < 40; c++) {
    const r = rankOf(c), s = suitOf(c);
    if (variant === 'paulista') pw[c] = r === manRank ? 100 + s : r;
    else pw[c] = c === card(3, 0) ? 103 : c === card(2, 3) ? 102 : c === card(1, 7) ? 101 : c === card(0, 3) ? 100 : r;
  }
  return pw;
}
export const isManilha = (H, c) => H.pow[c] >= 100;
export const zapOf = (H) => (H.variant === 'paulista' ? card(3, H.manRank) : card(3, 0));
// Mineiro fixed manilhas sorted strongest first: Zap (4 Clubs), Copas (7 Hearts), Espadilha (A Spades), Pica-fumo (7 Diamonds)
export const MINEIRO_MANILHAS = [card(3, 0), card(2, 3), card(1, 7), card(0, 3)];
export function manilhaCards(H) {
  if (H.variant === 'mineiro') return MINEIRO_MANILHAS.slice();
  return [3, 2, 1, 0].map((s) => card(s, H.manRank));
}
export function manilhaName(H, c) {
  const i = manilhaCards(H).indexOf(c); if (i < 0) return null;
  return ['Zap', 'Copas', 'Espadilha', 'Pica-fumo'][i];
}
export function cardName(H, c) { const m = H && H.pow && H.pow[c] >= 100 ? manilhaName(H, c) : null; return m ? `${m} (${cardShort(c)})` : cardShort(c); }

// ---- a new hand ---------------------------------------------------------------------------------------------------
export function specialFor(variant, scores) {
  const sp = VARIANTS[variant].special, a = scores[0] >= sp, b = scores[1] >= sp;
  if (a && b) return { kind: 'iron', team: -1 };
  if (a) return { kind: 'eleven', team: 0 };
  if (b) return { kind: 'eleven', team: 1 };
  return { kind: null, team: -1 };
}
export function newHand(rng, { variant, n, scores, dealer }) {
  const V = VARIANTS[variant];
  const deck = rng.shuffle(Array.from({ length: 40 }, (_, i) => i));
  const hands = Array.from({ length: n }, () => []);
  let k = 0;
  for (let r = 0; r < 3; r++) for (let s = 0; s < n; s++) hands[s].push(deck[k++]);
  const vira = V.turned ? deck[k++] : -1;
  const manRank = manilhaRankFor(variant, vira);
  const pow = buildPower(variant, manRank);
  for (const h of hands) h.sort((x, y) => pow[x] - pow[y] || x - y);
  const sp = specialFor(variant, scores);
  const lead = (dealer + 1) % n;
  const H = {
    variant, n, teamOf: teamsFor(n), scoresAtDeal: scores.slice(), dealer, lead0: lead, leader: lead, turn: lead,
    hands, vira, manRank, pow, plays: [], tricks: [], stakeIdx: 0, owner: -1, pending: null,
    special: sp.kind, specialTeam: sp.team, consulted: [false, false], phase: 'play', result: null,
    signals: Array.from({ length: n }, () => null), noticed: Array.from({ length: n }, () => []), signalled: Array.from({ length: n }, () => false),
    started: Array.from({ length: n }, () => false), raisedBy: [], bluffs: [], origHands: hands.map((h) => h.slice()),
  };
  if (sp.kind === 'eleven') H.phase = 'special';
  return H;
}

export const value = (H) => (H.special === 'eleven' ? VARIANTS[H.variant].specialVal : VARIANTS[H.variant].vals[H.stakeIdx]);
export const noRaise = (H) => H.special !== null;
export const shoutName = (H, idx) => VARIANTS[H.variant].shouts[idx];
export const nextSeat = (H, s) => (s + 1) % H.n;
export const teamOfSeat = (H, s) => H.teamOf[s];

// ---- stakes -----------------------------------------------------------------------------------------------------------
// Only the team that did NOT make the last raise may raise; nobody may raise during a special hand.
export function canRaise(H, seat) {
  if (H.phase !== 'play' || H.pending || noRaise(H) || H.turn !== seat) return false;
  if (H.stakeIdx >= 4) return false;
  const t = H.teamOf[seat];
  return H.owner === -1 || H.owner === t;
}
export function callRaise(H, seat) {
  const idx = H.stakeIdx + 1;
  H.pending = { team: H.teamOf[seat], idx, seat };
  H.phase = 'raise'; H.raisedBy.push({ seat, idx });
  return idx;
}
export const answerTeam = (H) => (H.pending ? 1 - H.pending.team : -1);
export function canReraise(H) { return !!H.pending && H.pending.idx < 4; }
// kind: 'accept' | 'fold' | 'raise'. Returns { done?, idx }
export function answerRaise(H, kind) {
  const P = H.pending, V = VARIANTS[H.variant];
  if (kind === 'accept') { H.stakeIdx = P.idx; H.owner = 1 - P.team; H.pending = null; H.phase = 'play'; return { accepted: true, idx: P.idx }; }
  if (kind === 'fold') { const pts = V.vals[P.idx - 1]; H.pending = null; finish(H, P.team, pts, 'run'); return { folded: true, idx: P.idx, pts }; }
  // raise: the answering team raises one more step
  const t = 1 - P.team;
  const seat = H.answerSeat ?? -1;
  H.pending = { team: t, idx: P.idx + 1, seat }; H.raisedBy.push({ seat, idx: P.idx + 1 });
  return { raised: true, idx: P.idx + 1 };
}
// The team in a special hand decides to play (true) or run (false).
export function answerSpecial(H, play) {
  const V = VARIANTS[H.variant];
  if (play) { H.phase = 'play'; H.consulted[H.specialTeam] = true; return { play: true }; }
  finish(H, 1 - H.specialTeam, V.specialRun, 'run'); return { play: false };
}

// ---- tricks ---------------------------------------------------------------------------------------------------------------
// plays: [{seat, card}] in play order. Highest power wins. Equal top power from opposing teams is a tie (-1).
export function trickWinner(pw, teamOf, plays) {
  let best = -1, seat = -1, tie = false;
  for (const p of plays) {
    const w = pw[p.card];
    if (w > best) { best = w; seat = p.seat; tie = false; }
    else if (w === best && teamOf[p.seat] !== teamOf[seat]) tie = true;
  }
  return tie ? { seat: -1, team: -1 } : { seat, team: teamOf[seat] };
}
// results: list of team ids (or -1 tie) per trick played so far. Returns 0/1 winner, -1 void, null undecided.
export function decideHand(results, maoTeam, tieAll) {
  const r = results;
  if (r.length >= 2) {
    const w0 = r.filter((x) => x === 0).length, w1 = r.filter((x) => x === 1).length;
    if (w0 >= 2) return 0; if (w1 >= 2) return 1;
  }
  if (r.length === 2) {
    if (r[0] >= 0 && r[1] === -1) return r[0];
    if (r[0] === -1 && r[1] >= 0) return r[1];
    return null;
  }
  if (r.length === 3) {
    if (r[2] >= 0) return r[2];
    if (r[0] >= 0) return r[0];
    return tieAll === 'mao' ? maoTeam : -1;
  }
  return null;
}
export function playCard(H, c) {
  const seat = H.turn, hand = H.hands[seat], i = hand.indexOf(c);
  if (i < 0 || H.phase !== 'play') return null;
  hand.splice(i, 1); H.plays.push({ seat, card: c }); H.started[seat] = true;
  if (H.plays.length < H.n) { H.turn = nextSeat(H, seat); return { trick: false }; }
  const w = trickWinner(H.pow, H.teamOf, H.plays);
  const trick = { plays: H.plays.map((p) => ({ ...p })), winSeat: w.seat, winTeam: w.team, leader: H.leader };
  H.tricks.push(trick); H.plays = [];
  if (w.seat >= 0) H.leader = w.seat; // a tie keeps the same leader
  H.turn = H.leader;
  const V = VARIANTS[H.variant];
  const d = decideHand(H.tricks.map((t) => t.winTeam), H.teamOf[H.lead0], V.tieAll);
  if (d !== null) finish(H, d, d >= 0 ? value(H) : 0, d >= 0 ? 'tricks' : 'void');
  return { trick: true, winSeat: w.seat, winTeam: w.team, done: d !== null };
}
export function finish(H, winner, points, why) {
  H.phase = 'done'; H.result = { winner, points, why, tricks: H.tricks.map((t) => t.winTeam), stake: H.stakeIdx, special: H.special };
}
export function applyResult(scores, res) {
  const s = scores.slice();
  if (res.winner >= 0) s[res.winner] += res.points;
  return s;
}
export const matchWinner = (scores) => (scores[0] >= TARGET ? 0 : scores[1] >= TARGET ? 1 : -1);

// ---- gestures ---------------------------------------------------------------------------------------------------------------
// A signal names the CLASS of the sender's strongest card: zap, another manilha, a 3 or 2, or nothing above an Ace.
export const SIGNALS = [
  { id: 'zap', label: 'Zap', sub: 'wink', blurb: 'I hold the Zap, the top manilha.' },
  { id: 'manilha', label: 'Manilha', sub: 'raised brow', blurb: 'I hold a manilha, but not the Zap.' },
  { id: 'three', label: 'Three or Two', sub: 'pursed lips', blurb: 'My best card is a 3 or a 2.' },
  { id: 'nothing', label: 'Nothing', sub: 'shrug', blurb: 'Nothing above an Ace.' },
];
export function signalClass(H, cards) {
  const zap = zapOf(H);
  if (cards.includes(zap)) return 'zap';
  if (cards.some((c) => H.pow[c] >= 100)) return 'manilha';
  if (cards.some((c) => H.pow[c] >= 8)) return 'three';
  return 'nothing';
}
export function claimHolds(H, cards, kind) { return signalClass(H, cards) === kind; }
export const signalLabel = (id) => SIGNALS.find((s) => s.id === id)?.label ?? '';
