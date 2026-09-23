// Exhaustive Rules reference (the title screen's "How to Play" overlay gained a third "Rules"
// tab). Every claim here is cross-checked against rules/battle.js and rules/run.js - the actual
// simulation - so this page can never contradict the engine. This is additive to, and separate
// from, the existing brief HOW_TO_PLAY tips and the ABOUT/Covenant text: it goes exhaustive where
// those stay short. `demo` tags a small illustration the help overlay draws for that page, using
// the game's own drawCard()/drawRing() - never a separate icon.
export const RULES_REFERENCE = [
  {
    title: 'The road',
    lines: [
      'A run has three Acts. Each Act is six steps of the road, then a boss fight.',
      'At most steps you choose one of several doors: an easy or normal fight, a tougher Elite',
      'fight (better rewards), an Envoy (a one-off story choice), a Camp (rest and recover), or the',
      'Tuner (a travelling shop). Which doors are on offer, and how many, changes step by step.',
      'Win a fight and you are offered a choice of new cards for your quiver (or Marks instead, if',
      'you would rather skip them all).',
    ],
  },
  {
    title: 'Arrows and Techniques',
    demo: 'cards',
    lines: [
      'Every card you can play is one of two kinds.',
      'An Arrow is named and strong. Loose it and it is Spent: gone from your quiver for the rest',
      'of the run, win or lose.',
      'A Technique is modest but comes back - played, it goes to your discard pile and returns',
      'when you reshuffle, fight after fight, for as long as the run lasts.',
      'Choose your shots with that in mind: an Arrow is a one-time promise, a Technique is a habit.',
    ],
  },
  {
    title: 'Your turn',
    lines: [
      'Each turn you draw 5 cards (up to a 7-card hand) and get 3 Focus to spend - most cards cost',
      '1 or 2 Focus to play.',
      'Press a card, pull it down like a bowstring, and let go to play it - or tap it twice.',
      'Cards you do not play are discarded at the end of your turn, unless the card itself says it',
      'stays in hand. Then every living enemy acts out the intent it showed you.',
      'A fight can hold up to three enemies at once.',
    ],
  },
  {
    title: 'The element ring',
    demo: 'ring',
    lines: [
      'Every attack, and every card with an element, belongs to one of six elements: Tide, Ember,',
      'Stone, Gale, Storm and Flare.',
      'Each element answers exactly one other, in a closed ring: Tide answers Ember, Ember answers',
      'Stone, Stone answers Gale, Gale answers Storm, Storm answers Flare, and Flare answers Tide.',
      'Playing a card of the answering element against a matching attack cancels that attack',
      'outright - and if the card is an Arrow, it also strikes for 50% more damage (a riposte).',
      'A Ward card answers any attack of its own element the instant it is played; if nothing',
      'matches, it gives you Guard instead.',
    ],
  },
  {
    title: 'Guard and status effects',
    lines: [
      'Guard absorbs damage before your Resolve (your health) does, point for point, and empties',
      'at the start of your next turn.',
      'Weak halves the damage you (or an enemy) deal while it lasts, for a set number of turns.',
      'Exposed increases the damage you (or an enemy) take by 50% while it lasts.',
      'Strength adds flatly to an enemy\'s own attack values, and can build up turn after turn on',
      'enemies that feed on damage you deal them.',
      'A stunned enemy skips its attack that turn; a boss cannot be stunned outright, but its',
      'attack is halved instead.',
    ],
  },
  {
    title: 'The Foul Shot and the Covenant',
    lines: [
      'You may fire one Foul Shot per fight: a guaranteed hit for 40% of the target\'s full health',
      'that cannot be answered or guarded against. Some drafted cards are Foul the same way.',
      'Firing one - or playing a Foul card - breaks the Covenant: your Standing falls by one and',
      'never returns by itself for the rest of the run.',
      'Standing starts at 3 and only ever falls (an Envoy choice can raise it back, rarely). It',
      'adds 25 points per level to your Legend score at the end of the run.',
      'Staying Unblemished (never breaking the Covenant) earns real rewards along the way: an extra',
      'card on your very first turn of every fight, and bonus effects on cards that reward it.',
    ],
  },
  {
    title: 'Debts',
    lines: [
      'A Debt gives you real power the moment you take it - Marks, healing, a rare Arrow, and more',
      '- in exchange for a price that comes due during your final boss fight of the run (on your',
      'second or third turn), such as losing Guard, losing Resolve, or having a costly Arrow',
      'Spent for nothing.',
      'You may settle a Debt early at a Camp, paying 5 maximum Resolve to cancel it before it can',
      'ever come due. Every Debt still owed at the end of the run costs 30 Legend.',
    ],
  },
  {
    title: 'Camp, the Envoy and the Tuner',
    lines: [
      'A Camp lets you do one thing: rest and heal a share of your maximum Resolve, permanently',
      'remove one Technique from your quiver for free, or settle a Debt.',
      'An Envoy is a one-off story choice with real effects - Marks, an Arrow, a Debt, and',
      'sometimes a cost.',
      'The Tuner sells three cards for Marks (your currency, earned from fights and events) and',
      'can also remove a Technique from your quiver for a price.',
    ],
  },
  {
    title: 'Oaths',
    lines: [
      'Before a run you may add an Oath: a numbered ladder of extra vows, each one harder than the',
      'last. Choosing Oath N applies every vow from 1 up to N at once, all for the same run.',
      'Vows include starting with no Marks, one fewer Arrow, weaker camps, a Debt already taken,',
      'stronger or tougher enemies, fewer reward choices, fewer starting Reed Shafts, a lower',
      'maximum Resolve, and harder Elite fights.',
      'Oaths make the run harder on purpose, for players who want more of a challenge - not a',
      'requirement to finish the game.',
    ],
  },
  {
    title: 'Winning, losing and your Legend',
    lines: [
      'You lose the moment your Resolve reaches 0 in any fight. You win the run by defeating the',
      'third Act\'s boss.',
      'Every run - won or lost - ends with a Legend score: the value of every card still in your',
      'quiver, plus 25 per point of Standing, your remaining Resolve, one point per 5 Marks held,',
      'and 100 more for actually finishing all three Acts - minus 30 for every Debt still owed.',
      'The Tuner\'s Book records your best Legend for each Oath you have played, separately.',
    ],
  },
];
