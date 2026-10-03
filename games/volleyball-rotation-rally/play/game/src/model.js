// Pure helpers shared by the simulation and the AI: team geometry, rotation and formations, player stats, interception, shot solving.
import { G, BR, HW, HL, ATK, FREE, SLOT, FRONT, TECH, REACH0, LUNGE, DIVE, PREP, JUMP, HSCALE_F, isMB, isOH } from './consts.js';
import { clamp } from './util.js';
import { posAt, landTime, flightTo, netTime } from './ball.js';

export const dirOf = (t) => (t === 0 ? 1 : -1);          // +1: team faces +z
export const latSign = (t) => (t === 0 ? 1 : -1);        // team-left in world x
export const W = (t, lat, depth) => ({ x: latSign(t) * lat, z: -dirOf(t) * depth });
export const depthOf = (t, z) => -dirOf(t) * z;
export const latOf = (t, x) => latSign(t) * x;
export const sideOf = (z) => (z < 0 ? 0 : 1);
export const idOf = (team, tp) => team * 7 + tp;
export const typeOfId = (id) => id % 7;
export const teamOfId = (id) => (id >= 7 ? 1 : 0);
export const inCourt = (x, z) => Math.abs(x) <= HW + 0.05 && Math.abs(z) <= HL + 0.05;
export const landsIn = (x, z, side) => Math.abs(x) <= HW + 0.06 && (side === 0 ? z <= 0.02 && z >= -HL - 0.06 : z >= -0.02 && z <= HL + 0.06);

// ---- player stats ----------------------------------------------------------------------------------------------------------------
// skill k in 0..1 (the team level), tp = player type 0..6. Returns everything the sim needs about this player.
export function makeStats(k, tp, women) {
  const L = tp === 6, S = tp === 0, MB = isMB(tp), OH = isOH(tp), OPP = tp === 3;
  return {
    spd: 3.5 + 1.7 * k + (L ? 0.2 : MB ? -0.1 : 0),
    jump: (0.68 + 0.32 * k) * (women ? 0.86 : 1) * (L ? 0.6 : S ? 0.9 : 1),
    att: clamp(0.18 + 0.82 * k + (OH ? 0.02 : OPP ? 0.05 : MB ? -0.02 : S ? -0.25 : -0.7), 0.02, 1),
    pow: clamp(0.2 + 0.8 * k + (OPP ? 0.05 : 0), 0.1, 1),
    pass: clamp(0.16 + 0.84 * k + (L ? 0.14 : OH ? 0.04 : OPP ? -0.06 : MB ? -0.1 : S ? -0.12 : 0), 0.05, 1),
    set: clamp(0.2 + 0.8 * k + (S ? 0.16 : L ? -0.1 : -0.22), 0.05, 1),
    blk: clamp(0.1 + 0.88 * k + (MB ? 0.12 : OPP ? 0.02 : OH ? -0.04 : S ? -0.1 : -0.6), 0.02, 1),
    srv: clamp(0.15 + 0.85 * k + (OPP ? 0.06 : L ? -0.1 : 0), 0.05, 1),
    react: clamp(0.31 - 0.23 * k, 0.07, 0.3),
    reach: women ? 0.965 : 1,
  };
}
export const heightScale = (women) => (women ? HSCALE_F : 1);
export const techBand = (name, women) => {
  const T = TECH[name], k = heightScale(women);
  return { ...T, y0: T.y0 * (name === 'bump' || name === 'dig' ? 1 : k), y1: T.y1 * (name === 'bump' || name === 'dig' ? 1 : k), pref: T.pref * (name === 'bump' || name === 'dig' ? 1 : k) };
};

// ---- rotation ------------------------------------------------------------------------------------------------------------------
// rot[i] is the player TYPE standing in rotational slot i (0 = P1 right back ... 5 = P6 middle back). A clockwise rotation moves everyone one slot.
export const START_ROT = [0, 1, 2, 3, 4, 5];       // P1 setter, P2 OH, P3 MB, P4 opposite, P5 OH, P6 MB
export const rotateRot = (rot) => rot.slice(1).concat(rot[0]);
// Who is actually on court in each slot: the libero replaces a middle blocker in the back row. A player who controls a middle blocker
// (userType 2) is never replaced; the other middle is.
export function courtLineup(rot, userType, libero = true, liberoServes = false) {
  return rot.map((tp, i) => (libero && isMB(tp) && !FRONT[i] && (liberoServes || i !== 0) && userType !== tp ? 6 : tp));
}
export const slotOfType = (lineup, tp) => lineup.indexOf(tp);
export const isFrontSlot = (i) => FRONT[i];

export const slotPos = (team, i) => W(team, SLOT[i][0], SLOT[i][1]);
// Serve-receive formation: positions by slot. Legal by construction: front row nearer the net than the back row behind it, left-right order kept.
const RCV = [[-2.4, 5.6], [-3.5, 2.3], [-0.2, 1.7], [3.2, 2.6], [2.7, 5.5], [0.3, 6.6]];
// The setter hides at the net: slot P2 (right front) and P3 stay close, P4 moves in.
export function receivePos(team, i, tp) {
  let [lat, d] = RCV[i];
  if (tp === 0 && FRONT[i]) { d = 1.0; lat = i === 1 ? -2.2 : i === 2 ? -0.3 : 1.2; }
  return W(team, lat, d);
}
export function serverPos(team, lat = -2.4) { return W(team, lat, HL + 0.9); }

// ---- interception --------------------------------------------------------------------------------------------------------------
export const techFor = (y, women) => {
  const k = heightScale(women);
  if (y < 0.46) return 'dig';
  if (y < 1.32) return 'bump';
  if (y >= 1.9 * k) return 'over';
  return 'bump';
};

// Best contact along flight fl for player p (p.x, p.z, p.vx, p.vz, p.st) starting at tNow.
// opts: team side the player plays on, minY, maxY, preferY, tMin, tEnd, human (no reaction delay), noFront (cannot be nearer the net than 0.3)
export function intercept(fl, p, tNow, opts = {}) {
  const team = p.team;
  const tl = opts.tEnd ?? landTime(fl) ?? tNow + 3;
  const minY = opts.minY ?? 0.14, maxY = opts.maxY ?? 1.3, pref = opts.preferY ?? 0.85;
  const fwd = opts.fwd ?? 0.5;
  let best = null;
  const t0 = Math.max(opts.tMin ?? 0, tNow + 0.10);
  const react = (opts.human ? 0 : p.st.react) + (opts.spd ? 0.12 * clamp((opts.spd - 12) / 14, 0, 1) : 0);
  for (let t = t0; t <= tl + 1e-6; t += 0.02) {
    const b = posAt(fl, t);
    if (depthOf(team, b.z) < 0.5) continue;                      // the other side or too close to the net to play without touching it
    if (b.y < minY || b.y > maxY) continue;
    if (Math.abs(b.x) > HW + FREE || depthOf(team, b.z) > HL + FREE + 1) continue;
    const avail = Math.max(0, t - tNow - react - PREP);
    const d = Math.hypot(b.x - p.x, b.z - p.z);
    const can = p.st.spd * 0.8 * avail + REACH0 + fwd;
    const over = Math.max(0, d - can);
    const lim = LUNGE + (opts.dive ? DIVE : 0);
    if (over > lim) continue;
    const yc = Math.abs(b.y - pref) * 0.5;
    const cost = (over / LUNGE) * 2.5 + yc + d * 0.02;
    if (!best || cost < best.cost - 1e-9) best = { t, x: b.x, y: b.y, z: b.z, d, over, stretch: over / LUNGE, dive: over > LUNGE, cost: cost + (over > LUNGE ? 1.2 : 0) };
  }
  return best;
}

// Smallest flight time >= T0 whose ball clears the net by `margin` metres (null-safe).
export function solveClear(p0, p1, T0, netH, margin, Tmax = 3.0) {
  let last = null;
  for (let T = T0; T <= Tmax + 1e-9; T += 0.02) {
    const f = flightTo(0, p0, p1, T);
    last = { T, f, clear: clearanceOf(p0, p1, T, netH) };
    if (last.clear >= margin) return last;
  }
  return last;
}
export function clearanceOf(p0, p1, T, netH) {
  const f = flightTo(0, p0, p1, T);
  const tn = netTime(f, T);
  if (tn === null) return 9;
  return posAt(f, tn).y - (netH + BR);
}
export const atkLine = (team) => ATK;
export const jumpOf = (st, women) => st.jump * (women ? 1 : 1);
export { JUMP, G, HW, HL };
