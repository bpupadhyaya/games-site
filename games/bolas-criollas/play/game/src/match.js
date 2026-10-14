// Bolas Criollas rules: ends, turn order, the mingo toss, scoring. Pure functions over the match object `m` and the world `w`.
//
// An end: the lead side tosses the mingo (it must settle between zoneA and zoneB), then the other side throws the first ball and the two
// sides alternate, four balls each, so the lead side throws last. Every ball of the side with the closest ball that is nearer to the
// mingo than the rival's best scores one point. The lead alternates every end.
import { COURT, gap, theMingo, live } from './sim.js';

export const BALLS_EACH = 4;
export const MINGO_ID = 0;

export function newMatch(cfg) {
  return {
    cfg, scores: [0, 0], end: 1, lead: cfg.lead ?? 0, turn: cfg.lead ?? 0, phase: 'mingo', hand: [BALLS_EACH, BALLS_EACH], thrown: 0, nextId: 1,
    mingoTries: 0, last: -1, endInfo: null, over: null, history: [],
  };
}

export function beginEnd(m, w) {
  w.balls = []; w.settled = true; w.still = 0;
  m.hand = [BALLS_EACH, BALLS_EACH]; m.thrown = 0; m.nextId = 1; m.mingoTries = 0; m.phase = 'mingo'; m.turn = m.lead; m.last = -1; m.endInfo = null;
}

// After the mingo settles: is it a legal toss?
export function judgeMingo(m, w) {
  const k = theMingo(w);
  if (!k || k.st === 'out') return { ok: false, msg: 'The mingo left the cancha. Toss it again.' };
  if (k.x < COURT.zoneA) return { ok: false, msg: 'The mingo is too short. It must finish in the marked zone.' };
  if (k.x > COURT.zoneB) return { ok: false, msg: 'The mingo is too long. It must finish in the marked zone.' };
  return { ok: true };
}

// Who throws next: sides alternate; a side with no balls left yields to the other; null when all balls are thrown.
export function whoNext(m) {
  const other = 1 - (m.last < 0 ? m.lead : m.last);
  if (m.hand[0] + m.hand[1] === 0) return null;
  if (m.hand[other] > 0) return other;
  return m.hand[1 - other] > 0 ? 1 - other : null;
}
// The first ball of an end is thrown by the side that did not toss the mingo.
export const firstThrower = (m) => 1 - m.lead;

// Rank every live ball by distance to the mingo and score the end.
export function scoreEnd(m, w) {
  const k = theMingo(w);
  if (!k) return { void: true, pts: 0, team: -1, text: 'The mingo is gone: no score this end.', rank: [] };
  const rank = w.balls.filter((b) => !b.k && live(b)).map((b) => ({ id: b.id, side: b.side, d: gap(b, k) })).sort((a, b) => a.d - b.d);
  if (!rank.length) return { void: false, pts: 0, team: -1, text: 'No ball finished on the cancha: no score.', rank };
  const best = rank[0], oppBest = rank.find((r) => r.side !== best.side);
  let pts = 0;
  if (!oppBest) pts = rank.filter((r) => r.side === best.side).length;
  else if (oppBest.d - best.d > 0.012) pts = rank.filter((r) => r.side === best.side && r.d < oppBest.d - 0.012).length;
  if (pts === 0) return { void: false, pts: 0, team: -1, text: 'Dead even: no score this end.', rank };
  return { void: false, pts, team: best.side, text: '', rank };
}

export function applyEnd(m, res) {
  if (res.pts > 0) m.scores[res.team] += res.pts;
  m.history.push({ end: m.end, pts: res.pts, team: res.team });
  if (m.scores[0] >= m.cfg.target || m.scores[1] >= m.cfg.target) {
    const win = m.scores[0] > m.scores[1] ? 0 : m.scores[1] > m.scores[0] ? 1 : res.team;
    m.over = { win, shutout: m.scores[1 - win] === 0 };
    m.phase = 'over';
    return;
  }
  m.end++; m.lead = 1 - m.lead;
}
