// The game around the plays: score, quarters, clock, downs and distance, possession, kicks, tries. Pure and deterministic.
// Offence position is `yl`: yards from the offence's own goal line (0..40; 40 = the opponent's goal line).
import { FIELD, T, QUARTER_SECS, LEVELS } from './consts.js';
import { makeTeams, newActors, newPlay } from './sim.js';
import { attackDir, zOfYl, clamp } from './geo.js';

export const FG_MAX_KICK = 33;           // longest field goal attempt (yards from the ball, 8 behind the line included)
export const KICKOFF_YL = 12;
export const TOUCHBACK_YL = 8;

export function newMatch(rng, cfg) {
  const quarterSecs = QUARTER_SECS[cfg.quarter ?? 1] ?? 120;
  const teams = makeTeams(rng.fork(), cfg.level ?? 2);
  const first = cfg.first ?? 0;
  const M = {
    cfg: { quarter: cfg.quarter ?? 1, level: cfg.level ?? 2, first, mode: cfg.mode || 'ai', role: cfg.role || 'QB', quarterSecs },
    teams, actors: newActors(teams), q: 1, clock: quarterSecs, score: [0, 0], poss: first, yl: KICKOFF_YL, down: 1, toGo: 10,
    plays: 0, phase: 'call', over: null, last: null, calls: [{ off: [], def: [] }, { off: [], def: [] }], stats: [blank(), blank()], log: [], firstRecv: first, kickMsg: `${first === 0 ? 'Blue' : 'Red'} receives the opening kickoff.`, tryFor: -1,
    drive: [0, 0],
  };
  M.first = Math.min(10, FIELD.LEN - M.yl);
  return M;
}
function blank() { return { plays: 0, rush: 0, rushYds: 0, pass: 0, passComp: 0, passYds: 0, sacks: 0, ints: 0, fumbles: 0, tds: 0, fgs: 0, punts: 0, firstDowns: 0, turnovers: 0 }; }

export const toGoFor = (yl) => Math.min(FIELD.FIRST, FIELD.LEN - yl);
export const fieldGoalDistance = (yl) => FIELD.LEN - yl + 8;
export const canKickFG = (yl) => fieldGoalDistance(yl) <= FG_MAX_KICK;
export function fieldGoalChance(M, team, yl) {
  const k = fieldGoalDistance(yl);
  const lv = team === 1 ? LEVELS[M.cfg.level].rate : 1;
  return clamp((0.97 - 0.0155 * (k - 10)) * (0.9 + 0.1 * lv), 0.12, 0.97);
}

// ---- starting a play -------------------------------------------------------------------------------------------------------------------------
export function startScrimmage(M, rng, offId, defId, human) {
  const P = newPlay({ rng, teams: M.teams, actors: M.actors, off: M.poss, los: M.try ? FIELD.TRY_YL : M.yl, toGo: M.try ? FIELD.TRY_DIST : M.toGo, down: M.down, offId, defId, human, try: !!M.try });
  M.cur = P; M.phase = 'play';
  M.calls[M.poss].off.push(offId); M.calls[1 - M.poss].def.push(defId);
  return P;
}

// ---- the result of a play ----------------------------------------------------------------------------------------------------------------------
export function applyResult(M, P) {
  const r = P.result, off = P.off, def = 1 - off;
  const S = M.stats;
  const out = { text: '', big: '', kind: r.kind, team: off, yards: r.yards, newDown: false, score: null, firstDown: false, turnover: false, td: false, clockStop: !!r.clockStop, scoringTeam: -1 };
  // clock
  const live = r.secs;
  M.plays++;
  S[off].plays++;
  if (r.thrown) S[off].pass++; else S[off].rush++;
  if (r.completed) { S[off].passComp++; S[off].passYds += Math.max(0, r.yards); }
  if (!r.thrown && !r.turnover && r.kind !== 'sack') S[off].rushYds += r.yards;
  if (r.sack) S[def].sacks++;
  if (r.int) { S[def].ints++; S[off].turnovers++; }
  if (r.fumbleLost) { S[off].fumbles++; S[off].turnovers++; }
  if (M.try) { return applyTry(M, P, r, out); }
  M.clock = Math.max(0, M.clock - live - (r.clockStop ? 0 : T.RUNOFF));
  if (r.td) {
    const t = r.scoringTeam;
    M.score[t] += 6; S[t].tds++; out.td = true; out.scoringTeam = t; out.score = 6;
    out.text = r.turnover ? 'Touchdown on the return' : 'Touchdown';
    M.tryFor = t; M.next = 'try';
    M.last = out; return out;
  }
  if (r.safety) {
    M.score[def] += 2; out.score = 2; out.scoringTeam = def; out.text = 'Safety'; out.kind = 'safety';
    M.next = 'free'; M.poss = def; M.yl = 20; M.down = 1; M.toGo = toGoFor(20);   // the team that scored gets the ball back at its 20
    // the conceding team kicks: simplified, the scoring side simply takes over at the 20
    M.last = out; return endOfPlayClock(M, out);
  }
  if (r.turnover) {
    out.turnover = true; out.kind = r.int ? 'interception' : r.fumbleLost ? 'fumble' : 'turnover';
    M.poss = r.ballTeam; M.yl = clamp(r.newYl ?? 20, 1, 39); M.down = 1; M.toGo = toGoFor(M.yl);
    out.text = r.int ? 'Intercepted' : 'Fumble, lost';
    M.last = out; return endOfPlayClock(M, out);
  }
  if (r.kind === 'incomplete') { out.text = 'Incomplete pass'; }
  else if (r.sack) out.text = `Sack, ${r.yards} yd`;
  else out.text = `${r.yards >= 0 ? 'Gain of' : 'Loss of'} ${Math.abs(r.yards)} yd`;
  // downs
  const newYl = clamp(M.yl + r.yards, 0, 40);
  if (r.kind === 'incomplete') { M.down++; }
  else if (r.yards >= M.toGo) { M.yl = newYl; M.down = 1; M.toGo = toGoFor(M.yl); out.firstDown = true; S[off].firstDowns++; }
  else { M.yl = newYl; M.down++; M.toGo -= r.yards; }
  if (M.down > 4) {
    out.turnover = true; out.kind = 'downs'; out.text = 'Turnover on downs';
    M.poss = def; M.yl = clamp(40 - M.yl, 1, 39); M.down = 1; M.toGo = toGoFor(M.yl); S[off].turnovers++;
  }
  M.last = out;
  return endOfPlayClock(M, out);
}
function applyTry(M, P, r, out) {
  const t = M.tryFor;
  out.kind = 'try';
  if (r.td && r.scoringTeam === t) { M.score[t] += 2; out.score = 2; out.scoringTeam = t; out.text = 'Two-point try is good'; }
  else out.text = 'Two-point try fails';
  M.try = false; M.next = null;
  M.last = out;
  return afterScore(M, out, t);
}
export function tryGood(M, rng) { const t = M.tryFor; return rng.next() < (t === 1 ? 0.9 * (0.9 + 0.1 * LEVELS[M.cfg.level].rate) : 0.92); }
export function kickTry(M, good) {
  const t = M.tryFor;
  const out = { kind: 'try', team: t, text: good ? 'Extra point is good' : 'Extra point is missed', score: good ? 1 : 0, scoringTeam: good ? t : -1, kick: true, good };
  if (good) M.score[t] += 1;
  M.next = null; M.last = out;
  return afterScore(M, out, t);
}
export function goForTwo(M) { M.try = true; M.next = null; M.phase = 'call'; M.poss = M.tryFor; M.yl = FIELD.TRY_YL; M.down = 1; M.toGo = FIELD.TRY_DIST; }
function afterScore(M, out, scorer) {
  // kickoff: the other team receives at its KICKOFF_YL
  M.poss = 1 - scorer; M.yl = KICKOFF_YL; M.down = 1; M.toGo = toGoFor(M.yl); M.tryFor = -1;
  out.kickoff = true;
  return endOfPlayClock(M, out);
}
function endOfPlayClock(M, out) {
  if (M.clock <= 0) quarterEnd(M, out);
  return out;
}
function quarterEnd(M, out) {
  out.quarterEnd = M.q;
  if (M.q >= 4) { M.over = { winner: M.score[0] > M.score[1] ? 0 : M.score[1] > M.score[0] ? 1 : -1 }; M.phase = 'over'; return; }
  M.q++; M.clock = M.cfg.quarterSecs;
  if (M.q === 3) { M.poss = 1 - M.firstRecv; M.yl = KICKOFF_YL; M.down = 1; M.toGo = toGoFor(M.yl); M.kickMsg = `Second half: ${M.poss === 0 ? 'Blue' : 'Red'} receives the kickoff.`; out.half = true; }
}

// ---- kicks (automatic) ----------------------------------------------------------------------------------------------------------------------
export function puntDistance(rng) { return Math.round(clamp(24 + (rng.next() - 0.5) * 9, 14, 34)); }
export function fieldGoalGood(M, rng) { return rng.next() < fieldGoalChance(M, M.poss, M.yl); }
export function resolvePunt(M, dist) {
  const off = M.poss, S = M.stats[off]; S.punts++;
  let land = M.yl + dist;
  let text;
  if (land >= 40) { land = 40; text = 'Punt into the end zone: touchback'; M.poss = 1 - off; M.yl = TOUCHBACK_YL; }
  else { text = `Punt of ${dist} yd`; M.poss = 1 - off; M.yl = clamp(40 - land, 1, 39); }
  M.down = 1; M.toGo = toGoFor(M.yl);
  const out = { kind: 'punt', team: off, text, dist, yards: dist, clockStop: false, landYl: land };
  M.clock = Math.max(0, M.clock - 5);
  M.last = out;
  return endOfPlayClock(M, out);
}
export function resolveFieldGoal(M, good) {
  const off = M.poss;
  const out = { kind: 'fg', team: off, text: good ? 'Field goal is good' : 'Field goal misses', good, score: good ? 3 : 0, scoringTeam: good ? off : -1, dist: fieldGoalDistance(M.yl) };
  M.clock = Math.max(0, M.clock - 4);
  if (good) { M.score[off] += 3; M.stats[off].fgs++; M.last = out; return afterScore(M, out, off); }
  M.poss = 1 - off; M.yl = clamp(40 - M.yl, 1, 39); M.down = 1; M.toGo = toGoFor(M.yl);
  M.last = out;
  return endOfPlayClock(M, out);
}
void zOfYl; void attackDir;
