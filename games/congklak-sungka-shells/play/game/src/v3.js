// Hand-off between the 2D layer (view.js, layout.js) and the optional 3D presenter (web/view3d/presenter.js). Plain data, no imports.
// The simulation never reads it. `on` is set by the presenter only while a WebGL scene is alive; with it off every screen draws
// exactly as before (the flat 2D art is the fallback for no WebGL / context loss).
//   toBoard(x, y)    screen (virtual units) -> canonical board coordinates, through the 3D camera (tap -> house)
//   toScreen(x, y, h) canonical board point (lifted h board units) -> screen, through the 3D camera (labels, counts)
//   marks            glows view.js wants on the board this frame: [{ pos, rgb, a }] (legal houses, hint, picks, refusal ...)
export const v3 = { on: false, toBoard: null, toScreen: null, marks: [], kb: -1 };
