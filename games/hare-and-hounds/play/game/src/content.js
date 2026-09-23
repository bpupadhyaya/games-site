// Exhaustive Rules reference. Every claim here is cross-checked against rules.js (the single
// source of truth for legality) so this page can never contradict the engine. `piece: 'H' | 'D'`
// shows that piece's real in-game sprite via the game's own drawHare()/drawHound(), never a
// separate icon (see view.js's 'rules' scene).
// Pages are kept short and single-concept on purpose: this reader-card panel scales its body text
// up to 3x for players who want it, and every page below fits comfortably even at that top step
// (2026-09-23: split much further, down to one short sentence per page in most cases, to still
// fit at the new 3x ceiling - see STATUS.md for exactly which pages and why).
export const RULES = [
  {
    title: 'The board',
    lines: [
      'Hare and Hounds is played on 11 points: a 3-by-3 grid in the middle.',
    ],
  },
  {
    title: 'The end points',
    lines: [
      'There\'s also one extra point at each end, in line with the grid\'s middle lane.',
    ],
  },
  {
    title: 'The lines',
    lines: [
      'Every point is joined to its orthogonal neighbours.',
    ],
  },
  {
    title: 'Diagonals',
    lines: [
      'A few points also have diagonal lines, not just straight ones.',
    ],
  },
  {
    title: 'Where they are',
    lines: [
      'They only run through the two end points, the four grid corners, and its very centre.',
    ],
  },
  {
    title: 'Setting up',
    lines: [
      'Three hounds start at the near end: one stands on the end point itself.',
    ],
  },
  {
    title: 'Their row',
    lines: [
      'The other two stand on the outer corners of the row in front of it, leaving its middle empty.',
    ],
  },
  {
    title: 'Where the hare starts',
    lines: [
      'The hare starts alone at the far end. The hounds always move first.',
    ],
  },
  {
    title: 'The hound',
    piece: 'D',
    lines: [
      'Three hounds try to box the hare in until it has nowhere left to go.',
    ],
  },
  {
    title: 'How it moves',
    lines: [
      'A hound moves one point at a time along a line.',
    ],
  },
  {
    title: 'Which ways',
    lines: [
      'It can move forward, toward the hare\'s end, or sideways.',
    ],
  },
  {
    title: 'Never back',
    lines: [
      'A hound can never move backward, toward its own end.',
    ],
  },
  {
    title: 'No captures',
    lines: [
      'A hound never captures anything.',
    ],
  },
  {
    title: 'Closing routes',
    lines: [
      'It only ever occupies points, to close off the hare\'s escape routes.',
    ],
  },
  {
    title: 'The hare',
    piece: 'H',
    lines: [
      'One hare tries to either slip past the hounds or simply outlast them.',
    ],
  },
  {
    title: 'Its move',
    lines: [
      'The hare moves one point at a time along a line, in any direction the lines allow.',
    ],
  },
  {
    title: 'Directions',
    lines: [
      'That includes forward, backward, sideways, or diagonally wherever a diagonal line is drawn.',
    ],
  },
  {
    title: 'No captures',
    lines: [
      'The hare never captures anything either. Nothing on this board is ever removed from play.',
    ],
  },
  {
    title: 'Hounds win',
    lines: [
      'The hounds win the instant it becomes the hare\'s turn and the hare has no legal move at all.',
    ],
  },
  {
    title: 'No legal move',
    lines: [
      'Every point next to it is already occupied.',
    ],
  },
  {
    title: 'Only way to win',
    lines: [
      'This is the only way the hounds can win.',
    ],
  },
  {
    title: 'Getting past',
    lines: [
      'The instant the hare stands nearer the hounds\' own end than every single hound, it has won outright.',
    ],
  },
  {
    title: 'Can\'t catch up',
    lines: [
      'Since hounds can never move backward, none of them can ever catch up to it again.',
    ],
  },
  {
    title: 'Hounds stuck',
    lines: [
      'If it becomes the hounds\' turn and not one of the three hounds has a legal move, the hare wins.',
    ],
  },
  {
    title: 'The clock',
    lines: [
      'The hounds have a limited number of their own moves - 20 by default - to trap the hare.',
    ],
  },
  {
    title: 'Clock runs out',
    lines: [
      'If that many hound moves pass without a win, the hare wins automatically.',
    ],
  },
  {
    title: 'Any position',
    lines: [
      'It doesn\'t matter how the board looks at that moment.',
    ],
  },
  {
    title: 'No draws',
    lines: [
      'Hare and Hounds never ends in a draw.',
    ],
  },
  {
    title: 'How it ends',
    lines: [
      'Every game ends with either the hounds trapping the hare, or the hare winning.',
    ],
  },
  {
    title: 'Three ways to win',
    lines: [
      'That\'s by getting past, by the hounds having no move, or by the clock.',
    ],
  },
];
