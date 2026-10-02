// Six hands-on lessons. Each is a real position played with the real rule book (rules.js): the player makes the move,
// the board plays it out, and a short note explains what happened. `want(mv)` says which first taps teach the lesson.
import { newGame } from './rules.js';

const rows = (front, backByColumn = []) => { const a = new Array(16).fill(0); for (let i = 0; i < 8; i++) { a[i] = front[i] || 0; a[15 - i] = backByColumn[i] || 0; } return a; };
function mk(south, north, stock, house = [true, false]) {
  const g = newGame(); g.pits = [south.slice(), north.slice()]; g.stock = stock.slice(); g.house = house.slice(); return g;
}

export const LESSONS = [
  {
    title: 'A quiet first move',
    text: 'Neither side has seeds facing the other, so no capture is possible. Tap a glowing pit, then choose a direction.',
    game: () => newGame(),
    want: () => true,
    done: 'That was a takata: a move that cannot capture. Your store seed joined the pit and all its seeds were sown. The square nyumba could not be used.',
  },
  {
    title: 'Capture is compulsory',
    text: 'Two of your pits face enemy seeds. Capturing is compulsory in namua: tap a glowing pit to put your store seed in it.',
    game: () => mk(rows([0, 0, 0, 2, 6, 2, 2, 0]), rows([0, 2, 0, 0, 3, 0, 0, 0]), [18, 17]),
    want: () => true,
    done: 'Your store seed went into the pit, and the seeds facing it were captured and sown into your side, one by one, from a kichwa.',
  },
  {
    title: 'Choose your kichwa',
    text: 'Only the middle pit can capture here. Tap it. After the capture you decide which end the captured seeds start from.',
    game: () => mk(rows([0, 0, 0, 3, 6, 2, 0, 0]), rows([0, 0, 0, 0, 4, 0, 0, 0]), [17, 16]),
    want: (mv) => mv.r === 3,
    done: 'From the left kichwa you sow clockwise, from the right kichwa anticlockwise. Choose the end that lands your last seed where you want it.',
  },
  {
    title: 'Kimbi: the end is chosen for you',
    text: 'Your marker is in a kimbi, the second pit. Tap it. The captured seeds must start from the nearest kichwa.',
    game: () => mk(rows([0, 2, 0, 0, 6, 2, 0, 0]), rows([0, 0, 0, 0, 0, 0, 3, 0]), [18, 18]),
    want: (mv) => mv.r === 1,
    done: 'A capture in a kimbi always starts from the kichwa on that side, so the game chose the left kichwa for you.',
  },
  {
    title: 'Mtaji: sow to capture',
    text: 'Your store is empty, so you sow a pit instead. Only one pit can capture, and capturing is compulsory: tap it. Its last seed lands on a pit that faces enemy seeds.',
    game: () => mk(rows([0, 0, 3, 0, 0, 1, 0, 0]), rows([0, 0, 4, 0, 0, 0, 0, 0]), [0, 0], [false, false]),
    want: (mv) => mv.r === 2 && mv.d === 1,
    done: 'The last seed of your sowing landed in an occupied pit facing enemy seeds, so you captured. In mtaji, capturing is compulsory when it is possible.',
  },
  {
    title: 'The nyumba and safari',
    text: 'Your house, the square nyumba, holds seeds. Tap the glowing pit. If your capturing sow ends in the nyumba, you can choose to carry on.',
    game: () => mk([0, 0, 0, 1, 7, 1, 1, 0, 2, 0, 0, 0, 0, 2, 0, 0], [1, 1, 1, 0, 0, 0, 1, 0, 0, 0, 0, 1, 2, 0, 0, 0], [0, 0], [true, false]),
    want: () => true,
    done: 'Carrying on from the nyumba is called safari: it opens the house, which then loses its protection. Stopping keeps the house closed.',
  },
];
