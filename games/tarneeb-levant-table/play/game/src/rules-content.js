// Exhaustive Rules reference content. Every claim here is cross-checked against the actual
// implementation in rules.js (the single source of truth for legality and scoring) so this page
// can never contradict the engine. One short concept per page - split down over three rounds as
// the text-size stepper's top step grew (130% -> 200% -> 300%, see view.js) so every page keeps
// fitting without ever shrinking the font. At 300% even a single ~20-word sentence can fill most
// of the reader-card, so pages below are split to one sentence - or, for a still-too-long single
// sentence, one natural clause - each. No fact or wording was changed, only where it breaks.
// `cards`, when present, lists real card indices (suit*13+rank, see rules.js) drawn with this
// game's own drawCard() - never a separate simplified icon. A cards illustration already takes a
// lot of the reader-card's height at 300%, so those pages carry no body text of their own now -
// the description moves to the page(s) right after.
export const RULES = [
  {
    title: 'The deck',
    cards: [
      { c: 12, label: 'Spades' },
      { c: 25, label: 'Hearts' },
      { c: 38, label: 'Diamonds' },
      { c: 51, label: 'Clubs' },
    ],
    lines: [],
  },
  {
    title: 'The deck: fifty-two cards',
    lines: [
      'Tarneeb is played with one standard deck of 52 cards.',
    ],
  },
  {
    title: 'The deck: four suits',
    lines: [
      'Four suits, Spades, Hearts, Diamonds and Clubs, of thirteen cards each.',
    ],
  },
  {
    title: 'The deck: no jokers',
    lines: [
      'There are no jokers and no wild cards.',
    ],
  },
  {
    title: 'The deck: one suit each',
    lines: [
      'Every card belongs to exactly one of the four suits shown above.',
    ],
  },
  {
    title: 'Rank order',
    cards: [
      { c: 0, label: '2' },
      { c: 7, label: '9' },
      { c: 9, label: 'J' },
      { c: 11, label: 'K' },
      { c: 12, label: 'A' },
    ],
    lines: [],
  },
  {
    title: 'Rank order: low to high',
    lines: [
      'Within any one suit, cards rank from Two, the lowest, up to Ace, the highest.',
    ],
  },
  {
    title: 'Rank order: the full order',
    lines: [
      '2, 3, 4, 5, 6, 7, 8, 9, 10, J, Q, K, A.',
    ],
  },
  {
    title: 'Rank order: no exceptions',
    lines: [
      'This game uses that plain ace-high, two-low order everywhere, including in the trump suit.',
    ],
  },
  {
    title: 'Rank order: no reordering',
    lines: [
      'There is no special reordering of any card, in any suit.',
    ],
  },
  {
    title: 'Rank order: unlike some games',
    lines: [
      'This is unlike some other regional card games.',
    ],
  },
  {
    title: 'Rank order: unlike some games',
    lines: [
      'In those games, for example, a Jack or a Nine can outrank the Ace in the trump suit.',
    ],
  },
  {
    title: 'Rank order: as built here',
    lines: [
      'Tarneeb, as built here, has no such rule.',
    ],
  },
  {
    title: 'Seats and partnerships',
    lines: [
      'Four players sit in two fixed partnerships.',
    ],
  },
  {
    title: 'Seats and partnerships: your team',
    lines: [
      'You (South) and your partner (North) are one team.',
    ],
  },
  {
    title: 'Seats and partnerships: the other team',
    lines: [
      'The two computer opponents, East and West, are the other team.',
    ],
  },
  {
    title: 'Seats and partnerships: seat numbers',
    lines: [
      'Seats are numbered 0 (You), 1 (East), 2 (Partner) and 3 (West).',
    ],
  },
  {
    title: 'The deal',
    lines: [
      'Each player is dealt 13 cards to start a hand.',
    ],
  },
  {
    title: 'The deal: the first dealer',
    lines: [
      'The very first dealer of a match is chosen at random.',
    ],
  },
  {
    title: 'The deal: after every hand',
    lines: [
      'After every hand, the deal moves on to the next seat in turn order.',
    ],
  },
  {
    title: 'The deal: a thrown-in hand',
    lines: [
      'This includes a hand that is thrown in and redealt because all four players passed.',
    ],
  },
  {
    title: 'Turn order',
    lines: [
      'Both the deal and the play of cards follow the same rotation around the table.',
    ],
  },
  {
    title: 'Turn order: on screen',
    lines: [
      'On screen that rotation turns the opposite way from a clock\'s hands.',
    ],
  },
  {
    title: 'Turn order: the rotation',
    lines: [
      'You, then East, then your Partner, then West, then back to You.',
    ],
  },
  {
    title: 'Turn order: "to the right"',
    lines: [
      'That direction is what this game means by "the deal passes to the right."',
    ],
  },
  {
    title: 'Bidding: opening the auction',
    lines: [
      'Bidding always opens with the player to the dealer\'s right - the next seat after the dealer in turn order.',
    ],
  },
  {
    title: 'Bidding: around the table',
    lines: [
      'Bidding then continues around the table.',
    ],
  },
  {
    title: 'Bidding: making a bid',
    lines: [
      'On your turn you either pass, or bid a number of tricks from 7 to 13.',
    ],
  },
  {
    title: 'Bidding: a higher bid',
    lines: [
      'A bid must be strictly higher than the current high bid - you cannot merely match it.',
    ],
  },
  {
    title: 'Bidding: a higher bid',
    lines: [
      'If you cannot bid higher, you must pass instead.',
    ],
  },
  {
    title: 'Bidding: once you pass',
    lines: [
      'Once you pass, you are out of the bidding for that hand.',
    ],
  },
  {
    title: 'Bidding: once you pass',
    lines: [
      'You get no further turn to bid, even if everyone else also passes.',
    ],
  },
  {
    title: 'Bidding: how it ends',
    lines: [
      'Bidding ends the instant either of two things happens.',
    ],
  },
  {
    title: 'Bidding: reaching 13',
    lines: [
      'Someone bids the maximum of 13 - nothing can outbid it.',
    ],
  },
  {
    title: 'Bidding: everyone else passes',
    lines: [
      'Or every player except one has passed, leaving a single bidder who wins by default at their last bid.',
    ],
  },
  {
    title: 'Bidding: if no one bids',
    lines: [
      'If all four players pass without anyone ever bidding, the hand is thrown in with no cards played.',
    ],
  },
  {
    title: 'Bidding: the redeal',
    lines: [
      'It is redealt by the next dealer in rotation.',
    ],
  },
  {
    title: 'Naming trump',
    lines: [
      'The player who wins the bidding (the declarer) then names the trump suit.',
    ],
  },
  {
    title: 'Naming trump: after bidding closes',
    lines: [
      'This choice is made only after bidding has closed - it is not announced as part of the bid itself.',
    ],
  },
  {
    title: 'Naming trump: which suit',
    lines: [
      'The declarer always names one of the four suits - there is no "no trump" option in this game.',
    ],
  },
  {
    title: 'Naming trump: leading',
    lines: [
      'The declarer then leads to the first trick.',
    ],
  },
  {
    title: 'How a trick is won: leading',
    lines: [
      'The declarer leads any card to the first trick.',
    ],
  },
  {
    title: 'How a trick is won: the next lead',
    lines: [
      'After that, whoever wins a trick leads the next one.',
    ],
  },
  {
    title: 'How a trick is won: following suit',
    lines: [
      'Every other player, in turn order, must follow the suit that was led if they hold any card of that suit.',
    ],
  },
  {
    title: 'How a trick is won: no card of that suit',
    lines: [
      'Only if a player holds none of the suit led may they play any other card, including a trump.',
    ],
  },
  {
    title: 'How a trick is won: a trump wins',
    lines: [
      'A trick is won by the highest trump played to it, if any trump was played.',
    ],
  },
  {
    title: 'How a trick is won: no trump played',
    lines: [
      'If no trump was played, the trick is won by the highest card of the suit that was led.',
    ],
  },
  {
    title: 'How a trick is won: an off-suit card',
    lines: [
      'A card that is neither the suit led nor a trump can never win the trick, whatever its rank.',
    ],
  },
  {
    title: 'How a trick is won: to the end',
    lines: [
      'Play continues, trick after trick, until all 13 tricks have been played and every hand is empty.',
    ],
  },
  {
    title: 'Scoring: making the bid',
    lines: [
      'If the declaring side took at least as many tricks as it bid, it made its bid.',
    ],
  },
  {
    title: 'Scoring: making the bid',
    lines: [
      'That side then scores the number of tricks it actually took.',
    ],
  },
  {
    title: 'Scoring: not just the bid',
    lines: [
      'Not just the bid amount.',
    ],
  },
  {
    title: 'Scoring: making the bid, an example',
    lines: [
      'Bidding 8 and taking 10 scores 10, not 8.',
    ],
  },
  {
    title: 'Scoring: missing the bid',
    lines: [
      'If the declaring side took fewer tricks than it bid, that side scores nothing for tricks.',
    ],
  },
  {
    title: 'Scoring: missing the bid, the penalty',
    lines: [
      'Instead it LOSES points equal to the amount it bid.',
    ],
  },
  {
    title: 'Scoring: missing the bid, an example',
    lines: [
      'Bidding 8 and taking only 6 scores -8 for that hand.',
    ],
  },
  {
    title: 'Scoring: the other side',
    lines: [
      'The defending side always scores the number of tricks it took.',
    ],
  },
  {
    title: 'Scoring: the other side',
    lines: [
      'That is true whether or not the declaring side made its bid.',
    ],
  },
  {
    title: 'Scoring: a clean sweep',
    lines: [
      'A clean sweep is when the declaring side bids all 13 tricks and takes all 13.',
    ],
  },
  {
    title: 'Scoring: a clean sweep wins outright',
    lines: [
      'This wins the match outright, immediately, no matter the running score.',
    ],
  },
  {
    title: 'Scoring: the one exception',
    lines: [
      'This is the one instant, hand-ending exception to everything else here.',
    ],
  },
  {
    title: 'Winning the match',
    lines: [
      'Hand scores add up, hand after hand, toward a match target you set on the title screen.',
    ],
  },
  {
    title: 'Winning the match: the target',
    lines: [
      'First to 31 points (the default), or first to 41 if you have chosen that setting instead.',
    ],
  },
  {
    title: 'Winning the match: when it ends',
    lines: [
      'The match ends the moment either side\'s total reaches the target.',
    ],
  },
  {
    title: 'Winning the match: or a clean sweep',
    lines: [
      'Or the instant a clean sweep happens, whichever comes first.',
    ],
  },
  {
    title: 'Winning the match: a tie at the target',
    lines: [
      'If both sides cross the target on the very same hand, whichever side has the higher score wins that match.',
    ],
  },
  {
    title: 'Winning the match: an exact tie',
    lines: [
      'If they are exactly tied at that moment, nobody has won yet.',
    ],
  },
  {
    title: 'Winning the match: an exact tie',
    lines: [
      'The match simply continues to another hand.',
    ],
  },
];
