// ARCFORGE brand pieces, discreet: a small themed lockup on the title screen and a quiet "More heritage games in Arcforge" line on the
// result card. Never over gameplay, never recolours the game. Images are set by main.js when they load (this module stays DOM-free).
let logo = null, lockup = null;
export const setLogo = (img) => { logo = img; };
export const setLockup = (img) => { lockup = img; };
export const lockupRatio = 327 / 1200;

// The themed lockup (AF icon + ARCFORGE + WORLD HERITAGE GAMES), centred on cx, top at y, `w` wide. Returns its height.
export function drawLockup(ctx, cx, y, w, alpha = 0.9) {
  if (!(lockup && lockup.width)) return 0;
  const h = w * (lockup.height / lockup.width);
  ctx.save(); ctx.globalAlpha = alpha; ctx.drawImage(lockup, cx - w / 2, y, w, h); ctx.restore();
  return h;
}

// Badge + "More heritage games in Arcforge", centred on x at baseline y.
export function drawMoreLine(ctx, x, y, size, str = 'More heritage games in Arcforge') {
  ctx.save(); ctx.font = `600 ${size}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
  const w = ctx.measureText(str).width, bs = size * 1.9, has = logo && logo.width, total = (has ? bs + size * 0.6 : 0) + w;
  let cx = x - total / 2;
  if (has) {
    ctx.save(); ctx.beginPath(); ctx.roundRect(cx, y - size * 0.32 - bs / 2, bs, bs, bs * 0.22); ctx.clip();
    ctx.drawImage(logo, cx, y - size * 0.32 - bs / 2, bs, bs); ctx.restore(); cx += bs + size * 0.6;
  }
  ctx.fillStyle = 'rgba(246,236,214,0.6)'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillText(str, cx, y); ctx.restore();
  return total;
}
