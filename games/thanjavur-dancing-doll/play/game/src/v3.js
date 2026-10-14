// Shared hand-off between the 2D art (art.js, doll.js, playview.js, view.js) and the optional 3D presenter (view3d/presenter.js).
// The simulation never reads this. `on` is flipped by the presenter only while a WebGL context is alive and the scene is built;
// with it off every screen draws exactly as before (the flat 2D fallback). While `capture` is true the painters do not draw the
// room, shelf and dolls: they record them here and the presenter renders them as a lit 3D set behind the transparent 2D canvas.
export const v3 = {
  on: false,
  capture: false,
  dolls: [],          // { cx, gy, R, o }  o = the drawDoll options (th, lag, torso, ch, variant, paint, glow, tap, ghost, alpha)
  stage: null,        // { S, gy, fh, t, lamp, shake, n }
  scene: 'title',
  pressed: null,
  calm: false,
  sprite: null,       // (ch, variant, paint) -> canvas | null : a lit 3D render of one doll for 2D cells and figures (set by the presenter)
  frame() { this.dolls.length = 0; this.stage = null; },
};
