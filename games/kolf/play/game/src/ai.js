// The computer players and the Think hint. A planner tries many strokes on the real physics (sim.js) and keeps the one that
// leaves the ball best placed. It does a fixed number of simulated strokes per call, so thinking never blocks a frame and the
// same inputs always give the same plan. Skill differs by how many strokes it tries, whether it checks them against a shaky
// swing, how much it fuzzes its choice, and how steady its swing is.
import { simulate, lineClear, clamp, V_MAX, V_MIN, BR } from './sim.js';

export const PROFILES = [
  { name: 'Skater Jan', stars: 1, tag: 'Still finding his feet', maxB: 0, angles: 26, powers: [0.3, 0.5, 0.7, 0.9], refine: 1, robust: false, sigA: 0.12, sigP: 0.26, fuzz: 14, think: [1.2, 2.2] },
  { name: 'Baker Marit', stars: 2, tag: 'Steady and sensible', maxB: 1, angles: 44, powers: [0.25, 0.4, 0.55, 0.7, 0.85, 1], refine: 2, robust: false, sigA: 0.045, sigP: 0.12, fuzz: 4, think: [1.5, 3] },
  { name: 'Skipper Pieter', stars: 4, tag: 'Reads the banks well', maxB: 2, angles: 70, powers: [0.18, 0.3, 0.42, 0.54, 0.66, 0.78, 0.9, 1], refine: 3, robust: true, sigA: 0.016, sigP: 0.05, fuzz: 1, think: [1.8, 3.4] },
  { name: 'Mistress Saskia', stars: 5, tag: 'Rarely misses', maxB: 3, angles: 100, powers: [0.14, 0.22, 0.3, 0.38, 0.47, 0.56, 0.66, 0.76, 0.86, 0.94, 1], refine: 4, robust: true, sigA: 0.008, sigP: 0.03, fuzz: 0, think: [2, 3.6] },
];
// The Think hint: the strongest search with a perfect swing.
export const ADVISOR = { name: 'Think', maxB: 4, angles: 110, powers: [0.14, 0.22, 0.3, 0.38, 0.47, 0.56, 0.66, 0.76, 0.86, 0.94, 1], refine: 4, robust: true, sigA: 0.003, sigP: 0.01, fuzz: 0 };

const CONE = 1.32;   // how far either side of straight ahead a stroke may be aimed (radians)

// How good is the place the ball ended up? Lower is better.
export function costOf(c, start, r, maxB = 9) {
  if (r.mode === 'post') return -1000 + r.bounces * 2 + r.hitSledge * 30;
  const dEnd = Math.hypot(c.post.x - r.x, c.post.y - r.y);
  if (r.mode === 'thin') return Math.hypot(c.post.x - start.x, c.post.y - start.y) + 22;
  let k = dEnd;
  if (r.bounces > maxB) k += (r.bounces - maxB) * 6;
  if (r.snowT > 0.02 && r.mode === 'rest') k += 4;
  if (r.hitSledge) k += 3;
  if (!lineClear(c, r.x, r.y)) k += 7;
  return k;
}

// A fixed amount of work per step() call: `n` simulated strokes.
export function createPlanner(c, ball, t0, prof, rng, opts = {}) {
  const out = { done: false, result: null, sims: 0 };
  const sim = (a, p, t) => { out.sims++; return simulate(c, ball, a, p, t, { maxT: 18 }); };
  const base = Math.atan2(c.post.x - ball.x, c.post.y - ball.y);   // heading straight at the post (0 = +y)
  const phases = c.hasMovers ? 4 : 1;
  const nAng = c.hasMovers ? Math.min(prof.angles, 60) : prof.angles;
  function* run() {
    const coarse = [];
    const angs = [];
    for (let i = 0; i < nAng; i++) angs.push(base - CONE + (2 * CONE * i) / (nAng - 1));
    angs.push(base);
    for (const a of angs) for (const p of prof.powers) for (let k = 0; k < phases; k++) {
      const t = t0 + k * 2.0;
      const r = sim(a, p, t);
      const noise = prof.fuzz ? rng.next() * prof.fuzz : 0;
      coarse.push({ a, p, t, c: costOf(c, ball, r, prof.maxB) + noise });
      yield;
    }
    coarse.sort((x, y) => x.c - y.c);
    const leaders = [];
    for (const k of coarse) {
      if (leaders.length >= prof.refine) break;
      if (leaders.every((l) => Math.abs(l.a - k.a) > 0.04 || Math.abs(l.p - k.p) > 0.12 || Math.abs(l.t - k.t) > 0.01)) leaders.push(k);
    }
    const refined = [];
    for (const L of leaders) {
      let best = L;
      for (const da of [-0.03, -0.018, -0.008, -0.003, 0, 0.003, 0.008, 0.018, 0.03]) for (const dp of [-0.06, -0.03, -0.012, -0.004, 0, 0.004, 0.012, 0.03, 0.06]) {
        const a = L.a + da, p = clamp(L.p + dp, 0.02, 1);
        const r = sim(a, p, L.t);
        const cc = costOf(c, ball, r, prof.maxB);
        if (cc < best.c - 1e-6 || (cc === best.c && da === 0 && dp === 0)) best = { a, p, t: L.t, c: cc };
        yield;
      }
      refined.push(best);
    }
    if (prof.robust) {
      const jit = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, 1], [1, -1]];
      for (const b of refined) {
        let sum = b.c;
        for (const [ja, jp] of jit) {
          const r = sim(b.a + ja * Math.max(prof.sigA, 0.006) * 2.2, clamp(b.p * (1 + jp * Math.max(prof.sigP, 0.02) * 2.2), 0.02, 1), b.t);
          sum += costOf(c, ball, r, prof.maxB); yield;
        }
        b.rc = sum / (jit.length + 1);
      }
      refined.sort((x, y) => x.rc - y.rc);
    } else refined.sort((x, y) => x.c - y.c);
    const best = refined[0] ?? coarse[0];
    const full = simulate(c, ball, best.a, best.p, best.t, { path: true, maxT: 18 });
    out.result = { ang: best.a, pow: best.p, tLaunch: best.t, cost: best.c, hit: full.mode === 'post', end: { x: full.x, y: full.y, mode: full.mode }, path: full.path, info: full, alts: refined.slice(1, 3).map((r) => ({ a: r.a, p: r.p })) };
    out.done = true;
  }
  const gen = run();
  out.step = (n) => { for (let i = 0; i < n && !out.done; i++) { if (gen.next().done) { out.done = true; break; } } return out.done; };
  return out;
}

// A short, true description of a plan for the Think hint and for Watch & Learn.
const powerWord = (p) => (p < 0.22 ? 'a soft tap' : p < 0.42 ? 'a gentle stroke' : p < 0.65 ? 'a medium stroke' : p < 0.85 ? 'a firm stroke' : 'a full swing');
const cap = (s) => s[0].toUpperCase() + s.slice(1);
export function explainPlan(c, ball, plan) {
  const i = plan.info, d = Math.hypot(c.post.x - ball.x, c.post.y - ball.y);
  const bits = [];
  let title;
  const crossesThin = plan.path && plan.path.some((q) => c.thin.some((r) => q[0] >= r.x0 && q[0] <= r.x1 && q[1] >= r.y0 && q[1] <= r.y1));
  const sx = plan.info.x - ball.x;
  if (i.hitSledge) { title = 'Past the sledge'; bits.push('The stroke is timed so the sledge is not in the way, or the ball glances off it.'); }
  else if (crossesThin && plan.hit !== false && i.mode !== 'thin') { title = 'Skim the thin ice'; bits.push('The ball crosses fast enough that thin ice cannot swallow it.'); }
  else if (i.bounces > 0) { title = i.bounces === 1 ? 'Bank shot' : 'Double bank'; bits.push(`The ball ${i.bounces === 1 ? 'strikes a board or an obstacle once' : `bounces ${i.bounces} times`} on the way.`); }
  else if (plan.hit) { title = d < 14 ? 'Clean strike' : 'Straight at the post'; bits.push('A clear line to the post.'); }
  else { title = 'Position stroke'; bits.push('The post is out of reach in one stroke, so this leaves the ball a clear line for the next.'); }
  if (i.snowT > 0.05) bits.push('Snow slows the ball a lot, so the stroke is firmer.');
  const w = c.wind;
  if (Math.abs(w.ax) + Math.abs(w.ay) > 0.15) bits.push(`The wind pushes the ball ${w.ax > 0 ? 'right' : 'left'}, so the aim leans ${w.ax > 0 ? 'left' : 'right'} of the line.`);
  void sx;
  bits.push(`${cap(powerWord(plan.pow))}${plan.hit ? ' should reach the post.' : ' sets up the next stroke.'}`);
  return { title, reason: bits.join(' ') };
}

// Shake a plan like a real swing: heading and power wobble by the player's skill.
export function shaky(plan, prof, g1, g2) {
  return { ang: plan.ang + g1 * prof.sigA, pow: clamp(plan.pow * (1 + g2 * prof.sigP), 0.02, 1) };
}
export { V_MAX, V_MIN, BR };
