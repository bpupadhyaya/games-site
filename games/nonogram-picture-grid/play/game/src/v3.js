// Bridge between the 2D layer and the 3D presenter (view3d/presenter.js). While it draws the play board the 2D layer fills `frame`;
// the presenter reads it and renders the lit tray and tiles behind the transparent 2D canvas. `on` is false without WebGL (or after a
// lost context, or with ?flat=1): every screen then draws the flat 2D art exactly as before.
export const v3 = { on: false, frame: null };
