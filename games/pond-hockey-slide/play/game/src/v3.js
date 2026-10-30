// Hand-off between the 2D layer (view.js, menus.js) and the optional lit 3D pond (view3d/presenter.js, game-owned).
// The simulation never reads this. `on` is true only while a WebGL context is alive and the 3D pond is built; with it off every
// screen draws exactly as before (the painted 2D pond is the fallback). `mix` (0..1) crossfades the painted pond out while the
// 3D pond fades in. `frame` is what drawPond() was asked to show this frame (null on screens without a pond).
export const v3 = { on: false, mix: 0, frame: null };
