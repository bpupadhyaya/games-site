// Carrom physics. Pure, deterministic, fixed step. Units are board units: the playing surface is S x S (y grows downward).
// Bodies are plain JSON objects: { id, k: 'W'|'B'|'Q'|'S', x, y, vx, vy, on }. `on` is false once pocketed.
// The same stepWorld() runs the live game, the computer's look-ahead and the tests, so a prediction is the truth.
export const S = 740;
export const R_COIN = 19, R_STR = 25, R_POCKET = 35;
export const M_COIN = 1, M_STR = 3;
export const POCKETS = [{ x: 8, y: 8 }, { x: S - 8, y: 8 }, { x: 8, y: S - 8 }, { x: S - 8, y: S - 8 }];
export const BASE_Y = { W: S - 104, B: 104 };          // striker centre line of each baseline
export const BASE_X0 = 128, BASE_X1 = S - 128;         // where the striker may sit
export const V_MAX = 2700;                             // full-power flick speed (units per second)
const REST_COIN = 0.9, REST_WALL = 0.72, REST_STR = 0.82;
const LIP = 52;                                          // a resting coin this close to a pocket's centre tips in
const DECEL = 950, DRAG = 0.5, STOP = 6;              // sliding friction on the powdered board (units/s^2), air-like drag (1/s), sleep speed
export const DT = 1 / 60;

export const mass = (b) => (b.k === 'S' ? M_STR : M_COIN);
export const radius = (b) => (b.k === 'S' ? R_STR : R_COIN);
export const cloneWorld = (w) => w.map((b) => ({ ...b }));

// The standard opening: queen in the centre, six coins touching it, twelve around them, colours alternating.
export function openingCoins() {
  const c = S / 2, out = [{ id: 0, k: 'Q', x: c, y: c, vx: 0, vy: 0, on: true }];
  const pos = [];
  for (let i = 0; i < 6; i++) { const a = -Math.PI / 2 + i * Math.PI / 3; pos.push([c + Math.cos(a) * 2 * R_COIN, c + Math.sin(a) * 2 * R_COIN]); }
  for (let i = 0; i < 6; i++) { const a = -Math.PI / 2 + i * Math.PI / 3; pos.push([c + Math.cos(a) * 4 * R_COIN, c + Math.sin(a) * 4 * R_COIN]); pos.push([c + Math.cos(a + Math.PI / 6) * 2 * Math.sqrt(3) * 2 * R_COIN / 2 * 1.0001 * 1, c + Math.sin(a + Math.PI / 6) * 2 * Math.sqrt(3) * R_COIN]); }
  // order: ring of six then the twelve; colours alternate around each ring
  const ring1 = pos.slice(0, 6), ring2 = pos.slice(6);
  ring1.forEach((p, i) => out.push({ id: out.length, k: i % 2 ? 'B' : 'W', x: p[0], y: p[1], vx: 0, vy: 0, on: true }));
  // ring2 as 12 angular slots, sorted by angle from the top
  const ang = (p) => (Math.atan2(p[1] - c, p[0] - c) + Math.PI * 2.5) % (Math.PI * 2);
  ring2.sort((a, b) => ang(a) - ang(b)).forEach((p, i) => out.push({ id: out.length, k: (i % 2) ^ (i >= 6 ? 1 : 0) ? 'B' : 'W', x: p[0], y: p[1], vx: 0, vy: 0, on: true }));
  return out;
}

export const striker = (w) => w.find((b) => b.k === 'S');
export const moving = (w) => w.some((b) => b.on && (b.vx !== 0 || b.vy !== 0));

// Advance the world by one 1/60 s tick (several sub-steps so a fast coin can never tunnel). Pushes events: hit, wall, pocket.
export function stepWorld(w, ev) {
  let vmax = 0;
  for (const b of w) if (b.on) { const v = Math.hypot(b.vx, b.vy); if (v > vmax) vmax = v; }
  if (vmax === 0) return;
  const n = Math.min(12, Math.max(2, Math.ceil(vmax * DT / 7))), h = DT / n, len = w.length;
  for (let s = 0; s < n; s++) {
    for (let i = 0; i < len; i++) {
      const b = w[i]; if (!b.on || (b.vx === 0 && b.vy === 0)) continue;
      const v = Math.hypot(b.vx, b.vy), nv = v * Math.exp(-DRAG * h) - DECEL * h;
      if (nv <= STOP) {
        // a coin that comes to rest hanging on a pocket's lip tips in
        let tip = -1; for (let p = 0; p < 4; p++) { const dx = POCKETS[p].x - b.x, dy = POCKETS[p].y - b.y; if (dx * dx + dy * dy < LIP * LIP) { tip = p; break; } }
        if (tip < 0) { b.vx = 0; b.vy = 0; continue; }
        const dx = POCKETS[tip].x - b.x, dy = POCKETS[tip].y - b.y, dd = Math.hypot(dx, dy) || 1; b.vx = dx / dd * 140; b.vy = dy / dd * 140; b.x += b.vx * h; b.y += b.vy * h; continue;
      }
      const f = nv / v; b.vx *= f; b.vy *= f;
      b.x += b.vx * h; b.y += b.vy * h;
      // pocket
      for (let p = 0; p < 4; p++) {
        const dx = b.x - POCKETS[p].x, dy = b.y - POCKETS[p].y;
        if (dx * dx + dy * dy < R_POCKET * R_POCKET) { b.on = false; b.vx = 0; b.vy = 0; b.pk = p; if (ev) ev.push({ t: 'pocket', id: b.id, k: b.k, p, x: b.x, y: b.y }); break; }
      }
      if (!b.on) continue;
      // cushions
      const r = radius(b);
      if (b.x < r) { b.x = r; if (b.vx < 0) { if (ev && -b.vx > 60) ev.push({ t: 'wall', id: b.id, v: -b.vx, x: b.x, y: b.y }); b.vx = -b.vx * REST_WALL; b.vy *= 0.97; } }
      else if (b.x > S - r) { b.x = S - r; if (b.vx > 0) { if (ev && b.vx > 60) ev.push({ t: 'wall', id: b.id, v: b.vx, x: b.x, y: b.y }); b.vx = -b.vx * REST_WALL; b.vy *= 0.97; } }
      if (b.y < r) { b.y = r; if (b.vy < 0) { if (ev && -b.vy > 60) ev.push({ t: 'wall', id: b.id, v: -b.vy, x: b.x, y: b.y }); b.vy = -b.vy * REST_WALL; b.vx *= 0.97; } }
      else if (b.y > S - r) { b.y = S - r; if (b.vy > 0) { if (ev && b.vy > 60) ev.push({ t: 'wall', id: b.id, v: b.vy, x: b.x, y: b.y }); b.vy = -b.vy * REST_WALL; b.vx *= 0.97; } }
    }
    // circle-circle
    for (let i = 0; i < len; i++) {
      const a = w[i]; if (!a.on) continue;
      for (let j = i + 1; j < len; j++) {
        const c = w[j]; if (!c.on) continue;
        if (a.vx === 0 && a.vy === 0 && c.vx === 0 && c.vy === 0) continue;
        const dx = c.x - a.x, dy = c.y - a.y, rr = radius(a) + radius(c), d2 = dx * dx + dy * dy;
        if (d2 >= rr * rr) continue;
        const d = Math.sqrt(d2) || 1e-6, nx = dx / d, ny = dy / d, ma = mass(a), mc = mass(c), inv = 1 / ma + 1 / mc;
        const pen = rr - d, sa = (pen / ma) / inv, sc = (pen / mc) / inv;   // push apart in proportion to lightness
        a.x -= nx * sa; a.y -= ny * sa; c.x += nx * sc; c.y += ny * sc;
        const vn = (c.vx - a.vx) * nx + (c.vy - a.vy) * ny;
        if (vn < 0) {
          const e = a.k === 'S' || c.k === 'S' ? REST_STR : REST_COIN, j2 = -(1 + e) * vn / inv;
          a.vx -= j2 * nx / ma; a.vy -= j2 * ny / ma; c.vx += j2 * nx / mc; c.vy += j2 * ny / mc;
          if (ev && -vn > 25) ev.push({ t: 'hit', a: a.id, b: c.id, v: -vn, x: (a.x + c.x) / 2, y: (a.y + c.y) / 2 });
        }
      }
    }
  }
}

// Run until everything is still (or maxTicks). Returns the ticks used.
export function settle(w, ev, maxTicks = 900) {
  let t = 0;
  while (t < maxTicks && moving(w)) { stepWorld(w, ev); t++; }
  if (t >= maxTicks) for (const b of w) { b.vx = 0; b.vy = 0; }
  return t;
}

// A shot: striker at x on the baseline, aimed along angle `a` (radians, 0 = +x) with power p in 0..1.
export const shotVelocity = (a, p) => ({ vx: Math.cos(a) * V_MAX * p, vy: Math.sin(a) * V_MAX * p });

// Trace the striker's straight path from (x,y) along unit (dx,dy): the first coin it touches, or the cushion.
// Returns { t, x, y, coin, wall } where (x,y) is the striker centre at the moment of contact.
export function trace(w, x, y, dx, dy, r = R_STR, skipId = -1) {
  let best = { t: Infinity, coin: null };
  for (const b of w) {
    if (!b.on || b.k === 'S' || b.id === skipId) continue;
    const fx = x - b.x, fy = y - b.y, rr = r + R_COIN, B = fx * dx + fy * dy, C = fx * fx + fy * fy - rr * rr;
    if (C < 0) { if (B < 0) { best = { t: 0, coin: b }; } continue; }
    const D = B * B - C; if (D < 0) continue;
    const t = -B - Math.sqrt(D); if (t >= 0 && t < best.t) best = { t, coin: b };
  }
  let tw = Infinity, wall = '';
  if (dx > 1e-9) { const t = (S - r - x) / dx; if (t < tw) { tw = t; wall = 'x'; } } else if (dx < -1e-9) { const t = (r - x) / dx; if (t < tw) { tw = t; wall = 'x'; } }
  if (dy > 1e-9) { const t = (S - r - y) / dy; if (t < tw) { tw = t; wall = 'y'; } } else if (dy < -1e-9) { const t = (r - y) / dy; if (t < tw) { tw = t; wall = 'y'; } }
  if (tw < best.t) return { t: Math.max(0, tw), x: x + dx * tw, y: y + dy * tw, coin: null, wall };
  return { t: best.t, x: x + dx * best.t, y: y + dy * best.t, coin: best.coin, wall: '' };
}

// Does the striker centre at (x,y) overlap a coin?
export const blocked = (w, x, y) => w.some((b) => b.on && b.k !== 'S' && Math.hypot(b.x - x, b.y - y) < R_STR + R_COIN - 0.5);
