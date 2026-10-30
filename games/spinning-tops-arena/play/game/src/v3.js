// Hand-off between the 2D screens (view.js, menus.js) and the optional 3D presenter (view3d/presenter.js). The simulation never reads
// this. `on` is true only while a WebGL scene is alive; with it off every screen draws exactly as before (the flat 2D art is the
// fallback for no WebGL, a lost context and ?flat=1).
export const v3 = {
  on: false,
  want: false,   // set by the 2D layer each frame when this screen sits on the 3D table (the table layer is skipped, the canvas cleared)
  frame: null,   // the dish and tops this frame: { arena, tops, looks, age, clock, xf: { s, tx, ty } } (xf maps dish design units -> screen units)
};
