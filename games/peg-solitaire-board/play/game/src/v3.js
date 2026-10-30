// Hand-off between the 2D screens (view.js) and the optional 3D presenter (view3d/presenter.js). The simulation never reads this.
// `on` is true only while a WebGL scene is alive. With it off every screen draws exactly as before: the flat 2D art is the fallback
// (no WebGL, a lost context, ?flat=1). The presenter reads `pose`/`pegs` once per frame; positions are in screen units (short side = 720).
export const v3 = {
  on: false,
  pose: null,       // { b, cx, cy, P, wood, set, calm }: the board on screen (hole pitch P) this frame, or null (table only)
  pegs: [],         // { x, y, s, lift, alpha } marbles to draw this frame (screen units, x/y where the 2D art would draw them)
  wood: 'maple',
  set: 'sapphire',
};
