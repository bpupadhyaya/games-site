// ARCFORGE brand pieces, kept small and quiet: the brand lives only in the frame (a lockup on the title screen, one line on the
// result screen), never in the game's own palette or art. main.js creates the Images and calls setLogo / setLockup, so this
// module stays DOM-free. Both are optional: without the images the credit line still reads.
const UI = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
let logo = null, lockup = null;
export const setLogo = (img) => { logo = img; };
export const setLockup = (img) => { lockup = img; };
const ready = (im) => !!(im && im.width);

// The themed lockup (AF icon + ARCFORGE + WORLD HERITAGE GAMES) at width w, centred on cx, top at y. Returns its height.
export function drawLockup(ctx, cx, y, w, alpha = 0.85) {
  if (!ready(lockup)) return 0;
  const h = w * lockup.height / lockup.width;
  ctx.save(); ctx.globalAlpha = alpha; ctx.drawImage(lockup, cx - w / 2, y, w, h); ctx.restore();
  return h;
}

// "AF  More heritage games in Arcforge", for result screens. Baseline y, centred on x.
export function drawMoreLine(ctx, x, y, size) {
  ctx.save(); ctx.font = `600 ${size}px ${UI}`;
  const str = 'More heritage games in Arcforge', w = ctx.measureText(str).width, bs = size * 1.9, has = ready(logo), total = (has ? bs + size * 0.6 : 0) + w;
  let cx = x - total / 2;
  if (has) {
    ctx.beginPath(); ctx.roundRect(cx, y - size * 0.32 - bs / 2, bs, bs, bs * 0.22); ctx.save(); ctx.clip();
    ctx.drawImage(logo, cx, y - size * 0.32 - bs / 2, bs, bs); ctx.restore(); cx += bs + size * 0.6;
  }
  ctx.fillStyle = 'rgba(246,223,174,0.7)'; ctx.textAlign = 'left'; ctx.fillText(str, cx, y); ctx.restore();
}
