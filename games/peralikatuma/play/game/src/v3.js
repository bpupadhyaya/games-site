// Shared hand-off between the 2D UI (view.js, art.js) and the optional 3D presenter (view3d/presenter.js).
// The simulation never reads this. `on` is flipped by the presenter only while a WebGL context is alive; with it off every
// screen draws exactly as it did before (the 2D fallback). The 2D layer records what the board scene must show (pieces,
// markers, effects) in virtual units; the presenter turns them into lit 3D objects behind the transparent canvas.
export const v3 = {
  on: false,
  sq: null,            // (pointIndex) -> { x, y, s } projected point centre in virtual units, s = projected lattice step (3D board)
  pick: null,          // (x, y) -> point index or -1 (3D board)
  pieces: [],          // { code, x, y, lift, scale, tilt, cell, drag, squash, spin }
  marks: [],           // { kind, x, y, x0?, y0?, a }
  fx: [],              // { kind: 'cap'|'crown'|'land', code, x, y, f, id }
  heroRect: null,      // title screen: where the 3D hero board goes
  scene: 'title',
  pressed: null,       // { x, y } while the pointer is down
};
