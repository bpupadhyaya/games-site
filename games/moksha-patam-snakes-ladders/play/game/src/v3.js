// Hand-off between the 2D screens (view.js) and the optional 3D presenter (view3d/presenter.js). The simulation never reads this.
// `live` is true only while a WebGL scene is alive and drawn for the current screen; with it off every screen draws the flat 2D art
// exactly as before (that art is the fallback for no WebGL, a lost context and ?flat=1).
export const v3 = {
  ready: false,   // presenter alive (false after a lost context)
  live: false,    // 3D is drawn behind the transparent 2D layer this frame
  board: null,    // the board (ladders + serpents) the 3D scene should show
  pawns: [],      // { x, y, lift, squash, glow, color, i } in canonical board coordinates
  dice: [],       // { x, y, s, v, angle, lift, tumble, glow, ring } screen virtual units
  boardRect: null,// play: the board rectangle in virtual units the camera is fitted to
  tray: null,     // table rectangle (virtual units) the dice roll on
  titleRect: null,// title: rectangle in kit-canvas device px the hero board is fitted to
  proj: null,     // (cx, cy, h) canonical board point -> { x, y, s, q } in virtual units (s = px per canonical unit, q = vertical squash)
  clear() { this.pawns.length = 0; this.dice.length = 0; this.tray = null; this.titleRect = null; this.boardRect = null; },
};
