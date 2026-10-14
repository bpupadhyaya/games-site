// Hand-off between the 2D interface layer (ui.js, art.js, view.js, playview.js) and the optional 3D presenter (view3d/presenter.js).
// The simulation never reads this. `on` is true only while a WebGL context is alive and the scene is ready; with it off every screen
// draws exactly the flat 2D art (the fallback). With it on the 2D layer draws only text and touch feedback and REPORTS panels, buttons,
// the instrument, playing spots, notes, mallets, stars and particles here; the presenter renders them as lit 3D objects behind the text.
export const v3 = {
  on: false,
  mute: false,          // while true the 2D layer draws no text (a modal sits over the screen; the 3D scrim dims what is under it)
  calm: false,          // reduced motion preference
  scene: 'title',
  items: [],            // ordered: { t: 'panel' | 'button' | 'inst' | 'stars' | 'scrim', ... }
  spots: [],            // { x, y, r, side, glow, flash }
  notes: [],            // { x, y, r, side, kind, k, alpha, flash, hold, ghost, blind }
  mallets: [],          // { x, y, side, grip, across, down, glow, scale, alpha }
  parts: null,          // the particle list of this frame (pl.parts / f.parts)
  pressed: null,        // { x, y } while the pointer is down
  base: null,           // the kit's frame transform (DOMMatrix) captured before the screen draws; lets reports made under ctx.translate() be mapped back
  hero: false,
  reset() { this.items.length = 0; this.spots.length = 0; this.notes.length = 0; this.mallets.length = 0; this.parts = null; this.mute = false; },
  // a rect / point drawn under the current ctx transform, expressed in the kit's virtual units
  rel(ctx, r) {
    const b = this.base; if (!b || !ctx.getTransform) return r;
    const m = ctx.getTransform(), k = 1 / b.a;
    return { x: (m.a * r.x + m.e - b.e) * k, y: (m.d * r.y + m.f - b.f) * k, w: (r.w ?? 0) * m.a * k, h: (r.h ?? 0) * m.d * k };
  },
  // the (single) entry of an instrument this frame, created on first mention
  inst(inst) {
    for (let i = this.items.length - 1; i >= 0; i--) { const it = this.items[i]; if (it.t === 'inst' && it.inst.key === inst.key) return it; }
    const e = { t: 'inst', inst, ss: null, focus: null, hot: null };
    this.items.push(e); return e;
  },
};
