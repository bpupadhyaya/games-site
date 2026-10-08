// The computer golfers and the Think hint. A planner tries many putts on the real physics (sim.js) and keeps the one that
// leaves the ball best placed. It works through a fixed number of putts per call, so thinking never blocks a frame and the
// same inputs always give the same plan. Skill differs by how many shots it tries, how well it checks them, how much it
// fuzzes its choice, and how shaky its putting stroke is.
import { simulate, distField, V_MAX, clamp, inZone, BR } from './sim.js';

export const PROFILES = [
  { name: 'Rookie', stars: 1, tag: 'Still learning the ropes', maxB: 0, angles: 30, powers: [0.3, 0.5, 0.7, 0.9], refine: 1, robust: false, sigA: 0.15, sigP: 0.24, fuzz: 6, think: [1.2, 2.2] },
  { name: 'Clubhouse', stars: 2, tag: 'Steady and sensible', maxB: 1, angles: 60, powers: [0.22, 0.34, 0.48, 0.62, 0.78, 0.95], refine: 2, robust: false, sigA: 0.085, sigP: 0.15, fuzz: 1.6, think: [1.5, 3] },
  { name: 'Club Pro', stars: 4, tag: 'Reads the angles well', maxB: 1, angles: 96, powers: [0.16, 0.26, 0.36, 0.48, 0.6, 0.72, 0.86, 1], refine: 3, robust: true, sigA: 0.045, sigP: 0.09, fuzz: 0.3, think: [1.8, 3.4] },
  { name: 'Champion', stars: 5, tag: 'Rarely misses', maxB: 2, angles: 144, powers: [0.12, 0.2, 0.28, 0.36, 0.46, 0.56, 0.68, 0.8, 0.92, 1], refine: 4, robust: true, sigA: 0.025, sigP: 0.055, fuzz: 0, think: [2, 3.6] },
];
// Used by the Think hint: the strongest search with no putting error.
export const ADVISOR = { name: 'Think', maxB: 4, angles: 144, powers: [0.12, 0.2, 0.28, 0.36, 0.46, 0.56, 0.68, 0.8, 0.92, 1], refine: 4, robust: true, sigA: 0.006, sigP: 0.015, fuzz: 0 };

const TAU = Math.PI * 2;
const normAng = (a) => { while (a > Math.PI) a -= TAU; while (a < -Math.PI) a += TAU; return a; };

// How good is the place the ball ended up? Lower is better.
function costOf(h, fld, start, res, maxB = 9) {
  const excess = Math.max(0, res.bounces + res.bump - maxB);
  if (res.mode === 'sunk' && !excess) return -1000 + res.speed;
  if (excess) return fld.at(res.x, res.y) + 2 + excess * 3;
  if (res.mode === 'water') return fld.at(start.x, start.y) + 14;
  let c = fld.at(res.x, res.y);
  if (res.sand) c += 0.6;
  return c;
}

// A fixed amount of work per step() call: `n` simulated putts.
export function createPlanner(h, ball, t0, prof, rng, opts = {}) {
  const fld = distField(h);
  const cupAng = Math.atan2(h.cup.y - ball.y, h.cup.x - ball.x);
  const phases = h.hasMovers ? 4 : 1;
  const nAng = h.hasMovers ? Math.min(prof.angles, 84) : prof.angles;
  const out = { done: false, result: null, sims: 0 };
  const sim = (ang, pow, t, extra = {}) => { out.sims++; return simulate(h, ball, ang, pow, t, { maxT: 12, ...extra }); };
  function* run() {
    const coarse = [];
    for (let i = 0; i < nAng; i++) {
      const a = normAng(cupAng + (i / nAng) * TAU);
      for (const p of prof.powers) for (let k = 0; k < phases; k++) {
        const t = t0 + (k * h.cycle) / phases;
        const r = sim(a, p, t);
        const noise = prof.fuzz ? rng.next() * prof.fuzz : 0;
        coarse.push({ a, p, t, c: costOf(h, fld, ball, r, prof.maxB) + noise, r });
        yield;
      }
    }
    coarse.sort((x, y) => x.c - y.c);
    // keep distinct leaders
    const leaders = [];
    for (const c of coarse) {
      if (leaders.length >= prof.refine) break;
      if (leaders.every((l) => Math.abs(normAng(l.a - c.a)) > 0.06 || Math.abs(l.p - c.p) > 0.2 || Math.abs(l.t - c.t) > 0.01)) leaders.push(c);
    }
    const refined = [];
    for (const L of leaders) {
      let best = L;
      for (const da of [-0.05, -0.03, -0.015, -0.006, 0, 0.006, 0.015, 0.03, 0.05]) for (const dp of [-0.08, -0.04, -0.015, 0, 0.015, 0.04, 0.08]) {
        const a = L.a + da, p = clamp(L.p + dp, 0.05, 1);
        const r = sim(a, p, L.t);
        const c = costOf(h, fld, ball, r, prof.maxB);
        if (c < best.c - 1e-6 || (c === best.c && da === 0 && dp === 0)) best = { a, p, t: L.t, c, r };
        yield;
      }
      refined.push(best);
    }
    if (prof.robust) {
      // judge each leader by how it fares under a shaky stroke
      const jit = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, 1], [1, -1]];
      for (const b of refined) {
        let sum = b.c;
        for (const [ja, jp] of jit) {
          const r = sim(b.a + ja * Math.max(prof.sigA, 0.012) * 2.2, clamp(b.p * (1 + jp * Math.max(prof.sigP, 0.03) * 2.2), 0.05, 1), b.t);
          sum += costOf(h, fld, ball, r, prof.maxB); yield;
        }
        b.rc = sum / (jit.length + 1);
      }
      refined.sort((x, y) => x.rc - y.rc);
    } else refined.sort((x, y) => x.c - y.c);
    const best = refined[0] ?? coarse[0];
    const full = simulate(h, ball, best.a, best.p, best.t, { path: true, maxT: 12 });
    const alts = [];
    for (const r of refined.slice(1, 3)) alts.push({ a: r.a, p: r.p, c: r.c });
    out.result = { ang: best.a, pow: best.p, tLaunch: best.t, cost: best.c, sink: full.mode === 'sunk', end: { x: full.x, y: full.y, mode: full.mode }, path: full.path, info: full, alts };
    out.done = true;
  }
  const gen = run();
  out.step = (n) => { for (let i = 0; i < n && !out.done; i++) { if (gen.next().done) { out.done = true; break; } } return out.done; };
  return out;
}

// Turn a plan into a short, true description for the Think hint and for Watch & Learn.
const powerWord = (p) => (p < 0.22 ? 'a soft tap' : p < 0.42 ? 'a gentle putt' : p < 0.65 ? 'a medium putt' : p < 0.85 ? 'a firm putt' : 'a hard putt');
export function explainPlan(h, ball, plan) {
  const i = plan.info, c = h.cup;
  const d = Math.hypot(c.x - ball.x, c.y - ball.y);
  const bits = [];
  let title;
  if (i.tunnel) { title = 'Through the tunnel'; bits.push('The wall cannot be crossed, so the ball goes in one pipe and comes out of the other.'); }
  else if (h.hasMovers && i.mode === 'sunk') { title = 'Time the windmill'; bits.push('The putt is timed so the ball slips past the moving blades.'); }
  else if (h.water.length && h.bridges.length && pathOnBridge(h, plan.path)) { title = 'Over the bridge'; bits.push('Stay on the planks: water costs a stroke.'); }
  else if (i.bump > 0) { title = 'Off the bumper'; bits.push(`The ball bounces off ${i.bump === 1 ? 'a bumper' : 'the bumpers'} and carries on.`); }
  else if (i.slope && i.bounces === 0) { title = 'Ride the slope'; bits.push('The slope bends the path, so the aim is not straight at the cup.'); }
  else if (i.bounces > 0) { title = i.bounces === 1 ? 'Bank shot' : 'Double bank'; bits.push(`The ball hits the rail ${i.bounces === 1 ? 'once' : i.bounces + ' times'} before it settles.`); }
  else { title = d < 5 ? 'Tap in' : 'Straight putt'; bits.push('A clean line to the cup.'); }
  if (i.boost) bits.push('The boost pad adds speed, so the putt is softer than it looks.');
  if (i.sand) bits.push('Sand slows the ball a lot, so it is played firmer.');
  if (plan.sink) bits.push(`${powerWord(plan.pow)[0].toUpperCase()}${powerWord(plan.pow).slice(1)} should drop it.`);
  else bits.push(`${powerWord(plan.pow)[0].toUpperCase()}${powerWord(plan.pow).slice(1)} to leave an easy next putt${i.mode === 'water' ? ' (careful: this line risks the water)' : ''}.`);
  return { title, reason: bits.join(' ') };
}
function pathOnBridge(h, path) {
  if (!path) return false;
  for (let k = 0; k < path.length; k += 2) for (const z of h.bridges) if (inZone(z, path[k][0], path[k][1])) return true;
  return false;
}

// Shake a plan like a real stroke: the angle and the power each wobble by the golfer's skill.
export function shaky(plan, prof, g1, g2) {
  return { ang: plan.ang + g1 * prof.sigA, pow: clamp(plan.pow * (1 + g2 * prof.sigP), 0.04, 1) };
}
export { BR, V_MAX };
