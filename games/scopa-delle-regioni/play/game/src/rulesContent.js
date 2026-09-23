// Exhaustive Scopa rules reference, paginated like the About/Controls pages. Every claim here is
// cross-checked against the actual implementation in rules.js (the single source of truth for
// legality and scoring) so this page can never contradict the engine. Split one concept per page
// (a few pages here cover what used to be one page each) so every page still fits comfortably at
// the largest text-size step - verified by rendering, not assumed.
import { cardId, SETTEBELLO } from './rules.js';

const DENARI = 0, COPPE = 1, SPADE = 2, BASTONI = 3;

export const RULES = [
  {
    title: 'The deck',
    lines: [
      "Scopa is played with a 40-card Italian deck in four suits: denari (coins), coppe (cups), spade (swords) and bastoni (batons).",
      'Each suit runs Ace through 7, then three court cards: Fante (8), Cavallo (9) and Re (10) - there are no 8, 9 or 10 pip cards.',
      'That is 10 ranks in each of the 4 suits, 40 cards in all.',
      "This game's card art is an original set of drawings made for it, not a copy of any historic regional pattern.",
    ],
    cards: [
      { id: cardId(DENARI, 1), label: 'Denari (coins)' },
      { id: cardId(COPPE, 1), label: 'Coppe (cups)' },
      { id: cardId(SPADE, 1), label: 'Spade (swords)' },
      { id: cardId(BASTONI, 1), label: 'Bastoni (batons)' },
    ],
  },
  {
    title: 'Two different card values',
    lines: [
      "Every card has a rank from 1 (Ace) to 10 (Re). Rank is what a card CAPTURES with - the next page explains capturing.",
      'A separate scale is used only for the Primiera scoring category (a later page): 7 = 21, 6 = 18, Ace = 16, 5 = 15, 4 = 14, 3 = 13, 2 = 12, and Fante, Cavallo and Re are worth only 10 each.',
      'The two scales disagree on purpose: for capturing, a Re (rank 10) outranks a 7; for Primiera, a 7 is worth more than double a Re.',
    ],
    cards: [
      { id: SETTEBELLO, label: 'Capture rank 7 - Primiera 21' },
      { id: cardId(SPADE, 10), label: 'Capture rank 10 - Primiera 10' },
    ],
  },
  {
    title: 'The deal',
    lines: [
      '2 players play alone. 4 players form two fixed partnerships by seat parity: seats 0 and 2 are one team, seats 1 and 3 the other.',
      'To start a round, 4 cards are dealt face-up to the table and 3 cards to each player\'s hand.',
    ],
    cards: [
      { id: cardId(DENARI, 3), label: '' },
      { id: cardId(COPPE, 7), label: '' },
      { id: cardId(SPADE, 5), label: '' },
      { id: cardId(BASTONI, 9), label: '' },
    ],
    cardsCaption: 'An opening table: four cards dealt face-up',
  },
  {
    title: 'The deal: avoiding too many Re',
    lines: [
      'If that face-up deal would put 3 or more Re (rank 10) on the table, the whole table is re-shuffled and re-dealt - this repeats until fewer than 3 Re land there.',
    ],
  },
  {
    title: 'Turn order',
    lines: [
      'Turns pass around the table in fixed seat order (0, 1, 2, 3, back to 0...), and the seat to the dealer\'s left always plays first in a round.',
    ],
  },
  {
    title: 'Restocking hands',
    lines: [
      "Once every hand is empty, 3 more cards are dealt to each player from the stock - this repeats until the stock itself runs out.",
    ],
  },
  {
    title: 'Making a capture',
    lines: [
      "Playing a card from your hand can capture cards on the table - or, if it captures nothing, it is simply laid face-up on the table instead.",
      'If neither a match nor a sum is possible, the card is laid face-up on the table, to be captured later.',
    ],
  },
  {
    title: 'Capturing: the matching rule',
    lines: [
      "If any table card shares the played card's exact rank, that single matching card is the ONLY legal capture - you may not add up other cards to that rank instead.",
      'Two matches of the same rank on the table: take either one, but still alone.',
    ],
  },
  {
    title: 'Capturing: adding up',
    lines: [
      'If no table card matches the rank, you may capture any combination of table cards whose ranks add up exactly to the played card\'s rank.',
    ],
    cards: [
      { id: cardId(BASTONI, 7), label: 'Played: 7' },
      { id: cardId(DENARI, 3), label: '3' },
      { id: cardId(COPPE, 4), label: '4' },
    ],
    cardsCaption: '3 + 4 = 7: a legal sum capture',
  },
  {
    title: 'The scopa bonus, and leftover cards',
    lines: [
      'A "scopa" ("broom") is capturing every last card off the table at once, sweeping it clean. It earns one extra point on top of the round\'s scoring.',
      "Exception: clearing the table on the very last play of a round - once the stock and every player's hand are finally empty - is NOT a scopa. There is no bonus point for that particular sweep.",
      'If a round ends with cards still sitting on the table (stock and every hand empty), those leftover cards all go to whichever player or team made the LAST capture of the round - never split, never discarded.',
    ],
  },
  {
    title: 'Scoring a round: overview',
    lines: [
      'At the end of each round, four categories are judged, one point each. A tie for the most in a category (or nobody having any) awards NOBODY that point.',
    ],
  },
  {
    title: 'Scoring: carte and denari',
    lines: [
      'Carte - the side that captured the most cards overall.',
      'Denari - the side that captured the most cards of the coins (denari) suit.',
    ],
  },
  {
    title: 'Scoring: the settebello',
    lines: [
      'Settebello - whoever captured the 7 of denari. Automatic, and never a tie, since there is only one such card in the deck.',
    ],
    cards: [{ id: SETTEBELLO, label: 'Settebello' }],
  },
  {
    title: 'Scoring: the primiera',
    lines: [
      "Primiera - the side with the higher Primiera total (see the values page) - but ONLY if that side holds at least one card of every one of the 4 suits. A side missing a suit entirely cannot win this point at all.",
    ],
  },
  {
    title: 'Scoring: the scopa bonus',
    lines: [
      'On top of those four categories, each side also scores one point for every scopa it made during the round.',
    ],
  },
  {
    title: 'Winning the match',
    lines: [
      'Before a match begins, the target score is set to either 11 or 21 points, in Settings.',
      'After each round is scored, if exactly one side has reached the target score, that side wins the match at once.',
      'If two or more sides are tied at or above the target once a round\'s points are added, nobody wins yet - the match continues with another round, until a single side is clearly, solely ahead at or past the target.',
    ],
  },
];
