// The computer players. Shots are chosen by trying many candidate deliveries on the real physics (a draw, a guard, a
// freeze, a tap, a takeout, a peel; in-turn and out-turn), scoring the board each one leaves, and picking the best.
// Levels differ in how clean their delivery is, how well they sweep, how many ideas they consider, and how much of the
// strategy (guards, the last stone, protecting the shot stone) they understand.
import {
  H, R, HOUSE_R, HALF_W, HOG_FAR, solveShot, V_MAX, cloneWorld, launch, settleWorld, inGuardZone, inHouse, scoreEnd, toButton, predictStone, clamp, dist, stepWorld,
} from './sim.js';
import { WEIGHTS, stonesLeft, other, protectedIds, snapshotStones, resolveShot } from './match.js';
import { throwNoise, applyNoise } from './noise.js';

// sigV / sigA: raw wobble of the delivery. sweep: how well the sweepers read the stone (0..1).
export const PROFILES = [
  { id: 'louise', name: 'Louise', tag: 'Gentle and patient', stars: 1, sigV: 0.034, sigA: 0.0050, sweep: 0.25, breadth: 14, blunder: 0.22, samples: 1, strat: 0, think: [1.2, 2.2] },
  { id: 'pierre', name: 'Pierre', tag: 'Loves a big takeout', stars: 2, sigV: 0.024, sigA: 0.0036, sweep: 0.45, breadth: 40, blunder: 0.14, samples: 1, strat: 1, think: [1.0, 2.0] },
  { id: 'nora', name: 'Nora', tag: 'Steady all-rounder', stars: 3, sigV: 0.019, sigA: 0.0028, sweep: 0.62, breadth: 999, blunder: 0.10, samples: 2, strat: 2, think: [1.0, 2.4] },
  { id: 'gus', name: 'Gus', tag: 'Reads the guards', stars: 4, sigV: 0.013, sigA: 0.002, sweep: 0.85, breadth: 999, blunder: 0.05, samples: 3, strat: 3, depth: 0, think: [1.4, 2.4] },
  { id: 'marguerite', name: 'Marguerite', tag: 'Rarely misses', stars: 5, sigV: 0.007, sigA: 0.001, sweep: 0.97, breadth: 999, blunder: 0.0, samples: 4, strat: 4, depth: 0, think: [1.5, 2.6] },
];

// ---- candidate shots ------------------------------------------------------------------------------------------
const CLEAR = HALF_W - R - 0.12;
function addC(list, kind, x, y, w, name) {
  if (Math.abs(x) > CLEAR || y > 1.5 || y < HOG_FAR + 0.3) return;
  for (const turn of [1, -1]) list.push({ kind, x, y, w, turn, name });
}
export function genCandidates(w, team) {
  const c = [];
  for (const x of [-1.2, -0.8, -0.4, 0, 0.4, 0.8, 1.2]) for (const y of [-3.1, -3.9, -4.7]) addC(c, 'guard', x, y, 0, 'Guard');
  for (const x of [-1.2, -0.8, -0.4, 0, 0.4, 0.8, 1.2]) for (const y of [-1.5, -1.0, -0.5, 0, 0.45, 0.9]) addC(c, 'draw', x, y, 0, 'Draw');
  const foes = w.stones.filter((s) => s.mode === 'play' && s.team !== team && s.y > HOG_FAR + 0.2);
  const own = w.stones.filter((s) => s.mode === 'play' && s.team === team && s.y > HOG_FAR + 0.2);
  for (const s of foes) {
    for (const off of [0, -0.12, 0.12]) { addC(c, 'takeout', s.x + off, s.y, 2, 'Takeout'); addC(c, 'peel', s.x + off, s.y, 3, 'Peel'); }
    for (const off of [-0.14, 0.14]) addC(c, 'tap', s.x + off, s.y, 1, 'Tap');
    if (inHouse(s)) { addC(c, 'freeze', s.x, s.y - 2 * R - 0.01, 0, 'Freeze'); addC(c, 'freeze', s.x + 0.25, s.y - 0.22, 0, 'Freeze'); addC(c, 'freeze', s.x - 0.25, s.y - 0.22, 0, 'Freeze'); }
  }
  for (const s of own) if (inGuardZone(s)) addC(c, 'raise', s.x, s.y, 1, 'Raise');
  return c;
}

// ---- how good is the board for `me` --------------------------------------------------------------------------
const nearest = (w, t) => { let d = 2.2; for (const s of w.stones) if (s.mode === 'play' && s.team === t) d = Math.min(d, toButton(s)); return Math.min(d, 2.2); };
const houseCount = (w, t) => w.stones.reduce((n, s) => n + (s.mode === 'play' && s.team === t && inHouse(s) ? 1 : 0), 0);
const guardedLane = (w, s) => w.stones.some((q) => q.mode === 'play' && q.id !== s.id && inGuardZone(q) && Math.abs(q.x - s.x) < 0.42 && q.y < s.y);

// leftMe / leftOpp: stones each side still has to throw once the shot being judged is done.
export function evalBoard(w, me, m, strat, leftMe, leftOpp) {
  const opp = other(me), sc = scoreEnd(w);
  const left = (t) => (t === me ? Math.max(0, leftMe) : Math.max(0, leftOpp));
  let v = 0;
  const final = left(me) + left(opp) <= 0;
  if (sc.team !== null) {
    let pts = sc.pts;
    if (final && sc.team === m.hammer && pts === 1 && strat >= 3 && m.ends - m.end >= 1) pts = 0.62;     // a forced single gives up the last stone
    const progress = 1 - (left(me) + left(opp)) / (2 * m.fmt.perSide);
    const pw = strat >= 1 ? 0.3 + 0.7 * progress : 1;       // early in the end, lying shot is worth less than the shape of the end
    v += (sc.team === me ? 1 : -1) * pts * pw;
  }
  v += 0.2 * (nearest(w, opp) - nearest(w, me)) + 0.1 * (houseCount(w, me) - houseCount(w, opp));
  if (strat >= 1 && !final) {
    const iHaveLast = m.hammer === me;
    for (const s of w.stones) {
      if (!inGuardZone(s)) continue;
      const mine = s.team === me, centre = Math.abs(s.x) < 0.62;
      if (!iHaveLast) v += mine ? (centre ? 0.32 : 0.12) : (centre ? -0.05 : 0);
      else v += mine ? (centre ? -0.18 : 0.14) : (centre ? -0.28 : -0.05);
    }
  }
  if (strat >= 2 && !final && sc.team !== null) {
    const lead = sc.order[0];
    if (!guardedLane(w, lead)) { const exposure = 0.17 * Math.min(left(sc.team === me ? opp : me), 3); v += sc.team === me ? -exposure : exposure; }
  }
  if (strat >= 4 && !final && m.hammer === me && sc.team === me && sc.pts >= 2) v += 0.15 * (sc.pts - 1);
  return v;
}

// ---- the planner (spreads its work over frames) ----------------------------------------------------------------
export function createPlanner(w0, team, m, prof, rng, o = {}) {
  let cands = genCandidates(w0, team);
  if (!o.perfect && prof.breadth < cands.length) cands = rng.shuffle(cands).slice(0, prof.breadth);
  let out = [];
  let i = 0;
  const samples = o.perfect ? 5 : prof.samples;
  const sigV = o.perfect ? prof.sigV * 0.5 : prof.sigV, sigA = o.perfect ? prof.sigA * 0.5 : prof.sigA;
  const strat = o.perfect ? 4 : prof.strat;
  const leftMe = stonesLeft(m, team) - 1, leftOpp = stonesLeft(m, other(team));
  const depth = o.perfect ? 5 : prof.depth ?? 0;
  let phase = 1, refine = [], ri = 0;
  const planner = {
    done: false, result: null, total: cands.length,
    step(n = 6) {
      while (n-- > 0 && i < cands.length) {
        const c = cands[i++];
        const sol = solveShot(c.x, c.y, WEIGHTS[c.w].arrival, c.turn);
        if (!sol.ok) continue;
        let sum = 0;
        for (let k = 0; k < samples; k++) {
          const g = () => (rng.next() + rng.next() + rng.next() - 1.5) * 2;
          const nz = { dv: g() * sigV, dth: g() * sigA, fr: 1, cv: 1 };
          const res = simulate(m, w0, team, { v0: Math.min(V_MAX, sol.v0), theta: sol.theta, turn: c.turn }, nz);
          sum += evalBoard(res.w, team, m, strat, leftMe, leftOpp);
        }
        out.push({ ...c, score: sum / samples + rng.next() * 0.02, v0: sol.v0, theta: sol.theta });
      }
      if (phase === 1 && i >= cands.length) {
        out.sort((a, b) => b.score - a.score);
        if (depth > 0 && leftOpp > 0 && out.length > 1) { phase = 2; refine = out.slice(0, depth); ri = 0; }
        else finish();
      }
      if (phase === 2) {
        let k = Math.max(1, n < 0 ? 1 : 1);
        while (k-- > 0 && ri < refine.length) {
          const c = refine[ri++];
          const res = simulate(m, w0, team, { v0: Math.min(V_MAX, c.v0), theta: c.theta, turn: c.turn }, { dv: 0, dth: 0, fr: 1, cv: 1 });
          c.score1 = c.score;
          c.score = 0.4 * c.score + 0.6 * -bestReply(res.w, other(team), m, leftOpp, leftMe);
        }
        if (ri >= refine.length) { const rest = out.slice(refine.length); refine.sort((a, b) => b.score - a.score); out = [...refine, ...rest]; finish(); }
      }
      return planner.done;
    },
  };
  function finish() {
    let pick = out[0];
    if (!o.perfect && out.length > 1 && rng.next() < prof.blunder) pick = out[1 + rng.int(Math.min(4, out.length - 1))];
    const alts = [];
    for (const c of out) { if (c !== pick && !alts.some((a) => a.kind === c.kind) && alts.length < 3) alts.push(c); }
    planner.result = pick ? { ...pick, alts } : { kind: 'draw', x: 0, y: 0, w: 0, turn: 1, name: 'Draw', score: 0, alts: [] };
    planner.done = true;
    phase = 3;
  }
  return planner;
}

// The opponent's best single reply (by the same board judgement, from their side), with a clean delivery.
function bestReply(w, who, m, leftWho, leftOther) {
  const cs = genCandidates(w, who);
  let best = -9;
  for (const c of cs) {
    const sol = solveShot(c.x, c.y, WEIGHTS[c.w].arrival, c.turn);
    if (!sol.ok) continue;
    const res = simulate(m, w, who, { v0: Math.min(V_MAX, sol.v0), theta: sol.theta, turn: c.turn }, { dv: 0, dth: 0, fr: 1, cv: 1 });
    const v = evalBoard(res.w, who, m, 4, leftWho - 1, leftOther);
    if (v > best) best = v;
  }
  return best;
}

// One simulated delivery on a copy of the board (what the planner and the hint use).
function simulate(m, w0, team, p, nz) {
  const w = cloneWorld(w0);
  const pre = { protect: protectedIds(m, w, team), stones: snapshotStones(w) };
  launch(w, team, applyNoise(p, nz));
  settleWorld(w, null);
  resolveShot(m, w, pre);
  return { w };
}
export { simulate };

// ---- the sweepers --------------------------------------------------------------------------------------------
// Looks at where the stone will stop (or touch) with different sweeping and chooses an effort. Called a few times a
// second of stone time. Its judgement is only as good as profile.sweep.
export function sweepDecision(w, id, plan, prof, rng) {
  const tgt = plan;
  let best = 0, bd = 1e9;
  for (const e of [0, 0.35, 0.7, 1]) {
    const p = predictStone(w, id, e);
    if (!p) return 0;
    let d = dist(p.x, p.y, tgt.x, tgt.y);
    if (p.kind === 'out') d += 1.5;
    if (d < bd - 0.03) { bd = d; best = e; }
  }
  const slop = (1 - prof.sweep) * 0.9 * (rng.next() - 0.5);
  return clamp(best + slop, 0, 1);
}

// A shot executed headlessly (used by simulation tests and calibration): delivers with noise and sweeps the whole way.
export function deliver(m, w, team, plan, prof, nz, rng) {
  const p = applyNoise({ v0: Math.min(V_MAX, plan.v0), theta: plan.theta, turn: plan.turn }, nz);
  const s = launch(w, team, p);
  let eff = 0, cmd = 0, nextAt = w.t;
  const sw = { team, eff: 0 };
  let n = 0;
  let t0 = w.t;
  while (!w.settled && n++ < 4200) {
    if (s.mode === 'play' && w.t >= nextAt && s.y > -26) { cmd = sweepDecision(w, s.id, plan, prof, rng); nextAt = w.t + 0.35; }
    eff += clamp(cmd - eff, -4 * H, 4 * H);
    sw.eff = s.mode === 'play' && (s.vx !== 0 || s.vy !== 0) ? eff : 0;
    stepWorld(w, sw);
  }
  if (!w.settled) for (const q of w.stones) { q.vx = 0; q.vy = 0; }
  w.settled = true;
  return s;
}
void HOUSE_R;
