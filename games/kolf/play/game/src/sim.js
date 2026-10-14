// Kolf physics: a hard leather ball sliding on ice, in metres. Pure and deterministic (fixed 1/120 s steps, no randomness).
//
// Coordinates: x across the court (0..W), y along it from end A (y = 0) to end B (y = L); the court never changes, the out leg
// plays A to B and the return leg B to A. A stroke gives the ball a speed and a heading `ang` measured from +y (0 = towards
// end B, positive = towards +x, so on the return leg the ball goes at about +/-180 degrees).
//
// What can happen to the ball (the Rules page repeats this list):
//   rolls on ice with a little drag; snow slows it hard; a crosswind pushes it; boards, pillars, blocks and sledges bounce it;
//   thin ice swallows a ball that is moving slower than THIN_SKIM (a fast ball skims across); touching the post ends the leg.
export const STEP = 1 / 120;
export const BR = 0.14;            // ball radius, metres
export const POST_R = 0.5;         // the post
export const V_MIN = 4;            // slowest stroke, m/s
export const V_MAX = 25;           // hardest stroke, m/s
export const ICE_DECEL = 3.0;      // m/s^2 of rolling friction on ice
export const SNOW_DECEL = 11;
export const DRAG = 0.012;         // 1/s, speed-proportional
export const WALL_E = 0.74;        // boards
export const OBST_E = 0.62;        // pillars and blocks
export const THIN_SKIM = 8.5;      // m/s: slower than this and thin ice gives way
export const STOP_V = 0.2;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// Court definition (authored: post A near y = 0, post B at the far end). dir 0 plays A to B, dir 1 plays B back to A over the
// same ice. All lists optional. See courts.js.
export function compileCourt(def, dir = 0) {
  const W = def.W, L = def.L;
  const A = def.a, B = def.b, back = dir === 1;
  const tee = back ? { x: B.x, y: B.y - 2.6 } : { x: A.x, y: A.y + 2.6 };
  const tgt = back ? A : B;
  return {
    id: def.id, name: def.name, W, L, dir, tee, post: { x: tgt.x, y: tgt.y, r: POST_R }, startPost: back ? { x: B.x, y: B.y } : { x: A.x, y: A.y },
    circles: (def.circles || []).slice(), boxes: (def.boxes || []).slice(), snow: (def.snow || []).slice(), thin: (def.thin || []).slice(),
    bridges: (def.bridges || []).slice(), movers: (def.movers || []).slice(),
    wind: def.wind ? { ax: def.wind.ax, ay: def.wind.ay, gust: def.wind.gust || 0, per: def.wind.per || 9 } : { ax: 0, ay: 0, gust: 0, per: 9 },
    style: def.style, tip: def.tip, hasMovers: !!(def.movers && def.movers.length),
  };
}

export function moverPos(m, t) {
  const k = Math.sin((t / m.per) * Math.PI * 2 + (m.ph || 0)) * m.amp;
  return { x: m.x + m.dx * k, y: m.y + m.dy * k };
}
export function windAt(c, t) {
  const g = 1 + c.wind.gust * Math.sin((t / c.wind.per) * Math.PI * 2);
  return { x: c.wind.ax * g, y: c.wind.ay * g };
}

export const newBall = (x, y) => ({ x, y, vx: 0, vy: 0, mode: 'rest', t: 0, sink: 0, sx: 0, sy: 0 });
export function launchBall(b, ang, pow) {
  const v = V_MIN + (V_MAX - V_MIN) * clamp(pow, 0, 1);
  b.vx = Math.sin(ang) * v; b.vy = Math.cos(ang) * v; b.mode = 'roll'; b.t = 0;
}

const inRect = (r, x, y) => x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1;
export const onSnow = (c, x, y) => c.snow.some((r) => inRect(r, x, y));
export const onThin = (c, x, y) => c.thin.some((r) => inRect(r, x, y)) && !c.bridges.some((r) => inRect(r, x, y));

// One fixed step. `clock` is the course clock (moving parts + wind gusts). Pushes events {k, x, y, v} into `ev`.
export function stepBall(c, b, clock, ev) {
  if (b.mode !== 'roll') return;
  const dt = STEP;
  const w = windAt(c, clock);
  let sp = Math.hypot(b.vx, b.vy);
  const snow = onSnow(c, b.x, b.y);
  const dec = (snow ? SNOW_DECEL : ICE_DECEL) + DRAG * sp;
  if (sp > 1e-9) { const n = Math.max(0, sp - dec * dt); b.vx *= n / sp; b.vy *= n / sp; sp = n; }
  if (!snow) { b.vx += w.x * dt; b.vy += w.y * dt; }
  b.x += b.vx * dt; b.y += b.vy * dt;
  b.t += dt;
  // boards
  const r = BR;
  if (b.x < r) { b.x = r; if (b.vx < 0) { ev.push({ k: 'wall', x: 0, y: b.y, v: -b.vx }); b.vx = -b.vx * WALL_E; b.vy *= 0.985; } }
  else if (b.x > c.W - r) { b.x = c.W - r; if (b.vx > 0) { ev.push({ k: 'wall', x: c.W, y: b.y, v: b.vx }); b.vx = -b.vx * WALL_E; b.vy *= 0.985; } }
  if (b.y < r) { b.y = r; if (b.vy < 0) { ev.push({ k: 'wall', x: b.x, y: 0, v: -b.vy }); b.vy = -b.vy * WALL_E; b.vx *= 0.985; } }
  else if (b.y > c.L - r) { b.y = c.L - r; if (b.vy > 0) { ev.push({ k: 'wall', x: b.x, y: c.L, v: b.vy }); b.vy = -b.vy * WALL_E; b.vx *= 0.985; } }
  // pillars
  for (const o of c.circles) bounceCircle(b, o.x, o.y, o.r, 0, 0, OBST_E, ev, 'pillar');
  // blocks
  for (const o of c.boxes) {
    const px = clamp(b.x, o.x0, o.x1), py = clamp(b.y, o.y0, o.y1);
    let dx = b.x - px, dy = b.y - py, d = Math.hypot(dx, dy);
    if (d >= r) continue;
    if (d < 1e-9) {   // centre inside: push out the nearest side
      const l = b.x - o.x0, rr = o.x1 - b.x, t = b.y - o.y0, bt = o.y1 - b.y, m = Math.min(l, rr, t, bt);
      if (m === l) { dx = -1; dy = 0; } else if (m === rr) { dx = 1; dy = 0; } else if (m === t) { dx = 0; dy = -1; } else { dx = 0; dy = 1; }
      b.x = px + dx * r; b.y = py + dy * r; d = r;
    } else { b.x = px + (dx / d) * r; b.y = py + (dy / d) * r; dx /= d; dy /= d; }
    const vn = b.vx * dx + b.vy * dy;
    if (vn < 0) { ev.push({ k: 'block', x: px, y: py, v: -vn }); b.vx -= (1 + OBST_E) * vn * dx; b.vy -= (1 + OBST_E) * vn * dy; }
  }
  // sledges (moving)
  for (const m of c.movers) {
    const p = moverPos(m, clock), q = moverPos(m, clock + 0.01);
    bounceCircle(b, p.x, p.y, m.r, (q.x - p.x) / 0.01, (q.y - p.y) / 0.01, 0.8, ev, 'sledge');
  }
  // the post ends the leg
  const pd = Math.hypot(b.x - c.post.x, b.y - c.post.y);
  if (pd <= c.post.r + BR) { b.mode = 'post'; b.sx = b.x; b.sy = b.y; ev.push({ k: 'post', x: b.x, y: b.y, v: sp }); return; }
  // thin ice
  if (sp < THIN_SKIM && onThin(c, b.x, b.y)) { b.mode = 'thin'; b.sx = b.x; b.sy = b.y; ev.push({ k: 'crack', x: b.x, y: b.y, v: sp }); return; }
  if (sp < STOP_V) { b.vx = 0; b.vy = 0; b.mode = 'rest'; ev.push({ k: 'rest', x: b.x, y: b.y, v: 0 }); }
}

function bounceCircle(b, cx, cy, cr, ox, oy, e, ev, k) {
  const dx = b.x - cx, dy = b.y - cy, d = Math.hypot(dx, dy), rr = cr + BR;
  if (d >= rr || d < 1e-9) return;
  const nx = dx / d, ny = dy / d;
  b.x = cx + nx * rr; b.y = cy + ny * rr;
  const vn = (b.vx - ox) * nx + (b.vy - oy) * ny;
  if (vn < 0) { ev.push({ k, x: cx + nx * cr, y: cy + ny * cr, v: -vn }); b.vx -= (1 + e) * vn * nx; b.vy -= (1 + e) * vn * ny; }
}

// Run a whole stroke. opts: path (record points), until ('wall' stops at the first bounce), maxT, noMovers (ignore sledges/wind).
export function simulate(c, ball, ang, pow, clock0, opts = {}) {
  const b = { ...ball };
  launchBall(b, ang, pow);
  const cc = opts.noMovers ? { ...c, movers: [], wind: { ax: 0, ay: 0, gust: 0, per: 9 } } : c;
  const maxT = opts.maxT ?? 16;
  const ev = [];
  const path = opts.path ? [[b.x, b.y]] : null;
  let clock = clock0, bounces = 0, hitSledge = 0, snowT = 0, steps = 0, minPost = Infinity;
  const n = Math.round(maxT / STEP);
  for (let i = 0; i < n && b.mode === 'roll'; i++) {
    ev.length = 0;
    stepBall(cc, b, clock, ev);
    clock += STEP; steps++;
    for (const e of ev) { if (e.k === 'wall' || e.k === 'pillar' || e.k === 'block') bounces++; else if (e.k === 'sledge') { bounces++; hitSledge++; } }
    if (path && (i % 6 === 0)) path.push([b.x, b.y]);
    if (b.mode === 'roll' && onSnow(c, b.x, b.y)) snowT += STEP;
    const pd = Math.hypot(b.x - c.post.x, b.y - c.post.y); if (pd < minPost) minPost = pd;
    if (opts.until === 'wall' && bounces > 0) break;
  }
  if (path) path.push([b.x, b.y]);
  return { x: b.x, y: b.y, vx: b.vx, vy: b.vy, mode: b.mode, bounces, hitSledge, t: steps * STEP, path, snowT, minPost, sx: b.sx, sy: b.sy, lastSpeed: Math.hypot(b.vx, b.vy) };
}

// Is the straight line from (x, y) to the post free of blocks, pillars and thin ice a slow ball would sink in?
export function lineClear(c, x, y, margin = 0.2) {
  const px = c.post.x, py = c.post.y, d = Math.hypot(px - x, py - y), n = Math.max(2, Math.ceil(d / 0.4));
  for (let i = 1; i < n; i++) {
    const t = i / n, sx = x + (px - x) * t, sy = y + (py - y) * t;
    for (const o of c.circles) if (Math.hypot(sx - o.x, sy - o.y) < o.r + BR + margin) return false;
    for (const o of c.boxes) if (sx > o.x0 - BR - margin && sx < o.x1 + BR + margin && sy > o.y0 - BR - margin && sy < o.y1 + BR + margin) return false;
  }
  return true;
}
