// Hand-off between the flat field drawing (render.js) and the optional 3D presenter (view3d/presenter.js). The simulation never
// reads this. `on` is true only while a WebGL scene is alive and drawn; with it off everything draws exactly as before (the flat
// art is the fallback for no WebGL, a lost context, ?flat=1 and the headless tests).
export const v3 = {
  on: false,
  fade: 1,        // 0..1 right after the 3D scene takes over: the flat field fades out on top of it (crossfade)
  frame: null,
  hand: [],       // per hunter slot: where the 3D fork/bow sits in flat units while he draws (stones and aim arcs leave from it)    // the field the 2D layer was asked to draw this frame: { s, fx, t, title, L } (read by the presenter)
};
export const flatAlpha = () => (v3.on ? Math.max(0, 1 - v3.fade) : 1);
// Where a hunter's shot leaves from: the 3D fork when the 3D field is drawn, else the flat art's fork tip.
export const launchPoint = (slot, fallback) => (v3.on && v3.hand[slot]) || fallback();
