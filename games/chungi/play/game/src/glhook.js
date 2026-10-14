// Hand-off between the 2D art and the optional 3D presenter (web/view3d). While a play or title scene is drawn the 2D side fills
// `frame` with the alley camera and where the kid and ball are; the presenter draws the kid in WebGL on a transparent canvas ABOVE the
// kit canvas (it never takes input). `active` is true only while the 3D layer is ready and its context is alive; `allow` is set by
// game.render for the scenes where nothing is drawn over the kid. Otherwise the 2D illustrated kid draws itself.
// `bgFrame` / `bgReady`: the 3D alley (web/view3d/alley3d.js) draws on its own canvas UNDER the kit canvas. While it is ready the 2D
// backdrop is skipped (the kit canvas stays transparent there) and drawBackdrop only records the camera, wall half-width and wind.
export const gl = { active: false, allow: false, frame: null, licenses: '', bgFrame: null, bgReady: false };
