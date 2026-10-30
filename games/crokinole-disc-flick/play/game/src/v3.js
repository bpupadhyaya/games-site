// Hand-off between the 2D screens (view.js) and the optional 3D presenter (view3d/presenter.js). The simulation never reads this.
// `ready` = a WebGL scene is alive. While it is, drawTable() skips the flat board and discs and fills this each frame instead; the
// presenter draws them in 3D behind the transparent 2D layer (HUD, aim guide, particles). With it off every screen draws the flat art.
export const v3 = {
  ready: false,
  table: null,    // { cx, cy, s, rot }: board centre (virtual units), scale, rotation (canvas radians)
  discs: [],      // { team, x, y, spin, lift, glow, sc, a } in board coordinates
  pegFlash: null, // 8 peg flash values
  clear() { this.table = null; this.discs.length = 0; this.pegFlash = null; },
};
