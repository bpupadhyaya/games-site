// Cymbergaj physics: pure and deterministic. One table (world units, origin at the centre, +y towards side 0 = the bottom
// player, -y towards side 1 = the top player), one brass puck, two paddles. No randomness, no clock: game.js feeds targets
// and a fixed 1/60 s tick; every tick is run as SUB small steps so a fast puck never tunnels through a paddle.
export const HW = 210;            // half width of the playing surface
export const HH = 400;            // half length (the goal lines are at y = +/- HH)
export const GOAL_HW = 92;        // half width of a goal mouth
export const R_PUCK = 24;
export const R_PAD = 42;
export const R_POST = 9;
export const CORNER = 66;         // radius of the rounded playing-surface corners
export const POCKET = 54;         // depth of the goal pocket behind the line (drawing only)
export const SUB = 4;             // sub-steps per 1/60 s (kept for tools); the world runs on a fixed 1/240 s step
export const DT_FIX = 1 / 240;    // fixed physics step: same result at 30, 60 or 120 Hz, a 4 u puck move at most per step
export const MAXV = 820;          // puck speed limit, units per second: about one table length per second
export const MAXV_CALM = 520;
export const PAD_GAIN = 14;       // how eagerly a paddle follows its target (1/s)
export const PAD_ACC = 5200;      // paddle acceleration limit (units/s^2): it eases into motion instead of jumping
export const PAD_VMAX = 450;      // human paddle speed limit (units/s)
const E_WALL = 0.88, E_PAD = 0.8, DRAG = 0.42, ROLL = 14;   // air-cushion drag, plus a little constant rolling loss

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const TAU = Math.PI * 2;

const makePad = (side) => ({ side, x: 0, y: side === 0 ? 250 : -250, vx: 0, vy: 0, tx: 0, ty: side === 0 ? 250 : -250, vmax: PAD_VMAX, hit: 0, ang: 0 });

export function homeOf(side) { return { x: 0, y: side === 0 ? 250 : -250 }; }
export function serveSpot(side) { return { x: 0, y: side === 0 ? 170 : -170 }; }

export function createWorld() {
  return { puck: { x: 0, y: 0, vx: 0, vy: 0, ang: 0, spin: 0, scale: 1 }, pads: [makePad(0), makePad(1)], goal: null, t: 0, lastHit: -1, rallyHits: 0 };
}

export function placeServe(w, side) {
  const s = serveSpot(side);
  Object.assign(w.puck, { x: s.x, y: s.y, vx: 0, vy: 0, spin: 0, scale: 1 });
  w.goal = null; w.lastHit = -1; w.rallyHits = 0;
}
export function resetPads(w, snap = true) {
  for (const p of w.pads) {
    const h = homeOf(p.side);
    p.tx = h.x; p.ty = h.y;
    if (snap) { p.x = h.x; p.y = h.y; p.vx = 0; p.vy = 0; }
  }
}

// ---- walls --------------------------------------------------------------------------------------------------------
// Bounce a disc of radius R_PUCK (given by its centre and velocity) against the rounded rectangle, the goal posts and
// the goal pocket. Returns the impact speed (0 when nothing was hit) and a kind. Used by the real puck and the predictor.
export function bounceWalls(p, out) {
  let hit = 0, kind = '';
  const bx = HW - R_PUCK, by = HH - R_PUCK, c = CORNER - R_PUCK;
  const sx = p.x < 0 ? -1 : 1, sy = p.y < 0 ? -1 : 1;
  const ax = Math.abs(p.x), ay = Math.abs(p.y);
  const reflect = (nx, ny, e) => {   // n points from the wall INTO the table
    const vn = p.vx * nx + p.vy * ny;
    if (vn < 0) {
      p.vx -= (1 + e) * vn * nx; p.vy -= (1 + e) * vn * ny;
      // a little tangential grip turns into spin, like a real puck rolling off a rim
      const tx = -ny, ty = nx, vt = p.vx * tx + p.vy * ty;
      p.vx -= vt * 0.015 * tx; p.vy -= vt * 0.015 * ty;
      if (p.spin !== undefined) p.spin = p.spin * 0.8 + vt * 0.004;
      hit = Math.max(hit, -vn);
      return -vn;
    }
    return 0;
  };
  // the end walls exist only outside the goal mouth
  const inMouth = ax < GOAL_HW;
  if (ax > bx - c && ay > by - c) {
    // rounded corner: a quarter circle of radius c around (bx - c, by - c)
    const cx = sx * (bx - c), cy = sy * (by - c), dx = p.x - cx, dy = p.y - cy, d = Math.hypot(dx, dy);
    if (d > c) { const nx = -dx / d, ny = -dy / d; p.x = cx + (dx / d) * c; p.y = cy + (dy / d) * c; reflect(nx, ny, E_WALL); kind = 'wall'; }
  } else {
    if (ax > bx) { p.x = sx * bx; reflect(-sx, 0, E_WALL); kind = 'wall'; }
    if (ay > by && !inMouth) { p.y = sy * by; reflect(0, -sy, E_WALL); kind = 'wall'; }
  }
  // the posts
  for (const px of [-GOAL_HW, GOAL_HW]) {
    const dx = p.x - px, dy = p.y - sy * HH, d = Math.hypot(dx, dy), lim = R_POST + R_PUCK;
    if (d < lim && d > 1e-6) {
      const nx = dx / d, ny = dy / d;
      p.x = px + nx * lim; p.y = sy * HH + ny * lim;
      if (reflect(nx, ny, 0.8) > 0) kind = 'post';
    }
  }
  // inside the goal pocket (only reached after a goal): keep the puck between the pocket walls
  if (ay > HH) {
    const pw = GOAL_HW - R_PUCK + 8;
    if (ax > pw) { p.x = sx * pw; reflect(-sx, 0, 0.3); }
    if (ay > HH + POCKET - R_PUCK) { p.y = sy * (HH + POCKET - R_PUCK); reflect(0, -sy, 0.25); }
  }
  if (out && hit > 0) { out.v = hit; out.kind = kind || 'wall'; }
  return hit;
}

// ---- stepping -----------------------------------------------------------------------------------------------------
export function stepWorld(w, dt) {
  const ev = [];
  if (!(dt > 0)) return ev;
  dt = Math.min(dt, 0.1);                    // a stalled frame never turns into a huge jump
  w.acc = (w.acc || 0) + dt;
  while (w.acc >= DT_FIX - 1e-9) { subStep(w, DT_FIX, ev); w.acc -= DT_FIX; }
  if (w.acc < 0) w.acc = 0;
  w.t += dt;
  for (const p of w.pads) if (p.hit > 0) p.hit = Math.max(0, p.hit - dt * 4);
  return ev;
}

function movePad(p, h) {
  const lo = R_PAD * 0.9;
  const tx = clamp(p.tx, -HW + R_PAD, HW - R_PAD);
  const ty = p.side === 0 ? clamp(p.ty, lo, HH - R_PAD) : clamp(p.ty, -(HH - R_PAD), -lo);
  let dx = tx - p.x, dy = ty - p.y;
  const d = Math.hypot(dx, dy);
  // wanted speed: proportional to the distance, capped, and never faster than can still be braked in time
  const want = Math.min(p.vmax, PAD_GAIN * d, Math.sqrt(1.6 * PAD_ACC * d));
  let wx = 0, wy = 0;
  if (d > 1e-6) { wx = dx / d * want; wy = dy / d * want; }
  let ax = wx - p.vx, ay = wy - p.vy; const al = Math.hypot(ax, ay), amax = PAD_ACC * h;
  if (al > amax) { ax *= amax / al; ay *= amax / al; }
  let nvx = p.vx + ax, nvy = p.vy + ay;
  let mx = nvx * h, my = nvy * h; const ml = Math.hypot(mx, my);
  if (ml > d) { mx *= d / ml; my *= d / ml; nvx = mx / h; nvy = my / h; }      // never overshoot the target
  dx = mx; dy = my;
  p.x += dx; p.y += dy;
  // clamp again in case the paddle itself was pushed
  p.x = clamp(p.x, -HW + R_PAD, HW - R_PAD);
  p.y = p.side === 0 ? clamp(p.y, lo, HH - R_PAD) : clamp(p.y, -(HH - R_PAD), -lo);
  p.vx = dx / h; p.vy = dy / h;      // the real (post-clamp) velocity: what the puck feels on contact
}

function subStep(w, h, ev) {
  const u = w.puck;
  for (const p of w.pads) movePad(p, h);
  if (w.hold) return;           // serve countdown / coaching freeze: paddles move, the puck waits
  if (w.goal) {
    // the puck rolls to rest in the pocket
    u.x += u.vx * h; u.y += u.vy * h; u.vx *= 0.985; u.vy *= 0.985;
    const o = {}; bounceWalls(u, o);
    return;
  }
  u.x += u.vx * h; u.y += u.vy * h;
  const k = Math.exp(-DRAG * (w.calm ? 2.2 : 1) * h);
  u.vx *= k; u.vy *= k;
  { const sp0 = Math.hypot(u.vx, u.vy); if (sp0 > 1e-6) { const f = Math.max(0, sp0 - ROLL * h) / sp0; u.vx *= f; u.vy *= f; } }
  u.ang += u.spin * h; u.spin *= Math.exp(-1.2 * h);
  const o = {};
  // paddles first (position correction), then the walls, then once more so nothing ends up inside a paddle or a wall
  for (let pass = 0; pass < 2; pass++) {
    for (const p of w.pads) {
      const dx = u.x - p.x, dy = u.y - p.y, d = Math.hypot(dx, dy), lim = R_PAD + R_PUCK;
      if (d >= lim) continue;
      let nx, ny;
      if (d > 1e-6) { nx = dx / d; ny = dy / d; } else { nx = 0; ny = p.side === 0 ? -1 : 1; }
      u.x = p.x + nx * lim; u.y = p.y + ny * lim;
      const rel = (u.vx - p.vx) * nx + (u.vy - p.vy) * ny;
      if (rel < 0) {
        u.vx -= (1 + E_PAD) * rel * nx; u.vy -= (1 + E_PAD) * rel * ny;
        const tvx = -ny, tvy = nx, vt = (u.vx - p.vx) * tvx + (u.vy - p.vy) * tvy;
        u.spin += vt * 0.006;
        p.hit = 1;
        w.lastHit = p.side; w.rallyHits++;
        ev.push({ t: 'pad', side: p.side, x: u.x - nx * R_PUCK, y: u.y - ny * R_PUCK, v: -rel });
      }
    }
    const o2 = {}; const before = u.x * 1e6 + u.y;
    if (bounceWalls(u, o2) > 0) {
      if (pass === 0) ev.push({ t: o2.kind, x: u.x, y: u.y, v: o2.v });
      // squeezed between a wall and a paddle: give the paddle's side a little way out
      for (const p of w.pads) {
        const dx = u.x - p.x, dy = u.y - p.y, d = Math.hypot(dx, dy), lim = R_PAD + R_PUCK;
        if (d < lim - 0.01 && d > 1e-6) {
          const push = lim - d;
          p.x -= (dx / d) * push; p.y -= (dy / d) * push;
          p.x = clamp(p.x, -HW + R_PAD, HW - R_PAD);
          p.y = p.side === 0 ? clamp(p.y, R_PAD * 0.9, HH - R_PAD) : clamp(p.y, -(HH - R_PAD), -R_PAD * 0.9);
        }
      }
    }
    void before; void o;
  }
  const sp = Math.hypot(u.vx, u.vy), cap = w.calm ? MAXV_CALM : MAXV;
  if (sp > cap) { u.vx *= cap / sp; u.vy *= cap / sp; }
  else if (sp < 4) { u.vx = 0; u.vy = 0; }
  if (Math.abs(u.y) > HH + 2 && Math.abs(u.x) < GOAL_HW) {
    w.goal = { side: u.y > 0 ? 1 : 0, speed: sp };
    ev.push({ t: 'goal', side: w.goal.side, x: u.x, y: u.y, v: sp });
  }
}

// Where will the puck be? Walls only (paddles are not predicted). Returns samples every `dt` seconds:
// [{ t, x, y, vx, vy }] including the start, until `tmax` or until the puck leaves through a goal mouth.
export function predictPuck(p, tmax = 2.0, dt = 1 / 60) {
  const q = { x: p.x, y: p.y, vx: p.vx, vy: p.vy };
  const out = [{ t: 0, x: q.x, y: q.y, vx: q.vx, vy: q.vy, bounced: false }];
  const n = Math.ceil(tmax / dt);
  for (let i = 1; i <= n; i++) {
    for (let s = 0; s < 2; s++) {
      q.x += q.vx * dt / 2; q.y += q.vy * dt / 2;
      const k = Math.exp(-DRAG * dt / 2); q.vx *= k; q.vy *= k;
      { const sp0 = Math.hypot(q.vx, q.vy); if (sp0 > 1e-6) { const f = Math.max(0, sp0 - ROLL * dt / 2) / sp0; q.vx *= f; q.vy *= f; } }
    }
    const b = bounceWalls(q, null) > 0;
    out.push({ t: i * dt, x: q.x, y: q.y, vx: q.vx, vy: q.vy, bounced: b });
    if (Math.abs(q.y) > HH + 2 && Math.abs(q.x) < GOAL_HW) break;
  }
  return out;
}

// A shot line from a puck position and direction for drawing: a polyline with bounces, `len` world units long at most.
export function shotLine(x, y, dx, dy, len = 1400) {
  const d = Math.hypot(dx, dy) || 1;
  const q = { x, y, vx: dx / d * 900, vy: dy / d * 900 };
  const pts = [{ x, y }];
  const step = 1 / 60;
  let run = 0;
  while (run < len) {
    q.x += q.vx * step; q.y += q.vy * step; run += 900 * step;
    const b = bounceWalls(q, null);
    if (b > 0) pts.push({ x: q.x, y: q.y });
    if (Math.abs(q.y) > HH + 2 && Math.abs(q.x) < GOAL_HW) { pts.push({ x: q.x, y: q.y }); return { pts, goal: true }; }
    if (pts.length > 4) break;
  }
  pts.push({ x: q.x, y: q.y });
  return { pts, goal: false };
}

export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export { TAU };
