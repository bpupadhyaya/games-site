// Hand-off between the 2D screens (view.js, playview.js) and the optional 3D presenter (view3d/presenter.js). The simulation never
// reads this. `on` is true only while a WebGL scene is alive and drawn; with it off every screen draws the flat 2D art exactly as
// before (no WebGL, ?flat=1, a lost context, the headless tests). Positions are in the 2D layer's virtual screen units: the presenter
// uses an orthographic camera tilted so a drum head projects to exactly the ellipse the 2D layer hit-tests and draws its fx on.
export const v3 = {
  on: false,
  fade: 1,          // 0..1 right after the 3D scene takes over: the flat art fades out on top of it (crossfade)
  mode: 'env',      // 'play' | 'title' | 'env' (menus and documents: just the festival night)
  floorTop: 0,      // virtual y where the floor meets the curtain wall
  pulse: 0,         // the beat, 0..1
  drums: [],        // { kind, cx, cy, rx, flash, zone, dim, sticks: [{ lift, glow }], hero }
  t: 0,
};
export const flatAlpha = () => (v3.on ? Math.max(0, 1 - v3.fade) : 1);
