// The engine ties the match (score, downs, clock) to the play simulation and says what the screen must ask the player next:
//   phase 'call'   -> E.need = { kind: 'offcall' | 'defcall' | 'fourth' | 'try', team, human }
//   phase 'play'   -> a play (or a kick) is running in real time: E.P
//   phase 'result' -> the banner for the play that just ended, players walking back
//   phase 'over'   -> the game is finished
// Pure and deterministic (no clock, no randomness except the rng handed in). The user's player is E.humanId (or -1 when the computer plays everything).
import { FIELD, ROLES, OFF_SLOT_OF_P, DEF_SLOT_OF_P, TEAM_LEVEL, roleById } from './consts.js';
import { newMatch, startScrimmage, applyResult, kickTry, tryGood, goForTwo, puntDistance, fieldGoalGood, resolvePunt, resolveFieldGoal, canKickFG, fieldGoalChance } from './match.js';
import { newKickPlay, stepPlay, gatherStep } from './sim.js';
import { chooseOffense, chooseDefense, chooseFourth, chooseTry, thinkOffense, thinkDefense, fourthOptions, callName } from './coach.js';
import { OFF_PLAYS, DEF_CALLS } from './plays.js';
import { ylOf, zOfYl, attackDir } from './geo.js';

const RESULT_T = 2.6;
export const TEAM_COL_NAME = ['Blue', 'Red'];

// cfg: { level, quarter, first, mode: 'ai' | 'watch' | 'lesson', role, levels? }
export function createEngine(rng, cfg) {
  const role = roleById(cfg.role || 'QB');
  const mode = cfg.mode || 'ai';
  const E = {
    cfg: { ...cfg, mode, role: role.id }, rng, m: newMatch(rng.fork(), { level: cfg.level ?? 2, quarter: cfg.quarter ?? 1, first: cfg.first ?? 0, mode, role: role.id }),
    simRng: rng.fork(), P: null, phase: 'call', need: null, calls: { off: null, def: null }, timer: 0, banner: null, res: null, t: 0,
    humanTeam: mode === 'watch' ? -1 : 0, humanId: mode === 'watch' ? -1 : role.p,
    levels: cfg.levels || [TEAM_LEVEL, cfg.level ?? 2], kickPending: null, resultHist: [],
    seq: 0, lines: [], lesson: cfg.lesson || null,
  };
  E.m.cfg.level = E.levels[1];
  restPositions(E);
  setNeed(E);
  return E;
}

export const isHuman = (E, team) => E.humanTeam === team;
const levelOf = (E, team) => E.levels[team];

// ---- the choices --------------------------------------------------------------------------------------------------------------------------------
function setNeed(E) {
  const M = E.m;
  E.phase = 'call'; E.calls = { off: null, def: null };
  if (M.over) { E.phase = 'over'; E.need = null; return; }
  if (M.next === 'try') { E.need = { kind: 'try', team: M.tryFor, human: isHuman(E, M.tryFor), ai: !isHuman(E, M.tryFor) }; autoAI(E); return; }
  if (M.down === 4 && !M.try) { E.need = { kind: 'fourth', team: M.poss, human: isHuman(E, M.poss), ai: !isHuman(E, M.poss), options: fourthOptions(M) }; autoAI(E); return; }
  nextCall(E);
}
function nextCall(E) {
  const M = E.m;
  if (!E.calls.off) E.need = { kind: 'offcall', team: M.poss, human: isHuman(E, M.poss), ai: !isHuman(E, M.poss) };
  else if (!E.calls.def) E.need = { kind: 'defcall', team: 1 - M.poss, human: isHuman(E, 1 - M.poss), ai: !isHuman(E, 1 - M.poss) };
  else { E.need = null; beginPlay(E); return; }
  autoAI(E);
}
// computer-side needs: precomputed pick and reasons (watch mode shows them; otherwise they are applied at once)
export function aiPick(E, need) {
  const M = E.m, rng = E.simRng, lv = levelOf(E, need.team);
  if (need.kind === 'offcall') { const v = chooseOffense(rng, M, lv); const th = thinkOffense(M); return { value: v, why: v === th.best ? th.lines.slice(1) : [`${callName(v)} fits the situation.`, ...th.lines.slice(1, 2)] }; }
  if (need.kind === 'defcall') { const v = chooseDefense(rng, M, lv); const th = thinkDefense(M); return { value: v, why: th.lines.slice(1) }; }
  if (need.kind === 'fourth') { const v = chooseFourth(rng, M, lv); return { value: v, why: [v === 'fg' ? `A field goal from ${need.options.fgDist} yards is ${Math.round(need.options.fgChance * 100)}% likely.` : v === 'punt' ? 'It is too far to go for it, so it kicks away.' : `Only ${M.toGo} yards to go: it goes for it.`] }; }
  if (need.kind === 'try') { const v = chooseTry(rng, M, lv); return { value: v, why: [v === 'two' ? 'It goes for two points.' : 'It kicks the extra point.'] }; }
  return null;
}
function autoAI(E) {
  const need = E.need;
  if (!need || need.human) return;
  need.pick = aiPick(E, need);
  if (E.cfg.mode !== 'watch') choose(E, need.pick.value);       // no UI needed: apply it
}
export function choose(E, value) {
  const need = E.need, M = E.m;
  if (!need) return false;
  if (need.kind === 'offcall') { if (!OFF_PLAYS.some((p) => p.id === value)) return false; E.calls.off = value; nextCall(E); return true; }
  if (need.kind === 'defcall') { if (!DEF_CALLS.some((c) => c.id === value)) return false; E.calls.def = value; nextCall(E); return true; }
  if (need.kind === 'fourth') {
    if (value === 'go') { E.need = null; E.calls = { off: null, def: null }; E.fourthGo = true; E.need = { kind: 'offcall', team: M.poss, human: isHuman(E, M.poss), ai: !isHuman(E, M.poss) }; autoAI(E); return true; }
    if (value === 'punt' && need.options.punt) { startKick(E, 'punt'); return true; }
    if (value === 'fg' && need.options.fg) { startKick(E, 'fg'); return true; }
    return false;
  }
  if (need.kind === 'try') {
    if (value === 'two') { goForTwo(M); E.need = null; E.calls = { off: null, def: null }; E.tryFlag = true; E.need = { kind: 'offcall', team: M.poss, human: isHuman(E, M.poss), ai: !isHuman(E, M.poss) }; autoAI(E); return true; }
    if (value === 'kick') { startKick(E, 'try'); return true; }
    return false;
  }
  return false;
}

// ---- starting plays -------------------------------------------------------------------------------------------------------------------------------
function beginPlay(E) {
  const M = E.m;
  const humanOn = E.humanTeam >= 0;
  const hid = humanOn && !E.cfg.auto ? E.humanId : -1;
  E.P = startScrimmage(M, E.simRng, E.calls.off, E.calls.def, hid);
  E.P.tag = M.try ? 'try' : '';
  E.phase = 'play'; E.timer = 0; E.banner = null;
}
function startKick(E, type) {
  const M = E.m, off = M.poss;
  const spec = { rng: E.simRng, teams: M.teams, actors: M.actors, off, type: type === 'try' ? 'fg' : type, los: type === 'try' ? FIELD.TRY_YL : M.yl };
  let pending;
  if (type === 'punt') { const dist = puntDistance(E.simRng); pending = { type, dist }; spec.dist = dist; const land = ylOf(off, 0) && null; void land; spec.land = landPoint(off, M.yl, dist); }
  else if (type === 'fg') { const good = fieldGoalGood(M, E.simRng); pending = { type, good }; spec.good = good; }
  else { const good = tryGood(M, E.simRng); pending = { type, good }; spec.good = good; }
  E.kickPending = pending;
  E.P = newKickPlay(spec); E.P.tag = type;
  E.phase = 'play'; E.timer = 0; E.banner = null; E.need = null;
  M.phase = 'play';
}
function landPoint(off, yl, dist) {
  const ny = Math.min(yl + dist, FIELD.LEN + 3);
  return { x: 0, z: zOfYl(off, ny) };
}

// ---- stepping -------------------------------------------------------------------------------------------------------------------------------------
export function step(E, dt) {
  E.t += dt;
  const M = E.m;
  if (E.phase === 'play') {
    const P = E.P;
    stepPlay(P, dt);
    if (P.phase === 'done') finishPlay(E);
  } else if (E.phase === 'result') {
    gatherStep(M.actors, restTargets(E), dt);
    E.timer += dt;
    if (E.timer >= RESULT_T) { E.banner = null; setNeed(E); }
  } else {
    gatherStep(M.actors, restTargets(E), dt);
  }
}

function finishPlay(E) {
  const M = E.m, P = E.P, kp = E.kickPending;
  let out;
  if (P.kick) {
    E.kickPending = null;
    if (kp.type === 'punt') out = resolvePunt(M, kp.dist);
    else if (kp.type === 'fg') out = resolveFieldGoal(M, kp.good);
    else out = kickTry(M, kp.good);
  } else out = applyResult(M, P);
  E.res = out; E.phase = 'result'; E.timer = 0; E.banner = makeBanner(E, P, out);
  for (const a of M.actors) a.hold = a.down || a.wrap ? 1.9 : 0.5;
  E.resultHist.push({ q: M.q, text: E.banner.title + ' ' + E.banner.sub });
  E.lastPlay = P;
  E.seq++;
}

const NAME_OF_SLOT = { QB: 'quarterback', RB: 'running back', WA: 'receiver', WB: 'receiver', TE: 'tight end', C: 'lineman', G: 'lineman', S: 'safety', LB1: 'linebacker', LB2: 'linebacker', CB1: 'cornerback', CB2: 'cornerback', DL1: 'lineman', DL2: 'lineman' };
const slotOfActor = (E, id, P) => (id < 0 ? '' : (P && P.actors[id].team === P.off ? OFF_SLOT_OF_P : DEF_SLOT_OF_P)[id % 7]);
function makeBanner(E, P, out) {
  const M = E.m, team = TEAM_COL_NAME[P.off];
  const r = P.result || {};
  let title = '', sub = '', tone = 'info';
  const yds = (n) => `${Math.abs(n)} yard${Math.abs(n) === 1 ? '' : 's'}`;
  if (out.kind === 'punt') { title = 'PUNT'; sub = out.text; }
  else if (out.kind === 'fg') { title = out.good ? 'FIELD GOAL' : 'NO GOOD'; sub = `${out.dist} yard attempt`; tone = out.good ? 'good' : 'bad'; }
  else if (out.kind === 'try') { title = out.kick ? (out.good ? 'EXTRA POINT' : 'NO GOOD') : (out.score ? 'TWO POINTS' : 'TRY FAILS'); sub = out.text; tone = out.score ? 'good' : 'bad'; }
  else if (r.td) { title = 'TOUCHDOWN'; sub = `${TEAM_COL_NAME[r.scoringTeam]} scores 6 points`; tone = 'good'; }
  else if (out.kind === 'safety') { title = 'SAFETY'; sub = `${TEAM_COL_NAME[1 - P.off]} gets 2 points`; tone = 'bad'; }
  else if (out.kind === 'interception') { title = 'INTERCEPTED'; sub = `${TEAM_COL_NAME[1 - P.off]} takes over`; tone = 'bad'; }
  else if (out.kind === 'fumble') { title = 'FUMBLE'; sub = `${TEAM_COL_NAME[1 - P.off]} recovers`; tone = 'bad'; }
  else if (out.kind === 'downs') { title = 'TURNOVER ON DOWNS'; sub = `${TEAM_COL_NAME[1 - P.off]} takes over`; tone = 'bad'; }
  else if (r.kind === 'incomplete') { title = 'INCOMPLETE'; sub = 'The pass falls incomplete'; }
  else if (r.sack) { title = 'SACK'; sub = `${team} loses ${yds(r.yards)}`; tone = 'bad'; }
  else if (r.completed) { title = `PASS FOR ${r.yards >= 0 ? '+' : '-'}${Math.abs(r.yards)}`; sub = `${team} completes a pass for ${yds(r.yards)}`; }
  else { title = r.yards >= 0 ? `RUN FOR +${r.yards}` : `LOSS OF ${Math.abs(r.yards)}`; sub = `${team} ${r.yards >= 0 ? 'gains' : 'loses'} ${yds(r.yards)}`; }
  if (out.firstDown && !r.td) { sub += '. First down!'; tone = tone === 'info' ? 'good' : tone; }
  return { title, sub, tone, team: P.off };
}

// ---- resting positions between plays -------------------------------------------------------------------------------------------------------------------
function restTargets(E) {
  const M = E.m, out = {};
  const off = M.poss, dir = attackDir(off);
  const los = M.try ? FIELD.TRY_YL : M.yl;
  const losZ = zOfYl(off, Math.max(0, Math.min(FIELD.LEN, los)));
  M.actors.forEach((a) => {
    const isOff = a.team === off;
    const slotIdx = a.p;
    const v = (slotIdx - 3) * 2.2;
    out[a.id] = { x: dir * v * (isOff ? 1 : -1) * 0.9, z: losZ + dir * (isOff ? -4.5 : 5.5) };
  });
  return out;
}
function restPositions(E) {
  const t = restTargets(E);
  E.m.actors.forEach((a) => { a.x = t[a.id].x; a.z = t[a.id].z; a.px = a.x; a.pz = a.z; a.face = a.team === E.m.poss ? (attackDir(E.m.poss) > 0 ? 0 : Math.PI) : (attackDir(E.m.poss) > 0 ? Math.PI : 0); });
}
export { restTargets };

// ---- the user's role during a play (for the labels) --------------------------------------------------------------------------------------------------
export function humanSlot(E) {
  if (E.humanId < 0 || !E.P) return '';
  return E.P.actors[E.humanId].slot;
}
export function roleLabel(E) {
  const r = roleById(E.cfg.role);
  return r.name;
}
export function teamUnit(E) { return E.m.poss === E.humanTeam ? 'off' : 'def'; }
void ROLES; void canKickFG; void fieldGoalChance;

// ---- save / resume (taken at the start of a call, when nothing is moving) ---------------------------------------------------------------------------------------------
export function exportSave(E) {
  const M = E.m;
  return { cfg: { ...E.cfg, levels: E.levels }, m: JSON.parse(JSON.stringify({ cfg: M.cfg, teams: M.teams, q: M.q, clock: M.clock, score: M.score, poss: M.poss, yl: M.yl, down: M.down, toGo: M.toGo, plays: M.plays, calls: M.calls, stats: M.stats, firstRecv: M.firstRecv, next: M.next || null, tryFor: M.tryFor, try: !!M.try })), q: M.q, score: [...M.score] };
}
export function validSave(r) {
  return !!r && !!r.m && Array.isArray(r.m.score) && r.m.score.length === 2 && Array.isArray(r.m.teams) && r.m.teams.length === 2 && r.m.teams.every((t) => Array.isArray(t.players) && t.players.length === 7)
    && Number.isInteger(r.m.q) && r.m.q >= 1 && r.m.q <= 4 && (r.m.poss === 0 || r.m.poss === 1) && Number.isFinite(r.m.clock) && Number.isFinite(r.m.yl) && r.m.down >= 1 && r.m.down <= 4 && !!r.cfg && r.cfg.mode === 'ai';
}
export function importSave(rng, sv) {
  const E = createEngine(rng, { ...sv.cfg });
  Object.assign(E.m, sv.m, { cfg: { ...E.m.cfg, ...sv.m.cfg } });
  E.m.try = false;
  restPositions(E);
  setNeed(E);
  return E;
}
