// Text for the in-app "Rules" reference page. Kept short-paragraph style like the About/How-to-play
// pages (view.js's ABOUT_TEXT / HOW_TEXT). Every claim here is cross-checked against rules.js (the
// single source of truth for legality) and design/GDD.md's noted simplifications, so this page can
// never contradict the shipped engine. `stone: 'both'` on a page draws the real black and white
// stones via art.js's own drawStone() - never a separate simplified icon.
//
// Pages are kept short - one clause or short sentence, a single concept - so every page still fits
// inside the reader panel at the top text-size step (see layout.js's TEXT_SCALES, now reaching 3.0
// / 300%). This has been split twice now (first for 200%, then again for 300%): most pages are down
// to a single short clause. The wording is unchanged from the original longer paragraphs (aside from
// a couple of headings shortened to free up room, and one dash-joined sentence split into two plain
// sentences), only regrouped onto more pages. Any relative reference in the text ("the previous
// page", "next page") still points at the right neighbour, since pages were only split in place,
// never reordered.

export const RULES = [
  {
    title: 'The board',
    lines: [
      'Go is played on the crossings where the lines meet, not in the squares between them.',
    ],
  },
  {
    title: 'The board',
    lines: [
      'The game always starts on a completely empty board -',
    ],
  },
  {
    title: 'The board',
    lines: [
      'no stones are placed for either side at the outset.',
    ],
  },
  {
    title: 'Board sizes',
    lines: [
      'A full game can be played on three sizes: 9 x 9 (the fastest, and the best place to start),',
    ],
  },
  {
    title: 'Board sizes',
    lines: [
      '13 x 13, or the full traditional 19 x 19.',
    ],
  },
  {
    title: 'Lesson board',
    lines: [
      'A small 5 x 5 board is used only in the lessons, to teach the rules quickly.',
    ],
  },
  {
    title: 'Star points',
    lines: [
      'Small dots called star points mark reference crossings, five on 9x9 and 13x13',
    ],
  },
  {
    title: 'Star points',
    lines: [
      '(the four corners of the inner grid plus the centre point) and nine on 19x19.',
    ],
  },
  {
    title: 'Star points',
    lines: [
      'They carry no rule of their own; they only help the eye find a crossing.',
    ],
  },
  {
    title: 'Who plays first',
    lines: [
      'Black always plays first. If you choose to play White instead,',
    ],
  },
  {
    title: 'Who plays first',
    lines: [
      'the computer plays Black and makes the opening move for you.',
    ],
  },
  {
    title: 'A stone',
    stone: 'both',
    lines: [
      'A stone is the only piece in Go:',
    ],
  },
  {
    title: 'A stone',
    lines: [
      'a flat black (slate) or white (shell) disc placed on an empty crossing.',
    ],
  },
  {
    title: 'A stone',
    lines: [
      'There is no rank between stones - a stone is a stone,',
    ],
  },
  {
    title: 'A stone',
    lines: [
      'whichever point it sits on.',
    ],
  },
  {
    title: 'Until captured',
    lines: [
      'Once placed, a stone never moves and never changes colour.',
    ],
  },
  {
    title: 'Until captured',
    lines: [
      'The only way a stone leaves the board again',
    ],
  },
  {
    title: 'Until captured',
    lines: [
      'is by being captured - the next pages explain exactly how.',
    ],
  },
  {
    title: 'A turn',
    lines: [
      'A turn is either placing one stone on any empty crossing,',
    ],
  },
  {
    title: 'A turn',
    lines: [
      'or passing - playing no stone at all. Players strictly alternate turns.',
    ],
  },
  {
    title: 'A turn',
    lines: [
      '(Exactly how to aim and confirm a placement by tap or drag',
    ],
  },
  {
    title: 'A turn',
    lines: [
      'is explained on the How to play page.)',
    ],
  },
  {
    title: 'Liberties',
    lines: [
      'An empty crossing directly touching a stone -',
    ],
  },
  {
    title: 'Liberties',
    lines: [
      'up, down, left or right, never diagonally -',
    ],
  },
  {
    title: 'Liberties',
    lines: [
      'is one of that stone\'s liberties. A stone with no liberties left cannot remain on the board.',
    ],
  },
  {
    title: 'Examples',
    lines: [
      'A stone alone in a corner starts with 2 liberties, one alone on an edge with 3,',
    ],
  },
  {
    title: 'Examples',
    lines: [
      'and one alone in the open middle of the board with 4.',
    ],
  },
  {
    title: 'Groups',
    lines: [
      'Stones of the same colour that touch each other in an unbroken chain,',
    ],
  },
  {
    title: 'Groups',
    lines: [
      'again only up, down, left or right, form a single group.',
    ],
  },
  {
    title: 'Group capture',
    lines: [
      'A group lives and dies together:',
    ],
  },
  {
    title: 'Group capture',
    lines: [
      'its liberties are every empty crossing touching any stone in it,',
    ],
  },
  {
    title: 'Group capture',
    lines: [
      'and it is captured as a whole, not one stone at a time.',
    ],
  },
  {
    title: 'Capturing',
    lines: [
      'Placing a stone can take away one of an enemy group\'s liberties.',
    ],
  },
  {
    title: 'Capturing',
    lines: [
      'If that removes the enemy group\'s very last liberty, the whole group is captured at once:',
    ],
  },
  {
    title: 'Capturing',
    lines: [
      'every stone in it is lifted off the board and those crossings become empty again.',
    ],
  },
  {
    title: 'Check timing',
    lines: [
      'Capturing is checked immediately after a stone is placed,',
    ],
  },
  {
    title: 'Check timing',
    lines: [
      'for every enemy group touching it -',
    ],
  },
  {
    title: 'Check timing',
    lines: [
      'and it is checked before anything about the new stone\'s own liberties is',
    ],
  },
  {
    title: 'Check timing',
    lines: [
      '(see the next page).',
    ],
  },
  {
    title: 'Atari',
    lines: [
      'A group with only one liberty left is in atari:',
    ],
  },
  {
    title: 'Atari',
    lines: [
      'one more move by the opponent on that liberty captures it.',
    ],
  },
  {
    title: 'Atari',
    lines: [
      'The game says so in plain words whenever it happens to you.',
    ],
  },
  {
    title: 'Suicide rule',
    lines: [
      'You may not place a stone that would leave its own group with zero liberties -',
    ],
  },
  {
    title: 'Suicide rule',
    lines: [
      'unless that same move also captures at least one enemy stone, which frees up a liberty for it.',
    ],
  },
  {
    title: 'What you\'ll see',
    lines: [
      'A move refused for this reason says so plainly:',
    ],
  },
  {
    title: 'What you\'ll see',
    lines: [
      'the stone would have no liberties and would capture nothing,',
    ],
  },
  {
    title: 'What you\'ll see',
    lines: [
      'so it would be removed the instant it was placed.',
    ],
  },
  {
    title: 'Check order',
    lines: [
      'In this build, capturing an enemy group is always checked',
    ],
  },
  {
    title: 'Check order',
    lines: [
      'before the no-suicide check.',
    ],
  },
  {
    title: 'Why it matters',
    lines: [
      'That means a move that empties an enemy group\'s last liberty is legal, even if,',
    ],
  },
  {
    title: 'Why it matters',
    lines: [
      'on the crowded board just before that capture,',
    ],
  },
  {
    title: 'Why it matters',
    lines: [
      'the new stone looked like it had nowhere to breathe.',
    ],
  },
  {
    title: 'Ko',
    lines: [
      'A ko is a specific one-stone shape: your move captures exactly one enemy stone,',
    ],
  },
  {
    title: 'Ko',
    lines: [
      'and the stone you just placed stands alone - not part of any larger group -',
    ],
  },
  {
    title: 'Ko',
    lines: [
      'with exactly one liberty of its own.',
    ],
  },
  {
    title: 'Forbidden point',
    lines: [
      'When that happens, the opponent may not immediately play back',
    ],
  },
  {
    title: 'Forbidden point',
    lines: [
      'on the point just captured -',
    ],
  },
  {
    title: 'Forbidden point',
    lines: [
      'doing so would only recreate the same shape and could repeat forever.',
    ],
  },
  {
    title: 'Forbidden point',
    lines: [
      'That forbidden point is marked on the board with a small red square.',
    ],
  },
  {
    title: 'Ban length',
    lines: [
      'The ban lasts exactly one turn: as soon as the opponent plays anywhere else, or passes,',
    ],
  },
  {
    title: 'Ban length',
    lines: [
      'the restriction lifts and that point can be played again later.',
    ],
  },
  {
    title: 'Superko',
    lines: [
      'On top of the simple ko rule on the previous page,',
    ],
  },
  {
    title: 'Superko',
    lines: [
      'this build enforces the stronger positional superko rule.',
    ],
  },
  {
    title: 'Superko rule',
    lines: [
      'A move is refused if it would recreate the exact whole-board position -',
    ],
  },
  {
    title: 'Superko rule',
    lines: [
      'every stone, of every colour, on every crossing -',
    ],
  },
  {
    title: 'Superko rule',
    lines: [
      'that has already occurred earlier in the very same game.',
    ],
  },
  {
    title: 'Closing cycles',
    lines: [
      'This closes off longer repeating cycles',
    ],
  },
  {
    title: 'Closing cycles',
    lines: [
      'that a one-move ko ban alone does not catch,',
    ],
  },
  {
    title: 'Closing cycles',
    lines: [
      'not only the single-stone case.',
    ],
  },
  {
    title: 'Closing cycles',
    lines: [
      'Every position reached so far in the game is remembered and checked against.',
    ],
  },
  {
    title: 'Computer\'s search',
    lines: [
      '(The computer\'s own search only checks',
    ],
  },
  {
    title: 'Computer\'s search',
    lines: [
      'the simple, one-move ko ban',
    ],
  },
  {
    title: 'Computer\'s search',
    lines: [
      'while exploring possibilities, to stay fast.',
    ],
  },
  {
    title: 'The real check',
    lines: [
      'But the move it actually plays is always re-checked',
    ],
  },
  {
    title: 'The real check',
    lines: [
      'against this full rule before it is allowed on the board.)',
    ],
  },
  {
    title: 'Passing',
    lines: [
      'A pass counts as a whole turn and places no stone. Passing is always a legal move,',
    ],
  },
  {
    title: 'Passing',
    lines: [
      'with no restriction on when you may do it, even when other moves are also legal.',
    ],
  },
  {
    title: 'Ending',
    lines: [
      'The game ends the moment two passes happen in a row - typically one from each player,',
    ],
  },
  {
    title: 'Ending',
    lines: [
      'since turns strictly alternate. There is no time limit,',
    ],
  },
  {
    title: 'Ending',
    lines: [
      'and this version has no resign button: a game always ends by passing and then being scored.',
    ],
  },
  {
    title: 'Game ends',
    lines: [
      'The instant the game ends this way, play moves straight into counting - see Scoring, next.',
    ],
  },
  {
    title: 'Area score',
    lines: [
      'This build uses Chinese area scoring:',
    ],
  },
  {
    title: 'Area score',
    lines: [
      'each player\'s score is their own living stones on the board',
    ],
  },
  {
    title: 'Area score',
    lines: [
      'plus every empty crossing that only their colour surrounds.',
    ],
  },
  {
    title: 'Area score',
    lines: [
      'An empty region touching both colours, or neither, counts for nobody.',
    ],
  },
  {
    title: 'Dead stones',
    lines: [
      'When the game ends, dead stones -',
    ],
  },
  {
    title: 'Dead stones',
    lines: [
      'groups that could not have survived -',
    ],
  },
  {
    title: 'Dead stones',
    lines: [
      'are found for you automatically',
    ],
  },
  {
    title: 'Dead stones',
    lines: [
      'and shown with a red cross; they do not count for their owner.',
    ],
  },
  {
    title: 'Your mind',
    lines: [
      'Tap a group to change your mind between dead and alive before accepting,',
    ],
  },
  {
    title: 'Your mind',
    lines: [
      'and the score updates live as you do.',
    ],
  },
  {
    title: 'Komi',
    lines: [
      'White receives komi, a fixed bonus added to its score',
    ],
  },
  {
    title: 'Komi',
    lines: [
      'to balance Black\'s advantage of moving first:',
    ],
  },
  {
    title: 'Komi',
    lines: [
      '5.5 points on 9x9, 7.5 points on 13x13 and on 19x19.',
    ],
  },
  {
    title: 'Komi',
    lines: [
      '(The small 5x5 lesson board uses a token komi of 0.5.)',
    ],
  },
  {
    title: 'Winning',
    lines: [
      'Whoever has the higher total - stones plus territory, plus komi for White - wins by the difference.',
    ],
  },
  {
    title: 'Winning',
    lines: [
      '"Keep playing" is offered instead of accepting, for when you disagree with the count',
    ],
  },
  {
    title: 'Winning',
    lines: [
      'and would rather prove it by playing on.',
    ],
  },
  {
    title: 'Handicap',
    lines: [
      'This version does not offer handicap stones:',
    ],
  },
  {
    title: 'Handicap',
    lines: [
      'every game begins from a completely empty board,',
    ],
  },
  {
    title: 'Handicap',
    lines: [
      'whichever computer level, board size, or colour you choose to play.',
    ],
  },
  {
    title: 'The challenge',
    lines: [
      'The four computer levels, and the choice of a 9x9, 13x13 or 19x19 board,',
    ],
  },
  {
    title: 'The challenge',
    lines: [
      'are the only ways this build lets you adjust the challenge.',
    ],
  },
  {
    title: 'How you win',
    lines: [
      'A game is won by whoever has the higher score',
    ],
  },
  {
    title: 'How you win',
    lines: [
      'once both players accept the count after two passes (see Scoring).',
    ],
  },
  {
    title: 'How you win',
    lines: [
      'There is no other way to win or lose in this version -',
    ],
  },
  {
    title: 'How you win',
    lines: [
      'no resignation, no clock.',
    ],
  },
  {
    title: 'Never a tie',
    lines: [
      'Because White\'s komi always ends in a half point - 0.5, 5.5 or 7.5 -',
    ],
  },
  {
    title: 'Never a tie',
    lines: [
      'while every other part of the score is a whole number,',
    ],
  },
  {
    title: 'Never a tie',
    lines: [
      'the two final totals can never come out exactly equal.',
    ],
  },
  {
    title: 'Never a tie',
    lines: [
      'This build can never end in a tie.',
    ],
  },
  {
    title: 'No stalemate',
    lines: [
      'Passing is always a legal move,',
    ],
  },
  {
    title: 'No stalemate',
    lines: [
      'so a player is never left with no legal move at all.',
    ],
  },
  {
    title: 'No stalemate',
    lines: [
      'Unlike some other board games, Go has no stalemate here:',
    ],
  },
  {
    title: 'No stalemate',
    lines: [
      'a position with nothing useful left to play',
    ],
  },
  {
    title: 'No stalemate',
    lines: [
      'is simply passed on.',
    ],
  },
];
