// Shared hand-off between the 2D UI (view.js, art.js) and the optional 3D presenter (view3d/presenter.js).
// The simulation never reads this. `on` is flipped by the presenter only while a WebGL context is alive; with it off every
// screen draws exactly as before (the 2D fallback). The 2D layer reports panels/buttons here; the presenter turns them
// into lit 3D plaques behind the text.
export const v3 = {
  on: false,
  pick: null,          // (x, y) -> point index or -1 (3D board)
  panels: [],          // { r, rad, kind }
  buttons: [],         // { r, rad, label, primary, on, dim }
  scrim: 0,            // 0..1 full-screen dimming drawn in 3D under the plaques
  heroRect: null,      // title screen: where the 3D hero board goes
  scene: 'title',
  pressed: null,       // { x, y } while the pointer is down
};
