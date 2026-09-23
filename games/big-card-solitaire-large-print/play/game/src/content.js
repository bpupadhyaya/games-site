// Text + diagram content for the in-app "Rules" reference page. Every claim here is cross-checked
// against the actual implementation (rules.js and solver.js are the single source of truth for
// legality and for the deal generator) so this page can never contradict the shipped game.
//
// Each entry may carry a `diagram` key naming a small scene that view.js draws with the game's own
// card-drawing functions (drawFace/drawBack/drawWell/drawRing from art.js) — never a separate,
// simplified icon set. Diagrams that need it also carry the plain card data (`cards`) to draw.
// Split at 300% text size so every page fits the reader panel; a concept spanning more than one
// page repeats its title and shows its diagram only on the first page.

export const RULES = [
  {
    title: 'Big Card Solitaire',
    lines: [
      'This is solitaire for one player against a single shuffled 52-card deck — no opponent, no',
    ],
  },
  {
    title: 'Big Card Solitaire',
    lines: [
      'clock, and nothing that is scored except your own running count of hands played and won.',
    ],
  },
  {
    title: 'Big Card Solitaire',
    lines: [
      'The board has three areas: four foundations across the top (one per suit), seven tableau',
    ],
  },
  {
    title: 'Big Card Solitaire',
    lines: [
      'columns across the middle, and the stock and waste at the bottom, under your thumb.',
    ],
  },
  {
    title: 'Big Card Solitaire',
    lines: [
      'Tap a card to select it, then tap where you want it to go — with exactly one legal',
    ],
  },
  {
    title: 'Big Card Solitaire',
    lines: [
      'destination the card moves there the instant you tap it, no second tap needed.',
    ],
  },
  {
    title: 'The deck',
    diagram: 'deck',
    cards: [{"suit":"S","rank":1},{"suit":"H","rank":7},{"suit":"C","rank":13}],
    lines: [
      'One standard 52-card deck:',
    ],
  },
  {
    title: 'The deck',
    lines: [
      'four suits — spades, hearts, diamonds and clubs — each with',
      'thirteen ranks, Ace through King.',
    ],
  },
  {
    title: 'The deck',
    lines: [
      'No jokers, no wild cards, no extra or missing cards.',
    ],
  },
  {
    title: 'The deck',
    lines: [
      'Every new hand reshuffles the whole deck from scratch, using the game\'s own random-number',
    ],
  },
  {
    title: 'The deck',
    lines: [
      'stream, then deals it out fresh (see "Setup and the deal", a few pages on).',
    ],
  },
  {
    title: 'Card ranks, lowest to highest',
    diagram: 'ranks',
    cards: [{"suit":"S","rank":1},{"suit":"S","rank":13}],
    lines: [
      'Ranks run Ace, 2, 3, 4, 5, 6, 7, 8, 9, 10, Jack, Queen, King —',
    ],
  },
  {
    title: 'Card ranks, lowest to highest',
    lines: [
      'Ace is always the lowest rank',
      'and King the highest.',
      'The Ace can never be played as a "high" card above a King.',
    ],
  },
  {
    title: 'Card ranks, lowest to highest',
    lines: [
      'No suit outranks another suit and there is no trump — the only thing that matters between',
    ],
  },
  {
    title: 'Card ranks, lowest to highest',
    lines: [
      'suits is colour, covered on the next page.',
    ],
  },
  {
    title: 'Suit colour, and the 4-colour option',
    diagram: 'colours',
    lines: [
      'Spades and clubs are the two black suits;',
    ],
  },
  {
    title: 'Suit colour, and the 4-colour option',
    lines: [
      'hearts and diamonds are the two red suits.',
      'A',
    ],
  },
  {
    title: 'Suit colour, and the 4-colour option',
    lines: [
      'tableau sequence always alternates between a black suit and a red suit underneath,',
    ],
  },
  {
    title: 'Suit colour, and the 4-colour option',
    lines: [
      'whatever',
      'ink is on screen.',
    ],
  },
  {
    title: 'The 4-colour option is display-only',
    lines: [
      'Options > Suit colours switches between the classic 2-colour deck and a 4-colour deck',
    ],
  },
  {
    title: 'The 4-colour option is display-only',
    lines: [
      '(spades black, hearts red, diamonds blue, clubs green) so all four suits are easy to tell',
      'apart at a glance.',
    ],
  },
  {
    title: 'The 4-colour option is display-only',
    lines: [
      'This is a display choice only — it changes the ink, never a rule.',
      'Legality is always decided',
    ],
  },
  {
    title: 'The 4-colour option is display-only',
    lines: [
      'by the black/red grouping underneath, whichever colours you happen to be looking at.',
    ],
  },
  {
    title: 'Setup and the deal',
    diagram: 'deal',
    lines: [
      'Seven tableau columns are dealt from the shuffled deck:',
    ],
  },
  {
    title: 'Setup and the deal',
    lines: [
      'column 1 gets one card, column 2',
      'gets two, and so on up to column 7, which gets seven.',
    ],
  },
  {
    title: 'Setup and the deal',
    lines: [
      'Only the top card of each column is',
      'dealt face up — every card beneath it stays face down.',
    ],
  },
  {
    title: 'Setup: the stock, and an honest deal',
    lines: [
      'The remaining 24 cards form the stock, face down, bottom right.',
      'The waste pile starts empty',
    ],
  },
  {
    title: 'Setup: the stock, and an honest deal',
    lines: [
      'beside it, and no card starts on a foundation.',
    ],
  },
  {
    title: 'Setup: the stock, and an honest deal',
    lines: [
      'The deal is not just "shuffle and go" — the game searches for a winning line through the',
    ],
  },
  {
    title: 'Setup: the stock, and an honest deal',
    lines: [
      'shuffle before dealing it to you (see "Every deal winnable", near the end of this guide).',
    ],
  },
  {
    title: 'The stock and the waste',
    diagram: 'stockwaste',
    lines: [
      'Tap the stock (bottom right) to turn its top',
    ],
  },
  {
    title: 'The stock and the waste',
    lines: [
      'card face up onto the waste pile beside it —',
      'one card at a time (draw-1).',
      'Only the top card of the waste is in play.',
    ],
  },
  {
    title: 'Recycling the stock, unlimited',
    lines: [
      'When the stock runs out, tap it again to recycle the whole waste back into the stock, face',
    ],
  },
  {
    title: 'Recycling the stock, unlimited',
    lines: [
      'down, in the same order, ready to draw again — there is no limit on how many times you may',
    ],
  },
  {
    title: 'Recycling the stock, unlimited',
    lines: [
      'recycle it ("unlimited redeals").',
    ],
  },
  {
    title: 'Recycling the stock, unlimited',
    lines: [
      'The top card of the waste can be tapped and moved to a foundation or a tableau column,',
    ],
  },
  {
    title: 'Recycling the stock, unlimited',
    lines: [
      'following exactly the same rules as any other card.',
    ],
  },
  {
    title: 'Building the tableau',
    diagram: 'tableauRun',
    lines: [
      'A card may be placed on a tableau column',
    ],
  },
  {
    title: 'Building the tableau',
    lines: [
      'only on top of a face-up card of the opposite',
    ],
  },
  {
    title: 'Building the tableau',
    lines: [
      'colour that is exactly one rank higher — a red 7 may sit on a black 8, but never on a red 8',
      'or a black 6.',
    ],
  },
  {
    title: 'Building the tableau',
    lines: [
      'An empty column accepts only a King, of either black or red suit — nothing smaller can start',
      'a new column.',
    ],
  },
  {
    title: 'Moving a run',
    lines: [
      'Tap the bottom card of the group you want to move; every card stacked above it moves with it',
    ],
  },
  {
    title: 'Moving a run',
    lines: [
      'as one run (the gold ring shows the whole run together).',
      'This is always safe because a',
    ],
  },
  {
    title: 'Moving a run',
    lines: [
      'face-up run can only ever have been built by legal alternating moves in the first place.',
    ],
  },
  {
    title: 'Moving a run',
    lines: [
      'Moving cards off a column automatically turns the newly exposed face-down card face up.',
    ],
  },
  {
    title: 'Building the foundations',
    diagram: 'foundation',
    lines: [
      'Each of the four foundations holds one suit',
    ],
  },
  {
    title: 'Building the foundations',
    lines: [
      'and must be built strictly upward from the Ace:',
      'Ace, then 2, then 3, and so on to King.',
    ],
  },
  {
    title: 'Building the foundations',
    lines: [
      'A card may only go on its own suit\'s foundation, one',
    ],
  },
  {
    title: 'Building the foundations',
    lines: [
      'rank above whatever is already there (or an Ace onto an empty foundation).',
    ],
  },
  {
    title: 'Building the foundations',
    lines: [
      'A card can reach a foundation from the top of the waste or the top of a tableau column — only',
    ],
  },
  {
    title: 'Building the foundations',
    lines: [
      'one card at a time; a multi-card run can never be dropped onto a foundation as a group.',
    ],
  },
  {
    title: 'Foundations are one-way',
    lines: [
      'Once a card is on a foundation it stays there for the rest of the hand — this build never',
    ],
  },
  {
    title: 'Foundations are one-way',
    lines: [
      'allows moving a card back from a foundation to the tableau.',
      'That is a deliberate',
    ],
  },
  {
    title: 'Foundations are one-way',
    lines: [
      'simplification, shared with many mobile Klondike apps, that keeps both the interface and the',
    ],
  },
  {
    title: 'Foundations are one-way',
    lines: [
      'deal-checking search simpler.',
    ],
  },
  {
    title: 'Tapping, selecting, and the hint',
    lines: [
      'Tap a card to select it.',
      'With exactly one legal destination it moves there immediately.',
      'With',
    ],
  },
  {
    title: 'Tapping, selecting, and the hint',
    lines: [
      'more than one, tap the destination you want; tapping anywhere else, or the same card again,',
    ],
  },
  {
    title: 'Tapping, selecting, and the hint',
    lines: [
      'cancels the selection instead.',
      'Tap "What can I do?"',
    ],
  },
  {
    title: 'Tapping, selecting, and the hint',
    lines: [
      'at any time to ring every legal move at once in gold — every card or',
    ],
  },
  {
    title: 'Tapping, selecting, and the hint',
    lines: [
      'pile you could act on right now, including the stock itself when drawing is the only move',
      'available.',
    ],
  },
  {
    title: 'Tapping, selecting, and the hint',
    lines: [
      'The same overlay opens with the H key on a keyboard.',
    ],
  },
  {
    title: 'Tapping, selecting, and the hint',
    lines: [
      'There is no time limit, no move counter that affects anything, and no penalty at all for',
    ],
  },
  {
    title: 'Tapping, selecting, and the hint',
    lines: [
      'taking your time or leaning on the hint.',
    ],
  },
  {
    title: 'Winning a hand',
    lines: [
      'A hand is won the instant all four foundations hold all thirteen cards of their suit — all',
    ],
  },
  {
    title: 'Winning a hand',
    lines: [
      '52 cards accounted for.',
      'The board then offers "Deal again" to start a brand-new shuffled',
      'hand.',
    ],
  },
  {
    title: 'Winning a hand',
    lines: [
      'There is no formal losing state and no numeric score.',
      'The title screen simply keeps a running',
    ],
  },
  {
    title: 'Winning a hand',
    lines: [
      'personal count of "Hands played" and "Hands won" — nothing else is scored.',
    ],
  },
  {
    title: 'Never stuck, but not always solved',
    lines: [
      'Because the stock and waste can always be recycled, you are never completely out of legal',
    ],
  },
  {
    title: 'Never stuck, but not always solved',
    lines: [
      'moves while any card remains off the foundations — but a move always being available doesn\'t',
    ],
  },
  {
    title: 'Never stuck, but not always solved',
    lines: [
      'by itself guarantee you\'ll find the winning order.',
      'That is what the next page is about.',
    ],
  },
  {
    title: 'Every deal winnable — the search',
    lines: [
      'Before a hand is dealt, the game shuffles the deck and searches for a full sequence of moves',
    ],
  },
  {
    title: 'Every deal winnable — the search',
    lines: [
      'that solves it, using its own solver: a bounded search that greedily sends cards to',
    ],
  },
  {
    title: 'Every deal winnable — the search',
    lines: [
      'foundations and explores tableau and stock moves up to a fixed budget (4,000 search nodes',
      'per attempt).',
    ],
  },
  {
    title: 'Every deal winnable — confirm or retry',
    lines: [
      'If that search finds a complete solution, the shuffle is confirmed winnable and is the one',
    ],
  },
  {
    title: 'Every deal winnable — confirm or retry',
    lines: [
      'you are dealt.',
      'If it can\'t confirm one within the budget, the game reshuffles from the same',
    ],
  },
  {
    title: 'Every deal winnable — confirm or retry',
    lines: [
      'random-number stream and tries again — up to 60 attempts.',
    ],
  },
  {
    title: 'Every deal winnable — an honesty note',
    lines: [
      'This is a heuristic search, not an exhaustive solver.',
      'Not finding a solution in',
    ],
  },
  {
    title: 'Every deal winnable — an honesty note',
    lines: [
      'time does not prove a deal is unsolvable, and this has been checked only against a sample of',
    ],
  },
  {
    title: 'Every deal winnable — an honesty note',
    lines: [
      'seeds, not proven mathematically.',
      'If all 60 attempts fail to confirm a win, the last shuffle',
    ],
  },
  {
    title: 'Every deal winnable — an honesty note',
    lines: [
      'is dealt anyway — the game never hangs.',
    ],
  },
  {
    title: 'Every deal winnable — what you would see',
    lines: [
      'When a deal could not be confirmed, a note appears on screen: "This deal could not',
      'be confirmed as winnable."',
    ],
  },
  {
    title: 'Every deal winnable — what you would see',
    lines: [
      'That is the complete, real behaviour behind the "every deal',
    ],
  },
  {
    title: 'Every deal winnable — what you would see',
    lines: [
      'winnable" claim: true in the overwhelming common case, and honestly flagged on screen in the',
    ],
  },
  {
    title: 'Every deal winnable — what you would see',
    lines: [
      'rare case it isn\'t.',
    ],
  },
  {
    title: 'What changes the look, not the rules',
    diagram: 'backs',
    lines: [
      'Options (from the title screen) lets you pick a table colour,',
    ],
  },
  {
    title: 'What changes the look, not the rules',
    lines: [
      'a card-back theme, 2-colour or',
      '4-colour suit ink, and gentle or reduced motion.',
    ],
  },
  {
    title: 'What changes the look, not the rules',
    lines: [
      'Every card-back theme shown there is',
    ],
  },
  {
    title: 'What changes the look, not the rules',
    lines: [
      'included with the game — nothing to unlock or buy to see them all.',
    ],
  },
  {
    title: 'What changes the look, not the rules',
    lines: [
      'None of these choices change a single rule on this page — they change how the board looks,',
    ],
  },
  {
    title: 'What changes the look, not the rules',
    lines: [
      'never how a card may legally move, how a deal is generated, or how a hand is won.',
    ],
  },
];
