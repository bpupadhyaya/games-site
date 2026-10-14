// One throw. Pure and deterministic: the only randomness is the rng handed in once at creation, time is the dt of update().
// Axes: x = metres downrange from the thrower, y = metres up, z = metres across (+ = to the thrower's right). The boot circles the
// shoulder; the angle phi is measured from straight down, so the boot leaves in the direction it is moving: the launch angle IS phi.
import { G, KD, PIVOT_Y, LINE_X, MIN_FAIR, ARM_R, OMEGA0, STYLES, SLIP_BAND, BOOTS, SWEET_FRAC } from './consts.js';

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;
export const STEP = 1 / 60;
export const SETTLE_T = 1.9;      // seconds the landing is shown before the throw is over
const MAX_FLIGHT = 14;            // seconds
export const T_MAX = 6;           // a swing can never last longer than this

export const phiAt = (st, t) => OMEGA0 * t + (st.wMax - OMEGA0) * (t - st.tau * (1 - Math.exp(-t / st.tau)));
export const omegaAt = (st, t) => OMEGA0 + (st.wMax - OMEGA0) * (1 - Math.exp(-t / st.tau));
const wrapPi = (a) => { a = a % TAU; if (a > Math.PI) a -= TAU; if (a < -Math.PI) a += TAU; return a; };
export const lateralWob = (st, phi, p) => st.wob * Math.sin(2 * phi + p);   // degrees

// The boot's state at the instant it is let go (swing time t, aim in degrees).
export function launch(st, t, aim, p) {
  const phi = phiAt(st, t), om = omegaAt(st, t), a = wrapPi(phi), v = om * st.reach;
  const psi = (aim + lateralWob(st, phi, p)) * DEG;
  const h = Math.cos(a) * v;
  return { phi, om, a, v, psi, x: ARM_R * Math.sin(phi), y: PIVOT_Y - ARM_R * Math.cos(phi), z: 0, vx: h * Math.cos(psi), vy: Math.sin(a) * v, vz: h * Math.sin(psi), t: 0 };
}
export const windAt = (w, t) => { const g = 1 + 0.18 * Math.sin(1.3 * t + w.gp); return { x: w.x * g, z: w.z * g }; };

export function stepBoot(b, w, kd, dt) {
  const wi = windAt(w, b.t);
  const rx = b.vx - wi.x, rz = b.vz - wi.z, ry = b.vy, sp = Math.sqrt(rx * rx + ry * ry + rz * rz);
  b.vx += -kd * sp * rx * dt; b.vy += (-G - kd * sp * ry) * dt; b.vz += -kd * sp * rz * dt;
  b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt; b.t += dt;
}
const landed = (b) => b.y <= 0 && b.t > 0.02;

// Fly a launched boot to the ground (a copy). Returns where it first touches.
export function fly(l, w, kd) {
  const b = { ...l, t: 0 };
  let apex = b.y;
  for (let i = 0; i < MAX_FLIGHT / STEP; i++) {
    const px = b.x, py = b.y, pz = b.z;
    stepBoot(b, w, kd, STEP);
    if (b.y > apex) apex = b.y;
    if (landed(b)) { const f = py / Math.max(1e-6, py - b.y); return { x: px + (b.x - px) * f, z: pz + (b.z - pz) * f, t: b.t, apex, vx: b.vx, vz: b.vz }; }
  }
  return { x: b.x, z: b.z, t: b.t, apex, vx: b.vx, vz: b.vz };
}

export const verdict = (x, z, sector) => {
  const d = x - LINE_X;
  if (x < LINE_X || d < MIN_FAIR) return { fair: false, why: x < 0 ? 'back' : 'short', d: Math.max(0, d) };
  if (Math.abs(z) > x * Math.tan(sector * DEG)) return { fair: false, why: 'lane', d };
  return { fair: true, why: '', d };
};

export function createThrow(cfg, rng) {
  const styleIdx = cfg.style ?? 1, st = STYLES[styleIdx], boot = BOOTS[cfg.boot ?? 0];
  const strength = cfg.wind * (cfg.wind > 0 ? rng.range(0.55, 1) : 0), dirA = rng.range(0, TAU);
  const s = {
    phase: 'ready', t: 0, over: false, style: styleIdx, boot: cfg.boot ?? 0, sector: cfg.sector ?? 14, evId: 0, events: [],
    aim: 0, phi: 0, omega: OMEGA0, slipK: rng.range(SLIP_BAND[0], SLIP_BAND[1]), slipAt: 0, slipped: false,
    wobP: rng.range(0, TAU), wind: { x: strength * Math.cos(dirA), z: strength * Math.sin(dirA), gp: rng.range(0, TAU) }, windSpeed: strength,
    b: null, trail: [], maxX: 0, maxY: 0, rel: null, land: null, since: 0,
    outcome: null, why: '', dist: 0, landX: 0, landZ: 0, apex: 0, holdT: 0, phiRel: 0, bestD: 0,
  };
  s.slipAt = st.grip * s.slipK;
  const kd = KD * boot.drag;
  const ev = (type, extra) => { s.events.push({ id: s.evId++, type, t: s.t, ...extra }); if (s.events.length > 16) s.events.shift(); };
  const api = {
    s, kd,
    st: () => STYLES[s.style],
    setStyle(i) { if (s.phase !== 'ready') return; s.style = i; s.slipAt = STYLES[i].grip * s.slipK; },
    setAim(deg) { if (s.phase === 'ready') s.aim = Math.max(-s.sector - 2, Math.min(s.sector + 2, deg)); },
    begin() { if (s.phase !== 'ready') return false; s.phase = 'swing'; ev('begin'); return true; },
    // where the boot would land if let go at swing time t (aim in degrees); used by the guide, the hint and the computer player
    predict(t, aim = s.aim) {
      const l = launch(STYLES[s.style], t, aim, s.wobP), r = fly(l, s.wind, kd), v = verdict(r.x, r.z, s.sector);
      return { ...v, x: r.x, z: r.z, ft: r.t, apex: r.apex, phi: l.phi, om: l.om, v: l.v };
    },
    release(slip = false) {
      if (s.phase !== 'swing') return false;
      const stl = STYLES[s.style], l = launch(stl, s.t, s.aim, s.wobP);
      s.rel = { phi: l.phi, om: l.om, a: l.a, v: l.v, psi: l.psi }; s.holdT = s.t; s.phiRel = l.phi;
      s.b = { x: l.x, y: l.y, z: l.z, vx: l.vx, vy: l.vy, vz: l.vz, t: 0 }; s.maxX = l.x; s.maxY = l.y;
      s.slipped = slip; s.phase = 'flight'; s.since = 0; s.trail = [[l.x, l.y, l.z]];
      ev(slip ? 'slip' : 'release', { v: l.v });
      return true;
    },
    update(dt) {
      if (s.over || s.phase === 'ready') return;
      if (s.phase === 'swing') {
        s.t += dt; s.phi = phiAt(STYLES[s.style], s.t); s.omega = omegaAt(STYLES[s.style], s.t);
        if (s.t >= s.slipAt || s.t >= T_MAX) api.release(true);
        return;
      }
      if (s.phase === 'flight') {
        const b = s.b, px = b.x, py = b.y, pz = b.z;
        stepBoot(b, s.wind, kd, dt);
        s.since += dt;
        if (b.x > s.maxX) s.maxX = b.x;
        if (b.y > s.maxY) s.maxY = b.y;
        if (Math.round(b.t / STEP) % 3 === 0) { s.trail.push([b.x, b.y, b.z]); if (s.trail.length > 400) s.trail.shift(); }
        if (landed(b) || b.t > MAX_FLIGHT) {
          const f = py / Math.max(1e-6, py - b.y);
          s.landX = px + (b.x - px) * f; s.landZ = pz + (b.z - pz) * f; s.apex = s.maxY;
          const v = verdict(s.landX, s.landZ, s.sector);
          s.outcome = v.fair ? 'fair' : 'foul'; s.why = v.why; s.dist = v.fair ? Math.round(v.d * 10) / 10 : 0; s.rawDist = Math.round(v.d * 10) / 10;
          s.land = { x: s.landX, z: s.landZ, vx: b.vx, vz: b.vz, t: 0 }; s.trail.push([s.landX, 0, s.landZ]);
          s.phase = 'landed'; s.since = 0; ev('land', { outcome: s.outcome, dist: s.dist });
        }
        return;
      }
      if (s.phase === 'landed') {
        s.since += dt;
        if (s.since >= SETTLE_T) { s.over = true; ev('end', { outcome: s.outcome }); }
      }
    },
  };
  return api;
}

// ---- helpers for the guide, the hint, the rival and the computer player -----------------------------------------------------------------
// Best release moment for the current style and aim: scans swing time and returns the best predicted fair distance before tLimit.
export function bestRelease(run, tLimit, aim = 0) {
  const s = run.s, stl = STYLES[s.style];
  let best = { t: 0.8, d: -1, aim };
  for (let t = 0.6; t <= tLimit; t += STEP * 2) {
    const a = run.predict(t, aim);
    const sc = a.fair ? a.d : a.d * 0.05;
    if (sc > best.d) best = { t, d: sc, fair: a.fair, aim, x: a.x, z: a.z };
  }
  return { ...best, style: stl.id };
}
// Aim (degrees) that brings the landing to the middle of the lane for a release at swing time t (two secant steps).
export function aimFor(run, t) {
  let a = 0;
  for (let i = 0; i < 3; i++) {
    const p0 = run.predict(t, a), p1 = run.predict(t, a + 1), k = (p1.z - p0.z) || 1e-3;
    a = Math.max(-s2(run) , Math.min(s2(run), a - p0.z / k));
  }
  return Math.round(a * 10) / 10;
}
const s2 = (run) => run.s.sector + 2;

// The sweet arc at swing time t: launch angles (degrees from straight down, 0-180) whose predicted distance is within SWEET_FRAC of the best.
export function sweetArc(run, t) {
  const s = run.s, stl = STYLES[s.style], om = omegaAt(stl, t), v = om * stl.reach;
  let best = 0; const ds = [];
  for (let deg = 0; deg <= 90; deg += 3) {
    const a = deg * DEG, h = Math.cos(a) * v;
    const l = { x: ARM_R * Math.sin(a), y: PIVOT_Y - ARM_R * Math.cos(a), z: 0, vx: h, vy: Math.sin(a) * v, vz: 0, t: 0 };
    const r = fly(l, { x: s.wind.x, z: 0, gp: s.wind.gp }, run.kd), d = r.x - LINE_X;
    ds.push(d); if (d > best) best = d;
  }
  let lo = -1, hi = -1;
  ds.forEach((d, i) => { if (d >= best * SWEET_FRAC) { if (lo < 0) lo = i * 3; hi = i * 3; } });
  return { lo, hi, best };
}

// Three results for the rival of a round (distance in metres, 0 = a no-throw), drawn once from the round's rival skill.
export function rivalThrows(round, n, rng) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const foul = rng.next() < 0.24 - 0.18 * round.skill;
    const d = round.star3 * (0.5 + 0.48 * round.skill) * (1 + rng.range(-0.14, 0.1));
    out.push({ outcome: foul ? 'foul' : 'fair', dist: foul ? 0 : Math.round(d * 10) / 10 });
  }
  return out;
}

// The computer thrower. It looks at the wind and the three styles, picks the one that promises the most within a safe holding time, and
// plans the aim and the release moment. Small seeded errors keep it steady but human.
export function makeAi(skill, rng) {
  const e = 1 - Math.min(1, skill) * 0.55;
  return { errT: rng.range(-0.06, 0.06) * e, errAim: rng.range(-1.1, 1.1) * e, safe: 0.72 + 0.14 * skill };
}
export function aiPlan(run, ai, forced = null) {
  const s = run.s, keep = s.style;
  const cands = forced == null ? [0, 1, 2] : [forced];
  let best = null;
  for (const i of cands) {
    s.style = i;
    const stl = STYLES[i], lim = stl.grip * SLIP_BAND[0] * ai.safe;
    // choose the moment with the best distance when aimed straight; then fix the aim for that moment
    let t0 = 0.8, d0 = -1;
    for (let t = 0.7; t <= lim; t += STEP * 3) { const p = run.predict(t, 0); const sc = p.d; if (sc > d0) { d0 = sc; t0 = t; } }
    const aim = aimFor(run, t0);
    const p = run.predict(t0, aim);
    const score = p.fair ? p.d : p.d * 0.05;
    if (!best || score > best.score) best = { style: i, t: t0, aim, d: p.d, fair: p.fair, score, why: p.why, phi: p.phi, om: p.om };
  }
  s.style = keep;
  return best;
}
// the hold moment in the plan is where the hint tells the human to let go (seconds) and the angle of the boot then
export const releaseWords = (plan) => ({ sec: Math.round(plan.t * 10) / 10, deg: Math.round(((plan.phi / DEG) % 360 + 360) % 360) });

// The predicted flight path (x, y pairs) for a release at swing time t, for the dotted guide.
export function ghostPath(run, t, aim) {
  const s = run.s, l = launch(STYLES[s.style], t, aim, s.wobP), b = { ...l, t: 0 }, pts = [[b.x, b.y]];
  for (let i = 0; i < MAX_FLIGHT / STEP; i++) {
    stepBoot(b, s.wind, run.kd, STEP);
    if (i % 3 === 0) pts.push([b.x, b.y]);
    if (landed(b)) break;
  }
  return pts;
}
