// Hand-off between the 2D screens (view.js) and the optional 3D presenter (view3d/presenter.js). The simulation never reads this.
// `on` is true only while a WebGL scene is alive and drawn; with it off every screen draws exactly as before (the flat 2D art is the
// fallback for no WebGL, a lost context, ?flat=1 and the headless tests).
export const v3 = {
  on: false,
  // the one scene the 3D layer draws this frame (set by view.js while rendering, reset each frame):
  // { V, cam: { k, ax, ay, wx, wy } (world point wx,wy sits at screen point ax,ay, k screen units per world unit),
  //   pieces: [{ i, x, y, a, lift, z }], gold: { Q, sig } | null, mat: { x, y, w, h } | null (the cloth under the play area, screen units) }
  scene: null,
  ready: new Set(),   // 'vesselId#i' shards the 3D layer already shows (the 2D layer paints the rest until they are baked)
};
export const shardKey = (V, i) => V.def.id + '#' + i;
