// Hand-off between the 2D screens (view.js, game.js) and the optional 3D presenter (view3d/presenter.js). The simulation never reads this.
// `on` is true only while a WebGL scene is alive and drawn; with it off every screen draws exactly as before (the flat 2D art is the fallback
// for no WebGL and for a lost context). The 2D layer describes what it wants drawn this frame (stones, rings, sockets, sticks) in screen units;
// the presenter draws them in 3D and hands back a projected play geometry (`play`) so taps, routes and particles line up with the 3D table.
export const v3 = {
  on: false,
  play: null,      // { lay, geo(flip) }: the play layout and board geometry as the live 3D camera projects them (null off the play screens)
  flip: false,
  pieces: [],      // { who (1 ivory, 2 clay), x, y, d, lift, glow, alpha, scale, ring }
  marks: [],       // { kind: 'cell' | 'ring' | 'disc', x, y, r, col, a }
  sockets: [],     // { x, y, d }
  sticks: null,    // [{ x, y, z, yaw, roll }] in mat units, or null
  trayActive: -1,  // 0 / 1: the side to move (its yard tray glows)
};
