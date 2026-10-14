// Shared hand-off between the 2D UI (view.js, menus.js, ui.js, art.js) and the optional 3D presenter (view3d/presenter.js).
// The simulation never reads this. `on` is flipped by the presenter only while a WebGL context is alive; with it off every
// screen draws exactly as before (the flat 2D fallback). The 2D layer reports panels/buttons here; the presenter turns them
// into lit 3D plaques behind the text and draws the floor, the discs, the hands and the aim markers itself.
export const v3 = {
  on: false,
  panels: [],          // { r, rad, kind }  kind: 'paper' | 'dark' | 'plate' | 'plateOn' | 'felt' | 'chip' | 'chipOn'
  buttons: [],         // { r, rad, kind, pressed }   kind: 'primary' | 'active' | 'dark' | 'plain' | 'disabled'
  scrim: 0,            // 0..1 full-screen dimming drawn in 3D under the plaques
  scene: 'title',
  pressed: null,       // { x, y } while the pointer is down
  proj: null,          // (fx, fy, lift?) -> { x, y } floor point (0..640) projected to virtual screen units
  toFloor: null,       // (x, y) -> { x, y } virtual screen point to floor units (ray vs the floor plane), or null
  scale: null,         // (fx, fy) -> pixels (virtual units) per floor unit at that point
  sprites: null,       // (design, side) -> canvas of a lit 3D disc, or null while not ready
  titleRect: null,     // title screen: the rectangle the lettering uses
};
