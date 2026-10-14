// Lagori engine: pure and deterministic (no clock, randomness only from the rng handed in). One INNING is one team striking and
// the other fielding; the same engine runs both halves, whoever is human. Coordinates are canonical court units (720 x 960).
//
// Inning phases:
//   throw    the striking team throws the ball at the tower of seven stones (3 throws)
//   rebuild  stones are scattered; three runners rebuild the tower while the fielders throw at the active runner
//   done     inning.result is set
export const COURT = { w: 720, h: 960 };
export const TOWER = { x: 360, y: 292 };
export const SPOT = { x: 360, y: 318 };          // where a runner stands to drop a stone on the tower
export const LINE_Y = 812;                       // the line the runners start from
export const THROWER = { x: 360, y: 856 };       // where the striker's ball is thrown from
export const STONES = 7, THROWS = 3, RUNNERS = 3, INNINGS = 4;
export const BALL_R = 11, STONE_H = 13, RUNNER_R = 17;
export const REBUILD_TIME = 52;
export const FIELDER_SPEED = 780;                // fielder throw speed, units / s
export const DODGE_TIME = 0.34, DODGE_COOL = 1.35, DODGE_DIST = 76;
export const WALK = { x0: 44, x1: 676, y0: 118, y1: 880 };
export const stoneR = (i) => 31 - i * 2.4;

// Computer behaviour per level. windup = telegraph seconds, cadence = pause after the fielders regain the ball,
// noise = throw aim error (units), dodge = chance the computer runner dodges a lethal throw, strikeErr = throw spread multiplier.
export const LEVELS = [
  { name: 'Street', windup: 1.05, cadence: 1.55, noise: 38, dodge: 0.32, react: 0.30, strikeErr: 1.45, speed: 168 },
  { name: 'Neighbourhood', windup: 0.88, cadence: 1.2, noise: 22, dodge: 0.58, react: 0.24, strikeErr: 1.05, speed: 182 },
  { name: 'Champion', windup: 0.74, cadence: 0.92, noise: 11, dodge: 0.82, react: 0.19, strikeErr: 0.75, speed: 196 },
];
export const HUMAN_SPEED = 185;
const G = 1500, FLIGHT = 0.7;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);

export function newInning(rng, { level = 1, strikerIsHuman = true, humanFields = null } = {}) {
  const jitter = () => rng.range(-14, 14);
  return {
    phase: 'throw', t: 0, clock: 0, level, strikerIsHuman, aiField: !!strikerIsHuman, aiBuild: !strikerIsHuman, autoPlan: false, auto: false,
    throwsLeft: THROWS, throwGap: 0, hits: 0, placed: 0, standing: true, result: null,
    ball: { x: THROWER.x, y: THROWER.y, z: 0, vx: 0, vy: 0, vz: 0, mode: 'held', age: 0, holder: -1, tx: 0, ty: 0, past: 0 },
    stones: Array.from({ length: STONES }, (_, i) => ({ i, x: TOWER.x, y: TOWER.y, vx: 0, vy: 0, state: 'tower', rot: rng.range(-0.35, 0.35), by: -1 })),
    runners: Array.from({ length: RUNNERS }, (_, k) => ({ id: k, x: 110 + k * 56, y: LINE_Y + 38, vx: 0, vy: 0, face: -1, state: k === 0 ? 'run' : 'wait', dodge: 0, cool: 0, dvx: 0, dvy: 0, queue: [], carry: -1, phase: 0, react: -1, ready: 0 })),
    active: 0, enterIn: 0,
    fielders: [{ x: 128 + jitter(), y: 470 + jitter(), face: 1, anim: 0 }, { x: 592 + jitter(), y: 470 + jitter(), face: -1, anim: 1.3 }, { x: 360 + jitter(), y: 126, face: 1, anim: 2.1 }, { x: 250 + jitter(), y: 640 + jitter(), face: 1, anim: 0.7 }],
    holder: 2, fcool: 0, wind: null, aimHold: 0,
    ev: [], fx: [], strikeFrom: THROWER, last: null,
  };
}

// ------------------------------------------------------------------ the throw at the tower
// (tx, ty) is where the thrower AIMS the ball to land; the actual landing is off by a small error disc that grows with distance.
export function throwAtTower(inn, rng, tx, ty, errMul = 1) {
  const b = inn.ball;
  if (inn.phase !== 'throw' || b.mode !== 'held' || inn.throwsLeft <= 0) return false;
  const d = dist(THROWER.x, THROWER.y, tx, ty), er = (8 + d * 0.042) * errMul, a = rng.range(0, Math.PI * 2), rr = Math.sqrt(rng.next()) * er;
  const lx = clamp(tx + Math.cos(a) * rr, 30, COURT.w - 30), ly = clamp(ty + Math.sin(a) * rr, 40, COURT.h - 40);
  Object.assign(b, { x: THROWER.x, y: THROWER.y - 18, z: 34, vx: (lx - THROWER.x) / FLIGHT, vy: (ly - (THROWER.y - 18)) / FLIGHT, vz: G * FLIGHT / 2 - 34 / FLIGHT, mode: 'flight', age: 0, spread: er });
  inn.ev.push({ t: 'throw', x: THROWER.x, y: THROWER.y });
  inn.last = { x: lx, y: ly, er };
  return true;
}
export const landingError = (tx, ty, errMul = 1) => (8 + dist(THROWER.x, THROWER.y, tx, ty) * 0.042) * errMul;

function knockTower(inn, rng) {
  const b = inn.ball, sp = Math.hypot(b.vx, b.vy), dir = Math.atan2(b.vy, b.vx) || -Math.PI / 2;
  inn.standing = false; inn.phase = 'rebuild'; inn.t = 0; inn.fcool = 1.1; inn.enterIn = 0;
  for (const s of inn.stones) {
    const a = dir + rng.range(-1.7, 1.7), v = (70 + sp * 0.34) * rng.range(0.55, 1.15) * (1.05 - s.i * 0.04);
    s.state = 'ground'; s.vx = Math.cos(a) * v; s.vy = Math.sin(a) * v; s.x = TOWER.x + Math.cos(a) * 6; s.y = TOWER.y + Math.sin(a) * 6; s.rot += rng.range(-0.7, 0.7);
  }
  b.vx *= 0.3; b.vy *= 0.3; b.mode = 'roll'; b.z = Math.min(b.z, 30);
  inn.ev.push({ t: 'knock', x: TOWER.x, y: TOWER.y, speed: sp });
}

// ------------------------------------------------------------------ the rebuild
export const activeRunner = (inn) => inn.runners[inn.active] ?? null;
const speedOf = (inn) => (inn.strikerIsHuman ? HUMAN_SPEED : LEVELS[inn.level].speed);
export function groundStones(inn) { return inn.stones.filter((s) => s.state === 'ground'); }
export function queueStone(inn, i) {
  const r = activeRunner(inn), s = inn.stones[i];
  if (!r || r.state !== 'run' || !s || s.state !== 'ground' || r.queue.includes(i) || r.carry === i || r.queue.length >= 4) return false;
  r.queue.push(i); return true;
}
// Nearest-first order from a point (used by the helpers, the computer and Auto Play).
export function planOrder(inn, fromX, fromY) {
  const left = groundStones(inn).map((s) => s.i), out = []; let x = fromX, y = fromY;
  while (left.length) { let bi = 0, bd = 1e9; left.forEach((i, k) => { const s = inn.stones[i], d = dist(x, y, s.x, s.y) + dist(s.x, s.y, SPOT.x, SPOT.y) * 0.6; if (d < bd) { bd = d; bi = k; } }); const i = left.splice(bi, 1)[0]; out.push(i); x = inn.stones[i].x; y = inn.stones[i].y; }
  return out;
}

export function dodge(inn, r, dx = 0, dy = 0) {
  if (!r || r.state !== 'run' || r.dodge > 0 || r.cool > 0) return false;
  let ux = dx, uy = dy; const b = inn.ball;
  if (!ux && !uy) {
    if (b.mode === 'flight' && b.hit) { const bs = Math.hypot(b.vx, b.vy) || 1, nx = -b.vy / bs, ny = b.vx / bs, side = (r.x - b.x) * nx + (r.y - b.y) * ny >= 0 ? 1 : -1; ux = nx * side; uy = ny * side; }
    else { ux = r.x > COURT.w / 2 ? -1 : 1; uy = 0; }
  }
  const l = Math.hypot(ux, uy) || 1; r.dvx = ux / l * DODGE_DIST / DODGE_TIME; r.dvy = uy / l * DODGE_DIST / DODGE_TIME; r.dodge = DODGE_TIME; r.cool = DODGE_COOL;
  inn.ev.push({ t: 'dodge', x: r.x, y: r.y, id: r.id });
  return true;
}

function stepRunner(inn, r, dt) {
  const sp = speedOf(inn) * (r.carry >= 0 ? 0.9 : 1);
  r.cool = Math.max(0, r.cool - dt);
  let tx = null, ty = null;
  if (r.dodge > 0) { r.dodge -= dt; r.x += r.dvx * dt; r.y += r.dvy * dt; r.vx = r.dvx; r.vy = r.dvy; }
  else {
    if (r.carry >= 0) { tx = SPOT.x; ty = SPOT.y; }
    else { while (r.queue.length && inn.stones[r.queue[0]].state !== 'ground') r.queue.shift(); if (r.queue.length) { const s = inn.stones[r.queue[0]]; tx = s.x; ty = s.y; } }
    if (tx !== null) {
      const d = dist(r.x, r.y, tx, ty), step = Math.min(d, sp * dt);
      if (d > 0.5) { r.vx = (tx - r.x) / d * sp; r.vy = (ty - r.y) / d * sp; r.x += (tx - r.x) / d * step; r.y += (ty - r.y) / d * step; if (Math.abs(tx - r.x) > 3) r.face = tx > r.x ? 1 : -1; }
      if (dist(r.x, r.y, tx, ty) < 7) {
        if (r.carry >= 0) { const s = inn.stones[r.carry]; s.state = 'placed'; s.x = TOWER.x; s.y = TOWER.y; inn.placed += 1; inn.ev.push({ t: 'place', i: s.i, n: inn.placed, x: TOWER.x, y: TOWER.y }); r.carry = -1; }
        else { const i = r.queue.shift(), s = inn.stones[i]; s.state = 'carried'; s.by = r.id; r.carry = i; inn.ev.push({ t: 'pick', i, x: s.x, y: s.y }); }
      }
    } else { r.vx *= 0.8; r.vy *= 0.8; }
  }
  r.x = clamp(r.x, WALK.x0, WALK.x1); r.y = clamp(r.y, WALK.y0, WALK.y1 + 30);
  r.phase += Math.hypot(r.vx, r.vy) * dt * 0.06;
  if (tx === null && r.dodge <= 0) { r.vx = 0; r.vy = 0; }
}

function runnerOut(inn, r) {
  r.state = 'out'; r.dodge = 0; r.queue = []; inn.hits += 1;
  if (r.carry >= 0) { const s = inn.stones[r.carry]; s.state = 'ground'; s.x = r.x; s.y = r.y; s.vx = 0; s.vy = 0; r.carry = -1; }
  inn.ev.push({ t: 'out', x: r.x, y: r.y, id: r.id });
  const next = inn.runners.findIndex((q) => q.state === 'wait');
  if (inn.active === r.id) { if (next >= 0) inn.enterIn = 0.9; }
}

// Where the active runner will be after `t` seconds, as the fielders see it (the lead point of a throw).
export function predictRunner(inn, r, t) {
  let tx = null, ty = null;
  if (r.dodge > 0) return { x: r.x + r.dvx * Math.min(t, r.dodge), y: r.y + r.dvy * Math.min(t, r.dodge) };
  if (r.carry >= 0) { tx = SPOT.x; ty = SPOT.y; } else if (r.queue.length) { const s = inn.stones[r.queue[0]]; if (s && s.state === 'ground') { tx = s.x; ty = s.y; } }
  if (tx === null) return { x: r.x, y: r.y };
  const sp = speedOf(inn) * (r.carry >= 0 ? 0.9 : 1), d = dist(r.x, r.y, tx, ty), m = Math.min(d, sp * t);
  return d < 1 ? { x: r.x, y: r.y } : { x: r.x + (tx - r.x) / d * m, y: r.y + (ty - r.y) / d * m };
}

// ------------------------------------------------------------------ the fielders' throw
export function holderPos(inn) { return inn.fielders[inn.holder] ?? inn.fielders[0]; }
export function fielderReady(inn) { return inn.phase === 'rebuild' && inn.ball.mode === 'held' && inn.fcool <= 0 && !inn.wind && !!activeRunner(inn) && activeRunner(inn).state === 'run' && !inn.result; }
export function throwAtRunner(inn, rng, tx, ty, noise) {
  const b = inn.ball, h = holderPos(inn);
  if (b.mode !== 'held') return false;
  const a = rng.range(0, Math.PI * 2), rr = Math.sqrt(rng.next()) * noise, x1 = tx + Math.cos(a) * rr, y1 = ty + Math.sin(a) * rr, d = dist(h.x, h.y, x1, y1) || 1;
  Object.assign(b, { x: h.x, y: h.y, z: 26, vx: (x1 - h.x) / d * FIELDER_SPEED, vy: (y1 - h.y) / d * FIELDER_SPEED, vz: 0, mode: 'flight', age: 0, hit: true, tx: x1, ty: y1, past: 0 });
  h.face = x1 > h.x ? 1 : -1; h.throwAnim = 0.35;
  inn.wind = null; inn.ev.push({ t: 'fthrow', x: h.x, y: h.y, tx: x1, ty: y1 });
  return true;
}
// The computer's own wind-up: telegraph, track, lock, release.
function stepWind(inn, rng, dt) {
  const r = activeRunner(inn), L = LEVELS[inn.level], w = inn.wind, h = holderPos(inn);
  if (!w) return;
  w.t += dt;
  const dd = dist(h.x, h.y, r.x, r.y), flight = dd / FIELDER_SPEED;
  if (w.t < w.dur - 0.28) { const p = predictRunner(inn, r, flight); w.x = p.x; w.y = p.y; }
  w.locked = w.t >= w.dur - 0.28;
  if (w.t >= w.dur) throwAtRunner(inn, rng, w.x, w.y, w.noise ?? L.noise);
}

// ------------------------------------------------------------------ one fixed step
export function stepInning(inn, rng, dt) {
  if (inn.result) return;
  inn.t += dt;
  const b = inn.ball;
  for (const f of inn.fielders) { f.anim += dt; if (f.throwAnim > 0) f.throwAnim -= dt; }
  // ---- the ball
  if (b.mode === 'flight' || b.mode === 'roll') {
    b.age += dt;
    if (b.hit) {   // a fielder's throw: straight and fast, it runs on past its target a little, then drops
      b.x += b.vx * dt; b.y += b.vy * dt; b.z = 26 + Math.sin(b.age * 5) * 2;
      if (dist(b.x, b.y, b.tx, b.ty) < 14 || b.past > 0) b.past += dt;
      for (const r of inn.runners) {
        if (r.state === 'run' && r.dodge <= 0 && dist(b.x, b.y, r.x, r.y) < BALL_R + RUNNER_R) { runnerOut(inn, r); b.hit = false; b.mode = 'roll'; b.vx *= 0.15; b.vy *= 0.15; break; }
      }
      if (b.hit && (b.past > 0.3 || b.x < 6 || b.x > COURT.w - 6 || b.y < 6 || b.y > COURT.h - 6)) { b.hit = false; b.mode = 'roll'; b.vx *= 0.25; b.vy *= 0.25; inn.ev.push({ t: 'miss', x: b.x, y: b.y }); }
    } else {
      b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt; b.vz -= G * dt;
      if (b.z <= 0) { b.z = 0; if (b.vz < -140) { b.vz = -b.vz * 0.4; b.vx *= 0.78; b.vy *= 0.78; inn.ev.push({ t: 'bounce', x: b.x, y: b.y, v: -b.vz }); } else { b.vz = 0; b.mode = 'roll'; } }
      if (b.mode === 'roll' || b.z === 0) { const k = Math.exp(-1.5 * dt); b.vx *= k; b.vy *= k; }
      if (b.x < 14) { b.x = 14; b.vx = Math.abs(b.vx) * 0.5; } if (b.x > COURT.w - 14) { b.x = COURT.w - 14; b.vx = -Math.abs(b.vx) * 0.5; }
      if (b.y < 14) { b.y = 14; b.vy = Math.abs(b.vy) * 0.5; } if (b.y > COURT.h - 14) { b.y = COURT.h - 14; b.vy = -Math.abs(b.vy) * 0.5; }
      if (inn.standing && dist(b.x, b.y, TOWER.x, TOWER.y) < stoneR(0) + BALL_R + 3 && b.z < STONE_H * STONES + 10) knockTower(inn, rng);
    }
    if (b.mode === 'roll' && Math.hypot(b.vx, b.vy) < 14 && b.z === 0) { b.mode = 'rest'; b.vx = 0; b.vy = 0; b.age = 0; }
  } else if (b.mode === 'rest') {
    b.age += dt;
    if (inn.phase === 'throw') {
      if (b.age > 0.7) { inn.throwsLeft -= 1; if (inn.throwsLeft <= 0) return finish(inn, 'standing'); Object.assign(b, { mode: 'held', x: THROWER.x, y: THROWER.y, z: 0, vx: 0, vy: 0, age: 0 }); inn.ev.push({ t: 'again' }); }
    } else if (b.age > 0.45) {   // loose ball: the nearest fielder fetches it
      let bi = 0, bd = 1e9; inn.fielders.forEach((f, k) => { const d = dist(f.x, f.y, b.x, b.y); if (d < bd) { bd = d; bi = k; } });
      inn.holder = bi; b.mode = 'pass'; b.age = 0;
    }
  } else if (b.mode === 'pass') {
    const h = holderPos(inn), d = dist(b.x, b.y, h.x, h.y), st = 520 * dt;
    if (d <= st) { b.mode = 'held'; b.x = h.x; b.y = h.y; b.z = 0; b.vx = b.vy = 0; inn.fcool = LEVELS[inn.level].cadence; inn.ev.push({ t: 'catch', x: h.x, y: h.y }); }
    else { b.x += (h.x - b.x) / d * st; b.y += (h.y - b.y) / d * st; b.z = 16 + Math.sin(b.age * 9) * 3; b.age += dt; }
  } else if (b.mode === 'held' && inn.phase === 'rebuild') { const h = holderPos(inn); b.x = h.x; b.y = h.y; }

  if (inn.phase !== 'rebuild') { for (const s of inn.stones) if (s.state === 'tower') { s.x = TOWER.x; s.y = TOWER.y; } return; }

  // ---- stones slide to rest
  for (const s of inn.stones) if (s.state === 'ground' && (s.vx || s.vy)) {
    const k = Math.exp(-2.1 * dt); s.vx *= k; s.vy *= k; s.x += s.vx * dt; s.y += s.vy * dt;
    if (s.x < WALK.x0 || s.x > WALK.x1) { s.x = clamp(s.x, WALK.x0, WALK.x1); s.vx *= -0.4; }
    if (s.y < WALK.y0 || s.y > WALK.y1 - 30) { s.y = clamp(s.y, WALK.y0, WALK.y1 - 30); s.vy *= -0.4; }
    if (Math.hypot(s.vx, s.vy) < 5) { s.vx = 0; s.vy = 0; }
  }
  inn.clock += dt;
  // ---- runners
  const act = activeRunner(inn);
  if (inn.enterIn > 0) { inn.enterIn -= dt; if (inn.enterIn <= 0) { const k = inn.runners.findIndex((q) => q.state === 'wait'); if (k >= 0) { inn.runners[k].state = 'run'; inn.active = k; inn.runners[k].x = 190; inn.runners[k].y = LINE_Y + 20; } } }
  for (const r of inn.runners) if (r.state === 'run') stepRunner(inn, r, dt);
  for (const s of inn.stones) if (s.state === 'carried') { const r = inn.runners[s.by]; if (r) { s.x = r.x; s.y = r.y - 30; } }
  // the computer builds: fetch the nearest stone, dodge a lethal throw by chance
  const r = activeRunner(inn);
  if (inn.aiBuild && r && r.state === 'run') {
    if (r.carry < 0 && r.queue.length === 0 && !inn.autoPlan) { r.ready += dt; if (r.ready > 0.25) { const o = planOrder(inn, r.x, r.y); if (o.length) r.queue.push(o[0]); r.ready = 0; } }
    const b2 = inn.ball;
    if (b2.mode === 'flight' && b2.hit && r.dodge <= 0 && r.cool <= 0) {
      const dd = dist(b2.x, b2.y, r.x, r.y), sp = Math.hypot(b2.vx, b2.vy) || 1, toward = ((r.x - b2.x) * b2.vx + (r.y - b2.y) * b2.vy) / (dd * sp || 1);
      if (toward > 0.5 && dd / sp < LEVELS[inn.level].react + 0.05 && dd / sp > 0.04) {
        if (r.react < 0) r.react = rng.next() < LEVELS[inn.level].dodge ? 1 : 0;
        if (r.react === 1) { dodge(inn, r); r.react = -1; }
      }
    } else if (b2.mode !== 'flight') r.react = -1;
  }
  // ---- the fielders
  if (inn.fcool > 0 && inn.ball.mode === 'held') inn.fcool -= dt;
  if (inn.aiField && fielderReady(inn)) {
    const L = LEVELS[inn.level], h = holderPos(inn), rr = activeRunner(inn);
    const p = predictRunner(inn, rr, dist(h.x, h.y, rr.x, rr.y) / FIELDER_SPEED);
    inn.wind = { t: 0, dur: L.windup, x: p.x, y: p.y, locked: false, noise: L.noise };
  }
  if (inn.wind) { if (!activeRunner(inn) || activeRunner(inn).state !== 'run') inn.wind = null; else stepWind(inn, rng, dt); }
  // ---- the end
  if (inn.placed >= STONES) return finish(inn, 'lagori');
  if (inn.runners.every((q) => q.state === 'out')) return finish(inn, 'allout');
  if (inn.clock >= REBUILD_TIME) return finish(inn, 'time');
}

function finish(inn, kind) {
  const strikerPts = kind === 'lagori' ? 1 + (inn.hits === 0 ? 1 : 0) : 0, fieldPts = kind === 'lagori' ? 0 : 1;
  inn.result = { kind, strikerPts, fieldPts, hits: inn.hits, placed: inn.placed, clean: kind === 'lagori' && inn.hits === 0 };
  inn.phase = 'done'; inn.wind = null; inn.ev.push({ t: 'end', kind });
}

// ------------------------------------------------------------------ the computer's choices
// Where the computer aims its tower throw: at the tower, sometimes a little short so the ball arrives softer (a tighter scatter).
export function aiStrikeAim(inn, rng) {
  const soft = rng.chance(0.45) ? rng.range(18, 46) : 0;
  return { x: TOWER.x + rng.range(-6, 6), y: TOWER.y + soft };
}
// A hint for the human: the same decision the computer would make.
export function hintFor(inn, rng) {
  if (inn.phase === 'throw') return { kind: 'throw', x: TOWER.x, y: TOWER.y + 24 };
  const r = activeRunner(inn);
  if (inn.strikerIsHuman) {
    if (r && r.carry < 0) { const o = planOrder(inn, r.x, r.y); return { kind: 'stone', i: o[0] ?? -1 }; }
    return { kind: 'wait' };
  }
  const h = holderPos(inn);
  if (r) { const p = predictRunner(inn, r, dist(h.x, h.y, r.x, r.y) / FIELDER_SPEED); return { kind: 'field', x: p.x, y: p.y }; }
  void rng; return { kind: 'wait' };
}

// ------------------------------------------------------------------ the match
export function newMatch() { return { n: 0, score: { H: 0, C: 0 }, log: [], over: null }; }
export const strikerOf = (n) => (n % 2 === 0 ? 'H' : 'C');
export function bookInning(m, inn) {
  const s = inn.strikerIsHuman ? 'H' : 'C', f = s === 'H' ? 'C' : 'H', r = inn.result;
  m.score[s] += r.strikerPts; m.score[f] += r.fieldPts; m.log.push({ striker: s, kind: r.kind, hits: r.hits, pts: [r.strikerPts, r.fieldPts] });
  m.n += 1;
  if (m.n >= INNINGS) m.over = { winner: m.score.H > m.score.C ? 'H' : m.score.C > m.score.H ? 'C' : 'draw' };
  return m;
}
