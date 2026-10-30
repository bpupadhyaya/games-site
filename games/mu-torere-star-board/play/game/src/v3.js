// Hand-off between the 2D screens (view.js, layout.js) and the optional 3D presenter (view3d/presenter.js). The simulation never reads
// this for its rules. `on` is true only while a WebGL scene is alive and drawn; with it off every screen draws exactly as before (the flat
// 2D art is the fallback for no WebGL, a lost context, ?flat=1 and the headless tests).
export const v3 = {
  on: false,
  fade: 1,        // 0..1 right after the 3D scene takes over: the flat art fades out on top of it (crossfade)
  pt: null,       // (i, lift) -> { x, y, k } board point i projected to virtual units; k = local scale vs the flat board
  pick: null,     // (x, y) -> board point under a virtual-unit point, or -1 (the tilted 3D board)
  hero: null,     // title: { x, y, w, h } (virtual units) where the 3D star goes
  marks: [],      // rings the 2D layer asked for this frame: { sq, rgb, r, a } (r in stone radii)
};
// Alpha for the flat board/backdrop layers: 1 without 3D, fading to 0 during the crossfade, then 0.
export const flatAlpha = () => (v3.on ? Math.max(0, 1 - v3.fade) : 1);
