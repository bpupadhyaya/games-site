// One run down the lane. Pure and deterministic: the only randomness is the rng handed in once at creation, time is the dt of update().
// z = metres along the lane, x = metres across (0 = lane line, + = the rider's right). The rider's own line is SIDE to the left of the lane line,
// so a lance carried in the middle (aim 0) points at the lane line.
import { DROP, REACH, SIDE, AIM_MAX, AIM_RATE, LIFT_T, STRIKE_T, LIFT_X, STRIKE_X, PERFECT_FRAC, PTS, PACES, LANE_LEN } from './consts.js';

const TAU = Math.PI * 2;
const TC = 1.6;                      // time constant of the run-up
export const AFTER_T = 1.7;          // seconds the follow-through is shown before the run is over
export const SLOW_T = 0.26;           // slow motion after contact

export function scoreOf(outcome, perfect, fast, streak) {
  if (outcome === 'lift') return PTS.lift + (perfect ? PTS.perfect : 0) + (fast ? PTS.fast : 0) + Math.min(PTS.streakMax, streak);
  if (outcome === 'strike') return PTS.strike;
  return 0;
}

export function createRun(cfg, rng) {
  const pace = PACES[cfg.pace ?? 1];
  const k = pace.sway * cfg.sway;
  const s = {
    phase: 'ready', t: 0, over: false, pace: cfg.pace ?? 1, slow: 1, evId: 0, events: [],
    z: 0, v: 0, vT: pace.v, v0: pace.v * 0.35,
    sw: { a1: k * 0.65, w1: rng.range(5.4, 6.4), p1: rng.range(0, TAU), a2: k * 0.35, w2: rng.range(2.1, 3.0), p2: rng.range(0, TAU) },
    x: 0, aim: 0, aimT: 0,
    pegZ: Math.round((50 + rng.range(0, 18)) * 10) / 10, pegX: Math.round(rng.range(-cfg.off, cfg.off) * 100) / 100,
    liftT: LIFT_T * cfg.tol, strikeT: STRIKE_T * cfg.tol, liftX: LIFT_X * (0.6 + 0.4 * cfg.tol), strikeX: STRIKE_X * (0.6 + 0.4 * cfg.tol),
    relT: -1, contactT: -1, aimRel: 0, zcP: 0, xcP: 0, zc: 0, xc: 0, dz: 0, dx: 0, dtc: 0, outcome: null, perfect: false, fast: false, points: 0, note: '', unfired: false,
    peg: { vx: rng.range(-2.4, 2.4), vy: rng.range(4.2, 6.6), vz: rng.range(3, 7.5), spin: rng.range(-14, 14), side: rng.next() < 0.5 ? -1 : 1 },
    streak: cfg.streak | 0, stride: 0, shake: 0, held: false,
  };
  const zAt = (t) => s.vT * t - (s.vT - s.v0) * TC * (1 - Math.exp(-t / TC));
  const vAt = (t) => s.vT - (s.vT - s.v0) * Math.exp(-t / TC);
  const swayAt = (t) => { const r = Math.min(1, t / 1.5); return r * (s.sw.a1 * Math.sin(s.sw.w1 * t + s.sw.p1) + s.sw.a2 * Math.sin(s.sw.w2 * t + s.sw.p2)); };
  const ev = (type, extra) => { s.events.push({ id: s.evId++, type, t: s.t, ...extra }); if (s.events.length > 24) s.events.shift(); };
  const clampAim = (a) => Math.max(-AIM_MAX, Math.min(AIM_MAX, a));

  const api = {
    s, zAt, vAt, swayAt,
    // where the lance point lands (z, x) if the finger were lifted now
    mark() { const t = s.phase === 'ready' ? 0 : s.t; return { z: zAt(t + DROP) + REACH, x: swayAt(t + DROP) + s.aim, tt: t + DROP }; },
    start(pace) { if (s.phase !== 'ready') return; if (pace != null) { api.setPace(pace); } s.phase = 'ride'; ev('start'); },
    setPace(p) { s.pace = p; const pc = PACES[p]; s.vT = pc.v; s.v0 = pc.v * 0.35; const k = pc.sway * (cfg.sway); s.sw.a1 = k * 0.65; s.sw.a2 = k * 0.35; },
    release() {
      if (s.phase !== 'ride') return false;
      s.phase = 'drop'; s.relT = s.t; s.contactT = s.t + DROP; s.aimRel = s.aim; s.zcP = zAt(s.contactT) + REACH; s.xcP = swayAt(s.contactT) + s.aimRel; ev('release');
      return true;
    },
    update(dt, ctl) {
      if (s.phase === 'ready' || s.over) return;
      if (ctl && ctl.aim != null) s.aimT = clampAim(ctl.aim);
      if (s.phase === 'ride') {
        const d = s.aimT - s.aim, m = AIM_RATE * dt;
        s.aim = Math.abs(d) <= m ? s.aimT : s.aim + Math.sign(d) * m;
        if (ctl && ctl.release) api.release();
      }
      const slowing = s.contactT >= 0 && s.t >= s.contactT && s.t < s.contactT + SLOW_T;
      s.slow = slowing ? 0.3 : 1;
      s.t += dt * s.slow;
      s.z = zAt(s.t); s.v = vAt(s.t); s.x = swayAt(s.t);
      s.stride += s.v * dt * s.slow * 0.17;
      if (s.shake > 0) s.shake = Math.max(0, s.shake - dt * 3);
      if (s.phase === 'drop' && s.t >= s.contactT) {
        s.t = s.contactT; s.z = zAt(s.t); s.v = vAt(s.t); s.x = swayAt(s.t);
        s.zc = s.z + REACH; s.xc = s.x + s.aimRel;
        s.dz = s.zc - s.pegZ; s.dx = s.xc - s.pegX; s.dtc = s.dz / Math.max(1, s.v);
        const at = Math.abs(s.dtc), ax = Math.abs(s.dx);
        if (at <= s.liftT && ax <= s.liftX) s.outcome = 'lift';
        else if (at <= s.strikeT && ax <= s.strikeX) s.outcome = 'strike';
        else s.outcome = 'miss';
        s.perfect = s.outcome === 'lift' && at <= s.liftT * PERFECT_FRAC && ax <= s.liftX * PERFECT_FRAC;
        s.fast = s.outcome === 'lift' && s.pace === 2;
        s.points = scoreOf(s.outcome, s.perfect, s.fast, s.streak);
        s.note = s.outcome === 'lift' ? (s.perfect ? 'perfect' : 'clean') : (Math.abs(s.dtc) > Math.abs(s.dx) / 2.2 ? (s.dtc < 0 ? 'early' : 'late') : (s.dx < 0 ? 'left' : 'right'));
        s.phase = 'after'; s.shake = s.outcome === 'miss' ? 0.25 : 0.8; ev('contact', { outcome: s.outcome });
      } else if (s.phase === 'ride' && api.mark().z > s.pegZ + 5) {
        // the peg went by with the lance still up
        s.unfired = true; s.outcome = 'miss'; s.note = 'late'; s.points = 0; s.phase = 'after'; s.contactT = s.t; s.dz = 5; s.dx = 0; s.dtc = 0.3; ev('contact', { outcome: 'miss' });
      }
      if (s.phase === 'after' && s.t > s.contactT + AFTER_T && !s.over) { s.over = true; ev('end', { outcome: s.outcome }); }
      if (s.z > LANE_LEN + 20 && !s.over) { s.over = true; ev('end', { outcome: s.outcome || 'miss' }); if (!s.outcome) { s.outcome = 'miss'; s.points = 0; } }
    },
  };
  return api;
}

// A rival's six results for a round, drawn once from the round's rival skill (0-1).
export function rivalRuns(skill, n, rng) {
  const out = []; let streak = 0;
  const pLift = 0.12 + 0.58 * skill, pStrike = 0.28;
  for (let i = 0; i < n; i++) {
    const r = rng.next();
    let outcome = 'miss', perfect = false, fast = false;
    if (r < pLift) { outcome = 'lift'; perfect = rng.next() < 0.12 + 0.3 * skill; fast = rng.next() < 0.2 + 0.5 * skill; }
    else if (r < pLift + (1 - pLift) * pStrike) outcome = 'strike';
    const points = scoreOf(outcome, perfect, fast, streak);
    streak = outcome === 'lift' ? streak + 1 : 0;
    out.push({ outcome, points, perfect });
  }
  return out;
}

// The computer rider: reads only the run state, with small seeded errors so it is steady but not a machine.
export function makeAi(skill, rng) {
  const e = 1 - Math.min(1, skill) * 0.5;
  return { errX: rng.range(-0.22, 0.22) * e, errT: rng.range(-0.11, 0.11) * e, paceWant: skill > 0.6 ? 2 : skill > 0.3 ? 1 : 0 };
}
export function aiControl(run, ai) {
  const s = run.s;
  if (s.phase !== 'ride') return null;
  const tt = s.t + DROP;
  const aim = s.pegX + ai.errX - run.swayAt(tt);
  const zc = run.zAt(tt) + REACH, vc = run.vAt(tt);
  return { aim, release: zc >= s.pegZ + ai.errT * vc };
}
// distance left for the Think hold in Watch & Learn: the computer stops to think when the lance point is this far short of the peg
export const THINK_DIST = 20;
export const thinkDue = (s) => s.phase === 'ride' && !s.held && s.pegZ - (s.z + REACH) <= THINK_DIST + 4;
