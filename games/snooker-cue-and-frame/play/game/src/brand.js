// ARCFORGE brand pieces (discreet): the themed lockup image on the title screen and a quiet "More heritage games" line on the result
// screen. The brand lives only in the frame and furniture, never over gameplay and never in the game's own palette.
//   main.js creates `new Image()` for brand/arcforge-lockup.png and brand/arcforge-af.png and hands them to setLockup / setLogo.
const UI = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
let logo = null, lockup = null;
export const setLogo = (img) => { logo = img; };
export const setLockup = (img) => { lockup = img; };
export const hasLockup = () => !!(lockup && lockup.width);
export const LOCKUP_ASPECT = 1200 / 327;

// The themed lockup, small and quiet. Centred on cx, `w` wide, top edge y. Returns its height.
export function drawLockup(ctx, cx, y, w, alpha = 0.9) {
  const h = w / LOCKUP_ASPECT;
  if (!hasLockup()) return h;
  if (pressFrames > 0) { pressFrames--; alpha = Math.min(alpha, 0.5); }
  ctx.save(); ctx.globalAlpha = alpha; ctx.drawImage(lockup, cx - w / 2, y, w, h); ctx.restore();
  return h;
}

// A quiet one-liner: AF badge + "More heritage games in Arcforge". y = text centre line.
export function drawMoreLine(ctx, x, y, size) {
  ctx.save(); ctx.font = `600 ${size}px ${UI}`; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  const str = 'More heritage games in Arcforge', w = ctx.measureText(str).width, bs = size * 1.7, has = !!(logo && logo.width), total = (has ? bs + size * 0.5 : 0) + w;
  let cx = x - total / 2;
  if (has) {
    ctx.save(); ctx.beginPath(); ctx.roundRect(cx, y - bs / 2, bs, bs, bs * 0.22); ctx.clip(); ctx.drawImage(logo, cx, y - bs / 2, bs, bs); ctx.restore();
    cx += bs + size * 0.5;
  }
  ctx.fillStyle = 'rgba(214,236,220,0.72)'; ctx.fillText(str, cx, y); ctx.restore();
  return { x: x - total / 2, w: total };
}

// Press feedback for the tappable lockup: a brief dim after a tap (no sound, no popup).
let pressFrames = 0;
export const pressLockup = () => { pressFrames = 10; };
