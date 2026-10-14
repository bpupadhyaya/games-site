// The hand-off between the 2D layer (kit canvas: HUD, guides, input, menus) and the optional 3D layer (web/view3d, a WebGL canvas BEHIND the
// kit canvas). Plain data, so the pure game code stays DOM-free.
//   on:       true while the 3D layer is ready and drawing the world; the 2D layer then leaves ground, scenery, people and ball to it.
//   views:    filled during each render with the one scene the 2D layer wants drawn:
//             { kind: 'play' | 'hero' | 'menu', g: geom (see art.js), state }
//   licenses: the third-party credits text (shown on the About page when the 3D layer is in use).
export const GL = { on: false, views: [], licenses: '' };
