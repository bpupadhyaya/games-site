// Hand-off between the 2D layer (view.js) and the optional 3D presenter (view3d/presenter.js). The simulation never reads this.
// `on` is true only while a WebGL scene is alive and drawn; with it off every screen draws exactly as before (the flat 2D art is the
// fallback for no WebGL and a lost context).
export const v3 = {
  on: false,
  world: null,   // the world (terrain + balls) the 2D layer drew this frame
  held: null,    // the boule or jack in the sling this frame: { sx, sy, team, jack } (stage units), or null
  mark: 0,       // id of a ball to ring (hint)
};
