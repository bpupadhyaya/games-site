// Small illustrations for the Rules / How to Play / About pages. They reuse the game's own stones and gauges.
import { theme, rr, txt, mix, rgba, UI, F, panel } from './ui.js';
import { v3 } from './v3.js';
import { drawStone } from './stones.js';
import { linesFor } from './engine.js';

const LOSHU = [4, 9, 2, 3, 5, 7, 8, 1, 6];
const SHIFT = [7, 12, 5, 6, 8, 10, 11, 4, 9];   // 4..12 shifted by 3? uses 4..12: 4 9 2 pattern + 3
const PAN4 = [1, 8, 13, 12, 14, 11, 2, 7, 4, 5, 16, 9, 15, 10, 3, 6];

function boardBox(ctx, r, n) {
  const T = theme(), s = Math.min(r.w, r.h), B = s * 0.96, x = r.x + (r.w - B) / 2, y = r.y + (r.h - B) / 2;
  if (v3.on) panel(ctx, { x, y, w: B, h: B }, { radius: B * 0.05, fill: T.frame });
  else { rr(ctx, x, y, B, B, B * 0.05); ctx.fillStyle = T.frame; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = T.rim; ctx.stroke(); }
  const pad = B * 0.07, cs = (B - 2 * pad) / n;
  return { x, y, B, pad, cs, cx: (i) => x + pad + (i % n + 0.5) * cs, cy: (i) => y + pad + (Math.floor(i / n) + 0.5) * cs };
}
function sockets(ctx, b, n) {
  const T = theme();
  for (let i = 0; i < n * n; i++) {
    if (v3.on) { panel(ctx, { x: b.cx(i) - b.cs * 0.46, y: b.cy(i) - b.cs * 0.46, w: b.cs * 0.92, h: b.cs * 0.92 }, { radius: b.cs * 0.14, fill: T.socket, z: 0.5 }); continue; }
    rr(ctx, b.cx(i) - b.cs * 0.46, b.cy(i) - b.cs * 0.46, b.cs * 0.92, b.cs * 0.92, b.cs * 0.14); ctx.fillStyle = T.socket; ctx.fill();
  }
}
function lineStroke(ctx, b, n, cells, col, wdt) {
  ctx.beginPath(); cells.forEach((c, k) => { const x = b.cx(c), y = b.cy(c); if (k) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
  ctx.lineWidth = wdt; ctx.lineCap = 'round'; ctx.strokeStyle = col; ctx.stroke();
}

export function drawFigure(ctx, r, key, t = 0) {
  const T = theme();
  if (key === 'tray') {
    const n = 9, s = Math.min(r.w / 5.2, r.h / 2.6, 90);
    const x0 = r.x + (r.w - (5 * s + 4 * 8)) / 2;
    for (let i = 0; i < 9; i++) {
      const cx = x0 + (i % 5) * (s + 8) + s / 2, cy = r.y + r.h / 2 - s * 0.5 + Math.floor(i / 5) * (s + 8) + s / 2;
      if (i === 4 || i === 6) { ctx.beginPath(); ctx.arc(cx, cy, s * 0.4, 0, 7); ctx.lineWidth = 2; ctx.setLineDash([5, 6]); ctx.strokeStyle = T.line; ctx.stroke(); ctx.setLineDash([]); }
      else drawStone(ctx, cx, cy, s * 0.42, i + 1, {});
    }
    return;
  }
  if (key === 'sums') {
    const n = 3, b = boardBox(ctx, { x: r.x, y: r.y, w: r.w * 0.72, h: r.h }, n);
    sockets(ctx, b, n);
    const vals = [4, 9, 2, 3, 5, 0, 0, 0, 0];
    vals.forEach((v, i) => v && drawStone(ctx, b.cx(i), b.cy(i), b.cs * 0.4, v, { kind: i < 2 ? 'given' : 'stone' }));
    const gx = b.x + b.B + 14, rs = [['15', 'ok'], ['8', 'part'], ['0', 'part']];
    rs.forEach(([txtv, st], k) => gauge(ctx, Math.min(r.x + r.w - 30, gx + 26), b.cy(k * 3), 26, txtv === '15' ? 15 : Number(txtv), 15, true));
    return;
  }
  const n = key === 'pan' ? 4 : 3, vals = key === 'shift' ? SHIFT : key === 'pan' ? PAN4 : LOSHU, style = key === 'dots' ? 'dots' : 'digits';
  const b = boardBox(ctx, r, n);
  sockets(ctx, b, n);
  const L = linesFor(n, key === 'pan');
  const pulse = 0.5 + 0.5 * Math.sin(t * 2.2);
  if (key === 'lines') {
    const cols = ['#ffd36b', '#6fe0b0', '#8cc8ff', '#ff9a7a'];
    [L[0], L[3], L[6], L[7]].forEach((l, k) => lineStroke(ctx, b, n, l.cells, rgba(cols[k], 0.55), b.cs * 0.16));
  } else if (key === 'loshu' || key === 'dots') {
    lineStroke(ctx, b, n, L[1].cells, rgba(T.sel, 0.35 + 0.3 * pulse), b.cs * 0.2);
  } else if (key === 'centre') {
    [L[1], L[4], L[6], L[7]].forEach((l) => lineStroke(ctx, b, n, l.cells, rgba(T.sel, 0.4), b.cs * 0.14));
  } else if (key === 'pan') {
    const l = L.find((q) => q.kind === 'bdiag' && q.idx === 1);
    lineStroke(ctx, b, n, l.cells.slice(0, 3), rgba(T.sel, 0.55), b.cs * 0.16);
    l.cells.forEach((c) => { ctx.beginPath(); ctx.arc(b.cx(c), b.cy(c), b.cs * 0.5, 0, 7); ctx.lineWidth = 3; ctx.strokeStyle = T.sel; ctx.stroke(); });
  }
  vals.forEach((v, i) => drawStone(ctx, b.cx(i), b.cy(i), b.cs * 0.4, v, { kind: key === 'centre' && i === 4 ? 'given' : 'stone', style }));
}

// shared with the play screen: a round sum gauge
export function gauge(ctx, cx, cy, r, sum, M, filled, { pulse = 0, hot = false, over = null, label = null } = {}) {
  const T = theme(), isOver = over ?? (sum > M || (filled && sum !== M)), ok = filled && sum === M;
  ctx.save();
  if (v3.on) panel(ctx, { x: cx - r, y: cy - r, w: 2 * r, h: 2 * r }, { radius: r, fill: '#0a0f0e', z: 0.5 });
  else { ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.fillStyle = T.dark ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.7)'; ctx.fill(); }
  const col = ok ? T.sel : isOver ? T.err : T.good;
  ctx.lineWidth = Math.max(3, r * 0.2); ctx.strokeStyle = T.dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'; ctx.beginPath(); ctx.arc(cx, cy, r * 0.8, 0, 7); ctx.stroke();
  const k = Math.max(0, Math.min(1, M ? sum / M : 0));
  if (k > 0) { ctx.strokeStyle = col; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(cx, cy, r * 0.8, -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2); ctx.stroke(); }
  if (ok || pulse > 0 || hot) { ctx.beginPath(); ctx.arc(cx, cy, r * 1.04 + pulse * r * 0.2, 0, 7); ctx.lineWidth = Math.max(2, r * 0.1); ctx.strokeStyle = rgba(ok ? T.sel : T.accent, hot ? 0.95 : 0.7 - pulse * 0.4); ctx.stroke(); }
  const s = label ?? String(sum);
  txt(ctx, s, cx, cy + r * 0.04, { size: r * (s.length > 2 ? 0.7 : 0.88), weight: 700, color: ok ? T.sel : isOver ? T.err : T.text, align: 'center', fam: UI });
  ctx.restore();
}
