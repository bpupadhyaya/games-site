// Hand-off between the 2D screens (view.js, layout.js) and the optional 3D presenter (view3d/presenter.js). The simulation never reads
// this. `on` is true only while a WebGL scene is alive and drawn; with it off every screen draws exactly as before (the flat 2D art is
// the fallback for no WebGL, a lost context, ?flat=1 and the headless tests).
export const v3 = {
  on: false,
  fade: 1,        // 0..1 right after the 3D scene takes over: the flat art fades out on top of it (crossfade)
  at: null,       // (i) -> { x, y, s } stage position of board point i as the live 3D camera sees it (s = local scale, 1 = the old near row)
  rack: null,     // (which, k, kind) -> { x, y, s } stage position of tray slot k
  pieces: [],     // men the 2D layer wants drawn this frame: { side, i, lift, sel, sc, alpha }
  marks: [],      // rings and glows on the board: { i, rgb, a, rad, glow, dash }
  bars: [],       // mills standing on the board: { a, c, pulse }
  label: null,    // (which, kind) -> { x, y, two } stage position of a tray's caption
  hand: null,     // { top: { side, n }, bottom: { side, n } } men waiting in the trays
  move: null,     // the man in flight: { from (point or NONE), to, side, rack, f (0..1), fly }
  take: null,     // the man being taken: { i, side, tf (0..1) }
  drag: null,     // the man under the finger: { x, y (stage), side }
  look: { wood: 'oak', set: 'boxwood' },
};
// Alpha for the flat room / board layers: 1 without 3D, fading to 0 during the crossfade, then 0.
export const flatAlpha = () => (v3.on ? Math.max(0, 1 - v3.fade) : 1);
