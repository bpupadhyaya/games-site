// Pure helpers shared by the simulation and the AI: team geometry, player stats, interception, shot solving.
import { G, BR, HW, HL, TECH_BANDS, TECH_FWD } from './consts.js';
import { clamp } from './util.js';
import { posAt, landTime, flightTo, netTime } from './ball.js';

export const dirOf = (t) => (t === 0 ? 1 : -1);          // +1: team faces +z
export const latSign = (t) => (t === 0 ? 1 : -1);        // team-left in world x
export const W = (t, lat, depth) => ({ x: latSign(t) * lat, z: -dirOf(t) * depth });
export const depthOf = (t, z) => -dirOf(t) * z;
export const latOf = (t, x) => latSign(t) * x;
export const sideOf = (z) => (z < 0 ? 0 : 1);
export const inCourt = (x, z) => Math.abs(x) <= HW + 0.0 && Math.abs(z) <= HL + 0.0;

// roles: 0 = tekong (back), 1 = left inside, 2 = right inside
export function makeStats(skill, role) {
  const k = skill, back = role === 0;
  return {
    spd: 3.0 + 2.9 * k + (back ? -0.1 : 0.15),
    jump: 0.42 + 0.62 * k - (back ? 0.08 : 0),
    pow: clamp(0.15 + 0.85 * k + (role === 1 ? 0.03 : 0), 0.1, 1),
    tech: clamp(0.15 + 0.82 * k + (role === 2 ? 0.04 : 0), 0.1, 1),
    ctrl: clamp(0.12 + 0.86 * k + (back ? 0.08 : 0), 0.1, 1),
    setq: clamp(0.15 + 0.82 * k + (back ? -0.05 : 0.05), 0.1, 1),
    blk: clamp(0.08 + 0.88 * k + (role === 2 ? 0.05 : 0) - (back ? 0.2 : 0), 0.05, 1),
    react: clamp(0.52 - 0.42 * k, 0.12, 0.45),
  };
}

export const techFor = (y) => { for (const b of TECH_BANDS) if (y < b.hi) return b.id; return 'head'; };

export const PREP = 0.08;          // s a player needs to plant before a touch
export const REACH0 = 0.20;        // m a player covers by leaning / shuffling without running
export const LUNGE = 0.40;         // extra m available at a stretch (costs quality)

// Best interception of flight `fl` for player p (p.x, p.z, p.st), starting at tNow.
// opts: team (side the player's team plays on), minY, maxY, preferY, tEnd
export function intercept(fl, p, tNow, opts = {}) {
  const team = p.team;
  const tl = opts.tEnd ?? landTime(fl) ?? tNow + 3;
  const minY = opts.minY ?? 0.14, maxY = opts.maxY ?? 1.9, pref = opts.preferY ?? 0.95;
  let best = null;
  const t0 = tNow + 0.14;
  for (let t = t0; t <= tl + 1e-6; t += 0.02) {
    const b = posAt(fl, t);
    if (depthOf(team, b.z) < 0.75) continue;                      // ball is on the other side or too close to the net to play without touching it
    if (b.y < minY || b.y > maxY) continue;
    const avail = Math.max(0, t - tNow - p.st.react - PREP);
    const d = Math.hypot(b.x - p.x, b.z - p.z);
    const fw = TECH_FWD[techFor(b.y)] ?? 0.4;               // the player stands this far from the ball
    const can = p.st.spd * 0.9 * avail + REACH0;
    const over = Math.max(0, d - fw - can);
    if (over > LUNGE) continue;
    const yc = b.y < 0.5 ? (0.5 - b.y) * 1.2 : b.y > 1.25 ? (b.y - 1.25) * 1.6 : 0;
    const cost = over / LUNGE * 2.5 + yc + Math.abs(b.y - pref) * 0.25;
    if (!best || cost < best.cost - 1e-9) best = { t, x: b.x, y: b.y, z: b.z, d, over, stretch: over / LUNGE, cost, tech: techFor(b.y) };
  }
  return best;
}

// Smallest flight time >= T0 whose ball clears the net by `margin` metres (null if the launch is on the net line).
export function solveClear(p0, p1, T0, netH, margin, Tmax = 2.2) {
  for (let T = T0; T <= Tmax + 1e-9; T += 0.02) {
    const f = flightTo(0, p0, p1, T);
    const tn = netTime(f, T);
    if (tn === null) return { T, f, clear: 9 };
    const y = posAt(f, tn).y;
    const c = y - (netH + BR);
    if (c >= margin) return { T, f, clear: c };
  }
  return { T: Tmax, f: flightTo(0, p0, p1, Tmax), clear: posAt(flightTo(0, p0, p1, Tmax), netTime(flightTo(0, p0, p1, Tmax), Tmax) ?? 0).y - (netH + BR) };
}
export function clearanceOf(p0, p1, T, netH) {
  const f = flightTo(0, p0, p1, T);
  const tn = netTime(f, T);
  if (tn === null) return 9;
  return posAt(f, tn).y - (netH + BR);
}

// Landing spot of the ball in world coordinates is inside the lines?
export const landsIn = (x, z, side) => Math.abs(x) <= HW && (side === 0 ? z <= 0 && z >= -HL : z >= 0 && z <= HL);

// Ideal standing spot for a set (the setter waits near the net, a bit towards their own side)
export function setSpot(team, role) {
  return W(team, role === 1 ? 0.9 : role === 2 ? -0.9 : 0, 2.1);
}
// Home lane of an inside attacker
export const laneLat = (role) => (role === 1 ? 1.7 : role === 2 ? -1.7 : 0);
