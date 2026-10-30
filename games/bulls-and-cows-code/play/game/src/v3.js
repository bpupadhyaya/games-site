// Hand-off between the 2D screens (view.js, art.js) and the optional 3D presenter (view3d/presenter.js). The simulation never reads this.
// `on` is true only while a WebGL scene is alive and drawn; with it off every screen draws the flat 2D art (no WebGL / lost context / tests).
export const v3 = {
  on: false,
  fade: 1,        // 0..1 right after the 3D scene takes over: the flat background fades out on top of it
  items: null,    // while the play screen or the title hero is drawn with 3D on: list of pegs, holes, lids and clue pips the 2D art asked for this frame
  slabs: [],      // wooden trays the 2D layer wants under those items: { id, x, y, w, h, r }
  slabCtl: false, // the control tray under the digit keys is a 3D slab (skip its flat panel)
  scene: '',      // 'play' | 'title' | other
  look: null,     // palette of the current look (the 3D materials follow it)
};
export const flatAlpha = () => (v3.on ? Math.max(0, 1 - v3.fade) : 1);
