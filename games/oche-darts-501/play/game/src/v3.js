// Hand-off between the 2D screens (view.js, menus.js, art.js) and the optional 3D presenter (view3d/presenter.js). The simulation never
// reads this. `on` is true only while a WebGL scene is alive and drawn; with it off every screen draws exactly as before (the flat 2D
// art is the fallback for no WebGL, a lost context, ?flat=1 and the headless tests).
export const v3 = {
  on: false,
  fade: 1,        // 0..1 right after the 3D scene takes over: the flat art fades out on top of it (crossfade)
  board: null,    // { x, y, r } in CSS px: where the 2D layer would draw the board this frame (r = the 170 mm scoring edge); null = no board on screen
};
// Alpha for the flat wall / board layers: 1 without 3D, fading to 0 during the crossfade, then 0.
export const flatAlpha = () => (v3.on ? Math.max(0, 1 - v3.fade) : 1);
// Called by the 2D layer wherever it draws the board: records the board circle in CSS px under the current canvas transform.
export function markBoard(ctx, cx, cy, R) {
  if (typeof ctx.getTransform !== 'function') return;
  const m = ctx.getTransform(), cv = ctx.canvas, k = cv && cv.clientWidth ? cv.width / cv.clientWidth : 1;
  if (!m) return;
  v3.board = { x: (m.e + m.a * cx + m.c * cy) / k, y: (m.f + m.b * cx + m.d * cy) / k, r: (R * Math.hypot(m.a, m.b)) / k };
}
