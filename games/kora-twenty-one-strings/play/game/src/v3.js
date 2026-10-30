// Hand-off between the 2D screens and the optional 3D presenter (view3d/presenter.js). The simulation never reads this.
// `on` is true only while a WebGL scene is alive and drawn; with it off every screen draws exactly as before (the flat 2D art is the
// fallback for no WebGL, a lost context, ?flat=1 and the headless tests). Calibration always stays flat.
export const v3 = {
  on: false,
  scene: '',    // the screen being drawn (main.js sets it before each render)
  fade: 1,      // 0..1 right after the 3D scene takes over: the flat art fades out on top of it (crossfade)
};
export const use3d = (scene) => v3.on && scene !== 'calib';
// Alpha for the flat backdrop / instrument layers on this screen: 1 without 3D, fading to 0 during the crossfade, then 0.
export const flatAlpha = (scene) => (use3d(scene) ? Math.max(0, 1 - v3.fade) : 1);
// Additive glows ('lighter') on a TRANSPARENT canvas over the 3D scene add alpha too and burn to opaque white blobs; over 3D the glows
// are painted normally instead (their soft gradients read the same against the lit scene).
export const glowOp = () => (v3.on && v3.scene !== 'calib' ? 'source-over' : 'lighter');
