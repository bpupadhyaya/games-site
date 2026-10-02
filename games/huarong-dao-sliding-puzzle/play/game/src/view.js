// Everything drawn each frame. Reads state, changes nothing.
import {
  W, H, UI, DISPLAY, CARVE, GOLD, GOLD_HI, GOLD_LO, PAPER, text, rr, panel, button, background, star, drawBlock, setBlockLang, icon, drawParticles, alpha, light, dark, blockColors,
} from './art.js';
import { parseLayout, reachable, applyMove, DIMS } from './engine.js';
import { rectOf, nameBlocks, movesFor } from './puzzle.js';
import { LEVELS, HDLM_MOVES } from './levels.js';
import { tr, RULES } from './content.js';
import { TEXT_SCALES } from './ui.js';
import {
  BACK_BTN, PAUSE_BTN, TOOLBAR_IDS, toolRect, AUTO_BTNS, DOC_PANEL, NAV_PREV, NAV_NEXT, CELL, BOARD_ORIGIN, BOARD_PX, FRAME, GATE_PX, STATS, BANNER_Y,
} from './layout.js';
import { levelName, THINK_STEPS, chapterUnlocked } from './screens.js';
import { CHAPTERS } from './content.js';

const ease = (t) => 1 - (1 - t) ** 3;
const smooth = (t) => t * t * (3 - 2 * t);
const backOut = (t) => { const c = 1.7; return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2; };
const clamp01 = (v) => Math.max(0, Math.min(1, v));

// cached, named block sets for miniature boards
const cache = new Map();
function blocksOf(rows) {
  const key = rows.join('/');
  if (!cache.has(key)) {
    const pieces = parseLayout(rows);
    const names = nameBlocks(pieces);
    cache.set(key, pieces.map((p) => ({ ...p, name: p.t === 'C' ? { zh: '曹操', en: 'Cao Cao' } : p.t === 'S' ? { zh: '卒', en: 'Soldier' } : names.get(p.id) })));
  }
  return cache.get(key);
}

// A whole board drawn small: x,y is the top-left of the playing area, k the scale against CELL.
function miniBoard(ctx, rows, x, y, k, o = {}) {
  const pieces = o.pieces ?? blocksOf(rows);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(k, k);
  ctx.fillStyle = 'rgba(8,2,2,0.6)';
  rr(ctx, -12, -12, CELL * 4 + 24, CELL * 5 + 24, 26); ctx.fill();
  ctx.strokeStyle = 'rgba(228,189,104,0.55)'; ctx.lineWidth = 5; rr(ctx, -12, -12, CELL * 4 + 24, CELL * 5 + 24, 26); ctx.stroke();
  if (o.gate !== false) {
    ctx.strokeStyle = 'rgba(228,189,104,0.7)'; ctx.setLineDash([16, 12]); ctx.lineWidth = 5;
    rr(ctx, CELL + 6, CELL * 3 + 6, CELL * 2 - 12, CELL * 2 - 12, 16); ctx.stroke(); ctx.setLineDash([]);
  }
  for (const p of pieces) {
    if (o.skip && o.skip.has(p.id)) continue;
    const [w, h] = DIMS[p.t];
    const px = p.dx ?? p.x, py = p.dy ?? p.y;
    drawBlock(ctx, { x: px * CELL, y: py * CELL, w: w * CELL, h: h * CELL }, p, { glow: o.glow?.has(p.id) ? 0.9 : 0, lift: o.lift?.has(p.id) ? 0.5 : 0 });
  }
  ctx.restore();
}

// ----------------------------------------------------------------------------------------- documents
function drawDocBlocks(ctx, S, ui, scroll) {
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
      for (let i = 0; i < it.lines.length; i++) text(ctx, it.lines[i], ox + it.w / 2, top + i * it.line + it.size, it.size, GOLD, { font: DISPLAY, weight: 800 });
    } else if (b.t === 'p') {
      const center = b.center || b.align === 'center';
      for (let i = 0; i < it.lines.length; i++) {
        text(ctx, it.lines[i], center ? ox + it.w / 2 : ox, top + i * it.line + it.size * 0.98, it.size, 'rgba(246,234,210,0.93)', { weight: 500, align: center ? 'center' : 'left' });
      }
    } else if (b.t === 'img') {
      drawArt(ctx, b.name, ox, top, it.w, b.h, S, b);
    } else if (b.t === 'btn') {
      const bt = it.btns[0];
      button(ctx, { x: ox + bt.x, y: oy + bt.y, w: bt.w, h: bt.h }, it.lines, b.kind ?? 'normal', { size: it.size, line: it.line, sub: it.sub, disabled: bt.disabled, pressed: S.press && S.press.id === bt.id && S.press.active });
    } else if (b.t === 'row') {
      for (const bt of it.btns) {
        if (bt.id == null) {
          text(ctx, bt.label, ox + bt.x + bt.w / 2, oy + bt.y + bt.h / 2 + it.size * 0.34, it.size, PAPER, { weight: 700 });
        } else {
          button(ctx, { x: ox + bt.x, y: oy + bt.y, w: bt.w, h: bt.h }, bt.lines, bt.kind ?? 'normal', { size: it.size, line: it.line, disabled: bt.disabled, pressed: S.press && S.press.id === bt.id && S.press.active });
        }
      }
    } else if (b.t === 'grid') {
      for (const bt of it.btns) drawLevelCell(ctx, S, { x: ox + bt.x, y: oy + bt.y, w: bt.w, h: bt.h }, bt.cell, S.press && S.press.id === bt.id && S.press.active);
    }
  }
  ctx.restore();
  if (layout.height > region.h) {
    const track = region.h - 8, th = Math.max(48, (region.h / layout.height) * track);
    const ty = region.y + 4 + (scroll / (layout.height - region.h)) * (track - th);
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    rr(ctx, region.x + region.w + 8, region.y + 4, 6, track, 3); ctx.fill();
    ctx.fillStyle = 'rgba(228,189,104,0.75)';
    rr(ctx, region.x + region.w + 8, ty, 6, th, 3); ctx.fill();
  }
}

function drawFixed(ctx, S, list) {
  for (const f of list) {
    if (f.static) { text(ctx, f.label, f.rect.x + f.rect.w / 2, f.rect.y + f.rect.h / 2 + 10, f.size, 'rgba(246,234,210,0.8)', { weight: 700 }); continue; }
    const pressed = S.press && S.press.id === f.id && S.press.active;
    if (f.icon) {
      button(ctx, f.rect, [], f.kind, { disabled: f.disabled, pressed });
      icon(ctx, f.icon, f.rect.x + 36, f.rect.y + f.rect.h / 2 + (pressed ? 3 : 0), 30);
      text(ctx, f.label, f.rect.x + 62 + (f.rect.w - 72) / 2, f.rect.y + f.rect.h / 2 + f.size * 0.34 + (pressed ? 3 : 0), f.size, PAPER, { weight: 700 });
    } else button(ctx, f.rect, f.lines ?? [f.label], f.kind, { size: f.size, line: f.line, disabled: f.disabled, pressed });
  }
}

function drawLevelCell(ctx, S, r, c, pressed) {
  const y = r.y + (pressed ? 3 : 0);
  const z = TEXT_SCALES[S.textIdx] ?? 1; // labels follow the text-size setting
  ctx.save();
  if (c.state === 'locked') ctx.globalAlpha = 0.55;
  ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 4;
  const g = ctx.createLinearGradient(0, y, 0, y + r.h);
  if (c.state === 'solved') { g.addColorStop(0, '#5a2420'); g.addColorStop(1, '#3a1514'); } else { g.addColorStop(0, '#431918'); g.addColorStop(1, '#2d1010'); }
  ctx.fillStyle = g; rr(ctx, r.x, y, r.w, r.h, 16); ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = c.state === 'solved' ? 'rgba(228,189,104,0.85)' : 'rgba(228,189,104,0.38)'; ctx.lineWidth = 2;
  rr(ctx, r.x, y, r.w, r.h, 16); ctx.stroke();
  const lab = Math.min(22 * (1 + (z - 1) * 0.5), r.w / 5);
  if (c.state === 'locked') {
    icon(ctx, 'lock', r.x + r.w / 2, y + r.h / 2 - 6, Math.min(44, r.w * 0.34), 'rgba(246,234,210,0.7)');
    text(ctx, c.label, r.x + r.w / 2, y + r.h - 16, Math.min(22, r.w / 6), 'rgba(246,234,210,0.5)', { weight: 700 });
  } else {
    // the layout itself, drawn small
    const avail = Math.min((r.w - 30) / (CELL * 4), (r.h - 64) / (CELL * 5));
    const bx = r.x + r.w / 2 - (CELL * 4 * avail) / 2, by = y + 12 + (r.h - 64 - CELL * 5 * avail) / 2;
    miniBoard(ctx, c.lvl.rows, bx, by, avail, { gate: true });
    text(ctx, c.label, r.x + 10, y + 12 + lab * 0.8, lab, 'rgba(246,234,210,0.9)', { weight: 800, align: 'left', shadow: 'rgba(0,0,0,0.8)', blur: 4 });
    for (let i = 0; i < 3; i++) star(ctx, r.x + r.w / 2 + (i - 1) * Math.min(26, r.w / 4.6), y + r.h - 20, Math.min(11, r.w / 12), i < c.stars ? '#ffd45a' : 'rgba(255,255,255,0.14)');
  }
  ctx.restore();
}

// ----------------------------------------------------------------------------------- illustrations
const HDLM_ROWS = ['ABBC', 'ABBC', 'DEEF', 'DGHF', 'I..J'];
function drawArt(ctx, name, x, y, w, h, S, b) {
  const cx = x + w / 2, cy = y + h / 2;
  const T = (k, v) => tr(S.lang, k, v);
  ctx.save();
  ctx.fillStyle = 'rgba(8,2,2,0.55)';
  rr(ctx, x, y, w, h, 18); ctx.fill();
  ctx.strokeStyle = 'rgba(228,189,104,0.28)'; ctx.lineWidth = 1.5; rr(ctx, x, y, w, h, 18); ctx.stroke();
  ctx.beginPath(); rr(ctx, x, y, w, h, 18); ctx.clip();
  const t = S.t;
  const kb = (h - 30) / (CELL * 5); // a board that fills the picture's height
  const bx = (cols) => cx - (CELL * cols * kb) / 2;
  if (name === 'logo') {
    miniBoard(ctx, HDLM_ROWS, cx - CELL * 4 * 0.2 / 2 * 1, y + 22, (h - 44) / (CELL * 5));
    if (S.lang === 'zh') text(ctx, '华容道', x + w * 0.76, cy + 18, 64, GOLD, { font: CARVE, weight: 900, shadow: 'rgba(0,0,0,0.6)' });
    else { text(ctx, 'Huarong', x + w * 0.76, cy - 2, 50, GOLD, { font: DISPLAY, weight: 900, shadow: 'rgba(0,0,0,0.6)' }); text(ctx, 'Dao', x + w * 0.76, cy + 52, 50, GOLD, { font: DISPLAY, weight: 900, shadow: 'rgba(0,0,0,0.6)' }); }
  } else if (name === 'goal' || name === 'gate') {
    const rows = ['.BB.', 'ABBC', 'DEEF', 'DGHF', 'I..J'];
    const pieces = blocksOf(HDLM_ROWS).map((p) => ({ ...p }));
    const cao = pieces.find((p) => p.t === 'C');
    const pos = name === 'goal' ? 0.5 + 0.5 * Math.sin(t * 1.2) : 1;
    cao.dy = 3 * smooth(name === 'goal' ? pos : 1);
    cao.dx = 1;
    miniBoard(ctx, rows, cx - (CELL * 4 * kb) / 2, y + 16, kb, { pieces, glow: name === 'gate' ? new Set([cao.id]) : undefined });
    icon(ctx, 'arrow', cx + 150 * kb * 1.2, y + h - 40, 34, GOLD);
  } else if (name === 'board') {
    miniBoard(ctx, HDLM_ROWS, bx(4), y + 16, kb);
  } else if (name === 'moves') {
    // a block going round a corner counts as one move
    const k = Math.min((h - 40) / (CELL * 5), 0.4);
    const ph = (t % 4) / 4;
    const path = [[0, 0], [1, 0], [1, 1], [2, 1]];
    const s = Math.min(path.length - 1, ph * 1.3 * (path.length - 1));
    const i0 = Math.min(path.length - 2, Math.floor(s)), u = smooth(s - i0);
    const px = path[i0][0] + (path[i0 + 1][0] - path[i0][0]) * u, py = path[i0][1] + (path[i0 + 1][1] - path[i0][1]) * u;
    const sold = { id: 9, t: 'S', x: px, y: py, dx: px, dy: py, name: { zh: '卒', en: 'Soldier' } };
    miniBoard(ctx, HDLM_ROWS, cx - (CELL * 4 * k) / 2, y + 16, k, { pieces: [sold], gate: false });
    ctx.save(); ctx.translate(cx - (CELL * 4 * k) / 2, y + 16); ctx.scale(k, k);
    ctx.strokeStyle = GOLD; ctx.lineWidth = 8; ctx.setLineDash([18, 14]); ctx.beginPath();
    path.forEach(([qx, qy], i) => (i ? ctx.lineTo((qx + 0.5) * CELL, (qy + 0.5) * CELL) : ctx.moveTo((qx + 0.5) * CELL, (qy + 0.5) * CELL))); ctx.stroke(); ctx.setLineDash([]);
    ctx.restore();
    text(ctx, '= 1', cx + 170, cy + 14, 52, GOLD, { font: DISPLAY, weight: 800 });
  } else if (name === 'drag' || name === 'tap') {
    const pieces = blocksOf(['AB..', 'AB..', 'CCD.', '....', '....']).map((p) => ({ ...p }));
    const k = Math.min((h - 30) / (CELL * 5), 0.42);
    const mover = pieces[pieces.length - 1];
    const ph = (t % 3) / 3;
    mover.dx = mover.x + (name === 'drag' ? 2 * smooth(clamp01(ph * 1.6)) : 0);
    mover.dy = mover.y;
    const ox = cx - (CELL * 4 * k) / 2, oy = y + 16;
    miniBoard(ctx, null, ox, oy, k, { pieces, gate: false, lift: new Set([mover.id]), glow: name === 'tap' ? new Set([mover.id]) : undefined });
    ctx.save(); ctx.translate(ox, oy); ctx.scale(k, k);
    if (name === 'tap') {
      ctx.strokeStyle = GOLD; ctx.lineWidth = 6; ctx.setLineDash([16, 12]);
      rr(ctx, (mover.x + 1) * CELL + 8, mover.y * CELL + 8, CELL - 16, CELL - 16, 18); ctx.stroke();
      rr(ctx, (mover.x + 2) * CELL + 8, mover.y * CELL + 8, CELL - 16, CELL - 16, 18); ctx.stroke();
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.beginPath(); ctx.arc((mover.dx + 0.5) * CELL, (mover.dy + 0.5) * CELL + 20, 40, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  } else if (name === 'undo') {
    icon(ctx, 'undo', cx - 110, cy, 84, GOLD); icon(ctx, 'reset', cx + 110, cy, 84, GOLD);
    text(ctx, T('undo'), cx - 110, cy + 80, 26, PAPER, { weight: 700 }); text(ctx, T('reset'), cx + 110, cy + 80, 26, PAPER, { weight: 700 });
  } else if (name === 'think') {
    const pieces = blocksOf(['AB..', 'AB..', 'CCD.', '....', '....']).map((p) => ({ ...p }));
    const k = Math.min((h - 30) / (CELL * 5), 0.42);
    const ox = cx - (CELL * 4 * k) / 2 - 90, oy = y + 16;
    miniBoard(ctx, null, ox, oy, k, { pieces, gate: false, glow: new Set([pieces[pieces.length - 1].id]) });
    ctx.save(); ctx.translate(ox, oy); ctx.scale(k, k);
    ctx.strokeStyle = GOLD; ctx.lineWidth = 6; ctx.setLineDash([16, 12]);
    rr(ctx, 3 * CELL + 8, 2 * CELL + 8, CELL - 16, CELL - 16, 18); ctx.stroke();
    ctx.restore();
    icon(ctx, 'hint', cx + 190, cy - 16, 84, GOLD);
    text(ctx, T('think'), cx + 190, cy + 64, 26, PAPER, { weight: 700 });
  } else if (name === 'minimum') {
    text(ctx, '81', cx, cy + 20, 120, GOLD, { font: DISPLAY, weight: 800, shadow: 'rgba(0,0,0,0.6)' });
    text(ctx, T('minimum'), cx, cy + 66, 26, PAPER, { weight: 600 });
  } else if (name === 'stars') {
    [3, 2, 1].forEach((n, r) => {
      for (let i = 0; i < 3; i++) star(ctx, cx - 120 + i * 52, y + 54 + r * 66, 20, i < n ? '#ffd45a' : 'rgba(255,255,255,0.14)');
      text(ctx, ['≤ 1.25×', '≤ 2×', '> 2×'][r], cx + 110, y + 64 + r * 66, 28, PAPER, { weight: 700 });
    });
  } else if (name === 'chapters') {
    for (let i = 0; i < 4; i++) {
      const bw = 380 - i * 40;
      ctx.fillStyle = alpha(['#2c8a6a', '#33397a', '#c98a2b', '#c7372c'][i], 0.85); rr(ctx, cx - bw / 2 - 40, y + 20 + i * 36, bw, 26, 8); ctx.fill();
    }
    icon(ctx, 'lock', cx + 190, y + h - 50, 40, 'rgba(246,234,210,0.7)');
  } else if (name === 'hdlm') {
    miniBoard(ctx, HDLM_ROWS, bx(4), y + 16, kb);
    if (S.lang === 'zh') text(ctx, '横刀立马', x + w - 130, cy - 10, 50, GOLD, { font: CARVE, weight: 900, shadow: 'rgba(0,0,0,0.6)' });
    else { text(ctx, 'Heng Dao', x + w - 130, cy - 34, 42, GOLD, { font: DISPLAY, weight: 900, shadow: 'rgba(0,0,0,0.6)' }); text(ctx, 'Li Ma', x + w - 130, cy + 10, 42, GOLD, { font: DISPLAY, weight: 900, shadow: 'rgba(0,0,0,0.6)' }); }
    text(ctx, '81', x + w - 130, cy + 60, 60, PAPER, { font: DISPLAY, weight: 800 });
  } else if (name === 'auto') {
    ctx.strokeStyle = 'rgba(255,255,255,0.16)'; ctx.lineWidth = 12; ctx.beginPath(); ctx.arc(cx - 110, cy, 44, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = GOLD; ctx.beginPath(); ctx.arc(cx - 110, cy, 44, -Math.PI / 2, -Math.PI / 2 + ((t * 0.4) % 1) * Math.PI * 2); ctx.stroke();
    drawBlock(ctx, { x: cx + 10, y: cy - 77, w: CELL, h: CELL }, { t: 'S', name: { zh: '卒', en: 'Soldier' } }, { glow: 0.5 + 0.5 * Math.sin(t * 5) });
    icon(ctx, 'pause', cx + 200, cy, 52, GOLD);
  } else if (name === 'demo' || name === 'lock') {
    icon(ctx, 'lock', cx, cy, 90, GOLD);
  } else if (name === 'winstars') {
    const n = b.data ?? 1;
    for (let i = 0; i < 3; i++) {
      const k = clamp01((S.ovT - 0.25 - i * 0.28) / 0.45);
      const sc = k > 0 ? backOut(k) : 0;
      ctx.save(); ctx.translate(cx + (i - 1) * 110, cy + (i === 1 ? -12 : 4)); ctx.scale(sc, sc);
      star(ctx, 0, 0, 46, i < n ? '#ffd45a' : 'rgba(255,255,255,0.14)', i < n ? '#fff3b0' : null);
      ctx.restore();
    }
  }
  ctx.restore();
}

// --------------------------------------------------------------------------------------- title
// The title board plays the first moves of the famous layout, over and over, by itself.
let attract = null;
function attractState(tt) {
  if (!attract) {
    const start = blocksOf(HDLM_ROWS).map((p) => ({ ...p }));
    const states = [start.map((p) => ({ id: p.id, x: p.x, y: p.y }))];
    const paths = [];
    let cur = start.map((p) => ({ id: p.id, t: p.t, x: p.x, y: p.y }));
    for (const [id, x, y] of HDLM_MOVES) {
      const r = reachable(cur, id).find((q) => q.x === x && q.y === y);
      paths.push({ id, path: r.path });
      cur = applyMove(cur, id, x, y);
      states.push(cur.map((p) => ({ id: p.id, x: p.x, y: p.y })));
    }
    attract = { start, states, paths };
  }
  const STEP = 1.05, N = attract.paths.length, HOLD = 1.6;
  const cyc = (N * STEP) + HOLD;
  const ph = tt % cyc;
  const k = Math.min(N, Math.floor(ph / STEP));
  const pieces = attract.start.map((p) => ({ ...p, dx: attract.states[k][p.id].x, dy: attract.states[k][p.id].y, x: attract.states[k][p.id].x, y: attract.states[k][p.id].y }));
  const lift = new Set();
  if (k < N) {
    const u = (ph - k * STEP) / STEP;
    const { id, path } = attract.paths[k];
    const s = Math.min(path.length - 1, clamp01(u / 0.8) * (path.length - 1));
    const i0 = Math.min(path.length - 2, Math.floor(s)), f = smooth(s - i0);
    const p = pieces[id];
    p.dx = path[i0][0] + (path[i0 + 1][0] - path[i0][0]) * f; p.dy = path[i0][1] + (path[i0 + 1][1] - path[i0][1]) * f;
    if (u < 0.85) lift.add(id);
  }
  return { pieces, lift };
}

function lantern(ctx, x, y, t, s = 1, ph = 0) {
  const sway = Math.sin(t * 1.1 + ph) * 0.05;
  ctx.save();
  ctx.translate(x, y); ctx.rotate(sway); ctx.scale(s, s);
  ctx.strokeStyle = 'rgba(228,189,104,0.7)'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(0, -80); ctx.lineTo(0, 0); ctx.stroke();
  const glow = ctx.createRadialGradient(0, 55, 6, 0, 55, 120);
  glow.addColorStop(0, 'rgba(255,170,80,0.45)'); glow.addColorStop(1, 'rgba(255,170,80,0)');
  ctx.fillStyle = glow; ctx.fillRect(-130, -70, 260, 250);
  ctx.fillStyle = '#7c2a1c'; rr(ctx, -22, -4, 44, 12, 4); ctx.fill();
  const g = ctx.createLinearGradient(-40, 0, 40, 0);
  g.addColorStop(0, '#9c2a22'); g.addColorStop(0.5, '#e0503c'); g.addColorStop(1, '#8e2620');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.ellipse(0, 50, 42, 50, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(255,214,150,0.5)'; ctx.lineWidth = 2;
  for (const k of [-0.5, 0, 0.5]) { ctx.beginPath(); ctx.ellipse(0, 50, 42 * Math.abs(k) + 0.1, 50, 0, 0, Math.PI * 2); ctx.stroke(); }
  ctx.fillStyle = '#7c2a1c'; rr(ctx, -22, 94, 44, 12, 4); ctx.fill();
  ctx.strokeStyle = GOLD; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, 106); ctx.lineTo(0, 150); ctx.stroke();
  ctx.fillStyle = GOLD; ctx.beginPath(); ctx.moveTo(-8, 150); ctx.lineTo(8, 150); ctx.lineTo(4, 176); ctx.lineTo(-4, 176); ctx.closePath(); ctx.fill();
  ctx.restore();
}

function drawTitle(ctx, S, ui) {
  background(ctx, S.t, 560);
  lantern(ctx, 62, 100, S.t, 0.9, 0); lantern(ctx, 658, 100, S.t, 0.9, 2);
  const zh = S.lang === 'zh';
  const g = ctx.createLinearGradient(0, 130, 0, 290);
  g.addColorStop(0, '#fff3c4'); g.addColorStop(0.5, '#e4bd68'); g.addColorStop(1, '#b2842f');
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 8;
  ctx.textAlign = 'center';
  ctx.fillStyle = g;
  if (zh) { ctx.font = `900 180px ${CARVE}`; ctx.fillText('华容道', 360, 292); }
  else { ctx.font = `900 100px ${DISPLAY}`; ctx.fillText('HUARONG', 360, 226); ctx.font = `900 70px ${DISPLAY}`; ctx.fillText('D A O', 360, 304); }
  ctx.restore();
  text(ctx, zh ? 'HUARONG DAO' : 'SLIDING PUZZLE', 360, 352, zh ? 40 : 34, 'rgba(246,234,210,0.85)', { font: DISPLAY, weight: 700 });
  text(ctx, tr(S.lang, 'tagline'), 360, 396, 26, 'rgba(246,234,210,0.62)', { weight: 500 });
  // the self-playing board
  const { pieces, lift } = attractState(S.t);
  const k = 0.5;
  const bx = 360 - (CELL * 4 * k) / 2, by = 430;
  miniBoard(ctx, HDLM_ROWS, bx, by, k, { pieces, lift });
  drawDocBlocks(ctx, S, ui, S.scroll[ui.scrollKey] ?? 0);
  drawFixed(ctx, S, ui.fixed);
}

function drawDocScreen(ctx, S, ui) {
  background(ctx, S.t);
  if (ui.panel) panel(ctx, ui.panel.x, ui.panel.y, ui.panel.w, ui.panel.h, {});
  drawDocBlocks(ctx, S, ui, S.scroll[ui.scrollKey] ?? 0);
  drawFixed(ctx, S, ui.fixed);
  if (ui.nav) {
    drawFixed(ctx, S, [ui.nav.prev, ui.nav.next]);
    text(ctx, ui.nav.label, 360, 1500, 26, 'rgba(246,234,210,0.75)', { weight: 600 });
  }
}

function drawOverlay(ctx, S, ui) {
  ctx.fillStyle = `rgba(12,3,3,${0.66 * clamp01(S.ovT / 0.25)})`;
  ctx.fillRect(0, 0, W, H);
  const k = ease(clamp01(S.ovT / 0.3));
  ctx.save();
  ctx.translate(W / 2, H / 2); ctx.scale(0.92 + 0.08 * k, 0.92 + 0.08 * k); ctx.translate(-W / 2, -H / 2);
  ctx.globalAlpha = k;
  panel(ctx, ui.panel.x, ui.panel.y, ui.panel.w, ui.panel.h, {});
  drawDocBlocks(ctx, S, ui, S.scroll[ui.scrollKey] ?? 0);
  drawFixed(ctx, S, ui.fixed);
  ctx.restore();
}

// ------------------------------------------------------------------------------------------ play
function drawFrame(ctx, S, puz) {
  const f = FRAME;
  ctx.save();
  // carved dark-wood frame with a gold inlay line
  ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 30; ctx.shadowOffsetY = 12;
  const g = ctx.createLinearGradient(0, f.y, 0, f.y + f.h);
  g.addColorStop(0, '#5a2a1a'); g.addColorStop(0.5, '#43190f'); g.addColorStop(1, '#2d100a');
  ctx.fillStyle = g; rr(ctx, f.x, f.y, f.w, f.h, 30); ctx.fill();
  ctx.restore();
  ctx.save();
  rr(ctx, f.x, f.y, f.w, f.h, 30); ctx.clip();
  for (let i = 0; i < 40; i++) {
    const yy = f.y + 6 + i * 21 + (i * 37 % 7);
    ctx.strokeStyle = i % 2 ? 'rgba(255,200,150,0.05)' : 'rgba(20,6,2,0.18)';
    ctx.lineWidth = 1 + (i % 3) * 0.5;
    ctx.beginPath(); ctx.moveTo(f.x, yy);
    for (let x = f.x; x <= f.x + f.w; x += 40) ctx.lineTo(x, yy + Math.sin(x * 0.02 + i) * 2.5);
    ctx.stroke();
  }
  ctx.restore();
  ctx.strokeStyle = 'rgba(228,189,104,0.65)'; ctx.lineWidth = 2.5; rr(ctx, f.x, f.y, f.w, f.h, 30); ctx.stroke();
  ctx.strokeStyle = 'rgba(228,189,104,0.25)'; ctx.lineWidth = 1.5; rr(ctx, f.x + 10, f.y + 10, f.w - 20, f.h - 20, 22); ctx.stroke();
  // the playing area: deep lacquer with a faint cell grid
  const b = BOARD_PX;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 4;
  const bg = ctx.createLinearGradient(0, b.y, 0, b.y + b.h);
  bg.addColorStop(0, '#1a0807'); bg.addColorStop(1, '#0f0504');
  ctx.fillStyle = bg; rr(ctx, b.x - 8, b.y - 8, b.w + 16, b.h + 16, 14); ctx.fill();
  ctx.restore();
  ctx.strokeStyle = 'rgba(228,189,104,0.1)'; ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let i = 1; i < 4; i++) { ctx.moveTo(b.x + i * CELL, b.y + 6); ctx.lineTo(b.x + i * CELL, b.y + b.h - 6); }
  for (let j = 1; j < 5; j++) { ctx.moveTo(b.x + 6, b.y + j * CELL); ctx.lineTo(b.x + b.w - 6, b.y + j * CELL); }
  ctx.stroke();
  // the gate: an opening in the bottom of the frame with a gold arch and a glow
  const gx = GATE_PX.x, gy = GATE_PX.y, gw = GATE_PX.w;
  const pulse = 0.5 + 0.5 * Math.sin(S.t * 2.2);
  ctx.save();
  ctx.fillStyle = '#0a0302';
  rr(ctx, gx - 4, gy + 6, gw + 8, f.y + f.h - gy - 6, 10); ctx.fill();
  const gg = ctx.createLinearGradient(0, gy, 0, f.y + f.h);
  gg.addColorStop(0, `rgba(255,190,90,${0.12 + 0.08 * pulse})`); gg.addColorStop(1, `rgba(255,190,90,${0.45 + 0.2 * pulse})`);
  ctx.fillStyle = gg; rr(ctx, gx - 4, gy + 6, gw + 8, f.y + f.h - gy - 6, 10); ctx.fill();
  ctx.strokeStyle = GOLD; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(gx - 4, f.y + f.h); ctx.lineTo(gx - 4, gy + 6); ctx.lineTo(gx + gw + 4, gy + 6); ctx.lineTo(gx + gw + 4, f.y + f.h); ctx.stroke();
  ctx.restore();
  // where Cao Cao has to end up
  ctx.save();
  ctx.setLineDash([16, 12]); ctx.lineWidth = 3.5;
  ctx.strokeStyle = `rgba(228,189,104,${0.42 + 0.3 * pulse})`;
  rr(ctx, gx + 8, gy - CELL * 2 + 8, gw - 16, CELL * 2 - 16, 18); ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = `rgba(228,189,104,${0.04 + 0.04 * pulse})`; rr(ctx, gx + 8, gy - CELL * 2 + 8, gw - 16, CELL * 2 - 16, 18); ctx.fill();
  ctx.restore();
  text(ctx, S.lang === 'zh' ? '关口' : 'GATE', gx + gw / 2, f.y + f.h - 18, 22, GOLD_HI, { font: DISPLAY, weight: 800 });
}

function drawHud(ctx, S, T, title, sub) {
  button(ctx, BACK_BTN, [], 'normal', { pressed: S.press && S.press.id === 'hud:back' && S.press.active });
  icon(ctx, 'back', BACK_BTN.x + BACK_BTN.w / 2, BACK_BTN.y + BACK_BTN.h / 2, 34);
  if (S.scene === 'play') {
    button(ctx, PAUSE_BTN, [], 'normal', { pressed: S.press && S.press.id === 'hud:pause' && S.press.active });
    icon(ctx, 'pause', PAUSE_BTN.x + PAUSE_BTN.w / 2, PAUSE_BTN.y + PAUSE_BTN.h / 2, 34);
  }
  const zh = S.lang === 'zh';
  text(ctx, title, 360, 62, zh ? 40 : 38, PAPER, { font: DISPLAY, weight: 800, shadow: 'rgba(0,0,0,0.6)' });
  text(ctx, sub, 360, 98, 24, 'rgba(246,234,210,0.66)', { weight: 500 });
}

function banner(ctx, str, y = BANNER_Y) {
  if (!str) return;
  ctx.font = `700 26px ${UI}`;
  const w = Math.min(676, ctx.measureText(str).width + 56);
  ctx.save();
  ctx.fillStyle = 'rgba(14,4,4,0.82)';
  rr(ctx, 360 - w / 2, y - 24, w, 46, 23); ctx.fill();
  ctx.strokeStyle = 'rgba(228,189,104,0.55)'; ctx.lineWidth = 1.6; rr(ctx, 360 - w / 2, y - 24, w, 46, 23); ctx.stroke();
  ctx.restore();
  text(ctx, str, 360, y + 8, 26, GOLD, { weight: 700 });
}

function ghostRect(ctx, p, x, y, color, a, strong) {
  const [w, h] = DIMS[p.t];
  const r = { x: BOARD_ORIGIN.x + x * CELL + 6, y: BOARD_ORIGIN.y + y * CELL + 6, w: w * CELL - 12, h: h * CELL - 12 };
  ctx.save();
  ctx.fillStyle = alpha(color, a);
  rr(ctx, r.x, r.y, r.w, r.h, 20); ctx.fill();
  ctx.setLineDash(strong ? [14, 9] : [9, 10]);
  ctx.strokeStyle = alpha(color, strong ? 1 : 0.65); ctx.lineWidth = strong ? 4.5 : 3;
  if (strong) { ctx.shadowColor = color; ctx.shadowBlur = 16; }
  rr(ctx, r.x, r.y, r.w, r.h, 20); ctx.stroke();
  ctx.restore();
}

function routeArrow(ctx, path, p) {
  if (!path || path.length < 2) return;
  const [w, h] = DIMS[p.t];
  const pt = ([x, y]) => [BOARD_ORIGIN.x + (x + w / 2) * CELL, BOARD_ORIGIN.y + (y + h / 2) * CELL];
  ctx.save();
  ctx.strokeStyle = GOLD_HI; ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.setLineDash([2, 16]);
  ctx.shadowColor = 'rgba(255,224,130,0.9)'; ctx.shadowBlur = 12;
  ctx.beginPath();
  path.forEach((c, i) => { const [qx, qy] = pt(c); if (i) ctx.lineTo(qx, qy); else ctx.moveTo(qx, qy); });
  ctx.stroke();
  ctx.setLineDash([]);
  const [ax, ay] = pt(path[path.length - 1]), [bx, by] = pt(path[path.length - 2]);
  const ang = Math.atan2(ay - by, ax - bx);
  ctx.fillStyle = GOLD_HI;
  ctx.beginPath();
  ctx.moveTo(ax + Math.cos(ang) * 26, ay + Math.sin(ang) * 26);
  ctx.lineTo(ax + Math.cos(ang + 2.5) * 22, ay + Math.sin(ang + 2.5) * 22);
  ctx.lineTo(ax + Math.cos(ang - 2.5) * 22, ay + Math.sin(ang - 2.5) * 22);
  ctx.closePath(); ctx.fill();
  ctx.restore();
}

function drawPuzzle(ctx, S, T, auto) {
  const puz = S.puz;
  drawFrame(ctx, S, puz);
  const pulse = 0.5 + 0.5 * Math.sin(S.t * 5);
  const sel = puz.pieces[puz.selected];
  // landing cells of the selected block, and the cell under a held block
  if (sel && !puz.done && !auto) {
    for (const m of movesFor(puz, sel.id)) ghostRect(ctx, sel, m.x, m.y, GOLD, 0.1 + 0.05 * pulse, false);
  }
  if (puz.drag && puz.drag.moved && !puz.done) {
    const p = puz.pieces[puz.drag.id];
    ghostRect(ctx, p, puz.drag.cur.x, puz.drag.cur.y, GOLD_HI, 0.2, true);
  }
  const hint = puz.hint;
  if (hint) {
    const p = puz.pieces[hint.id];
    ghostRect(ctx, p, hint.x, hint.y, '#ffe9a8', 0.18 + 0.2 * pulse, true);
  }
  if (auto && auto.phase === 'reveal') {
    for (const id of auto.movable ?? []) {
      const p = puz.pieces[id];
      const r = rectOf(p);
      ctx.save(); ctx.strokeStyle = 'rgba(246,234,210,0.5)'; ctx.setLineDash([9, 9]); ctx.lineWidth = 3;
      rr(ctx, r.x + 5, r.y + 5, r.w - 10, r.h - 10, 20); ctx.stroke(); ctx.restore();
    }
  }
  if (hint) routeArrow(ctx, hint.path, puz.pieces[hint.id]);
  const cao = puz.pieces.find((q) => q.t === 'C');
  // blocks in draw order (the held one last)
  for (const idx of puz.order) {
    const p = puz.pieces[idx];
    if (p === cao && puz.exit > 0) continue;
    const r = rectOf(p);
    let sc = 1 + 0.045 * p.lift;
    if (p.pop > 0) sc *= 1 + 0.045 * Math.sin(p.pop * Math.PI);
    const shake = p.shake > 0 ? Math.sin(p.shake * 60) * 7 * p.shake : 0;
    const hintPiece = hint && hint.id === idx;
    const scanning = auto && auto.phase === 'think' && auto.scan === idx;
    const chosen = auto && auto.phase === 'reveal' && auto.move && auto.move.id === idx;
    let glow = 0;
    if (puz.selected === idx && !auto) glow = 0.7 + 0.3 * Math.sin(S.t * 6);
    if (hintPiece || chosen) glow = 0.55 + 0.45 * pulse;
    if (scanning) glow = 0.35 + 0.25 * pulse;
    if (puz.done && p === cao) glow = 0.6 + 0.4 * Math.sin(S.t * 6);
    drawBlock(ctx, r, p, { lift: p.lift, scale: sc, dx: shake, glow });
  }
  if (cao && puz.exit > 0) {
    // the Commander walks out through the gate and fades into the light
    const r = rectOf(cao);
    const e = smooth(puz.exit);
    ctx.save();
    ctx.globalAlpha = 1 - e * 0.95;
    drawBlock(ctx, { ...r, y: r.y + e * CELL * 1.5 }, cao, { lift: 0.3 + e, scale: 1 + 0.08 * e, glow: 0.8 });
    ctx.restore();
  }
  drawParticles(ctx, puz.parts);
}

function drawStats(ctx, S, T, puz) {
  const r = STATS;
  panel(ctx, r.x, r.y, r.w, r.h, { r: 22, inner: false, blur: 14 });
  const best = S.progress.best[puz.level.id];
  const cols = [
    [T('moves'), String(puz.moves), PAPER],
    [T('minimum'), String(puz.level.min), GOLD],
    [T('yourBest'), best ? String(best) : '-', 'rgba(246,234,210,0.8)'],
  ];
  cols.forEach(([label, val, col], i) => {
    const cx = r.x + r.w * (0.17 + i * 0.33);
    text(ctx, val, cx, r.y + 70, 56, col, { font: DISPLAY, weight: 800 });
    text(ctx, label, cx, r.y + 102, S.lang === 'zh' ? 24 : 21, 'rgba(246,234,210,0.62)', { weight: 600 });
  });
  ctx.strokeStyle = 'rgba(228,189,104,0.2)'; ctx.lineWidth = 1.5;
  for (const f of [0.335, 0.665]) { ctx.beginPath(); ctx.moveTo(r.x + r.w * f, r.y + 22); ctx.lineTo(r.x + r.w * f, r.y + r.h - 22); ctx.stroke(); }
}

function drawToolbar(ctx, S, T) {
  const puz = S.puz;
  const defs = {
    undo: { icon: 'undo', label: T('undo'), off: !puz.history.length || puz.done },
    hint: { icon: 'hint', label: T('think'), off: puz.done },
    reset: { icon: 'reset', label: T('reset'), off: puz.done || !puz.history.length },
  };
  TOOLBAR_IDS.forEach((id, i) => {
    const r = toolRect(i), d = defs[id];
    const pressed = S.press && S.press.id === `tool:${id}` && S.press.active;
    button(ctx, r, [], id === 'hint' ? 'primary' : 'normal', { disabled: d.off, pressed, radius: 22 });
    const yy = r.y + (pressed ? 3 : 0);
    ctx.save();
    if (d.off) ctx.globalAlpha = 0.4;
    icon(ctx, d.icon, r.x + r.w / 2, yy + 44, 46, id === 'hint' ? '#3a1a0a' : PAPER);
    text(ctx, d.label, r.x + r.w / 2, yy + 96, S.lang === 'zh' ? 28 : 25, id === 'hint' ? '#3a1a0a' : 'rgba(246,234,210,0.9)', { weight: 700 });
    ctx.restore();
  });
}

function drawAutoBar(ctx, S, T, auto) {
  const b = AUTO_BTNS;
  const pr = (id) => S.press && S.press.id === id && S.press.active;
  button(ctx, b.slower, [], 'normal', { disabled: S.thinkIdx === 0, pressed: pr('auto:slower'), radius: 22 });
  icon(ctx, 'minus', b.slower.x + b.slower.w / 2, b.slower.y + 44, 40);
  text(ctx, T('autoSlower'), b.slower.x + b.slower.w / 2, b.slower.y + 94, 24, 'rgba(246,234,210,0.9)', { weight: 700 });
  button(ctx, b.faster, [], 'normal', { disabled: S.thinkIdx === THINK_STEPS.length - 1, pressed: pr('auto:faster'), radius: 22 });
  icon(ctx, 'plus', b.faster.x + b.faster.w / 2, b.faster.y + 44, 40);
  text(ctx, T('autoFaster'), b.faster.x + b.faster.w / 2, b.faster.y + 94, 24, 'rgba(246,234,210,0.9)', { weight: 700 });
  button(ctx, b.pause, [], 'primary', { pressed: pr('auto:pause'), radius: 22 });
  icon(ctx, auto.paused ? 'play' : 'pause', b.pause.x + b.pause.w / 2 - 70, b.pause.y + b.pause.h / 2 - 8, 44, '#3a1a0a');
  text(ctx, auto.paused ? T('autoPlay') : T('autoPause'), b.pause.x + b.pause.w / 2 + 28, b.pause.y + b.pause.h / 2 + 3, 32, '#3a1a0a', { weight: 800 });
  text(ctx, `${THINK_STEPS[S.thinkIdx]}${T('seconds')}`, b.pause.x + b.pause.w / 2, b.pause.y + b.pause.h - 12, 20, '#5e3a17', { weight: 700 });
}

function drawPlay(ctx, S, ui) {
  const T = (k, v) => tr(S.lang, k, v);
  background(ctx, S.t, 700);
  const puz = S.puz;
  const auto = S.scene === 'auto' ? S.auto : null;
  const lv = puz.level;
  const chap = S.lang === 'zh' ? `第 ${S.levelIdx + 1} 关 · ${CHAPTERS[lv.ch].zh}` : `${T('levelWord')} ${S.levelIdx + 1} · ${CHAPTERS[lv.ch].en}`;
  drawHud(ctx, S, T, levelName(S, lv), auto ? T('autoSession') : chap);
  drawPuzzle(ctx, S, T, auto);
  drawStats(ctx, S, T, puz);
  if (auto) {
    drawAutoBar(ctx, S, T, auto);
    let msg = '';
    if (auto.phase === 'think') msg = `${T('autoThink')} ${Math.max(0, Math.ceil(THINK_STEPS[S.thinkIdx] - auto.t))}`;
    else if (auto.phase === 'reveal') msg = auto.move ? T('autoMove', { a: puz.moves + 1, b: lv.min }) : T('autoReveal');
    else if (auto.phase === 'act') msg = T('autoAct');
    else if (auto.phase === 'celebrate') msg = T('autoDone');
    banner(ctx, auto.paused ? T('paused') : msg);
    if (auto.phase === 'think' && !auto.paused) {
      const frac = clamp01(auto.t / THINK_STEPS[S.thinkIdx]);
      ctx.fillStyle = 'rgba(255,255,255,0.12)'; rr(ctx, 120, BANNER_Y + 40, 480, 8, 4); ctx.fill();
      ctx.fillStyle = GOLD; rr(ctx, 120, BANNER_Y + 40, 480 * frac, 8, 4); ctx.fill();
    }
  } else {
    drawToolbar(ctx, S, T);
    let msg = S.toast ?? '';
    if (!msg && puz.hint) msg = T('thinkMsg', { n: puz.pieces[puz.hint.id].name[S.lang === 'zh' ? 'zh' : 'en'], c: puz.hint.left });
    if (!msg && S.levelIdx < 2 && !puz.done) {
      if (puz.moves === 0 && puz.selected < 0) msg = T('tipGoal');
      else if (puz.moves < 3 && puz.selected < 0) msg = T('tipTap');
    }
    banner(ctx, msg);
    if (puz.hint) text(ctx, T('thinkAgain'), 360, BANNER_Y + 40, 21, 'rgba(246,234,210,0.7)', { weight: 500 });
  }
}

export function render(ctx, S, ui) {
  setBlockLang(S.lang);
  ctx.textBaseline = 'alphabetic';
  switch (S.scene) {
    case 'title': drawTitle(ctx, S, ui); break;
    case 'levels': case 'howto': case 'rules': case 'about': case 'settings': drawDocScreen(ctx, S, ui); break;
    case 'demo-limit':
      background(ctx, S.t);
      panel(ctx, ui.panel.x, ui.panel.y, ui.panel.w, ui.panel.h, {});
      drawDocBlocks(ctx, S, ui, S.scroll[ui.scrollKey] ?? 0);
      drawFixed(ctx, S, ui.fixed);
      break;
    case 'play': case 'auto':
      if (!S.puz) { background(ctx, S.t); break; }
      drawPlay(ctx, S, ui);
      break;
    default: background(ctx, S.t);
  }
  if (S.overlay) drawOverlay(ctx, S, ui);
}

export { TEXT_SCALES, light, dark, chapterUnlocked, blockColors, RULES, DOC_PANEL, NAV_PREV, NAV_NEXT, GOLD_LO };
