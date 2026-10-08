// ARCFORGE brand pieces, kept in ONE small module so any Arcforge game can copy it (see STATUS.md "Brand pattern").
// The rule: the brand lives only in the FRAME and FURNITURE (a credit line, hairlines on empty panels), never in the game's own palette or art.
// Brand colours (neon violet -> blue -> cyan on the dark plate) come from the Arcforge app icon.
//
// How a game uses it:
//   main.js        creates `new Image()` for web/brand/arcforge-af.png and calls setLogo(img) when it loads (this module stays DOM-free).
//   view.js        drawCredit(ctx, x, y, size, {align, dim})  - "AF  ARCFORGE · World Heritage Games", used under the title tagline
//                  drawMoreLine(ctx, x, y, size)             - "More heritage games in Arcforge" with the AF badge, used on the result screen
//                  edgeStroke(ctx, rect, radius, alpha)      - a brand-coloured hairline for empty side panels (landscape / tablet)
export const BRAND = { violet: [150, 96, 250], blue: [70, 132, 252], cyan: [24, 198, 252], plate: [13, 10, 38] };
const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
const UI = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
let logo = null;
export const setLogo = (img) => { logo = img; };

// Brand gradient across a rectangle (left -> right: violet, blue, cyan).
export function brandGradient(ctx, x0, y0, x1, y1, alpha = 1) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, rgba(BRAND.violet, alpha)); g.addColorStop(0.55, rgba(BRAND.blue, alpha)); g.addColorStop(1, rgba(BRAND.cyan, alpha));
  return g;
}

// The AF badge: the real app icon when loaded, otherwise nothing (the wordmark alone still reads).
function badge(ctx, cx, cy, size) {
  if (!(logo && logo.width)) return;
  ctx.save(); ctx.beginPath(); ctx.roundRect(cx - size / 2, cy - size / 2, size, size, size * 0.22); ctx.clip();
  ctx.drawImage(logo, cx - size / 2, cy - size / 2, size, size); ctx.restore();
}

// Letter-spaced text (canvas letterSpacing is not available everywhere), measured and drawn glyph by glyph.
function spaced(ctx, str, x, y, track, align = 'left') {
  const w = [...str].reduce((s, ch) => s + ctx.measureText(ch).width + track, -track);
  let cx = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
  ctx.textAlign = 'left';
  for (const ch of str) { ctx.fillText(ch, cx, y); cx += ctx.measureText(ch).width + track; }
  return w;
}

// "AF  ARCFORGE · World Heritage Games" centred on x. Baseline y; `size` is the wordmark's font size.
export function drawCredit(ctx, x, y, size, { dim = 1 } = {}) {
  const tag = ' ·  World Heritage Games';
  ctx.save(); ctx.globalAlpha = dim;
  ctx.font = `800 ${size}px ${UI}`; const w1 = [...'ARCFORGE'].reduce((s, ch) => s + ctx.measureText(ch).width + size * 0.2, -size * 0.2);
  ctx.font = `500 ${size}px ${UI}`; const w2 = ctx.measureText(tag).width, bs = size * 1.9, total = (logo && logo.width ? bs + size * 0.6 : 0) + w1 + w2;
  let cx = x - total / 2;
  if (logo && logo.width) { badge(ctx, cx + bs / 2, y - size * 0.32, bs); cx += bs + size * 0.6; }
  ctx.font = `800 ${size}px ${UI}`; ctx.fillStyle = brandGradient(ctx, cx, 0, cx + w1, 0, 1); spaced(ctx, 'ARCFORGE', cx, y, size * 0.2);
  ctx.font = `500 ${size}px ${UI}`; ctx.fillStyle = 'rgba(246,223,174,0.72)'; ctx.textAlign = 'left'; ctx.fillText(tag, cx + w1, y);
  ctx.restore();
}

// A quieter one-liner for result screens: badge + "More heritage games in Arcforge".
export function drawMoreLine(ctx, x, y, size) {
  ctx.save(); ctx.font = `600 ${size}px ${UI}`;
  const str = 'More heritage games in Arcforge', w = ctx.measureText(str).width, bs = size * 1.9, has = logo && logo.width, total = (has ? bs + size * 0.6 : 0) + w;
  let cx = x - total / 2;
  if (has) { badge(ctx, cx + bs / 2, y - size * 0.32, bs); cx += bs + size * 0.6; }
  ctx.fillStyle = 'rgba(246,223,174,0.7)'; ctx.textAlign = 'left'; ctx.fillText(str, cx, y); ctx.restore();
}

// A hairline in the brand gradient round a panel (soft glow underneath). Restrained: low alpha, 2 px.
export function edgeStroke(ctx, r, radius, alpha = 0.5) {
  ctx.save();
  ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, radius);
  ctx.lineWidth = 7; ctx.strokeStyle = brandGradient(ctx, r.x, r.y, r.x + r.w, r.y + r.h, alpha * 0.18); ctx.stroke();     // soft glow, no blur filter (cheap)
  ctx.lineWidth = 2; ctx.strokeStyle = brandGradient(ctx, r.x, r.y, r.x + r.w, r.y + r.h, alpha); ctx.stroke();
  ctx.restore();
}

// A small stacked mark (AF badge over the ARCFORGE wordmark) for the empty bottom of a side panel. `w` = the width it may use.
export function drawBadgeStack(ctx, cx, bottomY, w) {
  ctx.save();
  let size = 17; ctx.font = `800 ${size}px ${UI}`;
  const width = (s) => { ctx.font = `800 ${s}px ${UI}`; return [...'ARCFORGE'].reduce((a, ch) => a + ctx.measureText(ch).width + s * 0.2, -s * 0.2); };
  while (size > 11 && width(size) > w) size -= 1;
  const bs = Math.min(60, w * 0.5);
  if (logo && logo.width) badge(ctx, cx, bottomY - size - 14 - bs / 2, bs);
  ctx.font = `800 ${size}px ${UI}`; ctx.fillStyle = brandGradient(ctx, cx - w / 2, 0, cx + w / 2, 0, 0.95); spaced(ctx, 'ARCFORGE', cx, bottomY - 4, size * 0.2, 'center');
  ctx.restore();
}

// The themed lockup image (web/brand/arcforge-lockup.png: AF icon + ARCFORGE + WORLD HERITAGE GAMES in this game's colours).
// Drawn `h` units tall, centred on cx, top at `top`. Falls back to the text credit when the image has not loaded.
let lockupImg = null;
export const setLockup = (img) => { lockupImg = img; };
export function drawLockupImage(ctx, cx, top, h, alpha = 0.92, down = false) {
  if (lockupImg && lockupImg.width) {
    const k = down ? 0.95 : 1, w0 = (h * lockupImg.width) / lockupImg.height, w = w0 * k, hh = h * k, x = cx - w / 2, y = top + (h - hh) / 2, pad = hh * 0.16;
    ctx.save(); ctx.globalAlpha = down ? 0.7 : 0.9; ctx.fillStyle = 'rgba(30,10,2,0.62)';
    ctx.beginPath(); ctx.roundRect(x - pad * 1.5, y - pad, w + pad * 3, hh + pad * 2, hh * 0.5); ctx.fill(); ctx.restore();
    ctx.save(); ctx.globalAlpha = down ? 0.8 : 1; ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = hh * 0.06; ctx.drawImage(lockupImg, x, y, w, hh); ctx.restore();
    return w;
  }
  drawCredit(ctx, cx, top + h * 0.65, Math.max(13, Math.min(22, h * 0.3)));
  return 0;
}
