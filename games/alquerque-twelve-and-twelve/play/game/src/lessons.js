// The Learn path. Each lesson is a real position; the answer is judged by the real rules engine (the same one the opponents and
// Think use), so a lesson can never accept a move the engine does not allow. The player is always Light, at the bottom.
import { parse, applyMove, threatened, rc } from './rules.js';
import { langIndex } from './lang.js';
import { tr } from './content.js';

const T = (en, es, ar) => [en, es, ar];

export const LESSONS = [
  { id: 'step', board: 'OOOOO/OOOOO/OO.XX/XXXXX/XXXXX', turn: 1, accept: 'step', finish: 'accept',
    title: T('Step along a line', 'Un paso por una línea', 'خطوة على خط'),
    task: T('You are Light, at the bottom. Only the centre point is empty, so a piece next to it must step in. Tap one of your pieces, then the glowing point.',
      'Eres las Claras, abajo. Solo el punto central está vacío, así que una pieza junto a él debe entrar. Toca una de tus piezas y luego el punto brillante.',
      'أنت الفاتحة في الأسفل. المركز وحده فارغ، فيجب أن تدخل إليه قطعة مجاورة. المس إحدى قطعك ثم النقطة المضيئة.'),
    done: T('That is a step: one point along a line to an empty point, forward or sideways, never backward. A step never captures.',
      'Eso es un paso: un punto a lo largo de una línea hasta un punto vacío, hacia delante o de lado, nunca hacia atrás. Un paso nunca captura.',
      'هذه خطوة: نقطة واحدة على خط إلى نقطة فارغة، إلى الأمام أو الجانب، ولا تعود إلى الخلف. والخطوة لا تأسر أبدًا.') },
  { id: 'diag', board: 'O..../...../...../.X.../.....', turn: 1, accept: 'diag', finish: 'accept',
    title: T('The diagonals', 'Las diagonales', 'الأقطار'),
    task: T('Diagonal lines pass only through every other point. Your piece stands on one of those points. Select it, see where it can go, and step along a diagonal.',
      'Las líneas diagonales solo pasan por uno de cada dos puntos. Tu pieza está en uno de ellos. Selecciónala, mira adónde puede ir y avanza por una diagonal.',
      'الخطوط القطرية تمر بنقطة من كل نقطتين فقط. وقطعتك تقف على إحدى هذه النقاط. اخترها وانظر إلى أين تذهب، ثم تحرّك على قطر.'),
    done: T('Points where the row and column numbers add up to an even number have eight lines. The other points only have the four straight ones.',
      'Los puntos en que la suma de fila y columna es par tienen ocho líneas. Los demás solo tienen las cuatro rectas.',
      'النقاط التي يكون مجموع رقمَي صفها وعمودها زوجيًا لها ثمانية خطوط. أما بقية النقاط فلها الخطوط المستقيمة الأربعة فقط.') },
  { id: 'jump', board: 'O..../...../..O../..X../.....', turn: 1, accept: 'capture', finish: 'accept',
    title: T('Jump to capture', 'Saltar para capturar', 'القفز للأسر'),
    task: T('A Dark piece stands right in front of yours with an empty point behind it. Select your piece, then tap the point beyond the Dark piece to jump it.',
      'Una pieza Oscura está justo delante de la tuya con un punto vacío detrás. Selecciona tu pieza y toca el punto de detrás de la Oscura para saltarla.',
      'قطعة داكنة أمام قطعتك مباشرة وخلفها نقطة فارغة. اختر قطعتك ثم المس النقطة التي خلف القطعة الداكنة لتقفز فوقها.'),
    done: T('A jump goes over one adjacent enemy piece along a line and lands on the empty point beyond. The jumped piece is removed.',
      'Un salto pasa sobre una pieza rival vecina a lo largo de una línea y cae en el punto vacío de detrás. La pieza saltada se retira.',
      'تعبر القفزة فوق قطعة معادية مجاورة على خط وتهبط على النقطة الفارغة خلفها. وتُزال القطعة المقفوز فوقها.') },
  { id: 'must', board: '...../...../..O.O/..X.X/X....', turn: 1, accept: 'capture', finish: 'accept',
    title: T('Capturing is compulsory', 'Capturar es obligatorio', 'الأسر إلزامي'),
    task: T('You have two captures, so you cannot step. First tap the piece in the bottom-left corner, which has no capture, and see what happens. Then make either capture.',
      'Tienes dos capturas, así que no puedes dar un paso. Primero toca la pieza de la esquina inferior izquierda, que no tiene captura, y mira qué pasa. Luego haz cualquiera de las capturas.',
      'لديك أسران، فلا تستطيع الخطو. المس أولًا القطعة في الزاوية السفلية اليسرى التي لا أسر لها وانظر ما يحدث. ثم نفّذ أيًّا من الأسرين.'),
    done: T('When a capture exists you must capture. You may pick which one. Pieces that can capture glow to help you.',
      'Cuando existe una captura debes capturar. Puedes elegir cuál. Las piezas que pueden capturar brillan para ayudarte.',
      'حين يوجد أسر يجب أن تأسر. ولك أن تختار أيّها. وتتوهج القطع التي تستطيع الأسر لتساعدك.') },
  { id: 'chain', board: '....O/.O.../..O../..X../.....', turn: 1, accept: 'capture', finish: 'turn',
    title: T('Multiple jumps', 'Saltos múltiples', 'القفزات المتتالية'),
    task: T('Jump the piece in front of you. Where you land, another jump is waiting: the same piece must take it. Tap the glowing points.',
      'Salta la pieza que tienes delante. Donde caes te espera otro salto: la misma pieza debe hacerlo. Toca los puntos brillantes.',
      'اقفز فوق القطعة التي أمامك. وحيث تهبط تنتظرك قفزة أخرى: يجب أن تؤديها القطعة نفسها. المس النقاط المضيئة.'),
    done: T('After a jump the same piece must jump again while it can, in any direction along a line. One turn took two pieces.',
      'Tras un salto la misma pieza debe volver a saltar mientras pueda, en cualquier dirección por una línea. Un turno se llevó dos piezas.',
      'بعد القفزة يجب أن تقفز القطعة نفسها مرة أخرى ما دام ذلك ممكنًا، في أي اتجاه على خط. وقد أخذ دور واحد قطعتين.') },
  { id: 'back', board: 'O..../..X../..O../...../.....', turn: 1, accept: 'capture', finish: 'accept',
    title: T('Jumping backward', 'Saltar hacia atrás', 'القفز إلى الخلف'),
    task: T('Your piece has run ahead of the Dark piece below it. Steps cannot go backward, but a jump can. Jump down over the Dark piece.',
      'Tu pieza se ha adelantado a la pieza Oscura que tiene debajo. Los pasos no pueden ir atrás, pero un salto sí. Salta hacia abajo sobre la Oscura.',
      'تقدمت قطعتك على القطعة الداكنة التي تحتها. الخطوات لا تعود إلى الخلف أما القفزة فتعود. اقفز إلى الأسفل فوق القطعة الداكنة.'),
    done: T('Jumps go in any direction along a line. That is why a piece that runs ahead alone can be captured from behind.',
      'Los saltos van en cualquier dirección por una línea. Por eso una pieza que se adelanta sola puede ser capturada por detrás.',
      'القفزات في أي اتجاه على خط. ولهذا يمكن أسر القطعة التي تتقدم وحدها من الخلف.') },
  { id: 'safe', board: '..O../.X.X./O..../...../..X..', turn: 1, accept: 'safe', finish: 'accept',
    title: T('Keep your pieces safe', 'Pon tus piezas a salvo', 'احمِ قطعك'),
    task: T('You have no capture, but a Dark piece threatens one of yours. Find a step after which none of your pieces can be jumped. (Think shows one.)',
      'No tienes captura, pero una pieza Oscura amenaza a una tuya. Busca un paso tras el cual ninguna de tus piezas pueda ser saltada. (Pensar te enseña uno.)',
      'لا أسر لديك، لكن قطعة داكنة تهدّد إحدى قطعك. ابحث عن خطوة لا يمكن بعدها القفز فوق أي من قطعك. (يُريك «فكّر» واحدة.)'),
    done: T('Before every step ask: which of my pieces can be jumped now, and which after my move? Moving the threatened piece, or filling the landing point, ends the threat.',
      'Antes de cada paso pregunta: ¿qué piezas mías pueden ser saltadas ahora, y cuáles después de mi jugada? Mover la pieza amenazada, o rellenar el punto de caída, acaba con la amenaza.',
      'قبل كل خطوة اسأل: أي قطعي يمكن القفز فوقها الآن، وأيها بعد حركتي؟ تحريك القطعة المهدَّدة، أو ملء نقطة الهبوط، ينهي التهديد.') },
  { id: 'best', board: '...../...../X...X/..X.O/.OXX.', turn: 1, accept: 'safecap', finish: 'accept',
    title: T('Choose the safer capture', 'Elige la captura más segura', 'اختر الأسر الأكثر أمانًا'),
    task: T('You have two captures and must take one. One leaves a piece of yours open to be captured back; the other is clean. Find the clean one.',
      'Tienes dos capturas y debes tomar una. Una deja una pieza tuya expuesta a ser recapturada; la otra es limpia. Encuentra la limpia.',
      'لديك أسران ويجب أن تختار أحدهما. أحدهما يترك إحدى قطعك معرّضة للأسر؛ والآخر نظيف. ابحث عن النظيف.'),
    done: T('A capture lands your piece on a new point. If an enemy piece can then jump it, you lose it again. Check the landing point and what stands behind it.',
      'Una captura deja tu pieza en un punto nuevo. Si una pieza rival puede saltarla entonces, la pierdes de nuevo. Revisa el punto de caída y lo que hay detrás.',
      'يضع الأسر قطعتك على نقطة جديدة. فإن استطاعت قطعة معادية القفز فوقها بعد ذلك خسرتها مجددًا. افحص نقطة الهبوط وما خلفها.') },
  { id: 'game', type: 'game', level: 'casual', human: 1,
    title: T('Play a whole game', 'Juega una partida completa', 'العب لعبة كاملة'),
    task: T(`Play a full game as Light against the Casual opponent. Win by capturing every Dark piece, or leaving Dark with no legal move.`,
      'Juega una partida completa con las Claras contra el rival Aficionado. Gana capturando todas las piezas Oscuras o dejando a las Oscuras sin jugadas legales.',
      'العب لعبة كاملة بالفاتحة ضد الخصم الهاوي. افز بأسر كل القطع الداكنة أو بترك الداكنة بلا حركة قانونية.'),
    done: T('Well played. Every game mixes what you just practised: keep pieces safe, look at what a capture leaves behind, and use multiple jumps.',
      'Bien jugado. Cada partida mezcla lo que acabas de practicar: pon las piezas a salvo, mira lo que deja una captura y aprovecha los saltos múltiples.',
      'أحسنت. كل لعبة تجمع ما تدرّبت عليه للتو: احمِ القطع، وانظر ما يتركه الأسر خلفه، واستخدم القفزات المتتالية.') },
];

const pickT = (a) => a[langIndex()];
export const lessonTitle = (L) => pickT(L.title);
export const lessonTask = (L) => pickT(L.task);
export const lessonDone = (L) => pickT(L.done);
export const lessonStart = (L) => (L.board ? parse(L.board, L.turn) : null);

// Judge a move in a lesson. Returns { ok, text } (text is in the player's language).
export function judge(L, st, mv) {
  const after = applyMove(st, mv);
  const jump = mv.cap >= 0;
  let ok = false, why = '';
  const [r0, c0] = rc(mv.from), [r1, c1] = rc(mv.to);
  switch (L.accept) {
    case 'step': ok = !jump; why = tr('jStep'); break;
    case 'diag': ok = !jump && r0 !== r1 && c0 !== c1; why = tr('jDiag'); break;
    case 'capture': ok = jump; why = tr('jJump'); break;
    case 'safe': ok = !jump && threatened(after, 1).size === 0; why = tr('jSafe'); break;
    case 'safecap': ok = jump && (after.chain >= 0 || threatened(after, 1).size === 0); why = tr('jSafeCap'); break;
    default: ok = true;
  }
  return ok ? { ok, text: lessonDone(L) } : { ok, text: why };
}
