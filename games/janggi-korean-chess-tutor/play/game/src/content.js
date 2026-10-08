// Words shown in the How to play, Rules and About pages. Facts only, checked against rules.js and engine.js.
// Each entry is a SECTION of the continuous scrolling reader (heading, optional piece portraits, short bullets);
// the reader shows all of them in order (view.js), so there is no page count to keep in sync.
import { GENERAL, GUARD, ELEPHANT, HORSE, CHARIOT, CANNON, SOLDIER, NO_CAPTURE_LIMIT, MIN_PLIES_TO_COUNT } from './rules.js';

export const HOW = [
  { title: 'Start a game', items: [
    'Tap Play as Cho (green, moves first) or Play as Han (red). Then choose your set-up, how your horses and elephants stand, and tap Start.',
    'Cho sets up first. Han chooses after seeing it. The computer picks its own set-up.',
  ] },
  { title: 'Move a piece', items: [
    'TAP one of your pieces. It lifts and the points it can reach glow green. A red glow marks a capture.',
    'Then TAP a glowing point, or DRAG the piece and drop it there. A move that is not allowed bounces back and a message tells you why.',
  ] },
  { title: 'The tutor', items: [
    'The tutor is on by default (the Tutor button in the message panel, and on the menu). When you pick up a piece it explains how that piece moves.',
    'Amber rings warn you about glowing points where the piece could be captured next move. After a move it tells you if you left a piece hanging.',
  ] },
  { title: 'Think (hint)', items: [
    'Think asks the computer for a good move for you. It marks the move in green and explains in words why it is good. You get three per game.',
    'Undo takes back your last move and the reply.',
  ] },
  { title: 'Pass and bikjang', items: [
    'Pass skips your turn. You may pass any time you are not in check. Two passes in a row end the game, and the pieces are counted.',
    'When the two generals face each other (bikjang), the Pass button becomes Call bikjang. Calling it is a draw. Otherwise you must break it.',
  ] },
  { title: 'Learn to play', items: [
    'Learn to play on the menu is a set of hands-on lessons: every piece, check, checkmate, bikjang, passing and counting. Each step waits for you to play the move.',
  ] },
  { title: 'Auto Play (Watch & Learn)', items: [
    'Auto Play is a free demo where both sides play themselves. Before each move it THINKS for a few seconds so you can guess it, then REVEALS the move in green, then plays it.',
    'Use Pause to freeze it any time, and the − / + buttons to set the thinking time from 2 to 10 seconds.',
  ] },
  { title: 'The pieces at a glance', items: [
    'General 楚 / 漢 (0 points): one step along the palace lines. Guard 士 (3): the same.',
    'Chariot 車 (13): any distance, and along palace diagonals. Cannon 包 (7): jumps exactly one piece, even to move.',
    'Horse 馬 (5): one straight, one diagonal; can be hobbled. Elephant 象 (3): one straight, two diagonal; can be blocked.',
    'Soldier 卒 / 兵 (2): one forward or sideways; diagonals in the enemy palace.',
  ] },
  { title: 'Winning', items: [
    'Cho moves first. Attack the enemy general so it cannot escape: that is checkmate and wins.',
    'If nobody can force it, the game ends by passing twice and the pieces are counted. The second player (Han) gets 1.5 extra points.',
  ] },
  { title: 'Keyboard (web)', items: [
    'Arrows move a cursor, Space or Enter taps, U undo, H think, P pass, Escape menu.',
  ] },
];

export const ABOUT = [
  { title: 'Janggi, Korean chess', items: [
    'Janggi (장기, also spelled Changgi) is the chess of Korea, played on a board of 9 files and 10 ranks, on the points where the lines cross.',
    'It shares a distant ancestor with Chinese xiangqi, but plays differently: there is no river, the palace has diagonals, the cannon needs a screen even to move, and you may pass.',
  ] },
  { title: 'Cho and Han', items: [
    'The two armies are named Cho (楚) and Han (漢), after the rival kingdoms of Chu and Han in the Chu-Han contention of ancient China, around 206 to 202 BC. Cho is traditionally green (or blue) and moves first; Han is red.',
  ] },
  { title: 'Octagons of different sizes', items: [
    'Janggi pieces are octagonal, and, unlike in most chess sets, they come in different sizes: the general is the largest tile, then the chariot, cannon, horse, elephant and guard, and the soldier is the smallest.',
    'The characters are the traditional Hanja. Choose Play (English) on the menu for Western letters.',
  ] },
  { title: 'The set-up choice', items: [
    'Before the game each player chooses one of four ways to place the horses and elephants. It is one of the most important decisions in the game, and a big part of what makes Janggi feel different.',
  ] },
  { title: 'About this edition', items: [
    'A Rules page, a lesson for every piece, a tutor that explains moves in plain words, five computer levels, a free Auto Play demo and a Think button. Two board styles, two piece sets, large text and reduced motion. Your game is saved when you leave. No ads, works offline.',
  ] },
];

const P = (title, type, items) => ({ title, type, items });
export const RULES = [
  { title: 'The goal', items: [
    'Janggi is a game for two. Cho (green) and Han (red) each have 16 pieces: 1 general, 2 guards, 2 elephants, 2 horses, 2 chariots, 2 cannons and 5 soldiers.',
    'You win by checkmate: you attack the enemy general (check) and it has no way to escape. You may never leave your own general under attack.',
    'There is no river, and no piece is ever promoted.',
  ] },
  { title: 'The board', items: [
    'The board has 9 vertical lines (files) and 10 horizontal lines (ranks). Pieces stand on the points where lines cross.',
    'Each side has a palace: a 3 by 3 block of points at the back, crossed by two diagonal lines. The diagonals run corner to corner through the centre point.',
    'Cho sits at the bottom of the screen and moves first. Han sits at the top.',
  ] },
  { title: 'Setting up', items: [
    'On the back rank: chariot, then two horse-or-elephant places, guard, an empty point, guard, two more places, and chariot. The general stands in the CENTRE of the palace, one rank in front of the back rank.',
    'The cannons stand on the third rank, on the second file in from each edge. The five soldiers stand on the fourth rank, on every other file.',
    'Each player chooses where the horses (H) and elephants (E) stand on the four places between chariot and guard, from their own left: INNER elephant is H E E H. OUTER elephant is E H H E. LEFT elephant is E H E H. RIGHT elephant is H E H E.',
    'Cho chooses first; Han chooses after seeing it.',
  ] },
  { title: 'Turns', items: [
    'Cho moves first, then the players alternate. On your turn you move one piece, or you pass (see Passing).',
    'You capture by moving a piece onto a point held by an enemy piece, which is removed. You may not capture your own pieces.',
  ] },
  P('The general', GENERAL, [
    'The general moves one step along a line of the palace: forward, backward or sideways, and also along the palace diagonals.',
    'It may never leave the palace. It may capture an enemy piece on a point it can step to, as long as that does not leave it in check.',
    'The general is not counted in the points total.',
  ]),
  P('The guard', GUARD, [
    'Each side has two guards. A guard moves exactly like the general: one step along the palace lines, diagonals included, and never out of the palace.',
    'Worth 3 points.',
  ]),
  P('The chariot', CHARIOT, [
    'The chariot moves any distance in a straight line along a rank or a file, and may capture the first enemy piece on its path. It cannot jump over pieces.',
    'Inside either palace it can also move along the palace diagonals, in as long a run as the lines allow.',
    'Worth 13 points: the strongest piece.',
  ]),
  P('The cannon', CANNON, [
    'The cannon can only move, or capture, by jumping over exactly one piece (its screen), of either colour, along a straight line or a palace diagonal. After the screen it may land on any empty point before the next piece, or capture the first enemy piece beyond.',
    'A cannon cannot move without a screen. It cannot jump over another cannon, and it can never capture a cannon.',
    'Worth 7 points.',
  ]),
  P('The horse', HORSE, [
    'The horse steps one point straight (forward, backward or sideways) and then one point diagonally outward, away from where it started.',
    'If a piece stands on the first (straight) point, the horse is hobbled in that direction and cannot move that way. The horse may land on an empty point or capture.',
    'Worth 5 points.',
  ]),
  P('The elephant', ELEPHANT, [
    'The elephant steps one point straight and then two points diagonally outward: it ends 3 points away along one direction and 2 along the other. Unlike in xiangqi it is not confined to its own half.',
    'It is blocked if a piece stands on the straight point, or on the diagonal point it crosses on the way. It may land on an empty point or capture.',
    'Worth 3 points.',
  ]),
  P('The soldier', SOLDIER, [
    'The soldier steps one point forward or one point sideways, never backward. It captures the same way. It is never promoted.',
    'On the diagonal lines of the ENEMY palace it may also step one point diagonally forward.',
    'Worth 2 points. Cho soldiers are called Byeong and Han soldiers Jol, in Korean.',
  ]),
  { title: 'Palace diagonals', items: [
    'The diagonals exist only inside the two palaces, on the lines from a corner to the centre and on to the opposite corner.',
    'General, guards, chariots and cannons may use them (and soldiers, forward). Horses and elephants do not move along them; their leaps are measured on the ordinary grid.',
  ] },
  { title: 'Check and checkmate', items: [
    'A general that could be captured on the opponent\'s next move is in check. You must answer a check at once: capture the attacker, block its line, or move the general.',
    'You may not make a move that leaves your own general in check.',
    'If you are in check and nothing helps, it is checkmate and you lose. Janggi has no stalemate: a player with no safe move simply passes.',
  ] },
  { title: 'Bikjang (facing generals)', items: [
    'When the two generals stand on the same file with no piece between them, it is called bikjang.',
    'Bikjang is allowed. But the player to move must then break it by blocking with a piece, capturing, or moving the general, or may instead call bikjang, which ends the game as a draw. You may not pass during bikjang.',
    'If the player to move has no way to break it, the game is drawn.',
  ] },
  { title: 'Passing', items: [
    'You may pass on your turn instead of moving, as long as your general is not in check and the generals are not facing each other.',
    `If both players pass in a row, and at least ${MIN_PLIES_TO_COUNT} moves (counting passes) have been played, the game ends and the pieces are counted. Before that, a second pass in a row is not allowed.`,
  ] },
  { title: 'Counting points', items: [
    'Chariot 13, cannon 7, horse 5, elephant 3, guard 3, soldier 2, general 0.',
    'Han, who moves second, adds 1.5 points (so a tie is impossible). Whoever has more points wins.',
    `A game with ${NO_CAPTURE_LIMIT} moves in a row without a capture (passes count as moves) is also settled by counting.`,
  ] },
  { title: 'Other draws', items: [
    'Repetition: if the same position, with the same player to move, occurs three times, the game is drawn.',
    'Bikjang called or unbreakable: a draw (see above).',
  ] },
  { title: 'In this app', items: [
    'The computer plays by exactly these rules, including passing and bikjang. Beginner and Easy make mistakes on purpose; Hard and Master search several moves ahead.',
    'Think (3 per game) suggests a move and explains it. Undo is unlimited. Your game is saved when you leave to the menu.',
    'The rules simplify the official tournament rules in one way: the tournament rules about repeating positions and counting are more detailed; here repetition is a plain draw and counting is automatic.',
  ] },
];
