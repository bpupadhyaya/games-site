// Shared hand-off between the 2D interface (view.js, layout.js) and the optional 3D presenter (view3d/presenter.js).
// The simulation never reads this. `on` is flipped by the presenter only while a WebGL context is alive; with it off every screen
// draws exactly the flat 2D art (the fallback). The presenter publishes the projection of the chart so labels, routes and
// port hit tests land on the 3D islands.
export const v3 = {
  on: false,
  proj: null,          // (chartX 0..1, chartY 0..1) -> { x, y } in virtual units (voyage scene only)
  scene: 'title',
  workers: false,
};
