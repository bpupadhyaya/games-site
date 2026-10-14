// Shared hand-off between the 2D UI (ui.js, hud.js, menus.js, view.js) and the optional 3D presenter (view3d/presenter.js).
// The simulation never reads this. `on` is flipped by the presenter only while a WebGL context is alive; with it off every
// screen draws exactly as before (the 2D fallback). While on, the 2D layer reports panels and buttons here and the presenter
// draws them as lit 3D plaques behind the (still 2D) text.
export const v3 = {
  on: false,
  panels: [],      // { r, rad, kind, accent, clip }
  buttons: [],     // { r, rad, kind, pressed, clip }
  shades: [],      // { key, r, draw(ctx, w, h) } full-colour overlays drawn in 3D under the plaques (scrims, vignettes)
  scrim: 0,
  clip: null,      // current scroll clip rect { x, y, w, h } while a flow list is drawn
  hero: null,      // { x, y, w, h } where a result trophy goes
  scene: 'title',
  frame: 0,
  credits: null,   // { title, p: [...] } 3D licence credits for About (filled by the presenter)
  seq: 0,          // draw order of everything recorded this frame (later = on top)
};
export const shade = (key, r, draw) => { v3.shades.push({ key, r, draw, o: v3.seq++ }); };
