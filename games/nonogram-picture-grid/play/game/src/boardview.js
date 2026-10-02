// Draws a nonogram board: paper card, clue panels, lit tiles, guides, hints. Used by play, Watch & Learn, the title and the Rules art.
import { rr, text, NUM, alpha, mix, clamp01, ease, backOut } from './art.js';
import { PAL } from './palette.js';
import { FILLED, CROSSED } from './solver.js';

export function drawTile(ctx, th, x, y, s, kind, o = {}) {
  // kind: 0 empty, 1 filled, 2 crossed
  const inset = Math.max(0.8, s * 0.04), r = s * 0.14;
  const sc = o.scale ?? 1;
  const cx = x + s / 2, cy = y + s / 2;
  const w = (s - inset * 2) * sc;
  const tx = cx - w / 2, ty = cy - w / 2;
  if (kind === FILLED) {
    ctx.fillStyle = th.fill[2]; rr(ctx, tx, ty + Math.max(1.5, s * 0.05), w, w, r); ctx.fill();
    ctx.fillStyle = th.fill[0]; rr(ctx, tx, ty, w, w - Math.max(1.5, s * 0.05) * 0.4, r); ctx.fill();
    ctx.strokeStyle = th.fill[1]; ctx.lineWidth = Math.max(1.2, s * 0.045); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(tx + r, ty + 1); ctx.lineTo(tx + w - r, ty + 1); ctx.moveTo(tx + 1, ty + r); ctx.lineTo(tx + 1, ty + w - r); ctx.stroke();
  } else {
    ctx.fillStyle = th.tile; rr(ctx, tx, ty, w, w, r); ctx.fill();
    ctx.fillStyle = th.tileLo; ctx.fillRect(tx + r * 0.6, ty + w - Math.max(1, s * 0.035), w - r * 1.2, Math.max(1, s * 0.035));
    ctx.strokeStyle = th.tileEdge; ctx.lineWidth = 1; rr(ctx, tx, ty, w, w, r); ctx.stroke();
    if (kind === CROSSED) {
      const m = s * 0.3;
      ctx.strokeStyle = th.cross; ctx.lineWidth = Math.max(2, s * 0.085); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x + m, y + m); ctx.lineTo(x + s - m, y + s - m); ctx.moveTo(x + s - m, y + m); ctx.lineTo(x + m, y + s - m); ctx.stroke();
    }
  }
}

export function drawNonogram(ctx, th, puz, cells, g, o = {}) {
  const { s, view } = g;
  const t = o.t ?? 0;
  if (!o.noCard) {
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = 22; ctx.shadowOffsetY = 8;
    const cg = ctx.createLinearGradient(0, g.card.y, 0, g.card.y + g.card.h);
    cg.addColorStop(0, th.card[0]); cg.addColorStop(1, th.card[1]);
    ctx.fillStyle = cg; rr(ctx, g.card.x, g.card.y, g.card.w, g.card.h, 22); ctx.fill();
    ctx.restore();
    ctx.strokeStyle = th.cardEdge; ctx.lineWidth = 2; rr(ctx, g.card.x, g.card.y, g.card.w, g.card.h, 22); ctx.stroke();
  }
  const x0 = Math.floor(g.ox / s), y0 = Math.floor(g.oy / s);
  const x1 = Math.min(puz.w - 1, Math.ceil((g.ox + view.w) / s)), y1 = Math.min(puz.h - 1, Math.ceil((g.oy + view.h) / s));
  const px = (c) => view.x + c * s - g.ox, py = (r) => view.y + r * s - g.oy;

  // grid
  ctx.save();
  ctx.beginPath(); ctx.rect(view.x, view.y, view.w, view.h); ctx.clip();
  const hintAt = new Map();
  if (o.hint) for (const c of o.hint.cells) hintAt.set(c.at, c.v);
  for (let r = y0; r <= y1; r++) {
    for (let c = x0; c <= x1; c++) {
      const i = r * puz.w + c;
      const pop = o.pops?.get(i);
      const k = pop !== undefined ? backOut(clamp01((t - pop) / 0.18)) : 1;
      drawTile(ctx, th, px(c), py(r), s, cells[i], { scale: cells[i] === FILLED ? 0.72 + 0.28 * k : 1 });
    }
  }
  // guide lines every five squares
  ctx.strokeStyle = th.guide; ctx.lineWidth = Math.max(1.5, s * 0.04);
  ctx.beginPath();
  for (let c = 5; c < puz.w; c += 5) { const xx = view.x + c * s - g.ox; ctx.moveTo(xx, view.y); ctx.lineTo(xx, view.y + view.h); }
  for (let r = 5; r < puz.h; r += 5) { const yy = view.y + r * s - g.oy; ctx.moveTo(view.x, yy); ctx.lineTo(view.x + view.w, yy); }
  ctx.stroke();
  // finger focus: the row and column of the touched square
  if (o.focus) {
    ctx.fillStyle = th.row;
    ctx.fillRect(view.x, py(o.focus.r), view.w, s);
    ctx.fillRect(px(o.focus.c), view.y, s, view.h);
  }
  // hint: the line and the squares it decides
  if (o.hint) {
    const h = o.hint, pulse = 0.55 + 0.45 * Math.sin(t * 5);
    ctx.fillStyle = alpha(th.hint, 0.2);
    if (h.axis === 'row') ctx.fillRect(view.x, py(h.k), view.w, s); else ctx.fillRect(px(h.k), view.y, s, view.h);
    for (const cc of h.cells) {
      const c = cc.at % puz.w, r = Math.floor(cc.at / puz.w);
      if (c < x0 || c > x1 || r < y0 || r > y1) continue;
      const x = px(c), y = py(r);
      ctx.fillStyle = alpha(th.hint, 0.28 * pulse);
      rr(ctx, x + 2, y + 2, s - 4, s - 4, s * 0.14); ctx.fill();
      ctx.strokeStyle = th.hint; ctx.lineWidth = Math.max(2.5, s * 0.07); ctx.globalAlpha = 0.6 + 0.4 * pulse;
      rr(ctx, x + 2, y + 2, s - 4, s - 4, s * 0.14); ctx.stroke(); ctx.globalAlpha = 1;
      if (cc.v === FILLED) { ctx.fillStyle = alpha(th.fill[0], 0.55); rr(ctx, x + s * 0.28, y + s * 0.28, s * 0.44, s * 0.44, s * 0.08); ctx.fill(); }
      else { ctx.strokeStyle = th.cross; ctx.lineWidth = Math.max(2, s * 0.08); ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x + s * 0.3, y + s * 0.3); ctx.lineTo(x + s * 0.7, y + s * 0.7); ctx.moveTo(x + s * 0.7, y + s * 0.3); ctx.lineTo(x + s * 0.3, y + s * 0.7); ctx.stroke(); }
    }
  }
  // refused marks flash red
  if (o.flashes) {
    for (const [i, t0] of o.flashes) {
      const a = 1 - clamp01((t - t0) / 0.55);
      if (a <= 0) continue;
      const c = i % puz.w, r = Math.floor(i / puz.w);
      ctx.fillStyle = alpha(th.bad, 0.65 * a); rr(ctx, px(c) + 1, py(r) + 1, s - 2, s - 2, s * 0.14); ctx.fill();
    }
  }
  ctx.restore();

  // clue panels (stick to the visible squares)
  const ca = o.clueAlpha ?? 1;
  if (ca > 0) {
    ctx.save();
    ctx.globalAlpha = ca;
    const rp = g.rowPanel, cp = g.colPanel;
    ctx.fillStyle = alpha('#000000', 0.06);
    rr(ctx, rp.x, rp.y, rp.w, rp.h, 12); ctx.fill();
    rr(ctx, cp.x, cp.y, cp.w, cp.h, 12); ctx.fill();
    ctx.save(); ctx.beginPath(); ctx.rect(rp.x, rp.y, rp.w, rp.h); ctx.clip();
    for (let r = y0; r <= y1; r++) {
      const list = puz.rows[r].length ? puz.rows[r] : [0];
      const done = o.doneR?.[r];
      const yc = py(r) + s / 2;
      const hot = (o.focus && o.focus.r === r) || (o.hint && o.hint.axis === 'row' && o.hint.k === r);
      drawClueRow(ctx, th, list, rp.x + rp.w - g.pad, yc, g, done, hot);
    }
    ctx.restore();
    ctx.save(); ctx.beginPath(); ctx.rect(cp.x, cp.y, cp.w, cp.h); ctx.clip();
    for (let c = x0; c <= x1; c++) {
      const list = puz.cols[c].length ? puz.cols[c] : [0];
      const done = o.doneC?.[c];
      const xc = px(c) + s / 2;
      const hot = (o.focus && o.focus.c === c) || (o.hint && o.hint.axis === 'col' && o.hint.k === c);
      drawClueCol(ctx, th, list, xc, cp.y + cp.h - g.pad, g, done, hot);
    }
    ctx.restore();
    ctx.restore();
  }
}

function drawClueRow(ctx, th, list, xr, yc, g, done, hot) {
  const f = g.f;
  ctx.font = `700 ${f}px ${NUM}`;
  let wTotal = 0;
  for (const n of list) wTotal += ctx.measureText(String(n)).width;
  wTotal += g.gap * (list.length - 1);
  if (done || hot) {
    ctx.fillStyle = hot ? th.row : th.clueDoneBg;
    rr(ctx, xr - wTotal - g.pad * 0.6, yc - f * 0.7, wTotal + g.pad * 1.2, f * 1.4, f * 0.35); ctx.fill();
  }
  let x = xr;
  for (let i = list.length - 1; i >= 0; i--) {
    const str = String(list[i]), w = ctx.measureText(str).width;
    text(ctx, str, x - w / 2, yc + f * 0.36, f, done ? th.clueDone : th.clue, { weight: 700, font: NUM });
    x -= w + g.gap;
  }
}
function drawClueCol(ctx, th, list, xc, yb, g, done, hot) {
  const f = g.f;
  const total = list.length * g.lh;
  if (done || hot) {
    ctx.fillStyle = hot ? th.row : th.clueDoneBg;
    rr(ctx, xc - f * 0.7, yb - total - g.pad * 0.2, f * 1.4, total + g.pad * 0.4, f * 0.35); ctx.fill();
  }
  for (let i = list.length - 1, k = 0; i >= 0; i--, k++) {
    text(ctx, String(list[i]), xc, yb - k * g.lh - g.lh * 0.22, f, done ? th.clueDone : th.clue, { weight: 700, font: NUM });
  }
}

// ------------------------------------------------------------------------------------------- the finished picture
// A mosaic of the real colours. gap: space between tiles (0 for the seamless final picture). k: colour amount 0..1 (0 = ink, 1 = colour).
export function drawPicture(ctx, th, puz, x, y, side, o = {}) {
  const k = o.k ?? 1, gap = o.gap ?? 0;
  const s = side / Math.max(puz.w, puz.h);
  const pw = s * puz.w, ph = s * puz.h;
  const ox = x + (side - pw) / 2, oy = y + (side - ph) / 2;
  ctx.save();
  if (o.frame !== false) {
    ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 26; ctx.shadowOffsetY = 10;
    ctx.fillStyle = th.card[0]; rr(ctx, ox - 14, oy - 14, pw + 28, ph + 28, 20); ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = th.cardEdge; ctx.lineWidth = 2; rr(ctx, ox - 14, oy - 14, pw + 28, ph + 28, 20); ctx.stroke();
  }
  ctx.beginPath(); rr(ctx, ox, oy, pw, ph, 6); ctx.clip();
  ctx.fillStyle = mix(th.tile.length === 7 ? th.tile : '#f4ecd9', puz.bg, k); ctx.fillRect(ox, oy, pw, ph);
  const cx = puz.w / 2, cy = puz.h / 2, maxD = Math.hypot(cx, cy);
  for (let r = 0; r < puz.h; r++) {
    for (let c = 0; c < puz.w; c++) {
      const ch = puz.art[r][c];
      if (ch === '.') continue;
      const d = Math.hypot(c + 0.5 - cx, r + 0.5 - cy) / maxD;
      const kk = o.wave ? clamp01((k * (1 + o.wave) - d * o.wave)) : k;
      ctx.fillStyle = mix(th.fill[0], PAL[ch] ?? '#ff00ff', ease(kk));
      const g2 = gap;
      ctx.fillRect(ox + c * s + g2 / 2, oy + r * s + g2 / 2, s - g2 + 0.6, s - g2 + 0.6);
      if (kk > 0.6 && s > 6) { ctx.fillStyle = `rgba(255,255,255,${0.1 * kk})`; ctx.fillRect(ox + c * s + g2 / 2, oy + r * s + g2 / 2, s - g2 + 0.6, Math.max(1, s * 0.12)); }
    }
  }
  ctx.restore();
}
