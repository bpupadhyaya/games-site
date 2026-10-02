// Everything drawn each frame. Reads state, changes nothing.
import {
  W, H, UI, DISPLAY, THEMES, themeById, text, rr, panel, button, background, star, icon, drawParticles, drawMark, boardGeo, drawSlab,
  drawBoardLines, drawMiniBoard, drawWinLine, arrow, alpha, clamp01, ease, backOut,
} from './art.js';
import { TEXT_SCALES, wrap, tw } from './ui.js';
import { SPECS, MODE_IDS, MODE_NAMES, legalMoves, isPlacing, wordsOf, countOf } from './rules.js';
import { LEVELS } from './ai.js';
import { LESSONS } from './lessons.js';
import { tr, RULES } from './content.js';
import { BACK_BTN, PAUSE_BTN, TOOLBAR_IDS, autoLayout, DOC_PANEL, NAV_PREV, NAV_NEXT, playLayout } from './layout.js';
import { THINK_STEPS, MODE_BLURB } from './screens.js';
import { DROP_T, SLIDE_T, targetsOf, humanTurn } from './match.js';

const theme = (S) => themeById(S.themeId);

// Largest text size (<= start) whose wrapped lines fit w x h. Used by every HUD text so zoom never overflows.
export function fitText(str, w, h, start, min = 18, lh = 1.28) {
  let size = start;
  for (; size > min; size -= 2) {
    const lines = wrap(str, size, w);
    if (lines.length * size * lh <= h) return { lines, size, line: size * lh };
  }
  const lines = wrap(str, min, w);
  return { lines, size: min, line: min * lh };
}
const fitOne = (str, w, start, min = 16) => { let s = start; while (s > min && tw(str, s) > w) s -= 1; return s; };

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
      drawArt(ctx, S, b.name, ox, top, it.w, b.h, b);
    } else if (b.t === 'btn') {
      const bt = it.btns[0];
      button(ctx, th, { x: ox + bt.x, y: oy + bt.y, w: bt.w, h: bt.h }, it.lines, b.kind ?? 'normal', { size: it.size, line: it.line, sub: it.sub, disabled: bt.disabled, pressed: S.press && S.press.id === bt.id && S.press.active });
    } else if (b.t === 'row') {
      for (const bt of it.btns) {
        if (bt.id == null) text(ctx, bt.label, ox + bt.x + bt.w / 2, oy + bt.y + bt.h / 2 + it.size * 0.34, it.size, th.ink, { weight: 700 });
        else button(ctx, th, { x: ox + bt.x, y: oy + bt.y, w: bt.w, h: bt.h }, bt.lines, bt.kind ?? 'normal', { size: it.size, line: it.line, disabled: bt.disabled, pressed: S.press && S.press.id === bt.id && S.press.active });
      }
    } else if (b.t === 'grid') {
      for (const bt of it.btns) drawModeCell(ctx, S, { x: ox + bt.x, y: oy + bt.y, w: bt.w, h: bt.h }, bt.cell, S.press && S.press.id === bt.id && S.press.active);
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

function drawModeCell(ctx, S, r, c, pressed) {
  const th = theme(S);
  const y = r.y + (pressed ? 2 : 0);
  const z = TEXT_SCALES[S.textIdx] ?? 1;
  ctx.save();
  if (c.state === 'locked') ctx.globalAlpha = 0.55;
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; rr(ctx, r.x, y + 4, r.w, r.h, 18); ctx.fill();
  ctx.fillStyle = c.state === 'sel' ? th.btnOn[0] : th.btn[0]; rr(ctx, r.x, y, r.w, r.h, 18); ctx.fill();
  ctx.strokeStyle = c.state === 'sel' ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.16)'; ctx.lineWidth = c.state === 'sel' ? 3 : 1.5; rr(ctx, r.x, y, r.w, r.h, 18); ctx.stroke();
  const fs = Math.min(24 * (1 + (z - 1) * 0.5), fitOne(c.label, r.w - 20, 26 * (1 + (z - 1) * 0.5), 14));
  const side = Math.min(r.w - 36, r.h - fs * 1.7 - 28);
  const starter = c.mode === 'terni' ? '.../.X./O..' : c.mode === 'quad' ? '..../.XO./.OX./....' : c.mode === 'misere' ? 'XX./.O./O..' : 'X../.O./..X';
  drawMiniBoard(ctx, th, c.mode, r.x + (r.w - side) / 2, y + 14, side, starter, {});
  text(ctx, c.label, r.x + r.w / 2, y + r.h - fs * 0.6, fs, th.ink, { weight: 800, font: DISPLAY });
  if (c.state === 'locked') icon(ctx, 'lock', r.x + r.w - 30, y + 30, 28, 'rgba(246,236,214,0.85)');
  ctx.restore();
}

// ----------------------------------------------------------------------------------- illustrations
const cap = (ctx, str, x, y, size = 22, col = 'rgba(246,236,214,0.82)') => text(ctx, str, x, y, size, col, { weight: 600 });

function drawArt(ctx, S, name, x, y, w, h, b) {
  const th = theme(S);
  const cx = x + w / 2, cy = y + h / 2, t = S.t;
  ctx.save();
  ctx.fillStyle = 'rgba(10,8,8,0.5)'; rr(ctx, x, y, w, h, 18); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.14)'; ctx.lineWidth = 1.5; rr(ctx, x, y, w, h, 18); ctx.stroke();
  ctx.beginPath(); rr(ctx, x, y, w, h, 18); ctx.clip();
  const mb = (mode, bx, by, side, cells, o) => drawMiniBoard(ctx, th, mode, bx, by, side, cells, o);
  if (name === 'logo') {
    const s = Math.min(h - 40, 240);
    mb('classic', cx - s / 2, y + 20, s, 'XOX/.O./OXX', { line: [2, 4, 6], who: 2 });
  } else if (name === 'goal') {
    const s = Math.min(240, w * 0.38);
    mb('classic', x + 24, cy - s / 2 - 10, s, 'XX./OO./...', { hl: [2] });
    mb('classic', x + w - s - 24, cy - s / 2 - 10, s, 'XXX/OO./...', { line: [0, 1, 2], who: 1 });
    arrow(ctx, th.accent, cx - 40, cy - 10, cx + 40, cy - 10);
    cap(ctx, 'two in a row', x + 24 + s / 2, y + h - 22, 22); cap(ctx, 'three: a win', x + w - s / 2 - 24, y + h - 22, 22, th.accent);
  } else if (name === 'tap') {
    const s = Math.min(h - 80, 300);
    const g = mb('classic', cx - s / 2, y + 20, s, 'X../.O./...', { hl: [8] });
    const [gx, gy] = g.centers[8];
    drawMark(ctx, th, 1, gx, gy, g.d, { ghost: true, alpha: 0.5 + 0.3 * Math.sin(t * 4) });
    ctx.fillStyle = 'rgba(255,255,255,0.28)'; ctx.beginPath(); ctx.arc(gx + 6, gy + 6, 24 + 3 * Math.sin(t * 5), 0, Math.PI * 2); ctx.fill();
    cap(ctx, 'tap an empty square', cx, y + h - 22, 22);
  } else if (name === 'modes') {
    const s = (w - 5 * 12) / 4;
    const defs = [['classic', 'X../.O./..X', 'Classic'], ['terni', 'XO./.X./O..', 'Terni'], ['misere', 'XX./OO./...', 'Misère'], ['quad', '..../.XO./.OX./....', 'Quad']];
    defs.forEach(([m, c, nm], i) => { const bx = x + 12 + i * (s + 12); mb(m, bx, cy - s / 2 - 14, s, c, {}); cap(ctx, nm, bx + s / 2, cy + s / 2 + 22, 20); });
  } else if (name === 'slide') {
    const s = Math.min(h - 70, 300);
    const g = mb('terni', cx - s / 2, y + 16, s, 'XX./OXO/O..', { hl: [4], dots: [] });
    const [fx, fy] = g.centers[4], [tx, ty] = g.centers[2];
    arrow(ctx, th.accent, fx + 18, fy - 18, tx - 14, ty + 14);
    cap(ctx, 'tap a piece, then a joined empty point', cx, y + h - 20, 20);
  } else if (name === 'think') {
    const s = Math.min(h - 100, 270);
    const g = mb('classic', cx - s / 2, y + 14, s, 'XO./.X./...', { hl: [8] });
    const [px, py] = g.centers[8];
    ctx.save(); ctx.strokeStyle = th.accent; ctx.lineWidth = 4; ctx.globalAlpha = 0.6 + 0.4 * Math.sin(t * 4); ctx.beginPath(); ctx.arc(px, py, g.cell * 0.44, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    ctx.fillStyle = 'rgba(10,8,8,0.8)'; rr(ctx, x + 40, y + h - 70, w - 80, 48, 24); ctx.fill();
    ctx.strokeStyle = th.stroke; ctx.lineWidth = 1.5; rr(ctx, x + 40, y + h - 70, w - 80, 48, 24); ctx.stroke();
    cap(ctx, 'This wins: it makes three in a row.', cx, y + h - 38, 22, th.accent);
  } else if (name === 'levels') {
    LEVELS.forEach((l, i) => {
      const yy = y + 24 + i * ((h - 48) / 5);
      cap(ctx, l.name, x + 120, yy + 30, 24, th.ink);
      ctx.fillStyle = 'rgba(255,255,255,0.12)'; rr(ctx, x + 250, yy + 12, w - 290, 26, 13); ctx.fill();
      ctx.fillStyle = th.accent; rr(ctx, x + 250, yy + 12, (w - 290) * (0.2 + 0.2 * i), 26, 13); ctx.fill();
    });
  } else if (name === 'learn') {
    [['Three in a row', true], ['Block the threat', true], ['Make a fork', false]].forEach(([nm, done], i) => {
      const yy = y + 20 + i * 112;
      ctx.fillStyle = done ? th.btnOn[0] : th.btn[0]; rr(ctx, x + 24, yy, w - 48, 96, 16); ctx.fill();
      mb('classic', x + 36, yy + 8, 80, i === 0 ? 'XX./OO./...' : i === 1 ? 'OO./X../.X.' : 'XO./O../.X.', {});
      text(ctx, nm, x + 140, yy + 56, 26, th.ink, { weight: 700, align: 'left' });
      if (done) icon(ctx, 'check', x + w - 70, yy + 48, 40, th.ink);
    });
  } else if (name === 'classic') {
    const s = Math.min(h - 60, 300);
    mb('classic', cx - s / 2, y + 16, s, 'XOX/XOO/OXX', {});
    cap(ctx, 'nine squares, one mark a turn', cx, y + h - 20, 21);
  } else if (name === 'lines8') {
    const lines = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
    const s = (w - 5 * 14) / 4;
    lines.forEach((l, i) => {
      const bx = x + 14 + (i % 4) * (s + 14), by = y + 16 + Math.floor(i / 4) * (s + 30);
      const cells = Array(9).fill(0); l.forEach((c) => { cells[c] = 1; });
      mb('classic', bx, by, s, cells, {});
    });
    cap(ctx, '3 rows, 3 columns, 2 diagonals', cx, y + h - 14, 20);
  } else if (name === 'fork') {
    const s = Math.min(h - 70, 280);
    const g = mb('classic', cx - s / 2, y + 14, s, 'XO./O../.X./', { hl: [8], dots: [4, 6] });
    cap(ctx, 'X at the glowing square threatens two lines', cx, y + h - 20, 20, th.accent);
  } else if (name === 'draw') {
    const s = Math.min(h - 60, 290);
    mb('classic', cx - s / 2, y + 16, s, 'XOX/XOO/OXX', {});
    cap(ctx, 'a full board with no line: a draw', cx, y + h - 20, 21);
  } else if (name === 'terni-board') {
    const s = Math.min(h - 70, 290);
    const g = mb('terni', cx - s / 2, y + 14, s, 'X../.O./...', { hl: [] });
    cap(ctx, 'pieces stand on the points; lines join them', cx, y + h - 20, 20);
  } else if (name === 'terni-slide') {
    const s = Math.min(w * 0.4, h - 90);
    mb('terni', x + 24, y + 20, s, 'XX./OXO/O..', { hl: [4] });
    mb('terni', x + w - s - 24, y + 20, s, 'XXX/O.O/O..', { line: [0, 1, 2], who: 1 });
    arrow(ctx, th.accent, cx - 34, cy - 20, cx + 34, cy - 20);
    cap(ctx, 'slide the centre up: three in a row', cx, y + h - 20, 20, th.accent);
  } else if (name === 'terni-open') {
    const s = Math.min(h - 80, 280);
    mb('terni', cx - s / 2, y + 14, s, '.../.X./...', { hl: [4] });
    cap(ctx, 'open in the centre: the first player wins', cx, y + h - 20, 20, th.accent);
  } else if (name === 'misere') {
    const s = Math.min(h - 80, 280);
    mb('misere', cx - s / 2, y + 14, s, 'XXX/OO./...', { line: [0, 1, 2], who: 1, misere: true });
    cap(ctx, 'X completes three in a row, so X loses', cx, y + h - 20, 20, '#ff9d8f');
  } else if (name === 'quad') {
    const s = Math.min(w * 0.42, h - 90);
    mb('quad', x + 20, y + 20, s, 'XXXX/OO../.O../....', { line: [0, 1, 2, 3], who: 1 });
    mb('quad', x + w - s - 20, y + 20, s, '..../.XX./.XX./O..O', { line: [5, 6, 9, 10], who: 1 });
    cap(ctx, 'a row of four', x + 20 + s / 2, y + h - 20, 20); cap(ctx, 'a 2x2 square', x + w - s / 2 - 20, y + h - 20, 20);
  } else if (name === 'sides') {
    [1, 2].forEach((who, i) => {
      const bx = x + 40 + i * (w / 2 - 20);
      ctx.fillStyle = th.btn[0]; rr(ctx, bx, y + 60, w / 2 - 60, h - 120, 18); ctx.fill();
      drawMark(ctx, th, who, bx + (w / 2 - 60) / 2, y + h / 2 - 20, 90, {});
      cap(ctx, who === 1 ? 'X: first' : 'O: second', bx + (w / 2 - 60) / 2, y + h - 80, 26, th.ink);
    });
  } else if (name === 'undo') {
    icon(ctx, 'undo', cx - 130, cy - 14, 84, th.accent); icon(ctx, 'reset', cx + 130, cy - 14, 84, th.accent);
    cap(ctx, 'Undo', cx - 130, cy + 70, 24); cap(ctx, 'Restart', cx + 130, cy + 70, 24);
  } else if (name === 'auto') {
    ctx.strokeStyle = 'rgba(255,255,255,0.16)'; ctx.lineWidth = 12; ctx.beginPath(); ctx.arc(cx - 150, cy, 46, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = th.accent; ctx.beginPath(); ctx.arc(cx - 150, cy, 46, -Math.PI / 2, -Math.PI / 2 + ((t * 0.4) % 1) * Math.PI * 2); ctx.stroke();
    drawMark(ctx, th, 1, cx + 10, cy, 96, { glow: 0.5 + 0.5 * Math.sin(t * 5) });
    icon(ctx, 'pause', cx + 150, cy, 52, th.accent);
    cap(ctx, 'THINK  ·  REVEAL  ·  ACT', cx, y + h - 18, 22, th.accent);
  } else if (name === 'themes') {
    const s = (w - 4 * 16) / 3;
    THEMES.forEach((tt, i) => {
      const bx = x + 16 + i * (s + 16);
      drawMiniBoard(ctx, tt, 'classic', bx, cy - s / 2 - 14, s, 'XO./.XO/..X', { line: [0, 4, 8], who: 1 });
      cap(ctx, tt.name.split(' & ')[0].split(' ')[0], bx + s / 2, cy + s / 2 + 22, 19);
    });
  } else if (name === 'win') {
    const s = Math.min(h - 60, 280);
    mb('classic', cx - s / 2, y + 16, s, 'XOO/OXO/..X', { line: [0, 4, 8], who: 1 });
    cap(ctx, 'a glowing bar marks the line', cx, y + h - 20, 21);
  } else if (name === 'lock') {
    icon(ctx, 'lock', cx, cy, 90, th.accent);
  } else if (name === 'endmark') {
    const e = b.data ?? {};
    const k = backOut(clamp01((S.ovT - 0.15) / 0.5));
    if (e.winner === 1 || e.winner === 2) drawMark(ctx, th, e.winner, cx, cy + 10, 110, { scale: k, glow: 0.5 + 0.4 * Math.sin(S.ovT * 4) });
    else { drawMark(ctx, th, 1, cx - 80, cy + 10, 96, { scale: k }); drawMark(ctx, th, 2, cx + 80, cy + 10, 96, { scale: k }); }
  }
  ctx.restore();
}

// --------------------------------------------------------------------------------------- title
// The title's attract scene: a short game is played out on a real board over and over, ending in a fork and a win.
const ATTRACT = [[1, 4], [2, 1], [1, 0], [2, 8], [1, 6], [2, 3], [1, 2]];
const ATTRACT_STEP = 0.95;

function drawAttract(ctx, S) {
  const th = theme(S), t = S.t;
  const side = 372, bx = (W - side) / 2, by = 392;
  const cycle = ATTRACT.length * ATTRACT_STEP + 0.4 + 1.6 + 1.2;
  const tt = t % cycle;
  const geo = boardGeo('classic', bx, by, side);
  const glow = ctx.createRadialGradient(W / 2, by + side / 2, 30, W / 2, by + side / 2, 340);
  glow.addColorStop(0, th.glow); glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow; ctx.fillRect(0, by - 140, W, side + 280);
  drawSlab(ctx, th, bx, by, side);
  drawBoardLines(ctx, th, geo);
  const shown = Math.min(ATTRACT.length, Math.floor(tt / ATTRACT_STEP) + (tt >= 0 ? 1 : 0));
  const fadeOut = tt > ATTRACT.length * ATTRACT_STEP + 2.2 ? 1 - clamp01((tt - (ATTRACT.length * ATTRACT_STEP + 2.2)) / 0.5) : 1;
  for (let i = 0; i < shown; i++) {
    const [who, cell] = ATTRACT[i];
    const age = tt - i * ATTRACT_STEP;
    const [mx, my] = geo.centers[cell];
    animMark(ctx, th, who, mx, my, geo.d, { t: age, kind: 'drop' }, { alpha: fadeOut });
  }
  const winK = clamp01((tt - (ATTRACT.length - 1) * ATTRACT_STEP - 0.5) / 0.55);
  if (winK > 0) ctx.save(), ctx.globalAlpha = fadeOut, drawWinLine(ctx, th, geo, [2, 4, 6], winK, 1), ctx.restore();
  const g = ctx.createLinearGradient(0, 120, 0, 290);
  g.addColorStop(0, light2(th.accent)); g.addColorStop(0.5, th.accent); g.addColorStop(1, '#a8782a');
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.65)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 8;
  ctx.font = `800 100px ${DISPLAY}`; ctx.textAlign = 'center'; ctx.fillStyle = g;
  ctx.fillText('Noughts', 360, 168);
  ctx.font = `800 82px ${DISPLAY}`;
  ctx.fillText('& Crosses', 360, 258);
  ctx.restore();
  text(ctx, 'Tic-Tac-Toe  ·  Terni Lapilli  ·  Misère', 360, 316, 26, 'rgba(246,236,214,0.82)', { weight: 600 });
  text(ctx, tr('tagline'), 360, 352, 25, 'rgba(246,236,214,0.6)', { weight: 500 });
}
const light2 = (c) => (c.length === 7 ? `rgb(${Math.min(255, parseInt(c.slice(1, 3), 16) + 70)},${Math.min(255, parseInt(c.slice(3, 5), 16) + 70)},${Math.min(255, parseInt(c.slice(5, 7), 16) + 70)})` : '#fff3c4');

function drawTitle(ctx, S, ui) {
  background(ctx, theme(S), S.t, 560);
  drawAttract(ctx, S);
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
    drawFixed(ctx, S, [ui.nav.prev, ui.nav.next]);
    text(ctx, ui.nav.label, 360, 1500, 26, 'rgba(246,236,214,0.75)', { weight: 600 });
  }
}

function drawOverlay(ctx, S, ui) {
  const th = theme(S);
  ctx.fillStyle = `rgba(6,4,4,${0.62 * clamp01(S.ovT / 0.25)})`;
  ctx.fillRect(0, 0, W, H);
  const k = ease(clamp01(S.ovT / 0.3));
  ctx.save();
  ctx.translate(W / 2, H / 2); ctx.scale(0.92 + 0.08 * k, 0.92 + 0.08 * k); ctx.translate(-W / 2, -H / 2);
  ctx.globalAlpha = k;
  panel(ctx, th, ui.panel.x, ui.panel.y, ui.panel.w, ui.panel.h, {});
  drawDocBlocks(ctx, S, ui, S.scroll[ui.scrollKey] ?? 0);
  drawFixed(ctx, S, ui.fixed);
  ctx.restore();
}

// ------------------------------------------------------------------------------------------ marks in motion
// a = { t, kind: 'drop' | 'slide', from: [x, y] } (time since the move began). o: { alpha, glow, scale }
export function animMark(ctx, th, who, x, y, d, a, o = {}) {
  if (!a) { drawMark(ctx, th, who, x, y, d, o); return; }
  if (a.kind === 'drop') {
    const k = clamp01(a.t / DROP_T), e = ease(k);
    const squash = k > 0.55 ? Math.sin(((k - 0.55) / 0.45) * Math.PI) * 0.05 : 0;
    drawMark(ctx, th, who, x, y - (1 - e) * d * 0.85, d, { ...o, alpha: (o.alpha ?? 1) * clamp01(a.t / 0.1), scale: (o.scale ?? 1) * (1 + 0.28 * (1 - e) + squash), lift: 1 - e, noShadow: false });
  } else {
    const k = clamp01(a.t / SLIDE_T), e = k * k * (3 - 2 * k);
    const px = a.from[0] + (x - a.from[0]) * e, py = a.from[1] + (y - a.from[1]) * e;
    drawMark(ctx, th, who, px, py, d, { ...o, lift: Math.sin(k * Math.PI), scale: o.scale ?? 1 });
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
  const tSize = fitOne(title, 480, 40 * (1 + (z - 1) * 0.25), 22);
  text(ctx, title, 360, 58, tSize, th.ink, { font: DISPLAY, weight: 800, shadow: 'rgba(0,0,0,0.6)' });
  const sSize = fitOne(sub, 480, 24 * (1 + (z - 1) * 0.3), 16);
  text(ctx, sub, 360, 96, sSize, 'rgba(246,236,214,0.7)', { weight: 500 });
}

function drawPlate(ctx, S, r, who, name, sub, active, geoD) {
  const th = theme(S), z = TEXT_SCALES[S.textIdx];
  ctx.save();
  ctx.fillStyle = 'rgba(8,6,6,0.55)'; rr(ctx, r.x, r.y, r.w, r.h, 20); ctx.fill();
  ctx.strokeStyle = active ? th.accent : 'rgba(255,255,255,0.14)'; ctx.lineWidth = active ? 3 : 1.5;
  if (active) { ctx.shadowColor = alpha(th.accent.length === 7 ? th.accent : '#e8c46a', 0.7); ctx.shadowBlur = 16; }
  rr(ctx, r.x, r.y, r.w, r.h, 20); ctx.stroke();
  ctx.restore();
  const md = Math.min(r.h - 28, 74);
  drawMark(ctx, th, who, r.x + 14 + md / 2, r.y + r.h / 2, md * 0.85, { noShadow: true, glow: active ? 0.4 : 0 });
  const tx = r.x + 24 + md, avail = r.w - md - 40;
  const ns = fitOne(name, avail, 30 * (1 + (z - 1) * 0.55), 16);
  const ss = fitOne(sub, avail, 21 * (1 + (z - 1) * 0.55), 14);
  const total = ns + ss + 8, ty = r.y + (r.h - total) / 2 + ns * 0.88;
  text(ctx, name, tx, ty, ns, th.ink, { weight: 800, align: 'left', font: DISPLAY });
  text(ctx, sub, tx, ty + ss + 8, ss, active ? th.accent : 'rgba(246,236,214,0.62)', { weight: 600, align: 'left' });
}

function drawStatus(ctx, S, r, head, body, col) {
  const th = theme(S), z = TEXT_SCALES[S.textIdx];
  ctx.save();
  ctx.fillStyle = 'rgba(8,6,6,0.6)'; rr(ctx, r.x, r.y, r.w, r.h, 22); ctx.fill();
  ctx.strokeStyle = th.stroke; ctx.lineWidth = 1.5; rr(ctx, r.x, r.y, r.w, r.h, 22); ctx.stroke();
  ctx.restore();
  const pad = 22, w = r.w - pad * 2;
  const full = body ? `${head}\n${body}` : head;
  const f = fitText(full, w, r.h - 24, 32 * (1 + (z - 1) * 0.6), 16);
  const lines = [];
  const hl = wrap(head, f.size, w).length;
  const all = body ? [...wrap(head, f.size, w), ...wrap(body, f.size, w)] : wrap(head, f.size, w);
  const total = all.length * f.line;
  let ty = r.y + (r.h - total) / 2 + f.size * 0.95;
  all.forEach((ln, i) => { text(ctx, ln, r.x + r.w / 2, ty, f.size, i < hl ? (col ?? th.accent) : 'rgba(246,236,214,0.92)', { weight: i < hl ? 800 : 500 }); ty += f.line; });
  void lines;
}

function pulse(S, rate = 5) { return 0.5 + 0.5 * Math.sin(S.t * rate); }

// Draws the board and its marks for a match. `auto` carries Watch & Learn's reveal info.
function drawBoardScene(ctx, S, M, geo, auto) {
  const th = theme(S), sp = SPECS[M.mode];
  ctx.save();
  const glow = ctx.createRadialGradient(geo.x + geo.side / 2, geo.y + geo.side / 2, 40, geo.x + geo.side / 2, geo.y + geo.side / 2, geo.side * 0.85);
  glow.addColorStop(0, th.glow); glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow; ctx.fillRect(geo.x - 160, geo.y - 160, geo.side + 320, geo.side + 320);
  drawSlab(ctx, th, geo.x, geo.y, geo.side);
  drawBoardLines(ctx, th, geo);
  const pl = pulse(S);
  const st = M.st;
  const ring = (i, col, lw = 4, a = 1, rad = 0.46) => {
    const [cx, cy] = geo.centers[i];
    ctx.save(); ctx.strokeStyle = col; ctx.globalAlpha = a; ctx.lineWidth = lw; ctx.beginPath(); ctx.arc(cx, cy, geo.cell * rad, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
  };
  const fillCell = (i, col, a) => {
    const [cx, cy] = geo.centers[i];
    ctx.save(); ctx.fillStyle = col; ctx.globalAlpha = a; ctx.beginPath(); ctx.arc(cx, cy, geo.cell * 0.44, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  };
  const acc = th.accent.length === 7 ? th.accent : '#e8c46a';
  // last move
  if (M.last && !M.over) { ring(M.last.to, acc, 3, 0.35 + 0.2 * pl, 0.47); }
  // legal slide targets and selection
  if (M.sel >= 0) {
    fillCell(M.sel, acc, 0.22 + 0.12 * pl);
    for (const i of targetsOf(M)) { fillCell(i, acc, 0.16 + 0.1 * pl); const [cx, cy] = geo.centers[i]; ctx.fillStyle = acc; ctx.beginPath(); ctx.arc(cx, cy, geo.cell * 0.07, 0, Math.PI * 2); ctx.fill(); }
  }
  // cursor (keyboard)
  if (S.kbd && humanTurn(M) && !M.over) ring(M.cur, '#ffffff', 3, 0.7, 0.48);
  if (M.flash >= 0) fillCell(M.flash, '#ff6a5a', 0.45 * clamp01(M.flashT / 0.3));
  // hint
  if (M.hint && !M.over) {
    const mv = M.hint.mv;
    fillCell(mv.to, acc, 0.25 + 0.25 * pl); ring(mv.to, acc, 5, 0.6 + 0.4 * pl);
    if (mv.from >= 0) { ring(mv.from, acc, 4, 0.7); arrow(ctx, acc, ...nudge(geo.centers[mv.from], geo.centers[mv.to], geo.cell * 0.28)); }
  }
  // Watch & Learn: every option, then the chosen one
  if (auto && auto.phase === 'reveal' && auto.plan) {
    for (const mv of auto.plan.moves) {
      if (mv.to === auto.plan.mv.to && mv.from === auto.plan.mv.from) continue;
      ring(mv.to, 'rgba(160,190,255,0.9)', 3, 0.5 + 0.2 * pl, 0.4);
    }
    const mv = auto.plan.mv;
    fillCell(mv.to, acc, 0.3 + 0.2 * pl); ring(mv.to, acc, 5, 0.7 + 0.3 * pl);
    if (mv.from >= 0) { ring(mv.from, acc, 4, 0.8); arrow(ctx, acc, ...nudge(geo.centers[mv.from], geo.centers[mv.to], geo.cell * 0.28)); }
  }
  if (auto && auto.phase === 'think' && auto.scan != null) fillCell(auto.scan, 'rgba(255,255,255,0.8)', 0.08 + 0.08 * pl);
  // marks
  const winSet = M.over && M.over.line ? new Set(M.over.line) : null;
  const winK = M.over ? clamp01((M.winT - 0.25) / 0.55) : 0;
  for (let i = 0; i < sp.n; i++) {
    const who = st.cells[i];
    if (!who) continue;
    const [cx, cy] = geo.centers[i];
    const a = M.anim[i];
    let o = {};
    if (winSet) {
      if (winSet.has(i) && M.winT > 0.3) {
        const idx = M.over.line.indexOf(i);
        o = { glow: 0.7 + 0.3 * Math.sin(M.winT * 7 - idx), scale: 1 + 0.07 * Math.max(0, Math.sin(M.winT * 7 - idx * 0.9)) };
        if (M.over.why === 'misere') o.glow = 0.4;
      } else o = { alpha: 1 - 0.4 * winK };
    } else if (M.hint && M.hint.mv.from === i) o = { glow: 0.6 };
    else if (M.sel === i) o = { glow: 0.5 + 0.3 * pl, lift: 0.6 };
    else if (auto && auto.phase === 'reveal' && auto.plan && auto.plan.mv.from === i) o = { glow: 0.5 + 0.4 * pl };
    animMark(ctx, th, who, cx, cy, geo.d, a ? { ...a, from: a.from >= 0 ? geo.centers[a.from] : null } : null, o);
  }
  // ghost preview under the finger
  if (S.ghost >= 0 && S.ghostWho && !M.over) { const [gx, gy] = geo.centers[S.ghost]; drawMark(ctx, th, S.ghostWho, gx, gy, geo.d, { ghost: true }); }
  if (M.over && M.over.line) drawWinLine(ctx, th, geo, M.over.line, winK, M.over.why === 'misere' ? 3 - M.over.winner : M.over.winner, { misere: M.over.why === 'misere' });
  ctx.restore();
  drawParticles(ctx, M.parts);
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
    think: { icon: 'hint', label: tr('think'), off: M.over || !humanTurn(M) },
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
    const ls = fitOne(d.label, r.w - 20, 24 * (1 + (z - 1) * 0.6), 16);
    const total = is + ls + 10;
    icon(ctx, d.icon, r.x + r.w / 2, yy + (r.h - total) / 2 + is / 2, is, ink);
    text(ctx, d.label, r.x + r.w / 2, yy + (r.h - total) / 2 + is + 10 + ls * 0.85, ls, ink, { weight: 700 });
    ctx.restore();
  });
}

function drawAutoBar(ctx, S, auto) {
  const th = theme(S), z = TEXT_SCALES[S.textIdx], b = autoLayout(z);
  const pr = (id) => S.press && S.press.id === id && S.press.active;
  const side = (r, ic, label, off, id) => {
    button(ctx, th, r, [], 'normal', { disabled: off, pressed: pr(id), radius: 22 });
    ctx.save(); if (off) ctx.globalAlpha = 0.4;
    const is = 40 * (1 + (z - 1) * 0.35), ls = fitOne(label, r.w - 20, 22 * (1 + (z - 1) * 0.6), 14), total = is + ls + 10, yy = r.y + (r.h - total) / 2;
    icon(ctx, ic, r.x + r.w / 2, yy + is / 2, is, th.ink);
    text(ctx, label, r.x + r.w / 2, yy + is + 10 + ls * 0.85, ls, th.ink, { weight: 700 });
    ctx.restore();
  };
  side(b.slower, 'minus', tr('autoSlower'), S.thinkIdx === 0, 'auto:slower');
  side(b.faster, 'plus', tr('autoFaster'), S.thinkIdx === THINK_STEPS.length - 1, 'auto:faster');
  button(ctx, th, b.pause, [], 'primary', { pressed: pr('auto:pause'), radius: 22 });
  const lab = auto.paused ? tr('autoPlay') : tr('autoPause');
  const ps = fitOne(lab, b.pause.w - 140, 32 * (1 + (z - 1) * 0.5), 18), is = 44 * (1 + (z - 1) * 0.3);
  icon(ctx, auto.paused ? 'play' : 'pause', b.pause.x + 52 + is / 2, b.pause.y + b.pause.h / 2, is, th.primaryInk);
  text(ctx, lab, b.pause.x + 52 + is + (b.pause.w - 52 - is) / 2 - 16, b.pause.y + b.pause.h / 2 + ps * 0.35, ps, th.primaryInk, { weight: 800 });
}

const sideName = (M, who) => {
  if (M.auto) return `${LEVELS.find((l) => l.id === (who === 1 ? M.autoLv[0] : M.autoLv[1]))?.name ?? ''}`;
  if (M.two) return who === 1 ? 'Player X' : 'Player O';
  if (M.lesson && M.lesson.type !== 'game') return who === M.human ? tr('youWord') : 'Opponent';
  return who === M.human ? tr('youWord') : LEVELS.find((l) => l.id === M.level)?.name ?? 'Computer';
};

function drawPlay(ctx, S) {
  const th = theme(S), M = S.match, z = TEXT_SCALES[S.textIdx];
  background(ctx, th, S.t, 800);
  const auto = S.scene === 'auto' ? S.auto : null;
  const lay = playLayout(z);
  const title = M.lesson ? M.lesson.title : MODE_NAMES[M.mode];
  const sub = M.lesson ? `Lesson ${S.lessonIdx + 1} of ${LESSONS.length}` : auto ? `${tr('autoSession')} · ${tr('think')} ${THINK_STEPS[S.thinkIdx]}${tr('seconds')}` : M.two ? tr('twoPlayers') : `${tr('vsComputer')} · ${LEVELS.find((l) => l.id === M.level)?.name}`;
  drawHud(ctx, S, title, sub, !auto);
  const st = M.st;
  const toMove = M.over ? 0 : st.turn;
  const plateSub = (who) => {
    if (M.over) return M.over.winner === who ? 'Winner' : M.over.winner === 0 ? 'Draw' : '';
    if (toMove !== who) return M.hist.length ? 'waiting' : who === 1 ? 'plays first' : 'plays second';
    if (auto) return auto.phase === 'think' ? 'thinking' : 'to move';
    if (!M.two && !M.lesson && who !== M.human) return M.thinking ? 'thinking' : 'to move';
    return 'to move';
  };
  drawPlate(ctx, S, lay.chips[0], 1, sideName(M, 1), plateSub(1), toMove === 1);
  drawPlate(ctx, S, lay.chips[1], 2, sideName(M, 2), plateSub(2), toMove === 2);
  const geo = boardGeo(M.mode, lay.board.x, lay.board.y, lay.board.side);
  drawBoardScene(ctx, S, M, geo, auto);
  // status
  let head = '', body = '', col = null;
  if (M.over) {
    const o = M.over;
    head = S.endInfo ? S.endInfo.head : '';
    body = S.endInfo && !(M.lesson && M.lesson.type === 'game') ? S.endInfo.body : '';
  } else if (auto) {
    if (auto.paused) head = tr('paused');
    else if (auto.phase === 'think') { head = `${tr('autoThink')} ${Math.max(0, Math.ceil(THINK_STEPS[S.thinkIdx] - auto.t))}`; body = `${st.turn === 1 ? 'X' : 'O'} to move`; }
    else if (auto.phase === 'reveal' || auto.phase === 'act') { head = auto.note.head; body = auto.note.why; }
    else if (auto.phase === 'intro') head = MODE_NAMES[M.mode];
  } else if (S.toast) { head = S.toast; }
  else if (M.hint) { head = M.hint.head; body = M.hint.why; }
  else if (M.lesson) { head = M.lesson.task; }
  else if (M.thinking) { head = tr('thinking'); }
  else if (humanTurn(M)) {
    if (SPECS[M.mode].slide && !isPlacing(M.st)) head = M.sel >= 0 ? tr('pickTarget') : tr('pickPiece');
    else head = M.two ? (M.st.turn === 1 ? tr('xTurn') : tr('oTurn')) : tr('yourMove');
    if (!M.hist.length && !M.two && S.match.human === 1 && S.firstGame) body = 'Tap a square to place your X.';
  }
  drawStatus(ctx, S, lay.status, head, body, col);
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
      background(ctx, theme(S), S.t);
      panel(ctx, theme(S), ui.panel.x, ui.panel.y, ui.panel.w, ui.panel.h, {});
      drawDocBlocks(ctx, S, ui, S.scroll[ui.scrollKey] ?? 0);
      drawFixed(ctx, S, ui.fixed);
      break;
    case 'play': case 'auto':
      if (!S.match) { background(ctx, theme(S), S.t); break; }
      drawPlay(ctx, S);
      break;
    default: background(ctx, theme(S), S.t);
  }
  if (S.overlay) drawOverlay(ctx, S, ui);
}

export { RULES, DOC_PANEL, NAV_PREV, NAV_NEXT, H, W, UI, MODE_IDS, MODE_BLURB, legalMoves, wordsOf, countOf, star };
