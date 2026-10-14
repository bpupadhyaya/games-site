// Thanjavur Dancing Doll: the physics, the levels, the scoring and the performer. Pure and deterministic: no clock, no randomness.
//
// A doll is a weighted, round-bottomed toy. Its lean angle th (radians) swings like a pendulum whose speed is set by the ballast
// bead (0 = slow, 1 = quick). The player taps a doll to push it; the ghost shows the sway pattern to match.
export const TAU = Math.PI * 2;
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const sstep = (x) => { const c = clamp(x, 0, 1); return c * c * (3 - 2 * c); };
export const DEG = Math.PI / 180;

export const PHYS = {
  W_MIN: 2.4,        // rad/s natural swing speed with the ballast at "slow"
  W_MAX: 6.8,        // ... and at "quick"
  DAMP: 0.32,        // 1/s, how fast a free swing dies away
  HOLD_DAMP: 3.4,    // 1/s while a finger rests on the doll (steadying)
  TAP: 0.62,         // rad/s added to the swing by a full-strength tap (at the rim)
  TAP_MIN: 0.16,     // fraction of a full tap given by a tap right at the middle
  COOLDOWN: 0.12,    // s between taps on one doll
  FINGER: 0.16,      // s between any two taps: one finger can only be in one place
  HOLD_AFTER: 0.22,  // s of resting a finger before it steadies instead of taps
  LIMIT: 0.95,       // rad: the doll bumps the shelf
  BOUNCE: 0.35,
  REACT: 0.05,       // s the performer looks ahead
};
export const PHASES = { RAMP: 4, HOLD: 12, SETTLE: 5, REST: 1.5 };
export const TOTAL = PHASES.RAMP + PHASES.HOLD + PHASES.SETTLE + PHASES.REST;
export const SCORE = { sync: 0.8, settle: 0.2, stars: [0.45, 0.7, 0.88], max: 1000 };
export const DEMO_LEVELS = 3;
export const DEMO_RUNS = 4;
export const REVEAL_SECONDS = 2;
export const SETTLE_TH = 0.05, SETTLE_OM = 0.4;

export const omegaOf = (b) => PHYS.W_MIN + (PHYS.W_MAX - PHYS.W_MIN) * clamp(b, 0, 1);
export const periodOf = (b) => TAU / omegaOf(b);
export const ballastFor = (T) => clamp((TAU / T - PHYS.W_MIN) / (PHYS.W_MAX - PHYS.W_MIN), 0, 1);

// ---- the levels ------------------------------------------------------------------------------------------------------------------
export const SETS = [
  { name: 'First Sway', blurb: 'One doll, then two, with slow and gentle nods.' },
  { name: 'Twin Nods', blurb: 'Two dolls that swing together, apart or in turn.' },
  { name: 'Three on the Shelf', blurb: 'A whole row of dolls to tune and keep in time.' },
  { name: 'Quick Step', blurb: 'Lighter dolls and a faster, lively beat.' },
  { name: 'Verandah Breeze', blurb: 'A breeze comes through and leans on the dolls.' },
  { name: 'The Grand Set', blurb: 'Big swings, tight timing and every trick together.' },
];
// T seconds per swing (one full back-and-forth), A peak lean in degrees, ph where in the cycle each doll begins (0..1).
const ROWS = [
  // set 1
  { T: [2.0], A: [16], ph: [0], tol: 9, br: 0, mark: 0.14 },
  { T: [1.8], A: [18], ph: [0], tol: 8.5, br: 0, mark: 0.14 },
  { T: [1.5], A: [20], ph: [0], tol: 8, br: 0, mark: 0.14 },
  { T: [2.0, 1.6], A: [18, 20], ph: [0, 0], tol: 8, br: 0, mark: 0.13 },
  // set 2
  { T: [1.8, 1.8], A: [18, 18], ph: [0, 0.5], tol: 8, br: 0, mark: 0.12 },
  { T: [1.6, 1.6], A: [20, 20], ph: [0, 0.25], tol: 7.5, br: 0, mark: 0.12 },
  { T: [2.2, 1.4], A: [18, 22], ph: [0, 0], tol: 7.5, br: 0, mark: 0.11 },
  { T: [1.5, 1.5], A: [22, 22], ph: [0, 0.5], tol: 7, br: 0, mark: 0.1 },
  // set 3
  { T: [1.8, 1.8, 1.8], A: [18, 22, 18], ph: [0, 0, 0], tol: 7, br: 0, mark: 0.09 },
  { T: [1.8, 1.8, 1.8], A: [20, 20, 20], ph: [0, 0.33, 0.67], tol: 6.5, br: 0, mark: 0.09 },
  { T: [2.0, 1.5, 1.2], A: [18, 20, 22], ph: [0, 0, 0], tol: 6.5, br: 0, mark: 0.08 },
  { T: [1.6, 1.6, 1.6], A: [22, 24, 22], ph: [0, 0.5, 0], tol: 6, br: 0, mark: 0.08 },
  // set 4
  { T: [1.2, 1.2], A: [20, 20], ph: [0, 0.5], tol: 6, br: 0, mark: 0.07 },
  { T: [1.3, 1.0], A: [22, 20], ph: [0, 0], tol: 6, br: 0, mark: 0.07 },
  { T: [1.2, 1.2, 1.2], A: [20, 22, 20], ph: [0, 0.33, 0.67], tol: 5.5, br: 0, mark: 0.06 },
  { T: [1.4, 1.1, 1.0], A: [24, 22, 20], ph: [0, 0.5, 0], tol: 5.5, br: 0, mark: 0.06 },
  // set 5
  { T: [1.8, 1.8], A: [22, 22], ph: [0, 0.5], tol: 6, br: 0.55, mark: 0.05 },
  { T: [1.6, 1.3], A: [24, 22], ph: [0, 0], tol: 6, br: 0.6, mark: 0.05 },
  { T: [1.5, 1.5, 1.5], A: [24, 24, 24], ph: [0, 0.33, 0.67], tol: 5.5, br: 0.65, mark: 0 },
  { T: [2.0, 1.5, 1.2], A: [24, 26, 22], ph: [0, 0.5, 0], tol: 5.5, br: 0.7, mark: 0 },
  // set 6
  { T: [1.6, 1.6, 1.6], A: [30, 32, 30], ph: [0, 0, 0], tol: 5.5, br: 0.55, mark: 0 },
  { T: [2.2, 1.6, 1.1], A: [28, 30, 24], ph: [0, 0.25, 0.5], tol: 5, br: 0.6, mark: 0 },
  { T: [1.5, 1.5, 1.5], A: [28, 30, 28], ph: [0, 0.5, 0], tol: 5.5, br: 0.6, mark: 0 },
  { T: [1.9, 1.4, 1.1], A: [30, 28, 24], ph: [0, 0.33, 0.67], tol: 5, br: 0.6, mark: 0 },
];
// The timing window as a share of the smallest peak lean in the level: wide at first, tighter as the sets go on. (Wide enough that
// standing still never earns a star, because a still doll is only inside the window while the ghost is near the middle.)
const TOL_SHARE = [0.36, 0.35, 0.34, 0.33, 0.32, 0.31, 0.3, 0.3, 0.3, 0.29, 0.28, 0.28, 0.28, 0.27, 0.26, 0.26, 0.27, 0.26, 0.26, 0.26, 0.25, 0.25, 0.24, 0.24];
export const LEVEL_COUNT = ROWS.length;
export const DAILY = LEVEL_COUNT;                       // index of the daily level in lists of levels
const hashI = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

export function levelFor(idx, day = 0) {
  if (idx === DAILY) {
    const h = (k) => hashI(day * 7.31 + k * 3.17), n = 3;
    const T = [], A = [], ph = [];
    for (let i = 0; i < n; i++) { T.push(Math.round((1.0 + h(i) * 1.3) * 10) / 10); A.push(Math.round(18 + h(i + 5) * 14)); ph.push([0, 0.25, 0.33, 0.5][Math.floor(h(i + 9) * 4)]); }
    ph[0] = 0;
    return build(idx, { name: 'Daily Set', set: -1, T, A, ph, tol: 0.27 * Math.min(...A), br: 0.4, mark: 0.04 });
  }
  const r = ROWS[clamp(idx, 0, LEVEL_COUNT - 1)];
  return build(idx, { name: `${Math.floor(idx / 4) + 1}-${(idx % 4) + 1}`, set: Math.floor(idx / 4), ...r, tol: TOL_SHARE[clamp(idx, 0, LEVEL_COUNT - 1)] * Math.min(...r.A) });
}
function build(idx, r) {
  const n = r.T.length;
  const dolls = [];
  for (let i = 0; i < n; i++) dolls.push({ T: r.T[i], A: r.A[i] * DEG, ph: r.ph[i], ch: (idx * 3 + i * 5 + 1) % 8, variant: (idx + i) % 3 });
  return { idx, name: r.name, set: r.set, n, dolls, tol: r.tol * DEG, breeze: r.br, mark: r.mark, daily: idx === DAILY };
}
export const levelStats = (L) => ({ dolls: L.n, minT: Math.min(...L.dolls.map((d) => d.T)), maxT: Math.max(...L.dolls.map((d) => d.T)), maxA: Math.max(...L.dolls.map((d) => d.A)) / DEG, tol: L.tol / DEG, breeze: L.breeze });

// ---- the ghost: the pattern to match ---------------------------------------------------------------------------------------------
export function envAt(t) {
  const { RAMP, HOLD, SETTLE } = PHASES;
  if (t < RAMP) return sstep(t / RAMP);
  if (t < RAMP + HOLD) return 1;
  if (t < RAMP + HOLD + SETTLE) return 1 - sstep((t - RAMP - HOLD) / SETTLE);
  return 0;
}
function ghostRaw(d, t) { return envAt(t) * d.A * Math.sin(TAU * (t / d.T + d.ph)); }
export function ghostAt(L, i, t) {
  const d = L.dolls[i], e = 1e-3;
  const th = ghostRaw(d, t), om = (ghostRaw(d, t + e) - ghostRaw(d, t - e)) / (2 * e);
  // the ghost of a doll that has not started yet sits upright
  return { th: t < 0 ? 0 : th, om: t < 0 ? 0 : om };
}
const calmAt = (t) => 1 - sstep((t - PHASES.RAMP - PHASES.HOLD) / (PHASES.SETTLE * 0.6));
export const breezeAt = (L, i, t) => L.breeze * (Math.sin(0.9 * t + i * 1.7) + 0.6 * Math.sin(1.7 * t + 2.1 + i * 0.8)) * calmAt(t);

// ---- the world ---------------------------------------------------------------------------------------------------------------------
export function createWorld(L, o = {}) {
  const dolls = L.dolls.map((d, i) => ({
    b: o.b0 ?? 0.5, th: 0, om: 0, cd: 0, held: 0, tapped: 0,
    inBand: false, syncT: 0, bandT: 0, streak: 0, bestStreak: 0, err: 0, i, d,
  }));
  return { L, mode: o.mode ?? 'play', t: 0, phase: 'tune', dolls, events: [], over: false, tol: L.tol * (o.mode === 'practice' ? 1.4 : 1), holdTime: 0, endHold: 0, lastExt: dolls.map(() => 0), finger: 0 };
}

// cmd: { start, ballast: [b|null], taps: [{i, dir, mag}], hold: [bool] }
export function stepWorld(W, dt, cmd = {}) {
  W.events.length = 0;
  const L = W.L;
  if (W.over) return;
  if (cmd.ballast) cmd.ballast.forEach((b, i) => { if (b != null && W.dolls[i]) W.dolls[i].b = clamp(b, 0, 1); });
  const tuning = W.phase === 'tune';
  if (tuning && cmd.start) {
    W.phase = 'run'; W.events.push({ type: 'start' });
    for (const o of W.dolls) { o.th = 0; o.om = 0; o.cd = 0; }
    return;
  }
  const t0 = W.t;
  W.finger = Math.max(0, W.finger - dt);
  if (!tuning) W.t += dt;
  const t = W.t;
  W.dolls.forEach((o, i) => {
    o.cd = Math.max(0, o.cd - dt);
    o.tapped = Math.max(0, o.tapped - dt);
    const w = omegaOf(o.b);
    // taps are instantaneous kicks to the swing speed
    const hold = cmd.hold?.[i] === true;
    o.held = hold ? o.held + dt : 0;
    for (const tp of cmd.taps ?? []) {
      if (tp.i !== i || o.cd > 0 || W.finger > 0) continue;
      W.finger = PHYS.FINGER;
      o.om += tp.dir * PHYS.TAP * clamp(tp.mag ?? 1, PHYS.TAP_MIN, 1);
      o.cd = PHYS.COOLDOWN; o.tapped = 0.25;
      W.events.push({ type: 'tap', i, dir: tp.dir, mag: tp.mag ?? 1 });
    }
    const c = PHYS.DAMP + (hold && o.held > PHYS.HOLD_AFTER ? PHYS.HOLD_DAMP : 0);
    const sub = 4, h = dt / sub;
    for (let k = 0; k < sub; k++) {
      const tk = t0 + (k + 1) * h;
      const acc = -w * w * Math.sin(o.th) - c * o.om + (tuning ? 0 : breezeAt(L, i, tk));
      o.om += acc * h; o.th += o.om * h;
      if (o.th > PHYS.LIMIT) { o.th = PHYS.LIMIT; if (o.om > 0) { o.om = -o.om * PHYS.BOUNCE; W.events.push({ type: 'bump', i, dir: 1 }); } }
      if (o.th < -PHYS.LIMIT) { o.th = -PHYS.LIMIT; if (o.om < 0) { o.om = -o.om * PHYS.BOUNCE; W.events.push({ type: 'bump', i, dir: -1 }); } }
    }
    if (tuning) return;
    const g = ghostAt(L, i, t);
    o.err = o.th - g.th;
    // a tick each time the ghost reaches the end of its swing
    const prev = W.lastExt[i];
    if (envAt(t) > 0.3 && prev !== 0 && prev * g.om < 0) W.events.push({ type: 'tick', i, side: g.th > 0 ? 1 : -1 });
    W.lastExt[i] = g.om === 0 ? prev : Math.sign(g.om);
    if (t > PHASES.RAMP && t0 <= PHASES.RAMP + PHASES.HOLD) {
      const inb = Math.abs(o.err) < W.tol;
      o.bandT += dt; if (inb) { o.syncT += dt; o.streak += dt; o.bestStreak = Math.max(o.bestStreak, o.streak); } else o.streak = 0;
      if (inb !== o.inBand) W.events.push({ type: inb ? 'band' : 'unband', i });
      o.inBand = inb;
    } else o.inBand = Math.abs(o.err) < W.tol;
  });
  if (tuning) return;
  if (t0 < PHASES.RAMP && t >= PHASES.RAMP) W.events.push({ type: 'phase', name: 'hold' });
  if (t0 < PHASES.RAMP + PHASES.HOLD && t >= PHASES.RAMP + PHASES.HOLD) W.events.push({ type: 'phase', name: 'settle' });
  if (t0 < PHASES.RAMP + PHASES.HOLD + PHASES.SETTLE && t >= PHASES.RAMP + PHASES.HOLD + PHASES.SETTLE) W.events.push({ type: 'phase', name: 'rest' });
  if (t >= TOTAL) { W.over = true; W.phase = 'over'; W.events.push({ type: 'end' }); }
}

export const phaseName = (t) => (t < PHASES.RAMP ? 'ramp' : t < PHASES.RAMP + PHASES.HOLD ? 'hold' : t < PHASES.RAMP + PHASES.HOLD + PHASES.SETTLE ? 'settle' : 'rest');

// Live sync percentage so far (of the hold window).
export function liveSync(W) {
  let s = 0, b = 0;
  for (const o of W.dolls) { s += o.syncT; b += o.bandT; }
  return b > 0 ? s / b : 0;
}
export function settleScore(o) { return 1 - clamp((Math.abs(o.th) / SETTLE_TH + Math.abs(o.om) / SETTLE_OM) / 2, 0, 1); }

export function resultOf(W) {
  const per = W.dolls.map((o) => (o.bandT > 0 ? o.syncT / PHASES.HOLD : 0));
  const sync = per.reduce((a, b) => a + b, 0) / Math.max(1, per.length);
  const settle = W.dolls.reduce((a, o) => a + settleScore(o), 0) / Math.max(1, W.dolls.length);
  const quality = SCORE.sync * sync + SCORE.settle * settle;
  const stars = quality >= SCORE.stars[2] ? 3 : quality >= SCORE.stars[1] ? 2 : quality >= SCORE.stars[0] ? 1 : 0;
  return {
    level: W.L.idx, mode: W.mode, sync, settle, quality, score: Math.round(quality * SCORE.max), stars,
    per, streak: Math.max(...W.dolls.map((o) => o.bestStreak)), completed: W.over,
  };
}

// ---- the performer (Watch and Learn, and the menu backdrop) ----------------------------------------------------------------------
// Steers each doll towards the ghost's state with taps whose strength it chooses (as a finger would, nearer the rim = stronger).
export function botCommand(W, skill = 1) {
  const cmd = { start: false, ballast: [], taps: [], hold: [] };
  if (W.phase === 'tune') return cmd;
  const L = W.L, la = PHYS.REACT * (2 - skill);
  let best = null;
  W.dolls.forEach((o, i) => {
    const w = omegaOf(o.b), g = ghostAt(L, i, W.t + la);
    const eth = g.th - o.th, eom = g.om - o.om;
    const u = eom + 0.7 * w * eth;
    const dead = PHYS.TAP * PHYS.TAP_MIN * 0.5;
    if (o.cd <= 0 && Math.abs(u) > dead && (!best || Math.abs(u) > Math.abs(best.u))) best = { i, u };
    // after the swing is over, rest a finger on the doll to steady it
    cmd.hold[i] = W.t > PHASES.RAMP + PHASES.HOLD + PHASES.SETTLE && Math.abs(o.th) < 0.2;
  });
  // one finger: only the most urgent doll gets a tap, and only when the finger is free
  if (best && W.finger <= 0) cmd.taps.push({ i: best.i, dir: Math.sign(best.u), mag: clamp(Math.abs(best.u) / PHYS.TAP, PHYS.TAP_MIN, 1) });
  return cmd;
}

// Where the performer wants the ballast beads (the tuned position for each doll).
export const targetBallast = (L) => L.dolls.map((d) => ballastFor(d.T));
