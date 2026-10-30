// Hand-off between the 2D screens (view.js, layout.js) and the optional 3D presenter (view3d/presenter.js).
// The simulation never reads this. `on` is true only while a WebGL scene is alive and drawn; with it off every screen draws
// exactly as before (the flat 2D art is the fallback for no WebGL, a lost context, ?flat=1 and the headless tests).
export const v3 = {
  on: false,
  fade: 1,          // 0..1 right after the 3D scene takes over: the flat art fades out on top of it (crossfade)
  pick: null,       // (x, y, size) -> cell index or -1 under a virtual-unit point (the tilted 3D board)
  pt: null,         // (size, index, lift) -> { x, y, s } projected cell centre in virtual units; s = projected cell width
  tray: false,      // the 3D crown cushion is shown (tall portrait): the 2D tally then shows only its label
};
// Scenes the 3D layer paints the background (table) for. Everything else keeps the flat backdrop.
export const covers = (scene) => v3.on && (scene === 'title' || scene === 'playing' || scene === 'auto' || scene === 'solved');
// Alpha for the flat 2D art (backdrop, board, crowns): 1 without 3D, fading to 0 during the crossfade, then 0.
export const flatAlpha = (scene) => (covers(scene) ? Math.max(0, 1 - v3.fade) : 1);
