// ARCFORGE brand pieces, kept in one small module (same API as the Tiger and Goat / Golden Sling ones).
// The rule: the brand lives only in the FRAME and FURNITURE (a small credit under the star on the title, a quiet line on the result
// panel), never over play and never in the game's own palette or art.
//   main.js   loads web/brand/arcforge-af.png and web/brand/arcforge-lockup.png and hands them over with setLogo() / setLockup()
//             (this module stays DOM-free).
//   view.js   drawLockup(ctx, cx, top, h)     - the themed lockup image (AF icon + ARCFORGE + WORLD HERITAGE GAMES), h = its height
//             drawMoreLine(ctx, x, y, size)   - badge + "More heritage games in Arcforge" (result panel); y = baseline
const UI = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
let logo = null, lockup = null;
export const setLogo = (img) => { logo = img; };
export const setLockup = (img) => { lockup = img; };
const ok = (i) => !!(i && i.width);

export function drawLockup(ctx, cx, top, h, alpha = 0.92) {
  if (!ok(lockup)) return;
  const w = h * lockup.width / lockup.height;
  ctx.save(); ctx.globalAlpha = alpha; ctx.drawImage(lockup, cx - w / 2, top, w, h); ctx.restore();
}

export function drawMoreLine(ctx, x, y, size) {
  ctx.save(); ctx.font = `600 ${size}px ${UI}`; ctx.textAlign = 'left';
  const str = 'More heritage games in Arcforge', w = ctx.measureText(str).width, bs = size * 1.7, has = ok(logo), total = (has ? bs + size * 0.5 : 0) + w;
  let cx = x - total / 2;
  if (has) {
    ctx.save(); ctx.beginPath(); ctx.roundRect(cx, y - size * 0.32 - bs / 2, bs, bs, bs * 0.22); ctx.clip();
    ctx.drawImage(logo, cx, y - size * 0.32 - bs / 2, bs, bs); ctx.restore(); cx += bs + size * 0.5;
  }
  ctx.fillStyle = 'rgba(246,223,174,0.7)'; ctx.fillText(str, cx, y); ctx.restore();
}

// Title lockup: a dark translucent capsule for contrast, the themed PNG on top, a dim on press.
export function drawTitleLockup(ctx, r, pressed = false) {
  ctx.save();
  const pad = r.h * 0.12; ctx.globalAlpha = pressed ? 0.7 : 1; ctx.fillStyle = 'rgba(10,8,24,0.55)'; ctx.beginPath(); ctx.roundRect(r.x - pad, r.y - pad, r.w + 2 * pad, r.h + 2 * pad, (r.h + 2 * pad) * 0.3); ctx.fill();
  drawLockup(ctx, r.x + r.w / 2, r.y, r.h, pressed ? 0.7 : 1);
  ctx.restore();
}
