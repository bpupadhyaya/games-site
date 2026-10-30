// Text for the About, How to Play and Rules screens. Every rule here is checked against tatami.js / play.js / game.js
// (see design/GDD.md "Rules reference"). Blocks: { h } heading, { p } paragraph, { li: [...] } bullets.
export const GRADE_INFO = [
  null,
  { name: 'Cottage', tag: 'Small rooms, many mats given', text: 'A snug room with most of the mats already down. Learn the corner rule.' },
  { name: 'Parlour', tag: 'Medium rooms', text: 'A bigger floor and fewer given mats. Corners start to bite.' },
  { name: 'Hall', tag: 'Long halls and L-shapes', text: 'Wings and alcoves. Think two mats ahead.' },
  { name: 'Manor', tag: 'Large rooms, few clues', text: 'Big floors with only a handful of mats to start from.' },
  { name: 'Palace', tag: 'The full floor', text: 'The largest rooms and the fewest given mats. Look ahead, every time.' },
];

export const ABOUT = {
  title: 'About',
  pages: [
    {
      title: 'Tatami Room Tiling Puzzle',
      fig: 'room',
      body: [
        { p: 'Cover the whole floor of a room with the mats you are given, so that no point of the floor is touched by the corners of four different mats. Everything else is logic.' },
        { p: 'Tatami are the woven rush-grass mats that cover the floors of traditional Japanese rooms. A room there is still described by how many mats it takes, a six-mat room or an eight-mat room, and an old layout custom says that four mats should not meet at one point. This puzzle takes that custom as its single rule.' },
        { li: ['Every puzzle has exactly one solution for the mats supplied.', 'Five grades from Cottage to Palace, and a new Daily Puzzle every day.', 'Four seasons for the room, from spring blossom to winter snow.', 'Hints that show where to look and then why, and Watch and Learn, where the game solves a room step by step and explains each mat.', 'Portrait and landscape, phone or tablet.'] },
      ],
    },
    {
      title: 'Credits and ads',
      body: [
        { p: 'Free to play with short ads; go ad-free once.' },
        { p: 'Interface text is set in Fredoka, used under the SIL Open Font License 1.1. All pictures are drawn in the game and all sounds are synthesized on your device.' },
        { p: 'Tatami Room Tiling Puzzle is part of Arcforge, a collection of world heritage games. The mats, the room, its furnishings and the hands that lay the mats are modelled and drawn in the game, and the 3D view is rendered with three.js (MIT licence). The full licence texts follow on the next pages.' },
      ],
    },
  ],
};

export const HOWTO = {
  title: 'How to Play',
  pages: [
    {
      title: 'The goal',
      fig: 'room',
      body: [
        { p: 'Every square of the room must be covered. You are given a fixed set of mats: full mats that cover two squares and half mats that cover one. Use every one of them.' },
        { p: 'The only rule: no point of the floor may touch the corners of four different mats. Those points glow red so you can see them at once.' },
      ],
    },
    {
      title: 'Placing mats',
      fig: 'tray',
      body: [
        { p: 'Pick Full mat or Half mat in the tray, then tap an empty square. A full mat goes down in the direction the tray shows; tap Turn to switch between lying and standing.' },
        { li: ['Drag from one square to its neighbour to place a full mat exactly there.', 'Tap a mat you placed to pick it up again. Mats with a stitched diamond came with the puzzle and stay put.', 'Undo and Redo walk through your moves.', 'The numbers on the tiles are how many of each mat you still have.'] },
        { p: 'On a keyboard: 1 and 2 choose the mat, T turns, U undoes, Y redoes, H asks for a hint and P pauses.' },
      ],
    },
    {
      title: 'Hints that teach',
      fig: 'corner',
      body: [
        { p: 'Tap the lamp. The game finds the most forced square and first shows where to look, without the answer. Tap Explain to read why each other mat fails, with the red points marked on the floor, then Apply to let it place the mat.' },
        { p: 'If a mat you placed is not part of the solution, the hint points at it instead and Fix it picks it up.' },
      ],
    },
    {
      title: 'Watch and Learn',
      body: [
        { p: 'From the menu, Watch and Learn solves a whole room by itself and explains every mat. Use the minus and plus buttons to set how long it thinks before each step, and Pause to freeze it exactly where it is.' },
        { p: 'Watching is always free.' },
      ],
    },
  ],
};

export const RULES = {
  title: 'Rules',
  pages: [
    {
      title: 'The room',
      fig: 'room',
      body: [
        { p: 'A room is a connected group of grid squares. It can be a plain rectangle or an L, a T or a room with alcoves. The squares outside the outline are walls and cannot be covered.' },
        { p: 'Every square inside the outline has a name: a letter for its row from the top and a number for its column from the left, so the top-left square is A1. Hints use these names.' },
      ],
    },
    {
      title: 'The mats',
      fig: 'mats',
      body: [
        { li: ['A full mat covers two squares that share an edge. It can lie across (side by side) or stand up and down.', 'A half mat covers exactly one square.', 'You have a fixed supply of each, shown in the tray. The supply always adds up to exactly the area of the room, so a finished room uses every mat.', 'A mat must lie entirely inside the room and on squares that are still empty. Mats never overlap.'] },
        { p: 'Given mats are marked with a stitched diamond. They are part of the puzzle: you cannot pick them up, and they count against the supply.' },
      ],
    },
    {
      title: 'The corner rule',
      fig: 'corner',
      body: [
        { p: 'Look at the point where four squares meet. If those four squares are covered by four different mats, the point breaks the rule.' },
        { li: ['Two mats side by side meeting two others in a plain grid make such a point. Brick-style staggering avoids it.', 'A point where three mats meet is fine, and so is a point where only two meet.', 'Points on a wall or in a corner of the room have fewer than four squares around them, so they are never a problem.', 'It does not matter whether the mats are full or half: any four different mats count.'] },
        { p: 'A finished room has no such point anywhere.' },
      ],
    },
    {
      title: 'Placing and checking',
      fig: 'tray',
      body: [
        { li: ['Tap an empty square with Full mat chosen: the mat goes down in the chosen direction. If it does not fit that way the game tries the square beside it, then the other direction, and prefers a position that keeps the corner rule.', 'Tap an empty square with Half mat chosen: a half mat goes down on it.', 'Drag across two empty neighbouring squares: a full mat goes exactly there, whatever the chosen direction.', 'Tap a mat you placed: it is picked up and goes back to the supply.'] },
        { p: 'In Settings, Corner warning can be Show (the default: red points appear and your mistakes count), Block (a mat that would break the rule is refused) or Off (no red points until the room is full).' },
      ],
    },
    {
      title: 'Solving, score and hints',
      body: [
        { p: 'The room is solved when every square is covered and no point has four mats meeting. Every puzzle in the game has exactly one way to do that for the supply it gives, so a mat that is not part of that way will eventually cause trouble.' },
        { li: ['Stars: you start with three. Using any hint costs one star, more than three slips costs one, and more than three hints or more than eight slips costs one more. There is always at least one. A slip is a mat that makes a red point when you place it.', 'The timer pauses while you pause. Best times are kept for each grade.', 'Hint techniques: Only one fit (every other mat is ruled out by a wall, a mat, the supply or the corner rule) and Look ahead (more than one mat seems to fit, but all but one would strand a square or make the room impossible to finish).', 'The Daily Puzzle is the same for everyone each day, with a streak.'] },
      ],
    },
    {
      title: 'Simplifications',
      body: [
        { p: 'Real tatami layouts have more customs than this puzzle uses: the mat proportions, the placement of half mats and the way rooms are laid out vary with the place and the period. Here the half mat is a square of one grid unit and the only rule kept is that four mats never meet at a point.' },
        { p: 'Rooms are drawn on a square grid for clarity, and the seasons are only a change of colours and falling petals, leaves, fireflies or snow.' },
      ],
    },
  ],
};
export const DOCS = { about: ABOUT, howto: HOWTO, rules: RULES };

// The 3D layer's licence text (vendor3d/LICENSES.md, public) is appended to the About pages once it is fetched.
export function addLicences(text) {
  const paras = String(text).split(/\n\s*\n/).map((x) => x.replace(/^#+\s*/gm, '').replace(/\s*\n\s*/g, ' ').trim()).filter((x) => x && !/fetch\(|keep it as is|LICENSES\.md/.test(x));
  if (!paras.length || ABOUT.pages.some((p) => p.licences)) return;
  for (let i = 0; i < paras.length; i += 5) ABOUT.pages.push({ title: i === 0 ? '3D credits and licences' : '3D credits and licences (continued)', licences: true, body: paras.slice(i, i + 5).map((p) => ({ p })) });
}
