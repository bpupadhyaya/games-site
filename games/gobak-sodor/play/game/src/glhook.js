// Shared hand-off between the 2D view and the optional 3D presenter (web/view3d). The view fills `frame` while it draws a court scene;
// the presenter reads it after the render and places the 3D players, the sand and the red touch zones under the transparent kit canvas.
// `active` is true only while the 3D layer is ready and its WebGL context is alive; otherwise the 2D art draws everything itself.
export const gl = { active: false, frame: null, headUp: 0, licenses: '' };
