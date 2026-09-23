// Words shown in the How to play, Rules and About pages. Facts only; see design/GDD.md for how each was chosen.
// Pages are kept to a small number of short bullets each (a "single concept per page" convention) so that
// every page still fits inside the reader-card panel at the top text-size step (300%, see TEXT_SCALES in
// layout.js) without ever shrinking the font to force a fit - a page that grew too tall for its panel at
// that scale was split into two or more shorter pages instead, and long sentences were split by clause into
// their own pages too. Verified by rendering every page at the top step and checking for clipping/overlap
// with the footer buttons.
import { GENERAL, ADVISOR, ELEPHANT, HORSE, CHARIOT, CANNON, SOLDIER } from './rules.js';

export const HOW = [
  { title: 'Tap a piece', items: [
    'TAP one of your pieces. It lifts and the points it can reach glow.',
  ] },
  { title: 'Tap to move there', items: [
    'Then TAP a glowing point to move there. A red ring marks a capture.',
  ] },
  { title: 'Drag to move', items: [
    'Or DRAG the piece and drop it on a glowing point.',
  ] },
  { title: 'Put it down', items: [
    'Tap the piece again, or an empty spot, to put it down.',
  ] },
  { title: 'If a move fails', items: [
    'A move that is not allowed bounces back and a message tells you why.',
  ] },
  { title: 'Undo and hint', items: [
    'Undo takes back your last move and the reply. Hint shows a good move.',
  ] },
  { title: 'Keyboard controls', items: [
    'Keyboard on the web: arrows move the cursor, Space or Enter taps, U undo, H hint, Escape menu.',
  ] },
  { title: 'Auto Play', items: [
    'Auto Play, on the title screen, is a free demo: both sides play themselves, start to finish.',
  ] },
  { title: "Auto Play's rhythm", items: [
    'Before every move it pauses so you can guess it yourself, then highlights the move about to be played.',
  ] },
  { title: 'Setting the pause length', items: [
    'Use the − / + buttons on the Auto Play screen to set the pause from 2 to 10 seconds.',
  ] },
  { title: 'The pieces: General', items: [
    'General 帥 / 將: one step straight, never leaving the palace.',
  ] },
  { title: 'The pieces: Advisor', items: [
    'Advisor 仕 / 士: one step diagonally, inside the palace.',
  ] },
  { title: 'The pieces: Elephant', items: [
    'Elephant 相 / 象: two points diagonally, never over the river. Blocked if a piece is on the point between.',
  ] },
  { title: 'The pieces: Horse', items: [
    'Horse 傌 / 馬: one point straight then one diagonally out. Blocked if a piece is next to it in the first direction.',
  ] },
  { title: 'The pieces: Chariot', items: [
    'Chariot 俥 / 車: any distance along a rank or file.',
  ] },
  { title: 'The pieces: Cannon', items: [
    'Cannon 炮 / 砲: moves like a chariot; captures by jumping over exactly one piece.',
  ] },
  { title: 'The pieces: Soldier', items: [
    'Soldier 兵 / 卒: one step forward; after crossing the river also one step sideways. Never backward.',
  ] },
  { title: 'Winning the game', items: [
    'Red moves first. Attack the enemy general so it cannot escape: that is checkmate and wins.',
  ] },
  { title: 'Answering check', items: [
    'If you are in check you must answer it at once: capture, block or move the general.',
  ] },
  { title: 'No legal move', items: [
    'A side with no legal move loses, even without check (stalemate is a loss here).',
  ] },
  { title: 'Facing kings', items: [
    'The two generals may never face each other on an open file.',
  ] },
  { title: 'Threefold repetition', items: [
    'A position that appears three times: if one side gave check on every move of the cycle it loses; otherwise the game is drawn.',
  ] },
  { title: 'The 60-move rule', items: [
    'Sixty moves each with no capture is a draw. Perpetual chasing (not checking) is not judged in this game.',
  ] },
];
export const ABOUT = [
  { title: 'What is Xiangqi', items: [
    'Xiangqi (象棋) is a two-player strategy game, often called Chinese chess.',
  ] },
  { title: 'Played around the world', items: [
    'It is played in China, in Vietnam and in Chinese communities around the world.',
  ] },
  { title: 'Sixteen pieces each', items: [
    'Red and Black each command sixteen pieces.',
  ] },
  { title: 'What each side has', items: [
    'One general, two advisors, two elephants, two horses, two chariots, two cannons and five soldiers.',
  ] },
  { title: 'The board', items: [
    'Pieces stand on the points where lines cross, on a board of nine files and ten ranks.',
  ] },
  { title: 'The goal', items: [
    'You win by checkmating the enemy general.',
  ] },
  { title: 'The river', items: [
    'A band called the river divides the board.',
  ] },
  { title: 'Chu River, Han Boundary', items: [
    'The words written on it, 楚河 and 漢界, mean Chu River and Han Boundary.',
  ] },
  { title: 'An old story', items: [
    'They are commonly said to recall the struggle between the states of Chu and Han in the third century BCE.',
  ] },
  { title: 'The palace', items: [
    'Each side has a palace: a 3 by 3 area marked with diagonals. The general and the advisors never leave it.',
  ] },
  { title: 'Soldiers cross the river', items: [
    'Soldiers grow stronger when they cross the river: they may then step sideways too.',
  ] },
  { title: 'Not quite chess', items: [
    'There is no queen, no castling and no promotion. A soldier that reaches the far end stays a soldier.',
  ] },
  { title: 'How captures differ', items: [
    'Cannons capture by jumping over exactly one piece. Elephants cannot cross the river. Horses can be blocked.',
  ] },
  { title: 'Facing generals', items: [
    'The two generals may never face each other across an open file.',
  ] },
  { title: 'A living tradition', items: [
    'Historians disagree about the exact origin of the game, and it took its present shape over many centuries.',
  ] },
  { title: 'Played today', items: [
    'Today it is played at home, in parks and in organised tournaments.',
  ] },
];

// Exhaustive rules reference. Every claim here is cross-checked against the actual implementation in
// rules.js (the single source of truth for legality), so this page can never contradict the engine.
// Pages with a `type` show that piece's own real in-game sprite, Red and Black side by side, drawn
// with the same pieces.js drawPiece() the board itself uses - never a separate simplified icon.
export const RULES = [
  { title: 'The board', items: [
    'Xiangqi is played on a grid of 9 files and 10 ranks.',
  ] },
  { title: 'Points, not squares', items: [
    'Pieces stand on the points where the lines cross, not inside the squares.',
  ] },
  { title: 'Setup: sixteen pieces', items: [
    'Each side has 16 pieces: 1 general, 2 advisors, 2 elephants, 2 horses, 2 chariots, 2 cannons and 5 soldiers.',
  ] },
  { title: 'Set out on the back ranks', items: [
    'They are set out on the back ranks.',
  ] },
  { title: 'Red and Black', items: [
    'Red sits at the bottom of the board, Black at the top.',
  ] },
  { title: 'Turn order', items: [
    'Red always moves first, then the two sides strictly alternate turns.',
  ] },
  { title: 'The river', items: [
    'A river runs between the two halves of the board.',
  ] },
  { title: 'The palace', items: [
    'Each side has its own palace: a 3 by 3 area at the back marked with diagonal lines.',
  ] },
  { title: 'See also: Controls', items: [
    '(This page covers the rules only. See Controls for how to move a piece by tap or drag.)',
  ] },
  { title: 'The general', type: GENERAL, items: [
    'The general is the piece the whole game is fought over: the one attack that matters is the one that traps it.',
  ] },
  { title: 'How the general moves', type: GENERAL, items: [
    'It moves exactly one point at a time, straight along a rank or file, never diagonally.',
  ] },
  { title: 'The general: stays in the palace', type: GENERAL, items: [
    'It can never step outside its own palace, the 3 by 3 area at the back of the board.',
  ] },
  { title: 'Never facing, uncovered', type: GENERAL, items: [
    'The two generals may never end up facing each other with nothing between them on an open file.',
  ] },
  { title: 'More on a later page', type: GENERAL, items: [
    'This is the "flying general" rule, covered in full later in this Rules section.',
  ] },
  { title: 'The advisor', type: ADVISOR, items: [
    'The advisor guards the general at close range and never strays from the palace.',
  ] },
  { title: 'How the advisor moves', type: ADVISOR, items: [
    'It moves exactly one point diagonally, along the palace\'s marked lines.',
  ] },
  { title: 'Stays in the palace', type: ADVISOR, items: [
    'It can never leave the palace.',
  ] },
  { title: 'The elephant', type: ELEPHANT, items: [
    'The elephant defends its own half of the board and never helps attack across the river.',
  ] },
  { title: 'How the elephant moves', type: ELEPHANT, items: [
    'It moves exactly two points diagonally, like a leap over the point in between.',
  ] },
  { title: 'The elephant\'s eye', type: ELEPHANT, items: [
    'If a piece stands on that middle point (the elephant\'s "eye"), the elephant is blocked.',
  ] },
  { title: 'A blocked elephant', type: ELEPHANT, items: [
    'A blocked elephant cannot make that move.',
  ] },
  { title: 'Never crosses the river', type: ELEPHANT, items: [
    'It can never cross the river - every move keeps it in its own half of the board.',
  ] },
  { title: 'The horse', type: HORSE, items: [
    'The horse is the army\'s cavalry: awkward at short range but able to reach around a blockade other pieces cannot.',
  ] },
  { title: 'How the horse moves', type: HORSE, items: [
    'It moves one point straight, then one point diagonally outward - an L shape.',
  ] },
  { title: 'The horse\'s leg', type: HORSE, items: [
    'If a piece stands right next to the horse in the direction of its first straight step, that spot is its "leg".',
  ] },
  { title: 'A blocked leg', type: HORSE, items: [
    'A blocked leg means the horse is hobbled and cannot go that way.',
  ] },
  { title: 'The chariot', type: CHARIOT, items: [
    'The chariot is the most powerful piece on the board, especially on an open file or rank.',
  ] },
  { title: 'How the chariot moves', type: CHARIOT, items: [
    'It moves any distance in a straight line along a rank or file, and stops when it reaches a piece.',
  ] },
  { title: 'The chariot captures', type: CHARIOT, items: [
    'It captures that piece if it belongs to the opponent.',
  ] },
  { title: 'The chariot: never jumps', type: CHARIOT, items: [
    'It can never jump over another piece.',
  ] },
  { title: 'The cannon', type: CANNON, items: [
    'The cannon moves like the chariot along a rank or file, but it captures in a completely different way.',
  ] },
  { title: 'Moving without capturing', type: CANNON, items: [
    'Moving without capturing: any distance in a straight line, and it cannot jump over anything.',
  ] },
  { title: 'The cannon captures', type: CANNON, items: [
    'Capturing: it must jump over exactly one piece anywhere along that line.',
  ] },
  { title: 'The "screen"', type: CANNON, items: [
    'That piece (the "screen") can belong to either side.',
  ] },
  { title: 'Landing on the target', type: CANNON, items: [
    'It lands on an enemy piece just beyond the screen.',
  ] },
  { title: 'No screen, no capture', type: CANNON, items: [
    'With no screen to jump, or with more than one piece in the way, the cannon cannot capture on that line.',
  ] },
  { title: 'The soldier', type: SOLDIER, items: [
    'The soldier is the foot soldier of the army: slow, but it grows more useful the further it advances.',
  ] },
  { title: 'Before crossing the river', type: SOLDIER, items: [
    'Before crossing the river it may only step one point straight forward - never sideways, never backward.',
  ] },
  { title: 'After crossing the river', type: SOLDIER, items: [
    'Once it has crossed the river, it may also step one point sideways (still never backward).',
  ] },
  { title: 'Never promotes', type: SOLDIER, items: [
    'A soldier never promotes or turns into another piece, no matter how far it advances.',
  ] },
  { title: 'The flying general', items: [
    'The two generals may never end up directly facing each other along the same file with no piece left between them.',
  ] },
  { title: 'What can uncover it', items: [
    'A move can uncover this: moving a general itself, or moving away a piece that was standing between the two generals.',
  ] },
  { title: 'That move is illegal', items: [
    'If it would leave the two generals facing each other on an open file, the move is illegal - even if it looks fine otherwise.',
  ] },
  { title: 'One shared rule', items: [
    'This one shared rule applies to every piece, not just the generals, since any piece can be the one standing in the way.',
  ] },
  { title: 'Winning the game', items: [
    'A player wins by checkmating the opponent\'s general.',
  ] },
  { title: 'What checkmate means', items: [
    'That means attacking it in a way it cannot escape, block, or capture its way out of.',
  ] },
  { title: 'Responding to check', items: [
    'If your general is in check, you must answer it immediately on your turn.',
  ] },
  { title: 'Capture, block, or move', items: [
    'Capture the attacker, block its line, or move the general to safety.',
  ] },
  { title: 'No other move is legal', items: [
    'No other move is legal while you are in check.',
  ] },
  { title: 'No legal move at all', items: [
    'A side with no legal move at all loses at once, even when it is not in check.',
  ] },
  { title: 'Not a draw here', items: [
    'Unlike Western chess, stalemate is a loss here, not a draw.',
  ] },
  { title: 'Threefold repetition', items: [
    'If the exact same position, with the same side to move, occurs a third time, the game is usually drawn.',
  ] },
  { title: 'The one exception', items: [
    'The one exception: if one side gave check on every single move during that repeating cycle, it is ruled to be checking perpetually.',
  ] },
  { title: 'Perpetual check loses', items: [
    'A side checking perpetually loses at once instead of drawing.',
  ] },
  { title: 'Chasing without checking', items: [
    'Perpetually chasing an undefended piece around, without ever checking, is not specially judged here.',
  ] },
  { title: 'An ordinary draw', items: [
    'It simply plays out as an ordinary draw by repetition.',
  ] },
  { title: 'The 60-move rule', items: [
    'Sixty full moves for each side is a hundred and twenty single moves in a row.',
  ] },
  { title: 'A draw with no captures', items: [
    'If neither player captures anything in that span, the game is drawn.',
  ] },
];
