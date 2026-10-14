// Shared hand-off between the 2D UI (view.js, ui.js, art.js) and the optional 3D presenter (view3d/presenter.js).
// The simulation never reads this. `on` is true only while a WebGL context is alive; with it false every screen draws exactly
// as before (the flat 2D fallback). The 2D layer reports plaques / buttons / beans here; the presenter turns them into lit 3D
// objects behind the text, and publishes the board projection back (cell, pick) so tap hit-testing follows the 3D camera.
export const v3 = {
  on: false,
  cell: null,        // (u, v, h) grid coords (0..9, cell centres at k + 0.5) + height above tile top -> { x, y } in virtual units
  panels: [],        // { r, rad, kind }   kind: slate | sheet | plateOn | plateOff | tray
  buttons: [],       // { r, rad, kind, hot }
  beans: [],         // { r, marked, i }   HUD beans in the actions panel (tumble while the sim is throwing)
  scrim: 0,
  scene: 'title',
  heroRect: null,    // where the 3D board goes on title / setup / result
  heroSeats: null,   // armSeat for that hero board
  pressed: null,
};
export const sprites = { ready: false, bead: [], bean: {} };
