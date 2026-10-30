// Presentation hand-off to the optional lit scene that main.js may put behind the 2D canvas. Presentation only: the sim and
// the game rules never read this object. drawTable (view.js) publishes where and how it drew the table each frame; main.js
// sets `on` / `alpha` while the scene is ready (alpha 0..1 crossfades the baked 2D table out).
export const v3 = {
  on: false,      // the lit scene is ready and visible behind the 2D canvas
  alpha: 0,       // 0 = only the 2D table, 1 = only the lit scene (2D overlays still drawn)
  drawn: false,   // a table was drawn in the current frame
  table: null,    // { w, cx, cy, sc, lock, hand, active, t }
};
