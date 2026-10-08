// ARCFORGE brand pieces (credit lockup, "More heritage games" line, hairline). Same pattern as the other Arcforge games.
// The brand lives only in the frame and furniture; the game's own wood, felt and glass are never recoloured.
export const BRAND = { violet: [150, 96, 250], blue: [70, 132, 252], cyan: [24, 198, 252] };
const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
const UI = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
let logo = null;
export const setLogo = (img) => { logo = img; };
export function brandGradient(ctx, x0, y0, x1, y1, alpha = 1) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, rgba(BRAND.violet, alpha)); g.addColorStop(0.55, rgba(BRAND.blue, alpha)); g.addColorStop(1, rgba(BRAND.cyan, alpha));
  return g;
}
function badge(ctx, cx, cy, size) {
  if (!(logo && logo.width)) return;
  ctx.save(); ctx.beginPath(); ctx.roundRect(cx - size / 2, cy - size / 2, size, size, size * 0.22); ctx.clip();
  ctx.drawImage(logo, cx - size / 2, cy - size / 2, size, size); ctx.restore();
}
function spaced(ctx, str, x, y, track, align = 'left') {
  const w = [...str].reduce((s, ch) => s + ctx.measureText(ch).width + track, -track);
  let cx = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
  ctx.textAlign = 'left';
  for (const ch of str) { ctx.fillText(ch, cx, y); cx += ctx.measureText(ch).width + track; }
  return w;
}
// "AF  ARCFORGE · World Heritage Games" centred on x, baseline y. `size` = wordmark font size.
export function drawCredit(ctx, x, y, size, { dim = 1 } = {}) {
  const tag = ' ·  World Heritage Games';
  ctx.save(); ctx.globalAlpha = dim;
  ctx.font = `800 ${size}px ${UI}`; const w1 = [...'ARCFORGE'].reduce((s, ch) => s + ctx.measureText(ch).width + size * 0.2, -size * 0.2);
  ctx.font = `500 ${size}px ${UI}`; const w2 = ctx.measureText(tag).width, bs = size * 1.9, total = (logo && logo.width ? bs + size * 0.6 : 0) + w1 + w2;
  let cx = x - total / 2;
  if (logo && logo.width) { badge(ctx, cx + bs / 2, y - size * 0.32, bs); cx += bs + size * 0.6; }
  ctx.font = `800 ${size}px ${UI}`; ctx.fillStyle = brandGradient(ctx, cx, 0, cx + w1, 0, 1); spaced(ctx, 'ARCFORGE', cx, y, size * 0.2);
  ctx.font = `500 ${size}px ${UI}`; ctx.fillStyle = 'rgba(244,226,186,0.78)'; ctx.textAlign = 'left'; ctx.fillText(tag, cx + w1, y);
  ctx.restore();
}
export function drawMoreLine(ctx, x, y, size) {
  ctx.save(); ctx.font = `600 ${size}px ${UI}`;
  const str = 'More heritage games in Arcforge', w = ctx.measureText(str).width, bs = size * 1.9, has = logo && logo.width, total = (has ? bs + size * 0.6 : 0) + w;
  let cx = x - total / 2;
  if (has) { badge(ctx, cx + bs / 2, y - size * 0.32, bs); cx += bs + size * 0.6; }
  ctx.fillStyle = 'rgba(244,226,186,0.74)'; ctx.textAlign = 'left'; ctx.fillText(str, cx, y); ctx.restore();
}
export function edgeStroke(ctx, r, radius, alpha = 0.5) {
  ctx.save(); ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, radius);
  ctx.lineWidth = 7; ctx.strokeStyle = brandGradient(ctx, r.x, r.y, r.x + r.w, r.y + r.h, alpha * 0.18); ctx.stroke();
  ctx.lineWidth = 2; ctx.strokeStyle = brandGradient(ctx, r.x, r.y, r.x + r.w, r.y + r.h, alpha); ctx.stroke();
  ctx.restore();
}
export function drawBadgeStack(ctx, cx, bottomY, w) {
  ctx.save();
  let size = 17;
  const width = (s) => { ctx.font = `800 ${s}px ${UI}`; return [...'ARCFORGE'].reduce((a, ch) => a + ctx.measureText(ch).width + s * 0.2, -s * 0.2); };
  while (size > 11 && width(size) > w) size -= 1;
  const bs = Math.min(60, w * 0.5);
  if (logo && logo.width) badge(ctx, cx, bottomY - size - 14 - bs / 2, bs);
  ctx.font = `800 ${size}px ${UI}`; ctx.fillStyle = brandGradient(ctx, cx - w / 2, 0, cx + w / 2, 0, 0.95); spaced(ctx, 'ARCFORGE', cx, bottomY - 4, size * 0.2, 'center');
  ctx.restore();
}
