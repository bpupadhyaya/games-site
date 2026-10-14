// Text for the About, How to Play and Rules screens. Every rule here is checked against wire.js / game.js.
// Blocks: { h } heading, { p } paragraph, { li: [...] } bullets. A page may carry `fig` (an animated 3D example from levels.js FIGURES).
export const ABOUT = {
  title: 'About',
  pages: [
    {
      title: 'Tavern Nail and Wire Puzzles',
      fig: 'ring',
      body: [
        { p: 'A piece of bent iron wire holds a ring, a hook or a nail, and your job is to get it off. You slide the loose piece, turn it a quarter at a time, and look for the one angle where the wire lets it through.' },
        { p: 'Every puzzle is built for you and checked by computer: there is always a way out. There are thirty levels from the bar top to the landlord\'s own, a new Round of the Day, hints that explain the idea, and Watch and Learn, which plays a puzzle while it thinks aloud.' },
      ],
    },
    {
      title: 'The tradition',
      body: [
        { p: 'Disentanglement puzzles made of bent nails, iron rings and twisted wire have long been a pastime at inn and pub tables in Germany, the Alpine lands and Britain. Smiths made them from offcuts, and one was passed from hand to hand until someone found the trick.' },
        { p: 'They are solved by feel and insight rather than force: the pieces come apart because of how they are held, not because of how hard you pull. That is the spirit of this game.' },
        { p: 'This is a respectful homage, not a record of any one traditional puzzle. The shapes here are original, drawn on a lattice so that every one can be proven solvable.' },
      ],
    },
    {
      title: 'Credits and the free preview',
      body: [
        { p: 'You can play for a free preview first. Unlocking the full game is a single one-time purchase; there are no ads and no subscriptions.' },
        { p: 'Headings are set in Cinzel and interface text in Barlow, both used under the SIL Open Font License 1.1. All sounds are synthesized on your device and the 3D picture is drawn by the game itself.' },
        { p: 'Tavern Nail and Wire Puzzles is part of Arcforge, a collection of world heritage games.' },
      ],
    },
  ],
};

export const HOWTO = {
  title: 'How to Play',
  pages: [
    {
      title: 'Get the loose piece out',
      fig: 'zone',
      body: [
        { p: 'The dark iron frame is held still. One or two loose pieces of coloured metal are caught on it. Carry every loose piece out of the dashed zone round the frame and the puzzle is free.' },
        { p: 'Wire cannot pass through wire, and pieces are rigid: you cannot bend them. The only moves are slides and quarter turns.' },
      ],
    },
    {
      title: 'Slide',
      fig: 'slide',
      body: [
        { p: 'Drag a loose piece to slide it along one of the three axes, one step at a time. Or tap a Slide button: the minus and plus buttons for X, Y and Z move the chosen piece one step in that direction.' },
        { li: ['The little axis dial at the bottom left shows which way plus X (red), plus Y (green) and plus Z (blue) point on the screen right now.', 'A move that would make wires touch is refused and the piece shudders.'] },
      ],
    },
    {
      title: 'Turn',
      fig: 'turn',
      body: [
        { p: 'Tap a Turn button to swing the piece a quarter about one axis. It pivots on its grip bead, the glowing dot. The piece sweeps through the turn, so it must have room all the way round, not just at the end.' },
        { p: 'Most puzzles need at least one turn. A ring that is too wide to pass a bend flat will often pass it edge-on.' },
      ],
    },
    {
      title: 'Look round',
      body: [
        { p: 'Drag the empty mat, or the frame, to walk round the puzzle, and use the mouse wheel on a computer to zoom. Many puzzles that look hopeless from the front are obvious from above.' },
        { p: 'With two loose pieces, tap a piece (or the Piece button) to choose which one the buttons move. One piece may be holding the other in.' },
      ],
    },
    {
      title: 'Help when you want it',
      body: [
        { p: 'Think works out the quickest route from where you are, shows the next move as an arrow and tells you why. Tap Do it to make the move or Close to carry on alone. Undo takes back your last move and Reset puts the pieces back at the start.' },
        { p: 'Watch and Learn plays a puzzle through for you. It thinks, shows its choice, then moves. You can pause it at any time and set how long it thinks.' },
      ],
    },
  ],
};

export const RULES = {
  title: 'Rules',
  pages: [
    {
      title: 'The pieces',
      fig: 'ring',
      body: [
        { p: 'Every piece is wire bent along the lines of a three-dimensional lattice: straight runs that meet at right angles, with a few closed loops. There are two kinds of piece.' },
        { li: ['The frame is dark iron. It is held still and never moves.', 'A loose piece is brass, copper or steel: a ring, a bent ring, a hook, a nail or a pin. It can slide and turn.'] },
        { p: 'Each loose piece pivots on its grip bead, a lattice point marked by a glowing dot when the piece is chosen. A puzzle has one or two loose pieces.' },
      ],
    },
    {
      title: 'Slides',
      fig: 'slide',
      body: [
        { p: 'A slide moves the chosen piece one lattice step along +X, -X, +Y, -Y, +Z or -Z. Its whole shape moves together.' },
        { p: 'A slide is allowed when, after the step, no wire point of the piece sits on a wire point of the frame or of the other loose piece. Wires only ever meet at lattice points, so that test is exact.' },
        { p: 'A piece also cannot leave the mat: it may travel until it is a full reach beyond the frame, which is always far enough to be clear.' },
      ],
    },
    {
      title: 'Turns',
      fig: 'turn',
      body: [
        { p: 'A turn rotates the chosen piece a quarter (90 degrees) about the X, Y or Z axis through its grip bead, in the plus or the minus direction. There are six turns in all.' },
        { p: 'A turn is allowed when the finished position is free of the other wire, and when the piece also clears it all the way round: the sweep is checked every 15 degrees, and at every check the centre lines of wires must stay at least 0.36 of a lattice step apart, which is the thickness of the wire plus a little air.' },
        { p: 'This means a piece can be blocked from turning even though the place it would end up in is empty. Look for a spot with room to swing.' },
      ],
    },
    {
      title: 'Winning',
      fig: 'zone',
      body: [
        { p: 'A loose piece is clear when the box that just holds it and the box that just holds the frame have a gap between them. The dashed zone drawn on the mat and in the air is the frame\'s box, grown by half a step.' },
        { p: 'Once every loose piece is clear the puzzle is free. If a clear piece is still in the way of another, you may keep moving it; only the final position counts.' },
        { p: 'Two loose pieces also block each other, and a jam is possible: if no piece can get out on its own, Think says so and offers Undo.' },
      ],
    },
    {
      title: 'Think, stars and par',
      body: [
        { p: 'Every level has a par: the fewest moves (slides and turns together) that free all its pieces, found by searching every position. The puzzles are generated and checked by computer, so a way out always exists.' },
        { li: ['Think finds the quickest way out from where you are now, shows the first move and says how many moves are left. Each use is counted.', 'Three stars: freed within par plus a little (the larger of 2 moves or a third of par) with no Think used.', 'Two stars: freed within twice par plus 4 moves.', 'One star: freed.'] },
        { p: 'Undo takes back one move and also takes one off your move count. Reset puts the pieces back at the start and zeroes the count; hints used stay counted.' },
      ],
    },
    {
      title: 'Levels, the Round of the Day and Watch and Learn',
      body: [
        { p: 'There are thirty levels in five stages. Freeing a level unlocks the next. The Round of the Day is a puzzle chosen from the day number, so it is the same for everyone, and finishing it keeps your daily streak.' },
        { p: 'Watch and Learn plays a puzzle by itself: it thinks (2, 5, 8 or 10 seconds, your choice), highlights its move, then makes it. Pause freezes everything, including the thinking timer, and Resume carries on exactly where it stopped. It uses the same search as Think.' },
        { p: 'The free preview counts only time spent in a live puzzle. Menus, these pages, settings, Watch and Learn, pause and result screens are free. The web demo is limited to three puzzles.' },
      ],
    },
    {
      title: 'Keyboard and simplifications',
      body: [
        { li: ['Arrow Right / Left: slide +X / -X. W / S: slide +Y / -Y. Arrow Down / Up: slide +Z / -Z.', 'I / K: turn about X plus / minus. L / J: about Y. O / U: about Z.', 'Q / E: look round. R / F: tilt. Mouse wheel: zoom. Tab: next piece.', 'Z or Backspace: undo. H: Think, then H again to do it. P or Escape: pause.'] },
        { p: 'Simplifications: real iron puzzles can be twisted and sprung by any angle. Here pieces are rigid, live on a lattice and turn in quarters, so that every puzzle can be proven solvable and every hint is exact. Real wire has a little give that you will not find here.' },
      ],
    },
  ],
};

export const DOCS = { about: ABOUT, howto: HOWTO, rules: RULES };
