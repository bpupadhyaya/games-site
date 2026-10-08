// About, How to Play and the exhaustive Rules reference. All are scrolling pages with text zoom (A-/A+, up to 300%).
import { COL, FONT_D, R, icon } from './ui.js';
import { backdrop, header, ballIcon } from './common.js';
import { drawCredit } from './brand.js';
import { ABOUT, CREDITS, HOWTO } from './content.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ---- tiny figure toolkit -----------------------------------------------------------------------------------------------------------------
function tableMap(r) {
  const nearW = r.w * 0.78, farW = nearW * 0.58, cx = r.x + r.w / 2, y0 = r.y + r.h * 0.9, y1 = r.y + r.h * 0.1;
  const at = (u, v) => { const t = v; const w = nearW + (farW - nearW) * t; const yy = y0 + (y1 - y0) * Math.pow(t, 0.9); return { x: cx + u * w / 2, y: yy }; };
  return at;
}
function drawTable(ctx, r, net = true) {
  const at = tableMap(r), a = at(-1, 0), b = at(1, 0), c = at(1, 1), d = at(-1, 1);
  ctx.save();
  const g = ctx.createLinearGradient(0, d.y, 0, a.y); g.addColorStop(0, '#1456b8'); g.addColorStop(1, '#0c3a8a');
  ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#eef6ff'; ctx.lineWidth = 3; ctx.stroke();
  ctx.lineWidth = 1.6; ctx.beginPath(); const m0 = at(0, 0), m1 = at(0, 1); ctx.moveTo(m0.x, m0.y); ctx.lineTo(m1.x, m1.y); ctx.stroke();
  if (net) {
    const n0 = at(-1.08, 0.5), n1 = at(1.08, 0.5); ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(n0.x, n0.y - r.h * 0.07); ctx.lineTo(n1.x, n1.y - r.h * 0.07); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 1; for (let i = 0; i <= 14; i++) { const p = at(-1.08 + i * (2.16 / 14), 0.5); ctx.beginPath(); ctx.moveTo(p.x, p.y - r.h * 0.07); ctx.lineTo(p.x, p.y); ctx.stroke(); }
  }
  ctx.restore();
  return at;
}
function arrow(ctx, x0, y0, x1, y1, color, w = 4) {
  ctx.save(); ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = w; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  const a = Math.atan2(y1 - y0, x1 - x0), h = w * 3.2;
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 - Math.cos(a - 0.45) * h, y1 - Math.sin(a - 0.45) * h); ctx.lineTo(x1 - Math.cos(a + 0.45) * h, y1 - Math.sin(a + 0.45) * h); ctx.closePath(); ctx.fill(); ctx.restore();
}
function curve(ctx, pts, color, w = 4, arrowHead = true) {
  ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
  ctx.quadraticCurveTo(pts[1].x, pts[1].y, pts[2].x, pts[2].y); ctx.stroke(); ctx.restore();
  if (arrowHead) { const a = pts[2], b = pts[1]; arrow(ctx, a.x - (a.x - b.x) * 0.05, a.y - (a.y - b.y) * 0.05, a.x, a.y, color, w); }
}
function finger(ctx, x, y, s) {
  ctx.save(); ctx.fillStyle = 'rgba(255,255,255,0.88)'; ctx.beginPath(); ctx.arc(x, y, s * 0.5, 0, 6.3); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, s * 0.85, 0, 6.3); ctx.stroke(); ctx.restore();
}
function paddleIcon(ctx, x, y, s, ang = 0) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
  ctx.fillStyle = '#c8955a'; ctx.fillRect(-s * 0.09, s * 0.3, s * 0.18, s * 0.5);
  ctx.fillStyle = '#d3181f'; ctx.beginPath(); ctx.arc(0, 0, s * 0.5, 0, 6.3); ctx.fill(); ctx.strokeStyle = '#7a0a10'; ctx.lineWidth = 2; ctx.stroke(); ctx.restore();
}
function label(ctx, ui, t, x, y, size, color = COL.ink, align = 'center') { ui.text(ctx, t, x, y, size, { align, color, weight: 700, fixed: true }); }

export function drawFigure(ctx, G, id, r) {
  const { ui } = G;
  ctx.save();
  ctx.fillStyle = 'rgba(6,14,32,0.7)'; ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, 18); ctx.fill();
  ctx.strokeStyle = 'rgba(160,190,240,0.25)'; ctx.lineWidth = 1.5; ctx.stroke(); ctx.clip();
  const inner = R(r.x + 10, r.y + 6, r.w - 20, r.h - 12);
  const fz = clamp(r.h / 13, 13, 20);
  if (id === 'table') {
    const at = drawTable(ctx, inner), p0 = at(-0.35, 0.08), b1 = at(-0.25, 0.3), b2 = at(0.35, 0.78);
    curve(ctx, [p0, { x: (p0.x + b1.x) / 2 - 8, y: p0.y - inner.h * 0.12 }, b1], '#ffd25a', 4);
    curve(ctx, [b1, { x: (b1.x + b2.x) / 2 + 20, y: (b1.y + b2.y) / 2 - inner.h * 0.38 }, b2], '#ffd25a', 4);
    ballIcon(ctx, p0.x, p0.y - 4, 9); ballIcon(ctx, b1.x, b1.y, 6); ballIcon(ctx, b2.x, b2.y, 6);
    label(ctx, ui, '1', b1.x - 22, b1.y + 6, fz + 4, '#ffd25a'); label(ctx, ui, '2', b2.x + 20, b2.y + 6, fz + 4, '#ffd25a');
    label(ctx, ui, 'YOUR HALF', inner.x + inner.w / 2, inner.y + inner.h - 2, fz, COL.dim); label(ctx, ui, 'THEIR HALF', inner.x + inner.w / 2, inner.y + fz + 2, fz, COL.dim);
  } else if (id === 'path') {
    const gy = inner.y + inner.h * 0.78, x0 = inner.x + 20, x1 = inner.x + inner.w - 20, nx = (x0 + x1) / 2, ty = gy - inner.h * 0.18;
    ctx.fillStyle = '#0c3a8a'; ctx.fillRect(x0, ty, x1 - x0, 10); ctx.fillStyle = '#eef6ff'; ctx.fillRect(nx - 2, ty - inner.h * 0.2, 4, inner.h * 0.2);
    ctx.strokeStyle = '#2a3550'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(x0 + 30, ty + 10); ctx.lineTo(x0 + 30, gy); ctx.moveTo(x1 - 30, ty + 10); ctx.lineTo(x1 - 30, gy); ctx.stroke();
    const arc = (sx, ex, peak, col, endY) => curve(ctx, [{ x: sx, y: ty - 20 }, { x: (sx + ex) / 2, y: ty - peak }, { x: ex, y: endY }], col, 4);
    arc(x0 + 50, nx + (x1 - nx) * 0.55, inner.h * 0.55, '#35d07f', ty);
    arc(x0 + 50, nx - 14, inner.h * 0.2, '#ff5a5f', ty - 6);
    label(ctx, ui, 'GOOD', x1 - 70, ty - inner.h * 0.3, fz + 2, '#35d07f'); label(ctx, ui, 'NET', nx - 36, ty - inner.h * 0.34, fz + 2, '#ff5a5f');
    arc(x0 + 50, x1 + 4, inner.h * 0.5, '#ff9a4a', ty + 20); label(ctx, ui, 'OUT', x1 - 20, ty + 46, fz + 2, '#ff9a4a');
  } else if (id === 'gesture') {
    const items = [['TOUCH', 0.3, 'up', 'soft'], ['LOOP', 0.55, 'up', 'topspin'], ['DRIVE', 0.9, 'up', 'fast'], ['PUSH', 0.3, 'down', 'soft'], ['CHOP', 0.8, 'down', 'backspin']];
    const cw = inner.w / items.length;
    items.forEach((it, i) => {
      const cx = inner.x + cw * (i + 0.5), len = inner.h * 0.5 * it[1] + 12, mid = inner.y + inner.h * 0.5;
      const up = it[2] === 'up';
      finger(ctx, cx, up ? mid + len / 2 : mid - len / 2, 16);
      arrow(ctx, cx, up ? mid + len / 2 : mid - len / 2, cx, up ? mid - len / 2 : mid + len / 2, up ? '#ffa24a' : '#6fd8ff', 5);
      label(ctx, ui, it[0], cx, inner.y + inner.h - 24, fz + 1, COL.ink); label(ctx, ui, it[3], cx, inner.y + inner.h - 4, fz - 2, COL.dim);
    });
  } else if (id === 'spin') {
    const cw = inner.w / 3, names = [['TOPSPIN', '#ffa24a'], ['BACKSPIN', '#6fd8ff'], ['SIDESPIN', '#7dffb0']];
    names.forEach((n, i) => {
      const cx = inner.x + cw * (i + 0.5), cy = inner.y + inner.h * 0.38, rr = Math.min(cw, inner.h) * 0.2;
      ballIcon(ctx, cx, cy, rr);
      ctx.save(); ctx.strokeStyle = n[1]; ctx.lineWidth = 4; ctx.beginPath();
      if (i === 2) ctx.arc(cx, cy, rr * 1.5, -2.2, 0.9); else ctx.arc(cx, cy, rr * 1.5, i === 0 ? -0.6 : 2.5, i === 0 ? 2.4 : 5.5); ctx.stroke(); ctx.restore();
      const a = i === 0 ? { x: cx + rr * 1.3, y: cy + rr * 1.1 } : i === 1 ? { x: cx - rr * 1.2, y: cy - rr * 1.2 } : { x: cx + rr * 1.5, y: cy + rr * 0.3 };
      ctx.save(); ctx.fillStyle = n[1]; ctx.beginPath(); ctx.arc(a.x, a.y, 5, 0, 6.3); ctx.fill(); ctx.restore();
      const by = inner.y + inner.h * 0.76;
      const pts = i === 0 ? [{ x: cx - cw * 0.35, y: by - 30 }, { x: cx, y: by - 70 }, { x: cx + cw * 0.35, y: by + 10 }] : i === 1 ? [{ x: cx - cw * 0.35, y: by - 10 }, { x: cx + cw * 0.05, y: by - 52 }, { x: cx + cw * 0.35, y: by - 30 }] : [{ x: cx - cw * 0.35, y: by }, { x: cx, y: by - 8 }, { x: cx + cw * 0.35, y: by - 40 }];
      curve(ctx, pts, n[1], 3);
      label(ctx, ui, n[0], cx, inner.y + inner.h - 6, fz + 1, n[1]);
    });
  } else if (id === 'slide' || id === 'flick' || id === 'timing' || id === 'aim' || id === 'serve') {
    const at = drawTable(ctx, inner);
    const pad = at(0, -0.12);
    if (id === 'slide') {
      paddleIcon(ctx, pad.x, pad.y, inner.h * 0.16);
      arrow(ctx, pad.x - 20, pad.y + inner.h * 0.12, pad.x - inner.w * 0.28, pad.y + inner.h * 0.12, '#ffa24a'); arrow(ctx, pad.x + 20, pad.y + inner.h * 0.12, pad.x + inner.w * 0.28, pad.y + inner.h * 0.12, '#ffa24a');
      finger(ctx, pad.x, pad.y + inner.h * 0.2, inner.h * 0.08);
    } else if (id === 'flick') {
      const b = at(0.1, 0.42); ballIcon(ctx, b.x, b.y, 8);
      paddleIcon(ctx, pad.x, pad.y, inner.h * 0.16);
      finger(ctx, pad.x + inner.w * 0.2, pad.y + inner.h * 0.1, inner.h * 0.07); arrow(ctx, pad.x + inner.w * 0.2, pad.y + inner.h * 0.1, pad.x + inner.w * 0.2, pad.y - inner.h * 0.3, '#ffa24a', 5);
      curve(ctx, [at(0, 0), at(0.1, 0.35), at(0.3, 0.85)], '#ffd25a', 3);
    } else if (id === 'timing') {
      const b = at(0.1, 0.18); ballIcon(ctx, b.x, b.y, 9);
      [1.9, 1.4, 1.0].forEach((k, i) => { ctx.save(); ctx.strokeStyle = i === 2 ? '#ffe27a' : 'rgba(255,170,70,' + (0.4 + i * 0.2) + ')'; ctx.lineWidth = 3; if (i === 2) ctx.setLineDash([5, 5]); ctx.beginPath(); ctx.arc(b.x, b.y - 6, inner.h * 0.1 * k, 0, 6.3); ctx.stroke(); ctx.restore(); });
      label(ctx, ui, 'FLICK when the ring closes', inner.x + inner.w / 2, inner.y + inner.h - 4, fz + 1, '#ffe27a');
    } else if (id === 'aim') {
      paddleIcon(ctx, pad.x, pad.y, inner.h * 0.15);
      [[-0.75, '#7dffb0'], [0, '#ffa24a'], [0.75, '#6fd8ff']].forEach(([u, col]) => { const t = at(u, 0.82); arrow(ctx, pad.x, pad.y - 14, t.x, t.y, col, 4); });
      label(ctx, ui, 'tilt the flick to aim', inner.x + inner.w / 2, inner.y + inner.h - 4, fz + 1, COL.dim);
    } else {
      const s0 = at(-0.3, 0.06); ballIcon(ctx, s0.x, s0.y - 30, 9); arrow(ctx, s0.x + 14, s0.y - 12, s0.x + 14, s0.y - 56, '#ffd25a', 3);
      paddleIcon(ctx, s0.x - 28, s0.y + 4, inner.h * 0.13);
      curve(ctx, [s0, at(-0.2, 0.2), at(0.3, 0.8)], '#ffd25a', 3);
      label(ctx, ui, 'toss  -  bounce  -  over  -  bounce', inner.x + inner.w / 2, inner.y + inner.h - 4, fz, COL.dim);
    }
  }
  ctx.restore();
}

// ---- block renderer for the Rules ----------------------------------------------------------------------------------------------------------
function blocksHeight(ctx, G, blocks, w, draw, x0, y0) {
  const { ui } = G;
  let y = y0;
  for (const b of blocks) {
    if (b[0] === 'p') { const h = ui.paraHeight(ctx, b[1], w, 24); if (draw) ui.para(ctx, b[1], x0, y, w, 24, { color: COL.ink, weight: 500 }); y += h + 14; }
    else if (b[0] === 'h') { if (draw) ui.text(ctx, b[1].toUpperCase(), x0, y + ui.fs(26) * 0.85, 26, { disp: true, weight: 800, color: COL.orange2, fit: w }); y += ui.fs(26) * 1.3 + 6; }
    else if (b[0] === 'list') {
      for (const it of b[1]) {
        const h = ui.paraHeight(ctx, it, w - 30, 23);
        if (draw) { ctx.save(); ctx.fillStyle = COL.orange; ctx.beginPath(); ctx.arc(x0 + 8, y + ui.fs(23) * 0.7, 4.5, 0, 6.3); ctx.fill(); ctx.restore(); ui.para(ctx, it, x0 + 28, y, w - 30, 23, { color: COL.ink, weight: 500 }); }
        y += h + 8;
      }
      y += 6;
    } else if (b[0] === 'fig') { const fh = Math.min(b[2], w * 0.62); if (draw) drawFigure(ctx, G, b[1], R(x0, y, w, fh)); y += fh + 16; }
  }
  return y - y0;
}

export function drawRules(ctx, G) {
  const { L, ui, state, RULES } = G;
  backdrop(ctx, L, state.t);
  const c = header(ctx, G, 'RULES', { zoom: true });
  ui.zoom = G.zoom;
  const wide = c.w >= 900, page = clamp(state.rulesPage, 0, RULES.length - 1);
  let content;
  if (wide) {
    const nw = clamp(c.w * 0.27, 250, 340), nav = R(c.x + 16, c.y, nw, c.h - 12);
    ui.zoom = 1;
    const nh = clamp((nav.h - 4) / RULES.length - 6, 30, 58);
    RULES.forEach((p, i) => ui.button(ctx, `rules:${i}`, R(nav.x, nav.y + 2 + i * (nh + 6), nav.w, nh), `${i + 1}. ${p.title}`, { kind: i === page ? 'on' : 'chip', size: Math.min(22, nh * 0.46), radius: 14 }));
    ui.zoom = G.zoom;
    content = R(nav.x + nw + 16, c.y, c.w - nw - 48, c.h - 12);
  } else {
    const bh = 60, y = c.y;
    ui.button(ctx, `rules:${Math.max(0, page - 1)}`, R(c.x + 16, y, 110, bh), '‹', { kind: 'chip', size: 40, disabled: page === 0 });
    ui.button(ctx, `rules:${Math.min(RULES.length - 1, page + 1)}`, R(c.x + c.w - 126, y, 110, bh), '›', { kind: 'chip', size: 40, disabled: page === RULES.length - 1 });
    ui.text(ctx, RULES[page].title.toUpperCase(), c.x + c.w / 2, y + 30, 26, { disp: true, weight: 800, align: 'center', fixed: true });
    ui.text(ctx, `${page + 1} / ${RULES.length}`, c.x + c.w / 2, y + 54, 17, { align: 'center', color: COL.dim, fixed: true });
    content = R(c.x + 16, y + bh + 10, c.w - 32, c.h - bh - 22);
  }
  ui.panel(ctx, content, { fill: 'rgba(8,15,30,0.6)', radius: 20, shadow: false });
  const view = R(content.x + 18, content.y + 12, content.w - 36, content.h - 24);
  // content scroll (wide mode nav is not scrolled; keep a single scroll state for the content)
  ui.beginScroll(ctx, view);
  ui.text(ctx, RULES[page].title.toUpperCase(), view.x, view.y + ui.fs(44) * 0.85, 44, { disp: true, weight: 800, fit: view.w - 20 });
  const y0 = view.y + ui.fs(44) * 1.3 + 8;
  const h = blocksHeight(ctx, G, RULES[page].blocks, view.w - 14, true, view.x, y0);
  const nextY = y0 + h + 4;
  if (page < RULES.length - 1) ui.button(ctx, `rules:${page + 1}`, R(view.x, nextY + 8, Math.min(view.w - 14, 420), 74), `NEXT: ${RULES[page + 1].title.toUpperCase()}`, { kind: 'secondary', size: 24 });
  ui.endScroll(ctx, nextY + 100 - view.y);
}

export function drawAbout(ctx, G) {
  const { L, ui, state } = G;
  backdrop(ctx, L, state.t);
  const c = header(ctx, G, 'ABOUT', { zoom: true });
  ui.zoom = G.zoom;
  const wide = c.w >= 900;
  let text;
  if (wide) {
    const lw = clamp(c.w * 0.3, 280, 380), card = R(c.x + 16, c.y, lw, c.h - 12);
    ui.panel(ctx, card, { fill: COL.panel2, radius: 24 });
    aboutCard(ctx, G, card);
    text = R(card.x + lw + 16, c.y, c.w - lw - 48, c.h - 12);
  } else {
    text = R(c.x + 16, c.y, c.w - 32, c.h - 12);
  }
  ui.beginScroll(ctx, text);
  let y = text.y + 6;
  const tw = text.w - 22;
  if (!wide) { const ch = 230; ui.panel(ctx, R(text.x, y, tw, ch), { fill: COL.panel2, radius: 24 }); aboutCard(ctx, G, R(text.x, y, tw, ch)); y += ch + 18; }
  for (const s of ABOUT) {
    ui.text(ctx, s.h.toUpperCase(), text.x + 6, y + ui.fs(30) * 0.85, 30, { disp: true, weight: 800, color: COL.orange2, fit: tw - 12 }); y += ui.fs(30) * 1.35;
    y += ui.para(ctx, s.p, text.x + 6, y, tw - 12, 24, { color: COL.ink, weight: 500 }) + 18;
  }
  ui.text(ctx, 'CREDITS', text.x + 6, y + ui.fs(30) * 0.85, 30, { disp: true, weight: 800, color: COL.orange2 }); y += ui.fs(30) * 1.35;
  y += ui.para(ctx, CREDITS, text.x + 6, y, tw - 12, 21, { color: COL.dim, weight: 500 }) + 12;
  if (state.licenses) {
    ui.text(ctx, 'LICENCES', text.x + 6, y + ui.fs(24) * 0.85, 24, { disp: true, weight: 800, color: COL.orange2 }); y += ui.fs(24) * 1.35;
    y += ui.para(ctx, state.licenses.replace(/[#*`]/g, ''), text.x + 6, y, tw - 12, 17, { color: COL.faint, weight: 500 }) + 12;
  }
  ui.endScroll(ctx, y - text.y + 24);
}
function aboutCard(ctx, G, r) {
  const { ui } = G;
  const cx = r.x + r.w / 2;
  ui.text(ctx, 'TABLE TENNIS', cx, r.y + 62, 46, { disp: true, weight: 800, align: 'center', fixed: true });
  ui.text(ctx, 'RALLY', cx, r.y + 128, 74, { disp: true, weight: 800, align: 'center', fixed: true, color: COL.orange });
  ui.text(ctx, 'Version 1.0', cx, r.y + 160, 20, { align: 'center', color: COL.dim, fixed: true });
  drawCredit(ctx, cx, r.y + r.h - 24, clamp(r.w / 28, 12, 17));
  ui.hit('logo', R(r.x, r.y + r.h - 56, r.w, 56));
}

export function drawHow(ctx, G) {
  const { L, ui, state } = G;
  backdrop(ctx, L, state.t);
  const c = header(ctx, G, 'HOW TO PLAY', { zoom: true });
  ui.zoom = G.zoom;
  const page = clamp(state.howPage, 0, HOWTO.length - 1), pg = HOWTO[page];
  const wide = c.w >= 900;
  // page chips
  const chipH = 52, gap = 8, cw = (c.w - 32 - gap * (HOWTO.length - 1)) / HOWTO.length;
  HOWTO.forEach((p, i) => ui.button(ctx, `how:${i}`, R(c.x + 16 + i * (cw + gap), c.y, cw, chipH), String(i + 1), { kind: i === page ? 'on' : 'chip', size: 24 }));
  const body = R(c.x + 16, c.y + chipH + 12, c.w - 32, c.h - chipH - 24);
  const navH = 78;
  const area = R(body.x, body.y, body.w, body.h - navH - 10);
  const figR = wide ? R(area.x, area.y, area.w * 0.5 - 8, area.h) : R(area.x, area.y, area.w, clamp(area.h * 0.36, 180, 360));
  drawFigure(ctx, G, pg.fig, figR);
  const tr = wide ? R(area.x + area.w * 0.5 + 8, area.y, area.w * 0.5 - 8, area.h) : R(area.x, area.y + figR.h + 12, area.w, area.h - figR.h - 12);
  ui.beginScroll(ctx, tr);
  let y = tr.y + 4;
  ui.text(ctx, pg.title.toUpperCase(), tr.x + 4, y + ui.fs(40) * 0.85, 40, { disp: true, weight: 800, color: COL.orange2, fit: tr.w - 30 }); y += ui.fs(40) * 1.35;
  y += ui.para(ctx, pg.body, tr.x + 4, y, tr.w - 26, 25, { color: COL.ink, weight: 500 });
  ui.endScroll(ctx, y - tr.y + 16);
  const by = body.y + body.h - navH, bw = (body.w - 24) / 3;
  ui.button(ctx, `how:${Math.max(0, page - 1)}`, R(body.x, by, bw, navH), 'BACK', { kind: 'secondary', size: 28, disabled: page === 0 });
  ui.button(ctx, 'how:try', R(body.x + bw + 12, by, bw, navH), 'TRY IT', { kind: 'primary', icon: 'play', size: 30 });
  ui.button(ctx, `how:${Math.min(HOWTO.length - 1, page + 1)}`, R(body.x + 2 * (bw + 12), by, bw, navH), 'NEXT', { kind: 'secondary', size: 28, disabled: page === HOWTO.length - 1 });
}
