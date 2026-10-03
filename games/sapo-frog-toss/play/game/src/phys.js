// The sapo table and the discs: pure, deterministic physics (fixed step, no clock, no randomness).
// World units are metres. x across the table (0 = centre), z from the front edge (0) to the back board (TD), y up from the table top (0).
// The thrower stands at z = HAND_Z with the hand at height HAND_Y. Everything is drawn scaled up a little so a disc reads on a phone.
export const DT = 1 / 120;
export const G = 9.8;
export const HW = 0.45, TD = 0.9;                 // half width and depth of the table top
export const A = 0.04;                            // disc radius
export const DISC_H = 0.014;                      // disc thickness
export const HAND = { x: 0, y: 0.8, z: -1.8 };
export const BOARD_H = 0.32;                      // height of the back board
export const FROG = { x: 0, z: 0.77, r: 0.115, h: 0.17 };
export const FLOOR_Y = -0.75;
export const MOUTH = { id: 'mouth', x: 0, z: 0.555, R: 0.040, v: 400 };
// The holes. `v` is the score of a disc that drops in; smaller or harder holes are worth more.
export const HOLES = [
  MOUTH,
  { id: 'mill', x: 0, z: 0.31, R: 0.042, v: 300 },
  { id: 'bridgeL', x: -0.285, z: 0.14, R: 0.052, v: 200 },
  { id: 'bridgeR', x: 0.285, z: 0.14, R: 0.052, v: 200 },
  { id: 'sideL', x: -0.31, z: 0.44, R: 0.05, v: 150 },
  { id: 'sideR', x: 0.31, z: 0.44, R: 0.05, v: 150 },
  { id: 'cornerL', x: -0.335, z: 0.77, R: 0.042, v: 250 },
  { id: 'cornerR', x: 0.335, z: 0.77, R: 0.042, v: 250 },
];
export const holeById = (id) => HOLES.find((h) => h.id === id);
export const STYLES = [{ id: 'lob', T0: 0.68, T1: 0.1 }, { id: 'drive', T0: 0.55, T1: 0.06 }];
export const SPIN_MAX = 2;

const E_VERT = 0.22, K_LOB = 0.14, K_DRIVE = 0.42, MU = 0.7 * G, CURL = 4.0;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const onTable = (x, z) => x >= -HW && x <= HW && z >= 0 && z <= TD;

export const newDisc = (id, owner, x, z) => ({ id, owner, x, y: 0, z, vx: 0, vy: 0, vz: 0, st: 'rest', px: x, py: 0, pz: z, ang: id * 1.7, w: 0, spin: 0, hole: null, tin: 0, hit: 0 });

// The velocity that lands a disc at (ax, az) after the flight time of the chosen style. The flight curves with the spin (a sideways
// force) but is aimed to land on the ring; the spin then shows on the table (a curl while sliding and a sideways kick on every bounce).
export function flightTime(style, az) { const s = STYLES[style]; return s.T0 + s.T1 * Math.max(0, az); }
export function launchFor(plan) {
  const T = flightTime(plan.style, plan.az), sp = (plan.spin | 0) * 0.5;
  const ax = sp * 0.9;                                         // sideways acceleration in flight
  return { vx: (plan.ax - HAND.x - 0.5 * ax * T * T) / T, vy: (0.5 * G * T * T - HAND.y) / T, vz: (plan.az - HAND.z) / T, ax, spin: plan.spin | 0, T };
}
export function launchDisc(id, owner, plan) {
  const L = launchFor(plan), d = newDisc(id, owner, HAND.x, HAND.z);
  Object.assign(d, { y: HAND.y, vx: L.vx, vy: L.vy, vz: L.vz, st: 'fly', spin: L.spin, style: plan.style | 0, ax: L.ax, w: 14 + L.spin * 6, hit: 0 });
  d.px = d.x; d.py = d.y; d.pz = d.z;
  return d;
}
// The path of a plan (for the aim line and the Think hint): points along the flight, in world coordinates.
export function planPath(plan, n = 28) {
  const L = launchFor(plan), pts = [];
  for (let i = 0; i <= n; i++) { const t = (i / n) * L.T; pts.push({ x: HAND.x + L.vx * t + 0.5 * L.ax * t * t, y: HAND.y + L.vy * t - 0.5 * G * t * t, z: HAND.z + L.vz * t }); }
  return pts;
}

export function newSim(discs, fly) {
  const list = discs.map((d) => ({ ...d }));
  if (fly) list.push(fly);
  return { t: 0, discs: list, events: [], done: !fly, tick: 0 };
}
export const snapSim = (sim) => { for (const d of sim.discs) { d.px = d.x; d.py = d.y; d.pz = d.z; d.pang = d.ang; } };
const ev = (sim, k, d, o) => sim.events.push({ k, t: sim.t, id: d ? d.id : -1, x: d ? d.x : 0, z: d ? d.z : 0, ...o });

function dropIn(sim, d, h) {
  d.st = 'in'; d.hole = h.id; d.tin = sim.t; d.vx = d.vy = d.vz = 0; d.x = h.x; d.z = h.z; d.y = 0;
  ev(sim, 'in', d, { hole: h.id, v: h.v, owner: d.owner });
}
function holeAt(x, z) {
  for (const h of HOLES) { const dx = x - h.x, dz = z - h.z; if (dx * dx + dz * dz < (h.R - 0.004) * (h.R - 0.004)) return h; }
  return null;
}
function hitFixtures(sim, d) {
  // the back board (a wall) and the frog's body (a low bumper)
  if (d.y < BOARD_H && d.z + A > TD && d.vz > 0) { d.z = TD - A; const s = Math.abs(d.vz); d.vz = -d.vz * 0.42; d.vx *= 0.8; d.hit++; ev(sim, 'board', d, { s }); }
  if (d.y < FROG.h) {
    const dx = d.x - FROG.x, dz = d.z - FROG.z, dist = Math.hypot(dx, dz), min = FROG.r + A;
    if (dist < min && dist > 1e-6) {
      const nx = dx / dist, nz = dz / dist, vn = d.vx * nx + d.vz * nz;
      d.x = FROG.x + nx * min; d.z = FROG.z + nz * min;
      if (vn < 0) { d.vx -= 1.0 * vn * nx; d.vz -= 1.0 * vn * nz; d.hit++; ev(sim, 'frog', d, { s: -vn }); }
    }
  }
}
function collide(sim, a, b) {
  const dx = b.x - a.x, dz = b.z - a.z, d2 = dx * dx + dz * dz, min = 2 * A * 0.98;
  if (d2 >= min * min || d2 < 1e-10) return;
  const dist = Math.sqrt(d2), nx = dx / dist, nz = dz / dist, ov = min - dist;
  const aMov = a.st === 'fly' || a.st === 'slide', bMov = b.st === 'fly' || b.st === 'slide';
  a.x -= nx * ov * (bMov ? 0.5 : 0.5); a.z -= nz * ov * 0.5; b.x += nx * ov * 0.5; b.z += nz * ov * 0.5;
  const rel = (a.vx - b.vx) * nx + (a.vz - b.vz) * nz;
  if (rel > 0) {
    const j = rel * (1 + 0.62) / 2;
    a.vx -= j * nx; a.vz -= j * nz; b.vx += j * nx; b.vz += j * nz;
    if (a.st === 'fly' && a.y < 0.02) { a.vy = Math.max(a.vy, 0); }
    ev(sim, 'clink', a, { s: rel, x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 });
  }
  for (const d of [a, b]) if (d.st === 'rest' && (Math.abs(d.vx) + Math.abs(d.vz)) > 0.02) d.st = 'slide';
  void aMov;
}

export function stepSim(sim) {
  if (sim.done) return;
  const dt = DT, ds = sim.discs;
  sim.t += dt; sim.tick++;
  let active = 0;
  for (const d of ds) {
    if (d.st === 'rest' || d.st === 'in' || d.st === 'out') continue;
    active++;
    if (d.st === 'fly') {
      d.vy -= G * dt; if (d.ax) d.vx += d.ax * dt;
      d.x += d.vx * dt; d.y += d.vy * dt; d.z += d.vz * dt; d.ang += d.w * dt;
      hitFixtures(sim, d);
      if (d.y <= 0 && d.vy < 0 && !d.off && onTable(d.x, d.z)) {
        const h = holeAt(d.x, d.z);
        d.ax = 0;
        if (h) dropIn(sim, d, h);
        else {
          const s = -d.vy;
          d.y = 0; d.hit++;
          if (s > 0.55) { d.vy = s * E_VERT; const k = d.style ? K_DRIVE : K_LOB; d.vx = d.vx * k + d.spin * (d.style ? 0.1 : 0.06); d.vz *= k; d.w *= 0.7; ev(sim, 'land', d, { s }); }
          else { d.vy = 0; d.st = 'slide'; ev(sim, 'land', d, { s: s * 0.5 }); }
        }
      } else if (d.y <= 0 && d.vy < 0 && !d.off && !onTable(d.x, d.z)) { d.off = true; }
      if (d.off && d.y <= FLOOR_Y) { d.st = 'out'; d.y = FLOOR_Y; d.vx = d.vz = d.vy = 0; ev(sim, 'floor', d, { s: 1 }); }
      if (d.off && d.y > FLOOR_Y && (d.z < -0.2 || Math.abs(d.x) > HW + 0.4 || d.z > TD + 0.4) && d.vy < 0 && d.y < -0.25) { /* falling away */ }
      if (d.y < 0 && !d.off) d.y = 0;
    } else if (d.st === 'slide') {
      const sp = Math.hypot(d.vx, d.vz);
      if (sp < 0.06) { d.vx = d.vz = 0; d.st = 'rest'; d.w = 0; ev(sim, 'rest', d, {}); continue; }
      const dec = Math.min(sp, MU * dt), ux = d.vx / sp, uz = d.vz / sp;
      const curl = d.spin * 0.5 * CURL * Math.min(1, sp / 1.2) * dt;
      d.vx = d.vx - ux * dec + uz * curl; d.vz = d.vz - uz * dec - ux * curl;
      d.x += d.vx * dt; d.z += d.vz * dt; d.ang += d.w * dt * Math.min(1, sp);
      d.y = 0;
      hitFixtures(sim, d);
      const h = holeAt(d.x, d.z);
      if (h && onTable(d.x, d.z)) dropIn(sim, d, h);
      else if (!onTable(d.x, d.z)) { d.st = 'fly'; d.off = true; d.vy = 0; d.ax = 0; ev(sim, 'edge', d, {}); }
    }
  }
  // discs touching each other (the flying disc only once it is down on the table)
  for (let i = 0; i < ds.length; i++) {
    const a = ds[i]; if (a.st === 'in' || a.st === 'out' || (a.st === 'fly' && (a.y > 0.03 || a.off))) continue;
    for (let j = i + 1; j < ds.length; j++) {
      const b = ds[j]; if (b.st === 'in' || b.st === 'out' || (b.st === 'fly' && (b.y > 0.03 || b.off))) continue;
      if (a.st === 'rest' && b.st === 'rest') continue;
      collide(sim, a, b);
    }
  }
  if (active === 0 || sim.t > 9) { sim.done = true; for (const d of ds) if (d.st === 'slide' || d.st === 'fly') { d.st = d.off || !onTable(d.x, d.z) ? 'out' : 'rest'; d.vx = d.vz = 0; } }
}
// Tabletop discs still in play: resting on the table.
export const resting = (discs) => discs.filter((d) => d.st === 'rest' && onTable(d.x, d.z));
export function closestDisc(discs) {
  let best = null;
  for (const d of resting(discs)) { const dd = Math.hypot(d.x - MOUTH.x, d.z - MOUTH.z); if (!best || dd < best.d - 1e-9) best = { id: d.id, owner: d.owner, d: dd }; }
  return best;
}
// Run a whole throw to the end. Returns the new list of table discs (those that stay) and what scored.
export function runThrow(table, disc, maxSteps = 1500) {
  const sim = newSim(table, disc); let n = 0;
  while (!sim.done && n++ < maxSteps) stepSim(sim);
  const scored = sim.events.filter((e) => e.k === 'in').map((e) => ({ hole: e.hole, v: e.v, owner: e.owner, id: e.id }));
  return { sim, scored, discs: sim.discs };
}
export { clamp, onTable, holeAt };
