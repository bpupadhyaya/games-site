// ARCFORGE brand pieces (discreet, never over gameplay, never recolouring the game). Same pattern as Tiger and Goat / Golden Sling.
// main.js loads web/brand/arcforge-af.png (the real app icon) and web/brand/arcforge-lockup.png (this game's themed lockup).
const UI = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
let logo = null, lockup = null;
export const setLogo = (img) => { logo = img; };
export const setLockup = (img) => { lockup = img; };

// The themed lockup, small and quiet, centred on (cx, cy) at width w.
export function drawLockup(ctx, cx, cy, w, alpha = 0.8) {
  if (!(lockup && lockup.width)) return false;
  const h = w * (lockup.height / lockup.width);
  ctx.save(); ctx.globalAlpha = alpha; ctx.drawImage(lockup, cx - w / 2, cy - h / 2, w, h); ctx.restore();
  return true;
}

// A quieter one-liner for result screens: AF badge + "More heritage games in Arcforge".
export function drawMoreLine(ctx, x, y, size) {
  ctx.save(); ctx.font = `600 ${size}px ${UI}`;
  const str = 'More heritage games in Arcforge', w = ctx.measureText(str).width, bs = size * 1.9, has = logo && logo.width, total = (has ? bs + size * 0.6 : 0) + w;
  let cx = x - total / 2;
  if (has) { ctx.save(); ctx.beginPath(); ctx.roundRect(cx, y - size * 0.32 - bs / 2, bs, bs, bs * 0.22); ctx.clip(); ctx.drawImage(logo, cx, y - size * 0.32 - bs / 2, bs, bs); ctx.restore(); cx += bs + size * 0.6; }
  ctx.fillStyle = 'rgba(246,223,174,0.7)'; ctx.textAlign = 'left'; ctx.fillText(str, cx, y); ctx.restore();
}
