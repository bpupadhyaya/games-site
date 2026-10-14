// The computer rivals. A planner runs the real physics (sim.simulateThrow) for a grid of landing points and styles, keeps
// the best few, then re-tests those against small wobbles of the hand so it prefers throws that survive an imperfect
// delivery. The profile then decides how well the throw is carried out (its own wobble), so weaker rivals miss like a
// person does. The planner is also the Hint.
import { simulateThrow, specFor, SK_R } from './sim.js';

// sx / sy: how far (cm) the real throw lands from the plan, sideways and in depth (one standard deviation).
// pool: it picks among its best `pool` plans; rob: how much it weighs the risk of a wobbled throw (0..1).
export const PROFILES = [
  { name: 'Aino', tag: 'Gentle and careful', stars: 1, sx: 11, sy: 22, pool: 8, rob: 0.0, think: [0.8, 1.6] },
  { name: 'Jussi', tag: 'Quick and cheerful', stars: 2, sx: 7.5, sy: 15, pool: 5, rob: 0.5, think: [0.8, 1.7] },
  { name: 'Helmi', tag: 'Plans two throws ahead', stars: 3, sx: 5, sy: 10, pool: 3, rob: 1, think: [1.0, 2.2] },
  { name: 'Eero', tag: 'Hardly ever misses', stars: 5, sx: 3, sy: 6, pool: 1, rob: 1, think: [1.2, 2.6] },
  { name: 'Hint', tag: '', stars: 5, sx: 3, sy: 6, pool: 1, rob: 1, think: [0, 0] },
];

export const STYLE_NAMES = [
  { lob: 'Lob', skim: 'Skim' },
];
export const throwName = (style, flat) => `${style === 0 ? 'Lob' : 'Skim'}, ${flat ? 'flat spin' : 'end over end'}`;

// Value of a finished throw for a player in state c = { score, target, back, misses }.
export function utility(res, c) {
  const k = res.knocked.length;
  if (k === 0) return c.misses >= 2 ? -80 : -5 - 4 * c.misses;
  const pts = res.points, after = c.score + pts;
  if (after === c.target) return 1000;
  if (after > c.target) return (c.back - c.score) - 3;
  const rem = c.target - after;
  let u = pts;
  if (rem <= 12) {
    const s = res.after.find((q) => q.num === rem);
    if (s) {
      let nb = 0;
      for (const q of res.after) if (q !== s && Math.hypot(q.x - s.x, q.y - s.y) < 11) nb++;
      u += 7 - 1.4 * nb;
    }
  }
  return u;
}

const YAWS = [0.35, 1.25, 2.3];
const WOB = [[0, 0, 0.3], [-1, 0, 0.1], [1, 0, 0.1], [0, -1, 0.15], [0, 1, 0.15], [-0.8, -0.8, 0.07], [0.8, 0.8, 0.07], [0.8, -0.8, 0.03], [-0.8, 0.8, 0.03]];

// planner(sk, c, prof, rng, {perfect}) -> { done, result, step(n) }
export function createPlanner(sk, c, prof, rng, o = {}) {
  const pl = { done: false, result: null, step };
  const cands = [];
  const styles = [[0, false], [0, true], [1, false], [1, true]];
  for (let tx = -30; tx <= 30; tx += 5) for (let ty = -34; ty <= 30; ty += 5) for (const [st, fl] of styles) cands.push({ tx, ty, style: st, flat: fl });
  // aimed shots at each skittle: its centre and a little in front
  for (const s of sk) for (const [st, fl] of styles) for (const dy of [0, -4]) cands.push({ tx: s.x, ty: s.y + dy, style: st, flat: fl });
  let i = 0, phase = 0, top = [], ti = 0;
  const first = [];
  const perfect = !!o.perfect;
  const runOne = (cd, dx = 0, dy = 0, full = false) => {
    const tx = cd.tx + dx, ty = cd.ty + dy;
    if (!cd.flat) return utility(simulateThrow(sk, specFor(tx, ty, cd.style, false, 0)), c);
    if (!full) return utility(simulateThrow(sk, specFor(tx, ty, cd.style, true, 1.25)), c);
    let u = 0;
    for (const y of YAWS) u += utility(simulateThrow(sk, specFor(tx, ty, cd.style, true, y)), c);
    return u / YAWS.length;
  };
  function step(n = 24) {
    if (pl.done) return;
    if (phase === 0) {
      for (let k = 0; k < n && i < cands.length; k++, i++) {
        const cd = cands[i];
        first.push({ ...cd, g: runOne(cd) });
      }
      if (i >= cands.length) {
        first.sort((a, b) => b.g - a.g);
        // keep variety: skip near-duplicates of an already kept plan
        top = [];
        for (const f of first) {
          if (top.length >= (perfect ? 22 : 18)) break;
          if (top.some((t) => t.style === f.style && t.flat === f.flat && Math.abs(t.tx - f.tx) < 4 && Math.abs(t.ty - f.ty) < 4)) continue;
          top.push(f);
        }
        phase = 1; ti = 0;
      }
    } else {
      const sx = Math.max(prof.sx, 3.5) * 0.9, sy = Math.max(prof.sy, 7) * 0.9;
      for (let k = 0; k < Math.max(1, n >> 3) && ti < top.length; k++, ti++) {
        const t = top[ti];
        t.g0 = runOne(t, 0, 0, true);
        let sum = 0, w = 0;
        for (const [a, b, wt] of WOB) { sum += wt * (a === 0 && b === 0 ? t.g0 : runOne(t, a * sx, b * sy, true)); w += wt; }
        t.ev = sum / w;
      }
      if (ti >= top.length) {
        for (const t of top) t.score = (perfect || prof.rob >= 1 ? 0.25 : 1 - 0.75 * prof.rob) * t.g0 + (perfect || prof.rob >= 1 ? 0.75 : 0.75 * prof.rob) * t.ev;
        top.sort((a, b) => b.score - a.score);
        const pool = top.slice(0, perfect ? 1 : prof.pool);
        const pick = pool[Math.min(pool.length - 1, Math.floor(Math.pow(rng.next(), 1.7) * pool.length))];
        const alts = top.filter((t) => t !== pick).slice(0, 3);
        // what the throw typically does: one run for a lengthwise pin, the middle of three landing turns for a flat spin
        const runs = (pick.flat ? YAWS : [0]).map((y) => simulateThrow(sk, specFor(pick.tx, pick.ty, pick.style, pick.flat, y)));
        runs.sort((p, q) => p.knocked.length - q.knocked.length);
        const mid = runs[Math.floor(runs.length / 2)];
        pl.result = { tx: pick.tx, ty: pick.ty, style: pick.style, flat: pick.flat, ev: pick.score, predicted: mid.knocked, points: mid.points, sure: !pick.flat, alts };
        pl.done = true;
      }
    }
  }
  return pl;
}

// What the rival really does with its plan: the wobble of its hand (bell shaped).
export function executePlan(plan, prof, rng) {
  const wob = () => (rng.next() + rng.next() + rng.next() - 1.5) / 0.5;
  return { tx: plan.tx + wob() * prof.sx, ty: plan.ty + wob() * prof.sy, style: plan.style, flat: plan.flat };
}
void SK_R;
