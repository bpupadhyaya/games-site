// Hand-off between the 2D screens (view.js) and the optional 3D presenter (view3d/presenter.js). The simulation never reads this.
// With `on` false every screen draws as before (flat 2D art = fallback for no WebGL, a lost context, ?flat=1, headless tests).
export const v3 = { on: false, fade: 1 };
export const flatAlpha = () => (v3.on ? Math.max(0, 1 - v3.fade) : 1);
