// UI strings in both languages. ES and EN are separate full presentations (never blended).
const S = {
  title: ['Lotería Cantada', 'Lotería Cantada'],
  tag: ['Sing it. Mark it. Shout it!', '¡Cántala, márcala, grítala!'],
  play: ['Play', 'Jugar'], playSub: ['against the computer', 'contra la computadora'],
  duo: ['Two players', 'Dos jugadores'], duoSub: ['face to face', 'cara a cara'],
  caller: ['Caller', 'Cantador'], callerSub: ['run a real table', 'para una mesa real'],
  watch: ['Watch & Learn', 'Ver y aprender'], watchSub: ['a whole round, explained', 'una ronda explicada'],
  howto: ['How to play', 'Cómo jugar'], rules: ['Rules', 'Reglas'], about: ['About', 'Acerca de'], settings: ['Settings', 'Ajustes'],
  es: ['Español', 'Español'], en: ['English', 'English'],
  setupTitle: ['Set the table', 'Prepara la mesa'],
  pattern: ['Pattern', 'Patrón'], pace: ['Pace', 'Ritmo'], opps: ['Opponents', 'Rivales'], skill: ['Skill', 'Nivel'], style: ['Canto', 'Canto'], theme: ['Look', 'Estilo'],
  start: ['Choose a tabla', 'Elegir tabla'], back: ['Back', 'Atrás'], doneBtn: ['Done', 'Listo'], next: ['Next', 'Siguiente'],
  pickTitle: ['Choose your tabla', 'Elige tu tabla'], deal: ['Deal again', 'Otras tablas'], letsPlay: ["Let's play!", '¡A jugar!'], pickHint: ['Tap a tabla', 'Toca una tabla'],
  lotto: ['¡LOTERÍA!', '¡LOTERÍA!'], hint: ['Hint', 'Pista'], pause: ['Pause', 'Pausa'], resume: ['Resume', 'Seguir'], menu: ['Menu', 'Menú'],
  paused: ['Paused', 'En pausa'], round: ['Round', 'Ronda'], score: ['Score', 'Puntos'], open: ['Open', 'Abiertas'],
  cardN: ['Card {n} of {m}', 'Carta {n} de {m}'], ready: ['Get ready!', '¡Prepárense!'], which: ['Which one is it?', '¿Cuál será?'],
  needs: ['needs {n}', 'le faltan {n}'], done: ['complete!', '¡completa!'], lost: ['out of luck', 'sin suerte'],
  wrongTap: ['Not called yet!', '¡Esa no ha salido!'], tooLate: ['Too late for that one', 'Muy tarde para esa'], falseClaim: ['False claim!', '¡Falsa alarma!'],
  locked: ['Wait {n}s', 'Espera {n}s'], complete: ['Pattern complete!', '¡Patrón completo!'], onTabla: ['It is on your tabla', 'Está en tu tabla'], notOn: ['Not on your tabla', 'No está en tu tabla'],
  youWin: ['You win!', '¡Ganaste!'], cpuWin: ['{name} wins', 'Gana {name}'], p1Win: ['Player 1 wins', 'Gana el jugador 1'], p2Win: ['Player 2 wins', 'Gana el jugador 2'], noWinner: ['No winner this time', 'Nadie ganó esta vez'],
  again: ['Next round', 'Otra ronda'], beans: ['Beans', 'Frijoles'], wrongs: ['Wrong taps', 'Toques errados'], falses: ['False claims', 'Falsas alarmas'], bonus: ['Win bonus', 'Bono de victoria'], roundScore: ['Round', 'Ronda'], total: ['Total', 'Total'], best: ['Best round', 'Mejor ronda'],
  you: ['You', 'Tú'], p1: ['Player 1', 'Jugador 1'], p2: ['Player 2', 'Jugador 2'],
  skipNext: ['Skip', 'Saltar'], auto: ['Auto', 'Auto'], shuffle: ['Shuffle', 'Barajar'], pace2: ['Every {n}s', 'Cada {n}s'], callerDone: ['Deck finished', 'Se acabó el mazo'], callerReady: ['Tap Next to call', 'Toca Siguiente'],
  exit: ['Exit', 'Salir'], think: ['Think', 'Pensar'], thinkIn: ['Think: guess the card', 'Piensa: adivina la carta'], reveal: ['The answer', 'La respuesta'], act: ['Bean!', '¡Frijol!'],
  autoIs: ['It is {name}', 'Es {name}'], watchAgain: ['Watch again', 'Ver otra vez'], thinkTime: ['{n}s', '{n}s'],
  lang: ['Language', 'Idioma'], sound: ['Sound', 'Sonido'], on: ['On', 'Sí'], off: ['Off', 'No'], text: ['Text size', 'Tamaño de texto'], look: ['Look', 'Estilo'], reset: ['Reset best score', 'Borrar mejor puntaje'], resetDone: ['Done', 'Listo'],
  demoEnd: ['Demo finished', 'Fin de la demo'], demoMsg: ['Get the full game on iPhone and Android.', 'Consigue el juego completo en iPhone y Android.'],
  page: ['Page {n} of {m}', 'Página {n} de {m}'], englishTag: ['(reference in English)', '(referencia en inglés)'],
  fast: ['Fast-forward: you cannot finish', 'Avance rápido: ya no puedes completar'], hintLeft: ['{n} left', 'quedan {n}'],
  tip: ['Tap the picture on your tabla that matches the call!', '¡Toca en tu tabla la imagen de la carta cantada!'],
  needsMore: ['needs {n} more', 'faltan {n}'], notOnAuto: ['Not on your tabla: no bean this time', 'No está en tu tabla: sin frijol'],
  styleEasy: ['Easy', 'Fácil'], styleClassic: ['Classic', 'Clásico'], stylePure: ['Pure', 'Puro'],
};
export function t(lang, key, p) {
  const e = S[key]; let s = e ? e[lang === 'es' ? 1 : 0] : key;
  if (p) for (const k of Object.keys(p)) s = s.replace(`{${k}}`, p[k]);
  return s;
}
