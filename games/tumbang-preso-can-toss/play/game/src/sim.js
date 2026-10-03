// Tumbang Preso: the world and its physics. Pure and deterministic (fixed 1/60 s steps, no clock, no randomness of its own:
// anything random arrives through the commands). Units are metres; x runs left to right, z runs away from the throwers,
// y is up. The toe line is z = 0; everything behind it (z <= 0) is home, where a thrower cannot be tagged.
//
// Pieces: one can standing in a chalk circle, one guard (the taya), three throwers each holding one slipper.
// A thrown slipper flies on a ballistic arc, bounces and skids on the dirt. A hit knocks the can away; the guard must
// fetch it, carry it back into the circle and stand it up before tagging anyone. A thrower who is tagged away from home loses
// the round. All three throwers can throw again whenever they hold their slipper at home and the can is standing.

export const DT = 1 / 60;
export const G = 9.8;
export const FIELD = { x0: -3.2, x1: 3.2, z0: -1.8, z1: 8.2 };
export const LINE_Z = 0;
export const CAN = { z: 4.6, r: 0.3, h: 0.62, hitR: 0.28, circle: 0.85 };
export const HAND_Y = 1.05;
export const SLIP = { r: 0.13, floor: 0.03 };
export const TAG_R = 0.62;
export const PICK_R = 0.6;
export const SPEED = { thrower: 3.4, taya: 3.3, carry: 0.74 };
export const HIT_MIN = 2.5;
export const PLACE_T = 0.4;
export const GRACE_T = 0.45;
export const ROUND_LIMIT = 80;
export const GO_T = 1.2;
export const HOME_SLOTS = [-1.9, 0, 1.9];

// How a slipper is thrown. T is the flight time to the aim point; sig scales the throw's scatter (a flat skim is quick but twitchy).
export const STYLES = {
  lob: { name: 'Lob', T: 1.15, sigX: 1.0, sigZ: 1.3, note: 'High arc. Easier to place, but the can only rolls a short way.' },
  skim: { name: 'Skim', T: 0.5, sigX: 1.5, sigZ: 0.8, note: 'Low and fast. Harder to place, but it sends the can far away.' },
};
export const STYLE_IDS = ['lob', 'skim'];

const hyp = Math.hypot;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const dist = (a, b) => hyp(a.x - b.x, a.z - b.z);

export function createWorld(opts = {}) {
  const n = opts.throwers ?? 3;
  const w = {
    t: 0, go: GO_T, phase: 'play', over: null, overT: 0, limit: opts.limit ?? ROUND_LIMIT,
    can: { mode: 'up', x: 0, y: 0, z: CAN.z, vx: 0, vy: 0, vz: 0, tilt: 0, dir: 0, roll: 0, wob: 0, grace: 0, placeT: 0, px: 0, py: 0, pz: CAN.z, ptilt: 0 },
    agents: [], slips: [], ev: [], evq: [], seq: 0,
    stats: {},
  };
  const slots = n === 3 ? HOME_SLOTS : HOME_SLOTS.slice(0, n);
  w.agents.push({ id: 0, role: 'taya', x: 1.2, z: 3.3, px: 1.2, pz: 3.3, vx: 0, vz: 0, face: 0, speed: opts.tayaSpeed ?? SPEED.taya, carry: false, mx: null, mz: null, throwT: 0, hasSlip: false, fetched: false, tagged: false, step: 0 });
  for (let i = 0; i < n; i++) {
    const a = { id: i + 1, role: 'thrower', x: slots[i], z: -0.55, px: slots[i], pz: -0.55, vx: 0, vz: 0, face: 0, speed: SPEED.thrower, carry: false, mx: null, mz: null, throwT: 0, hasSlip: true, fetched: false, tagged: false, step: 0, slot: slots[i] };
    w.agents.push(a);
    w.slips.push(newSlip(i + 1, a));
    w.stats[a.id] = { hits: 0, safes: 0, throws: 0 };
  }
  return w;
}

function newSlip(owner, a) {
  return { id: owner, owner, mode: 'held', x: a.x, y: 0.9, z: a.z, vx: 0, vy: 0, vz: 0, yaw: 0, spin: 0, pitch: 0, pr: 0, px: a.x, py: 0.9, pz: a.z, pyaw: 0, ppitch: 0, flew: 0, held: owner };
}

export const taya = (w) => w.agents[0];
export const throwers = (w) => w.agents.slice(1);
export const slipOf = (w, id) => w.slips.find((s) => s.owner === id);
export const isHome = (a) => a.z <= LINE_Z + 0.02;
export const canUp = (w) => w.can.mode === 'up';
export const tagLive = (w) => w.phase === 'play' && w.go <= 0 && w.can.mode === 'up' && w.can.grace <= 0;
export const vulnerable = (w, a) => a.role === 'thrower' && !a.tagged && a.z > LINE_Z + 0.02;

// ---- throw -------------------------------------------------------------------------------------------------------
// The launch velocity that carries the slipper to (tx, tz) at the can's mid height in flight time T. `err` is the scatter
// {dx, dz, dT} (metres, metres, fraction) chosen by the caller (the player's skill or the rival's level).
export function throwSolve(a, tx, tz, style, err = { dx: 0, dz: 0, dT: 0 }) {
  const T = STYLES[style].T * (1 + err.dT);
  const gx = tx + err.dx, gz = tz + err.dz, gy = 0.3;
  return { vx: (gx - a.x) / T, vz: (gz - a.z) / T, vy: (gy - HAND_Y + 0.5 * G * T * T) / T, T };
}
export function canThrow(w, a) { return w.phase === 'play' && w.go <= 0 && a.role === 'thrower' && !a.tagged && a.hasSlip && isHome(a) && a.throwT <= 0; }
export function doThrow(w, a, tx, tz, style, err) {
  if (!canThrow(w, a)) return false;
  const s = slipOf(w, a.id), v = throwSolve(a, tx, tz, style, err);
  Object.assign(s, { mode: 'fly', x: a.x, y: HAND_Y, z: a.z, px: a.x, py: HAND_Y, pz: a.z, vx: v.vx, vy: v.vy, vz: v.vz, flew: 0, held: 0, spin: 9 + (a.id % 3) * 1.5, pr: 8 + (a.id % 2) * 3 });
  a.hasSlip = false; a.throwT = 0.6; a.face = Math.atan2(v.vx, v.vz);
  w.stats[a.id].throws++;
  w.evq.push({ k: 'throw', id: a.id, x: a.x, z: a.z, style });
  return true;
}

// ---- the can ---------------------------------------------------------------------------------------------------------
function knockCan(w, s, vrel) {
  const c = w.can;
  const sh = hyp(s.vx, s.vz) || 1e-6;
  let nx = c.x - s.x, nz = c.z - s.z; const nl = hyp(nx, nz) || 1;
  nx /= nl; nz /= nl;
  let dx = 0.65 * s.vx / sh + 0.35 * nx, dz = 0.65 * s.vz / sh + 0.35 * nz;
  const dl = hyp(dx, dz) || 1; dx /= dl; dz /= dl;
  const sp = clamp(0.55 * sh + 0.6, 1.8, 6.5);
  c.mode = 'fly'; c.vx = dx * sp; c.vz = dz * sp; c.vy = 1.5 + 0.12 * sp; c.dir = Math.atan2(dx, dz); c.grace = 0; c.placeT = 0;
  w.ev.push({ k: 'hit', id: s.owner, x: c.x, z: c.z, v: vrel, sp });
  if (w.stats[s.owner]) w.stats[s.owner].hits++;
  // the slipper loses most of its speed and bounces back off the can
  s.vx = -s.vx * 0.22 + nx * -0.8; s.vz = -s.vz * 0.22 + nz * -0.8; s.vy = Math.max(1.4, s.vy * -0.1 + 1.6);
  s.spin *= 0.6;
}

function stepCan(w, dt) {
  const c = w.can;
  c.px = c.x; c.py = c.y; c.pz = c.z; c.ptilt = c.tilt;
  if (c.wob > 0) c.wob = Math.max(0, c.wob - dt);
  if (c.grace > 0) c.grace = Math.max(0, c.grace - dt);
  if (c.mode === 'up') { c.tilt = Math.max(0, c.tilt - dt * 9); return; }
  if (c.mode === 'carried') {
    const t = taya(w);
    c.x = t.x + Math.sin(t.face) * 0.28; c.z = t.z + Math.cos(t.face) * 0.28; c.y = 0.78; c.tilt = Math.max(0, c.tilt - dt * 9); c.vx = c.vz = c.vy = 0;
    return;
  }
  c.tilt = Math.min(1, c.tilt + dt * 5);
  if (c.mode === 'fly') {
    c.vy -= G * dt;
    c.x += c.vx * dt; c.z += c.vz * dt; c.y += c.vy * dt;
    const rr = CAN.r;
    if (c.y <= rr * 0.0 && c.vy < 0) {
      c.y = 0;
      if (c.vy < -1.4) { c.vy = -c.vy * 0.32; w.ev.push({ k: 'canBounce', x: c.x, z: c.z, v: -c.vy }); } else c.vy = 0;
      c.vx *= 0.82; c.vz *= 0.82;
    }
    if (c.y <= 0.0001 && c.vy === 0) c.mode = 'roll';
  }
  if (c.mode === 'roll') {
    c.y = 0;
    const sp = hyp(c.vx, c.vz);
    const ns = Math.max(0, sp - 2.1 * dt);
    if (sp > 1e-6) { c.vx *= ns / sp; c.vz *= ns / sp; }
    c.x += c.vx * dt; c.z += c.vz * dt; c.roll += ns * dt / 0.25;
    if (ns < 0.1) { c.vx = c.vz = 0; c.mode = 'rest'; w.ev.push({ k: 'canRest', x: c.x, z: c.z }); }
  } else if (c.mode === 'fly' && c.y > 0) c.roll += hyp(c.vx, c.vz) * dt / 0.25;
  // field walls: the can bounces off them
  const lim = { x0: FIELD.x0 + CAN.r, x1: FIELD.x1 - CAN.r, z0: FIELD.z0 + CAN.r, z1: FIELD.z1 - CAN.r };
  if (c.x < lim.x0) { c.x = lim.x0; c.vx = Math.abs(c.vx) * 0.45; } else if (c.x > lim.x1) { c.x = lim.x1; c.vx = -Math.abs(c.vx) * 0.45; }
  if (c.z < lim.z0) { c.z = lim.z0; c.vz = Math.abs(c.vz) * 0.45; } else if (c.z > lim.z1) { c.z = lim.z1; c.vz = -Math.abs(c.vz) * 0.45; }
  if (c.mode === 'roll' || c.mode === 'fly') c.dir = hyp(c.vx, c.vz) > 0.2 ? Math.atan2(c.vx, c.vz) : c.dir;
}

// ---- slippers ----------------------------------------------------------------------------------------------------------
function stepSlip(w, s, dt) {
  s.px = s.x; s.py = s.y; s.pz = s.z; s.pyaw = s.yaw; s.ppitch = s.pitch;
  if (s.mode === 'held') {
    const a = w.agents.find((q) => q.id === s.held);
    if (a) { s.x = a.x + Math.cos(a.face) * 0.42; s.z = a.z - Math.sin(a.face) * 0.42; s.y = 0.7; }
    s.pitch = 1.3; s.yaw = a ? -a.face + 1.2 : 0;
    return;
  }
  if (s.mode === 'rest') return;
  const SUB = 4, h = dt / SUB;
  const c = w.can;
  for (let i = 0; i < SUB; i++) {
    s.flew += h;
    const air = s.y > SLIP.floor + 0.02;
    if (air) s.vy -= G * h;
    s.x += s.vx * h; s.z += s.vz * h; s.y += s.vy * h;
    if (s.y <= SLIP.floor && s.vy <= 0) {
      s.y = SLIP.floor;
      if (s.vy < -1.6) { w.ev.push({ k: 'land', x: s.x, z: s.z, v: -s.vy, id: s.owner }); s.vy = -s.vy * 0.26; s.vx *= 0.8; s.vz *= 0.8; s.spin *= 0.7; } else s.vy = 0;
    }
    if (s.y <= SLIP.floor + 0.001 && s.vy === 0) {
      const sp = hyp(s.vx, s.vz), ns = Math.max(0, sp - 6.2 * h);
      if (sp > 1e-6) { s.vx *= ns / sp; s.vz *= ns / sp; }
      s.spin *= Math.max(0, 1 - 3.2 * h);
    }
    // walls
    if (s.x < FIELD.x0) { s.x = FIELD.x0; s.vx = Math.abs(s.vx) * 0.35; } else if (s.x > FIELD.x1) { s.x = FIELD.x1; s.vx = -Math.abs(s.vx) * 0.35; }
    if (s.z < FIELD.z0) { s.z = FIELD.z0; s.vz = Math.abs(s.vz) * 0.35; } else if (s.z > FIELD.z1) { s.z = FIELD.z1; s.vz = -Math.abs(s.vz) * 0.35; }
    // the can
    if (c.mode === 'up') {
      const d = hyp(s.x - c.x, s.z - c.z);
      if (d < CAN.hitR + SLIP.r && s.y < CAN.h + SLIP.r * 0.6 && s.flew > 0.05) {
        const vrel = Math.hypot(s.vx, s.vy, s.vz);
        if (vrel >= HIT_MIN) { knockCan(w, s, vrel); }
        else {
          // a soft touch: the can rocks and rings, the slipper drops
          c.wob = 0.5; w.ev.push({ k: 'tap', x: c.x, z: c.z, v: vrel });
          const nx = (s.x - c.x) / (d || 1), nz = (s.z - c.z) / (d || 1);
          s.x = c.x + nx * (CAN.hitR + SLIP.r + 0.01); s.z = c.z + nz * (CAN.hitR + SLIP.r + 0.01); s.vx = nx * 0.8; s.vz = nz * 0.8; s.vy = 0.5;
        }
      }
    }
  }
  const airborne = s.y > SLIP.floor + 0.03;
  s.yaw += s.spin * dt;
  if (airborne) s.pitch += s.pr * dt; else s.pitch += (Math.round(s.pitch / (2 * Math.PI)) * 2 * Math.PI - s.pitch) * Math.min(1, 14 * dt);
  if (!airborne && hyp(s.vx, s.vz) < 0.18 && s.vy === 0) { s.vx = s.vz = 0; s.mode = 'rest'; s.spin = 0; w.ev.push({ k: 'slipRest', x: s.x, z: s.z, id: s.owner }); }
}

// ---- agents ------------------------------------------------------------------------------------------------------------
function stepAgent(w, a, dt) {
  a.px = a.x; a.pz = a.z;
  if (a.throwT > 0) a.throwT = Math.max(0, a.throwT - dt);
  const frozen = w.phase !== 'play' || w.go > 0;
  let vmax = a.speed * (a.carry ? SPEED.carry : 1);
  let dx = 0, dz = 0, want = 0;
  if (!frozen && a.mx !== null) {
    dx = a.mx - a.x; dz = a.mz - a.z;
    const d = hyp(dx, dz);
    if (d < 0.05) { a.mx = null; a.mz = null; } else { want = Math.min(vmax, d / 0.12); dx /= d; dz /= d; }
  }
  const tvx = dx * want, tvz = dz * want;
  const k = Math.min(1, 11 * dt);
  a.vx += (tvx - a.vx) * k; a.vz += (tvz - a.vz) * k;
  if (a.throwT > 0.35) { a.vx *= 0.6; a.vz *= 0.6; }
  a.x += a.vx * dt; a.z += a.vz * dt;
  const sp = hyp(a.vx, a.vz);
  a.step += sp * dt * 1.7;
  if (sp > 0.4) { let d = Math.atan2(a.vx, a.vz) - a.face; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; a.face += d * Math.min(1, 12 * dt); }
  else if (a.throwT <= 0.35) {
    // idle: look at the can (guard and throwers alike)
    let d = Math.atan2(w.can.x - a.x, w.can.z - a.z) - a.face; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; a.face += d * Math.min(1, 5 * dt);
  }
  const zmin = a.role === 'taya' ? LINE_Z + 0.55 : FIELD.z0 + 0.2;
  a.x = clamp(a.x, FIELD.x0 + 0.25, FIELD.x1 - 0.25); a.z = clamp(a.z, zmin, FIELD.z1 - 0.25);
}

function separate(w) {
  const A = w.agents;
  for (let i = 0; i < A.length; i++) for (let j = i + 1; j < A.length; j++) {
    const p = A[i], q = A[j];
    const d = hyp(p.x - q.x, p.z - q.z);
    if (d < 0.46 && d > 1e-6) {
      const push = (0.46 - d) * 0.5, nx = (p.x - q.x) / d, nz = (p.z - q.z) / d;
      const tz = p.role === 'taya' || q.role === 'taya';
      const f = tz ? 0.4 : 1;
      p.x += nx * push * f; p.z += nz * push * f; q.x -= nx * push * f; q.z -= nz * push * f;
    }
  }
}

// One fixed step. cmds: { [agentId]: { mx, mz (move target or null), stop } }; throws are made directly with doThrow before this call.
export function stepWorld(w, cmds = {}) {
  w.ev = w.evq.splice(0);   // events queued between steps (throws) come first
  const dt = DT;
  if (w.phase === 'play') {
    if (w.go > 0) w.go = Math.max(0, w.go - dt); else w.t += dt;
  } else w.overT += dt;
  for (const a of w.agents) {
    const c = cmds[a.id];
    if (c && w.phase === 'play') { if (c.stop) { a.mx = null; a.mz = null; } else if (c.mx !== undefined) { a.mx = c.mx; a.mz = c.mz; } }
    stepAgent(w, a, dt);
  }
  separate(w);
  for (const s of w.slips) stepSlip(w, s, dt);
  stepCan(w, dt);
  const T = taya(w), c = w.can;
  if (w.phase === 'play') {
    // thrower picks up their own slipper
    for (const a of throwers(w)) {
      if (a.tagged || a.hasSlip) continue;
      const s = slipOf(w, a.id);
      if (s.mode === 'rest' || (s.mode === 'fly' && s.y <= SLIP.floor + 0.05 && hyp(s.vx, s.vz) < 1.5)) {
        if (hyp(s.x - a.x, s.z - a.z) < PICK_R && w.go <= 0) {
          s.mode = 'held'; s.held = a.id; a.hasSlip = true; a.fetched = s.z > LINE_Z + 0.3 || a.z > LINE_Z; a.mx = null; a.mz = null;
          w.ev.push({ k: 'pick', id: a.id, x: a.x, z: a.z });
        }
      }
    }
    for (const a of throwers(w)) {
      if (a.hasSlip && a.fetched && isHome(a)) { a.fetched = false; w.stats[a.id].safes++; w.ev.push({ k: 'safe', id: a.id, x: a.x, z: a.z }); }
    }
    // the guard picks up the can, carries it home and stands it up
    if (!T.carry && (c.mode === 'rest' || (c.mode === 'roll' && hyp(c.vx, c.vz) < 2.2)) && w.go <= 0 && hyp(c.x - T.x, c.z - T.z) < PICK_R) {
      c.mode = 'carried'; T.carry = true; T.mx = null; T.mz = null; c.placeT = 0;
      w.ev.push({ k: 'canPick', x: c.x, z: c.z });
    }
    if (T.carry) {
      if (hyp(T.x - 0, T.z - CAN.z) < CAN.circle - 0.15) {
        c.placeT += dt;
        if (c.placeT >= PLACE_T) {
          T.carry = false; c.mode = 'up'; c.x = 0; c.z = CAN.z; c.y = 0; c.tilt = 0; c.grace = GRACE_T; c.placeT = 0;
          w.ev.push({ k: 'erect', x: c.x, z: c.z });
        }
      } else c.placeT = Math.max(0, c.placeT - dt);
    }
    // tagging
    if (tagLive(w)) {
      let best = null, bd = TAG_R;
      for (const a of throwers(w)) {
        if (!vulnerable(w, a)) continue;
        const d = hyp(a.x - T.x, a.z - T.z);
        if (d < bd) { bd = d; best = a; }
      }
      if (best) {
        best.tagged = true; w.phase = 'over'; w.over = { kind: 'tag', who: best.id, t: w.t };
        w.ev.push({ k: 'tag', id: best.id, x: best.x, z: best.z });
      }
    }
    if (w.phase === 'play' && w.t >= w.limit) { w.phase = 'over'; w.over = { kind: 'timeout', t: w.t }; w.ev.push({ k: 'timeout' }); }
  }
  return w.ev;
}

// ---- helpers the AI and the hints share ----------------------------------------------------------------------------
// Seconds for the guard to get the can standing again from where things are now (0 when it already stands).
export function fixTime(w) {
  const c = w.can, T = taya(w);
  if (c.mode === 'up') return 0;
  const pickPt = c.mode === 'carried' ? T : c;
  const dPick = c.mode === 'carried' ? 0 : Math.max(0, hyp(pickPt.x - T.x, pickPt.z - T.z) - 0.4);
  const dBack = Math.max(0, hyp(c.mode === 'carried' ? T.x : c.x, (c.mode === 'carried' ? T.z : c.z) - CAN.z) - (CAN.circle - 0.2));
  return dPick / T.speed + dBack / (T.speed * SPEED.carry) + PLACE_T + GRACE_T * 0.5;
}
// Where the guard stands after fixing the can: the circle.
export const CIRCLE_PT = { x: 0, z: CAN.z };
export function runTimes(w, a) {
  const s = slipOf(w, a.id), T = taya(w);
  const homeZ = -0.3;
  const dSlip = a.hasSlip ? 0 : Math.max(0, hyp(s.x - a.x, s.z - a.z) - 0.35);
  const dHome = hyp(s.x - clamp(s.x, FIELD.x0 + 0.5, FIELD.x1 - 0.5), Math.max(0, (a.hasSlip ? a.z : s.z) - homeZ));
  const tMe = (dSlip + Math.max(0, (a.hasSlip ? a.z : s.z) - LINE_Z)) / a.speed;
  void dHome;
  // the guard has to stand the can first, then reach the slipper (or the runner's path) from the circle
  const fix = fixTime(w);
  const from = fix > 0 ? CIRCLE_PT : T;
  const target = a.hasSlip ? a : s;
  const tTaya = fix + Math.max(0, hyp(from.x - target.x, from.z - target.z) - TAG_R * 0.6) / T.speed;
  return { tMe, tTaya, slack: tTaya - tMe, fix };
}
