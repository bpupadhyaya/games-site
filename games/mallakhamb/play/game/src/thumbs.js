// Move cards: a clean 3D render of each pose (one per pose, cached), with the flat silhouette from the 2D rig as the fallback while the
// 3D layer loads or when WebGL2 is unavailable.
import { fitFigure, POSES } from './figure.js';

const cache = new Map();
let made = 0;
export const resetThumbBudget = () => { made = 0; };

export function fitPose(ctx, name, rect, o = {}) {
  const pose = POSES[name];
  const f = globalThis.__figure3d;
  if (pose && f && f.thumb && !f.lost) {
    let c = cache.get(name);
    if (!c && made < 1) { c = f.thumb(pose, 256); if (c) { cache.set(name, c); made++; } }
    if (c) {
      const s = Math.min(rect.w, rect.h) * 1.1;
      ctx.drawImage(c, rect.x + (rect.w - s) / 2, rect.y + (rect.h - s) / 2, s, s);
      return;
    }
  }
  fitFigure(ctx, pose ?? POSES.salute, rect, o);
}
