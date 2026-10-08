// Pond physics. World units: the rink is 510 wide and 900 long, origin at the centre. Side 0 (you) defends the goal at
// the bottom (y = +450) and attacks the top (y = -450); side 1 is the mirror. Everything here is pure and deterministic:
// a world is plain data, `stepWorld` advances it by a fixed step, and `cloneWorld` lets the computer and the aiming
// preview play a shot out on a copy. Random numbers are only used to scatter the snow drifts at a reset (the caller's rng).

export const HW = 255;            // half width of the ice
export const HH = 450;            // half length of the ice (the goal lines)
export const CORNER = 90;         // radius of the rounded corners
export const GOAL_HW = 74;        // half width of the goal mouth
export const NET_D = 46;          // depth of the net behind the goal line
export const POST_R = 9;
export const R_SKATER = 32;
export const R_PUCK = 13;
export const M_SKATER = 5;
export const M_PUCK = 1;
export const STEP = 1 / 120;      // physics step; the game runs two per frame
export const POWER = { min: 150, max: 960 };   // launch speed range of a skater (units per second)

const K_SKATER = 0.78;            // ice drag (1/s) of a skater
const K_PUCK = 0.42;
const C_SKATER = 26;              // constant (scrape) deceleration, units per second squared
const C_PUCK = 14;
const K_SNOW = 3.4;               // extra drag inside a drift
const REST_WALL_S = 0.55, REST_WALL_P = 0.84, REST_SP = 0.9, REST_SS = 0.72;
const STOP = 5;

// ---- worlds ------------------------------------------------------------------------------------------------------
const mk = (kind, side, idx, x, y) => ({ id: kind === 'puck' ? 'puck' : `s${side}${idx}`, kind, side, idx, x, y, vx: 0, vy: 0, r: kind === 'puck' ? R_PUCK : R_SKATER, m: kind === 'puck' ? M_PUCK : M_SKATER, face: side === 0 ? -Math.PI / 2 : Math.PI / 2, swing: 0, swingDir: 1, hit: 0, glide: 0 });

export const FORMATION = [[-118, 150], [118, 150], [0, 330]];   // side 0 (bottom half); side 1 mirrors it

export function createWorld() {
  const bodies = [mk('puck', -1, 0, 0, 0)];
  for (let side = 0; side < 2; side++) FORMATION.forEach(([x, y], i) => bodies.push(mk('skater', side, i, side === 0 ? x : -x, side === 0 ? y : -y)));
  return { bodies, snow: [], settled: true, time: 0, goal: null, shot: null, events: [] };
}

// Back to the kick-off spots with a fresh scatter of drifts.
export function resetWorld(w, rng) {
  const fresh = createWorld();
  w.bodies = fresh.bodies; w.goal = null; w.shot = null; w.settled = true; w.time = 0; w.events = [];
  w.snow = [];
  const n = rng ? rng.int(4) : 0;      // 0..3 drifts
  for (let tries = 0; w.snow.length < n && tries < 60; tries++) {
    const r = rng.range(52, 84), x = rng.range(-HW + r + 20, HW - r - 20), y = rng.range(-HH + 150, HH - 150);
    const ok = w.snow.every((s) => Math.hypot(s.x - x, s.y - y) > s.r + r + 24)
      && Math.hypot(x, y) > r + 70                                         // never on the puck
      && w.bodies.every((b) => b.kind === 'puck' || Math.hypot(b.x - x, b.y - y) > r + 12);   // nor on a starting skater
    if (ok) w.snow.push({ x, y, r, seed: rng.int(1000) });
  }
  return w;
}

export function cloneWorld(w) {
  return {
    bodies: w.bodies.map((b) => ({ ...b })), snow: w.snow, settled: w.settled, time: w.time, goal: w.goal ? { ...w.goal } : null, shot: w.shot, events: [],
  };
}
export const puckOf = (w) => w.bodies[0];
export const skatersOf = (w, side) => w.bodies.filter((b) => b.kind === 'skater' && b.side === side);
export const bodyById = (w, id) => w.bodies.find((b) => b.id === id);

// ---- launching ---------------------------------------------------------------------------------------------------
export const speedFor = (power) => POWER.min + (POWER.max - POWER.min) * Math.max(0, Math.min(1, power));
export function launch(w, id, ang, power) {
  const b = bodyById(w, id);
  const v = speedFor(power);
  b.vx = Math.cos(ang) * v; b.vy = Math.sin(ang) * v; b.face = ang;
  b.swing = 1; b.swingDir = 1;     // the stick comes through as the skater pushes off
  w.shot = id; w.settled = false; w.time = 0; w.goal = null;
}

// ---- stepping ----------------------------------------------------------------------------------------------------
const inSnow = (w, b) => { for (const s of w.snow) { if (Math.hypot(b.x - s.x, b.y - s.y) < s.r) return 1; } return 0; };

// Keep a body inside the rounded ice. `puck` pucks may pass through the open goal mouths. Returns the impact speed or 0.
function bank(b, puck, rest, ev) {
  const r = b.r;
  const ax = HW - r, ay = HH - r, k = Math.max(8, CORNER - r);
  let nx = 0, ny = 0, pen = 0;
  const x = b.x, y = b.y, ax0 = Math.abs(x), ay0 = Math.abs(y), sx = x < 0 ? -1 : 1, sy = y < 0 ? -1 : 1;
  const mouth = puck && ax0 < GOAL_HW;
  if (mouth && ay0 > HH - r - 1) {
    // inside or heading into the net: side walls and the back of the net hold the puck
    if (ay0 > HH - r) {
      if (ax0 > GOAL_HW - r) { nx = -sx; pen = ax0 - (GOAL_HW - r); }
      if (ay0 > HH + NET_D - r) { nx = 0; ny = -sy; pen = ay0 - (HH + NET_D - r); }
    }
  } else {
    const qx = ax0 - (ax - k), qy = ay0 - (ay - k);
    if (qx > 0 && qy > 0) {
      const d = Math.hypot(qx, qy);
      if (d > k) { nx = -sx * qx / d; ny = -sy * qy / d; pen = d - k; }
    } else if (ax0 > ax) { nx = -sx; pen = ax0 - ax; }
    else if (ay0 > ay) { ny = -sy; pen = ay0 - ay; }
  }
  if (pen > 0) {
    b.x += nx * pen; b.y += ny * pen;
    const vn = b.vx * nx + b.vy * ny;
    if (vn < 0) {
      b.vx -= (1 + rest) * vn * nx; b.vy -= (1 + rest) * vn * ny;
      if (-vn > 25) ev.push({ t: 'bank', x: b.x - nx * r, y: b.y - ny * r, v: -vn, id: b.id, nx, ny });
    }
  }
}

function collide(a, b, rest, ev, kind) {
  const dx = b.x - a.x, dy = b.y - a.y, rr = a.r + b.r;
  const d2 = dx * dx + dy * dy;
  if (d2 >= rr * rr || d2 === 0) return;
  const d = Math.sqrt(d2), nx = dx / d, ny = dy / d;
  const inv = 1 / a.m + 1 / b.m, pen = rr - d;
  a.x -= nx * pen * (1 / a.m) / inv; a.y -= ny * pen * (1 / a.m) / inv;
  b.x += nx * pen * (1 / b.m) / inv; b.y += ny * pen * (1 / b.m) / inv;
  const rvx = b.vx - a.vx, rvy = b.vy - a.vy, vn = rvx * nx + rvy * ny;
  if (vn >= 0) return;
  const j = -(1 + rest) * vn / inv;
  a.vx -= j * nx / a.m; a.vy -= j * ny / a.m; b.vx += j * nx / b.m; b.vy += j * ny / b.m;
  const v = -vn;
  if (v > 18) {
    ev.push({ t: kind, x: a.x + nx * a.r, y: a.y + ny * a.r, v, a: a.id, b: b.id, nx, ny });
    if (kind === 'stick') { const s = a.kind === 'skater' ? a : b; s.swing = Math.max(s.swing, 0.9); s.swingDir = 1; s.hit = 1; }
    else { a.hit = Math.max(a.hit, 0.6); b.hit = Math.max(b.hit, 0.6); }
  }
}

function post(b, px, py, ev) {
  const dx = b.x - px, dy = b.y - py, rr = b.r + POST_R, d2 = dx * dx + dy * dy;
  if (d2 >= rr * rr || d2 === 0) return;
  const d = Math.sqrt(d2), nx = dx / d, ny = dy / d;
  b.x = px + nx * rr; b.y = py + ny * rr;
  const vn = b.vx * nx + b.vy * ny;
  if (vn < 0) {
    const rest = b.kind === 'puck' ? 0.9 : 0.6;
    b.vx -= (1 + rest) * vn * nx; b.vy -= (1 + rest) * vn * ny;
    if (-vn > 20) ev.push({ t: 'post', x: px + nx * POST_R, y: py + ny * POST_R, v: -vn, id: b.id });
  }
}

// One physics step. Returns the events of the step (impacts, a goal).
export function stepWorld(w, dt = STEP) {
  const ev = w.events; ev.length = 0;
  const puck = puckOf(w);
  w.time += dt;
  for (const b of w.bodies) {
    const sp = Math.hypot(b.vx, b.vy);
    if (sp > 0) {
      const snow = inSnow(w, b);
      const k = (b.kind === 'puck' ? K_PUCK : K_SKATER) + snow * K_SNOW, c = (b.kind === 'puck' ? C_PUCK : C_SKATER) * (1 + snow * 2.2);
      let ns = sp * Math.exp(-k * dt) - c * dt;
      if (ns < STOP) ns = 0;
      const f = ns / sp; b.vx *= f; b.vy *= f;
    }
    b.x += b.vx * dt; b.y += b.vy * dt;
    if (b.swing > 0) b.swing = Math.max(0, b.swing - dt * 1.7);
    if (b.hit > 0) b.hit = Math.max(0, b.hit - dt * 2.6);
  }
  // pairs: puck with skaters is a stick strike, skaters with skaters a body check
  const n = w.bodies.length;
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    const a = w.bodies[i], b = w.bodies[j];
    if (a.kind === 'puck') collide(a, b, REST_SP, ev, 'stick'); else collide(a, b, REST_SS, ev, 'check');
  }
  for (const b of w.bodies) {
    const isP = b.kind === 'puck';
    bank(b, isP, isP ? REST_WALL_P : REST_WALL_S, ev);
    for (const sy of [-1, 1]) { post(b, -GOAL_HW, sy * HH, ev); post(b, GOAL_HW, sy * HH, ev); }
  }
  // a goal: the whole puck is over the line between the posts
  if (!w.goal && Math.abs(puck.x) < GOAL_HW && Math.abs(puck.y) > HH + R_PUCK) {
    w.goal = { side: puck.y < 0 ? 0 : 1, t: w.time };     // the side that scored (side 0 attacks the top goal)
    ev.push({ t: 'goal', side: w.goal.side, x: puck.x, y: puck.y });
  }
  // glide amount for the animation, face the direction of travel
  let moving = false;
  for (const b of w.bodies) {
    const sp = Math.hypot(b.vx, b.vy);
    b.glide = Math.min(1, sp / 420);
    if (sp > 0) moving = true;
    if (b.kind === 'skater' && sp > 40) {
      const target = Math.atan2(b.vy, b.vx);
      let d = target - b.face; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
      b.face += d * Math.min(1, dt * 9);
    }
  }
  w.settled = !moving;
  return ev;
}

// Play a launched shot out on a copy. Returns { w, steps } at rest (or after `maxSteps`).
export function playOut(w, maxSteps = 1500, stopAtGoal = true) {
  let steps = 0;
  while (steps < maxSteps) {
    stepWorld(w);
    steps++;
    if (stopAtGoal && w.goal) break;
    if (w.settled) break;
  }
  return steps;
}

// The aiming preview: the chosen skater's path and the puck's path for up to `secs` seconds of the real physics.
export function previewShot(w, id, ang, power, secs = 1.3) {
  const c = cloneWorld(w);
  launch(c, id, ang, power);
  const p0 = puckOf(c), me = bodyById(c, id);
  const path = [{ x: me.x, y: me.y }], pp = [], hits = [];
  let touched = false;
  const n = Math.round(secs / STEP);
  for (let i = 0; i < n; i++) {
    const ev = stepWorld(c);
    if (i % 6 === 0) { path.push({ x: me.x, y: me.y }); }
    for (const e of ev) if (e.t === 'stick' || e.t === 'check' || e.t === 'bank') { if (hits.length < 3) hits.push({ x: e.x, y: e.y, t: e.t }); }
    if (!touched && ev.some((e) => e.t === 'stick' && (e.a === id || e.b === id))) { touched = true; pp.push({ x: p0.x, y: p0.y }); }
    if (touched && i % 6 === 0) pp.push({ x: p0.x, y: p0.y });
    if (c.goal || c.settled) break;
  }
  path.push({ x: me.x, y: me.y }); if (touched) pp.push({ x: p0.x, y: p0.y });
  return { path, puckPath: pp, hits, touched, goal: c.goal ? c.goal.side : -1 };
}

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
