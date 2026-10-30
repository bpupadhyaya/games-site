// Hand-off between the 2D screens (view.js) and the optional 3D presenter (view3d/presenter.js). The simulation never reads this.
// `on` is true only while a WebGL scene is alive and drawn; with it off every screen draws exactly as before (the flat 2D art is the
// fallback for no WebGL, a lost context and ?flat=1).
export const v3 = {
  on: false,
  fade: 1,        // 0..1 right after the 3D scene takes over: the flat art fades out on top of it (crossfade)
  cam: null,      // this frame's table camera in CSS px: { orient, f, cx, cy, phi, E }; null = no table on screen
};
export const flatAlpha = () => (v3.on ? Math.max(0, 1 - v3.fade) : 1);
// Called by the 2D layer wherever it would draw the table: records the pinhole camera (screen units -> CSS px under the canvas transform).
export function markCam(ctx, cam) {
  if (typeof ctx.getTransform !== 'function') return;
  const m = ctx.getTransform(), cv = ctx.canvas, k = cv && cv.clientWidth ? cv.width / cv.clientWidth : 1;
  if (!m) return;
  v3.cam = { orient: cam.orient, phi: cam.phi, E: cam.E, f: (cam.f * Math.hypot(m.a, m.b)) / k, cx: (m.e + m.a * cam.cx + m.c * cam.cy) / k, cy: (m.f + m.b * cam.cx + m.d * cam.cy) / k };
}
