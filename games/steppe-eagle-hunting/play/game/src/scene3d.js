// The 2D side of the 3D picture: asks the presenter (web/view3d/steppe3d.js, put on globalThis.__steppe3d by main.js) to draw the hunting
// ground and blits it behind the HUD. Everything here is a no-op when the 3D layer is missing, so the flat 2D art takes over.
import { FR } from './layout.js';
import { use3d } from './cam3d.js';

export const scene3d = () => (use3d() ? globalThis.__steppe3d : null);
const budget = { low: 0.8e6, medium: 1.5e6, high: 2.6e6 };
let slow = 0, fast = 0;

// s: { mode: 'play'|'menu', t, cam, h, plum, level, wind, glove: {x, y}, perchYaw }
export function draw3d(ctx, F, s) {
  const tr = ctx.getTransform();
  let wPx = Math.max(2, Math.round(FR.w * Math.hypot(tr.a, tr.b))), hPx = Math.max(2, Math.round(FR.h * Math.hypot(tr.c, tr.d)));
  const cap = budget[F.quality] || budget.medium;
  if (wPx * hPx > cap) { const k = Math.sqrt(cap / (wPx * hPx)); wPx = Math.round(wPx * k); hPx = Math.round(hPx * k); }
  F.size(wPx, hPx);
  const view = F.frame({ ...s, W: FR.w, H: FR.h });
  if (!F.render()) return null;
  ctx.drawImage(F.canvas, 0, 0, FR.w, FR.h);
  // adaptive quality: a sustained slow render drops a tier (never back up in the same session)
  if (F.cost.n > 30) {
    if (F.cost.ema > 24) { slow++; fast = 0; } else if (F.cost.ema < 14) { fast++; slow = 0; }
    if (slow > 90 && F.quality !== 'low') { F.setQuality(F.quality === 'high' ? 'medium' : 'low'); slow = 0; F.cost.n = 0; }
  }
  return view;
}
