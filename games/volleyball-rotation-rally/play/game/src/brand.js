// ARCFORGE brand pieces in one small module (same API idea as the Tiger and Goat / Golden Sling ones).
// The brand lives only in the FRAME and FURNITURE: a small quiet lockup on the title screen and a one-line credit on the result screen,
// never over the court and never in the game's own colours. main.js loads the two images and hands them over (this module stays DOM-free).
const UI = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
let logo = null, lockup = null;
export const setLogo = (img) => { logo = img; };
export const setLockup = (img) => { lockup = img; };
const ok = (i) => !!(i && i.width);

// The themed lockup (AF icon + ARCFORGE + WORLD HERITAGE GAMES), drawn `w` units wide, centred on cx, top edge y. Returns its height (0 if not loaded).
export function drawLockup(ctx, cx, y, w, alpha = 0.85) {
  if (!ok(lockup)) return 0;
  const h = w * lockup.height / lockup.width;
  ctx.save(); ctx.globalAlpha = alpha; ctx.drawImage(lockup, cx - w / 2, y, w, h); ctx.restore();
  return h;
}
export const lockupHeight = (w) => (ok(lockup) ? w * lockup.height / lockup.width : 0);

// A quiet one-liner for the result screen: AF badge + "More heritage games in Arcforge". y = text centre line.
export function drawMoreLine(ctx, x, y, size) {
  ctx.save(); ctx.font = `600 ${size}px ${UI}`; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  const str = 'More heritage games in Arcforge', w = ctx.measureText(str).width, bs = size * 1.7, total = (ok(logo) ? bs + size * 0.5 : 0) + w;
  let cx = x - total / 2;
  if (ok(logo)) {
    ctx.save(); ctx.globalAlpha = 0.9; ctx.beginPath(); ctx.roundRect(cx, y - bs / 2, bs, bs, bs * 0.22); ctx.clip(); ctx.drawImage(logo, cx, y - bs / 2, bs, bs); ctx.restore();
    cx += bs + size * 0.5;
  }
  ctx.fillStyle = 'rgba(255,246,228,0.72)'; ctx.fillText(str, cx, y); ctx.restore();
}
