// Reference content for the About, Controls (How to Play) and Rules pages, kept factual and
// cross-checked against the real rule book in rules.js (the single source of truth) so these pages
// can never contradict the engine. Additive only: nothing here is read by the game logic itself,
// only by view.js's About/Controls/Rules scenes.
//
// Extended for the 300% text-size step: at 3x font size this game's fixed reference panel only
// holds a few words per line, so every topic below is now split across several single-sentence (or
// single-clause, for the few sentences too long to fit even alone) pages that all share the same
// title — continuing the same concept — rather than shrinking any font to force a fit. Page
// counts grew far more than the panel's original page count (24 Rules pages became a page-per-
// sentence-or-clause book); see STATUS.md "Decisions" for why, and for the Rules pages that needed
// the most splitting.
import { mk } from './rules.js';

// A generic suit (Spades) is used for every illustrative card, since none of these rules depend on
// which suit is involved.
const S = 0; // spades
const R7 = 0, R8 = 1, R9 = 2, R10 = 3, RJ = 4, RQ = 5, RK = 6, RA = 7;

export const ABOUT = [
  {
    title: 'A card game of the Gulf',
    lines: [
      'Baloot is a trick-taking card game for four players in two fixed partnerships,',
    ],
  },
  {
    title: 'A card game of the Gulf',
    lines: [
      'played across Saudi Arabia and the wider Arabian Peninsula.',
    ],
  },
  {
    title: 'A card game of the Gulf',
    lines: [
      'It is related to the French game Belote,',
    ],
  },
  {
    title: 'A card game of the Gulf',
    lines: [
      'brought to the region generations ago and',
    ],
  },
  {
    title: 'A card game of the Gulf',
    lines: [
      'now a card-table fixture of its own.',
    ],
  },
  {
    title: 'Two contracts',
    lines: [
      'Every hand is bid as one of two contracts:',
    ],
  },
  {
    title: 'Two contracts',
    lines: [
      'Sun, which has no trump suit at all, or Hokum, which names one suit as trump.',
    ],
  },
  {
    title: 'Two contracts',
    lines: [
      'In Hokum, the Jack and 9 of the trump suit jump all the way to the top of the pile.',
    ],
  },
  {
    title: 'Bonuses on top',
    lines: [
      'Beyond winning tricks, players can score declarations',
    ],
  },
  {
    title: 'Bonuses on top',
    lines: [
      'Sira, Fifty, Hundred and Four Hundred',
    ],
  },
  {
    title: 'Bonuses on top',
    lines: [
      'for runs and sets of matching cards.',
    ],
  },
  {
    title: 'Bonuses on top',
    lines: [
      'Holding the King and Queen of trump together is Baloot itself:',
    ],
  },
  {
    title: 'Bonuses on top',
    lines: [
      'a bonus worth 2 points.',
    ],
  },
  {
    title: 'Playing to a target',
    lines: [
      'A match is a race to a score chosen from the title screen, usually 152 game points.',
    ],
  },
  {
    title: 'Playing to a target',
    lines: [
      'This game follows the widely played Saudi ruleset.',
    ],
  },
  {
    title: 'Playing to a target',
    lines: [
      'House rules vary from table to table',
    ],
  },
  {
    title: 'Playing to a target',
    lines: [
      'this table\'s own choices are listed under Controls. Score only: no money is played for.',
    ],
  },
];

export const HOWTO = [
  {
    title: 'Controls',
    lines: [
      'TAP a card to raise it, TAP it again to play it. Or DRAG it upward.',
    ],
  },
  {
    title: 'Controls',
    lines: [
      'TAP a big button to bid, double or declare. Hint suggests a play and says why.',
    ],
  },
  {
    title: 'Controls',
    lines: [
      'Take back undoes your last play.',
    ],
  },
  {
    title: 'Keyboard',
    lines: [
      'Left and Right pick a card or button. Enter or Space plays it. H is Hint, U is Take back, Esc is Menu.',
    ],
  },
  {
    title: 'Bidding',
    lines: [
      'One card is turned face up.',
    ],
  },
  {
    title: 'Bidding',
    lines: [
      'Each player may say Hokum (that suit becomes trump), Sun, or Pass.',
    ],
  },
  {
    title: 'Bidding',
    lines: [
      'A second round lets Hokum name a different suit.',
    ],
  },
  {
    title: 'Bidding',
    lines: [
      'Sun always beats a pending Hokum call.',
    ],
  },
  {
    title: 'The buy and doubling',
    lines: [
      'The buyer takes the turned-up card and everyone is dealt up to eight cards.',
    ],
  },
  {
    title: 'The buy and doubling',
    lines: [
      'Opponents may then Double (x2)',
    ],
  },
  {
    title: 'The buy and doubling',
    lines: [
      'the buyer can answer Three, the opponents Four, and the buyer a final Match call:',
    ],
  },
  {
    title: 'The buy and doubling',
    lines: [
      'win the hand, win the match.',
    ],
  },
  {
    title: 'Following suit',
    lines: [
      'Follow suit when you can.',
    ],
  },
  {
    title: 'Following suit',
    lines: [
      'In Hokum, if you cannot follow and an opponent is winning the trick,',
    ],
  },
  {
    title: 'Following suit',
    lines: [
      'you must trump',
    ],
  },
  {
    title: 'Following suit',
    lines: [
      'and go higher than any trump already played, if you have one.',
    ],
  },
  {
    title: 'Card points',
    lines: [
      'Sun: Ace 11, 10 worth 10, King 4, Queen 3, Jack 2.',
    ],
  },
  {
    title: 'Card points',
    lines: [
      'Hokum trump: Jack 20, 9 14, Ace 11, 10 10, King 4, Queen 3. The last trick is worth 10 more.',
    ],
  },
  {
    title: 'Card points',
    lines: [
      'A hand is 16 game points in Hokum, 26 in Sun.',
    ],
  },
  {
    title: 'Winning the hand',
    lines: [
      'The buyer\'s team must beat the other team\'s total,',
    ],
  },
  {
    title: 'Winning the hand',
    lines: [
      'or the defenders take everything for that hand.',
    ],
  },
  {
    title: 'Winning the hand',
    lines: [
      'Winning all eight tricks is Kaboot: a fixed 25 points in Hokum, 44 in Sun.',
    ],
  },
  {
    title: 'Declarations',
    lines: [
      'Sira is worth 2 (4 in Sun), Fifty 5 (10), Hundred 10 (20). Four Aces in Sun is a Four Hundred: 40.',
    ],
  },
  {
    title: 'Declarations',
    lines: [
      'Baloot — the King and Queen of trump — is worth 2, on top of everything else.',
    ],
  },
  {
    title: 'Declarations',
    lines: [
      'Only the team with the single best declaration scores theirs.',
    ],
  },
];

export const RULES = [
  {
    title: 'The deck',
    cards: [R7, R8, R9, R10, RJ, RQ, RK, RA].map((r) => ({ c: mk(S, r), label: ['7', '8', '9', '10', 'J', 'Q', 'K', 'A'][r] })),
    lines: [
      'Baloot is played with a 32-card deck:',
    ],
  },
  {
    title: 'The deck',
    lines: [
      'the 7, 8, 9, 10, Jack, Queen, King and Ace of all four suits',
    ],
  },
  {
    title: 'The deck',
    lines: [
      'Spades, Hearts, Diamonds and Clubs. There are no jokers and no wild cards.',
    ],
  },
  {
    title: 'The deck',
    lines: [
      'Four players sit in two fixed partnerships, partners facing each other across the table:',
    ],
  },
  {
    title: 'The deck',
    lines: [
      'you and your partner (seat opposite you) against the two players to your right and left.',
    ],
  },
  {
    title: 'The deck',
    lines: [
      'Every hand deals out the entire deck.',
    ],
  },
  {
    title: 'The deck',
    lines: [
      'Once bidding is settled, each of the four players holds exactly eight cards.',
    ],
  },
  {
    title: 'Rank order: two systems',
    cards: [
      { c: mk(S, R10), label: '10 · Sun', sub: '10 pts, above K' },
      { c: mk(S, RK), label: 'K · Sun', sub: '4 pts, below 10' },
    ],
    lines: [
      'Baloot has two kinds of contract, Sun and Hokum,',
    ],
  },
  {
    title: 'Rank order: two systems',
    lines: [
      'and they rank cards inside a suit differently. Sun has no trump suit.',
    ],
  },
  {
    title: 'Rank order: two systems',
    lines: [
      'Every suit ranks 7, 8, 9, Jack, Queen, King, 10, Ace from weakest to strongest',
    ],
  },
  {
    title: 'Rank order: two systems',
    lines: [
      'the only twist is that the 10 jumps above the King and Queen,',
    ],
  },
  {
    title: 'Rank order: two systems',
    lines: [
      'sitting just below the Ace.',
    ],
  },
  {
    title: 'Rank order: inside trump',
    cards: [
      { c: mk(S, RJ), label: 'J · Trump', sub: '20 pts, top card' },
      { c: mk(S, R9), label: '9 · Trump', sub: '14 pts, 2nd' },
      { c: mk(S, RA), label: 'A · Trump', sub: '11 pts, 3rd' },
    ],
    lines: [
      'Hokum names one suit as trump.',
    ],
  },
  {
    title: 'Rank order: inside trump',
    lines: [
      'Inside that trump suit only, the order becomes 7, 8,',
    ],
  },
  {
    title: 'Rank order: inside trump',
    lines: [
      'Queen, King, 10, Ace, 9, Jack from weakest to strongest',
    ],
  },
  {
    title: 'Rank order: inside trump',
    lines: [
      'the Jack and the 9 leap all the way to the top, above even the Ace.',
    ],
  },
  {
    title: 'Rank order: inside trump',
    lines: [
      'Every OTHER suit in a Hokum hand — the three suits that are not trump',
    ],
  },
  {
    title: 'Rank order: inside trump',
    lines: [
      'ranks exactly like Sun: 7, 8, 9, J, Q, K, 10, A.',
    ],
  },
  {
    title: 'The deal and the turned-up card',
    lines: [
      'Seats run counter-clockwise around the table:',
    ],
  },
  {
    title: 'The deal and the turned-up card',
    lines: [
      'you (South), the player to your right (East), your partner (North,',
    ],
  },
  {
    title: 'The deal and the turned-up card',
    lines: [
      'opposite you), and the player to your left (West).',
    ],
  },
  {
    title: 'The deal and the turned-up card',
    lines: [
      'The dealer deals 5 cards to each player,',
    ],
  },
  {
    title: 'The deal and the turned-up card',
    lines: [
      'then turns the next card of the deck face up on the table',
    ],
  },
  {
    title: 'The deal and the turned-up card',
    lines: [
      'the turned-up card that drives bidding.',
    ],
  },
  {
    title: 'The deal and the turned-up card',
    lines: [
      'The remaining 11 cards stay hidden in the talon.',
    ],
  },
  {
    title: 'The deal and the turned-up card',
    lines: [
      'The player seated immediately after the dealer,',
    ],
  },
  {
    title: 'The deal and the turned-up card',
    lines: [
      'going counter-clockwise (you → right → partner → left),',
    ],
  },
  {
    title: 'The deal and the turned-up card',
    lines: [
      'bids first, and bidding then proceeds seat by seat around the table.',
    ],
  },
  {
    title: 'Bidding: round one',
    lines: [
      'Starting with the seat after the dealer,',
    ],
  },
  {
    title: 'Bidding: round one',
    lines: [
      'each player in turn may say Hokum (buy the turned-up card\'s suit as trump),',
    ],
  },
  {
    title: 'Bidding: round one',
    lines: [
      'say Sun (no trump), or Pass. The moment anyone says Sun,',
    ],
  },
  {
    title: 'Bidding: round one',
    lines: [
      'bidding ends immediately and that player buys the hand at Sun',
    ],
  },
  {
    title: 'Bidding: round one',
    lines: [
      'Sun always beats a pending Hokum call,',
    ],
  },
  {
    title: 'Bidding: round one',
    lines: [
      'even one already made earlier in the same round.',
    ],
  },
  {
    title: 'Bidding: round one, deciding it',
    lines: [
      'Only the FIRST player to call Hokum gets to buy it:',
    ],
  },
  {
    title: 'Bidding: round one, deciding it',
    lines: [
      'once someone has called Hokum,',
    ],
  },
  {
    title: 'Bidding: round one, deciding it',
    lines: [
      'every other player in that round may only answer Sun or Pass,',
    ],
  },
  {
    title: 'Bidding: round one, deciding it',
    lines: [
      'not a second Hokum call.',
    ],
  },
  {
    title: 'Bidding: round one, deciding it',
    lines: [
      'If all four players have acted and nobody said Sun,',
    ],
  },
  {
    title: 'Bidding: round one, deciding it',
    lines: [
      'whoever called Hokum (if anyone did) buys the hand at Hokum,',
    ],
  },
  {
    title: 'Bidding: round one, deciding it',
    lines: [
      'trump being the turned-up card\'s suit.',
    ],
  },
  {
    title: 'Bidding: round two',
    lines: [
      'If round one finishes with no Hokum call and no Sun call,',
    ],
  },
  {
    title: 'Bidding: round two',
    lines: [
      'a second round starts, again beginning with the seat after the dealer.',
    ],
  },
  {
    title: 'Bidding: round two',
    lines: [
      'In round two, Hokum may name any of the OTHER three suits',
    ],
  },
  {
    title: 'Bidding: round two',
    lines: [
      'not the turned-up card\'s suit, already refused in round one.',
    ],
  },
  {
    title: 'Bidding: round two',
    lines: [
      'Sun and Pass work exactly as before, and Sun still ends the auction instantly.',
    ],
  },
  {
    title: 'Redeal, and taking the extra cards',
    lines: [
      'If round two also finishes with nobody calling Hokum or Sun,',
    ],
  },
  {
    title: 'Redeal, and taking the extra cards',
    lines: [
      'the hand is abandoned: a full redeal follows and this hand',
    ],
  },
  {
    title: 'Redeal, and taking the extra cards',
    lines: [
      'does not count toward the match. Once someone buys the contract,',
    ],
  },
  {
    title: 'Redeal, and taking the extra cards',
    lines: [
      'they take the turned-up card plus two more cards from the talon',
    ],
  },
  {
    title: 'Redeal, and taking the extra cards',
    lines: [
      'the other three players each take three cards from the talon.',
    ],
  },
  {
    title: 'Redeal, and taking the extra cards',
    lines: [
      'Every player now holds exactly eight cards.',
    ],
  },
  {
    title: 'Doubling: when it is offered',
    lines: [
      'Before play begins, the defending team',
    ],
  },
  {
    title: 'Doubling: when it is offered',
    lines: [
      'the two players NOT on the buyer\'s side',
    ],
  },
  {
    title: 'Doubling: when it is offered',
    lines: [
      'may be offered a chance to double the hand\'s value.',
    ],
  },
  {
    title: 'Doubling: when it is offered',
    lines: [
      'Doubling is always offered on a Hokum contract.',
    ],
  },
  {
    title: 'Doubling: when it is offered',
    lines: [
      'On a Sun contract it is only',
    ],
  },
  {
    title: 'Doubling: when it is offered',
    lines: [
      'offered if the buying team\'s match score',
    ],
  },
  {
    title: 'Doubling: when it is offered',
    lines: [
      'is already above 100 points AND the',
    ],
  },
  {
    title: 'Doubling: when it is offered',
    lines: [
      'defending team\'s score is still below 100',
    ],
  },
  {
    title: 'Doubling: when it is offered',
    lines: [
      'otherwise a Sun contract is never doubled',
    ],
  },
  {
    title: 'Doubling: when it is offered',
    lines: [
      'and play starts at the normal value.',
    ],
  },
  {
    title: 'Doubling: the escalation ladder',
    lines: [
      'The ladder has four rungs,',
    ],
  },
  {
    title: 'Doubling: the escalation ladder',
    lines: [
      'each a single yes/no decision passed to the next player:',
    ],
  },
  {
    title: 'Doubling: the escalation ladder',
    lines: [
      'a defender may call Double (the hand becomes worth x2)',
    ],
  },
  {
    title: 'Doubling: the escalation ladder',
    lines: [
      'if so, the buyer may answer Three (x3)',
    ],
  },
  {
    title: 'Doubling: the escalation ladder',
    lines: [
      'if so, the original doubler may answer Four (x4)',
    ],
  },
  {
    title: 'Doubling: the escalation ladder',
    lines: [
      'if so, the buyer gets one last call, Match call.',
    ],
  },
  {
    title: 'Doubling: the escalation ladder',
    lines: [
      'Anyone offered a rung may simply decline,',
    ],
  },
  {
    title: 'Doubling: the escalation ladder',
    lines: [
      'and play begins at whatever',
    ],
  },
  {
    title: 'Doubling: the escalation ladder',
    lines: [
      'multiplier was already reached.',
    ],
  },
  {
    title: 'Doubling: the escalation ladder',
    lines: [
      'A Match call does not just raise the multiplier',
    ],
  },
  {
    title: 'Doubling: the escalation ladder',
    lines: [
      'accepting it stakes the ENTIRE MATCH on this',
    ],
  },
  {
    title: 'Doubling: the escalation ladder',
    lines: [
      'one hand (see "The Match call exception").',
    ],
  },
  {
    title: 'Following suit',
    lines: [
      'If you hold a card of the suit that was led, you must play a card of that suit',
    ],
  },
  {
    title: 'Following suit',
    lines: [
      'you may never discard a different suit while you still hold',
    ],
  },
  {
    title: 'Following suit',
    lines: [
      'the one led (one Hokum exception is on the next page).',
    ],
  },
  {
    title: 'Following suit',
    lines: [
      'If trump was led in a Hokum hand and you hold trump, there is an extra duty:',
    ],
  },
  {
    title: 'Following suit',
    lines: [
      'you must play a HIGHER trump than the best trump already on the table,',
    ],
  },
  {
    title: 'Following suit',
    lines: [
      'if you have one. Only when every trump in your hand is lower than the',
    ],
  },
  {
    title: 'Following suit',
    lines: [
      'current best are you free to play any of your trumps.',
    ],
  },
  {
    title: 'Following suit',
    lines: [
      'In Sun, or when a non-trump suit is led in Hokum, following suit is the only rule:',
    ],
  },
  {
    title: 'Following suit',
    lines: [
      'any card of that suit is legal, high or low.',
    ],
  },
  {
    title: 'When you can\'t follow suit',
    lines: [
      'In Sun, if you hold none of the suit led,',
    ],
  },
  {
    title: 'When you can\'t follow suit',
    lines: [
      'you may play absolutely any card from your hand',
    ],
  },
  {
    title: 'When you can\'t follow suit',
    lines: [
      'there is no trump to worry about.',
    ],
  },
  {
    title: 'When you can\'t follow suit',
    lines: [
      'In Hokum, if you hold none of the suit led and you also hold no trump,',
    ],
  },
  {
    title: 'When you can\'t follow suit',
    lines: [
      'you may likewise play any card.',
    ],
  },
  {
    title: 'When you can\'t follow suit',
    lines: [
      'In Hokum, if you hold none of the suit led and you DO hold trump:',
    ],
  },
  {
    title: 'When you can\'t follow suit',
    lines: [
      'as long as your OWN partnership',
    ],
  },
  {
    title: 'When you can\'t follow suit',
    lines: [
      'is currently winning the trick, you are free to play anything',
    ],
  },
  {
    title: 'When you can\'t follow suit',
    lines: [
      'you are never forced to trump over your own partner.',
    ],
  },
  {
    title: 'Cutting in when an opponent leads',
    lines: [
      'But if an OPPONENT is currently winning the trick,',
    ],
  },
  {
    title: 'Cutting in when an opponent leads',
    lines: [
      'you must cut in with a trump.',
    ],
  },
  {
    title: 'Cutting in when an opponent leads',
    lines: [
      'And if a trump has already been played to that trick,',
    ],
  },
  {
    title: 'Cutting in when an opponent leads',
    lines: [
      'you must play a HIGHER trump than the best one on the table if you can',
    ],
  },
  {
    title: 'Cutting in when an opponent leads',
    lines: [
      'only when none of your trumps can beat it',
    ],
  },
  {
    title: 'Cutting in when an opponent leads',
    lines: [
      'may you cut in with a lower one.',
    ],
  },
  {
    title: 'Declarations: announcing them',
    cards: [
      { c: mk(S, R7), label: '7' },
      { c: mk(S, R8), label: '8' },
      { c: mk(S, R9), label: '9' },
    ],
    lines: [
      'Before playing your very first',
    ],
  },
  {
    title: 'Declarations: announcing them',
    lines: [
      'card of the hand while you still hold all eight cards',
    ],
  },
  {
    title: 'Declarations: announcing them',
    lines: [
      'you may announce any declarations your hand contains.',
    ],
  },
  {
    title: 'Declarations: announcing them',
    lines: [
      'All of your qualifying declarations',
    ],
  },
  {
    title: 'Declarations: announcing them',
    lines: [
      'are bundled into one announcement',
    ],
  },
  {
    title: 'Declarations: announcing them',
    lines: [
      'you cannot pick and choose among them.',
    ],
  },
  {
    title: 'Declarations: what counts',
    lines: [
      'A run of 3 consecutive ranks in one suit is a Sira; a run of 4 is a Fifty',
    ],
  },
  {
    title: 'Declarations: what counts',
    lines: [
      'a run of 5 or more is a Hundred (a longer',
    ],
  },
  {
    title: 'Declarations: what counts',
    lines: [
      'run is still worth exactly the same as a 5-run only its top 5 cards count).',
    ],
  },
  {
    title: 'Declarations: what counts',
    lines: [
      'Four of a kind — all four Kings, all four Queens, or all four 10s',
    ],
  },
  {
    title: 'Declarations: what counts',
    lines: [
      'is also worth a Hundred. Four Aces are special: in a SUN contract,',
    ],
  },
  {
    title: 'Declarations: what counts',
    lines: [
      'four Aces are a much bigger bonus called Four Hundred (40 points)',
    ],
  },
  {
    title: 'Declarations: what counts',
    lines: [
      'in a HOKUM contract, four Aces are worth only the ordinary Hundred,',
    ],
  },
  {
    title: 'Declarations: what counts',
    lines: [
      'the same as four Kings, Queens or 10s.',
    ],
  },
  {
    title: 'Declarations: values and who scores',
    lines: [
      'Point values (Hokum / Sun): Sira 2 / 4 · Fifty 5 / 10 ·',
    ],
  },
  {
    title: 'Declarations: values and who scores',
    lines: [
      'Hundred 10 / 20 · Four Hundred (Sun only) 40.',
    ],
  },
  {
    title: 'Declarations: values and who scores',
    lines: [
      'Declarations are compared once the second trick is played.',
    ],
  },
  {
    title: 'Declarations: values and who scores',
    lines: [
      'Only the partnership with the single BEST',
    ],
  },
  {
    title: 'Declarations: values and who scores',
    lines: [
      'declaration scores anything for declarations that hand',
    ],
  },
  {
    title: 'Declarations: values and who scores',
    lines: [
      'the other side\'s declarations,',
    ],
  },
  {
    title: 'Declarations: values and who scores',
    lines: [
      'however good, are worth nothing. A tie in rank and top card goes',
    ],
  },
  {
    title: 'Declarations: values and who scores',
    lines: [
      'to whichever side led the very first trick.',
    ],
  },
  {
    title: 'Baloot: King and Queen of trump',
    cards: [
      { c: mk(S, RK), label: 'K of trump' },
      { c: mk(S, RQ), label: 'Q of trump' },
    ],
    lines: [
      'Holding the King and Queen',
    ],
  },
  {
    title: 'Baloot: King and Queen of trump',
    lines: [
      'of the TRUMP suit',
    ],
  },
  {
    title: 'Baloot: King and Queen of trump',
    lines: [
      'only possible in a Hokum contract, since Sun has no trump',
    ],
  },
  {
    title: 'Baloot: King and Queen of trump',
    lines: [
      'is worth a bonus called Baloot: +2 points.',
    ],
  },
  {
    title: 'Baloot: timing and the multiplier',
    lines: [
      'Baloot is credited the instant you play the second of',
    ],
  },
  {
    title: 'Baloot: timing and the multiplier',
    lines: [
      'your King and Queen of trump during the hand,',
    ],
  },
  {
    title: 'Baloot: timing and the multiplier',
    lines: [
      'and the table announces it when it happens.',
    ],
  },
  {
    title: 'Baloot: timing and the multiplier',
    lines: [
      'Baloot always stays with whoever held and played the pair,',
    ],
  },
  {
    title: 'Baloot: timing and the multiplier',
    lines: [
      'no matter which side ultimately wins the hand,',
    ],
  },
  {
    title: 'Baloot: timing and the multiplier',
    lines: [
      'and no matter how high the doubling multiplier climbs:',
    ],
  },
  {
    title: 'Baloot: timing and the multiplier',
    lines: [
      'baloot points are added on top,',
    ],
  },
  {
    title: 'Baloot: timing and the multiplier',
    lines: [
      'AFTER the multiplier is applied to everything else.',
    ],
  },
  {
    title: 'Scoring a hand: trick points',
    lines: [
      'Each trick\'s cards are worth points using the Sun',
    ],
  },
  {
    title: 'Scoring a hand: trick points',
    lines: [
      'or Hokum-trump point values from the Rank order pages',
    ],
  },
  {
    title: 'Scoring a hand: trick points',
    lines: [
      'whichever team wins a trick banks that trick\'s points.',
    ],
  },
  {
    title: 'Scoring a hand: trick points',
    lines: [
      'Winning the last, eighth trick adds a bonus of 10 points',
    ],
  },
  {
    title: 'Scoring a hand: trick points',
    lines: [
      'on top of that trick\'s own card points.',
    ],
  },
  {
    title: 'Scoring a hand: trick points',
    lines: [
      'Each team\'s raw points for the hand are then converted to',
    ],
  },
  {
    title: 'Scoring a hand: trick points',
    lines: [
      'game points by rounding to the nearest multiple of ten.',
    ],
  },
  {
    title: 'Scoring a hand: trick points',
    lines: [
      'If a team\'s total lands EXACTLY',
    ],
  },
  {
    title: 'Scoring a hand: trick points',
    lines: [
      'halfway between two multiples of ten,',
    ],
  },
  {
    title: 'Scoring a hand: trick points',
    lines: [
      'the buying side\'s total is rounded DOWN and',
    ],
  },
  {
    title: 'Scoring a hand: trick points',
    lines: [
      'the defending side\'s total is rounded UP',
    ],
  },
  {
    title: 'Scoring a hand: trick points',
    lines: [
      'the one place the buyer and the defenders are treated differently.',
    ],
  },
  {
    title: 'Scoring a hand: Sun and declarations',
    lines: [
      'In a Sun contract the rounded',
    ],
  },
  {
    title: 'Scoring a hand: Sun and declarations',
    lines: [
      'game-point total is then doubled:',
    ],
  },
  {
    title: 'Scoring a hand: Sun and declarations',
    lines: [
      'Sun is worth double a Hokum hand with the same trick',
    ],
  },
  {
    title: 'Scoring a hand: Sun and declarations',
    lines: [
      'points (typically 26 game points are on offer in Sun,',
    ],
  },
  {
    title: 'Scoring a hand: Sun and declarations',
    lines: [
      'versus 16 in Hokum).',
    ],
  },
  {
    title: 'Scoring a hand: Sun and declarations',
    lines: [
      'Declarations, from the winning side only,',
    ],
  },
  {
    title: 'Scoring a hand: Sun and declarations',
    lines: [
      'are added on top of both teams\' rounded totals.',
    ],
  },
  {
    title: 'Scoring a hand: making the contract',
    lines: [
      'The buying team must end up',
    ],
  },
  {
    title: 'Scoring a hand: making the contract',
    lines: [
      'with STRICTLY MORE game points',
    ],
  },
  {
    title: 'Scoring a hand: making the contract',
    lines: [
      'than the defending team (a tie goes to the defenders).',
    ],
  },
  {
    title: 'Scoring a hand: making the contract',
    lines: [
      'If the buyer\'s side falls short,',
    ],
  },
  {
    title: 'Scoring a hand: making the contract',
    lines: [
      'the DEFENDERS take everything:',
    ],
  },
  {
    title: 'Scoring a hand: making the contract',
    lines: [
      'both teams\' game and declaration points are',
    ],
  },
  {
    title: 'Scoring a hand: making the contract',
    lines: [
      'combined and awarded entirely to the defenders,',
    ],
  },
  {
    title: 'Scoring a hand: making the contract',
    lines: [
      'and the buyer\'s side scores zero for the hand.',
    ],
  },
  {
    title: 'Scoring a hand: making the contract',
    lines: [
      'Whatever the outcome,',
    ],
  },
  {
    title: 'Scoring a hand: making the contract',
    lines: [
      'the doubling multiplier is applied to this final total,',
    ],
  },
  {
    title: 'Scoring a hand: making the contract',
    lines: [
      'and Baloot points are then added on top, unaffected by the multiplier.',
    ],
  },
  {
    title: 'Kaboot: winning every trick',
    lines: [
      'Kaboot: if one partnership wins all eight tricks in a hand,',
    ],
  },
  {
    title: 'Kaboot: winning every trick',
    lines: [
      'that is an instant Kaboot. Instead of the normal tally,',
    ],
  },
  {
    title: 'Kaboot: winning every trick',
    lines: [
      'that side is simply awarded a fixed hand value',
    ],
  },
  {
    title: 'Kaboot: winning every trick',
    lines: [
      '25 game points in a Hokum contract, 44 in a Sun contract',
    ],
  },
  {
    title: 'Kaboot: winning every trick',
    lines: [
      'and the other side gets none of the trick points.',
    ],
  },
  {
    title: 'Kaboot: winning every trick',
    lines: [
      'Declarations still add on top as normal.',
    ],
  },
  {
    title: 'How the match ends',
    lines: [
      'A match is a race to a target chosen from the title screen:',
    ],
  },
  {
    title: 'How the match ends',
    lines: [
      '152 points for a full match, or 61 for a shorter one.',
    ],
  },
  {
    title: 'How the match ends',
    lines: [
      'At the end of any hand where a team\'s total reaches or passes the target,',
    ],
  },
  {
    title: 'How the match ends',
    lines: [
      'that team wins the match immediately',
    ],
  },
  {
    title: 'How the match ends',
    lines: [
      'unless both teams are tied exactly at that moment,',
    ],
  },
  {
    title: 'How the match ends',
    lines: [
      'in which case the match continues with another hand until someone is ahead.',
    ],
  },
  {
    title: 'The Match call exception',
    lines: [
      'The one exception is a successful',
    ],
  },
  {
    title: 'The Match call exception',
    lines: [
      'Match call (see the doubling ladder): if the buyer accepts a Match call,',
    ],
  },
  {
    title: 'The Match call exception',
    lines: [
      'then whichever side wins THAT hand\'s contract',
    ],
  },
  {
    title: 'The Match call exception',
    lines: [
      'wins the ENTIRE MATCH on the spot,',
    ],
  },
  {
    title: 'The Match call exception',
    lines: [
      'regardless of either team\'s current score.',
    ],
  },
];
