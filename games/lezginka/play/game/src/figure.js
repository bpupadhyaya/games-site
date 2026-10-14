// Draws the dancers: the real 3D people (main.js installs globalThis.__lez3d) when they are ready, the flat 2D rig in art.js otherwise
// (no WebGL2, a failed load, a lost context, the first moments while the models load, or ?fig=2d).
import { drawDancer, drawShadow, LOOKS } from './art.js';

/** entries: back-to-front list of { x, footY, H, k (size vs the lead), look (key of LOOKS), P (poseAt), ph, sh (shadow width in H), sa (shadow alpha) };
 *  entries[0] is the lead. Shadows are 2D (under the people); `t` is the display time in seconds. */
export function drawPeople(ctx, entries, t, calm) {
  for (const e of entries) drawShadow(ctx, e.x, e.footY - (e.dyShadow || 0), e.H * (e.sh ?? 0.2), e.sa ?? 0.35);
  const f3 = globalThis.__lez3d;
  let done = null;
  if (f3 && f3.draw) {
    // the lead goes first in the list the 3D layer receives (it sets the scale); the rest keep their order
    const lead = entries.reduce((a, b) => (b.k || 1) > (a.k || 1) ? b : a, entries[0]);
    const list = [lead, ...entries.filter((e) => e !== lead)];
    try { done = f3.draw(ctx, list, t, calm); } catch (err) { console.warn('3D dancers failed, using the 2D picture', err); globalThis.__lez3d = null; done = null; }
  }
  for (const e of entries) if (!done || !done.has(e)) drawDancer(ctx, e.x, e.footY, e.H, e.P, LOOKS[e.look], { ph: e.ph || 0 });
}
