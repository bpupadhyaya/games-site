// Shared hand-off between the 2D UI (view.js, art.js, layout.js) and the optional 3D presenter (view3d/presenter.js).
// The simulation never reads this. `on` is flipped by the presenter only while a WebGL context is alive; with it off every
// screen draws exactly as it did before (the flat 2D fallback). The 2D layer reports panels and buttons here; the presenter
// turns them into lit carved plaques and lacquered buttons behind the text.
export const v3 = {
  on: false,
  sq: null,            // (cellIndex) -> { x, y } projected tile centre in virtual units (3D board)
  pick: null,          // (x, y) -> cell index or -1 (3D board)
  drag: null,          // (x, y) -> { x, y } where a dragged piece is drawn (unused by the 2D layer)
  panels: [],          // { r, rad, kind }
  buttons: [],         // { r, rad, label, primary, on, dim }
  marks: [],           // { i, color } extra ring markers the 2D layer wants on the 3D board (lesson target)
  scrim: 0,            // 0..1 full-screen dimming drawn in 3D under the plaques
  heroRect: null,      // title screen: where the 3D hero board goes
  scene: 'title',
  pressed: null,       // { x, y } while the pointer is down
};
