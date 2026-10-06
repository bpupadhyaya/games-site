// ARCFORGE brand pieces, kept in ONE small module (same API family as Tiger and Goat / Golden Sling).
// The rule: the brand lives only in the FRAME and FURNITURE (a small quiet lockup on the title screen, a quiet line on the result
// screen), never over gameplay and never recolouring the game. The lockup PNG is this game's themed one (web/brand/arcforge-lockup.png).
//
// main.js loads the two images and hands them in (this module stays DOM-free):  setLogo(af icon), setLockup(themed lockup).
const UI = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
let logo = null, lockup = null;
export const setLogo = (img) => { logo = img; };
export const setLockup = (img) => { lockup = img; };
const has = (i) => !!(i && i.width);

// The themed lockup (AF icon + ARCFORGE + WORLD HERITAGE GAMES), `w` wide, top edge y, centred on cx. Returns its height.
export function drawLockup(ctx, cx, y, w0, alpha = 0.85, down = false) {
  if (!has(lockup)) return 0;
  const h0 = w0 * lockup.height / lockup.width, k = down ? 0.95 : 1, w = w0 * k, h = h0 * k, x = cx - w / 2, yy = y + (h0 - h) / 2, pad = h * 0.16;
  ctx.save(); ctx.globalAlpha = down ? 0.7 : 0.9; ctx.fillStyle = 'rgba(14,8,4,0.68)';
  ctx.beginPath(); ctx.roundRect(x - pad * 1.5, yy - pad, w + pad * 3, h + pad * 2, h * 0.5); ctx.fill(); ctx.restore();
  ctx.save(); ctx.globalAlpha = down ? 0.8 : 1; ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = h * 0.06; ctx.drawImage(lockup, x, yy, w, h); ctx.restore();
  return h0;
}

// A quiet one-liner for the result screen: AF badge + "More heritage games in Arcforge". y = text baseline.
export function drawMoreLine(ctx, x, y, size) {
  ctx.save(); ctx.font = `600 ${size}px ${UI}`; ctx.textAlign = 'left';
  const str = 'More heritage games in Arcforge', w = ctx.measureText(str).width, bs = size * 1.9, total = (has(logo) ? bs + size * 0.6 : 0) + w;
  let cx = x - total / 2;
  if (has(logo)) {
    const bx = cx + bs / 2, by = y - size * 0.32;
    ctx.beginPath(); ctx.roundRect(bx - bs / 2, by - bs / 2, bs, bs, bs * 0.22); ctx.clip(); ctx.drawImage(logo, bx - bs / 2, by - bs / 2, bs, bs);
    ctx.restore(); ctx.save(); ctx.font = `600 ${size}px ${UI}`; ctx.textAlign = 'left'; cx += bs + size * 0.6;
  }
  ctx.fillStyle = 'rgba(246,223,174,0.7)'; ctx.fillText(str, cx, y); ctx.restore();
}
