// Hand-off between the 2D screens (view.js) and the optional 3D presenter (view3d/presenter.js). The simulation never reads this.
// `on` is true only while a WebGL scene is alive and drawn; with it off every screen draws exactly as before (the flat 2D art is the
// fallback for no WebGL, a lost context, ?flat=1 and the headless tests). Board positions are handed over in CELL units of the 2D
// board grid (column + 0.5, row + 0.5 is a square's centre, rows counted from the top of the screen), so the 2D layer needs no
// knowledge of the camera; the presenter projects them through the live camera and back.
export const v3 = {
  on: false,
  fade: 1,        // 0..1 right after the 3D scene takes over (the presenter fades its canvas in)
  hero: null,     // title: the rectangle (virtual units) the 3D board is fitted to, set by the title art each frame
  n: 10,
  pieces: [],     // { cx, cy, side: 1|-1, king, lift, a, big } pieces the 2D layer wants drawn this frame
  marks: [],      // { cx, cy, kind: 'dot'|'ring'|'square'|'glow'|'cursor', color, a, r }
  proj: null,     // (cx, cy) -> { x, y } cell-unit point on the board plane -> virtual screen units
  unproj: null,   // (x, y) -> { cx, cy } virtual screen units -> cell-unit point on the board plane
};
