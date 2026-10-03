// Computer brains: bowling plan, batting shot choice, run decisions and the Think hints. Everything is deterministic given the rng handed in.
// Analysis uses a private fixed-seed rng so asking "what would the AI do" (Think, Watch & Learn) never disturbs the match's own random streams.
import { PITCH, clamp, lerp, RUN_LEN, MATE, LEVELS, DEG } from './core.js';
import { DELIVERIES, DELIVERY_KEYS, SPEED, makeSpec, flyDelivery, resolveSwing, idealAngle, shotName, flyBall } from './ball.js';
import { evalShot, safeRuns } from './field.js';

export function localRng(seed = 7) {
  let a = seed >>> 0;
  const next = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  return { next, range: (lo, hi) => lo + (hi - lo) * next(), int: (n) => Math.floor(next() * n), chance: (p) => next() < p, pick: (arr) => arr[Math.floor(next() * arr.length)] };
}
const STUB = { next: () => 0.5, range: (lo, hi) => (lo + hi) / 2, chance: (p) => p >= 0.5, pick: (x) => x[0], int: () => 0 };
const gauss = (r) => (r.next() + r.next() + r.next() - 1.5) * 2;

export const RUN_TIME = 0.225 + RUN_LEN / 7.3;   // seconds for one run (see sim.js runDist)

// ---- bowling ---------------------------------------------------------------------------------------------------------
const LENGTHS = {
  yorker: { z: [0.7, 1.4], w: 0.8, name: 'a yorker, right at the toes' },
  full: { z: [1.8, 3.2], w: 1.5, name: 'full' },
  good: { z: [3.6, 5.6], w: 2.8, name: 'a good length' },
  short: { z: [6.2, 8.0], w: 1.2, name: 'short' },
  bouncer: { z: [8.4, 9.8], w: 0.6, name: 'a high bouncing ball' },
};
export const lengthWord = { fulltoss: 'a full toss', yorker: 'a yorker', full: 'full', good: 'a good length', short: 'short', bouncer: 'a bouncer' };
export const lineWord = (x) => (x < -0.3 ? 'on the legs' : x < 0.25 ? 'on the stumps' : x < 0.8 ? 'just outside off' : x < 1.3 ? 'wide of off' : 'well wide');

// ctx: { level (bowling side's level object), inn { balls, maxBalls, runs, target }, recent: [types], zoneRuns?: [..] }
export function planDelivery(ctx, rng) {
  const lvl = ctx.level;
  const f = ctx.inn.maxBalls ? ctx.inn.balls / ctx.inn.maxBalls : 0;
  const w = { good: LENGTHS.good.w, full: LENGTHS.full.w, short: LENGTHS.short.w, yorker: LENGTHS.yorker.w, bouncer: LENGTHS.bouncer.w };
  if (f > 0.7) { w.yorker += 1.4; w.good *= 0.8; }
  if (f < 0.3) { w.good += 0.8; w.yorker *= 0.5; }
  const last = ctx.recent[ctx.recent.length - 1];
  if (last && w[last]) w[last] *= 0.4;
  if (lvl.iq < 0.3) { w.good += 1.5; w.bouncer += 0.5; }   // loose bowlers wander
  const keys = Object.keys(w);
  let tot = 0; keys.forEach((k) => { tot += w[k]; });
  let r = rng.next() * tot, len = keys[0];
  for (const k of keys) { r -= w[k]; if (r <= 0) { len = k; break; } }
  const L = LENGTHS[len];
  const typeW = { straight: 2, swerveIn: 1.2, swerveOut: 1.2 };
  let tt = 0; for (const k of DELIVERY_KEYS) tt += typeW[k];
  let rr = rng.next() * tt, type = 'straight';
  for (const k of DELIVERY_KEYS) { rr -= typeW[k]; if (rr <= 0) { type = k; break; } }
  let bx = rng.range(-0.25, 0.5);
  if (type === 'swerveIn') bx += 0.15; else if (type === 'swerveOut') bx -= 0.1;
  let why = '';
  const zr = ctx.zoneRuns;
  if (zr && lvl.iq > 0.3) {
    const tot2 = zr[0] + zr[1] + 0.001;
    if (zr[1] / tot2 > 0.6 && tot2 > 6) { bx -= 0.4 * lvl.iq; why = 'The batter keeps scoring on the off side: bowling straighter.'; }
    else if (zr[0] / tot2 > 0.6 && tot2 > 6) { bx += 0.4 * lvl.iq; why = 'The batter keeps scoring on the leg side: bowling wider.'; }
  }
  const aim = { bx, bz: rng.range(L.z[0], L.z[1]), speed: rng.range(13.2, 18.6) };
  if (len === 'yorker' || len === 'bouncer') aim.speed = rng.range(15.5, 19);
  const spec = makeSpec(type, aim, rng, lvl.acc);
  return { spec, len, type, why, aim };
}

// A hint for the human bowler: where to land it and how.
export function bowlHint(ctx) {
  const rng = localRng(11);
  const pl = planDelivery({ ...ctx, level: { ...ctx.level, acc: 0, iq: 1 } }, rng);
  const D = DELIVERIES[pl.type];
  const lines = [];
  lines.push(`Try ${D.name.toLowerCase()}: ${D.cue.toLowerCase()}`);
  lines.push(`Aim to pitch ${LENGTHS[pl.len].name}, ${lineWord(pl.aim.bx)}. Swipe ${pl.len === 'yorker' ? 'a long way up the screen' : pl.len === 'bouncer' || pl.len === 'short' ? 'a short flick' : 'a medium flick'}.`);
  lines.push(pl.why || (ctx.inn.balls / Math.max(1, ctx.inn.maxBalls) > 0.65 ? 'Late in the innings the batter must hit: bowl full and straight.' : 'Mix up length and line so the batter cannot settle.'));
  return { lines, aim: pl.aim, type: pl.type };
}

// ---- batting -----------------------------------------------------------------------------------------------------------
export function wicketValue(inn) {
  const rrr = inn.target != null ? ((inn.target - inn.runs) / Math.max(1, inn.maxBalls - inn.balls)) : 1.3;
  const left = inn.maxWk - inn.wk;
  const ballsLeft = Math.max(0, inn.maxBalls - inn.balls);
  return clamp(2.2 + 0.14 * ballsLeft + (left <= 1 ? 1.5 : 0) - Math.max(0, rrr - 1.5) * 2.2, 0.8, 7);
}

// ctx: { fielders (analysis list), lvl (batting side's level), inn, runTime }. skillOver forces a skill (Think uses 1).
export function planBat(ctx, d, rng, skillOver = null) {
  const skill = skillOver ?? ctx.lvl.skill;
  const inn = ctx.inn;
  const phi = idealAngle(d.xc, d.yc, d.bounced);
  const wv = wicketValue(inn);
  const need = inn.target != null ? ((inn.target - inn.runs) / Math.max(1, inn.maxBalls - inn.balls)) : 1.3;
  const sigma0 = lerp(0.1, 0.03, skill);
  const cands = [];
  const evalOne = (a, pw, terr) => {
    const res = resolveSwing(d, { kind: 'swing', t: d.tC - 0.05 + terr, angle: a, power: pw }, STUB, 1);
    if (!res.contact) return { value: d.bowled ? -wv : 0, runs: 0, boundary: 0, caught: 0, pOut: d.bowled ? 1 : 0, res, miss: true };
    const track = flyBall(res.init);
    const ev = evalShot(track, ctx.fielders, ctx.runTime ?? RUN_TIME, 0.3);
    const runsEff = ev.boundary ? ev.boundary : ev.runs;
    let pOut = ev.caught;
    if (res.kind === 'edge' && !ev.boundary && !ev.caught) pOut = Math.max(pOut, 0.3);
    return { value: runsEff - wv * pOut, runs: ev.runs, boundary: ev.boundary, caught: ev.caught, pOut, res, ev };
  };
  for (let a = phi - 44; a <= phi + 44.1; a += 11) {
    for (const pw of [0.3, 0.55, 0.75, 1.0]) {
      const c = evalOne(a, pw, 0);
      if (c.miss) continue;
      cands.push({ a, pw, ...c });
    }
  }
  cands.sort((x, y) => y.value - x.value);
  const sig = [-1.6, -0.8, 0, 0.8, 1.6], wts = [0.1, 0.25, 0.3, 0.25, 0.1];
  const sigA = lerp(15, 3, skill), sigAE = 5, sigmaE = 0.05;
  const aoff = [-1, 0, 1], aw = [0.27, 0.46, 0.27];
  for (const c of cands.slice(0, 6)) {
    let v = 0, po = 0;
    sig.forEach((k, j) => aoff.forEach((ao, q) => { const r = evalOne(c.a + ao * sigAE, c.pw, k * sigmaE); const w = wts[j] * aw[q]; v += r.value * w; po += r.pOut * w; }));
    c.value = v; c.pOut = po;
  }
  cands.sort((x, y) => y.value - x.value);
  const noise = (1 - skill) * 2.2;
  let best = null;
  for (const c of cands.slice(0, 6)) { const v = c.value + gauss(rng) * noise * 0.5; if (!best || v > best.v) best = { v, c }; }
  const wideBall = d.xc > 1.45 || d.yc > 2.0 || d.xc < -1.1;
  const blockValue = 0.1 + (d.lengthClass === 'yorker' ? 0.6 : 0) + (need < 0.9 ? 0.4 : 0) - (need > 1.8 ? 1.0 : 0);
  const leaveValue = wideBall && !d.bowled ? 0.4 : -99;
  const bestV = best ? best.c.value : -99;
  let kind = 'swing', angle = phi, power = 0.55;
  const reasons = [];
  reasons.push(`The ball: ${lengthWord[d.lengthClass] ?? d.lengthClass}, ${lineWord(d.xc)}.`);
  if (leaveValue > bestV && leaveValue > blockValue) { kind = 'leave'; reasons.push(wideBall ? 'Too wide or too high to hit safely: leave it alone.' : 'Nothing to hit.'); }
  else if (!best || blockValue > bestV) { kind = 'block'; reasons.push(d.lengthClass === 'yorker' ? 'A yorker at the toes: dig it out.' : 'No scoring shot is worth the risk here: defend.'); }
  else {
    const c = best.c;
    angle = c.a; power = c.pw;
    const near = nearestFielder(ctx.fielders, c.ev && c.ev.plan && c.ev.plan.pos);
    const shot = shotName(c.res.angle, c.res.elev, d, 'hit');
    const dirWord = Math.abs(angle) < 18 ? 'straight' : angle > 0 ? 'to the off side' : 'to the leg side';
    reasons.push(c.boundary ? `A gap ${dirWord}: nobody can stop it, a ${c.boundary}.` : c.runs ? `The field is thin ${dirWord}: ${c.runs} safe run${c.runs > 1 ? 's' : ''} are there.` : `Closed field ${dirWord}${near ? '; ' + near + ' is close' : ''}: keep it down.`);
    reasons.push(`Shot: ${shot}, ${power > 0.75 ? 'hard and in the air' : power > 0.45 ? 'firm, along the ground' : 'a soft push'}. Chance of being caught about ${Math.round(c.pOut * 100)} percent.`);
    reasons.push(inn.target != null ? `The chase needs ${(need * 6).toFixed(1)} an over: ${need > 1.6 ? 'attack' : need < 1.0 ? 'take no chances' : 'keep ticking over'}.` : 'Build the innings.');
  }
  let terr = clamp(gauss(rng) * sigma0, -0.15, 0.15);
  angle += gauss(rng) * sigA * 0.6;
  if (kind === 'swing' && power > 0.8) terr *= 1.2;
  return {
    kind, angle: clamp(angle, -170, 170), power, terr, reasons, skill,
    best: best ? { angle: best.c.a, power: best.c.pw, runs: best.c.runs, boundary: best.c.boundary, pOut: best.c.pOut } : null,
    top: cands.slice(0, 5).map((c) => ({ angle: c.a, power: c.pw, runs: c.runs, boundary: c.boundary, value: c.value })),
  };
}

function nearestFielder(fielders, pos) {
  if (!pos) return null;
  let b = null, bd = 99;
  for (const f of fielders) { const d = Math.hypot(f.x - pos[0], f.z - pos[2]); if (d < bd) { bd = d; b = f; } }
  return b ? b.name : null;
}

// Think hint for the batter BEFORE the ball.
export function batHint(ctx, d) {
  const plan = planBat(ctx, d, localRng(3), 1);
  const lines = [...plan.reasons];
  if (plan.kind === 'swing') lines.push(`Swipe ${plan.angle > 12 ? 'toward the off side (right)' : plan.angle < -12 ? 'toward the leg side (left)' : 'straight up'}, ${plan.power > 0.75 ? 'a fast flick to go in the air' : plan.power > 0.45 ? 'a firm swipe' : 'a gentle drag'}, just as the ball reaches the bat.`);
  else if (plan.kind === 'block') lines.push('Defend this one: a quick tap.');
  else lines.push('Leave it alone: do not swipe.');
  return { lines, plan };
}

// ---- running -------------------------------------------------------------------------------------------------------------
// Whether the next run is safe. a = { holdT (seconds until the ball is first held), hx, hz (where), fromEnd (the end the runner would run to), start (seconds
// before the runners could be off), margin, who }.
export function runAdvice(a) {
  const to = a.toEnd, endZ = to === 0 ? 0 : PITCH;
  const finish = a.start + RUN_TIME;
  const thr = Math.hypot(a.hx, a.hz - endZ);
  const arrive = a.holdT + 0.3 + 0.18 + thr / 25;
  const slack = arrive - finish;
  const ok = slack >= a.margin;
  const text = ok
    ? `${a.who} gets to the ball in ${a.holdT.toFixed(1)} s and the throw needs ${(arrive - a.holdT).toFixed(1)} s more. A run takes ${finish.toFixed(1)} s. Safe by ${slack.toFixed(1)} s: RUN.`
    : `${a.who} gets to the ball in ${a.holdT.toFixed(1)} s and the throw needs ${(arrive - a.holdT).toFixed(1)} s more. A run takes ${finish.toFixed(1)} s: too tight. HOLD.`;
  return { act: ok ? 'run' : 'hold', slack, arrive, finish, text };
}

export function runMargin(lvl, inn) {
  const need = inn.target != null ? ((inn.target - inn.runs) / Math.max(1, inn.maxBalls - inn.balls)) : 1.3;
  const aggr = clamp(0.4 + (need - 1.3) / 2, 0.1, 0.9);
  return lerp(0.36, 0.04, aggr) + (1 - lvl.iq) * 0.2;
}

export const levelOf = (i) => LEVELS[clamp(i, 0, LEVELS.length - 1)];
export { MATE, DEG, SPEED };
