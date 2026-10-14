// Shared hand-off between the 2D UI (view.js, art.js) and the optional 3D presenter (view3d/presenter.js).
// The simulation never reads this. `on` is flipped by the presenter only while a WebGL context is alive; with it off every
// screen draws exactly as before (the flat 2D fallback). While on, the drawing helpers in art.js RECORD the ladder, hanger bar,
// lanterns, bowls and trails here (virtual units) instead of painting them; the presenter turns them into lit 3D objects behind
// the transparent canvas, and the 2D layer paints only labels, plaques and text.
export const v3 = {
  on: false,
  w: 720, h: 1280, t: 0, calm: false, scene: 'title',
  ladders: [],   // { geo, cells, slots, hl, cursor, popped, dimLines, mark, lineAlpha }
  bars: [],      // { geo }
  lanterns: [],  // { x, y, r, color, label, state, glow, sway, scale }
  bowls: [],     // { x, y, r, color, label, state, pulse }
  trails: [],    // { pts, upTo, color, width, alpha }
  reset() { this.ladders.length = 0; this.bars.length = 0; this.lanterns.length = 0; this.bowls.length = 0; this.trails.length = 0; },
};
// Documentation figures draw small ladders inside text panels: they always stay 2D.
export const rec = { off: 0 };
export const recording = () => v3.on && !rec.off;
