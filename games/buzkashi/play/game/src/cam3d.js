// The broadcast camera of the 3D field, as pure maths (no three.js): one pinhole model that the presenter copies into its WebGL camera and
// that the 2D layer (HUD guide lines, touch input, markers) uses to project / un-project the ground. World metres: sim (x, y) maps to
// three.js (X, Z) = (x, -y); height is Y. The camera looks along the field's long axis in portrait (from the circle end towards the post)
// and across the screen in landscape (a quarter turn), exactly like the 2D scene did.
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const FRAME = { x0: -19.5, x1: 19.5, y0: -31, y1: 31 };       // where the focus may go (field plus a margin)
export const ACROSS = 9.6;                                          // metres across the short side of the arena at the focus point
const D2R = Math.PI / 180;

export function frame3d(W, H, area, land, focus, o = {}) {
  const a = area || { x: 0, y: 0, w: W, h: H };
  const f0 = focus && typeof focus === 'object' ? focus : { x: 0, y: focus || 0 };
  const across = o.across || ACROSS;
  const vfov = o.vfov || (land ? 34 : 44);
  const elev = (o.elev || (land ? 46 : 52)) * D2R;
  const aspect = a.w / Math.max(1, a.h);
  const fx = clamp(f0.x, FRAME.x0, FRAME.x1), fy = clamp(f0.y, FRAME.y0, FRAME.y1);
  const pxm = Math.min(a.w, a.h) / across;                      // pixels per metre at the focus point
  const tanV = Math.tan(vfov * D2R / 2);
  const dist = (a.h / pxm) / (2 * tanV);                        // camera distance to the focus point
  const phi = (land ? Math.PI / 2 : 0) + (o.phiOff || 0);                           // heading of the view in the sim plane
  // ground-plane forward in three.js XZ for the sim heading phi: sim forward (-sin, cos) -> (X, Z) = (-sin, -cos)
  const gfx = -Math.sin(phi), gfz = -Math.cos(phi);
  const aimY = o.aimY ?? 0.7;
  let tx = fx, ty = aimY, tz = -fy;
  let px = tx - gfx * dist * Math.cos(elev), py = ty + dist * Math.sin(elev), pz = tz - gfz * dist * Math.cos(elev);
  if (o.pos && o.target) { [px, py, pz] = o.pos; [tx, ty, tz] = o.target; }   // dev: free camera
  // camera basis
  let fxv = tx - px, fyv = ty - py, fzv = tz - pz;
  const fl = Math.hypot(fxv, fyv, fzv); fxv /= fl; fyv /= fl; fzv /= fl;
  // right = forward x up(0,1,0) = (-fz, 0, fx)
  let rx = -fzv, rz = fxv; const rl = Math.hypot(rx, rz); rx /= rl; rz /= rl;
  // up = right x forward
  const ux = -rz * fyv, uy = rz * fxv - rx * fzv, uz = rx * fyv;
  const cx = a.x + a.w / 2, cy = a.y + a.h / 2;
  const kx = (a.h / 2) / tanV, ky = (a.h / 2) / tanV;           // pixels per unit of (xc / zc)
  const proj = (X, Y, Z) => {
    const dx = X - px, dy = Y - py, dz = Z - pz;
    const zc = dx * fxv + dy * fyv + dz * fzv;
    if (zc < 0.05) return null;
    const xc = dx * rx + dz * rz, yc = dx * ux + dy * uy + dz * uz;
    return { x: cx + kx * xc / zc, y: cy - ky * yc / zc, z: zc };
  };
  const c = { land, W, H, area: a, cx, cy, focus: { x: fx, y: fy }, dist, pxm, vfov, elev, phi };
  c.px = [px, py, pz]; c.target = [tx, ty, tz]; c.aspect = aspect;
  c.x = (wx, wy, h = 0) => { const p = proj(wx, h, -wy); return p ? p.x : -9999; };
  c.y = (wx, wy, h = 0) => { const p = proj(wx, h, -wy); return p ? p.y : -9999; };
  c.pt = (wx, wy, h = 0) => proj(wx, h, -wy);
  // metres -> pixels at a ground point (the horizontal scale there): used for line widths and rings
  c.scaleAt = (wx, wy) => { const p = proj(wx, 0, -wy); return p ? kx / p.z : pxm; };
  c.s = pxm;
  c.world = (sx, sy) => {
    // ray through the pixel, intersected with the ground plane (Y = 0)
    const nx = (sx - cx) / kx, ny = -(sy - cy) / ky;
    const dx = fxv + nx * rx + ny * ux, dy = fyv + ny * uy, dz = fzv + nx * rz + ny * uz;
    let t = dy < -1e-4 ? -py / dy : 60;
    t = clamp(t, 0.1, 400);
    return { x: px + dx * t, y: -(pz + dz * t) };
  };
  c.head = (th) => (land ? Math.PI / 2 - th : -th);
  c.vis = dist;
  return c;
}
