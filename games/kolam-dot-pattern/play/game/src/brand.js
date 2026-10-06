// ARCFORGE brand pieces: the themed lockup (web/brand/arcforge-lockup.png) when it loaded, otherwise the AF badge + a plain wordmark.
// Quiet by design: small, low alpha, only on the title screen and the result card, never over the board and never recolouring the game.
let logo = null, lockup = null;
export const setLogo = (img) => { logo = img; };
export const setLockup = (img) => { lockup = img; };
const UI = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const ok = (i) => Boolean(i && i.width);

// The lockup centred on x with its baseline at y, `h` units tall.
export function drawCredit(ctx, x, y, h = 44, alpha = 0.9) {
  ctx.save(); ctx.globalAlpha = alpha;
  if (ok(lockup)) { const w = (lockup.width / lockup.height) * h; ctx.drawImage(lockup, x - w / 2, y - h, w, h); }
  else {
    const size = Math.round(h * 0.4), tag = 'ARCFORGE · World Heritage Games';
    ctx.font = `700 ${size}px ${UI}`; const tw = ctx.measureText(tag).width, bs = ok(logo) ? h * 0.8 : 0, total = tw + (bs ? bs + 10 : 0);
    let cx = x - total / 2;
    if (bs) { ctx.save(); ctx.beginPath(); ctx.roundRect(cx, y - h * 0.9, bs, bs, bs * 0.22); ctx.clip(); ctx.drawImage(logo, cx, y - h * 0.9, bs, bs); ctx.restore(); cx += bs + 10; }
    ctx.fillStyle = 'rgba(244,239,228,0.7)'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillText(tag, cx, y - h * 0.3);
  }
  ctx.restore();
}

// "More heritage games in Arcforge" with the AF badge, for the result card. `size` is the text size in units.
export function drawMoreLine(ctx, x, y, size) {
  ctx.save(); ctx.font = `600 ${size}px ${UI}`; ctx.textBaseline = 'alphabetic';
  const str = 'More heritage games in Arcforge', w = ctx.measureText(str).width, bs = ok(logo) ? size * 1.7 : 0, total = w + (bs ? bs + size * 0.5 : 0);
  let cx = x - total / 2;
  if (bs) { ctx.save(); ctx.beginPath(); ctx.roundRect(cx, y - size * 1.2, bs, bs, bs * 0.22); ctx.clip(); ctx.drawImage(logo, cx, y - size * 1.2, bs, bs); ctx.restore(); cx += bs + size * 0.5; }
  ctx.fillStyle = 'rgba(244,239,228,0.7)'; ctx.textAlign = 'left'; ctx.fillText(str, cx, y); ctx.restore();
}
