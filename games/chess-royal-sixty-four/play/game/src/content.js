// Text content for the About, Controls (How to Play) and Rules pages. Kept factual and cautiously
// worded; nothing here claims a health benefit or states an unverified date as hard fact (GDD.md).
//
// Every page here is single-concept and kept short on purpose: the text-size stepper (view.js
// renderPage) was raised to a 300% ceiling (text-polish-300 pass), and at that size even one
// average sentence fills most of the reader card. Several of the original sentences (compounds
// joined by " - ", ":" or ";") were split across two or three short pages that together preserve
// the exact same wording and facts - never reworded to be vaguer or to drop a case, only broken at
// an existing pause (a comma, colon, semicolon or dash) the same way earlier passes already split
// long lines across "lines" array entries within one page. Page titles were also shortened so each
// one fits the card on a single unwrapped line at 300% - every title was measured against the
// game's own title font/size (headless Chrome + the view.js wrap/measure code) before being kept.
// A couple of stray "on the next/later page" references were reworded to "later in these Rules"
// since the exact page numbers this refers to shifted when pages were split. See STATUS.md for
// the before/after page counts and the measurement method.
import { PAWN, KNIGHT, BISHOP, ROOK, QUEEN, KING } from './rules.js';

export const ABOUT = [
  { title: 'Two-player game', lines: ['Chess is a two-player strategy game played on a board of sixty-four squares, eight by eight.'] },
  { title: 'Sixteen pieces', lines: ["Each side commands sixteen pieces of six kinds and tries to checkmate the opponent's king."] },
  { title: 'Ancient roots', lines: ['Games historians widely trace an early ancestor of chess to chaturanga,'] },
  { title: 'Circa the 6th century', lines: ['played in India by around the 6th century CE.'] },
  { title: 'Spreading to Persia', lines: ['The game is believed to have spread west into Persia as shatranj,'] },
  { title: 'Reaching Europe', lines: ['and later reached Europe, where its pieces and rules were gradually reshaped over centuries.'] },
  { title: '15th-century Europe', lines: ['By roughly the 15th century in Europe,'] },
  { title: 'Modern character', lines: ['several rules changed to give the game much of its modern character,'] },
  { title: 'Greater range', lines: ['including the queen and bishop moving with far greater range than before.'] },
  { title: 'Standard rules', lines: ['Standardised international rules and organised competitive play followed in later centuries,'] },
  { title: 'FIDE, est. 1924', lines: ['with FIDE, the international chess federation founded in 1924,'] },
  { title: 'Governing today', lines: ['governing the game today.'] },
  { title: 'This version', lines: ['This is a complete implementation of the modern rules:'] },
  { title: 'Every rule, included', lines: ['every piece move, castling both ways, en passant, pawn promotion,'] },
  { title: 'The full rule set', lines: ['check, checkmate, stalemate, and the standard drawing rules.'] },
  { title: 'Free, forever', lines: ['Free to play, forever. No ads, no purchases.'] },
];

// Exhaustive rules reference. Every claim here is cross-checked against the actual implementation
// in rules.js (the single source of truth for legality) so this page can never contradict the
// engine. Single-concept, short-page style (see the file header note above for the 300% pass).
export const RULES = [
  { title: '64 squares', lines: ['Chess is played on a board of 64 squares:'] },
  { title: 'Files and ranks', lines: ['8 files (columns), lettered a to h, and 8 ranks (rows), numbered 1 to 8.'] },
  { title: '16 pieces each', lines: ['Each side starts with 16 pieces -'] },
  { title: 'The starting army', lines: ['8 pawns, 2 rooks, 2 knights, 2 bishops, a queen and a king - filling its own back two ranks.'] },
  { title: 'Starting ranks', lines: ["White's army starts on ranks 1-2, Black's on ranks 7-8."] },

  { title: 'White moves first', lines: ['White always moves first, then the players strictly alternate turns -'] },
  { title: 'One move per turn', lines: ['one move per turn.'] },
  { title: 'Rules vs Controls', lines: ['This page covers the rules only - see Controls for how to move a piece by tap or drag.'] },

  { title: 'The pawn', piece: PAWN, lines: ['The pawn is the foot soldier of the army - most numerous but least powerful,'] },
  { title: 'Advancing the line', lines: ['it advances the front line one square at a time.'] },
  { title: 'Pawn: one square', lines: ['It moves straight ahead one square, except on its very first move,'] },
  { title: 'Pawn: first-move leap', lines: ['when it may advance two squares instead -'] },
  { title: 'Both squares empty', lines: ['only if both squares ahead of it are empty.'] },

  { title: 'Pawn captures', lines: ['It captures one square diagonally forward only.'] },
  { title: 'No straight captures', lines: ['A pawn can never capture straight ahead, and it never moves or captures sideways or backward.'] },
  { title: 'Special pawn rules', lines: ['En passant and promotion are two special pawn rules explained in full later in these Rules.'] },

  { title: 'The knight', piece: KNIGHT, lines: ["The knight is the army's horseman - awkward at range but"] },
  { title: 'Hopping over', lines: ['able to reach squares no other piece can, by hopping clean over everything in its path.'] },
  { title: 'Knight: the L-move', lines: ['It moves in an L shape: two squares along a rank or file, then one square at a right angle to that.'] },
  { title: 'Knight: can jump', lines: ['It is the only piece on the board that can jump over other pieces, friend or foe.'] },

  { title: 'The bishop', piece: BISHOP, lines: ['The bishop is a long-range raider confined to one diagonal colour for its entire life -'] },
  { title: 'Light and dark', lines: ['each side keeps one on the light squares and one on the dark.'] },
  { title: 'Bishop: how far', lines: ['It moves diagonally, any number of empty squares in a single straight line,'] },
  { title: 'Bishop: stopping', lines: ['and stops when it reaches a piece -'] },
  { title: 'Bishop captures', lines: ['capturing it if that piece belongs to the opponent.'] },
  { title: 'Bishop: limits', lines: ['A bishop can never jump over another piece, and it never changes the colour of square it stands on.'] },

  { title: 'The rook', piece: ROOK, lines: ['The rook is a heavy siege piece, most powerful when its file or rank is wide open -'] },
  { title: 'Rook and castling', lines: ['and one of the two pieces involved in castling, a special move covered later in these Rules.'] },
  { title: 'Rook: direction', lines: ['It moves horizontally or vertically,'] },
  { title: 'Rook: how far', lines: ['any number of empty squares in a single straight line, and stops when it reaches a piece -'] },
  { title: 'Rook captures', lines: ['capturing it if that piece belongs to the opponent.'] },
  { title: 'Rook: limits', lines: ['A rook can never jump over another piece.'] },

  { title: 'The queen', piece: QUEEN, lines: ['The queen is the most powerful piece on the board,'] },
  { title: 'Queen: rook + bishop', lines: ['combining the rook and the bishop into one -'] },
  { title: 'Queen: how far', lines: ['any number of empty squares along a rank, a file, or a diagonal, in one straight line.'] },
  { title: 'Queen: limits', lines: ['Like every piece except the knight, the queen can never jump over another piece.'] },

  { title: 'The king', piece: KING, lines: ['The king is the piece the whole game is fought over - not the strongest piece, but'] },
  { title: 'Must never be lost', lines: ['the one that must never be lost.'] },
  { title: 'King: how it moves', lines: ['It moves exactly one square in any direction.'] },

  { title: 'King: staying safe', lines: ['A king may never move to a square attacked by an enemy piece, even to make a capture -'] },
  { title: 'That would be check', lines: ['that would leave it in check, which is not a legal move.'] },
  { title: 'Castling ahead', lines: ['The king has one special two-square move, castling, explained later in these Rules.'] },

  { title: 'Castling', lines: ['Castling moves the king two squares toward one of its own rooks,'] },
  { title: 'The rook jumps too', lines: ['and that rook jumps to the square the king crossed -'] },
  { title: 'Castling: unique move', lines: ["the king's only two-square move, and the only move that moves two of a player's own pieces at once."] },

  { title: 'Castling: king unmoved', lines: ['Castling is legal only when every one of these is true: the king has not yet moved;'] },
  { title: 'Castling: rook unmoved', lines: ['that particular rook has not yet moved;'] },
  { title: 'Castling: clear & safe', lines: ['every square between the king and that rook is empty; the king is not currently in check;'] },
  { title: 'Castling: safe path', lines: ['and the king does not pass through, or land on, a square attacked by the opponent.'] },

  { title: 'Kingside castling', lines: ['Kingside castling (toward the rook on the h-file) and'] },
  { title: 'Queenside castling', lines: ['queenside castling (toward the rook on the a-file) are tracked separately -'] },
  { title: 'Castling rights', lines: ['losing the right to one side does not affect the other.'] },

  { title: 'En passant', lines: ['En passant ("in passing"):'] },
  { title: 'En passant: the setup', lines: ['when an enemy pawn advances two squares on its first move and lands directly beside one of your pawns,'] },
  { title: 'En passant: the capture', lines: ['you may capture it as if it had advanced only one square.'] },
  { title: 'En passant: timing', lines: ['This capture is only legal on your very next move - wait a turn and the chance is gone for good.'] },

  { title: 'Promotion', lines: ['Promotion: the instant a pawn reaches the far rank (rank 8 for White, rank 1 for Black),'] },
  { title: 'Promotion: new piece', lines: ['it is replaced by a queen, rook, bishop or knight of the same colour.'] },
  { title: 'Promotion: your choice', lines: ['The choice is always yours -'] },
  { title: 'Never automatic', lines: ['promotion is never automatic, even though the queen is usually the strongest pick.'] },

  { title: 'Check', lines: ['Check: a king is in check when an enemy piece attacks its square.'] },
  { title: 'Answering check', lines: ['A player in check must immediately play a move that ends the check -'] },
  { title: 'Ways to answer check', lines: ['move the king to safety, block the attacking line, or capture the attacker.'] },
  { title: 'Check: no other move', lines: ['No other move is legal while your king is in check.'] },

  { title: 'Checkmate', lines: ['Checkmate: if the player to move is in check and has no legal move that escapes it,'] },
  { title: 'Checkmate ends it', lines: ['that player is checkmated and the game ends at once - the checkmated side loses.'] },
  { title: 'Stalemate', lines: ['Stalemate: if the player to move is not in check'] },
  { title: 'Stalemate: a draw', lines: ['but has no legal move at all, the game ends immediately as a draw.'] },
  { title: 'Nobody wins', lines: ['Nobody wins a stalemate.'] },

  { title: 'Winning', lines: ["A player wins by checkmating the opponent's king -"] },
  { title: 'Checkmate wins', lines: ["checkmate ends the game immediately, in that player's favour."] },
  { title: 'Resigning', lines: ['A player may also resign at any time, conceding the game to the opponent without playing on.'] },
  { title: 'Every other ending', lines: ['Every other way a game can end is a draw - nobody wins.'] },
  { title: 'Draws follow next', lines: ['The draw rules follow next in these Rules.'] },

  { title: 'Draws: stalemate', lines: ['Stalemate - the player to move has no legal move and is not in check -'] },
  { title: 'Explained earlier', lines: ['is one way a game is drawn, explained earlier in these Rules.'] },
  { title: 'The 50-move rule', lines: ['The 50-move rule: if 50 full moves - 100 half-moves in total -'] },
  { title: '50 moves, no progress', lines: ['pass with no pawn move and no capture by either side, the game is drawn.'] },
  { title: 'Threefold repetition', lines: ['Threefold repetition: if the exact same position -'] },
  { title: 'Same position, thrice', lines: ['same pieces, same player to move, same castling rights, same en passant right -'] },
  { title: 'Repetition: drawn', lines: ['occurs three times in the game, it is drawn.'] },

  { title: 'Insufficient material', lines: ['Insufficient material: neither side has enough force left to ever force checkmate.'] },
  { title: 'Recognised cases', lines: ['Recognised here: king vs king; king and one bishop vs king; king and one knight vs king;'] },
  { title: 'Same-colour bishops', lines: ['and king and bishop vs king and bishop when both bishops travel on the same colour of square.'] },
];

export const HOWTO = [
  { title: 'Tap to select', lines: ['TAP a piece of your colour.'] },
  { title: 'Legal moves light up', lines: ['Its legal destinations light up with soft dots (a ring on a square you can capture on).'] },
  { title: 'Tap to move', lines: ['TAP one of those squares to complete the move.'] },
  { title: 'Drag to move', lines: ['Or DRAG the piece: press and hold, drag it to a destination, and release to drop it there.'] },
  { title: 'Cancel a selection', lines: ['TAP the same piece again, or TAP elsewhere, to cancel your selection.'] },

  { title: 'Castling by tap/drag', lines: ['To castle, TAP or DRAG your king two squares toward the rook you want to castle with -'] },
  { title: 'A familiar convention', lines: ['the same "king moves two squares" convention used by virtually every digital chess board.'] },
  { title: 'The rook follows', lines: ['The rook glides to its own square automatically.'] },
  { title: "Castling: what's needed", lines: ['Castling needs an unmoved king and rook, an empty path between them,'] },
  { title: 'Castling: king safety', lines: ['and a king that is not in check, does not pass through check, and does not land in check.'] },

  { title: 'Promotion picker', lines: ['When a pawn reaches the far rank, a picker appears with four choices:'] },
  { title: 'Four choices', lines: ['Queen, Rook, Bishop and Knight.'] },
  { title: 'Choose a piece', lines: ['TAP the piece you want - promotion is never automatic.'] },

  { title: 'Undo', lines: ["Undo takes back the last move (and the computer's reply, in a computer game)."] },
  { title: 'Hint', lines: ['Hint highlights a good move for you to play,'] },
  { title: 'Hint: how often', lines: ['with a one-line reason, a few times per game.'] },
  { title: 'Flip Board', lines: ['Flip Board rotates the board 180 degrees.'] },
  { title: 'Resign & New Game', lines: ['Resign ends the game; New Game starts over.'] },

  { title: 'Keyboard: cursor', lines: ['Arrow keys move a selection cursor around the board.'] },
  { title: 'Keyboard: pick up', lines: ["Enter or Space picks up the piece on the cursor's square,"] },
  { title: 'Keyboard: complete', lines: ['then Enter or Space again on a destination completes the move.'] },
  { title: 'Keyboard: cancel', lines: ['Escape cancels the current selection, or backs out to the menu.'] },
  { title: 'Keyboard: undo & hint', lines: ['U takes back a move; H asks for a hint.'] },
];
