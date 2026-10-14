// The computer wrestlers and the coach. A driver turns the bout into a command every few hundredths of a second; the coach
// (bestIntent / explain) names the plan a player in the same spot would follow and says why, for Think and Watch & Learn.
//
// Three plans exist: BUILD (tug in time with the rival's swing so it grows), ROOT (hold still: steady your stance and win grip back)
// and THROW (lift the thumb now, toward the way the rival is leaning).
import { TUNE, len, unit, throwQuality } from './sim.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const TAU = Math.PI * 2;

export const PROFILES = [
  { name: 'Bobur', tag: 'A nervous newcomer', stars: 1, every: 0.34, noise: 0.55, defend: 0.1, sync: 0.4, thr: 0.5, shaky: 0.8, care: 0.2, tug: 0.7 },
  { name: 'Dilnoza', tag: 'Quick feet, loose grip', stars: 2, every: 0.24, noise: 0.38, defend: 0.25, sync: 0.58, thr: 0.55, shaky: 0.75, care: 0.35, tug: 0.8 },
  { name: 'Rustam', tag: 'Steady and patient', stars: 3, every: 0.16, noise: 0.24, defend: 0.45, sync: 0.76, thr: 0.6, shaky: 0.68, care: 0.55, tug: 0.9 },
  { name: 'Malika', tag: 'Reads every swing', stars: 4, every: 0.1, noise: 0.14, defend: 0.65, sync: 0.9, thr: 0.6, shaky: 0.62, care: 0.75, tug: 1 },
  { name: 'Sardor', tag: 'The champion', stars: 5, every: 0.07, noise: 0.07, defend: 0.8, sync: 0.97, thr: 0.6, shaky: 0.58, care: 0.9, tug: 1 },
];

// Where the rival's balance point will be `lead` seconds from now if nobody pulls on it (the spring swings it on).
export function predict(B, j, lead) {
  const s = B.side[j];
  let x = s.b.x, y = s.b.y, vx = s.v.x, vy = s.v.y;
  const kk = TUNE.K * (s.root ? TUNE.rootK : 1), dd = TUNE.D * (s.root ? TUNE.rootD : 1);
  const n = Math.max(1, Math.round(lead / 0.02)), h = lead / n;
  for (let k = 0; k < n; k++) { vx += (-kk * x - dd * vx) * h; vy += (-kk * y - dd * vy) * h; x += vx * h; y += vy * h; }
  return { x, y };
}

// The best throw the thumb could make this instant: direction and expected quality when it lands.
export function throwOption(B, i) {
  const j = 1 - i, op = B.side[j];
  const p = predict(B, j, TUNE.windup);
  const d = len(p) > 0.05 ? unit(p) : unit(op.b);
  if (len(d) === 0) return { d: { x: 1, y: 0 }, q: 0 };
  // quality is judged at the landing: the spring has moved the rival on, and so has the pull of their own thumb (ignored)
  const me = B.side[i];
  const lean = p.x * d.x + p.y * d.y;
  const v = op.v, mom = TUNE.momentum * clamp(v.x * d.x + v.y * d.y, -3, 3) * 0.4;
  const shaky = 0.5 * Math.max(0, len(me.b) - 0.45);
  void throwQuality;
  return { d, q: clamp(lean + mom - shaky + (op.wind ? 0.08 : 0), 0, 1.1) };
}

export const INTENTS = {
  build: { label: 'Build the swing', hint: 'tug the way the rival is swinging' },
  root: { label: 'Hold your ground', hint: 'keep your thumb still' },
  throw: { label: 'Throw now', hint: 'lift your thumb' },
};

// Decide a plan for side i. `p` carries the profile's taste (0..1); the coach uses neutral taste.
export function bestIntent(B, i, taste = { thr: 0.62, shaky: 0.62, care: 0.7 }, ctx = {}) {
  const me = B.side[i], op = B.side[1 - i];
  const left = B.limit - B.t;
  const behind = me.pts < op.pts, level = me.pts === op.pts;
  const urgent = left < 12 && (behind || (level && !B.golden)) || B.golden;
  const th = throwOption(B, i);
  const need = urgent ? Math.max(0.5, taste.thr - 0.12) : taste.thr;
  if (me.rec > 0 || me.wind) return { intent: 'root', dir: { x: 0, y: 0 }, q: 0, why: 'recovering' };
  if (th.q >= need) return { intent: 'throw', dir: th.d, q: th.q, why: 'ready' };
  const defend = op.wind && ctx.defend !== false;
  const tired = ctx.resting === undefined ? me.grip < 0.25 : !!ctx.resting;
  if (defend || (len(me.b) > taste.shaky && op.mag > 0.3) || tired) {
    return { intent: 'root', dir: { x: 0, y: 0 }, q: th.q, why: defend ? 'their-throw' : tired ? 'grip' : 'shaky' };
  }
  // build: drive with the swing, or start one along the axis they already lean toward
  let d;
  const sp = len(op.v);
  if (sp > 0.45) d = unit(op.v);
  else if (len(op.b) > 0.15) d = unit(op.b);
  else d = { x: 1, y: 0 };
  return { intent: 'build', dir: d, q: th.q, why: sp > 0.45 ? 'swing' : len(op.b) > 0.15 ? 'lean' : 'start' };
}

export function explain(B, i, plan) {
  const op = B.side[1 - i], me = B.side[i];
  const q = Math.round(plan.q * 100);
  if (plan.intent === 'throw') {
    const grade = plan.q >= TUNE.halal ? 'a clean halal' : plan.q >= TUNE.yonbosh ? 'a yonbosh' : 'a chala';
    return { title: 'Throw now', reason: `The rival is leaning that way, far enough for ${grade} (about ${q}%). Lift your thumb after dragging that way; the throw lands a moment later, so do not wait for them to straighten.` };
  }
  if (plan.intent === 'root') {
    if (plan.why === 'their-throw') return { title: 'Hold your ground', reason: 'The rival has started a throw. Keep your thumb still: a steady stance pulls your balance point back to the centre and the throw fails.' };
    if (plan.why === 'grip') return { title: 'Hold your ground', reason: 'Your grip is nearly empty and a tired grip tugs weakly. Rest your thumb to win it back before you pull again.' };
    if (plan.why === 'recovering') return { title: 'Recover', reason: 'You are off your feet after a miss. Nothing you do counts until you are back on them, so keep still.' };
    return { title: 'Hold your ground', reason: `You are leaning ${Math.round(len(me.b) * 100)}% of the way to falling, and the rival is pulling. Hold still to steady yourself before you try anything.` };
  }
  if (plan.why === 'swing') return { title: 'Build the swing', reason: 'The rival is swinging. Drag the same way they are moving and each tug adds to the last, like pushing a swing. Aim to throw when the swing reaches its far end.' };
  if (plan.why === 'lean') return { title: 'Pull them further', reason: `The rival leans that way already (${Math.round(len(op.b) * 100)}%). Drag the same way to carry them further, then lift your thumb at the right moment.` };
  return { title: 'Start a swing', reason: 'The rival is standing square. A few firm tugs from side to side set their balance swinging; then you can ride it.' };
}

// A computer wrestler.
export function createDriver(profile, rng) {
  const d = { profile, rng, t: 0, saw: false, defend: true, resting: false, cmd: { x: 0, y: 0, release: false }, intent: null, hold: 0, plan: null, axis: rng.next() * TAU, side: 1 };
  d.cmd = (B, i, dt) => {
    d.t -= dt;
    if (d.hold > 0) d.hold -= dt;
    const me = B.side[i];
    if (B.pause > 0 || me.wind || me.rec > 0) { d.cur = { x: 0, y: 0, release: false }; return d.cur; }
    if (d.t > 0 && d.cur) { return { x: d.cur.x, y: d.cur.y, release: false }; }
    d.t = profile.every * (0.75 + 0.5 * rng.next());
    // notice a rival's throw only some of the time (better wrestlers see it coming)
    const op = B.side[1 - i];
    if (op.wind && !d.saw) { d.saw = true; d.defend = rng.next() < profile.defend; }
    if (!op.wind) { d.saw = false; d.defend = true; }
    if (me.grip < 0.25) d.resting = true; else if (me.grip > 0.6) d.resting = false;
    const pl = bestIntent(B, i, profile, { defend: d.defend, resting: d.resting });
    d.plan = pl;
    let intent = pl.intent;
    if (d.intent && d.hold > 0 && intent !== 'throw') intent = d.intent;     // Watch & Learn: follow the explained plan
    const jitter = (rng.next() - 0.5) * 2 * profile.noise;
    if (intent === 'throw') {
      const th = throwOption(B, i);
      const a = Math.atan2(th.d.y, th.d.x) + jitter * 0.4;
      d.cur = { x: Math.cos(a), y: Math.sin(a), release: true };
      d.fire = true;
      return { ...d.cur };
    }
    if (intent === 'root') { d.cur = { x: 0, y: 0, release: false }; return d.cur; }
    // build
    let dir = pl.dir;
    if (pl.why === 'start') dir = { x: Math.cos(d.axis), y: Math.sin(d.axis) };
    if (rng.next() > profile.sync && pl.why === 'swing') dir = { x: -dir.x, y: -dir.y };     // out of time with the swing
    const a = Math.atan2(dir.y, dir.x) + jitter;
    const m = profile.tug * (0.75 + 0.25 * rng.next());
    d.cur = { x: Math.cos(a) * m, y: Math.sin(a) * m, release: false };
    return { ...d.cur };
  };
  return d;
}

// The thumb vector a plan stands for (for the on-screen arrow).
export const planArrow = (plan) => (plan && plan.dir && len(plan.dir) > 0 ? { x: plan.dir.x, y: plan.dir.y } : null);
