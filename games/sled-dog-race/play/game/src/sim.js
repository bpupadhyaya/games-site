// The sled dog simulation: pure and deterministic (no clock, no randomness), fixed steps. Legs of trail, six dogs with energy / water / paws / mood,
// pace, brake, junction calls, checkpoints with care actions and a vet check. The picture lives in scene.js and hud.js and only reads `race.s`.
import {
  V_MAX, PACE_FLOOR, ACC, DEC, BRAKE_DEC, BRAKE_V, STEEP, OVERRUN_V, OVERRUN_MOOD, TIRED_E, REJOIN_E, BAG_REGEN, LAYOVER, LAYOVER_E, DETOUR_S, DETOUR_MOOD,
  PRAISE_CD, PRAISE_MOOD, SNOW_K, VIS, drainE, drainW, drainP, CARE, DOGS, POWER_SUM, RACES, RIVALS,
} from './consts.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
export const GAITS = [['Walk', 0], ['Trot', 0.28], ['Lope', 0.55], ['Gallop', 0.82]];
export const gaitOf = (p) => { let g = GAITS[0][0]; for (const [n, v] of GAITS) if (p >= v) g = n; return g; };
export const wellbeing = (d) => 0.45 * d.e + 0.2 * d.w + 0.2 * d.pw + 0.15 * d.m;
export const freshDogs = () => DOGS.map((def, i) => ({ i, e: 1, w: 1, pw: 1, m: 0.9, riding: false, booties: false, def }));

// ---- terrain ------------------------------------------------------------------------------------------------------------------------------
const PH = [[0.3, 1.9, 4.1], [2.2, 0.4, 5.3], [4.0, 3.1, 0.7], [1.1, 5.0, 2.6]];
function prepLegBase(spec, idx) {
  const ph = PH[idx % PH.length];
  const len = spec.len;
  return {
    idx, len, hill: spec.hill, ph, weather: spec.weather || 'clear', look: spec.look,
    rough: (spec.rough || []).map(([a, b]) => [a * len, b * len]),
    jx: (spec.jx || []).map((j) => ({ x: j.at * len, dir: j.dir, state: 'ahead', pend: null, n: 0 })),
    vis: VIS[spec.weather || 'clear'],
    steep: [],
  };
}
export function prepLeg(spec, idx) {
  const L = prepLegBase(spec, idx);
  let from = null;
  for (let x = 0; x <= L.len; x += 2) {
    const st = slopeAt(L, x) < STEEP;
    if (st && from === null) from = x;
    if (!st && from !== null) { if (x - from >= 8) L.steep.push([from, x]); from = null; }
  }
  return L;
}
// Elevation in metres at distance x along the leg: flat at the line and at the checkpoint, hills between.
export function elev(L, x) {
  const env = sm(x / 45) * sm((L.len + 30 - x) / 70);
  return L.hill * env * (0.6 * Math.sin(x / 58 + L.ph[0]) + 0.28 * Math.sin(x / 27 + L.ph[1]) + 0.12 * Math.sin(x / 13 + L.ph[2]));
}
export const slopeAt = (L, x) => (elev(L, x + 1.5) - elev(L, x - 1.5)) / 3;
export const roughAt = (L, x) => L.rough.some(([a, b]) => x >= a && x <= b);
export const windowOf = (L) => Math.max(26, L.vis - 10);

// ---- the race -----------------------------------------------------------------------------------------------------------------------------
// cfg: { legs: [spec...] } or { legAt(i), legCount }, optional dogs (carried over by the Trail Run)
export function createRace(cfg) {
  const legSpec = (i) => (cfg.legs ? cfg.legs[i] : cfg.legAt(i));
  const legCount = cfg.legs ? cfg.legs.length : (cfg.legCount || Infinity);
  const s = {
    phase: 'ready', leg: 0, legCount, L: prepLeg(legSpec(0), 0), x: 0, v: 0, t: 0, clock: 0, pace: 0.5, brake: false, stride: 0, simT: 0,
    dogs: cfg.dogs || freshDogs(), events: [], evId: 0, praiseCd: 0, praises: 0, overrunT: 0, overrunCd: 0, carried: 0, overruns: 0, detours: 0, goodCalls: 0,
    legTimes: [], stopTimes: [], careSamples: [], vet: null, stop: null, hinted: false, hintCost: 0, finished: false, over: false, afterT: 0,
    minPace: 1, maxPace: 0, brakeT: 0, gaitTime: [0, 0, 0, 0], legPace: 0, pending: null,
  };
  const ev = (type, o = {}) => { s.events.push({ id: s.evId++, type, ...o }); if (s.events.length > 60) s.events.shift(); };
  const working = () => s.dogs.filter((d) => !d.riding);

  function teamPower() {
    let sum = 0;
    for (const d of s.dogs) {
      if (d.riding) continue;
      sum += d.def.power * (0.35 + 0.65 * Math.sqrt(Math.max(0, d.e))) * (0.75 + 0.25 * d.m) * (d.w < 0.3 ? 0.9 : 1) * (d.pw < 0.3 ? 0.9 : 1);
    }
    return sum / POWER_SUM;
  }
  const leaderMood = () => (s.dogs[0].m * (s.dogs[0].riding ? 0 : 1) + s.dogs[1].m * (s.dogs[1].riding ? 0 : 1)) / 2;
  const callsNeeded = () => (leaderMood() >= 0.45 ? 1 : 2);

  function vetCheck() {
    const flags = [];
    let sum = 0;
    for (const d of s.dogs) {
      const w = wellbeing(d); sum += w;
      const need = [];
      if (d.e < 0.35) need.push('rest'); if (d.w < 0.4) need.push('water'); if (d.pw < 0.45) need.push('paws'); if (d.m < 0.45) need.push('praise');
      flags.push({ i: d.i, wb: w, need });
    }
    const mean = sum / s.dogs.length;
    s.careSamples.push(mean);
    s.vet = { mean, flags };
  }

  function startLeg(i) {
    s.leg = i; s.L = prepLeg(legSpec(i), i); s.x = 0; s.v = 0; s.t = 0; s.phase = 'ready'; s.brake = false; s.pending = null;
    s.overrunT = 0; s.overrunCd = 0; s.stop = null; s.hinted = false; s.hintCost = 0; s.legPace = 0; s.gaitTime = [0, 0, 0, 0];
    for (const d of s.dogs) d.booties = d.booties; // booties set at the checkpoint stay on for this leg
  }
  function arrive() {
    s.x = s.L.len; s.v = 0;
    s.legTimes.push(s.t + s.hintCost);
    s.clock += s.hintCost;
    vetCheck();
    for (const d of s.dogs) d.booties = false;
    if (s.leg + 1 >= s.legCount) {
      s.phase = 'finished'; s.finished = true; s.afterT = 0;
      ev('finish');
    } else {
      s.phase = 'stop';
      s.stop = { elapsed: LAYOVER, acts: 0, log: [] };
      s.clock += LAYOVER;
      for (const d of s.dogs) d.e = Math.min(1, d.e + LAYOVER_E);
      ev('checkpoint', { leg: s.leg });
    }
  }

  const race = {
    s, cfg,
    elevAt: (x) => elev(s.L, x),
    start() { if (s.phase === 'ready') { s.phase = 'run'; ev('start'); } },
    update(dt, ctl) {
      ctl = ctl || {};
      s.simT += dt;
      if (s.phase === 'finished') { s.afterT += dt; if (s.afterT > 0.6) s.over = true; return; }
      if (s.phase !== 'run') return;
      const L = s.L;
      if (ctl.pace != null) s.pace = clamp(ctl.pace, 0, 1);
      s.brake = !!ctl.brake;
      s.praiseCd = Math.max(0, s.praiseCd - dt);
      s.overrunCd = Math.max(0, s.overrunCd - dt);
      if (ctl.praise && s.praiseCd <= 0) {
        s.praiseCd = PRAISE_CD; s.praises++;
        for (const d of s.dogs) d.m = Math.min(1, d.m + PRAISE_MOOD);
        ev('praise');
      }
      // calls at the junctions
      const J = L.jx.find((j) => j.state === 'ahead');
      if (J && ctl.cmd && s.x >= J.x - windowOf(L) && s.x < J.x) {
        if (J.pend === ctl.cmd) J.n++; else { J.pend = ctl.cmd; J.n = 1; }
        ev('call', { dir: ctl.cmd });
      }
      const slope = slopeAt(L, s.x), rough = roughAt(L, s.x);
      const p = s.pace;
      // target speed
      const power = teamPower();
      let vt = V_MAX * (PACE_FLOOR + (1 - PACE_FLOOR) * p) * power * (SNOW_K[L.weather] || 1) * clamp(1 - 3.5 * slope, 0.5, 1.3);
      if (p < 0.02) vt = 0;
      if (s.brake) { vt = Math.min(vt, BRAKE_V); s.brakeT += dt; }
      let acc = ACC;
      if (s.v > vt) acc = s.brake ? BRAKE_DEC : DEC;
      s.v += clamp(vt - s.v, -acc * dt, ACC * dt);
      // a steep downhill without the brake runs the sled into the wheel dogs
      if (slope < STEEP && s.v > OVERRUN_V && !s.brake && s.overrunCd <= 0) {
        s.overrunT += dt;
        if (s.overrunT > 0.7) {
          s.overrunT = 0; s.overrunCd = 5; s.overruns++; s.v *= 0.65;
          for (const d of s.dogs) if (d.i >= 4) d.m = Math.max(0, d.m - OVERRUN_MOOD);
          ev('overrun');
        }
      } else s.overrunT = Math.max(0, s.overrunT - dt);
      const prevX = s.x;
      s.x += s.v * dt; s.t += dt; s.clock += dt;
      s.stride += s.v * dt / 2.3;
      s.legPace += p * dt;
      s.minPace = Math.min(s.minPace, p); s.maxPace = Math.max(s.maxPace, p);
      s.gaitTime[GAITS.reduce((g, [, v], k) => (p >= v ? k : g), 0)] += dt;
      // the dogs
      const fast = s.v > 0.5;
      for (const d of s.dogs) {
        if (d.riding) {
          d.e = Math.min(1, d.e + BAG_REGEN * dt); d.m = Math.min(1, d.m + 0.01 * dt); d.w = Math.max(0, d.w - 0.0008 * dt);
          if (d.e >= REJOIN_E && !d.keepBag) { d.riding = false; ev('rejoin', { dog: d.i }); }
          continue;
        }
        const eff = fast ? p : 0;
        d.e = clamp(d.e - drainE(eff, slope) * dt / d.def.stamina + (fast ? 0 : 0.01 * dt), 0, 1);
        d.w = clamp(d.w - drainW(eff) * dt, 0, 1);
        d.pw = clamp(d.pw - (fast ? drainP(eff, rough, d.booties) * dt : 0), 0, 1);
        // mood eases toward what the dog's condition allows
        let target = 0.95 - 0.7 * Math.max(0, 0.5 - d.e) - 0.4 * Math.max(0, 0.4 - d.w) - 0.4 * Math.max(0, 0.4 - d.pw) - (p > 0.85 ? (p - 0.85) * 2 : 0);
        target = clamp(target, 0.05, 0.95);
        d.m += (target - d.m) * 0.08 * dt;
        if (d.e < TIRED_E && !d.riding) { d.riding = true; s.carried++; ev('tired', { dog: d.i }); }
      }
      // junctions
      for (const j of L.jx) {
        if (j.state === 'ahead' && prevX < j.x && s.x >= j.x) {
          if (j.pend === j.dir && j.n >= callsNeeded()) { j.state = 'ok'; s.goodCalls++; ev('junction', { ok: true, dir: j.dir }); }
          else {
            j.state = 'missed'; s.detours++; s.clock += DETOUR_S; s.v *= 0.6;
            for (const d of s.dogs) d.m = Math.max(0, d.m - DETOUR_MOOD);
            ev('junction', { ok: false, dir: j.dir, picked: j.pend });
          }
        }
      }
      ev; // (events are pushed above)
      if (s.x >= L.len) arrive();
    },
    // ---- the checkpoint ---------------------------------------------------------------------------------------------------------------------
    care(action, idx = -1) {
      if (s.phase !== 'stop') return null;
      const C = CARE[action]; if (!C) return null;
      const targets = idx < 0 ? s.dogs : [s.dogs[idx]];
      let cost = 0, changed = 0;
      if (action === 'bag') {
        const d = targets[0]; if (!d) return null;
        if (d.riding) { if (d.e < REJOIN_E) return { cost: 0, changed: 0, refused: 'too tired to pull yet' }; d.riding = false; }
        else { d.riding = true; d.keepBag = true; }
        if (!d.riding) d.keepBag = false;
        cost = C.one; changed = 1;
      } else if (action === 'rest') {
        cost = C.all;
        for (const d of s.dogs) { d.e = Math.min(1, d.e + C.gain); d.m = Math.min(1, d.m + 0.03); d.w = Math.max(0, d.w - 0.02); }
        changed = s.dogs.length;
      } else {
        cost = idx < 0 ? C.all : C.one;
        for (const d of targets) {
          if (action === 'water') { if (d.w < 0.99) changed++; d.w = Math.min(1, d.w + C.gain); }
          else if (action === 'snack') { if (d.e < 0.99) changed++; d.e = Math.min(1, d.e + C.gain); d.m = Math.min(1, d.m + 0.04); d.w = Math.max(0, d.w - 0.03); }
          else if (action === 'paws') { if (d.pw < 0.99 || !d.booties) changed++; d.pw = Math.min(1, d.pw + C.gain); d.booties = true; }
          else if (action === 'praise') { if (d.m < 0.99) changed++; d.m = Math.min(1, d.m + (idx < 0 ? C.allGain : C.gain)); }
        }
      }
      s.clock += cost; s.stop.elapsed += cost; s.stop.acts++;
      s.stop.log.push({ action, idx, cost });
      ev('care', { action, idx, cost });
      return { cost, changed };
    },
    leave() {
      if (s.phase !== 'stop') return false;
      s.stopTimes.push(s.stop.elapsed);
      startLeg(s.leg + 1);
      return true;
    },
    toggleBag(idx) { return race.care('bag', idx); },
    praiseNow() { if (s.praiseCd <= 0) { s.praiseCd = PRAISE_CD; for (const d of s.dogs) d.m = Math.min(1, d.m + PRAISE_MOOD); s.praises++; ev('praise'); } },
    teamPower, callsNeeded,
    carePercent() { return careScore(s); },
    totalDistance() { let t = 0; for (let i = 0; i < s.leg; i++) t += legSpec(i).len; return t + s.x; },
    legSpec,
  };
  return race;
}

export function careScore(s) {
  if (!s.careSamples.length) return 1;
  const mean = s.careSamples.reduce((a, b) => a + b, 0) / s.careSamples.length;
  return clamp(mean - 0.04 * s.carried - 0.02 * s.overruns - 0.01 * s.detours, 0, 1);
}

// ---- the computer driver (Watch & Learn, rivals' pace, the ideal run, the Think hint) -----------------------------------------------------------
// The planned pace: the fastest pace whose predicted energy cost over the rest of the leg still leaves the team about `reserve` energy in hand.
export function planPace(s, reserve = 0.28) {
  const L = s.L, D = Math.max(20, L.len - s.x);
  const wk = s.dogs.filter((d) => !d.riding);
  if (!wk.length) return 0.2;
  const mean = wk.reduce((a, d) => a + d.e, 0) / wk.length, mn = Math.min(...wk.map((d) => d.e));
  const E = 0.6 * mean + 0.4 * mn;
  const stam = wk.reduce((a, d) => a + d.def.stamina, 0) / wk.length;
  const power = 0.35 + 0.65 * Math.sqrt(Math.max(0.05, mean));
  let best = 0.3;
  for (let p = 0.3; p <= 0.96; p += 0.02) {
    const v = V_MAX * (PACE_FLOOR + (1 - PACE_FLOOR) * p) * power * 0.97;
    const cost = drainE(p, 0.012) / stam * (D / v);
    if (cost <= E - reserve) best = p;
  }
  return best;
}
export function makeAi(o = {}) { return { reserve: o.reserve ?? 0.42, called: {}, seen: {}, hillSeen: {}, legSeen: -1, bias: o.bias ?? 0, praiseT: 0, plan: [], planAt: -1 }; }
export function aiControl(race, ai) {
  const s = race.s, L = s.L;
  const slope = slopeAt(L, s.x), ahead = slopeAt(L, s.x + 14);
  let pace = planPace(s, ai.reserve) + ai.bias;
  // lean in on the climbs a little less, use the downhill's free speed
  if (slope > 0.05) pace -= 0.04;
  pace = clamp(pace, 0.25, 0.97);
  const brake = (slope < STEEP * 0.85 || ahead < STEEP) && s.v > 6.3;
  let cmd = null;
  const J = L.jx.find((j) => j.state === 'ahead');
  if (J && s.x >= J.x - windowOf(L) + 2 && s.x < J.x - 3) {
    const need = race.callsNeeded();
    if ((J.pend !== J.dir || J.n < need)) cmd = J.dir;
  }
  ai.praiseT -= 1 / 60;
  const praise = s.dogs.some((d) => d.m < 0.7) && ai.praiseT <= 0 && (ai.praiseT = 4, true);
  return { pace, brake, cmd, praise };
}
// The next moment the computer would stop and explain: the plan at the line, a junction sign in view, a steep descent. Returns a description or null.
export function thinkDue(s, ai) {
  if (s.phase !== 'run') return null;
  const L = s.L;
  if (ai.legSeen !== s.leg && s.x > 6) { ai.legSeen = s.leg; return { kind: 'plan' }; }
  for (let k = 0; k < L.jx.length; k++) {
    const j = L.jx[k], key = `${s.leg}:${k}`;
    if (j.state === 'ahead' && !ai.seen[key] && s.x >= j.x - L.vis + 4) { ai.seen[key] = true; return { kind: 'junction', j }; }
  }
  for (let x = s.x + 10; x < s.x + 40; x += 6) {
    if (slopeAt(L, x) < STEEP && s.v > 5) {
      const key = `${s.leg}:${Math.floor(x / 60)}`;
      if (!ai.hillSeen[key]) { ai.hillSeen[key] = true; return { kind: 'hill' }; }
      break;
    }
  }
  return null;
}

// What to do at a checkpoint: an ordered list of care actions {action, idx, why}.
export function carePlan(s, nextLeg) {
  const plan = [], D = s.dogs;
  const low = (k, t) => D.filter((d) => d[k] < t);
  const w = low('w', 0.75), e = low('e', 0.65), pw = low('pw', 0.8);
  const roughAhead = nextLeg && (nextLeg.rough || []).length > 0;
  if (w.length >= 3) plan.push({ action: 'water', idx: -1, why: `${w.length} dogs are thirsty` });
  else w.forEach((d) => plan.push({ action: 'water', idx: d.i, why: `${d.def.name} needs a drink` }));
  if (pw.length >= 3 || (roughAhead && pw.length >= 1)) plan.push({ action: 'paws', idx: -1, why: roughAhead ? 'rough ice ahead: check paws and fit booties' : `${pw.length} dogs have tired paws` });
  else pw.forEach((d) => plan.push({ action: 'paws', idx: d.i, why: `${d.def.name} has sore paws` }));
  const mean = D.reduce((a, d) => a + d.e, 0) / D.length;
  if (mean < 0.7) {
    const steps = Math.min(3, Math.max(1, Math.round((0.75 - mean) / 0.16)));
    for (let k = 0; k < steps; k++) plan.push({ action: 'rest', idx: -1, why: 'the team is tired: rest on the straw' });
  }
  if (e.length >= 3) plan.push({ action: 'snack', idx: -1, why: 'a snack for energy' });
  else e.forEach((d) => plan.push({ action: 'snack', idx: d.i, why: `${d.def.name} needs a snack` }));
  D.filter((d) => d.m < 0.7 && !d.riding).slice(0, 2).forEach((d) => plan.push({ action: 'praise', idx: d.i, why: `${d.def.name} would like some praise` }));
  D.filter((d) => d.riding && d.e >= REJOIN_E + 0.1).forEach((d) => plan.push({ action: 'bag', idx: d.i, why: `${d.def.name} is rested enough to pull again` }));
  return plan;
}

// ---- the ideal run, the rivals ------------------------------------------------------------------------------------------------------------
// The computer drives the whole race with care at every checkpoint. Its leg times and stop times set the par for the race.
export function idealFor(cfg) {
  const race = createRace({ legs: cfg.legs, dogs: freshDogs() });
  const ai = makeAi({ reserve: cfg.reserve ?? 0.42 });
  const s = race.s;
  race.start();
  const DT = 1 / 30;
  let guard = 0;
  while (!s.over && guard++ < 200000) {
    if (s.phase === 'ready') { race.start(); continue; }
    if (s.phase === 'stop') {
      const next = race.legSpec(s.leg + 1);
      for (const a of carePlan(s, next)) race.care(a.action, a.idx);
      race.leave();
      continue;
    }
    if (s.phase === 'finished') { race.update(DT, {}); continue; }
    race.update(DT, aiControl(race, ai));
  }
  return { legTimes: s.legTimes.slice(), stopTimes: s.stopTimes.slice(), time: s.clock, care: careScore(s), carried: s.carried };
}
// A rival's position (metres from the start of the whole race, and which leg) at race clock t.
export function rivalAt(ideal, legs, skill, t) {
  let tt = 0, dist = 0;
  for (let i = 0; i < legs.length; i++) {
    const d = ideal.legTimes[i] / skill;
    if (t < tt + d) { const f = Math.max(0, (t - tt) / d); return { dist: dist + legs[i].len * f, leg: i, x: legs[i].len * f, stopped: false }; }
    tt += d; dist += legs[i].len;
    if (i < legs.length - 1) {
      const st = (ideal.stopTimes[i] || LAYOVER) / Math.min(1.15, skill);
      if (t < tt + st) return { dist, leg: i, x: legs[i].len, stopped: true };
      tt += st;
    }
  }
  return { dist, leg: legs.length - 1, x: legs[legs.length - 1].len, stopped: false, done: true };
}
export const rivalFinish = (ideal, skill) => ideal.legTimes.reduce((a, b) => a + b, 0) / skill + ideal.stopTimes.reduce((a, b) => a + b, 0) / Math.min(1.15, skill);
export const raceTotalLen = (legs) => legs.reduce((a, l) => a + l.len, 0);
export { RACES, RIVALS };
