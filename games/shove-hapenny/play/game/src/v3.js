// Shared hand-off between the 2D UI (view.js, menus.js, ui.js, art.js) and the optional 3D presenter (view3d/presenter.js).
// The simulation never reads this. `on` is flipped by the presenter only while a WebGL context is alive; with it off every
// screen draws exactly as before (the 2D fallback). While on, the 2D layer draws only text, icons and aim overlays and reports
// panels / buttons here; the presenter turns them into lit carved-wood plaques and lacquered buttons behind the text.
export const v3 = {
  on: false,
  panels: [],          // { r, rad, kind }  kind: card | cardOn | paper | dark
  buttons: [],         // { r, rad, k, pressed }  k: plain | primary | active | dark | disabled
  scrim: 0,            // 0..1 full-screen dimming drawn in 3D under the plaques
  project: null,       // (wx, wy, lift) -> { x, y } virtual units, board world coordinates to the screen (perspective)
  toWorld: null,       // (sx, sy) -> { x, y } board world coordinates under a screen point (perspective ray on the slate)
  coinSprite: [null, null],   // baked renders of the 3D coins (canvas), used by the 2D icons and illustrations
  scene: null,         // the scene object the 2D layer handed to drawScene this frame (board contents)
  pressed: null,
  time: 0,
};
