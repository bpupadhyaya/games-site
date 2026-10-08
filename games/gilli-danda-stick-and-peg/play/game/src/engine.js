// One striker's innings: a pure, deterministic state machine (no DOM, no clock). The caller owns three random streams R = { p, f, a }:
// p = flip wobble and tips, f = fielders (judging the landing, catching), a = the computer striker. Time comes only from dt.
//
// A chance: READY (fielders take their places) -> TAP (a pendulum, press at the gold centre) -> FLIP (the gilli is in the air, press to swing)
// -> SWING (0.12 s to contact) -> FLY (the gilli travels, fielders run, a catch ends it) -> RESULT -> the next chance or END.
import { G, DT, DEG, clamp, lerp, smooth, DANDA, SW, HS, GILLI_Y0, AIM_MAX, VMAX, DRAG, LEVELS, ASSISTS } from './core.js';

export const READY_T = 1.5;
export const TAP_MIN = 0.3;          // the pendulum starts at the edge; the first centre pass is a quarter period later
export const RESULT_T = 2.4;
export const FLIP_MIN_H = 0.8, FLIP_MAX_H = 1.8;
export const TAP_ZONES = { perfect: 0.1, good: 0.26, ok: 0.5 };   // |pendulum| thresholds before the level and assist scale
export const SWING_DY = 0.4;        // metres of height error that give q = 0 (before scale)
export const MAX_FLY = 9;

const nextEv = (r, e) => { r.events.push({ id: ++r.evId, ...e }); if (r.events.length > 40) r.events.splice(0, r.events.length - 40); };

// ---- formation --------------------------------------------------------------------------------------------------------------------
const FORM = [
  [{ a: -26, d: 16 }, { a: 10, d: 26 }, { a: 32, d: 38 }],
  [{ a: -30, d: 14 }, { a: -8, d: 24 }, { a: 16, d: 34 }, { a: 36, d: 40 }],
  [{ a: -34, d: 13 }, { a: -15, d: 22 }, { a: 3, d: 32 }, { a: 21, d: 40 }, { a: 40, d: 28 }],
];
const pol = (a, d) => [Math.sin(a * DEG) * d, Math.cos(a * DEG) * d];

function formation(r, R) {
  const L = LEVELS[r.level], base = FORM[r.level].slice(0, L.fielders);
  const out = base.map((b) => ({ a: b.a + R.f.range(-5, 5), d: b.d + R.f.range(-2, 2) }));
  // fielders watch where you hit: the nearest two slide toward your last direction and range (more with level)
  const w = [0.2, 0.45, 0.7][r.level];
  if (r.hits.length) {
    const last = r.hits[r.hits.length - 1], tgtA = last.az * AIM_MAX, tgtD = clamp(last.dist * 0.9, 8, 32);
    const order = out.map((o, i) => [Math.abs(o.a - tgtA) + Math.abs(o.d - tgtD) * 0.4, i]).sort((x, y) => x[0] - y[0]);
    const n = r.level === 0 ? 1 : 2;
    for (let k = 0; k < n; k++) { const o = out[order[k][1]]; o.a = lerp(o.a, tgtA + R.f.range(-6, 6), w); o.d = lerp(o.d, tgtD, w * 0.8); }
  }
  // keep them apart and off the striker
  for (let i = 0; i < out.length; i++) for (let j = 0; j < i; j++) {
    const [xi, zi] = pol(out[i].a, out[i].d), [xj, zj] = pol(out[j].a, out[j].d);
    const dd = Math.hypot(xi - xj, zi - zj);
    if (dd < 4) out[i].a += (out[i].a >= out[j].a ? 1 : -1) * (4 - dd) * 1.8;
  }
  return out.map((o) => { o.a = clamp(o.a, -AIM_MAX - 6, AIM_MAX + 6); o.d = clamp(o.d, 7, 34); const [x, z] = pol(o.a, o.d); return { x, z }; });
}

function walkTo(f, tx, tz, speed, delay = 0) {
  f.path = { x0: f.x, z0: f.z, tx, tz, t: -delay, speed, len: Math.hypot(tx - f.x, tz - f.z) };
}
function stepFielder(f, dt) {
  const p = f.path;
  if (!p) { f.moving = 0; return; }
  p.t += dt;
  if (p.t < 0) { f.moving = 0; return; }
  const d = Math.min(p.len, p.t * p.speed);
  const k = p.len > 1e-6 ? d / p.len : 1;
  const nx = lerp(p.x0, p.tx, k), nz = lerp(p.z0, p.tz, k);
  if (p.len - d > 0.03) { f.yaw = Math.atan2(p.tx - p.x0, p.tz - p.z0); f.moving = p.speed; } else f.moving = 0;
  f.x = nx; f.z = nz;
}
const posAt = (f, t) => { const p = f.path; if (!p || p.len < 1e-6) return [f.x, f.z]; const d = clamp((t - (p.t0 ?? 0)) * p.speed, 0, p.len), k = d / p.len; return [lerp(p.x0, p.tx, k), lerp(p.z0, p.tz, k)]; };

// ---- the flip -----------------------------------------------------------------------------------------------------------------------
export function flipHeight(qt) { return lerp(FLIP_MIN_H, FLIP_MAX_H, clamp(qt, 0, 1)); }
/** The gilli in the air at flip clock t (analytic): position, spin angle. */
export function gilliAt(fl, t) {
  const u = Math.max(0, t);
  return { x: fl.dx * u, y: GILLI_Y0 + fl.vy * u - 0.5 * G * u * u, z: fl.dz * u, spin: fl.spin * u };
}
export const airTime = (fl) => (2 * fl.vy) / G;
export function strikeHeight(fl) { return Math.min(HS, GILLI_Y0 + (fl.vy * fl.vy) / (2 * G) - 0.06); }
/** Flip-clock time at which the gilli falls through the striking height. */
export function idealTime(fl) {
  const hs = strikeHeight(fl), disc = Math.max(0, fl.vy * fl.vy - 2 * G * (hs - GILLI_Y0));
  return (fl.vy + Math.sqrt(disc)) / G;
}
export const idealPress = (fl) => idealTime(fl) - SW;     // flip-clock time at which pressing is perfect

// ---- the round --------------------------------------------------------------------------------------------------------------------
export function createRound(o, R) {
  const r = {
    mode: o.mode ?? 'solo', field: o.field ?? 'lane', level: o.level ?? 1, label: o.label ?? 'Chance', striker: o.striker, chances: o.chances ?? 6, outEnds: !!o.outEnds,
    bot: o.bot ?? null, assist: ASSISTS[o.assistIdx ?? 1], auto: !!o.auto, hold: false,
    phase: 'ready', pt: 0, clock: 0, n: 0, az: 0, tapped: 0,
    flip: null, fp: 0, sw: null, fly: null, ft: 0, res: null, tap: null,
    fielders: [], score: 0, best: 0, hits: [], outs: 0, over: false, hints: o.hints ?? 3,
    events: [], evId: 0, stats: { perfectTap: 0, perfectSwing: 0, catches: 0, drops: 0, whiffs: 0, tapMiss: 0 },
  };
  const L = LEVELS[r.level];
  const spots = formation(r, R);
  r.fielders = spots.map((s, i) => ({ id: i, x: s.x, z: s.z, yaw: Math.atan2(-s.x, -s.z) * 0 + Math.PI, moving: 0, path: null, state: 'wait', speed: L.speed * (0.94 + 0.12 * R.f.next()), react: L.react * (0.85 + 0.3 * R.f.next()), skill: clamp(L.skill + R.f.range(-0.08, 0.08), 0.1, 0.98), look: i }));
  for (const f of r.fielders) f.yaw = Math.atan2(-f.x, -f.z + 0.01);
  r.ready = true;
  nextEv(r, { k: 'ready', n: 1 });
  return r;
}

export const penPos = (r, pt = r.pt) => Math.cos((2 * Math.PI * pt) / LEVELS[r.level].tapP);       // -1..1, +1 at the start
export const tapScale = (r) => LEVELS[r.level].tapZ * r.assist;
export const swingScale = (r) => LEVELS[r.level].swZ * r.assist;
export function tapQuality(r, pend) {
  const e = Math.abs(pend), z = tapScale(r);
  if (e < TAP_ZONES.perfect * z) return { kind: 'perfect', q: 1 - e / (TAP_ZONES.perfect * z) * 0.12 };
  if (e < TAP_ZONES.good * z) return { kind: 'good', q: 0.78 - (e - TAP_ZONES.perfect * z) / ((TAP_ZONES.good - TAP_ZONES.perfect) * z) * 0.2 };
  if (e < TAP_ZONES.ok * z) return { kind: 'ok', q: 0.45 - (e - TAP_ZONES.good * z) / ((TAP_ZONES.ok - TAP_ZONES.good) * z) * 0.2 };
  return { kind: 'miss', q: 0 };
}

function beginReady(r, R) {
  r.phase = 'ready'; r.pt = 0; r.flip = null; r.sw = null; r.fly = null; r.res = null; r.fp = 0; r.ft = 0; r.tap = null;
  const spots = formation(r, R);
  r.fielders.forEach((f, i) => { f.state = 'wait'; walkTo(f, spots[i].x, spots[i].z, 3.2 + i * 0.1, 0.15 * i); });
  nextEv(r, { k: 'ready', n: r.n + 1 });
}

/** Press on the tap pendulum. Returns the tap result or null if not in the TAP phase. */
export function tapNow(r, R) {
  if (r.phase !== 'tap') return null;
  const pend = penPos(r), t = tapQuality(r, pend);
  r.tap = { ...t, pend };
  r.n += 1;
  if (t.kind === 'miss') {
    r.stats.tapMiss += 1;
    r.res = { kind: 'tapmiss', text: 'Missed the peg', sub: 'Press when the danda is in the gold.', dl: 0 };
    nextEv(r, { k: 'tapmiss' });
    r.phase = 'result'; r.pt = 0;
    return r.tap;
  }
  if (t.kind === 'perfect') r.stats.perfectTap += 1;
  const H = flipHeight(t.q), vy = Math.sqrt(2 * G * (H - GILLI_Y0));
  const wob = (1 - t.q) * 0.5 + 0.06;      // sideways wobble of a poor flip
  r.flip = { H, vy, q: t.q, kind: t.kind, dx: R.p.range(-1, 1) * wob * 0.55, dz: 0.1 + R.p.range(-0.25, 0.5) * wob, spin: (4 + 7 * t.q) * (R.p.chance(0.5) ? 1 : -1) };
  r.phase = 'flip'; r.pt = 0; r.fp = 0; r.sw = null;
  nextEv(r, { k: 'flip', q: t.q, kind: t.kind });
  return r.tap;
}

/** Press on the swing. `az` (-1..1) overrides the aim. */
export function swingNow(r, R, az = null) {
  if (r.phase !== 'flip' || r.sw) return null;
  if (az != null) r.az = clamp(az, -1, 1);
  const fl = r.flip, ts = r.fp, tc = ts + SW;
  const tIdeal = idealTime(fl), hs = strikeHeight(fl);
  const air = airTime(fl);
  const sw = { ts, tc, az: r.az, tIdeal, dt: tc - tIdeal, q: 0, kind: 'whiff', dy: 0 };
  r.sw = sw;
  if (tc < air - 0.03) {
    const g = gilliAt(fl, tc), dy = g.y - hs;
    const dyN = dy / (SWING_DY * swingScale(r));
    const qh = 1 - Math.pow(clamp(Math.abs(dyN), 0, 1), 1.7), qx = 1 - clamp(Math.abs(g.x) / 0.32, 0, 1);
    sw.dy = dy; sw.dyN = dyN; sw.q = clamp(qh * (0.88 + 0.12 * qx), 0, 1); sw.pos = [g.x, g.y, g.z];
    sw.kind = sw.q < 0.08 ? 'whiff' : sw.q < 0.3 ? 'tip' : sw.q > 0.92 ? 'perfect' : 'hit';
  }
  r.phase = 'swing'; r.pt = 0;
  nextEv(r, { k: 'swing', ts });
  return sw;
}

// ---- flight ---------------------------------------------------------------------------------------------------------------------------
function integrate(p0, v0, opts = {}) {
  const pts = []; let [x, y, z] = p0, [vx, vy, vz] = v0;
  const h = 1 / 120; let t = 0, landed = null, bounces = 0, tLand = 0;
  pts.push(x, y, z);
  let n = 0;
  while (t < MAX_FLY && n < 60 * MAX_FLY) {
    for (let s = 0; s < 2; s++) {
      const sp = Math.hypot(vx, vy, vz);
      vx -= DRAG * sp * vx * h; vy -= (G + DRAG * sp * vy) * h; vz -= DRAG * sp * vz * h;
      x += vx * h; y += vy * h; z += vz * h; t += h;
      if (y <= 0.02 && vy < 0) {
        if (!landed) { landed = { t, x, z, speed: Math.hypot(vx, vz), vy }; tLand = t; }
        y = 0.02; vy = -vy * 0.32; vx *= 0.55; vz *= 0.55; bounces += 1;
        if (bounces > 3) { vy = 0; }
      }
      if (landed && y <= 0.021) { vx *= 1 - 3.2 * h; vz *= 1 - 3.2 * h; }
    }
    pts.push(x, y, z); n += 1;
    if (landed && t - tLand > 1.3) break;
    if (opts.stopAtLand && landed) break;
  }
  return { traj: new Float32Array(pts), n: pts.length / 3, landed };
}

/** Where a strike with these parameters goes, with no fielders. */
export function launch(q, dyN, dtErr, az, qFlip = 0.7) {
  const v = VMAX * (0.28 + 0.72 * Math.pow(q, 0.9)) * (0.94 + 0.06 * qFlip);
  const loft = clamp(31 - dyN * 24, 9, 62);
  const azDeg = az * AIM_MAX + clamp(dtErr / 0.09, -1, 1) * 8;
  return { v, loft, azDeg };
}

export function buildFlight(r, R, p0, par, rolls) {
  const L = LEVELS[r.level];
  const cl = Math.cos(par.loft * DEG), sl = Math.sin(par.loft * DEG), sa = Math.sin(par.azDeg * DEG), ca = Math.cos(par.azDeg * DEG);
  let fl = integrate(p0, [par.v * cl * sa, par.v * sl, par.v * cl * ca]);
  const land = fl.landed ? { x: fl.landed.x, z: fl.landed.z, t: fl.landed.t } : { x: 0, z: 0, t: 0 };
  // fielders judge the landing (more or less well) and run
  const chase = r.fielders.map((f) => {
    const e = (1 - f.skill) * 2.8;
    const tx = land.x + (rolls ? R.f.range(-1, 1) : 0) * e, tz = land.z + (rolls ? R.f.range(-1, 1) : 0) * e;
    return { f, tx, tz };
  });
  const paths = chase.map(({ f, tx, tz }) => ({ x0: f.x, z0: f.z, tx, tz, t0: f.react, speed: f.speed, len: Math.hypot(tx - f.x, tz - f.z) }));
  const at = (i, t) => { const p = paths[i]; const d = clamp((t - p.t0) * p.speed, 0, p.len), k = p.len > 1e-6 ? d / p.len : 1; return [lerp(p.x0, p.tx, k), lerp(p.z0, p.tz, k)]; };
  // first fielder to get a hand to it
  let catchAt = null;
  for (let k = 3; k < fl.n && !catchAt; k++) {
    const t = k / 60, x = fl.traj[k * 3], y = fl.traj[k * 3 + 1], z = fl.traj[k * 3 + 2];
    if (y > 2.45 || y < 0.1) continue;
    if (landed(fl) && t > fl.landed.t + 0.02) break;
    for (let i = 0; i < paths.length; i++) {
      const [fx, fz] = at(i, t), d = Math.hypot(fx - x, fz - z), f = r.fielders[i];
      if (d < L.reach * (0.85 + 0.3 * f.skill)) { catchAt = { i, k, t, x, y, z }; break; }
    }
  }
  const out = { traj: fl.traj, n: fl.n, land, paths, par, caught: null, drop: null, tEnd: 0, dist: 0, dl: 0, rest: null };
  if (catchAt) {
    const f = r.fielders[catchAt.i];
    const sp = Math.hypot(fl.traj[(catchAt.k + 1) * 3] - fl.traj[catchAt.k * 3], fl.traj[(catchAt.k + 1) * 3 + 2] - fl.traj[catchAt.k * 3 + 2]) * 60;
    const p = clamp(0.5 + 0.5 * f.skill - 0.2 * clamp((sp - 12) / 20, 0, 1), 0.2, 0.97);
    const ok = rolls ? R.f.next() < p : p >= 0.5;
    out.catchP = p;
    if (ok) {
      out.caught = catchAt; out.n = catchAt.k + 1; out.tEnd = catchAt.t; out.traj = fl.traj.slice(0, out.n * 3);
    } else {
      // dropped: it falls from the hands (a little way forward), bounces and rests
      const f2 = integrate([catchAt.x, catchAt.y, catchAt.z], [(fl.traj[(catchAt.k + 1) * 3] - catchAt.x) * 12, 0, (fl.traj[(catchAt.k + 1) * 3 + 2] - catchAt.z) * 12]);
      const head = fl.traj.slice(0, (catchAt.k + 1) * 3), tail = f2.traj.slice(3);
      const tr = new Float32Array(head.length + tail.length); tr.set(head, 0); tr.set(tail, head.length);
      out.traj = tr; out.n = tr.length / 3; out.drop = catchAt;
      out.land = { x: f2.landed ? f2.landed.x : catchAt.x, z: f2.landed ? f2.landed.z : catchAt.z, t: catchAt.t + (f2.landed ? f2.landed.t : 0.5) };
    }
  }
  if (!out.caught) {
    out.tEnd = out.land.t;
    out.dist = Math.hypot(out.land.x, out.land.z - 0);
    out.dl = Math.floor(out.dist / DANDA);
    const i = out.n - 1; out.rest = [out.traj[i * 3], out.traj[i * 3 + 2]];
  }
  return out;
}
const landed = (fl) => fl.landed;

function startFlight(r, R) {
  const sw = r.sw, fl = r.flip;
  const p = launch(sw.q, sw.dyN ?? 0, sw.dt, sw.az, fl.q);
  let par = p;
  if (sw.kind === 'tip') par = { v: 6 + 9 * (sw.q / 0.3), loft: 52 + R.p.range(0, 18), azDeg: p.azDeg + R.p.range(-22, 22) };
  const pos = sw.pos ?? [0, HS, 0.1];
  r.fly = buildFlight(r, R, [pos[0], Math.max(0.3, pos[1]), pos[2] + 0.1], par, true);
  r.phase = 'fly'; r.ft = 0; r.pt = 0;
  // fielders start running (after their reaction time); the one who judged best goes straight to the catch
  r.fly.paths.forEach((p2, i) => { const f = r.fielders[i]; f.state = 'run'; f.path = { x0: f.x, z0: f.z, tx: p2.tx, tz: p2.tz, t: -p2.t0, speed: p2.speed, len: p2.len }; });
  nextEv(r, { k: 'contact', q: sw.q, kind: sw.kind, v: par.v, loft: par.loft });
}

function finishFlight(r, R) {
  const f = r.fly, sw = r.sw;
  const res = { kind: 'hit', text: '', sub: '', dl: 0, dist: f.dist, perfect: sw.kind === 'perfect' };
  if (sw.kind === 'perfect') r.stats.perfectSwing += 1;
  if (f.caught) {
    r.stats.catches += 1; r.outs += 1;
    res.kind = 'caught'; res.text = 'CAUGHT!'; res.sub = `${r.fielders[f.caught.i].name ?? 'A fielder'} takes it. Out.`;
    nextEv(r, { k: 'catch', i: f.caught.i });
    r.hits.push({ dl: 0, az: r.az, dist: 0, caught: true, x: f.caught.x, z: f.caught.z });
  } else {
    if (f.drop) { r.stats.drops += 1; nextEv(r, { k: 'drop', i: f.drop.i }); }
    res.dl = f.dl; res.text = `${f.dl} dandas`; res.sub = f.drop ? 'Dropped! It rolls free.' : sw.kind === 'tip' ? 'A glancing tip.' : sw.kind === 'perfect' ? 'Sweet strike!' : f.dl >= 38 ? 'Huge hit!' : 'Measured.';
    r.score += f.dl; r.best = Math.max(r.best, f.dl);
    r.hits.push({ dl: f.dl, az: r.az, dist: f.dist, caught: false, x: f.land.x, z: f.land.z });
    nextEv(r, { k: 'land', dl: f.dl, dist: f.dist });
  }
  r.res = res;
  r.phase = 'result'; r.pt = 0;
  // the nearest fielder fetches it
  if (!f.caught) {
    let bi = 0, bd = 1e9; r.fielders.forEach((fd, i) => { const d = Math.hypot(fd.x - f.rest[0], fd.z - f.rest[1]); if (d < bd) { bd = d; bi = i; } });
    const fd = r.fielders[bi]; fd.state = 'fetch'; walkTo(fd, f.rest[0], f.rest[1], 4.2, 0.2);
    for (const o of r.fielders) if (o !== fd) { o.path = null; o.moving = 0; }
  } else for (const o of r.fielders) { o.moving = 0; o.path = null; }
}

function endChance(r, R) {
  const out = r.res && r.res.kind === 'caught';
  if (r.n >= r.chances || (out && r.outEnds)) { r.phase = 'end'; r.pt = 0; r.over = true; nextEv(r, { k: 'end' }); }
  else beginReady(r, R);
}

export function stepRound(r, R, dt) {
  r.clock += dt; r.pt += dt;
  for (const f of r.fielders) stepFielder(f, dt);
  switch (r.phase) {
    case 'ready':
      if (r.pt >= READY_T && !r.hold) { r.phase = 'tap'; r.pt = 0; }
      break;
    case 'flip': {
      r.fp += dt;
      if (!r.sw && r.fp > airTime(r.flip) + 0.02) {
        r.n += 0;
        r.stats.whiffs += 1;
        r.res = { kind: 'drop', text: 'Too slow', sub: 'The peg fell before you swung.', dl: 0 };
        nextEv(r, { k: 'whiff', why: 'late' });
        r.phase = 'result'; r.pt = 0;
      }
      break;
    }
    case 'swing': {
      r.fp += dt;
      if (r.fp >= r.sw.tc) {
        if (r.sw.kind === 'whiff') {
          r.stats.whiffs += 1;
          const early = r.sw.dy > 0;
          r.res = { kind: 'whiff', text: 'Swing and a miss', sub: early ? 'Too early: wait for it to fall into the ring.' : 'Too late: swing sooner.', dl: 0 };
          nextEv(r, { k: 'whiff', why: early ? 'early' : 'late' });
          r.phase = 'result'; r.pt = 0;
        } else startFlight(r, R);
      }
      break;
    }
    case 'fly': {
      r.ft += dt; r.fp += dt;
      if (r.ft >= r.fly.tEnd) finishFlight(r, R);
      break;
    }
    case 'result':
      if (r.pt >= RESULT_T) endChance(r, R);
      break;
    default: break;
  }
}

export function skipResult(r, R) { if (r.phase === 'result' && r.pt > 0.7) endChance(r, R); }

/** Gilli world position for drawing (sim frame) at the current moment, or null when it is on the ground at the hole. */
export function gilliNow(r) {
  switch (r.phase) {
    case 'flip': case 'swing': { if (!r.flip) return null; const g = gilliAt(r.flip, r.fp); return { x: g.x, y: g.y, z: g.z, spin: g.spin, air: true }; }
    case 'fly': {
      const f = r.fly, k = clamp(r.ft * 60, 0, f.n - 1), i = Math.floor(k), a = k - i, j = Math.min(f.n - 1, i + 1);
      return { x: lerp(f.traj[i * 3], f.traj[j * 3], a), y: lerp(f.traj[i * 3 + 1], f.traj[j * 3 + 1], a), z: lerp(f.traj[i * 3 + 2], f.traj[j * 3 + 2], a), spin: r.ft * 14, air: true, fly: true };
    }
    case 'result': {
      const f = r.fly;
      if (f && !f.caught) return { x: f.rest[0], y: 0.02, z: f.rest[1], spin: 0, air: false, rest: true };
      if (f && f.caught) return { x: f.caught.x, y: f.caught.y, z: f.caught.z, spin: 0, air: false, held: f.caught.i };
      return null;
    }
    default: return null;
  }
}

// ---- computer striker and hints -------------------------------------------------------------------------------------------------------
/** How a clean strike toward `azn` would end with the fielders where they are now (no random rolls). */
export function probe(r, azn, q = 0.88) {
  const fake = { ...r, fielders: r.fielders.map((f) => ({ ...f })) };
  const p = launch(q, 0, 0, azn, 0.7);
  const f = buildFlight(fake, { f: { next: () => 0.5, range: () => 0 } }, [0, HS, 0.1], p, false);
  return { az: azn, caught: !!f.caught, dist: f.dist, dl: f.dl, by: f.caught ? f.caught.i : -1 };
}

export const AZ_STEPS = [-1, -0.8, -0.6, -0.4, -0.2, 0, 0.2, 0.4, 0.6, 0.8, 1];
export function scan(r) { return AZ_STEPS.map((a) => probe(r, a)); }

/** The computer's decision for the coming chance: aim, when to press the tap, and how well it will swing. */
export function planChance(r, R, skill, tapSkill = skill) {
  const sc = scan(r);
  const safe = sc.filter((s) => !s.caught).sort((a, b) => b.dl - a.dl);
  const pool = safe.length ? safe : sc.slice().sort((a, b) => b.dist - a.dist);
  const top = pool.slice(0, 3);
  const pick = R.a.next() < skill ? top[0] : top[Math.min(top.length - 1, R.a.int(top.length))];
  const P = LEVELS[r.level].tapP;
  // the pendulum is at its centre every half period starting at P/4; the computer presses at the first such moment after a little think time
  const k = Math.max(0, Math.ceil(((TAP_MIN + 0.1) - P / 4) / (P / 2)));
  const tapEr = (1 - tapSkill) * 0.1 * R.a.range(-1, 1);
  const tapAt = P / 4 + k * (P / 2) + tapEr;
  const swEr = (1 - skill) * 0.15 * R.a.range(-1, 1);
  const reasons = [];
  const near = r.fielders.map((f, i) => ({ i, d: Math.hypot(f.x, f.z), a: Math.atan2(f.x, f.z) / DEG })).sort((a, b) => a.d - b.d)[0];
  reasons.push(`${r.fielders.length} fielders are out there; the closest is ${Math.round(near.d)} m away at ${Math.abs(Math.round(near.a))} degrees ${near.a < 0 ? 'left' : 'right'}.`);
  const caught = sc.filter((s) => s.caught).length;
  reasons.push(caught ? `A clean hit toward ${caught} of the ${sc.length} directions I checked would be caught.` : 'None of the directions I checked would be caught.');
  reasons.push(pick.dl > 0 ? `The best open line is ${describeAz(pick.az)}, worth about ${pick.dl} dandas.` : 'Everything is covered, so I will hit it as far from the fielders as I can.');
  reasons.push('I will press when the danda crosses the gold, then swing as the peg falls into the ring.');
  return { az: pick.az, tapAt, swEr, reasons, expect: pick };
}
export function describeAz(a) { return Math.abs(a) < 0.15 ? 'straight down the middle' : `to the ${a < 0 ? 'left' : 'right'}${Math.abs(a) > 0.75 ? ' (wide)' : ''}`; }
