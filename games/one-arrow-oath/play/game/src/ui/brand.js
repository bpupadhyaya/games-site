// ARCFORGE brand pieces, kept in the frame and the furniture only: a small quiet lockup on the title screen and one quiet line on the
// result screen. Never over gameplay, never recolours the game. main.js hands in the images when they load; until then (or without
// them) a small text credit is drawn instead. This module stays DOM-free.
let logo = null;
let lockup = null;
export const setLogo = (img) => { logo = img; };
export const setLockup = (img) => { lockup = img; };
const UI = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

// Lockup centred on x, top at y, `w` units wide (height follows the image). Returns its height.
export function drawLockup(ctx, x, y, w, alpha = 0.82) {
  if (lockup && lockup.width) {
    const h = (w * lockup.height) / lockup.width;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.drawImage(lockup, x - w / 2, y, w, h);
    ctx.restore();
    return h;
  }
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#e2bd72';
  ctx.font = `italic 900 ${Math.round(w * 0.1)}px ${UI}`;
  ctx.fillText('ARCFORGE', x, y + w * 0.1);
  ctx.fillStyle = '#cfd0e4';
  ctx.font = `700 ${Math.round(w * 0.05)}px ${UI}`;
  ctx.fillText('WORLD HERITAGE GAMES', x, y + w * 0.17);
  ctx.restore();
  return w * 0.2;
}

// Quiet one-liner for the result screen. y = text centre line, size = text size in units.
export function drawMoreLine(ctx, x, y, size) {
  ctx.save();
  ctx.font = `600 ${size}px ${UI}`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  const str = 'More heritage games in Arcforge';
  const w = ctx.measureText(str).width;
  const bs = size * 1.7;
  const total = (logo && logo.width ? bs + size * 0.5 : 0) + w;
  let cx = x - total / 2;
  if (logo && logo.width) {
    ctx.save();
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(cx, y - bs / 2, bs, bs, bs * 0.22) : ctx.rect(cx, y - bs / 2, bs, bs);
    ctx.clip();
    ctx.drawImage(logo, cx, y - bs / 2, bs, bs);
    ctx.restore();
    cx += bs + size * 0.5;
  }
  ctx.fillStyle = 'rgba(207,208,228,0.7)';
  ctx.fillText(str, cx, y);
  ctx.restore();
}
