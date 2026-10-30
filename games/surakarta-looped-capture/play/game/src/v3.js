// Hand-off between the 2D screens (view.js, game.js) and the optional 3D presenter (view3d/presenter.js). The simulation never reads
// this. `on` is true only while a WebGL scene is alive and drawn; with it off every screen draws exactly as before (the flat 2D art is
// the fallback for no WebGL, a lost context, ?flat=1 and the headless tests).
export const v3 = {
  on: false,
  fade: 1,        // 0..1 right after the 3D scene takes over: the flat art fades out on top of it (crossfade)
  geo: null,      // (x, y, side, flip) -> board geometry like art.boardGeo, but projected from the tilted 3D board (pt(c, r) takes any grid coordinate)
  hero: null,     // title: the board rectangle (virtual units) the camera is fitted to; null = environment view
  theme: 'teak',
  totals: { 1: 12, 2: 12 },  // pieces each side started the current game with (the capture rails show the difference)
  pieces: [],     // pieces the 2D layer wants drawn this frame: { who, i, flip, g?: [gx, gy], a?: {...}, sel, cap, sc }
  marks: [],      // rings and discs: { i, flip, col, a, r, fill }
};
// Alpha for the flat board/backdrop layers: 1 without 3D, fading to 0 during the crossfade, then 0.
export const flatAlpha = () => (v3.on ? Math.max(0, 1 - v3.fade) : 1);
