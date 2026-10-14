// Hand-off between the 2D screens (view.js, menus.js) and the optional 3D presenter (view3d/presenter.js).
// The simulation never reads this. `on` is true only while a WebGL context is alive and the 3D assets are loaded; with it off every
// screen draws exactly as before (the 2D fallback). The 2D layer publishes WHAT to show each frame (stage rectangle, world state,
// where the toy is and how big, what the hands do); the presenter turns it into lit 3D behind the transparent 2D canvas.
export const v3 = {
  on: false,
  view: null,        // { rect: {x,y,w,h} (virtual units), ws } set by drawWorldState each frame (null = nothing to show)
  toy: null,         // { x, y, size, rotor, rev, s, tilt, roll, blend, hands, rub, press, charge, hot, lean } virtual units
  W: 720, H: 1280,
  thumbs: null,      // { img: [6 canvases], size, hubX, hubY, span } lit renders of each rotor, made once by the presenter (or null)
};
