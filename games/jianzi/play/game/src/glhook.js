// Shared hand-off between the 2D art and the optional 3D presenter (web/view3d). While a courtyard scene is drawn, the 2D side
// fills `frame` (camera, yard, who stands where, kick records); the presenter reads it after the render and draws the backdrop and
// the people in WebGL behind the transparent kit canvas, which keeps the shuttle, effects, HUD and input. `active` is true only
// while the 3D layer is ready and its context is alive; otherwise the paper-cut 2D figures draw everything themselves.
export const gl = { active: false, frame: null, licenses: '' };
