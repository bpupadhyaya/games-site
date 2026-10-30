// Hand-off between the 2D screens (view.js) and the optional 3D presenter (view3d/presenter.js). The simulation never reads this.
// `on` is true only while a WebGL scene is alive and drawn; with it off every screen draws exactly as before (the flat 2D art is the
// fallback for no WebGL, a lost context and the headless tests).
export const v3 = {
  on: false,
  fade: 1,        // 0..1 right after the 3D scene takes over: the flat art fades out on top of it (crossfade)
  bl: null,       // the board layout (ox, oy, s) of the frame being drawn, set by view.js so the presenter can map canonical board space
  at: null,       // (cx, cy, lift) canonical board point -> { x, y, k } in the current board layout's canonical space (k: local scale)
  pick: null,     // (vx, vy) virtual-unit point -> { x, y } canonical board point under it (the tilted 3D board), or null
  marks: [],      // glows / dots the 2D layer asks the 3D scene to draw this frame: { x, y, r, rgb, a, kind } (canonical units)
  hero: null,     // title: { x, y, w, h } virtual rectangle for the 3D hero
};
export const flatAlpha = () => (v3.on ? Math.max(0, 1 - v3.fade) : 1);
