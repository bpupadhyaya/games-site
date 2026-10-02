// Everything drawn each frame. Reads state, changes nothing.
import {
  W, H, UI, DISPLAY, DISC_COLORS, GOLD, PAPER, text, rr, panel, button, background, star, icon, drawParticles,
  drawDisc, drawRod, drawSlab, drawMiniTower, ryOf, alpha, light, dark,
} from './art.js';
import { SCENE, squashOf, allRest, stackOf, topDisc, canMove, pegAt } from './puzzle.js';
import { recursivePlan, classicMoves } from './solver.js';
import { LEVELS, levelStart } from './levels.js';
import { tr, RULES } from './content.js';
import { TEXT_SCALES } from './ui.js';
import { BACK_BTN, PAUSE_BTN, TOOLBAR_IDS, toolRect, AUTO_BTNS, DOC_PANEL, NAV_PREV, NAV_NEXT } from './layout.js';
import { THINK_STEPS } from './screens.js';

const ease = (t) => 1 - (1 - t) ** 3;
const backOut = (t) => { const c = 1.7; return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2; };
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const PEG = (i) => 'ABCD'[i];

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
        text(ctx, it.lines[i], center ? ox + it.w / 2 : ox, top + i * it.line + it.size * 0.98, it.size, 'rgba(246,236,214,0.93)', { weight: 500, align: center ? 'center' : 'left' });
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
    ctx.fillStyle = 'rgba(232,196,106,0.75)';
    rr(ctx, region.x + region.w + 8, ty, 6, th, 3); ctx.fill();
  }
}

function drawFixed(ctx, S, list) {
  for (const f of list) {
    if (f.static) { text(ctx, f.label, f.rect.x + f.rect.w / 2, f.rect.y + f.rect.h / 2 + 10, f.size, 'rgba(246,236,214,0.8)', { weight: 700 }); continue; }
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
  const z = TEXT_SCALES[S.textIdx] ?? 1;
  ctx.save();
  if (c.state === 'locked') ctx.globalAlpha = 0.55;
  ctx.shadowColor = 'rgba(0,0,0,0.4)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 4;
  const g = ctx.createLinearGradient(0, y, 0, y + r.h);
  if (c.state === 'solved') { g.addColorStop(0, '#5a2a33'); g.addColorStop(1, '#3a171d'); } else { g.addColorStop(0, '#4a2029'); g.addColorStop(1, '#2e1218'); }
  ctx.fillStyle = g; rr(ctx, r.x, y, r.w, r.h, 16); ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = c.state === 'solved' ? 'rgba(232,196,106,0.85)' : 'rgba(232,196,106,0.38)'; ctx.lineWidth = 2;
  rr(ctx, r.x, y, r.w, r.h, 16); ctx.stroke();
  const lv = c.lvl;
  if (c.state === 'locked') {
    icon(ctx, 'lock', r.x + r.w / 2, y + r.h / 2 - 6, Math.min(44, r.w * 0.34), 'rgba(246,236,214,0.7)');
    text(ctx, c.label, r.x + r.w / 2, y + r.h - 16, Math.min(22, r.w / 6), 'rgba(246,236,214,0.5)', { weight: 700 });
  } else {
    const miniH = r.h - 56;
    drawMiniTower(ctx, r.x + 8, y + 8, r.w - 16, miniH, levelStart(lv), lv.P, { goal: lv.goal });
    const fs = Math.min(24 * (1 + (z - 1) * 0.5), r.w / 4);
    text(ctx, c.label, r.x + 12, y + r.h - 34, fs, PAPER, { weight: 800, font: DISPLAY, align: 'left' });
    for (let i = 0; i < 3; i++) star(ctx, r.x + r.w - 14 - (2 - i) * Math.min(20, r.w / 5.2), y + r.h - 22, Math.min(8.5, r.w / 14), i < c.stars ? '#ffd45a' : 'rgba(255,255,255,0.14)');
  }
  ctx.restore();
}

// ----------------------------------------------------------------------------------- illustrations
const tower = (ctx, x, y, w, h, pegOf, P, o) => drawMiniTower(ctx, x, y, w, h, pegOf, P, o);

function arrow(ctx, x0, y0, x1, y1, color = GOLD, lw = 4) {
  ctx.save();
  ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = lw; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  const a = Math.atan2(y1 - y0, x1 - x0);
  ctx.beginPath(); ctx.moveTo(x1, y1);
  ctx.lineTo(x1 - Math.cos(a - 0.45) * 16, y1 - Math.sin(a - 0.45) * 16);
  ctx.lineTo(x1 - Math.cos(a + 0.45) * 16, y1 - Math.sin(a + 0.45) * 16);
  ctx.closePath(); ctx.fill();
  ctx.restore();
}

function arcArrow(ctx, x0, y0, x1, y1, lift, color = GOLD, lw = 4) {
  ctx.save();
  ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = lw; ctx.lineCap = 'round';
  const cx = (x0 + x1) / 2, cy = Math.min(y0, y1) - lift;
  ctx.setLineDash([9, 8]);
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo(cx, cy, x1, y1); ctx.stroke();
  ctx.setLineDash([]);
  const a = Math.atan2(y1 - cy, x1 - cx);
  ctx.beginPath(); ctx.moveTo(x1, y1);
  ctx.lineTo(x1 - Math.cos(a - 0.5) * 17, y1 - Math.sin(a - 0.5) * 17);
  ctx.lineTo(x1 - Math.cos(a + 0.5) * 17, y1 - Math.sin(a + 0.5) * 17);
  ctx.closePath(); ctx.fill();
  ctx.restore();
}

const cap = (ctx, str, x, y, size = 22, col = 'rgba(246,236,214,0.8)') => text(ctx, str, x, y, size, col, { weight: 600 });

function drawArt(ctx, name, x, y, w, h, S, b) {
  const cx = x + w / 2, cy = y + h / 2;
  ctx.save();
  ctx.fillStyle = 'rgba(14,5,8,0.55)';
  rr(ctx, x, y, w, h, 18); ctx.fill();
  ctx.strokeStyle = 'rgba(232,196,106,0.25)'; ctx.lineWidth = 1.5; rr(ctx, x, y, w, h, 18); ctx.stroke();
  ctx.beginPath(); rr(ctx, x, y, w, h, 18); ctx.clip();
  const t = S.t;
  if (name === 'logo') {
    const th = h - 30;
    tower(ctx, cx - 240, y + 14, 480, th, [0, 0, 0, 0, 0], 3, { goal: 2 });
    const hg = ctx.createRadialGradient(cx, cy, 10, cx, cy, 200);
    hg.addColorStop(0, 'rgba(255,200,120,0.1)'); hg.addColorStop(1, 'rgba(255,200,120,0)');
    ctx.fillStyle = hg; ctx.fillRect(x, y, w, h);
  } else if (name === 'goal') {
    const tw = Math.min(250, w * 0.4), th = h - 60;
    tower(ctx, x + 14, y + 20, tw, th, [0, 0, 0, 0], 3, { labels: true, goal: 2 });
    tower(ctx, x + w - tw - 14, y + 20, tw, th, [2, 2, 2, 2], 3, { labels: true, goal: 2 });
    arrow(ctx, cx - 36, cy - 10, cx + 36, cy - 10);
    cap(ctx, 'start', x + 14 + tw / 2, y + 26, 20); cap(ctx, 'goal', x + w - tw / 2 - 14, y + 26, 20, GOLD);
  } else if (name === 'rule') {
    const tw = Math.min(250, w * 0.4), th = h - 80;
    const lx = x + 14, rx = x + w - tw - 14, ty = y + 56;
    tower(ctx, lx, ty, tw, th, [0, 1, 1], 3, { labels: true });
    arcArrow(ctx, lx + tw * 0.17, ty + 20, lx + tw * 0.5, ty + 20, 44, '#6bd49a', 4);
    cap(ctx, 'allowed: onto a larger disc', lx + tw / 2, y + 30, 19, '#7fe0a8');
    tower(ctx, rx, ty, tw, th, [1, 0, 1], 3, { labels: true });
    arcArrow(ctx, rx + tw * 0.17, ty + 20, rx + tw * 0.5, ty + 20, 44, '#ff8a7a', 4);
    cap(ctx, 'refused: onto a smaller disc', rx + tw / 2, y + 30, 19, '#ff9d8f');
  } else if (name === 'move') {
    const tw = w - 60;
    cap(ctx, 'tap a peg, then tap where it goes', cx, y + 30, 21);
    tower(ctx, x + 30, y + 52, tw, h - 84, [0, 0, 0, 0], 3, { labels: true });
    arcArrow(ctx, x + 30 + tw / 6, y + 118, x + 30 + tw * 0.5, y + 118, 56);
    ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.beginPath(); ctx.arc(x + 30 + tw / 6, y + h - 126, 18 + 3 * Math.sin(t * 5), 0, Math.PI * 2); ctx.fill();
  } else if (name === 'numbers') {
    const n = 5;
    for (let d = n - 1; d >= 0; d--) drawDisc(ctx, cx - 40, y + h - 30 - (n - 1 - d) * 50, 90 + d * 42, 50, d, {});
    cap(ctx, 'smallest = 1', cx + 200, y + 70, 20); cap(ctx, 'largest = 5', cx + 200, y + h - 40, 20);
  } else if (name === 'undo') {
    icon(ctx, 'undo', cx - 110, cy - 14, 84, GOLD); icon(ctx, 'reset', cx + 110, cy - 14, 84, GOLD);
    cap(ctx, 'Undo', cx - 110, cy + 70, 24); cap(ctx, 'Restart', cx + 110, cy + 70, 24);
  } else if (name === 'chapters') {
    const rows = [['The Classic Tower', 3, 8], ['Four Pegs', 4, 6], ['Scrambles', 3, 12]];
    rows.forEach(([nm, P, cnt], i) => {
      const yy = y + 56 + i * 90;
      drawMiniTower(ctx, x + 24, yy - 30, 150, 74, i === 2 ? [2, 0, 1] : P === 4 ? [0, 0, 0] : [0, 0, 0], P, {});
      cap(ctx, nm, x + 200, yy + 4, 25, PAPER); ctx.textAlign = 'left';
      text(ctx, `${cnt} levels`, x + 200, yy + 32, 20, 'rgba(246,236,214,0.65)', { weight: 600, align: 'left' });
      if (i) icon(ctx, 'lock', x + w - 50, yy + 10, 34, 'rgba(246,236,214,0.7)');
    });
  } else if (name === 'table') {
    const rows = [[1, 1], [2, 3], [3, 7], [4, 15], [5, 31], [6, 63], [7, 127], [8, 255]];
    cap(ctx, 'discs', x + 110, y + 34, 22, GOLD); cap(ctx, 'fewest moves', x + w - 150, y + 34, 22, GOLD);
    rows.forEach(([n, m], i) => {
      const yy = y + 66 + i * ((h - 90) / 8);
      cap(ctx, String(n), x + 110, yy + 12, 24, PAPER);
      const bw = Math.max(8, (w - 400) * m / 255);
      ctx.fillStyle = alpha(DISC_COLORS[n - 1], 0.9); rr(ctx, x + 170, yy - 6, bw, 22, 7); ctx.fill();
      cap(ctx, String(classicMoves(n)), x + w - 150, yy + 12, 24, PAPER);
    });
  } else if (name === 'recur1' || name === 'recur2') {
    const n = name === 'recur1' ? 3 : 2;
    const states = n === 3 ? [[0, 0, 0], [1, 1, 0], [2, 1, 1], [2, 2, 2]] : [[0, 0], [1, 0], [1, 2], [2, 2]].map((s) => (s.length ? [s[0], s[1]] : s));
    const caps = n === 3 ? ['start', '1: top two to B', '2: largest to C', '3: two onto C'] : ['start', 'small to B', 'large to C', 'small onto C'];
    const st2 = n === 3 ? states : [[0, 0], [1, 0], [1, 2], [2, 2]];
    const tw = (w - 40) / 2, th = (h - 40) / 2;
    st2.forEach((s, i) => {
      const gx = x + 14 + (i % 2) * (tw + 12), gy = y + 12 + Math.floor(i / 2) * (th + 8);
      tower(ctx, gx, gy + 8, tw, th - 22, s, 3, { labels: false, goal: 2 });
      cap(ctx, caps[i], gx + tw / 2, gy + th - 2, 18, i ? GOLD : 'rgba(246,236,214,0.8)');
    });
  } else if (name === 'rhythm') {
    const px = [cx - 190, cx, cx + 190];
    for (let i = 0; i < 3; i++) { drawRod(ctx, px[i], y + h - 56, h - 190, 8); cap(ctx, PEG(i), px[i], y + h - 20, 24); }
    drawDisc(ctx, px[0], y + h - 52, 70, 34, 0, { label: false });
    arcArrow(ctx, px[0] + 14, y + 112, px[2] - 14, y + 112, 62, GOLD);
    arcArrow(ctx, px[2] - 14, y + 150, px[1] + 12, y + 150, 30, GOLD);
    arcArrow(ctx, px[1] - 12, y + 150, px[0] + 14, y + 150, 30, GOLD);
    text(ctx, '1', cx, y + 76, 22, GOLD, { weight: 800 }); text(ctx, '2', px[2] - 95, y + 134, 22, GOLD, { weight: 800 }); text(ctx, '3', px[0] + 95, y + 134, 22, GOLD, { weight: 800 });
    cap(ctx, 'odd number of discs: A, C, B, A ...', cx, y + 28, 20, GOLD);
  } else if (name === 'four') {
    tower(ctx, x + 20, y + 18, w - 40, h - 36, [0, 0, 0, 0, 0], 4, { labels: true, goal: 3 });
  } else if (name === 'scramble') {
    tower(ctx, x + 40, y + 18, w - 80, h - 36, [2, 0, 1, 2, 1], 3, { labels: true, goal: 1 });
    cap(ctx, 'gold peg: gather everything here', cx, y + 28, 19, GOLD);
  } else if (name === 'stars') {
    [3, 2, 1].forEach((n, r) => {
      for (let i = 0; i < 3; i++) star(ctx, cx - 150 + i * 52, y + 58 + r * 78, 20, i < n ? '#ffd45a' : 'rgba(255,255,255,0.14)');
      cap(ctx, ['the minimum', 'up to 1.5 x minimum', 'any solution'][r], cx + 90, y + 66 + r * 78, 22, PAPER);
    });
  } else if (name === 'think') {
    tower(ctx, x + 30, y + 40, w - 60, h - 60, [0, 0, 0, 1], 3, { labels: true });
    const pulse = 0.5 + 0.5 * Math.sin(t * 4);
    arcArrow(ctx, x + 30 + (w - 60) / 6, y + 100, x + 30 + (w - 60) * 0.5, y + 100, 60, `rgba(255,224,130,${0.6 + 0.4 * pulse})`);
    icon(ctx, 'hint', cx, y + 40, 40, GOLD);
  } else if (name === 'auto') {
    ctx.strokeStyle = 'rgba(255,255,255,0.16)'; ctx.lineWidth = 12; ctx.beginPath(); ctx.arc(cx - 120, cy, 46, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = GOLD; ctx.beginPath(); ctx.arc(cx - 120, cy, 46, -Math.PI / 2, -Math.PI / 2 + ((t * 0.4) % 1) * Math.PI * 2); ctx.stroke();
    drawDisc(ctx, cx + 20, cy + 30, 120, 50, 3, { glow: 0.5 + 0.5 * Math.sin(t * 5) });
    icon(ctx, 'pause', cx + 150, cy, 52, GOLD);
    cap(ctx, 'THINK  ·  REVEAL  ·  ACT', cx, y + h - 18, 22, GOLD);
  } else if (name === 'daily') {
    rr(ctx, cx - 74, cy - 64, 148, 128, 14); ctx.fillStyle = 'rgba(246,236,214,0.92)'; ctx.fill();
    ctx.fillStyle = '#d9473d'; rr(ctx, cx - 74, cy - 64, 148, 36, 14); ctx.fill();
    drawMiniTower(ctx, cx - 62, cy - 22, 124, 80, [1, 2, 0, 1], 3, {});
  } else if (name === 'win') {
    for (let i = 0; i < 3; i++) star(ctx, cx + (i - 1) * 100, cy - 6, 40, '#ffd45a', '#fff3b0');
    tower(ctx, x + 40, y + h - 90, w - 80, 80, [2, 2, 2], 3, { goal: 2 });
  } else if (name === 'lock') {
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
// The title's attract scene: a three-disc tower solves itself forever with the textbook recursion.
const PLAN3 = recursivePlan(3, 0, 2, 1);
function drawAttract(ctx, S) {
  const n = 3, P = 3, sp = 200, base = 770, sh = 46;
  const px = [360 - sp, 360, 360 + sp];
  const W3 = [74, 118, 164];
  const MOVE = 1.15, HOLD = 2.2, CYCLE = PLAN3.length * MOVE + HOLD;
  let tt = S.t % CYCLE;
  const k = Math.min(PLAN3.length, Math.floor(tt / MOVE));
  const u = tt >= PLAN3.length * MOVE ? 1 : (tt - k * MOVE) / MOVE;
  const pegOf = [0, 0, 0];
  for (let i = 0; i < k; i++) pegOf[PLAN3[i][0]] = PLAN3[i][2];
  const moving = k < PLAN3.length ? PLAN3[k] : null;
  const seatY = (d, pegs) => { let c = 0; for (let e = d + 1; e < n; e++) if (pegs[e] === pegs[d]) c++; return base - c * sh; };
  const glow = ctx.createRadialGradient(360, 560, 30, 360, 560, 380);
  glow.addColorStop(0, 'rgba(255,170,100,0.20)'); glow.addColorStop(1, 'rgba(255,170,100,0)');
  ctx.fillStyle = glow; ctx.fillRect(0, 380, W, 500);
  drawSlab(ctx, 40, 680, base, { h: 64 });
  const rodLen = 290;
  for (let i = 0; i < P; i++) drawRod(ctx, px[i], base + 18, rodLen + 18, 9, { glow: i === 2 && !moving ? 0.8 : 0 });
  for (let d = n - 1; d >= 0; d--) {
    if (moving && moving[0] === d) continue;
    drawDisc(ctx, px[pegOf[d]], seatY(d, pegOf), W3[d], sh, d, { label: false, hole: 9 });
  }
  if (moving) {
    const d = moving[0], from = moving[1], to = moving[2];
    const after = [...pegOf]; after[d] = to;
    const sy0 = seatY(d, pegOf), sy1 = seatY(d, after), hv = base - rodLen - 36;
    let x, y;
    if (u < 0.3) { const q = ease(u / 0.3); x = px[from]; y = sy0 + (hv - sy0) * q; }
    else if (u < 0.7) { const q = (u - 0.3) / 0.4; const e = q * q * (3 - 2 * q); x = px[from] + (px[to] - px[from]) * e; y = hv; }
    else { const q = (u - 0.7) / 0.3; x = px[to]; y = hv + (sy1 - hv) * q * q; }
    drawDisc(ctx, x, y, W3[d], sh, d, { label: false, hole: 9 });
  }
  const g = ctx.createLinearGradient(0, 120, 0, 290);
  g.addColorStop(0, '#fff3c4'); g.addColorStop(0.5, '#e8c46a'); g.addColorStop(1, '#b8842c');
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.65)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 8;
  ctx.font = `800 100px ${DISPLAY}`; ctx.textAlign = 'center'; ctx.fillStyle = g;
  ctx.fillText('Tower', 360, 190);
  ctx.fillText('of Hanoi', 360, 282);
  ctx.restore();
  text(ctx, 'Tháp Hà Nội  ·  Tour d’Hanoï', 360, 334, 30, 'rgba(246,236,214,0.82)', { weight: 600 });
  text(ctx, tr('tagline'), 360, 376, 26, 'rgba(246,236,214,0.6)', { weight: 500 });
}

function drawTitle(ctx, S, ui) {
  background(ctx, S.t, 560);
  drawAttract(ctx, S);
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
    text(ctx, ui.nav.label, 360, 1500, 26, 'rgba(246,236,214,0.75)', { weight: 600 });
  }
}

function drawOverlay(ctx, S, ui) {
  ctx.fillStyle = `rgba(8,2,4,${0.62 * clamp01(S.ovT / 0.25)})`;
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
function drawHud(ctx, S, title, sub) {
  button(ctx, BACK_BTN, [], 'normal', { pressed: S.press && S.press.id === 'hud:back' && S.press.active });
  icon(ctx, 'back', BACK_BTN.x + BACK_BTN.w / 2, BACK_BTN.y + BACK_BTN.h / 2, 34);
  if (S.scene === 'play') {
    button(ctx, PAUSE_BTN, [], 'normal', { pressed: S.press && S.press.id === 'hud:pause' && S.press.active });
    icon(ctx, 'pause', PAUSE_BTN.x + PAUSE_BTN.w / 2, PAUSE_BTN.y + PAUSE_BTN.h / 2, 34);
  }
  text(ctx, title, 360, 62, 40, PAPER, { font: DISPLAY, weight: 800, shadow: 'rgba(0,0,0,0.6)' });
  text(ctx, sub, 360, 98, 24, 'rgba(246,236,214,0.65)', { weight: 500 });
}

function chip(ctx, x, y, w, label, value, hi) {
  ctx.save();
  ctx.fillStyle = 'rgba(14,5,8,0.62)'; rr(ctx, x, y, w, 64, 16); ctx.fill();
  ctx.strokeStyle = hi ? 'rgba(255,224,130,0.9)' : 'rgba(232,196,106,0.4)'; ctx.lineWidth = 1.6; rr(ctx, x, y, w, 64, 16); ctx.stroke();
  text(ctx, label, x + w / 2, y + 22, 18, 'rgba(246,236,214,0.65)', { weight: 600 });
  text(ctx, value, x + w / 2, y + 52, 30, hi ? GOLD : PAPER, { weight: 800, font: DISPLAY });
  ctx.restore();
}

function banner(ctx, str, y = 262) {
  if (!str) return;
  ctx.font = `700 26px ${UI}`;
  const w = Math.min(680, ctx.measureText(str).width + 56);
  ctx.save();
  ctx.fillStyle = 'rgba(14,5,8,0.8)';
  rr(ctx, 360 - w / 2, y - 26, w, 50, 25); ctx.fill();
  ctx.strokeStyle = 'rgba(232,196,106,0.55)'; ctx.lineWidth = 1.6; rr(ctx, 360 - w / 2, y - 26, w, 50, 25); ctx.stroke();
  ctx.restore();
  text(ctx, str, 360, y + 9, 26, GOLD, { weight: 700 });
}

// peg front: the part of the rod above a disc's top face, redrawn over the disc so the peg passes through its hole
function rodFront(ctx, g, px, topY) {
  ctx.save();
  ctx.beginPath(); ctx.rect(px - g.rodR - 2, g.pegTop - 40, g.rodR * 2 + 4, topY - (g.pegTop - 40)); ctx.clip();
  drawRod(ctx, px, g.baseY + 20, g.len + 20, g.rodR);
  ctx.restore();
}

function drawScene(ctx, S, puz, auto) {
  const g = puz.g;
  const ry = ryOf(g.sh);
  const t = S.t;
  // peg highlights on the base: legal targets while a disc is held
  const held = puz.sel >= 0 ? puz.sel : puz.ptr && puz.ptr.kind === 'src' ? puz.ptr.peg : -1;
  let over = -1;
  if (puz.ptr && puz.ptr.dragging && puz.ptr.fx != null) over = pegAt(puz, puz.ptr.fx, puz.ptr.fy - 20, true);
  drawSlab(ctx, 24, 696, g.baseY);
  // goal marker
  const gx = g.pegX[puz.goal];
  ctx.save();
  ctx.strokeStyle = `rgba(255,224,130,${0.65 + 0.2 * Math.sin(t * 2.4)})`; ctx.lineWidth = 3;
  ctx.shadowColor = 'rgba(255,214,110,0.8)'; ctx.shadowBlur = 16;
  ctx.beginPath(); ctx.ellipse(gx, g.baseY + 22, g.spacing * 0.42, 16, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
  for (let i = 0; i < puz.P; i++) {
    const px = g.pegX[i];
    const isGoal = i === puz.goal;
    text(ctx, PEG(i), px, g.baseY + 100, 34, isGoal ? GOLD : 'rgba(246,236,214,0.7)', { weight: 800, font: DISPLAY });
    if (isGoal) text(ctx, tr('goalWord').toUpperCase(), px, g.baseY + 126, 16, 'rgba(232,196,106,0.8)', { weight: 700 });
    // highlight
    let hl = null;
    if (held >= 0 && i !== held && canMove(puz, held, i) && (over < 0 || over === i)) hl = over === i ? '#6bd49a' : '#e8c46a';
    if (over === i && held >= 0 && i !== held && !canMove(puz, held, i)) hl = '#ff7a6a';
    if (puz.flash && puz.flash.peg === i) hl = '#ff7a6a';
    if (hl) {
      const k = over === i || (puz.flash && puz.flash.peg === i) ? 0.55 : 0.25 + 0.12 * Math.sin(t * 5);
      const gr = ctx.createLinearGradient(0, g.pegTop - 20, 0, g.baseY + 30);
      gr.addColorStop(0, alpha(hl, 0)); gr.addColorStop(1, alpha(hl, k));
      ctx.fillStyle = gr; rr(ctx, px - g.spacing * 0.46, g.pegTop - 20, g.spacing * 0.92, g.baseY + 50 - g.pegTop, 24); ctx.fill();
    }
  }
  // rods
  for (let i = 0; i < puz.P; i = i + 1) {
    const glow = (puz.done && i === puz.goal) ? 0.6 + 0.4 * Math.sin(puz.doneT * 5) : held === i ? 0.7 : 0;
    drawRod(ctx, g.pegX[i], g.baseY + 20, g.len + 20, g.rodR, { glow });
  }
  // landing shadows for discs in the air
  for (const d of puz.discs) {
    if (d.mode === 'rest') continue;
    const dst = puz.pegOf[d.id];
    const k = stackOf(puz, dst).indexOf(d.id);
    const sy = g.baseY - k * g.sh - g.sh;
    const h = clamp01((g.baseY - 60 - d.y) / 600);
    ctx.save();
    ctx.fillStyle = `rgba(0,0,0,${0.12 + 0.2 * (1 - h)})`;
    ctx.beginPath(); ctx.ellipse(g.pegX[dst], sy + ry, g.w(d.id) * (0.46 + 0.08 * h) , ry * 1.05, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  // discs at rest (and falling ones) bottom to top per peg, then lifted/sliding ones on top
  const label = S.numbers;
  const hintDisc = puz.hint ? puz.hint.disc : -1;
  const pulse = 0.5 + 0.5 * Math.sin(t * 5);
  const order = [...puz.discs].sort((a, b) => (a.mode === 'rest' ? 0 : 1) - (b.mode === 'rest' ? 0 : 1) || b.y - a.y);
  for (const d of order) {
    const px = g.pegX[d.id === d.id ? puz.pegOf[d.id] : 0];
    const glow = d.id === hintDisc ? 0.5 + 0.5 * pulse : (auto && auto.target && auto.phase !== 'think' && auto.target.disc === d.id ? 0.55 + 0.45 * pulse : 0);
    const wt = d.id === puz.wiggleDisc ? Math.max(...puz.shake) : 0; // refused move: only the disc wiggles
    const wx = wt > 0 ? Math.sin(wt * 70) * 6 * (wt / 0.4) : 0;
    drawDisc(ctx, d.x + wx, d.y, g.w(d.id), g.sh, d.id, { squash: squashOf(d), glow, label, hole: g.rodR });
    if ((d.mode === 'rest' || d.mode === 'drop') && Math.abs(d.x - px) < 2) rodFront(ctx, g, px, d.y - g.sh);
  }
  // Think arc
  const hint = puz.hint;
  if (hint) {
    const x0 = g.pegX[hint.from], x1 = g.pegX[hint.to], y = g.hoverY - 24;
    arcArrow(ctx, x0, y + 10, x1, y + 10, 46, `rgba(255,224,130,${0.55 + 0.4 * pulse})`, 5);
  }
  if (auto && auto.target && (auto.phase === 'reveal' || auto.phase === 'act')) {
    const x0 = g.pegX[auto.target.from], x1 = g.pegX[auto.target.to], y = g.hoverY - 24;
    if (auto.phase === 'reveal') {
      // every peg the disc may legally go to, then the chosen one
      for (const [a, b] of auto.legal) if (a === auto.target.from) {
        const hl = b === auto.target.to ? '#ffe08a' : '#8fb4ff';
        const gr = ctx.createLinearGradient(0, g.pegTop, 0, g.baseY + 30);
        gr.addColorStop(0, alpha(hl, 0)); gr.addColorStop(1, alpha(hl, b === auto.target.to ? 0.4 + 0.2 * pulse : 0.2));
        ctx.fillStyle = gr; rr(ctx, g.pegX[b] - g.spacing * 0.46, g.pegTop, g.spacing * 0.92, g.baseY + 50 - g.pegTop, 24); ctx.fill();
      }
      arcArrow(ctx, x0, y + 10, x1, y + 10, 46, `rgba(255,224,130,${0.6 + 0.4 * pulse})`, 5);
    }
  }
  if (auto && auto.phase === 'think' && auto.scan != null) {
    const px = g.pegX[auto.scan];
    ctx.fillStyle = `rgba(255,255,255,${0.05 + 0.08 * pulse})`; rr(ctx, px - g.spacing * 0.46, g.pegTop, g.spacing * 0.92, g.baseY + 50 - g.pegTop, 24); ctx.fill();
  }
  // win glints
  if (puz.done && allRest(puz)) {
    const k = (puz.doneT * 0.7) % 2.2;
    ctx.save();
    const sx = 20 + (k / 1.2) * 680;
    const sg = ctx.createLinearGradient(sx - 90, 0, sx + 90, 0);
    sg.addColorStop(0, 'rgba(255,255,255,0)'); sg.addColorStop(0.5, 'rgba(255,240,200,0.28)'); sg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = sg; ctx.fillRect(sx - 100, g.pegTop - 30, 200, g.baseY - g.pegTop + 60);
    ctx.restore();
  }
  drawParticles(ctx, puz.parts);
}

function drawToolbar(ctx, S, puz) {
  const defs = {
    undo: { icon: 'undo', label: tr('undo'), off: !puz.history.length || puz.done },
    think: { icon: 'hint', label: tr('think'), off: puz.done },
    restart: { icon: 'reset', label: tr('restart'), off: puz.done || (!puz.history.length && puz.sel < 0) },
  };
  TOOLBAR_IDS.forEach((id, i) => {
    const r = toolRect(i), d = defs[id];
    const pressed = S.press && S.press.id === `tool:${id}` && S.press.active;
    button(ctx, r, [], id === 'think' ? 'primary' : 'normal', { disabled: d.off, pressed, radius: 22 });
    const yy = r.y + (pressed ? 3 : 0);
    ctx.save();
    if (d.off) ctx.globalAlpha = 0.4;
    icon(ctx, d.icon, r.x + r.w / 2, yy + 44, 44, id === 'think' ? '#3a2410' : PAPER);
    text(ctx, d.label, r.x + r.w / 2, yy + 92, 24, id === 'think' ? '#3a2410' : 'rgba(246,236,214,0.88)', { weight: 700 });
    ctx.restore();
  });
}

function drawAutoBar(ctx, S, auto) {
  const b = AUTO_BTNS;
  const pr = (id) => S.press && S.press.id === id && S.press.active;
  button(ctx, b.slower, [], 'normal', { disabled: S.thinkIdx === 0, pressed: pr('auto:slower'), radius: 22 });
  icon(ctx, 'minus', b.slower.x + b.slower.w / 2, b.slower.y + 42, 40);
  text(ctx, tr('autoSlower'), b.slower.x + b.slower.w / 2, b.slower.y + 92, 22, 'rgba(246,236,214,0.88)', { weight: 700 });
  button(ctx, b.faster, [], 'normal', { disabled: S.thinkIdx === THINK_STEPS.length - 1, pressed: pr('auto:faster'), radius: 22 });
  icon(ctx, 'plus', b.faster.x + b.faster.w / 2, b.faster.y + 42, 40);
  text(ctx, tr('autoFaster'), b.faster.x + b.faster.w / 2, b.faster.y + 92, 22, 'rgba(246,236,214,0.88)', { weight: 700 });
  button(ctx, b.pause, [], 'primary', { pressed: pr('auto:pause'), radius: 22 });
  icon(ctx, auto.paused ? 'play' : 'pause', b.pause.x + b.pause.w / 2 - 70, b.pause.y + b.pause.h / 2, 44, '#3a2410');
  text(ctx, auto.paused ? tr('autoPlay') : tr('autoPause'), b.pause.x + b.pause.w / 2 + 28, b.pause.y + b.pause.h / 2 + 11, 32, '#3a2410', { weight: 800 });
  text(ctx, `${tr('thinkTime')}: ${THINK_STEPS[S.thinkIdx]}${tr('seconds')}`, 360, 1376, 22, 'rgba(246,236,214,0.7)', { weight: 600 });
}

const moveWords = (puz, a, b) => `disc ${topDisc(puz, a) + 1} from ${PEG(a)} to ${PEG(b)}`;

function drawPlay(ctx, S) {
  background(ctx, S.t, 830);
  const puz = S.puz;
  const auto = S.scene === 'auto' ? S.auto : null;
  const lv = puz.level;
  const chapName = S.daily ? tr('dailyTitle') : `${lv.n} discs`;
  const sub = auto ? tr('autoSession') : S.daily ? `${lv.n} discs · ${lv.P} pegs · to ${PEG(lv.goal)}` : `${lv.ch === 1 ? 'Four pegs' : lv.ch === 2 ? lv.name : 'Classic'} · to ${PEG(lv.goal)}`;
  drawHud(ctx, S, chapName, sub);
  const best = S.daily ? 0 : (S.progress.stars[lv.id] ?? 0);
  chip(ctx, 48, 124, 200, tr('moves'), String(puz.moves), false);
  chip(ctx, 260, 124, 200, tr('minimum'), String(puz.min), true);
  if (S.daily) chip(ctx, 472, 124, 200, tr('goalWord'), `Peg ${PEG(lv.goal)}`, false);
  else chip(ctx, 472, 124, 200, tr('best'), best ? '★'.repeat(best) + '☆'.repeat(3 - best) : '☆☆☆', false);
  drawScene(ctx, S, puz, auto);
  if (auto) {
    drawAutoBar(ctx, S, auto);
    let msg = '';
    if (auto.phase === 'think') msg = `${tr('autoThink')} ${Math.max(0, Math.ceil(THINK_STEPS[S.thinkIdx] - auto.t))}`;
    else if (auto.phase === 'reveal' || auto.phase === 'act') msg = auto.note || tr('autoReveal');
    else if (auto.phase === 'celebrate') msg = tr('autoDone');
    banner(ctx, auto.paused ? tr('paused') : msg);
    if (auto.phase === 'think' && !auto.paused) {
      const frac = clamp01(auto.t / THINK_STEPS[S.thinkIdx]);
      ctx.fillStyle = 'rgba(255,255,255,0.12)'; rr(ctx, 120, 304, 480, 8, 4); ctx.fill();
      ctx.fillStyle = GOLD; rr(ctx, 120, 304, 480 * frac, 8, 4); ctx.fill();
    }
  } else {
    drawToolbar(ctx, S, puz);
    let msg = S.toast ?? '';
    if (!msg && puz.refused) msg = tr('refused');
    if (!msg && puz.hint) msg = `Move ${moveWords(puz, puz.hint.from, puz.hint.to)}`;
    if (!msg && !S.daily && S.levelIdx < 2 && !puz.done && puz.moves === 0) msg = puz.sel >= 0 ? tr('tipTap2') : tr('tipTap');
    banner(ctx, msg);
  }
}

export function render(ctx, S, ui) {
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
      drawPlay(ctx, S);
      break;
    default: background(ctx, S.t);
  }
  if (S.overlay) drawOverlay(ctx, S, ui);
}

export { RULES, DOC_PANEL, NAV_PREV, NAV_NEXT, light, dark, W, H };
