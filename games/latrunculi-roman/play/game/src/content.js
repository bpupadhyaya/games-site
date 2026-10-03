// All player-facing text (English). Numbers come from the engine's own constants so the Rules pages cannot drift from it.
import { SOLDIERS, QUIET_LIMIT, rc, cellName } from './rules.js';

const HALF = QUIET_LIMIT / 2;

export const STR = {
  playBtn: 'Play', continueBtn: 'Continue game', learnBtn: 'Learn', autoBtn: 'Watch & Learn',
  howtoBtn: 'How to Play', rulesBtn: 'Rules', aboutBtn: 'About', settingsBtn: 'Settings',
  back: 'Back', next: 'Next', prev: 'Previous', think: 'Think', undo: 'Undo',
  restart: 'Restart', resume: 'Resume', paused: 'Paused', quitMenu: 'Main Menu',
  soundOn: 'Sound: On', soundOff: 'Sound: Off', thinkTime: 'Watch & Learn think time',
  seconds: 's', restore: 'Restore Purchases', unlock: 'Unlock Full Game',
  resetProgress: 'Erase Records and Progress', resetConfirm: 'Tap again to erase everything',
  owned: 'Full game unlocked. Thank you!', theme: 'Board and pieces',
  startGame: 'Start game', opponentTitle: 'Opponent', sideTitle: 'Your side',
  playIvory: 'Ivory: move first', playJet: 'Jet: move second',
  twoPlayers: 'Two players', youWord: 'You', vsComputer: 'vs computer',
  autoThink: 'Thinking {n}', thinkingDots: 'Thinking...',
  autoPause: 'Pause', autoPlay: 'Resume', autoExit: 'Exit', autoSlower: 'Think -', autoFaster: 'Think +',
  autoSession: 'Watch & Learn', autoAgain: 'Watch Again',
  autoSummary: 'You watched a whole game, with every move explained. Watch again for a different game, or head to Learn to try the ideas yourself.',
  demoLimitTitle: 'FREE PREVIEW FINISHED',
  demoLimitBody: 'You played the three free games. Get the full game on iPhone and Android for every opponent level, two players on one phone, all the lessons and the other boards.',
  demoLeft: '{n} free games left',
  ludus: 'Ludus', latrunculorum: 'Latrunculorum', tagline: 'The Roman game of little soldiers',
  taglineSub: 'Slide. Sandwich. Enclose the dux.',
  record: 'Record', recordLine: '{label} ({level}): {w} W  {d} D  {l} L',
  lessonsTitle: 'Learn', lessonDone: 'Done', lessonStep: 'Lesson',
  again: 'Play Again', newSetup: 'Change Game', lessonNext: 'Next Lesson',
  lessonRetry: 'Try Again', lessonList: 'All Lessons',
  textSize: 'Text size', locked: 'In the full game',
  ivory: 'Ivory', jet: 'Jet', soldiersWord: 'soldiers', duxWord: 'dux',
  twoInfo: 'Two players share the phone. Ivory moves first.',
  sideInfo1: 'You are Ivory and move first, from the bottom of the board.',
  sideInfo2: 'You are Jet and move second. The board is turned so that your pieces are at the bottom.',
  // HUD
  vsLevel: 'vs computer · {level}', lessonOf: 'Lesson {n} of {m}',
  noCapture: ' · no capture {q}/{m}', watchSub: 'Watch & Learn · Think {n}s',
  winnerWord: 'Winner', drawWord: 'Draw', opponentWord: 'Opponent',
  toMove: '{side} to move',
  pickYou: 'Your turn: pick one of your pieces', targetYou: 'Now pick where it slides to',
  pickSide: '{side}: pick a piece to slide', targetSide: '{side}: pick where it slides',
  // toasts
  capturedToast: 'Captured {n}', tStuck: 'That piece has no free square beside it.',
  tFoe: 'Slide one of your own pieces.', tFar: 'A piece slides along its row or column over empty squares, and stops before the first piece in its way.',
  tEmpty: 'Pick one of your own pieces first.', tUndo: 'Nothing to undo',
  // end of game
  aDraw: 'A draw', youWin: 'You win!', levelWins: '{name} wins', sideWin: '{side} win!',
  endDux: 'The dux was enclosed on every side.', endDuxYou: 'Your dux was enclosed on every side.', endDuxOpp: 'The enemy dux was enclosed on every side.',
  endSoldiers: 'Only the dux was left: it cannot capture alone.', endSoldiersYou: 'You were left with only your dux.', endSoldiersOpp: 'The other side was left with only its dux.',
  endBlocked: 'The other side had no move.', endBlockedYou: 'You had no move.', endBlockedOpp: 'The other side had no move.',
  stallLead: '{n} moves passed with no capture',
  endEqual: '{lead}, and both sides have {n} and equal room to move.',
  endRoomYou: '{lead}. Pieces are level at {n} each, and you have more room to move ({a} moves to {b}).',
  endRoomOne: '{lead}. Pieces are level at {n} each, and {name} has more room to move ({a} moves to {b}).',
  endRoomSide: '{lead}. Pieces are level at {n} each, and {side} have more room to move ({a} moves to {b}).',
  endMoreYou: '{lead}, and you have more pieces ({a} to {b}).',
  endMoreOne: '{lead}, and {name} has more pieces ({a} to {b}).',
  endMoreSide: '{lead}, and {side} have more pieces ({a} to {b}).',
  notQuite: 'Not quite', correct: 'Correct!',
  // illustrations
  cStart: 'the starting position', cSlide: 'slides until something is in the way', cSlideIn: 'slide in to sandwich', cGone: 'the sandwiched soldier is gone',
  cTwoSand: 'two sandwiches at once', cBoth: 'both taken', cBetween: 'sliding in between two enemies is safe',
  cEdge: 'on an edge, only along the edge', cCornerEx: 'corner: both squares beside it',
  cCloseIn: 'slide in to close the last side', cDuxSafe: 'sandwiched, but a dux is only lost when enclosed', cEnclose: 'all four sides held: the dux is lost',
  cCentre: 'centre: 4 sides', cEdgeD: 'edge: 3 sides', cCorner: 'corner: 2 sides', cDuxOwn: 'a friendly piece beside the dux keeps it safe',
  cLone: 'only the dux is left', cBlocked: 'Jet cannot move: Ivory wins', cStall: '{n} moves with no capture: count the pieces, then the room',
  cIvoryFirst: 'moves first', cJetSecond: 'moves second', cThinkEx: 'Captures 1 soldier by sandwiching it.', cThinkReveal: 'THINK  ·  REVEAL  ·  ACT',
  cSoldier: 'soldier', cDux: 'dux',
  // Think and its reasons
  hSlide: 'Slide {a} to {b}',
  wCapOne: 'Captures 1 soldier by sandwiching it between two of yours.',
  wCapMany: 'Captures {n} by sandwiching them between two of yours.',
  wCapCorner: 'It takes a soldier standing in a corner, which falls to the two squares beside it.',
  wWinDux: 'This closes the last open side around the enemy dux: it wins the game.',
  wWinSoldiers: 'That leaves the enemy with only its dux, which cannot capture alone: it wins the game.',
  wWinBlocked: 'After this the other side has no move at all: it wins the game.',
  wNoReply: 'And it leaves your opponent no capture in reply.',
  wReply: 'Your opponent can still capture up to {n} in reply, but nothing else scored better.',
  wReplyDux: 'Your opponent can still enclose your dux in reply, but nothing else scored better.',
  wEscape: 'This soldier was about to be sandwiched. Moving it takes it out of danger.',
  wDuxEscape: 'Your dux was one move from being enclosed. This move gives it room again.',
  wBlockDux: 'Your dux was one move from being enclosed. This move fills the square your opponent needed.',
  wSetup: 'This threatens a capture of up to {n} next turn and leaves none of your soldiers open.',
  wSetupDux: 'This threatens to enclose the enemy dux next turn and leaves none of your soldiers open.',
  wBeside: 'It moves next to the enemy dux, a step towards enclosing it.',
  wFewer: 'It leaves fewer of your soldiers open to capture than before.',
  wNone: 'It leaves none of your soldiers open to capture.',
  wDepth: 'Looking {d} moves ahead, it keeps the best balance of soldiers.',
  // lesson feedback
  jTarget: 'Not quite. Slide the marked soldier to the marked square.',
  jNothing: 'Not quite. That move captures nothing. Look for an enemy soldier with one of yours on one side and an open square on the other that one of your pieces can slide into.',
  jLess: 'Not quite. That captures {a}, but another move captures {b}.',
  jUnsafe: 'Not quite. After that move your opponent can capture {n}. Find a move that leaves nothing to capture.',
  jDuxUnsafe: 'Not quite. After that move your opponent can still enclose your dux. Find a move that stops it.',
  jWin: 'Not quite. That does not close the last side around the dux.',
  jBlock: 'Not quite. The other side still has a move after that. Find the move that closes the last gap.',
  // opponent levels
  lvNovice: 'Novice', lvCasual: 'Casual', lvSkilled: 'Skilled', lvExpert: 'Expert', lvMaster: 'Master',
  bNovice: 'Learning the game. Moves almost at random and takes a capture only now and then.',
  bCasual: 'Takes the captures it sees and avoids the simplest traps, but does not plan.',
  bSkilled: 'Looks two moves ahead and rarely leaves a piece hanging. Beatable with a good plan.',
  bExpert: 'Looks three moves ahead and weighs every exchange. Rarely falls for a trap.',
  bMaster: 'The strongest: looks five moves ahead and guards its dux carefully. Slips only rarely.',
  // boards
  thCarrara: 'Carrara Marble', thNero: 'Nero and Gold', thPorphyry: 'Imperial Porphyry',
  thCarraraShort: 'Carrara', thNeroShort: 'Nero', thPorphyryShort: 'Porphyry',
};

export const tr = (key, vars) => {
  let s = STR[key] ?? key;
  if (vars) for (const k of Object.keys(vars)) s = s.split(`{${k}}`).join(String(vars[k]));
  return s;
};

export const piecesText = (n) => `${n} ${n === 1 ? 'piece' : 'pieces'}`;
export const soldiersText = (n) => `${n} ${n === 1 ? 'soldier' : 'soldiers'}`;
export const soldiersObj = soldiersText;
const cap1 = (id) => `${id[0].toUpperCase()}${id.slice(1)}`;
export const lvName = (id) => tr(`lv${cap1(id)}`);
export const lvBlurb = (id) => tr(`b${cap1(id)}`);
export const themeName = (id) => tr(`th${cap1(id)}`);
export const themeShort = (id) => tr(`th${cap1(id)}Short`);
export const sideLabel = (who) => tr(who === 1 ? 'ivory' : 'jet');
export function cellWords(i) { return cellName(i); }
export { rc };

// ------------------------------------------------------------------------------------------------ How to Play
const HOWTO = [
  { art: 'goal', title: 'The goal',
    body: `Two armies face each other on a marble board. Each side has ${SOLDIERS} soldiers and one leader, the dux. You win by enclosing the enemy dux, by leaving the other side with no move, or by taking every soldier so that only a dux is left.` },
  { art: 'move', title: 'Moving',
    body: 'Tap one of your pieces, then tap a marked square. A piece slides any distance along its row or column over empty squares, like a rook, and stops before the first piece in its way. It cannot jump and cannot go diagonally.' },
  { art: 'capture', title: 'Capturing',
    body: 'When your move leaves an enemy soldier with one of your pieces on each side, in a row or a column, it is taken. One move can take several soldiers at once. Moving between two enemy pieces is safe: only the piece that moves can capture.' },
  { art: 'edge', title: 'Edges and corners',
    body: 'A soldier on an edge can only be taken along that edge. A soldier in a corner is taken when your pieces stand on both squares beside it.' },
  { art: 'enclose', title: 'The dux',
    body: 'The dux cannot be taken by a sandwich. It is lost when every square beside it is held by the other side or is off the board: four sides in the middle, three on an edge, two in a corner. A friendly piece beside it keeps it safe.' },
  { art: 'blocked', title: 'Other ways to win',
    body: `If the side to move has no legal move, it loses. A side left with only its dux has lost too. If ${QUIET_LIMIT} moves in a row pass with no capture, the side with more pieces wins. With equal pieces, the side with more room to move wins, and only equal room is a draw.` },
  { art: 'think', title: 'Think and Learn',
    body: 'Think shows a good move and explains why in plain words. Learn is a short course with real positions, and Watch & Learn plays a whole game for you with a Pause button.' },
];

// ------------------------------------------------------------------------------------------------ Rules
const RULES = [
  { art: 'goal', title: 'The game', body: [
    `Ludus Latrunculorum, the game of little soldiers, is a two-player game for an 8x8 board. Each side has ${SOLDIERS} soldiers and one dux (the leader): 16 pieces. One side plays Ivory (pale, turned bone) and the other Jet (dark glass). Ivory always moves first.`,
    'Players take turns to move one piece. Pieces are taken by sandwiching soldiers between two of your own pieces. The dux is lost by enclosure. The game is won by enclosing the enemy dux, by leaving the other side with no move, or by taking every enemy soldier.',
  ] },
  { art: 'board', title: 'The board and the pieces', body: [
    'The board is 64 squares in eight rows and eight columns, marked a to h from left to right and 1 to 8 from the bottom. Ivory starts on ranks 1 and 2 and Jet on ranks 7 and 8.',
    'A soldier is a plain disc. The dux is slightly larger, with a raised dome ringed by a wreath and a small gold stud, so it is easy to find among the soldiers on every board.',
  ] },
  { art: 'goal', title: 'The starting position', body: [
    `Each side fills its two home rows with ${SOLDIERS} soldiers and one dux. Ivory's dux stands on d1 and Jet's on e8, so the two armies are turned half a circle from each other.`,
    'Nothing is placed during the game: there is no placement phase. The four rows in the middle begin empty.',
  ] },
  { art: 'move', title: 'Moving', body: [
    'On your turn you must move one of your pieces. It slides any number of squares along its row or column through empty squares and lands on an empty square. It cannot jump over any piece, friend or enemy, and cannot move diagonally. Soldiers and the dux move in exactly the same way.',
    'Tap a piece to select it: every square it can reach is marked, and squares that would take something are marked in red with a cross on the pieces they take. Tap the piece again to put it back.',
  ] },
  { art: 'capture', title: 'Capturing by sandwich', body: [
    'An enemy soldier is taken when one of your pieces stands on each side of it, in the same row or the same column. You take by moving: the piece you slide must be one of the two that close the sandwich. Either of your two pieces may be a soldier or your dux.',
    'The taken soldier is removed from the board at once. Diagonals do not count. You do not move again after a capture.',
  ] },
  { art: 'multi', title: 'Taking several at once', body: [
    'One move can close several sandwiches at once, in any of the piece\'s directions. Every enemy soldier that now has one of your pieces on each side is taken together.',
    'A good move often threatens two sandwiches at the same time: the other side can only answer one.',
  ] },
  { art: 'between', title: 'Moving between two enemies', body: [
    'Only the piece that has just moved can take, and only on its own side\'s turn. If you slide a piece into the gap between two enemy pieces it is not taken. It can stay there safely until one of the enemy pieces leaves and comes back.',
    'The same holds for an enemy soldier that is already between two of your pieces: it is not taken unless one of your pieces moves away and a piece moves in again to close the sandwich.',
  ] },
  { art: 'edge', title: 'Edges', body: [
    'A sandwich needs a square on both sides of the soldier along a line. A soldier on an edge has no square beyond it across the edge, so it can only be taken along the edge.',
    'That makes the edges a safer place for a soldier, though a soldier there also has fewer places to go.',
  ] },
  { art: 'corner', title: 'Corners', body: [
    'A soldier standing in a corner has no line through it at all, so it cannot be sandwiched in the usual way. Instead it is taken when your pieces stand on both squares beside the corner: for the corner a8, those are b8 and a7.',
    'The same applies to all four corners. A dux in a corner is lost in the same way: when both squares beside it are held by the other side.',
  ] },
  { art: 'dux', title: 'The dux', body: [
    'The dux is never taken by a sandwich: two enemy pieces on either side of it do nothing. It moves like any other piece and may help to take enemy soldiers as one of the two pieces of a sandwich.',
    'It is lost only by enclosure, and losing it loses the game, so it is worth guarding. Keep a friendly piece beside it, or keep it where it has room to slide away.',
  ] },
  { art: 'enclose', title: 'Enclosing the dux', body: [
    'The dux is enclosed when every square directly beside it (up, down, left and right) is either off the board or held by the other side. A dux in the middle needs four enemy pieces, on an edge three, in a corner two.',
    'A friendly piece beside the dux, even one that cannot move, keeps it safe, because that square is not held by the enemy. The enclosure counts only on the turn when the last enemy piece arrives: the dux is lost the moment you close the last side. A dux that walks into an almost closed space is not lost until the enemy closes it.',
  ] },
  { art: 'enclose2', title: 'How many sides', body: [
    'In the middle of the board a dux has four neighbours. On an edge it has three, and in a corner two. Fewer neighbours means fewer pieces are needed to enclose it, so a dux near the edge is in more danger than one in the middle with friends beside it.',
    'When a move you are considering would enclose the enemy dux, the dux is ringed in red before you commit. Think mentions it in its reason when a move saves your own dux.',
  ] },
  { art: 'lone', title: 'Only the dux left', body: [
    'If every soldier of one side has been taken and only its dux remains, that side has lost. A lone dux can never be one of two pieces closing a sandwich, so it can never take anything again.',
    'In practice the dux is usually enclosed first, but this is the rule that ends a game when the soldiers run out.',
  ] },
  { art: 'blocked', title: 'No legal move', body: [
    'If it is a side\'s turn and none of its pieces has an empty square beside it, it cannot move, and it loses. The side that made the last move wins. This is how a game can end when one army has been hemmed in against an edge.',
    'The game checks this after every move, including moves that take soldiers.',
  ] },
  { art: 'stall', title: 'Drawn-out games', body: [
    `If ${QUIET_LIMIT} moves in a row (${HALF} by each side) pass with no capture, the game ends. The side with more pieces on the board wins, counting the dux. If the pieces are equal, the side with more room wins: room is the number of moves the side's pieces could make right now, counting every square each piece could slide to, as if it were that side's turn. Only equal pieces and equal room make a draw. The no-capture count is shown at the top of the game screen.`,
    'A capture always starts the count again from zero. There is no other repetition rule: the no-capture count is what ends a stand-off.',
  ] },
  { art: 'reconstruct', title: 'Where reconstructions differ', body: [
    'No complete rulebook of the Roman game survives, so every modern version is a reconstruction from short descriptions and from boards found at Roman sites. Reconstructions disagree about the board size (from about 7x8 up to 10x11 squares have been proposed), the number of pieces (about 12 to 24 each), whether pieces move one square or any distance, and whether there is a dux.',
    'Some reconstructions (for example R. C. Bell\'s) give the dux a jumping move and a second move after a capture; others (for example Ulrich Schädler\'s) treat a trapped piece as blocked rather than removed. This game makes one set of choices: 8x8, sixteen pieces a side, slides of any length, removal on capture, a dux lost by enclosure, corner soldiers taken by two pieces, a single move per turn and a no-capture limit. It is a reconstruction, not a claim about how the Romans played.',
  ] },
  { art: 'sides', title: 'Choosing a side', body: [
    'Before a game you choose to play Ivory or Jet against the computer. Ivory moves first. The board is turned at the start of the game so that your own pieces are at the bottom; the letters and numbers around it follow.',
    'In two-player mode the phone is passed between the players: Ivory moves first, then Jet.',
  ] },
  { art: 'levels', title: 'The opponent levels', body: [
    'Five levels, from Novice to Master. Novice moves almost at random. Casual takes the captures it sees. Skilled searches two moves deep, Expert three and Master five, counting each side\'s move separately, and Master guards its dux with care.',
    'Every level was tested against the one below it in many computer-against-computer games, with sides swapped, and each beats the one below more often than it loses to it. No win is guaranteed against any level, and games between strong players are often settled on the no-capture limit, by pieces or by room.',
  ] },
  { art: 'think', title: 'Think', body: [
    'Think suggests a move and says why in words: a capture, a soldier leaving danger, a dux gaining room, or a threat being set up. The game engine checks every reason against the position before showing it.',
    'Think never moves for you and is free to use as often as you like, for either side.',
  ] },
  { art: 'undo', title: 'Undo and Restart', body: [
    'Undo takes back your last move and the reply to it. In two-player mode it takes back one move. Restart begins again from the starting position.',
    'Your game is saved after every move. Leave and come back, and Continue game on the menu takes you back to it, paused.',
  ] },
  { art: 'learn', title: 'Learn', body: [
    'Learn is a short course of real positions: how pieces slide, capturing, taking two at once, moving between two enemies, edges and corners, staying safe, enclosing the dux, guarding your own dux and leaving the other side with no move. A move that is wrong is not played: you are told why and can try again.',
    'Lessons you finish are ticked. They do not use up the free preview.',
  ] },
  { art: 'auto', title: 'Watch & Learn', body: [
    `Watch & Learn plays a whole game for you with the game's own opponent engine on both sides. Each decision has three steps: THINK (2, 5, 8 or 10 seconds, you choose), REVEAL (two seconds: the options light up and the chosen move is marked, with the reason in words) and ACT.`,
    'Pause freezes everything where it is and Resume carries on from exactly there. Watch & Learn does not use up the free preview.',
  ] },
  { art: 'themes', title: 'Boards and sound', body: [
    'In Settings you can choose the board: Carrara Marble, Nero and Gold, or Imperial Porphyry. The rules do not change. Sound can be switched off, the think time of Watch & Learn set, and the text size raised up to 300 percent on every text screen, including the game screen.',
    'There are no timers and no stakes: results are only kept as your own record of wins, draws and losses for each level. The game starts with a free preview of the first 90 seconds of play; the full game is a single one-time unlock and works offline.',
  ] },
];

const ABOUT = [
  { title: 'Ludus Latrunculorum', body: 'The Roman game of little soldiers on a marble board, with pieces of turned bone and dark glass. Slide your soldiers like rooks, sandwich the other side\'s soldiers to take them, and enclose its dux.' },
  { title: 'Where it comes from', body: 'Latrunculi was a board game of the Roman world, played by two armies of small soldiers. Roman writers mention it from about the first century BC, and boards that may have been used for it have been found at Roman sites in several places. The name comes from latrones, the soldiers.' },
  { title: 'A reconstructed game', body: 'No full rulebook survives, so today\'s versions are reconstructions. This one uses an 8x8 board, sixteen pieces a side including a dux, rook-style slides, capture by sandwiching and a dux lost by enclosure. The Rules explain where reconstructions differ and which choices this game makes.' },
  { title: 'In this game', body: 'Five opponent levels from Novice to Master, two players on one phone, Think with a plain-English reason, a short Learn course and Watch & Learn. Three boards to choose from, text that scales up to 300 percent, no timers, works offline.' },
];

export const getHowto = () => HOWTO;
export const getRules = () => RULES;
export const getAbout = () => ABOUT;
export const RULE_COUNT = RULES.length;
export const HOWTO_COUNT = HOWTO.length;
