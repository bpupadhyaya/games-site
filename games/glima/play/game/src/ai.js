// The computer athletes and the coach. An athlete works in PLANS (hook, pull, brace, centre). It sees the rival a moment late
// (weaker athletes more so) and acts on what it saw. The same chooser with perfect sight is the Think coach and the Watch & Learn
// teacher.
import { light, TUNE } from './sim.js';
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export const PROFILES = [
  { name: 'Aino', tag: 'A nervous beginner', stars: 1, react: 0.62, noise: 0.5, eager: 0.5, rash: 0.9, thr: 0.2, brace: 0.25, vigour: 0.55 },
  { name: 'Birna', tag: 'Steady and patient', stars: 2, react: 0.42, noise: 0.35, eager: 0.6, rash: 0.4, thr: 0.3, brace: 0.5, vigour: 0.7 },
  { name: 'Eirik', tag: 'Hooks early, often', stars: 3, react: 0.3, noise: 0.25, eager: 1.0, rash: 0.6, thr: 0.22, brace: 0.55, vigour: 0.85 },
  { name: 'Sigrun', tag: 'Quick to read you', stars: 4, react: 0.18, noise: 0.15, eager: 0.85, rash: 0.2, thr: 0.34, brace: 0.85, vigour: 0.9 },
  { name: 'Magnus', tag: 'The patient champion', stars: 5, react: 0.1, noise: 0.06, eager: 0.9, rash: 0.05, thr: 0.4, brace: 1, vigour: 1 },
];
export const ADVISOR = { name: 'Coach', react: 0, noise: 0, eager: 1, rash: 0, thr: 0.32, brace: 1, vigour: 1 };

export const INTENTS = {
  hook: { label: 'Hook', hint: 'tap the side of the light leg' },
  pull: { label: 'Pull them over', hint: 'drag toward the side that unloads their leg' },
  brace: { label: 'Load the leg', hint: 'drag toward the side of the hook' },
  centre: { label: 'Stand tall', hint: 'let go and recover your stance' },
};

// What the athlete sees of the rival: { w, steer, hookS, hookT }.
export const seeOf = (R) => ({ w: R.w, steer: R.steer, hookS: R.hook ? R.hook.s : 0, hookT: R.hook ? R.hook.t : 0, rec: R.rec, stun: R.stun });

// The plan for side `me` given what it can see of the rival. Pure.
export function plan(B, me, v, o = {}) {
  const M = B.side[me];
  const ready = M.rec <= 0 && M.stun <= 0 && !M.hook;
  const thr = o.thr ?? 0.3;
  // 1. a hook is coming at a leg that is light: load it
  if (v.hookS && v.hookT < TUNE.windup - 0.02) {
    const lm = light(M, v.hookS);
    if (lm > -0.05) return { intent: 'brace', side: v.hookS, steer: v.hookS, score: 2, why: 'hooked' };
  }
  // 2. the best hook available now
  let best = null;
  for (const s of [-1, 1]) {
    const ownL = light(M, s), tl = clamp(-(v.w + 0.12 * v.steer) * s, -1, 1);
    const sc = Math.min(ownL, tl * 1.05);
    if (ready && ownL >= TUNE.ownMin + 0.08 && tl >= TUNE.legMin + 0.1 && sc > thr && (!best || sc > best.sc)) best = { s, sc, ownL, tl };
  }
  if (best) return { intent: 'hook', side: best.s, steer: M.steer, score: best.sc, ownL: best.ownL, tl: best.tl };
  // 3. recover when tired or wobbling
  if (M.stun > 0 || M.st < 0.3 && Math.abs(M.w) > 0.4) return { intent: 'centre', side: 0, steer: 0, score: 0.2 };
  // 4. set up: pull the pair toward -s so both feet on side s unload
  const sc = [-1, 1].map((s) => (-v.w * s) + 0.6 * (-M.w * s) + 0.25 * v.steer * -s * 0 );
  const s = sc[1] >= sc[0] ? 1 : -1;
  return { intent: 'pull', side: s, steer: -s, score: Math.max(sc[0], sc[1]) };
}
export function bestIntent(B, me, view = null) { return plan(B, me, view || seeOf(B.side[1 - me]), ADVISOR); }

// The plain-English reason behind the plan (used by Think and Watch & Learn). Sides are the picture's left and right.
const nm = (s) => (s < 0 ? 'left' : 'right');
export function explain(B, me, p) {
  const R = B.side[1 - me], M = B.side[me];
  const pct = (v) => `${Math.round(clamp(v, 0, 1) * 100)}%`;
  switch (p.intent) {
    case 'hook': return { title: `Hook with the ${nm(p.side)} foot`, reason: `Their ${nm(p.side)} leg is light and so is your ${nm(p.side)} foot. Tap the ${nm(p.side)} side now: the hook takes a fifth of a second to swing, so go before they step over it.` };
    case 'brace': return { title: `Load the ${nm(p.side)} leg`, reason: `The rival is hooking at your ${nm(p.side)} leg and it is light. Drag toward the ${nm(p.side)} to put your weight onto it: a hook cannot take a loaded leg.` };
    case 'centre': return { title: 'Stand tall', reason: `${M.stun > 0 ? 'You are wobbling.' : `Stance is down to ${pct(M.st)}.`} Let go of the steer and stay near the middle: stance comes back while you are centred, and a centred athlete has no light leg to hook.` };
    default: {
      const s = p.side;
      return { title: `Pull toward the ${nm(-s)}`, reason: `Their ${nm(s)} leg is ${R.w * s < -0.15 ? 'already light' : 'the one to unload'}. Drag toward the ${nm(-s)}: you step your weight over and the belt drags theirs, so both ${nm(s)} feet go light. Then hook on the ${nm(s)}.` };
    }
  }
}

// An AI athlete. Create with createDriver(profile, rng); call cmd(B, me, dt) every tick.
export function createDriver(prof, rng) {
  const d = { prof, p: { intent: 'centre', side: 0, steer: 0 }, hold: 0, seen: [], rng, cool: 0.6 + rng.next(), wob: 0, steer: 0, lastHook: -9 };
  d.cmd = (B, me, dt) => {
    const r = 1 - me, R = B.side[r], M = B.side[me];
    d.seen.push({ t: B.t, ...seeOf(R) });
    while (d.seen.length > 2 && d.seen[1].t <= B.t - prof.react) d.seen.shift();
    const v = d.seen[0];
    d.cool -= dt; d.hold -= dt;
    d.wob += (rng.next() - 0.5) * dt * 3; d.wob = clamp(d.wob, -0.3, 0.3);
    let hook = 0;
    const p = plan(B, me, v, prof);
    if (p.intent === 'brace') {
      // a weak athlete only sometimes manages the step-over
      if (d.p.intent !== 'brace' && rng.next() > prof.brace) { d.p = { intent: 'centre', side: 0, steer: 0 }; d.hold = 0.5; } else { d.p = p; d.hold = 0.25; }
    } else if (d.hold <= 0 || (p.intent === 'hook' && d.p.intent !== 'hook')) {
      d.p = p;
      d.hold = prof.react * 0.7 + 0.3 + rng.next() * 0.5 + (p.intent === 'pull' ? 0.35 : 0);
      if (p.intent === 'pull' && rng.next() < prof.noise) d.p = { ...p, side: -p.side, steer: p.side };
    }
    if (d.p.intent === 'hook' && d.cool <= 0 && M.rec <= 0 && M.stun <= 0 && !M.hook) {
      if (rng.next() < clamp(prof.eager * 9 * dt, 0, 1)) { hook = d.p.side; d.cool = 0.5 + rng.next() * 0.7 / prof.eager; }
    }
    // a rash athlete swings at nothing now and then
    if (!hook && M.rec <= 0 && M.stun <= 0 && !M.hook && d.cool <= 0 && rng.next() < prof.rash * dt * 0.25) { hook = rng.next() < 0.5 ? -1 : 1; d.cool = 0.7 + rng.next(); }
    const amp = d.p.intent === 'centre' ? 0 : prof.vigour;
    const want = clamp(d.p.steer * amp + d.wob * 0.5, -1, 1);
    return { steer: want, hook };
  };
  return d;
}

// The steer arrow the coach draws for a plan: -1..1 toward the left or right of the picture (0 = rest).
export function peakSteer(p) { return p.intent === 'hook' ? 0 : p.intent === 'centre' ? 0 : p.steer; }
