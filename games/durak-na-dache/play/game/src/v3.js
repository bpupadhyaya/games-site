// Hand-off between the 2D screens (view.js) and the optional 3D presenter (view3d/presenter.js). The simulation never reads this.
// `on` is true only while a WebGL scene is alive and drawn; with it off every screen draws exactly as before (the flat 2D art is the
// fallback for no WebGL, a lost context, ?flat=1 and the headless tests).
export const v3 = {
  on: false,
  fade: 1,          // 0..1 right after the 3D scene takes over: the flat art fades out on top of it (crossfade)
  dealing: false,   // the presenter is dealing: your own hand stays hidden until the last card lands
};
// Scenes the 3D layer paints (the veranda table). Setup, About, Rules, Settings keep the flat painted veranda.
export const covers = (scene) => v3.on && (scene === 'title' || scene === 'play' || scene === 'auto' || scene === 'lesson' || scene === 'daily');
// Alpha for the flat veranda art and the things the 3D scene draws itself (cards on the table, stock, discard, opponents' hands).
export const flatAlpha = (scene) => (covers(scene) ? Math.max(0, 1 - v3.fade) : 1);
