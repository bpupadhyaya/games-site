// ARCFORGE brand pieces in ONE small module (same idea as Tiger and Goat / Golden Sling). The brand lives only in the FRAME and
// FURNITURE (a small, quiet lockup on the title; a quiet line on the result screen), never in the game's own palette or art, never
// over gameplay. main.js loads the two images and hands them over; this module stays DOM-free.
const UI = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
let af = null, lockup = null;
export const setLogo = (img) => { af = img; };
export const setLockup = (img) => { lockup = img; };
const ok = (i) => !!(i && i.width);
export const LOCKUP_RATIO = 327 / 1200;

// The themed lockup picture (icon + ARCFORGE + WORLD HERITAGE GAMES). Centre x, top y, width w. Returns its height.
export function drawLockup(ctx, cx, y, w, alpha = 0.9) {
  const h = Math.round(w * LOCKUP_RATIO);
  if (ok(lockup)) { ctx.save(); ctx.globalAlpha = alpha; ctx.drawImage(lockup, cx - w / 2, y, w, h); ctx.restore(); return h; }
  ctx.save(); ctx.globalAlpha = alpha * 0.8; ctx.font = `800 20px ${UI}`; ctx.fillStyle = '#ffe3a0'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('ARCFORGE · World Heritage Games', cx, y + h / 2); ctx.restore();
  return h;
}

// A quiet one-liner for the result screen: AF badge + "More heritage games in Arcforge". y = text centre line.
export function drawMoreLine(ctx, x, y, size = 22) {
  ctx.save(); ctx.font = `600 ${size}px ${UI}`; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  const str = 'More heritage games in Arcforge', w = ctx.measureText(str).width, bs = size * 1.7, has = ok(af), total = (has ? bs + size * 0.5 : 0) + w;
  let cx = x - total / 2;
  if (has) {
    ctx.save(); ctx.globalAlpha = 0.9; ctx.beginPath(); ctx.roundRect(cx, y - bs / 2, bs, bs, bs * 0.22); ctx.clip(); ctx.drawImage(af, cx, y - bs / 2, bs, bs); ctx.restore();
    cx += bs + size * 0.5;
  }
  ctx.fillStyle = 'rgba(255,238,200,0.8)'; ctx.fillText(str, cx, y); ctx.restore();
  return { x: x - total / 2, w: total, h: bs };
}
