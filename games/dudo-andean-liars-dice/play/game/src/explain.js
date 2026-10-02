// Think: a plain-language read of the table with exact probabilities (binomial over the hidden dice). The advice itself comes from the
// same decision code the Expert computer uses, without bluffing, so it is honest advice, not a peek at anyone's dice.
import { decide } from './ai.js';
import { bidProb, exactProb, totalDice, wildApplies, faceChance, countIn, prevBid } from './rules.js';
import { getLang, faceWord, bidWords } from './content.js';

const STUB = { next: () => 0.5, chance: () => false, int: () => 0, pick: (a) => a[0], range: (a) => a };
const es = () => getLang() === 'es';
export const pct = (p) => (p < 0.005 ? (es() ? 'menos del 1 %' : 'under 1%') : p > 0.995 ? (es() ? 'más del 99 %' : 'over 99%') : `${Math.round(p * 100)}${es() ? ' %' : '%'}`);
export const fmt1 = (x) => (Math.round(x * 10) / 10).toFixed(1);

// The facts about one bid from one hand: how many dice are in play, the expected count among all of them, what you hold, the exact chance.
export function oddsFor(st, hand, bid) {
  const total = totalDice(st), unknown = total - hand.length, wild = wildApplies(st, bid.f);
  const pf = faceChance(st, bid.f);
  const own = countIn(hand, bid.f, wild);
  return { total, unknown, own, need: Math.max(0, bid.q - own), expected: total * pf, hiddenExpected: unknown * pf, p: bidProb(st, hand, bid), pExact: exactProb(st, hand, bid), wild, pf };
}

function expectLine(st, hand, bid, o) {
  const w = faceWord(bid.f, 2);
  if (es()) {
    const base = bid.f === 1 ? `Entre los ${o.total} dados se esperan unos ${fmt1(o.expected)} ${w}` : o.wild ? `Entre los ${o.total} dados se esperan unos ${fmt1(o.expected)} ${w} (los pacos cuentan)` : `Entre los ${o.total} dados se esperan unos ${fmt1(o.expected)} ${w} (aquí los pacos no son comodín)`;
    return `${base}. Tú tienes ${o.own}; los otros ${o.unknown} están ocultos.`;
  }
  const base = bid.f === 1 ? `Among all ${o.total} dice about ${fmt1(o.expected)} should be pacos` : o.wild ? `Among all ${o.total} dice about ${fmt1(o.expected)} should show ${w} (pacos count too)` : `Among all ${o.total} dice about ${fmt1(o.expected)} should show ${w} (pacos are not wild here)`;
  return `${base}. You hold ${o.own}; the other ${o.unknown} are hidden.`;
}

export function advise(st, me) {
  const hand = st.players[me].hand;
  const d = decide(st, me, STUB, 3);
  const prev = prevBid(st);
  if (d.act === 'dudo' || d.act === 'calzo') {
    const o = oddsFor(st, hand, prev);
    const line1 = expectLine(st, hand, prev, o);
    if (d.act === 'dudo') {
      const head = es() ? '¡Canta Dudo!' : 'Call Dudo!';
      const why = es()
        ? `${line1} La apuesta de ${bidWords(prev.q, prev.f)} necesita ${o.need} más de los ocultos y solo es ${pct(o.p)} probable. Es más seguro dudar que subir.`
        : `${line1} The bid of ${bidWords(prev.q, prev.f)} needs ${o.need} more from the hidden dice and is only ${pct(o.p)} likely. Doubting is safer than raising.`;
      return { act: 'dudo', head, why, p: o.p };
    }
    const head = es() ? 'Canta Calzo' : 'Call Calzo';
    const why = es()
      ? `${line1} Hay un ${pct(o.pExact)} de que la cuenta sea exactamente ${prev.q}: vale la pena el riesgo.`
      : `${line1} The count is exactly ${prev.q} about ${pct(o.pExact)} of the time, which is worth the risk.`;
    return { act: 'calzo', head, why, p: o.pExact };
  }
  const bid = { q: d.q, f: d.f };
  const o = oddsFor(st, hand, bid);
  const head = es() ? `Apuesta ${bidWords(bid.q, bid.f)}` : `Bid ${bidWords(bid.q, bid.f)}`;
  const why = es()
    ? `${expectLine(st, hand, bid, o)} Para ${bidWords(bid.q, bid.f)} faltan ${o.need} de los ocultos: es ${pct(o.p)} probable.`
    : `${expectLine(st, hand, bid, o)} ${bidWords(bid.q, bid.f)} needs ${o.need} more from the hidden dice: ${pct(o.p)} likely.`;
  return { act: 'bid', q: bid.q, f: bid.f, head, why, p: o.p };
}

// A one-line statement for the current bid, shown in Watch & Learn when a computer plays.
export function describeMove(st, me, d) {
  const hand = st.players[me].hand, prev = prevBid(st);
  if (d.act === 'dudo') { const o = oddsFor(st, hand, prev); return { head: es() ? '¡Dudo!' : 'Dudo!', why: es() ? `Para esa mano la apuesta es solo ${pct(o.p)} probable.` : `From this cup the bid is only ${pct(o.p)} likely.` }; }
  if (d.act === 'calzo') { const o = oddsFor(st, hand, prev); return { head: 'Calzo', why: es() ? `Cree que la cuenta es justa (${pct(o.pExact)}).` : `It thinks the count is exact (${pct(o.pExact)}).` }; }
  const o = oddsFor(st, hand, { q: d.q, f: d.f });
  const bluff = o.own === 0 && o.p < 0.5;
  return { head: bidWords(d.q, d.f), why: es() ? `Tiene ${o.own} y la apuesta es ${pct(o.p)} probable${bluff ? ': un farol' : ''}.` : `It holds ${o.own}; the bid is ${pct(o.p)} likely${bluff ? ': a bluff' : ''}.` };
}
