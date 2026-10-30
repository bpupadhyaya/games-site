// Hand-off between the 2D screens (view.js, game.js input) and the optional 3D presenter (view3d/presenter.js). The simulation never
// reads this. `on` is true only while a WebGL scene is alive and drawn; with it off every screen draws exactly as before (the flat 2D
// art is the fallback for no WebGL, a lost context, ?flat=1 and the headless tests).
export const v3 = {
  on: false,
  fade: 1,        // 0..1 right after the 3D scene takes over: the flat art fades out on top of it (crossfade)
  proj: null,     // (cx, cy, lift) canonical flat-board point -> { x, y, k } in virtual screen units (k = screen units per board unit)
  unproj: null,   // (x, y) virtual screen point -> canonical flat-board point on the tilted 3D board, or null
  hero: null,     // title: { x, y, w, h } (virtual units) where the 3D board goes
  frame: null,    // what the board shows this frame (view.js fills it): { board, flip, anim, land, drag, sel, ghost, caps, theme, set, lang, calm, t }
  marks: [],      // board marks asked for this frame: { sq, kind: glow|dot|ring|dash|square|cross, rgb, s (in point spacings), a, add }
};
// Alpha for the flat board/backdrop layers: 1 without 3D, fading to 0 during the crossfade, then 0.
export const flatAlpha = () => (v3.on ? Math.max(0, 1 - v3.fade) : 1);
