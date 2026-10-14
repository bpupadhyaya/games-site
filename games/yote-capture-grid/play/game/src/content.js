// Text and diagrams: the Rules reference, How to Play, About, and the lessons. Every rule statement here is cross-checked against rules.js
// (the single source of truth for legality). Items: { k: 'h' | 'p' | 'd', t / spec }.
// Diagram rows are 6 characters wide: B Indigo pebble, W Ivory pebble, . empty pit.
const D = (rows, extra = {}) => ({ k: 'd', spec: { rows, ...extra } });
const H = (t) => ({ k: 'h', t });
const P = (t) => ({ k: 'p', t });

export const RULES = [
  { title: 'The board and the pebbles', items: [
    P('Yote is a game of the Sahel, played in Senegal, Mali and Burkina Faso and its neighbours. The board is a grid of pits scooped in the sand: 5 rows of 6 pits, 30 in all. Each player has 12 pebbles, kept in hand at the start.'),
    D(['......', '......', '......', '......', '......'], { cell: 40 }),
    P('The board starts completely empty. Indigo plays first, Ivory second. In this app the board stands upright on a phone held in portrait (6 pits tall, 5 across) and lies down in landscape; the game is the same.'),
  ] },
  { title: 'Your turn: one of three things', items: [
    P('On your turn you do exactly one of these: drop a pebble from your hand onto an empty pit, step one of your pebbles on the board by one pit, or jump an enemy pebble. You may not pass.'),
    P('There is no opening phase and no set order: you can keep pebbles in hand for as long as you like, and mix dropping and moving freely.'),
  ] },
  { title: 'Dropping a pebble', items: [
    P('Take a pebble from your hand and put it on any empty pit of the board, wherever you like. Tap an empty pit while no pebble is selected. Dropping uses up a pebble from your hand for good: you only ever have 12 to place.'),
    D(['......', '..B...', '......', '..W...', '......'], { marks: [[0, 5, 'dot'], [4, 0, 'dot'], [2, 3, 'dot']], cell: 40 }),
  ] },
  { title: 'Stepping', items: [
    P('A pebble on the board may step one pit up, down, left or right onto an empty pit. There are no diagonal moves, and a pebble never moves two pits.'),
    D(['......', '..B...', '......'], { marks: [[0, 2, 'dot'], [1, 1, 'dot'], [1, 3, 'dot'], [2, 2, 'dot']], cell: 44 }),
    P('A pebble cannot step onto an occupied pit or over another pebble. It may step backwards as well as forwards: there is no forward or back in Yote.'),
  ] },
  { title: 'Jumping: the capture', items: [
    P('A pebble captures by jumping. If an enemy pebble stands right next to one of yours, up, down, left or right, and the pit directly behind it (in the same line) is empty, you may leap over it and land on that pit. The jumped pebble is removed.'),
    D(['.....W', '......', '..BW..', '......'], { arrows: [[2, 2, 2, 4]], cell: 44 }),
    P('A jump is a single leap, in any of the four straight directions, backwards too. There are no chains: after one jump your turn ends. Jumping is never compulsory; you can leave an open jump for later, but your opponent may use it first.'),
    P('You cannot jump if the pit behind the enemy pebble is taken or if it would be off the edge of the board. Two enemy pebbles in a row cannot be jumped.'),
    D(['......', '.BWW..', '......'], { marks: [[1, 3, 'cross']], cell: 44 }),
  ] },
  { title: 'The bonus pebble', items: [
    P('Every jump takes TWO pebbles. First the jumped pebble leaves the board. Then you also remove ANY other enemy pebble that stands on the board, one of your own choosing, anywhere. This is the bonus, and it is the heart of the game.'),
    D(['..BW..', '......', '....W.', '.W....'], { arrows: [[0, 2, 0, 4]], hl: [[2, 4, 'rgba(214,41,31,0.35)']], cell: 40 }),
    P('The app asks you to tap the pebble to remove: the choices pulse. The best choice is usually the pebble that is threatening you, or one that holds a group of enemy pebbles together.'),
    P('The bonus is always taken when there is one to take; you cannot decline it.'),
  ] },
  { title: 'When the board has no more targets', items: [
    P('Pebbles still in hand are safe from the bonus as long as the enemy has something on the board to take. If the jumped pebble was the enemy’s last one on the board, the bonus comes from the enemy’s hand instead: one pebble is removed from it, and you do not choose which, as they are all the same.'),
    P('If the enemy has nothing on the board and nothing in hand after the jump, there is no bonus: the jumped pebble was their last and you have won.'),
    P('That makes keeping a few pebbles in hand a real choice: they cannot be taken while you have others on the board, but unused pebbles also do nothing for you.'),
  ] },
  { title: 'Winning', items: [
    P('You win when your opponent has no pebbles left at all, on the board or in hand, or when it is their turn and they have no legal move (every pebble blocked and none left to drop).'),
  ] },
  { title: 'Draws and quiet games', items: [
    P('If the same position, with the same side to move, appears three times, the game is a draw. The game is also a draw after 150 moves each.'),
    P('If 40 moves each go by with no capture, the game is settled on the spot: the side with more pebbles (on the board and in hand together) wins. With equal numbers it is a draw.'),
  ] },
  { title: 'In this app', items: [
    P('Tap an empty pit to drop a pebble. Tap one of your pebbles to select it: the pits it can step to glow, and a red ring marks a jump (with a +1 for the bonus). Tap the pit to move, or drag the pebble.'),
    P('After a jump, tap the enemy pebble you want as the bonus. If there is only one choice the app takes it for you.'),
    P('Hint shows a good move and says why. Danger marks (in Settings) put a red mark on any of your pebbles that the other side could jump on its next move. Take back undoes your last move and the computer’s reply.'),
    P('Auto Play lets you watch the computer play both sides, with time to think and a pause button. Games are saved when you leave.'),
    P('Where this app simplifies: Yote is played with several local variations. Here it is the common form: 5 by 6 pits, 12 pebbles each, one jump per turn (no chains), no compulsory capture, and the bonus is always taken.'),
  ] },
];

export const HOWTO = [
  { title: 'The goal', items: [
    P('Capture all of your opponent’s pebbles. Jump over a neighbouring enemy pebble onto the empty pit behind it, then take any other enemy pebble as a bonus.'),
    D(['..BW..', '......', '.....W'], { arrows: [[0, 2, 0, 4]], cell: 40 }),
  ] },
  { title: 'Drop or move', items: [
    P('Each turn do one thing. Tap an empty pit to drop a pebble from your hand there. Or tap one of your pebbles on the board and then a glowing pit next to it to step.'),
    P('Your pebbles in hand are shown on your plate. When they are all down, you move the ones on the board.'),
  ] },
  { title: 'Jump and take a bonus', items: [
    P('A red ring marks a jump: land on the empty pit behind the enemy pebble. Then tap any other enemy pebble to remove it too. Capture is your choice, never forced.'),
  ] },
  { title: 'Think ahead', items: [
    P('Keep pebbles together so the pit behind them is never empty, or filled by a drop. Watch for pebbles an enemy could jump (danger marks in Settings) and for the pebble you would take as a bonus.'),
  ] },
  { title: 'Learn more', items: [
    P('Tap Learn on the main menu for six short hands-on lessons. Use Hint if you are stuck and Take back if you slip.'),
  ] },
];

export const ABOUT = [
  { title: 'Yote', items: [
    P('Yote (also written Yoté or Yoti) is a traditional two-player game of West Africa, played in Senegal, Mali and Burkina Faso and its neighbours. It is played on a grid of shallow pits scooped in the sand, with pebbles against sticks or seeds.'),
    P('Its charm is the second pebble: every capture lets you pick any other enemy piece off the board, so one jump can turn a game around. It is quick to learn and it plays in a few minutes, which is why it is played in courtyards and markets and on school grounds.'),
  ] },
  { title: 'What you get', items: [
    P('Five computer levels from Beginner to Master, two players on one phone, six hands-on lessons, Hint, danger marks, take back, and Auto Play (Watch & Learn).'),
    P('Three boards (laterite, dune and rose clay) and two pebble styles, earned by winning. Large text, reduced motion and sound options. No ads, and it works offline.'),
  ] },
  { title: 'Credits', items: [
    P('Board, pebbles, sounds and the computer player were made for Arcforge. Titles are set in Fredoka (SIL Open Font License 1.1).'),
    P('The 3D board and courtyard are drawn live with three.js (MIT licence) and the Arcforge board toolkit; the full licence text ships with the app.'),
    P('Arcforge: World Heritage Games.'),
  ] },
];

// Lessons. Boards are 5 rows of 6 characters (B Indigo, W Ivory). Indigo always moves. `hand`: [Indigo, Ivory] pebbles in hand.
// `goal`: { type: 'drop' | 'to', to } | { type: 'capture', n } | { type: 'bonus', at }; `target` rings a pit on the board.
const rowsOf = (cells) => { const rows = Array.from({ length: 5 }, () => '......'.split('')); for (const [r, c, ch] of cells) rows[r][c] = ch; return rows.map((x) => x.join('')); };
const at = (r, c) => r * 6 + c;
export const LESSONS = [
  { title: 'Drop a pebble', board: rowsOf([]), hand: [4, 4], goal: { type: 'drop', to: at(2, 2) }, target: at(2, 2),
    text: 'You start with pebbles in hand. Tap the ringed empty pit to drop one there.', done: 'Dropped. You can drop on any empty pit, on any turn.', hint: 'Tap the pit with the ring around it.' },
  { title: 'Step one pit', board: rowsOf([[2, 1, 'B'], [0, 4, 'W']]), hand: [0, 0], goal: { type: 'to', to: at(2, 2) }, target: at(2, 2),
    text: 'A pebble on the board steps one pit up, down, left or right. Tap your pebble, then the ringed pit.', done: 'Good. A pebble steps one pit at a time, in any of four directions.', hint: 'Tap the pebble first, then the ringed pit next to it.' },
  { title: 'The jump', board: rowsOf([[2, 1, 'B'], [2, 2, 'W']]), hand: [0, 0], goal: { type: 'capture', n: 1 },
    text: 'Jump the ivory pebble: leap over it and land on the empty pit behind it.', done: 'Captured. A pebble next to you with an empty pit behind it can be jumped.', hint: 'Tap your pebble, then the pit just beyond the ivory one.' },
  { title: 'The bonus pebble', board: rowsOf([[2, 0, 'B'], [2, 1, 'W'], [2, 4, 'B'], [2, 5, 'W'], [0, 2, 'W']]), hand: [0, 0], goal: { type: 'bonus', at: at(2, 5) },
    text: 'Jump the neighbouring ivory pebble, then take a bonus: choose the ivory pebble that is about to jump your other pebble.', done: 'Two pebbles in one move. The bonus can be any enemy pebble on the board.', hint: 'Jump from the left, then tap the ivory pebble at the right-hand edge.' },
  { title: 'Bonus from the hand', board: rowsOf([[2, 0, 'B'], [2, 1, 'W']]), hand: [0, 3], goal: { type: 'capture', n: 1 },
    text: 'Ivory has no other pebble on the board but three in hand. Jump the pebble on the board.', done: 'When the board has nothing else to take, the bonus comes out of the enemy’s hand.', hint: 'Tap your pebble, then the empty pit behind the ivory one.' },
  { title: 'Block with a drop', board: rowsOf([[2, 2, 'B'], [2, 3, 'W'], [2, 4, 'W'], [0, 5, 'B']]), hand: [3, 0], goal: { type: 'drop', to: at(2, 1) }, target: at(2, 1),
    text: 'The ivory pebble can jump your pebble because the pit behind it is empty. Drop a pebble there to fill it.', done: 'Blocked. A filled pit behind a pebble keeps it safe from a jump.', hint: 'Tap the ringed empty pit on the far side of your pebble.' },
];
