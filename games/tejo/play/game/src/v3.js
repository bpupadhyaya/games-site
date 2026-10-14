// Shared hand-off between the 2D UI (view.js, menus.js, ui.js) and the optional 3D presenter (view3d/presenter.js).
// The simulation never reads this. `on` is true only while a WebGL context is alive; with it off every screen draws exactly as
// before (the flat 2D fallback). The presenter fills `proj` so the 2D layer can place labels on the 3D scene.
export const v3 = { on: false, heroRect: null, scrim: 0 };
