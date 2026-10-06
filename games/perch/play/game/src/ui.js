// Screen-space drawing for everything that is not the field: buttons, HUD, title, pause menu, result, limit panel and the Auto Play
// chrome. All positions come from layout.js (`L`); nothing here owns geometry. Drawing only.
import { drawText, FONT } from './render.js';
import { drawMoreLine } from './brand.js';
import { AUTO_THINK_STEPS } from './tuning.js';

const TAU = Math.PI * 2;

let lockup = null;
export const setLockup = (img) => { lockup = img; };

export function fitSize(ctx, str, maxW, size, weight = 800, floor = 14) {
  let s = size;
  ctx.font = `${weight} ${s}px ${FONT}`;
  while (s > floor && ctx.measureText(str).width > maxW) { s -= 1; ctx.font = `${weight} ${s}px ${FONT}`; }
  return s;
}
// Text that shrinks to fit a width instead of overflowing it.
export function fitText(ctx, str, x, y, maxW, size, color = '#fff', weight = 800, floor = 14) {
  drawText(ctx, str, x, y, fitSize(ctx, str, maxW, size, weight, floor), color, weight);
}
// Centered wrapped lines; returns the number of lines drawn.
export function wrapText(ctx, str, x, y, maxW, size, lh, color = '#fff', weight = 700) {
  ctx.font = `${weight} ${size}px ${FONT}`;
  const lines = []; let cur = '';
  for (const w of str.split(' ')) { const t2 = cur ? cur + ' ' + w : w; if (ctx.measureText(t2).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t2; }
  lines.push(cur);
  lines.forEach((ln, i) => drawText(ctx, ln, x, y + i * lh, size, color, weight));
  return lines.length;
}

// Clean flat button: no gloss, no inner shape. Primary = solid gold with dark text; others = dark glass with a gold edge.
export function drawButton(ctx, r, label, { primary = false, disabled = false, size = 34, icon = null } = {}) {
  ctx.save();
  ctx.globalAlpha = disabled ? 0.4 : 1;
  const rad = Math.min(22, r.h * 0.28);
  ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, rad);
  ctx.fillStyle = primary ? '#ffd24a' : 'rgba(16,24,40,0.82)'; ctx.fill();
  ctx.lineWidth = 2.5; ctx.strokeStyle = primary ? '#b8862a' : 'rgba(255,226,122,0.6)'; ctx.stroke();
  if (icon === 'pause') {
    ctx.fillStyle = '#fff8e0';
    const bh = r.h * 0.4, bw = r.h * 0.11, cx = r.x + r.w / 2, cy = r.y + r.h / 2;
    ctx.beginPath(); ctx.roundRect(cx - bw * 1.7, cy - bh / 2, bw, bh, 3); ctx.roundRect(cx + bw * 0.7, cy - bh / 2, bw, bh, 3); ctx.fill();
  } else if (label) {
    const fs = fitSize(ctx, label, r.w - 24, size, 800, 16);
    ctx.font = `800 ${fs}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = primary ? '#3a2606' : '#fff8e0'; ctx.fillText(label, r.x + r.w / 2, r.y + r.h / 2 + 1);
  }
  ctx.restore();
}

function feather(ctx, x, y, on) {
  ctx.fillStyle = on ? '#ff9b6a' : 'rgba(255,255,255,0.28)';
  ctx.save(); ctx.translate(x, y); ctx.rotate(-0.5); ctx.beginPath(); ctx.ellipse(0, 0, 8, 22, 0, 0, TAU); ctx.fill(); ctx.restore();
}
function acorn(ctx, x, y, on) {
  ctx.save(); ctx.translate(x, y); ctx.globalAlpha = on ? 1 : 0.28;
  ctx.fillStyle = '#b07a3a'; ctx.beginPath(); ctx.ellipse(0, 2, 10, 13, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#6b4523'; ctx.beginPath(); ctx.ellipse(0, -7, 11, 6, 0, 0, TAU); ctx.fill(); ctx.restore();
}
const outline = (ctx) => { ctx.strokeStyle = 'rgba(20,30,50,0.55)'; ctx.lineJoin = 'round'; ctx.lineWidth = 10; };
function windStr(s) { const w = s.wind, n = Math.max(1, Math.round(Math.abs(w) * 4)); return 'WIND ' + (Math.abs(w) < 0.25 ? 'calm' : (w > 0 ? '›'.repeat(n) : '‹'.repeat(n))); }
function card(ctx, r) { ctx.fillStyle = 'rgba(15,25,50,0.4)'; ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, 22); ctx.fill(); ctx.strokeStyle = 'rgba(255,226,122,0.28)'; ctx.lineWidth = 2; ctx.stroke(); }

// ---- in-play HUD ------------------------------------------------------------------------------------------------------
// opts.auto: the Auto Play chrome owns the right panel in landscape and the top-right corner in portrait (no pause button).
export function drawHud(ctx, s, L, { auto = false } = {}) {
  const H = L.hud, W = L.w;
  ctx.save();
  if (!L.land) {
    ctx.translate(0, H.dy);
    ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; outline(ctx);
    ctx.font = `800 84px ${FONT}`; ctx.strokeText(String(s.score), W / 2, 150); ctx.fillText(String(s.score), W / 2, 150);
    for (let i = 0; i < 3; i++) feather(ctx, 58 + i * 46, 110, i < s.lives);
    ctx.textAlign = 'right'; ctx.font = `800 40px ${FONT}`; ctx.fillStyle = s.combo > 1 ? '#ffe27a' : 'rgba(255,255,255,0.55)';
    ctx.strokeText('×' + s.combo, W - 40, 122); ctx.fillText('×' + s.combo, W - 40, 122);
    const prog = Math.min(1, s.t / s.duration), bx = 140, bw = W - 280, by = 200;
    ctx.fillStyle = 'rgba(15,25,50,0.35)'; ctx.beginPath(); ctx.roundRect(bx, by, bw, 12, 6); ctx.fill();
    ctx.fillStyle = '#ffd27a'; ctx.beginPath(); ctx.roundRect(bx, by, Math.max(12, bw * prog), 12, 6); ctx.fill();
    ctx.textAlign = 'center'; ctx.font = `700 22px ${FONT}`; ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fillText('LEVEL ' + s.level + ' · ' + s.name.toUpperCase(), W / 2, 186);
    if (s.feats.seeds) { ctx.textAlign = 'left'; ctx.font = `800 30px ${FONT}`; ctx.fillStyle = '#ffd24a'; outline(ctx); ctx.strokeText('◆ ' + s.seedsGot, 44, 168); ctx.fillText('◆ ' + s.seedsGot, 44, 168); }
    if (s.feats.hitback) for (let i = 0; i < 3; i++) acorn(ctx, 56 + i * 40, 212, i < s.ammo);
    if (s.feats.wind) { ctx.textAlign = 'right'; ctx.font = `800 30px ${FONT}`; ctx.fillStyle = '#d6f0ff'; outline(ctx); ctx.strokeText(windStr(s), W - 40, 168); ctx.fillText(windStr(s), W - 40, 168); }
    ctx.restore(); ctx.save();
  } else {
    card(ctx, H.left);
    fitText(ctx, String(s.score), H.score.x, H.score.y, H.score.max, 84, '#fff');
    for (let i = 0; i < 3; i++) feather(ctx, H.lives.x - 46 + i * 46, H.lives.y, i < s.lives);
    drawText(ctx, '×' + s.combo, H.combo.x, H.combo.y, H.combo.size, s.combo > 1 ? '#ffe27a' : 'rgba(255,255,255,0.6)', 800);
    drawText(ctx, 'LEVEL ' + s.level, H.level.x, H.level.y1, H.level.size, '#fff', 700);
    fitText(ctx, s.name.toUpperCase(), H.level.x, H.level.y2, H.level.max, H.level.size, 'rgba(255,255,255,0.9)', 700, 16);
    const prog = Math.min(1, s.t / s.duration), b = H.bar;
    ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.beginPath(); ctx.roundRect(b.x, b.y, b.w, b.h, 6); ctx.fill();
    ctx.fillStyle = '#ffd27a'; ctx.beginPath(); ctx.roundRect(b.x, b.y, Math.max(12, b.w * prog), b.h, 6); ctx.fill();
    if (s.feats.seeds) drawText(ctx, '◆ ' + s.seedsGot, H.seeds.x, H.seeds.y, 32, '#ffd24a', 800);
    if (s.feats.hitback) for (let i = 0; i < 3; i++) acorn(ctx, H.ammo.x - 40 + i * 40, H.ammo.y, i < s.ammo);
    if (s.feats.wind) {
      if (!auto) card(ctx, H.right);
      const wp = auto && L.ap.wind ? L.ap.wind : H.wind;
      fitText(ctx, windStr(s), wp.x, wp.y, wp.max, 30, '#d6f0ff', 800, 16);
    }
  }
  ctx.restore();
  if (!auto) drawButton(ctx, L.btn.play.pause, '', { icon: 'pause' });
  if (s.feats.boss && s.t < 4) fitText(ctx, 'THE MASTER HUNTER', H.cx, H.bossY, H.bossW, 54, '#ffd0c0', 800, 24);
  if (s.blurb && s.t > 0.4 && s.t < 7) {
    ctx.save(); ctx.globalAlpha = Math.min(1, (7 - s.t) / 1.2);
    ctx.font = `700 26px ${FONT}`;
    const words = s.blurb.split(' '), lines = []; let cur = '';
    for (const w of words) { const t2 = cur ? cur + ' ' + w : w; if (ctx.measureText(t2).width > H.blurbW && cur) { lines.push(cur); cur = w; } else cur = t2; }
    lines.push(cur);
    lines.forEach((ln, i) => drawText(ctx, ln, H.cx, H.blurbY + i * 36, 26, '#fff', 700));
    ctx.restore();
  }
}

// ---- title --------------------------------------------------------------------------------------------------------------
export function drawTitle(ctx, L, { level, name, best, dev, lockDown }) {
  const T = L.title, B = L.btn.title;
  const tmax = T.title.max || L.w - 40;
  fitText(ctx, 'Perch', T.title.x, T.title.y, tmax, T.title.size, '#fff', 800, 40);
  if (L.land) wrapText(ctx, 'Read the stone. Choose your moment.', T.tag.x, T.tag.y, T.tag.max, T.tag.size, T.tag.size + 8, '#fff8e0', 700);
  else fitText(ctx, 'Read the stone. Choose your moment.', T.tag.x, T.tag.y, T.tag.max, T.tag.size, '#fff8e0', 700);
  const cx = L.land ? T.title.x : L.w / 2, mx = L.land ? T.title.max : L.w - 60;
  if (level > 1 || dev) fitText(ctx, 'Level ' + level + ' · ' + name, cx, T.levelY, mx, 36, '#ffe27a', 800, 18);
  if (best > 0) fitText(ctx, 'Best ' + best, cx, T.statY, mx, 30, '#fff', 700, 18);
  drawButton(ctx, B.play, level > 1 ? 'Play · Level ' + level : 'Play', { primary: true, size: 44 });
  drawButton(ctx, B.auto, 'Auto Play', { size: 30 });
  drawButton(ctx, B.rules, 'Rules', { size: 30 });
  if (lockup && lockup.width) { ctx.save(); ctx.fillStyle = lockDown ? 'rgba(255,226,122,0.55)' : 'rgba(12,22,40,0.55)'; ctx.beginPath(); ctx.roundRect(T.lockup.x - 12, T.lockup.y - 6, T.lockup.w + 24, T.lockup.h + 12, (T.lockup.h + 12) / 2); ctx.fill(); ctx.globalAlpha = 1; ctx.drawImage(lockup, T.lockup.x, T.lockup.y, T.lockup.w, T.lockup.h); ctx.restore(); }
  if (dev) {
    drawButton(ctx, B.devPrev, '‹', { size: 36 }); drawButton(ctx, B.devNext, '›', { size: 36 });
    drawText(ctx, 'TEST', (B.devPrev.x + B.devNext.x + B.devNext.w) / 2 - 0, B.devPrev.y + B.devPrev.h / 2 + 8, 22, '#9fe8ff', 700);
  }
}

// ---- pause ----------------------------------------------------------------------------------------------------------------
export function drawPause(ctx, L) {
  ctx.fillStyle = 'rgba(8,14,28,0.62)'; ctx.fillRect(0, 0, L.w, L.h);
  const c = L.pauseCard; ctx.fillStyle = 'rgba(16,24,40,0.9)'; ctx.beginPath(); ctx.roundRect(c.x, c.y, c.w, c.h, 28); ctx.fill();
  ctx.strokeStyle = 'rgba(255,226,122,0.5)'; ctx.lineWidth = 3; ctx.stroke();
  drawText(ctx, 'Paused', L.pauseTitle.x, L.pauseTitle.y, 84, '#ffe27a');
  drawButton(ctx, L.btn.pause.resume, 'Resume', { primary: true, size: 42 });
  drawButton(ctx, L.btn.pause.menu, 'Main Menu', { size: 32 });
}

// ---- result -----------------------------------------------------------------------------------------------------------------
export function drawResult(ctx, L, s, { won, lock, label, auto = false, starsN = 0 }) {
  const R = L.result, k = won ? R.won : R.over, B = L.btn.result;
  ctx.fillStyle = won ? 'rgba(30,20,50,0.5)' : 'rgba(15,25,45,0.55)'; ctx.fillRect(0, 0, L.w, L.h);
  const lx = L.land ? R.cxL : R.cx, rx = L.land ? R.cxR : R.cx, mw = L.land ? R.colMax : Math.min(L.w - 60, 640);
  const star = (y) => { for (let i = 0; i < 3; i++) drawText(ctx, '★', lx + (i - 1) * 96, y, 84, i < starsN ? '#ffe27a' : 'rgba(255,255,255,0.3)'); };
  fitText(ctx, won ? 'Sunset!' : 'Ruffled!', lx, k.title, mw, won ? 100 : 96, won ? '#ffd27a' : '#fff', 800, 40);
  if (auto) fitText(ctx, 'Auto Play · Level ' + s.level + ' · ' + s.name, lx, k.sub, mw, 30, '#fff8e0', 700, 16);
  else fitText(ctx, won ? 'Level ' + s.level + ' cleared' : 'Level ' + s.level + ' · ' + Math.round(s.t) + ' of ' + s.duration + ' s', lx, k.sub, mw, won ? 42 : 36, '#fff', 700, 18);
  if (won && !auto) star(k.stars);
  fitText(ctx, String(s.score), rx, k.score, L.land ? R.colMax : mw, won ? 120 : 150, '#ffe27a', 800, 40);
  const stats = won && !auto ? `${s.hits === 0 ? 'Not a feather ruffled' : s.hits + ' hit' + (s.hits > 1 ? 's' : '')} · ${s.closeCalls} close calls` : `${s.dodges} dodges · ${s.closeCalls} close calls`;
  fitText(ctx, stats, rx, k.stats, L.land ? R.colMax : mw, 30, '#fff', 700, 16);
  const again = won ? B.againW : B.again, menu = won ? B.menuW : B.menu;
  drawButton(ctx, again, label, { primary: true, size: 40, disabled: lock > 0 });
  drawButton(ctx, menu, auto ? 'Exit' : 'Main Menu', { size: 32 });
  if (!auto) drawMoreLine(ctx, rx, won ? R.moreWon : R.moreOver, 22);
}

export function drawDemoLimit(ctx, L) {
  ctx.fillStyle = 'rgba(15,25,45,0.7)'; ctx.fillRect(0, 0, L.w, L.h);
  const c = L.demo.cy, mw = Math.min(L.w - 60, 700);
  fitText(ctx, 'That was the taste.', L.w / 2, c - 110, mw, 64, '#fff', 800, 28);
  fitText(ctx, 'Get Perch on iPhone and Android', L.w / 2, c - 40, mw, 34, '#fff8e0', 700, 18);
  fitText(ctx, 'for every level.', L.w / 2, c + 4, mw, 34, '#fff8e0', 700, 18);
  drawButton(ctx, L.btn.demo.menu, 'Main Menu', { size: 32 });
}

// ---- Auto Play chrome -------------------------------------------------------------------------------------------------
export function renderAutoChrome(ctx, L, s, auto, thinkIdx, t, autoReveal) {
  const B = L.btn.auto, ap = L.ap;
  drawButton(ctx, B.exit, 'Exit', { size: 28 });
  drawButton(ctx, B.pause, auto.paused ? 'Resume' : 'Pause', { size: 28, primary: auto.paused });
  drawButton(ctx, B.skip, 'Skip', { size: 28, disabled: auto.paused });
  const mw = L.land ? Math.min(L.w * 0.4, 560) : L.w - 40;
  if (auto.paused) fitText(ctx, 'Auto Play paused', ap.status.x, ap.status.y, mw, 28, '#ffd97a', 700, 16);
  else if (auto.sub === 'think') fitText(ctx, 'Auto Play — thinking… ' + Math.max(0, Math.ceil(auto.timer)) + 's', ap.status.x, ap.status.y, mw, 28, '#cbb9e0', 700, 16);
  else if (auto.sub === 'reveal') fitText(ctx, 'Auto Play — here it flits…', ap.status.x, ap.status.y, mw, 28, '#ffd97a', 700, 16);
  else fitText(ctx, 'AUTO PLAY · WATCH & LEARN', ap.status.x, ap.status.y, mw, 22, 'rgba(255,255,255,0.7)', 700, 16);
  const decOn = thinkIdx > 0, incOn = thinkIdx < AUTO_THINK_STEPS.length - 1;
  drawButton(ctx, B.dec, 'Think −', { size: 28, disabled: !decOn });
  drawButton(ctx, B.inc, 'Think +', { size: 28, disabled: !incOn });
  fitText(ctx, 'Think: ' + AUTO_THINK_STEPS[thinkIdx] + 's', ap.think.x, ap.think.y, ap.think.max || L.w - 560, 26, '#ffe27a', 700, 16);
}
