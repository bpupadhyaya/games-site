// Hand-off between the pure game/view code and the optional 3D presenter (web/view3d). Plain data only: web/src never imports the 3D layer.
//   on       true while the WebGL chamber is drawn behind the (then transparent) kit canvas; false = the flat 2D art (no WebGL, context lost, tests).
//   rec      what view.js would have painted this frame (pieces, glowing squares, sticks, title hero), recorded instead of drawn when `on`.
//   proj     (canonX, canonY) -> screen point of a canonical board point on the tile tops; set by the presenter.
//   pick     (x, y) -> board square under a screen point (-1 none, 30 = the exit), pieces first; set by the presenter.
export const v3 = { on: false, rec: null, proj: null, pick: null };
