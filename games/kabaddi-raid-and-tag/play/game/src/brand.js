// Discreet ARCFORGE brand pieces (never over gameplay, never recolouring the game): the themed lockup on the title screen and a quiet
// "More heritage games in Arcforge" line with the AF badge on the result screen. main.js loads the two images and hands them in;
// everything here is a no-op until they have loaded.
const UI = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
let logo = null, lockup = null;
export const setLogo = (img) => { logo = img; };
export const setLockup = (img) => { lockup = img; };
const has = (i) => !!(i && i.width);
export const lockupSize = (h) => (has(lockup) ? { w: Math.round(h * lockup.width / lockup.height), h } : { w: 0, h: 0 });

// The themed lockup (AF icon + ARCFORGE + WORLD HERITAGE GAMES), centred on cx, top edge y, height h.
export function drawLockup(ctx, cx, y, h, alpha = 0.85) {
  if (!has(lockup)) return 0;
  const w = h * lockup.width / lockup.height;
  ctx.save(); ctx.globalAlpha = alpha; ctx.drawImage(lockup, cx - w / 2, y, w, h); ctx.restore();
  return w;
}

export function drawBadge(ctx, cx, cy, size, alpha = 1) {
  if (!has(logo)) return;
  ctx.save(); ctx.globalAlpha = alpha;
  ctx.beginPath(); ctx.roundRect(cx - size / 2, cy - size / 2, size, size, size * 0.22); ctx.clip();
  ctx.drawImage(logo, cx - size / 2, cy - size / 2, size, size); ctx.restore();
}

// "AF  More heritage games in Arcforge", centred on cx, vertical middle cy.
export function drawMoreLine(ctx, cx, cy, size) {
  ctx.save(); ctx.font = `600 ${size}px ${UI}`; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  const str = 'More heritage games in Arcforge', w = ctx.measureText(str).width, bs = size * 1.7, total = (has(logo) ? bs + size * 0.5 : 0) + w;
  let x = cx - total / 2;
  if (has(logo)) { drawBadge(ctx, x + bs / 2, cy, bs, 0.9); x += bs + size * 0.5; }
  ctx.fillStyle = 'rgba(255,238,200,0.78)'; ctx.fillText(str, x, cy); ctx.restore();
}
