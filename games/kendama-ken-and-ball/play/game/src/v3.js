// Hand-off between the 2D screens (hud.js, art.js, menus.js) and the optional 3D presenter (view3d/presenter.js). The simulation never
// reads this. `on` is true only while a WebGL scene is alive and drawn: with it off every screen draws exactly as before (the flat 2D
// art is the fallback for no WebGL, a lost context and ?flat=1).
export const v3 = {
  on: false,
  // set by drawWorld() each frame the toy is drawn: { w (sim world), rope, m (DOMMatrix: world units -> canvas px), stage (bool), glow }
  world: null,
};
