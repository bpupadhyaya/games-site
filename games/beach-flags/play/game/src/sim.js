// Beach Flags: the simulation. Pure and deterministic (no clocks, no DOM, no Math.random).
// A round: N racers lie face down on the sand, a whistle blows, they spin up, sprint FLAG_Z metres and grab one of N-1 batons
// planted in the sand. The racer left without a baton is out. Everything is in metres and seconds; z runs from the start line
// towards the flags, x is across the beach.
export const LANE_W = 1.25;          // lane width (m)
export const FLAG_Z = 20;            // flag line (m from the start line)
export const FLAG_H = 1.15;           // baton height as drawn (m)
export const RISE_T = 0.42;          // spin and get up (s)
export const FLINCH_T = 0.55;        // time lost for moving before the whistle (s)
export const STRIDE_MIN = 0.17;      // taps closer than this are one stride (s)
export const RUSH = 0.24;            // strides closer than this lose power (s)
export const IDEAL_LO = 0.22;        // the rhythm window (s between strides)
export const IDEAL_HI = 0.34;
export const IMPULSE = 2.95;         // speed added by a clean stride (m/s)
export const DRAG = 1.6;             // exponential speed loss (1/s)
export const V_MAX = 9.4;
export const V_START = 1.8;          // speed on getting up
export const LAT_V = 3.0;            // sideways speed after a steering stride (m/s)
export const LAT_DECAY = 3.5;
export const STEER_COST = 0.14;      // share of a stride lost at full steering
export const RUN_REACH = { fwd: 0.3, back: 0.25, side: 0.42 };
export const DIVE_REACH = { fwd: 0.95, back: 0.35, side: 0.85 };
export const DIVE_T = 0.5;
export const SLIDE_T = 0.45;
export const DOWN_T = 0.55;
export const DIVE_MULT = 1.25;
export const DIVE_MIN_V = 5.0;
export const TIMEOUT = 14;           // a round never lasts longer than this after the whistle (s)

export const TIERS = [
  { name: 'Club Beach', n: 6, skills: [0.3, 0.62], blurb: 'Six racers, five flags. Friendly rivals.' },
  { name: 'Open Carnival', n: 8, skills: [0.45, 0.75], blurb: 'Eight racers, seven flags. Rivals dive and read the field.' },
  { name: "Champions' Cup", n: 8, skills: [0.54, 0.86], blurb: 'The sharpest field on the beach.' },
];

export const NAMES = ['Mika', 'Tane', 'Ravi', 'Ana', 'Leo', 'Kofi', 'Sora', 'Bea', 'Zed', 'Noor', 'Pita', 'Lena', 'Omar', 'Wren', 'Jun', 'Inez', 'Cass', 'Dev', 'Ili', 'Rafa'];
// Looks: cap, jersey, shorts, skin, hair. The first entry is the player's default.
export const LOOKS = [
  { cap: '#ffc83d', top: '#f4f1e6', bot: '#1c3d73', skin: '#c68b5a', hair: '#2a1a12' },
  { cap: '#e8503a', top: '#e8503a', bot: '#22252e', skin: '#f0c19a', hair: '#7a4b22' },
  { cap: '#2f8fd6', top: '#2f8fd6', bot: '#f4f1e6', skin: '#8a5a3a', hair: '#15110d' },
  { cap: '#2fb67a', top: '#2fb67a', bot: '#22252e', skin: '#e0a878', hair: '#3a2514' },
  { cap: '#8a5cf0', top: '#8a5cf0', bot: '#f4f1e6', skin: '#5e3b27', hair: '#0e0a08' },
  { cap: '#ff8a2f', top: '#ff8a2f', bot: '#1c3d73', skin: '#f2cfa8', hair: '#b8813a' },
  { cap: '#e04a8c', top: '#e04a8c', bot: '#22252e', skin: '#b87a50', hair: '#1c120d' },
  { cap: '#20b8c4', top: '#20b8c4', bot: '#f4f1e6', skin: '#d99a6c', hair: '#32200f' },
];

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const ordinal = (n) => `${n}${['th', 'st', 'nd', 'rd'][n % 100 > 10 && n % 100 < 14 ? 0 : n % 10 < 4 ? n % 10 : 0]}`;
export const fmtMs = (s) => `${Math.round(s * 1000)} ms`;
export const fmtSec = (s) => s.toFixed(2);

// ---- tiny deterministic stream stored as a number in the state ----------------------------------------------------------
function rnd(o) {
  o.s = (o.s + 0x6d2b79f5) | 0;
  let t = Math.imul(o.s ^ (o.s >>> 15), 1 | o.s);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const seedNum = (n) => ((n | 0) >>> 0) || 1;

// ---- fields ------------------------------------------------------------------------------------------------------------------
// A list of rival profiles for a cup tier, spread across the tier's skill band, in a seeded order.
export function newField(tier, seed, youLook = 0) {
  const t = TIERS[clamp(tier | 0, 0, TIERS.length - 1)], o = { s: seedNum(seed) };
  const rivals = t.n - 1, names = NAMES.slice(), out = [];
  for (let i = 0; i < rivals; i++) {
    const k = names.splice(Math.floor(rnd(o) * names.length), 1)[0];
    const skill = t.skills[0] + (t.skills[1] - t.skills[0]) * (rivals === 1 ? 1 : i / (rivals - 1)) + (rnd(o) - 0.5) * 0.05;
    out.push({ name: k, look: 1 + (i % (LOOKS.length - 1)), skill: clamp(skill, 0.1, 0.97), you: false });
  }
  out.splice(Math.floor(rnd(o) * (out.length + 1)), 0, { name: 'You', look: youLook, skill: 0.85, you: true });
  return out;
}

// ---- a round -----------------------------------------------------------------------------------------------------------------
// opts: { profiles, seed, roundNo, level, hasPlayer, diveBias }
export function newRound(opts) {
  const o = { s: seedNum(opts.seed) };
  const profiles = opts.profiles, n = profiles.length;
  const span = (n - 1) * LANE_W;
  const order = profiles.map((_, i) => i);
  for (let i = n - 1; i > 0; i--) { const j = Math.floor(rnd(o) * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  const runners = order.map((pi, lane) => {
    const p = profiles[pi], s = p.skill;
    const q = {
      id: lane, pi, lane, name: p.name, look: p.look, you: !!p.you && opts.hasPlayer !== false, skill: s,
      x: -span / 2 + lane * LANE_W, z: 0, v: 0, lat: 0, phase: 'prone', pt: 0, flag: -1, claimT: null, diveGrab: false,
      react: null, lastStride: -9, strides: 0, sp: 0, falseStart: false, perfect: 0, hits: 0,
      ai: {
        s: seedNum(Math.floor(rnd(o) * 4294967295)), reactT: 0.52 - 0.28 * s + rnd(o) * 0.08, cad: 0.26 + (1 - s) * 0.1,
        diveD: 1.5 + (1 - s) * 1.2 + rnd(o) * 0.5, fs: rnd(o) < (1 - s) * 0.12, next: 0, target: -1, replan: 0, aware: rnd(o) < s + 0.1,
      },
    };
    return q;
  });
  const m = n - 1, flags = [];
  const fspan = span, fstep = m > 1 ? fspan / (m - 1) : 0;
  for (let j = 0; j < m; j++) {
    const x = m > 1 ? -fspan / 2 + j * fstep : (rnd(o) - 0.5) * 0.6;
    flags.push({ id: j, x, z: FLAG_Z + (rnd(o) - 0.5) * 1.0, owner: -1 });
  }
  return {
    n, m, flags, runners, span, t: 0, count: 1.4 + rnd(o) * 2.0, go: false, tgo: 0, claims: 0, over: null, events: [], seq: 0,
    roundNo: opts.roundNo | 0, level: opts.level | 0, you: runners.findIndex((q) => q.you), hintsUsed: 0, s: o.s, evDone: 0,
    fsAt: 0.15 + rnd(o) * 0.5,
  };
}

const emit = (r, e) => { e.seq = r.seq++; r.events.push(e); if (r.events.length > 80) r.events.splice(0, r.events.length - 60); };

// ---- player inputs ------------------------------------------------------------------------------------------------------------
// steer in [-1, 1]. Returns what happened: 'early' (before the whistle), 'spin', 'stride', 'ignored'.
export function tapRunner(r, id, steer = 0) {
  const q = r.runners[id];
  if (!q || r.over) return 'ignored';
  if (!r.go) {
    if (q.phase === 'prone') { q.phase = 'flinch'; q.pt = 0; q.falseStart = true; emit(r, { type: 'false', id }); return 'early'; }
    return 'ignored';
  }
  if (q.phase === 'prone') {
    q.react = r.tgo; q.phase = 'spin'; q.pt = 0;
    emit(r, { type: 'spin', id, react: q.react });
    return 'spin';
  }
  if (q.phase === 'down') { q.pt += 0.07; return 'ignored'; }
  if (q.phase !== 'run') return 'ignored';
  const since = r.tgo - q.lastStride;
  if (since < STRIDE_MIN) return 'ignored';
  const T = Math.min(since, 0.7);
  const gain = T >= RUSH ? 1 : Math.pow(T / RUSH, 3);
  const st = clamp(steer, -1, 1);
  q.v = Math.min(V_MAX, q.v + IMPULSE * gain * (1 - STEER_COST * Math.abs(st)));
  q.lat = st * LAT_V;
  const good = T >= IDEAL_LO && T <= IDEAL_HI;
  q.lastStride = r.tgo; q.strides++; if (good) q.perfect++;
  emit(r, { type: 'stride', id, T, good });
  return 'stride';
}

export function diveRunner(r, id) {
  const q = r.runners[id];
  if (!q || r.over || !r.go || q.phase !== 'run') return false;
  q.phase = 'dive'; q.pt = 0; q.vd = Math.max(q.v, DIVE_MIN_V) * DIVE_MULT; q.diveFrom = q.z;
  emit(r, { type: 'dive', id });
  return true;
}

// ---- reading the field (used by rivals, by hints and by Watch & Learn) ------------------------------------------------------
const free = (r) => r.flags.filter((f) => f.owner < 0);
// Rough seconds for a runner to take flag f.
export function eta(q, f) {
  const dz = Math.max(0, f.z - q.z - RUN_REACH.fwd), v = Math.max(q.phase === 'run' ? q.v : 5.5, 4);
  return dz / v + (Math.abs(f.x - q.x) / LAT_V) * 0.55;
}
// The best flag for runner q, with the reason.
export function bestFlag(r, q, aware = true) {
  const fl = free(r);
  if (!fl.length) return null;
  let best = null;
  for (const f of fl) {
    let c = eta(q, f), contested = false;
    if (aware) {
      for (const o of r.runners) {
        if (o === q || o.flag >= 0 || (o.phase !== 'run' && o.phase !== 'dive' && o.phase !== 'spin' && o.phase !== 'prone')) continue;
        const oe = eta(o, f);
        if (oe < c - 0.04 && Math.abs(o.x - f.x) < Math.abs(q.x - f.x) + 0.2) { contested = true; break; }
      }
    }
    if (contested) c += 0.45;
    if (!best || c < best.cost) best = { flag: f, cost: c, contested };
  }
  return best;
}
// What a good racer does right now, in words and numbers (the Think hint and Watch & Learn use this).
export function advise(r, q = r.runners[r.you]) {
  if (!q) return { act: 'none', why: '' };
  if (r.over) return { act: 'none', why: '' };
  if (!r.go && q.phase === 'prone') return { act: 'wait', flag: -1, steer: 0, why: 'Stay flat until the whistle. Moving early costs half a second. When it blows, tap once to spin and get up.' };
  if (q.phase === 'flinch') return { act: 'wait', flag: -1, steer: 0, why: 'Caution: you moved before the whistle. Stay flat again.' };
  if (q.phase === 'prone') return { act: 'spin', flag: -1, steer: 0, why: 'Whistle! Tap now to spin and get up. Every tenth of a second is about a metre.' };
  const b = bestFlag(r, q, true);
  if (!b) return { act: 'none', flag: -1, steer: 0, why: 'All flags are taken.' };
  const f = b.flag, dx = f.x - q.x, dz = f.z - q.z;
  const steer = clamp(dx / 1.2, -1, 1);
  const side = Math.abs(dx) < 0.25 ? 'straight ahead' : dx > 0 ? 'to your right' : 'to your left';
  if (q.phase === 'run' && dz <= 2.3 && dz > 0.35 && Math.abs(dx) <= 0.7) {
    return { act: 'dive', flag: f.id, steer, why: `Dive now: the flag is ${dz.toFixed(1)} m ahead and within reach. A dive stretches you about a metre further than running.` };
  }
  if (q.phase === 'run' && dz > 2.3) {
    const why = b.contested ? `A rival is closer to the nearest flag. Go for the open one ${side}.` : `Run for the flag ${side}. Tap in the gold zone of the rhythm bar and steer by tapping towards it.`;
    return { act: 'run', flag: f.id, steer, why };
  }
  return { act: 'run', flag: f.id, steer, why: `Keep your line to the flag ${side}.` };
}

// ---- stepping ----------------------------------------------------------------------------------------------------------------
function aiStride(r, q) {
  const a = q.ai;
  const b = bestFlag(r, q, a.aware);
  if (!b) return;
  if (a.target < 0 || r.flags[a.target].owner >= 0 || b.cost < eta(q, r.flags[a.target]) * 0.7) a.target = b.flag.id;
  const f = r.flags[a.target];
  const steer = Math.abs(f.x - q.x) < 0.12 ? 0 : clamp((f.x - q.x) / 1.1, -1, 1);
  const since = r.tgo - q.lastStride;
  if (since >= STRIDE_MIN) {
    const T = Math.min(since, 0.7), gain = T >= RUSH ? 1 : Math.pow(T / RUSH, 3);
    q.v = Math.min(V_MAX, q.v + IMPULSE * gain * (1 - STEER_COST * Math.abs(steer)));
    q.lat = steer * LAT_V; q.lastStride = r.tgo; q.strides++;
    if (T >= IDEAL_LO && T <= IDEAL_HI) q.perfect++;
    emit(r, { type: 'stride', id: q.id, T, good: T >= IDEAL_LO && T <= IDEAL_HI });
  }
}

function aiThink(r, q, dt) {
  const a = q.ai;
  if (q.phase === 'prone') {
    if (!r.go) {
      if (a.fs && r.count <= r.fsAt) { q.phase = 'flinch'; q.pt = 0; q.falseStart = true; emit(r, { type: 'false', id: q.id }); }
    } else if (r.tgo >= a.reactT) { q.react = r.tgo; q.phase = 'spin'; q.pt = 0; emit(r, { type: 'spin', id: q.id, react: q.react }); }
  } else if (q.phase === 'run') {
    a.next -= dt;
    if (a.next <= 0) {
      aiStride(r, q);
      const jit = (rnd(a) - 0.5) * 0.03, slip = rnd(a) < (1 - q.skill) * 0.12 ? 0.1 : 0;
      a.next = a.cad + jit + slip;
    }
    // choose the moment to dive
    const b = a.target >= 0 && r.flags[a.target].owner < 0 ? r.flags[a.target] : null;
    if (b) {
      const dz = b.z - q.z, dx = Math.abs(b.x - q.x);
      if (dz <= a.diveD && dz > 0.5 && dx <= 0.6) diveRunner(r, q.id);
    }
  }
}

function stepRunner(r, q, dt) {
  const aiOn = !q.you || r.auto === q.id;
  q.pt += dt;
  switch (q.phase) {
    case 'prone':
      if (aiOn) aiThink(r, q, dt);
      break;
    case 'flinch':
      if (q.pt >= FLINCH_T) { q.phase = 'prone'; q.pt = 0; }
      break;
    case 'spin':
      if (q.pt >= RISE_T) { q.phase = 'run'; q.pt = 0; q.v = V_START; q.lastStride = r.tgo - 0.12; q.ai.next = 0.05; }
      break;
    case 'run':
      if (aiOn) aiThink(r, q, dt);
      q.v *= Math.exp(-DRAG * dt);
      q.z += q.v * dt; q.x += q.lat * dt; q.lat *= Math.exp(-LAT_DECAY * dt);
      q.sp += (q.v * dt) / 2.0 * Math.PI;
      break;
    case 'dive': {
      const u = q.pt / DIVE_T;
      const vz = q.vd * Math.max(0, 1 - u);
      q.z += vz * dt; q.x += q.lat * dt * 0.4; q.lat *= Math.exp(-LAT_DECAY * dt);
      q.v = vz * 0.6;
      if (q.pt >= DIVE_T) { q.phase = 'slide'; q.pt = 0; }
      break;
    }
    case 'slide':
      q.v *= Math.exp(-5 * dt); q.z += q.v * dt;
      if (q.pt >= SLIDE_T) { q.phase = q.flag >= 0 ? 'hold' : 'down'; q.pt = 0; q.v = 0; }
      break;
    case 'down':
      if (q.pt >= DOWN_T && free(r).length > 0) { q.phase = 'spin'; q.pt = 0; q.stand = true; }
      break;
    case 'hold':
      q.v *= Math.exp(-4 * dt); q.z += q.v * dt; q.x += q.lat * dt * 0.3; q.lat *= Math.exp(-LAT_DECAY * dt);
      break;
    case 'beaten':
      q.v *= Math.exp(-3 * dt); q.z += q.v * dt;
      break;
    default: break;
  }
  // nobody runs into the sea: a racer past the flag line stops a few metres beyond it
  if (q.z > FLAG_Z + 4.5) { q.z = FLAG_Z + 4.5; q.v = 0; }
}

function resolveCaptures(r) {
  const pairs = [];
  for (const q of r.runners) {
    if (q.flag >= 0) continue;
    const reach = q.phase === 'dive' ? DIVE_REACH : q.phase === 'run' ? RUN_REACH : null;
    if (!reach) continue;
    for (const f of r.flags) {
      if (f.owner >= 0) continue;
      const dz = f.z - q.z, dx = Math.abs(f.x - q.x);
      if (dz <= reach.fwd && dz >= -reach.back && dx <= reach.side) pairs.push({ q, f, dz, dx });
    }
  }
  pairs.sort((a, b) => a.dz - b.dz || a.dx - b.dx || a.q.id - b.q.id);
  for (const p of pairs) {
    if (p.q.flag >= 0 || p.f.owner >= 0) continue;
    p.f.owner = p.q.id; p.q.flag = p.f.id; p.q.claimT = r.tgo; p.q.diveGrab = p.q.phase === 'dive';
    r.claims++;
    if (p.q.phase === 'run') { p.q.phase = 'hold'; p.q.pt = 0; }
    emit(r, { type: 'claim', id: p.q.id, flag: p.f.id, dive: p.q.diveGrab, order: r.claims, time: r.tgo });
  }
}

// Contact: runners shoulder to shoulder bump each other apart and both lose a little speed.
function contacts(r, dt) {
  const act = r.runners.filter((q) => q.phase === 'run' || q.phase === 'dive');
  for (let i = 0; i < act.length; i++) for (let j = i + 1; j < act.length; j++) {
    const a = act[i], b = act[j], dx = a.x - b.x, dz = a.z - b.z;
    if (Math.abs(dx) < 0.55 && Math.abs(dz) < 0.7) {
      const s = dx === 0 ? (a.id < b.id ? -1 : 1) : Math.sign(dx);
      a.x += s * 0.9 * dt; b.x -= s * 0.9 * dt;
      a.v *= 1 - 0.8 * dt; b.v *= 1 - 0.8 * dt;
      if (!a.bump && !b.bump) { a.bump = b.bump = true; a.hits++; b.hits++; emit(r, { type: 'bump', a: a.id, b: b.id, x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 }); }
    } else if (Math.abs(dx) > 0.8) { a.bump = false; b.bump = false; }
  }
}

export function stepRound(r, dt) {
  if (r.over) {
    r.endT = (r.endT || 0) + dt;
    for (const q of r.runners) stepRunner(r, q, dt);
    return;
  }
  r.t += dt;
  if (!r.go) {
    r.count -= dt;
    if (r.count <= 0) { r.go = true; r.tgo = 0; emit(r, { type: 'whistle' }); }
  } else r.tgo += dt;
  for (const q of r.runners) stepRunner(r, q, dt);
  if (r.go) {
    contacts(r, dt);
    for (const q of r.runners) q.x = clamp(q.x, -r.span / 2 - 2.4, r.span / 2 + 2.4);
    resolveCaptures(r);
    if (r.claims >= r.m || r.tgo > TIMEOUT) finish(r);
  }
}

function finish(r) {
  // a safety net: if time ran out, remaining flags go to the nearest runners
  if (r.claims < r.m) {
    for (const f of r.flags) if (f.owner < 0) {
      const c = r.runners.filter((q) => q.flag < 0).sort((a, b) => Math.abs(a.x - f.x) - Math.abs(b.x - f.x) || a.id - b.id)[0];
      if (c) { f.owner = c.id; c.flag = f.id; c.claimT = r.tgo; r.claims++; emit(r, { type: 'claim', id: c.id, flag: f.id, dive: false, order: r.claims, time: r.tgo }); }
    }
  }
  const out = r.runners.filter((q) => q.flag < 0);
  for (const q of out) { q.phase = 'beaten'; q.pt = 0; }
  const order = r.runners.filter((q) => q.flag >= 0).sort((a, b) => a.claimT - b.claimT || a.id - b.id).map((q) => q.id);
  const me = r.runners[r.you];
  r.over = {
    outIds: out.map((q) => q.id), outPi: out.map((q) => q.pi), order, t: r.tgo,
    youOut: !!me && me.flag < 0, youPlace: me ? (me.flag >= 0 ? order.indexOf(me.id) + 1 : r.n) : 0,
    react: me ? me.react : null, claimT: me ? me.claimT : null, dive: !!(me && me.diveGrab), falseStart: !!(me && me.falseStart),
  };
  emit(r, { type: 'over', out: r.over.outIds });
}
