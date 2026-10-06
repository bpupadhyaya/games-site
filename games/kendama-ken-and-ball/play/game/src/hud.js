// The play screen: the scene (ken, string, ball, particles), the goal card, the button bar, hints, Watch & Learn
// captions and the toast. Pure drawing; game.js owns the state.
import { LAY, hudBoxWide } from './layout.js';
import { drawBackdrop, drawOuter, drawKen, drawBall, drawBallShadow, drawRope, drawParticles, COL, rr } from './art.js';
import { FONT, C, drawButton, panel, roundPath, textShadow, wrapLines } from './ui.js';
import { stepText, starsFor, RUN_STRIKES, offerValue, runMult } from './tricks.js';
import { isFlipped, CUPS } from './phys.js';

const TAU = Math.PI * 2;
const TGT_COL = { big: COL.big, small: COL.small, spike: COL.spike, base: COL.base, any: '#f0bd3c' };
export const tgtName = (t) => ({ big: 'Big cup', small: 'Small cup', spike: 'Spike', base: 'Base cup', any: 'Any catch' }[t] ?? t);

// ---- the world ----------------------------------------------------------------------------------
export function drawWorld(ctx, w, rope, o = {}) {
  if (!o.noBackdrop) drawBackdrop(ctx);
  if (o.petals) drawParticles(ctx, o.petals);
  drawBallShadow(ctx, w.ball);
  if (o.hint) drawHintUnder(ctx, o.hint, o.t ?? 0);
  if (o.ghost) drawKen(ctx, { ...w.ken, x: o.ghost.x, y: o.ghost.y, th: o.ghost.flip ? Math.PI : 0 }, {}, 0.32);
  drawKen(ctx, w.ken, o.glow ?? {});
  drawRope(ctx, rope);
  drawBall(ctx, w.ball);
  if (o.parts) drawParticles(ctx, o.parts);
}

function drawHintUnder(ctx, h, t) {
  ctx.save();
  ctx.lineCap = 'round';
  const dots = (pts, col, wd, a, dash) => {
    if (pts.length < 4) return;
    ctx.globalAlpha = a; ctx.strokeStyle = col; ctx.lineWidth = wd; ctx.setLineDash(dash);
    ctx.beginPath(); ctx.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
    ctx.stroke(); ctx.setLineDash([]);
  };
  for (const a of h.arcs ?? []) dots(a.pts, a.ok ? '#8fe0b0' : '#ffffff', 3, a.ok ? 0.22 : 0.12, [2, 12]);
  if (h.plan) {
    dots(h.plan.arc, '#ffe08a', 6, 0.95, [2, 14]);
    const n = h.plan.arc.length / 2;
    if (n > 1) {
      const i = Math.floor((t * 14) % n);
      ctx.globalAlpha = 0.95; ctx.fillStyle = '#fff6c8'; ctx.shadowColor = '#ffd45a'; ctx.shadowBlur = 16;
      ctx.beginPath(); ctx.arc(h.plan.arc[i * 2], h.plan.arc[i * 2 + 1], 9, 0, TAU); ctx.fill();
    }
  }
  ctx.restore();
}

// ---- goal card -----------------------------------------------------------------------------------
function chip(ctx, x, y, w, h, label, col, state, sub) {
  // state: 0 pending, 1 current, 2 done
  ctx.save();
  rr(ctx, x, y, w, h, h / 2);
  ctx.fillStyle = state === 2 ? col : state === 1 ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.07)'; ctx.fill();
  ctx.lineWidth = state === 1 ? 3 : 1.5; ctx.strokeStyle = state === 0 ? 'rgba(255,255,255,0.25)' : col; ctx.stroke();
  ctx.fillStyle = state === 2 ? '#10142e' : '#fff6e2';
  ctx.font = `700 ${h > 44 ? 24 : 22}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  let px = h > 44 ? 24 : 22;
  while (ctx.measureText(label).width > w - 26 && px > 18) { px--; ctx.font = `700 ${px}px ${FONT}`; }
  ctx.fillText(state === 2 ? `✓ ${label}` : label, x + w / 2, y + h / 2 + (sub ? -9 : 1));
  if (sub) { ctx.font = `400 ${Math.max(20, Math.round(px * 0.8))}px ${FONT}`; ctx.globalAlpha = 0.85; ctx.fillText(sub, x + w / 2, y + h / 2 + 14); }
  ctx.restore();
}

function card(ctx, hr) {
  panel(ctx, hr.x, hr.y, hr.w, hr.h, { r: 24, fill: 'rgba(22,28,66,0.78)', stroke: 'rgba(255,230,190,0.35)' });
}
const stars = (ctx, n, x, y, size, col = '#ffd45a') => {
  ctx.save(); ctx.font = `700 ${size}px ${FONT}`; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
  ctx.fillStyle = col; ctx.fillText('★'.repeat(n), x, y);
  const w = ctx.measureText('★'.repeat(n)).width;
  if (n < 3) { ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillText('★'.repeat(3 - n), x - w, y); }
  ctx.restore();
};

function drawTrickCard(ctx, s, HUD) {
  card(ctx, HUD);
  const tr = s.tr, steps = tr.steps;
  ctx.save();
  ctx.fillStyle = '#fff6e2'; ctx.font = `700 32px ${FONT}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  const title = s.mode === 'watch' ? `Watch: ${s.trickName}` : s.mode === 'practice' ? 'Free practice' : s.trickName;
  ctx.fillText(title, HUD.x + 24, HUD.y + 30);
  ctx.textAlign = 'right';
  if (s.mode === 'trick' || s.mode === 'watch') {
    stars(ctx, starsFor(tr.drops), HUD.x + HUD.w - 24, HUD.y + 30, 28);
    ctx.font = `400 22px ${FONT}`; ctx.fillStyle = 'rgba(255,246,226,0.75)';
    ctx.fillText(`Drops ${tr.drops}`, HUD.x + HUD.w - 24, HUD.y + 58);
  }
  ctx.restore();
  if (s.mode === 'practice') {
    ctx.save(); ctx.fillStyle = 'rgba(255,246,226,0.85)'; ctx.font = `400 24px ${FONT}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(`Catches ${s.pr.catches}   Streak ${s.pr.streak}   Best ${s.pr.best}`, HUD.x + 24, HUD.y + 68);
    ctx.restore();
    const key = s.pr.target, cw = 250, pc = LAY.practiceChip;
    chip(ctx, pc.x, pc.y, pc.w, pc.h, `Aim: ${tgtName(key)}`, TGT_COL[key], 1);
    ctx.fillStyle = 'rgba(255,246,226,0.6)'; ctx.font = `400 18px ${FONT}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText('tap the chip to change', pc.x + cw + 14, pc.y + 22);
    return;
  }
  const n = steps.length, gap = 10, x0 = HUD.x + 20, wAll = HUD.w - 40;
  const cw = Math.min(190, (wAll - gap * (n - 1)) / n);
  const total = cw * n + gap * (n - 1);
  const xs = x0 + (wAll - total) / 2;
  steps.forEach((st, i) => {
    const key = st.t, col = TGT_COL[key] ?? '#ffd45a';
    const sub = (st.t === 'lift' && i === tr.i) ? `${tr.lifts} of ${st.n}` : (st.t === 'circle' && i === tr.i) ? `${Math.min(st.n, Math.abs(tr.wind) / TAU).toFixed(1)} of ${st.n}` : (st.hold > 1 && i === tr.i && tr.holdOn) ? '' : null;
    chip(ctx, xs + i * (cw + gap), HUD.y + 72, cw, 48, stepText(st), col, i < tr.i || tr.done ? 2 : i === tr.i ? 1 : 0, sub);
  });
  // hold / travel progress under the current step
  const cur = steps[tr.i];
  if (cur && cur.hold > 1 && s.w.ball.on) {
    const p = Math.min(1, s.w.ball.onT / cur.hold), q = cur.travel ? Math.min(1, tr.holdLen / cur.travel) : 1;
    ctx.save(); ctx.fillStyle = 'rgba(255,255,255,0.15)'; rr(ctx, xs, HUD.y + 120, total, 5, 2.5); ctx.fill();
    ctx.fillStyle = '#ffd45a'; rr(ctx, xs, HUD.y + 120, total * Math.min(p, q) , 5, 2.5); ctx.fill(); ctx.restore();
  }
}

function drawRunCard(ctx, s, HUD) {
  card(ctx, HUD);
  const run = s.run;
  ctx.save();
  ctx.fillStyle = '#fff6e2'; ctx.font = `700 30px ${FONT}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillText(`Banked ${run.bank}`, HUD.x + 22, HUD.y + 30);
  ctx.textAlign = 'center'; ctx.font = `700 26px ${FONT}`; ctx.fillStyle = run.pts ? '#ffd45a' : 'rgba(255,246,226,0.6)';
  ctx.fillText(`${run.pts} pts  ×${runMult(run).toFixed(1)}`, HUD.x + HUD.w / 2 + 40, HUD.y + 30);
  ctx.textAlign = 'right'; ctx.font = `700 30px ${FONT}`;
  for (let i = 0; i < RUN_STRIKES; i++) {
    ctx.fillStyle = i < run.strikes ? 'rgba(255,255,255,0.22)' : '#ff6a54';
    ctx.fillText('♥', HUD.x + HUD.w - 22 - (RUN_STRIKES - 1 - i) * 34, HUD.y + 30);
  }
  ctx.restore();
  const n = 3, gap = 10, x0 = HUD.x + 18, cw = (HUD.w - 36 - gap * 2) / 3;
  run.offers.forEach((key, i) => {
    const x = x0 + i * (cw + gap), y = HUD.y + 62, h = 56;
    ctx.save();
    rr(ctx, x, y, cw, h, 18); ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fill();
    ctx.lineWidth = run.bonus === i ? 3.5 : 2; ctx.strokeStyle = TGT_COL[key]; ctx.stroke();
    ctx.fillStyle = TGT_COL[key]; ctx.beginPath(); ctx.arc(x + 22, y + h / 2, 9, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fff6e2'; ctx.font = `700 22px ${FONT}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(tgtName(key), x + 38, y + 20);
    ctx.fillStyle = '#ffd45a'; ctx.font = `700 22px ${FONT}`;
    ctx.fillText(`+${offerValue(run, i)}${run.bonus === i ? '  ×2' : ''}`, x + 38, y + 43);
    ctx.restore();
  });
}

// ---- bars ----------------------------------------------------------------------------------------
const ico = {
  pop: (ctx, x, y, col) => { ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); ctx.moveTo(x, y + 14); ctx.lineTo(x, y - 14); ctx.moveTo(x - 11, y - 3); ctx.lineTo(x, y - 14); ctx.lineTo(x + 11, y - 3); ctx.stroke(); ctx.restore(); },
  flip: (ctx, x, y, col) => { ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(x, y, 12, -0.5, Math.PI * 1.1); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x + 14, y - 12); ctx.lineTo(x + 12, y - 2); ctx.lineTo(x + 4, y - 10); ctx.stroke(); ctx.restore(); },
  think: (ctx, x, y, col) => { ctx.save(); ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y - 4, 11, 0, TAU); ctx.fill(); ctx.fillRect(x - 5, y + 6, 10, 5); ctx.restore(); },
  bank: (ctx, x, y, col) => { ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(x, y, 13, 13, 0, 0, TAU); ctx.stroke(); ctx.fillStyle = col; ctx.font = `700 16px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('¥', x, y + 1); ctx.restore(); },
  menu: (ctx, x, y, col) => { ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.beginPath(); for (let i = -1; i <= 1; i++) { ctx.moveTo(x - 12, y + i * 9); ctx.lineTo(x + 12, y + i * 9); } ctx.stroke(); ctx.restore(); },
};

function chargeMeter(ctx, s, r, below) {
  ctx.save(); roundPath(ctx, r.x, r.y, r.w, r.h, 18); ctx.clip();
  ctx.fillStyle = 'rgba(255,224,130,0.55)'; ctx.fillRect(r.x, r.y + r.h * (1 - s.pop.charge), r.w, r.h * s.pop.charge);
  ctx.restore();
  ctx.save(); ctx.fillStyle = '#fff6e2'; ctx.font = `700 24px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  if (below) ctx.fillText(`${Math.round(s.pop.charge * 100)}%`, r.x + r.w / 2, r.y - 16); else ctx.fillText(`${Math.round(s.pop.charge * 100)}%`, r.x + r.w / 2, r.y + r.h - 24);
  ctx.restore();
}

function drawBar(ctx, s, L) {
  if (L.bar) { ctx.save(); ctx.fillStyle = 'rgba(14,10,22,0.55)'; ctx.fillRect(L.bar.x, L.bar.y, L.bar.w, L.bar.h); ctx.restore(); }
  const flipped = isFlipped(s.w.ken), big = L.land ? 32 : 28, sm = L.land ? 28 : 26;
  drawButton(ctx, L.pop, 'Pop', { primary: true, size: big, icon: ico.pop });
  if (s.pop.holding) chargeMeter(ctx, s, L.pop, !L.land);
  drawButton(ctx, L.flip, flipped ? 'Flip back' : 'Flip', { active: flipped, size: sm, icon: ico.flip });
  if (s.mode === 'run') drawButton(ctx, L.hint, 'Bank', { dark: true, disabled: !s.run.pts, size: sm, icon: ico.bank });
  else drawButton(ctx, L.hint, s.hint && s.hint.phase === 'run' ? 'Thinking' : 'Think', { dark: true, size: sm, icon: ico.think });
  drawButton(ctx, L.menu, 'Menu', { dark: true, size: sm, icon: ico.menu });
}

function drawWatchBar(ctx, s, L) {
  const WB = L.watch;
  if (L.bar) { ctx.save(); ctx.fillStyle = 'rgba(14,10,22,0.55)'; ctx.fillRect(L.bar.x, L.bar.y, L.bar.w, L.bar.h); ctx.restore(); }
  drawButton(ctx, WB.dec, 'Think −', { dark: true, size: 24, disabled: s.settings.thinkIdx === 0 });
  drawButton(ctx, WB.pause, s.paused ? 'Resume' : 'Pause', { primary: !s.paused, active: s.paused, size: 32 });
  drawButton(ctx, WB.inc, 'Think +', { dark: true, size: 24, disabled: s.settings.thinkIdx === s.thinkMax });
  ctx.save(); ctx.fillStyle = 'rgba(255,246,226,0.9)'; ctx.font = `400 22px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(`Thinking time ${s.thinkSecs} s`, WB.label.x, WB.label.y);
  ctx.restore();
  drawButton(ctx, WB.exit, 'Leave', { dark: true, size: 24 });
}

// ---- Watch & Learn panel ------------------------------------------------------------------------
// Portrait: a wide strip at the top of the stage. Wide: a card in the left column under the goal card.
const PHASE_COL = { think: '#9db8ff', reveal: '#ffd45a', act: '#8fe0b0', celebrate: '#ffd0e0' };
const PHASE_NAME = { think: 'THINK', reveal: 'REVEAL', act: 'ACT', celebrate: 'DONE' };
function ring(ctx, cx, cy, r, col, k, label) {
  ctx.save();
  ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.stroke();
  ctx.strokeStyle = col; ctx.beginPath(); ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + TAU * k); ctx.stroke();
  if (label !== null) { ctx.fillStyle = '#fff6e2'; ctx.font = `700 22px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(label), cx, cy + 1); }
  ctx.restore();
}
function drawWatchPanel(ctx, s, L, below) {
  const wt = s.watch, col = PHASE_COL[wt.phase];
  const k = wt.phase === 'act' || wt.phase === 'celebrate' ? 1 : Math.min(1, wt.t / wt.dur);
  const lab = wt.phase === 'think' || wt.phase === 'reveal' ? Math.max(0, Math.ceil(wt.dur - wt.t)) : null;
  ctx.save();
  if (!L.land) {
    const x = L.cap.x, y = L.cap.y, w = L.cap.w, h = 74;
    panel(ctx, x, y, w, h, { r: 22, fill: 'rgba(16,20,50,0.82)', stroke: col });
    ctx.fillStyle = col; ctx.font = `700 26px ${FONT}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(PHASE_NAME[wt.phase], x + 24, y + 25);
    ctx.fillStyle = '#fff6e2'; ctx.font = `400 22px ${FONT}`;
    wrapLines(ctx, wt.note, w - 190).slice(0, 2).forEach((l, i) => ctx.fillText(l, x + 146, y + 24 + i * 26));
    ring(ctx, x + w - 40, y + h / 2, 22, col, k, lab);
  } else {
    const x = L.left.x, y = below, w = L.left.w;
    ctx.font = `400 22px ${FONT}`;
    const lines = wrapLines(ctx, wt.note, w - 32).slice(0, 6), h = 62 + lines.length * 27;
    panel(ctx, x, y, w, h, { r: 22, fill: 'rgba(16,20,50,0.82)', stroke: col });
    ctx.fillStyle = col; ctx.font = `700 26px ${FONT}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(PHASE_NAME[wt.phase], x + 18, y + 30);
    ring(ctx, x + w - 40, y + 30, 20, col, k, lab);
    ctx.fillStyle = '#fff6e2'; ctx.font = `400 22px ${FONT}`;
    lines.forEach((l, i) => ctx.fillText(l, x + 18, y + 72 + i * 27));
  }
  ctx.restore();
}

function drawHintCaption(ctx, h, L, below) {
  if (!h || !h.text) return;
  ctx.save();
  ctx.font = `400 22px ${FONT}`;
  if (!L.land) {
    const x = L.cap.x, y = L.cap.y, w = L.cap.w, hh = 112;
    panel(ctx, x, y, w, hh, { r: 22, fill: 'rgba(16,20,50,0.84)', stroke: '#ffd45a' });
    ctx.fillStyle = '#ffd45a'; ctx.font = `700 24px ${FONT}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText('THINK', x + 24, y + 28);
    ctx.fillStyle = '#fff6e2'; ctx.font = `400 22px ${FONT}`;
    wrapLines(ctx, h.text, w - 80).slice(0, 3).forEach((l, i) => ctx.fillText(l, x + 24, y + 58 + i * 26));
  } else {
    const x = L.left.x, y = below, w = L.left.w, lines = wrapLines(ctx, h.text, w - 32).slice(0, 8), hh = 56 + lines.length * 27;
    panel(ctx, x, y, w, hh, { r: 22, fill: 'rgba(16,20,50,0.88)', stroke: '#ffd45a' });
    ctx.fillStyle = '#ffd45a'; ctx.font = `700 24px ${FONT}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText('THINK', x + 18, y + 28);
    ctx.fillStyle = '#fff6e2'; ctx.font = `400 22px ${FONT}`;
    lines.forEach((l, i) => ctx.fillText(l, x + 18, y + 62 + i * 27));
  }
  ctx.restore();
}

// ---- toast and floating text ---------------------------------------------------------------------
function drawToast(ctx, s, L) {
  if (s.toastT <= 0 || !s.toast) return;
  const a = Math.min(1, s.toastT * 3), cx = L.st.x + L.st.w / 2, tw = L.toastW;
  ctx.save(); ctx.globalAlpha = a;
  ctx.font = `700 26px ${FONT}`;
  const lines = wrapLines(ctx, s.toast, tw - 20);
  const h = lines.length * 32 + 26, y = L.toastY + (s.mode === 'watch' ? 20 : 0) - h / 2;
  rr(ctx, cx - tw / 2, y, tw, h, 20); ctx.fillStyle = 'rgba(14,18,46,0.86)'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,230,190,0.5)'; ctx.stroke();
  ctx.fillStyle = '#fff6e2'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  lines.forEach((l, i) => ctx.fillText(l, cx, y + 13 + 16 + i * 32));
  ctx.restore();
}
function drawPops(ctx, pops) {
  for (const p of pops) {
    const k = p.t / p.max; const a = k < 0.15 ? k / 0.15 : Math.max(0, 1 - (k - 0.5) / 0.5);
    ctx.save(); ctx.globalAlpha = a; ctx.translate(p.x, p.y - 70 * k - 20);
    const sc = 0.8 + Math.min(1, k * 4) * 0.3; ctx.scale(sc, sc);
    ctx.font = `700 ${p.size ?? 46}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 8; ctx.strokeStyle = 'rgba(10,12,30,0.8)'; ctx.lineJoin = 'round'; ctx.strokeText(p.text, 0, 0);
    ctx.fillStyle = p.col ?? '#ffe08a'; ctx.fillText(p.text, 0, 0);
    ctx.restore();
  }
}

// ---- finger and keyboard marker ------------------------------------------------------------------
function drawFinger(ctx, s) {
  if (!s.drag) return;
  ctx.save();
  ctx.globalAlpha = 0.5; ctx.strokeStyle = '#fff6e2'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(s.drag.px, s.drag.py, 26, 0, TAU); ctx.stroke();
  ctx.globalAlpha = 0.18; ctx.fillStyle = '#fff6e2'; ctx.fill();
  ctx.restore();
}

export function glowFor(s) {
  const g = {};
  const pulse = 0.55 + 0.45 * Math.sin(s.t * 5);
  const mark = (key, v) => { g[key] = Math.max(g[key] ?? 0, v); };
  if (s.mode === 'run') s.run.offers.forEach((k, i) => mark(k, (s.run.bonus === i ? 0.9 : 0.55) * (0.7 + 0.3 * pulse)));
  else if (s.mode === 'practice') mark(s.pr.target, 0.4 + 0.5 * pulse);
  else {
    const st = s.tr.steps[s.tr.i];
    if (st && CUPS[st.t] || st && st.t === 'spike') mark(st.t, (s.hint && s.hint.phase === 'show' ? 1 : 0.5) * (0.5 + 0.5 * pulse));
    if (st && st.t === 'any') ['big', 'small', 'spike', 'base'].forEach((k) => mark(k, 0.3 * pulse));
  }
  if (s.watch && s.watch.phase === 'reveal' && s.watch.step) mark(s.watch.step.t, 1);
  return g;
}

// ---- the goal card of the wide layout (a column) ---------------------------------------------------
function drawGoalWide(ctx, s, L) {
  const nSteps = s.mode === 'run' || s.mode === 'practice' ? 0 : s.tr.steps.length;
  const b = hudBoxWide(L, s.mode, nSteps);
  card(ctx, b);
  ctx.save();
  ctx.textBaseline = 'middle';
  if (s.mode === 'run') {
    const run = s.run;
    ctx.fillStyle = '#fff6e2'; ctx.font = `700 28px ${FONT}`; ctx.textAlign = 'left'; ctx.fillText(`Banked ${run.bank}`, b.x + 18, b.y + 28);
    ctx.font = `700 24px ${FONT}`; ctx.fillStyle = run.pts ? '#ffd45a' : 'rgba(255,246,226,0.6)'; ctx.fillText(`${run.pts} pts  ×${runMult(run).toFixed(1)}`, b.x + 18, b.y + 64);
    ctx.textAlign = 'right'; ctx.font = `700 28px ${FONT}`;
    for (let i = 0; i < RUN_STRIKES; i++) { ctx.fillStyle = i < run.strikes ? 'rgba(255,255,255,0.22)' : '#ff6a54'; ctx.fillText('♥', b.x + b.w - 18 - (RUN_STRIKES - 1 - i) * 32, b.y + 28); }
    run.offers.forEach((key, i) => {
      const x = b.x + 12, y = b.y + 92 + i * 88, w = b.w - 24, h = 78;
      rr(ctx, x, y, w, h, 18); ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fill();
      ctx.lineWidth = run.bonus === i ? 3.5 : 2; ctx.strokeStyle = TGT_COL[key]; ctx.stroke();
      ctx.fillStyle = TGT_COL[key]; ctx.beginPath(); ctx.arc(x + 22, y + h / 2, 9, 0, TAU); ctx.fill();
      ctx.textAlign = 'left'; ctx.fillStyle = '#fff6e2'; ctx.font = `700 24px ${FONT}`; ctx.fillText(tgtName(key), x + 42, y + 26);
      ctx.fillStyle = '#ffd45a'; ctx.fillText(`+${offerValue(run, i)}${run.bonus === i ? '  ×2' : ''}`, x + 42, y + 54);
    });
  } else if (s.mode === 'practice') {
    ctx.fillStyle = '#fff6e2'; ctx.font = `700 28px ${FONT}`; ctx.textAlign = 'left'; ctx.fillText('Free practice', b.x + 18, b.y + 28);
    ctx.font = `400 24px ${FONT}`; ctx.fillStyle = 'rgba(255,246,226,0.9)';
    ctx.fillText(`Catches ${s.pr.catches}`, b.x + 18, b.y + 66); ctx.fillText(`Streak ${s.pr.streak}`, b.x + 18, b.y + 94); ctx.fillText(`Best ${s.pr.best}`, b.x + 18, b.y + 122);
    const pc = L.practiceChip, key = s.pr.target;
    chip(ctx, pc.x, pc.y, pc.w, pc.h, `Aim: ${tgtName(key)}`, TGT_COL[key], 1);
    ctx.fillStyle = 'rgba(255,246,226,0.7)'; ctx.font = `400 22px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText('tap to change', b.x + b.w / 2, pc.y + pc.h + 24);
  } else {
    const tr = s.tr;
    const title = s.mode === 'watch' ? `Watch: ${s.trickName}` : s.trickName;
    ctx.fillStyle = '#fff6e2'; ctx.font = `700 26px ${FONT}`; ctx.textAlign = 'left';
    const lines = wrapLines(ctx, title, b.w - 32).slice(0, 2);
    lines.forEach((l, i) => ctx.fillText(l, b.x + 18, b.y + 26 + i * 30 + (lines.length === 1 ? 14 : 0)));
    ctx.textAlign = 'left'; ctx.font = `400 22px ${FONT}`; ctx.fillStyle = 'rgba(255,246,226,0.8)';
    ctx.fillText(`Drops ${tr.drops}`, b.x + 18, b.y + 92);
    stars(ctx, starsFor(tr.drops), b.x + b.w - 18, b.y + 92, 26);
    const steps = tr.steps;
    steps.forEach((st, i) => {
      const sub = (st.t === 'lift' && i === tr.i) ? `${tr.lifts} of ${st.n}` : (st.t === 'circle' && i === tr.i) ? `${Math.min(st.n, Math.abs(tr.wind) / TAU).toFixed(1)} of ${st.n}` : null;
      chip(ctx, b.x + 12, b.y + 112 + i * 58, b.w - 24, 48, stepText(st), TGT_COL[st.t] ?? '#ffd45a', i < tr.i || tr.done ? 2 : i === tr.i ? 1 : 0, sub);
    });
    const cur = steps[tr.i];
    if (cur && cur.hold > 1 && s.w.ball.on) {
      const p = Math.min(1, s.w.ball.onT / cur.hold), q = cur.travel ? Math.min(1, tr.holdLen / cur.travel) : 1, y = b.y + 112 + steps.length * 58 - 6;
      ctx.fillStyle = 'rgba(255,255,255,0.15)'; rr(ctx, b.x + 12, y, b.w - 24, 5, 2.5); ctx.fill();
      ctx.fillStyle = '#ffd45a'; rr(ctx, b.x + 12, y, (b.w - 24) * Math.min(p, q), 5, 2.5); ctx.fill();
    }
  }
  ctx.restore();
  return b.y + b.h + 10;
}

// The surround plus the framed window onto the world. `live` adds the play-only layers (glow, hints, petals, finger, floating text).
function drawStageWindow(ctx, s, rope, L, live) {
  const st = L.st;
  drawOuter(ctx, L);
  if (L.land) { ctx.save(); rr(ctx, st.x, st.y + 4, st.w, st.h, st.round); ctx.fillStyle = 'rgba(5,6,20,0.45)'; ctx.fill(); ctx.restore(); }
  ctx.save();
  if (st.round) rr(ctx, st.x, st.y, st.w, st.h, st.round); else { ctx.beginPath(); ctx.rect(st.x, st.y, st.w, st.h); }
  ctx.clip();
  ctx.translate(st.x, st.y - st.wy0 * st.s); ctx.scale(st.s, st.s);
  drawWorld(ctx, s.w, rope, live ? live.o : { parts: s.parts });
  if (live) {
    drawFinger(ctx, s);
    drawPops(ctx, s.pops);
    if (s.flash > 0) { ctx.globalAlpha = Math.min(0.25, s.flash * 0.6); ctx.fillStyle = '#fff3c8'; ctx.fillRect(0, 0, 720, 1280); }
  }
  ctx.restore();
  if (L.land) { ctx.save(); rr(ctx, st.x, st.y, st.w, st.h, st.round); ctx.lineWidth = 2.5; ctx.strokeStyle = 'rgba(255,230,190,0.4)'; ctx.stroke(); ctx.restore(); }
}
export function drawStageWorld(ctx, s, rope) { drawStageWindow(ctx, s, rope, LAY, null); }

export function renderPlay(ctx, s, rope, petals) {
  const L = LAY;
  const glow = glowFor(s);
  const showHint = s.hint && (s.hint.phase === 'show' || s.hint.phase === 'run') ? s.hint : (s.watch && (s.watch.phase === 'think' || s.watch.phase === 'reveal') ? s.watch : null);
  const hintObj = showHint ? { arcs: showHint.arcs, plan: showHint.phase === 'run' || showHint.phase === 'think' ? null : showHint.plan } : null;
  const ghost = showHint && showHint.plan && showHint.plan.land && (showHint.phase === 'show' || showHint.phase === 'reveal') ? showHint.plan.land : null;
  drawStageWindow(ctx, s, rope, L, { o: { glow, petals, parts: s.parts, hint: hintObj, ghost, t: s.t } });
  // goal card
  let below = 0;
  if (L.land) below = drawGoalWide(ctx, s, L);
  else if (s.mode === 'run') drawRunCard(ctx, s, L.hud); else drawTrickCard(ctx, s, L.hud);
  if (s.mode === 'watch') { drawWatchPanel(ctx, s, L, below); drawWatchBar(ctx, s, L); }
  else { drawBar(ctx, s, L); if (s.hint && s.hint.phase === 'show') drawHintCaption(ctx, s.hint, L, below); }
  drawToast(ctx, s, L);
  if (s.hint && s.hint.phase === 'run') {
    ctx.save(); ctx.fillStyle = 'rgba(255,246,226,0.95)'; ctx.font = `700 24px ${FONT}`; ctx.textAlign = 'center'; ctx.shadowColor = 'rgba(8,10,28,0.8)'; ctx.shadowBlur = 6;
    ctx.fillText('Thinking' + '.'.repeat(1 + (Math.floor(s.t * 3) % 3)), L.thinkText.x, L.thinkText.y); ctx.restore();
  }
}

export { TGT_COL, textShadow, C };
