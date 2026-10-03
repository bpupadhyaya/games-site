// The Kilikiti match: innings, balls, the live ball (fielding, running, throwing). Pure and deterministic: fixed 1/60 s ticks, randomness only through the
// rng streams handed in. No drawing, no input handling. The simulation owns every position, contact time and outcome; the 3D layer only READS `s`.
//
// Team-sport rule: the human controls exactly ONE role on team 0 ('bat', 'bowl', 'inner' or 'deep'); every other player and the whole opposition
// is computer-controlled. role === null is Watch & Learn (all computer).
import { PITCH, FIELD, BAT, STUMP, BALL_R, DT, clamp, lerp, fenceRatio, insideRope, LEVELS, MATE, MODES, RUN_LEN } from './core.js';
import { lengthClassOf, flyDelivery, deliveryPos, resolveSwing, flyBall, trackPos, trackSpeed, shotName, throwFlight, throwPos, throwTime, SWING_LEAD, makeSpec, SPEED, BOUNCE, DELIVERIES } from './ball.js';
import { makeFielders, intercept, catchChance, throwAccuracy, REACH, CONTROL_SLOT, safeRuns } from './field.js';
import { planDelivery, planBat, localRng, batHint, bowlHint, runAdvice, runMargin, RUN_TIME, levelOf, lengthWord, lineWord } from './ai.js';

export const READY_T = 1.0;      // before the bowler starts his run
export const RUNUP_T = 0.95;     // the run-up (the ball is released at its end)
export const DEAD_T = 1.8;       // the result banner time
export const GATHER_T = 0.32;    // a fielder takes this long to gather the ball before throwing
export const HOLD_VIEW = 0.75;   // the delivery view stays up this long after the ball is hit (a presentation choice; the sim timeline is untouched)

const DEG_ = Math.PI / 180;
const NAMES_A = ['Sione', 'Mele', 'Tui', 'Lani', 'Losa', 'Ioane', 'Fetu', 'Nikau', 'Tala', 'Manu', 'Pita', 'Aroha'];
const NAMES_B = ['Hemi', 'Kasun', 'Zara', 'Mateo', 'Priya', 'Thabo', 'Mei', 'Omar', 'Chloe', 'Kofi', 'Ravi', 'Isla'];

const runDist = (x) => { const ta = 0.45, vmax = 7.3; if (x <= 0) return 0; if (x >= ta) return vmax * (x - ta / 2); const u = x / ta; return vmax * ta * (u * u * u - 0.5 * u * u * u * u); };
const T_RUN = 0.225 + RUN_LEN / 7.3;
const runU = (tau) => clamp(runDist(tau) / RUN_LEN, 0, 1);

export function createSim(cfg, rng, resume = null) {
  const R = { m: rng.fork(), f: rng.fork(), a: rng.fork() };
  const mode = cfg.practice ? { key: 'practice', name: 'Practice', balls: cfg.practice.balls ?? 6, wkts: 99, blurb: '' } : (MODES[cfg.mode] ?? MODES.quick);
  const role = cfg.role ?? null;
  const lv = [levelOf(MATE), levelOf(cfg.practice ? 0 : (cfg.level ?? 3) - 1)];
  if (cfg.watch || role === null) { lv[0] = levelOf((cfg.levels ? cfg.levels[0] : 3) - 1); lv[1] = levelOf((cfg.levels ? cfg.levels[1] : cfg.level ?? 3) - 1); }
  const assist = cfg.assist ?? 1;
  const userFirstBats = role === 'bat' || role === null;
  const teamNames = ['Home side', 'Visitors'];
  const s = {
    t: 0, tick: 0, cfg: { ...cfg, role, assist }, role, mode: mode.key,
    teams: [{ name: teamNames[0], lvl: lv[0].key, names: NAMES_A }, { name: teamNames[1], lvl: lv[1].key, names: NAMES_B }],
    innNo: 0, inn: null, innings: [], phase: 'ready', pt: 0, ft: 0, ev: [], evId: 0, over: false, result: null, hold: null, hints: 3,
    d: null, plan: null, sw: null, res: null, last: null, field: [], live: null, aim: { type: 'straight', bx: 0.2, bz: 4.5, speed: 16 }, ctl: { target: null, tapAt: -9, throwEnd: -1, run: false },
    bowlerAt: { x: 0.25, z: PITCH + 4.6 }, hand: 1, stumpsBroken: 0, view: 'bat', ballSeq: 0, call: null,
  };
  const hid = (o, k, v) => Object.defineProperty(o, k, { value: v, enumerable: false, writable: true, configurable: true });

  const humanBats = () => role === 'bat' && s.inn.bat === 0;
  const humanBowls = () => role === 'bowl' && s.inn.bat === 1;
  const humanFields = () => (role === 'inner' || role === 'deep') && s.inn.bat === 1;
  const fieldLevel = () => lv[1 - s.inn.bat];
  const batLevel = () => lv[s.inn.bat];
  const ev = (type, o = {}) => { s.ev.push({ id: s.evId++, type, t: s.t, ...o }); if (s.ev.length > 120) s.ev.splice(0, 40); };

  // ---- innings ---------------------------------------------------------------------------------------------------------------
  function newInnings(no, bat, target = null) {
    const names = s.teams[bat].names;
    const nb = Math.min(mode.wkts + 2, 8);
    s.inn = {
      no, bat, maxBalls: mode.balls, maxWk: mode.wkts, balls: 0, wk: 0, runs: 0, target, f4: 0, f6: 0, over: [], recent: [], wides: 0,
      batters: Array.from({ length: nb }, (_, i) => ({ name: names[i], runs: 0, balls: 0, out: '', end: i === 0 ? 0 : i === 1 ? 1 : -1, f4: 0, f6: 0 })),
      st: 0, ns: 1, next: 2, zoneRuns: [0, 0],
    };
    // the fielding side
    const fl = makeFielders(fieldLevel(), s.teams[1 - bat].names.map((n, i) => n));
    // distinct names per fielding slot
    fl.forEach((f, i) => { f.name = s.teams[1 - bat].names[i % s.teams[1 - bat].names.length]; });
    s.field = fl;
    const ctlSlot = CONTROL_SLOT[role];
    for (const f of fl) f.ctl = humanFields() && f.id === ctlSlot;
    s.ctl = { target: null, tapAt: -9, throwEnd: -1, run: false };
    s.phase = 'ready'; s.pt = 0; s.d = null; s.live = null; s.sw = null; s.res = null; s.last = null; s.stumpsBroken = 0; s.call = null;
    s.hints = cfg.practice ? 99 : 3;
    ev('innings', { no, bat });
    prepBall();
  }

  // ---- one ball ---------------------------------------------------------------------------------------------------------------
  function bowlerLevelObj() { return fieldLevel(); }
  function analysisField() {
    return s.field.filter((f) => f.role !== 'wk' || true).map((f) => ({ id: f.id, role: f.role, x: f.x0, z: f.z0, spd: f.ctl ? levelOf(MATE).spd : f.spd, react: f.ctl ? 0.3 : f.react, level: f.level, ctl: f.ctl, name: f.name }));
  }

  function prepBall() {
    s.phase = 'ready'; s.pt = 0; s.ft = 0; s.d = null; s.plan = null; s.sw = null; s.res = null; s.live = null; s.hold = null; s.stumpsBroken = 0;
    s.view = 'bat';
    s.ctl.run = false; s.ctl.ready = false; s.waitReady = false; if (s.ctl.target && s.live) s.ctl.target = null;
    // fielders go back to their places
    for (const f of s.field) { f.st = 'ready'; f.act = null; f.tried = false; f.reactLeft = f.react; }
    // striker / non-striker ends
    const i = s.inn;
    for (const b of i.batters) if (b.end >= 0 && !b.out) { /* ends are kept */ }
    s.ballSeq++; s.bounceDone = false;
    if (!humanBowls()) {
      const pl = planDelivery({ level: bowlerLevelObj(), inn: i, recent: i.recent, zoneRuns: i.zoneRuns }, R.a);
      s.next = { spec: pl.spec, why: pl.why, len: pl.len, type: pl.type };
      s.d = flyDelivery(pl.spec);
      planBatter();
    } else s.next = null;
  }

  function planBatter() {
    const i = s.inn;
    if (humanBats()) { s.plan = null; return; }
    const ctx = { fielders: analysisField(), lvl: batLevel(), inn: i, runTime: RUN_TIME };
    // the computer batter does not know the ball exactly: it reads line, height and arrival time with an error that shrinks with its level
    const sk = batLevel().skill, gz = () => (R.a.next() + R.a.next() + R.a.next() - 1.5) * 2;
    const dP = { ...s.d, xc: s.d.xc + gz() * lerp(0.34, 0.05, sk), yc: Math.max(0.05, s.d.yc + gz() * lerp(0.28, 0.04, sk)), tC: s.d.tC + gz() * lerp(0.05, 0.008, sk) };
    dP.lengthClass = lengthClassOf(dP.yc, s.d.bounced);
    s.plan = planBat(ctx, dP, R.a);
    if (cfg.practice && humanFields()) {   // practice: the computer batter hits toward the human fielder so the drill has something to do
      const uf = s.field.find((f) => f.ctl);
      const dist = Math.hypot(uf.x0, uf.z0);
      s.plan.kind = 'swing'; s.plan.angle = Math.atan2(uf.x0, uf.z0) / DEG_ + R.a.range(-14, 14); s.plan.power = dist > 14 ? 0.62 : 0.5; s.plan.terr = 0;
    }
    s.plan.swingAt = dP.tC - (s.plan.kind === 'block' ? 0 : SWING_LEAD) + s.plan.terr;
    if (cfg.watch) {
      const pl = s.next;
      const lines = [];
      if (pl) lines.push(`Bowler: ${DELIVERIES[pl.type].name.toLowerCase()}, ${lengthWord[s.d.lengthClass] ?? ''} ${lineWord(s.d.xc)}.`);
      lines.push(...s.plan.reasons.slice(1));
      const dec = s.plan.kind === 'swing' ? `Decision: swing ${Math.abs(s.plan.angle) < 15 ? 'straight' : s.plan.angle > 0 ? 'to the off side' : 'to the leg side'}, ${s.plan.power > 0.75 ? 'hard and in the air' : s.plan.power > 0.45 ? 'firm along the ground' : 'a soft push'}.` : s.plan.kind === 'block' ? 'Decision: defend.' : 'Decision: leave it.';
      s.hold = { id: s.ballSeq * 10, kind: 'ball', lines, decision: dec };
    }
  }

  // human bowler: flick accepted
  function bowl(aim) {
    if (s.phase !== 'aim') return false;
    const a = { type: aim.type ?? 'straight', bx: clamp(aim.bx, -BOUNCE.xMax, BOUNCE.xMax), bz: clamp(aim.bz, BOUNCE.zMin, BOUNCE.zMax), speed: clamp(aim.speed, SPEED.min, SPEED.max) };
    // faster flicks are wilder: an error that grows with the pace
    const pace = (a.speed - SPEED.min) / (SPEED.max - SPEED.min);
    const spec = makeSpec(a.type, a, R.f, 0.12 + 0.34 * pace);
    s.next = { spec, why: '', len: '', type: a.type };
    s.d = flyDelivery(spec);
    planBatter();
    s.phase = 'runup'; s.pt = 0;
    return true;
  }

  function startRunup() {
    s.phase = 'runup'; s.pt = 0;
    ev('runup');
  }

  function release() {
    s.phase = 'flight'; s.ft = 0; s.pt = 0;
    ev('release', { x: s.d.spec.relX, z: PITCH - 0.8 });
    s.bowlerRel = { x: s.d.spec.relX + 0.2, z: PITCH - 0.7 };
  }

  // the human batter's swipe
  function swing(a) {
    if (s.phase !== 'flight' || s.sw || !humanBats()) return false;
    commitSwing({ kind: a.kind ?? 'swing', angle: a.angle, power: a.power, t: a.t ?? s.ft });
    return true;
  }
  function commitSwing(sw) {
    const res = resolveSwing(s.d, sw, R.m, [0.75, 1, 1.3][assist] ?? 1);
    s.sw = { ...sw, T_c: sw.t + (sw.kind === 'block' ? 0 : SWING_LEAD), res: { kind: res.kind, contact: res.contact, e: res.e, label: res.label, why: res.why, elev: res.elev, speed: res.speed, angle: res.angle, Q: res.Q, init: res.init } };
    s.resFull = res;
    ev('swing', { tc: s.sw.T_c, contact: res.contact, kind: res.kind });
  }

  function contactNow() {
    const res = s.resFull;
    s.phase = 'live';
    s.res = s.sw.res;
    if (res.kind === 'miss') { s.phase = 'flight'; return; }
    ev('crack', { q: res.Q, kind: res.kind, shot: shotName(res.angle, res.elev, s.d, res.kind) });
    s.shot = shotName(res.angle, res.elev, s.d, res.kind);
    startLive(res);
  }

  // ---- the live ball ----------------------------------------------------------------------------------------------------------
  function startLive(res) {
    const track = flyBall(res.init);
    const i = s.inn;
    const b0 = i.batters[i.st], b1 = i.batters[i.ns];
    s.live = {
      t: 0, i: 0, bs: 'fly', track, holder: -1, th: null, plan: null, chaser: -1, bounces: 0, dead: false, deadT: 0, deadReason: '', runsDone: 0,
      boundary: null, out: null, caught: false, pickT: -1, replanAt: 0, userHold: 0, aiWait: 0, shot: s.shot, kind: res.kind,
      rn: [
        { b: i.st, end: 0, state: 'rest', from: 0, to: 1, u: 0, tau: 0, dismissed: false },
        { b: i.ns, end: 1, state: 'rest', from: 1, to: 0, u: 0, tau: 0, dismissed: false },
      ],
      queue: false, advice: null, tickAdv: 0, wicket: null, lastRunT: -9, hit: { x: res.init.x, y: res.init.y, z: res.init.z },
    };
    void b0; void b1;
    // the bowler finishes his follow-through
    const bw = s.field[0];
    bw.x = s.bowlerRel.x + 1.2; bw.z = PITCH - 3.6; bw.vx = 0; bw.vz = -1.5;
    for (const f of s.field) { f.reactLeft = f.ctl ? 0 : f.react; f.tried = false; f.st = 'ready'; f.act = null; f.tx = null; f.tz = null; }
    replan(true);
  }

  const fAnalysis = () => s.field.map((f) => ({ id: f.id, role: f.role, x: f.x, z: f.z, spd: f.ctl ? levelOf(MATE).spd : f.spd, react: Math.max(0, f.reactLeft), level: f.level, ctl: f.ctl, name: f.name }));

  function replan(force = false) {
    const L = s.live;
    if (L.bs === 'held' || L.bs === 'thrown' || L.bs === 'over') return;
    if (!force && L.t < L.replanAt) return;
    L.replanAt = L.t + 0.2;
    const all = fAnalysis();
    const track = L.track;
    const pl = intercept(track, all, L.bs === 'loose' ? track.n - 1 : L.i, { keepers: true, skip: (f) => f.ctl });
    L.plan = pl;
    // does the human's fielder get there at least as soon?
    L.claim = null;
    const uf = s.field.find((f) => f.ctl);
    if (uf && L.bs === 'fly') {
      const mine = intercept(track, [{ id: uf.id, role: uf.role, x: uf.x, z: uf.z, spd: levelOf(MATE).spd, react: 0.0, level: uf.level, ctl: true }], L.i, { keepers: false });
      if (mine && mine.kind !== 'boundary' && mine.fid >= 0 && (pl.kind === 'boundary' || mine.idx <= pl.idx + 8) && mine.slack >= -0.05) {
        L.claim = { idx: mine.idx, pos: mine.pos, kind: mine.kind, slack: mine.slack, d: mine.d };
      }
    }
    // an AI fielder gives the human a moment to call for the ball: it holds back while the human is going for it (or for half a second)
    if (pl.fid < 0) L.chaser = -1;
    else if (L.claim) {
      if (L.claimSeen == null) L.claimSeen = L.t;
      const engaged = !!s.ctl.target && (s.t - (s.ctl.targetAt ?? -9) < 0.8 || Math.hypot(uf.x - s.ctl.target.x, uf.z - s.ctl.target.z) > 0.6);
      L.chaser = (engaged || L.t - L.claimSeen < 0.5) ? -1 : pl.fid;
    } else L.chaser = pl.fid;
    // practice drill: the computer team mates leave the ball to the human fielder for a few seconds
    if (cfg.practice && uf && L.t < 3.5 && L.bs === 'fly') L.chaser = -1;
  }

  const ballPosNow = () => {
    const L = s.live;
    if (!L) return null;
    if (L.bs === 'fly') return trackPos(L.track, L.i);
    if (L.bs === 'loose') return L.loosePos;
    if (L.bs === 'held') { const f = s.field[L.holder]; return [f.x, 1.0, f.z]; }
    if (L.bs === 'thrown') return throwPos(L.th.fl, L.th.t);
    if (L.bs === 'over') return L.overPos;
    return [0, 0, 0];
  };

  const faceTo = (f, x, z) => { const dx = x - f.x, dz = z - f.z, l = Math.hypot(dx, dz); if (l > 0.05) { f.fx = dx / l; f.fz = dz / l; } };
  function moveTo(f, tx, tz, dt, vmax = f.spd, accel = 15) {
    const dx = tx - f.x, dz = tz - f.z, d = Math.hypot(dx, dz);
    let wx = 0, wz = 0;
    if (d > 0.04) { const sp = Math.min(vmax, Math.sqrt(2 * accel * 0.7 * d) + 0.2); wx = dx / d * sp; wz = dz / d * sp; }
    const ax = wx - f.vx, az = wz - f.vz, al = Math.hypot(ax, az), step = accel * dt;
    if (al > step) { f.vx += ax / al * step; f.vz += az / al * step; } else { f.vx = wx; f.vz = wz; }
    f.x += f.vx * dt; f.z += f.vz * dt;
    const sp2 = Math.hypot(f.vx, f.vz);
    if (sp2 > 0.5) { f.fx = f.vx / sp2; f.fz = f.vz / sp2; }
    // stay inside the rope
    const r = fenceRatio(f.x, f.z);
    if (r > 0.985) { const cx = FIELD.cx, cz = FIELD.cz; f.x = cx + (f.x - cx) * 0.985 / r; f.z = cz + (f.z - cz) * 0.985 / r; }
  }

  function stepLive(dt) {
    const L = s.live;
    L.t += dt;
    const i = s.inn;
    // ---- the ball
    if (L.bs === 'fly') {
      const prev = L.i;
      L.i += 1;
      for (const b of L.track.bounces) if (b > prev && b <= L.i) { ev('ground', { x: L.track.p[b * 3], z: L.track.p[b * 3 + 2] }); L.bounces++; }
      if (L.track.boundary && L.i >= L.track.boundary.idx) {
        L.bs = 'over'; L.overPos = trackPos(L.track, L.track.boundary.idx); L.boundary = L.track.boundary.kind;
        ev('boundary', { kind: L.boundary, x: L.overPos[0], z: L.overPos[2] });
        liveDead('boundary');
      } else if (L.i >= L.track.n - 1) { L.bs = 'loose'; L.loosePos = trackPos(L.track, L.track.n - 1); L.i = L.track.n - 1; }
    } else if (L.bs === 'thrown') {
      L.th.t += dt;
      if (L.th.t >= L.th.fl.T && !L.th.done) { L.th.done = true; throwArrives(); }
    } else if (L.bs === 'over') { /* dead */ }
    // ---- who chases?
    if (L.aiWait > 0) L.aiWait = Math.max(0, L.aiWait - dt);
    replan(false);
    // ---- fielders
    const bp = ballPosNow();
    for (const f of s.field) {
      if (!f.ctl && f.reactLeft > 0) f.reactLeft = Math.max(0, f.reactLeft - dt);
      if (f.ctl) humanFielder(f, dt, bp);
      else aiFielder(f, dt, bp);
    }
    // ---- fielder / ball interactions
    if (L.bs === 'fly' || L.bs === 'loose') interactions(bp);
    // ---- the batters
    stepRunners(dt);
    // ---- end of the live ball
    if (L.dead) {
      L.deadT += dt;
      const resting = L.rn.every((r) => r.state === 'rest' || r.dismissed);
      if ((resting && L.deadT > 0.6) || L.deadT > 4.5) finishBall();
    }
    if (L.t > 16 && !L.dead) liveDead('timeout');
    void i;
  }

  // ---- fielders ----------------------------------------------------------------------------------------------------------------
  function aiFielder(f, dt, bp) {
    const L = s.live;
    if (f.role === 'wk') { // keepers stay behind the stumps, take throws, and chase an edge or a block that dribbles away
      const z = f.end === 0 ? -3.2 : PITCH + 3.4;
      if (L.bs === 'held' && L.holder === f.id && !L.dead) { moveTo(f, f.x, f.z, dt); f.gather = (f.gather ?? 0) + dt; if (f.gather >= GATHER_T) aiThrow(f); faceTo(f, f.end === 0 ? 0 : 0, f.end === 0 ? PITCH : 0); return; }
      if (L.chaser === f.id && (L.bs === 'fly' || L.bs === 'loose') && L.plan && !L.dead) { f.tx = L.plan.pos[0]; f.tz = L.plan.pos[2]; if (f.reactLeft <= 0) moveTo(f, f.tx, f.tz, dt, f.spd); else moveTo(f, f.x, f.z, dt); faceTo(f, f.tx, f.tz); return; }
      if (L.bs === 'thrown' && L.th.end === f.end) moveTo(f, f.end === 0 ? 0.4 : -0.5, f.end === 0 ? -1.6 : PITCH + 1.6, dt, f.spd);
      else moveTo(f, f.x0, z, dt, f.spd * 0.6);
      faceTo(f, bp[0], bp[2]);
      return;
    }
    if (L.bs === 'held' && L.holder === f.id) {
      moveTo(f, f.x, f.z, dt);   // stands while gathering
      f.gather = (f.gather ?? 0) + dt;
      if (f.gather >= GATHER_T && !L.userThrowPending) aiThrow(f);
      return;
    }
    if (L.dead) { // ball dead: jog back
      moveTo(f, f.x0, f.z0, dt, f.spd * 0.55);
      return;
    }
    if ((L.bs === 'fly' || L.bs === 'loose') && L.chaser === f.id && L.plan) {
      f.tx = L.plan.pos[0]; f.tz = L.plan.pos[2];
      if (f.reactLeft <= 0) { f.st = 'run'; moveTo(f, f.tx, f.tz, dt, f.spd); } else moveTo(f, f.x, f.z, dt);
      faceTo(f, f.tx, f.tz);
      return;
    }
    // everybody else: hold the place, face the ball, a step toward it once the ball is going their way
    moveTo(f, f.x, f.z, dt);
    f.st = 'ready';
    if (bp) faceTo(f, bp[0], bp[2]);
  }

  function humanFielder(f, dt, bp) {
    const L = s.live;
    const tgt = s.ctl.target;
    if (L.dead) { moveTo(f, f.x0, f.z0, dt, f.spd * 0.55); return; }
    if (tgt && !(L.bs === 'held' && L.holder === f.id)) { moveTo(f, tgt.x, tgt.z, dt, levelOf(MATE).spd); f.st = 'run'; }
    else moveTo(f, f.x, f.z, dt, levelOf(MATE).spd, 18);
    if (L.bs === 'held' && L.holder === f.id) {
      f.gather = (f.gather ?? 0) + dt;
      L.userHold += dt;
      // chosen throw, or the throw is made automatically after a short time (so the game never stalls)
      if (s.ctl.throwEnd >= 0 && f.gather >= GATHER_T * 0.6) { doThrow(f, s.ctl.throwEnd, true); s.ctl.throwEnd = -1; }
      else if (L.userHold > 3.0) doThrow(f, bestThrowEnd(f), true);
    }
    if (!tgt && bp) faceTo(f, bp[0], bp[2]);
  }

  // which end a throw from f should go to: the one a running batter is heading to and is likely to miss, else the nearer end
  function bestThrowEnd(f) {
    const L = s.live;
    let bestEnd = -1, bestSlack = -9;
    const ta = (end) => throwTime(f.x, f.z, 0, end === 0 ? 0 : PITCH) - 0.3 + 0.0;
    for (const r of L.rn) {
      if (r.state !== 'run' || r.dismissed) continue;
      const tl = (1 - r.u) / 1 * 0; void tl;
      const left = Math.max(0, T_RUN - r.tau);
      const slack = left - (ta(r.to));
      if (slack > bestSlack) { bestSlack = slack; bestEnd = r.to; }
    }
    if (bestEnd >= 0) return bestEnd;
    // runners at rest: if one could still run toward an end, throw there; otherwise throw to the nearer end
    return Math.hypot(f.x, f.z) < Math.hypot(f.x, f.z - PITCH) ? 0 : 1;
  }

  function aiThrow(f) {
    const L = s.live;
    const end = bestThrowEnd(f);
    if (cfg.watch) {
      if (!L.thinkDone) {
        L.thinkDone = true;
        const running = L.rn.some((r) => r.state === 'run');
        s.hold = { id: s.ballSeq * 10 + 3, kind: 'throw', lines: [`${f.name} has the ball ${Math.hypot(f.x, f.z - (end === 0 ? 0 : PITCH)).toFixed(0)} m from the ${end === 0 ? 'batter\'s' : 'bowler\'s'} end.`, running ? 'A batter is running toward that end: a direct hit would be a run out.' : 'Nobody is running: send it back to the keeper and kill the ball.'], decision: `Decision: throw to the ${end === 0 ? 'batter\'s end' : 'bowler\'s end'}.` };
        L.pendingThrow = { f, end };
        return;
      }
      return;
    }
    doThrow(f, end, false);
  }

  function doThrow(f, end, human) {
    const L = s.live;
    if (L.bs !== 'held' || L.holder !== f.id) return;
    const ez = end === 0 ? 0 : PITCH;
    const acc = throwAccuracy(human ? levelOf(MATE) : f.level, f.x, f.z, end);
    const hit = R.f.chance(acc);
    const miss = hit ? 0 : R.f.range(0.55, 2.2) * (R.f.chance(0.5) ? 1 : -1);
    const from = [f.x, 1.7, f.z], to = [hit ? R.f.range(-0.08, 0.08) : miss, 0.5, ez];
    const fl = throwFlight(from, to);
    L.th = { fl, t: -0.12, end, hit, from: f.id, done: false, who: f.id };   // the arm winds up for 0.12 s before the ball leaves
    L.bs = 'thrown'; L.holder = -1; f.gather = 0; f.act = { kind: 'throw', t0: s.t };
    faceTo(f, 0, ez);
    ev('throw', { from: f.id, end, hit, T: fl.T });
  }

  function throwArrives() {
    const L = s.live, th = L.th;
    const end = th.end;
    // who is caught out? a batter running to this end who has not yet arrived
    let out = null;
    if (th.hit && !L.dead) {
      for (const r of L.rn) if (r.state === 'run' && !r.dismissed && r.to === end) { out = r; break; }
    }
    L.bs = 'loose'; L.loosePos = [th.fl.p0[0] + th.fl.v[0] * th.fl.T, BALL_R, end === 0 ? -0.2 : PITCH + 0.2];
    L.th = null;
    if (out) {
      out.dismissed = true; out.uOut = out.u; out.state = 'out';
      L.wicket = { how: 'run out', b: out.b };
      ev('stumps', { end }); s.stumpsBroken = 1; s.stumpsEnd = end;
      ev('wicket', { how: 'run out', b: out.b });
      liveDead('runout');
    } else {
      // received by the keeper / bowler at that end: the ball is dead
      const kp = s.field.find((f) => f.role === 'wk' && f.end === end);
      L.bs = 'held'; L.holder = kp ? kp.id : 0; L.thinkDone = false;
      liveDead('returned');
    }
  }

  function liveDead(reason) {
    const L = s.live;
    if (L.dead) return;
    L.dead = true; L.deadReason = reason; L.deadT = 0;
    if (L.bs === 'fly') { L.bs = 'loose'; L.loosePos = trackPos(L.track, L.i); }
    ev('dead', { reason });
  }

  function interactions(bp) {
    const L = s.live;
    if (L.dead) return;
    const [bx, by, bz] = bp;
    const speed = L.bs === 'fly' ? trackSpeed(L.track, L.i) : 0;
    for (const f of s.field) {
      if (L.bs === 'held' || L.bs === 'thrown') break;
      if (f.role === 'bowler' && L.t < 0.6) continue;
      if (f.tried && f.dropT != null && s.t - f.dropT > 0.7) { f.tried = false; f.dropT = null; }
      const dh = Math.hypot(f.x - bx, f.z - bz);
      const airborneBall = by >= REACH.catchLo && by <= REACH.catchHi && L.bounces === 0 && L.bs === 'fly';
      if (f.ctl) { humanContact(f, dh, bx, by, bz, speed, airborneBall); continue; }
      if (f.reactLeft > 0 && dh > 0.8) continue;
      if (airborneBall && dh <= REACH.catchR && !f.tried) {
        f.tried = true;
        const runD = Math.hypot(f.x0 - f.x, f.z0 - f.z);
        const p = catchChance(f.level, speed, by, runD) * (f.role === 'wk' ? 1.03 : 1);
        if (R.f.chance(p)) { caughtOut(f, by, 1, bp); return; }
        dropBall(f, bx, by, bz); return;
      }
      if (by <= 1.15 && dh <= REACH.pickR && !f.tried) {
        f.tried = true;
        let fumble = false;
        if (speed > 15 && R.f.chance(0.04 + 0.01 * (speed - 15) + (1 - f.level.hold) * 0.12)) fumble = true;
        if (fumble) { dropBall(f, bx, by, bz, true); return; }
        pickUp(f, by, false, bp); return;
      }
    }
  }

  function humanContact(f, dh, bx, by, bz, speed, airborneBall) {
    const L = s.live;
    const nearAir = airborneBall ? REACH.catchR : REACH.pickR;
    const tapped = s.t - s.ctl.tapAt;
    const dive = tapped >= 0 && tapped < 0.5;
    const reach = dive ? REACH.diveR : nearAir;
    if (f.tried) return;
    if (airborneBall && dh <= (dive ? REACH.diveR : REACH.catchR)) {
      // catching needs a well-timed tap: the closer the tap to the ball's arrival, the surer the hands
      f.tried = true;
      const q = tapQuality(f, L, bx, by, bz);
      const runD = 0;
      let p = catchChance(levelOf(MATE), speed, by, runD) * (0.5 + 0.55 * q) + (q > 0.8 ? 0.06 : 0);
      if (tapped < 0 || tapped > 0.5) p = Math.min(p, 0.28);
      if (R.f.chance(clamp(p, 0.05, 0.98))) { caughtOut(f, by, q, [bx, by, bz]); return; }
      dropBall(f, bx, by, bz); return;
    }
    if (by <= 1.15 && dh <= reach) {
      f.tried = true;
      const diving = dive && dh > REACH.pickR;
      let fumble = false;
      if (speed > 13 && !dive && R.f.chance(0.05 + 0.012 * (speed - 13))) fumble = true;
      if (fumble) { dropBall(f, bx, by, bz, true); return; }
      pickUp(f, by, diving, [bx, by, bz]); return;
    }
  }

  // how good the human's timing was, 0..1: the tap against the moment the ball reaches the hands
  function tapQuality(f, L, bx, by, bz) {
    const tapped = s.t - s.ctl.tapAt;
    if (tapped < 0 || tapped > 0.5) return 0.2;
    return clamp(1 - Math.abs(tapped - 0.18) / 0.32, 0.25, 1);
  }

  function caughtOut(f, y, q = 1, pos = null) {
    const L = s.live; L.takePos = pos ? [pos[0], pos[1], pos[2]] : [f.x, y, f.z];
    L.bs = 'held'; L.holder = f.id; L.caught = true; f.gather = 0; f.act = { kind: 'catch', t0: s.t };
    L.wicket = { how: f.role === 'wk' ? 'caught behind' : 'caught', b: L.rn[0].b, by: f.id };
    ev('catch', { by: f.id, q });
    ev('wicket', { how: L.wicket.how, b: L.rn[0].b, by: f.id });
    L.rn[0].dismissed = true; L.rn[0].uOut = L.rn[0].u; L.rn[0].state = 'out';
    liveDead('caught');
  }

  function dropBall(f, bx, by, bz, ground = false) {
    const L = s.live;
    f.act = { kind: ground ? 'fumble' : 'drop', t0: s.t };
    ev(ground ? 'fumble' : 'drop', { by: f.id });
    // the ball drops near the fielder and rolls on (a new, slower track)
    const sp = L.bs === 'fly' ? trackSpeed(L.track, L.i) : 0;
    const v = L.bs === 'fly' ? [(L.track.p[Math.min(L.i + 1, L.track.n - 1) * 3] - bx) * 60, 0, (L.track.p[Math.min(L.i + 1, L.track.n - 1) * 3 + 2] - bz) * 60] : [0, 0, 0];
    const k = ground ? 0.4 : 0.15;
    const tr = flyBall({ x: bx, y: Math.max(0.05, by * 0.6), z: bz, vx: v[0] * k + R.f.range(-1.5, 1.5), vy: 1.2, vz: v[2] * k + R.f.range(-1.5, 1.5) }, { touched: true });
    void sp;
    L.track = tr; L.i = 0; L.bs = 'fly'; L.bounces = 1; f.tried = true; f.dropT = s.t; L.replanAt = 0; L.aiWait = 0;
    for (const g of s.field) if (g.id !== f.id) g.tried = false;
    L.userHold = 0;
    replan(true);
    // the fielder who dropped it may try again after a beat; others reset
  }

  function pickUp(f, y, diving = false, pos = null) {
    const L = s.live; L.takePos = pos ? [pos[0], pos[1], pos[2]] : [f.x, y, f.z];
    L.bs = 'held'; L.holder = f.id; f.gather = diving ? -0.45 : 0; L.pickT = L.t; L.thinkDone = false; L.userHold = 0;
    f.act = { kind: diving ? 'dive' : (y > 0.5 ? 'catchBounce' : 'pick'), t0: s.t };
    ev('pick', { by: f.id, dive: diving, y });
    s.ctl.throwEnd = -1;
  }

  // ---- runners ----------------------------------------------------------------------------------------------------------------
  function startRun() {
    const L = s.live;
    if (!L || L.dead) return false;
    if (L.rn.some((r) => r.state === 'run' || r.dismissed)) return false;
    for (const r of L.rn) { r.state = 'run'; r.from = r.end; r.to = 1 - r.end; r.tau = 0; r.u = 0; }
    L.lastRunT = L.t; L.queue = false;
    ev('runstart', { from: L.rn[0].from });
    return true;
  }
  // the human's RUN button: start a run, or queue the next one while running
  function callRun() {
    const L = s.live;
    if (!L || L.dead || !humanBats()) return false;
    if (L.rn.some((r) => r.state === 'run')) { L.queue = !L.queue; return true; }
    return startRun();
  }

  function stepRunners(dt) {
    const L = s.live;
    let arrived = false;
    for (const r of L.rn) {
      if (r.state !== 'run') continue;
      r.tau += dt;
      r.u = runU(r.tau);
      if (r.tau >= T_RUN) { r.state = 'rest'; r.end = r.to; r.u = 0; r.tau = 0; arrived = true; }
    }
    if (arrived && L.rn.every((r) => r.state !== 'run')) {
      if (!L.rn.some((r) => r.dismissed)) { L.runsDone++; ev('run', { n: L.runsDone }); }
      // the next run (human queue, or the AI's decision)
      if (L.queue && !L.dead) startRun();
      L.queue = false;
    }
    // computer batters decide about running every 0.1 s
    if (!L.dead && !humanBats() && L.rn.every((r) => r.state === 'rest') && L.t - L.tickAdv >= 0.1) {
      L.tickAdv = L.t;
      const adv = liveAdvice();
      if (adv && adv.act === 'run') {
        if (cfg.watch) {
          if (!L.runThink || L.runThink !== L.runsDone + 1) {
            L.runThink = L.runsDone + 1;
            s.hold = { id: s.ballSeq * 10 + 5 + L.runsDone, kind: 'run', lines: [adv.text], decision: 'Decision: RUN.', act: 'run' };
          }
        } else startRun();
      }
    }
    // a runner mid-run when the ball is dead keeps going (handled by the state machine); nothing else to do here
  }

  // is the next run safe, from the ball's current state
  function liveAdvice() {
    const L = s.live;
    if (!L || L.dead) return null;
    let holdT, hx, hz, who;
    if (L.bs === 'held') { const f = s.field[L.holder]; holdT = Math.max(0, GATHER_T - (f.gather ?? 0)); hx = f.x; hz = f.z; who = f.name; }
    else if (L.bs === 'thrown') return { act: 'hold', slack: -9, text: 'The throw is already in the air. Stay.' };
    else if (L.bs === 'over') return null;
    else {
      const pl = L.plan;
      if (!pl) return null;
      if (pl.kind === 'boundary') return { act: 'hold', slack: -9, text: 'It is going over the rope: no need to run.' };
      if (pl.kind === 'catch') return { act: 'hold', slack: -9, text: 'It is in the air and a fielder is under it: stay in your ground.' };
      holdT = pl.t; hx = pl.pos[0]; hz = pl.pos[2]; who = pl.f ? pl.f.name : 'a fielder';
    }
    const r0 = L.rn[0];
    const toEnd = r0.end === 0 ? 1 : 0;
    const margin = runMargin(batLevel(), s.inn);
    return runAdvice({ holdT, hx, hz, toEnd, start: 0.12, margin, who });
  }

  // ---- finishing a ball ---------------------------------------------------------------------------------------------------------
  function finishBall() {
    const L = s.live;
    const i = s.inn;
    let runs = 0, boundary = 0, wicket = null;
    if (L.boundary) { boundary = L.boundary; runs = L.boundary; }
    else runs = L.runsDone;
    if (L.wicket) wicket = L.wicket;
    const striker = i.batters[L.rn[0].b];
    striker.balls += 1;
    // credit runs to the batters (to the one who faced: simple)
    if (!(wicket && wicket.how !== 'run out')) striker.runs += runs; else striker.runs += 0;
    if (boundary === 4) { i.f4++; striker.f4++; } else if (boundary === 6) { i.f6++; striker.f6++; }
    i.runs += runs; i.balls += 1;
    const dirBucket = Math.abs(L.track.p[Math.min(L.track.n - 1, 30) * 3]) > 0 ? (L.track.p[Math.min(L.track.n - 1, 30) * 3] >= 0 ? 0 : 1) : 0;
    i.zoneRuns[dirBucket] += runs;
    const tok = wicket ? 'W' : boundary ? String(boundary) : runs === 0 ? '.' : String(runs);
    i.over.push(tok); i.recent.push(s.next ? s.next.len || 'good' : 'good'); if (i.recent.length > 4) i.recent.shift();
    // ends after the ball
    const endOf = (r) => r.end;
    const ends = L.rn.map((r) => ({ b: r.b, end: endOf(r), out: r.dismissed }));
    for (const e of ends) i.batters[e.b].end = e.end;
    let remaining = ends.filter((e) => !e.out);
    if (wicket) {
      i.wk += 1;
      const outR = L.rn.find((r) => r.dismissed) || L.rn[0];
      i.batters[outR.b].out = wicket.how;
      const survivor = remaining[0];
      if (i.wk < i.maxWk && i.next < i.batters.length) {
        const nb = i.next++;
        const freeEnd = survivor ? 1 - survivor.end : 0;
        i.batters[nb].end = freeEnd;
        remaining = [...remaining, { b: nb, end: freeEnd }];
      }
    }
    // striker is the one at end 0 (or, if a boundary: no change; completed runs decide via ends already)
    const at0 = remaining.find((e) => e.end === 0), at1 = remaining.find((e) => e.end === 1);
    if (at0) i.st = at0.b; if (at1) i.ns = at1.b;
    if (!at0 && at1) { i.st = at1.b; }
    s.last = { runs, boundary, wicket, tok, shot: L.shot, kind: L.kind, deadReason: L.deadReason };
    const text = wicket ? `${wicket.how.toUpperCase()}!` : boundary ? `${boundary === 6 ? 'SIX' : 'FOUR'}!` : runs === 0 ? 'Dot ball' : `${runs} run${runs === 1 ? '' : 's'}`;
    s.call = { text, kind: wicket ? 'wicket' : boundary === 6 ? 'six' : boundary === 4 ? 'four' : runs ? 'run' : 'dot', t: s.t, big: !!(wicket || boundary) };
    ev('result', { ...s.last, text });
    s.phase = 'dead'; s.pt = 0; s.deadFrom = 'live';
    // keep the live ball around for the dead-ball banner (the picture shows the end of the play)
    s.live.finished = true;
    checkInningsEnd();
  }

  function finishNoContact() {
    const i = s.inn;
    const d = s.d;
    const wide = d.wide && !d.bowled && !(s.sw && s.sw.res.contact);
    let wicket = null;
    if (d.bowled && !(s.sw && s.sw.res.contact)) wicket = { how: 'bowled', b: i.st };
    if (wicket) { ev('stumps', { end: 0 }); s.stumpsBroken = 1; s.stumpsEnd = 0; ev('wicket', { how: 'bowled', b: i.st }); }
    let runs = 0, tok;
    const striker = i.batters[i.st];
    if (wide) { runs = 1; i.runs += 1; i.wides++; tok = 'Wd'; i.over.push(tok); }
    else {
      i.balls += 1; striker.balls += 1; tok = wicket ? 'W' : '.'; i.over.push(tok);
      i.recent.push(s.next ? s.next.len || 'good' : 'good'); if (i.recent.length > 4) i.recent.shift();
    }
    if (wicket) {
      i.wk += 1; striker.out = 'bowled';
      if (i.wk < i.maxWk && i.next < i.batters.length) { const nb = i.next++; i.batters[nb].end = 0; i.st = nb; }
    }
    s.last = { runs, boundary: 0, wicket, tok, wide, shot: null, kind: 'miss', deadReason: wide ? 'wide' : 'missed' };
    s.call = { text: wicket ? 'BOWLED!' : wide ? 'Wide ball' : (s.sw && s.sw.res.kind === 'miss' ? 'Missed it' : 'Dot ball'), kind: wicket ? 'wicket' : wide ? 'run' : 'dot', t: s.t, big: !!wicket };
    ev('result', { ...s.last, text: s.call.text });
    s.phase = 'dead'; s.pt = 0; s.deadFrom = 'flight';
    { const bw = s.field[0], r0 = s.bowlerRel || s.bowlerAt; bw.x = r0.x + 1.2; bw.z = PITCH - 3.6; bw.vx = 0; bw.vz = -1.2; }
    checkInningsEnd(wide);
  }

  function checkInningsEnd(wide = false) {
    const i = s.inn;
    let over = false;
    if (i.wk >= i.maxWk) over = true;
    else if (!wide && i.balls >= i.maxBalls) over = true;
    else if (i.target != null && i.runs >= i.target) over = true;
    s.inningsOver = over;
  }

  function endInnings() {
    const i = s.inn;
    s.innings.push({ bat: i.bat, runs: i.runs, wk: i.wk, balls: i.balls, f4: i.f4, f6: i.f6, batters: i.batters.map((b) => ({ name: b.name, runs: b.runs, balls: b.balls, out: b.out })) });
    if (cfg.practice) { s.phase = 'matchEnd'; s.over = true; s.result = null; ev('matchEnd', { winner: -1 }); return; }
    if (s.innNo === 0) {
      s.phase = 'break'; s.pt = 0;
      ev('break');
    } else {
      s.phase = 'matchEnd'; s.over = true;
      const a = s.innings[0], b = s.innings[1];
      const first = a.bat, second = b.bat;
      let winner = -1;
      if (b.runs > a.runs) winner = second; else if (b.runs < a.runs) winner = first;
      s.result = { winner, first, second, runsA: a.runs, runsB: b.runs, wkA: a.wk, wkB: b.wk, margin: winner === first ? a.runs - b.runs : winner === second ? (b.wk >= 0 ? s.inn.maxWk - b.wk : 0) : 0, byWickets: winner === second, tied: winner === -1 };
      ev('matchEnd', { winner });
    }
  }

  function nextInnings() {
    if (s.phase !== 'break') return false;
    s.innNo = 1;
    const first = s.innings[0];
    newInnings(1, 1 - first.bat, first.runs + 1);
    return true;
  }

  // ---- the per-tick update ---------------------------------------------------------------------------------------------------
  function updateReady(dt) {
    s.pt += dt;
    // fielders settle into their places; the human fielder's chosen place counts
    for (const f of s.field) {
      const tx = f.ctl && s.ctl.target ? s.ctl.target.x : f.x0, tz = f.ctl && s.ctl.target ? s.ctl.target.z : f.z0;
      if (f.ctl && s.ctl.target) { f.x0 = tx; f.z0 = tz; }
      moveTo(f, f.x0, f.z0, dt, f.role === 'bowler' ? 5 : 3.2, 8);
    }
    // the human fielder may take a while to choose a place: the ball is bowled when they say ready (or after a long wait)
    if (humanFields() && !s.ctl.ready && s.pt >= READY_T && s.pt < 12) { s.waitReady = true; return; }
    s.waitReady = false;
    if (s.pt >= READY_T) {
      if (humanBowls()) { s.phase = 'aim'; s.pt = 0; }
      else startRunup();
    }
  }

  function step(dt) {
    s.t += dt; s.tick++;
    if (s.stumpsBroken > 0 && s.phase !== 'dead') { /* animation handled by the presenter from the event time */ }
    switch (s.phase) {
      case 'ready': updateReady(dt); break;
      case 'aim': updateReady(dt); s.pt = Math.min(s.pt, 1); break;
      case 'runup': {
        s.pt += dt;
        for (const f of s.field) if (f.role !== 'bowler') moveTo(f, f.x0, f.z0, dt, 3.2, 8);
        if (s.pt >= RUNUP_T) release();
        break;
      }
      case 'flight': {
        s.ft += dt;
        if (!s.bounceDone && s.d.bounceT > 0 && s.ft >= s.d.bounceT) { s.bounceDone = true; const bp = deliveryPos(s.d, s.d.bounceT); ev('bounce', { x: bp[0], z: bp[2] }); }
        // the computer batter swings at its planned moment
        if (!s.sw && s.plan && !humanBats() && s.plan.kind !== 'leave' && s.ft >= s.plan.swingAt) {
          commitSwing({ kind: s.plan.kind === 'block' ? 'block' : 'swing', angle: s.plan.angle, power: s.plan.power, t: s.plan.swingAt });
        }
        if (s.sw && s.ft >= s.sw.T_c - 1e-9 && s.phase === 'flight' && !s.sw.done) { s.sw.done = true; contactNow(); if (s.phase === 'live') break; }
        if (s.ft >= s.d.n / 60 - 0.04 || s.ft > 3) {
          finishNoContact();
        }
        break;
      }
      case 'live': {
        if (s.hold) break;
        stepLive(dt);
        break;
      }
      case 'dead': {
        s.pt += dt;
        // the play winds down: fielders (and the bowler, who jogs back to his mark) return to their places
        for (const f of s.field) moveTo(f, f.x0, f.z0, dt, f.role === 'bowler' ? 5 : 3.4, 8);
        if (s.live) s.live.t += dt;
        if (s.pt >= DEAD_T) {
          if (s.inningsOver) { endInnings(); } else { prepBall(); }
        }
        break;
      }
      case 'break': s.pt += dt; break;
      default: break;
    }
  }

  function update(dt) {
    if (s.hold) { return; }
    step(dt);
    if (s.hold && s.phase === 'ready') { /* Watch & Learn: waits for the shell's THINK/REVEAL timers */ }
  }

  // Watch & Learn: the shell calls this when its THINK and REVEAL timers have run out
  function releaseHold() {
    const h = s.hold;
    s.hold = null;
    if (!h) return;
    const L = s.live;
    if (h.kind === 'run') { if (L && !L.dead) startRun(); }
    else if (h.kind === 'throw') { if (L && L.pendingThrow) { const { f, end } = L.pendingThrow; L.pendingThrow = null; doThrow(f, end, false); } }
  }

  // ---- human actions ----------------------------------------------------------------------------------------------------------------
  function setTarget(x, z) {
    if (x == null) { s.ctl.target = null; return; }
    s.ctl.targetAt = s.t;
    const r = fenceRatio(x, z);
    if (r > 0.97) { const k = 0.97 / r; x = FIELD.cx + (x - FIELD.cx) * k; z = FIELD.cz + (z - FIELD.cz) * k; }
    s.ctl.target = { x, z };
  }
  function tap() { s.ctl.tapAt = s.t; }
  function ready() { s.ctl.ready = true; }
  function throwTo(end) { if (s.live && s.live.bs === 'held' && s.field[s.live.holder] && s.field[s.live.holder].ctl) s.ctl.throwEnd = end; }

  // ---- think ---------------------------------------------------------------------------------------------------------------------
  function think() {
    if (s.hints <= 0) return null;
    if (humanBats() && s.d && (s.phase === 'ready' || s.phase === 'runup' || s.phase === 'flight') && !s.sw) {
      const h = batHint({ fielders: analysisField(), lvl: levelOf(MATE), inn: s.inn, runTime: RUN_TIME }, s.d);
      s.hints--; return { title: 'THINK', lines: h.lines, plan: h.plan };
    }
    if (humanBats() && s.live && !s.live.dead) {
      const adv = liveAdvice();
      if (adv) { s.hints--; return { title: 'THINK', lines: [adv.text], plan: null }; }
    }
    if (humanBowls() && (s.phase === 'aim' || s.phase === 'ready')) {
      const h = bowlHint({ level: levelOf(MATE), inn: s.inn, recent: s.inn.recent, zoneRuns: s.inn.zoneRuns });
      s.hints--; return { title: 'THINK', lines: h.lines, plan: { aim: h.aim, type: h.type } };
    }
    if (humanFields()) {
      const L = s.live;
      const uf = s.field.find((f) => f.ctl);
      if (L && !L.dead && L.bs === 'held' && L.holder === uf.id) {
        const end = bestThrowEnd(uf);
        s.hints--; return { title: 'THINK', lines: [`You have the ball. Throw to the ${end === 0 ? 'batter\'s' : 'bowler\'s'} end: ${L.rn.some((r) => r.state === 'run' && r.to === end) ? 'a batter is running there, so a good throw is a run out' : 'it is the nearer end, so the ball comes back quickly'}.`], plan: { end } };
      }
      if (L && !L.dead && (L.bs === 'fly' || L.bs === 'loose') && L.plan) {
        const pl = L.claim ?? L.plan;
        const line = L.claim ? `The ball is coming your way. Run to the marked spot${pl.kind === 'catch' ? ' and press CATCH just as it reaches your hands to hold the catch' : ' and press CATCH as it arrives to stop it'}.` : `${L.plan.f ? L.plan.f.name : 'A team mate'} is going for it. Cover the throw: stay in line behind them.`;
        s.hints--; return { title: 'THINK', lines: [line], plan: { pos: pl.pos, kind: pl.kind } };
      }
      if (s.phase === 'ready' || s.phase === 'runup') {
        s.hints--; return { title: 'THINK', lines: ['Stand where the batter is likely to hit: gaps between your team mates. Touch the field to move your fielder before the ball is bowled.'], plan: null };
      }
    }
    return null;
  }

  // ---- start ---------------------------------------------------------------------------------------------------------------------------
  const firstBat = role === 'bat' || role === null ? 0 : 1;
  if (resume) {
    s.innNo = resume.innNo;
    newInnings(resume.innNo, resume.bat, resume.target);
    Object.assign(s.inn, resume.inn);
    s.innings = resume.innings.slice();
    s.hints = resume.hints ?? 3;
    prepBall();
  } else {
    newInnings(0, firstBat, null);
  }

  const api = {
    s, update, bowl, swing, setTarget, tap, ready, throwTo, callRun, think, releaseHold, nextInnings, endInnings,
    advice: liveAdvice, analysis: analysisField, bestThrowEnd, humanBats, humanBowls, humanFields, startRunup,
    snapshot() { return { innNo: s.innNo, bat: s.inn.bat, target: s.inn.target, inn: { balls: s.inn.balls, wk: s.inn.wk, runs: s.inn.runs, f4: s.inn.f4, f6: s.inn.f6, over: s.inn.over.slice(), recent: s.inn.recent.slice(), batters: s.inn.batters.map((b) => ({ ...b })), st: s.inn.st, ns: s.inn.ns, next: s.inn.next, zoneRuns: s.inn.zoneRuns.slice(), wides: s.inn.wides }, innings: s.innings.slice(), hints: s.hints }; },
    ballPos: ballPosNow, runU, T_RUN,
  };
  hid(s, 'api', api);
  return api;
}

// Which fixed camera shows the play: the batter's-eye view, or the high field view while the ball is live.
export function viewOf(s) {
  if (s.api && s.api.humanFields() && (s.phase === 'ready' || s.phase === 'dead' && s.deadFrom === 'flight' && false)) return 'field';
  if (s.phase === 'live' && s.live && s.live.t >= HOLD_VIEW) return 'field';
  if (s.phase === 'dead' && s.deadFrom === 'live' && s.pt < 1.1) return 'field';
  return 'bat';
}
export { runU, T_RUN, runDist, BAT, STUMP, insideRope, lerp };
