// Pure geometry and ball physics for the table. No state of its own; sim.js owns the state.
import { HW, HL, BALL_R, GOAL_HW, CHAMFER, POST_R, KINDS, MAN_HX, MAN_HY, dirOf } from './consts.js';

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

// x of man k on a rod
export function manX(rod, k) {
  const K = KINDS[rod.kind];
  return rod.off + (k - (K.n - 1) / 2) * K.spacing;
}
export const manBase = (kind, k) => (k - (KINDS[kind].n - 1) / 2) * KINDS[kind].spacing;

// swing profile: foot offset f (table units toward the opponent) at time t into the swing
export const SW = { wind: 0.06, strike: 0.14, hold: 0.2, back: 0.3, fBack: -2.5, fFront: 6.5 };
export function footAt(t) {
  if (t < 0) return 0;
  if (t < SW.wind) return SW.fBack * (t / SW.wind);
  if (t < SW.strike) { const u = (t - SW.wind) / (SW.strike - SW.wind); return SW.fBack + (SW.fFront - SW.fBack) * u; }
  if (t < SW.hold) return SW.fFront;
  if (t < SW.back) return SW.fFront * (1 - (t - SW.hold) / (SW.back - SW.hold));
  return 0;
}
export const inStrike = (t) => t >= SW.wind && t < SW.strike;

// Bounce an x coordinate off the side cushions (for prediction).
export function reflectX(x) {
  const lim = HW - BALL_R, span = lim * 4;
  let v = (x + lim) % span; if (v < 0) v += span;
  return v <= lim * 2 ? v - lim : lim * 3 - v;
}

export function collideRect(b, cx, cy, hx, hy, rvx, rvy, e) {
  const qx = clamp(b.x, cx - hx, cx + hx), qy = clamp(b.y, cy - hy, cy + hy);
  const ox = b.x - qx, oy = b.y - qy, d2 = ox * ox + oy * oy;
  if (d2 >= BALL_R * BALL_R) return null;
  let nx, ny, pen;
  if (d2 > 1e-9) { const d = Math.sqrt(d2); nx = ox / d; ny = oy / d; pen = BALL_R - d; } else {
    const px = hx - Math.abs(b.x - cx), py = hy - Math.abs(b.y - cy);
    if (px < py) { nx = b.x >= cx ? 1 : -1; ny = 0; pen = px + BALL_R; } else { nx = 0; ny = b.y >= cy ? 1 : -1; pen = py + BALL_R; }
  }
  b.x += nx * pen; b.y += ny * pen;
  const rel = (b.vx - rvx) * nx + (b.vy - rvy) * ny;
  if (rel < 0) {
    b.vx -= (1 + e) * rel * nx; b.vy -= (1 + e) * rel * ny;
    // friction against the wood: the ball is slowed along the face it touches (relative to the moving man)
    const tx = -ny, ty = nx, rt = (b.vx - rvx) * tx + (b.vy - rvy) * ty, k = rt * 0.18;
    b.vx -= k * tx; b.vy -= k * ty;
  }
  return { nx, ny, rel };
}

// Cushions, corner fillets, goal posts and the goal pocket. Returns a list of {t:'wall'|'post', v} contacts.
export function collideBounds(b) {
  const hits = [];
  const R = BALL_R;
  const inPocket = Math.abs(b.y) > HL - 0.01 && Math.abs(b.x) < GOAL_HW;
  if (b.x > HW - R) { b.x = HW - R; if (b.vx > 0) { hits.push({ t: 'wall', v: b.vx }); b.vx = -b.vx * 0.82; b.vy *= 0.985; } }
  if (b.x < -HW + R) { b.x = -HW + R; if (b.vx < 0) { hits.push({ t: 'wall', v: -b.vx }); b.vx = -b.vx * 0.82; b.vy *= 0.985; } }
  for (const s of [-1, 1]) {
    // end cushion except the goal mouth
    if (Math.abs(b.x) >= GOAL_HW - 0.001 && s * b.y > HL - R && s * b.y < HL + 8 && !inPocket) {
      b.y = s * (HL - R); if (s * b.vy > 0) { hits.push({ t: 'wall', v: Math.abs(b.vy) }); b.vy = -b.vy * 0.82; b.vx *= 0.985; }
    }
    // goal pocket side walls and back wall
    if (s * b.y > HL) {
      if (b.x > GOAL_HW - R) { b.x = GOAL_HW - R; if (b.vx > 0) b.vx = -b.vx * 0.4; }
      if (b.x < -GOAL_HW + R) { b.x = -GOAL_HW + R; if (b.vx < 0) b.vx = -b.vx * 0.4; }
      if (s * b.y > HL + 6 - R) { b.y = s * (HL + 6 - R); if (s * b.vy > 0) b.vy = -b.vy * 0.3; }
    }
    // posts
    for (const px of [-GOAL_HW, GOAL_HW]) {
      const dx = b.x - px, dy = b.y - s * HL, d2 = dx * dx + dy * dy, rr = R + POST_R;
      if (d2 < rr * rr && d2 > 1e-9) {
        const d = Math.sqrt(d2), nx = dx / d, ny = dy / d;
        b.x = px + nx * rr; b.y = s * HL + ny * rr;
        const rel = b.vx * nx + b.vy * ny;
        if (rel < 0) { b.vx -= 1.7 * rel * nx; b.vy -= 1.7 * rel * ny; hits.push({ t: 'post', v: -rel }); }
      }
    }
  }
  // corner fillets: |x| + |y| <= HW + HL - CHAMFER (+ ball radius along the diagonal)
  const lim = HW + HL - CHAMFER + R * Math.SQRT2;
  const sx = b.x < 0 ? -1 : 1, sy = b.y < 0 ? -1 : 1;
  const over = Math.abs(b.x) + Math.abs(b.y) - lim;
  if (over > 0 && Math.abs(b.x) > GOAL_HW + 1) {
    const k = over / 2; b.x -= sx * k; b.y -= sy * k;
    const rel = (b.vx * sx + b.vy * sy) / Math.SQRT2;
    if (rel > 0) { const nx = sx / Math.SQRT2, ny = sy / Math.SQRT2; b.vx -= 1.75 * rel * nx; b.vy -= 1.75 * rel * ny; hits.push({ t: 'wall', v: rel }); }
  }
  return hits;
}

export { dirOf, MAN_HX, MAN_HY };
