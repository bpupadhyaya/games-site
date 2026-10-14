// Shared 3D-presentation state. The sim never imports this; the 2D layer (view/ui/layout) and the 3D presenter do.
// While v3.on is false (no WebGL, context lost, ?flat=1, node tests) every helper falls back to the flat layout geometry.
export const v3 = {
  on: false,
  geo: null,          // the room geometry (layout.roomGeo) the camera is currently fitted to
  proj: null,         // (gx, gy, h) -> { x, y } virtual units for grid point (gx, gy) in cell units (0..cols, 0..rows) at world height h
  unproj: null,       // (x, y) virtual units -> { gx, gy } grid point on the mat plane, or null
  unit: null,         // () -> virtual units per cell at the room centre
  fit: null,          // (geo|null, kind, opts) -> fits the camera; registered by the presenter
  frame: null,        // the room snapshot view.js records each frame for the presenter: { B, ... }
  look: 'spring',
  hit: null,
};
export const live = (geo) => !!(v3.on && v3.proj && geo && geo === v3.geo);
// Grid point (cell units) -> virtual screen coords. Flat fallback: the layout rectangle.
export const gridPt = (geo, gx, gy, h = 0) => (live(geo) ? v3.proj(gx, gy, h) : { x: geo.x + gx * geo.s, y: geo.y + gy * geo.s });
export const cellPx = (geo) => (live(geo) && v3.unit ? v3.unit() : geo.s);
export const is3d = (geo) => live(geo);
