// Match rules: rounds, who shoots, scoring. A round ends when every marble has left the ring. Pure functions over `m`.
import { createWorld } from './sim.js';

export function newMatch(cfg) {
  return {
    cfg: { mode: 'ai', opp: 0, rounds: 1, first: 0, watchA: 3, ...cfg }, round: 1, rounds: cfg.rounds ?? 1, scores: [0, 0], rp: [0, 0],
    turn: cfg.first ?? 0, first: cfg.first ?? 0, phase: 'aim', roundLog: [], over: null, shots: 0, roundInfo: null, got: [[], []], streak: 0,
  };
}
export function beginRound(m, w) {
  const fresh = createWorld();
  w.balls = fresh.balls; w.nextId = fresh.nextId; w.settled = true; w.shot = null; w.pre = null;
  m.rp = [0, 0]; m.got = [[], []]; m.first = (m.cfg.first + m.round - 1) % 2; m.turn = m.first; m.phase = 'aim'; m.roundInfo = null; m.streak = 0;
}
// Called with the outcome of a resolved shot. Returns true when the round is over.
export function afterShot(m, w, res) {
  m.rp[m.turn] += res.total; m.shots++;
  for (const g of res.got) m.got[m.turn].push(g.kind);
  const left = w.balls.some((b) => b.kind !== 'shooter' && b.mode === 'live');
  if (!left) return true;
  if (res.got.length >= 2 && !res.shooterLost) { m.streak++; m.bonus = true; } else { m.turn = 1 - m.turn; m.streak = 0; m.bonus = false; }
  return false;
}
export function scoreRound(m) {
  m.phase = 'score';
  m.roundInfo = { round: m.round, pts: m.rp.slice(), t: 0 };
  return m.roundInfo;
}
export function applyRound(m, info) {
  m.scores[0] += info.pts[0]; m.scores[1] += info.pts[1];
  m.roundLog.push({ round: info.round, pts: info.pts.slice() });
  if (m.round >= m.rounds) {
    if (m.scores[0] === m.scores[1]) { m.rounds++; m.round++; m.extra = true; }
    else m.over = { win: m.scores[0] > m.scores[1] ? 0 : 1, extra: !!m.extra };
  } else m.round++;
}
