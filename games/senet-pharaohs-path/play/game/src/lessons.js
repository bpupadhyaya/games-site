// Ten lessons that teach by doing. Squares are numbered 1-30 as the player sees them.
// Fields: setup {one, two, off}, throw (fixed number, or null = the player throws), want: 'move' | 'refused' | 'extra' | 'throw',
// at (squares the move must land on; 31 = leave the board), from (square of the piece a 'refused' lesson wants tried), hint (said when the player does something else).
export const LESSONS = [
  { title: 'Follow the path', setup: { one: [9], two: [20] }, throw: 3, want: 'move', at: [12],
    text: 'Squares are numbered along an S: down the left column, up the middle, down the right. A throw of 3 moves your piece 3 squares round the bend. TAP your glowing piece, then TAP square 12.',
    done: 'Well done. The path turns at the end of each column, and pieces only ever travel forward.', hint: 'TAP your piece on square 9, then TAP the glowing square 12.' },
  { title: 'Throw the sticks', setup: { one: [4, 8], two: [13] }, throw: null, want: 'throw',
    text: 'Four sticks have a light face and a dark face. TAP the sticks to throw. Count the light faces that land up. No light face at all counts as 5.',
    done: 'The number thrown is how far one piece must move. 1, 2, 3 or 4 light faces count for themselves.', hint: 'TAP the sticks at the bottom of the screen.' },
  { title: 'Throw again', setup: { one: [2], two: [20] }, throw: 4, want: 'extra', at: [6],
    text: 'A throw of 1, 4 or 5 earns another throw. You threw a 4: move your piece to square 6, then TAP the sticks again.',
    done: 'A 1, 4 or 5 keeps the turn with you. A 2 or 3 passes it to the other side.', hint: 'TAP the glowing piece on square 2, then TAP square 6.' },
  { title: 'Swap places', setup: { one: [5], two: [8, 13] }, throw: 3, want: 'move', at: [8],
    text: 'Land on a lone enemy piece and you swap places: it goes back to where you started. Move your piece 3 squares to the enemy on square 8.',
    done: 'The enemy piece was sent back to square 5, and yours took its place.', hint: 'TAP your piece on square 5, then TAP the gold square 8.' },
  { title: 'Pairs are safe', setup: { one: [1, 5], two: [8, 9] }, throw: 3, want: 'refused', from: 5,
    text: 'Two pieces side by side protect each other. Try to swap: TAP your piece on square 5, then TAP square 8.',
    done: 'That is why the piece came back: a piece beside a friend cannot be swapped. Keep your pieces in pairs.', hint: 'TAP the piece on square 5, then TAP square 8 to see what happens.' },
  { title: 'A wall of three', setup: { one: [1, 8], two: [10, 11, 12] }, throw: 4, want: 'refused', from: 8,
    text: 'Three pieces in a row make a wall. Nothing can land on it or jump over it. Try: TAP your piece on square 8, then TAP square 12.',
    done: 'The wall holds. Building three in a row can hold up the enemy for many turns.', hint: 'TAP the piece on square 8, then TAP square 12.' },
  { title: 'Safe houses', setup: { one: [3, 12], two: [15] }, throw: 3, want: 'refused', from: 12,
    text: 'The rosette square 15 is a safe house, and so are 26, 28 and 29. A piece standing on one cannot be swapped. Try: TAP the piece on square 12, then TAP square 15.',
    done: 'Safe houses protect a piece even when it stands alone.', hint: 'TAP the piece on square 12, then TAP square 15.' },
  { title: 'House of Happiness', setup: { one: [23, 24], two: [7] }, throw: 3, want: 'move', at: [26],
    text: 'Square 26 (the diamond) is where every piece must stop on its way home: it may not be passed. Move your piece from 23 to 26.',
    done: 'From 26 a throw of 5 takes a piece off the board. Other throws move it on to squares 28 to 30.', hint: 'The piece on 24 would pass square 26. TAP the piece on 23, then TAP square 26.' },
  { title: 'The House of Water', setup: { one: [20, 26], two: [7] }, throw: 1, want: 'move', at: [21],
    text: 'Square 27 is the House of Water. A piece that lands there is sent back to square 15. You threw a 1: move the piece that is NOT on 26.',
    done: 'Good choice. You can always pick which piece moves, so keep another piece ready for unlucky throws.', hint: 'That would drop the piece into the water. Move the piece on square 20 instead.' },
  { title: 'Bringing pieces home', setup: { one: [29], two: [4], off: [4, 0] }, throw: 2, want: 'move', at: [31],
    text: 'The last squares need exact throws: 28 needs a 3, 29 a 2, 30 a 1 (the dots show it). Your last piece is on 29 and you threw a 2. TAP it, then TAP the exit under square 30.',
    done: 'All five pieces are home: you win the race. You know the whole game.', hint: 'TAP the piece on square 29, then TAP the gold exit below square 30.' },
];
export function buildLesson(l) {
  const board = new Array(30).fill(0);
  for (const s of l.setup.one) board[s - 1] = 1;
  for (const s of l.setup.two) board[s - 1] = 2;
  return { board, off: l.setup.off ? l.setup.off.slice() : [0, 0], turn: 1, n: 0, extra: false, winner: null, throws: 0, moves: 0, reason: '' };
}
