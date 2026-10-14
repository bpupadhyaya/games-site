// Shared hand-off between the 2D layer (view.js, menus.js, ui.js) and the optional 3D presenter (view3d/presenter.js).
// The simulation never reads this. `on` is flipped by the presenter only while a WebGL context is alive; with it off every screen
// draws exactly as before (the 2D fallback). The 2D layer reports panels and buttons here; the presenter turns them into lit 3D
// plaques and lacquered buttons behind the text, and projects world positions with the perspective camera.
export const v3 = {
  on: false,
  panels: [],          // { r, rad, kind: 'plate' | 'toast' | 'paper' | 'wood' }
  buttons: [],         // { r, rad, kind: 'primary' | 'active' | 'dark' | 'plain' | 'disabled', pressed }
  scrim: 0,            // 0..1 full-screen dimming drawn in 3D under the plaques
  scene: 'title',
  pressed: null,       // { x, y } while the pointer is down
  attract: null,       // menus: { L0 } where the attract table sits (virtual units)
  fitKey: '',          // the play layout key the camera is fitted to; project / unproject are valid for that layout only
  project: null,       // (worldX, worldY, lift?) -> { x, y } virtual units
  unproject: null,     // (virtualX, virtualY) -> { x, y } world units on the table plane
  scale: null,         // (worldX, worldY) -> virtual units per world unit at that point
};
