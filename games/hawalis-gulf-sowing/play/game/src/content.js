// All player-facing text, in English. Numbers in the Rules come from the engine's own constants.
import { START_SEEDS, MAX_PLIES, N } from './engine.js';

export const setLang = () => {};
export const getLang = () => 'en';

const STR = {
  appName: 'Hawalis', appSub: 'Gulf Sowing', tagline: 'The four-row sowing game of Oman and the Gulf.',
  playBtn: 'Play', continueBtn: 'Continue game', learnBtn: 'Learn', autoBtn: 'Watch & Learn', howtoBtn: 'How to Play', rulesBtn: 'Rules', aboutBtn: 'About',
  settingsBtn: 'Settings', back: 'Back', next: 'Next', prev: 'Previous', think: 'Think', undo: 'Undo', restart: 'Restart', resume: 'Resume', paused: 'Paused',
  quitMenu: 'Main Menu', soundOn: 'Sound: On', soundOff: 'Sound: Off', thinkTime: 'Watch & Learn think time', seconds: 's',
  restore: 'Restore Purchases', unlock: 'Unlock Full Game', resetProgress: 'Erase Records and Progress', resetConfirm: 'Tap again to erase everything',
  owned: 'Full game unlocked. Thank you!', theme: 'Board', textSize: 'Text size',
  startGame: 'Start game', setupTitle: 'New game', opponentTitle: 'Opponent', sideTitle: 'Your side',
  first: 'Play first (bottom)', second: 'Play second (top)', twoPlayers: 'Two players', youWord: 'You', oppWord: 'Opponent', p1: 'Player 1', p2: 'Player 2',
  lvNovice: 'Novice', lvCasual: 'Casual', lvClub: 'Club', lvExpert: 'Expert', lvMaster: 'Master',
  lvNoviceB: 'Plays any legal move. A gentle first opponent.', lvCasualB: 'Takes captures it can see, but often plays a random move.',
  lvClubB: 'Looks three turns ahead and slips now and then.', lvExpertB: 'Looks six turns ahead and never plays a random move.', lvMasterB: 'Looks ten turns ahead and never plays a random move.',
  twoInfo: 'Two players share the phone. Player 1 sits at the bottom, Player 2 at the top.',
  record: 'Record', wins: 'W', draws: 'D', losses: 'L',
  autoThink: 'Thinking', autoPause: 'Pause', autoPlay: 'Resume', autoExit: 'Exit', autoSlower: 'Think -', autoFaster: 'Think +',
  autoSession: 'Watch & Learn', autoAgain: 'Watch Again', autoSummary: 'You watched two whole games, each move chosen by the game\'s own engine with its reason shown: Master against Master, and Master against Expert.',
  demoLimitTitle: 'FREE PREVIEW FINISHED', demoLimitBody: 'You played the three free games. Get the full game on iPhone and Android for every opponent level, two players on one phone and the full Learn course.',
  demoLeft: '{n} free games left', locked: 'In the full game', lessonsTitle: 'Learn', lessonDone: 'Done', again: 'Play Again', newSetup: 'Change Game',
  lessonNext: 'Next Lesson', lessonRetry: 'Try Again', lessonList: 'All Lessons', lessonOf: 'Lesson {n} of {m}', correct: 'Correct!', notQuite: 'Not quite',
  yourMove: 'Your move', thinking: 'Thinking...', turnOf: '{who} to move', pickHole: 'Tap one of your holes that holds seeds.',
  sowing: 'Sowing...', nothingUndo: 'Nothing to undo',
  singleNote: 'A single seed can only be played when every one of your holes holds one seed or none.',
  youWon: 'You win!', youLost: '{who} wins', drawWord: 'A draw', winsWord: '{who} wins!',
  finalScore: 'Seeds captured: {a} to {b}', cappedNote: ' The game reached its {n}-turn limit.',
  youTook: 'You captured {n}', theyTook: '{who} captured {n}', tookNothing: 'No capture that turn',
  pileCap: 'Captured', pileBoard: 'On board', toMove: 'to move', waiting: 'waiting', winner: 'Winner',
  hintHead: 'Play the {row} row, hole {n} from the left',
  r_capture: 'This captures {a} seeds. The opponent\'s best answer then captures {b}.',
  r_only: 'This is your only legal move.',
  r_safe0: 'No capture is available, so this is the safest move: the opponent has no capture in reply.',
  r_safe: 'No capture is available, so this is the safest move: the opponent\'s best answer captures only {a}, the least of any move.',
  r_steady: 'Searching ahead, this keeps you furthest ahead. The opponent\'s best immediate answer captures {a}.',
  r_endWin: 'This ends the game with you ahead.', r_endDraw: 'This ends the game level.', r_endLoss: 'Every move ends the game behind; this loses by the least.',
  r_notBest: 'Not the strongest move: the engine prefers {h}.',
  lessonWrongNone: 'That move captures nothing. A capture needs the last seed to land in a hole of your inner row that faces a hole of the opponent that holds seeds.',
  lessonWrongLess: 'That move captures {a}, but another captures {b}. Follow each hole\'s sowing to its end and compare.',
  lessonWrongDef: 'After that move the opponent can capture {a}. Find a move that leaves no capture.',
  savedGame: 'Saved game',
};

export const tr = (key, vars) => {
  let s = STR[key] ?? key;
  if (vars) for (const k of Object.keys(vars)) s = s.split(`{${k}}`).join(vars[k]);
  return s;
};
export const levelName = (id) => tr(`lv${id[0].toUpperCase()}${id.slice(1)}`);
export const levelBlurb = (id) => STR[`lv${id[0].toUpperCase()}${id.slice(1)}B`];

// A move in words, from explain.moveWords { row, col }.
const ROWW = ['outer', 'inner'];
export const hintText = (r, w) => ({ head: STR.hintHead.replace('{row}', ROWW[w.row]).replace('{n}', w.col), why: (STR[`r_${r.code}`] ?? '').split('{a}').join(r.a).split('{b}').join(r.b) });
export const notBestText = (h) => STR.r_notBest.replace('{h}', h);

// ------------------------------------------------------------------------------------------------ How to Play
const HOWTO = [
  { title: 'The goal', art: 'board', body: 'Capture more of your opponent\'s seeds than they capture of yours. The board has four rows of seven holes, and every hole starts with two seeds. When one player has no seeds left, the game is over, and whoever has captured more wins.' },
  { title: 'Your holes', art: 'owner', body: 'You own the two rows nearest you: the outer row at the very edge and the inner row beside the channel in the middle. The other two rows are your opponent\'s. You only ever sow seeds round your own fourteen holes.' },
  { title: 'Your move', art: 'tap', body: 'Tap one of your holes that holds seeds. All its seeds are picked up and dropped one by one into the next holes of your loop, following the small arrows. If you have any hole with two or more seeds you must play one of those. Undo takes a move back.' },
  { title: 'Keep sowing', art: 'relay', body: 'If your last seed falls into a hole that already holds seeds and does not capture, pick up everything in that hole and keep sowing from there. Your turn goes on until a last seed falls into an empty hole, or captures.' },
  { title: 'Capturing', art: 'capture', body: 'When your last seed falls into a hole of your inner row, look straight across at your opponent\'s inner hole facing it. If it holds seeds, you capture them and they leave the board. Then your turn ends.' },
  { title: 'Both holes of a column', art: 'column', body: 'If the opponent\'s outer hole behind that facing hole also holds seeds, you capture both together. The outer row cannot be reached by itself: it falls only when the hole in front of it falls too.' },
  { title: 'Game end', art: 'end', body: 'The game ends when one player has no seeds left in their holes. The player with more captured seeds wins. Think shows the best move and says why; Learn and Watch & Learn teach the rest.' },
];

// ------------------------------------------------------------------------------------------------ Rules
const CAL = { en: '' };
export const setCalibration = (en) => { CAL.en = en; };

const rulesEn = () => [
  { title: 'The board', art: 'board', body: [
    `Hawalis is played on four rows of seven holes: ${N} holes in all, carved in a wooden board. Every hole starts with ${START_SEEDS} seeds, so the board holds ${N * START_SEEDS} seeds.`,
    'Player 1 sits at the bottom and Player 2 at the top. Against the computer you are the bottom if you play first and the top if you play second. A carved channel runs between the two halves of the board.',
  ] },
  { title: 'Whose holes are whose', art: 'owner', body: [
    'Each player owns the two rows on their side of the board, fourteen holes. The row at the edge, nearest the player, is the outer row. The row beside the channel is the inner row. Player 1\'s holes are outlined in gold, Player 2\'s in green-blue, and each player\'s half is lightly tinted.',
    'You may only start a turn from one of your own holes. Seeds never leave your own fourteen holes while you sow, so they stay yours until they are captured.',
  ] },
  { title: 'Your turn: pick and sow', art: 'turn', body: [
    'Choose one of your holes that holds seeds. Pick up every seed in it and drop them one by one into the following holes of your own loop, one seed per hole. The small arrows on the board show the direction. Sowing goes counter-clockwise as you see the board.',
    'The turn then continues by the rules on the next pages: a capture, relay sowing, or the turn simply ends.',
  ] },
  { title: 'Your loop of fourteen', art: 'wrap', body: [
    'Your fourteen holes form a loop. For Player 1 it runs along the outer (bottom) row from the left to the right, then steps up into the inner row and back along it from the right to the left; after the last inner hole it goes round to the first hole of the outer row. Player 2\'s loop is the same loop turned half way round: along the top row from the right to the left, then down into the inner row and along it from the left to the right.',
    'A hole with fourteen or more seeds sows all the way round and drops a seed into the hole it was picked up from.',
  ] },
  { title: 'Which hole you may play', art: 'tap', body: [
    'If any of your holes holds two or more seeds, you must start your turn from one of those holes. A hole with a single seed may be played only when every one of your holes holds at most one seed.',
    'If you tap a single-seed hole when you have to play a bigger one, the move is refused and you are told why. If you have no seeds at all, the game is over.',
  ] },
  { title: 'Capturing', art: 'capture', body: [
    'When the last seed you drop falls into a hole of your inner row, look at the opponent\'s inner hole facing it, straight across the channel. If that hole holds seeds, you capture all of them. Captured seeds are removed from the board and added to your captured pile. The turn then ends.',
    'This holds whether the hole you landed in was empty or already held seeds. Landing in your outer row never captures. If the facing hole is empty, nothing is captured.',
  ] },
  { title: 'Both holes of a column', art: 'column', body: [
    'Behind each opponent inner hole stands the opponent\'s outer hole of the same column. If your capture takes the facing inner hole and the outer hole behind it also holds seeds, you capture the outer hole as well, both together.',
    'If the facing inner hole is empty, nothing is captured, even when the outer hole behind it is full. An outer hole falls only together with the inner hole in front of it.',
  ] },
  { title: 'Relay sowing', art: 'relay', body: [
    'If the last seed you drop does not capture, and it fell into a hole that already held seeds, pick up every seed now in that hole (the one you just dropped included) and keep sowing from that hole, in the same direction. This repeats for as long as the last seed lands on a hole that was not empty and does not capture.',
    'A very long relay is possible. The engine stops a relay after 400 pick-ups so that a turn can never go on for ever; in practice it never gets near that.',
  ] },
  { title: 'When a turn ends', art: 'stop', body: [
    'A turn ends when the last seed falls into an empty hole that does not capture, or when a capture is made. Play then passes to the opponent. Nothing is lost: the seeds you sowed stay where they fell.',
    'There is no passing. If you have seeds you must play, and if you have none the game is over.',
  ] },
  { title: 'How a game ends', art: 'end', body: [
    'The game ends when, after a move, either player has no seeds left in their own holes. The player who ran out has lost every seed they owned, so the other player has captured more.',
    `Captured seeds are the score, and more captured seeds win; equal scores are a draw. There is also a safety limit of ${MAX_PLIES} turns: if the game is still going, it ends and the player with more captured seeds wins.`,
  ] },
  { title: 'Where these rules come from', art: 'board', body: [
    'Hawalis is a traditional sowing game of Oman, also played on the coast of Zanzibar, where one version is called Bao la Kiarabu. It is described by the Oxford scholar Thomas Hyde in 1694 and was studied in Oman by Alex de Voogt, who published an account in 2003. The Omani form is played on four rows of seven holes with two seeds in each hole, counter-clockwise relay sowing, a must-start-from-two rule, and inner-row captures of the facing hole and the hole behind it.',
    'This game follows that published description, which a second published description of the game (the Ludii game library) agrees with on counter-clockwise relay sowing, the no-single-seed rule and inner-row captures. The Zanzibar version on a two-row board with sixteen holes, clockwise sowing, and a rule that captures outer holes even when the inner hole is empty is a different game and is not what you play here.',
  ] },
  { title: 'What is our own choice', art: 'board', body: [
    'Published descriptions are short, so a few details are our own choices and not a claim about how any one community plays. Players alternate turns, and Player 1 moves first. Captured seeds leave the board. A capture ends the turn at once, before any relay. The game ends when one side is out of seeds or after ' + MAX_PLIES + ' turns.',
    'The traditional game is often played to a count of captured seeds over several rounds. Here one round decides the game, so a single game fits a short session.',
  ] },
  { title: 'Making a move', art: 'tap', body: [
    'Tap one of your holes that holds seeds and it is played at once: a hand glides along the board and drops the seeds one by one. Tapping an empty hole or one of the opponent\'s holes flashes it and does nothing. A second finger resting on the screen is ignored.',
    'On a keyboard the keys 1 to 7 play the holes of your outer row from the left. The left and right arrow keys move a marker along all your holes and Enter or Space plays the marked one. U is Undo, T is Think, R is Restart, and Escape or P pauses.',
  ] },
  { title: 'Think and Undo', art: 'think', body: [
    'Think searches eight turns ahead, lights the hole it likes best and gives the reason with numbers it has just worked out: how many seeds the move captures, and the most the opponent can capture in answer. It never moves for you and is free.',
    'Undo takes back your last move and the computer\'s answer, so it is your turn again. Your game is saved after every move: Continue game on the menu resumes it, paused.',
  ] },
  { title: 'Opponents', art: 'levels', body: [
    'Novice plays any legal move. Casual looks one turn ahead but plays a random move three times in ten. Club looks three turns ahead and slips one time in ten. Expert looks six turns ahead and Master ten, and neither ever plays a random move.',
    `${CAL.en} In two-player mode both players share the phone and the player to move is marked.`,
  ] },
  { title: 'Learn and Watch & Learn', art: 'learn', body: [
    'Learn is a course of six lessons: capture, two holes at once, relay, the outer row, defend and a whole game. A wrong move is not played: you are told why and can try again.',
    'Watch & Learn plays two whole games with THINK (2, 5, 8 or 10 seconds), REVEAL (two seconds: the possible holes light up and the chosen hole is marked, with the reason in words) and ACT (the seeds are sown). Pause freezes everything where it is.',
  ] },
  { title: 'Boards and text', art: 'themes', body: [
    'Settings offers two boards (Dhow Teak, Sadu Weave), sound, the Watch & Learn think time and text size up to 300 percent on every text screen, including the game screen. There are no timers; the free preview is the first 90 seconds of real play.',
    'The seeds are drawn as pearls, a nod to the pearl divers of the Gulf. The woven diamond band on the frame follows the patterns of Sadu weaving.',
  ] },
];
export const howtoPages = () => HOWTO;
export const rulesPages = () => rulesEn();
export const RULE_COUNT = rulesEn().length;
export const HOWTO_COUNT = HOWTO.length;

export const aboutSections = () => [
  { title: 'About the game', body: 'Hawalis is the four-row sowing game of Oman and the Gulf, played on a carved teak board with pearl seeds that are dropped one at a time.' },
  { title: 'Where it comes from', body: 'Hawalis is a traditional sowing game of Oman, also played on the coast of Zanzibar, where one version is called Bao la Kiarabu. It was described in writing in 1694 and studied in Oman in 2003. The board has four rows of seven holes and each player owns two rows. Descriptions are short, so this game follows the published Omani form, states its rules in full on the Rules pages and says where it makes its own choices.' },
  { title: 'The look', body: 'The board is inspired by Gulf craft: dark teak, brass studs like those on old carved doors, a woven diamond band in the pattern of Sadu weaving, and pearls for seeds.' },
  { title: 'In this game', body: 'Four rows of seven holes, two seeds in each, relay sowing and inner-row captures. Five opponent levels from Novice to Master, two players on one phone, Think with a reason in words, six lessons and Watch & Learn. A free preview, then one purchase unlocks the game. No timers and no ads.' },
];
