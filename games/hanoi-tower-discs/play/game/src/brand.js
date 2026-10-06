// Discreet Arcforge brand pieces: the themed lockup, small and quiet on the title screen, and a quiet "more games" line on the result card.
// main.js loads the images (this module stays DOM-free) and hands them over with setLockup / setLogo.
import { host } from './layout.js';
let lockup = null, logo = null;
export const setLockup = (img) => { lockup = img; };
export const setLogo = (img) => { logo = img; };

// The themed lockup centred on (cx, cy), `h` units tall, at low opacity so it never competes with the game.
export function drawLockup(ctx, cx, cy, h, alpha = 0.95) {
  if (!(lockup && lockup.width)) return;
  const w = (lockup.width / lockup.height) * h;
  ctx.save(); ctx.globalAlpha = alpha;
  ctx.drawImage(lockup, cx - w / 2, cy - h / 2, w, h);
  ctx.restore();
}

export function drawMoreLine(ctx, x, y, size) {
  size = Math.max(size, 11 / host.px);
  ctx.save();
  ctx.font = `600 ${size}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
  const str = 'More heritage games in Arcforge', w = ctx.measureText(str).width, has = logo && logo.width, bs = size * 1.7, total = (has ? bs + size * 0.5 : 0) + w;
  let cx = x - total / 2;
  if (has) { ctx.save(); ctx.beginPath(); ctx.roundRect(cx, y - size * 1.15, bs, bs, bs * 0.22); ctx.clip(); ctx.drawImage(logo, cx, y - size * 1.15, bs, bs); ctx.restore(); cx += bs + size * 0.5; }
  ctx.fillStyle = 'rgba(246,223,174,0.7)'; ctx.textAlign = 'left'; ctx.fillText(str, cx, y);
  ctx.restore();
}
