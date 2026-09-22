// Eight hands-on lessons. Each one sets up a small, fixed situation (a few cards each), tells the player what to do
// with the exact controls, and watches the real table events. check(ev, tb) returns 'ok' (lesson done), 'retry'
// (with tb.lessonMsg explaining what went wrong) or undefined (keep going).
import { newHand, playCard, cardName, suitOf } from './rules.js';

const SUITS = { S: 0, H: 1, D: 2, C: 3 }, RANKS = { 2: 0, 3: 1, 4: 2, 5: 3, 6: 4, 7: 5, 8: 6, 9: 7, 10: 8, J: 9, Q: 10, K: 11, A: 12 };
export const K = (code) => SUITS[code[0]] * 13 + RANKS[code.slice(1)];
const hands4 = (a) => a.map((h) => h.map(K));

// The 39 cards you do not hold go to the other seats in a fixed scrambled order (deterministic, no randomness needed).
function fillTo13(mine) {
  const used = new Set(mine), rest = [];
  for (let c = 0; c < 52; c++) if (!used.has(c)) rest.push(c);
  const order = rest.map((c, i) => [(i * 17) % 39, c]).sort((x, y) => x[0] - y[0]).map((x) => x[1]);
  return [mine, order.slice(0, 13), order.slice(13, 26), order.slice(26, 39)];
}
const MINE13 = ['SA', 'SK', 'SQ', 'S9', 'S6', 'S3', 'HA', 'H5', 'DK', 'D7', 'CA', 'C4', 'C2'].map(K);

function playSetup({ hands, trump, leader, declarer = 0, contract = 7, pre = [] }) {
  const H = newHand(hands4(hands), 3);
  H.phase = 'play'; H.trump = SUITS[trump]; H.declarer = declarer; H.contract = contract; H.leader = leader; H.turn = leader;
  for (const [p, code] of pre) { H.turn = p; playCard(H, K(code)); }
  return H;
}
const wonBy0 = (ev) => ev.t === 'trick' && ev.winner % 2 === 0;

export const LESSONS = [
  {
    title: 'Follow the suit', text: 'West led the 9 of spades. If you hold a card of the suit that was led, you must play one. TAP a card to lift it, then TAP it again (or DRAG it up onto the table) to play. Try a heart first and read why it is refused.',
    setup: () => playSetup({ trump: 'H', leader: 3, pre: [[3, 'S9']], hands: [['S4', 'SK', 'H3', 'C7'], ['S3', 'D9', 'C9', 'H4'], ['SQ', 'D2', 'C4', 'H5'], ['S9', 'D5', 'C2', 'H2']] }),
    check: (ev) => (ev.t === 'play' && ev.p === 0 ? (suitOf(ev.c) === 0 ? undefined : 'retry') : ev.t === 'trick' ? 'ok' : undefined),
  },
  {
    title: 'Win the trick', text: 'The highest card of the suit led wins the trick. West led the 9 of diamonds. TAP the diamond that beats it, then TAP it again to play.',
    setup: () => playSetup({ trump: 'C', leader: 3, pre: [[3, 'D9']], hands: [['DK', 'D4', 'S5', 'H6'], ['D3', 'S8', 'H9', 'HJ'], ['D2', 'S3', 'H2', 'H3'], ['D9', 'S2', 'H4', 'H5']] }),
    check: (ev, tb) => { if (ev.t !== 'trick') return undefined; if (wonBy0(ev)) return 'ok'; tb.lessonMsg = 'That trick went to the other side: the 4 does not beat the 9. Only the king does. Try again.'; return 'retry'; },
  },
  {
    title: 'Trump beats everything', text: 'Hearts are trump. West led a club and East will beat it, but you have no clubs, so you may play ANY card. A trump beats every card of another suit. TAP your trump, then TAP it again.',
    setup: () => playSetup({ trump: 'H', leader: 3, pre: [[3, 'C8']], hands: [['H3', 'D2', 'D4', 'S6'], ['CQ', 'D6', 'D8', 'S3'], ['C2', 'D5', 'S2', 'D3'], ['C8', 'S4', 'S5', 'D7']] }),
    check: (ev, tb) => { if (ev.t !== 'trick') return undefined; if (wonBy0(ev)) return 'ok'; tb.lessonMsg = 'A queen of clubs beats a small club, but a trump beats any club. Play your heart to win the trick. Try again.'; return 'retry'; },
  },
  {
    title: 'Your partner is winning', text: 'Your partner (North) is winning this trick with the ace of diamonds. You play last. Do not waste your king: play your LOWEST diamond. TAP it, then TAP it again.',
    setup: () => playSetup({ trump: 'S', leader: 1, pre: [[1, 'D3']], hands: [['DK', 'D6', 'C2', 'C8'], ['D3', 'C9', 'H8', 'H9'], ['DA', 'D9', 'C4', 'H2'], ['D5', 'D2', 'C5', 'H3']] }),
    check: (ev, tb) => { if (ev.t === 'play' && ev.p === 0) { if (ev.c === K('D6')) return undefined; tb.lessonMsg = 'Your partner already had the trick with the ace. The king could win a trick later. Keep it, and play the 6. Try again.'; return 'retry'; } if (ev.t === 'trick') return wonBy0(ev) ? 'ok' : undefined; return undefined; },
  },
  {
    title: 'Making a bid', text: 'Before play, everyone bids how many of the 13 tricks their side will take (7 or more). You have six strong spades and two aces. TAP a bid number. Watch how the others answer.',
    setup: () => newHand(fillTo13(MINE13), 3),
    check: (ev, tb) => { if (ev.t !== 'bid' || ev.p !== 0) return undefined; if (ev.n >= 7) return 'ok'; tb.lessonMsg = 'With six spades and two aces you should bid: your side very likely takes 7 or more tricks. Try again.'; return 'retry'; },
  },
  {
    title: 'Naming trump', text: 'You won the bid, so YOU name trump. Choose your longest, strongest suit. TAP the suit you want as trump.',
    setup: () => { const H = newHand(fillTo13(MINE13), 3); H.phase = 'trump'; H.declarer = 0; H.contract = 8; H.bid.by = 0; H.bid.high = 8; H.bid.turn = 0; return H; },
    check: (ev, tb) => { if (ev.t !== 'trump') return undefined; if (ev.s === 0) return 'ok'; tb.lessonMsg = 'Spades is your long suit: six cards including the ace, king and queen. Trump should be the suit you hold most of. Try again.'; return 'retry'; },
  },
  {
    title: 'Draw their trumps', text: 'Spades are trump and you lead. If you lead a side ace, an opponent with no cards of that suit can trump it. Lead trump first to draw their trumps out. TAP the ace of spades, then TAP it again.',
    setup: () => playSetup({ trump: 'S', leader: 0, hands: [['SA', 'SK', 'HA', 'H7', 'D2'], ['S3', 'S5', 'D8', 'D9', 'C9'], ['H5', 'H6', 'C3', 'C4', 'C5'], ['H2', 'SQ', 'SJ', 'D7', 'C6']] }),
    check: (ev, tb) => { if (ev.t !== 'trick') return undefined; if (wonBy0(ev) && ev.cards[0].c === K('SA')) return 'ok'; if (ev.cards[0].c !== K('SA')) tb.lessonMsg = 'East had no hearts and trumped your ace. Lead the ace of spades first, drawing the opponents\' trumps out. Try again.'; else tb.lessonMsg = 'Try again.'; return 'retry'; },
  },
  {
    title: 'Your first full hand', text: 'A real deal, start to finish. Coaching is on: every turn explains a good choice. Bid, name trump if you win, and play all 13 tricks with your partner. Your side scores the tricks it takes if it makes its bid, and LOSES its bid if it falls short.',
    setup: null,   // a real random deal, made by the game
    check: (ev) => (ev.t === 'hand' ? 'ok' : undefined),
  },
];
export const lessonCard = cardName;
