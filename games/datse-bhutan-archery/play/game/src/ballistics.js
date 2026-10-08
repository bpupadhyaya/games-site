// Arrow flight: gravity, air drag and wind. Pure maths, used by the engine, the AI, the coach and the sight reticle.
import { DRAG, G, V0, BOW_Y, RANGE, STATION_U } from './consts.js';

// A range has two ends. dir = +1: the shooters stand at z = 0 beside board A and shoot towards board B at z = RANGE. dir = -1: the other way.
// "right" of a shooter looking down the range is world -x for dir +1 and +x for dir -1.
export const boardZ = (dir) => (dir > 0 ? RANGE : 0);                  // the board being shot at
export const standZ = (dir) => (dir > 0 ? 0 : RANGE);
export const rightX = (dir) => -dir;                                   // world x component of the shooter's right
export const standX = (dir) => rightX(dir) * STATION_U;
export const originOf = (dir) => ({ x: standX(dir), y: BOW_Y, z: standZ(dir) + dir * 0.7 });

export function stepArrow(a, dt, w) {
  const rx = a.vx - w.x, rz = a.vz - w.z;
  const sp = Math.sqrt(rx * rx + a.vy * a.vy + rz * rz);
  const k = DRAG * sp;
  a.vx += k * (w.x - a.vx) * dt;
  a.vy += (-G - k * a.vy) * dt;
  a.vz += k * (w.z - a.vz) * dt;
  a.x += a.vx * dt; a.y += a.vy * dt; a.z += a.vz * dt;
}

export function launch(dir, yaw, pitch, speed = V0) {
  const o = originOf(dir), cp = Math.cos(pitch), sp = Math.sin(pitch);
  const fx = rightX(dir) * Math.sin(yaw), fz = dir * Math.cos(yaw);
  return { x: o.x, y: o.y, z: o.z, vx: speed * cp * fx, vy: speed * sp, vz: speed * cp * fz };
}

// Fly an arrow in a constant wind until it crosses the board plane or lands. Returns {kind:'plane'|'ground', x, y, z, t, u (metres right of the board centre)}.
export function fly(dir, yaw, pitch, wind, speed = V0, dt = 1 / 120) {
  const a = launch(dir, yaw, pitch, speed), bz = boardZ(dir);
  let t = 0;
  for (let i = 0; i < 2400; i++) {
    const px = a.x, py = a.y, pz = a.z;
    stepArrow(a, dt, wind); t += dt;
    if ((a.z - bz) * dir >= 0 && (pz - bz) * dir < 0) {
      const f = (bz - pz) / (a.z - pz);
      const x = px + (a.x - px) * f, y = py + (a.y - py) * f;
      return { kind: 'plane', x, y, z: bz, t: t - dt + dt * f, u: x * rightX(dir) };
    }
    if (a.y <= 0 && py > 0) {
      const f = py / (py - a.y);
      const x = px + (a.x - px) * f, z = pz + (a.z - pz) * f;
      return { kind: 'ground', x, y: 0, z, t: t - dt + dt * f, u: x * rightX(dir) };
    }
  }
  return { kind: 'ground', x: a.x, y: 0, z: a.z, t, u: a.x * rightX(dir) };
}

// Find the yaw and pitch that put the arrow through the board plane at (u right of the centre, h above the ground), flying in the given constant wind.
export function solveAim(dir, u, h, wind, speed = V0) {
  const o = originOf(dir), dist = Math.abs(boardZ(dir) - o.z);
  const u0 = o.x * rightX(dir);
  let yaw = Math.atan2(u - u0, dist), pitch = 0.18;
  for (let i = 0; i < 12; i++) {
    const r = fly(dir, yaw, pitch, wind, speed, 1 / 120);
    if (r.kind !== 'plane') { pitch += 0.02; continue; }
    const eu = u - r.u, eh = h - r.y;
    if (Math.abs(eu) < 0.004 && Math.abs(eh) < 0.004) break;
    yaw += (0.85 * eu) / dist; pitch += (0.8 * eh) / dist;
  }
  return { yaw, pitch };
}
// Where an arrow with these angles crosses the board plane in a constant wind (the reticle). Falls back to a point on the ground line when it never reaches the board.
export function impact(dir, yaw, pitch, wind, speed = V0) {
  const r = fly(dir, yaw, pitch, wind, speed, 1 / 120);
  return r.kind === 'plane' ? { u: r.u, h: r.y, t: r.t, short: false } : { u: r.u, h: -Math.max(0.5, Math.abs(boardZ(dir) - r.z) * 0.1), t: r.t, short: true };
}
export const NO_WIND = { x: 0, z: 0 };
