// Hand-off between the 2D screens (view.js, game.js) and the optional 3D presenter (view3d/presenter.js). The simulation never reads
// this. `on` is true only while a WebGL scene is alive and drawn; with it off every screen draws exactly as before (the flat 2D art is
// the fallback for no WebGL, a lost context, ?flat=1 and the headless tests).
export const v3 = {
  on: false,
  fade: 1,        // 0..1 right after the 3D scene takes over: the flat art fades out on top of it (crossfade)
  pt: null,       // (i, lift) -> { x, y, k } square i projected to virtual units; k = scale of a 3D square vs the flat board's square
  pick: null,     // (x, y) -> square index or -1 under a virtual-unit point (ray onto the carved board)
  hero: null,     // title: { x, y, w, h } (virtual units) where the 3D board sits; null = default framing
  frame: null,    // what the board shows this frame (view.js fills it): { mode, cells, anim, ghosts, sel, ... }
  marks: [],      // light the 2D layer asked for this frame: { sq, rgb, a, fill } laid into the pockets
};
// Alpha for the flat board/backdrop layers: 1 without 3D, fading to 0 during the crossfade, then 0.
export const flatAlpha = () => (v3.on ? Math.max(0, 1 - v3.fade) : 1);
