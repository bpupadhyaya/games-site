// Hand-off between the 2D screens (view.js, game.js) and the optional 3D presenter (view3d/presenter.js). The rules never read this.
// `on` is true only while a WebGL scene is alive; with it off every screen draws exactly as before (the flat 2D art is the fallback for no WebGL,
// a lost context, ?flat=1 and the headless tests). Positions are board cell units (column + 0.5, row + 0.5; row 0 at the top as drawn); the presenter
// does the projection and hands back `toScreen` / `cellAt` so taps, labels and the finger magnifier follow the picture.
export const v3 = {
  on: false,
  frame: null,      // set by the screen being drawn: { mode: 'play' | 'title', rect: {x,y,w,h} in virtual units, variant, boardKey } (null: a text page, flat backdrop)
  pieces: [],       // { x, y, seat, lift (0..1.5), s (scale), glow }
  marks: [],        // { x, y, kind: 'sel'|'dest'|'hop'|'hint'|'last'|'star'|'lesson'|'cursor'|'ripple'|'ring', a, sc }
  t: 0,
  toScreen: null,   // (cellX, cellY, h = 0) -> virtual screen units
  cellAt: null,     // (sx, sy) virtual screen units -> { x, y } float cell coordinates on the board plane (or null)
  wantSnap: false,  // the finger magnifier is up: the presenter keeps a copy of its last frame in `snap`
  snap: null,       // { canvas, k }  k = snapshot pixels per virtual unit; origin via vToSnap
  vToSnap: null,
};

// The turned peg's silhouette (radius, height) in cells: the 3D lathe and the flat icons are drawn from the same profile.
export const PROFILE = [[0, 0], [0.37, 0], [0.4, 0.035], [0.39, 0.09], [0.31, 0.17], [0.22, 0.3], [0.165, 0.43], [0.16, 0.5], [0.23, 0.55], [0.235, 0.6], [0.17, 0.64], [0.23, 0.72], [0.27, 0.8], [0.26, 0.88], [0.18, 0.95], [0.08, 0.985], [0, 0.995]];
