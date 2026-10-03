// Cornhole physics: a fixed-timestep, fully deterministic simulation of one bag in flight and every bag on (or off) the far board.
// Units are metres and seconds. World: x across (right is positive), y up, z away from the thrower, z = 0 is the throwing line.
// The board is the real size: 24 x 48 in (0.610 x 1.219 m), its front edge 27 ft (8.23 m) from the throwing line, the front edge about
// 3.5 in and the back edge 12 in off the ground (so it slopes up away from the thrower), a 6 in hole whose centre is 9 in from the back edge.
// A bag is 6 x 6 in. On the board a bag is a disc in board coordinates (u across, v along the slope from the front edge).
export const DT = 1 / 240;
export const G = 9.81;
export const BOARD_W = 0.6096, BOARD_L = 1.2192, BOARD_Z0 = 8.2296;
export const H_FRONT = 0.0889, H_BACK = 0.3048;
export const SIN_A = (H_BACK - H_FRONT) / BOARD_L, COS_A = Math.sqrt(1 - SIN_A * SIN_A);
export const HOLE_R = 0.0762, HOLE_V = BOARD_L - 0.2286;
export const BAG_R = 0.082, BAG_HALF = 0.0762, BAG_T = 0.032;   // collision radius on the board, half side, thickness
export const V_CAP = 4.0;
export const SHOVE = 0.4;
export const MU_K = 0.46, MU_LAND = 0.35, E_BAG = 0.2;
export const RELEASE = { x: 0, y: 1.2, z: 0.5 };
export const STYLES = [
  { id: 0, name: 'Slide', apex: 0.2, rev: 0, errX: 1.2, errZ: 1.9, note: 'Low and fast: lands at the front and slides' },
  { id: 1, name: 'Arc', apex: 0.65, rev: 1, errX: 1.0, errZ: 1.0, note: 'Medium arc: lands flat and slides a little' },
  { id: 2, name: 'Flip', apex: 1.0, rev: 2, errX: 0.9, errZ: 0.8, note: 'High lob with a full flip: drops and stays' },
];
export const SPINS = [-2, -1, 0, 1, 2];
export const AIM_Z0 = 7.5, AIM_Z1 = 10.1, AIM_X = 0.62;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const surfaceH = (z) => H_FRONT + (z - BOARD_Z0) * (SIN_A / COS_A);
export function boardToWorld(u, v) { return { x: u, y: H_FRONT + v * SIN_A, z: BOARD_Z0 + v * COS_A }; }
export function worldToBoard(x, y, z) {
  const dy = y - H_FRONT, dz = z - BOARD_Z0;
  return { u: x, v: dy * SIN_A + dz * COS_A, h: dy * COS_A - dz * SIN_A };
}
export const holeWorld = () => boardToWorld(0, HOLE_V);

// ---- launch ------------------------------------------------------------------------------------------------------
// A throw is planned as: style, spin, and the point the bag should land at (aimX, aimZ). Returns the launch velocity that gets there
// without drag (the simulation uses no drag, so the plan and the flight agree exactly).
export function launchFor(plan) {
  const st = STYLES[plan.style], R = RELEASE;
  const dx = plan.aimX - R.x, dz = plan.aimZ - R.z, D = Math.hypot(dx, dz);
  const ht = (plan.aimZ >= BOARD_Z0 && plan.aimZ <= BOARD_Z0 + BOARD_L * COS_A ? surfaceH(plan.aimZ) : 0) + BAG_T;
  const vy = Math.sqrt(2 * G * st.apex);                         // every style has its own height above the hand
  const T = (vy + Math.sqrt(vy * vy + 2 * G * (R.y - ht))) / G, vh = D / T;
  return { x0: R.x, y0: R.y, z0: R.z, vx: (vh * dx) / D, vy, vz: (vh * dz) / D, T, style: plan.style, spin: plan.spin, wp: (st.rev * Math.PI) / T, p0: 0 };
}
// What the player is shown: the flight arc of the plan up to the landing point.
export function arcPoints(plan, n = 16) {
  const L = launchFor(plan), pts = [];
  for (let i = 0; i <= n; i++) { const t = (L.T * i) / n; pts.push({ x: L.x0 + L.vx * t, y: L.y0 + L.vy * t - 0.5 * G * t * t, z: L.z0 + L.vz * t }); }
  return pts;
}
// A person's hand (or a computer's) is never perfect: lat / dep are the 1-sigma errors (m) of the landing point.
export function throwWithError(plan, lat, dep, g1, g2) {
  const st = STYLES[plan.style];
  const p = { ...plan, aimX: plan.aimX + g1 * lat * st.errX, aimZ: clamp(plan.aimZ + g2 * dep * st.errZ, 5, 12) };
  const L = launchFor(p);
  const L0 = launchFor(plan);
  return { ...L, wp: L0.wp, planned: { x: plan.aimX, z: plan.aimZ } };
}

// ---- state ----------------------------------------------------------------------------------------------------------
export function newBag(id, side) {
  return { id, side, st: 'rack', dead: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, u: 0, v: 0, vu: 0, vv: 0, yaw: 0, wyaw: 0, pitch: 0, wp: 0, roll: 0, spin: 0, sq: 0, hop: 0, fall: 0, T: 0 };
}
export const cloneBags = (bags) => bags.map((b) => ({ ...b }));
// bags: the bags already thrown this round (board / hole / ground states). `launch` is the new throw (or null: nothing in flight).
export function newSim(bags, launch, bagId, side) {
  const sim = { t: 0, done: false, still: 0, bags: cloneBags(bags), events: [], flying: null, pv: null, landed: false };
  if (launch) {
    const b = newBag(bagId, side);
    Object.assign(b, { st: 'free', x: launch.x0, y: launch.y0, z: launch.z0, vx: launch.vx, vy: launch.vy, vz: launch.vz, wp: launch.wp, pitch: launch.p0, spin: launch.spin, wyaw: launch.spin * 3.2 + (launch.style === 0 ? 4 : 0), T: launch.T, style: launch.style, age: 0 });
    sim.bags.push(b); sim.flying = b;
  } else { sim.landed = true; }
  return sim;
}
const ev = (sim, o) => sim.events.push(o);

// ---- landing on the board -------------------------------------------------------------------------------------------
function landOnBoard(sim, b) {
  const p = worldToBoard(b.x, b.y, b.z);
  const vn = b.vy * COS_A - b.vz * SIN_A, vt = b.vy * SIN_A + b.vz * COS_A, vu = b.vx;
  const flatness = Math.abs(Math.cos(b.pitch));
  const flat = flatness >= 0.8;
  const e = flat ? 0.03 : 0.2, grip = flat ? 1 : 0.55 + 0.45 * flatness;
  const imp = Math.max(0, -vn);
  let s = Math.hypot(vt, vu);
  const raw = Math.max(0, s * (1 - 0.4 * grip) - MU_LAND * (1 + e) * imp * grip), ns = V_CAP * (1 - Math.exp(-raw / V_CAP));
  const k = s > 1e-6 ? ns / s : 0;
  // A bag that lands on or against another bag shoves it along, with part of the speed it arrived with (before the cloth soaks it up).
  for (const c of sim.bags) {
    if (c === b || c.st !== 'board') continue;
    const dx = c.u - p.u, dy = c.v - p.v, d = Math.hypot(dx, dy);
    if (d >= 2 * BAG_R * 1.05) continue;
    const mx = s > 1e-6 ? vu / s : 0, my = s > 1e-6 ? vt / s : 1, ax = d > 1e-6 ? dx / d : mx, ay = d > 1e-6 ? dy / d : my;
    let ux = 0.6 * mx + 0.4 * ax, uy = 0.6 * my + 0.4 * ay; const un = Math.hypot(ux, uy) || 1; ux /= un; uy /= un;
    const k = SHOVE * Math.min(s, 10) * (1 - d / (2 * BAG_R * 1.05) * 0.5);
    c.vu += ux * k; c.vv += uy * k; c.wyaw += ux * 2;
    ev(sim, { k: 'bump', x: c.u, v: c.v, s: Math.min(1.4, k / 2) });
  }
  b.st = 'board'; b.u = p.u; b.v = p.v; b.vu = vu * k; b.vv = vt * k + (flat ? 0 : 0.35 * flatnessFlop(flatness));
  b.vy = 0; b.vx = 0; b.vz = 0;
  b.sq = 1; b.hop = e * imp * 0.04; b.landStrength = imp; b.flat = flat; b.landV = p.v; b.landU = p.u; b.lf = { yaw: b.yaw, pitch: b.pitch };
  b.yaw = b.yaw || 0;
  sim.landed = true;
  ev(sim, { k: 'land', id: b.id, x: b.x, y: surfaceH(b.z), z: b.z, s: Math.min(1.6, imp / 5), flat, board: true });
}
const flatnessFlop = (f) => (1 - f) * 2;

function landOnGround(sim, b) {
  const imp = Math.max(0, -b.vy);
  b.st = 'ground'; b.dead = true; b.y = BAG_T;
  const s = Math.hypot(b.vx, b.vz), ns = Math.max(0, s - 0.9 * imp * 1.1), k = s > 1e-6 ? ns / s : 0;
  b.vx *= k; b.vz *= k; b.vy = 0; b.sq = 1; b.hop = 0; b.landStrength = imp; b.lf = { yaw: b.yaw, pitch: b.pitch };
  sim.landed = true;
  ev(sim, { k: 'ground', id: b.id, x: b.x, y: 0, z: b.z, s: Math.min(1.4, imp / 5) });
}

// ---- one step ---------------------------------------------------------------------------------------------------------
export function snapSim(s) {
  s.pv = s.bags.map((b) => ({ id: b.id, x: b.x, y: b.y, z: b.z, u: b.u, v: b.v, yaw: b.yaw, pitch: b.pitch, st: b.st }));
}
export function stepSim(sim) {
  sim.t += DT;
  const bags = sim.bags;
  for (const b of bags) {
    if (b.sq > 0) b.sq = Math.max(0, b.sq - DT * 5);
    if (b.st === 'free') stepFree(sim, b);
    else if (b.st === 'ground') stepGround(b);
    else if (b.st === 'hole') b.fall = Math.min(1, b.fall + DT * 3.2);
  }
  // board bags
  for (const b of bags) if (b.st === 'board') stepBoard(sim, b);
  for (let i = 0; i < bags.length; i++) {
    const a = bags[i]; if (a.st !== 'board') continue;
    for (let j = i + 1; j < bags.length; j++) { const c = bags[j]; if (c.st === 'board') collide(sim, a, c); }
  }
  for (const b of bags) if (b.st === 'board') edgeAndHole(sim, b);
  // settled?
  let moving = !sim.landed;
  for (const b of bags) {
    if (b.st === 'free') moving = true;
    else if (b.st === 'board' && (Math.abs(b.vu) + Math.abs(b.vv) > 0.01 || b.sq > 0)) moving = true;
    else if (b.st === 'ground' && (Math.abs(b.vx) + Math.abs(b.vz) > 0.01 || b.sq > 0)) moving = true;
    else if (b.st === 'hole' && b.fall < 1) moving = true;
  }
  sim.still = moving ? 0 : sim.still + DT;
  if (sim.still > 0.25 || sim.t > 9) sim.done = true;
}
function stepFree(sim, b) {
  b.age = (b.age || 0) + DT;
  b.x += b.vx * DT; b.y += b.vy * DT; b.z += b.vz * DT;
  b.vy -= G * DT;
  b.pitch += b.wp * DT; b.yaw += b.wyaw * DT;
  const p = worldToBoard(b.x, b.y, b.z);
  const over = !b.dead && Math.abs(b.x) < BOARD_W / 2 + 0.06 && p.v > -0.08 && p.v < BOARD_L + 0.08;
  if (over && p.h <= BAG_T && (b.vy < 0 || p.h <= BAG_T * 0.5)) { b.y = b.y + (BAG_T - p.h) * COS_A; b.z = b.z - (BAG_T - p.h) * SIN_A; landOnBoard(sim, b); return; }
  if (b.y <= BAG_T && b.vy < 0) { b.y = BAG_T; landOnGround(sim, b); }
}
function stepGround(b) {
  const s = Math.hypot(b.vx, b.vz);
  if (s > 0) { const ns = Math.max(0, s - 7 * DT); b.vx *= ns / s; b.vz *= ns / s; }
  b.x += b.vx * DT; b.z += b.vz * DT; b.yaw += b.wyaw * DT; b.wyaw *= 0.97;
  // keep out of the board: a dead bag never slides under it
  const m = BAG_R + 0.02, zf = BOARD_Z0 - 0.0, zb = BOARD_Z0 + BOARD_L * COS_A;
  if (Math.abs(b.x) < BOARD_W / 2 + m && b.z > zf - m && b.z < zb + m) {
    const dxl = BOARD_W / 2 + m - Math.abs(b.x), dzf = b.z - (zf - m), dzb = zb + m - b.z;
    const mn = Math.min(dxl, dzf, dzb);
    if (mn === dzf) { b.z = zf - m; b.vz = Math.min(0, b.vz); } else if (mn === dzb) { b.z = zb + m; b.vz = Math.max(0, b.vz); } else { b.x = Math.sign(b.x || 1) * (BOARD_W / 2 + m); b.vx = 0; }
  }
}
function stepBoard(sim, b) {
  // gravity along the slope, sliding friction, a curl for a spinning bag, a little pull into the hole
  b.vv -= G * SIN_A * DT;
  let s = Math.hypot(b.vu, b.vv);
  if (s > 0) {
    const ns = s - MU_K * G * COS_A * DT;
    if (ns <= 0) { b.vu = 0; b.vv = 0; s = 0; } else { b.vu *= ns / s; b.vv *= ns / s; s = ns; }
  }
  if (s > 0.25 && b.spin) {
    const w = b.spin * 1.25 * DT, c = Math.cos(w), sn = Math.sin(w);
    const nu = b.vu * c - b.vv * sn, nv = b.vu * sn + b.vv * c; b.vu = nu; b.vv = nv;
  }
  if (s === 0 && SIN_A > 0.5 * COS_A) { /* never: static friction holds on this slope */ }
  b.u += b.vu * DT; b.v += b.vv * DT;
  b.yaw += b.wyaw * DT; b.wyaw *= Math.exp(-4 * DT);
  if (b.spin && s > 0.25) b.wyaw += b.spin * 0.4 * DT;
  b.hop = Math.max(0, b.hop - DT * 0.3);
}
function collide(sim, a, c) {
  const dx = c.u - a.u, dy = c.v - a.v, d = Math.hypot(dx, dy), min = 2 * BAG_R;
  if (d >= min) return;
  let nx, ny;
  if (d < 1e-6) { nx = 0; ny = 1; } else { nx = dx / d; ny = dy / d; }
  const pen = min - d;
  a.u -= nx * pen * 0.5; a.v -= ny * pen * 0.5; c.u += nx * pen * 0.5; c.v += ny * pen * 0.5;
  const rv = (a.vu - c.vu) * nx + (a.vv - c.vv) * ny;
  if (rv > 0) {
    const j = ((1 + E_BAG) * rv) / 2;
    a.vu -= j * nx; a.vv -= j * ny; c.vu += j * nx; c.vv += j * ny;
    // a glancing hit twists the bags
    const tv = (a.vu - c.vu) * -ny + (a.vv - c.vv) * nx;
    a.wyaw += tv * 1.2; c.wyaw += tv * 1.2;
    if (rv > 0.25) ev(sim, { k: 'bump', x: (a.u + c.u) / 2, v: (a.v + c.v) / 2, s: Math.min(1.4, rv / 3) });
  }
}
function edgeAndHole(sim, b) {
  const dh = Math.hypot(b.u, b.v - HOLE_V), sp = Math.hypot(b.vu, b.vv);
  if (dh < 0.066 && (sp < 2.5 || dh < 0.03)) {
    b.st = 'hole'; b.fall = 0; b.dead = true; b.inHole = true;
    ev(sim, { k: 'hole', id: b.id, u: b.u, v: b.v, s: Math.min(1.4, 0.4 + sp / 3) });
    return;
  }
  // the lip of the hole pulls a slow bag toward the middle a little
  if (dh < 0.11 && sp < 1.2 && sp > 0.02) { const k = (1 - dh / 0.11) * 0.6 * DT; b.vu -= (b.u / (dh || 1)) * k * 3; b.vv -= ((b.v - HOLE_V) / (dh || 1)) * k * 3; }
  const out = Math.abs(b.u) > BOARD_W / 2 || b.v < 0 || b.v > BOARD_L;
  if (out) {
    const w = boardToWorld(b.u, b.v);
    b.st = 'free'; b.dead = true; b.x = w.x; b.y = w.y; b.z = w.z;
    b.vx = b.vu; b.vy = b.vv * SIN_A - 0.4; b.vz = b.vv * COS_A; b.wp = b.vv * 2; b.age = 0;
    ev(sim, { k: 'off', id: b.id, x: w.x, y: w.y, z: w.z });
  }
}

// ---- results ------------------------------------------------------------------------------------------------------------
export const bagState = (b) => (b.st === 'hole' ? 'hole' : b.st === 'board' ? 'board' : 'out');
export function runToEnd(sim) { let n = 0; while (!sim.done && n++ < 3000) stepSim(sim); return sim; }
// The bags that stay for the rest of the round: board and hole bags (hole bags are kept so they still score), dead bags are dropped from play.
export function settle(sim) {
  return sim.bags.map((b) => ({ ...b, vu: 0, vv: 0, vx: 0, vz: 0, sq: 0 }));
}
export function bagsOnBoard(bags) { return bags.filter((b) => b.st === 'board' || b.st === 'hole'); }
export function simBoardPlain(bags) {
  return bagsOnBoard(bags).map((b) => ({ id: b.id, side: b.side, st: b.st, u: b.u, v: b.v, yaw: b.yaw }));
}
