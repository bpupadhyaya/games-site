// ARCFORGE brand pieces in ONE small module (same API as Tiger and Goat / Golden Sling). The rule: the brand lives only in the FRAME and
// FURNITURE (a small themed lockup on the title screen, a quiet line on the result card), never over gameplay and never in the game's palette.
//   main.js   loads web/brand/arcforge-lockup.png (setLockup) and arcforge-af.png (setLogo); this module stays DOM-free.
//   view.js   drawLockup(ctx, cx, y, w)   the game's themed lockup picture, centred on cx, top at y, w wide (nothing if not loaded yet)
//             drawMoreLine(ctx, x, y, size)  badge + "More heritage games in Arcforge" (result card); y = text centre line
const UI = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
let logo = null, lockup = null;
export const setLogo = (img) => { logo = img; };
export const setLockup = (img) => { lockup = img; };
const has = (i) => !!(i && i.width);

export function drawLockup(ctx, cx, y, w0, alpha = 0.92, down = false) {
  if (!has(lockup)) return;
  const h0 = w0 * lockup.height / lockup.width, k = down ? 0.95 : 1, w = w0 * k, h = h0 * k, x = cx - w / 2, yy = y + (h0 - h) / 2, pad = h * 0.16;
  ctx.save(); ctx.globalAlpha = down ? 0.7 : 0.9; ctx.fillStyle = 'rgba(14,8,2,0.7)';
  ctx.beginPath(); ctx.roundRect(x - pad * 1.5, yy - pad, w + pad * 3, h + pad * 2, h * 0.5); ctx.fill(); ctx.restore();
  ctx.save(); ctx.globalAlpha = down ? 0.8 : 1; ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = h * 0.06; ctx.drawImage(lockup, x, yy, w, h); ctx.restore();
}

export function drawMoreLine(ctx, x, y, size) {
  ctx.save(); ctx.font = `600 ${size}px ${UI}`; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  const str = 'More heritage games in Arcforge', w = ctx.measureText(str).width, bs = size * 1.7, total = (has(logo) ? bs + size * 0.5 : 0) + w;
  let cx = x - total / 2;
  if (has(logo)) {
    ctx.save(); ctx.globalAlpha = 0.9; ctx.beginPath(); ctx.roundRect(cx, y - bs / 2, bs, bs, bs * 0.22); ctx.clip(); ctx.drawImage(logo, cx, y - bs / 2, bs, bs); ctx.restore();
    cx += bs + size * 0.5;
  }
  ctx.fillStyle = 'rgba(246,236,214,0.66)'; ctx.fillText(str, cx, y); ctx.restore();
}

// A small stacked mark (AF badge over the ARCFORGE wordmark) for the empty bottom of a side card. `w` = the width it may use. Quiet: never over play.
export function drawBadgeStack(ctx, cx, bottomY, w) {
  if (!has(logo)) return;
  ctx.save(); ctx.globalAlpha = 0.85;
  const bs = Math.min(54, w * 0.45);
  ctx.beginPath(); ctx.roundRect(cx - bs / 2, bottomY - bs - 22, bs, bs, bs * 0.22); ctx.clip(); ctx.drawImage(logo, cx - bs / 2, bottomY - bs - 22, bs, bs);
  ctx.restore();
  ctx.save(); ctx.font = `800 17px ${UI}`; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(246,226,170,0.8)'; ctx.fillText('ARCFORGE', cx, bottomY - 4); ctx.restore();
}
