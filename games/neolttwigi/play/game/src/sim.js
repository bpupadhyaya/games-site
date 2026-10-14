// Neolttwigi: the rules as data, and the whole seesaw round as a pure, deterministic model (no drawing, no input devices).
//
// The model in one paragraph: two girls stand on the ends of a board that rests on a straw bale. Exactly one of them is in the air at a
// time. When the girl in the air LANDS (the contact), her stomp launches the other one. So every contact is two judged actions:
//   STOMP  (the lander)         presses at the moment her feet touch the board;
//   SPRING (the other girl)     has been crouching with her finger held, and releases at that same moment.
// The stomp sets how much energy goes into the board, the spring sets how much of it the other girl turns into height. Perfect timing
// lifts the next jump, poor timing lets it sink. Flight time follows from the apex height, so the rhythm slows as the girls climb.
// Time is the sum of the dt handed to step(); everything else is a function of that clock and of the seeded rng.

export const COUNT_IN = 2.4;          // seconds before the first hop
export const LAG = 0.26;              // contact -> take-off: the board loads for this long
export const PRE = 0.3;               // a press or release earlier than this before the contact is not counted
export const LEARN_G = 0.72, LEARN_WIN = 1.35;
export const WIN = { perfect: 0.07, great: 0.12, good: 0.17 };          // seconds either side of the contact (scale 1)
export const ETA = { perfect: 1.0, great: 0.95, good: 0.9, miss: 0.74 };    // share of the landing height the stomp keeps
export const PUMP = { perfect: 0.12, great: 0.06, good: 0.03, miss: 0 };    // metres a good stomp adds
export const SPRING = { perfect: 1.04, great: 1.0, good: 0.96, miss: 0.85 };  // what the launched girl makes of it
export const HARMONY = { start: 0.65, perfect: 0.045, great: 0.015, good: -0.01, miss: -0.2 };
export const WEIGHT = { perfect: 1, great: 0.8, good: 0.55, miss: 0 };
export const SOFT_CAP = 0.85, CAP_BEND = 0.4;
export const PHRASE = 4;              // contacts per phrase in Watch and Learn
export const THINK_CHOICES = [3, 5, 7, 10];
export const REVEAL_SECONDS = 2;
export const DEMO_RUNS = 3;
export const HEIGHT_EASE = 0.1;       // windows shrink by this per metre of height
export const STAR_NAMES = ['Warm-up', 'Courtyard jumper', 'Festival jumper', 'Sky jumper'];
export const GRADES = ['perfect', 'great', 'good', 'miss'];

// Courses. g is the (stylised) gravity: higher g means quicker flights and a tighter rhythm. `partner` shapes the computer girl:
// sigma = spread of her timing in seconds, slip = chance she botches a contact.
export const LEVELS = [
  { id: 'courtyard', name: 'Courtyard Morning', blurb: 'A calm courtyard and a patient partner. Learn the press and the release.', setting: 'morning', partner: 'Sori',
    g: 4.4, win: 1.15, sigma: 0.045, slip: 0.02, events: 14, hMax: 1.8, start: 0.45, pump: 1, stars: [0.9, 1.2, 1.5], pace: 'Slow' },
  { id: 'garden', name: 'Persimmon Garden', blurb: 'Autumn fruit, a little more tempo, a partner who sometimes drifts.', setting: 'garden', partner: 'Haneul',
    g: 5.0, win: 1.05, sigma: 0.055, slip: 0.05, events: 16, hMax: 2.1, start: 0.45, pump: 1, stars: [1.1, 1.45, 1.75], pace: 'Easy' },
  { id: 'fair', name: 'Festival Fair', blurb: 'Bunting, a crowd, and a quicker rhythm that wants real accuracy.', setting: 'fair', partner: 'Bora',
    g: 5.6, win: 1.0, sigma: 0.065, slip: 0.07, events: 18, hMax: 2.4, start: 0.45, pump: 1, stars: [1.3, 1.7, 2.0], pace: 'Brisk' },
  { id: 'lantern', name: 'Lantern Night', blurb: 'The same board under paper lanterns. Tight windows, high jumps.', setting: 'night', partner: 'Dahye',
    g: 6.2, win: 0.95, sigma: 0.07, slip: 0.08, events: 20, hMax: 2.6, start: 0.45, pump: 1, stars: [1.5, 1.9, 2.2], pace: 'Fast' },
  { id: 'snow', name: 'Winter Field', blurb: 'Crisp snow, the quickest tempo, a partner who rarely misses.', setting: 'snow', partner: 'Eun',
    g: 6.8, win: 0.9, sigma: 0.055, slip: 0.06, events: 22, hMax: 2.8, start: 0.45, pump: 1, stars: [1.7, 2.1, 2.4], pace: 'Swift' },
];

export const flightTime = (H, g) => 2 * Math.sqrt((2 * Math.max(H, 0.02)) / g);
export const gOf = (lvl, learn) => lvl.g * (learn ? LEARN_G : 1);

// The three timing windows for a contact at apex height H.
export function windows(lvl, H, learn) {
  const k = lvl.win * (learn ? LEARN_WIN : 1) * (1 - HEIGHT_EASE * Math.min(H, 2.5));
  const cap = LAG - 0.04;
  return { perfect: Math.min(WIN.perfect * k, cap * 0.5), great: Math.min(WIN.great * k, cap * 0.75), good: Math.min(WIN.good * k, cap) };
}
export function gradeOf(err, w) {
  const a = Math.abs(err);
  return a <= w.perfect ? 'perfect' : a <= w.great ? 'great' : a <= w.good ? 'good' : 'miss';
}

// Height of the launched girl for a contact: the lander fell from H, her stomp has grade qs, the other girl's spring has grade qr.
export function launchHeights(H, qs, qr, lvl) {
  const hs = Math.min(lvl.hMax, H * ETA[qs] + PUMP[qs] * lvl.pump);
  let ho = hs * SPRING[qr];
  const soft = lvl.hMax * SOFT_CAP;
  if (ho > soft) ho = soft + (ho - soft) * CAP_BEND;
  return { hs, ho: Math.max(0.2, Math.min(ho, lvl.hMax)) };
}

export const starsOf = (apex, lvl) => lvl.stars.reduce((n, v) => n + (apex >= v ? 1 : 0), 0);
export const rankOf = (stars) => STAR_NAMES[Math.max(0, Math.min(STAR_NAMES.length - 1, stars))];

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ---- a round ------------------------------------------------------------------------------------------------------------------------
// opts: { lvl, mode: 'solo' | 'duel' | 'auto', learn, rng, botSigma? }
// Player 0 is the girl on the left, player 1 the girl on the right. Bots: 'solo' -> player 1; 'auto' -> both; 'duel' -> none.
export function newRound({ lvl, mode, learn = false, rng }) {
  const bots = mode === 'auto' ? [true, true] : mode === 'duel' ? [false, false] : [false, true];
  const r = {
    lvl, mode, learn, bots, g: gOf(lvl, learn), t: 0, done: false, endReason: null, endAt: 0,
    harmony: HARMONY.start, held: [false, false], ev: null, flights: [], log: [],
    counts: [{ perfect: 0, great: 0, good: 0, miss: 0 }, { perfect: 0, great: 0, good: 0, miss: 0 }],
    score: [0, 0], maxLaunch: [0, 0], maxApex: 0, contacts: 0, accSum: 0, accN: 0, chain: 0, maxChain: 0, perfectRun: 0,
    pops: [], slipT: 0, lastContact: null, rng,
  };
  const t1 = COUNT_IN + flightTime(lvl.start, r.g);
  r.flights.push({ who: 1, t0: COUNT_IN, t1, H: lvl.start });
  r.ev = makeEvent(r, 0, 1, COUNT_IN, t1, lvl.start);
  r.maxApex = lvl.start;
  return r;
}

function normal(rng) { return (rng.next() + rng.next() + rng.next() - 1.5) * 2; }   // ~N(0, 1), clipped to +-3

function makeEvent(r, i, lander, t0, t, H) {
  const ev = { i, lander, other: 1 - lander, t0, t, H, sJ: null, rJ: null, sErr: null, rErr: null, bot: [null, null] };
  const sig = r.mode === 'auto' ? 0.03 : r.lvl.sigma, slip = r.mode === 'auto' ? 0.03 : r.lvl.slip;
  for (let p = 0; p < 2; p++) {
    if (!r.bots[p]) continue;
    const role = p === lander ? 'stomp' : 'spring';
    if (r.rng.chance(slip)) { ev.bot[p] = r.rng.chance(0.5) ? { role, t: null } : { role, t: t + (r.rng.chance(0.5) ? -1 : 1) * r.rng.range(0.2, 0.3) }; continue; }
    ev.bot[p] = { role, t: t + clamp(normal(r.rng), -2.4, 2.4) * sig, fired: false };
  }
  return ev;
}

// A pointer / key edge for player p at the current round time.
export function edge(r, p, down, fromBot = false) {
  if (r.done) return;
  const ev = r.ev, t = r.t;
  if (down) {
    r.held[p] = true;
    if (ev.lander === p && ev.sJ === null) {
      const err = t - ev.t;
      if (err >= -PRE) setJudge(r, ev, 'stomp', err);
    }
  } else {
    const was = r.held[p] || fromBot;
    r.held[p] = false;
    if (ev.other === p && ev.rJ === null && was) {
      const err = t - ev.t;
      if (err >= -PRE) setJudge(r, ev, 'spring', err);
    }
  }
}

function setJudge(r, ev, kind, err) {
  const w = windows(r.lvl, ev.H, r.learn);
  const g = err === null ? 'miss' : gradeOf(err, w);
  if (kind === 'stomp') { ev.sJ = g; ev.sErr = err; } else { ev.rJ = g; ev.rErr = err; }
  const p = kind === 'stomp' ? ev.lander : ev.other;
  r.counts[p][g] += 1;
  r.accSum += WEIGHT[g]; r.accN += 1;
  if (g === 'miss') { r.chain = 0; r.perfectRun = 0; r.slipT = 0.6; } else { r.chain += 1; r.maxChain = Math.max(r.maxChain, r.chain); r.perfectRun = g === 'perfect' ? r.perfectRun + 1 : 0; }
  r.pops.push({ p, kind, grade: g, err, t: r.t, age: 0 });
  if (r.pops.length > 8) r.pops.shift();
  r.harmony = clamp(r.harmony + HARMONY[g] * (r.mode === 'auto' ? 0.5 : 1), 0, 1);
  if (ev.sJ !== null && ev.rJ !== null) finalize(r, ev);
}

function finalize(r, ev) {
  const { hs, ho } = launchHeights(ev.H, ev.sJ, ev.rJ, r.lvl);
  r.score[ev.lander] += Math.round(hs * 100);
  r.maxLaunch[ev.lander] = Math.max(r.maxLaunch[ev.lander], hs);
  r.contacts += 1;
  r.lastContact = { i: ev.i, lander: ev.lander, sJ: ev.sJ, rJ: ev.rJ, hs, ho, t: ev.t };
  r.log.push({ i: ev.i, lander: ev.lander, H: ev.H, sJ: ev.sJ, rJ: ev.rJ, sErr: ev.sErr, rErr: ev.rErr, hs, ho });
  const t0 = ev.t + LAG, t1 = t0 + flightTime(ho, r.g);
  r.flights.push({ who: ev.other, t0, t1, H: ho });
  if (r.flights.length > 6) r.flights.shift();
  r.maxApex = Math.max(r.maxApex, ho);
  if (!r.learn && r.harmony <= 0) { r.done = true; r.endReason = 'slip'; r.endAt = ev.t + 0.9; return; }
  if (r.contacts >= r.lvl.events) { r.done = true; r.endReason = 'complete'; r.endAt = t1 + 0.7; return; }
  r.ev = makeEvent(r, ev.i + 1, ev.other, t0, t1, ho);
}

// Advance the clock by dt: run the computer girl's scheduled edges and close contacts whose windows have passed.
export function step(r, dt) {
  if (r.done) { r.t += dt; r.slipT = Math.max(0, r.slipT - dt); for (const q of r.pops) q.age += dt; return; }
  r.t += dt;
  r.slipT = Math.max(0, r.slipT - dt);
  for (const q of r.pops) q.age += dt;
  r.pops = r.pops.filter((q) => q.age < 1.1);
  for (let guard = 0; guard < 4 && !r.done; guard++) {
    const ev = r.ev;
    for (let p = 0; p < 2; p++) {
      const b = ev.bot[p];
      if (b && b.t !== null && !b.fired && r.t >= b.t) { b.fired = true; edge(r, p, b.role === 'stomp', true); if (r.ev !== ev) break; }
    }
    if (r.ev !== ev || r.done) continue;
    const w = windows(r.lvl, ev.H, r.learn);
    if (r.t >= ev.t + w.good + 0.004) {
      if (ev.sJ === null) setJudge(r, ev, 'stomp', null);
      if (r.ev === ev && ev.rJ === null) setJudge(r, ev, 'spring', null);
      continue;
    }
    break;
  }
}

// What a perfect round would do from here: [{ i, lander, in (seconds from now), H }] for the next n contacts.
export function forecast(r, n) {
  const out = []; let t = r.ev.t, H = r.ev.H, lander = r.ev.lander;
  for (let k = 0; k < n && r.ev.i + k < r.lvl.events; k++) {
    out.push({ i: r.ev.i + k, lander, in: Math.max(0, t - r.t), H });
    const { ho } = launchHeights(H, 'perfect', 'perfect', r.lvl);
    t = t + LAG + flightTime(ho, r.g); H = ho; lander = 1 - lander;
  }
  return out;
}

// The pose-driving state of both girls at the round time t (pure): height above the raised end, vertical speed, air flag.
export function girlsAt(r, t = r.t) {
  const out = [{ y: 0, vy: 0, air: false }, { y: 0, vy: 0, air: false }];
  for (const f of r.flights) {
    if (t >= f.t0 && t <= f.t1) {
      const T = f.t1 - f.t0, u = (t - f.t0) / T, g = 8 * f.H / (T * T);
      out[f.who] = { y: 4 * f.H * u * (1 - u), vy: g * T * (1 - 2 * u) / 2, air: true, u, H: f.H };
    }
  }
  return out;
}

export function summary(r) {
  const acc = r.accN ? r.accSum / r.accN : 0;
  const stars = r.endReason === 'slip' ? 0 : starsOf(r.maxApex, r.lvl);
  return { acc, stars, maxApex: r.maxApex, score: [...r.score], maxLaunch: [...r.maxLaunch], counts: r.counts.map((c) => ({ ...c })), maxChain: r.maxChain, reason: r.endReason, contacts: r.contacts };
}
