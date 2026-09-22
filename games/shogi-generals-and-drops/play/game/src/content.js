// Words for the About and How-to-play pages. Only facts we are sure of; nothing about religion.
export const ABOUT = [
  { title: 'Japan\'s game of generals', lines: [
    'Shogi is the chess-like strategy game of Japan. It is played on a board of 9 by 9 points, and each player has 20 pieces.',
    'It is documented in Japan for about a thousand years, and its ancestors belong to the same old family of Asian war games as chess.',
    'Today shogi has professional players, national titles, newspaper tournaments and a huge number of amateurs, from children to grandparents.',
  ] },
  { title: 'Why captured pieces come back', lines: [
    'In shogi a captured piece is not removed. It changes sides and waits on your stand, and on a later turn you may drop it on any empty point instead of moving.',
    'That is why shogi has no quick draws by exchange: pieces keep coming back, attacks last longer, and the endgame is full of drops and surprises.',
    'Pieces have no colours. A wedge always points toward the opponent, so you can see at a glance whose piece it is.',
  ] },
  { title: 'How shogi differs from chess', lines: [
    'There is no queen. The rook and bishop are the long-range pieces, and the gold and silver generals move in their own ways.',
    'In the last three rows a piece may promote and become stronger; its character turns red.',
    'The board has no colours, boards are traditionally carved from kaya wood, and pieces from boxwood, with the characters written by hand or carved.',
    'Checkmate problems, called tsume shogi, are a beloved tradition: find the forcing moves that trap the king.',
  ] },
];
export const HOWTO = [
  { title: 'Moving and dropping', lines: [
    'TAP one of your pieces. Every point it may move to glows, and a line tells you how that piece moves.',
    'TAP a glowing point and the piece slides there. Landing on an enemy piece captures it and puts it on your stand.',
    'Tapped a point that is not allowed? The piece tries, comes back, and a message tells you why.',
    'To DROP: TAP a piece on your stand (the tray under the board), then TAP an empty glowing point.',
    'Keyboard: arrow keys move the cursor, Space or Enter taps, D picks a piece from your stand, H asks for a hint, Z takes a move back, Escape cancels.',
  ] },
  { title: 'Promotion and winning', lines: [
    'Moving a piece into, inside or out of the last three rows lets you promote it. TAP Promote or Keep. Pawns and lances on the last row, and knights on the last two, must promote.',
    'Drop rules: no pawn in a column that already holds your unpromoted pawn, no piece dropped where it could never move, and no pawn drop that gives checkmate.',
    'Check means the king is attacked: answer it at once by capturing the attacker, blocking it, or moving the king.',
    'You win by checkmate. The same position four times is a draw, unless one side was giving check every move: that side loses. A game past 400 moves is a draw.',
  ] },
];
