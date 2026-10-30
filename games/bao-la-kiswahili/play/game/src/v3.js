// Hand-off between the 2D screens (view.js, layout.js) and the optional 3D presenter (view3d/presenter.js). The simulation never reads
// this. `on` is true only while a WebGL scene is alive and drawn; with it off every screen draws exactly as before (the flat 2D art is
// the fallback for no WebGL, a lost context, ?flat=1 and the headless tests).
export const v3 = {
  on: false,
  fade: 1,        // 0..1 right after the 3D scene takes over: the flat art fades out on top of it (crossfade)
  pit: null,      // (p, r, lift) -> { x, y, k } pit (p, r) projected to virtual screen units; k = local scale vs the flat board
  at: null,       // (lx, ly, lift) -> { x, y, k } a group-space point of the flat layout projected the same way
  pick: null,     // (p, x, y) -> ring index of player p's pit under a virtual-unit point, or -1
  hero: null,     // title: { x, y, w, h } (virtual units) where the 3D board goes; null = environment view
  marks: [],      // rings the 2D layer asked for this frame: { p, r, rgb, a }
};
// Alpha for the flat board/backdrop layers: 1 without 3D, fading to 0 during the crossfade, then 0.
export const flatAlpha = () => (v3.on ? Math.max(0, 1 - v3.fade) : 1);
