// The match camera as pure math, so the 2D overlay, the finger mapping and the 3D renderer all use the SAME projection.
// fitCamera(region, w, h, mode) picks a pose and a focal length (in virtual units) so the table and both paddle zones fill `region`
// (a rectangle in virtual units), whatever the screen shape. project()/unprojectToY() convert between the world and the virtual screen.
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

// Poses: eye position and look-at target. 'tall' looks down on the table more (portrait), 'wide' sits lower and nearer (landscape).
export const POSES = {
  tall: { eye: [0, 3.2, 4.5], at: [0, 0.45, -0.15] },
  mid: { eye: [0, 2.75, 4.3], at: [0, 0.5, -0.15] },
  wide: { eye: [0, 2.15, 4.0], at: [0, 0.6, -0.1] },
  title: { eye: [0.5, 1.9, 3.9], at: [0, 0.65, -0.2] },
};

// The points that must stay inside the region: the table, a little room for the paddles at both ends.
const FIT_POINTS = [
  [-0.8, 0.76, 1.42], [0.8, 0.76, 1.42], [-0.8, 0.76, -1.42], [0.8, 0.76, -1.42],        // table corners
  [-0.62, 1.1, 1.95], [0.62, 1.1, 1.95],                                                  // the human paddle zone
  [-0.5, 1.15, -1.95], [0.5, 1.15, -1.95],                                                // the opponent's paddle zone
  [0, 1.95, -2.75],                                                                       // the opponent's head
];

export function basis(eye, at) {
  const fwd = norm(sub(at, eye));
  const right = norm(cross(fwd, [0, 1, 0]));
  const up = cross(right, fwd);
  return { fwd, right, up };
}

export function fitCamera(region, w, h, mode = 'tall', extra = null, drift = 0) {
  const pose = POSES[mode] ?? POSES.tall;
  const eye = [pose.eye[0] + drift, pose.eye[1], pose.eye[2]], at = pose.at;
  const B = basis(eye, at);
  let minx = 1e9, maxx = -1e9, miny = 1e9, maxy = -1e9;
  for (const p of FIT_POINTS.concat(extra ?? [])) {
    const d = sub(p, eye), z = dot(d, B.fwd);
    const x = dot(d, B.right) / z, y = -dot(d, B.up) / z;
    minx = Math.min(minx, x); maxx = Math.max(maxx, x); miny = Math.min(miny, y); maxy = Math.max(maxy, y);
  }
  const f = Math.min(region.w / (maxx - minx), region.h / (maxy - miny));
  const cx = region.x + region.w / 2 - f * (minx + maxx) / 2;
  const cy = region.y + region.h / 2 - f * (miny + maxy) / 2;
  return { eye, at, B, f, cx, cy, w, h, mode };
}

export function project(cam, p) {
  const d = sub(p, cam.eye), z = dot(d, cam.B.fwd);
  if (z < 0.05) return { x: -9999, y: -9999, z, s: 0 };
  const f = cam.f / z;
  return { x: cam.cx + dot(d, cam.B.right) * f, y: cam.cy - dot(d, cam.B.up) * f, z, s: f };       // s = virtual units per metre at that depth
}

// Ray through a virtual-screen point, intersected with the plane y = y0. Returns [x, y0, z] or null.
export function unprojectToY(cam, sx, sy, y0) {
  const dx = (sx - cam.cx) / cam.f, dy = -(sy - cam.cy) / cam.f;
  const dir = [cam.B.fwd[0] + cam.B.right[0] * dx + cam.B.up[0] * dy, cam.B.fwd[1] + cam.B.right[1] * dx + cam.B.up[1] * dy, cam.B.fwd[2] + cam.B.right[2] * dx + cam.B.up[2] * dy];
  if (Math.abs(dir[1]) < 1e-6) return null;
  const t = (y0 - cam.eye[1]) / dir[1];
  if (t < 0) return null;
  return [cam.eye[0] + dir[0] * t, y0, cam.eye[2] + dir[2] * t];
}

// Lateral position of the human paddle under a finger at virtual x: the vertical plane at the near end of the table (z = 1.5).
export function paddleXFromScreen(cam, sx) {
  const dx = (sx - cam.cx) / cam.f;
  const dir = [cam.B.fwd[0] + cam.B.right[0] * dx, 0, cam.B.fwd[2] + cam.B.right[2] * dx];
  const t = (1.5 - cam.eye[2]) / (dir[2] || -1e-6);
  return cam.eye[0] + dir[0] * t;
}
