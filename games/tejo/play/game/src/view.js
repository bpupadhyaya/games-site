// The play screen: court, box, discs, aim marks, flight, effects, scoreboard, buttons and banners.
import { FONT, NUM, C, panel, roundPath, paintButton, wrapLines, textShadow } from './ui.js';
import { FR, playLayout, TEXT_SCALES, inRect } from './layout.js';
import { drawBackdrop, drawBoard, drawDisc, drawFx, TEAM, P } from './art.js';
import { BOX, DISC_R, RING, HAND, LEVELS, TREMOR_START, sigmaAt, HUMAN_SIGMA } from './sim.js';
import { sideNames, winLine } from './menus.js';
import { drawLockupImg } from './brand.js';
import { v3 } from './v3.js';

export const T_FLY = 0.85;
const lerp = (a, b, t) => a + (b - a) * t;

// Screen position of the rest spot's disc and of a box point
export const boardPt = (L, u, v) => P(L.board, u, v);

export function aimShown(state) { return state.m.aimShown || state.m.aim; }
export const baseSigma = (state, side) => {
  const c = state.m.cfg;
  if (c.mode === 'ai') return side === 0 ? HUMAN_SIGMA : LEVELS[c.opp].sigma;
  if (c.mode === 'watch') return LEVELS[c.watch[side]].sigma;
  return HUMAN_SIGMA;
};

function drawAim(ctx, state, L) {
  const m = state.m, R = L.board, side = m.turn;
  const a = aimShown(state), p = P(R, a.u, a.v), rest = L.rest;
  const guide = state.settings.guide, out = a.u < 0 || a.u > BOX || a.v < 0 || a.v > BOX;
  const col = out ? '#ff8a7a' : '#ffffff';
  ctx.save();
  if (guide) {
    // dotted arc from the disc to the mark
    const mx = (rest.x + p.x) / 2, my = Math.min(rest.y, p.y) - Math.hypot(p.x - rest.x, p.y - rest.y) * 0.32 - 30;
    ctx.setLineDash([2, 12]); ctx.lineCap = 'round'; ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(255,240,200,0.8)';
    ctx.beginPath(); ctx.moveTo(rest.x, rest.y - 10); ctx.quadraticCurveTo(mx, my, p.x, p.y); ctx.stroke(); ctx.setLineDash([]);
    // likely scatter
    const sg = sigmaAt(baseSigma(state, side), Math.max(0, Math.min(100, a.v))) * 1.5 * R.s;
    ctx.setLineDash([9, 8]); ctx.lineWidth = 3; ctx.strokeStyle = TEAM[side].light; ctx.beginPath(); ctx.arc(p.x, p.y, sg, 0, 7); ctx.stroke(); ctx.setLineDash([]);
  }
  ctx.lineWidth = 3; ctx.strokeStyle = col; ctx.fillStyle = 'rgba(255,255,255,0.14)';
  ctx.beginPath(); ctx.arc(p.x, p.y, DISC_R * R.s, 0, 7); ctx.fill(); ctx.stroke();
  const k = Math.max(14, DISC_R * R.s * 0.6);
  ctx.beginPath(); ctx.moveTo(p.x - k - 8, p.y); ctx.lineTo(p.x + k + 8, p.y); ctx.moveTo(p.x, p.y - k - 8); ctx.lineTo(p.x, p.y + k + 8); ctx.stroke();
  // tremor warning ring
  if (m.drag && m.hold > TREMOR_START - 0.6) {
    const f = Math.min(1, Math.max(0, (m.hold - (TREMOR_START - 0.6)) / 1.4));
    ctx.strokeStyle = `rgba(255,120,90,${0.35 + 0.5 * f})`; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(p.x, p.y, DISC_R * R.s + 10 + 4 * Math.sin(state.t * 30) * f, 0, 7); ctx.stroke();
  }
  ctx.restore();
}

function drawFlight(ctx, state, L) {
  const m = state.m, fl = m.fl;
  if (!fl || fl.t >= T_FLY + 0.02 || fl.res.status === 'ring' && fl.landed) return;
  const R = L.board, res = fl.res, k = Math.min(1, fl.t / T_FLY);
  const target = P(R, res.land.u, res.land.v), from = L.rest;
  const e = 1 - Math.pow(1 - k, 1.6);
  const arc = Math.min(520, 180 + Math.hypot(target.x - from.x, target.y - from.y) * 0.42);
  const x = lerp(from.x, target.x, e), y = lerp(from.y, target.y, e) - arc * 4 * k * (1 - k);
  const r = lerp(34, DISC_R * R.s, e) * (1 + 0.35 * Math.sin(Math.PI * k));
  // ground shadow slides along the lane
  ctx.save(); ctx.fillStyle = 'rgba(0,0,0,0.32)'; ctx.beginPath();
  ctx.ellipse(lerp(from.x, target.x, e) + 6, lerp(from.y, target.y, e) + 10, r * (1.0 - 0.3 * Math.sin(Math.PI * k)), r * 0.5, 0, 0, 7); ctx.fill(); ctx.restore();
  drawDisc(ctx, x, y, r, res.side, { shadow: 0.2 });
}

function sideBlock(ctx, x, y, w, h, side, state, m, name, hs, active) {
  const tm = TEAM[side];
  panel(ctx, x, y, w, h, { r: 18, accent: active ? tm.main : 'rgba(224,170,70,0.6)', lw: active ? 3.5 : 2 });
  ctx.save();
  if (active) { ctx.globalAlpha = 0.14 + 0.08 * Math.sin(state.t * 5); ctx.fillStyle = tm.main; roundPath(ctx, x + 6, y + 6, w - 12, h - 12, 12); ctx.fill(); ctx.globalAlpha = 1; }
  drawDisc(ctx, x + 32, y + h / 2, 18, side, { noShadow: true });
  ctx.textBaseline = 'middle'; ctx.textAlign = 'left'; ctx.fillStyle = '#fff1d2';
  ctx.font = `700 ${Math.round(20 * hs)}px ${FONT}`; ctx.fillText(name, x + 60, y + h * 0.3, w - 62 - 70 * hs);
  // pips: discs left in this round, little steel coins in the team colour
  const left = m.left[side];
  for (let i = 0; i < m.perRound; i++) {
    const px = x + 68 + i * 22, py = y + h * 0.72;
    ctx.fillStyle = i < left ? tm.main : 'rgba(255,255,255,0.16)'; ctx.beginPath(); ctx.arc(px, py, 8, 0, 7); ctx.fill();
    if (i < left) { ctx.strokeStyle = tm.dark; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(px, py, 8, 0, 7); ctx.stroke(); ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.beginPath(); ctx.arc(px - 2.5, py - 2.5, 2.4, 0, 7); ctx.fill(); }
  }
  ctx.textAlign = 'right'; ctx.font = `900 ${Math.round(52 * Math.min(hs, 1.15))}px ${NUM}`; ctx.lineWidth = 5; ctx.lineJoin = 'round'; ctx.strokeStyle = 'rgba(10,5,2,0.85)';
  ctx.strokeText(String(m.score[side]), x + w - 18, y + h / 2 + 2); ctx.fillStyle = tm.light; ctx.fillText(String(m.score[side]), x + w - 18, y + h / 2 + 2);
  ctx.restore();
}

function drawHud(ctx, state, L) {
  const m = state.m, names = sideNames(m.cfg), hs = Math.min(1.35, TEXT_SCALES[state.settings.textIdx]);
  const solo = m.cfg.mode === 'solo';
  const act = m.ph === 'over' ? -1 : m.turn;
  if (!L.land) {
    const h = L.hud, mid = Math.max(112, 90 * hs), bw = (h.w - mid) / 2;
    sideBlock(ctx, h.x, h.y, bw - 6, h.h, 0, state, m, names[0] || 'You', hs, act === 0);
    if (!solo) sideBlock(ctx, h.x + bw + mid + 6, h.y, bw - 6, h.h, 1, state, m, names[1], hs, act === 1);
    ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#ffe9b0';
    const cx = h.x + h.w / 2;
    ctx.font = `800 ${Math.round(22 * hs)}px ${NUM}`; ctx.fillText(solo ? `Round ${m.round}/${m.rounds}` : `Round ${m.round}`, cx, h.y + h.h * 0.34);
    ctx.font = `600 ${Math.round(18 * hs)}px ${NUM}`; ctx.fillStyle = 'rgba(255,241,210,0.8)';
    ctx.fillText(solo ? `${m.left[0]} left` : `to ${m.target}`, cx, h.y + h.h * 0.68);
    ctx.restore();
  } else {
    const h = L.hud, bh = 100;
    sideBlock(ctx, h.x, h.y, h.w, bh, 0, state, m, names[0] || 'You', hs, act === 0);
    if (!solo) sideBlock(ctx, h.x, h.y + bh + 12, h.w, bh, 1, state, m, names[1], hs, act === 1);
    ctx.save(); ctx.textAlign = 'center'; ctx.fillStyle = '#ffe9b0'; ctx.textBaseline = 'middle';
    ctx.font = `800 ${Math.round(22 * hs)}px ${NUM}`; ctx.fillText(solo ? `Round ${m.round}/${m.rounds}  ·  ${m.left[0]} left` : `Round ${m.round}  ·  to ${m.target}`, h.x + h.w / 2, h.y + (solo ? bh : bh * 2 + 12) + 34);
    ctx.restore();
  }
}

function button(ctx, r, label, o = {}) {
  const { dy } = paintButton(ctx, r, o);
  ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = o.disabled ? 'rgba(255,255,255,0.35)' : o.primary ? C.ink : '#fff4dc';
  let px = Math.min(30, Math.round(r.h * 0.36));
  ctx.font = `800 ${px}px ${FONT}`;
  while (ctx.measureText(label).width > r.w - 18 && px > 12) { px--; ctx.font = `800 ${px}px ${FONT}`; }
  ctx.fillText(label, r.x + r.w / 2, r.y + r.h / 2 + dy);
  ctx.restore();
}

export function hintRects(L) {
  const s = L.sheet;
  return s ? { use: s.w < 340 ? { x: s.x + 10, y: s.y + s.h - 62, w: s.w - 20, h: 52 } : { x: s.x + s.w - 190, y: s.y + 8, w: 174, h: 52 }, close: { x: s.x + s.w - 52, y: s.y + 6, w: 46, h: 46 } } : {};
}

function drawSheet(ctx, state, L, text, title, withUse) {
  const s = L.sheet; if (!s) return;
  const hs = Math.min(1.5, TEXT_SCALES[state.settings.textIdx]);
  panel(ctx, s.x, s.y, s.w, s.h, { r: 20, fill: 'rgba(20,14,48,0.95)' });
  ctx.save(); ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  ctx.fillStyle = '#ffe08a'; ctx.font = `800 ${Math.round(22 * hs)}px ${FONT}`; ctx.fillText(title, s.x + 18, s.y + 14 + 22 * hs);
  const fs = Math.round(24 * hs); ctx.font = `500 ${fs}px ${FONT}`; ctx.fillStyle = '#fff1d2';
  const lines = wrapLines(ctx, text, s.w - 36), room = Math.floor((s.h - 14 - (22 * hs + 14 + 14) - (withUse && s.w < 340 ? 62 : 0)) / (fs * 1.3));
  lines.slice(0, Math.max(2, room)).forEach((l, i) => ctx.fillText(l, s.x + 18, s.y + 14 + 22 * hs + 14 + fs * (i + 1) * 1.3));
  ctx.restore();
  if (withUse) { const h = hintRects(L); button(ctx, h.use, 'Use this mark', { primary: true }); }
}

export function renderPlay(ctx, state) {
  const m = state.m, L = playLayout(), R = L.board, flat = !v3.on;
  ctx.save();
  if (state.shake > 0.01) ctx.translate(Math.sin(state.t * 90) * state.shake * 6, Math.cos(state.t * 77) * state.shake * 5);
  const aimPhase = m.ph === 'aim' || m.ph === 'think' || m.ph === 'reveal' || m.ph === 'act';
  if (flat) {
    drawBackdrop(ctx, FR.w, FR.h, state.t, L.court);
    drawBoard(ctx, R, m.board);
    // the resting disc
    if (aimPhase && m.left[m.turn] > 0 && !m.fl) drawDisc(ctx, L.rest.x, L.rest.y, 34, m.turn);
    if (m.fl) drawFlight(ctx, state, L);
    if (aimPhase && m.turn >= 0 && !m.fl && (m.ph === 'aim' && isHuman(m, m.turn) || m.ph === 'act' || m.ph === 'reveal')) drawAim(ctx, state, L);
  }
  // watch & learn: the candidates the computer weighed (3D draws the rings; the numbers are labels either way)
  if (m.ph === 'reveal' && m.plan && m.plan.top) {
    m.plan.top.forEach((c, i) => {
      const p = P(R, c.u, c.v);
      if (flat) { ctx.strokeStyle = i === 0 ? '#7dffb0' : 'rgba(255,255,255,0.65)'; ctx.lineWidth = i === 0 ? 5 : 3; ctx.beginPath(); ctx.arc(p.x, p.y, 12 + (i === 0 ? 5 : 0), 0, 7); ctx.stroke(); }
      ctx.fillStyle = i === 0 ? '#7dffb0' : '#fff'; ctx.font = `800 16px ${NUM}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      if (!flat) { ctx.save(); ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(14,6,30,0.9)'; ctx.lineJoin = 'round'; ctx.strokeText(String(i + 1), p.x, p.y + 1); ctx.restore(); }
      ctx.fillText(String(i + 1), p.x, p.y + 1);
    });
  }
  if (flat) {
    // the hint mark
    if (state.hint && m.ph === 'aim') {
      const p = P(R, state.hint.u, state.hint.v), pulse = 1 + 0.12 * Math.sin(state.t * 6);
      ctx.strokeStyle = '#7dffb0'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(p.x, p.y, (DISC_R * R.s + 8) * pulse, 0, 7); ctx.stroke();
      ctx.fillStyle = 'rgba(125,255,176,0.2)'; ctx.fill();
    }
    // the closest-disc line at the end of a round
    if (m.ph === 'bonus' && m.bonus) {
      const d = m.board.discs.find((q) => q.id === m.bonus.id);
      if (d) {
        const a = P(R, RING.u, RING.v), b = P(R, d.du ?? d.u, d.dv ?? d.v);
        ctx.setLineDash([8, 8]); ctx.strokeStyle = '#ffe08a'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); ctx.setLineDash([]);
        ctx.strokeStyle = TEAM[d.side].main; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(b.x, b.y, DISC_R * R.s + 7, 0, 7); ctx.stroke();
      }
    }
    drawFx(ctx, state.fx);
  }
  ctx.restore();
  // floating score text (not shaken)
  for (const f of state.floats) {
    const k = f.t / f.life, y = f.y - 70 * Math.min(1, k * 1.6), sc = f.big ? 1.25 : 1;
    ctx.save(); ctx.globalAlpha = Math.max(0, 1 - Math.max(0, k - 0.6) / 0.4); ctx.font = `900 ${Math.round(f.size * sc * (1 + 0.3 * Math.max(0, 1 - k * 6)))}px ${NUM}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 7; ctx.lineJoin = 'round'; ctx.strokeStyle = 'rgba(14,6,30,0.92)'; ctx.strokeText(f.text, f.x, y); ctx.fillStyle = f.col; ctx.fillText(f.text, f.x, y); ctx.restore();
  }
  if (!flat) {   // a soft vignette seats the scene and keeps the HUD readable
    const g = ctx.createRadialGradient(FR.w / 2, FR.h * 0.5, Math.min(FR.w, FR.h) * 0.35, FR.w / 2, FR.h * 0.5, Math.max(FR.w, FR.h) * 0.75);
    g.addColorStop(0, 'rgba(8,4,2,0)'); g.addColorStop(1, 'rgba(8,4,2,0.45)'); ctx.fillStyle = g; ctx.fillRect(0, 0, FR.w, FR.h);
  }
  drawHud(ctx, state, L);
  // message line
  ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const hs = Math.min(1.3, TEXT_SCALES[state.settings.textIdx]);
  ctx.font = `700 ${Math.round(22 * hs)}px ${FONT}`;
  const msg = statusText(state);
  const mw = ctx.measureText(msg).width + 36;
  roundPath(ctx, L.msg.x - mw / 2, L.msg.y - 18 * hs, mw, 36 * hs, 18 * hs); ctx.fillStyle = 'rgba(24,14,8,0.82)'; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(224,170,70,0.6)'; ctx.stroke();
  ctx.fillStyle = '#fff1d2'; ctx.fillText(msg, L.msg.x, L.msg.y + 1);
  ctx.restore();
  // buttons
  const watch = m.cfg.mode === 'watch';
  if (watch) {
    button(ctx, L.think, state.paused ? 'Resume' : 'Pause', { primary: state.paused });
    button(ctx, L.pause, 'Menu', {});
  } else {
    const canThink = isHuman(m, m.turn) && m.ph === 'aim' && !state.paused;
    button(ctx, L.think, 'Think', { disabled: !canThink, active: !!state.hint });
    button(ctx, L.pause, 'Pause', {});
  }
  // sheets
  if (state.hint && m.ph === 'aim') drawSheet(ctx, state, L, state.hint.text, 'Think', true);
  else if (watch && m.plan && (m.ph === 'think' || m.ph === 'reveal' || m.ph === 'act') && m.plan.text) drawSheet(ctx, state, L, m.ph === 'think' ? 'Weighing up the box: testing many simulated throws for each mark.' : m.plan.text, `${sideNames(m.cfg)[m.turn]} ${m.ph === 'think' ? 'is thinking' : 'chooses'}`, false);
  // banner
  if (m.banner) {
    const b = m.banner, k = b.t / b.life, pop = Math.min(1, b.t / 0.18), a = k > 0.75 ? 1 - (k - 0.75) / 0.25 : 1;
    const cy = R.y + BOX * R.s * 0.45;
    ctx.save(); ctx.globalAlpha = Math.max(0, a); ctx.translate(FR.w / 2, cy); ctx.scale(0.6 + 0.4 * pop, 0.6 + 0.4 * pop);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const sz = Math.min(92, FR.w * 0.12 + 10);
    ctx.font = `900 italic ${sz}px ${FONT}`; ctx.lineWidth = sz * 0.2; ctx.lineJoin = 'round'; ctx.strokeStyle = '#1a0f3a'; ctx.strokeText(b.text, 0, 0);
    ctx.fillStyle = b.col; ctx.fillText(b.text, 0, 0);
    if (b.sub) { ctx.font = `800 ${Math.round(sz * 0.36)}px ${NUM}`; ctx.lineWidth = 7; ctx.strokeText(b.sub, 0, sz * 0.7); ctx.fillStyle = '#fff1d2'; ctx.fillText(b.sub, 0, sz * 0.7); }
    ctx.restore();
  }
  if (state.paused && watch) {
    ctx.save(); ctx.fillStyle = 'rgba(8,4,20,0.35)'; ctx.fillRect(0, 0, FR.w, FR.h * 0.0); ctx.restore();
  }
}

export function isHuman(m, side) {
  const c = m.cfg.mode;
  return c === 'two' || c === 'solo' || (c === 'ai' && side === 0);
}

export function statusText(state) {
  const m = state.m, names = sideNames(m.cfg);
  if (state.paused && m.cfg.mode === 'watch') return 'Paused';
  switch (m.ph) {
    case 'intro': return `Round ${m.round}`;
    case 'aim': return isHuman(m, m.turn) ? (m.cfg.mode === 'two' ? `${names[m.turn]}: slide to aim, lift to throw` : 'Slide to aim, lift to throw') : `${names[m.turn]} is thinking`;
    case 'think': return `${names[m.turn]} is thinking`;
    case 'reveal': return `${names[m.turn]} picks a mark`;
    case 'act': return `${names[m.turn]} throws`;
    case 'fly': case 'settle': return ' ';
    case 'bonus': return m.bonus ? `Closest disc: ${names[m.bonus.side] || 'You'}` : 'No closest disc';
    case 'roundEnd': return `Round ${m.round} done`;
    case 'over': return m.winner >= 0 && m.cfg.mode !== 'solo' ? winLine(names[m.winner]) : 'Match over';
    default: return ' ';
  }
}
export { inRect, lerp, drawLockupImg };
