// The computer players and the "Think" hint. Both use the real physics: a table of candidate throws (style, spin, landing spot) is
// simulated against the bags that are on the board, ranked by how many points they win when the throw is not perfect, and a player
// then picks from it (a stronger player picks nearer the top and then throws with smaller errors).
import { STYLES, launchFor, throwWithError, newSim, runToEnd, BOARD_Z0, BOARD_L, COS_A, SIN_A, HOLE_V, boardToWorld, holeWorld } from './phys.js';
import { netOf, pointsOf, bagResult } from './engine.js';

export const PROFILES = [
  { name: 'Rookie', tag: 'Just found the backyard: throws at the middle', stars: 1, lat: 0.19, dep: 0.23, simple: true, pick: 1, think: [1.0, 1.8] },
  { name: 'Backyard Regular', tag: 'Steady, rarely thinks about the other bags', stars: 2, lat: 0.11, dep: 0.135, pick: 24, think: [1.1, 2.0] },
  { name: 'Tailgate Veteran', tag: 'Blocks and pushes when it pays', stars: 3, lat: 0.092, dep: 0.112, pick: 12, think: [1.2, 2.2] },
  { name: 'League Regular', tag: 'Reads the board and goes for the hole', stars: 4, lat: 0.076, dep: 0.092, pick: 5, think: [1.3, 2.4] },
  { name: 'Tournament Pro', tag: 'Sharp hands and the best line every time', stars: 5, lat: 0.062, dep: 0.075, pick: 2, think: [1.4, 2.6] },
];
// The error of a person's hand by Aim steadiness: lateral and depth, 1 sigma in metres.
export const ASSIST = [{ name: 'Steady', lat: 0.055, dep: 0.07 }, { name: 'Normal', lat: 0.08, dep: 0.10 }, { name: 'Shaky', lat: 0.115, dep: 0.15 }];

export function mulberry(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export const gaussOf = (rn) => { let u = 0; while (u < 1e-9) u = rn(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(Math.PI * 2 * rn()); };

// Throw the plan with a hand error; returns the settled bags and the thrown bag.
export function simulate(bags, plan, side, id, lat = 0, dep = 0, rn = null) {
  const L = lat || dep ? throwWithError(plan, lat, dep, gaussOf(rn), gaussOf(rn)) : launchFor(plan);
  const s = runToEnd(newSim(bags, L, id, side));
  return { s, bag: s.bags.find((b) => b.id === id), bags: s.bags };
}
const keep = (bags) => bags.filter((b) => b.st === 'board' || b.st === 'hole' || b.st === 'ground');
export const valueOf = (before, after, side) => netOf(after, side) - netOf(before, side);

// ---- candidate table ------------------------------------------------------------------------------------------------------
const AIMX = [-0.24, -0.18, -0.12, -0.06, 0, 0.06, 0.12, 0.18, 0.24, 0.34, -0.34];
const AIMZ = (() => { const a = []; for (let v = 0.05; v <= 1.2; v += 0.09) a.push(Math.round((BOARD_Z0 + v * COS_A) * 100) / 100); return a; })();
const SPIN = [-1, 0, 1];
export function tableJob(bags, side, id) {
  const cands = [];
  for (const style of [0, 1, 2]) for (const spin of SPIN) for (const aimX of AIMX) for (const aimZ of AIMZ) cands.push({ style, spin, aimX, aimZ });
  const board = keep(bags);
  const job = {
    stage: 0, i: 0, coarse: [], fine: [], table: null, total: cands.length + 24 * 5,
    get progress() { return job.stage === 0 ? job.i / job.total : (cands.length + job.i * 5) / job.total; },
    step(n) {
      let k = 0;
      while (k < n && !job.table) {
        if (job.stage === 0) {
          const c = cands[job.i];
          const r = simulate(board, c, side, id);
          job.coarse.push({ ...c, ideal: valueOf(board, r.bags, side) + (r.bag.st === 'hole' ? 0.01 : 0) });
          job.i++; k++;
          if (job.i >= cands.length) {
            job.coarse.sort((a, b) => b.ideal - a.ideal || Math.abs(a.spin) - Math.abs(b.spin) || a.style - b.style);
            job.top = job.coarse.slice(0, 24); job.stage = 1; job.i = 0;
          }
        } else {
          const c = job.top[job.i];
          const rn = mulberry(job.i * 977 + side * 31 + bags.length * 7 + 11);
          let sum = 0, mn = 99;
          for (let q = 0; q < 5; q++) { const r = simulate(board, c, side, id, 0.07, 0.085, rn); const v = valueOf(board, r.bags, side); sum += v; mn = Math.min(mn, v); }
          job.fine.push({ ...c, exp: sum / 5, worst: mn });
          job.i++; k += 5;
          if (job.i >= job.top.length) { job.fine.sort((a, b) => b.exp - a.exp || b.worst - a.worst || Math.abs(a.spin) - Math.abs(b.spin)); job.table = job.fine; }
        }
      }
      return !!job.table;
    },
  };
  return job;
}
export function buildTable(bags, side, id) { const j = tableJob(bags, side, id); while (!j.step(500)); return j.table; }

// A computer player's plan.
export function simplePlan(prof, rn) {
  const style = rn() < 0.5 ? 1 : 2;
  return { style, spin: 0, aimX: 0, aimZ: Math.round((BOARD_Z0 + 0.62 * COS_A) * 100) / 100, rank: 0 };
}
export function chooseFromTable(table, prof, rn) {
  if (prof.simple) return simplePlan(prof, rn);
  const r = rn();
  const idx = Math.min(table.length - 1, Math.floor(r * r * prof.pick));
  return { ...table[idx], rank: idx };
}

// ---- the Think hint: a verified reason --------------------------------------------------------------------------------------
const cm = (m) => Math.round(m * 100);
export function describePlan(c) {
  const st = STYLES[c.style].name;
  const v = (c.aimZ - BOARD_Z0) / COS_A;                        // distance up the board from the front edge
  const where = Math.abs(c.aimX) < 0.03 && Math.abs(v - HOLE_V) < 0.07 ? 'right at the hole'
    : v < 0.35 ? 'at the front of the board' : v < 0.75 ? 'in the middle of the board' : 'just in front of the hole';
  const side = Math.abs(c.aimX) < 0.03 ? '' : `, ${cm(Math.abs(c.aimX))} cm ${c.aimX < 0 ? 'left' : 'right'} of the centre line`;
  const spin = c.spin === 0 ? 'no spin' : `${Math.abs(c.spin) > 1 ? 'strong' : 'light'} spin ${c.spin < 0 ? 'left' : 'right'}`;
  return `${st} throw ${where}${side}, ${spin}`;
}
export function verifyPlan(bags, side, id, c, lat = 0.08, dep = 0.10) {
  const board = keep(bags);
  const rn = mulberry(bags.length * 131 + c.style * 17 + c.spin * 5 + Math.round((c.aimX + 1) * 100) + Math.round(c.aimZ * 10) + 5);
  const N = 12; let sum = 0, hole = 0, onb = 0, out = 0, knocked = 0, mn = 99, mx = -99;
  const oppBefore = board.filter((b) => b.side !== side && (b.st === 'board' || b.st === 'hole')).length;
  for (let q = 0; q < N; q++) {
    const r = simulate(board, c, side, id, lat, dep, rn);
    const v = valueOf(board, r.bags, side); sum += v; mn = Math.min(mn, v); mx = Math.max(mx, v);
    const res = bagResult(r.bag);
    if (res === 'hole') hole++; else if (res === 'board') onb++; else out++;
    const oppAfter = r.bags.filter((b) => b.side !== side && (b.st === 'board' || b.st === 'hole')).length;
    if (oppAfter < oppBefore) knocked++;
  }
  return { avg: sum / N, min: mn, max: mx, N, hole, onb, out, knocked, oppBefore };
}
export function explainHint(bags, side, c, v) {
  const bits = [`${describePlan(c)}.`];
  bits.push(`Twelve test throws: ${v.hole} in the hole, ${v.onb} on the board, ${v.out} missed. That is ${v.avg >= 0 ? '+' : ''}${v.avg.toFixed(1)} points on average for this round (${v.min >= 0 ? '+' : ''}${v.min} to ${v.max >= 0 ? '+' : ''}${v.max}).`);
  if (v.oppBefore && v.knocked >= 3) bits.push(`It moves or knocks off an opponent bag in ${v.knocked} of 12.`);
  return bits.join(' ');
}
export { boardToWorld, holeWorld, SIN_A, BOARD_L, pointsOf };
