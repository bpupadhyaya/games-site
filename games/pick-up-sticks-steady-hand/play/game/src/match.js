// Match rules: heaps, turns, rounds, scores, the solo ladder and the daily heap. Pure functions over `m`.
import { createWorld } from './sim.js';

// The ladder: level 1..LEVELS. More sticks, a tighter heap, a smaller tolerance and a higher target as you climb.
export const LEVELS = 12;
export function ladderSpec(level) {
  const l = Math.max(1, Math.min(LEVELS, level)), n = Math.min(32, 12 + l * 2);
  return { n, tol: Math.round((10 - l * 0.45) * 10) / 10, spread: 172 - Math.min(30, l * 2.5), goalPct: Math.min(0.85, 0.35 + l * 0.04) };
}
export const DAILY_SPEC = { n: 26, tol: 6.5, spread: 168 };
export const VERSUS_SPEC = { n: 24, tol: 7, spread: 172 };

export function specFor(cfg) {
  if (cfg.mode === 'solo') return ladderSpec(cfg.level ?? 1);
  if (cfg.mode === 'daily') return DAILY_SPEC;
  return VERSUS_SPEC;
}
export function newHeap(cfg, seed) {
  const sp = specFor(cfg);
  return createWorld(seed, { n: sp.n, tol: sp.tol, spread: sp.spread });
}

export function newMatch(cfg) {
  const solo = cfg.mode === 'solo' || cfg.mode === 'daily';
  return {
    cfg: { mode: 'ai', opp: 0, rounds: 1, first: 0, watchA: 3, level: 1, ...cfg }, round: 1, rounds: solo ? 1 : cfg.rounds ?? 1, scores: [0, 0], rp: [0, 0],
    turn: solo ? 0 : cfg.first ?? 0, first: cfg.first ?? 0, phase: 'aim', roundLog: [], over: null, lifts: 0, roundInfo: null, got: [[], []],
    tool: [false, false], toolUses: [0, 0], strikes: 0, goal: 0, total: 0, faults: [0, 0], streak: 0,
  };
}
export function beginRound(m, w) {
  m.rp = [0, 0]; m.got = [[], []]; m.first = (m.cfg.first + m.round - 1) % 2; m.turn = m.cfg.mode === 'solo' || m.cfg.mode === 'daily' ? 0 : m.first;
  m.phase = 'aim'; m.roundInfo = null; m.tool = [false, false]; m.toolUses = [0, 0]; m.strikes = 0; m.streak = 0; m.faults = [0, 0];
  m.total = w.sticks.reduce((a, s) => a + ({ gold: 20, red: 10, jade: 5, indigo: 3, bamboo: 1 })[s.kind], 0);
  m.goal = m.cfg.mode === 'solo' ? Math.round(m.total * ladderSpec(m.cfg.level).goalPct) : 0;
}
// Called after a pull is closed. res = { outcome, stick }. Returns 'over' when the round is finished.
export function afterPull(m, w, res) {
  const side = m.turn, solo = m.cfg.mode === 'solo' || m.cfg.mode === 'daily';
  if (res.outcome === 'lifted') {
    const v = ({ gold: 20, red: 10, jade: 5, indigo: 3, bamboo: 1 })[res.stick.kind];
    m.rp[side] += v; m.got[side].push(res.stick.kind); m.lifts++; m.streak++;
    if (res.stick.kind === 'gold') m.tool[side] = true;
  } else if (res.outcome === 'fault') { m.faults[side]++; m.streak = 0; }
  else if (res.outcome === 'dropped') m.streak = 0;
  if (res.outcome === 'tool') { m.toolUses[side]++; return null; }
  if (!w.sticks.length) return 'over';
  if (solo) {
    if (res.outcome === 'fault') m.strikes++;
    if (m.cfg.mode === 'solo' && m.rp[0] >= m.goal) return 'over';
    if (m.strikes >= 3) return 'over';
    return null;
  }
  if (res.outcome !== 'lifted') m.turn = 1 - m.turn;
  return null;
}
export function scoreRound(m) {
  m.phase = 'score';
  m.roundInfo = { round: m.round, pts: m.rp.slice(), t: 0 };
  return m.roundInfo;
}
export function applyRound(m, info) {
  m.scores[0] += info.pts[0]; m.scores[1] += info.pts[1];
  m.roundLog.push({ round: info.round, pts: info.pts.slice() });
  const solo = m.cfg.mode === 'solo' || m.cfg.mode === 'daily';
  if (solo) { m.over = { win: m.cfg.mode === 'solo' ? (m.scores[0] >= m.goal ? 0 : 1) : 0, extra: false }; return; }
  if (m.round >= m.rounds) {
    if (m.scores[0] === m.scores[1]) { m.rounds++; m.round++; m.extra = true; }
    else m.over = { win: m.scores[0] > m.scores[1] ? 0 : 1, extra: !!m.extra };
  } else m.round++;
}
