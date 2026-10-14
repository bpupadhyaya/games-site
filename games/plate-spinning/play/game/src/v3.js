// Hand-off between the 2D UI (view.js, playview.js, ui.js) and the optional 3D presenter (view3d/presenter.js).
// The simulation never reads this. `on` is set by the presenter only while a WebGL context is alive; with it off every screen draws exactly as it
// did before (the 2D fallback). While on, the 2D layer reports its panels and buttons here and the presenter draws them as lit lacquer plaques.
export const v3 = {
  on: false,
  scene: 'title',
  panels: [],          // { r, rad, kind }
  buttons: [],         // { r, rad, kind, label }
  scrim: 0,            // 0..1 full-screen dimming drawn in 3D beneath the plaques
  heroRect: null,      // title screen: where the 3D hero scene should be framed
  pressed: null,       // { x, y } while the pointer is down
};
