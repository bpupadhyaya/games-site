// All player-facing text (English). Counts come from the engine's own tables so the Rules pages cannot drift from it.
// Perfect-play results quoted below were checked by running the solver (solver.js) over every position of each mode.
import { SPECS } from './rules.js';

export const STR = {
  playBtn: 'Play', continueBtn: 'Continue game', learnBtn: 'Learn', autoBtn: 'Watch & Learn', howtoBtn: 'How to Play', rulesBtn: 'Rules', aboutBtn: 'About',
  settingsBtn: 'Settings', back: 'Back', next: 'Next', prev: 'Previous', think: 'Think', undo: 'Undo', restart: 'Restart', resume: 'Resume', paused: 'Paused',
  quitMenu: 'Main Menu', soundOn: 'Sound: On', soundOff: 'Sound: Off', thinkTime: 'Watch & Learn think time', seconds: 's',
  restore: 'Restore Purchases', unlock: 'Unlock Full Game', resetProgress: 'Erase Records and Progress', resetConfirm: 'Tap again to erase everything',
  owned: 'Full game unlocked. Thank you!', theme: 'Board and pieces', startGame: 'Start game', modeTitle: 'Game mode', opponentTitle: 'Opponent', sideTitle: 'Your side',
  playX: 'Play X (first)', playO: 'Play O (second)', twoPlayers: 'Two players', youWord: 'You', vsComputer: 'vs computer',
  autoThink: 'Thinking', autoReveal: 'The move', autoDone: 'Game over', autoPause: 'Pause', autoPlay: 'Resume', autoExit: 'Exit', autoSlower: 'Think -', autoFaster: 'Think +',
  autoSession: 'Watch & Learn', autoAgain: 'Watch Again',
  autoSummary: 'You watched three whole games, each move chosen by the game\'s own solver with its reason shown: a perfect draw, a Roman slide game and a Misère game.',
  demoLimitTitle: 'FREE PREVIEW FINISHED', demoLimitBody: 'You played the three free games. Get the full game on iPhone and Android for all four modes, every opponent level, two players on one phone and the full tutor.',
  demoLeft: '{n} free games left', tagline: 'Three in a row, made deep.', record: 'Record', wins: 'W', draws: 'D', losses: 'L',
  yourMove: 'Your move', thinking: 'Thinking...', xTurn: 'X to move', oTurn: 'O to move', pickPiece: 'Pick one of your pieces to slide', pickTarget: 'Now pick where it slides to',
  lessonsTitle: 'Learn', lessonDone: 'Done', again: 'Play Again', newSetup: 'Change Game', rematch: 'Rematch', lessonNext: 'Next Lesson', lessonRetry: 'Try Again', lessonList: 'All Lessons',
  textSize: 'Text size', tryAgainMsg: 'That square is not available', locked: 'In the full game',
};
export const tr = (key, vars) => {
  let s = STR[key] ?? key;
  if (vars) for (const k of Object.keys(vars)) s = s.replace(`{${k}}`, vars[k]);
  return s;
};

const N4 = SPECS.quad.lines.length;

export const HOWTO = [
  { title: 'The goal', art: 'goal', body: 'Take turns with your opponent putting your mark on the board. X always goes first. Be the first to get three in a row, in any direction, and you win. A full board with no line is a draw.' },
  { title: 'Making a move', art: 'tap', body: 'Tap an empty square to place your mark. The mark drops in with a soft thud and the opponent answers. Press and hold a square to preview where your mark will land.' },
  { title: 'Modes', art: 'modes', body: 'Classic 3x3 is the game everyone knows. Terni Lapilli is the Roman version: three pieces each, then you slide them. Misère turns the goal upside down: three in a row loses. Quad plays on 4x4 where a line of four or a 2x2 square wins.' },
  { title: 'Sliding pieces', art: 'slide', body: 'In Terni Lapilli, after all six pieces are down, tap one of your pieces, then tap an empty neighbouring point on the line to slide it there. Diagonals count. Tap the piece again to put it back.' },
  { title: 'Think', art: 'think', body: 'Not sure what to do? Think shows the best move and says why in plain English: "this blocks a fork", "this wins". It is free and works from any position.' },
  { title: 'Opponents', art: 'levels', body: 'Choose Beginner to Perfect, or play two players on one phone. The lower levels play like people and make mistakes. Perfect is a solver that checks every possible game and never slips.' },
  { title: 'Learn', art: 'learn', body: 'Learn is a short course: finish a line, block, make a fork, stop a fork, open well, and see why perfect play is a draw. Watch & Learn plays whole games for you, explaining each move, with a Pause button.' },
];

export const RULES = [
  { title: 'The game', art: 'goal', body: [
    'Two players, X and O, take turns marking points on a small board. X always moves first. Get your marks in a straight line before your opponent does.',
    'The game comes in four modes: Classic 3x3, Terni Lapilli, Misère and Quad 4x4. Each has its own page below. In all four, a win or a draw ends the game at once.',
  ] },
  { title: 'Classic 3x3', art: 'classic', body: [
    'The board has nine squares in three rows of three. On your turn you place one mark of yours (X or O) on any empty square. Marks never move or disappear once placed.',
    'You win by being the first to have three of your marks in a row. If all nine squares are full and nobody has three in a row, the game is a draw.',
  ] },
  { title: 'Winning lines', art: 'lines8', body: [
    'In Classic, Terni Lapilli and Misère there are exactly eight lines of three: the three rows, the three columns and the two diagonals. The centre lies on four of them, each corner on three and each edge square on two.',
    'That is why the centre is the strongest point to take and a corner is the next best, and why an edge is the weakest first move.',
  ] },
  { title: 'Making a move', art: 'tap', body: [
    'Tap an empty square. Press and hold a square and a faint preview of your mark appears; let go on the same square to place it, or slide your finger away to cancel. Tapping a taken square places nothing and flashes that square red; a tap when it is not your turn does nothing.',
    'On a keyboard use the arrow keys and Enter or Space, the digits 1 to 9 on the 3x3 boards, U for Undo, T for Think, R for Restart and Escape or P to pause.',
  ] },
  { title: 'Forks and blocks', art: 'fork', body: [
    'A threat is two of your marks on a line with the third square empty: if you are not stopped you win next turn. The opponent must block it by taking the empty square.',
    'A fork is a move that makes two threats at once. The opponent can block only one, so a fork wins. Spotting your opponent\'s forks before they happen, and taking or defusing the key square, is the heart of the game.',
  ] },
  { title: 'Perfect play and draws', art: 'draw', body: [
    'If both players make no mistakes, Classic 3x3 is always a draw. The game\'s solver has checked every position to prove it: whichever of the nine squares X opens with, O can always answer so that no fork ever appears.',
    'So the Perfect opponent cannot be beaten at Classic, and you cannot lose to it if you block every threat and stop every fork. A win comes only from an opponent\'s mistake.',
  ] },
  { title: 'Terni Lapilli: the board', art: 'terni-board', body: [
    'Terni Lapilli is a Roman game of three pebbles a side. It is played on the same three-by-three pattern, but the pieces stand on the nine points where lines cross, and the lines matter: rows, columns and the two diagonals through the centre.',
    'Each point is joined to its neighbours along a line. The centre is joined to all eight other points. A corner is joined to the two edge points beside it and to the centre. An edge point is joined to the two corners beside it and to the centre.',
  ] },
  { title: 'Terni Lapilli: placing and sliding', art: 'terni-slide', body: [
    'Each player has three pieces. First everyone places: on your turn, while you have fewer than three pieces on the board, put one on any empty point. Once a player has all three down, that player\'s turns are slides.',
    'To slide, tap one of your pieces, then tap an empty point joined to it by a line; the piece moves there. A piece that has no empty neighbour cannot be chosen. Three of your pieces in one of the eight lines wins, whether made by placing or by sliding.',
  ] },
  { title: 'Terni Lapilli: repeats and perfect play', art: 'terni-open', body: [
    'Sliding can go round in circles, so this game adds one rule: if the same position (same pieces, same player to move) comes up for the third time, the game is a draw. You can never be left without a move: with six pieces on nine points there is always a slide available, which the solver confirmed over every possible position.',
    'The solver found that the first player wins Terni Lapilli with perfect play, by opening in the centre. An opening on an edge point loses and an opening in a corner only draws. The repeat rule is this game\'s own setting: the Roman rules are not preserved in writing to that level of detail.',
  ] },
  { title: 'Misère', art: 'misere', body: [
    'Misère is Classic 3x3 with one change: if you complete three in a row, you lose. Everything else is the same: X first, one mark a turn, a full board is a draw.',
    'Now you want to avoid making a line, and you want the opponent to run out of safe squares. The solver shows that X must open in the centre: any other first move loses against perfect play, and with a centre opening the game is a draw.',
  ] },
  { title: 'Quad 4x4', art: 'quad', body: [
    `The board has sixteen squares in four rows of four. You win with four of your marks in a row (rows, columns and the two long diagonals) or in a 2x2 square. That makes ${N4} winning lines: 10 lines and 9 squares. A full board is a draw.`,
    'Plain four-in-a-row on 4x4 is a draw with perfect play. Counting 2x2 squares as wins adds many more forks, so the game is far sharper, though the solver shows it is still a draw with perfect play, so Perfect never loses and you win only when it is not Perfect.',
  ] },
  { title: 'Sides and turns', art: 'sides', body: [
    'X always moves first. Against the computer you choose whether to play X (first) or O (second) before the game. The computer takes the other mark. Play Again keeps your side; Change Game lets you pick again.',
    'In two-player mode both players share the phone, and a banner and the highlighted name show whose turn it is. The mark on the left is X.',
  ] },
  { title: 'Opponent levels', art: 'levels', body: [
    'Beginner plays quickly: it takes a win about half the time it can, blocks only now and then and otherwise wanders. Casual takes easy wins and blocks most threats but can be forked. Skilled rarely misses a threat but still misses deep forks.',
    'Expert plays almost perfectly and slips now and then. Perfect never slips: every move comes from the solver that has searched all games, so it never misses a win and never allows a loss it could avoid.',
  ] },
  { title: 'Think', art: 'think', body: [
    'Think asks the solver for the best move from the position on the screen. It lights the square (or the slide) and says why: that it wins, blocks a win, makes a fork, blocks a fork, or is the only move that does not lose. It never makes the move for you and is free to use as often as you like.',
    'In Misère the reason is about staying safe, since completing a line loses. Think works on either side and from any position, even after a mistake.',
  ] },
  { title: 'Undo and Restart', art: 'undo', body: [
    'Undo takes back your last move and the opponent\'s reply, so it is your turn again. In two-player mode it takes back one move. Restart starts the same game over from the empty board.',
    'Undo is not available after the game has ended or inside a lesson. Your game is saved after every move: leave and come back and Continue game on the menu takes you back to it.',
  ] },
  { title: 'Learn', art: 'learn', body: [
    'Learn is a course of eleven short lessons, each a real position. Tap the right square to finish a line, block, make or stop a fork, open well, answer a corner, play a Misère safe move and solve the Roman and 4x4 positions. One lesson is a whole game against Perfect to show why a draw is the best possible result.',
    'A move that is wrong is not played: you are told why and can try again. Lessons you finish are ticked. They do not use up the free preview.',
  ] },
  { title: 'Watch & Learn', art: 'auto', body: [
    'Watch & Learn plays three whole games for you: a Classic game between two Perfect players (a draw), a Terni Lapilli game and a Misère game. Each move has three steps: THINK (2, 5, 8 or 10 seconds, you choose), REVEAL (two seconds: the possible squares light up and the chosen one is marked, with the reason in words) and ACT (the move is played).',
    'Pause freezes everything where it is and Resume carries on from exactly there. The moves are chosen by the same opponent engine you play against (Perfect on both sides, except Skilled for one side in the Terni Lapilli game); if a move is not the strongest, the reason says so. Watch & Learn does not use up the free preview.',
  ] },
  { title: 'Boards and sound', art: 'themes', body: [
    'In Settings you can choose the board and pieces: Marble & Bronze, Boxwood & Lacquer or Night Glass. The rules do not change. Sound can be switched off, the think time of Watch & Learn set, and the text size raised up to 300 percent on every text screen, including the game screen.',
    'There are no timers, no clocks and no stakes: results are only kept as your own record of wins, draws and losses for each mode and level.',
  ] },
  { title: 'How a game ends', art: 'win', body: [
    'Three in a row wins (four in a row or in a square on 4x4), except in Misère where it loses. A full board with no line is a draw. In Terni Lapilli a position seen for the third time is a draw.',
    'A glowing bar draws through the winning line (a frame around a winning 2x2 square), then the result card shows who won and offers Play Again, Change Game or the menu. The game starts with a free preview of the first 90 seconds of play; the full game is a single one-time unlock and works offline.',
  ] },
];

export const ABOUT = [
  { title: 'Noughts & Crosses', body: 'The three-in-a-row game everyone knows, made deep and beautiful: lit bronze and verdigris pieces on carved marble, four ways to play and a solver that never makes a mistake.' },
  { title: 'Where it comes from', body: 'Games of three in a row on a small board are very old. Roman writers describe terni lapilli, "three pebbles", in which each side has three pieces that are first placed and then moved. In Britain and much of the Commonwealth the placing game is called Noughts and Crosses (in print by the 1850s); in North America it is Tic-Tac-Toe.' },
  { title: 'In this game', body: 'Classic 3x3, the Roman Terni Lapilli with sliding pieces, Misère where three in a row loses, and Quad on a 4x4 board. Five opponent levels from Beginner to a Perfect solver, two players on one phone, Think with a plain-English reason, a course of eleven lessons and Watch & Learn. Three boards to choose from, text that scales up to 300 percent, no timers, works offline.' },
];
export const RULE_COUNT = RULES.length;
export const HOWTO_COUNT = HOWTO.length;
