// Hand-off between the 2D screens (view.js, layout.js) and the optional 3D presenter (view3d/presenter.js). The simulation never reads
// this. `on` is true only while a WebGL scene is alive and drawn; with it off every screen draws exactly as before (the flat 2D art is
// the fallback for no WebGL, a lost context, ?flat=1 and the headless tests).
export const v3 = {
  on: false,
  fade: 1,          // 0..1 right after the 3D scene takes over: the flat art fades out on top of it (crossfade)
  pt: null,         // (cx, cy, liftCm) -> { x, y, s }: a canonical board point projected to virtual units; s = virtual units per canonical unit there
  unproject: null,  // (vx, vy) -> { x, y } canonical board point under a virtual-unit point (on the playing face), or null
  hero: null,       // title: { x, y, w, h } (virtual units) where the 3D board goes; null = environment view
  marks: [],        // glows the 2D layer asked for this frame: { pit, rgb, a }
};
// Alpha for the flat board/backdrop layers: 1 without 3D, fading to 0 during the crossfade, then 0.
export const flatAlpha = () => (v3.on ? Math.max(0, 1 - v3.fade) : 1);
