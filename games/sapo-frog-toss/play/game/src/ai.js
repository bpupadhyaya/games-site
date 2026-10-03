// The computer players and the Think hint. Every candidate throw is tried on the real physics (a noise-free test throw first, then a handful
// of test throws with the thrower's own wobble), so a hint's numbers are what the engine really did, not a guess.
import { runThrow, launchDisc, newDisc, MOUTH, HOLES, holeAt, resting, closestDisc, HW, TD, A } from './phys.js';
import { CLOSEST_BONUS, tableDiscs, leftFor, turnSide } from './engine.js';
import { tr } from './i18n.js';

// Landing wobble (metres, one standard deviation across; depth wobble is a little larger the further the throw).
export const PROFILES = [
  { id: 0, en: 'Novice', es: 'Principiante', tagEn: 'Wild throws, aims at the easy holes', tagEs: 'Tiros desviados, apunta a los agujeros fáciles', stars: 1, sigma: 0.22, strat: 0, think: [0.9, 1.6] },
  { id: 1, en: 'Regular', es: 'Aficionado', tagEn: 'Aims for the big scores, loose aim', tagEs: 'Apunta a los puntos grandes, puntería floja', stars: 2, sigma: 0.15, strat: 1, think: [1.1, 2.0] },
  { id: 2, en: 'Skilled', es: 'Experto', tagEn: 'Reads the table, steady hand', tagEs: 'Lee la mesa, pulso firme', stars: 3, sigma: 0.11, strat: 2, think: [1.3, 2.4] },
  { id: 3, en: 'Veteran', es: 'Veterano', tagEn: 'Knocks your discs away, goes for the bonus', tagEs: 'Saca tus fichas y busca la bonificación', stars: 4, sigma: 0.085, strat: 3, think: [1.5, 2.8] },
  { id: 4, en: 'Master', es: 'Maestro', tagEn: 'Calm, exact, plays every disc for value', tagEs: 'Sereno y preciso, juega cada ficha por su valor', stars: 5, sigma: 0.065, strat: 4, think: [1.8, 3.2] },
];
export const pname = (p) => tr(p.en, p.es);
export const ASSIST = [
  { id: 0, en: 'Steady', es: 'Firme', sigma: 0.06 },
  { id: 1, en: 'Natural', es: 'Natural', sigma: 0.08 },
  { id: 2, en: 'Wobbly', es: 'Tembloroso', sigma: 0.105 },
];
// Fixed standard-normal pairs for averaging test throws (deterministic: the same hint every time).
const NP = [[0, 0], [1.0, 0.4], [-1.0, -0.4], [0.5, -1.1], [-0.5, 1.1], [1.5, -0.6], [-1.5, 0.6], [0.2, 1.5], [-0.2, -1.5], [0.9, -0.2], [-0.9, 0.2], [0.0, 0.8]];
const g1 = (rn) => (rn() + rn() + rn() - 1.5) * 2;   // roughly normal, sd 1
export const wobble = (plan, sigma, rn) => ({ ...plan, ax: plan.ax + sigma * g1(rn), az: plan.az + sigma * (0.8 + 0.5 * plan.az) * g1(rn) });
const shifted = (plan, sigma, [gx, gz]) => ({ ...plan, ax: plan.ax + sigma * gx, az: plan.az + sigma * (0.8 + 0.5 * plan.az) * gz });
const clampPlan = (p) => ({ ...p, ax: Math.max(-HW + 0.03, Math.min(HW - 0.03, p.ax)), az: Math.max(0.02, Math.min(TD - 0.02, p.az)) });

// The value of what a test throw did for side `me`: points that dropped (mine count, the other side's count against me), plus
// the closest bonus (weighted by how much of the round is still to come).
export function valueOf(res, table, me, last, round = 1) {
  let v = 0;
  for (const s of res.scored) v += s.owner === me ? s.v : -s.v;
  const c = closestDisc(res.discs);
  const w = last ? 1 : 0.45;
  if (c) v += (c.owner === me ? 1 : -1) * CLOSEST_BONUS * w;
  void table; void round;
  return v;
}

export const planKey = (p) => `${p.ax.toFixed(3)},${p.az.toFixed(3)},${p.spin},${p.style}`;

// An incremental search (so the screen never stalls): step(n) tries up to n candidates; `done` when the table is ready.
export function makeJob(m, side, level, strat = level) {
  const table = strat >= 2 ? tableDiscs(m) : [], last = leftFor(m, side) === 1, nextId = m.nextId;
  const sigma = level === 'human' ? 0 : level;
  const job = { strat, table, side, stage: 0, i: 0, cands: [], top: [], best: null, done: false, progress: 0, nextId, last, sigma };
  const grid = [];
  const spins = strat >= 3 ? [-1, 0, 1] : [0];
  const styles = strat >= 1 ? [0, 1] : [0];
  const step = strat >= 3 ? 0.03 : 0.045;
  for (let ax = -0.42; ax <= 0.4201; ax += step) for (let az = 0.04; az <= 0.86; az += strat >= 3 ? 0.035 : 0.05) for (const spin of spins) for (const style of styles) grid.push({ ax: Math.round(ax * 1000) / 1000, az: Math.round(az * 1000) / 1000, spin, style });
  job.grid = grid;
  job.K = [4, 5, 8, 10, 14][Math.min(4, strat)];
  job.samples = strat >= 4 ? 12 : strat >= 2 ? 8 : 6;
  job.sigmaEval = typeof sigma === 'number' ? sigma : 0.03;
  job.step = (n = 40) => {
    if (job.done) return true;
    let k = 0;
    while (k < n && !job.done) {
      if (job.stage === 0) {
        const p = job.grid[job.i++];
        const r = runThrow(job.table, launchDisc(job.nextId, side, p));
        job.cands.push({ p, v: valueOf(r, job.table, side, job.last), res: r });
        job.progress = 0.7 * job.i / job.grid.length;
        if (job.i >= job.grid.length) {
          job.cands.sort((a, b) => b.v - a.v);
          // keep the best few that are not near-duplicates of each other
          // (at most two per target hole, so the plans differ in where they aim, not only a few centimetres)
          const top = [], perHole = {};
          const holeOf = (c) => { const s = c.res.scored.find((e) => e.id === job.nextId); return s ? s.hole : 'none'; };
          for (const c of job.cands) {
            if (top.length >= job.K) break;
            const hk = holeOf(c); if ((perHole[hk] || 0) >= 2) continue;
            if (top.every((t) => Math.hypot(t.p.ax - c.p.ax, t.p.az - c.p.az) > 0.07 || t.p.style !== c.p.style)) { top.push(c); perHole[hk] = (perHole[hk] || 0) + 1; }
          }
          job.top = top; job.stage = 1; job.i = 0; job.cands = null;
        }
      } else {
        const c = job.top[job.i++];
        // test throws with the thrower's wobble around the plan and a few small shifts of it; keep the shift that does best
        const offs = job.strat >= 2 ? [[0, 0], [0.025, 0], [-0.025, 0], [0, 0.025], [0, -0.025]] : [[0, 0]];
        let bestRec = null;
        for (const [ox, oz] of offs) {
          const plan = clampPlan({ ...c.p, ax: c.p.ax + ox, az: c.p.az + oz });
          const rec = sampleRecord(job, plan);
          if (!bestRec || rec.ev > bestRec.ev) bestRec = rec;
        }
        c.p = bestRec.p; c.ev = bestRec.ev; c.worst = bestRec.worst; c.bestv = bestRec.bestv; c.holes = bestRec.holes; c.mouth = bestRec.mouth; c.n = bestRec.n; c.res = bestRec.res; c.v = bestRec.v;
        job.progress = 0.7 + 0.3 * job.i / job.top.length;
        if (job.i >= job.top.length) { job.top.sort((a, b) => b.ev - a.ev); job.best = job.top[0]; job.done = true; job.progress = 1; }
      }
      k++;
    }
    return job.done;
  };
  return job;
}

// Test a given plan with the thrower's wobble, on the real table, and return the same kind of record as a search candidate.
function sampleRecord(job, plan) {
  const base = runThrow(job.table, launchDisc(job.nextId, job.side, plan));
  let sum = 0, n = 0, worst = 1e9, bestv = -1e9, mouth = 0; const holes = {};
  for (const g of NP.slice(0, job.samples)) {
    const r = runThrow(job.table, launchDisc(job.nextId, job.side, clampPlan(shifted(plan, job.sigmaEval, g))));
    const v = valueOf(r, job.table, job.side, job.last);
    sum += v; n++; worst = Math.min(worst, v); bestv = Math.max(bestv, v);
    for (const s of r.scored) if (s.id === job.nextId) { holes[s.hole] = (holes[s.hole] || 0) + 1; if (s.hole === 'mouth') mouth++; }
  }
  return { p: plan, v: valueOf(base, job.table, job.side, job.last), res: base, ev: sum / n, worst, bestv, holes, mouth, n };
}
export const evalPlan = sampleRecord;
// Choose what the computer throws, from a finished search, with the strategy of its level. Returns a candidate record.
export function choose(job, prof, rn) {
  const t = job.top;
  if (prof.strat <= 0) {
    // novice: aim at one of the easy holes, ignoring the loose discs
    const easy = HOLES.filter((h) => h.R >= 0.05);
    const h = easy[Math.floor(rn() * easy.length)];
    return evalPlan(job, { ax: h.x, az: Math.max(0.05, h.z - 0.065), spin: 0, style: 0 });
  }
  if (prof.strat === 1) return t[0];
  if (prof.strat === 2 && t.length > 1 && rn() < 0.3) return t[Math.min(t.length - 1, 1 + Math.floor(rn() * 2))];
  if (prof.strat === 3 && t.length > 1 && rn() < 0.12) return t[1];
  if (prof.strat >= 4 && t.length > 1) {
    // the master plays every disc for value: any of the near-equal best plans, so it does not always go for the same hole
    const near = t.filter((c) => c.ev >= t[0].ev * 0.72);
    return near[Math.floor(rn() * near.length)];
  }
  return t[0];
}

// Plain-language reason for a plan, from what the test throws actually did.
const sideTxt = (v) => (Math.abs(v) < 0.02 ? tr('on the centre line', 'en la línea central') : v < 0 ? tr(`${Math.round(-v * 100)} cm left`, `${Math.round(-v * 100)} cm a la izquierda`) : tr(`${Math.round(v * 100)} cm right`, `${Math.round(v * 100)} cm a la derecha`));
const HOLE_NAMES = {
  mouth: ['the frog\'s mouth', 'la boca del sapo'], mill: ['the mill', 'el molino'], bridgeL: ['the left bridge', 'el puente izquierdo'], bridgeR: ['the right bridge', 'el puente derecho'],
  sideL: ['the left side hole', 'el agujero lateral izquierdo'], sideR: ['the right side hole', 'el agujero lateral derecho'], cornerL: ['the back left hole', 'el agujero trasero izquierdo'], cornerR: ['the back right hole', 'el agujero trasero derecho'],
};
export const holeName = (id) => tr(...(HOLE_NAMES[id] ?? ['a hole', 'un agujero']));
export function explain(job, c, who = 'you') {
  const p = c.p, rn = { r: c.res };
  void rn;
  const tableN = job.table.length;
  const first = c.res.scored.find((s) => s.id === job.nextId);
  const targetEn = first ? `to drop into ${HOLE_NAMES[first.hole][0]} (${first.v} points)` : null;
  const targetEs = first ? `para caer en ${HOLE_NAMES[first.hole][1]} (${first.v} puntos)` : null;
  const knock = c.res.sim.events.some((e) => e.k === 'clink');
  const style = p.style ? tr('a flat drive', 'un tiro rasante') : tr('a high lob', 'un tiro alto');
  const spin = p.spin === 0 ? tr('no spin', 'sin efecto') : p.spin < 0 ? tr('left spin', 'efecto a la izquierda') : tr('right spin', 'efecto a la derecha');
  const avg = Math.round(c.ev);
  const mouthTxt = c.mouth > 0 ? tr(`, the mouth ${c.mouth} of ${c.n} times`, `, la boca ${c.mouth} de ${c.n} veces`) : '';
  const extra = knock && tableN > 0 ? tr(' It knocks a loose disc out of the way.', ' Aparta una ficha suelta del camino.') : '';
  const aim = tr(`Land it ${sideTxt(p.ax)} and ${Math.round(p.az * 100)} cm from the front edge, ${style}, ${spin}`, `Cae ${sideTxt(p.ax)} y a ${Math.round(p.az * 100)} cm del borde delantero, ${style}, ${spin}`);
  const aimed = first ? tr(` ${targetEn}.`, ` ${targetEs}.`) : '.';
  const test = tr(` ${c.n} test throws with ${who === 'you' ? 'your own' : 'this player\'s'} wobble averaged ${avg} points${mouthTxt}.`, ` ${c.n} tiros de prueba con ${who === 'you' ? 'tu propio temblor' : 'el temblor de este jugador'} dieron ${avg} puntos de media${mouthTxt}.`);
  return aim + aimed + extra + test;
}
// What the throw really did, for the Watch & Learn line afterwards (no guessing).
export function verifyPlan(job, c) { return { ev: c.ev, n: c.n, mouth: c.mouth }; }
export { holeAt, newDisc, MOUTH, resting, A, turnSide };
