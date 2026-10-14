// One run of the cloverleaf. Pure and deterministic: no clock, no randomness; time is the dt of update().
// World frame: x across (+ is the rider's right when facing up the arena), y up the arena, metres. The timing line is y = 0.
// Heading th: 0 faces +y, positive turns clockwise as seen from above (to the right), so the direction is (sin th, cos th).
// Angles around a barrel use the same convention: a = atan2(dx, dy), clockwise is increasing.
import {
  ARENA, START_Y, YAW_MAX, BRAKE, ACC, SCRUB, BODY_R, BARREL_R, KNOCK_S, WIND_DONE, WIND_RING, BURST_T, BURST_V, BURST_A, TIME_LIMIT, HORSES,
} from './consts.js';

const TAU = Math.PI * 2;
const mod = (a, m) => ((a % m) + m) % m;
const wrapPi = (a) => { a = mod(a + Math.PI, TAU) - Math.PI; return a; };
export const AFTER_T = 1.6;          // seconds the horse keeps cantering after the line before the run is over

// ---- the course --------------------------------------------------------------------------------------------------------------------
export function courseFor(cfg) {
  const sp = cfg.sp;
  const bx = 9.8 * sp, by = 17.5 * sp, fy = 35 * sp;
  return { sp, bx, by, fy, barrels: [{ x: bx, y: by }, { x: -bx, y: by }, { x: 0, y: fy }] };
}
// turning direction around barrel i given which side barrel was ridden first (0 right, 1 left): right barrel clockwise (+1),
// left barrel anticlockwise (-1), far barrel the same way as the second barrel.
export const dirOf = (i, first) => (i === 0 ? 1 : i === 1 ? -1 : first === 0 ? -1 : 1);
export const SIDE_NAME = ['right-hand', 'left-hand', 'far'];

// ---- the run -----------------------------------------------------------------------------------------------------------------------
export function createRun(cfg) {
  const horse = HORSES[cfg.horse ?? 1];
  const course = courseFor(cfg);
  const grip = cfg.grip + horse.gripAdd;
  const s = {
    phase: 'ready', t: 0, over: false, evId: 0, events: [], held: false, annStage: -1,
    x: 0, y: START_Y, th: 0, v: 0, vTop: horse.vTop, acc: horse.acc, grip,
    sIn: 0, sAct: 0, bIn: 0, bAct: 0, yaw: 0, stride: 0, burstT: 0, burstUsed: false, burstHome: false,
    clock: 0, running: false, finished: false, time: 0, knocked: 0, net: 0, outcome: null, dnf: false, hinted: false, hintCost: 0,
    stage: 0, first: -1, order: [], wind: [0, 0, 0], wa0: [0, 0, 0], done: [false, false, false], fence: 0,
    barrels: course.barrels.map((b) => ({ x: b.x, y: b.y, down: false, vx: 0, vy: 0, rot: 0, spin: 0, age: 0 })),
    particles: [], trail: [], trailT: 0, pdt: 0, shake: 0, afterT: 0, lineSpeed: 0, maxSpeed: 0,
  };
  const ev = (type, extra) => { s.events.push({ id: s.evId++, type, t: s.t, ...extra }); if (s.events.length > 30) s.events.shift(); };
  const yawLimit = (v) => Math.min(YAW_MAX, s.grip / Math.max(v, 2.5));

  // barrels still to be turned and the way each is turned
  const active = () => (s.stage === 0 ? [0, 1] : s.stage === 1 ? [s.first === 0 ? 1 : 0] : s.stage === 2 ? [2] : []);
  const spawn = (x, y, vx, vy, life, size) => { if (s.particles.length < 70) s.particles.push({ x, y, vx, vy, life, max: life, size }); };

  const api = {
    s, course, active, yawLimit,
    start() { if (s.phase !== 'ready') return; s.phase = 'ride'; s.v = 5.2; ev('start'); },
    burst() { if (s.phase === 'ride' && !s.burstUsed && !s.finished) { s.burstUsed = true; s.burstT = BURST_T; s.burstHome = s.stage === 3; ev('burst'); return true; } return false; },
    update(dt, ctl) {
      if (s.phase === 'ready' || s.over) return;
      if (ctl && ctl.steer != null) s.sIn = Math.max(-1, Math.min(1, ctl.steer));
      if (ctl && ctl.brake != null) s.bIn = Math.max(0, Math.min(1, ctl.brake));
      if (ctl && ctl.burst) api.burst();
      s.t += dt;
      if (s.finished) {
        // follow-through: straighten up and ease off
        s.sIn = 0; s.bIn = 0; s.afterT += dt;
        s.v = Math.max(0, s.v - 5 * dt);
      }
      // steering and speed
      s.sAct += (s.sIn - s.sAct) * Math.min(1, dt * 9);
      s.bAct += (s.bIn - s.bAct) * Math.min(1, dt * 7);
      const yl = yawLimit(s.v);
      s.yaw = s.sAct * yl;
      s.th += s.yaw * dt;
      const b = s.burstT > 0, vt = s.vTop * (b ? BURST_V : 1), ac = s.acc * (b ? BURST_A : 1);
      if (!s.finished) s.v += (ac * (1 - s.v / vt) - SCRUB * Math.abs(s.yaw) * s.v - BRAKE * s.bAct) * dt;
      if (s.burstT > 0) s.burstT = Math.max(0, s.burstT - dt);
      if (!s.finished) s.v = Math.max(1.5, s.v);
      s.maxSpeed = Math.max(s.maxSpeed, s.v);
      const px = s.x, py = s.y;
      s.x += Math.sin(s.th) * s.v * dt; s.y += Math.cos(s.th) * s.v * dt;
      s.stride += s.v * dt * 0.62;
      if (s.shake > 0) s.shake = Math.max(0, s.shake - dt * 3);

      // fence: ride into it and the horse is checked
      let hit = false;
      if (s.x < ARENA.x0 + 0.9) { s.x = ARENA.x0 + 0.9; hit = true; } else if (s.x > ARENA.x1 - 0.9) { s.x = ARENA.x1 - 0.9; hit = true; }
      if (s.y < ARENA.y0 + 0.9) { s.y = ARENA.y0 + 0.9; hit = true; } else if (s.y > ARENA.y1 - 0.9) { s.y = ARENA.y1 - 0.9; hit = true; }
      if (hit) { s.v = Math.max(1.5, s.v * 0.93); if (s.fence <= 0) { ev('fence'); s.fence = 0.5; } }
      if (s.fence > 0) s.fence -= dt;

      // timing line
      if (!s.running && !s.finished && py < 0 && s.y >= 0) { s.running = true; s.lineSpeed = s.v; ev('line'); }
      if (s.running && !s.finished) s.clock += dt;

      if (!s.finished) {
        // barrels: knocked by the body (front, middle, rear circles)
        const dx = Math.sin(s.th), dy = Math.cos(s.th);
        for (let i = 0; i < 3; i++) {
          const br = s.barrels[i];
          if (br.down) continue;
          for (const o of [1.15, 0, -1.0]) {
            const ex = s.x + dx * o - br.x, ey = s.y + dy * o - br.y;
            if (Math.hypot(ex, ey) < BODY_R + BARREL_R) {
              br.down = true; br.vx = dx * s.v * 0.7 + (br.x - s.x) * 2.2; br.vy = dy * s.v * 0.7 + (br.y - s.y) * 2.2; br.spin = (ex * dy - ey * dx) > 0 ? 7 : -7;
              s.knocked++; s.v *= 0.9; s.shake = 0.6; ev('knock', { barrel: i });
              for (let k = 0; k < 7; k++) spawn(br.x, br.y, Math.sin(k * 2.4) * 3, Math.cos(k * 2.4) * 3, 0.6, 0.5);
              break;
            }
          }
        }
        // turning around the barrels
        for (const i of active()) {
          const br = s.barrels[i], d = Math.hypot(s.x - br.x, s.y - br.y);
          if (d > WIND_RING) continue;
          const a0 = Math.atan2(px - br.x, py - br.y), a1 = Math.atan2(s.x - br.x, s.y - br.y);
          const dir = dirOf(i, s.first === -1 ? 0 : s.first);
          if (s.wind[i] <= 0.001) s.wa0[i] = a0;
          s.wind[i] = Math.max(-Math.PI, Math.min(WIND_DONE + 1, s.wind[i] + wrapPi(a1 - a0) * dir));
          if (s.wind[i] >= WIND_DONE) {
            s.done[i] = true; s.order.push(i);
            if (s.stage === 0) { s.first = i; s.wind[i === 0 ? 1 : 0] = 0; }
            s.stage++;
            ev('barrel', { barrel: i, stage: s.stage });
            break;
          }
        }
        // the finish: across the timing line, heading back, after all three barrels
        if (s.stage === 3 && py > 0 && s.y <= 0) {
          const f = py / Math.max(1e-6, py - s.y);
          s.finished = true; s.time = s.clock - dt * (1 - f); s.outcome = s.knocked ? 'knocked' : 'clean';
          s.net = s.time + s.knocked * KNOCK_S + s.hintCost; s.phase = 'after'; ev('finish');
        } else if (s.t > TIME_LIMIT) {
          s.finished = true; s.dnf = true; s.time = TIME_LIMIT; s.outcome = 'dnf'; s.net = TIME_LIMIT + s.knocked * KNOCK_S + s.hintCost; s.phase = 'after'; ev('finish');
        }
      }
      // knocked barrels roll away
      for (const br of s.barrels) {
        if (!br.down) continue;
        br.age += dt; br.x += br.vx * dt; br.y += br.vy * dt; br.rot += br.spin * dt;
        const k = Math.pow(0.12, dt); br.vx *= k; br.vy *= k; br.spin *= k;
      }
      // dust and the trail
      s.pdt += dt;
      if (!s.finished || s.v > 4) {
        const lat = Math.abs(s.sAct);
        if (s.pdt > 0.05 && s.v > 4.5 && lat > 0.25) {
          s.pdt = 0;
          const side = Math.sign(s.yaw) || 1;
          spawn(s.x - Math.sin(s.th) * 1.1 - Math.cos(s.th) * side * 0.5, s.y - Math.cos(s.th) * 1.1 + Math.sin(s.th) * side * 0.5, -Math.sin(s.th) * 1.2 - Math.cos(s.th) * side * 1.4, -Math.cos(s.th) * 1.2 + Math.sin(s.th) * side * 1.4, 0.7, 0.35 + lat * 0.4);
        }
      }
      for (let i = s.particles.length - 1; i >= 0; i--) {
        const p = s.particles[i]; p.life -= dt;
        if (p.life <= 0) { s.particles.splice(i, 1); continue; }
        p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.96; p.vy *= 0.96;
      }
      s.trailT += dt;
      if (s.trailT >= 0.07 && !s.over) { s.trailT = 0; s.trail.push(+s.x.toFixed(2), +s.y.toFixed(2)); }
      if (s.finished && s.afterT > AFTER_T) { s.over = true; ev('end'); }
    },
  };
  return api;
}

// ---- planning a good line (also what the computer rider follows) -------------------------------------------------------------------
const hOf = (a, dir) => a + dir * Math.PI / 2;
const onCircle = (c, rr, a) => ({ x: c.x + rr * Math.sin(a), y: c.y + rr * Math.cos(a) });
const angleOf = (c, p) => Math.atan2(p.x - c.x, p.y - c.y);

function root(f, a0, a1) {
  let lo = a0, hi = a1, flo = f(lo);
  for (let k = 0; k < 40; k++) { const m = (lo + hi) / 2, fm = f(m); if ((fm < 0) === (flo < 0)) { lo = m; flo = fm; } else hi = m; }
  return (lo + hi) / 2;
}
// scan a in [0, TAU) for the angle where g crosses zero while ok(a) holds
function scan(g, ok) {
  const N = 360; let pa = 0, pg = g(0), pok = ok(0);
  for (let i = 1; i <= N; i++) {
    const a = (i / N) * TAU, gv = g(a), okv = ok(a);
    if (pok && okv && (pg < 0) !== (gv < 0)) return root(g, pa, a);
    pa = a; pg = gv; pok = okv;
  }
  return null;
}
// the angle on circle (c, rr, dir) where a tangent line from point P touches it (travelling in the circle's direction)
function fromPoint(P, c, rr, dir) {
  if (Math.hypot(P.x - c.x, P.y - c.y) <= rr * 1.02) return angleOf(c, P);
  const a = scan((a) => { const T = onCircle(c, rr, a), h = hOf(a, dir); return (T.x - P.x) * Math.cos(h) - (T.y - P.y) * Math.sin(h); },
    (a) => { const T = onCircle(c, rr, a), h = hOf(a, dir); return (T.x - P.x) * Math.sin(h) + (T.y - P.y) * Math.cos(h) > 0; });
  return a == null ? angleOf(c, P) : a;
}
// exit angle on circle A and entry angle on circle B for the common tangent
function between(cA, dirA, cB, dirB, rr) {
  const g = (a) => { const T = onCircle(cA, rr, a), h = hOf(a, dirA), hx = Math.sin(h), hy = Math.cos(h); return (cB.x - T.x) * hy + (cB.y - T.y) * -hx - dirB * rr; };
  const ok = (a) => { const T = onCircle(cA, rr, a), h = hOf(a, dirA); return (cB.x - T.x) * Math.sin(h) + (cB.y - T.y) * Math.cos(h) > 0; };
  const a = scan(g, ok);
  if (a == null) return { exit: angleOf(cA, cB), enter: angleOf(cB, cA) };
  const T = onCircle(cA, rr, a), h = hOf(a, dirA), nx = Math.cos(h), ny = -Math.sin(h);
  const TB = { x: cB.x - nx * dirB * rr, y: cB.y - ny * dirB * rr };
  return { exit: a, enter: angleOf(cB, TB), T };
}
function toPoint(c, dir, rr, P) {
  const a = scan((a) => { const T = onCircle(c, rr, a), h = hOf(a, dir); return (P.x - T.x) * Math.cos(h) - (P.y - T.y) * Math.sin(h); },
    (a) => { const T = onCircle(c, rr, a), h = hOf(a, dir); return (P.x - T.x) * Math.sin(h) + (P.y - T.y) * Math.cos(h) > 0; });
  return a == null ? angleOf(c, P) : a;
}

const HOME = { x: 0, y: -5 };
// A polyline (array of {x, y}) from the rider's present place through the barrels still to turn and home.
// chain: [{ c: {x, y}, dir }] in the order they are turned. rr: radius of the circle to ride around each barrel.
export function planLine(from, chain, rr) {
  const pts = [{ x: from.x, y: from.y }];
  let cur = { x: from.x, y: from.y }, th = from.th;
  let a0 = null;
  for (let k = 0; k < chain.length; k++) {
    const { c, dir } = chain[k];
    const enter = k === 0 ? fromPoint(cur, c, rr, dir) : a0;
    if (k === 0) { // straight leg from the rider to the circle
      const T = onCircle(c, rr, enter), n = Math.max(1, Math.round(Math.hypot(T.x - cur.x, T.y - cur.y)));
      for (let i = 1; i <= n; i++) pts.push({ x: cur.x + (T.x - cur.x) * i / n, y: cur.y + (T.y - cur.y) * i / n });
    }
    let exit, nextEnter = null;
    if (k + 1 < chain.length) { const bt = between(c, dir, chain[k + 1].c, chain[k + 1].dir, rr); exit = bt.exit; nextEnter = bt.enter; }
    else exit = toPoint(c, dir, rr, HOME);
    const sweep = dir > 0 ? mod(exit - enter, TAU) : mod(enter - exit, TAU);
    const n = Math.max(2, Math.ceil(sweep / 0.12));
    for (let i = 1; i <= n; i++) { const q = onCircle(c, rr, enter + dir * sweep * i / n); q.arc = true; pts.push(q); }
    const Te = onCircle(c, rr, exit);
    if (k + 1 < chain.length) {
      const Tn = onCircle(chain[k + 1].c, rr, nextEnter), m = Math.max(1, Math.round(Math.hypot(Tn.x - Te.x, Tn.y - Te.y)));
      for (let i = 1; i <= m; i++) pts.push({ x: Te.x + (Tn.x - Te.x) * i / m, y: Te.y + (Tn.y - Te.y) * i / m });
      a0 = nextEnter;
    } else {
      const m = Math.max(1, Math.round(Math.hypot(HOME.x - Te.x, HOME.y - Te.y)));
      for (let i = 1; i <= m; i++) pts.push({ x: Te.x + (HOME.x - Te.x) * i / m, y: Te.y + (HOME.y - Te.y) * i / m });
    }
  }
  if (!chain.length) { const m = Math.max(1, Math.round(Math.hypot(HOME.x - cur.x, HOME.y - cur.y))); for (let i = 1; i <= m; i++) pts.push({ x: cur.x + (HOME.x - cur.x) * i / m, y: cur.y + (HOME.y - cur.y) * i / m }); }
  return pts;
}

// the barrels still to be turned from the present state, in order, given which side to ride first
export function chainFor(s, first) {
  const f = s.first >= 0 ? s.first : first;
  const seq = [f, f === 0 ? 1 : 0, 2];
  const left = s.stage === 0 ? seq : s.stage === 1 ? seq.slice(1) : s.stage === 2 ? seq.slice(2) : [];
  return left.map((i) => ({ c: s.barrels[i], dir: dirOf(i, f), i }));
}

// ---- the computer rider ----------------------------------------------------------------------------------------------------------
export function makeAi(opts = {}) { return { rr: opts.rr ?? 3.6, first: opts.first ?? 0, jitter: opts.jitter ?? 0, plan: null, stage: -9, idx: 0, len: null, err: 0 }; }
function planFor(run, ai) {
  const s = run.s;
  ai.plan = planLine({ x: s.x, y: s.y, th: s.th }, chainFor(s, ai.first), ai.rr);
  ai.len = [0];
  for (let i = 1; i < ai.plan.length; i++) ai.len.push(ai.len[i - 1] + Math.hypot(ai.plan[i].x - ai.plan[i - 1].x, ai.plan[i].y - ai.plan[i - 1].y));
  ai.idx = 0; ai.stage = s.stage;
}
export function aiControl(run, ai) {
  const s = run.s;
  if (s.phase === 'ready' || s.finished) return { steer: 0, brake: 0, burst: false };
  if (!ai.plan || ai.stage !== s.stage) planFor(run, ai);
  // nearest point ahead on the plan
  let best = ai.idx, bd = Infinity;
  for (let i = ai.idx; i < Math.min(ai.plan.length, ai.idx + 40); i++) {
    const d = Math.hypot(ai.plan[i].x - s.x, ai.plan[i].y - s.y);
    if (d < bd) { bd = d; best = i; }
  }
  ai.idx = best;
  if (bd > 7) { planFor(run, ai); best = 0; }
  const look = Math.max(2.2, Math.min(7, 1.2 + 0.42 * s.v));
  let j = ai.idx;
  while (j < ai.plan.length - 1 && ai.len[j] - ai.len[ai.idx] < look) j++;
  const T = ai.plan[j];
  const want = Math.atan2(T.x - s.x, T.y - s.y);
  const al = wrapPi(want - s.th);
  const Ld = Math.max(1.5, Math.hypot(T.x - s.x, T.y - s.y));
  const kappa = 2 * Math.sin(al) / Ld;
  const yl = run.yawLimit(s.v);
  let steer = Math.max(-1, Math.min(1, (kappa * s.v) / yl));
  if (ai.jitter) steer += ai.err * ai.jitter;
  // speed: be at the speed the next arc can be ridden at by the time it starts
  const vArc = Math.sqrt(s.grip * ai.rr) * 1.0;
  let brake = 0;
  const here = ai.plan[ai.idx];
  if (here.arc) { if (s.v > vArc * 1.04) brake = Math.min(1, (s.v - vArc) / 1.2); }
  else {
    let k = ai.idx; while (k < ai.plan.length && !ai.plan[k].arc) k++;
    if (k < ai.plan.length) { const d = ai.len[k] - ai.len[ai.idx]; if (s.v > vArc && d <= (s.v * s.v - vArc * vArc) / (2 * BRAKE * 0.8) + 0.4) brake = 1; }
  }
  return { steer: Math.max(-1, Math.min(1, steer)), brake, burst: s.stage === 3 && !s.burstUsed && s.y > 4 };
}

// A run played start to finish by the computer rider (used for the rival's ghost and for the star thresholds).
const idealCache = new Map();
export function idealFor(cfg) {
  const key = `${cfg.sp.toFixed(3)}|${(cfg.grip + HORSES[cfg.horse ?? 1].gripAdd).toFixed(2)}|${cfg.horse ?? 1}`;
  if (idealCache.has(key)) return idealCache.get(key);
  let best = null;
  for (const rr of [2.0, 2.3, 2.6, 3.0, 3.6]) {
    for (const first of [0]) {
      const run = createRun(cfg), ai = makeAi({ rr, first });
      run.start();
      const path = [];
      for (let i = 0; i < 60 * 70 && !run.s.over; i++) {
        run.update(1 / 60, aiControl(run, ai));
        if (i % 3 === 0) path.push(+run.s.x.toFixed(2), +run.s.y.toFixed(2), +run.s.th.toFixed(3));
        if (run.s.finished && run.s.afterT > 0.2) break;
      }
      const r = { rr, first, time: run.s.net, clean: run.s.knocked === 0, raw: run.s.time, path, finished: run.s.finished && !run.s.dnf };
      if (r.finished && r.clean && (!best || r.time < best.time)) best = r;
    }
  }
  if (!best) best = { rr: 4.3, first: 0, time: 30, raw: 30, path: [], clean: true, finished: false };
  idealCache.set(key, best);
  if (idealCache.size > 80) idealCache.delete(idealCache.keys().next().value);
  return best;
}

// A rival's results for a round (net seconds), drawn once from the round's rival skill (0-1).
export function rivalRuns(skill, n, ideal, rng) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const knocked = rng.next() < 0.5 - 0.42 * skill ? 1 : 0;
    const time = ideal * (1.34 - 0.2 * skill + rng.range(-0.04, 0.06));
    out.push({ time: Math.round(time * 100) / 100, knocked, net: Math.round((time + knocked * KNOCK_S) * 100) / 100 });
  }
  return out;
}

// Watch & Learn holds the run when the computer rider is about to start the next barrel (or the run home)
export const THINK_DIST = 15;
export function thinkDue(s, ai) {
  if (s.phase !== 'ride' || s.finished || s.annStage === s.stage) return false;
  if (s.stage === 3) return true;
  const tgt = chainFor(s, ai.first)[0];
  if (!tgt) return false;
  return Math.hypot(tgt.c.x - s.x, tgt.c.y - s.y) <= THINK_DIST + (s.stage === 0 ? 0 : 6);
}
