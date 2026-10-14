// Plate Spinning: the rules engine. Pure and deterministic: the clock is the dt handed to stepShow, randomness is the rng handed in.
// Everything the Rules page quotes comes from the TUNE and TYPES tables below.
//
// A "show" is one performance. It has up to 8 poles; a pole holds one plate with spin energy `e` (1 = full speed, 0 = falls).
// Energy drains steadily. A whip (tap) in the sweet band brings the plate back to full speed and scores.

export const TUNE = {
  maxPoles: 8, startPoles: 3, actSeconds: 20, maxBreaks: 3,
  // energy bands (energy 1 = full speed)
  lo: 0.12,         // below this the plate is wobbling hard: a whip only saves it
  perfLo: 0.18, perfHi: 0.32,   // the Perfect band
  hi: 0.45,         // the sweet band is lo..hi (Good), Perfect inside it
  early: 0.72,      // above hi up to here: an "Early" whip (wasted, no harm); above: a Jolt
  // what a whip does
  refresh: { good: 1, early: 0.9, save: 0.75 },
  jolt: { loss: 0.12 },
  points: { perfect: 100, good: 50, save: 15 },
  comboStep: 4, maxMult: 8, cleanAct: 200,
  // draining
  decay: { base: 0.11, perAct: 0.012, maxSteps: 11 },
  respawn: 2.2, respawnE: 0.6, launchE: 0.85, fallTime: 0.8, endPause: 0.6,
  jadeTime: 0.9, jadeLift: 0.25,
  floor: 0.05,      // practice: a plate never drops below this
  thinkScale: 0.35, thinkSeconds: 2, thinkCooldown: 8,
};

export const TYPES = {
  porcelain: { name: 'Porcelain', k: 1, pts: 1, w: 6, from: 1, blurb: 'Blue and white. The plain plate: drains at the normal rate.' },
  lacquer: { name: 'Lacquer', k: 1.35, pts: 1, w: 3, from: 2, blurb: 'Red and gold. Light, so it tires about a third faster.' },
  jade: { name: 'Jade', k: 0.75, pts: 1, w: 2, from: 2, double: true, blurb: 'Green and heavy. It tires slowly but needs a double whip: two quick taps.' },
  gold: { name: 'Gold', k: 1.6, pts: 3, w: 1, from: 3, blurb: 'Rare and showy. Worth triple points, but it tires fastest.' },
};
export const SPEEDS = [{ name: 'Gentle', act: 1 }, { name: 'Steady', act: 4 }, { name: 'Brisk', act: 8 }, { name: 'Frantic', act: 12 }];   // Practice speeds (the act whose drain they use)
export const TYPE_ORDER = ['porcelain', 'lacquer', 'jade', 'gold'];

export const rateFor = (act, type = 'porcelain') => (TUNE.decay.base + TUNE.decay.perAct * Math.min(Math.max(act - 1, 0), TUNE.decay.maxSteps)) * TYPES[type].k;
export const multFor = (combo) => Math.min(TUNE.maxMult, 1 + Math.floor(combo / TUNE.comboStep));
export const polesForAct = (act) => Math.min(TUNE.maxPoles, TUNE.startPoles + act - 1);

// Which band is this energy in?  'fresh' | 'early' | 'good' | 'perfect' | 'late'
export function zoneOf(e) {
  if (e > TUNE.early) return 'fresh';
  if (e > TUNE.hi) return 'early';
  if (e >= TUNE.perfLo && e <= TUNE.perfHi) return 'perfect';
  if (e >= TUNE.lo) return 'good';
  return 'late';
}

const pickType = (rng, act) => {
  const pool = TYPE_ORDER.filter((t) => TYPES[t].from <= act);
  const total = pool.reduce((s, t) => s + TYPES[t].w, 0);
  let r = rng.next() * total;
  for (const t of pool) { r -= TYPES[t].w; if (r <= 0) return t; }
  return pool[0];
};
const newPlate = (rng, act, e, born = false) => ({ type: pickType(rng, act), e, st: 'spin', ph: rng.range(0, 6.28), jolt: 0, charge: 0, fg: null, fallT: 0, age: born ? 0 : 1, flash: 0, spinA: rng.range(0, 6.28) });

// opts: { mode: 'perform' | 'practice' | 'auto', poles (practice), act (practice speed step) }
export function createShow(rng, opts = {}) {
  const mode = opts.mode ?? 'perform';
  const fixedAct = mode === 'practice' ? (opts.act ?? 1) : 0;
  const act = fixedAct || 1;
  const n = mode === 'practice' ? Math.max(1, Math.min(TUNE.maxPoles, opts.poles ?? 4)) : TUNE.startPoles;
  const poles = [];
  for (let i = 0; i < TUNE.maxPoles; i++) {
    const on = i < n;
    // staggered start so the plates do not all need attention at the same moment
    const e = Math.max(0.5, 0.97 - i * 0.14);
    poles.push({ on, plate: on ? newPlate(rng, act, e) : null, respawn: 0 });
  }
  if (poles[0].plate) poles[0].plate.type = 'porcelain';
  return {
    mode, fixedAct, t: 0, act, actT: 0, actBreaks: 0, poles,
    score: 0, combo: 0, maxCombo: 0, breaks: 0, whips: 0,
    counts: { perfect: 0, good: 0, early: 0, jolt: 0, save: 0, fumble: 0 },
    over: false, overT: 0, ev: [], anim: 0, cleanActs: 0,
    thinkT: 0, thinkCool: 0, hintPole: -1,
  };
}

export const activePlates = (show) => show.poles.map((p, i) => ({ i, p: p.plate })).filter((x) => x.p && x.p.st === 'spin');

// How urgent is each plate? Sorted, most urgent first: seconds until it falls.
export function urgency(show) {
  return activePlates(show).map(({ i, p }) => ({ pole: i, e: p.e, type: p.type, zone: zoneOf(p.e), tFall: p.e / rateFor(show.fixedAct || show.act, p.type) })).sort((a, b) => a.tFall - b.tFall);
}

function gain(show, base, plate, grade) {
  const pts = Math.round(base * TYPES[plate.type].pts * multFor(show.combo));
  show.score += pts; show.counts[grade] += 1;
  return pts;
}

// A whip on pole i. Returns the event it caused (also pushed to show.ev) or null when there was nothing to whip.
export function whip(show, i) {
  const pole = show.poles[i];
  if (show.over || !pole || !pole.on || !pole.plate || pole.plate.st !== 'spin') return null;
  const pl = pole.plate, z = zoneOf(pl.e), T = TYPES[pl.type];
  show.whips += 1; pl.flash = 1;
  let ev;
  if (!(T.double && pl.charge > 0) && z === 'fresh') {    // too soon: over-shaken
    pl.e = Math.max(0.05, pl.e - TUNE.jolt.loss); pl.jolt = 1; pl.charge = 0; pl.fg = null;
    show.combo = 0; show.counts.jolt += 1;
    ev = { k: 'jolt', pole: i, grade: 'jolt', pts: 0 };
  } else if (T.double && pl.charge > 0) {                 // second half of a jade double whip
    const grade = pl.fg ?? 'good';
    pl.e = 1; pl.charge = 0; pl.fg = null;
    const base = TUNE.points[grade] ?? 0;
    const pts = gain(show, base, pl, grade);
    show.combo += 1; show.maxCombo = Math.max(show.maxCombo, show.combo);
    ev = { k: 'whip', pole: i, grade, pts, type: pl.type, done: true };
  } else if (T.double) {                                  // first half: lift and wait for the second tap
    const grade = z === 'late' ? 'save' : z === 'early' ? 'early' : z;
    pl.fg = grade; pl.charge = TUNE.jadeTime; pl.e = Math.min(1, pl.e + TUNE.jadeLift);
    ev = { k: 'half', pole: i, grade };
  } else if (z === 'early') {
    pl.e = Math.max(pl.e, TUNE.refresh.early); show.counts.early += 1;
    ev = { k: 'whip', pole: i, grade: 'early', pts: 0, type: pl.type };
  } else if (z === 'late') {
    pl.e = Math.max(pl.e, TUNE.refresh.save); show.combo = 0;
    const pts = gain(show, TUNE.points.save, pl, 'save');
    ev = { k: 'whip', pole: i, grade: 'save', pts, type: pl.type };
  } else {
    pl.e = TUNE.refresh.good;
    const pts = gain(show, TUNE.points[z], pl, z);
    show.combo += 1; show.maxCombo = Math.max(show.maxCombo, show.combo);
    ev = { k: 'whip', pole: i, grade: z, pts, type: pl.type };
  }
  show.ev.push(ev);
  return ev;
}

// Advance the show by dt seconds (dt already includes any slow-motion scale).
export function stepShow(show, dt, rng) {
  if (show.over) { show.anim += dt; return; }
  show.t += dt; show.anim += dt; show.actT += dt;
  show.thinkCool = Math.max(0, show.thinkCool - dt);
  const act = show.fixedAct || show.act, practice = show.mode === 'practice';
  let falling = 0;
  show.poles.forEach((pole, i) => {
    if (!pole.on) return;
    const pl = pole.plate;
    if (!pl) {
      pole.respawn -= dt;
      if (pole.respawn <= 0 && show.breaks < TUNE.maxBreaks) { pole.plate = newPlate(rng, act, TUNE.respawnE, true); show.ev.push({ k: 'launch', pole: i }); }
      return;
    }
    pl.age += dt; pl.flash = Math.max(0, pl.flash - dt * 4); pl.jolt = Math.max(0, pl.jolt - dt * 1.6);
    pl.ph += dt * (2.0 + (1 - Math.min(1, pl.e * 1.6)) * 7 + pl.jolt * 6);
    pl.spinA += dt * (4 + pl.e * 26);
    if (pl.st === 'fall') {
      falling += 1; pl.fallT += dt;
      if (pl.fallT >= TUNE.fallTime) { pole.plate = null; pole.respawn = TUNE.respawn; show.ev.push({ k: 'shatter', pole: i, type: pl.type }); }
      return;
    }
    if (pl.charge > 0) {
      pl.charge -= dt;
      if (pl.charge <= 0) { pl.charge = 0; pl.fg = null; show.combo = 0; show.counts.fumble += 1; show.ev.push({ k: 'fumble', pole: i }); }
    }
    pl.e -= rateFor(act, pl.type) * dt;
    if (practice) pl.e = Math.max(TUNE.floor, pl.e);
    if (pl.e <= 0) {
      pl.e = 0; pl.st = 'fall'; pl.fallT = 0; pl.charge = 0;
      show.breaks += 1; show.actBreaks += 1; show.combo = 0;
      show.ev.push({ k: 'drop', pole: i, type: pl.type });
    }
  });
  if (show.breaks >= TUNE.maxBreaks && falling === 0 && !show.poles.some((p) => p.plate && p.plate.st === 'fall')) {
    show.overT += dt;
    if (show.overT >= TUNE.endPause) { show.over = true; show.ev.push({ k: 'over' }); }
  }
  if (!show.fixedAct && show.actT >= TUNE.actSeconds && show.breaks < TUNE.maxBreaks) {
    const clean = show.actBreaks === 0;
    if (clean) { show.score += TUNE.cleanAct * show.act; show.cleanActs += 1; }
    show.ev.push({ k: 'act', act: show.act + 1, clean, bonus: clean ? TUNE.cleanAct * show.act : 0 });
    show.act += 1; show.actT = 0; show.actBreaks = 0;
    const want = polesForAct(show.act);
    show.poles.forEach((pole, i) => { if (!pole.on && i < want) { pole.on = true; pole.plate = newPlate(rng, show.act, TUNE.launchE, true); show.ev.push({ k: 'launch', pole: i }); } });
  }
}

// ---- helpers for Think (hint) and for the computer player --------------------------------------------------------------
// The plate that most needs a whip right now (lowest time-to-fall among plates that are not 'fresh'), or null.
export function neediest(show) {
  const u = urgency(show);
  return u.length ? u[0] : null;
}

// The computer player's decision. Returns { pole, wait }: the pole to whip next and how it describes the choice.
// It whips a plate as it enters the Perfect band (energy <= `at`), most urgent first; a jade plate gets its double whip.
export function aiNext(show, at = TUNE.perfHi - 0.02) {
  const u = urgency(show).filter((x) => x.e <= at || (x.type === 'jade' && show.poles[x.pole].plate.charge > 0));
  if (!u.length) return null;
  const c = u[0];
  const pl = show.poles[c.pole].plate;
  return { pole: c.pole, e: c.e, type: c.type, second: pl.charge > 0, crowd: u.length, list: urgency(show) };
}
