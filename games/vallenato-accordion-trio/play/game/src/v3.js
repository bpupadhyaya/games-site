// Hand-off between the 2D interface layer (art.js, ui.js, playview.js, view.js) and the optional 3D presenter (view3d/presenter.js).
// The simulation never reads this. `on` is true only while a WebGL context is alive and the scene is built; with it off every screen draws
// exactly as before (the flat 2D art), so the game is fully playable without WebGL and while the 3D scene is still being built.
// While on, the 2D layer reports panels / buttons / the instrument geometry here and draws only text, notes and effects on top of the
// lit 3D plaques, lacquered buttons and instruments that the presenter renders behind the (transparent) 2D canvas.
export const v3 = {
  on: false,
  scene: '',           // current screen name (title, songs, piece, play, ...)
  panels: [],          // { r, rad, kind: 'slate' | 'ribbon' | 'glass' | 'sign' | 'cap' | 'part', col }
  buttons: [],         // { r, rad, kind, press }
  inst: null,          // play screen: { focus, acc: {G, flash[], pull, want, wantPull}, bell: {pad, pull, held, auto}, caja: {G, tum, tak}, gua: {G, fork, lean, glow, trail} }
  hero: null,          // title screen: { cx, top, sc, tm, calm } where the 3D trio stands
  scrimTop: false,     // the dim goes in front of the play page (pause menu); plaques flagged top: true sit above it
  scrim: 0,            // 0..1 dimming drawn in 3D under the plaques (text pages)
  dock: null,          // play screen: rect of the instrument area (a wooden bench is drawn under it)
  pressed: null,       // { x, y } while the pointer is down (virtual units)
  hit: [],             // [{ part, kind, k }] recent hits for sparks (presenter reads, never writes game state)
};
