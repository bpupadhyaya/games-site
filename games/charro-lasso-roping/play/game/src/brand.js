// ARCFORGE brand pieces, kept in ONE small module (the same pattern as Tiger and Goat / Golden Sling). The brand lives only in the
// FRAME and FURNITURE of the game: a quiet themed lockup on the title screen and a "More heritage games" line on the result
// screen. It never recolours the game's own palette or art and never sits over gameplay.
//
//   main.js  loads web/brand/arcforge-af.png and web/brand/arcforge-lockup.png and hands them to setLogo / setLockup (this module stays DOM-free).
//   view.js  drawLockup(ctx, rect)            - the themed ARCFORGE / WORLD HERITAGE GAMES lockup, small and quiet, on the title
//            drawMoreLine(ctx, x, y, size)    - AF badge + "More heritage games in Arcforge" on the result screen
let logo = null, lockup = null;
export const setLogo = (img) => { logo = img; };
export const setLockup = (img) => { lockup = img; };
const UI = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

// The lockup, fitted into `r` (keeps its aspect ratio, centred). Drawn slightly dimmed so it stays discreet.
export function drawLockup(ctx, r, down = false) {
  if (!(lockup && lockup.width)) return;
  const k = Math.min(r.w / lockup.width, r.h / lockup.height) * (down ? 0.95 : 1), w = lockup.width * k, h = lockup.height * k, x = r.x + (r.w - w) / 2, y = r.y + (r.h - h) / 2, pad = h * 0.16;
  ctx.save(); ctx.globalAlpha = down ? 0.7 : 0.9; ctx.fillStyle = 'rgba(8,16,40,0.72)';
  ctx.beginPath(); ctx.roundRect(x - pad * 1.5, y - pad, w + pad * 3, h + pad * 2, h * 0.5); ctx.fill(); ctx.restore();
  ctx.save(); ctx.globalAlpha = down ? 0.8 : 1; ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = h * 0.06; ctx.drawImage(lockup, x, y, w, h); ctx.restore();
}

// A quieter one-liner for result screens: badge + "More heritage games in Arcforge", centred on x (baseline y).
export function drawMoreLine(ctx, x, y, size) {
  ctx.save(); ctx.font = `600 ${size}px ${UI}`;
  const str = 'More heritage games in Arcforge', w = ctx.measureText(str).width, bs = size * 1.9, has = logo && logo.width, total = (has ? bs + size * 0.6 : 0) + w;
  let cx = x - total / 2;
  if (has) {
    ctx.save(); ctx.beginPath(); ctx.roundRect(cx, y - size * 0.32 - bs / 2, bs, bs, bs * 0.22); ctx.clip(); ctx.drawImage(logo, cx, y - size * 0.32 - bs / 2, bs, bs); ctx.restore();
    cx += bs + size * 0.6;
  }
  ctx.fillStyle = 'rgba(246,223,174,0.7)'; ctx.textAlign = 'left'; ctx.fillText(str, cx, y); ctx.restore();
}
