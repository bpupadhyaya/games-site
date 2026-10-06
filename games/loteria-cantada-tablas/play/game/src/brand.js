// ARCFORGE brand pieces (discreet): the themed lockup on the title screen and a quiet "More heritage games" line on result screens.
// The brand lives only in the frame and furniture, never in the game's own palette or art. DOM-free: main.js loads the images and
// hands them over with setLogo / setLockup; until they load (or in headless tests) nothing is drawn.
const UI = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
let logo = null, lockup = null;
export const setLogo = (img) => { logo = img; };
export const setLockup = (img) => { lockup = img; };
const has = (i) => !!(i && i.width);

// The themed lockup (AF icon + ARCFORGE + WORLD HERITAGE GAMES), fitted into rect `r` and centred.
export function drawLockup(ctx, r, alpha = 0.85) {
  if (!has(lockup)) return;
  const k = Math.min(r.w / lockup.width, r.h / lockup.height), w = lockup.width * k, h = lockup.height * k;
  ctx.save(); ctx.globalAlpha = alpha; ctx.drawImage(lockup, r.x + (r.w - w) / 2, r.y + (r.h - h) / 2, w, h); ctx.restore();
}

// Badge + "More heritage games in Arcforge", centred on x; y = text centre line. Returns the tap rect.
export function drawMoreLine(ctx, x, y, size, color = 'rgba(255,243,220,0.72)') {
  ctx.save(); ctx.font = `600 ${size}px ${UI}`; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  const str = 'More heritage games in Arcforge', w = ctx.measureText(str).width, bs = size * 1.7, ok = has(logo), total = (ok ? bs + size * 0.5 : 0) + w;
  let cx = x - total / 2;
  if (ok) {
    ctx.save(); ctx.globalAlpha = 0.9; ctx.beginPath(); ctx.roundRect(cx, y - bs / 2, bs, bs, bs * 0.22); ctx.clip(); ctx.drawImage(logo, cx, y - bs / 2, bs, bs); ctx.restore();
    cx += bs + size * 0.5;
  }
  ctx.fillStyle = color; ctx.fillText(str, cx, y); ctx.restore();
  return { x: x - total / 2 - 10, y: y - size * 1.4, w: total + 20, h: size * 2.8 };
}
