// Shared hand-off between the 2D layer (ui.js, weights.js, view.js) and the optional 3D presenter (view3d/presenter.js).
// The simulation never reads this. `on` is true only while a WebGL context is alive; with it false every screen draws exactly as
// before (the flat 2D fallback). While on, the 2D layer RECORDS plaques, buttons, weights and balances here instead of painting them,
// and draws only text and icons; the presenter turns the records into a lit 3D scene behind the transparent kit canvas.
export const v3 = {
  on: false,
  panels: [],      // { r, rad, kind, clip, flash, dim }
  buttons: [],     // { r, rad, accent, active, disabled, flash, clip }
  items: [],       // { k: 'w'|'bag', v, x, y, s, lift, glow, dim, fill, clip, z }
  balances: [],    // { G, m, table, clip }
  clip: null,      // current scroll-body clip rect while a scrolling body is being drawn
  scrim: 0,
  scrimAt: null,   // { p, b }: plaques and buttons recorded after this point sit above the scrim
  pressed: null,
  scene: 'title',
  reset() { this.panels.length = 0; this.buttons.length = 0; this.items.length = 0; this.balances.length = 0; this.scrim = 0; this.scrimAt = null; this.clip = null; },
};
