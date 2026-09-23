// Exhaustive Rules reference content. Every claim here is cross-checked against the actual
// implementation in rules.js (the single source of truth for legality and scoring) so this page
// can never contradict the engine. Kept short-paragraph style like about.js, not a wall of text.
// `cards`, when present, lists real card indices (suit*13+rank, see rules.js) drawn with this
// game's own drawCard() — never a separate simplified icon.
export const RULES = [
  {
    title: 'The deck',
    cards: [
      { c: 12, label: 'Spades' },
      { c: 25, label: 'Hearts' },
      { c: 38, label: 'Diamonds' },
      { c: 51, label: 'Clubs' },
    ],
    lines: [
      'Tarneeb is played with one standard deck of 52 cards: four suits, Spades, Hearts, Diamonds and Clubs, of thirteen cards each.',
      'There are no jokers and no wild cards. Every card belongs to exactly one of the four suits shown above.',
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
    lines: [
      'Within any one suit, cards rank from Two, the lowest, up to Ace, the highest: 2, 3, 4, 5, 6, 7, 8, 9, 10, J, Q, K, A.',
      'This game uses that plain ace-high, two-low order everywhere, including in the trump suit. There is no special reordering of any card, in any suit - unlike some other regional card games where, for example, a Jack or a Nine can outrank the Ace in the trump suit. Tarneeb, as built here, has no such rule.',
    ],
  },
  {
    title: 'The deal and turn order',
    lines: [
      'Four players sit in two fixed partnerships. You (South) and your partner (North) are one team; the two computer opponents, East and West, are the other team. Seats are numbered 0 (You), 1 (East), 2 (Partner) and 3 (West).',
      'Each player is dealt 13 cards to start a hand. The very first dealer of a match is chosen at random; after every hand - including a hand that is thrown in and redealt because all four players passed - the deal moves on to the next seat in turn order.',
      'Both the deal and the play of cards follow the same rotation around the table: You, then East, then your Partner, then West, then back to You, shown on screen going counter-clockwise. That direction is what this game means by "the deal passes to the right."',
    ],
  },
  {
    title: 'Bidding',
    lines: [
      'Bidding always opens with the player to the dealer\'s right (the next seat after the dealer in turn order) and continues around the table.',
      'On your turn you either pass, or bid a number of tricks from 7 to 13. A bid must be strictly higher than the current high bid - you cannot merely match it - or you must pass instead.',
      'Once you pass, you are out of the bidding for that hand; you get no further turn to bid, even if everyone else also passes.',
      'Bidding ends the instant either of two things happens: someone bids the maximum of 13 (nothing can outbid it), or every player except one has passed, leaving a single bidder who wins by default at their last bid.',
      'If all four players pass without anyone ever bidding, the hand is thrown in with no cards played, and it is redealt by the next dealer in rotation.',
      'The player who wins the bidding (the declarer) then names the trump suit. This choice is made only after bidding has closed - it is not announced as part of the bid itself - and the declarer always names one of the four suits (there is no "no trump" option in this game). The declarer then leads to the first trick.',
    ],
  },
  {
    title: 'How a trick is won',
    lines: [
      'The declarer leads any card to the first trick. After that, whoever wins a trick leads the next one.',
      'Every other player, in turn order, must follow the suit that was led if they hold any card of that suit. Only if a player holds none of the suit led may they play any other card, including a trump.',
      'A trick is won by the highest trump played to it, if any trump was played. If no trump was played, the trick is won by the highest card of the suit that was led. A card that is neither the suit led nor a trump can never win the trick, whatever its rank.',
      'Play continues, trick after trick, until all 13 tricks have been played and every hand is empty.',
    ],
  },
  {
    title: 'Scoring a hand',
    lines: [
      'If the declaring side took at least as many tricks as it bid, that side scores the number of tricks it actually took - not just the bid amount. Bidding 8 and taking 10 scores 10, not 8.',
      'If the declaring side took fewer tricks than it bid, that side scores nothing for tricks - instead it LOSES points equal to the amount it bid. Bidding 8 and taking only 6 scores -8 for that hand.',
      'The defending side always scores the number of tricks it took, whether or not the declaring side made its bid.',
      'A clean sweep - the declaring side bids all 13 tricks and takes all 13 - wins the match outright, immediately, no matter the running score. This is the one instant, hand-ending exception to everything else on this page.',
    ],
  },
  {
    title: 'Winning the match',
    lines: [
      'Hand scores add up, hand after hand, toward a match target you set on the title screen: first to 31 points (the default), or first to 41 if you have chosen that setting instead.',
      'The match ends the moment either side\'s total reaches the target, or the instant a clean sweep happens (previous page) - whichever comes first.',
      'If both sides cross the target on the very same hand, whichever side has the higher score wins that match. If they are exactly tied at that moment, nobody has won yet and the match simply continues to another hand.',
    ],
  },
];
