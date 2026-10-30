// Hand-off between the 2D drawing (view.js, art.js) and the optional 3D presenter (view3d/presenter.js). The simulation never reads it.
// While `on` (a live WebGL table is drawn behind the transparent kit canvas) the 2D code RECORDS the bag, tray, kegs and cards it would
// paint (with the canvas transform at that moment, so design-space and turned face-to-face drawing need no special cases) and the
// presenter builds them as lit 3D objects at the same places on screen. With `on` false every screen paints the flat 2D art as before:
// no WebGL, a lost context, ?flat=1 and the headless tests.
export const v3 = {
  on: false,
  fade: 1,          // 0..1 right after the 3D table takes over: the flat art fades out on top of it
  hold: 0,          // > 0 while a reference page draws its own little pictures (they stay 2D inside the scrolling panel)
  list: [],         // this frame's records: { kind: 'keg'|'bag'|'tray'|'card', m: [a,b,c,d,e,f] device-px transform, ... }
  cards: new Map(), // card id -> (u, v) => { x, y } device px of a point on the 3D card face (from the last 3D frame)
  pick: null,       // (sx, sy) virtual units -> { pi, ci, u, v } card under a tap, or null
  base: null,       // the kit's base transform this frame (virtual units -> device px)
};
export const recording = () => v3.on && v3.hold === 0;
// Alpha for flat art that the 3D table replaces: 1 without 3D, fading to 0 during the crossfade, then 0.
export const flatAlpha = () => (v3.on ? Math.max(0, 1 - v3.fade) : 1);
export function rec(ctx, o) {
  const t = ctx.getTransform();
  o.m = [t.a, t.b, t.c, t.d, t.e, t.f];
  v3.list.push(o);
}
