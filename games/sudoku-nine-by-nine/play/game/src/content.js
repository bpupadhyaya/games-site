// Text for the About, How to Play and Rules screens. Every rule here is checked against sudoku.js / play.js / game.js
// (see design/GDD.md "Rules reference"). Blocks: { h } heading, { p } paragraph, { li: [...] } bullets, { note } callout.
export const GRADE_INFO = [
  null,
  { name: 'Easy', tag: 'Singles only', text: 'Solved with Naked and Hidden Singles alone. Plenty of clues.' },
  { name: 'Medium', tag: 'Locked digits and pairs', text: 'Adds Pointing Pairs, Box-Line Reduction and Naked Pairs.' },
  { name: 'Hard', tag: 'Subsets', text: 'Adds Hidden Pairs and Naked and Hidden Triples.' },
  { name: 'Expert', tag: 'Wings and fish', text: 'Adds X-Wing, XY-Wing and Skyscraper.' },
  { name: 'Master', tag: 'The deep end', text: 'Needs Swordfish, XYZ-Wing, W-Wing or XY-Chain, more than once. No guessing.' },
];

export const ABOUT = {
  title: 'About',
  pages: [
    {
      title: 'Sudoku Nine by Nine',
      fig: 'houses',
      body: [
        { p: 'Fill the nine-by-nine grid so every row, every column and every three-by-three box holds the digits 1 to 9 exactly once. The numerals that came with the puzzle never change. Everything else is logic.' },
        { p: 'Sudoku is a Japanese-named puzzle that is now played all over the world. This version is built for calm, focused play: soft tiles, big readable digits, no ads and no pressure.' },
        { li: ['Every puzzle is generated with exactly one solution and graded by the techniques a person needs to solve it.', 'A new Daily Puzzle every day, the same for everyone.', 'Pencil marks, undo and redo, and three ways of checking your work.', 'Hints that name the technique and show why it works, and Watch and Learn, where the game solves a puzzle step by step and explains each move.', 'Portrait and landscape, phone or tablet, with a left-hand or right-hand keypad.'] },
      ],
    },
    {
      title: 'Credits and the free preview',
      body: [
        { p: 'You can play for a free preview first. Unlocking the full game is a single one-time purchase; there are no ads and no subscriptions.' },
        { p: 'Numerals and interface text are set in Fredoka, used under the SIL Open Font License 1.1. All sounds are synthesized on your device.' },
        { p: 'Sudoku Nine by Nine is part of Arcforge, a collection of world heritage games.' },
      ],
    },
  ],
};

export const HOWTO = {
  title: 'How to Play',
  pages: [
    {
      title: 'Choose a puzzle',
      fig: 'houses',
      body: [
        { p: 'Tap New Game and pick a grade, from Easy to Master. Tap Daily Puzzle for today\'s puzzle, the same for everyone, with a streak to keep.' },
        { p: 'A puzzle you leave is saved. Tap Continue on the menu to pick it up where you stopped.' },
      ],
    },
    {
      title: 'Place digits',
      fig: 'pad',
      body: [
        { p: 'Tap an empty tile to select it, then tap a number on the keypad. Tap the same number again to take it back off. The row, column and box of the selected tile are lit, and every tile with the same digit glows.' },
        { li: ['Pencil: switch on the pencil, then tap numbers to add or remove small candidate marks.', 'Fill: writes every possible candidate into all empty tiles.', 'Erase clears the tile. Undo and Redo walk through your moves.', 'Tap a number with no tile selected to light up every copy of it.'] },
        { p: 'On a keyboard: arrow keys move, 1 to 9 place, Backspace erases, N toggles pencil, U undoes, Y redoes, H asks for a hint and P pauses.' },
      ],
    },
    {
      title: 'Hints that teach',
      fig: 'tech:hidden-single',
      body: [
        { p: 'Tap the bulb. The game finds the simplest logical step and first shows you where to look, without giving the answer. Tap Explain to see the full reasoning with the cells marked on the board, then Apply to let it make the move.' },
        { p: 'If a digit you placed is wrong, the hint points at it instead.' },
      ],
    },
    {
      title: 'Watch and Learn',
      fig: 'tech:naked-pair',
      body: [
        { p: 'Watch and Learn solves a whole puzzle for you, one explained step at a time. It thinks, shows the cells, explains the technique, then plays the move. Simple steps go quickly; harder techniques get more time.' },
        { p: 'Use Pause to stop everything exactly where it is and Resume to carry on. The minus and plus buttons change how long it thinks before each step.' },
      ],
    },
  ],
};

const T = (title, tech, body) => ({ title, fig: `tech:${tech}`, body });
export const RULES = {
  title: 'Rules',
  pages: [
    {
      title: 'The grid and the goal',
      fig: 'houses',
      body: [
        { p: 'The grid has 81 tiles in 9 rows, 9 columns and 9 boxes of three by three. Each row, column and box is a house of nine tiles. Boxes are numbered 1 to 9, left to right and top to bottom.' },
        { p: 'Some tiles start with a digit. These givens are fixed. You win when every empty tile holds the digit that completes the grid.' },
        { p: 'The goal is always the same: every house holds each of the digits 1 to 9 exactly once.' },
      ],
    },
    {
      title: 'One solution, no guessing',
      fig: 'conflict',
      body: [
        { p: 'Every puzzle here has exactly one solution. The generator proves it before you see the puzzle. It also solves each puzzle the way a person would, using only the named techniques in the pages that follow, so a puzzle never needs a guess.' },
        { p: 'There is no time limit and no way to lose. A finished grid that is not correct is not accepted; wrong tiles are marked and you can fix them.' },
      ],
    },
    {
      title: 'Digits and pencil marks',
      fig: 'notes',
      body: [
        { p: 'Placing a digit replaces whatever was in the tile, including its pencil marks. Pencil marks are small candidate digits, nine to a tile. You cannot pencil into a tile that holds a digit.' },
        { li: ['With Auto-clear notes on (the default), placing a digit removes that digit\'s pencil marks from every tile in its row, column and box.', 'Fill writes, in every empty tile, every digit not yet used in its row, column or box, minus anything a hint has proved impossible.', 'Undo and Redo cover digits, erasing, pencil marks and Fill.'] },
      ],
    },
    {
      title: 'Controls',
      fig: 'pad',
      body: [
        { li: ['Tap a tile to select it. Tap a keypad number to place it; tap the same number again to remove it.', 'The Pencil button switches the keypad between digits and pencil marks.', 'With no tile selected, a keypad number lights up all copies of that digit.', 'Number keys show how many of each digit are still missing; a digit that is complete is dimmed.', 'Pause hides the grid and stops the clock. The Hand setting moves the keypad to the left or right side.'] },
      ],
    },
    {
      title: 'Mistakes and checking',
      fig: 'conflict',
      body: [
        { p: 'Settings has three ways of checking. Off marks nothing while you play. Conflicts turns a digit red when it repeats in its row, column or box; it never reveals the answer. Check turns a digit red as soon as it differs from the solution and shows a mistake counter.' },
        { p: 'Every digit you place that differs from the solution counts as a mistake in all three modes, whether or not it is shown. Mistakes only affect the stars on the result screen; they never end the puzzle.' },
      ],
    },
    {
      title: 'Grades and stars',
      body: [
        { p: 'A puzzle\'s grade is the hardest technique that its simplest solution path needs. The solver always takes the simplest available step first.' },
        { li: ['Easy: Naked Singles and Hidden Singles.', 'Medium: adds Pointing Pairs, Box-Line Reduction and Naked Pairs.', 'Hard: adds Hidden Pairs, Naked Triples and Hidden Triples.', 'Expert: adds X-Wing, XY-Wing and Skyscraper.', 'Master: adds Swordfish, XYZ-Wing, W-Wing and XY-Chain, and a Master puzzle needs at least two of those steps.'] },
        { p: 'Stars: you start with three. Using more than three hints or making more than three mistakes costs one; finishing slower than 1.6 times the par time (6, 10, 15, 20 and 30 minutes from Easy to Master) costs one; more than eight hints or mistakes costs another. You always keep at least one.' },
      ],
    },
    {
      title: 'The Daily Puzzle',
      body: [
        { p: 'Each day has one puzzle, identical for every player. Its grade follows the weekday: Monday Easy, Tuesday and Wednesday Medium, Thursday and Friday Hard, Saturday Expert, Sunday Master.' },
        { p: 'Solving it adds to your streak; the Stats page shows the last five weeks. A streak continues if you solved the previous day\'s puzzle.' },
      ],
    },
    {
      title: 'Hints and Watch and Learn',
      fig: 'tech:naked-single',
      body: [
        { p: 'A hint is the simplest logical step available from the position on the board. It has two stages: where to look, then the full reasoning. Apply either places the digit or removes the candidates the technique proves impossible. Those removals are remembered, so the next hint builds on them.' },
        { p: 'If any digit on the board is wrong, the hint shows that tile first.' },
        { p: 'Watch and Learn plays a whole puzzle with the same solver: think, reveal, act. Singles are quick; other techniques use your think time (2, 5, 8 or 10 seconds). Pause freezes it completely.' },
      ],
    },
    T('Naked Single', 'naked-single', [
      { p: 'A tile has only one digit that can still go in it, because every other digit already appears in its row, column or box.' },
      { p: 'In the picture the marked tiles hold the digits that rule out everything but one.' },
    ]),
    T('Hidden Single', 'hidden-single', [
      { p: 'In a row, column or box, a digit has only one tile left where it can go. The tile may have other candidates, but this digit must go there.' },
    ]),
    T('Pointing Pair and Box-Line Reduction', 'pointing', [
      { p: 'Pointing: inside a box, all the candidates for a digit lie on one line. That digit is in the box\'s part of the line, so remove it from the rest of the line.' },
      { p: 'Box-Line Reduction is the reverse: on a line, all the candidates for a digit lie in one box, so remove the digit from the rest of that box.' },
    ]),
    T('Naked Pair and Triple', 'naked-pair', [
      { p: 'Two tiles in a house can hold only the same two digits (three tiles, the same three digits for a triple). Those digits belong to those tiles, so remove them from every other tile in the house.' },
    ]),
    T('Hidden Pair and Triple', 'hidden-pair', [
      { p: 'Two digits in a house can go in only the same two tiles (three digits, three tiles for a triple). Those tiles must hold those digits, so remove every other candidate from them.' },
    ]),
    T('X-Wing', 'x-wing', [
      { p: 'A digit appears in exactly two tiles in each of two rows, and in the same two columns. The digit must sit on opposite corners of that rectangle, so remove it from the rest of both columns. It works the same way with rows and columns swapped.' },
    ]),
    T('XY-Wing', 'xy-wing', [
      { p: 'A pivot tile holds two candidates, XY. One wing that sees it holds XZ and another holds YZ. Whatever the pivot becomes, one wing must be Z, so Z can be removed from any tile that sees both wings.' },
    ]),
    T('Swordfish', 'swordfish', [
      { p: 'Like an X-Wing with three lines: a digit appears in two or three tiles in each of three rows, all inside the same three columns. The digit fills those three columns, so remove it from the rest of them. It works with rows and columns swapped too.' },
    ]),
    T('Skyscraper', 'skyscraper', [
      { p: 'A digit has exactly two places in each of two rows (or two columns), and one place lines up in the same column (row). The two other cells form the roof. One of the roof cells must hold the digit, so remove it from any cell that sees both roof cells.' },
    ]),
    T('XYZ-Wing', 'xyz-wing', [
      { p: 'A pivot holds three candidates XYZ. One wing that sees it holds XZ and another holds YZ. Whether the pivot or a wing, one of the three is Z, so Z can be removed from any tile that sees all three.' },
    ]),
    T('W-Wing', 'w-wing', [
      { p: 'Two tiles hold exactly the same two candidates X and Y and cannot see each other. Somewhere a row, column or box has only two places left for X, and each of those places sees one of the two tiles. Whichever place is X, the tile it sees becomes Y, so one of the two tiles is always Y. Remove Y from any tile that sees both.' },
    ]),
    T('XY-Chain', 'xy-chain', [
      { p: 'A chain of two-candidate tiles in which each tile sees the next. Each choice forces the next tile, so either the first tile is Z or the last one is. Remove Z from any tile that sees both ends. An XY-Wing is a chain of three; this game also looks for longer chains.' },
    ]),
  ],
};
export const DOCS = { about: ABOUT, howto: HOWTO, rules: RULES };

export const TIPS = [
  'Scan for the digit with the most copies already placed.',
  'A tile with only one candidate left is a Naked Single.',
  'Look at each box for a digit that has just one home.',
  'Pencil marks make pairs and triples easy to spot.',
  'Stuck? The bulb finds the simplest next step.',
];
