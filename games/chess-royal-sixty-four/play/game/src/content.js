// Text content for the About, Controls (How to Play) and Rules pages. Kept factual and cautiously
// worded; nothing here claims a health benefit or states an unverified date as hard fact (GDD.md).
import { PAWN, KNIGHT, BISHOP, ROOK, QUEEN, KING } from './rules.js';

export const ABOUT = [
  {
    title: 'Sixty-four squares, two armies',
    lines: [
      'Chess is a two-player strategy game played on a board of sixty-four squares, eight by eight,',
      'in which each side commands sixteen pieces of six kinds and tries to checkmate the opponent\'s king.',
    ],
  },
  {
    title: 'A very old game',
    lines: [
      'Games historians widely trace an early ancestor of chess to chaturanga, played in India by',
      'around the 6th century CE. The game is believed to have spread west into Persia as shatranj,',
      'and later reached Europe, where its pieces and rules were gradually reshaped over centuries.',
    ],
  },
  {
    title: 'Becoming the modern game',
    lines: [
      'By roughly the 15th century in Europe, several rules changed to give the game much of its',
      'modern character, including the queen and bishop moving with far greater range than before.',
      'Standardised international rules and organised competitive play followed in later centuries,',
      'with FIDE, the international chess federation founded in 1924, governing the game today.',
    ],
  },
  {
    title: 'This version',
    lines: [
      'This is a complete implementation of the modern rules: every piece move, castling both ways,',
      'en passant, pawn promotion, check, checkmate, stalemate, and the standard drawing rules.',
      'Free to play, forever. No ads, no purchases.',
    ],
  },
];

// Exhaustive rules reference. Every claim here is cross-checked against the actual implementation
// in rules.js (the single source of truth for legality) so this page can never contradict the
// engine. Kept short-paragraph/bullet style like ABOUT/HOWTO above, not a wall of text.
export const RULES = [
  {
    title: 'The board and setup',
    lines: [
      'Chess is played on a board of 64 squares: 8 files (columns), lettered a to h, and 8 ranks',
      '(rows), numbered 1 to 8.',
      'Each side starts with 16 pieces - 8 pawns, 2 rooks, 2 knights, 2 bishops, a queen and a king -',
      'filling its own back two ranks. White\'s army starts on ranks 1-2, Black\'s on ranks 7-8.',
      'White always moves first, then the players strictly alternate turns - one move per turn.',
      '(This page covers the rules only. See Controls for how to move a piece by tap or drag.)',
    ],
  },
  {
    title: 'The pawn',
    piece: PAWN,
    lines: [
      'The pawn is the foot soldier of the army - most numerous but least powerful, it advances',
      'the front line one square at a time.',
      'It moves straight ahead one square, except on its very first move, when it may advance two',
      'squares instead - only if both squares ahead of it are empty.',
      'It captures one square diagonally forward only. A pawn can never capture straight ahead,',
      'and it never moves or captures sideways or backward.',
      'En passant and promotion are two special pawn rules explained in full on later pages.',
    ],
  },
  {
    title: 'The knight',
    piece: KNIGHT,
    lines: [
      'The knight is the army\'s horseman - awkward at range but able to reach squares no other',
      'piece can, by hopping clean over everything in its path.',
      'It moves in an L shape: two squares along a rank or file, then one square at a right angle',
      'to that. It is the only piece on the board that can jump over other pieces, friend or foe.',
    ],
  },
  {
    title: 'The bishop',
    piece: BISHOP,
    lines: [
      'The bishop is a long-range raider confined to one diagonal colour for its entire life -',
      'each side keeps one on the light squares and one on the dark.',
      'It moves diagonally, any number of empty squares in a single straight line, and stops when',
      'it reaches a piece - capturing it if that piece belongs to the opponent.',
      'A bishop can never jump over another piece, and it never changes the colour of square it',
      'stands on.',
    ],
  },
  {
    title: 'The rook',
    piece: ROOK,
    lines: [
      'The rook is a heavy siege piece, most powerful when its file or rank is wide open - and one',
      'of the two pieces involved in castling, a special move covered on a later page.',
      'It moves horizontally or vertically, any number of empty squares in a single straight line,',
      'and stops when it reaches a piece - capturing it if that piece belongs to the opponent.',
      'A rook can never jump over another piece.',
    ],
  },
  {
    title: 'The queen',
    piece: QUEEN,
    lines: [
      'The queen is the most powerful piece on the board, combining the rook and the bishop into',
      'one - any number of empty squares along a rank, a file, or a diagonal, in one straight line.',
      'Like every piece except the knight, the queen can never jump over another piece.',
    ],
  },
  {
    title: 'The king',
    piece: KING,
    lines: [
      'The king is the piece the whole game is fought over - not the strongest piece, but the one',
      'that must never be lost. It moves exactly one square in any direction.',
      'A king may never move to a square attacked by an enemy piece, even to make a capture - that',
      'would leave it in check, which is not a legal move.',
      'The king has one special two-square move, castling, explained on the next page.',
    ],
  },
  {
    title: 'Castling',
    lines: [
      'Castling moves the king two squares toward one of its own rooks, and that rook jumps to the',
      'square the king crossed - the king\'s only two-square move, and the only move that moves two',
      'of a player\'s own pieces at once.',
      'It is legal only when every one of these is true: the king has not yet moved; that particular',
      'rook has not yet moved; every square between the king and that rook is empty; the king is not',
      'currently in check; and the king does not pass through, or land on, a square attacked by the',
      'opponent.',
      'Kingside castling (toward the rook on the h-file) and queenside castling (toward the rook on',
      'the a-file) are tracked separately - losing the right to one side does not affect the other.',
    ],
  },
  {
    title: 'En passant and promotion',
    lines: [
      'En passant ("in passing"): when an enemy pawn advances two squares on its first move and',
      'lands directly beside one of your pawns, you may capture it as if it had advanced only one',
      'square. This capture is only legal on your very next move - wait a turn and the chance is',
      'gone for good.',
      'Promotion: the instant a pawn reaches the far rank (rank 8 for White, rank 1 for Black), it',
      'is replaced by a queen, rook, bishop or knight of the same colour. The choice is always',
      'yours - promotion is never automatic, even though the queen is usually the strongest pick.',
    ],
  },
  {
    title: 'Check, checkmate, stalemate',
    lines: [
      'Check: a king is in check when an enemy piece attacks its square. A player in check must',
      'immediately play a move that ends the check - move the king to safety, block the attacking',
      'line, or capture the attacker. No other move is legal while your king is in check.',
      'Checkmate: if the player to move is in check and has no legal move that escapes it, that',
      'player is checkmated and the game ends at once - the checkmated side loses.',
      'Stalemate: if the player to move is not in check but has no legal move at all, the game ends',
      'immediately as a draw. Nobody wins a stalemate.',
    ],
  },
  {
    title: 'Winning the game',
    lines: [
      'A player wins by checkmating the opponent\'s king - checkmate ends the game immediately,',
      'in that player\'s favour (see the previous page).',
      'A player may also resign at any time, conceding the game to the opponent without playing on.',
      'Every other way a game can end is a draw - nobody wins. The draw rules are on the next page.',
    ],
  },
  {
    title: 'Draws',
    lines: [
      'Stalemate: the player to move has no legal move and is not in check (previous page) - drawn.',
      'The 50-move rule: if 50 full moves - 100 half-moves in total - pass with no pawn move and',
      'no capture by either side, the game is drawn.',
      'Threefold repetition: if the exact same position - same pieces, same player to move, same',
      'castling rights, same en passant right - occurs three times in the game, it is drawn.',
      'Insufficient material: neither side has enough force left to ever force checkmate.',
      'Recognised here: king vs king; king and one bishop vs king; king and one knight vs king;',
      'and king and bishop vs king and bishop when both bishops travel on the same colour of square.',
    ],
  },
];

export const HOWTO = [
  {
    title: 'Moving a piece',
    lines: [
      'TAP a piece of your colour. Its legal destinations light up with soft dots (a ring on a',
      'square you can capture on). TAP one of those squares to complete the move.',
      'Or DRAG the piece: press and hold, drag it to a destination, and release to drop it there.',
      'TAP the same piece again, or TAP elsewhere, to cancel your selection.',
    ],
  },
  {
    title: 'Castling',
    lines: [
      'To castle, TAP or DRAG your king two squares toward the rook you want to castle with — the',
      'same "king moves two squares" convention used by virtually every digital chess board.',
      'The rook glides to its square automatically. Castling needs an unmoved king and rook, an',
      'empty path between them, and a king that is not in check, does not pass through check, and',
      'does not land in check.',
    ],
  },
  {
    title: 'Pawn promotion',
    lines: [
      'When a pawn reaches the far rank, a picker appears with four choices: Queen, Rook, Bishop',
      'and Knight. TAP the piece you want — promotion is never automatic.',
    ],
  },
  {
    title: 'Game controls',
    lines: [
      'Undo takes back the last move (and the computer\'s reply, in a computer game).',
      'Hint highlights a good move for you to play, with a one-line reason, a few times per game.',
      'Flip Board rotates the board 180 degrees. Resign ends the game; New Game starts over.',
    ],
  },
  {
    title: 'Keyboard (desktop)',
    lines: [
      'Arrow keys move a selection cursor around the board. Enter or Space picks up the piece on',
      'the cursor\'s square, then Enter or Space again on a destination completes the move.',
      'Escape cancels the current selection, or backs out to the menu.',
      'U takes back a move; H asks for a hint.',
    ],
  },
];
