// Text for the About, How to Play and Rules screens. Every rule here is checked against mirror.js / game.js.
// Blocks: { h } heading, { p } paragraph, { li: [...] } bullets. A page may carry `fig` (a drawn example).
export const ABOUT = {
  title: 'About',
  pages: [
    {
      title: 'Lusona Sand Drawings',
      fig: 'solved',
      body: [
        { p: 'Draw one unbroken line that loops all the way round a field of dots and closes on itself. You do it by turning tiles: each tile holds a mirror, and the sand line bounces off it.' },
        { p: 'Every level is a fresh puzzle made for you, from a quiet three-by-three field to wide ones where one wrong tile splits the line in two. There is a new Daily Drawing every day and a Watch and Learn mode that plays a level and thinks aloud.' },
      ],
    },
    {
      title: 'The tradition',
      body: [
        { p: 'Lusona (plural sona) are line drawings made in the sand by the Chokwe and neighbouring peoples of Angola, the Democratic Republic of the Congo and Zambia. A drawer lays out a grid of dots and then, without lifting the finger, carries one line round them so that it closes on itself.' },
        { p: 'The drawings are made by hand, often to accompany stories, riddles and proverbs, and are remembered and taught by tradition keepers. Their craft has been studied by mathematicians as well as by those who keep the tradition alive.' },
        { p: 'This game is a respectful puzzle homage, not a record of the tradition. It borrows the dot field and the single closed line, and it does not show or explain any real drawing, story or meaning. To learn about sona, look for the Chokwe tradition keepers and museums that share it.' },
      ],
    },
    {
      title: 'Credits and ads',
      body: [
        { p: 'Free to play with short ads; go ad-free once.' },
        { p: 'Numerals and interface text are set in Fredoka, used under the SIL Open Font License 1.1. All sounds are synthesized on your device.' },
        { p: 'Lusona Sand Drawings is part of Arcforge, a collection of world heritage games.' },
      ],
    },
  ],
};

export const HOWTO = {
  title: 'How to Play',
  pages: [
    {
      title: 'Turn the tiles',
      fig: 'tile',
      body: [
        { p: 'Tap a tile to flip its mirror between the two diagonals. The sand line bends round the corners of that tile, so every flip redraws the line.' },
        { p: 'Tiles with a stone slab are set in stone and cannot be turned. They are part of the puzzle.' },
      ],
    },
    {
      title: 'Make it one line',
      fig: 'loops',
      body: [
        { p: 'At first the sand line is cut into several separate loops, each shown in its own colour. Turn tiles until only one loop is left. When the whole field is a single line, every dot is inside it and the drawing is finished.' },
        { li: ['The counter shows how many loops there are. Aim for one.', 'A flip can join two loops, split one in two, or just reshape a loop.', 'Fewer moves earn more stars.'] },
      ],
    },
    {
      title: 'Help when you want it',
      body: [
        { p: 'Think shows the tile worth turning and says why. Tap Do it to turn it, or Close to keep going alone. Undo takes back your last turn and Reset sets the field back to the start.' },
        { p: 'Watch and Learn plays a whole level for you: it thinks, shows its choice, then turns the tile. You can pause it at any time and set how long it thinks.' },
      ],
    },
  ],
};

export const RULES = {
  title: 'Rules',
  pages: [
    {
      title: 'The field',
      fig: 'tile',
      body: [
        { p: 'A level is a field of tiles, from 3 by 3 up to 8 by 8, with half a tile of sand all the way round it. Dots sit on the corners where the corner row and corner column add up to an even number, so the dots form a chessboard pattern, starting with the top-left corner.' },
        { p: 'Every tile holds exactly one mirror, laid on one of its two diagonals. There is no empty tile.' },
      ],
    },
    {
      title: 'How the line runs',
      body: [
        { p: 'The sand line crosses the middle of each tile side. Inside a tile it never goes straight on: the mirror sends it round a corner, so each tile carries two short arcs, one at each of two opposite corners.' },
        { p: 'At the outer edge, neighbouring side middles are joined by a curve that wraps round the border dot between them, so no line ever leaves the field. Because every side middle has exactly two partners, the line always closes up: it is never open and never branches.' },
        { p: 'Arcs never cross each other, so the finished line is a simple closed curve.' },
      ],
    },
    {
      title: 'Winning',
      body: [
        { p: 'You win when the whole field is one single closed line. Then every dot lies inside it. If there are two or more loops the drawing is not finished; each loop is drawn in its own colour and the counter shows how many there are.' },
        { p: 'Hidden struts: when a tile\'s mirror runs between two dots it joins them. One line round all the dots means all the dots are joined into one connected group with no ring inside it. The Struts setting shows these joins as faint ridges.' },
      ],
    },
    {
      title: 'Stones, moves and stars',
      body: [
        { li: ['Tiles with a stone slab are fixed. Tapping them does nothing.', 'Every flip is one move. Undo takes a move back, Reset sets the field to its start and clears the move count.', 'Each level has a par: the number of tiles that were turned to scramble it. Finish in par moves or fewer without Think for three stars.', 'Finish within par plus three moves for two stars. Any other finish gives one star.'] },
        { p: 'A level can sometimes be solved in a different way than the one it was made from. Any single closed line counts.' },
      ],
    },
    {
      title: 'Modes and simplifications',
      body: [
        { li: ['Levels: 30 generated levels in five stages, each unlocked by finishing the one before.', 'Daily Drawing: a new field every day, the same for everyone.', 'Watch and Learn: the game solves a level using the same Think help, with a pause button and a thinking time you choose.'] },
        { p: 'Simplifications: the real drawings are made by hand in sand, may cross themselves and are tied to stories. Here the line is always built from mirror tiles, never crosses itself, and carries no story. It is a puzzle inspired by the tradition, not a copy of it.' },
        { p: 'Text size: the A- and A+ buttons on every text screen zoom the text up to 300 percent.' },
      ],
    },
  ],
};

export const DOCS = { about: ABOUT, howto: HOWTO, rules: RULES };

// 3D licence credits (view3d): appended to the last About page once the text is fetched (the page still shows without it).
export function loadCredits() {
  if (typeof fetch !== 'function' || typeof window === 'undefined') return;
  fetch('./vendor3d/LICENSES.md').then((r) => (r.status >= 400 ? '' : r.text())).then((t) => {
    if (!t) return;
    const blocks = t.split(/\n{2,}/).map((x) => x.trim()).filter((x) => x && !x.startsWith('#') && !x.startsWith('MIT License')).slice(0, 14);
    const last = ABOUT.pages[ABOUT.pages.length - 1];
    if (!last.body.some((b) => b.h === '3D credits')) { last.body.push({ h: '3D credits' }); for (const b of blocks) last.body.push({ p: b.replace(/\s+/g, ' ') }); }
  }).catch(() => {});
}
