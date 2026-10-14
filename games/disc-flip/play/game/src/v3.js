// Shared hand-off between the 2D UI (view.js, menus.js) and the optional 3D presenter (view3d/presenter.js).
// The simulation never reads this. `on` is flipped by the presenter only while a WebGL context is alive; with it off every
// screen draws exactly as before (the flat 2D fallback).
export const v3 = {
  on: false,
  sq: null,        // (wx, wy) -> { x, y } projected mat point in virtual units
  pick: null,      // (x, y) -> { x, y } world point under a screen point (felt plane)
  scene: 'title',
};

// Canvas factory (set by main.js: src/ stays free of DOM globals).
export const gfx = { mk: null };
