// Hand-off between the 2D screens (view.js) and the optional 3D presenter (view3d/presenter.js). The simulation never reads this.
// `on` is true only while a WebGL scene is alive and drawn; with it off every screen draws exactly as before (the flat 2D art is the
// fallback for no WebGL, a lost context, ?flat=1 and the headless tests). Positions are in the 2D layer's virtual screen units: the
// presenter unprojects them onto the peg plane of its camera, so a disc, a peg and a tap line up exactly with what the 3D scene shows.
export const v3 = {
  on: false,
  fade: 1,        // 0..1 right after the 3D scene takes over: the flat art fades out on top of it (crossfade)
  mode: 'env',    // 'play' | 'title' | 'env' (documents and menus: just the room)
  slab: null,     // { x0, x1, y, h }  base slab: top edge height y, front face thickness ~h
  pegs: [],       // { x, y, len, r, glow }  foot centre y, height, radius
  discs: [],      // { id, x, y, w, sh, sq, glow }  (x, y) = centre of the disc's bottom edge, w = diameter
  goal: -1,       // index of the goal peg
  numbers: true,
  done: 0,        // seconds the puzzle has been solved and at rest (celebration)
};
export const flatAlpha = () => (v3.on ? Math.max(0, 1 - v3.fade) : 1);
