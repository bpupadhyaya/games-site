// Hand-off between the 2D screens (scene.js / view.js / menus.js) and the optional 3D presenter (view3d/presenter.js). The simulation never reads this.
// `on` is true only while a WebGL scene is alive and drawn. With it off every screen draws exactly as before (the flat 2D art is the fallback for
// no WebGL, a lost context, ?flat=1 and the headless tests). While it is on, the 2D screens skip the room, lane, pins and ball (the 3D scene draws
// them) and write what the 3D alley should show into `want`; overlays (aim path, target ring, dust) are still drawn in 2D, projected through the
// 3D camera by proj() in scene.js.
export const v3 = {
  on: false,
  fade: 1,          // 0..1 right after the 3D scene takes over: the flat art fades out on top of it
  want: null,       // { kind: 'play'|'hero', rect (virtual units), pins, ball, ballOpts, pinFx, t, inset }
  xf: null,         // { vx, vy, s } where the 2D lane picture's origin sits in the current layout (virtual units)
  project: null,    // (x, y, z) in lane metres -> { x, y, s } virtual units (s = units per metre)
  prepare: null,    // (want) -> void: places the 3D camera for this frame, so project() agrees with what is rendered
  map: { active: false, to: null, skip: null },   // input: to(vx, vy) -> { x, y, z, inside } the point on the lane under a screen position
};
export const flatAlpha = () => (v3.on ? Math.max(0, 1 - v3.fade) : 1);
