// Learn-to-play content as data. You always play Sente (the pieces that start at the bottom and move UP).
// Rows: top row first, space-separated. 'Pb' = your pawn, 'Rw' = an enemy rook, '+Pb' = a promoted piece, '.' empty.
// want kinds (what completes the lesson):
//   { kind: 'capture', to: [r, c] }          capture on that point
//   { kind: 'promote' }                       any promoting move
//   { kind: 'drop', t: 'G', to: [r, c] }      drop that piece on that point
//   { kind: 'refuse' }                        try an illegal drop and read why it is refused
//   { kind: 'mate' }                          a move that gives checkmate
// mark: points to draw attention to; hand: pieces on your stand.
const E = '. . . . . . . . .';
const rows = (spec) => { const r = Array.from({ length: 9 }, () => E.split(' ')); for (const [rr, cc, tok] of spec) r[rr][cc] = tok; return r.map((x) => x.join(' ')); };

export const LESSONS = [
  { title: 'The board and the Pawn',
    text: 'Two armies, one goal: trap the enemy king. Your pieces point up the board. The pawn steps one point straight forward, and captures the same way. Capture the enemy pawn.',
    how: 'TAP your pawn, then TAP the glowing point.',
    rows: rows([[5, 4, 'Pb'], [4, 4, 'Pw'], [8, 4, 'Kb'], [0, 4, 'Kw']]), want: { kind: 'capture', to: [4, 4] }, mark: [[4, 4]] },
  { title: 'The Lance',
    text: 'The lance slides straight forward as far as it likes, but never backward and never sideways. It stops when it captures. Take the pawn at the far end.',
    how: 'TAP the lance, then TAP the enemy pawn.',
    rows: rows([[8, 1, 'Lb'], [4, 1, 'Pw'], [8, 4, 'Kb'], [0, 4, 'Kw']]), want: { kind: 'capture', to: [4, 1] }, mark: [[4, 1]] },
  { title: 'The Knight',
    text: 'The knight jumps two points forward and one to the side, over anything in the way. It only ever goes forward. Jump over your own pawn and capture the gold.',
    how: 'TAP the knight, then TAP the gold.',
    rows: rows([[6, 4, 'Nb'], [5, 4, 'Pb'], [4, 5, 'Gw'], [8, 4, 'Kb'], [0, 4, 'Kw']]), want: { kind: 'capture', to: [4, 5] }, mark: [[4, 5]] },
  { title: 'The Silver',
    text: 'The silver steps one point forward or diagonally in any direction. It cannot step sideways or straight back. Capture the pawn behind you on the diagonal.',
    how: 'TAP the silver, then TAP the enemy pawn.',
    rows: rows([[5, 4, 'Sb'], [6, 3, 'Pw'], [8, 4, 'Kb'], [0, 4, 'Kw']]), want: { kind: 'capture', to: [6, 3] }, mark: [[6, 3]] },
  { title: 'The Gold',
    text: 'The gold steps one point forward, sideways or straight back, or diagonally forward. It never steps diagonally backward. Capture the pawn beside it.',
    how: 'TAP the gold, then TAP the enemy pawn.',
    rows: rows([[5, 4, 'Gb'], [5, 5, 'Pw'], [8, 4, 'Kb'], [0, 4, 'Kw']]), want: { kind: 'capture', to: [5, 5] }, mark: [[5, 5]] },
  { title: 'The Bishop',
    text: 'The bishop slides diagonally any distance, but cannot jump over pieces. Capture the rook at the far end of the diagonal: the rook is worth more than the bishop.',
    how: 'TAP the bishop, then TAP the enemy rook.',
    rows: rows([[7, 1, 'Bb'], [3, 5, 'Rw'], [8, 4, 'Kb'], [0, 4, 'Kw']]), want: { kind: 'capture', to: [3, 5] }, mark: [[3, 5]] },
  { title: 'The Rook',
    text: 'The rook slides straight along a row or a column, any distance. It is the strongest piece at the start. Slide along the row and capture the bishop.',
    how: 'TAP the rook, then TAP the enemy bishop.',
    rows: rows([[6, 6, 'Rb'], [6, 1, 'Bw'], [8, 4, 'Kb'], [0, 4, 'Kw']]), want: { kind: 'capture', to: [6, 1] }, mark: [[6, 1]] },
  { title: 'Check!',
    text: 'The enemy rook attacks your king: that is check, and you must answer it at once. You can capture the attacker, block it, or move the king. Capture the rook with your gold.',
    how: 'TAP the gold beside the rook, then TAP the rook.',
    rows: rows([[3, 4, 'Rw'], [3, 3, 'Gb'], [8, 4, 'Kb'], [0, 0, 'Kw']]), want: { kind: 'capture', to: [3, 4] }, mark: [[3, 4]] },
  { title: 'Promotion',
    text: 'The last three rows are the promotion zone. A piece that moves into, within, or out of the zone may promote: a pawn becomes a tokin and moves like a gold. Step your pawn into the zone and promote it.',
    how: 'TAP the pawn, TAP the glowing point, then TAP Promote.',
    rows: rows([[3, 3, 'Pb'], [8, 4, 'Kb'], [0, 6, 'Kw']]), want: { kind: 'promote' }, mark: [[2, 3]] },
  { title: 'Drops: your stand',
    text: 'In shogi a captured piece changes sides. It waits on your stand and you may drop it on any empty point instead of moving. Drop your gold beside your king, on the marked point.',
    how: 'TAP the gold on your stand (bottom), then TAP the marked point.',
    rows: rows([[0, 4, 'Kw'], [8, 4, 'Kb']]), hand: { b: { G: 1 } }, want: { kind: 'drop', t: 'G', to: [7, 4] }, mark: [[7, 4]] },
  { title: 'Drops: the pawn rule',
    text: 'One rule for pawn drops: you may never have two unpromoted pawns in the same column (nifu). Try to drop your pawn in the column where your pawn already stands, and read the answer.',
    how: 'TAP the pawn on your stand, then TAP any empty point in the pawn\'s column.',
    rows: rows([[6, 4, 'Pb'], [8, 0, 'Kb'], [0, 8, 'Kw']]), hand: { b: { P: 1 } }, want: { kind: 'refuse' }, mark: [] },
  { title: 'Your first checkmate',
    text: 'Checkmate: the king is attacked and cannot escape. Your first rook already guards the whole second row. Slide the other rook up the right edge to check along the top row.',
    how: 'TAP the lower rook, then TAP the point at the top of its column.',
    rows: rows([[1, 0, 'Rb'], [6, 8, 'Rb'], [0, 4, 'Kw'], [8, 4, 'Kb']]), want: { kind: 'mate' }, mark: [[0, 8]] },
];
