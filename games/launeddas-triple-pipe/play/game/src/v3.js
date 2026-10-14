// Hand-off between the 2D screens (view.js, ui.js, hud.js, menus.js) and the optional 3D presenter (view3d/presenter.js).
// The simulation never reads this. `on` is true only while a WebGL context is alive; with it off every screen draws exactly as
// before (flat 2D art). With it on, the 2D code reports the sky, the pipes, the lane field, the pads, the notes, the plaques and
// the buttons here and paints only TEXT, digits, hint rings and particles; the presenter lights them in 3D behind the 2D canvas.
export const v3 = {
  on: false,
  modal: false,       // true while a pause / reason dialog is painted: those draw their own opaque 2D plaques over everything
  force2d: false,     // true while a small framed illustration (Rules pages) is painted: it keeps the flat art
  base: null,         // the canvas transform at the start of the frame (virtual units -> device pixels)
  sky: null,          // { dim }
  pipes: [],          // { r, o } (virtual units)
  field: null,        // { f, cols, top, hitY, padTop }
  notes: [],          // { x, y, r, lane, dead, hint }
  pads: [],           // { r, i, down, hint, sq }
  gauge: null,        // { r, air, low }
  panels: [],         // { r, rad, fill }
  buttons: [],        // { r, kind, pressed, disabled }
  clip: null,         // { top, bottom } while a scrolling list is painted
  pressed: null,
};
export const active = () => v3.on && !v3.force2d && !v3.modal;
export function resetFrame() {
  v3.sky = null; v3.pipes.length = 0; v3.field = null; v3.notes.length = 0; v3.pads.length = 0; v3.gauge = null;
  v3.panels.length = 0; v3.buttons.length = 0; v3.clip = null;
}
// Map a rectangle given in the CURRENT 2D transform to virtual units (the frame's base transform).
export function toV(ctx, r) {
  let m = ctx.getTransform ? ctx.getTransform() : null;
  if (!m || typeof m.a !== 'number') m = { a: 1, d: 1, e: 0, f: 0 };
  const b = v3.base;
  if (!b) return { x: m.a * r.x + m.e, y: m.d * r.y + m.f, w: m.a * r.w, h: m.d * r.h };
  const bs = b.a || 1, bd = b.d || 1;
  return { x: (m.a * r.x + m.e - b.e) / bs, y: (m.d * r.y + m.f - b.f) / bd, w: (m.a * r.w) / bs, h: (m.d * r.h) / bd };
}
