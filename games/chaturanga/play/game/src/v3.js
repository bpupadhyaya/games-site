// Shared hand-off between the 2D UI (view.js, art.js, layout.js) and the optional 3D presenter (view3d/presenter.js).
// The simulation never reads this. `on` is true only while a WebGL context is alive; with it false every screen draws with
// the flat 2D art exactly as before (the fallback), and the 3D layer comes back by itself when the context is restored.
export const v3 = {
  on: false,
  sq: null,        // (squareIndex) -> { x, y } projected centre of that square on the 3D board, in virtual units
  pick: null,      // (x, y) -> square index or -1 (3D board: pieces first, then the board plane)
  pt: null,        // (worldX, worldY, worldZ) -> { x, y } virtual units
  scene: 'title',
};
// 2D sprites of the sculpted pieces (rendered once from the 3D models) for the plates, History tabs, result card and diagrams.
export const sprites = { ready: false, img: {} };
