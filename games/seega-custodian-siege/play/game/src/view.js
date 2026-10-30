// Everything drawn each frame. Reads state, changes nothing.
import {
  DISPLAY, THEMES, themeById, text, rr, panel, button, background, icon, drawParticles, drawStone, boardGeo, drawSlab, drawPits,
  drawMiniBoard, drawCross, arrow, alpha, clamp01, ease, backOut, dateAngle,
} from './art.js';
import { TEXT_SCALES, wrap, tw } from './ui.js';
import { CENTRE, NN, STALL_LIMIT, PIECES, legalMoves, isPlacing, countOf, other } from './rules.js';
import { LEVELS } from './ai.js';
import { LESSONS, lessonTitle, lessonTask } from './lessons.js';
import { tr, getRules, stonesText, sideLabel, lvName, themeShort, themeName } from './content.js';
import { hasArabic } from './lang.js';
import { BACK_BTN, PAUSE_BTN, TOOLBAR_IDS, autoLayout, DOC_PANEL, NAV_PREV, NAV_NEXT, NAV_LABEL, playLayout, SCREEN, HUD, TITLE } from './layout.js';
import { drawCredit, drawMoreLine, drawLockup } from './brand.js';
import { THINK_STEPS } from './screens.js';
import { DROP_T, SLIDE_T, CAP_AT, CAP_T, targetsOf, previewCaps, humanTurn } from './match.js';
import { v3, flatAlpha } from './v3.js';
import { AREA, MENU_REGION } from './layout.js';

// css colour ('#rrggbb' or 'rgba(r,g,b,a)') -> 'r,g,b' for the 3D marks
const rgbOf = (c) => { if (c[0] === '#') return `${parseInt(c.slice(1, 3), 16)},${parseInt(c.slice(3, 5), 16)},${parseInt(c.slice(5, 7), 16)}`; const m = c.match(/\d+(\.\d+)?/g); return m ? m.slice(0, 3).join(',') : '255,255,255'; };
// The flat backdrop. With the 3D scene on it fades out (crossfade) and a scrim keeps text screens readable over the lit camp.
function backdrop(ctx, th, t, glowY, dunes, scrim = 0) {
  const fa = flatAlpha();
  if (fa > 0) { ctx.save(); ctx.globalAlpha = fa; background(ctx, th, t, glowY, dunes); ctx.restore(); }
  if (v3.on && scrim > 0) { ctx.fillStyle = `rgba(14,8,6,${scrim * v3.fade})`; ctx.fillRect(0, 0, SCREEN.width, SCREEN.height); }
}
// A soft lens vignette over the 3D scene keeps the eye on the board and the plaques readable.
function vignette3d(ctx, a = 0.55) {
  if (!v3.on) return;
  const W = SCREEN.width, Hh = SCREEN.height, r = Math.hypot(W, Hh) / 2, g = ctx.createRadialGradient(W / 2, Hh / 2, r * 0.45, W / 2, Hh / 2, r * 1.05);
  g.addColorStop(0, 'rgba(10,6,12,0)'); g.addColorStop(1, `rgba(10,6,12,${a * v3.fade})`); ctx.fillStyle = g; ctx.fillRect(0, 0, W, Hh);
}
// In-world HUD plaque: dark oiled wood with a brass rim and corner studs (also used by the flat art).
export function plaque(ctx, r, o = {}) {
  const rad = o.r ?? 20, acc = o.accent ?? '#f0c46a';
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 6;
  const g = ctx.createLinearGradient(r.x, r.y, r.x, r.y + r.h);
  g.addColorStop(0, `rgba(62,38,22,${o.a ?? 0.9})`); g.addColorStop(1, `rgba(28,16,9,${(o.a ?? 0.9) + 0.04})`);
  ctx.fillStyle = g; rr(ctx, r.x, r.y, r.w, r.h, rad); ctx.fill();
  ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
  ctx.save(); rr(ctx, r.x, r.y, r.w, r.h, rad); ctx.clip();
  ctx.strokeStyle = 'rgba(255,220,170,0.035)'; ctx.lineWidth = 2;
  for (let i = 0; i < 9; i++) { const yy = r.y + (i + 0.5) * r.h / 9; ctx.beginPath(); ctx.moveTo(r.x, yy); ctx.bezierCurveTo(r.x + r.w * 0.3, yy + Math.sin(i * 1.7) * 6, r.x + r.w * 0.7, yy - Math.cos(i * 2.3) * 6, r.x + r.w, yy + Math.sin(i) * 4); ctx.stroke(); }
  const sh = ctx.createLinearGradient(0, r.y, 0, r.y + r.h * 0.5); sh.addColorStop(0, 'rgba(255,230,190,0.10)'); sh.addColorStop(1, 'rgba(255,230,190,0)'); ctx.fillStyle = sh; ctx.fillRect(r.x, r.y, r.w, r.h * 0.5);
  ctx.restore();
  const bg = ctx.createLinearGradient(r.x, r.y, r.x, r.y + r.h); bg.addColorStop(0, '#f2d38e'); bg.addColorStop(0.5, '#b88a3e'); bg.addColorStop(1, '#7a5622');
  if (o.active) { ctx.shadowColor = alpha(acc.length === 7 ? acc : '#e8c46a', 0.8); ctx.shadowBlur = 18; }
  ctx.strokeStyle = o.active ? acc : bg; ctx.lineWidth = o.active ? 3.5 : 2.5; rr(ctx, r.x, r.y, r.w, r.h, rad); ctx.stroke();
  ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(255,232,186,0.16)'; ctx.lineWidth = 1.2; rr(ctx, r.x + 6, r.y + 6, r.w - 12, r.h - 12, Math.max(4, rad - 5)); ctx.stroke();
  for (const [sx, sy] of [[r.x + 11, r.y + 11], [r.x + r.w - 11, r.y + 11], [r.x + 11, r.y + r.h - 11], [r.x + r.w - 11, r.y + r.h - 11]]) {
    const sg = ctx.createRadialGradient(sx - 1, sy - 1, 0.5, sx, sy, 4); sg.addColorStop(0, '#fff2c8'); sg.addColorStop(0.5, '#c99a4a'); sg.addColorStop(1, '#5e3e14');
    ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(sx, sy, 3.6, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

const theme = (S) => themeById(S.themeId);

// Largest text size (<= start) whose wrapped lines fit w x h. Used by every HUD text so zoom never overflows.
export function fitText(str, w, h, start, min = 20, lh = 1.28) {
  let size = start;
  for (; size > min; size -= 2) {
    const lines = wrap(str, size, w);
    if (lines.length * size * lh <= h) return { lines, size, line: size * lh };
  }
  const lines = wrap(str, min, w);
  return { lines, size: min, line: min * lh };
}
const fitOne = (str, w, start, min = 19) => { let s = start; while (s > min && tw(str, s) > w) s -= 1; return s; };

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
        const rtl = !center && hasArabic(it.lines[i]); // Arabic paragraphs read from the right edge
        text(ctx, it.lines[i], center ? ox + it.w / 2 : rtl ? ox + it.w : ox, top + i * it.line + it.size * 0.98, it.size, 'rgba(250,240,222,0.94)', { weight: 500, align: center ? 'center' : rtl ? 'right' : 'left' });
      }
    } else if (b.t === 'img') {
      drawArt(ctx, S, b.name, ox, top, it.w, b.h, b);
    } else if (b.t === 'btn') {
      const bt = it.btns[0], r = { x: ox + bt.x, y: oy + bt.y, w: bt.w, h: bt.h }, pressed = S.press && S.press.id === bt.id && S.press.active;
      if (b.icon && it.lines.length === 1 && !(it.sub && it.sub.length)) iconButton(ctx, th, r, it.lines[0], b.icon, b.kind ?? 'normal', it.size, { disabled: bt.disabled, pressed });
      else button(ctx, th, r, it.lines, b.kind ?? 'normal', { size: it.size, line: it.line, sub: it.sub, disabled: bt.disabled, pressed });
    } else if (b.t === 'row') {
      for (const bt of it.btns) {
        if (bt.id == null) { text(ctx, bt.label, ox + bt.x + bt.w / 2, oy + bt.y + bt.h / 2 + it.size * 0.34, it.size, th.ink, { weight: 700 }); continue; }
        const q = b.items.find((x) => x.id === bt.id) ?? {}, r = { x: ox + bt.x, y: oy + bt.y, w: bt.w, h: bt.h }, pressed = S.press && S.press.id === bt.id && S.press.active;
        const stacked = b.items.length > 1 && bt.w > 0.9 * (ui.region ? ui.region.w : 9999);
        if (q.icon && b.tiles && !stacked && bt.lines.length === 1) tileButton(ctx, th, r, bt.lines[0], q.icon, it.size, { disabled: bt.disabled, pressed });
        else if (q.icon && bt.lines.length === 1) iconButton(ctx, th, r, bt.lines[0], q.icon, bt.kind ?? 'normal', it.size, { disabled: bt.disabled, pressed, note: q.note });
        else button(ctx, th, r, bt.lines, bt.kind ?? 'normal', { size: it.size, line: it.line, disabled: bt.disabled, pressed });
      }
    }
  }
  ctx.restore();
  if (layout.height > region.h) {
    const track = region.h - 8, tH = Math.max(48, (region.h / layout.height) * track);
    const ty = region.y + 4 + (scroll / (layout.height - region.h)) * (track - tH);
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    rr(ctx, region.x + region.w + 8, region.y + 4, 6, track, 3); ctx.fill();
    ctx.fillStyle = alpha(th.accent.length === 7 ? th.accent : '#e8c46a', 0.75);
    rr(ctx, region.x + region.w + 8, ty, 6, tH, 3); ctx.fill();
  }
}

// A menu button with a line icon before its label (and an optional small note under it).
function iconButton(ctx, th, r, label, ic, kind, size, o = {}) {
  button(ctx, th, r, [], kind, { disabled: o.disabled, pressed: o.pressed });
  ctx.save(); if (o.disabled) ctx.globalAlpha = 0.38;
  const ink = kind === 'primary' ? th.primaryInk : th.ink, dy = o.pressed ? 2 : 0, is = Math.min(r.h * 0.5, size * 1.05), gap = size * 0.45;
  const fs = fitOne(label, r.w - is - gap - 28, size, 16), wT = tw(label, fs), x0 = r.x + r.w / 2 - (is + gap + wT) / 2, cy = r.y + r.h / 2 + dy - (o.note ? fs * 0.32 : 0);
  icon(ctx, ic, x0 + is / 2, cy, is, ink);
  text(ctx, label, x0 + is + gap, cy + fs * 0.35, fs, ink, { weight: kind === 'primary' ? 800 : 700, align: hasArabic(label) ? 'right' : 'left' });
  if (o.note) text(ctx, o.note, x0 + is + gap + wT / 2, cy + fs * 1.2, fs * 0.68, kind === 'primary' ? alpha(th.primaryInk, 0.75) : 'rgba(246,236,214,0.66)', { weight: 600 });
  ctx.restore();
}
// A small square tile: icon above a short label.
function tileButton(ctx, th, r, label, ic, size, o = {}) {
  button(ctx, th, r, [], 'normal', { disabled: o.disabled, pressed: o.pressed, radius: 16 });
  ctx.save(); if (o.disabled) ctx.globalAlpha = 0.38;
  const dy = o.pressed ? 2 : 0, fs = fitOne(label, r.w - 10, size, 18), is = Math.min(r.h * 0.42, 40), tot = is + 8 + fs;
  icon(ctx, ic, r.x + r.w / 2, r.y + (r.h - tot) / 2 + is / 2 + dy, is, th.accent);
  text(ctx, label, r.x + r.w / 2, r.y + (r.h - tot) / 2 + is + 8 + fs * 0.82 + dy, fs, th.ink, { weight: 700 });
  ctx.restore();
}

function drawFixed(ctx, S, list) {
  const th = theme(S);
  for (const f of list) {
    if (f.static) { text(ctx, f.label, f.rect.x + f.rect.w / 2, f.rect.y + f.rect.h / 2 + 10, f.size, 'rgba(246,236,214,0.8)', { weight: 700 }); continue; }
    const pressed = S.press && S.press.id === f.id && S.press.active;
    if (f.icon) {
      button(ctx, th, f.rect, [], f.kind, { disabled: f.disabled, pressed });
      icon(ctx, f.icon, f.rect.x + 36, f.rect.y + f.rect.h / 2 + (pressed ? 2 : 0), 30, th.ink);
      text(ctx, f.label, f.rect.x + 62 + (f.rect.w - 72) / 2, f.rect.y + f.rect.h / 2 + f.size * 0.34 + (pressed ? 2 : 0), f.size, th.ink, { weight: 700 });
    } else button(ctx, th, f.rect, f.lines ?? [f.label], f.kind, { size: f.size, line: f.line, disabled: f.disabled, pressed });
  }
}

// ----------------------------------------------------------------------------------- illustrations
const cap = (ctx, str, x, y, size = 22, col = 'rgba(246,236,214,0.84)') => text(ctx, str, x, y, size, col, { weight: 600 });
const BEFORE_CAP = '...../XO.X./...../..O../.X..O';
const AFTER_CAP = '...../X.X../...../..O../.X..O';

function drawArt(ctx, S, name, x, y, w, h, b) {
  const th = theme(S);
  const cx = x + w / 2, cy = y + h / 2, t = S.t;
  ctx.save();
  ctx.fillStyle = 'rgba(10,6,4,0.5)'; rr(ctx, x, y, w, h, 18); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.14)'; ctx.lineWidth = 1.5; rr(ctx, x, y, w, h, 18); ctx.stroke();
  ctx.beginPath(); rr(ctx, x, y, w, h, 18); ctx.clip();
  const mb = (bx, by, side, cells, o) => drawMiniBoard(ctx, th, bx, by, side, cells, o);
  const one = (side = 300) => Math.min(h - 78, side, w - 40);
  const two = () => Math.min(w * 0.42, h - 96);
  const pair = (a, ao, bb, bo, ca, cb, tone) => {
    const s = two();
    mb(x + 20, y + 18, s, a, ao); mb(x + w - s - 20, y + 18, s, bb, bo);
    arrow(ctx, th.accent, cx - 22, y + 18 + s / 2, cx + 22, y + 18 + s / 2, 5);
    cap(ctx, ca, x + 20 + s / 2, y + h - 22, 20); cap(ctx, cb, x + w - s / 2 - 20, y + h - 22, 20, tone ?? th.accent);
  };
  if (name === 'logo') {
    const s = Math.min(h - 40, 240);
    mb(cx - s / 2, y + 20, s, 'XOXOX/OXOXO/XO.OX/OXOXO/XOXOX', {});
  } else if (name === 'goal') {
    pair(BEFORE_CAP, { arrows: [[8, 7]], marks: [6] }, AFTER_CAP, {}, tr('cSlideIn'), tr('cGone'));
  } else if (name === 'board') {
    const s = one(310);
    mb(cx - s / 2, y + 14, s, 'X.O.X/.O.X./X..OX/.X.O./O.X.O', { hl: [CENTRE] });
    cap(ctx, tr('cCentreEmpty'), cx, y + h - 20, 21, th.accent);
  } else if (name === 'place') {
    const s = one(310);
    const g = mb(cx - s / 2, y + 14, s, 'XO.../.XO../...../...X./.O...', {});
    for (const [who, c] of [[1, 8], [1, 17]]) { const [gx, gy] = g.centers[c]; drawStone(ctx, th, who, gx, gy, g.d, { ghost: true, alpha: 0.6 + 0.4 * Math.sin(t * 4), cell: c }); }
    cap(ctx, tr('cTwoTurn'), cx, y + h - 20, 21);
  } else if (name === 'first') {
    const s = one(310);
    mb(cx - s / 2, y + 14, s, 'OXOXO/XOXOX/XO.OO/OXOXX/XOXOX', { arrows: [[7, 12]], hl: [CENTRE], marks: [11] });
    cap(ctx, tr('cFirstSlide'), cx, y + h - 20, 21, th.accent);
  } else if (name === 'move') {
    const s = one(310);
    mb(cx - s / 2, y + 14, s, '...../.OX../..O../...../.....', { hl: [7], dots: [2, 8] });
    cap(ctx, tr('cOneStep'), cx, y + h - 20, 21);
  } else if (name === 'capture') {
    pair(BEFORE_CAP, { arrows: [[8, 7]], marks: [6] }, AFTER_CAP, {}, tr('cEachSide'), tr('cCaptured'));
  } else if (name === 'between') {
    const s = one(300);
    mb(cx - s / 2, y + 14, s, '...../.O.O./..X../...../.....', { arrows: [[12, 7]] });
    cap(ctx, tr('cBetween'), cx, y + h - 20, 21);
  } else if (name === 'multi') {
    pair('...../..X../XO.OX/..O../.....', { arrows: [[7, 12]], marks: [11, 13] }, '...../...../X.X.X/..O../.....', {}, tr('cTwoSand'), tr('cBoth'));
  } else if (name === 'chain') {
    const s = one(310);
    mb(cx - s / 2, y + 14, s, '..X../XO.../...OX/...../....O', { arrows: [[2, 7], [7, 12]], marks: [6, 13] });
    cap(ctx, tr('cChain'), cx, y + h - 20, 20, th.accent);
  } else if (name === 'safe') {
    const defs = [['X..../.O.../...../...../.....', [0], tr('cCorner')], ['..X../.O.../...../...../.....', [2], tr('cEdge')], ['...../...../..X../...../.....', [12], tr('cCentre')]];
    const s3 = Math.min((w - 4 * 14) / 3, h - 90);
    defs.forEach(([cells, hl, nm], i) => { const bx = x + 14 + i * (s3 + 14); mb(bx, cy - s3 / 2 - 14, s3, cells, { hl }); cap(ctx, nm, bx + s3 / 2, cy + s3 / 2 + 20, 20); });
  } else if (name === 'blocked') {
    const s = one(300);
    mb(cx - s / 2, y + 14, s, '...../...../...../X...X/OXXXO', { hl: [20, 24] });
    cap(ctx, tr('cBlocked'), cx, y + h - 20, 20, th.accent);
  } else if (name === 'end') {
    const s = one(300);
    mb(cx - s / 2, y + 14, s, 'XX.XX/X.XX./.XOX./XX.XX/.XX..', { hl: [] });
    cap(ctx, tr('cOneLeft'), cx, y + h - 20, 21, th.accent);
  } else if (name === 'sides') {
    [1, 2].forEach((who, i) => {
      const cw = w / 2 - 44, bx = x + 28 + i * (cw + 32), cardH = h - 36, cyc = y + 18;
      ctx.fillStyle = th.btn[0]; rr(ctx, bx, cyc, cw, cardH, 18); ctx.fill();
      const ss = Math.min(cardH * 0.36, 96);
      drawStone(ctx, th, who, bx + cw / 2, cyc + cardH * 0.1 + ss * 0.6, ss, { cell: 3 });
      cap(ctx, who === 1 ? tr('cPlaceFirst') : tr('cPlaceSecond'), bx + cw / 2, cyc + cardH - Math.min(cardH * 0.3, 68) + 10, Math.min(24, cw / 9), th.ink);
      cap(ctx, who === 1 ? tr('cMoveSecond') : tr('cMoveFirst'), bx + cw / 2, cyc + cardH - 20, Math.min(22, cw / 10), th.accent);
    });
  } else if (name === 'think') {
    const s = Math.min(h - 100, 270);
    const g = mb(cx - s / 2, y + 14, s, BEFORE_CAP, { arrows: [], marks: [6] });
    const [px, py] = g.centers[7];
    ctx.save(); ctx.strokeStyle = th.accent; ctx.lineWidth = 4; ctx.globalAlpha = 0.6 + 0.4 * Math.sin(t * 4); rr(ctx, px - g.cell * 0.45, py - g.cell * 0.45, g.cell * 0.9, g.cell * 0.9, g.cell * 0.12); ctx.stroke(); ctx.restore();
    ctx.fillStyle = 'rgba(10,6,4,0.8)'; rr(ctx, x + 30, y + h - 70, w - 60, 48, 24); ctx.fill();
    ctx.strokeStyle = th.stroke; ctx.lineWidth = 1.5; rr(ctx, x + 30, y + h - 70, w - 60, 48, 24); ctx.stroke();
    cap(ctx, tr('cThinkEx'), cx, y + h - 38, 22, th.accent);
  } else if (name === 'sizes') {
    const s3 = Math.min((w - 4 * 14) / 3, h - 90);
    [5, 7, 9].forEach((n, i) => {
      const bx = x + 14 + i * (s3 + 14), by = cy - s3 / 2 - 14;
      drawSlab(ctx, th, bx, by, s3, { flat: true, thick: s3 * 0.03, border: false });
      const m = s3 * 0.09, cell = (s3 - 2 * m) / n;
      ctx.fillStyle = th.pit[0];
      for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) { rr(ctx, bx + m + c * cell + cell * 0.07, by + m + r * cell + cell * 0.07, cell * 0.86, cell * 0.86, cell * 0.14); ctx.fill(); }
      cap(ctx, n === 5 ? tr('cSize5') : `${n}${hasArabic(tr('cSize5')) ? '×' : 'x'}${n}`, bx + s3 / 2, cy + s3 / 2 + 20, 19, n === 5 ? th.accent : 'rgba(246,236,214,0.84)');
    });
  } else if (name === 'levels') {
    LEVELS.forEach((l, i) => {
      const yy = y + 24 + i * ((h - 48) / 5);
      cap(ctx, lvName(l.id), x + 120, yy + 30, 24, th.ink);
      ctx.fillStyle = 'rgba(255,255,255,0.12)'; rr(ctx, x + 250, yy + 12, w - 290, 26, 13); ctx.fill();
      ctx.fillStyle = th.accent; rr(ctx, x + 250, yy + 12, (w - 290) * (0.2 + 0.2 * i), 26, 13); ctx.fill();
    });
  } else if (name === 'learn') {
    [[lessonTitle(LESSONS[0]), true], [lessonTitle(LESSONS[3]), true], [lessonTitle(LESSONS[5]), false]].forEach(([nm, done], i) => {
      const yy = y + 20 + i * 112;
      ctx.fillStyle = done ? th.btnOn[0] : th.btn[0]; rr(ctx, x + 24, yy, w - 48, 96, 16); ctx.fill();
      mb(x + 36, yy + 8, 80, i === 0 ? 'X..../.O.../...../...../.....' : i === 1 ? BEFORE_CAP : '..X../XO.../...OX/...../....O', { border: false });
      text(ctx, nm, x + 140, yy + 56, 26, th.ink, { weight: 700, align: 'left' });
      if (done) icon(ctx, 'check', x + w - 70, yy + 48, 40, th.ink);
    });
  } else if (name === 'undo') {
    icon(ctx, 'undo', cx - 130, cy - 14, 84, th.accent); icon(ctx, 'reset', cx + 130, cy - 14, 84, th.accent);
    cap(ctx, tr('undo'), cx - 130, cy + 70, 24); cap(ctx, tr('restart'), cx + 130, cy + 70, 24);
  } else if (name === 'auto') {
    ctx.strokeStyle = 'rgba(255,255,255,0.16)'; ctx.lineWidth = 12; ctx.beginPath(); ctx.arc(cx - 150, cy, 46, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = th.accent; ctx.beginPath(); ctx.arc(cx - 150, cy, 46, -Math.PI / 2, -Math.PI / 2 + ((t * 0.4) % 1) * Math.PI * 2); ctx.stroke();
    drawStone(ctx, th, 1, cx + 10, cy, 96, { glow: 0.5 + 0.5 * Math.sin(t * 5) });
    icon(ctx, 'pause', cx + 150, cy, 52, th.accent);
    cap(ctx, tr('cThinkReveal'), cx, y + h - 18, 22, th.accent);
  } else if (name === 'themes') {
    const s = (w - 4 * 16) / 3;
    THEMES.forEach((tt, i) => {
      const bx = x + 16 + i * (s + 16);
      drawMiniBoard(ctx, tt, bx, cy - s / 2 - 14, s, 'XO.../.XO../...../...../.....', {});
      cap(ctx, themeShort(tt.id), bx + s / 2, cy + s / 2 + 22, 19);
    });
  } else if (name === 'lock') {
    icon(ctx, 'lock', cx, cy, 90, th.accent);
  } else if (name === 'endmark') {
    const e = b.data ?? {};
    const k = backOut(clamp01((S.ovT - 0.15) / 0.5));
    const ss = Math.min(110, h * 0.72);
    if (e.winner === 1 || e.winner === 2) drawStone(ctx, th, e.winner, cx, cy + 4, ss, { scale: k, glow: 0.5 + 0.4 * Math.sin(S.ovT * 4), cell: 3 });
    else { drawStone(ctx, th, 1, cx - ss * 0.75, cy + 4, ss * 0.88, { scale: k }); drawStone(ctx, th, 2, cx + ss * 0.75, cy + 4, ss * 0.88, { scale: k, cell: 3 }); }
  }
  ctx.restore();
}

// --------------------------------------------------------------------------------------- title
// The title's attract scene: a short mid-game plays out on a real board: a capture, a recapture, then two quiet moves.
const ATTRACT_START = 'O.X.O/XO..X/...O./X.O../O..XO';
const ATTRACT = [[2, 7, [6], 1], [17, 22, [23], 2], [9, 14, [], 1], [13, 12, [], 2]];
const ATTRACT_STEP = 1.5;

function drawAttract(ctx, S) {
  const th = theme(S), t = S.t, W = 720;
  ctx.save();
  // the art block is authored in a 720-wide space (local y 90..732) and scaled / placed by the title layout
  ctx.translate(TITLE.cx, TITLE.top); ctx.scale(TITLE.s, TITLE.s); ctx.translate(-360, -90);
  const side = 344, bx = (W - side) / 2, by = 388;
  const cycle = ATTRACT.length * ATTRACT_STEP + 1.4;
  const tt = t % cycle;
  const geo = boardGeo(bx, by, side);
  const fa = flatAlpha();
  if (fa > 0) {
    ctx.save(); ctx.globalAlpha = fa;
    const glow = ctx.createRadialGradient(W / 2, by + side / 2, 30, W / 2, by + side / 2, 340);
    glow.addColorStop(0, th.glow); glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow; ctx.fillRect(0, by - 140, W, side + 280);
    drawSlab(ctx, th, bx, by, side);
    drawPits(ctx, th, geo);
    ctx.restore();
  }
  const cells = ATTRACT_START.replace(/[\s/]/g, '').split('').map((c) => (c === 'X' ? 1 : c === 'O' ? 2 : 0));
  const k = Math.min(ATTRACT.length, Math.floor(tt / ATTRACT_STEP));
  const age = tt - k * ATTRACT_STEP;
  const fadeOut = tt > ATTRACT.length * ATTRACT_STEP + 0.6 ? 1 - clamp01((tt - (ATTRACT.length * ATTRACT_STEP + 0.6)) / 0.7) : 1;
  const fadeIn = clamp01(tt / 0.4);
  const ghosts = [];
  for (let i = 0; i < k; i++) { const [f, to, caps] = ATTRACT[i]; cells[to] = cells[f]; cells[f] = 0; for (const c of caps) cells[c] = 0; }
  let moving = null;
  if (k < ATTRACT.length && age > 0.25) {
    const [f, to, caps, who] = ATTRACT[k];
    const slideK = clamp01((age - 0.25) / SLIDE_T);
    moving = { from: f, to, who, k: slideK };
    cells[f] = 0;
    if (slideK >= 0.85) for (const c of caps) { cells[c] = 0; ghosts.push({ cell: c, who: who === 1 ? 2 : 1, k: clamp01((age - 0.25 - SLIDE_T * 0.85) / CAP_T) }); }
  }
  const alphaAll = fadeOut * fadeIn * fa;
  if (v3.on) {
    // the 3D board plays the same short game; captured stones are lifted off to their heap beside the board
    const c3 = cells.slice(), anim = {};
    if (moving) { c3[moving.to] = moving.who; anim[moving.to] = { kind: 'slide', from: moving.from, t: moving.k * SLIDE_T }; }
    v3.frame = { mode: 'title', cells: c3, anim, sel: -1, ghosts: ghosts.map((g) => ({ cell: g.cell, who: g.who, k: g.k })), win: null };
  }
  for (let i = 0; i < NN; i++) {
    if (!cells[i]) continue;
    const [cx, cy] = geo.centers[i];
    drawStone(ctx, th, cells[i], cx, cy, geo.d, { alpha: alphaAll, cell: i });
  }
  for (const g of ghosts) { const [cx, cy] = geo.centers[g.cell]; drawStone(ctx, th, g.who, cx, cy, geo.d, { alpha: alphaAll * (1 - g.k), scale: 1 - 0.4 * g.k, cell: g.cell, rot: g.k * 1.2 }); }
  if (moving) {
    const [fx, fy] = geo.centers[moving.from], [tx, ty] = geo.centers[moving.to];
    const e = moving.k * moving.k * (3 - 2 * moving.k);
    drawStone(ctx, th, moving.who, fx + (tx - fx) * e, fy + (ty - fy) * e, geo.d, { alpha: alphaAll, lift: Math.sin(moving.k * Math.PI), cell: moving.to });
  }
  const g = ctx.createLinearGradient(0, 120, 0, 290);
  g.addColorStop(0, light2(th.accent)); g.addColorStop(0.5, th.accent); g.addColorStop(1, '#a8782a');
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.65)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 8;
  ctx.font = `800 128px ${DISPLAY}`; ctx.textAlign = 'center'; ctx.fillStyle = g;
  ctx.direction = hasArabic(tr('seega')) ? 'rtl' : 'ltr';
  ctx.fillText(tr('seega'), 360, 190);
  ctx.font = `800 64px ${DISPLAY}`;
  ctx.fillText(tr('desertSiege'), 360, 262);
  ctx.restore();
  const tsh = v3.on ? { shadow: 'rgba(0,0,0,0.9)', blur: 12, dy: 2 } : {};
  text(ctx, tr('fromEgypt'), 360, 316, 26, 'rgba(250,238,214,0.9)', { weight: 600, ...tsh });
  text(ctx, tr('tagline'), 360, 352, 25, v3.on ? 'rgba(250,238,214,0.8)' : 'rgba(250,238,214,0.62)', { weight: 500, ...tsh });
  ctx.restore();
}
const light2 = (c) => (c.length === 7 ? `rgb(${Math.min(255, parseInt(c.slice(1, 3), 16) + 70)},${Math.min(255, parseInt(c.slice(3, 5), 16) + 70)},${Math.min(255, parseInt(c.slice(5, 7), 16) + 70)})` : '#fff3c4');

function drawTitle(ctx, S, ui) {
  backdrop(ctx, theme(S), S.t, 560, true);
  if (v3.on) {
    // the 3D hero: the board on its kilim gets the room between the title lettering and the menu
    const U = AREA, menuTop = MENU_REGION.y + (ui.offY || 0);
    v3.hero = TITLE.land ? { x: U.x0 + 8, y: TITLE.top + 250 * TITLE.s, w: MENU_REGION.x - 24 - U.x0, h: U.y1 - 6 - (TITLE.top + 250 * TITLE.s) }
      : { x: U.x0 + 10, y: TITLE.top + 300 * TITLE.s, w: U.w - 20, h: menuTop - 14 - (TITLE.top + 300 * TITLE.s) };
    // dusk shade under the lettering and the menu, so both read over the sky and the sand
    const W = SCREEN.width, Hh = SCREEN.height, g = ctx.createLinearGradient(0, 0, 0, Hh);
    g.addColorStop(0, `rgba(8,6,16,${0.6 * v3.fade})`); g.addColorStop(TITLE.land ? 0.34 : 0.22, 'rgba(8,6,16,0)'); g.addColorStop(TITLE.land ? 0.8 : 0.62, 'rgba(10,6,4,0)'); g.addColorStop(1, `rgba(10,6,4,${0.72 * v3.fade})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, Hh);
    if (TITLE.land) { const gx = ctx.createLinearGradient(MENU_REGION.x - 80, 0, W, 0); gx.addColorStop(0, 'rgba(10,6,4,0)'); gx.addColorStop(0.3, `rgba(10,6,4,${0.5 * v3.fade})`); gx.addColorStop(1, `rgba(10,6,4,${0.6 * v3.fade})`); ctx.fillStyle = gx; ctx.fillRect(MENU_REGION.x - 80, 0, W, Hh); }
    vignette3d(ctx, 0.45);
  }
  drawAttract(ctx, S);
  drawDocBlocks(ctx, S, ui, S.scroll[ui.scrollKey] ?? 0);
  drawFixed(ctx, S, ui.fixed);
  { const c = TITLE.lock, pad = c.h * 0.12, dim = S.press && S.press.kind === 'lock'; ctx.save(); ctx.globalAlpha = dim ? 0.7 : 1; ctx.fillStyle = 'rgba(10,8,24,0.55)'; ctx.beginPath(); ctx.roundRect(c.x - pad, c.y - pad, c.w + 2 * pad, c.h + 2 * pad, (c.h + 2 * pad) * 0.3); ctx.fill(); if (!drawLockup(ctx, c.x + c.w / 2, c.y + c.h, c.w, 1)) drawCredit(ctx, TITLE.creditX, TITLE.creditY, 20); ctx.restore(); }
}

function drawDocScreen(ctx, S, ui) {
  const th = theme(S);
  backdrop(ctx, th, S.t, 700, false, 0.6);
  if (ui.panel) panel(ctx, th, ui.panel.x, ui.panel.y, ui.panel.w, ui.panel.h, {});
  drawDocBlocks(ctx, S, ui, S.scroll[ui.scrollKey] ?? 0);
  drawFixed(ctx, S, ui.fixed);
  if (ui.nav) {
    drawFixed(ctx, S, [ui.nav.prev, ui.nav.next]);
    text(ctx, ui.nav.label, NAV_LABEL.x, NAV_LABEL.y, 26, 'rgba(246,236,214,0.75)', { weight: 600 });
  }
}

function drawOverlay(ctx, S, ui) {
  const th = theme(S), W = SCREEN.width, H = SCREEN.height;
  ctx.fillStyle = `rgba(8,4,2,${0.62 * clamp01(S.ovT / 0.25)})`;
  ctx.fillRect(0, 0, W, H);
  const k = ease(clamp01(S.ovT / 0.3));
  ctx.save();
  ctx.translate(W / 2, H / 2); ctx.scale(0.92 + 0.08 * k, 0.92 + 0.08 * k); ctx.translate(-W / 2, -H / 2);
  ctx.globalAlpha = k;
  panel(ctx, th, ui.panel.x, ui.panel.y, ui.panel.w, ui.panel.h, {});
  drawDocBlocks(ctx, S, ui, S.scroll[ui.scrollKey] ?? 0);
  drawFixed(ctx, S, ui.fixed);
  if (ui.more) drawMoreLine(ctx, ui.more.x, ui.more.y, 19);
  ctx.restore();
}

// ------------------------------------------------------------------------------------------ stones in motion
// a = { t, kind: 'drop' | 'slide', from: [x, y] } (time since the move began). o: { alpha, glow, scale, cell }
export function animStone(ctx, th, who, x, y, d, a, o = {}) {
  if (!a) { drawStone(ctx, th, who, x, y, d, o); return; }
  if (a.kind === 'drop') {
    const k = clamp01(a.t / DROP_T), e = ease(k);
    const squash = k > 0.55 ? Math.sin(((k - 0.55) / 0.45) * Math.PI) * 0.05 : 0;
    drawStone(ctx, th, who, x, y - (1 - e) * d * 0.85, d, { ...o, alpha: (o.alpha ?? 1) * clamp01(a.t / 0.1), scale: (o.scale ?? 1) * (1 + 0.28 * (1 - e) + squash), lift: 1 - e });
  } else {
    const k = clamp01(a.t / SLIDE_T), e = k * k * (3 - 2 * k);
    const px = a.from[0] + (x - a.from[0]) * e, py = a.from[1] + (y - a.from[1]) * e;
    drawStone(ctx, th, who, px, py, d, { ...o, lift: Math.sin(k * Math.PI), scale: o.scale ?? 1 });
  }
}

// ------------------------------------------------------------------------------------------ play
function drawHud(ctx, S, title, sub, showPause) {
  const th = theme(S);
  button(ctx, th, BACK_BTN, [], 'normal', { pressed: S.press && S.press.id === 'hud:back' && S.press.active });
  icon(ctx, 'back', BACK_BTN.x + BACK_BTN.w / 2, BACK_BTN.y + BACK_BTN.h / 2, 34, th.ink);
  if (showPause) {
    button(ctx, th, PAUSE_BTN, [], 'normal', { pressed: S.press && S.press.id === 'hud:pause' && S.press.active });
    icon(ctx, 'pause', PAUSE_BTN.x + PAUSE_BTN.w / 2, PAUSE_BTN.y + PAUSE_BTN.h / 2, 34, th.ink);
  }
  const z = TEXT_SCALES[S.textIdx];
  const tSize = fitOne(title, HUD.title.maxW, (SCREEN.land ? 34 : 40) * (1 + (z - 1) * 0.25), 22);
  text(ctx, title, HUD.title.x, HUD.title.y, tSize, th.ink, { font: DISPLAY, weight: 800, shadow: 'rgba(0,0,0,0.6)' });
  const sSize = fitOne(sub, HUD.sub.maxW, 24 * (1 + (z - 1) * 0.3), 18);
  text(ctx, sub, HUD.sub.x, HUD.sub.y, sSize, 'rgba(250,238,214,0.72)', { weight: 500 });
}

function drawPlate(ctx, S, r, who, name, sub, active) {
  const th = theme(S), z = TEXT_SCALES[S.textIdx];
  plaque(ctx, r, { active, accent: th.accent });
  const md = Math.min(r.h - 28, 74);
  drawStone(ctx, th, who, r.x + 14 + md / 2, r.y + r.h / 2, md * 0.85, { noShadow: true, glow: active ? 0.4 : 0, cell: 3 });
  const tx = r.x + 24 + md, avail = r.w - md - 40;
  const ns = fitOne(name, avail, 30 * (1 + (z - 1) * 0.55), 20);
  const ss = fitOne(sub, avail, 21 * (1 + (z - 1) * 0.55), 18);
  const total = ns + ss + 8, ty = r.y + (r.h - total) / 2 + ns * 0.88;
  text(ctx, name, tx, ty, ns, th.ink, { weight: 800, align: 'left', font: DISPLAY });
  text(ctx, sub, tx, ty + ss + 8, ss, active ? th.accent : 'rgba(246,236,214,0.64)', { weight: 600, align: 'left' });
}

function drawStatus(ctx, S, r, head, body, col) {
  const th = theme(S), z = TEXT_SCALES[S.textIdx];
  plaque(ctx, r, { r: 22, accent: th.accent });
  const pad = 22, w = r.w - pad * 2;
  const full = body ? `${head}\n${body}` : head;
  const f = fitText(full, w, r.h - 24, 32 * (1 + (z - 1) * 0.6), 20);
  const hl = wrap(head, f.size, w).length;
  const all = body ? [...wrap(head, f.size, w), ...wrap(body, f.size, w)] : wrap(head, f.size, w);
  const total = all.length * f.line;
  let ty = r.y + (r.h - total) / 2 + f.size * 0.95;
  all.forEach((ln, i) => { text(ctx, ln, r.x + r.w / 2, ty, f.size, i < hl ? (col ?? th.accent) : 'rgba(250,240,222,0.93)', { weight: i < hl ? 800 : 500 }); ty += f.line; });
}

function pulse(S, rate = 5) { return 0.5 + 0.5 * Math.sin(S.t * rate); }

const sq = (ctx, geo, i, grow = 0.9) => { const [cx, cy] = geo.centers[i], s = geo.cell * grow; rr(ctx, cx - s / 2, cy - s / 2, s, s, geo.cell * 0.12); };

// Draws the board and its stones for a match. `auto` carries Watch & Learn's reveal info.
function drawBoardScene(ctx, S, M, geo, auto) {
  const th = theme(S), fa = flatAlpha(), three = v3.on;
  ctx.save();
  ctx.globalAlpha = fa;
  const glow = ctx.createRadialGradient(geo.x + geo.side / 2, geo.y + geo.side / 2, 40, geo.x + geo.side / 2, geo.y + geo.side / 2, geo.side * 0.85);
  glow.addColorStop(0, th.glow); glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow; ctx.fillRect(geo.x - 160, geo.y - 160, geo.side + 320, geo.side + 320);
  if (fa > 0) { drawSlab(ctx, th, geo.x, geo.y, geo.side); drawPits(ctx, th, geo); }
  ctx.globalAlpha = 1;
  const pl = pulse(S);
  const st = M.st;
  const acc = th.accent.length === 7 ? th.accent : '#e8c46a';
  // every mark goes to both layers: the flat board (fading out) and the 3D pockets (as light)
  const ring = (i, col, lw = 4, a = 1, grow = 0.92) => { if (three) v3.marks.push({ sq: i, rgb: rgbOf(col), a: Math.min(1, a * (lw >= 4 ? 1 : lw >= 3 ? 0.7 : 0.45)), ring: true, grow: 1.02 + grow * 0.18 }); if (fa > 0) { ctx.save(); ctx.strokeStyle = col; ctx.globalAlpha = a * fa; ctx.lineWidth = lw; sq(ctx, geo, i, grow); ctx.stroke(); ctx.restore(); } };
  const fillSq = (i, col, a, grow = 0.9) => { if (three) v3.marks.push({ sq: i, rgb: rgbOf(col), a: Math.min(1, a * 2.2), fill: true }); if (fa > 0) { ctx.save(); ctx.fillStyle = col; ctx.globalAlpha = a * fa; sq(ctx, geo, i, grow); ctx.fill(); ctx.restore(); } };
  const P3 = (i, lift = 1.6) => { if (three && v3.pt) { const p = v3.pt(i, lift); return [p.x, p.y]; } return geo.centers[i]; };
  const cellPx = three && v3.pt ? v3.pt(CENTRE, 0).cell : geo.cell;
  // the last move: a soft outline on where it left and where it landed
  if (M.last && !M.over && M.last.to >= 0) {
    ring(M.last.to, acc, 3, 0.35 + 0.2 * pl);
    if (M.last.from >= 0) ring(M.last.from, acc, 2, 0.22);
  }
  const chain = st.chain >= 0 && humanTurn(M);
  // selection, the squares it can reach, and what each slide would capture
  const selected = M.sel >= 0 ? M.sel : chain ? st.chain : -1;
  const capMarks = [];
  if (selected >= 0 && !M.over) {
    fillSq(selected, acc, 0.22 + 0.12 * pl);
    const mvs = legalMoves(st).filter((m) => m.from === selected);
    for (const m of mvs) {
      const caps = previewCaps({ st, sel: selected }, m.to);
      const [cx, cy] = geo.centers[m.to];
      if (caps.length) { fillSq(m.to, '#ff6a54', 0.2 + 0.1 * pl); ring(m.to, '#ff8a70', 3.5, 0.9); for (const c of caps) capMarks.push(c); }
      else fillSq(m.to, acc, 0.15 + 0.1 * pl);
      if (fa > 0) { ctx.save(); ctx.globalAlpha = fa; ctx.fillStyle = caps.length ? '#ff8a70' : acc; ctx.beginPath(); ctx.arc(cx, cy, geo.cell * 0.07, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
    }
  }
  if (S.kbd && humanTurn(M) && !M.over) ring(M.cur, '#ffffff', 3, 0.75, 0.96);
  if (selected >= 0 && !M.over && three) ring(selected, acc, 4, 0.9, 0.96);
  if (M.flash >= 0) fillSq(M.flash, '#ff6a5a', 0.45 * clamp01(M.flashT / 0.3));
  // Think
  if (M.hint && !M.over) {
    const mv = M.hint.mv;
    if (mv.from === -2) { if (st.chain >= 0) ring(st.chain, acc, 5, 0.7 + 0.3 * pl); } else {
      fillSq(mv.to, acc, 0.25 + 0.25 * pl); ring(mv.to, acc, 5, 0.6 + 0.4 * pl);
      if (mv.from >= 0) { ring(mv.from, acc, 4, 0.7); arrow(ctx, acc, ...nudge(P3(mv.from), P3(mv.to), cellPx * 0.3)); }
    }
  }
  // Watch & Learn: every option, then the chosen one(s)
  if (auto && auto.phase === 'reveal' && auto.plan) {
    const chosen = auto.plan.mvs;
    if (auto.plan.options) for (const i of auto.plan.options) ring(i, 'rgba(170,200,255,0.9)', 2.5, 0.35 + 0.15 * pl, 0.8);
    else for (const mv of auto.plan.moves) { if (mv.to >= 0 && !chosen.some((c) => c.from === mv.from && c.to === mv.to)) ring(mv.to, 'rgba(170,200,255,0.9)', 3, 0.45 + 0.2 * pl, 0.8); }
    for (const mv of chosen) {
      if (mv.from === -2) { if (st.chain >= 0) ring(st.chain, acc, 5, 0.8); continue; }
      fillSq(mv.to, acc, 0.3 + 0.2 * pl); ring(mv.to, acc, 5, 0.7 + 0.3 * pl);
      if (mv.from >= 0) { ring(mv.from, acc, 4, 0.8); arrow(ctx, acc, ...nudge(P3(mv.from), P3(mv.to), cellPx * 0.3)); }
    }
  }
  if (auto && auto.phase === 'think' && auto.scan != null) fillSq(auto.scan, 'rgba(255,255,255,0.8)', 0.08 + 0.08 * pl);
  // stones
  const over = M.over;
  ctx.globalAlpha = fa;
  if (three) {
    const frozen = (auto && auto.paused) || S.overlay === 'pause';
    v3.frame = {
      mode: 'board', cells: st.cells, anim: M.anim, sel: selected >= 0 && !M.over ? selected : -1, frozen,
      ghosts: M.ghosts.map((g) => ({ cell: g.cell, who: g.who, k: g.t < CAP_AT ? 0 : (g.t - CAP_AT) / CAP_T, pre: g.t / CAP_AT })),
      win: over && over.winner ? { who: over.winner, t: M.winT } : null,
    };
    if (over && over.winner) for (let i = 0; i < NN; i++) if (st.cells[i] === over.winner) v3.marks.push({ sq: i, rgb: rgbOf(acc), a: 0.35 + 0.25 * Math.sin(M.winT * 4 - i * 0.5), ring: true, grow: 1.08 });
  }
  for (let i = 0; i < NN && fa > 0; i++) {
    const who = st.cells[i];
    if (!who) continue;
    const [cx, cy] = geo.centers[i];
    const a = M.anim[i];
    let o = { cell: i };
    if (over && over.winner) {
      if (who === over.winner) { const idx = i % 5; o = { cell: i, glow: 0.5 + 0.4 * Math.sin(M.winT * 6 - idx), scale: 1 + 0.04 * Math.max(0, Math.sin(M.winT * 6 - idx * 0.9)) }; } else o = { cell: i, alpha: 0.7 };
    } else if (M.hint && M.hint.mv.from === i) o = { cell: i, glow: 0.6 };
    else if (selected === i) o = { cell: i, glow: 0.5 + 0.3 * pl, lift: 0.6 };
    else if (auto && auto.phase === 'reveal' && auto.plan && auto.plan.mvs.some((m) => m.from === i)) o = { cell: i, glow: 0.5 + 0.4 * pl };
    o.alpha = (o.alpha ?? 1) * fa;
    animStone(ctx, th, who, cx, cy, geo.d, a ? { ...a, from: a.from >= 0 ? geo.centers[a.from] : null } : null, o);
  }
  ctx.globalAlpha = 1;
  for (const c of capMarks) { const [cx, cy] = P3(c, 3); drawCross(ctx, cx, cy, cellPx * 0.2); }
  ctx.globalAlpha = fa;
  // captured stones shrink and fade
  for (const g of fa > 0 ? M.ghosts : []) {
    const [cx, cy] = geo.centers[g.cell];
    if (g.t < CAP_AT) drawStone(ctx, th, g.who, cx, cy, geo.d, { cell: g.cell, alpha: fa });
    else { const k = clamp01((g.t - CAP_AT) / CAP_T); drawStone(ctx, th, g.who, cx, cy, geo.d, { cell: g.cell, alpha: (1 - k) * fa, scale: 1 - 0.45 * k, rot: k * 1.4, noShadow: true }); }
  }
  // ghost preview under the finger (placement)
  if (S.ghost >= 0 && S.ghostWho && !M.over) {
    if (three) v3.marks.push({ sq: S.ghost, rgb: S.ghostWho === 1 ? '255,246,220' : '255,170,110', a: 0.9, fill: true, ring: true, grow: 1.1 });
    if (fa > 0) { const [gx, gy] = geo.centers[S.ghost]; drawStone(ctx, th, S.ghostWho, gx, gy, geo.d, { ghost: true, cell: S.ghost }); }
  }
  ctx.restore();
  if (fa > 0) { ctx.save(); ctx.globalAlpha = fa; drawParticles(ctx, M.parts); ctx.restore(); }
}
const nudge = (a, b, pad) => {
  const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1;
  return [a[0] + (dx / len) * pad, a[1] + (dy / len) * pad, b[0] - (dx / len) * pad, b[1] - (dy / len) * pad];
};

function drawToolbar(ctx, S, M, lay) {
  const th = theme(S), z = TEXT_SCALES[S.textIdx];
  const lesson = Boolean(M.lesson);
  const defs = {
    undo: { icon: 'undo', label: tr('undo'), off: M.over || lesson || !S.canUndo },
    think: { icon: 'hint', label: tr('think'), off: M.over || lesson || !humanTurn(M) || Boolean(M.hintTask) },
    restart: { icon: 'reset', label: tr('restart'), off: lesson && !M.hist.length },
  };
  TOOLBAR_IDS.forEach((id, i) => {
    const r = lay.tool[i], d = defs[id];
    const pressed = S.press && S.press.id === `tool:${id}` && S.press.active;
    button(ctx, th, r, [], id === 'think' ? 'primary' : 'normal', { disabled: d.off, pressed, radius: 22 });
    const yy = r.y + (pressed ? 2 : 0);
    ctx.save();
    if (d.off) ctx.globalAlpha = 0.4;
    const ink = id === 'think' ? th.primaryInk : th.ink;
    const is = 44 * (1 + (z - 1) * 0.35);
    const ls = fitOne(d.label, r.w - 14, 24 * (1 + (z - 1) * 0.6), 18);
    const total = is + ls + 10;
    icon(ctx, d.icon, r.x + r.w / 2, yy + (r.h - total) / 2 + is / 2, is, ink);
    text(ctx, d.label, r.x + r.w / 2, yy + (r.h - total) / 2 + is + 10 + ls * 0.85, ls, ink, { weight: 700 });
    ctx.restore();
  });
  if (lay.endBtn) {
    const r = lay.endBtn, pressed = S.press && S.press.id === 'hud:end' && S.press.active;
    button(ctx, th, r, [], 'primary', { pressed, radius: 22 });
    const ls = fitOne(tr('endTurn'), r.w - 24, 28 * (1 + (z - 1) * 0.4), 18), is = 40 * (1 + (z - 1) * 0.3), yy = r.y + (pressed ? 2 : 0);
    const total = is + ls + 8;
    icon(ctx, 'check', r.x + r.w / 2, yy + (r.h - total) / 2 + is / 2, is, th.primaryInk);
    text(ctx, tr('endTurn'), r.x + r.w / 2, yy + (r.h - total) / 2 + is + 8 + ls * 0.85, ls, th.primaryInk, { weight: 800 });
  }
}

function drawAutoBar(ctx, S, auto) {
  const th = theme(S), z = TEXT_SCALES[S.textIdx], b = autoLayout(z);
  const pr = (id) => S.press && S.press.id === id && S.press.active;
  const side = (r, ic, label, off, id) => {
    button(ctx, th, r, [], 'normal', { disabled: off, pressed: pr(id), radius: 22 });
    ctx.save(); if (off) ctx.globalAlpha = 0.4;
    const is = 40 * (1 + (z - 1) * 0.35), ls = fitOne(label, r.w - 14, 22 * (1 + (z - 1) * 0.6), 18), total = is + ls + 10, yy = r.y + (r.h - total) / 2;
    icon(ctx, ic, r.x + r.w / 2, yy + is / 2, is, th.ink);
    text(ctx, label, r.x + r.w / 2, yy + is + 10 + ls * 0.85, ls, th.ink, { weight: 700 });
    ctx.restore();
  };
  side(b.slower, 'minus', tr('autoSlower'), S.thinkIdx === 0, 'auto:slower');
  side(b.faster, 'plus', tr('autoFaster'), S.thinkIdx === THINK_STEPS.length - 1, 'auto:faster');
  button(ctx, th, b.pause, [], 'primary', { pressed: pr('auto:pause'), radius: 22 });
  const lab = auto.paused ? tr('autoPlay') : tr('autoPause');
  const is = 44 * (1 + (z - 1) * 0.3);
  if (b.pause.w < 260 || b.pause.h > 120) {   // narrow slot (landscape column): icon over label
    const ps = fitOne(lab, b.pause.w - 14, 28 * (1 + (z - 1) * 0.4), 18), total = is + ps + 10, yy = b.pause.y + (b.pause.h - total) / 2;
    icon(ctx, auto.paused ? 'play' : 'pause', b.pause.x + b.pause.w / 2, yy + is / 2, is, th.primaryInk);
    text(ctx, lab, b.pause.x + b.pause.w / 2, yy + is + 10 + ps * 0.85, ps, th.primaryInk, { weight: 800 });
  } else {
    const ps = fitOne(lab, b.pause.w - 140, 32 * (1 + (z - 1) * 0.5), 19);
    icon(ctx, auto.paused ? 'play' : 'pause', b.pause.x + 52 + is / 2, b.pause.y + b.pause.h / 2, is, th.primaryInk);
    text(ctx, lab, b.pause.x + 52 + is + (b.pause.w - 52 - is) / 2 - 16, b.pause.y + b.pause.h / 2 + ps * 0.35, ps, th.primaryInk, { weight: 800 });
  }
}

const nameOf = (M, who) => {
  if (M.auto) return sideLabel(who);
  if (M.two) return sideLabel(who);
  if (M.lesson) return who === M.human ? tr('youWord') : tr('opponentWord');
  return who === M.human ? tr('youWord') : lvName(M.level);
};

function statusText(S, M, auto) {
  const st = M.st;
  let head = '', body = '';
  if (M.over) {
    head = S.endInfo ? S.endInfo.head : '';
    body = S.endInfo ? S.endInfo.body : '';
  } else if (auto) {
    if (auto.paused) head = tr('paused');
    else if (auto.phase === 'think') { head = tr('autoThink', { n: Math.max(0, Math.ceil(THINK_STEPS[S.thinkIdx] - auto.t)) }); body = tr(isPlacing(st) ? 'toPlace' : 'toMove', { side: sideLabel(st.turn) }); }
    else if (auto.phase === 'reveal' || auto.phase === 'act') { head = auto.note.head; body = auto.note.why; }
    else if (auto.phase === 'intro') head = tr('seega');
  } else if (M.notice) {
    head = tr('passHead', { side: sideLabel(M.notice.who) }); body = tr('passBody', { side: sideLabel(other(M.notice.who)) });
  } else if (S.toast) { head = S.toast; }
  else if (M.hintTask) { head = tr('thinkingDots'); }
  else if (M.hint) { head = M.hint.head; body = M.hint.why; }
  else if (M.lesson) { head = lessonTask(M.lesson); }
  else if (M.thinking) { head = tr('thinkingDots'); }
  else if (humanTurn(M)) {
    const who = st.turn, nm = M.two ? sideLabel(who) : '';
    if (isPlacing(st)) {
      const left = 2 - st.drops;
      head = M.two ? tr(left === 2 ? 'placeTwoSide' : 'placeOneSide', { side: nm }) : tr(left === 2 ? 'placeTwoYou' : 'placeOneYou');
      if (!M.hist.length && S.firstGame) body = tr('firstTap');
    } else if (st.chain >= 0) { head = M.two ? tr('chainSide', { side: nm }) : tr('chainHead'); body = tr('chainBody'); }
    else { head = M.two ? tr(M.sel >= 0 ? 'targetSide' : 'pickSide', { side: nm }) : tr(M.sel >= 0 ? 'targetYou' : 'pickYou'); }
  }
  return { head, body };
}

function drawPlay(ctx, S) {
  const th = theme(S), M = S.match, z = TEXT_SCALES[S.textIdx];
  backdrop(ctx, th, S.t, 800);
  vignette3d(ctx, 0.6);
  if (v3.on) {          // dusk shade behind the header so the title line reads over the kilim and sand
    const y1 = HUD.sub.y + 26, g = ctx.createLinearGradient(0, 0, 0, y1 + 40);
    g.addColorStop(0, `rgba(10,6,4,${0.75 * v3.fade})`); g.addColorStop(0.7, `rgba(10,6,4,${0.55 * v3.fade})`); g.addColorStop(1, 'rgba(10,6,4,0)');
    ctx.fillStyle = g; if (SCREEN.land) { const L = playLayout(z).chips[0]; ctx.fillRect(L.x - 24, 0, L.w + 48, y1 + 40); } else ctx.fillRect(0, 0, SCREEN.width, y1 + 40);
  }
  const auto = S.scene === 'auto' ? S.auto : null;
  const chain = Boolean(M.st.chain >= 0 && humanTurn(M) && !M.over && !auto);
  const lay = playLayout(z, chain);
  const title = M.lesson ? lessonTitle(M.lesson) : tr('seega');
  const quiet = !isPlacing(M.st) && !M.lesson ? tr('noCapture', { q: M.st.quiet, m: STALL_LIMIT }) : '';
  const sub = M.lesson ? tr('lessonOf', { n: S.lessonIdx + 1, m: LESSONS.length }) : auto ? tr('watchSub', { n: THINK_STEPS[S.thinkIdx] }) + quiet : (M.two ? tr('twoPlayers') : tr('vsLevel', { level: lvName(M.level) })) + quiet;
  drawHud(ctx, S, title, sub, !auto);
  const st = M.st;
  const toMove = M.over ? 0 : st.turn;
  const plateSub = (who) => {
    if (M.over) return M.over.winner === who ? tr('winnerWord') : M.over.winner === 0 ? tr('drawWord') : '';
    const n = countOf(st, who);
    return isPlacing(st) ? tr('placedOf', { p: st.placed[who - 1], m: PIECES }) : stonesText(n);
  };
  drawPlate(ctx, S, lay.chips[0], 1, nameOf(M, 1), plateSub(1), toMove === 1);
  drawPlate(ctx, S, lay.chips[1], 2, nameOf(M, 2), plateSub(2), toMove === 2);
  const geo = boardGeo(lay.board.x, lay.board.y, lay.board.side);
  drawBoardScene(ctx, S, M, geo, auto);
  const { head, body } = statusText(S, M, auto);
  drawStatus(ctx, S, lay.status, head, body, null);
  if (auto && auto.phase === 'think' && !auto.paused) {
    const frac = clamp01(auto.t / THINK_STEPS[S.thinkIdx]);
    ctx.fillStyle = 'rgba(255,255,255,0.14)'; rr(ctx, lay.status.x + 24, lay.status.y + lay.status.h - 16, lay.status.w - 48, 7, 3.5); ctx.fill();
    ctx.fillStyle = th.accent; rr(ctx, lay.status.x + 24, lay.status.y + lay.status.h - 16, (lay.status.w - 48) * frac, 7, 3.5); ctx.fill();
  }
  if (auto) drawAutoBar(ctx, S, auto); else drawToolbar(ctx, S, M, lay);
}

export function render(ctx, S, ui) {
  ctx.textBaseline = 'alphabetic';
  switch (S.scene) {
    case 'title': drawTitle(ctx, S, ui); break;
    case 'setup': case 'learn': case 'howto': case 'rules': case 'about': case 'settings': drawDocScreen(ctx, S, ui); break;
    case 'demo-limit':
      backdrop(ctx, theme(S), S.t, 700, false, 0.6);
      panel(ctx, theme(S), ui.panel.x, ui.panel.y, ui.panel.w, ui.panel.h, {});
      drawDocBlocks(ctx, S, ui, S.scroll[ui.scrollKey] ?? 0);
      drawFixed(ctx, S, ui.fixed);
      break;
    case 'play': case 'auto':
      if (!S.match) { backdrop(ctx, theme(S), S.t, 700, false, 0.5); break; }
      drawPlay(ctx, S);
      break;
    default: backdrop(ctx, theme(S), S.t, 700, false, 0.5);
  }
  if (S.overlay) drawOverlay(ctx, S, ui);
}

export { getRules, DOC_PANEL, NAV_PREV, NAV_NEXT, CENTRE, dateAngle, targetsOf, SLIDE_T };
