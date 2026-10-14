// Shared hand-off between the 2D UI (view.js, art.js, game.js) and the optional 3D presenter (view3d/presenter.js).
// The simulation never reads this. `on` is flipped by the presenter only while a WebGL context is alive; with it off every
// screen draws exactly as before (the flat 2D fallback). The 2D layer reports panels/buttons here; the presenter turns them
// into lit 3D plaques behind the text and draws the board, pebbles and effects itself from the same state.
export const v3 = {
  on: false,
  sq: null,            // (cellIndex) -> { x, y } projected pit centre in virtual units
  pick: null,          // (x, y) -> cell index or -1 (ray vs the board plane, same camera as the picture)
  unproj: null,        // (x, y) -> { x, z } world point on the board plane (drag)
  panels: [],          // { r, rad, kind }
  buttons: [],         // { r, rad, primary, on, dim }
  scrim: 0,            // 0..1 full-screen dimming drawn in 3D under the plaques
  heroRect: null,      // title screen: where the 3D hero board goes
  pressed: null,       // { x, y } while the pointer is down
};
// Pre-rendered 3D pebble sprites for the flat layer (plates, trays, result card, diagrams). `ready` once the presenter has drawn them.
export const sprites = { ready: false, pebble: {}, pit: {} };
