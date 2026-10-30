// Hand-off between the 2D screens (view.js) and the optional 3D presenter (view3d/presenter.js). The simulation never reads this.
// `on` is true only while a WebGL scene is alive; with it off every screen draws exactly as before (the flat 2D art is the fallback
// for no WebGL, a lost context and ?flat=1).
export const v3 = {
  on: false,
  want: false,   // set by drawScene each frame when the sky is WebGL (the canvas is cleared, the 3D sky shows through)
  frame: null,   // this frame's sky: { sky, t, wp, dir, w, pals, noFlyers, vw } (vw = the visible world rectangle in world units)
};
