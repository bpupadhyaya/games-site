// Draw a few cyclists as real 3D riders on bikes (web/view3d/riders.js, installed by main.js as globalThis.__riders3d) with the 2D rider as the
// fallback (no WebGL2, still loading, context lost, or ?fig=2d). Presentation only.
import { drawCyclist } from './art.js';

const mixHex = (a, b, t) => {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16)), pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return '#' + pa.map((v, i) => Math.round(v + (pb[i] - v) * t).toString(16).padStart(2, '0')).join('');
};
export const frameFor = (jersey) => mixHex(jersey, '#0c0d10', 0.2);

/**
 * list: [{ x, y (ground under the bike's bottom bracket), tilt, phase, spin, pose (0 hoods, 1 low, 2 out of the saddle), jersey, trim, helmet, skin, row, yawOff }]
 * rc: the region (in the current ctx coordinates) the 3D picture covers; k: pixels per metre.
 */
export function drawPack(ctx, rc, list, k, t, tone = 'morning') {
  const f3 = globalThis.__riders3d;
  const ok = f3 && f3.draw && list.length <= f3.max;
  if (ok) {
    const items = list.map((o, i) => ({ id: i, x: o.x, y: o.y, z: o.row ?? 0, tilt: o.tilt ?? 0, phase: o.phase, spin: o.spin, pose: o.pose, jersey: o.jersey, trim: o.trim, helmet: o.helmet, skin: o.skin,
      frame: frameFor(o.jersey), yawOff: o.yawOff, lookKey: `${o.jersey}|${o.skin}` }));
    for (const o of list) { ctx.save(); ctx.globalAlpha = 0.28; ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(o.x + 0.02 * k, o.y + 2, 0.95 * k, k * 0.075, -(o.tilt ?? 0), 0, 6.283); ctx.fill(); ctx.restore(); }
    if (f3.draw(ctx, rc, items, k, t, tone)) return true;
  }
  for (const o of list) drawCyclist(ctx, o.x - 0.5 * k, o.y, o.tilt ?? 0, { k, phase: o.phase, spin: o.spin, pose: o.pose, jersey: o.jersey, trim: o.trim, helmet: o.helmet, skin: o.skin, skinFar: '#3b2417' });
  return false;
}
