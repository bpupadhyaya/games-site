// The computer rivals. A planner runs the real physics (sim.simulate) for a grid of strikes, values each resulting board by
// the chalks it would be worth if the round ended now, keeps the best few and tests those against small wobbles of the hand
// so it prefers strikes that survive an imperfect delivery. The profile then decides how steadily the strike is carried out
// (its own wobble) and how much it cares about hurting the other side, so every rival has its own way of playing.
import { TW, R, BED_H, BEDS, simulate, startX, bedOf, bedCenterY, tally, bedsWon, CHALKS, AIM_MIN_Y, AIM_MAX_Y, clamp } from './sim.js';

// aim: sideways wobble (units at the target), pow: strength wobble (fraction), def: weight of the other side's chalks,
// rob: 0 = any of the top strikes, 1 = always one of the best few, pool: how many of the top are in the draw.
export const PROFILES = [
  { name: 'Old Bert', tag: 'Gentle and unhurried', stars: 1, aim: 3.0, pow: 0.016, def: 0.35, pool: 12, think: [0.8, 1.6] },
  { name: 'Dolly', tag: 'Quick and cheerful', stars: 2, aim: 2.0, pow: 0.010, def: 0.7, pool: 6, think: [0.8, 1.6] },
  { name: 'Sergeant Pike', tag: 'Blocks and knocks you out', stars: 3, aim: 1.4, pow: 0.006, def: 1.5, pool: 3, think: [1.0, 2.2] },
  { name: 'Nan Hartley', tag: 'Hardly ever errs', stars: 5, aim: 0.8, pow: 0.0035, def: 1.0, pool: 1, think: [1.2, 2.6] },
  { name: 'Hint', tag: '', stars: 5, aim: 0, pow: 0, def: 1.0, pool: 1, think: [0, 0] },
];

// The human hand: slightly steadier than the middle rivals. Used by game.js for every strike by a person.
export const HAND = { aim: 0.7, pow: 0.0045 };

const XS = [];
for (let i = 0; i < 9; i++) XS.push(R + 3 + (i * (TW - 2 * (R + 3))) / 8);
const TXS = [];
for (let i = 0; i < 7; i++) TXS.push(R + 2 + (i * (TW - 2 * (R + 2))) / 6);

// Value of a strike for `side`: the chalks it wins now (and the filled beds), minus what it hands to the other side, weighted
// by def. The coins are the copies a simulation produced, so scoring them here does not touch the real board.
export function strikeValue(chalks, coins, side, def = 1, sides = 2) {
  const ch = chalks.map((c) => c.slice());
  const awards = tally(ch, coins, sides);
  let v = 0;
  for (const a of awards) {
    if (a.side < 0) { v -= 0.05; continue; }
    const w = ch[a.side][a.bed] >= CHALKS ? 1.6 : 1;      // the chalk that fills a bed is worth a little more
    if (a.side === side) v += w; else v -= def * w;
  }
  v += 0.6 * (bedsWon(ch[side]) - bedsWon(chalks[side]));
  if (sides === 2) v -= def * 0.6 * (bedsWon(ch[1 - side]) - bedsWon(chalks[1 - side]));
  return v;
}

// planner(table, side, chalks, prof, rng, { perfect, idx, sides }) -> { done, result, step(n) }
export function createPlanner(table, side, chalks, prof, rng, o = {}) {
  const perfect = !!o.perfect, sides = o.sides ?? 2, idx = o.idx ?? 0;
  const def = prof.def ?? 1;
  const pl = { done: false, result: null, step };
  const cands = [];
  // bed centres at a few depths, from several starts and several targets across the board
  for (const x of XS) {
    for (let k = 0; k < BEDS; k++) for (const dy of [-3.5, 0, 3.5]) for (const tx of TXS) cands.push({ x, tx, ty: bedCenterY(k) + dy });
  }
  // nudges: aim just beyond or beside a lying coin so the strike pushes it on
  for (const c of table) for (const dx of [-8, -4, 0, 4, 8]) for (const dy of [-6, -14, -26]) {
    for (const x of [XS[1], XS[4], XS[7], clamp(c.x, R + 3, TW - R - 3)]) cands.push({ x, tx: clamp(c.x + dx, R, TW - R), ty: clamp(c.y + dy, AIM_MIN_Y, AIM_MAX_Y) });
  }
  let i = 0, phase = 0, top = [], ti = 0;
  const first = [];
  const evalSpec = (c) => {
    const r = simulate(table, { ...c, side, n: idx });
    return { r, g: strikeValue(chalks, r.table, side, def, sides) + tidy(r) };
  };
  // a small preference for leaving the board clean: a dead coin of ours can be nudged in by the rival, a coin that ran off is lost
  const tidy = (r) => (r.thrown.sc || bedOf(r.thrown) >= 0 ? 0 : -0.12);
  const base = 0;
  function step(n = 24) {
    if (pl.done) return;
    if (phase === 0) {
      for (let k = 0; k < n && i < cands.length; k++, i++) {
        const c = cands[i], { g } = evalSpec(c);
        first.push({ ...c, g });
      }
      if (i >= cands.length) {
        first.sort((a, b) => b.g - a.g);
        // keep distinct strikes only
        top = [];
        for (const f of first) {
          if (top.length >= (perfect ? 26 : 20)) break;
          if (!top.some((t) => Math.abs(t.tx - f.tx) < 2 && Math.abs(t.ty - f.ty) < 2 && Math.abs(t.x - f.x) < 6)) top.push(f);
        }
        phase = 1; ti = 0;
        top.forEach((t) => { t.sum = t.g; t.cnt = 1; });
      }
    } else {
      const wob = [[-1, 0], [1, 0], [0, -1], [0, 1], [0.7, 0.7], [-0.7, -0.7]];
      for (let k = 0; k < Math.max(1, n >> 2) && ti < top.length; k++, ti++) {
        const t = top[ti];
        for (const w of wob) {
          const r = simulate(table, { x: t.x, tx: t.tx, ty: t.ty, dx: w[0] * 2, dp: w[1] * 0.012, side, n: idx });
          t.sum += strikeValue(chalks, r.table, side, def, sides) + tidy(r); t.cnt++;
        }
      }
      if (ti >= top.length) {
        for (const t of top) t.ev = 0.3 * t.g + 0.7 * (t.sum / t.cnt);
        top.sort((a, b) => b.ev - a.ev);
        const pool = perfect ? top.slice(0, 1) : top.slice(0, Math.max(1, prof.pool));
        const pick = pool[Math.min(pool.length - 1, Math.floor(Math.pow(rng.next(), 1.6) * pool.length))];
        pl.result = { x: pick.x, tx: pick.tx, ty: pick.ty, exp: pick.ev - base, gain: pick.g - base };
        pl.done = true;
      }
    }
  }
  return pl;
}

// What the rival really does with its plan: the wobble of its hand.
export const wobble = (rng) => (rng.next() + rng.next() + rng.next() - 1.5) / 0.75;   // about unit spread, bell shaped
export function executePlan(plan, prof, rng) {
  return {
    x: startX(plan.x), tx: plan.tx, ty: plan.ty,
    dx: wobble(rng) * prof.aim, dp: wobble(rng) * prof.pow,
  };
}
void BED_H;
