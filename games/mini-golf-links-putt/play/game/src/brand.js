// ARCFORGE brand pieces, kept in ONE small module (same API family as Tiger and Goat / Golden Sling). The brand lives only in the FRAME and
// FURNITURE (a small quiet lockup on the title, a quiet line on the result screen), never over the ice and never in the game's own palette.
//   main.js  creates the images (web/brand/arcforge-af.png, web/brand/arcforge-lockup.png) and calls setLogo / setLockup when they load.
//   menus.js drawLockupImage(ctx, cx, bottom, width, alpha) -> true when the themed lockup is drawn; drawCredit(...) is the text fallback;
//            drawMoreLine(ctx, cx, baseline, size) on the result screen.
const UI = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
let logo = null, lockup = null;
export const setLogo = (img) => { logo = img; };
export const setLockup = (img) => { lockup = img; };
const has = (i) => !!(i && i.width);

// The themed lockup picture, bottom-centred on (cx, bottom), `w` wide. Returns false when it is not loaded (nothing drawn).
export function drawLockupImage(ctx, cx, bottom, w, alpha = 0.8) {
  if (!has(lockup)) return false;
  const h = w * (lockup.height / lockup.width);
  ctx.save(); ctx.globalAlpha = alpha; ctx.drawImage(lockup, cx - w / 2, bottom - h, w, h); ctx.restore();
  return true;
}

// "AF  ARCFORGE · World Heritage Games", one quiet line centred on x (baseline y).
export function drawCredit(ctx, x, y, size) {
  ctx.save(); ctx.globalAlpha = 0.8; ctx.textBaseline = 'alphabetic';
  const tag = ' · World Heritage Games', word = 'ARCFORGE';
  ctx.font = `800 ${size}px ${UI}`; const w1 = ctx.measureText(word).width + size * 0.15 * 7;
  ctx.font = `500 ${size}px ${UI}`; const w2 = ctx.measureText(tag).width, bs = size * 1.8, total = (has(logo) ? bs + size * 0.5 : 0) + w1 + w2;
  let cx = x - total / 2;
  if (has(logo)) { ctx.save(); ctx.beginPath(); ctx.roundRect(cx, y - size * 1.2, bs, bs, bs * 0.22); ctx.clip(); ctx.drawImage(logo, cx, y - size * 1.2, bs, bs); ctx.restore(); cx += bs + size * 0.5; }
  ctx.textAlign = 'left'; ctx.font = `800 ${size}px ${UI}`; ctx.fillStyle = '#9fc4ff';
  for (const ch of word) { ctx.fillText(ch, cx, y); cx += ctx.measureText(ch).width + size * 0.15; }
  ctx.font = `500 ${size}px ${UI}`; ctx.fillStyle = 'rgba(214,236,252,0.8)'; ctx.fillText(tag, cx, y);
  ctx.restore();
}

// A quiet one-liner for result screens: badge + "More heritage games in Arcforge" (centred on x, baseline y).
export function drawMoreLine(ctx, x, y, size) {
  ctx.save(); ctx.font = `600 ${size}px ${UI}`; ctx.textBaseline = 'alphabetic';
  const str = 'More heritage games in Arcforge', w = ctx.measureText(str).width, bs = size * 1.7, total = (has(logo) ? bs + size * 0.5 : 0) + w;
  let cx = x - total / 2;
  if (has(logo)) { ctx.save(); ctx.beginPath(); ctx.roundRect(cx, y - size * 1.15, bs, bs, bs * 0.22); ctx.clip(); ctx.drawImage(logo, cx, y - size * 1.15, bs, bs); ctx.restore(); cx += bs + size * 0.5; }
  ctx.fillStyle = 'rgba(214,236,252,0.6)'; ctx.textAlign = 'left'; ctx.fillText(str, cx, y); ctx.restore();
}
