// Shared state between the 2D layer (view.js writes `frame` each play frame) and the 3D presenter (view3d/presenter.js reads it).
// alive = presenter exists (publish frames); on = it has drawn a frame (cut the hole); frame = { w, h, rect, cam, maze, look, lamp, t, glow, fog, map, stamp } in virtual units.
export const v3 = { alive: false, on: false, frame: null, n: 0 };
