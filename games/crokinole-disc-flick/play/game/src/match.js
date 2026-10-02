// Match rules: whose turn it is, how a round is scored, when the match ends. Pure functions over the match
// record `m` and the physics world `w`; the engine (sim.js) never knows about rounds.
import { tally, tidy } from './sim.js';

export const PER_SIDE = 8;

export function newMatch(cfg) {
  return {
    cfg, round: 1, rounds: cfg.rounds, scores: [0, 0], hand: [PER_SIDE, PER_SIDE], first: cfg.first ?? 0, turn: cfg.first ?? 0,
    phase: 'aim', shots: 0, roundLog: [], over: null, roundInfo: null, lastNote: '',
  };
}

export function beginRound(m, w) {
  w.discs = []; w.settled = true; w.shot = null;
  m.hand = [PER_SIDE, PER_SIDE];
  m.first = (m.cfg.first + m.round - 1) % 2;
  m.turn = m.first; m.phase = 'aim'; m.roundInfo = null; m.lastNote = '';
}

export function anyRivals(w, side) { return w.discs.some((d) => d.team !== side && d.mode === 'live'); }

// A shot has settled and been resolved: count it and pass the turn. Returns true when the round is over.
export function afterShot(m, w) {
  m.hand[m.turn]--; m.shots++;
  tidy(w);
  if (m.hand[0] === 0 && m.hand[1] === 0) return true;
  const next = 1 - m.turn;
  m.turn = m.hand[next] > 0 ? next : m.turn;
  m.phase = 'aim';
  return false;
}

// Score the finished round: every disc counts for its side by where it lies; discs dropped in the pocket count 20.
export function scoreRound(m, w) {
  const t = tally(w);
  const info = { pts: t.pts, pockets: t.pockets, round: m.round, t: 0 };
  m.phase = 'score'; m.roundInfo = info;
  return info;
}

export function applyRound(m, info) {
  m.scores[0] += info.pts[0]; m.scores[1] += info.pts[1];
  m.roundLog.push({ round: m.round, pts: info.pts.slice() });
  if (m.round >= m.rounds && m.scores[0] !== m.scores[1]) {
    m.over = { win: m.scores[0] > m.scores[1] ? 0 : 1, extra: m.round > m.cfg.rounds };
    m.phase = 'over';
    return;
  }
  m.round++;
  if (m.round > m.rounds) m.rounds = m.round;   // level after the last round: one more round (a tie-break)
}
