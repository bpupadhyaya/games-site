// Hand-off between the 2D screens (view.js, game.js) and the optional 3D presenter (view3d/presenter.js). The rules never read this.
// `on` is true only while a WebGL scene is alive; with it off every screen draws exactly as before (the flat 2D art is the fallback for
// no WebGL, a lost context, ?flat=1 and the headless tests). Board positions are in CELL units (column + 0.5, row + 0.5; row 0 at the top);
// the presenter does the projection and hands back `toScreen` / `squareAt` / `cellAt` so taps, labels and drags follow the picture.
export const v3 = {
  on: false,
  frame: null,      // set by the screen being drawn: { mode: 'play' | 'title', rect: {x,y,w,h} in virtual units } (null: a text page, flat backdrop)
  n: 11,            // board size on show
  pieces: [],       // { x, y, kind: 'A'|'D'|'K', lift (0..1), s (scale), id }
  marks: [],        // { x, y, kind: 'sel'|'dest'|'hint'|'last'|'path'|'ring'|'cursor'|'lesson', a }
  t: 0,
  toScreen: null,   // (cellX, cellY, h = 0) -> virtual screen units
  cellAt: null,     // (sx, sy) virtual screen units -> { x, y } float cell coordinates on the board plane (or null)
  squareAt: null,   // (n, sx, sy) -> square index or -1 (through the 3D view)
};
