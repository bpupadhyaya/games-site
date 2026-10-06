// ARCFORGE brand pieces, discreet: a small themed lockup on the title screen and a quiet "More heritage games in Arcforge" line on the
// result card. The brand lives only in the frame, never in the game's own palette or art.
const UI = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
let logo = null, lockup = null;
export const setLogo = (img) => { logo = img; };
export const setLockup = (img) => { lockup = img; };

// The themed lockup (AF icon + ARCFORGE + WORLD HERITAGE GAMES) drawn small and quiet inside rect r (aspect 1200:327).
export function drawLockup(ctx, r0, down = false) {
  if (!r0 || !(lockup && lockup.width)) return;
  const k = down ? 0.95 : 1, w = r0.w * k, h = r0.h * k, x = r0.x + (r0.w - w) / 2, y = r0.y + (r0.h - h) / 2, pad = h * 0.16;
  ctx.save(); ctx.globalAlpha = down ? 0.7 : 0.9; ctx.fillStyle = 'rgba(10,6,4,0.7)';
  ctx.beginPath(); ctx.roundRect(x - pad * 1.5, y - pad, w + pad * 3, h + pad * 2, h * 0.5); ctx.fill(); ctx.restore();
  ctx.save(); ctx.globalAlpha = down ? 0.8 : 1; ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = h * 0.06; ctx.drawImage(lockup, x, y, w, h); ctx.restore();
}

// A quieter one-liner for result screens: badge + "More heritage games in Arcforge".
export function drawMoreLine(ctx, x, y, size) {
  ctx.save(); ctx.font = `600 ${size}px ${UI}`; ctx.direction = 'ltr';
  const str = 'More heritage games in Arcforge', w = ctx.measureText(str).width, bs = size * 1.7, has = logo && logo.width, total = (has ? bs + size * 0.5 : 0) + w;
  let cx = x - total / 2;
  if (has) {
    ctx.save(); ctx.beginPath(); ctx.roundRect(cx, y - size * 0.32 - bs / 2, bs, bs, bs * 0.22); ctx.clip();
    ctx.drawImage(logo, cx, y - size * 0.32 - bs / 2, bs, bs); ctx.restore(); cx += bs + size * 0.5;
  }
  ctx.fillStyle = 'rgba(246,223,174,0.7)'; ctx.textAlign = 'left'; ctx.fillText(str, cx, y); ctx.restore();
}
