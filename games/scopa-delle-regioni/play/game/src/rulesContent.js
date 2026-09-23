// Exhaustive Scopa rules reference, paginated like the About/Controls pages. Every claim here is
// cross-checked against the actual implementation in rules.js (the single source of truth for
// legality and scoring) so this page can never contradict the engine. Split one short clause per
// page (most pages here cover what used to be one sentence, or even one page, each) so every page
// still fits comfortably at the largest text-size step, 300% - verified by rendering, not assumed.
// Only the first page introducing a set of card illustrations carries them; later pages on the
// same topic are text-only, which buys them the larger no-illustration text budget.
import { cardId, SETTEBELLO } from './rules.js';

const DENARI = 0, COPPE = 1, SPADE = 2, BASTONI = 3;

export const RULES = [
  {
    title: 'The deck',
    lines: ['Scopa is played with a 40-card Italian deck in four suits.'],
    cards: [
      { id: cardId(DENARI, 1), label: 'Denari (coins)' },
      { id: cardId(COPPE, 1), label: 'Coppe (cups)' },
      { id: cardId(SPADE, 1), label: 'Spade (swords)' },
      { id: cardId(BASTONI, 1), label: 'Bastoni (batons)' },
    ],
  },
  {
    title: 'Ten ranks',
    lines: ['Each suit runs Ace through 7, then three court cards: Fante, Cavallo and Re.'],
  },
  {
    title: 'Counted high',
    lines: ['Fante, Cavallo and Re count as 8, 9 and 10.'],
  },
  {
    title: 'No 8s, 9s or 10s',
    lines: ['There are no separate 8, 9 or 10 pip cards.'],
  },
  {
    title: '40 cards total',
    lines: ['That is 10 ranks in each of the 4 suits, 40 cards in all.'],
  },
  {
    title: 'Original artwork',
    lines: ["This game's card art is an original set of drawings made for it."],
  },
  {
    title: 'Not historic',
    lines: ['It is not a copy of any historic regional pattern.'],
  },
  {
    title: 'Two card values',
    lines: ['Every card has a rank from 1 (Ace) to 10 (Re).'],
    cards: [
      { id: SETTEBELLO, label: 'Capture rank 7 - Primiera 21' },
      { id: cardId(SPADE, 10), label: 'Capture rank 10 - Primiera 10' },
    ],
  },
  {
    title: 'What rank does',
    lines: ['Rank is what a card captures with - the next page explains capturing.'],
  },
  {
    title: 'Primiera scale',
    lines: ['A separate scale is used only for the Primiera scoring category, explained later.'],
  },
  {
    title: 'Primiera: 7 and 6',
    lines: ['On that scale, a 7 is worth 21 and a 6 is worth 18.'],
  },
  {
    title: 'Ace and 5',
    lines: ['An Ace is worth 16 and a 5 is worth 15.'],
  },
  {
    title: '4, 3 and 2',
    lines: ['A 4 is worth 14, a 3 is worth 13, and a 2 is worth 12.'],
  },
  {
    title: 'Court card value',
    lines: ['Fante, Cavallo and Re are worth only 10 each on this scale.'],
  },
  {
    title: 'Scales disagree',
    lines: ['The two scales disagree on purpose.'],
  },
  {
    title: 'Re beats a 7',
    lines: ['For capturing, a Re (rank 10) outranks a 7.'],
  },
  {
    title: '7 beats Re',
    lines: ['For Primiera, a 7 is worth more than double a Re.'],
  },
  {
    title: 'Starting a round',
    lines: ['To start a round, 4 cards are dealt face-up to the table.'],
    cards: [
      { id: cardId(DENARI, 3), label: '' },
      { id: cardId(COPPE, 7), label: '' },
      { id: cardId(SPADE, 5), label: '' },
      { id: cardId(BASTONI, 9), label: '' },
    ],
    cardsCaption: 'An opening table: four cards dealt face-up',
  },
  {
    title: 'Cards to hand',
    lines: ['Each player is also dealt 3 cards to their hand.'],
  },
  {
    title: 'Playing alone',
    lines: ['With 2 players, each plays alone.'],
  },
  {
    title: 'Team play',
    lines: ['With 4 players, two fixed partnerships form by seat parity.'],
  },
  {
    title: 'Team seating',
    lines: ['Seats 0 and 2 are one team, seats 1 and 3 the other.'],
  },
  {
    title: 'Too many kings',
    lines: ['If the face-up deal would put 3 or more Re on the table,'],
  },
  {
    title: 'Redeal the table',
    lines: ['the whole table is re-shuffled and re-dealt.'],
  },
  {
    title: 'Until it is fixed',
    lines: ['This repeats until fewer than 3 Re land there.'],
  },
  {
    title: 'Turn order',
    lines: ['Turns pass around the table in fixed seat order: 0, 1, 2, 3, back to 0.'],
  },
  {
    title: 'Who plays first',
    lines: ["The seat to the dealer's left always plays first in a round."],
  },
  {
    title: 'Restocking hands',
    lines: ['Once every hand is empty, 3 more cards are dealt from the stock.'],
  },
  {
    title: 'Stock runs out',
    lines: ['This repeats until the stock itself runs out.'],
  },
  {
    title: 'Playing a card',
    lines: ['Playing a card from your hand can capture cards on the table.'],
  },
  {
    title: 'Nothing works',
    lines: ['If no match or sum works, the card is laid face-up.'],
  },
  {
    title: 'Laid for later',
    lines: ['It stays there, to be captured later.'],
  },
  {
    title: 'A matching card',
    lines: ["If a table card shares the played card's exact rank,"],
  },
  {
    title: 'Only legal move',
    lines: ['that single matching card is the only legal capture.'],
  },
  {
    title: 'Not added up',
    lines: ['You may not add up other cards to that rank instead.'],
  },
  {
    title: 'Two matches',
    lines: ['With two matches of the same rank, take either one - but still alone.'],
  },
  {
    title: 'Adding up',
    lines: ['If no table card matches the rank,'],
    cards: [
      { id: cardId(BASTONI, 7), label: 'Played: 7' },
      { id: cardId(DENARI, 3), label: '3' },
      { id: cardId(COPPE, 4), label: '4' },
    ],
    cardsCaption: '3 + 4 = 7: a legal sum capture',
  },
  {
    title: 'Any combination',
    lines: ['you may capture any combination of table cards'],
  },
  {
    title: 'Equals the rank',
    lines: ["whose ranks add up exactly to the played card's rank."],
  },
  {
    title: 'What is a scopa',
    lines: ['A "scopa" ("broom") is capturing every last card off the table at once.'],
  },
  {
    title: 'Sweeping bonus',
    lines: ["It earns one extra point on top of the round's scoring."],
  },
  {
    title: 'One exception',
    lines: ['Exception: clearing the table on the very last play of a round'],
  },
  {
    title: 'Hands all empty',
    lines: ['once the stock and every hand are finally empty'],
  },
  {
    title: 'Not a scopa',
    lines: ['is NOT a scopa - no bonus point for that particular sweep.'],
  },
  {
    title: 'Cards left behind',
    lines: ['If a round ends with cards still on the table,'],
  },
  {
    title: 'Once all empty',
    lines: ['once the stock and every hand are empty,'],
  },
  {
    title: 'Who gets them',
    lines: ['those leftover cards all go to whoever made the last capture,'],
  },
  {
    title: 'Never split',
    lines: ['never split, and never discarded.'],
  },
  {
    title: 'Four categories',
    lines: ['At the end of each round, four categories are judged, one point each.'],
  },
  {
    title: 'No point on a tie',
    lines: ['A tie for the most in a category awards nobody that point.'],
  },
  {
    title: 'Scoring: carte',
    lines: ['Carte - the side that captured the most cards overall.'],
  },
  {
    title: 'Scoring: denari',
    lines: ['Denari - the side that captured the most cards of the coins (denari) suit.'],
  },
  {
    title: 'The settebello',
    lines: ['Settebello - whoever captured the 7 of denari.'],
    cards: [{ id: SETTEBELLO, label: 'Settebello' }],
  },
  {
    title: 'Never a tie',
    lines: ['Automatic, and never a tie.'],
  },
  {
    title: 'Only one card',
    lines: ['There is only one such card in the deck.'],
  },
  {
    title: 'Primiera point',
    lines: ['Primiera goes to the side with the higher Primiera total.'],
  },
  {
    title: 'Needs all suits',
    lines: ['but only if that side holds at least one card of every suit.'],
  },
  {
    title: 'Missing a suit',
    lines: ['A side missing a suit entirely cannot win this point.'],
  },
  {
    title: 'Scopa points too',
    lines: ['On top of those four categories,'],
  },
  {
    title: 'Point per scopa',
    lines: ['each side scores one point for every scopa it made.'],
  },
  {
    title: 'Target score',
    lines: ['Before a match begins, the target score is set to 11 or 21, in Settings.'],
  },
  {
    title: 'Reaching target',
    lines: ['After each round, if exactly one side has reached the target,'],
  },
  {
    title: 'That side wins',
    lines: ['that side wins the match at once.'],
  },
  {
    title: 'A tie at target',
    lines: ['If two or more sides are tied at or above the target,'],
  },
  {
    title: 'Play continues',
    lines: ['nobody wins yet - the match continues with another round,'],
  },
  {
    title: 'Clearly ahead',
    lines: ['until a single side is clearly, solely ahead at or past the target.'],
  },
];
