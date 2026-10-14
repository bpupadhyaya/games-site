// The hand-off between the 2D layer (kit canvas: HUD, guides, input) and the optional 3D layer (web/view3d, a WebGL canvas BEHIND
// the kit canvas). This module is plain data so the pure game code stays DOM-free.
//   on:      true while the 3D layer is ready and drawing the world; the 2D layer then leaves the lane, pins, stake and thrower to it.
//   views:   filled during each render with the scene views the 2D layer would have drawn { R, cam:{cx,s}, state, look, noFigure }.
//   licenses: the third-party credits text (shown on the About page when the 3D layer is in use).
export const GL = { on: false, views: [], licenses: '' };
