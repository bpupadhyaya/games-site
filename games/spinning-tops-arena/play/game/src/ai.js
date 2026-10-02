// The rivals. A rival picks its top (a signature build, or at the top level the best of a few against yours), then
// chooses a launch by flying copies of the real physics: it tries a grid of angles and powers against a few
// plausible launches from you, scores what happens (does your top get knocked out or tire first, how much spin does
// it have left) and picks among the best. Then comes the human part: the hand is not exact. Every rival has an angle
// wobble, a power wobble and a spin-up timing that varies, and the weaker ones also sometimes misjudge the plan.
// The levels differ in how many options they weigh, how steady the hand is and how well they time the cord.
import { K, ARENA_IDS, newWorld, cloneWorld, stepWorld, runRound, launchSpot, ARENA, derive, clamp } from './sim.js';

export const PROFILES = [
  { id: 'lupe', name: 'Lupe', tag: 'Gentle and hopeful', stars: 1, angSd: 0.2, powSd: 0.17, qMu: 0.8, qSd: 0.1, cands: 9, opps: 1, miss: 0.18, temp: 0.5 },
  { id: 'haruto', name: 'Haruto', tag: 'Careful and steady', stars: 2, angSd: 0.13, powSd: 0.11, qMu: 0.86, qSd: 0.08, cands: 14, opps: 2, miss: 0.1, temp: 0.3 },
  { id: 'siti', name: 'Siti', tag: 'Firm and accurate', stars: 3, angSd: 0.09, powSd: 0.08, qMu: 0.9, qSd: 0.06, cands: 20, opps: 3, miss: 0.05, temp: 0.2 },
  { id: 'dimas', name: 'Dimas', tag: 'Sharp: rarely misses', stars: 4, angSd: 0.055, powSd: 0.05, qMu: 0.94, qSd: 0.04, cands: 28, opps: 4, miss: 0.02, temp: 0.12 },
  { id: 'master', name: 'Master of the Dish', tag: 'Reads your top', stars: 5, angSd: 0.025, powSd: 0.025, qMu: 0.975, qSd: 0.02, cands: 36, opps: 4, miss: 0, temp: 0.05 },
];
export const COACH = { id: 'coach', name: 'Coach', cands: 60, opps: 4, temp: 0, angSd: 0, powSd: 0, qMu: 1, qSd: 0, miss: 0 };

// The tops the first four rivals bring in each dish. Chosen by simulation (greedy, level by level, 30-40 rounds a step, each
// rival flying its own planner and hand) so that every level beats the one below it with that dish's tops; the Master
// picks its top after simulating against yours.
export const LADDER = {
  shallow: [
    { body: 'pear', tip: 'pebble', ballast: 'std', hand: 1 },
    { body: 'pear', tip: 'pebble', ballast: 'heavy', hand: -1 },
    { body: 'pear', tip: 'steel', ballast: 'heavy', hand: 1 },
    { body: 'pear', tip: 'steel', ballast: 'heavy', hand: -1 },
  ],
  bowl: [
    { body: 'pear', tip: 'steel', ballast: 'light', hand: 1 },
    { body: 'pear', tip: 'steel', ballast: 'std', hand: -1 },
    { body: 'pear', tip: 'steel', ballast: 'heavy', hand: 1 },
    { body: 'pear', tip: 'pebble', ballast: 'heavy', hand: -1 },
  ],
  plate: [
    { body: 'pear', tip: 'steel', ballast: 'heavy', hand: 1 },
    { body: 'disc', tip: 'steel', ballast: 'light', hand: -1 },
    { body: 'dome', tip: 'steel', ballast: 'std', hand: 1 },
    { body: 'disc', tip: 'steel', ballast: 'std', hand: -1 },
  ],
};

export function signatureBuild(idx, arena) { return { ...LADDER[arena][idx] }; }

const POWERS = [0.4, 0.55, 0.7, 0.82, 0.92, 1];
const bearing = (side) => (side === 0 ? -Math.PI / 2 : Math.PI / 2);

// the candidate launches: angles either side of the line to the other top, at several powers
export function candidateLaunches(side, count) {
  const base = bearing(side);
  const pw = count >= 24 ? POWERS : count >= 12 ? [0.55, 0.7, 0.82, 0.92] : [0.6, 0.85];
  const nA = Math.max(3, Math.ceil(count / pw.length) | 1);
  const list = [];
  for (let i = 0; i < nA; i++) {
    const off = ((i / (nA - 1)) * 2 - 1) * 0.75;
    for (const p of pw) list.push({ ang: base + off, pow: p });
  }
  return list;
}

// what the other top might do: straight at you, in the middle, off to either side
export function oppModels(side, n) {
  const base = bearing(1 - side);
  const all = [{ ang: base, pow: 0.82, q: 0.95 }, { ang: base + 0.28, pow: 0.7, q: 0.92 }, { ang: base - 0.28, pow: 0.7, q: 0.92 }, { ang: base, pow: 0.55, q: 0.9 }];
  return all.slice(0, Math.max(1, n));
}

// fly one candidate against one model of the other top; returns what happened from `side`'s point of view
export function tryLaunch(arena, side, myB, enB, mine, theirs, maxT = 36) {
  const builds = side === 0 ? [myB, enB] : [enB, myB];
  const ls = side === 0 ? [{ ...mine, q: mine.q ?? 0.97 }, theirs] : [theirs, { ...mine, q: mine.q ?? 0.97 }];
  const w = newWorld(arena, builds, ls);
  runRound(w, maxT);
  const me = w.tops[side], en = w.tops[1 - side];
  const dm = derive(me.build), de = derive(en.build);
  const won = w.over ? (w.over.winner === side ? 1 : -1) : 0;
  const myRest = me.st === 0 ? (me.w * dm.I) / dm.L0 : 0, enRest = en.st === 0 ? (en.w * de.I) / de.L0 : 0;
  return { won, why: w.over?.why ?? 'time', t: w.t, hits: w.hits, myRest, enRest, enOut: en.why === 'out', myOut: me.why === 'out' };
}
const valueOf = (r) => r.won * (1 + 0.5 * (r.won > 0 ? 1 - Math.min(1, r.t / 30) : 0)) + 0.4 * (r.myRest - r.enRest) + (r.myOut ? -0.5 : 0);

export function reasonOf(c, side) {
  const r = c.main;
  const fast = c.pow >= 0.9, soft = c.pow <= 0.55;
  const off = Math.abs(c.ang - bearing(side)) > 0.3;
  const left = `${Math.round(r.myRest * 100)}%`;
  if (r.myOut && r.won <= 0) return 'Easier: that launch is too hard and would carry you out of the dish.';
  if (r.won > 0 && r.enOut) return off ? 'Come in at an angle: in the trial the hit skidded their top out over the rim.' : (fast ? 'Full pace straight at them: in the trial the hit knocked their top out of the dish.' : 'A firm straight launch: in the trial the hit pushed their top out over the rim.');
  if (r.won > 0 && r.why === 'wobble') return off ? `A glancing blow: in the trial their top tipped over while yours kept ${left} of its spin.` : `A solid hit in the middle: in the trial their top tipped over while yours kept ${left} of its spin.`;
  if (r.won > 0) return soft ? `A soft launch saves your spin: in the trial theirs ran down first and yours had ${left} left.` : `Keep your spin up: in the trial theirs ran down first and yours had ${left} left.`;
  return `No launch wins this trial outright. This one left your top the most spin (${left}).`;
}

// A planner scores candidates a few at a time so a frame never stalls.
export function createPlanner(arena, side, myB, enB, prof, rng, opts = {}) {
  const cands = candidateLaunches(side, prof.cands);
  const opps = opts.opps ?? oppModels(side, prof.opps);
  const jobs = [];
  for (const c of cands) for (let o = 0; o < opps.length; o++) jobs.push({ c, o });
  const sums = cands.map(() => ({ v: 0, n: 0, wins: 0, main: null }));
  const pl = { i: 0, total: jobs.length, done: false, result: null, cands, sums };
  pl.step = (n = 6) => {
    for (let q = 0; q < n && pl.i < jobs.length; q++, pl.i++) {
      const { c, o } = jobs[pl.i];
      const ci = cands.indexOf(c);
      const r = tryLaunch(arena, side, myB, enB, c, opps[o]);
      const s = sums[ci];
      s.v += valueOf(r); s.n++; if (r.won > 0) s.wins++;
      if (o === 0) s.main = r;
    }
    if (pl.i >= jobs.length && !pl.done) {
      pl.done = true;
      const scored = cands.map((c, i) => ({ ...c, score: sums[i].v / sums[i].n, wins: sums[i].wins, n: sums[i].n, main: sums[i].main }));
      scored.sort((a, b) => b.score - a.score);
      let pick = scored[0];
      if (prof.temp > 0) {
        const top = scored.slice(0, 4), best = top[0].score;
        const wts = top.map((c) => Math.exp((c.score - best) / prof.temp));
        let sum = 0; for (const x of wts) sum += x;
        let r = rng.next() * sum; pick = top[top.length - 1];
        for (let k = 0; k < top.length; k++) { r -= wts[k]; if (r <= 0) { pick = top[k]; break; } }
      }
      pl.result = { launch: { ang: pick.ang, pow: pick.pow }, pick, best: scored[0], all: scored, reason: reasonOf(pick, side) };
    }
  };
  pl.runAll = () => { while (!pl.done) pl.step(64); return pl.result; };
  return pl;
}

const gauss = (rng) => Math.sqrt(-2 * Math.log(1 - rng.next() * 0.999999)) * Math.cos(2 * Math.PI * rng.next());

// the rival's hand: the plan with a human's wobble on it
export function executeLaunch(plan, prof, rng) {
  let { ang, pow } = plan;
  if (prof.miss && rng.chance(prof.miss)) { ang += (rng.next() - 0.5) * 1.0; pow += (rng.next() - 0.5) * 0.4; }
  ang += gauss(rng) * prof.angSd; pow += gauss(rng) * prof.powSd;
  const q = clamp(prof.qMu + gauss(rng) * prof.qSd, 0.7, 1);
  return { ang, pow: clamp(pow, 0.25, 1), q };
}

// the top a rival brings; the Master looks at yours and picks the best of three of its own
const MASTER_PICKS = [
  { body: 'pear', tip: 'steel', ballast: 'std', hand: 1 },
  { body: 'disc', tip: 'pebble', ballast: 'heavy', hand: -1 },
  { body: 'dome', tip: 'steel', ballast: 'heavy', hand: 1 },
  { body: 'spire', tip: 'steel', ballast: 'std', hand: -1 },
];
export function rivalBuild(idx, arena, humanBuild) {
  if (idx < 4) return signatureBuild(idx, arena);
  let best = MASTER_PICKS[0], bv = -9;
  for (const b of MASTER_PICKS) {
    let v = 0;
    for (const ang of [0, 0.3, -0.3]) for (const pow of [0.6, 0.85]) {
      const r = tryLaunch(arena, 1, b, humanBuild, { ang: Math.PI / 2 + ang, pow }, { ang: -Math.PI / 2, pow: 0.75, q: 0.93 }, 30);
      v += valueOf(r);
    }
    if (v > bv) { bv = v; best = b; }
  }
  return { ...best };
}

export function colorsFor(idx) {
  return [['#c4472b', '#f3d9a4'], ['#2b7f9e', '#f3d9a4'], ['#d49a2a', '#4a2a1a'], ['#5a8f3c', '#f3e6c0'], ['#6b3a8c', '#f0c75e']][idx] ?? ['#c4472b', '#f3d9a4'];
}

// keep these referenced for tools
export const AI_K = { K, cloneWorld, stepWorld, launchSpot, ARENA };
