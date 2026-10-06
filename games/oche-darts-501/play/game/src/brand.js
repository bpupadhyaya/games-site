// ARCFORGE brand pieces in one small module (same API idea as the Tiger and Goat / Golden Sling ones). The brand lives only in the
// FRAME and FURNITURE (a small quiet lockup on the title screen, one quiet line on the result screen), never in the game's own art.
//   main.js   creates Images for web/brand/arcforge-lockup.png and arcforge-af.png and hands them over with setLockup / setLogo.
//   menus.js  drawLockup(ctx, cx, cy, width)   - the themed lockup image (icon + ARCFORGE + WORLD HERITAGE GAMES pill), small and quiet
//             drawMoreLine(ctx, x, y, size)    - "More heritage games in Arcforge" with the AF icon (result screen)
const UI = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
let lockup = null, logo = null;
export const setLockup = (img) => { lockup = img; };
export const setLogo = (img) => { logo = img; };
const has = (i) => !!(i && i.width);

// Draws the lockup image centred on (cx, cy), `width` wide. Falls back to a plain text credit until the image has loaded.
export function drawLockup(ctx, cx, cy, width, alpha = 0.85) {
  ctx.save(); ctx.globalAlpha = alpha;
  if (has(lockup)) {
    const h = width * lockup.height / lockup.width;
    ctx.drawImage(lockup, cx - width / 2, cy - h / 2, width, h);
  } else {
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `700 ${Math.round(width * 0.07)}px ${UI}`; ctx.fillStyle = 'rgba(255,233,191,0.8)';
    ctx.fillText('ARCFORGE  ·  WORLD HERITAGE GAMES', cx, cy);
  }
  ctx.restore();
}
export const lockupHeight = (width) => (has(lockup) ? width * lockup.height / lockup.width : width * 0.12);

// A quiet one-liner for the result screen. y = text centre line.
export function drawMoreLine(ctx, x, y, size) {
  ctx.save(); ctx.font = `600 ${size}px ${UI}`; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  const str = 'More heritage games in Arcforge', w = ctx.measureText(str).width, bs = size * 1.8, total = (has(logo) ? bs + size * 0.5 : 0) + w;
  let cx = x - total / 2;
  if (has(logo)) {
    ctx.save(); ctx.globalAlpha = 0.9; ctx.beginPath(); ctx.roundRect(cx, y - bs / 2, bs, bs, bs * 0.22); ctx.clip(); ctx.drawImage(logo, cx, y - bs / 2, bs, bs); ctx.restore();
    cx += bs + size * 0.5;
  }
  ctx.fillStyle = 'rgba(255,238,200,0.7)'; ctx.fillText(str, cx, y); ctx.restore();
}
