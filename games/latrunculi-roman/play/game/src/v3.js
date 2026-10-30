// Hand-off between the 2D screens (view.js, game.js) and the optional 3D presenter (view3d/presenter.js). The simulation never reads
// this. `on` is true only while a WebGL scene is alive and drawn; with it off every screen draws exactly as before (the flat 2D art is
// the fallback for no WebGL, a lost context, ?flat=1 and the headless tests).
export const v3 = {
  on: false,
  fade: 1,        // 0..1 right after the 3D scene takes over: the flat art fades out on top of it (crossfade)
  frame: null,    // what the 2D layer is showing this frame: { kind: 'board' | 'title' | 'env', ... } (set by view.js every render)
  marks: [],      // board marks the 2D layer asked for this frame: { i, type: 'fill'|'ring'|'dot'|'cross'|'circle'|'glow', rgb, a, grow }
  arrows: [],     // { from, to, rgb, a }
  pick: null,     // (x, y) -> square index or -1 under a virtual-unit point (the tilted 3D board)
};
// Alpha for the flat board / backdrop layers: 1 without 3D, fading to 0 during the crossfade, then 0.
export const flatAlpha = () => (v3.on ? Math.max(0, 1 - v3.fade) : 1);
