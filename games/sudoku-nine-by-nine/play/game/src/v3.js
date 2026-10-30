// Bridge between the 2D layer and the 3D presenter (view3d/presenter.js). The 2D layer fills `frame` while it draws the play board;
// the presenter reads it and renders the lit tray and tiles behind the transparent 2D canvas. `on` is false without WebGL (or after a
// lost context): every screen then draws the flat 2D art exactly as before.
export const v3 = { on: false, frame: null, frameT: -1 };
