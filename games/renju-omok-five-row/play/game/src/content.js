// Words for the About, How to Play and Rules readers, and the Learn lessons. Everything here is checked against rules.js and
// engine.js (the single source of truth): see the lessons, which are verified by the scenario test.
//
// A reader is a list of blocks: { h } heading, { p } paragraph, { li: [..] } bullets, { d } diagram (see view.js drawDiagram).
// A diagram is a small window of a board: { w, h, b: [[x,y]..] black, wh: [[x,y]..] white, m: [{ x, y, t, c }] marks, cap }.

export const ABOUT = [
  { h: 'Five in a Row' },
  { p: 'Two players take turns placing stones on the crossings of a grid. The first to line up five stones in a row wins. The rules fit in one sentence, and the game has been studied and played for well over a century.' },
  { h: 'A family of games' },
  { p: 'In Japan the game is called Gomoku narabe, or Renju ("linked pearls"). In Korea it is Omok. The same idea is played in China as Wuziqi and in Vietnam as Cờ caro.' },
  { p: 'Because the player who moves first has a real edge, Japanese players added restrictions for Black, and the balanced result became Renju. Korean Omok, played on a 19 by 19 Go board, bans only the double three.' },
  { h: 'In this app' },
  { li: ['Three rule sets: Free-style Gomoku, Renju and Omok, each with its exact rules.', 'A computer opponent with five levels, from a gentle learner to a deep-searching master.', 'A coach that shows threats and Black’s forbidden points, and a hint that explains its move.', 'Eight short lessons, and Watch & Learn, where the computer plays a whole game while you try to guess its moves.', 'Pass-and-play for two people on one device.'] },
  { h: 'Notes' },
  { p: 'The stones, board and sounds are all drawn and synthesized in the app. No account and no internet connection are needed.' },
];

export const HOWTO = [
  { h: 'Place a stone' },
  { p: 'Touch the board. A ghost stone shows where your stone will go; slide your finger to adjust, and lift to place it. On a small screen a magnifier appears above your finger. With a mouse, just click.' },
  { p: 'Turn on "Confirm each move" in Settings if you would rather tap once to aim and tap the same point again to place.' },
  { h: 'Win' },
  { p: 'Make a straight line of five of your stones: across, up and down, or diagonally. In Renju, Black needs exactly five.' },
  { h: 'The coach' },
  { li: ['A gold ring marks a point where you can make five.', 'A red ring marks a point where your opponent would make five. Block it.', 'A red cross marks a point Black may not play (Renju and Omok).', 'In Full mode, dots also show points that start a winning combination for either side.'] },
  { h: 'Buttons while you play' },
  { li: ['Undo takes back your last move and the reply.', 'Hint asks the computer for a move and tells you why it is good.', 'Coach switches the markers Off, Alerts or Full.', 'Menu leaves the game; it is saved so you can come back.'] },
  { h: 'Watch & Learn' },
  { p: 'The computer plays both sides of a whole game. It thinks first (you can set how long), then shows its move with a short explanation, then plays it. Pause at any time, and try to guess the move before it appears.' },
  { h: 'Keyboard' },
  { p: 'On a computer: arrow keys move the cursor, Space or Enter places a stone, Escape opens the menu, U takes a move back and H gives a hint.' },
];

const CENTRE_MARKS = (() => { const m = []; for (let x = 1; x <= 5; x++) for (let y = 1; y <= 5; y++) if (!(x === 3 && y === 3) && !(x === 4 && y === 3)) m.push({ x, y, t: 'x', c: 'red' }); return m; })();
const gomokuRules = [
  { h: 'The board and the stones' },
  { p: 'Gomoku and Renju are played on a board of 15 lines by 15 lines, so there are 225 crossings. Stones go on the crossings, not inside squares. Omok is played on a 19 by 19 Go board (361 crossings).' },
  { p: 'One player has the black stones and the other the white stones. Each stone, once placed, never moves and is never captured.' },
  { h: 'Taking turns' },
  { p: 'Black moves first, then the players alternate, placing one stone per turn on any empty crossing. Passing is not allowed.' },
  { h: 'Winning' },
  { p: 'The first player to make an unbroken straight line of five stones of their colour wins. The line may run across, up and down, or diagonally.' },
  { d: { w: 7, h: 3, b: [[1, 1], [2, 1], [3, 1], [4, 1], [5, 1]], wh: [[2, 0], [4, 2]], m: [], cap: 'Five in a row across: Black wins.' } },
  { d: { w: 5, h: 5, b: [[0, 4], [1, 3], [2, 2], [3, 1], [4, 0]], wh: [[2, 3], [1, 1]], m: [], cap: 'A diagonal line counts too.' } },
  { h: 'A drawn game' },
  { p: 'If every crossing is filled and nobody has five, the game is a draw. In practice this almost never happens.' },
  { h: 'Fours and threes (words you will meet)' },
  { p: 'A four is four stones in a line that can still become five. An open four has an empty end on both sides, so the opponent cannot block both and the player wins next turn.' },
  { d: { w: 7, h: 3, b: [[2, 1], [3, 1], [4, 1], [5, 1]], wh: [], m: [{ x: 1, y: 1, t: 'ring', c: 'gold' }, { x: 6, y: 1, t: 'ring', c: 'gold' }], cap: 'An open four: both ends are open, so it cannot be stopped.' } },
  { p: 'A three is three stones that can still become an open four. An open three, with room on both ends, is a serious threat: if it is not answered it becomes an open four.' },
  { d: { w: 7, h: 3, b: [[2, 1], [3, 1], [4, 1]], wh: [], m: [{ x: 1, y: 1, t: 'dot', c: 'teal' }, { x: 5, y: 1, t: 'dot', c: 'teal' }], cap: 'An open three. Next turn it can become an open four.' } },
  { d: { w: 7, h: 3, b: [[2, 1], [3, 1], [4, 1]], wh: [[1, 1]], m: [{ x: 5, y: 1, t: 'dot', c: 'teal' }], cap: 'A blocked three can only become a plain four.' } },
  { p: 'Stones do not need to touch. A line like stone, gap, stone, stone also counts as a three because filling the gap makes four in a row.' },
  { h: 'Winning combinations' },
  { p: 'Strong players win by making two threats at once so the opponent can answer only one. The classic combinations are a four together with an open three (a "four-three"), two fours (a "double four") and two open threes (a "double three").' },
  { d: { w: 7, h: 6, b: [[1, 3], [2, 3], [3, 3], [4, 1], [4, 2]], wh: [[0, 3]], m: [{ x: 4, y: 3, t: 'ring', c: 'gold' }], cap: 'Black plays the ringed point: a four across and an open three down, both at once.' } },
];

const gomokuModes = [
  { h: 'Free-style Gomoku' },
  { p: 'Free-style has no restrictions. Five or more stones in a row wins, so six or seven in a row also win, and both players may use any combination. Because Black moves first, Black is much better in this version, which is why the other rule sets exist.' },
];

const renjuRules = [
  { h: 'Renju' },
  { p: 'Renju is the balanced, professional version. It is played on the 15 by 15 board. White has no restrictions at all. Black is restricted in three ways, and Black wins only with exactly five.' },
  { p: 'Black’s first move is on the centre crossing. In this app that stone is placed for you.' },
  { h: 'Black needs exactly five' },
  { p: 'If Black makes six or more in a row it is an overline, which is forbidden and does not win. White, in contrast, wins with five or with more than five.' },
  { d: { w: 8, h: 3, b: [[0, 1], [1, 1], [2, 1], [4, 1], [5, 1]], wh: [[1, 0]], m: [{ x: 3, y: 1, t: 'x', c: 'red' }], cap: 'Overline: filling the gap would make six, so the point is forbidden for Black.' } },
  { h: 'Black may not make a double three' },
  { p: 'A move is a double three if it makes two open threes at once. Black may not play it, because then White could not stop both. A three only counts if it could really become an open four with a legal move; a three that is blocked, or whose open four would itself be a forbidden move, does not count.' },
  { d: { w: 7, h: 7, b: [[1, 3], [2, 3], [3, 1], [3, 2]], wh: [[0, 6], [6, 0]], m: [{ x: 3, y: 3, t: 'x', c: 'red' }], cap: 'Double three: the marked point would make two open threes.' } },
  { d: { w: 7, h: 7, b: [[1, 3], [2, 3], [3, 1], [3, 2]], wh: [[0, 3], [6, 0]], m: [{ x: 3, y: 3, t: 'dot', c: 'teal' }], cap: 'Allowed: White’s stone on the left means the horizontal three is not open.' } },
  { h: 'Black may not make a double four' },
  { p: 'A move that makes two fours at once is forbidden for Black. The fours may be on different lines, or two fours on the same line. (An open four counts as one four.)' },
  { d: { w: 7, h: 6, b: [[0, 0], [1, 0], [2, 0], [3, 1], [3, 2], [3, 3]], wh: [], m: [{ x: 3, y: 0, t: 'x', c: 'red' }], cap: 'Double four: the marked point makes a four across and a four down.' } },
  { h: 'Making five always wins' },
  { p: 'A move that makes exactly five in a row is never forbidden, even if it also makes a double three or a double four. Five ends the game on the spot.' },
  { h: 'The four-three is allowed' },
  { p: 'A four together with an open three is not forbidden for Black. It is Black’s best weapon.' },
  { h: 'How White can win' },
  { p: 'White wins by making five or more. White can also win when Black cannot stop a five because the only blocking point is forbidden to Black. In a real tournament, a Black player who plays a forbidden move loses. In this app, forbidden points are marked and cannot be played, so you will see the problem coming.' },
  { d: { w: 8, h: 7, b: [[0, 0], [1, 3], [2, 3], [1, 5], [2, 4]], wh: [[3, 1], [3, 2], [3, 3], [3, 4]], m: [{ x: 3, y: 5, t: 'x', c: 'red' }], cap: 'White has a four. The only block, marked, would be a double three for Black, so Black cannot stop it.' } },
  { h: 'Opening rules (optional)' },
  { p: 'Because Black moves first, tournament Renju adds an opening convention. This app offers two, chosen on the New game screen when Renju is selected. The default is Standard: no extra opening rule.' },
  { p: 'Restricted third move: Black\u2019s second stone, the third stone of the game, may not be placed inside the central 5 by 5 square, that is within two crossings of the centre. The forbidden crossings are marked with red crosses.' },
  { d: { w: 7, h: 7, b: [[3, 3]], wh: [[4, 3]], m: CENTRE_MARKS, cap: 'The centre point is the first Black stone. Black\u2019s next stone may not go within two crossings of it.' } },
  { p: 'Swap: after the third stone (two black, one white) the side that is to play White may swap and play Black instead. Whoever places the opening stones therefore tries to leave a position that is fair for both. Against the computer, a human who plays Black is the first player; the computer then decides whether to swap. A human who plays White is asked.' },
];

const omokRules = [
  { h: 'Omok' },
  { p: 'Omok is the Korean version. It is played on a 19 by 19 Go board. Five or more in a row wins, as in free-style, so an overline is allowed for both players.' },
  { p: 'The only restriction is that Black may not make a double three (two open threes at once). Double fours and overlines are allowed. White is never restricted. Black’s first move can be anywhere.' },
  { p: 'The same rule as in Renju decides what counts as an open three, so a blocked three, or a three whose open four would be forbidden, does not count.' },
];

const appRules = [
  { h: 'Rules in this app' },
  { li: [
    'Black always moves first. In two-player mode pass the device after each move.',
    'In Renju and Omok, forbidden points for Black are shown with a red cross (when the coach is on) and cannot be played. The app tells you why.',
    'Undo takes back your move and the computer’s reply. There is no limit.',
    'The computer follows exactly the same rules, including the restrictions on Black.',
  ] },
];

export const RULES = [...gomokuRules, ...gomokuModes, ...renjuRules, ...omokRules, ...appRules];

// ---- lessons ---------------------------------------------------------------------------------------------------------------------
// Positions are on the full board, written as [x, y] with (7, 7) the centre (15 x 15). `answers` are the accepted points;
// kind 'refused' means the lesson is to tap the forbidden point and read why it is refused.
export const LESSONS = [
  { t: 'Five wins', mode: 'gomoku', turn: 1, b: [[5, 7], [6, 7], [7, 7], [8, 7], [6, 9]], w: [[5, 8], [6, 8], [7, 8], [9, 6]],
    text: 'Black has four in a row. Place the fifth stone to win.', hint: 'Look at the two ends of the row of four.', answers: [[4, 7], [9, 7]], ok: 'Five in a row. That is the whole goal of the game.' },
  { t: 'Stop the four', mode: 'gomoku', turn: 2, b: [[5, 7], [6, 7], [7, 7], [8, 7], [8, 5]], w: [[4, 7], [6, 5], [7, 9]],
    text: 'You are White. Black has four in a row and threatens five. Block it.', hint: 'Only one end of the four is still open.', answers: [[9, 7]], ok: 'Blocked. A four must always be answered at once.' },
  { t: 'The open four', mode: 'gomoku', turn: 1, b: [[6, 7], [7, 7], [8, 7], [7, 5]], w: [[6, 8], [8, 6], [5, 5]],
    text: 'Black has an open three. Make a four with both ends open, so White cannot stop it.', hint: 'Extend the three on either side, as long as both ends stay empty.', answers: [[5, 7], [9, 7]], ok: 'Open four: White can block only one end, so Black makes five next.' },
  { t: 'Stop the open three', mode: 'gomoku', turn: 2, b: [[6, 7], [7, 7], [8, 7], [7, 5]], w: [[7, 8], [9, 8]],
    text: 'You are White. Black has an open three. Stop it before it becomes an open four.', hint: 'Play right at one end of the three.', answers: [[5, 7], [9, 7]], ok: 'Good. Answer an open three at once, at one of its ends.' },
  { t: 'Four and three', mode: 'gomoku', turn: 1, b: [[5, 7], [6, 7], [7, 7], [8, 5], [8, 6]], w: [[4, 7], [6, 9], [7, 4], [10, 9]],
    text: 'Find the one point that makes a four and an open three at the same time.', hint: 'The row of three and the pair above meet at one point.', answers: [[8, 7]], ok: 'A four-three: White must block the four, and then the open three wins.' },
  { t: 'Free-style: six wins', mode: 'gomoku', turn: 1, b: [[4, 7], [5, 7], [6, 7], [8, 7], [9, 7]], w: [[5, 5], [7, 9], [9, 9], [7, 5]],
    text: 'In free-style Gomoku, five or more wins. Fill the gap.', hint: 'The gap in the row of five joins everything.', answers: [[7, 7]], ok: 'Six in a row wins in free-style. In Renju this would be forbidden for Black.' },
  { t: 'Renju: double three', mode: 'renju', turn: 1, b: [[5, 7], [6, 7], [8, 5], [8, 6]], w: [[3, 3], [11, 11], [10, 4], [3, 10]],
    kind: 'refused', at: [8, 7], text: 'This is Renju. Tap the red cross: it would make two open threes at once, which is forbidden for Black.', hint: 'Tap the point marked with a red cross.', ok: 'Forbidden. Black may not make a double three, and the app refuses it. White has no such limit.' },
  { t: 'Renju: overline', mode: 'renju', turn: 1, b: [[4, 7], [5, 7], [6, 7], [8, 7], [9, 7]], w: [[5, 5], [7, 9], [9, 9], [7, 5]],
    kind: 'refused', at: [7, 7], text: 'The same position as before, but in Renju. Tap the gap.', hint: 'Tap the crossing in the middle of the row.', ok: 'Six or more in a row is an overline: forbidden for Black, which needs exactly five.' },
];
