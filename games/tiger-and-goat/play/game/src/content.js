// Exhaustive Rules reference. Every claim here is cross-checked against rules.js (the single
// source of truth for legality) so this page can never contradict the engine. `piece: 'T' | 'G'`
// shows that piece's real in-game sprite via the game's own drawTiger()/drawGoat(), never a
// separate icon (see view.js's 'rules' scene).
export const RULES = [
  {
    title: 'The board and setup',
    lines: [
      'Tiger and Goat (Bagh-chal) is played on a board of 25 points, 5 by 5, joined by straight',
      'lines. Every point is joined to its orthogonal (up/down/left/right) neighbours; some points',
      'are also joined diagonally to their corner neighbours - only where a diagonal line is',
      'actually drawn on the board, not every point has one.',
      'Four tigers start on the board, one on each corner point. All twenty goats begin off the',
      'board, waiting to be placed.',
      'The goats move first.',
    ],
  },
  {
    title: 'The tiger',
    piece: 'T',
    lines: [
      'Four tigers hunt the goats and try to capture enough of them to leave the rest unable to',
      'trap them.',
      'A tiger moves one step along any line from its point to a neighbouring empty point -',
      'orthogonal or diagonal, wherever a line joins them.',
      'A tiger may instead capture: see the next few pages for exactly how a jump works and when',
      'a goat is safe from it.',
      'A tiger can never move onto a point another tiger or a goat already occupies, and it can',
      'never jump over another tiger.',
    ],
  },
  {
    title: 'The goat',
    piece: 'G',
    lines: [
      'Twenty goats try to hem in the tigers until not one of them can move anywhere.',
      'A goat never jumps and never captures. Once on the board, it moves one step along any line',
      'to a neighbouring empty point - orthogonal or diagonal, wherever a line joins them.',
      'A goat can never move onto a point another goat or a tiger already occupies.',
    ],
  },
  {
    title: 'Placing the goats',
    lines: [
      'The goat side does not move any goat until all twenty are on the board. Instead, each of',
      'its first twenty turns places one new goat on any empty point of the player\'s choice.',
      'Tigers already move and capture normally while goats are still being placed - the goat side',
      'has no goats to move yet, only new ones to place, but its goats already on the board can',
      'already be captured.',
      'Only once the twentieth goat is placed do goats begin moving instead of being placed.',
    ],
  },
  {
    title: 'Capturing a goat',
    lines: [
      'A tiger captures by jumping over one goat standing on an adjacent point, landing on the',
      'empty point directly beyond it in the same straight line - the same kind of line (orthogonal',
      'or diagonal) the tiger stepped along to reach the goat.',
      'This removes the jumped goat from the board at once. A tiger jumps over exactly one goat',
      'per move - there is no chain of multiple jumps in one turn.',
      'A goat is safe from a given direction whenever there is nowhere for the tiger to land: the',
      'landing point falls off the edge of the board, or another piece (goat or tiger) already',
      'occupies it. A goat backed by another goat, in particular, cannot be jumped from that side.',
    ],
  },
  {
    title: 'Winning the game',
    lines: [
      'The tigers win the instant every goat has been captured - whether still waiting to be',
      'placed or already on the board, none may remain.',
      'The goats win the instant it becomes a tiger\'s turn and not one of the four tigers has any',
      'legal move at all - completely and simultaneously trapped.',
      'The tigers also win, more rarely, if it becomes the goats\' turn and the goat side has no',
      'legal move at all left to make - the mirror image of the goats\' own win condition.',
      'There is no separate win condition for capturing only some of the goats: this is the one',
      'rule for every game, with no capture limit that ends it early.',
    ],
  },
  {
    title: 'Draws',
    lines: [
      'Once all twenty goats have been placed, if the exact same position - the same pieces on the',
      'same points, with the same side to move - occurs for the third time, the game is drawn at',
      'once. Nobody wins.',
      'Repetition is only tracked after every goat is on the board, since no position can repeat',
      'while goats are still being placed one by one.',
    ],
  },
];
