// The play screen: the pond (turned in landscape), the people, the aim preview, particles, the scoreboard, the toast and the
// controls. Pure drawing from `state` (game.js owns it). All positions come from layout.js.
import { W, H, host, playLayout, toScreen, toWorld, TEXT_SCALES, THINK_STEPS, PULL } from './layout.js';
import { HW, HH, bodyById, skatersOf, puckOf } from './sim.js';
import { drawShore, drawBanks, drawIce, drawGoal, drawSnow, drawTrails, drawSkater, drawPuck, makeCanvas, LOOKS } from './art.js';
import { FONT, DISPLAY, roundPath, drawButton, wrapLines } from './ui.js';
import { PROFILES } from './opponents.js';

const TAU = Math.PI * 2;
export const SIDE_COL = [['#e0584c', '#8f1d1f'], ['#4a93d0', '#1f5a94']];

export const layoutOf = (state) => playLayout(TEXT_SCALES[state.settings.textIdx], !!state.m && state.m.cfg.mode === 'watch');

// Who is who, for the labels.
export function sideName(state, side) {
  const m = state.m;
  if (!m) return side === 0 ? 'You' : 'Rival';
  if (m.cfg.mode === 'two') return side === 0 ? 'Player 1' : 'Player 2';
  if (m.cfg.mode === 'watch') return PROFILES[side === 0 ? m.cfg.watchA : m.cfg.opp].name;
  return side === 0 ? 'You' : PROFILES[m.cfg.opp].name;
}

// ---- the pond in its place on the screen -------------------------------------------------------------------------
export function withBoard(ctx, L, fn) {
  ctx.save(); ctx.translate(L.cx, L.cy); ctx.rotate(L.rot); ctx.scale(L.s, L.s);
  fn(); ctx.restore();
}

// The still part of the pond (shoreline, banks, ice) is painted once per screen shape into an off-screen canvas and then just
// copied each frame; the moving part (goals, drifts, trails, people, particles) is drawn live on top.
const backdrops = [];
function backdropFor(ctx, L) {
  const tf = ctx.getTransform ? ctx.getTransform() : null;
  if (!tf) return null;
  const sc = Math.hypot(tf.a, tf.b);
  const pw = Math.ceil(W * sc), ph = Math.ceil(H * sc);
  if (!sc || pw * ph > 14e6) return null;
  const key = `${pw}x${ph}|${L.rot.toFixed(3)}|${L.s.toFixed(4)}|${Math.round(L.cx)}|${Math.round(L.cy)}`;
  let b = backdrops.find((q) => q.key === key);
  if (b) return b.canvas;
  const canvas = makeCanvas(pw, ph);
  if (!canvas) return null;
  const g = canvas.getContext('2d');
  g.setTransform(sc, 0, 0, sc, 0, 0);
  paintStill(g, L);
  b = { key, canvas }; backdrops.unshift(b); if (backdrops.length > 2) backdrops.pop();
  return canvas;
}
function paintStill(ctx, L) {
  withBoard(ctx, L, () => {
    const ext = Math.max(W, H) / L.s;
    const cs = [toWorld(L, 0, 0), toWorld(L, W, 0), toWorld(L, 0, H), toWorld(L, W, H)];
    const vb = { x0: Math.min(...cs.map((q) => q.x)), x1: Math.max(...cs.map((q) => q.x)), y0: Math.min(...cs.map((q) => q.y)), y1: Math.max(...cs.map((q) => q.y)) };
    drawShore(ctx, Math.max(2400, ext), vb);
    drawBanks(ctx);
    drawIce(ctx, 0);
  });
}

export function drawPond(ctx, L, w, parts, o = {}) {
  const t = o.t ?? 0;
  const bg = backdropFor(ctx, L);
  if (bg) ctx.drawImage(bg, 0, 0, W, H); else paintStill(ctx, L);
  withBoard(ctx, L, () => {
    if (o.glow) drawIce(ctx, o.glow, true);
    drawGoal(ctx, -1, o.flash0 ?? 0, t); drawGoal(ctx, 1, o.flash1 ?? 0, t);
    for (const s of w.snow) drawSnow(ctx, s, t);
    if (o.trails) drawTrails(ctx, o.trails);
    if (o.under) o.under();
    // people and the puck, back to front so the near ones overlap the far ones
    const list = w.bodies.slice().sort((a, b) => a.y - b.y);
    for (const b of list) {
      if (b.kind === 'puck') drawPuck(ctx, b, t);
      else drawSkater(ctx, b, t, o.mark && o.mark[b.id] ? o.mark[b.id] : {});
    }
    if (o.over) o.over();
    drawParts(ctx, parts);
  });
}

function drawParts(ctx, parts) {
  for (const q of parts) {
    const k = 1 - q.t / q.max;
    ctx.save(); ctx.globalAlpha = Math.max(0, Math.min(1, k * 1.4));
    if (q.kind === 0) { ctx.fillStyle = q.col; ctx.beginPath(); ctx.arc(q.x, q.y, q.size * (0.6 + 0.6 * k), 0, TAU); ctx.fill(); }
    else if (q.kind === 1) { ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.lineTo(q.x - q.vx * 0.04, q.y - q.vy * 0.04); ctx.stroke(); }
    else if (q.kind === 2) { ctx.strokeStyle = q.col; ctx.lineWidth = 3 * k + 1; ctx.beginPath(); ctx.arc(q.x, q.y, q.size * (1 - k) + 6, 0, TAU); ctx.stroke(); }
    else if (q.kind === 3) {
      ctx.translate(q.x, q.y); ctx.rotate(q.rot + q.t * 6); ctx.fillStyle = q.col;
      if (q.leaf) { ctx.beginPath(); ctx.arc(0, 0, q.size * 0.9, 0, TAU); ctx.fill(); ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(0, -q.size * 0.1, q.size * 0.35, 0, TAU); ctx.fill(); }
      else ctx.fillRect(-q.size, -q.size * 0.5, q.size * 2, q.size);
    }
    ctx.restore();
  }
}

// ---- aim preview ------------------------------------------------------------------------------------------------
function drawAim(ctx, state, L) {
  const { w, aim, preview, hint, hintPreview, m } = state;
  if (!m || m.phase !== 'aim') return;
  const calm = state.settings.calm;
  const pv = state.humanTurn ? preview : null;
  const draw = pv ?? (hint ? hintPreview : null) ?? (state.think && state.think.phase !== 'think' ? preview : null);
  const id = aim.id ?? (hint && hint.id);
  const b = id && bodyById(w, id);
  if (!b) return;
  withBoard(ctx, L, () => {
    // the pull: a slingshot band from the skater backwards
    if (aim.active && (state.humanTurn || (state.think && state.think.phase === 'pull'))) {
      const len = 38 + aim.power * 120, bx = b.x - Math.cos(aim.ang) * len, by = b.y - Math.sin(aim.ang) * len;
      ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 4 / L.s * 0.8; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(bx, by); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.arc(bx, by, 14, 0, TAU); ctx.fill();
      ctx.strokeStyle = `hsl(${120 - aim.power * 110} 85% 55%)`; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(b.x, b.y, 44, aim.ang + Math.PI - 0.9 * aim.power * 2, aim.ang + Math.PI + 0.9 * aim.power * 2); ctx.stroke();
    }
    if (!draw) return;
    // the glide path of the skater, then the puck's path after contact
    ctx.lineCap = 'round';
    const path = calm ? draw.path : draw.path.slice(0, Math.max(3, Math.round(draw.path.length * 0.7)));
    ctx.strokeStyle = 'rgba(20,50,90,0.7)'; ctx.lineWidth = 7; ctx.setLineDash([2, 13]);
    ctx.beginPath(); path.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.97)'; ctx.lineWidth = 4.4; ctx.beginPath(); path.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.stroke();
    if (draw.puckPath.length > 1) {
      ctx.strokeStyle = 'rgba(255,196,60,0.95)'; ctx.lineWidth = 4; ctx.setLineDash([9, 9]);
      ctx.beginPath(); draw.puckPath.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.stroke();
      const e = draw.puckPath[draw.puckPath.length - 1]; ctx.setLineDash([]); ctx.fillStyle = 'rgba(255,196,60,0.5)'; ctx.beginPath(); ctx.arc(e.x, e.y, 12, 0, TAU); ctx.fill(); ctx.strokeStyle = '#ffc43c'; ctx.lineWidth = 2.5; ctx.stroke();
    }
    ctx.setLineDash([]);
    for (const h of draw.hits.slice(0, 2)) { ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(h.x, h.y, 11, 0, TAU); ctx.stroke(); }
  });
}

// ---- HUD ---------------------------------------------------------------------------------------------------------
function plate(ctx, r, rad = 20, alpha = 0.86) {
  roundPath(ctx, r.x, r.y + 4, r.w, r.h, rad); ctx.fillStyle = 'rgba(4,16,30,0.35)'; ctx.fill();
  roundPath(ctx, r.x, r.y, r.w, r.h, rad);
  const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h); g.addColorStop(0, `rgba(22,52,82,${alpha})`); g.addColorStop(1, `rgba(10,28,48,${alpha})`);
  ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = 1.6; ctx.strokeStyle = 'rgba(190,225,250,0.5)'; ctx.stroke();
}
function fitText(ctx, text, maxW, size, weight = 700, family = FONT) {
  let px = size; ctx.font = `${weight} ${px}px ${family}`;
  while (ctx.measureText(text).width > maxW && px > 11) { px -= 1; ctx.font = `${weight} ${px}px ${family}`; }
  return px;
}

function drawToken(ctx, x, y, side, r) {
  const L = LOOKS[side * 3];
  ctx.save(); ctx.translate(x, y);
  const g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, 1, 0, 0, r * 1.1); g.addColorStop(0, L.jacket[0]); g.addColorStop(1, L.jacket[1]);
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = L.toque; ctx.beginPath(); ctx.arc(0, 0, r * 0.52, 0, TAU); ctx.fill();
  ctx.strokeStyle = L.band; ctx.lineWidth = r * 0.16; ctx.beginPath(); ctx.arc(0, 0, r * 0.44, 0.6, TAU - 0.6); ctx.stroke();
  ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(-r * 0.05, 0, r * 0.2, 0, TAU); ctx.fill();
  ctx.restore();
}

function turnLine(state) {
  const m = state.m;
  if (m.over) return 'Final';
  if (m.phase === 'goal') return 'Goal!';
  const who = sideName(state, m.turn);
  if (m.cfg.mode === 'ai') return m.turn === 0 ? 'Your shot' : `${who} is thinking`;
  if (m.cfg.mode === 'watch') return `${who} to shoot`;
  return `${who} to shoot`;
}

function drawScore(ctx, state, L) {
  const m = state.m, fs = L.fs, sb = L.sb, t = state.t;
  plate(ctx, sb, 22);
  const sudden = m.sudden ? 'SUDDEN DEATH' : `FIRST TO ${m.cfg.goalsTo}`;
  const act = m.over ? -1 : m.turn;
  if (L.panel) {
    // tall panel: one row per side
    const rowH = Math.round(fs.score * 1.15 + 10), pad = 16;
    [0, 1].forEach((side) => {
      const y = sb.y + pad + side * (rowH + 8);
      if (act === side) { roundPath(ctx, sb.x + 8, y - 4, sb.w - 16, rowH + 8, 14); ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fill(); }
      drawToken(ctx, sb.x + pad + rowH * 0.45, y + rowH / 2, side, rowH * 0.42);
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#f2faff';
      const nx = sb.x + pad + rowH, maxW = sb.w - pad * 2 - rowH - fs.score * 1.2;
      fitText(ctx, sideName(state, side), maxW, fs.name); ctx.fillText(sideName(state, side), nx, y + rowH / 2 - (act === side ? fs.sub * 0.3 : 0));
      if (act === side) { fitText(ctx, turnLine(state), maxW, fs.sub); ctx.fillStyle = '#ffd36a'; ctx.fillText(turnLine(state), nx, y + rowH / 2 + fs.name * 0.62); }
      ctx.textAlign = 'right'; ctx.font = `italic 900 ${fs.score}px ${DISPLAY}`; ctx.fillStyle = '#ffffff'; ctx.fillText(String(m.scores[side]), sb.x + sb.w - pad, y + rowH / 2);
    });
    ctx.textAlign = 'center'; ctx.font = `700 ${fs.goals}px ${FONT}`; ctx.fillStyle = 'rgba(190,225,250,0.85)'; ctx.textBaseline = 'alphabetic';
    ctx.fillText(sudden, sb.x + sb.w / 2, sb.y + sb.h - 14);
    return;
  }
  const compact = sb.h < 84 || L.land;
  const mid = sb.x + sb.w / 2;
  if (compact) {
    const midW = Math.min(190, sb.w * 0.28), colW = (sb.w - midW - 24) / 2, tr = Math.min(16, sb.h * 0.26), sf = Math.min(fs.score, Math.round(sb.h * 0.72));
    [0, 1].forEach((side) => {
      const gx = side === 0 ? sb.x + 8 : sb.x + sb.w - 8 - colW, left = side === 0;
      if (act === side) { roundPath(ctx, gx, sb.y + 6, colW, sb.h - 12, 14); ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fill(); ctx.strokeStyle = SIDE_COL[side][0]; ctx.lineWidth = 2.4 + Math.sin(t * 6) * 0.6; ctx.stroke(); }
      drawToken(ctx, left ? gx + tr + 8 : gx + colW - tr - 8, sb.y + sb.h / 2, side, tr);
      ctx.textBaseline = 'middle'; ctx.font = `italic 900 ${sf}px ${DISPLAY}`; const sw = ctx.measureText(String(m.scores[side])).width;
      ctx.fillStyle = '#ffffff'; ctx.textAlign = left ? 'right' : 'left'; ctx.fillText(String(m.scores[side]), left ? gx + colW - 12 : gx + 12, sb.y + sb.h / 2 + 1);
      const nx0 = left ? gx + tr * 2 + 20 : gx + colW - tr * 2 - 20, room = colW - tr * 2 - 32 - sw - 8;
      fitText(ctx, sideName(state, side), room, fs.name); ctx.fillStyle = '#d8eeff'; ctx.textAlign = left ? 'left' : 'right'; ctx.fillText(sideName(state, side), nx0, sb.y + sb.h / 2);
    });
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = 'rgba(190,225,250,0.9)'; ctx.font = `700 ${fs.goals}px ${FONT}`; fitText(ctx, sudden, midW, fs.goals);
    ctx.fillText(sudden, mid, sb.y + sb.h * 0.42);
    fitText(ctx, turnLine(state), midW, fs.sub); ctx.fillStyle = '#ffd36a'; ctx.fillText(turnLine(state), mid, sb.y + sb.h * 0.74);
    return;
  }
  const colW = (sb.w - 170) / 2;
  [0, 1].forEach((side) => {
    const cx = side === 0 ? sb.x + colW / 2 + 12 : sb.x + sb.w - colW / 2 - 12;
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    if (act === side) { roundPath(ctx, cx - colW / 2 + 2, sb.y + 7, colW - 4, sb.h - 14, 16); ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fill(); ctx.strokeStyle = SIDE_COL[side][0]; ctx.lineWidth = 2.5 + Math.sin(t * 6) * 0.6; ctx.stroke(); }
    const tr = 20;
    drawToken(ctx, side === 0 ? cx - colW / 2 + tr + 10 : cx + colW / 2 - tr - 10, sb.y + sb.h / 2, side, tr);
    const tx = side === 0 ? cx + tr * 0.6 : cx - tr * 0.6, tw = colW - tr * 2 - 40;
    ctx.fillStyle = '#d8eeff'; ctx.textAlign = 'center';
    fitText(ctx, sideName(state, side), tw, fs.name); ctx.fillText(sideName(state, side), tx, sb.y + 32);
    ctx.font = `italic 900 ${fs.score}px ${DISPLAY}`; ctx.fillStyle = '#ffffff'; ctx.fillText(String(m.scores[side]), tx, sb.y + sb.h - 15);
  });
  ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(190,225,250,0.9)'; ctx.font = `700 ${fs.goals}px ${FONT}`; fitText(ctx, sudden, 150, fs.goals);
  ctx.fillText(sudden, mid, sb.y + sb.h * 0.43);
  ctx.fillStyle = '#ffd36a'; ctx.font = `700 ${fs.sub}px ${FONT}`; fitText(ctx, turnLine(state), 150, fs.sub);
  ctx.fillText(turnLine(state), mid, sb.y + sb.h * 0.72);
}

function drawToast(ctx, state, L) {
  if (!(state.toastT > 0) || !state.toast) return;
  const r = L.toast, fs = L.fs.toast;
  ctx.save(); ctx.globalAlpha = Math.min(1, state.toastT * 3);
  ctx.font = `700 ${fs}px ${FONT}`;
  const maxW = r.w - 40, lines = wrapLines(ctx, state.toast, maxW).slice(0, L.panel ? 5 : 2);
  const lh = fs * 1.22, h = lines.length * lh + 16, w = Math.min(r.w, Math.max(...lines.map((l) => ctx.measureText(l).width)) + 40);
  const x = r.x + (r.w - w) / 2, y = L.panel ? r.y : r.y + Math.max(0, (r.h - h) / 2);
  roundPath(ctx, x, y, w, h, 16); ctx.fillStyle = 'rgba(8,28,50,0.8)'; ctx.fill(); ctx.strokeStyle = 'rgba(190,225,250,0.4)'; ctx.lineWidth = 1.4; ctx.stroke();
  ctx.fillStyle = '#f2faff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  lines.forEach((l, i) => ctx.fillText(l, x + w / 2, y + 8 + lh * (i + 0.5)));
  ctx.restore();
}

function drawControls(ctx, state, L) {
  const m = state.m, fs = L.fs;
  if (m.cfg.mode === 'watch') {
    const D = L.demo;
    drawButton(ctx, D.pause, state.paused ? 'Resume' : 'Pause', { primary: !state.paused, active: state.paused, size: fs.demoBtn });
    drawButton(ctx, D.dec, 'Think −', { dark: true, size: Math.round(fs.demoBtn * 0.9), disabled: state.settings.thinkIdx === 0 });
    drawButton(ctx, D.inc, 'Think +', { dark: true, size: Math.round(fs.demoBtn * 0.9), disabled: state.settings.thinkIdx === THINK_STEPS.length - 1 });
    drawButton(ctx, D.exit, 'Leave', { dark: true, size: fs.demoBtn });
    return;
  }
  const busy = state.hintBusy;
  drawButton(ctx, L.hint, busy ? 'Thinking…' : 'Hint', { dark: true, size: fs.btn, disabled: !state.humanTurn || m.phase !== 'aim' });
  drawButton(ctx, L.menu, 'Menu', { dark: true, size: fs.btn });
}

function drawGoalBanner(ctx, state, L) {
  const m = state.m;
  if (m.phase !== 'goal' && !m.over) return;
  const side = m.lastGoal ?? 0, t = state.goalT ?? 0;
  const k = Math.min(1, t / 0.35), e = 1 - Math.pow(1 - k, 3);
  const p = toScreen(L, 0, 0);
  ctx.save(); ctx.translate(p.x, p.y); ctx.scale(0.4 + 0.6 * e, 0.4 + 0.6 * e); ctx.globalAlpha = Math.min(1, k * 1.5);
  const sz = Math.min(W, H) * (L.land ? 0.14 : 0.17);
  ctx.font = `italic 900 ${sz}px ${DISPLAY}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round'; ctx.lineWidth = sz * 0.2; ctx.strokeStyle = 'rgba(8,28,50,0.9)'; ctx.strokeText('GOAL!', 0, 0);
  const g = ctx.createLinearGradient(0, -sz / 2, 0, sz / 2); g.addColorStop(0, '#ffffff'); g.addColorStop(1, SIDE_COL[side][0]);
  ctx.fillStyle = g; ctx.fillText('GOAL!', 0, 0);
  const who = sideName(state, side), line = who === 'You' ? 'You score!' : `${who} scores!`;
  ctx.font = `700 ${sz * 0.26}px ${FONT}`; ctx.fillStyle = '#f2faff'; ctx.lineWidth = sz * 0.06; ctx.strokeText(line, 0, sz * 0.72);
  ctx.fillText(line, 0, sz * 0.72);
  ctx.restore();
}

// ---- the whole play screen ---------------------------------------------------------------------------------------
export function renderPlay(ctx, state) {
  const L = layoutOf(state), m = state.m, w = state.w;
  const mark = {};
  if (m.phase === 'aim' && !state.paused && !state.pass) {
    const pulse = 0.55 + 0.4 * Math.sin(state.t * 5);
    if (state.humanTurn) for (const b of skatersOf(w, m.turn)) mark[b.id] = { ring: 'rgba(255,255,255,0.9)', ringA: aimSel(state, b) ? 1 : 0.35 * pulse };
    else if (state.think && state.aim.id) mark[state.aim.id] = { ring: '#ffd36a', ringA: 0.9 };
  }
  drawPond(ctx, L, w, state.parts, {
    t: state.t, glow: m.phase === 'goal' ? Math.max(0, 1 - state.goalT / 2.2) * 0.8 : 0,
    flash0: m.phase === 'goal' && m.lastGoal === 0 ? Math.max(0, 1 - state.goalT / 2) : 0, flash1: m.phase === 'goal' && m.lastGoal === 1 ? Math.max(0, 1 - state.goalT / 2) : 0,
    trails: state.trails, mark,
  });
  drawAim(ctx, state, L);
  // vignette so the HUD reads on the scenery
  drawPops(ctx, state, L);
  drawScore(ctx, state, L);
  drawToast(ctx, state, L);
  drawControls(ctx, state, L);
  drawGoalBanner(ctx, state, L);
  if (state.pass) drawPass(ctx, state, L);
  void host;
}
const aimSel = (state, b) => state.aim.id === b.id;

function drawPops(ctx, state, L) {
  for (const p of state.pops) {
    const q = toScreen(L, p.x, p.y), k = p.t / p.max;
    ctx.save(); ctx.globalAlpha = Math.max(0, 1 - k * k); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const sz = p.size * Math.max(0.8, L.s);
    ctx.font = `italic 900 ${sz}px ${DISPLAY}`; ctx.lineWidth = sz * 0.2; ctx.strokeStyle = 'rgba(8,28,50,0.85)'; ctx.lineJoin = 'round';
    const y = q.y - k * 40;
    ctx.strokeText(p.text, q.x, y); ctx.fillStyle = p.col; ctx.fillText(p.text, q.x, y);
    ctx.restore();
  }
}

// Two-player hand-over card: covers only the control strip.
function drawPass(ctx, state, L) {
  const r = L.ctrl;
  roundPath(ctx, r.x, r.y, r.w, r.h, 18); ctx.fillStyle = 'rgba(12,40,66,0.96)'; ctx.fill(); ctx.strokeStyle = SIDE_COL[state.pass.side][0]; ctx.lineWidth = 3; ctx.stroke();
  ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const px = fitText(ctx, `Pass to ${sideName(state, state.pass.side)}: tap to shoot`, r.w - 24, L.fs.btn);
  ctx.fillText(`Pass to ${sideName(state, state.pass.side)}: tap to shoot`, r.x + r.w / 2, r.y + r.h / 2); void px;
}

// A tiny version of the pond for pictures (Rules). The caller supplies the box and what to draw in world units.
export function miniPond(ctx, x, y, w, h, fn, o = {}) {
  ctx.save(); roundPath(ctx, x, y, w, h, 16); ctx.clip();
  const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, '#cfe0ec'); g.addColorStop(1, '#a9c3d6'); ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  const rot = o.rot ?? 0, co0 = Math.cos(rot), si0 = Math.sin(rot);
  const s = o.s ?? Math.min(w / 700, h / 1000) * (o.zoom ?? 1);
  const [fx, fy] = o.focus ?? [0, 0];
  const cx = x + w / 2 - (fx * co0 - fy * si0) * s, cy = y + h / 2 - (fx * si0 + fy * co0) * s;
  ctx.translate(cx, cy); ctx.rotate(rot); ctx.scale(s, s);
  drawBanks(ctx); drawIce(ctx, 0); drawGoal(ctx, -1, 0, 0); drawGoal(ctx, 1, 0, 0);
  if (o.snow) for (const sn of o.snow) drawSnow(ctx, sn, 0);
  fn({ s, cx, cy, ctx });
  ctx.restore();
  roundPath(ctx, x, y, w, h, 16); ctx.strokeStyle = 'rgba(40,80,110,0.6)'; ctx.lineWidth = 2; ctx.stroke();
  const co = co0, si = si0;
  return { s, P: (wx, wy) => ({ x: cx + (wx * co - wy * si) * s, y: cy + (wx * si + wy * co) * s }) };
}
void HW; void HH; void puckOf; void PULL;
