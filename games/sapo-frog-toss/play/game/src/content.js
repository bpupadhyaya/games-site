// Every word the player reads outside the play screen, in English and Spanish (never mixed: the language is a named choice).
// Rules text is cross-checked against engine.js and phys.js (the numbers come from there where they are used in code).
import { HOLES, A } from './phys.js';
import { DISCS, CLOSEST_BONUS, LENGTHS } from './engine.js';
import { pick } from './i18n.js';

const v = (id) => HOLES.find((h) => h.id === id).v;
const MOUTH_V = v('mouth'), MILL_V = v('mill'), BRIDGE_V = v('bridgeL'), SIDE_V = v('sideL'), CORNER_V = v('cornerL');

export const ABOUT = [
  { title: { en: 'Sapo', es: 'Sapo' }, p: [
    { en: 'Sapo (the toad) is a classic tavern and garden game of Peru, Chile, Argentina and their neighbours. Players toss metal discs, the fichas, at a wooden table with holes and a brass frog with an open mouth. The frog\'s mouth pays the most.', es: 'El sapo (también llamado rana) es un juego clásico de tabernas y jardines de Perú, Chile, Argentina y países vecinos. Se lanzan fichas de metal hacia una mesa de madera con agujeros y una rana de bronce con la boca abierta. La boca de la rana es el premio mayor.' },
    { en: 'Tables differ from place to place: the names, the number of holes and the points of each hole vary. This game uses one table with the values printed on it, and its rules are written on the Rules pages.', es: 'Las mesas cambian según el lugar: los nombres, el número de agujeros y los puntos de cada uno varían. Este juego usa una mesa con los valores impresos, y sus reglas están en las páginas de Reglas.' },
  ] },
  { title: { en: 'This version', es: 'Esta versión' }, p: [
    { en: 'You throw from behind a line and watch the disc fly, bounce, clink and skid across the table. It is a game of score only: there are no stakes of any kind.', es: 'Lanzas desde detrás de una línea y ves la ficha volar, rebotar, tintinear y deslizarse por la mesa. Es un juego solo de puntos: no hay apuestas de ningún tipo.' },
    { en: 'Play against the computer at five levels, with a friend on one device, watch two computer players with explanations, or follow six short lessons.', es: 'Juega contra la computadora en cinco niveles, con un amigo en el mismo dispositivo, mira a dos jugadores de la computadora con explicaciones, o sigue seis lecciones cortas.' },
  ] },
  { title: { en: 'Language', es: 'Idioma' }, p: [
    { en: 'The whole game is available in English and in Spanish. Choose "Play in English" or "Jugar en español" on the main menu or in Settings.', es: 'Todo el juego está disponible en español y en inglés. Elige "Jugar en español" o "Play in English" en el menú principal o en Ajustes.' },
  ] },
];

export const HOWTO = [
  { title: { en: 'The goal', es: 'El objetivo' }, art: 'table', p: [
    { en: `Toss discs onto the table. A disc that drops into a hole scores the number printed beside it: the frog's mouth is worth ${MOUTH_V}. Whoever has more points after the last round wins.`, es: `Lanza fichas a la mesa. Una ficha que cae en un agujero suma el número impreso a su lado: la boca de la rana vale ${MOUTH_V}. Gana quien tenga más puntos tras la última ronda.` },
  ] },
  { title: { en: 'Throwing', es: 'Lanzar' }, p: [
    { en: 'Put a finger anywhere in the lower part of the screen and drag DOWN, as if pulling the disc back. A ring on the table shows where the disc will land. Drag further for a longer throw and sideways to aim: pulling to the left aims to the right. Let go to throw. Drag back to where you started to cancel.', es: 'Pon un dedo en la parte baja de la pantalla y arrastra HACIA ABAJO, como si echaras la ficha hacia atrás. Un anillo en la mesa muestra dónde caerá. Arrastra más para un tiro más largo y de lado para apuntar: tirar a la izquierda apunta a la derecha. Suelta para lanzar. Vuelve al punto de inicio para cancelar.' },
    { en: 'Under the table, Lob and Drive set the kind of throw, and the five arrows set the spin. Think suggests a throw. Throw sends the disc with the ring as it is.', es: 'Bajo la mesa, Alto y Rasante eligen el tipo de tiro, y las cinco flechas el efecto. Pensar sugiere un tiro. Lanzar envía la ficha con el anillo tal como está.' },
  ] },
  { title: { en: 'Rounds', es: 'Rondas' }, p: [
    { en: `A round is ${DISCS} discs for each side, thrown one at a time, taking turns. Discs that stay on the table can be knocked away by the next throw. At the end of the round the loose disc nearest the frog's mouth earns ${CLOSEST_BONUS} bonus points.`, es: `Una ronda son ${DISCS} fichas por lado, lanzadas de una en una, por turnos. Las fichas que quedan en la mesa pueden ser sacadas por el siguiente tiro. Al final de la ronda, la ficha suelta más cercana a la boca de la rana gana ${CLOSEST_BONUS} puntos de bonificación.` },
  ] },
  { title: { en: 'Other ways to play', es: 'Otras formas de jugar' }, p: [
    { en: 'Two Players shares one device. Watch & Learn shows two computer players, explains each throw, and has a real Pause. Learn has six lessons that are always free.', es: 'Dos jugadores comparten un dispositivo. Mirar y aprender muestra a dos jugadores de la computadora, explica cada tiro y tiene una pausa real. Aprender tiene seis lecciones siempre gratis.' },
    { en: 'Text size goes up to 300% on every text screen (A+ on the Rules pages, or in Settings).', es: 'El tamaño del texto llega al 300% en cada pantalla de texto (A+ en las páginas de Reglas, o en Ajustes).' },
  ] },
];

export const RULES = [
  { title: { en: 'The table', es: 'La mesa' }, art: 'table', p: [
    { en: `The playing surface is a square wooden top, with eight holes and a brass frog at the back. The back board stops discs at the far end. The sides and the front edge are open: a disc that slides over them falls to the floor and is out of play.`, es: `La superficie de juego es una tapa de madera cuadrada, con ocho agujeros y una rana de bronce al fondo. El tablero trasero detiene las fichas al fondo. Los lados y el borde delantero están abiertos: una ficha que los pasa cae al suelo y sale del juego.` },
    { en: `The frog's body is a low bumper: a disc that hits it bounces off, and nothing can land on it or behind it. The mouth hole sits in front of the frog, so a disc that strikes the frog can bounce back into the mouth.`, es: `El cuerpo de la rana es un tope bajo: una ficha que lo toca rebota, y nada puede caer sobre él ni detrás. El agujero de la boca está delante de la rana, así que una ficha que golpea a la rana puede rebotar hacia la boca.` },
  ] },
  { title: { en: 'The holes and their points', es: 'Los agujeros y sus puntos' }, art: 'table', p: [
    { en: `Frog's mouth: ${MOUTH_V}. The mill (the small hole with the turning pinwheel): ${MILL_V}. The two bridges at the front: ${BRIDGE_V} each. The two side holes: ${SIDE_V} each. The two back corner holes: ${CORNER_V} each.`, es: `Boca de la rana: ${MOUTH_V}. El molino (el agujero pequeño con la rueda giratoria): ${MILL_V}. Los dos puentes delanteros: ${BRIDGE_V} cada uno. Los dos agujeros laterales: ${SIDE_V} cada uno. Los dos agujeros traseros: ${CORNER_V} cada uno.` },
    { en: 'These values are this game\'s own table. Real tables vary, so the values are always painted beside each hole.', es: 'Estos valores son los de la mesa de este juego. Las mesas reales varían, por eso los valores están pintados junto a cada agujero.' },
  ] },
  { title: { en: 'A disc drops in', es: 'Cuando una ficha cae' }, p: [
    { en: `A disc drops into a hole as soon as its centre is over the hole, whether it lands there, skids into it, or is knocked in. It scores at once and leaves the table. The points go to the side that threw that disc, even if another disc knocked it in.`, es: `Una ficha cae en un agujero en cuanto su centro está sobre él, ya sea que aterrice allí, se deslice o sea empujada. Suma de inmediato y sale de la mesa. Los puntos son del lado que lanzó esa ficha, aunque otra ficha la haya empujado.` },
    { en: 'A disc that lands on the rim of a hole without its centre over it bounces or skids on.', es: 'Una ficha que cae en el borde de un agujero sin su centro encima rebota o se desliza.' },
  ] },
  { title: { en: 'The throw: aim, lob or drive', es: 'El tiro: puntería, alto o rasante' }, art: 'styles', p: [
    { en: 'You choose where the disc first touches the table (the ring), the kind of throw and the spin. Lob is a high, slow arc: the disc lands steeply and stays close to where it touched. Drive is a low, fast throw: it skids on a little further after it lands, and it can strike the back board or the frog.', es: 'Eliges dónde toca la mesa por primera vez la ficha (el anillo), el tipo de tiro y el efecto. Alto es un arco alto y lento: la ficha cae empinada y se queda cerca de donde tocó. Rasante es un tiro bajo y rápido: se desliza un poco más tras caer y puede golpear el tablero trasero o la rana.' },
    { en: 'The disc bounces a few times and loses speed each time. The dotted line on the table marks the first touch; the small cross shows where a disc thrown without wobble would stop on an empty table.', es: 'La ficha rebota varias veces y pierde velocidad en cada una. La línea de puntos marca el primer contacto; la crucecita muestra dónde se detendría una ficha sin temblor en una mesa vacía.' },
  ] },
  { title: { en: 'Spin', es: 'Efecto' }, p: [
    { en: 'Spin has five settings: strong left, left, none, right, strong right. A spun disc curves a little to that side as it skids and kicks sideways when it bounces. The effect is small and is used to curve around the frog or a loose disc.', es: 'El efecto tiene cinco ajustes: fuerte izquierda, izquierda, ninguno, derecha, fuerte derecha. Una ficha con efecto se curva un poco hacia ese lado al deslizarse y salta de lado al rebotar. El efecto es pequeño y sirve para rodear la rana o una ficha suelta.' },
  ] },
  { title: { en: 'Your wobble', es: 'Tu temblor' }, p: [
    { en: 'No hand is perfect. Every throw lands a little off the ring, more so the further it goes. Aim steadiness (in the match setup or Settings) sets how much: Steady, Natural or Wobbly. The computer players have their own wobble, smaller at the higher levels.', es: 'Ninguna mano es perfecta. Cada tiro cae un poco fuera del anillo, más cuanto más lejos va. La firmeza de puntería (en la preparación de la partida o en Ajustes) fija cuánto: Firme, Natural o Tembloroso. Los jugadores de la computadora tienen su propio temblor, menor en los niveles altos.' },
  ] },
  { title: { en: 'Discs on the table', es: 'Fichas en la mesa' }, art: 'closest', p: [
    { en: 'A disc that comes to rest on the table stays there for the rest of the round. Later discs can hit it: a hit moves both discs, and a disc pushed over an edge is out; a disc pushed into a hole scores for its owner.', es: 'Una ficha que se detiene en la mesa se queda allí el resto de la ronda. Las fichas siguientes pueden golpearla: el golpe mueve ambas fichas, una ficha empujada sobre un borde sale del juego y una empujada a un agujero suma para su dueño.' },
    { en: 'Discs of the two sides have different colours: gold with a green ring, and silver with a red ring.', es: 'Las fichas de los dos lados tienen distinto color: doradas con anillo verde y plateadas con anillo rojo.' },
  ] },
  { title: { en: 'The Closest bonus', es: 'La bonificación de cercanía' }, art: 'closest', p: [
    { en: `When all ${DISCS * 2} discs of a round have been thrown, the loose disc whose centre is nearest to the centre of the frog's mouth wins ${CLOSEST_BONUS} bonus points for its owner. Discs that dropped in a hole or left the table do not count. If no disc is left on the table, nobody gets the bonus. Then the table is cleared.`, es: `Cuando se han lanzado las ${DISCS * 2} fichas de una ronda, la ficha suelta cuyo centro esté más cerca del centro de la boca de la rana gana ${CLOSEST_BONUS} puntos de bonificación para su dueño. Las fichas que cayeron en un agujero o salieron de la mesa no cuentan. Si no queda ninguna ficha en la mesa, nadie recibe la bonificación. Luego se limpia la mesa.` },
  ] },
  { title: { en: 'Rounds and winning', es: 'Rondas y victoria' }, p: [
    { en: `${LENGTHS.map((l) => `${l.en}: ${l.rounds} rounds`).join('; ')}. In every round each side throws ${DISCS} discs, one at a time and alternately. The side that threw first in a round throws second in the next. After the last round the side with more points wins. Equal points are a draw.`, es: `${LENGTHS.map((l) => `${l.es}: ${l.rounds} rondas`).join('; ')}. En cada ronda cada lado lanza ${DISCS} fichas, una a una y por turnos. El lado que lanzó primero en una ronda lanza segundo en la siguiente. Tras la última ronda gana el lado con más puntos. Con puntos iguales hay empate.` },
  ] },
  { title: { en: 'The computer players', es: 'Los jugadores de la computadora' }, p: [
    { en: 'Five levels: Novice, Regular, Skilled, Veteran and Master. Each plays on the same physics as you, tests throws before it chooses, and has a steadier hand than the level below. Novice only aims at the easier holes; Regular picks the best-paying hole; Skilled reads the loose discs; Veteran and Master also knock your discs away and play for the Closest bonus. Each level beats the one below more often than not.', es: 'Cinco niveles: Principiante, Aficionado, Experto, Veterano y Maestro. Cada uno juega con la misma física que tú, prueba tiros antes de elegir y tiene la mano más firme que el nivel anterior. El Principiante solo apunta a los agujeros fáciles; el Aficionado elige el agujero que más paga; el Experto lee las fichas sueltas; el Veterano y el Maestro también sacan tus fichas y juegan por la bonificación. Cada nivel gana al anterior más veces de las que pierde.' },
  ] },
  { title: { en: 'Think, Watch & Learn, Lessons', es: 'Pensar, Mirar y aprender, Lecciones' }, p: [
    { en: 'Think tests many throws on the real table, then shows the best one as a line and a ring with the reason, such as the average points over test throws with your own wobble. Use this line puts it in place.', es: 'Pensar prueba muchos tiros en la mesa real y muestra el mejor como una línea y un anillo con la razón, por ejemplo los puntos de media en tiros de prueba con tu propio temblor. Usar esta jugada la coloca.' },
    { en: 'Watch & Learn plays two computer players. It thinks (2 to 10 seconds, your choice in Settings), reveals the plan with the reason, then throws. Pause freezes everything exactly where it is. The six lessons are always free.', es: 'Mirar y aprender juega con dos jugadores de la computadora. Piensa (de 2 a 10 segundos, a tu elección en Ajustes), muestra el plan con la razón y lanza. La pausa congela todo exactamente donde está. Las seis lecciones son siempre gratis.' },
  ] },
  { title: { en: 'Controls', es: 'Controles' }, p: [
    { en: 'Touch: drag down in the lower part of the screen, release to throw. Keyboard: Left and Right aim, Up and Down change the distance, A and D change the spin, S switches Lob and Drive, H is Think, Space or Enter throws, P pauses, plus and minus change the text size.', es: 'Táctil: arrastra hacia abajo en la parte baja de la pantalla y suelta para lanzar. Teclado: Izquierda y Derecha apuntan, Arriba y Abajo cambian la distancia, A y D cambian el efecto, S alterna Alto y Rasante, H es Pensar, Espacio o Enter lanza, P pausa, más y menos cambian el tamaño del texto.' },
  ] },
];

export const LESSONS = [
  { title: { en: 'Aim and land', es: 'Apunta y cae' }, tries: 6, goal: { kind: 'rest', n: 2 }, table: [],
    text: { en: 'Drag down in the lower part of the screen: the further you pull, the further the disc goes, and the ring shows where it lands. Get 2 discs to stay on the table (not in a hole, not off the edge).', es: 'Arrastra hacia abajo en la parte baja: cuanto más tiras, más lejos va la ficha, y el anillo muestra dónde cae. Logra que 2 fichas se queden en la mesa (no en un agujero, no fuera del borde).' } },
  { title: { en: 'Any hole', es: 'Cualquier agujero' }, tries: 8, goal: { kind: 'hole', n: 1 }, table: [],
    text: { en: `Drop one disc into any hole. The bridges at the front are the easiest (${BRIDGE_V} points). Aim the ring right over the hole.`, es: `Mete una ficha en cualquier agujero. Los puentes delanteros son los más fáciles (${BRIDGE_V} puntos). Pon el anillo justo sobre el agujero.` } },
  { title: { en: 'The mill', es: 'El molino' }, tries: 10, goal: { kind: 'hole', n: 1, ids: ['mill'] }, table: [],
    text: { en: `The small hole with the turning pinwheel is worth ${MILL_V}. Aim the ring over it. Use Think if you want to see the best throw.`, es: `El agujero pequeño con la rueda giratoria vale ${MILL_V}. Pon el anillo sobre él. Usa Pensar si quieres ver el mejor tiro.` } },
  { title: { en: 'Lob and drive', es: 'Alto y rasante' }, tries: 10, goal: { kind: 'hole', n: 1, style: 1 }, table: [],
    text: { en: 'Switch to Drive (low and fast: it skids on after landing) and drop a disc into any hole. The skid means you land short of the hole you want.', es: 'Cambia a Rasante (bajo y rápido: se desliza tras caer) y mete una ficha en cualquier agujero. El deslizamiento hace que caigas antes del agujero que quieres.' } },
  { title: { en: 'Spin', es: 'Efecto' }, tries: 10, goal: { kind: 'hole', n: 1, spin: true }, table: [],
    text: { en: 'Use the spin arrows (left or right) and drop a disc into any hole with a spin set. Spin pulls the disc a little to its side, so aim the other way.', es: 'Usa las flechas de efecto (izquierda o derecha) y mete una ficha en cualquier agujero con efecto puesto. El efecto tira la ficha un poco a su lado, así que apunta al otro.' } },
  { title: { en: 'Knock it away', es: 'Sácala de la mesa' }, tries: 8, goal: { kind: 'knock' }, table: [{ owner: 1, x: 0.0, z: 0.44 }],
    text: { en: 'A silver disc sits in front of the frog\'s mouth. Hit it so that it leaves the table or drops into a hole. A Drive hits harder than a Lob.', es: 'Una ficha plateada está delante de la boca de la rana. Golpéala para que salga de la mesa o caiga en un agujero. Un Rasante golpea más fuerte que un Alto.' } },
];
export const lessonText = (i) => ({ title: pick(LESSONS[i].title), text: pick(LESSONS[i].text) });
export { A };
