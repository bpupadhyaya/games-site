// Billycart Derby simulation: pure and deterministic (no Date, no Math.random; randomness only from forked env.rng or seeded LCGs).
// Units: metres, seconds, radians. x is the lateral offset from the road centre (+ right); s is the distance down the hill.
// A cart is {build, st (derived stats), r (state)}. Nothing here touches the DOM or the canvas.

export const G = 9.81;
export const ROAD = 3.0;            // half width of the road (m)
export const WALL = 4.4;            // |x| where the hay bales stand: contact here is a crash
export const RUNOUT = 90;           // flat run-out beyond the finish line (m)
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const kmh = (v) => v * 3.6;
export const T = { COUNT: 3.0, LAUNCH_WIN: 0.45, FALSE_HOLD: 0.7, FINISH_COAST: 6 };

// ---- surfaces and parts -------------------------------------------------------------------------------------------
export const SURF = {
  tar: { name: 'Tarmac', grip: 4.2, crr: 0.018, road: '#5a5e68', road2: '#646873' },
  pave: { name: 'Cobbles', grip: 3.6, crr: 0.034, road: '#8d8478', road2: '#9a9084' },
  gravel: { name: 'Gravel', grip: 2.6, crr: 0.034, road: '#b09a76', road2: '#bba682' },
  verge: { name: 'Grass', grip: 1.7, crr: 0.065, road: '#5f9a3d', road2: '#68a643' },
};

export const WHEELS = {
  pram: { name: 'Pram wheels', blurb: 'Small, hard and quick on smooth roads; they chatter on rough ground.', crr: { tar: 0.7, pave: 1.5, gravel: 1.5 }, grip: 0.92, bump: 0.15, mass: 3, size: 0.55, unlock: 0 },
  spoke: { name: 'Wooden spokes', blurb: 'Honest all-rounders with no bad habits.', crr: { tar: 1.0, pave: 1.2, gravel: 1.25 }, grip: 1.0, bump: 0.4, mass: 5, size: 0.8, unlock: 0 },
  pneu: { name: 'Air tyres', blurb: 'Soft and grippy: slower on tarmac, calm over ruts and cobbles.', crr: { tar: 1.5, pave: 0.8, gravel: 0.72 }, grip: 1.15, bump: 0.8, mass: 6, size: 1.0, unlock: 3 },
  racer: { name: 'Bearing racers', blurb: 'The fastest wheels on tarmac and the worst on anything rough.', crr: { tar: 0.5, pave: 1.8, gravel: 1.7 }, grip: 0.8, bump: 0.1, mass: 4, size: 0.65, unlock: 6 },
};
export const FRAMES = {
  plank: { name: 'Plank frame', blurb: 'Light and nimble, a little skittish.', mass: 30, drag: 1.0, steer: 1.1, stab: 0.8, unlock: 0 },
  box: { name: 'Box frame', blurb: 'Solid and forgiving.', mass: 42, drag: 0.95, steer: 1.0, stab: 1.0, unlock: 0 },
  beam: { name: 'Beam frame', blurb: 'Heavy: holds its speed, slow to turn.', mass: 60, drag: 0.9, steer: 0.82, stab: 1.2, unlock: 4 },
};
export const STEERS = {
  rope: { name: 'Rope and pivot', blurb: 'Gentle and wide: hard to overdo.', rate: 0.17, align: 1.9, vref: 11, unlock: 0 },
  pivot: { name: 'Bolt pivot', blurb: 'The usual: balanced bite and calm.', rate: 0.22, align: 2.5, vref: 10, unlock: 0 },
  tie: { name: 'Tie-rod rack', blurb: 'Sharp and quick, twitchy at speed.', rate: 0.31, align: 3.1, vref: 7.5, unlock: 2 },
};
export const BRAKES = {
  heel: { name: 'Heel drag', blurb: 'Smooth and sure on any surface, but gentle.', a: 2.4, lock: 1.0, unlock: 0 },
  lever: { name: 'Lever pad', blurb: 'Strong on tarmac; it locks up on loose ground.', a: 4.4, lock: 0.55, unlock: 0 },
};
export const partUnlocked = (group, id, stars) => (PARTS[group][id] ? stars >= PARTS[group][id].unlock : false);
export const BALANCE_NAMES = ['Front-heavy', 'Front-leaning', 'Even', 'Rear-leaning', 'Rear-heavy'];
export const PARTS = { wheels: WHEELS, frame: FRAMES, steer: STEERS, brake: BRAKES };
export const DEFAULT_BUILD = { wheels: 'spoke', frame: 'box', steer: 'pivot', brake: 'heel', bal: 0 };
export const buildKey = (b) => `${b.wheels}.${b.frame}.${b.steer}.${b.brake}.${b.bal}`;
export const sanitizeBuild = (b) => {
  const o = { ...DEFAULT_BUILD, ...(b || {}) };
  if (!WHEELS[o.wheels]) o.wheels = DEFAULT_BUILD.wheels;
  if (!FRAMES[o.frame]) o.frame = DEFAULT_BUILD.frame;
  if (!STEERS[o.steer]) o.steer = DEFAULT_BUILD.steer;
  if (!BRAKES[o.brake]) o.brake = DEFAULT_BUILD.brake;
  o.bal = clamp(Math.round(o.bal) | 0, -2, 2);
  return o;
};

// derived numbers for a build
export function statsFor(build) {
  const b = sanitizeBuild(build), w = WHEELS[b.wheels], f = FRAMES[b.frame], s = STEERS[b.steer], br = BRAKES[b.brake];
  const mass = f.mass + 4 * w.mass + 45;
  const crr = (k) => {
    const key = k === 'verge' ? 'gravel' : k;
    return SURF[k].crr * w.crr[key] * (k === 'verge' ? 1.1 : 1);
  };
  return {
    build: b, mass, kd: (0.28 / mass) * f.drag * 107 / 107, grip: w.grip,
    crr: { tar: crr('tar'), pave: crr('pave'), gravel: crr('gravel'), verge: crr('verge') },
    steer: s.rate * f.steer * (1 - 0.06 * b.bal),
    align: s.align * Math.sqrt(f.stab) + 0.3 * b.bal,
    vref: s.vref, bump: w.bump, stab: f.stab * (1 + 0.1 * b.bal), brake: br,
  };
}

// ---- courses -------------------------------------------------------------------------------------------------------
// A piece: [length m, radius m (+ right, 0 straight), slope % (downhill +), surface, tags]. Tags: crowd, ruts, puddle, chicane,
// bunting, start, finish. Bends get hay bales on the outside automatically.
const P = (len, rad, slope, surf, tags = '') => ({ len, k: rad ? 1 / (rad * 0.8) : 0, slope: (slope + (surf === 'gravel' ? 1.3 : 0)) * 1.4 / 100, surf, tags: tags ? tags.split(' ') : [] });

const COURSE_DEFS = {
  mainst: {
    name: 'Main Street Hill', blurb: 'Tarmac through the town, long straights and quick bends.', surf: 'tar', pieces: [
      P(36, 0, 3, 'tar', 'start crowd'), P(70, 0, 6, 'tar', 'crowd'), P(55, 90, 7, 'tar', 'crowd'), P(60, 0, 7.5, 'tar', 'crowd ruts'),
      P(50, -60, 7, 'tar', 'crowd'), P(40, 0, 8, 'tar', 'bunting'), P(60, 38, 6.5, 'tar', 'crowd'), P(45, 0, 5, 'tar', 'crowd'),
      P(55, -34, 7, 'tar'), P(50, 0, 4.5, 'tar', 'chicane'), P(40, 60, 3, 'tar', 'crowd'), P(60, 0, 3.5, 'tar', 'finish crowd'),
    ],
  },
  ridge: {
    name: 'Gravel Ridge', blurb: 'A loose farm track: ruts, puddles and long sweepers.', surf: 'gravel', pieces: [
      P(40, 0, 4, 'gravel', 'start crowd'), P(60, 0, 7, 'gravel', 'ruts'), P(70, 80, 7.5, 'gravel'), P(50, 0, 8, 'gravel', 'puddle'),
      P(60, -55, 7, 'gravel', 'ruts'), P(50, 0, 7, 'gravel'), P(70, 70, 6, 'gravel', 'puddle'), P(55, 0, 8.5, 'gravel', 'ruts'),
      P(60, -42, 6, 'gravel'), P(45, 0, 5, 'gravel', 'chicane'), P(50, 0, 3, 'gravel', 'crowd'), P(55, 0, 3.5, 'gravel', 'finish crowd'),
    ],
  },
  cobble: {
    name: 'Cobble Lane', blurb: 'Old stone streets with tight corners and a chicane.', surf: 'pave', pieces: [
      P(34, 0, 4, 'pave', 'start crowd'), P(50, 0, 7, 'pave', 'crowd'), P(40, 30, 6.5, 'pave', 'crowd'), P(40, 0, 8, 'pave', 'crowd'),
      P(36, -26, 7, 'pave'), P(36, 0, 7, 'pave', 'chicane'), P(46, 24, 6, 'pave', 'crowd'), P(34, -24, 6.5, 'pave'),
      P(50, 0, 8, 'pave', 'bunting ruts'), P(44, -30, 6, 'pave', 'crowd'), P(50, 0, 5, 'pave', 'crowd'), P(40, 0, 3.5, 'pave', 'finish crowd'),
    ],
  },
  creek: {
    name: 'Creek Run', blurb: 'Tarmac turns to gravel and a wet ford, then back again.', surf: 'tar', pieces: [
      P(36, 0, 4, 'tar', 'start crowd'), P(60, 0, 7, 'tar', 'crowd'), P(50, 70, 7, 'tar'), P(46, 0, 7.5, 'tar', 'bunting'),
      P(50, -45, 6.5, 'gravel', 'ruts'), P(60, 0, 8, 'gravel', 'puddle'), P(46, 36, 7, 'gravel'), P(50, 0, 8, 'gravel', 'ruts'),
      P(50, -40, 6, 'gravel', 'puddle'), P(46, 0, 5, 'tar', 'crowd'), P(54, 48, 5.5, 'tar', 'chicane'), P(50, 0, 3, 'tar', 'crowd'),
      P(60, 0, 3.5, 'tar', 'finish crowd'),
    ],
  },
  grand: {
    name: 'Grand Derby', blurb: 'The long one: every surface, a steep drop and three hairpins.', surf: 'tar', pieces: [
      P(40, 0, 4, 'tar', 'start crowd'), P(70, 0, 7, 'tar', 'crowd'), P(52, 60, 7.5, 'tar', 'crowd'), P(60, 0, 9, 'tar', 'bunting'),
      P(40, -26, 7, 'tar', 'crowd'), P(50, 0, 8, 'pave', 'chicane'), P(46, 30, 6.5, 'pave'), P(50, 0, 7, 'pave', 'ruts'),
      P(48, -40, 7, 'gravel', 'puddle'), P(60, 0, 9.5, 'gravel', 'ruts'), P(50, 28, 6, 'gravel'), P(50, 0, 7, 'gravel', 'puddle'),
      P(44, -32, 6, 'tar'), P(60, 0, 8, 'tar', 'crowd'), P(40, 22, 5, 'tar', 'crowd'), P(50, 0, 4, 'tar', 'chicane crowd'),
      P(60, 0, 3.5, 'tar', 'finish crowd'),
    ],
  },
};
export const COURSE_IDS = ['mainst', 'ridge', 'cobble', 'creek'];     // the cup
export const ALL_COURSE_IDS = [...COURSE_IDS, 'grand', 'daily'];
export const DEMO_COURSES = ['mainst', 'creek'];

const lcg = (seed) => { let s = (seed >>> 0) || 1; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; };
const hashStr = (str) => { let h = 2166136261; for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619); return h >>> 0; };

function dailyDef(day) {
  const r = lcg(Math.imul(day | 0, 2654435761) ^ 0x51ed);
  const surfs = ['tar', 'pave', 'gravel'];
  const out = [P(36, 0, 4, 'tar', 'start crowd')];
  let cur = surfs[Math.floor(r() * 3)];
  const n = 11;
  for (let i = 0; i < n; i++) {
    if (r() < 0.3) cur = surfs[Math.floor(r() * 3)];
    const bend = i % 2 === 1 || r() < 0.3;
    const dir = r() < 0.5 ? -1 : 1;
    const rad = bend ? dir * (26 + Math.floor(r() * 50)) : 0;
    const tags = [];
    if (r() < 0.35) tags.push('crowd');
    if (!bend && r() < 0.4) tags.push(['ruts', 'puddle', 'chicane'][Math.floor(r() * 3)]);
    if (r() < 0.2) tags.push('bunting');
    out.push(P(40 + Math.floor(r() * 30), rad, 5.5 + Math.floor(r() * 35) / 10, cur, tags.join(' ')));
  }
  out.push(P(60, 0, 3.5, cur, 'finish crowd'));
  return { name: 'Daily Hill', blurb: 'A new hill every day, the same for everyone.', surf: out[1].surf, pieces: out };
}

const courseCache = new Map();
export function getCourse(id, day = 0) {
  const key = id === 'daily' ? `daily${day}` : id;
  let c = courseCache.get(key);
  if (!c) { c = buildCourse(id === 'daily' ? dailyDef(day) : COURSE_DEFS[id] ?? COURSE_DEFS.mainst, id === 'daily' ? `daily${day}` : id); courseCache.set(key, c); if (courseCache.size > 12) courseCache.delete(courseCache.keys().next().value); }
  return c;
}

function buildCourse(def, id) {
  const rnd = lcg(hashStr(id));
  const pieces = def.pieces;
  const len = pieces.reduce((a, p) => a + p.len, 0);
  const total = Math.ceil(len + RUNOUT);
  const K = new Float32Array(total + 2), SL = new Float32Array(total + 2), SU = new Uint8Array(total + 2);
  const SID = ['tar', 'pave', 'gravel'];
  const segs = [];
  let at = 0;
  for (const p of pieces) {
    segs.push({ s0: at, s1: at + p.len, k: p.k, slope: p.slope, surf: p.surf, tags: p.tags });
    for (let i = 0; i < p.len; i++) { K[at + i] = p.k; SL[at + i] = p.slope; SU[at + i] = SID.indexOf(p.surf); }
    at += p.len;
  }
  for (let i = at; i < total + 2; i++) { K[i] = 0; SL[i] = -0.015; SU[i] = SU[Math.max(0, at - 1)]; }
  // soften the corners of the profile so nothing jerks
  const smooth = (arr, w) => { const o = new Float32Array(arr.length); for (let i = 0; i < arr.length; i++) { let a = 0, n = 0; for (let j = -w; j <= w; j++) { const q = i + j; if (q >= 0 && q < arr.length) { a += arr[q]; n++; } } o[i] = a / n; } return o; };
  const ks = smooth(K, 5), sl = smooth(SL, 8);
  const elev = new Float32Array(total + 3);
  for (let i = 0; i < total + 2; i++) elev[i + 1] = elev[i] - sl[i];   // elevation falls on downhill slopes
  const lerp = (arr, s) => { const i = clamp(Math.floor(s), 0, arr.length - 2), f = clamp(s - i, 0, 1); return arr[i] + (arr[i + 1] - arr[i]) * f; };

  // obstacles
  const obs = [];
  let oid = 0;
  const tagged = (t) => segs.filter((g) => g.tags.includes(t));
  for (const g of tagged('ruts')) {
    const n = 3 + Math.floor(rnd() * 2);
    for (let i = 0; i < n; i++) {
      const s = g.s0 + 10 + (g.s1 - g.s0 - 20) * (i + rnd() * 0.7) / n;
      obs.push({ id: oid++, kind: 'rut', s, len: 1.4, x: (rnd() - 0.5) * 3.6, w: 1.5 + rnd() * 0.8, kick: rnd() < 0.5 ? -1 : 1 });
    }
  }
  for (const g of tagged('puddle')) {
    const s = g.s0 + 12 + rnd() * (g.s1 - g.s0 - 40), x = (rnd() - 0.5) * 2.4;
    obs.push({ id: oid++, kind: 'puddle', s, len: 14 + rnd() * 6, x, w: 3.2 + rnd() * 1.2, kick: 0 });
  }
  for (const g of tagged('chicane')) {
    // two bale blocks, alternate sides, 11 m apart: a slalom the thumb must thread
    const a = rnd() < 0.5 ? -1 : 1, s = g.s0 + Math.max(8, (g.s1 - g.s0) * 0.25);
    obs.push({ id: oid++, kind: 'bale', s, len: 2.6, x: a * 1.5, w: 2.6, kick: a });
    obs.push({ id: oid++, kind: 'bale', s: s + 14, len: 2.6, x: -a * 1.5, w: 2.6, kick: -a });
  }
  obs.sort((a, b) => a.s - b.s);

  // bends worth planning for
  const bends = segs.filter((g) => Math.abs(g.k) > 1 / 90).map((g) => ({ s0: g.s0, s1: g.s1, k: g.k, dir: Math.sign(g.k), surf: g.surf, R: 1 / Math.abs(g.k) }));
  // scenery: crowds, bales, trees, signs, bunting
  const deco = [];
  const addDeco = (o) => deco.push(o);
  for (const g of segs) {
    const crowd = g.tags.includes('crowd'), fin = g.tags.includes('finish'), start = g.tags.includes('start');
    for (let s = g.s0 + 3; s < g.s1; s += crowd ? 3.4 : 11 + rnd() * 6) {
      for (const side of [-1, 1]) {
        if (crowd && rnd() < 0.82) addDeco({ s: s + rnd() * 1.4, side, kind: 'person', off: 5.4 + rnd() * 1.3, v: Math.floor(rnd() * 8), ph: rnd() * 6.28 });
        else if (!crowd && rnd() < 0.6) addDeco({ s, side, kind: 'tree', off: 6.8 + rnd() * 5, v: Math.floor(rnd() * 3) });
      }
    }
    if (g.tags.includes('bunting')) addDeco({ s: (g.s0 + g.s1) / 2, side: 0, kind: 'bunting', off: 0, v: 0 });
    if (fin || start) addDeco({ s: fin ? len : 12, side: 0, kind: fin ? 'finish' : 'start', off: 0, v: 0 });
  }
  for (const b of bends) {
    const side = -b.dir;   // bales on the outside of the bend
    for (let s = b.s0 - 12; s < b.s1 + 6; s += 2.3) addDeco({ s, side, kind: 'bale', off: WALL + 0.45, v: Math.floor(rnd() * 3) });
    addDeco({ s: b.s0 - 30, side: -side, kind: 'sign', off: ROAD + 0.9, v: b.dir, R: b.R });
  }
  for (let s = 0; s < len + RUNOUT; s += 9) for (const side of [-1, 1]) addDeco({ s, side, kind: 'post', off: WALL + 0.9, v: 0 });
  for (let s = len; s < len + RUNOUT; s += 2.3) for (const side of [-1, 1]) addDeco({ s, side, kind: 'bale', off: WALL + 0.45, v: 1 });
  deco.sort((a, b) => a.s - b.s);

  return {
    id, name: def.name, blurb: def.blurb, len, total, segs, obs, bends, deco, surfName: def.surf,
    k: (s) => lerp(ks, s), slope: (s) => lerp(sl, s), elevAt: (s) => lerp(elev, s),
    surfAt: (s) => SID[SU[clamp(Math.floor(s), 0, total)]],
    stops: segs.map((g) => g.s0).filter((s) => s > 8),
    puddleAt(s, x) { for (const o of obs) { if (o.kind === 'puddle' && s >= o.s && s <= o.s + o.len && Math.abs(x - o.x) < o.w / 2 + 0.4) return o; if (o.s > s + 1) break; } return null; },
  };
}

// ---- carts ---------------------------------------------------------------------------------------------------------
export function makeCart(build) {
  const st = statsFor(build);
  return { st, r: { s: 0, x: 0, psi: 0, wl: 0, v: 0, u: 0, brake: false, done: false, ft: null, hold: 0, spin: 0, lean: 0, skid: 0, hits: 0, wallCd: 0, bumps: 0, crashes: 0, top: 0, rough: 0, surf: 'tar', puddle: false, draft: 0, hitSet: new Set(), launch: 0 } };
}

// advance one cart by dt (<= 1/30). `inp` = {u in -1..1, brake}; `assist` 0..1 lets the road steer you a little; `others` for slipstream.
export function stepCart(c, course, dt, inp, assist, others, events, who) {
  const r = c.r, st = c.st;
  if (r.hold > 0) { r.hold = Math.max(0, r.hold - dt); r.u += (0 - r.u) * Math.min(1, dt * 6); return; }
  let u = inp.u, brake = inp.brake;
  if (r.done) { u = 0; brake = true; }
  r.u += clamp(u - r.u, -7 * dt, 7 * dt);
  r.brake = brake;
  const seg = { k: course.k(r.s), slope: course.slope(r.s), surf: course.surfAt(r.s) };
  const verge = Math.abs(r.x) > ROAD;
  const sKey = verge ? 'verge' : seg.surf;
  const pud = verge ? null : course.puddleAt(r.s, r.x);
  if (pud && !r.puddle && r.v > 3) events.push({ t: 'splash', who });
  r.puddle = !!pud; r.surf = sKey;
  const sf = SURF[sKey];
  const grip = sf.grip * st.grip * (pud ? 0.62 : 1);
  const crr = st.crr[sKey] + (pud ? 0.018 : 0);
  const v = r.v;

  // speed
  let draft = 1;
  if (others) for (const o of others) { if (o === c) continue; const ds = o.r.s - r.s; if (ds > 1.5 && ds < 14 && Math.abs(o.r.x - r.x) < 1.2 && !o.r.done) { draft = 0.72; break; } }
  r.draft = draft < 1 ? 1 : 0;
  const lockMul = sKey === 'gravel' || sKey === 'verge' || pud ? st.brake.lock : 1;
  const bA = brake && v > 0.15 ? st.brake.a * lockMul : 0;
  const need = v * v * Math.abs(seg.k);
  const slide = Math.max(0, need - grip);
  let a = G * seg.slope - G * crr - st.kd * draft * v * v - bA - 0.12 * Math.abs(Math.sin(r.psi)) * v - slide * 0.45;
  if (v < 1.5 && !brake) a += 0.9 * (1 - v / 1.5);   // a stalled cart is rocked along by its rider
  r.rough = crr;
  r.v = Math.max(0, v + a * dt);
  r.spinCd = Math.max(0, (r.spinCd || 0) - dt);
  if (slide > 0.9 && r.spinCd <= 0 && r.v > 4) {   // lost the back end: over the limit in a bend
    r.spinCd = 1.6; r.v *= 0.68; r.psi += -Math.sign(seg.k) * 0.38; r.spins = (r.spins | 0) + 1;
    events.push({ t: 'skid', who, v: r.v });
  }
  r.skid = (bA > 0 && v > 4 && lockMul < 1 ? 0.6 : 0) + Math.min(1, slide * 0.4);
  if (r.v > r.top) r.top = r.v;

  // heading and lateral position
  const sat = r.v / (1 + (r.v / st.vref) ** 2);
  const dpsi = r.u * st.steer * sat / (1 + 0.45 * slide) - r.v * seg.k * (1 - assist) - st.align * r.psi;
  r.psi = clamp(r.psi + dpsi * dt, -0.9, 0.9);
  r.wl += (-Math.sign(seg.k) * slide * 1.7 - r.wl * 3) * dt;
  r.x += (r.v * Math.sin(r.psi) + r.wl) * dt;
  const stretch = clamp(1 - 2 * seg.k * r.x, 0.5, 1.6);   // the inside line is shorter (exaggerated for play)
  r.s += (r.v * Math.cos(r.psi) / stretch) * dt;
  r.spin += r.v * dt / 0.45;
  r.lean += (clamp(-(r.u * r.v) * 0.012 - r.wl * 0.04, -0.3, 0.3) - r.lean) * Math.min(1, dt * 6);

  // hay bales at the edge
  r.wallCd = Math.max(0, r.wallCd - dt);
  if (Math.abs(r.x) > WALL && r.s < course.len + RUNOUT) {
    const side = Math.sign(r.x);
    if (r.wallCd <= 0 && r.v > 1) { events.push({ t: 'crash', who, v: r.v, kind: 'wall' }); r.v *= 0.55; r.crashes++; r.wallCd = 0.5; }
    r.x = side * (WALL - 0.05); r.psi = -side * 0.22; r.wl = 0;
  }
  // obstacles
  for (const o of course.obs) {
    if (o.s > r.s + 2) break;
    if (o.kind === 'puddle' || r.s < o.s - 0.3 || r.s > o.s + o.len || r.hitSet.has(o.id)) continue;
    if (Math.abs(r.x - o.x) > o.w / 2 + 0.5) continue;
    r.hitSet.add(o.id);
    if (o.kind === 'rut') {
      const loss = r.v * 0.15 * (1 - st.bump * 0.85) + 0.15;
      r.v = Math.max(0, r.v - loss); r.psi += o.kick * 0.14 * (1 - 0.45 * (st.stab - 0.7)) * (1 - st.bump * 0.55); r.bumps++;
      events.push({ t: 'bump', who, v: r.v, soft: st.bump });
    } else if (o.kind === 'bale') {
      r.v *= 0.58; r.psi += -Math.sign(r.x - o.x || o.kick) * 0.24; r.x += Math.sign(r.x - o.x || o.kick) * 0.5; r.crashes++;
      events.push({ t: 'crash', who, v: r.v, kind: 'bale' });
    }
  }
  if (!r.done && r.s >= course.len) { r.done = true; r.ft = 0; }
}

// ---- drivers (the rivals, the pilot, and the estimator) --------------------------------------------------------------
export const SKILLS = {
  local: { name: 'Local Lads', margin: 0.74, look: 0.7, jitter: 0.55, launch: 0.5, line: 0.5, note: 'Easy-going: late on the brake, loose lines.' },
  club: { name: 'Club Racers', margin: 0.88, look: 0.9, jitter: 0.3, launch: 1.2, line: 0.8, note: 'Tidy lines and good braking points.' },
  champ: { name: 'Derby Champions', margin: 0.97, look: 1.0, jitter: 0.12, launch: 1.9, line: 1.0, note: 'Near-perfect lines and sharp launches.' },
  master: { name: 'Pilot', margin: 1.0, look: 1.1, jitter: 0, launch: 2.2, line: 1.0, note: '' },
};
export const DIFFS = ['local', 'club', 'champ'];

export function newDriver(skill, seed) {
  const sk = SKILLS[skill] ?? SKILLS.club;
  return { skill, sk, ph: [(seed * 1.7) % 6.28, (seed * 2.9 + 1) % 6.28], lastU: 0 };
}

export const DBG = { noBrake: false, noDodge: false, noLine: false };
// the line target and braking decision for the next stretch
export function drive(d, c, course, t) {
  const r = c.r, st = c.st, sk = d.sk, v = r.v, s = r.s;
  const aB = st.brake.a * 0.8;
  // line: approach wide, clip the apex, exit wide
  let xt = 0;
  const look = 18 + v * 1.1 * sk.look;
  let nb = null;
  for (const b of course.bends) { if (b.s1 > s) { nb = b; break; } }
  if (nb && !DBG.noLine) {
    const dist = nb.s0 - s;
    if (s >= nb.s0 - 2 && s <= nb.s1) xt = nb.dir * ROAD * 0.5 * sk.line;
    else if (dist < look + 14) xt = -nb.dir * ROAD * 0.38 * sk.line;
  }
  // obstacles: slip to the free side
  for (const o of course.obs) {
    if (o.s < s - 2) continue;
    if (o.s > s + look + 6) break;
    if (DBG.noDodge || (o.kind === 'puddle' && st.bump > 0.5)) continue;
    if (Math.abs(xt - o.x) < o.w / 2 + 0.9 || (o.s < s + 14 + v && Math.abs(r.x - o.x) < o.w / 2 + 0.75)) {
      const goR = o.x + o.w / 2 + 0.95, goL = o.x - o.w / 2 - 0.95;
      const pick = Math.abs(goR - xt) < Math.abs(goL - xt) ? goR : goL;
      xt = Math.abs(pick) <= ROAD - 0.3 ? pick : (Math.abs(goR) < Math.abs(goL) ? goR : goL);
      xt = clamp(xt, -(ROAD - 0.35), ROAD - 0.35);
      break;   // one obstacle at a time, nearest first
    }
  }
  const noise = sk.jitter * 0.5 * (Math.sin(r.s * 0.11 + d.ph[0]) + 0.6 * Math.sin(r.s * 0.27 + d.ph[1]));
  if (d.lane) xt += d.lane * 0.6 * Math.max(0, 1 - s / 160);   // hold the starting lane for a while
  xt = clamp(xt + noise, -(ROAD - 0.2), ROAD - 0.2);
  // steering that makes the heading rate hold the target heading
  const k = course.k(s + Math.min(10, v * 0.4));
  const psiT = clamp((xt - r.x) * 0.16, -0.22, 0.22);
  const sat = Math.max(0.5, v / (1 + (v / st.vref) ** 2));
  const kp = 2.4;
  const need = v * k + st.align * r.psi + kp * (psiT - r.psi);
  const u = clamp(need / (st.steer * sat), -1, 1);
  // braking
  let brake = false;
  const grip0 = SURF[course.surfAt(s)].grip * st.grip;
  for (const b of course.bends) {
    if (b.s1 < s) continue;
    const dist = Math.max(0, b.s0 - s);
    if (dist > v * v / (2 * aB) * 1.2 + 25) break;
    const gb = SURF[b.surf].grip * st.grip;
    const vSafe = Math.sqrt(gb * b.R) * sk.margin;
    const allowed = Math.sqrt(vSafe * vSafe + 2 * aB * 0.85 * dist);
    if (v > allowed) { brake = true; break; }
  }
  if (!brake && Math.abs(k) * v * v > grip0 * sk.margin && v > 3) brake = true;
  if (DBG.noBrake) brake = false;
  return { u, brake, xt };
}

// ---- races ---------------------------------------------------------------------------------------------------------
const RIVAL_NAMES = ['Rusty', 'Tilly', 'Jonno', 'Mez', 'Dot', 'Stumpy', 'Ange', 'Biffo'];
const RIVAL_COLORS = ['#e2573b', '#3aa6d8', '#9a62d6', '#e3b23a'];
export const PLAYER_COLOR = '#2f7de0';

// candidate builds for rivals and for the par time
const CANDS = (() => {
  const out = [];
  for (const w of Object.keys(WHEELS)) for (const f of Object.keys(FRAMES)) for (const s of ['pivot', 'tie']) for (const b of Object.keys(BRAKES)) out.push({ wheels: w, frame: f, steer: s, brake: b, bal: 0 });
  return out;
})();

const estCache = new Map();
// a flawless pilot's finish time with this build on this course (the garage gauge and the medal par both use it)
export function estimateTime(courseId, day, build) {
  const b = sanitizeBuild(build), key = `${courseId}:${courseId === 'daily' ? day : 0}:${buildKey(b)}`;
  const hit = estCache.get(key);
  if (hit !== undefined) return hit;
  const course = getCourse(courseId, day), c = makeCart(b), d = newDriver('master', 1), ev = [];
  c.r.v = SKILLS.master.launch;
  const dt = 1 / 30;
  let t = 0;
  for (let i = 0; i < 30 * 220 && !c.r.done; i++) { const inp = drive(d, c, course, t); stepCart(c, course, dt, inp, 0, null, ev, 0); ev.length = 0; t += dt; }
  const out = c.r.done ? t : 999;
  estCache.set(key, out);
  if (estCache.size > 4000) estCache.delete(estCache.keys().next().value);
  return out;
}
const parCache = new Map();
export function parTime(courseId, day) {
  const key = `${courseId}:${courseId === 'daily' ? day : 0}`;
  let p = parCache.get(key);
  if (p === undefined) { p = Math.min(...CANDS.map((b) => estimateTime(courseId, day, b))); parCache.set(key, p); }
  return p;
}
export const MEDAL_NAMES = ['', 'Bronze', 'Silver', 'Gold'];
export const MEDAL_AT = [0, 1.4, 1.2, 1.07];
export function medalFor(courseId, day, time) {
  const par = parTime(courseId, day);
  if (!(time > 0)) return 0;
  return time <= par * MEDAL_AT[3] ? 3 : time <= par * MEDAL_AT[2] ? 2 : time <= par * MEDAL_AT[1] ? 1 : 0;
}
export function medalTimes(courseId, day) { const p = parTime(courseId, day); return [0, p * MEDAL_AT[1], p * MEDAL_AT[2], p * MEDAL_AT[3]]; }

function rivalBuilds(courseId, day, diff, count) {
  // rank candidate builds on this course; Local Lads choose from the middle of the table, Champions from the top
  const ranked = CANDS.map((b) => ({ b, t: estimateTime(courseId, day, b) })).sort((a, z) => a.t - z.t);
  const base = [8, 3, 0][diff] ?? 3;
  const out = [];
  for (let i = 0; i < count; i++) out.push(ranked[Math.min(ranked.length - 1, base + i * 3)].b);
  return out;
}

export function newRace(courseId, day, diff, rng, opts = {}) {
  const course = getCourse(courseId, day);
  const racers = [];
  const pilot = opts.pilot === true;
  const me = makeCart(opts.build ?? DEFAULT_BUILD);
  racers.push({ name: 'You', color: PLAYER_COLOR, human: true, ...me, driver: null, assist: opts.assist ?? 0.6, place: 0 });
  if (opts.rivals !== false) {
    const skill = DIFFS[clamp(diff | 0, 0, 2)];
    const builds = rivalBuilds(courseId, day, clamp(diff | 0, 0, 2), 3);
    const first = rng.int(RIVAL_NAMES.length);
    builds.forEach((b, i) => {
      const cart = makeCart(b), nm = RIVAL_NAMES[(first + i * 3) % RIVAL_NAMES.length];
      const drv = newDriver(skill, 3 + i + rng.int(50));
      cart.r.v = 0;
      racers.push({ name: nm, color: RIVAL_COLORS[i], human: false, ...cart, driver: drv, assist: 0, place: i + 1 });
    });
  }
  const lanes = [0.8, -0.8, 2.3, -2.3];
  racers.forEach((c, i) => { c.r.x = racers.length === 1 ? 0 : lanes[i] ?? 0; if (c.driver) c.driver.lane = c.r.x; });
  return { course, courseId, day, racers, t: 0, count: T.COUNT + 0.6, go: false, goT: 0, events: [], launched: false, pilot, finished: 0 };
}

export function standings(race) {
  return race.racers.slice().sort((a, b) => {
    if (a.r.done && b.r.done) return a.r.ft - b.r.ft;
    if (a.r.done) return -1;
    if (b.r.done) return 1;
    return b.r.s - a.r.s;
  });
}

// advance the whole race by dt. `inp` drives racer 0 (the human) unless `auto` is a driver, in which case the pilot drives.
export function stepRace(race, dt, inp, auto = null) {
  let left = Math.min(dt, 0.1);
  while (left > 1e-6) {
    const h = Math.min(left, 1 / 60);
    left -= h;
    stepOnce(race, h, inp, auto);
  }
}
function stepOnce(race, dt, inp, auto) {
  const course = race.course, ev = race.events;
  if (!race.go) {
    race.count -= dt;
    if (inp && inp.tap && !race.racers[0].r.hold && race.count > 0.05) { race.racers[0].r.hold = T.FALSE_HOLD; inp.tap = false; ev.push({ t: 'false', who: 0 }); }
    if (race.count <= 0) {
      race.go = true; race.goT = 0 - race.count; race.count = 0;
      race.racers.forEach((c, i) => { if (!c.human && c.driver) c.r.v = c.driver.sk.launch * (0.55 + 0.45 * ((i * 37) % 10) / 10); });
    }
    return;
  }
  race.goT += dt; race.t += dt;
  if (inp && inp.tap && !race.launched && race.goT <= T.LAUNCH_WIN && !race.racers[0].r.hold) {
    const q = 1 - race.goT / T.LAUNCH_WIN;
    race.racers[0].r.v += 0.4 + 2.0 * q; race.launched = true; race.racers[0].r.launch = q;
    ev.push({ t: 'launch', who: 0, q });
  }
  if (auto && !race.launched) { race.racers[0].r.v += auto.sk.launch; race.launched = true; }
  race.racers.forEach((c, i) => {
    if (c.r.done && c.r.v < 0.05) return;
    let input;
    if (c.human && !auto) input = { u: inp ? inp.u : 0, brake: inp ? inp.brake : false };
    else if (c.human) input = drive(auto, c, course, race.t);
    else input = drive(c.driver, c, course, race.t);
    const wasDone = c.r.done;
    stepCart(c, course, dt, input, c.human && !auto ? c.assist : 0, race.racers, ev, i);
    if (!wasDone && c.r.done) { c.r.ft = race.t - dt * (1 - 0); race.finished++; ev.push({ t: 'finish', who: i }); }
  });
}

// ---- hints and the pilot's plan -------------------------------------------------------------------------------------
export function planAhead(course, c, assistOn = true) {
  const r = c.r, st = c.st, s = r.s, v = r.v;
  const lines = [];
  let head = 'Open road';
  let target = { s: s + 40, x: 0 };
  const nb = course.bends.find((b) => b.s1 > s);
  const obs = course.obs.find((o) => o.s > s + 2 && o.kind !== 'puddle') ?? null;
  const pud = course.obs.find((o) => o.kind === 'puddle' && o.s + o.len > s);
  const dist = (m) => `${Math.max(5, Math.round(m / 5) * 5)} m`;
  const feature = [];
  if (nb) feature.push({ d: Math.max(0, nb.s0 - s), t: 'bend', b: nb });
  if (obs) feature.push({ d: obs.s - s, t: 'obs', o: obs });
  if (pud) feature.push({ d: Math.max(0, pud.s - s), t: 'pud', o: pud });
  const nextSurf = (() => { const cur = course.surfAt(s); for (let m = 6; m < 160; m += 6) { const sf = course.surfAt(s + m); if (sf !== cur) return { d: m, sf }; } return null; })();
  if (nextSurf) feature.push({ d: nextSurf.d, t: 'surf', sf: nextSurf.sf });
  const toFin = course.len - s;
  if (toFin < 90) feature.push({ d: toFin, t: 'fin' });
  feature.sort((a, b) => a.d - b.d);
  const f = feature[0];
  if (!f) { head = 'Open road'; lines.push('Nothing ahead but straight road. Stay near the middle and let the cart run.'); }
  else if (f.t === 'bend') {
    const b = f.b, dir = b.dir > 0 ? 'right' : 'left';
    const vSafe = Math.sqrt(SURF[b.surf].grip * st.grip * b.R);
    head = `${b.R < 40 ? 'Sharp ' : ''}${dir} bend in ${dist(f.d)}`;
    lines.push(`The safe speed here is about ${Math.round(kmh(vSafe))} km/h; you are doing ${Math.round(kmh(v))}.`);
    lines.push(v > vSafe * 1.02 ? 'Brake now, then let go and steer in.' : 'Steer in gently. No braking needed.');
    lines.push(`Swing wide to the ${b.dir > 0 ? 'left' : 'right'}, then cut to the inside at the middle of the bend.`);
    target = { s: b.s0 + (b.s1 - b.s0) * 0.5, x: b.dir * ROAD * 0.5 };
  } else if (f.t === 'obs') {
    const o = f.o;
    head = `${o.kind === 'rut' ? 'Ruts' : 'Hay bales'} in ${dist(f.d)}`;
    const free = o.x > 0 ? 'left' : 'right';
    lines.push(o.kind === 'rut' ? 'Ruts cost speed and knock the cart sideways. Steer around them, or ride them out on soft tyres.' : 'A hay bale blocks part of the road. Steer for the gap.');
    lines.push(`Take the ${free} side.`);
    target = { s: o.s, x: o.x > 0 ? o.x - o.w / 2 - 1 : o.x + o.w / 2 + 1 };
  } else if (f.t === 'pud') {
    head = `Puddle in ${dist(f.d)}`;
    lines.push('Wet ground halves your grip and slows you. Go around if there is room, and do not brake or turn hard in it.');
    target = { s: f.o.s, x: f.o.x > 0 ? f.o.x - f.o.w / 2 - 0.8 : f.o.x + f.o.w / 2 + 0.8 };
  } else if (f.t === 'surf') {
    head = `${SURF[f.sf].name} in ${dist(f.d)}`;
    lines.push(`The surface changes to ${SURF[f.sf].name.toLowerCase()}: grip ${f.sf === 'gravel' ? 'drops, so brake early for bends' : f.sf === 'pave' ? 'is a little lower and it is bumpy' : 'is at its best'}.`);
  } else {
    head = `Finish in ${dist(f.d)}`;
    lines.push('Keep it straight and let it run. No braking, the line is yours.');
  }
  return { head, lines, target, feature: f ? f.t : 'open' };
}
