// Shared state between the 2D layer (view.js writes `frame` each play frame) and the 3D presenter (view3d/presenter.js reads it).
// on = the WebGL table is running; frame = { cx, cy, s, sticks[], stamp } in virtual units (see view.js drawTable).
export const v3 = { on: false, frame: null, n: 0 };
