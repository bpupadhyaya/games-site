// Shared 3D-presentation state. The sim never imports this; the 2D layer (art/view/game picking) and the 3D presenter do.
// While v3.on is false (no WebGL, context lost, ?flat=1, node tests) every helper falls back to the flat layout geometry.
export const v3 = {
  on: false,
  geo: null,          // the board geometry the camera is currently fitted to
  proj: null,         // (ix, iy, h) -> { x, y } virtual units for lattice point (ix, iy) at world height h above the water
  unit: null,         // () -> virtual units per lattice cell (horizontal), at the board centre
  setBoard: null,     // (geo, kind) -> fits the camera to geo.rect; registered by the presenter
  look: 'lagoon',
  hit: null,          // the screen rectangle the 3D board covers (taps start there)
  fit: null,          // (geo|null, kind, opts) -> fits the camera before the 2D layer asks for projections
  frame: null,        // the board snapshot view.js records each frame for the presenter: { P, st, o }
};
const live = (geo) => v3.on && v3.proj && geo && geo === v3.geo;
// Lattice point -> virtual (screen) coordinates, h = height above the water in cells.
export const pt = (geo, ix, iy, h = 0) => (live(geo) ? v3.proj(ix, iy, h) : { x: geo.cx(ix), y: geo.cy(iy) });
// Virtual units per cell (horizontal direction) for hit-testing and glyph sizes.
export const cellPx = (geo) => (live(geo) && v3.unit ? v3.unit() : geo.s);
export const is3d = (geo) => !!live(geo);
// World heights shared by the presenter and the 2D number labels (cells; the water surface is y = 0).
export const PLAQUE_Y = 0.215, DECK_Y = 0.17;
export const boardRect = (geo) => (live(geo) && v3.hit ? v3.hit : geo.rect);
