// A match = several pulls. Bracket (three rounds, each best of three, each on a different ground), quick, versus (two players), daily and watch.
import { TEAMS, SETTINGS } from './teams.js';
import { levelById } from './sim.js';

export const ROUND_NAMES = ['Quarter-final', 'Semi-final', 'Final'];

// cfg: { kind, level (1-4 for the bracket's difficulty), setting, rival }
export function newMatch(cfg, rng) {
  const kind = cfg.kind;
  let rounds;
  if (kind === 'bracket') {
    const base = Math.max(1, Math.min(4, cfg.level || 2));
    const pool = rng.shuffle(TEAMS.filter((t) => t.id !== cfg.avoid));
    const picks = [];
    for (const t of pool) { if (picks.length < 2 && !picks.some((p) => p.home === t.home)) picks.push(t); }
    const lions = TEAMS.find((t) => t.id === 'lions');
    picks.push(lions);
    rounds = picks.map((t, i) => ({ rival: t.id, setting: i === 2 ? 'grand' : t.home, level: Math.min(5, base + i), label: ROUND_NAMES[i] }));
  } else if (kind === 'daily') {
    const t = TEAMS[rng.int(TEAMS.length)];
    rounds = [{ rival: t.id, setting: SETTINGS[rng.int(SETTINGS.length)].id, level: 2 + rng.int(3), label: 'Daily Pull' }];
  } else if (kind === 'versus') {
    rounds = [{ rival: cfg.rival || 'oxen', setting: cfg.setting || 'harvest', level: 3, label: 'Two players' }];
  } else {
    const t = cfg.rival ? TEAMS.find((x) => x.id === cfg.rival) : TEAMS[rng.int(TEAMS.length)];
    rounds = [{ rival: t.id, setting: cfg.setting || t.home, level: cfg.level || 2, label: kind === 'watch' ? 'Watch & Learn' : 'Quick match' }];
  }
  const single = kind === 'daily' || kind === 'watch';
  return { kind, rounds, round: 0, pull: 0, wins: [0, 0], need: single ? 1 : 2, done: false, champion: false, history: [], stats: { perfect: 0, heaves: 0, bestStreak: 0, blocked: 0, pulls: 0, bestMargin: 0 }, carry: null };
}
export const curRound = (M) => M.rounds[M.round];
export const rivalLevel = (M) => levelById(curRound(M).level);

// options for the next pull's createPull
export function pullOpts(M) {
  const r = curRound(M);
  const stam = M.pull === 0 ? [1, 1] : [Math.min(1, 0.85 + 0.05 * M.wins[0]), Math.min(1, 0.85 + 0.05 * M.wins[1])];
  return { mode: M.kind === 'versus' ? 'versus' : 'solo', level: r.level, stam };
}

// record a finished pull; returns 'pull' (more pulls in this round), 'round' (round won, next round follows) or 'match' (match over)
export function recordPull(M, s) {
  const w = s.winner === 'a' ? 0 : 1;
  M.wins[w]++; M.pull++;
  const st = M.stats;
  st.perfect += s.a.perfect; st.heaves += s.a.heaves; st.bestStreak = Math.max(st.bestStreak, s.a.bestStreak); st.blocked += s.a.blocked; st.pulls++;
  if (w === 0) st.bestMargin = Math.max(st.bestMargin, s.maxLead);
  M.history.push({ round: M.round, winner: w, dur: s.dur, why: s.why, x: s.x });
  if (M.wins[w] >= M.need) {
    if (w === 0 && M.kind === 'bracket' && M.round < M.rounds.length - 1) return 'round';
    M.done = true; M.champion = w === 0 && (M.kind !== 'bracket' || M.round === M.rounds.length - 1);
    return 'match';
  }
  return 'pull';
}
export function nextRound(M) { M.round++; M.pull = 0; M.wins = [0, 0]; }
