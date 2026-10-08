// Arcforge brand pieces, kept tiny and quiet: the themed lockup PNG (title screen) and a one-line "More heritage games" credit
// (result screen). Never drawn over gameplay, never recolours the game. Images are optional: without them nothing is drawn.
const UI = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
let lockup = null, badge = null;
export const setLockup = (img) => { lockup = img; };
export const setBadge = (img) => { badge = img; };
const has = (i) => !!(i && i.width);

// Draws the lockup with its top-left at (x, y), `h` units tall.
export function drawLockup(ctx, x, y, h, alpha = 0.92) {
  if (!has(lockup)) return;
  ctx.save(); ctx.globalAlpha = alpha;
  ctx.drawImage(lockup, x, y, h * lockup.width / lockup.height, h);
  ctx.restore();
}

// A quiet one-liner: AF badge + "More heritage games in Arcforge", centred on (cx, cy).
export function drawMoreLine(ctx, cx, cy, size = 22) {
  ctx.save(); ctx.font = `600 ${size}px ${UI}`; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  const str = 'More heritage games in Arcforge', tw = ctx.measureText(str).width, bs = has(badge) ? size * 1.6 : 0, gap = bs ? size * 0.5 : 0;
  let x = cx - (bs + gap + tw) / 2;
  if (bs) {
    ctx.save(); ctx.globalAlpha = 0.9; ctx.beginPath(); ctx.roundRect(x, cy - bs / 2, bs, bs, bs * 0.22); ctx.clip(); ctx.drawImage(badge, x, cy - bs / 2, bs, bs); ctx.restore();
    x += bs + gap;
  }
  ctx.fillStyle = 'rgba(255,240,215,0.85)'; ctx.fillText(str, x, cy); ctx.restore();
}

