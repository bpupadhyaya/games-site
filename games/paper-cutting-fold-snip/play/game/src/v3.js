// Hand-off between the 2D screens (art.js, view.js) and the optional 3D presenter (view3d/presenter.js). The simulation never reads this.
// `on` is true only while a WebGL scene is alive and drawn; with it off every screen draws exactly as before (the flat 2D art is the
// fallback for no WebGL, a lost context, ?flat=1 and the headless tests). While 3D is on, the 2D layer only DESCRIBES what it would have
// drawn (desk, cutting mat, paper faces + the exact camera it uses for hit-testing) and the presenter draws it lit, with real shadows.
export const v3 = {
  on: false,
  fade: 1,        // 0..1 right after the 3D scene takes over: the flat art fades out on top of it (crossfade)
  ctx: null,
  base: null,     // the kit context's transform at the start of the frame (virtual units -> canvas pixels)      // the kit's main 2D context (thumbnails and illustrations use other contexts and stay flat)
  req: { desk: false, mat: null, paper: null },   // what the 2D layer asked for this frame
};
export const flatAlpha = () => (v3.on ? Math.max(0, 1 - v3.fade) : 1);
export const resetReq = () => { v3.req = { desk: false, mat: null, paper: null }; };
// A request made through the main context while 3D is on. Coordinates are mapped through the context's current transform
// (the title scales its hero block), so everything the presenter receives is in virtual screen units.
export const is3d = (ctx) => v3.on && ctx === v3.ctx;
export const xf = (ctx) => { const t = ctx.getTransform(), b = v3.base || { a: 1, d: 1, e: 0, f: 0 }; return { k: t.a / b.a, e: (t.e - b.e) / b.a, f: (t.f - b.f) / b.d }; };
