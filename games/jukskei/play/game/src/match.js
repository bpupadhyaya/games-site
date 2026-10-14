// The match: rounds of four pins a side, thrown alternately at one stake. Pure rules, no drawing. game.js owns the flow.
import { PINS_EACH, throwPoints, bonusTeam, nearestByTeam, setWind, PITCHES } from './sim.js';

export function newMatch(cfg) {
  return {
    cfg, round: 1, phase: 'idle', turn: 0, first: cfg.lead ?? 0, left: [PINS_EACH, PINS_EACH], thrown: 0, nextId: 1,
    scores: [0, 0], roundPts: [0, 0], log: [], throwLog: [], over: null, last: null, roundInfo: null,
  };
}
// the extra rounds when the match is level after the last scheduled round (at most three)
export const maxRounds = (m) => m.cfg.rounds + 3;

export function beginRound(m, w, rng) {
  w.pins = []; w.settled = true; w.flying = -1;
  w.stake.fallen = false; w.stake.fallenBy = -1;
  m.left = [PINS_EACH, PINS_EACH]; m.thrown = 0; m.roundPts = [0, 0]; m.last = null; m.roundInfo = null; m.throwLog = [];
  m.first = (m.cfg.lead + (m.round - 1)) % 2;
  m.turn = m.first;
  m.phase = 'aim';
  newWind(w, rng);
}
// a gust walk: each throw the wind drifts a little around the pitch's own strength
export function newWind(w, rng) {
  const [lo, hi] = w.pitch.wind;
  setWind(w, lo + rng.next() * (hi - lo), (rng.next() - 0.5) * Math.PI * 1.7 + (rng.next() < 0.5 ? 0 : Math.PI * 0.15));
}
export function driftWind(w, rng) {
  const [lo, hi] = w.pitch.wind;
  const speed = Math.max(lo * 0.6, Math.min(hi * 1.15, w.wind.speed + (rng.next() - 0.5) * (hi - lo) * 0.5));
  const dir = w.wind.dir + (rng.next() - 0.5) * 0.7;
  setWind(w, speed, dir);
}

export function whoNext(m) {
  if (m.left[0] === 0 && m.left[1] === 0) return -1;
  const k = m.thrown;
  const t = (m.first + k) % 2;
  if (m.left[t] > 0) return t;
  return m.left[1 - t] > 0 ? 1 - t : -1;
}

// Score the pin that just came to rest. Returns { pts, kind, d }.
export function judgeThrow(m, w, pin) {
  const r = throwPoints(w, pin);
  m.roundPts[pin.team] += r.pts;
  m.last = { team: pin.team, ...r, id: pin.id };
  return r;
}

// All eight pins are down: the nearest-pin bonus, then the round line.
export function scoreRound(m, w) {
  const bt = bonusTeam(w), near = nearestByTeam(w);
  const bonus = bt >= 0 ? 1 : 0;
  const pts = [m.roundPts[0], m.roundPts[1]];
  if (bt >= 0) pts[bt] += 1;
  return { pts, bonusTeam: bt, bonus, near, base: [m.roundPts[0], m.roundPts[1]] };
}
export function applyRound(m, info) {
  m.scores[0] += info.pts[0]; m.scores[1] += info.pts[1];
  m.log.push({ round: m.round, pts: info.pts, bonusTeam: info.bonusTeam });
  const done = m.round >= m.cfg.rounds;
  if (done && m.scores[0] !== m.scores[1]) m.over = { win: m.scores[0] > m.scores[1] ? 0 : 1, margin: Math.abs(m.scores[0] - m.scores[1]) };
  else if (m.round >= maxRounds(m)) m.over = { win: m.scores[0] >= m.scores[1] ? 0 : 1, margin: 0, draw: m.scores[0] === m.scores[1] };
  else m.round++;
}
export { PITCHES };
