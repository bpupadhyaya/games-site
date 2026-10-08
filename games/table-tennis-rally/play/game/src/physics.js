// Table-tennis physics in real units (metres, seconds, radians per second). Pure and deterministic.
// Coordinates: x = to the player's right, y = up, z = toward the player. The table's top is at y = TABLE.H;
// the net stands at z = 0. The human side is z > 0 ('p'), the opponent side is z < 0 ('o').
// The ball flies with gravity, air drag and the Magnus force (spin bends the flight), and bounces on the table
// with a friction model so spin changes the kick: topspin shoots forward, backspin checks and stays low.

export const BALL_R = 0.02;
export const TABLE = { L: 2.74, W: 1.525, H: 0.76, hl: 1.37, hw: 0.7625 };
export const NET = { H: 0.1525, hw: 0.7625 + 0.1525 };
export const SIDES = ['p', 'o'];
export const sign = (s) => (s === 'p' ? 1 : -1);             // +1: the half at z > 0
export const other = (s) => (s === 'p' ? 'o' : 'p');

const E_TABLE = 0.9;                       // normal restitution of the table
const MU_TABLE = 0.22;                     // table friction
const K_AERO = 0.5 * 1.2 * Math.PI * BALL_R * BALL_R / 0.0027;   // 0.5 * rho * A / m
const CD = 0.42;
const CL_MAX = 0.34;
const SPIN_DECAY = 0.07;                   // per second

export const v3 = {
  add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  mul: (a, k) => [a[0] * k, a[1] * k, a[2] * k],
  dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  len: (a) => Math.hypot(a[0], a[1], a[2]),
};

export function newBall(p, v, w) { return { p: [...p], v: [...v], w: [...w] }; }

// One integration step of h seconds. Returns an array of events that happened during the step:
//  { type: 'bounce', side: 'p'|'o', x, z, vIn }   the ball hit the table
//  { type: 'net', kind: 'wall'|'cord' }           the ball touched the net
//  { type: 'floor' }                              the ball reached the floor / went under the table level outside it
export function stepBall(b, h, events) {
  const [x0, y0, z0] = b.p;
  const v = b.v, w = b.w;
  const sp = Math.hypot(v[0], v[1], v[2]);
  // acceleration: gravity, drag, Magnus
  let ax = 0, ay = -9.81, az = 0;
  if (sp > 1e-6) {
    const dk = K_AERO * CD * sp;
    ax -= dk * v[0]; ay -= dk * v[1]; az -= dk * v[2];
    const wl = Math.hypot(w[0], w[1], w[2]);
    if (wl > 1e-3) {
      const S = (BALL_R * wl) / sp;
      const cl = CL_MAX * Math.tanh(S * 1.7);
      // (w x v) / |w| has magnitude |v| * sin(angle); the force is K * CL * |v|^2 in direction (w x v)/|w x v|
      const cx = w[1] * v[2] - w[2] * v[1], cy = w[2] * v[0] - w[0] * v[2], cz = w[0] * v[1] - w[1] * v[0];
      const cl2 = Math.hypot(cx, cy, cz);
      if (cl2 > 1e-9) {
        const m = (K_AERO * cl * sp * sp) / cl2;
        ax += cx * m; ay += cy * m; az += cz * m;
      }
    }
  }
  v[0] += ax * h; v[1] += ay * h; v[2] += az * h;
  const decay = Math.exp(-SPIN_DECAY * h);
  w[0] *= decay; w[1] *= decay; w[2] *= decay;
  let x = x0 + v[0] * h, y = y0 + v[1] * h, z = z0 + v[2] * h;

  // net: the plane z = 0 between the table surface and the net top
  if ((z0 > 0 && z <= 0) || (z0 < 0 && z >= 0)) {
    const f = z0 === z ? 0 : z0 / (z0 - z);
    const cx = x0 + (x - x0) * f, cy = y0 + (y - y0) * f;
    const top = TABLE.H + NET.H;
    if (Math.abs(cx) <= NET.hw + BALL_R && cy < top + BALL_R && cy > TABLE.H - 0.12) {
      if (cy > top - BALL_R * 0.55) {                 // clipped the cord: pops over or falls back, loses pace
        v[2] *= 0.55; v[1] = Math.max(v[1], 0) * 0.5 + 0.9; v[0] *= 0.7;
        events?.push({ type: 'net', kind: 'cord' });
        x = cx; y = cy; z = z0 > 0 ? 0.0005 : -0.0005;
        z = -Math.sign(z0) * 0.0005;
      } else {                                         // hit the mesh: stops and drops back on its own side
        v[2] = -v[2] * 0.18; v[0] *= 0.35; v[1] *= 0.4;
        w[0] *= 0.4; w[1] *= 0.4; w[2] *= 0.4;
        events?.push({ type: 'net', kind: 'wall' });
        x = cx; y = cy; z = Math.sign(z0) * (BALL_R + 0.002);
      }
    }
  }

  // table top
  if (v[1] < 0 && y - BALL_R <= TABLE.H && y0 - BALL_R > TABLE.H - 0.06 && Math.abs(x) <= TABLE.hw + BALL_R * 0.35 && Math.abs(z) <= TABLE.hl + BALL_R * 0.35) {
    const vIn = -v[1];
    y = TABLE.H + BALL_R;
    if (vIn < 0.3) { v[1] = 0; b.p[1] = y; b.p[0] = x; b.p[2] = z; return events; }   // resting / rolling: no new bounce
    // contact-point velocity (floor normal = +y, contact point below the centre)
    const ux = v[0] + BALL_R * w[2], uz = v[2] - BALL_R * w[0];
    const ul = Math.hypot(ux, uz);
    const jn = (1 + E_TABLE) * vIn;                    // impulse per unit mass
    v[1] = E_TABLE * vIn;
    if (ul > 1e-6) {
      const stick = 0.4 * ul;                          // I = 2/5 m r^2 -> sticking impulse = (2/7) ... (hollow ball 2/3: factor 0.4)
      const jt = Math.min(MU_TABLE * jn, stick);
      const tx = -ux / ul, tz = -uz / ul;
      v[0] += jt * tx; v[2] += jt * tz;
      // angular impulse: dw = (r_vec x J) / I with I = 2/3 m r^2  ->  1.5/r * (-Jz, 0, Jx)
      const k = 1.5 / BALL_R;
      w[0] += k * (-(jt * tz)); w[2] += k * (jt * tx);
    }
    events?.push({ type: 'bounce', side: z >= 0 ? 'p' : 'o', x, z, vIn });
  }
  b.p[0] = x; b.p[1] = y; b.p[2] = z;
  if (y < BALL_R && v[1] < 0) {
    events?.push({ type: 'floor' });
    y = BALL_R; b.p[1] = y;
    v[1] = -v[1] * 0.55; v[0] *= 0.7; v[2] *= 0.7;
  }
  return events;
}

// Fly a copy of a ball forward without touching the live one. stop(ball, t, events) returns true to stop.
export function flyForward(ball, tMax, stop, h = 1 / 240) {
  const b = { p: [...ball.p], v: [...ball.v], w: [...ball.w] };
  const ev = [];
  let t = 0;
  while (t < tMax) {
    ev.length = 0;
    stepBall(b, h, ev);
    t += h;
    if (stop(b, t, ev)) break;
  }
  return { ball: b, t };
}

// Spin vectors relative to a horizontal travel direction (dx, dz), unit length.
//   top > 0 topspin, < 0 backspin (rad/s about the axis perpendicular to travel); side > 0 curves to the player's left.
export function spinVector(dx, dz, top, side) {
  return [top * dz, side, -top * dx];
}
// Inverse: the topspin and sidespin components of w for a ball travelling along (vx, vz).
export function spinParts(w, vx, vz) {
  const l = Math.hypot(vx, vz) || 1, dx = vx / l, dz = vz / l;
  return { top: w[0] * dz - w[2] * dx, side: w[1] };
}
