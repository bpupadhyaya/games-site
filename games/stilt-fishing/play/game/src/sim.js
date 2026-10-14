// Stilt Fishing: the simulation. Pure and deterministic (no DOM, no clock): a balance model for the fisherman on the crossbar,
// a schedule of swells that shove the stilt, a small world of fish, the bite and the fight with a reel and a line tension.
// game.js owns flow and persistence; view.js and art.js only read the `rig` object built here.
//
// Conventions: x is distance from the stilt to the far edge of the fishing water (0..1), d is depth (0 surface .. 1 seabed).
// Sway s is the seat angle (-1 left/shore .. +1 right/sea; |s| >= 1 means a fall). Time is in seconds.
export const DAY_SECS = 150;
export const FALL_LOSS = 6;      // seconds lost climbing back after a fall
export const STRIKE_WINDOW = 1.0; // seconds in which the pad sets the hook after the float dives
export const BONUS_STEADY = 25;
export const LAND_R = 0.05;

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, k) => a + (b - a) * k;
export function seeded(n) {
  let a = (n | 0) >>> 0 || 1;
  const next = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return { next, range: (a0, b0) => a0 + next() * (b0 - a0), int: (k) => Math.floor(next() * k), chance: (p) => next() < p, fork: () => seeded(Math.floor(next() * 4294967296)) };
}

// kg range, length range (cm), pull 0..1 (strength of a run), fight = seconds of perfect reeling, bite = chance it takes,
// x / d = where it likes to swim, col = [back, belly, fin]
export const SPECIES = [
  { id: 0, name: 'Silver Sprat', kg: [0.05, 0.16], cm: [12, 18], pull: 0.2, fight: 2.4, bite: 0.95, x: [0.2, 0.85], d: [0.1, 0.5], col: ['#6f8fa8', '#eef4f8', '#9ab6c8'], note: 'Small, quick and plentiful in the shallows.' },
  { id: 1, name: 'Grey Mullet', kg: [0.4, 1.1], cm: [28, 40], pull: 0.3, fight: 4.4, bite: 0.9, x: [0.2, 0.9], d: [0.12, 0.55], col: ['#7d8c86', '#e9eee8', '#a8b5ae'], note: 'Cruises close to the surf and nibbles carefully.' },
  { id: 2, name: 'Striped Bream', kg: [0.8, 1.9], cm: [32, 46], pull: 0.4, fight: 6.2, bite: 0.88, x: [0.25, 0.95], d: [0.25, 0.7], col: ['#8a7a58', '#efe5c4', '#b09a6c'], note: 'A sturdy fish of the rocky patches.' },
  { id: 3, name: 'Rainbow Mackerel', kg: [1.0, 2.4], cm: [38, 52], pull: 0.5, fight: 7.4, bite: 0.85, x: [0.3, 1.0], d: [0.15, 0.55], col: ['#2f6f8a', '#e6f2f5', '#5aa1b8'], note: 'Fast and silvery, it runs hard in short bursts.' },
  { id: 4, name: 'Blue Trevally', kg: [2.2, 4.6], cm: [50, 68], pull: 0.58, fight: 9.5, bite: 0.8, x: [0.4, 1.0], d: [0.3, 0.8], col: ['#2a5f86', '#dfeaf0', '#4d92be'], note: 'Powerful and wary, it hunts along the reef edge.' },
  { id: 5, name: 'Golden Snapper', kg: [3.2, 6.4], cm: [52, 72], pull: 0.64, fight: 11.5, bite: 0.78, x: [0.45, 1.0], d: [0.45, 0.9], col: ['#b8822c', '#f5e6bd', '#e0aa48'], note: 'A deep-water fish that dives for the rocks.' },
  { id: 6, name: 'Great Barracuda', kg: [4.5, 9.0], cm: [80, 115], pull: 0.74, fight: 14, bite: 0.74, x: [0.5, 1.0], d: [0.2, 0.7], col: ['#5d6c70', '#e3e8e6', '#8a9a9e'], note: 'Long and silver; it runs in sudden, savage lunges.' },
  { id: 7, name: 'Giant Trevally', kg: [9, 16], cm: [80, 105], pull: 0.86, fight: 18, bite: 0.7, x: [0.55, 1.0], d: [0.3, 0.85], col: ['#3d4f5c', '#cfd9de', '#6a8294'], note: 'The strongest fish of the surf. Patience, not force.' },
  { id: 8, name: 'Yellowfin Tuna', kg: [15, 26], cm: [95, 130], pull: 0.95, fight: 24, bite: 0.66, x: [0.65, 1.0], d: [0.5, 0.92], col: ['#27456b', '#e9edf2', '#e6c23a'], note: 'A visitor from deep water. A day-making catch.' },
];

// tod = [start, end] of the day's light (0 dawn, 0.25 morning, 0.5 noon, 0.75 golden hour, 1 dusk)
export const SPOTS = [
  { id: 0, name: 'Quiet Shore', time: 'Dawn', tod: [0.0, 0.34], swell: 0.75, gap: [4.6, 7.4], setP: 0.15, gust: 0.1, storm: false, mix: [4, 3, 2, 1, 0.3, 0, 0, 0, 0], need: 0, blurb: 'First light and a gentle swell. The best place to learn the seat.' },
  { id: 1, name: 'Reef Break', time: 'Morning', tod: [0.26, 0.58], swell: 1.0, gap: [4.0, 6.6], setP: 0.3, gust: 0.2, storm: false, mix: [2, 3, 3, 3, 2, 1, 0.5, 0, 0], need: 12, blurb: 'Swells break over the reef and bigger fish patrol its edge.' },
  { id: 2, name: 'Golden Bay', time: 'Late afternoon', tod: [0.6, 0.94], swell: 1.15, gap: [3.6, 6.0], setP: 0.4, gust: 0.25, storm: false, mix: [1, 2, 2, 3, 3, 3, 2, 1, 0.3], need: 35, blurb: 'Long evening swells and the fish feed before dusk.' },
  { id: 3, name: 'Monsoon Surf', time: 'Stormy', tod: [0.3, 0.78], swell: 1.4, gap: [3.0, 5.2], setP: 0.55, gust: 0.45, storm: true, mix: [0, 1, 1, 2, 3, 3, 3, 3, 2], need: 80, blurb: 'Heavy sets under a grey sky. Only for a steady seat.' },
];

// ---- balance model -------------------------------------------------------------------------------------------------
const INSTAB = 1.0, DAMP = 1.9, CTRL = 5.0, LEAN_RATE = 9, KICK = 1.3, PULL_TUG = 1.1;

export function makeRig(spotIdx, rngs, opts = {}) {
  const spot = SPOTS[spotIdx];
  const rig = {
    spot: spotIdx, t: 0, day: 0, clockOn: true, free: !!opts.free, tod: spot.tod[0],
    s: 0, v: 0, l: 0, lt: 0,
    waves: [], genT: 3.2, nextWave: null,
    fish: [], nextId: 1,
    bait: null, fight: null, fell: null, ended: false,
    kg: 0, count: 0, falls: 0, snaps: 0, escapes: 0, casts: 0, best: null, catches: [],
    ev: [], rngs, pad: false, calmFor: 0,
  };
  rig.waves.push({ t: 4.4, h: 0.55, dir: -1, big: false });
  rig.waves.push({ t: 5.3, h: 0.25, dir: 1, back: true });
  genWaves(rig, 18);
  const n = opts.fishCount ?? 9;
  for (let i = 0; i < n; i++) spawnFish(rig, true);
  return rig;
}

function genWaves(rig, upto) {
  const sp = SPOTS[rig.spot], r = rig.rngs.wave;
  while (rig.genT < upto) {
    rig.genT += r.range(sp.gap[0], sp.gap[1]);
    const n = 1 + (r.chance(sp.setP) ? 1 : 0) + (r.chance(sp.setP * 0.45) ? 1 : 0);
    for (let i = 0; i < n; i++) {
      const t = rig.genT + i * r.range(1.3, 1.9), h = r.range(0.55, 1);
      rig.waves.push({ t, h, dir: -1, big: h > 0.82 });
      rig.waves.push({ t: t + 0.9, h: h * 0.45, dir: 1, back: true });
    }
    rig.genT += (n - 1) * 1.7;
  }
  rig.waves.sort((a, b) => a.t - b.t);
}

export function spawnFish(rig, initial = false) {
  const sp = SPOTS[rig.spot], r = rig.rngs.fish;
  const tot = sp.mix.reduce((a, b) => a + b, 0);
  let pick = r.next() * tot, id = 0;
  for (let i = 0; i < sp.mix.length; i++) { pick -= sp.mix[i]; if (pick <= 0) { id = i; break; } }
  const S = SPECIES[id];
  const wk = Math.pow(r.next(), 1.4), kg = lerp(S.kg[0], S.kg[1], wk);
  const cm = lerp(S.cm[0], S.cm[1], wk);
  let x = 0.5, d = 0.4;
  for (let tries = 0; tries < 8; tries++) {
    x = r.range(S.x[0], S.x[1]); d = r.range(S.d[0], S.d[1]);
    if (rig.fish.every((f) => Math.hypot(f.x - x, (f.d - d) * 0.8) > 0.12)) break;
  }
  const f = {
    id: rig.nextId++, sp: id, kg: Math.round(kg * 100) / 100, cm: Math.round(cm), x: initial ? x : (r.chance(0.5) ? 1.02 : 0.1), d,
    dir: r.chance(0.5) ? 1 : -1, spd: r.range(0.025, 0.07), wary: 0, interest: 0, bold: r.range(0.6, 1.9), ph: r.next() * 6.28, hooked: false, fade: initial ? 1 : 0,
  };
  rig.fish.push(f);
  return f;
}

export const fishById = (rig, id) => rig.fish.find((f) => f.id === id) || null;
export const nextKick = (rig) => { for (const w of rig.waves) if (w.t > rig.t - 1e-6 && !w.back) return w; return null; };

// ---- input ---------------------------------------------------------------------------------------------------------
// cast(rig, x, d): throw the bait at a spot of the water. Returns true when the cast was made.
export function cast(rig, x, d) {
  if (rig.fell || rig.fight || rig.ended) return false;
  x = clamp(x, 0.14, 1.0); d = clamp(d, 0.06, 0.94);
  rig.bait = { x, d, y: 0, state: 'flying', t: 0, fishId: 0, nib: 0, win: 0, cast: rig.t };
  rig.casts++;
  rig.v += 0.28 + 0.42 * x;             // the throw tips the seat forward a little: a far cast costs more balance
  rig.ev.push({ k: 'cast', x, d });
  return true;
}

// ---- the step --------------------------------------------------------------------------------------------------------
// inp = { lean: -1..1 | null (null keeps the last lean), reel: bool }
export function step(rig, dt, inp) {
  const sp = SPOTS[rig.spot], rr = rig.rngs;
  if (rig.ended) return;
  rig.t += dt;
  if (rig.clockOn && !rig.free) rig.day += dt;
  const dayK = rig.free ? (rig.t % 420) / 420 : clamp(rig.day / DAY_SECS, 0, 1);
  rig.tod = lerp(sp.tod[0], sp.tod[1], dayK);
  rig.pad = !!inp.reel;
  if (inp.lean !== null && inp.lean !== undefined && !rig.fell) rig.lt = clamp(inp.lean, -1, 1);
  genWaves(rig, rig.t + 18);
  while (rig.waves.length && rig.waves[0].t < rig.t - 6) rig.waves.shift();

  // swells passing the stilt kick the seat
  for (const w of rig.waves) {
    if (w.done || w.t > rig.t) continue;
    w.done = true;
    if (!rig.fell) rig.v += w.dir * w.h * KICK * sp.swell;
    rig.ev.push({ k: w.back ? 'backwash' : 'swell', h: w.h });
    if (!w.back) for (const f of rig.fish) if (f.x < 0.5 && w.h > 0.8) f.wary = Math.max(f.wary, 1.5);
  }

  // the seat
  if (rig.fell) {
    rig.fell.t += dt;
    rig.s = 0; rig.v = 0; rig.l *= 0.9; rig.lt = 0;
    if (rig.fell.t >= rig.fell.dur) { rig.fell = null; rig.ev.push({ k: 'back' }); }
  } else {
    rig.l += (rig.lt - rig.l) * Math.min(1, dt * LEAN_RATE);
    let a = INSTAB * rig.s - DAMP * rig.v + CTRL * rig.l;
    a += sp.gust * 0.55 * Math.sin(rig.t * 1.9 + 0.7) * Math.sin(rig.t * 0.63);
    if (rig.fight) a += pullOf(rig.fight) * (0.45 + rig.fight.T) * PULL_TUG;
    rig.v += a * dt;
    rig.s += rig.v * dt;
    if (Math.abs(rig.s) >= 1) fall(rig);
  }
  rig.calmFor = Math.abs(rig.s) < 0.25 && Math.abs(rig.v) < 0.5 ? rig.calmFor + dt : 0;

  fishWorld(rig, dt);
  baitStep(rig, dt, inp);
  if (rig.fight) fightStep(rig, dt, inp);

  if (!rig.free && rig.day >= DAY_SECS && !rig.fight && !(rig.bait && rig.bait.state === 'bite')) { rig.ended = true; rig.ev.push({ k: 'end' }); }
}

function fall(rig) {
  rig.falls++;
  rig.fell = { t: 0, dur: FALL_LOSS, side: Math.sign(rig.s) || 1 };
  rig.ev.push({ k: 'fall', side: rig.fell.side });
  if (rig.fight) { const f = rig.fight.fish; f.hooked = false; f.wary = 6; rig.ev.push({ k: 'lost', why: 'fall', fish: f }); rig.fight = null; }
  if (rig.bait) { const f = fishById(rig, rig.bait.fishId); if (f) f.hooked = false; rig.bait = null; }
  for (const f of rig.fish) f.wary = Math.max(f.wary, 3 + (f.x < 0.6 ? 2 : 0));
}

function fishWorld(rig, dt) {
  const b = rig.bait;
  for (const f of rig.fish) {
    if (f.hooked) continue;
    if (f.fade < 1) f.fade = Math.min(1, f.fade + dt * 0.8);
    if (f.wary > 0) f.wary = Math.max(0, f.wary - dt);
    let vx = f.dir * f.spd * (f.wary > 0 ? 2.2 : 1);
    // curious fish drift toward a settled bait
    if (b && (b.state === 'waiting' || b.state === 'nibble') && f.wary <= 0) {
      const dx = b.x - f.x, dd = b.d - f.d, dist = Math.hypot(dx, dd * 0.8);
      if (dist < 0.32) { vx = Math.sign(dx) * Math.min(0.06, Math.abs(dx) * 0.7); f.d += clamp(dd, -0.04, 0.04) * dt * 2; f.dir = vx >= 0 ? 1 : -1; }
    }
    f.x += vx * dt;
    f.d = clamp(f.d + Math.sin(rig.t * 0.5 + f.ph) * 0.012 * dt * 5, 0.06, 0.94);
    if (f.x > 1.04) { f.x = 1.04; f.dir = -1; }
    if (f.x < 0.12) { f.x = 0.12; f.dir = 1; }
  }
  // keep the water stocked
  if (rig.fish.length < 9 && rig.rngs.fish.chance(dt * 0.5)) spawnFish(rig, false);
}

const BAIT_FLY = 0.32;
function baitStep(rig, dt, inp) {
  const b = rig.bait;
  if (!b || rig.fight) return;
  b.t += dt;
  if (b.state === 'flying') {
    if (b.t >= BAIT_FLY) { b.state = 'sinking'; b.t = 0; b.y = 0; rig.ev.push({ k: 'plop', x: b.x }); for (const f of rig.fish) if (Math.hypot(f.x - b.x, (f.d - 0.05) * 0.8) < 0.07) f.wary = Math.max(f.wary, 2.5); }
    return;
  }
  if (b.state === 'sinking') {
    const dur = 0.35 + b.d * 1.1;
    b.y = clamp(b.t / dur, 0, 1) * b.d;
    if (b.t >= dur) { b.state = 'waiting'; b.t = 0; b.y = b.d; }
    return;
  }
  const tgt = b.fishId ? fishById(rig, b.fishId) : null;
  if (b.state === 'waiting') {
    // look for a fish at the bait
    for (const f of rig.fish) {
      if (f.hooked || f.wary > 0 || f.fade < 1) continue;
      if (Math.hypot(f.x - b.x, (f.d - b.d) * 0.8) < 0.14) f.interest += dt; else f.interest = Math.max(0, f.interest - dt * 0.5);
      if (f.interest > f.bold) {
        f.interest = 0;
        if (rig.rngs.bite.chance(SPECIES[f.sp].bite)) { b.state = 'nibble'; b.fishId = f.id; b.t = 0; b.nib = 0; rig.ev.push({ k: 'nibble', fish: f }); break; }
        f.wary = 5;
      }
    }
    return;
  }
  if (b.state === 'nibble') {
    if (!tgt || tgt.wary > 0) { b.state = 'waiting'; b.fishId = 0; return; }
    if (b.t >= 0.7) { b.state = 'bite'; b.t = 0; rig.ev.push({ k: 'bite', fish: tgt }); }
    return;
  }
  if (b.state === 'bite') {
    if (!tgt) { rig.bait = null; return; }
    if (inp.reel && !rig.fell) { startFight(rig, tgt); return; }
    if (b.t > STRIKE_WINDOW) { tgt.wary = 7; b.state = 'waiting'; b.fishId = 0; rig.escapes++; rig.ev.push({ k: 'missed', fish: tgt }); }
  }
}

function startFight(rig, fish) {
  const S = SPECIES[fish.sp], r = rig.rngs.fight;
  fish.hooked = true;
  rig.fight = { fish, r: 1.0, T: 0.25, stam: 1, phase: 'rest', pt: 0, pd: r.range(0.7, 1.3), tele: false, snapT: 0, ang: r.range(0.2, 0.7), wob: r.next() * 6, runs: 0, hold: 0, S, held: false };
  rig.ev.push({ k: 'hook', fish });
}

export function pullOf(f) {
  const S = f.S, base = S.pull * (0.55 + 0.45 * f.stam);
  return f.phase === 'run' ? base : base * 0.22;
}

function fightStep(rig, dt, inp) {
  const f = rig.fight, S = f.S, r = rig.rngs.fight;
  f.pt += dt; f.wob += dt * (1.5 + S.pull * 2);
  f.held = !!inp.reel && !rig.fell;
  // rest and run phases; a run is announced a moment before it begins
  if (f.phase === 'rest') {
    f.tele = f.pt > f.pd - 0.55;
    if (f.pt >= f.pd) { f.phase = 'run'; f.pt = 0; f.pd = r.range(0.9, 1.7) * (0.8 + S.pull * 0.5); f.tele = false; f.runs++; rig.ev.push({ k: 'run' }); }
  } else if (f.pt >= f.pd) { f.phase = 'rest'; f.pt = 0; f.pd = r.range(1.1, 2.1) * (1.25 - S.pull * 0.35); rig.ev.push({ k: 'rest' }); }
  const p = pullOf(f);
  const Tt = f.held ? 0.2 + 0.88 * p : 0.08 + 0.45 * p;
  f.T += (Tt - f.T) * Math.min(1, dt * 5);
  const good = f.T >= 0.35 && f.T <= 0.72;
  if (good) f.stam = Math.max(0, f.stam - dt / (S.fight * 0.75));
  else if (f.T > 0.72) f.stam = Math.max(0, f.stam - dt / (S.fight * 2.2));
  if (f.held) {
    const strain = clamp(1.2 - 1.1 * f.T, 0.15, 1);
    f.r -= (dt / S.fight) * strain * (f.phase === 'run' ? 0.55 : 1) * (0.75 + 0.5 * (1 - f.stam));
  } else {
    f.r += (dt / S.fight) * (f.phase === 'run' ? 0.5 * p / Math.max(0.2, S.pull) : 0.05);
  }
  f.r = clamp(f.r, 0, 1.3);
  if (f.T > 0.9) f.snapT += dt; else f.snapT = Math.max(0, f.snapT - dt * 0.8);
  if (f.snapT > 0.45) {
    rig.snaps++; rig.ev.push({ k: 'snap', fish: f.fish });
    f.fish.hooked = false; f.fish.wary = 8; rig.fight = null; rig.bait = null; return;
  }
  if (f.r <= LAND_R) {
    const fish = f.fish;
    rig.kg += fish.kg; rig.count++;
    const c = { sp: fish.sp, kg: fish.kg, cm: fish.cm, t: rig.t };
    rig.catches.push(c);
    const first = !rig.best || fish.kg > rig.best.kg;
    if (first) rig.best = c;
    rig.fish = rig.fish.filter((q) => q.id !== fish.id);
    spawnFish(rig, false);
    rig.fight = null; rig.bait = null;
    rig.ev.push({ k: 'land', catch: c });
  }
}

// ---- scoring -------------------------------------------------------------------------------------------------------
export const RANKS = [
  { min: 0, name: 'Beach Walker' }, { min: 15, name: 'Rod Holder' }, { min: 35, name: 'Steady Seat' },
  { min: 70, name: 'Surf Fisher' }, { min: 130, name: 'Reef Master' }, { min: 220, name: 'Master of the Stilt' },
];
export const rankFor = (pts) => { let r = RANKS[0].name; for (const k of RANKS) if (pts >= k.min) r = k.name; return r; };
export const pointsOf = (rig) => Math.round(rig.kg * 10) + (rig.falls === 0 && rig.count > 0 ? BONUS_STEADY : 0);

// ---- the player's brain (Watch & Learn, and the Think hint) ----------------------------------------------------------------
// Anticipates the next swell, damps the sway and compensates the tug of a running fish.
export function autoLean(rig) {
  if (rig.fell) return 0;
  let tug = 0;
  if (rig.fight) tug = pullOf(rig.fight) * (0.45 + rig.fight.T) * PULL_TUG;
  // the seat is an inverted pendulum: feedback on angle and rate plus the known tug
  let u = -(1.35 * rig.s + 0.75 * rig.v) / 1 - tug / CTRL;
  return clamp(u, -1, 1);
}
export function autoReel(rig) {
  const b = rig.bait;
  if (b && b.state === 'bite') return true;
  const f = rig.fight;
  if (!f) return false;
  if (f.phase === 'run' || f.tele) return false;
  return f.T < 0.58;
}
// How safe it is to cast now (seconds until the next swell, balance)
export function castWindow(rig) {
  const w = nextKick(rig);
  const inSecs = w ? w.t - rig.t : 99;
  const calm = Math.abs(rig.s) < 0.3 && Math.abs(rig.v) < 0.55 && !rig.fell;
  return { inSecs, ok: calm && inSecs > 1.4 };
}
// The best fish to cast at: value and reachability, avoiding the wary and the very big when the swell is heavy.
export function chooseTarget(rig) {
  let best = null, bs = -1;
  const sp = SPOTS[rig.spot];
  for (const f of rig.fish) {
    if (f.hooked || f.wary > 0.5 || f.fade < 1 || f.x < 0.15 || f.x > 0.98) continue;
    const S = SPECIES[f.sp];
    const hard = S.pull > 0.8 && sp.swell > 1.2 ? 0.55 : 1;
    const score = (0.6 + f.kg) * (1.3 - 0.5 * f.x) * hard * (1 - 0.5 * S.pull * 0.4);
    if (score > bs) { bs = score; best = f; }
  }
  return best;
}
export function advise(rig) {
  if (rig.fight) {
    const f = rig.fight;
    if (f.phase === 'run' || f.tele) return { kind: 'ease', text: 'Ease off: the fish is running. Let go of the pad and keep your seat.' };
    return { kind: 'reel', text: f.T > 0.6 ? 'Easy: the line is tight. Reel in short pulls.' : 'Reel now: the fish is resting.' };
  }
  const b = rig.bait;
  if (b && b.state === 'bite') return { kind: 'strike', text: 'Bite! Press the pad now.' };
  const t = chooseTarget(rig);
  const win = castWindow(rig);
  if (!t) return { kind: 'wait', text: 'No fish is settled yet. Wait a moment.', fish: null };
  const S = SPECIES[t.sp];
  const when = win.ok ? 'The sea is calm: cast now.' : win.inSecs <= 1.4 ? 'A swell is arriving: let it pass first.' : 'Steady yourself first, then cast.';
  return { kind: 'cast', fish: t, x: t.x, d: t.d, text: `Aim at the ${S.name} (about ${t.kg.toFixed(1)} kg). ${when}` };
}
