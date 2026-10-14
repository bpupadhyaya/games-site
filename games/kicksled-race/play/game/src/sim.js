// Kicksled physics, courses and the rival driver. Pure and deterministic: no DOM, no clock, no Math.random.
// One sled is a rider state `r`; `stepRider(r, course, input, dt, ev)` advances it by dt seconds.
//   input = { kick: bool (a tap this tick), tuck: bool (glide held) }
// Units: metres, seconds. Grades are rise over run (0.05 = 5%).

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const gauss = (rng) => { let s = 0; for (let i = 0; i < 6; i++) s += rng.next(); return (s - 3) / 0.7071; };
// cheap deterministic hash noise in [0,1) for scenery that has to be the same every frame
export const hashf = (n) => { let h = (Math.imul(n | 0, 374761393) + 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; };

export const SURF = {
  pack: { name: 'Packed snow', roll: 0.22, kick: 1.0, tag: 'Fast and grippy' },
  fresh: { name: 'Fresh snow', roll: 0.62, kick: 0.88, tag: 'Soft and slow' },
  ice: { name: 'Black ice', roll: 0.07, kick: 0.62, tag: 'Long glide, weak grip' },
  slush: { name: 'Slush', roll: 0.8, kick: 0.82, tag: 'Heavy going' },
};

// ---- the tunables (every number the Rules page quotes lives here) ----------------------------------------
export const T = {
  LEG_SECS: 0.55,        // time for the kicking leg to swing back at full stamina
  LEG_TIRED: 0.25,       // extra seconds at zero stamina
  KICK_DV: 0.8,          // m/s a perfect kick adds at rest
  KICK_FADE: 14,         // kick power falls off with speed: 1 / (1 + v / KICK_FADE)
  SLOPE: 7.4,            // m/s^2 per unit grade
  DRAG: 0.011,           // air drag coefficient
  TUCK_DRAG: 0.55,       // drag multiplier while gliding
  COST_BASE: 0.055, COST_EXTRA: 0.07,
  REGEN: 0.07, REGEN_TUCK: 0.15,
  TIRED_AT: 0.2,         // below this stamina the push weakens
  STREAK_MAX: 8, STREAK_BONUS: 0.2,
  PERFECT_LO: 0.9, GOOD_LO: 0.82, EARLY_LO: 0.35,
  BEND_TUCK: 1.22,       // safe speed factor in a bend while tucked
  BEND_SCRUB: 2.2,
  BUMP_LOSS: 1.1, BUMP_STAM: 0.12,
  BUMP_ZONE: 7,          // metres before a bump the warning shows
  GAP: 0.15,             // seconds a tap may be late and still count as perfect
};

// ---- courses --------------------------------------------------------------------------------------------
// seg = [length m, grade, surface, bendSafeSpeed (0 = none)]
const mk = (id, name, sub, theme, wind, segs, bumps, extra = {}) => ({ id, name, sub, theme, wind, segs, bumps, ...extra });
const RAW = {
  town: mk('town', 'Town Square Dash', 'Cobbled lanes, lamp posts, two tight corners', 'town', 0,
    [[60, 0, 'pack', 0], [60, -0.02, 'pack', 0], [50, 0, 'pack', 7.5], [70, 0.03, 'pack', 0], [60, 0, 'pack', 0], [60, -0.04, 'pack', 0], [50, 0, 'pack', 8], [70, 0, 'pack', 0]],
    [90, 170, 260, 330, 410]),
  lake: mk('lake', 'Frozen Lake', 'Black ice, a headwind and pressure cracks', 'lake', 1.8,
    [[90, 0, 'ice', 0], [100, -0.01, 'ice', 0], [60, 0, 'slush', 0], [120, 0, 'ice', 0], [60, 0, 'ice', 9.5], [100, 0, 'pack', 0], [90, 0, 'ice', 0], [80, 0.01, 'ice', 0]],
    [140, 280, 380, 520, 620]),
  forest: mk('forest', 'Forest Trail', 'Climbs, fresh snow and bends under the pines', 'forest', 0,
    [[70, 0.02, 'pack', 0], [80, 0.05, 'fresh', 0], [60, 0, 'fresh', 6.5], [90, -0.05, 'pack', 0], [70, -0.03, 'pack', 7], [80, 0.04, 'fresh', 0], [70, 0, 'pack', 7.5], [80, -0.04, 'pack', 0], [60, 0, 'pack', 0]],
    [120, 200, 310, 380, 470, 560]),
  harbour: mk('harbour', 'Harbour Climb', 'A long climb, a long descent, a frozen quay', 'harbour', 0,
    [[80, 0, 'pack', 0], [140, 0.05, 'pack', 0], [100, 0.04, 'fresh', 0], [60, 0, 'pack', 8], [120, -0.06, 'pack', 0], [100, -0.04, 'pack', 0], [60, 0, 'pack', 7], [60, 0, 'ice', 0]],
    [100, 260, 400, 520, 640]),
};
export const COURSE_IDS = ['town', 'lake', 'forest', 'harbour'];
export const ALL_COURSE_IDS = [...COURSE_IDS, 'daily'];

// a Daily course: the same for everybody on the same day number
function dailySpec(day) {
  let s = (Math.imul(day | 0, 2654435761) + 12345) >>> 0;
  const next = () => { s = (Math.imul(s ^ (s >>> 15), 2246822507) + 0x9e3779b9) >>> 0; return (s >>> 8) / 16777216; };
  const surfs = ['pack', 'pack', 'fresh', 'ice', 'slush'];
  const segs = []; const bumps = []; let x = 0;
  while (x < 600) {
    const len = 50 + Math.floor(next() * 4) * 15;
    const kind = next();
    const grade = kind < 0.3 ? 0 : kind < 0.65 ? Math.round((next() * 0.1 - 0.05) * 100) / 100 : 0;
    const bend = next() < 0.28 && segs.length > 0 && segs[segs.length - 1][3] === 0 ? 6.5 + Math.floor(next() * 4) : 0;
    segs.push([len, grade, surfs[Math.floor(next() * surfs.length)], bend]);
    x += len;
    if (next() < 0.75 && x < 570) bumps.push(x - 20 - Math.floor(next() * 20));
  }
  return mk('daily', 'Daily Course', 'A new mix every day, the same for everyone', ['town', 'lake', 'forest', 'harbour'][(day | 0) % 4], next() < 0.3 ? 1.4 : 0, segs, bumps);
}

const built = new Map();
export function getCourse(id, day = 0) {
  const key = id === 'daily' ? `daily:${day | 0}` : id;
  let c = built.get(key);
  if (c) return c;
  const raw = id === 'daily' ? dailySpec(day) : RAW[id] ?? RAW.town;
  c = buildCourse(raw);
  built.set(key, c);
  if (built.size > 12) built.delete(built.keys().next().value);
  return c;
}

function buildCourse(raw) {
  const segs = []; let x = 0;
  for (const [len, grade, surf, bend] of raw.segs) { segs.push({ x0: x, x1: x + len, grade, surf, bend }); x += len; }
  const len = x, step = 1, n = Math.ceil(len / step) + 1;
  // smoothed grade samples every metre (a +-9 m window), so slopes blend into each other instead of kinking
  const g = new Float32Array(n);
  const rawGrade = (xx) => { for (const s of segs) if (xx < s.x1) return s.grade; return segs[segs.length - 1].grade; };
  for (let i = 0; i < n; i++) { let a = 0, c = 0; for (let k = -9; k <= 9; k++) { a += rawGrade(clamp(i * step + k, 0, len - 0.01)); c++; } g[i] = a / c; }
  const e = new Float32Array(n);
  for (let i = 1; i < n; i++) e[i] = e[i - 1] + g[i - 1] * step;
  return {
    ...raw, segs, len, grades: g, elev: e,
    bumps: raw.bumps.filter((b) => b > 20 && b < len - 25).sort((a, b) => a - b),
    segAt(xx) { for (const s of segs) if (xx < s.x1) return s; return segs[segs.length - 1]; },
    gradeAt(xx) { const f = clamp(xx, 0, len - 0.001) / step, i = Math.floor(f); return lerp(g[i], g[Math.min(n - 1, i + 1)], f - i); },
    elevAt(xx) { const f = clamp(xx, 0, len) / step, i = Math.min(n - 2, Math.floor(f)); return lerp(e[i], e[i + 1], f - i); },
    bendAt(xx) { const s = this.segAt(xx); return s.bend && xx >= s.x0 + 6 && xx <= s.x1 - 6 ? s.bend : 0; },
  };
}

// ---- one rider ------------------------------------------------------------------------------------------
export function newRider(lane = 0) {
  return {
    x: 0, v: 0, stam: 1, p: 1, late: 0, tuck: false, streak: 0, q: 0, qLabel: '', qT: 0, side: 0, push: 0,
    kicks: 0, perfects: 0, wobble: 0, skid: 0, hop: 0, t: 0, done: false, ft: 0, nb: 0, lane, bumpsHit: 0, bumpsClean: 0, scrub: 0, lastKick: 9,
  };
}

// timing quality of a tap at leg phase p (ready = p reached 1, `late` seconds ago)
export function kickQuality(p, late) {
  if (p < 1) {
    if (p < T.EARLY_LO) return { q: 0.15, label: 'Too early', kind: 'early' };
    if (p < T.GOOD_LO) return { q: 0.3 + 0.7 * Math.pow((p - T.EARLY_LO) / (T.GOOD_LO - T.EARLY_LO), 1.4), label: 'Early', kind: 'early' };
    if (p < T.PERFECT_LO) return { q: 1, label: 'Good', kind: 'good' };
    return { q: 1.1, label: 'Perfect', kind: 'perfect' };
  }
  if (late <= T.GAP) return { q: 1.1, label: 'Perfect', kind: 'perfect' };
  return { q: Math.max(0.6, 1 - (late - T.GAP) * 0.8), label: 'Late', kind: 'late' };
}

export function stepRider(r, course, inp, dt, ev) {
  if (r.done && r.v < 0.05) { r.v = 0; return; }
  r.t += dt; r.lastKick += dt;
  const seg = course.segAt(r.x), surf = SURF[seg.surf];
  const finishing = r.done;
  r.tuck = !finishing && !!inp.tuck;
  // the leg swings back; it needs more time when the legs are tired
  const T_leg = T.LEG_SECS + T.LEG_TIRED * (1 - r.stam);
  if (r.p < 1) { r.p = Math.min(1, r.p + dt / T_leg); if (r.p >= 1) r.late = 0; } else r.late += dt;
  r.push = Math.max(0, r.push - dt / 0.22);
  // a kick
  if (inp.kick && !r.tuck && !finishing) {
    const k = kickQuality(r.p, r.late);
    const tired = r.stam < T.TIRED_AT ? 0.45 + (r.stam / T.TIRED_AT) * 0.55 : 1;
    const streakMul = 1 + T.STREAK_BONUS * Math.min(r.streak, T.STREAK_MAX) / T.STREAK_MAX;
    const dv = T.KICK_DV * k.q * (k.kind === 'perfect' ? streakMul : 1) * surf.kick * tired / (1 + Math.max(0, r.v) / T.KICK_FADE);
    r.v += dv;
    r.stam = Math.max(0, r.stam - (T.COST_BASE + T.COST_EXTRA * (1 - Math.min(1, k.q))));
    r.kicks++;
    if (k.kind === 'perfect') { r.perfects++; r.streak++; } else if (k.kind !== 'good') r.streak = 0;
    r.q = k.q; r.qLabel = k.label; r.qT = 0.9; r.kind = k.kind; r.p = 0; r.push = 1; r.side ^= 1; r.lastKick = 0;
    ev?.push({ t: 'kick', kind: k.kind, q: k.q, side: r.side });
  }
  r.qT = Math.max(0, r.qT - dt);
  // forces
  const grade = course.gradeAt(r.x);
  const wind = course.wind;
  const air = r.v + wind;
  let a = -T.SLOPE * grade - surf.roll * (r.v > 0.05 ? 1 : 0) - T.DRAG * (r.tuck ? T.TUCK_DRAG : 1) * air * Math.abs(air);
  if (finishing) a -= 2.2;      // coasting past the line and slowing down
  // bends: too much speed scrubs, tucking carries more
  const bend = course.bendAt(r.x);
  r.skid = Math.max(0, r.skid - dt * 2);
  if (bend && !finishing) {
    const lim = bend * (r.tuck ? T.BEND_TUCK : 1);
    if (r.v > lim) { a -= T.BEND_SCRUB * (r.v - lim) + 0.5; r.skid = 1; r.scrub += dt; }
  }
  r.v = Math.max(0, r.v + a * dt);
  const x0 = r.x;
  r.x += r.v * dt;
  // bumps: stand tall to take them, a tucked rider is thrown about
  for (const b of course.bumps) {
    if (x0 < b && r.x >= b) {
      r.bumpsHit++;
      if (r.tuck && !finishing) { r.v = Math.max(0, r.v - T.BUMP_LOSS); r.stam = Math.max(0, r.stam - T.BUMP_STAM); r.wobble = 1; r.streak = 0; ev?.push({ t: 'bump', clean: false }); }
      else { r.hop = 1; r.bumpsClean++; ev?.push({ t: 'bump', clean: true }); }
    }
  }
  r.wobble = Math.max(0, r.wobble - dt * 1.6); r.hop = Math.max(0, r.hop - dt * 2.2);
  // stamina
  r.stam = Math.min(1, r.stam + (r.tuck ? T.REGEN_TUCK : T.REGEN) * dt);
  if (!r.done && r.x >= course.len) { r.done = true; r.ft = r.t - (r.x - course.len) / Math.max(0.5, r.v); }
}

export const kmh = (v) => v * 3.6;

// ---- the rival driver ------------------------------------------------------------------------------------
// A driver turns a rider's situation into the same two inputs a thumb gives. `skill` tunes its mistakes.
export const SKILLS = {
  relaxed: { name: 'Relaxed', sd: 0.2, tuckErr: 0.25, rest: 0.34, blunder: 0.09 },
  steady: { name: 'Steady', sd: 0.1, tuckErr: 0.12, rest: 0.27, blunder: 0.04 },
  fierce: { name: 'Fierce', sd: 0.055, tuckErr: 0.04, rest: 0.2, blunder: 0.01 },
  master: { name: 'Pilot', sd: 0.025, tuckErr: 0, rest: 0.17, blunder: 0 },
};

export function newDriver(skillKey, bias = 0) {
  const k = SKILLS[skillKey] ?? SKILLS.steady;
  return { k, bias, aim: 0.95, wantTuck: false, next: 0, mistake: null };
}

// is a tuck the right call at x for this situation (the same read the Hint speaks aloud)
export function wantsTuck(course, r) {
  const seg = course.segAt(r.x);
  const grade = course.gradeAt(r.x + 4);
  // bumps: stand tall just before and over them
  for (const b of course.bumps) if (b > r.x - 1 && b - r.x < Math.max(8, r.v * 1.2)) return false;
  // bends: tuck from a little before the entry while the speed is above the safe speed
  for (const s of course.segs) {
    if (!s.bend) continue;
    const lead = Math.max(10, r.v * 1.7);
    if (r.x > s.x0 - lead && r.x < s.x1 - 4 && r.v > s.bend * 0.82) return true;
  }
  if (grade < -0.015 && r.v > 5) return true;
  if (seg.surf === 'ice' && r.v > 6.5) return true;
  if (r.stam < 0.3 && r.v > 4.5) return true;
  return false;
}

export function drive(d, r, course, dt, rng) {
  d.next -= dt;
  if (d.next <= 0) {
    d.next = 0.45;
    const want = wantsTuck(course, r);
    if (rng.next() < d.k.tuckErr) d.mistake = !want; else d.mistake = null;
    d.wantTuck = d.mistake === null ? want : d.mistake;
    if (r.stam < d.k.rest && r.v > 4) d.wantTuck = true;
    if (r.stam > 0.7 && r.v < 4.5) d.wantTuck = false;
    if (d.k.blunder && rng.next() < d.k.blunder) d.wantTuck = !d.wantTuck;
  }
  let kick = false;
  const aim = clamp(d.aim, 0.45, 1.25);
  if (!d.wantTuck && (aim <= 1 ? r.p >= aim : r.p >= 1 && r.late >= (aim - 1) * T.LEG_SECS)) {
    kick = true;
    d.aim = clamp(0.96 + d.bias + gauss(rng) * d.k.sd, 0.4, 1.3);
  }
  return { kick, tuck: d.wantTuck };
}

// ---- a whole race ---------------------------------------------------------------------------------------
export const RIVALS = {
  relaxed: [{ name: 'Aino', color: '#e0584a', bias: -0.02 }, { name: 'Olle', color: '#4a8fd0', bias: 0.0 }, { name: 'Maja', color: '#e8b23a', bias: 0.02 }],
  steady: [{ name: 'Mikko', color: '#2fa58a', bias: 0.0 }, { name: 'Elsa', color: '#c05aa6', bias: -0.01 }, { name: 'Lars', color: '#e87d2a', bias: 0.01 }],
  fierce: [{ name: 'Sigrid', color: '#7a5ad0', bias: 0.0 }, { name: 'Henrik', color: '#d03a3a', bias: 0.005 }, { name: 'Kaisa', color: '#2a9ad0', bias: -0.005 }],
};
export const DIFFS = ['relaxed', 'steady', 'fierce'];
export const HUMAN_COLORS = { jacket: '#f0f4f8', hat: '#d33b2f', accent: '#ffd36a' };

export function newRace(courseId, day, diff, rng, opts = {}) {
  const course = getCourse(courseId, day);
  const racers = [{ id: 0, name: 'You', color: '#2a8fd6', human: true, r: newRider(0), driver: null, lane: 0 }];
  if (opts.rivals !== false) {
    RIVALS[diff].forEach((rv, i) => racers.push({ id: i + 1, name: rv.name, color: rv.color, human: false, r: Object.assign(newRider(i + 1), { x: -0.45 * (i + 1) }), driver: newDriver(diff, rv.bias), lane: i + 1 }));
  }
  return { course, racers, t: 0, count: 3.2, go: false, over: false, diff, rng: rng.fork(), events: [], goT: 0 };
}

export function stepRace(race, dt, humanInput, autopilot = null) {
  const ev = race.events; ev.length = 0;
  if (!race.go) {
    race.count -= dt;
    if (race.count <= 0) { race.go = true; race.goT = 0; }
    return ev;
  }
  race.goT += dt; race.t += dt;
  for (const c of race.racers) {
    let inp;
    if (c.human) inp = autopilot ? drive(autopilot, c.r, race.course, dt, race.rng) : humanInput;
    else inp = drive(c.driver, c.r, race.course, dt, race.rng);
    stepRider(c.r, race.course, inp, dt, c.human ? ev : null);
  }
  return ev;
}

export function standings(race) {
  const list = race.racers.slice();
  list.sort((a, b) => (a.r.done && b.r.done ? a.r.ft - b.r.ft : a.r.done ? -1 : b.r.done ? 1 : b.r.x - a.r.x));
  return list;
}

// run the rest of the race instantly (rivals still on the course finish), used when the player has crossed the line
export function finishRace(race, humanInput = { kick: false, tuck: false }) {
  let guard = 0;
  while (guard++ < 20000 && race.racers.some((c) => !c.r.done)) {
    race.t += 1 / 60;
    for (const c of race.racers) {
      if (c.r.done) continue;
      const inp = c.human ? humanInput : drive(c.driver, c.r, race.course, 1 / 60, race.rng);
      stepRider(c.r, race.course, inp, 1 / 60, null);
    }
  }
  return standings(race);
}

// the time a flawless pilot needs: medal times are set from it
const goldCache = new Map();
export function pilotTime(course) {
  const key = course.id + course.len + course.segs.map((s) => s.grade + s.surf + s.bend).join('');
  if (goldCache.has(key)) return goldCache.get(key);
  const rng = { next: (() => { let a = 7; return () => { a = (a * 1103515245 + 12345) & 0x7fffffff; return a / 0x7fffffff; }; })() };
  const r = newRider(0), d = newDriver('master', 0);
  let guard = 0;
  while (!r.done && guard++ < 40000) { const inp = drive(d, r, course, 1 / 60, rng); stepRider(r, course, inp, 1 / 60, null); }
  const t = r.ft || guard / 60;
  goldCache.set(key, t);
  return t;
}
export function medalTimes(course) { const p = pilotTime(course); return { gold: p * 1.07, silver: p * 1.2, bronze: p * 1.4 }; }
export function medalFor(course, secs) { const m = medalTimes(course); return secs <= m.gold ? 3 : secs <= m.silver ? 2 : secs <= m.bronze ? 1 : 0; }
export const MEDAL_NAMES = ['No medal', 'Bronze', 'Silver', 'Gold'];

// a spoken plan for the stretch ahead: Hint and Watch & Learn read it
export function planAhead(course, r) {
  const x = r.x, look = x + 90;
  const lines = [];
  let head = 'Keep a steady rhythm';
  const seg = course.segAt(x);
  const g = course.gradeAt(x + 12);
  if (g > 0.025) { head = 'A climb: kick every beat'; lines.push(`The track rises ${Math.round(g * 100)}% ahead. Kick on the ring and rest a beat at the top.`); }
  else if (g < -0.015) { head = 'Downhill: tuck and glide'; lines.push('The track falls away. Tap Glide to crouch: it saves legs and speed.'); }
  else lines.push(`${SURF[seg.surf].name}: ${SURF[seg.surf].tag.toLowerCase()}.`);
  for (const s of course.segs) {
    if (s.bend && s.x0 > x - 5 && s.x0 < look) { lines.push(`A bend in ${Math.max(0, Math.round(s.x0 - x))} m: safe speed ${Math.round(s.bend * 3.6)} km/h, or ${Math.round(s.bend * T.BEND_TUCK * 3.6)} tucked.`); if (head.startsWith('Keep')) head = 'A bend ahead: tuck early'; break; }
  }
  for (const b of course.bumps) {
    if (b > x && b < look) { lines.push(`A bump in ${Math.round(b - x)} m: stand tall (tap Glide again or kick).`); if (head.startsWith('Keep')) head = 'Bump ahead: stand tall'; break; }
  }
  if (r.stam < 0.3) { lines.push('Legs are tired: glide a few seconds to recover.'); head = 'Rest your legs'; }
  return { head, lines: lines.slice(0, 3), tuck: wantsTuck(course, r) };
}
