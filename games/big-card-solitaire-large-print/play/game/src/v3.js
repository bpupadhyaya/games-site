// Hand-off between the 2D screens (view.js) and the optional 3D presenter (view3d/presenter.js). The simulation never reads this.
// `on` is true only while a WebGL scene is alive. With it off every screen draws exactly as before: the flat 2D art is the fallback
// (no WebGL, a lost context, ?flat=1). The presenter reads `cards` once per frame; positions are in screen units (short side = 720).
export const v3 = {
  on: false,
  table: 2,         // index into art.js TABLES: the velvet colour
  four: false,      // four-colour deck
  theme: null,      // card-back theme (art.js THEMES entry)
  emblem: null,     // { cx, cy, k } the gilt ring on the table while a hand is in play, or null
  cards: [],        // in paint order (later = on top): { cx, cy, w, h, rot, flip, elev, card (null = back) } centre in screen units, flip 0..1 (1 = settled)
};
