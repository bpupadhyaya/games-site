// The computer players. Five levels, calibrated by simulation (tools in STATUS.md): each level beats the one below.
// The same planner (at full skill) gives the Think hint, so the hint is always something the engine verified.
import {
  R, HOME, FIELD, DEV, STAGES, SET_MIN_HOME, CHARGE_SECS, H_MIN, KK, FLICK_T, airtime, clamp, dist,
  evaluateRound, newRoll, catchResult, scatterStones, clusterAt, clampSpot, kkToss, kkBest, kkCatch, flickKept, hasScatter, winScale,
} from './sim.js';

export const LEVELS = [
  { id: 1, name: 'Sprout', ko: '새싹', stars: 1, see: 0.30, pick: 1.6, hErr: 0.17, tErr: 0.125, margin: 0.18, kkT: 0.085, kkPos: 52, flickT: 0.15, tosser: 0.25, hold: 0.55 },
  { id: 2, name: 'Pebble', ko: '조약돌', stars: 2, see: 0.55, pick: 1.0, hErr: 0.12, tErr: 0.095, margin: 0.14, kkT: 0.065, kkPos: 40, flickT: 0.11, tosser: 0.45, hold: 0.58 },
  { id: 3, name: 'Stream', ko: '시냇물', stars: 3, see: 0.78, pick: 0.55, hErr: 0.08, tErr: 0.07, margin: 0.10, kkT: 0.048, kkPos: 29, flickT: 0.08, tosser: 0.7, hold: 0.6 },
  { id: 4, name: 'Mountain', ko: '산', stars: 4, see: 0.93, pick: 0.25, hErr: 0.045, tErr: 0.045, margin: 0.07, kkT: 0.032, kkPos: 20, flickT: 0.055, tosser: 0.9, hold: 0.62 },
  { id: 5, name: 'Master', ko: '달인', stars: 5, see: 1, pick: 0.05, hErr: 0.02, tErr: 0.025, margin: 0.05, kkT: 0.018, kkPos: 11, flickT: 0.03, tosser: 1, hold: 0.62 },
];
export const PERFECT = { see: 1, pick: 0.0001, hErr: 0, tErr: 0.025, margin: 0.05, kkT: 0.018, kkPos: 8, flickT: 0.03, tosser: 1, hold: 0.62 };
export const TAGS = {
  en: ['Just learning', 'Steady hands', 'Clean and calm', 'Sharp and quick', 'Rarely drops one'],
  ko: ['이제 막 배우는 중', '차분한 손', '깔끔하고 침착', '날쌘 손놀림', '좀처럼 놓치지 않는 달인'],
};

// ---- numbers ------------------------------------------------------------------------------------
const gauss = (rng) => (rng.next() + rng.next() + rng.next() + rng.next() - 2) * 1.7;       // ~ N(0, 1)
const cdf = (x) => { const t = 1 / (1 + 0.2316419 * Math.abs(x)); const d = 0.3989423 * Math.exp(-x * x / 2); const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274)))); return x > 0 ? 1 - p : p; };
export const tSigma = (lvl, h) => lvl.tErr * (0.7 + 0.6 * h);
// chance that a tap with error N(0, sigma) lands in the catch window for toss height h
export function pCatch(sigma, h) {
  const s = winScale(h), e = -0.18 * s, l = 0.22 * s;
  return clamp(cdf(l / sigma) - cdf(e / sigma), 0, 1);
}
const ROLLS = [];
for (const u of [0.25, 0.6, 1]) for (let k = 0; k < 6; k++) ROLLS.push({ ang: (k / 6) * Math.PI * 2 + 0.3, u });
const H_GRID = [0.3, 0.38, 0.46, 0.54, 0.62, 0.7, 0.78, 0.86, 0.94, 1];

function perms(ids, k, out = [], cur = []) {
  if (cur.length === k) { out.push(cur.slice()); return out; }
  for (const id of ids) if (!cur.includes(id)) { cur.push(id); perms(ids, k, out, cur); cur.pop(); }
  return out;
}

// All the ways to take `take` stones, scored with the real timeline: chance the hand is back in time (over a spread of
// landing spots) times the chance the catch tap is inside the window.
export function rankPlans(mat, rd, lvl) {
  const out = [];
  const sig = (h) => tSigma(lvl, h);
  if (rd.kind === 'take') {
    for (const order of perms(mat.map((s) => s.id), rd.take)) {
      const base = evaluateRound(mat, rd, { targets: order, h: 1 }, ROLLS[0]);
      for (const h of H_GRID) {
        let ok = 0;
        for (const r of ROLLS) { const ev = evaluateRound(mat, rd, { targets: order, h }, r); if (!ev.fault && ev.margin >= lvl.margin * 0.3) ok++; }
        const pTime = ok / ROLLS.length, pc = pCatch(sig(h), h);
        out.push({ targets: order, h, p: pTime * pc, pTime, pCatch: pc, clip: !!base.fault });
      }
    }
  } else if (rd.kind === 'set') {
    const spots = [{ x: HOME.x, y: HOME.y - SET_MIN_HOME }, { x: HOME.x - 150, y: HOME.y - SET_MIN_HOME - 20 }, { x: HOME.x + 150, y: HOME.y - SET_MIN_HOME - 20 }];
    for (const spot of spots) for (const h of H_GRID) {
      let ok = 0;
      for (const r of ROLLS) { const ev = evaluateRound(mat, rd, { spot, h }, r); if (!ev.fault && ev.margin >= lvl.margin * 0.3) ok++; }
      out.push({ spot, h, p: (ok / ROLLS.length) * pCatch(sig(h), h), pTime: ok / ROLLS.length, pCatch: pCatch(sig(h), h), clip: false });
    }
  } else {
    for (const h of H_GRID) {
      let ok = 0;
      for (const r of ROLLS) { const ev = evaluateRound(mat, rd, { h }, r); if (!ev.fault && ev.margin >= lvl.margin * 0.3) ok++; }
      out.push({ h, p: (ok / ROLLS.length) * pCatch(sig(h), h), pTime: ok / ROLLS.length, pCatch: pCatch(sig(h), h), clip: false });
    }
  }
  out.sort((a, b) => b.p - a.p);
  return out;
}

// The computer's choice for a round. Lower levels miss clipped routes (see), pick among the top few (pick) and
// then hold the toss pad with a wobble (hErr).
export function planRound(mat, rd, lvl, rng) {
  const ranked = rankPlans(mat, rd, PERFECT_LIKE(lvl));
  let pool = ranked;
  if (lvl.see < 1 && rng.next() > lvl.see) {
    // does not notice the brush: ranks on speed alone
    pool = ranked.map((r) => ({ ...r, p: r.clip ? r.pTime : r.p })).sort((a, b) => b.p - a.p);
  }
  const top = pool.slice(0, Math.max(1, Math.round(1 + lvl.pick * 3)));
  const w = top.map((r, i) => Math.exp(-i * lvl.pick * 0.9) * (0.2 + r.p));
  let x = rng.next() * w.reduce((a, b) => a + b, 0), choice = top[0];
  for (let i = 0; i < top.length; i++) { x -= w[i]; if (x <= 0) { choice = top[i]; break; } }
  return choice;
}
const PERFECT_LIKE = (lvl) => ({ ...lvl });

// the toss height the computer actually produces (it holds the pad a little too short or long)
export const executeHeight = (h, lvl, rng) => clamp(h + gauss(rng) * lvl.hErr, H_MIN, 1);
export const executeEps = (h, lvl, rng) => gauss(rng) * tSigma(lvl, h) + 0.01;

// ---- the opening: scatter and the stone to hold ---------------------------------------------------
export const scatterChoice = (lvl, rng, stage) => {
  const spread = stage === 1 ? 165 : stage === 2 ? 150 : 150;
  return { cx: HOME.x + gauss(rng) * (8 + 28 * lvl.pick), cy: 360 + gauss(rng) * (10 + 40 * lvl.pick), spread: clamp(spread + gauss(rng) * (10 + 55 * lvl.pick), 90, 260) };
};

// Which stone to keep in hand and toss: for each candidate, the chance of clearing the whole stage if we then play well.
export function stageValue(mat5, hold, stage, lvl) {
  let mat = mat5.filter((s) => s.id !== hold), p = 1;
  for (const rd of STAGES[stage - 1].rounds) {
    if (rd.kind !== 'take') continue;
    const r = rankPlans(mat, rd, lvl)[0];
    p *= r.p; mat = mat.filter((s) => !r.targets.includes(s.id));
  }
  return p;
}
export function chooseHold(mat5, stage, lvl, rng) {
  const vals = mat5.map((s) => ({ id: s.id, v: stageValue(mat5, s.id, stage, lvl) }));
  vals.sort((a, b) => b.v - a.v);
  if (rng.next() < lvl.tosser) return { id: vals[0].id, values: vals };
  return { id: mat5[rng.int(mat5.length)].id, values: vals };
}

// ---- kkeokki ---------------------------------------------------------------------------------------
export const kkHeight = (lvl, rng) => clamp(lvl.hold + gauss(rng) * lvl.hErr, H_MIN, 1);
export function kkTap(toss, lvl, rng) {
  const b = kkBest(toss);
  return { t: b.t - 0.02 + gauss(rng) * lvl.kkT, x: b.x + gauss(rng) * lvl.kkPos, y: b.y + gauss(rng) * lvl.kkPos, best: b };
}

// ---- a whole turn, headless (calibration and tests; the game itself runs the same decisions with animation) ----
export function playTurn(match, who, lvl, rng) {
  const out = { points: 0, stageStart: match.stage[who], faults: 0, cleared: 0 };
  let stage = match.stage[who];
  while (stage <= 5) {
    if (stage === 5) {
      const toss = kkToss(kkHeight(lvl, rng), rng);
      const tp = kkTap(toss, lvl, rng);
      const got = kkCatch(toss, tp.t, tp.x, tp.y).caught.length;
      const kept = flickKept(got, got ? gauss(rng) * lvl.flickT : null);
      out.points = kept; out.kk = [got, kept];
      match.scores[who] += kept; match.stage[who] = 1;
      return out;
    }
    let mat = [];
    let hold = 0;
    if (hasScatter(stage)) {
      const sc = scatterChoice(lvl, rng, stage);
      const five = scatterStones(rng, sc.cx, sc.cy, sc.spread);
      hold = chooseHold(five, stage, lvl, rng).id;
      mat = five.filter((s) => s.id !== hold);
    } else mat = [0, 1, 2, 3, 4].filter((i) => i !== 0).map((id, k) => ({ id, x: HOME.x, y: HOME.y, rot: k }));
    let failed = false;
    for (const rd of STAGES[stage - 1].rounds) {
      const plan = planRound(mat, rd, lvl, rng);
      const h = executeHeight(plan.h, lvl, rng);
      const full = { targets: plan.targets, h, spot: plan.spot };
      const ev = evaluateRound(mat, rd, full, newRoll(rng));
      const res = catchResult(ev, ev.fault ? null : executeEps(h, lvl, rng));
      if (!res.ok) { failed = true; out.faults++; break; }
      if (rd.kind === 'set') mat = clusterAt(plan.spot.x, plan.spot.y, [1, 2, 3, 4]);
      else if (rd.kind === 'take') mat = mat.filter((s) => !plan.targets.includes(s.id));
      else mat = [];
    }
    if (failed) { match.stage[who] = stage; return out; }
    out.cleared++; stage++; match.stage[who] = stage;
  }
  return out;
}

export function playMatch(lvlA, lvlB, target, rng, maxTurns = 400) {
  const m = { scores: [0, 0], stage: [1, 1], turns: 0 };
  const lv = [lvlA, lvlB];
  for (let n = 0; n < maxTurns; n++) {
    for (let w = 0; w < 2; w++) playTurn(m, w, lv[w], rng);
    m.turns++;
    if ((m.scores[0] >= target || m.scores[1] >= target) && m.scores[0] !== m.scores[1]) break;
  }
  return { winner: m.scores[0] > m.scores[1] ? 0 : m.scores[1] > m.scores[0] ? 1 : -1, scores: m.scores, turns: m.turns };
}
void R; void FIELD; void DEV; void CHARGE_SECS; void KK; void FLICK_T; void airtime; void dist;
