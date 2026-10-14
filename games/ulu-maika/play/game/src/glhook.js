// Shared hand-off between the 2D screens and the optional 3D layer (web/view3d). While the 3D layer is ready and its WebGL context is
// alive (`active`), the kit canvas is transparent where the scene should show and the 2D side draws only chrome, text and badges;
// every frame game.js fills `frame` (what the scene should show) and the presenter reads it. Without WebGL2, with ?nogl, on a lost
// context or while assets are loading, `active` is false and the original illustrated 2D scope draws as before.
export const gl = { active: false, frame: null, licenses: '' };
