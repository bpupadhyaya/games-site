// Exhaustive rules reference for the Rules page. Every claim here is cross-checked against the actual
// implementation in rules.js (the single source of truth for legality), so this page can never contradict
// the engine. Card ids follow rules.js: id = suit*9 + rank; suits 0 spades, 1 hearts, 2 diamonds, 3 clubs;
// ranks 0..8 = 6,7,8,9,10,J,Q,K,A. `cards` entries show the real in-game card art via view.js's drawCard(),
// never a separate simplified icon; `back: true` draws the card's own back design instead of its face.
// Pages are kept short and single-concept (one idea per page) so the reader-panel text can run at a real,
// comfortable size at every text-size step, up to 300%, without ever overflowing the panel — many pages
// below are split from what used to be one denser page for exactly that reason (a page with `cards` has
// less room left for body text than one without, so those first sub-pages carry an even shorter sentence).
export const RULES = [
  {
    title: 'The deck',
    cards: [
      { id: 0, label: '6 of Spades — lowest' },
      { id: 26, label: 'Ace of Diamonds — highest' },
    ],
    lines: [
      'Durak is played with a 36-card deck: ranks 6 through Ace.',
    ],
  },
  {
    title: 'Every suit, every rank',
    lines: [
      'The ranks are six, seven, eight, nine, ten, jack, queen, king, and ace —',
    ],
  },
  {
    title: '36 unique cards',
    lines: [
      'in all four suits: 9 ranks times 4 suits, and every card in the deck is unique.',
    ],
  },
  {
    title: 'No wild cards',
    lines: [
      'Nothing else about the deck is special: no wild cards, no extra jokers.',
    ],
  },
  {
    title: 'The stock',
    lines: [
      'After every player is dealt 6 cards, the rest of the deck becomes a face-down stock.',
    ],
  },
  {
    title: 'The trump card',
    lines: [
      'Its bottom card is turned face up and set beside the stock —',
    ],
  },
  {
    title: 'Staying in play',
    lines: [
      'that card is not removed until the very last card is drawn,',
    ],
  },
  {
    title: 'The trump suit',
    lines: [
      'and its suit is the trump suit for the whole hand.',
    ],
  },
  {
    title: 'Card rank',
    lines: [
      'Within one suit, cards rank low to high: 6, 7, 8, 9, 10, Jack, Queen, King, Ace.',
    ],
  },
  {
    title: 'Trump rank order',
    lines: [
      'Trump ranks the same way among themselves —',
    ],
  },
  {
    title: 'Even a trump 6',
    lines: [
      'a trump 6 is still the lowest trump.',
    ],
  },
  {
    title: 'What beats a card',
    cards: [
      { id: 12, label: 'Attack: 9 of Hearts' },
      { id: 16, label: 'Beats it: King of Hearts' },
    ],
    lines: [
      'A defending card beats an attacking card in exactly two ways.',
    ],
  },
  {
    title: 'Same suit, higher rank',
    lines: [
      'Same suit and a higher rank — as shown above —',
    ],
  },
  {
    title: 'Or use a trump',
    lines: [
      'or it is a trump and the attacking card is not a trump.',
    ],
  },
  {
    title: 'Trump always wins',
    lines: [
      'A trump always beats any non-trump card,',
    ],
  },
  {
    title: 'Even the lowest trump',
    lines: [
      'however low the trump and however high the other card.',
    ],
  },
  {
    title: 'Different suits never beat',
    lines: [
      'Two non-trump cards of different suits never beat each other, whatever their ranks.',
    ],
  },
  {
    title: 'No special trump order',
    lines: [
      'Unlike some card games, there is no jack/9-outranks-ace special trump order here —',
    ],
  },
  {
    title: 'Just wins against non-trump',
    lines: [
      'trump only ever means "wins against any non-trump," nothing more.',
    ],
  },
  {
    title: 'The deal',
    lines: [
      'Every player is dealt 6 cards from the shuffled deck.',
    ],
  },
  {
    title: 'No formal dealer',
    lines: [
      'There is no formal dealer in this game —',
    ],
  },
  {
    title: 'Once, at the start',
    lines: [
      'the deal simply happens once, at the start of the hand.',
    ],
  },
  {
    title: 'Who attacks first',
    lines: [
      'Whoever holds the LOWEST trump card in their starting hand attacks first.',
    ],
  },
  {
    title: 'The trump 6 always leads',
    lines: [
      'Hold the 6 of trump and you always lead, regardless of your seat.',
    ],
  },
  {
    title: 'Player count and turn order',
    lines: [
      '2 to 4 players may play. Turn order then proceeds seat by seat around the table.',
    ],
  },
  {
    title: 'Starting a round',
    lines: [
      'A round (a "bout") begins when the attacker plays any one card from their hand, face up.',
    ],
  },
  {
    title: 'The defender',
    lines: [
      'The player next in turn order becomes the defender for that card,',
    ],
  },
  {
    title: 'Beating it',
    lines: [
      'and must either beat it — same suit and higher rank —',
    ],
  },
  {
    title: 'Or with a trump',
    lines: [
      'or any trump against a non-trump card,',
    ],
  },
  {
    title: 'Or take instead',
    lines: [
      'or take every card on the table into their own hand.',
    ],
  },
  {
    title: 'If the round continues',
    lines: [
      'If the defender beats it, and neither the table is full nor their hand empty,',
    ],
  },
  {
    title: 'Not over yet',
    lines: [
      'the round is not yet over — other players may throw in more cards.',
    ],
  },
  {
    title: 'Throw-in',
    cards: [
      { id: 3, label: '9 of Spades — on the table' },
      { id: 30, label: '9 of Clubs — may be thrown in' },
    ],
    lines: [
      'Once the defender beats a card, other active players may throw in one more attack card —',
    ],
  },
  {
    title: 'Matching rank only',
    lines: [
      'but only of a RANK that is already somewhere on the table,',
    ],
  },
  {
    title: 'Either side of a pair',
    lines: [
      'on either side of an already-played pair.',
    ],
  },
  {
    title: 'Must be beaten too',
    lines: [
      'Each newly thrown-in card must be beaten by the defender, or the defender may take,',
    ],
  },
  {
    title: 'One at a time',
    lines: [
      'before anyone else may add another.',
    ],
  },
  {
    title: 'No pile-ups',
    lines: [
      'Cards do not pile up unanswered.',
    ],
  },
  {
    title: 'The table cap',
    lines: [
      "There's a cap on how many attacking cards may be played against the defender in one round:",
    ],
  },
  {
    title: '6, or their hand size',
    lines: [
      "the smaller of 6 and the defender's hand size at the start of the round —",
    ],
  },
  {
    title: 'First-round exception',
    lines: [
      'except that in the very FIRST round of the whole match, this build caps it at 5 instead of 6 —',
    ],
  },
  {
    title: 'Worth remembering',
    lines: [
      'a real quirk of this build worth knowing rather than always assuming 6.',
    ],
  },
  {
    title: 'When the round ends',
    lines: [
      'Once every other player has passed in a row, or the cap is reached, the round ends.',
    ],
  },
  {
    title: 'Two modes',
    lines: [
      'This build offers two modes, chosen at setup:',
    ],
  },
  {
    title: 'Podkidnoy',
    lines: [
      'Podkidnoy ("throw-in") is the classic, most widely taught form.',
    ],
  },
  {
    title: 'Perevodnoy',
    lines: [
      'Perevodnoy ("transfer") adds one extra option, covered next.',
    ],
  },
  {
    title: 'No transfer in Podkidnoy',
    lines: [
      'Podkidnoy has no transfer at all — there the defender may only beat or take.',
    ],
  },
  {
    title: 'Transfer — Perevodnoy only',
    cards: [
      { id: 13, label: 'First attack: 10 of Hearts' },
      { id: 22, label: 'Transfer: 10 of Diamonds' },
    ],
    lines: [
      "In Perevodnoy, if the defender hasn't beaten anything yet this round,",
    ],
  },
  {
    title: 'Same rank as the attack',
    lines: [
      'and holds a card of the SAME RANK as the very first attacking card,',
    ],
  },
  {
    title: 'Playing sideways',
    lines: [
      'they may play it sideways instead of defending.',
    ],
  },
  {
    title: 'A new defender',
    lines: [
      'This transfers the whole attack to the next active player, who becomes the new defender;',
    ],
  },
  {
    title: 'Transferring becomes attacking',
    lines: [
      'the player who transferred becomes an attacker instead.',
    ],
  },
  {
    title: 'Transfer — requirements',
    lines: [
      "A transfer is only legal if the next player's hand has room for one more card,",
    ],
  },
  {
    title: 'Respecting the cap',
    lines: [
      "and it cannot push the table past the round's cap.",
    ],
  },
  {
    title: 'The cap may shrink',
    lines: [
      "After a transfer, the cap may shrink further to match the new defender's hand size.",
    ],
  },
  {
    title: 'Taking',
    cards: [
      { id: 33, label: 'Take: kept by the defender' },
    ],
    lines: [
      "If the defender can't or won't beat a card, they may TAKE:",
    ],
  },
  {
    title: 'Every card on the table',
    lines: [
      'pick up every card on the table — beaten and unbeaten alike — into their own hand.',
    ],
  },
  {
    title: 'No penalty, just more cards',
    lines: [
      'They keep all of it; it never counts against them beyond having more cards to get rid of.',
    ],
  },
  {
    title: 'One final throw-in',
    lines: [
      'After a take, the other attackers get one final chance, in turn, to throw in more matching-rank cards,',
    ],
  },
  {
    title: 'Before the round ends',
    lines: [
      'up to the cap, before the round truly ends and the defender picks everything up.',
    ],
  },
  {
    title: 'Bito',
    cards: [
      { back: true, label: 'Bito: discarded for good' },
    ],
    lines: [
      'If the defender beats every card and no one has anything left to throw in,',
    ],
  },
  {
    title: 'Face down for good',
    lines: [
      'the round ends as "Bito" — every card on the table goes face down to the discard pile,',
    ],
  },
  {
    title: 'Gone for good',
    lines: [
      'out of the game for good. The defender keeps none of it.',
    ],
  },
  {
    title: 'No point score',
    lines: [
      'Durak keeps no point score at all — cards are never worth anything by themselves.',
    ],
  },
  {
    title: 'No scoring at all',
    lines: [
      'This is the game\'s real equivalent of "scoring": there simply isn\'t any.',
    ],
  },
  {
    title: 'Refilling the hand',
    lines: [
      'After every round, players still in the game draw back up to 6 cards from the stock,',
    ],
  },
  {
    title: 'Draw order',
    lines: [
      "in turn order: the round's attacker first, other attackers next, and the defender last.",
    ],
  },
  {
    title: 'The trump card is drawn last',
    lines: [
      'The trump card is the last card ever drawn from the stock.',
    ],
  },
  {
    title: 'After Bito',
    lines: [
      'If Bito ended the round, the former defender becomes the next attacker.',
    ],
  },
  {
    title: 'After a take',
    lines: [
      'If the defender took instead, the turn skips them and passes to the next player.',
    ],
  },
  {
    title: 'Going out safe',
    lines: [
      'Once the stock is empty, a player who empties their hand is OUT for the rest of the game —',
    ],
  },
  {
    title: 'No ranking among the safe',
    lines: [
      'safe, in the order they went out. There is no ranking among the safe players.',
    ],
  },
  {
    title: 'Down to the last player',
    lines: [
      'Play continues until only one player still holds cards —',
    ],
  },
  {
    title: 'The durak loses',
    lines: [
      'that lone player is the durak, the fool, and loses.',
    ],
  },
  {
    title: 'A rare tie',
    lines: [
      'In the rare case where the last two players in the game empty their hands on the very same round,',
    ],
  },
  {
    title: 'Ends in a draw',
    lines: [
      'nobody is the fool: the hand ends in a draw.',
    ],
  },
];
