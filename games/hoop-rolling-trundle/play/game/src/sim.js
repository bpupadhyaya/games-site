// Hoop Rolling Trundle simulation: pure and deterministic. Units are metres and seconds; s runs along the road, d is the sideways
// position (+ right of the centre line), psi the hoop's heading relative to the road (+ right).
//
// SPEED   v' = push * A_PUSH * (1 - v / V_CAP) - brake - drag(surface) - gravity * grade       (hold the stick behind the hoop)
// LEAN    lam'' = -KP (lam - lamT) - KD lam' + INST(v) lam + kicks       lamT = 0.75 * steer; |lam| > 1 and the hoop falls.
//         INST grows as the hoop slows: a slow hoop is unstable, a fast one rolls itself upright.
// HEADING psi' = TURN * lam * min(1, v / 2.5) - kappa(s) * v          (a leaning hoop turns toward its lean)
import { COURSES, kappaAt, halfWidthAt, zoneAt, gradeAt } from './courses.js';

export const PHYS = {
  R: 0.36, A_PUSH: 5.6, V_CAP: 9, DRAG: 0.24, ROLL: 0.15, BRAKE: 6.5, GRAV: 6, KP: 62, KD: 11, INST0: 96, V_STAB: 3.4, LEAN_MAX: 0.75, TURN: 0.88,
  GRASS_DRAG: 1.5, MUD_DRAG: 1.05, COBBLE_DRAG: 0.18, WALL: 1.9, DOWN_T: 1.7, DOWN_T_PRACTICE: 0.9, COUNTDOWN: 3, GATE_POST: 0.2, START_V: 1.4,
  PUDDLE_SLOW: 0.74,
};
export const SCORE = { perfect: 100, good: 60, chainStep: 10, chainMax: 80, finish: 200, perSecond: 15, place: [1000, 600, 300, 100] };
export const STAR_PLACE = [3, 2, 1, 1];
export const DEMO_RUNS = 3;
export const GATE_PERFECT = 0.4;           // within this fraction of half the gate width counts as perfect
export const RIVAL_COUNT = 3;

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

// A tiny per-racer generator (own state), so a racer's noise never depends on how many other things drew from the world generator.
function nextRand(r) { r.rs = (Math.imul(r.rs, 1664525) + 1013904223) >>> 0; return r.rs / 4294967296; }

export function newRacer(id, look, skill, bot, seed) {
  return {
    id, look, skill, bot, name: '', s: 0, d: 0, psi: 0, v: 0, lam: 0, om: 0, spin: 0, phase: 'ready', downT: 0, downKind: '', finished: false, finT: 0,
    gi: 0, pi: 0, perfect: 0, good: 0, missed: 0, posts: 0, falls: 0, chain: 0, maxChain: 0, score: 0, cobT: 0, rs: (seed * 2654435761 + id * 97 + 13) >>> 0,
    cmd: { u: 0, p: 0 }, surf: 'road', lastQ: '', hitCool: 0, noiseG: 0, stride: 0, wall: 0, splashT: 0, wobT: 0, lastPud: -1, slipT: 0,
  };
}

export function createWorld(courseIndex, o, rng) {
  const course = COURSES[courseIndex];
  const mode = o.mode ?? 'race';                       // race | practice | auto
  const W = { course, ci: courseIndex, mode, rng, t: 0, go: -PHYS.COUNTDOWN, racers: [], events: [], over: false, overT: 0, assist: mode === 'practice' ? 1 : 0 };
  W.racers.push(newRacer(0, o.playerLook ?? 0, 1, mode === 'auto', course.seed));
  W.racers[0].name = 'You';
  course.rivals.forEach((r, i) => {
    const rc = newRacer(i + 1, r.look, r.skill * (mode === 'practice' ? 0.72 : 1), true, course.seed);
    rc.name = r.name;
    W.racers.push(rc);
  });
  // start line: staggered across the road
  const off = [0, -1.6, 1.6, -0.8];
  W.racers.forEach((r, i) => { r.d = i === 0 ? 0 : off[i] * 0.9; r.v = 0; r.phase = 'ready'; });
  return W;
}

// ---- surfaces ---------------------------------------------------------------------------------------------------------------------
export function surfaceAt(C, s, d) {
  const z = zoneAt(C, s);
  const hw = halfWidthAt(C, s);
  if (Math.abs(d) > hw) return z && z.kind === 'plank' ? 'water' : 'grass';
  if (z) return z.kind === 'slope' ? 'road' : z.kind;
  return 'road';
}
export const isOnPuddle = (p, s, d) => Math.abs(s - p.s) < p.rs && Math.abs(d - p.d) < p.rd;

// ---- the controller (the same one the rivals and the Watch and Learn performer use) --------------------------------------------------
// Returns { u, p, tgtD, vT } for the racer: the steer and push the performer would give right now.
export function planFor(W, r) {
  const C = W.course, v = Math.max(r.v, 0.3), sk = clamp(r.skill, 0, 1);
  const look = clamp(1.3 + v * 0.62, 2.4, 6.8);
  // the line: through the next gate, easing in from further out
  let g = C.gates[r.gi], tgtD = 0;
  if (g && g.s - r.s < 40) {
    const wob = (1 - sk) * 0.35 * Math.sin(r.gi * 2.3 + r.id * 1.7);
    tgtD = g.d + wob * g.w / 2;
    const ahead = g.s - r.s;
    if (ahead < 0.6) { const g2 = C.gates[r.gi + 1]; if (g2) tgtD = g2.d; }
  }
  // keep to the road, and away from puddles directly in the way
  const hwHere = halfWidthAt(C, r.s + look);
  tgtD = clamp(tgtD, -hwHere + 0.8, hwHere - 0.8);
  for (let i = r.pi; i < C.puddles.length; i++) {
    const p = C.puddles[i], ahead = p.s - r.s;
    if (ahead < -1) continue;
    if (ahead > 10 + v) break;
    if (Math.abs(tgtD - p.d) < p.rd + 0.45 && sk > 0.5) {
      const side = tgtD >= p.d ? 1 : -1, cand = p.d + side * (p.rd + 0.5);
      const alt = clamp(cand, -hwHere + 0.8, hwHere - 0.8);
      if (Math.abs(alt - p.d) > p.rd + 0.2) tgtD = alt; else tgtD = clamp(p.d - side * (p.rd + 0.5), -hwHere + 0.8, hwHere - 0.8);
    }
  }
  const horizon = Math.max(look, Math.min(g ? g.s - r.s + 0.5 : look, 9));
  const psiT = clamp(Math.atan2(tgtD - r.d, horizon) * 1.05, -0.7, 0.7);
  const kNow = kappaAt(C, r.s + v * 0.12);
  const gg = Math.min(1, v / 2.5);
  const uff = (kNow * v) / (PHYS.TURN * Math.max(0.35, gg) * PHYS.LEAN_MAX);
  const u = clamp(uff + (2.2 * (psiT - r.psi) - 0.55 * r.om * 0.1 + (1 - sk) * 0.07 * Math.sin(W.t * 2.1 + r.id)) , -1, 1);
  // safe speed: the bends ahead, the surface and the next gates
  let vSafe = 3.2 + 3.4 * sk * sk;
  const span = 10 + v * 1.3;
  let kMax = 0;
  for (let q = 0; q <= span; q += 2) kMax = Math.max(kMax, Math.abs(kappaAt(C, r.s + q)));
  if (kMax > 0.001) vSafe = Math.min(vSafe, (PHYS.TURN * PHYS.LEAN_MAX * 0.8) / kMax);
  const zNext = zoneAt(C, r.s + v * 0.8 + 1);
  if (zNext) {
    if (zNext.kind === 'plank') vSafe = Math.min(vSafe, 3.9 + sk);
    else if (zNext.kind === 'cobble') vSafe = Math.min(vSafe, 4.3 + 0.9 * sk);
    else if (zNext.kind === 'mud') vSafe = Math.max(vSafe, 4.5);
  }
  if (g && Math.abs(g.d - r.d) > g.w * 0.8 && g.s - r.s < 8) vSafe = Math.min(vSafe, 4.2);
  const gr = gradeAt(C, r.s);
  if (gr < -0.03) vSafe = Math.min(vSafe, 5.4 + 8 * gr * -0.0 + 1.6 * sk);
  const p = clamp((vSafe - r.v) * 1.5, -1, 1);
  return { u, p, tgtD, vT: vSafe };
}

// ---- stepping ---------------------------------------------------------------------------------------------------------------------
function ev(W, e) { if (W.events) W.events.push(e); }

function fall(W, r, kind) {
  r.phase = 'down'; r.downT = 0; r.downKind = kind; r.falls += 1; r.chain = 0; r.v = 0; r.om = 0;
  ev(W, { type: 'fall', who: r.id, kind, s: r.s, d: r.d });
}

export function stepRacer(W, r, dt, cmd) {
  const P = PHYS, C = W.course;
  if (r.finished) {
    // roll out to a stop past the line, steering straight
    r.v = Math.max(0, r.v - 3 * dt); r.s += r.v * dt; r.spin += r.v / P.R * dt; r.lam *= 1 - 3 * dt; r.psi *= 1 - 3 * dt; return;
  }
  if (W.go < 0) { r.spin += 0; return; }
  if (r.phase === 'ready') { r.phase = 'roll'; r.v = P.START_V; }
  if (r.phase === 'down') {
    r.downT += dt;
    const need = W.mode === 'practice' && r.id === 0 ? P.DOWN_T_PRACTICE : P.DOWN_T;
    if (r.downT >= need) {
      r.phase = 'roll'; r.lam = 0; r.om = 0; r.psi = 0; r.v = 1.6;
      const hw = halfWidthAt(C, r.s);
      r.d = clamp(r.d, -hw + 0.9, hw - 0.9);
      if (r.downKind === 'water') r.d = 0;
      ev(W, { type: 'up', who: r.id });
    }
    return;
  }
  const u = clamp(cmd?.u ?? 0, -1, 1), p = clamp(cmd?.p ?? 0, -1, 1);
  r.cmd.u = u; r.cmd.p = p;
  const surf = surfaceAt(C, r.s, r.d);
  r.surf = surf;
  if (surf === 'water') { fall(W, r, 'water'); return; }
  const grade = gradeAt(C, r.s);
  // speed
  let a = p > 0 ? p * P.A_PUSH * Math.max(0, 1 - r.v / P.V_CAP) : p * P.BRAKE * Math.min(1, r.v / 1.5 + 0.2);
  let drag = P.DRAG * r.v + P.ROLL;
  if (surf === 'grass') drag += P.GRASS_DRAG * r.v + 0.4;
  else if (surf === 'mud') drag += P.MUD_DRAG * r.v + 0.5;
  else if (surf === 'cobble') drag += P.COBBLE_DRAG * r.v;
  a -= drag + P.GRAV * grade;
  r.v = Math.max(0, r.v + a * dt);
  // lean
  const assist = W.assist && r.id === 0 ? 0.7 : 1;
  const lamT = P.LEAN_MAX * u;
  const inst = P.INST0 * assist * Math.max(0, 1 - r.v / P.V_STAB);
  let acc = -P.KP * (r.lam - lamT) - P.KD * r.om + inst * r.lam;
  // a leaning hoop also tips with sideways speed in a turn: the faster the harder the bend loads it
  acc += 0;
  r.om += acc * dt;
  r.lam += r.om * dt;
  // a slow hoop is never perfectly still: tiny knocks that only matter when it is too slow to right itself
  r.wobT = (r.wobT ?? 0) - dt;
  if (r.wobT <= 0) { r.wobT = 0.25; r.om += (nextRand(r) * 2 - 1) * 0.9 * Math.max(0, 1 - r.v / P.V_STAB); }
  // the rivals are human: now and then one gets a bad bounce (never the performer in Watch and Learn)
  if (r.id !== 0 && r.skill < 0.97) {
    r.slipT -= dt;
    if (r.slipT <= 0) { r.slipT = 5 + nextRand(r) * 7; if (nextRand(r) < (1 - r.skill) * 0.9 + 0.1) { r.om += (nextRand(r) < 0.5 ? -1 : 1) * (5 + nextRand(r) * 3.5); r.v *= 0.72; } }
  }
  // surface kicks
  if (surf === 'cobble' || surf === 'grass') {
    r.cobT -= dt;
    if (r.cobT <= 0) {
      r.cobT = surf === 'cobble' ? 0.16 : 0.22;
      const amp = ((surf === 'cobble' ? 2.6 : 1.7) + 0.3 * r.v) * assist * (W.assist && r.id === 0 ? 0.7 : 1);
      r.om += (nextRand(r) * 2 - 1) * amp;
    }
  } else r.cobT = 0;
  // heading, position
  const gturn = Math.min(1, r.v / 2.5);
  const kap = kappaAt(C, r.s);
  r.psi += (P.TURN * r.lam * gturn - kap * r.v) * dt;
  r.psi = clamp(r.psi, -1.25, 1.25);
  r.s += r.v * Math.cos(r.psi) * dt;
  r.d += r.v * Math.sin(r.psi) * dt;
  r.spin += r.v / P.R * dt;
  r.stride += r.v * dt;
  if (r.hitCool > 0) r.hitCool -= dt;
  // walls beyond the shoulder
  const hw = halfWidthAt(C, r.s);
  const lim = hw + P.WALL;
  if (Math.abs(r.d) > lim) {
    const sg = Math.sign(r.d);
    r.d = sg * lim; r.psi = -r.psi * 0.3; r.v *= 0.55; r.om += -sg * 3.2; r.wall = 0.3;
    ev(W, { type: 'wall', who: r.id, s: r.s, d: r.d });
  }
  // puddles
  while (r.pi < C.puddles.length && C.puddles[r.pi].s + C.puddles[r.pi].rs < r.s - 0.5) r.pi += 1;
  for (let i = r.pi; i < C.puddles.length; i++) {
    const pd = C.puddles[i];
    if (pd.s - pd.rs > r.s + 1) break;
    if (isOnPuddle(pd, r.s, r.d) && !(r.lastPud === i)) {
      r.lastPud = i; r.v *= P.PUDDLE_SLOW; r.om += (nextRand(r) < 0.5 ? -1 : 1) * (2.6 + nextRand(r) * 1.6); r.splashT = 0.4;
      ev(W, { type: 'splash', who: r.id, s: r.s, d: r.d });
    }
  }
  // gates
  const g = C.gates[r.gi];
  if (g) {
    if (Math.abs(r.s - g.s) < 0.3) {
      for (const sgn of [-1, 1]) {
        const px = g.d + sgn * g.w / 2;
        if (Math.abs(r.d - px) < P.GATE_POST && r.hitCool <= 0) {
          r.d = px + sgn * P.GATE_POST; r.v *= 0.5; r.om += sgn * 3; r.posts += 1; r.hitCool = 0.5; r.chain = 0;
          ev(W, { type: 'post', who: r.id, s: r.s, d: px });
        }
      }
    }
    if (r.s >= g.s) {
      const off = Math.abs(r.d - g.d), half = g.w / 2;
      let q;
      if (off <= half - 0.04) {
        q = off <= half * GATE_PERFECT ? 'perfect' : 'good';
        r.chain += 1; r.maxChain = Math.max(r.maxChain, r.chain);
        r.score += (q === 'perfect' ? SCORE.perfect : SCORE.good) + Math.min(SCORE.chainMax, SCORE.chainStep * (r.chain - 1));
        if (q === 'perfect') r.perfect += 1; else r.good += 1;
      } else { q = 'miss'; r.missed += 1; r.chain = 0; }
      r.lastQ = q;
      ev(W, { type: 'gate', who: r.id, q, s: g.s, d: r.d, gate: r.gi, chain: r.chain });
      r.gi += 1;
    }
  }
  // falling over
  if (Math.abs(r.lam) > 1) { fall(W, r, 'balance'); return; }
  // finish
  if (r.s >= C.length) {
    r.finished = true; r.finT = W.t; r.phase = 'roll';
    ev(W, { type: 'finish', who: r.id, t: W.t });
  }
}

export function stepWorld(W, dt, cmd) {
  W.events.length = 0;
  if (W.go < 0) {
    const n0 = Math.ceil(-W.go);
    W.go += dt;
    const n1 = W.go < 0 ? Math.ceil(-W.go) : 0;
    if (n1 !== n0) ev(W, { type: n1 === 0 ? 'go' : 'count', n: n1 });
    if (W.go >= 0) { W.go = 0; ev(W, { type: 'go' }); }
    return;
  }
  W.t += dt; W.go += dt;
  for (const r of W.racers) {
    let c = cmd;
    if (r.id !== 0 || r.bot || !cmd) { const pl = planFor(W, r); c = { u: pl.u, p: pl.p }; }
    stepRacer(W, r, dt, c);
  }
  const me = W.racers[0];
  if (me.finished) { W.overT += dt; if (W.overT > 2.2) W.over = true; }
  if (W.t > 400) W.over = true;
}

// ---- results, standings -----------------------------------------------------------------------------------------------------------
export function standings(W) {
  return [...W.racers].sort((a, b) => {
    if (a.finished !== b.finished) return a.finished ? -1 : 1;
    if (a.finished) return a.finT - b.finT;
    return b.s - a.s;
  });
}
export const placeOf = (W, id) => standings(W).findIndex((r) => r.id === id);

export function resultOf(W) {
  const me = W.racers[0], C = W.course;
  const st = standings(W), place = st.findIndex((r) => r.id === 0);
  const time = me.finished ? me.finT : W.t;
  let score = me.score;
  if (me.finished) score += SCORE.finish + SCORE.place[Math.min(place, 3)] + Math.max(0, Math.round((C.par - time) * SCORE.perSecond));
  return {
    ci: W.ci, mode: W.mode, place, time, score, stars: me.finished ? STAR_PLACE[Math.min(place, 3)] : 0, par: C.par,
    gates: C.gates.length, perfect: me.perfect, good: me.good, missed: me.missed, posts: me.posts, falls: me.falls, maxChain: me.maxChain,
    names: st.map((r) => r.name), finished: me.finished,
  };
}

// The sections of a course for Watch and Learn: distances where the clock stops to think.
export const sectionsOf = (C) => C.sections;

// What the road ahead holds, for the Think card and the hint.
export function featureAhead(C, s, span = 40) {
  const out = { s: Infinity, kind: null };
  for (const z of C.zones) if (z.s1 > s && z.s0 < s + span && z.s0 - s < out.s) { out.s = Math.max(0, z.s0 - s); out.kind = z.kind === 'slope' ? (z.grade > 0 ? 'up' : 'down') : z.kind; }
  for (const b of C.bends) {
    if (b.s1 > s && b.s0 < s + span && Math.max(0, b.s0 - s) < out.s && Math.abs(b.k) >= 0.045) { out.s = Math.max(0, b.s0 - s); out.kind = Math.abs(b.k) >= 0.06 ? 'hairpin' : b.k > 0 ? 'right' : 'left'; }
  }
  for (const p of C.puddles) if (p.s > s && p.s < s + span * 0.5 && p.s - s < out.s) { out.s = p.s - s; out.kind = 'puddle'; }
  return out.kind ? out : null;
}

// The line the performer is about to ride: a short forward simulation with the same controller, for the Reveal and the hint.
export function ghostLine(W, secs = 4.5) {
  const me = W.racers[0];
  const r = { ...me, cmd: { u: 0, p: 0 } };
  const sim = { course: W.course, mode: W.mode, t: W.t, go: 0, assist: 0, events: null, racers: [r] };
  r.skill = 1;
  const pts = [];
  for (let i = 0, n = Math.round(secs * 30); i < n; i++) {
    const pl = planFor(sim, r);
    for (let k = 0; k < 2; k++) { sim.t += 1 / 60; stepRacer(sim, r, 1 / 60, { u: pl.u, p: pl.p }); }
    pts.push({ s: r.s, d: r.d, v: r.v });
    if (r.phase === 'down' || r.finished) break;
  }
  return pts;
}
