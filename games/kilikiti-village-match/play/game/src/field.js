// Fielding: the nine fielders' starting places and the interception analysis of a ball track. Everything is computed from the real ball
// track (no teleporting) with per-fielder speed and reaction. Pure and deterministic.
import { PITCH, FIELD, clamp, fenceRatio } from './core.js';
import { trackPos, trackSpeed, throwTime } from './ball.js';

// The fielding side: bowler, a keeper behind each wicket, three inner fielders and three deep fielders.
export const SLOTS = [
  { id: 0, role: 'bowler', name: 'Bowler', x: 0.25, z: PITCH + 4.6 },
  { id: 1, role: 'wk', end: 0, name: 'Keeper (batter\'s end)', x: 0.5, z: -3.2 },
  { id: 2, role: 'wk', end: 1, name: 'Keeper (bowler\'s end)', x: -0.6, z: PITCH + 3.4 },
  { id: 3, role: 'field', ring: 'inner', name: 'Point', x: 5.8, z: 1.6 },
  { id: 4, role: 'field', ring: 'inner', name: 'Cover', x: 4.2, z: 11.0 },
  { id: 5, role: 'field', ring: 'inner', name: 'Midwicket', x: -5.0, z: 9.5 },
  { id: 6, role: 'field', ring: 'deep', name: 'Long-off', x: 2.0, z: 24.0 },
  { id: 7, role: 'field', ring: 'deep', name: 'Deep square', x: -6.2, z: 13.5 },
  { id: 8, role: 'field', ring: 'deep', name: 'Third man', x: 4.2, z: -6.0 },
];
export const CONTROL_SLOT = { inner: 4, deep: 7 };

// Fielder reach radius around the body (horizontal), and the catching height band.
export const REACH = { catchR: 0.8, diveR: 1.15, pickR: 0.7, catchLo: 0.35, catchHi: 2.05 };

export function makeFielders(level, names) {
  return SLOTS.map((s) => ({
    id: s.id, role: s.role, ring: s.ring ?? null, end: s.end ?? null, name: names?.[s.id] ?? s.name, slot: s.name,
    x: s.x, z: s.z, x0: s.x, z0: s.z, vx: 0, vz: 0, fx: 0, fz: 1,
    spd: level.spd * (s.role === 'wk' ? 0.8 : s.role === 'bowler' ? 0.88 : 1), react: level.react, level, ctl: false, st: 'ready', act: null, tx: null, tz: null,
  }));
}

// Is the ball (x,y,z at a track index) catchable on the full (no bounce yet, in the height band)?
export const airborne = (y) => y >= REACH.catchLo && y <= REACH.catchHi;

// Earliest point on the track where somebody can be waiting for the ball.
// fielders: [{ id, x, z, spd, react (seconds left before it starts moving), ctl }]; fromIdx = current ball index; elapsed already accounted for in react.
// opts.skip(f) -> true to leave a fielder out. Returns null when nobody gets there before the ball stops, crosses the rope or leaves.
export function intercept(track, fielders, fromIdx = 0, opts = {}) {
  const bIdx = track.boundary ? track.boundary.idx : Infinity;
  const end = Math.min(track.n - 1, bIdx);
  const bset = new Set(track.bounces);
  let bounce = 0;
  for (let k = 0; k < fromIdx; k++) if (bset.has(k)) bounce++;
  for (let i = fromIdx; i <= end; i++) {
    if (bset.has(i)) bounce++;
    const [bx, by, bz] = trackPos(track, i);
    const t = (i - fromIdx) / 60;
    let best = null, bs = -1e9;
    for (const f of fielders) {
      if (opts.skip && opts.skip(f)) continue;
      if (f.role === 'wk' && !opts.keepers) continue;
      const d = Math.hypot(f.x - bx, f.z - bz);
      const reach = by > 0.9 ? REACH.catchR : REACH.pickR;
      const need = (f.react ?? 0) + Math.max(0, d - reach) / f.spd;
      const slack = t - need;
      if (slack >= -0.02 && slack > bs) { bs = slack; best = { f, need, d }; }
    }
    if (!best) continue;
    const air = airborne(by) && bounce === 0;
    return { idx: i, f: best.f, fid: best.f.id, pos: [bx, by, bz], t, slack: bs, kind: air ? 'catch' : by <= 1.0 ? 'pick' : 'high', bounce, speed: trackSpeed(track, i), d: best.d };
  }
  // nobody got there: somebody collects it where it stops (or where it leaves the rope: dead ball)
  if (track.boundary) return { idx: bIdx, f: null, fid: -1, pos: trackPos(track, bIdx), t: (bIdx - fromIdx) / 60, kind: 'boundary', runs: track.boundary.kind, slack: 0 };
  const si = track.stopIdx >= 0 ? track.stopIdx : track.n - 1;
  const [sx, , sz] = trackPos(track, si);
  let bf = null, bt = 1e9;
  for (const f of fielders) {
    if (opts.skip && opts.skip(f)) continue;
    if (f.role === 'wk' && !opts.keepers) continue;
    const tt = (f.react ?? 0) + Math.hypot(f.x - sx, f.z - sz) / f.spd;
    if (tt < bt) { bt = tt; bf = f; }
  }
  const idx = Math.max(si, fromIdx + Math.round(bt * 60));
  return { idx, f: bf, fid: bf ? bf.id : -1, pos: [sx, 0, sz], t: (idx - fromIdx) / 60, kind: 'pick', slack: 0, late: true, bounce };
}

// Probability that a fielder holds a catch of the given speed / height. level = the fielder's level.
export function catchChance(level, speed, y, runDist) {
  let p = level.hold - 0.011 * Math.max(0, speed - 12);
  if (y < 0.5) p -= 0.1;
  if (y > 1.9) p -= 0.08;
  if (runDist > 8) p -= 0.08;
  return clamp(p, 0.08, 0.98);
}

// Accuracy of a throw at the stumps from (fx, fz) to the stump at the given end (0 = batter's end, 1 = bowler's end).
export function throwAccuracy(level, fx, fz, end) {
  const ez = end === 0 ? 0 : PITCH;
  const d = Math.hypot(fx, fz - ez);
  return clamp(level.tacc - 0.011 * Math.max(0, d - 6), 0.08, 0.96);
}

// Estimated safe runs given when and where the ball is first held (analysis only: Think, AI batters, Auto Play).
// runTime = seconds one run takes; lead = seconds before the batters could start; margin = safety slack the batters want.
export function safeRuns(holdT, hx, hz, runTime, margin, lead = 0.1, holdDelay = 0.3) {
  let best = 0;
  for (let r = 1; r <= 4; r++) {
    const end = r % 2 === 1 ? PITCH : 0;
    const finish = lead + r * runTime + (r - 1) * 0.15;
    const arrive = holdT + holdDelay + throwTime(hx, hz, 0, end) - 0.3;
    if (finish + margin <= arrive) best = r; else break;
  }
  return best;
}

// Deterministic evaluation of a struck ball against a static field (AI batters, Think, Auto Play). Returns { runs, boundary, caught, plan, track }.
export function evalShot(track, fielders, runTime, margin = 0.2, opts = {}) {
  const plan = intercept(track, fielders, 0, { keepers: false, ...opts });
  if (plan.kind === 'boundary') return { runs: 0, boundary: plan.runs, caught: 0, plan, track };
  if (plan.kind === 'catch') return { runs: 0, boundary: 0, caught: catchChance(plan.f.level, plan.speed, plan.pos[1], 0) * (plan.f.skillMul ?? 1), plan, track };
  const holdT = plan.t;
  const runs = safeRuns(holdT, plan.pos[0], plan.pos[2], runTime, margin);
  return { runs, boundary: 0, caught: 0, plan, track };
}

export const ropeRatio = fenceRatio;
export const FIELD_BOUNDS = FIELD;
