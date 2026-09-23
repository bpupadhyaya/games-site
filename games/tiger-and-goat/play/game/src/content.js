// Exhaustive Rules reference, read on the Rules screen (a framed, paginated reference card - see
// view.js's 'rules' scene). Every claim here is cross-checked against rules.js (the single source
// of truth for legality) so this page can never contradict the engine. `piece: 'T' | 'G'` shows
// that piece's real in-game sprite via the game's own drawTiger()/drawGoat(), never a separate
// icon. Pages are kept to one short paragraph each on purpose - at the 300% top text-size step
// (see TEXT_SCALES in layout.js) the panel's fixed pixel budget only comfortably holds about one
// sentence per page, so this pass (2026-09-22, text-size-300 request) split every remaining
// multi-sentence page down further; a couple of single sentences that were still too long for a
// piece-portrait page were split at their natural clause break (documented in STATUS.md).
export const RULES = [
  {
    title: 'The board',
    lines: [
      'Tiger and Goat (Bagh-chal) is played on a board of 25 points, joined by straight lines.',
    ],
  },
  {
    title: 'How the points connect',
    lines: [
      'Every point connects to its up, down, left and right neighbours.',
    ],
  },
  {
    title: 'Diagonal points',
    lines: [
      'Some points also connect to their diagonal corners - only where a line is actually drawn.',
    ],
  },
  {
    title: 'Setup',
    lines: [
      'Four tigers start on the board, one on each corner point.',
    ],
  },
  {
    title: 'Setup: the goats',
    lines: [
      'All twenty goats begin off the board, waiting to be placed.',
      'The goats move first.',
    ],
  },
  {
    title: 'The tiger',
    piece: 'T',
    lines: [
      'Four tigers hunt the goats, and win by trapping or capturing them all.',
    ],
  },
  {
    title: 'How a tiger moves',
    lines: [
      'A tiger steps one point along any line - orthogonal or diagonal - to an empty neighbour.',
    ],
  },
  {
    title: "A tiger's jump",
    lines: [
      'A tiger can also jump to capture a goat - capturing is covered later in this reference.',
    ],
  },
  {
    title: 'What a tiger cannot do',
    lines: [
      'A tiger can never move onto a point another tiger or a goat already occupies.',
    ],
  },
  {
    title: 'No jumping over tigers',
    lines: [
      'A tiger can never jump over another tiger - only over a goat.',
    ],
  },
  {
    title: 'The goat',
    piece: 'G',
    lines: [
      'Twenty goats try to hem in the tigers until not one of them can move.',
    ],
  },
  {
    title: 'A goat cannot capture',
    lines: [
      'A goat never jumps and never captures.',
    ],
  },
  {
    title: 'How a goat moves',
    lines: [
      'Once on the board, a goat steps one point along any line to an empty neighbour.',
    ],
  },
  {
    title: 'What a goat cannot do',
    lines: [
      'A goat can never move onto a point another goat or a tiger already occupies.',
    ],
  },
  {
    title: 'Placing the goats',
    lines: [
      'The goat side does not move any goat until all twenty are on the board.',
    ],
  },
  {
    title: 'One goat per turn',
    lines: [
      "Each of its first twenty turns places one new goat on any empty point of the player's choice.",
    ],
  },
  {
    title: 'When placement ends',
    lines: [
      'Only once the twentieth goat is placed do goats begin moving instead of being placed.',
    ],
  },
  {
    title: 'Tigers during placement',
    lines: [
      'Tigers already move and capture normally while goats are still being placed.',
    ],
  },
  {
    title: 'Early captures allowed',
    lines: [
      'A goat already on the board can be captured even before all twenty are placed.',
    ],
  },
  {
    title: 'How a capture works',
    lines: [
      'A tiger captures by jumping over an adjacent goat, landing on the empty point directly beyond it.',
    ],
  },
  {
    title: "A capture's landing point",
    lines: [
      'The landing point must be in the same straight line the tiger used to reach the goat.',
    ],
  },
  {
    title: 'Orthogonal or diagonal',
    lines: [
      'That line can be orthogonal or diagonal - whichever line the tiger jumped along.',
    ],
  },
  {
    title: 'One goat per jump',
    lines: [
      'This removes the jumped goat at once. A tiger jumps over only one goat per move.',
    ],
  },
  {
    title: 'No chain jumps',
    lines: [
      'There is no chain of jumps: a tiger cannot jump twice in the same move.',
    ],
  },
  {
    title: 'When a goat is safe',
    lines: [
      'A goat is safe from a direction whenever the tiger has nowhere to land.',
    ],
  },
  {
    title: 'A blocked landing',
    lines: [
      'That means the landing point falls off the board, or another piece already occupies it.',
    ],
  },
  {
    title: 'A goat backed by a goat',
    lines: [
      'A goat backed by another goat cannot be jumped from that side.',
    ],
  },
  {
    title: 'How the tigers win',
    piece: 'T',
    lines: [
      'The tigers win the instant every goat has been captured.',
    ],
  },
  {
    title: 'No goats may remain',
    lines: [
      'Not one goat may remain, waiting or on the board.',
    ],
  },
  {
    title: "The tigers' other win",
    lines: [
      "The tigers also win, more rarely, if it becomes the goats' turn.",
    ],
  },
  {
    title: 'When the goats are stuck',
    lines: [
      'That other win happens if the goat side then has no legal move left at all.',
    ],
  },
  {
    title: 'How the goats win',
    piece: 'G',
    lines: [
      "The goats win the instant it becomes a tiger's turn.",
    ],
  },
  {
    title: 'No legal move at all',
    lines: [
      'Not one of the four tigers may have any legal move at all.',
    ],
  },
  {
    title: 'No partial win for goats',
    lines: [
      'There is no separate win for capturing only some goats - it is the same game.',
    ],
  },
  {
    title: 'No early capture limit',
    lines: [
      'There is no capture limit that ends the game early.',
    ],
  },
  {
    title: 'Draws',
    lines: [
      'Once all twenty goats are placed, if the exact same position occurs for the third time, the game is drawn.',
    ],
  },
  {
    title: 'Same position, defined',
    lines: [
      'The same position means the same pieces on the same points, with the same side to move.',
    ],
  },
  {
    title: 'What counts as repeated',
    lines: [
      'Repetition is only tracked once every goat is on the board.',
    ],
  },
];
