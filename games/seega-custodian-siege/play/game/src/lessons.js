// The tutor path. Each lesson is a real position; the answer is judged by the game engine itself (the same capture and
// threat tests the opponents and Think use), so a lesson can never accept a move the engine knows to be wrong.
// Boards: X = pebbles (the learner, side 1), O = date stones, . = empty; five rows of five.
import { parse, applyMove, legalMoves, turnYield, hasMoves, canBeCaptured, other, ADJ, CENTRE } from './rules.js';
import { tr, stonesObj } from './content.js';
import { isAr } from './lang.js';

export const LESSONS = [
  { id: 'corners', place: true, board: '..O../.X.O./O..X./.XO../...O.', turn: 1, accept: 'corner',
    en: { title: 'Safe corners', task: 'Placement. You are the pebbles and place two stones this turn. Put both on squares that can never be captured.',
      done: 'A corner stone can never be sandwiched: there is no square on both sides of it in a line. Corners are the safest squares to start from. Edge stones can only be captured along the edge.' },
    ar: { title: 'الزوايا الآمنة', task: 'الوضع. أنت الحصى وتضع حجرين في هذا الدور. ضعهما على مربعين لا يمكن أسرهما أبدًا.',
      done: 'حجر الزاوية لا يمكن حصره أبدًا: ليس على جانبيه مربعان في خط واحد. فالزوايا أكثر المربعات أمانًا للبدء. وحجر الحافة لا يُؤسر إلا على امتداد الحافة.' } },
  { id: 'beside', place: true, board: '.OXOX/OXXOO/XX..O/OX.OX/OOXX.', turn: 1, accept: 'beside',
    en: { title: 'Block the first move', task: 'Placement. The date stones place last, so they move first, and they need a stone beside the centre. None of theirs touches it yet. Place your two stones so that none ever will.',
      done: 'The side that places last moves first, but only if one of its stones touches the centre. With all four squares beside the centre held by pebbles, the date stones are blocked and the pebbles move first.' },
    ar: { title: 'امنع الحركة الأولى', task: 'الوضع. نوى التمر تضع أخيرًا فتتحرك أولًا، وهي تحتاج إلى حجر بجانب المركز، ولا يلامسه أي حجر منها حتى الآن. ضع حجريك بحيث لا يلامسه أي حجر منها أبدًا.',
      done: 'الجانب الذي يضع أخيرًا يتحرك أولًا، لكن فقط إذا كان أحد أحجاره يلامس المركز. وحين تحتل الحصى المربعات الأربعة المجاورة للمركز تصير نوى التمر محجوبة وتتحرك الحصى أولًا.' } },
  { id: 'first', board: 'OXOXO/XOXOX/XO.OO/OXOXX/XOXOX', turn: 1, accept: 'any',
    en: { title: 'The first slide', task: 'The board is full except the centre and you move first. Only one of your stones touches the centre: slide it in.',
      done: 'The side that placed last moves first, and the first move must go into the centre. Here that slide also captured a stone: the date stone on the left was trapped between the centre and your stone beyond it.' },
    ar: { title: 'أول انزلاق', task: 'الرقعة ممتلئة ما عدا المركز وأنت تتحرك أولًا. حجر واحد فقط من أحجارك يلامس المركز: أدخله.',
      done: 'الجانب الذي وضع أخيرًا يتحرك أولًا، ويجب أن تكون الحركة الأولى إلى المركز. وهنا أسر هذا الانزلاق حجرًا أيضًا: فقد حوصر حجر نوى التمر الذي على اليسار بين المركز وحجرك الذي وراءه.' } },
  { id: 'capture', board: '...../XO.X./...../..O../.X..O', turn: 1, accept: 'bestturn',
    en: { title: 'Capture by sandwich', task: 'Find the slide that traps a date stone between two of your pebbles, in a row or a column.',
      done: 'You capture by moving a stone so that an enemy stone has one of yours on each side. The captured stone is removed at once.' },
    ar: { title: 'الأسر بالحصر', task: 'ابحث عن الانزلاق الذي يحاصر حجر نوى تمر بين حصاتين من حصاك، في صف أو في عمود.',
      done: 'تأسر بتحريك حجر بحيث يصير على كل جانب من الحجر المعادي حجر من أحجارك. ويُزال الحجر المأسور فورًا.' } },
  { id: 'double', board: '...../..X../XO.OX/..O../.....', turn: 1, accept: 'bestturn',
    en: { title: 'Two at once', task: 'One slide can trap stones on more than one side. Find the move that captures two stones.',
      done: 'The stone you slide can close several sandwiches at once, in any of its directions. Look for squares with an enemy on two sides, each backed by one of your stones.' },
    ar: { title: 'اثنان معًا', task: 'قد يحاصر انزلاق واحد أحجارًا على أكثر من جانب. ابحث عن الحركة التي تأسر حجرين.',
      done: 'الحجر الذي تحرّكه قد يُغلق عدة حصارات معًا، في أي اتجاه. ابحث عن مربعات فيها حجر معادٍ على جهتين، وخلف كل منهما حجر من أحجارك.' } },
  { id: 'chain', board: '..X../XO.../...OX/...../....O', turn: 1, accept: 'bestturn',
    en: { title: 'Keep going', task: 'After a capture the same stone may move again to capture again. Capture two stones in one turn.',
      done: 'After a capture, if the same stone can capture again you may carry on; tap it or End turn to stop. Chains are how games turn quickly.' },
    ar: { title: 'تابع', task: 'بعد الأسر يجوز للحجر نفسه أن يتحرك مرة أخرى ليأسر من جديد. أسر حجرين في دور واحد.',
      done: 'بعد الأسر، إذا استطاع الحجر نفسه أن يأسر مرة أخرى فيمكنك المتابعة؛ المسه أو اضغط «إنهاء الدور» للتوقف. بالسلاسل تنقلب المباريات بسرعة.' } },
  { id: 'safe', board: '...../.OX.O/...X./...../X...O', turn: 1, accept: 'safe',
    en: { title: 'Do not get sandwiched', task: 'A date stone is about to slide in and trap your stone beside it. Make a move after which the pebbles cannot be captured.',
      done: 'Before every move, ask what the other side could capture next. You can move the stone away, or fill the square it needs.' },
    ar: { title: 'لا تُحصر', task: 'حجر من نوى التمر على وشك أن ينزلق ويحاصر حجرك المجاور له. قم بحركة لا تستطيع الحصى بعدها أن تُؤسر.',
      done: 'قبل كل حركة اسأل: ماذا يستطيع الجانب الآخر أن يأسر بعدها؟ يمكنك إبعاد الحجر، أو ملء المربع الذي يحتاجه الخصم.' } },
  { id: 'centre', board: '...XX/.O.../.X.O./O..O./.....', turn: 1, accept: 'safe',
    en: { title: 'The safe centre', task: 'Your stone on the left is about to be trapped and every escape square is dangerous except one. Find the safe square.',
      done: 'A stone on the centre square can never be captured. It is also close to everything, so it is a strong place to stand.' },
    ar: { title: 'المركز الآمن', task: 'حجرك الأيسر على وشك أن يُحاصر وكل مربعات الهروب خطرة إلا مربعًا واحدًا. ابحث عن المربع الآمن.',
      done: 'الحجر الواقف على المربع الأوسط لا يمكن أسره أبدًا. وهو قريب من كل شيء، فهو مكان قوي للوقوف.' } },
  { id: 'blocked', board: '...../...../...../X...X/OXX.O', turn: 1, accept: 'blockade', finish: 'accept',
    en: { title: 'Blocked positions', task: 'The date stones are nearly boxed in. Make the move that leaves them with no move at all.',
      done: 'If a side has no move, the other side moves again. Here the date stones cannot move at all, so you would go again. A blocked side can often be squeezed further.' },
    ar: { title: 'المواضع المحجوبة', task: 'نوى التمر شبه محاصرة. قم بالحركة التي لا تترك لها أي حركة.',
      done: 'إذا لم يكن لدى جانب أي حركة يتحرك الجانب الآخر مرة أخرى. وهنا لا تستطيع نوى التمر التحرك إطلاقًا، فتلعب أنت مرة أخرى. ويمكن غالبًا الضغط أكثر على الجانب المحجوب.' } },
];

const txt = (l) => (isAr() ? l.ar : l.en);
export const lessonTitle = (l) => txt(l).title;
export const lessonTask = (l) => txt(l).task;
export const lessonDone = (l) => txt(l).done;

export function lessonStart(L) {
  const st = parse(L.board, L.turn);
  if (L.place) return { ...st, phase: 'place', placed: [st.placed[0], st.placed[1]] };
  return st;
}

// The most stones this turn's capture sequence could take, starting with `mv`.
export function turnValue(st, mv) {
  const n = applyMove(st, mv);
  const c = n.last.captured.length;
  if (n.chain >= 0 && n.turn === st.turn && !n.over) {
    let best = 0;
    for (const m2 of legalMoves(n)) if (m2.from !== -2) best = Math.max(best, turnValue(n, m2));
    return c + best;
  }
  return c;
}

// Judge a move in a lesson. Returns { ok, text } (text is in the player's language).
export function judge(L, st, mv) {
  const foe = other(st.turn);
  if (L.accept === 'corner') {
    if (canBeCaptured(mv.to)) return { ok: false, text: tr('jCorner') };
    return { ok: true, text: lessonDone(L) };
  }
  if (L.accept === 'beside') {
    if (ADJ[CENTRE].includes(mv.to)) return { ok: true, text: lessonDone(L) };
    return { ok: false, text: tr('jBeside') };
  }
  if (L.accept === 'any') return { ok: true, text: lessonDone(L) };
  if (L.accept === 'bestturn') {
    const moves = legalMoves(st);
    if (mv.from === -2) {
      const more = moves.some((m) => m.from !== -2);
      return more ? { ok: false, text: tr('jKeepGoing') } : { ok: true, text: lessonDone(L) };
    }
    const real = moves.filter((m) => m.from !== -2);
    const best = Math.max(...real.map((m) => turnValue(st, m)));
    const mine = turnValue(st, mv);
    if (mine === best) return { ok: true, text: lessonDone(L) };
    if (mine === 0) return { ok: false, text: tr('jNothing') };
    return { ok: false, text: tr('jLess', { a: stonesObj(mine), b: stonesObj(best) }) };
  }
  if (L.accept === 'safe') {
    const n = applyMove(st, mv);
    const y = n.over ? 0 : turnYield(n, foe);
    if (y === 0) return { ok: true, text: lessonDone(L) };
    return { ok: false, text: tr('jUnsafe', { n: stonesObj(y) }) };
  }
  if (L.accept === 'blockade') {
    const n = applyMove(st, mv);
    if (!hasMoves(n.cells, foe) || (n.last && n.last.passed === foe)) return { ok: true, text: lessonDone(L) };
    return { ok: false, text: tr('jBlock') };
  }
  return { ok: true, text: lessonDone(L) };
}
