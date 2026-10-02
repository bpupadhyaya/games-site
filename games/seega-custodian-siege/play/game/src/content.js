// All player-facing text, in English and in Arabic. The player picks one language ("Play in English" or "Play in Arabic") and
// every screen then uses that language only. Numbers come from the engine's own constants so the Rules pages cannot drift from it.
import { PIECES, STALL_LIMIT, MIN_STONES, CENTRE, rc } from './rules.js';
import { isAr } from './lang.js';

const TURNS = PIECES / 2;
const L = (en, ar) => [en, ar];

// [English, Arabic] pairs. {name} placeholders are filled by tr().
export const STR = {
  playBtn: L('Play', 'العب'), continueBtn: L('Continue game', 'متابعة اللعبة'), learnBtn: L('Learn', 'تعلّم'), autoBtn: L('Watch & Learn', 'شاهد وتعلّم'),
  howtoBtn: L('How to Play', 'كيف تلعب'), rulesBtn: L('Rules', 'القواعد'), aboutBtn: L('About', 'عن اللعبة'), settingsBtn: L('Settings', 'الإعدادات'),
  back: L('Back', 'رجوع'), next: L('Next', 'التالي'), prev: L('Previous', 'السابق'), think: L('Think', 'فكّر'), undo: L('Undo', 'تراجع'),
  restart: L('Restart', 'إعادة'), resume: L('Resume', 'متابعة'), paused: L('Paused', 'متوقفة مؤقتًا'), quitMenu: L('Main Menu', 'القائمة الرئيسية'),
  soundOn: L('Sound: On', 'الصوت: يعمل'), soundOff: L('Sound: Off', 'الصوت: متوقف'), thinkTime: L('Watch & Learn think time', 'مدة التفكير في «شاهد وتعلّم»'),
  seconds: L('s', ' ث'), restore: L('Restore Purchases', 'استعادة المشتريات'), unlock: L('Unlock Full Game', 'فتح اللعبة كاملة'),
  resetProgress: L('Erase Records and Progress', 'مسح السجلات والتقدّم'), resetConfirm: L('Tap again to erase everything', 'المس مرة أخرى لمسح كل شيء'),
  owned: L('Full game unlocked. Thank you!', 'تم فتح اللعبة كاملة. شكرًا لك!'), theme: L('Board and stones', 'الرقعة والأحجار'),
  startGame: L('Start game', 'ابدأ اللعبة'), opponentTitle: L('Opponent', 'الخصم'), sideTitle: L('Your side', 'جانبك'),
  playP: L('Pebbles: place first, move second', 'الحصى: تضع أولًا وتتحرك ثانيًا'), playD: L('Date stones: place second, move first', 'نوى التمر: تضع ثانيًا وتتحرك أولًا'),
  twoPlayers: L('Two players', 'لاعبان'), youWord: L('You', 'أنت'), vsComputer: L('vs computer', 'ضد الحاسوب'),
  autoThink: L('Thinking {n}', 'يفكّر {n}'), thinkingDots: L('Thinking...', 'جارٍ التفكير…'),
  autoPause: L('Pause', 'إيقاف مؤقت'), autoPlay: L('Resume', 'متابعة'), autoExit: L('Exit', 'خروج'), autoSlower: L('Think -', 'تفكير أقل'), autoFaster: L('Think +', 'تفكير أكثر'),
  autoSession: L('Watch & Learn', 'شاهد وتعلّم'), autoAgain: L('Watch Again', 'شاهد مرة أخرى'),
  autoSummary: L('You watched a whole game: the layout, the first slide into the centre, the captures and the finish, with each move explained. Watch again for a different game, or head to Learn to try the ideas yourself.',
    'شاهدت لعبة كاملة: التشكيل، وأول انزلاق إلى المركز، وعمليات الأسر، والنهاية، مع شرح كل حركة. شاهد مرة أخرى للعبة مختلفة، أو انتقل إلى «تعلّم» لتجرّب الأفكار بنفسك.'),
  demoLimitTitle: L('FREE PREVIEW FINISHED', 'انتهت المعاينة المجانية'),
  demoLimitBody: L('You played the three free games. Get the full game on iPhone and Android for every opponent level, two players on one phone, all the lessons and the other boards.',
    'لعبتَ الألعاب الثلاث المجانية. احصل على اللعبة كاملة على آيفون وأندرويد لتجد كل مستويات الخصم، واللعب بين لاعبين على هاتف واحد، وكل الدروس، والرقع الأخرى.'),
  demoLeft: L('{n} free games left', 'متبقٍ {n} ألعاب مجانية'),
  seega: L('Seega', 'سيجا'), desertSiege: L('Desert Siege', 'حصار الصحراء'), fromEgypt: L('A traditional game of Egypt', 'لعبة تقليدية من مصر'),
  tagline: L('Place. Slide. Sandwich.', 'ضع. حرّك. احصر.'),
  record: L('Record', 'السجل'), recordLine: L('{label} ({level}): {w} W  {d} D  {l} L', '{label} ({level}): {w} فوز  {d} تعادل  {l} خسارة'),
  lessonsTitle: L('Learn', 'تعلّم'), lessonDone: L('Done', 'تم'), lessonPlace: L('Placement', 'الوضع'), lessonMove: L('Movement', 'التحريك'),
  again: L('Play Again', 'العب مرة أخرى'), newSetup: L('Change Game', 'تغيير اللعبة'), lessonNext: L('Next Lesson', 'الدرس التالي'),
  lessonRetry: L('Try Again', 'حاول مرة أخرى'), lessonList: L('All Lessons', 'كل الدروس'),
  textSize: L('Text size', 'حجم النص'), locked: L('In the full game', 'في اللعبة الكاملة'), endTurn: L('End turn', 'إنهاء الدور'),
  language: L('Language', 'اللغة'), pebbles: L('Pebbles', 'الحصى'), dateStones: L('Date stones', 'نوى التمر'),
  twoInfo: L('Two players share the phone. The pebbles place first and move second.', 'يتشارك اللاعبان الهاتف. تضع الحصى أولًا وتتحرك ثانيًا.'),
  sideInfo1: L('You place first and move second.', 'أنت تضع أولًا وتتحرك ثانيًا.'),
  sideInfo2: L('You place second, so you move first and must step into the centre.', 'أنت تضع ثانيًا فتتحرك أولًا، ويجب أن تدخل المركز.'),
  // HUD
  vsLevel: L('vs computer · {level}', 'ضد الحاسوب · {level}'), lessonOf: L('Lesson {n} of {m}', 'الدرس {n} من {m}'),
  noCapture: L(' · no capture {q}/{m}', ' · دون أسر {q}/{m}'), watchSub: L('Watch & Learn · Think {n}s', 'شاهد وتعلّم · تفكير {n} ث'),
  winnerWord: L('Winner', 'الفائز'), drawWord: L('Draw', 'تعادل'), placedOf: L('{p} of {m} placed', '{p} من {m} موضوعة'),
  opponentWord: L('Opponent', 'الخصم'), computerWord: L('Computer', 'الحاسوب'),
  toPlace: L('{side} to place', 'دور {side} للوضع'), toMove: L('{side} to move', 'دور {side} للتحريك'),
  passHead: L('{side} cannot move', 'لا تستطيع {side} التحريك'), passBody: L('{side} move again.', 'تتحرك {side} مرة أخرى.'),
  placeTwoYou: L('Your turn: place two stones', 'دورك: ضع حجرين'), placeOneYou: L('Place one more stone', 'ضع حجرًا آخر'),
  placeTwoSide: L('{side}: place two stones', '{side}: ضع حجرين'), placeOneSide: L('{side}: place one more', '{side}: ضع حجرًا آخر'),
  firstTap: L('Tap an empty square. The centre stays empty.', 'المس مربعًا فارغًا. يبقى المركز فارغًا.'),
  chainHead: L('Capture again, or end your turn', 'تابع الأسر أو أنهِ دورك'), chainBody: L('Tap a marked square, or End turn.', 'المس مربعًا معلَّمًا أو «إنهاء الدور».'),
  chainSide: L('{side}: capture again?', '{side}: متابعة الأسر؟'),
  pickYou: L('Pick one of your stones to slide', 'اختر أحد أحجارك لتحريكه'), targetYou: L('Now pick where it slides to', 'والآن اختر المربع الذي ينزلق إليه'),
  pickSide: L('{side}: pick a stone to slide', '{side}: اختر حجرًا لتحريكه'), targetSide: L('{side}: pick where it slides', '{side}: اختر المربع الذي ينزلق إليه'),
  // toasts
  capturedToast: L('Captured {n}', 'تم أسر {n}'), tCentre: L('The centre stays empty until the sliding begins.', 'يبقى المركز فارغًا إلى أن يبدأ التحريك.'),
  tTaken: L('That square is taken.', 'هذا المربع مشغول.'), tStuck: L('That stone has no empty square beside it.', 'لا يوجد مربع فارغ بجانب هذا الحجر.'),
  tFoe: L('Slide one of your own stones.', 'حرّك أحد أحجارك أنت.'), tFar: L('A stone slides one square, up, down, left or right.', 'ينزلق الحجر مربعًا واحدًا: إلى الأعلى أو الأسفل أو اليمين أو اليسار.'),
  tChain: L('Capture again with this stone, or end your turn.', 'تابع الأسر بهذا الحجر أو أنهِ دورك.'), tUndo: L('Nothing to undo', 'لا شيء للتراجع عنه'),
  // end of game
  aDraw: L('A draw', 'تعادل'), youWin: L('You win!', 'فزت!'), levelWins: L('{name} wins', 'فاز {name}'), sideWin: L('{side} win!', 'فازت {side}!'),
  reducedYou: L('You were reduced to one stone.', 'بقي لديك حجر واحد.'), reducedOne: L('{name} was reduced to one stone.', 'بقي لدى {name} حجر واحد.'),
  reducedSide: L('{side} were reduced to one stone.', 'بقي لدى {side} حجر واحد.'),
  stallLead: L('{n} moves passed with no capture', 'مرّت {n} حركة دون أسر'), lockLead: L('Neither side could move', 'تعذّرت الحركة على الجانبين'),
  endEqual: L('{lead}, and both sides have {n}.', '{lead}، ولدى كل جانب {n}.'),
  endMoreYou: L('{lead}, and you have more stones ({a} to {b}).', '{lead}، ولديك أحجار أكثر ({a} مقابل {b}).'),
  endMoreOne: L('{lead}, and {name} has more stones ({a} to {b}).', '{lead}، ولدى {name} أحجار أكثر ({a} مقابل {b}).'),
  endMoreSide: L('{lead}, and {side} have more stones ({a} to {b}).', '{lead}، ولدى {side} أحجار أكثر ({a} مقابل {b}).'),
  notQuite: L('Not quite', 'ليس تمامًا'), correct: L('Correct!', 'صحيح!'),
  // Watch & Learn
  autoPlaceHead: L('{side} place two stones', 'تضع {side} حجرين'), autoFirst: L('First, {cell}. {why}', 'أولًا، {cell}. {why}'),
  // illustrations
  cSlideIn: L('slide in to sandwich', 'انزلق لتحصر'), cGone: L('the trapped stone is gone', 'الحجر المحصور اختفى'),
  cCentreEmpty: L('the centre stays empty during placement', 'يبقى المركز فارغًا أثناء الوضع'), cTwoTurn: L('two stones a turn, anywhere but the centre', 'حجران في كل دور، في أي مكان عدا المركز'),
  cFirstSlide: L('the first slide goes into the centre', 'أول انزلاق يكون إلى المركز'), cOneStep: L('one step, up, down, left or right', 'خطوة واحدة: أعلى أو أسفل أو يمين أو يسار'),
  cEachSide: L('a pebble on each side', 'حصاة على كل جانب'), cCaptured: L('captured', 'مأسور'),
  cBetween: L('sliding in between two enemies is safe', 'الانزلاق بين حجرين معاديين آمن'), cTwoSand: L('two sandwiches at once', 'حصاران معًا'), cBoth: L('both captured', 'كلاهما مأسور'),
  cChain: L('capture, then capture again with the same stone', 'أسر، ثم أسر مرة أخرى بالحجر نفسه'),
  cCorner: L('corner', 'زاوية'), cEdge: L('edge', 'حافة'), cCentre: L('centre', 'مركز'),
  cBlocked: L('the date stones cannot move: you move again', 'نوى التمر لا تستطيع التحرك: تتحرك أنت مرة أخرى'),
  cOneLeft: L('one stone left: the game is over', 'بقي حجر واحد: انتهت اللعبة'),
  cPlaceFirst: L('place first', 'تضع أولًا'), cMoveSecond: L('move second', 'تتحرك ثانيًا'), cPlaceSecond: L('place second', 'تضع ثانيًا'), cMoveFirst: L('move first', 'تتحرك أولًا'),
  cThinkEx: L('Captures 1 stone by sandwiching it.', 'يأسر حجرًا واحدًا بحصره.'), cThinkReveal: L('THINK  ·  REVEAL  ·  ACT', 'تفكير  ·  كشف  ·  تنفيذ'),
  cSize5: L('5x5: this game', '5×5: هذه اللعبة'),
  // Think and its reasons
  hEnd: L('End your turn here', 'أنهِ دورك هنا'), hPlace: L('Place a stone on {cell}', 'ضع حجرًا في {cell}'), hSlide: L('Slide {a} to {b}', 'حرّك {a} إلى {b}'),
  cellRC: L('row {r}, column {c}', 'الصف {r}، العمود {c}'), cellCentre: L('the centre', 'المركز'),
  wCorner: L('A corner stone can never be sandwiched, so it is safe for the whole game.', 'حجر الزاوية لا يمكن حصره أبدًا، فهو آمن طوال اللعبة.'),
  wEdge: L('An edge stone can only be captured along the edge, never across it.', 'حجر الحافة لا يُؤسر إلا على امتداد الحافة، وليس عبرها أبدًا.'),
  wMate: L('It sits beside your own stone, which covers it along that line.', 'يقع بجانب حجر من أحجارك يحميه على ذلك الخط.'),
  wMates: L('It sits between your own stones, which cover it along those lines.', 'يقع بين أحجارك التي تحميه على تلك الخطوط.'),
  wLast: L('You place last, so you move first and must slide a stone into the centre: this one is beside it.', 'أنت تضع أخيرًا فتتحرك أولًا ويجب أن تنزلق بحجر إلى المركز: وهذا الحجر بجانبه.'),
  wFirstOpp: L('Your opponent moves first and must step into the centre: a stone beside it is ready to answer.', 'خصمك يتحرك أولًا ويجب أن يدخل المركز: والحجر المجاور له جاهز للرد.'),
  wInner: L('It is an inner square, more exposed than the edge, but it covers your other stones.', 'مربع داخلي أكثر عرضة من الحافة، لكنه يحمي أحجارك الأخرى.'),
  wScored: L('Testing many ways the layout could fill up, it scored best.', 'بعد اختبار طرق كثيرة قد يمتلئ بها التشكيل، حصل هذا الاختيار على أفضل نتيجة.'),
  wStop: L('The search found that stopping here scores better than going on: the extra move would leave you worse off.', 'وجد البحث أن التوقف هنا أفضل من المتابعة: فالحركة الإضافية تجعل وضعك أسوأ.'),
  wCapOne: L('Captures 1 stone by sandwiching it between two of yours.', 'يأسر حجرًا واحدًا حصرًا بين حجرين من أحجارك.'),
  wCapMany: L('Captures {n} by sandwiching them between two of yours.', 'يأسر {n} حصرًا بين حجرين من أحجارك.'),
  wWinOne: L('That leaves your opponent with a single stone, which wins the game.', 'فيبقى لخصمك حجر واحد، وبذلك تفوز.'),
  wGoOn: L('The same stone can keep going.', 'ويستطيع الحجر نفسه المتابعة.'),
  wNoReply: L('And it leaves your opponent no capture in reply.', 'ولا يترك لخصمك أي أسر في الرد.'),
  wReply: L('Your opponent can still capture up to {n} in reply, but nothing else scored better.', 'ما زال بإمكان خصمك أسر حتى {n} في الرد، لكن لا خيار آخر حصل على نتيجة أفضل.'),
  wEscape: L('This stone was about to be sandwiched. Moving it takes it out of danger.', 'كان هذا الحجر على وشك أن يُحصر. تحريكه يُخرجه من الخطر.'),
  wCentreMove: L('The centre is a safe square: a stone standing on it can never be captured.', 'المركز مربع آمن: الحجر الواقف عليه لا يُؤسر أبدًا.'),
  wSetup: L('This sets up a capture of up to {n} next turn and leaves none of your stones open.', 'يمهّد هذا لأسر حتى {n} في الدور القادم ولا يترك أيًّا من أحجارك مكشوفًا.'),
  wFewer: L('It leaves fewer of your stones open to capture than before.', 'يقلّل عدد أحجارك المعرّضة للأسر عمّا كان.'),
  wNone: L('It leaves none of your stones open to capture.', 'لا يترك أيًّا من أحجارك معرّضًا للأسر.'),
  wDepth: L('Looking {d} moves ahead, it keeps the best balance of stones.', 'بالنظر {d} حركات إلى الأمام، يحافظ هذا على أفضل توازن في الأحجار.'),
  // lesson feedback
  jCorner: L('Not quite. That square has a square on both sides of it in a line, so it can be sandwiched. Choose a corner.', 'ليس تمامًا. هذا المربع له مربع على جانبيه في خط واحد، فيمكن حصره. اختر زاوية.'),
  jKeepGoing: L('Not quite. You can still capture with this stone: keep going.', 'ليس تمامًا. ما زال بإمكانك الأسر بهذا الحجر: تابع.'),
  jNothing: L('Not quite. That move captures nothing. Look for an enemy stone with one of yours on one side and an empty square on the other.', 'ليس تمامًا. هذه الحركة لا تأسر شيئًا. ابحث عن حجر معادٍ بجانبه حجر من أحجارك وعلى جانبه الآخر مربع فارغ.'),
  jLess: L('Not quite. That captures {a}, but another move captures {b}.', 'ليس تمامًا. هذه الحركة تأسر {a}، لكن حركة أخرى تأسر {b}.'),
  jBeside: L('Not quite. A date stone could then take a square beside the centre and move first. Take the empty squares beside the centre.', 'ليس تمامًا. عندها يستطيع حجر من نوى التمر أن يحتل مربعًا بجانب المركز ويتحرك أولًا. احتل المربعين الفارغين بجانب المركز.'),
  jUnsafe: L('Not quite. After that move the date stones can capture {n}. Find a move that leaves nothing to capture.', 'ليس تمامًا. بعد هذه الحركة تستطيع نوى التمر أسر {n}. ابحث عن حركة لا تترك شيئًا يُؤسر.'),
  jBlock: L('Not quite. The date stones still have a move after that. Find the move that closes the last gap.', 'ليس تمامًا. ما زال لدى نوى التمر حركة بعد ذلك. ابحث عن الحركة التي تسد الفجوة الأخيرة.'),
  // opponent levels
  lvNovice: L('Novice', 'مبتدئ'), lvCasual: L('Casual', 'هاوٍ'), lvSkilled: L('Skilled', 'ماهر'), lvExpert: L('Expert', 'خبير'), lvMaster: L('Master', 'أستاذ'),
  bNovice: L('Learning the game. Places stones almost at random and takes a capture only now and then.', 'يتعلّم اللعبة. يضع الأحجار شبه عشوائيًا ولا يأسر إلا أحيانًا.'),
  bCasual: L('Takes most captures it sees and likes safe corners, but does not look ahead.', 'يأسر في الغالب ما يراه ويحب الزوايا الآمنة، لكنه لا ينظر إلى الأمام.'),
  bSkilled: L('Looks a few moves ahead and avoids easy traps. Beatable with a good layout.', 'ينظر بضع حركات إلى الأمام ويتفادى الفخاخ السهلة. يمكن هزيمته بتشكيل جيد.'),
  bExpert: L('Plans its layout and searches deeply. Rarely falls for a trap.', 'يخطط لتشكيله ويبحث بعمق. نادرًا ما يقع في فخ.'),
  bMaster: L('The strongest: tests many layouts and searches furthest. Slips only rarely.', 'الأقوى: يختبر تشكيلات كثيرة ويبحث أبعد. نادرًا ما يخطئ.'),
  // boards
  thSand: L('Sandstone', 'حجر رملي'), thBasalt: L('Basalt and Copper', 'بازلت ونحاس'), thOasis: L('Oasis Night', 'ليل الواحة'),
  thSandShort: L('Sandstone', 'رملي'), thBasaltShort: L('Basalt', 'بازلت'), thOasisShort: L('Oasis', 'واحة'),
  langEn: L('Play in English', 'Play in English'), langAr: L('العب بالعربية', 'العب بالعربية'),
};

export const tr = (key, vars) => {
  const e = STR[key];
  let s = e ? e[isAr() ? 1 : 0] : key;
  if (vars) for (const k of Object.keys(vars)) s = s.split(`{${k}}`).join(String(vars[k]));
  return s;
};

// "12 stones" / "1 stone" (English) and the Arabic counted forms (stonesObj is the accusative: "captures 2 stones")
export function stonesText(n) {
  if (!isAr()) return `${n} ${n === 1 ? 'stone' : 'stones'}`;
  if (n === 1) return 'حجر واحد';
  if (n === 2) return 'حجران';
  return n <= 10 ? `${n} أحجار` : `${n} حجرًا`;
}
export function stonesObj(n) {
  if (!isAr()) return `${n} ${n === 1 ? 'stone' : 'stones'}`;
  if (n === 1) return 'حجرًا واحدًا';
  if (n === 2) return 'حجرين';
  return n <= 10 ? `${n} أحجار` : `${n} حجرًا`;
}
const cap1 = (id) => `${id[0].toUpperCase()}${id.slice(1)}`;
export const lvName = (id) => tr(`lv${cap1(id)}`);
export const lvBlurb = (id) => tr(`b${cap1(id)}`);
export const themeName = (id) => tr(`th${cap1(id)}`);
export const themeShort = (id) => tr(`th${cap1(id)}Short`);
export const sideLabel = (who) => tr(who === 1 ? 'pebbles' : 'dateStones');
export function cellWords(i) {
  if (i === CENTRE) return tr('cellCentre');
  const [r, c] = rc(i);
  return tr('cellRC', { r: r + 1, c: c + 1 });
}

// ------------------------------------------------------------------------------------------------ How to Play
const HOWTO_DEF = [
  { art: 'goal',
    en: { title: 'The goal', body: `Each player has ${PIECES} stones: pale pebbles against dark date stones. First you fill the board together, then you slide stones and trap the other side's stones between two of yours. Capture every stone but one and you win.` },
    ar: { title: 'الهدف', body: `لكل لاعب ${PIECES} حجرًا: حصى فاتحة في مواجهة نوى تمر داكنة. تملآن الرقعة معًا أولًا، ثم تحرّكان الأحجار وتحاصران أحجار الخصم بين حجرين من أحجارك. إذا أسرتَ كل أحجاره إلا حجرًا واحدًا فزت.` } },
  { art: 'place',
    en: { title: 'Step 1: place', body: `Players take turns putting two stones at a time on any empty square. Only the centre square stays empty. The pebbles go first. After ${TURNS} turns each, the board is full. Nothing can be captured yet, so think about where your stones will be safe.` },
    ar: { title: 'الخطوة 1: الوضع', body: `يتناوب اللاعبان على وضع حجرين في كل مرة على أي مربع فارغ. المربع الأوسط وحده يبقى فارغًا. والحصى تبدأ. بعد ${TURNS} أدوار لكل جانب تمتلئ الرقعة. لا يمكن أسر شيء بعد، فكّر إذن في المواضع التي ستكون فيها أحجارك آمنة.` } },
  { art: 'first',
    en: { title: 'Step 2: slide', body: 'The side that placed last moves first, and its first move must be into the empty centre. After that, tap one of your stones, then tap an empty square right beside it (up, down, left or right) to slide it there.' },
    ar: { title: 'الخطوة 2: التحريك', body: 'الجانب الذي وضع أخيرًا يتحرك أولًا، ويجب أن تكون حركته الأولى إلى المركز الفارغ. بعد ذلك المس أحد أحجارك ثم المس مربعًا فارغًا بجانبه مباشرة (أعلى أو أسفل أو يمين أو يسار) لينزلق إليه.' } },
  { art: 'capture',
    en: { title: 'Capture', body: 'When your move leaves an enemy stone with one of your stones on each side, in a row or in a column, it is captured and removed. One move can capture several stones at once. Moving between two enemy stones is safe.' },
    ar: { title: 'الأسر', body: 'حين تترك حركتك حجرًا معاديًا وعلى كل جانب منه حجر من أحجارك، في صف أو في عمود، يُؤسر ويُزال. يمكن لحركة واحدة أن تأسر عدة أحجار معًا. والانزلاق بين حجرين معاديين آمن.' } },
  { art: 'chain',
    en: { title: 'Keep going', body: 'After a capture, the same stone may move again if that move captures too. You can stop at any time: tap the stone again or tap End turn.' },
    ar: { title: 'تابع', body: 'بعد الأسر يجوز للحجر نفسه أن يتحرك مرة أخرى إذا كانت الحركة تأسر أيضًا. يمكنك التوقف في أي وقت: المس الحجر مرة أخرى أو المس «إنهاء الدور».' } },
  { art: 'safe',
    en: { title: 'Safe squares', body: 'A stone in a corner can never be captured. A stone on an edge can only be captured along the edge. The centre square is safe too: a stone standing there cannot be captured at all.' },
    ar: { title: 'المربعات الآمنة', body: 'حجر الزاوية لا يمكن أسره أبدًا. وحجر الحافة لا يُؤسر إلا على امتداد الحافة. والمربع الأوسط آمن أيضًا: الحجر الواقف عليه لا يمكن أسره إطلاقًا.' } },
  { art: 'blocked',
    en: { title: 'Blocked and drawn-out games', body: `If a side has no move, the other side moves again. If ${STALL_LIMIT} moves in a row pass with no capture, the side with more stones wins, and equal stones is a draw.` },
    ar: { title: 'المواضع المحجوبة والألعاب الطويلة', body: `إذا لم يكن لدى جانب أي حركة يتحرك الجانب الآخر مرة أخرى. وإذا مرّت ${STALL_LIMIT} حركة متتالية دون أسر فاز الجانب الأكثر أحجارًا، وعند التساوي تكون اللعبة تعادلًا.` } },
  { art: 'think',
    en: { title: 'Think and Learn', body: 'Think shows a good move and explains why in plain words. Learn is a short course with real positions, and Watch & Learn plays a whole game for you with a Pause button.' },
    ar: { title: 'فكّر وتعلّم', body: 'يُظهر «فكّر» حركة جيدة ويشرح السبب بكلمات بسيطة. و«تعلّم» دورة قصيرة من مواضع حقيقية، و«شاهد وتعلّم» يلعب لعبة كاملة نيابةً عنك مع زر إيقاف مؤقت.' } },
];

// ------------------------------------------------------------------------------------------------ Rules
const RULES_DEF = [
  { art: 'goal',
    en: { title: 'The game', body: [
      `Seega is a two-player game for a 5x5 board. Each player has ${PIECES} stones. One side plays the pale pebbles and the other the dark date stones. The pebbles always place first.`,
      'A game has two phases. In the placement phase both players fill the board, two stones at a time, leaving only the centre empty. In the movement phase the stones slide one square at a time and capture by custodianship: trapping an enemy stone between two of yours.',
    ] },
    ar: { title: 'اللعبة', body: [
      `سيجا لعبة لاعبين اثنين تُلعب على رقعة 5×5. لكل لاعب ${PIECES} حجرًا: أحد الجانبين يلعب بالحصى الفاتحة والآخر بنوى التمر الداكنة. والحصى تضع أولًا دائمًا.`,
      'تتكوّن اللعبة من مرحلتين. في مرحلة الوضع يملأ اللاعبان الرقعة حجرين حجرين ولا يبقى فارغًا سوى المركز. وفي مرحلة التحريك تنزلق الأحجار مربعًا واحدًا في كل مرة وتأسر بالحصر: أن تحاصر حجرًا معاديًا بين حجرين من أحجارك.',
    ] } },
  { art: 'board',
    en: { title: 'The board and the stones', body: [
      'The board is 25 square pockets in five rows of five. The middle pocket, marked with a carved diamond, is the centre. It stays empty during placement and is a special safe square in the movement phase.',
      'Pebbles are round and pale; date stones are long grooved ovals and dark. They differ in shape as well as colour, so they are easy to tell apart on every board.',
    ] },
    ar: { title: 'الرقعة والأحجار', body: [
      'الرقعة 25 حفرة مربعة في خمسة صفوف، في كل صف خمس حفر. الحفرة الوسطى، وعليها معيّن محفور، هي المركز. تبقى فارغة أثناء الوضع، وتكون مربعًا آمنًا خاصًّا في مرحلة التحريك.',
      'الحصى مستديرة فاتحة، ونوى التمر بيضاوية طويلة فيها أخدود وداكنة. تختلف في الشكل واللون معًا فيسهل التمييز بينها في كل الرقع.',
    ] } },
  { art: 'place',
    en: { title: 'Placement: two at a time', body: [
      `The pebbles place first. On your turn you put exactly two stones, one after the other, on any two empty squares except the centre. Players alternate, so each side has ${TURNS} turns of two stones.`,
      `That is ${PIECES} stones each, 24 in all: the board is then full except for the centre. No stone moves and nothing is captured during placement. Undo takes back a stone you just placed, even the first of your two.`,
    ] },
    ar: { title: 'الوضع: حجران في كل دور', body: [
      `تضع الحصى أولًا. في دورك تضع حجرين بالضبط، واحدًا بعد الآخر، على أي مربعين فارغين عدا المركز. يتناوب اللاعبان، فيكون لكل جانب ${TURNS} أدوار من حجرين.`,
      `فيكون لكل جانب ${PIECES} حجرًا، أي 24 حجرًا في المجموع، وتمتلئ الرقعة ما عدا المركز. لا يتحرك أي حجر ولا يُؤسر شيء أثناء الوضع. يعيد «تراجع» الحجر الذي وضعته للتو، حتى الأول من حجريك.`,
    ] } },
  { art: 'safe',
    en: { title: 'Why placement matters', body: [
      'The layout you build is the position you will fight in. Stones next to your own stones cover each other, and corners and edges are harder to attack. Stones in the interior are exposed in more directions but can reach more squares.',
      'The side that places second moves first (next page), which is why the two sides feel different. You choose your side before the game starts. The strongest computer levels test many ways the layout could fill up before they place.',
    ] },
    ar: { title: 'لماذا يهمّ الوضع', body: [
      'التشكيل الذي تبنيه هو الموضع الذي ستقاتل فيه. الأحجار المتجاورة تحمي بعضها، والزوايا والحواف أصعب هجومًا. أما الأحجار الداخلية فهي أكثر عرضة من جهات أكثر لكنها تصل إلى مربعات أكثر.',
      'الجانب الذي يضع ثانيًا يتحرك أولًا (الصفحة التالية)، ولهذا يختلف الجانبان في الإحساس. تختار جانبك قبل بدء اللعبة. أقوى مستويات الحاسوب تختبر طرقًا كثيرة قد يمتلئ بها التشكيل قبل أن تضع.',
    ] } },
  { art: 'first',
    en: { title: 'Who moves first', body: [
      'The side that placed the last two stones moves first: that is the second placer, the date stones. Because only the centre is empty, their first move has to be a stone from a square beside the centre sliding into it.',
      'If the starting side has no stone beside the centre, it is blocked and the other side moves first instead (see Blocked positions). That is one reason a stone beside the centre is valuable when placing.',
    ] },
    ar: { title: 'من يتحرك أولًا', body: [
      'الجانب الذي وضع آخر حجرين يتحرك أولًا: أي الواضع الثاني، نوى التمر. ولأن المركز وحده فارغ، يجب أن تكون حركته الأولى انزلاق حجر من مربع مجاور للمركز إليه.',
      'إذا لم يكن لدى الجانب البادئ حجر مجاور للمركز فهو محجوب، ويتحرك الجانب الآخر أولًا بدلًا منه (انظر «المواضع المحجوبة»). وهذا أحد أسباب قيمة الحجر المجاور للمركز عند الوضع.',
    ] } },
  { art: 'move',
    en: { title: 'Moving', body: [
      'On your turn, slide one of your stones one square, up, down, left or right, into an empty square. There are no diagonal moves and no jumping over stones. A stone with no empty neighbour cannot move.',
      'Tap a stone, then tap an empty square beside it. Squares that capture are marked with a red cross on the stones they would capture. Tap the stone again to put it back.',
    ] },
    ar: { title: 'التحريك', body: [
      'في دورك حرّك أحد أحجارك مربعًا واحدًا، إلى الأعلى أو الأسفل أو اليمين أو اليسار، إلى مربع فارغ. لا حركات قطرية ولا قفز فوق الأحجار. والحجر الذي لا مربع فارغ بجانبه لا يمكنه التحرك.',
      'المس حجرًا ثم المس مربعًا فارغًا بجانبه. تُعلَّم المربعات التي تأسر بعلامة × حمراء على الأحجار التي ستؤسر. المس الحجر مرة أخرى لإعادته.',
    ] } },
  { art: 'capture',
    en: { title: 'Capturing', body: [
      'An enemy stone is captured when one of your stones stands on each side of it, in the same row or the same column. You capture by moving: the stone you slide must be one of the two that close the sandwich.',
      'A captured stone is removed from the board at once. Diagonals do not count.',
    ] },
    ar: { title: 'الأسر', body: [
      'يُؤسر الحجر المعادي حين يقف حجر من أحجارك على كل جانب منه، في الصف نفسه أو العمود نفسه. والأسر يكون بالحركة: الحجر الذي تحرّكه يجب أن يكون أحد الحجرين اللذين يُغلقان الحصار.',
      'يُزال الحجر المأسور عن الرقعة فورًا. والخطوط القطرية لا تُحتسب.',
    ] } },
  { art: 'between',
    en: { title: 'Moving between two enemies', body: [
      'Captures only happen on the mover\'s own turn and only by the stone that just moved. If you slide a stone into the gap between two enemy stones, it is not captured. It can stay there safely until an enemy stone leaves and comes back.',
      'The same holds for the stones left standing: an enemy stone that was already between two of yours is not captured unless one of your stones moves away and back to close the sandwich.',
    ] },
    ar: { title: 'التحرك بين حجرين معاديين', body: [
      'لا يحدث الأسر إلا في دور المُحرِّك وبالحجر الذي تحرّك للتو. إذا انزلقت بحجرك إلى الفجوة بين حجرين معاديين فلا يُؤسر، ويمكنه البقاء هناك بأمان إلى أن يغادر أحد الحجرين المعاديين ثم يعود.',
      'والأمر نفسه ينطبق على الأحجار الواقفة: حجر معادٍ كان بين حجرين من أحجارك لا يُؤسر إلا إذا ابتعد أحد حجريك ثم عاد ليغلق الحصار.',
    ] } },
  { art: 'multi',
    en: { title: 'Capturing several at once', body: [
      'One slide can capture in more than one direction at the same time. If the stone arrives with an enemy beside it on two or three sides, each backed by one of your stones, all of them are removed together.',
      'When you select a stone, the squares it can reach are shown, and a red cross marks every stone a slide would capture.',
    ] },
    ar: { title: 'أسر عدة أحجار معًا', body: [
      'قد تأسر حركة واحدة في أكثر من اتجاه في وقت واحد. إذا وصل الحجر ومعه حجر معادٍ بجانبه في جهتين أو ثلاث، وخلف كل منها حجر من أحجارك، أُزيلت كلها معًا.',
      'عند اختيار حجر تظهر المربعات التي يصل إليها، وتشير علامة × حمراء إلى كل حجر ستأسره الحركة.',
    ] } },
  { art: 'chain',
    en: { title: 'Extra moves', body: [
      'After a capture, the stone that captured may move again, but only to capture again. You can carry on while captures are available. The stone is highlighted and its capturing squares are shown.',
      'You may stop at any time: tap the stone again or press End turn. After a move that does not capture, the turn always passes. This game makes the extra move optional; some traditions make it compulsory.',
    ] },
    ar: { title: 'الحركات الإضافية', body: [
      'بعد الأسر يجوز للحجر الذي أسر أن يتحرك مرة أخرى، لكن بشرط أن يأسر من جديد. يمكنك المتابعة ما دام الأسر ممكنًا. يُضاء الحجر وتظهر المربعات التي يأسر عندها.',
      'يمكنك التوقف في أي وقت: المس الحجر مرة أخرى أو اضغط «إنهاء الدور». وبعد أي حركة لا تأسر ينتقل الدور دائمًا. هذه اللعبة تجعل الحركة الإضافية اختيارية، وبعض التقاليد تجعلها إلزامية.',
    ] } },
  { art: 'safe',
    en: { title: 'Safe squares', body: [
      'A corner stone can never be captured: a sandwich needs a square on both sides of the stone in a line, and a corner has none. An edge stone can only be captured along the edge, never across it.',
      'The centre square is a safe square. A stone standing on it cannot be captured, whatever stands around it, but it can still help capture other stones. This is a widely played rule; some versions do not have it.',
    ] },
    ar: { title: 'المربعات الآمنة', body: [
      'حجر الزاوية لا يمكن أسره أبدًا: فالحصار يحتاج إلى مربع على جانبي الحجر في خط واحد، والزاوية ليس فيها ذلك. وحجر الحافة لا يُؤسر إلا على امتداد الحافة، وليس عبرها أبدًا.',
      'المربع الأوسط مربع آمن. الحجر الواقف عليه لا يُؤسر مهما أحاط به، لكنه يستطيع المشاركة في أسر الأحجار الأخرى. هذه قاعدة شائعة، ولا توجد في بعض النسخ.',
    ] } },
  { art: 'blocked',
    en: { title: 'Blocked positions', body: [
      'If a side has no legal move on its turn, the other side moves again. If that does not free the blocked side, the other side keeps moving. If neither side can move, the game ends and the side with more stones wins; equal stones is a draw.',
      'A message appears when a side is passed. Traditions differ here: some make the blocked side\'s opponent remove stones, others count a blocked side as lost. This game uses the simplest rule: the free side moves again.',
    ] },
    ar: { title: 'المواضع المحجوبة', body: [
      'إذا لم يكن لدى جانب أي حركة قانونية في دوره يتحرك الجانب الآخر مرة أخرى. وإن لم يُفك ذلك حصار الجانب المحجوب يواصل الآخر الحركة. وإذا تعذّرت الحركة على الجانبين انتهت اللعبة وفاز من لديه أحجار أكثر، والتساوي تعادل.',
      'تظهر رسالة عند تجاوز دور جانب. تختلف التقاليد هنا: بعضها يجعل خصم الجانب المحجوب يزيل أحجارًا، وبعضها يعدّ الجانب المحجوب خاسرًا. وهذه اللعبة تستخدم أبسط قاعدة: الجانب الحر يتحرك مرة أخرى.',
    ] } },
  { art: 'end',
    en: { title: 'How a game ends', body: [
      `A side reduced to ${MIN_STONES - 1} stone has lost: a lone stone can never make a sandwich, so the game is over. That is the usual way to win.`,
      `Games can also reach a stand-off in which neither side can safely attack. If ${STALL_LIMIT} moves in a row (about ${STALL_LIMIT / 2} by each side) pass without a capture, the side with more stones wins. With equal stones the game is a draw. A counter above the board shows how close the game is to that limit.`,
    ] },
    ar: { title: 'كيف تنتهي اللعبة', body: [
      'الجانب الذي يُختزل إلى حجر واحد خاسر: فالحجر المنفرد لا يستطيع أن يحاصر شيئًا، فتنتهي اللعبة. هذه هي الطريقة المعتادة للفوز.',
      `قد تصل اللعبة أيضًا إلى جمود لا يستطيع فيه أي جانب الهجوم بأمان. إذا مرّت ${STALL_LIMIT} حركة متتالية (نحو ${STALL_LIMIT / 2} لكل جانب) دون أسر فاز الجانب الأكثر أحجارًا. وعند تساوي الأحجار تكون اللعبة تعادلًا. يظهر عدّاد أعلى الرقعة يبيّن مدى اقتراب اللعبة من هذا الحد.`,
    ] } },
  { art: 'sizes',
    en: { title: 'Where traditions differ', body: [
      'Seega has been played in many places, mostly taught by showing, so written rules vary. This game follows the common form: two stones at a time, the centre kept empty, the last placer moving first into the centre, custodian capture, a safe centre, and a win by reducing the other side to one stone.',
      'Other sources differ on blocked positions, whether the extra move is compulsory, how a stand-off is scored, and whether the first player is the first or the second placer. Where they differ, the choices above are the ones this game makes. Boards of 7x7 and 9x9 also exist; this game uses 5x5.',
    ] },
    ar: { title: 'حيث تختلف التقاليد', body: [
      'لُعبت سيجا في أماكن كثيرة، وتُنقل غالبًا بالمشاهدة، فتتفاوت القواعد المكتوبة. تتبع هذه اللعبة الصيغة الشائعة: حجران في كل دور، والمركز فارغ، والواضع الأخير يتحرك أولًا إلى المركز، والأسر بالحصر، ومركز آمن، والفوز بإبقاء الخصم على حجر واحد.',
      'تختلف المصادر الأخرى في المواضع المحجوبة، وفي كون الحركة الإضافية إلزامية، وفي طريقة احتساب الجمود، وفي كون اللاعب الأول هو الواضع الأول أم الثاني. وحيث تختلف فهذه اللعبة تأخذ بالخيارات المذكورة أعلاه. وتوجد أيضًا رقع 7×7 و9×9، أما هذه اللعبة فتستخدم 5×5.',
    ] } },
  { art: 'sides',
    en: { title: 'Choosing your side', body: [
      'Against the computer you choose to play the pebbles (place first, move second) or the date stones (place second, move first). The computer plays the other side. Play Again keeps your side; Change Game lets you pick again.',
      'In two-player mode both players share the phone. The highlighted name and the status line show whose turn it is.',
    ] },
    ar: { title: 'اختيار جانبك', body: [
      'ضد الحاسوب تختار أن تلعب بالحصى (تضع أولًا وتتحرك ثانيًا) أو بنوى التمر (تضع ثانيًا وتتحرك أولًا). ويلعب الحاسوب الجانب الآخر. «العب مرة أخرى» يُبقي جانبك، و«تغيير اللعبة» يتيح لك الاختيار من جديد.',
      'في وضع اللاعبين يتشارك اللاعبان الهاتف. والاسم المضيء وسطر الحالة يبيّنان صاحب الدور.',
    ] } },
  { art: 'levels',
    en: { title: 'Opponent levels', body: [
      'Novice places stones almost at random and takes a capture only now and then. Casual usually takes a capture it can see and prefers corners and edges, but does not look ahead. Skilled looks about three moves ahead and weighs its layout; Expert about five; Master about eight.',
      'The levels were calibrated by playing them against each other over many games from both sides: each level beats the one below it more often than not. The game cannot promise a win at any level, because the side that moves first has an edge.',
    ] },
    ar: { title: 'مستويات الخصم', body: [
      'المبتدئ يضع الأحجار شبه عشوائيًا ولا يأسر إلا أحيانًا. والهاوي يأسر عادةً ما يراه ويفضّل الزوايا والحواف لكنه لا ينظر إلى الأمام. والماهر ينظر نحو ثلاث حركات إلى الأمام ويوازن تشكيله؛ والخبير نحو خمس؛ والأستاذ نحو ثمانٍ.',
      'ضُبطت المستويات بجعلها تلعب ضد بعضها في مباريات كثيرة من الجانبين: كل مستوى يتغلب على الذي دونه في أغلب الأحيان. لكن اللعبة لا تعد بالفوز في أي مستوى، لأن الجانب الذي يتحرك أولًا له أفضلية.',
    ] } },
  { art: 'think',
    en: { title: 'Think', body: [
      'Think suggests a move and explains it in words: a capture, a stone leaving danger, a safe corner, the safe centre. Every reason is checked against the position by the game engine before it is shown.',
      'Think never moves for you and is free to use as often as you like, in placement and in movement, for either side.',
    ] },
    ar: { title: 'فكّر', body: [
      'يقترح «فكّر» حركة ويشرحها بالكلمات: أسر، أو حجر يبتعد عن الخطر، أو زاوية آمنة، أو المركز الآمن. ويتحقق محرك اللعبة من كل سبب مقابل الموضع قبل عرضه.',
      'لا يحرّك «فكّر» عنك أبدًا، ويمكنك استخدامه مجانًا كلما شئت، في الوضع وفي التحريك، لأي جانب.',
    ] } },
  { art: 'undo',
    en: { title: 'Undo and Restart', body: [
      'Undo takes back your last turn (and the opponent\'s reply). During placement it takes back your last stone. In two-player mode it takes back one turn. Restart begins again from the empty board.',
      'Your game is saved after every move. Leave and come back, and Continue game on the menu takes you back to it, paused.',
    ] },
    ar: { title: 'التراجع والإعادة', body: [
      'يعيد «تراجع» آخر دور لك (وردّ الخصم). وأثناء الوضع يعيد آخر حجر وضعته. وفي وضع اللاعبين يعيد دورًا واحدًا. أما «إعادة» فتبدأ من الرقعة الفارغة من جديد.',
      'تُحفظ لعبتك بعد كل حركة. اخرج ثم عد، فيأخذك «متابعة اللعبة» في القائمة إليها، متوقفة مؤقتًا.',
    ] } },
  { art: 'learn',
    en: { title: 'Learn', body: [
      'Learn is a short course of real positions: safe corners, blocking the first move, the first slide into the centre, capturing, capturing two at once, keeping going, staying safe, the safe centre and blocked positions. A move that is wrong is not played: you are told why and can try again.',
      'Lessons you finish are ticked. They do not use up the free preview.',
    ] },
    ar: { title: 'تعلّم', body: [
      '«تعلّم» دورة قصيرة من مواضع حقيقية: زوايا آمنة، ومنع الحركة الأولى، وأول انزلاق إلى المركز، والأسر، وأسر حجرين معًا، ومواصلة الأسر، والبقاء آمنًا، والمركز الآمن، والمواضع المحجوبة. الحركة الخاطئة لا تُلعب: يُقال لك السبب ويمكنك المحاولة مرة أخرى.',
      'الدروس التي تنهيها تُعلَّم بعلامة. ولا تستهلك المعاينة المجانية.',
    ] } },
  { art: 'auto',
    en: { title: 'Watch & Learn', body: [
      'Watch & Learn plays a whole game for you with the game\'s own opponent engine on both sides: Skilled plays the pebbles and Casual the date stones, which makes for a lively game with captures and a finish. Each decision has three steps: THINK (2, 5, 8 or 10 seconds, you choose), REVEAL (two seconds: the options light up and the chosen one is marked, with the reason in words) and ACT.',
      'Pause freezes everything where it is and Resume carries on from exactly there. Watch & Learn does not use up the free preview.',
    ] },
    ar: { title: 'شاهد وتعلّم', body: [
      'يلعب «شاهد وتعلّم» لعبة كاملة نيابةً عنك بمحرك الخصم نفسه في اللعبة على الجانبين: الماهر يلعب بالحصى والهاوي بنوى التمر، فتكون لعبة حيّة فيها أسر ونهاية. لكل قرار ثلاث خطوات: التفكير (2 أو 5 أو 8 أو 10 ثوانٍ، تختار أنت)، ثم الكشف (ثانيتان: تضيء الخيارات ويُعلَّم الخيار المختار مع السبب بالكلمات)، ثم التنفيذ.',
      'يجمّد «إيقاف مؤقت» كل شيء مكانه، وتواصل «متابعة» من الموضع نفسه تمامًا. ولا يستهلك «شاهد وتعلّم» المعاينة المجانية.',
    ] } },
  { art: 'themes',
    en: { title: 'Boards and sound', body: [
      'In Settings you can choose the board and stones: Sandstone, Basalt and Copper, or Oasis Night. The rules do not change. Sound can be switched off, the think time of Watch & Learn set, and the text size raised up to 300 percent on every text screen, including the game screen.',
      'There are no timers and no stakes: results are only kept as your own record of wins, draws and losses for each level. The game starts with a free preview of the first 90 seconds of play; the full game is a single one-time unlock and works offline.',
    ] },
    ar: { title: 'الرقع والصوت', body: [
      'من الإعدادات يمكنك اختيار الرقعة والأحجار: حجر رملي، أو بازلت ونحاس، أو ليل الواحة. القواعد لا تتغير. ويمكن إيقاف الصوت، وضبط مدة التفكير في «شاهد وتعلّم»، ورفع حجم النص حتى 300 بالمئة في كل شاشات النص، بما فيها شاشة اللعب.',
      'لا مؤقتات ولا رهانات: تُحفظ النتائج فقط كسجل خاص بك للفوز والتعادل والخسارة لكل مستوى. تبدأ اللعبة بمعاينة مجانية لأول 90 ثانية من اللعب، والفتح الكامل عملية شراء واحدة، وتعمل بلا اتصال بالإنترنت.',
    ] } },
];

const ABOUT_DEF = [
  { en: { title: 'Seega: Desert Siege', body: 'A traditional two-player game for a 5x5 board, built with lit pebbles and date stones on a carved sandstone board. Fill the board two stones at a time, then slide and sandwich.' },
    ar: { title: 'سيجا: حصار الصحراء', body: 'لعبة تقليدية للاعبين اثنين على رقعة 5×5، بحصى وأحجار نوى تمر مضاءة على رقعة من الحجر الرملي المحفور. املآ الرقعة حجرين حجرين، ثم حرّك وحاصر.' } },
  { en: { title: 'Where it comes from', body: 'Seega is a traditional game of Egypt. It has been written about in English since at least 1836, and it was played with pebbles on a grid scratched into the ground or holes dug in the sand. Different places play it a little differently, and the Rules explain the choices this game makes.' },
    ar: { title: 'من أين جاءت', body: 'سيجا لعبة تقليدية من مصر. كُتب عنها بالإنجليزية منذ عام 1836 على الأقل، وكانت تُلعب بالحصى على شبكة تُخطّ في الأرض أو في حفر تُحفر في الرمل. وتختلف طريقة لعبها قليلًا من مكان إلى آخر، وتشرح «القواعد» الخيارات التي تأخذ بها هذه اللعبة.' } },
  { en: { title: 'In this game', body: 'Five opponent levels from Novice to Master, two players on one phone, Think with a plain-English reason, a short Learn course and Watch & Learn. Three boards to choose from, text that scales up to 300 percent, no timers, works offline.' },
    ar: { title: 'في هذه اللعبة', body: 'خمسة مستويات للخصم من المبتدئ إلى الأستاذ، ولاعبان على هاتف واحد، و«فكّر» مع سبب بكلمات بسيطة، ودورة «تعلّم» قصيرة، و«شاهد وتعلّم». ثلاث رقع للاختيار، ونص يكبر حتى 300 بالمئة، بلا مؤقتات، وتعمل بلا اتصال.' } },
];

const pick = (def) => def.map((d) => ({ art: d.art, ...(isAr() ? d.ar : d.en) }));
export const getHowto = () => pick(HOWTO_DEF);
export const getRules = () => pick(RULES_DEF);
export const getAbout = () => ABOUT_DEF.map((d) => (isAr() ? d.ar : d.en));
export const RULE_COUNT = RULES_DEF.length;
export const HOWTO_COUNT = HOWTO_DEF.length;
