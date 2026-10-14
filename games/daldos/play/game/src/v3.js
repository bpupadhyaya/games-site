// Shared hand-off between the 2D UI (view.js, art.js) and the optional 3D presenter (view3d/presenter.js).
// The simulation never reads this. `on` is true only while a WebGL context is alive; with it false every screen draws exactly as the
// flat 2D version did (the fallback). The 2D layer reports plaques / buttons / the throwing stick here; the presenter turns them into
// lit 3D objects behind the text and publishes the board projection back (cell, pick) so taps follow the 3D camera.
export const v3 = {
  on: false,
  cell: null,        // (row, col, height) -> { x, y } in virtual units (logical row / col, as the rules use them)
  pick: null,        // (x, y) -> { row, col } | null
  cw: 60,            // projected width of one board cell in virtual units (badges and marks scale with it)
  panels: [],        // { r, rad, kind }   kind: card | plateOn | plateOff | tray | sheet | msg | over
  buttons: [],       // { r, kind, hot }   kind: primary | quiet | on | disabled
  stick: null,       // { r, value, spin, blank, extra } the throwing stick in the tray
  scrim: 0,
  scene: 'title',
  heroRect: null,    // where the 3D board goes on the title screen
  pressed: null,
};
// Pre-rendered pictures of the same 3D models, drawn by the flat helpers (plates, result card, Rules diagrams).
export const sprites = { ready: false, spatula: [[], []], board: null, stick: [] };
