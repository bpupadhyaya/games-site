// Text and diagrams: Rules, How to Play, About. Every rule statement is cross-checked against rules.js (the single source of truth).
// Items: { k: 'h' | 'p' | 'd' | 'dice', t / spec }. Diagram specs are drawn by art.miniBoard with the game's own pieces.
// Diagram coordinates are board rows and columns: row 2 is Red's own row (bottom), row 1 the shared middle row, row 0 Blue's own row (top).
const H = (t) => ({ k: 'h', t });
const P = (t) => ({ k: 'p', t });
const D = (spec) => ({ k: 'd', spec });
const DICE = { k: 'dice' };

export const RULES = [
  { title: 'The board and the pieces', items: [
    P('Daldøs is played on a boat-shaped board of three rows with eight points each, 24 points in all. The bottom row belongs to Red, the top row to Blue, and the middle row is shared by both.'),
    D({ pieces: [[0, 2, 0], [1, 0, 7]], marks: [[2, 7, 'ring'], [0, 0, 'ring']] }),
    P('Each side plays flat wooden spatulas. Everything starts in the harbour, off the board. You choose 4, 6 or 8 spatulas a side in Settings. 4 is a quick game and the default; 8 is the full game. A side with every spatula home wins.'),
    P('The gold ring at the far end of each own row marks the point where a spatula turns over.'),
  ] },
  { title: 'The stick', items: [
    P('You throw one four-sided stick. It shows 1, 2, 3 or 4 notches, each with the same chance.'),
    DICE,
    P('The throw moves one spatula, by exactly that many points. You must make a move if one exists. When the throw cannot be used, the turn passes.'),
    P('A throw of 4 earns another throw straight away, also after a capture.'),
  ] },
  { title: 'The road', items: [
    P('Every spatula walks the same road of sixteen points. It goes out along its own row, turns over at the far end and comes back along the shared middle row.'),
    D({ pieces: [[0, 2, 1]], marks: [[2, 2, 'dot'], [2, 3, 'dot'], [2, 4, 'dot'], [2, 5, 'dot']], arrows: [[2, 1, 2, 5]] }),
    P('Red goes out along the bottom row from left to right, then back along the middle row from right to left. Blue goes out along the top row from right to left, then back along the middle row from left to right. That is why the two sides meet head on in the middle.'),
    P('A throw takes a spatula forward by its number. It may pass over other spatulas freely: only the point where it stops matters.'),
  ] },
  { title: 'Launching', items: [
    P('A spatula in the harbour is launched by any throw: it lands on that point of your own row, counting from the end where your row begins (a 3 lands on the third point).'),
    D({ pieces: [], marks: [[2, 2, 'dot']], arrows: [] }),
    P('Your own row can only be walked by you, so nothing there can be captured.'),
  ] },
  { title: 'Turning over', items: [
    P('When a spatula leaves the eighth point of its own row it turns over: its face shows a gold ring and a star. It then enters the middle row at the end you just walked to.'),
    D({ pieces: [[0, 2, 6], [0, 1, 7, 1]], marks: [[1, 7, 'ring']], arrows: [[2, 6, 1, 7]] }),
    P('A turned spatula is on its way home. If it is captured it goes back to the harbour face up, and must walk the whole road again.'),
  ] },
  { title: 'Capturing', items: [
    P('In the middle row the two sides use the same points. When your spatula stops exactly on a point where a single rival spatula stands, the rival is captured and sent back to its harbour.'),
    D({ pieces: [[0, 1, 5, 1], [1, 1, 3, 1]], marks: [[1, 3, 'cap']], arrows: [[1, 5, 1, 3]] }),
    P('Passing over a rival does nothing. A spatula in your own row is never in danger.'),
  ] },
  { title: 'Pairs', items: [
    P('Two spatulas of the same side on one point make a pair. A pair cannot be captured, and a rival cannot stop there. You cannot put a third spatula on a point.'),
    D({ pieces: [[1, 1, 3, 1], [1, 1, 3, 1], [0, 1, 6, 1]], marks: [[1, 3, 'ring']] }),
    P('Pairs are the main way to hold a point in the middle while others run past, and to block a rival that would otherwise land.'),
  ] },
  { title: 'Going home', items: [
    P('After the sixteenth point a spatula is home. You do not need an exact throw: any throw that would take it past the sixteenth point brings it home.'),
    D({ pieces: [[0, 1, 1, 1]], marks: [], arrows: [[1, 1, 1, 0]] }),
    P('The first side to bring every spatula home wins.'),
  ] },
  { title: 'About these rules', items: [
    P('Daldøs is an old game, known from a handful of wooden boards in museums in Denmark and Norway, and from notes of how it was played. Full, agreed rules were never written down in one place, so every modern version is a reconstruction.'),
    P('This version follows what is known: a board of three rows of eight points, flat spatula-shaped pieces that are turned over, a four-sided stick thrown for one number from 1 to 4, and capture by landing. The details of the road (out along your own row, home along the shared row), pairs, the extra throw for a 4 and the choice of 4, 6 or 8 spatulas are our reading, chosen to make the game clear and fair on a phone.'),
    P('Where traditional play differs from these rules, the traditional play is right and this page is simplified.'),
  ] },
];

export const HOWTO = [
  { title: 'A turn in four steps', items: [
    P('1. Tap the stick tray to throw the stick. It shows 1, 2, 3 or 4 notches.'),
    DICE,
    P('2. Spatulas that can use the throw glow. Tap one, and a ring shows where it would land. A red ring means it captures a rival.'),
    P('3. Tap the glowing point, or tap the spatula again, to make the move. A waiting spatula is launched by tapping the harbour on your plate, or the point where it would land.'),
    P('4. A 4 earns a second throw. Otherwise the computer, or your friend, throws next.'),
  ] },
  { title: 'The idea of the game', items: [
    P('Everyone runs the same road: out along their own row, then home along the shared middle row. The middle row is where the fight is.'),
    D({ pieces: [[0, 2, 3], [0, 1, 2, 1], [1, 1, 4, 1], [1, 0, 5]], marks: [[1, 2, 'ring']] }),
    P('Keep a pair together to hold a point and block a rival. A single spatula in the middle row is in danger when a rival is within four points behind it: look for the red marks.'),
    P('There is no way to move backwards and no waiting: you must use every throw you can. The choice is which spatula runs, which one hunts and which one stays hidden in its own row.'),
  ] },
  { title: 'Help while you learn', items: [
    P('Hint shows a good move for this throw and says why. You have three hints a game.'),
    P('Auto Play lets you watch the computer play both sides. Each move is first thought about and then shown, with a Pause button and a Think setting for how long you get to guess first.'),
    P('Danger marks, in Settings, put a small red mark on your spatulas a rival can reach with one throw.'),
    P('Rules has the full rule book, with text size up to 300 percent. Your game is saved when you leave it.'),
  ] },
];

export const ABOUT = [
  { title: 'Daldøs', items: [
    P('Daldøs is a traditional board game of Norway and Denmark, played on a boat-shaped board with flat wooden spatulas that are turned over as they travel, and a long four-sided stick that is thrown for a number.'),
    P('The game is known from old wooden boards kept in museums, from Jæren in western Norway to Thisted and Mors in Jutland, some dating from about 1800, and from the people who still play and make them. It belongs to a family of Scandinavian running-fight dice games.'),
  ] },
  { title: 'This version', items: [
    P('This is an independent, simplified adaptation made with respect for the Norwegian and Danish tradition. The Rules page says what was chosen and what was simplified. It is not endorsed by any museum or association.'),
    P('Play the computer at four levels, play a friend on one phone, watch the computer play itself in Auto Play, and open boards and spatula styles with wins. Large text up to 300 percent and a reduced motion option are in Settings.'),
  ] },
  { title: 'Credits', items: [
    P('Daldøs: a traditional game of Norway and Denmark. The board, spatulas, stick and all art are drawn in the game itself. Titles in Cormorant Garamond, used under the SIL Open Font License.'),
    P('Part of Arcforge, a collection of games from heritage traditions around the world.'),
  ] },
];
