// Shared hand-off between the 2D UI (view.js, art.js, game.js) and the optional 3D presenter (view3d/presenter.js).
// The simulation never reads this. `on` is true only while a WebGL context is alive; with it off every screen draws the flat 2D art.
export const v3 = {
  on: false,
  sq: null,            // (cellIndex, height = 0) -> { x, y } projected point above a point of the net, in virtual units
  pick: null,          // (x, y) -> cell index or -1 (3D board)
  unit: 60,            // projected width of one cell at the board centre, virtual units
  panels: [],          // { r, rad, kind }
  buttons: [],         // { r, rad, label, primary, on, dim }
  scrim: 0,            // 0..1 full-screen dimming drawn in 3D under the plaques
  heroRect: null,      // title screen: where the 3D hero board goes
  pressed: null,       // { x, y } while the pointer is down
};
export const sprites = { ready: false, stone: {} };   // the 3D stones rendered once to canvases for the 2D trays and plates
