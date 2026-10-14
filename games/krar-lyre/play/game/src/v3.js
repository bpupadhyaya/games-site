// Hand-off between the 2D screens (art.js, view.js, playview.js) and the optional WebGL presenter (view3d/presenter.js).
// The simulation never reads this. `on` is true only while a WebGL context is alive and the scene is built; `fade` (0..1) crossfades the flat art
// out while the 3D scene fades in, so the first frame is always the flat art (instant) and the 3D layer arrives without a hitch.
export const v3 = {
  on: false,
  fade: 0,
  back: null,       // { w, h, t, pulse, dim }   what drawBackdrop was asked for this frame
  lyre: null,       // { G, o }                  what drawLyre was asked for this frame (null when no lyre is on screen)
  dark: 0,          // 0..1 extra scrim the presenter draws over the 3D world (document screens)
  pressed: null,
};
