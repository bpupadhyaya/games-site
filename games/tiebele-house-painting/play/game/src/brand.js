// Arcforge brand pieces, kept to the FRAME and FURNITURE of the game (a small credit lockup on the title screen, a quiet line on the result
// screen), never over gameplay and never recolouring the game. This module is DOM-free: main.js loads the two images and hands them in.
//   web/brand/arcforge-lockup.png  the themed credit lockup (icon + ARCFORGE + WORLD HERITAGE GAMES)
//   web/brand/arcforge-af.png      just the AF icon (used by the result screen line)
const UI = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
let logo = null, lockup = null;
export const setLogo = (img) => { logo = img; };
export const setLockup = (img) => { lockup = img; };
const ok = (i) => !!(i && i.width);

// The lockup picture, `h` units tall, centred (or left/right aligned) on x; y = top. Quiet: a little transparent. Returns { x, w } or null.
export function drawLockupImg(ctx, x, y, h, { align = 'center', alpha = 0.95 } = {}) {
  if (!ok(lockup)) return null;
  const w = h * (lockup.width / lockup.height), x0 = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
  if (pressFrames > 0) { pressFrames--; alpha = Math.min(alpha, 0.5); }
  ctx.save(); ctx.globalAlpha = alpha; ctx.drawImage(lockup, x0, y, w, h); ctx.restore();
  return { x: x0, w };
}

// A quiet one-liner for the result screen: AF icon + "More heritage games in Arcforge". y = text centre line.
export function drawMoreLine(ctx, x, y, size) {
  ctx.save(); ctx.font = `600 ${size}px ${UI}`; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  const str = 'More heritage games in Arcforge', w = ctx.measureText(str).width, bs = size * 1.7, total = (ok(logo) ? bs + size * 0.5 : 0) + w;
  let cx = x - total / 2;
  if (ok(logo)) {
    ctx.save(); ctx.globalAlpha = 0.9; ctx.beginPath(); ctx.roundRect(cx, y - bs / 2, bs, bs, bs * 0.22); ctx.clip(); ctx.drawImage(logo, cx, y - bs / 2, bs, bs); ctx.restore();
    cx += bs + size * 0.5;
  }
  ctx.fillStyle = 'rgba(255,238,200,0.78)'; ctx.fillText(str, cx, y); ctx.restore();
}

// Press feedback for the tappable lockup: a brief dim after a tap (no sound, no popup).
let pressFrames = 0;
export const pressLockup = () => { pressFrames = 10; };
