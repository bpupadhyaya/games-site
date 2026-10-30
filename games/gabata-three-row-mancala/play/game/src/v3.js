// Hand-off between the 2D screens (view.js, game.js) and the optional 3D presenter (view3d/presenter.js). The simulation never reads this.
// `on` is true only while a WebGL scene is alive and drawn; with it off every screen draws exactly as before (the flat 2D art is the
// fallback for no WebGL, a lost context and the headless tests). The 2D layer describes what is on the board each frame (v3.scene); the
// presenter draws it lit, and answers projection questions so counts, arrows and taps line up with the tilted board.
export const v3 = {
  on: false,
  fade: 1,        // 0..1 right after the 3D scene takes over: the flat art fades out on top of it (crossfade)
  live: false,    // true while view.js is drawing a 3D board: ringCell / fillCell record marks instead of drawing flat ones
  frame: null,    // (geo, kind, t) -> fits the 3D camera to the board rectangle geo ({x,y,w,h} virtual units); kind 'play' | 'hero'
  at: null,       // (bx, by, lift) -> { x, y, k } board-unit point projected to virtual screen units; k = virtual units per board unit
  pick: null,     // (vx, vy) -> hole under a virtual-unit point (nearest pit within reach), or -1
  toBoard: null,  // (vx, vy) -> [bx, by] board-unit point under a virtual-unit point (on the playing surface)
  scene: null,    // this frame's board: { cells, flights, hand, theme, t }
  marks: [],      // rings / glows the 2D layer asked for this frame: { i, col, a, lw, grow, fill }
};
// Alpha for the flat board and backdrop layers: 1 without 3D, fading to 0 during the crossfade, then 0.
export const flatAlpha = () => (v3.on ? Math.max(0, 1 - v3.fade) : 1);
