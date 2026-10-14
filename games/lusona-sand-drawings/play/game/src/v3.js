// Shared hand-off between the 2D UI (ui.js, view.js) and the optional 3D presenter (view3d/presenter.js).
// The simulation never reads this. `on` is flipped by the presenter only while a WebGL context is alive; with it off every
// screen draws exactly as before (the flat 2D fallback). The 2D layer reports plaques and buttons here; the presenter turns
// them into lit 3D carved plaques behind the text.
export const v3 = {
  on: false,
  pick: null,          // (x, y) virtual units -> cell index or -1 (3D field)
  panels: [],          // { r, rad, kind, dark, clip }
  buttons: [],         // { r, rad, primary, on, dim, color, dark, clip }
  scrim: 0,            // 0..1 full-screen dimming drawn in 3D under the plaques
  heroRect: null,      // title screen: where the hero field goes
  fieldRect: null,     // play / result: the area the field must fit
  scene: 'title',
  pressed: null,       // { x, y } while the pointer is down
  offY: 0,             // scrolled lists: the translation the 2D layer applies
  clip: null,          // scrolled lists: visible rect (virtual units)
  dark: true,
};
