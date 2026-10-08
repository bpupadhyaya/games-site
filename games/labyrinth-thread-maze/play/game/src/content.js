// Text for the About, How to Play and Rules screens. Every rule here is checked against maze.js / play.js / game.js
// (see design/GDD.md "Rules reference"). Blocks: { h } heading, { p } paragraph, { li: [...] } bullets.
export const TIPS = [
  'Look at the whole maze before you move: trace routes with your eyes.',
  'A corridor that bends away from the heart can still be the way.',
  'Dead ends are cheap in a small maze and costly in a big one.',
  'The glow of the rosette is visible even in the dark.',
];

export const ABOUT = {
  title: 'About',
  pages: [
    {
      title: 'Labyrinth Thread Maze',
      fig: 'hero',
      body: [
        { p: 'Step into an ancient stone labyrinth with a spool of red thread and a small clay lamp, and find your way to the glowing rosette at its heart. The stone halls of Crete gave the world its first famous labyrinth. This one is calm: there is no monster and no clock to beat, only choices at the forks.' },
        { li: ['Every maze is generated fresh, in six grades from a small seven-by-seven court to a thirty-by-thirty great labyrinth.', 'The thread lays out behind the lamp and winds back when you retrace. Walk back along it to undo a wrong turn.', 'In the deep grades the labyrinth is dark: torchlight reaches down the corridors, and the map remembers where you have been.', 'A Hint Thread that glows the way, and Watch and Learn, where the game finds its way and explains each fork.', 'A new Daily Maze every day, the same for everyone.', 'Portrait and landscape on phone and tablet, with three looks.'] },
      ],
    },
    {
      title: 'Credits and the free preview',
      body: [
        { p: 'You can play for a free preview first. Unlocking the full game is a single one-time purchase; there are no ads and no subscriptions.' },
        { p: 'Titles are set in Cinzel and the interface in Fredoka, both used under the SIL Open Font License 1.1. All sounds are synthesized on your device.' },
        { p: 'Labyrinth Thread Maze is part of Arcforge, a collection of world heritage games.' },
      ],
    },
  ],
};

export const HOWTO = {
  title: 'How to Play',
  pages: [
    {
      title: 'Choose a maze',
      fig: 'grades',
      body: [
        { p: 'Tap New Game and pick a grade, from the small Courtyard to the Great Labyrinth. Tap Daily Maze for today\'s maze, the same for everyone, with a streak to keep.' },
        { p: 'A maze you leave is saved. Tap Continue on the menu to pick it up where you stopped.' },
      ],
    },
    {
      title: 'Guide the lamp',
      fig: 'thread',
      body: [
        { p: 'Press and drag. The lamp follows your finger through the corridors and the red thread lays out behind it. A finger that crosses a wall is simply ignored until it comes back to a corridor the lamp can reach. You can also tap a corridor a few cells away.' },
        { p: 'On a keyboard: arrow keys or W A S D step, H asks for a hint, M shows the map, B goes back to the last fork and P pauses.' },
      ],
    },
    {
      title: 'Wind the thread back',
      fig: 'retrace',
      body: [
        { p: 'Walk back along your own thread to take it back. When you hit a dead end, drag back the way you came; the thread winds up as you go.' },
        { li: ['Last fork walks the lamp back to the most recent fork for you.', 'In the lit grades the third button rewinds the whole thread to the doorway. In the dark grades it opens the map.'] },
      ],
    },
    {
      title: 'Hints that guide',
      fig: 'hint',
      body: [
        { p: 'Tap the bulb. First the game tells you where the next fork is and how many ways it has, without giving the answer. Tap Show the way and a gold thread glows the next twelve steps.' },
        { p: 'If the lamp is in a passage that does not lead on, the hint tells you to turn back.' },
      ],
    },
    {
      title: 'Watch and Learn',
      fig: 'fork',
      body: [
        { p: 'Watch and Learn walks a whole maze for you, one fork at a time. At each fork it thinks, lights the ways on, tells you which are dead ends and which lead to the heart, and then walks on to the next fork.' },
        { p: 'Use Pause to stop everything exactly where it is and Resume to carry on. The minus and plus buttons change how long it thinks before each reveal.' },
      ],
    },
    {
      title: 'Torchlight and the map',
      fig: 'fog',
      body: [
        { p: 'In the two deepest grades the labyrinth is dark. The lamp lights the corridors it can reach and the places you have been stay dimly drawn. The rosette at the heart glows through the dark so you always know the direction.' },
        { p: 'Tap Map to see the whole maze as you have uncovered it, and tap again to return to the lamp.' },
      ],
    },
  ],
};

export const RULES = {
  title: 'Rules',
  pages: [
    {
      title: 'The labyrinth and the goal',
      fig: 'maze',
      body: [
        { p: 'A maze is a square grid of cells joined by open passages; every other side of every cell is a stone wall. You start at the doorway in the outer wall, at the outer cell that is farthest from the heart, and you win by bringing the lamp to the rosette in the centre cell.' },
        { p: 'Every cell can be reached from every other cell. A maze can always be finished; there is no way to lose.' },
      ],
    },
    {
      title: 'Forks and dead ends',
      fig: 'fork',
      body: [
        { p: 'A cell with three or four open sides is a fork. A cell with only one open side, other than the doorway, is a dead end. The lamp chimes at a fork and sounds a low note at a dead end.' },
        { p: 'Maze generation carves long winding corridors, so dead ends are common. In the first two grades the maze has exactly one route between any two cells.' },
      ],
    },
    {
      title: 'Moving the lamp',
      fig: 'thread',
      body: [
        { p: 'The lamp only ever moves from a cell to a neighbouring cell through an open passage; it never crosses a wall. While your finger is down, the lamp is sent toward the cell under it by the shortest way, but only when that cell is at most five cells beyond the last cell the lamp is walking to. If the finger is farther away, or on the other side of a wall, the lamp stays where it is until the finger returns.' },
        { p: 'Keyboard arrows or W A S D queue one step at a time, up to three cells ahead. Moving the finger back onto a cell the lamp is already walking to shortens its queue, so the lamp turns round at once.' },
      ],
    },
    {
      title: 'The thread',
      fig: 'retrace',
      body: [
        { p: 'The red thread is the path from the doorway to the lamp: the list of cells you have walked through, with detours removed. Stepping onto a new cell adds it. Stepping back onto the cell you came from removes the last cell and winds the thread in.' },
        { p: 'If the lamp steps onto a cell that is already on the thread, the thread is cut back to that cell, so a loop of your own thread disappears. The thread never crosses itself.' },
      ],
    },
    {
      title: 'Loops and several routes',
      fig: 'loop',
      body: [
        { p: 'From the Passage grade up, some walls are opened after the maze is carved so that loops appear (3, 8, 7 and 6 percent of the cells in Passage, Halls, Deep Halls and Great Labyrinth). With loops there can be more than one route to the heart.' },
        { p: 'Steps and stars are measured against the shortest route, which hints and Watch and Learn always follow.' },
      ],
    },
    {
      title: 'Torchlight and fog',
      fig: 'fog',
      body: [
        { p: 'Deep Halls and the Great Labyrinth are dark. Light flows from the lamp down the open corridors for 5 cells in Deep Halls and 4 cells in the Great Labyrinth, not through walls. Every cell the light has reached is remembered and stays dimly drawn; cells never reached are black.' },
        { p: 'In these two grades the view follows the lamp, showing about 15 and 13 cells across. The Map button shows the whole maze, with only the uncovered parts drawn. The rosette glows through the dark.' },
      ],
    },
    {
      title: 'Last fork and rewind',
      fig: 'retrace',
      body: [
        { p: 'Last fork sends the lamp back along your thread to the most recent fork you passed. If there is no fork behind you, it takes the lamp back to the doorway; at the doorway nothing happens. In the lit grades the third button, Rewind, sends the lamp all the way back to the doorway. Both wind the thread in as they go and do not count as steps.' },
        { p: 'Restart maze in the Pause menu starts the same maze again from the doorway, with steps, hints and time reset.' },
      ],
    },
    {
      title: 'Hints',
      fig: 'hint',
      body: [
        { p: 'A hint has two stages. Look says where the next fork is on the shortest way from the lamp and how many ways it has, or tells you to turn back when you are in a passage that does not lead on. It costs nothing. Show the way glows the shortest route for the next 12 cells for 12 seconds and counts as one hint.' },
        { p: 'Three or more hints cost one star.' },
      ],
    },
    {
      title: 'Watch and Learn',
      fig: 'fork',
      body: [
        { p: 'Watch and Learn plays a Courtyard, Gallery, Passage or Halls maze (your last grade, at most Halls) along the shortest route. At the doorway and at every fork on that route it THINKS (2, 5, 8 or 10 seconds, your choice), then REVEALS for two seconds or more: each way on is named as the shortest way, a longer way round, a loop back to the fork, or a dead end with its length. Then the lamp walks to the next fork.' },
        { p: 'Easy forks, where every other way is a dead end of one or two cells, are thought about for less time. Pause freezes the whole loop, including the lamp, and Resume carries on from the same spot. Watch and Learn does not use up your free preview and is not saved.' },
      ],
    },
    {
      title: 'Grades and sizes',
      fig: 'grades',
      body: [
        { li: ['Courtyard: 7 by 7, one route, fully lit.', 'Gallery: 10 by 10, one route, fully lit.', 'Passage: 14 by 14, a few loops, fully lit.', 'Halls: 18 by 18, many loops, fully lit.', 'Deep Halls: 24 by 24, loops, torchlight 5 cells, following view.', 'Great Labyrinth: 30 by 30, loops, torchlight 4 cells, following view.'] },
      ],
    },
    {
      title: 'Steps and stars',
      body: [
        { p: 'Steps count every cell the lamp walks onto by your own steering, including wrong turns and retracing (but not Last fork or Rewind). The shortest route is the par.' },
        { p: 'You start with three stars. In the lit grades, more than 2.2 times the shortest route costs one star and more than 4 times costs two. In the dark grades the limits are 3.5 and 6 times. Three or more hints cost one more star. You always keep at least one star.' },
        { p: 'Time is shown and your best time per grade is kept, but time does not change the stars.' },
      ],
    },
    {
      title: 'The Daily Maze',
      body: [
        { p: 'Each day has one maze, identical for every player. Its grade follows the weekday: Monday Courtyard, Tuesday Gallery, Wednesday and Thursday Passage, Friday Halls, Saturday Great Labyrinth, Sunday Deep Halls.' },
        { p: 'Solving it adds to your streak; the Stats page shows the last five weeks. A streak continues if you solved the previous day\'s maze.' },
      ],
    },
    {
      title: 'Leaving and ending',
      body: [
        { p: 'There is no losing and no time limit. A maze you leave is saved with its thread, your steps, hints, time and the parts you have uncovered, and Continue picks it up again. The free web demo allows three mazes.' },
        { p: 'A maze ends when the lamp reaches the rosette. The correct route then glows, and you see your stars, time and the steps you wasted.' },
      ],
    },
  ],
};
export const DOCS = { about: ABOUT, howto: HOWTO, rules: RULES };
