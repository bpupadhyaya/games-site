// Text content: chapters of the Journey, tiers, and the Rules / How to Play / About pages.
export const CHAPTERS = [
  { id: 'loshu', variant: 'loshu', name: 'The Turtle Shell', count: 6, blurb: 'The original 3 x 3 square: numbers 1 to 9, every line adds to 15.' },
  { id: 'shift3', variant: 'shift3', name: 'Shifted Stones', count: 6, blurb: 'Same shape, new numbers. Work out the magic total yourself.' },
  { id: 'four', variant: 'four', name: 'Four Gates', count: 8, blurb: '4 x 4 squares with the numbers 1 to 16. Every line adds to 34.' },
  { id: 'pan4', variant: 'pan4', name: 'Crossing Diagonals', count: 6, blurb: '4 x 4 where the broken diagonals must add up too.' },
  { id: 'five', variant: 'five', name: 'Five Winds', count: 6, blurb: '5 x 5 squares with 1 to 25. Every line adds to 65.' },
  { id: 'pan5', variant: 'pan5', name: 'The Endless Weave', count: 4, blurb: '5 x 5 with every broken diagonal: a square with no edges.' },
];
export const FACTS = {
  loshu: 'The Lo Shu is the oldest known magic square. Chinese writers describe it from more than two thousand years ago. Its middle stone is always the middle number, 5.',
  shift3: 'Add the same number to every stone of a magic square, or multiply every stone by the same number, and it stays magic. Only the magic total changes.',
  four: 'There are 880 different 4 x 4 magic squares, not counting turns and mirror images.',
  pan4: 'In a pandiagonal square the broken diagonals add up too. Of the 7,040 magic squares of 4 x 4, only 48 are pandiagonal.',
  five: 'There are 275,305,224 different 5 x 5 magic squares, not counting turns and mirror images.',
  pan5: 'A pandiagonal square can be cut along any row or column and rejoined on the other side: it stays magic. The board is really a ring with no edges.',
};
export const TIERS = ['Gentle', 'Steady', 'Master'];
export const TIER_TEXT = ['Many stones already set', 'A few stones set', 'As few as the puzzle allows'];
export const VARIANT_TEXT = {
  loshu: 'The 3 x 3 Lo Shu with the numbers 1 to 9.',
  shift3: 'A 3 x 3 square with a different set of numbers.',
  four: 'A 4 x 4 square, the numbers 1 to 16.',
  pan4: 'A 4 x 4 square where broken diagonals count.',
  five: 'A 5 x 5 square, the numbers 1 to 25.',
  pan5: 'A 5 x 5 square where broken diagonals count.',
};
export const TECH_NAME = { 'last-in-line': 'One tile left in a line', centre: 'The middle tile', 'only-fit': 'Only one stone fits', 'only-place': 'Only one place for it', 'look-ahead': 'Try and rule out', mistake: 'A stone to correct' };

const R = (title, body, fig) => ({ title, body, fig });
export const DOCS = {
  howto: {
    title: 'How to Play',
    pages: [
      R('Make every line add up', [
        { p: 'A magic square is a grid of numbers where every row, every column and the diagonals all add up to the same total, the magic number. You are given a few stones already in place. Place the rest of the numbers so every line reaches the magic number.' },
        { p: 'Every number is used exactly once. The magic number is shown above the board.' },
      ], 'loshu'),
      R('Placing stones', [
        { li: ['Tap a stone in the tray, then tap an empty square. Or drag the stone onto the board.', 'Tap a square first, then a stone, if you prefer.', 'Tap a stone you placed to lift it back; drag it to move it.', 'The red lacquer stones are given. They never move.'] },
      ], 'tray'),
      R('Watch the gauges', [
        { p: 'Every line has a round gauge showing its running total. It fills as you place stones, turns gold when the line is exactly right, and red when it is too high or finished wrong. Tap a gauge to light up its line on the board.' },
      ], 'sums'),
      R('Stuck? Ask for a hint', [
        { p: 'The lamp button first shows where to look, then explains the reasoning, then places the stone for you. Watch and Learn plays a whole puzzle and explains each step, with a real Pause.' },
        { p: 'The Journey leads from the 3 x 3 original to 4 x 4 and 5 x 5 squares and variants. Free Play lets you pick any size. The Daily Puzzle is the same for everyone.' },
      ]),
    ],
  },
  rules: {
    title: 'Rules',
    pages: [
      R('The goal', [
        { p: 'Fill every square of an n x n grid with the numbers of the puzzle, each used once, so that every line of the square adds up to the same magic number.' },
        { p: 'Each puzzle comes with some stones already placed (red lacquer). The rest are yours to place. Each puzzle has exactly one solution.' },
      ], 'loshu'),
      R('Which lines count', [
        { p: 'In the standard variants these lines must all add to the magic number:' },
        { li: ['every row', 'every column', 'the main diagonal from top left to bottom right', 'the other diagonal from top right to bottom left'] },
        { p: 'That is 8 lines in a 3 x 3 square, 10 in a 4 x 4 and 12 in a 5 x 5.' },
      ], 'lines'),
      R('The magic number', [
        { p: 'Add up all the numbers of the puzzle and divide by the size of the square: that is the magic number. For the numbers 1 to 9 it is 45 / 3 = 15. For 1 to 16 it is 136 / 4 = 34. For 1 to 25 it is 325 / 5 = 65.' },
        { p: 'The game always shows it above the board. In shifted puzzles it changes with the numbers, but it is still the total divided by the size.' },
      ]),
      R('Using each number once', [
        { p: 'Every number appears exactly once. The tray holds the numbers still unused. Spaces in the tray stay where they are when a stone is used, so you always find a number in the same place.' },
        { p: 'A line is only right when it is full and adds to exactly the magic number. A line that goes over the magic number can never be right.' },
      ], 'tray'),
      R('Shifted stones', [
        { p: 'In Shifted Stones the numbers are not 1 to 9. They climb in equal steps from another starting number, for example 4 to 12, or 3, 6, 9 up to 27. The pattern of the square is the same as the Lo Shu, only the numbers change, and so does the magic number.' },
      ], 'shift'),
      R('Broken diagonals', [
        { p: 'Crossing Diagonals and the Endless Weave also count the broken diagonals. Picture the board wrapped round like a cylinder in both directions. A diagonal that leaves one edge continues from the opposite edge, and the numbers it collects must add up to the magic number as well.' },
        { p: 'The gauges for these lines sit above the columns and beside the rows.' },
      ], 'pan'),
      R('Placing and moving', [
        { li: ['Tap a tray stone, then an empty square, or drag it there.', 'Dropping on a square that holds one of your stones swaps them: the old stone goes back to the tray.', 'Tap one of your stones with nothing held to lift it.', 'Given stones are fixed.', 'Undo and Redo walk through your moves; Reset lifts every stone you placed.'] },
        { p: 'Keyboard: arrow keys move the square, number keys place that number, Backspace lifts, U undo, Y redo, H hint, P pause.' },
      ]),
      R('Gauges and checking', [
        { p: 'The gauge at the end of each line shows the sum so far over the magic number. Gold: exactly right. Red: over, or full and wrong. In Settings you can choose Gauges only, Gauges and mark wrong stones, or No checking.' },
      ], 'sums'),
      R('Hints', [
        { p: 'A hint is a lesson in two steps: where to look, then why. If a stone is wrong, the hint points at it first. The named techniques are:' },
        { li: ['One tile left in a line: a line has one gap, so the missing number is the magic number minus the line so far.', 'The middle tile (3 x 3): the four lines through the middle use every number once and the middle three extra times, so the middle is (4 x magic number - total) / 3.', 'Only one stone fits: every other unused number would break a line through that square.', 'Only one place for it: a number fits just one empty square.', 'Try and rule out: no single line decides, so the fewest-choice square is tested by looking ahead.'] },
      ]),
      R('The middle of the Lo Shu', [
        { p: 'In the 3 x 3 square the middle number is always the average of all nine: 5. Opposite corners and opposite edges always add to 10. That is why the squares of the original puzzle look so alike: there is only one 3 x 3 magic square of 1 to 9, turned and mirrored in eight ways.' },
      ], 'centre'),
      R('Stars, Daily Puzzle and fairness', [
        { p: 'A solved puzzle earns up to three stars: fewer hints and fewer wrong stones earn more. Time is recorded as your best time for that puzzle size.' },
        { p: 'The Daily Puzzle is picked from the day\'s date and is the same for everyone. All puzzles are generated by this game and checked to have exactly one solution. They are not copied from anywhere.' },
        { p: 'Simplifications: the game uses ordinary magic squares and pandiagonal squares only. Other variants, such as the composite or bordered squares, are not included.' },
      ]),
    ],
  },
  about: {
    title: 'About',
    pages: [
      R('The Lo Shu square', [
        { p: 'Lo Shu (洛書, "Luo river writing") is the oldest known magic square, from China. Its arrangement is:' },
        { p: '4  9  2\n3  5  7\n8  1  6', mono: true },
        { p: 'Every row, column and diagonal adds to 15, with 5 in the middle. Chinese writers have retold for more than two thousand years the story of this pattern, shown as dots on the shell of a turtle by the Luo river in the days of the flood-controlling engineer Yu. Here the story is told as it is told: as part of the history of mathematics and of Chinese culture.' },
      ], 'dots'),
      R('Magic squares around the world', [
        { p: 'Magic squares of larger sizes were studied by scholars in China, India, the Islamic world and Europe. They fascinated mathematicians because they hide patterns: sums, symmetry and the idea that an arrangement can be balanced in many directions at once.' },
        { p: 'This game starts with the original 3 x 3 Lo Shu and then climbs to 4 x 4 and 5 x 5 squares, shifted numbers and the pandiagonal squares, in which even the broken diagonals add up.' },
      ]),
      R('Credits', [
        { p: 'Lo Shu Magic Square is part of Arcforge, a collection of world heritage games. Heritage: China.' },
        { p: 'All puzzles are generated by the game. The stones, board and sounds are drawn and synthesized in the game.' },
        { p: 'Fonts: Cinzel and Fredoka, SIL Open Font License 1.1.' },
        { p: 'The 3D board, tablets, painted screen and river terrace are drawn with three.js (MIT licence, the three.js authors) and are built in code for this game. Sky and haze layers use the Arcforge 3D scenery kit; its licences are listed in the shared 3D library credits.' },
      ]),
    ],
  },
};
