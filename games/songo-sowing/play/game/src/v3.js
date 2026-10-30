// Hand-off between the 2D screens (view.js, layout.js) and the optional 3D presenter (view3d/presenter.js). The simulation never reads this.
// `on` is true only while a WebGL scene is alive and drawn; with it off every screen draws exactly as before (the flat 2D art is the
// fallback for no WebGL, a lost context and the headless tests). The 2D layer describes what is on the board each frame (v3.scene); the
// presenter draws it lit, and answers projection questions so counts, rings and taps line up with the tilted board.
export const v3 = {
  on: false,
  fade: 1,        // 0..1 right after the 3D scene takes over: the flat art fades out on top of it (crossfade)
  frame: null,    // (rect, kind, t, geo) -> fits the 3D camera to rect {x,y,w,h} (virtual units); kind 'play' | 'hero'
  at: null,       // (canonX, canonY, lift) -> { x, y, k } a board-canvas point projected to virtual screen units
  toBoard: null,  // (vx, vy) -> [canonX, canonY] under a virtual-unit point (on the playing surface), or null
  scene: null,    // this frame's board: { pits, store, set, wood, geo, marks, carry, cap, land, t }
};
// Alpha for the flat table and board layers: 1 without 3D, fading to 0 during the crossfade, then 0.
export const flatAlpha = () => (v3.on ? Math.max(0, 1 - v3.fade) : 1);
