// The camera of the 3D hunting ground as pure maths (no three.js): one pinhole model that the WebGL picture copies and that the 2D layer (sight,
// guides, floating text, touch input) uses to project and un-project, so what you touch is what is drawn.
//
// World: the sim's metres are shown at C (0.4) of their length, so a 300 m hunting ground fits a believable 3D space (animals keep their real
// size, the country is compressed). 3D position of a sim point (x, z, alt) is (-x*C, alt*C, z*C): sim +x is screen right.
// Camera state (kept in state.cam, smoothed by the game): { x, z (sim metres), y (3D metres), yaw, pitch (rad; pitch > 0 looks down) }.
import { K } from './sim.js';

export const C = 0.4;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const wrap = (a) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };

// vertical field of view for a screen of this shape and a view type
export function vfovFor(W, H, kind = 'play') {
  const land = W > H;
  const base = land ? 42 : 56;
  return kind === 'menu' ? (land ? 38 : 50) : base;
}

export function viewOf(W, H, cam, vfovDeg) {
  const vf = (vfovDeg || vfovFor(W, H)) * Math.PI / 180;
  const f = (H / 2) / Math.tan(vf / 2);
  const cy = Math.cos(cam.yaw), sy = Math.sin(cam.yaw), cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
  const fwd = [-sy * cp, -sp, cy * cp], right = [-cy, 0, -sy];
  const up = [right[1] * fwd[2] - right[2] * fwd[1], right[2] * fwd[0] - right[0] * fwd[2], right[0] * fwd[1] - right[1] * fwd[0]];
  const pos = [-cam.x * C, cam.y, cam.z * C];
  const cx = W / 2, cyy = H / 2;
  const v = { W, H, f, vfov: vf, pos, fwd, right, up, cx, cy: cyy };
  v.point = (X, Y, Z) => {
    const dx = X - pos[0], dy = Y - pos[1], dz = Z - pos[2];
    const zc = dx * fwd[0] + dy * fwd[1] + dz * fwd[2];
    if (zc < 0.2) return null;
    const xc = dx * right[0] + dy * right[1] + dz * right[2], yc = dx * up[0] + dy * up[1] + dz * up[2];
    return { x: cx + f * xc / zc, y: cyy - f * yc / zc, zc };
  };
  // sim point -> screen: { x, y (at altitude), gy (the ground below it), k (px per sim metre / mpx), s (sprite scale), zc }
  v.proj = (g, x, z, alt = 0) => {
    const p = v.point(-x * C, alt * C, z * C), q = v.point(-x * C, 0, z * C);
    if (!p || !q) return { x: cx, y: -9999, gy: -9999, k: 0.001, s: 0.05, zc: 0 };
    const pxPerSim = f * C / p.zc;
    return { x: p.x, y: p.y, gy: q.y, k: pxPerSim / g.mpx, s: clamp(pxPerSim * 3.4 / (46 * g.unit), 0.08, 2.4), zc: p.zc, pxPerSim };
  };
  // screen -> ground point (sim x, z)
  v.unproj = (sx, sy) => {
    const nx = (sx - cx) / f, ny = -(sy - cyy) / f;
    const dx = fwd[0] + nx * right[0] + ny * up[0], dy = fwd[1] + nx * right[1] + ny * up[1], dz = fwd[2] + nx * right[2] + ny * up[2];
    let t = dy < -1e-3 ? -pos[1] / dy : 4000;
    t = clamp(t, 0.5, 4000);
    return { x: -(pos[0] + dx * t) / C, z: (pos[2] + dz * t) / C };
  };
  return v;
}

// Where the camera wants to be for this hunt: behind the rider while tracking (an elevated vantage looking at the fox), behind and above
// the eagle in flight, closer for the strike, and back at rest for the return.
export function camTarget(h, rest) {
  const t = { x: 0, z: rest, y: 5.2, yaw: 0, pitch: 0.12 };
  if (!h) return t;
  const f = h.fox, e = h.eagle;
  const aim = (x, z, wy, tx, tz, ty) => { const dx = (tx - x) * C, dz = (tz - z) * C, d = Math.max(4, Math.hypot(dx, dz)); return { yaw: Math.atan2(tx - x, tz - z), pitch: Math.atan2(wy - ty, d) }; };
  if (h.ph === 'track') {
    t.x = clamp(h.sight.x * 0.08, -12, 12);
    const a = aim(t.x, t.z, t.y, f.x * 0.92 + h.sight.x * 0.08, f.z, 0.2);
    t.yaw = a.yaw * 0.95; t.pitch = a.pitch - 0.02;
  } else if (h.ph === 'fly' || h.ph === 'stoop') {
    t.x = e.x * 0.9; t.z = e.z - 38; t.y = 2.6 + e.alt * C * 0.5;
    const mx = (e.x * 0.35 + f.x * 0.65), mz = (e.z * 0.35 + f.z * 0.65), my = e.alt * C * 0.45;
    const a = aim(t.x, t.z, t.y, mx, mz, my);
    t.yaw = a.yaw; t.pitch = a.pitch - 0.01;
  } else if (h.ph === 'strike') {
    t.x = ((e.x + f.x) / 2) * 0.9; t.z = e.z - 40; t.y = 2.6;
    const a = aim(t.x, t.z, t.y, (e.x + f.x) / 2, (e.z + f.z) / 2, 0.8);
    t.yaw = a.yaw; t.pitch = a.pitch;
  } else {
    // recall / done: camera back at the rest post, looking up the ground the eagle is coming back over
    t.y = 3.4; t.pitch = 0.07;
    const from = h.res && h.res.from ? h.res.from : { x: e.x, z: e.z };
    t.yaw = Math.atan2(from.x * 0.5, Math.max(40, from.z) * 0.7) * 0.5;
  }
  return t;
}

// One smoothing step toward a target (rates per second); yaw takes the short way round.
export function stepCam(cam, tgt, dt, rate = 2.4, yawRate = rate) {
  const k = 1 - Math.exp(-rate * dt), ky = 1 - Math.exp(-yawRate * dt);
  cam.x += (tgt.x - cam.x) * k; cam.z += (tgt.z - cam.z) * k;
  cam.y += (tgt.y - cam.y) * k;
  cam.yaw += wrap(tgt.yaw - cam.yaw) * ky;
  cam.pitch += (tgt.pitch - cam.pitch) * ky;
  return cam;
}
export const camSnap = (cam, tgt) => { cam.x = tgt.x; cam.z = tgt.z; cam.y = tgt.y; cam.yaw = tgt.yaw; cam.pitch = tgt.pitch; return cam; };
export { K };

// --- the live switch: 2D fallback or 3D picture. The presenter sets globalThis.__steppe3d when it is ready.
export const use3d = () => { const F = globalThis.__steppe3d; return !!(F && F.ready && !F.lost && !F.off); };
