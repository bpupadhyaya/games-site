// ARCFORGE brand pieces, kept to the frame and furniture: a small themed lockup on the title screen and a quiet line on the result screen.
// Never over the court, never in the game's own palette. main.js loads the two PNGs and hands them over (this module stays DOM-free).
const UI = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
let af = null, lockup = null;
export const setLogo = (img) => { af = img; };
export const setLockup = (img) => { lockup = img; };
const has = (i) => !!(i && i.width);

// The themed lockup (AF icon + ARCFORGE + WORLD HERITAGE GAMES), drawn small and quiet. h = its height; (cx, y) = centre x and top.
export function drawLockup(ctx, cx, y, h, alpha = 0.9) {
  if (!has(lockup)) return null;
  const w = h * lockup.width / lockup.height;
  ctx.save(); ctx.globalAlpha = alpha; ctx.drawImage(lockup, cx - w / 2, y, w, h); ctx.restore();
  return { x: cx - w / 2, y, w, h };
}

// A quiet one-liner for the result screen: badge + "More heritage games in Arcforge". y = text centre line.
export function drawMoreLine(ctx, x, y, size) {
  ctx.save(); ctx.font = `600 ${size}px ${UI}`; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  const str = 'More heritage games in Arcforge', w = ctx.measureText(str).width, bs = size * 1.7, total = (has(af) ? bs + size * 0.5 : 0) + w;
  let cx = x - total / 2;
  if (has(af)) {
    ctx.globalAlpha = 0.9; ctx.beginPath(); ctx.roundRect(cx, y - bs / 2, bs, bs, bs * 0.22); ctx.clip(); ctx.drawImage(af, cx, y - bs / 2, bs, bs);
    ctx.restore(); ctx.save(); ctx.font = `600 ${size}px ${UI}`; ctx.textBaseline = 'middle'; ctx.textAlign = 'left'; cx += bs + size * 0.5;
  }
  ctx.fillStyle = 'rgba(255,238,200,0.78)'; ctx.fillText(str, cx, y); ctx.restore();
}
