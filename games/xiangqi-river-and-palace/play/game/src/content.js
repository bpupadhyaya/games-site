// Words shown in the How to play, Rules and About pages. Facts only; see design/GDD.md for how each was chosen.
import { GENERAL, ADVISOR, ELEPHANT, HORSE, CHARIOT, CANNON, SOLDIER } from './rules.js';

export const HOW = [
  { title: 'Controls', items: [
    'TAP one of your pieces. It lifts and the points it can reach glow.',
    'Then TAP a glowing point to move there. A red ring marks a capture.',
    'Or DRAG the piece and drop it on a glowing point.',
    'Tap the piece again, or an empty spot, to put it down.',
    'A move that is not allowed bounces back and a message tells you why.',
    'Undo takes back your last move and the reply. Hint shows a good move.',
    'Keyboard on the web: arrows move the cursor, Space or Enter taps, U undo, H hint, Escape menu.',
  ] },
  { title: 'The pieces', items: [
    'General 帥 / 將: one step straight, never leaving the palace.',
    'Advisor 仕 / 士: one step diagonally, inside the palace.',
    'Elephant 相 / 象: two points diagonally, never over the river. Blocked if a piece is on the point between.',
    'Horse 傌 / 馬: one point straight then one diagonally out. Blocked if a piece is next to it in the first direction.',
    'Chariot 俥 / 車: any distance along a rank or file.',
    'Cannon 炮 / 砲: moves like a chariot; captures by jumping over exactly one piece.',
    'Soldier 兵 / 卒: one step forward; after crossing the river also one step sideways. Never backward.',
  ] },
  { title: 'Winning', items: [
    'Red moves first. Attack the enemy general so it cannot escape: that is checkmate and wins.',
    'If you are in check you must answer it at once: capture, block or move the general.',
    'A side with no legal move loses, even without check (stalemate is a loss here).',
    'The two generals may never face each other on an open file.',
    'A position that appears three times: if one side gave check on every move of the cycle it loses; otherwise the game is drawn.',
    'Sixty moves each with no capture is a draw. Perpetual chasing (not checking) is not judged in this game.',
  ] },
];
export const ABOUT = [
  { title: 'Xiangqi', items: [
    'Xiangqi (象棋) is a two-player strategy game, often called Chinese chess. It is played in China, in Vietnam and in Chinese communities around the world.',
    'Red and Black each command sixteen pieces: one general, two advisors, two elephants, two horses, two chariots, two cannons and five soldiers.',
    'Pieces stand on the points where lines cross, on a board of nine files and ten ranks. You win by checkmating the enemy general.',
  ] },
  { title: 'The river and the palace', items: [
    'A band called the river divides the board. The words written on it, 楚河 and 漢界, mean Chu River and Han Boundary, and are commonly said to recall the struggle between the states of Chu and Han in the third century BCE.',
    'Each side has a palace: a 3 by 3 area marked with diagonals. The general and the advisors never leave it.',
    'Soldiers grow stronger when they cross the river: they may then step sideways too.',
  ] },
  { title: 'Not quite chess', items: [
    'There is no queen, no castling and no promotion. A soldier that reaches the far end stays a soldier.',
    'Cannons capture by jumping over exactly one piece. Elephants cannot cross the river. Horses can be blocked.',
    'The two generals may never face each other across an open file.',
    'Historians disagree about the exact origin of the game, and it took its present shape over many centuries. Today it is played at home, in parks and in organised tournaments.',
  ] },
];

// Exhaustive rules reference. Every claim here is cross-checked against the actual implementation in
// rules.js (the single source of truth for legality), so this page can never contradict the engine.
// Pages with a `type` show that piece's own real in-game sprite, Red and Black side by side, drawn
// with the same pieces.js drawPiece() the board itself uses - never a separate simplified icon.
export const RULES = [
  { title: 'The board and setup', items: [
    'Xiangqi is played on a grid of 9 files and 10 ranks. Pieces stand on the points where the lines cross, not inside the squares.',
    'Each side has 16 pieces: 1 general, 2 advisors, 2 elephants, 2 horses, 2 chariots, 2 cannons and 5 soldiers, set out on the back ranks.',
    'Red sits at the bottom of the board, Black at the top. Red always moves first, then the two sides strictly alternate turns.',
    'A river runs between the two halves of the board, and each side has its own palace: a 3 by 3 area at the back marked with diagonal lines.',
    '(This page covers the rules only. See Controls for how to move a piece by tap or drag.)',
  ] },
  { title: 'The general', type: GENERAL, items: [
    'The general is the piece the whole game is fought over: the one attack that matters is the one that traps it.',
    'It moves exactly one point at a time, straight along a rank or file, never diagonally.',
    'It can never step outside its own palace, the 3 by 3 area at the back of the board.',
    'The two generals may never end up facing each other with nothing between them on an open file - the "flying general" rule, on a later page.',
  ] },
  { title: 'The advisor', type: ADVISOR, items: [
    'The advisor guards the general at close range and never strays from the palace.',
    'It moves exactly one point diagonally, along the palace\'s marked lines, and can never leave the palace.',
  ] },
  { title: 'The elephant', type: ELEPHANT, items: [
    'The elephant defends its own half of the board and never helps attack across the river.',
    'It moves exactly two points diagonally, like a leap over the point in between.',
    'If a piece stands on that middle point (the elephant\'s "eye"), the elephant is blocked and cannot make that move.',
    'It can never cross the river - every move keeps it in its own half of the board.',
  ] },
  { title: 'The horse', type: HORSE, items: [
    'The horse is the army\'s cavalry: awkward at short range but able to reach around a blockade other pieces cannot.',
    'It moves one point straight, then one point diagonally outward - an L shape.',
    'If a piece stands right next to it in the direction of that first straight step (its "leg"), the horse is hobbled and cannot go that way.',
  ] },
  { title: 'The chariot', type: CHARIOT, items: [
    'The chariot is the most powerful piece on the board, especially on an open file or rank.',
    'It moves any distance in a straight line along a rank or file, and stops when it reaches a piece - capturing it if that piece belongs to the opponent.',
    'It can never jump over another piece.',
  ] },
  { title: 'The cannon', type: CANNON, items: [
    'The cannon moves like the chariot along a rank or file, but it captures in a completely different way.',
    'Moving without capturing: any distance in a straight line, and it cannot jump over anything.',
    'Capturing: it must jump over exactly one piece anywhere along that line (the "screen" - it can belong to either side) and land on an enemy piece just beyond it.',
    'With no screen to jump, or with more than one piece in the way, the cannon cannot capture on that line.',
  ] },
  { title: 'The soldier', type: SOLDIER, items: [
    'The soldier is the foot soldier of the army: slow, but it grows more useful the further it advances.',
    'Before crossing the river it may only step one point straight forward - never sideways, never backward.',
    'Once it has crossed the river, it may also step one point sideways (still never backward).',
    'A soldier never promotes or turns into another piece, no matter how far it advances.',
  ] },
  { title: 'The flying general', items: [
    'The two generals may never end up directly facing each other along the same file with no piece left between them.',
    'If a move - moving a general itself, or moving away a piece that was standing between them - would leave the two generals facing each other on an open file, that move is illegal, even if it looks fine otherwise.',
    'This one shared rule applies to every piece, not just the generals, since any piece can be the one standing in the way.',
  ] },
  { title: 'Winning the game', items: [
    'A player wins by checkmating the opponent\'s general: attacking it in a way it cannot escape, block or capture its way out of.',
    'If your general is in check, you must answer it immediately on your turn - capture the attacker, block its line, or move the general to safety. No other move is legal while you are in check.',
    'A side with no legal move at all loses at once, even when it is not in check. Unlike Western chess, stalemate is a loss here, not a draw.',
  ] },
  { title: 'Draws, and other endings', items: [
    'If the exact same position, with the same side to move, occurs a third time, the game is usually drawn.',
    'The one exception: if one side gave check on every single move during that repeating cycle, that side is ruled to be checking perpetually and loses at once instead of drawing.',
    'Perpetually chasing an undefended piece around (without ever checking) is not specially judged here - it simply plays out as an ordinary threefold-repetition draw.',
    'If sixty full moves pass for each side - a hundred and twenty single moves in a row - with no capture by either player, the game is drawn.',
  ] },
];
