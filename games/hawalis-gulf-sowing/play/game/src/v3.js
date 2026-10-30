// Hand-off between the 2D screens (view.js, art.js) and the optional 3D presenter (view3d/presenter.js). The simulation never reads
// this. `on` is true only while a WebGL scene is alive and drawn; with it off every screen draws exactly as before (the flat 2D art is
// the fallback for no WebGL, a lost context, ?flat=1 and the headless tests).
export const v3 = {
  on: false,
  fade: 1,        // 0..1 right after the 3D scene takes over: the flat art fades out on top of it (crossfade)
  S: null,        // the game's drawing state (set by game.js; read-only for the presenter)
  pt: null,       // (lx, ly, lift) -> { x, y, k } a flat-board point (board units) projected to virtual units; k = local scale vs the flat board
  toLocal: null,  // (vx, vy) -> [lx, ly] the board-unit point under a virtual-unit point (ray onto the board top), or null
  marks: [],      // light the 2D layer asked for this frame: { cell, rgb: [r,g,b] 0..1, a, kind: 'ring'|'fill', grow }
  hero: null,     // title: { x, y, w, h } (virtual units) where the 3D board goes
};
// Alpha for the flat board/backdrop layers: 1 without 3D, fading to 0 during the crossfade, then 0.
export const flatAlpha = () => (v3.on ? Math.max(0, 1 - v3.fade) : 1);
// True when the 3D presenter draws the board (the 2D layer then draws only HUD, labels and projected marks).
export const board3d = () => v3.on && !!v3.pt;
