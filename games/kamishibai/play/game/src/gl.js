// Shared flag between the 3D presenter (web/view3d) and the 2D drawing code. The presenter sets `active` while its WebGL scene is
// running (so the 2D layer leaves the scene, cards, stage and audience to it); when it is false (no WebGL, context lost, ?gl=0) every
// 2D drawing routine in view.js paints the full picture itself. `f` is the per-frame description the 2D layer hands to the presenter
// (mode, layout rects, canvas mapping); the presenter only reads it.
export const GL = { active: false, f: null };
