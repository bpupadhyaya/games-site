// Hand-off between the 2D screens (view.js, game.js) and the optional 3D presenter (view3d/presenter.js). The simulation never reads
// this. `on` is true only while a WebGL scene is alive and drawn; with it off every screen draws exactly as before (the flat 2D art is
// the fallback for no WebGL, a lost context, ?flat=1 and the headless tests).
export const v3 = {
  on: false,
  fade: 1,        // 0..1 right after the 3D scene takes over: the flat art fades out on top of it (crossfade)
  proj: null,     // (ux, uy) -> [x, y] virtual units: a point of the unit-square board seen through the tilted 3D camera
  key: 0,         // changes whenever proj changes (cache key for the projected geometry)
  hero: null,     // title: the board rectangle (virtual units) the camera is fitted to
  theme: 'sandstone',
  lions: [],      // lions the 2D layer wants drawn this frame: { id, q, ux, uy, ang, lift, glow, alpha, scale, dim, ghost }
  marbles: [],    // glass marbles on the board: { ux, uy, rot, alpha, lift }
  marks: [],      // lit cells: { cell, col, fill, line, ring }
};
// Alpha for the flat board/backdrop layers: 1 without 3D, fading to 0 during the crossfade, then 0.
export const flatAlpha = () => (v3.on ? Math.max(0, 1 - v3.fade) : 1);
