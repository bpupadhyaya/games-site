// The computer athletes and the coach. An athlete works in INTENTS (gain, lift, brace, rest, snap-gain) and turns each into a pulled
// vector with its own rhythm. Weaker rivals read the situation late and pulse badly; the champion reads it at once, saves stamina
// and punishes a tired moment. The same chooser (with perfect reading) is the Think coach and the Watch & Learn teacher.
import { leverage, strength } from './sim.js';
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export const PROFILES = [
  { name: 'Aisen', tag: 'A nervous newcomer', stars: 1, react: 0.62, noise: 0.5, pulse: 0.45, hold: 0.5, rush: 0.95, rest: 0.18 },
  { name: 'Tuyaara', tag: 'Steady and patient', stars: 2, react: 0.45, noise: 0.35, pulse: 0.6, hold: 0.8, rush: 0.7, rest: 0.3 },
  { name: 'Eder', tag: 'Strong, bursts early', stars: 3, react: 0.32, noise: 0.25, pulse: 0.75, hold: 0.7, rush: 0.9, rest: 0.25 },
  { name: 'Sardaana', tag: 'Quick to read you', stars: 4, react: 0.2, noise: 0.15, pulse: 0.88, hold: 0.6, rush: 0.75, rest: 0.34 },
  { name: 'Aytal', tag: 'The patient champion', stars: 5, react: 0.12, noise: 0.07, pulse: 1, hold: 0.5, rush: 0.65, rest: 0.4 },
];
export const ADVISOR = { name: 'Coach', react: 0, noise: 0, pulse: 1, hold: 0.5, rush: 0.7, rest: 0.34 };

export const INTENTS = {
  gain: { label: 'Draw the stick', hint: 'pull back in sharp snaps' },
  lift: { label: 'Lift', hint: 'drag up (and back a little)' },
  brace: { label: 'Sink and defend', hint: 'drag down to press your weight into the floor' },
  rest: { label: 'Rest', hint: 'let go and breathe' },
};

// How good is each intent right now? me = side index. view = what the athlete knows (the rival may be seen a moment late).
export function scoreIntents(B, me, view = null) {
  const r = 1 - me, M = B.side[me], R = view || B.side[r];
  const mine = me === 0 ? B.x : -B.x;            // + when the stick is on my side
  const hMe = me === 0 ? B.h : -B.h;             // + when I am lifting them
  const lev = leverage(B, me);
  const rivalLift = Math.max(0, R.vec.u) * strength(R);
  const rivalSink = Math.max(0, -R.vec.u);
  const rivalTired = 1 - strength(R);
  const sc = { gain: 0, lift: 0, brace: 0, rest: 0 };
  sc.gain = 0.55 + 0.5 * Math.max(0, 0.3 - mine) + 0.4 * Math.max(0, R.vec.b - 0.5) * 0 + (M.st > 0.4 ? 0.2 : -0.2);
  sc.lift = 0.25 + 0.9 * Math.max(0, mine + 0.1) + 0.8 * rivalTired + 0.5 * Math.max(0, hMe) - 0.9 * rivalSink + (M.st > 0.45 ? 0.25 : -0.35) - 0.3 * Math.max(0, 1.1 - lev);
  sc.brace = 0.1 + 1.3 * rivalLift + 0.9 * Math.max(0, -hMe) + 1.1 * Math.max(0, 0.45 - M.gr) + 0.4 * Math.max(0, -mine - 0.3);
  sc.rest = 0.05 + 1.2 * Math.max(0, 0.38 - M.st) + 0.3 * Math.max(0, 0.6 - M.st) - 0.6 * rivalLift;
  return sc;
}
export function bestIntent(B, me, view = null) {
  const sc = scoreIntents(B, me, view);
  let k = 'gain', v = -9;
  for (const key of Object.keys(sc)) if (sc[key] > v) { v = sc[key]; k = key; }
  return { intent: k, scores: sc };
}

// The plain-English reason behind the best intent (used by Think and Watch & Learn).
export function explain(B, me, intent) {
  const r = 1 - me, M = B.side[me], R = B.side[r];
  const mine = me === 0 ? B.x : -B.x, hMe = me === 0 ? B.h : -B.h;
  const pct = (v) => `${Math.round(clamp(v, 0, 1) * 100)}%`;
  switch (intent) {
    case 'rest': return { title: 'Rest and breathe', reason: `Stamina is down to ${pct(M.st)}. A tired athlete pulls much weaker, so let go for a moment: stamina comes back fast when the pull is small.` };
    case 'brace':
      if (R.vec.u > 0.3) return { title: 'Sink and defend', reason: 'The rival is lifting. Drag down to press your weight into the floor: it cancels most of their lift and restores your grip.' };
      if (M.gr < 0.5) return { title: 'Sink and defend', reason: `Grip is down to ${pct(M.gr)}. Sinking restores grip. If it empties, the stick is wrenched away.` };
      return { title: 'Sink and defend', reason: 'The lift gauge is against you. Sink now, then draw the stick back to your side before lifting again.' };
    case 'lift':
      if (R.st < 0.45) return { title: 'Lift now', reason: `The rival is tired (${pct(R.st)} stamina), so they cannot resist long. Drag up with a little back-pull to lift them.` };
      return { title: 'Lift', reason: `${mine > 0.2 ? 'The stick is on your side, which gives you leverage' : 'This is a good moment'}: drag up. The gauge needs to fill all the way to lift them off the floor.${hMe > 0.2 ? ' You are already ahead.' : ''}` };
    default:
      return { title: 'Draw the stick', reason: `${mine < 0 ? 'The stick is on their side.' : 'Keep the stick on your side.'} Drag back in sharp snaps, then ease off: a quick pull from slack costs little stamina and pulls hard. The closer the stick, the stronger your lift.` };
  }
}

// An AI athlete. Create with createDriver(profile, rng); call cmd(B, me, dt) every tick.
export function createDriver(prof, rng) {
  const d = { prof, intent: 'gain', hold: 0, phase: rng.next() * 6, seen: [], pace: 0.95 + rng.next() * 0.2, jitter: 0, wobble: 0, rng };
  d.cmd = (B, me, dt) => {
    const r = 1 - me;
    // read the rival a moment late
    d.seen.push({ t: B.t, b: B.side[r].vec.b, u: B.side[r].vec.u, st: B.side[r].st, gr: B.side[r].gr, m: B.side[r].m, f: B.side[r].f });
    while (d.seen.length > 2 && d.seen[1].t <= B.t - prof.react) d.seen.shift();
    const v = d.seen[0];
    const view = { vec: { b: v.b, u: v.u }, st: v.st, gr: v.gr, m: v.m, f: v.f };
    d.hold -= dt;
    if (d.hold <= 0) {
      const { scores } = bestIntent(B, me, view);
      // weaker athletes pick with more noise and keep their choice longer
      let bestK = 'gain', bestV = -9;
      for (const k of Object.keys(scores)) { const val = scores[k] + (rng.next() - 0.5) * 2 * prof.noise * 1.4; if (val > bestV) { bestV = val; bestK = k; } }
      d.intent = bestK;
      d.hold = prof.react * 0.6 + 0.25 + rng.next() * 0.5 * prof.hold;
    }
    d.phase += dt * d.pace;
    d.wobble += (rng.next() - 0.5) * dt * 3; d.wobble = clamp(d.wobble, -0.3, 0.3);
    return vectorFor(d.intent, d.phase, prof, d.wobble, B.side[me]);
  };
  return d;
}

// Intent + rhythm -> a pulled vector. `pulse` is how sharply the athlete snaps (1 = clean snap and rest).
export function vectorFor(intent, phase, prof, wobble = 0, self = null) {
  const cyc = phase % 1;
  const burstLen = 0.38, snap = cyc < burstLen;
  const q = prof.pulse;
  const hi = 0.55 + 0.45 * q * prof.rush, lo = 0.28 - 0.2 * q;
  switch (intent) {
    case 'gain': { const m = snap ? hi : lo; return { b: clamp(m + wobble * 0.3, 0, 1), u: clamp(0.05 + wobble * 0.2, -1, 1) }; }
    case 'lift': { const m = snap ? hi : Math.max(0.35, lo + 0.2); return { b: clamp(0.3 * m + wobble * 0.2, 0, 1), u: clamp(m + wobble * 0.15, -1, 1) }; }
    case 'brace': return { b: 0.12, u: clamp(-0.85 + wobble * 0.2, -1, 0) };
    default: return { b: 0.05, u: clamp(-0.1 + wobble * 0.1, -1, 0.2) };
  }
}
// The vector the coach draws as a ghost arrow for an intent at its strongest.
export function peakVector(intent) { return vectorFor(intent, 0.1, ADVISOR, 0); }
