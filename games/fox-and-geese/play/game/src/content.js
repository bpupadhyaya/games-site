// Exhaustive Rules reference. Every claim here is cross-checked against rules.js (the single
// source of truth for legality) so this page can never contradict the engine. `piece: 'F' | 'G'`
// shows that piece's real in-game sprite via the game's own drawFox()/drawGoose(), never a
// separate icon (see view.js's 'rules' scene).
//
// RULES pages are single-concept. The text-size stepper was raised to a 300% ceiling
// (text-polish-300 request, 2026-09-22, done in the same session as - and directly
// superseding - an intermediate 200% pass that was never landed). At 300% even one average
// sentence plus the header/title/piece-art chrome fills most of the card, and several of the
// original sentences (some already multi-clause compounds joined by ' - ' or ';') are longer
// than a single page can hold at this size at all. Those were rewritten as two or three short,
// complete sentences preserving the exact same rule content (never reworded to be vaguer or
// to drop a case), each on its own page. Page titles were also shortened for this pass: at
// 300% the (unwrapped, centred) page title needs to fit the card on one line by itself, which
// left room for at most 2-3 short words - every title here was measured against the game's own
// title font/size before being chosen. See STATUS.md for the before/after page count and the
// measurement method (headless Chrome + the view.js wrap/measure code, not guesswork).
export const RULES = [
  {
    title: 'The board',
    lines: [
      'Fox and Geese is played on a cross-shaped board of 33 points.',
    ],
  },
  {
    title: 'No diagonals',
    lines: [
      'Every point is joined only to its orthogonal (up, down, left, right) neighbours.',
    ],
  },
  {
    title: 'Straight lines',
    lines: [
      'This board has no diagonal lines at all.',
    ],
  },
  {
    title: 'Start: geese',
    lines: [
      'The classic game starts with 13 geese filling the two rows nearest their own edge.',
    ],
  },
  {
    title: 'Start: the fox',
    lines: [
      'The extra geese fill the whole row above them.',
      'A single fox stands on the centre point.',
    ],
  },
  {
    title: 'Geese go first',
    lines: [
      'The geese always move first.',
    ],
  },
  {
    title: 'Flock size',
    lines: [
      'Before a game you may change how many geese start on the board: 7, 9, 11, 13 (classic), 15 or 17.',
    ],
  },
  {
    title: 'Two full rows',
    lines: [
      'The two rows nearest the geese are always full, six geese.',
    ],
  },
  {
    title: 'Smaller flocks',
    lines: [
      'A smaller flock leaves the row above them partly empty, filled from the middle outward.',
    ],
  },
  {
    title: 'Filling 13',
    lines: [
      '13 geese fills that whole row.',
    ],
  },
  {
    title: 'Bigger flocks',
    lines: [
      'A bigger flock than 13 adds extra geese into the fox\'s own row, from the corners inward.',
    ],
  },
  {
    title: 'More geese',
    lines: [
      'More geese makes the geese\' side stronger.',
    ],
  },
  {
    title: 'Strength',
    lines: [
      'A smaller flock is harder for the geese and easier for the fox.',
    ],
  },
  {
    title: 'The fox',
    piece: 'F',
    lines: [
      'One fox tries to capture enough geese that the rest can no longer close in on it.',
    ],
  },
  {
    title: 'Fox moves',
    lines: [
      'The fox moves one point at a time, straight along a line - up, down, left or right, never diagonally.',
    ],
  },
  {
    title: 'Fox captures',
    lines: [
      'The fox may instead capture, by jumping over an adjacent goose.',
    ],
  },
  {
    title: 'Landing spot',
    lines: [
      'It lands on the empty point directly beyond that goose.',
    ],
  },
  {
    title: 'Jump details',
    lines: [
      'See "Capturing a goose" below for exactly how a jump works.',
    ],
  },
  {
    title: 'More jumps',
    lines: [
      'It also explains how the fox can jump more than once in the same turn.',
    ],
  },
  {
    title: 'Capturing',
    lines: [
      'Capturing is never forced: the fox may always choose to step instead of jumping.',
    ],
  },
  {
    title: 'Exception',
    lines: [
      'The only exception is in the middle of a chain of jumps, where it must jump again or stop.',
    ],
  },
  {
    title: 'The goose',
    piece: 'G',
    lines: [
      'The geese try to close in on the fox until it has nowhere left to move.',
    ],
  },
  {
    title: 'Goose moves',
    lines: [
      'A goose moves one point at a time, forward (toward the fox\'s side of the board) or sideways.',
    ],
  },
  {
    title: 'No backward',
    lines: [
      'It never moves backward, and never diagonally.',
    ],
  },
  {
    title: 'No jumping',
    lines: [
      'A goose never jumps and never captures another piece.',
    ],
  },
  {
    title: 'The capture',
    lines: [
      'The fox captures by jumping over one goose standing on an adjacent point.',
    ],
  },
  {
    title: 'Landing point',
    lines: [
      'It lands on the empty point directly beyond it, in the same straight line.',
    ],
  },
  {
    title: 'Removed',
    lines: [
      'The jumped goose is removed at once.',
    ],
  },
  {
    title: 'A safe goose',
    lines: [
      'A goose is safe from a given direction whenever there is nowhere to land.',
    ],
  },
  {
    title: 'No landing',
    lines: [
      'That happens when the landing point falls off the board, or another piece already occupies it.',
    ],
  },
  {
    title: 'Backed up',
    lines: [
      'So a goose backed by another goose cannot be jumped from that side.',
    ],
  },
  {
    title: 'Next jump?',
    lines: [
      'From the point it just landed on, the fox may have another jump available.',
    ],
  },
  {
    title: 'Keep jumping',
    lines: [
      'If so, it may keep jumping in the same turn.',
    ],
  },
  {
    title: 'The chain',
    lines: [
      'This is called a chain of captures.',
      'Or it may tap Stop to end its turn there instead.',
    ],
  },
  {
    title: 'Mid-chain',
    lines: [
      'Once in the middle of a chain, the fox is no longer free to just step away.',
    ],
  },
  {
    title: 'Jump or stop',
    lines: [
      'It must either jump again or stop.',
    ],
  },
  {
    title: 'How fox wins',
    lines: [
      'The fox wins once the geese are reduced to 5 or fewer, wherever those geese are.',
    ],
  },
  {
    title: 'Too few',
    lines: [
      'Too few are left to ever close every gap around it.',
    ],
  },
  {
    title: 'Other win',
    piece: 'F',
    lines: [
      'The fox also wins, more rarely, if it becomes the geese\'s turn.',
    ],
  },
  {
    title: 'No legal move',
    piece: 'F',
    lines: [
      'That happens when no goose anywhere has a legal move left to make.',
    ],
  },
  {
    title: 'Geese win',
    lines: [
      'The geese win the instant it becomes the fox\'s turn and the fox has no legal move at all.',
    ],
  },
  {
    title: 'Fox trapped',
    piece: 'G',
    lines: [
      'The fox is completely trapped.',
    ],
  },
  {
    title: 'Two ways',
    piece: 'G',
    lines: [
      'There is no other way to win.',
    ],
  },
  {
    title: 'Only result',
    lines: [
      'Reaching the fox-wins goose count, or fully trapping a side, are the only two results.',
    ],
  },
  {
    title: 'Position',
    lines: [
      'The same position means the same pieces on the same points, with the same side to move.',
    ],
  },
  {
    title: 'Third time',
    lines: [
      'If that exact position occurs for the third time, the game is drawn at once. Nobody wins.',
    ],
  },
  {
    title: 'Repetition',
    lines: [
      'A position is only checked for repetition when nobody is in the middle of a capture chain.',
    ],
  },
];
