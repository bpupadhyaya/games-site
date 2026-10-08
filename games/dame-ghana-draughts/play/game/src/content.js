// The words of the game: the Rules reference, How to Play and About. Every rule below is the rule engine.js plays by;
// the "Rules and engine" check in the headless test replays the diagrams against the engine so the page cannot drift.
//
// A diagram is { n, pcs: [[row, col, side, king]], from, path, caps, dots, label } on a small n x n board (row 0 = top, side 1 = the
// side that starts at the bottom). The reader draws it with the game's own pieces.
export const DIAGRAMS = {
  step: { n: 6, pcs: [[4, 1, 1, 0]], dots: [[3, 0], [3, 2]], label: 'A man steps one square diagonally forward.' },
  take: { n: 6, pcs: [[4, 1, 1, 0], [3, 2, -1, 0]], from: [4, 1], path: [[2, 3]], caps: [[3, 2]], label: 'Jump over the neighbour to the empty square behind it.' },
  back: { n: 6, pcs: [[2, 1, 1, 0], [3, 2, -1, 0]], from: [2, 1], path: [[4, 3]], caps: [[3, 2]], label: 'Men may also capture backwards.' },
  chain: { n: 6, pcs: [[5, 2, 1, 0], [4, 3, -1, 0], [2, 3, -1, 0]], from: [5, 2], path: [[3, 4], [1, 2]], caps: [[4, 3], [2, 3]], label: 'A chain: keep jumping, turning as you like.' },
  crown: { n: 6, pcs: [[1, 2, 1, 0]], dots: [[0, 1], [0, 3]], label: 'Reach the far row to be crowned.' },
  fly: { n: 6, pcs: [[5, 0, 1, 1], [3, 2, -1, 0]], from: [5, 0], path: [[1, 4]], caps: [[3, 2]], dots: [[2, 3], [1, 4], [0, 5]], label: 'A king flies from afar and lands on any empty square behind.' },
};

export const RULES = [
  { title: 'The board', lines: [
    'Dame is played on the dark squares only. In Ghanaian Damii the board is 10 by 10; the school board is 8 by 8.',
    'Set the board so a dark square is at each player\'s bottom-left corner.',
  ] },
  { title: 'The pieces', lines: [
    'Damii: 20 pieces each, filling the first four rows. 8 x 8: 12 pieces each, filling the first three rows.',
    'The first side (Gold with bottle caps, Light with carved wood) moves first.',
  ] },
  { title: 'Moving a man', diagram: 'step', lines: [
    'A man moves one square diagonally forward onto an empty dark square.',
    'A man never steps backwards or sideways. It only goes backwards when capturing.',
  ] },
  { title: 'Capturing', diagram: 'take', lines: [
    'Jump over an enemy piece next to you onto the empty square directly behind it. The piece you jumped is taken.',
    'Capturing is compulsory: if you can capture, you must.',
  ] },
  { title: 'Backward captures', diagram: 'back', lines: [
    'Unlike many draughts games, men capture backwards as well as forwards.',
  ] },
  { title: 'Chains', diagram: 'chain', lines: [
    'If your piece can jump again from where it landed, it must keep going. You may change direction between jumps.',
    'You cannot jump the same piece twice. Jumped pieces stay on the board until your move ends, so they still block the way.',
    'You must finish the chain you start, but you may start any chain you like.',
  ] },
  { title: 'Free choice of captures', lines: [
    'West African play does not force the longest capture. If several captures are open, choose any of them.',
    'A setting lets you turn on the majority rule (take the most pieces) for practice.',
  ] },
  { title: 'Becoming a king', diagram: 'crown', lines: [
    'A man that ends its move on the far row is crowned: it becomes a king, shown as two stacked pieces with a crown.',
    'If a man reaches the far row in the middle of a chain and can still jump, it carries on as a man. It is crowned only if its move ends there.',
  ] },
  { title: 'The flying king', diagram: 'fly', lines: [
    'A king moves any distance along a diagonal over empty squares, forwards or backwards.',
    'To capture, a king jumps one enemy piece from any distance, as long as the squares between are empty, and may land on any empty square behind it.',
    'A king may stop on any landing square, even if another landing would let it jump again. A king cannot jump two pieces standing side by side, and cannot jump its own side.',
  ] },
  { title: 'Winning', lines: [
    'You win by capturing every enemy piece, or by leaving the enemy with no legal move.',
    'In Ghanaian Damii a side left with a single piece, man or king, has lost at once. Think twice before trading down to your last pieces. This rule is a setting; it is on for Damii and off for the 8 x 8 board.',
  ] },
  { title: 'Drawn games', lines: [
    'A game is drawn after 25 moves each with no capture and no man moved, or when the same position appears for the third time.',
  ] },
  { title: 'Overlooked captures', lines: [
    'In club play an overlooked capture can cost a king. In this game the board only lets you make a legal move, so a capture can never be overlooked: a piece that can capture glows when you must capture.',
  ] },
  { title: 'Regional variants', lines: [
    'Draughts is played all over West and East Africa with local customs: board size, who moves first and how captures are chosen vary from town to town.',
    'This game offers Ghanaian Damii (10 x 10) and the 8 x 8 school board. The Settings page lets you switch the last-piece rule and the majority rule to match the version you grew up with.',
  ] },
];

export const HOWTO = [
  { title: 'Start a game', lines: [
    'On the menu pick the board (Damii 10 x 10 or Dame 8 x 8), the computer\'s level and the side you play, then tap Play.',
    'Your side starts at the bottom of the screen. Gold or Light moves first.',
  ] },
  { title: 'Make a move', diagram: 'step', lines: [
    'Tap one of your pieces. It lifts, and the squares it can reach glow. Tap a glowing square to move there.',
    'Tap the piece again, or a different piece of yours, to change your mind.',
  ] },
  { title: 'Capturing', diagram: 'chain', lines: [
    'When you can capture, you must. Pieces that can capture pulse, and only they can be picked up.',
    'For a chain, tap each landing square in turn. When only one chain is left, the piece plays it for you.',
  ] },
  { title: 'Hints and take back', lines: [
    'Hint shows a good move and says why it is good. Take back undoes your last move and the reply.',
    'Hints never cost anything. The computer levels are Easy, Medium, Hard and Master.',
  ] },
  { title: 'Watch and Learn', lines: [
    'Auto Play lets the computer play both sides. It thinks, shows the move it chose, and then plays it.',
    'Pause freezes everything. Use the think-time buttons to slow it down or speed it up.',
  ] },
  { title: 'Settings', lines: [
    'Change the board wood, the pieces, sound, reduced motion and the rule switches. Text size works on all reading pages.',
  ] },
];

export const ABOUT = [
  { title: 'Dame: West African Draughts', art: 'hero', lines: [
    'Dame, called Damii in Ghana, is draughts as it is played across West Africa: flying kings, men that capture backwards, and a sharp, fast game.',
  ] },
  { title: 'Played everywhere', art: 'caps', lines: [
    'On pavements, under shade trees and at market stalls, often with bottle caps for pieces and a board scratched or painted on wood.',
    'Anything can be a piece, so long as everyone can tell the two sides apart.',
  ] },
  { title: 'Men capture backwards', diagram: 'back', lines: [
    'A man may jump an enemy piece in any direction, so a piece is never safe just because it is behind you.',
  ] },
  { title: 'Kings that fly', diagram: 'fly', lines: [
    'A king moves along a whole diagonal and, when it captures, may land on any empty square behind the piece it takes.',
    'In Ghanaian Damii a side left with one piece has lost, so every trade counts.',
  ] },
  { title: 'Boards and pieces', art: 'sets', lines: [
    'Play on a teak or an ebony board with a woven border, with gold and red bottle caps or light and dark turned wood.',
    'The woven border is an original pattern in the spirit of strip-woven cloth.',
  ] },
  { title: 'This version', lines: [
    'Ghanaian Damii on the 10 x 10 board and the 8 x 8 school board, four computer levels, hints that say why, Watch and Learn, and a full rules reference with diagrams.',
  ] },
  { title: 'Credits', art: 'lockup', lines: [
    'Made by Arcforge: World Heritage Games.',
    'Titles are set in Cormorant Garamond, used under the SIL Open Font License 1.1.',
    'All sounds are synthesised on your device. The game works fully offline.',
  ] },
];
