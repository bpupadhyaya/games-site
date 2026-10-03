// All player-facing text, in English, Spanish and Arabic. The player picks one language ("Play in English", "Jugar en español" or
// "العب بالعربية") and every screen then uses that language only. Numbers come from the engine's own constants so the Rules pages
// cannot drift from it.
import { PIECES, QUIET_LIMIT } from './rules.js';
import { langIndex } from './lang.js';

const L = (en, es, ar) => [en, es, ar];

// [English, Spanish, Arabic]. {name} placeholders are filled by tr().
export const STR = {
  playBtn: L('Play', 'Jugar', 'العب'), continueBtn: L('Continue game', 'Continuar partida', 'متابعة اللعبة'), learnBtn: L('Learn', 'Aprender', 'تعلّم'),
  autoBtn: L('Watch & Learn', 'Mirar y aprender', 'شاهد وتعلّم'), howtoBtn: L('How to Play', 'Cómo se juega', 'كيف تلعب'), rulesBtn: L('Rules', 'Reglas', 'القواعد'),
  aboutBtn: L('About', 'Acerca de', 'عن اللعبة'), settingsBtn: L('Settings', 'Ajustes', 'الإعدادات'),
  back: L('Back', 'Atrás', 'رجوع'), next: L('Next', 'Siguiente', 'التالي'), prev: L('Previous', 'Anterior', 'السابق'), think: L('Think', 'Pensar', 'فكّر'), undo: L('Undo', 'Deshacer', 'تراجع'),
  restart: L('Restart', 'Reiniciar', 'إعادة'), resume: L('Resume', 'Reanudar', 'متابعة'), paused: L('Paused', 'En pausa', 'متوقفة مؤقتًا'), quitMenu: L('Main Menu', 'Menú principal', 'القائمة الرئيسية'),
  soundOn: L('Sound: On', 'Sonido: sí', 'الصوت: يعمل'), soundOff: L('Sound: Off', 'Sonido: no', 'الصوت: متوقف'),
  thinkTime: L('Watch & Learn think time', 'Tiempo de pensar en Mirar y aprender', 'مدة التفكير في «شاهد وتعلّم»'), seconds: L('s', ' s', ' ث'),
  restore: L('Restore Purchases', 'Restaurar compras', 'استعادة المشتريات'), unlock: L('Unlock Full Game', 'Desbloquear el juego completo', 'فتح اللعبة كاملة'),
  resetProgress: L('Erase Records and Progress', 'Borrar récords y progreso', 'مسح السجلات والتقدّم'), resetConfirm: L('Tap again to erase everything', 'Toca otra vez para borrar todo', 'المس مرة أخرى لمسح كل شيء'),
  owned: L('Full game unlocked. Thank you!', 'Juego completo desbloqueado. ¡Gracias!', 'تم فتح اللعبة كاملة. شكرًا لك!'),
  theme: L('Board and pieces', 'Tablero y piezas', 'الرقعة والقطع'), startGame: L('Start game', 'Empezar partida', 'ابدأ اللعبة'),
  opponentTitle: L('Opponent', 'Rival', 'الخصم'), sideTitle: L('Your side', 'Tu bando', 'جانبك'),
  playL: L('Light: move first', 'Claras: mueven primero', 'الفاتحة: تتحرك أولًا'), playD: L('Dark: move second', 'Oscuras: mueven después', 'الداكنة: تتحرك ثانيًا'),
  twoPlayers: L('Two players', 'Dos jugadores', 'لاعبان'), youWord: L('You', 'Tú', 'أنت'), vsComputer: L('vs computer', 'contra el ordenador', 'ضد الحاسوب'),
  autoThink: L('Thinking {n}', 'Pensando {n}', 'يفكّر {n}'), thinkingDots: L('Thinking...', 'Pensando...', 'جارٍ التفكير…'),
  autoPause: L('Pause', 'Pausa', 'إيقاف مؤقت'), autoPlay: L('Resume', 'Reanudar', 'متابعة'), autoExit: L('Exit', 'Salir', 'خروج'),
  autoSlower: L('Think -', 'Pensar -', 'تفكير أقل'), autoFaster: L('Think +', 'Pensar +', 'تفكير أكثر'),
  autoSession: L('Watch & Learn', 'Mirar y aprender', 'شاهد وتعلّم'), autoAgain: L('Watch Again', 'Ver otra vez', 'شاهد مرة أخرى'),
  autoSummary: L('You watched a whole game: the opening, the compulsory captures, the multiple jumps and the finish, each move explained. Watch again for a different game, or head to Learn to try the ideas yourself.',
    'Viste una partida entera: la apertura, las capturas obligatorias, los saltos múltiples y el final, con cada jugada explicada. Mira otra vez para ver una partida distinta, o ve a Aprender para probar las ideas tú mismo.',
    'شاهدت لعبة كاملة: البداية، والأسر الإلزامي، والقفزات المتتالية، والنهاية، مع شرح كل حركة. شاهد مرة أخرى للعبة مختلفة، أو انتقل إلى «تعلّم» لتجرّب الأفكار بنفسك.'),
  demoLimitTitle: L('FREE PREVIEW FINISHED', 'VISTA PREVIA GRATIS TERMINADA', 'انتهت المعاينة المجانية'),
  demoLimitBody: L('You played the three free games. Get the full game on iPhone and Android for the strongest opponents, two players on one phone, all nine lessons and as many games as you like.',
    'Jugaste las tres partidas gratis. Consigue el juego completo en iPhone y Android: los rivales más fuertes, dos jugadores en un móvil, las nueve lecciones y todas las partidas que quieras.',
    'لعبتَ الألعاب الثلاث المجانية. احصل على اللعبة كاملة على آيفون وأندرويد لتجد أقوى الخصوم، واللعب بين لاعبين على هاتف واحد، والدروس التسعة كلها، وما شئت من الألعاب.'),
  demoLeft: L('{n} free games left', 'Quedan {n} partidas gratis', 'متبقٍ {n} ألعاب مجانية'),
  alquerque: L('Alquerque', 'Alquerque', 'القِرقات'), twelve: L('Twelve and Twelve', 'Doce contra doce', 'اثنتا عشرة لكل جانب'),
  fromWhere: L('An old game of Spain and the Arab world', 'Un juego antiguo de España y del mundo árabe', 'لعبة قديمة من إسبانيا والعالم العربي'),
  tagline: L('Step  ·  Jump  ·  Capture', 'Paso  ·  Salto  ·  Captura', 'خطوة  ·  قفزة  ·  أسر'),
  record: L('Record', 'Récord', 'السجل'), recordLine: L('{label} ({level}): {w} W  {d} D  {l} L', '{label} ({level}): {w} G  {d} E  {l} P', '{label} ({level}): {w} فوز  {d} تعادل  {l} خسارة'),
  lessonsTitle: L('Learn', 'Aprender', 'تعلّم'), lessonDone: L('Done', 'Hecho', 'تم'), lessonMove: L('Lesson', 'Lección', 'درس'), lessonGame: L('Whole game', 'Partida completa', 'لعبة كاملة'),
  again: L('Play Again', 'Jugar otra vez', 'العب مرة أخرى'), newSetup: L('Change Game', 'Cambiar partida', 'تغيير اللعبة'), lessonNext: L('Next Lesson', 'Siguiente lección', 'الدرس التالي'),
  lessonRetry: L('Try Again', 'Intentarlo de nuevo', 'حاول مرة أخرى'), lessonList: L('All Lessons', 'Todas las lecciones', 'كل الدروس'),
  textSize: L('Text size', 'Tamaño del texto', 'حجم النص'), locked: L('In the full game', 'En el juego completo', 'في اللعبة الكاملة'),
  language: L('Language', 'Idioma', 'اللغة'), light: L('Light', 'Claras', 'الفاتحة'), dark: L('Dark', 'Oscuras', 'الداكنة'),
  lightThe: L('Light', 'las Claras', 'الفاتحة'), darkThe: L('Dark', 'las Oscuras', 'الداكنة'),
  twoInfo: L('Two players share the phone. Light moves first from the bottom.', 'Dos jugadores comparten el móvil. Las Claras mueven primero desde abajo.', 'يتشارك اللاعبان الهاتف. تتحرك الفاتحة أولًا من الأسفل.'),
  sideInfo1: L('You move first, from the bottom, and your first move must go into the empty centre.', 'Mueves primero, desde abajo, y tu primera jugada debe ir al centro vacío.', 'تتحرك أولًا من الأسفل، ويجب أن تكون حركتك الأولى إلى المركز الفارغ.'),
  sideInfo2: L('You move second. The board turns so your pieces are at the bottom.', 'Mueves en segundo lugar. El tablero gira para que tus piezas queden abajo.', 'تتحرك ثانيًا. تدور الرقعة ليكون جانبك في الأسفل.'),
  // HUD
  vsLevel: L('vs computer · {level}', 'contra el ordenador · {level}', 'ضد الحاسوب · {level}'), lessonOf: L('Lesson {n} of {m}', 'Lección {n} de {m}', 'الدرس {n} من {m}'),
  noCapture: L(' · no capture {q}/{m}', ' · sin captura {q}/{m}', ' · دون أسر {q}/{m}'), watchSub: L('Watch & Learn · Think {n}s', 'Mirar y aprender · Pensar {n} s', 'شاهد وتعلّم · تفكير {n} ث'),
  winnerWord: L('Winner', 'Ganan', 'الفائز'), drawWord: L('Draw', 'Empate', 'تعادل'),
  opponentWord: L('Opponent', 'Rival', 'الخصم'),
  toMove: L('{side} to move', 'Mueven {side}', 'دور {side}'),
  mustHead: L('Capture is compulsory', 'La captura es obligatoria', 'الأسر إلزامي'),
  pickYou: L('Your move: pick a piece', 'Tu turno: elige una pieza', 'دورك: اختر قطعة'), targetYou: L('Now pick the point to go to', 'Ahora elige el punto de destino', 'والآن اختر النقطة التي تذهب إليها'),
  pickSide: L('{side}: pick a piece', '{side}: elegid una pieza', '{side}: اختاروا قطعة'), targetSide: L('{side}: pick the point to go to', '{side}: elegid el punto de destino', '{side}: اختاروا النقطة'),
  pickMust: L('You must capture: pick a glowing piece', 'Debes capturar: elige una pieza que brilla', 'يجب أن تأسر: اختر قطعة مضيئة'),
  targetMust: L('Tap the glowing point to jump there', 'Toca el punto brillante para saltar allí', 'المس النقطة المضيئة لتقفز إليها'),
  chainHead: L('Keep jumping with the same piece', 'Sigue saltando con la misma pieza', 'تابع القفز بالقطعة نفسها'), chainBody: L('A piece that has captured must go on while it can.', 'Una pieza que ha capturado debe seguir mientras pueda.', 'القطعة التي أسرت يجب أن تتابع ما دام ذلك ممكنًا.'),
  chainSide: L('{side}: keep jumping', '{side}: seguid saltando', '{side}: تابعوا القفز'),
  // toasts
  tMust: L('You must capture when you can.', 'Debes capturar cuando puedas.', 'يجب أن تأسر متى استطعت.'),
  tStuck: L('That piece has no free point to go to.', 'Esa pieza no tiene un punto libre al que ir.', 'ليس لهذه القطعة نقطة حرة تذهب إليها.'),
  tFoe: L('Move one of your own pieces.', 'Mueve una de tus piezas.', 'حرّك إحدى قطعك أنت.'),
  tFar: L('A step goes one point along a line.', 'Un paso va a un punto vecino por una línea.', 'الخطوة تكون إلى نقطة مجاورة على خط.'),
  tBack: L('Steps go forward or sideways, never backward. Only jumps may go back.', 'Los pasos van hacia delante o de lado, nunca hacia atrás. Solo los saltos pueden ir atrás.', 'الخطوات إلى الأمام أو الجانب فقط، ولا تعود إلى الخلف. القفزات وحدها قد تعود.'),
  tPick: L('Tap one of your own pieces first.', 'Toca primero una de tus piezas.', 'المس إحدى قطعك أولًا.'),
  tChain: L('Keep jumping with this piece.', 'Sigue saltando con esta pieza.', 'تابع القفز بهذه القطعة.'), tUndo: L('Nothing to undo', 'Nada que deshacer', 'لا شيء للتراجع عنه'),
  // end of game
  aDraw: L('A draw', 'Empate', 'تعادل'), youWin: L('You win!', '¡Ganas!', 'فزت!'), levelWins: L('{name} wins', 'Gana {name}', 'فاز {name}'), sideWin: L('{side} win!', '¡Ganan {side}!', 'فازت {side}!'),
  capYou: L('You captured every piece of the other side.', 'Capturaste todas las piezas del otro bando.', 'أسرتَ كل قطع الجانب الآخر.'),
  capOne: L('{name} captured every one of your pieces.', '{name} capturó todas tus piezas.', 'أسر {name} كل قطعك.'),
  capSide: L('{side} captured every piece of the other side.', '{side} capturaron todas las piezas del otro bando.', 'أسرت {side} كل قطع الجانب الآخر.'),
  blkYou: L('The other side had no legal move.', 'El otro bando no tenía ninguna jugada legal.', 'لم يكن لدى الجانب الآخر أي حركة قانونية.'),
  blkOne: L('You had no legal move.', 'No tenías ninguna jugada legal.', 'لم يكن لديك أي حركة قانونية.'),
  blkSide: L('{side} had no legal move.', '{side} no tenían ninguna jugada legal.', 'لم يكن لدى {side} أي حركة قانونية.'),
  limitLead: L('{n} moves passed with no capture', 'Pasaron {n} jugadas sin captura', 'مرّت {n} حركة دون أسر'),
  endEqual: L('{lead}, and both sides have {n}.', '{lead}, y ambos bandos tienen {n}.', '{lead}، ولدى كل جانب {n}.'),
  endMoreYou: L('{lead}, and you have more pieces ({a} to {b}).', '{lead}, y tienes más piezas ({a} contra {b}).', '{lead}، ولديك قطع أكثر ({a} مقابل {b}).'),
  endMoreOne: L('{lead}, and {name} has more pieces ({a} to {b}).', '{lead}, y {name} tiene más piezas ({a} contra {b}).', '{lead}، ولدى {name} قطع أكثر ({a} مقابل {b}).'),
  endMoreSide: L('{lead}, and {side} have more pieces ({a} to {b}).', '{lead}, y {side} tienen más piezas ({a} contra {b}).', '{lead}، ولدى {side} قطع أكثر ({a} مقابل {b}).'),
  notQuite: L('Not quite', 'Casi', 'ليس تمامًا'), correct: L('Correct!', '¡Correcto!', 'صحيح!'),
  // Watch & Learn
  autoHead: L('{side} to move', 'Mueven {side}', 'دور {side}'),
  // illustrations
  cStep: L('a step: forward or sideways along a line', 'un paso: hacia delante o de lado por una línea', 'خطوة: إلى الأمام أو الجانب على خط'),
  cDiag: L('diagonals only through the alternate points', 'las diagonales solo pasan por los puntos alternos', 'الأقطار تمر عبر النقاط المتبادلة فقط'),
  cJump: L('jump over an enemy into the empty point beyond', 'salta sobre un rival al punto vacío de detrás', 'اقفز فوق خصم إلى النقطة الفارغة خلفه'),
  cJumpAfter: L('the jumped piece is removed', 'la pieza saltada se retira', 'تُزال القطعة المقفوز فوقها'),
  cChain: L('a second jump with the same piece: both captured', 'un segundo salto con la misma pieza: las dos capturadas', 'قفزة ثانية بالقطعة نفسها: تُؤسر القطعتان'),
  cBack: L('a jump may go backward; a step may not', 'un salto puede ir atrás; un paso no', 'القفزة قد تعود إلى الخلف، والخطوة لا'),
  cMust: L('a capture is available, so a step is not allowed', 'hay una captura, así que un paso no está permitido', 'يوجد أسر متاح، فلا تجوز الخطوة'),
  cStart: L('the start: the centre point is empty', 'el inicio: el punto central está vacío', 'البداية: النقطة الوسطى فارغة'),
  cFirst: L('Light begins by moving into the centre', 'Las Claras empiezan moviendo al centro', 'تبدأ الفاتحة بالتحرك إلى المركز'),
  cOneLeft: L('no pieces left: the game is over', 'sin piezas: la partida termina', 'لم تبقَ قطع: انتهت اللعبة'),
  cBlocked: L('no legal move: that side loses', 'sin jugadas legales: ese bando pierde', 'لا حركة قانونية: يخسر ذلك الجانب'),
  cThinkEx: L('Wins a piece and lands safely.', 'Gana una pieza y cae a salvo.', 'يكسب قطعة ويهبط بأمان.'), cThinkReveal: L('THINK  ·  REVEAL  ·  ACT', 'PENSAR  ·  MOSTRAR  ·  JUGAR', 'تفكير  ·  كشف  ·  تنفيذ'),
  cRed: L('red cross: would be captured', 'cruz roja: sería capturada', 'علامة × حمراء: ستُؤسر'),
  // Think and its reasons
  hStep: L('Step the glowing piece', 'Mueve la pieza brillante un paso', 'حرّك القطعة المضيئة خطوة'), hJump: L('Jump with the glowing piece', 'Salta con la pieza brillante', 'اقفز بالقطعة المضيئة'),
  hOnly: L('Your only move', 'Tu única jugada', 'حركتك الوحيدة'),
  wWin: L('This wins: it takes the last enemy piece.', 'Esto gana: captura la última pieza rival.', 'هذه الحركة تفوز: تأسر آخر قطعة للخصم.'),
  wBlock: L('This wins: the other side is left with no legal move.', 'Esto gana: al otro bando no le queda ninguna jugada legal.', 'هذه الحركة تفوز: لا تبقى للجانب الآخر أي حركة قانونية.'),
  wOnly: L('It is the only legal move: a capture is compulsory.', 'Es la única jugada legal: la captura es obligatoria.', 'إنها الحركة القانونية الوحيدة: الأسر إلزامي.'),
  wJump: L('Wins a piece.', 'Gana una pieza.', 'تكسب قطعة.'),
  wMust: L('Capturing is compulsory, and the search found this the best of the captures.', 'Capturar es obligatorio, y la búsqueda encontró que esta es la mejor de las capturas.', 'الأسر إلزامي، ووجد البحث أن هذا أفضل الأسرات.'),
  wGoOn: L('The same piece must keep jumping next.', 'La misma pieza tendrá que seguir saltando.', 'ثم يجب أن تتابع القطعة نفسها القفز.'),
  wLandSafe: L('The piece lands where it cannot be captured.', 'La pieza cae donde no puede ser capturada.', 'تهبط القطعة حيث لا يمكن أسرها.'),
  wLandHit: L('The piece can be captured back there, but no other move scored better.', 'Allí la pieza puede ser recapturada, pero ninguna otra jugada puntuó mejor.', 'يمكن أسر القطعة هناك، لكن لا حركة أخرى حصلت على نتيجة أفضل.'),
  wNoReply: L('And none of {mine} can be captured in reply.', 'Y ninguna de {mine} puede ser capturada en respuesta.', 'ولا يمكن أسر أي من {mine} في الرد.'),
  wReply: L('{n} of {mine} can still be captured in reply, but nothing scored better.', 'Aún pueden capturar {n} de {mine} en respuesta, pero nada puntuó mejor.', 'ما زال يمكن أسر {n} من {mine} في الرد، لكن لا خيار آخر حصل على نتيجة أفضل.'),
  wEscape: L('This piece was about to be captured. Moving it takes it out of danger.', 'Esta pieza estaba a punto de ser capturada. Moverla la saca del peligro.', 'كانت هذه القطعة على وشك أن تُؤسر. تحريكها يُخرجها من الخطر.'),
  mineY: L('your pieces', 'tus piezas', 'قطعك'), mineN: L("{side}'s pieces", 'las piezas de {side}', 'قطع {side}'),
  wFewer: L('It leaves fewer of {mine} open to capture than before.', 'Deja menos de {mine} expuestas a captura que antes.', 'يقلّل عدد {mine} المعرّضة للأسر عمّا كان.'),
  wSetup: L('It threatens a capture of up to {n} and leaves none of {mine} open.', 'Amenaza una captura de hasta {n} y no deja ninguna de {mine} expuesta.', 'يهدّد بأسر حتى {n} ولا يترك أيًّا من {mine} مكشوفًا.'),
  wSafe: L('A safe move: none of {mine} can be captured afterwards.', 'Una jugada segura: después ninguna de {mine} puede ser capturada.', 'حركة آمنة: لا يمكن أسر أي من {mine} بعدها.'),
  wDepth: L('The search found this the strongest move.', 'La búsqueda encontró que esta es la mejor jugada.', 'وجد البحث أن هذه أقوى حركة.'),
  // lesson feedback
  jStep: L('Not quite. That was a jump. Here, just step one point.', 'Casi. Eso fue un salto. Aquí, solo da un paso a un punto vecino.', 'ليس تمامًا. كانت تلك قفزة. هنا، تحرّك خطوة واحدة فقط.'),
  jDiag: L('Not quite. Step along a diagonal line: only the alternate points have them. Try the piece in the middle.', 'Casi. Avanza por una línea diagonal: solo los puntos alternos las tienen. Prueba con la pieza del medio.', 'ليس تمامًا. تحرّك على خط قطري: النقاط المتبادلة وحدها لها أقطار. جرّب القطعة الوسطى.'),
  jJump: L('Not quite. Select your piece and tap the empty point behind the enemy piece to jump it.', 'Casi. Selecciona tu pieza y toca el punto vacío detrás de la pieza rival para saltarla.', 'ليس تمامًا. اختر قطعتك والمس النقطة الفارغة خلف قطعة الخصم لتقفز فوقها.'),
  jSafe: L('Not quite. After that move a piece of yours can still be captured. Find a step that leaves nothing to capture.', 'Casi. Después de esa jugada aún pueden capturarte una pieza. Busca un paso que no deje nada que capturar.', 'ليس تمامًا. بعد هذه الحركة ما زال يمكن أسر إحدى قطعك. ابحث عن خطوة لا تترك شيئًا يُؤسر.'),
  jSafeCap: L('Not quite. That capture can be answered: a piece of yours can be captured back. Try the other capture.', 'Casi. Esa captura tiene respuesta: pueden recapturarte una pieza. Prueba la otra captura.', 'ليس تمامًا. هذا الأسر له رد: يمكن أسر إحدى قطعك. جرّب الأسر الآخر.'),
  jGood: L('Not quite. Another capture takes more pieces this turn.', 'Casi. Otra captura se lleva más piezas este turno.', 'ليس تمامًا. أسر آخر يأخذ قطعًا أكثر في هذا الدور.'),
  // opponent levels
  lvNovice: L('Novice', 'Novato', 'مبتدئ'), lvCasual: L('Casual', 'Aficionado', 'هاوٍ'), lvSkilled: L('Skilled', 'Hábil', 'ماهر'), lvExpert: L('Expert', 'Experto', 'خبير'), lvMaster: L('Master', 'Maestro', 'أستاذ'),
  bNovice: L('Learning the game. Picks any legal move, so it only captures because capturing is compulsory.', 'Aprende el juego. Elige cualquier jugada legal, así que solo captura porque capturar es obligatorio.', 'يتعلّم اللعبة. يختار أي حركة قانونية، فلا يأسر إلا لأن الأسر إلزامي.'),
  bCasual: L('Looks two moves ahead. Sees simple traps but often slips.', 'Mira dos jugadas adelante. Ve trampas sencillas pero a menudo se equivoca.', 'ينظر حركتين إلى الأمام. يرى الفخاخ البسيطة لكنه يخطئ كثيرًا.'),
  bSkilled: L('Looks about four moves ahead and rarely leaves a piece hanging.', 'Mira unas cuatro jugadas adelante y rara vez deja una pieza en el aire.', 'ينظر نحو أربع حركات إلى الأمام ونادرًا ما يترك قطعة مكشوفة.'),
  bExpert: L('Looks about six moves ahead and follows whole chains of captures.', 'Mira unas seis jugadas adelante y sigue cadenas enteras de capturas.', 'ينظر نحو ست حركات إلى الأمام ويتتبّع سلاسل الأسر كاملة.'),
  bMaster: L('The strongest: searches furthest and plays the quiet moves best.', 'El más fuerte: busca más lejos y juega mejor las jugadas tranquilas.', 'الأقوى: يبحث أبعد ويُحسن الحركات الهادئة.'),
  // boards
  thCedar: L('Cedar and Brass', 'Cedro y latón', 'أرز ونحاس'), thTile: L('Alhambra Blue', 'Azul alhambreño', 'أزرق الحمراء'), thEbony: L('Ebony and Ivory', 'Ébano y marfil', 'أبنوس وعاج'),
  thCedarShort: L('Cedar', 'Cedro', 'أرز'), thTileShort: L('Blue tile', 'Azulejo', 'قاشاني'), thEbonyShort: L('Ebony', 'Ébano', 'أبنوس'),
  langBtn: L('Play in English', 'Jugar en español', 'العب بالعربية'),
};

export const tr = (key, vars) => {
  const e = STR[key];
  let s = e ? e[langIndex()] : key;
  if (vars) for (const k of Object.keys(vars)) s = s.split(`{${k}}`).join(String(vars[k]));
  return s;
};

// "12 pieces" / "1 piece", Spanish, and the Arabic counted forms (piecesObj is the accusative: "captures 2 pieces")
export function piecesText(n) {
  const i = langIndex();
  if (i === 0) return `${n} ${n === 1 ? 'piece' : 'pieces'}`;
  if (i === 1) return `${n} ${n === 1 ? 'pieza' : 'piezas'}`;
  if (n === 1) return 'قطعة واحدة';
  if (n === 2) return 'قطعتان';
  return n <= 10 ? `${n} قطع` : `${n} قطعة`;
}
export function piecesObj(n) {
  if (langIndex() !== 2) return piecesText(n);
  if (n === 1) return 'قطعة واحدة';
  if (n === 2) return 'قطعتين';
  return n <= 10 ? `${n} قطع` : `${n} قطعة`;
}
const cap1 = (id) => `${id[0].toUpperCase()}${id.slice(1)}`;
export const lvName = (id) => tr(`lv${cap1(id)}`);
export const lvBlurb = (id) => tr(`b${cap1(id)}`);
export const themeName = (id) => tr(`th${cap1(id)}`);
export const themeShort = (id) => tr(`th${cap1(id)}Short`);
export const sideLabel = (who) => tr(who === 1 ? 'light' : 'dark');
export const sideThe = (who) => tr(who === 1 ? 'lightThe' : 'darkThe');
export function pointWords(i) {
  const [r, c] = [Math.floor(i / 5), i % 5];
  const col = 'ABCDE'[c], row = 5 - r;
  return `${col}${row}`;
}

// ------------------------------------------------------------------------------------------------ How to Play
const HOWTO_DEF = [
  { art: 'start',
    en: { title: 'The goal', body: `Each player has ${PIECES} round pieces on a board of 25 points joined by lines. Light plays from the bottom and moves first; Dark plays from the top. Capture every enemy piece, or leave the other side with no legal move, and you win.` },
    es: { title: 'El objetivo', body: `Cada jugador tiene ${PIECES} piezas redondas sobre un tablero de 25 puntos unidos por líneas. Las Claras juegan desde abajo y mueven primero; las Oscuras, desde arriba. Si capturas todas las piezas rivales, o dejas al otro bando sin jugadas legales, ganas.` },
    ar: { title: 'الهدف', body: `لكل لاعب ${PIECES} قطعة مستديرة على رقعة من 25 نقطة تصل بينها خطوط. تلعب الفاتحة من الأسفل وتتحرك أولًا، وتلعب الداكنة من الأعلى. إذا أسرتَ كل قطع الخصم، أو تركتَه بلا حركة قانونية، فزت.` } },
  { art: 'step',
    en: { title: 'Stepping', body: 'Tap one of your pieces, then tap an empty point next to it along a line. Steps go forward or sideways, never backward. The straight lines run through every point; the diagonal lines run only through every other point.' },
    es: { title: 'Dar un paso', body: 'Toca una de tus piezas y luego un punto vacío a su lado, siguiendo una línea. Los pasos van hacia delante o de lado, nunca hacia atrás. Las líneas rectas pasan por todos los puntos; las diagonales solo pasan por uno de cada dos.' },
    ar: { title: 'الخطوة', body: 'المس إحدى قطعك ثم المس نقطة فارغة بجانبها على امتداد خط. تكون الخطوات إلى الأمام أو إلى الجانب، ولا تعود إلى الخلف أبدًا. الخطوط المستقيمة تمر بكل النقاط، أما الأقطار فتمر بنقطة من كل نقطتين فقط.' } },
  { art: 'jump',
    en: { title: 'Jumping to capture', body: 'If an enemy piece is next to yours on a line and the point just beyond it is empty, you can jump over it and remove it. A jump may go in any direction along a line, even backward. Select the piece to see its jumps glow.' },
    es: { title: 'Saltar para capturar', body: 'Si una pieza rival está junto a la tuya sobre una línea y el punto de detrás está vacío, puedes saltar sobre ella y retirarla. Un salto puede ir en cualquier dirección a lo largo de una línea, incluso hacia atrás. Selecciona la pieza y verás brillar sus saltos.' },
    ar: { title: 'القفز للأسر', body: 'إذا كانت قطعة للخصم بجانب قطعتك على خط، والنقطة التي خلفها مباشرة فارغة، فيمكنك القفز فوقها وإزالتها. يجوز أن تكون القفزة في أي اتجاه على خط، حتى إلى الخلف. اختر القطعة لترى قفزاتها تتوهج.' } },
  { art: 'must',
    en: { title: 'Capturing is compulsory', body: 'If you can capture, you must: steps are not allowed that turn. You may choose which capture to make. After a jump, the same piece must keep jumping while it can; you choose the direction each time.' },
    es: { title: 'Capturar es obligatorio', body: 'Si puedes capturar, debes hacerlo: ese turno no se permiten pasos. Puedes elegir qué captura hacer. Tras un salto, la misma pieza debe seguir saltando mientras pueda; tú eliges la dirección cada vez.' },
    ar: { title: 'الأسر إلزامي', body: 'إذا استطعت الأسر وجب عليك ذلك: فلا تجوز الخطوات في ذلك الدور. ولك أن تختار أي أسر تفعل. وبعد القفزة يجب أن تتابع القطعة نفسها القفز ما دام ذلك ممكنًا، وتختار الاتجاه في كل مرة.' } },
  { art: 'chain',
    en: { title: 'Multiple jumps', body: 'One turn can take several pieces: jump, then jump again from where you landed. Plan the route: a long chain can win the game, and a careless capture can leave your piece to be taken back.' },
    es: { title: 'Saltos múltiples', body: 'Un turno puede llevarse varias piezas: saltas y vuelves a saltar desde donde caíste. Planifica el recorrido: una cadena larga puede ganar la partida, y una captura descuidada puede dejar tu pieza expuesta.' },
    ar: { title: 'القفزات المتتالية', body: 'يمكن أن يأخذ دور واحد عدة قطع: اقفز ثم اقفز مرة أخرى من حيث هبطت. خطّط للمسار: سلسلة طويلة قد تحسم اللعبة، وأسر متهور قد يترك قطعتك لتُؤسر.' } },
  { art: 'think',
    en: { title: 'Think and Learn', body: 'Think shows a good move and explains why in plain words. Learn is a short course of real positions, and Watch & Learn plays a whole game for you with a Pause button.' },
    es: { title: 'Pensar y aprender', body: 'Pensar muestra una buena jugada y explica el porqué con palabras sencillas. Aprender es un curso corto con posiciones reales, y Mirar y aprender juega una partida entera por ti, con un botón de pausa.' },
    ar: { title: 'فكّر وتعلّم', body: 'يُظهر «فكّر» حركة جيدة ويشرح السبب بكلمات بسيطة. و«تعلّم» دورة قصيرة من مواضع حقيقية، و«شاهد وتعلّم» يلعب لعبة كاملة نيابةً عنك مع زر إيقاف مؤقت.' } },
];

// ------------------------------------------------------------------------------------------------ Rules
const RULES_DEF = [
  { art: 'start',
    en: { title: 'The game', body: [
      `Alquerque is a game for two players, Light and Dark, on a board of 25 points joined by lines. Each side has ${PIECES} pieces. Light starts at the bottom of the screen and moves first.`,
      'The aim is to capture every enemy piece, or to leave the other side with no legal move. Pieces step one point at a time, and capture by jumping.',
    ] },
    es: { title: 'El juego', body: [
      `El alquerque es un juego para dos jugadores, las Claras y las Oscuras, sobre un tablero de 25 puntos unidos por líneas. Cada bando tiene ${PIECES} piezas. Las Claras empiezan abajo en la pantalla y mueven primero.`,
      'El objetivo es capturar todas las piezas rivales o dejar al otro bando sin ninguna jugada legal. Las piezas avanzan de un punto en un punto y capturan saltando.',
    ] },
    ar: { title: 'اللعبة', body: [
      `القِرقات لعبة لاعبين اثنين، الفاتحة والداكنة، على رقعة من 25 نقطة تصل بينها خطوط. لكل جانب ${PIECES} قطعة. تبدأ الفاتحة من أسفل الشاشة وتتحرك أولًا.`,
      'الهدف أسر كل قطع الخصم أو تركه بلا أي حركة قانونية. تتقدم القطع نقطة نقطة، وتأسر بالقفز.',
    ] } },
  { art: 'board',
    en: { title: 'The board and its lines', body: [
      'The board is a grid of 5 x 5 points. Every row and every column is a line, so a piece on any point can go along the straight lines. The 13 points where the row number plus the column number is even (the corners, the centre and every other point) also lie on diagonal lines.',
      'The other 12 points have only the four straight directions. This is why some points are stronger than others: a piece on a point with eight lines can step, and jump, in more ways.',
    ] },
    es: { title: 'El tablero y sus líneas', body: [
      'El tablero es una cuadrícula de 5 x 5 puntos. Cada fila y cada columna es una línea, así que una pieza en cualquier punto puede ir por las líneas rectas. Los 13 puntos en que la suma del número de fila y de columna es par (las esquinas, el centro y uno de cada dos puntos) están además sobre líneas diagonales.',
      'Los otros 12 puntos solo tienen las cuatro direcciones rectas. Por eso unos puntos son más fuertes que otros: una pieza en un punto con ocho líneas puede dar pasos, y saltos, de más maneras.',
    ] },
    ar: { title: 'الرقعة وخطوطها', body: [
      'الرقعة شبكة من 5 × 5 نقاط. كل صف وكل عمود خط، فتستطيع القطعة على أي نقطة السير على الخطوط المستقيمة. والنقاط الثلاث عشرة التي يكون فيها مجموع رقم الصف ورقم العمود زوجيًا (الزوايا والمركز ونقطة من كل نقطتين) تقع أيضًا على خطوط قطرية.',
      'أما النقاط الاثنتا عشرة الأخرى فليس لها سوى الاتجاهات المستقيمة الأربعة. ولهذا تكون بعض النقاط أقوى من غيرها: فالقطعة على نقطة ذات ثمانية خطوط تستطيع الخطو والقفز بطرق أكثر.',
    ] } },
  { art: 'start',
    en: { title: 'Setup and first move', body: [
      `Each side puts its ${PIECES} pieces on its two nearest rows (10 pieces) and on two points of the middle row (the two on its right-hand side as it looks at the board). The centre point starts empty.`,
      'Light moves first, then the players alternate; a player must move and cannot pass. Because only the centre is empty, the first move is always a piece stepping into the centre. If you play Dark, the board turns so that your pieces are at the bottom.',
    ] },
    es: { title: 'Colocación y primera jugada', body: [
      `Cada bando coloca sus ${PIECES} piezas en sus dos filas más cercanas (10 piezas) y en dos puntos de la fila del medio (los dos de su derecha, mirando el tablero). El punto central empieza vacío.`,
      'Las Claras mueven primero y luego se alternan; un jugador debe mover y no puede pasar. Como solo el centro está vacío, la primera jugada es siempre una pieza que avanza al centro. Si juegas con las Oscuras, el tablero gira para que tus piezas queden abajo.',
    ] },
    ar: { title: 'الإعداد والحركة الأولى', body: [
      `يضع كل جانب قطعه الـ${PIECES} على صفيه الأقرب (10 قطع) وعلى نقطتين من الصف الأوسط (النقطتين على يمينه وهو ينظر إلى الرقعة). وتبدأ النقطة الوسطى فارغة.`,
      'تتحرك الفاتحة أولًا ثم يتناوب اللاعبان؛ ويجب أن يتحرك اللاعب ولا يجوز له التخطي. ولأن المركز وحده فارغ، فالحركة الأولى دائمًا قطعة تتقدم إلى المركز. وإذا لعبت بالداكنة تدور الرقعة لتكون قطعك في الأسفل.',
    ] } },
  { art: 'step',
    en: { title: 'Stepping: forward or sideways', body: [
      'A step moves one piece one point along a line to an empty point. It must go forward (toward the other side) or sideways along a row. Backward steps are not allowed. A step never captures.',
      'A piece with no empty point in front of it or beside it cannot step. It may still jump, if a jump is available.',
    ] },
    es: { title: 'Pasos: hacia delante o de lado', body: [
      'Un paso mueve una pieza a un punto vacío vecino siguiendo una línea. Debe ir hacia delante (hacia el otro bando) o de lado por una fila. No se permiten pasos hacia atrás. Un paso nunca captura.',
      'Una pieza sin ningún punto vacío delante ni al lado no puede dar un paso. Aun así puede saltar, si hay un salto disponible.',
    ] },
    ar: { title: 'الخطوات: إلى الأمام أو الجانب', body: [
      'الخطوة تنقل قطعة واحدة نقطة واحدة على خط إلى نقطة فارغة. ويجب أن تكون إلى الأمام (نحو الجانب الآخر) أو إلى الجانب على امتداد الصف. لا تجوز الخطوات إلى الخلف. والخطوة لا تأسر أبدًا.',
      'القطعة التي لا نقطة فارغة أمامها ولا بجانبها لا تستطيع الخطو. ومع ذلك قد تقفز إن كانت هناك قفزة متاحة.',
    ] } },
  { art: 'jump',
    en: { title: 'Jumping to capture', body: [
      'A piece captures by jumping over an enemy piece that is next to it on a line and landing on the empty point directly beyond, on the same line. The jumped piece is removed at once.',
      'A jump may go in any direction along a line: forward, sideways, backward or diagonally (only along lines that exist). The landing point must be empty. A piece cannot jump over its own side or over two pieces at once.',
    ] },
    es: { title: 'Saltar para capturar', body: [
      'Una pieza captura saltando sobre una pieza rival que esté junto a ella en una línea y cayendo en el punto vacío justo detrás, en la misma línea. La pieza saltada se retira al instante.',
      'Un salto puede ir en cualquier dirección a lo largo de una línea: hacia delante, de lado, hacia atrás o en diagonal (solo por líneas que existen). El punto de caída debe estar vacío. Una pieza no puede saltar sobre las de su bando ni sobre dos piezas a la vez.',
    ] },
    ar: { title: 'القفز للأسر', body: [
      'تأسر القطعة بالقفز فوق قطعة معادية بجانبها على خط، والهبوط على النقطة الفارغة التي خلفها مباشرة على الخط نفسه. وتُزال القطعة المقفوز فوقها فورًا.',
      'يجوز أن تكون القفزة في أي اتجاه على خط: إلى الأمام أو الجانب أو الخلف أو قطريًا (على الخطوط الموجودة فقط). ويجب أن تكون نقطة الهبوط فارغة. ولا تقفز القطعة فوق قطع جانبها ولا فوق قطعتين معًا.',
    ] } },
  { art: 'must',
    en: { title: 'Capturing is compulsory', body: [
      'If any of your pieces can capture, you must capture on that turn: a step is not allowed. If several captures are available you may choose any of them; you are not required to take the one that wins the most.',
      'Tapping a piece that cannot capture, when a capture exists, shows a short reminder. The pieces that can capture glow when you must capture.',
    ] },
    es: { title: 'Capturar es obligatorio', body: [
      'Si alguna de tus piezas puede capturar, debes capturar en ese turno: no se permite un paso. Si hay varias capturas disponibles puedes elegir cualquiera; no estás obligado a tomar la que gane más.',
      'Al tocar una pieza que no puede capturar, habiendo una captura, aparece un recordatorio breve. Las piezas que pueden capturar brillan cuando debes capturar.',
    ] },
    ar: { title: 'الأسر إلزامي', body: [
      'إذا استطاعت أي من قطعك الأسر وجب عليك الأسر في ذلك الدور: فلا تجوز الخطوة. وإذا توفرت عدة أسرات فلك أن تختار أيًّا منها؛ ولست مجبرًا على اختيار الأسر الذي يكسب أكثر.',
      'عند لمس قطعة لا تستطيع الأسر بينما يوجد أسر، يظهر تذكير قصير. وتتوهج القطع التي تستطيع الأسر حين يكون الأسر واجبًا.',
    ] } },
  { art: 'chain',
    en: { title: 'Multiple jumps', body: [
      'After a jump, if the same piece can jump again from where it landed, it must. It may choose which jump to make if there is more than one, and it may even jump back over the point it started from, because that point is now empty. The turn ends when the piece cannot jump any more.',
      'Pieces are removed as they are jumped, so a piece can never be jumped twice in one turn. You may not stop a chain early, and you may not change to another piece.',
    ] },
    es: { title: 'Saltos múltiples', body: [
      'Tras un salto, si la misma pieza puede volver a saltar desde donde cayó, debe hacerlo. Puede elegir qué salto hacer si hay más de uno, e incluso volver a saltar sobre el punto de partida, porque ahora está vacío. El turno acaba cuando la pieza ya no puede saltar.',
      'Las piezas se retiran según se saltan, así que una pieza nunca puede ser saltada dos veces en un turno. No puedes detener una cadena antes de tiempo ni cambiar a otra pieza.',
    ] },
    ar: { title: 'القفزات المتتالية', body: [
      'بعد القفزة، إذا استطاعت القطعة نفسها القفز مرة أخرى من حيث هبطت وجب عليها ذلك. ولها أن تختار القفزة إن كانت هناك أكثر من واحدة، وقد تقفز حتى فوق النقطة التي بدأت منها لأنها صارت فارغة. ينتهي الدور حين لا تستطيع القطعة القفز بعد ذلك.',
      'تُزال القطع فور القفز فوقها، فلا يمكن القفز فوق القطعة مرتين في دور واحد. ولا يجوز إيقاف السلسلة مبكرًا ولا الانتقال إلى قطعة أخرى.',
    ] } },
  { art: 'back',
    en: { title: 'Jumps go any way, steps do not', body: [
      'This is the key difference between the two kinds of move. A step can only go forward or sideways, so pieces cannot retreat and the game always makes progress. A jump can go in any direction, so a piece that has run ahead can capture backward and a back piece can strike forward.',
      'That is why a piece that advances alone is in danger: it can be jumped from behind or from the side as well as from the front.',
    ] },
    es: { title: 'Los saltos van a cualquier lado, los pasos no', body: [
      'Esta es la diferencia clave entre los dos tipos de jugada. Un paso solo puede ir hacia delante o de lado, así que las piezas no pueden retroceder y la partida siempre avanza. Un salto puede ir en cualquier dirección, así que una pieza adelantada puede capturar hacia atrás y una pieza de la retaguardia puede golpear hacia delante.',
      'Por eso una pieza que avanza sola corre peligro: puede ser saltada por detrás o de lado, además de por delante.',
    ] },
    ar: { title: 'القفزات في أي اتجاه والخطوات لا', body: [
      'هذا هو الفرق الجوهري بين نوعي الحركة. الخطوة لا تكون إلا إلى الأمام أو الجانب، فلا تستطيع القطع التراجع وتتقدم اللعبة دائمًا. أما القفزة فتكون في أي اتجاه، فتستطيع القطعة المتقدمة الأسر إلى الخلف، وتستطيع القطعة الخلفية الضرب إلى الأمام.',
      'لذلك تتعرض القطعة التي تتقدم وحدها للخطر: إذ يمكن القفز فوقها من الخلف أو من الجانب كما من الأمام.',
    ] } },
  { art: 'blocked',
    en: { title: 'Winning', body: [
      'You win when the other side has no pieces left. You also win if, on the other side\'s turn, it has pieces but no legal move: every piece is blocked and none can jump.',
      'A win is shown with a burst on the board and the result card, which offers Play Again, Change Game and the menu.',
    ] },
    es: { title: 'Ganar', body: [
      'Ganas cuando al otro bando no le quedan piezas. También ganas si, en el turno del otro bando, este tiene piezas pero ninguna jugada legal: todas están bloqueadas y ninguna puede saltar.',
      'La victoria se muestra con una explosión en el tablero y la tarjeta de resultado, que ofrece Jugar otra vez, Cambiar partida y el menú.',
    ] },
    ar: { title: 'الفوز', body: [
      'تفوز حين لا تبقى للجانب الآخر قطع. وتفوز أيضًا إذا كانت لدى الجانب الآخر في دوره قطع لكن لا حركة قانونية: كل قطعه محجوبة ولا تستطيع أي منها القفز.',
      'يظهر الفوز بانفجار من الشرارات على الرقعة وببطاقة النتيجة التي تعرض «العب مرة أخرى» و«تغيير اللعبة» والقائمة.',
    ] } },
  { art: 'limit',
    en: { title: 'Drawn-out games', body: [
      `Because steps cannot go backward but can go sideways, two careful players can shuffle sideways for a long time. This game settles such a game by count: if ${QUIET_LIMIT} moves in a row (${QUIET_LIMIT / 2} by each side) pass without a capture, the game stops and the side with more pieces wins; equal numbers is a draw.`,
      'Every capture resets the count, shown as "no capture" above the board. This count is this game\'s own rule: traditional play ended a stuck game by agreement, and a fixed count is the fair way to do that against a computer.',
    ] },
    es: { title: 'Partidas largas', body: [
      `Como los pasos no pueden ir hacia atrás pero sí de lado, dos jugadores prudentes pueden moverse de lado durante mucho tiempo. Este juego resuelve esa partida por recuento: si pasan ${QUIET_LIMIT} jugadas seguidas (${QUIET_LIMIT / 2} de cada bando) sin captura, la partida se detiene y gana el bando con más piezas; con igual número es empate.`,
      'Cada captura reinicia la cuenta, que se muestra como «sin captura» sobre el tablero. Este recuento es una regla propia del juego: tradicionalmente una partida atascada se acababa de común acuerdo, y un número fijo es la forma justa de hacerlo contra un ordenador.',
    ] },
    ar: { title: 'الألعاب الطويلة', body: [
      `لأن الخطوات لا تعود إلى الخلف لكنها تجوز إلى الجانب، قد يتبادل لاعبان حذران الحركات الجانبية زمنًا طويلًا. وتحسم هذه اللعبة مثل هذه الحالة بالعدّ: إذا مرّت ${QUIET_LIMIT} حركة متتالية (${QUIET_LIMIT / 2} لكل جانب) دون أسر توقفت اللعبة وفاز الجانب الأكثر قطعًا؛ وعند التساوي تعادل.`,
      'كل أسر يعيد العدّ إلى الصفر، ويظهر العدّاد بعبارة «دون أسر» أعلى الرقعة. هذا العدّ قاعدة خاصة بهذه اللعبة: فقد كانت اللعبة العالقة تُنهى تقليديًا بالاتفاق، والعدّ الثابت هو الطريقة العادلة لذلك أمام الحاسوب.',
    ] } },
  { art: 'trad',
    en: { title: 'Where traditions differ', body: [
      'Alquerque has been played for centuries and written rules differ. This game follows a common modern form: forward and sideways steps, jumps in any direction, compulsory capture, and compulsory continuation of a chain.',
      'Other sources allow steps in every direction (which makes drawn games more likely), let a player stop a chain, or punish a missed capture by "huffing": removing the piece that failed to capture. This game uses compulsory capture instead of huffing, the simpler rule, and the choices above wherever sources disagree.',
    ] },
    es: { title: 'Dónde difieren las tradiciones', body: [
      'El alquerque se juega desde hace siglos y las reglas escritas varían. Este juego sigue una forma moderna habitual: pasos hacia delante y de lado, saltos en cualquier dirección, captura obligatoria y continuación obligatoria de la cadena.',
      'Otras fuentes permiten pasos en todas las direcciones (lo que hace más probables las tablas), dejan detener una cadena, o castigan la captura omitida con el «soplo»: se retira la pieza que no capturó. Este juego usa la captura obligatoria en lugar del soplo, la regla más sencilla, y las elecciones de arriba donde las fuentes no coinciden.',
    ] },
    ar: { title: 'حيث تختلف التقاليد', body: [
      'لُعبت القِرقات قرونًا وتختلف القواعد المكتوبة. تتبع هذه اللعبة صيغة حديثة شائعة: خطوات إلى الأمام والجانب، وقفزات في أي اتجاه، وأسر إلزامي، ومتابعة إلزامية للسلسلة.',
      'تسمح مصادر أخرى بالخطوات في كل الاتجاهات (فتزداد احتمالات التعادل)، أو تسمح بإيقاف السلسلة، أو تعاقب على الأسر الفائت بـ«النفخ»: إزالة القطعة التي لم تأسر. وتستخدم هذه اللعبة الأسر الإلزامي بدل النفخ، وهي القاعدة الأبسط، وتأخذ بالخيارات المذكورة أعلاه حيث تختلف المصادر.',
    ] } },
  { art: 'levels',
    en: { title: 'Opponent levels', body: [
      'Novice picks any legal move. Casual looks about two moves ahead and slips now and then. Skilled looks about four moves ahead. Expert looks about six moves ahead and follows whole chains of captures. Master searches deepest, within a fixed amount of effort.',
      'Each level beat the one below it in our own test games, so the ladder is real. The same position always gives the same answers to the same moves. No win is guaranteed at any level: the side that moves first has an edge.',
    ] },
    es: { title: 'Niveles del rival', body: [
      'El Novato elige cualquier jugada legal. El Aficionado mira unas dos jugadas adelante y falla de vez en cuando. El Hábil mira unas cuatro. El Experto mira unas seis y sigue cadenas enteras de capturas. El Maestro busca más a fondo, con una cantidad fija de esfuerzo.',
      'Cada nivel venció al de abajo en nuestras partidas de prueba, así que la escalera es real. La misma posición da siempre las mismas respuestas a las mismas jugadas. Ninguna victoria está garantizada en ningún nivel: el bando que mueve primero tiene ventaja.',
    ] },
    ar: { title: 'مستويات الخصم', body: [
      'المبتدئ يختار أي حركة قانونية. والهاوي ينظر نحو حركتين إلى الأمام ويخطئ بين حين وآخر. والماهر ينظر نحو أربع حركات. والخبير ينظر نحو ست حركات ويتتبّع سلاسل الأسر كاملة. والأستاذ يبحث أعمق ما يمكن ضمن جهد ثابت.',
      'تغلّب كل مستوى على الذي دونه في مباريات الاختبار التي أجريناها، فالسلّم حقيقي. والموضع نفسه يعطي دائمًا الإجابات نفسها على الحركات نفسها. ولا يُضمن الفوز في أي مستوى: فالجانب الذي يتحرك أولًا له أفضلية.',
    ] } },
  { art: 'think',
    en: { title: 'Think', body: [
      'Think searches the position and lights up the best move, with the glowing piece and the point to go to, and says why in plain words: that it wins a piece, that a capture is forced, that it moves a piece out of danger, or that it is simply the safest move. It never plays the move for you and is free to use.',
      'Every reason is checked against the real position before it is shown: for example "none of your pieces can be captured in reply" is only said when the engine confirms it.',
    ] },
    es: { title: 'Pensar', body: [
      'Pensar examina la posición e ilumina la mejor jugada, con la pieza brillante y el punto de destino, y explica el porqué con palabras sencillas: que gana una pieza, que la captura es forzosa, que saca una pieza del peligro o que es simplemente la jugada más segura. Nunca juega por ti y es gratis.',
      'Cada razón se comprueba con la posición real antes de mostrarse: por ejemplo, «ninguna de tus piezas puede ser capturada en respuesta» solo se dice cuando el motor lo confirma.',
    ] },
    ar: { title: 'فكّر', body: [
      'يفحص «فكّر» الموضع ويُضيء أفضل حركة، بالقطعة المتوهجة والنقطة التي تذهب إليها، ويشرح السبب بكلمات بسيطة: أنها تكسب قطعة، أو أن الأسر مفروض، أو أنها تُخرج قطعة من الخطر، أو أنها ببساطة الحركة الأكثر أمانًا. ولا يلعب عنك أبدًا وهو مجاني.',
      'يُتحقق من كل سبب مقابل الموضع الحقيقي قبل عرضه: فمثلًا لا تُقال عبارة «لا يمكن أسر أي من قطعك في الرد» إلا إذا أكّد المحرك ذلك.',
    ] } },
  { art: 'undo',
    en: { title: 'Undo, Restart and Continue', body: [
      'Undo takes back your last turn (and the opponent\'s reply). In two-player mode it takes back one turn. Restart begins again from the opening position. Undo is not available once the game has ended or inside a lesson.',
      'Pause stops everything where it is. Your game is saved after every move: leave and come back and Continue game on the menu takes you back to it, paused.',
    ] },
    es: { title: 'Deshacer, reiniciar y continuar', body: [
      'Deshacer retira tu último turno (y la respuesta del rival). En el modo de dos jugadores retira un turno. Reiniciar empieza otra vez desde la posición inicial. Deshacer no está disponible cuando la partida ha terminado ni dentro de una lección.',
      'La pausa detiene todo donde está. Tu partida se guarda tras cada jugada: sal y vuelve, y Continuar partida en el menú te lleva de nuevo a ella, en pausa.',
    ] },
    ar: { title: 'التراجع والإعادة والمتابعة', body: [
      'يعيد «تراجع» آخر دور لك (وردّ الخصم). وفي وضع اللاعبين يعيد دورًا واحدًا. أما «إعادة» فتبدأ من موضع البداية من جديد. ولا يتوفر «تراجع» بعد انتهاء اللعبة ولا داخل الدروس.',
      'يوقف الإيقاف المؤقت كل شيء مكانه. وتُحفظ لعبتك بعد كل حركة: اخرج ثم عد، فيأخذك «متابعة اللعبة» في القائمة إليها، متوقفة مؤقتًا.',
    ] } },
  { art: 'learn',
    en: { title: 'Learn', body: [
      'Learn is a course of short lessons, each a real position: stepping, the diagonals, jumping, compulsory capture, multiple jumps, jumping backward, keeping a piece safe and choosing the best capture. The last is a whole game against the Casual opponent.',
      'A wrong move in a lesson is not played: you are told why and can try again. Lessons do not use up the free preview.',
    ] },
    es: { title: 'Aprender', body: [
      'Aprender es un curso de lecciones cortas, cada una una posición real: dar pasos, las diagonales, saltar, la captura obligatoria, los saltos múltiples, saltar hacia atrás, poner una pieza a salvo y elegir la mejor captura. La última es una partida entera contra el rival Aficionado.',
      'Una jugada equivocada en una lección no se realiza: te explican el motivo y puedes intentarlo de nuevo. Las lecciones no gastan la vista previa gratuita.',
    ] },
    ar: { title: 'تعلّم', body: [
      '«تعلّم» دورة من دروس قصيرة، كل منها موضع حقيقي: الخطوات، والأقطار، والقفز، والأسر الإلزامي، والقفزات المتتالية، والقفز إلى الخلف، وحماية القطعة، واختيار أفضل أسر. والأخير لعبة كاملة ضد الخصم الهاوي.',
      'الحركة الخاطئة في الدرس لا تُلعب: يُقال لك السبب ويمكنك المحاولة مرة أخرى. ولا تستهلك الدروس المعاينة المجانية.',
    ] } },
  { art: 'auto',
    en: { title: 'Watch & Learn', body: [
      'Watch & Learn plays a whole game for you with the game\'s own opponent engine on both sides: Master plays Light and Expert plays Dark. Each move has three steps: THINK (2, 5, 8 or 10 seconds, you choose), REVEAL (two seconds: the options light up and the chosen move is marked, with the reason in words) and ACT (the move is played).',
      'Pause freezes everything where it is and Resume carries on from exactly there. Watch & Learn does not use up the free preview.',
    ] },
    es: { title: 'Mirar y aprender', body: [
      'Mirar y aprender juega una partida entera por ti con el propio motor de rival del juego en ambos bandos: el Maestro juega con las Claras y el Experto con las Oscuras. Cada jugada tiene tres pasos: PENSAR (2, 5, 8 o 10 segundos, tú eliges), MOSTRAR (dos segundos: se iluminan las opciones y se marca la jugada elegida, con el motivo en palabras) y JUGAR (se hace la jugada).',
      'La pausa congela todo donde está y Reanudar sigue exactamente desde ahí. Mirar y aprender no gasta la vista previa gratuita.',
    ] },
    ar: { title: 'شاهد وتعلّم', body: [
      'يلعب «شاهد وتعلّم» لعبة كاملة نيابةً عنك بمحرك الخصم نفسه في اللعبة على الجانبين: الأستاذ يلعب بالفاتحة والخبير بالداكنة. لكل حركة ثلاث خطوات: التفكير (2 أو 5 أو 8 أو 10 ثوانٍ، تختار أنت)، ثم الكشف (ثانيتان: تضيء الخيارات وتُعلَّم الحركة المختارة مع السبب بالكلمات)، ثم التنفيذ (تُلعب الحركة).',
      'يجمّد «إيقاف مؤقت» كل شيء مكانه، وتواصل «متابعة» من الموضع نفسه تمامًا. ولا يستهلك «شاهد وتعلّم» المعاينة المجانية.',
    ] } },
  { art: 'themes',
    en: { title: 'Boards, sound and text', body: [
      'In Settings you can choose the board and pieces: Cedar and Brass, Alhambra Blue or Ebony and Ivory. The rules do not change. Sound can be switched off, the think time of Watch & Learn set, and the text size raised up to 300 percent on every text screen, including the game screen.',
      'There are no timers and no stakes: results are only kept as your own record of wins, draws and losses for each level. The game starts with a free preview of the first 90 seconds of play; the full game is a single one-time unlock and works offline.',
    ] },
    es: { title: 'Tableros, sonido y texto', body: [
      'En Ajustes puedes elegir el tablero y las piezas: Cedro y latón, Azul alhambreño o Ébano y marfil. Las reglas no cambian. Se puede apagar el sonido, fijar el tiempo de pensar de Mirar y aprender y subir el tamaño del texto hasta el 300 por ciento en todas las pantallas de texto, incluida la del juego.',
      'No hay temporizadores ni apuestas: los resultados solo se guardan como tu propio récord de victorias, empates y derrotas por nivel. El juego empieza con una vista previa gratuita de los primeros 90 segundos de juego; el juego completo es un único desbloqueo y funciona sin conexión.',
    ] },
    ar: { title: 'الرقع والصوت والنص', body: [
      'من الإعدادات يمكنك اختيار الرقعة والقطع: أرز ونحاس، أو أزرق الحمراء، أو أبنوس وعاج. القواعد لا تتغير. ويمكن إيقاف الصوت، وضبط مدة التفكير في «شاهد وتعلّم»، ورفع حجم النص حتى 300 بالمئة في كل شاشات النص، بما فيها شاشة اللعب.',
      'لا مؤقتات ولا رهانات: تُحفظ النتائج فقط كسجل خاص بك للفوز والتعادل والخسارة لكل مستوى. تبدأ اللعبة بمعاينة مجانية لأول 90 ثانية من اللعب، والفتح الكامل عملية شراء واحدة، وتعمل بلا اتصال بالإنترنت.',
    ] } },
  { art: 'start',
    en: { title: 'Names and words', body: [
      'The name Alquerque comes from the Arabic al-qirkat. In Spanish the game is called alquerque de doce, "alquerque of twelve", for its twelve pieces a side. Here "piece" means one of the round pieces and "point" one of the 25 places on the board.',
      'Light and Dark are the two sides. A "step" is a move to a neighbouring point; a "jump" is a capture over an enemy piece; a "chain" is several jumps by one piece in one turn.',
    ] },
    es: { title: 'Nombres y palabras', body: [
      'El nombre alquerque viene del árabe al-qirkat. En español el juego se llama alquerque de doce, por sus doce piezas por bando. Aquí «pieza» es una de las piezas redondas y «punto» uno de los 25 lugares del tablero.',
      'Claras y Oscuras son los dos bandos. Un «paso» es una jugada a un punto vecino; un «salto» es una captura sobre una pieza rival; una «cadena» son varios saltos de una pieza en un turno.',
    ] },
    ar: { title: 'الأسماء والكلمات', body: [
      'جاء اسم «ألكيرك» (Alquerque) من العربية «القِرقات». وتُسمّى اللعبة بالإسبانية alquerque de doce أي «القِرقات ذات الاثنتي عشرة» لأن لكل جانب اثنتي عشرة قطعة. والمقصود هنا بـ«القطعة» إحدى القطع المستديرة وبـ«النقطة» أحد الأماكن الخمسة والعشرين على الرقعة.',
      'الفاتحة والداكنة هما الجانبان. و«الخطوة» حركة إلى نقطة مجاورة؛ و«القفزة» أسر فوق قطعة معادية؛ و«السلسلة» عدة قفزات بقطعة واحدة في دور واحد.',
    ] } },
];

const ABOUT_DEF = [
  { en: { title: 'Alquerque: Twelve and Twelve', body: 'An old board game for two: twelve pieces each on a carved and inlaid board of 25 points joined by lines. Step forward or sideways, jump to capture, and chain your jumps.' },
    es: { title: 'Alquerque: doce contra doce', body: 'Un antiguo juego de tablero para dos: doce piezas cada uno sobre un tablero tallado e incrustado de 25 puntos unidos por líneas. Avanza o muévete de lado, salta para capturar y encadena tus saltos.' },
    ar: { title: 'القِرقات: اثنتا عشرة لكل جانب', body: 'لعبة رقعة قديمة للاعبين: اثنتا عشرة قطعة لكل منهما على رقعة محفورة ومطعّمة من 25 نقطة تصل بينها خطوط. تقدّم إلى الأمام أو الجانب، واقفز للأسر، وتابع قفزاتك في سلسلة.' } },
  { en: { title: 'Where it comes from', body: 'Alquerque takes its name from the Arabic al-qirkat. It was written about around the tenth century, and its rules are set out in the Spanish Libro de los juegos of the thirteenth century. It is often described as a forerunner of draughts. Different places and books play it a little differently, and the Rules explain the choices this game makes.' },
    es: { title: 'De dónde viene', body: 'El alquerque toma su nombre del árabe al-qirkat. Se escribió sobre él hacia el siglo X, y sus reglas aparecen en el Libro de los juegos español del siglo XIII. Suele describirse como un antecesor de las damas. Según el lugar y el libro se juega de forma algo distinta, y las Reglas explican las elecciones de este juego.' },
    ar: { title: 'من أين جاءت', body: 'اشتق اسم Alquerque من العربية «القِرقات». وقد كُتب عنها نحو القرن العاشر، وترد قواعدها في «كتاب الألعاب» الإسباني من القرن الثالث عشر. وكثيرًا ما تُوصف بأنها سلف لعبة الداما. وتختلف طريقة لعبها قليلًا من مكان إلى آخر ومن كتاب إلى آخر، وتشرح «القواعد» الخيارات التي تأخذ بها هذه اللعبة.' } },
  { en: { title: 'In this game', body: 'Five opponent levels from Novice to Master, two players on one phone, Think with a plain-English reason, a Learn course and Watch & Learn. Three boards to choose from, play in English, Spanish or Arabic, text that scales up to 300 percent, no timers, works offline.' },
    es: { title: 'En este juego', body: 'Cinco niveles de rival, de Novato a Maestro, dos jugadores en un móvil, Pensar con una razón en lenguaje sencillo, un curso de Aprender y Mirar y aprender. Tres tableros a elegir, juego en inglés, español o árabe, texto que crece hasta el 300 por ciento, sin temporizadores y sin conexión.' },
    ar: { title: 'في هذه اللعبة', body: 'خمسة مستويات للخصم من المبتدئ إلى الأستاذ، ولاعبان على هاتف واحد، و«فكّر» مع سبب بكلمات بسيطة، ودورة «تعلّم»، و«شاهد وتعلّم». ثلاث رقع للاختيار، واللعب بالإنجليزية أو الإسبانية أو العربية، ونص يكبر حتى 300 بالمئة، بلا مؤقتات، وتعمل بلا اتصال.' } },
];

const pick = (def) => def.map((d) => ({ art: d.art, ...d[['en', 'es', 'ar'][langIndex()]] }));
export const getHowto = () => pick(HOWTO_DEF);
export const getRules = () => pick(RULES_DEF);
export const getAbout = () => ABOUT_DEF.map((d) => d[['en', 'es', 'ar'][langIndex()]]);
export const RULE_COUNT = RULES_DEF.length;
export const HOWTO_COUNT = HOWTO_DEF.length;
STR.cLimit = L('{n} moves without a capture: more pieces wins', '{n} jugadas sin captura: gana quien tenga más piezas', '{n} حركة دون أسر: يفوز الأكثر قطعًا');
STR.cTrad = L('the choices this game makes where sources differ', 'las elecciones de este juego donde las fuentes difieren', 'خيارات هذه اللعبة حيث تختلف المصادر');
STR.aJump = L('{side}: jump and capture', '{side}: salto y captura', '{side}: قفزة وأسر');
STR.aStep = L('{side}: step', '{side}: paso', '{side}: خطوة');
STR.cJumpA = L('jump the enemy piece', 'salta la pieza rival', 'اقفز فوق قطعة الخصم');
STR.cJumpB = L('it is removed', 'se retira', 'تُزال');
