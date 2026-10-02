// Every public word the game shows, in English and Spanish. The player picks one language (Settings or the menu) and the whole
// game follows it: never a blend. `tr(key, vars)` looks up the current language.
let LANG = 'en';
export const setLang = (l) => { LANG = l === 'es' ? 'es' : 'en'; };
export const getLang = () => LANG;

const FACE_EN = ['', 'paco', 'two', 'three', 'four', 'five', 'six'];
const FACE_ES = ['', 'paco', 'dos', 'tres', 'cuatro', 'cinco', 'seis'];
export const faceWord = (f, q = 2) => {
  const w = (LANG === 'es' ? FACE_ES : FACE_EN)[f];
  return q === 1 ? w : `${w}s`;
};
export const bidWords = (q, f) => `${q} ${faceWord(f, q)}`;

const D = {
  en: {
    title: 'Dudo', subtitle: 'Andean Bluff Dice', tagline: 'Hide your dice. Bid. Bluff. Call it.',
    playBtn: 'Play', learnBtn: 'Learn', autoBtn: 'Watch & Learn', howtoBtn: 'How to Play', rulesBtn: 'Rules', aboutBtn: 'About', settingsBtn: 'Settings',
    continueBtn: 'Continue', back: 'Back', prev: 'Prev', next: 'Next', startGame: 'Start game', langEn: 'Play in English', langEs: 'Jugar en español',
    playersTitle: 'Who plays', humansTitle: 'People on this phone', cpusTitle: 'Computer players', levelTitle: 'Computer level', mixed: 'Mixed',
    onePerson: '1 person', nPeople: '{n} people', nCpu: '{n}', noCpu: 'None', lvLine: 'Players: {h} on the phone, {c} computer.',
    passNote: 'With two or more people the phone is passed: a screen hides the dice between turns.',
    theme: 'Table', soundOn: 'Sound: on', soundOff: 'Sound: off', thinkTime: 'Watch & Learn thinking time', seconds: ' s', language: 'Language',
    unlock: 'Unlock full game', restore: 'Restore purchase', owned: 'Full game unlocked. Thank you!', resetProgress: 'Reset records and lessons', resetConfirm: 'Tap again to reset',
    demoLeft: '{n} games left in this demo', demoLimitTitle: 'That is the demo', demoLimitBody: 'Get the full game on iPhone and Android: all five computer levels, every table, pass-and-play and the lessons.', locked: 'Full game',
    quitMenu: 'Main menu', paused: 'Paused', resume: 'Resume', restart: 'New game', textSize: 'Text size', again: 'Play again', newSetup: 'New setup',
    bid: 'Bid', dudo: 'Dudo!', calzo: 'Calzo', think: 'Think', youWord: 'You', youPoss: 'Your dice', hiddenDice: 'Dice hidden', nextRound: 'Next round',
    yourTurn: 'Your turn', thinking: 'thinking', toOpen: 'You open the round: make a bid.', toRaise: 'Raise the bid, or call Dudo.',
    handoffTitle: 'Pass the phone to {name}', handoffBody: 'Everyone else look away. Tap when {name} is ready.', handoffBtn: 'Show my dice',
    handoffTable: 'Your turn, {name}', hiddenBody: 'Your dice are under the cup.',
    bidNow: 'Current bid', noBid: 'No bid yet', bidBy: 'by {name}', roundN: 'Round {n}', diceInPlay: '{n} dice in play', pal: 'Palifico round: pacos are not wild and the face is fixed.',
    palTag: 'Palifico', calzoLocked: 'Calzo needs at least half of the starting dice in play.',
    callDudo: '{name} calls Dudo!', callCalzo: '{name} calls Calzo!', countIs: 'There are {n} {w}.', youLose: 'You lose a die.', youGain: 'You win a die back.', loseDie: '{name} loses a die.', gainDie: '{name} wins a die back.', capDie: '{name} is already at the full five dice.',
    elim: '{name} is out.', callerRight: 'The bid was too high.', callerWrong: 'The bid was good.', calzoRight: 'Exactly right!', calzoWrong: 'Not exact.',
    youWin: 'You win!', youOut: 'You are out', winsMatch: '{name} wins', matchOverBody: 'The last cup standing.', record: 'Record', wins: 'wins', losses: 'losses',
    palNext: '{name} is down to one die: the next round is Palifico.',
    thinkHead: 'Think', thinkNone: 'Nothing to think about right now.',
    autoSession: 'Watch & Learn', autoSummary: 'You watched a whole game with every cup open. Watch again, or head back to the menu.', autoAgain: 'Watch again', autoExit: 'Main menu',
    autoThink: 'Thinking', autoSlower: 'Slower', autoFaster: 'Faster', autoPause: 'Pause', autoPlay: 'Resume', vsComputer: 'vs computer', passPlay: 'Pass and play',
    lessonsTitle: 'Learn Dudo', lessonDone: 'done', lessonNext: 'Next lesson', lessonList: 'All lessons', lessonCheck: 'Tap your answer', lessonRight: 'Correct!', lessonWrong: 'Not quite.', lessonQ: 'Question {a} of {b}', lessonFinish: 'Lesson finished', lessonAgain: 'Do it again',
    howTo: 'How to play', stats: 'Your record against {name}: {w} wins, {l} losses',
    ready: 'Ready', ok: 'OK', outTag: 'Out', dicesOf: "{name}'s dice", botWait: '{name} is deciding', tapDice: 'Tap to show',
  },
  es: {
    title: 'Dudo', subtitle: 'Dados de farol andino', tagline: 'Esconde tus dados. Apuesta. Farolea. Cántalo.',
    playBtn: 'Jugar', learnBtn: 'Aprender', autoBtn: 'Mirar y aprender', howtoBtn: 'Cómo se juega', rulesBtn: 'Reglas', aboutBtn: 'Acerca de', settingsBtn: 'Ajustes',
    continueBtn: 'Continuar', back: 'Volver', prev: 'Antes', next: 'Siguiente', startGame: 'Empezar', langEn: 'Play in English', langEs: 'Jugar en español',
    playersTitle: 'Quiénes juegan', humansTitle: 'Personas en este teléfono', cpusTitle: 'Jugadores del teléfono', levelTitle: 'Nivel del teléfono', mixed: 'Variado',
    onePerson: '1 persona', nPeople: '{n} personas', nCpu: '{n}', noCpu: 'Ninguno', lvLine: 'Jugadores: {h} en el teléfono, {c} computadora.',
    passNote: 'Con dos o más personas se pasa el teléfono: una pantalla tapa los dados entre turnos.',
    theme: 'Mesa', soundOn: 'Sonido: sí', soundOff: 'Sonido: no', thinkTime: 'Tiempo de pensar al mirar', seconds: ' s', language: 'Idioma',
    unlock: 'Desbloquear el juego', restore: 'Restaurar compra', owned: 'Juego completo desbloqueado. ¡Gracias!', resetProgress: 'Borrar récords y lecciones', resetConfirm: 'Toca otra vez para borrar',
    demoLeft: 'Quedan {n} partidas en esta demo', demoLimitTitle: 'Eso es la demo', demoLimitBody: 'Consigue el juego completo en iPhone y Android: los cinco niveles, todas las mesas, pasar el teléfono y las lecciones.', locked: 'Juego completo',
    quitMenu: 'Menú principal', paused: 'En pausa', resume: 'Seguir', restart: 'Partida nueva', textSize: 'Tamaño del texto', again: 'Jugar otra vez', newSetup: 'Nueva partida',
    bid: 'Apostar', dudo: '¡Dudo!', calzo: 'Calzo', think: 'Pensar', youWord: 'Tú', youPoss: 'Tus dados', hiddenDice: 'Dados tapados', nextRound: 'Siguiente ronda',
    yourTurn: 'Tu turno', thinking: 'pensando', toOpen: 'Abres la ronda: haz una apuesta.', toRaise: 'Sube la apuesta o canta Dudo.',
    handoffTitle: 'Pasa el teléfono a {name}', handoffBody: 'Los demás miren a otro lado. Toca cuando {name} esté listo.', handoffBtn: 'Ver mis dados',
    handoffTable: 'Tu turno, {name}', hiddenBody: 'Tus dados están bajo el cacho.',
    bidNow: 'Apuesta actual', noBid: 'Aún no hay apuesta', bidBy: 'de {name}', roundN: 'Ronda {n}', diceInPlay: '{n} dados en juego', pal: 'Ronda palifico: los pacos no son comodín y la cara queda fija.',
    palTag: 'Palifico', calzoLocked: 'El calzo pide que quede al menos la mitad de los dados iniciales.',
    callDudo: '¡{name} canta Dudo!', callCalzo: '¡{name} canta Calzo!', countIs: 'Hay {n} {w}.', youLose: 'Pierdes un dado.', youGain: 'Recuperas un dado.', loseDie: '{name} pierde un dado.', gainDie: '{name} recupera un dado.', capDie: '{name} ya tiene los cinco dados.',
    elim: '{name} queda fuera.', callerRight: 'La apuesta era demasiado alta.', callerWrong: 'La apuesta era buena.', calzoRight: '¡Justo!', calzoWrong: 'No era justo.',
    youWin: '¡Ganas!', youOut: 'Quedas fuera', winsMatch: 'Gana {name}', matchOverBody: 'El último cacho en pie.', record: 'Récord', wins: 'victorias', losses: 'derrotas',
    palNext: '{name} se queda con un dado: la próxima ronda es palifico.',
    thinkHead: 'Pensar', thinkNone: 'Por ahora no hay nada que pensar.',
    autoSession: 'Mirar y aprender', autoSummary: 'Viste una partida entera con todos los cachos abiertos. Míralo otra vez o vuelve al menú.', autoAgain: 'Mirar otra vez', autoExit: 'Menú principal',
    autoThink: 'Pensando', autoSlower: 'Más lento', autoFaster: 'Más rápido', autoPause: 'Pausa', autoPlay: 'Seguir', vsComputer: 'contra el teléfono', passPlay: 'Pasar el teléfono',
    lessonsTitle: 'Aprende Dudo', lessonDone: 'lista', lessonNext: 'Siguiente lección', lessonList: 'Todas las lecciones', lessonCheck: 'Toca tu respuesta', lessonRight: '¡Correcto!', lessonWrong: 'Casi.', lessonQ: 'Pregunta {a} de {b}', lessonFinish: 'Lección terminada', lessonAgain: 'Repetir',
    howTo: 'Cómo se juega', stats: 'Tu récord contra {name}: {w} victorias, {l} derrotas',
    ready: 'Listo', ok: 'OK', outTag: 'Fuera', dicesOf: 'Dados de {name}', botWait: '{name} está decidiendo', tapDice: 'Toca para ver',
  },
};

export function tr(key, vars) {
  let s = D[LANG][key] ?? D.en[key] ?? key;
  if (vars) for (const k of Object.keys(vars)) s = s.split(`{${k}}`).join(String(vars[k]));
  return s;
}

// ------------------------------------------------------------------------------------------ How to play (one page each)
const HOWTO_EN = [
  { title: 'The goal', art: 'cups', body: 'Everyone has five dice hidden under a cup. Look at your own dice, then bid on how many of one face lie under ALL the cups together. Lose a bluff and you lose a die. The last player with a die wins.' },
  { title: 'Your turn: bid', art: 'bidpick', body: 'Pick a face below, set the number with + and -, then tap Bid. A bid must go up: more dice, or the same number of a higher face. The buttons only offer legal bids. Ones, called pacos, are wild: they count as every face.' },
  { title: 'Dudo or Calzo', art: 'dudo', body: 'Think the last bid is too high? Tap Dudo! All cups are lifted and counted. If the bid is not met, the bidder loses a die; if it is met, you do. Sure it is exactly right? Tap Calzo: right wins you a die back, wrong costs you one.' },
  { title: 'Think', art: 'think', body: 'Stuck? Tap Think. It tells you in plain words how many matching dice to expect among all the cups, how likely the bid is, and what it would do. The odds are exact. A bluff is still a bluff: Think does not know the hidden dice.' },
  { title: 'Pass and play', art: 'pass', body: 'Choose two or more people on one phone. Between turns a screen hides the dice and names who is next. Only the person whose turn it is taps to see their dice. You can add computer players to the same table.' },
  { title: 'Learn and Watch', art: 'auto', body: 'Learn teaches pacos, legal bids, odds, Dudo, Calzo and Palifico in short quizzes. Watch & Learn plays a whole game with every cup open: it thinks, shows its choices, then acts. Pause or change the speed at any time.' },
];
const HOWTO_ES = [
  { title: 'El objetivo', art: 'cups', body: 'Cada uno tiene cinco dados tapados con un cacho. Mira los tuyos y apuesta cuántos dados de una misma cara hay bajo TODOS los cachos juntos. Quien pierde un farol pierde un dado. Gana quien se quede con dados.' },
  { title: 'Tu turno: apostar', art: 'bidpick', body: 'Elige una cara, ajusta la cantidad con + y -, y toca Apostar. La apuesta debe subir: más dados, o la misma cantidad de una cara mayor. Los botones solo ofrecen apuestas válidas. Los unos, o pacos, son comodín: valen como cualquier cara.' },
  { title: 'Dudo o Calzo', art: 'dudo', body: '¿Crees que la última apuesta es demasiado alta? Toca ¡Dudo! Se levantan los cachos y se cuenta. Si no se cumple, pierde un dado quien apostó; si se cumple, lo pierdes tú. ¿Seguro que es justa? Toca Calzo: si aciertas recuperas un dado, si fallas pierdes uno.' },
  { title: 'Pensar', art: 'think', body: '¿Dudas? Toca Pensar. Te dice con palabras sencillas cuántos dados esperar entre todos los cachos, qué tan probable es la apuesta y qué conviene. Las probabilidades son exactas. Un farol sigue siendo un farol: Pensar no ve los dados ocultos.' },
  { title: 'Pasar el teléfono', art: 'pass', body: 'Elige dos o más personas en un teléfono. Entre turnos una pantalla tapa los dados y dice quién sigue. Solo a quien le toca toca para ver sus dados. Puedes sumar jugadores del teléfono a la misma mesa.' },
  { title: 'Aprender y mirar', art: 'auto', body: 'Aprender enseña pacos, apuestas válidas, probabilidades, Dudo, Calzo y Palifico con preguntas cortas. Mirar y aprender juega una partida entera con todos los cachos abiertos: piensa, muestra sus opciones y actúa. Pausa o cambia la velocidad cuando quieras.' },
];

// ------------------------------------------------------------------------------------------ Rules (exhaustive; checked against rules.js)
const RULES_EN = [
  { title: 'The goal', art: 'cups', body: ['Dudo is a bluffing dice game from the Andes. Each player starts with five dice and a cup.', 'Every round all dice are shaken under the cups and each player looks only at their own. Players bid on what lies under all the cups together.', 'Whoever is wrong about a bluff loses a die. A player with no dice is out. The last player with dice wins. There are no draws and nothing is wagered: dice are only for elimination.'] },
  { title: 'A round', art: 'bidpick', body: ['The round opener makes the first bid. Play then goes clockwise to the next player who is still in.', 'On your turn you do exactly one of three things: raise the bid, call Dudo, or call Calzo. The opener cannot call, because there is no bid yet.', 'After a call, every cup is lifted, the dice are counted and one player loses or gains a die. Then a new round begins with everyone shaking again.'] },
  { title: 'Bids', art: 'ladder', body: ['A bid is a quantity and a face, for example "four 5s". It claims that at least four dice among all cups show a five, counting pacos as fives.', 'To raise, bid a larger quantity of any face, or the same quantity of a higher face. "Three 4s" can become "three 5s", "three 6s" or "four 2s".', 'A bid can never be higher than the number of dice on the table. The bid buttons in this game offer only legal bids and set the smallest legal quantity when you pick a face.'] },
  { title: 'Pacos are wild', art: 'paco', body: ['Ones are called pacos. In an ordinary bid a paco counts as the face being bid.', 'Example: the bid is "four 5s" and the cups hold three fives and two pacos. The count is five, so the bid is met.', 'Pacos stop being wild when the bid is on pacos themselves (only real ones count) and during a Palifico round.'] },
  { title: 'Bidding pacos', art: 'pacoladder', body: ['Because pacos are wild they are twice as common as other faces to count, so the bid ladder changes.', 'Going from an ordinary bid to pacos: bid at least half the quantity, rounded up. From "five 4s" you may bid "three pacos".', 'Going from pacos back to an ordinary face: bid at least double the quantity plus one. From "three pacos" the next ordinary bid is at least "seven" of any face.', 'Raising pacos to pacos: just a larger quantity.'] },
  { title: 'Dudo', art: 'dudo', body: ['"Dudo" means "I doubt it". You call it on the bid just made by the player before you.', 'All cups are lifted and the face is counted (pacos wild unless the bid was on pacos or it is Palifico).', 'If the count is at least the bid, the bid was good and the caller loses a die. If the count is lower, the bidder loses a die.', 'The player who lost the die opens the next round.'] },
  { title: 'Calzo', art: 'calzo', body: ['"Calzo" means "it is exactly right". You call it on the last bid instead of raising or Dudo.', 'Cups are lifted. If the count equals the bid exactly, the caller wins back a die (never more than the starting five). If not, the caller loses a die. The bidder is not affected.', 'In this game Calzo is allowed only while at least half of the starting dice are still in play. The caller opens the next round.'] },
  { title: 'Losing and gaining dice', art: 'lose', body: ['Dice are never rolled by themselves: a player simply has fewer dice in their cup next round.', 'A player who loses their last die is out and is shown as such. Their cup is gone for the rest of the match.', 'If the player who should open the next round is out, the next player clockwise opens.'] },
  { title: 'Palifico', art: 'palifico', body: ['When a player is first reduced to a single die, the next round is Palifico (not when only two players remain). Each player gets this once.', 'In a Palifico round the player with one die opens and chooses the face. After that every bid must keep that same face and only raise the quantity.', 'Pacos are not wild in a Palifico round. If the opener bids pacos, the whole round is on pacos.'] },
  { title: 'Reading the odds', art: 'odds', body: ['Each hidden die shows a given face one time in six, and a paco-or-that-face one time in three. So among all dice, about one third count toward an ordinary face (that face plus pacos), and about one sixth are pacos.', 'You know your own dice. The rest are hidden. The chance a bid is true is the chance the hidden dice supply what you do not hold. Think works this out exactly.', 'More dice on the table means larger bids are normal. A bid well above one third of all dice is usually a bluff.'] },
  { title: 'Computer players', art: 'levels', body: ['Wawa misjudges odds and bids wildly. Chasqui plays the odds roughly. Yachay counts correctly and sometimes bluffs. Amauta reads what the bids reveal about other cups. Kuntur weighs every bid by risk and bluffs when the table will believe it.', 'Every computer player sees only its own dice, exactly like you. None of them look at your dice and none has a tell. Each level beats the one below it over many games.'] },
  { title: 'Playing together', art: 'pass', body: ['Two to four people can share one phone, with up to five computer players alongside. A table holds at most six players.', 'Between turns a screen hides the dice and asks for the next player. Only that player sees their dice, after they tap.', 'Watch & Learn plays a full game with every hand open so you can see how bids relate to the hidden dice.'] },
  { title: 'Winning', art: 'end', body: ['The match ends when one player still has dice. That player wins.', 'Your wins and losses against each computer level are kept in your record. You can save a match at any time and Continue it later.'] },
];
const RULES_ES = [
  { title: 'El objetivo', art: 'cups', body: ['Dudo es un juego de dados de farol de los Andes. Cada jugador empieza con cinco dados y un cacho.', 'En cada ronda los dados se agitan bajo los cachos y cada uno ve solo los suyos. Se apuesta por lo que hay bajo todos los cachos juntos.', 'Quien se equivoca en un farol pierde un dado. Sin dados, quedas fuera. Gana el último con dados. No hay empates y no se apuesta nada: los dados solo sirven para eliminar.'] },
  { title: 'Una ronda', art: 'bidpick', body: ['Quien abre la ronda hace la primera apuesta. El turno sigue en el sentido del reloj al siguiente jugador que sigue en juego.', 'En tu turno haces una sola cosa: subir la apuesta, cantar Dudo o cantar Calzo. Quien abre no puede cantar, porque aún no hay apuesta.', 'Tras un canto se levantan todos los cachos, se cuentan los dados y un jugador pierde o gana un dado. Luego empieza otra ronda y todos agitan de nuevo.'] },
  { title: 'Apuestas', art: 'ladder', body: ['Una apuesta es una cantidad y una cara, por ejemplo "cuatro cincos". Afirma que entre todos los cachos hay al menos cuatro dados con un cinco, contando los pacos como cincos.', 'Para subir, apuesta más cantidad de cualquier cara, o la misma cantidad de una cara mayor. "Tres cuatros" puede pasar a "tres cincos", "tres seises" o "cuatro doses".', 'Una apuesta nunca puede superar los dados que hay en la mesa. Los botones de este juego solo ofrecen apuestas válidas y ponen la cantidad mínima al elegir una cara.'] },
  { title: 'Los pacos son comodín', art: 'paco', body: ['Los unos se llaman pacos. En una apuesta común un paco vale como la cara apostada.', 'Ejemplo: la apuesta es "cuatro cincos" y los cachos tienen tres cincos y dos pacos. La cuenta es cinco, así que se cumple.', 'Los pacos dejan de ser comodín cuando se apuesta a los pacos (solo cuentan los unos) y en una ronda palifico.'] },
  { title: 'Apostar pacos', art: 'pacoladder', body: ['Como los pacos son comodín, la escalera de apuestas cambia.', 'De una apuesta común a pacos: al menos la mitad de la cantidad, redondeada hacia arriba. Desde "cinco cuatros" puedes apostar "tres pacos".', 'De pacos a una cara común: al menos el doble más uno. Desde "tres pacos" la siguiente apuesta común es de al menos "siete" de cualquier cara.', 'De pacos a pacos: solo una cantidad mayor.'] },
  { title: 'Dudo', art: 'dudo', body: ['"Dudo" significa "no lo creo". Se canta sobre la apuesta que acaba de hacer el jugador anterior.', 'Se levantan los cachos y se cuenta la cara (pacos comodín, salvo que la apuesta fuera de pacos o sea palifico).', 'Si la cuenta es al menos la apuesta, la apuesta era buena y pierde un dado quien cantó. Si es menor, pierde un dado quien apostó.', 'Quien perdió el dado abre la siguiente ronda.'] },
  { title: 'Calzo', art: 'calzo', body: ['"Calzo" significa "es justo". Se canta sobre la última apuesta en lugar de subir o decir Dudo.', 'Se levantan los cachos. Si la cuenta es exactamente la apuesta, quien cantó recupera un dado (nunca más de los cinco iniciales). Si no, pierde un dado. A quien apostó no le pasa nada.', 'En este juego el calzo solo se permite mientras queden al menos la mitad de los dados iniciales. Quien cantó abre la siguiente ronda.'] },
  { title: 'Perder y ganar dados', art: 'lose', body: ['Los dados no se tiran solos: un jugador simplemente tiene menos dados en su cacho la ronda siguiente.', 'Quien pierde su último dado queda fuera y se marca así. Su cacho no vuelve en toda la partida.', 'Si quien debía abrir la ronda siguiente está fuera, abre el siguiente jugador en el sentido del reloj.'] },
  { title: 'Palifico', art: 'palifico', body: ['Cuando un jugador se queda por primera vez con un solo dado, la ronda siguiente es palifico (no cuando quedan solo dos jugadores). Cada jugador lo tiene una vez.', 'En una ronda palifico abre quien tiene un dado y elige la cara. Después toda apuesta debe mantener esa cara y solo subir la cantidad.', 'Los pacos no son comodín en palifico. Si quien abre apuesta pacos, toda la ronda es de pacos.'] },
  { title: 'Leer las probabilidades', art: 'odds', body: ['Cada dado oculto muestra una cara dada una vez de cada seis, y esa cara o un paco una vez de cada tres. Entre todos los dados, cerca de un tercio cuenta para una cara común (esa cara más los pacos) y cerca de un sexto son pacos.', 'Conoces tus dados; el resto está oculto. La probabilidad de una apuesta es la de que los dados ocultos aporten lo que a ti te falta. Pensar lo calcula con exactitud.', 'Con más dados en la mesa las apuestas altas son normales. Una apuesta muy por encima de un tercio de todos los dados suele ser un farol.'] },
  { title: 'Jugadores del teléfono', art: 'levels', body: ['Wawa calcula mal y apuesta a la loca. Chasqui juega con las probabilidades a ojo. Yachay cuenta bien y a veces farolea. Amauta lee lo que dicen las apuestas sobre los otros cachos. Kuntur pesa cada apuesta por riesgo y farolea cuando la mesa le cree.', 'Cada jugador del teléfono ve solo sus propios dados, igual que tú. Ninguno mira los tuyos y ninguno tiene gestos que lo delaten. Cada nivel le gana al anterior en muchas partidas.'] },
  { title: 'Jugar juntos', art: 'pass', body: ['Dos a cuatro personas pueden compartir un teléfono, con hasta cinco jugadores del teléfono a la vez. Una mesa admite como máximo seis jugadores.', 'Entre turnos una pantalla tapa los dados y pide al siguiente jugador. Solo ese jugador ve sus dados, después de tocar.', 'Mirar y aprender juega una partida con todas las manos abiertas para ver cómo se relacionan las apuestas con los dados ocultos.'] },
  { title: 'Ganar', art: 'end', body: ['La partida termina cuando solo un jugador conserva dados. Ese jugador gana.', 'Tus victorias y derrotas contra cada nivel quedan en tu récord. Puedes guardar una partida en cualquier momento y continuarla después.'] },
];

const ABOUT_EN = [
  { title: 'Dudo', body: 'A bluffing dice game played in homes and gatherings across the Andes, in Peru, Bolivia and Chile, and in many other places. Its exact origin is debated; popular accounts place its roots in the Andean world.' },
  { title: 'This version', body: 'Real Dudo rules with pacos, Calzo and Palifico, five computer levels, Think with exact odds, short lessons, Watch & Learn and pass-and-play for friends. Nothing is wagered: dice only knock players out.' },
  { title: 'Names and look', body: 'Computer players carry Quechua words: Wawa (little one), Chasqui (relay messenger), Yachay (knowledge), Amauta (teacher) and Kuntur (condor). The tables borrow woven stepped-diamond patterns and a leather cup.' },
];
const ABOUT_ES = [
  { title: 'Dudo', body: 'Un juego de dados de farol que se juega en casas y reuniones de los Andes, en Perú, Bolivia y Chile, y en muchos otros lugares. Su origen exacto se discute; las versiones populares lo sitúan en el mundo andino.' },
  { title: 'Esta versión', body: 'Reglas reales de Dudo con pacos, calzo y palifico, cinco niveles, Pensar con probabilidades exactas, lecciones cortas, Mirar y aprender y pasar el teléfono entre amigos. No se apuesta nada: los dados solo eliminan jugadores.' },
  { title: 'Nombres y estilo', body: 'Los jugadores del teléfono llevan palabras quechuas: Wawa (pequeño), Chasqui (mensajero), Yachay (saber), Amauta (maestro) y Kuntur (cóndor). Las mesas toman prestados patrones tejidos de rombos escalonados y un cacho de cuero.' },
];

export const HOWTO = () => (LANG === 'es' ? HOWTO_ES : HOWTO_EN);
export const RULES = () => (LANG === 'es' ? RULES_ES : RULES_EN);
export const ABOUT = () => (LANG === 'es' ? ABOUT_ES : ABOUT_EN);
export const HOWTO_COUNT = HOWTO_EN.length;
export const RULE_COUNT = RULES_EN.length;
