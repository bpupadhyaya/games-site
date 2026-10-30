// Hand-off between the 2D screens (view.js) and the optional 3D presenter (view3d/presenter.js). The simulation never reads this.
// `on` is true only while a WebGL scene is alive; with it off every screen draws exactly as before (the software-3D 2D art is the
// fallback for no WebGL, a lost context and ?flat=1).
export const v3 = {
  on: false,
  // the one paper the 3D scene draws this frame (set by view.js while rendering, reset each frame):
  // { faces, cam (virtual units), creases, paper, mode }
  paper: null,
};
