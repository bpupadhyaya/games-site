// About, How to Play and the exhaustive Rules reference. All are scrolling pages with text zoom (A-/A+, up to 300%).
import { COL, FONT_D, R, icon } from './ui.js';
import { backdrop, header } from './chrome.js';
import { drawCredit } from './brand.js';
import { ABOUT, CREDITS, HOWTO } from './content.js';
import { drawPad, TIER_COL } from './hud.js';
import { WINDOWS } from './common.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const hsl = (h, s = 70, l = 52) => `hsl(${h},${s}%,${l}%)`;

// ---- tiny figure toolkit (the same drum pad and boat colours the game draws) -------------------------------------------------
function arrow(ctx, x0, y0, x1, y1, color, w = 4) {
  ctx.save(); ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = w; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  const a = Math.atan2(y1 - y0, x1 - x0), h = w * 3.2;
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 - Math.cos(a - 0.45) * h, y1 - Math.sin(a - 0.45) * h); ctx.lineTo(x1 - Math.cos(a + 0.45) * h, y1 - Math.sin(a + 0.45) * h); ctx.closePath(); ctx.fill(); ctx.restore();
}
function label(ctx, ui, t, x, y, size, color = COL.ink, align = 'center') { ui.text(ctx, t, x, y, size, { align, color, weight: 700, fixed: true }); }
// a boat seen from above, bow to the right of the frame when vertical=false
function boatTop(ctx, x, y, len, hue, sync = 1, vertical = true, paddlers = true) {
  const wd = len * 0.1;
  ctx.save(); ctx.translate(x, y); if (!vertical) ctx.rotate(Math.PI / 2);
  // hull (bow up)
  ctx.fillStyle = hsl(hue, 68, 40); ctx.strokeStyle = '#ffd98a'; ctx.lineWidth = Math.max(1.5, len * 0.012);
  ctx.beginPath(); ctx.moveTo(0, -len / 2); ctx.quadraticCurveTo(wd * 1.2, -len * 0.2, wd, len * 0.1); ctx.quadraticCurveTo(wd * 0.6, len * 0.45, 0, len / 2); ctx.quadraticCurveTo(-wd * 0.6, len * 0.45, -wd, len * 0.1); ctx.quadraticCurveTo(-wd * 1.2, -len * 0.2, 0, -len / 2); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#ffd98a'; ctx.beginPath(); ctx.arc(0, -len / 2, wd * 0.55, 0, 6.3); ctx.fill();
  if (paddlers) {
    for (let i = 0; i < 10; i++) {
      const yy = -len * 0.34 + i * (len * 0.065);
      for (const sd of [-1, 1]) {
        const jit = (((i * 37 + (sd > 0 ? 11 : 0)) % 9) / 9 - 0.5) * 2 * (1 - sync) * len * 0.05;
        ctx.strokeStyle = '#f1e6c8'; ctx.lineWidth = Math.max(1.5, len * 0.012); ctx.beginPath(); ctx.moveTo(sd * wd * 0.5, yy); ctx.lineTo(sd * (wd * 1.9), yy + jit); ctx.stroke();
        ctx.fillStyle = '#f6efe0'; ctx.beginPath(); ctx.arc(sd * wd * 0.35, yy, Math.max(2, len * 0.015), 0, 6.3); ctx.fill();
      }
    }
  }
  ctx.restore();
}
function river(ctx, r, lanes = 4, o = {}) {
  ctx.save(); ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip();
  const g = ctx.createLinearGradient(r.x, 0, r.x + r.w, 0); g.addColorStop(0, '#0c4a66'); g.addColorStop(1, '#0a3a58'); ctx.fillStyle = g; ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.setLineDash([5, 9]); ctx.lineWidth = 2;
  for (let i = 1; i < lanes; i++) { const x = r.x + (r.w * i) / lanes; ctx.beginPath(); ctx.moveTo(x, r.y); ctx.lineTo(x, r.y + r.h); ctx.stroke(); }
  ctx.setLineDash([]); ctx.restore();
  return (i) => r.x + (r.w * (i + 0.5)) / lanes;
}

export function drawFigure(ctx, G, id, r) {
  const { ui } = G;
  ctx.save();
  ctx.fillStyle = 'rgba(6,14,32,0.7)'; ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, 18); ctx.fill();
  ctx.strokeStyle = 'rgba(160,190,240,0.25)'; ctx.lineWidth = 1.5; ctx.stroke(); ctx.clip();
  const inner = R(r.x + 10, r.y + 6, r.w - 20, r.h - 12);
  const fz = clamp(r.h / 13, 13, 20), cx = inner.x + inner.w / 2, cy = inner.y + inner.h / 2;
  if (id === 'beat') {
    const pr = Math.min(inner.h * 0.3, inner.w * 0.2);
    drawPad(ctx, cx - inner.w * 0.18, cy - 6, pr, { rings: [{ k: 0.25, a: 0.45 }, { k: 0.6, a: 0.7 }, { k: 0.93, a: 1 }], glow: true });
    arrow(ctx, cx + inner.w * 0.06, cy - 6, cx + inner.w * 0.22, cy - 6, '#ffe27a', 5);
    ['PERFECT', 'GREAT', 'GOOD'].forEach((t, i) => { ctx.save(); ui.text(ctx, t, cx + inner.w * 0.36, cy - 40 + i * 34, fz + 5, { disp: true, weight: 800, fixed: true, align: 'center', color: TIER_COL[['perfect', 'great', 'good'][i]] }); ctx.restore(); });
    label(ctx, ui, 'TAP when the ring closes', cx, inner.y + inner.h - 2, fz + 1, COL.dim);
  } else if (id === 'sync') {
    const h = inner.h * 0.5;
    boatTop(ctx, cx - inner.w * 0.22, cy - 4, h, 5, 0.95); boatTop(ctx, cx + inner.w * 0.22, cy - 4, h, 5, 0.1);
    label(ctx, ui, 'IN SYNC', cx - inner.w * 0.22, inner.y + inner.h - 4, fz + 2, '#7dffb0'); label(ctx, ui, 'RAGGED', cx + inner.w * 0.22, inner.y + inner.h - 4, fz + 2, '#ff9a8a');
  } else if (id === 'steer') {
    const lx = river(ctx, inner, 4);
    ctx.fillStyle = 'rgba(160,240,255,0.22)'; ctx.fillRect(lx(2) - inner.w * 0.08, inner.y + inner.h * 0.1, inner.w * 0.16, inner.h * 0.4);
    ctx.fillStyle = '#8a5a30'; ctx.beginPath(); ctx.roundRect(lx(0) - 16, inner.y + inner.h * 0.2, 32, 10, 5); ctx.fill();
    boatTop(ctx, lx(1), inner.y + inner.h * 0.72, inner.h * 0.5, 5, 1);
    arrow(ctx, lx(1) + 4, inner.y + inner.h * 0.44, lx(2) - 4, inner.y + inner.h * 0.3, '#ffe27a', 4);
    label(ctx, ui, 'STREAM', lx(2), inner.y + inner.h * 0.58, fz, '#9fe8ff'); label(ctx, ui, 'LOG', lx(0), inner.y + inner.h * 0.2 - 8, fz, '#e8b080');
  } else if (id === 'energy') {
    const bw = inner.w * 0.7, bx = cx - bw / 2;
    ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.beginPath(); ctx.roundRect(bx, cy - 12, bw, 24, 12); ctx.fill();
    const g = ctx.createLinearGradient(bx, 0, bx + bw, 0); g.addColorStop(0, '#2f9be0'); g.addColorStop(1, '#7ff0f0'); ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(bx, cy - 12, bw * 0.62, 24, 12); ctx.fill();
    label(ctx, ui, 'ENERGY', cx, cy - 26, fz + 2, '#8fe0ff');
    [['CLEAN', '#7dffb0', 0.3], ['SLOPPY', '#ff9a8a', 0.55], ['SPRINT', '#ff7a4a', 0.8]].forEach(([t, c, k]) => { label(ctx, ui, t + (t === 'CLEAN' ? ': costs less' : ': costs more'), bx + bw * (k - 0.1), cy + 36, fz - 1, c); });
  } else if (id === 'surge') {
    const rr = Math.min(inner.h * 0.3, 70);
    ctx.save(); ctx.fillStyle = '#d99a1c'; ctx.beginPath(); ctx.arc(cx, cy - 4, rr, 0, 6.3); ctx.fill(); ctx.strokeStyle = '#ffc23a'; ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(cx, cy - 4, rr + 6, -1.57, 4.6); ctx.stroke(); ctx.restore();
    icon(ctx, 'bolt', cx, cy - 8, rr * 1.0, '#6a3a00');
    label(ctx, ui, 'FULL RING  =  5 SECONDS OF EXTRA POWER', cx, inner.y + inner.h - 6, fz + 1, '#ffd98a');
  } else if (id === 'drummer') {
    drawPad(ctx, cx - inner.w * 0.2, cy - 6, Math.min(inner.h * 0.3, inner.w * 0.17), { label: 'DRUM' });
    const gx = cx + inner.w * 0.14, gw = inner.w * 0.3;
    ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fillRect(gx, cy - 22, gw, 12); ctx.fillStyle = '#7dffb0'; ctx.fillRect(gx + gw * 0.35, cy - 22, gw * 0.3, 12);
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(gx + gw * 0.5, cy - 4); ctx.lineTo(gx + gw * 0.5 - 7, cy + 12); ctx.lineTo(gx + gw * 0.5 + 7, cy + 12); ctx.fill();
    label(ctx, ui, 'KEEP THE TEMPO IN THE BAND', gx + gw / 2, cy - 32, fz - 1, COL.ink); label(ctx, ui, 'LIFT = TAP TWICE', gx + gw / 2, cy + 40, fz + 1, '#ffe27a');
  } else if (id === 'course') {
    const lx = river(ctx, inner, 4);
    [260, 250, 270, 255].forEach((y0, i) => boatTop(ctx, lx(i), inner.y + inner.h * 0.78, inner.h * 0.42, [5, 150, 215, 40][i], 1, true, false));
    ctx.fillStyle = '#fff'; for (let k = 0; k < 14; k++) { ctx.fillStyle = k % 2 ? '#111' : '#fff'; ctx.fillRect(inner.x + k * inner.w / 14, inner.y + inner.h * 0.12, inner.w / 14, 10); }
    label(ctx, ui, 'FINISH', cx, inner.y + inner.h * 0.12 - 8, fz + 1, '#fff'); label(ctx, ui, 'START', cx, inner.y + inner.h - 4, fz + 1, '#fff');
    label(ctx, ui, '300 - 600 m', inner.x + inner.w - 10, inner.y + inner.h * 0.5, fz + 1, '#ffe27a', 'right');
  } else if (id === 'tempo') {
    const rows = [['START', 0.58, '#cfe6ff', 6], ['CRUISE', 0.78, '#ffcf5a', 6], ['UP', 0.68, '#ffc65a', 6], ['SETTLE', 0.86, '#8fe0ff', 5], ['SPRINT', 0.65, '#ff7a4a', 7]];
    const rh = inner.h / rows.length;
    rows.forEach(([t, sp, col, n], i) => {
      const y = inner.y + rh * (i + 0.5);
      label(ctx, ui, t, inner.x + 6, y + 5, fz + 1, col, 'left');
      for (let k = 0; k < n; k++) { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(inner.x + inner.w * 0.3 + k * inner.w * 0.1 * sp * 1.15, y, 6, 0, 6.3); ctx.fill(); }
    });
  } else if (id === 'windows') {
    const W = WINDOWS.normal, sw = inner.w * 0.88, sx = cx - sw / 2, sc = (sw / 2) / W[3];
    const tiers = [[W[3], 'ragged'], [W[2], 'good'], [W[1], 'great'], [W[0], 'perfect']];
    tiers.forEach(([v, t]) => { ctx.fillStyle = TIER_COL[t]; ctx.globalAlpha = 0.45; ctx.fillRect(cx - v * sc, cy - 16, 2 * v * sc, 32); });
    ctx.globalAlpha = 1; ctx.fillStyle = '#fff'; ctx.fillRect(cx - 2, cy - 26, 4, 52);
    label(ctx, ui, 'EARLY', sx + 24, cy + 52, fz, COL.dim); label(ctx, ui, 'LATE', sx + sw - 24, cy + 52, fz, COL.dim);
    label(ctx, ui, 'PERFECT', cx, cy - 36, fz, TIER_COL.perfect);
    label(ctx, ui, 'normal windows: 65 / 120 / 180 / 250 ms', cx, inner.y + inner.h - 4, fz, COL.dim);
  } else if (id === 'river') {
    const lx = river(ctx, inner, 4);
    ctx.fillStyle = 'rgba(160,240,255,0.2)'; ctx.fillRect(lx(0) - 20, inner.y + inner.h * 0.15, 40, inner.h * 0.35);
    arrow(ctx, lx(3), inner.y + inner.h * 0.8, lx(3) + 22, inner.y + inner.h * 0.8, '#9fe8ff', 3);
    boatTop(ctx, lx(2), inner.y + inner.h * 0.62, inner.h * 0.42, 5, 1, true, false);
    for (const x of [inner.x + 4, inner.x + inner.w - 4]) { ctx.fillStyle = '#4a6a3c'; ctx.fillRect(x - 4, inner.y, 8, inner.h); }
    label(ctx, ui, 'BANK', inner.x + 30, inner.y + 18, fz, COL.dim); label(ctx, ui, 'SIDE DRIFT', lx(3), inner.y + inner.h * 0.8 - 12, fz, '#9fe8ff');
  }
  ctx.restore();
}

// ---- block renderer for the Rules ----------------------------------------------------------------------------------------------------------
function blocks(ctx, G, bl, w, draw, x0, y0) {
  const { ui } = G;
  let y = y0;
  for (const b of bl) {
    if (b[0] === 'p') { const h = ui.paraHeight(ctx, b[1], w, 24); if (draw) ui.para(ctx, b[1], x0, y, w, 24, { color: COL.ink, weight: 500 }); y += h + 14; }
    else if (b[0] === 'h') { if (draw) ui.text(ctx, b[1].toUpperCase(), x0, y + ui.fs(26) * 0.85, 26, { disp: true, weight: 800, color: COL.orange2, fit: w }); y += ui.fs(26) * 1.3 + 6; }
    else if (b[0] === 'list') {
      for (const it of b[1]) {
        const h = ui.paraHeight(ctx, it, w - 30, 23);
        if (draw) { ctx.save(); ctx.fillStyle = COL.orange2; ctx.beginPath(); ctx.arc(x0 + 8, y + ui.fs(23) * 0.7, 4.5, 0, 6.3); ctx.fill(); ctx.restore(); ui.para(ctx, it, x0 + 28, y, w - 30, 23, { color: COL.ink, weight: 500 }); }
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
    ui.text(ctx, RULES[page].title.toUpperCase(), c.x + c.w / 2, y + 30, 26, { disp: true, weight: 800, align: 'center', fixed: true, fit: c.w - 280 });
    ui.text(ctx, `${page + 1} / ${RULES.length}`, c.x + c.w / 2, y + 54, 17, { align: 'center', color: COL.dim, fixed: true });
    content = R(c.x + 16, y + bh + 10, c.w - 32, c.h - bh - 22);
  }
  ui.panel(ctx, content, { fill: 'rgba(8,15,30,0.6)', radius: 20, shadow: false });
  const view = R(content.x + 18, content.y + 12, content.w - 36, content.h - 24);
  ui.beginScroll(ctx, view);
  ui.text(ctx, RULES[page].title.toUpperCase(), view.x, view.y + ui.fs(44) * 0.85, 44, { disp: true, weight: 800, fit: view.w - 20 });
  const y0 = view.y + ui.fs(44) * 1.3 + 8;
  const h = blocks(ctx, G, RULES[page].blocks, view.w - 14, true, view.x, y0);
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
  } else text = R(c.x + 16, c.y, c.w - 32, c.h - 12);
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
  ui.text(ctx, 'DRAGON BOAT', cx, r.y + 62, 54, { disp: true, weight: 800, align: 'center', fixed: true, fit: r.w - 30 });
  ui.text(ctx, 'RACE', cx, r.y + 134, 84, { disp: true, weight: 800, align: 'center', fixed: true, color: COL.orange });
  ui.text(ctx, 'Version 1.0', cx, r.y + 166, 20, { align: 'center', color: COL.dim, fixed: true });
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
