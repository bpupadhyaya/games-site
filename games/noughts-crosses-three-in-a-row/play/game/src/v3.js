// Hand-off between the 2D screens (view.js, game.js) and the optional 3D presenter (view3d/presenter.js). The simulation never reads
// this. `on` is true only while a WebGL scene is alive and drawn; with it off every screen draws exactly as before (the flat 2D art is
// the fallback for no WebGL, a lost context and ?flat=1).
export const v3 = {
  on: false,
  fade: 1,        // 0..1 right after the 3D scene takes over: the flat art fades out on top of it (crossfade)
  geo: null,      // (mode, x, y, side) -> board geometry like art.boardGeo, but projected from the tilted 3D board
  view: 'env',    // what the 2D layer is showing this frame: 'play' | 'title' | 'env' (documents, setup, settings)
  rect: null,     // virtual-unit rectangle {x, y, w, h} the camera fits the board into (play and title)
  veil: 0,        // 0..1 darkening the 2D layer lays over the 3D scene on text screens
  pieces: [],     // marks the 2D layer wants drawn this frame: { who, i, mode, a?: {kind, t, from}, glow, scale, alpha, lift, ghost }
  win: null,      // the winning line this frame: { line, k, col: 'r,g,b', n }
  mode: 'classic',
};
// Alpha for the flat board/backdrop layers: 1 without 3D, fading to 0 during the crossfade, then 0.
export const flatAlpha = () => (v3.on ? Math.max(0, 1 - v3.fade) : 1);
