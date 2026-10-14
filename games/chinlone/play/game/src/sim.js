// Chinlone simulation: pure, deterministic, no drawing. Six dancers stand in a ring and keep one woven cane ball in the air.
// The player leads the dance: for every pass the ball flies from one dancer's touch to the next dancer's touch on a fixed beat,
// and the player taps the named touch that the receiving dancer has to make as the ring closes. The simulation owns every
// position and contact time; the 3D presenter and the 2D HUD only read it.
export const N = 6;
export const RING = 2.05;                     // metres from the centre to each dancer
export const BALL_R = 0.07;
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export function seeded(seed) {                // tiny mulberry32 for the daily dance
  let a = (seed >>> 0) || 1;
  const next = () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  return { next, int: (n) => Math.floor(next() * n), chance: (p) => next() < p };
}

// The five named touches. y = height of the contact point above the ground, in metres.
export const TOUCHES = [
  { id: 'foot', name: 'Inside foot', short: 'Foot', y: 0.30, base: 100, where: 'low, in front of the foot' },
  { id: 'knee', name: 'Knee', short: 'Knee', y: 0.68, base: 110, where: 'at knee height, in front' },
  { id: 'heel', name: 'Back-heel', short: 'Heel', y: 0.42, base: 130, where: 'low, behind the standing leg' },
  { id: 'neck', name: 'Neck roll', short: 'Neck', y: 1.42, base: 140, where: 'high, at the back of the neck' },
  { id: 'shoulder', name: 'Shoulder roll', short: 'Shoulder', y: 1.36, base: 150, where: 'high, over the shoulder' },
];
const T = (id) => TOUCHES.findIndex((t) => t.id === id);
// Named flowing patterns: finish one with your latest touches (all landed in time) and the pattern is paid.
export const COMBOS = [
  { name: 'Rising Crane', seq: [T('foot'), T('knee'), T('neck')], pts: 250 },
  { name: 'Willow Sway', seq: [T('knee'), T('heel'), T('knee')], pts: 250 },
  { name: 'River Bend', seq: [T('heel'), T('foot'), T('heel')], pts: 250 },
  { name: 'Peacock Fan', seq: [T('neck'), T('shoulder'), T('neck')], pts: 300 },
  { name: 'Swan Glide', seq: [T('knee'), T('neck'), T('shoulder')], pts: 300 },
  { name: 'Circle of Grace', seq: [T('foot'), T('knee'), T('neck'), T('shoulder')], pts: 500 },
];
export const TEMPOS = [
  { id: 'gentle', name: 'Gentle', beat: 1.18, preview: 4, blurb: 'Slow beat. Every touch is named in advance.' },
  { id: 'steady', name: 'Steady', beat: 0.98, preview: 3, blurb: 'A comfortable beat with three touches shown ahead.' },
  { id: 'lively', name: 'Lively', beat: 0.82, preview: 2, blurb: 'A quick beat. Only two touches are shown ahead.' },
];
export const ROUND_TOUCHES = 12, ROUNDS = 4, SESSION = ROUND_TOUCHES * ROUNDS, WATCH_TOUCHES = 12;
export const WIN = { early: 0.24, perfect: 0.06, good: 0.12, lead: 0.10 };   // seconds; the ideal tap is `lead` before the contact
export const SCORE = { perfect: 100, good: 60, ok: 30, off: 10 };

// ---- geometry ------------------------------------------------------------------------------------------------------
export const dancerAngle = (j) => Math.PI + (j * Math.PI * 2) / N;
export function spot(j) {
  const a = dancerAngle(j);
  const x = Math.sin(a) * RING, z = Math.cos(a) * RING;
  const fx = -Math.sin(a), fz = -Math.cos(a);
  return { x, z, fx, fz, rx: -fz, rz: fx, yaw: Math.atan2(fx, fz) };       // r = the dancer's right-hand side
}
// Where the ball meets the dancer for a touch. side +1 = right-hand side of the body, -1 = left.
const OFF = {
  foot: { f: 0.34, l: 0.10, y: 0.30 },
  knee: { f: 0.27, l: 0.10, y: 0.68 },
  heel: { f: -0.06, l: 0.25, y: 0.42 },
  neck: { f: 0.05, l: 0.0, y: 1.42 },
  shoulder: { f: 0.0, l: 0.20, y: 1.36 },
};
export function contactPoint(j, touch, side) {
  const s = spot(j), o = OFF[TOUCHES[touch].id];
  return { x: s.x + s.fx * o.f + s.rx * o.l * side, y: o.y, z: s.z + s.fz * o.f + s.rz * o.l * side };
}

// Parabola from A to B in T seconds whose highest point is `lift` metres above the higher end (gravity is derived, so a low
// drive is a flatter arc and a high lob a floating one).
export function planFlight(A, B, Tt, lift) {
  const dy = B.y - A.y, a = Math.max(dy, 0) + lift;
  const s = (Math.sqrt(2 * a) + Math.sqrt(2 * Math.max(a - dy, 0))) / Tt, g = s * s;
  return { vx: (B.x - A.x) / Tt, vz: (B.z - A.z) / Tt, vy: Math.sqrt(2 * g * a), g };
}
export const flightPos = (f, tau) => ({ x: f.A.x + f.vx * tau, y: f.A.y + f.vy * tau - 0.5 * f.g * tau * tau, z: f.A.z + f.vz * tau });
const norm = (v) => { const l = Math.hypot(v.x, v.y, v.z) || 1; return { x: v.x / l, y: v.y / l, z: v.z / l }; };

// ---- cues (the dance the player is asked for) -------------------------------------------------------------------------------
function makeCue(run, rs, prev) {
  const n = run.cueN++;
  if (!run.comboQ.length && run.sinceCombo >= 7 && rs.chance(0.8)) {
    const c = rs.int(COMBOS.length);
    run.comboQ = COMBOS[c].seq.slice(); run.sinceCombo = 0; run.comboName = COMBOS[c].name;
  }
  let touch;
  if (run.comboQ.length) touch = run.comboQ.shift();
  else {
    const pool = TOUCHES.map((_, i) => i).filter((i) => !(run.lastTouches[0] === i && run.lastTouches[1] === i));
    touch = pool[rs.int(pool.length)];
    run.sinceCombo++;
  }
  run.lastTouches = [run.lastTouches[1], touch];
  const r = rs.next();
  const step = r < 0.34 ? 1 : r < 0.68 ? N - 1 : r < 0.88 ? 2 : r < 0.97 ? N - 2 : 3;
  const dancer = (prev + step) % N;
  const side = rs.chance(0.5) ? 1 : -1;
  const lift = 0.45 + rs.next() * 0.55 + (step === 3 ? 0.25 : 0);
  return { n, dancer, touch, side, lift, C: contactPoint(dancer, touch, side) };
}

export function newRun({ mode = 'dance', tempo = 1, day = 0 }, rng) {
  const rs = mode === 'daily' ? seeded(day * 7919 + 17) : rng;
  const total = mode === 'watch' ? WATCH_TOUCHES : SESSION;
  const run = {
    mode, tempo, day, t: 0, phase: 'ready', readyT: 1.0, total, over: null,
    beatBase: TEMPOS[tempo].beat, round: 1, done: 0, rs,
    cueN: 0, comboQ: [], sinceCombo: 3, comboName: '', lastTouches: [-1, -1], cues: [], from: 0,
    ball: { x: 0, y: 0.1, z: -RING + 0.3, vx: 0, vy: 0, vz: 0, mode: 'held' },
    fl: null, tap: null, settle: 0, fallG: 9, bounced: 0, serve: { dancer: 0, tc: 1.0 },
    score: 0, flow: 0.15, mult: 1, streak: 0, bestStreak: 0, perfects: 0, goods: 0, oks: 0, offs: 0, drops: 0, hints: 0, taps: 0,
    harm: 0, attempts: 0, recent: [], combos: [], comboCount: {}, touchCount: [0, 0, 0, 0, 0], kindsDone: new Set(),
    events: [], evSeq: 0, last: null, lastQ: '',
  };
  for (let i = 0; i < 6; i++) { const c = makeCue(run, rs, i === 0 ? 0 : run.cues[i - 1].dancer); run.cues.push(c); }
  run.from = 0;
  return run;
}

const emit = (run, e) => { e.seq = run.evSeq++; e.t = run.t; run.events.push(e); if (run.events.length > 80) run.events.shift(); return e; };
export const beatNow = (run) => run.beatBase * (1 - 0.04 * (run.round - 1));
export const mult = (flow) => 1 + Math.floor(flow * 4) * 0.5;      // x1 .. x3

function launch(run, from, t0, soft) {
  const cue = run.cues[0], nxt = run.cues[1];
  const A = { x: from.x, y: from.y, z: from.z };
  const Tt = soft ? beatNow(run) * 1.25 : beatNow(run);
  const p = planFlight(A, cue.C, Tt, soft ? 1.1 : cue.lift);
  run.fl = { A, B: cue.C, t0, t1: t0 + Tt, ...p, cue, soft: !!soft };
  // direction in which the receiving dancer will push the ball on (read by the presenter before the contact)
  const p2 = nxt ? planFlight(cue.C, nxt.C, beatNow(run), nxt.lift) : { vx: 0, vy: 3, vz: 0 };
  cue.d = norm({ x: p2.vx, y: p2.vy, z: p2.vz });
  run.phase = 'flight'; run.tap = null;
  run.ball.mode = 'flight';
  emit(run, { type: 'launch', from: run.from, to: cue.dancer, touch: cue.touch, tc: run.fl.t1, soft: !!soft });
}

// The tap judged against the beat. Returns { ok, why, q }.
export function tapPad(run, pad) {
  if (!run || run.over || run.phase !== 'flight' || !run.fl) return { ok: false, why: 'idle' };
  const f = run.fl, tH = f.t1 - WIN.lead;
  if (run.t < tH - WIN.early) return { ok: false, why: 'early' };
  const cur = run.tap;
  if (cur && cur.touch === f.cue.touch) return { ok: false, why: 'again' };
  const dt = run.t - tH, q = Math.abs(dt) <= WIN.perfect ? 'perfect' : Math.abs(dt) <= WIN.good ? 'good' : 'ok';
  run.tap = { t: run.t, touch: pad, dt, q };
  run.taps++;
  return { ok: true, q, right: pad === f.cue.touch, dt };
}

function checkCombos(run) {
  // the latest touches, all landed in time (no off-step, no drop), match the longest pattern
  const L = run.recent;
  let best = null;
  for (const c of COMBOS) {
    const k = c.seq.length;
    if (L.length < k) continue;
    const tail = L.slice(-k);
    if (tail.every((e, i) => e.ok && e.touch === c.seq[i]) && (!best || k > best.seq.length)) best = c;
  }
  if (best) {
    run.recent = [];                                   // a pattern is paid once, then the counter starts again
    const gain = Math.round(best.pts * run.mult);
    run.score += gain; run.combos.push(best.name); run.comboCount[best.name] = (run.comboCount[best.name] || 0) + 1;
    emit(run, { type: 'combo', name: best.name, gain });
  }
}

function resolve(run) {
  const f = run.fl, cue = f.cue, tap = run.tap;
  const right = tap && tap.touch === cue.touch;
  run.attempts++;
  if (!tap) {
    // nobody asked for the touch: the ball falls past the dancer
    const tau = f.t1 - f.t0;
    run.ball.vx = f.vx; run.ball.vz = f.vz; run.ball.vy = f.vy - f.g * tau; run.fallG = f.g;
    run.ball.mode = 'fall'; run.phase = 'fall'; run.settle = 0; run.bounced = 0;
    run.drops++; run.streak = 0; run.flow = Math.max(0.1, run.flow - 0.35); run.mult = mult(run.flow); run.recent = [];
    run.last = { type: 'drop', dancer: cue.dancer, touch: cue.touch };
    emit(run, { type: 'drop', dancer: cue.dancer, touch: cue.touch, x: cue.C.x, z: cue.C.z });
    run.from = cue.dancer;
    return;
  }
  const q = right ? tap.q : 'off';
  run.done++;
  run.touchCount[cue.touch]++;
  let gain = 0;
  if (q === 'perfect') { run.perfects++; run.harm += 1; run.flow = clamp(run.flow + 0.09, 0, 1); gain = SCORE.perfect; }
  else if (q === 'good') { run.goods++; run.harm += 0.7; run.flow = clamp(run.flow + 0.06, 0, 1); gain = SCORE.good; }
  else if (q === 'ok') { run.oks++; run.harm += 0.4; run.flow = clamp(run.flow + 0.025, 0, 1); gain = SCORE.ok; }
  else { run.offs++; run.flow = clamp(run.flow - 0.22, 0, 1); gain = SCORE.off; }
  const okTouch = q !== 'off';
  run.streak = okTouch ? run.streak + 1 : 0;
  run.bestStreak = Math.max(run.bestStreak, run.streak);
  run.mult = mult(run.flow);
  if (okTouch) run.kindsDone.add(cue.touch);
  gain = Math.round(gain * run.mult * (okTouch ? TOUCHES[cue.touch].base / 100 : 1));
  run.score += gain;
  run.recent.push({ touch: cue.touch, ok: okTouch }); if (run.recent.length > 6) run.recent.shift();
  run.last = { type: 'touch', q, dancer: cue.dancer, touch: cue.touch, gain };
  emit(run, { type: 'touch', dancer: cue.dancer, touch: cue.touch, side: cue.side, q, gain, x: cue.C.x, y: cue.C.y, z: cue.C.z, d: cue.d, streak: run.streak });
  if (okTouch) checkCombos(run); else run.recent = [];
  // round bookkeeping
  const r0 = run.round;
  run.round = Math.min(ROUNDS, 1 + Math.floor(run.done / ROUND_TOUCHES));
  if (run.mode === 'watch') run.round = 1;
  if (run.done >= run.total) {
    run.over = { done: true, score: run.score };
    run.phase = 'end'; run.endT = 0;
    emit(run, { type: 'end' });
    const dir = cue.d || { x: 0, y: 1, z: 0 };
    run.fl = { A: { ...cue.C }, B: { x: cue.C.x, y: 0, z: cue.C.z }, t0: f.t1, t1: f.t1 + 1.6, vx: 0, vz: 0, vy: 3.2, g: 9.8, cue, soft: true, end: true, d: dir };
    run.cues.shift();
    return;
  }
  if (run.round !== r0) emit(run, { type: 'round', round: run.round });
  run.cues.shift();
  const prevD = cue.dancer;
  run.cues.push(makeCue(run, run.rs, run.cues[run.cues.length - 1].dancer));
  run.from = prevD;
  launch(run, cue.C, f.t1, false);
}

export function stepRun(run, dt) {
  if (run.over && run.phase !== 'end') return;
  run.t += dt;
  const b = run.ball;
  if (run.phase === 'ready') {
    run.serve = { dancer: 0, tc: run.readyT };
    b.x = spot(0).x + spot(0).fx * 0.34; b.z = spot(0).z + spot(0).fz * 0.34; b.y = 0.09;
    if (run.t >= run.readyT) { launch(run, { x: b.x, y: 0.09, z: b.z }, run.readyT, true); emit(run, { type: 'serve', dancer: 0, x: b.x, z: b.z }); }
    return;
  }
  if (run.phase === 'flight') {
    const f = run.fl;
    if (run.t >= f.t1) { resolve(run); }
    if (run.phase === 'flight') { const p = flightPos(f, run.t - f.t0); b.x = p.x; b.y = p.y; b.z = p.z; }
    else if (run.phase === 'fall') { /* integrate below from the contact moment */ b.x = run.fl.B.x; b.y = run.fl.B.y; b.z = run.fl.B.z; }
    return;
  }
  if (run.phase === 'fall') {
    b.vy -= run.fallG * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
    if (b.y <= 0.07) {
      b.y = 0.07;
      if (run.bounced < 2 && Math.abs(b.vy) > 0.8) { b.vy = -b.vy * 0.38; b.vx *= 0.5; b.vz *= 0.5; run.bounced++; emit(run, { type: 'bounce', x: b.x, z: b.z }); }
      else {
        b.vx = b.vy = b.vz = 0; run.phase = 'settle'; run.settle = 0; b.mode = 'ground';
        let bj = 0, bd = 1e9;      // the dancer nearest the ball will scoop it up
        for (let j = 0; j < N; j++) { const s = spot(j), d = Math.hypot(s.x - b.x, s.z - b.z); if (d < bd) { bd = d; bj = j; } }
        run.serve = { dancer: bj, tc: run.t + 1.0 };
      }
    }
    return;
  }
  if (run.phase === 'settle') {
    run.settle += dt;
    if (run.settle >= 1.0) {
      // the dancer nearest the ball scoops it back up with the foot, then the dance carries on
      const bj = run.serve.dancer;
      run.from = bj;
      emit(run, { type: 'serve', dancer: bj, x: b.x, z: b.z });
      launch(run, { x: b.x, y: 0.09, z: b.z }, run.t, true);
    }
    return;
  }
  if (run.phase === 'end') {
    run.endT += dt;
    const f = run.fl, tau = run.t - f.t0;
    if (tau >= 0) { const p = flightPos(f, Math.min(tau, f.t1 - f.t0)); b.x = p.x; b.y = Math.max(0.07, p.y); b.z = p.z; }
  }
}

// What a good player would do now (Think and Watch & Learn).
export function advise(run) {
  if (!run || run.phase !== 'flight' || !run.fl) return null;
  const c = run.fl.cue, t = TOUCHES[c.touch];
  return {
    touch: c.touch, dancer: c.dancer, tH: run.fl.t1 - WIN.lead,
    reason: `${t.name}: the ball comes in ${t.where}. Tap ${t.short} as the ring closes.`,
  };
}

export const harmony = (run) => (run.attempts ? run.harm / run.attempts : 0);
export function stars(h) { return h >= 0.9 ? 5 : h >= 0.78 ? 4 : h >= 0.62 ? 3 : h >= 0.42 ? 2 : 1; }
