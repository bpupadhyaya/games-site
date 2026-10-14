// The whole rules engine: pure, deterministic, no drawing. game.js owns flow and input, view.js draws. Every number the Rules page
// quotes comes from here (content.js imports it), so the pages cannot drift from the game.
//
// An EVENT is a short programme in the arena: rope tricks (floreos) to a beat, then runs where a horse runs along
// a rail and you throw the loop to catch it. A computer charro performs the same programme and the higher total wins.

export const LEVELS = ['apprentice', 'charro', 'maestro'];
export const LEVEL_NAMES = { apprentice: 'Apprentice', charro: 'Charro', maestro: 'Maestro' };
export const LEVEL_BLURB = {
  apprentice: 'Slow beat, wide timing windows, a slow target and a generous loop. The rival is gentle.',
  charro: 'A lively beat, tighter timing and a quicker target. The rival is steady.',
  maestro: 'A fast beat, tight timing and a fast target. The rival rarely misses.',
};
// bpm: beats per minute. perfect/good: timing windows in seconds either side of the beat. speed: target speed multiplier.
// tol: catch tolerance multiplier. skill: how well the rival performs (0..1).
export const LV = {
  apprentice: { bpm: 78, perfect: 0.095, good: 0.19, speed: 0.82, tol: 1.3, skill: 0.5 },
  charro: { bpm: 96, perfect: 0.075, good: 0.15, speed: 1.0, tol: 1.0, skill: 0.7 },
  maestro: { bpm: 114, perfect: 0.06, good: 0.12, speed: 1.22, tol: 0.8, skill: 0.88 },
};
export const levelInfo = (l) => LV[l] || LV.charro;
export const LEN_STEPS = [3, 5, 7];                 // tricks per event
export const RUN_STEPS = { 3: 2, 5: 3, 7: 4 };      // target runs per event
export const COUNT_IN = 2;                          // beats counted before the first note of a trick
export const REL_MUL = 1.5;                         // the window for letting go of a held note is this much wider
export const COMBO_STEP = 4, COMBO_MAX = 4;         // every 4 clean hits in a row raises the multiplier, up to x4
export const PTS = { perfect: 100, good: 60, releaseMiss: 20 };

// ---- the tricks -----------------------------------------------------------------------------------------------------------------
// notes: b = beat after the count-in, h = beats the note is held (a held note is a press at b and a release at b + h).
export const TRICKS = {
  vuelta: { name: 'Vuelta', en: 'Hoop spin', tier: 1, notes: [{ b: 0 }, { b: 1 }, { b: 2 }, { b: 3 }],
    desc: 'The loop spins flat over your head, one tap on every beat.' },
  media: { name: 'Media vuelta', en: 'Half-time spin', tier: 1, notes: [{ b: 0 }, { b: 1 }, { b: 2 }, { b: 2.5 }, { b: 3 }],
    desc: 'A steady spin with a quick double beat in the middle.' },
  flor: { name: 'Flor de oro', en: 'Golden flower', tier: 2, notes: [{ b: 0 }, { b: 1 }, { b: 2, h: 2 }, { b: 5 }],
    desc: 'The loop draws a flower in the air: two taps, then HOLD for two beats while it blooms, then one more tap.' },
  entrada: { name: 'Entrada', en: 'Walk-through', tier: 2, notes: [{ b: 0 }, { b: 1, h: 1.5 }, { b: 3 }, { b: 4 }],
    desc: 'The loop stands up beside you and you step through it: a tap, a held step, then two taps.' },
  mariposa: { name: 'Mariposa', en: 'Butterfly', tier: 3, notes: [{ b: 0 }, { b: 0.5 }, { b: 1 }, { b: 2 }, { b: 2.5 }, { b: 3 }, { b: 4 }],
    desc: 'Fast figure-eights with quick pairs of taps.' },
  salto: { name: 'Salto', en: 'Jump-through', tier: 3, notes: [{ b: 0 }, { b: 1 }, { b: 2, h: 1 }, { b: 4 }, { b: 4.5 }, { b: 5 }],
    desc: 'You jump through a big loop: a held crouch, then a quick run of three taps.' },
};
export const TRICK_IDS = Object.keys(TRICKS);
export const trickInfo = (id) => TRICKS[id] || TRICKS.vuelta;

// ---- building an event ------------------------------------------------------------------------------------------------------------
export function newEvent({ level, len, rng }) {
  const n = LEN_STEPS.includes(len) ? len : 5, r = RUN_STEPS[n], lv = levelInfo(level);
  // choose the tricks: gentle ones first, harder ones later; the Golden flower is always in the programme
  const maxTier = level === 'apprentice' ? 2 : 3;
  const ids = [];
  for (let i = 0; i < n; i++) {
    const tier = Math.min(maxTier, 1 + Math.floor((i * 3) / n));
    const pool = TRICK_IDS.filter((id) => TRICKS[id].tier === tier && id !== ids[i - 1]);
    ids.push(pool[Math.floor(rng.next() * pool.length)]);
  }
  if (!ids.includes('flor')) ids[Math.min(1, n - 1)] = 'flor';
  // the programme: tricks, with a run after every few of them, always ending with a run
  const plan = [], after = new Set();
  for (let k = 0; k < r; k++) after.add(Math.ceil(((k + 1) * n) / r) - 1);
  ids.forEach((id, i) => { plan.push({ kind: 'trick', id }); if (after.has(i)) plan.push({ kind: 'run' }); });
  const rf = rng.fork();
  const rival = plan.map((p) => rivalPart(p, lv.skill, rf));
  return { level, len: n, plan, step: 0, score: [0, 0], log: [], rival, done: false, winner: -1, names: ['You', rivalName(level)], stars: 0, best: { trick: 0, run: 0 } };
}
export const rivalName = (level) => (level === 'apprentice' ? 'Don Chema' : level === 'maestro' ? 'Don Aurelio' : 'Don Rafael');

function rivalPart(p, skill, rf) {
  if (p.kind === 'trick') {
    const par = Math.round(maxTrickScore(p.id) * 0.74), f = clampN(skill + (rf.next() - 0.5) * 0.4, 0.25, 1.08);
    return Math.round(par * f);
  }
  const r = rf.next(), q = rf.next();
  if (r < skill) return q < 0.35 ? Math.round(MAX_RUN * 0.62) : Math.round(MAX_RUN * 0.5);
  return q < 0.3 ? 40 : 0;
}
const clampN = (v, a, b) => Math.max(a, Math.min(b, v));
const mult = (combo) => 1 + Math.min(COMBO_MAX - 1, Math.floor(combo / COMBO_STEP));

// ---- a trick: notes on a beat ----------------------------------------------------------------------------------------------------
// `t0` is the time (seconds on the trick's own clock) of note beat 0. The count-in comes before it.
export function newTrick(id, level) {
  const lv = levelInfo(level), per = 60 / lv.bpm, info = trickInfo(id), t0 = COUNT_IN * per;
  const notes = info.notes.map((q, i) => ({ i, b: q.b, t: t0 + q.b * per, hold: q.h ? q.h : 0, rel: q.h ? t0 + (q.b + q.h) * per : 0, state: 'wait', pg: null, rg: null, pts: 0 }));
  const last = notes[notes.length - 1];
  return { id, level, per, t0, notes, end: (last.rel || last.t) + per * 1.6, combo: 0, bestCombo: 0, score: 0, hits: 0, perfects: 0, misses: 0, stray: 0 };
}
export const trickOver = (tr, t) => t >= tr.end;
const gradeOf = (d, lv, mul = 1) => (d <= lv.perfect * mul ? 'perfect' : d <= lv.good * mul ? 'good' : null);
const bump = (tr, pts, ok) => {
  if (ok) { tr.combo++; tr.bestCombo = Math.max(tr.bestCombo, tr.combo); } else tr.combo = 0;
  const g = pts * mult(Math.max(0, ok ? tr.combo - 1 : 0)); tr.score += Math.round(g);
  return Math.round(g);
};

// A press at time t. Returns { note, grade, gained } for a hit, or { stray: true } when it is not near any waiting note.
export function pressAt(tr, t) {
  const lv = levelInfo(tr.level);
  let best = null, bd = 1e9;
  for (const n of tr.notes) { if (n.state !== 'wait') continue; const d = Math.abs(t - n.t); if (d <= lv.good && d < bd) { bd = d; best = n; } }
  if (!best) {
    // a tap before the count-in is over, or far from every note, only breaks the combo
    const near = tr.notes.some((n) => n.state === 'wait' && t > n.t - lv.good * 2.4 && t < n.t + lv.good);
    if (near) { tr.stray++; tr.combo = 0; }
    return { stray: true };
  }
  best.pg = gradeOf(bd, lv); best.hitT = t;
  const base = PTS[best.pg];
  tr.hits++; if (best.pg === 'perfect') tr.perfects++;
  if (best.hold) { best.state = 'held'; best.pts = base * 0.5; return { note: best, grade: best.pg, gained: 0, held: true }; }
  best.state = 'done'; best.pts = base;
  return { note: best, grade: best.pg, gained: bump(tr, base, true) };
}
// The finger comes up at time t: judges a held note.
export function releaseAt(tr, t) {
  const lv = levelInfo(tr.level);
  const n = tr.notes.find((q) => q.state === 'held'); if (!n) return null;
  const d = Math.abs(t - n.rel), g = gradeOf(d, lv, REL_MUL);
  n.rg = g; n.state = 'done';
  const add = g ? PTS[g] * 0.5 : PTS.releaseMiss * 0.5;
  n.pts += add;
  return { note: n, grade: g || 'late', gained: bump(tr, n.pts, !!g), ok: !!g };
}
// Time moves on to t: notes nobody tapped are missed; a held note nobody released is closed.
export function expire(tr, t) {
  const lv = levelInfo(tr.level), out = [];
  for (const n of tr.notes) {
    if (n.state === 'wait' && t > n.t + lv.good) { n.state = 'miss'; n.pg = null; tr.misses++; tr.combo = 0; out.push({ note: n, grade: 'miss' }); }
    else if (n.state === 'held' && t > n.rel + lv.good * REL_MUL) { n.rg = null; n.state = 'done'; n.pts += PTS.releaseMiss * 0.5; bump(tr, n.pts, false); out.push({ note: n, grade: 'late', ok: false }); }
  }
  return out;
}
export const nextNote = (tr) => tr.notes.find((n) => n.state === 'wait' || n.state === 'held') || null;
export function trickAccuracy(tr) { return tr.notes.reduce((a, n) => a + n.pts, 0) / (tr.notes.length * PTS.perfect); }
export function starsFor(acc) { return acc >= 0.9 ? 3 : acc >= 0.7 ? 2 : acc >= 0.4 ? 1 : 0; }
export function maxTrickScore(id) {
  const tr = newTrick(id, 'charro');
  let combo = 0, total = 0;
  for (const n of tr.notes) { total += PTS.perfect * mult(combo); combo++; void n; }
  return total;
}

// ---- a run: the target and the loop ------------------------------------------------------------------------------------------------
export const GATE = 0.5;           // where the loop comes down (the painted post), as a fraction of the rail
export const MAX_RUN = 140;
export const LOOP = { minHold: 0.15, fullHold: 1.05, minSize: 0.15, maxFlight: 0.95, cool: 1.0 };
export function newRun(level, rng) {
  const lv = levelInfo(level);
  const D = (4.6 + rng.next() * 0.8) / lv.speed;
  return { dir: rng.next() < 0.5 ? 1 : -1, D, k: (0.3 + rng.next() * 0.12) * (rng.next() < 0.5 ? 1 : -1), n: rng.next() < 0.5 ? 1 : 2, level, throws: 0, maxThrows: 2 };
}
// the target's place on the rail at time t (0 = left end, 1 = right end; it starts and ends a little off the ends)
export function xAt(run, t) {
  const u = t / run.D + (run.k * Math.sin((2 * Math.PI * run.n * t) / run.D)) / (2 * Math.PI * run.n);
  const xr = -0.18 + 1.36 * u;
  return run.dir > 0 ? xr : 1 - xr;
}
export const sizeOfHold = (h) => clampN((h - LOOP.minHold) / (LOOP.fullHold - LOOP.minHold), LOOP.minSize, 1);
export const flightTime = (size) => 0.4 + 0.55 * size;
export const tolOf = (size, level) => (0.032 + 0.07 * size) * levelInfo(level).tol;
export const styleMul = (size) => 1.5 - 0.5 * size;      // a tighter loop is worth more
// Where the target is when a loop thrown at time tr (with `size`) comes down.
export function judgeThrow(run, tr, size) {
  const T = flightTime(size), ta = tr + T, x = xAt(run, ta), err = Math.abs(x - GATE), tol = tolOf(size, run.level), r = err / tol;
  const inside = ta <= run.D && x > 0 && x < 1;
  let grade = 'miss', base = 0;
  if (inside) { if (r <= 0.35) { grade = 'clean'; base = 100; } else if (r <= 0.7) { grade = 'good'; base = 70; } else if (r <= 1) { grade = 'brush'; base = 40; } }
  const pts = grade === 'miss' ? 0 : Math.round(base * styleMul(size));
  return { grade, pts, ta, x, err, tol, r, T, early: x - GATE };
}
// The moment to let go for a dead-centre catch with `size`: scans the run (the target only moves one way).
export function idealRelease(run, size) {
  const T = flightTime(size);
  let best = 0, bd = 1e9;
  for (let t = 0; t <= run.D; t += 0.004) { const d = Math.abs(xAt(run, t + T) - GATE); if (d < bd) { bd = d; best = t; } }
  const tol = tolOf(size, run.level);
  let a = best, b = best;
  while (a > 0 && Math.abs(xAt(run, a - 0.004 + T) - GATE) <= tol * 0.35) a -= 0.004;
  while (b < run.D && Math.abs(xAt(run, b + 0.004 + T) - GATE) <= tol * 0.35) b += 0.004;
  return { t: best, a, b, size, T };
}

// ---- keeping the event: results, plans for the computer --------------------------------------------------------------------------
export function finishPart(ev, kind, id, pts, extra = {}) {
  const i = ev.step;
  ev.score[0] += pts; ev.score[1] += ev.rival[i];
  ev.log.push({ i, kind, id, pts, rival: ev.rival[i], ...extra });
  if (kind === 'trick') ev.best.trick = Math.max(ev.best.trick, pts); else ev.best.run = Math.max(ev.best.run, pts);
  ev.step++;
  if (ev.step >= ev.plan.length) { ev.done = true; ev.winner = ev.score[0] > ev.score[1] ? 0 : ev.score[1] > ev.score[0] ? 1 : -1; }
}
export function invariant(ev) {
  const a = ev.log.reduce((s, e) => s + e.pts, 0), b = ev.log.reduce((s, e) => s + e.rival, 0);
  return a === ev.score[0] && b === ev.score[1] && ev.log.length === ev.step;
}
// Auto Play: how a computer charro performs a trick (a time offset for every press and release) and a run (size and release time).
export function planTrick(tr, skill, rng) {
  const lv = levelInfo(tr.level), sig = lv.good * (1.25 - skill) * 0.9;
  return tr.notes.map((n) => ({ press: n.t + (rng.next() * 2 - 1) * sig, release: n.hold ? n.rel + (rng.next() * 2 - 1) * sig * 1.2 : 0 }));
}
export function planRun(run, skill, rng) {
  const size = clampN(0.45 + rng.next() * 0.35, 0.3, 0.85), ir = idealRelease(run, size), tol = tolOf(size, run.level);
  const v = Math.abs(xAt(run, ir.t + ir.T + 0.05) - xAt(run, ir.t + ir.T)) / 0.05 || 0.3;
  const miss = rng.next() > skill + 0.12 ? 1.3 : 1;                 // sometimes the computer simply misjudges the lead
  const off = ((rng.next() * 2 - 1) * (1.1 - skill) * tol * 0.8 * miss) / v;
  return { size, t: Math.max(0.2, ir.t + off), ideal: ir.t, hold: LOOP.minHold + ((size - LOOP.minSize) / (1 - LOOP.minSize)) * (LOOP.fullHold - LOOP.minHold) };
}
