// Learn-to-play content as data. Each lesson is a small real position played with the real rules; the player performs
// each step by doing it. Step fields: text (instruction), want(action, H) -> bool, bad (why not), after (coaching once done).
// Actions: { kind: 'play', card } | { kind: 'bid', t, suit } | { kind: 'declare' } | { kind: 'refused', card }.
import { mk, suitOf, rankOf, newHand, handSort, points, teamOf, cardShort, trickWinnerIdx, newDeck } from './rules.js';

const SL = { S: 0, H: 1, D: 2, C: 3 }, RL = { 7: 0, 8: 1, 9: 2, 10: 3, J: 4, Q: 5, K: 6, A: 7 };
export const C = (s) => mk(SL[s.slice(-1)], RL[s.slice(0, -1)]);
const cs = (str) => str.split(' ').filter(Boolean).map(C);

// hands: 4 lists (any cards not listed are dealt out to hands that are short, avoiding `avoid[seat]` suits when possible)
function fill(spec, avoid = {}) {
  const used = new Set(spec.flat()), rest = newDeck().filter((c) => !used.has(c));
  const hands = spec.map((h) => h.slice());
  for (let seat = 0; seat < 4; seat++) {
    while (hands[seat].length < 8) {
      let i = rest.findIndex((c) => !(avoid[seat] || []).includes(suitOf(c)));
      if (i < 0) i = 0;
      hands[seat].push(rest.splice(i, 1)[0]);
    }
  }
  return hands;
}

// A hand in play: `trick` = [[seat, card], ...] already on the table (removed from the hands here).
export function playHand({ type, trump = -1, buyer = 0, hands, lead, trick = [], mult = 1, scores = [0, 0] }) {
  const H = newHand({ shuffle: (a) => a }, (lead + 3) & 3, scores);
  H.contract = { type, trump, buyer, round: 1 }; H.phase = 'play'; H.mult = mult; H.dbl = null;
  H.hands = hands.map((h) => handSort(H.contract, h));
  H.trick = []; H.leader = lead; H.turn = lead;
  for (const [seat, card] of trick) { H.hands[seat] = H.hands[seat].filter((c) => c !== card); H.trick.push({ seat, card }); H.turn = (seat + 1) & 3; }
  const inHands = new Set(H.hands.flat());
  H.played = newDeck().filter((c) => !inHands.has(c));
  const n = H.hands[lead].length + (trick.length && trick[0][0] === lead ? 1 : 0);
  H.tricks = 8 - n; H.leader0 = lead; H.rest = []; H.floor = -1;
  H.playedBy = {};
  return H;
}
// A bidding position: you (seat 0) bid first. `mine` = your five cards.
export function bidHand({ mine, floor }) {
  const rest = newDeck().filter((c) => !mine.includes(c) && c !== floor);
  const H = newHand({ shuffle: (a) => a }, 3, [0, 0], [...mine, ...rest.slice(0, 15), floor, ...rest.slice(15)]);
  // newHand deals cards 0..19 round-robin from seat dealer+1 = 0, so seat 0 gets indexes 0,4,8,... : rebuild explicitly
  H.hands = [mine.slice(), rest.slice(0, 5), rest.slice(5, 10), rest.slice(10, 15)]; H.floor = floor; H.rest = rest.slice(15);
  return H;
}

const yes = () => true;
export const LESSONS = [
  {
    title: 'Your first trick', blurb: 'Seats, teams and how to play a card',
    intro: 'Four players, two teams: you and North (your partner) against East and West. Play goes around counter-clockwise: you, East, North, West.',
    make: () => playHand({ type: 'sun', buyer: 0, lead: 0, hands: fill([cs('AS 10S KH QH 9D 8D 7C JC'), [], [], []]) }),
    steps: [
      { text: 'TAP the Ace of spades to raise it, then TAP it again to play it. (You can also DRAG it up.)', want: (a) => a.kind === 'play' && a.card === C('AS'), bad: 'Not that card: play the Ace of spades, the highest card of its suit.', after: 'Everyone followed suit and the Ace took the trick. The Ace is the highest card in every suit.' },
      { text: 'You won, so you lead again. TAP the 10 of spades twice: it is now the highest spade left.', want: (a) => a.kind === 'play' && a.card === C('10S'), bad: 'Play the 10 of spades: with the Ace gone it is the top spade.', after: 'In Sun the order is A, 10, K, Q, J, 9, 8, 7. The 10 is second only to the Ace.' },
    ],
  },
  {
    title: 'Follow suit', blurb: 'The first rule of every trick',
    intro: 'If you hold a card of the suit that was led, you must play one. A refused card is explained.',
    make: () => playHand({ type: 'sun', buyer: 1, lead: 1, trick: [[1, C('9H')], [2, C('7H')], [3, C('8H')]], hands: fill([cs('10H KS QS 9S 8C 7C JD 9D'), cs('9H AS JS 10D QD 8D KC QC'), cs('7H AH KH JH KD AD 10C AC'), cs('8H 7S 8S 7D 9C JC 10S QH')]) }),
    steps: [
      { text: 'East led a heart. TAP the King of spades to see what happens. (It will be refused and explained.)', kind: 'refused', want: (a) => a.kind === 'refused', bad: 'Try TAPPING the King of spades: it cannot be played and the game will say why.', after: 'You hold a heart, so you must play a heart. Cards you cannot play are dimmed.' },
      { text: 'Now TAP the 10 of hearts twice to play it. It is a legal card and the highest heart.', want: (a) => a.kind === 'play' && a.card === C('10H'), bad: 'Play the 10 of hearts: it is your only heart.', after: 'The 10 beats the 9, 8 and 7 and takes the trick: 10 points for your team.' },
    ],
  },
  {
    title: 'Sun: card strength and points', blurb: 'The 10 beats the King',
    intro: 'In Sun there is no trump. Ace 11, Ten 10, King 4, Queen 3, Jack 2 points; 9, 8 and 7 are worth nothing. Winning the last trick adds 10.',
    make: () => playHand({ type: 'sun', buyer: 1, lead: 1, trick: [[1, C('KD')], [2, C('7D')], [3, C('JD')]], hands: fill([cs('10D 9D AS QS 8C 7C KH 9S'), cs('KD 10S JS 8S QC KC 9H 8H'), cs('7D AC 10C JC 7S 8D QD 10H'), cs('JD AD QH JH 7H AH 9C 7C'.replace(' 7C', ''))]) }),
    steps: [
      { text: 'East led the King of diamonds. Beat it: TAP your 10 of diamonds twice.', want: (a) => a.kind === 'play' && a.card === C('10D'), bad: 'Play the 10 of diamonds: in Sun it is higher than the King.', after: 'The 10 outranks the King in Sun. You collected 4 + 0 + 2 + 10 = 16 points.' },
    ],
  },
  {
    title: 'Hokum: trump cuts', blurb: 'No card of the suit? A trump wins',
    intro: 'In Hokum one suit is trump: any trump beats any other suit. If you cannot follow suit and an opponent is winning, you must cut with a trump.',
    make: () => playHand({ type: 'hokum', trump: 3, buyer: 0, lead: 1, trick: [[1, C('AH')], [2, C('7H')], [3, C('8H')]], hands: fill([cs('JC 9C 7C 8S KS 10S QD 9D'), cs('AH 10H KD 7S 9S QS 8D AD'), cs('7H KH QH 10D JD JS AS 9H'), cs('8H JH 8C 10C AC QC KC 7D')], { 0: [1] }) }),
    steps: [
      { text: 'Clubs are trump. You have no hearts, and East is winning: you MUST cut. TAP your 7 of clubs twice (the cheapest trump).', want: (a) => a.kind === 'play' && suitOf(a.card) === 3, bad: 'You must cut with a trump: pick a club (the 7 is the cheapest).', after: 'Any trump beats the Ace of hearts. You took 11 points by cutting with your cheapest trump.' },
      { text: 'You lead now. TAP the Jack of clubs: in trump the Jack is the highest card in the game.', want: (a) => a.kind === 'play' && a.card === C('JC'), bad: 'Lead the Jack of clubs, the boss trump.', after: 'The trump order is J, 9, A, 10, K, Q, 8, 7. The Jack is worth 20 points and the 9 is worth 14.' },
    ],
  },
  {
    title: 'Trump: go higher', blurb: 'When trump is led you must beat it',
    intro: 'If a trump is led and you hold a higher trump, you must play one.',
    make: () => playHand({ type: 'hokum', trump: 2, buyer: 2, lead: 2, trick: [[2, C('10D')], [3, C('8D')]], hands: fill([cs('JD 9D 7D AS KS 8C QH 9H'), cs('QD KD 7S 8S JC AC 10H KH'), cs('10D AD 7C 9C QC KC 10S JS'), cs('8D 7H 8H AH JH 9S QS 10C')]) }),
    steps: [
      { text: 'North led the 10 of diamonds (trump). TAP your 7 of diamonds to see it refused.', want: (a) => a.kind === 'refused', bad: 'Try TAPPING the 7 of diamonds.', after: 'You hold trumps higher than the 10 (the 9 and the Jack), so a lower one is not allowed.' },
      { text: 'TAP your 9 of diamonds twice. It is legal and it beats the 10.', want: (a) => a.kind === 'play' && (a.card === C('9D') || a.card === C('JD')), bad: 'Play the 9 or the Jack of diamonds: they both beat the 10.', after: 'In trump the 9 (14 points) ranks above the Ace and the 10. Keep the Jack for later.' },
    ],
  },
  {
    title: 'Helping your partner', blurb: 'Feed points to a winning partner',
    intro: 'A trick won by your partner counts for you. When your partner is winning, you are not forced to win: give points instead.',
    make: () => playHand({ type: 'sun', buyer: 0, lead: 2, trick: [[2, C('AD')], [3, C('8D')]], hands: fill([cs('10D KD 7D AS QS 9C 8C 7C'), cs('9D JD QD 10S 9S 8S KC JC'), cs('AD 7H 8H 9H JS KS AC 10C'), cs('8D 10H JH QH KH AH QC 7S')]) }),
    steps: [
      { text: 'Your partner North leads the Ace of diamonds and nobody can beat it. TAP the 10 of diamonds twice: 10 points for your side.', want: (a) => a.kind === 'play' && (a.card === C('10D') || a.card === C('KD')), bad: 'North is winning: play a card with points. The 7 is worth nothing.', after: 'That is a "smear": adding points to your partner\'s winning trick. Low cards go when the opponents win.' },
    ],
  },
  {
    title: 'Bidding: Hokum', blurb: 'The turned-up card and your first decision',
    intro: 'One card is turned face up. In the first round you may buy it as Hokum (its suit is trump), say Sun, or Pass. The buyer takes the card.',
    make: () => bidHand({ mine: cs('9H AH KH 7C 8S'), floor: C('JH') }),
    steps: [
      { text: 'The turned-up card is the Jack of hearts. With the 9, Ace and King of hearts you would hold the top trumps. TAP Hokum.', want: (a) => a.kind === 'bid' && a.t === 'hokum', bad: (a) => (a.t === 'sun' ? 'Sun has no trump, so the Jack and 9 of hearts would lose their power. Take Hokum.' : 'This hand is far too good to pass: Jack + 9 + Ace + King of hearts. Take Hokum.'), after: 'Good bid. Jack (20) and 9 (14) of trump are the two highest cards; you also hold the King and Queen chance for Baloot.' },
    ],
  },
  {
    title: 'Bidding: Sun', blurb: 'Aces and tens everywhere',
    intro: 'Sun scores double and has no trump, so it needs high cards in several suits. Sun outranks Hokum: if someone says Sun, it takes over.',
    make: () => bidHand({ mine: cs('AS 10S AD KD AC'), floor: C('7H') }),
    steps: [
      { text: 'You hold three Aces and the tens and kings behind them. The turned-up 7 of hearts is weak. TAP Sun.', want: (a) => a.kind === 'bid' && a.t === 'sun', bad: (a) => (a.t === 'pass' ? 'Do not pass: three aces with backing cards win tricks without any trump.' : 'A hearts trump would help nobody here: your strength is aces in three suits. Say Sun.'), after: 'Sun is worth 26 points a hand against 16 in Hokum. It needs a strong, balanced hand like this.' },
    ],
  },
  {
    title: 'Declarations', blurb: 'Sira, Fifty, Hundred and Baloot',
    intro: 'Three cards in a row of the same suit are a Sira (2 points in Hokum, 4 in Sun); four are Fifty (5, 10); five are Hundred (10, 20). The King and Queen of trump together are Baloot (2). Declare in the first trick.',
    make: () => playHand({ type: 'hokum', trump: 3, buyer: 0, lead: 0, hands: fill([cs('JC KC QC 7D 8D 9D AS 10S'), cs('AH KH QH JH 9H 10H 7H 8H'), cs('AC 9C 10C 7C 8C KS QS JS'), cs('AD KD QD JD 10D 9S 8S 7S')], { 1: [3], 3: [3] }) }),
    steps: [
      { text: 'You hold 7, 8 and 9 of diamonds in a row: a Sira. TAP Declare in the panel below.', kind: 'declare', want: (a) => a.kind === 'declare', bad: 'TAP Declare to announce your Sira.', after: 'Announced. The team with the best declaration counts all of theirs; it is shown after the first trick.' },
      { text: 'Lead the Jack of clubs (trump) twice.', want: (a) => a.kind === 'play' && a.card === C('JC'), bad: 'Lead the Jack of clubs.', after: 'Won. Now play the King, then the Queen of trump.' },
      { text: 'Lead the King of clubs.', want: (a) => a.kind === 'play' && a.card === C('KC'), bad: 'Lead the King of clubs.', after: 'Now the Queen: playing the second of King and Queen of trump is Baloot.' },
      { text: 'Play the Queen of clubs: Baloot, worth 2 points.', want: (a) => a.kind === 'play' && a.card === C('QC'), bad: 'Play the Queen of clubs to complete Baloot.', after: 'Baloot! It is scored automatically when the second of the pair is played, and it always stays with the holder.' },
    ],
  },
  {
    title: 'Scoring a hand', blurb: 'Finish a hand and read the tally',
    intro: 'A hand is worth 162 card points in Hokum (152 + 10 for the last trick) and 130 in Sun. Rounded to game points: 16 or 26. The buyer must beat the other team or they take it all.',
    make: () => {
      const H = playHand({ type: 'hokum', trump: 1, buyer: 0, lead: 0, hands: [cs('JH KD'), cs('9H 7D'), cs('AH QC'), cs('10H 8D')] });
      const inHands = points; void inHands;
      // six tricks are already done: give the teams 58 and 46 card points from them
      H.tricks = 6; H.taken = [58, 46]; H.history = [0, 1, 0, 1, 0, 1].map((w) => ({ leader: 0, plays: [], winner: w }));
      return H;
    },
    steps: [
      { text: 'Two tricks are left and Hearts are trump. TAP the Jack of hearts twice: the highest trump.', want: (a) => a.kind === 'play' && a.card === C('JH'), bad: 'Lead the Jack of hearts.', after: 'The Jack takes 20 + 14 + 11 + 10 = 55 points.' },
      { text: 'Last trick: TAP the King of diamonds. Winning the last trick adds 10 points.', want: (a) => a.kind === 'play' && a.card === C('KD'), bad: 'Play the King of diamonds.', after: 'Now read the tally: each team\'s card points are rounded to game points, and the buyer needs more than the other side.' },
    ],
  },
];
void teamOf; void cardShort; void trickWinnerIdx; void rankOf; void yes;
