// Text for About, How to Play, Rules. Every rule here is checked against rules.js / gen.js / game.js (see design/GDD.md,
// "Rules reference"). Blocks: { h } heading, { p } paragraph, { li: [...] } bullets, { note } callout.
// fig: what the figure beside the text shows (art.js draws the real pieces).
export const ABOUT = {
  title: 'About',
  pages: [
    {
      title: 'Quilt Patterns', fig: { k: 'block', id: 'ohio-star' },
      body: [
        { p: 'Piece traditional quilt blocks from printed cloth, then arrange the blocks into a quilt top with sashing and a border. Every puzzle is a design problem: match a sample, or meet a brief about contrast, balance and repeat.' },
        { p: 'Quilting is a craft with a long history in the United States, from thrifty scrap quilts to bold modern design. This game borrows its geometry and its habits of mind: cut, arrange, step back, squint.' },
        { li: ['Six traditional blocks: Nine-Patch, Log Cabin, Flying Geese, Pinwheel, Ohio Star and Bear Paw.', 'Eighteen printed and plain fabrics in three palettes.', 'Eight short lessons on block geometry and colour value.', 'Challenges to copy a sample or meet a design brief, for blocks and for whole quilts.', 'Free Studio and a Gallery for the quilts you finish.', 'Hints that explain why a cloth fits, and Watch and Learn, where the game designs a block and a quilt and tells you its reasons.'] },
      ],
    },
    {
      title: 'Credits and the free preview', fig: { k: 'quilt' },
      body: [
        { p: 'You can play for a free preview first. Unlocking the full game is a single one-time purchase; there are no ads and no subscriptions.' },
        { p: 'Palette names such as "Plain and jewel tones", "Homespun scraps" and "Bold and improvised" describe styles of cloth and colour only. They are inspired by the wide range of American quilt making and make no claim to reproduce, represent or be endorsed by any maker or community.' },
        { p: 'Interface text is set in Fredoka, used under the SIL Open Font License 1.1. All cloth, light and sound are made on your device. Quilt Patterns is part of Arcforge, a collection of world heritage games.' },
      ],
    },
  ],
};

export const HOWTO = {
  title: 'How to Play',
  pages: [
    { title: 'Pick a task', fig: { k: 'block', id: 'pinwheel' }, body: [
      { p: 'Tap Play for the lessons and challenges. Lessons teach one block each. Block challenges ask you to copy a sample or to meet a design brief. Quilt challenges ask you to arrange finished blocks and frame them.' },
      { p: 'The Daily Brief is the same for every player each day. Free Studio has no rules: every fabric is yours.' } ] },
    { title: 'Piece a block', fig: { k: 'block', id: 'nine-patch' }, body: [
      { p: 'The block sits on a cutting mat. Tap a fabric in the tray, then tap the pieces you want in that cloth. A tapped piece drops into place with a stitched seam. Empty pieces show a paper template with the letter of their shape group (A, B or C).' },
      { li: ['Fill shape (the bucket): one tap paints every piece of the same shape group.', 'Undo and Redo walk through your moves.', 'Squint turns the picture grey so you can judge light and dark, the way quilters squint.', 'Hint (the bulb) tells you where to look, then explains why a cloth fits.'] } ] },
    { title: 'Meet the brief', fig: { k: 'values' }, body: [
      { p: 'In a design brief the card lists rules. Each has a tick or a cross that updates as you work, and a note of how close you are. When every rule has a tick the block is pressed and finished.' },
      { p: 'In a copy challenge the card shows the sample. A piece counts only when it is exactly the same fabric as the sample.' } ] },
    { title: 'Make a quilt', fig: { k: 'quilt' }, body: [
      { p: 'Choose a block in the tray, then tap a square on the quilt to place it. Tap the same square again to turn the block a quarter turn. The turn button sets the turn for the next block you place.' },
      { li: ['Sash tab: pick sashing width and cloth.', 'Border tab: pick the border width and cloth.', 'Cornerstones where the sashing crosses use the border cloth, or the sashing cloth when there is no border.'] } ] },
    { title: 'Watch and Learn', fig: { k: 'block', id: 'ohio-star' }, body: [
      { p: 'Watch and Learn designs a block and then a quilt by itself. For every step it thinks, shows where to look, explains why, then places the cloth. Use the Think buttons to change how long it thinks (2 to 10 seconds) and Pause to freeze everything where it is.' },
      { p: 'On a keyboard: 1 to 9 pick a fabric, arrow keys move, Space or Enter stitches, U undoes, Y redoes, S squints, H hints, R turns, P pauses.' } ] },
  ],
};

export const RULES = {
  title: 'Rules',
  pages: [
    { title: 'What you are making', fig: { k: 'block', id: 'bear-paw' }, body: [
      { p: 'A block is a small square pieced from flat shapes called pieces. A quilt top is a grid of blocks, optionally with sashing between them and a border round the outside.' },
      { li: ['Copy challenge: make your design identical to the sample.', 'Design brief: meet every rule on the card. Any design that meets them all is a win, not only the one the game has in mind.', 'Quilt challenge: the same two kinds of task, with whole blocks as the pieces.', 'Free Studio: no rules; use Save or Finish to keep what you make.'] } ] },
    { title: 'Pieces and shape groups', fig: { k: 'block', id: 'log-cabin', empty: true }, body: [
      { p: 'Every block has a fixed list of pieces. Pieces are grouped into shape groups named A, B and C, which are the letters shown on empty pieces. The groups are:' },
      { li: ['Nine-Patch (9 pieces): A the four edge squares, B the four corner squares and the centre.', 'Log Cabin (9): A the first two logs of each round (the light side), B the next two (the dark side), C the centre square.', 'Flying Geese (6): A the four sky triangles, B the upper goose, C the lower goose.', 'Pinwheel (8): A the four background triangles, B the four blades.', 'Ohio Star (21): A the four corner squares and the eight side triangles of the hourglass units (the sky), B the eight star-point triangles, C the centre.', 'Bear Paw (14): A eight sky triangles and the square beside the pad, B the pad, C the four toes.'] },
      { p: 'A group may use any fabric. The groups only help you think and let the Fill shape tool paint them together.' } ] },
    { title: 'Painting and moves', fig: { k: 'swatches' }, body: [
      { p: 'Choose a fabric in the tray, then tap pieces. Tapping a piece that already holds that fabric does nothing. With Fill shape on, one tap paints every piece in that shape group.' },
      { li: ['Every tap that changes the design is one move. Fill shape counts as one move.', 'Undo and Redo step through your moves. A new move clears Redo.', 'Applying a hint does not count as a move; it counts as a hint.'] } ] },
    { title: 'Value and contrast', fig: { k: 'values' }, body: [
      { p: 'Value is how light a fabric is. The game measures it from the fabric\'s base colour as lightness = 21.26% red + 71.52% green + 7.22% blue, from 0% (black) to 100% (white). Prints are measured by their base colour.' },
      { p: 'Dark means below 30%, medium means 30% up to 60%, light means 60% or more.' },
      { li: ['Contrast rule: the average value of two shape groups (weighted by area, counting painted pieces only) must be at least the stated percentage apart. The card shows how far apart they are now.', 'Darker rule: the first group\'s average value must be lower than the second\'s by at least the stated percentage.', 'Light, medium and dark: the painted pieces must include at least one fabric from each of the three bands.'] } ] },
    { title: 'Counting fabrics', fig: { k: 'swatches' }, body: [
      { li: ['At most n fabrics: the number of different fabrics used must not exceed n.', 'At least n fabrics: it must reach n.', 'Feature fabric: the named fabric must be used in at least n pieces.', 'An unpainted piece is not counted as any fabric.'] },
      { p: 'Changing a fabric\'s print or colour is not possible; two fabrics are the same only if they are the same swatch in the tray.' } ] },
    { title: 'Quiet beside busy', fig: { k: 'swatches' }, body: [
      { p: 'Plaid, stripe, gingham, little-flower and lattice prints are busy. Solids and pin-dots are quiet.' },
      { p: 'The quiet-beside-busy rule fails for every pair of pieces that share a seam (an edge, even a short one) when both are busy prints. Pieces touching only at a corner do not count. The card shows the number of clashes.' } ] },
    { title: 'Balance', fig: { k: 'block', id: 'flying-geese' }, body: [
      { p: 'Dark weight is each painted piece\'s area times its darkness (100% minus its value). The balance point is the weighted middle of all the pieces. The rule passes when that point is within the stated percentage of the block width from the exact centre.' },
      { p: 'A fully symmetrical block, such as a Pinwheel with one cloth per group, always balances; blocks like Log Cabin, Bear Paw and Flying Geese do not. Briefs for the quilt use the same idea across the whole top, using each block\'s average value.' } ] },
    { title: 'Quilt tops', fig: { k: 'quilt' }, body: [
      { p: 'The top is 3 by 3 blocks, or 4 by 4 in the hardest challenges. Sashing widths are None, Narrow (14% of a block) and Wide (26%). Border widths are None, Narrow (22%) and Wide (40%).' },
      { li: ['Placing: choose a block, tap a square. Tapping a square that already holds the chosen block at the chosen turn turns it one quarter.', 'Cornerstones: squares where sashing crosses take the border cloth, or the sashing cloth if there is no border.', 'A quilt challenge is finished when every square holds a block and every rule has a tick.'] } ] },
    { title: 'Quilt rules', fig: { k: 'quilt' }, body: [
      { li: ['Sashing contrast: the sashing needs a width and a cloth, and its value must be at least the stated percentage apart from the average value of the placed blocks.', 'Border contrast: the same for the border.', 'Use every block at least n times: counted over the squares.', 'Echo a block fabric in the border: the border cloth must appear in at least one of the blocks you were given.', 'No two touching blocks the same: squares that share an edge may not hold the same block at the same turn.', 'Balance: the dark-weight centre of the placed blocks must be within the stated percentage of the quilt width from the middle.', 'Sashing and border in different fabrics: both present and not the same swatch.'] } ] },
    { title: 'Stars', fig: { k: 'stars' }, body: [
      { p: 'A finished task earns 1 to 3 stars. Par is the number of pieces in the block (for a quilt, the number of squares plus 4).' },
      { li: ['3 stars: no hints, and moves no more than 1.6 times par.', '2 stars: two hints or fewer, and moves no more than 3 times par.', '1 star: anything else.'] },
      { p: 'The clock never ends a task. It is shown for interest and can be switched off in Settings.' } ] },
    { title: 'Hints and Watch and Learn', fig: { k: 'block', id: 'ohio-star' }, body: [
      { p: 'A hint plans the next piece from the game\'s own answer to the task. Stage 1 says where to look and marks the piece. Stage 2 explains why that cloth fits. Apply stitches it for you.' },
      { p: 'If your design already meets every rule there is nothing left to hint. If you have used a different but valid cloth, the hint still points to the game\'s answer, which is one of several possible.' },
      { p: 'Watch and Learn runs the same planner by itself: think (2, 5, 8 or 10 seconds), reveal (two seconds with the piece marked and the reason shown), then place. Pause freezes everything, including the think timer, until you resume.' } ] },
    { title: 'Daily Brief, preview and saving', fig: { k: 'quilt' }, body: [
      { p: 'The Daily Brief is generated from the day number, so every player gets the same task. Finishing it keeps a streak of consecutive days.' },
      { p: 'The free preview counts only live play: menus, Rules, results, Watch and Learn, pause and the Gallery are free. An unfinished task is saved when you leave and offered as Continue.' },
      { p: 'Finished blocks join the My Blocks shelf (up to 12) for Free Studio quilts. The Gallery keeps up to 24 finished quilts.' } ] },
  ],
};
export const DOCS = { about: ABOUT, howto: HOWTO, rules: RULES };

import { LESSONS } from './gen.js';
export const lessonDoc = (id) => {
  const L = LESSONS.find((l) => l.id === id) ?? LESSONS[0], n = LESSONS.indexOf(L) + 1;
  return { title: `Lesson ${n}`, pages: [{ title: L.title, fig: { k: 'block', id: L.block }, body: [...L.teach.map((p) => ({ p })), { note: L.mode === 'copy' ? 'Your task: copy the sample, piece by piece.' : 'Your task: meet the rules on the brief card.' }] }] };
};
export const docOf = (doc) => (doc.kind === 'lesson' ? lessonDoc(doc.lesson) : DOCS[doc.kind]);
