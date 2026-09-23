// Exhaustive Rules reference content, kept factual and cross-checked against the real rule book in
// rules.js (the single source of truth) so this page can never contradict the engine. Additive only:
// nothing here is read by the game logic itself, only by view.js's Rules scene.
import { mk } from './rules.js';

// A generic suit (Spades) is used for every illustrative card, since none of these rules depend on
// which suit is involved.
const S = 0; // spades
const R7 = 0, R8 = 1, R9 = 2, R10 = 3, RJ = 4, RQ = 5, RK = 6, RA = 7;

export const RULES = [
  {
    title: 'The deck',
    lines: [
      'Baloot is played with a 32-card deck: the 7, 8, 9, 10, Jack, Queen, King and Ace of all four suits — Spades, Hearts, Diamonds and Clubs. There are no jokers and no wild cards.',
      'Four players sit in two fixed partnerships, partners facing each other across the table: you and your partner (seat opposite you) against the two players to your right and left.',
      'Every hand deals out the entire deck. Once bidding is settled, each of the four players holds exactly eight cards.',
    ],
    cards: [R7, R8, R9, R10, RJ, RQ, RK, RA].map((r) => ({ c: mk(S, r), label: ['7', '8', '9', '10', 'J', 'Q', 'K', 'A'][r] })),
  },
  {
    title: 'Rank order: Sun vs Hokum',
    lines: [
      'Baloot has two kinds of contract, Sun and Hokum, and they rank cards inside a suit differently.',
      'Sun has no trump suit. Every suit ranks 7, 8, 9, Jack, Queen, King, 10, Ace from weakest to strongest — the only twist is that the 10 jumps above the King and Queen, sitting just below the Ace.',
      'Hokum names one suit as trump. Inside that trump suit only, the order becomes 7, 8, Queen, King, 10, Ace, 9, Jack from weakest to strongest — the Jack and the 9 leap all the way to the top, above even the Ace.',
      'Every OTHER suit in a Hokum hand — the three suits that are not trump — ranks exactly like Sun: 7, 8, 9, J, Q, K, 10, A.',
    ],
    cards: [
      { c: mk(S, R10), label: '10 · Sun', sub: '10 pts, above K' },
      { c: mk(S, RK), label: 'K · Sun', sub: '4 pts, below 10' },
      { c: mk(S, RJ), label: 'J · Trump', sub: '20 pts, top card' },
      { c: mk(S, R9), label: '9 · Trump', sub: '14 pts, 2nd' },
      { c: mk(S, RA), label: 'A · Trump', sub: '11 pts, 3rd' },
    ],
  },
  {
    title: 'The deal and the turned-up card',
    lines: [
      'Seats run counter-clockwise around the table: you (South), the player to your right (East), your partner (North, opposite you), and the player to your left (West).',
      "The dealer deals 5 cards to each player, then turns the next card of the deck face up on the table — the turned-up card that drives bidding. The remaining 11 cards stay hidden in the talon.",
      'The player seated immediately after the dealer, going counter-clockwise (you → right → partner → left), bids first, and bidding then proceeds seat by seat around the table.',
    ],
  },
  {
    title: 'Bidding: round one',
    lines: [
      'Starting with the seat after the dealer, each player in turn may say Hokum (buy the turned-up card\'s suit as trump), say Sun (no trump), or Pass.',
      'The moment anyone says Sun, bidding ends immediately and that player buys the hand at Sun — Sun always beats a pending Hokum call, even one already made earlier in the same round.',
      'Only the FIRST player to call Hokum gets to buy it: once someone has called Hokum, every other player in that round may only answer Sun or Pass, not a second Hokum call.',
      'If all four players have acted and nobody said Sun, whoever called Hokum (if anyone did) buys the hand at Hokum, trump being the turned-up card\'s suit.',
    ],
  },
  {
    title: 'Bidding: round two, and redeal',
    lines: [
      'If round one finishes with no Hokum call and no Sun call, a second round starts, again beginning with the seat after the dealer.',
      "In round two, Hokum may name any of the OTHER three suits — not the turned-up card's suit, already refused in round one. Sun and Pass work exactly as before, and Sun still ends the auction instantly.",
      'If round two also finishes with nobody calling Hokum or Sun, the hand is abandoned: a full redeal follows and this hand does not count toward the match.',
      'Once someone buys the contract, they take the turned-up card plus two more cards from the talon; the other three players each take three cards from the talon. Every player now holds exactly eight cards.',
    ],
  },
  {
    title: 'Doubling: the escalation ladder',
    lines: [
      'Before play begins, the defending team — the two players NOT on the buyer\'s side — may be offered a chance to double the hand\'s value.',
      "Doubling is always offered on a Hokum contract. On a Sun contract it is only offered if the buying team's match score is already above 100 points AND the defending team's score is still below 100 — otherwise a Sun contract is never doubled and play starts at the normal value.",
      'The ladder has four rungs, each a single yes/no decision passed to the next player: a defender may call Double (the hand becomes worth x2); if so, the buyer may answer Three (x3); if so, the original doubler may answer Four (x4); if so, the buyer gets one last call, Match call.',
      'Anyone offered a rung may simply decline, and play begins at whatever multiplier was already reached. A Match call does not just raise the multiplier — accepting it stakes the ENTIRE MATCH on this one hand (see "Kaboot and how the match ends").',
    ],
  },
  {
    title: 'Following suit',
    lines: [
      'If you hold a card of the suit that was led, you must play a card of that suit — you may never discard a different suit while you still hold the one led (one Hokum exception is on the next page).',
      'If trump was led in a Hokum hand and you hold trump, there is an extra duty: you must play a HIGHER trump than the best trump already on the table, if you have one. Only when every trump in your hand is lower than the current best are you free to play any of your trumps.',
      'In Sun, or when a non-trump suit is led in Hokum, following suit is the only rule: any card of that suit is legal, high or low.',
    ],
  },
  {
    title: 'When you can\'t follow suit',
    lines: [
      'In Sun, if you hold none of the suit led, you may play absolutely any card from your hand — there is no trump to worry about.',
      'In Hokum, if you hold none of the suit led and you also hold no trump, you may likewise play any card.',
      'In Hokum, if you hold none of the suit led and you DO hold trump: as long as your OWN partnership is currently winning the trick, you are free to play anything — you are never forced to trump over your own partner.',
      'But if an OPPONENT is currently winning the trick, you must cut in with a trump. And if a trump has already been played to that trick, you must play a HIGHER trump than the best one on the table if you can — only when none of your trumps can beat it may you cut in with a lower one.',
    ],
  },
  {
    title: 'Declarations',
    lines: [
      'Before playing your very first card of the hand — while you still hold all eight cards — you may announce any declarations your hand contains. All of your qualifying declarations are bundled into one announcement; you cannot pick and choose among them.',
      'A run of 3 consecutive ranks in one suit is a Sira; a run of 4 is a Fifty; a run of 5 or more is a Hundred (a longer run is still worth exactly the same as a 5-run — only its top 5 cards count).',
      'Four of a kind — all four Kings, all four Queens, or all four 10s — is also worth a Hundred. Four Aces are special: in a SUN contract, four Aces are a much bigger bonus called Four Hundred (40 points); in a HOKUM contract, four Aces are worth only the ordinary Hundred, the same as four Kings, Queens or 10s.',
      'Point values (Hokum / Sun): Sira 2 / 4 · Fifty 5 / 10 · Hundred 10 / 20 · Four Hundred (Sun only) 40.',
      "Declarations are compared once the second trick is played. Only the partnership with the single BEST declaration scores anything for declarations that hand — the other side's declarations, however good, are worth nothing. A tie in rank and top card goes to whichever side led the very first trick.",
    ],
    cards: [
      { c: mk(S, R7), label: '7' },
      { c: mk(S, R8), label: '8' },
      { c: mk(S, R9), label: '9' },
    ],
  },
  {
    title: 'Baloot: King and Queen of trump',
    lines: [
      'Holding the King and Queen of the TRUMP suit — only possible in a Hokum contract, since Sun has no trump — is worth a bonus called Baloot: +2 points.',
      'Baloot is credited the instant you play the second of your King and Queen of trump during the hand, and the table announces it when it happens.',
      'Baloot always stays with whoever held and played the pair, no matter which side ultimately wins the hand, and no matter how high the doubling multiplier climbs: baloot points are added on top, AFTER the multiplier is applied to everything else.',
    ],
    cards: [
      { c: mk(S, RK), label: 'K of trump' },
      { c: mk(S, RQ), label: 'Q of trump' },
    ],
  },
  {
    title: 'Scoring a hand',
    lines: [
      "Each trick's cards are worth points using the Sun or Hokum-trump point values from the Rank order page; whichever team wins a trick banks that trick's points. Winning the last, eighth trick adds a bonus of 10 points on top of that trick's own card points.",
      'Each team\'s raw points for the hand are then converted to game points by rounding to the nearest multiple of ten. If a team\'s total lands EXACTLY halfway between two multiples of ten, the buying side\'s total is rounded DOWN and the defending side\'s total is rounded UP — the one place the buyer and the defenders are treated differently.',
      'In a Sun contract the rounded game-point total is then doubled: Sun is worth double a Hokum hand with the same trick points (typically 26 game points are on offer in Sun, versus 16 in Hokum).',
      'Declarations, from the winning side only, are added on top of both teams\' rounded totals.',
      'The buying team must end up with STRICTLY MORE game points than the defending team (a tie goes to the defenders). If the buyer\'s side falls short, the DEFENDERS take everything: both teams\' game and declaration points are combined and awarded entirely to the defenders, and the buyer\'s side scores zero for the hand.',
      'Whatever the outcome, the doubling multiplier is applied to this final total, and Baloot points are then added on top, unaffected by the multiplier.',
    ],
  },
  {
    title: 'Kaboot and how the match ends',
    lines: [
      'Kaboot: if one partnership wins all eight tricks in a hand, that is an instant Kaboot. Instead of the normal tally, that side is simply awarded a fixed hand value — 25 game points in a Hokum contract, 44 in a Sun contract — and the other side gets none of the trick points. Declarations still add on top as normal.',
      'A match is a race to a target chosen from the title screen: 152 points for a full match, or 61 for a shorter one.',
      'At the end of any hand where a team\'s total reaches or passes the target, that team wins the match immediately — unless both teams are tied exactly at that moment, in which case the match continues with another hand until someone is ahead.',
      'The one exception is a successful Match call (see the doubling ladder): if the buyer accepts a Match call, then whichever side wins THAT hand\'s contract wins the ENTIRE MATCH on the spot, regardless of either team\'s current score.',
    ],
  },
];
