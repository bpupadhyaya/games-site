// A small still of the seesaw (bale, board, two girls) in any rectangle: used by the Rules book, the title screen and the course cards.
import { drawBale, drawBoard, boardPoints, drawScene, BOARD } from './art.js';
import { drawGirl, POSES } from './figure.js';

export const TILT = 0.17;

// cfg: { tilt (+ right end down), left: {pose, lift (m)}, right: {pose, lift (m)}, t, scale }
export function drawMini(ctx, r, cfg = {}) {
  const t = cfg.t ?? 0, a = cfg.tilt ?? 0;
  const spanM = 3.3, hM = 2.5 + (cfg.maxLift ?? Math.max(cfg.left?.lift ?? 0, cfg.right?.lift ?? 0));
  const s = Math.min(r.w / spanM, r.h / hM);
  const cam = { pivotX: r.x + r.w / 2, groundY: r.y + r.h - 0.06 * s, s };
  if (cfg.backdrop) drawScene(ctx, cfg.backdrop.w, cfg.backdrop.h, t, cam, cfg.backdrop.setting, cfg.backdrop.excite ?? 0.2);
  else { ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.beginPath(); ctx.ellipse(cam.pivotX, cam.groundY + 0.03 * s, 1.9 * s, 0.1 * s, 0, 0, Math.PI * 2); ctx.fill(); }
  drawBale(ctx, cam.pivotX, cam.groundY, s);
  const pads = cfg.pads ?? ['#cf2a50', '#2468b4'];
  drawBoard(ctx, cam, a, pads);
  const bp = boardPoints(cam, a);
  const sides = [['left', cfg.left, 1, 0], ['right', cfg.right, -1, 1]];
  const f3 = globalThis.__girls3d;
  const list = [];
  for (const [k, g, face, outfit] of sides) {
    if (!g || g.hide) continue;
    const pose = POSES[g.pose ?? 'stand'];
    const base = bp[k], lift = (g.lift ?? 0) * s;
    list.push({ who: outfit, x: base.x, y: base.y - lift, s, face, air: !!pose.air, vy: pose.vy ?? 0, arm: pose.arm, crouch: g.crouch ?? pose.crouch, land: pose.land ?? 0, open: pose.open ?? 0, tilt: a });
    list[list.length - 1].g2 = { x: base.x, y: base.y - lift, s: s * 0.98, face, outfit, t, ...pose, crouch: g.crouch ?? pose.crouch };
  }
  // real 3D girls when the presentation layer is ready (main.js), the 2D figures otherwise
  const done = f3 && f3.draw && !f3.off && list.length
    ? f3.draw(ctx, { x: r.x - r.w * 0.1, y: r.y - r.h * 0.45, w: r.w * 1.2, h: r.h * 1.45 }, list, t) : false;
  if (!done) for (const it of list) drawGirl(ctx, it.g2);
  return cam;
}
export { BOARD };
