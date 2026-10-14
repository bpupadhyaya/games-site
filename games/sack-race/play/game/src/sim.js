// Sack Race engine: pure, deterministic, no DOM. Time only from dt, randomness only from seeded streams.
//
// The runner is an inverted pendulum in the side view: `th` is the lean (radians, + = forward toward the finish line),
// `om` its angular speed. Every tap is also a hop. A tap on the RIGHT half pushes the body forward, a tap on the LEFT half
// rocks it back. A little forward lean is fastest; too far either way and the runner goes over.
//
// Units: metres and seconds. Fixed internal step STEP so the physics never depends on the frame rate.

export const STEP = 1 / 120;
export const LEN = 50;            // Village and Heat races
export const DAILY_LEN = 60;
export const AIR_T = 0.36;        // flight time of one hop
export const EARLY = 0.10;        // a tap this long before the feet land is buffered and counts as perfect
export const LATE_OK = 0.05;      // up to this long after landing is still perfect
export const LATE_SPAN = 0.34;    // after that, quality falls to zero over this time
export const KICK = 0.8;         // angular speed added by one tap (rad/s)
export const J = 0.95;            // forward speed added by one perfect hop (m/s, before the lean factor)
export const DRAG_AIR = 0.9;      // 1/s
export const FR_GROUND = 2.6;     // 1/s while standing on the ground
export const A_AIR = 3.2;         // lean instability in flight (1/s^2)
export const A_GROUND = -14;      // on the ground the feet steady the body
export const DAMP = 0.9;
export const TARGET = 0.17;       // the fastest lean
export const FALL_FWD = 0.95;
export const FALL_BACK = -0.8;
export const RUT_KICK = 0.6;
export const MUD_SLOW = 0.72;
export const DOWN_T = 1.15;       // time spent on the ground after a fall
export const RISE_T = 0.4;
export const SHAKE = 0.07;        // each tap while down shortens the fall
export const COUNT = [0.7, 0.7, 0.55]; // Ready, Set, Go
export const PERFECT_MIN = 0.88;
export const ROSTER = ['Ayu', 'Bayu', 'Citra', 'Dimas', 'Eka', 'Fajar', 'Gita', 'Hendra'];
export const HEATS = [
  { name: 'Village Green', skills: [0.28, 0.36, 0.44] },
  { name: 'Market Field', skills: [0.36, 0.45, 0.54] },
  { name: 'Harvest Fair', skills: [0.5, 0.58, 0.66] },
  { name: 'County Show', skills: [0.66, 0.74, 0.82] },
  { name: 'Regional Cup', skills: [0.8, 0.86, 0.92] },
  { name: 'Grand Champion', skills: [0.9, 0.94, 0.98] },
];
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// A tiny seeded stream (courses are the same for everybody on a given day); never touches env.rng.
export function seeded(seed) {
  let a = (seed >>> 0) || 1;
  const next = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return { next, range: (lo, hi) => lo + next() * (hi - lo), int: (n) => Math.floor(next() * n) };
}

// The speed bonus for a good lean: best at TARGET, falling off either side.
export const leanMul = (th) => clamp(0.8 + 0.4 * (1 - Math.pow((th - TARGET) / 0.5, 2)), 0.5, 1.2);
export const qualityLate = (s) => (s <= LATE_OK ? 1 : clamp(1 - (s - LATE_OK) / LATE_SPAN, 0, 1));

// ---- the course: ruts that pitch the runner, mud that slows, both the same in every lane ---------------------------
export function makeCourse(len, src, level = 0) {
  const ruts = [], mud = [];
  let x = 7 + src.next() * 3;
  const gap = [10, 9.5, 9, 8.5, 8, 7.5];
  while (x < len - 8) {
    ruts.push({ x, w: 1.1, dir: src.next() < 0.5 ? 1 : -1 });
    x += gap[Math.min(level, 5)] + src.next() * 3.5;
  }
  let m = 14 + src.next() * 4;
  while (m < len - 10) {
    if (!ruts.some((r) => Math.abs(r.x - m) < 3)) mud.push({ x: m, w: 2.4 + src.next() * 0.8 });
    m += 16 + src.next() * 6;
  }
  return { len, ruts, mud };
}
export const rutAt = (course, x) => course.ruts.find((r) => x >= r.x && x <= r.x + r.w) || null;
export const mudAt = (course, x) => course.mud.find((m) => x >= m.x && x <= m.x + m.w) || null;

// ---- one runner ----------------------------------------------------------------------------------------------------
function newRacer(id, name, lane, isPlayer, skill, src) {
  return {
    id, name, lane, player: isPlayer, skill, x: 0, v: 0, th: 0, om: 0,
    phase: 'ground', pt: 0, buf: null, mud: false, hops: 0, perfects: 0, lates: 0, falls: 0, earlies: 0,
    finishT: null, downLeft: 0, lastQ: 1, side: 0, anim: 0, rng: src, ai: null, recent: [], dist: 0,
  };
}

// ---- the race ------------------------------------------------------------------------------------------------------
// opts: { mode: 'race'|'clock'|'daily'|'watch', level, day, ghost }
export function newRace(opts, rng) {
  const mode = opts.mode, level = clamp(opts.level | 0, 0, HEATS.length - 1);
  const daily = mode === 'daily';
  const seed = daily ? 5000011 + (opts.day | 0) * 7919 : 1 + rng.int(1e9);
  const src = seeded(seed);
  const len = daily ? DAILY_LEN : LEN;
  const course = makeCourse(len, src, daily ? 3 : level);
  const solo = mode === 'clock';
  const lanes = solo ? 1 : 4;
  const you = solo ? 0 : 2 + src.int(2);   // the two nearest lanes: the biggest figures
  const racers = [];
  const dailyLevel = daily ? 3 : level;
  const skills = HEATS[dailyLevel].skills;
  const names = ROSTER.slice();
  for (let i = 0; i < lanes; i++) {
    if (i === you) { racers.push(newRacer(racers.length, 'You', i, true, 1, seeded(seed ^ 0x9e3779b1))); continue; }
    const k = racers.filter((r) => !r.player).length;
    const nm = names.splice(src.int(names.length), 1)[0];
    const r = newRacer(racers.length, nm, i, false, skills[k % skills.length], seeded(seed + 77 * (i + 1)));
    r.ai = { wait: 0, side: 1, planned: false, hops: 0 };
    racers.push(r);
  }
  return {
    mode, level, len, course, racers, you: racers.findIndex((r) => r.player), t: 0, count: 0, go: false, acc: 0,
    events: [], evSeq: 0, evDone: 0, over: null, order: [], ghost: opts.ghost || null, rec: [], recT: 0, hintsUsed: 0, seed,
  };
}

function emit(race, type, r, extra = {}) {
  race.events.push({ seq: race.evSeq++, type, id: r.id, x: r.x, t: race.t, ...extra });
  if (race.events.length > 120) race.events.splice(0, 40);
}

// Pure lean integration over one phase (used by the engine and by the planner).
export function leanStep(th, om, a, dt) {
  om += (a * th - DAMP * om) * dt;
  return [th + om * dt, om];
}
// Predict the lean when the feet land after hopping with `side` now at lean (th, om).
export function afterHop(th, om, side, kickMul = 1) {
  om += side * KICK * kickMul;
  const n = Math.round(AIR_T / STEP);
  for (let i = 0; i < n; i++) [th, om] = leanStep(th, om, A_AIR, STEP);
  return [th, om];
}

function hop(race, r, side, q) {
  const lm = leanMul(r.th), mm = r.mud ? 0.8 : 1;
  r.v = Math.min(4.4, r.v + J * (0.4 + 0.6 * q) * lm * mm);
  r.om += side * KICK;
  r.phase = 'air'; r.pt = 0; r.buf = null; r.mud = false; r.hops++; r.side = side; r.lastQ = q; r.anim = 0;
  if (q >= PERFECT_MIN) r.perfects++; else if (q < 0.5) r.lates++;
  r.recent.push(side); if (r.recent.length > 4) r.recent.shift();
  emit(race, 'hop', r, { q, side });
}

function land(race, r) {
  r.phase = 'ground'; r.pt = 0;
  r.om += (r.rng.next() - 0.5) * 0.3;       // the natural wobble of a bumpy field
  const rut = rutAt(race.course, r.x);
  if (rut && !r.finishT) { r.om += rut.dir * RUT_KICK; emit(race, 'rut', r, { dir: rut.dir }); }
  if (mudAt(race.course, r.x) && !r.finishT) { r.v *= MUD_SLOW; r.mud = true; emit(race, 'mud', r); }
  emit(race, 'land', r);
  if (r.buf && !r.finishT) hop(race, r, r.buf.side, 1);
  r.buf = null;
}

function topple(race, r, fwd) {
  r.phase = 'down'; r.pt = 0; r.downLeft = DOWN_T; r.falls++; r.v *= 0.2; r.buf = null; r.fwdFall = fwd; r.mud = false;
  emit(race, 'fall', r, { fwd });
}

// A tap from a runner (the player's thumb or the AI's choice). side: +1 forward (right), -1 back (left).
export function tapRacer(race, r, side) {
  if (!race.go || r.finishT != null) return 'none';
  if (r.phase === 'down') { r.downLeft = Math.min(r.downLeft, Math.max(0.25, r.downLeft - SHAKE)); return 'shake'; }
  if (r.phase === 'rise') return 'none';
  if (r.phase === 'ground') { hop(race, r, side, qualityLate(r.pt)); return r.lastQ >= PERFECT_MIN ? 'perfect' : r.lastQ < 0.5 ? 'late' : 'ok'; }
  if (r.phase === 'air') {
    const left = AIR_T - r.pt;
    if (left <= EARLY) { r.buf = { side }; return 'perfect'; }
    r.earlies++; emit(race, 'early', r);
    return 'early';
  }
  return 'none';
}
export function tap(race, side) { return tapRacer(race, race.racers[race.you], side); }

// The best side for a hop right now: looks two hops ahead with the engine's own lean physics.
export function plan(race, r, targetLean = TARGET) {
  const land1 = r.x + r.v * AIR_T;
  const score = (th, om) => {
    if (th > FALL_FWD || th < FALL_BACK) return -9;
    const edge = Math.max(0, th - 0.62) + Math.max(0, -0.5 - th);
    return -Math.abs(th - targetLean) - 0.35 * Math.abs(om) * 0.2 - 2 * edge;
  };
  let best = null;
  for (const s1 of [-1, 1]) {
    let [th, om] = afterHop(r.th, r.om, s1);
    const rut = rutAt(race.course, land1);
    if (rut) om += rut.dir * RUT_KICK;
    let s2best = -99;
    for (const s2 of [-1, 1]) {
      const [t2, o2] = afterHop(th, om, s2);
      s2best = Math.max(s2best, score(t2, o2));
    }
    const sc = score(th, om) * 0.6 + s2best * 0.4;
    if (!best || sc > best.score + 1e-9 || (Math.abs(sc - best.score) < 1e-9 && s1 !== r.side)) best = { side: s1, score: sc, th, om, rut: !!rut };
  }
  return best;
}

// The player's advice: a side, when to tap and the reason in words.
export function advise(race) {
  const r = race.racers[race.you];
  const p = plan(race, r);
  const side = p.side;
  const nextX = r.x + r.v * AIR_T;
  const rut = rutAt(race.course, nextX);
  const ahead = race.course.ruts.find((u) => u.x > r.x && u.x - r.x < 4.5);
  const mudAhead = race.course.mud.find((u) => u.x > r.x && u.x - r.x < 4);
  let why;
  if (r.phase === 'down') why = 'You are down. Tap to shake the sack and get up sooner.';
  else if (r.th > 0.6) why = side < 0 ? 'You are tipping forward. Tap LEFT to rock back before you go over.' : 'Lean is high: keep tapping to recover.';
  else if (r.th < -0.35) why = side > 0 ? 'You are leaning back. Tap RIGHT to rock forward.' : 'Leaning back: recover first.';
  else if (rut) why = `A rut under the next landing will pitch you ${rut.dir > 0 ? 'forward' : 'back'}. ${side > 0 ? 'Tap RIGHT' : 'Tap LEFT'} so the lean ends near the middle.`;
  else if (ahead) why = `A rut ${ahead.dir > 0 ? 'pitches you forward' : 'pitches you back'} in about ${Math.max(1, Math.round(ahead.x - r.x))} metres. Stay near the gold lean.`;
  else if (mudAhead) why = 'Mud ahead: it slows the sack. Land square and keep tapping to get going again.';
  else if (r.phase === 'ground' && r.pt > LATE_OK) why = 'Tap now: the sooner after you land, the stronger the hop.';
  else why = side > 0 ? 'Tap RIGHT, just as your feet land: a little forward lean is fastest.' : 'Tap LEFT, just as your feet land, to rock the lean back to the gold zone.';
  const wait = r.phase === 'air' ? Math.max(0, AIR_T - r.pt - 0.04) : 0;
  return { side, why, wait, th: r.th, pred: p.th, phase: r.phase };
}

// ---- AI ------------------------------------------------------------------------------------------------------------
function aiThink(race, r) {
  const a = r.ai, s = r.skill;
  const target = 0.04 + 0.13 * s;
  const p = plan(race, r, target);
  let side = p.side;
  if (r.rng.next() < 0.025 + (1 - s) * 0.16) side = -side;          // a slip of attention
  const clean = r.rng.next() < 0.3 + 0.68 * s;
  a.wait = clean ? 0 : 0.06 + r.rng.next() * (0.1 + 0.3 * (1 - s));
  a.side = side; a.planned = true;
}
function aiUpdate(race, r, dt) {
  const a = r.ai;
  if (!a || r.finishT != null || !race.go) return;
  if (a.hops !== r.hops) { a.hops = r.hops; a.planned = false; }
  if (r.phase === 'air') {
    // decide just before touchdown, when the lean is what it will be at landing
    if (!a.planned && AIR_T - r.pt <= EARLY * 0.8) aiThink(race, r);
    if (a.planned && a.wait === 0 && !r.buf) r.buf = { side: a.side };
  } else if (r.phase === 'ground') {
    if (!a.planned) aiThink(race, r);
    if (r.pt >= a.wait) { tapRacer(race, r, a.side); a.planned = false; }
  } else a.planned = false;
  void dt;
}

// ---- stepping ------------------------------------------------------------------------------------------------------
function stepRacer(race, r, dt) {
  r.anim += dt;
  if (r.finishT != null) {   // a gentle glide after the line
    r.v = Math.max(0, r.v - 2.6 * dt); r.x += r.v * dt; r.om *= 0.9; r.th += (0 - r.th) * Math.min(1, dt * 4);
    if (r.phase === 'air') { r.pt += dt; if (r.pt >= AIR_T) { r.phase = 'ground'; r.pt = 0; } } else r.pt += dt;
    return;
  }
  if (r.phase === 'air') {
    r.pt += dt;
    [r.th, r.om] = leanStep(r.th, r.om, A_AIR, dt);
    r.v -= r.v * DRAG_AIR * dt;
    r.x += r.v * dt;
    if (r.th > FALL_FWD) return topple(race, r, true);
    if (r.th < FALL_BACK) return topple(race, r, false);
    if (r.pt >= AIR_T) land(race, r);
  } else if (r.phase === 'ground') {
    r.pt += dt;
    [r.th, r.om] = leanStep(r.th, r.om, A_GROUND, dt);
    r.v -= r.v * FR_GROUND * dt;
    r.x += r.v * dt;
    if (r.th > FALL_FWD) topple(race, r, true); else if (r.th < FALL_BACK) topple(race, r, false);
  } else if (r.phase === 'down') {
    r.pt += dt; r.downLeft -= dt; r.v = 0;
    if (r.downLeft <= 0) { r.phase = 'rise'; r.pt = 0; emit(race, 'rise', r); }
  } else if (r.phase === 'rise') {
    r.pt += dt; r.th *= 1 - Math.min(1, dt * 6); r.om = 0;
    if (r.pt >= RISE_T) { r.phase = 'ground'; r.th = 0; r.om = 0; r.pt = 0; }
  }
  if (r.x >= race.len && r.finishT == null && r.phase !== 'down') {
    r.finishT = race.t - (r.x - race.len) / Math.max(0.5, r.v);
    r.place = race.order.length + 1; race.order.push(r.id);
    emit(race, 'finish', r, { place: r.place, time: r.finishT });
  }
}

export function ghostX(ghost, t) {
  if (!ghost || !ghost.xs.length) return null;
  const k = t / ghost.dt, i = Math.floor(k);
  if (i >= ghost.xs.length - 1) return ghost.xs[ghost.xs.length - 1];
  return ghost.xs[i] + (ghost.xs[i + 1] - ghost.xs[i]) * (k - i);
}

export function stepRace(race, dt) {
  if (race.over) return;
  race.acc += dt;
  while (race.acc >= STEP) {
    race.acc -= STEP;
    if (!race.go) {
      race.count += STEP;
      const total = COUNT[0] + COUNT[1] + COUNT[2];
      if (race.count >= total) { race.go = true; race.t = 0; emit(race, 'go', race.racers[0]); }
      continue;
    }
    race.t += STEP;
    for (const r of race.racers) {
      if (!r.player) aiUpdate(race, r, STEP);
      stepRacer(race, r, STEP);
    }
    race.recT += STEP;
    if (race.recT >= 0.1) {
      race.recT -= 0.1;
      const me = race.racers[race.you];
      if (me.finishT == null) race.rec.push(+me.x.toFixed(3));
    }
    const me = race.racers[race.you];
    if (me.finishT != null && !race.over) {
      // the race is over once you are across the line and the rest have had a moment to finish
      race.afterT = (race.afterT || 0) + STEP;
      if (race.afterT > 1.6 || race.racers.every((r) => r.finishT != null)) finishRace(race);
    }
    if (race.t > 120 && !race.over) finishRace(race);
  }
}

function finishRace(race) {
  const me = race.racers[race.you];
  // places: finishers by time, then the rest by distance
  const order = race.racers.slice().sort((a, b) => {
    if (a.finishT != null && b.finishT != null) return a.finishT - b.finishT;
    if (a.finishT != null) return -1;
    if (b.finishT != null) return 1;
    return b.x - a.x;
  });
  const place = order.indexOf(me) + 1;
  race.over = { place, time: me.finishT, field: order.map((r) => ({ id: r.id, name: r.name, time: r.finishT, x: r.x, player: r.player })), done: me.finishT != null };
}

// ---- helpers for the view ------------------------------------------------------------------------------------------
export function standings(race) {
  return race.racers.slice().sort((a, b) => {
    if (a.finishT != null && b.finishT != null) return a.finishT - b.finishT;
    if (a.finishT != null) return -1;
    if (b.finishT != null) return 1;
    return b.x - a.x;
  });
}
export const placeNow = (race) => standings(race).findIndex((r) => r.player) + 1;
export const ordinal = (n) => (n === 1 ? '1st' : n === 2 ? '2nd' : n === 3 ? '3rd' : `${n}th`);
export const fmtTime = (t) => (t == null ? '--.--' : t.toFixed(2));
