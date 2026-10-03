// Kubb physics: a small deterministic 3D rigid-body world. Every kubb, the king and every baton is a rigid body (mass, inertia,
// quaternion orientation) whose shape is a cluster of spheres; contacts are solved with sequential impulses and Coulomb friction at a
// fixed 1/240 s step. Pure: no clock, no randomness (the throw's human error is sampled by the caller and passed in).
// World units are metres: x across the pitch, y along it (team 0's baseline is y = 0, team 1's is y = FIELD.L), z up.
export const G = 9.81;
export const DT = 1 / 240;
export const SUB = 4;                                   // physics steps per 60 Hz game tick
export const FIELD = { W: 3.6, L: 6.4, MID: 3.2 };
export const KUBB = { w: 0.158, h: 0.34, m: 4.18 };
export const KING = { w: 0.2, h: 0.675, m: 13.9 };
export const BATON = { len: 0.675, r: 0.05, m: 3.18 };
export const BASE_STEP = 0.64;                          // spacing of base kubbs along a baseline
const TAU = Math.PI * 2;

// ---- tiny vector / quaternion helpers (plain arrays, no allocation in the hot loops) ----------------------------------------
const norm3 = (x, y, z) => Math.sqrt(x * x + y * y + z * z);
function qmul(a, b) {
  return [a[0] * b[0] - a[1] * b[1] - a[2] * b[2] - a[3] * b[3], a[0] * b[1] + a[1] * b[0] + a[2] * b[3] - a[3] * b[2],
    a[0] * b[2] - a[1] * b[3] + a[2] * b[0] + a[3] * b[1], a[0] * b[3] + a[1] * b[2] - a[2] * b[1] + a[3] * b[0]];
}
export function qAxis(ax, ay, az, ang) { const n = norm3(ax, ay, az) || 1, s = Math.sin(ang / 2) / n; return [Math.cos(ang / 2), ax * s, ay * s, az * s]; }
function rotMat(q, R) {
  const [w, x, y, z] = q;
  R[0] = 1 - 2 * (y * y + z * z); R[1] = 2 * (x * y - w * z); R[2] = 2 * (x * z + w * y);
  R[3] = 2 * (x * y + w * z); R[4] = 1 - 2 * (x * x + z * z); R[5] = 2 * (y * z - w * x);
  R[6] = 2 * (x * z - w * y); R[7] = 2 * (y * z + w * x); R[8] = 1 - 2 * (x * x + y * y);
}
export function nlerp(a, b, t) {
  let d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
  const s = d < 0 ? -1 : 1;
  const q = [a[0] + (s * b[0] - a[0]) * t, a[1] + (s * b[1] - a[1]) * t, a[2] + (s * b[2] - a[2]) * t, a[3] + (s * b[3] - a[3]) * t];
  const n = Math.hypot(q[0], q[1], q[2], q[3]) || 1;
  return [q[0] / n, q[1] / n, q[2] / n, q[3] / n];
}
export function matOf(q) { const R = new Array(9); rotMat(q, R); return R; }

// ---- shapes ------------------------------------------------------------------------------------------------------------------
function boxSpheres(w, h, r) {
  const sp = [], a = w / 2 - r, levels = Math.max(2, Math.round((h - 2 * r) / (1.7 * r)) + 1);
  for (let k = 0; k < levels; k++) {
    const z = -h / 2 + r + (k * (h - 2 * r)) / (levels - 1);
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) sp.push({ x: sx * a, y: sy * a, z, r });
  }
  sp.push({ x: 0, y: 0, z: -h / 2 + r, r }, { x: 0, y: 0, z: h / 2 - r, r });
  return sp;
}
function batonSpheres() {
  const n = 7, sp = [], half = BATON.len / 2 - BATON.r;
  for (let i = 0; i < n; i++) sp.push({ x: -half + (2 * half * i) / (n - 1), y: 0, z: 0, r: BATON.r });
  return sp;
}
const SHAPES = {
  kubb: { spheres: boxSpheres(KUBB.w, KUBB.h, 0.04), m: KUBB.m, I: [KUBB.m * (KUBB.w ** 2 + KUBB.h ** 2) / 12, KUBB.m * (KUBB.w ** 2 + KUBB.h ** 2) / 12, KUBB.m * (2 * KUBB.w ** 2) / 12], rad: Math.hypot(KUBB.w / 2, KUBB.w / 2, KUBB.h / 2) + 0.04, mu: 0.6 },
  king: { spheres: boxSpheres(KING.w, KING.h, 0.05), m: KING.m, I: [KING.m * (KING.w ** 2 + KING.h ** 2) / 12, KING.m * (KING.w ** 2 + KING.h ** 2) / 12, KING.m * (2 * KING.w ** 2) / 12], rad: Math.hypot(KING.w / 2, KING.w / 2, KING.h / 2) + 0.05, mu: 0.6 },
  baton: { spheres: batonSpheres(), m: BATON.m, I: [0.5 * BATON.m * BATON.r ** 2, BATON.m * (3 * BATON.r ** 2 + BATON.len ** 2) / 12, BATON.m * (3 * BATON.r ** 2 + BATON.len ** 2) / 12], rad: BATON.len / 2 + 0.01, mu: 0.5 },
};
export const halfHeight = (kind) => (kind === 'king' ? KING.h / 2 : kind === 'kubb' ? KUBB.h / 2 : 0);

let NEXT_ID = 1;
export function makeBody(kind, pos, q, o = {}) {
  const sh = SHAPES[kind];
  return {
    uid: NEXT_ID++, kind, id: o.id ?? -1, team: o.team ?? -1, shape: sh, invM: 1 / sh.m, invI: sh.I.map((v) => 1 / v),
    p: pos.slice(), q: q.slice(), v: [0, 0, 0], w: [0, 0, 0], R: new Array(9).fill(0), pp: pos.slice(), pq: q.slice(),
    asleep: !!o.asleep, still: 0, grounded: false, age: 0, flight: !!o.flight, ignoreUntil: o.ignoreUntil ?? 0, ignoreNear: o.ignoreNear ?? null,
  };
}
export function standingQ(yaw) { return qAxis(0, 0, 1, yaw); }
export const upDot = (b) => { rotMat(b.q, b.R); return b.R[8]; };

// ---- the world ---------------------------------------------------------------------------------------------------------------
export function newWorld() { return { bodies: [], t: 0, events: [], steps: 0, cool: new Map() }; }
export function addBody(world, b) { rotMat(b.q, b.R); world.bodies.push(b); return b; }
export function removeBody(world, b) { const i = world.bodies.indexOf(b); if (i >= 0) world.bodies.splice(i, 1); }
export function cloneWorld(world) {
  const w2 = newWorld(); w2.t = world.t; w2.steps = world.steps;
  w2.bodies = world.bodies.map((b) => ({ ...b, p: b.p.slice(), q: b.q.slice(), v: b.v.slice(), w: b.w.slice(), R: b.R.slice(), pp: b.pp.slice(), pq: b.pq.slice(), ignoreNear: b.ignoreNear ? b.ignoreNear.slice() : null }));
  return w2;
}
export function savePrev(world) { for (const b of world.bodies) { b.pp = b.p.slice(); b.pq = b.q.slice(); } }

const worldSphere = (b, s, out) => {
  const R = b.R;
  out[0] = b.p[0] + R[0] * s.x + R[1] * s.y + R[2] * s.z;
  out[1] = b.p[1] + R[3] * s.x + R[4] * s.y + R[5] * s.z;
  out[2] = b.p[2] + R[6] * s.x + R[7] * s.y + R[8] * s.z;
};
// I^-1 * vec in world frame
function invIw(b, x, y, z, out) {
  const R = b.R, I = b.invI;
  const lx = (R[0] * x + R[3] * y + R[6] * z) * I[0], ly = (R[1] * x + R[4] * y + R[7] * z) * I[1], lz = (R[2] * x + R[5] * y + R[8] * z) * I[2];
  out[0] = R[0] * lx + R[1] * ly + R[2] * lz; out[1] = R[3] * lx + R[4] * ly + R[5] * lz; out[2] = R[6] * lx + R[7] * ly + R[8] * lz;
}

const SP = [0, 0, 0], SQ = [0, 0, 0], TMP = [0, 0, 0];
const ITER = 7, BETA = 0.18, SLOP = 0.002;

function makeContact(a, bb, px, py, pz, nx, ny, nz, depth, mu) {
  return { a, b: bb, px, py, pz, nx, ny, nz, depth, mu, rax: px - a.p[0], ray: py - a.p[1], raz: pz - a.p[2], rbx: bb ? px - bb.p[0] : 0, rby: bb ? py - bb.p[1] : 0, rbz: bb ? pz - bb.p[2] : 0, jn: 0, jt1: 0, jt2: 0, kn: 0, bias: 0, e: 0, t1: null, t2: null };
}
function effMass(c, dx, dy, dz) {
  const a = c.a, b = c.b;
  // (rA x d)
  let cx = c.ray * dz - c.raz * dy, cy = c.raz * dx - c.rax * dz, cz = c.rax * dy - c.ray * dx;
  invIw(a, cx, cy, cz, TMP);
  let k = a.invM + ((TMP[1] * c.raz - TMP[2] * c.ray) * dx + (TMP[2] * c.rax - TMP[0] * c.raz) * dy + (TMP[0] * c.ray - TMP[1] * c.rax) * dz);
  if (b) {
    cx = c.rby * dz - c.rbz * dy; cy = c.rbz * dx - c.rbx * dz; cz = c.rbx * dy - c.rby * dx;
    invIw(b, cx, cy, cz, TMP);
    k += b.invM + ((TMP[1] * c.rbz - TMP[2] * c.rby) * dx + (TMP[2] * c.rbx - TMP[0] * c.rbz) * dy + (TMP[0] * c.rby - TMP[1] * c.rbx) * dz);
  }
  return k;
}
function relVel(c, out) {
  const a = c.a, b = c.b;
  out[0] = a.v[0] + a.w[1] * c.raz - a.w[2] * c.ray; out[1] = a.v[1] + a.w[2] * c.rax - a.w[0] * c.raz; out[2] = a.v[2] + a.w[0] * c.ray - a.w[1] * c.rax;
  if (b) { out[0] -= b.v[0] + b.w[1] * c.rbz - b.w[2] * c.rby; out[1] -= b.v[1] + b.w[2] * c.rbx - b.w[0] * c.rbz; out[2] -= b.v[2] + b.w[0] * c.rby - b.w[1] * c.rbx; }
}
const RV = [0, 0, 0], DW = [0, 0, 0];
function applyImpulse(c, ix, iy, iz) {
  const a = c.a, b = c.b;
  a.v[0] += ix * a.invM; a.v[1] += iy * a.invM; a.v[2] += iz * a.invM;
  invIw(a, c.ray * iz - c.raz * iy, c.raz * ix - c.rax * iz, c.rax * iy - c.ray * ix, DW);
  a.w[0] += DW[0]; a.w[1] += DW[1]; a.w[2] += DW[2];
  if (b) {
    b.v[0] -= ix * b.invM; b.v[1] -= iy * b.invM; b.v[2] -= iz * b.invM;
    invIw(b, c.rby * iz - c.rbz * iy, c.rbz * ix - c.rbx * iz, c.rbx * iy - c.rby * ix, DW);
    b.w[0] -= DW[0]; b.w[1] -= DW[1]; b.w[2] -= DW[2];
  }
}

function ignores(a, b, world) {
  // a baton that has just left the hand does not collide with what stands right next to the thrower
  for (const [x, y] of [[a, b], [b, a]]) {
    if (x.kind === 'baton' && x.ignoreUntil > world.t && x.ignoreNear && y.kind !== 'baton' && Math.hypot(y.p[0] - x.ignoreNear[0], y.p[1] - x.ignoreNear[1]) < 0.5) return true;
  }
  return false;
}

export function stepWorld(world) {
  const bodies = world.bodies, n = bodies.length;
  world.t += DT; world.steps++;
  for (let i = 0; i < n; i++) {
    const b = bodies[i];
    if (b.asleep) continue;
    b.v[2] -= G * DT; b.grounded = false; b.age += DT;
  }
  const contacts = [];
  for (let i = 0; i < n; i++) {
    const a = bodies[i];
    rotMat(a.q, a.R);
  }
  // ground
  for (let i = 0; i < n; i++) {
    const a = bodies[i];
    if (a.asleep) continue;
    if (a.p[2] - a.shape.rad > 0.02) continue;
    for (const s of a.shape.spheres) {
      worldSphere(a, s, SP);
      if (SP[2] - s.r < 0) {
        const c = makeContact(a, null, SP[0], SP[1], SP[2] - s.r, 0, 0, 1, s.r - SP[2], a.shape.mu);
        c.ground = true; contacts.push(c); a.grounded = true;
      }
    }
  }
  // body pairs
  for (let i = 0; i < n; i++) {
    const a = bodies[i];
    for (let j = i + 1; j < n; j++) {
      const b = bodies[j];
      if (a.asleep && b.asleep) continue;
      const dx = a.p[0] - b.p[0], dy = a.p[1] - b.p[1], dz = a.p[2] - b.p[2], rr = a.shape.rad + b.shape.rad;
      if (dx * dx + dy * dy + dz * dz > rr * rr) continue;
      if (ignores(a, b, world)) continue;
      const mu = Math.min(a.shape.mu, b.shape.mu) * 0.7;
      for (const sa of a.shape.spheres) {
        worldSphere(a, sa, SP);
        for (const sb of b.shape.spheres) {
          worldSphere(b, sb, SQ);
          const ex = SP[0] - SQ[0], ey = SP[1] - SQ[1], ez = SP[2] - SQ[2], R2 = sa.r + sb.r, d2 = ex * ex + ey * ey + ez * ez;
          if (d2 >= R2 * R2) continue;
          const d = Math.sqrt(d2) || 1e-6, nx = d2 > 1e-12 ? ex / d : 0, ny = d2 > 1e-12 ? ey / d : 0, nz = d2 > 1e-12 ? ez / d : 1;
          const px = SQ[0] + nx * sb.r, py = SQ[1] + ny * sb.r, pz = SQ[2] + nz * sb.r;
          contacts.push(makeContact(a, b, px, py, pz, nx, ny, nz, R2 - d, mu));
        }
      }
    }
  }
  // prepare
  for (const c of contacts) {
    c.kn = 1 / effMass(c, c.nx, c.ny, c.nz);
    relVel(c, RV);
    const vn = RV[0] * c.nx + RV[1] * c.ny + RV[2] * c.nz;
    c.e = vn < -1.2 ? (c.ground ? (c.a.kind === 'baton' ? 0.28 : 0.12) : 0.22) : 0;
    c.vn0 = vn;
    c.bias = Math.min(1.5, (BETA / DT) * Math.max(0, c.depth - SLOP));
    // tangents
    const ax = Math.abs(c.nx) < 0.7 ? 1 : 0, ay = ax ? 0 : 1;
    let tx = ay * c.nz, ty = -ax * c.nz, tz = ax * c.ny - ay * c.nx;
    const tl = Math.hypot(tx, ty, tz) || 1; tx /= tl; ty /= tl; tz /= tl;
    c.t1 = [tx, ty, tz];
    c.t2 = [c.ny * tz - c.nz * ty, c.nz * tx - c.nx * tz, c.nx * ty - c.ny * tx];
    c.kt1 = 1 / effMass(c, tx, ty, tz); c.kt2 = 1 / effMass(c, c.t2[0], c.t2[1], c.t2[2]);
    // wake sleepers that are touched by something moving
    if (c.b && (c.a.asleep !== c.b.asleep)) { const s = c.a.asleep ? c.b : c.a; if (Math.abs(c.vn0) > 0.15 || s.v[0] * s.v[0] + s.v[1] * s.v[1] + s.v[2] * s.v[2] > 0.02) { c.a.asleep = false; c.b.asleep = false; c.a.still = 0; c.b.still = 0; } }
  }
  for (let it = 0; it < ITER; it++) {
    for (const c of contacts) {
      relVel(c, RV);
      const vn = RV[0] * c.nx + RV[1] * c.ny + RV[2] * c.nz;
      let dj = -c.kn * (vn + c.e * c.vn0 * (c.e > 0 ? 1 : 0) - c.bias);
      const nj = Math.max(0, c.jn + dj); dj = nj - c.jn; c.jn = nj;
      if (dj) applyImpulse(c, c.nx * dj, c.ny * dj, c.nz * dj);
      relVel(c, RV);
      const lim = c.mu * c.jn;
      const v1 = RV[0] * c.t1[0] + RV[1] * c.t1[1] + RV[2] * c.t1[2];
      let d1 = -c.kt1 * v1, j1 = Math.max(-lim, Math.min(lim, c.jt1 + d1)); d1 = j1 - c.jt1; c.jt1 = j1;
      if (d1) applyImpulse(c, c.t1[0] * d1, c.t1[1] * d1, c.t1[2] * d1);
      relVel(c, RV);
      const v2 = RV[0] * c.t2[0] + RV[1] * c.t2[1] + RV[2] * c.t2[2];
      let d2 = -c.kt2 * v2, j2 = Math.max(-lim, Math.min(lim, c.jt2 + d2)); d2 = j2 - c.jt2; c.jt2 = j2;
      if (d2) applyImpulse(c, c.t2[0] * d2, c.t2[1] * d2, c.t2[2] * d2);
    }
  }
  // events: the strongest normal impulse per body pair, with a short cool-down so a rolling baton does not machine-gun the sound
  for (const c of contacts) {
    if (c.jn < 1.1 * (c.ground ? 1 : 1) || c.jn <= 0) continue;
    const key = c.ground ? `g${c.a.uid}` : `${c.a.uid}-${c.b.uid}`;
    if ((world.cool.get(key) ?? -1) > world.t) continue;
    world.cool.set(key, world.t + 0.09);
    world.events.push({ k: c.ground ? 'ground' : 'hit', a: c.a, b: c.b, s: c.jn, x: c.px, y: c.py, z: c.pz, t: world.t });
  }
  // integrate
  for (let i = 0; i < n; i++) {
    const b = bodies[i];
    if (b.asleep) continue;
    if (b.flight && b.grounded) b.flight = false;
    if (b.grounded) {
      b.w[0] *= 0.988; b.w[1] *= 0.988; b.w[2] *= 0.988;
      b.v[0] *= 0.9985; b.v[1] *= 0.9985;
    } else { b.v[0] *= 0.9998; b.v[1] *= 0.9998; b.v[2] *= 0.9998; }
    b.p[0] += b.v[0] * DT; b.p[1] += b.v[1] * DT; b.p[2] += b.v[2] * DT;
    const wx = b.w[0], wy = b.w[1], wz = b.w[2];
    const dq = qmul([0, wx, wy, wz], b.q);
    const q0 = b.q[0] + 0.5 * DT * dq[0], q1 = b.q[1] + 0.5 * DT * dq[1], q2 = b.q[2] + 0.5 * DT * dq[2], q3 = b.q[3] + 0.5 * DT * dq[3];
    const nn = Math.hypot(q0, q1, q2, q3) || 1;
    b.q[0] = q0 / nn; b.q[1] = q1 / nn; b.q[2] = q2 / nn; b.q[3] = q3 / nn;
    const v2 = b.v[0] * b.v[0] + b.v[1] * b.v[1] + b.v[2] * b.v[2], w2 = wx * wx + wy * wy + wz * wz;
    if (b.grounded && v2 < 0.0036 && w2 < 0.09) { if (++b.still > 36) { b.asleep = true; b.v[0] = b.v[1] = b.v[2] = 0; b.w[0] = b.w[1] = b.w[2] = 0; } } else b.still = 0;
  }
}

// ---- helpers about bodies ----------------------------------------------------------------------------------------------------
export const isDown = (b) => { rotMat(b.q, b.R); return b.R[8] < 0.8 || b.p[2] < halfHeight(b.kind) - 0.05; };
export function bodySpeed(b) { return Math.hypot(b.v[0], b.v[1], b.v[2]) + 0.3 * Math.hypot(b.w[0], b.w[1], b.w[2]); }
export function settled(world) {
  for (const b of world.bodies) if (!b.asleep && (b.kind !== 'baton' || b.flight || bodySpeed(b) > 0.08)) return false;
  return true;
}
// Everything that is not a baton is at rest (a rolling baton far from the kubbs does not hold the game up).
export function kubbsAtRest(world) {
  for (const b of world.bodies) if (b.kind !== 'baton' && !b.asleep && bodySpeed(b) > 0.07) return false;
  return true;
}

// ---- the throw ---------------------------------------------------------------------------------------------------------------
export const LOFTS = [{ name: 'Low', a: 0.66 }, { name: 'Medium', a: 0.9 }, { name: 'High', a: 1.15 }];
export const SPINS = [{ name: 'Slow', rev: 1.0 }, { name: 'Medium', rev: 1.25 }, { name: 'Fast', rev: 1.5 }];
export const H0 = 0.72;      // release height
export const MAX_REACH = 6.9;
// Where the baton leaves the hand: just behind the throw line, at x.
export const releasePoint = (sx, lineY, dir) => ({ x: sx, y: lineY - dir * 0.12, z: H0 });
// The launch for a baton whose lower end should first touch the grass at (ax, ay), with a given loft and spin, plus error terms (all zero = the plan
// itself). The aim ring is therefore "where the baton comes down", whatever the loft and spin: the launch speed is solved so that the lowest end of the
// turning baton reaches the grass exactly there (a few iterations of an analytic flight, no randomness).
const buildLaunch = (r, ang, a, rev, th0, dir, Dh) => {
  const ca = Math.cos(a), ta = Math.tan(a);
  const v = Dh * Math.sqrt(G / (2 * ca * ca * (Dh * ta + H0)));
  return { r, ang, a, v, t: Dh / (v * ca), rev, th0, dir, Dh };
};
// Where the lowest end of the baton first touches the grass in free flight (the baton turns at a constant rate, only gravity acts).
export function contactOf(L) {
  const hx = Math.sin(L.ang), hy = Math.cos(L.ang), vh = L.v * Math.cos(L.a), vz = L.v * Math.sin(L.a), om = (TAU * L.rev) / L.t, half = BATON.len / 2 - BATON.r;
  const dt = 0.002;
  for (let i = 1; i < 3000; i++) {
    const t = i * dt, z = L.r.z + vz * t - 0.5 * G * t * t, th = L.th0 + om * t, sn = Math.sin(th), cs = Math.cos(th);
    if (z - half * Math.abs(sn) - BATON.r <= 0 && t > 0.05) {
      const d = vh * t, sg = sn >= 0 ? -1 : 1;
      return { x: L.r.x + hx * d + hx * cs * half * sg, y: L.r.y + hy * d + hy * cs * half * sg, t };
    }
  }
  return { x: L.r.x + hx * L.Dh, y: L.r.y + hy * L.Dh, t: L.t };
}
export function launchOf(sx, lineY, dir, ax, ay, loft, spin, err = {}) {
  const r = releasePoint(sx, lineY, dir);
  const dx = ax - r.x, dy = ay - r.y, Dt = Math.max(0.6, Math.hypot(dx, dy)), ang = Math.atan2(dx, dy);
  const a = LOFTS[loft].a, rev = SPINS[spin].rev, th0 = 1.3;
  let Dh = Dt + 0.25, L = buildLaunch(r, ang, a, rev, th0, dir, Dh);
  for (let i = 0; i < 7; i++) {
    const c = contactOf(L), d = Math.hypot(c.x - r.x, c.y - r.y);
    if (Math.abs(Dt - d) < 0.004) break;
    Dh = Math.max(0.4, Dh + (Dt - d)); L = buildLaunch(r, ang, a, rev, th0, dir, Dh);
  }
  L.tc = contactOf(L).t;
  return { ...L, ang: L.ang + (err.lat ?? 0), v: L.v * (1 + (err.spd ?? 0)), a: L.a + (err.loft ?? 0), rev: L.rev + (err.rev ?? 0), th0: L.th0 + (err.th0 ?? 0) };
}
export function batonFrom(L, id) {
  const hx = Math.sin(L.ang), hy = Math.cos(L.ang);
  const vh = L.v * Math.cos(L.a);
  // orientation: the long axis lies in the vertical plane of travel, at angle th0 from the heading
  const ax = hx * Math.cos(L.th0), ay = hy * Math.cos(L.th0), az = Math.sin(L.th0);
  // body x axis -> (ax, ay, az): rotate x onto it
  const q = quatFromTo([1, 0, 0], [ax, ay, az]);
  const b = makeBody('baton', [L.r.x, L.r.y, L.r.z], q, { id, flight: true, ignoreUntil: 0.3, ignoreNear: [L.r.x, L.r.y] });
  b.v = [hx * vh, hy * vh, L.v * Math.sin(L.a)];
  const om = (TAU * L.rev) / L.t;
  // end over end, the top moving forward: rotation axis = up x heading... (hx, hy) is the heading; axis = (hy, -hx, 0)
  b.w = [hy * om, -hx * om, 0];
  b.flightT = L.t;
  return b;
}
function quatFromTo(a, b) {
  const d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  if (d > 0.99999) return [1, 0, 0, 0];
  if (d < -0.99999) return [0, 0, 0, 1];
  const cx = a[1] * b[2] - a[2] * b[1], cy = a[2] * b[0] - a[0] * b[2], cz = a[0] * b[1] - a[1] * b[0];
  const q = [1 + d, cx, cy, cz], n = Math.hypot(q[0], q[1], q[2], q[3]);
  return [q[0] / n, q[1] / n, q[2] / n, q[3] / n];
}
// The predicted flight (no spin, no error) for the aim overlay: points (x, y, z) every ~0.04 s until it lands.
export function pathOf(L, n = 28) {
  const hx = Math.sin(L.ang), hy = Math.cos(L.ang), vh = L.v * Math.cos(L.a), vz = L.v * Math.sin(L.a), out = [], T = L.tc ?? L.t;
  for (let i = 0; i <= n; i++) {
    const t = (T * i) / n;
    out.push({ x: L.r.x + hx * vh * t, y: L.r.y + hy * vh * t, z: Math.max(0, L.r.z + vz * t - 0.5 * G * t * t) });
  }
  return out;
}
