// The hand-off between the 2D layer (kit canvas: HUD, guides, rings, menus, input) and the optional 3D layer (web/view3d, a WebGL
// canvas BEHIND the kit canvas). Plain data, so the pure game code stays DOM-free.
//   on:       true while the 3D layer is ready and drawing the town; the 2D layer then leaves the ground, village, pins and bat to it.
//   views:    filled during each render with the town views the 2D layer would have drawn { cam, S } (cam = the 2D pinhole, S = scene).
//   state:    the game's state object (read-only for the presenter).
//   licenses: the third-party credits text (shown on the About page when the 3D layer is in use).
export const GL = { on: false, views: [], state: null, licenses: '' };
