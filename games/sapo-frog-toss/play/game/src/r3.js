// The hand-off between the 2D art and the optional 3D layer. Pure data, no DOM. When `on` is true the 2D scene functions do not paint
// the room, table, frog or discs; they record what the 3D presenter needs (screen transform, clip, discs) and the presenter draws it
// with the SAME pinhole camera as src/scene.js (CAM), so every 2D overlay and every touch maps exactly as before.
export const r3 = {
  on: false, drawn: false, m: null, cw: 1, ch: 1, clipPx: null, t: 0, discs: [], flash: null,
  // remember the pixel rectangle of the scene (in the current canvas transform)
  clip(ctx, x, y, w, h) {
    if (!this.on) return;
    const m = ctx.getTransform();
    this.clipPx = { x: m.a * x + m.e, y: m.d * y + m.f, w: m.a * w, h: m.d * h };
  },
  begin(ctx, t) {
    this.drawn = true; this.m = ctx.getTransform(); this.cw = ctx.canvas.width; this.ch = ctx.canvas.height; this.t = t; this.discs = []; this.flash = null;
  },
};
