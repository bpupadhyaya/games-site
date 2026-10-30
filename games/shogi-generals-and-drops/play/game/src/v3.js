// Hand-off between the 2D screens (view.js, game.js) and the optional 3D presenter (view3d/presenter.js). The simulation never reads
// this. `on` is true only while a WebGL scene is alive; with it off every screen draws exactly as before (the flat 2D art is the
// fallback for no WebGL, a lost context, ?flat=1 and the headless tests). Positions are in the flat game's canonical board units
// (the 2D layer keeps all its geometry; the presenter does the projection).
export const v3 = {
  on: false,
  fade: 1,         // 0..1 right after the 3D scene takes over: the flat art fades out on top of it
  frame: null,     // set by the screen being drawn: { mode: 'play' | 'title', rect: {x,y,w,h} in virtual units } (null: a text page, flat backdrop)
  n: 9, flip: false, lang: 'jp',
  gcx: 360, gcy: 678, cell: 68,   // canonical grid centre and cell size (layout.js geom)
  pieces: [],      // { x, y, t, owner, rot, label?, lang, lift? } canonical centre of the piece's foot
  marks: [],       // { x, y, kind: 'dot'|'ring'|'sel'|'last'|'check'|'hint'|'chosen'|'lesson'|'cursor', a?, x2?, y2? }
  toCanon: null,   // (sx, sy) screen virtual units -> canonical board units, through the tilted board
  toScreen: null,  // (cx, cy) the inverse
};
export const flatAlpha = () => (v3.on ? Math.max(0, 1 - v3.fade) : 1);
