// The match camera as pure maths, shared by the 3D presenter (which renders with it) and the 2D HUD (which projects field positions through
// it). Two fixed rigs, chosen by the live screen shape; the field never pans, zooms or tilts during play (fixed surface rule):
//   'end'  portrait: behind the near end line looking up the field (the approved phone look). Screen right = +x, screen up = +z.
//   'side' landscape: a broadcast camera on the side line, the field runs along the long screen axis. Screen right = +z (toward the red
//          team's goal), screen up = -x. The stick is mapped through screenDir() so "right" always means screen-right.
// Sim axes: x = right in the end view, z = up the field. Three.js axes are mirrored in x (the rig's +X is the avatar's left), so world x_three = -x_sim.
export const CAM = { x: 0, y: 32, z: -31, lx: 0, ly: 0, lz: -4 };
export const SIDE_CAM = { x: -22, y: 23, z: 0.4, lx: 0, ly: 0, lz: 0.4 };
export const FOV_BASE = 36;
export const ASPECT_REF = 720 / 1280;
export const SIDE_TAN_H = 0.64;                       // half the horizontal field of view (tangent) the side rig keeps, so the whole field length always fits

export function fovFor(aspect) {
  const t = Math.tan((FOV_BASE * Math.PI) / 360) * Math.max(1, ASPECT_REF / Math.max(0.2, aspect));
  return (2 * Math.atan(t) * 180) / Math.PI;
}
export function sideFov(aspect) {
  const t = Math.min(0.72, SIDE_TAN_H / Math.max(1, aspect));
  return (2 * Math.atan(t) * 180) / Math.PI;
}
// ---- the follow camera (play only) ---------------------------------------------------------------------------------------------------------
// The camera keeps the same viewing direction as the fixed rig (so screen right / up and the stick mapping never change); it only slides over the
// field and moves along its viewing ray (zoom). The focus is the player's rider pulled toward the ball; the zoom fits the player's rider, the
// ball, the nearest opponents and (when close) the goal mouth, between a close view and the whole field. Damped; snapped on a new match.
// Pure maths on `state`; the presenter steps it once per frame BEFORE the 2D HUD draws so the HUD and the 3D view always share one camera.
export const FOLLOW = { kMin: 0.4, kMax: 1.0, fill: 0.86, tau: 0.35, on: true };
export const follow = { k: 1, fx: 0, fz: 0, sim: null, key: '', t: 0 };
const camFor = (key, fx, fz, k) => {
  const base = key === 'side' ? SIDE_CAM : CAM;
  const dx = base.x - base.lx, dy = base.y - base.ly, dz = base.z - base.lz;
  // focus in three space (x mirrored): the look-at point moves with the focus, the camera keeps its offset scaled by k
  const LX = base.lx - fx, LZ = base.lz + fz;
  return { x: LX + dx * k, y: base.ly + dy * k, z: LZ + dz * k, lx: LX, ly: base.ly, lz: LZ };
};
export const WIDE_VIEW = { fx: 0, fz: 0, k: 1 };
export function resetFollow(sim = null) { follow.sim = sim; follow.k = 1; follow.fx = 0; follow.fz = 0; follow.snap = true; }
// the focus / zoom wanted for this simulation state
function wanted(sim, aspect, key) {
  const me = sim && sim.riders.find((r) => r.human);
  if (!FOLLOW.on || !me || (sim.phase !== 'live' && sim.phase !== 'foul')) return WIDE_VIEW;
  const b = sim.ball, T = (key === 'side') ? (x, z) => ({ a: z, b: -x }) : (x, z) => ({ a: x, b: z });   // screen-right and screen-up field coordinates
  const pts = [T(me.x, me.z), T(b.x, b.z)];
  const opps = sim.riders.filter((r) => r.team !== me.team).map((r) => ({ r, d: Math.hypot(r.x - me.x, r.z - me.z) })).sort((u, v) => u.d - v.d);
  for (const o of opps.slice(0, 2)) if (o.d < 8) pts.push(T(o.r.x, o.r.z));
  const mates = sim.riders.filter((r) => r.team === me.team && r !== me).map((r) => ({ r, d: Math.hypot(r.x - me.x, r.z - me.z) })).sort((u, v) => u.d - v.d);
  if (mates[0] && mates[0].d < 7) pts.push(T(mates[0].r.x, mates[0].r.z));
  // the focus: between the rider and the ball (the rider counts double), then everything in the list must fit
  const wb = Math.min(0.38, Math.hypot(b.x - me.x, b.z - me.z) / 24);
  const fa = pts[0].a + (pts[1].a - pts[0].a) * wb, fb = pts[0].b + (pts[1].b - pts[0].b) * wb;
  // half extent of the view in field metres at k = 1 (depth of the far part is foreshortened a little)
  const hw = 6.4 * (key === 'side' ? 2.1 : 1), hh = key === 'side' ? 6.4 : 12;
  let need = 0;
  for (const q of pts) need = Math.max(need, Math.abs(q.a - fa) / hw, Math.abs(q.b - fb) / hh);
  const k = Math.max(FOLLOW.kMin, Math.min(FOLLOW.kMax, need / FOLLOW.fill + 0.05));
  // keep the view over the arena: no empty stands or sky beyond the boards
  const along = key === 'side' ? 14 : 6, across = key === 'side' ? 6 : 14, ra = Math.max(0, along + 1.2 - hw * k * 0.9), rb = Math.max(0, across + 6 - hh * k * 0.8);
  const ca = Math.max(-ra, Math.min(ra, fa)), cb = Math.max(-rb, Math.min(rb, fb + 1.3 * k));   // a little ahead of the rider, so the thumbs' side stays clear
  const fx = key === 'side' ? -cb : ca, fz = key === 'side' ? ca : cb;
  return { fx, fz, k };
}
export function stepFollow(sim, aspect, dt) {
  const key = aspect > 1.02 ? 'side' : 'end';
  if (follow.sim !== sim || follow.key !== key) { follow.sim = sim; follow.key = key; follow.snap = true; }
  const w = wanted(sim, aspect, key);
  const a = follow.snap ? 1 : 1 - Math.exp(-Math.min(0.1, Math.max(0, dt)) / FOLLOW.tau);
  follow.fx += (w.fx - follow.fx) * a; follow.fz += (w.fz - follow.fz) * a; follow.k += (w.k - follow.k) * a; follow.snap = false;
}
// the rig for a screen shape: portrait (and square) uses the end rig, landscape the side rig
export function rigFor(aspect) {
  const key = aspect > 1.02 ? 'side' : 'end';
  const k = follow.key === key ? follow.k : 1, fx = follow.key === key ? follow.fx : 0, fz = follow.key === key ? follow.fz : 0;
  const cam = k === 1 && !fx && !fz ? (key === 'side' ? SIDE_CAM : CAM) : camFor(key, fx, fz, k);
  return key === 'side' ? { key, cam, fov: sideFov(aspect), right: [0, 1], up: [-1, 0] } : { key, cam, fov: fovFor(aspect), right: [1, 0], up: [0, 1] };
}
// A stick / arrow-key direction in screen terms (dx right, dz up) to sim axes for the rig (pure input mapping; the simulation is unchanged)
export function screenDir(rig, dx, dz) { return { x: rig.right[0] * dx + rig.up[0] * dz, z: rig.right[1] * dx + rig.up[1] * dz }; }

// project a SIM point (x right, y up, z far) to CSS pixels on a W x H screen
export function project(W, H, x, y, z, rig = rigFor(W / H)) {
  const aspect = W / H, fov = rig.fov, cam = rig.cam;
  const px = -x;                                                     // to three space
  let fx = cam.lx - cam.x, fy = cam.ly - cam.y, fz = cam.lz - cam.z;
  const fl = Math.hypot(fx, fy, fz); fx /= fl; fy /= fl; fz /= fl;
  let rx = -fz, ry = 0, rz = fx; const rl = Math.hypot(rx, rz); rx /= rl; rz /= rl;      // right = f x up
  const ux = ry * fz - rz * fy, uy = rz * fx - rx * fz, uz = rx * fy - ry * fx;
  const dx = px - cam.x, dy = y - cam.y, dz = z - cam.z;
  const xc = dx * rx + dy * ry + dz * rz, yc = dx * ux + dy * uy + dz * uz, zc = dx * fx + dy * fy + dz * fz;
  if (zc < 0.05) return null;
  const th = Math.tan((fov * Math.PI) / 360);
  const nx = xc / (zc * th * aspect), ny = yc / (zc * th);
  return { u: (nx + 1) * 0.5 * W, v: (1 - ny) * 0.5 * H, depth: zc };
}
// css px (u, v) on a W x H screen to virtual units of the live fluid viewport vw x vh (one scale for both axes, centred)
export const toVirtual = (u, v, W, H, vw = 720, vh = 1280) => { const s = Math.min(W / vw, H / vh); return { x: (u - W / 2) / s + vw / 2, y: (v - H / 2) / s + vh / 2 }; };
export const fromVirtual = (x, y, W, H, vw = 720, vh = 1280) => { const s = Math.min(W / vw, H / vh); return { u: (x - vw / 2) * s + W / 2, v: (y - vh / 2) * s + H / 2 }; };
export function projectV(W, H, x, y, z, vw = 720, vh = 1280) { const p = project(W, H, x, y, z); if (!p) return null; const v = toVirtual(p.u, p.v, W, H, vw, vh); return { x: v.x, y: v.y, depth: p.depth }; }
// virtual units per metre on the screen around a field point
export function scaleAt(W, H, x, z, vw = 720, vh = 1280) { const a = projectV(W, H, x - 0.5, 0, z, vw, vh), b = projectV(W, H, x + 0.5, 0, z, vw, vh), c = projectV(W, H, x, 0, z - 0.5, vw, vh), d = projectV(W, H, x, 0, z + 0.5, vw, vh); return a && b && c && d ? Math.max(Math.hypot(b.x - a.x, b.y - a.y), Math.hypot(d.x - c.x, d.y - c.y)) : 30; }

// The Rules-page formation camera (a close three-quarter view of the whole field from behind our end line) and a generic projector for it,
// so the 2D page can put labels exactly over the real 3D riders. Window size w x h in CSS px, vertical field of view fov.
export const SHOW_CAM = { x: 0, y: 21, z: -31, lx: 0, ly: 0, lz: -1.5, fov: 40 };
export function projectWith(cam, fov, w, h, x, y, z) {
  const aspect = w / h, px = -x;
  let fx = cam.lx - cam.x, fy = cam.ly - cam.y, fz = cam.lz - cam.z;
  const fl = Math.hypot(fx, fy, fz); fx /= fl; fy /= fl; fz /= fl;
  let rx = -fz, rz = fx; const rl = Math.hypot(rx, rz); rx /= rl; rz /= rl;
  const ux = -rz * fy, uy = rz * fx - rx * fz, uz = rx * fy;
  const dx = px - cam.x, dy = y - cam.y, dz = z - cam.z;
  const xc = dx * rx + dz * rz, yc = dx * ux + dy * uy + dz * uz, zc = dx * fx + dy * fy + dz * fz;
  if (zc < 0.05) return null;
  const th = Math.tan((fov * Math.PI) / 360);
  return { x: (xc / (zc * th * aspect) + 1) * 0.5 * w, y: (1 - yc / (zc * th)) * 0.5 * h };
}
