// The Learn path. Each lesson is a real position with scripted throws; the answer is judged by the real rules engine (the same one
// the opponents and Think use), so a lesson can never accept a move the engine does not allow. The player is always Ivory.
import { makeState, applyMove, hitChance, legalMoves, sqOf, isSafe, N, WAIT, other } from './rules.js';

const mk = (ivory, clay, pending, phase = 'move') => makeState(ivory, clay, pending, phase);
const W = WAIT;

export const LESSONS = [
  { id: 'throw', accept: 'throw', force: [1, 3], board: () => mk([4, W, W, W, W], [W, W, W, W, W], [], 'throw'),
    en: { title: 'Throw the sticks', task: 'Tap Throw (or the felt). Watch how many sticks land flat side up. This lesson throws a 1 first (called tab: you throw again) and then a 3, which ends your throws.',
      done: 'Each count is the number of flat sides up: none flat is 6, one is 1, two is 2, three is 3, four is 4. A 1, 4 or 6 gives another throw; a 2 or 3 ends the turn. You keep every count and spend them in any order.' },
    ar: { title: 'ارمِ العيدان', task: 'اضغط «ارمِ» (أو البساط). انظر كم عوداً يقع بوجهه المسطح إلى أعلى. يرمي هذا الدرس 1 أولاً (ويسمى طاب: ترمي مرة أخرى) ثم 3 فتنتهي رمياتك.',
      done: 'كل عدد هو عدد الأوجه المسطحة إلى أعلى: لا وجه مسطّح = 6، ووجه واحد = 1، ووجهان = 2، وثلاثة أوجه = 3، وأربعة أوجه = 4. بعد 1 أو 4 أو 6 ترمي مرة أخرى، وبعد 2 أو 3 ينتهي الدور. تحتفظ بكل الأعداد وتصرفها بأي ترتيب.' } },
  { id: 'enter', accept: 'enter', board: () => mk([W, W, W, W, W], [W, W, W, W, W], [1]),
    en: { title: 'Enter on a one', task: 'You threw a 1 (tab). All your stones are in the yard. Tap the glowing start square (the bottom-left corner of the board) to bring a stone on.',
      done: 'A stone enters only with a 1, onto your start square. Until a stone is on the board, only a 1 lets you move at all.' },
    ar: { title: 'الدخول بالعدد واحد', task: 'رميت 1 (طاب). كل حجارتك في الساحة. اضغط على مربع البداية المضيء (الركن الأسفل الأيسر من اللوح) لتُدخل حجراً.',
      done: 'لا يدخل الحجر إلا بالعدد 1، على مربع البداية. وما دام ليس لديك حجر على اللوح فلا يمكنك أن تتحرك إلا بالعدد 1.' } },
  { id: 'move', accept: 'any', board: () => mk([2, W, W, W, W], [W, W, W, W, W], [3]),
    en: { title: 'Move along the path', task: 'You threw a 3. Tap your stone on the board, then the glowing square three squares ahead of it.',
      done: 'A count of n moves a stone n squares along the path: along the row, then up and back along the next row. A stone may jump over anything; only the landing square matters.' },
    ar: { title: 'التحرك على المسار', task: 'رميت 3. اضغط على حجرك الذي على اللوح ثم على المربع المضيء الذي يبعد عنه ثلاثة مربعات.',
      done: 'العدد n يحرّك الحجر n مربعاً على المسار: على طول الصف، ثم يصعد إلى الصف التالي ويكمل فيه في الاتجاه المعاكس. ويمكن للحجر أن يقفز فوق أي شيء؛ المهم المربع الذي ينزل عليه.' } },
  { id: 'capture', accept: 'capture', board: () => mk([5, 12, W, W, W], [18, W, W, W, W], [4]),
    en: { title: 'Capture a stone', task: 'You threw a 4. A Clay stone stands exactly four squares further along the path from one of your stones. Select that stone and land on the Clay stone to capture it.',
      done: 'Landing on an enemy stone captures it. It goes back to its yard and must enter again with a 1, so it loses every square it had walked.' },
    ar: { title: 'أسر حجر', task: 'رميت 4. يقف حجر للطين على بعد أربعة مربعات تماماً أمام أحد حجارتك على المسار. اختر ذلك الحجر وانزل على حجر الطين لتأسره.',
      done: 'النزول فوق حجر الخصم يأسره. فيعود إلى ساحته ويحتاج إلى العدد 1 ليدخل من جديد، فيفقد كل المربعات التي قطعها.' } },
  { id: 'star', accept: 'safe', board: () => mk([1, 12, W, W, W], [W, W, W, W, W], [2]),
    en: { title: 'The star squares', task: 'You threw a 2. Move a stone onto a star square: the middle square of a row, marked with an eight-point star.',
      done: 'A stone on a star square cannot be captured, and an enemy stone cannot land there. Use the stars to rest a stone in safety.' },
    ar: { title: 'مربعات النجمة', task: 'رميت 2. حرّك حجراً إلى مربع نجمة: المربع الأوسط في الصف وعليه نجمة بثمانية رؤوس.',
      done: 'الحجر الذي على مربع النجمة لا يمكن أسره، ولا يستطيع حجر الخصم النزول عليه. استعمل النجوم لتُبقي حجراً في أمان.' } },
  { id: 'danger', accept: 'minrisk', board: () => mk([11, 2, W, W, W], [13, W, W, W, W], [4]),
    en: { title: 'Get out of danger', task: 'You threw a 4. A Clay stone stands three squares ahead of your stone on the path and walks towards it, so it can hit it on many throws. Use the 4 to jump your stone past the Clay stone. (Think shows the chances.)',
      done: 'Clay stones only walk the other way, so a stone that has jumped past an enemy stone cannot be hit by it any more. Before every move ask: what can reach the square I am leaving, and the one I am landing on?' },
    ar: { title: 'اخرج من الخطر', task: 'رميت 4. يقف حجر للطين على بعد ثلاثة مربعات أمام حجرك على المسار ويسير نحوه، فقد يصيبه في رميات كثيرة. استعمل الـ4 لتقفز بحجرك متجاوزاً حجر الطين. («فكّر» يعرض الاحتمالات.)',
      done: 'حجارة الطين تسير في الاتجاه المعاكس فقط، فالحجر الذي قفز متجاوزاً حجر الخصم لا يستطيع الخصم إصابته بعد ذلك. اسأل نفسك قبل كل نقلة: ما الذي يستطيع الوصول إلى المربع الذي أتركه وإلى المربع الذي أنزل عليه؟' } },
  { id: 'home', accept: 'off', board: () => mk([25, 3, W, W, W], [W, W, W, W, W], [4]),
    en: { title: 'Bring a stone home', task: 'You threw a 4. Your stone near the end of the path (top-left) can use it to go home. Select it and tap the glowing exit.',
      done: 'A stone carried past the last square goes home for good: no exact count is needed. Bring every stone home before your opponent does to win.' },
    ar: { title: 'أوصل حجراً إلى البيت', task: 'رميت 4. يستطيع حجرك القريب من نهاية المسار (أعلى اليسار) أن يستعملها ليذهب إلى البيت. اخترْه ثم اضغط على المخرج المضيء.',
      done: 'الحجر الذي يتجاوز آخر مربع يذهب إلى البيت نهائياً: لا حاجة إلى عدد دقيق. أوصل كل حجارتك إلى البيت قبل خصمك لتفوز.' } },
  { id: 'game', type: 'game', level: 'casual', human: 0, pieces: 4,
    en: { title: 'Play a whole game', task: 'Play a quick game (4 stones each) as Ivory against the Casual opponent. Win by bringing all four stones home first.',
      done: 'Well played. Every game is a mix of what you have just practised: enter on ones, use the stars, hit when it is safe and watch the squares your stones leave behind.' },
    ar: { title: 'العب لعبة كاملة', task: 'العب لعبة سريعة (4 حجارة لكل طرف) بدور العاج ضد الخصم العادي. فز بإيصال كل الحجارة الأربعة إلى البيت أولاً.',
      done: 'أحسنت. كل لعبة مزيج مما تدرّبت عليه للتو: ادخل بالعدد واحد، واستعمل النجوم، واضرب حين يكون ذلك آمناً، وراقب المربعات التي تتركها حجارتك خلفها.' } },
];
export const lessonText = (L, lang) => L[lang] ?? L.en;
export const lessonStart = (L) => (L.board ? L.board() : null);

// Total chance that the other side can hit one of this side's stones next turn, after a state is reached.
export function totalRisk(st, p) {
  let r = 0;
  for (const x of st.pos[p]) { if (x < 0 || x >= N) continue; const sq = sqOf(p, x); if (!isSafe(sq)) r += hitChance(st, other(p), sq); }
  return r;
}

// Judge a move in a lesson. Returns { ok, why } (why is an English key for the refusal text).
export function judge(L, st, mv) {
  const after = applyMove(st, mv);
  switch (L.accept) {
    case 'enter': return mv.from === WAIT ? { ok: true } : { ok: false, why: 'enter' };
    case 'capture': return mv.cap ? { ok: true } : { ok: false, why: 'capture' };
    case 'safe': return !mv.off && isSafe(mv.sq) ? { ok: true } : { ok: false, why: 'safe' };
    case 'off': return mv.off ? { ok: true } : { ok: false, why: 'off' };
    case 'minrisk': {
      const best = Math.min(...legalMoves(st).map((m) => totalRisk(applyMove(st, m), 0)));
      return totalRisk(after, 0) <= best + 0.03 ? { ok: true } : { ok: false, why: 'minrisk' };
    }
    default: return { ok: true };
  }
}
export const REFUSALS = {
  en: { enter: 'That is not an entry. Tap the glowing start square.', capture: 'That move does not capture. Land exactly on the Clay stone.', safe: 'That square is not a star square. Look for the eight-point star.', off: 'That stone is not going home. Use the stone near the end of the path.', minrisk: 'That leaves a stone where Clay can still hit it with a high chance. Find the move that is hit least often.' },
  ar: { enter: 'هذا ليس إدخالاً. اضغط على مربع البداية المضيء.', capture: 'هذه النقلة لا تأسر. انزل تماماً على حجر الطين.', safe: 'هذا المربع ليس مربع نجمة. ابحث عن النجمة ذات الرؤوس الثمانية.', off: 'هذا الحجر لن يذهب إلى البيت. استعمل الحجر القريب من نهاية المسار.', minrisk: 'هذه النقلة تترك حجراً يستطيع الطين إصابته باحتمال كبير. ابحث عن النقلة الأقل عرضة للإصابة.' },
};
