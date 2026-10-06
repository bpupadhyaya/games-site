// ARCFORGE brand pieces, kept small and quiet: the themed lockup (AF icon + ARCFORGE + WORLD HERITAGE GAMES, dressed in this game's
// own wood and lacquer colours) on the title screen, and a one-line "More heritage games in Arcforge" on the result screen.
// The brand lives only in the frame and furniture, never over the dish and never in the game's own palette.
//   main.js  creates Image objects for web/brand/arcforge-lockup.png and arcforge-af.png and calls setLockup(img) / setLogo(img).
const UI = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
let logo = null, lockup = null;
export const setLogo = (img) => { logo = img; };
export const setLockup = (img) => { lockup = img; };
const has = (i) => !!(i && i.width);

// The themed lockup, `w` wide, top edge at y, centred on cx. Falls back to nothing (the title still reads without it).
export function drawLockup(ctx, cx, y, w, alpha = 0.95) {
  if (!has(lockup)) return;
  const h = w * lockup.height / lockup.width;
  if (pressFrames > 0) { pressFrames--; alpha = Math.min(alpha, 0.5); }
  ctx.save(); ctx.globalAlpha = alpha; ctx.drawImage(lockup, cx - w / 2, y, w, h); ctx.restore();
}

// A quiet one-liner for the result screen: badge + "More heritage games in Arcforge". y = baseline.
export function drawMoreLine(ctx, x, y, size) {
  ctx.save(); ctx.font = `600 ${size}px ${UI}`; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  const str = 'More heritage games in Arcforge', w = ctx.measureText(str).width, bs = size * 1.7, total = (has(logo) ? bs + size * 0.5 : 0) + w;
  let cx = x - total / 2;
  const cy = y - size * 0.5;
  if (has(logo)) {
    ctx.globalAlpha = 0.9; ctx.beginPath(); ctx.roundRect(cx, cy - bs / 2, bs, bs, bs * 0.22); ctx.clip();
    ctx.drawImage(logo, cx, cy - bs / 2, bs, bs); ctx.restore(); ctx.save();
    ctx.font = `600 ${size}px ${UI}`; ctx.textBaseline = 'middle'; ctx.textAlign = 'left'; cx += bs + size * 0.5;
  }
  ctx.fillStyle = 'rgba(255,243,220,0.7)'; ctx.fillText(str, cx, cy); ctx.restore();
}

// Press feedback for the tappable lockup: a brief dim after a tap (no sound, no popup).
let pressFrames = 0;
export const pressLockup = () => { pressFrames = 10; };
