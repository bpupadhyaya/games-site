// Discreet ARCFORGE brand pieces: the themed lockup (title screen) and a quiet "more games" line (result screen).
// The brand lives only in the frame and furniture, never in the game's own palette or art. This module is DOM-free;
// main.js loads the images and hands them over.
let logo = null, lockup = null;
export const setLogo = (img) => { logo = img; };
export const setLockup = (img) => { lockup = img; };
const UI = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

// The lockup centred on (cx, cy), `h` units tall, drawn quietly. Falls back to a plain credit line until the image loads.
export function drawLockup(ctx, cx, cy, h0, down = false) {
  ctx.save();
  if (lockup && lockup.width) {
    const k = down ? 0.95 : 1, w = h0 * k * lockup.width / lockup.height, h = h0 * k, x = cx - w / 2, y = cy - h / 2, pad = h * 0.16;
    ctx.globalAlpha = down ? 0.7 : 0.9; ctx.fillStyle = 'rgba(14,8,4,0.7)';
    ctx.beginPath(); ctx.roundRect(x - pad * 1.5, y - pad, w + pad * 3, h + pad * 2, h * 0.5); ctx.fill();
    ctx.globalAlpha = down ? 0.8 : 1; ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = h * 0.06; ctx.drawImage(lockup, x, y, w, h);
  } else {
    ctx.globalAlpha = 0.7; ctx.fillStyle = 'rgba(246,223,174,0.85)'; ctx.font = `700 ${Math.round(h0 * 0.4)}px ${UI}`; ctx.textAlign = 'center';
    ctx.fillText('ARCFORGE · WORLD HERITAGE GAMES', cx, cy + h0 * 0.14);
  }
  ctx.restore();
}

// A quieter one-liner for result screens: badge + "More heritage games in Arcforge".
export function drawMoreLine(ctx, x, y, size) {
  ctx.save(); ctx.font = `600 ${size}px ${UI}`;
  const str = 'More heritage games in Arcforge', w = ctx.measureText(str).width, bs = size * 1.7, has = logo && logo.width, total = (has ? bs + size * 0.5 : 0) + w;
  let cx = x - total / 2;
  if (has) {
    ctx.save(); ctx.beginPath(); ctx.roundRect(cx, y - size * 0.32 - bs / 2, bs, bs, bs * 0.22); ctx.clip(); ctx.drawImage(logo, cx, y - size * 0.32 - bs / 2, bs, bs); ctx.restore();
    cx += bs + size * 0.5;
  }
  ctx.fillStyle = 'rgba(246,223,174,0.78)'; ctx.textAlign = 'left'; ctx.fillText(str, cx, y); ctx.restore();
}
