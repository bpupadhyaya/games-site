// Shared hand-off between the 2D UI (view.js, art.js, game.js) and the optional 3D presenter (view3d/presenter.js).
// The simulation never reads this. `on` is set by the presenter only while a WebGL context is alive; with it off every screen draws
// exactly as before (the flat 2D fallback). The 2D layer reports panels, buttons and piece icons here; the presenter turns them into
// lit 3D plaques, lacquered buttons and real pieces behind the text.
export const v3 = {
  on: false,
  sq: null,            // (cellIndex) -> { x, y } projected point centre in virtual units (3D board)
  pick: null,          // (x, y) -> cell index or -1 (3D board)
  panels: [],          // { r, rad, kind, a }
  buttons: [],         // { r, label, primary, on, dim, a }
  icons: [],           // { x, y, size, side, glow, lift, spin }  real 3D pieces drawn over the plaques (plates, result card)
  scrim: 0,            // 0..1 full-screen dimming drawn in 3D under the plaques
  heroRect: null,      // title / document screens: where the hero board goes
  scene: 'title',
  pressed: null,       // { x, y } while the pointer is down
};
