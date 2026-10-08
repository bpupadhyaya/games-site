// Text and diagrams: the Rules reference, How to Play, About, and the lessons. Every rule statement here is cross-checked against rules.js
// (the single source of truth for legality). Items: { k: 'h' | 'p' | 'd', t / spec }.
// Diagram rows are written as rows of two-character squares separated by spaces (see drawDiagram in art.js):
//   '..' grass  '~~' water  'TR'/'TB' red/blue trap  'DR'/'DB' red/blue den  'R1'..'R8' red animal  'B1'..'B8' blue animal  'r1' / 'b1' a rat swimming
import { startBoard, sideOf, rankOf, TERR, COLS, ROWS } from './rules.js';

const sq = (s) => s.split(' ').join('');
const D = (rows, extra = {}) => ({ k: 'd', spec: { rows: rows.map(sq), ...extra, under: extra.under ? extra.under.map(sq) : undefined } });
const H = (t) => ({ k: 'h', t });
const P = (t) => ({ k: 'p', t });
// The real start position as a diagram (built from the engine, so it can never disagree with it).
function startRows() {
  const b = startBoard(), code = ['..', '~~', 'TR', 'TB', 'DR', 'DB'], rows = [];
  for (let r = 0; r < ROWS; r++) { let s = ''; for (let c = 0; c < COLS; c++) { const v = b[r * COLS + c]; s += v ? (sideOf(v) === 1 ? 'R' : 'B') + rankOf(v) : (code[TERR[r * COLS + c]] === '~~' ? '~~' : code[TERR[r * COLS + c]]); } rows.push(s); }
  return rows;
}
// Terrain under a piece at the start: Blue's/Red's pieces all start on grass, so 'under' is not needed.

const LADDER = ['Rat', 'Cat', 'Dog', 'Wolf', 'Leopard', 'Tiger', 'Lion', 'Elephant'];

export const RULES = [
  { title: 'The board and the animals', items: [
    P('Jungle, called Dou Shou Qi ("fighting beasts chess") in China, is a game for two players on a board of 7 columns by 9 rows. In the middle are two lakes, each 2 squares wide and 3 squares long. At each end are a den and three traps.'),
    P('Red sits at the bottom and moves first. Blue sits at the top. Each side has eight animals, one of each kind, in the starting places shown below. Every animal carries its rank number on a small badge.'),
    { k: 'd', spec: { rows: startRows(), cell: 38 } },
    P('The gold-roofed gate at the middle of each end is that side\'s den. The three dark pits around a den are its traps: they are drawn in the colour of the side they guard.'),
  ] },
  { title: 'The ranking of the animals', items: [
    P('Every animal has a rank from 1 to 8. A higher rank can eat a lower rank. Learn this order and you know most of the game:'),
    D(['R1 R2 R3 R4 R5 R6 R7 R8'], { cell: 42 }),
    P(LADDER.map((n, i) => `${i + 1} ${n}`).join(', ') + '.'),
    P('Two animals of the same rank can eat each other: the one who moves first wins. The two special cases are the rat and the elephant, explained next.'),
  ] },
  { title: 'How an animal moves', items: [
    P('On your turn you move exactly one of your animals, one square straight up, down, left or right. There is no diagonal move, and you cannot pass.'),
    D(['.. .. .. ..', '.. R3 .. ..', '.. .. .. ..'], { marks: [[0, 1, 'dot'], [2, 1, 'dot'], [1, 0, 'dot'], [1, 2, 'dot']], cell: 46 }),
    P('An animal cannot move onto a square holding one of your own animals. It may move onto an enemy animal only if it can eat it (see "Eating").'),
    P('You can never step into your own den. If you have no animal that can move, you lose.'),
  ] },
  { title: 'Eating', items: [
    P('To eat, move your animal onto a square with an enemy animal that your animal is allowed to eat. The eaten animal leaves the board for good.'),
    P('You may eat an animal of the same rank or a lower rank. You may not eat a higher rank.'),
    D(['.. .. .. ..', '.. R4 B2 ..', '.. .. .. ..'], { arrows: [[1, 1, 1, 2]], cell: 46 }),
    P('Here the wolf (4) can eat the cat (2). The cat could not eat the wolf. Eating is part of your move: there is no separate capture turn, and eating is never forced.'),
  ] },
  { title: 'The rat and the elephant', items: [
    P('The rat (1) is the smallest animal, but it is the only animal that can eat the elephant (8).'),
    D(['.. .. .. ..', '.. R1 B8 ..', '.. .. .. ..'], { arrows: [[1, 1, 1, 2]], cell: 46 }),
    P('The elephant cannot eat the rat. The elephant is afraid of it. Every other animal can eat the rat, and the rat can eat any animal of its own rank, which is another rat.'),
    P('The rat can only eat the elephant while it stands on land. A rat swimming in the water cannot attack an elephant on the bank.'),
  ] },
  { title: 'The lakes', items: [
    P('Only the rat may enter the water. A rat can swim from the bank into a lake, swim around in it, and climb out on any bank.'),
    D(['.. .. .. ..', '.. R1 ~~ ..', '.. ~~ ~~ ..'], { marks: [[1, 2, 'dot'], [2, 1, 'dot']], cell: 46 }),
    P('The water protects the swimming rat. No animal on the bank can eat a rat in the water, and a rat in the water cannot eat an animal on the bank. Two rats that are both in the water can eat each other. A rat on the bank can eat nothing in the water, and a rat in the water can eat nothing on the bank.'),
    D(['.. .. B4 ..', '.. .. r1 ..', '.. .. ~~ ..'], { marks: [[1, 2, 'cross']], cell: 46 }),
    P('All other animals have to walk around the lakes, except the lion and the tiger, who can leap across.'),
  ] },
  { title: 'Leaping: the lion and the tiger', items: [
    P('The lion (7) and the tiger (6) can leap over a lake. A leap goes in a straight line from one bank, over the water squares, to the first square beyond the water. It counts as one move.'),
    P('Across the width of a lake the leap crosses 2 squares of water. Along the length of a lake it crosses 3 squares of water.'),
    D(['R7 ~~ ~~ B2', '.. .. .. ..'], { arrows: [[0, 0, 0, 3]], cell: 46 }),
    D(['.. R6 .. ..', '.. ~~ .. ..', '.. ~~ .. ..', '.. ~~ .. ..', '.. B2 .. ..'], { arrows: [[0, 1, 4, 1]], cell: 40 }),
    P('The leap may land on an empty square or on an enemy animal that the leaper can eat. It cannot land on your own animal.'),
    P('A leap is blocked if any rat, yours or the enemy\'s, is swimming in the water squares it would cross.'),
    D(['R7 ~~ r1 ..'], { marks: [[0, 3, 'cross']], cell: 46 }),
    P('In the picture a rat is swimming in the lake, so the lion cannot leap. The lion and tiger cannot leap diagonally, and they cannot leap along a bank: only over the water.'),
  ] },
  { title: 'The traps', items: [
    P('Each den is guarded by three traps. A trap only works against the enemy: when an animal stands in a trap that belongs to the OTHER side, its rank counts as zero.'),
    P('An animal with rank zero can be eaten by any enemy animal, even a rat, and even by the elephant. It is shown with a small black 0 on it.'),
    D(['TB DB TB', '.. R8 ..', '.. B2 ..'], { under: ['.. .. ..', '.. TB ..', '.. .. ..'], arrows: [[2, 1, 1, 1]], cell: 46 }),
    P('In the picture the red elephant stands in a blue trap, so a mere cat can eat it.'),
    P('The animal leaves the trap\'s power the moment it steps out. Your own traps are safe for you: your animals are not weakened in them and enemy animals standing in them are weak.'),
    P('While in an enemy trap an animal also fights with rank zero: it can only eat other animals that are in traps.'),
  ] },
  { title: 'Winning', items: [
    P('You win the moment one of your animals steps into the enemy den.'),
    D(['.. TB ..', 'TB DB TB', '.. R3 ..'], { arrows: [[2, 1, 1, 1]], cell: 46 }),
    P('You also win if the other side has no animals left, or has animals but no legal move.'),
    P('The den can be defended: a defender can eat the intruder while it is still on the way, so the last steps toward the den are the moment of the game. Animals in the traps beside a den are weak, so approach carefully.'),
  ] },
  { title: 'Draws and the house rules', items: [
    P('If the same position, with the same side to move, comes up three times, the game is a draw.'),
    P('Fifty moves each (100 moves together) without any eating ends the game on strength: the side whose animals have the higher rank total wins, and equal totals are a draw. This keeps the computer from shuffling forever.'),
    P('A game is also a draw after 200 moves each.'),
    P('Everything on these pages is exactly what the game enforces. If a move is refused, the line above the board tells you why.'),
  ] },
];

export const HOWTO = [
  { title: 'The goal', items: [
    P('Step one of your animals into the enemy den, the gate at the middle of the far end of the board. Or leave your opponent without animals or without a move.'),
    P('Red is at the bottom and moves first. Bigger animals eat smaller ones, the rat can eat the elephant, only the rat swims, the lion and tiger leap the lakes, and an animal in an enemy trap is weak.'),
  ] },
  { title: 'Making a move', items: [
    P('Tap one of your animals. It lifts, and the squares it can reach glow. A red ring on a glowing square means the move eats an animal. A curved arrow means a leap over a lake.'),
    P('Tap a glowing square to move there, or drag the animal onto it. Tap the animal again to put it down. If a move is refused, a line above the board says why.'),
    P('Each animal shows its rank number on a small badge. When an animal stands in an enemy trap, a black 0 shows that its rank counts as zero.'),
  ] },
  { title: 'Learning', items: [
    P('Learn to play has six short lessons where you make every move yourself: reaching the den, eating, the rat and the elephant, swimming, leaping a lake, and traps.'),
    P('Hint shows a good move and says why, three times a game. Danger marks, a small red mark on your animals that could be eaten next, can be switched off in Settings. Take back undoes your last move and the reply.'),
    P('Auto Play lets you watch the computer play both sides. Each move is first shown as a question (what would you play?), then revealed with the reasons. Pause freezes everything; the think time can be changed.'),
  ] },
  { title: 'Playing well', items: [
    P('Keep your rat alive: it is the only answer to an enemy elephant, and it is your best swimmer. Do not rush the elephant forward while the enemy rat lives.'),
    P('Tigers and lions are the strongest hunters. Park a leaper beside a lake and it threatens animals on the far bank.'),
    P('Defend your den. An enemy two squares away from it is already a danger: eat it, block it, or trap it. Lure bigger animals into your traps.'),
  ] },
  { title: 'Settings', items: [
    P('Choose the computer level (five levels), whether you play Red or Blue, the board and piece looks (more open as you win), sound, reduced motion and the text size. Your unfinished game is saved when you leave.'),
  ] },
];

export const ABOUT = [
  { title: 'About this game', items: [
    P('Jungle is known in China as Dou Shou Qi, "fighting beasts chess". It is a traditional children\'s and family board game of China, played there since at least the early twentieth century, and it is loved across Asia and beyond under names such as Jungle, Animal Chess and Dou Shou Qi.'),
    P('The animals are drawn by hand in this edition: eight painted tokens on a lit jungle board with lakes that ripple, dens with gold roofs, and traps ringed in each side\'s colour.'),
    P('Five computer levels from Beginner to Master, six hands-on lessons, hints that explain themselves, danger marks, take back, a two-player mode and a Watch & Learn mode. Large text up to 300 percent and a reduced-motion option. No ads. Works offline.'),
  ] },
  { title: 'A free taste, and the full game', items: [
    P('You can try the game for a short time for free. The full game is a single one-time purchase, with no ads and nothing else to buy. Your menus, Rules, lessons and Auto Play are always free to open.'),
  ] },
  { title: 'Part of Arcforge', items: [
    P('Jungle is one of the world\'s heritage games collected in the Arcforge app: classic games from many cultures, each made to look and feel better than the usual store versions.'),
  ] },
  { title: 'Credits', items: [
    P('Display font: Fredoka, SIL Open Font License 1.1. All art and sound are drawn and synthesized in the game itself.'),
  ] },
];

// Lessons: board rows of 7 characters, 9 rows. Digits 1-8 are Red animals (rank), letters a-h are Blue animals (a rat .. h elephant), '.' empty.
const IDX = (r, c) => r * 7 + c;
export const LESSONS = [
  { title: 'Walk into the den', text: 'Tap the cat, then tap the glowing square. The den at the top is the goal: step into it and you win.', hint: 'Tap the cat, then the den (the little gate at the top).', done: 'That is how you win: one step into the enemy den.',
    board: ['.......', '...2...', '.......', '.......', '.......', '.......', '.......', '.......', '.......'], target: IDX(0, 3), goal: { type: 'to', to: IDX(0, 3) } },
  { title: 'Big eats small', text: 'The wolf (4) is stronger than the cat (2). Tap the wolf, then the cat to eat it.', hint: 'Tap the wolf, then tap the cat next to it.', done: 'A bigger animal eats a smaller one. Equal ranks can eat each other too.',
    board: ['.......', '.......', '.......', '.......', '.......', '...b...', '...4...', '.......', '.......'], target: IDX(5, 3), goal: { type: 'capture', n: 1 } },
  { title: 'The rat eats the elephant', text: 'The elephant (8) is the biggest, but the little rat (1) can eat it. Eat the elephant with the rat.', hint: 'Tap the rat, then tap the elephant.', done: 'Only the rat can eat an elephant. And the elephant can never eat the rat.',
    board: ['.......', '.......', '.......', '.......', '.......', '...h...', '...1...', '.......', '.......'], target: IDX(5, 3), goal: { type: 'capture', n: 1 } },
  { title: 'Swimming', text: 'Only the rat can enter the lake. Tap the rat, then the water square beside it. The other animals have to walk around.', hint: 'Tap the rat, then tap the water square above it.', done: 'In the water the rat is safe from every animal on the bank.',
    board: ['.......', '.......', '.......', '.......', '.......', '.......', '.1.3...', '.......', '.......'], target: IDX(5, 1), goal: { type: 'to', to: IDX(5, 1) } },
  { title: 'Leap over the lake', text: 'The tiger (6) can leap straight over the water. Tap it: the square across the lake glows. Leap and eat the cat.', hint: 'Tap the tiger, then the glowing square across the lake (the cat is there).', done: 'Lions and tigers leap lakes in a straight line, as one move. A rat in the water would block the leap.',
    board: ['.......', '.......', '.b.....', '.......', '.......', '.......', '.6.....', '.......', '.......'], target: IDX(2, 1), goal: { type: 'capture', n: 1 } },
  { title: 'Traps make animals weak', text: 'The blue elephant stands in your trap, so its rank counts as zero. Even the cat can eat it. Tap the cat, then the elephant.', hint: 'Tap the cat, then tap the elephant standing in the dark trap.', done: 'An animal in an enemy trap is weak: any animal can eat it.',
    board: ['.......', '.......', '.......', '.......', '.......', '.......', '...2...', '...h...', '.......'], target: IDX(7, 3), goal: { type: 'capture', n: 1 } },
];
