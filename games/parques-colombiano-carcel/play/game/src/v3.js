// Hand-off between the 2D screens (view.js, game.js) and the optional 3D presenter (view3d/presenter.js). The simulation never reads
// this. `on` is true only while a WebGL scene is alive and drawn; with it off every screen draws exactly as before (the flat 2D art is
// the fallback for no WebGL, a lost context, ?flat=1 and the headless tests).
// Board space = the flat layout's own coordinates (BOARD.cx/cy, CS per square). The 3D board lies on the same grid, so 2D positions of
// pieces, dice and rings are simply handed over each frame (lists below, cleared by the presenter) and drawn in 3D.
export const v3 = {
  on: false,
  fade: 1,        // 0..1 right after the 3D scene takes over: the flat board fades out underneath (crossfade)
  items: [],      // pieces this frame: { arm, x, y, k, lift, alpha } (board space, lift in 2D units, k = size vs normal)
  dice: [],       // dice this frame: { x, y (screen units, tray), rot, face, z, used, glow, u, rolling, id }
  marks: [],      // light on the board: { k: 'ring'|'glow'|'burst', x, y, cap, sel, a, f } (board space)
  jails: [0, 0, 0, 0].map(() => ({ turn: false, flash: 0, active: false })),
  proj: null,     // (bx, by, lift) -> { x, y } board-space point (+ lift) projected to virtual screen units
  toBoard: null,  // (vx, vy) -> { x, y } virtual screen point -> board space (ray to the board plane)
};
