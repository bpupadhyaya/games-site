// Steppe Eagle Hunting engine: one hunt on the winter steppe. A fox forages near its den, the rider tracks it, releases the eagle,
// the eagle flies out (wind pushes it), stoops, and is called back to the glove. Nobody is hurt: the fox always slips away and only
// the quality of the flying is scored.
// Pure and deterministic: all randomness comes from a seed stored in the hunt (no clocks, no Math.random).
//
// World units are metres. x runs left (-) to right (+), z runs away from the rider (the rider stands at 0, 0).

export const K = {
  FIELD_X: 118, Z_MIN: 40, Z_MAX: 300,
  CRUISE: 27,            // eagle cruising speed, m/s
  CLIMB: 7,              // climb rate after release, m/s
  ALT: 15,               // cruising height, m
  TURN: 1.25,            // how fast the eagle can turn while cruising, rad/s
  STOOP_TURN: 1.5,       // ... and while stooping
  STOOP_V0: 30, STOOP_V1: 46,   // stoop speed at the start and at the bottom of the dive, m/s
  DIVE_RATE: 17,         // m/s of height lost in the dive: the dive lasts height / 17 s
  DIVE_MIN: 0.35, DIVE_MAX: 0.95,
  FLARE: 0.3,            // pull-out after the dive, s
  STRIKE_ALT: 2.2,       // the talons can reach a fox only below this height, m
  WIND_PUSH: 0.85,       // share of the wind that pushes the eagle sideways
  ALERT_R: 105,          // the fox bolts when the eagle comes this close, m
  TROT: 3.3, POUNCE: 5.5, DEN_R: 2.5,
  LOCK_UP: 0.45, LOCK_DOWN: 0.25, LOCK_R0: 12, LOCK_R1: 0.07,
  LIMIT: 38,             // seconds of daylight to find the moment to release
  CLASSES: [
    { id: 'perfect', name: 'Perfect pass', max: 1.5, pts: 35 },
    { id: 'clean', name: 'Clean pass', max: 3.5, pts: 28 },
    { id: 'close', name: 'Close pass', max: 6.5, pts: 18 },
    { id: 'brush', name: 'Brush', max: 11, pts: 8 },
  ],
  POINTS: { track: 15, release: 10, flight: 15, strike: 35, recall: 25 },
  RECALL: { pulses: [1.6, 3.0, 4.4], total: 5.6, perfect: 0.12, good: 0.25, ok: 0.42, pts: [8, 5, 2], bonus: 1, strikeT: 1.1 },
  HUNTS: 5,
};

export const LEVELS = [
  { name: 'Gentle', wind: 0.55, bolt: 9.5, dodge: 0.7, note: 'Light wind, a slow fox' },
  { name: 'Open steppe', wind: 1, bolt: 11, dodge: 1, note: 'Steady wind, a quick fox' },
  { name: 'Blizzard', wind: 1.6, bolt: 12.5, dodge: 1.35, note: 'Hard wind, a fox that jinks' },
];

// The computer riders. sigmaRel: spread of their release time (s); thr: the predicted miss they accept before stooping (m);
// react: delay before the first stoop check (s); lockCap: how steadily they keep the sight on the fox; jit: spread of their call timing (s).
export const RIDERS = [
  { name: 'Apprentice', sigmaRel: 1.3, thr: 6.5, react: 0.9, lockCap: 0.55, sm: 3, steer: false, jit: 0.3, think: [2.5, 4], note: 'Learning the steppe' },
  { name: 'Hunter', sigmaRel: 0.6, thr: 3.6, react: 0.45, lockCap: 0.8, sm: 1.5, steer: false, jit: 0.18, think: [2, 3.5], note: 'Steady and patient' },
  { name: 'Master', sigmaRel: 0.2, thr: 2.0, react: 0.15, lockCap: 0.97, sm: 0.7, steer: true, jit: 0.07, think: [1.5, 3], note: 'Reads wind and fox' },
];

const TAU = Math.PI * 2;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const wrap = (a) => { while (a > Math.PI) a -= TAU; while (a < -Math.PI) a += TAU; return a; };
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const rnd = (h) => {
  h.rs = (h.rs + 0x6d2b79f5) | 0;
  let t = Math.imul(h.rs ^ (h.rs >>> 15), 1 | h.rs);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
export const clone = (h) => JSON.parse(JSON.stringify(h));

// ---- the hunt ------------------------------------------------------------------------------------------------------------------
export function newHunt(seed, n, lv) {
  const L = LEVELS[lv] || LEVELS[1];
  const h = { seed, n, lv, rs: (seed | 0) || 1, t: 0, ph: 'track', pt: 0, trailT: 0, trail: [], cap: 1, steered: false, pvT: -9 };
  const a = rnd(h) * TAU;
  h.wind = { s: (1 + 0.8 * n) * L.wind, a, p1: rnd(h) * TAU, p2: rnd(h) * TAU };
  h.den = { x: (rnd(h) - 0.5) * 120, z: 125 + rnd(h) * 80 };
  const sa = rnd(h) * TAU, sd = 12 + rnd(h) * 38;
  const fx = clamp(h.den.x + Math.sin(sa) * sd, -K.FIELD_X, K.FIELD_X), fz = clamp(h.den.z + Math.cos(sa) * sd, K.Z_MIN + 20, K.Z_MAX);
  h.fox = { x: fx, z: fz, vx: 0, vz: 0, mode: 'listen', mt: 1 + rnd(h) * 1.2, wp: { x: fx, z: fz }, side: 1, dodgeIn: 0, hd: 0, warn: 0 };
  h.sight = { x: 0, z: 150 };
  h.lock = 0; h.lockRel = 0;
  h.eagle = { x: 0, z: 1.5, alt: 1.6, hd: 0, v: 0, bank: 0 };
  h.rel = null; h.st = null; h.res = null; h.rc = null; h.score = null; h.path = 0;
  return h;
}

export function windAt(h, t) {
  const w = h.wind, g = 1 + 0.3 * Math.sin(0.55 * t + w.p1) + 0.15 * Math.sin(1.3 * t + w.p2);
  return { x: Math.sin(w.a) * w.s * g, z: Math.cos(w.a) * w.s * g * 0.6 };
}
export const lockRadius = (h) => K.LOCK_R0 + K.LOCK_R1 * h.fox.z;

const trailAt = (h, t) => {
  const tr = h.trail;
  for (let i = tr.length - 1; i >= 0; i--) if (tr[i][0] <= t) return { x: tr[i][1], z: tr[i][2] };
  return tr.length ? { x: tr[0][1], z: tr[0][2] } : { x: h.fox.x, z: h.fox.z };
};

function stepFox(h, dt) {
  const f = h.fox, L = LEVELS[h.lv] || LEVELS[1];
  if (f.mode === 'gone') return;
  h.trailT -= dt;
  if (h.trailT <= 0) { h.trailT = 0.1; h.trail.push([Math.round(h.t * 100) / 100, f.x, f.z]); if (h.trail.length > 50) h.trail.shift(); }
  f.mt -= dt;
  const live = h.ph === 'fly' || h.ph === 'stoop';
  if (live && f.mode !== 'bolt' && f.mode !== 'bwarn' && f.mode !== 'dodge' && dist(h.eagle, f) < K.ALERT_R) {
    f.mode = 'bolt'; f.dodgeIn = 0.5 + rnd(h) * 0.9 / L.dodge;
  }
  let sp = 0, hx = 0, hz = 0;
  const toward = (p) => { const d = Math.hypot(p.x - f.x, p.z - f.z) || 1; return [(p.x - f.x) / d, (p.z - f.z) / d, d]; };
  switch (f.mode) {
    case 'listen':
      if (f.mt <= 0) {
        if (rnd(h) < 0.32) { f.mode = 'warn'; f.mt = 0.45; f.side = rnd(h) < 0.5 ? -1 : 1; }
        else {
          const ang = rnd(h) * TAU, r = 38 + rnd(h) * 80;
          f.wp = { x: clamp(h.den.x + Math.sin(ang) * r, -K.FIELD_X, K.FIELD_X), z: clamp(h.den.z + Math.cos(ang) * r, K.Z_MIN, K.Z_MAX) };
          f.mode = 'forage';
        }
      }
      break;
    case 'forage': {
      const [dx, dz, d] = toward(f.wp);
      if (d < 1.5) { f.mode = 'listen'; f.mt = 0.6 + rnd(h) * 1.3; } else { sp = K.TROT; hx = dx; hz = dz; }
      break;
    }
    case 'warn':
      if (f.mt <= 0) {
        f.mode = 'pounce'; f.mt = 0.9;
        const ang = (rnd(h) - 0.5) * 1.2 + (f.side > 0 ? 1.1 : -1.1);
        f.pdx = Math.sin(ang); f.pdz = Math.cos(ang);
      }
      break;
    case 'pounce':
      sp = K.POUNCE; hx = f.pdx; hz = f.pdz;
      if (f.mt <= 0) { f.mode = 'listen'; f.mt = 1 + rnd(h) * 1.2; }
      break;
    case 'bolt': {
      const [dx, dz, d] = toward(h.den);
      if (d < K.DEN_R) { f.mode = 'gone'; f.home = true; f.vx = 0; f.vz = 0; return; }
      sp = L.bolt; hx = dx; hz = dz;
      f.dodgeIn -= dt;
      if (f.dodgeIn <= 0 && d > 14) { f.mode = 'bwarn'; f.mt = 0.35; f.side = rnd(h) < 0.5 ? -1 : 1; }
      break;
    }
    case 'bwarn': {
      const [dx, dz] = toward(h.den);
      sp = L.bolt * 0.55; hx = dx; hz = dz;
      if (f.mt <= 0) {
        const base = Math.atan2(dx, dz), ang = base + f.side * (0.75 + rnd(h) * 0.25);
        f.pdx = Math.sin(ang); f.pdz = Math.cos(ang); f.mode = 'dodge'; f.mt = 0.55;
      }
      break;
    }
    case 'dodge':
      sp = L.bolt * 1.05; hx = f.pdx; hz = f.pdz;
      if (f.mt <= 0) { f.mode = 'bolt'; f.dodgeIn = (1.7 + rnd(h) * 1.3) / L.dodge; }
      break;
    default: break;
  }
  f.vx = hx * sp; f.vz = hz * sp;
  f.x = clamp(f.x + f.vx * dt, -K.FIELD_X - 25, K.FIELD_X + 25); f.z = clamp(f.z + f.vz * dt, 20, K.Z_MAX + 30);
  if (sp > 0.1) f.hd = Math.atan2(f.vx, f.vz);
  f.warn = f.mode === 'warn' || f.mode === 'bwarn' ? 1 : 0;
}

const stoopStart = (h) => {
  const e = h.eagle, f = h.fox;
  h.ph = 'stoop';
  h.st = { t: 0, dur: clamp(e.alt / K.DIVE_RATE, K.DIVE_MIN, K.DIVE_MAX), alt0: e.alt, d0: dist(e, f), minD: 999, v0: Math.max(e.v, K.STOOP_V0), miss: null, x0: e.x, z0: e.z };
  h.stoopAt = { x: e.x, z: e.z, dist: h.st.d0 };
};

const classify = (miss) => { for (const c of K.CLASSES) if (miss <= c.max) return c; return { id: 'miss', name: 'Missed', max: 99, pts: 0 }; };

const endHunt = (h) => { h.ph = 'done'; h.score = scoreOf(h); };

function resolveHere(h) {
  const st = h.st, e = h.eagle, f = h.fox;
  const miss = st.minD < 900 ? st.minD : dist(e, f);
  const c = classify(miss);
  st.miss = miss;
  h.res = { kind: 'pass', miss, cls: c.id, name: c.name, pts: c.pts, at: { x: f.x, z: f.z }, from: { x: e.x, z: e.z } };
  f.mode = 'gone'; f.vx = 0; f.vz = 0; f.puff = true;
  h.ph = 'strike'; h.pt = 0;
}

function stepEagle(h, dt, inp) {
  const e = h.eagle, f = h.fox, w = windAt(h, h.t), st = h.st, stooping = h.ph === 'stoop';
  let tx, tz;
  if (inp.aim) { tx = inp.aim.x; tz = inp.aim.z; h.steered = true; }
  else if (stooping) {
    const lq = 0.5 + 0.5 * h.lockRel, rem = Math.max(0.1, st.dur - st.t);
    tx = f.x + f.vx * rem * lq; tz = f.z + f.vz * rem * lq;
  } else {
    const tau = 0.35 + 2.0 * (1 - h.lockRel), p = trailAt(h, h.t - tau);
    tx = p.x; tz = p.z;
  }
  const want = Math.atan2(tx - e.x, tz - e.z), diff = wrap(want - e.hd), rate = stooping ? K.STOOP_TURN : K.TURN;
  const turn = clamp(diff, -rate * dt, rate * dt);
  e.hd = wrap(e.hd + turn);
  e.bank += (clamp(diff * 1.4, -0.65, 0.65) - e.bank) * Math.min(1, 6 * dt);
  if (stooping) {
    st.t += dt;
    const k = clamp(st.t / st.dur, 0, 1);
    if (st.t <= st.dur) { e.v = st.v0 + (K.STOOP_V1 - st.v0) * k; e.alt = Math.max(0.4, st.alt0 * (1 - k)); }
    else { e.v = Math.max(18, e.v - 40 * dt); e.alt = Math.min(6, e.alt + 9 * dt); }
  } else {
    e.v += (K.CRUISE - e.v) * Math.min(1, 1.2 * dt);
    e.alt = Math.min(K.ALT, e.alt + K.CLIMB * dt * (1 - 0.5 * e.alt / K.ALT));
  }
  const ox = e.x, oz = e.z;
  e.x += (Math.sin(e.hd) * e.v + w.x * K.WIND_PUSH) * dt;
  e.z += (Math.cos(e.hd) * e.v + w.z * K.WIND_PUSH) * dt;
  if (!stooping) h.path += Math.hypot(e.x - ox, e.z - oz);
  if (stooping) {
    if (e.alt <= K.STRIKE_ALT) st.minD = Math.min(st.minD, dist(e, f));
    if (st.t >= st.dur + K.FLARE) resolveHere(h);
  }
}

// One simulation step. inp: { sight: {x,z}|null, aim: {x,z}|null, act: bool }. `act` is the single context action:
// track -> release the eagle, fly -> stoop, recall -> call.
export function stepHunt(h, dt, inp = {}) {
  if (h.ph === 'done') return h;
  h.t += dt;
  if (h.ph === 'track') {
    if (inp.sight) h.sight = { x: clamp(inp.sight.x, -K.FIELD_X - 20, K.FIELD_X + 20), z: clamp(inp.sight.z, 10, K.Z_MAX + 20) };
    const on = dist(h.sight, h.fox) <= lockRadius(h);
    h.lock = clamp(h.lock + (on ? K.LOCK_UP : -K.LOCK_DOWN) * dt, 0, Math.min(1, h.cap));
    stepFox(h, dt);
    if (inp.act) {
      const e = h.eagle, f = h.fox;
      h.rel = { t: h.t, range: Math.hypot(f.x, f.z), denDist: dist(f, h.den), lock: h.lock, wind: windAt(h, h.t) };
      h.lockRel = h.lock;
      e.hd = Math.atan2(h.sight.x - e.x, h.sight.z - e.z); e.v = 14; e.alt = 1.6;
      h.relPos = { x: e.x, z: e.z };
      h.ph = 'fly'; h.pt = 0;
    } else if (h.t >= K.LIMIT) {
      h.res = { kind: 'wait' }; h.fox.mode = 'gone'; h.fox.puff = true; endHunt(h);
    }
    return h;
  }
  if (h.ph === 'fly' || h.ph === 'stoop') {
    if (h.ph === 'fly' && inp.act && h.eagle.alt > 2) stoopStart(h);
    stepFox(h, dt);
    if (h.fox.mode === 'gone' && h.fox.home && (h.ph === 'fly' || h.ph === 'stoop')) {
      h.res = { kind: 'den' }; h.ph = 'strike'; h.pt = 0;
      return h;
    }
    stepEagle(h, dt, inp);
    return h;
  }
  if (h.ph === 'strike') {
    h.pt += dt;
    stepFox(h, dt);
    if (h.pt >= K.RECALL.strikeT) { h.ph = 'recall'; h.rc = { t: 0, idx: 0, taps: [] }; }
    return h;
  }
  if (h.ph === 'recall') {
    const rc = h.rc, R = K.RECALL;
    rc.t += dt;
    if (inp.act) {
      let k = -1, best = 9;
      R.pulses.forEach((p, i) => { if (rc.taps[i] === undefined) { const d = Math.abs(rc.t - p); if (d < best) { best = d; k = i; } } });
      if (k >= 0 && best <= 0.6) {
        const q = best <= R.perfect ? 0 : best <= R.good ? 1 : best <= R.ok ? 2 : 3;
        rc.taps[k] = { q, err: rc.t - R.pulses[k] };
      }
    }
    R.pulses.forEach((p, i) => { if (rc.taps[i] === undefined && rc.t > p + 0.6) rc.taps[i] = { q: 3, err: 0.6 }; });
    if (rc.t >= R.total) endHunt(h);
  }
  return h;
}

export function scoreOf(h) {
  const P = K.POINTS, s = { track: 0, release: 0, flight: 0, strike: 0, recall: 0, total: 0, cls: 'wait', name: 'The fox slipped away', missM: null, eff: 0 };
  if (h.rel) {
    s.track = Math.round(P.track * h.rel.lock);
    const open = clamp(h.rel.denDist / 70, 0, 1), r = h.rel.range;
    const rs = r >= 100 && r <= 200 ? 1 : r < 100 ? clamp((r - 30) / 70, 0, 1) : clamp(1 - (r - 200) / 110, 0, 1);
    s.release = Math.round(P.release * (0.55 * open + 0.45 * rs));
    const end = h.stoopAt || { x: h.eagle.x, z: h.eagle.z };
    const straight = Math.hypot(end.x - h.relPos.x, end.z - h.relPos.z);
    const eff = straight < 25 ? 1 : clamp(straight / Math.max(h.path, 1), 0, 1);
    s.eff = eff;
    s.flight = Math.round(P.flight * clamp((eff - 0.85) / 0.14, 0, 1));
  }
  if (h.res && h.res.kind === 'pass') { s.strike = h.res.pts; s.cls = h.res.cls; s.name = h.res.name; s.missM = h.res.miss; }
  else if (h.res && h.res.kind === 'den') { s.cls = 'den'; s.name = 'The fox reached its den'; }
  if (h.rc) {
    const R = K.RECALL;
    let sum = 0, all = true;
    h.rc.taps.forEach((tp) => { if (!tp) return; sum += R.pts[tp.q] || 0; if (tp.q !== 0) all = false; });
    if (h.rc.taps.length < R.pulses.length) all = false;
    s.recall = sum + (all ? R.bonus : 0);
  }
  s.total = s.track + s.release + s.flight + s.strike + s.recall;
  return s;
}

// ---- looking ahead (Think hint and the computer riders) --------------------------------------------------------------------------
// What would a stoop started right now score? Runs a copy of the hunt with a different dodge seed, so the fox's next dodge stays a surprise.
export function previewMiss(h, salt = 0x9e3779b9) {
  if (h.ph !== 'fly') return 99;
  const c = clone(h);
  c.rs = (c.rs ^ salt) | 0;
  stepHunt(c, 0, { act: true });
  let guard = 0;
  while (c.ph === 'stoop' && guard++ < 120) stepHunt(c, 1 / 20, {});
  if (c.res && c.res.kind === 'pass') return c.res.miss;
  return 99;
}

// A point on the ground ahead of the fox where the eagle's line meets it (used by the steering computer riders).
function intercept(h) {
  const f = h.fox, e = h.eagle, d = dist(e, f), lead = clamp(d / K.CRUISE, 0, 5) * 0.65;
  return { x: f.x + f.vx * lead, z: f.z + f.vz * lead };
}

// What a computer rider does this tick. P: { tRel, thr, react, steer, salt, jit: [..] }
export function aiInput(h, P) {
  if (h.ph === 'track') {
    const f = h.fox, inp = { sight: { x: f.x, z: f.z } };
    if (h.t >= P.tRel) inp.act = true;
    return inp;
  }
  if (h.ph === 'fly') {
    const inp = {}, since = h.t - h.rel.t;
    if (P.steer && since > P.react) inp.aim = intercept(h);
    if (since > P.react + 1) {
      const d = dist(h.eagle, h.fox);
      if (d < 14) inp.act = true;
      else if (h.t - h.pvT >= 0.1 && d < 90) { h.pvT = h.t; const err = P.pg ? (rnd(P.pg) + rnd(P.pg) + rnd(P.pg) - 1.5) * 2 * P.sm : 0;
        if (previewMiss(h, P.salt) + err <= P.thr) inp.act = true; }
    }
    return inp;
  }
  if (h.ph === 'recall') {
    const inp = {};
    for (let k = 0; k < K.RECALL.pulses.length; k++) {
      if (h.rc.taps[k] === undefined && h.rc.t >= K.RECALL.pulses[k] + P.jit[k] && !(h.rc.fired && h.rc.fired[k])) {
        h.rc.fired = h.rc.fired || []; h.rc.fired[k] = 1;
        inp.act = true;
        break;
      }
    }
    return inp;
  }
  return {};
}

// Build the parameters one computer rider uses for one hunt. `noise` is any integer seed.
export function aiParams(rider, tRel, noise) {
  const g = { rs: noise | 0 || 7 };
  const pg = { rs: (noise * 7919 + 13) | 0 };
  const gauss = () => (rnd(g) + rnd(g) + rnd(g) - 1.5) * 2;
  const R = K.RECALL;
  return {
    tRel: Math.max(0.8, tRel + gauss() * rider.sigmaRel), thr: rider.thr * (0.85 + rnd(g) * 0.3), react: rider.react, steer: rider.steer,
    salt: 0x5bd1e995 ^ (noise | 0), jit: R.pulses.map(() => gauss() * rider.jit * 0.6), pg, sm: rider.sm ?? 1,
  };
}

// Pick the best moment to release from a hunt in its track phase. Runs whole hunts on copies. Returns { tRel, expected, at }.
export function planRelease(h0, rider, o = {}) {
  const t0 = h0.t, step = o.step ?? 1, first = Math.max(o.from ?? t0 + 0.4, 0.4), max = Math.min(K.LIMIT - 5, first + (o.span ?? 34));
  let best = null;
  const run = (tRel) => {
    const h = clone(h0);
    h.cap = rider.lockCap; h.pvT = -9;
    const P = { tRel, thr: rider.thr, react: rider.react, steer: rider.steer, salt: 0x5bd1e995, jit: [0, 0, 0] };
    let guard = 0;
    while (h.ph !== 'recall' && h.ph !== 'done' && guard++ < 60 * 30) stepHunt(h, 1 / 30, aiInput(h, P));
    const sc = scoreOf(h);
    const exp = sc.track + sc.release + sc.flight + sc.strike + 0.75 * K.POINTS.recall;
    return { tRel, expected: exp, sc, rel: h.rel, res: h.res };
  };
  const all = [];
  for (let t = first; t <= max; t += step) { const r = run(t); all.push(r); if (!best || r.expected > best.expected + 1e-6) best = r; }
  // the earliest moment that is nearly as good as the best one: patience, but not for longer than needed
  if (best) for (const r of all) if (r.expected >= best.expected - 3) { best = r; break; }
  if (best && step > 0.5) {
    for (const dtc of [-0.5, 0.5]) {
      const t = best.tRel + dtc;
      if (t >= first && t <= max) { const r = run(t); if (r.expected > best.expected + 1e-6) best = r; }
    }
  }
  return best || { tRel: first, expected: 0, sc: null, rel: null, res: null };
}

// Wind in words for the Think text and the hunting notes.
export function windWords(w) {
  const sp = Math.hypot(w.x, w.z);
  if (sp < 0.6) return 'almost still';
  const side = Math.abs(w.x) > Math.abs(w.z) * 0.7 ? (w.x > 0 ? 'from the left' : 'from the right') : (w.z > 0 ? 'from behind' : 'in your face');
  return `${sp.toFixed(1)} m/s ${side}`;
}

// How a stoop would go if it started right now, searched over the next 1.5 s: returns { inS, miss }.
export function bestStoop(h) {
  if (h.ph !== 'fly') return null;
  const c = clone(h);
  let best = { inS: 0, miss: previewMiss(c) };
  for (let k = 1; k <= 15; k++) {
    for (let i = 0; i < 6; i++) { stepHunt(c, 1 / 60, { aim: null }); if (c.ph !== 'fly') return best; }
    const m = previewMiss(c);
    if (m < best.miss - 0.05) best = { inS: k * 0.1, miss: m };
  }
  return best;
}
