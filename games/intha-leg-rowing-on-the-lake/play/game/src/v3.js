// Shared hand-off between the 2D UI and the optional 3D presenter (view3d/presenter.js). The simulation never reads this.
// `on` is true only while a WebGL context is alive: with it off every screen draws the flat 2D art exactly as before.
export const v3 = {
  on: false,
  live: false,       // the 3D scene was drawn this frame (on && a world exists)
  proj: null,        // (s, n, y) -> { x, y } in virtual units, projected through the live 3D camera (name tags, pops, poise ring)
  ppm: 40,           // virtual units per metre at the player's boat
  stage: null,       // { x, y, w, h } the lake rectangle the camera is framed for
  pressed: null,
};
