// Hand-off between the 2D screens (view.js, game.js) and the optional 3D presenter (view3d/presenter.js). The simulation never reads
// this. `on` is true only while a WebGL scene is alive and drawn; with it off every screen draws exactly as before (the flat 2D art is
// the fallback for no WebGL, a lost context, ?flat=1 and the headless tests).
export const v3 = {
  on: false,
  fade: 1,        // 0..1 right after the 3D scene takes over: the flat art fades out on top of it (crossfade)
  hero: null,     // title: the rectangle (virtual units) the 3D board is fitted to
  n: 8, flip: false,
  pieces: [],     // discs the 2D layer wants drawn this frame: { i, who, a?: { kind: 'place'|'flip', k, age, from, to } }
  marks: [],      // light on the board: { i, kind: 'dot'|'chosen'|'ring'|'last'|'cursor'|'glow'|'target', a }
  pt: null,       // (i) -> { x, y, sx, sy } the cell centre and its half-extents in virtual units, projected from the tilted board
  hit: null,      // (x, y) -> cell index under the finger or -1
};
// Alpha for the flat board/backdrop layers: 1 without 3D, fading to 0 during the crossfade, then 0.
export const flatAlpha = () => (v3.on ? Math.max(0, 1 - v3.fade) : 1);
