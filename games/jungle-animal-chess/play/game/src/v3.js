// Hand-off between the 2D screens (view.js, game.js) and the optional 3D presenter (view3d/presenter.js). The rules never read this.
// `on` is true only while a WebGL scene is alive; with it off every screen draws exactly as before (the flat 2D art is the fallback for no WebGL,
// a lost context, ?flat=1 and the headless tests). Board positions are in DISPLAY cell units (column + 0.5, row + 0.5; row 0 at the top as drawn, so
// already flipped when the human plays Blue); the presenter does the projection and hands back `toScreen` / `cellAt` so taps and labels follow the picture.
export const v3 = {
  on: false,
  frame: null,      // set by the screen being drawn: { mode: 'play' | 'title', rect: {x,y,w,h} in virtual units } (null: a text page, flat backdrop)
  flip: false,      // the board is shown from Blue's side
  pieces: [],       // { x, y, side: 1|2, rank: 1..8, lift (0..1), s (scale), swim }
  marks: [],        // { x, y, kind: 'sel'|'dest'|'cap'|'jump'|'hint'|'last'|'ring'|'ripple'|'cursor'|'lesson', a }
  t: 0,
  toScreen: null,   // (cellX, cellY, h = 0) -> virtual screen units
  cellAt: null,     // (sx, sy) virtual screen units -> { x, y } float display-cell coordinates on the board plane (or null)
};
