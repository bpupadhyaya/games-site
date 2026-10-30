// Hand-off between the 2D screens (view.js) and the optional 3D presenter (view3d/presenter.js). The simulation never reads this.
// `on` is true only while a WebGL scene is alive and drawn; with it off every screen draws exactly as before (the flat 2D art is the
// fallback for no WebGL, a lost context, ?flat=1 and the headless tests).
export const v3 = {
  on: false,
  fade: 1,        // 0..1 right after the 3D scene takes over: the flat art fades out on top of it (crossfade)
  pt: null,       // (square, lift cm) -> { x, y, k } projected square centre in virtual units; k = projected cell width / 2D cell width
  pick: null,     // (x, y) -> square index under a virtual-unit point on the tilted 3D board, or -1
  ground: null,   // (x, y) -> { x, z } board-plane point under a virtual-unit point (a dragged piece follows the finger)
  hero: null,     // title / document screens: { x, y, w, h } where the 3D board goes (null = no hero)
};
// Alpha for the flat 2D art layers (table, board, pieces): 1 without 3D, fading to 0 during the crossfade, then 0.
export const flatAlpha = () => (v3.on ? Math.max(0, 1 - v3.fade) : 1);
// Square under a point: through the 3D board when it is on, else the flat layout.
export const squareAt = (L, x, y) => (v3.on && v3.pick ? v3.pick(x, y) : L.squareAt(x, y));
