// Shared hand-off between the 2D art/HUD (this folder) and the optional WebGL presenter (view3d/presenter.js). The simulation never
// reads it. `on` is true only while a WebGL context is alive and the 3D world has been built; with it off every screen draws the
// flat 2D art exactly as before (the fallback). `fade` crossfades the 2D world out when 3D comes in (0..1).
export const v3 = {
  on: false,
  fade: 0,
  proj: null,        // (s, y) in sea metres -> { x, y } in virtual px through the live 3D camera, or null
  hero: null,        // title screen: { x, y, w, h } where the showcase crews go
  scene: '',         // 'title' | 'play' | ...
};
