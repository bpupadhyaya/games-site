// Match rules on top of the engine: rounds, pushes, strays, whose turn, the final count. Pure data + small functions.
//
// A side plays a ROUND at a time: 10 discs are slid one by one (a push). Discs that stopped short on the board are
// picked up and slid again (at most three pushes per round); any still short after the third push are out. Passed discs stay
// in their arch for the whole match. Sides alternate rounds. The count is scoreOf(stack) (sets of 20 plus arch values).
import { DISCS_PER_ROUND, MAX_PUSHES, scoreOf, setsOf, countOf } from './sim.js';

export const ROUNDS = { quick: 1, full: 3 };

export function newMatch(cfg) {
  const sides = cfg.mode === 'solo' ? 1 : 2;
  const rounds = cfg.rounds === 3 ? 3 : 1;
  return {
    cfg, sides, rounds,
    stack: Array.from({ length: sides }, () => [0, 0, 0, 0]),
    slid: Array(sides).fill(0),          // slides taken
    lost: Array(sides).fill(0),          // discs left short after the third push
    bestPush: Array(sides).fill(0),      // most points added by one slide
    round: 0, side: cfg.first ?? 0, push: 0, queue: DISCS_PER_ROUND, table: [],
    over: null, log: [],
  };
}
export const totals = (m) => m.stack.map(scoreOf);
export const setsFor = (m, side) => setsOf(m.stack[side]);
export const passedFor = (m, side) => countOf(m.stack[side]);
export const discsLeftInRound = (m) => m.queue;

// Record the outcome of one slide: caps = [{ lane, side }], table = discs now lying on the board.
// Returns { gained } for the current side (a stray knocked in counts for the sliding side: the discs are all its own).
export function applySlide(m, result) {
  const s = m.side, before = scoreOf(m.stack[s]);
  for (const c of result.caps) m.stack[s][c.lane]++;
  m.table = result.table;
  m.queue = Math.max(0, m.queue - 1);
  m.slid[s]++;
  const gained = scoreOf(m.stack[s]) - before;
  m.bestPush[s] = Math.max(m.bestPush[s], gained);
  return { gained, caps: result.caps.length };
}

// Called when the board has settled after a slide. Moves the match on and returns a short event:
//   { kind: 'next' }                          more discs in this push
//   { kind: 'again', n }                      strays picked up: n discs to slide again
//   { kind: 'round-end', lost, next: 'side'|'round'|'over' }
export function afterSlide(m) {
  if (m.queue > 0) return { kind: 'next' };
  const strays = m.table.length;
  if (strays > 0 && m.push < MAX_PUSHES - 1) {
    m.push++; m.queue = strays; m.table = [];
    return { kind: 'again', n: strays, push: m.push };
  }
  const lost = strays;
  m.lost[m.side] += lost; m.table = [];
  // next round of play
  if (m.sides === 2 && m.side === (m.cfg.first ?? 0)) {
    m.side = 1 - m.side; m.push = 0; m.queue = DISCS_PER_ROUND;
    return { kind: 'round-end', lost, next: 'side' };
  }
  m.round++;
  if (m.round >= m.rounds) {
    const t = totals(m);
    const win = m.sides === 1 ? 0 : t[0] > t[1] ? 0 : t[1] > t[0] ? 1 : -1;
    m.over = { win, a: t[0], b: t[1] ?? 0 };
    return { kind: 'round-end', lost, next: 'over' };
  }
  m.side = m.cfg.first ?? 0; m.push = 0; m.queue = DISCS_PER_ROUND;
  return { kind: 'round-end', lost, next: 'round' };
}
