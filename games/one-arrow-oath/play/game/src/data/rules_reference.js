// Exhaustive Rules reference (the title screen's "How to Play" overlay gained a third "Rules"
// tab). Every claim here is cross-checked against rules/battle.js and rules/run.js - the actual
// simulation - so this page can never contradict the engine. This is additive to, and separate
// from, the existing brief HOW_TO_PLAY tips and the ABOUT/Covenant text: it goes exhaustive where
// those stay short. `demo` tags a small illustration the help overlay draws for that page, using
// the game's own drawCard()/drawRing() - never a separate icon.
// Each entry in `lines` is one complete paragraph (the renderer wraps it and adds a gap after it),
// never a hand-wrapped fragment of a longer sentence - a fragment would waste an extra gap and,
// at the text-size stepper's bigger steps, push a page's content past the panel.
//
// Split at sentence, then clause (comma/colon/dash/parenthesis), boundaries for the 300%
// text-size step (owner request, 2026-09-22, raised mid-pass from an original 200% target):
// nearly every one of the original 18 topics had at least one sentence too tall for a single page
// at 300%; a first pass splitting to roughly sentence-level (18 -> 67 pages) still left about a
// third of pages overflowing, since a chunk of even ~15-20 words can wrap past the panel at 300%
// depending on word length (long or hyphenated words such as "Unblemished" or "7-card" wrap far
// less densely than short ones). A second, finer pass (this one, -> 114 pages) keeps every chunk
// to roughly 10 words or fewer, verified by actually rendering all 114 pages. Every split still
// breaks only where the original sentence already had a comma, colon, dash, semicolon or
// parenthesis - never mid-word, never rephrased - so reading a topic's pages in order, Next after
// Next, reproduces the exact original sentence with nothing added, removed or reordered. Three
// topics that mixed two or three concepts under one heading (Arrows and Techniques, The element
// ring, Camp/Envoy/Tuner) were split one page per concept, each with its own short title, for the
// same reason pagination elsewhere in this overlay already paces "one concept per page" -
// Guard/Weak/Exposed likewise. See STATUS.md for why 114 pages (from an original 18) is the
// correct trade at 300% rather than shrinking any font.
export const RULES_REFERENCE = [
  {
    title: 'The road',
    lines: [
      'A run has three Acts. Each Act is six steps of the road, then a boss fight.',
    ],
  },
  {
    title: 'Choosing a door',
    lines: [
      'At most steps you choose one of several doors:',
    ],
  },
  {
    title: 'Choosing a door',
    lines: [
      'an easy or normal fight,',
    ],
  },
  {
    title: 'Choosing a door',
    lines: [
      'a tougher Elite fight (better rewards),',
    ],
  },
  {
    title: 'Choosing a door',
    lines: [
      'an Envoy (a one-off story choice),',
    ],
  },
  {
    title: 'Choosing a door',
    lines: [
      'a Camp (rest and recover),',
    ],
  },
  {
    title: 'Choosing a door',
    lines: [
      'or the Tuner (a travelling shop).',
    ],
  },
  {
    title: 'Choosing a door',
    lines: [
      'Which doors are on offer, and how many, changes step by step.',
    ],
  },
  {
    title: 'Rewards',
    lines: [
      'Win a fight and you are offered a choice of new cards for your quiver',
    ],
  },
  {
    title: 'Rewards',
    lines: [
      '(or Marks instead, if you would rather skip them all).',
    ],
  },
  {
    title: 'Arrows and Techniques',
    demo: 'cards',
    lines: [],
  },
  {
    title: 'Arrows and Techniques',
    lines: [
      'Every card you can play is one of two kinds.',
    ],
  },
  {
    title: 'An Arrow',
    lines: [
      'An Arrow is named and strong. Loose it and it is Spent:',
    ],
  },
  {
    title: 'An Arrow',
    lines: [
      'gone from your quiver for the rest of the run, win or lose.',
    ],
  },
  {
    title: 'Techniques come back',
    lines: [
      'A Technique is modest but comes back -',
    ],
  },
  {
    title: 'Techniques come back',
    lines: [
      'played, it goes to your discard pile',
    ],
  },
  {
    title: 'Techniques come back',
    lines: [
      'and returns when you reshuffle,',
    ],
  },
  {
    title: 'Techniques come back',
    lines: [
      'fight after fight, for as long as the run lasts.',
    ],
  },
  {
    title: 'Techniques come back',
    lines: [
      'Choose your shots with that in mind:',
    ],
  },
  {
    title: 'Techniques come back',
    lines: [
      'an Arrow is a one-time promise, a Technique is a habit.',
    ],
  },
  {
    title: 'Your turn',
    lines: [
      'Each turn you draw 5 cards',
    ],
  },
  {
    title: 'Your turn',
    lines: [
      '(up to a 7-card hand)',
    ],
  },
  {
    title: 'Your turn',
    lines: [
      'and get 3 Focus to spend -',
    ],
  },
  {
    title: 'Your turn',
    lines: [
      'most cards cost 1 or 2 Focus to play.',
    ],
  },
  {
    title: 'Your turn',
    lines: [
      'Press a card, pull it down like a bowstring, and let go to play it -',
    ],
  },
  {
    title: 'Your turn',
    lines: [
      'or tap it twice.',
    ],
  },
  {
    title: 'End of your turn',
    lines: [
      'Cards you do not play are discarded at the end of your turn,',
    ],
  },
  {
    title: 'End of your turn',
    lines: [
      'unless the card itself says it stays in hand.',
    ],
  },
  {
    title: 'End of your turn',
    lines: [
      'Then every living enemy acts out the intent it showed you.',
    ],
  },
  {
    title: 'End of your turn',
    lines: [
      'A fight can hold up to three enemies at once.',
    ],
  },
  {
    title: 'The element ring',
    demo: 'ring',
    lines: [],
  },
  {
    title: 'The element ring',
    lines: [
      'Every attack, and every card with an element,',
    ],
  },
  {
    title: 'The element ring',
    lines: [
      'belongs to one of six elements:',
    ],
  },
  {
    title: 'The element ring',
    lines: [
      'Tide, Ember, Stone, Gale, Storm and Flare.',
    ],
  },
  {
    title: 'Answering elements',
    lines: [
      'Each element answers exactly one other, in a closed ring:',
    ],
  },
  {
    title: 'Answering elements',
    lines: [
      'Tide answers Ember, Ember answers Stone, Stone answers Gale,',
    ],
  },
  {
    title: 'Answering elements',
    lines: [
      'Gale answers Storm, Storm answers Flare, and Flare answers Tide.',
    ],
  },
  {
    title: 'Answering an attack',
    lines: [
      'Playing a card of the answering element',
    ],
  },
  {
    title: 'Answering an attack',
    lines: [
      'against a matching attack cancels that attack outright -',
    ],
  },
  {
    title: 'Answering an attack',
    lines: [
      'and if the card is an Arrow,',
    ],
  },
  {
    title: 'Answering an attack',
    lines: [
      'it also strikes for 50% more damage (a riposte).',
    ],
  },
  {
    title: 'Answering an attack',
    lines: [
      'A Ward card answers any attack of its own element',
    ],
  },
  {
    title: 'Answering an attack',
    lines: [
      'the instant it is played;',
    ],
  },
  {
    title: 'Answering an attack',
    lines: [
      'if nothing matches, it gives you Guard instead.',
    ],
  },
  {
    title: 'Guard',
    lines: [
      'Guard absorbs damage before your Resolve (your health) does,',
    ],
  },
  {
    title: 'Guard',
    lines: [
      'point for point,',
    ],
  },
  {
    title: 'Guard',
    lines: [
      'and empties at the start of your next turn.',
    ],
  },
  {
    title: 'Weak',
    lines: [
      'Weak halves the damage you (or an enemy) deal',
    ],
  },
  {
    title: 'Weak',
    lines: [
      'while it lasts, for a set number of turns.',
    ],
  },
  {
    title: 'Exposed',
    lines: [
      'Exposed increases the damage you (or an enemy) take',
    ],
  },
  {
    title: 'Exposed',
    lines: [
      'by 50% while it lasts.',
    ],
  },
  {
    title: 'Strength and stun',
    lines: [
      'Strength adds flatly to an enemy\'s own attack values,',
    ],
  },
  {
    title: 'Strength and stun',
    lines: [
      'and can build up turn after turn on enemies',
    ],
  },
  {
    title: 'Strength and stun',
    lines: [
      'that feed on damage you deal them.',
    ],
  },
  {
    title: 'Strength and stun',
    lines: [
      'A stunned enemy skips its attack that turn;',
    ],
  },
  {
    title: 'Strength and stun',
    lines: [
      'a boss cannot be stunned outright, but its attack is halved instead.',
    ],
  },
  {
    title: 'The Foul Shot',
    lines: [
      'You may fire one Foul Shot per fight:',
    ],
  },
  {
    title: 'The Foul Shot',
    lines: [
      'a guaranteed hit for 40% of the target\'s full health',
    ],
  },
  {
    title: 'The Foul Shot',
    lines: [
      'that cannot be answered or guarded against.',
    ],
  },
  {
    title: 'The Foul Shot',
    lines: [
      'Some drafted cards are Foul the same way.',
    ],
  },
  {
    title: 'The Foul Shot',
    lines: [
      'Firing one - or playing a Foul card - breaks the Covenant:',
    ],
  },
  {
    title: 'The Foul Shot',
    lines: [
      'your Standing falls by one and never returns by itself for the rest of the run.',
    ],
  },
  {
    title: 'The Covenant and Standing',
    lines: [
      'Standing starts at 3 and only ever falls',
    ],
  },
  {
    title: 'The Covenant and Standing',
    lines: [
      '(an Envoy choice can raise it back, rarely).',
    ],
  },
  {
    title: 'The Covenant and Standing',
    lines: [
      'It adds 25 points per level to your Legend score at the end of the run.',
    ],
  },
  {
    title: 'The Covenant and Standing',
    lines: [
      'Staying Unblemished (never breaking the Covenant)',
    ],
  },
  {
    title: 'The Covenant and Standing',
    lines: [
      'earns real rewards along the way:',
    ],
  },
  {
    title: 'The Covenant and Standing',
    lines: [
      'an extra card on your very first turn',
    ],
  },
  {
    title: 'The Covenant and Standing',
    lines: [
      'of every fight,',
    ],
  },
  {
    title: 'The Covenant and Standing',
    lines: [
      'and bonus effects on cards that reward it.',
    ],
  },
  {
    title: 'Debts',
    lines: [
      'A Debt gives you real power',
    ],
  },
  {
    title: 'Debts',
    lines: [
      'the moment you take it -',
    ],
  },
  {
    title: 'Debts',
    lines: [
      'Marks, healing, a rare Arrow, and more -',
    ],
  },
  {
    title: 'Debts',
    lines: [
      'in exchange for a price that comes due',
    ],
  },
  {
    title: 'Debts',
    lines: [
      'during your final boss fight of the run',
    ],
  },
  {
    title: 'Debts',
    lines: [
      '(on your second or third turn),',
    ],
  },
  {
    title: 'Debts',
    lines: [
      'such as losing Guard, losing Resolve,',
    ],
  },
  {
    title: 'Debts',
    lines: [
      'or having a costly Arrow Spent for nothing.',
    ],
  },
  {
    title: 'Debts',
    lines: [
      'You may settle a Debt early at a Camp,',
    ],
  },
  {
    title: 'Debts',
    lines: [
      'paying 5 maximum Resolve to cancel it',
    ],
  },
  {
    title: 'Debts',
    lines: [
      'before it can ever come due.',
    ],
  },
  {
    title: 'Debts',
    lines: [
      'Every Debt still owed at the end of the run costs 30 Legend.',
    ],
  },
  {
    title: 'Camp',
    lines: [
      'A Camp lets you do one thing:',
    ],
  },
  {
    title: 'Camp',
    lines: [
      'rest and heal a share of your maximum Resolve,',
    ],
  },
  {
    title: 'Camp',
    lines: [
      'permanently remove one Technique from your quiver for free,',
    ],
  },
  {
    title: 'Camp',
    lines: [
      'or settle a Debt.',
    ],
  },
  {
    title: 'Envoy',
    lines: [
      'An Envoy is a one-off story choice',
    ],
  },
  {
    title: 'Envoy',
    lines: [
      'with real effects -',
    ],
  },
  {
    title: 'Envoy',
    lines: [
      'Marks, an Arrow, a Debt, and sometimes a cost.',
    ],
  },
  {
    title: 'The Tuner',
    lines: [
      'The Tuner sells three cards for Marks',
    ],
  },
  {
    title: 'The Tuner',
    lines: [
      '(your currency, earned from fights and events)',
    ],
  },
  {
    title: 'The Tuner',
    lines: [
      'and can also remove a Technique from your quiver for a price.',
    ],
  },
  {
    title: 'Oaths',
    lines: [
      'Before a run you may add an Oath:',
    ],
  },
  {
    title: 'Oaths',
    lines: [
      'a numbered ladder of extra vows,',
    ],
  },
  {
    title: 'Oaths',
    lines: [
      'each one harder than the last.',
    ],
  },
  {
    title: 'Oaths',
    lines: [
      'Choosing Oath N applies every vow',
    ],
  },
  {
    title: 'Oaths',
    lines: [
      'from 1 up to N at once,',
    ],
  },
  {
    title: 'Oaths',
    lines: [
      'all for the same run.',
    ],
  },
  {
    title: 'Oaths',
    lines: [
      'Vows include starting with no Marks, one fewer Arrow,',
    ],
  },
  {
    title: 'Oaths',
    lines: [
      'weaker camps, a Debt already taken,',
    ],
  },
  {
    title: 'Oaths',
    lines: [
      'stronger or tougher enemies,',
    ],
  },
  {
    title: 'Oaths',
    lines: [
      'fewer reward choices, fewer starting Reed Shafts,',
    ],
  },
  {
    title: 'Oaths',
    lines: [
      'a lower maximum Resolve, and harder Elite fights.',
    ],
  },
  {
    title: 'Oaths are optional',
    lines: [
      'Oaths make the run harder on purpose,',
    ],
  },
  {
    title: 'Oaths are optional',
    lines: [
      'for players who want more of a challenge -',
    ],
  },
  {
    title: 'Oaths are optional',
    lines: [
      'not a requirement to finish the game.',
    ],
  },
  {
    title: 'Winning and losing',
    lines: [
      'You lose the moment your Resolve reaches 0 in any fight.',
    ],
  },
  {
    title: 'Winning and losing',
    lines: [
      'You win the run by defeating the third Act\'s boss.',
    ],
  },
  {
    title: 'Your Legend',
    lines: [
      'Every run - won or lost - ends with a Legend score:',
    ],
  },
  {
    title: 'Your Legend',
    lines: [
      'the value of every card still in your quiver,',
    ],
  },
  {
    title: 'Your Legend',
    lines: [
      'plus 25 per point of Standing, your remaining Resolve,',
    ],
  },
  {
    title: 'Your Legend',
    lines: [
      'one point per 5 Marks held,',
    ],
  },
  {
    title: 'Your Legend',
    lines: [
      'and 100 more for actually finishing all three Acts -',
    ],
  },
  {
    title: 'Your Legend',
    lines: [
      'minus 30 for every Debt still owed.',
    ],
  },
  {
    title: 'Your Legend',
    lines: [
      'The Tuner\'s Book records your best Legend',
    ],
  },
  {
    title: 'Your Legend',
    lines: [
      'for each Oath you have played, separately.',
    ],
  },
];
