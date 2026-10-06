// Everything drawn each frame. Reads state, changes nothing.
import {
  W, H, UI, DISPLAY, THEMES, themeById, text, rr, panel, button, background, icon, alpha, clamp01, ease, backOut,
  BW, BH, CELLS, HOLE_R, boardGeo, drawBoardBase, drawBoardStones, drawBoardMarks, drawDan, drawHand, ringCell, fillCell,
} from './art.js';
import { TEXT_SCALES, wrap, tw } from './ui.js';
import { CIRCUIT, play, scoreOf, startState } from './engine.js';
import { LEVELS } from './ai.js';
import { LESSONS, lessonText } from './lessons.js';
import { tr, levelName, getLang, howtoPages, rulesPages } from './content.js';
import { TOOLBAR_IDS, layoutNow } from './layout.js';
import { drawLockup, drawMoreLine } from './brand.js';
import { THINK_STEPS } from './screens.js';
import { humanTurn, flightPos, fromState } from './match.js';
import { moveWords } from './explain.js';

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
    }
  }
  ctx.restore();
  if (layout.height > region.h) {
    const track = region.h - 8, tH = Math.max(48, (region.h / layout.height) * track);
    const ty = region.y + 4 + (scroll / (layout.height - region.h)) * (track - tH);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    rr(ctx, region.x + region.w + 7, region.y + 4, 8, track, 4); ctx.fill();
    ctx.fillStyle = alpha(th.accent, 0.75);
    rr(ctx, region.x + region.w + 7, ty, 8, tH, 4); ctx.fill();
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

// ----------------------------------------------------------------------------------------- board scene
// view for a static board (illustrations, title): counts from a state.
const viewOf = (st) => ({ cells: st.cells });
const LANE = ['rgba(255,225,140,0.95)', 'rgba(150,215,255,0.95)', 'rgba(255,170,150,0.95)', 'rgba(190,255,170,0.95)'];

// A curved arrow from hole a to hole b (board units), bent to one side so several laps stay apart.
function arcArrow(ctx, a, b, col, lane) {
  const dx = b.cx - a.cx, dy = b.cy - a.cy, d = Math.hypot(dx, dy) || 1;
  const nx = -dy / d, ny = dx / d, bend = (22 + d * 0.14) * (lane % 2 ? -1 : 1);
  const sx = a.cx + dx * 0.2, sy = a.cy + dy * 0.2, ex = b.cx - dx * 0.2, ey = b.cy - dy * 0.2;
  const qx = (sx + ex) / 2 + nx * bend, qy = (sy + ey) / 2 + ny * bend;
  ctx.save(); ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 6; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(sx, sy); ctx.quadraticCurveTo(qx, qy, ex, ey); ctx.stroke();
  const ang = Math.atan2(ey - qy, ex - qx);
  ctx.beginPath(); ctx.moveTo(ex + Math.cos(ang) * 9, ey + Math.sin(ang) * 9);
  ctx.lineTo(ex - Math.cos(ang - 0.55) * 18, ey - Math.sin(ang - 0.55) * 18); ctx.lineTo(ex - Math.cos(ang + 0.55) * 18, ey - Math.sin(ang + 0.55) * 18);
  ctx.closePath(); ctx.fill(); ctx.restore();
}

// Explains a real turn on a board: rings the hole it starts from, an arrow for each sowing lap and a gold ring where it captures.
function drawPathMarks(ctx, th, ev) {
  let lap = -1;
  const laps = [];
  for (const e of ev) {
    if (e.t === 'pick') { lap++; laps[lap] = { from: e.cell, to: e.cell }; }
    else if (e.t === 'drop' && laps[lap]) laps[lap].to = e.cell;
  }
  // a long relay stays readable: arrows only for the first and the last lap, the laps in between show just where they start
  laps.forEach((l, i) => { if (l.from !== l.to && (i === 0 || i === laps.length - 1)) arcArrow(ctx, CELLS[l.from], CELLS[l.to], i === 0 ? LANE[0] : LANE[1], i); });
  laps.forEach((l, i) => ringCell(ctx, l.from, i === 0 ? th.accent : i === laps.length - 1 ? LANE[1] : 'rgba(255,255,255,0.55)', i === 0 ? 5 : 3.5, 0.95, 1));
  for (const e of ev) if (e.t === 'capture') {
    for (const c of e.cells) ringCell(ctx, c, '#ffe27a', 6, 1, 3);
    const r = CELLS[e.at];
    ctx.fillStyle = '#ffe27a'; rr(ctx, r.cx - 34, r.cy - 20, 68, 40, 20); ctx.fill();
    text(ctx, `+${e.n}`, r.cx, r.cy + 10, 28, '#3a2108', { weight: 800 });
  }
}

// A whole board drawn at geo with a static state; o: { ev, rings, fills, extra }
function drawStaticBoard(ctx, th, geo, st, o = {}) {
  ctx.save();
  ctx.translate(geo.x, geo.y); ctx.scale(geo.sc, geo.sc);
  drawBoardBase(ctx, th);
  for (const i of o.fills ?? []) fillCell(ctx, i, th.accent, 0.22);
  drawBoardStones(ctx, th, viewOf(st));
  drawBoardMarks(ctx, th, { ...viewOf(st), zoom: 1 }, text);
  if (o.ev) drawPathMarks(ctx, th, o.ev);
  for (const i of o.rings ?? []) ringCell(ctx, i, th.accent, 5, 1, 1);
  if (o.extra) o.extra(ctx);
  ctx.restore();
}

// ----------------------------------------------------------------------------------- illustrations
// Hole ids: row * 6 + col; row 2 (ids 12-17) is the bottom row, row 1 (6-11) the middle row, row 0 (0-5) the top row.
const mk = (cells, extra = {}) => ({ cells, pd: [0, 0], turn: 1, plies: 0, over: null, ...extra });
const Z = (n) => Array(n).fill(0);
const put = (pairs) => { const c = Z(18); for (const [i, n] of pairs) c[i] = n; return c; };
export const ILLUS = {
  turn: { st: mk(put([[12, 2], [13, 1], [15, 3], [3, 2], [5, 1], [7, 1]])), mv: { cell: 12 }, cap: 'two seeds sown: one into each of the next two holes' },
  relay: { st: mk(put([[12, 1], [13, 2], [15, 1], [4, 3], [8, 2]])), mv: { cell: 12 }, cap: 'the second lap starts from the full hole, and the last seed captures' },
  capture: { st: mk(put([[12, 2], [2, 4], [4, 2], [10, 1]])), mv: { cell: 12 }, cap: 'the last seed lands in an empty hole: the column above is captured' },
  column: { st: mk(put([[12, 2], [2, 3], [8, 2], [5, 1]])), mv: { cell: 12 }, cap: 'top and middle holes of the column captured together: 5' },
  stop: { st: mk(put([[12, 2], [13, 1], [3, 2], [5, 1]])), mv: { cell: 12 }, cap: 'an empty hole with nothing in its column: the turn just ends' },
  wrap: { st: mk(put([[9, 2], [1, 4], [7, 1], [16, 1]])), mv: { cell: 9 }, cap: 'round the corner: from the last middle hole back to the start' },
  end: { st: mk(put([[13, 2], [15, 1], [10, 1]]), { pd: [9, 41] }), cap: 'one side is out of seeds: the game is over' },
  board: { st: startState(), cap: 'three rows of six holes, three seeds in each' },
  owner: { st: startState(), cap: 'gold: Player 1\'s nine holes. Green-blue: Player 2\'s' },
};

function drawArt(ctx, S, name, x, y, w, h, b) {
  const th = theme(S), t = S.t;
  const cx = x + w / 2, cy = y + h / 2;
  if (name === 'more') { drawMoreLine(ctx, cx, cy, 20); return; }   // the quiet Arcforge line on the result card (no frame)
  ctx.save();
  ctx.fillStyle = 'rgba(10,6,4,0.5)'; rr(ctx, x, y, w, h, 18); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.14)'; ctx.lineWidth = 1.5; rr(ctx, x, y, w, h, 18); ctx.stroke();
  ctx.beginPath(); rr(ctx, x, y, w, h, 18); ctx.clip();
  const cap = (str, yy, size = 22, col = 'rgba(246,236,214,0.82)') => { const s = fitOne(str, w - 30, size, 14); text(ctx, str, cx, yy, s, col, { weight: 600 }); };
  const board = (st, o = {}) => {
    const bw = Math.min(w - 36, (h - 76) * BW / BH);
    const geo = boardGeo(cx - bw / 2, y + 18, bw);
    drawStaticBoard(ctx, th, geo, st, o);
    return geo;
  };
  const IL = ILLUS[name];
  if (IL) {
    const ev = IL.mv ? play(IL.st, IL.mv, true).ev : undefined;
    board(IL.st, { ev });
    cap(IL.cap, y + h - 22, 22);
  } else if (name === 'logo') {
    const bw = Math.min(w - 40, 290);
    drawStaticBoard(ctx, th, boardGeo(cx - bw / 2, y + 16, bw), startState(), {});
    text(ctx, tr('appName'), cx, y + h - 22, 52, th.accent, { font: DISPLAY, weight: 800 });
  } else if (name === 'tap') {
    const st = mk(put([[12, 2], [13, 1], [15, 3], [3, 2], [5, 1], [7, 1], [10, 2]]));
    const bw = Math.min(w - 36, (h - 70) * BW / BH);
    const geo = boardGeo(cx - bw / 2, y + 14, bw);
    drawStaticBoard(ctx, th, geo, st, { fills: [12, 13, 15, 10], rings: [15] });
    cap('tap one of your holes that holds seeds', y + h - 22, 22);
  } else if (name === 'think') {
    const st = mk(put([[12, 2], [2, 4], [4, 2], [10, 1]]));
    const bw = Math.min(w - 36, (h - 120) * BW / BH);
    const geo = boardGeo(cx - bw / 2, y + 14, bw);
    drawStaticBoard(ctx, th, geo, st, { rings: [12] });
    ctx.fillStyle = 'rgba(10,6,4,0.85)'; rr(ctx, x + 30, y + h - 82, w - 60, 62, 30); ctx.fill();
    ctx.strokeStyle = th.stroke; ctx.lineWidth = 1.5; rr(ctx, x + 30, y + h - 82, w - 60, 62, 30); ctx.stroke();
    cap('Captures 4 seeds. The opponent answers with 0.', y + h - 44, 22, th.accent);
  } else if (name === 'levels') {
    LEVELS.forEach((l, i) => {
      const yy = y + 24 + i * ((h - 48) / 5);
      text(ctx, levelName(l.id), x + 130, yy + 30, 24, th.ink, { weight: 700 });
      ctx.fillStyle = 'rgba(255,255,255,0.12)'; rr(ctx, x + 270, yy + 12, w - 310, 26, 13); ctx.fill();
      ctx.fillStyle = th.accent; rr(ctx, x + 270, yy + 12, (w - 310) * (0.2 + 0.2 * i), 26, 13); ctx.fill();
    });
  } else if (name === 'learn') {
    LESSONS.slice(0, 3).forEach((l, i) => {
      const yy = y + 20 + i * 112;
      ctx.fillStyle = i < 2 ? th.btnOn[0] : th.btn[0]; rr(ctx, x + 24, yy, w - 48, 96, 16); ctx.fill();
      drawDan(ctx, th, x + 76, yy + 48, 3 + i * 5); drawDan(ctx, th, x + 100, yy + 56, 9 + i);
      text(ctx, `${i + 1}. ${lessonText(l.id).title}`, x + 140, yy + 58, 26, th.ink, { weight: 700, align: 'left' });
      if (i < 2) icon(ctx, 'check', x + w - 70, yy + 48, 40, th.ink);
    });
  } else if (name === 'themes') {
    const bw = (w - 60) / 2;
    THEMES.forEach((tt, i) => { const geo = boardGeo(x + 20 + i * (bw + 20), cy - bw * BH / BW / 2 - 8, bw); drawStaticBoard(ctx, tt, geo, startState(), {}); });
    cap('Carved Acacia  ·  Highland Clay', y + h - 20, 21);
  } else if (name === 'lock') {
    icon(ctx, 'lock', cx, cy, 90, th.accent);
  } else if (name === 'endmark') {
    const e = b.data ?? {};
    const k = backOut(clamp01((S.ovT - 0.15) / 0.5));
    if (e.winner === 0) { drawDan(ctx, th, cx - 50, cy + 6, 4, { scale: 2.4 * k }); drawDan(ctx, th, cx + 50, cy + 6, 11, { scale: 2.4 * k }); }
    else for (let i = 0; i < 5; i++) drawDan(ctx, th, cx + (i - 2) * 46, cy + 8 - Math.abs(i - 2) * 6, 3 + i * 5, { scale: 2.1 * k, lift: 4 * Math.sin(S.ovT * 3 + i) });
  }
  ctx.restore();
  void t;
}

// --------------------------------------------------------------------------------------- title
function drawHero(ctx, S, T, th) {
  const h = T.hero, g = ctx.createLinearGradient(0, h.nameY - h.nameSize * 0.85, 0, h.nameY + h.nameSize * 0.2);
  g.addColorStop(0, '#fff3c4'); g.addColorStop(0.5, th.accent); g.addColorStop(1, '#a8782a');
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.65)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 8;
  ctx.font = `800 ${h.nameSize}px ${DISPLAY}`; ctx.textAlign = 'center'; ctx.fillStyle = g;
  ctx.fillText(tr('appName'), h.cx, h.nameY);
  ctx.restore();
  text(ctx, tr('appSub'), h.cx, h.subY, h.subSize, 'rgba(246,236,214,0.9)', { font: DISPLAY, weight: 700 });
  const tg = fitText(tr('tagline'), h.tagW, 40, h.tagSize, 14);
  tg.lines.forEach((ln, i) => text(ctx, ln, h.cx, h.tagY + i * tg.line, tg.size, 'rgba(246,236,214,0.62)', { weight: 500 }));
  drawLockup(ctx, h.lockup.cx, h.lockup.y, h.lockup.w, 0.92, Boolean(S.press && S.press.id === 'af:home' && S.press.active));   // themed Arcforge credit, bottom-centre under the menu
}

function drawTitle(ctx, S, ui) {
  const th = theme(S), L = ui.L, T = ui.title;
  background(ctx, th, S.t, T.board ? T.board.y + 200 : L.h * 0.4, L.w, L.h);
  const M = S.attract;
  if (M && T.board) drawMatchBoard(ctx, S, M, boardGeo(T.board.x, T.board.y, T.board.w), null, { noCounts: false });
  drawHero(ctx, S, T, th);
  drawDocBlocks(ctx, S, ui, S.scroll[ui.scrollKey] ?? 0);
  drawFixed(ctx, S, ui.fixed);
}

function drawLang(ctx, S, ui) {
  const th = theme(S), L = ui.L, T = ui.title;
  background(ctx, th, S.t, T.board ? T.board.y + 200 : L.h * 0.4, L.w, L.h);
  const M = S.attract;
  if (M && T.board) drawMatchBoard(ctx, S, M, boardGeo(T.board.x, T.board.y, T.board.w), null, {});
  drawHero(ctx, S, T, th);
  ctx.fillStyle = 'rgba(8,4,2,0.6)'; rr(ctx, T.panel.x, T.panel.y, T.panel.w, T.panel.h, 26); ctx.fill();
  drawDocBlocks(ctx, S, ui, 0);
}

function drawDocScreen(ctx, S, ui) {
  const th = theme(S), L = ui.L;
  background(ctx, th, S.t, 700, L.w, L.h);
  if (ui.panel) panel(ctx, th, ui.panel.x, ui.panel.y, ui.panel.w, ui.panel.h, {});
  drawDocBlocks(ctx, S, ui, S.scroll[ui.scrollKey] ?? 0);
  drawFixed(ctx, S, ui.fixed);
  if (ui.nav) {
    drawFixed(ctx, S, [ui.nav.prev, ui.nav.next]);
    text(ctx, ui.nav.label, ui.nav.labelX, ui.nav.labelY, 26, 'rgba(246,236,214,0.75)', { weight: 600 });
  }
}

function drawOverlay(ctx, S, ui) {
  const th = theme(S);
  ctx.fillStyle = `rgba(6,4,4,${0.62 * clamp01(S.ovT / 0.25)})`;
  ctx.fillRect(0, 0, ui.L.w, ui.L.h);
  const k = ease(clamp01(S.ovT / 0.3)), pcx = ui.panel.x + ui.panel.w / 2, pcy = ui.panel.y + ui.panel.h / 2;
  ctx.save();
  ctx.translate(pcx, pcy); ctx.scale(0.92 + 0.08 * k, 0.92 + 0.08 * k); ctx.translate(-pcx, -pcy);
  ctx.globalAlpha = k;
  panel(ctx, th, ui.panel.x, ui.panel.y, ui.panel.w, ui.panel.h, {});
  drawDocBlocks(ctx, S, ui, S.scroll[ui.scrollKey] ?? 0);
  drawFixed(ctx, S, ui.fixed);
  ctx.restore();
}

// ------------------------------------------------------------------------------------------ the board in play
const pulse = (S, rate = 5) => 0.5 + 0.5 * Math.sin(S.t * rate);

// o: { auto, legal: bool, zoom }. Draws base, stones (the display state D), flights, the hand, marks and effects.
function drawMatchBoard(ctx, S, M, geo, auto, o = {}) {
  const th = theme(S), D = M.D, A = M.A;
  ctx.save();
  ctx.translate(geo.x, geo.y); ctx.scale(geo.sc, geo.sc);
  drawBoardBase(ctx, th);
  const pl = pulse(S), acc = th.accent;
  const turn = M.st.turn;
  // the player to move: their holes glow softly; the holes that can be played pulse a little
  if (!M.over && !M.auto) for (const i of CIRCUIT[turn]) { fillCell(ctx, i, acc, M.busy ? 0.03 : 0.05 + 0.03 * pl); }
  if (humanTurn(M)) for (const i of CIRCUIT[turn]) if (D.cells[i] > 0) ringCell(ctx, i, acc, 2, 0.28 + 0.18 * pl, 0);
  if (S.kbd && humanTurn(M) && S.scene === 'play') { fillCell(ctx, M.cur, acc, 0.22); ringCell(ctx, M.cur, acc, 5, 0.95, 2); }
  if (M.flash >= 0) fillCell(ctx, M.flash, '#ff6a5a', 0.45 * clamp01(M.flashT / 0.3));
  if (M.capT > 0 && M.capCells) for (const c of M.capCells) ringCell(ctx, c, '#ffe27a', 6, clamp01(M.capT / 0.5), (1 - M.capT / 0.9) * 16);
  if (M.ringT > 0 && M.ringCell >= 0) ringCell(ctx, M.ringCell, '#ffe27a', 6, clamp01(M.ringT / 0.5), (1 - M.ringT / 0.9) * 16);
  drawBoardStones(ctx, th, { cells: D.cells });
  // seeds in flight, then the hand that carries them
  if (A) {
    for (const f of A.flights) {
      if (f.delay > 0) continue;
      const [fx, fy, k] = flightPos(f, S.alpha ?? 1);
      drawDan(ctx, th, fx, fy, f.seed, { lift: 4 * Math.sin(k * Math.PI), scale: f.kind === 'drop' ? 1 : 1 - 0.3 * k });
    }
    if (A.hand && A.hand.n > 0) { const al = S.alpha ?? 1, h = A.hand; drawHand(ctx, th, { ...h, x: h.px === undefined ? h.x : h.px + (h.x - h.px) * al, y: h.py === undefined ? h.y : h.py + (h.y - h.py) * al }, text); }
  }
  if (!o.noCounts) drawBoardMarks(ctx, th, { cells: D.cells, zoom: TEXT_SCALES[S.textIdx] ?? 1 }, text);
  // hints and Watch & Learn: the chosen hole, and the path of its sowing and capture
  if (M.hint && !M.over && !M.busy) { drawPathMarks(ctx, th, play(M.st, M.hint.mv, true).ev); ringCell(ctx, M.hint.mv.cell, acc, 5, 0.6 + 0.4 * pl, 2); }
  if (auto && auto.phase === 'reveal' && auto.plan) {
    for (const c of auto.plan.cells) if (c !== auto.plan.mv.cell) ringCell(ctx, c, 'rgba(160,190,255,0.9)', 3, 0.5 + 0.2 * pl, 0);
    if (!M.busy) drawPathMarks(ctx, th, play(M.st, auto.plan.mv, true).ev);
    ringCell(ctx, auto.plan.mv.cell, acc, 6, 0.8 + 0.2 * pl, 2); fillCell(ctx, auto.plan.mv.cell, acc, 0.25 + 0.15 * pl);
  }
  if (auto && auto.phase === 'think' && auto.scan != null) fillCell(ctx, auto.scan, 'rgba(255,255,255,0.8)', 0.08 + 0.08 * pl);
  // sparks
  for (const q of M.parts) {
    const a = clamp01(q.life / (q.max * 0.6));
    ctx.globalAlpha = a; ctx.fillStyle = q.color;
    if (q.shape === 'ring') { ctx.strokeStyle = q.color; ctx.lineWidth = q.w ?? 4; ctx.beginPath(); ctx.arc(q.x, q.y, q.size, 0, Math.PI * 2); ctx.stroke(); }
    else { ctx.beginPath(); ctx.arc(q.x, q.y, q.size * (0.4 + 0.6 * a), 0, Math.PI * 2); ctx.fill(); }
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

// ------------------------------------------------------------------------------------------ play
function drawHud(ctx, S, title, sub, showPause) {
  const th = theme(S), bar = layoutNow(TEXT_SCALES[S.textIdx]).bar, BACK_BTN = bar.back, PAUSE_BTN = bar.pause;
  button(ctx, th, BACK_BTN, [], 'normal', { pressed: S.press && S.press.id === 'hud:back' && S.press.active });
  icon(ctx, 'back', BACK_BTN.x + BACK_BTN.w / 2, BACK_BTN.y + BACK_BTN.h / 2, 34, th.ink);
  if (showPause) {
    button(ctx, th, PAUSE_BTN, [], 'normal', { pressed: S.press && S.press.id === 'hud:pause' && S.press.active });
    icon(ctx, 'pause', PAUSE_BTN.x + PAUSE_BTN.w / 2, PAUSE_BTN.y + PAUSE_BTN.h / 2, 34, th.ink);
  }
  const z = TEXT_SCALES[S.textIdx], cx = bar.titleX, y0 = BACK_BTN.y;
  const tSize = fitOne(title, bar.titleW, 40 * (1 + (z - 1) * 0.25), 22);
  text(ctx, title, cx, y0 + 36, tSize, th.ink, { font: DISPLAY, weight: 800, shadow: 'rgba(0,0,0,0.6)' });
  const sSize = fitOne(sub, bar.titleW, 24 * (1 + (z - 1) * 0.3), 16);
  text(ctx, sub, cx, y0 + 74, sSize, 'rgba(246,236,214,0.7)', { weight: 500 });
}

// A player's plate: who they are, whether it is their turn, the seeds they have captured and the seeds still in their own holes.
// Wide plates (a full-width row) keep the approved phone look; narrow ones (side cards, tablet pairs) stack the numbers under the name.
const plateVertical = (r) => r.w < 560;
export function plateIcons(r) {
  if (plateVertical(r)) return { dan: [r.x + 38, r.y + r.h * 0.6], own: [r.x + r.w * 0.55, r.y + r.h * 0.6] };
  return { dan: [r.x + r.w - 372, r.y + r.h * 0.38], own: [r.x + r.w - 232, r.y + r.h * 0.38] };
}

function drawPlate(ctx, S, M, r, who, name, sub, active) {
  const th = theme(S), z = TEXT_SCALES[S.textIdx], mt = layoutNow(z).minText, vert = plateVertical(r);
  ctx.save();
  ctx.fillStyle = 'rgba(8,6,6,0.55)'; rr(ctx, r.x, r.y, r.w, r.h, 20); ctx.fill();
  ctx.strokeStyle = active ? th.accent : 'rgba(255,255,255,0.14)'; ctx.lineWidth = active ? 3 : 1.5;
  if (active) { ctx.shadowColor = alpha(th.accent, 0.7); ctx.shadowBlur = 16; }
  rr(ctx, r.x, r.y, r.w, r.h, 20); ctx.stroke();
  ctx.restore();
  const D = M.D;
  const cap = D.pd[who - 1];
  const own = CIRCUIT[who].reduce((a, h) => a + D.cells[h], 0);
  const total = cap + own;
  const ic = plateIcons(r);
  // owner colour tab on the left edge
  ctx.fillStyle = th.own[who - 1]; rr(ctx, r.x + 8, r.y + 14, 7, r.h - 28, 3.5); ctx.fill();
  drawDan(ctx, th, ic.dan[0], ic.dan[1], 5 + who, { scale: 1.3 });
  ctx.strokeStyle = th.own[who - 1]; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(ic.own[0], ic.own[1], 15, 0, Math.PI * 2); ctx.stroke();
  const ns = fitOne('00', 70, 30 * (1 + (z - 1) * 0.45), 16);
  text(ctx, `${cap}`, ic.dan[0] + 24, ic.dan[1] + ns * 0.34, ns, th.ink, { weight: 800, align: 'left' });
  text(ctx, `${own}`, ic.own[0] + 24, ic.own[1] + ns * 0.34, ns, th.ink, { weight: 800, align: 'left' });
  const capW = vert ? Math.max(80, r.w * 0.4) : 130, lMax = 16 * (1 + (z - 1) * 0.4), lMin = Math.min(mt, 14);
  const capY = r.y + r.h - (vert ? 14 : 12);
  text(ctx, tr('pileCap'), ic.dan[0] + 24, capY, fitOne(tr('pileCap'), capW - 10, lMax, lMin), 'rgba(246,236,214,0.6)', { weight: 600, align: 'center' });
  text(ctx, tr('pileBoard'), ic.own[0] + 24, capY, fitOne(tr('pileBoard'), capW - 10, lMax, lMin), 'rgba(246,236,214,0.6)', { weight: 600, align: 'center' });
  const ts = fitOne(`= ${total}`, 100, 34 * (1 + (z - 1) * 0.4), 16);
  if (vert) {
    text(ctx, `= ${total}`, r.x + r.w - 18, r.y + 18 + ts * 0.9, ts, th.accent, { weight: 800, align: 'right' });
    const avail = r.w - 24 - 18 - ts * 2.6;
    const nsz = fitOne(name, avail, 30 * (1 + (z - 1) * 0.4), 16), ssz = fitOne(sub, r.w - 40, 21 * (1 + (z - 1) * 0.4), 14);
    text(ctx, name, r.x + 28, r.y + 16 + nsz * 0.88, nsz, th.ink, { weight: 800, align: 'left', font: DISPLAY });
    text(ctx, sub, r.x + 28, r.y + 16 + nsz + ssz + 4, ssz, active ? th.accent : 'rgba(246,236,214,0.62)', { weight: 600, align: 'left' });
    return;
  }
  text(ctx, `= ${total}`, r.x + r.w - 20, r.y + r.h / 2 + ts * 0.34, ts, th.accent, { weight: 800, align: 'right' });
  const avail = r.w - 380 - 24;
  const nsz = fitOne(name, avail, 30 * (1 + (z - 1) * 0.5), 16);
  const ssz = fitOne(sub, avail, 21 * (1 + (z - 1) * 0.5), 14);
  const tot = nsz + ssz + 8, ty = r.y + (r.h - tot) / 2 + nsz * 0.88;
  text(ctx, name, r.x + 24, ty, nsz, th.ink, { weight: 800, align: 'left', font: DISPLAY });
  text(ctx, sub, r.x + 24, ty + ssz + 8, ssz, active ? th.accent : 'rgba(246,236,214,0.62)', { weight: 600, align: 'left' });
}

function drawStatus(ctx, S, r, head, body, col, box) {
  const th = theme(S), z = TEXT_SCALES[S.textIdx];
  ctx.save();
  ctx.fillStyle = 'rgba(8,6,6,0.6)'; rr(ctx, r.x, r.y, r.w, r.h, 22); ctx.fill();
  ctx.strokeStyle = th.stroke; ctx.lineWidth = 1.5; rr(ctx, r.x, r.y, r.w, r.h, 22); ctx.stroke();
  ctx.restore();
  const b = box ?? { x: r.x, y: r.y, w: r.w, h: r.h };
  const pad = 22, w = b.w - pad * 2;
  const full = body ? `${head}\n${body}` : head;
  const f = fitText(full, w, b.h - 20, 30 * (1 + (z - 1) * 0.6), 16);
  const hl = wrap(head, f.size, w).length;
  const all = body ? [...wrap(head, f.size, w), ...wrap(body, f.size, w)] : wrap(head, f.size, w);
  const total = all.length * f.line;
  let ty = b.y + (b.h - total) / 2 + f.size * 0.95;
  all.forEach((ln, i) => { text(ctx, ln, b.x + b.w / 2, ty, f.size, i < hl ? (col ?? th.accent) : 'rgba(246,236,214,0.92)', { weight: i < hl ? 800 : 500 }); ty += f.line; });
}

// An icon + label button. Tall-and-narrow rectangles stack the icon over the label (the phone toolbar); long ones put them side by side.
function iconButton(ctx, S, r, ic, label, o) {
  const th = theme(S), z = TEXT_SCALES[S.textIdx];
  button(ctx, th, r, [], o.kind ?? 'normal', { disabled: o.off, pressed: o.pressed, radius: 22 });
  const yy = r.y + (o.pressed ? 2 : 0), ink = o.ink ?? th.ink;
  ctx.save();
  if (o.off) ctx.globalAlpha = 0.4;
  if (r.w / r.h >= 2.4) {
    const is = Math.min(44 * (1 + (z - 1) * 0.35), r.h * 0.55), ls = fitOne(label, r.w - is - 56, 26 * (1 + (z - 1) * 0.5), 15), total = is + 14 + tw(label, ls);
    const x0 = r.x + (r.w - total) / 2;
    icon(ctx, ic, x0 + is / 2, yy + r.h / 2, is, ink);
    text(ctx, label, x0 + is + 14, yy + r.h / 2 + ls * 0.34, ls, ink, { weight: 700, align: 'left' });
  } else {
    const is = Math.min(44 * (1 + (z - 1) * 0.35), r.h * 0.42), ls = fitOne(label, r.w - 14, 24 * (1 + (z - 1) * 0.6), 13), total = is + ls + 10;
    icon(ctx, ic, r.x + r.w / 2, yy + (r.h - total) / 2 + is / 2, is, ink);
    text(ctx, label, r.x + r.w / 2, yy + (r.h - total) / 2 + is + 10 + ls * 0.85, ls, ink, { weight: 700 });
  }
  ctx.restore();
}

function drawToolbar(ctx, S, M, lay) {
  const th = theme(S);
  const lesson = Boolean(M.lesson);
  const defs = {
    undo: { icon: 'undo', label: tr('undo'), off: M.over || lesson || !S.canUndo },
    think: { icon: 'hint', label: tr('think'), off: M.over || !humanTurn(M) },
    restart: { icon: 'reset', label: tr('restart'), off: lesson && !M.hist.length },
  };
  TOOLBAR_IDS.forEach((id, i) => {
    const d = defs[id];
    iconButton(ctx, S, lay.tool[i], d.icon, d.label, { off: d.off, kind: id === 'think' ? 'primary' : 'normal', ink: id === 'think' ? th.primaryInk : th.ink, pressed: S.press && S.press.id === `tool:${id}` && S.press.active });
  });
}

function drawAutoBar(ctx, S, auto, b) {
  const th = theme(S), z = TEXT_SCALES[S.textIdx];
  const pr = (id) => S.press && S.press.id === id && S.press.active;
  iconButton(ctx, S, b.slower, 'minus', tr('autoSlower'), { off: S.thinkIdx === 0, pressed: pr('auto:slower') });
  iconButton(ctx, S, b.faster, 'plus', tr('autoFaster'), { off: S.thinkIdx === THINK_STEPS.length - 1, pressed: pr('auto:faster') });
  button(ctx, th, b.pause, [], 'primary', { pressed: pr('auto:pause'), radius: 22 });
  const lab = auto.paused ? tr('autoPlay') : tr('autoPause');
  const is = Math.min(44 * (1 + (z - 1) * 0.3), b.pause.h * 0.5), ps = fitOne(lab, b.pause.w - is - 80, 32 * (1 + (z - 1) * 0.5), 18);
  const total = is + 16 + tw(lab, ps), x0 = b.pause.x + (b.pause.w - total) / 2, cy = b.pause.y + b.pause.h / 2 + (pr('auto:pause') ? 2 : 0);
  icon(ctx, auto.paused ? 'play' : 'pause', x0 + is / 2, cy, is, th.primaryInk);
  text(ctx, lab, x0 + is + 16, cy + ps * 0.35, ps, th.primaryInk, { weight: 800, align: 'left' });
}

const nameOf = (S, M, who) => {
  if (M.auto) return `${levelName(M.autoLv[who - 1])}`;
  if (M.two) return who === 1 ? tr('p1') : tr('p2');
  if (M.lesson && M.lesson.type !== 'game') return who === M.human ? tr('youWord') : tr('oppWord');
  return who === M.human ? tr('youWord') : levelName(M.level);
};

export function playGeo(S) {
  const Lx = layoutNow(TEXT_SCALES[S.textIdx]), lay = S.scene === 'auto' ? Lx.auto : Lx.play;
  return { lay, geo: boardGeo(lay.board.x, lay.board.y, lay.board.w) };
}

const lay0y = (L) => (L.land ? L.h * 0.5 : Math.min(800, L.h * 0.51));
function drawPlay(ctx, S) {
  const th = theme(S), M = S.match, z = TEXT_SCALES[S.textIdx];
  const Lv = layoutNow(z);
  background(ctx, th, S.t, lay0y(Lv), Lv.w, Lv.h);
  const auto = S.scene === 'auto' ? S.auto : null;
  const { lay, geo } = playGeo(S);
  const title = M.lesson ? lessonText(M.lesson.id).title : tr('appName');
  const sub = M.lesson ? tr('lessonOf', { n: S.lessonIdx + 1, m: LESSONS.length }) : auto ? `${tr('autoSession')} · ${tr('think')} ${THINK_STEPS[S.thinkIdx]}${tr('seconds')}` : M.two ? tr('twoPlayers') : `${tr('oppWord')}: ${levelName(M.level)}`;
  drawHud(ctx, S, title, sub, !auto);
  const st = M.st;
  const toMove = M.over || M.busy ? (M.busy ? M.st.turn === 1 ? 2 : 1 : 0) : st.turn;
  // who the plates show at the top: the side that plays the top row is player 2
  const plateSub = (who) => {
    if (M.over) return M.over.winner === who ? tr('winner') : '';
    if (toMove !== who) return M.hist.length ? tr('waiting') : '';
    if (auto) return auto.phase === 'think' ? tr('autoThink') : tr('toMove');
    if (!M.two && !M.lesson && who !== M.human) return M.thinking ? tr('thinking') : tr('toMove');
    return tr('toMove');
  };
  // the top plate is player 2 (top row), the bottom plate is player 1 (bottom row)
  drawPlate(ctx, S, M, lay.chips[0], 2, nameOf(S, M, 2), plateSub(2), toMove === 2 && !M.over);
  drawPlate(ctx, S, M, lay.chips[1], 1, nameOf(S, M, 1), plateSub(1), toMove === 1 && !M.over);
  drawMatchBoard(ctx, S, M, geo, auto, {});
  // status or the direction buttons
  let head = '', body = '', col = null;
  if (M.over) {
    head = S.endInfo ? S.endInfo.head : '';
    body = S.endInfo && !(M.lesson && M.lesson.type === 'game') ? S.endInfo.body : '';
  } else if (auto) {
    if (auto.paused) head = tr('paused');
    else if (auto.phase === 'think') { head = `${tr('autoThink')} ${Math.max(0, Math.ceil(THINK_STEPS[S.thinkIdx] - auto.t))}`; body = tr('turnOf', { who: M.st.turn === 1 ? tr('p1') : tr('p2') }); }
    else if (auto.phase === 'reveal' || auto.phase === 'act') { head = auto.note.head; body = auto.note.why; }
    else if (auto.phase === 'intro') head = tr('appName');
  } else if (S.toast) head = S.toast;
  else if (M.hint) { head = M.hint.head; body = M.hint.why; }
  else if (M.lesson && M.lesson.type !== 'game') { head = lessonText(M.lesson.id).task; }
  else if (M.busy && M.capInfo) { const w = M.capInfo.who; head = (!M.two && !M.lesson && !auto && w === M.human) ? tr('youTook', { n: M.capInfo.n }) : tr('theyTook', { who: nameOf(S, M, w), n: M.capInfo.n }); body = ''; }
  else if (M.busy) { head = tr('sowing'); body = ''; }
  else if (M.thinking) { head = tr('thinking'); body = S.sumText || ''; }
  else if (humanTurn(M)) { head = M.two ? tr('turnOf', { who: st.turn === 1 ? tr('p1') : tr('p2') }) : tr('yourMove'); body = S.sumText || tr('pickHole'); }
  drawStatus(ctx, S, lay.status, head, body, col);
  if (auto && auto.phase === 'think' && !auto.paused) {
    const frac = clamp01(auto.t / THINK_STEPS[S.thinkIdx]);
    ctx.fillStyle = 'rgba(255,255,255,0.14)'; rr(ctx, lay.status.x + 24, lay.status.y + lay.status.h - 16, lay.status.w - 48, 7, 3.5); ctx.fill();
    ctx.fillStyle = th.accent; rr(ctx, lay.status.x + 24, lay.status.y + lay.status.h - 16, (lay.status.w - 48) * frac, 7, 3.5); ctx.fill();
  }
  if (auto) drawAutoBar(ctx, S, auto, lay); else drawToolbar(ctx, S, M, lay);
}

export function render(ctx, S, ui) {
  ctx.textBaseline = 'alphabetic';
  const L = ui.L ?? layoutNow(TEXT_SCALES[S.textIdx]);
  switch (S.scene) {
    case 'lang': drawLang(ctx, S, ui); break;
    case 'title': drawTitle(ctx, S, ui); break;
    case 'setup': case 'learn': case 'howto': case 'rules': case 'about': case 'settings': drawDocScreen(ctx, S, ui); break;
    case 'demo-limit':
      background(ctx, theme(S), S.t, 700, L.w, L.h);
      panel(ctx, theme(S), ui.panel.x, ui.panel.y, ui.panel.w, ui.panel.h, {});
      drawDocBlocks(ctx, S, ui, S.scroll[ui.scrollKey] ?? 0);
      drawFixed(ctx, S, ui.fixed);
      break;
    case 'play': case 'auto':
      if (!S.match) { background(ctx, theme(S), S.t, 700, L.w, L.h); break; }
      drawPlay(ctx, S);
      break;
    default: background(ctx, theme(S), S.t, 700, L.w, L.h);
  }
  if (S.overlay) drawOverlay(ctx, S, ui);
}

export { fromState, scoreOf, moveWords, howtoPages, rulesPages, UI, H };
