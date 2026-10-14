// The hand-off between the 2D layer (kit canvas: HUD, gauges, menus, input) and the optional 3D layer (web/view3d, a WebGL canvas
// BEHIND the kit canvas). Plain data, so the pure game code stays DOM-free.
//   on:       true while the 3D layer is ready and drawing the lake; the 2D layer then leaves the water, sky and stone to it.
//   views:    filled during each render with the lake views the 2D layer would have drawn { kind, rect, ws } (rect in virtual units).
//   state:    the game's state object (read-only for the presenter).
//   licenses: the third-party credits text (shown on the About page when the 3D layer is in use).
export const GL = { on: false, views: [], state: null, licenses: '', project: null, camZ: -99 };
