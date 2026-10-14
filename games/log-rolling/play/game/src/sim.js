// Log Rolling: the simulation. Pure and deterministic (the only randomness comes from the rng handed to stepWorld).
// Two birlers stand on one floating log. Everything is in "log units": log speed v and lean l are both about -1..1.
//
//   v   speed of the top of the log (screen space, + = to the right). Kicks and water jolts change it.
//   f_i the speed of birler i's feet; they follow v with a lag (tauFeet), so a sudden change in v makes them slip.
//   l_i lean of birler i (+ = to the right). Slipping tips the body the other way, a push (c) corrects it. |l| >= limit = splash.
//
// Index 0 is the player ("you"), index 1 the rival. The player stands on the left and faces right.
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export const TUNE = {
  hz: 120,            // fixed simulation steps per second
  kd: 2.8,            // how hard a slip tips the body
  gl: 0.9,            // the body rights itself
  kc: 2.6,            // push strength (the steering control)
  kick: 0.6,          // a kick changes the log speed by this much
  vmax: 1,            // top log speed
  drag: 0.3,          // water slows the log
  cost: 0.34,         // momentum a kick costs
  gain: 0.4,          // momentum per second while you stand steady
  steady: 0.7,        // you only gain momentum while |lean| is below this
  cooldown: 0.5,      // seconds between your kicks
  start: 0.5,         // momentum at the start of a bout
  ready: 1.5,         // seconds of "get set"
  fallT: 1.7,         // seconds the splash plays before the next bout
  limit: 1,           // lean at which a birler falls
  tSoft: 16,          // seconds before the limit starts to shrink
  tEnd: 34,           // seconds at which the bout is decided
  limitEnd: 0.45,     // lean limit at tEnd
  speedGain: 0.5,     // a faster log tips harder
  leanMax: 1.4,
};
export const BOUTS = 3;                      // a match is best of three
export const DEMO_MATCHES = 3;

export const VENUES = [
  { key: 'pond', name: 'Mill Pond', blurb: 'Still water at dawn. Short, gentle jolts and slow feet.', need: 0, rival: 0, tau: 0.65, bump: 0.1, bumpEvery: 5.5, kdMul: 1.0 },
  { key: 'river', name: 'Cedar River', blurb: 'A steady current nudges the log now and then.', need: 1, rival: 1, tau: 0.75, bump: 0.18, bumpEvery: 4.2, kdMul: 1.05 },
  { key: 'lake', name: 'Lantern Lake', blurb: 'A heavy, slick log at dusk: a slip lasts longer.', need: 3, rival: 2, tau: 0.95, bump: 0.14, bumpEvery: 4.5, kdMul: 1.1 },
  { key: 'rapids', name: 'Spring Rapids', blurb: 'Rain and white water: hard jolts, often.', need: 6, rival: 3, tau: 0.8, bump: 0.26, bumpEvery: 3.2, kdMul: 1.2 },
];

// react: seconds the rival takes to notice; err: size of its steering wobble; kp: how hard it pushes back; kickP: kicks per
// second it would like; reserve: momentum it keeps back; safe: it only kicks while its own lean is below this; bait: it
// tips you toward the side you are pushing.
export const RIVALS = [
  { name: 'Ada', blurb: 'Calm and patient. Kicks rarely and reacts slowly.', react: 0.6, err: 0.2, kp: 0.9, kickP: 0.4, reserve: 0.25, safe: 0.4, bait: false },
  { name: 'Jonas', blurb: 'Steady feet and a steady rhythm of kicks.', react: 0.45, err: 0.2, kp: 1.1, kickP: 0.6, reserve: 0.15, safe: 0.45, bait: false },
  { name: 'Mae', blurb: 'Fast hands. Reads your lean and goes for it.', react: 0.38, err: 0.18, kp: 1.2, kickP: 0.7, reserve: 0.1, safe: 0.5, bait: false },
  { name: 'Tobias', blurb: 'The champion: quick, tidy and merciless on a slip.', react: 0.33, err: 0.12, kp: 1.3, kickP: 0.75, reserve: 0.05, safe: 0.55, bait: false },
];
export const AUTO = { react: 0.24, err: 0.08, kp: 1.3, kickP: 0.65, reserve: 0.1, safe: 0.5, bait: true };
export const DUMMY = { react: 0.35, err: 0.3, kp: 1.1, kickP: 0, reserve: 0, safe: 0, bait: false };

export const venueOwned = (rec, i) => (rec.wins | 0) >= VENUES[i].need;
export const limitAt = (t) => (t <= TUNE.tSoft ? TUNE.limit : TUNE.limit - (TUNE.limit - TUNE.limitEnd) * clamp((t - TUNE.tSoft) / (TUNE.tEnd - TUNE.tSoft), 0, 1));
export const kdOf = (w, v) => TUNE.kd * VENUES[w.venue].kdMul * (1 + TUNE.speedGain * Math.abs(v));
export const RANKS = [[0, 'First log'], [1, 'Pond hopper'], [3, 'Steady feet'], [6, 'River regular'], [10, 'Rapids rider'], [20, 'Champion of the pond']];
export const rankFor = (wins) => { let r = RANKS[0][1]; for (const [n, name] of RANKS) if (wins >= n) r = name; return r; };

const newBuf = () => ({ t: [], l: [], d: [], lo: [], co: [], i: 0, n: 0 });
const aiState = () => ({ buf: newBuf(), n: 0, nt: 0, kt: 0.4, alt: 1, c: 0 });

export function makeWorld({ mode = 'match', venue = 0, rival = null }) {
  const V = VENUES[venue];
  const w = {
    mode, venue, rival: rival ?? V.rival, practice: mode === 'practice',
    bouts: mode === 'match' ? BOUTS : 1,
    phase: 'ready', pt: TUNE.ready, t: 0, clock: 0, acc: 0, bout: 1, score: [0, 0],
    v: 0, wob: 0, th: 0, f: [0, 0], l: [0, 0], c: [0, 0], mom: [TUNE.start, TUNE.start], cd: [0, 0], ph: [0, 0],
    nextBump: V.bumpEvery, fell: -1, fallT: 0, thr: TUNE.limit, lastKick: { by: -1, t: -9, tip: 0 },
    hist: [], stats: { kicks: [0, 0], tips: [0, 0], falls: [0, 0], best: 0 }, ev: [], over: false, result: null,
    ai: aiState(), aa: aiState(), survive: 0, finalAfterFall: false,
  };
  return w;
}

const resetBout = (w) => {
  w.v = 0; w.wob = 0; w.f = [0, 0]; w.l = [0, 0]; w.c = [0, 0]; w.mom = [TUNE.start, TUNE.start]; w.cd = [0, 0];
  w.t = 0; w.thr = TUNE.limit; w.fell = -1; w.fallT = 0; w.phase = 'ready'; w.pt = TUNE.ready; w.nextBump = VENUES[w.venue].bumpEvery;
  w.lastKick = { by: -1, t: -9, tip: 0 };
  w.ai = aiState(); w.aa = aiState();
};

// ---- kicks --------------------------------------------------------------------------------------------------------------
// tip: the way the OTHER birler's body is tipped (-1 left, +1 right). The log top moves the opposite way.
export function canKick(w, i) { return w.phase === 'go' && w.mom[i] >= TUNE.cost && w.cd[i] <= 0; }
export function kick(w, i, tip) {
  if (!canKick(w, i) || !tip) return false;
  const dv0 = -Math.sign(tip) * TUNE.kick, v1 = clamp(w.v + dv0, -TUNE.vmax, TUNE.vmax), dv = v1 - w.v;
  if (Math.abs(dv) < TUNE.kick * 0.35) { w.ev.push({ type: 'noop', i }); return false; }
  w.v = v1; w.f[i] += dv;                        // the kicker's own feet go with the log: no slip for them
  w.mom[i] -= TUNE.cost; w.cd[i] = TUNE.cooldown;
  w.stats.kicks[i]++;
  w.lastKick = { by: i, t: w.t, tip: Math.sign(tip) };
  w.ev.push({ type: 'kick', i, tip: Math.sign(tip), dv });
  return true;
}

// ---- the plan: what a sensible birler does right now (drives the rival, Watch & Learn and the Think hint) ----------------------
// obs: { l, d, lo, co } (own lean, own slip, opponent lean, opponent push). Returns { c, kick, why }.
export function plan(w, i, P, obs, ready = true) {
  const kd = kdOf(w, w.v);
  let c = clamp((kd * obs.d) / TUNE.kc - P.kp * obs.l, -1, 1);
  if (Math.abs(c) < 0.05) c = 0;
  let tip = 0, why = '';
  const me = obs.l;
  if (ready && w.phase === 'go' && !w.practice && w.mom[i] >= TUNE.cost + P.reserve && w.cd[i] <= 0 && Math.abs(me) < P.safe) {
    if (P.bait && Math.abs(obs.co) > 0.55) tip = Math.sign(obs.co);
    else if (Math.abs(obs.lo) > 0.12) tip = Math.sign(obs.lo);
    else tip = 0;
  }
  return { c, kick: tip, why };
}

const sampleAt = (b, t) => {
  // newest sample at or before t (the buffer is a ring of the last 2 s)
  let best = -1;
  for (let k = 0; k < b.n; k++) { const j = (b.i - 1 - k + 256) % 256; if (b.t[j] <= t) { best = j; break; } }
  if (best < 0) { const j = (b.i - b.n + 256) % 256; return b.n ? { l: b.l[j], d: b.d[j], lo: b.lo[j], co: b.co[j] } : { l: 0, d: 0, lo: 0, co: 0 }; }
  return { l: b.l[best], d: b.d[best], lo: b.lo[best], co: b.co[best] };
};
const pushObs = (b, t, o) => { const j = b.i; b.t[j] = t; b.l[j] = o.l; b.d[j] = o.d; b.lo[j] = o.lo; b.co[j] = o.co; b.i = (j + 1) % 256; b.n = Math.min(256, b.n + 1); };

const observe = (w, i) => ({ l: w.l[i], d: w.v + w.wob - w.f[i], lo: w.l[1 - i], co: w.c[1 - i] });

// One decision step for birler i using persona P (rival or the Watch & Learn player). st is that birler's own AI state.
export function drive(w, i, P, st, rng, dt) {
  pushObs(st.buf, w.clock, observe(w, i));
  const o = sampleAt(st.buf, w.clock - P.react);
  st.nt -= dt;
  if (st.nt <= 0) { st.n = (rng.next() - 0.5) * 2 * P.err; st.nt = 0.2 + 0.25 * rng.next(); }
  const pl = plan(w, i, P, o, false);
  const target = clamp(pl.c + (Math.abs(pl.c) > 0.02 || P.err > 0.15 ? st.n : 0), -1, 1);
  st.c += (target - st.c) * Math.min(1, dt * 12);
  w.c[i] = st.c;
  st.kt -= dt;
  if (st.kt <= 0) {
    st.kt = 0.12;
    if (P.kickP > 0 && w.phase === 'go' && rng.next() < P.kickP * 0.12) {
      const k = plan(w, i, P, o, true);
      if (k.kick) kick(w, i, k.kick);
    }
  }
}

// What Think shows the player: the push, the kick and a sentence about it, using perfect information.
export function advise(w) {
  const o = observe(w, 0), P = AUTO;
  const pl = plan(w, 0, P, o, true);
  const name = RIVALS[w.rival].name;
  let why;
  if (w.phase !== 'go') why = 'Get set: stay still and let the log settle.';
  else if (pl.kick) why = `${name} leans ${o.lo < 0 ? 'left' : 'right'} and you are steady: tip them ${pl.kick < 0 ? 'left' : 'right'}.`;
  else if (Math.abs(pl.c) >= 0.2) why = `You are slipping ${pl.c > 0 ? 'left' : 'right'}: drag ${pl.c > 0 ? 'right' : 'left'} to catch your balance.`;
  else if (w.mom[0] < TUNE.cost) why = 'Steady feet fill the momentum bar. Keep still and wait for it.';
  else why = 'Stay steady. A kick works best when your rival is already leaning.';
  return { c: pl.c, kick: pl.kick, why };
}

// ---- the step -----------------------------------------------------------------------------------------------------------
const endBout = (w, loser, how) => {
  const winner = 1 - loser;
  w.fell = loser; w.fallT = 0; w.phase = 'fall';
  w.stats.falls[loser]++;
  w.stats.best = Math.max(w.stats.best, w.t);
  const tipped = w.lastKick.by === winner && w.t - w.lastKick.t < 2.2;
  if (tipped) w.stats.tips[winner]++;
  w.hist.push({ winner, secs: w.t, how, tipped, kicks: [w.stats.kicks[0], w.stats.kicks[1]] });
  if (!w.practice) w.score[winner]++;
  w.ev.push({ type: 'fall', i: loser, how, tipped });
  const need = Math.floor(w.bouts / 2) + 1;
  if (!w.practice && (w.score[winner] >= need || w.bout >= w.bouts)) { w.over = false; w.finalAfterFall = true; }
};

function sub(w, h, rng) {
  const T = TUNE, V = VENUES[w.venue];
  w.clock += h;
  if (w.phase === 'ready') {
    w.pt -= h; if (w.pt <= 0) { w.phase = 'go'; w.ev.push({ type: 'go' }); }
    w.th += w.v * h;
    return;
  }
  if (w.phase === 'fall') {
    w.fallT += h; w.v -= T.drag * w.v * h; w.th += w.v * h;
    if (w.fallT >= T.fallT) {
      if (w.finalAfterFall) {
        w.over = true; w.phase = 'over';
        const won = w.score[0] > w.score[1];
        w.result = { won, draw: w.score[0] === w.score[1], score: [w.score[0], w.score[1]], bouts: w.hist.map((q) => ({ ...q })) };
        w.ev.push({ type: 'over' });
      } else { w.bout++; resetBout(w); w.ev.push({ type: 'bout' }); }
    }
    return;
  }
  if (w.phase !== 'go') return;
  w.t += h;
  if (w.practice) w.survive = w.t;
  // water: an occasional jolt on the whole log, plus a little constant wobble
  w.nextBump -= h;
  if (w.nextBump <= 0) {
    const dv = (rng.next() < 0.5 ? -1 : 1) * V.bump * (0.6 + 0.8 * rng.next());
    w.v = clamp(w.v + dv, -T.vmax, T.vmax); w.nextBump = V.bumpEvery * (0.6 + 0.8 * rng.next());
    w.ev.push({ type: 'bump', dv });
  }
  w.wob += -1.6 * w.wob * h + (rng.next() - 0.5) * 0.9 * Math.sqrt(h);
  w.wob = clamp(w.wob, -0.12, 0.12);
  w.v -= T.drag * w.v * h;
  const ve = w.v + w.wob;
  for (let i = 0; i < 2; i++) {
    const d = ve - w.f[i];
    w.f[i] += (d / V.tau) * h;
    w.l[i] = clamp(w.l[i] + (-kdOf(w, ve) * d - T.gl * w.l[i] + T.kc * w.c[i]) * h, -T.leanMax, T.leanMax);
    const a = Math.abs(w.l[i]);
    if (a < T.steady) w.mom[i] = Math.min(1, w.mom[i] + T.gain * h * (1 - a / T.steady));
    if (w.cd[i] > 0) w.cd[i] = Math.max(0, w.cd[i] - h);
    w.ph[i] += w.f[i] * 5 * h * (i === 0 ? 1 : -1);
  }
  w.th += ve * h;
  w.thr = limitAt(w.t);
  const a0 = Math.abs(w.l[0]) / w.thr, a1 = Math.abs(w.l[1]) / w.thr;
  if (a0 >= 1 || a1 >= 1) { endBout(w, a0 >= a1 ? 0 : 1, 'fall'); return; }
  if (w.t >= T.tEnd) endBout(w, a0 >= a1 ? 0 : 1, 'time');
}

// Advance the world by dt seconds. The rival (and, in practice, a dummy) is driven in here; the player's steering is w.c[0].
export function stepWorld(w, dt, rng) {
  const h = 1 / TUNE.hz;
  w.acc += Math.min(dt, 0.1);
  let n = 0;
  while (w.acc >= h && n < 24) {
    w.acc -= h; n++;
    if (w.phase === 'go') {
      const P = w.practice ? DUMMY : RIVALS[w.rival];
      drive(w, 1, P, w.ai, rng, h);
    }
    sub(w, h, rng);
  }
}

// Watch & Learn: the player's side is steered by the same plan as the rival, but sharper.
export function autoStep(w, st, rng, dt) {
  if (w.phase !== 'go') { w.c[0] = 0; return; }
  const h = 1 / TUNE.hz; let k = Math.max(1, Math.round(dt / h));
  // one decision per frame is enough; the plan is smooth
  void k;
  drive(w, 0, AUTO, st, rng, dt);
}
export const newAuto = aiState;
