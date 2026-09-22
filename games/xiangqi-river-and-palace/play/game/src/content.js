// Words shown in the How to play, Rules and About pages. Facts only; see design/GDD.md for how each was chosen.
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
