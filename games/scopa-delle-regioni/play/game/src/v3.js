// Hand-off between the 2D screens (view.js / art.js) and the optional 3D presenter (view3d/presenter.js). The simulation never reads this.
// `on` is true only while a WebGL scene is alive; `active` is true only for the frames whose screen is a table (play, lessons, puzzles,
// Auto Play, title). With either off every screen draws exactly as before: the flat 2D art is the fallback for no WebGL, a lost context,
// ?flat=1 and the headless tests. Cards are handed over in the 2D layer's virtual units (centre, width, rotation).
export const v3 = {
  on: false,
  active: false,
  cloth: null,     // { x, y, w, h } the gingham cloth rectangle of this frame
  sky: 200,        // height of the painted sky strip (the 3D tabletop starts under it)
  cards: [],       // { id, x, y, w, rot, lift, back, french } filled by view.js card() each frame, in draw order
  title: false,    // the title screen: cards sway on the cloth
};
