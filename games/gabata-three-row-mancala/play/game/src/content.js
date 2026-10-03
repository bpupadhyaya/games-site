// All player-facing text. The language is a visible choice on first launch and on the main menu: "Play in English" or the
// Amharic choice. The English text is complete. The Amharic choice covers the game's name, the menus, buttons, level names,
// scores and result headings only (key terms): the long texts (Rules, How to Play, About, lessons and the reasons given by
// Think) stay in English in both modes and say so. Numbers in the Rules come from the engine's own constants.
import { START_SEEDS, MAX_PLIES } from './engine.js';

let LANG = 'en';
export const setLang = (l) => { LANG = l === 'am' ? 'am' : 'en'; };
export const getLang = () => LANG;

const STR = {
  en: {
    appName: 'Gabata', appSub: 'Three-Row Sowing', tagline: 'The three-row sowing game of Ethiopia and Eritrea.',
    langHead: 'Choose your language', langNote: 'Amharic covers the game name, menus, buttons, scores and short messages. The long texts (Rules, lessons, hints) stay in English, and the Amharic was written without review by a native speaker. You can change this any time on the main menu.',
    playBtn: 'Play', continueBtn: 'Continue game', learnBtn: 'Learn', autoBtn: 'Watch & Learn', howtoBtn: 'How to Play', rulesBtn: 'Rules', aboutBtn: 'About',
    settingsBtn: 'Settings', back: 'Back', next: 'Next', prev: 'Previous', think: 'Think', undo: 'Undo', restart: 'Restart', resume: 'Resume', paused: 'Paused',
    quitMenu: 'Main Menu', soundOn: 'Sound: On', soundOff: 'Sound: Off', thinkTime: 'Watch & Learn think time', seconds: 's',
    restore: 'Restore Purchases', unlock: 'Unlock Full Game', resetProgress: 'Erase Records and Progress', resetConfirm: 'Tap again to erase everything',
    owned: 'Full game unlocked. Thank you!', theme: 'Board', textSize: 'Text size', language: 'Language',
    startGame: 'Start game', setupTitle: 'New game', opponentTitle: 'Opponent', sideTitle: 'Your side',
    first: 'Play first (bottom)', second: 'Play second (top)', twoPlayers: 'Two players', youWord: 'You', oppWord: 'Opponent', p1: 'Player 1', p2: 'Player 2',
    lvNovice: 'Novice', lvCasual: 'Casual', lvClub: 'Club', lvExpert: 'Expert', lvMaster: 'Master',
    lvNoviceB: 'Plays any legal move. A gentle first opponent.', lvCasualB: 'Takes captures it can see, but often plays a random move.',
    lvClubB: 'Looks two turns ahead and slips now and then.', lvExpertB: 'Looks four turns ahead and rarely slips.', lvMasterB: 'Looks eight turns ahead and never plays a random move.',
    twoInfo: 'Two players share the phone. Player 1 sits at the bottom, Player 2 at the top.',
    record: 'Record', wins: 'W', draws: 'D', losses: 'L',
    autoThink: 'Thinking', autoPause: 'Pause', autoPlay: 'Resume', autoExit: 'Exit', autoSlower: 'Think -', autoFaster: 'Think +',
    autoSession: 'Watch & Learn', autoAgain: 'Watch Again', autoSummary: 'You watched two whole games, each move chosen by the game\'s own engine with its reason shown: Master against Master, and Master against Expert.',
    demoLimitTitle: 'FREE PREVIEW FINISHED', demoLimitBody: 'You played the three free games. Get the full game on iPhone and Android for every opponent level, two players on one phone and the full Learn course.',
    demoLeft: '{n} free games left', locked: 'In the full game', lessonsTitle: 'Learn', lessonDone: 'Done', again: 'Play Again', newSetup: 'Change Game',
    lessonNext: 'Next Lesson', lessonRetry: 'Try Again', lessonList: 'All Lessons', lessonOf: 'Lesson {n} of {m}', correct: 'Correct!', notQuite: 'Not quite',
    yourMove: 'Your move', thinking: 'Thinking...', turnOf: '{who} to move', pickHole: 'Tap one of your holes that holds seeds.',
    sowing: 'Sowing...', nothingUndo: 'Nothing to undo',
    rowTop: 'top', rowMiddle: 'middle', rowBottom: 'bottom',
    youWon: 'You win!', youLost: '{who} wins', drawWord: 'A draw', winsWord: '{who} wins!',
    finalScore: 'Final count: {a} to {b}', cappedNote: ' The game reached its {n}-turn limit.',
    youTook: 'You captured {n}', theyTook: '{who} captured {n}', tookNothing: 'No capture that turn',
    pileCap: 'Captured', pileBoard: 'On board', pileTotal: 'Score', toMove: 'to move', waiting: 'waiting', winner: 'Winner',
    resetDone: 'Erased',
    hintHead: 'Play the {row} row, hole {n} from the left',
    r_capture: 'This captures {a} seeds. The opponent\'s best answer then captures {b}.',
    r_safe0: 'No capture is available, so this is the safest move: the opponent has no capture in reply.',
    r_safe: 'No capture is available, so this is the safest move: the opponent\'s best answer captures only {a}, the least of any move.',
    r_steady: 'Searching ahead, this keeps you furthest ahead. The opponent\'s best immediate answer captures {a}.',
    r_endWin: 'This ends the game with you ahead.', r_endDraw: 'This ends the game level.', r_endLoss: 'Every move ends the game behind; this loses by the least.',
    r_notBest: 'Not the strongest move: the engine prefers {h}.',
    lessonWrongNone: 'That move captures nothing. Look for a hole whose sowing ends in an empty hole of yours, with opponent seeds in the same column.',
    lessonWrongLess: 'That move captures {a}, but another captures {b}. Follow each hole\'s sowing to its end and compare.',
    lessonWrongDef: 'After that move the opponent can capture {a}. Find a move that leaves no big capture.',
    savedGame: 'Saved game', nativeNote: 'The long texts are in English.',
  },
  am: {
    appName: 'ጋባታ', appSub: 'Gabata', tagline: 'የኢትዮጵያና የኤርትራ የሦስት ረድፍ ጨዋታ።',
    langHead: 'ቋንቋ ይምረጡ',
    playBtn: 'ተጫወት', continueBtn: 'ጨዋታውን ቀጥል', learnBtn: 'ተማር', autoBtn: 'ተመልከት እና ተማር', howtoBtn: 'እንዴት እንደሚጫወት', rulesBtn: 'ደንቦች', aboutBtn: 'ስለ ጨዋታው',
    settingsBtn: 'ቅንብሮች', back: 'ተመለስ', next: 'ቀጣይ', prev: 'ቀዳሚ', think: 'ምክር', undo: 'ወደ ኋላ', restart: 'እንደገና', resume: 'ቀጥል', paused: 'ቆሟል',
    quitMenu: 'ዋና ማውጫ', soundOn: 'ድምፅ: በርቷል', soundOff: 'ድምፅ: ጠፍቷል', thinkTime: 'የማሰቢያ ጊዜ', seconds: ' ሰ',
    textSize: 'የጽሑፍ መጠን', language: 'ቋንቋ', theme: 'ገበታ',
    startGame: 'ጨዋታ ጀምር', setupTitle: 'አዲስ ጨዋታ', opponentTitle: 'ተፎካካሪ', sideTitle: 'የእርስዎ ጎን',
    first: 'መጀመሪያ ተጫወት (ታች)', second: 'ሁለተኛ ተጫወት (ላይ)', twoPlayers: 'ሁለት ተጫዋቾች', youWord: 'እርስዎ', oppWord: 'ተፎካካሪ', p1: 'ተጫዋች 1', p2: 'ተጫዋች 2',
    lvNovice: 'ጀማሪ', lvCasual: 'ቀላል', lvClub: 'መካከለኛ', lvExpert: 'ባለሙያ', lvMaster: 'ሊቅ',
    record: 'ውጤት', wins: 'አሸ', draws: 'አቻ', losses: 'ተሸ',
    autoThink: 'እያሰበ ነው', autoPause: 'አቁም', autoPlay: 'ቀጥል', autoExit: 'ውጣ', autoSession: 'ተመልከት እና ተማር', autoAgain: 'እንደገና ተመልከት',
    lessonsTitle: 'ተማር', lessonDone: 'ተጠናቋል', again: 'እንደገና ተጫወት', newSetup: 'ጨዋታ ቀይር',
    yourMove: 'የእርስዎ ተራ', thinking: 'እያሰበ ነው...', sowing: 'እየተዘራ ነው...',
    youWon: 'እርስዎ አሸነፉ!', youLost: '{who} አሸነፈ', drawWord: 'አቻ', winsWord: '{who} አሸነፈ!',
    finalScore: 'የመጨረሻ ውጤት: {a} ለ {b}',
    pileCap: 'የተያዙ', pileBoard: 'በገበታው ላይ', pileTotal: 'ነጥብ', toMove: 'ተራው', waiting: 'በመጠባበቅ', winner: 'አሸናፊ',
    rowTop: 'የላይ', rowMiddle: 'የመሃል', rowBottom: 'የታች',
    nativeNote: 'ረጃጅም ጽሑፎች በእንግሊዝኛ ናቸው።',
    youTook: 'እርስዎ {n} ዘሮችን ያዙ', theyTook: '{who} {n} ዘሮችን ያዘ', tookNothing: 'በዚህ ተራ ምንም አልተያዘም', pickHole: 'ዘር ያለበት ከእርስዎ ጉድጓዶች አንዱን ይንኩ።',
    turnOf: '{who}: ተራው', correct: 'ትክክል!', notQuite: 'ገና አይደለም', lessonNext: 'ቀጣይ ትምህርት', lessonRetry: 'እንደገና ሞክር', lessonList: 'ሁሉም ትምህርቶች',
    autoSlower: 'ማሰቢያ -', autoFaster: 'ማሰቢያ +', nothingUndo: 'ወደ ኋላ የሚመለስ የለም', savedGame: 'የተቀመጠ ጨዋታ', resetDone: 'ተሰርዟል', owned: 'ሙሉ ጨዋታው ተከፍቷል። እናመሰግናለን!',
  },
};

export const tr = (key, vars) => {
  let s = STR[LANG][key] ?? STR.en[key] ?? key;
  if (vars) for (const k of Object.keys(vars)) s = s.split(`{${k}}`).join(vars[k]);
  return s;
};
// Level names are short labels (translated); the blurbs are long text, so they are English in both modes.
export const levelName = (id) => tr(`lv${id[0].toUpperCase()}${id.slice(1)}`);
export const levelBlurb = (id) => STR.en[`lv${id[0].toUpperCase()}${id.slice(1)}B`];

// A move in words, from explain.moveWords { row, col }. Hints are long text: English in both modes.
const ROWW = ['top', 'middle', 'bottom'];
export const hintText = (r, w) => ({ head: STR.en.hintHead.replace('{row}', ROWW[w.row]).replace('{n}', w.col), why: (STR.en[`r_${r.code}`] ?? '').split('{a}').join(r.a).split('{b}').join(r.b) });
export const notBestText = (h) => STR.en.r_notBest.replace('{h}', h);

// ------------------------------------------------------------------------------------------------ How to Play
const HOWTO = [
  { title: 'The goal', art: 'board', body: 'Finish with more seeds than your opponent. Your score is the seeds you have captured plus the seeds still sitting in your own holes. The board has three rows of six holes, and every hole starts with three seeds.' },
  { title: 'Your holes', art: 'owner', body: 'You own the whole row nearest you and the half of the middle row on your right. The other nine holes are your opponent\'s. The coloured outlines show who owns what. You only ever sow seeds round your own nine holes.' },
  { title: 'Your move', art: 'tap', body: 'Tap one of your holes that holds seeds. All its seeds are picked up and dropped one by one into the next holes of your loop, following the small arrows. Tapping a hole plays it straight away, and Undo takes a move back.' },
  { title: 'Keep sowing', art: 'relay', body: 'If your last seed falls into a hole that already holds seeds, pick up everything in that hole and keep sowing from there. Your turn goes on until a last seed falls into an empty hole.' },
  { title: 'Capturing', art: 'capture', body: 'When your last seed falls into an empty hole of yours, look straight up or down its column. Every seed your opponent has in that column is captured and added to your pile. Then your turn ends.' },
  { title: 'Both holes of a column', art: 'column', body: 'Where the middle hole of a column belongs to your opponent, a capture takes the middle hole and the top hole together. That is the biggest prize on the board.' },
  { title: 'Game end', art: 'end', body: 'The game ends when one player has no seeds left in their holes. Each player keeps the seeds in their own holes, and the higher total wins. Think shows the best move and says why; Learn and Watch & Learn teach the rest.' },
];

// ------------------------------------------------------------------------------------------------ Rules
const CAL = { en: '' };
export const setCalibration = (en) => { CAL.en = en; };

const rulesEn = () => [
  { title: 'The board', art: 'board', body: [
    'The board has three rows of six holes: eighteen holes in all, carved in a wooden block. Every hole starts with ' + START_SEEDS + ' seeds, so the board holds ' + 18 * START_SEEDS + ' seeds.',
    'Player 1 sits at the bottom and Player 2 at the top. Against the computer you are the bottom if you play first and the top if you play second.',
  ] },
  { title: 'Whose holes are whose', art: 'owner', body: [
    'Each player owns nine of the eighteen holes: the whole row nearest them, and the three holes of the middle row on their right. Player 1\'s holes are outlined in gold, Player 2\'s in green-blue, and each player\'s part of the board is lightly tinted.',
    'You may only start a turn from one of your own holes that holds seeds. Seeds never leave your own nine holes while you sow, so they stay yours until they are captured.',
  ] },
  { title: 'Your turn: pick and sow', art: 'turn', body: [
    'Choose one of your holes that holds seeds. Pick up every seed in it and drop them one by one into the following holes of your own loop, one seed per hole. The small arrows on the board show the direction.',
    'The turn then continues by the rules on the next pages: relay sowing, or a capture, or the turn simply ends.',
  ] },
  { title: 'Your loop of nine', art: 'wrap', body: [
    'Your nine holes form a loop. For Player 1 it runs along the bottom row from the left to the right, then up into the middle row and back along it from the right to the left; after the last middle hole it goes round to the first hole of the bottom row. Player 2\'s loop is the same loop turned half way round: along the top row from the right to the left, then the left half of the middle row from the left to the right, then back to the start.',
    'The step from the last middle hole back to the start is the "corner": it is longer on the board, but it counts as one step like any other. A hole with nine or more seeds sows all the way round and may drop seeds into the hole it was picked up from.',
  ] },
  { title: 'Relay sowing', art: 'relay', body: [
    'If the last seed you drop falls into a hole that already held seeds, pick up every seed now in that hole (the one you just dropped included) and keep sowing from that hole, in the same direction. This repeats for as long as the last seed lands on a hole that was not empty.',
    'A very long relay is possible. The engine stops a relay after 150 pick-ups so that a turn can never go on for ever; in practice it never gets near that.',
  ] },
  { title: 'Capturing', art: 'capture', body: [
    'When the last seed you drop falls into a hole that was empty, the sowing stops there. That hole is always one of yours. Look at the column it stands in (the hole above it and the hole below it). Every seed your opponent has in that column is captured: the seeds go to your captured pile.',
    'The seed you just dropped stays in your hole. If the opponent has no seeds in that column, nothing is captured. Either way the turn then passes to the opponent.',
  ] },
  { title: 'Both holes of a column', art: 'column', body: [
    'A column has three holes: top, middle and bottom. The top hole is always Player 2\'s and the bottom hole is always Player 1\'s. The middle hole belongs to Player 2 in the three columns on the left and to Player 1 in the three columns on the right.',
    'So when Player 1 lands in an empty bottom hole of the left half, the capture can take both the opponent\'s top hole and the opponent\'s middle hole in that column. In the right half the middle hole is Player 1\'s own, so only the top hole can be captured. A landing in an empty middle hole works the same way.',
  ] },
  { title: 'When a turn ends', art: 'stop', body: [
    'A turn always ends with the last seed in an empty hole of yours (after a capture or when there was nothing to capture), and play passes to the opponent. Nothing is lost: the seeds you sowed stay where they fell.',
    'There is no passing. If you have seeds you must play, and if you have none the game is over.',
  ] },
  { title: 'How a game ends', art: 'end', body: [
    'The game ends when, after a move, either player has no seeds left in their own holes (the player who ran out cannot move). Each player then keeps the seeds still in their own holes.',
    `A player's score is the seeds they have captured plus the seeds in their own holes. More points win; equal points are a draw. There is also a safety limit of ${MAX_PLIES} turns: if the game is still going, it ends the same way with the seeds counted as they stand.`,
  ] },
  { title: 'What is different from the traditional game', art: 'board', body: [
    'Gabata (also spelled Gebeta) is a family of games, and the rules vary by region and by family. The three-row form is played on three rows of six holes with three seeds in each hole, relay sowing and the capture of a whole column, and these are all kept here.',
    'What published descriptions of the three-row game of the Eritrean highlands agree on, and this game keeps: three rows of six holes, three seeds in each, each player owns the row nearest them and the three holes of the middle row on their right, sowing goes left to right along your own row and then right to left along your middle holes, a last seed that lands in a hole with seeds in it carries on, and a last seed that lands in an empty hole of yours captures the seeds the opponent has in that column.',
    'Where this game simplifies: traditional players begin by sowing at the same time, racing each other, before play settles into turns, and this game simply starts with Player 1 and alternates. Some descriptions let the capturing seed be lifted and sown on, so that one turn can capture several times; here a capture ends the turn. In traditional play a finished round may be followed by a new round, with each player\'s seeds shared out again three to a hole; here one round decides the game and the score is the seeds captured plus the seeds left in your holes. These are our own simplifications and not a claim about how any one community plays.',
  ] },
  { title: 'Making a move', art: 'tap', body: [
    'Tap one of your holes that holds seeds and it is played at once: a hand glides along the board and drops the seeds one by one. Tapping an empty hole or one of the opponent\'s holes flashes it and does nothing. A second finger resting on the screen is ignored.',
    'On a keyboard the keys 1 to 6 play the holes of your near row from the left. The left and right arrow keys move a marker along all your holes and Enter or Space plays the marked one. U is Undo, T is Think, R is Restart, and Escape or P pauses.',
  ] },
  { title: 'Think and Undo', art: 'think', body: [
    'Think searches six turns ahead, lights the hole it likes best and gives the reason with numbers it has just worked out: how many seeds the move captures, and the most the opponent can capture in answer. It never moves for you and is free.',
    'Undo takes back your last move and the computer\'s answer, so it is your turn again. Your game is saved after every move: Continue game on the menu resumes it, paused.',
  ] },
  { title: 'Opponents', art: 'levels', body: [
    'Novice plays any legal move. Casual looks one turn ahead but plays a random move three times in ten. Club looks two turns ahead and slips one time in ten. Expert looks four turns ahead and Master eight, and neither ever plays a random move.',
    `${CAL.en} In two-player mode both players share the phone and the player to move is marked.`,
  ] },
  { title: 'Learn and Watch & Learn', art: 'learn', body: [
    'Learn is a course of six lessons: capture, relay, two holes at once, round the corner, defend and a whole game. A wrong move is not played: you are told why and can try again.',
    'Watch & Learn plays two whole games with THINK (2, 5, 8 or 10 seconds), REVEAL (two seconds: the possible holes light up and the chosen hole is marked, with the reason in words) and ACT (the seeds are sown). Pause freezes everything where it is.',
  ] },
  { title: 'Language, boards and text', art: 'themes', body: [
    'Play in English or the Amharic choice is a real choice on the first launch and on the main menu. The Amharic choice shows the name of the game, the menus, buttons, level names and scores in Amharic script; the long texts (these Rules, How to Play, About, lessons and the reasons given by Think) stay in English.',
    'Settings offers two boards (Carved Acacia, Highland Clay), sound, the Watch & Learn think time and text size up to 300 percent on every text screen, including the game screen. There are no timers; the free preview is the first 90 seconds of real play.',
  ] },
];
export const howtoPages = () => HOWTO;
export const rulesPages = () => rulesEn();
export const RULE_COUNT = rulesEn().length;
export const HOWTO_COUNT = HOWTO.length;

export const aboutSections = () => [
  { title: 'Gabata', body: 'The three-row sowing game of Ethiopia and Eritrea, played on a carved wooden board with glossy seeds that are dropped one at a time.' },
  { title: 'Where it comes from', body: 'Gabata, also spelled Gebeta, is the name used in Ethiopia and Eritrea for a family of mancala sowing games, most of them played on two rows. A three-row form is recorded from the nineteenth century. Rules differ from region to region and from family to family, so this game follows one documented pattern, states its rules in full on the Rules pages and notes where it takes turns instead of the traditional simultaneous start.' },
  { title: 'Language', body: 'Choose Play in English, or the Amharic choice. The Amharic choice shows the name of the game, the menus, buttons and scores in Amharic script. The long texts are in English.' },
  { title: 'In this game', body: 'Three rows of six holes, three seeds in each, relay sowing and column captures. Five opponent levels from Novice to Master, two players on one phone, Think with a reason in words, six lessons and Watch & Learn. A free preview, then one purchase unlocks the game. No timers and no ads.' },
];
