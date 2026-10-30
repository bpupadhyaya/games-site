// The main-view camera: one real pinhole (eye, forward, right, up, focal k in frame px, principal point ox/oy) looking down the sheet from
// behind the hack. The 2D layer (view.js makeCam) and the optional 3D presenter (view3d/presenter.js) share it, so every guide, ring and
// finger maps onto the lit ice exactly. Pure arithmetic: deterministic, safe in the headless harness. World: +x right, +y towards the house, +z up.
const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

function basis(eye, tgt) {
  const f = norm([tgt[0] - eye[0], tgt[1] - eye[1], tgt[2] - eye[2]]), r = norm(cross(f, [0, 0, 1])), u = cross(r, f);
  return { eye, f, r, u, raw(x, y, z) { const d = [x - eye[0], y - eye[1], z - eye[2]], zc = dot(d, f); return { sx: dot(d, r) / zc, sy: -dot(d, u) / zc, zc }; } };
}

// Fit the sheet [yNear..yFar] x [-halfW..halfW] into a frame rectangle: width of the near end <= nearMax px, half width of the far end
// <= farHalfMax px, height <= rh px. Picks the camera that makes the far end (the house) widest. Returns the pinhole + ground maps.
export function fitPin({ halfW, yNear, yFar, nearMax, farHalfMax, rh, cx, top }) {
  let best = null;
  for (const d of [0.5, 1, 1.5, 2, 3, 4, 5, 6, 8, 10, 13]) for (const h of [1.2, 1.6, 2, 2.4, 2.8, 3.3, 3.9, 4.6, 5.5, 6.5, 8, 10]) for (const ty of [-24, -19, -15, -12, -9, -6]) {
    const c = basis([0, yNear - d, h], [0, ty, 0]);
    const n = c.raw(halfW, yNear, 0), f = c.raw(halfW, yFar, 0);
    if (n.zc <= 0.3 || f.zc <= 0.3) continue;
    const ext = c.raw(0, yNear, 0).sy - c.raw(0, yFar, 0).sy;
    if (!(ext > 0)) continue;
    const k = Math.min(nearMax / (2 * n.sx), farHalfMax / f.sx, rh / ext);
    const slack = rh - ext * k;
    const score = k * f.sx * 2 + 0.1 * k * n.sx * 2 - 0.6 * slack;
    if (!best || score > best.score) best = { score, k, c };
  }
  const { k, c } = best;
  const yF = c.raw(0, yFar, 0).sy, yN = c.raw(0, yNear, 0).sy;
  const oy = top + (rh - (yN - yF) * k) / 2 - yF * k;      // far end at the top, near end at the bottom (centred if there is slack)
  const ox = cx;
  const X = (x, y) => { const q = c.raw(x, y, 0); return ox + q.sx * k; };
  const Y = (y) => oy + c.raw(0, y, 0).sy * k;
  const sx = (y) => k / c.raw(0, y, 0).zc;
  const sy = (y) => (Y(y + 0.05) - Y(y - 0.05)) / -0.1;
  const yAt = (py) => { let lo = yNear - 12, hi = yFar + 12; for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (Y(m) > py) lo = m; else hi = m; } return (lo + hi) / 2; };
  const xAt = (px, y) => (px - ox) / sx(y);
  return { eye: c.eye, f: c.f, r: c.r, u: c.u, k, ox, oy, X, Y, sx, sy, yAt, xAt };
}
