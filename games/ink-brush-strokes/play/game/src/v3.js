// Hand-off between the 2D screens (view.js / playview.js) and the optional 3D presenter (view3d/presenter.js). The simulation never reads this.
// `on` is true only while a WebGL scene is alive and drawn. With it off every screen draws exactly as before (the flat 2D art is the fallback
// for no WebGL, a lost context, ?flat=1 and the headless tests). While it is on, the 2D screens draw the paper sheet (paper, guides, ink,
// seal) into `sheet` (a canvas the presenter lays on the 3D paper) instead of onto the screen, and write what the 3D desk should show into `want`.
export const v3 = {
  on: false,
  fade: 1,        // 0..1 right after the 3D scene takes over: the flat art fades out on top of it
  want: null,     // { kind: 'play'|'hero'|'bare', rect (virtual units, where the sheet sits in the flat layout), free, brush: {x,y,down,load,tone}|null, key, fin }
  sheet: null,    // { canvas, k } the sheet texture source (rect.w*k by rect.h*k pixels)
  map: { active: false, to: null },   // input: to(vx,vy) -> {x,y,inside} maps a screen point through the 3D view to a flat-layout point inside want.rect
};
export const flatAlpha = () => (v3.on ? Math.max(0, 1 - v3.fade) : 1);
