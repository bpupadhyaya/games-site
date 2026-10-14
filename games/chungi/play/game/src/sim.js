// Chungi simulation: a ball of tied rubber bands in a narrow alley. Gravity, light drag, wind, ricochets off the walls, kicks decided
// by contact height and by which side the player taps, hoops, tricks and scoring. Pure and deterministic: randomness only from
// the rng streams handed in, time only from dt. Everything is plain objects so getState() is serializable.

export const G = 11;            // gravity (units per s squared; one unit is about a metre)
export const R = 0.05;          // ball radius: a real band ball is about 10 cm across (a large mango)
export const DRAG = 0.18;       // linear air drag per second
export const WALL_E = 0.8;      // wall restitution (the bands are lively)
export const REACH_X = 1.0;     // how far from the kid's feet a ball can be struck
export const REACH_Y = 1.3;     // highest strike
export const KID_SPEED = 5.0;   // how fast the kid slides under the ball
export const HALF0 = 2.6;       // alley half width at the start
export const HALF_MIN = 1.75;    // and when it is narrowest
export const SESSION = 24;      // kicks in a Watch & Learn session
export const HOOP_R = 0.75;     // half width of a hoop

export const KINDS = {
  toe: { name: 'Toe poke', c: 0.25, vy: 10.4, aim: 2.8, noise: 0.5, base: 12 },
  inside: { name: 'Inside foot', c: 0.7, vy: 8.4, aim: 3.4, noise: 0.3, base: 10 },
  knee: { name: 'Knee pop', c: 1.1, vy: 6.8, aim: 2.6, noise: 0.2, base: 16 },
};
export const kindAt = (y) => (y < 0.45 ? 'toe' : y < 0.95 ? 'inside' : 'knee');

export const TRICKS = [
  { id: 'corner', name: 'Corner Pocket', pts: 40, how: 'Ricochet off the left wall and the right wall in one flight' },
  { id: 'roof', name: 'Rooftop', pts: 30, how: 'Send the ball up past the upper windows, almost five units high, and catch it' },
  { id: 'triple', name: 'Triple Toe', pts: 45, how: 'Three toe pokes in a row' },
  { id: 'needle', name: 'Needle', pts: 60, how: 'Thread a hoop with the ball you kicked Perfectly' },
  { id: 'bank', name: 'Bank Shot', pts: 50, how: 'Thread a hoop right after a ricochet' },
];

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
// A small seeded stream (the daily alley is the same for everybody) that never touches env.rng.
export function seeded(seed) {
  let s = (seed >>> 0) || 1;
  const next = () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  return { next, range: (a, b) => a + (b - a) * next() };
}
const gauss = (r) => (r.next() + r.next() + r.next() + r.next() - 2) * 1.2247;

// ---- wind ------------------------------------------------------------------------------------------------------------
export function makeWind(src) {
  const gusts = [];
  let t = 2 + src.range(0, 3);
  for (let i = 0; i < 80; i++) { gusts.push({ t0: t, dur: 1.2 + src.range(0, 1.2), a: (src.next() < 0.5 ? -1 : 1) * (0.5 + src.next() * 0.7) }); t += 3.5 + src.range(0, 4); }
  return { p1: src.range(0, 6.28), p2: src.range(0, 6.28), gusts };
}
export function windAt(run, t) {
  const w = run.wind, A = run.windAmp;
  let v = 0.5 * Math.sin(0.5 * t + w.p1) + 0.3 * Math.sin(1.13 * t + w.p2);
  for (const g of w.gusts) {
    if (t < g.t0) break;
    const u = (t - g.t0) / g.dur;
    if (u >= 0 && u <= 1) v += g.a * Math.pow(Math.sin(Math.PI * u), 2);
  }
  return A * v;
}
export const windForecast = (run, from, secs, n) => { const o = []; for (let i = 0; i < n; i++) o.push(windAt(run, from + (secs * i) / (n - 1))); return o; };

// ---- the ball ---------------------------------------------------------------------------------------------------------
// The ball's y is its centre above the ground contact line (the floor is drawn R below y = 0).
// One physics step. Returns 0 (nothing), -1 (hit the left wall), +1 (hit the right wall); `impact` is set to the speed lost.
export function stepBall(b, dt, ax, half, g = G) {
  const n = 2, h = dt / n;
  let hit = 0;
  for (let i = 0; i < n; i++) {
    b.vx += (ax - DRAG * b.vx) * h;
    b.vy += (-g - DRAG * b.vy) * h;
    b.x += b.vx * h; b.y += b.vy * h;
    const lim = half - R;
    if (b.x > lim) { b.x = lim; if (b.vx > 0) { b.vx = -b.vx * WALL_E; hit = 1; } }
    else if (b.x < -lim) { b.x = -lim; if (b.vx < 0) { b.vx = -b.vx * WALL_E; hit = -1; } }
  }
  return hit;
}
const cloneBall = (b) => ({ x: b.x, y: b.y, vx: b.vx, vy: b.vy });
export const halfFor = (mode, streak) => Math.max(HALF_MIN, HALF0 - 0.02 * streak);

// Where the ball will be when it falls to height yTo (wind held at its value now). Includes the walls.
export function predictFall(b, ax, half, yTo = 0.7, g = G) {
  const s = cloneBall(b);
  let t = 0, rico = 0;
  for (let i = 0; i < 360; i++) {
    if (stepBall(s, 1 / 30, ax, half, g) !== 0) rico++;
    t += 1 / 30;
    if (s.vy < 0 && s.y <= yTo) break;
  }
  return { x: s.x, y: s.y, t, rico };
}

// ---- a run -------------------------------------------------------------------------------------------------------------
export function newRun({ mode, day = 0 }, rng) {
  const daily = mode === 'daily';
  const src = seeded(daily ? 100003 + day * 7919 : 1 + rng.int(1e9));
  const run = {
    mode, daily, t: 0, streak: 0, points: 0, mult: 1, perfects: 0, hints: 0, lock: 0, over: null,
    ball: { x: src.range(-0.8, 0.8), y: 5.2, vx: 0, vy: 0, ang: 0, av: 0, sq: 0, sqA: 0 },
    kid: { x: 0, anim: null, dir: 1 },
    kinds: [], kickKinds: [], tricks: [], trickNames: [],
    g: 1, half: HALF0, windAmp: daily ? 0.5 : 0.25, wind: makeWind(src), wx: 0,
    src, rings: 0, hoop: null, hoopChain: 0, hoopsDone: 0, flight: { rico: 0, sides: [], apex: 0, perfect: false },
    tuft: [], trail: [], cam: 0, events: [], seq: 0, evDone: 0, kicksBy: { toe: 0, inside: 0, knee: 0 }, wallHits: 0, ricoTotal: 0,
  };
  for (let i = 0; i < 6; i++) run.tuft.push({ x: run.ball.x, y: run.ball.y + 0.2 * i });
  if (mode !== 'street') nextHoop(run);
  return run;
}
function nextHoop(run) {
  const half = Math.max(HALF_MIN, run.half), s = run.src;
  const lvl = Math.min(1, run.hoopsDone / 8);
  const maxY = (KINDS.toe.vy * KINDS.toe.vy) / (2 * G * run.g) - 0.2;
  const y = Math.min(maxY, 2.6 + s.next() * (0.7 + 1.3 * lvl));
  const span = half - HOOP_R - 0.2;
  run.hoop = { x: (s.next() * 2 - 1) * span, y, r: Math.max(0.5, HOOP_R - 0.03 * run.hoopsDone), id: run.hoopsDone + 1 };
}
const emit = (run, e) => { e.seq = run.seq++; run.events.push(e); if (run.events.length > 24) run.events.shift(); };

export const canKick = (run) => {
  const b = run.ball;
  return !run.over && run.lock <= 0 && b.y <= REACH_Y && b.y > 0.04 && b.vy <= 2.5 && Math.abs(b.x - run.kid.x) <= REACH_X;
};
export const inReachZone = (run) => run.ball.y <= REACH_Y && run.ball.vy <= 2.5;

// Shared by the real kick and by advise(): the launch for a contact at height y, offset dx and tap at tapX.
export function launch(ball, kidX, tapX, perfectOK = true) {
  const kind = kindAt(ball.y), K = KINDS[kind];
  const a = clamp((tapX - ball.x) / 1.6, -1, 1);
  const off = ball.x - kidX;
  const perfect = perfectOK && Math.abs(off) < 0.25 && Math.abs(ball.y - K.c) < 0.12;
  const vy = K.vy * (perfect ? 1.06 : 1);
  const vx = a * K.aim + 0.2 * ball.vx + off * 1.0;
  return { kind, vx, vy, perfect, a, off };
}

export function kick(run, tapX, rng) {
  if (!canKick(run)) return null;
  const b = run.ball, L = launch(b, run.kid.x, tapX), K = KINDS[L.kind];
  const noise = L.perfect ? 0 : K.noise * (0.35 + 0.65 * clamp(Math.abs(b.x - run.kid.x) / REACH_X, 0, 1) + 0.25);
  b.vx = L.vx + gauss(rng) * noise * 0.8;
  b.vy = L.vy + (L.perfect ? 0 : gauss(rng) * 0.25);
  b.av = (b.vx * 1.2) + gauss(rng) * 2;
  b.sq = 1; b.sqA = Math.PI / 2;
  run.lock = 0.22;
  // scoring
  const rico = run.flight.rico;
  const f = run.flight;
  const trickIds = [];
  run.streak++;
  run.kickKinds.push(L.kind); if (run.kickKinds.length > 6) run.kickKinds.shift();
  run.kicksBy[L.kind]++;
  const recent = run.kickKinds.slice(-4), distinct = new Set(recent).size;
  run.mult = 1 + 0.25 * Math.min(2, distinct - 1);
  const base = K.base + (L.perfect ? 10 : 0) + 6 * rico;
  const gained = Math.round(base * run.mult);
  run.points += gained;
  if (L.perfect) run.perfects++;
  if (f.apex >= 4.8) trickIds.push('roof');
  if (f.sides.includes(-1) && f.sides.includes(1)) trickIds.push('corner');
  const ln = run.kickKinds.length;
  if (ln >= 3 && run.kickKinds.slice(-3).every((k) => k === 'toe')) trickIds.push('triple');
  let trick = null;
  for (const id of trickIds) { const T = TRICKS.find((q) => q.id === id); run.points += T.pts; run.tricks.push(id); run.trickNames.push(T.name); trick = T.name; }
  run.flight = { rico: 0, sides: [], apex: b.y, perfect: L.perfect };
  run.kid.anim = { t: 0, kind: L.kind, side: L.a >= 0 ? 1 : -1, perfect: L.perfect };
  const rec = { type: 'kick', who: 0, kind: L.kind, perfect: L.perfect, gained, x: b.x, y: b.y, a: L.a, trick, rico };
  emit(run, rec);
  return rec;
}

function kidTrack(run, dt) {
  const k = run.kid, b = run.ball;
  let target;
  if (b.vy < 0.5 && b.y < 4.5) target = predictFall(b, run.wx * 0.9, run.half, 0.7, G * run.g).x;
  else target = clamp(b.x * 0.5, -run.half + 0.6, run.half - 0.6);
  target = clamp(target, -run.half + 0.45, run.half - 0.45);
  const d = clamp(target - k.x, -KID_SPEED * dt, KID_SPEED * dt);
  k.x += d; if (Math.abs(d) > 1e-4) k.dir = d > 0 ? 1 : -1;
  k.run = Math.abs(d) / (KID_SPEED * dt);
  if (k.anim) { k.anim.t += dt; if (k.anim.t > 0.45) k.anim = null; }
}

export function stepRun(run, dt, rng, kickRng) {
  if (run.over) return;
  void rng; void kickRng;
  run.t += dt;
  run.lock = Math.max(0, run.lock - dt);
  const tgt = halfFor(run.mode, run.streak);
  run.half += clamp(tgt - run.half, -0.4 * dt, 0.4 * dt);
  run.windAmp = (run.daily ? 0.5 : 0.25) + Math.min(1.1, run.streak * 0.025);
  run.wx = windAt(run, run.t);
  run.g = 1 + Math.min(0.45, run.streak * 0.005);
  const b = run.ball, py = b.y, ax = run.wx * 0.9;
  const hit = stepBall(b, dt, ax, run.half, G * run.g);
  b.ang += b.av * dt; b.av *= (1 - 0.35 * dt);
  b.sq = Math.max(0, b.sq - dt * 5.5);
  if (b.y > run.flight.apex) run.flight.apex = b.y;
  if (hit !== 0) {
    run.flight.rico++; run.ricoTotal++; if (!run.flight.sides.includes(hit)) run.flight.sides.push(hit);
    b.sq = 0.8; b.sqA = hit > 0 ? 0 : Math.PI;
    const bonus = 5 * run.flight.rico;
    run.points += bonus;
    emit(run, { type: 'wall', side: hit, x: b.x, y: b.y, bonus });
  }
  // hoop: the ball must come down through it
  const h = run.hoop;
  if (h && py > h.y && b.y <= h.y && b.vy < 0 && Math.abs(b.x - h.x) <= h.r - 0.05) {
    run.hoopsDone++; run.hoopChain++;
    const pts = 50 + 10 * Math.min(10, run.hoopChain - 1);
    run.points += pts;
    let trick = null;
    if (run.flight.perfect) { trick = 'Needle'; run.tricks.push('needle'); run.trickNames.push(trick); run.points += 60; }
    else if (run.flight.rico > 0) { trick = 'Bank Shot'; run.tricks.push('bank'); run.trickNames.push(trick); run.points += 50; }
    emit(run, { type: 'hoop', x: h.x, y: h.y, pts, trick, n: run.hoopsDone });
    nextHoop(run);
  }
  kidTrack(run, dt);
  // the soft tuft streams behind the ball
  let px = b.x - b.vx * 0.012, py2 = b.y - b.vy * 0.012 + 0.02;
  for (let i = 0; i < run.tuft.length; i++) {
    const p = run.tuft[i], k = Math.min(1, dt * (16 - i * 1.6));
    p.x += (px - p.x) * k; p.y += (py2 - 0.09 - p.y) * k; p.y -= 0.9 * dt * (i + 1) * 0.12;
    px = p.x; py2 = p.y;
  }
  run.trail.push({ x: b.x, y: b.y }); if (run.trail.length > 9) run.trail.shift();
  run.cam += (Math.max(0, b.y - 3.8) * 0.5 - run.cam) * Math.min(1, dt * 3);
  if (b.y <= 0.02 && b.vy < 0) {
    run.over = { streak: run.streak, points: run.points, done: false, x: b.x, wide: Math.abs(b.x - run.kid.x) };
    b.y = 0.02; emit(run, { type: 'drop', x: b.x });
  }
}

// ---- advice: what a good player would do next ---------------------------------------------------------------------------------
const AIMS = [-1, -0.875, -0.75, -0.625, -0.5, -0.375, -0.25, -0.125, 0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1];
// Simulate one candidate flight from the moment of the kick; no random noise. Returns where it ends.
function flightOf(run, ball0, kidX, tapX, tStart, t0y, rec = null) {
  const b = cloneBall(ball0); b.y = t0y;
  const L = launch(b, kidX, tapX);
  b.vx = L.vx; b.vy = L.vy;
  const hoop = run.hoop;
  let t = 0, rico = 0, threaded = false, apex = b.y, prevY = b.y;
  const half = run.half;
  for (let i = 0; i < 300; i++) {
    const ax = windAtTime(run, tStart + t) * 0.9;
    if (stepBall(b, 1 / 30, ax, half, G * run.g) !== 0) rico++;
    t += 1 / 30;
    if (rec && (i & 1) === 0) rec.push({ x: b.x, y: b.y });
    if (b.y > apex) apex = b.y;
    if (hoop && !threaded && prevY > hoop.y && b.y <= hoop.y && b.vy < 0 && Math.abs(b.x - hoop.x) <= hoop.r - 0.1) threaded = true;
    prevY = b.y;
    if (b.vy < 0 && b.y <= 0.7) break;
  }
  return { x: b.x, t, rico, threaded, apex, kind: L.kind, vx: L.vx, vy: L.vy };
}
const apex5 = (a) => a;
const windAtTime = (run, t) => windAt(run, t);

// When the ball is falling and not yet in reach: choose the contact height and the tap side. Returns { aim, y, tapX, kind, why, ... }.
export function advise(run) {
  const b = run.ball;
  // where and when the ball will be at the strike height
  const strikeYs = [0.7, 0.25, 1.1];
  let best = null;
  const probe = cloneBall(b);
  for (const sy of strikeYs) {
    const f = predictFall(probe, run.wx * 0.9, run.half, sy, G * run.g);
    const kidX = clamp(f.x, -run.half + 0.45, run.half - 0.45);
    for (const a of AIMS) {
      const tapX = f.x + a * 1.6;
      const r = flightOf(run, { x: f.x, y: sy, vx: 0, vy: -3 }, kidX, tapX, run.t + f.t, sy);
      const land = r.x;
      const reach = KID_SPEED * r.t + REACH_X - 0.25;
      let score = -Math.abs(land) * 1.1;
      if (Math.abs(land - kidX) > reach) score -= 8;
      if (r.threaded) score += 20;
      score += 0.35 * Math.min(apex5(r.apex), 5);
      score += Math.min(1.5, r.rico * 0.4);
      if (r.apex < 2.2) score -= 3;
      if (sy < 0.5) score -= 0.25;
      if (sy > 1) score -= 0.9;
      // a toe poke is only worth it when the hoop is high
      if (sy < 0.5 && run.hoop && run.hoop.y < 4) score -= 1.2;
      if (!best || score > best.score) best = { score, aim: a, y: sy, tapX, kind: r.kind, threaded: r.threaded, land, rico: r.rico, apex: r.apex, t: f.t, fx: f.x };
    }
  }
  const path = [{ x: best.fx, y: best.y }];
  flightOf(run, { x: best.fx, y: best.y, vx: 0, vy: -3 }, clamp(best.fx, -run.half + 0.45, run.half - 0.45), best.tapX, run.t + best.t, best.y, path);
  best.path = path;
  const dir = best.aim < -0.15 ? 'left' : best.aim > 0.15 ? 'right' : 'straight up';
  const tapTxt = dir === 'straight up' ? 'Tap right on the ball to send it straight up' : `Tap to the ${dir} of the ball to send it ${dir}`;
  let why;
  if (best.threaded) why = `${tapTxt}: the ${KINDS[best.kind].name.toLowerCase()} drops down through the hoop${best.rico ? ' after a ricochet' : ''}.`;
  else if (run.hoop && Math.abs(run.hoop.x) > 0.5) why = `${tapTxt}. The hoop is on the ${run.hoop.x < 0 ? 'left' : 'right'}; this keeps the ball safely under it.`;
  else why = `${tapTxt}: it comes back near the middle of the alley, where the kid can reach it.`;
  return { ...best, dir, why };
}
