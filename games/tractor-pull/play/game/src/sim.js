// Tractor Pull: the pulling simulation. Pure and deterministic (no clock, no Math.random): the same track and the same control
// stream always give the same pull. Units: metres, seconds, kilonewtons, tonnes, kilowatts. The screen shows feet.
//
// One pull: a tractor hitched to a weight-transfer sled. The sled gets heavier as its weight box slides forward, so the load
// climbs steeply along the track. The player has two controls: the throttle lever and the gear (up / down).
//   engine   force = throttle * P / (0.62 * vmax[gear]) * T(rpm); rpm follows wheel speed (clutch slips only at the launch)
//   traction Ft = mu_ground * mu_strip * (rear axle load) * (1 - 0.35 * dig); rear load grows with hitch pull and nose lift
//   slip     relaxes towards a value set by drive force / traction; thrust = min(drive, Ft * G(slip)); too much slip digs
//   nose     lifts with thrust; at 100 percent the engine is cut for a second ("front end up")
export const FT = 3.28084;
export const TRACK_FT = 300;
export const TRACK_M = TRACK_FT / FT;
export const SESSION_PULLS = 3;
export const ROUND_MUL = [0.72, 0.9, 1.08];     // sled-weight multiplier of the three rounds of a session
export const CLOCK = 36;                        // seconds on the pull clock
export const SHIFT_TIME = 0.35;
export const CUT_TIME = 0.7;
export const IDLE = 0.2;
export const PEAK = 0.62;                       // engine speed (share of redline) of peak torque
export const SLIP_GOOD = [0.1, 0.2];            // the green band of the slip gauge
export const LIFT_WARN = 0.7;
export const STRIPS = 12;                       // grip strips along the track
export const STRIP_FT = TRACK_FT / STRIPS;
export const G = 9.81;

// Rigs: generic, unbranded. need = lifetime feet pulled.
export const RIGS = [
  { id: 'pony', name: 'Garden Pony', blurb: 'Light and willing: small power, small tyres, forgiving.', mass: 0.9, power: 21, vmax: [1.9, 3.0, 4.4, 6.2], rf: 0.66, tyre: 0.96, liftK: 0.0, base: 1.0, need: 0 },
  { id: 'farm', name: 'Farm Stock', blurb: 'The honest workhorse: balanced power and weight.', mass: 4.2, power: 106, vmax: [2.3, 3.6, 5.3, 7.6], rf: 0.68, tyre: 1.0, liftK: 0.0, base: 1.24, need: 1200 },
  { id: 'super', name: 'Super Farm', blurb: 'Heavy, dual tyres and a lot of grip; it needs a long pull to wake up.', mass: 6.0, power: 162, vmax: [2.5, 3.9, 5.7, 8.2], rf: 0.7, tyre: 1.06, liftK: -0.03, base: 1.17, need: 3000 },
  { id: 'mod', name: 'Pro Modified', blurb: 'Huge power in a light frame: it hooks hard and climbs fast.', mass: 3.2, power: 235, vmax: [2.8, 4.4, 6.4, 9.0], rf: 0.72, tyre: 1.1, liftK: 0.07, base: 1.24, need: 6000 },
];

// Grounds: mu = firm-surface friction, spread = how different the strips are, tone = visual only.
export const GROUNDS = [
  { id: 'fair', name: 'County Fair', time: 'afternoon', blurb: 'Firm clay with gentle strips of damp and dust.', mu: 0.9, spread: 0.16, dust: 0.5, need: 0 },
  { id: 'harvest', name: 'Harvest Dusk', time: 'dusk', blurb: 'Loose dirt that throws dust and punishes wheel spin.', mu: 0.8, spread: 0.22, dust: 1.0, need: 700 },
  { id: 'night', name: 'Grandstand Night', time: 'night', blurb: 'A tacky, prepared track under the floodlights.', mu: 0.96, spread: 0.22, dust: 0.3, need: 2000 },
  { id: 'rain', name: 'Rainy Heat', time: 'midday', blurb: 'Wet and slick, with patches that grip and patches that do not.', mu: 0.7, spread: 0.3, dust: 0.1, need: 4200 },
];

export const RANKS = [
  [0, 'Spectator'], [150, 'Fair rookie'], [300, 'County hooker'], [450, 'Puller'], [600, 'State champion'], [720, 'Pulling legend'], [800, 'Hall of fame'],
];
export const rankFor = (total) => { let r = RANKS[0][1]; for (const [n, name] of RANKS) if (total >= n) r = name; return r; };

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const ft = (m) => m * FT;
export const mph = (v) => v * 2.23694;

// A seeded stream for the daily pull (the engine's own env.rng is used for everything else).
export function seeded(seed) {
  let s = (seed >>> 0) || 1;
  return { next() { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; s ^= s >>> 15; return ((s >>> 0) % 100000) / 100000; } };
}

// ---- the track: grip strips ---------------------------------------------------------------------------------------------
// strips[i] is the grip multiplier of the i-th 25 ft strip: above 1 damp and tacky (dark), below 1 dry and dusty (pale).
export function makeTrack(groundIdx, rng) {
  const gd = GROUNDS[groundIdx], strips = [];
  let prev = 0;
  for (let i = 0; i < STRIPS; i++) {
    let v = (rng.next() * 2 - 1);
    v = v * 0.75 + prev * 0.25;          // neighbouring strips tend to be alike
    prev = v;
    strips.push(clamp(1 + v * gd.spread, 0.6, 1.3));
  }
  strips[0] = Math.max(strips[0], 1.0);  // the launch strip is never a bad one
  return { ground: groundIdx, strips };
}
export const stripAt = (track, xm) => track.strips[clamp(Math.floor(ft(xm) / STRIP_FT), 0, STRIPS - 1)];

// ---- engine and traction ----------------------------------------------------------------------------------------------------
export const torque = (r) => (r < 0.08 ? 0 : Math.max(0, 1 - ((r - PEAK) / 0.52) ** 2) * (r > 1.0 ? Math.max(0, 1 - (r - 1.0) * 12) : 1));
export const weightOf = (rig) => rig.mass * G;
export const sledLoad = (p, xm = p.x) => {
  const u = clamp(xm / TRACK_M, 0, 1.05), W = weightOf(p.rig);
  return W * (0.03 + p.c * (0.25 + 0.75 * Math.pow(u, 1.5))) * (0.55 + 0.45 * Math.min(1, Math.max(0, xm) / 8));   // a sled breaks away easily
};
export function driveAt(p, gear, thr, v) {
  const rig = p.rig, r = Math.max(v / rig.vmax[gear], p.x < 4 && v < 0.5 ? 0.3 : IDLE);
  return thr * rig.power / (PEAK * rig.vmax[gear]) * torque(r);
}
export function tractionAt(p, xm, lift = p.lift) {
  const rig = p.rig, W = weightOf(rig), R = sledLoad(p, xm);
  const N = W * rig.rf + 0.22 * R + W * (1 - rig.rf) * 0.9 * clamp(lift, 0, 1);
  const mu = GROUNDS[p.track.ground].mu * stripAt(p.track, xm) * rig.tyre;
  return mu * N * (1 - 0.35 * p.dig);
}
const slipFor = (q) => (q <= 1 ? 0.04 + 0.14 * q * q : Math.min(0.9, 0.18 + (q - 1) * 0.9));
const gripAtSlip = (s) => (s <= 0.18 ? Math.sqrt(s / 0.18) : Math.max(0.3, 1 - 1.0 * (s - 0.18)));

// ---- a pull -------------------------------------------------------------------------------------------------------------------
// c = sled weight factor (multiplies the whole load curve). Returns the live state object (JSON-serializable).
export function newPull(rigIdx, track, round, cScale = 1) {
  const rig = RIGS[rigIdx];
  return {
    rigIdx, round, rig, track, c: rig.base * ROUND_MUL[clamp(round, 0, ROUND_MUL.length - 1)] * cScale,
    t: 0, x: 0, v: 0, gear: 0, thrT: 0, thr: 0, rpm: IDLE, slip: 0.04, dig: 0, lift: 0, thrust: 0, load: 0, drive: 0, grip: 1,
    shiftT: 0, cutT: 0, stopT: 0, stallT: 0, phase: 'ready', end: null, faults: 0, shifts: 0, maxSlip: 0, spinT: 0, ev: [], evSeq: 0, wheel: 0, bestSpeed: 0,
  };
}

const emit = (p, type) => { p.evSeq++; p.ev.push({ type, n: p.evSeq, t: p.t }); if (p.ev.length > 12) p.ev.shift(); };

export function stepPull(p, dt, ctl) {
  const rig = RIGS[p.rigIdx];
  p.rig = rig;
  if (p.phase === 'done') return p;
  const thrT = clamp(ctl.thr, 0, 1);
  p.thrT = thrT;
  const rate = p.thr < thrT ? 5 : 9;
  p.thr += clamp(thrT - p.thr, -rate * dt, rate * dt);
  if (p.shiftT > 0) p.shiftT = Math.max(0, p.shiftT - dt);
  if (p.phase === 'ready') {
    p.rpm += ((IDLE + 0.55 * p.thr) - p.rpm) * Math.min(1, dt * 8);
    if (ctl.shift && p.shiftT <= 0) {            // the gear can be chosen on the line, before the launch
      const g = clamp(p.gear + (ctl.shift > 0 ? 1 : -1), 0, rig.vmax.length - 1);
      if (g !== p.gear) { p.gear = g; p.shiftT = SHIFT_TIME * 0.5; emit(p, 'shift'); }
    }
    if (thrT > 0.08 && p.shiftT <= 0) { p.phase = 'run'; emit(p, 'launch'); } else return p;
  }
  p.t += dt;
  // gear changes
  if (ctl.shift && p.shiftT <= 0) {
    const g = clamp(p.gear + (ctl.shift > 0 ? 1 : -1), 0, rig.vmax.length - 1);
    if (g !== p.gear) { p.gear = g; p.shiftT = SHIFT_TIME; p.shifts++; emit(p, 'shift'); }
  }
  if (p.cutT > 0) p.cutT = Math.max(0, p.cutT - dt);

  const W = weightOf(rig), v = p.v;
  const rpmWheel = v / rig.vmax[p.gear];
  const launching = p.x < 4 && v < 0.5;
  const rpmEff = Math.max(rpmWheel, launching && p.thr > 0.05 ? 0.3 + 0.1 * p.thr : IDLE);
  const cut = p.shiftT > 0 || p.cutT > 0;
  const Fd = cut ? 0 : p.thr * rig.power / (PEAK * rig.vmax[p.gear]) * torque(rpmEff);
  const Ft = tractionAt(p, p.x);
  const q = Fd / Math.max(0.5, Ft);
  const sTarget = Fd > 0.05 ? slipFor(q) : 0.03;
  p.slip += (sTarget - p.slip) * Math.min(1, dt / 0.18);
  const thrust = Math.min(Fd, Ft * gripAtSlip(p.slip));
  const R = sledLoad(p) + 0.02 * rig.mass * v;
  const a = (thrust - R) / rig.mass;
  let nv = v + a * dt;
  if (nv < 0) nv = 0;
  p.v = nv;
  p.x += (v + nv) * 0.5 * dt;
  if (p.v > p.bestSpeed) p.bestSpeed = p.v;
  p.thrust = thrust; p.drive = Fd; p.load = R / W; p.grip = stripAt(p.track, p.x);
  p.rpm += (Math.min(1.05, rpmEff) - p.rpm) * Math.min(1, dt * 14);
  p.wheel += (v / 0.7 * (1 + p.slip * 2.5)) * dt;     // wheel angle (radians), for drawing
  p.maxSlip = Math.max(p.maxSlip, p.slip);
  if (p.slip > 0.4 && p.drive > 0) p.spinT += dt;
  // dig: spinning cuts a hole, moving on clears it
  p.dig = clamp(p.dig + Math.max(0, p.slip - 0.3) * 1.1 * dt - (0.35 * p.v + (p.slip < 0.3 ? 0.12 : 0)) * dt, 0, 1);
  // nose lift
  const lt = clamp((thrust / W - 0.36) / (0.5 - rig.liftK), 0, 1.3);
  p.lift += (lt - p.lift) * Math.min(1, dt * (lt > p.lift ? 3.2 : 5));
  if (p.lift >= 1 && p.cutT <= 0) { p.cutT = CUT_TIME; p.faults++; emit(p, 'nose'); }

  // the end of the pull
  if (p.x >= TRACK_M) { p.x = TRACK_M; p.phase = 'done'; p.end = 'full'; emit(p, 'end'); return p; }
  if (p.v < 0.08 && p.t > 1.5 && thrust <= R) p.stopT += dt; else p.stopT = 0;
  if (p.stopT > 1.2) { p.phase = 'done'; p.end = 'stopped'; emit(p, 'end'); return p; }
  if (rpmWheel < 0.12 && p.x > 6 && p.thr > 0.05) p.stallT += dt; else p.stallT = 0;
  if (p.stallT > 0.9) { p.phase = 'done'; p.end = 'stalled'; emit(p, 'end'); return p; }
  if (p.t >= CLOCK) { p.phase = 'done'; p.end = 'time'; emit(p, 'end'); }
  return p;
}

// ---- advice: the best gear and lever mark for the moment (Think hint and the Watch & Learn driver) -------------------------------
// The lever mark keeps drive force just under what the tyres can hold; the gear is chosen by playing the next few seconds forward
// in each neighbouring gear (a shift costs a drive cut, which a heavy sled punishes), and taking the one that gets furthest.
function leverFor(p) {
  const v = Math.max(p.v, 0);
  const lookX = Math.min(TRACK_M, p.x + 1.5 + p.v * 0.8);
  const lf = Math.min(p.lift, 0.5);
  const Ft = Math.min(tractionAt(p, p.x, lf), tractionAt(p, lookX, lf) * 1.02);
  const F = Math.max(0.1, driveAt(p, p.gear, 1, v));
  const cap = weightOf(p.rig) * (0.36 + 0.88 * (0.5 - p.rig.liftK));    // thrust above this lifts the nose
  let thr = clamp(Math.min(0.93 * Ft, cap) / F, 0.1, 1);
  if (p.lift > 0.78) thr = Math.min(thr, 0.5);
  if (p.slip > 0.3) thr = Math.min(thr, 0.5);
  return thr;
}
function forward(p0, gear, secs) {
  const p = { ...p0, ev: [], phase: p0.phase === 'ready' ? 'run' : p0.phase };
  const dt = 1 / 30, n = Math.round(secs / dt);
  for (let i = 0; i < n && p.phase !== 'done'; i++) {
    const want = i === 0 && gear !== p.gear ? (gear > p.gear ? 1 : -1) : 0;
    stepPull(p, dt, { thr: Math.max(leverFor(p), 0.12), shift: want });
  }
  return p.x + 0.35 * p.v;
}
export function advise(p) {
  const rig = RIGS[p.rigIdx];
  let gear = p.gear, base = forward(p, p.gear, 3), bestX = base;
  for (const g of [p.gear - 1, p.gear + 1]) {
    if (g < 0 || g >= rig.vmax.length || p.shiftT > 0) continue;
    const x = forward(p, g, 3);
    if (x > bestX + 0.35) { bestX = x; gear = g; }
  }
  const thr = leverFor(p);
  const why = p.phase === 'ready' ? (gear !== p.gear ? `Start in gear ${gear + 1}, then roll the lever on to about ${Math.round(thr * 100)} percent: any more and the tyres will spin.` : `Roll the lever on to about ${Math.round(thr * 100)} percent: any more and the tyres will spin.`)
    : gear > p.gear ? `Engine speed is high: shift up to gear ${gear + 1}.`
      : gear < p.gear ? `The sled is dragging the engine down: shift down to gear ${gear + 1}.`
        : p.slip > 0.26 ? 'The tyres are spinning: ease the lever back until slip is in the green.'
          : p.lift > LIFT_WARN ? 'The nose is rising: ease the lever so the front end comes down.'
            : `Hold the lever near ${Math.round(thr * 100)} percent.`;
  return { gear, thr, why };
}

// The Watch & Learn driver: plays a pull with the same two controls, a touch behind the ideal (it reacts, it does not know).
export function driver(p, mem) {
  mem.t = (mem.t || 0) + 1;
  if (mem.adv === undefined || mem.t - mem.at >= 12) { mem.adv = advise(p); mem.at = mem.t; }
  const a = mem.adv;
  let shift = 0;
  if (a.gear !== p.gear && p.shiftT <= 0 && mem.t - (mem.lastShift ?? -999) > 50) { shift = a.gear > p.gear ? 1 : -1; mem.lastShift = mem.t; }
  const want = leverFor(p), cur = mem.thr ?? 0;
  mem.thr = cur + clamp(want - cur, -0.03, 0.045);
  return { thr: mem.thr, shift, advice: a };
}

// ---- helpers for the session ---------------------------------------------------------------------------------------------------------
export const rigOwned = (lifeFt, i) => lifeFt >= RIGS[i].need;
export const groundOwned = (lifeFt, i) => lifeFt >= GROUNDS[i].need;
export const endLabel = (end) => (end === 'full' ? 'FULL PULL!' : end === 'stalled' ? 'Engine stalled' : end === 'stopped' ? 'Sled stopped' : 'Time is up');
