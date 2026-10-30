// Hand-off between the 2D screens (view.js, game.js) and the optional 3D presenter (view3d/presenter.js). The rules never read this.
// `on` is true only while a WebGL scene is alive; with it off every screen draws exactly as before (the flat 2D art is the fallback for
// no WebGL, a lost context, ?flat=1 and the headless tests). Positions are in the flat game's canonical board units (the 2D layer keeps
// all its geometry; the presenter does the projection).
export const v3 = {
  on: false,
  frame: null,      // set by the screen being drawn: { mode: 'play' | 'title', rect: {x,y,w,h} in virtual units } (null: a text page, flat backdrop)
  mode: 'pachisi',  // 'pachisi' | 'ludo' (the board and the throw differ)
  gcx: 360, gcy: 650, cell: 30,   // canonical centre of the cross and the size of one square (layout.js BOARD / cellSize)
  pieces: [],       // { arm, x, y, lift, s, a } canonical foot of a pawn, lift in canonical units, scale, alpha
  marks: [],        // { x, y, kind: 'dest'|'cap'|'sel'|'glow'|'glowSel'|'dot'|'ping'|'turn', a?, r? }
  dice: [],         // the cowries / die on the rug: { kind: 'cowry'|'die', x, y, z, rot, phi?, face? } in rug design pixels from the rug centre
  rugGlow: 0,       // 0..1 pulse while the human is asked to throw
  turnArm: -1,
  mat: null,        // the projected rug rectangle (virtual units); the presenter keeps layout.js MAT equal to it, so the throw zone follows the picture
  toScreen: null,   // (cx, cy, h = 0) canonical board point, h world squares above the cloth -> virtual screen units
  cellPx: 40,       // virtual units per square at the board centre
};
