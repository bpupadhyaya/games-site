// The session: one match or knock from the first ball to the result. Pure and deterministic; game.js feeds it commands
// (the human's paddle, swing, run, bowl) and drawing reads it. Everything the picture needs is plain JSON in `S`.
//
// Phases per ball: ready (bowler winds up / waiting for BOWL) -> flight (ball to the paddle) -> field (ball in play,
// running) -> settle (the result banner) and, between innings, break. Roles: the human bats (humanBat) or bowls; in auto
// sessions (Watch & Learn, the title-screen show) the computer plays the human's part too.
import * as M from './sim.js';

export const PAR = [14, 22, 30];                      // runs a knock should beat, by level
export const WIND = 0.95;                              // seconds of run-up before the AI bowler lets go
export const WIND_H = 0.6;                                    // and when the human bowls
const SWING_LAG = 0.06;                                // a tap becomes contact this much later

export function newSession(opts) {
  const mode = opts.mode, knock = mode === 'knock' || mode === 'daily';
  const S = {
    mode, level: opts.level | 0, auto: !!opts.auto, think: opts.think ?? 5, attract: mode === 'attract',
    inn: 0, innings: [{ runs: 0, balls: 0, wkts: 0 }, { runs: 0, balls: 0, wkts: 0 }],
    maxBalls: knock ? M.KNOCK_BALLS : M.BALLS_PER_OVER * M.OVERS, maxWkts: knock ? M.KNOCK_WICKETS : M.WICKETS,
    twoInnings: !knock, target: null,
    humanBat: true, phase: 'ready', pt: 0, tf: 0, cam: 'pitch', camT: 0,
    setId: 'balanced', path: null, plan: null, swing: null, swingAnim: -1, paddleX: 0, paddleTo: 0,
    res: null, F: null, outcome: null, windT: 0, bowlGo: false, bowlSel: { aimX: 0, aimH: 0.8, pace: 1, bounce: false, swing: 1 },
    hint: null, dec: null, banner: null, log: [], pops: [], boardFall: 0, hintsUsed: 0, balls: [], result: null, thwock: 0, cmd: [],
    seq: 0, fx: [], camF: null, camAsp: { w: 720, h: 900, land: false },
  };
  return S;
}

const inn = (S) => S.innings[S.inn];
export const ballsLeft = (S) => S.maxBalls - inn(S).balls;
export const wktsLeft = (S) => S.maxWkts - inn(S).wkts;
export const need = (S) => (S.target == null ? null : S.target + 1 - inn(S).runs);

function situation(S) {
  const n = need(S), bl = Math.max(1, ballsLeft(S));
  return { need: n == null ? 0 : n / bl, rate: n == null ? 1.2 : n / bl, wkts: inn(S).wkts, wktsLeft: wktsLeft(S) };
}

// the bowler's end of the story: pick the AI delivery for this ball
function prepareBall(S, R) {
  S.path = null; S.plan = null; S.swing = null; S.swingAnim = -1; S.res = null; S.F = null; S.outcome = null; S.tf = 0; S.windT = 0;
  S.bowlGo = false; S.boardFall = 0; S.hint = null; S.cam = 'pitch'; S.camT = 0; S.pt = 0; S.thwock = 0;
  const first = inn(S).balls % M.BALLS_PER_OVER === 0;
  // the computer sets its field at the start of each over; the human, when bowling, sets it with the chips
  if (S.humanBat && first) S.setId = M.pickFieldSet(S.level, situation(S), R.ai);
  if (S.humanBat) {
    const bp = M.bowlerPlan(S.level, R.path, { attack: situation(S).rate > 1.5 ? 0.3 : 0.6 });
    S.path = M.makePath(bp.aimX, bp.aimH, bp.T, bp.bounce, bp.swing);
  }
  if (S.auto) {
    S.dec = S.attract ? { phase: 'go', t: 0, dur: 0.4 } : { phase: 'think', t: 0, dur: S.think };
    if (S.humanBat) S.dec.adv = M.adviceBat(S.path, fieldersOf(S), situation(S));
    else S.dec.adv = M.adviceBowl(S.level, R.ai, situation(S));
  } else S.dec = null;
}
export const fieldersOf = (S) => M.fieldSet(S.setId || 'balanced');

// ---- applying a finished ball ----------------------------------------------------------------------------------------
function applyOutcome(S, o, sfx) {
  const I = inn(S);
  I.runs += o.runs; I.balls += 1; if (o.wicket) I.wkts += 1;
  S.log.push({ inn: S.inn, k: o.kind, runs: o.runs, w: !!o.wicket });
  S.balls.push({ inn: S.inn, k: o.kind, runs: o.runs });
  S.outcome = o;
  let text = M.describe(o);
  if (o.kind === 'blocked') text = 'Blocked';
  else if (o.kind === 'passed') text = 'Missed';
  else if (o.kind === 'dead' || o.kind === 'overthrow') text = o.runs === 0 ? 'No run' : M.describe(o);
  const col = o.wicket ? '#ff7a6a' : o.runs >= 4 ? '#ffd36a' : '#ffffff';
  S.banner = { text, sub: o.wicket ? bowledSub(o) : '', col, t: 0, max: S.attract ? 0.8 : 1.5, runs: o.runs, wicket: !!o.wicket };
  S.phase = 'settle'; S.pt = 0;
  if (o.wicket) sfx('out', o); else if (o.runs >= 4) sfx('cheer', o); else if (o.runs > 0) sfx('clap', o);
}
const bowledSub = (o) => (o.kind === 'bowled' ? 'Board and post struck' : o.kind === 'caught' ? 'Taken in the air' : 'Short of the board');

// is the innings over?
function inningsOver(S) {
  const I = inn(S);
  if (I.balls >= S.maxBalls || I.wkts >= S.maxWkts) return true;
  if (S.target != null && I.runs > S.target) return true;
  return false;
}

function finishInnings(S) {
  if (S.twoInnings && S.inn === 0) {
    S.phase = 'break'; S.pt = 0;
    return;
  }
  S.phase = 'done'; S.pt = 0;
  const a = S.innings[0], b = S.innings[1];
  if (S.twoInnings) {
    const you = S.humanBatFirst ? a.runs : b.runs, opp = S.humanBatFirst ? b.runs : a.runs;
    S.result = { kind: 'match', you, opp, win: you > opp, tie: you === opp, margin: Math.abs(you - opp), wktsYou: S.humanBatFirst ? a.wkts : b.wkts, wktsOpp: S.humanBatFirst ? b.wkts : a.wkts };
  } else {
    const par = PAR[S.level] ?? 20;
    S.result = { kind: 'knock', runs: a.runs, wkts: a.wkts, balls: a.balls, par, beat: a.runs > par };
  }
}

// ---- stepping --------------------------------------------------------------------------------------------------------
// R = { path, strike, field, ai } rng streams; sfx(name, data) plays sounds; returns nothing.
export function stepSession(S, dt, R, sfx) {
  S.pt += dt;
  S.seq++;
  stepPops(S, dt);
  stepFx(S, dt);
  if (S.banner) { S.banner.t += dt; }
  if (S.boardFall > 0 && S.boardFall < 1) S.boardFall = Math.min(1, S.boardFall + dt * 2.2);
  if (S.thwock > 0) S.thwock = Math.max(0, S.thwock - dt);
  if (S.swingAnim >= 0 && S.swingAnim < 1) S.swingAnim = Math.min(1, S.swingAnim + dt / 0.2);
  S.camT += dt;
  const cmds = S.cmd; S.cmd = [];
  switch (S.phase) {
    case 'ready': return stepReady(S, dt, R, sfx, cmds);
    case 'flight': return stepFlight(S, dt, R, sfx, cmds);
    case 'field': return stepFieldPhase(S, dt, R, sfx, cmds);
    case 'settle': return stepSettle(S, dt, R, sfx, cmds);
    case 'break': return stepBreak(S, dt, R, sfx, cmds);
    default: return undefined;
  }
}

function applyCmdBasics(S, cmds) {
  for (const c of cmds) {
    if (c.c === 'paddle' && S.humanBat && !S.auto) S.paddleTo = Math.max(-1.3, Math.min(1.3, c.x));
    else if (c.c === 'field' && !S.humanBat && !S.auto) S.setId = c.id;
  }
}
function movePaddle(S, dt, speed) {
  const d = S.paddleTo - S.paddleX;
  S.paddleX += Math.max(-speed * dt, Math.min(speed * dt, d));
}

function stepReady(S, dt, R, sfx, cmds) {
  applyCmdBasics(S, cmds);
  movePaddle(S, dt, 10);
  // auto sessions: think -> reveal -> go
  if (S.auto && S.dec) {
    const D = S.dec;
    D.t += dt;
    if (D.phase === 'think' && D.t >= D.dur) { D.phase = 'reveal'; D.t = 0; D.dur = 2; if (S.humanBat) S.hint = { adv: D.adv, kind: 'bat' }; else S.hint = { adv: D.adv, kind: 'bowl' }; }
    else if (D.phase === 'reveal') {
      if (S.humanBat) S.paddleTo = D.adv.paddleX;
      else { const a = D.adv; S.bowlSel = { aimX: a.aimX, aimH: a.aimH, pace: a.pace, bounce: a.bounce, swing: a.swing }; }
      if (D.t >= D.dur) { D.phase = 'go'; D.t = 0; D.dur = 0.5; }
    } else if (D.phase === 'go' && D.t >= D.dur && !S.bowlGo) {
      if (S.humanBat) S.bowlGo = true; else launchHuman(S, R);
    }
  }
  if (S.humanBat) {
    if (!S.auto) S.bowlGo = true;
    if (S.bowlGo) { S.windT += dt / WIND; if (S.windT >= 1) release(S, R, sfx); }
  } else {
    for (const c of cmds) if (c.c === 'bowl' && !S.bowlGo && !S.auto) { S.bowlSel = { ...S.bowlSel, ...c.sel }; launchHuman(S, R); }
    if (S.bowlGo) { S.windT += dt / WIND_H; if (S.windT >= 1) release(S, R, sfx); }
  }
}
function launchHuman(S, R) {
  const d = M.humanDelivery(S.bowlSel, R.path);
  S.path = M.makePath(d.aimX, d.aimH, d.T, d.bounce, d.swing);
  S.bowlGo = true; S.windT = 0;
}

function release(S, R, sfx) {
  S.phase = 'flight'; S.tf = 0; S.pt = 0; S.hint = S.auto ? null : S.hint;
  sfx('release', S.path);
  // the computer's batter: the opponent when the human bowls, a good club batter standing in for the human in auto sessions
  if (S.auto || !S.humanBat) {
    const lvl = S.humanBat ? 1 : S.level;
    S.plan = M.batterPlan(S.path, fieldersOf(S), lvl, { need: situation(S).need, wkts: inn(S).wkts }, R.ai);
  }
}

function stepFlight(S, dt, R, sfx, cmds) {
  applyCmdBasics(S, cmds);
  const P = S.path;
  S.tf += dt;
  const human = S.humanBat && !S.auto;
  // the paddle: the human's finger, or the computer's plan once it has read the ball
  if (human) movePaddle(S, dt, 10);
  else if (S.plan) { if (S.tf > 0.25) S.paddleTo = S.plan.paddleX; movePaddle(S, dt, 7); }
  // the human's swing: one per ball
  if (human && !S.swing) {
    for (const c of cmds) if (c.c === 'swing') { S.swing = { type: c.k, t: S.tf + SWING_LAG }; S.swingAnim = 0; sfx('swing', c.k); break; }
  }
  // the computer's swing: its animation starts shortly before contact; a block is a parked paddle
  if (S.plan && !S.swing && S.plan.kind !== 'block' && S.tf >= S.plan.swingT - 0.1) {
    S.swing = { type: S.plan.kind, t: S.plan.swingT }; S.swingAnim = 0; sfx('swing', S.plan.kind);
  }
  if (!S.res) {
    const sw = S.swing;
    if (sw && S.tf >= sw.t) S.res = M.strike(P, sw, S.paddleX, R.strike);
    else if (S.tf >= P.tArr + M.LATE) S.res = M.strike(P, null, S.paddleX, R.strike);
    if (S.res) afterStrike(S, R, sfx);
  }
  if (S.res && (S.res.kind === 'bowled' || S.res.kind === 'passed') && S.tf >= P.T) {
    if (S.res.kind === 'bowled') { S.boardFall = 0.001; burst(S, 0, 0, 1.2, 12, '#e9c27a', 3.4, 0.8); sfx('board', null); applyOutcome(S, { kind: 'bowled', runs: 0, wicket: true }, sfx); }
    else applyOutcome(S, { kind: 'passed', runs: 0, wicket: false }, sfx);
  }
}

function afterStrike(S, R, sfx) {
  const r = S.res;
  if (r.kind === 'hit') {
    sfx(r.shot === 'block' ? 'tap' : 'thwock', r);
    S.thwock = 0.35;
    burst(S, r.ball.x, r.ball.y, r.ball.z, r.q > 0.6 ? 10 : 6, r.q > 0.6 ? '#fff3b0' : '#e9e2c0', 2.4, 0.5);
    const lv = S.humanBat ? S.level : S.level;
    S.F = M.newField(S.setId || 'balanced', lv, r.ball, R.field);
    S.phase = 'field'; S.pt = 0; S.cam = 'field'; S.camT = 0;
    S.camF = { x: 0, y: 5, w: 30 };
  } else if (r.kind === 'blocked') {
    sfx('tap', r);
    applyOutcome(S, { kind: 'blocked', runs: 0, wicket: false }, sfx);
  }
}

function stepFieldPhase(S, dt, R, sfx, cmds) {
  const F = S.F;
  let run = false;
  for (const c of cmds) if (c.c === 'run') run = true;
  if (run && S.humanBat && !S.auto) { M.tapRun(F); sfx('run', null); }
  const aiRuns = !S.humanBat || S.auto;
  const risk = [0.3, 0.5, 0.6][S.level] ?? 0.5;
  M.stepField(F, dt, { runs: aiRuns, risk: S.humanBat ? 0.55 : risk });
  for (const e of F.events) {
    if (e.t <= (F._seen ?? -1)) continue;
    if (e.type === 'catch') sfx('catch', e);
    else if (e.type === 'throw') sfx('throw', e);
    else if (e.type === 'board') sfx('board', e);
    else if (e.type === 'bounce') sfx('bounce', e);
    else if (e.type === 'run-done') sfx('run-done', e);
    else if (e.type === 'four' || e.type === 'six') sfx('rope', e);
  }
  F._seen = F.t - 1e-6;
  followCam(S, dt);
  if (F.over) {
    const o = F.outcome;
    if (o.kind === 'runout') { S.boardFall = 0.001; const bd = F.events.filter((e) => e.type === 'board').pop(); if (bd) burst(S, 0, bd.e === 0 ? 0 : M.PITCH, 1.2, 12, '#e9c27a', 3.4, 0.8); }
    if (o.kind === 'four' || o.kind === 'six' || o.kind === 'overthrow') burst(S, F.ball.x, F.ball.y, 0.5, 14, '#ffd36a', 4, 0.9);
    applyOutcome(S, o, sfx);
  }
}

// The field view follows the action: it centres on the ball, the chaser and both ends of the pitch and zooms to fit them.
// The centre eases; the zoom may never be tighter than what keeps every one of those points on screen (followNeed).
const clampPt = (x, y) => {
  const dx = x - M.FIELD_C.x, dy = y - M.FIELD_C.y, d = Math.hypot(dx, dy), m = M.FIELD_R + 1.5;
  return d > m ? [M.FIELD_C.x + (dx / d) * m, M.FIELD_C.y + (dy / d) * m] : [x, y];
};
function followPts(S) {
  const F = S.F, b = F.ball, pts = [[0, M.END_Y[0]], [0, M.END_Y[1]], clampPt(b.x, b.y)];
  if (F.plan && !F.over) pts.push(clampPt(F.plan.x, F.plan.y));
  return pts;
}
// metres across the screen that keep every key point inside the stage `a` = { w, h, land } around the camera centre c
export function followNeed(S, c, a, k = 0.8, m = 46) {
  if (!S.F) return 0;
  let sMax = Infinity;
  for (const p of followPts(S)) {
    if (!a.land) {
      const dx = Math.abs(p[0] - c.x), dy = p[1] - c.y;
      if (dx > 0.01) sMax = Math.min(sMax, (a.w / 2 - m) / dx);
      if (dy > 0.01) sMax = Math.min(sMax, (0.56 * a.h - m) / (dy * k)); else if (dy < -0.01) sMax = Math.min(sMax, (0.44 * a.h - m) / (-dy * k));
    } else {
      const dy = Math.abs(p[1] - c.y), dx = p[0] - c.x;
      if (dy > 0.01) sMax = Math.min(sMax, (a.w / 2 - m) / dy);
      if (dx > 0.01) sMax = Math.min(sMax, (0.56 * a.h - m) / (dx * k)); else if (dx < -0.01) sMax = Math.min(sMax, (0.44 * a.h - m) / (-dx * k));
    }
  }
  return Number.isFinite(sMax) && sMax > 1 ? Math.min(120, a.w / sMax) : 0;
}
function followCam(S, dt) {
  const F = S.F, c = S.camF; if (!F || !c) return;
  const pts = followPts(S);
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (const p of pts) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
  const a = S.camAsp, k = 0.8, pad = 6;
  const eh = a.land ? y1 - y0 + 2 * pad : x1 - x0 + 2 * pad;
  const ev2 = a.land ? x1 - x0 + 2 * pad : y1 - y0 + 2 * pad;
  const wmT = Math.min(66, Math.max(26, eh, (ev2 * k * a.w) / Math.max(1, a.h)));
  const f = Math.min(1, dt * 3);
  c.x += ((x0 + x1) / 2 - c.x) * f; c.y += ((y0 + y1) / 2 - c.y) * f;
  c.w += (wmT - c.w) * Math.min(1, dt * 2);
  c.w = Math.max(c.w, followNeed(S, c, a));
}

function stepSettle(S, dt, R, sfx, cmds) {
  const hold = S.attract ? 0.9 : S.auto ? 1.7 : 1.35;
  let skip = false;
  for (const c of cmds) if (c.c === 'next') skip = true;
  if (S.pt >= hold || (skip && S.pt > 0.45)) {
    if (inningsOver(S)) { finishInnings(S); sfx('bell'); return; }   // the tea-time bell on the pavilion steps
    prepareBall(S, R); S.phase = 'ready'; S.pt = 0;
  }
}

function stepBreak(S, dt, R, sfx, cmds) {
  let go = S.auto && S.pt > 3.2;
  for (const c of cmds) if (c.c === 'next') go = true;
  if (go && S.pt > 0.8) {
    S.inn = 1; S.humanBat = false; S.setId = 'balanced'; S.target = S.innings[0].runs;
    S.humanBatFirst = true;
    prepareBall(S, R); S.phase = 'ready'; S.pt = 0; S.paddleX = 0; S.paddleTo = 0;
  }
}

// Little puffs and chips: plain numbers, no random stream (the pattern comes from a hash of the counter).
const hn = (i) => { let x = (i * 2654435761) >>> 0; x ^= x >>> 15; x = Math.imul(x, 2246822519) >>> 0; x ^= x >>> 13; return (x >>> 0) / 4294967296; };
export function burst(S, x, y, z, n, col, speed = 3, life = 0.5) {
  for (let i = 0; i < n && S.fx.length < 60; i++) {
    const a = hn(S.seq * 31 + i) * Math.PI * 2, v = speed * (0.4 + hn(S.seq * 17 + i * 3));
    S.fx.push({ x, y, z, vx: Math.cos(a) * v, vy: Math.sin(a) * v, vz: 1.5 + hn(S.seq * 7 + i) * speed * 0.6, t: 0, life: life * (0.6 + hn(i + S.seq)), col });
  }
}
function stepFx(S, dt) {
  if (!S.fx.length) return;
  for (const p of S.fx) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vz -= 9.8 * dt; p.z = Math.max(0, p.z + p.vz * dt); if (p.z === 0) { p.vx *= 0.8; p.vy *= 0.8; p.vz = 0; } }
  S.fx = S.fx.filter((p) => p.t < p.life);
}
function stepPops(S, dt) {
  for (const p of S.pops) p.t += dt;
  if (S.pops.length) S.pops = S.pops.filter((p) => p.t < p.max);
}

// ---- starting ----------------------------------------------------------------------------------------------------------
export function beginSession(S, R) {
  S.humanBatFirst = true;
  S.humanBat = true;
  prepareBall(S, R);
  S.phase = 'ready'; S.pt = 0;
}
// Jump straight to the second innings (the human bowling): used by the store screenshots and the tests.
export function startSecond(S, R, target = 24) {
  S.innings[0] = { runs: target, balls: S.maxBalls, wkts: 3 };
  S.inn = 1; S.humanBat = false; S.target = target; S.setId = 'balanced'; S.humanBatFirst = true;
  prepareBall(S, R); S.phase = 'ready'; S.pt = 0; S.paddleX = 0; S.paddleTo = 0;
}
export function cmd(S, c) { S.cmd.push(c); if (S.cmd.length > 12) S.cmd.shift(); }

// The Think hint for the current moment (human playing): returns the advice and marks the session as practice.
export function think(S, R) {
  if (S.auto) return null;
  if (S.humanBat) {
    if (!S.path) return null;
    const adv = M.adviceBat(S.path, fieldersOf(S), situation(S));
    S.hint = { adv, kind: 'bat' }; S.hintsUsed++; return S.hint;
  }
  const a = M.adviceBowl(S.level, R.ai, situation(S));
  S.hint = { adv: a, kind: 'bowl' }; S.hintsUsed++; return S.hint;
}
export { situation };
