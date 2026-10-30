// Hand-off between the 2D screens (ui/render.js, ui/draw.js) and the optional 3D presenter (view3d/presenter.js). The simulation never
// reads this. `on` is true only while a WebGL scene is alive and drawn; with it off every screen draws exactly as before (the flat 2D
// art is the fallback for no WebGL, a lost context and the headless tests).
export const v3 = {
  on: false,
  fade: 1,        // 0..1 right after the 3D scene takes over: the flat art fades out on top of it (crossfade)
  clip: null,     // css-pixel rectangle of the 2D piece being drawn (landscape bands); items outside it belong to another piece
  items: [],      // 3D things the 2D layer wants drawn this frame (constructs, bows): { kind, id, sx, sy, px, r, ... } in CSS pixels
  tint: null,     // horizon colour of the element being fought (sky pass)
  moon: null,     // { x, y, r } in design units, big on the title, small elsewhere (sky pass)
  credits: '',    // licence text of the 3D layer, shown at the end of About
  mood: '',       // scene name for the camera (title, battle, map ...)
};
// Alpha for the flat layers: 1 without 3D, fading to 0 during the crossfade, then 0.
export const flatAlpha = () => (v3.on ? Math.max(0, 1 - v3.fade) : 1);

// Where a design-space point lands on screen (CSS px) through the current canvas transform (bands, scale, safe areas included), and
// how many CSS px one design unit is there. Recorded for the presenter, which re-draws the thing as a lit 3D object at that spot.
export function put3(ctx, kind, id, x, y, r, extra = {}) {
  if (!v3.on || !ctx.getTransform) return;
  const m = ctx.getTransform(), cv = ctx.canvas, k = (cv.clientWidth || cv.width) / cv.width;
  const sx = (m.a * x + m.c * y + m.e) * k, sy = (m.b * x + m.d * y + m.f) * k, c = v3.clip;
  if (c && (sx < c.x0 || sx > c.x1 || sy < c.y0 || sy > c.y1)) return;
  v3.items.push({ kind, id, sx, sy, px: Math.hypot(m.a, m.b) * k, r, ...extra });
}
