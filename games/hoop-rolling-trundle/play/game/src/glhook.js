// Shared hand-off between the 2D art and the optional 3D presenter (web/view3d). While a play (or title) scene is drawn, the 2D side
// fills `frame` (the road camera and who is where); the presenter draws the people and hoops in WebGL on a transparent canvas ABOVE
// the kit canvas (it never takes input). `active` is true only while the 3D layer is ready and its context is alive; otherwise the 2D
// illustrated figures draw everything themselves.
export const gl = { active: false, frame: null, size: { w: 720, h: 1280 }, licenses: '' };
