// Hand-off between the 2D screens and the optional 3D presenter (web/view3d/presenter.js). The simulation never reads this.
// `on` is true only while a WebGL scene is alive and drawn behind the kit canvas; with it off every screen draws exactly as before
// (the flat 2D art is the fallback for no WebGL, a lost context, ?flat=1 and the headless tests).
// Each frame the 2D code records the duel it would have drawn (`job`): which sim, which conkers, and where the world maps on the kit
// canvas (pixel origin of world x = 0, y = 0, pixels per metre, mirror), read from the live canvas transform so scroll offsets,
// the shake and the frame scale are all included. The presenter draws that duel in 3D, in exactly the same place.
export const v3 = {
  on: false,
  fade: 1,      // 0..1 right after the 3D scene takes over: the flat art fades out on top of it (crossfade)
  job: null,    // the duel to draw this frame (set by recordDuel, cleared by the presenter before each frame)
};
// Alpha for the flat backdrop/duel layers: 1 without 3D, fading to 0 during the crossfade, then 0.
export const flatAlpha = () => (v3.on ? Math.max(0, 1 - v3.fade) : 1);

// cam: a scene.js camera; kind: 'play' | 'title'
export function recordDuel(ctx, cam, sim, conkers, sSide, o = {}, parts = null, kind = 'play') {
  if (!v3.on) return;
  const m = ctx.getTransform(), mirror = !!cam.mirror;
  const ox = m.a * cam.X(0) + m.e, oy = m.d * cam.Y(0) + m.f;
  v3.job = { kind, sim, conkers, sSide, mirror, ox, oy, k: cam.k * m.a, rect: { x: m.a * cam.rect.x + m.e, y: m.d * cam.rect.y + m.f, w: m.a * cam.rect.w, h: m.d * cam.rect.h }, flash: o.flash || 0, glowS: o.glowS || 0, parts };
}
