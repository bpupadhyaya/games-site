// Shared hand-off between the 2D UI (view.js, ui.js) and the optional 3D presenter (view3d/presenter.js).
// The simulation never reads this. `on` is flipped by the presenter only while a WebGL context is alive; with it off every
// screen draws exactly as before (the 2D fallback). The 2D layer reports panels and buttons here; the presenter turns them into
// lit 3D plaques and lacquered buttons behind the text.
export const v3 = {
  on: false,
  scene: 'title',
  panels: [],          // { r, rad, kind, layer, clip }
  buttons: [],         // { r, rad, kind, active, dim, flash, layer, clip }
  scrim: 0,            // 0..1 full-screen dimming drawn in 3D under the modal layer
  pressed: null,       // { x, y } while the pointer is down
  clip: null,          // scroll body rect while a scrolling body is being drawn (3D plaques are scissored to it)
  sy: 0,               // its scroll offset
  proj: null,          // (layoutX, layoutY, h) -> { x, y } virtual px of a point over the face plane (play scene)
  unproj: null,        // (px, py) -> { x, y } layout units on the face plane (play scene); null elsewhere
  hero: null,          // title: { r, panels } the hero box rect and its sliding panels
  open: null,          // result: { field, k, kind } the open box
  figure: null,        // { r, kind, t, clip } a small box figure for the Rules / How to Play pages
};
