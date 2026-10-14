// Text content: chapters of the Journey, facts, and the Rules / How to Play / About pages.
export const CHAPTERS = [
  { id: 'c3', name: 'Three Lines', count: 6, blurb: 'The smallest ladder: three lanterns, three bowls.' },
  { id: 'c4', name: 'Four Lines', count: 6, blurb: 'Fixed rungs start to cross your plans.' },
  { id: 'c5', name: 'Five Lines', count: 6, blurb: 'Five paths weave together. Count the swaps.' },
  { id: 'c6', name: 'Six Lines', count: 6, blurb: 'Tight budgets: few spare rungs.' },
  { id: 'c7', name: 'Seven Lines', count: 6, blurb: 'The master ladder: no spare rungs at all.' },
];
export const FACTS = [
  'Every ladder is a perfect shuffle: each lantern finishes in a different bowl, because every rung only swaps two neighbours.',
  'In Korea the same game is called sadari, which simply means ladder. In China it is drawn as a "ghost leg" diagram.',
  'Ghost-leg lotteries are used all across East Asia to share out tasks, seats and turns without anyone being able to cheat.',
  'The part of the name, kuji, means "lots". Amidakuji is a way of drawing lots with a ladder.',
  'A ladder with n lines can make any rearrangement of n lanterns: the fewest rungs needed is the number of swaps that sort them.',
  'The ladder is drawn first and the prizes are folded away. Nobody can pick the line they like and also know the prize.',
];
export const TIER_TEXT = ['3 to 4 lines, plenty of time', '4 to 6 lines, a steady pace', '6 to 8 lines and a short clock'];

const R = (title, body, fig) => ({ title, body, fig });
export const DOCS = {
  howto: {
    title: 'How to Play',
    pages: [
      R('Follow a line down', [
        { p: 'An amidakuji is a ladder with a lantern hanging from the top of every line and a bowl at the bottom. A lantern slides down its line. Whenever a rung touches its line, it takes the rung across to the neighbouring line and carries on down.' },
        { p: 'Tap a lantern to light up the path it would take.' },
      ], 'trace'),
      R('Build the ladder', [
        { p: 'In the Journey, each lantern must land in the bowl with its own colour and number. Some rungs are fixed (cream, with knots). You add the rest.' },
        { li: ['Tap between two lines at a height to put a rung there.', 'Tap one of your rungs to take it back.', 'You only have a few rungs: the counter shows how many are left.', 'Press Release to send every lantern down and see who gets home.'] },
      ], 'build'),
      R('Each rung swaps two neighbours', [
        { p: 'A rung makes the two lanterns above it change places below it. That is all a rung ever does, so lanterns can never share a bowl. To move a lantern two lines to the right, it needs two rungs.' },
      ], 'swap'),
      R('Other ways to play', [
        { li: ['Follow the Line: one lantern is lit, pick the bowl where it will land before the clock runs out.', 'Draw Lots: pass the phone around, each friend adds a rung and picks a line; the bottoms are hidden until the reveal.', 'Daily Ladder: one new puzzle every day, the same for everyone.', 'Watch and Learn: the game solves a ladder and explains every rung.'] },
      ]),
    ],
  },
  rules: {
    title: 'Rules',
    pages: [
      R('The ladder', [
        { p: 'A ladder has 2 to 8 vertical lines (3 to 7 in the Journey) and a number of rows. In each row there may be rungs between neighbouring lines. Two rungs in the same row may never share a line: you cannot put a rung right next to another one at the same height.' },
        { p: 'Rungs are of two kinds: fixed rungs (cream, with knots at the ends) that never move, and rungs you place (coloured). The ladder is always read from top to bottom.' },
      ], 'ink'),
      R('How a lantern travels', [
        { p: 'A lantern starts at the top of its own line and goes down row by row. In each row, if there is a rung to the right of its line, it crosses to the right; if there is a rung to the left, it crosses to the left; otherwise it stays on its line. Then it goes on to the next row. Where it is when the rows run out is the bowl it lands in.' },
        { p: 'Because two rungs never share a line in the same row, there is never a choice: every lantern has exactly one path.' },
      ], 'trace'),
      R('One-to-one, always', [
        { p: 'Each rung only swaps the two lanterns that meet it. So at every height all the lanterns are on different lines, and at the bottom they are all in different bowls. A ladder can never send two lanterns to the same bowl or leave a bowl empty.' },
      ], 'rungs'),
      R('Build puzzles: the goal', [
        { p: 'Every lantern has a colour and a number. The bowls under the ladder are not in order: each bowl shows the colour and number of the lantern that belongs in it. Put rungs into the ladder so that every lantern lands in its own bowl.' },
        { p: 'You may use at most as many rungs as the counter says. The game works out the fewest rungs that can solve each ladder; the Journey adds a few spare rungs in the early chapters and none in the last one.' },
      ], 'budget'),
      R('Placing and taking back', [
        { li: ['Tap an empty spot between two lines to place a rung. A small dot marks every spot where a rung can go.', 'Tap one of your own rungs to take it back. Fixed rungs cannot be removed.', 'A rung cannot touch another rung in the same row.', 'Undo and Redo walk through your rung changes; Clear takes back all of your rungs.', 'Keyboard: arrow keys move a cursor, Space or Enter places or takes back, R releases, U undo, Y redo, H hint, P pause.'] },
      ]),
      R('Release', [
        { p: 'Release sends all lanterns down together. Lanterns that reach their own bowl glow gold; the others show a red cross. The ladder is yours again: change it and release as often as you like. When every lantern is home, the puzzle is solved.' },
        { p: 'Tap a lantern before releasing to see its path. Tap it again to hide the path. The Settings can show every path at once.' },
      ]),
      R('Stars', [
        { p: 'A solved ladder earns up to three stars. Three stars: no hints and at most one release that did not work. Two stars: at most one hint and at most four failed releases. Otherwise one star.' },
      ]),
      R('Hints and Watch and Learn', [
        { p: 'A hint is a lesson in two steps: first where to look, then why. A third tap places the rung. If one of your rungs makes the puzzle impossible within the rung limit, the hint points at that rung first.' },
        { p: 'The hints come from the same solver that makes the puzzles: it knows the fewest rungs needed from the position you are in. Watch and Learn plays a whole ladder this way, thinking for the time you choose (2, 5, 8 or 10 seconds), showing where it looks, then explaining why. Pause freezes everything.' },
      ]),
      R('Follow the Line', [
        { p: 'A run is eight ladders. In each, one lantern is lit. Follow its path with your eyes and tap the bowl where it lands. Then the lantern goes down and shows the real path.' },
        { li: ['A correct answer scores 100 points, plus up to 100 for speed (the full amount for an instant answer, fading to nothing when the clock runs out).', 'Each correct answer in a row after the first adds 10 more points, up to 50 extra.', 'The clock is 14 s in Calm, 12 s in Steady and 10 s in Swift. When it runs out the round counts as missed.', 'Stars: 7 or 8 correct gives three, 5 or 6 two, 3 or 4 one.'] },
        { p: 'There are no stakes or prizes: your score is only for you. Your best score is kept for each tier.' },
      ], 'follow'),
      R('Draw Lots', [
        { p: 'For 2 to 8 players on one device. Choose the number of players and the kind of slips (turn order, two teams, pairs, or little tasks). The game draws a ladder with some rungs. Each player in turn adds one rung, or skips. Then each player in turn taps one unclaimed line at the top. The slips are hidden under a folded strip.' },
        { p: 'At the reveal, every lantern goes down its line and the slip it lands on is opened. Because the ladder is a one-to-one shuffle, every player gets exactly one slip and no slip is used twice. Nothing is won or lost: the game only shares out turns, teams or small friendly tasks.' },
      ], 'lots'),
      R('Daily Ladder, stats and fairness', [
        { p: 'The Daily Ladder is chosen from the date and is the same for everyone. Solving it keeps your streak. All ladders are generated by this game and each has at least one solution, found by the game\'s own solver.' },
        { p: 'Simplifications: rungs always sit at fixed rows; real paper ladders allow rungs at any height. A ladder has at most 8 lines. The game does not allow rungs that touch in the same row, as is the rule on paper.' },
      ]),
    ],
  },
  about: {
    title: 'About',
    pages: [
      R('Amidakuji', [
        { p: 'Amidakuji (あみだくじ) is a way of drawing lots with a ladder, from Japan. Kuji means lots. Players choose a line at the top, the prizes at the bottom are folded out of sight, and every rung found on the way sends the path sideways until it ends at one prize.' },
        { p: 'The same game is played across East Asia: sadari in Korea, a "ghost leg" diagram in China. It is used to hand out tasks, seats and turns because nobody can steer it: every line ends at exactly one place.' },
      ], 'trace'),
      R('Why a ladder is fair', [
        { p: 'Every rung swaps just two neighbouring paths. A ladder is therefore a perfect shuffle: no two paths ever end in the same place. You can add rungs after others have chosen their line, and that only changes who gets what, never how many prizes there are.' },
        { p: 'This game keeps the tradition and adds puzzles: build a ladder that sends every lantern home, follow a path against the clock, or draw lots with friends on one device.' },
      ]),
      R('Credits', [
        { p: 'Amidakuji is part of Arcforge, a collection of world heritage games. Heritage: Japan.' },
        { p: 'All ladders are generated by the game. The lanterns, bowls and sounds are drawn and synthesized in the game.' },
        { p: 'Fonts: Fredoka and Dela Gothic One, SIL Open Font License 1.1.' },
      ]),
    ],
  },
};
