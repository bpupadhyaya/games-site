// Hand-off between the 2D screens (view.js, game.js) and the optional 3D presenter (view3d/presenter.js). The simulation never reads
// this. `on` is true only while a WebGL scene is alive and drawn; with it off every screen draws exactly as before (the flat 2D art is
// the fallback for no WebGL, a lost context, ?flat=1 and the headless tests).
export const v3 = {
  on: false,
  fade: 1,        // 0..1 right after the 3D scene takes over: the flat art fades out on top of it (crossfade)
  geo: null,      // (x, y, side, flip) -> board geometry like art.boardGeo, but with the 25 points projected from the 3D board
  hero: null,     // title: { x, y, side } where the 3D board goes (virtual units); null = environment view
  boardRect: null,// play: the board rectangle the camera is fitted to this frame
  theme: 'cedar',
  pieces: [],     // pieces the 2D layer wants drawn this frame: { who, i, flip, a: { kind, from, k } | null, sel, glow, sc, cap }
  marks: [],      // rings and discs: { i, flip, rgb, a, r, fill }
};
// Alpha for the flat board/backdrop layers: 1 without 3D, fading to 0 during the crossfade, then 0.
export const flatAlpha = () => (v3.on ? Math.max(0, 1 - v3.fade) : 1);
