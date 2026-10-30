// Hand-off between the 2D screens (view.js) and the optional 3D presenter (view3d/presenter.js). The simulation never reads this.
// `on` is true only while a WebGL scene is alive; `active` only for the frames whose screen shows the board (play, lessons, daily shot,
// Auto Play, title). With either off every screen draws exactly as before: the flat 2D art is the fallback (no WebGL, a lost context, ?flat=1).
export const v3 = {
  on: false,
  active: false,
  inBoard: false,   // true while view.js draws inside the board's canonical transform
  pose: null,       // { cx, cy, f }: where the board's canonical centre lands on screen (virtual units) and its scale
  theme: 'plywood',
  pieces: [],       // { k, x, y, s, lift, alpha } in canonical board space, in draw order (x, y as drawPiece receives them)
};
