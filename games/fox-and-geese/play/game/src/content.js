// Exhaustive Rules reference. Every claim here is cross-checked against rules.js (the single
// source of truth for legality) so this page can never contradict the engine. `piece: 'F' | 'G'`
// shows that piece's real in-game sprite via the game's own drawFox()/drawGoose(), never a
// separate icon (see view.js's 'rules' scene).
// Each page holds a small number of complete sentences (not hand-wrapped fragments) so the
// reader-card view can wrap them cleanly at any of the three text-size steps without an awkward
// mid-sentence break. Longer topics (the fox's two rules, the two ways to win) are split across
// two single-concept pages rather than packed into one, so every page reads comfortably even at
// the largest text size (checked by rendering every page at the top step - see STATUS.md).
export const RULES = [
  {
    title: 'The board and setup',
    lines: [
      'Fox and Geese is played on a cross-shaped board of 33 points. Every point is joined only to its orthogonal (up/down/left/right) neighbours - this board has no diagonal lines at all.',
      'The classic game starts with 13 geese filling the two rows nearest their own edge plus the whole row above them, and a single fox standing on the centre point.',
      'The geese always move first.',
    ],
  },
  {
    title: 'Choosing a flock',
    lines: [
      'Before a game you may change how many geese start on the board: 7, 9, 11, 13 (classic), 15 or 17.',
      'The two rows nearest the geese are always full, six geese. A smaller flock leaves the row above them partly empty, filled from the middle outward; 13 fills that whole row.',
      'A bigger flock than 13 adds extra geese into the fox\'s own row, from the corners inward.',
      'More geese makes the geese\' side stronger - a smaller flock is harder for the geese and easier for the fox.',
    ],
  },
  {
    title: 'The fox',
    piece: 'F',
    lines: [
      'One fox tries to capture enough geese that the rest can no longer close in on it.',
      'The fox moves one point at a time, straight along a line - up, down, left or right, never diagonally.',
    ],
  },
  {
    title: 'How the fox captures',
    piece: 'F',
    lines: [
      'The fox may instead capture, by jumping over an adjacent goose onto the empty point beyond it - see "Capturing a goose" below for exactly how a jump works, and how the fox can jump more than once in the same turn.',
      'Capturing is never forced: the fox may always choose to step instead of jumping, except in the middle of a chain of jumps, where it must jump again or stop.',
    ],
  },
  {
    title: 'The goose',
    piece: 'G',
    lines: [
      'The geese try to close in on the fox until it has nowhere left to move.',
      'A goose moves one point at a time, forward (toward the fox\'s side of the board) or sideways - never backward, and never diagonally.',
      'A goose never jumps and never captures another piece.',
    ],
  },
  {
    title: 'Capturing a goose',
    lines: [
      'The fox captures by jumping over one goose standing on an adjacent point, landing on the empty point directly beyond it in the same straight line. The jumped goose is removed at once.',
      'A goose is safe from a given direction whenever there is nowhere to land: the landing point falls off the board, or another piece already occupies it - a goose backed by another goose cannot be jumped from that side.',
    ],
  },
  {
    title: 'Chains of captures',
    lines: [
      'If, from the point it just landed on, the fox has another jump available, it may keep jumping in the same turn - a chain of captures - or tap Stop to end its turn there instead.',
      'Once in the middle of a chain, the fox is no longer free to just step away: it must either jump again or stop.',
    ],
  },
  {
    title: 'How the fox wins',
    piece: 'F',
    lines: [
      'The fox wins once the geese are reduced to 5 or fewer, wherever those geese are: too few are left to ever close every gap around it.',
      'The fox also wins, more rarely, if it becomes the geese\'s turn and no goose anywhere has a legal move left to make.',
    ],
  },
  {
    title: 'How the geese win',
    piece: 'G',
    lines: [
      'The geese win the instant it becomes the fox\'s turn and the fox has no legal move at all - completely trapped.',
      'There is no other way to win: reaching the fox-wins goose count, or fully trapping a side, are the only two results.',
    ],
  },
  {
    title: 'Draws',
    lines: [
      'If the exact same position - the same pieces on the same points, with the same side to move - occurs for the third time, the game is drawn at once. Nobody wins.',
      'A position is only checked for repetition when nobody is in the middle of a capture chain.',
    ],
  },
];
