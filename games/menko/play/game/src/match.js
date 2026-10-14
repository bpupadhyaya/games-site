// Match rules on top of the engine: hands, whose turn, lay-or-slam, the won piles, the final count. Pure.
import { makeFloor, addCard, deal, resolveSlam, layPoint, starsOf, DESIGNS } from './sim.js';

export const HAND = { quick: 5, full: 8 };

export function newMatch(cfg, rng) {
  const n = cfg.hand === 8 ? 8 : 5;
  const [h0, h1] = deal(rng, n);
  return {
    cfg, hands: [h0, h1], floor: makeFloor(), turn: cfg.first ?? 0, score: [0, 0], piles: [[], []], covers: [0, 0],
    turns: 0, over: null, log: [],
  };
}
// 'slam' when the floor holds a rival disc for the side to move, else 'lay'.
export const turnKind = (m) => (m.floor.cards.some((c) => c.side !== m.turn) ? 'slam' : 'lay');
export const cardsLeft = (m) => m.hands[0].length + m.hands[1].length;

export function playLay(m, hi, x, y, rng) {
  const side = m.turn, d = m.hands[side].splice(hi, 1)[0];
  const at = layPoint(m.floor, x, y);
  const c = addCard(m.floor, d, side, at.x, at.y, rng.next() * 6.283);
  m.turns++;
  return { kind: 'lay', side, card: c };
}

// Returns the slam result; the disc stays on the floor (or goes to the rival when it covered), flipped discs go to the
// slammer's pile and count their stars.
export function playSlam(m, hi, x, y, power, rng) {
  const side = m.turn, other = 1 - side, d = m.hands[side].splice(hi, 1)[0];
  const r = resolveSlam(m.floor, side, d, x, y, power, rng);
  const out = { kind: 'slam', side, design: d, power, aim: { x, y }, land: r.land, scatter: r.scatter, flips: [], cover: null, card: null, tried: r.tried };
  if (r.land.cover) {
    out.cover = r.land.cover;
    m.piles[other].push(d); m.score[other] += starsOf(d); m.covers[side]++;
  } else {
    const c = addCard(m.floor, d, side, r.land.x, r.land.y, rng.next() * 6.283);
    out.card = c;
    for (const f of r.flips) {
      const i = m.floor.cards.findIndex((q) => q.id === f.id);
      if (i < 0) continue;
      const fc = m.floor.cards[i];
      m.floor.cards.splice(i, 1);
      m.piles[side].push(fc.d); m.score[side] += starsOf(fc.d);
      out.flips.push({ ...f, card: fc });
    }
  }
  m.turns++;
  return out;
}
export function endTurn(m) {
  m.turn = 1 - m.turn;
  if (m.hands[0].length === 0 && m.hands[1].length === 0) {
    const [a, b] = m.score;
    m.over = { win: a > b ? 0 : b > a ? 1 : -1, a, b };
  }
  return m.over;
}
export const designName = (d) => DESIGNS[d].name;
