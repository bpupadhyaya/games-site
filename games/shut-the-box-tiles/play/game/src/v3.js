// Hand-off between the 2D screens (view.js, game.js) and the optional 3D presenter (view3d/presenter.js). The simulation never reads this
// except for tap rectangles. `on` is true only while a WebGL scene is alive and drawn; with it off every screen draws the flat 2D art
// (the fallback for no WebGL, a lost context and the headless tests).
export const v3 = {
  on: false,
  fade: 1,        // 0..1 right after the 3D scene takes over: the flat art fades out on top of it
  tiles: null,    // play screen: the projected tap rectangle of each tile in virtual units (index k-1), from the live 3D camera; null otherwise
  play: null,     // what the 2D layer asks the scene to show this frame: { n, cols, rows, tiles: [{ flip, lift, glow, dim, dx }], dice: [...], rect }
  hero: null,     // title: { f: [flip per tile], rect } for the hero box
};
// Alpha for the flat art layers: 1 without 3D, fading to 0 during the crossfade, then 0.
export const flatAlpha = () => (v3.on ? Math.max(0, 1 - v3.fade) : 1);
