// Fabric, blocks and quilts as pictures. Procedural cloth: a print drawn in block coordinates (so a stripe or plaid runs
// straight through neighbouring pieces), a fine weave, puffy edge shading, a topstitch beside every seam, and a soft drape of
// light over a finished top. No clock and no randomness: positions come from hashes of coordinates.
import { blockOf, rotPoint } from './blocks.js';
import { fab } from './fabrics.js';
import { quiltGeo } from './rules.js';

const grayCache = new Map();
const hexRgb = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
export const toGray = (hex) => { let v = grayCache.get(hex); if (!v) { const [r, g, b] = hexRgb(hex), y = Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b); v = `rgb(${y},${y},${y})`; grayCache.set(hex, v); } return v; };
const mixCache = new Map();
export const mixHex = (a, b, t) => { const key = a + b + t; let v = mixCache.get(key); if (!v) { const x = hexRgb(a), y = hexRgb(b); v = `rgb(${x.map((c, i) => Math.round(c + (y[i] - c) * t)).join(',')})`; mixCache.set(key, v); } return v; };

const poly = (ctx, pts) => { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.closePath(); };
const bbox = (pts) => { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const p of pts) { if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1]; } return [x0, y0, x1, y1]; };
const cen = (pts) => { let x = 0, y = 0; for (const p of pts) { x += p[0]; y += p[1]; } return [x / pts.length, y / pts.length]; };

// ---- prints ------------------------------------------------------------------------------------------------------------------
function drawPrint(ctx, f, x0, y0, x1, y1, u, ax, ay, sq) {
  if (f.print === 'solid' || u < 3.5) return;
  const ink = sq ? toGray(f.ink) : f.ink, w = x1 - x0, h = y1 - y0;
  ctx.save(); ctx.fillStyle = ink; ctx.strokeStyle = ink;
  const startX = (step) => ax + Math.floor((x0 - ax) / step) * step, startY = (step) => ay + Math.floor((y0 - ay) / step) * step;
  if (f.print === 'dot') {
    const st = u * 0.55; if ((w / st) * (h / st) > 1400) { ctx.restore(); return; }
    ctx.globalAlpha = 0.9; ctx.beginPath();
    for (let y = startY(st), j = 0; y < y1 + st; y += st, j++) for (let x = startX(st) + ((Math.round((y - ay) / st) & 1) ? st / 2 : 0); x < x1 + st; x += st) { ctx.moveTo(x + u * 0.07, y); ctx.arc(x, y, u * 0.07, 0, 6.2832); }
    ctx.fill();
  } else if (f.print === 'stripe') {
    const st = u * 0.5; if (w / st > 400) { ctx.restore(); return; }
    ctx.globalAlpha = 0.85; ctx.beginPath();
    for (let x = startX(st); x < x1; x += st) ctx.rect(x, y0 - 1, u * 0.17, h + 2);
    ctx.fill();
  } else if (f.print === 'gingham') {
    const st = u * 0.7; if ((w / st) + (h / st) > 600) { ctx.restore(); return; }
    ctx.globalAlpha = 0.32; ctx.beginPath();
    for (let x = startX(st); x < x1; x += st) ctx.rect(x, y0 - 1, st / 2, h + 2);
    ctx.fill(); ctx.beginPath();
    for (let y = startY(st); y < y1; y += st) ctx.rect(x0 - 1, y, w + 2, st / 2);
    ctx.fill();
  } else if (f.print === 'ditsy') {
    const st = u * 1.0; if ((w / st) * (h / st) > 700) { ctx.restore(); return; }
    ctx.globalAlpha = 0.9; ctx.beginPath(); const r = u * 0.13, d = u * 0.15;
    for (let y = startY(st); y < y1 + st; y += st) for (let x = startX(st) + ((Math.round((y - ay) / st) & 1) ? st / 2 : 0); x < x1 + st; x += st) {
      for (let k = 0; k < 5; k++) { const a = (k / 5) * 6.2832 - 1.5708, px = x + Math.cos(a) * d, py = y + Math.sin(a) * d; ctx.moveTo(px + r, py); ctx.arc(px, py, r, 0, 6.2832); }
    }
    ctx.fill();
    ctx.globalAlpha = 1; ctx.fillStyle = sq ? toGray(f.base) : f.base; ctx.beginPath();
    for (let y = startY(st); y < y1 + st; y += st) for (let x = startX(st) + ((Math.round((y - ay) / st) & 1) ? st / 2 : 0); x < x1 + st; x += st) { ctx.moveTo(x + r * 0.7, y); ctx.arc(x, y, r * 0.7, 0, 6.2832); }
    ctx.fill();
  } else if (f.print === 'plaid') {
    const st = u * 1.6; if ((w / st) + (h / st) > 300) { ctx.restore(); return; }
    ctx.globalAlpha = 0.28; ctx.beginPath();
    for (let x = startX(st); x < x1; x += st) ctx.rect(x, y0 - 1, u * 0.5, h + 2);
    for (let y = startY(st); y < y1; y += st) ctx.rect(x0 - 1, y, w + 2, u * 0.5);
    ctx.fill();
    ctx.globalAlpha = 0.55; ctx.lineWidth = Math.max(0.8, u * 0.04); ctx.beginPath();
    for (let x = startX(st / 2) + u * 0.8; x < x1; x += st) { ctx.moveTo(x, y0 - 1); ctx.lineTo(x, y1 + 1); }
    for (let y = startY(st / 2) + u * 0.8; y < y1; y += st) { ctx.moveTo(x0 - 1, y); ctx.lineTo(x1 + 1, y); }
    ctx.stroke();
  } else if (f.print === 'lattice') {
    const st = u * 0.7; if ((w + h) / st > 500) { ctx.restore(); return; }
    ctx.globalAlpha = 0.75; ctx.lineWidth = Math.max(0.8, u * 0.055); ctx.beginPath();
    const o = ax + ay;
    for (let k = Math.floor((x0 + y0 - o) / st) * st + o - st; k < x1 + y1; k += st) { ctx.moveTo(k - y0, y0); ctx.lineTo(k - y1, y1); }
    for (let k = Math.floor((x0 - y1 - ax + ay) / st) * st + ax - ay - st; k < x1 - y0; k += st) { ctx.moveTo(k + y0, y0); ctx.lineTo(k + y1, y1); }
    ctx.stroke();
  }
  ctx.restore();
}

// ---- one piece of cloth -------------------------------------------------------------------------------------------------------
// pts: screen points. o = { u, ax, ay, squint, lod (0..2), shadow, flash, outline }
export function drawPatch(ctx, pts, fid, o) {
  const f = fab(fid);
  const [x0, y0, x1, y1] = bbox(pts), small = Math.min(x1 - x0, y1 - y0), lod = o.lod ?? (small > 70 ? 2 : small > 24 ? 1 : 0);
  if (o.shadow) { ctx.save(); ctx.translate(o.shadow.dx, o.shadow.dy); poly(ctx, pts); ctx.fillStyle = `rgba(0,0,0,${o.shadow.a})`; ctx.fill(); ctx.restore(); }
  poly(ctx, pts);
  if (!f) {   // not yet cut: paper template
    ctx.fillStyle = o.empty ?? '#d8d0bd'; ctx.fill();
    ctx.save(); ctx.clip(); ctx.strokeStyle = 'rgba(0,0,0,0.10)'; ctx.lineWidth = 1; ctx.beginPath();
    const st = Math.max(7, o.u * 0.34);
    for (let k = x0 - (y1 - y0); k < x1; k += st) { ctx.moveTo(k, y1); ctx.lineTo(k + (y1 - y0), y0); }
    ctx.stroke(); ctx.restore();
    poly(ctx, pts); ctx.lineWidth = 1.3; ctx.setLineDash([5, 4]); ctx.strokeStyle = 'rgba(60,45,25,0.5)'; ctx.stroke(); ctx.setLineDash([]);
    return;
  }
  ctx.fillStyle = o.squint ? toGray(f.base) : f.base; ctx.fill();
  if (lod >= 1) {
    ctx.save(); poly(ctx, pts); ctx.clip();
    drawPrint(ctx, f, x0, y0, x1, y1, o.u, o.ax, o.ay, o.squint);
    if (lod >= 2) {   // weave
      const st = Math.max(2.4, o.u * 0.07), w = x1 - x0, h = y1 - y0;
      if ((w + h) / st < 700) {
        ctx.beginPath(); ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(0,0,0,0.055)';
        for (let y = y0; y < y1; y += st) { ctx.moveTo(x0, y); ctx.lineTo(x1, y); }
        ctx.stroke(); ctx.beginPath(); ctx.strokeStyle = 'rgba(255,255,255,0.07)';
        for (let x = x0; x < x1; x += st) { ctx.moveTo(x, y0); ctx.lineTo(x, y1); }
        ctx.stroke();
      }
    }
    // puffy edge: shade the rim, then a soft light from the top left
    poly(ctx, pts); ctx.lineWidth = Math.max(3, Math.min(small * 0.2, o.u * 0.5)); ctx.strokeStyle = 'rgba(0,0,0,0.20)'; ctx.stroke();
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, 'rgba(255,255,255,0.20)'); g.addColorStop(0.5, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(0,0,0,0.16)');
    ctx.fillStyle = g; ctx.fillRect(x0 - 1, y0 - 1, x1 - x0 + 2, y1 - y0 + 2);
    ctx.restore();
    // topstitch, inset from the seam
    if (lod >= 1 && small > 18) {
      const c = cen(pts); let d = 0; for (const p of pts) d += Math.hypot(p[0] - c[0], p[1] - c[1]); d /= pts.length;
      const ins = Math.max(2.4, Math.min(o.u * 0.2, small * 0.1)), k = Math.max(0.4, 1 - ins / Math.max(1, d));
      poly(ctx, pts.map((p) => [c[0] + (p[0] - c[0]) * k, c[1] + (p[1] - c[1]) * k]));
      ctx.setLineDash([Math.max(3, ins * 1.5), Math.max(2, ins)]); ctx.lineWidth = Math.max(1, ins * 0.28);
      ctx.strokeStyle = o.squint ? 'rgba(255,255,255,0.35)' : f.lum < 0.45 ? 'rgba(255,240,215,0.55)' : 'rgba(70,50,30,0.38)'; ctx.stroke(); ctx.setLineDash([]);
    }
  }
  poly(ctx, pts); ctx.lineWidth = lod >= 1 ? 1.2 : 0.6; ctx.strokeStyle = 'rgba(30,18,8,0.45)'; ctx.stroke();
  if (o.flash > 0) { poly(ctx, pts); ctx.fillStyle = `rgba(255,255,255,${0.5 * o.flash})`; ctx.fill(); }
}

// ---- blocks -----------------------------------------------------------------------------------------------------------------------
const mapPts = (pts, x, y, s, rot) => pts.map((p) => { const q = rot ? rotPoint(p, rot) : p; return [x + q[0] * s, y + q[1] * s]; });
export function patchPoints(blockId, i, x, y, s, rot = 0) { return mapPts(blockOf(blockId).patches[i].pts, x, y, s, rot); }
// o: { squint, pop: number[] (seconds since painted, 99 = idle), hi: Set<number>, sel: number, pulse, roleLabels, empty }
export function drawBlock(ctx, blockId, paint, x, y, s, rot = 0, o = {}) {
  const block = blockOf(blockId), u = s * 0.075;
  const lod = o.lod ?? (s > 220 ? 2 : s > 70 ? 1 : 0);
  for (let i = 0; i < block.patches.length; i++) {
    const pop = o.pop?.[i] ?? 99, pts = mapPts(block.patches[i].pts, x, y, s, rot);
    let popK = 0; if (pop < 0.34) popK = Math.sin((Math.PI * pop) / 0.34);
    if (popK > 0) {
      const c = cen(pts), k = 1 + 0.07 * popK;
      ctx.save(); ctx.translate(c[0], c[1] - popK * s * 0.012); ctx.scale(k, k); ctx.translate(-c[0], -c[1]);
      drawPatch(ctx, pts, paint[i], { u, ax: x, ay: y, squint: o.squint, lod, empty: o.empty, shadow: { dx: 0, dy: s * 0.02 * popK + 1, a: 0.28 }, flash: popK * 0.5 });
      ctx.restore();
    } else drawPatch(ctx, pts, paint[i], { u, ax: x, ay: y, squint: o.squint, lod, empty: o.empty });
  }
  if (o.roleLabels && lod >= 2) {
    ctx.save(); ctx.font = `700 ${Math.max(11, s * 0.045)}px system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    block.patches.forEach((p, i) => { if (paint[i]) return; const pts = mapPts(p.pts, x, y, s, rot), c = cen(pts); ctx.fillStyle = 'rgba(40,28,14,0.62)'; ctx.fillText('ABC'[p.role], c[0], c[1]); });
    ctx.restore();
  }
  if (o.hi && o.hi.size) {
    const a = 0.55 + 0.45 * Math.sin((o.pulse ?? 0) * 6);
    for (const i of o.hi) { const pts = mapPts(block.patches[i].pts, x, y, s, rot); poly(ctx, pts); ctx.lineWidth = Math.max(3, s * 0.014); ctx.strokeStyle = `rgba(255,214,90,${a})`; ctx.stroke(); }
  }
  if (o.sel >= 0 && o.sel != null) { const pts = mapPts(block.patches[o.sel].pts, x, y, s, rot); poly(ctx, pts); ctx.lineWidth = Math.max(3, s * 0.012); ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.stroke(); }
}

// ---- quilts ----------------------------------------------------------------------------------------------------------------------
const rectPts = (r) => [[r.x, r.y], [r.x + r.w, r.y], [r.x + r.w, r.y + r.h], [r.x, r.y + r.h]];
// d: quilt design, ch: { cols, tiles }. o: { squint, quilted, sel, drape, pop (cell pop times), hi: Set of cells, empty }
export function drawQuilt(ctx, ch, d, x, y, S, o = {}) {
  const g = quiltGeo(d, ch.cols, S), ox = x, oy = y, u = g.k * 0.1;
  ctx.save();
  // soft drop shadow on the table
  ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.fillRect(ox + S * 0.012, oy + S * 0.02, S, S);
  ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(ox + S * 0.004, oy + S * 0.008, S + S * 0.02, S + S * 0.03);
  ctx.restore();
  const flat = (r, fid, extra = {}) => drawPatch(ctx, rectPts({ x: r.x + ox, y: r.y + oy, w: r.w, h: r.h }), fid, { u, ax: ox, ay: oy, squint: o.squint, lod: r.w < 30 || r.h < 30 ? 0 : 1, empty: o.empty, ...extra });
  if (g.bw > 0) for (const r of g.bord) flat(r, d.bordF || '');
  else { ctx.fillStyle = o.empty ?? '#d8d0bd'; ctx.fillRect(ox, oy, S, S); }
  if (g.sw > 0) {
    flat(g.inner, d.sashF || '', { lod: 0 });
    for (const r of g.hs) flat(r, d.sashF || '');
    for (const r of g.vs) flat(r, d.sashF || '');
    for (const r of g.corners) flat(r, d.bordF || d.sashF || '');
  }
  d.cells.forEach((c, i) => {
    const cell = g.cells[i], px = ox + cell.x, py = oy + cell.y, pop = o.pop?.[i] ?? 99;
    if (c.t < 0) {
      ctx.save(); ctx.fillStyle = 'rgba(240,232,215,0.55)'; ctx.fillRect(px, py, cell.s, cell.s); ctx.setLineDash([6, 5]); ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(60,45,25,0.6)'; ctx.strokeRect(px + 2, py + 2, cell.s - 4, cell.s - 4); ctx.setLineDash([]);
      ctx.beginPath(); ctx.lineWidth = 2; ctx.moveTo(px + cell.s * 0.4, py + cell.s / 2); ctx.lineTo(px + cell.s * 0.6, py + cell.s / 2); ctx.moveTo(px + cell.s / 2, py + cell.s * 0.4); ctx.lineTo(px + cell.s / 2, py + cell.s * 0.6); ctx.stroke(); ctx.restore();
      return;
    }
    const t = ch.tiles[c.t];
    if (pop < 0.34) { const k = 1 + 0.06 * Math.sin((Math.PI * pop) / 0.34), cx = px + cell.s / 2, cy = py + cell.s / 2; ctx.save(); ctx.translate(cx, cy); ctx.scale(k, k); ctx.translate(-cx, -cy); drawBlock(ctx, t.type, t.paint, px, py, cell.s, c.r, { squint: o.squint }); ctx.restore(); }
    else drawBlock(ctx, t.type, t.paint, px, py, cell.s, c.r, { squint: o.squint });
    if (o.hi?.has(i)) { ctx.lineWidth = Math.max(3, cell.s * 0.03); ctx.strokeStyle = `rgba(255,214,90,${0.6 + 0.4 * Math.sin((o.pulse ?? 0) * 6)})`; ctx.strokeRect(px, py, cell.s, cell.s); }
  });
  if (o.sel >= 0 && o.sel != null) { const c = g.cells[o.sel]; ctx.lineWidth = Math.max(3, c.s * 0.03); ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.strokeRect(ox + c.x, oy + c.y, c.s, c.s); }
  // hand-quilting stitches across a pressed top
  if (o.quilted) {
    ctx.save(); ctx.beginPath(); ctx.rect(ox, oy, S, S); ctx.clip(); ctx.setLineDash([S * 0.012, S * 0.01]); ctx.lineWidth = Math.max(1, S * 0.003); ctx.strokeStyle = 'rgba(255,255,255,0.38)'; ctx.beginPath();
    const st = S / (ch.cols * 3);
    for (let k = -S; k < S * 2; k += st * 2) { ctx.moveTo(ox + k, oy); ctx.lineTo(ox + k + S, oy + S); ctx.moveTo(ox + k, oy + S); ctx.lineTo(ox + k + S, oy); }
    ctx.stroke(); ctx.setLineDash([]); ctx.restore();
  }
  // drape: broad soft folds of light over the whole top
  if (o.drape !== false) {
    ctx.save(); ctx.beginPath(); ctx.rect(ox, oy, S, S); ctx.clip();
    const gr = ctx.createLinearGradient(ox, oy, ox + S, oy + S * 0.7);
    gr.addColorStop(0, 'rgba(255,255,255,0.10)'); gr.addColorStop(0.2, 'rgba(0,0,0,0.07)'); gr.addColorStop(0.42, 'rgba(255,255,255,0.05)'); gr.addColorStop(0.66, 'rgba(0,0,0,0.09)'); gr.addColorStop(0.85, 'rgba(255,255,255,0.06)'); gr.addColorStop(1, 'rgba(0,0,0,0.12)');
    ctx.fillStyle = gr; ctx.fillRect(ox, oy, S, S); ctx.restore();
  }
  // binding
  ctx.save(); ctx.lineWidth = Math.max(3, S * 0.014); ctx.strokeStyle = o.squint ? '#444' : '#3a2a22'; ctx.strokeRect(ox, oy, S, S);
  ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.strokeRect(ox + S * 0.008, oy + S * 0.008, S - S * 0.016, S - S * 0.016); ctx.restore();
  return g;
}

// ---- swatches in the tray (folded cloth) ------------------------------------------------------------------------------------------
export function drawSwatch(ctx, fid, r, o = {}) {
  const f = fab(fid), rad = Math.min(r.w, r.h) * 0.16;
  ctx.save();
  ctx.beginPath(); ctx.roundRect(r.x + 1, r.y + 4, r.w, r.h, rad); ctx.fillStyle = 'rgba(0,0,0,0.30)'; ctx.fill();
  ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, rad); ctx.clip();
  const u = Math.min(r.w, r.h) * 0.3;
  ctx.fillStyle = o.squint ? toGray(f.base) : f.base; ctx.fillRect(r.x, r.y, r.w, r.h);
  drawPrint(ctx, f, r.x, r.y, r.x + r.w, r.y + r.h, u, r.x, r.y, o.squint);
  // two folds: a light ridge and a dark valley, like cloth folded in thirds
  const g = ctx.createLinearGradient(r.x, r.y, r.x, r.y + r.h);
  g.addColorStop(0, 'rgba(255,255,255,0.22)'); g.addColorStop(0.18, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(0,0,0,0.0)'); g.addColorStop(0.55, 'rgba(0,0,0,0.20)'); g.addColorStop(0.62, 'rgba(255,255,255,0.10)'); g.addColorStop(1, 'rgba(0,0,0,0.26)');
  ctx.fillStyle = g; ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.restore();
  ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, rad); ctx.lineWidth = o.on ? 4 : 1.2; ctx.strokeStyle = o.on ? '#ffffff' : 'rgba(0,0,0,0.5)'; ctx.stroke();
  if (o.on) { ctx.beginPath(); ctx.roundRect(r.x - 3, r.y - 3, r.w + 6, r.h + 6, rad + 3); ctx.lineWidth = 2.5; ctx.strokeStyle = o.ring ?? '#f0a45a'; ctx.stroke(); }
}

// ---- the room ------------------------------------------------------------------------------------------------------------------------
const hash = (a, b) => { let h = (a * 374761393 + b * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
export function drawTable(ctx, w, h, t, T, calm) {
  const ph = Math.max(110, Math.round(h / 9));
  for (let i = 0, y = 0; y < h + ph; i++, y += ph) {
    ctx.fillStyle = i % 2 ? T.wood1 : T.wood2; ctx.fillRect(0, y, w, ph);
    const shade = hash(i, 3) * 0.14; ctx.fillStyle = `rgba(0,0,0,${shade})`; ctx.fillRect(0, y, w, ph);
    ctx.lineWidth = 1.2; ctx.strokeStyle = T.grain; ctx.beginPath();
    for (let k = 0; k < 6; k++) {
      const yy = y + ph * (0.12 + 0.15 * k + 0.1 * hash(i, k)), ph0 = hash(k, i) * 6;
      ctx.moveTo(0, yy);
      for (let x = 0; x <= w + 40; x += 40) ctx.lineTo(x, yy + Math.sin(x * 0.011 + ph0) * (3 + 3 * hash(i, k + 9)));
    }
    ctx.stroke();
    ctx.fillStyle = 'rgba(0,0,0,0.42)'; ctx.fillRect(0, y, w, 2.5);
    if (hash(i, 5) > 0.35) { ctx.fillStyle = 'rgba(0,0,0,0.5)'; const bx = hash(i, 7) * w; ctx.fillRect(bx, y, 2, ph); }
  }
  const fl = calm ? 1 : 0.93 + 0.07 * Math.sin(t * 3.1) * Math.sin(t * 1.7 + 1);
  const gx = w * 0.12, gy = h * 0.04, gr = Math.max(w, h) * 0.9, rg = ctx.createRadialGradient(gx, gy, 0, gx, gy, gr);
  rg.addColorStop(0, T.glow.replace(/[\d.]+\)$/, (m) => `${Math.min(1, parseFloat(m) * fl * 1.6)})`)); rg.addColorStop(0.45, T.glow.replace(/[\d.]+\)$/, (m) => `${parseFloat(m) * 0.35})`)); rg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = rg; ctx.fillRect(0, 0, w, h);
  const vg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.75);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, T.dark ? 'rgba(0,0,0,0.5)' : 'rgba(60,40,10,0.28)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, w, h);
}
// The self-healing cutting mat the block sits on: green with a measured grid.
export function drawMat(ctx, r, T) {
  ctx.save();
  ctx.beginPath(); ctx.roundRect(r.x + 2, r.y + 8, r.w, r.h, r.w * 0.025); ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fill();
  ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, r.w * 0.025); ctx.fillStyle = T.mat; ctx.fill(); ctx.clip();
  const g = ctx.createLinearGradient(r.x, r.y, r.x + r.w, r.y + r.h); g.addColorStop(0, 'rgba(255,255,255,0.10)'); g.addColorStop(1, 'rgba(0,0,0,0.18)'); ctx.fillStyle = g; ctx.fillRect(r.x, r.y, r.w, r.h);
  const st = r.w / 20; ctx.lineWidth = 1; ctx.strokeStyle = T.matLine; ctx.beginPath();
  for (let i = 1; i < 20; i++) { ctx.moveTo(r.x + i * st, r.y); ctx.lineTo(r.x + i * st, r.y + r.h); ctx.moveTo(r.x, r.y + i * st); ctx.lineTo(r.x + r.w, r.y + i * st); }
  ctx.globalAlpha = 0.55; ctx.stroke(); ctx.globalAlpha = 1;
  ctx.lineWidth = 2; ctx.beginPath(); for (let i = 5; i < 20; i += 5) { ctx.moveTo(r.x + i * st, r.y); ctx.lineTo(r.x + i * st, r.y + r.h); ctx.moveTo(r.x, r.y + i * st); ctx.lineTo(r.x + r.w, r.y + i * st); } ctx.globalAlpha = 0.5; ctx.stroke();
  ctx.restore();
  ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, r.w * 0.025); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.stroke();
}
// A spool of thread (decoration for empty panel corners).
export function drawSpool(ctx, cx, cy, s, colour) {
  ctx.save();
  ctx.fillStyle = '#c9a36a'; ctx.beginPath(); ctx.roundRect(cx - s * 0.5, cy - s * 0.5, s, s * 0.14, s * 0.04); ctx.roundRect(cx - s * 0.5, cy + s * 0.36, s, s * 0.14, s * 0.04); ctx.fill();
  const g = ctx.createLinearGradient(cx - s * 0.4, 0, cx + s * 0.4, 0); g.addColorStop(0, mixHex(colour, '#000000', 0.25)); g.addColorStop(0.35, mixHex(colour, '#ffffff', 0.25)); g.addColorStop(1, mixHex(colour, '#000000', 0.35));
  ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(cx - s * 0.4, cy - s * 0.38, s * 0.8, s * 0.76, s * 0.05); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 1; ctx.beginPath(); for (let i = 1; i < 8; i++) { const y = cy - s * 0.38 + (s * 0.76 * i) / 8; ctx.moveTo(cx - s * 0.4, y); ctx.lineTo(cx + s * 0.4, y); } ctx.stroke();
  ctx.restore();
}
