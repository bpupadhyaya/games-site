// Learn: short quizzes whose right answers are computed by the real engine (rules.js), never typed in by hand.
import { countIn, minQty, probAtLeast } from './rules.js';
import { getLang, faceWord, bidWords } from './content.js';

const L = (en, es) => ({ en, es });
const bidOpt = (q, f) => ({ bid: [q, f] });
const numOpt = (n) => ({ num: n });
const txtOpt = (en, es) => ({ t: L(en, es) });

// legal(prev, q, f) with the engine's ladder
const legal = (prev, q, f, pal = false) => q >= minQty(prev, f, pal);

export const LESSONS = [
  {
    id: 'pacos', title: L('Counting with pacos', 'Contar con pacos'),
    qs: [
      { hand: [3, 1, 4, 1, 6], bidFace: 4, ask: L('You hold these dice. Counting pacos as wild, how many 4s do you hold?', 'Tienes estos dados. Contando los pacos como comodín, ¿cuántos cuatros tienes?'), opts: [numOpt(1), numOpt(3), numOpt(5)],
        correct: (q) => [1, 3, 5].indexOf(countIn(q.hand, 4, true)), why: L('One real 4 plus two pacos makes three.', 'Un cuatro de verdad más dos pacos suman tres.') },
      { hand: [2, 2, 1, 5, 6], bidFace: 1, ask: L('How many pacos do you hold when the bid is on pacos?', '¿Cuántos pacos tienes cuando la apuesta es de pacos?'), opts: [numOpt(1), numOpt(2), numOpt(3)],
        correct: (q) => [1, 2, 3].indexOf(countIn(q.hand, 1, true)), why: L('When the bid is on pacos only real ones count: just one.', 'Cuando se apuesta a pacos solo cuentan los unos de verdad: uno.') },
      { hand: [5, 5, 1, 2, 3], bidFace: 5, ask: L('The bid is "five 5s". How many 5s do you add to the count?', 'La apuesta es "cinco cincos". ¿Cuántos cincos aportas a la cuenta?'), opts: [numOpt(2), numOpt(3), numOpt(4)],
        correct: (q) => [2, 3, 4].indexOf(countIn(q.hand, 5, true)), why: L('Two 5s and one paco: three.', 'Dos cincos y un paco: tres.') },
    ],
  },
  {
    id: 'legal', title: L('Which bid is legal?', '¿Qué apuesta vale?'),
    qs: [
      { prev: [3, 4], ask: L('The bid is "three 4s". Which bid can you make next?', 'La apuesta es "tres cuatros". ¿Cuál puedes hacer ahora?'), opts: [bidOpt(3, 3), bidOpt(3, 5), bidOpt(2, 4), bidOpt(1, 1)],
        correct: (q) => q.opts.findIndex((o) => legal(q.prevB, o.bid[0], o.bid[1])), why: L('Same quantity needs a higher face: three 5s. Paco bids need at least half rounded up: two.', 'La misma cantidad pide una cara mayor: tres cincos. Los pacos piden al menos la mitad redondeada hacia arriba: dos.') },
      { prev: [4, 1], ask: L('The bid is "four pacos". What is the lowest next bid on an ordinary face?', 'La apuesta es "cuatro pacos". ¿Cuál es la apuesta común más baja que sigue?'), opts: [bidOpt(5, 2), bidOpt(8, 2), bidOpt(9, 2), bidOpt(4, 6)],
        correct: (q) => q.opts.findIndex((o) => legal(q.prevB, o.bid[0], o.bid[1])), why: L('Back from pacos you must bid double plus one: nine.', 'Al volver desde pacos hay que apostar el doble más uno: nueve.') },
      { prev: [5, 3], ask: L('The bid is "five 3s". What is the smallest bid on pacos?', 'La apuesta es "cinco treses". ¿Cuál es la apuesta de pacos más baja?'), opts: [bidOpt(2, 1), bidOpt(3, 1), bidOpt(4, 1), bidOpt(5, 1)],
        correct: (q) => q.opts.findIndex((o) => legal(q.prevB, o.bid[0], o.bid[1])), why: L('Half of five rounded up is three. Three is the smallest allowed.', 'La mitad de cinco redondeada hacia arriba es tres. Tres es lo mínimo permitido.') },
    ],
  },
  {
    id: 'odds', title: L('Reading the odds', 'Leer las probabilidades'),
    qs: [
      { total: 25, ask: L('25 dice are in play. About how many should show 3 (counting pacos)?', 'Hay 25 dados en juego. ¿Cuántos deberían mostrar 3 (contando pacos)?'), opts: [numOpt(4), numOpt(8), numOpt(13)], correct: () => 1, why: L('A third of 25 is about 8: one die in six is a 3 and one in six is a paco.', 'Un tercio de 25 es cerca de 8: un dado de seis es 3 y uno de seis es paco.') },
      { total: 25, ask: L('Is "thirteen 3s" likely with 25 dice and nothing else known?', '¿Es probable "trece treses" con 25 dados y sin otra información?'), opts: [txtOpt('Likely', 'Probable'), txtOpt('About 50-50', 'Cerca de 50-50'), txtOpt('Unlikely', 'Poco probable')],
        correct: () => (probAtLeast(25, 13, 1 / 3) < 0.2 ? 2 : probAtLeast(25, 13, 1 / 3) > 0.6 ? 0 : 1), why: L('Thirteen needs far more than the 8 expected: only a few percent of the time.', 'Trece pide mucho más que los 8 esperados: pasa pocas veces.') },
      { total: 5, ask: L('Only 5 dice remain and you hold none of a face. Is "two of it" likely?', 'Quedan solo 5 dados y no tienes ninguno de esa cara. ¿Es probable "dos de ella"?'), opts: [txtOpt('Likely', 'Probable'), txtOpt('About 50-50', 'Cerca de 50-50'), txtOpt('Unlikely', 'Poco probable')],
        correct: () => { const p = probAtLeast(5, 2, 1 / 3); return p > 0.6 ? 0 : p < 0.2 ? 2 : 1; }, why: L('With five dice a face (with pacos) shows about 1.7 times, so two is close to even.', 'Con cinco dados una cara (con pacos) sale unas 1,7 veces, así que dos está cerca de la mitad.') },
    ],
  },
  {
    id: 'dudo', title: L('Dudo or raise?', '¿Dudo o subo?'),
    qs: [
      { hand: [2, 3, 6, 6, 5], ask: L('There are 10 dice. The bid is "nine 4s". You hold no 4 and no paco. What do you do?', 'Hay 10 dados. La apuesta es "nueve cuatros". No tienes cuatros ni pacos. ¿Qué haces?'), opts: [txtOpt('Call Dudo!', '¡Cantar Dudo!'), txtOpt('Raise to ten 4s', 'Subir a diez cuatros'), txtOpt('Call Calzo', 'Cantar Calzo')], correct: () => 0, why: L('Nine of ten dice would need to be 4s or pacos: practically impossible.', 'Nueve de diez dados tendrían que ser cuatros o pacos: casi imposible.') },
      { hand: [4, 4, 1, 4, 2], ask: L('There are 10 dice. The bid is "four 4s". You hold three 4s and a paco. What do you do?', 'Hay 10 dados. La apuesta es "cuatro cuatros". Tienes tres cuatros y un paco. ¿Qué haces?'), opts: [txtOpt('Call Dudo!', '¡Cantar Dudo!'), txtOpt('Raise the bid', 'Subir la apuesta'), txtOpt('Pass', 'Pasar')], correct: () => 1, why: L('You already hold four of them, so the bid is true. Raising is safe, and dudo would cost you a die.', 'Ya tienes cuatro, así que la apuesta es cierta. Subir es seguro y dudar te costaría un dado.') },
      { hand: [6, 6, 3, 2, 2], ask: L('Bluffing: you hold two 6s. Which bid is the believable one when 15 dice are in play and the last bid was "five 3s"?', 'Farol: tienes dos seises. ¿Cuál apuesta se cree más con 15 dados en juego y la última apuesta fue "cinco treses"?'), opts: [bidOpt(6, 3), bidOpt(5, 6), bidOpt(9, 6)], correct: () => 1, why: L('"Five 6s" is easy to believe (you hold two) and just barely raises the bid.', '"Cinco seises" se cree fácil (tienes dos) y apenas sube la apuesta.') },
    ],
  },
  {
    id: 'calzo', title: L('Calzo and dice', 'Calzo y dados'),
    qs: [
      { ask: L('You call Calzo and the count is exactly the bid. What happens?', 'Cantas Calzo y la cuenta es justo la apuesta. ¿Qué pasa?'), opts: [txtOpt('You win a die back', 'Recuperas un dado'), txtOpt('The bidder loses a die', 'Quien apostó pierde un dado'), txtOpt('Nothing', 'Nada')], correct: () => 0, why: L('Exactly right wins you a die (never above five).', 'Acertar justo te da un dado (nunca más de cinco).') },
      { ask: L('You call Calzo and the count is one too high. What happens?', 'Cantas Calzo y la cuenta es uno más. ¿Qué pasa?'), opts: [txtOpt('You lose a die', 'Pierdes un dado'), txtOpt('The bidder loses a die', 'Quien apostó pierde un dado'), txtOpt('Nothing', 'Nada')], correct: () => 0, why: L('A wrong Calzo costs the caller a die. The bidder is never affected.', 'Un calzo errado le cuesta un dado a quien cantó. A quien apostó no le pasa nada.') },
      { ask: L('When may you call Calzo?', '¿Cuándo puedes cantar Calzo?'), opts: [txtOpt('Any time', 'Siempre'), txtOpt('While at least half the starting dice remain', 'Mientras quede al menos la mitad de los dados iniciales'), txtOpt('Only with one die', 'Solo con un dado')], correct: () => 1, why: L('Calzo gets too easy with few dice, so it is limited to the early and middle game.', 'Con pocos dados el calzo es muy fácil, así que se limita al inicio y al medio de la partida.') },
    ],
  },
  {
    id: 'palifico', title: L('Palifico', 'Palifico'),
    qs: [
      { ask: L('A player is first down to one die. What kind of round follows?', 'Un jugador se queda por primera vez con un dado. ¿Qué ronda sigue?'), opts: [txtOpt('A Palifico round', 'Una ronda palifico'), txtOpt('The game ends', 'Termina la partida'), txtOpt('Nothing changes', 'No cambia nada')], correct: () => 0, why: L('The next round is Palifico (unless only two players remain).', 'La ronda siguiente es palifico (salvo que queden solo dos jugadores).') },
      { ask: L('In a Palifico round, are pacos wild?', 'En una ronda palifico, ¿los pacos son comodín?'), opts: [txtOpt('Yes', 'Sí'), txtOpt('No', 'No')], correct: () => 1, why: L('No: only real dice of the bid face count.', 'No: solo cuentan los dados reales de la cara apostada.') },
      { prev: [2, 4], pal: true, ask: L('Palifico, the bid is "two 4s". Which bid is allowed?', 'Palifico, la apuesta es "dos cuatros". ¿Cuál vale?'), opts: [bidOpt(2, 5), bidOpt(3, 4), bidOpt(3, 1), bidOpt(2, 6)],
        correct: (q) => q.opts.findIndex((o) => legal(q.prevB, o.bid[0], o.bid[1], true)), why: L('The face is fixed: only more 4s.', 'La cara queda fija: solo más cuatros.') },
    ],
  },
].map((l) => ({ ...l, qs: l.qs.map((q) => { const prevB = q.prev ? { q: q.prev[0], f: q.prev[1] } : null; const x = { ...q, prevB }; return { ...x, ans: q.correct(x) }; }) }));

export const optLabel = (o) => {
  if (o.bid) return bidWords(o.bid[0], o.bid[1]);
  if (o.num !== undefined) return String(o.num);
  return o.t[getLang()] ?? o.t.en;
};
export const lText = (x) => x[getLang()] ?? x.en;
export { faceWord };
