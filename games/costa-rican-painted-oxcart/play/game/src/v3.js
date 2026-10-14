// Shared hand-off between the 2D UI (ui.js, art.js, view.js) and the optional 3D presenter (view3d/presenter.js).
// The simulation never reads this. `on` is true only while a WebGL context is alive; with it off every screen draws exactly as
// before (the flat 2D art is the fallback and the first frame). The 2D layer reports the piece, plaques, buttons and jars here;
// the presenter turns them into lit 3D objects behind the 2D text.
export const v3 = {
  on: false,
  req: null,          // { P, a, rect, pop, hi:Set, sel:Set, given:Set, rot, t, hero } the piece to show this frame
  panels: [],         // { r, rad, kind, clip }
  buttons: [],        // { r, rad, accent, active, disabled, flash, clip }
  jars: [],           // { r, id, frac, sel, empty, shake, clip }
  scrim: 0,
  clip: null,         // current scroll clip (virtual units) while a scrolling body is drawn
  off: 0,             // current scroll translation (virtual y)
  look: 'workshop',
  fit: null,          // { rect, unit } camera fitted for the piece (set by the presenter when it accepts a request)
  setPiece: null,     // (req, w, h) -> fits the camera, called by the 2D layer before it uses project/unproject
  project: null,      // (u, v) -> [x, y] virtual units of a point in the piece frame
  unproject: null,    // (x, y) -> [u, v] piece frame under a virtual point
  present: null,      // (w, h, dt) -> render the frame
};
// Is the 3D camera currently fitted to exactly this board rectangle? (hit tests and overlays then use the 3D projection)
export const live = (rect) => !!(v3.on && v3.fit && v3.unproject && Math.abs(v3.fit.rect.x - rect.x) < 0.6 && Math.abs(v3.fit.rect.y - rect.y) < 0.6 && Math.abs(v3.fit.rect.w - rect.w) < 0.6 && Math.abs(v3.fit.rect.h - rect.h) < 0.6);
