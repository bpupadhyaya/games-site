// Text for About, How to Play and Rules. Every rule here is checked against geo.js / puzzle.js / game.js (see design/GDD.md,
// "Rules reference"). Blocks: { h } heading, { p } paragraph, { li: [...] } bullets, { note } callout. fig: what the picture shows.
export const ABOUT = {
  title: 'About',
  pages: [
    {
      title: 'Costa Rican Painted Oxcart', fig: { k: 'wheel', i: 0 },
      body: [
        { p: 'The painted oxcart, the carreta, is one of the best-loved symbols of Costa Rica. Carts like these once carried coffee down from the highland farms, and the wheels were painted with bright geometric sunbursts, stars and flowers. The town of Sarchi is famous for its workshops, and the painted oxcart was named a national symbol of work in 1988.' },
        { p: 'In 2005 UNESCO proclaimed the oxcart tradition of Costa Rica a Masterpiece of the Oral and Intangible Heritage of Humanity. Workshops still make and paint carts by hand, and each painter has favourite patterns and an eye for colour and symmetry.' },
        { p: 'This game borrows that eye. You paint wheels, cart panels and yoke boards in strong colours, and one stroke paints every matching segment around a symmetric piece. The puzzle rules are the game\'s own invention; the real painting is freehand and never needs a rule card.' },
      ],
    },
    {
      title: 'What is in the game', fig: { k: 'cart' },
      body: [
        { li: ['24 commissions in four sets: First Wheels, Cart Panels, Yoke Boards and Master Wheels.', 'A Daily Commission, a new piece every day.', 'Free Painting: choose a wheel with 2, 3, 4, 6 or 8-fold symmetry, or a cart panel, and paint with unlimited paint.', 'A Gallery for your finished pieces and a rolling cart to show them off.', 'Hints that explain why a colour fits, and Watch and Learn, where the workshop paints a piece and says why for every stroke.', 'Rules and How to Play with text zoom up to 300%.'] },
      ],
    },
    {
      title: 'Credits and the free preview', fig: { k: 'jars' },
      body: [
        { p: 'You can play for a free preview first. Unlocking the full game is a single one-time purchase; there are no ads and no subscriptions.' },
        { p: 'Patterns here are generic geometric designs in the spirit of the tradition; they do not copy any particular workshop or painter. No animals appear in the game: it is about the wheel and the cart.' },
        { p: 'Interface text is set in Barlow and titles in Dela Gothic One, both used under the SIL Open Font License 1.1. The 3D workshop is drawn on your device with three.js (MIT licence, threejs.org); the lit wheel, boards, jars and bench are built in code. All paint, wood and sound are made on your device. Costa Rican Painted Oxcart is part of Arcforge, a collection of world heritage games.' },
      ],
    },
  ],
};

export const HOWTO = {
  title: 'How to Play',
  pages: [
    { title: 'Pick a commission', fig: { k: 'wheel-bare', i: 1 }, body: [
      { p: 'Tap Commissions and choose a piece. Each one is a bare timber wheel, cart side panel or yoke board waiting for paint. Finish a commission to unlock nothing: every one is open, so start anywhere.' },
      { p: 'The brief card under the piece lists what must be true to finish. Each line has a live tick or cross.' },
    ] },
    { title: 'Paint a stroke', fig: { k: 'wheel-set', i: 0 }, body: [
      { p: 'Tap a paint pot to load the brush, then tap a segment. One stroke paints the whole set of segments that mirror or repeat it, all at once: that is why the wheel is painted with a single tap.' },
      { p: 'Drag across the piece to paint several sets in one go. A white outline shows the set under your finger. Segments with a brass peg were painted by the master and stay as they are.' },
    ] },
    { title: 'The paint pots', fig: { k: 'jars' }, body: [
      { p: 'Every pot holds exactly the paint this piece needs. The number on the pot is how many segments it can still colour, and the level drops with each stroke.' },
      { p: 'A stroke needs enough paint for its whole set. If the pot is too low it shakes and the stroke is refused. Repainting a set, or scraping it bare with the Eraser, returns the paint to its pot.' },
      { note: 'When every segment is painted and every rule is met, every pot is exactly empty.' },
    ] },
    { title: 'Touching and smudges', fig: { k: 'wheel-clash', i: 0 }, body: [
      { p: 'Segments that touch must be different colours. If two touching segments match, a red smudge badge sits on the edge between them and the first line of the brief turns red.' },
      { p: 'A smudge is not a game over. Change one of the two colours, or undo, and the smudge goes. Smudges only count against your stars.' },
    ] },
    { title: 'Panels and yokes', fig: { k: 'panel' }, body: [
      { p: 'Cart panels and yoke boards are rows of squares. They mirror left to right, and some panels also mirror top to bottom, so one stroke paints two or four squares at once.' },
      { p: 'The same rules apply: touching squares differ, the brief may ban a colour from a row, and the pots must end exactly empty.' },
    ] },
    { title: 'Help when you are stuck', fig: { k: 'wheel', i: 2 }, body: [
      { li: ['Hint: the bulb first shows where to look, then explains why a colour fits, then paints it for you.', 'Undo and Redo: every stroke can be taken back.', 'Eraser: scrape a segment bare and get the paint back.', 'Watch and Learn: the workshop solves a commission and explains each stroke. You can pause it and change its thinking time.'] },
      { p: 'If an earlier stroke has made the piece impossible to finish, the hint says so and points at the segment to repaint.' },
    ] },
    { title: 'Finish and the Gallery', fig: { k: 'cart' }, body: [
      { p: 'When the piece is done it is fitted to a cart and rolls down the road. Up to three stars: three for finishing with at most one smudge and no hints.' },
      { p: 'Finished pieces and Free Painting saves hang in the Gallery. Tap one to watch it roll again.' },
    ] },
  ],
};

export const RULES = {
  title: 'Rules',
  pages: [
    { title: '1. The goal', fig: { k: 'wheel', i: 0 }, body: [
      { p: 'A commission is finished when all four things are true at once:' },
      { li: ['Every segment is painted.', 'No two touching segments are the same colour.', 'Every extra rule on the brief card holds.', 'Every pot is empty (shown on the brief as "Use up all the paint").'] },
      { p: 'Pots are filled with exactly the number of segments of each colour in the master\'s design, so once every segment is painted without running a pot dry, all pots are empty. You never need to count paint at the end.' },
    ] },
    { title: '2. Strokes and symmetry sets', fig: { k: 'wheel-set', i: 1 }, body: [
      { p: 'A stroke paints a whole symmetry set, never a single segment on its own.' },
      { h: 'Wheels' },
      { li: ['An n-fold wheel repeats every 1/n of a turn: a segment, and the segments one repeat further round the same ring, form one set.', 'Some wheels also mirror: the reflection of a segment across the line between repeats joins its set.', 'The hub disc in the middle is a set of its own.', 'Rings are counted from the hub: the inner ring, ring 2, and so on to the rim ring.'] },
      { h: 'Panels and yokes' },
      { li: ['Left and right mirror, so a square and its mirror image are one set.', 'Some panels also mirror top to bottom: then up to four squares are one set.'] },
    ] },
    { title: '3. What touches what', fig: { k: 'wheel-clash', i: 1 }, body: [
      { h: 'Wheels' },
      { li: ['A segment touches the segment beside it in the same ring (including across the top, where the ring closes).', 'It touches the segment directly outward and inward in the next ring.', 'The hub touches every segment of the inner ring.', 'Segments that meet only at a corner do not touch.'] },
      { h: 'Panels and yokes' },
      { li: ['A square touches the four squares sharing an edge. Diagonals do not touch.'] },
      { note: 'Two touching segments that belong to the same set are fine: they are one stroke and are always the same colour, so the mirror seam in the middle of a panel is never a smudge.' },
    ] },
    { title: '4. Paint and pots', fig: { k: 'jars' }, body: [
      { li: ['Each pot shows how many segments of paint it holds now.', 'A stroke uses one unit per segment of its set, taken from the chosen pot.', 'If the pot holds less than the whole set needs, the stroke is refused and nothing changes.', 'Repainting a set puts its old paint back in its pot before taking the new paint. Painting a set the colour it already has changes nothing.', 'The Eraser scrapes a set bare and returns its paint.', 'Strokes the master made (brass pegs) cannot be painted over or erased.'] },
    ] },
    { title: '5. Extra rules on the brief', fig: { k: 'wheel', i: 1 }, body: [
      { p: 'Besides touching and pots, a commission can add up to three of these:' },
      { li: ['"No red on the rim ring": a colour is banned from a ring or row. It may be used anywhere else.', '"Ring 2: every set a different colour": all the different sets that appear in that ring or row use different colours from each other. A set that repeats round the ring counts once.'] },
      { p: 'Each line on the brief shows a tick when it holds right now and a cross when it does not. A banned colour or a repeated colour in a row shows as broken the moment you paint it.' },
    ] },
    { title: '6. Smudges, hints and stars', fig: { k: 'stars' }, body: [
      { li: ['A smudge is counted when you paint a stroke that, at that moment, touches a set of the same colour, uses a banned colour or repeats a colour in a "different colours" row. Pot refusals are not smudges.', 'A smudge is counted once per stroke, not per touching pair. Undo, the Eraser and repainting do not remove a smudge already counted.', 'Using the hint counts one hint each time you ask for it. The paint applied by "Paint it" is never a smudge.', 'Three stars: at most one smudge and no hints. Two stars: at most four smudges and at most two hints. Otherwise one star. Time never matters.'] },
    ] },
    { title: '7. Hints and dead ends', fig: { k: 'wheel', i: 0 }, body: [
      { p: 'The hint picks the set with the fewest colours that still allow a finished piece, then explains in two steps: where to look, and why. Its reasons are real: neighbours already painted, banned colours, repeated colours, a pot too low, or a colour that would look fine now but lead to a dead end later.' },
      { p: 'If no finished piece is possible from the current paint, the hint says it is a dead end and marks one earlier stroke to scrape. After scraping it, the rest can be finished.' },
    ] },
    { title: '8. Watch and Learn', fig: { k: 'wheel', i: 1 }, body: [
      { p: 'The workshop paints a commission itself, one stroke at a time, using the same teacher as the hint: first it looks (the Think time you set, 2, 5, 8 or 10 seconds), then it says why, then it paints. Pause freezes everything, including the timers, and Resume continues exactly where it stopped. Exit returns to the menu.' },
    ] },
    { title: '9. Free Painting, Gallery and daily', fig: { k: 'panel' }, body: [
      { li: ['Free Painting has no rules, no stars and unlimited paint; you choose the shape and the symmetry.', 'The Gallery keeps your 24 most recent pieces; older ones drop off.', 'The Daily Commission is the same piece for everyone on a given day. Finish it on its own day to extend your streak.', 'The free preview counts 90 seconds of real painting; menus, rules, pause, results, the Gallery and Watch and Learn do not use it. The web demo allows three pieces.'] },
    ] },
    { title: '10. Simplifications and controls', fig: { k: 'cart' }, body: [
      { li: ['Real painting is freehand and has no exact colour counts; the pots, rules and smudges are puzzle conventions added by this game.', 'Patterns and set names are generic. Wheels here are a solid timber wheel with a flat painted face, painted ring by ring.'] },
      { h: 'Keyboard (web demo)' },
      { li: ['1 to 6 choose a pot, arrow keys move the cursor, Space or Enter paints.', 'E eraser, U undo, Y redo, H hint, P or Escape pause.'] },
    ] },
  ],
};
export function docOf(d) {
  return d.kind === 'about' ? ABOUT : d.kind === 'howto' ? HOWTO : RULES;
}
