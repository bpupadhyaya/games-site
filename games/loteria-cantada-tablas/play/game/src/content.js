// Text for the About, How to Play and Rules pages, in English and Spanish. Every number below is read from
// rules.js, so a page can never disagree with the engine. view.js paginates each page's paragraphs to fit
// the chosen text size and language. Spanish copy: written for this game; flagged for native review in STATUS.md.
import { POOL, CELLS, SCORE, PACES, SKILLS, LOCKOUT_SECS, HINTS_PER_ROUND, CLASSIC_REVEAL_SECS, PATTERNS } from './rules.js';
import { DECK_SIZE } from './cards.js';

const secs = (n) => `${n} ${n === 1 ? 'second' : 'seconds'}`;
const secsEs = (n) => `${n} ${n === 1 ? 'segundo' : 'segundos'}`;
const pace = (id) => PACES.find((p) => p.id === id);
// A page: title and paragraphs as [english, spanish] pairs (paras = [[en, es], ...]).
const pg = (title, paras, art) => ({ title, paras, art });
const lang = (list, i) => list.map((p) => ({ title: p.title[i], paras: p.paras.map((x) => x[i]), art: p.art }));

const ABOUT_SRC = [
  pg(['Lotería Cantada', 'Lotería Cantada'], [
    ['A picture bingo game in the lotería tradition of Mexico: a caller sings out each card with a little rhyme, and everyone marks their tabla with beans.', 'Un juego de bingo con imágenes en la tradición de la lotería de México: el cantador canta cada carta con una rimita y todos marcan su tabla con frijoles.'],
    ['Shout "¡Lotería!" when your pattern is complete.', 'Grita "¡Lotería!" cuando completes tu patrón.'],
  ], { type: 'cards', ids: [6, 0, 53] }),
  pg(['A family tradition', 'Una tradición familiar'], [
    ['Lotería is played at kitchen tables, fairs and parties across Mexico and in Latino communities around the world.', 'La lotería se juega en mesas de cocina, ferias y fiestas de todo México y en comunidades latinas de todo el mundo.'],
    ['Part of the fun has always been the caller\'s riddles, sung before the picture is named.', 'Parte de la diversión siempre han sido las adivinanzas del cantador, cantadas antes de nombrar la imagen.'],
  ]),
  pg(['Made for this game', 'Hecho para este juego'], [
    [`All ${DECK_SIZE} pictures were drawn for this game in a folk-art style, and every verse was written for it, in Spanish and in English.`, `Las ${DECK_SIZE} imágenes se dibujaron para este juego en estilo de arte popular, y cada verso se escribió para él, en español y en inglés.`],
  ], { type: 'cards', ids: [37, 36, 11] }),
  pg(['Just for fun', 'Solo por diversión'], [
    ['Scores are only for bragging rights. There are no stakes, no chips and no ads.', 'Los puntos son solo para presumir. No hay apuestas, ni fichas, ni anuncios.'],
  ]),
  pg(['Ways to play', 'Maneras de jugar'], [
    ['Play against computer players, face to face with a friend on one phone, or let the phone be the caller for a real table with real tablas.', 'Juega contra la computadora, cara a cara con un amigo en un solo teléfono, o deja que el teléfono sea el cantador de una mesa real con tablas de verdad.'],
    ['Watch & Learn plays a whole round by itself and explains each step.', 'Ver y aprender juega una ronda completa solo y explica cada paso.'],
  ]),
  pg(['Your language', 'Tu idioma'], [
    ['Choose Español or English on the menu. It changes the caller\'s voice, the riddles, every button in the game and these reference pages.', 'Elige Español o English en el menú. Cambia la voz del cantador, las adivinanzas, todos los botones del juego y estas páginas de referencia.'],
  ]),
];

const HOWTO_SRC = [
  pg(['Pick your tabla', 'Elige tu tabla'], [
    ['Your tabla is a grid of 16 different pictures. Choose one of three, or deal again for new ones.', 'Tu tabla es una cuadrícula de 16 imágenes distintas. Elige una de tres, o pide otras nuevas.'],
  ], { type: 'tabla' }),
  pg(['Listen to the canto', 'Escucha el canto'], [
    ['A card is called with a two-line riddle. Work out the picture it describes.', 'Se canta una carta con una adivinanza de dos versos. Descubre la imagen que describe.'],
    ['In Easy style the name is shown with the riddle.', 'En el estilo Fácil el nombre aparece junto a la adivinanza.'],
  ], { type: 'cards', ids: [7] }),
  pg(['Tap it', 'Tócala'], [
    ['If the picture is on your tabla, tap it to drop a bean on it.', 'Si la imagen está en tu tabla, tócala para ponerle un frijol.'],
    ['Tapping a picture that has not been called costs points.', 'Tocar una imagen que no se ha cantado te quita puntos.'],
  ], { type: 'bean' }),
  pg(['Mind the clock', 'Cuida el tiempo'], [
    ['A card can only be marked for a short while after it is called. The strip above your tabla shows which calls are still open.', 'Una carta solo se puede marcar poco tiempo después de cantarse. La tira sobre tu tabla muestra qué cartas siguen abiertas.'],
  ]),
  pg(['Shout it', 'Grítalo'], [
    ['When your pattern is complete, press ¡LOTERÍA! before a computer player does.', 'Cuando tu patrón esté completo, pulsa ¡LOTERÍA! antes que un jugador de la computadora.'],
    ['Pressing it too early is a false claim and costs points.', 'Pulsarlo antes de tiempo es una falsa alarma y te quita puntos.'],
  ]),
  pg(['Need help?', '¿Necesitas ayuda?'], [
    [`Press Hint (${HINTS_PER_ROUND} per round) to light up the matching picture. Or choose Watch & Learn on the menu to see a whole round explained.`, `Pulsa Pista (${HINTS_PER_ROUND} por ronda) para iluminar la imagen que coincide. O elige Ver y aprender en el menú para ver una ronda completa explicada.`],
  ]),
];

const patPage = (id, extra) => {
  const p = PATTERNS.find((x) => x.id === id);
  return pg([p.en, p.es], [[p.blurb.en, p.blurb.es], extra], { type: 'pattern', id });
};

const RULES_SRC = [
  pg(['The deck', 'La baraja'], [
    [`The deck has ${DECK_SIZE} different pictures, each with a name and a rhyming riddle in Spanish and in English.`, `La baraja tiene ${DECK_SIZE} imágenes distintas, cada una con un nombre y una adivinanza en rima, en español y en inglés.`],
    [`Each round uses ${POOL} of them, chosen at random. Every card in the round is called once, in random order.`, `Cada ronda usa ${POOL} de ellas, elegidas al azar. Cada carta de la ronda se canta una sola vez, en orden aleatorio.`],
  ], { type: 'cards', ids: [1, 22, 40] }),
  pg(['The tabla', 'La tabla'], [
    [`A tabla is a 4 x 4 grid of ${CELLS} different pictures, all taken from that round's ${POOL} cards.`, `Una tabla es una cuadrícula de 4 x 4 con ${CELLS} imágenes distintas, todas de las ${POOL} cartas de esa ronda.`],
    ['Before the round you see three tablas. Tap one to choose it, or deal again for three new ones as often as you like.', 'Antes de la ronda ves tres tablas. Toca una para elegirla, o pide tres nuevas las veces que quieras.'],
  ], { type: 'tabla' }),
  pg(['The caller', 'El cantador'], [
    [`A new card is called every ${secs(pace('calm').secs)} on Calm, every ${pace('fiesta').secs} seconds on Fiesta and every ${pace('rapido').secs} seconds on Rapid.`, `Se canta una carta nueva cada ${secsEs(pace('calm').secs)} en Tranquilo, cada ${pace('fiesta').secs} segundos en Fiesta y cada ${pace('rapido').secs} segundos en Rápido.`],
    ['A bar under the card shows the time to the next call.', 'Una barra bajo la carta muestra el tiempo que falta para la siguiente.'],
  ], { type: 'cards', ids: [12] }),
  pg(['The canto', 'El canto'], [
    ['Easy: the card\'s name is shown together with the riddle.', 'Fácil: el nombre de la carta se muestra junto con la adivinanza.'],
    [`Classic: the riddle comes first and the name appears after ${secs(CLASSIC_REVEAL_SECS)}.`, `Clásico: primero va la adivinanza y el nombre aparece después de ${secsEs(CLASSIC_REVEAL_SECS)}.`],
    ['Pure: only the riddle, and the name stays hidden.', 'Puro: solo la adivinanza; el nombre queda oculto.'],
  ]),
  pg(['Marking', 'Marcar'], [
    ['When a called card is on your tabla, tap it. A bean drops on the picture.', 'Cuando una carta cantada está en tu tabla, tócala. Cae un frijol sobre la imagen.'],
    [`Each pace keeps the last few calls open: ${pace('calm').window} on Calm, ${pace('fiesta').window} on Fiesta, ${pace('rapido').window} on Rapid. The strip above your tabla shows them.`, `Cada ritmo mantiene abiertas las últimas cartas: ${pace('calm').window} en Tranquilo, ${pace('fiesta').window} en Fiesta, ${pace('rapido').window} en Rápido. La tira sobre tu tabla las muestra.`],
  ], { type: 'bean' }),
  pg(['Too late, too early', 'Muy tarde, muy pronto'], [
    ['If a card falls out of the open calls before you mark it, that picture is lost for the round and shows a cross. It can no longer be marked.', 'Si una carta sale de las abiertas antes de que la marques, esa imagen se pierde en la ronda y muestra una cruz. Ya no se puede marcar.'],
    [`Tapping a picture whose card has not been called yet costs ${-SCORE.wrong} points and buzzes.`, `Tocar una imagen cuya carta aún no se ha cantado cuesta ${-SCORE.wrong} puntos y suena un zumbido.`],
  ]),
  pg(['Hints', 'Pistas'], [
    [`Each round you have ${HINTS_PER_ROUND} hints. A hint lights up the picture on your tabla that matches the current call, or tells you it is not there, and shows the card's name.`, `En cada ronda tienes ${HINTS_PER_ROUND} pistas. Una pista ilumina la imagen de tu tabla que coincide con la carta actual, o te dice que no está, y muestra el nombre de la carta.`],
  ]),
  patPage('linea', ['Four in a row counts in any direction: four rows, four columns and two diagonals, ten lines in all.', 'Cuatro en línea cuenta en cualquier dirección: cuatro filas, cuatro columnas y dos diagonales, diez líneas en total.']),
  patPage('esquinas', ['Mark the top-left, top-right, bottom-left and bottom-right pictures.', 'Marca las imágenes de arriba a la izquierda, arriba a la derecha, abajo a la izquierda y abajo a la derecha.']),
  patPage('centro', ['Mark the 2 x 2 block in the middle of the tabla.', 'Marca el bloque de 2 x 2 en el centro de la tabla.']),
  patPage('marco', ['That is the twelve pictures along the edge; the four in the middle do not matter.', 'Son las doce imágenes del borde; las cuatro del centro no importan.']),
  patPage('llena', ['Every one of the 16 pictures needs a bean, so a single lost picture makes this pattern impossible for that tabla.', 'Las 16 imágenes necesitan un frijol, así que una sola imagen perdida hace imposible este patrón en esa tabla.']),
  patPage('sorpresa', ['One of the five patterns above is chosen at random at the start of each round, and shown at the top of the screen.', 'Al inicio de cada ronda se elige al azar uno de los cinco patrones anteriores y se muestra arriba en la pantalla.']),
  pg(['Shouting ¡Lotería!', 'Gritar ¡Lotería!'], [
    ['The ¡LOTERÍA! button is always on screen. When your pattern is complete it lights up and pulses.', 'El botón ¡LOTERÍA! siempre está en pantalla. Cuando tu patrón está completo se ilumina y pulsa.'],
    ['Press it before a computer player claims, and you win the round.', 'Púlsalo antes de que lo haga un jugador de la computadora y ganas la ronda.'],
    [`Pressing it when your pattern is not complete is a false claim: ${-SCORE.falseClaim} points are lost and the button is locked for ${secs(LOCKOUT_SECS)}.`, `Pulsarlo cuando tu patrón no está completo es una falsa alarma: pierdes ${-SCORE.falseClaim} puntos y el botón se bloquea ${secsEs(LOCKOUT_SECS)}.`],
  ]),
  pg(['Computer players', 'Jugadores de la computadora'], [
    ['You can play against 1 to 3 computer players, each with its own tabla, shown as a small grid under yours. They take a moment to react to every call, and sometimes miss one.', 'Puedes jugar contra 1 a 3 jugadores de la computadora, cada uno con su propia tabla, mostrada como una cuadrícula pequeña bajo la tuya. Tardan un momento en reaccionar a cada carta y a veces se les pasa una.'],
    [`Skill sets how fast they are: ${SKILLS.map((s) => s.en).join(', ')}. When a computer player completes the pattern it shouts after a short pause, so a quick human can still win.`, `El nivel define qué tan rápidos son: ${SKILLS.map((s) => s.es).join(', ')}. Cuando un jugador de la computadora completa el patrón grita tras una breve pausa, así que una persona rápida aún puede ganar.`],
  ]),
  pg(['Who wins', 'Quién gana'], [
    ['The first player to claim a completed pattern wins the round. If you and a computer complete on the same call, whoever claims first wins.', 'El primero en reclamar un patrón completo gana la ronda. Si tú y la computadora completan con la misma carta, gana quien reclame primero.'],
    ['If all the cards are called and nobody has a completed pattern, or no tabla can complete it any more, the round ends with no winner.', 'Si se cantan todas las cartas y nadie tiene un patrón completo, o ninguna tabla puede ya completarlo, la ronda termina sin ganador.'],
  ]),
  pg(['Scoring', 'Puntos'], [
    [`+${SCORE.bean} for each correct bean. ${SCORE.wrong} for a wrong tap. ${SCORE.falseClaim} for a false claim.`, `+${SCORE.bean} por cada frijol correcto. ${SCORE.wrong} por un toque errado. ${SCORE.falseClaim} por una falsa alarma.`],
    [`Winning a round gives ${SCORE.win} points plus ${SCORE.perCallSaved} for every card of the ${POOL} that was still uncalled when you claimed.`, `Ganar una ronda da ${SCORE.win} puntos más ${SCORE.perCallSaved} por cada carta de las ${POOL} que aún no se había cantado cuando reclamaste.`],
    ['Scores are only for bragging rights.', 'Los puntos son solo para presumir.'],
  ]),
  pg(['Two players', 'Dos jugadores'], [
    ['Put the phone between you. One tabla faces each player; the top one is turned around for the player across from you.', 'Pon el teléfono entre ustedes. Cada jugador tiene una tabla de frente; la de arriba está volteada para quien está al otro lado.'],
    ['Both play the same round with the same rules and press their own ¡LOTERÍA! button. There are no computer players in this mode.', 'Los dos juegan la misma ronda con las mismas reglas y pulsan su propio botón ¡LOTERÍA!. En este modo no hay jugadores de la computadora.'],
  ]),
  pg(['Caller mode', 'Modo cantador'], [
    ['Use the phone as the caller for a real table with real tablas. It shows and sings each card in turn, with a history of cards already called.', 'Usa el teléfono como cantador de una mesa real con tablas de verdad. Muestra y canta cada carta por turno, con un historial de las ya cantadas.'],
    ['Tap Next for the next card, or switch on Auto to call at a steady pace. All cards are in play, and Shuffle starts a fresh deck.', 'Toca Siguiente para la próxima carta, o activa Auto para cantar a ritmo constante. Entran todas las cartas, y Barajar empieza una baraja nueva.'],
  ]),
  pg(['Watch & Learn', 'Ver y aprender'], [
    ['The game plays a whole round by itself. For each call it THINKS (you try to guess the card first), then REVEALS the answer and the matching picture, then ACTS by dropping the bean.', 'El juego juega una ronda completa solo. En cada carta PIENSA (tú intentas adivinar primero), luego REVELA la respuesta y la imagen, y después ACTÚA poniendo el frijol.'],
    ['You can set the thinking time, pause at any moment and carry on, or leave at any time.', 'Puedes ajustar el tiempo para pensar, pausar en cualquier momento y seguir, o salir cuando quieras.'],
  ]),
  pg(['Themes and language', 'Estilos e idioma'], [
    ['Four looks are available in Settings: Fiesta, Night, Jade and Talavera.', 'En Ajustes hay cuatro estilos: Fiesta, Noche, Jade y Talavera.'],
    ['Español and English each change the caller, the riddles, every button and these pages.', 'Español e English cambian cada uno al cantador, las adivinanzas, todos los botones y estas páginas.'],
  ]),
];

// Pages by language: ABOUT.en / ABOUT.es etc.
const both = (src) => ({ en: lang(src, 0), es: lang(src, 1) });
export const ABOUT = both(ABOUT_SRC);
export const HOWTO = both(HOWTO_SRC);
export const RULES = both(RULES_SRC);
