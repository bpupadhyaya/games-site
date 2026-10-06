// ARCFORGE brand pieces, kept in the FRAME and FURNITURE only: the themed lockup under the title art and a quiet line on
// the result screen. Never over gameplay, never in the game's own palette. DOM-free: main.js loads the two images and
// hands them over with setLogo / setLockup; without them everything below simply draws nothing or text only.
const UI = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
let logo = null, lockup = null;
export const setLogo = (img) => { logo = img; };
export const setLockup = (img) => { lockup = img; };
const ok = (i) => !!(i && i.width);

// The themed lockup PNG (AF icon + ARCFORGE + WORLD HERITAGE GAMES), small and quiet. cx = centre x, y = top, w = width.
// Returns the height drawn (0 when the image has not loaded).
export function drawLockupImage(ctx, cx, y, w, alpha = 0.9) {
  if (!ok(lockup)) return 0;
  const h = Math.round(w * lockup.height / lockup.width);
  ctx.save(); ctx.globalAlpha = alpha; ctx.drawImage(lockup, Math.round(cx - w / 2), y, w, h); ctx.restore();
  return h;
}
export const lockupHeight = (w) => (ok(lockup) ? Math.round(w * lockup.height / lockup.width) : 0);

function drawBadge(ctx, cx, cy, size, alpha = 1) {
  if (!ok(logo)) return;
  ctx.save(); ctx.globalAlpha = alpha;
  ctx.beginPath(); ctx.roundRect(cx - size / 2, cy - size / 2, size, size, size * 0.22); ctx.clip();
  ctx.drawImage(logo, cx - size / 2, cy - size / 2, size, size); ctx.restore();
}

// A quiet one-liner for the result screen: badge + "More heritage games in Arcforge". y = text centre line.
export function drawMoreLine(ctx, x, y, size) {
  ctx.save(); ctx.font = `600 ${size}px ${UI}`; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  const str = 'More heritage games in Arcforge', w = ctx.measureText(str).width, bs = size * 1.7, total = (ok(logo) ? bs + size * 0.5 : 0) + w;
  let cx = x - total / 2;
  if (ok(logo)) { drawBadge(ctx, cx + bs / 2, y, bs, 0.9); cx += bs + size * 0.5; }
  ctx.fillStyle = 'rgba(255,238,200,0.78)'; ctx.fillText(str, cx, y); ctx.restore();
}
