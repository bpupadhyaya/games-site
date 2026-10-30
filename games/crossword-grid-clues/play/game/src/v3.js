// Hand-off between the 2D screens (board.js) and the optional 3D presenter (view3d/presenter.js). The simulation never reads this.
// `on` is true only while a WebGL scene is alive; with it off every screen draws exactly as before (the flat 2D art is the fallback
// for no WebGL, a lost context and ?flat=1).
export const v3 = {
  on: false,
  // the one crossword board the 3D scene draws this frame (set by board.js while rendering, reset each frame):
  // { geo, n, zoomed, cells: [{ k: 0 block | 1 square, face, lift, dx }], T }
  stage: null,
};
