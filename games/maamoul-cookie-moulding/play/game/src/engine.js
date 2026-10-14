// Maamoul Cookie Moulding: the whole simulation. Pure and deterministic: no clock, no Math.random, no DOM.
// One cookie at a time passes through four hand steps (fill, seal, knock, place); finished trays bake in one oven.
// Everything the Rules page quotes comes from the constants here.

export const K = {
  BAND_CORE: 0.35,        // inside +-BAND_CORE * band of the marked amount the fill scores 100%
  BAND_FAR: 2.2,          // at +-BAND_FAR * band the fill scores 0%
  KNOCK_BEATS: 3,
  KNOCK_LEAD: 1.0,        // seconds from the start of the knock to the first beat
  KNOCK_TOL: 0.32,        // a tap within this many seconds of a beat counts
  KNOCK_CLEAN: 0.09,      // a tap this close is a perfect beat (touch latency is about 50-80 ms)
  W_FILL: 0.35, W_SEAL: 0.3, W_KNOCK: 0.35,
  PERFECT: 0.85,          // cookie quality that counts as perfect
  // the oven: b = time in oven / bake time of the shift
  B_RAW: 0.5, WIN0: 0.78, WIN_MID: 0.89, WIN1: 1.0, B_BROWN: 1.15, B_BURN: 1.4, B_AUTO: 1.5,
  RUSH_SECONDS: 90, STAR2: 0.75, STAR3: 0.88, TIME_FOR_3: 0.9,
  SEAL_ASSIST: 0.78,      // quality of an assisted (tapped) seal
  RUSH_STARS: [350, 900, 1500],
};

export const TYPES = {
  date: { id: 'date', name: 'Date', filling: 'date paste', mould: 'oval mould', shape: 'oval' },
  walnut: { id: 'walnut', name: 'Walnut', filling: 'ground walnut', mould: 'domed mould', shape: 'dome' },
  pistachio: { id: 'pistachio', name: 'Pistachio', filling: 'ground pistachio', mould: 'round mould', shape: 'round' },
};
export const TYPE_IDS = ['date', 'walnut', 'pistachio'];

export const BAKERIES = [
  { name: 'Home Kitchen', blurb: 'One small tray at a time and a forgiving oven.' },
  { name: 'Neighbourhood Bakery', blurb: 'Bigger trays, more fillings, a busier oven.' },
  { name: 'Market Bakery', blurb: 'Three fillings, several trays and a quick oven.' },
];
export const SHIFTS_PER_BAKERY = 6;
export const TOTAL_SHIFTS = 18;

// ---- small seeded generator ----------------------------------------------------------------------------------------------------------
function rnd(sim) {
  let a = (sim.rs = (sim.rs + 0x6d2b79f5) | 0);
  a = Math.imul(a ^ (a >>> 15), a | 1);
  a ^= a + Math.imul(a ^ (a >>> 7), a | 61);
  return ((a ^ (a >>> 14)) >>> 0) / 4294967296;
}

// ---- shift specs ---------------------------------------------------------------------------------------------------------------------
const TRAYS = [1, 1, 2, 2, 2, 3, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 4, 4];
const NTYPES = [1, 1, 2, 2, 2, 3, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3];
export function makeSpec(kind, g, seed = 1) {
  let i = clamp(g | 0, 0, TOTAL_SHIFTS - 1), name, endless = false;
  if (kind === 'rush') { i = 11; name = 'Rush Hour'; endless = true; }
  else if (kind === 'daily') { i = 7 + ((seed >>> 0) % 7); name = 'Daily Shift'; }
  else if (kind === 'demo') { i = 2; name = 'Watch and Learn'; }
  else name = `${BAKERIES[Math.floor(i / SHIFTS_PER_BAKERY)].name}, shift ${(i % SHIFTS_PER_BAKERY) + 1}`;
  const d = i / (TOTAL_SHIFTS - 1);
  const small = i < 6 || kind === 'rush';
  let cols = small ? 3 : 4, rows = 2, trays = TRAYS[i], nTypes = NTYPES[i];
  if (kind === 'demo') { cols = 2; trays = 1; nTypes = 2; }
  if (kind === 'rush') { nTypes = 3; trays = 99; }
  const spec = {
    kind, g: i, seed, name, endless, cols, rows, trays, nTypes,
    types: TYPE_IDS.slice(0, nTypes),
    period: kind === 'demo' ? 2.4 : kind === 'rush' ? 1.55 : 2.3 - d * 1.05,      // seconds for the scoop to swing there and back
    band: kind === 'demo' ? 0.16 : kind === 'rush' ? 0.11 : 0.155 - d * 0.075,
    tempo: kind === 'demo' ? 0.8 : kind === 'rush' ? 0.62 : 0.78 - d * 0.22,       // seconds between knock beats
    bake: kind === 'demo' ? 13 : kind === 'rush' ? 8 : 12.5 - d * 5,
    layout: i < 6 && kind !== 'rush' ? 'rows' : 'mixed',
  };
  const cookies = cols * rows * (endless ? 0 : trays);
  spec.cookies = cookies;
  spec.limit = endless ? K.RUSH_SECONDS : Math.round(cookies * (8.6 - 2.4 * d) + trays * spec.bake * 0.45 + 22);
  return spec;
}

function trayLayout(sim, spec, n) {
  const cells = spec.cols * spec.rows, seq = [];
  const per = Math.ceil(cells / spec.types.length);
  for (let k = 0; k < cells; k++) seq.push(spec.types[Math.min(spec.types.length - 1, Math.floor(k / per))]);
  if (spec.layout === 'mixed' || spec.kind === 'rush') {
    for (let k = 0; k < cells; k++) seq[k] = spec.types[k % spec.types.length];
    for (let k = cells - 1; k > 0; k--) { const j = Math.floor(rnd(sim) * (k + 1)); [seq[k], seq[j]] = [seq[j], seq[k]]; }
  }
  void n;
  return seq;
}
function newTray(sim, n) {
  const spec = sim.spec, types = trayLayout(sim, spec, n);
  return { id: n, cols: spec.cols, rows: spec.rows, st: 'make', slots: types.map((t) => ({ type: t, st: 'empty', q: 0, perf: false, pts: 0 })), bakeB: 0, bakeMul: 0, pts: 0, bakeName: '' };
}

export function makeSim(spec) {
  const sim = {
    spec, rs: (spec.seed * 2654435761 + spec.g * 40503 + 17) | 0, t: 0, done: false, outcome: null,
    score: 0, bonus: 0, made: 0, perfect: 0, streak: 0, bestStreak: 0, rushLeft: spec.endless ? K.RUSH_SECONDS : 0,
    trays: [], hand: null, oven: { tray: -1, t: 0 }, ev: [], n: 0, traysDone: 0, ovenPulls: 0, bad: 0,
  };
  const count = spec.endless ? 2 : spec.trays;
  for (let k = 0; k < count; k++) sim.trays.push(newTray(sim, k));
  return sim;
}

// ---- helpers -------------------------------------------------------------------------------------------------------------------------
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
const tri = (ph) => { const x = ph - Math.floor(ph); return x < 0.5 ? x * 2 : 2 - x * 2; };   // 0..1..0
export const needlePos = (hand) => tri(hand.ph);
export const fillScore = (spec, pos, target) => {
  const d = Math.abs(pos - target), core = spec.band * K.BAND_CORE, far = spec.band * K.BAND_FAR;
  return d <= core ? 1 : clamp(1 - (d - core) / (far - core), 0, 1);
};
export const beatScore = (d) => { d = Math.abs(d); return d <= K.KNOCK_CLEAN ? 1 : clamp(1 - (d - K.KNOCK_CLEAN) / (K.KNOCK_TOL - K.KNOCK_CLEAN), 0, 1); };
export const sealSegScore = (err) => 1 - clamp(err - 0.2, 0, 0.8) / 0.8;
export const makingTray = (sim) => { for (let i = 0; i < sim.trays.length; i++) if (sim.trays[i].st === 'make') return i; return -1; };
export const readyTray = (sim) => { for (let i = 0; i < sim.trays.length; i++) if (sim.trays[i].st === 'ready') return i; return -1; };
export const bakeLevel = (sim) => (sim.oven.tray >= 0 ? sim.oven.t / sim.spec.bake : 0);
export function bakeMul(b) {
  if (b < K.B_RAW) return 0.3;
  if (b < K.WIN0) return 0.3 + ((b - K.B_RAW) / (K.WIN0 - K.B_RAW)) * 0.55;
  if (b <= K.WIN1) return 1 - 0.1 * (Math.abs(b - K.WIN_MID) / (K.WIN1 - K.WIN_MID));
  if (b <= K.B_BROWN) return 0.9 - ((b - K.WIN1) / (K.B_BROWN - K.WIN1)) * 0.25;
  if (b <= K.B_BURN) return 0.65 - ((b - K.B_BROWN) / (K.B_BURN - K.B_BROWN)) * 0.35;
  return 0.15;
}
export function bakeName(b) {
  if (b < K.B_RAW) return 'Underbaked';
  if (b < K.WIN0) return 'Nearly there';
  if (b <= K.WIN1) return 'Pale gold';
  if (b <= K.B_BROWN) return 'Golden';
  if (b <= K.B_BURN) return 'Browned';
  return 'Burnt';
}
export const grade = (q) => (q >= 0.95 ? 'Flawless' : q >= K.PERFECT ? 'Perfect' : q >= 0.7 ? 'Good' : q >= 0.45 ? 'Fair' : 'Rough');
export const emptyCount = (tray, type) => tray.slots.reduce((n, s) => n + (s.st === 'empty' && (!type || s.type === type) ? 1 : 0), 0);
const emit = (sim, e) => { sim.ev.push(e); };

// ---- hand steps ----------------------------------------------------------------------------------------------------------------------
export function canChoose(sim, type) {
  if (sim.done || (sim.hand && sim.hand.st !== 'fill')) return false;
  if (sim.hand && sim.hand.auto) return false;
  const ti = makingTray(sim);
  return ti >= 0 && emptyCount(sim.trays[ti], type) > 0;
}
export function choose(sim, type) {
  if (!canChoose(sim, type)) return false;
  if (sim.hand && sim.hand.type === type) return true;
  const target = 0.38 + rnd(sim) * 0.46;
  sim.hand = { type, st: 'fill', ph: sim.hand ? sim.hand.ph : 0.1, target, fillQ: 0, sealQ: 0, knockQ: 0, q: 0, seal: { prog: 0, sum: 0 }, knock: null, auto: null };
  emit(sim, { type: 'choose', t: type });
  return true;
}
export function dropFill(sim) {
  const h = sim.hand;
  if (!h || h.st !== 'fill' || sim.done) return -1;
  const pos = needlePos(h), q = fillScore(sim.spec, pos, h.target);
  h.fillQ = q; h.fillPos = pos; h.st = 'seal'; h.auto = null;
  emit(sim, { type: 'fill', q, pos, target: h.target });
  return q;
}
export function sealMove(sim, dAng, err) {
  const h = sim.hand;
  if (!h || h.st !== 'seal' || sim.done) return;
  const frac = Math.min(Math.abs(dAng), 0.9) / (Math.PI * 2);
  h.seal.prog += frac; h.seal.sum += sealSegScore(err) * frac;
  if (h.seal.prog >= 1) finishSeal(sim, h.seal.sum / h.seal.prog);
}
export function sealTap(sim) {
  const h = sim.hand;
  if (!h || h.st !== 'seal' || sim.done) return;
  finishSeal(sim, K.SEAL_ASSIST);
}
function finishSeal(sim, q) {
  const h = sim.hand;
  h.sealQ = clamp(q, 0, 1); h.st = 'knock'; h.auto = h.auto && h.auto.kind === 'knock' ? h.auto : null;
  const tempo = sim.spec.tempo;
  h.knock = { tk: 0, beats: Array.from({ length: K.KNOCK_BEATS }, (_, i) => ({ at: K.KNOCK_LEAD + i * tempo, q: -1 })) };
  emit(sim, { type: 'seal', q: h.sealQ });
}
export function knockTap(sim) {
  const h = sim.hand;
  if (!h || h.st !== 'knock' || sim.done) return -1;
  const k = h.knock;
  let best = -1, bd = 9;
  for (let i = 0; i < k.beats.length; i++) {
    const b = k.beats[i];
    if (b.q >= 0) continue;
    const d = Math.abs(k.tk - b.at);
    if (d <= K.KNOCK_TOL && d < bd) { bd = d; best = i; }
  }
  if (best < 0) { emit(sim, { type: 'stray' }); return -1; }
  const q = beatScore(k.tk - k.beats[best].at);
  k.beats[best].q = q; k.beats[best].hitAt = k.tk;
  emit(sim, { type: 'knock', q, i: best });
  if (k.beats.every((b) => b.q >= 0)) finishKnock(sim);
  return q;
}
function finishKnock(sim) {
  const h = sim.hand, k = h.knock;
  h.knockQ = k.beats.reduce((a, b) => a + b.q, 0) / k.beats.length;
  h.q = clamp(K.W_FILL * h.fillQ + K.W_SEAL * h.sealQ + K.W_KNOCK * h.knockQ, 0, 1);
  h.st = 'place'; h.auto = null;
  emit(sim, { type: 'released', q: h.q });
}
export function placeableSlots(sim) {
  const h = sim.hand, ti = makingTray(sim);
  if (!h || h.st !== 'place' || ti < 0) return [];
  const out = [];
  sim.trays[ti].slots.forEach((s, i) => { if (s.st === 'empty' && s.type === h.type) out.push(i); });
  return out;
}
export function place(sim, slot) {
  const h = sim.hand, ti = makingTray(sim);
  if (!h || h.st !== 'place' || ti < 0 || sim.done) return false;
  const tr = sim.trays[ti], s = tr.slots[slot];
  if (!s || s.st !== 'empty' || s.type !== h.type) { emit(sim, { type: 'wrong', slot }); return false; }
  s.st = 'raw'; s.q = h.q; s.perf = h.q >= K.PERFECT; s.fillQ = h.fillQ; s.sealQ = h.sealQ; s.knockQ = h.knockQ;
  sim.made += 1;
  let bonus = 0;
  if (s.perf) { sim.perfect += 1; sim.streak += 1; sim.bestStreak = Math.max(sim.bestStreak, sim.streak); bonus = 10 + 5 * Math.min(5, sim.streak - 1); }
  else sim.streak = 0;
  sim.bonus += bonus; sim.score += bonus;
  emit(sim, { type: 'place', tray: ti, slot, q: h.q, perfect: s.perf, bonus, streak: sim.streak });
  sim.hand = null;
  if (tr.slots.every((x) => x.st !== 'empty')) { tr.st = 'ready'; emit(sim, { type: 'trayfull', tray: ti }); }
  return true;
}
export function loadOven(sim) {
  const ri = readyTray(sim);
  if (sim.done || sim.oven.tray >= 0 || ri < 0) return false;
  sim.oven.tray = ri; sim.oven.t = 0; sim.trays[ri].st = 'oven';
  emit(sim, { type: 'load', tray: ri });
  return true;
}
export function pull(sim, auto = false) {
  const ti = sim.oven.tray;
  if (ti < 0 || sim.done) return false;
  const b = bakeLevel(sim), m = bakeMul(b), tr = sim.trays[ti];
  tr.st = 'done'; tr.bakeB = b; tr.bakeMul = m; tr.bakeName = bakeName(b); tr.pts = 0;
  for (const s of tr.slots) { s.st = b > K.B_BROWN ? 'over' : 'baked'; s.pts = Math.round(100 * s.q * m); tr.pts += s.pts; }
  sim.score += tr.pts; sim.traysDone += 1; sim.ovenPulls += 1;
  if (m < 0.6) sim.bad += 1;
  sim.oven.tray = -1; sim.oven.t = 0;
  emit(sim, { type: 'pull', tray: ti, b, mul: m, pts: tr.pts, name: tr.bakeName, auto });
  if (sim.spec.endless) sim.trays.push(newTray(sim, sim.trays.length));
  else if (sim.trays.every((x) => x.st === 'done')) finish(sim, 'cleared');
  return true;
}

// ---- finishing and stars -------------------------------------------------------------------------------------------------------------
function cookieQualitySum(sim) {
  let sum = 0, n = 0;
  for (const tr of sim.trays) for (const s of tr.slots) { n += 1; if (s.st === 'baked' || s.st === 'over') sum += s.q * tr.bakeMul; }
  return { sum, n };
}
export function averageQuality(sim) {
  const { sum, n } = cookieQualitySum(sim);
  return n ? sum / n : 0;
}
function finish(sim, why) {
  if (sim.done) return;
  sim.done = true;
  const spec = sim.spec;
  let stars = 0, quality = averageQuality(sim);
  if (spec.endless) {
    let n = 0, sum = 0;
    for (const tr of sim.trays) if (tr.st === 'done') for (const s of tr.slots) { n += 1; sum += s.q * tr.bakeMul; }
    quality = n ? sum / n : 0;
    stars = sim.score >= K.RUSH_STARS[2] ? 3 : sim.score >= K.RUSH_STARS[1] ? 2 : sim.score >= K.RUSH_STARS[0] ? 1 : 0;
  } else if (why === 'cleared') {
    const timeBonus = Math.round(Math.max(0, spec.limit - sim.t) * 2);
    sim.score += timeBonus; sim.timeBonus = timeBonus;
    stars = 1;
    if (quality >= K.STAR2) stars = 2;
    if (quality >= K.STAR3 && sim.t <= spec.limit * K.TIME_FOR_3) stars = 3;
  }
  sim.outcome = { why, stars, quality, timeLeft: Math.max(0, spec.limit - sim.t) };
  emit(sim, { type: 'end', why });
}

// ---- time ----------------------------------------------------------------------------------------------------------------------------
export function step(sim, dt) {
  if (sim.done) return;
  const spec = sim.spec;
  sim.t += dt;
  const h = sim.hand;
  if (h) {
    if (h.st === 'fill') {
      if (h.auto) {
        h.auto.t += dt;
        const k = clamp(h.auto.t / h.auto.dur, 0, 1), pos = h.auto.from + (h.auto.to - h.auto.from) * k;
        h.ph = pos / 2;                                                       // phase whose triangle value is pos (rising half)
        if (k >= 1) dropFill(sim);
      } else h.ph += dt / spec.period;
    } else if (h.st === 'seal' && h.auto) {
      h.auto.t += dt;
      const k = clamp(h.auto.t / h.auto.dur, 0, 1);
      h.seal.prog = k; h.seal.sum = k * h.auto.q;
      if (k >= 1) finishSeal(sim, h.auto.q);
    } else if (h.st === 'knock') {
      const k = h.knock;
      k.tk += dt;
      if (h.auto) {
        for (const b of k.beats) if (b.q < 0 && k.tk >= b.at + h.auto.off) { knockTap(sim); break; }
      }
      if (sim.hand === h && h.st === 'knock') {
        for (const b of k.beats) if (b.q < 0 && k.tk > b.at + K.KNOCK_TOL) { b.q = 0; emit(sim, { type: 'knockmiss' }); }
        if (k.beats.every((b) => b.q >= 0)) finishKnock(sim);
      }
    }
  }
  if (sim.oven.tray >= 0) {
    const before = bakeLevel(sim);
    sim.oven.t += dt;
    const b = bakeLevel(sim);
    if (before < K.WIN0 && b >= K.WIN0) emit(sim, { type: 'window' });
    if (before < K.WIN1 && b >= K.WIN1) emit(sim, { type: 'late' });
    if (b >= K.B_AUTO) pull(sim, true);
  }
  if (sim.done) return;
  if (spec.endless) { sim.rushLeft = Math.max(0, K.RUSH_SECONDS - sim.t); if (sim.rushLeft <= 0) finish(sim, 'time'); }
  else if (sim.t >= spec.limit) finish(sim, 'closed');
}

// ---- planner: what to do next (used by Think and by Watch and Learn) ------------------------------------------------------------------
// Returns { kind, text, why, type?, slot? }. kind: 'pull' | 'oven' | 'choose' | 'fill' | 'seal' | 'knock' | 'place' | 'wait'.
export function plan(sim) {
  const wait = { kind: 'wait' };
  if (sim.done) return wait;
  const b = bakeLevel(sim);
  if (sim.oven.tray >= 0 && b >= 0.84) return { kind: 'pull', text: 'Pull the tray out now.', why: 'The bake is in the pale-gold zone. Pull before it turns golden-brown: maamoul stays pale.' };
  const h = sim.hand;
  if (h) {
    if (h.auto) return wait;
    if (h.st === 'fill') return { kind: 'fill', text: 'Drop the filling at the marked amount.', why: 'The band on the scale is the right amount: too little leaves a hollow, too much splits the seam.' };
    if (h.st === 'seal') return { kind: 'seal', text: 'Pinch the dough closed round the rim.', why: 'A slow, even circle just on the rim gives a tight seal.' };
    if (h.st === 'knock') return { kind: 'knock', text: 'Knock the mould on all three beats.', why: 'Tap as each ring closes on the line. Three clean knocks give a sharp print.' };
    if (h.st === 'place') {
      const slots = placeableSlots(sim);
      return slots.length ? { kind: 'place', slot: slots[0], text: 'Set the cookie on a matching slot.', why: `Each ghost slot shows its type. This is a ${TYPES[h.type].name.toLowerCase()} cookie.` } : wait;
    }
    return wait;
  }
  if (sim.oven.tray < 0 && readyTray(sim) >= 0) return { kind: 'oven', text: 'Slide the full tray into the oven.', why: 'The oven is free. Load it early so the bake runs while you work on the next tray.' };
  const ti = makingTray(sim);
  if (ti >= 0) {
    const tr = sim.trays[ti], next = tr.slots.find((s) => s.st === 'empty');
    if (next) return { kind: 'choose', type: next.type, text: `Pick the ${TYPES[next.type].mould}.`, why: `The next empty slot on the tray wants a ${TYPES[next.type].name.toLowerCase()} cookie (${TYPES[next.type].filling}).` };
  }
  return wait;
}

// Do the planned step the way a good player would: a clean gesture with a small deterministic wobble.
export function applyPlan(sim, a) {
  const wob = () => rnd(sim);
  switch (a.kind) {
    case 'pull': return pull(sim);
    case 'oven': return loadOven(sim);
    case 'choose': return choose(sim, a.type);
    case 'fill': {
      const h = sim.hand;
      h.auto = { kind: 'fill', t: 0, dur: 0.5, from: needlePos(h), to: clamp(h.target + (wob() - 0.5) * sim.spec.band * 0.5, 0, 1) };
      return true;
    }
    case 'seal': sim.hand.auto = { kind: 'seal', t: 0, dur: 1.1, q: 0.9 + wob() * 0.08 }; return true;
    case 'knock': sim.hand.auto = { kind: 'knock', off: (wob() - 0.5) * 0.08 }; return true;
    case 'place': return place(sim, a.slot);
    default: return false;
  }
}
