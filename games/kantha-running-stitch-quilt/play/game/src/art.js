// Drawing of the cloth world: layered cloth, chalk rows, thread stitches, markers, the needle, the thread gauge and mini patches.
// Pure drawing, no state. Cloth coordinates are mapped to the screen by `geo` (layout.patchGeo).
import { theme, threadColor, rgba, mix, rr } from './ui.js';
import { sewPoint } from './engine.js';

const TAU = Math.PI * 2;
export const DASH = 0.36, GAP = 0.2;
const hs = (n) => { let x = Math.imul(n | 0, 0x45d9f3b); x ^= x >>> 16; x = Math.imul(x, 0x45d9f3b); x ^= x >>> 16; return (x >>> 0) / 4294967296; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ---- dashes along a run (cached per run and option) -----------------------------------------------------------------------------------
// Each dash: { u0, u1, pts: [x, y, u, x, y, u, ...] } where u is the arc length along the sewing direction.
const dashCache = new WeakMap();
export function dashesFor(run, optIdx = 0, dash = DASH, gap = GAP) {
  let m = dashCache.get(run);
  if (!m) { m = new Map(); dashCache.set(run, m); }
  const key = `${optIdx}|${dash}|${gap}`;
  let out = m.get(key);
  if (out) return out;
  out = [];
  const opt = run.opts[optIdx], len = run.len;
  let u = 0, k = 0;
  while (u < len - 0.05) {
    const d = dash * (0.86 + 0.28 * hs(run.i * 131 + k * 7 + optIdx * 3));
    const u1 = Math.min(len, u + d);
    if (u1 - u > 0.08) {
      const n = Math.max(1, Math.ceil((u1 - u) / 0.1)), pts = [];
      for (let j = 0; j <= n; j++) { const uu = u + ((u1 - u) * j) / n, p = sewPoint(run, opt, uu); pts.push(p[0], p[1], uu); }
      out.push({ u0: u, u1, pts });
    }
    u = u1 + gap * (0.88 + 0.24 * hs(run.i * 17 + k * 3 + 5));
    k += 1;
  }
  m.set(key, out);
  return out;
}

function buildPath(ctx, geo, dashes, upTo, ox = 0, oy = 0) {
  ctx.beginPath();
  for (const d of dashes) {
    if (d.u0 >= upTo) break;
    const p = d.pts;
    ctx.moveTo(geo.X(p[0]) + ox, geo.Y(p[1]) + oy);
    for (let i = 3; i < p.length; i += 3) {
      if (p[i + 2] > upTo) {
        const t = (upTo - p[i - 1]) / (p[i + 2] - p[i - 1]);
        ctx.lineTo(geo.X(p[i - 3] + (p[i] - p[i - 3]) * t) + ox, geo.Y(p[i - 2] + (p[i + 1] - p[i - 2]) * t) + oy);
        break;
      }
      ctx.lineTo(geo.X(p[i]) + ox, geo.Y(p[i + 1]) + oy);
    }
  }
}

// ---- the cloth ---------------------------------------------------------------------------------------------------------------------------------
export function drawCloth(ctx, geo, { puck = 0, t = 0, seed = 0 } = {}) {
  const T = theme(), r = geo.rect, cx = r.x + r.w / 2, cy = r.y + r.h / 2, s = r.w;
  // two layers of older cloth under the patch, a little askew
  const layers = [[T.layer[1], -0.02, 1.075, 0.012], [T.layer[0], 0.014, 1.04, -0.008]];
  for (const [col, rot, k] of layers.map((l) => [l[0], l[1], l[2]])) {
    ctx.save(); ctx.translate(cx, cy + s * 0.012); ctx.rotate(rot + (seed % 5) * 0.001);
    rr(ctx, -s * k / 2 + s * 0.012, -s * k / 2 + s * 0.012, s * k, s * k, s * 0.02); ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.fill();
    rr(ctx, -s * k / 2, -s * k / 2, s * k, s * k, s * 0.02); ctx.fillStyle = col; ctx.fill();
    // a line of faded stitches along the layer's edge
    ctx.lineWidth = Math.max(1.4, s * 0.0035); ctx.strokeStyle = 'rgba(0,0,0,0.16)'; ctx.setLineDash([s * 0.02, s * 0.014]);
    rr(ctx, -s * k / 2 + s * 0.015, -s * k / 2 + s * 0.015, s * k - s * 0.03, s * k - s * 0.03, s * 0.012); ctx.stroke(); ctx.setLineDash([]);
    ctx.restore();
  }
  // the patch itself
  rr(ctx, r.x + s * 0.006, r.y + s * 0.01, r.w, r.h, s * 0.015); ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fill();
  const g = ctx.createLinearGradient(r.x, r.y, r.x + r.w * 0.4, r.y + r.h);
  g.addColorStop(0, T.patch0); g.addColorStop(1, T.patch1);
  rr(ctx, r.x, r.y, r.w, r.h, s * 0.015); ctx.fillStyle = g; ctx.fill();
  ctx.save(); rr(ctx, r.x, r.y, r.w, r.h, s * 0.015); ctx.clip();
  // woven threads
  const wst = Math.max(5, s / 46);
  ctx.beginPath();
  for (let x = r.x + wst; x < r.x + r.w; x += wst) { ctx.moveTo(x, r.y); ctx.lineTo(x, r.y + r.h); }
  for (let y = r.y + wst; y < r.y + r.h; y += wst) { ctx.moveTo(r.x, y); ctx.lineTo(r.x + r.w, y); }
  ctx.lineWidth = 1; ctx.strokeStyle = T.weave; ctx.stroke();
  // soft pucker bands (kantha ripples), stronger as the patch is sewn
  if (puck > 0) {
    const n = 11;
    for (let k = 0; k < n; k++) {
      const y = r.y + (r.h * (k + 0.5)) / n + Math.sin(t * 0.8 + k) * 1.5 * puck, bh = r.h / n;
      const gr = ctx.createLinearGradient(0, y - bh / 2, 0, y + bh / 2);
      gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.35, `rgba(255,255,255,${0.12 * puck})`);
      gr.addColorStop(0.7, `rgba(0,0,0,${0.12 * puck})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gr; ctx.fillRect(r.x, y - bh / 2, r.w, bh);
    }
  }
  ctx.restore();
  // a running-stitch border just inside the edge
  ctx.save(); ctx.lineWidth = Math.max(1.4, s * 0.004); ctx.strokeStyle = T.edge; ctx.setLineDash([s * 0.018, s * 0.012]);
  rr(ctx, r.x + s * 0.016, r.y + s * 0.016, r.w - s * 0.032, r.h - s * 0.032, s * 0.008); ctx.stroke(); ctx.setLineDash([]); ctx.restore();
}

// ---- rows --------------------------------------------------------------------------------------------------------------------------------------
export function chalkRun(ctx, geo, run, { color = null, alpha = 1, glow = false, width = 0.07 } = {}) {
  const T = theme(), d = dashesFor(run, 0), w = Math.max(2, geo.s * width);
  if (glow) {
    buildPath(ctx, geo, d, 1e9); ctx.lineCap = 'round'; ctx.lineWidth = w * 3.2; ctx.strokeStyle = rgba(threadColor(run.color), 0.22); ctx.stroke();
  }
  buildPath(ctx, geo, d, 1e9);
  ctx.lineCap = 'round'; ctx.lineWidth = w * 0.72; ctx.strokeStyle = T.chalk; ctx.globalAlpha = alpha; ctx.stroke();
  // a tint of the thread colour so the player knows what the row needs
  ctx.lineWidth = w * 0.4; ctx.strokeStyle = rgba(color ?? threadColor(run.color), glow ? 0.9 : 0.55); ctx.stroke();
  ctx.globalAlpha = 1; ctx.lineCap = 'butt';
}
// A sewn (or part-sewn) row: shadow, thread and a thin highlight, so it sits on the cloth.
export function threadRun(ctx, geo, run, optIdx, upTo, slot, { width = 0.078, alpha = 1, loose = false } = {}) {
  const d = dashesFor(run, optIdx), w = Math.max(2.2, geo.s * width), col = threadColor(slot), s = geo.s;
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.globalAlpha = alpha;
  buildPath(ctx, geo, d, upTo, s * 0.04, s * 0.055); ctx.lineWidth = w * 1.35; ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.stroke();
  buildPath(ctx, geo, d, upTo); ctx.lineWidth = w; ctx.strokeStyle = loose ? mix(col, '#808080', 0.5) : col; ctx.stroke();
  buildPath(ctx, geo, d, upTo, -s * 0.01, -s * 0.014); ctx.lineWidth = w * 0.32; ctx.strokeStyle = mix(col, '#ffffff', 0.5); ctx.globalAlpha = alpha * 0.55; ctx.stroke();
  ctx.restore();
}
// The faint thread that crossed under the cloth between two rows (seen through the weave).
export function floatLine(ctx, geo, a, b, slot, alpha = 0.4) {
  if (!a || !b) return;
  const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy);
  if (len < 0.05) return;
  ctx.save(); ctx.setLineDash([geo.s * 0.07, geo.s * 0.1]); ctx.lineCap = 'round'; ctx.lineWidth = Math.max(1.4, geo.s * 0.035);
  ctx.strokeStyle = rgba(threadColor(slot), alpha);
  ctx.beginPath(); ctx.moveTo(geo.X(a[0]), geo.Y(a[1])); ctx.lineTo(geo.X(b[0]), geo.Y(b[1])); ctx.stroke(); ctx.setLineDash([]); ctx.restore();
}

// ---- markers, needle ---------------------------------------------------------------------------------------------------------------------
export function marker(ctx, x, y, r, slot, { active = false, pulse = 0, dim = false, fresh = false } = {}) {
  const T = theme(), col = threadColor(slot);
  ctx.save(); if (dim) ctx.globalAlpha = 0.4;
  if (active || pulse > 0) { ctx.beginPath(); ctx.arc(x, y, r * (1.7 + 0.5 * pulse), 0, TAU); ctx.fillStyle = rgba(col, 0.28); ctx.fill(); }
  ctx.beginPath(); ctx.arc(x, y, r + 1.6, 0, TAU); ctx.fillStyle = 'rgba(0,0,0,0.38)'; ctx.fill();
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU);
  if (fresh) {
    // this end would need a new thread: a hollow ring with a dashed edge
    ctx.fillStyle = rgba(T.marker, 0.35); ctx.fill();
    ctx.lineWidth = Math.max(2, r * 0.3); ctx.strokeStyle = col; ctx.setLineDash([r * 0.7, r * 0.5]); ctx.stroke(); ctx.setLineDash([]);
  } else {
    ctx.fillStyle = T.marker; ctx.fill();
    ctx.lineWidth = Math.max(2, r * 0.34); ctx.strokeStyle = col; ctx.stroke();
  }
  ctx.restore();
}
// A colour-blind mark inside a marker or beside a row: circle, triangle, square, diamond, plus.
export function glyph(ctx, x, y, r, slot, col) {
  ctx.save(); ctx.fillStyle = col; ctx.strokeStyle = col; ctx.lineWidth = Math.max(1.5, r * 0.3); ctx.beginPath();
  const k = slot % 5;
  if (k === 0) ctx.arc(x, y, r * 0.62, 0, TAU);
  else if (k === 1) { ctx.moveTo(x, y - r * 0.75); ctx.lineTo(x + r * 0.72, y + r * 0.5); ctx.lineTo(x - r * 0.72, y + r * 0.5); ctx.closePath(); }
  else if (k === 2) ctx.rect(x - r * 0.55, y - r * 0.55, r * 1.1, r * 1.1);
  else if (k === 3) { ctx.moveTo(x, y - r * 0.8); ctx.lineTo(x + r * 0.7, y); ctx.lineTo(x, y + r * 0.8); ctx.lineTo(x - r * 0.7, y); ctx.closePath(); }
  else { ctx.moveTo(x - r * 0.7, y); ctx.lineTo(x + r * 0.7, y); ctx.moveTo(x, y - r * 0.7); ctx.lineTo(x, y + r * 0.7); ctx.stroke(); ctx.restore(); return; }
  ctx.fill(); ctx.restore();
}
// The needle with its thread tail. (x, y) is the tip, `ang` the direction of travel.
export function needle(ctx, x, y, size, ang, slot, { lift = 0.5, tail = null } = {}) {
  const col = threadColor(slot), L = size * 3.1, a = ang - 2.45 + lift * 0.0;   // lies back along the path, tilted up
  const bx = x + Math.cos(a) * L, by = y + Math.sin(a) * L;
  ctx.save(); ctx.lineCap = 'round';
  if (tail) { ctx.beginPath(); ctx.moveTo(bx, by); ctx.quadraticCurveTo(tail.x, tail.y, tail.ex, tail.ey); ctx.lineWidth = Math.max(2, size * 0.2); ctx.strokeStyle = col; ctx.stroke(); }
  // shadow, steel body, bright edge, eye
  ctx.beginPath(); ctx.moveTo(x + size * 0.18, y + size * 0.26); ctx.lineTo(bx + size * 0.18, by + size * 0.26); ctx.lineWidth = Math.max(2.5, size * 0.3); ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(bx, by); ctx.lineWidth = Math.max(2.4, size * 0.26); ctx.strokeStyle = '#b9c2cf'; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(bx, by); ctx.lineWidth = Math.max(1, size * 0.08); ctx.strokeStyle = '#ffffff'; ctx.stroke();
  ctx.beginPath(); ctx.ellipse(bx, by, size * 0.17, size * 0.34, a + Math.PI / 2, 0, TAU); ctx.lineWidth = Math.max(1.4, size * 0.1); ctx.strokeStyle = col; ctx.stroke();
  ctx.restore();
}

// ---- thread gauge ------------------------------------------------------------------------------------------------------------------------------
// r: the gauge rect. Draws a spool and a bar: `rem` of `cap` units left in the current thread, `use` units about to be used.
export function threadBar(ctx, r, { cap, rem, use = 0, slot, fresh = false, newThread = false, spool = true }) {
  const T = theme(), col = threadColor(slot ?? 0), h = Math.min(r.h, 30), y = r.y + (r.h - h) / 2, sp = spool ? h + 6 : 0;
  if (spool) {
    ctx.save();
    const cx = r.x + sp / 2, cy = y + h / 2;
    rr(ctx, cx - h * 0.46, cy - h * 0.5, h * 0.92, h, h * 0.18); ctx.fillStyle = col; ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(cx - h * 0.46, cy - h * 0.12, h * 0.92, h * 0.24);
    ctx.fillStyle = mix('#d9c9a0', '#8a7447', 0.2); ctx.fillRect(cx - h * 0.56, cy - h * 0.5, h * 1.12, h * 0.14); ctx.fillRect(cx - h * 0.56, cy + h * 0.36, h * 1.12, h * 0.14);
    ctx.restore();
  }
  const bx = r.x + sp + (spool ? 8 : 0), bw = r.w - sp - (spool ? 8 : 0), by = y + h * 0.12, bh = h * 0.76;
  // the trough: carved into the plaque, with a lit lower lip
  rr(ctx, bx - 2, by - 2, bw + 4, bh + 4, bh / 2 + 2); ctx.fillStyle = 'rgba(255,225,170,0.18)'; ctx.fill();
  rr(ctx, bx, by, bw, bh, bh / 2); ctx.fillStyle = 'rgba(8,3,1,0.78)'; ctx.fill();
  if (!fresh) {
    const f = clamp(rem / cap, 0, 1), w = Math.max(bh, bw * f);
    if (rem > 0.01) {
      ctx.save(); rr(ctx, bx, by, w, bh, bh / 2); ctx.clip();
      const g = ctx.createLinearGradient(0, by, 0, by + bh); g.addColorStop(0, mix(col, '#ffffff', 0.4)); g.addColorStop(0.45, col); g.addColorStop(1, mix(col, '#000000', 0.45));
      ctx.fillStyle = g; ctx.fillRect(bx, by, w, bh);
      // the twist of the thread: diagonal plies
      ctx.strokeStyle = 'rgba(0,0,0,0.22)'; ctx.lineWidth = 2; ctx.beginPath();
      for (let x = bx - bh; x < bx + w; x += 9) { ctx.moveTo(x, by + bh); ctx.lineTo(x + bh * 0.8, by); }
      ctx.stroke();
      ctx.restore();
    }
    if (use > 0) {
      const u = clamp(use / cap, 0, 1) * bw, x1 = bx + Math.max(0, bw * f - u);
      ctx.save(); rr(ctx, bx, by, w, bh, bh / 2); ctx.clip();
      ctx.fillStyle = newThread ? rgba(T.err, 0.85) : 'rgba(255,255,255,0.6)'; ctx.fillRect(x1, by, bx + bw * f - x1 + 2, bh);
      ctx.restore();
    }
  }
  rr(ctx, bx, by, bw, bh, bh / 2); ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.stroke();
}

// ---- mini patches (quilt map, results, daily) ---------------------------------------------------------------------------------------------
export function miniPatch(ctx, r, P, { done = false, locked = false, t = 0 } = {}) {
  const T = theme(), s = r.w / P.size, geo = { X: (x) => r.x + x * s, Y: (y) => r.y + y * s, s, size: P.size };
  ctx.save();
  rr(ctx, r.x + 2, r.y + 3, r.w, r.h, r.w * 0.08); ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fill();
  const g = ctx.createLinearGradient(r.x, r.y, r.x + r.w * 0.4, r.y + r.h);
  g.addColorStop(0, T.patch0); g.addColorStop(1, T.patch1);
  rr(ctx, r.x, r.y, r.w, r.h, r.w * 0.08); ctx.fillStyle = g; ctx.fill();
  ctx.clip();
  ctx.globalAlpha = locked ? 0.35 : 1;
  const wd = Math.max(1.5, s * 0.075);
  for (const run of P.runs) {
    const d = dashesFor(run, 0, DASH * 1.15, GAP * 1.1);
    buildPath(ctx, geo, d, 1e9);
    ctx.lineCap = 'round';
    if (done) { ctx.lineWidth = wd; ctx.strokeStyle = threadColor(run.color); } else { ctx.lineWidth = Math.max(1.2, wd * 0.8); ctx.strokeStyle = T.chalk; }
    ctx.stroke();
  }
  ctx.restore();
  rr(ctx, r.x, r.y, r.w, r.h, r.w * 0.08); ctx.lineWidth = 1.5; ctx.strokeStyle = done ? rgba(T.accent, 0.8) : T.line; ctx.stroke();
}

// A tiny animated running stitch used on the title and menus: a dashed line being sewn left to right and back.
export function sewnLine(ctx, x0, x1, y, t, col, { amp = 6, period = 120, n = 14, width = 5 } = {}) {
  const T = theme(), len = x1 - x0, pitch = len / n, prog = (t % 6) / 4;
  ctx.save(); ctx.lineCap = 'round'; ctx.lineWidth = width;
  for (let i = 0; i < n; i++) {
    const a = x0 + i * pitch, b = a + pitch * 0.62, f = i / n;
    if (f > prog) break;
    const ya = y + Math.sin(a / period * TAU) * amp, yb = y + Math.sin(b / period * TAU) * amp;
    ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.moveTo(a + 1.5, ya + 2.5); ctx.lineTo(b + 1.5, yb + 2.5); ctx.stroke();
    ctx.strokeStyle = col; ctx.beginPath(); ctx.moveTo(a, ya); ctx.lineTo(b, yb); ctx.stroke();
  }
  ctx.restore();
  void T;
}
