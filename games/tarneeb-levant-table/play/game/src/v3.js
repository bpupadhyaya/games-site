// Hand-off between the 2D screens (view.js) and the optional 3D presenter (view3d/presenter.js). The simulation never reads this.
// `on` is true only while a WebGL scene is alive and drawn; with it off every screen draws exactly as before (the flat 2D art is the
// fallback for no WebGL, a lost context, ?flat=1 and the headless tests).
export const v3 = {
  on: false,
  fade: 1,          // 0..1 right after the 3D scene takes over: the flat art fades out on top of it (crossfade)
};
// Scenes the 3D layer paints (the cafe table). About, Rules and the lesson list keep the flat painted table.
export const covers = (scene) => v3.on && (scene === 'title' || scene === 'table');
// Alpha for the flat table art and the things the 3D scene draws itself (cards on the felt, the deal, the title fan).
export const flatAlpha = (scene) => (covers(scene) ? Math.max(0, 1 - v3.fade) : 1);
