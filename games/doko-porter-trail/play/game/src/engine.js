// Doko Porter Trail engine: pure and deterministic. No DOM, no clock, no Math.random.
//   trail    : generated from a spec (chapter, index, seed)  -> segments, gusts, par time
//   run      : the porter's state on one trail (position, load angle, breath, goods)
//   stepRun  : advance a run by dt with the player's control { hold, lean, pace }
//   bot      : the game's own player (Auto Play / Watch and Learn / tests)
//   coachFor : what to tell the player about what is ahead (hints and Watch and Learn)
// Units: metres, seconds, radians. Every number the Rules page prints is read from K below.

export const K = {
  WALK_V: 1.55,          // m/s on the flat at pace 1.0
  PACE_MIN: 0.6, PACE_MAX: 1.4,
  SPILL_ANGLE: 0.5,      // rad: past this the basket slips and one item falls
  SPILL_COOLDOWN: 1.2,   // s between slips
  RESEAT: 0.25,          // fraction of the angle left after the porter re-seats the load
  LEAN_LAG: 0.12,        // s: torso follows the thumb with this lag
  PACE_LAG: 0.25,
  G0: 2.0, G_PER_KG: 0.03, // load instability: G = G0 + G_PER_KG * (kg - 25)
  DAMP: 1.5,             // 1/s
  CTRL: 2.2,             // rad/s^2 of correction at full lean
  SLOPE_BIAS: 2.2,       // a climb pulls the load by this * slope rad/s^2 (a descent pushes it the other way)
  STEP_LEN: 0.55,        // m between stone steps
  STRIDE: 0.78,          // m per full gait cycle
  BREATH_DRAIN: 0.008,   // per s on the flat at weight 30 kg and pace 1
  BREATH_PER_SLOPE: 3.2, // extra drain multiplier per rad of climb
  BREATH_REST: 0.09,     // per s resting on the flat
  REST_SLOPE: 0.5, REST_CHAUTARA: 2.5, REST_BRIDGE: 0.4,
  LOW_BREATH: 0.25,
  HALT_TIME: 2.0,
  HALT_RECOVER: 0.2,     // breath regained before he walks again after a forced halt
  REPACK_TIME: 1.5,      // s resting on a rest platform to repack one lost item
  BRIDGE_AMP: 0.8,  BRIDGE_RES: 1.5, BRIDGE_WIDTH: 0.16,
  MAX_ASSIST_G: 0.62,
  DAY_PAR: 1.5,          // day length = this * ideal walking time + rests
};
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lcg = (seed) => { let s = seed >>> 0 || 1; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; };
const sstep = (t) => t * t * (3 - 2 * t);

// ---- trails -----------------------------------------------------------------------------------------------------------
export const CHAPTERS = [
  { name: 'The Valley Road', blurb: 'Gentle slopes, and the porter learns the load.' },
  { name: 'Hill Terraces', blurb: 'Stone steps and the swaying bridges.' },
  { name: 'The High Trail', blurb: 'Wind, rain and long days.' },
];
export const TRAILS = [
  { name: 'First Load', story: 'Rice for the village shop, down the valley road.', kg: 26, items: 5, len: 70, d: 0.05, theme: 0 },
  { name: 'Market Morning', story: 'Vegetables from the terraces for the market day.', kg: 28, items: 5, len: 84, d: 0.12, theme: 0 },
  { name: 'Orange Season', story: 'Baskets of oranges from the orchard to the road.', kg: 30, items: 6, len: 98, d: 0.2, theme: 0 },
  { name: 'Down to the River', story: 'Goods for the river village, mostly downhill.', kg: 32, items: 6, len: 112, d: 0.28, theme: 0 },
  { name: 'Steps to the School', story: 'Slates and books for the new classroom.', kg: 34, items: 6, len: 126, d: 0.38, theme: 1 },
  { name: 'The Long Bridge', story: 'Salt and tea over the river, the way it has always come.', kg: 36, items: 6, len: 140, d: 0.46, theme: 1 },
  { name: 'Millet Harvest', story: 'Sacks of millet from the high fields.', kg: 38, items: 7, len: 154, d: 0.54, theme: 1 },
  { name: 'Roof Slates', story: 'Slates for a new roof, carried a few at a time.', kg: 40, items: 7, len: 168, d: 0.62, theme: 1 },
  { name: 'Before the Rain', story: 'Beat the weather with the winter stores.', kg: 40, items: 7, len: 182, d: 0.7, theme: 2, rain: true },
  { name: 'Winter Stores', story: 'Blankets and lamp oil for the high village.', kg: 42, items: 7, len: 196, d: 0.78, theme: 2 },
  { name: 'Wind on the Ridge', story: 'The pass is open: gusts all the way along the ridge.', kg: 44, items: 8, len: 210, d: 0.86, theme: 2, rain: true },
  { name: 'The Last Village', story: 'The longest day: everything the village needs.', kg: 46, items: 8, len: 224, d: 0.94, theme: 2 },
];
export const TRAILS_PER_CHAPTER = 4;
export const trailSpec = (i) => ({ ...TRAILS[i], index: i, chapter: Math.floor(i / TRAILS_PER_CHAPTER), seed: 7001 + i * 131 });

const SEG_COLOR = { flat: 0, climb: 1, down: 2, steps: 3, bridge: 4, rest: 5 };
export const SEG_TYPES = Object.keys(SEG_COLOR);

function pushSeg(trail, rnd, t, len, d) {
  const last = trail.segs[trail.segs.length - 1];
  const x0 = last ? last.x1 : 0, y0 = last ? last.y1 : 0;
  const seg = { t, x0, x1: x0 + len, y0, y1: y0, slope: 0 };
  if (t === 'climb') seg.slope = 0.1 + 0.15 * d * (0.5 + rnd());
  else if (t === 'down') seg.slope = -(0.08 + 0.12 * d * (0.5 + rnd()));
  else if (t === 'steps') { seg.slope = 0.32; const n = Math.max(3, Math.round(len / K.STEP_LEN)); seg.x1 = x0 + n * K.STEP_LEN; seg.jolts = []; let sg = rnd() < 0.5 ? 1 : -1; for (let i = 0; i < n; i++) { seg.jolts.push(sg * (0.3 + 0.35 * rnd() + 0.2 * d)); if (rnd() < 0.7) sg = -sg; } }
  else if (t === 'bridge') { seg.amp = K.BRIDGE_AMP * (0.7 + 0.6 * d); seg.freq = 3.0 + rnd() * 0.5; seg.pRes = rnd() < 0.5 ? 0.78 : 1.22; }
  seg.y1 = y0 + Math.tan(seg.slope) * (seg.x1 - x0);
  trail.segs.push(seg);
  return seg;
}

// Composes the next segments until the trail is at least `until` metres long. Used for fixed trails and the endless Long Road.
function compose(trail, rnd, until, d, state) {
  while (trail.len < until) {
    const last = trail.segs[trail.segs.length - 1]?.t;
    const sinceRest = trail.len - state.lastRest;
    let t;
    if (sinceRest > 36 + 10 * rnd()) t = last === 'bridge' || last === 'steps' ? 'flat' : 'rest';
    else {
      const w = { flat: 2.2, climb: 1.6 + d, down: 1.2 + 0.4 * d, steps: d > 0.3 ? 1.1 + d * 1.5 : 0, bridge: d > 0.4 ? 0.8 + d : 0 };
      if (last && w[last] !== undefined) w[last] *= last === 'flat' ? 0.5 : 0.25;
      let sum = 0; for (const k of Object.keys(w)) sum += w[k];
      let r = rnd() * sum; t = 'flat';
      for (const k of Object.keys(w)) { r -= w[k]; if (r <= 0) { t = k; break; } }
    }
    const len = t === 'rest' ? 6 : t === 'flat' ? (sinceRest > 36 ? 3.5 : 7 + rnd() * 6) : t === 'climb' ? 9 + rnd() * 10 : t === 'down' ? 8 + rnd() * 8 : t === 'steps' ? 4 + rnd() * 4 : 11 + rnd() * (6 + 10 * d);
    const seg = pushSeg(trail, rnd, t, len, d);
    trail.len = seg.x1;
    if (t === 'rest') state.lastRest = seg.x1;
  }
}
function addGusts(trail, rnd, from, to, d) {
  const per = d < 0.35 ? 0 : 1 / (34 - 18 * d);   // gusts per metre
  let x = from + 8;
  while (per > 0 && x < to - 6) {
    x += (1 / per) * (0.6 + 0.8 * rnd());
    const s = trail.segs.find((g) => x >= g.x0 && x < g.x1);
    if (!s || s.t === 'bridge' || s.t === 'rest' || x >= to - 6) continue;
    trail.gusts.push({ x, dir: rnd() < 0.5 ? 1 : -1, mag: 0.7 + 0.5 * rnd() + 0.3 * d, dur: 0.9 });
  }
}
function finishPar(trail) {
  let tm = 0, rests = 0;
  for (const s of trail.segs) {
    const L = s.x1 - s.x0;
    if (s.t === 'rest') { rests += 1; tm += L / K.WALK_V; continue; }
    const f = s.t === 'steps' ? 0.62 * Math.max(0.35, 1 - 1.3 * s.slope) : Math.max(0.35, 1 - 1.3 * Math.max(0, s.slope)) * (1 + 0.35 * Math.max(0, -s.slope));
    tm += L / (K.WALK_V * f);
  }
  trail.par = Math.round(tm * 10) / 10;
  trail.dayLen = Math.round((tm * K.DAY_PAR + rests * 3 + 14) * 10) / 10;
}

export function genTrail(spec) {
  const rnd = lcg(spec.seed ?? 1);
  const d = clamp(spec.d ?? 0.2, 0, 1);
  const trail = { name: spec.name, story: spec.story ?? '', kg: spec.kg ?? 30, items: spec.items ?? 5, d, rain: !!spec.rain, theme: spec.theme ?? 0, endless: !!spec.endless, segs: [], gusts: [], len: 0, goal: 0, seed: spec.seed ?? 1, restState: { lastRest: 0 } };
  let seg = pushSeg(trail, rnd, 'flat', 9, d); trail.len = seg.x1;
  const target = spec.endless ? 160 : spec.len;
  compose(trail, rnd, target - 9, d, trail.restState);
  // arrival: a flat approach and the village
  seg = pushSeg(trail, rnd, 'flat', 6, d); trail.len = seg.x1;
  if (!spec.endless) trail.goal = trail.len;
  addGusts(trail, rnd, 9, trail.len, d);
  finishPar(trail);
  return trail;
}
// Long Road: keeps composing ahead of the porter. Deterministic from the trail's own seed and the position it was asked for.
export function extendTrail(trail, x) {
  if (!trail.endless || trail.len > x + 90) return;
  const rnd = lcg((trail.seed * 31 + Math.round(trail.len * 10)) >>> 0);
  const d = clamp(0.25 + trail.len / 900, 0.2, 1);
  const from = trail.len;
  compose(trail, rnd, from + 90, d, trail.restState);
  addGusts(trail, rnd, from, trail.len, d);
  trail.d = d;
}

export function segAt(trail, x) {
  const s = trail.segs;
  if (x <= 0) return s[0];
  let lo = 0, hi = s.length - 1;
  while (lo < hi) { const m = (lo + hi + 1) >> 1; if (s[m].x0 <= x) lo = m; else hi = m - 1; }
  return s[lo];
}
const yRaw = (trail, x) => { const s = segAt(trail, x); if (x < 0) return 0; return s.y0 + Math.tan(s.slope) * (Math.min(x, s.x1) - s.x0); };
// Ground height (m) at x, softened over +-0.7 m so corners do not look cut with scissors.
export function groundY(trail, x) { return (yRaw(trail, x - 0.7) + 2 * yRaw(trail, x - 0.35) + 3 * yRaw(trail, x) + 2 * yRaw(trail, x + 0.35) + yRaw(trail, x + 0.7)) / 9; }
export function slopeAt(trail, x) { return Math.atan2(groundY(trail, x + 0.25) - groundY(trail, x - 0.25), 0.5); }
export const loadG = (kg, assist = 0) => (K.G0 + K.G_PER_KG * (kg - 25)) * (assist ? K.MAX_ASSIST_G : 1);

// ---- runs ---------------------------------------------------------------------------------------------------------------
export function newRun(trail, opts = {}) {
  return {
    x: 0, v: 0, pace: 1, leanS: 0, a: 0, w: 0, breath: 1, items: trail.items, items0: trail.items, t: 0,
    mode: 'rest', walkPhase: 0, cooldown: 0, spills: 0, halts: 0, halt: 0, haltNeed: 0, restT: 0, restTotal: 0,
    nz: 0, rng: (trail.seed * 977 + 13) >>> 0, step: -1, stepSeg: -1, gustIdx: 0, gust: null, bridgeT: 0, bridgeSway: 0,
    repacked: {}, repackT: 0, visited: [], distance: 0, assist: opts.assist ? 1 : 0, ended: null, late: false,
    stumble: 0, events: [], maxAngle: 0, lastSeg: 0,
  };
}
const gauss = (R) => { R.rng = (Math.imul(R.rng, 1664525) + 1013904223) >>> 0; const a = R.rng / 4294967296; R.rng = (Math.imul(R.rng, 1664525) + 1013904223) >>> 0; const b = R.rng / 4294967296; R.rng = (Math.imul(R.rng, 1664525) + 1013904223) >>> 0; const c = R.rng / 4294967296; return a + b + c - 1.5; };
export const dayFraction = (R, trail) => R.t / trail.dayLen;

export function stepRun(R, trail, ctrl, dt) {
  if (R.ended) return;
  extendTrail(trail, R.x);
  R.t += dt;
  const seg = segAt(trail, R.x), slope = slopeAt(trail, R.x);
  const onRest = seg.t === 'rest', onBridge = seg.t === 'bridge';
  // ---- forced halt (out of breath) ------------------------------------------------------------------------------------
  if (R.halt > 0) { R.halt -= dt; if (R.halt <= 0 && R.breath < K.HALT_RECOVER) R.halt = 0.2; }
  const hold = !!ctrl.hold && R.halt <= 0;
  R.pace += (clamp(ctrl.pace ?? 1, K.PACE_MIN, K.PACE_MAX) - R.pace) * Math.min(1, dt / K.PACE_LAG);
  R.leanS += (clamp(ctrl.lean ?? 0, -1, 1) - R.leanS) * Math.min(1, dt / K.LEAN_LAG);
  // ---- speed ------------------------------------------------------------------------------------------------------------
  const sf = seg.t === 'steps' ? 0.62 * Math.max(0.35, 1 - 1.3 * seg.slope) : Math.max(0.35, 1 - 1.3 * Math.max(0, slope)) * (1 + 0.35 * Math.max(0, -slope));
  const vT = hold ? K.WALK_V * R.pace * sf * (R.breath < K.LOW_BREATH ? 0.85 : 1) : 0;
  R.v += (vT - R.v) * Math.min(1, dt / (vT > R.v ? 0.35 : 0.18));
  if (R.v < 0.01 && vT === 0) R.v = 0;
  const moving = R.v > 0.05;
  // ---- breath -------------------------------------------------------------------------------------------------------------
  if (moving) {
    const drain = K.BREATH_DRAIN * (trail.kg / 30) * (1 + K.BREATH_PER_SLOPE * Math.max(0, slope)) * Math.pow(R.pace, 1.5) * (seg.t === 'steps' ? 1.2 : 1);
    R.breath = Math.max(0, R.breath - drain * dt);
    R.restT = 0;
  } else {
    const m = R.halt > 0 ? 0.6 : onRest ? K.REST_CHAUTARA : onBridge ? K.REST_BRIDGE : seg.t === 'steps' || Math.abs(slope) > 0.06 ? K.REST_SLOPE : 1;
    R.breath = Math.min(1, R.breath + K.BREATH_REST * m * dt);
    R.restT += dt; R.restTotal += dt;
  }
  if (R.breath <= 0 && R.halt <= 0) { R.halt = K.HALT_TIME; R.halts += 1; R.stumble = 0.6; R.w += (gauss(R) > 0 ? 1 : -1) * 0.8; R.events.push({ type: 'halt' }); }
  // ---- position, steps, gusts --------------------------------------------------------------------------------------------
  const x0 = R.x;
  R.x += R.v * dt; R.distance = Math.max(R.distance, R.x);
  if (moving) R.walkPhase += (R.v / K.STRIDE) * dt;
  const jolt = (R.assist ? 0.75 : 1);
  if (seg.t === 'steps') {
    const k = Math.floor((R.x - seg.x0) / K.STEP_LEN);
    if (R.stepSeg !== seg.x0) { R.stepSeg = seg.x0; R.step = k; }
    while (R.step < k && R.step + 1 < seg.jolts.length) { R.step += 1; R.w += seg.jolts[R.step] * (0.5 + 0.5 * R.pace) * jolt; R.events.push({ type: 'step', k: R.step }); }
  }
  let dist = 0;
  while (R.gustIdx < trail.gusts.length && trail.gusts[R.gustIdx].x < x0) R.gustIdx += 1;
  const g = trail.gusts[R.gustIdx];
  if (g && R.x >= g.x && x0 < g.x) { R.gust = { t: 0, dir: g.dir, mag: g.mag, dur: g.dur }; R.gustIdx += 1; R.events.push({ type: 'gust', dir: g.dir }); }
  if (R.gust) { R.gust.t += dt; if (R.gust.t >= R.gust.dur) R.gust = null; else dist += R.gust.dir * R.gust.mag * Math.sin((Math.PI * R.gust.t) / R.gust.dur) * jolt; }
  // ---- bridge sway -------------------------------------------------------------------------------------------------------
  if (onBridge) {
    R.bridgeT += dt;
    const res = 1 + K.BRIDGE_RES * Math.exp(-(((R.pace - seg.pRes) / K.BRIDGE_WIDTH) ** 2)) * (moving ? 1 : 0.35);
    R.bridgeRes = res;
    const sway = seg.amp * res * Math.sin(seg.freq * R.bridgeT) * jolt;
    dist += sway; R.bridgeSway = sway;
  } else { R.bridgeT = 0; R.bridgeSway *= Math.max(0, 1 - 4 * dt); R.bridgeRes = 1; }
  // ---- load dynamics ---------------------------------------------------------------------------------------------------
  const propped = !moving && !onBridge && R.halt <= 0;
  const G = loadG(trail.kg, R.assist);
  if (propped) {
    R.a *= Math.exp(-3.5 * dt); R.w *= Math.exp(-5 * dt);
    if (Math.abs(R.a) < 0.002) R.a = 0;
  } else {
    if (moving) dist += 0.3 * Math.min(1.4, R.pace) * Math.sin(2 * Math.PI * R.walkPhase * 2) * (R.assist ? 0.7 : 1);
    R.nz += (-R.nz * 0.9 + gauss(R) * 1.1) * dt;
    const tired = 1 + 2 * Math.max(0, K.LOW_BREATH + 0.1 - R.breath) / (K.LOW_BREATH + 0.1);
    dist += R.nz * 0.55 * tired * (R.assist ? 0.7 : 1);
    const bias = K.SLOPE_BIAS * slope;
    const authority = K.CTRL * (R.breath < 0.18 ? 0.65 + 0.35 * (R.breath / 0.18) : 1);
    const damp = trail.rain ? K.DAMP * 0.85 : K.DAMP;
    const acc = G * R.a - damp * R.w + dist + bias * (moving ? 1 : 0.4) - authority * R.leanS;
    R.w += acc * dt; R.a += R.w * dt;
  }
  R.cooldown = Math.max(0, R.cooldown - dt);
  R.stumble = Math.max(0, R.stumble - dt);
  R.maxAngle = Math.max(R.maxAngle, Math.abs(R.a));
  if (Math.abs(R.a) > K.SPILL_ANGLE && R.cooldown <= 0) {
    R.items -= 1; R.spills += 1; R.cooldown = K.SPILL_COOLDOWN; R.stumble = 0.7;
    R.events.push({ type: 'spill', dir: Math.sign(R.a) });
    R.a *= K.RESEAT; R.w = 0;
    if (R.items <= 0) { R.items = 0; R.ended = 'lost'; R.events.push({ type: 'lost' }); return; }
  } else if (Math.abs(R.a) > 0.9) { R.a = Math.sign(R.a) * 0.9; }
  // ---- rest platform: repack ---------------------------------------------------------------------------------------------
  if (onRest) {
    if (!R.visited.includes(seg.x0)) { R.visited.push(seg.x0); R.events.push({ type: 'chautara' }); }
    if (!moving && R.restT >= K.REPACK_TIME && R.items < R.items0 && !R.repacked[seg.x0]) { R.items += 1; R.repacked[seg.x0] = 1; R.events.push({ type: 'repack' }); }
  }
  if (R.t > trail.dayLen && !R.late) R.late = true;
  if (!trail.endless && R.x >= trail.goal) { R.x = trail.goal; R.v = 0; R.ended = 'arrived'; R.events.push({ type: 'arrive' }); }
}

export function starsFor(R, trail) {
  if (R.ended !== 'arrived') return 0;
  const keep = R.items / R.items0;
  if (keep >= 1 && !R.late && R.halts === 0) return 3;
  if (keep >= 0.75 && !R.late) return 2;
  return 1;
}
export const longRoadScore = (R) => Math.floor(R.distance) + 10 * R.visited.length;

// ---- the game's own player -----------------------------------------------------------------------------------------------
// Returns a control { hold, lean, pace }. `skill` adds the sluggishness of a person: reading the load a moment late.
export function botControl(R, trail, mem = {}) {
  const seg = segAt(trail, R.x), slope = slopeAt(trail, R.x);
  const onRest = seg.t === 'rest', onBridge = seg.t === 'bridge';
  // pace
  let pace = 1.0;
  if (seg.t === 'steps') pace = 0.78;
  else if (seg.t === 'down') pace = 0.9;
  else if (seg.t === 'climb' && R.breath < 0.6) pace = 0.85;
  const ahead = segAt(trail, R.x + 4);
  if (ahead.t === 'steps' && seg.t !== 'steps') pace = Math.min(pace, 0.85);
  if (onBridge || (ahead.t === 'bridge' && ahead !== seg && seg.t !== 'steps')) { const b = onBridge ? seg : ahead; pace = b.pRes < 1 ? 1.28 : 0.68; }
  // when to rest: low breath on ground that can be propped, or on a rest platform until fed and repacked
  const canRest = !onBridge && ahead.t !== 'bridge';
  if (mem.resting === undefined) mem.resting = false;
  if (mem.resting) {
    const want = onRest ? 0.92 : 0.8;
    const needRepack = onRest && R.items < R.items0 && !R.repacked[seg.x0];
    if ((R.breath >= want && !needRepack) || (onBridge)) mem.resting = false;
  } else if (!onBridge && !R.halt) {
    const lowAt = trail.endless || trail.d > 0.2 ? 0.3 : 0.2;
    let hazard = false;
    for (let i = trail.segs.indexOf(seg) + 1; i < trail.segs.length && trail.segs[i].x0 < R.x + 12; i++) { const t = trail.segs[i].t; if (t === 'bridge' || t === 'steps') hazard = true; }
    if (R.breath < lowAt && canRest) mem.resting = true;
    else if (hazard && R.breath < 0.6 && seg.t !== 'steps' && canRest) mem.resting = true;
    else if (onRest && R.x - seg.x0 > 1.5 && (R.breath < 0.85 || R.items < R.items0) && !R.repacked[seg.x0]) mem.resting = true;
    // breath on a long climb ahead: top up on the platform
  }
  // a rest only on a platform when one is near and breath is not critical
  const hold = !mem.resting && R.halt <= 0;
  // lean: PD on the load plus feed-forward for the slope
  const G = loadG(trail.kg, R.assist);
  const kp = (G / K.CTRL) * 1.6 + 0.3, kd = 0.5;
  const ff = (K.SLOPE_BIAS * slope) / K.CTRL;
  let lean = kp * R.a + kd * R.w + ff * (hold ? 1 : 0);
  if (R.gust) lean += R.gust.dir * 0.12;
  const gnext = trail.gusts[R.gustIdx];
  if (gnext && gnext.x - R.x < 0.6 && gnext.x - R.x > 0) lean += gnext.dir * 0.25;
  return { hold, lean: clamp(lean, -1, 1), pace: clamp(pace, K.PACE_MIN, K.PACE_MAX), resting: mem.resting };
}

// ---- coaching text ------------------------------------------------------------------------------------------------------
// What to tell the player about one segment or gust. `lean` and `pace` are the posture that works there.
export function cardForSeg(s) {
  const lean = clamp((K.SLOPE_BIAS * s.slope) / K.CTRL, -1, 1);
  if (s.t === 'steps') return { kind: 'steps', title: 'Stone steps', text: `Every step jolts the load. Slow your pace (drag down, about 0.8x) and lean forward a little (about ${Math.round(Math.max(0, lean) * 100)}%) to keep the load centred.`, lean, pace: 0.78, seg: s };
  if (s.t === 'bridge') return { kind: 'bridge', title: 'Swaying bridge', text: `The bridge sways in its own rhythm, and a pace near ${s.pRes.toFixed(2)}x makes it sway more. Break your step: go ${s.pRes < 1 ? 'quicker (drag up)' : 'slower (drag down)'} and counter each swing. You cannot prop the load on a bridge.`, lean: 0, pace: s.pRes < 1 ? 1.28 : 0.68, seg: s };
  if (s.t === 'climb') return { kind: 'climb', title: 'Climb', text: `On a climb the load drags at the headstrap. Lean forward (drag right, about ${Math.round(Math.max(0, lean) * 100)}%) and keep a calm pace: climbing drains breath ${(1 + K.BREATH_PER_SLOPE * Math.abs(s.slope)).toFixed(1)} times faster.`, lean, pace: 0.9, seg: s };
  if (s.t === 'down') return { kind: 'down', title: 'Descent', text: 'Going down, the load pushes the other way. Lean back (drag left) and take slower steps. Breath comes back a little on the way down.', lean, pace: 0.9, seg: s };
  if (s.t === 'rest') return { kind: 'rest', title: 'Rest platform', text: `A chautara, the stone resting place. Lift your thumb here: breath returns ${K.REST_CHAUTARA} times faster, and after ${K.REPACK_TIME} seconds a fallen item is repacked. Rest only as long as the daylight allows.`, lean: 0, pace: 1, rest: true, seg: s };
  return { kind: 'flat', title: 'Easy walking', text: 'The path is level. Keep the load centred with small lean corrections, and keep an eye on the breath bar. A steady pace costs less breath than a rush.', lean: 0, pace: 1, seg: s };
}
export function cardForGust(g, R) {
  const d = Math.max(0, g.x - R.x);
  return { kind: 'gust', title: 'Gust of wind', text: `A gust will push the load ${g.dir > 0 ? 'forward' : 'back'} in about ${d.toFixed(0)} metres. Lean ${g.dir > 0 ? 'forward (drag right)' : 'back (drag left)'} as it arrives, then ease off.`, lean: g.dir * 0.7, pace: 1, gust: g };
}
// The next thing worth telling the player about, within `reach` metres (or the segment he is on).
export function coachFor(R, trail, reach = 16) {
  const seg = segAt(trail, R.x);
  if (R.items < R.items0 && seg.t === 'rest') return { kind: 'repack', title: 'Repack the basket', text: `Lift your thumb and rest here. After ${K.REPACK_TIME} seconds the porter repacks one fallen item, and breath returns ${K.REST_CHAUTARA} times faster than on the path.`, lean: 0, pace: 1, rest: true, seg };
  if (R.breath < 0.4 && seg.t !== 'bridge') return { kind: 'breath', title: 'Catch your breath', text: `The breath bar is low. Lift your thumb to rest on level ground: below ${Math.round(K.LOW_BREATH * 100)}% the steps slow and the load shakes more, and at zero the porter must stop for ${K.HALT_TIME} seconds.`, lean: 0, pace: 0.9, rest: true, seg };
  const list = [];
  if (seg.t !== 'flat') list.push(seg);
  for (let i = trail.segs.indexOf(seg) + 1; i < trail.segs.length; i++) { const s = trail.segs[i]; if (s.x0 > R.x + reach) break; if (s.t !== 'flat') list.push(s); }
  const gust = trail.gusts[R.gustIdx];
  const pick = list.find((s) => s.t === 'bridge' || s.t === 'steps') ?? list.find((s) => s.t !== 'rest') ?? list[0] ?? null;
  if (gust && gust.x - R.x < 6 && gust.x > R.x && (!pick || gust.x < pick.x0)) return cardForGust(gust, R);
  return cardForSeg(pick ?? seg);
}
