// All player-facing text. Two complete presentations, chosen by the player and never blended: English ('en') and Arabic ('ar').
// Numbers come from the engine's own constants so the Rules pages cannot drift from it.
import { PIECES, FLAT_ODDS, FLAT_TO_VALUE, SAFE } from './rules.js';

export const LANGS = [{ id: 'en', label: 'Play in English' }, { id: 'ar', label: 'اللعب بالعربية' }];
export const QUICK = 4;

export const STR = {
  en: {
    title: 'Tab', titleSub: 'Stick Race', tagline: 'The four-stick race of Egypt and the Arab world',
    playBtn: 'Play', continueBtn: 'Continue game', learnBtn: 'Learn', autoBtn: 'Watch & Learn', howtoBtn: 'How to Play', rulesBtn: 'Rules', aboutBtn: 'About',
    settingsBtn: 'Settings', back: 'Back', next: 'Next', prev: 'Previous', think: 'Think', undo: 'Undo', throwBtn: 'Throw', restart: 'Restart', resume: 'Resume', paused: 'Paused',
    quitMenu: 'Main Menu', soundOn: 'Sound: On', soundOff: 'Sound: Off', thinkTime: 'Watch & Learn think time', seconds: 's',
    restore: 'Restore Purchases', unlock: 'Unlock Full Game', resetProgress: 'Erase Records and Progress', resetConfirm: 'Tap again to erase everything',
    owned: 'Full game unlocked. Thank you!', theme: 'Board and mat', startGame: 'Start game', opponentTitle: 'Opponent', sideTitle: 'Your side', piecesTitle: 'Stones each',
    sideFirst: 'Ivory (first)', sideSecond: 'Clay (second)', twoPlayers: 'Two players', youWord: 'You', vsComputer: 'vs computer',
    pieces7: 'Standard (7)', pieces4: 'Quick (4)', twoInfo: 'Two players share the phone. Ivory throws first.',
    autoThink: 'Thinking', autoPause: 'Pause', autoPlay: 'Resume', autoExit: 'Exit', autoSlower: 'Think -', autoFaster: 'Think +',
    autoSession: 'Watch & Learn', autoAgain: 'Watch Again',
    autoSummary: 'You watched a whole game. Every move was chosen by the game\'s own analysis, with its reason shown before it was played.',
    demoLimitTitle: 'FREE PREVIEW FINISHED', demoLimitBody: 'You played the free games. Get the full game on iPhone and Android for every opponent level, two players on one phone, all three boards and the full Learn course.',
    demoLeft: '{n} free games left', record: 'Record', wins: 'W', losses: 'L',
    lessonsTitle: 'Learn', lessonDone: 'Done', again: 'Play Again', newSetup: 'Change Game', lessonNext: 'Next Lesson', lessonRetry: 'Try Again', lessonList: 'All Lessons',
    textSize: 'Text size', locked: 'In the full game', language: 'Language',
    // play
    ivory: 'Ivory', clay: 'Clay', home: 'home', waiting: 'waiting', onBoard: 'on board', toMove: 'to move', thinking: 'Thinking...',
    yourThrow: 'Your throw', yourThrowBody: 'Tap Throw, or the felt, to throw the four sticks.', turnThrow: '{side} to throw', theyThrow: '{name} throws the sticks',
    gotValue: '{side} throws {v}', gotValueAgain: '{v}: throw again!', flatsUp: '{n} flat up', tapStone: 'Spend a count', tapStoneBody: 'Tap one of your stones, then a glowing square. The number on the square is the count it uses.',
    pickDest: 'Tap a glowing square', pickDestBody: 'The number on each square is the count it uses.',
    passTurn: 'No move is possible: the turn passes', dropped: 'No stone can use the rest of the counts',
    capturesStone: '{side} captures a stone!', entersStone: '{side} brings a stone onto the board', bearsOff: '{side} bears a stone home', movesStone: '{side} moves a stone',
    youWin: 'You win!', sideWins: '{side} wins!', levelWins: '{name} wins', allHome: 'All stones are home.', youWinBody: 'All of your stones reached home first.',
    refuseNotTurn: 'It is not your turn.', refuseThrow: 'Throw the sticks first.', refuseNoMove: 'That stone cannot move with any of your counts.', refuseNoStone: 'Tap one of your own stones, or a glowing square.',
    refuseSafe: 'An enemy stone on a star square cannot be captured: that move is not allowed.', refuseOwn: 'Your own stone is in the way.', refuseWho: 'More than one stone can go there: tap the stone you want first.',
    stats: 'Games won', unlockWord: 'Unlock',
    // throws
    v1: 'Tab', v2: 'Two', v3: 'Three', v4: 'Four', v6: 'Six',
    // Think
    thinkBest: 'Best move', thinkSource: 'Think',
    threats: 'Threats',
    howTo: 'How to Play',
  },
  ar: {
    title: 'طاب', titleSub: 'سباق العيدان', tagline: 'سباق العيدان الأربعة في مصر والعالم العربي',
    playBtn: 'العب', continueBtn: 'متابعة اللعبة', learnBtn: 'تعلّم', autoBtn: 'شاهد وتعلّم', howtoBtn: 'طريقة اللعب', rulesBtn: 'القواعد', aboutBtn: 'حول اللعبة',
    settingsBtn: 'الإعدادات', back: 'رجوع', next: 'التالي', prev: 'السابق', think: 'فكّر', undo: 'تراجع', throwBtn: 'ارمِ', restart: 'إعادة', resume: 'استئناف', paused: 'متوقف مؤقتاً',
    quitMenu: 'القائمة الرئيسية', soundOn: 'الصوت: يعمل', soundOff: 'الصوت: متوقف', thinkTime: 'مدة التفكير في «شاهد وتعلّم»', seconds: ' ث',
    restore: 'استعادة المشتريات', unlock: 'فتح اللعبة كاملة', resetProgress: 'مسح السجلات والتقدّم', resetConfirm: 'اضغط مرة أخرى للمسح',
    owned: 'اللعبة كاملة مفتوحة. شكراً لك!', theme: 'اللوح والبساط', startGame: 'ابدأ اللعبة', opponentTitle: 'الخصم', sideTitle: 'جانبك', piecesTitle: 'عدد الحجارة لكل لاعب',
    sideFirst: 'العاج (يبدأ)', sideSecond: 'الطين (ثانياً)', twoPlayers: 'لاعبان', youWord: 'أنت', vsComputer: 'ضد الحاسوب',
    pieces7: 'عادية (7)', pieces4: 'سريعة (4)', twoInfo: 'لاعبان على هاتف واحد. العاج يرمي أولاً.',
    autoThink: 'يفكر', autoPause: 'إيقاف مؤقت', autoPlay: 'استئناف', autoExit: 'خروج', autoSlower: 'تفكير -', autoFaster: 'تفكير +',
    autoSession: 'شاهد وتعلّم', autoAgain: 'شاهد مرة أخرى',
    autoSummary: 'شاهدت لعبة كاملة. اختارت اللعبة كل نقلة بتحليلها الخاص، وعرضت سببها قبل أن تُلعب.',
    demoLimitTitle: 'انتهت المعاينة المجانية', demoLimitBody: 'لقد لعبت الألعاب المجانية. احصل على اللعبة كاملة على آيفون وأندرويد: كل مستويات الخصم، ولاعبان على هاتف واحد، واللوحات الثلاث، ودورة التعلّم كاملة.',
    demoLeft: 'تبقّى {n} ألعاب مجانية', record: 'السجل', wins: ' فوز', losses: ' خسارة',
    lessonsTitle: 'تعلّم', lessonDone: 'تمّ', again: 'العب مرة أخرى', newSetup: 'تغيير اللعبة', lessonNext: 'الدرس التالي', lessonRetry: 'حاول مرة أخرى', lessonList: 'كل الدروس',
    textSize: 'حجم الخط', locked: 'في اللعبة الكاملة', language: 'اللغة',
    ivory: 'العاج', clay: 'الطين', home: 'في البيت', waiting: 'تنتظر', onBoard: 'على اللوح', toMove: 'دوره', thinking: 'يفكر...',
    yourThrow: 'دورك للرمي', yourThrowBody: 'اضغط «ارمِ» أو اضغط على البساط لترمي العيدان الأربعة.', turnThrow: 'دور {side} للرمي', theyThrow: '{name} يرمي العيدان',
    gotValue: '{side} رمى {v}', gotValueAgain: '{v}: ارمِ مرة أخرى!', flatsUp: '{n} مسطّح لأعلى', tapStone: 'استعمل عدداً', tapStoneBody: 'اضغط على أحد حجارتك ثم على مربع مضيء. الرقم على المربع هو العدد الذي يستعمله.',
    pickDest: 'اضغط على مربع مضيء', pickDestBody: 'الرقم على كل مربع هو العدد الذي يستعمله.',
    passTurn: 'لا توجد نقلة ممكنة: ينتقل الدور', dropped: 'لا يستطيع أي حجر استعمال بقية الأعداد',
    capturesStone: '{side} يأسر حجراً!', entersStone: '{side} يُدخل حجراً إلى اللوح', bearsOff: '{side} يُخرج حجراً إلى البيت', movesStone: '{side} يحرّك حجراً',
    youWin: 'فزت!', sideWins: 'فاز {side}!', levelWins: 'فاز {name}', allHome: 'وصلت كل الحجارة إلى البيت.', youWinBody: 'وصلت كل حجارتك إلى البيت أولاً.',
    refuseNotTurn: 'ليس دورك.', refuseThrow: 'ارمِ العيدان أولاً.', refuseNoMove: 'لا يستطيع هذا الحجر أن يتحرك بأي من أعدادك.', refuseNoStone: 'اضغط على أحد حجارتك أو على مربع مضيء.',
    refuseSafe: 'لا يمكن أسر حجر الخصم على مربع النجمة: هذه النقلة غير مسموحة.', refuseOwn: 'حجرك في الطريق.', refuseWho: 'يمكن لأكثر من حجر الوصول إلى هناك: اضغط أولاً على الحجر الذي تريده.',
    stats: 'الألعاب الفائزة', unlockWord: 'فتح',
    v1: 'طاب', v2: 'اثنان', v3: 'ثلاثة', v4: 'أربعة', v6: 'ستة',
    thinkBest: 'أفضل نقلة', thinkSource: 'فكّر',
    threats: 'المخاطر',
    howTo: 'طريقة اللعب',
  },
};
export const tr = (key, vars, lang = 'en') => {
  let s = (STR[lang] && STR[lang][key]) ?? STR.en[key] ?? key;
  if (vars) for (const k of Object.keys(vars)) s = s.split(`{${k}}`).join(String(vars[k]));
  return s;
};
export const valueName = (v, lang = 'en') => tr(`v${v}`, null, lang);

const odds = (n) => `${FLAT_ODDS[n]} in 16`;
const flatTable = [0, 1, 2, 3, 4].map((n) => `${n} flat up = ${FLAT_TO_VALUE[n]} (${odds(n)})`).join('; ');
const flatTableAr = [0, 1, 2, 3, 4].map((n) => `${n} مسطّح لأعلى = ${FLAT_TO_VALUE[n]} (${FLAT_ODDS[n]} من 16)`).join('؛ ');

// ---------------------------------------------------------------------------------------------------- How to Play
export const HOWTO = [
  { art: 'logo', en: { title: 'The goal', body: `Each side has ${PIECES} stones (or ${QUICK} in a Quick game). Throw four sticks, move your stones along the path of 28 squares, capture rival stones by landing on them, and bring every stone home before your opponent does.` },
    ar: { title: 'الهدف', body: `لكل لاعب ${PIECES} حجارة (أو ${QUICK} في اللعبة السريعة). ارمِ العيدان الأربعة، وحرّك حجارتك على مسار من 28 مربعاً، وأسر حجارة الخصم بالنزول فوقها، وأوصل كل حجارتك إلى البيت قبل خصمك.` } },
  { art: 'sticks', en: { title: 'Throwing the sticks', body: 'Tap Throw (or the felt). Each stick lands with its flat carved side up or its round back up. The number of flat sides up gives the count: none flat is 6, one is 1 (called tab), two is 2, three is 3, four is 4. After a 1, 4 or 6 you throw again; a 2 or a 3 ends your throws. You keep every count you threw.' },
    ar: { title: 'رمي العيدان', body: 'اضغط «ارمِ» (أو اضغط على البساط). يقع كل عود على وجهه المسطّح المنقوش أو على ظهره المستدير. عدد الأوجه المسطحة إلى أعلى يعطي العدد: لا شيء مسطح = 6، واحد = 1 (ويسمى طاب)، اثنان = 2، ثلاثة = 3، أربعة = 4. بعد 1 أو 4 أو 6 ترمي مرة أخرى، وبعد 2 أو 3 تنتهي رمياتك. تحتفظ بكل الأعداد التي رميتها.' } },
  { art: 'enter', en: { title: 'Entering stones', body: 'Your stones wait in the yard beside the board. A count of 1 brings one stone onto your start square (the arrow in the corner of your home row). Until a stone is on the board, only a 1 can move it.' },
    ar: { title: 'إدخال الحجارة', body: 'تنتظر حجارتك في الساحة بجانب اللوح. العدد 1 يُدخل حجراً واحداً إلى مربع البداية (السهم في ركن صفّك). ما دام الحجر خارج اللوح فلا يحرّكه إلا العدد 1.' } },
  { art: 'move', en: { title: 'Moving and capturing', body: 'Spend each count on one stone: tap the stone, then the glowing square. A stone moves that many squares along the path and may jump over anything. Land on an enemy stone and it is captured: it goes back to its yard and needs a 1 to enter again.' },
    ar: { title: 'التحريك والأسر', body: 'اصرف كل عدد على حجر واحد: اضغط على الحجر ثم على المربع المضيء. يتحرك الحجر بعدد المربعات على المسار ويمكنه القفز فوق أي شيء. إذا نزلت فوق حجر الخصم فقد أسرته: يعود إلى ساحته ويحتاج إلى 1 ليدخل من جديد.' } },
  { art: 'safe', en: { title: 'Star squares', body: 'The middle square of each row has a star. A stone on a star cannot be captured, and an enemy stone cannot land there while it is occupied. Resting on a star is the safest place on the board.' },
    ar: { title: 'مربعات النجمة', body: 'في منتصف كل صف مربع عليه نجمة. الحجر الذي على النجمة لا يمكن أسره، ولا يستطيع حجر الخصم النزول عليه ما دام مشغولاً. الوقوف على النجمة أأمن مكان في اللوح.' } },
  { art: 'home', en: { title: 'Going home', body: 'Both sides walk the same 28 squares in opposite directions, so the armies meet head on. A stone that is carried past the last square goes home. Whoever brings all their stones home first wins.' },
    ar: { title: 'العودة إلى البيت', body: 'يسير الطرفان على المربعات الـ28 نفسها في اتجاهين متعاكسين، فيلتقي الجيشان وجهاً لوجه. الحجر الذي يتجاوز آخر مربع يذهب إلى البيت. من يوصل كل حجارته إلى البيت أولاً يفوز.' } },
  { art: 'think', en: { title: 'Think and Learn', body: 'Think shows the best move and says why, using the real chances of the next throws. Learn is a short course of real positions. Watch & Learn plays a whole game with the reasons shown.' },
    ar: { title: 'فكّر وتعلّم', body: 'يعرض «فكّر» أفضل نقلة ويشرح سببها بحساب الاحتمالات الحقيقية للرميات القادمة. «تعلّم» دورة قصيرة من مواقف حقيقية. و«شاهد وتعلّم» يلعب لعبة كاملة مع عرض الأسباب.' } },
];

// ---------------------------------------------------------------------------------------------------- Rules
const SAFE_TXT = 'four';
export const RULES = [
  { art: 'logo', en: { title: 'The game', body: [
    'Tab (Arabic: طاب, "tab") is a traditional race-and-capture game of Egypt and the Arab world, played with four flat-sided throwing sticks. Two sides, Ivory and Clay, each have stones that walk the same path in opposite directions.',
    `Each side starts with ${PIECES} stones (a Quick game uses ${QUICK}). The stones start off the board, in the side's yard. The aim is to bring every one of your stones all the way along the path and home before the other side does.`,
  ] }, ar: { title: 'اللعبة', body: [
    'طاب لعبة تقليدية للسباق والأسر في مصر والعالم العربي، تُلعب بأربعة عيدان مسطّحة الوجه تُرمى على الأرض. لكل من الطرفين، العاج والطين، حجارة تسير على المسار نفسه في اتجاهين متعاكسين.',
    `يبدأ كل طرف بـ${PIECES} حجارة (وفي اللعبة السريعة ${QUICK}). تبدأ الحجارة خارج اللوح في ساحة الطرف. الهدف أن توصل كل حجارتك على طول المسار إلى البيت قبل الطرف الآخر.`,
  ] } },
  { art: 'board', en: { title: 'The board and the path', body: [
    'The board is 4 rows of 7 squares: 28 squares in all. They form one path that snakes from row to row. Ivory\'s path starts in the bottom-left corner, runs right along the bottom row, climbs to the second row and runs back left, and so on up to the top-left corner. Clay walks the same path from the top-left corner down to the bottom-left corner.',
    'Both sides therefore use the same squares, going in opposite directions. A faint groove through the squares shows the path. A small arrow marks where each side enters and where each side leaves.',
  ] }, ar: { title: 'اللوح والمسار', body: [
    'اللوح 4 صفوف من 7 مربعات: 28 مربعاً. تشكل مساراً واحداً يلتف من صف إلى صف. يبدأ مسار العاج من الركن الأسفل الأيسر، ويسير يميناً على الصف الأسفل، ثم يصعد إلى الصف الثاني ويسير يساراً، وهكذا حتى الركن الأعلى الأيسر. ويسير الطين على المسار نفسه من الركن الأعلى الأيسر نزولاً إلى الركن الأسفل الأيسر.',
    'فيستعمل الطرفان المربعات نفسها في اتجاهين متعاكسين. أخدود خفيف بين المربعات يبيّن المسار، وسهم صغير يبيّن أين يدخل كل طرف وأين يخرج.',
  ] } },
  { art: 'sticks', en: { title: 'The four sticks', body: [
    'Each throwing stick has a flat carved side and a round back, like a split cane. The four sticks are thrown together onto the felt. Count the sticks that land flat side up: ' + flatTable + '.',
    'So a 2 is the most common count and a 4 or a 6 is rare. The sticks are thrown with real, tumbling motion, but the result of every stick is decided fairly: each is a fair toss, half flat and half round.',
  ] }, ar: { title: 'العيدان الأربعة', body: [
    'لكل عود وجه مسطّح منقوش وظهر مستدير، كأنه قصبة مشقوقة. تُرمى العيدان الأربعة معاً على البساط. عُدّ العيدان التي وقعت على وجهها المسطّح إلى أعلى: ' + flatTableAr + '.',
    'فالعدد 2 هو الأكثر شيوعاً، والعددان 4 و6 نادران. تتقلب العيدان بحركة حقيقية، لكن نتيجة كل عود عادلة: نصف احتمال مسطّح ونصف احتمال مستدير.',
  ] } },
  { art: 'throws', en: { title: 'A turn: collecting counts', body: [
    'A count of 1 (tab), 4 or 6 gives you another throw. A count of 2 or 3 ends your throwing. You keep all the counts from the turn (for example 1, 4, 2) and then spend them.',
    'You may spend the counts in any order, each on any stone, and you may give several counts to the same stone one after another. A count you cannot use is lost. If you can make a move you must make one: you cannot pass on purpose.',
  ] }, ar: { title: 'الدور: جمع الأعداد', body: [
    'العدد 1 (طاب) أو 4 أو 6 يمنحك رمية أخرى. العدد 2 أو 3 ينهي رمياتك. تحتفظ بكل أعداد الدور (مثلاً 1 و4 و2) ثم تصرفها.',
    'يمكنك صرف الأعداد بأي ترتيب، كل عدد على أي حجر، ويمكنك إعطاء عدة أعداد لحجر واحد على التوالي. العدد الذي لا تستطيع استعماله يضيع. وإذا كانت لديك نقلة ممكنة فعليك أن تلعبها: لا يمكنك التمرير عمداً.',
  ] } },
  { art: 'enter', en: { title: 'Entering a stone', body: [
    'A stone off the board can enter only with a count of 1: it is placed on your start square (the first square of your path). If one of your own stones is already there, you cannot enter. If an enemy stone is there, it is captured.',
    'The start squares are not star squares, so a stone just entered can be captured. While you have no stone on the board, only a 1 lets you do anything at all.',
  ] }, ar: { title: 'إدخال حجر', body: [
    'الحجر الذي خارج اللوح لا يدخل إلا بالعدد 1: يوضع على مربع البداية (أول مربع في مسارك). فإذا كان أحد حجارتك هناك فلا يمكنك الدخول. وإذا كان هناك حجر للخصم فإنه يُؤسر.',
    'مربعا البداية ليسا مربعي نجمة، فالحجر الذي دخل للتو قد يُؤسر. وما دام ليس لديك حجر على اللوح فلا شيء يمكنك فعله إلا بالعدد 1.',
  ] } },
  { art: 'move', en: { title: 'Moving a stone', body: [
    'A count of n moves one stone n squares forward along the path. It may jump over any stones, yours or the enemy\'s; only the square it lands on matters. The count must be used in full.',
    'You cannot land on a square held by one of your own stones. A count of 1 can also be used to move a stone one square, not only to enter.',
  ] }, ar: { title: 'تحريك حجر', body: [
    'العدد n يحرّك حجراً واحداً n مربعاً إلى الأمام على المسار. ويمكنه القفز فوق أي حجارة، لك أو للخصم؛ المهم فقط المربع الذي ينزل عليه. ويجب استعمال العدد كاملاً.',
    'لا يمكنك النزول على مربع فيه حجر لك. ويمكن استعمال العدد 1 أيضاً لتحريك حجر مربعاً واحداً، لا للإدخال فقط.',
  ] } },
  { art: 'capture', en: { title: 'Capturing', body: [
    'If a stone lands on a square held by an enemy stone, the enemy stone is captured. It goes back to its yard and must enter again with a 1. Captured stones are not lost for ever in this edition, but they lose all the squares they had walked.',
    'You do not get an extra throw for a capture. A capture is never forced: you may always choose another move.',
  ] }, ar: { title: 'الأسر', body: [
    'إذا نزل حجر على مربع فيه حجر للخصم فإن حجر الخصم يُؤسر. يعود إلى ساحته ويجب أن يدخل من جديد بالعدد 1. الحجارة المأسورة لا تضيع نهائياً في هذه النسخة، لكنها تفقد كل المربعات التي قطعتها.',
    'لا تحصل على رمية إضافية بسبب الأسر. والأسر ليس إلزامياً: يمكنك دائماً اختيار نقلة أخرى.',
  ] } },
  { art: 'safe', en: { title: 'Star squares', body: [
    `The middle square of each of the four rows is a star square (${SAFE.length} in all). A stone on a star square cannot be captured. An enemy stone cannot land on a star square while a stone is on it: that move is simply not allowed. Your own stones cannot land on each other either.`,
    'You can still jump over a star square. Star squares are where a stone can rest in safety while you wait for the right count.',
  ] }, ar: { title: 'مربعات النجمة', body: [
    `منتصف كل صف من الصفوف الأربعة مربع نجمة (${SAFE.length} في المجموع). الحجر الذي على مربع النجمة لا يمكن أسره. ولا يستطيع حجر الخصم النزول على مربع النجمة ما دام عليه حجر: هذه النقلة غير مسموحة. وكذلك لا تنزل حجارتك فوق بعضها.`,
    'ويمكنك القفز فوق مربع النجمة. مربعات النجمة هي المكان الذي يستريح فيه الحجر بأمان بانتظار العدد المناسب.',
  ] } },
  { art: 'home', en: { title: 'Going home and winning', body: [
    'A stone that is carried past the last square of its path (the corner at the far end) leaves the board and is home. It needs no exact count: any count that takes it past the end sends it home.',
    'The first side to bring all its stones home wins. There are no draws. This game is for fun and records only wins and losses; there are no stakes of any kind.',
  ] }, ar: { title: 'العودة إلى البيت والفوز', body: [
    'الحجر الذي يتجاوز آخر مربع في مساره (الركن في الطرف البعيد) يغادر اللوح ويصبح في البيت. لا يحتاج إلى عدد دقيق: أي عدد يتجاوز به النهاية يرسله إلى البيت.',
    'أول طرف يوصل كل حجارته إلى البيت يفوز. ولا يوجد تعادل. اللعبة للمتعة وتسجّل الفوز والخسارة فقط، ولا توجد رهانات من أي نوع.',
  ] } },
  { art: 'pass', en: { title: 'When no move is possible', body: [
    'After your last throw, if none of your counts can be used (for example a stone off the board with no 1, or every landing square is blocked), the turn passes at once. If only some counts can be used, the others are lost when nothing else can be done with them.',
    'A throw sequence always ends: a 2 or a 3 comes up with probability 5 in 8 on every throw.',
  ] }, ar: { title: 'عندما لا توجد نقلة ممكنة', body: [
    'بعد رمايتك الأخيرة، إذا لم يمكن استعمال أي عدد (مثلاً حجر خارج اللوح بلا عدد 1، أو كانت كل مربعات النزول مسدودة) ينتقل الدور فوراً. وإذا أمكن استعمال بعض الأعداد فقط، تضيع الأعداد الأخرى حين لا يبقى ما يمكن فعله بها.',
    'سلسلة الرميات تنتهي دائماً: يظهر 2 أو 3 باحتمال 5 من 8 في كل رمية.',
  ] } },
  { art: 'variants', en: { title: 'How this edition differs', body: [
    'Published descriptions of Tab differ. In the traditional game the board may be 4 rows by 7 to 15 squares, each side starts with one stone on every square of its home row (nine on the common 9-square board), a stone must be woken with a tab before it can move, stones can stack, and captured stones are out of the game for good: the winner is the last side with stones.',
    `This edition is a race version with simple, documented rules: ${PIECES} stones (or ${QUICK}), a single path of 28 squares, stones that start in a yard, captured stones that return to the yard, and the first side home wins, so every game ends.`,
  ] }, ar: { title: 'ما يختلف في هذه النسخة', body: [
    'تختلف الأوصاف المنشورة للعبة طاب. ففي اللعبة التقليدية قد يكون اللوح 4 صفوف في 7 إلى 15 مربعاً، ويبدأ كل طرف بحجر على كل مربع من صفّه الأول (تسعة حجارة على اللوح الشائع من 9 مربعات)، ويجب «إيقاظ» الحجر بالعدد طاب قبل أن يتحرك، ويمكن تكديس الحجارة، والحجارة المأسورة تخرج من اللعبة نهائياً: ويفوز آخر طرف تبقى له حجارة.',
    `هذه النسخة نسخة سباق بقواعد بسيطة موثّقة: ${PIECES} حجارة (أو ${QUICK})، ومسار واحد من 28 مربعاً، وحجارة تبدأ في ساحة، والحجارة المأسورة تعود إلى الساحة، ويفوز أول طرف يصل إلى البيت، فتنتهي كل لعبة.`,
  ] } },
  { art: 'levels', en: { title: 'Opponent levels', body: [
    'Beginner plays any legal move. Casual likes captures and entering but ignores danger and sometimes slips. Skilled weighs the chance of being hit before every move. Expert plans the order of all the counts of a turn. Master plays every turn the best way it can find, and also prizes star squares and getting stones on the board.',
    'Each level beat the one below it in our own test games, so the ladder is real. Dice always matter, so a weaker side can still win a game.',
  ] }, ar: { title: 'مستويات الخصم', body: [
    'المبتدئ يلعب أي نقلة مسموحة. والعادي يحب الأسر والإدخال لكنه يتجاهل الخطر وقد يخطئ. والماهر يحسب احتمال الأسر قبل كل نقلة. والخبير يخطط لترتيب كل أعداد الدور. والأستاذ يلعب كل دور بأفضل طريقة يجدها، ويقدّر أيضاً مربعات النجمة وإدخال الحجارة.',
    'كل مستوى هزم الذي تحته في ألعاب الاختبار لدينا، فالسلّم حقيقي. لكن للحظ دوراً دائماً، فقد يفوز الطرف الأضعف بلعبة.',
  ] } },
  { art: 'think', en: { title: 'Think', body: [
    'Think looks at every way to spend your counts, lights up the best first move and explains it with the real chances of the next throws: for example "the chance an enemy can reach this square next turn falls from at most 38% to at most 6%". It never plays the move for you.',
    'Every reason is checked against the real position by the game before it is shown. The percentages come from the exact odds of the four sticks and are upper limits, because they ignore whether the other side\'s own stones block its path.',
  ] }, ar: { title: 'فكّر', body: [
    'يفحص «فكّر» كل طرق صرف أعدادك، ويضيء أفضل نقلة أولى، ويشرحها باحتمالات الرميات القادمة الحقيقية، مثل: «احتمال وصول حجر للخصم إلى هذا المربع في دوره القادم ينخفض من 38% على الأكثر إلى 6% على الأكثر». ولا يلعب النقلة عنك أبداً.',
    'تتحقق اللعبة من كل سبب مقابل الموقف الحقيقي قبل عرضه. والنسب مأخوذة من الاحتمالات الدقيقة للعيدان الأربعة، وهي حدود قصوى لأنها تتجاهل ما إذا كانت حجارة الخصم نفسها تسد طريقه.',
  ] } },
  { art: 'undo', en: { title: 'Undo, Pause and Continue', body: [
    'Undo takes back your last move within the same turn (the counts come back). It cannot undo a throw, because a throw cannot be taken back. It is not available inside lessons.',
    'Pause stops everything where it is. Your game is saved after every move: leave and come back and Continue game on the menu takes you back to it, paused.',
  ] }, ar: { title: 'التراجع والإيقاف والمتابعة', body: [
    'يلغي «تراجع» آخر نقلة لك داخل الدور نفسه (وتعود الأعداد). ولا يمكنه إلغاء رمية لأن الرمية لا تُسترجع. ولا يتوفر داخل الدروس.',
    'يوقف «إيقاف مؤقت» كل شيء مكانه. وتُحفظ لعبتك بعد كل نقلة: اخرج وعد، فتأخذك «متابعة اللعبة» في القائمة إليها وهي متوقفة مؤقتاً.',
  ] } },
  { art: 'learn', en: { title: 'Learn and Watch & Learn', body: [
    'Learn is a course of short lessons, each a real position: throwing, entering, moving, capturing, star squares, going home and a whole game against Casual. A wrong move in a lesson is not played: you are told why and can try again. Lessons do not use up the free preview.',
    'Watch & Learn plays a whole short game for you (three stones each). Each move has three steps: THINK (2, 5, 8 or 10 seconds, you choose), REVEAL (two seconds: the stone, the square and the reason in words) and ACT (the move is played). Pause freezes everything and Resume carries on exactly where it stopped.',
  ] }, ar: { title: 'تعلّم وشاهد وتعلّم', body: [
    '«تعلّم» دورة من دروس قصيرة، كل درس موقف حقيقي: الرمي، والإدخال، والتحريك، والأسر، ومربعات النجمة، والعودة إلى البيت، ولعبة كاملة ضد المستوى العادي. النقلة الخاطئة في الدرس لا تُلعب: يُشرح لك السبب وتحاول من جديد. ولا تستهلك الدروس المعاينة المجانية.',
    '«شاهد وتعلّم» يلعب لعبة قصيرة كاملة عنك (ثلاثة حجارة لكل طرف). لكل نقلة ثلاث خطوات: التفكير (2 أو 5 أو 8 أو 10 ثوانٍ بحسب اختيارك)، ثم العرض (ثانيتان: الحجر والمربع والسبب بالكلمات)، ثم التنفيذ (تُلعب النقلة). يجمّد الإيقاف المؤقت كل شيء، ويتابع الاستئناف من حيث توقف تماماً.',
  ] } },
  { art: 'themes', en: { title: 'Boards, sound, language and text', body: [
    'In Settings you can choose the board and mat: Sand and Inlay, Lapis Night or Date Palm. The rules do not change. Sound can be switched off, the think time of Watch & Learn set, and the text size raised up to 300 percent on every text screen, including while playing.',
    'You can play in English or in Arabic (طاب). The choice is on the menu and in Settings and never changes by itself. There are no timers and no stakes: results are only kept as your own record of wins and losses for each level.',
  ] }, ar: { title: 'اللوحات والصوت واللغة والخط', body: [
    'في الإعدادات يمكنك اختيار اللوح والبساط: رمل وترصيع، أو ليل اللازورد، أو نخيل. القواعد لا تتغير. ويمكن إيقاف الصوت، وضبط مدة التفكير في «شاهد وتعلّم»، ورفع حجم الخط حتى 300 بالمئة في كل شاشة نصية بما فيها أثناء اللعب.',
    'يمكنك اللعب بالإنجليزية أو بالعربية (طاب). الاختيار في القائمة وفي الإعدادات ولا يتغير من تلقاء نفسه. لا توجد مؤقّتات ولا رهانات: تُحفظ النتائج سجلاً شخصياً لانتصاراتك وخسائرك في كل مستوى فقط.',
  ] } },
  { art: 'logo', en: { title: 'Names, words and the preview', body: [
    'Tab is written طاب in Arabic and pronounced "tab"; the same word names a throw of one flat side. The stones are called kelb (dog) in Egyptian Arabic. In this game the two sides are called Ivory and Clay. The four-stick throws are named in Arabic mode: طاب (1), اثنان (2), ثلاثة (3), أربعة (4) and ستة (6).',
    'The preview: the full game starts with a free preview of the first 90 seconds of play; the full game is a single one-time unlock and works offline.',
  ] }, ar: { title: 'الأسماء والكلمات والمعاينة', body: [
    'تُكتب «طاب» بالعربية وتُنطق «طاب»، وهي الكلمة نفسها التي تسمّي رمية الوجه المسطح الواحد. وتسمى الحجارة «كلب» في العامية المصرية. في هذه اللعبة يسمى الطرفان العاج والطين. وتسمى رميات العيدان في الوضع العربي: طاب (1) واثنان (2) وثلاثة (3) وأربعة (4) وستة (6).',
    'المعاينة: تبدأ اللعبة الكاملة بمعاينة مجانية لأول 90 ثانية من اللعب؛ واللعبة الكاملة تُفتح مرة واحدة وتعمل بلا اتصال.',
  ] } },
];

export const ABOUT = [
  { en: { title: 'Tab: Stick Race', body: 'A race-and-capture game of four throwing sticks: tumble the sticks across the felt, bring your stones on with a one, hit your rival\'s stones, rest on the star squares and be first to bring every stone home. Three carved boards, five opponent levels, two players on one phone, Think with a reason in words, a Learn course and Watch & Learn.' },
    ar: { title: 'طاب: سباق العيدان', body: 'لعبة سباق وأسر بأربعة عيدان تُرمى: اجعل العيدان تتقلب على البساط، وأدخل حجارتك بالعدد واحد، واضرب حجارة خصمك، واستند إلى مربعات النجمة، وكن أول من يوصل كل حجارته إلى البيت. ثلاث لوحات منقوشة، وخمسة مستويات للخصم، ولاعبان على هاتف واحد، و«فكّر» بسببٍ مكتوب، ودورة تعلّم، و«شاهد وتعلّم».' } },
  { en: { title: 'Where it comes from', body: 'Tab is a traditional running-fight game played in Egypt and other Arab countries; related games called sig are played in North Africa. It is played on a board four squares wide, usually an odd number of squares long (from 7 up to 15), with four throwing sticks that are marked on one side. Published descriptions differ in the details; the exact origin is not documented. The stones are called kelb ("dog") in Egyptian Arabic.' },
    ar: { title: 'من أين جاءت', body: 'طاب لعبة تقليدية تُلعب في مصر وبلدان عربية أخرى، وتُلعب ألعاب قريبة منها تسمى «سيغ» في شمال أفريقيا. تُلعب على لوح عرضه أربعة مربعات وطوله عادةً عدد فردي من المربعات (من 7 إلى 15)، بأربعة عيدان تُرمى ومعلَّمة من جهة واحدة. وتختلف الأوصاف المنشورة في التفاصيل، وأصل اللعبة الدقيق غير موثّق. وتسمى الحجارة «كلب» في العامية المصرية.' } },
  { en: { title: 'In this game', body: `A race edition with ${PIECES} stones a side (or ${QUICK}), one 28-square path, star squares, extra throws on a one, four or six, and every count spendable in any order. Original art and sound, text that scales up to 300 percent, no timers, no stakes, works offline.` },
    ar: { title: 'في هذه اللعبة', body: `نسخة سباق بـ${PIECES} حجارة لكل طرف (أو ${QUICK})، ومسار واحد من 28 مربعاً، ومربعات نجمة، ورميات إضافية عند الواحد والأربعة والستة، وكل عدد يمكن صرفه بأي ترتيب. فن وصوت أصليان، وخط يكبر حتى 300 بالمئة، بلا مؤقّتات ولا رهانات، ويعمل بلا اتصال.` } },
];
export const RULE_COUNT = RULES.length;
export const HOWTO_COUNT = HOWTO.length;
export const pageOf = (list, i, lang) => { const p = list[i]; return { art: p.art, ...(p[lang] ?? p.en) }; };
void SAFE_TXT;
