// Hand-off between the 2D screens (view.js, game.js) and the optional 3D presenter (view3d/presenter.js). The simulation never reads
// this. `on` is true only while a WebGL scene is alive and drawn; with it off every screen draws exactly as before (the flat 2D art is
// the fallback for no WebGL, a lost context, ?flat=1 and the headless tests).
export const v3 = {
  on: false,
  fade: 1,          // 0..1 right after the 3D scene takes over: the flat art fades out on top of it (crossfade)
  toBoard: null,    // (x, y) virtual screen units -> BOARD space point under it (ray onto the tilted 3D board), or null
  toScreen: null,   // (bx, by, lift) BOARD space -> virtual screen point { x, y } through the 3D camera
  hero: null,       // title / documents: { x, y, w, h } (virtual units) where the 3D hero view goes; null = whole screen
  rec: null,        // what view.js asked the 3D layer to draw this frame (board scenes): see view.js `record3d`
  tray: null,       // dice tray of this frame: { rect, dice: [{ x, y }], size } in virtual units, or null
};
// Alpha for the flat board/backdrop layers: 1 without 3D, fading to 0 during the crossfade, then 0.
export const flatAlpha = () => (v3.on ? Math.max(0, 1 - v3.fade) : 1);
