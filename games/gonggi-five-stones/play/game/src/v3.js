// Hand-off between the 2D screens and the optional 3D presenter (view3d/presenter.js). The simulation never reads this.
// `on` is true only while a WebGL scene is alive and drawn; with it off every screen draws exactly as before (the flat 2D art is the
// fallback for no WebGL, a lost context, ?flat=1 and the headless tests).
// While it is on, view.js draws the world's marks (routes, rings, trail, glows, the home mark, dust) into the presenter's overlay canvas
// `ov` in WORLD units (it lies flat on the cloth in 3D), and records the pebbles and the palm in `rec` instead of painting them;
// `want` tells the presenter what to show and where. `pick` maps a screen point (virtual units) to world units on the cloth, and
// `proj` maps a world point (x, y on the cloth, z height in world units) back to the screen, both set by the presenter.
export const v3 = {
  on: false,
  fade: 1,      // 0..1 right after the 3D scene takes over: the flat art fades out on top of it (crossfade)
  want: null,   // { kind: 'play'|'hero'|'bare', rect (virtual units), stones, hands, key }
  ov: null,     // { canvas, ctx, pad, k }: overlay canvas covering world (-pad .. w + pad) x (-pad .. h + pad) at k px per unit
  pick: null,   // (x, y) => { x, y } | null
  proj: null,   // (x, y, z) => { x, y } | null
};
// Alpha for the flat 2D mat / floor / pebbles: 1 without 3D, fading to 0 during the crossfade, then 0.
export const flatAlpha = () => (v3.on ? Math.max(0, 1 - v3.fade) : 1);

// The recorder art.js consults while a 3D frame is being drawn into the overlay.
export const rec = { on: false, stones: [], hands: [], marks: [] };
export function recBegin() { rec.on = true; rec.stones = []; rec.hands = []; rec.marks = []; }
export function recEnd() { rec.on = false; return { stones: rec.stones, hands: rec.hands, marks: rec.marks }; }
