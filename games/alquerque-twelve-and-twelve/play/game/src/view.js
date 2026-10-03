// Everything drawn each frame. Reads state, changes nothing.
import {
  W, H, DISPLAY, THEMES, themeById, text, rr, panel, button, background, icon, drawParticles, drawPiece, boardGeo, drawSlab, drawLines,
  drawMiniBoard, drawCross, arrow, alpha, clamp01, ease, backOut,
} from './art.js';
import { TEXT_SCALES, wrap, tw } from './ui.js';
import { NN, CENTRE, QUIET_LIMIT, legalMoves, mustCapture, countOf, other, parse } from './rules.js';
import { LEVELS } from './ai.js';
import { LESSONS, lessonTitle, lessonTask } from './lessons.js';
import { tr, getRules, piecesText, sideLabel, sideThe, lvName, themeShort } from './content.js';
import { hasArabic } from './lang.js';
import { BACK_BTN, PAUSE_BTN, TOOLBAR_IDS, autoLayout, DOC_PANEL, NAV_PREV, NAV_NEXT, playLayout } from './layout.js';
import { THINK_STEPS } from './screens.js';
import { STEP_T, JUMP_T, CAP_AT, CAP_T, targetsOf, humanTurn } from './match.js';

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
        const rtl = !center && hasArabic(it.lines[i]); // Arabic paragraphs read from the right edge
        text(ctx, it.lines[i], center ? ox + it.w / 2 : rtl ? ox + it.w : ox, top + i * it.line + it.size * 0.98, it.size, 'rgba(250,240,222,0.94)', { weight: 500, align: center ? 'center' : rtl ? 'right' : 'left' });
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
    }
  }
  ctx.restore();
  if (layout.height > region.h) {
    const track = region.h - 8, tH = Math.max(48, (region.h / layout.height) * track);
    const ty = region.y + 4 + (scroll / (layout.height - region.h)) * (track - tH);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    rr(ctx, region.x + region.w + 6, region.y + 4, 10, track, 5); ctx.fill();
    ctx.fillStyle = alpha(th.accent.length === 7 ? th.accent : '#e8c46a', 0.75);
    rr(ctx, region.x + region.w + 6, ty, 10, tH, 5); ctx.fill();
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

// ----------------------------------------------------------------------------------- illustrations
const cap = (ctx, str, x, y, size = 22, col = 'rgba(246,236,214,0.84)') => text(ctx, str, x, y, size, col, { weight: 600 });
const START = 'OOOOO/OOOOO/OO.XX/XXXXX/XXXXX';
const JUMP_BEFORE = '...../...../..O../..X../.....';
const JUMP_AFTER = '...../..X../...../...../.....';

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
    cap(ctx, ca, x + 20 + s / 2, y + h - 22, fitOne(ca, s + 16, 19, 11)); cap(ctx, cb, x + w - s / 2 - 20, y + h - 22, fitOne(cb, s + 16, 19, 11), tone ?? th.accent);
  };
  const line1 = (str, col = th.accent, size = 21) => cap(ctx, str, cx, y + h - 20, Math.min(size, fitOne(str, w - 28, size, 13)), col);
  if (name === 'logo') {
    const s = Math.min(h - 40, 270);
    mb(cx - s / 2, y + 20, s, START, {});
  } else if (name === 'start' || name === 'setupart') {
    const s = one(310);
    mb(cx - s / 2, y + 12, s, START, { hl: [CENTRE] });
    line1(name === 'setupart' ? tr('cFirst') : tr('cStart'));
  } else if (name === 'board') {
    const s = one(310);
    mb(cx - s / 2, y + 12, s, '...../...../..X../...../.....', { dots: [0, 2, 4, 6, 8, 10, 14, 16, 18, 20, 22, 24, 12].filter((i) => i !== 12) });
    line1(tr('cDiag'), th.accent, 20);
  } else if (name === 'step') {
    const s = one(310);
    mb(cx - s / 2, y + 12, s, '...../...../...../.X.../.....', { dots: [10, 11, 12, 15, 17] });
    line1(tr('cStep'), th.accent, 20);
  } else if (name === 'jump') {
    pair(JUMP_BEFORE, { arrows: [[17, 7]], marks: [12] }, JUMP_AFTER, {}, tr('cJumpA'), tr('cJumpB'));
  } else if (name === 'must') {
    const s = one(310);
    mb(cx - s / 2, y + 12, s, '...../...../..O../..X.X/X....', { arrows: [[17, 7]], marks: [12], hl: [20] });
    line1(tr('cMust'), th.accent, 19);
  } else if (name === 'chain') {
    const s = one(310);
    mb(cx - s / 2, y + 12, s, '....O/.O.../..O../..X../.....', { arrows: [[17, 7], [7, 5]], marks: [12, 6] });
    line1(tr('cChain'), th.accent, 19);
  } else if (name === 'back') {
    const s = one(310);
    mb(cx - s / 2, y + 12, s, 'O..../..X../..O../...../.....', { arrows: [[7, 17]], marks: [12] });
    line1(tr('cBack'), th.accent, 19);
  } else if (name === 'blocked') {
    const s = one(300);
    mb(cx - s / 2, y + 12, s, 'OXX../XX.../X.X../...../.....', { hl: [0] });
    line1(tr('cBlocked'), th.accent, 20);
  } else if (name === 'limit') {
    const s = one(300);
    mb(cx - s / 2, y + 12, s, 'X.O../.X.O./...../.O.X./..X.O', {});
    line1(tr('cLimit', { n: QUIET_LIMIT }), th.accent, 19);
  } else if (name === 'trad') {
    const s = one(300);
    mb(cx - s / 2, y + 12, s, START, {});
    line1(tr('cTrad'), th.accent, 20);
  } else if (name === 'think') {
    const s = Math.min(h - 100, 270);
    const g = mb(cx - s / 2, y + 14, s, JUMP_BEFORE, { marks: [12] });
    const [px, py] = g.centers[17];
    ctx.save(); ctx.strokeStyle = th.accent; ctx.lineWidth = 4; ctx.globalAlpha = 0.6 + 0.4 * Math.sin(t * 4); ctx.beginPath(); ctx.arc(px, py, g.u * 0.42, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    ctx.fillStyle = 'rgba(10,6,4,0.8)'; rr(ctx, x + 30, y + h - 70, w - 60, 48, 24); ctx.fill();
    ctx.strokeStyle = th.stroke; ctx.lineWidth = 1.5; rr(ctx, x + 30, y + h - 70, w - 60, 48, 24); ctx.stroke();
    cap(ctx, tr('cThinkEx'), cx, y + h - 38, fitOne(tr('cThinkEx'), w - 90, 22, 13), th.accent);
  } else if (name === 'levels') {
    LEVELS.forEach((l, i) => {
      const yy = y + 24 + i * ((h - 48) / 5);
      cap(ctx, lvName(l.id), x + 120, yy + 30, 24, th.ink);
      ctx.fillStyle = 'rgba(255,255,255,0.12)'; rr(ctx, x + 250, yy + 12, w - 290, 26, 13); ctx.fill();
      ctx.fillStyle = th.accent; rr(ctx, x + 250, yy + 12, (w - 290) * (0.2 + 0.2 * i), 26, 13); ctx.fill();
    });
  } else if (name === 'learn') {
    [[lessonTitle(LESSONS[0]), true, START], [lessonTitle(LESSONS[2]), true, JUMP_BEFORE], [lessonTitle(LESSONS[4]), false, '....O/.O.../..O../..X../.....']].forEach(([nm, done, cells], i) => {
      const yy = y + 20 + i * 112;
      ctx.fillStyle = done ? th.btnOn[0] : th.btn[0]; rr(ctx, x + 24, yy, w - 48, 96, 16); ctx.fill();
      mb(x + 36, yy + 8, 80, cells, { border: false });
      text(ctx, nm, x + 140, yy + 56, fitOne(nm, w - 260, 26, 14), th.ink, { weight: 700, align: 'left' });
      if (done) icon(ctx, 'check', x + w - 70, yy + 48, 40, th.ink);
    });
  } else if (name === 'undo') {
    icon(ctx, 'undo', cx - 130, cy - 14, 84, th.accent); icon(ctx, 'reset', cx + 130, cy - 14, 84, th.accent);
    cap(ctx, tr('undo'), cx - 130, cy + 70, 24); cap(ctx, tr('restart'), cx + 130, cy + 70, 24);
  } else if (name === 'auto') {
    ctx.strokeStyle = 'rgba(255,255,255,0.16)'; ctx.lineWidth = 12; ctx.beginPath(); ctx.arc(cx - 150, cy, 46, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = th.accent; ctx.beginPath(); ctx.arc(cx - 150, cy, 46, -Math.PI / 2, -Math.PI / 2 + ((t * 0.4) % 1) * Math.PI * 2); ctx.stroke();
    drawPiece(ctx, th, 1, cx + 10, cy, 96, { glow: 0.5 + 0.5 * Math.sin(t * 5) });
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
    if (e.winner === 1 || e.winner === 2) drawPiece(ctx, th, e.winner, cx, cy + 4, ss, { scale: k, glow: 0.5 + 0.4 * Math.sin(S.ovT * 4) });
    else { drawPiece(ctx, th, 1, cx - ss * 0.75, cy + 4, ss * 0.88, { scale: k }); drawPiece(ctx, th, 2, cx + ss * 0.75, cy + 4, ss * 0.88, { scale: k }); }
  }
  ctx.restore();
}

// --------------------------------------------------------------------------------------- title
// The title's attract scene: a real two-jump chain is played out on a real board over and over.
const ATTRACT = '....O/.O.../..O../..X../.....';
const ATTRACT_JUMPS = [[17, 7, 12], [7, 5, 6]];
const ease3 = (k) => k * k * (3 - 2 * k);

function drawAttract(ctx, S) {
  const th = theme(S), t = S.t;
  const side = 380, bx = (W - side) / 2, by = 360;
  const geo = boardGeo(bx, by, side);
  const glow = ctx.createRadialGradient(W / 2, by + side / 2, 30, W / 2, by + side / 2, 360);
  glow.addColorStop(0, th.glow); glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow; ctx.fillRect(0, by - 140, W, side + 280);
  drawSlab(ctx, th, bx, by, side);
  drawLines(ctx, th, geo);
  const cells = ATTRACT.replace(/[\s/]/g, '').split('').map((c) => (c === 'X' ? 1 : c === 'O' ? 2 : 0));
  const cycle = 7.2, tt = t % cycle;
  const fade = tt > 6.2 ? 1 - clamp01((tt - 6.2) / 0.8) : clamp01(tt / 0.4);
  const ghosts = [];
  let moving = null;
  const j0 = clamp01((tt - 1.2) / JUMP_T), j1 = clamp01((tt - 2.4) / JUMP_T);
  if (j0 >= 1) { cells[17] = 0; cells[12] = 0; cells[7] = 1; }
  if (j1 >= 1) { cells[7] = 0; cells[6] = 0; cells[5] = 1; }
  if (j0 > 0 && j0 < 1) { cells[17] = 0; moving = { from: 17, to: 7, k: j0 }; }
  if (j1 > 0 && j1 < 1) { cells[7] = 0; cells[12] = 0; moving = { from: 7, to: 5, k: j1 }; }
  if (j0 > 0 && tt < 1.2 + JUMP_T + CAP_T + 0.2) ghosts.push({ cell: 12, k: clamp01((tt - 1.2 - CAP_AT) / CAP_T) });
  if (j1 > 0) { ghosts.push({ cell: 6, k: clamp01((tt - 2.4 - CAP_AT) / CAP_T) }); if (j0 >= 1) cells[12] = 0; }
  if (j0 > 0 && j0 < 1) cells[12] = 0;
  for (let i = 0; i < NN; i++) { if (!cells[i]) continue; const [cx, cy] = geo.centers[i]; drawPiece(ctx, th, cells[i], cx, cy, geo.d, { alpha: fade }); }
  for (const g of ghosts) { if (g.k >= 1) continue; const [cx, cy] = geo.centers[g.cell]; drawPiece(ctx, th, 2, cx, cy, geo.d, { alpha: fade * (1 - g.k), scale: 1 - 0.4 * g.k, rot: g.k * 1.2 }); }
  if (moving) {
    const [fx, fy] = geo.centers[moving.from], [tx, ty] = geo.centers[moving.to], e = ease3(moving.k);
    drawPiece(ctx, th, 1, fx + (tx - fx) * e, fy + (ty - fy) * e, geo.d, { alpha: fade, lift: Math.sin(moving.k * Math.PI) * 1.1, glow: 0.4 });
  }
  const g = ctx.createLinearGradient(0, 110, 0, 250);
  g.addColorStop(0, light2(th.accent)); g.addColorStop(0.5, th.accent); g.addColorStop(1, '#a8782a');
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.65)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 8;
  ctx.textAlign = 'center'; ctx.fillStyle = g;
  ctx.direction = hasArabic(tr('alquerque')) ? 'rtl' : 'ltr';
  const fs = fitOne(tr('alquerque'), 640, 132, 60);
  ctx.font = `800 ${fs}px ${DISPLAY}`;
  ctx.fillText(tr('alquerque'), 360, 200);
  const fs2 = fitOne(tr('twelve'), 640, 58, 30);
  ctx.font = `800 ${fs2}px ${DISPLAY}`;
  ctx.fillText(tr('twelve'), 360, 266);
  ctx.restore();
  text(ctx, tr('fromWhere'), 360, 312, fitOne(tr('fromWhere'), 660, 26, 16), 'rgba(250,238,214,0.84)', { weight: 600 });
  text(ctx, tr('tagline'), 360, 346, fitOne(tr('tagline'), 660, 25, 16), 'rgba(250,238,214,0.62)', { weight: 500 });
}
const light2 = (c) => (c.length === 7 ? `rgb(${Math.min(255, parseInt(c.slice(1, 3), 16) + 70)},${Math.min(255, parseInt(c.slice(3, 5), 16) + 70)},${Math.min(255, parseInt(c.slice(5, 7), 16) + 70)})` : '#fff3c4');

function drawTitle(ctx, S, ui) {
  background(ctx, theme(S), S.t, 560, false);
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
  ctx.fillStyle = `rgba(8,4,2,${0.62 * clamp01(S.ovT / 0.25)})`;
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

// ------------------------------------------------------------------------------------------ pieces in motion
// a = { t, kind: 'step' | 'jump', from: [x, y] } (time since the move began). o: { alpha, glow, scale }
export function animPiece(ctx, th, who, x, y, d, a, o = {}) {
  if (!a) { drawPiece(ctx, th, who, x, y, d, o); return; }
  const dur = a.kind === 'jump' ? JUMP_T : STEP_T;
  const k = clamp01(a.t / dur), e = k * k * (3 - 2 * k);
  const px = a.from[0] + (x - a.from[0]) * e, py = a.from[1] + (y - a.from[1]) * e;
  const squash = k > 0.85 && k < 1 ? Math.sin(((k - 0.85) / 0.15) * Math.PI) * 0.04 : 0;
  drawPiece(ctx, th, who, px, py, d, { ...o, lift: Math.sin(k * Math.PI) * (a.kind === 'jump' ? 1.2 : 0.55), scale: (o.scale ?? 1) * (1 + squash), glow: a.kind === 'jump' ? 0.5 : o.glow });
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
  text(ctx, sub, 360, 96, sSize, 'rgba(250,238,214,0.72)', { weight: 500 });
}

function drawPlate(ctx, S, r, who, name, sub, active) {
  const th = theme(S), z = TEXT_SCALES[S.textIdx];
  ctx.save();
  ctx.fillStyle = 'rgba(10,6,4,0.55)'; rr(ctx, r.x, r.y, r.w, r.h, 20); ctx.fill();
  ctx.strokeStyle = active ? th.accent : 'rgba(255,255,255,0.14)'; ctx.lineWidth = active ? 3 : 1.5;
  if (active) { ctx.shadowColor = alpha(th.accent.length === 7 ? th.accent : '#e8c46a', 0.7); ctx.shadowBlur = 16; }
  rr(ctx, r.x, r.y, r.w, r.h, 20); ctx.stroke();
  ctx.restore();
  const md = Math.min(r.h - 28, 74);
  drawPiece(ctx, th, who, r.x + 14 + md / 2, r.y + r.h / 2, md * 0.85, { noShadow: true, glow: active ? 0.4 : 0 });
  const tx = r.x + 24 + md, avail = r.w - md - 40;
  const ns = fitOne(name, avail, 30 * (1 + (z - 1) * 0.55), 16);
  const ss = fitOne(sub, avail, 21 * (1 + (z - 1) * 0.55), 14);
  const total = ns + ss + 8, ty = r.y + (r.h - total) / 2 + ns * 0.88;
  text(ctx, name, tx, ty, ns, th.ink, { weight: 800, align: 'left', font: DISPLAY });
  text(ctx, sub, tx, ty + ss + 8, ss, active ? th.accent : 'rgba(246,236,214,0.64)', { weight: 600, align: 'left' });
}

function drawStatus(ctx, S, r, head, body, col) {
  const th = theme(S), z = TEXT_SCALES[S.textIdx];
  ctx.save();
  ctx.fillStyle = 'rgba(10,6,4,0.6)'; rr(ctx, r.x, r.y, r.w, r.h, 22); ctx.fill();
  ctx.strokeStyle = th.stroke; ctx.lineWidth = 1.5; rr(ctx, r.x, r.y, r.w, r.h, 22); ctx.stroke();
  ctx.restore();
  const pad = 22, w = r.w - pad * 2;
  const full = body ? `${head}\n${body}` : head;
  const f = fitText(full, w, r.h - 24, 32 * (1 + (z - 1) * 0.6), 16);
  const hl = wrap(head, f.size, w).length;
  const all = body ? [...wrap(head, f.size, w), ...wrap(body, f.size, w)] : wrap(head, f.size, w);
  const total = all.length * f.line;
  let ty = r.y + (r.h - total) / 2 + f.size * 0.95;
  all.forEach((ln, i) => { text(ctx, ln, r.x + r.w / 2, ty, f.size, i < hl ? (col ?? th.accent) : 'rgba(250,240,222,0.93)', { weight: i < hl ? 800 : 500 }); ty += f.line; });
}

function pulse(S, rate = 5) { return 0.5 + 0.5 * Math.sin(S.t * rate); }
const nudge = (a, b, pad) => {
  const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1;
  return [a[0] + (dx / len) * pad, a[1] + (dy / len) * pad, b[0] - (dx / len) * pad, b[1] - (dy / len) * pad];
};

// Draws the board and its pieces for a match. `auto` carries Watch & Learn's reveal info. The board never moves: only pieces,
// rings and sparks do.
function drawBoardScene(ctx, S, M, geo, auto) {
  const th = theme(S);
  ctx.save();
  const glow = ctx.createRadialGradient(geo.x + geo.side / 2, geo.y + geo.side / 2, 40, geo.x + geo.side / 2, geo.y + geo.side / 2, geo.side * 0.85);
  glow.addColorStop(0, th.glow); glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow; ctx.fillRect(geo.x - 160, geo.y - 160, geo.side + 320, geo.side + 320);
  drawSlab(ctx, th, geo.x, geo.y, geo.side);
  drawLines(ctx, th, geo);
  const pl = pulse(S);
  const st = M.st;
  const acc = th.accent.length === 7 ? th.accent : '#e8c46a';
  const RED = '#ff7a62';
  const ring = (i, col, lw = 4, a = 1, grow = 0.62) => { const [cx, cy] = geo.centers[i]; ctx.save(); ctx.strokeStyle = col; ctx.globalAlpha = a; ctx.lineWidth = lw; ctx.beginPath(); ctx.arc(cx, cy, geo.d * grow, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); };
  const disc = (i, col, a, grow = 0.58) => { const [cx, cy] = geo.centers[i]; ctx.save(); ctx.fillStyle = col; ctx.globalAlpha = a; ctx.beginPath(); ctx.arc(cx, cy, geo.d * grow, 0, Math.PI * 2); ctx.fill(); ctx.restore(); };
  const A = M.anim;
  const busy = Object.keys(A).length > 0 || M.ghosts.length > 0;
  // the last move: a soft outline where it left and where it landed
  if (M.last && !M.over && !busy) { ring(M.last.to, acc, 3, 0.35 + 0.2 * pl, 0.6); ring(M.last.from, acc, 2, 0.22, 0.5); }
  const mine = humanTurn(M) && !M.over && !busy;
  const moves = mine ? legalMoves(st) : [];
  const selected = M.sel >= 0 ? M.sel : st.chain >= 0 && mine ? st.chain : -1;
  const forced = moves.length > 0 && moves[0].cap >= 0;
  // compulsory capture: the pieces that can capture glow
  if (mine && forced && selected < 0) for (const f of new Set(moves.map((m) => m.from))) { disc(f, acc, 0.16 + 0.12 * pl, 0.7); ring(f, acc, 3.5, 0.5 + 0.4 * pl, 0.7); }
  // selection: where it can go, and what each jump would capture
  const capMarks = [];
  if (selected >= 0 && mine) {
    disc(selected, acc, 0.22 + 0.12 * pl, 0.66);
    for (const m of moves.filter((q) => q.from === selected)) {
      const [cx, cy] = geo.centers[m.to];
      if (m.cap >= 0) {
        disc(m.to, RED, 0.2 + 0.1 * pl, 0.55); ring(m.to, RED, 3.5, 0.9, 0.6); capMarks.push(m.cap);
        arrowLine(ctx, RED, geo.centers[m.from], geo.centers[m.to], geo.d * 0.45);
      } else disc(m.to, acc, 0.16 + 0.1 * pl, 0.5);
      ctx.fillStyle = m.cap >= 0 ? RED : acc; ctx.beginPath(); ctx.arc(cx, cy, geo.u * 0.085, 0, Math.PI * 2); ctx.fill();
    }
  }
  if (S.kbd && humanTurn(M) && !M.over) ring(M.cur, '#ffffff', 3, 0.75, 0.7);
  if (M.flash >= 0) disc(M.flash, '#ff6a5a', 0.45 * clamp01(M.flashT / 0.3), 0.6);
  // Think
  if (M.hint && !M.over) {
    const mv = M.hint.mv;
    disc(mv.to, acc, 0.25 + 0.25 * pl, 0.6); ring(mv.to, acc, 5, 0.6 + 0.4 * pl, 0.66); ring(mv.from, acc, 4, 0.7, 0.66);
    arrow(ctx, acc, ...nudge(geo.centers[mv.from], geo.centers[mv.to], geo.d * 0.42));
    if (mv.cap >= 0) capMarks.push(mv.cap);
  }
  // Watch & Learn: every option, then the chosen move
  if (auto && auto.phase === 'reveal' && auto.plan) {
    const ch = auto.plan.mv;
    for (const mv of auto.plan.moves) if (!(mv.from === ch.from && mv.to === ch.to)) ring(mv.to, 'rgba(170,200,255,0.9)', 3, 0.45 + 0.2 * pl, 0.6);
    disc(ch.to, acc, 0.3 + 0.2 * pl, 0.6); ring(ch.to, acc, 5, 0.7 + 0.3 * pl, 0.66); ring(ch.from, acc, 4, 0.8, 0.66);
    arrow(ctx, acc, ...nudge(geo.centers[ch.from], geo.centers[ch.to], geo.d * 0.42));
    if (ch.cap >= 0) capMarks.push(ch.cap);
  }
  if (auto && auto.phase === 'think' && auto.scan != null) disc(auto.scan, 'rgba(255,255,255,0.8)', 0.08 + 0.08 * pl, 0.6);
  // pieces
  const over = M.over;
  const flying = [];
  for (let i = 0; i < NN; i++) {
    const who = st.cells[i];
    if (!who) continue;
    const [cx, cy] = geo.centers[i];
    const a = A[i];
    let o = {};
    if (over && over.winner) {
      if (who === over.winner) { const idx = i % 5; o = { glow: 0.5 + 0.4 * Math.sin(M.winT * 6 - idx), scale: 1 + 0.04 * Math.max(0, Math.sin(M.winT * 6 - idx * 0.9)) }; } else o = { alpha: 0.7 };
    } else if (M.hint && M.hint.mv.from === i) o = { glow: 0.6 };
    else if (selected === i) o = { glow: 0.5 + 0.3 * pl, lift: 0.6 };
    else if (auto && auto.phase === 'reveal' && auto.plan && auto.plan.mv.from === i) o = { glow: 0.5 + 0.4 * pl };
    if (a && a.t < (a.kind === 'jump' ? JUMP_T : STEP_T)) { flying.push([who, cx, cy, a, o, i]); continue; }
    drawPiece(ctx, th, who, cx, cy, geo.d, o);
  }
  for (const c of capMarks) { const [cx, cy] = geo.centers[c]; drawCross(ctx, cx, cy, geo.u * 0.2); }
  // a jumped piece stays until the jumper passes over it, then shrinks and fades
  for (const g of M.ghosts) {
    const [cx, cy] = geo.centers[g.cell];
    if (g.t < CAP_AT) drawPiece(ctx, th, g.who, cx, cy, geo.d, {});
    else { const k = clamp01((g.t - CAP_AT) / CAP_T); drawPiece(ctx, th, g.who, cx, cy, geo.d, { alpha: 1 - k, scale: 1 - 0.45 * k, rot: k * 1.4, noShadow: true }); }
  }
  for (const [who, cx, cy, a, o] of flying) animPiece(ctx, th, who, cx, cy, geo.d, { ...a, from: geo.centers[a.from] }, o);
  ctx.restore();
  drawParticles(ctx, M.parts);
}
function arrowLine(ctx, col, p0, p1, pad) {
  const dx = p1[0] - p0[0], dy = p1[1] - p0[1], len = Math.hypot(dx, dy) || 1;
  ctx.save(); ctx.strokeStyle = col; ctx.globalAlpha = 0.55; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.setLineDash([10, 9]);
  ctx.beginPath(); ctx.moveTo(p0[0] + (dx / len) * pad, p0[1] + (dy / len) * pad); ctx.lineTo(p1[0] - (dx / len) * pad, p1[1] - (dy / len) * pad); ctx.stroke(); ctx.restore();
}

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

const nameOf = (M, who) => {
  if (M.auto || M.two) return sideLabel(who);
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
    else if (auto.phase === 'think') { head = tr('autoThink', { n: Math.max(0, Math.ceil(THINK_STEPS[S.thinkIdx] - auto.t)) }); body = tr('toMove', { side: sideThe(st.turn) }); }
    else if (auto.phase === 'reveal' || auto.phase === 'act') { head = auto.note.head; body = auto.note.why; }
    else if (auto.phase === 'intro') head = tr('alquerque');
  } else if (S.toast) { head = S.toast; }
  else if (Object.keys(M.anim).length || M.ghosts.length) { const who = M.last ? M.last.who : st.turn; head = tr(M.last && M.last.cap >= 0 ? 'aJump' : 'aStep', { side: M.two || M.auto || M.lesson ? sideThe(who) : who === M.human ? tr('youWord') : lvName(M.level) }); }
  else if (M.hintTask) { head = tr('thinkingDots'); }
  else if (M.hint) { head = M.hint.head; body = M.hint.why; }
  else if (M.lesson && M.lesson.type !== 'game') { head = lessonTask(M.lesson); }
  else if (M.thinking) { head = tr('thinkingDots'); }
  else if (humanTurn(M)) {
    const forced = mustCapture(st), nm = M.two ? sideThe(st.turn) : '';
    if (st.chain >= 0) { head = M.two ? tr('chainSide', { side: nm }) : tr('chainHead'); body = tr('chainBody'); }
    else if (forced) { head = tr('mustHead'); body = tr(M.sel >= 0 ? 'targetMust' : 'pickMust'); }
    else head = M.two ? tr(M.sel >= 0 ? 'targetSide' : 'pickSide', { side: nm }) : tr(M.sel >= 0 ? 'targetYou' : 'pickYou');
  }
  return { head, body };
}

// The board turns half a turn when you play Dark, so your own pieces are always at the bottom (the board is symmetric).
export function playGeo(S, M) {
  const lay = playLayout(TEXT_SCALES[S.textIdx]);
  const flip = !M.two && !M.auto && !M.lesson && M.human === 2;
  return { lay, geo: boardGeo(lay.board.x, lay.board.y, lay.board.side, flip) };
}

function drawPlay(ctx, S) {
  const th = theme(S), M = S.match, z = TEXT_SCALES[S.textIdx];
  background(ctx, th, S.t, 800);
  const auto = S.scene === 'auto' ? S.auto : null;
  const lay = playLayout(z);
  const title = M.lesson ? lessonTitle(M.lesson) : tr('alquerque');
  const quiet = !M.lesson ? tr('noCapture', { q: M.st.quiet, m: QUIET_LIMIT }) : '';
  const sub = M.lesson ? tr('lessonOf', { n: S.lessonIdx + 1, m: LESSONS.length }) : auto ? tr('watchSub', { n: THINK_STEPS[S.thinkIdx] }) + quiet : (M.two ? tr('twoPlayers') : tr('vsLevel', { level: lvName(M.level) })) + quiet;
  drawHud(ctx, S, title, sub, !auto);
  const st = M.st;
  const toMove = M.over ? 0 : st.turn;
  const plateSub = (who) => {
    if (M.over) return M.over.winner === who ? tr('winnerWord') : M.over.winner === 0 ? tr('drawWord') : piecesText(countOf(st, who));
    return piecesText(countOf(st, who));
  };
  drawPlate(ctx, S, lay.chips[0], 1, nameOf(M, 1), plateSub(1), toMove === 1);
  drawPlate(ctx, S, lay.chips[1], 2, nameOf(M, 2), plateSub(2), toMove === 2);
  const geo = playGeo(S, M).geo;
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

export { getRules, DOC_PANEL, NAV_PREV, NAV_NEXT, H, W, CENTRE, other, parse };
