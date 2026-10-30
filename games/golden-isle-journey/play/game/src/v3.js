// Plain-data hand-off between the 2D scenes and the optional lit 3D layer (web/view3d/presenter.js).
// Nothing here touches the DOM, the sim or randomness: when the 3D layer is ready, the painted sky / sun / stars / sea
// calls in stage.js RECORD what they would have drawn (in screen fractions) instead of painting it, and the presenter
// renders the same composition as a real sky, a lit ocean and a 3D golden island behind the transparent kit canvas.
// Without WebGL2 (or with ?flat=1, or while the GL context is lost) `ready` stays false and every scene paints as before.

export const v3 = {
  ready: false,     // the presenter is live (set by presenter.js only)
  mix: 0,           // 0..1 crossfade: the 2D layers draw at (1 - mix) while the 3D layer fades in
  capture: false,   // set per frame by game.render: this scene's backdrop fills the whole screen
  rec: null,        // this frame's record (see begin())
};

export function begin(capture) {
  v3.capture = !!capture;
  v3.rec = { sky: null, sky2: null, sun: null, stars: null, sea: null, island: null, moon: null };
}

export const on = () => v3.ready && v3.capture && v3.rec !== null;

// design point -> fraction of the canvas (x right, y down)
export function pt(ctx, x, y) {
  const m = ctx.getTransform(), c = ctx.canvas;
  return [(m.a * x + m.c * y + m.e) / c.width, (m.b * x + m.d * y + m.f) / c.height];
}
// a design length -> fraction of the canvas height
export function len(ctx, d) { const m = ctx.getTransform(); return (Math.hypot(m.a, m.b) * d) / ctx.canvas.height; }

// The golden island on the horizon (title, the flight over the sea, the bridge): x, y = base centre, w = width (design units).
export function island(ctx, x, y, w, glow = 1) {
  if (!on()) return false;
  const [px, py] = pt(ctx, x, y);
  v3.rec.island = { x: px, y: py, w: len(ctx, w) , glow: glow * ctx.globalAlpha };
  return true;
}

// Draw the painted stand-in of something the 3D layer now shows: fully when the layer is off, fading out while it fades in.
export function painted(ctx, shownIn3D, draw) {
  if (!shownIn3D) return draw();
  if (v3.mix >= 0.999) return;
  ctx.save(); ctx.globalAlpha *= 1 - v3.mix; draw(); ctx.restore();
}
