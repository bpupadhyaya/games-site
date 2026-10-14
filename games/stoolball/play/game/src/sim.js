// Stoolball: the whole simulation. Pure and deterministic (no DOM, no clock): positions in metres, time in seconds.
// World axes: x is sideways (positive = the batter's right, screen right in portrait), y runs along the pitch from the
// striker's board (y = 0) towards the bowler and the far board (y = PITCH), z is height.
//
//   makePath()      a delivery: the ball's flight from the bowler's hand to the board, analytic in time
//   strike()        the batter's reply: blocked, missed, bowled or hit (with the speed, angle and height of the hit)
//   newField()      the ball in the field: fielders chase, catch, throw; batters run; the ball ends dead
//   stepField()     advances that by dt
//   batterPlan / bowlerPlan / fieldSet / runWant / adviceBat   the computer's decisions, also used for the Think hint
export const G = 9.8;
export const PITCH = 13.7;        // board to board
export const BOWL_Y = 7.3;        // the bowler delivers from here (8 yards from the striker's board)
export const STRIKE_Y = 0.9;      // the paddle plane, just in front of the board
export const REL_Z = 1.0;         // release height of the underarm delivery
export const BOARD_W = 0.2;       // half width of the board and post as the ball sees them
export const BOARD_TOP = 1.55;    // the wicket is the board on its post: a ball below this hits it
export const PADDLE_R = 0.3;      // the paddle's half width for contact
export const BALL_R = 0.05;
export const BALLS_PER_OVER = 6, OVERS = 3, WICKETS = 5;
export const KNOCK_BALLS = 12, KNOCK_WICKETS = 2;
export const FIELD_C = { x: 0, y: PITCH / 2 }, FIELD_R = 28;
export const END_Y = [STRIKE_Y, PITCH - STRIKE_Y];   // where a batter stands at each end
export const RUN_LEN = END_Y[1] - END_Y[0];
export const RUN_SPEED = 5.7, THROW_SPEED = 19, LATE = 0.09;
export const TAU = Math.PI * 2;
const RAD = Math.PI / 180;

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
export const gauss = (r) => (r.next() + r.next() + r.next() - 1.5) * 2;   // about N(0, 1)

// One shot kind: W = timing window before the ball reaches the paddle (s), spread = degrees of aim by the part of the
// paddle that meets the ball, bias = degrees pulled by timing (early = left, late = right), v0..v1 = speed by quality,
// e0..e1 = launch elevation by quality (low quality pops up).
export const SHOTS = {
  block: { id: 'block', name: 'Block', W: 0.17, spread: 22, bias: 8, v0: 2.5, v1: 5, e0: 0, e1: 4 },
  drive: { id: 'drive', name: 'Drive', W: 0.13, spread: 52, bias: 22, v0: 8, v1: 21, e0: 5, e1: 30 },
  lift: { id: 'lift', name: 'Lift', W: 0.11, spread: 62, bias: 26, v0: 10, v1: 26, e0: 24, e1: 50 },
};

// Levels: bat = how the computer batter plays (timing scatter, paddle placement scatter, how often it goes for the big
// shot), bowl = how accurately it bowls, field = fielders' speed, catching and throwing.
export const LEVELS = [
  { id: 0, name: 'Village', blurb: 'Friendly green, kind field.',
    bat: { ts: 0.062, px: 0.12, risk: 0.2 }, bowl: { line: 0.62, ht: 0.5, paceLo: 1.12, paceHi: 1.4 }, field: { speed: 5.6, catch: 0.62, throwSig: 0.17, react: 0.7 } },
  { id: 1, name: 'County', blurb: 'A sharper side with a better arm.',
    bat: { ts: 0.042, px: 0.075, risk: 0.32 }, bowl: { line: 0.42, ht: 0.42, paceLo: 0.98, paceHi: 1.28 }, field: { speed: 6.2, catch: 0.74, throwSig: 0.1, react: 0.5 } },
  { id: 2, name: 'Champions', blurb: 'Quick, clever and clinical.',
    bat: { ts: 0.02, px: 0.034, risk: 0.5 }, bowl: { line: 0.22, ht: 0.3, paceLo: 0.84, paceHi: 1.14 }, field: { speed: 6.8, catch: 0.86, throwSig: 0.06, react: 0.35 } },
];

export const FIELD_SETS = [
  { id: 'close', name: 'Close', r: 9, note: 'Fielders ring the pitch: fewer gaps for a drive, easy catches.' },
  { id: 'balanced', name: 'Balanced', r: 16, note: 'A mix of close and deep.' },
  { id: 'spread', name: 'Spread', r: 23, note: 'Everyone near the rope: singles are easy, fours are rare.' },
];
const FIELD_ANG = [-138, -98, -62, -26, 26, 62, 98, 138];

// ---- the delivery ----------------------------------------------------------------------------------------------------
// aimX, aimH = where the ball is at the paddle plane (m, m); T = release to board (s); bounce = one bounce short of the
// paddle; swing = sideways bow in the flight (m, returns to the line at the paddle).
export function makePath(aimX, aimH, T, bounce = false, swing = 0) {
  const tArr = (T * (BOWL_Y - STRIKE_Y)) / BOWL_Y;
  const p = { aimX, aimH, T, tArr, swing, x0: aimX * 0.25, vz0: 0, bounce: false, t1: 0, e: 0.55, vzb: 0 };
  p.vz0 = (aimH - REL_Z + 0.5 * G * tArr * tArr) / tArr;
  if (bounce) {
    let best = null;
    for (let i = 0; i < 60; i++) {
      const yb = 1.2 + i * 0.09, t1 = (T * (BOWL_Y - yb)) / BOWL_Y;
      if (t1 <= 0.05 || t1 >= tArr - 0.04) continue;
      const vz0 = (0 - REL_Z + 0.5 * G * t1 * t1) / t1, vi = vz0 - G * t1;
      if (vi >= 0) continue;
      const vzb = -p.e * vi, d = tArr - t1, z = vzb * d - 0.5 * G * d * d, err = Math.abs(z - aimH);
      if (!best || err < best.err) best = { err, t1, vz0, vzb };
    }
    if (best && best.err < 0.12) { p.bounce = true; p.t1 = best.t1; p.vz0 = best.vz0; p.vzb = best.vzb; }
  }
  return p;
}
export function ballAt(p, t) {
  const s = t / p.tArr;
  const x = p.x0 + (p.aimX - p.x0) * s + p.swing * (s * s * s - s);
  const y = BOWL_Y * (1 - t / p.T);
  let z;
  if (p.bounce && t > p.t1) { const d = t - p.t1; z = Math.max(0, p.vzb * d - 0.5 * G * d * d); }
  else z = Math.max(0, REL_Z + p.vz0 * t - 0.5 * G * t * t);
  return { x, y, z };
}
// Does an unhindered ball hit the board? (checked at its arrival at the board plane)
export function hitsBoard(p) {
  const b = ballAt(p, p.T);
  return Math.abs(b.x) <= BOARD_W + BALL_R && b.z <= BOARD_TOP;
}
export const speedOf = (p) => BOWL_Y / p.T;

// ---- the strike ------------------------------------------------------------------------------------------------------
// swing = null | { type, t } (t = time since release); paddleX = paddle centre when the ball reaches the plane.
// Returns { kind: 'blocked'|'missed'|'bowled'|'passed'|'hit', ...}. For 'hit' also { q, ball: {x,y,z,vx,vy,vz}, edge, ang, shot }.
export function strike(p, swing, paddleX, r) {
  const arr = ballAt(p, p.tArr);
  const covers = (x, z) => Math.abs(x - paddleX) <= PADDLE_R + BALL_R && z >= 0.05 && z <= 1.95;
  if (swing) {
    const spec = SHOTS[swing.type];
    const W = spec.W * clamp(p.T / 1.1, 0.78, 1.25);
    const d = swing.t - p.tArr;
    if (d >= -W && d <= LATE) {
      const b = ballAt(p, swing.t);
      if (covers(b.x, b.z)) {
        const win = d < 0 ? W : LATE;
        let q = 1 - Math.abs(d) / win;
        q *= 1 - 0.45 * clamp(Math.abs(b.z - 0.95) / 0.85, 0, 1);       // very high or very low is harder to meet
        q *= 1 - 0.25 * clamp(Math.abs(b.x) / 0.9, 0, 1);               // so is far out wide
        q = clamp(q, 0, 1);
        const o = clamp((b.x - paddleX) / PADDLE_R, -1, 1);
        const early = clamp(d / W, -1, 1);
        let ang = o * spec.spread + early * spec.bias;                  // early (negative) pulls left, late pushes right
        let speed = lerp(spec.v0, spec.v1, q) + speedOf(p) * 0.35 * (swing.type === 'block' ? 0 : 1);
        let elev = lerp(spec.e1, spec.e0, q);
        let edge = false;
        if (q < 0.22 && swing.type !== 'block') {
          edge = true;
          const side = r.next() < 0.5 ? -1 : 1;
          ang += side * (35 + r.next() * 30);
          speed *= 0.62; elev += 18 + r.next() * 14;
        }
        const a = ang * RAD, e = clamp(elev, 0, 75) * RAD;
        const ball = { x: b.x, y: b.y, z: Math.max(0.15, b.z), vx: Math.sin(a) * Math.cos(e) * speed, vy: Math.cos(a) * Math.cos(e) * speed, vz: Math.sin(e) * speed };
        return { kind: 'hit', q, edge, ang, shot: swing.type, speed, elev, dt: d, ball, at: swing.t };
      }
    }
  }
  // no valid swing: a parked paddle stops the ball dead
  if (covers(arr.x, arr.z)) return { kind: 'blocked', at: p.tArr, ball: arr, passive: true };
  if (hitsBoard(p)) return { kind: 'bowled', at: p.T, ball: ballAt(p, p.T), swung: !!swing };
  return { kind: 'passed', at: p.T, ball: ballAt(p, p.T), swung: !!swing };
}

// ---- the field -------------------------------------------------------------------------------------------------------
export function fieldSet(id, side = 1) {
  const spec = FIELD_SETS.find((f) => f.id === id) || FIELD_SETS[1];
  const out = [{ x: -0.6 * side, y: BOWL_Y - 0.5 }];   // the bowler
  FIELD_ANG.forEach((a, i) => {
    const rr = spec.r * (i % 2 ? 1.12 : 0.92), an = a * RAD * side;
    out.push({ x: Math.sin(an) * rr, y: STRIKE_Y + 2 + Math.cos(an) * rr * 0.9 });
  });
  return out.map((p) => ({ x: clamp(p.x, -FIELD_R + 2, FIELD_R - 2), y: clamp(p.y, FIELD_C.y - FIELD_R + 2, FIELD_C.y + FIELD_R - 2) }));
}
export const inField = (x, y) => Math.hypot(x - FIELD_C.x, y - FIELD_C.y) < FIELD_R;
export const batY = (b, frac) => lerp(END_Y[b.end], END_Y[1 - b.end], frac);

// A fresh in-field situation. hit = the strike result's ball (or null for a dead ball).
export function newField(setId, level, ball, fieldRng) {
  const pos = fieldSet(setId);
  const lv = LEVELS[level];
  const F = {
    t: 0, level, over: false, outcome: null, deadT: 0, planT: 0, plan: null, land: null,
    ball: { ...ball, bounces: 0, air: true, held: -1, thrown: false, sinceHit: true, last: -1 },
    fielders: pos.map((p, i) => ({ id: i, x: p.x, y: p.y, hx: p.x, hy: p.y, tx: p.x, ty: p.y, vx: 0, vy: 0, face: 0, act: 'idle', fumble: 0, hold: 0, reactT: lv.field.react, speed: lv.field.speed * (i === 0 ? 0.92 : 1) })),
    bats: [{ end: 0 }, { end: 1 }],
    run: { moving: false, frac: 0, dir: 1, done: 0 },
    events: [], boundary: 0, runs: 0,
  };
  Object.defineProperty(F, 'rng', { value: fieldRng, enumerable: false });
  return F;
}
const ev = (F, type, extra = {}) => { F.events.push({ type, t: F.t, ...extra }); if (F.events.length > 40) F.events.shift(); };

// tap on RUN: start a run, or turn back when one is under way
export function tapRun(F) {
  if (F.over) return false;
  const R = F.run;
  if (!R.moving) { R.moving = true; R.dir = 1; R.frac = Math.max(R.frac, 0); ev(F, 'run-start'); return true; }
  R.dir = -R.dir; ev(F, 'run-turn');
  return true;
}
export const runnersHome = (F) => !F.run.moving && F.run.frac <= 0;

// where the ball will be (predicted), as sampled points
function predict(F) {
  const b = F.ball, pts = [];
  let x = b.x, y = b.y, z = b.z, vx = b.vx, vy = b.vy, vz = b.vz, bn = b.bounces, t = 0;
  for (let i = 0; i < 90; i++) {
    t += 0.05;
    vz -= G * 0.05; x += vx * 0.05; y += vy * 0.05; z += vz * 0.05;
    if (z < 0) { z = 0; if (vz < -1) { vz = -vz * 0.45; vx *= 0.8; vy *= 0.8; bn++; } else vz = 0; }
    if (z === 0) { const sp = Math.hypot(vx, vy); if (sp > 0) { const ns = Math.max(0, sp - (0.6 + 0.35 * sp) * 0.05); vx *= ns / sp; vy *= ns / sp; } }
    pts.push({ t, x, y, z, bn });
    if (z === 0 && vx === 0 && vy === 0) break;
    if (!inField(x, y)) break;
  }
  return pts;
}
function planChase(F) {
  const b = F.ball;
  if (b.held >= 0) { F.plan = null; F.land = null; return; }
  const pts = predict(F);
  // where an airborne ball first comes down (drawn as a mark on the grass)
  F.land = null;
  if (b.z > 0.3) { const lp = pts.find((p) => p.z <= 0.02); if (lp) F.land = { x: lp.x, y: lp.y, t: lp.t }; }
  let best = null;
  F.fielders.forEach((f) => {
    if (f.fumble > 0 || f.act === 'hold') return;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      if (p.z > 2.0) continue;
      const need = Math.hypot(p.x - f.x, p.y - f.y) / f.speed + Math.max(0, f.reactT - F.t);
      if (need <= p.t + 0.05) { if (!best || p.t < best.t) best = { id: f.id, t: p.t, x: p.x, y: p.y, z: p.z, catchable: p.z > 0.2 && p.bn === 0 }; return; }
    }
  });
  if (!best) {
    // nobody can get there in time: the nearest fielder runs to where the ball stops
    const end = pts[pts.length - 1] || { x: b.x, y: b.y, t: 0 };
    let nb = null;
    F.fielders.forEach((f) => { if (f.fumble > 0 || f.act === 'hold') return; const d = Math.hypot(end.x - f.x, end.y - f.y); if (!nb || d < nb.d) nb = { d, id: f.id }; });
    if (nb) { const f = F.fielders[nb.id]; best = { id: nb.id, t: end.t + nb.d / f.speed, x: end.x, y: end.y, z: 0, catchable: false, late: true }; }
  }
  F.plan = best;
}

// Time until the ball can be at the board of end e (retrieve + throw), used by the runners and the margin gauge.
export function retrieveTime(F, e) {
  const b = F.ball;
  const by = e === 0 ? 0 : PITCH;
  if (b.held >= 0) { const f = F.fielders[b.held]; return 0.2 + Math.hypot(f.x, f.y - by) / THROW_SPEED; }
  const p = F.plan;
  if (!p) return 3;
  return p.t + 0.25 + Math.hypot(p.x, p.y - by) / THROW_SPEED;
}
// Seconds of margin for the run in front of the batters (positive = the ball cannot beat them to a board).
export function runMargin(F) {
  const R = F.run;
  const remain = R.moving ? (R.dir > 0 ? 1 - R.frac : R.frac) : 1;
  return Math.min(retrieveTime(F, 0), retrieveTime(F, 1)) - (remain * RUN_LEN) / RUN_SPEED;
}

const board = (e) => ({ x: 0, y: e === 0 ? 0 : PITCH });
// ---- stepping the field ----------------------------------------------------------------------------------------------
// ai = { runs: bool } when true the computer decides the runs too.
export function stepField(F, dt, ai) {
  if (F.over) return;
  F.t += dt;
  const lv = LEVELS[F.level], b = F.ball, R = F.run;
  // --- the ball
  if (b.held >= 0) {
    const f = F.fielders[b.held];
    b.x = f.x; b.y = f.y; b.z = 1.0; b.vx = 0; b.vy = 0; b.vz = 0;
  } else {
    const py = b.y, px = b.x;
    b.vz -= G * dt;
    b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
    if (b.z < 0) {
      b.z = 0;
      if (b.vz < -1.2) { b.vz = -b.vz * 0.45; b.vx *= 0.8; b.vy *= 0.8; b.bounces++; b.air = false; ev(F, 'bounce', { x: b.x, y: b.y }); }
      else b.vz = 0;
    }
    if (b.z === 0) {
      b.air = false;
      const sp = Math.hypot(b.vx, b.vy);
      if (sp > 0) { const ns = Math.max(0, sp - (0.6 + 0.35 * sp) * dt); b.vx *= ns / sp; b.vy *= ns / sp; if (ns < 0.05) { b.vx = 0; b.vy = 0; } }
    }
    // crossing a board plane
    for (let e = 0; e < 2; e++) {
      const by = e === 0 ? 0 : PITCH;
      if ((py - by) * (b.y - by) < 0) {
        const u = (by - py) / (b.y - py || 1), x = lerp(px, b.x, clamp(u, 0, 1));
        if (Math.abs(x) <= BOARD_W + BALL_R && b.z <= BOARD_TOP) { boardHit(F, e); break; }
      }
    }
    // the rope
    if (!inField(b.x, b.y) && !F.over) {
      const six = b.bounces === 0 && b.sinceHit;
      F.boundary = six ? 6 : 4;
      ev(F, six ? 'six' : 'four', { x: b.x, y: b.y });
      finish(F, six ? 'six' : b.sinceHit ? 'four' : 'overthrow');
      return;
    }
  }
  // --- planning the chase twice a tenth of a second
  F.planT -= dt;
  if (F.planT <= 0) { F.planT = 0.1; planChase(F); }
  // --- catches
  if (b.held < 0 && b.sinceHit && !b.dropped && b.bounces === 0 && b.z > 0.2 && b.z < 2.2 && b.vz !== 0) {
    for (const f of F.fielders) {
      if (f.fumble > 0 || f.tried) continue;
      if (Math.hypot(f.x - b.x, f.y - b.y) < 0.85) {
        f.tried = true;
        const sp = Math.hypot(b.vx, b.vy, b.vz);
        const pc = clamp((lv.field.catch - (b.z < 0.45 ? 0.12 : 0)) * clamp(1 - (sp - 11) / 11, 0.06, 1), 0.04, 0.95);
        if (F.rng.next() < pc) { ev(F, 'catch', { x: f.x, y: f.y, id: f.id }); b.held = f.id; f.act = 'hold'; f.hold = 0; finish(F, 'caught', { by: f.id }); return; }
        ev(F, 'drop', { x: f.x, y: f.y, id: f.id }); b.dropped = true; f.fumble = 0.8; b.vx *= 0.4; b.vy *= 0.4; b.vz = Math.min(b.vz, 0) - 1;
      }
    }
  }
  // --- fielders
  for (const f of F.fielders) {
    if (f.fumble > 0) f.fumble = Math.max(0, f.fumble - dt);
    let tx = f.hx, ty = f.hy, sp = f.speed * 0.7;
    if (F.plan && F.plan.id === f.id && b.held < 0) { tx = F.plan.x; ty = F.plan.y; sp = f.speed; }
    else if (F.plan && b.held < 0) { tx = lerp(f.hx, F.plan.x, 0.18); ty = lerp(f.hy, F.plan.y, 0.18); }
    if (b.held === f.id) { tx = f.x; ty = f.y; }
    if (F.t < f.reactT && F.plan && F.plan.id === f.id) { tx = f.x; ty = f.y; }
    const dx = tx - f.x, dy = ty - f.y, d = Math.hypot(dx, dy);
    if (d > 0.05 && f.fumble <= 0) {
      const step = Math.min(d, sp * dt);
      f.x += (dx / d) * step; f.y += (dy / d) * step; f.walk = (f.walk || 0) + step; f.vx = (dx / d) * sp; f.vy = (dy / d) * sp; f.face = Math.atan2(dx, dy);
    } else { f.vx = 0; f.vy = 0; }
    // pick up
    if (b.held < 0 && f.fumble <= 0 && b.z < 0.6 && !b.thrown && Math.hypot(b.vx, b.vy) < 14 && Math.hypot(f.x - b.x, f.y - b.y) < 0.75) {
      b.held = f.id; f.act = 'hold'; f.hold = 0; b.thrown = false; ev(F, 'pickup', { x: f.x, y: f.y, id: f.id });
    } else if (b.held < 0 && b.thrown && b.z < 0.9 && Math.hypot(b.vx, b.vy) < 9 && Math.hypot(f.x - b.x, f.y - b.y) < 0.75 && f.fumble <= 0) {
      b.held = f.id; f.act = 'hold'; f.hold = 0; b.thrown = false; ev(F, 'pickup', { x: f.x, y: f.y, id: f.id });
    }
  }
  // --- the runners
  if (R.moving) {
    R.frac += R.dir * (RUN_SPEED / RUN_LEN) * dt;
    if (R.frac >= 1) {
      R.frac = 0; R.moving = false; R.dir = 1; R.done += 1;
      F.bats.forEach((bt) => { bt.end = 1 - bt.end; });
      F.runs = R.done;
      ev(F, 'run-done', { n: R.done });
    } else if (R.frac <= 0) { R.frac = 0; R.moving = false; R.dir = 1; ev(F, 'run-back'); }
  }
  if (ai && ai.runs) {
    const w = runWant(F, ai.risk ?? 0.5);
    if ((w === 'go' && !R.moving) || (w === 'turn' && R.moving && !(F.run._lastTurn > F.t - 0.7))) { if (w === 'turn') F.run._lastTurn = F.t; tapRun(F); }
  }
  // --- holding fielders throw or the ball goes dead
  if (b.held >= 0 && !F.over) {
    const f = F.fielders[b.held];
    f.hold += dt;
    if (R.moving) {
      if (f.hold >= 0.18) throwAtBoard(F, f);
    } else if (f.hold >= 0.45) finish(F, 'dead');
  }
  // a ball that has stopped with nobody on it for long ends the play
  if (b.held < 0 && Math.hypot(b.vx, b.vy) < 0.05 && b.z === 0) { F.deadT += dt; if (F.deadT > 9) finish(F, 'dead'); } else F.deadT = 0;
  if (F.t > 60 && !F.over) finish(F, 'dead');
  for (const f of F.fielders) if (f.tried && (F.ball.z === 0 || F.ball.held >= 0)) f.tried = false;
}

function throwAtBoard(F, f) {
  const R = F.run, b = F.ball;
  // run progress: each batter heads to the end it did not start at (dir > 0) or back to its own (dir < 0)
  // the end that needs the ball first: the one whose batter is furthest from arriving
  let e;
  if (R.dir > 0) {
    // all batters go towards the opposite end: batter at end 0 goes to 1 and vice versa. Both are equally far; pick the nearer board.
    e = Math.hypot(f.x, f.y - 0) <= Math.hypot(f.x, f.y - PITCH) ? 0 : 1;
  } else e = Math.hypot(f.x, f.y - 0) <= Math.hypot(f.x, f.y - PITCH) ? 0 : 1;
  const bd = board(e), d = Math.hypot(bd.x - f.x, bd.y - f.y), lv = LEVELS[F.level];
  const sig = lv.field.throwSig * (0.5 + d / 12);
  const err = gauss(F.rng) * sig, errH = gauss(F.rng) * sig * 0.5;
  const dir = Math.atan2(bd.x + err - f.x, bd.y - f.y), sp = THROW_SPEED;
  const tt = d / sp;
  b.x = f.x; b.y = f.y; b.z = 1.1; b.vx = Math.sin(dir) * sp; b.vy = Math.cos(dir) * sp;
  b.vz = (0.55 + errH - 1.1 + 0.5 * G * tt * tt) / Math.max(0.1, tt);
  b.vz = clamp(b.vz, -2, 8);
  b.thrown = true; b.sinceHit = false; b.bounces = 0; b.held = -1; b.last = f.id;
  f.act = 'idle'; f.fumble = 0.5; f.hold = 0;
  ev(F, 'throw', { x: f.x, y: f.y, e });
}

// the ball (thrown or struck) reaches a board
function boardHit(F, e) {
  const R = F.run, b = F.ball;
  ev(F, 'board', { e, x: b.x, y: b.y });
  // a batter running towards this end and not yet home is out
  let out = false;
  if (R.moving) {
    const heading = F.bats.some((bt) => (R.dir > 0 ? 1 - bt.end : bt.end) === e);
    if (heading) out = true;
  }
  if (out) { finish(F, 'runout', { end: e }); return; }
  // the striker's own board struck by the ball off the paddle, while the batters are home: bowled
  if (e === 0 && b.sinceHit && !b.thrown && runnersHome(F)) { finish(F, 'bowled', { off: 'paddle' }); return; }
  // otherwise it just stops
  b.vx *= 0.12; b.vy *= 0.12; b.vz = 0; b.thrown = false;
}

function finish(F, kind, extra = {}) {
  if (F.over) return;
  F.over = true;
  const R = F.run;
  const done = R.done;
  let runs = done;
  if (kind === 'four') runs = Math.max(done, 4);
  if (kind === 'six') runs = Math.max(done, 6);
  if (kind === 'overthrow') runs = done + 4;
  const wicket = kind === 'caught' || kind === 'runout' || kind === 'bowled';
  F.outcome = { kind, runs: wicket && kind === 'caught' ? done : runs, wicket, ...extra };
  // a runout keeps the completed runs; a catch cancels the run in progress but not the completed ones
  ev(F, 'over', { kind });
}

// ---- computer decisions ----------------------------------------------------------------------------------------------
// Should the computer batters go, hold or turn? risk 0..1 = appetite.
export function runWant(F, risk = 0.5) {
  const R = F.run, b = F.ball;
  if (F.over) return 'hold';
  if (b.held < 0 && b.air && b.bounces === 0 && F.plan && F.plan.catchable && !R.moving) return 'hold';
  const margin = -0.15 + risk * 0.5;
  if (!R.moving) {
    if (b.held >= 0 && F.fielders[b.held].hold > 0.0) return 'hold';
    const t = RUN_LEN / RUN_SPEED;
    const arrive = Math.min(retrieveTime(F, 0), retrieveTime(F, 1));
    return arrive > t + 0.35 - margin ? 'go' : 'hold';
  }
  const remain = (R.dir > 0 ? 1 - R.frac : R.frac) * RUN_LEN / RUN_SPEED;
  const arrive = Math.min(retrieveTime(F, 0), retrieveTime(F, 1));
  if (R.dir > 0 && R.frac < 0.55 && arrive < remain - 0.1 + margin * 0 - 0.1) return 'turn';
  return 'hold';
}

// Where each gap lies: the clearance (m) of a ground ball along angle `ang` (degrees from straight back) and how far it
// rolls before the rope. Used by the batter AI and the Think hint.
export function rayInfo(fielders, ang, minDist = 3) {
  const a = ang * RAD, dx = Math.sin(a), dy = Math.cos(a), ox = 0, oy = STRIKE_Y;
  let clear = 99;
  for (const f of fielders) {
    const rx = f.x - ox, ry = f.y - oy, along = rx * dx + ry * dy;
    if (along < minDist || along > 40) continue;
    const perp = Math.abs(rx * dy - ry * dx);
    clear = Math.min(clear, perp);
  }
  // distance to the rope along the ray
  let d = 0;
  for (let s = 2; s < 50; s += 1) if (!inField(ox + dx * s, oy + dy * s)) { d = s; break; }
  return { clear, rope: d };
}

// The best shot for this ball and field: the paddle position, the shot kind and the aimed angle.
export function adviceBat(path, fielders, ctx = {}, only = null) {
  const need = ctx.need ?? 0;                      // runs per ball needed (0 = free)
  const arr = ballAt(path, path.tArr);
  let best = null;
  for (const kind of (only ? [only] : ['drive', 'lift'])) {
    const spec = SHOTS[kind];
    for (let ang = -spec.spread; ang <= spec.spread; ang += 6) {
      const info = rayInfo(fielders.map((f) => ({ x: f.x, y: f.y })), ang, kind === 'lift' ? 14 : 3);
      let score;
      if (kind === 'drive') score = Math.min(info.clear, 9) * 1.0 + info.rope * 0.08 + (9 - Math.min(9, Math.abs(ang) / 8)) * 0.1;
      else score = Math.min(info.clear, 11) * 0.7 + info.rope * 0.16 - 3.2 + (need > 1.8 ? 2.5 : 0);   // a lofted shot pays only when the rope is far and no fielder is deep there
      if (!best || score > best.score) best = { kind, ang, score, clear: info.clear, rope: info.rope };
    }
  }
  const spec = SHOTS[best.kind];
  const o = clamp(best.ang / spec.spread, -1, 1);
  const awk = Math.abs(arr.z - 0.95) > 0.7 || Math.abs(arr.x) > 0.7;
  let kind = best.kind, ang = best.ang;
  if (awk && need < 2.5) { kind = 'block'; ang = 0; }
  const px = arr.x - (kind === 'block' ? 0 : o * PADDLE_R * 0.95);
  const why = kind === 'block' ? 'Awkward ball: park the paddle and block it dead.'
    : kind === 'lift' ? `Lift it: the rope is far ${ang < 0 ? 'on the left' : ang > 0 ? 'on the right' : 'straight back'} and the deep field is thin.`
      : `Drive it ${Math.abs(ang) < 8 ? 'straight back' : ang < 0 ? 'to the left' : 'to the right'}: there is a gap there.`;
  return { kind, ang, paddleX: clamp(px, -1.2, 1.2), why, clear: best.clear };
}

// The computer batter: paddle placement (with scatter), shot kind, swing time.
export function batterPlan(path, fielders, levelIdx, ctx, r) {
  const lv = LEVELS[levelIdx].bat;
  const adv = adviceBat(path, fielders, ctx);
  const arr = ballAt(path, path.tArr);
  const hard = 1 + 0.6 * clamp(Math.abs(arr.z - 0.95) / 0.8, 0, 1) + 0.4 * clamp(Math.abs(arr.x) / 0.9, 0, 1) + 0.4 * clamp((1.1 / path.T - 1), 0, 1.5);
  let kind = adv.kind;
  let adv2 = adv;
  if (kind === 'lift' && r.next() > lv.risk + (ctx.need > 2 ? 0.35 : 0)) { kind = 'drive'; adv2 = adviceBat(path, fielders, ctx, 'drive'); }
  if (kind === 'drive' && r.next() < 0.1 * (2 - levelIdx * 0.6) && ctx.wkts >= 3) kind = 'block';
  const scatter = lv.px * hard * 0.9;
  const px = adv2.paddleX + gauss(r) * scatter;
  const lead = gauss(r) * lv.ts * hard;
  const swingT = path.tArr + lead;
  return { kind, paddleX: px, swingT, adv: adv2, hard };
}

// The computer bowler: a delivery that tests the batter. `bias` > 0 = more attacking (towards the board).
export function bowlerPlan(levelIdx, r, ctx = {}) {
  const lv = LEVELS[levelIdx].bowl;
  const attack = ctx.attack ?? 0.5;
  const line = (r.next() < 0.5 ? -1 : 1) * Math.pow(r.next(), 1.3) * lv.line * (1.1 - attack * 0.5);
  const ht = clamp(0.95 + gauss(r) * lv.ht + (r.next() < 0.25 ? -0.45 : 0), 0.28, 1.65);
  const T = lv.paceLo + r.next() * (lv.paceHi - lv.paceLo);
  const bounce = ht < 1.15 && r.next() < 0.5;
  const swing = (r.next() < 0.55 ? 1 : -1) * r.next() * (0.1 + levelIdx * 0.1);
  return { aimX: clamp(line, -0.9, 0.9), aimH: ht, T, bounce, swing };
}
// Human bowling: choices -> a delivery (accuracy scatter grows with pace and awkward aims)
export function humanDelivery(sel, r) {
  const pace = [1.34, 1.14, 0.96][sel.pace] ?? 1.14;
  const sig = 0.035 + 0.03 * sel.pace + (sel.bounce ? 0.025 : 0) + 0.02 * clamp(Math.abs(sel.aimX) / 0.5, 0, 1);
  const x = clamp(sel.aimX + gauss(r) * sig, -0.95, 0.95), h = clamp(sel.aimH + gauss(r) * sig * 1.2, 0.2, 1.75);
  const swing = [-0.22, 0, 0.22][sel.swing] ?? 0;
  return { aimX: x, aimH: h, T: pace, bounce: !!sel.bounce, swing };
}
// What a bowler should try against the computer batter now (Think hint and Watch & Learn)
export function adviceBowl(levelIdx, r, ctx = {}) {
  const pick = r.next() < 0.5 ? -1 : 1;
  const w = [0.2 + 0.2 * (ctx.wkts ?? 0) * 0.1, 0.3, 0.5][1];
  void w;
  const aimX = pick * (0.12 + r.next() * 0.1);
  const bounce = r.next() < 0.5;
  const aimH = bounce ? 0.35 + r.next() * 0.25 : 0.55 + r.next() * 0.3;
  const pace = r.next() < 0.5 ? 1 : 2;
  const swing = pick < 0 ? 2 : 0;
  return { aimX, aimH, pace, bounce, swing, why: `Aim ${pick < 0 ? 'just left' : 'just right'} of the board, ${aimH < 0.7 ? 'low' : 'at knee height'}, ${pace === 2 ? 'quick' : 'medium pace'}${bounce ? ' with a bounce' : ''}.` };
}
// The computer's choice of field for a delivery situation
export function pickFieldSet(levelIdx, situation, r) {
  const rate = situation.rate ?? 0;            // runs per ball the batters need or are making
  if (levelIdx === 0) return r.pick(['balanced', 'balanced', 'close', 'spread']);
  if (rate > 1.6) return 'spread';
  if (rate < 0.9 && situation.wktsLeft > 2) return r.pick(['close', 'balanced']);
  return r.pick(['balanced', 'balanced', levelIdx > 1 ? 'close' : 'spread']);
}

// How a finished ball reads in words
export function describe(res) {
  if (!res) return '';
  switch (res.kind) {
    case 'bowled': return 'Bowled!';
    case 'caught': return 'Caught!';
    case 'runout': return 'Run out!';
    case 'four': return 'FOUR';
    case 'overthrow': return `${res.runs} runs, overthrow`;
    case 'six': return 'SIX';
    default: return res.runs === 0 ? 'No run' : res.runs === 1 ? '1 run' : `${res.runs} runs`;
  }
}
export const oversText = (balls) => `${Math.floor(balls / BALLS_PER_OVER)}.${balls % BALLS_PER_OVER}`;

// A tiny seeded stream (mulberry32) for the daily knock: the same deliveries for everybody on the same day.
export function seeded(seed) {
  let a = (seed | 0) >>> 0;
  const next = () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  return { next, int: (n) => Math.floor(next() * n), range: (a2, b) => a2 + next() * (b - a2), chance: (p) => next() < p, pick: (arr) => arr[Math.floor(next() * arr.length)], fork: () => seeded(Math.floor(next() * 4294967296)) };
}
