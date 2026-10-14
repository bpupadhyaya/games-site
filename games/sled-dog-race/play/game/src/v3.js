// Hand-off between the 2D screens (scene.js / hud.js / menus.js) and the optional 3D presenter (view3d/presenter.js).
// The simulation never reads this. `on` is flipped by the presenter only while a WebGL context is alive; with it off every screen
// draws exactly as before (the flat 2D fallback). While it is on, drawScene() publishes what the trail picture needs in `frame`
// and paints nothing, and the presenter draws the lit 3D trail behind the transparent 2D canvas (HUD, menus, text, input).
export const v3 = {
  on: false,
  hero: null,       // title screen: { cx, cy, w, h } the clear band for the 3D hero, in virtual units (set by menus.renderTitle)
  frame: null,      // { cam, info, ax, gy } published by drawScene each frame
};
