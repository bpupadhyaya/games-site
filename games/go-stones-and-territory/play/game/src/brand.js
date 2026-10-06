// ARCFORGE brand pieces (same API as the Tiger and Goat / Golden Sling module). The brand lives only in the FRAME and FURNITURE:
// a small credit lockup under the title board, a quiet line on the result screen. Never over the board, never in the game's palette.
//   main.js creates the images (brand/arcforge-af.png, brand/arcforge-lockup.png) and calls setLogo / setLockup when they load.
//   drawLockup(ctx, cx, y, w, alpha)   the themed lockup image (AF icon + ARCFORGE + WORLD HERITAGE GAMES), w = its width, y = top
//   drawMoreLine(ctx, x, y, size)      AF badge + "More heritage games in Arcforge"; y = text centre line
const UI = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
let logo = null, lockup = null;
export const setLogo = (img) => { logo = img; };
export const setLockup = (img) => { lockup = img; };
const has = (i) => !!(i && i.width);

export function drawBadge(ctx, cx, cy, size, alpha = 1) {
  if (!has(logo)) return;
  ctx.save(); ctx.globalAlpha = alpha;
  ctx.beginPath(); ctx.roundRect(cx - size / 2, cy - size / 2, size, size, size * 0.22); ctx.clip();
  ctx.drawImage(logo, cx - size / 2, cy - size / 2, size, size); ctx.restore();
}

// The lockup image is 1200 x 327. Returns its height (0 when the image has not loaded: nothing is drawn and nothing is reserved).
export function drawLockup(ctx, cx, y, w, alpha = 0.92) {
  if (!has(lockup)) return 0;
  const h = w * (327 / 1200);
  ctx.save(); ctx.globalAlpha = alpha; ctx.drawImage(lockup, cx - w / 2, y, w, h); ctx.restore();
  return h;
}

export function drawMoreLine(ctx, x, y, size, maxW = 1e9) {
  ctx.save(); ctx.font = `600 ${size}px ${UI}`; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  const str = 'More heritage games in Arcforge';
  while (size > 15 && (ctx.measureText(str).width + (has(logo) ? size * 2.2 : 0)) > maxW) { size -= 1; ctx.font = `600 ${size}px ${UI}`; }
  const w = ctx.measureText(str).width, bs = size * 1.7, total = (has(logo) ? bs + size * 0.5 : 0) + w;
  let cx = x - total / 2;
  if (has(logo)) { drawBadge(ctx, cx + bs / 2, y, bs, 0.9); cx += bs + size * 0.5; }
  ctx.fillStyle = 'rgba(246,227,180,0.72)'; ctx.fillText(str, cx, y); ctx.restore();
}
