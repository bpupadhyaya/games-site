// Everything drawn each frame. Reads state, changes nothing.
import {
  SZ, UI, DISPLAY, NUM, THEMES, themeById, text, rr, panel, button, background, star, icon, drawParticles, alpha, clamp01, ease, easeInOut, backOut, mix,
} from './art.js';
import { TEXT_SCALES, wrap, tw } from './ui.js';
import { tr, L, nameOf, getLang } from './content.js';
import { hintWhy, hudOf, playLayout, autoLayout, boardGeo, docRects, titleRects, revealRect, host, isLandscape } from './layout.js';
import { drawMoreLine, drawLockup } from './brand.js';
import { THINK_STEPS } from './screens.js';
import { drawNonogram, drawPicture } from './boardview.js';
import { drawArt } from './arts.js';
import { FILLED } from './solver.js';
import { lineName, clueText } from './explain.js';

const theme = (S) => themeById(S.themeId);

// Largest text size (<= start) whose wrapped lines fit w x h. Used by every HUD text so zoom never overflows.
export function fitText(str, w, h, start, min = 16, lh = 1.28, wf = 1) {
  let size = start;
  for (; size > min; size -= 2) {
    const lines = wrap(str, size * wf, w);
    if (lines.length * size * lh <= h) return { lines, size, line: size * lh };
  }
  const lines = wrap(str, min * wf, w);
  return { lines, size: min, line: min * lh };
}
const fitOne = (str, w, start, min = 14) => { let s = start; while (s > min && tw(str, s) > w) s -= 1; return s; };

// ----------------------------------------------------------------------------------------- documents
function drawDocBlocks(ctx, S, ui, scroll) {
  const th = theme(S);
  const { region, layout } = ui;
  ctx.save();
  rr(ctx, region.x - 6, region.y - 4, region.w + 12, region.h + 8, 18);
  ctx.clip();
  const ox = region.x, oy = region.y - scroll + (ui.offY || 0);
  for (const it of layout.items) {
    const b = it.b;
    const top = oy + it.y;
    if (top > region.y + region.h + 20 || top + it.h < region.y - 20) continue;
    if (b.t === 'h') {
      for (let i = 0; i < it.lines.length; i++) text(ctx, it.lines[i], ox + it.w / 2, top + i * it.line + it.size, it.size, th.accent, { font: DISPLAY, weight: 800 });
    } else if (b.t === 'p') {
      const center = b.center || b.align === 'center';
      for (let i = 0; i < it.lines.length; i++) {
        text(ctx, it.lines[i], center ? ox + it.w / 2 : ox, top + i * it.line + it.size * 0.98, it.size, 'rgba(246,236,214,0.93)', { weight: 500, align: center ? 'center' : 'left' });
      }
    } else if (b.t === 'img') {
      if (b.name === 'more') {
        if (it.w >= 500) drawMoreLine(ctx, ox + it.w / 2, top + b.h * 0.68, 22);
        else { drawMoreLine(ctx, ox + it.w / 2, top + 26, 19, 'More heritage games'); drawMoreLine(ctx, ox + it.w / 2, top + 52, 19, 'in Arcforge', false); }
      }
      else drawArt(ctx, S, b.name, ox, top, it.w, b.h, b, th);
    } else if (b.t === 'btn') {
      const bt = it.btns[0];
      button(ctx, th, { x: ox + bt.x, y: oy + bt.y, w: bt.w, h: bt.h }, it.lines, b.kind ?? 'normal', { size: it.size, line: it.line, sub: it.sub, disabled: bt.disabled, pressed: S.press && S.press.id === bt.id && S.press.active });
    } else if (b.t === 'row') {
      for (const bt of it.btns) {
        if (bt.id == null) text(ctx, bt.label, ox + bt.x + bt.w / 2, oy + bt.y + bt.h / 2 + it.size * 0.34, it.size, th.ink, { weight: 700 });
        else button(ctx, th, { x: ox + bt.x, y: oy + bt.y, w: bt.w, h: bt.h }, bt.lines, bt.kind ?? 'normal', { size: it.size, line: it.line, disabled: bt.disabled, pressed: S.press && S.press.id === bt.id && S.press.active });
      }
    } else if (b.t === 'grid') {
      for (const bt of it.btns) drawPictureCell(ctx, S, { x: ox + bt.x, y: oy + bt.y, w: bt.w, h: bt.h }, bt.cell, S.press && S.press.id === bt.id && S.press.active);
    }
  }
  ctx.restore();
  if (layout.height > region.h) {
    const track = region.h - 8, tH = Math.max(48, (region.h / layout.height) * track);
    const ty = region.y + 4 + (scroll / (layout.height - region.h)) * (track - tH);
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    rr(ctx, region.x + region.w + 6, region.y + 4, 10, track, 5); ctx.fill();
    ctx.fillStyle = alpha('#e8c46a', 0.85);
    rr(ctx, region.x + region.w + 6, ty, 10, tH, 5); ctx.fill();
  }
}

function drawFixed(ctx, S, list) {
  const th = theme(S);
  for (const f of list) {
    if (f.lockup) {   // the themed Arcforge lockup on a soft plate; dims while pressed
      const k = f.lockup, pr = S.press && S.press.id === f.id && S.press.active;
      ctx.save(); ctx.fillStyle = 'rgba(16,10,6,0.5)'; rr(ctx, k.x - k.w / 2 - 10, k.y - 4, k.w + 20, k.h + 8, 14); ctx.fill(); ctx.restore();
      drawLockup(ctx, k.x, k.y, k.w, pr ? 0.5 : 0.95);
      continue;
    }
    if (f.static) { text(ctx, f.label, f.rect.x + f.rect.w / 2, f.rect.y + f.rect.h / 2 + 10, f.size, 'rgba(246,236,214,0.8)', { weight: 700 }); continue; }
    const pressed = S.press && S.press.id === f.id && S.press.active;
    if (f.icon) {
      button(ctx, th, f.rect, [], f.kind, { disabled: f.disabled, pressed });
      icon(ctx, f.icon, f.rect.x + 36, f.rect.y + f.rect.h / 2 + (pressed ? 2 : 0), 30, th.ink);
      text(ctx, f.label, f.rect.x + 62 + (f.rect.w - 72) / 2, f.rect.y + f.rect.h / 2 + f.size * 0.34 + (pressed ? 2 : 0), Math.min(f.size, fitOne(f.label, f.rect.w - 80, f.size, 14)), th.ink, { weight: 700 });
    } else button(ctx, th, f.rect, f.lines ?? [f.label], f.kind, { size: f.size, line: f.line, disabled: f.disabled, pressed });
  }
}

// a chapter-grid cell: the finished picture in colour once solved, an ink silhouette until then
function drawPictureCell(ctx, S, r, c, pressed) {
  const th = theme(S);
  const y = r.y + (pressed ? 2 : 0);
  const z = TEXT_SCALES[S.textIdx] ?? 1;
  ctx.save();
  if (c.locked) ctx.globalAlpha = 0.5;
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; rr(ctx, r.x, y + 4, r.w, r.h, 16); ctx.fill();
  ctx.fillStyle = c.stars ? th.btnOn[0] : th.btn[0]; rr(ctx, r.x, y, r.w, r.h, 16); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.16)'; ctx.lineWidth = 1.5; rr(ctx, r.x, y, r.w, r.h, 16); ctx.stroke();
  const fs = Math.min(22 * (1 + (z - 1) * 0.5), 34);
  const side = Math.min(r.w - 24, r.h - fs * 2.2 - 14);
  drawPicture(ctx, th, c.puz, r.x + (r.w - side) / 2, y + 10, side, { k: c.stars ? 1 : 0, gap: c.stars ? 0 : Math.max(0.5, side / c.puz.w * 0.08), frame: false });
  if (!c.stars) { ctx.fillStyle = 'rgba(15,12,10,0.45)'; rr(ctx, r.x + (r.w - side) / 2, y + 10, side, side, 4); ctx.fill(); }
  text(ctx, c.label, r.x + 14, y + 10 + fs * 0.9, fs, c.stars ? th.ink : '#f6ecd6', { weight: 800, align: 'left' });
  if (c.stars) for (let i = 0; i < 3; i++) star(ctx, r.x + r.w / 2 + (i - 1) * fs * 1.15, y + r.h - fs * 0.8, fs * 0.42, i < c.stars ? th.accent : 'rgba(255,255,255,0.2)');
  else if (c.open) text(ctx, tr('inProgress'), r.x + r.w / 2, y + r.h - fs * 0.4, fs * 0.7, th.accent, { weight: 700 });
  if (c.locked) icon(ctx, 'lock', r.x + r.w - 26, y + 26, 26, 'rgba(246,236,214,0.9)');
  ctx.restore();
}

// --------------------------------------------------------------------------------------- title
const attract = { puz: null, seq: null };
function attractData(puz, stepFn) {
  if (attract.puz !== puz.id) {
    attract.puz = puz.id;
    attract.seq = stepFn(puz);
  }
  return attract.seq;
}

function drawTitleScene(ctx, S) {
  const th = theme(S);
  const T = titleRects();
  const A = S.attract; // { puz, seq: [cell,...] } prepared by game.js
  const ja = getLang() === 'ja';
  const g0 = ctx.createLinearGradient(0, T.base - 74, 0, T.base + 30);
  g0.addColorStop(0, '#fff3c4'); g0.addColorStop(0.5, th.accent); g0.addColorStop(1, '#a8782a');
  const ts = Math.min(ja ? 104 : 108, Math.max(40, Math.round((T.titleW - 40) / (ja ? 5.4 : 4.9))));
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.65)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 8;
  ctx.font = `800 ${ts}px ${DISPLAY}`; ctx.textAlign = 'center'; ctx.fillStyle = g0;
  ctx.fillText(tr('title'), T.tcx, T.base);
  ctx.restore();
  const tg = tr('tagline'), tgs = Math.min(28, fitOne(tg, T.titleW - 30, 28, 18));
  text(ctx, tg, T.tcx, T.tagY, tgs, 'rgba(246,236,214,0.82)', { weight: 600 });
  if (!A || T.art.h < 60) return;
  const puz = A.puz;
  const area = T.art;
  const g = boardGeo(puz, area, 1, 'fit', 0, 0);
  const cyc = A.seq.length * 0.42 + 0.6 + 2.6 + 0.8;
  const tt = S.t % cyc;
  const shown = Math.min(A.seq.length, Math.floor(tt / 0.42));
  const cells = new Uint8Array(puz.w * puz.h);
  for (let i = 0; i < shown; i++) cells[A.seq[i].at] = A.seq[i].v;
  const tr0 = A.seq.length * 0.42 + 0.5;
  if (tt < tr0) drawNonogram(ctx, th, puz, cells, g, { t: tt, doneR: A.doneR(cells), doneC: A.doneC(cells) });
  else {
    const k = clamp01((tt - tr0) / 1.4);
    const side = Math.min(area.w, area.h) - 20;
    const gg = 1 - clamp01(k * 2);
    const e = easeInOut(clamp01((tt - tr0) / 0.9));
    const ex = g.view.x + (area.x + area.w / 2 - side / 2 - g.view.x) * e, ey = g.view.y + (area.y + area.h / 2 - side / 2 - g.view.y) * e;
    const sd = g.view.w + (side - g.view.w) * e;
    drawPicture(ctx, th, puz, ex, ey, sd, { k, gap: Math.max(0, (sd / puz.w) * 0.08 * gg), wave: 0.9 });
  }
}

function drawTitle(ctx, S, ui) {
  background(ctx, theme(S), S.t, 560);
  drawTitleScene(ctx, S);
  drawDocBlocks(ctx, S, ui, S.scroll[ui.scrollKey] ?? 0);
  drawFixed(ctx, S, ui.fixed);
}

function drawDocScreen(ctx, S, ui) {
  const th = theme(S);
  background(ctx, th, S.t);
  if (ui.panel) panel(ctx, th, ui.panel.x, ui.panel.y, ui.panel.w, ui.panel.h, {});
  drawDocBlocks(ctx, S, ui, S.scroll[ui.scrollKey] ?? 0);
  drawFixed(ctx, S, ui.fixed);
  if (ui.nav) {
    const D = docRects();
    drawFixed(ctx, S, [ui.nav.prev, ui.nav.next].filter(Boolean));
    if (ui.nav.label) text(ctx, ui.nav.label, D.navMid, D.navLabelY, 26, 'rgba(246,236,214,0.75)', { weight: 600 });
  }
}

function drawOverlay(ctx, S, ui) {
  const th = theme(S);
  ctx.fillStyle = `rgba(6,4,4,${(S.overlay === 'end' ? 0.3 : 0.62) * clamp01(S.ovT / 0.25)})`;
  ctx.fillRect(0, 0, SZ.w, SZ.h);
  const k = ease(clamp01(S.ovT / 0.3));
  const cx = ui.panel.x + ui.panel.w / 2, cy = ui.panel.y + ui.panel.h / 2;
  ctx.save();
  ctx.translate(cx, cy); ctx.scale(0.92 + 0.08 * k, 0.92 + 0.08 * k); ctx.translate(-cx, -cy);
  ctx.globalAlpha = k;
  panel(ctx, th, ui.panel.x, ui.panel.y, ui.panel.w, ui.panel.h, {});
  drawDocBlocks(ctx, S, ui, S.scroll[ui.scrollKey] ?? 0);
  drawFixed(ctx, S, ui.fixed);
  ctx.restore();
}

// ------------------------------------------------------------------------------------------ play
function hudBar(ctx, S, M, auto) {
  const th = theme(S);
  const z = TEXT_SCALES[S.textIdx];
  const H = auto ? autoLayout(z).hud : hudOf(z);
  const pressedBack = S.press && S.press.id === 'hud:back' && S.press.active;
  button(ctx, th, H.back, [], 'normal', { pressed: pressedBack });
  icon(ctx, 'back', H.back.x + H.back.w / 2, H.back.y + H.back.h / 2, 32 + 10 * H.k, th.ink);
  if (!auto) {
    const pp = S.press && S.press.id === 'hud:pause' && S.press.active;
    button(ctx, th, H.pause, [], 'normal', { pressed: pp });
    icon(ctx, 'pause', H.pause.x + H.pause.w / 2, H.pause.y + H.pause.h / 2, 32 + 10 * H.k, th.ink);
  }
  let r = H.name;
  if (r.h < 20) return;
  // the kit's preview badge sits at the top centre: the picture-name panel starts below it (name only when that leaves little room)
  const kp = Math.max(0.05, host.px), badgeB = host.t + 6 / kp + 1.7 * Math.max(16, 11.5 / kp) + 4, nameOnly = r.y < badgeB && r.y + r.h - badgeB < 70 && !isLandscape();
  if (!isLandscape() && r.y < badgeB && r.y + r.h - badgeB >= 30) r = { x: r.x, y: badgeB, w: r.w, h: r.y + r.h - badgeB };
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; rr(ctx, r.x, r.y, r.w, r.h, 18); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.14)'; ctx.lineWidth = 1.5; rr(ctx, r.x, r.y, r.w, r.h, 18); ctx.stroke();
  const name = M.hideName ? tr('title') : nameOf(M.puz);
  const sub = `${M.puz.w} × ${M.puz.h}`;
  const subS = nameOnly ? 0 : 22 * Math.min(z, 1.5);
  const fs = fitOne(name, r.w - 24, Math.min(34 * Math.min(z, 1.7), r.h - subS - 14), 16);
  const total = fs + (nameOnly ? 0 : subS + 6);
  const top = r.y + (r.h - total) / 2;
  text(ctx, name, r.x + r.w / 2, top + fs * 0.86, fs, th.ink, { weight: 800, font: DISPLAY });
  if (!nameOnly) text(ctx, sub, r.x + r.w / 2, top + fs + 6 + subS * 0.82, subS, th.accent, { weight: 600 });
}

function drawFocusBar(ctx, S, M, lay) {
  const th = theme(S);
  const r = lay.focus;
  if (r.h < 30) return;
  ctx.fillStyle = 'rgba(0,0,0,0.28)'; rr(ctx, r.x, r.y, r.w, r.h, 18); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 1.5; rr(ctx, r.x, r.y, r.w, r.h, 18); ctx.stroke();
  const z = TEXT_SCALES[S.textIdx];
  const f = M.focus;
  const puz = M.puz;
  let line1, line2;
  if (f) { line1 = `${lineName('row', f.r)}:  ${clueText(puz.rows[f.r])}`; line2 = `${lineName('col', f.c)}:  ${clueText(puz.cols[f.c])}`; }
  else { line1 = tr('focusIdle'); line2 = ''; }
  const innerW = r.w - 36, innerH = r.h - 20;
  const half = line2 ? innerH / 2 : innerH;
  const a = fitText(line1, innerW, half, 30 * z, 18, 1.2);
  const b = line2 ? fitText(line2, innerW, half, 30 * z, 18, 1.2) : null;
  const size = b ? Math.min(a.size, b.size) : a.size;
  const A = fitText(line1, innerW, half, size, 16, 1.2), B = line2 ? fitText(line2, innerW, half, size, 16, 1.2) : null;
  const total = A.lines.length * A.line + (B ? B.lines.length * B.line : 0);
  let y = r.y + (r.h - total) / 2 + size * 0.88;
  for (const ln of A.lines) { text(ctx, ln, r.x + 18, y, size, f ? th.ink : 'rgba(246,236,214,0.7)', { weight: f ? 700 : 500, align: 'left', font: NUM }); y += A.line; }
  if (B) for (const ln of B.lines) { text(ctx, ln, r.x + 18, y, size, th.ink, { weight: 700, align: 'left', font: NUM }); y += B.line; }
}

function drawStatus(ctx, S, rect, head, body, o = {}) {
  const th = theme(S);
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; rr(ctx, rect.x, rect.y, rect.w, rect.h, 20); ctx.fill();
  ctx.strokeStyle = o.hint ? th.hint : 'rgba(255,255,255,0.12)'; ctx.lineWidth = o.hint ? 2.5 : 1.5; rr(ctx, rect.x, rect.y, rect.w, rect.h, 20); ctx.stroke();
  const z = TEXT_SCALES[S.textIdx];
  const innerW = rect.w - 40 - (o.rightReserve ?? 0), reserve = o.reserve ?? 0;
  const innerH = rect.h - 24 - reserve;
  const hs = head ? fitText(head, innerW, innerH * (body ? 0.4 : 1), 32 * z, 18, 1.2, 1.12) : null;
  const rest = innerH - (hs ? hs.lines.length * hs.line : 0);
  const bs = body ? fitText(body, innerW, rest, 26 * z, 16, 1.25, 1.04) : null;
  const total = (hs ? hs.lines.length * hs.line : 0) + (bs ? bs.lines.length * bs.line : 0);
  let y = rect.y + 12 + Math.max(0, (innerH - total) / 2) + (hs ? hs.size : bs.size) * 0.86;
  if (hs) for (const ln of hs.lines) { text(ctx, ln, rect.x + 20, y, hs.size, o.headColor ?? th.accent, { weight: 800, align: 'left' }); y += hs.line; }
  if (bs) for (const ln of bs.lines) { text(ctx, ln, rect.x + 20, y, bs.size, 'rgba(246,236,214,0.92)', { weight: 500, align: 'left' }); y += bs.line; }
}

const TOOL_ICON = { fill: 'fill', cross: 'cross', move: 'move', zoom: 'zoom', undo: 'undo', redo: 'redo', think: 'hint', check: 'shield' };
function drawToolbar(ctx, S, M, lay) {
  const th = theme(S);
  const z = TEXT_SCALES[S.textIdx];
  const lf = Math.min(22 * z, lay.land ? 30 : 44);
  for (const r of lay.tools) {
    const id = r.id;
    const on = (id === 'fill' || id === 'cross' || id === 'move') ? M.tool === id : id === 'check' ? S.check : id === 'zoom' ? M.zoom === 'close' : false;
    const disabled = (id === 'undo' && !M.b.undo.length) || (id === 'redo' && !M.b.redo.length) || (id === 'zoom' && !M.canZoom) || ((id === 'think' || id === 'check' || id === 'zoom' || id === 'move') && false);
    const pressed = S.press && S.press.id === `tool:${id}` && S.press.active;
    button(ctx, th, r, [], on ? 'on' : 'normal', { disabled, pressed });
    const label = tr(id);
    const py = pressed ? 2 : 0;
    if (r.h < 84 && r.w > r.h * 1.4) {   // short wide buttons (landscape columns): icon on the left, label beside it
      const iconS = Math.min(r.h - 16, 34);
      const size = fitOne(label, r.w - iconS - 34, Math.min(lf, 26), 14);
      icon(ctx, TOOL_ICON[id], r.x + 14 + iconS / 2, r.y + r.h / 2 + py, iconS, th.ink);
      text(ctx, label, r.x + 14 + iconS + 8 + (r.w - iconS - 34) / 2, r.y + r.h / 2 + size * 0.34 + py, size, th.ink, { weight: 700 });
      continue;
    }
    const size = fitOne(label, r.w - 14, lf, 14);
    const iconS = Math.min(r.h - size * 1.2 - 26, 30 + 16 * (z - 1));
    icon(ctx, TOOL_ICON[id], r.x + r.w / 2, r.y + 14 + iconS / 2 + py, iconS, th.ink);
    text(ctx, label, r.x + r.w / 2, r.y + r.h - 14 + py, size, th.ink, { weight: 700 });
  }
}

function playGeo(S, M, area) {
  return boardGeo(M.puz, area, TEXT_SCALES[S.textIdx], M.zoom, M.ox, M.oy);
}

// The reveal: the clues fade, the ink board melts into a mosaic, then the squares turn to colour in a wave and the picture glides up into its frame.
function drawRevealFrame(ctx, S, M, g, lay, t) {
  const th = theme(S), puz = M.puz;
  const { side, fx, fy } = revealRect(lay.area);
  const pulse = Math.sin(clamp01(t / 1.0) * Math.PI);
  if (t < 1.0) {
    drawNonogram(ctx, th, puz, M.b.cells, g, { t: S.t, doneR: M.b.doneR.map(() => 1), doneC: M.b.doneC.map(() => 1), clueAlpha: 1 - clamp01((t - 0.1) / 0.55) });
    ctx.fillStyle = `rgba(255,255,255,${0.12 * pulse})`; ctx.fillRect(g.view.x, g.view.y, g.view.w, g.view.h);
    const a = clamp01((t - 0.6) / 0.4);
    if (a > 0) {
      ctx.save(); ctx.globalAlpha = a;
      drawPicture(ctx, th, puz, g.view.x, g.view.y, Math.max(g.view.w, g.view.h), { k: 0, gap: (g.s || 10) * 0.08, frame: false });
      ctx.restore();
    }
    return;
  }
  const e = easeInOut(clamp01((t - 1.0) / 1.1));
  const x = g.view.x + (fx - g.view.x) * e, y = g.view.y + (fy - g.view.y) * e, sd = Math.max(g.view.w, g.view.h) + (side - Math.max(g.view.w, g.view.h)) * e;
  const k = clamp01((t - 1.1) / 1.5);
  const gap = Math.max(0, (sd / Math.max(puz.w, puz.h)) * 0.08 * (1 - clamp01((t - 1.1) / 1.2)));
  drawPicture(ctx, th, puz, x, y, sd, { k, gap, wave: 0.9, frame: true });
}

function drawRevealScene(ctx, S, M, lay) {
  const th = theme(S);
  const t = M.reveal.t, puz = M.puz;
  const RV = revealRect(lay.area);
  const g = boardGeo(puz, lay.area, TEXT_SCALES[S.textIdx], 'fit', 0, 0);
  drawRevealFrame(ctx, S, M, g, lay, t);
  const ta = clamp01((t - 2.4) / 0.6);
  if (ta > 0) {
    ctx.save(); ctx.globalAlpha = ta;
    text(ctx, nameOf(puz), RV.fx + RV.side / 2, RV.nameY, fitOne(nameOf(puz), Math.max(200, RV.side + 80), 54 * Math.min(1.3, TEXT_SCALES[S.textIdx]), 24), th.accent, { weight: 800, font: DISPLAY });
    ctx.restore();
  }
}

// The live picture: every square you have filled so far, in ink, on a small card beside the board (landscape).
function drawPreview(ctx, S, M, r) {
  const th = theme(S), puz = M.puz;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.28)'; rr(ctx, r.x, r.y, r.w, r.h, 16); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.14)'; ctx.lineWidth = 1.5; rr(ctx, r.x, r.y, r.w, r.h, 16); ctx.stroke();
  const pad = Math.max(8, r.w * 0.07), side = Math.min(r.w, r.h) - pad * 2, s = side / Math.max(puz.w, puz.h);
  const ox = r.x + (r.w - s * puz.w) / 2, oy = r.y + (r.h - s * puz.h) / 2;
  ctx.fillStyle = th.card[0]; rr(ctx, ox - 3, oy - 3, s * puz.w + 6, s * puz.h + 6, 5); ctx.fill();
  ctx.fillStyle = th.fill[0];
  for (let i = 0; i < M.b.cells.length; i++) if (M.b.cells[i] === FILLED) ctx.fillRect(ox + (i % puz.w) * s, oy + Math.floor(i / puz.w) * s, s + 0.4, s + 0.4);
  ctx.restore();
}

function drawPlay(ctx, S) {
  const th = theme(S);
  const M = S.match;
  const z = TEXT_SCALES[S.textIdx];
  const lay = playLayout(z);
  background(ctx, th, S.t, 800);
  hudBar(ctx, S, M, false);
  if (M.reveal) {
    drawRevealScene(ctx, S, M, lay);
    if (M.parts.length) drawParticles(ctx, M.parts);
    return;
  }
  drawFocusBar(ctx, S, M, lay);
  const g = playGeo(S, M, lay.area);
  M.canZoom = g.canZoom;
  drawNonogram(ctx, th, M.puz, M.b.cells, g, { t: S.t, doneR: M.b.doneR, doneC: M.b.doneC, focus: M.focus, hint: M.hint && M.hint.step ? { axis: M.hint.step.axis, k: M.hint.step.k, cells: M.hint.step.cells } : M.hint && M.hint.bad ? { axis: M.hint.bad.axis, k: M.hint.bad.k, cells: [] } : null, pops: M.pops, flashes: M.flashes });
  if (M.thinking) { ctx.fillStyle = 'rgba(0,0,0,0.0)'; }
  let head = '', body = '', o = {};
  if (M.hint) { head = M.hint.head; const why = hintWhy(z); body = why && (M.hint.step || M.hint.bad) ? '' : M.hint.why; const has = (why || M.hint.step) && (M.hint.step || M.hint.bad); o = { hint: true }; if (has) { if (lay.applyBelow) o.reserve = lay.applyBtn.h + 14; else o.rightReserve = 200 * Math.min(1, z / 1.5); } }
  else if (M.toast) { head = M.toast; o = { headColor: th.hint }; }
  else if (M.tool === 'cross') head = tr('tipCross');
  else if (M.tool === 'move') head = tr('tipMove');
  else head = S.check ? tr('tipCheck') : M.lessonTask ?? tr('tipFill');
  drawStatus(ctx, S, lay.status, head, body, o);
  if (M.hint && (M.hint.step || M.hint.bad)) {
    const pr = S.press && S.press.id === 'hud:apply' && S.press.active;
    const label = hintWhy(z) ? tr('why') : tr('hintApply');
    if (hintWhy(z) || M.hint.step) button(ctx, th, lay.applyBtn, [label], 'primary', { size: Math.min(26 * Math.min(z, 1.6), 38), pressed: pr });
  }
  drawToolbar(ctx, S, M, lay);
  if (lay.preview) drawPreview(ctx, S, M, lay.preview);
  if (M.parts.length) drawParticles(ctx, M.parts);
}

function drawAuto(ctx, S) {
  const th = theme(S);
  const M = S.match, a = S.auto;
  const z = TEXT_SCALES[S.textIdx];
  const lay = autoLayout(z);
  background(ctx, th, S.t, 800);
  hudBar(ctx, S, M, true);
  M.hideName = false;
  const g = boardGeo(M.puz, lay.area, z, 'fit', 0, 0);
  const g2 = { ...g };
  if (M.reveal) {
    drawRevealFrame(ctx, S, M, g, lay, M.reveal.t);
    drawStatus(ctx, S, lay.status, nameOf(M.puz), tr('solvedNote'), {});
  } else {
    const showHint = a.phase === 'reveal' || a.phase === 'act';
    const hint = showHint && a.step ? { axis: a.step.axis, k: a.step.k, cells: a.step.cells } : null;
    const scanHint = a.phase === 'think' && a.scan ? { axis: a.scan.axis, k: a.scan.k, cells: [] } : null;
    drawNonogram(ctx, th, M.puz, M.b.cells, g, { t: S.t, doneR: M.b.doneR, doneC: M.b.doneC, hint: hint ?? scanHint, pops: M.pops });
    // focus readout for the line being considered
    const fr = lay.focus;
    ctx.fillStyle = 'rgba(0,0,0,0.28)'; rr(ctx, fr.x, fr.y, fr.w, fr.h, 18); ctx.fill();
    const cur = hint ?? scanHint;
    if (cur) {
      const clue = cur.axis === 'row' ? M.puz.rows[cur.k] : M.puz.cols[cur.k];
      const fs = fitText(`${lineName(cur.axis, cur.k)}:  ${clueText(clue)}`, fr.w - 36, fr.h - 16, 30 * z, 18, 1.2);
      let y = fr.y + (fr.h - fs.lines.length * fs.line) / 2 + fs.size * 0.88;
      for (const ln of fs.lines) { text(ctx, ln, fr.x + 18, y, fs.size, th.ink, { weight: 700, align: 'left', font: NUM }); y += fs.line; }
    }
    let head = '', body = '';
    if (a.paused) head = tr('pauseTitle');
    else if (a.phase === 'think') head = `${tr('autoThink')} ${Math.max(0, Math.ceil(THINK_STEPS[S.thinkIdx] - a.t))}`;
    else if (a.phase === 'reveal' || a.phase === 'act') { head = a.note.head; body = a.note.why; }
    else if (a.phase === 'intro') head = nameOf(M.puz);
    drawStatus(ctx, S, lay.status, head, body, {});
    if (a.phase === 'think' && !a.paused) {
      const frac = clamp01(a.t / THINK_STEPS[S.thinkIdx]);
      ctx.fillStyle = 'rgba(255,255,255,0.14)'; rr(ctx, lay.status.x + 24, lay.status.y + lay.status.h - 14, lay.status.w - 48, 7, 3.5); ctx.fill();
      ctx.fillStyle = th.accent; rr(ctx, lay.status.x + 24, lay.status.y + lay.status.h - 14, (lay.status.w - 48) * frac, 7, 3.5); ctx.fill();
    }
  }
  // controls
  const sm = z >= 2 ? 0.7 : 1;
  const pressed = (id) => S.press && S.press.id === `auto:${id}` && S.press.active;
  const fitBtn = (r, label, size) => Math.min(size, fitOne(label, r.w - 20, size, 12));
  const sL = tr('autoSlower'), pL = a.paused ? tr('autoPlay') : tr('autoPause'), fL = tr('autoFaster');
  button(ctx, th, lay.slower, [sL], 'normal', { size: fitBtn(lay.slower, sL, 22 * Math.min(z, 1.5) * sm), disabled: S.thinkIdx === 0, pressed: pressed('slower') });
  button(ctx, th, lay.pause, [pL], 'primary', { size: fitBtn(lay.pause, pL, 30 * Math.min(z, 1.6) * sm), pressed: pressed('pause') });
  button(ctx, th, lay.faster, [fL], 'normal', { size: fitBtn(lay.faster, fL, 22 * Math.min(z, 1.5) * sm), disabled: S.thinkIdx === THINK_STEPS.length - 1, pressed: pressed('faster') });
  const tl = `${tr('thinkTime')}: ${THINK_STEPS[S.thinkIdx]}${tr('seconds')}`, lw = lay.mode === 'port' ? 660 : lay.pause.w + (lay.mode === 'wide' ? 0 : 150);
  const lcx = lay.mode === 'port' ? SZ.w / 2 : lay.slower.x + (lay.faster.x + lay.faster.w - lay.slower.x) / 2;
  text(ctx, tl, lcx, lay.labelY, fitOne(tl, lw, 20 * Math.min(z, 1.4), 12), 'rgba(246,236,214,0.7)', { weight: 600 });
  if (M.parts.length) drawParticles(ctx, M.parts);
}

export function render(ctx, S, ui) {
  ctx.textBaseline = 'alphabetic';
  switch (S.scene) {
    case 'title': drawTitle(ctx, S, ui); break;
    case 'chapters': case 'pictures': case 'learn': case 'lesson': case 'howto': case 'rules': case 'about': case 'settings': drawDocScreen(ctx, S, ui); break;
    case 'daily': case 'demo-limit':
      background(ctx, theme(S), S.t);
      panel(ctx, theme(S), ui.panel.x, ui.panel.y, ui.panel.w, ui.panel.h, {});
      drawDocBlocks(ctx, S, ui, S.scroll[ui.scrollKey] ?? 0);
      drawFixed(ctx, S, ui.fixed);
      break;
    case 'play':
      if (!S.match) { background(ctx, theme(S), S.t); break; }
      drawPlay(ctx, S);
      break;
    case 'auto':
      if (!S.match || !S.auto) { background(ctx, theme(S), S.t); break; }
      drawAuto(ctx, S);
      break;
    default: background(ctx, theme(S), S.t);
  }
  if (S.overlay) drawOverlay(ctx, S, ui);
}
export { attractData };
