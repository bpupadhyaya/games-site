// All player-facing text (English). Numbers come from the engine's own constants so the Rules pages cannot drift from it.
import { QUIET_LIMIT, START_COUNT } from './rules.js';

export const STR = {
  playBtn: 'Play', continueBtn: 'Continue game', learnBtn: 'Learn', autoBtn: 'Watch & Learn', howtoBtn: 'How to Play', rulesBtn: 'Rules', aboutBtn: 'About',
  settingsBtn: 'Settings', back: 'Back', next: 'Next', prev: 'Previous', think: 'Think', undo: 'Undo', threats: 'Threats', restart: 'Restart', resume: 'Resume', paused: 'Paused',
  quitMenu: 'Main Menu', soundOn: 'Sound: On', soundOff: 'Sound: Off', thinkTime: 'Watch & Learn think time', seconds: 's',
  restore: 'Restore Purchases', unlock: 'Unlock Full Game', resetProgress: 'Erase Records and Progress', resetConfirm: 'Tap again to erase everything',
  owned: 'Full game unlocked. Thank you!', theme: 'Board and pieces', startGame: 'Start game', opponentTitle: 'Opponent', sideTitle: 'Your side',
  playLight: 'Light (first)', playDark: 'Dark (second)', twoPlayers: 'Two players', youWord: 'You', vsComputer: 'vs computer',
  autoThink: 'Thinking', autoPause: 'Pause', autoPlay: 'Resume', autoExit: 'Exit', autoSlower: 'Think -', autoFaster: 'Think +',
  autoSession: 'Watch & Learn', autoAgain: 'Watch Again',
  autoSummary: 'You watched a whole game. Every move was chosen by the game\'s own search, with its reason shown before it was played.',
  demoLimitTitle: 'FREE PREVIEW FINISHED', demoLimitBody: 'You played the free games. Get the full game on iPhone and Android for every opponent level, two players on one phone, all three boards and the full Learn course.',
  demoLeft: '{n} free games left', tagline: 'The looping capture game', record: 'Record', wins: 'W', draws: 'D', losses: 'L',
  yourMove: 'Your move', thinking: 'Thinking...', lightTurn: 'Light to move', darkTurn: 'Dark to move',
  lessonsTitle: 'Learn', lessonDone: 'Done', again: 'Play Again', newSetup: 'Change Game', lessonNext: 'Next Lesson', lessonRetry: 'Try Again', lessonList: 'All Lessons',
  quiet: 'Quiet moves', textSize: 'Text size', locked: 'In the full game', language: 'Language: English',
  threatsOn: 'Threat view on', threatsOff: 'Threat view off', threatKey: 'Red ring: can be captured next turn. Gold ring: you could capture it.',
};
export const tr = (key, vars) => {
  let s = STR[key] ?? key;
  if (vars) for (const k of Object.keys(vars)) s = s.replace(`{${k}}`, vars[k]);
  return s;
};

export const HOWTO = [
  { title: 'The goal', art: 'logo', body: `Each player has ${START_COUNT} round pieces. Light plays from the bottom and moves first; Dark plays from the top. Capture all of your opponent's pieces to win. Pieces step one point at a time, but they capture along looping tracks.` },
  { title: 'Stepping', art: 'step', body: 'Tap one of your pieces, then tap a free point next to it, forwards, sideways or diagonally. That is a quiet move: it never captures. Tap the piece again to put it down.' },
  { title: 'Capturing on the circuits', art: 'capture1', body: 'The gold line and the green line are the two circuits. A piece captures by travelling along a circuit, over empty points, round at least one loop at a corner, and landing on an enemy piece. Select a piece and its capture routes light up as glowing trails. Tap the Dark piece at the end of a trail to capture.' },
  { title: 'Your own square', art: 'own', body: 'On its way round, a capturing piece may pass over the point it started from, because that point is empty once it has left. So a piece can capture an enemy that is right next to it by going all the way round the loop and back.' },
  { title: 'Think and Threats', art: 'think', body: 'Think shows the best move and says why in plain English. The eye button turns on the threat view: a red ring marks a piece that can be captured next turn, a gold ring marks a piece you could capture.' },
  { title: 'Opponents', art: 'levels', body: 'Choose Beginner to Master, or play two players on one phone. Lower levels make mistakes; Master looks furthest ahead. If you play Dark the board turns around so your pieces are always at the bottom.' },
  { title: 'Learn and Watch', art: 'learn', body: 'Learn is a short course: steps, the two circuits, passing over your own square, defending, and picking a clean capture. Watch & Learn plays a whole game for you with the reason for every move, and a Pause button.' },
];

const SIX = QUIET_LIMIT;

export const RULES = [
  { title: 'The game', art: 'logo', body: [
    'Surakarta is a game for two players, Light and Dark, on a square board of six lines by six lines with looping tracks around the corners. Light moves first, from the bottom of the screen.',
    `Each side starts with ${START_COUNT} pieces. The aim is to capture every enemy piece. Pieces move one step at a time, but they capture by racing along the looping circuits.`,
  ] },
  { title: 'The board and the two circuits', art: 'circuits', body: [
    'The board is a grid of 6 x 6 points. Number the lines 0 to 5 from each edge. The lines 1 and 4 (second from each edge) are joined at the corners by the four small loops: together they make the outer circuit, drawn in gold. The lines 2 and 3 (third from each edge) are joined by the four large loops: the inner circuit, drawn in green.',
    'Each circuit is one closed track. A piece travelling along it goes straight along a line, and when it reaches the edge of the board it swings round a three-quarter loop outside the corner and comes back onto the board on the matching line. The edge lines (0 and 5) are on no circuit.',
  ] },
  { title: 'Setup and first move', art: 'setup', body: [
    `Each side puts ${START_COUNT} pieces on its two nearest rows: Light on the bottom two rows, Dark on the top two. Light always moves first, then the players alternate; a player must move and cannot pass.`,
    'Against the computer you choose whether to play Light (first) or Dark (second). If you play Dark, the board turns half a turn so that your pieces are at the bottom. Because the board is symmetrical, nothing else changes.',
  ] },
  { title: 'Quiet moves: one step', art: 'step', body: [
    'On your turn you may move one piece one step to any free neighbouring point: forwards, backwards, sideways or diagonally (up to eight neighbours). You cannot step onto an occupied point and you cannot jump.',
    'A step never captures. A piece with no free neighbour and no capture cannot be moved.',
  ] },
  { title: 'Capturing: the path', art: 'capture1', body: [
    'Instead of stepping, you may capture. A capture moves one of your pieces along a circuit, in either direction, over empty points, and lands on an enemy piece, which is removed. The capturing piece takes that point.',
    'The path starts at the piece, goes straight along one of its lines that is a circuit line, and follows the circuit round the loops. It does not turn at crossings: at a crossing point it stays on the line it is on. It may be any length, and it may cross the same empty point more than once.',
    'Capturing is optional: you may always step instead.',
  ] },
  { title: 'At least one loop', art: 'loopneeded', body: [
    'A capture must go round at least one loop. An enemy piece in a straight line along a circuit, with nothing in between and no loop on the way, cannot be captured by that straight line.',
    'That is why the board looks the way it does: threats arrive from directions that seem impossible on an ordinary grid, because the path leaves one side of the board and returns from another.',
  ] },
  { title: 'Over your own starting point', art: 'own', body: [
    'While a piece travels, the point it started from counts as empty, so the path may pass over it again. A piece can therefore capture an enemy that is right next to it by leaving along the circuit, going round a loop and coming back through its own starting point.',
    'This is the rule this game follows; it is how the game is normally played. The piece is never blocked by its own previous position.',
  ] },
  { title: 'What blocks a path', art: 'blocked', body: [
    'A capturing piece can only travel over empty points. The first piece it meets ends the path. If that piece is an enemy and the path has gone round at least one loop, it is captured. If that piece is one of your own, the path is blocked and nothing is captured. If it is an enemy but the path has not yet been round a loop, nothing is captured either.',
    'Pieces cannot jump over other pieces. A defender can therefore block a threat by stepping a piece onto the path.',
  ] },
  { title: 'Corners', art: 'corner', body: [
    'The four corner points (a corner of the 6 x 6 grid) lie on no circuit, because the circuits use only the lines 1 to 4. A piece in a corner can only step. It can never capture, and it can never be captured by a circuit.',
    'A piece in a corner is safe but useless until it steps out. Pieces on the other edge points are on one circuit line and can capture and be captured along it.',
  ] },
  { title: 'Crossing points', art: 'cross', body: [
    'Eight points lie on both circuits: where a line of the outer circuit (the second or fifth line) crosses a line of the inner circuit (the third or fourth line). A piece there can capture along either circuit, in four directions, so it is both strong and exposed.',
    'Every other point outside the four corners lies on exactly one circuit. Corners lie on none.',
  ] },
  { title: 'Winning', art: 'win', body: [
    'You win when your opponent has no pieces left. If a player has pieces but no legal move at all, that player loses; this almost never happens.',
    'A win is shown with a burst on the board and the result card, which offers Play Again, Change Game and the menu.',
  ] },
  { title: 'Drawn-out games', art: 'draw', body: [
    `Good players can reach positions where neither side can make progress. This game ends such a game by count: if ${SIX} moves in a row (${SIX / 2} by each player) pass without a capture, the game stops and the player with more pieces on the board wins; equal numbers is a draw.`,
    'Every capture resets the count. The count is shown as "Quiet moves" while you play. This count is this game\'s own rule: traditional play ends a stuck game by agreement, and a fixed count is the fair way to do that against a computer.',
  ] },
  { title: 'Opponent levels', art: 'levels', body: [
    'Beginner steps and captures with little plan. Casual looks one move ahead and takes free pieces. Skilled looks two moves ahead. Expert looks three moves ahead and follows exchanges of captures. Master searches deepest, several moves further, within a fixed amount of effort.',
    'Each level beat the one below it in our own test games, so the ladder is real. The same game position always gives the same answers to the same moves.',
  ] },
  { title: 'Think', art: 'think', body: [
    'Think searches the position and lights up the best move, with the route if it is a capture, and says why in plain English: that it wins a piece, saves a piece that was under attack, builds a threat, or is simply the safest move. It never plays the move for you and is free to use.',
    'Every reason is checked against the real position before it is shown: for example "none of your pieces can be captured afterwards" is only said when the engine confirms it.',
  ] },
  { title: 'Threat view', art: 'threats', body: [
    'The eye button marks pieces under attack. A red ring is on a piece that the other side could capture on its next turn. A gold ring is on an enemy piece that you could capture now. Rings follow the real capture rules, including loops and your own starting point.',
    'Selecting a piece shows its own routes: a glowing trail from the piece to each capture, and a dot on each free point where it can step.',
  ] },
  { title: 'Undo, Pause and Continue', art: 'undo', body: [
    'Undo takes back your last move and the computer\'s reply, so it is your turn again. In two-player mode it takes back one move. Undo is not available once the game has ended or inside a lesson.',
    'Pause stops everything where it is. Your game is saved after every move: leave and come back and Continue game on the menu takes you back to it, paused.',
  ] },
  { title: 'Learn', art: 'learn', body: [
    'Learn is a course of seven short lessons, each a real position: stepping, a capture round an outer loop, one on the inner circuit, a capture through your own starting point, defending a piece and choosing a clean capture. The last is a whole game against the Casual opponent.',
    'A wrong move in a lesson is not played: you are told why and can try again. Lessons do not use up the free preview.',
  ] },
  { title: 'Watch & Learn', art: 'auto', body: [
    'Watch & Learn plays a whole game for you. Each move has three steps: THINK (2, 5, 8 or 10 seconds, you choose), REVEAL (two seconds: the piece, the trail of a capture and the reason in words) and ACT (the move is played).',
    'Pause freezes everything where it is and Resume carries on from exactly there. The moves come from the same search as Think. Watch & Learn does not use up the free preview.',
  ] },
  { title: 'Boards, sound and text', art: 'themes', body: [
    'In Settings you can choose the board and pieces: Carved Teak, Batik Indigo or Night Lacquer. The rules do not change. Sound can be switched off, the think time of Watch & Learn set, and the text size raised up to 300 percent on every text screen, including the game screen.',
    'There are no timers and no stakes: results are only kept as your own record of wins, draws and losses for each level.',
  ] },
  { title: 'Names, words and the preview', art: 'logo', body: [
    'Surakarta is the name of a city in Central Java, Indonesia, and the game is named after it. In Indonesian, permainan simply means "the game". The pieces are called just "pieces"; Light and Dark are the two sides.',
    `The preview: the full game starts with a free preview of the first 90 seconds of play; the full game is a single one-time unlock and works offline.`,
  ] },
];

export const ABOUT = [
  { title: 'Surakarta', body: 'A strategy game of looping tracks: pieces step one point at a time but capture by racing round the corner loops of a carved board. Lit pieces, three boards, and opponents from Beginner to Master.' },
  { title: 'Where it comes from', body: 'The game is named after Surakarta (Solo), a city in Central Java, Indonesia, and is played on a 6 x 6 board with eight looping tracks. Its exact origins are not documented; it became widely known outside Indonesia in the 1970s.' },
  { title: 'In this game', body: 'The standard rules with circuit captures, five opponent levels, two players on one phone, Think with a plain-English reason, a Learn course and Watch & Learn. Text that scales up to 300 percent, no timers, works offline. The game is in English.' },
];
export const RULE_COUNT = RULES.length;
export const HOWTO_COUNT = HOWTO.length;
