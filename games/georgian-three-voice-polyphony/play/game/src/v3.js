// Shared hand-off between the 2D UI (art.js, ui.js, view.js, playview.js, docview.js) and the optional 3D presenter (view3d/presenter.js).
// The simulation never reads this. `on` is flipped by the presenter only while a WebGL context is alive and the scene is built; with it
// off every screen draws exactly as before (the flat 2D fallback). The 2D layer reports panels / buttons here and draws only text and
// glyphs on top; the presenter turns them into lit walnut plaques, brass trim and lacquered buttons behind the text.
export const v3 = {
  on: false,
  mix: 0,              // 0..1 crossfade: the flat 2D art fades out (1 - mix) while the 3D scene is already drawn behind it
  panels: [],          // { r, rad, kind: 'wood' | 'glass' | 'bar' | 'card' }
  buttons: [],         // { r, rad, kind, press }
  hi: [],              // reserved
  scrim: 0,            // 0..1 full-screen dimming drawn in 3D under the plaques
  heroRect: null,      // title screen: where the 3D choir goes
  choirRect: null,     // play / lab: the band reserved for the singers
  pressed: null,       // { x, y } while the pointer is down
};
export const flatAlpha = () => (v3.on ? Math.max(0, 1 - v3.mix) : 1);
