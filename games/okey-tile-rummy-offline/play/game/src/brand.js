// Arcforge brand pieces, kept quiet: the themed lockup (small, on the title screen only) and a one-line "More heritage games" on the
// result screen. Never over gameplay, never recolours the game. main.js loads the images and calls setLogo / setLockup.
const UI = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
let logo = null, lockup = null;
export const setLogo = (img) => { logo = img; };
export const setLockup = (img) => { lockup = img; };

// the themed lockup (AF icon + ARCFORGE + WORLD HERITAGE GAMES) fitted into rect r, centred
export function drawLockup(ctx, r, alpha = 0.9) {
  if (!(lockup && lockup.width)) return false;
  const k = Math.min(r.w / lockup.width, r.h / lockup.height), w = lockup.width * k, h = lockup.height * k;
  ctx.save(); ctx.globalAlpha = alpha; ctx.drawImage(lockup, r.x + (r.w - w) / 2, r.y + (r.h - h) / 2, w, h); ctx.restore();
  return true;
}
// badge + "More heritage games in Arcforge", centred on x, baseline y
export function drawMoreLine(ctx, x, y, size) {
  ctx.save(); ctx.font = `600 ${size}px ${UI}`;
  const str = 'More heritage games in Arcforge', w = ctx.measureText(str).width, bs = size * 1.9, has = logo && logo.width, total = (has ? bs + size * 0.6 : 0) + w;
  let cx = x - total / 2;
  if (has) {
    ctx.save(); ctx.beginPath(); ctx.roundRect(cx, y - size * 0.32 - bs / 2, bs, bs, bs * 0.22); ctx.clip(); ctx.drawImage(logo, cx, y - size * 0.32 - bs / 2, bs, bs); ctx.restore();
    cx += bs + size * 0.6;
  }
  ctx.fillStyle = 'rgba(246,223,174,0.7)'; ctx.textAlign = 'left'; ctx.fillText(str, cx, y); ctx.restore();
  return total;
}
