import { RHYTHM } from './engine.js';
// Text content: facts and the Rules / How to Play / About pages. Every number here matches engine.js and game.js.
export const FACTS = [
  'Kantha is a running-stitch quilting tradition of Bengal, in Bangladesh and in the Indian state of West Bengal.',
  'Traditional kantha is made by layering old saris and dhotis and holding the layers together with rows of small running stitches.',
  'Threads were often pulled from the coloured borders of old saris, so a quilt could be made without buying anything.',
  'The stitches draw the layers together into soft ripples. That rippled surface is the look kantha is known for.',
  'Nakshi kantha means embroidered kantha. Its motifs include lotus flowers, fish, trees, boats and scenes from everyday life.',
  'A running stitch is the simplest stitch there is: the needle goes up and down in a line, so the thread shows as dashes with gaps of the same length underneath.',
  'Many kantha pieces fill the whole cloth with rows that follow the outline of the motifs, like ripples spreading in a pond.',
  'Kantha quilts were often made slowly, over months, and given as gifts for babies, brides and guests.',
];
export const TIER_TEXT = ['Even stitches, four rows, a gentle pace', 'Long and short stitches, five rows', 'A free rhythm across six rows'];

const R = (title, body, fig) => ({ title, body, fig });
export const DOCS = {
  howto: {
    title: 'How to Play',
    pages: [
      R('Sew a row', [
        { p: 'The cloth shows chalk rows: straight rows, wavy rows, rings, petals, fish and branches. Each row is sewn in one go with running stitch.' },
        { p: 'Tap the little marker at the end of a row. The game shows the hop the thread must make and how much thread it will use. Tap the same marker again, or press Sew, and the needle sews the whole row.' },
        { p: 'A ring or a petal has several markers: start anywhere on it, and the needle comes back to where it began. A dashed marker means that end would not fit on the thread you have.' },
      ], 'row'),
      R('Make the thread last', [
        { p: 'Your thread is only so long. Sewing a row uses its length, and the hop under the cloth to the next row uses thread too.' },
        { p: 'When the next row does not fit, or it is another colour, a new thread begins there and the rest of the old one is wasted.' },
        { p: 'Sew the whole patch with as few threads as you can. Three stars means the fewest possible.' },
      ], 'thread'),
      R('Hints and Undo', [
        { p: 'Undo takes back the last row. Clear takes everything off the cloth, and Undo brings it back.' },
        { p: 'Tap the lamp for a hint: first where to look, then why that row is the best next one, then place it for you.' },
        { p: 'Watch and Learn plays a whole patch by itself and explains every choice. You can pause it at any time.' },
      ], 'hint'),
      R('Steady Hand', [
        { p: 'A calm timing game. The needle runs along a row and a ring closes round every mark. Tap anywhere as the needle reaches a mark and a stitch is sewn.' },
        { p: 'Where the needle is when you tap is where the stitch really goes, so steady taps make even stitches. Finish every row to see the cloth ripple.' },
      ], 'steady'),
    ],
  },
  rules: {
    title: 'Rules',
    pages: [
      R('The cloth and the goal', [
        { p: 'A patch is a square of cloth with chalk rows on it. A row is a line of running stitch: dashes with gaps, as in kantha quilting.' },
        { p: 'Goal: sew every row of the patch. You may sew the rows in any order, each one exactly once, and each one in one go from one end to the other.' },
        { p: 'You win a patch when its last row is sewn. The result is measured in threads: fewer is better.' },
      ], 'row'),
      R('Sewing a row', [
        { li: [
          'Rows that are open lines have two ends. Sewing starts at the end you choose and finishes at the other end.',
          'Rows that are closed (rings, petals, leaves, fish bodies, sails, frames) have two to four entry points, each shown as a marker. Sewing starts at the one you choose, goes once all the way round and finishes at the same point.',
          'Tap a marker to see the cost of starting there. Tap it again, or press Sew, to commit. Tap elsewhere or another marker to change your mind.',
          'A marker drawn dashed means that row (with its hop) does not fit in what is left of the thread, or it is another colour: sewing it starts a new thread.',
          'A row that is already sewn cannot be sewn again.',
        ] },
      ], 'ring'),
      R('Thread length', [
        { p: 'Each thread is the same length for a patch. The gauge shows how much is left in the thread on the needle.' },
        { li: [
          'The first row of a thread starts anywhere for free.',
          'Sewing a row uses its whole length.',
          'The hop under the cloth, from where the needle stopped to the start of the next row, uses thread equal to the straight distance.',
          'If the next row (with its hop) is longer than what is left, or it is another colour, a new thread starts at the end you chose. The old thread is cut and what was left is wasted.',
        ] },
        { p: 'The count of threads used includes the first one.' },
      ], 'hop'),
      R('Colours', [
        { p: 'Every row has a thread colour, shown by a tint on its chalk dashes and by a marker. A thread has one colour, so changing colour always means a new thread.' },
        { p: 'Settings has Colour marks: a small shape (circle, triangle, square, diamond, plus) beside each row and in the gauge, so colours can be told apart without relying on colour.' },
      ], 'colour'),
      R('Stars', [
        { p: 'Every patch is solved exactly by the game before you start, so its fewest possible threads is known. That number is shown as the aim.' },
        { li: [
          'Three stars: you used the fewest possible threads.',
          'Two stars: one more than the fewest.',
          'One star: any complete patch.',
        ] },
        { p: 'Hints, Undo and Clear do not change the stars. Time does not either.' },
      ], 'stars'),
      R('Hints, Undo and Watch and Learn', [
        { li: [
          'Undo takes back the last row. It can be used again and again.',
          'Clear takes every row off the cloth. Undo brings the rows back, one step at a time.',
          'Hint: the game plays out the best plan from where you are, shows where to look, then explains why, then sews that row for you.',
          'Watch and Learn plays a whole patch with the same hints. THINK time before each step can be 2, 5, 8 or 10 seconds. Pause freezes everything.',
        ] },
        { p: 'Settings has Path check: when on, the aim line tells you if the way you are going needs more threads than the best plan.' },
      ], 'hint'),
      R('Steady Hand', [
        { p: 'Choose Calm, Steady or Swift: four, five or six rows. The needle moves along a row at a steady speed. Marks sit along the row; a ring closes round the next mark as the needle nears it. Calm marks are evenly spaced, Steady alternates short and long gaps, Swift is free.' },
        { li: [
          'Tap anywhere (or press Space) as the needle reaches a mark. One tap sews one stitch, centred where the needle is at that moment.',
          `Timing windows per mark: Perfect 100 points, Good 70, Close 35, otherwise the mark is missed. Windows are narrower on harder tiers (${RHYTHM.map((r) => `${r.name} ${r.win.map((v) => v.toFixed(2)).join(', ')}`).join('; ')} seconds either side).`,
          'A combo adds 2 points per mark in a row, up to 20 marks.',
          'Stars follow how even the stitches were: 88% or more is three stars, 70% two, 45% one.',
        ] },
        { p: 'Score only: there are no stakes, no lives and nothing is lost by missing.' },
      ], 'steady'),
      R('Daily patch, saving and the preview', [
        { li: [
          'The Daily Patch is a new cloth each day, the same for everyone. Sew it to keep your streak.',
          'A patch in progress is saved when you leave and offered under Continue.',
          'The free preview counts real play only: sewing a patch or a Steady Hand round. Menus, Rules, Settings, Watch and Learn and pause do not use it.',
          'Keyboard: arrow keys move the marker, Space or Enter selects and sews, U undoes, H hints, P or Esc pauses.',
        ] },
      ], 'quilt'),
      R('What is simplified', [
        { p: 'Real kantha is sewn through several layers of cloth, with stitches of slightly uneven length, by hand, over weeks. Here a patch is one flat square, the rows are chosen to make a puzzle, and a thread is a fixed length.' },
        { p: 'The motifs (rows, rings, lotus petals, fish, boats, trees) are inspired by kantha and drawn for this game. They are not copies of any particular quilt.' },
      ], 'quilt'),
    ],
  },
  about: {
    title: 'About',
    pages: [
      R('Kantha', [
        { p: 'Kantha is the running-stitch quilting of Bengal, in Bangladesh and the Indian state of West Bengal. For generations, women have layered worn saris and dhotis and joined them with rows of small stitches, often using threads pulled from the coloured borders of the old cloth.' },
        { p: 'The stitching gathers the layers into gentle ripples. Nothing is wasted: old cloth becomes a quilt, a wrap, a cover. Nakshi kantha, the embroidered kind, tells stories in lotus flowers, fish, trees and boats.' },
      ], 'quilt'),
      R('This game', [
        { p: 'Kantha Running Stitch Quilt turns the thrift of the tradition into a puzzle: every thread is only so long, and every hop under the cloth costs some of it. Sew each patch with as few threads as you can, then watch the cloth settle into ripples.' },
        { p: 'Steady Hand is a calm timing game about even stitches. The thirty patches of the quilt fill in as you sew them.' },
      ], 'thread'),
      R('Credits', [
        { p: 'Kantha Running Stitch Quilt is part of Arcforge, a collection of world heritage games. Heritage: Bangladesh and Bengal.' },
        { p: 'Fonts: Cormorant Garamond and Fredoka, used under the SIL Open Font License 1.1. All art and sound are drawn and synthesized in the game.' },
      ]),
    ],
  },
};
