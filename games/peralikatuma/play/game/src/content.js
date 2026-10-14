// Text and diagrams: the Rules reference, How to Play, About, and the lessons. Every rule statement here is cross-checked against rules.js
// (the single source of truth for legality). Items: { k: 'h' | 'p' | 'd', t / spec }.
// Diagram rows: R Ruby man, S Sapphire man, r Ruby star, s Sapphire star, . empty point, space = no point there.
// Diagram diagonals run from the points where row + column is even (the top-left point of a diagram is one of them).
const D = (rows, extra = {}) => ({ k: 'd', spec: { rows, ...extra } });
const H = (t) => ({ k: 'h', t });
const P = (t) => ({ k: 'p', t });
const RED = 'rgba(214,41,31,0.35)', GOLD = 'rgba(240,190,60,0.45)';

export const RULES = [
  { title: 'The board and the pieces', items: [
    P('Peralikatuma is played on an octagon-shaped board of 57 points. Pieces stand on the points, where the lines cross, not in squares.'),
    P('Every point is joined to its four straight neighbours. Diagonal lines run only from every other point: from a point where the lines make an X, and never from a point where they make a plus.'),
    D(['.....', '.....', '.....', '.....', '.....'], { cell: 40 }),
    P('Each side starts with 15 men on its three rows nearest itself. Ruby sits at the bottom and moves first. Sapphire sits at the top. Ruby men are round, Sapphire men have eight sides. The three rows in the middle start empty.'),
  ] },
  { title: 'How a man steps', items: [
    P('A man steps one point along a line to a free point: straight ahead, diagonally ahead (where a diagonal line runs), or sideways. A man never steps backward and never steps onto a taken point.'),
    D(['.....', '.....', '..R..', '.....', '.....'], { marks: [[1, 1, 'dot'], [1, 2, 'dot'], [1, 3, 'dot'], [2, 1, 'dot'], [2, 3, 'dot']], cell: 42 }),
    P('This man stands on an X point, so it has two forward diagonals as well.'),
    D(['.....', '.....', '.....', '..R..', '.....'], { marks: [[2, 2, 'dot'], [3, 1, 'dot'], [3, 3, 'dot']], cell: 42 }),
    P('This man stands on a plus point: it has no diagonal lines, so only forward and sideways.'),
    P('You must move on your turn: there is no passing. A player who has no legal move loses.'),
  ] },
  { title: 'Capturing: the leap', items: [
    P('You capture by leaping. When an enemy piece stands next to your piece on a line, and the point straight beyond it on the same line is free, you may jump over it and land there. The enemy piece is taken off the board.'),
    D(['.....', '.....', '..S..', '..R..', '.....'], { arrows: [[3, 2, 1, 2]], marks: [[1, 2, 'ring']], hl: [[2, 2, RED]], cell: 44 }),
    P('Leaps follow the lines, so they can go diagonally too, but only along a diagonal line that really exists.'),
    D(['.....', '.....', '..S..', '.R...', '.....'], { arrows: [[3, 1, 1, 3]], marks: [[1, 3, 'ring']], hl: [[2, 2, RED]], cell: 44 }),
    P('A man may leap in any direction, including backward, even though it never steps backward.'),
    D(['.....', '.....', '..R..', '..S..', '.....'], { arrows: [[2, 2, 4, 2]], marks: [[4, 2, 'ring']], hl: [[3, 2, RED]], cell: 44 }),
    P('You cannot leap your own pieces, and you cannot leap two pieces in a row with no free point between them.'),
  ] },
  { title: 'Chains of leaps', items: [
    P('After a leap, if the same piece can leap again from where it landed, it must go on. A move is the whole chain, and you may turn to any direction along the way.'),
    D(['.......', '.....S.', '...S...', '.S.....', 'R......'], { arrows: [[4, 0, 2, 2], [2, 2, 2, 4], [2, 4, 0, 6]], marks: [[0, 6, 'ring']], hl: [[3, 1, RED], [2, 3, RED], [1, 5, RED]], cell: 40 }),
    P('The captured pieces stay on the board until the chain is finished, so they block the way, and no piece can be leapt twice in one chain. When the chain ends they are all taken off together.'),
    P('The piece must complete its chain, but you choose which piece to move and which chain to take. You are never forced to take the longest one.'),
  ] },
  { title: 'A capture is compulsory', items: [
    P('If any of your pieces can leap, you must make a leap on that turn. You may choose which one. A man that could step but not leap is not allowed to move while another piece can capture.'),
    P('The same holds for the computer. Look for what your opponent is forced to do: a forced leap can drag a piece to where you want it.'),
    P('In the app, the pieces that must leap pulse, and a refused move says why.'),
  ] },
  { title: 'Crowning a Star', items: [
    P('When a man ends its move on one of the two rows nearest the enemy, it is crowned: it becomes a Star, with a gold rim and a raised star on top. A Star stays a Star for the rest of the game.'),
    D(['.....', '.....', '..R..', '.....'], { hl: [[0, 0, GOLD], [0, 1, GOLD], [0, 2, GOLD], [0, 3, GOLD], [0, 4, GOLD], [1, 0, GOLD], [1, 1, GOLD], [1, 2, GOLD], [1, 3, GOLD], [1, 4, GOLD]], arrows: [[2, 2, 1, 2]], cell: 44 }),
    P('The gold points are the crowning rows for Ruby (the two rows at the top of the board); Sapphire is crowned on the two rows at the bottom. If a man crosses those rows in the middle of a chain and the chain carries on, it is crowned only if its move ends there.'),
  ] },
  { title: 'The Star (Classic rules)', items: [
    P('In the Classic rule set a Star is strong. It slides any number of free points along a line, in any of the eight directions, forward or back.'),
    D(['.....', '.....', '..r..', '.....', '.....'], { marks: [[0, 0, 'dot'], [1, 1, 'dot'], [3, 3, 'dot'], [4, 4, 'dot'], [0, 4, 'dot'], [1, 3, 'dot'], [3, 1, 'dot'], [4, 0, 'dot'], [0, 2, 'dot'], [1, 2, 'dot'], [3, 2, 'dot'], [4, 2, 'dot'], [2, 0, 'dot'], [2, 1, 'dot'], [2, 3, 'dot'], [2, 4, 'dot']], cell: 40 }),
    P('A Star also leaps from a distance. It may pass over any number of free points, jump the first piece it meets if that piece is an enemy and the point just beyond is free, and land on any free point beyond it, stopping before the next piece.'),
    D(['.....', '.....', '..S..', '.....', 'r....'], { arrows: [[4, 0, 1, 3]], marks: [[1, 3, 'ring'], [0, 4, 'dot']], hl: [[2, 2, RED]], cell: 44 }),
    P('A Star may continue a chain just as a man does, with the same long reach on every leap.'),
  ] },
  { title: 'The Star (Gentle Stars)', items: [
    P('The Gentle Stars rule set keeps everything else the same, but a Star moves only one point at a time along a line, forward, backward, sideways or diagonally. It leaps only a piece standing right next to it.'),
    D(['.....', '.....', '..r..', '.....', '.....'], { marks: [[1, 1, 'dot'], [1, 2, 'dot'], [1, 3, 'dot'], [2, 1, 'dot'], [2, 3, 'dot'], [3, 1, 'dot'], [3, 2, 'dot'], [3, 3, 'dot']], cell: 40 }),
    P('A Star is still worth more than a man: it can retreat, and it is never stuck against the far edge.'),
  ] },
  { title: 'Winning', items: [
    P('You win by capturing every enemy piece, or by leaving your opponent with a turn on which no piece can move.'),
    P('A player with no pieces left has lost, and so has a player whose pieces are all blocked.'),
  ] },
  { title: 'Draws and quiet games', items: [
    P('If the same position, with the same player to move, appears three times, the game is a draw. The game is also drawn after 150 moves each.'),
    P('If 25 moves each pass with no capture and no man stepping forward, the game is settled on the spot: the stronger side wins, counting a man as 1 and a Star as 3. With equal strength it is a draw. Any capture, any forward step of a man and any crowning starts the count again.'),
  ] },
  { title: 'About these rules', items: [
    P('Peralikatuma is a traditional jumping game from Sri Lanka. Written descriptions of it are short, so this version fixes one complete rule set and states it all here: the board, 15 men each, compulsory leaps, chains, the Star, and the draw rules above.'),
    P('The two Star options, and the quiet-game and repetition rules, are choices made for this version so that every game reaches a result.'),
  ] },
  { title: 'In this app', items: [
    P('Tap a piece and the points it can reach light up. A red ring means that move captures; the number shows how many pieces. Tap a point to move, or drag the piece there.'),
    P('Hint shows a good move and says why it is good. Danger marks (in Settings) put a red mark on any of your pieces that the other side could leap on its next move. Take back undoes your last move and the computer’s reply.'),
    P('Auto Play lets you watch the computer play both sides, with time to think and a pause button. Your game is saved when you leave.'),
  ] },
];

export const HOWTO = [
  { title: 'The goal', items: [
    P('Capture every piece of your opponent by leaping over them, or leave them with no move.'),
    D(['.....', '.....', '..S..', '..R..', '.....'], { arrows: [[3, 2, 1, 2]], cell: 40 }),
  ] },
  { title: 'Move', items: [
    P('Tap one of your pieces. The points it can reach glow. A man steps one point forward, diagonally forward (from an X point) or sideways.'),
    P('Tap a glowing point, or drag the piece there. A red ring means the move captures, and the number tells you how many pieces.'),
  ] },
  { title: 'Leap', items: [
    P('Jump over an enemy piece next to you onto the free point straight behind it, along a line. Keep leaping if you can: a chain is one move.'),
    P('A capture is compulsory: if you can leap, you must. Pieces that can leap pulse so you cannot miss them.'),
  ] },
  { title: 'Crown a Star', items: [
    P('Reach one of the two far rows with a man and it becomes a Star: it moves in every direction, backward too, and in Classic rules it slides and leaps from a distance.'),
  ] },
  { title: 'Learn more', items: [
    P('Tap Learn on the main menu for short hands-on lessons. Use Hint if you are stuck and Take back if you slip. Danger marks warn you before the other side strikes.'),
  ] },
];

export const ABOUT = [
  { title: 'Peralikatuma', items: [
    P('Peralikatuma is a traditional two-player jumping game from Sri Lanka. Players hop over each other’s pieces and capture by jumping, as in draughts, but on a star-shaped grid: an octagonal board mirrored from one player to the other, with lines that run straight and diagonally.'),
    P('The rules take a minute to learn. The depth is in the chains: one careful move can clear half the board, and a compulsory leap can be turned against the player who has to make it.'),
  ] },
  { title: 'What you get', items: [
    P('Two rule sets: Classic, where a crowned Star flies along whole lines, and Gentle Stars, where a Star moves one point at a time.'),
    P('Five computer levels from Beginner to Master, two players on one phone, hands-on lessons, Hint, danger marks, take back, and Auto Play (Watch & Learn).'),
    P('Three boards and two cuts of gems to earn. Large text, reduced motion and sound options. No ads, and it works offline.'),
  ] },
  { title: 'Credits', items: [
    P('A heritage game of Sri Lanka, brought to a screen. Board, pieces, sounds and the computer player were made for Arcforge. The rule set is described in full on the Rules page. Titles are set in Cormorant Garamond (SIL Open Font License 1.1). Calamander, the second board, is named for an ebony from Sri Lanka.'),
    P('The 3D scene (carved board, gems, brass lamps, plants, verandah and paddy terraces) is drawn with three.js (MIT licence, the three.js authors); the models are built in code for this game and the distant landscape uses the shared Arcforge scenery kit.'),
    P('Arcforge: World Heritage Games.'),
  ] },
];

// Lessons. Boards are 9 rows of 9 characters (R Ruby man, S Sapphire man, r Ruby star, s Sapphire star). Ruby always moves.
// `goal`: { type: 'to', to } | { type: 'capture', n } | { type: 'crown' } | { type: 'win' }.
const rowsOf = (cells) => { const rows = Array.from({ length: 9 }, () => '.........'.split('')); for (const [r, c, ch] of cells) rows[r][c] = ch; return rows.map((x) => x.join('')); };
export const LESSONS = [
  { title: 'Step along a line', variant: 'classic', board: rowsOf([[6, 3, 'R'], [1, 4, 'S']]), goal: { type: 'to', to: 5 * 9 + 3 }, target: 5 * 9 + 3,
    text: 'A man steps one point forward along a line. Tap your piece, then tap the ringed point.', done: 'Good. A man steps forward, forward diagonally, or sideways, one point at a time.', hint: 'Tap your piece first, then the ringed point straight ahead of it.' },
  { title: 'Diagonal lines', variant: 'classic', board: rowsOf([[6, 4, 'R'], [1, 4, 'S']]), goal: { type: 'to', to: 5 * 9 + 5 }, target: 5 * 9 + 5,
    text: 'Diagonal lines run from every other point. This piece stands on an X point, so step diagonally to the ringed point.', done: 'Diagonals only run from the X points.', hint: 'Tap your piece, then the ringed point up and to the right.' },
  { title: 'The leap', variant: 'classic', board: rowsOf([[5, 4, 'R'], [4, 4, 'S'], [0, 3, 'S']]), goal: { type: 'capture', n: 1 },
    text: 'Jump over the enemy piece next to you onto the free point straight behind it.', done: 'Captured. The piece you jumped is taken off the board.', hint: 'Tap your piece, then the free point on the far side of the sapphire.' },
  { title: 'A chain', variant: 'classic', board: rowsOf([[6, 2, 'R'], [5, 3, 'S'], [3, 4, 'S'], [0, 5, 'S']]), goal: { type: 'capture', n: 2 },
    text: 'Leap again from where you land. The whole chain is one move: take both pieces.', done: 'Two pieces in one move. A chain may turn in any direction.', hint: 'Tap your piece, then the point at the end of the chain: up the diagonal, then straight up.' },
  { title: 'You must capture', variant: 'classic', board: rowsOf([[5, 2, 'R'], [4, 2, 'S'], [6, 6, 'R'], [0, 4, 'S']]), goal: { type: 'capture', n: 1 },
    text: 'A capture is compulsory. Try the far piece first: it is not allowed to move while another piece can leap.', done: 'If you can leap you must. Use it: a forced leap can be turned on the other side.', hint: 'Only the piece beside the sapphire can move. Leap it.' },
  { title: 'Crown a Star', variant: 'classic', board: rowsOf([[2, 4, 'R'], [7, 4, 'S']]), goal: { type: 'crown' }, target: 1 * 9 + 4,
    text: 'Reach one of the two far rows and your man is crowned a Star. Step to the ringed point.', done: 'A Star. It moves in every direction and never gets stuck.', hint: 'Tap your piece, then the ringed point straight ahead.' },
  { title: 'The Star leaps far', variant: 'classic', board: rowsOf([[6, 2, 'r'], [3, 5, 'S'], [0, 3, 'S']]), goal: { type: 'capture', n: 1 },
    text: 'In Classic rules a Star leaps from a distance along a line. Jump the sapphire from where you stand.', done: 'A Star flies along a line, leaps, and lands on any free point beyond.', hint: 'Tap the Star, then the free point beyond the sapphire on the same diagonal.' },
  { title: 'Take the last piece', variant: 'classic', board: rowsOf([[4, 4, 'R'], [3, 4, 'S']]), goal: { type: 'win' },
    text: 'Capture every enemy piece to win. One leap finishes the game.', done: 'No pieces left: that wins Peralikatuma.', hint: 'Leap straight over the sapphire.' },
];
