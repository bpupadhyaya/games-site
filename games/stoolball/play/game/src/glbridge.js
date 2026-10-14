// The hand-off between the 2D picture and the optional 3D layer (web/view3d). Pure data: no DOM, no three.js.
// - `on` is set by the presenter while the WebGL layer is drawing the green, the boards and the people; the 2D code then skips them.
// - `req` is written by drawStage every frame: which session, which camera, which stage rectangle. The presenter reads it.
// - `hand` is where the bowler's hand is (sim metres), so the 2D ball can sit in it during the run-up.
export const GL = { on: false, req: null, hand: null, handFor: null, ball: null };
