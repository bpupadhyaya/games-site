// ARCFORGE brand pieces in ONE small module (same API as the Tiger and Goat / Golden Sling copies).
// The brand lives only in the FRAME and FURNITURE: a small themed lockup on the title and a quiet line on the result screen;
// never in the game's own palette or art.
//   main.js    loads web/brand/arcforge-af.png and web/brand/arcforge-lockup.png and calls setLogo(img) / setLockup(img).
//   drawLockup(ctx, cx, y, h)   the themed ARCFORGE lockup (icon + wordmark + WORLD HERITAGE GAMES pill), centred on cx, h = height
//   drawMoreLine(ctx, cx, y, size)  badge + "More heritage games in Arcforge" (result screen); y = text centre line
const UI = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
let logo = null, lockup = null;
export const setLogo = (img) => { logo = img; };
export const setLockup = (img) => { lockup = img; };
const ok = (i) => !!(i && i.width);
export const hasLockup = () => ok(lockup) || ok(logo);

export function drawBadge(ctx, cx, cy, size, alpha = 1) {
  if (!ok(logo)) return;
  ctx.save(); ctx.globalAlpha = alpha;
  ctx.beginPath(); ctx.roundRect(cx - size / 2, cy - size / 2, size, size, size * 0.22); ctx.clip();
  ctx.drawImage(logo, cx - size / 2, cy - size / 2, size, size); ctx.restore();
}

// Returns the drawn width.
export function drawLockup(ctx, cx, y, h, alpha = 0.92) {
  if (ok(lockup)) {
    const w = h * (lockup.width / lockup.height);
    ctx.save(); ctx.globalAlpha = alpha; ctx.drawImage(lockup, cx - w / 2, y, w, h); ctx.restore();
    return w;
  }
  if (ok(logo)) { drawBadge(ctx, cx, y + h / 2, h, alpha); return h; }
  return 0;
}

export function drawMoreLine(ctx, cx, y, size) {
  ctx.save(); ctx.font = `600 ${size}px ${UI}`; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  const str = 'More heritage games in Arcforge', w = ctx.measureText(str).width, bs = size * 1.7, total = (ok(logo) ? bs + size * 0.5 : 0) + w;
  let x = cx - total / 2;
  if (ok(logo)) { drawBadge(ctx, x + bs / 2, y, bs, 0.9); x += bs + size * 0.5; }
  ctx.fillStyle = 'rgba(255,238,200,0.78)'; ctx.fillText(str, x, y); ctx.restore();
}
