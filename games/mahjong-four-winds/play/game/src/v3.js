// Hand-off between the 2D screens (view.js) and the optional 3D presenter (view3d/presenter.js). The simulation never reads this.
// `on` is true only while a WebGL scene is alive and drawn; with it off every screen draws exactly as before (the flat 2D art is the
// fallback for no WebGL, a lost context, ?flat=1 and the headless tests). Tiles are handed over in the 2D layer's virtual units.
export const v3 = {
  on: false,
  mode: 'env',   // 'play' while the table is on screen this frame, else 'env' (menus: the empty table behind the panels)
  tiles: [],     // { id, kind, x, y, w, rot, f, lift, wall, level, hand, glow, sel, z } filled by view.js renderTiles each frame
  hub: null,     // { canvas, cx, cy, s, key } the centre plaque, drawn by the 2D code into an offscreen canvas
};
