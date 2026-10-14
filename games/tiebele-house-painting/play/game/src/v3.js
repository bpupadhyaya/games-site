// Shared hand-off between the 2D UI (ui.js, view.js, menus.js) and the optional 3D presenter (view3d/presenter.js).
// The simulation never reads this. `on` is flipped by the presenter only while a WebGL context is alive; with it off every
// screen draws exactly as before (the flat 2D fallback). The 2D layer reports plaques, buttons, pots and the wall to draw;
// the presenter turns them into lit 3D plaster plaques, clay buttons, lathe-turned pots and the painted wall.
export const v3 = {
  on: false,
  panels: [],        // { r, rad, kind, front, clip }
  buttons: [],       // { r, rad, kind:'primary'|'active'|'disabled'|'dark'|'plain', clip }
  pots: [],          // { r, color, fill (0..1), sel, locked, empty, bad }
  scrim: 0,          // 0..1 full-screen dimming drawn in 3D under the front plaques
  scene: 'title',
  wallRect: null,    // { x, y, cs, W, H }: where the wall grid sits on screen (play, result)
  heroRect: null,    // title: where the hero wall goes
  wallView: null,    // { wall, cells, glaze, guide, hintIdx, hintColor, wrong, cursor }
  phase: 'paint',
  pressed: null,     // { x, y } while the pointer is down
  clip: null,        // scrolled lists: visible rect (virtual units)
  stroke: null,      // { x, y, color } while a brush stroke is in progress (virtual units)
};
