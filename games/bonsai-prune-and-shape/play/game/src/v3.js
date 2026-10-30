// Hand-off between the 2D screens (view.js) and the optional 3D presenter (view3d/presenter.js). The simulation never reads this.
// `on` is true only while a WebGL scene is alive; with it off every screen draws exactly as before (the flat 2D art is the fallback
// for no WebGL, a lost context, ?flat=1 and the headless tests).
export const v3 = {
  on: false,
  // the one tree stage the 3D scene draws this frame (set by view.js while rendering, reset each frame):
  // { rect: {x,y,w,h} virtual units, cam: {cx,cy,k}, T, pot, yt, leaf, sway }
  stage: null,
};
