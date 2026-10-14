// The play screen: the room, the table (turned a quarter in landscape), puck, paddles, coaching overlays, particles, the
// scoreboard, the toast and the controls. Pure drawing from `state` (game.js owns it). Positions come from layout.js.
import { W, H, host, playLayout, toScreen, TEXT_SCALES, THINK_STEPS } from './layout.js';
import { HW, HH, R_PAD, R_PUCK } from './sim.js';
import { drawRoom, drawTableStill, drawAirDots, drawShadow, drawPaddle, drawPuck, SIDE, OW, OH, rr, TAU } from './art.js';
import { FONT, DISPLAY, roundPath, drawButton, wrapLines } from './ui.js';
import { PROFILES } from './opponents.js';
import { v3 } from './v3.js';

export const layoutOf = (state) => playLayout(TEXT_SCALES[state.settings.textIdx], !!state.m && state.m.cfg.mode === 'watch', !!state.m && state.m.cfg.mode === 'two');

export function sideName(state, side) {
  const m = state.m;
  if (!m) return side === 0 ? 'You' : 'Rival';
  if (m.cfg.mode === 'two') return side === 0 ? 'Player 1' : 'Player 2';
  if (m.cfg.mode === 'watch') return PROFILES[side === 0 ? m.cfg.watchA : m.cfg.opp].name;
  return side === 0 ? 'You' : PROFILES[m.cfg.opp].name;
}

export function withBoard(ctx, L, fn) {
  ctx.save(); ctx.translate(L.cx, L.cy); ctx.rotate(L.rot); ctx.scale(L.s, L.s);
  fn(); ctx.restore();
}

// The whole table with everything on it. `w` is the sim world; `fx` = { parts, trail, shake, flash, ... }
export function drawTable(ctx, L, w, fx = {}) {
  withBoard(ctx, L, () => {
    const tf = ctx.getTransform ? ctx.getTransform() : null;
    const sc = tf && tf.a !== undefined ? Math.hypot(tf.a, tf.b) : 0;
    drawTableStill(ctx, sc);
    const u = w.puck;
    // goal flash on the pocket that conceded
    if (fx.flash > 0 && fx.pocket) {
      const sign = fx.pocket;
      const g = ctx.createRadialGradient(0, sign * HH, 10, 0, sign * HH, 260);
      g.addColorStop(0, `rgba(255,220,120,${0.85 * fx.flash})`); g.addColorStop(1, 'rgba(255,160,60,0)');
      ctx.fillStyle = g; ctx.fillRect(-HW, sign > 0 ? HH - 220 : -HH - 40, HW * 2, 260);
    }
    // air glow under moving things
    const objs = [{ x: u.x, y: u.y, r: 96, a: 1 }];
    for (const p of w.pads) objs.push({ x: p.x, y: p.y, r: R_PAD + 46, a: 0.55 });
    drawAirDots(ctx, objs);
    // puck trail
    if (fx.trail && fx.trail.length) {
      for (let i = 0; i < fx.trail.length; i++) {
        const q = fx.trail[i], k = (i + 1) / fx.trail.length;
        ctx.fillStyle = `rgba(255,214,110,${0.03 + 0.2 * k * q.a})`;
        ctx.beginPath(); ctx.arc(q.x, q.y, R_PUCK * (0.25 + 0.5 * k), 0, TAU); ctx.fill();
      }
    }
    // coaching: lines and rings under the pieces
    if (fx.coach) drawCoach(ctx, fx.coach, fx.t || 0);
    // shadows, paddles, puck
    for (const p of w.pads) drawShadow(ctx, p.x, p.y, R_PAD, 1);
    if (!w.goal || fx.showPuck) drawShadow(ctx, u.x, u.y, R_PUCK * (u.scale ?? 1), 0.55);
    for (const p of w.pads) drawPaddle(ctx, p, p.side, fx.mark && fx.mark[p.side] ? fx.mark[p.side] : {});
    drawPuck(ctx, u, { glow: fx.puckGlow || 0 });
    // particles
    if (fx.parts) drawParts(ctx, fx.parts);
    // serve marker: a ring pulses around a puck waiting to be served
    if (fx.serveRing) {
      ctx.strokeStyle = `rgba(255,240,170,${0.5 + 0.4 * Math.sin((fx.t || 0) * 8)})`; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(u.x, u.y, R_PUCK + 8 + 2 * Math.sin((fx.t || 0) * 8), 0, TAU); ctx.stroke();
    }
  });
}

function drawParts(ctx, parts) {
  for (const q of parts) {
    const k = q.t / q.max, a = Math.max(0, 1 - k);
    if (q.kind === 0) { ctx.fillStyle = q.col; ctx.globalAlpha = a * 0.8; ctx.beginPath(); ctx.arc(q.x, q.y, q.size * (1 - k * 0.4), 0, TAU); ctx.fill(); ctx.globalAlpha = 1; }
    else if (q.kind === 1) { ctx.strokeStyle = `rgba(255,236,160,${a})`; ctx.lineWidth = 2.6; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.lineTo(q.x - q.vx * 0.04, q.y - q.vy * 0.04); ctx.stroke(); }
    else if (q.kind === 2) { ctx.strokeStyle = q.col; ctx.globalAlpha = a; ctx.lineWidth = 4 * (1 - k) + 1; ctx.beginPath(); ctx.arc(q.x, q.y, q.size * (0.4 + k), 0, TAU); ctx.stroke(); ctx.globalAlpha = 1; }
    else {
      ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.rot + k * 6); ctx.globalAlpha = Math.min(1, a * 1.6); ctx.fillStyle = q.col;
      if (q.leaf) { ctx.beginPath(); ctx.moveTo(0, -q.size); ctx.quadraticCurveTo(q.size * 0.9, 0, 0, q.size); ctx.quadraticCurveTo(-q.size * 0.9, 0, 0, -q.size); ctx.fill(); }
      else ctx.fillRect(-q.size / 2, -q.size / 4, q.size, q.size / 2);
      ctx.restore();
    }
  }
}

// The coach / reveal overlay: the line the puck should take, the spot to stand on, and the path of an incoming puck.
function drawCoach(ctx, c, t) {
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (c.line && c.line.length > 1) {
    ctx.strokeStyle = 'rgba(20,6,0,0.55)'; ctx.lineWidth = 11; ctx.setLineDash([2, 17]);
    ctx.beginPath(); c.line.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.stroke();
    ctx.strokeStyle = c.kind === 'strike' ? '#ffd24a' : '#8ff0e0'; ctx.lineWidth = 6; ctx.setLineDash([12, 12]); ctx.lineDashOffset = -t * 40;
    ctx.beginPath(); c.line.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.stroke();
    ctx.setLineDash([]); ctx.lineDashOffset = 0;
    const e = c.line[c.line.length - 1];
    ctx.fillStyle = c.kind === 'strike' ? 'rgba(255,210,74,0.6)' : 'rgba(143,240,224,0.6)'; ctx.beginPath(); ctx.arc(e.x, e.y, 12, 0, TAU); ctx.fill();
  }
  if (c.stand) {
    const pulse = 0.5 + 0.5 * Math.sin(t * 6);
    ctx.strokeStyle = `rgba(255,255,255,${0.75 + 0.2 * pulse})`; ctx.lineWidth = 5; ctx.setLineDash([10, 8]);
    ctx.beginPath(); ctx.arc(c.stand.x, c.stand.y, R_PAD + 3 + 3 * pulse, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.beginPath(); ctx.arc(c.stand.x, c.stand.y, R_PAD, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

// ---- HUD ----------------------------------------------------------------------------------------------------------
function plate(ctx, r, rad = 20) {
  if (v3.on) { v3.panels.push({ r: { x: r.x, y: r.y, w: r.w, h: r.h }, rad, kind: 'plate' }); return; }
  roundPath(ctx, r.x, r.y + 5, r.w, r.h, rad); ctx.fillStyle = 'rgba(10,3,0,0.4)'; ctx.fill();
  roundPath(ctx, r.x, r.y, r.w, r.h, rad);
  const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h); g.addColorStop(0, 'rgba(98,52,28,0.97)'); g.addColorStop(1, 'rgba(52,26,12,0.97)');
  ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = 2.4; ctx.strokeStyle = '#d9a73a'; ctx.stroke();
  roundPath(ctx, r.x + 4, r.y + 4, r.w - 8, r.h - 8, rad - 4); ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(255,225,170,0.25)'; ctx.stroke();
}
function fitText(ctx, text, maxW, size, weight = 700, family = FONT) {
  let px = size; ctx.font = `${weight} ${px}px ${family}`;
  while (ctx.measureText(text).width > maxW && px > 10) { px -= 1; ctx.font = `${weight} ${px}px ${family}`; }
  return px;
}
function pips(ctx, x, y, n, got, col, r, dir = 1) {
  const gap = r * 2.5;
  for (let i = 0; i < n; i++) {
    const px = x + dir * i * gap;
    ctx.beginPath(); ctx.arc(px, y, r, 0, TAU);
    if (i < got) { const g = ctx.createRadialGradient(px - r * 0.3, y - r * 0.3, 1, px, y, r); g.addColorStop(0, '#fff6c8'); g.addColorStop(1, col); ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = 'rgba(30,10,0,0.6)'; ctx.lineWidth = 1; ctx.stroke(); }
    else { ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fill(); ctx.strokeStyle = 'rgba(255,225,170,0.3)'; ctx.lineWidth = 1; ctx.stroke(); }
  }
}
function icon(ctx, x, y, side, r) { drawPaddle(ctx, { x, y, hit: 0, ang: 0 }, side, {}); void r; }
function iconAt(ctx, x, y, side, r) {
  ctx.save(); ctx.translate(x, y); const k = r / R_PAD; ctx.scale(k, k); icon(ctx, 0, 0, side, R_PAD); ctx.restore();
}

function statusLine(state) {
  const m = state.m;
  if (m.over) return 'Final';
  if (m.phase === 'goal') return 'Goal!';
  if (m.phase === 'ready') return `${sideName(state, m.server)} ${sideName(state, m.server) === 'You' ? 'serve' : 'serves'}`;
  if (state.freeze) return state.freeze.kind === 'think' ? 'Thinking' : state.freeze.kind === 'reveal' ? 'The plan' : 'Hint';
  return 'Rally';
}

function drawScore(ctx, state, L) {
  const m = state.m, fs = L.fs, sb = L.sb, t = state.t;
  plate(ctx, sb, 22);
  const n = m.cfg.goalsTo;
  const head = `FIRST TO ${n}`;
  if (L.panel) {
    const rowH = Math.round(Math.max(fs.score * 1.15 + 10, 64)), pad = 16;
    [0, 1].forEach((side) => {
      const y = sb.y + pad + side * (rowH + 10);
      iconAt(ctx, sb.x + pad + rowH * 0.4, y + rowH / 2, side, rowH * 0.4);
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff3d6';
      const nx = sb.x + pad + rowH * 0.95, maxW = sb.w - pad * 2 - rowH * 0.95 - fs.score * 1.0;
      fitText(ctx, sideName(state, side), maxW, fs.name); ctx.fillText(sideName(state, side), nx, y + rowH * 0.3);
      pips(ctx, nx + 7, y + rowH * 0.72, n, m.scores[side], SIDE[side].body[1], 6.5);
      ctx.textAlign = 'right'; ctx.font = `italic 900 ${fs.score}px ${DISPLAY}`; ctx.fillStyle = '#fff6dd'; ctx.fillText(String(m.scores[side]), sb.x + sb.w - pad, y + rowH / 2);
    });
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = 'rgba(255,225,170,0.9)';
    const wmax = sb.w - 24, hy = sb.y + 2 * (rowH + 10) + pad + fs.goals * 0.4;
    fitText(ctx, head, wmax, fs.goals); ctx.fillText(head, sb.x + sb.w / 2, hy);
    ctx.fillStyle = '#ffd36a'; fitText(ctx, statusLine(state), wmax, fs.goals); ctx.fillText(statusLine(state), sb.x + sb.w / 2, hy + fs.goals * 1.25);
    return;
  }
  const midW = Math.min(200, sb.w * 0.3), colW = (sb.w - midW - 18) / 2;
  const sf = Math.min(fs.score, Math.round(sb.h * 0.7)), ir = Math.min(26, sb.h * 0.3);
  [0, 1].forEach((side) => {
    const left = side === 0, gx = left ? sb.x + 8 : sb.x + sb.w - 8 - colW;
    iconAt(ctx, left ? gx + ir + 4 : gx + colW - ir - 4, sb.y + sb.h / 2, side, ir);
    ctx.textBaseline = 'middle'; ctx.font = `italic 900 ${sf}px ${DISPLAY}`;
    const sw = ctx.measureText(String(m.scores[side])).width;
    ctx.fillStyle = '#fff6dd'; ctx.textAlign = left ? 'right' : 'left'; ctx.fillText(String(m.scores[side]), left ? gx + colW - 8 : gx + 8, sb.y + sb.h / 2 + 1);
    const tx = left ? gx + ir * 2 + 14 : gx + colW - ir * 2 - 14, room = colW - ir * 2 - 28 - sw - 6;
    const nameY = sb.y + sb.h * (sb.h > 70 ? 0.34 : 0.5);
    fitText(ctx, sideName(state, side), room, fs.name); ctx.fillStyle = '#ffe9c4'; ctx.textAlign = left ? 'left' : 'right'; ctx.fillText(sideName(state, side), tx, nameY);
    if (sb.h > 70) {
      const pr = Math.max(4.5, Math.min(7.5, room / (n * 2.5 + 1)));
      pips(ctx, left ? tx + pr : tx - pr, sb.y + sb.h * 0.72, n, m.scores[side], SIDE[side].body[1], pr, left ? 1 : -1);
    }
  });
  const mid = sb.x + sb.w / 2;
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = 'rgba(255,225,170,0.92)'; ctx.font = `700 ${fs.goals}px ${FONT}`; fitText(ctx, head, midW - 22, fs.goals);
  ctx.fillText(head, mid, sb.y + sb.h * 0.43);
  const sl = statusLine(state);
  ctx.fillStyle = '#ffd36a'; fitText(ctx, sl, midW - 22, fs.sub); ctx.fillText(sl, mid, sb.y + sb.h * 0.74);
  void t;
}

function drawToast(ctx, state, L) {
  if (!(state.toastT > 0) || !state.toast) return;
  const r = L.toast, fs = L.fs.toast;
  ctx.save(); ctx.globalAlpha = Math.min(1, state.toastT * 3);
  ctx.font = `700 ${fs}px ${FONT}`;
  const maxW = r.w - 40, lines = wrapLines(ctx, state.toast, maxW).slice(0, L.panel ? 5 : 2);
  const lh = fs * 1.22, h = lines.length * lh + 16, w = Math.min(r.w, Math.max(...lines.map((l) => ctx.measureText(l).width)) + 40);
  const x = r.x + (r.w - w) / 2, y = L.panel ? r.y : r.y + Math.max(0, (r.h - h) / 2);
  if (v3.on) v3.panels.push({ r: { x, y, w, h }, rad: 16, kind: 'toast' });
  else { roundPath(ctx, x, y, w, h, 16); ctx.fillStyle = 'rgba(40,16,6,0.86)'; ctx.fill(); ctx.strokeStyle = 'rgba(233,183,74,0.6)'; ctx.lineWidth = 1.6; ctx.stroke(); }
  ctx.fillStyle = '#fff3d6'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
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
  if (L.hint) drawButton(ctx, L.hint, state.freeze && state.freeze.kind === 'hint' ? 'Go on' : 'Hint', { dark: true, size: fs.btn, disabled: m.phase !== 'live' && !(state.freeze) });
  drawButton(ctx, L.menu, m.cfg.mode === 'two' ? 'Pause' : 'Menu', { dark: true, size: fs.btn });
}

function bigText(ctx, text, x, y, sz, c0, c1, k = 1) {
  ctx.save(); ctx.translate(x, y); ctx.scale(k, k);
  ctx.font = `italic 900 ${sz}px ${DISPLAY}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round'; ctx.lineWidth = sz * 0.2; ctx.strokeStyle = 'rgba(30,8,2,0.92)'; ctx.strokeText(text, 0, 0);
  const g = ctx.createLinearGradient(0, -sz / 2, 0, sz / 2); g.addColorStop(0, c0); g.addColorStop(1, c1);
  ctx.fillStyle = g; ctx.fillText(text, 0, 0);
  ctx.restore();
}

function drawBanners(ctx, state, L) {
  const m = state.m, p = toScreen(L, 0, 0), sz0 = Math.min(W, H) * (L.land ? 0.15 : 0.19);
  if (m.phase === 'goal') {
    const side = m.lastGoal ?? 0, t = state.goalT ?? 0, k = Math.min(1, t / 0.3), e = 1 - Math.pow(1 - k, 3);
    ctx.save(); ctx.globalAlpha = Math.min(1, k * 1.6);
    bigText(ctx, 'GOAL!', p.x, p.y - sz0 * 0.1, sz0, '#fffbe0', SIDE[side].body[0], 0.4 + 0.6 * e);
    const who = sideName(state, side), line = who === 'You' ? 'You score!' : `${who} ${who.startsWith('Player') ? 'scores' : 'scores'}!`;
    ctx.font = `700 ${sz0 * 0.27}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineWidth = sz0 * 0.07; ctx.strokeStyle = 'rgba(30,8,2,0.9)'; ctx.lineJoin = 'round';
    ctx.strokeText(line, p.x, p.y + sz0 * 0.58); ctx.fillStyle = '#fff3d6'; ctx.fillText(line, p.x, p.y + sz0 * 0.58);
    ctx.restore();
  } else if (m.phase === 'ready' && !state.freeze && m.readyT !== undefined) {
    const t = m.readyT, n = t < 0.6 ? '3' : t < 1.2 ? '2' : '1', frac = (t % 0.6) / 0.6;
    const k = 0.75 + 0.25 * (1 - frac);
    ctx.save(); ctx.globalAlpha = 0.5 + 0.5 * (1 - frac);
    bigText(ctx, n, p.x, p.y, sz0 * 1.1, '#fffbe0', '#ffbd4a', k);
    ctx.restore();
  }
}

function drawPops(ctx, state, L) {
  for (const p of state.pops) {
    const q = toScreen(L, p.x, p.y), k = p.t / p.max;
    ctx.save(); ctx.globalAlpha = Math.max(0, 1 - k * k);
    bigText(ctx, p.text, q.x, q.y - k * 40, p.size * Math.max(0.8, L.s), '#fffbe0', p.col);
    ctx.restore();
  }
}

// Watch & Learn think timer: a ring that fills around the serving paddle, drawn in screen space over the table.
function drawThink(ctx, state, L) {
  const f = state.freeze;
  if (!f || f.kind !== 'think') return;
  const w = state.w, pad = w.pads[f.side], k = Math.min(1, f.t / f.dur), r = R_PAD + 16;
  const arc = (a0, a1) => {
    ctx.beginPath();
    const n = Math.max(6, Math.ceil(48 * (a1 - a0) / TAU));
    for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n, q = toScreen(L, pad.x + Math.cos(a) * r, pad.y + Math.sin(a) * r); if (i) ctx.lineTo(q.x, q.y); else ctx.moveTo(q.x, q.y); }
    ctx.stroke();
  };
  ctx.save(); ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(20,6,0,0.5)'; arc(0, TAU);
  ctx.strokeStyle = '#ffd24a'; ctx.lineCap = 'round'; arc(-Math.PI / 2, -Math.PI / 2 + TAU * k);
  ctx.restore();
}

export function renderPlay(ctx, state) {
  const L = layoutOf(state), m = state.m, w = state.w;
  const c = toScreen(L, 0, 0);
  if (!v3.on) drawRoom(ctx, W, H, c.x, c.y, Math.max(W, H) * 0.75);
  const fx = {
    t: state.t, parts: state.parts, trail: state.trail,
    flash: m.phase === 'goal' ? Math.max(0, 1 - state.goalT / 1.6) : 0, pocket: state.pocket,
    coach: state.freeze && state.freeze.coach ? state.freeze.coach : null,
    serveRing: m.phase === 'ready' || (m.phase === 'live' && w.rallyHits === 0 && Math.hypot(w.puck.vx, w.puck.vy) < 5),
    puckGlow: m.phase === 'ready' ? 0.5 + 0.4 * Math.sin(state.t * 7) : 0,
    mark: state.mark, showPuck: true,
  };
  if (!v3.on) drawTable(ctx, L, w, fx);
  drawThink(ctx, state, L);
  drawPops(ctx, state, L);
  drawScore(ctx, state, L);
  drawToast(ctx, state, L);
  drawControls(ctx, state, L);
  drawBanners(ctx, state, L);
  void host;
}

// A small table for the Rules pictures. The caller supplies the box and what to draw in world units.
export function miniTable(ctx, x, y, w, h, fn, o = {}) {
  ctx.save(); roundPath(ctx, x, y, w, h, 16); ctx.clip();
  const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, '#3a1c0e'); g.addColorStop(1, '#241108'); ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  const rot = o.rot ?? 0, co0 = Math.cos(rot), si0 = Math.sin(rot);
  const s = o.s ?? Math.min(w / (OW * 2), h / (OH * 2)) * (o.zoom ?? 1);
  const [fx, fy] = o.focus ?? [0, 0];
  const cx = x + w / 2 - (fx * co0 - fy * si0) * s, cy = y + h / 2 - (fx * si0 + fy * co0) * s;
  ctx.translate(cx, cy); ctx.rotate(rot); ctx.scale(s, s);
  const tf = ctx.getTransform ? ctx.getTransform() : null;
  drawTableStill(ctx, tf && tf.a !== undefined ? Math.hypot(tf.a, tf.b) : 0);
  fn({ s, cx, cy, ctx });
  ctx.restore();
  roundPath(ctx, x, y, w, h, 16); ctx.strokeStyle = 'rgba(110,60,20,0.8)'; ctx.lineWidth = 2; ctx.stroke();
  return { s, P: (wx, wy) => ({ x: cx + (wx * co0 - wy * si0) * s, y: cy + (wx * si0 + wy * co0) * s }) };
}
void HH; void R_PAD;
