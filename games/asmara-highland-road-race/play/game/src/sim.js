// The race simulation: pure, deterministic, no drawing and no randomness while it runs (rider stats are drawn once, in
// createRace, from the game's rng). One step is one second of race time.
//
// Physics (per rider, per second): the power the rider chooses is turned into speed by balancing climbing, rolling and air
// drag (air is thinner in the highlands, wind and the slipstream of riders ahead change the drag). Power above the rider's
// critical power burns a limited reserve (W'); easing off refills it; an empty reserve is a crack: the rider can hold
// only about four fifths of critical power until it has recovered a little.
import { buildCourse, airDensity } from './course.js';

export const DT = 1;
export const G = 9.81, CRR = 0.0045, ETA = 0.975, BIKE = 7.5;
export const EASE = 0, SIT = 1, PUSH = 2, ATTACK = 3;
export const MODE_POWER = [0.72, 0.97, 1.15, 1.4];            // x critical power (SIT follows a wheel instead, see below)
export const SPRINT_M = 300;                                    // the last 300 m are an all-out sprint for everybody
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export const TEAMS = [
  { id: 'sunrise', name: 'Sunrise', jersey: '#ff8b1f', trim: '#fff4dc', helmet: '#fff4dc' },
  { id: 'crimson', name: 'Crimson', jersey: '#d3263c', trim: '#3a0b14', helmet: '#f0d6da' },
  { id: 'jade', name: 'Jade', jersey: '#17a678', trim: '#063d2e', helmet: '#e2f6ee' },
  { id: 'azure', name: 'Azure', jersey: '#2f7fe3', trim: '#0b2a5c', helmet: '#e3eefc' },
  { id: 'violet', name: 'Violet', jersey: '#8a4fd3', trim: '#2a1158', helmet: '#ece2fa' },
  { id: 'graphite', name: 'Graphite', jersey: '#454c5c', trim: '#f2c14e', helmet: '#d8dce6' },
];

// Rider types. cp: critical power W, wp: reserve J, cda: drag area m2, kick: sprint multiplier.
export const TYPES = {
  captain: { label: 'Captain', blurb: 'All-rounder with the biggest reserve for attacks.', mass: 66, cp: 358, wp: 26000, cda: 0.32, kick: 1.0 },
  climber: { label: 'Climber', blurb: 'Light and strong uphill, weaker on the flat.', mass: 57, cp: 322, wp: 19000, cda: 0.335, kick: 0.97 },
  rouleur: { label: 'Rouleur', blurb: 'Powerful on the flat and in the wind; the best wheel to pull the group.', mass: 74, cp: 376, wp: 21000, cda: 0.30, kick: 1.03 },
};
export const SLOTS = ['captain', 'climber', 'rouleur'];
export const FIELDS = [
  { name: 'Club riders', mul: 0.95, sub: 'Friendly and forgiving' },
  { name: 'Regional field', mul: 0.97, sub: 'A fair fight' },
  { name: 'National field', mul: 0.99, sub: 'Strong legs, sharp tactics' },
  { name: 'Elite field', mul: 1.01, sub: 'Every mistake is punished' },
];

export function makeRider(id, team, slot, mul, rng, ctl) {
  const T = TYPES[SLOTS[slot]], v = 1 + (rng.next() - 0.5) * 0.04;
  const m = mul * v;
  return {
    id, team, slot, role: SLOTS[slot], ctl,
    mass: T.mass, cp: T.cp * m, wpMax: T.wp * (0.92 + 0.16 * rng.next()) * (0.5 + 0.5 * mul), cda: T.cda, kick: T.kick,
    s: 0, sPrev: 0, v: 0, w: 0, fat: 0, mode: SIT, pf: 0, P: 0, draft: 0, cracked: false, fin: null, rank: 0, place: 0, att: false, hold: 0,
    plan: { atk: 0, dig: 0.6, hot: 0.5, pull: 0, cover: 0.3 },
  };
}

// mode: 'race' (six teams of three), 'tt' (you against a pacing ghost), 'watch' (all teams automatic)
export function createRace({ stage, field = 1, mode = 'race', rng, humanTeams = [0], slot = 0 }) {
  const course = buildCourse(stage);
  const R = { t: 0, course, L: course.L, mode, field, riders: [], order: [], over: false, firstFin: null, noDraft: false, humanTeams, ovr: null, version: 1 };
  const mul = FIELDS[field].mul;
  if (mode === 'tt') {
    const me = makeRider(0, 0, slot, 1, rng, 'human');
    me.w = me.wpMax;
    const ghost = makeRider(1, 1, slot, 1, rng, 'ghost');
    ghost.w = ghost.wpMax; ghost.wpMax = me.wpMax; ghost.cp = me.cp; ghost.mass = me.mass; ghost.cda = me.cda; ghost.kick = me.kick;
    R.riders = [me, ghost]; R.noDraft = true;
  } else {
    let id = 0;
    for (let team = 0; team < TEAMS.length; team++) {
      for (let slot = 0; slot < 3; slot++) {
        const mine = team === 0;
        const r = makeRider(id++, team, slot, mine ? 1 : mul, rng, mine && mode === 'race' ? 'human' : 'ai');
        r.w = r.wpMax;
        r.plan = {
          atk: Math.round(R.L * (0.1 + rng.next() * 0.17) / 50) * 50,
          dig: 0.55 + rng.next() * 0.2, hot: rng.next(), pull: Math.round(R.L * (0.25 + rng.next() * 0.3) / 50) * 50, cover: 0.25 + rng.next() * 0.2,
        };
        R.riders.push(r);
      }
    }
  }
  R.riders.forEach((r, i) => {
    const row = r.team * 0.55 + r.slot * 0.2;
    r.s = r.sPrev = -row - (R.mode === 'tt' ? 0 : 1);
    R.order.push(i);
  });
  return R;
}

// ---- physics -----------------------------------------------------------------------------------------------------------
const rollForce = (m, grade) => m * G * (grade / Math.sqrt(1 + grade * grade) + CRR);
const powerFor = (v, m, grade, rho, cda, wind) => (v * (rollForce(m, grade) + 0.5 * rho * cda * (v + wind) * Math.abs(v + wind))) / ETA;
function speedFor(P, m, grade, rho, cda, wind) {
  const a = rollForce(m, grade), c = 0.5 * rho * cda, e = ETA * P;
  const f = (v) => v * (a + c * (v + wind) * Math.abs(v + wind)) - e;
  let lo = 0.2, hi = 30;
  if (f(lo) >= 0) return lo;
  for (let i = 0; i < 18; i++) { const mid = (lo + hi) / 2; if (f(mid) > 0) hi = mid; else lo = mid; }
  return (lo + hi) / 2;
}
export const speedAt = (r, P, course, s, cdaMul = 1, w = null) => {
  const grade = course.gradeAt(s), alt = course.altAt(s);
  return speedFor(P, r.mass + BIKE, grade, airDensity(alt), r.cda * cdaMul, w ?? course.windAt(s));
};

// ---- one second of race ------------------------------------------------------------------------------------------------
// `decide(R)` is the controller for every rider that is not steered by the player (see ai.js); it sets rider.mode / rider.pf.
export function step(R, dt, decide) {
  const rs = R.riders, C = R.course, n = rs.length, ord = R.order;
  ord.sort((a, b) => rs[b].s - rs[a].s || a - b);
  for (let k = 0; k < n; k++) rs[ord[k]].rank = k;
  // official placing: finishers by time, then the rest by distance
  const plc = ord.slice().sort((a, b) => { const x = rs[a], y = rs[b]; if (x.fin !== null && y.fin !== null) return x.fin - y.fin || a - b; if (x.fin !== null) return -1; if (y.fin !== null) return 1; return y.s - x.s || a - b; });
  for (let k = 0; k < n; k++) rs[plc[k]].place = k + 1;
  if (decide) decide(R);
  for (let k = 0; k < n; k++) {
    const r = rs[ord[k]];
    r.sPrev = r.s;
    const cpE = r.cp * (1 - 0.2 * Math.min(1, r.fat));
    const s0 = Math.max(0, r.s), rem = R.L - r.s;
    const grade = C.gradeAt(s0), wind = C.windAt(s0), rho = airDensity(C.altAt(s0)), m = r.mass + BIKE;
    // slipstream from the one or two riders directly ahead
    let dr = 0;
    if (!R.noDraft && k > 0) {
      const a1 = rs[ord[k - 1]], g1 = a1.s - r.s;
      if (g1 < 9 && a1.v > 1.5) {
        dr = 0.36 * clamp(1 - (g1 - 1) / 8, 0, 1);
        if (k > 1) { const a2 = rs[ord[k - 2]], g2 = a2.s - a1.s; if (g1 + g2 < 12 && a2.v > 1.5) dr += 0.09 * clamp(1 - (g1 + g2 - 2) / 10, 0, 1); }
      }
    }
    r.draft = dr;
    const cda = r.cda * (1 - dr);
    // how much power does the rider ask for?
    let P;
    if (r.fin !== null) P = 0.5 * cpE;
    else if (rem <= SPRINT_M && r.s > 0) P = cpE + Math.min(0.62 * r.cp, Math.max(0, r.w) / Math.max(5, rem / Math.max(3, r.v))) * r.kick;
    else if (r.pf > 0) P = r.pf * cpE;
    else if (r.mode === SIT) {
      // hold the wheel in front; with nobody close ahead, ride just under critical power
      let target = null;
      if (k > 0) { const a = rs[ord[k - 1]], gap = a.s - r.s; if (gap < 55 && a.fin === null) target = a.v + clamp((gap - 2.5) * 0.2, -1.2, 1.2); }
      const cap = r.w < 0.15 * r.wpMax ? 0.97 : 1.03;
      if (target === null) P = 0.97 * cpE;
      else P = clamp(powerFor(target, m, grade, rho, cda, wind), 0.42 * cpE, cap * cpE);
    } else P = MODE_POWER[r.mode] * cpE;
    if (r.cracked) P = Math.min(P, 0.8 * cpE);
    P = Math.max(0, P);
    // power -> speed (capped by the road: descents and hairpins), then what the rider really spent
    const vFree = speedFor(P, m, grade, rho, cda, wind);
    const vcap = Math.min(C.vmaxAt(s0), 21);
    const vEq = Math.min(vFree, vcap);
    const used = vFree > vcap ? clamp(powerFor(vEq, m, grade, rho, cda, wind), 0, P) : P;
    r.P = used;
    r.v += (vEq - r.v) * (1 - Math.exp(-dt / 2));
    // the reserve
    if (used > cpE) r.w -= (used - cpE) * dt;
    else r.w += (cpE - used) * dt * 0.5 * Math.max(0.12, 1 - r.w / r.wpMax);
    if (r.w <= 0) { r.w = 0; if (!r.cracked) r.cracked = true; }
    else if (r.cracked && r.w >= 0.2 * r.wpMax) r.cracked = false;
    if (r.w > r.wpMax) r.w = r.wpMax;
    r.fat += (Math.max(0, used - 0.6 * cpE) * dt) / (r.cp * 5400);
    r.s += r.v * dt;
    if (r.fin === null && r.s >= R.L) {
      const frac = r.s > r.sPrev ? (R.L - r.sPrev) / (r.s - r.sPrev) : 1;
      r.fin = R.t + frac * dt;
      if (R.firstFin === null) R.firstFin = r.fin;
    }
  }
  R.t += dt;
  if (!R.over) {
    const mine = R.mode === 'tt' ? rs : rs.filter((r) => r.ctl === 'human' || (R.mode === 'watch' && r.team === 0));
    const allMine = mine.length ? mine.every((r) => r.fin !== null) : rs.every((r) => r.fin !== null);
    if (allMine || (R.firstFin !== null && R.t - R.firstFin > 420) || R.t > 6000) R.over = true;
  }
}

// finishing order: finished riders by time, then the rest by distance
export function classification(R) {
  return R.riders.map((r, i) => i).sort((a, b) => {
    const x = R.riders[a], y = R.riders[b];
    if (x.fin !== null && y.fin !== null) return x.fin - y.fin || a - b;
    if (x.fin !== null) return -1;
    if (y.fin !== null) return 1;
    return y.s - x.s || a - b;
  });
}
// time a rider is predicted to finish (or finished): used for gaps
export function etaOf(R, r) {
  if (r.fin !== null) return r.fin;
  return R.t + (R.L - r.s) / Math.max(2.5, r.v);
}

export function cloneRace(R) {
  return {
    ...R, ovr: R.ovr ? { ...R.ovr } : null, order: R.order.slice(),
    riders: R.riders.map((r) => ({ ...r, plan: r.plan })),
  };
}

// solo reference: how long does a rider take if they simply hold critical power? (sets the playback rate of a stage)
export function soloTime(stage) {
  const C = buildCourse(stage), r = { ...makeRider(0, 0, 0, 1, { next: () => 0.5 }, 'ai') };
  let s = 0, t = 0, v = 4;
  while (s < C.L && t < 20000) { const vv = speedAt(r, r.cp, C, s); v += (Math.min(vv, C.vmaxAt(s)) - v) * 0.4; s += v; t += 1; }
  return t;
}
export const rateFor = (stage) => clamp(soloTime(stage) / 150, 6, 20);

export const fmtTime = (t) => { t = Math.max(0, Math.round(t)); const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60; return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`; };
export const fmtGap = (t) => { if (t < 10) return `+${Math.max(0, t).toFixed(1)}s`; t = Math.max(0, Math.round(t)); return t < 60 ? `+${t}s` : `+${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; };
export const fmtGapInt = (t) => { t = Math.max(0, Math.round(t)); return t < 60 ? `+${t}s` : `+${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; };
