// Kegeln physics: a fixed-timestep, fully deterministic simulation of the ball and the nine pins on the pin deck.
// Units are metres and seconds. x runs across the lane (right is positive), z runs away from the player.
// The ball and every pin are discs on the floor; a pin that is hit hard enough tips over as a rod hinged at its foot
// (so it falls, slides lying down, and knocks the pins behind it), a pin that is only brushed wobbles and stays up.
export const DT = 1 / 240;
export const LANE_HALF = 0.65;      // half the width of the playing lane
export const BOARD_X = 1.0;         // the side boards of the pin pit
export const BACK_Z = 22.3;         // the back board
export const PIN_Z0 = 19.5;         // distance from the foul line to the front pin
export const PIN_STEP = 0.251;      // centres of neighbouring pins are 0.355 m apart on the diagonal
export const BALL_R = 0.08;         // 16 cm ball
export const BALL_M = 2.85;
export const PIN_R = 0.06;
export const PIN_M = 1.3;
export const PIN_H = 0.385;
export const POWERS = [{ name: 'Soft', v: 5.4 }, { name: 'Medium', v: 6.5 }, { name: 'Firm', v: 7.6 }];
export const HOOKS = [-3, -2, -1, 0, 1, 2, 3];
export const HOOK_A = 0.17;         // lateral acceleration (m/s2) for the strongest hook
const TIP_DV = 1.7;                // a standing pin tips when one hit changes its speed by more than this
const FRICTION = 4.2;               // sliding deceleration of a lying pin
const STAND_FRICTION = 9;           // a standing pin sticks to the deck much harder
const G_ROD = 38;                   // 3g / 2L for a rod hinged at its foot

// Pin layout: id 0 is the front pin, id 4 is the King in the centre.
const ROWS = [[0], [-1, 1], [-2, 0, 2], [-1, 1], [0]];
export const PIN_POS = [];
ROWS.forEach((row, r) => row.forEach((cx) => PIN_POS.push({ x: cx * PIN_STEP, z: PIN_Z0 + r * PIN_STEP })));
export const KING = 4;
export const PIN_NAMES = ['front pin', 'second-row left pin', 'second-row right pin', 'left corner pin', 'King', 'right corner pin', 'fourth-row left pin', 'fourth-row right pin', 'back pin'];

// The launch for a throw. start x0, aim x at the front pin line, power index, hook index (-3..3), lane character.
// vx0 is solved so that the curved path crosses the front-pin line at aimX.
export function launchFor(x0, aimX, powerIdx, hookIdx, laneK = 1) {
  const v = POWERS[powerIdx].v, T = PIN_Z0 / v;
  const A = (hookIdx / 3) * HOOK_A * laneK;
  const hookShift = A * T * T * 0.3;          // see stepSim: the pull ramps up along the lane
  return { x0, vx0: (aimX - x0 - hookShift) / T, vz: v, A: (hookIdx / 3) * HOOK_A, T };
}
// The path the player is shown (lane character 1 = nominal).
export function pathPoints(x0, aimX, powerIdx, hookIdx, n = 14) {
  const L = launchFor(x0, aimX, powerIdx, hookIdx), pts = [];
  for (let i = 0; i <= n; i++) {
    const t = (L.T * i) / n, u = t / L.T;
    const x = x0 + L.vx0 * t + L.A * L.T * L.T * (0.4 * u * u / 2 + 0.6 * u * u * u / 6);
    pts.push({ x, z: L.vz * t });
  }
  return pts;
}

export function newSim(standing, launch, laneK = 1) {
  const pins = PIN_POS.map((p, i) => ({
    id: i, x: p.x, z: p.z, vx: 0, vz: 0, st: standing[i] ? 0 : -1, th: 0, w: 0, dx: 0, dz: 1, wob: 0, ph: 0, r: PIN_R, away: false,
  }));
  return {
    t: 0, done: false, settle: 0, laneK, launch,
    ball: { x: launch.x0, z: 0, vx: launch.vx0, vz: launch.vz, tb: 0, on: true, gutter: false, touched: 0, contact: false },
    pins, events: [], flies: 0, firstHit: -1,
  };
}

const sqrt = Math.sqrt;
function pinRadius(p) { return p.st === 0 ? PIN_R : PIN_R + 0.045 * Math.sin(p.th); }

function collide(s, a, b, ma, mb, e, isBall, bi) {
  const dx = b.x - a.x, dz = b.z - a.z, d = sqrt(dx * dx + dz * dz), ra = a.rad, rb = b.rad;
  if (d >= ra + rb || d < 1e-9) return;
  const nx = dx / d, nz = dz / d, over = ra + rb - d;
  const w = ma + mb;
  a.x -= nx * over * (mb / w); a.z -= nz * over * (mb / w);
  b.x += nx * over * (ma / w); b.z += nz * over * (ma / w);
  const rv = (b.vx - a.vx) * nx + (b.vz - a.vz) * nz;
  if (rv >= 0) return;
  const j = (-(1 + e) * rv) / (1 / ma + 1 / mb);
  a.vx -= (j / ma) * nx; a.vz -= (j / ma) * nz;
  b.vx += (j / mb) * nx; b.vz += (j / mb) * nz;
  for (const [p, m, sgn] of [[a, ma, -1], [b, mb, 1]]) {
    if (!p.pin) continue;
    const dv = j / m;
    if (p.st === 0 && dv > TIP_DV) {
      p.st = 1; p.th = 0.06; p.w = Math.min(15, 2.2 + dv * 2.1);
      const px = sgn * nx, pz = sgn * nz;
      p.dx = px; p.dz = pz;
      s.events.push({ k: 'tip', x: p.x, z: p.z, s: Math.min(1, dv / 6), ball: isBall });
    } else if (p.st === 0) {
      p.wob = Math.min(0.5, p.wob + dv * 0.3); s.events.push({ k: 'tap', x: p.x, z: p.z, s: Math.min(1, dv / 2), ball: isBall });
    } else if (p.st === 1 && dv > 1.5) {
      p.w += dv * 0.7;
    }
  }
  if (isBall) { s.ball.contact = true; if (s.firstHit < 0) s.firstHit = bi; }
  else if (j > 1.2) s.events.push({ k: 'clack', x: (a.x + b.x) / 2, z: (a.z + b.z) / 2, s: Math.min(1, j / 8) });
}

export function stepSim(s, dt = DT) {
  if (s.done) return;
  s.t += dt;
  const b = s.ball;
  // ---- ball ----
  if (b.on) {
    if (!b.contact && b.z < PIN_Z0 - 0.4) {
      b.tb += dt;
      const u = Math.min(1, b.tb / s.launch.T);
      b.vx += s.launch.A * s.laneK * (0.4 + 0.6 * u) * dt;
    }
    b.x += b.vx * dt; b.z += b.vz * dt;
    if (!b.gutter && Math.abs(b.x) > LANE_HALF + 0.03 && b.z < PIN_Z0 - 0.3) {
      b.gutter = true; s.events.push({ k: 'gutter', x: b.x, z: b.z });
    }
    if (b.gutter) { b.x = Math.max(-0.8, Math.min(0.8, b.x)); b.vx *= 0.9; }
    if (b.z > BACK_Z - 0.2 || (b.contact && b.vz < 0.3 && Math.abs(b.vx) < 0.3 && b.t2 > 1.5)) { b.on = false; s.events.push({ k: 'net', x: b.x, z: b.z }); }
    if (b.contact) b.t2 = (b.t2 || 0) + dt;
    if (b.contact && Math.abs(b.x) > BOARD_X - BALL_R) { b.x = Math.sign(b.x) * (BOARD_X - BALL_R); b.vx *= -0.3; }
  }
  // ---- pins ----
  const P = s.pins;
  for (const p of P) {
    if (p.st < 0) continue;
    p.pin = true;
    p.x += p.vx * dt; p.z += p.vz * dt;
    const sp = sqrt(p.vx * p.vx + p.vz * p.vz);
    if (sp > 0) {
      const dec = (p.st === 0 ? STAND_FRICTION : FRICTION) * dt;
      const k = Math.max(0, sp - dec) / sp; p.vx *= k; p.vz *= k;
      if (p.st === 1 && sp > 1) { /* sliding while tipping */ }
    }
    if (p.st === 0) { p.wob *= Math.exp(-3.2 * dt); p.ph += 22 * dt; }
    else if (p.st === 1) {
      p.w += G_ROD * Math.sin(p.th) * dt; p.th += p.w * dt;
      if (p.th >= Math.PI / 2) {
        if (p.w > 2.2) { s.events.push({ k: 'thump', x: p.x, z: p.z, s: Math.min(1, p.w / 9) }); p.th = Math.PI / 2 - 0.02; p.w = -p.w * 0.22; }
        else { p.th = Math.PI / 2; p.w = 0; p.st = 2; }
      }
    }
    p.rad = pinRadius(p);
    // boards
    const lim = BOARD_X - p.rad;
    if (p.x > lim) { p.x = lim; p.vx *= -0.3; p.vz *= 0.8; } else if (p.x < -lim) { p.x = -lim; p.vx *= -0.3; p.vz *= 0.8; }
    if (p.z > BACK_Z - p.rad) { p.z = BACK_Z - p.rad; p.vz *= -0.35; }
  }
  if (b.on && b.z > PIN_Z0 - 0.5 && !b.gutter) {
    b.rad = BALL_R; b.pin = false;
    for (let i = 0; i < 9; i++) {
      const p = P[i]; if (p.st < 0) continue;
      collide(s, b, p, BALL_M, PIN_M, 0.5, true, i);
    }
  }
  for (let i = 0; i < 9; i++) {
    const a = P[i]; if (a.st < 0) continue;
    for (let j = i + 1; j < 9; j++) {
      const c = P[j]; if (c.st < 0) continue;
      collide(s, a, c, PIN_M, PIN_M, 0.4, false, 0);
    }
  }
  // ---- done? ----
  let moving = b.on && b.contact;
  if (b.on && !b.contact) moving = true;
  for (const p of P) if (p.st >= 0 && (p.st === 1 || p.vx * p.vx + p.vz * p.vz > 0.0009)) moving = true;
  if (!moving) { s.settle += dt; if (s.settle > 0.5) s.done = true; } else s.settle = 0;
  if (s.t > 14) s.done = true;
}

export function isDown(p) { return p.st > 0 || Math.abs(p.x) > LANE_HALF + 0.02; }
// Result of a finished (or running) simulation: which of the pins that were standing are now down.
export function simResult(s) {
  const down = P_ARR(), standing = P_ARR();
  let n = 0;
  s.pins.forEach((p, i) => {
    if (p.st < 0) return;
    if (isDown(p)) { down[i] = true; n++; } else standing[i] = true;
  });
  return { down, standing, count: n, pudel: s.ball.gutter, kingStands: !!standing[KING] };
}
function P_ARR() { return new Array(9).fill(false); }
export function runToEnd(s, maxSteps = 4000) { let n = 0; while (!s.done && n++ < maxSteps) stepSim(s); return s; }
export const ALL = () => new Array(9).fill(true);
