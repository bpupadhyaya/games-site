// Hand-off between the 2D screens and the optional 3D presenter (view3d/presenter.js). The simulation never reads this.
// `on` is true only while a WebGL scene is alive and drawn; with it off every screen draws exactly as before (the flat 2D art is the
// fallback for no WebGL, a lost context, ?flat=1 and the headless tests).
export const v3 = {
  on: false,
  fade: 1,          // 0..1 right after the 3D scene takes over: the flat art fades out on top of it (crossfade)
  bu: null, ss: null, // bridge positions and per-string view state of the current frame (written by playview)
  hero: null,       // title only: the rectangle (layout units) the 3D hero koto should fill
  tsume: null,      // the teacher's pick on the play screens, written by playview each frame: { x, y, sf, down, glow } (layout units) or null
};
// Alpha for the flat instrument/backdrop layers: 1 without 3D, fading to 0 during the crossfade, then 0.
export const flatAlpha = () => (v3.on ? Math.max(0, 1 - v3.fade) : 1);
