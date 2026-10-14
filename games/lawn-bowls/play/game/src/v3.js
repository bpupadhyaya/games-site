// Hand-off between the 2D layer and the optional 3D presenter (view3d/presenter.js). The simulation never reads this.
// `on` is true only while a WebGL context is alive; with it false every screen draws exactly as before (the 2D fallback).
export const v3 = {
  on: false,
};
