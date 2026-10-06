// ARCFORGE brand pieces, kept small and quiet: they live only on the title screen (the lockup picture) and the result screen
// (one line). Never over the board, never recolouring the game. Images are optional: without them the text line still reads.
//   main.js  loads web/brand/arcforge-lockup.png and web/brand/arcforge-af.png and calls setLockup / setLogo.
const UI = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
let logo = null, lockup = null;
export const setLogo = (img) => { logo = img; };
export const setLockup = (img) => { lockup = img; };
const has = (i) => !!(i && i.width);

// The themed lockup (icon + ARCFORGE + WORLD HERITAGE GAMES pill), drawn with its centre on x, top at y, `w` wide. Returns its height.
export function drawLockup(ctx, x, y, w, alpha = 0.82) {
  if (has(lockup)) {
    const h = w * lockup.height / lockup.width;
    ctx.save(); ctx.globalAlpha = alpha; ctx.drawImage(lockup, x - w / 2, y, w, h); ctx.restore();
    return h;
  }
  // fallback credit line
  const fs = Math.max(12, Math.round(w * 0.06));
  ctx.save(); ctx.globalAlpha = alpha; ctx.font = `800 ${fs}px ${UI}`; ctx.textAlign = 'center'; ctx.fillStyle = '#e9d6a6';
  ctx.fillText('ARCFORGE  ·  WORLD HERITAGE GAMES', x, y + fs); ctx.restore();
  return fs * 1.6;
}

// Quiet result-screen line: badge + "More heritage games in Arcforge". y = text centre line.
export function drawMoreLine(ctx, x, y, size) {
  ctx.save(); ctx.font = `600 ${size}px ${UI}`; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  const str = 'More heritage games in Arcforge', w = ctx.measureText(str).width, bs = size * 1.7, total = (has(logo) ? bs + size * 0.5 : 0) + w;
  let cx = x - total / 2;
  if (has(logo)) {
    ctx.save(); ctx.globalAlpha = 0.9; ctx.beginPath(); ctx.roundRect(cx, y - bs / 2, bs, bs, bs * 0.22); ctx.clip(); ctx.drawImage(logo, cx, y - bs / 2, bs, bs); ctx.restore();
    cx += bs + size * 0.5;
  }
  ctx.fillStyle = 'rgba(244,222,180,0.7)'; ctx.fillText(str, cx, y); ctx.restore();
}

// The lockup on its dark capsule (title screen, bottom-centre under the menu). top = y of the image; down = pressed feedback.
export function drawLockupBadge(ctx, cx, top, w0, down = false) {
  if (!has(lockup)) return false;
  const h0 = w0 * lockup.height / lockup.width, k = down ? 0.95 : 1, w = w0 * k, h = h0 * k, x = cx - w / 2, y = top + (h0 - h) / 2, pad = h * 0.16;
  ctx.save(); ctx.globalAlpha = down ? 0.7 : 0.9; ctx.fillStyle = 'rgba(14,8,3,0.7)';
  ctx.beginPath(); ctx.roundRect(x - pad * 1.5, y - pad, w + pad * 3, h + pad * 2, h * 0.5); ctx.fill(); ctx.restore();
  ctx.save(); ctx.globalAlpha = down ? 0.8 : 1; ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = h * 0.06; ctx.drawImage(lockup, x, y, w, h); ctx.restore();
  return true;
}
