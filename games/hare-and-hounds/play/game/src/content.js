// Exhaustive Rules reference. Every claim here is cross-checked against rules.js (the single
// source of truth for legality) so this page can never contradict the engine. `piece: 'H' | 'D'`
// shows that piece's real in-game sprite via the game's own drawHare()/drawHound(), never a
// separate icon (see view.js's 'rules' scene).
export const RULES = [
  {
    title: 'The board and setup',
    lines: [
      'Hare and Hounds is played on 11 points: a 3-by-3 grid in the middle, plus one extra point',
      'at each end, in line with the grid\'s middle lane.',
      'Every point is joined to its orthogonal neighbours; a few points also have diagonal lines -',
      'only the two end points, the four corners of the grid, and its very centre.',
      'Three hounds start at the near end: one on the end point itself, and two on the outer',
      'corners of the row just in front of it, leaving that row\'s middle point empty. The hare',
      'starts alone at the far end.',
      'The hounds always move first.',
    ],
  },
  {
    title: 'The hound',
    piece: 'D',
    lines: [
      'Three hounds try to box the hare in until it has nowhere left to go.',
      'A hound moves one point at a time along a line, forward (toward the hare\'s end) or',
      'sideways - never backward, toward its own end.',
      'A hound never captures anything - it only ever occupies points, to close off the hare\'s',
      'escape routes.',
    ],
  },
  {
    title: 'The hare',
    piece: 'H',
    lines: [
      'One hare tries to either slip past the hounds or simply outlast them.',
      'The hare moves one point at a time along a line, in any direction the lines allow -',
      'forward, backward or sideways, and diagonally wherever a diagonal line is drawn.',
      'The hare never captures anything either. Nothing on this board is ever removed from play.',
    ],
  },
  {
    title: 'How the hounds win',
    lines: [
      'The hounds win the instant it becomes the hare\'s turn and the hare has no legal move at',
      'all - every point next to it is already occupied. This is the only way the hounds can win.',
    ],
  },
  {
    title: 'How the hare wins',
    lines: [
      'Getting past: the instant the hare stands nearer the hounds\' own end than every single',
      'hound, it has won outright - since hounds can never move backward, none of them can ever',
      'catch up to it again.',
      'The hounds trapped: if it becomes the hounds\' turn and not one of the three hounds has a',
      'legal move, the hare wins.',
      'The hunt clock: the hounds have a limited number of their own moves - 20 by default - to',
      'trap the hare. If that many hound moves pass without a win, the hare wins automatically,',
      'however the board looks at that moment.',
    ],
  },
  {
    title: 'No draws',
    lines: [
      'Hare and Hounds never ends in a draw. Every game ends with either the hounds trapping the',
      'hare, or the hare winning - by getting past, by the hounds having no move, or by the clock.',
    ],
  },
];
