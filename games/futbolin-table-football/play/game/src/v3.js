// Hand-off between the 2D layer and the optional 3D presenter (web/view3d/presenter.js). The simulation never reads this.
// `on` is true only while a WebGL scene is alive and drawing the table; with it off every screen draws exactly as before (2D fallback).
// While `on`, the presenter publishes the camera it fitted to a play layout (`fit`), and project/unproject for that camera.
export const v3 = {
  on: false,
  fit: null,           // { cx, cy, s, wide } of the playLayout the camera is fitted to (project/unproject are valid only for it)
  project: null,       // (tableX, tableY, liftCm?) -> { x, y } virtual units
  unproject: null,     // (virtualX, virtualY) -> { x, y } table units on the rod plane
  scale: null,         // (tableX, tableY) -> virtual units per table unit at that point
  hero: null,          // menus: { x, y, w, h } virtual rect where the 3D hero table should sit (null: whole screen)
  scene: 'title',
};
export const fitted = (lay) => !!(v3.on && v3.fit && lay && v3.fit.cx === lay.cx && v3.fit.cy === lay.cy && v3.fit.s === lay.s && v3.fit.wide === lay.wide);
