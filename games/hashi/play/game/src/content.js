// Text for the About, How to Play and Rules screens. Every rule here is checked against hashi.js / play.js / game.js
// (see design/GDD.md "Rules reference"). Blocks: { h } heading, { p } paragraph, { li: [...] } bullets.
export const GRADE_INFO = [
  null,
  { name: 'Easy', tag: 'Counting only', text: 'Small archipelagos. Every step is Full House: an island whose open lanes exactly match what it needs.' },
  { name: 'Medium', tag: 'Must Reach', text: 'Adds Must Reach: a lane that has to carry a bridge because the others cannot supply enough.' },
  { name: 'Hard', tag: 'No Cut-Off', text: 'Bigger seas. Adds No Cut-Off: a bridge that would wall a group off from the rest.' },
  { name: 'Expert', tag: 'What If', text: 'Needs What If at least once: assume a lane, follow the simple rules and watch them break.' },
  { name: 'Master', tag: 'The deep end', text: 'The largest seas. Needs What If three or more times. No guessing.' },
];

export const ABOUT = {
  title: 'About',
  pages: [
    {
      title: 'Hashi Bridges',
      fig: 'goal',
      body: [
        { p: 'Join the numbered islands with plank bridges. Each number says how many bridges touch that island, bridges run straight, a pair of islands can have one or two bridges between them, and in the end every island is reachable from every other.' },
        { p: 'Hashi, from the Japanese for bridge, is a logic puzzle that grew up in Japanese puzzle magazines and is now played all over the world. This version is built for calm, focused play: a garden pond seen from above, big readable numbers, no ads and no pressure.' },
        { li: ['Every puzzle is generated with exactly one solution and graded by the techniques a person needs to solve it.', 'A new Daily Puzzle every day, the same for everyone.', 'Hints that name the technique and show why it works, and Watch and Learn, where the game solves a puzzle step by step and explains each move.', 'Undo and redo, three ways of checking your work, four looks, a left-hand layout and text you can enlarge to 300%.'] },
      ],
    },
    {
      title: 'Credits and the free preview',
      body: [
        { p: 'You can play for a free preview first. Unlocking the full game is a single one-time purchase; there are no ads and no subscriptions.' },
        { p: 'Numerals and interface text are set in Fredoka, used under the SIL Open Font License 1.1. All sounds are synthesized on your device.' },
        { p: 'The 3D garden, islands, bridges and koi are drawn with three.js (MIT licence, the three.js authors); every model, texture and light is built in code for this game.' },
        { p: 'Hashi Bridges is part of Arcforge, a collection of world heritage games.' },
      ],
    },
  ],
};

export const HOWTO = {
  title: 'How to Play',
  pages: [
    {
      title: 'Choose a puzzle',
      fig: 'goal',
      body: [
        { p: 'Tap New Game and pick a grade, from Easy to Master. Tap Daily Puzzle for today\'s puzzle, the same for everyone, with a streak to keep.' },
        { p: 'A puzzle you leave is saved. Tap Continue on the menu to pick it up where you stopped.' },
      ],
    },
    {
      title: 'Build bridges',
      fig: 'controls',
      body: [
        { p: 'Tap an island, then tap a neighbouring island in line with it. A bridge appears. Tap the same neighbour again for a double bridge, and once more to take the bridges away. You can also drag from one island to another, or tap a bridge to change it.' },
        { li: ['An island turns green and glows when it has exactly its number.', 'A bridge can never cross another bridge or pass over an island.', 'Clear removes every bridge on the selected island. Undo and Redo walk through your moves.', 'The numbers setting can show how many bridges each island still needs instead.'] },
        { p: 'On a keyboard: arrow keys move between islands, Shift with an arrow builds a bridge in that direction, Backspace clears the island, U undoes, Y redoes, H asks for a hint and P pauses.' },
      ],
    },
    {
      title: 'Hints that teach',
      fig: 'tech:forced',
      body: [
        { p: 'Tap the bulb. The game finds the simplest logical step and first shows you where to look, without giving the answer. Tap Explain to see the full reasoning with the islands and lanes marked on the map, then Apply to let it make the move.' },
        { p: 'If a bridge you built is wrong, the hint points at it instead.' },
      ],
    },
    {
      title: 'Watch and Learn',
      fig: 'tech:must',
      body: [
        { p: 'Watch and Learn solves a whole puzzle for you, one explained step at a time. It thinks, shows the islands, explains the technique, then builds the bridges. Simple steps go quickly; harder techniques get more time.' },
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
      title: 'The islands and the goal',
      fig: 'goal',
      body: [
        { p: 'The map is a lattice of points. Some points hold an island with a number from 1 to 8. The rest is open water.' },
        { p: 'You win when every island has exactly as many bridges as its number and all the islands are joined into one connected group.' },
      ],
    },
    {
      title: 'The four rules',
      fig: 'goal',
      body: [
        { li: ['Bridges run in straight lines, horizontally or vertically, between two islands. A bridge never turns and never passes over another island.', 'Two islands can be joined by one bridge or two (a double bridge), never more.', 'Bridges cannot cross each other.', 'Every island ends with exactly its number of bridges, and the finished bridges connect all the islands into one group.'] },
        { p: 'Two islands can be joined only when they are neighbours in a row or column with no island between them. These possible links are called lanes.' },
      ],
    },
    {
      title: 'Bridges cannot cross',
      fig: 'cross',
      body: [
        { p: 'Once a bridge is built, every lane that would cross it is blocked. If you try to build across a bridge, the game flashes the bridge in the way and refuses.' },
        { p: 'This is one of the main ways to solve a puzzle: a bridge that is certain also rules out every lane that crosses it.' },
      ],
    },
    {
      title: 'Everything connected',
      fig: 'connect',
      body: [
        { p: 'A solution is one connected archipelago. Two groups that each hold all the bridges they need, with no way to link them, are a mistake even if every number is right.' },
        { p: 'So the game never accepts a finished map that has an island group cut off, and its solver uses the same fact to rule bridges out (see No Cut-Off).' },
      ],
    },
    {
      title: 'Controls',
      fig: 'controls',
      body: [
        { li: ['Tap an island to select it. Tap a neighbour in line with it to build a bridge: single, then double, then none.', 'Drag from one island to another for the same effect. Tap a bridge to cycle it.', 'Tap the selected island again to let go of it.', 'Clear removes every bridge on the selected island. Undo and Redo cover every move.', 'Pause hides the map and stops the clock. Your puzzle is saved when you leave.', 'Settings can show how many bridges each island still needs instead of its number.'] },
      ],
    },
    {
      title: 'Mistakes and checking',
      fig: 'goal',
      body: [
        { p: 'Settings has three ways of checking. Off marks nothing while you play. Conflicts turns an island and its bridges red when it has more bridges than its number; it never reveals the answer. Check also turns a bridge red as soon as it is more than the solution has, and shows a mistake counter.' },
        { p: 'Every bridge you add beyond what the solution has counts as a mistake in all three modes, whether or not it is shown. Mistakes only affect the stars on the result screen; they never end the puzzle.' },
      ],
    },
    {
      title: 'Grades and stars',
      body: [
        { p: 'A puzzle\'s grade is the hardest technique that its simplest solution path needs. The solver always takes the simplest available step first.' },
        { li: ['Easy: Full House only.', 'Medium: adds Must Reach.', 'Hard: adds No Cut-Off.', 'Expert: needs What If at least once.', 'Master: needs What If three or more times.'] },
        { p: 'Stars: you start with three. Using more than three hints or making more than three mistakes costs one; finishing slower than 1.6 times the par time (2, 4, 7, 11 and 15 minutes from Easy to Master) costs one; more than eight hints or mistakes costs another. You always keep at least one.' },
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
      fig: 'tech:forced',
      body: [
        { p: 'A hint is the simplest logical step available from the position on the map. It has two stages: where to look, then the full reasoning. Apply either builds the bridges the technique proves, or marks a lane the technique proves cannot carry any more (a small cross). Those marks are remembered, so the next hint builds on them.' },
        { p: 'If any bridge you built is more than the solution has, the hint shows that bridge first.' },
        { p: 'Watch and Learn plays a whole puzzle with the same solver: think, reveal, act. Counting steps are quick; other techniques use your think time (2, 5, 8 or 10 seconds). Pause freezes it completely.' },
      ],
    },
    T('Full House', 'forced', [
      { p: 'An island still needs some bridges, and its open lanes can carry exactly that many. Every lane must therefore be filled to its limit: two bridges where two can fit, one where only one can.' },
      { p: 'A lane is full when it has two bridges, when its other island has no bridges left to give, or when a crossing bridge blocks it.' },
    ]),
    T('Must Reach', 'must', [
      { p: 'An island needs more bridges than its other lanes can carry. The lane in question must then carry the difference, at the very least.' },
      { p: 'Example: a 3 with two neighbours can take at most two bridges to each, so it needs at least one to each.' },
    ]),
    T('No Cut-Off', 'noloop', [
      { p: 'A bridge between two islands would use up all the bridges that their group has left, but islands elsewhere are still unconnected. The group would be sealed off, so that bridge (or the second bridge of a double) is impossible.' },
      { p: 'The classic case: two neighbouring 1s cannot be joined to each other, and two neighbouring 2s cannot be joined by a double bridge, unless they are the whole puzzle.' },
    ]),
    T('What If', 'whatif', [
      { p: 'Assume something about one lane: that it stays empty, or that it gets another bridge. Then follow only Full House, Must Reach and No Cut-Off. If that leads to an island that cannot reach its number, an island with too many bridges, or a sealed-off group, the assumption is false and the opposite must be true.' },
      { p: 'The marked lane is the one being tested. The explanation names the island where the experiment breaks.' },
    ]),
  ],
};
export const DOCS = { about: ABOUT, howto: HOWTO, rules: RULES };
