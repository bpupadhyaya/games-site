// The computer players and the "Think" hint. Both use the real physics: a table of candidate throws (start spot, aim, weight,
// hook) is simulated for the pins that are standing, ranked by how well they do when the roll is not perfect, and a player
// then picks from it (a stronger player picks nearer the top and then rolls with smaller errors).
import { PIN_POS, PIN_NAMES, KING, POWERS, HOOKS, launchFor, newSim, runToEnd, simResult, PIN_Z0 } from './phys.js';
import { toMask, fromMask, countOf } from './engine.js';

export const PROFILES = [
  { name: 'Lehrling', tag: 'Apprentice: still learning the lane', stars: 1, lat: 0.150, spd: 0.060, pick: 0.55, think: [1.2, 2.2] },
  { name: 'Stammgast', tag: 'Regular: a steady pub player', stars: 2, lat: 0.090, spd: 0.040, pick: 0.35, think: [1.2, 2.4] },
  { name: 'Kegelbruder', tag: 'Club member: reads the pins well', stars: 3, lat: 0.060, spd: 0.028, pick: 0.20, think: [1.4, 2.6] },
  { name: 'Vereinsmeister', tag: 'Club champion: precise and patient', stars: 4, lat: 0.036, spd: 0.018, pick: 0.08, think: [1.5, 2.8] },
  { name: 'Großmeister', tag: 'Grand master: hardly ever misses the line', stars: 5, lat: 0.020, spd: 0.010, pick: 0.0, think: [1.6, 3.0] },
];
export const HUMAN_LAT = [0.030, 0.045, 0.070];           // lateral error at the pins by Aim steadiness: Steady, Normal, Shaky
export const ASSIST = [{ name: 'Steady', k: 0.6 }, { name: 'Normal', k: 1 }, { name: 'Shaky', k: 1.6 }];

// A small deterministic generator (the search must give the same table every time, whatever else has been drawn).
export function mulberry(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export const gaussOf = (rn) => { let u = 0; while (u < 1e-9) u = rn(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(Math.PI * 2 * rn()); };

// ---- how a rolled throw is spoiled by the thrower ---------------------------------------------------------------
// lat: error of the line at the pins in metres (1 sigma); spd: relative error of the speed.
export function rollWithError(plan, lat, spd, rn) {
  const g = () => gaussOf(rn);
  const aimX = plan.aimX + g() * lat, x0 = plan.x0 + g() * lat * 0.12;
  const L = launchFor(x0, aimX, plan.power, plan.hook);
  const f = 1 + g() * spd;
  return { ...L, vz: L.vz * f, vx0: L.vx0 + g() * lat * 0.01 };
}
export function simulate(standing, launch, laneK = 1) { const s = runToEnd(newSim(standing, launch, laneK)); return { s, r: simResult(s) }; }

// ---- candidate table ----------------------------------------------------------------------------------------------
const X0S = [-0.3, 0, 0.3];
const POW = [0, 1, 2];
const AIMS = (() => { const a = []; for (let x = -0.56; x <= 0.561; x += 0.07) a.push(Math.round(x * 100) / 100); return a; })();
const TABLE_CACHE = new Map();
export function tableKey(standing) { return toMask(standing); }
export function cachedTable(mask) { return TABLE_CACHE.get(mask) ?? null; }

// An incremental job: step(n) simulates up to n more throws; done when `table` is set.
export function tableJob(standing) {
  const mask = toMask(standing), cands = [], hit = TABLE_CACHE.get(mask) ?? null;   // a cached table still takes the same number of steps, so timing never depends on history
  for (const x0 of X0S) for (const hook of HOOKS) for (const power of POW) for (const aimX of AIMS) {
    if (Math.abs(x0 + (aimX - x0) * 0.0) > 0.66) continue;
    cands.push({ x0, aimX, power, hook });
  }
  const job = {
    mask, stage: 0, i: 0, coarse: [], fine: [], table: null, total: cands.length + 24 * 5,
    get progress() { return job.stage === 0 ? job.i / job.total : (cands.length + job.i) / job.total; },
    step(n) {
      let k = 0;
      while (k < n && !job.table) {
        if (job.stage === 0) {
          const c = cands[job.i];
          if (!hit) { const { r } = simulate(standing, launchFor(c.x0, c.aimX, c.power, c.hook)); job.coarse.push({ ...c, ideal: r.count }); }
          job.i++; k++;
          if (job.i >= cands.length) {
            if (hit) { job.top = new Array(24).fill(null); job.stage = 1; job.i = 0; continue; }
            job.coarse.sort((a, b) => b.ideal - a.ideal || a.hook * a.hook - b.hook * b.hook || a.power - b.power);
            job.top = job.coarse.slice(0, 24); job.stage = 1; job.i = 0;
          }
        } else {
          const c = job.top[job.i];
          if (!hit) {
            const rn = mulberry(mask * 977 + job.i * 31 + 7);
            let sum = 0, mn = 99;
            for (let q = 0; q < 5; q++) {
              const L = rollWithError(c, 0.035, 0.015, rn);
              const { r } = simulate(standing, L);
              sum += r.count; mn = Math.min(mn, r.count);
            }
            job.fine.push({ ...c, exp: sum / 5, worst: mn });
          }
          job.i++; k += 5;
          if (job.i >= job.top.length) {
            if (hit) { job.table = hit; continue; }
            job.fine.sort((a, b) => b.exp - a.exp || b.worst - a.worst);
            job.table = job.fine; TABLE_CACHE.set(mask, job.table);
          }
        }
      }
      return !!job.table;
    },
  };
  return job;
}
export function buildTable(standing) { const c = cachedTable(toMask(standing)); if (c) return c; const j = tableJob(standing); while (!j.step(500)); return j.table; }

// A computer player's plan from the table.
export function chooseFromTable(table, prof, rn) {
  // stronger players mostly take the best; weaker ones sometimes pick a worse (but still sensible) entry.
  let idx = 0;
  if (rn() < prof.pick * 1.6) idx = Math.min(table.length - 1, Math.floor(rn() * Math.min(table.length, 14) * Math.min(1, prof.pick * 2 + 0.2)));
  return { ...table[idx], rank: idx };
}

// ---- the Think hint: a verified reason -----------------------------------------------------------------------------------
const side = (x) => (x < -0.015 ? 'left' : x > 0.015 ? 'right' : 'the middle');
export function describeAim(c) {
  const a = Math.round(Math.abs(c.aimX) * 100);
  const aim = a < 2 ? 'on the lane\'s centre line' : `${a} cm ${c.aimX < 0 ? 'left' : 'right'} of the centre line`;
  const hook = c.hook === 0 ? 'no hook' : `${Math.abs(c.hook) === 3 ? 'big' : Math.abs(c.hook) === 2 ? 'medium' : 'gentle'} hook ${c.hook < 0 ? 'left' : 'right'}`;
  const from = Math.abs(c.x0) < 0.05 ? 'From the middle' : `From ${Math.round(Math.abs(c.x0) * 100)} cm ${c.x0 < 0 ? 'left' : 'right'}`;
  return `${from}, aim ${aim}, ${hook}, ${POWERS[c.power].name} weight`;
}
// Roll the plan 12 times with a realistic hand and report what really happened: the numbers in the reason are measured.
export function verifyPlan(standing, c, lat = 0.035) {
  const rn = mulberry(toMask(standing) * 131 + c.power * 17 + Math.round((c.aimX + 1) * 100) + 5);
  const fallen = new Array(9).fill(0);
  let sum = 0, mn = 99, mx = 0;
  const N = 12;
  for (let q = 0; q < N; q++) {
    const { r } = simulate(standing, rollWithError(c, lat, 0.02, rn));
    sum += r.count; mn = Math.min(mn, r.count); mx = Math.max(mx, r.count);
    r.down.forEach((d, i) => { if (d) fallen[i]++; });
  }
  const sure = fallen.map((n, i) => (n >= N - 1 ? i : -1)).filter((i) => i >= 0);
  const often = fallen.map((n, i) => (n <= 2 && standing[i] ? i : -1)).filter((i) => i >= 0);
  return { avg: sum / N, min: mn, max: mx, N, sure, often, fallen };
}
export function explainHint(standing, c, v, phase) {
  const n = countOf(standing);
  const bits = [`${describeAim(c)}.`];
  const avg = v.avg.toFixed(1);
  if (phase === 1 && n < 9) bits.push(`${n} ${n === 1 ? 'pin is' : 'pins are'} left. Twelve test rolls cleared ${avg} on average (${v.min} to ${v.max}).`);
  else bits.push(`Twelve test rolls dropped ${avg} pins on average (${v.min} to ${v.max}).`);
  if (v.often.length && v.often.length <= 2) bits.push(`The ${v.often.map((i) => PIN_NAMES[i]).join(' and ')} often stay${v.often.length === 1 ? 's' : ''} up.`);
  return bits.join(' ');
}
export { PIN_POS, KING, PIN_Z0, toMask, fromMask };
