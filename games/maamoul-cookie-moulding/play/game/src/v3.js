// Hand-off between the 2D screens (view.js, art.js, ui.js) and the optional 3D presenter (view3d/presenter.js).
// The simulation never reads this. `on` is flipped by the presenter only while a WebGL context is alive and the scene is built:
// with it off every screen draws exactly as before (the flat 2D fallback). With it on the art functions do not paint, they
// record WHAT to show (a cookie, a mould, a tray, a plaque ...) and WHERE (virtual units), and the presenter draws real lit,
// shadowed 3D objects behind the transparent 2D canvas, which keeps drawing text, icons and hit areas.
export const v3 = {
  on: false,
  raw: false,          // presenter sets it while it paints texture canvases with the original 2D art functions
  items: [],           // recorded this frame, bottom to top
  layer: 0,            // 0 = world, 1 = overlays (pause card, banners): drawn above the scrim
  scrim: 0,            // 0..1 dimming drawn in 3D between the layers
  clip: null,          // active clip rect in screen units (scroll bodies, figure frames)
  base: null,          // ctx transform at the start of the frame
  pressed: null,       // { x, y } while the pointer is down (lacquered buttons sink)
  ev: [],              // { type, x, y, q } one-shot effects the presenter turns into steam, flour and sparks
  heat: 0,             // 0..1 oven heat shown by the play screen (warms the light spilling from the oven)
};

export function active() { return v3.on && !v3.raw; }

// Record an item at the current canvas offset (scroll translate) with the current clip and alpha.
export function put(ctx, item) {
  let dx = 0, dy = 0;
  const b = v3.base;
  if (b) { const m = ctx.getTransform(); dx = (m.e - b.e) / (b.a || 1); dy = (m.f - b.f) / (b.d || 1); }
  item.dx = dx; item.dy = dy; item.layer = v3.layer; item.clip = v3.clip; item.alpha = ctx.globalAlpha;
  v3.items.push(item);
}

export function withClip(rect, fn) {
  const was = v3.clip;
  let r = rect;
  if (was && rect) { const x0 = Math.max(was.x, rect.x), y0 = Math.max(was.y, rect.y), x1 = Math.min(was.x + was.w, rect.x + rect.w), y1 = Math.min(was.y + was.h, rect.y + rect.h); r = { x: x0, y: y0, w: Math.max(0, x1 - x0), h: Math.max(0, y1 - y0) }; }
  v3.clip = r;
  try { return fn(); } finally { v3.clip = was; }
}
