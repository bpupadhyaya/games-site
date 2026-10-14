// The pit camera, as pure maths. The 3D picture (web/view3d) and the 2D overlay (cues, pops, sparks in view.js) both use it, so a
// glyph drawn "at an athlete" lands exactly where the 3D athlete stands. World: X right, Y up, Z towards the viewer; metres.
// The layout's pit {cx, cy, R} (screen units) is the pit's outer radius; world origin = pit centre = (cx, cy).
export const CAM = { elev: 0.80, fov: 34 * Math.PI / 180, rw: 3.2 };   // elevation (rad), vertical field of view, metres that pit.R stands for

export function makeCam(w, h, pit) {
  const e = CAM.elev, F = (h / 2) / Math.tan(CAM.fov / 2), D = F * CAM.rw / pit.R;
  const se = Math.sin(e), ce = Math.cos(e);
  return { w, h, cx: pit.cx, cy: pit.cy, R: pit.R, F, D, se, ce, ox: pit.cx - w / 2, oy: pit.cy - h / 2, ppm: pit.R / CAM.rw };
}

// Screen position of a world point.
export function project(cam, X, Y, Z) {
  // camera at (0, D se, D ce) looking at the origin: forward = (0, -se, -ce), up = (0, ce, -se)
  const vy = Y - cam.D * cam.se, vz = Z - cam.D * cam.ce;
  const depth = -vy * cam.se - vz * cam.ce;                      // v . forward
  const yc = vy * cam.ce - vz * cam.se;                          // v . up
  const k = cam.F / depth;                                       // screen units per metre at that depth
  return { x: cam.cx + X * k, y: cam.cy - yc * k, k };
}

// Pit-plane spot i (0..7, 45 degrees apart, 0 = nearest the viewer) at fraction k of the pit radius and height hgt (metres).
export function spotWorld(i, k) {
  const a = Math.PI / 2 + (i * Math.PI * 2) / 8;
  return { X: Math.cos(a) * k * CAM.rw, Z: Math.sin(a) * k * CAM.rw, a };
}
