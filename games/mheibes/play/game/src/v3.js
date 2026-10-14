// Shared hand-off between the 2D UI (view.js, art.js) and the optional 3D presenter (view3d/presenter.js). The simulation never reads this.
// `on` is true only while a WebGL context is alive and the scene is built; with it off every screen draws exactly as before (flat 2D art).
// While on, the 2D layer reports its plaques and buttons here and draws only text, people and hands on top; the presenter turns the
// reports into carved-wood plaques and lacquered buttons behind them, over a lit 3D majlis.
export const v3 = {
  on: false,
  panels: [],      // { r: {x,y,w,h}, rad, kind: 'plaque' | 'card' | 'doc' | 'tag' | 'inset' }
  buttons: [],     // { r, rad, kind: 'primary' | 'quiet' | 'on' | 'dim', label }
  scrim: 0,        // 0..1 dimming drawn in 3D under the plaques
  pressed: null,   // { x, y } while the pointer is down (virtual units)
  hands: { ready: false, img: {} },   // baked 3D hand sprites (art.js draws them)
};
