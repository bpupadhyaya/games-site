// Words for the About, How-to-play and Rules pages. Only facts we are sure of; nothing about religion.
import { P, L, N, S, G, B, R, K } from './rules.js';

// Split into single-paragraph pages so every page still fits comfortably at the top text-size step
// (now 3x) - see TEXT_SCALES in layout.js and renderPage() in view.js. Originally 3 pages of 3-4
// paragraphs each; nothing here was shortened or cut, only broken at paragraph/sentence boundaries.
export const ABOUT = [
  { title: 'Japan\'s game of generals', lines: [
    'Shogi is the chess-like strategy game of Japan. It is played on a 9 by 9 board of squares, and each player has 20 pieces.',
  ] },
  { title: 'Japan\'s game of generals', lines: [
    'It is documented in Japan for about a thousand years, and its ancestors belong to the same old family of Asian war games as chess.',
  ] },
  { title: 'Japan\'s game of generals', lines: [
    'Today shogi has professional players, national titles, newspaper tournaments and a huge number of amateurs, from children to grandparents.',
  ] },
  { title: 'Why captured pieces come back', lines: [
    'In shogi a captured piece is not removed.',
  ] },
  { title: 'Why captured pieces come back', lines: [
    'It changes sides and waits on your stand, and on a later turn you may drop it on any empty point instead of moving.',
  ] },
  { title: 'Why captured pieces come back', lines: [
    'That is why shogi has no quick draws by exchange: pieces keep coming back and attacks last longer.',
  ] },
  { title: 'Why captured pieces come back', lines: [
    'The endgame is full of drops and surprises.',
  ] },
  { title: 'Why captured pieces come back', lines: [
    'Pieces have no colours. A wedge always points toward the opponent, so you can see at a glance whose piece it is.',
  ] },
  { title: 'How shogi differs from chess', lines: [
    'There is no queen. The rook and bishop are the long-range pieces, and the gold and silver generals move in their own ways.',
  ] },
  { title: 'How shogi differs from chess', lines: [
    'In the last three rows a piece may promote and become stronger; its character turns red.',
  ] },
  { title: 'How shogi differs from chess', lines: [
    'The board has no colours; boards are traditionally carved from kaya wood, and pieces from boxwood.',
  ] },
  { title: 'How shogi differs from chess', lines: [
    'The characters on each piece are written by hand or carved.',
  ] },
  { title: 'How shogi differs from chess', lines: [
    'Checkmate problems, called tsume shogi, are a beloved tradition: find the forcing moves that trap the king.',
  ] },
];
// Split into short, single-concept pages (originally 2 much longer pages) so every page still fits
// comfortably at the top text-size step - see TEXT_SCALES in layout.js and renderPage() in view.js.
// The pages with two paragraphs each ("Moving", "Refused moves, and dropping", "Check, checkmate
// and draws") were split again, one paragraph per page, once first the 2x and then the 3x top
// step made them overflow. A further pass split every remaining paragraph over ~140 characters at
// its natural sentence boundary, one sentence's worth of fact per page - see content-fit checks.
export const HOWTO = [
  { title: 'Moving', lines: [
    'TAP one of your pieces. Every point it may move to glows, and a line tells you how that piece moves.',
  ] },
  { title: 'Moving', lines: [
    'TAP a glowing point and the piece slides there. Landing on an enemy piece captures it and puts it on your stand.',
  ] },
  { title: 'Refused moves', lines: [
    'Tapped a point that is not allowed? The piece tries, comes back, and a message tells you why.',
  ] },
  { title: 'Dropping', lines: [
    'To DROP: TAP a piece on your stand (the tray under the board), then TAP an empty glowing point.',
  ] },
  { title: 'Keyboard controls', lines: [
    'Arrow keys move the cursor, Space or Enter taps, D picks a piece from your stand, H asks for a hint, Z takes a move back, Escape cancels.',
  ] },
  { title: 'Promotion', lines: [
    'Moving a piece into, inside or out of the last three rows lets you promote it. TAP Promote or Keep.',
  ] },
  { title: 'Promotion', lines: [
    'Pawns and lances on the last row, and knights on the last two, must promote - there is no Keep option for them.',
  ] },
  { title: 'Drop rules', lines: [
    'No pawn may drop into a column that already holds your unpromoted pawn, and no piece may drop where it could never move.',
  ] },
  { title: 'Drop rules', lines: [
    'A pawn may also never be dropped to give checkmate.',
  ] },
  { title: 'Check, checkmate and draws', lines: [
    'Check means the king is attacked: answer it at once by capturing the attacker, blocking it, or moving the king.',
  ] },
  { title: 'Check, checkmate and draws', lines: [
    'You win by checkmate.',
  ] },
  { title: 'Check, checkmate and draws', lines: [
    'The same position four times is a draw, unless one side was giving check every move: that side loses.',
  ] },
  { title: 'Check, checkmate and draws', lines: [
    'A game past 400 moves is also a draw.',
  ] },
  { title: 'Auto Play', lines: [
    'From the title screen, "Auto Play · Watch & Learn" plays a full game with the computer on both sides: THINK, then the move is revealed before it plays, so you can compare it with your own guess. A +/- stepper sets how long you get to think, up to 10 seconds. It is silent, free, and never touches your saved game.',
  ] },
];

// Exhaustive rules reference. Every claim here is cross-checked against the actual implementation in rules.js (the
// single source of truth for legality), so this page can never contradict the engine. Piece type codes 14 and 15
// (Horse and Dragon, the promoted bishop and rook) have no named export in rules.js - see its own comment
// "+B 14, +R 15" - so they are used here as the same plain numbers the engine itself uses internally.
// Every page here is one single concept, one short paragraph (usually one sentence), so it stays comfortably
// inside the panel even at the 3x top text-size step - see TEXT_SCALES in layout.js and renderPage() in view.js.
// Nothing here was shortened or cut from the original text; long-standing pages were only ever broken at
// paragraph or sentence boundaries, and every piece's identity sentence keeps its portrait page while the
// movement (and, where the piece has no separate promotion page, its promotion note) moved to a second,
// portrait-free page - the portrait itself eats too much of the panel's height for a page to also hold a full
// paragraph of body text.
// At 3x a handful of single-sentence identity paragraphs (silver general, gold general, horse) still ran into
// the Previous/Next row even alone with the portrait, so those piece pages now show just the portrait with no
// body text, and the identity sentence moved to its own portrait-free page right after (title repeated, no
// piece) - same "single concept per page" principle, just split one page earlier than for the other pieces.
// The king's two-sentence movement paragraph got the same one-more-split treatment as gold/bishop/rook did at
// 2x: movement and "never promotes" are now on their own pages.
// A later pass (content-fit audit against the real canvas font metrics) found every remaining paragraph whose
// text ran past ~140 characters still forced the renderer to shrink its font well below the requested text-size
// step even though it never visibly overflowed the panel - the "never shrink to cram it in" rule from the 300%
// pass applies just as much to a quiet in-budget shrink as to an overflow, so those paragraphs were split again,
// one sentence (or one natural clause) per page, the same way the piece movement pages already were.
export const RULES = [
  {
    title: 'The board',
    lines: [
      'Shogi is played on a grid of squares, like chess - not a grid of intersecting lines like Go.',
    ],
  },
  {
    title: 'The board',
    lines: [
      'The standard game uses a 9x9 board (81 squares); this app also has a quicker 5x5 mini shogi as a gentler way in.',
    ],
  },
  {
    title: 'Turn order',
    lines: [
      'Sente moves first, then Gote, and the players strictly alternate turns from there - one move or drop per turn.',
    ],
  },
  {
    title: 'Starting position',
    lines: [
      'Standard: each side starts with 20 pieces - 9 pawns, 2 lances, 2 knights, 2 silver generals, 2 gold generals, a bishop, a rook and a king.',
    ],
  },
  {
    title: 'Starting position',
    lines: [
      'All 20 pieces fill just its own back three rows at the start.',
    ],
  },
  {
    title: 'Starting position: mini shogi',
    lines: [
      'Mini shogi: each side starts with just 6 pieces - a king, a rook, a bishop, a gold general, a silver general and a single pawn guarding the king.',
    ],
  },
  {
    title: 'The pawn',
    piece: P,
    lines: [
      'The pawn is the most numerous piece, holding the front line and pressing forward one point at a time.',
    ],
  },
  {
    title: 'The pawn: movement',
    lines: [
      'It moves one point straight forward, and it captures the same way - by moving onto an enemy piece directly ahead.',
    ],
  },
  {
    title: 'The pawn: movement',
    lines: [
      'It can never move sideways, backward, or diagonally.',
    ],
  },
  {
    title: 'The pawn: promotion',
    lines: [
      'It may promote to Tokin in the promotion zone, which then moves exactly like a gold general (see Promotion).',
    ],
  },
  {
    title: 'The pawn: promotion',
    lines: [
      'A pawn that would land on the very last row must promote there - it could never move again otherwise.',
    ],
  },
  {
    title: 'The lance',
    piece: L,
    lines: [
      'The lance is a pure spear: forward reach and nothing else.',
    ],
  },
  {
    title: 'The lance: movement',
    lines: [
      'It slides straight forward, any number of empty points in one line, stopping to capture the first enemy piece it meets.',
    ],
  },
  {
    title: 'The lance: movement',
    lines: [
      'It never moves sideways or backward, and it can never jump over a piece.',
    ],
  },
  {
    title: 'The lance: promotion',
    lines: [
      'It promotes the same way as the pawn, into a piece that moves like a gold general (see Promotion).',
    ],
  },
  {
    title: 'The lance: promotion',
    lines: [
      'A lance that would land on the very last row must promote there.',
    ],
  },
  {
    title: 'The knight',
    piece: N,
    lines: [
      'The knight reaches points no other piece can, but only facing forward.',
    ],
  },
  {
    title: 'The knight: movement',
    lines: [
      'It jumps two points straight forward and one point to either side, landing on the third row ahead.',
    ],
  },
  {
    title: 'The knight: movement',
    lines: [
      'It is the only piece that can leap clean over anything in its path, friend or foe.',
    ],
  },
  {
    title: 'The knight: movement',
    lines: [
      'It has no other move at all: never backward, sideways, or a single step.',
    ],
  },
  {
    title: 'The knight: promotion',
    lines: [
      'It promotes like the pawn and lance, into a piece that moves like a gold general (see Promotion).',
    ],
  },
  {
    title: 'The knight: promotion',
    lines: [
      'A knight that would land on either of the last two rows must promote there - from there it could never jump again.',
    ],
  },
  {
    title: 'The silver general',
    piece: S,
    lines: [],
  },
  {
    title: 'The silver general',
    lines: [
      'The silver general backs up the front line - strong advancing, and hard to pin down once it retreats.',
    ],
  },
  {
    title: 'The silver general: movement',
    lines: [
      'It moves one point straight forward, or one point diagonally in any of the four diagonal directions.',
    ],
  },
  {
    title: 'The silver general: movement',
    lines: [
      'Those four diagonals are forward-left, forward-right, backward-left and backward-right.',
    ],
  },
  {
    title: 'The silver general: movement',
    lines: [
      'It can never move straight sideways or straight backward.',
    ],
  },
  {
    title: 'The silver general: promotion',
    lines: [
      'In the promotion zone it may become Promoted Silver, which then moves exactly like a gold general (see Promotion).',
    ],
  },
  {
    title: 'The silver general: promotion',
    lines: [
      'That trades its diagonal retreat for the gold\'s sideways and straight-back step.',
    ],
  },
  {
    title: 'The gold general',
    piece: G,
    lines: [],
  },
  {
    title: 'The gold general',
    lines: [
      'The gold general is the steadiest defender, guarding the king closely from six directions.',
    ],
  },
  {
    title: 'The gold general: movement',
    lines: [
      'It moves one point straight forward, straight backward, straight left, or straight right.',
    ],
  },
  {
    title: 'The gold general: movement',
    lines: [
      'It can also move one point diagonally forward (forward-left or forward-right), but never diagonally backward.',
    ],
  },
  {
    title: 'The gold general: no promotion',
    lines: [
      'The gold general never promotes - it is already at its strongest form.',
    ],
  },
  {
    title: 'The gold general: no promotion',
    lines: [
      'Pawns, lances, knights and silver generals all promote into this same six-direction move.',
    ],
  },
  {
    title: 'The bishop',
    piece: B,
    lines: [
      'The bishop is a long-range raider confined to a single diagonal colour for its whole life on the board.',
    ],
  },
  {
    title: 'The bishop: movement',
    lines: [
      'It slides diagonally, any number of empty points in one straight line, and stops when it reaches a piece - capturing it if the piece is an enemy.',
    ],
  },
  {
    title: 'The bishop: movement',
    lines: [
      'It can never jump over a piece or leave the diagonal.',
    ],
  },
  {
    title: 'The bishop: promotion',
    lines: [
      'In the promotion zone it may become the Horse, which keeps this full diagonal slide and adds a one-point straight step (see the Horse page).',
    ],
  },
  {
    title: 'The rook',
    piece: R,
    lines: [
      'The rook is the strongest unpromoted piece on the board, ruling any open rank or file.',
    ],
  },
  {
    title: 'The rook: movement',
    lines: [
      'It slides horizontally or vertically, any number of empty points in one straight line.',
    ],
  },
  {
    title: 'The rook: movement',
    lines: [
      'It stops when it reaches a piece, capturing it if the piece is an enemy.',
    ],
  },
  {
    title: 'The rook: movement',
    lines: [
      'It can never jump over a piece.',
    ],
  },
  {
    title: 'The rook: promotion',
    lines: [
      'In the promotion zone it may become the Dragon.',
    ],
  },
  {
    title: 'The rook: promotion',
    lines: [
      'The Dragon keeps this full straight-line slide and adds a one-point diagonal step (see the Dragon page).',
    ],
  },
  {
    title: 'The king',
    piece: K,
    lines: [
      'The king is the piece the whole game is fought over. Lose it and the game ends at once.',
    ],
  },
  {
    title: 'The king: movement',
    lines: [
      'It moves exactly one point in any of the eight directions around it - straight or diagonal.',
    ],
  },
  {
    title: 'The king: no promotion',
    lines: [
      'The king never promotes. Unlike chess, this game has no castling and no other special king move.',
    ],
  },
  {
    title: 'Promotion',
    lines: [
      'A piece promotes only on a move that starts inside, ends inside, or crosses into the promotion zone.',
    ],
  },
  {
    title: 'Promotion',
    lines: [
      'The promotion zone is the far three rows on the standard 9x9 board, or just the single far row on the 5x5 mini board.',
    ],
  },
  {
    title: 'Promotion: which pieces',
    lines: [
      'The pawn, lance, knight, silver general, bishop and rook can promote; the gold general and king never can.',
    ],
  },
  {
    title: 'Promotion: choice and permanence',
    lines: [
      'Promotion is your choice - a Promote/Keep prompt appears whenever it is legal.',
    ],
  },
  {
    title: 'Promotion: choice and permanence',
    lines: [
      'The exception: a piece that would otherwise have no legal move left must promote.',
    ],
  },
  {
    title: 'Promotion: choice and permanence',
    lines: [
      'That means a pawn or lance landing on the very last row, or a knight landing on either of the last two rows.',
    ],
  },
  {
    title: 'Promotion: choice and permanence',
    lines: [
      'Promotion lasts for the rest of that piece\'s life on the board.',
    ],
  },
  {
    title: 'Promotion: choice and permanence',
    lines: [
      'It only reverts if the piece is captured - a captured piece always returns to its owner\'s stand in its original, unpromoted form (see Drops).',
    ],
  },
  {
    title: 'The horse (promoted bishop)',
    piece: 14,
    lines: [],
  },
  {
    title: 'The horse (promoted bishop)',
    lines: [
      'The Horse is a bishop that has promoted, gaining a defender\'s short reach on top of its long diagonal one.',
    ],
  },
  {
    title: 'The horse: movement',
    lines: [
      'It slides diagonally any distance exactly like a bishop, and it can also step exactly one point straight up, down, left or right.',
    ],
  },
  {
    title: 'The horse: movement',
    lines: [
      'It still cannot jump over a piece on its diagonal slides.',
    ],
  },
  {
    title: 'The dragon (promoted rook)',
    piece: 15,
    lines: [
      'The Dragon is a rook that has promoted - the single most powerful piece in the game.',
    ],
  },
  {
    title: 'The dragon: movement',
    lines: [
      'It slides horizontally or vertically any distance exactly like a rook.',
    ],
  },
  {
    title: 'The dragon: movement',
    lines: [
      'It can also step exactly one point diagonally in any of the four diagonal directions.',
    ],
  },
  {
    title: 'The dragon: movement',
    lines: [
      'It still cannot jump over a piece on its straight-line slides.',
    ],
  },
  {
    title: 'Drops',
    lines: [
      'Shogi\'s defining rule: a captured piece is never removed from the game.',
    ],
  },
  {
    title: 'Drops',
    lines: [
      'It changes sides and waits on the capturing player\'s stand.',
    ],
  },
  {
    title: 'Drops',
    lines: [
      'It always reverts to its original, unpromoted form when dropped - even if it was promoted the moment it was captured.',
    ],
  },
  {
    title: 'Drops: how to drop',
    lines: [
      'On your turn, instead of moving a piece already on the board, you may drop a piece from your stand onto any empty point.',
    ],
  },
  {
    title: 'Drops: how to drop',
    lines: [
      'From then on it plays exactly like a piece that had always stood there.',
    ],
  },
  {
    title: 'Drop restrictions',
    lines: [
      'A drop must land on an empty point.',
    ],
  },
  {
    title: 'Drop restrictions',
    lines: [
      'A pawn, lance or knight cannot be dropped where it could never move again.',
    ],
  },
  {
    title: 'Drop restrictions',
    lines: [
      'That means a pawn or lance on the very last row, or a knight on either of the last two rows.',
    ],
  },
  {
    title: 'Drop restrictions',
    lines: [
      'A pawn cannot be dropped into a column that already holds one of your own unpromoted pawns (nifu).',
    ],
  },
  {
    title: 'Drop restrictions',
    lines: [
      'And no drop may ever leave your own king in check.',
    ],
  },
  {
    title: 'Drop restrictions: the pawn drop rule',
    lines: [
      'One more restriction, unique to the pawn: a pawn may never be dropped to deliver checkmate (uchifuzume).',
    ],
  },
  {
    title: 'Drop restrictions: the pawn drop rule',
    lines: [
      'That win must come from a move instead.',
    ],
  },
  {
    title: 'Drop restrictions: the pawn drop rule',
    lines: [
      'Dropping any other piece to give checkmate is completely legal.',
    ],
  },
  {
    title: 'Check and checkmate',
    lines: [
      'Check: a king is in check when an enemy piece attacks its point.',
    ],
  },
  {
    title: 'Check and checkmate',
    lines: [
      'The side in check must immediately play a move or drop that ends it - capture the attacker, block the attacking line, or move the king to safety.',
    ],
  },
  {
    title: 'Check and checkmate',
    lines: [
      'Checkmate: if the side to move is in check with no legal way out, that side is checkmated and loses at once.',
    ],
  },
  {
    title: 'No legal move, and resigning',
    lines: [
      'Unlike chess, having no legal move while NOT in check is not a stalemate draw here - it simply loses the game for the side that cannot move.',
    ],
  },
  {
    title: 'No legal move, and resigning',
    lines: [
      'In practice this almost never happens, since a captured piece can usually be dropped somewhere.',
    ],
  },
  {
    title: 'No legal move, and resigning',
    lines: [
      'You may also resign at any time, conceding the game.',
    ],
  },
  {
    title: 'Draws and other endings',
    lines: [
      'Repetition: if the exact same position - same pieces, same stands, same side to move - occurs four times, the game ends.',
    ],
  },
  {
    title: 'Draws and other endings',
    lines: [
      'If one side gave check on every one of those repeated moves, that side loses (perpetual check); otherwise the game is a plain draw.',
    ],
  },
  {
    title: 'Draws and other endings',
    lines: [
      'This game does not score the historic jishogi "impasse" endgame (both kings reaching the far camp) by material points.',
    ],
  },
  {
    title: 'Draws and other endings',
    lines: [
      'Instead, a game that runs past 400 total moves is simply called a draw.',
    ],
  },
];
