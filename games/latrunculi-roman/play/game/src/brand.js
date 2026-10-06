// The ARCFORGE credit: the game's themed lockup (AF icon, ARCFORGE, WORLD HERITAGE GAMES) drawn small and quiet on the title screen.
// It lives only in the frame, never over play, and never recolours the game. main.js loads the image and calls setLockup().
let lockup = null;
export const setLockup = (img) => { lockup = img; };

// Fits the lockup inside rect r (aspect kept, centred).
export function drawLockup(ctx, r, alpha = 0.9, down = false) {
  if (!(lockup && lockup.width)) return;
  const k0 = Math.min(r.w / lockup.width, r.h / lockup.height) * (down ? 0.95 : 1), w = lockup.width * k0, h = lockup.height * k0;
  const x = r.x + (r.w - w) / 2, y = r.y + (r.h - h) / 2, pad = h * 0.16;
  ctx.save(); ctx.globalAlpha = down ? 0.7 : 0.9; ctx.fillStyle = 'rgba(6,8,12,0.66)';
  ctx.beginPath(); ctx.roundRect(x - pad * 1.5, y - pad, w + pad * 3, h + pad * 2, h * 0.5); ctx.fill(); ctx.restore();
  ctx.save(); ctx.globalAlpha = down ? 0.8 : 1; ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = h * 0.06;
  ctx.drawImage(lockup, x, y, w, h);
  ctx.restore();
}
