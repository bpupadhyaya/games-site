// Limbo: the simulation. Pure and deterministic: no DOM, no clocks, randomness only from the rng handed in.
//
// Units: the dancer's standing height is 1.0. x runs left to right, y runs up from the sand. The bar stands at x = 0.
// The dancer's origin (the feet) walks from x = START to the right and passes under the bar.
//
// One finger controls two things: LEAN (how far back the body bends, 0..1) and STEER (a sideways push that keeps the balance
// bubble centred). Leaning is tiring: the balance drifts faster and with more noise the deeper the lean.

export const TUNE = {
  // Bar heights, as a fraction of the dancer's standing height, one per round.
  bars: [0.98, 0.92, 0.86, 0.80, 0.75, 0.70, 0.66, 0.62, 0.59, 0.565, 0.545, 0.525],
  start: -1.2,             // where the dancer starts (feet), bar at 0
  speed: 0.52,             // body heights per second
  slowByLean: 0.30,        // walking slows by this fraction at full lean
  leanUp: 2.1, leanDown: 2.6,       // lean change per second (the body is not instant)
  leanFall: 0.20,          // balance offset shifts the effective lean by this much
  drift: -0.8, driftLean: 1.7,      // balance growth per second: drift + driftLean * lean (upright it settles on its own)
  noise: 0.27, noiseLean: 0.60,      // noise push per second
  steerGain: 3.4,          // push per second at full steer
  steerLag: 9,             // how fast the steering follows the finger (per second)
  fallAt: 1,               // |balance| at which the dancer topples
  tries: 3,                // solo: misses allowed across a whole session
  autoRounds: 5,           // Watch and Learn plays this many rounds
  thinkScale: 0.4, thinkSeconds: 2.5, thinkCooldown: 6,
  leanRange: 170,          // thumb travel (virtual units) for full lean
  steerRange: 110,         // thumb travel (virtual units) for full steer
  barThick: 0.012,
  grace: 0.014,            // a hair of forgiveness: a graze this small does not knock the bar off
  tempo: 104,              // beats per minute
};

export const barHeight = (round) => TUNE.bars[Math.min(round, TUNE.bars.length - 1)];
export const roundLabel = (round) => `${Math.round(barHeight(round) * 100)}%`;
// Rounds past the last bar keep the record height but the dancer walks faster and the drift is rougher.
export const extraRounds = (round) => Math.max(0, round - (TUNE.bars.length - 1));
const noiseScale = (round) => 1 + Math.min(round, 14) * 0.04 + extraRounds(round) * 0.12;
const speedFor = (round) => TUNE.speed * (1 + Math.min(extraRounds(round), 6) * 0.03);

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

// ---- the body -------------------------------------------------------------------------------------------------------------
// pose(lean, wobble, stepPhase): every joint in dancer coordinates (feet at x = 0), facing right.
// Leaning pushes the hips forward, bends the knees and tips the torso and head back.
const THIGH = 0.255, SHIN = 0.25;
function legIK(hx, hy, ax, ay) {
  // Two-bone IK; the knee bends forward (+x).
  let dx = ax - hx, dy = ay - hy, d = Math.hypot(dx, dy);
  const reach = THIGH + SHIN - 0.002;
  if (d > reach) { dx *= reach / d; dy *= reach / d; d = reach; ax = hx + dx; ay = hy + dy; }
  const a = (THIGH * THIGH - SHIN * SHIN + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, THIGH * THIGH - a * a));
  const ux = dx / d, uy = dy / d;
  const kx = hx + ux * a - uy * h, ky = hy + uy * a + ux * h;     // the perpendicular that points forward (+x) for a downward leg
  return { knee: { x: kx, y: ky }, ankle: { x: ax, y: ay } };
}

export function pose(lean, wobble = 0, phase = 0) {
  const l = clamp(lean + (-TUNE.leanFall * wobble), 0, 1.08);
  const a = 1.36 * l;
  const hip = { x: 0.07 * l, y: 0.50 - 0.15 * l };
  const tilt = wobble * 0.22;                                     // the whole torso rocks a little with the balance
  const at = a - tilt;
  const sh = { x: hip.x - 0.30 * Math.sin(at), y: hip.y + 0.30 * Math.cos(at) };
  const ha = at * 1.16 + 0.04;
  const neck = { x: sh.x - 0.045 * Math.sin(ha), y: sh.y + 0.045 * Math.cos(ha) };
  const head = { x: neck.x - 0.075 * Math.sin(ha), y: neck.y + 0.075 * Math.cos(ha), r: 0.072 };
  // Feet: a slow shuffle, one foot sliding forward while the other pushes back.
  const sw = Math.sin(phase), sw2 = Math.sin(phase + Math.PI);
  const near = legIK(hip.x, hip.y, 0.03 + 0.09 * sw, 0.025 + 0.025 * Math.max(0, Math.cos(phase)));
  const far = legIK(hip.x, hip.y, -0.02 + 0.09 * sw2, 0.025 + 0.025 * Math.max(0, Math.cos(phase + Math.PI)));
  // Arms: two bones each, driven by angles (0 = hanging down, positive = swung forward). Walking swings them against the legs;
  // leaning lifts them out for balance and they follow the wobble. Drawing only: arms never count for the bar.
  const wob = clamp(wobble, -1.2, 1.2);
  const arm = (offset, sgn) => {
    const walk = Math.sin(phase + offset) * 0.32 * (1 - 0.75 * l);
    const up = 0.28 + 1.05 * l + wob * 0.55;
    const th1 = clamp(0.1 + walk * sgn * 0.5 + up * 0.62, -0.5, 1.9);
    const th2 = clamp(th1 + 0.22 + 0.5 * (1 - l) * (0.5 + 0.5 * Math.sin(phase + offset + 1.1)) + 0.12 * l, -0.3, 2.4);
    const el = { x: sh.x + 0.165 * Math.sin(th1), y: sh.y - 0.165 * Math.cos(th1) };
    return { elbow: el, hand: { x: el.x + 0.155 * Math.sin(th2), y: el.y - 0.155 * Math.cos(th2) } };
  };
  const armN = arm(Math.PI, 1), armF = arm(0, 1);
  // Drawing-only extras: a gently curved spine, and a little bob and hip sway as the feet shuffle.
  const bend = 0.035 * (0.4 + l) ;
  const midX = (hip.x + sh.x) / 2 + Math.cos(at) * bend, midY = (hip.y + sh.y) / 2 + Math.sin(at) * bend;
  const bob = 0.011 * Math.sin(phase * 2 + 0.6) * (1 - 0.6 * l);
  return { lean: l, hip, sh, neck, head, near, far, armN, armF, mid: { x: midX, y: midY }, bob };
}

// The body outline that must stay under the bar: knee, hip, shoulder, neck and an octagon for the head.
function outline(p) {
  const pts = [p.near.ankle, p.near.knee, p.hip, p.sh, p.neck];
  const h = p.head;
  for (let i = 0; i < 8; i++) { const t = (i / 8) * Math.PI * 2; pts.push({ x: h.x + Math.cos(t) * h.r, y: h.y + Math.sin(t) * h.r }); }
  return pts;
}
// Highest point of the body where it crosses the vertical line x = bx (dancer origin at ox), or -1 when it does not cross.
function crossHeight(p, ox, bx) {
  const pts = outline(p), n = pts.length;
  let best = -1;
  const seg = (a, b) => {
    const x1 = a.x + ox, x2 = b.x + ox;
    if ((x1 - bx) * (x2 - bx) > 0 || x1 === x2) { if (x1 === bx) best = Math.max(best, a.y); return; }
    const t = (bx - x1) / (x2 - x1);
    best = Math.max(best, a.y + (b.y - a.y) * t);
  };
  for (let i = 0; i < 4; i++) seg(pts[i], pts[i + 1]);
  seg(pts[4], pts[5]);
  for (let i = 5; i < n; i++) seg(pts[i], pts[i + 1 < n ? i + 1 : 5]);
  return best;
}
const maxX = (p) => Math.max(p.near.ankle.x, p.near.knee.x, p.hip.x, p.sh.x, p.head.x + p.head.r);
const minX = (p) => Math.min(p.near.ankle.x, p.hip.x, p.sh.x, p.neck.x, p.head.x - p.head.r);

// The highest point of the whole body at a steady lean (no wobble): what the bar has to clear.
export function bodyTop(lean) {
  const p = pose(lean, 0, 0);
  return Math.max(p.hip.y, p.sh.y, p.head.y + p.head.r);
}
// The smallest steady lean that gets under a bar of height b with `margin` to spare.
export function neededLean(b, margin = 0.0) {
  let lo = 0, hi = 1;
  if (bodyTop(1) > b - margin) return 1;
  if (bodyTop(0) <= b - margin) return 0;
  for (let i = 0; i < 24; i++) { const mid = (lo + hi) / 2; if (bodyTop(mid) > b - margin) lo = mid; else hi = mid; }
  return hi;
}

// ---- one attempt ----------------------------------------------------------------------------------------------------------
// phase: ready -> run -> (clear | touch | fall). `ev` collects things the presenter reacts to.
export function newAttempt(rng, round, opts = {}) {
  const p = (lo, hi) => rng.range(lo, hi);
  return {
    round, bar: opts.bar ?? barHeight(round), phase: 'ready', t: 0,
    x: TUNE.start, lean: 0, target: 0, wobble: 0, steer: 0, steerIn: 0, stepPh: 0,
    n: { f1: p(0.32, 0.55), p1: p(0, 6.28), f2: p(0.75, 1.3), p2: p(0, 6.28), a1: p(0.5, 0.7) },
    wvel: 0, minClear: 9, absW: 0, absN: 0, peakLean: 0, headPast: false, hipPast: false,
    speedScale: speedFor(round), noiseScale: noiseScale(round) * (opts.calm ? 0.8 : 1),
    ev: [], hitY: 0, fallDir: 0, sinceHit: 0, tHit: 0,
  };
}

export const driftNoise = (a) => a.n.a1 * Math.sin(a.t * a.n.f1 * 6.2832 + a.n.p1) + (1 - a.n.a1) * Math.sin(a.t * a.n.f2 * 6.2832 + a.n.p2);

export const balanceAt = (a) => clamp(a.wobble, -1, 1);

// ctl: { lean: 0..1 target, steer: -1..1, go: bool (start the walk) }
export function stepAttempt(a, dt, ctl) {
  if (a.phase === 'ready') {
    if (ctl.go) { a.phase = 'run'; a.ev.push({ k: 'go' }); }
    a.target = 0; a.lean = Math.max(0, a.lean - TUNE.leanDown * dt);
    return;
  }
  a.t += dt;
  if (a.phase === 'run') {
    // lean follows the finger at a limited rate; steering follows with a little lag
    a.target = clamp(ctl.lean, 0, 1);
    const rate = a.target > a.lean ? TUNE.leanUp : TUNE.leanDown;
    a.lean += clamp(a.target - a.lean, -rate * dt, rate * dt);
    a.steerIn = clamp(ctl.steer, -1, 1);
    a.steer += (a.steerIn - a.steer) * Math.min(1, TUNE.steerLag * dt);
    const l = a.lean;
    const g = TUNE.drift + TUNE.driftLean * l;
    const s = (TUNE.noise + TUNE.noiseLean * l) * a.noiseScale;
    a.wobble += (g * a.wobble + s * driftNoise(a) * 0.55 + TUNE.steerGain * a.steer) * dt;
    a.wobble = clamp(a.wobble, -1.15, 1.15);
    a.absW += Math.abs(a.wobble) * dt; a.absN += dt;
    a.peakLean = Math.max(a.peakLean, l);
    const sp = a.speedScale * (1 - TUNE.slowByLean * l);
    a.x += sp * dt; a.stepPh += sp * dt * 11.5;
    const p = pose(a.lean, a.wobble, a.stepPh);
    // The bar (x = 0). The body may only cross it below the bar.
    const top = crossHeight(p, a.x, 0);
    if (top >= 0) {
      const clr = a.bar - TUNE.barThick * 0.5 - top + TUNE.grace;
      a.minClear = Math.min(a.minClear, clr);
      if (clr < 0) { a.phase = 'touch'; a.hitY = top; a.tHit = a.t; a.ev.push({ k: 'touch', y: top }); return; }
    }
    if (Math.abs(a.wobble) >= TUNE.fallAt) { a.phase = 'fall'; a.fallDir = a.wobble > 0 ? 1 : -1; a.tHit = a.t; a.ev.push({ k: 'fall', dir: a.fallDir }); return; }
    if (!a.hipPast && p.hip.x + a.x > 0) { a.hipPast = true; a.ev.push({ k: 'hip' }); }
    if (!a.headPast && minX(p) + a.x > 0.01) {
      a.headPast = true; a.phase = 'clear'; a.sinceHit = 0;
      a.ev.push({ k: 'clear', clearance: Math.max(0, a.minClear), balance: 1 - Math.min(1, a.absW / Math.max(0.001, a.absN) / 0.6) });
    }
    return;
  }
  // after the outcome: the dancer keeps walking / tumbles; the presenter times the pause
  a.sinceHit += dt;
  if (a.phase === 'clear') {
    a.target = 0; a.lean = Math.max(0, a.lean - TUNE.leanDown * dt);
    a.wobble *= Math.max(0, 1 - 4 * dt);
    const sp = a.speedScale * 0.8;
    a.x += sp * dt; a.stepPh += sp * dt * 11.5;
  } else if (a.phase === 'touch') {
    a.wobble += (a.wobble >= 0 ? 1 : -1) * 0.3 * dt;
    a.lean = Math.max(0, a.lean - 0.4 * dt);
  }
}

// Points awarded for a cleared round: a base, a bonus for a narrow clearance and one for a steady balance.
export function roundPoints(round, ev) {
  const base = 100 + round * 20;
  const narrow = Math.round(60 * clamp(1 - ev.clearance / 0.08, 0, 1));
  const steady = Math.round(40 * clamp(ev.balance, 0, 1));
  return { base, narrow, steady, total: base + narrow + steady };
}

// ---- the computer player (Watch and Learn) ----------------------------------------------------------------------------------
// It leans late and deep enough, holds until the head is past, and steers the bubble back to the centre with a PD rule.
export function aiPlan(round) {
  const b = barHeight(round);
  const need = neededLean(b, 0.03);
  const target = clamp(need + 0.07 + 0.012 * round, 0, 1);
  return { bar: b, need, target };
}
export function aiControl(a, plan, memo) {
  const d = -a.x;                                 // distance from the feet to the bar
  const rampDist = a.speedScale * (0.55 + 0.45 * plan.target) + 0.12;
  const headRear = 0.36 * plan.target + 0.08;     // the head trails behind the feet by about this much at full lean
  let lean = 0;
  if (d < rampDist + 0.32 && d > -(headRear + 0.02)) lean = plan.target;
  if (d <= -(headRear - 0.02)) lean = 0.0;
  if (memo.prevW === undefined) memo.prevW = a.wobble;
  const dw = (a.wobble - memo.prevW) / (1 / 60);
  memo.prevW = a.wobble;
  const steer = clamp(-(1.15 * a.wobble + 0.16 * dw) / (TUNE.steerGain * 0.42), -1, 1);
  return { lean, steer, go: true };
}

// ---- beat and music ----------------------------------------------------------------------------------------------------
export const BEAT = 60 / TUNE.tempo;
// A pentatonic steel-pan-style figure, 8 beats, as semitone offsets from the root.
export const PAN = [0, 4, 7, 4, 9, 7, 4, 2];
