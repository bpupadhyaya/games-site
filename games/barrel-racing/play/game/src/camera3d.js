// The arena camera as pure maths, shared by the 3D presenter (which renders with it) and the 2D drawing (turn guides, ideal line, trail and the
// 2D fallback project ground points through it). Sim axes: x across, y up the arena, z height, metres. Three space: X = x, Y = z, Z = -y.
// The camera looks at the middle of the arena from the start end (portrait) or from the left side (landscape: the arena is turned a quarter turn
// so the ride goes left to right). The frame rectangle is fitted into the screen rectangle the layout gives the arena by a lens shift, so the
// perspective is a plain pinhole and the same numbers drive both pictures.
export const FRAME3 = { x0: -17.0, x1: 17.0, y0: -12.0, y1: 47.0, top: 5.2 };
const CY = (FRAME3.y0 + FRAME3.y1) / 2;
const norm = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

// W x H = the virtual screen, area = {x,y,w,h} the arena may use inside it, land = quarter turn
// focus = { x, y, zoom }: zoom 1 shows the whole arena; above 1 the view closes in on the ground point (x, y) (clamped so it never leaves the frame)
export function rig3(W, H, area, land, focus = null, elev = null) {
  const a = area || { x: 0, y: 0, w: W, h: H };
  const e = (elev ?? (focus && focus.elev) ?? (land ? 55 : 58)) * Math.PI / 180, D = 150;
  const T = [0, 0.8, -CY];
  const dirH = land ? [1, 0, 0] : [0, 0, 1];
  const pos = [T[0] + dirH[0] * D * Math.cos(e), T[1] + D * Math.sin(e), T[2] + dirH[2] * D * Math.cos(e)];
  const f = norm([T[0] - pos[0], T[1] - pos[1], T[2] - pos[2]]);
  const r = norm(cross(f, [0, 1, 0])), u = cross(r, f);
  const toCam = (x, y, z) => {
    const d = [x - pos[0], z - pos[1], -y - pos[2]];
    const zc = dot(d, f);
    return [dot(d, r) / zc, dot(d, u) / zc, zc];
  };
  // bound the frame (ground corners and the same corners at head height) in the camera's tangent plane
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (const cx of [FRAME3.x0, FRAME3.x1]) for (const cy of [FRAME3.y0, FRAME3.y1]) for (const cz of [0, FRAME3.top]) {
    const p = toCam(cx, cy, cz);
    x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]);
  }
  const k0 = Math.min(a.w / (x1 - x0), a.h / (y1 - y0));          // virtual units per unit of tangent
  const zoom = focus && focus.zoom > 1 ? focus.zoom : 1, k = k0 * zoom;
  let xm = (x0 + x1) / 2, ym = (y0 + y1) / 2;
  if (zoom > 1) {
    // bring the focus point to the middle of the area, but never show beyond the frame
    const p = toCam(focus.x, focus.y, 0), hx = a.w / 2 / k, hy = a.h / 2 / k;
    if (focus.free) { xm = p[0]; ym = p[1]; } else {
    xm = x1 - x0 <= 2 * hx ? (x0 + x1) / 2 : Math.max(x0 + hx, Math.min(x1 - hx, p[0]));
    ym = y1 - y0 <= 2 * hy ? (y0 + y1) / 2 : Math.max(y0 + hy, Math.min(y1 - hy, p[1])); }
  }
  const acx = a.x + a.w / 2, acy = a.y + a.h / 2;
  const R = { W, H, land: !!land, pos, f, r, u, k, xm, ym, acx, acy, area: a };
  // three.js projection matrix entries (full-screen lens shift so the arena sits in `area`)
  R.P0 = 2 * k / W; R.P5 = 2 * k / H;
  R.P8 = R.P0 * (xm + (W / 2 - acx) / k); R.P9 = R.P5 * (ym - (H / 2 - acy) / k);
  R.near = 40; R.far = 520;
  R.proj = (x, y, z = 0) => {
    const p = toCam(x, y, z);
    return [acx + (p[0] - xm) * k, acy - (p[1] - ym) * k, p[2]];
  };
  R.mPerUnit = (x, y) => { const p = R.proj(x, y), q = R.proj(x + 1, y), s = R.proj(x, y + 1); return Math.sqrt(Math.abs((q[0] - p[0]) * (s[1] - p[1]) - (q[1] - p[1]) * (s[0] - p[0]))); };
  R.s = R.mPerUnit(0, CY);
  return R;
}
