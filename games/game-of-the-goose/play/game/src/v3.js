// Shared hand-off between the 2D UI (view.js, ui.js, art.js) and the optional 3D presenter (view3d/presenter.js).
// The simulation never reads this. `on` is flipped by the presenter only while a WebGL context is alive; with it off every
// screen draws exactly as before (the flat 2D fallback). The 2D layer reports panels / buttons / dice slots here and draws only
// text on top; the presenter turns them into lit 3D plaques, lacquered buttons and tumbling dice behind the text.
export const v3 = {
  on: false,
  sq: null,            // (space n) -> { x, y } projected centre of space n in virtual units (3D board), or null
  panels: [],          // { r, rad, kind: 'parch' | 'slate' | 'sign' | 'inset' | 'cur' }
  buttons: [],         // { r, rad, kind, hot, on }
  dice: [],            // { r, v, idx } slots reported by the actions panel
  hi: [],              // [{ n, color, strong }] highlighted spaces
  roads: null,         // { on, active }
  scrim: 0,            // 0..1 full-screen dimming drawn in 3D under the plaques
  heroRect: null,      // title screen: where the 3D hero board goes
  pressed: null,       // { x, y } while the pointer is down
};
