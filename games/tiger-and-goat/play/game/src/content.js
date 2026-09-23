// Exhaustive Rules reference, read on the Rules screen (a framed, paginated reference card - see
// view.js's 'rules' scene). Every claim here is cross-checked against rules.js (the single source
// of truth for legality) so this page can never contradict the engine. `piece: 'T' | 'G'` shows
// that piece's real in-game sprite via the game's own drawTiger()/drawGoat(), never a separate
// icon. Pages are kept short and single-concept on purpose so every one of them stays comfortable
// to read even at the top text-size step (see TEXT_SCALES in layout.js).
export const RULES = [
  {
    title: 'The board',
    lines: [
      'Tiger and Goat (Bagh-chal) is played on a board of 25 points, joined by straight lines.',
      'Every point connects to its up, down, left and right neighbours.',
      'Some points also connect to their diagonal corners - only where a line is actually drawn.',
    ],
  },
  {
    title: 'Setup',
    lines: [
      'Four tigers start on the board, one on each corner point.',
      'All twenty goats begin off the board, waiting to be placed.',
      'The goats move first.',
    ],
  },
  {
    title: 'The tiger',
    piece: 'T',
    lines: [
      'Four tigers hunt the goats, and win by trapping or capturing them all.',
      'A tiger steps one point along any line - orthogonal or diagonal - to an empty neighbour.',
      'A tiger can also jump to capture a goat: see the next two pages.',
    ],
  },
  {
    title: 'What a tiger cannot do',
    lines: [
      'A tiger can never move onto a point another tiger or a goat already occupies.',
      'A tiger can never jump over another tiger - only over a goat.',
    ],
  },
  {
    title: 'The goat',
    piece: 'G',
    lines: [
      'Twenty goats try to hem in the tigers until not one of them can move.',
      'A goat never jumps and never captures.',
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
      "Each of its first twenty turns places one new goat on any empty point of the player's choice.",
      'Only once the twentieth goat is placed do goats begin moving instead of being placed.',
    ],
  },
  {
    title: 'Tigers during placement',
    lines: [
      'Tigers already move and capture normally while goats are still being placed.',
      'A goat already on the board can be captured even before all twenty are placed.',
    ],
  },
  {
    title: 'How a capture works',
    lines: [
      'A tiger captures by jumping over an adjacent goat, landing on the empty point directly beyond it.',
      'The landing point must be in the same straight line - orthogonal or diagonal - the tiger used to reach the goat.',
      'This removes the jumped goat at once. A tiger jumps over only one goat per move - there is no chain of jumps.',
    ],
  },
  {
    title: 'When a goat is safe',
    lines: [
      'A goat is safe from a direction whenever the tiger has nowhere to land.',
      'That means the landing point falls off the board, or another piece already occupies it.',
      'A goat backed by another goat cannot be jumped from that side.',
    ],
  },
  {
    title: 'How the tigers win',
    piece: 'T',
    lines: [
      'The tigers win the instant every goat has been captured - none may remain, waiting or on the board.',
      "The tigers also win, more rarely, if it becomes the goats' turn and the goat side has no legal move left.",
    ],
  },
  {
    title: 'How the goats win',
    piece: 'G',
    lines: [
      "The goats win the instant it becomes a tiger's turn and not one of the four tigers has any legal move at all.",
      'There is no separate win for capturing only some goats - it is the same game, with no capture limit that ends it early.',
    ],
  },
  {
    title: 'Draws',
    lines: [
      'Once all twenty goats are placed, if the exact same position occurs for the third time, the game is drawn.',
      'The same position means the same pieces on the same points, with the same side to move.',
      'Repetition is only tracked once every goat is on the board.',
    ],
  },
];
