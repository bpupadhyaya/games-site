// ARCFORGE brand pieces in ONE small module so any Arcforge game can copy it (same API as the Tiger and Goat one).
// The rule: the brand lives only in the FRAME and FURNITURE (a small credit lockup on the title, a quiet line on the result screen),
// never in the game's own palette or art. This copy is dressed in the default Arcforge look: lavender-to-cyan letters on a dark navy outline and the violet-to-teal pill.
//
// How a game uses it:
//   main.js   creates `new Image()` for web/brand/arcforge-af.png and calls setLogo(img) when it loads (this module stays DOM-free).
//   render.js drawLockup(ctx, x, y, size, { align })  - AF icon + "ARCFORGE" + pill "WORLD HERITAGE GAMES"; `size` = icon edge, y = top
//             drawMoreLine(ctx, x, y, size)           - badge + "More heritage games in Arcforge" (result screen); y = baseline
//             drawBadge(ctx, cx, cy, size)            - just the AF icon, for a quiet corner
const UI = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
let logo = null;
export const setLogo = (img) => { logo = img; };
const has = () => !!(logo && logo.width);

export function drawBadge(ctx, cx, cy, size, alpha = 1) {
  if (!has()) return;
  ctx.save(); ctx.globalAlpha = alpha;
  ctx.beginPath(); ctx.roundRect(cx - size / 2, cy - size / 2, size, size, size * 0.22); ctx.clip();
  ctx.drawImage(logo, cx - size / 2, cy - size / 2, size, size); ctx.restore();
}

function spacedWidth(ctx, str, track) { return [...str].reduce((s, ch) => s + ctx.measureText(ch).width + track, -track); }
function spaced(ctx, str, x, y, track, mode) {   // glyph by glyph (canvas letterSpacing is not available everywhere)
  let cx = x;
  for (const ch of str) { if (mode === 'stroke') ctx.strokeText(ch, cx, y); else ctx.fillText(ch, cx, y); cx += ctx.measureText(ch).width + track; }
}

// Returns the lockup's width. align: 'left' | 'center' | 'right' (relative to x).
export function drawLockup(ctx, x, y, size, { align = 'center', alpha = 0.94 } = {}) {
  const fs = Math.round(size * 0.46), track = fs * 0.07, gap = size * 0.2;
  ctx.save(); ctx.globalAlpha = alpha; ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  ctx.font = `italic 900 ${fs}px ${UI}`;
  const w1 = spacedWidth(ctx, 'ARCFORGE', track);
  const ps = Math.round(size * 0.17), pillH = size * 0.3, pillText = 'WORLD HERITAGE GAMES', pillPad = ps * 0.9;
  ctx.font = `800 ${ps}px ${UI}`; const w2 = spacedWidth(ctx, pillText, ps * 0.12) + pillPad * 2;
  const textW = Math.max(w1, w2), total = (has() ? size + gap : 0) + textW;
  let cx = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
  const x0 = cx;
  if (has()) { drawBadge(ctx, cx + size / 2, y + size / 2, size); cx += size + gap; }
  // wordmark: dark outline first, then a cream -> gold fill
  const base = y + size * 0.52;
  ctx.font = `italic 900 ${fs}px ${UI}`; ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(3, fs * 0.2); ctx.strokeStyle = '#141a3d';
  spaced(ctx, 'ARCFORGE', cx, base, track, 'stroke');
  const g = ctx.createLinearGradient(0, base - fs, 0, base); g.addColorStop(0, '#f1ecff'); g.addColorStop(0.5, '#b7c9ff'); g.addColorStop(1, '#6fe0ee');
  ctx.fillStyle = g; spaced(ctx, 'ARCFORGE', cx, base, track, 'fill');
  // pill
  const py = y + size - pillH;
  ctx.beginPath(); ctx.roundRect(cx, py, w2, pillH, pillH / 2);
  const pg = ctx.createLinearGradient(cx, 0, cx + w2, 0); pg.addColorStop(0, '#7a4fe0'); pg.addColorStop(0.5, '#4a72e8'); pg.addColorStop(1, '#27b5c4');
  ctx.fillStyle = pg; ctx.fill();
  ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(190,215,255,0.75)'; ctx.stroke();
  ctx.font = `800 ${ps}px ${UI}`; ctx.fillStyle = '#ffffff'; ctx.textBaseline = 'middle';
  spaced(ctx, pillText, cx + pillPad, py + pillH / 2 + 1, ps * 0.12, 'fill');
  ctx.restore();
  return { x: x0, w: total };
}

// A quiet one-liner for the result screen: badge + "More heritage games in Arcforge". y = text centre line.
export function drawMoreLine(ctx, x, y, size) {
  ctx.save(); ctx.font = `600 ${size}px ${UI}`; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  const str = 'More heritage games in Arcforge', w = ctx.measureText(str).width, bs = size * 1.7, total = (has() ? bs + size * 0.5 : 0) + w;
  let cx = x - total / 2;
  if (has()) { drawBadge(ctx, cx + bs / 2, y, bs, 0.9); cx += bs + size * 0.5; }
  ctx.fillStyle = 'rgba(235,243,255,0.85)'; ctx.fillText(str, cx, y); ctx.restore();
}

// The themed lockup image (web/brand/arcforge-lockup.png, 1200 x 327): drawn small and quiet. Falls back to the drawn lockup.
let lockImg = null;
export const setLockup = (img) => { lockImg = img; };
// x = centre / left / right edge by `align`, y = top, w = width in units. Returns { x, w, h }.
export function drawBrandLockup(ctx, x, y, w, { align = 'center', alpha = 0.9 } = {}) {
  if (lockImg && lockImg.width) {
    const h = w * lockImg.height / lockImg.width, x0 = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
    if (pressFrames > 0) { pressFrames--; alpha = Math.min(alpha, 0.5); }
    ctx.save(); ctx.globalAlpha = alpha; ctx.drawImage(lockImg, x0, y, w, h); ctx.restore();
    return { x: x0, w, h };
  }
  const size = w * 0.2, r = drawLockup(ctx, x, y, size, { align, alpha });
  return { x: r.x, w: r.w, h: size };
}
export const lockupHeight = (w) => (lockImg && lockImg.width ? w * lockImg.height / lockImg.width : w * 0.2);

// A quiet hairline round the landscape side cards (the game's own ice blue, not a brand colour).
export function drawCardEdge(ctx, r) {
  ctx.save(); ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, 22); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(160,205,245,0.45)'; ctx.stroke(); ctx.restore();
}

// Press feedback for the tappable lockup: a brief dim after a tap (no sound, no popup).
let pressFrames = 0;
export const pressLockup = () => { pressFrames = 10; };
