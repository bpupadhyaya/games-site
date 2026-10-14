// The hand-off between the 2D layer (kit canvas: HUD, gauges, menus, input) and the optional 3D layer (web/view3d, a WebGL canvas BEHIND the
// kit canvas). Plain data, so the pure game code stays DOM-free.
//   on:       true while the 3D layer is ready and drawing the field; the 2D layer then leaves the scene to it.
//   views:    filled during each render with what the 2D layer would have drawn { c, st, S, camX, gy } (virtual units).
//   project:  (x, y, z) world metres -> [px, py] virtual units, set by the presenter after each frame.
//   licenses: the third-party credits text (shown on the About page when the 3D layer is in use).
export const GL = { on: false, views: [], licenses: '', project: null };
