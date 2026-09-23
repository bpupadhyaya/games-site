// Exhaustive rules reference for the Rules page. Every claim here is cross-checked against the actual
// implementation in rules.js (the single source of truth for legality), so this page can never contradict
// the engine. Card ids follow rules.js: id = suit*9 + rank; suits 0 spades, 1 hearts, 2 diamonds, 3 clubs;
// ranks 0..8 = 6,7,8,9,10,J,Q,K,A. `cards` entries show the real in-game card art via view.js's drawCard(),
// never a separate simplified icon; `back: true` draws the card's own back design instead of its face.
export const RULES = [
  {
    title: 'The deck and the trump',
    cards: [
      { id: 0, label: '6 of Spades — lowest' },
      { id: 26, label: 'Ace of Diamonds — highest' },
    ],
    lines: [
      'Durak is played with a 36-card deck: the ranks 6 through Ace (six, seven, eight, nine, ten, jack,',
      'queen, king, ace) in all four suits — 9 ranks times 4 suits, every card unique.',
      'After every player is dealt 6 cards, the rest of the deck becomes a face-down stock. Its bottom card',
      'is turned face up and set beside the stock — that card is not removed until the very last card is',
      'drawn, and its suit is the trump suit for the whole hand.',
      'Nothing else about the deck is special: no wild cards, no extra jokers.',
    ],
  },
  {
    title: 'Card rank and what beats a card',
    cards: [
      { id: 12, label: 'Attack: 9 of Hearts' },
      { id: 16, label: 'Beats it: King of Hearts' },
    ],
    lines: [
      'Within one suit, cards rank low to high: 6, 7, 8, 9, 10, Jack, Queen, King, Ace. Trump ranks the',
      'same way among themselves — a trump 6 is still the lowest trump.',
      'A defending card beats an attacking card in exactly two ways: it is the SAME suit and a HIGHER',
      'rank (as shown above), or it is a TRUMP and the attacking card is not a trump.',
      'A trump always beats any non-trump card, however low the trump and however high the other card.',
      'Two non-trump cards of different suits never beat each other, whatever their ranks.',
      '(Unlike some card games, there is no jack/9-outranks-ace special trump order here — trump only',
      'ever means "wins against any non-trump," nothing more.)',
    ],
  },
  {
    title: 'The deal and who attacks first',
    lines: [
      'Every player is dealt 6 cards from the shuffled deck. There is no formal dealer in this game — the',
      'deal simply happens once, at the start of the hand.',
      'Whoever holds the LOWEST trump card in their starting hand attacks first. Hold the 6 of trump and',
      'you always lead, regardless of your seat.',
      '2 to 4 players may play. Turn order after that first attack proceeds seat by seat around the table.',
    ],
  },
  {
    title: 'Attack and defend',
    lines: [
      'A round (a "bout") begins when the attacker plays any one card from their hand, face up.',
      'The player next in turn order after the attacker becomes the defender for that card, and must',
      'either beat it — same suit and higher rank, or any trump against a non-trump card — or take every',
      'card on the table into their own hand (a later page covers taking in full).',
      'If the defender beats it, and neither the table is full nor their hand empty, the round is not yet',
      'over — other players may throw in more cards, covered next.',
    ],
  },
  {
    title: 'Throw-in and the table cap',
    cards: [
      { id: 3, label: '9 of Spades — on the table' },
      { id: 30, label: '9 of Clubs — may be thrown in' },
    ],
    lines: [
      'Once the defender has beaten the card in front of them, any of the OTHER active players (in turn',
      'order starting from the attacker, skipping the defender) may throw in one more attacking card — but',
      'only of a RANK that is already somewhere on the table, on either side of an already-played pair.',
      'Each newly thrown-in card must be beaten by the defender (or the defender may take) before anyone',
      'else may add another — cards do not pile up unanswered.',
      'There is a cap on how many attacking cards may ever be played against the defender in one round: the',
      'smaller of 6 and the defender\'s hand size at the start of the round — except that in the very FIRST',
      'round of the whole match, this build caps it at 5 instead of 6, a real quirk of this build worth',
      'knowing rather than always assuming 6.',
      'Once every other player has passed in a row, or the cap is reached, the round ends.',
    ],
  },
  {
    title: 'Transfer — Perevodnoy mode only',
    cards: [
      { id: 13, label: 'First attack: 10 of Hearts' },
      { id: 22, label: 'Transfer: 10 of Diamonds' },
    ],
    lines: [
      'This build offers two modes, chosen at setup: Podkidnoy ("throw-in", the classic form) and',
      'Perevodnoy ("transfer"), which adds one extra option below. Podkidnoy has no transfer at all — there',
      'the defender may only beat or take.',
      'In Perevodnoy, if the defender has not yet beaten ANYTHING on the table this round, and holds a card',
      'of the SAME RANK as the very first attacking card, they may play it sideways instead of defending.',
      'This transfers the whole attack to the next active player, who becomes the new defender; the player',
      'who transferred becomes an attacker instead.',
      'A transfer is only legal if the next player\'s hand can hold at least one more card than is currently',
      'on the table, and it cannot push the table past the round\'s cap (previous page). After a transfer,',
      'the cap may shrink further to match the new defender\'s hand size.',
    ],
  },
  {
    title: 'Taking vs. Bito',
    cards: [
      { id: 33, label: 'Take: kept by the defender' },
      { back: true, label: 'Bito: discarded for good' },
    ],
    lines: [
      'If the defender cannot or does not want to beat a card, they may TAKE: pick up every card currently',
      'on the table — beaten and unbeaten alike — into their own hand. They keep all of it; it never counts',
      'against them beyond having more cards left to get rid of.',
      'After a take, the other attackers get one final chance, in turn, to throw in still more matching-rank',
      'cards (up to the cap) before the round truly ends and the defender picks everything up.',
      'If instead the defender beats every card and no one has anything left to throw in, the round ends as',
      '"Bito" — every card on the table goes face down to the discard pile, out of the game for good. The',
      'defender keeps none of it.',
      'Durak keeps no point score at all — cards are never worth anything by themselves. This is the game\'s',
      'real equivalent of "scoring": there simply isn\'t any.',
    ],
  },
  {
    title: 'Refilling and how the game ends',
    lines: [
      'After every round, players still in the game draw back up to 6 cards from the stock, in turn order:',
      'the round\'s attacker first, other attackers next, and the defender last. The trump card is the last',
      'card ever drawn from the stock.',
      'If Bito ended the round, the former defender becomes the next attacker. If the defender took instead,',
      'the turn skips them and passes to the next player in turn order.',
      'Once the stock is empty, a player who empties their hand is OUT for the rest of the game — safe, in',
      'the order they went out. There is no ranking among the safe players.',
      'Play continues until only one player still holds cards — that lone player is the durak, the fool, and',
      'loses. In the rare case where the last two players in the game empty their hands on the very same',
      'round, nobody is the fool: the hand ends in a draw.',
    ],
  },
];
