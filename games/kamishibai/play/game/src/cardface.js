// The back of a picture card (the narrator's line, written on the card's own back). Shared by the 2D layer and the 3D card textures.
import { para, paraHeight, rr } from './ui.js';

export function cardBackFace(ctx, r, text) {
  rr(ctx, r.x, r.y, r.w, r.h, r.w * 0.05); ctx.fillStyle = '#f4ead0'; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(80,50,20,0.5)'; ctx.stroke();
  ctx.save(); rr(ctx, r.x, r.y, r.w, r.h, r.w * 0.05); ctx.clip(); ctx.strokeStyle = 'rgba(120,80,40,0.09)'; ctx.lineWidth = 1;
  for (let y = r.y + 14; y < r.y + r.h; y += 14) { ctx.beginPath(); ctx.moveTo(r.x, y); ctx.lineTo(r.x + r.w, y); ctx.stroke(); }
  ctx.restore();
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const pad = r.w * 0.08, top = pad + clamp(r.w * 0.13, 22, 40) * 0.6, bw = r.w - 2 * pad, bh = r.h - top - pad - 20;
  let size = clamp(r.w * 0.1, 11, 30);
  while (size > 9 && paraHeight(ctx, text, bw, size, 500, 1.25) > bh) size -= 0.5;
  para(ctx, text, r.x + pad, r.y + top, bw, { size, weight: 500, color: '#3a2616', lh: 1.25 });
}
