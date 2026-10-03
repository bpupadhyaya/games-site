// The computer players. Five levels, calibrated by simulation (see STATUS.md): each level beats the one below.
// The same planner at full skill gives the Think hint, so the hint is always something the engine verified.
import {
  HOME, PIT, DWELL, SWEEP_DWELL, DROP_DWELL, REL_DWELL, H_MIN, TAP_REACT, TAP_GAP, MODES,
  airtime, winScale, clamp, dist, legTime, landing, newRoll, planLegs, catchResult, takeable, takeNow, isSweep, stageCount,
  dropSpots, applyToss, freshPlayer, playerDone,
} from './sim.js';

export const LEVELS = [
  { id: 1, name: 'Sprout', stars: 1, react: 0.4, gap: 0.2, jit: 0.07, slip: 0.14, pick: 1.6, hErr: 0.17, tErr: 0.13, margin: 0.2 },
  { id: 2, name: 'Pebble', stars: 2, react: 0.35, gap: 0.18, jit: 0.06, slip: 0.09, pick: 1.0, hErr: 0.13, tErr: 0.11, margin: 0.15 },
  { id: 3, name: 'Stream', stars: 3, react: 0.3, gap: 0.16, jit: 0.05, slip: 0.06, pick: 0.55, hErr: 0.09, tErr: 0.085, margin: 0.1 },
  { id: 4, name: 'Mountain', stars: 4, react: 0.25, gap: 0.145, jit: 0.04, slip: 0.03, pick: 0.2, hErr: 0.06, tErr: 0.06, margin: 0.06 },
  { id: 5, name: 'Master', stars: 5, react: 0.225, gap: 0.135, jit: 0.035, slip: 0.02, pick: 0.05, hErr: 0.05, tErr: 0.055, margin: 0.05 },
];
export const PERFECT = { react: TAP_REACT, gap: TAP_GAP, jit: 0, slip: 0, pick: 0.0001, hErr: 0, tErr: 0.03, margin: 0.05 };
// The Think hint plans for a steady human pace with room to spare, not for the fastest possible hand.
export const HINT = { react: 0.25, gap: 0.16, jit: 0, slip: 0, pick: 0.0001, hErr: 0, tErr: 0.05, margin: 0.4 };
export const TAGS = ['Just learning', 'Steady hands', 'Clean and calm', 'Sharp and quick', 'Rarely drops one'];

// ---- numbers --------------------------------------------------------------------------------------
export const gauss = (rng) => (rng.next() + rng.next() + rng.next() + rng.next() - 2) * 1.7;       // ~ N(0, 1)
const cdf = (x) => { const t = 1 / (1 + 0.2316419 * Math.abs(x)); const d = 0.3989423 * Math.exp(-x * x / 2); const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274)))); return x > 0 ? 1 - p : p; };
export const tSigma = (lvl, h) => lvl.tErr * (0.7 + 0.6 * h);
// chance that a tap with error N(0, sigma) lands in the catch window for toss height h
export function pCatch(sigma, h) {
  const s = winScale(h), e = -0.18 * s, l = 0.22 * s;
  return clamp(cdf(l / sigma) - cdf(e / sigma), 0, 1);
}
const ROLLS = [];
for (const u of [0.35, 1]) for (let k = 0; k < 6; k++) ROLLS.push({ ang: (k / 6) * Math.PI * 2 + 0.3, u });
export const H_GRID = [0.2, 0.28, 0.36, 0.44, 0.52, 0.6, 0.68, 0.76, 0.84, 0.92, 1];

// ---- the plan: which stones, in which order, how high ----------------------------------------------------
export function tossCtx(mode, p, L = HOME) {
  return { dir: p.dir, take: takeNow(mode, p.stage, p.done), sweep: isSweep(mode, p.stage), stones: takeable(p), L };
}

// The time the hand is free again after the last pick and the drop, and where it is then (taps at react + j * gap).
export function preTime(ctx, order, react, gap) {
  let ready = 0, px = HOME.x, py = HOME.y;
  if (ctx.sweep) {
    const cx = ctx.stones.reduce((a, s) => a + s.x, 0) / ctx.stones.length, cy = ctx.stones.reduce((a, s) => a + s.y, 0) / ctx.stones.length;
    ready = react + legTime(dist(px, py, cx, cy)) + SWEEP_DWELL; px = cx; py = cy;
  } else {
    for (let j = 0; j < order.length; j++) {
      const s = order[j];
      ready = Math.max(react + j * gap, ready) + legTime(dist(px, py, s.x, s.y)) + DWELL; px = s.x; py = s.y;
    }
  }
  if (ctx.dir === 'in') { ready += legTime(dist(px, py, PIT.x, PIT.y)) + DROP_DWELL; px = PIT.x; py = PIT.y; } else ready += REL_DWELL;
  return { ready, px, py };
}

function perms(items, k, out = [], cur = [], used = []) {
  if (cur.length === k) { out.push(cur.slice()); return out; }
  for (let i = 0; i < items.length; i++) { if (used[i]) continue; used[i] = true; cur.push(items[i]); perms(items, k, out, cur, used); cur.pop(); used[i] = false; }
  return out;
}
function candidatePool(ctx) {
  const k = ctx.take, m = k <= 1 ? 10 : k === 2 ? 8 : k === 3 ? 7 : 6;
  const cost = (s) => dist(HOME.x, HOME.y, s.x, s.y) + dist(s.x, s.y, ctx.dir === 'in' ? PIT.x : HOME.x, ctx.dir === 'in' ? PIT.y : HOME.y);
  return ctx.stones.slice().sort((a, b) => cost(a) - cost(b)).slice(0, Math.max(k, m));
}

// All sensible plans scored with the real timeline: the chance the hand is back in time (over a spread of landing
// spots) times the chance the catch tap is inside the window. Sorted best first.
export function rankPlans(ctx, lvl) {
  const out = [];
  const sig = (h) => tSigma(lvl, h);
  const orders = ctx.sweep ? [ctx.stones] : perms(candidatePool(ctx), ctx.take);
  for (const order of orders) {
    const pre = preTime(ctx, order, lvl.react, lvl.gap);
    for (const h of H_GRID) {
      const T = airtime(h);
      let ok = 0, sum = 0;
      for (const r of ROLLS) {
        const L = landing(h, r);
        const tb = pre.ready + legTime(dist(pre.px, pre.py, L.x, L.y));
        sum += tb;
        if (T - tb >= lvl.margin * 0.3) ok++;
      }
      const pTime = ok / ROLLS.length, pc = pCatch(sig(h), h);
      out.push({ ids: order.map((s) => s.id), h, p: pTime * pc, pTime, pCatch: pc, tBack: sum / ROLLS.length, ready: pre.ready });
    }
  }
  out.sort((a, b) => b.p - a.p || a.h - b.h);
  return out;
}

// The computer's choice for a toss: lower levels pick among the top few (pick) and then misjudge the height.
export function planToss(ctx, lvl, rng) {
  const ranked = rankPlans(ctx, lvl);
  const seen = new Set(), pool = [];
  for (const r of ranked) { const key = `${r.ids.join()}`; if (seen.has(key)) continue; seen.add(key); pool.push(r); if (pool.length >= 1 + Math.round(lvl.pick * 3)) break; }
  const w = pool.map((r, i) => Math.exp(-i * lvl.pick * 0.9) * (0.2 + r.p));
  let x = rng.next() * w.reduce((a, b) => a + b, 0), choice = pool[0];
  for (let i = 0; i < pool.length; i++) { x -= w[i]; if (x <= 0) { choice = pool[i]; break; } }
  return { ranked, plan: choice, cands: pool };
}

// Everything the computer does in one toss, decided up front: the height it holds, the taps and their times, the catch tap.
export function aiToss(ctx, lvl, rng) {
  const { plan, ranked, cands } = planToss(ctx, lvl, rng);
  const h = clamp(plan.h + gauss(rng) * lvl.hErr, H_MIN, 1);
  const taps = [];
  let t = lvl.react + gauss(rng) * lvl.jit;
  const ids = ctx.sweep ? [ctx.stones[0].id] : plan.ids;
  ids.forEach((id, j) => {
    let pick = id;
    if (!ctx.sweep && rng.next() < lvl.slip) {
      const others = ctx.stones.filter((s) => !ids.includes(s.id) && !taps.some((q) => q.id === s.id));
      if (others.length) pick = others[rng.int(others.length)].id;
    }
    if (j > 0) t += lvl.gap + gauss(rng) * lvl.jit;
    taps.push({ t: Math.max(taps.length ? taps[taps.length - 1].t + 0.04 : 0.05, t), id: pick });
  });
  const eps = gauss(rng) * tSigma(lvl, h) + 0.01;
  return { plan, ranked, cands, h, taps, eps };
}

// ---- a whole turn, headless (calibration and tests; the game itself runs the same decisions with animation) ----
export function playTurn(mode, p, lvl, rng, out = { tosses: 0, faults: 0 }) {
  for (let guard = 0; guard < 200 && !playerDone(mode, p); guard++) {
    const roll = newRoll(rng);
    const probe = tossCtx(mode, p);
    const a = aiToss(probe, lvl, rng);
    const L = landing(a.h, roll), T = airtime(a.h);
    const ctx = { ...probe, L };
    const ev = planLegs(ctx, a.taps);
    const res = catchResult(ev, T, a.h, a.eps);
    out.tosses++;
    if (!res.ok) { out.faults++; return out; }
    const ids = ev.picks.map((q) => q.id);
    const spots = p.dir === 'out' ? dropSpots(rng, ids.length, p.ground) : null;
    applyToss(mode, p, ids, spots);
  }
  return out;
}

export function playMatch(lvlA, lvlB, mode, rng, maxTurns = 800) {
  const ps = [freshPlayer(mode), freshPlayer(mode)];
  const lv = [lvlA, lvlB], stat = { tosses: 0, faults: 0 };
  let turns = 0;
  for (; turns < maxTurns; turns++) {
    const who = turns % 2;
    playTurn(mode, ps[who], lv[who], rng, stat);
    if (playerDone(mode, ps[who])) return { winner: who, turns, tosses: stat.tosses, faults: stat.faults };
  }
  return { winner: -1, turns, tosses: stat.tosses, faults: stat.faults };
}
void MODES; void stageCount;
