// Hand-off between the 2D screens (view.js, screens.js, art.js) and the optional 3D presenter (view3d/presenter.js).
// The simulation never reads this. `on` is true only while a WebGL scene is alive and drawn; with it off every screen draws exactly
// as before (the flat 2D art is the fallback for no WebGL, a lost context, ?flat=1 and the headless tests).
export const v3 = {
  on: false,
  fade: 1,             // 0..1 right after the 3D scene takes over: the flat art fades out on top of it (crossfade)
  pt: null,            // (n, idx, lift) -> { x, y, k, fy } projected crossing in virtual units; k = local scale vs the 2D cell, fy = foreshortening
  pick: null,          // (n, x, y, slack) -> crossing index or -1 under a virtual-unit point (the tilted 3D board)
  cell: 0,             // mean projected cell size (virtual units) of the play board, for rings and the lens
  hero: null,          // title / document screens: { x, y, w, h } where the 3D showcase board goes (null = no hero)
  heroT: 0,            // showcase clock (seconds), shared with the flat showcase timing
  scene: 'title',
};
// Alpha for the flat 2D art layers (table, board, stones): 1 without 3D, fading to 0 during the crossfade, then 0.
export const flatAlpha = () => (v3.on ? Math.max(0, 1 - v3.fade) : 1);
