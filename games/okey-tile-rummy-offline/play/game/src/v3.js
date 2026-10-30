// Hand-off between the 2D screens (view.js, art.js) and the optional 3D presenter (view3d/presenter.js). The simulation never reads this.
// `on` is true only while a WebGL scene is alive and drawn; with it off every screen draws exactly as before (the flat 2D art is the
// fallback for no WebGL, a lost context, ?flat=1 and the headless tests).
// `rec` is the per-frame list the 2D drawing code fills while a 3D scene covers the screen: every tile, tile back, rack frame and title
// letter is recorded as four CSS-pixel corners instead of being painted, and the presenter stands real lit tiles exactly there.
export const v3 = {
  on: false,
  fade: 1,          // 0..1 right after the 3D scene takes over: the flat art fades out on top of it (crossfade)
  rec: null,        // array while recording this frame, else null
  flatA: 0,         // alpha of the flat copies drawn under a covered scene (1 - fade); 0 once the 3D scene is fully in
  k: 1,             // CSS pixels per device pixel of the kit canvas (set by main.js every frame)
};
// Scenes the 3D layer paints (the kahvehane table). About, Rules, How to Play, Settings and Limit keep the flat painted art.
export const covers = (scene) => v3.on && (scene === 'title' || scene === 'play' || scene === 'demo');
// Alpha for the flat art the 3D scene draws itself (table, tiles, rack, title tiles).
export const flatAlpha = (scene) => (covers(scene) ? Math.max(0, 1 - v3.fade) : 1);
