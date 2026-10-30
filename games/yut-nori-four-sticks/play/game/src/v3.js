// Hand-off between the 2D screens (view.js, game.js) and the optional 3D presenter (view3d/presenter.js). The simulation never reads
// this. `on` is true only while a WebGL scene is alive and drawn; with it off every screen draws exactly as before (the flat 2D art is
// the fallback for no WebGL, a lost context, ?flat=1 and the headless tests).
export const v3 = {
  on: false,
  fade: 1,        // 0..1 right after the 3D scene takes over: the flat art fades out on top of it (crossfade)
  proj: null,     // (lx, ly, h) -> { x, y } a board-local point (layout.js LOCAL space), h cm above the cloth, projected to virtual units
  pick: null,     // (vx, vy) -> { x, y } board-local point under a virtual-unit screen point (the tilted 3D board), or null
  marks: [],      // rings the 2D layer asked for this frame: { x, y (board-local), rgb, r (local radius), a }
};
// Alpha for the flat board/backdrop layers: 1 without 3D, fading to 0 during the crossfade, then 0.
export const flatAlpha = () => (v3.on ? Math.max(0, 1 - v3.fade) : 1);
