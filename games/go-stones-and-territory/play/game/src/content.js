// Text for the in-app "Rules" reference page. Kept short-paragraph style like the About/How-to-play
// pages (view.js's ABOUT_TEXT / HOW_TEXT). Every claim here is cross-checked against rules.js (the
// single source of truth for legality) and design/GDD.md's noted simplifications, so this page can
// never contradict the shipped engine. `stone: 'both'` on a page draws the real black and white
// stones via art.js's own drawStone() - never a separate simplified icon.

export const RULES = [
  {
    title: 'The board and setup',
    lines: [
      'Go is played on the crossings where the lines meet, not in the squares between them. The game always starts on a completely empty board - no stones are placed for either side at the outset.',
      'A full game can be played on three sizes: 9 x 9 (the fastest, and the best place to start), 13 x 13, or the full traditional 19 x 19. A small 5 x 5 board is used only in the lessons, to teach the rules quickly.',
      'Small dots called star points mark reference crossings, five on 9x9 and 13x13 (the four corners of the inner grid plus the centre point) and nine on 19x19. They carry no rule of their own; they only help the eye find a crossing.',
      'Black always plays first. If you choose to play White instead, the computer plays Black and makes the opening move for you.',
    ],
  },
  {
    title: 'Placing a stone',
    stone: 'both',
    lines: [
      'A stone is the only piece in Go: a flat black (slate) or white (shell) disc placed on an empty crossing. There is no rank between stones - a stone is a stone, whichever point it sits on.',
      'Once placed, a stone never moves and never changes colour. The only way a stone leaves the board again is by being captured - the next pages explain exactly how.',
      'A turn is either placing one stone on any empty crossing, or passing - playing no stone at all. Players strictly alternate turns. (Exactly how to aim and confirm a placement by tap or drag is explained on the How to play page.)',
    ],
  },
  {
    title: 'Liberties and groups',
    lines: [
      'An empty crossing directly touching a stone - up, down, left or right, never diagonally - is one of that stone\'s liberties. A stone with no liberties left cannot remain on the board.',
      'Stones of the same colour that touch each other in an unbroken chain, again only up, down, left or right, form a single group. A group lives and dies together: its liberties are every empty crossing touching any stone in it, and it is captured as a whole, not one stone at a time.',
      'A stone alone in a corner starts with 2 liberties, one alone on an edge with 3, and one alone in the open middle of the board with 4.',
    ],
  },
  {
    title: 'Capturing',
    lines: [
      'Placing a stone can take away one of an enemy group\'s liberties. If that removes the enemy group\'s very last liberty, the whole group is captured at once: every stone in it is lifted off the board and those crossings become empty again.',
      'Capturing is checked immediately after a stone is placed, for every enemy group touching it - and it is checked before anything about the new stone\'s own liberties is (see the next page).',
      'A group with only one liberty left is in atari: one more move by the opponent on that liberty captures it. The game says so in plain words whenever it happens to you.',
    ],
  },
  {
    title: 'The suicide rule',
    lines: [
      'You may not place a stone that would leave its own group with zero liberties - unless that same move also captures at least one enemy stone, which frees up a liberty for it.',
      'In this build, capturing an enemy group is always checked before the no-suicide check. That means a move that empties an enemy group\'s last liberty is legal, even if, on the crowded board just before that capture, the new stone looked like it had nowhere to breathe.',
      'A move refused for this reason says so plainly: the stone would have no liberties and would capture nothing, so it would be removed the instant it was placed.',
    ],
  },
  {
    title: 'Ko',
    lines: [
      'A ko is a specific one-stone shape: your move captures exactly one enemy stone, and the stone you just placed stands alone - not part of any larger group - with exactly one liberty of its own.',
      'When that happens, the opponent may not immediately play back on the point just captured - doing so would only recreate the same shape and could repeat forever. That forbidden point is marked on the board with a small red square.',
      'The ban lasts exactly one turn: as soon as the opponent plays anywhere else, or passes, the restriction lifts and that point can be played again later.',
    ],
  },
  {
    title: 'Positional superko',
    lines: [
      'On top of the simple ko rule on the previous page, this build enforces the stronger positional superko rule: a move is refused if it would recreate the exact whole-board position - every stone, of every colour, on every crossing - that has already occurred earlier in the very same game.',
      'This closes off longer repeating cycles that a one-move ko ban alone does not catch, not only the single-stone case. Every position reached so far in the game is remembered and checked against.',
      '(The computer\'s own search only checks the simple, one-move ko ban while exploring possibilities, to stay fast - but the move it actually plays is always re-checked against this full rule before it is allowed on the board.)',
    ],
  },
  {
    title: 'Passing and ending the game',
    lines: [
      'A pass counts as a whole turn and places no stone. Passing is always a legal move, with no restriction on when you may do it, even when other moves are also legal.',
      'The game ends the moment two passes happen in a row - typically one from each player, since turns strictly alternate. There is no time limit, and this version has no resign button: a game always ends by passing and then being scored.',
      'The instant the game ends this way, play moves straight into counting - see Scoring, next.',
    ],
  },
  {
    title: 'Scoring',
    lines: [
      'This build uses Chinese area scoring: each player\'s score is their own living stones on the board plus every empty crossing that only their colour surrounds. An empty region touching both colours, or neither, counts for nobody.',
      'When the game ends, dead stones - groups that could not have survived - are found for you automatically and shown with a red cross; they do not count for their owner. Tap a group to change your mind between dead and alive before accepting, and the score updates live as you do.',
      'White receives komi, a fixed bonus added to its score to balance Black\'s advantage of moving first: 5.5 points on 9x9, 7.5 points on 13x13 and on 19x19. (The small 5x5 lesson board uses a token komi of 0.5.)',
      'Whoever has the higher total - stones plus territory, plus komi for White - wins by the difference. "Keep playing" is offered instead of accepting, for when you disagree with the count and would rather prove it by playing on.',
    ],
  },
  {
    title: 'Handicap stones',
    lines: [
      'This version does not offer handicap stones: every game begins from a completely empty board, whichever computer level, board size, or colour you choose to play.',
      'The four computer levels, and the choice of a 9x9, 13x13 or 19x19 board, are the only ways this build lets you adjust the challenge.',
    ],
  },
  {
    title: 'Winning and draws',
    lines: [
      'A game is won by whoever has the higher score once both players accept the count after two passes (see Scoring). There is no other way to win or lose in this version - no resignation, no clock.',
      'Because White\'s komi always ends in a half point - 0.5, 5.5 or 7.5 - while every other part of the score is a whole number, the two final totals can never come out exactly equal. This build can never end in a tie.',
      'Passing is always a legal move, so a player is never left with no legal move at all. Unlike some other board games, Go has no stalemate here: a position with nothing useful left to play is simply passed on.',
    ],
  },
];
