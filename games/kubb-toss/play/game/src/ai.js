// The computer players and the Think hint. Both use the real physics: candidate throws are run through the same rigid-body world a person's
// throw goes through, first once without error (to find promising throws) and then several times WITH the thrower's own error (to check that
// the throw is good even when the hand is not perfect). The five levels differ in how steady the hand is and in how carefully they choose.
import { FIELD } from './phys.js';
import { targets, throwLine, dirOf, baselineY, teamHalf, KING_RING, KING_ID, kingPos } from './engine.js';
const clampY = (y, team) => (team === 0 ? Math.min(y, FIELD.L - 0.5) : Math.max(y, 0.5));
import { runThrow, worldFromMatch, errFor, launchFor, maskOf } from './sim.js';
import { LOFTS, SPINS, KING, BATON, pathOf } from './phys.js';

// A throw whose flight crosses the king's space low down (the king may only fall last) is one nobody should choose: used by the computer players and the aim warning.
export const KING_LOW = { r: 0.5 + BATON.len / 2, z: KING.h + BATON.len / 2 };
export const overKing = (L, kp) => pathOf(L, 40).some((q) => Math.hypot(q.x - kp.x, q.y - kp.y) < KING_LOW.r && q.z < KING_LOW.z);

export const PROFILES = [
  { name: 'Lina', tag: 'Just learning', stars: 1, noise: 2.4, scan: 2, verify: 0, samples: 0, rand: 0.6, think: [0.6, 1.0] },
  { name: 'Erik', tag: 'Friendly', stars: 2, noise: 1.8, scan: 6, verify: 1, samples: 0, rand: 0.3, think: [0.7, 1.2] },
  { name: 'Maja', tag: 'Steady', stars: 3, noise: 1.4, scan: 24, verify: 3, samples: 3, rand: 0.12, think: [0.8, 1.4] },
  { name: 'Anders', tag: 'Sharp', stars: 4, noise: 1.1, scan: 60, verify: 4, samples: 6, rand: 0.03, think: [0.9, 1.5] },
  { name: 'Ingrid', tag: 'Champion', stars: 5, noise: 0.85, scan: 999, verify: 5, samples: 9, rand: 0, think: [1.0, 1.6] },
];
export const ASSIST = [{ name: 'Easy', noise: 0.6 }, { name: 'Normal', noise: 1 }, { name: 'Hard', noise: 1.5 }];
export const toNoise = (prof) => prof.noise;
export const TOSS_NOISE = { across: 0.1, along: 0.15 };

export function lcg(seed) { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }

const SIDES = ['far left', 'left', 'middle', 'right', 'far right'];
export function nameOf(m, id) {
  const b = m.blocks[id];
  if (b.kind === 'king') return 'the king';
  const sameRole = m.blocks.filter((o) => o.team === b.team && o.role === b.role && !o.down).sort((p, q) => p.x - q.x);
  const i = sameRole.indexOf(b), n = sameRole.length;
  const word = n === 1 ? '' : n === 2 ? (i === 0 ? 'left ' : 'right ') : n === 3 ? ['left ', 'middle ', 'right '][i] : n === 5 ? `${SIDES[i]} ` : i === 0 ? 'leftmost ' : i === n - 1 ? 'rightmost ' : `${i + 1}th from the left `;
  const what = b.role === 'field' ? 'field kubb' : 'baseline kubb';
  return `the ${word}${what}`.replace('  ', ' ');
}

// How good a resulting position is for the team on turn.
export function scoreFinals(m, mask, finals) {
  let v = 0;
  const t = m.turn;
  for (const f of finals) {
    const b = m.blocks[f.id];
    if (!f.down || b.down || b.role === 'cleared') continue;
    if (b.kind === 'king') { v += mask.king ? 40 : -60; continue; }
    if (b.role === 'field') v += b.team === t ? 1.3 : -0.4;
    else if (b.role === 'base') v += b.team === 1 - t ? (mask.base ? 1 : -0.2) : -0.3;
  }
  return v;
}

function candidatesFor(m, rn, prof) {
  const T = targets(m), line = throwLine(m, T.king), dir = dirOf(m.turn), out = [];
  for (const id of T.ids) {
    const b = m.blocks[id];
    const sx = Math.max(-1.45, Math.min(1.45, b.x * 0.75));
    const len = Math.abs(b.y - line.y);
    for (let loft = 0; loft < 3; loft++) for (let spin = 0; spin < 3; spin++) for (const short of [0, 0.22]) {
      if (len < 1.0 && short) continue;
      out.push({ id, plan: { sx, ax: b.x, ay: b.y - dir * short, loft, spin }, line });
    }
  }
  void rn; void prof;
  if (T.king) return out;
  const kp = kingPos(m);
  // when the king stands in the corridor of the throw, only a lob is safe even with a short or long throw
  const inLine = (c) => Math.abs(kp.x - (c.plan.sx + c.plan.ax) / 2) < 1.0 && (kp.y - c.line.y) * dir > 0 && (c.plan.ay - kp.y) * dir > -1.0;
  const safe = out.filter((c) => !overKing(launchFor(c.plan, c.line.y, dir, {}), kp) && !(inLine(c) && c.plan.loft < 2));
  return safe.length ? safe : out;
}

// A job that finds the best throw. step(n) runs up to n simulated throws and returns true when done; the result is in job.result.
export function batonJob(m, prof, o = {}) {
  const world = worldFromMatch(m), mask = maskOf(m), dir = dirOf(m.turn), T = targets(m);
  const rn = o.rn ?? lcg(1234 + m.turnNo * 31 + m.baton);
  let cands = candidatesFor(m, rn, prof);
  const sampleRn = lcg(777 + m.turnNo * 17 + m.baton * 5 + (o.salt ?? 0));
  // limit the scan for the weaker levels: a random subset of targets, a random subset of settings
  if (prof.scan < cands.length) {
    const shuf = cands.slice(); for (let i = shuf.length - 1; i > 0; i--) { const j = Math.floor(rn() * (i + 1)); [shuf[i], shuf[j]] = [shuf[j], shuf[i]]; }
    cands = shuf.slice(0, Math.max(1, prof.scan));
  }
  const job = {
    phase: 'scan', i: 0, scored: [], top: [], vi: 0, vs: 0, acc: [], progress: 0, result: null, total: cands.length,
    step(n) {
      let left = n;
      while (left > 0 && !job.result) {
        if (job.phase === 'scan') {
          if (job.i >= cands.length) {
            // the shots worth testing with a shaky hand: the best of each (target, loft) pair first, so a flat throw and a lob are both tried
            job.scored.forEach((c) => { c.j = rn() * 0.02; });
            job.scored.sort((a, b) => b.v0 + b.j - (a.v0 + a.j));
            const seen = new Set(), picked = [];
            for (const c of job.scored) { const k = `${c.id}:${c.plan.loft}`; if (!seen.has(k)) { seen.add(k); picked.push(c); } }
            job.top = picked.slice(0, Math.max(1, prof.verify));
            job.phase = prof.samples > 0 ? 'verify' : 'done';
            job.vi = 0; job.vs = 0; job.acc = [];
            continue;
          }
          const c = cands[job.i++];
          const L = launchFor(c.plan, c.line.y, dir, {});
          const r = runThrow(world, L, 100, { early: true });
          job.scored.push({ ...c, v0: scoreFinals(m, mask, r.finals), L });
          left--; job.progress = (job.i / cands.length) * 0.5;
        } else if (job.phase === 'verify') {
          if (job.vi >= job.top.length) { job.phase = 'done'; continue; }
          const c = job.top[job.vi];
          const err = errFor(c.plan.loft, prof.noise, sampleRn);
          const L = launchFor(c.plan, c.line.y, dir, err);
          const r = runThrow(world, L, 100, { early: true });
          const v = scoreFinals(m, mask, r.finals);
          c.sv = (c.sv ?? 0) + v; c.sn = (c.sn ?? 0) + 1; if (v > 0) c.hit = (c.hit ?? 0) + 1; if (v < -5) c.bad = (c.bad ?? 0) + 1;
          if (++job.vs >= prof.samples) { job.vs = 0; job.vi++; }
          left--; job.progress = 0.5 + 0.5 * ((job.vi + job.vs / prof.samples) / job.top.length);
        } else {
          job.finish(); break;
        }
      }
      return !!job.result;
    },
    finish() {
      // Nobody throws a baton they can see will topple the king too early: when a safe shot exists, a careless random choice is made among the safe ones.
      const safe = job.scored.filter((c) => c.v0 > -5);
      if (safe.length && !T.king) { job.scored = safe; job.top = job.top.filter((c) => c.v0 > -5); if (!job.top.length) job.top = safe.slice(0, 1); }
      let pool = job.phase === 'done' && prof.samples > 0 ? job.top : job.scored;
      let pick;
      if (prof.samples > 0) pick = pool.slice().sort((a, b) => (b.sv / b.sn) - (a.sv / a.sn))[0];
      else pick = pool.slice().sort((a, b) => b.v0 - a.v0)[0];
      if (!pick) pick = job.scored[0];
      if (prof.rand > 0 && rn() < prof.rand && job.scored.length) pick = job.scored[Math.floor(rn() * job.scored.length)];
      const n = pick.sn ?? 0;
      job.result = { plan: pick.plan, id: pick.id, line: pick.line, v0: pick.v0, samples: n, hits: pick.hit ?? 0, mean: n ? pick.sv / n : pick.v0, bad: pick.bad ?? 0, kind: T.kind };
      job.progress = 1;
    },
  };
  return job;
}

export function describeShot(m, r, noiseName) {
  const p = r.plan, T = targets(m);
  const target = nameOf(m, r.id);
  const where = r.line.adv ? 'from the advantage line' : r.line.y === baselineY(m.turn) ? 'from your baseline' : 'from the line';
  const goal = T.kind === 'field' ? 'cleared a field kubb' : T.kind === 'base' ? 'knocked down a baseline kubb' : 'toppled the king';
  const tail = r.samples ? ` Of ${r.samples} test throws with ${noiseName} aim, ${r.hits} ${goal}${r.bad ? ` and ${r.bad} knocked the king over too soon` : ''}.` : '';
  const why = T.kind === 'field' ? 'Field kubbs come first.' : T.kind === 'base' ? 'The field is clear, so aim at the baseline.' : 'Every kubb is down, so the king is next.';
  return `${why} Throw at ${target} ${where}, ${LOFTS[p.loft].name.toLowerCase()} loft and ${SPINS[p.spin].name.toLowerCase()} spin.${tail}`;
}

// ---- kubb throw-in and placement -----------------------------------------------------------------------------------------------
// Landing spots a careful team aims for: just beyond the king's ring, out of the king's lane (a baton thrown at a kubb right behind the king can hit the
// king by mistake), spread out so one baton cannot take two.
const LANES = [-0.8, 0.8, -1.25, 1.25, -0.5, 0.5];
export function tossSpots(m, team, n) {
  const dir = dirOf(team), out = [], kp = kingPos(m);
  for (let k = 0; k < n; k++) {
    const x = LANES[k % LANES.length] + kp.x * 0.5;
    const y = clampY(kp.y + dir * (0.85 + 0.3 * (k % 2)), team);
    out.push({ x: Math.max(-1.45, Math.min(1.45, x)), y });
  }
  return out;
}
export function tossError(noise, dist, rnd) {
  const g = (r) => { let u = 0; while (u < 1e-9) u = r(); const v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  const k = 0.6 + 0.4 * (dist / FIELD.L);
  return { dx: g(rnd) * TOSS_NOISE.across * noise * k, dy: g(rnd) * TOSS_NOISE.along * noise * k };
}
// The place the opponent chooses for a kubb that landed wrong twice: hard to reach, far from the thrower, never inside the king ring.
export function placeSpot(m, team, k = 0) {
  const dir = dirOf(team), base = baselineY(1 - team);
  const x = (k % 2 === 0 ? -1 : 1) * (1.05 - 0.2 * Math.floor(k / 2));
  const y = base - dir * 0.9;
  return { x, y };
}
// A tested place to aim a kubb throw-in for the team on turn: the throw is repeated twelve times with the thrower's own error and the spot with
// the most landings in play wins (ties go to the spot nearest the thrower's baseline: easier to knock down again).
import { tossCheck } from './engine.js';
export function tossAdvice(m, team, noise, rnd) {
  const dir = dirOf(team), n = 12, best = { p: -1 };
  const errs = []; for (let i = 0; i < n; i++) errs.push([rnd(), rnd()]);
  const base = baselineY(team);
  for (const dy of [0.8, 1.0, 1.25, 1.55]) for (const x of [-1.0, -0.8, 0.8, 1.0, -0.5, 0.5]) {
    const kp = kingPos(m), y = clampY(kp.y + dir * dy, team);
    if (Math.hypot(x - kp.x, y - kp.y) < KING_RING + 0.1) continue;
    let ok = 0;
    // deterministic samples: reuse a gaussian from two uniforms per sample
    for (const [a, b] of errs) {
      const g1 = Math.sqrt(-2 * Math.log(Math.max(1e-9, a))) * Math.cos(2 * Math.PI * b), g2 = Math.sqrt(-2 * Math.log(Math.max(1e-9, a))) * Math.sin(2 * Math.PI * b);
      const k = 0.6 + 0.4 * (Math.abs(y - base) / FIELD.L);
      if (tossCheck(m, team, x + g1 * TOSS_NOISE.across * noise * k, y + g2 * TOSS_NOISE.along * noise * k).ok) ok++;
    }
    const sc = ok * 10 - dy;
    if (sc > best.p) Object.assign(best, { p: sc, ok, x, y });
  }
  const text = `Aim the ring ${best.x === 0 ? 'in the middle' : best.x < 0 ? 'on the left' : 'on the right'} of the other half, just past the king's circle. In ${n} test throws with your aim steadiness ${best.ok} landed in play.`;
  return { x: best.x, y: best.y, ok: best.ok, n, text };
}
export { KING_RING, KING_ID, teamHalf };
