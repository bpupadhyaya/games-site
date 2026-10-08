// Everything drawn on the play screen: the table (room, mat, sticks, hint, finger, particles) and the HUD (score cards, info line
// with the steadiness meter, buttons, round banner). Pure drawing; game.js owns the state.
import { W, H, playLayout, TEXT_SCALES } from './layout.js';
import { SR, LH, TABLE, V0, KINDS, VALUE, KIND_NAME, valueOf } from './sim.js';
import { drawBackdrop, drawMat, drawStick, drawStickIcon, strokeStick, SIDE, FONT } from './art.js';
import { PROFILES } from './opponents.js';
import { roundPath, panel, drawButton, wrapLines } from './ui.js';
import { describePlan } from './ai.js';

const TAU = Math.PI * 2;
export const layoutOf = (state) => playLayout(TEXT_SCALES[state.settings.textIdx], !!(state.m && state.m.cfg.mode === 'watch'));
export const toScreen = (state, x, y) => { const b = layoutOf(state).board; return { x: b.cx + x * b.s, y: b.cy + y * b.s }; };
const isSolo = (m) => m.cfg.mode === 'solo' || m.cfg.mode === 'daily';

export function names(state) {
  const m = state.m, mode = m.cfg.mode;
  if (mode === 'two') return ['Player 1', 'Player 2'];
  if (mode === 'watch') return [PROFILES[m.cfg.watchA].name, PROFILES[m.cfg.opp].name];
  if (isSolo(m)) return ['You', ''];
  return ['You', PROFILES[m.cfg.opp].name];
}
const shortName = (n) => (n.length > 7 ? `${n.slice(0, 6)}.` : n);
function fitText(ctx, options, px, maxW, weight = 700) {
  ctx.font = `${weight} ${px}px ${FONT}`;
  for (const t of options) if (ctx.measureText(t).width <= maxW) return t;
  return options[options.length - 1];
}

// ---- the table ------------------------------------------------------------------------------------------------------
// o: { cx, cy, scale, over(ctx), hintId, freeIds }
export function drawTable(ctx, state, w, parts, o = {}) {
  const sc = o.scale ?? 1, cx = o.cx ?? W / 2, cy = o.cy ?? H / 2, t = state.t, p = w.pull;
  drawBackdrop(ctx, W, H, cx, cy);
  ctx.save(); ctx.translate(cx, cy); ctx.scale(sc, sc);
  drawMat(ctx);
  const list = w.sticks.slice().sort((a, b) => a.z - b.z || a.id - b.id);
  const pulledId = p && !p.tool ? p.id : -1;
  const flash = state.faultFlash || 0;
  for (const s of list) {
    if (s.id === pulledId) continue;
    const ratio = p && p.moved ? p.moved[s.id] || 0 : 0;
    let sx = s.x, sy = s.y;
    if (ratio > 0.12) { sx += Math.sin(t * 70 + s.id) * ratio * 1.1; sy += Math.cos(t * 63 + s.id * 2) * ratio * 1.1; }
    drawStick(ctx, sx === s.x && sy === s.y ? s : { ...s, x: sx, y: sy }, {
      warn: ratio > 0.12 ? ratio : 0, glow: flash > 0 && state.faultId === s.id ? `rgba(255,80,60,${Math.min(1, flash)})` : undefined,
    });
  }
  if (pulledId >= 0) {
    const s = w.sticks.find((q) => q.id === pulledId);
    if (s) drawStick(ctx, s, { lift: 7, warn: p.speed > V0 * 0.8 ? Math.min(1, (p.speed - V0 * 0.8) / (V0 * 0.6)) * 0.8 : 0 });
  }
  if (w.tool) drawStick(ctx, w.tool, { lift: 9 });
  if (o.freeIds) for (const s of list) if (o.freeIds.has(s.id) && o.hintId !== s.id) strokeStick(ctx, s, 'rgba(255,255,255,0.5)', 2, [3, 8]);
  if (o.hintId) { const h = w.sticks.find((q) => q.id === o.hintId); if (h) strokeStick(ctx, h, `rgba(120,230,255,${0.65 + 0.3 * Math.sin(t * 6)})`, 3.5); }
  if (o.over) o.over(ctx);
  drawParts(ctx, parts);
  ctx.restore();
}
function drawParts(ctx, parts) {
  for (const q of parts) {
    const k = q.t / q.max;
    ctx.save();
    if (q.kind === 0) {          // dust puff
      const r = q.size * (0.7 + k * 1.6);
      ctx.globalAlpha = (1 - k) * 0.35; const g = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, r);
      g.addColorStop(0, q.col); g.addColorStop(1, 'rgba(200,190,170,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(q.x, q.y, r, 0, TAU); ctx.fill();
    } else if (q.kind === 1) {   // spark
      const l = 8 * (1 - k), n = Math.hypot(q.vx, q.vy) || 1;
      ctx.globalAlpha = 1 - k; ctx.strokeStyle = q.col ?? '#fffbe8'; ctx.lineWidth = 2; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.lineTo(q.x - (q.vx / n) * l, q.y - (q.vy / n) * l); ctx.stroke();
    } else if (q.kind === 2) {   // ring pulse
      ctx.globalAlpha = (1 - k) * 0.85; ctx.strokeStyle = q.col; ctx.lineWidth = 3 * (1 - k) + 1; ctx.beginPath(); ctx.arc(q.x, q.y, q.size * (0.35 + k * 0.9), 0, TAU); ctx.stroke();
    } else {                     // sparkle
      ctx.globalAlpha = 1 - k; ctx.fillStyle = q.col; const s = q.size * (1 - k * 0.5);
      ctx.translate(q.x, q.y); ctx.rotate(q.t * 6);
      ctx.beginPath(); for (let i = 0; i < 8; i++) { const a = (i * Math.PI) / 4, r = i % 2 ? s * 0.35 : s; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }
}

// ---- overlays on the table (world coordinates) ----------------------------------------------------------------------------
function arrowHead(ctx, x, y, a, size, col) {
  ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - Math.cos(a - 0.5) * size, y - Math.sin(a - 0.5) * size); ctx.lineTo(x - Math.cos(a + 0.5) * size, y - Math.sin(a + 0.5) * size); ctx.closePath(); ctx.fill();
}
function drawPlan(ctx, state, plan, col) {
  const s = state.w.sticks.find((q) => q.id === plan.id);
  if (!s) return;
  const c = Math.cos(s.a), n = Math.sin(s.a), gx = s.x + c * plan.k * s.lh, gy = s.y + n * plan.k * s.lh, len = Math.min(230, plan.dist), pulse = 0.55 + 0.35 * Math.sin(state.t * 6);
  ctx.save(); ctx.lineCap = 'round';
  ctx.strokeStyle = col; ctx.globalAlpha = pulse; ctx.lineWidth = 3.6; ctx.setLineDash([2, 11]);
  ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(gx + Math.cos(plan.ang) * len, gy + Math.sin(plan.ang) * len); ctx.stroke(); ctx.setLineDash([]);
  arrowHead(ctx, gx + Math.cos(plan.ang) * len, gy + Math.sin(plan.ang) * len, plan.ang, 18, col);
  ctx.globalAlpha = 0.95; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(gx, gy, 6 + Math.sin(state.t * 6) * 1.2, 0, TAU); ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(10,20,30,0.7)'; ctx.stroke();
  ctx.restore();
}

export function drawOverlay(ctx, state) {
  const m = state.m, w = state.w, p = w.pull;
  if (!m || m.phase === 'score') return;
  const showHint = state.hintShot && !p;
  if (showHint) drawPlan(ctx, state, state.hintShot, '#8fe9ff');
  if (p && !p.done) {
    // tether from the finger to the grab point, and a pace ring around the grab point
    const f = state.finger;
    const hot = Math.min(1, p.speed / V0), col = hot < 0.7 ? '#9be8c4' : hot < 1 ? '#ffd35a' : '#ff7a5a';
    ctx.save(); ctx.lineCap = 'round';
    ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.arc(p.gx + 1, p.gy + 2, 17, 0, TAU); ctx.stroke();
    ctx.lineWidth = 4; ctx.strokeStyle = col; ctx.globalAlpha = 0.9; ctx.beginPath(); ctx.arc(p.gx, p.gy, 16, -Math.PI / 2, -Math.PI / 2 + TAU * Math.max(0.04, Math.min(1, p.speed / (V0 * 1.4)))); ctx.stroke();
    if (f && state.humanTurn) {
      ctx.globalAlpha = 0.55; ctx.strokeStyle = '#fff6e0'; ctx.lineWidth = 2; ctx.setLineDash([3, 7]); ctx.beginPath(); ctx.moveTo(p.gx, p.gy); ctx.lineTo(f.x, f.y); ctx.stroke(); ctx.setLineDash([]);
      ctx.globalAlpha = 0.8; const g = ctx.createRadialGradient(f.x - 4, f.y - 5, 2, f.x, f.y, 24); g.addColorStop(0, 'rgba(255,230,205,0.9)'); g.addColorStop(1, 'rgba(214,150,110,0.55)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(f.x, f.y, 22, 0, TAU); ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(100,56,30,0.7)'; ctx.stroke();
    }
    ctx.restore();
  } else if (state.freeFlash > 0 && state.flashStick) {
    const s = w.sticks.find((q) => q.id === state.flashStick);
    if (s) { ctx.save(); ctx.globalAlpha = Math.min(1, state.freeFlash) * 0.7; ctx.strokeStyle = '#ff9a7a'; ctx.lineWidth = 3; ctx.setLineDash([6, 6]); ctx.beginPath(); ctx.arc(s.x, s.y, s.lh * 0.7, 0, TAU); ctx.stroke(); ctx.restore(); }
  }
}

// ---- HUD ------------------------------------------------------------------------------------------------------------
function tinyRow(ctx, kinds, x, y, w, len) {
  const step = len * 0.62, maxN = Math.max(1, Math.floor(w / step));
  kinds.slice(-maxN).forEach((k, i) => drawStickIcon(ctx, x + len / 2 + i * step, y, len, k, -0.9));
}
function slipDots(ctx, x, y, r, used) {
  for (let i = 0; i < 3; i++) {
    ctx.beginPath(); ctx.arc(x + i * (r * 2.7), y, r, 0, TAU);
    ctx.fillStyle = i < used ? '#e0553c' : 'rgba(255,255,255,0.18)'; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(255,240,200,0.5)'; ctx.stroke();
  }
}
function drawCard(ctx, state, side, L) {
  const m = state.m, r = L.cards[side], F = L.fs, S = SIDE[side], solo = isSolo(m), active = !solo && m.phase !== 'score' && m.turn === side, t = state.t, nm = names(state)[side];
  const lit = solo ? side === 0 : active;
  panel(ctx, r.x, r.y, r.w, r.h, { r: 22, fill: 'rgba(24,18,26,0.9)', stroke: lit ? S.glow : 'rgba(255,240,200,0.25)' });
  if (lit) { ctx.save(); roundPath(ctx, r.x - 3, r.y - 3, r.w + 6, r.h + 6, 25); ctx.lineWidth = 3; ctx.strokeStyle = S.glow.replace('0.95', String(0.3 + 0.25 * Math.sin(t * 5))); ctx.stroke(); ctx.restore(); }
  ctx.textBaseline = 'alphabetic';
  const pend = 0;
  const total = (solo ? 0 : m.scores[side]) + m.rp[side] + pend;
  const compact = L.rows || r.h < F.score * 1.6;
  if (solo && side === 1) {
    // the second card of a solo run: slips and the goal
    const lab1 = m.cfg.mode === 'solo' ? `Goal ${m.goal}` : 'Daily heap', lab2 = 'Slips';
    ctx.textAlign = 'left'; ctx.fillStyle = '#fff8e0'; ctx.font = `800 ${F.name}px ${FONT}`;
    ctx.fillText(fitText(ctx, [lab1], F.name, r.w - 32, 800), r.x + 18, r.y + (compact ? r.h * 0.42 : 22 + F.name * 0.95), r.w - 32);
    ctx.font = `600 ${F.sub}px ${FONT}`; ctx.fillStyle = 'rgba(255,240,205,0.82)';
    const dy = compact ? r.h * 0.42 + F.sub * 1.5 : 22 + F.name * 0.95 + F.sub * 1.5;
    ctx.fillText(lab2, r.x + 18, r.y + dy);
    ctx.font = `600 ${F.sub}px ${FONT}`; const lw = ctx.measureText(lab2).width;
    slipDots(ctx, r.x + 18 + lw + 18, r.y + dy - F.sub * 0.32, Math.max(6, F.sub * 0.42), m.strikes);
    return;
  }
  if (compact) {
    const sc = String(total);
    ctx.font = `800 ${F.score}px ${FONT}`; const scW = ctx.measureText(sc).width;
    ctx.textAlign = 'right'; ctx.fillStyle = '#ffe08a'; ctx.fillText(sc, r.x + r.w - 16, r.y + r.h / 2 + F.score * 0.34);
    const nx = r.x + 22, nw = r.x + r.w - 16 - scW - 14 - nx;
    ctx.textAlign = 'left'; ctx.fillStyle = '#fff8e0';
    ctx.fillText(fitText(ctx, [nm, shortName(nm)], F.name, nw), nx, r.y + r.h / 2 + F.name * 0.34, nw);
    return;
  }
  const nx = r.x + 18, sc = String(total);
  ctx.font = `800 ${F.score}px ${FONT}`; const scW = ctx.measureText(sc).width;
  ctx.fillStyle = '#ffe08a'; ctx.textAlign = 'right'; ctx.fillText(sc, r.x + r.w - 16, r.y + 20 + F.score * 0.82);
  ctx.fillStyle = '#fff8e0'; ctx.textAlign = 'left';
  ctx.fillText(fitText(ctx, [nm, shortName(nm)], F.name, r.x + r.w - 16 - scW - 12 - nx), nx, r.y + 22 + F.name * 0.95, r.x + r.w - 16 - scW - 12 - nx);
  ctx.font = `600 ${F.sub}px ${FONT}`; ctx.fillStyle = 'rgba(255,240,205,0.78)';
  const cnt = m.got[side].length + (pend ? 1 : 0);
  ctx.fillText(fitText(ctx, [`${cnt} stick${cnt === 1 ? '' : 's'}${m.tool[side] ? ' · lever' : ''}`, `${cnt}`], F.sub, r.x + r.w - 16 - scW - 12 - nx, 600), nx, r.y + 22 + F.name * 0.95 + F.sub * 1.25);
  tinyRow(ctx, m.got[side], r.x + 18, r.y + r.h - 14, r.w - 30, 56);
}
export function drawHud(ctx, state) {
  const L = layoutOf(state);
  drawCard(ctx, state, 0, L); drawCard(ctx, state, 1, L);
}
export function drawInfo(ctx, state) {
  const L = layoutOf(state), I = L.info, F = L.fs, m = state.m, w = state.w, p = w.pull;
  roundPath(ctx, I.x, I.y, I.w, I.h, 20); ctx.fillStyle = 'rgba(24,18,26,0.84)'; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(255,240,200,0.3)'; ctx.stroke();
  ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
  const maxW = I.w - 28;
  if (p && !p.done && !p.tool) {
    // steadiness meter: how close to the limit any other stick has moved
    const ratio = Math.min(1, p.nowRatio || 0), hot = p.speed / V0;
    const lab = 'Steady', bw = Math.max(60, maxW - ctx.measureText(lab).width - 30);
    ctx.font = `700 ${F.info}px ${FONT}`; ctx.textAlign = 'left'; ctx.fillStyle = '#fff8e0';
    const lw = ctx.measureText(lab).width;
    ctx.fillText(lab, I.x + 16, I.y + I.h / 2);
    const bx = I.x + 16 + lw + 12, byh = Math.max(12, F.info * 0.55), bwid = I.x + I.w - 16 - bx;
    void bw;
    roundPath(ctx, bx, I.y + I.h / 2 - byh / 2, bwid, byh, byh / 2); ctx.fillStyle = 'rgba(255,255,255,0.14)'; ctx.fill();
    const fill = Math.max(0.03, 1 - ratio);
    roundPath(ctx, bx, I.y + I.h / 2 - byh / 2, bwid * fill, byh, byh / 2);
    ctx.fillStyle = ratio < 0.4 ? '#7ee8a8' : ratio < 0.75 ? '#ffd35a' : '#ff7a5a'; ctx.fill();
    if (hot > 0.8) { ctx.textAlign = 'right'; ctx.font = `800 ${Math.round(F.info * 0.8)}px ${FONT}`; ctx.fillStyle = hot > 1 ? '#ff9a7a' : '#ffd35a'; ctx.fillText(hot > 1 ? 'SLOWER' : 'slow down', I.x + I.w - 22, I.y + I.h / 2 - byh * 0.95); }
    return;
  }
  if (state.toastT > 0 && state.toast) {
    const a = Math.min(1, state.toastT / 0.4);
    ctx.globalAlpha = a; let px = F.info, lines;
    for (; ; px = Math.max(Math.round(F.info * 0.75), px - 2)) { ctx.font = `700 ${px}px ${FONT}`; lines = wrapLines(ctx, state.toast, maxW); if (lines.length <= 2 || px <= Math.round(F.info * 0.75)) break; }
    lines = lines.slice(0, 2); ctx.fillStyle = '#fff8e0';
    lines.forEach((l, i) => ctx.fillText(l, I.x + I.w / 2, I.y + I.h / 2 + (i - (lines.length - 1) / 2) * px * 1.2, maxW));
    ctx.globalAlpha = 1;
    return;
  }
  const left = w.sticks.reduce((a, s) => a + valueOf(s), 0), n = w.sticks.length;
  const a = m.cfg.mode === 'solo' ? `Level ${m.cfg.level}` : m.cfg.mode === 'daily' ? 'Daily heap' : `Round ${m.round}${m.rounds > 1 ? ` of ${m.rounds}` : ''}`, b = `${n} sticks left (${left} pts)`;
  ctx.fillStyle = '#fff8e0'; ctx.font = `700 ${F.info}px ${FONT}`;
  const txt = fitText(ctx, [`${a}  ·  ${b}`, b, `${n} sticks left`], F.info, maxW);
  ctx.fillText(txt, I.x + I.w / 2, I.y + I.h / 2, maxW);
}
// Landscape side panel filler: what is still on the table, by kind.
function drawTally(ctx, state) {
  const L = layoutOf(state), T = L.tally;
  if (!T) return;
  const F = L.fs, cnt = {};
  for (const k of KINDS) cnt[k] = 0;
  for (const s of state.w.sticks) cnt[s.kind]++;
  roundPath(ctx, T.x, T.y, T.w, T.h, 20); ctx.fillStyle = 'rgba(24,18,26,0.84)'; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(255,240,200,0.3)'; ctx.stroke();
  const pad = 14;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(255,240,205,0.8)'; ctx.font = `700 ${F.sub}px ${FONT}`; ctx.textAlign = 'left'; ctx.fillText('STILL ON THE TABLE', T.x + pad + 4, T.y + pad + F.sub * 0.5);
  if (T.w > T.h * 2.2) {     // wide strip (portrait): five columns, a stick above its count
    const cw = (T.w - 2 * pad) / 5, top = T.y + pad + F.sub * 1.5;
    KINDS.forEach((k, i) => {
      const cx = T.x + pad + cw * (i + 0.5), icon = Math.min(cw * 0.86, 120);
      drawStickIcon(ctx, cx, top + (T.h - (top - T.y) - pad) * 0.32, icon, k, -0.35);
      ctx.textAlign = 'center'; ctx.fillStyle = cnt[k] ? '#ffe08a' : 'rgba(255,240,205,0.4)'; ctx.font = `800 ${Math.round(Math.min(F.info * 1.15, cw * 0.3))}px ${FONT}`; ctx.fillText(`× ${cnt[k]}`, cx, T.y + T.h - pad - F.info * 1.15);
      ctx.fillStyle = 'rgba(255,240,205,0.78)'; ctx.font = `600 ${Math.round(Math.min(F.sub * 0.9, cw * 0.19))}px ${FONT}`; ctx.fillText(cw >= 74 ? `${VALUE[k]} pt${VALUE[k] > 1 ? 's' : ''}` : `${VALUE[k]}`, cx, T.y + T.h - pad - F.sub * 0.2);
    });
    return;
  }
  const rh = Math.min(F.info * 1.9, (T.h - 2 * pad - F.sub * 1.4) / 5), fk = Math.min(1, rh / (F.info * 1.9));   // rows get tighter when the text is zoomed: shrink their type with them
  if (rh < 13) return;
  KINDS.forEach((k, i) => {
    const y = T.y + pad + F.sub * 1.4 + rh * (i + 0.5);
    drawStickIcon(ctx, T.x + pad + 34, y, 56, k, -0.5);
    ctx.textAlign = 'left'; ctx.fillStyle = '#fff8e0'; ctx.font = `700 ${Math.round(F.info * 0.95 * fk)}px ${FONT}`; ctx.fillText(`${KIND_NAME[k].split(' ')[0]}  ·  ${VALUE[k]}`, T.x + pad + 76, y);
    ctx.textAlign = 'right'; ctx.fillStyle = cnt[k] ? '#ffe08a' : 'rgba(255,240,205,0.4)'; ctx.font = `800 ${Math.round(F.info * 1.2 * fk)}px ${FONT}`; ctx.fillText(`× ${cnt[k]}`, T.x + T.w - pad - 4, y);
  });
}
export function drawBar(ctx, state) {
  const m = state.m, watch = m.cfg.mode === 'watch', L = layoutOf(state), F = L.fs;
  if (m.phase === 'score') return;
  if (watch) {
    const D = L.demo;
    drawButton(ctx, D.dec, 'Think −', { size: F.demoBtn });
    drawButton(ctx, D.pause, state.paused ? 'Resume' : 'Pause', { primary: !state.paused, active: state.paused, size: Math.round(F.demoBtn * 1.12) });
    drawButton(ctx, D.inc, 'Think +', { size: F.demoBtn });
    drawButton(ctx, D.exit, L.z > 2 ? 'Leave' : 'Leave Watch & Learn', { dark: true, size: F.demoBtn });
    return;
  }
  const waiting = !state.humanTurn || m.phase !== 'aim', side = m.turn;
  const toolOk = !waiting && m.tool[side] && m.toolUses[side] < 2;
  drawButton(ctx, L.hint, state.hintBusy ? 'Thinking…' : 'Hint', { disabled: waiting || state.hintBusy, size: F.btn });
  drawButton(ctx, L.tool, state.toolArmed ? 'Lever: ready' : m.tool[side] ? `Lever ${2 - m.toolUses[side]}` : 'Lever', { disabled: !toolOk, active: state.toolArmed, size: F.btn });
  drawButton(ctx, L.menu, 'Menu', { dark: true, size: F.btn });
}
function drawChips(ctx, state) {
  for (const p of state.pops) {
    const k = p.t / p.max, s = toScreen(state, p.x, p.y), size = (p.size ?? 30);
    ctx.save(); ctx.globalAlpha = Math.min(1, (1 - k) * 2); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `800 ${size}px ${FONT}`; ctx.translate(s.x, s.y - 20 - k * 40);
    ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(5, size * 0.22); ctx.strokeStyle = 'rgba(20,12,20,0.92)'; ctx.strokeText(p.text, 0, 0);
    ctx.fillStyle = p.col ?? '#ffe08a'; ctx.fillText(p.text, 0, 0);
    ctx.restore();
  }
  // lifted sticks flying to the score card of the side that took them
  const L = layoutOf(state);
  for (const f of state.flies) {
    const k = Math.min(1, f.t / f.max);
    if (k < 0) continue;
    const e = 1 - Math.pow(1 - k, 3), s = toScreen(state, f.x, f.y), c = L.cards[f.side];
    const tx = c.x + 60, ty = c.y + Math.min(c.h / 2, 40);
    drawStickIcon(ctx, s.x + (tx - s.x) * e, s.y + (ty - s.y) * e - Math.sin(k * Math.PI) * 60, (2 * LH * L.board.s) * (1 - 0.7 * e), f.kind, f.a + (-0.9 - f.a) * e);
  }
}
function drawBanner(ctx, state) {
  const m = state.m;
  if (m.phase !== 'score' || !m.roundInfo) return;
  const info = m.roundInfo, k = Math.min(1, Math.max(0, (info.t - 0.3) / 0.5));
  if (k <= 0) return;
  const L = layoutOf(state), B = L.banner, nm = names(state), F = L.fs, y = B.y + (1 - k) * 24, solo = isSolo(m);
  ctx.save(); ctx.globalAlpha = k;
  roundPath(ctx, B.x, y, B.w, B.h, 28); ctx.fillStyle = 'rgba(22,16,24,0.95)'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,224,150,0.55)'; ctx.stroke();
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  const cx = B.x + B.w / 2;
  const y1 = y + 14 + F.bTitle, y2 = y1 + 10 + F.bScore * 1.05, y3 = y2 + 22 + F.bTap;
  const cleared = solo && (m.cfg.mode === 'daily' ? m.rp[0] > 0 : m.rp[0] >= m.goal);
  const head = m.cfg.mode === 'solo' ? (cleared ? `Level ${m.cfg.level} cleared` : 'Out of slips') : m.cfg.mode === 'daily' ? (state.w.sticks.length ? 'Out of slips' : 'Heap cleared') : `Round ${info.round} done`;
  ctx.fillStyle = '#fff8e0'; ctx.font = `800 ${F.bTitle}px ${FONT}`; ctx.fillText(fitText(ctx, [head, 'Done'], F.bTitle, B.w - 30, 800), cx, y1, B.w - 30);
  ctx.font = `800 ${F.bScore}px ${FONT}`;
  if (solo) {
    ctx.fillStyle = '#ffe08a'; ctx.fillText(m.cfg.mode === 'solo' ? `${info.pts[0]} / ${m.goal}` : `${info.pts[0]} pts`, cx, y2);
  } else {
    const a = String(info.pts[0]), b = String(info.pts[1]), wa = ctx.measureText(a).width, wb = ctx.measureText(b).width, wc = ctx.measureText(' : ').width, mid = wa + wb + wc;
    ctx.textAlign = 'left'; ctx.fillStyle = SIDE[0].hud; ctx.fillText(a, cx - mid / 2, y2); ctx.fillStyle = '#ffe9bf'; ctx.fillText(' : ', cx - mid / 2 + wa, y2); ctx.fillStyle = SIDE[1].hud; ctx.fillText(b, cx - mid / 2 + wa + wc, y2);
    const sideW = (B.w - mid) / 2 - 16;
    ctx.fillStyle = 'rgba(255,240,205,0.9)'; ctx.textAlign = 'right'; ctx.font = `600 ${Math.round(F.bTap * 0.95)}px ${FONT}`;
    ctx.fillText(fitText(ctx, [nm[0], shortName(nm[0])], Math.round(F.bTap * 0.95), sideW, 600), cx - mid / 2 - 14, y2 - 4, sideW);
    ctx.textAlign = 'left'; ctx.fillText(fitText(ctx, [nm[1], shortName(nm[1])], Math.round(F.bTap * 0.95), sideW, 600), cx + mid / 2 + 14, y2 - 4, sideW);
  }
  if (info.t > 1.2) { ctx.globalAlpha = k * (0.7 + 0.3 * Math.sin(state.t * 4)); ctx.textAlign = 'center'; ctx.fillStyle = '#fff8e0'; ctx.font = `500 ${F.bTap}px ${FONT}`; ctx.fillText(m.cfg.mode === 'watch' ? 'Next…' : 'Tap to continue', cx, y3, B.w - 30); }
  ctx.restore();
}

export function renderPlay(ctx, state) {
  const m = state.m, w = state.w, L = layoutOf(state);
  const freeIds = state.settings.calm && state.humanTurn && m.phase === 'aim' && !w.pull ? state.freeIds : null;
  drawTable(ctx, state, w, state.parts, {
    cx: L.board.cx + (state.sx || 0), cy: L.board.cy + (state.sy || 0), scale: L.board.s, hintId: state.hintShot && !w.pull ? state.hintShot.id : undefined, freeIds,
    over: (c) => { drawOverlay(c, state); },
  });
  drawHud(ctx, state);
  drawInfo(ctx, state);
  drawTally(ctx, state);
  drawChips(ctx, state);
  drawBanner(ctx, state);
  if (state.think && m.phase === 'aim') {
    const th = state.think, r = L.cards[isSolo(m) ? 0 : m.turn], frac = th.phase === 'think' ? Math.min(1, th.t / th.dur) : 1;
    roundPath(ctx, r.x + 22, r.y + r.h - 8, r.w - 44, 4, 2); ctx.fillStyle = 'rgba(255,255,255,0.16)'; ctx.fill();
    roundPath(ctx, r.x + 22, r.y + r.h - 8, Math.max(4, (r.w - 44) * frac), 4, 2); ctx.fillStyle = th.phase === 'think' ? '#ffd35a' : '#7ee8a8'; ctx.fill();
  }
  drawBar(ctx, state);
  void SR; void TABLE; void describePlan;
}
