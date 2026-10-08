// ARCFORGE brand pieces, discreet (see the pilot games' brand.js): a small themed lockup on the title screen and a quiet
// text line on the result screen. The brand lives only in the frame and furniture, never over gameplay, never in the
// game's own palette or art. main.js loads web/brand/arcforge-lockup.png and hands it over with setLockup(img).
const UI = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
let lockup = null;
export const setLockup = (img) => { lockup = img; };
const ok = () => !!(lockup && lockup.width);

// The lockup image (icon + ARCFORGE + WORLD HERITAGE GAMES), `h` high, centred on x, top at y. Returns the drawn width.
export function drawLockup(ctx, x, y, h, alpha = 0.78) {
  if (!ok()) return 0;
  const w = h * (lockup.width / lockup.height);
  ctx.save(); ctx.globalAlpha = alpha; ctx.drawImage(lockup, x - w / 2, y, w, h); ctx.restore();
  return w;
}

// A quiet one-liner for the result screen. y = text centre line.
export function drawMoreLine(ctx, x, y, size) {
  ctx.save(); ctx.font = `600 ${size}px ${UI}`; ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255,238,200,0.6)'; ctx.fillText('More heritage games in Arcforge', x, y); ctx.restore();
}
