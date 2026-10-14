// The town: a flat 2 m square on beaten snow, a figure made of pins, and a bat that is thrown from far away. Pure and deterministic:
// no clock, no randomness (the caller passes the throw scatter in), fixed 60 steps a second. Units are metres, z grows away from the
// thrower. The bat is a heavy rigid stick (position, velocity, angle, spin); pins are light discs that tip over when hit.
//
// Throw: the player picks where the bat lands (aim x, z) and a style. The bat flies in a low arc, lands, and slides on into the
// figure with the speed and the angle of its style. Everything after the landing is physics: bat-pin hits, pin-pin hits, walls, friction.
export const DT = 1 / 60;
export const SQ = { x0: -1, x1: 1, z0: 0, z1: 2 };
export const BOUNDS = { x0: -2.9, x1: 2.9, z0: -1.7, z1: 3.15 };
export const PIN_R = 0.055;      // a standing pin
export const LIE_R = 0.075;      // a pin lying down takes more room
export const PIN_LEN = 0.3;      // drawn length of a pin
export const BAT_HL = 0.36;      // half length of the bat
export const BAT_R = 0.05;
export const ORIGIN = { x: 0, z: -6.5 };
export const AIM = { x0: -1.15, x1: 1.15, z0: -0.7, z1: 1.7 };
export const MAX_THROWS = 3;
export const WIND_T = 0.55;      // seconds from pressing Throw to the bat leaving the hand (the thrower's wind-up)

export const STYLES = {
  sweep: { id: 'sweep', name: 'Sweep', speed: 3.3, fly: 0.8, across: true, sx: 0.045, sz: 0.1, spin: 0.9, fric: 1.7, blurb: 'Flat and wide: the whole bat sweeps through, gently.' },
  drive: { id: 'drive', name: 'Drive', speed: 5.0, fly: 0.62, across: false, sx: 0.035, sz: 0.08, spin: 0.35, fric: 2.2, blurb: 'End first and firm: a narrow, strong hit.' },
  smash: { id: 'smash', name: 'Smash', speed: 7.4, fly: 0.5, across: false, sx: 0.06, sz: 0.12, spin: 0.5, fric: 2.6, blurb: 'End first and very hard: far, but harder to place.' },
};
export const STYLE_IDS = ['sweep', 'drive', 'smash'];

const M_BAT = 6, M_PIN = 1, E_BAT = 0.5, E_PIN = 0.75;
const I_BAT = M_BAT * (2 * BAT_HL) * (2 * BAT_HL) / 12;
const PIN_DECEL = 3.6, WALL_E = 0.35, PIN_STOP = 0.05;

export function createTown(pins) {
  return {
    t: 0, phase: 'aim', settleT: 0, throws: 0, style: 'drive',
    pins: pins.map((p) => ({ id: p.id, x: p.x, z: p.z, vx: 0, vz: 0, st: 'stand', ang: 0.5 + (p.id % 5) * 0.4, spin: 0, out: false, touched: false })),
    bat: null, ev: [], firstHit: -1, outNow: [], lastLand: null,
  };
}
export const cloneTown = (w) => JSON.parse(JSON.stringify(w));
export const inPlay = (w) => w.pins.filter((p) => !p.out);
export const countIn = (w) => inPlay(w).length;

// Throw the bat. aim = { x, z } is where it should land; noise = { dx, dz, dth } is the throw scatter (metres, radians).
export function throwBat(w, style, aim, noise = { dx: 0, dz: 0, dth: 0 }) {
  const S = STYLES[style];
  const lx = aim.x + noise.dx, lz = aim.z + noise.dz;
  const dx = lx - ORIGIN.x, dz = lz - ORIGIN.z, len = Math.hypot(dx, dz);
  w.bat = {
    mode: 'fly', t: 0, T: S.fly, style, lx, lz, dirx: dx / len, dirz: dz / len,
    x: ORIGIN.x, z: ORIGIN.z, y: 0.6, vx: 0, vz: 0, th: 0, om: 0, spinPhase: 0, trail: 0,
  };
  w.bat.noiseTh = noise.dth;
  w.style = style; w.throws++; w.phase = 'fly'; w.firstHit = -1; w.settleT = 0; w.outNow = [];
  w.ev.push({ k: 'launch', x: ORIGIN.x, z: ORIGIN.z, style });
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function landBat(w) {
  const b = w.bat, S = STYLES[b.style];
  b.mode = 'slide'; b.x = b.lx; b.z = b.lz; b.y = 0.05;
  b.vx = b.dirx * S.speed; b.vz = b.dirz * S.speed;
  const heading = Math.atan2(b.dirz, b.dirx);
  b.th = heading + (S.across ? Math.PI / 2 : 0) + b.noiseTh;
  b.om = (b.noiseTh >= 0 ? 1 : -1) * S.spin * (0.5 + Math.min(1, Math.abs(b.noiseTh) * 8));
  w.ev.push({ k: 'land', x: b.x, z: b.z, v: S.speed });
  w.lastLand = { x: b.x, z: b.z };
}

function batPin(w, b, p) {
  const c = Math.cos(b.th), s = Math.sin(b.th);
  const ax = b.x - c * BAT_HL, az = b.z - s * BAT_HL, ex = 2 * c * BAT_HL, ez = 2 * s * BAT_HL;
  const t = clamp(((p.x - ax) * ex + (p.z - az) * ez) / (4 * BAT_HL * BAT_HL), 0, 1);
  const cx = ax + ex * t, cz = az + ez * t;
  let nx = p.x - cx, nz = p.z - cz;
  const d = Math.hypot(nx, nz), rad = BAT_R + (p.st === 'stand' ? PIN_R : LIE_R);
  if (d >= rad) return false;
  if (d < 1e-6) { nx = -s; nz = c; } else { nx /= d; nz /= d; }
  const rx = cx - b.x, rz = cz - b.z;
  const cvx = b.vx - b.om * rz, cvz = b.vz + b.om * rx;
  const vn = (p.vx - cvx) * nx + (p.vz - cvz) * nz;
  const pen = rad - d;
  if (vn < 0) {
    const rn = rx * nz - rz * nx;
    const j = -(1 + E_BAT) * vn / (1 / M_BAT + 1 / M_PIN + rn * rn / I_BAT);
    p.vx += j / M_PIN * nx; p.vz += j / M_PIN * nz;
    b.vx -= j / M_BAT * nx; b.vz -= j / M_BAT * nz;
    b.om -= j * rn / I_BAT;
    const sp = Math.hypot(p.vx, p.vz);
    if (p.st === 'stand') { p.st = 'lie'; p.ang = Math.atan2(p.vz, p.vx); p.spin = (nx * 0.4 - nz * 0.3 + 0.3) * Math.min(sp, 6) * 1.4; }
    p.touched = true;
    if (w.firstHit < 0) w.firstHit = p.id;
    w.ev.push({ k: 'hit', x: p.x, z: p.z, v: sp, id: p.id });
  }
  p.x += nx * pen; p.z += nz * pen;
  return true;
}

function pinPin(w, a, b) {
  const ra = a.st === 'stand' ? PIN_R : LIE_R, rb = b.st === 'stand' ? PIN_R : LIE_R, rad = ra + rb;
  const dx = b.x - a.x, dz = b.z - a.z;
  const d2 = dx * dx + dz * dz;
  if (d2 >= rad * rad) return;
  const d = Math.sqrt(d2) || 1e-6, nx = dx / d, nz = dz / d;
  const vn = (b.vx - a.vx) * nx + (b.vz - a.vz) * nz;
  const pen = rad - d;
  a.x -= nx * pen / 2; a.z -= nz * pen / 2; b.x += nx * pen / 2; b.z += nz * pen / 2;
  if (vn < 0) {
    const j = -(1 + E_PIN) * vn / 2;
    a.vx -= j * nx; a.vz -= j * nz; b.vx += j * nx; b.vz += j * nz;
    for (const p of [a, b]) {
      if (p.st === 'stand' && Math.hypot(p.vx, p.vz) > 0.25) { p.st = 'lie'; p.ang = Math.atan2(p.vz, p.vx); p.spin = (nx - nz) * 2; }
    }
    if (-vn > 0.5) w.ev.push({ k: 'knock', x: (a.x + b.x) / 2, z: (a.z + b.z) / 2, v: -vn });
  }
}

// Distance from a point to the square (0 inside).
const rectDist = (x, z) => Math.hypot(Math.max(SQ.x0 - x, 0, x - SQ.x1), Math.max(SQ.z0 - z, 0, z - SQ.z1));
// A pin is out when it lies completely outside the square's line (no part of it touches the line or the inside).
export function pinOut(p) {
  if (p.st === 'stand') return rectDist(p.x, p.z) >= PIN_R;
  const hx = Math.cos(p.ang) * PIN_LEN / 2, hz = Math.sin(p.ang) * PIN_LEN / 2;
  const r = LIE_R * 0.75;
  return rectDist(p.x, p.z) >= r && rectDist(p.x + hx, p.z + hz) >= r && rectDist(p.x - hx, p.z - hz) >= r;
}
// How far a pin is from being out (for ranking leftovers): distance to the nearest edge of the square, inside positive.
export const edgeDist = (p) => Math.min(p.x - SQ.x0, SQ.x1 - p.x, p.z - SQ.z0, SQ.z1 - p.z);

export function stepTown(w) {
  w.ev = [];
  if (w.phase === 'aim' || w.phase === 'done') return w.ev;
  w.t += DT;
  const b = w.bat;
  if (b) {
    if (b.mode === 'fly') {
      b.t += DT;
      const u = Math.min(1, b.t / b.T);
      b.x = ORIGIN.x + (b.lx - ORIGIN.x) * u; b.z = ORIGIN.z + (b.lz - ORIGIN.z) * u;
      b.y = 0.05 + 1.25 * 4 * u * (1 - u) + (1 - u) * 0.3;
      b.spinPhase += DT * 22;
      if (u >= 1) landBat(w);
    } else {
      const S = STYLES[b.style];
      const sp = Math.hypot(b.vx, b.vz);
      if (sp > 0) { const k = Math.max(0, sp - S.fric * DT) / sp; b.vx *= k; b.vz *= k; }
      b.om *= 1 - 1.6 * DT;
      b.x += b.vx * DT; b.z += b.vz * DT; b.th += b.om * DT;
      b.spinPhase += DT * 3;
      for (const p of w.pins) { if (!p.out) batPin(w, b, p); }
      const sp2 = Math.hypot(b.vx, b.vz);
      if (sp2 < 0.14 && Math.abs(b.om) < 0.35 || b.z > BOUNDS.z1 + 0.5 || b.x < BOUNDS.x0 - 0.5 || b.x > BOUNDS.x1 + 0.5) { w.ev.push({ k: 'batRest', x: b.x, z: b.z }); w.bat = null; }
    }
  }
  const live = w.pins.filter((p) => !p.out);
  for (const p of live) {
    const sp = Math.hypot(p.vx, p.vz);
    if (sp > 0) {
      const k = Math.max(0, sp - PIN_DECEL * DT) / sp; p.vx *= k; p.vz *= k;
      if (sp * k < PIN_STOP) { p.vx = 0; p.vz = 0; }
      p.x += p.vx * DT; p.z += p.vz * DT;
      p.ang += p.spin * DT; p.spin *= 1 - 3 * DT;
      if (p.x < BOUNDS.x0) { p.x = BOUNDS.x0; p.vx = Math.abs(p.vx) * WALL_E; w.ev.push({ k: 'wall', x: p.x, z: p.z, v: sp }); }
      if (p.x > BOUNDS.x1) { p.x = BOUNDS.x1; p.vx = -Math.abs(p.vx) * WALL_E; w.ev.push({ k: 'wall', x: p.x, z: p.z, v: sp }); }
      if (p.z < BOUNDS.z0) { p.z = BOUNDS.z0; p.vz = Math.abs(p.vz) * WALL_E; }
      if (p.z > BOUNDS.z1) { p.z = BOUNDS.z1; p.vz = -Math.abs(p.vz) * WALL_E; w.ev.push({ k: 'wall', x: p.x, z: p.z, v: sp }); }
    } else p.spin *= 1 - 6 * DT;
  }
  for (let i = 0; i < live.length; i++) for (let j = i + 1; j < live.length; j++) {
    const a = live[i], c = live[j];
    if (Math.abs(a.x - c.x) > 0.2 || Math.abs(a.z - c.z) > 0.2) continue;
    pinPin(w, a, c);
  }
  // settled: no bat and nothing moving
  const moving = !!w.bat || live.some((p) => p.vx !== 0 || p.vz !== 0);
  if (!moving) {
    w.settleT += DT;
    if (w.settleT > 0.4) {
      w.outNow = [];
      for (const p of live) if (pinOut(p)) { p.out = true; w.outNow.push(p.id); }
      w.phase = 'done';
      w.ev.push({ k: 'settled', out: w.outNow.length, left: countIn(w) });
    }
  } else w.settleT = 0;
  if (w.t > 12 && w.phase !== 'done') {   // safety: a runaway pile never stalls a round
    for (const p of live) { p.vx = 0; p.vz = 0; }
    w.bat = null;
  }
  return w.ev;
}

// Run a whole throw to the end on a copy (for the computer players and the hints). Returns { w, out, left, first }.
export function simulate(w0, style, aim, noise) {
  const w = cloneTown(w0);
  throwBat(w, style, aim, noise);
  let n = 0;
  while (w.phase !== 'done' && n++ < 900) stepTown(w);
  return { w, out: w.outNow.length, left: countIn(w), first: w.firstHit };
}
