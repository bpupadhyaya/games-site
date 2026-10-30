// Hand-off between the 2D drawing code (art.js, view.js) and the optional 3D presenter (view3d/presenter.js). The simulation never
// reads this. `on` is true only while a WebGL scene is alive; with it off every screen draws exactly as before (the flat 2D art is the
// fallback for no WebGL, a lost context, ?flat=1 and the headless tests).
// While `cap` is set, drawDie / drawCup / mat in art.js do not paint: they record what they would have drawn (in canvas pixels, read
// from the live canvas transform) and the presenter places a lit 3D die / leather cup / woven cloth exactly there, on a real table.
export const v3 = {
  on: false,
  fade: 1,       // 0..1 right after the 3D scene takes over: the flat backdrop fades out on top of it
  cap: false,    // capture mode for the current drawing block (set and cleared by view.js)
  dice: [],      // { px, py, s, face, yaw, hop, glow, dim, tumble, seed, flip }      (px, py, s in canvas pixels)
  cups: [],      // { px, py, w, h, tilt, lift, alpha }                                (px, py = the cup's mouth centre)
  cloths: [],    // { x, y, w, h, kind: 'mat' | 'tray' }                                (canvas pixels, axis aligned)
  scene: '',     // the 2D scene name of this frame (the presenter picks lighting and dust per scene)
  theme: 'aguayo',
};
// Alpha for the flat backdrop layers: 1 without 3D, fading to 0 during the crossfade, then 0.
export const flatAlpha = () => (v3.on ? Math.max(0, 1 - v3.fade) : 1);
