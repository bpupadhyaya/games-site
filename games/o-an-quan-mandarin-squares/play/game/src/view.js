// Everything drawn each frame. Reads state, changes nothing.
import {
  W, H, UI, DISPLAY, THEMES, themeById, text, rr, panel, button, background, icon, alpha, clamp01, ease, backOut,
  BW, BH, CELLS, boardGeo, drawBoardBase, drawBoardStones, drawBoardMarks, drawDan, drawQuan, drawHand, ringCell, fillCell, dirArrow, slotPos,
} from './art.js';
import { TEXT_SCALES, wrap, tw } from './ui.js';
import { SIDE, play, scoreOf, startState } from './engine.js';
import { LEVELS } from './ai.js';
import { LESSONS, lessonText } from './lessons.js';
import { tr, levelName, getLang, howtoPages, rulesPages } from './content.js';
import { BACK_BTN, PAUSE_BTN, TOOLBAR_IDS, autoLayout, DOC_PANEL, NAV_PREV, NAV_NEXT, playLayout, dirLayout, trayStone, trayQuan } from './layout.js';
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
  // a soft fade where more text continues, so a half-cut line never looks like clutter
  if (ui.kind === 'doc' && layout.height > region.h) {
    const col = th.panel[1].replace(/rgba\((\d+),(\d+),(\d+),[^)]+\)/, 'rgba($1,$2,$3,');
    if (layout.height - scroll > region.h + 6) {
      const g = ctx.createLinearGradient(0, region.y + region.h - 70, 0, region.y + region.h + 4);
      g.addColorStop(0, `${col}0)`); g.addColorStop(0.55, `${col}0.92)`); g.addColorStop(1, `${col}1)`);
      ctx.fillStyle = g; ctx.fillRect(region.x - 6, region.y + region.h - 70, region.w + 12, 74);
    }
    if (scroll > 6) {
      const g = ctx.createLinearGradient(0, region.y - 4, 0, region.y + 36);
      g.addColorStop(0, `${col}1)`); g.addColorStop(1, `${col}0)`);
      ctx.fillStyle = g; ctx.fillRect(region.x - 6, region.y - 4, region.w + 12, 40);
    }
  }
  ctx.restore();
  if (layout.height > region.h) {
    const track = region.h - 8, tH = Math.max(48, (region.h / layout.height) * track);
    const ty = region.y + 4 + (scroll / (layout.height - region.h)) * (track - tH);
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    rr(ctx, region.x + region.w + 8, region.y + 4, 6, track, 3); ctx.fill();
    ctx.fillStyle = alpha(th.accent, 0.75);
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

// ----------------------------------------------------------------------------------------- board scene
// view for a static board (illustrations, title): counts from a state.
const viewOf = (st) => ({ cells: st.cells, q: st.q });
const LANE = ['rgba(255,225,140,0.95)', 'rgba(150,215,255,0.95)', 'rgba(255,170,150,0.95)'];

function arcArrow(ctx, a, b, col, lane, bottomRow) {
  const sy = bottomRow ? 1 : -1;
  const ya = a.cy + sy * (52 + lane * 14), yb = b.cy + sy * (52 + lane * 14);
  const xa = a.cx, xb = b.cx;
  const lift = -sy * (30 + Math.abs(xb - xa) * 0.12);
  ctx.save(); ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 6; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(xa, ya); ctx.quadraticCurveTo((xa + xb) / 2, (ya + yb) / 2 + lift, xb, yb); ctx.stroke();
  const ang = Math.atan2(yb - ((ya + yb) / 2 + lift), xb - (xa + xb) / 2);
  ctx.beginPath(); ctx.moveTo(xb + Math.cos(ang) * 9, yb + Math.sin(ang) * 9);
  ctx.lineTo(xb - Math.cos(ang - 0.55) * 18, yb - Math.sin(ang - 0.55) * 18); ctx.lineTo(xb - Math.cos(ang + 0.55) * 18, yb - Math.sin(ang + 0.55) * 18);
  ctx.closePath(); ctx.fill(); ctx.restore();
}

// Explains a real turn on a board: rings the square it starts from, an arrow for each sowing lap and a gold ring where it captures.
function drawPathMarks(ctx, th, ev) {
  let lap = -1, from = -1, last = -1;
  const laps = [];
  for (const e of ev) {
    if (e.t === 'pick') { lap++; from = e.cell; laps[lap] = { from, to: e.cell }; }
    else if (e.t === 'drop' && laps[lap]) laps[lap].to = e.cell;
  }
  laps.forEach((l, i) => {
    if (l.from === l.to) return;
    const a = CELLS[l.from], b = CELLS[l.to];
    arcArrow(ctx, a, b, LANE[i % LANE.length], i % 2, a.cy > BH / 2 || (a.cy === BH / 2 && b.cy > BH / 2));
  });
  laps.forEach((l, i) => ringCell(ctx, l.from, i === 0 ? th.accent : LANE[i % LANE.length], i === 0 ? 5 : 3.5, 0.95, 1));
  for (const e of ev) if (e.t === 'capture') {
    ringCell(ctx, e.cell, '#ffe27a', 6, 1, 3);
    const r = CELLS[e.cell];
    const label = `+${e.dan + (e.quan ? 10 : 0)}`;
    ctx.fillStyle = '#ffe27a'; rr(ctx, r.cx - 34, r.cy - 20, 68, 40, 20); ctx.fill();
    text(ctx, label, r.cx, r.cy + 10, 28, '#3a2108', { weight: 800 });
  }
  void last;
}

function labelCell(ctx, th, i, str, col) {
  const r = CELLS[i];
  text(ctx, str, r.cx, r.top ? r.y + r.h - 12 : r.y + 26, 18, col ?? 'rgba(246,236,214,0.75)', { weight: 700 });
}

// A whole board drawn at geo with a static state; o: { ev, rings, cap, ghost }
function drawStaticBoard(ctx, th, geo, st, o = {}) {
  ctx.save();
  ctx.translate(geo.x, geo.y); ctx.scale(geo.sc, geo.sc);
  drawBoardBase(ctx, th);
  for (const i of o.fills ?? []) fillCell(ctx, i, th.accent, 0.22);
  drawBoardStones(ctx, th, viewOf(st));
  drawBoardMarks(ctx, th, { ...viewOf(st), zoom: 1 }, text);
  if (o.ev) drawPathMarks(ctx, th, o.ev);
  for (const i of o.rings ?? []) ringCell(ctx, i, th.accent, 5, 1, 1);
  if (o.ghost) for (const i of SIDE[1]) { const [x, y] = slotPos(i, 0, false); drawDan(ctx, th, x, y, i * 53, { alpha: 0.5 }); }
  if (o.extra) o.extra(ctx);
  ctx.restore();
}

// ----------------------------------------------------------------------------------- illustrations
const mk = (cells, q = [1, 1], extra = {}) => ({ cells, q, pd: [0, 0], pq: [0, 0], mc: [0, 0], turn: 1, qv: 10, young: true, plies: 0, over: null, ...extra });
const ILLUS = {
  turn: { st: mk([0, 5, 3, 2, 4, 1, 0, 2, 0, 3, 0, 4]), mv: { cell: 2, dir: 1 }, cap: { en: 'square 2 sown to the right: one stone each in 3, 4, 5', vi: 'ô 2 rải sang phải: mỗi ô 3, 4, 5 một viên' } },
  relay: { st: mk([0, 2, 1, 3, 2, 0, 0, 0, 0, 3, 0, 2]), mv: { cell: 1, dir: 1 }, cap: { en: 'the second lap starts from the full square', vi: 'vòng rải thứ hai bắt đầu từ ô đầy' } },
  stop: { st: mk([0, 2, 0, 0, 0, 0, 0, 0, 3, 0, 0, 4]), mv: { cell: 1, dir: 1 }, cap: { en: 'two empty squares in a row: the turn ends', vi: 'hai ô trống liền nhau: lượt kết thúc' } },
  capture: { st: mk([0, 2, 0, 0, 0, 6, 0, 0, 3, 0, 0, 4]), mv: { cell: 1, dir: 1 }, cap: { en: 'jump the empty square and capture the full one', vi: 'nhảy qua ô trống và ăn ô đầy' } },
  chain: { st: mk([6, 3, 0, 2, 0, 4, 0, 1, 0, 0, 4, 0], [1, 1], { turn: 2 }), mv: { cell: 7, dir: 1 }, cap: { en: 'two captures in a row, the second with a mandarin', vi: 'hai lần ăn liên tiếp, lần thứ hai ăn cả quan' } },
  quan: { st: mk([0, 2, 0, 1, 0, 0, 6, 2, 3, 0, 2, 0]), mv: { cell: 3, dir: 1 }, cap: { en: 'the mandarin and its six stones: 16 points', vi: 'quan cùng sáu dân: 16 điểm' } },
  borrow: { st: mk([0, 0, 0, 0, 0, 0, 0, 2, 3, 1, 2, 0]), ghost: true, cap: { en: 'no stones left: five go back, one in each square', vi: 'hết dân: rải lại năm viên, mỗi ô một viên' } },
  end: { st: mk([0, 1, 0, 2, 0, 0, 0, 0, 3, 0, 1, 0], [0, 0]), cap: { en: 'both mandarins taken: the game is over', vi: 'cả hai quan đã bị ăn: ván kết thúc' } },
  board: { st: startState(10, true), cap: { en: 'ten small squares and two mandarin squares', vi: 'mười ô nhỏ và hai ô quan' } },
  setup: { st: startState(10, true), cap: { en: 'five small stones in each square, one mandarin at each end', vi: 'năm dân trong mỗi ô nhỏ, mỗi đầu một quan' } },
};

function drawArt(ctx, S, name, x, y, w, h, b) {
  const th = theme(S), t = S.t, vi = getLang() === 'vi';
  const cx = x + w / 2, cy = y + h / 2;
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
    board(IL.st, { ev, ghost: IL.ghost });
    cap(IL.cap[vi ? 'vi' : 'en'], y + h - 22, 22);
  } else if (name === 'logo') {
    const bw = Math.min(w - 40, 380);
    drawStaticBoard(ctx, th, boardGeo(cx - bw / 2, y + 16, bw), startState(10, true), {});
    text(ctx, 'Ô Ăn Quan', cx, y + h - 22, 46, th.accent, { font: DISPLAY, weight: 800 });
  } else if (name === 'tap') {
    const st = mk([0, 5, 3, 2, 4, 1, 0, 2, 0, 3, 0, 4]);
    const bw = Math.min(w - 36, (h - 150) * BW / BH);
    const geo = boardGeo(cx - bw / 2, y + 14, bw);
    drawStaticBoard(ctx, th, geo, st, { fills: [2], rings: [2], extra: (c) => { dirArrow(c, th.accent, 2, -1, 0.9); dirArrow(c, th.accent, 2, 1, 0.9); } });
    const by = y + 30 + geo.h, bwid = (w - 60) / 2;
    for (let i = 0; i < 2; i++) { const r = { x: x + 20 + i * (bwid + 20), y: by, w: bwid, h: 70 }; button(ctx, th, r, [i ? tr('dirRight') : tr('dirLeft')], 'primary', { size: 24 }); }
    cap(vi ? 'chạm một ô, rồi chọn hướng (hoặc vuốt)' : 'tap a square, then a direction (or swipe)', y + h - 16, 20);
  } else if (name === 'think') {
    const st = mk([0, 2, 0, 0, 0, 6, 0, 0, 3, 0, 0, 4]);
    const bw = Math.min(w - 36, (h - 120) * BW / BH);
    const geo = boardGeo(cx - bw / 2, y + 14, bw);
    drawStaticBoard(ctx, th, geo, st, { rings: [1], extra: (c) => dirArrow(c, th.accent, 1, 1, 1) });
    ctx.fillStyle = 'rgba(10,6,4,0.85)'; rr(ctx, x + 30, y + h - 82, w - 60, 62, 30); ctx.fill();
    ctx.strokeStyle = th.stroke; ctx.lineWidth = 1.5; rr(ctx, x + 30, y + h - 82, w - 60, 62, 30); ctx.stroke();
    cap(vi ? 'Ăn được 6 điểm. Đối thủ đáp lại được 0.' : 'Captures 6 points. The opponent answers with 0.', y + h - 44, 22, th.accent);
  } else if (name === 'options') {
    const half = (w - 60) / 2;
    [[10, true], [5, false]].forEach(([v, young], i) => {
      const px = x + 20 + i * (half + 20);
      ctx.fillStyle = th.btn[0]; rr(ctx, px, y + 24, half, h - 90, 18); ctx.fill();
      drawQuan(ctx, th, px + half / 2, y + 24 + (h - 90) * 0.4, { scale: 1.3 });
      text(ctx, vi ? `${v} điểm` : `${v} points`, px + half / 2, y + 24 + (h - 90) * 0.78, 34, th.ink, { weight: 800, font: DISPLAY });
      void young;
    });
    cap(vi ? 'giá trị quan: 10 (mặc định) hoặc 5' : 'mandarin value: 10 (default) or 5', y + h - 22, 22);
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
    THEMES.forEach((tt, i) => { const geo = boardGeo(x + 20 + i * (bw + 20), cy - bw * BH / BW / 2 - 8, bw); drawStaticBoard(ctx, tt, geo, startState(10, true), {}); });
    cap(vi ? 'Sơn mài và vàng  ·  Tre và ngọc' : 'Lacquer & Gold  ·  Bamboo & Jade', y + h - 20, 21);
  } else if (name === 'lock') {
    icon(ctx, 'lock', cx, cy, 90, th.accent);
  } else if (name === 'endmark') {
    const e = b.data ?? {};
    const k = backOut(clamp01((S.ovT - 0.15) / 0.5));
    if (e.winner === 0) { drawDan(ctx, th, cx - 50, cy + 6, 4, { scale: 2.4 * k }); drawDan(ctx, th, cx + 50, cy + 6, 11, { scale: 2.4 * k }); }
    else drawQuan(ctx, th, cx, cy + 6, { scale: 1.6 * k, glow: 0.5 + 0.4 * Math.sin(S.ovT * 4) });
  }
  ctx.restore();
}

// --------------------------------------------------------------------------------------- title
function drawTitle(ctx, S, ui) {
  const th = theme(S);
  background(ctx, th, S.t, 560);
  const M = S.attract;
  if (M) {
    const geo = boardGeo(60, 366, 600);
    drawMatchBoard(ctx, S, M, geo, null, { noCounts: false });
  }
  const g = ctx.createLinearGradient(0, 110, 0, 250);
  g.addColorStop(0, '#fff3c4'); g.addColorStop(0.5, th.accent); g.addColorStop(1, '#a8782a');
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.65)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 8;
  ctx.font = `800 ${tw('Ô Ăn Quan', 120) > 640 ? 96 : 118}px ${DISPLAY}`; ctx.textAlign = 'center'; ctx.fillStyle = g;
  ctx.fillText('Ô Ăn Quan', 360, 200);
  ctx.restore();
  text(ctx, getLang() === 'vi' ? 'Ô Quan' : 'Mandarin Squares', 360, 262, 38, 'rgba(246,236,214,0.9)', { font: DISPLAY, weight: 700 });
  const tg = fitText(tr("tagline"), 660, 40, 24, 14);
  tg.lines.forEach((ln, i) => text(ctx, ln, 360, 300 + i * tg.line, tg.size, 'rgba(246,236,214,0.62)', { weight: 500 }));
  drawDocBlocks(ctx, S, ui, S.scroll[ui.scrollKey] ?? 0);
  drawFixed(ctx, S, ui.fixed);
}

function drawLang(ctx, S, ui) {
  const th = theme(S);
  background(ctx, th, S.t, 560);
  const M = S.attract;
  if (M) drawMatchBoard(ctx, S, M, boardGeo(60, 366, 600), null, {});
  const g = ctx.createLinearGradient(0, 110, 0, 250);
  g.addColorStop(0, '#fff3c4'); g.addColorStop(0.5, th.accent); g.addColorStop(1, '#a8782a');
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.65)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 8;
  ctx.font = `800 118px ${DISPLAY}`; ctx.textAlign = 'center'; ctx.fillStyle = g; ctx.fillText('Ô Ăn Quan', 360, 200); ctx.restore();
  ctx.fillStyle = 'rgba(8,4,2,0.6)'; rr(ctx, 24, 730, 672, 700, 26); ctx.fill();
  drawDocBlocks(ctx, S, ui, 0);
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

// ------------------------------------------------------------------------------------------ the board in play
const pulse = (S, rate = 5) => 0.5 + 0.5 * Math.sin(S.t * rate);
const screenDx = (cell, dir) => (cell >= 1 && cell <= 5 ? dir : -dir);

// o: { auto, legal: bool, zoom }. Draws base, stones (the display state D), flights, the hand, marks and effects.
function drawMatchBoard(ctx, S, M, geo, auto, o = {}) {
  const th = theme(S), D = M.D, A = M.A;
  ctx.save();
  ctx.translate(geo.x, geo.y); ctx.scale(geo.sc, geo.sc);
  drawBoardBase(ctx, th);
  const pl = pulse(S), acc = th.accent;
  const turn = M.st.turn;
  const mine = !M.over && !M.busy && (M.two || M.auto ? true : turn === M.human);
  // the active row glows softly; legal squares pulse a little
  if (!M.over && !M.auto) for (const i of SIDE[turn]) { fillCell(ctx, i, acc, M.busy ? 0.04 : 0.06 + 0.04 * pl); }
  if (humanTurn(M)) for (const i of SIDE[turn]) if (D.cells[i] > 0 && M.sel !== i) ringCell(ctx, i, acc, 2, 0.28 + 0.18 * pl, 0);
  if (M.sel >= 0) { fillCell(ctx, M.sel, acc, 0.25 + 0.1 * pl); ringCell(ctx, M.sel, acc, 5, 0.95, 1); }
  if (M.flash >= 0) fillCell(ctx, M.flash, '#ff6a5a', 0.45 * clamp01(M.flashT / 0.3));
  if (M.ringT > 0 && M.ringCell >= 0) ringCell(ctx, M.ringCell, '#ffe27a', 6, clamp01(M.ringT / 0.5), (1 - M.ringT / 0.9) * 16);
  drawBoardStones(ctx, th, { cells: D.cells, q: D.q, bounce: M.bounce, quanGlow: M.ringT > 0 ? 0.6 : 0 });
  // stones in flight, then the hand that carries them
  if (A) {
    for (const f of A.flights) {
      if (f.delay > 0) continue;
      const [fx, fy, k] = flightPos(f, S.alpha ?? 1);
      if (f.big) drawQuan(ctx, th, fx, fy, { lift: 6, scale: 1 - 0.18 * k });
      else drawDan(ctx, th, fx, fy, f.seed, { lift: 4 * Math.sin(k * Math.PI), scale: f.kind === 'drop' ? 1 : 1 - 0.3 * k });
    }
    if (A.hand && A.hand.n > 0) { const al = S.alpha ?? 1, h = A.hand; drawHand(ctx, th, { ...h, x: h.px === undefined ? h.x : h.px + (h.x - h.px) * al, y: h.py === undefined ? h.y : h.py + (h.y - h.py) * al }, text); }
  }
  if (!o.noCounts) drawBoardMarks(ctx, th, { cells: D.cells, q: D.q, zoom: TEXT_SCALES[S.textIdx] ?? 1 }, text);
  // hints and Watch & Learn
  const arrow = (mv, a = 1, col = acc) => dirArrow(ctx, col, mv.cell, screenDx(mv.cell, mv.dir), a);
  if (M.hint && !M.over) { ringCell(ctx, M.hint.mv.cell, acc, 5, 0.6 + 0.4 * pl, 2); arrow(M.hint.mv, 0.7 + 0.3 * pl); }
  if (M.sel >= 0 && humanTurn(M)) {
    const l = S.press && S.press.id === 'dir:-1' && S.press.active, r = S.press && S.press.id === 'dir:1' && S.press.active;
    dirArrow(ctx, acc, M.sel, -1, l ? 1 : 0.55); dirArrow(ctx, acc, M.sel, 1, r ? 1 : 0.55);
  }
  if (auto && auto.phase === 'reveal' && auto.plan) {
    for (const c of auto.plan.cells) if (c !== auto.plan.mv.cell) ringCell(ctx, c, 'rgba(160,190,255,0.9)', 3, 0.5 + 0.2 * pl, 0);
    ringCell(ctx, auto.plan.mv.cell, acc, 6, 0.8 + 0.2 * pl, 2); fillCell(ctx, auto.plan.mv.cell, acc, 0.25 + 0.15 * pl);
    arrow(auto.plan.mv, 1);
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
  void mine;
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

// A player's plate: who they are, whether it is their turn and the pile they have captured.
export function plateIcons(r) { return { dan: [r.x + r.w - 350, r.y + r.h / 2], quan: [r.x + r.w - 210, r.y + r.h / 2] }; }

function drawPlate(ctx, S, M, r, who, name, sub, active) {
  const th = theme(S), z = TEXT_SCALES[S.textIdx];
  ctx.save();
  ctx.fillStyle = 'rgba(8,6,6,0.55)'; rr(ctx, r.x, r.y, r.w, r.h, 20); ctx.fill();
  ctx.strokeStyle = active ? th.accent : 'rgba(255,255,255,0.14)'; ctx.lineWidth = active ? 3 : 1.5;
  if (active) { ctx.shadowColor = alpha(th.accent, 0.7); ctx.shadowBlur = 16; }
  rr(ctx, r.x, r.y, r.w, r.h, 20); ctx.stroke();
  ctx.restore();
  const D = M.D, st = M.st;
  const dan = D.pd[who - 1], quan = D.pq[who - 1];
  const total = dan + st.qv * quan;
  const ic = plateIcons(r);
  // the pile: small stone count, mandarin count and the total
  drawDan(ctx, th, ic.dan[0], ic.dan[1], 5 + who, { scale: 1.35 });
  drawQuan(ctx, th, ic.quan[0], ic.quan[1], { scale: 0.62 });
  const ns = fitOne(String(dan), 70, 30 * (1 + (z - 1) * 0.45), 16);
  text(ctx, `${dan}`, ic.dan[0] + 26, ic.dan[1] + ns * 0.34, ns, th.ink, { weight: 800, align: 'left' });
  text(ctx, `${quan}`, ic.quan[0] + 26, ic.quan[1] + ns * 0.34, ns, th.ink, { weight: 800, align: 'left' });
  const ts = fitOne(`= ${total}`, 100, 34 * (1 + (z - 1) * 0.4), 16);
  text(ctx, `= ${total}`, r.x + r.w - 20, r.y + r.h / 2 + ts * 0.34, ts, th.accent, { weight: 800, align: 'right' });
  const avail = r.w - 380 - 24;
  const nsz = fitOne(name, avail, 30 * (1 + (z - 1) * 0.5), 16);
  const ssz = fitOne(sub, avail, 21 * (1 + (z - 1) * 0.5), 14);
  const tot = nsz + ssz + 8, ty = r.y + (r.h - tot) / 2 + nsz * 0.88;
  text(ctx, name, r.x + 24, ty, nsz, th.ink, { weight: 800, align: 'left', font: DISPLAY });
  text(ctx, sub, r.x + 24, ty + ssz + 8, ssz, active ? th.accent : 'rgba(246,236,214,0.62)', { weight: 600, align: 'left' });
}

// The capture tray: every stone a player has won lies in a loose heap, the mandarins at the left.
function drawTray(ctx, S, M, r, who) {
  const th = theme(S), D = M.D;
  ctx.save();
  const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
  g.addColorStop(0, th.pit[0]); g.addColorStop(1, th.pit[1]);
  ctx.fillStyle = g; rr(ctx, r.x, r.y, r.w, r.h, 26); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 2; rr(ctx, r.x, r.y, r.w, r.h, 26); ctx.stroke();
  ctx.strokeStyle = th.pitRim; ctx.lineWidth = 1.5; rr(ctx, r.x + 1, r.y + 3, r.w - 2, r.h - 2, 26); ctx.stroke();
  ctx.save(); rr(ctx, r.x, r.y, r.w, r.h, 26); ctx.clip();
  const sg = ctx.createLinearGradient(0, r.y, 0, r.y + 24); sg.addColorStop(0, 'rgba(0,0,0,0.5)'); sg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = sg; ctx.fillRect(r.x, r.y, r.w, 24); ctx.restore();
  ctx.strokeStyle = th.inlay; ctx.globalAlpha = 0.5; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(r.x + 118, r.y + 14); ctx.lineTo(r.x + 118, r.y + r.h - 14); ctx.stroke(); ctx.globalAlpha = 1;
  for (let k = 0; k < Math.min(2, D.pq[who - 1]); k++) { const [qx, qy] = trayQuan(r, k); drawQuan(ctx, th, qx, qy, { scale: 0.78 }); }
  const n = Math.min(60, Math.max(0, D.pd[who - 1]));
  for (let k = 0; k < n; k++) { const [sx, sy] = trayStone(r, k); drawDan(ctx, th, sx, sy, 700 + who * 100 + k, { scale: 0.78 }); }
  ctx.restore();
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

function drawDirButtons(ctx, S, lay) {
  const th = theme(S), z = TEXT_SCALES[S.textIdx];
  const d = dirLayout(lay.status, z);
  [['dir:-1', d.left, tr('dirLeft'), false], ['dir:1', d.right, tr('dirRight'), true]].forEach(([id, r, label, right]) => {
    const pressed = S.press && S.press.id === id && S.press.active;
    button(ctx, th, r, [], 'primary', { pressed, radius: 22 });
    const yy = r.y + (pressed ? 2 : 0), is = 40 * (1 + (z - 1) * 0.3);
    const ls = fitOne(label, r.w - is - 56, 28 * (1 + (z - 1) * 0.5), 14);
    ctx.save(); ctx.translate(right ? r.x + r.w - 36 : r.x + 36, yy + r.h / 2); if (right) ctx.scale(-1, 1);
    icon(ctx, 'back', 0, 0, is, th.primaryInk); ctx.restore();
    text(ctx, label, r.x + r.w / 2 + (right ? -14 : 14), yy + r.h / 2 + ls * 0.34, ls, th.primaryInk, { weight: 800 });
  });
}

const nameOf = (S, M, who) => {
  if (M.auto) return `${levelName(M.autoLv[who - 1])}`;
  if (M.two) return who === 1 ? tr('p1') : tr('p2');
  if (M.lesson && M.lesson.type !== 'game') return who === M.human ? tr('youWord') : tr('oppWord');
  return who === M.human ? tr('youWord') : levelName(M.level);
};

export function playGeo(S) {
  const lay = playLayout(TEXT_SCALES[S.textIdx]);
  return { lay, geo: boardGeo(lay.board.x, lay.board.y, lay.board.w) };
}

function drawPlay(ctx, S) {
  const th = theme(S), M = S.match, z = TEXT_SCALES[S.textIdx];
  background(ctx, th, S.t, 800);
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
  if (lay.trays[0]) { drawTray(ctx, S, M, lay.trays[0], 2); drawTray(ctx, S, M, lay.trays[1], 1); }
  // status or the direction buttons
  const choosing = !auto && humanTurn(M) && M.sel >= 0;
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
  else if (M.busy) { head = tr('sowing'); body = ''; }
  else if (M.thinking) { head = tr('thinking'); body = S.sumText || ''; }
  else if (humanTurn(M)) { head = M.sel >= 0 ? tr('pickDir') : (M.two ? tr('turnOf', { who: st.turn === 1 ? tr('p1') : tr('p2') }) : tr('yourMove')); body = M.sel >= 0 ? '' : (S.sumText || tr('pickSquare')); }
  if (choosing) {
    const d = dirLayout(lay.status, z);
    drawStatus(ctx, S, lay.status, tr('pickDir'), '', null, { x: lay.status.x, y: lay.status.y, w: lay.status.w, h: d.textH });
    drawDirButtons(ctx, S, lay);
  } else drawStatus(ctx, S, lay.status, head, body, col);
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
    case 'lang': drawLang(ctx, S, ui); break;
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

export { fromState, scoreOf, moveWords, howtoPages, rulesPages, UI, H };
