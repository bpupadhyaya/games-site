// Words for the About, How-to-play and Rules pages. Only facts we are sure of; nothing about religion.
import { P, L, N, S, G, B, R, K } from './rules.js';

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
// Split into short, single-concept pages (originally 2 much longer pages) so every page still fits
// comfortably at the top text-size step - see TEXT_SCALES in layout.js and renderPage() in view.js.
export const HOWTO = [
  { title: 'Moving', lines: [
    'TAP one of your pieces. Every point it may move to glows, and a line tells you how that piece moves.',
    'TAP a glowing point and the piece slides there. Landing on an enemy piece captures it and puts it on your stand.',
  ] },
  { title: 'Refused moves, and dropping', lines: [
    'Tapped a point that is not allowed? The piece tries, comes back, and a message tells you why.',
    'To DROP: TAP a piece on your stand (the tray under the board), then TAP an empty glowing point.',
  ] },
  { title: 'Keyboard controls', lines: [
    'Arrow keys move the cursor, Space or Enter taps, D picks a piece from your stand, H asks for a hint, Z takes a move back, Escape cancels.',
  ] },
  { title: 'Promotion', lines: [
    'Moving a piece into, inside or out of the last three rows lets you promote it. TAP Promote or Keep. Pawns and lances on the last row, and knights on the last two, must promote.',
  ] },
  { title: 'Drop rules', lines: [
    'No pawn in a column that already holds your unpromoted pawn, no piece dropped where it could never move, and no pawn drop that gives checkmate.',
  ] },
  { title: 'Check, checkmate and draws', lines: [
    'Check means the king is attacked: answer it at once by capturing the attacker, blocking it, or moving the king.',
    'You win by checkmate. The same position four times is a draw, unless one side was giving check every move: that side loses. A game past 400 moves is a draw.',
  ] },
];

// Exhaustive rules reference. Every claim here is cross-checked against the actual implementation in rules.js (the
// single source of truth for legality), so this page can never contradict the engine. Piece type codes 14 and 15
// (Horse and Dragon, the promoted bishop and rook) have no named export in rules.js - see its own comment
// "+B 14, +R 15" - so they are used here as the same plain numbers the engine itself uses internally.
// A handful of these pages (marked below) were split into two once the top text-size step made
// their original single page overflow past the panel - see TEXT_SCALES in layout.js and
// renderPage() in view.js. Splitting keeps every fact intact; nothing here was shortened or cut.
export const RULES = [
  {
    // was one page ("The board and setup"); split so the board-size facts and the turn-order fact
    // each get their own short page.
    title: 'The board',
    lines: [
      'Shogi is played on a grid of points, not squares. The standard game uses a 9x9 board (81 points); this app also has a quicker 5x5 mini shogi as a gentler way in.',
      'Sente moves first, then Gote, and the players strictly alternate turns from there - one move or drop per turn.',
    ],
  },
  {
    title: 'Starting position',
    lines: [
      'Standard: each side starts with 20 pieces - 9 pawns, 2 lances, 2 knights, 2 silver generals, 2 gold generals, a bishop, a rook and a king - filling its own back three rows.',
      'Mini shogi: each side starts with just 6 pieces - a king, a rook, a bishop, a gold general, a silver general and a single pawn guarding the king.',
    ],
  },
  {
    // was one page; its promotion paragraph now has its own page (below), so the piece portrait's
    // page keeps only the identity and movement facts.
    title: 'The pawn',
    piece: P,
    lines: [
      'The pawn is the most numerous piece, holding the front line and pressing forward one point at a time.',
      'It moves one point straight forward, and it captures the same way - by moving onto an enemy piece directly ahead. It can never move sideways, backward, or diagonally.',
    ],
  },
  {
    title: 'The pawn: promotion',
    lines: [
      'It may promote to Tokin in the promotion zone, which then moves exactly like a gold general (see Promotion). A pawn that would land on the very last row must promote there - it could never move again otherwise.',
    ],
  },
  {
    title: 'The lance',
    piece: L,
    lines: [
      'The lance is a pure spear: forward reach and nothing else.',
      'It slides straight forward, any number of empty points in one line, stopping to capture the first enemy piece it meets. It never moves sideways or backward, and it can never jump over a piece.',
      'It promotes the same way as the pawn, into a piece that moves like a gold general (see Promotion). A lance that would land on the very last row must promote there.',
    ],
  },
  {
    title: 'The knight',
    piece: N,
    lines: [
      'The knight reaches points no other piece can, but only facing forward.',
      'It jumps two points straight forward and one point to either side, landing on the third row ahead - the only piece that can leap clean over anything in its path, friend or foe. It has no other move at all: never backward, sideways, or a single step.',
    ],
  },
  {
    title: 'The knight: promotion',
    lines: [
      'It promotes like the pawn and lance, into a piece that moves like a gold general (see Promotion). A knight that would land on either of the last two rows must promote there - from there it could never jump again.',
    ],
  },
  {
    title: 'The silver general',
    piece: S,
    lines: [
      'The silver general backs up the front line - strong advancing, and hard to pin down once it retreats.',
      'It moves one point straight forward, or one point diagonally in any of the four diagonal directions - forward-left, forward-right, backward-left or backward-right. It can never move straight sideways or straight backward.',
    ],
  },
  {
    title: 'The silver general: promotion',
    lines: [
      'In the promotion zone it may become Promoted Silver, which then moves exactly like a gold general (see Promotion) - trading its diagonal retreat for the gold\'s sideways and straight-back step.',
    ],
  },
  {
    title: 'The gold general',
    piece: G,
    lines: [
      'The gold general is the steadiest defender, guarding the king closely from six directions.',
      'It moves one point straight forward, straight backward, straight left, straight right, or diagonally forward (forward-left or forward-right). It can never move diagonally backward.',
      'The gold general never promotes - it is already at its strongest form. Pawns, lances, knights and silver generals all promote into this same six-direction move.',
    ],
  },
  {
    title: 'The bishop',
    piece: B,
    lines: [
      'The bishop is a long-range raider confined to a single diagonal colour for its whole life on the board.',
      'It slides diagonally, any number of empty points in one straight line, and stops when it reaches a piece - capturing it if the piece is an enemy. It can never jump over a piece or leave the diagonal.',
      'In the promotion zone it may become the Horse, which keeps this full diagonal slide and adds a one-point straight step (see the Horse page).',
    ],
  },
  {
    title: 'The rook',
    piece: R,
    lines: [
      'The rook is the strongest unpromoted piece on the board, ruling any open rank or file.',
      'It slides horizontally or vertically, any number of empty points in one straight line, and stops when it reaches a piece - capturing it if the piece is an enemy. It can never jump over a piece.',
      'In the promotion zone it may become the Dragon, which keeps this full straight-line slide and adds a one-point diagonal step (see the Dragon page).',
    ],
  },
  {
    title: 'The king',
    piece: K,
    lines: [
      'The king is the piece the whole game is fought over. Lose it and the game ends at once.',
      'It moves exactly one point in any of the eight directions around it - straight or diagonal.',
      'The king never promotes. Unlike chess, this game has no castling and no other special king move.',
    ],
  },
  {
    // was one page with 4 paragraphs; split into "what promotes and when" and "choosing, and how
    // permanent it is".
    title: 'Promotion',
    lines: [
      'A piece promotes only on a move that starts inside, ends inside, or crosses into the promotion zone - the far three rows on the standard 9x9 board, or just the single far row on the 5x5 mini board.',
      'The pawn, lance, knight, silver general, bishop and rook can promote; the gold general and king never can.',
    ],
  },
  {
    title: 'Promotion: choice and permanence',
    lines: [
      'Promotion is your choice - a Promote/Keep prompt appears whenever it is legal - except when the piece would otherwise have no legal move left: a pawn or lance landing on the very last row, or a knight landing on either of the last two rows, must promote.',
      'Promotion lasts for the rest of that piece\'s life on the board. It only reverts if the piece is captured - a captured piece always returns to its owner\'s stand in its original, unpromoted form (see Drops).',
    ],
  },
  {
    title: 'The horse (promoted bishop)',
    piece: 14,
    lines: [
      'The Horse is a bishop that has promoted, gaining a defender\'s short reach on top of its long diagonal one.',
      'It slides diagonally any distance exactly like a bishop, and it can also step exactly one point straight up, down, left or right. It still cannot jump over a piece on its diagonal slides.',
    ],
  },
  {
    title: 'The dragon (promoted rook)',
    piece: 15,
    lines: [
      'The Dragon is a rook that has promoted - the single most powerful piece in the game.',
      'It slides horizontally or vertically any distance exactly like a rook, and it can also step exactly one point diagonally in any of the four diagonal directions. It still cannot jump over a piece on its straight-line slides.',
    ],
  },
  {
    // was one page with 4 paragraphs; split into "what a drop is and how you make one" and "every
    // restriction on a drop, including the pawn-only uchifuzume rule".
    title: 'Drops',
    lines: [
      'Shogi\'s defining rule: a captured piece is never removed from the game. It changes sides, waits on the capturing player\'s stand, and always reverts to its original, unpromoted form - even if it was promoted the moment it was captured.',
      'On your turn, instead of moving a piece already on the board, you may drop a piece from your stand onto any empty point. From then on it plays exactly like a piece that had always stood there.',
    ],
  },
  {
    title: 'Drop restrictions',
    lines: [
      'A drop must land on an empty point; a pawn, lance or knight cannot be dropped where it could never move again (a pawn or lance on the very last row, a knight on either of the last two rows); a pawn cannot be dropped into a column that already holds one of your own unpromoted pawns (nifu); and no drop may leave your own king in check.',
      'One more restriction, unique to the pawn: a pawn may never be dropped to deliver checkmate (uchifuzume) - that win must come from a move instead. Dropping any other piece to give checkmate is completely legal.',
    ],
  },
  {
    // was one page with 3 paragraphs (the third quite long); split off the stalemate/resign
    // paragraph onto its own page.
    title: 'Check and checkmate',
    lines: [
      'Check: a king is in check when an enemy piece attacks its point. The side in check must immediately play a move or drop that ends it - capture the attacker, block the attacking line, or move the king to safety.',
      'Checkmate: if the side to move is in check with no legal way out, that side is checkmated and loses at once.',
    ],
  },
  {
    title: 'No legal move, and resigning',
    lines: [
      'Unlike chess, having no legal move while NOT in check is not a stalemate draw here - it simply loses the game for the side that cannot move (in practice this almost never happens, since a captured piece can usually be dropped somewhere). You may also resign at any time, conceding the game.',
    ],
  },
  {
    title: 'Draws and other endings',
    lines: [
      'Repetition: if the exact same position - same pieces, same stands, same side to move - occurs four times, the game ends. If one side gave check on every one of those repeated moves, that side loses (perpetual check); otherwise the game is a plain draw.',
      'This game does not score the historic jishogi "impasse" endgame (both kings reaching the far camp) by material points. Instead, a game that runs past 400 total moves is simply called a draw.',
    ],
  },
];
