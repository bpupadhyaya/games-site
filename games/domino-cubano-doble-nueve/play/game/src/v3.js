// Hand-off between the 2D screens (view.js) and the optional 3D presenter (view3d/presenter.js). The simulation never reads this.
// `on` is true only while a WebGL scene is alive and drawn; with it off every screen draws exactly as before (the flat 2D art is the
// fallback for no WebGL, a lost context and the headless tests).
//
// The 2D layout plane is laid on the table: every rectangle view.js draws in virtual units has a spot on the tilted 3D table, so
// the presenter draws the dominoes there (v3.tiles) and hands back `proj` / `unproj` to carry points between the two. Taps and drags
// are mapped through `unproj` (main.js) so the 2D hit tests keep working on the tilted view.
export const v3 = {
  on: false,
  fade: 1,         // 0..1 right after the 3D scene takes over: the flat backdrop fades out on top of it
  mode: 'env',     // 'play' (table fitted to the play zone) or 'env' (menus, documents: table under a dusk sky)
  zone: null,      // { x0, y0, x1, y1 } layout rectangle the camera is fitted to
  tiles: [],       // dominoes the 2D layer wants drawn this frame: { key, a, b, x, y, w, h, down, lift, hl, drag, from }
  marks: [],       // glows on the table: { x, y, r, kind: 'turn' | 'hint' }
  proj: null,      // (x, y) layout -> screen, virtual units
  unproj: null,    // (sx, sy) screen -> layout, virtual units (null when the ray misses the table)
};
// Alpha for the flat backdrop: 1 without 3D, fading to 0 during the crossfade, then 0.
export const flatAlpha = () => (v3.on ? Math.max(0, 1 - v3.fade) : 1);
