// Shared hand-off between the 2D UI (view.js, art.js, game.js) and the optional 3D presenter (view3d/presenter.js).
// The simulation never reads this. `on` is flipped by the presenter only while a WebGL context is alive; with it off every
// screen draws exactly as before (the flat 2D fallback). The presenter publishes the camera projection here so the 2D layer
// can draw guide lines, sparkles and score pops on the lit 3D board and so touches land on the right board spot.
export const v3 = {
  on: false,
  xf: null,        // (simX, simY, h = 0) -> { x, y, s }: virtual screen point of a board spot, s = virtual px per sim unit there
  toWorld: null,   // (screenX, screenY) -> { x, y } sim units on the playing surface
  pressed: null,   // { x, y } while the pointer is down
};
