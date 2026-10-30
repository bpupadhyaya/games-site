// Hand-off between the 2D screens (view.js, art.js) and the optional 3D presenter (view3d/presenter.js). The simulation never reads this.
// `on` is true only while a WebGL scene is alive; with it off every screen draws exactly as before (the flat 2D art is the fallback for
// no WebGL and a lost context). `frame` is filled by art.drawAbacus each frame the abacus is on screen: the presenter draws the frame,
// rods and beads from it at exactly the same virtual-unit geometry, so taps (which use that geometry) land on the 3D beads.
export const v3 = {
  on: false,
  frame: null,   // { g, A, T, hl, t, tilt } of the abacus drawn this frame, or null when the screen has none
  dx: 0,         // horizontal shake offset (virtual units) the 2D layer applies to the play screen
};
// Screens whose backdrop is the 3D desk (the others keep the flat gradient).
export const isDesk = (scene) => scene === 'title' || scene === 'play';
