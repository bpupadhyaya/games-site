// Shared flag + registration lists between the flat 2D UI and the 3D presenter (view3d/presenter.js).
// With v3.on the 2D layer draws only text and icons: panels, plaques and buttons are registered here and the presenter draws them
// as lit 3D slabs behind the transparent canvas. With v3.on = false (no WebGL / context lost) the 2D art draws everything itself.
export const v3 = {
  on: false,
  scene: '',
  panels: [],        // { r, rad, kind, hdr? }
  buttons: [],       // { r, primary, on, dim, ... }
  scrim: 0,
  layer: 0,          // overlays (pause card) bump this: items registered later sit above the scrim
  pressed: null,     // { x, y } while a pointer is down (virtual units)
  cells: null,       // projected plate moulds for the live play scene: [{ cx, cy, r, c }]
  cellsFor: '',      // `${cols}x${rows}` the cells belong to
  ky: 0.8,           // vertical foreshortening of the pan plane on screen (flat overlays such as the cook ring use it)
  heroRect: null,    // title / result 3D hero target rect (virtual units)
  trays: [],         // warm-tray slots to fill with 3D served balls: { x, y, r, fil }
  boat: null,        // result screen boat: { rect, n }
  custs: [],         // customer busts for the ticket cards: { r, id, st, f, pat }
  events: [],        // game -> presenter one-way event log (never read by the sim)
  evSeq: 0,
  sy: 0, clip: null, // current scroll offset / clip rect while the 2D layer draws a scrolling body (panels follow and are clipped)
};
// Register a panel/button rect in screen space: inside a scrolling body the content offset is applied and the clip rect recorded.
export const place = (r) => (v3.clip ? { x: r.x, y: r.y - v3.sy, w: r.w, h: r.h } : r);
export const emit3 = (e) => { v3.events.push({ id: ++v3.evSeq, ...e }); if (v3.events.length > 80) v3.events.shift(); };
