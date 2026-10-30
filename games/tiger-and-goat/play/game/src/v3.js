// Hand-off between the 2D screens (view.js, layout.js) and the optional 3D presenter (view3d/presenter.js). The simulation never reads
// this. `on` is true only while a WebGL scene is alive and drawn; with it off every screen draws exactly as before (the flat 2D art is
// the fallback for no WebGL, a lost context and the headless tests).
export const v3 = {
  on: false,
  fade: 1,        // 0..1 right after the 3D scene takes over: the flat art fades out on top of it (crossfade)
  pts: null,      // play screens: the 25 board points as the live 3D camera projects them: [{ x, y, s }] in virtual units; null otherwise
  d: 60,          // play screens: spacing between neighbouring points in virtual units (hit radius)
  pieces: [],     // what the 2D layer asks the scene to draw this frame: { k: 'T'|'G', gx, gy, lift, sel, a, dim, threat }
  marks: [],      // glows on the board: { gx, gy, col: 'move'|'jump'|'hint'|'cursor'|'danger', a }
};
// Alpha for the flat table / board layers: 1 without 3D, fading to 0 during the crossfade, then 0.
export const flatAlpha = () => (v3.on ? Math.max(0, 1 - v3.fade) : 1);
