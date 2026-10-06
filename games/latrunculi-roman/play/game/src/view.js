// Everything drawn each frame. Reads state, changes nothing. The board never moves: effects are local to a square.
import {
  W, H, setSize, DISPLAY, THEMES, themeById, text, rr, panel, button, background, icon, drawParticles, drawPiece, boardGeo, drawSlab, drawField,
  drawMiniBoard, drawCross, arrow, alpha, clamp01, ease, backOut,
} from './art.js';
import { TEXT_SCALES, wrap, tw, clampScroll } from './ui.js';
import { NN, QUIET_LIMIT, SIDE, DUX, ADJ, startState, applyMove, legalMoves, movesFrom, soldiersOf, countOf, other, parse } from './rules.js';
import { LEVELS } from './ai.js';
import { LESSONS, lessonTitle, lessonTask } from './lessons.js';
import { tr, getRules, soldiersText, sideLabel, lvName, themeShort } from './content.js';
import { SCREEN, TOOLBAR_IDS, host, playFrame, titleFrame } from './layout.js';
import { drawLockup } from './brand.js';
import { THINK_STEPS } from './screens.js';
import { CAP_T, targetsOf, previewMove, humanTurn } from './match.js';

const theme = (S) => themeById(S.themeId);

// Largest text size (<= start) whose wrapped lines fit w x h. Used by every HUD text so zoom never overflows.
// Text never goes below about 11 css pixels: `floor` converts that to virtual units with the host's live scale (main.js sets host.px).
const floor = (min) => Math.max(min, Math.ceil(11 / Math.max(0.3, host.px)));
export function fitText(str, w, h, start, min = 18, lh = 1.28) {
  min = floor(min);
  let size = Math.max(start, min);
  for (; size > min; size -= 2) {
    const lines = wrap(str, size, w);
    if (lines.length * size * lh <= h) return { lines, size, line: size * lh };
  }
  const lines = wrap(str, min, w);
  return { lines, size: min, line: min * lh };
}
const fitOne = (str, w, start, min = 16) => { min = floor(min); let s = Math.max(start, min); while (s > min && tw(str, s) > w) s -= 1; return s; };

// ----------------------------------------------------------------------------------------- documents
function drawDocBlocks(ctx, S, ui, scroll) {
  const th = theme(S);
  const { region, layout } = ui;
  scroll = clampScroll(scroll, layout.height, region.h);
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
        text(ctx, it.lines[i], center ? ox + it.w / 2 : ox, top + i * it.line + it.size * 0.98, it.size, b.dim ? 'rgba(246,236,214,0.5)' : 'rgba(250,240,222,0.94)', { weight: 500, align: center ? 'center' : 'left' });
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

// ----------------------------------------------------------------------------------- illustrations
const cap = (ctx, str, x, y, size = 22, col = 'rgba(246,236,214,0.84)', maxW = 0) => { let s = size; if (maxW) while (s > 11 && tw(str, s) > maxW) s -= 1; text(ctx, str, x, y, s, col, { weight: 600 }); };
const rows = (...r) => r.join('');
const START_CELLS = startState().cells;
// Illustration positions (row 0 is the top).
const P = {
  move: { cells: rows('........', '........', '........', '...X..O.', '........', '........', '........', '........'), dots: [3, 11, 19, 35, 43, 51, 59, 28, 29] },
  capB: rows('........', '........', '........', '.XO..X..', '........', '........', '........', '........'),
  capA: rows('........', '........', '........', '.X.X....', '........', '........', '........', '........'),
  mulB: rows('........', '........', '........', '.XO.OX..', '........', '........', '...X....', '........'),
  mulA: rows('........', '........', '........', '.X.X.X..', '........', '........', '........', '........'),
  between: rows('........', '........', '........', '..O.O...', '........', '........', '...X....', '........'),
  edgeB: rows('..XO.X..', '........', '........', '........', '........', '........', '........', '........'),
  edgeA: rows('..X.X...', '........', '........', '........', '........', '........', '........', '........'),
  cornerB: rows('O.X.....', 'X.......', '........', '........', '........', '........', '........', '........'),
  cornerA: rows('OX......', 'X.......', '........', '........', '........', '........', '........', '........'),
  duxSafe: rows('........', '........', '........', '..XoX...', '........', '........', '........', '........'),
  encB: rows('........', '...X....', '..Xo...X', '...X....', '........', '........', '........', '........'),
  encA: rows('........', '...X....', '..XoX...', '...X....', '........', '........', '........', '........'),
  lone: rows('........', '........', '....o...', '........', '........', '..XX....', '...XXx..', '..XX....'),
  blocked: rows('OoX.....', 'XX......', '........', '........', '........', '........', '........', '.......x'),
  stall: rows('..O.O.O.', 'O.O.O.O.', '..o.....', '........', '........', '.X.X....', 'X.X.X.X.', '.X.x.X.X'),
};

function drawArt(ctx, S, name, x, y, w, h, b) {
  const th = theme(S);
  const cx = x + w / 2, cy = y + h / 2, t = S.t;
  ctx.save();
  ctx.fillStyle = 'rgba(8,8,12,0.5)'; rr(ctx, x, y, w, h, 18); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.14)'; ctx.lineWidth = 1.5; rr(ctx, x, y, w, h, 18); ctx.stroke();
  ctx.beginPath(); rr(ctx, x, y, w, h, 18); ctx.clip();
  const mb = (bx, by, side, cells, o) => drawMiniBoard(ctx, th, bx, by, side, cells, o);
  const one = (side = 320) => Math.min(h - 70, side, w - 40);
  const two = () => Math.min(w * 0.44, h - 90);
  const pair = (a, ao, bb, bo, ca, cb, tone) => {
    const s = two();
    mb(x + 16, y + 16, s, a, ao); mb(x + w - s - 16, y + 16, s, bb, bo);
    arrow(ctx, th.accent, cx - 14, y + 16 + s / 2, cx + 14, y + 16 + s / 2, 4);
    cap(ctx, ca, x + 16 + s / 2, y + h - 22, 19, undefined, s + 8); cap(ctx, cb, x + w - s / 2 - 16, y + h - 22, 19, tone ?? th.accent, s + 8);
  };
  const single = (cells, o, caption, tone) => { const s = one(); mb(cx - s / 2, y + 14, s, cells, o); cap(ctx, caption, cx, y + h - 20, 20, tone ?? 'rgba(246,236,214,0.84)'); };
  if (name === 'logo') {
    const s = Math.min(h - 30, 270);
    mb(cx - s / 2, y + 15, s, START_CELLS, {});
  } else if (name === 'goal') {
    single(START_CELLS, {}, tr('cStart'), th.accent);
  } else if (name === 'board') {
    single(START_CELLS, { hl: [59, 4] }, tr('cStart'), th.accent);
  } else if (name === 'move') {
    single(P.move.cells, { hl: [27], dots: P.move.dots }, tr('cSlide'));
  } else if (name === 'capture') {
    pair(P.capB, { arrows: [[29, 27]], marks: [26] }, P.capA, {}, tr('cSlideIn'), tr('cGone'));
  } else if (name === 'multi') {
    pair(P.mulB, { arrows: [[51, 27]], marks: [26, 28] }, P.mulA, {}, tr('cTwoSand'), tr('cBoth'));
  } else if (name === 'between') {
    single(P.between, { arrows: [[51, 27]] }, tr('cBetween'));
  } else if (name === 'edge') {
    pair(P.edgeB, { arrows: [[5, 4]], marks: [3] }, P.edgeA, {}, tr('cEdge'), tr('cGone'));
  } else if (name === 'corner') {
    pair(P.cornerB, { arrows: [[2, 1]], marks: [0] }, P.cornerA.replace('OX', '.X'), {}, tr('cCornerEx'), tr('cGone'));
  } else if (name === 'dux') {
    single(P.duxSafe, {}, tr('cDuxSafe'), th.accent);
  } else if (name === 'enclose') {
    pair(P.encB, { arrows: [[23, 20]], hl: [19] }, P.encA, { hl: [19] }, tr('cCloseIn'), tr('cEnclose'));
  } else if (name === 'enclose2') {
    const s3 = Math.min((w - 4 * 12) / 3, h - 80);
    const defs = [[rows('........', '........', '...X....', '..XoX...', '...X....', '........', '........', '........'), [27], tr('cCentre')],
      [rows('..XoX...', '...X....', '........', '........', '........', '........', '........', '........'), [3], tr('cEdgeD')],
      [rows('oX......', 'X.......', '........', '........', '........', '........', '........', '........'), [0], tr('cCorner')]];
    defs.forEach(([cells, hl, nm], i) => { const bx = x + 12 + i * (s3 + 12); mb(bx, cy - s3 / 2 - 12, s3, cells, { hl }); cap(ctx, nm, bx + s3 / 2, cy + s3 / 2 + 18, 17); });
  } else if (name === 'lone') {
    single(P.lone, { ring: [20] }, tr('cLone'), th.accent);
  } else if (name === 'blocked') {
    single(P.blocked, { hl: [0, 1] }, tr('cBlocked'), th.accent);
  } else if (name === 'stall') {
    single(P.stall, {}, tr('cStall', { n: QUIET_LIMIT }), th.accent);
  } else if (name === 'reconstruct') {
    const s3 = Math.min((w - 4 * 12) / 3, h - 80);
    const labels = ['7x8', '8x8 (this game)', '10x11'];
    [[7, 8], [8, 8], [10, 11]].forEach(([nr, nc], i) => {
      const bx = x + 12 + i * (s3 + 12), by = cy - s3 / 2 - 12;
      drawSlab(ctx, th, bx, by, s3, { flat: true, thick: s3 * 0.03, border: false });
      const m = s3 * 0.08, cell = (s3 - 2 * m) / Math.max(nr, nc), gw = cell * nc, gh = cell * nr, gx = bx + (s3 - gw) / 2, gy = by + (s3 - gh) / 2;
      ctx.strokeStyle = th.groove; ctx.lineWidth = 1;
      for (let k = 0; k <= nc; k++) { ctx.beginPath(); ctx.moveTo(gx + k * cell, gy); ctx.lineTo(gx + k * cell, gy + gh); ctx.stroke(); }
      for (let k = 0; k <= nr; k++) { ctx.beginPath(); ctx.moveTo(gx, gy + k * cell); ctx.lineTo(gx + gw, gy + k * cell); ctx.stroke(); }
      cap(ctx, labels[i], bx + s3 / 2, cy + s3 / 2 + 18, 17, nr === 8 && nc === 8 ? th.accent : 'rgba(246,236,214,0.84)', s3);
    });
  } else if (name === 'sides') {
    [1, 2].forEach((who, i) => {
      const cw = w / 2 - 44, bx = x + 28 + i * (cw + 32), cardH = h - 36, cyc = y + 18;
      ctx.fillStyle = th.btn[0]; rr(ctx, bx, cyc, cw, cardH, 18); ctx.fill();
      const ss = Math.min(cardH * 0.4, 92);
      drawPiece(ctx, th, who, bx + cw / 2 - ss * 0.55, cyc + cardH * 0.12 + ss * 0.55, ss, {});
      drawPiece(ctx, th, who === 1 ? 3 : 4, bx + cw / 2 + ss * 0.55, cyc + cardH * 0.12 + ss * 0.55, ss * 0.92, {});
      cap(ctx, sideLabel(who), bx + cw / 2, cyc + cardH - Math.min(cardH * 0.34, 62) + 8, Math.min(26, cw / 7), th.ink);
      cap(ctx, who === 1 ? tr('cIvoryFirst') : tr('cJetSecond'), bx + cw / 2, cyc + cardH - 18, Math.min(22, cw / 9), th.accent);
    });
  } else if (name === 'think') {
    const s = Math.min(h - 100, 270);
    const g = mb(cx - s / 2, y + 14, s, P.capB, { marks: [26] });
    const [px, py] = g.centers[29];
    ctx.save(); ctx.strokeStyle = th.accent; ctx.lineWidth = 4; ctx.globalAlpha = 0.6 + 0.4 * Math.sin(t * 4); ctx.beginPath(); ctx.arc(px, py, g.d * 0.62, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    ctx.fillStyle = 'rgba(8,8,12,0.8)'; rr(ctx, x + 30, y + h - 70, w - 60, 48, 24); ctx.fill();
    ctx.strokeStyle = th.stroke; ctx.lineWidth = 1.5; rr(ctx, x + 30, y + h - 70, w - 60, 48, 24); ctx.stroke();
    cap(ctx, tr('cThinkEx'), cx, y + h - 38, 22, th.accent);
  } else if (name === 'levels') {
    LEVELS.forEach((l, i) => {
      const yy = y + 24 + i * ((h - 48) / 5);
      cap(ctx, lvName(l.id), x + 120, yy + 30, 24, th.ink);
      ctx.fillStyle = 'rgba(255,255,255,0.12)'; rr(ctx, x + 250, yy + 12, w - 290, 26, 13); ctx.fill();
      ctx.fillStyle = th.accent; rr(ctx, x + 250, yy + 12, (w - 290) * (0.2 + 0.2 * i), 26, 13); ctx.fill();
    });
  } else if (name === 'learn') {
    [[lessonTitle(LESSONS[0]), true, P.move.cells], [lessonTitle(LESSONS[1]), true, P.capB], [lessonTitle(LESSONS[7]), false, P.encB]].forEach(([nm, done, cells], i) => {
      const yy = y + 20 + i * 112;
      ctx.fillStyle = done ? th.btnOn[0] : th.btn[0]; rr(ctx, x + 24, yy, w - 48, 96, 16); ctx.fill();
      mb(x + 36, yy + 8, 80, cells, { border: false });
      text(ctx, nm, x + 140, yy + 56, 26, th.ink, { weight: 700, align: 'left' });
      if (done) icon(ctx, 'check', x + w - 70, yy + 48, 40, th.ink);
    });
  } else if (name === 'undo') {
    icon(ctx, 'undo', cx - 130, cy - 14, 84, th.accent); icon(ctx, 'reset', cx + 130, cy - 14, 84, th.accent);
    cap(ctx, tr('undo'), cx - 130, cy + 70, 24); cap(ctx, tr('restart'), cx + 130, cy + 70, 24);
  } else if (name === 'auto') {
    ctx.strokeStyle = 'rgba(255,255,255,0.16)'; ctx.lineWidth = 12; ctx.beginPath(); ctx.arc(cx - 150, cy, 46, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = th.accent; ctx.beginPath(); ctx.arc(cx - 150, cy, 46, -Math.PI / 2, -Math.PI / 2 + ((t * 0.4) % 1) * Math.PI * 2); ctx.stroke();
    drawPiece(ctx, th, 1, cx + 10, cy, 92, { glow: 0.5 + 0.5 * Math.sin(t * 5) });
    icon(ctx, 'pause', cx + 150, cy, 52, th.accent);
    cap(ctx, tr('cThinkReveal'), cx, y + h - 18, 22, th.accent);
  } else if (name === 'themes') {
    const s = (w - 4 * 16) / 3;
    THEMES.forEach((tt, i) => {
      const bx = x + 16 + i * (s + 16);
      drawMiniBoard(ctx, tt, bx, cy - s / 2 - 14, s, P.mulB, {});
      cap(ctx, themeShort(tt.id), bx + s / 2, cy + s / 2 + 22, 19);
    });
  } else if (name === 'lock') {
    icon(ctx, 'lock', cx, cy, 90, th.accent);
  } else if (name === 'endmark') {
    const e = b.data ?? {};
    const k = backOut(clamp01((S.ovT - 0.15) / 0.5));
    const ss = Math.min(110, h * 0.72);
    if (e.winner === 1 || e.winner === 2) drawPiece(ctx, th, e.winner === 1 ? 3 : 4, cx, cy + 4, ss, { scale: k, glow: 0.5 + 0.4 * Math.sin(S.ovT * 4) });
    else { drawPiece(ctx, th, 1, cx - ss * 0.75, cy + 4, ss * 0.88, { scale: k }); drawPiece(ctx, th, 2, cx + ss * 0.75, cy + 4, ss * 0.88, { scale: k }); }
  }
  ctx.restore();
}

// --------------------------------------------------------------------------------------------------- title
// The title's attract scene: a short mid-game plays out on a real board from the starting position (the moves are real: a
// capture is made). It loops.
const ATTRACT = [[51, 35], [15, 23], [48, 32], [12, 36], [53, 37]];
const ATTRACT_STEP = 1.45;
const ATTRACT_PLAN = (() => {
  let st = startState();
  const out = [{ st }];
  for (const [f, to] of ATTRACT) {
    const mv = legalMoves(st).find((m) => m.from === f && m.to === to);
    if (!mv) break;
    st = applyMove(st, mv);
    out.push({ st, mv });
  }
  return out;
})();

function drawAttract(ctx, S, A) {
  const th = theme(S), t = S.t;
  const side = 400, bx = (720 - side) / 2, by = 368;
  const steps = ATTRACT_PLAN.length - 1;
  const cycle = steps * ATTRACT_STEP + 1.6;
  const tt = t % cycle;
  const geo = boardGeo(bx, by, side);
  ctx.save();
  ctx.translate(A.x, A.y); ctx.scale(A.s, A.s);
  const glow = ctx.createRadialGradient(360, by + side / 2, 30, 360, by + side / 2, 360);
  glow.addColorStop(0, th.glow); glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow; ctx.fillRect(0, by - 140, 720, side + 280);
  drawSlab(ctx, th, bx, by, side);
  drawField(ctx, th, geo);
  const k = Math.min(steps, Math.floor(tt / ATTRACT_STEP));
  const age = tt - k * ATTRACT_STEP;
  const tail = steps * ATTRACT_STEP + 0.8;
  const fade = (tt > tail ? 1 - clamp01((tt - tail) / 0.7) : 1) * clamp01(tt / 0.4);
  const cur = ATTRACT_PLAN[k].st;
  const cells = cur.cells.slice();
  const next = k < steps ? ATTRACT_PLAN[k + 1] : null;
  let moving = null;
  const ghosts = [];
  if (next && age > 0.25) {
    const mv = next.mv, slideK = clamp01((age - 0.25) / 0.45);
    moving = { mv, k: slideK, piece: cells[mv.from] };
    cells[mv.from] = 0;
    if (slideK >= 0.9) for (const c of next.st.last.captured) { ghosts.push({ cell: c, code: cells[c], k: clamp01((age - 0.25 - 0.4) / CAP_T) }); cells[c] = 0; }
  }
  for (let i = 0; i < NN; i++) {
    if (!cells[i]) continue;
    const [cx, cy] = geo.centers[i];
    drawPiece(ctx, th, cells[i], cx, cy, geo.d, { alpha: fade });
  }
  for (const g of ghosts) { const [cx, cy] = geo.centers[g.cell]; drawPiece(ctx, th, g.code, cx, cy, geo.d, { alpha: fade * (1 - g.k), scale: 1 - 0.4 * g.k, noShadow: true }); }
  if (moving) {
    const [fx, fy] = geo.centers[moving.mv.from], [tx, ty] = geo.centers[moving.mv.to];
    const e = moving.k * moving.k * (3 - 2 * moving.k);
    drawPiece(ctx, th, moving.piece, fx + (tx - fx) * e, fy + (ty - fy) * e, geo.d, { alpha: fade, lift: Math.sin(moving.k * Math.PI) });
  }
  const g = ctx.createLinearGradient(0, 110, 0, 300);
  g.addColorStop(0, light2(th.accent)); g.addColorStop(0.5, th.accent); g.addColorStop(1, '#9a7428');
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.65)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 8;
  ctx.font = `800 104px ${DISPLAY}`; ctx.textAlign = 'center'; ctx.fillStyle = g;
  ctx.fillText(tr('ludus'), 360, 168);
  const lsz = fitOne(tr('latrunculorum'), 660, 84, 40);
  ctx.font = `800 ${lsz}px ${DISPLAY}`;
  ctx.fillText(tr('latrunculorum'), 360, 258);
  ctx.restore();
  text(ctx, tr('tagline'), 360, 304, 28, 'rgba(250,238,214,0.88)', { weight: 600 });
  text(ctx, tr('taglineSub'), 360, 338, 24, 'rgba(250,238,214,0.62)', { weight: 500 });
  ctx.restore();
}
const light2 = (c) => (c.length === 7 ? `rgb(${Math.min(255, parseInt(c.slice(1, 3), 16) + 70)},${Math.min(255, parseInt(c.slice(3, 5), 16) + 70)},${Math.min(255, parseInt(c.slice(5, 7), 16) + 70)})` : '#fff3c4');

function drawTitle(ctx, S, ui) {
  const T = ui.title ?? titleFrame(S.w, S.h);
  background(ctx, theme(S), S.t, T.art.y + 560 * T.art.s, true, T.art.x + 360 * T.art.s);
  drawAttract(ctx, S, T.art);
  drawDocBlocks(ctx, S, ui, S.scroll[ui.scrollKey] ?? 0);
  drawFixed(ctx, S, ui.fixed);
  drawLockup(ctx, T.lock, 0.9, Boolean(S.press && S.press.id === 'af:home' && S.press.active));
}

function drawDocScreen(ctx, S, ui) {
  const th = theme(S);
  background(ctx, th, S.t);
  if (ui.panel) panel(ctx, th, ui.panel.x, ui.panel.y, ui.panel.w, ui.panel.h, {});
  drawDocBlocks(ctx, S, ui, S.scroll[ui.scrollKey] ?? 0);
  drawFixed(ctx, S, ui.fixed);
  if (ui.nav) {
    drawFixed(ctx, S, [ui.nav.prev, ui.nav.next]);
    if (ui.nav.at) text(ctx, ui.nav.label, ui.nav.at.x, ui.nav.at.y, ui.nav.at.size, 'rgba(246,236,214,0.78)', { weight: 600 });
  }
}

function drawOverlay(ctx, S, ui) {
  const th = theme(S);
  ctx.fillStyle = `rgba(6,6,10,${0.62 * clamp01(S.ovT / 0.25)})`;
  ctx.fillRect(0, 0, W, H);
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

// ------------------------------------------------------------------------------------------ pieces in motion
// a = { t, dur, from: [x, y] } (time since the move began). o: { alpha, glow, scale }
export function animPiece(ctx, th, code, x, y, d, a, o = {}) {
  if (!a || !a.from) { drawPiece(ctx, th, code, x, y, d, o); return; }
  const k = clamp01(a.t / a.dur), e = k * k * (3 - 2 * k) * 0.6 + k * 0.4; // gentle ease at both ends, steady in between
  const px = a.from[0] + (x - a.from[0]) * e, py = a.from[1] + (y - a.from[1]) * e;
  drawPiece(ctx, th, code, px, py, d, { ...o, lift: Math.sin(k * Math.PI) * 0.8 });
}

// ------------------------------------------------------------------------------------------ play
function drawHud(ctx, S, L, title, sub, showPause) {
  const th = theme(S), z = TEXT_SCALES[S.textIdx], tb = L.titleBox, cx = tb.x + tb.w / 2;
  if (L.mode === 'stack') {
    if (showPause) {
      button(ctx, th, L.pause, [], 'normal', { pressed: S.press && S.press.id === 'hud:pause' && S.press.active });
      icon(ctx, 'pause', L.pause.x + L.pause.w / 2, L.pause.y + L.pause.h / 2, 34, th.ink);
    }
    const tSize = fitOne(title, tb.w, 38 * (1 + (z - 1) * 0.25), 22);
    text(ctx, title, cx, tb.y + 36, tSize, th.ink, { font: DISPLAY, weight: 800, shadow: 'rgba(0,0,0,0.6)' });
    const sSize = fitOne(sub, tb.w, 24 * (1 + (z - 1) * 0.3), 18);
    text(ctx, sub, cx, tb.y + 74, sSize, 'rgba(250,238,214,0.72)', { weight: 500 });
    return;
  }
  // wide: a header inside the left card (the title may wrap, the line below says who plays and the quiet-move count)
  const tf = fitText(title, tb.w, tb.h * 0.5, 32, 22, 1.15), sf = fitText(sub, tb.w, tb.h * 0.42, 22, 18, 1.2);
  const total = tf.lines.length * tf.line + 4 + sf.lines.length * sf.line, top = tb.y + (tb.h - total) / 2;
  tf.lines.forEach((ln, i) => text(ctx, ln, cx, top + i * tf.line + tf.size * 0.85, tf.size, th.ink, { font: DISPLAY, weight: 800, shadow: 'rgba(0,0,0,0.6)' }));
  const sy = top + tf.lines.length * tf.line + 4;
  sf.lines.forEach((ln, i) => text(ctx, ln, cx, sy + i * sf.line + sf.size * 0.85, sf.size, 'rgba(250,238,214,0.72)', { weight: 500 }));
}

function drawPlate(ctx, S, r, who, name, sub, active) {
  const th = theme(S), z = TEXT_SCALES[S.textIdx];
  ctx.save();
  ctx.fillStyle = 'rgba(8,8,12,0.55)'; rr(ctx, r.x, r.y, r.w, r.h, 20); ctx.fill();
  ctx.strokeStyle = active ? th.accent : 'rgba(255,255,255,0.14)'; ctx.lineWidth = active ? 3 : 1.5;
  if (active) { ctx.shadowColor = alpha(th.accent.length === 7 ? th.accent : '#e8c46a', 0.7); ctx.shadowBlur = 16; }
  rr(ctx, r.x, r.y, r.w, r.h, 20); ctx.stroke();
  ctx.restore();
  const md = Math.min(r.h - 28, 74);
  drawPiece(ctx, th, who, r.x + 14 + md / 2, r.y + r.h / 2, md * 0.8, { noShadow: true, glow: active ? 0.4 : 0 });
  const tx = r.x + 24 + md, avail = r.w - md - 40;
  const ns = fitOne(name, avail, 30 * (1 + (z - 1) * 0.55), 18);
  const sf = fitText(sub || ' ', avail, Math.max(24, r.h - 28 - ns * 1.2), 21 * (1 + (z - 1) * 0.55), 16, 1.2);
  const total = ns + sf.lines.length * sf.line + 6, ty = r.y + (r.h - total) / 2 + ns * 0.88;
  text(ctx, name, tx, ty, ns, th.ink, { weight: 800, align: 'left', font: DISPLAY });
  sf.lines.forEach((ln, i) => text(ctx, ln, tx, ty + 8 + sf.size + i * sf.line, sf.size, active ? th.accent : 'rgba(246,236,214,0.64)', { weight: 600, align: 'left' }));
}

function drawStatus(ctx, S, r, head, body, col) {
  const th = theme(S), z = TEXT_SCALES[S.textIdx];
  ctx.save();
  ctx.fillStyle = 'rgba(8,8,12,0.6)'; rr(ctx, r.x, r.y, r.w, r.h, 22); ctx.fill();
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

const sq = (ctx, geo, i, grow = 0.96) => { const [cx, cy] = geo.centers[i], s = geo.cell * grow; ctx.beginPath(); ctx.rect(cx - s / 2, cy - s / 2, s, s); };

// Draws the board and its pieces for a match. `auto` carries Watch & Learn's reveal info.
function drawBoardScene(ctx, S, M, geo, auto) {
  const th = theme(S);
  ctx.save();
  const glow = ctx.createRadialGradient(geo.x + geo.side / 2, geo.y + geo.side / 2, 40, geo.x + geo.side / 2, geo.y + geo.side / 2, geo.side * 0.85);
  glow.addColorStop(0, th.glow); glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow; ctx.fillRect(geo.x - 160, geo.y - 160, geo.side + 320, geo.side + 320);
  drawSlab(ctx, th, geo.x, geo.y, geo.side);
  drawField(ctx, th, geo);
  const pl = pulse(S);
  const st = M.st;
  const acc = th.accent.length === 7 ? th.accent : '#e8c46a';
  const ring = (i, col, lw = 4, a = 1, grow = 0.92) => { ctx.save(); ctx.strokeStyle = col; ctx.globalAlpha = a; ctx.lineWidth = lw; sq(ctx, geo, i, grow); ctx.stroke(); ctx.restore(); };
  const fillSq = (i, col, a, grow = 0.96) => { ctx.save(); ctx.fillStyle = col; ctx.globalAlpha = a; sq(ctx, geo, i, grow); ctx.fill(); ctx.restore(); };
  // the last move: a soft tint on where it left and where it landed
  if (M.last && !M.over && M.last.to >= 0) {
    fillSq(M.last.to, acc, 0.14 + 0.08 * pl);
    fillSq(M.last.from, acc, 0.08);
  }
  // lesson targets
  if (M.lesson && M.lesson.marks && !M.over) for (const i of M.lesson.marks) { fillSq(i, acc, 0.12 + 0.12 * pl); ring(i, acc, 3, 0.7 + 0.3 * pl, 0.86); }
  // selection, the squares it can reach, and what each move would take
  const selected = M.sel >= 0 ? M.sel : -1;
  const capMarks = [];
  let duxMark = -1;
  if (selected >= 0 && !M.over) {
    fillSq(selected, acc, 0.22 + 0.12 * pl);
    for (const to of targetsOf(M)) {
      const pv = previewMove(M, to);
      const [cx, cy] = geo.centers[to];
      const hit = pv.caps.length || pv.dux;
      if (hit) { fillSq(to, '#ff6a54', 0.2 + 0.1 * pl); ring(to, '#ff8a70', 3, 0.9, 0.9); for (const c of pv.caps) capMarks.push(c); if (pv.dux) duxMark = st.cells.indexOf(DUX[other(st.turn)]); }
      else fillSq(to, acc, 0.07 + 0.05 * pl);
      ctx.fillStyle = hit ? '#ff8a70' : acc; ctx.beginPath(); ctx.arc(cx, cy, geo.cell * 0.09, 0, Math.PI * 2); ctx.fill();
    }
  }
  if (S.kbd && humanTurn(M) && !M.over) ring(M.cur, '#ffffff', 3, 0.75, 0.98);
  if (M.flash >= 0) fillSq(M.flash, '#ff6a5a', 0.4 * clamp01(M.flashT / 0.3));
  // Think
  if (M.hint && !M.over) {
    const mv = M.hint.mv;
    fillSq(mv.to, acc, 0.22 + 0.2 * pl); ring(mv.to, acc, 5, 0.6 + 0.4 * pl);
    ring(mv.from, acc, 4, 0.7); arrow(ctx, acc, ...nudge(geo.centers[mv.from], geo.centers[mv.to], geo.cell * 0.34));
  }
  // Watch & Learn: the best few options, then the chosen move
  if (auto && auto.phase === 'reveal' && auto.plan) {
    const chosen = auto.plan.mv;
    for (const o of auto.plan.options ?? []) ring(o.to, 'rgba(170,200,255,0.9)', 2.5, 0.4 + 0.15 * pl, 0.8);
    fillSq(chosen.to, acc, 0.3 + 0.2 * pl); ring(chosen.to, acc, 5, 0.7 + 0.3 * pl);
    ring(chosen.from, acc, 4, 0.8); arrow(ctx, acc, ...nudge(geo.centers[chosen.from], geo.centers[chosen.to], geo.cell * 0.34));
  }
  if (auto && auto.phase === 'think' && auto.scan != null) fillSq(auto.scan, 'rgba(255,255,255,0.8)', 0.06 + 0.06 * pl);
  // pieces
  const over = M.over;
  const enclosers = over && over.why === 'dux' ? ADJ[M.last.duxAt] : [];
  for (let i = 0; i < NN; i++) {
    const code = st.cells[i];
    if (!code) continue;
    const who = SIDE[code];
    const [cx, cy] = geo.centers[i];
    const a = M.anim[i];
    let o = {};
    if (over && over.winner) {
      if (who === over.winner) o = { glow: 0.45 + 0.35 * Math.sin(M.winT * 6 - (i % 5)) }; else o = { alpha: 0.7 };
      if (enclosers.includes(i)) o = { glow: 0.7 + 0.3 * Math.sin(M.winT * 6) };
    } else if (M.hint && M.hint.mv.from === i) o = { glow: 0.6 };
    else if (selected === i) o = { glow: 0.5 + 0.3 * pl, lift: 0.5 };
    else if (auto && auto.phase === 'reveal' && auto.plan && auto.plan.mv.from === i) o = { glow: 0.5 + 0.4 * pl };
    animPiece(ctx, th, code, cx, cy, geo.d, a ? { ...a, from: a.from >= 0 ? geo.centers[a.from] : null } : null, o);
  }
  for (const c of capMarks) { const [cx, cy] = geo.centers[c]; drawCross(ctx, cx, cy, geo.cell * 0.2); }
  if (duxMark >= 0) { const [cx, cy] = geo.centers[duxMark]; ctx.save(); ctx.strokeStyle = '#ff8a70'; ctx.lineWidth = 4; ctx.globalAlpha = 0.6 + 0.4 * pl; ctx.beginPath(); ctx.arc(cx, cy, geo.d * 0.68, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); }
  // the sandwich that closed: a soft ring on the moving piece and on the piece on the far side of each taken soldier
  if (M.ghosts.length && M.last && M.last.captured && M.last.captured.length) {
    const to = M.last.to;
    const gk = clamp01(1 - (Math.max(...M.ghosts.map((g) => g.t - g.delay)) + 0.2) / (CAP_T + 0.2));
    const rg = (i) => { const [cx, cy] = geo.centers[i]; ctx.save(); ctx.strokeStyle = acc; ctx.lineWidth = 4; ctx.globalAlpha = 0.85 * gk; ctx.beginPath(); ctx.arc(cx, cy, geo.d * 0.62, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); };
    rg(to);
    for (const c of M.last.captured) {
      let partner = -1;
      const beyond = c + (c - to);
      if (beyond >= 0 && beyond < NN && ADJ[c].includes(beyond) && (Math.abs(c - to) === 8 || Math.floor(beyond / 8) === Math.floor(c / 8))) partner = beyond;
      else partner = ADJ[c].find((j) => j !== to && SIDE[st.cells[j]] === SIDE[st.cells[to]]) ?? -1;
      if (partner >= 0) rg(partner);
    }
  }
  // taken soldiers shrink and fade
  for (const g of M.ghosts) {
    const [cx, cy] = geo.centers[g.cell];
    if (g.t < g.delay) drawPiece(ctx, th, g.code, cx, cy, geo.d, {});
    else { const k = clamp01((g.t - g.delay) / CAP_T); drawPiece(ctx, th, g.code, cx, cy, geo.d, { alpha: 1 - k, scale: 1 - 0.4 * k, rot: k * 0.8, noShadow: true }); }
  }
  // the lost dux: a ring closes around it
  if (M.enclose && over && over.why === 'dux') {
    const [cx, cy] = geo.centers[M.enclose.cell];
    const k = clamp01((M.enclose.t - M.enclose.delay) / 0.5);
    ctx.save(); ctx.strokeStyle = '#ff8a70'; ctx.globalAlpha = 0.9 * (1 - 0.3 * k); ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(cx, cy, geo.d * (1.1 - 0.42 * ease(k)), 0, Math.PI * 2); ctx.stroke(); ctx.restore();
  }
  ctx.restore();
  drawParticles(ctx, M.parts);
}
const nudge = (a, b, pad) => {
  const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1;
  return [a[0] + (dx / len) * pad, a[1] + (dy / len) * pad, b[0] - (dx / len) * pad, b[1] - (dy / len) * pad];
};

// One button of the play bar: icon over label on tall buttons, icon beside label on wide or short ones.
function toolButton(ctx, S, r, ic, label, { off = false, kind = 'normal', pressed = false, big = 0 } = {}) {
  const th = theme(S), z = TEXT_SCALES[S.textIdx];
  button(ctx, th, r, [], kind, { disabled: off, pressed, radius: 22 });
  const yy = r.y + (pressed ? 2 : 0), ink = kind === 'primary' ? th.primaryInk : th.ink;
  ctx.save();
  if (off) ctx.globalAlpha = 0.4;
  const horiz = r.h < 100 || r.w > r.h * 1.6 || r.w < 150;
  const is = horiz ? Math.min(40 * (1 + (z - 1) * 0.35), r.h * 0.5, r.w * 0.28) : (44 + big) * (1 + (z - 1) * 0.35);
  if (horiz) {
    const ls = fitOne(label, Math.max(40, r.w - is - 44), (kind === 'primary' ? 30 : 26) * (1 + (z - 1) * 0.5), 18);
    const total = is + 12 + tw(label, ls), x0 = r.x + (r.w - total) / 2;
    icon(ctx, ic, x0 + is / 2, yy + r.h / 2, is, ink);
    text(ctx, label, x0 + is + 12, yy + r.h / 2 + ls * 0.34, ls, ink, { weight: 800, align: 'left' });
  } else {
    const ls = fitOne(label, r.w - 20, 24 * (1 + (z - 1) * 0.6), 18), total = is + ls + 10;
    icon(ctx, ic, r.x + r.w / 2, yy + (r.h - total) / 2 + is / 2, is, ink);
    text(ctx, label, r.x + r.w / 2, yy + (r.h - total) / 2 + is + 10 + ls * 0.85, ls, ink, { weight: 700 });
  }
  ctx.restore();
}

function drawToolbar(ctx, S, M, lay) {
  const lesson = Boolean(M.lesson);
  const defs = {
    undo: { icon: 'undo', label: tr('undo'), off: M.over || lesson || !S.canUndo },
    think: { icon: 'hint', label: tr('think'), off: M.over || lesson || !humanTurn(M) || Boolean(M.hintTask) },
    restart: { icon: 'reset', label: tr('restart'), off: lesson && !M.hist.length },
  };
  TOOLBAR_IDS.forEach((id, i) => {
    const d = defs[id];
    toolButton(ctx, S, lay.tool[i], d.icon, d.label, { off: d.off, kind: id === 'think' ? 'primary' : 'normal', pressed: S.press && S.press.id === `tool:${id}` && S.press.active });
  });
  if (lay.mode === 'wide') toolButton(ctx, S, lay.pause, 'pause', tr('autoPause'), { pressed: S.press && S.press.id === 'hud:pause' && S.press.active });
}

function drawAutoBar(ctx, S, auto, lay) {
  const b = lay.auto, pr = (id) => S.press && S.press.id === id && S.press.active;
  toolButton(ctx, S, b.exit, 'back', tr('autoExit'), { pressed: pr('auto:exit') });
  toolButton(ctx, S, b.slower, 'minus', tr('autoSlower'), { off: S.thinkIdx === 0, pressed: pr('auto:slower') });
  toolButton(ctx, S, b.faster, 'plus', tr('autoFaster'), { off: S.thinkIdx === THINK_STEPS.length - 1, pressed: pr('auto:faster') });
  toolButton(ctx, S, b.pause, auto.paused ? 'play' : 'pause', auto.paused ? tr('autoPlay') : tr('autoPause'), { kind: 'primary', pressed: pr('auto:pause') });
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
    else if (auto.phase === 'think') { head = tr('autoThink', { n: Math.max(0, Math.ceil(THINK_STEPS[S.thinkIdx] - auto.t)) }); body = tr('toMove', { side: sideLabel(st.turn) }); }
    else if (auto.phase === 'reveal' || auto.phase === 'act') { head = auto.note.head; body = auto.note.why; }
    else if (auto.phase === 'intro') head = tr('latrunculorum');
  } else if (S.toast) { head = S.toast; }
  else if (M.hintTask) { head = tr('thinkingDots'); }
  else if (M.hint) { head = M.hint.head; body = M.hint.why; }
  else if (M.lesson) { head = lessonTask(M.lesson); }
  else if (M.thinking) { head = tr('thinkingDots'); }
  else if (humanTurn(M)) {
    const nm = M.two ? sideLabel(st.turn) : '';
    head = M.two ? tr(M.sel >= 0 ? 'targetSide' : 'pickSide', { side: nm }) : tr(M.sel >= 0 ? 'targetYou' : 'pickYou');
  }
  return { head, body };
}

function drawPlay(ctx, S) {
  const th = theme(S), M = S.match, z = TEXT_SCALES[S.textIdx];
  const auto = S.scene === 'auto' ? S.auto : null;
  const lay = playFrame(S.w, S.h, z);
  background(ctx, th, S.t, lay.board.y + lay.board.side / 2, false, lay.board.x + lay.board.side / 2);
  for (const c of lay.cards) { ctx.fillStyle = 'rgba(8,8,12,0.28)'; rr(ctx, c.x, c.y, c.w, c.h, 24); ctx.fill(); ctx.strokeStyle = th.stroke; ctx.globalAlpha = 0.5; ctx.lineWidth = 1.5; rr(ctx, c.x, c.y, c.w, c.h, 24); ctx.stroke(); ctx.globalAlpha = 1; }
  const title = M.lesson ? lessonTitle(M.lesson) : tr('latrunculorum');
  const quiet = !M.lesson ? tr('noCapture', { q: M.st.quiet, m: QUIET_LIMIT }) : '';
  const sub = M.lesson ? tr('lessonOf', { n: S.lessonIdx + 1, m: LESSONS.length }) : auto ? tr('watchSub', { n: THINK_STEPS[S.thinkIdx] }) + quiet : (M.two ? tr('twoPlayers') : tr('vsLevel', { level: lvName(M.level) })) + quiet;
  drawHud(ctx, S, lay, title, sub, !auto);
  const st = M.st;
  const toMove = M.over ? 0 : st.turn;
  const plateSub = (who) => {
    if (M.over) return M.over.winner === who ? tr('winnerWord') : M.over.winner === 0 ? tr('drawWord') : '';
    const n = soldiersOf(st.cells, who), hasDux = st.cells.includes(DUX[who]);
    return hasDux ? `${soldiersText(n)} + ${tr('duxWord')}` : soldiersText(n);
  };
  // the player's own side is drawn first (left) and at the bottom of the board
  const bottomSide = M.flip ? 2 : 1;
  drawPlate(ctx, S, lay.chips[0], bottomSide, nameOf(M, bottomSide), plateSub(bottomSide), toMove === bottomSide);
  drawPlate(ctx, S, lay.chips[1], other(bottomSide), nameOf(M, other(bottomSide)), plateSub(other(bottomSide)), toMove === other(bottomSide));
  const geo = boardGeo(lay.board.x, lay.board.y, lay.board.side, Boolean(M.flip));
  drawBoardScene(ctx, S, M, geo, auto);
  const { head, body } = statusText(S, M, auto);
  drawStatus(ctx, S, lay.status, head, body, null);
  if (auto && auto.phase === 'think' && !auto.paused) {
    const frac = clamp01(auto.t / THINK_STEPS[S.thinkIdx]);
    ctx.fillStyle = 'rgba(255,255,255,0.14)'; rr(ctx, lay.status.x + 24, lay.status.y + lay.status.h - 16, lay.status.w - 48, 7, 3.5); ctx.fill();
    ctx.fillStyle = th.accent; rr(ctx, lay.status.x + 24, lay.status.y + lay.status.h - 16, (lay.status.w - 48) * frac, 7, 3.5); ctx.fill();
  }
  if (auto) drawAutoBar(ctx, S, auto, lay); else drawToolbar(ctx, S, M, lay);
}

export function render(ctx, S, ui) {
  setSize(S.w ?? SCREEN.width, S.h ?? SCREEN.height);
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

export { getRules, H, W, targetsOf, countOf, parse, movesFrom };
