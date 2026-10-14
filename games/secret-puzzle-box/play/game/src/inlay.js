// Marquetry pattern painter (shared by the 2D art and the 3D presenter's panel textures).
import { theme } from './ui.js';

// Marquetry strips drawn inside rect r (already clipped by the caller). pat 0..5, pid picks the wood order.
export function inlay(ctx, r, pat, pid, vertical) {
  const T = theme(), W = T.woods, c = (k) => W[(k + pid) % W.length];
  const u = Math.max(5, Math.min(r.w, r.h) / 3.2);
  ctx.save();
  ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip();
  ctx.fillStyle = c(1); ctx.fillRect(r.x, r.y, r.w, r.h);
  if (vertical) { ctx.translate(r.x + r.w / 2, r.y + r.h / 2); ctx.rotate(Math.PI / 2); ctx.translate(-(r.x + r.w / 2), -(r.y + r.h / 2)); const cx = r.x + r.w / 2, cy = r.y + r.h / 2; r = { x: cx - r.h / 2, y: cy - r.w / 2, w: r.h, h: r.w }; }
  const x0 = r.x, y0 = r.y, w = r.w, h = r.h;
  if (pat === 0) {          // stripes
    const n = Math.ceil(w / (u * 0.55)) + 1;
    for (let i = 0; i < n; i++) { ctx.fillStyle = c(i % 3 === 0 ? 0 : i % 3 === 1 ? 3 : 2); ctx.fillRect(x0 + i * u * 0.55, y0, u * 0.55 + 0.5, h); }
  } else if (pat === 1) {   // diamonds
    const d = u * 0.62;
    for (let j = -1; j * d <= h + d; j++) for (let i = -1; i * d * 2 <= w + d * 2; i++) {
      const cx = x0 + (i * 2 + (j & 1)) * d, cy = y0 + j * d;
      ctx.fillStyle = c((i + j) & 1 ? 0 : 2); ctx.beginPath(); ctx.moveTo(cx, cy - d); ctx.lineTo(cx + d, cy); ctx.lineTo(cx, cy + d); ctx.lineTo(cx - d, cy); ctx.closePath(); ctx.fill();
    }
  } else if (pat === 2) {   // chevrons
    const n = Math.ceil(w / (u * 0.6)) + 2;
    for (let i = -1; i < n; i++) {
      ctx.fillStyle = c(i & 1 ? 0 : 3); ctx.beginPath();
      const x = x0 + i * u * 0.6;
      ctx.moveTo(x, y0); ctx.lineTo(x + u * 0.3, y0 + h / 2); ctx.lineTo(x, y0 + h); ctx.lineTo(x + u * 0.3, y0 + h); ctx.lineTo(x + u * 0.6, y0 + h / 2); ctx.lineTo(x + u * 0.3, y0); ctx.closePath(); ctx.fill();
    }
  } else if (pat === 3) {   // checks
    const q = u * 0.5;
    for (let j = 0; j * q < h; j++) for (let i = 0; i * q < w; i++) { ctx.fillStyle = c((i + j) & 1 ? 2 : 3); ctx.fillRect(x0 + i * q, y0 + j * q, q + 0.5, q + 0.5); }
  } else if (pat === 4) {   // steps
    const q = u * 0.42;
    for (let i = 0; i * q < w + h; i++) { ctx.fillStyle = c(i % 3 === 0 ? 0 : i % 3 === 1 ? 2 : 3); ctx.beginPath(); ctx.moveTo(x0 + i * q, y0 + h); ctx.lineTo(x0 + i * q + q, y0 + h); ctx.lineTo(x0 + i * q + q + h, y0); ctx.lineTo(x0 + i * q + h, y0); ctx.closePath(); ctx.fill(); }
  } else {                  // triangles
    const q = u * 0.8;
    for (let j = 0; j * q * 0.5 < h; j++) for (let i = -1; i * q < w + q; i++) {
      const x = x0 + i * q + (j & 1) * q / 2, y = y0 + j * q * 0.5;
      ctx.fillStyle = c(((i + j) & 1) ? 0 : 2); ctx.beginPath(); ctx.moveTo(x, y + q * 0.5); ctx.lineTo(x + q / 2, y); ctx.lineTo(x + q, y + q * 0.5); ctx.closePath(); ctx.fill();
    }
  }
  ctx.restore();
}
