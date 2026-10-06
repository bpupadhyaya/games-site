// ARCFORGE brand pieces in ONE small module (same API family as Tiger and Goat / Golden Sling).
// The brand lives only in the FRAME and FURNITURE: a small, quiet lockup on the title screen, a one-liner on the result
// screen. Never over gameplay, never recolouring the game.
//   main.js   creates the Images (brand/arcforge-af.png, brand/arcforge-lockup.png) and calls setLogo / setLockup on load.
const UI = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
let logo = null, lockup = null;
export const setLogo = (img) => { logo = img; };
export const setLockup = (img) => { lockup = img; };
const has = (i) => !!(i && i.width);

export function drawBadge(ctx, cx, cy, size, alpha = 1) {
  if (!has(logo)) return;
  ctx.save(); ctx.globalAlpha = alpha;
  ctx.beginPath(); ctx.roundRect(cx - size / 2, cy - size / 2, size, size, size * 0.22); ctx.clip();
  ctx.drawImage(logo, cx - size / 2, cy - size / 2, size, size); ctx.restore();
}

// The themed lockup PNG (AF icon + ARCFORGE + WORLD HERITAGE GAMES pill), centred on x, width w, vertical centre y. Quiet by default.
export function drawLockup(ctx, x, y, w, alpha = 0.82) {
  if (has(lockup)) {
    const h = w * lockup.height / lockup.width;
    ctx.save(); ctx.globalAlpha = alpha; ctx.drawImage(lockup, x - w / 2, y - h / 2, w, h); ctx.restore();
    return { h };
  }
  // fallback until the image loads (or if it is missing): the plain words
  ctx.save(); ctx.globalAlpha = alpha * 0.9; ctx.font = `800 ${Math.round(w * 0.075)}px ${UI}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(247,239,220,0.8)'; ctx.fillText('ARCFORGE · WORLD HERITAGE GAMES', x, y); ctx.restore();
  return { h: w * 0.27 };
}

// A quiet one-liner for the result screen: badge + "More heritage games in Arcforge". y = text centre line.
export function drawMoreLine(ctx, x, y, size) {
  ctx.save(); ctx.font = `600 ${size}px ${UI}`; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  const str = 'More heritage games in Arcforge', w = ctx.measureText(str).width, bs = size * 1.7, total = (has(logo) ? bs + size * 0.5 : 0) + w;
  let cx = x - total / 2;
  if (has(logo)) { drawBadge(ctx, cx + bs / 2, y, bs, 0.9); cx += bs + size * 0.5; }
  ctx.fillStyle = 'rgba(247,239,220,0.75)'; ctx.fillText(str, cx, y); ctx.restore();
}
