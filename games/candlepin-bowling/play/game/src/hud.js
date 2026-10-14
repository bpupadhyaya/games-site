// Everything drawn over the lane in the play scene: score cards, deck map, controls, toasts, the scorecard sheet and the
// Watch & Learn panel. Pure drawing; game.js owns state. Positions come from the live layout (layout.js).
import { LANE, PIN_XY, PACES, MAX_CURVE } from './sim.js';
import { drawScene } from './view.js';
import { FONT, DISPLAY, C, roundPath, drawButton, panel, wrapLines, textShadow, ease } from './ui.js';
import { scoreCard, runningTotal, FRAMES } from './match.js';
import { THINK_STEPS } from './layout.js';
import { v3, shade } from './v3.js';

const TAU = Math.PI * 2;
const H = LANE.headY;

const curveName = (c) => (c === 0 ? 'Straight' : c < 0 ? `Curve left ${-c}` : `Curve right ${c}`);
export { curveName };

// ---- score cards ---------------------------------------------------------------------------------------
function playerCard(ctx, r, name, total, o) {
  const { active = false, balls = null, sub = null, color = '#ffc24a', big = null } = o;
  panel(ctx, r.x, r.y, r.w, r.h, { r: 22, fill: active ? 'rgba(18,30,66,0.93)' : 'rgba(10,16,38,0.82)', stroke: active ? color : 'rgba(255,255,255,0.2)', shadow: true, kind: active ? 'plateOn' : 'plate', accent: color });
  ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  ctx.fillStyle = active ? '#fff6dc' : 'rgba(255,246,220,0.72)';
  let fs = r.w < 250 ? 22 : 26; ctx.font = `700 ${fs}px ${FONT}`;
  while (ctx.measureText(name).width > r.w - 36 - (r.w < 250 ? 76 : 96) && fs > 15) { fs -= 1; ctx.font = `700 ${fs}px ${FONT}`; }
  let s = name; while (ctx.measureText(s).width > r.w - 36 - 70 && s.length > 3) s = s.slice(0, -1);
  ctx.fillText(s, r.x + 18, r.y + 36);
  if (sub) { ctx.font = `400 19px ${FONT}`; ctx.fillStyle = 'rgba(255,246,220,0.7)'; ctx.fillText(sub, r.x + 18, r.y + 62); }
  if (balls) {
    // three ball dots: used balls are dim
    for (let i = 0; i < 3; i++) {
      const cx = r.x + 26 + i * 24, cy = r.y + r.h - 16;
      ctx.beginPath(); ctx.arc(cx, cy, 8, 0, TAU);
      ctx.fillStyle = i < balls.used ? 'rgba(255,255,255,0.18)' : (active ? color : 'rgba(255,255,255,0.55)'); ctx.fill();
    }
  }
  ctx.textAlign = 'right'; ctx.fillStyle = active ? color : '#ffe9b0'; ctx.font = `800 ${big ? 40 : 52}px ${FONT}`;
  ctx.fillText(String(total), r.x + r.w - 16, r.y + 62);
  ctx.textAlign = 'left';
}

export function renderPlay(ctx, state, L) {
  if (v3.on && state.showCard) ctx.globalAlpha = 0.25;      // the modal sheet dims what is behind it (their 3D plaques are dimmed by its shade)
  const P = L.play, m = state.m, pz = state.pz;
  const watch = state.mode === 'watch';
  const aimOn = state.phase === 'aim' && (state.humanTurn || state.hint);
  const aim = state.phase === 'aim' || state.phase === 'roll' ? {
    x0: state.x0, aimX: state.aimX, pts: state.guide?.pts, gutter: state.guide?.gutter, hintPts: state.hintGuide?.pts,
  } : null;
  // two panels: the pin deck close-up (where you aim) and the lane seen from behind the foul line (where you start)
  if (!v3.on) { ctx.fillStyle = '#070b1c'; ctx.fillRect(0, P.court.y - 4, L.w, P.court.h + 8); }
  const sceneOpts = {
    world: state.w, parts: state.parts, shake: state.shake, aim, ghost: state.phase === 'aim', noAim: !aimOn,
    sweepAlpha: state.sweep ? (p) => ((state.sweep.then === 'rack' ? p.s !== 2 : p.s === 1) ? Math.max(0, 1 - state.sweep.t / 0.7) : 1) : null,
  };
  state.camDeck = drawScene(ctx, P.deckPanel, L.poses.deck, sceneOpts);
  state.camLane = drawScene(ctx, P.lanePanel, L.poses.lane, { ...sceneOpts, shake: null });
  if (!v3.on) for (const r of [P.deckPanel, P.lanePanel]) { ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 2; ctx.strokeRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2); }
  if (state.humanTurn && state.phase === 'aim' && (state.record.thrown | 0) < 4 && !state.pz && !state.pauseMenu) {
    const tag = (r, text) => { ctx.font = `700 19px ${FONT}`; const w = ctx.measureText(text).width + 26; if (v3.on) panel(ctx, r.x + r.w / 2 - w / 2, r.y + 8, w, 34, { r: 17, kind: 'chip' }); else { roundPath(ctx, r.x + r.w / 2 - w / 2, r.y + 8, w, 34, 17); ctx.fillStyle = 'rgba(8,14,34,0.78)'; ctx.fill(); } ctx.fillStyle = '#ffe9b0'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, r.x + r.w / 2, r.y + 26); };
    tag(P.deckPanel, 'Touch here to aim'); tag(P.lanePanel, 'Drag here to slide the ball');
  }

  // cards
  const txt = (s, x, y, size, col = '#fff6dc', align = 'center', weight = 700) => { ctx.fillStyle = col; ctx.font = `${weight} ${size}px ${FONT}`; ctx.textAlign = align; ctx.textBaseline = 'alphabetic'; ctx.fillText(s, x, y); };
  if (v3.on) panel(ctx, P.info.x - 112, P.info.y - 34, 224, pz ? 48 : 66, { r: 16, kind: 'plate' });
  if (pz) {
    playerCard(ctx, P.cards[0], `Puzzle ${pz.index + 1}`, pz.score ?? 0, { active: true, sub: pz.title, big: true });
    playerCard(ctx, P.cards[1], 'Balls left', pz.left, { active: true, sub: `Clear in ${pz.budget} for 3 stars`, big: true });
    txt(`${state.w.pins.filter((p) => p.s === 0).length} standing`, P.info.x, P.info.y, 24, '#fff6dc');
  } else if (m) {
    for (let i = 0; i < Math.min(2, m.n); i++) {
      const active = m.turn === i && !m.over;
      playerCard(ctx, P.cards[i], state.labels[i].name, runningTotal(m.rolls[i]), { active, balls: active ? { used: m.ball } : null, sub: `Frame ${Math.min(FRAMES, m.frame + 1)}`, color: i === 0 ? '#ffc24a' : '#4fe0d4' });
    }
    txt(`Frame ${Math.min(FRAMES, m.frame + 1)} of ${FRAMES}`, P.info.x, P.info.y, 24, '#fff6dc');
    txt(`Ball ${m.ball + 1}${m.frame === FRAMES - 1 ? ' (tenth)' : ''}`, P.info.x, P.info.y2, 21, '#ffd97a', 'center', 600);
  }

  // controls
  const humanAct = state.humanTurn && state.phase === 'aim' && !state.paused && !watch;
  if (watch) {
    const d = P.demo, tm = THINK_STEPS[state.settings.thinkIdx];
    drawButton(ctx, d.dec, 'Think −', { size: 26, disabled: state.settings.thinkIdx === 0 });
    drawButton(ctx, d.pause, state.paused ? 'Resume' : 'Pause', { primary: true, size: 30, sub: `thinking ${tm} s` });
    drawButton(ctx, d.inc, 'Think +', { size: 26, disabled: state.settings.thinkIdx === THINK_STEPS.length - 1 });
    drawButton(ctx, d.exit, 'Exit Watch & Learn', { dark: true, size: 26 });
  } else {
    PACES.forEach((pc, i) => drawButton(ctx, P.pace[i], pc.name, { active: state.sel.pace === i, disabled: !humanAct, size: 28 }));
    drawButton(ctx, P.curveDec, '‹', { disabled: !humanAct || state.sel.curve <= -MAX_CURVE, size: 36 });
    drawButton(ctx, P.curveLabel, curveName(state.sel.curve), { disabled: !humanAct, size: 22, active: state.sel.curve !== 0 && humanAct });
    drawButton(ctx, P.curveInc, '›', { disabled: !humanAct || state.sel.curve >= MAX_CURVE, size: 36 });
    drawButton(ctx, P.hint, state.hintBusy ? '…' : 'Hint', { disabled: !humanAct, size: 26 });
    drawButton(ctx, P.menu, 'Menu', { dark: true, size: 26 });
    drawButton(ctx, P.roll, state.phase === 'roll' || state.phase === 'settle' ? 'Rolling…' : (state.humanTurn || pz ? 'ROLL' : 'Rival is bowling'), { primary: true, disabled: !humanAct, size: 34 });
  }

  // toast, pop, think bar
  if (state.toastT > 0 && state.toast && !state.pauseMenu && !(watch && state.explain)) {
    ctx.save(); ctx.globalAlpha = Math.min(1, state.toastT * 2);
    ctx.font = `700 24px ${FONT}`;
    const lines = wrapLines(ctx, state.toast, P.toast.maxW - 40), lh = 30, hh = lines.length * lh + 22, ww = Math.min(P.toast.maxW, Math.max(...lines.map((l) => ctx.measureText(l).width)) + 44);
    if (v3.on) panel(ctx, P.toast.x - ww / 2, P.toast.y - 6, ww, hh, { r: 18, kind: 'plateOn', accent: '#ffc24a' }); else { roundPath(ctx, P.toast.x - ww / 2, P.toast.y - 6, ww, hh, 18); ctx.fillStyle = 'rgba(8,14,34,0.88)'; ctx.fill(); }
    ctx.fillStyle = '#fff6dc'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    lines.forEach((l, i) => ctx.fillText(l, P.toast.x, P.toast.y + 24 + i * lh));
    ctx.restore();
  }
  if (state.pop) {
    const t = state.pop.t, k = ease.outBack(Math.min(1, t / 0.35)), a = t > 1.5 ? Math.max(0, 1 - (t - 1.5) / 0.4) : 1;
    ctx.save(); ctx.globalAlpha = a;
    const cx = P.deckPanel.x + P.deckPanel.w / 2, cy = P.deckPanel.y + P.deckPanel.h * 0.62;
    ctx.translate(cx, cy); ctx.scale(k, k);
    ctx.font = `900 ${state.pop.big ? 116 : 92}px ${DISPLAY}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round'; ctx.lineWidth = 14; ctx.strokeStyle = 'rgba(10,14,40,0.85)'; ctx.strokeText(state.pop.text, 0, 0);
    if (v3.on) { const fs = state.pop.big ? 116 : 92, g = ctx.createLinearGradient(0, -fs * 0.5, 0, fs * 0.45); g.addColorStop(0, '#fffbe6'); g.addColorStop(0.5, state.pop.color ?? '#ffd35a'); g.addColorStop(0.52, '#c97a12'); g.addColorStop(1, state.pop.color ?? '#ffb22e'); ctx.shadowColor = 'rgba(255,170,40,0.8)'; ctx.shadowBlur = 26; ctx.fillStyle = g; }
    else ctx.fillStyle = state.pop.color ?? '#ffd35a';
    ctx.fillText(state.pop.text, 0, 0); ctx.shadowBlur = 0;
    if (state.pop.sub) { ctx.font = `700 34px ${FONT}`; ctx.lineWidth = 8; ctx.strokeText(state.pop.sub, 0, 70); ctx.fillStyle = '#fff6dc'; ctx.fillText(state.pop.sub, 0, 70); }
    ctx.restore();
  }
  if (state.think && !state.paused && state.think.phase === 'think') {
    const k = Math.min(1, state.think.t / state.think.dur), w = Math.min(380, L.w - 120), x = L.w / 2 - w / 2, y = P.pill.y + 70;
    if (v3.on) { panel(ctx, x, y - 2, w, 14, { r: 7, kind: 'cell' }); panel(ctx, x, y - 2, Math.max(14, w * k), 14, { r: 7, kind: 'gold' }); }
    else { roundPath(ctx, x, y, w, 10, 5); ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.fill();
    roundPath(ctx, x, y, Math.max(10, w * k), 10, 5); ctx.fillStyle = '#ffc24a'; ctx.fill(); }
    ctx.fillStyle = '#fff6dc'; ctx.font = `600 20px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.fillText(`${state.labels[m ? m.turn : 0].name} is thinking…`, L.w / 2, y - 8);
  }
  if (state.explain && watch) {
    const e = state.explain, hostRect = L.wide ? P.deckPanel : P.lanePanel;
    const w = hostRect.w - 24, x = hostRect.x + 12, y = L.wide ? hostRect.y + hostRect.h - 12 : hostRect.y + 12;
    ctx.font = `700 22px ${FONT}`;
    const head = wrapLines(ctx, e.head, w - 36);
    ctx.font = `400 19px ${FONT}`;
    const body = [];
    for (const ln of e.lines ?? []) body.push(...wrapLines(ctx, ln, w - 36));
    const hh = head.length * 28 + body.length * 24 + 22, y0 = L.wide ? y - hh : y;
    if (v3.on) panel(ctx, x, y0, w, hh, { r: 16, kind: 'plate' }); else { roundPath(ctx, x, y0, w, hh, 16); ctx.fillStyle = 'rgba(8,14,34,0.84)'; ctx.fill(); }
    ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
    ctx.fillStyle = '#ffd97a'; ctx.font = `700 22px ${FONT}`; head.forEach((l, i) => ctx.fillText(l, x + 18, y0 + 30 + i * 28));
    ctx.fillStyle = '#fff6dc'; ctx.font = `400 19px ${FONT}`; body.forEach((l, i) => ctx.fillText(l, x + 18, y0 + 30 + head.length * 28 + i * 24));
  }
  ctx.globalAlpha = 1;
  if (state.showCard) drawScoreSheet(ctx, state, L);
}

// ---- scorecard sheet -----------------------------------------------------------------------------------
export function drawScoreSheet(ctx, state, L) {
  const m = state.m;
  if (!m) return;
  const r = L.play.score;
  ctx.save();
  if (v3.on) shade('sheet', { x: 0, y: 0, w: L.w, h: L.h }, (g2, w, h) => { g2.fillStyle = 'rgba(2,6,18,0.62)'; g2.fillRect(0, 0, w, h); });
  else { ctx.fillStyle = 'rgba(2,6,18,0.62)'; ctx.fillRect(0, 0, L.w, L.h); }
  panel(ctx, r.x, r.y, r.w, r.h, { r: 26, fill: 'rgba(250,244,226,0.98)', stroke: 'rgba(40,50,90,0.7)', kind: 'paper' });
  ctx.fillStyle = '#7d1218'; ctx.font = `800 34px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillText('Scorecard', r.x + r.w / 2, r.y + 50);
  const pad = 22, wideCard = r.w >= 600 && L.wide;
  const blockH = (r.h - 80 - 44) / m.n;
  for (let p = 0; p < m.n; p++) {
    const card = scoreCard(m.rolls[p]);
    const y0 = r.y + 70 + p * blockH;
    ctx.fillStyle = '#16213a'; ctx.font = `800 26px ${FONT}`; ctx.textAlign = 'left';
    ctx.fillText(state.labels[p].name, r.x + pad, y0 + 22);
    ctx.textAlign = 'right'; ctx.fillStyle = '#7d1218'; ctx.fillText(`Total ${runningTotal(m.rolls[p])}`, r.x + r.w - pad, y0 + 22);
    const rows = wideCard ? 1 : 2, per = wideCard ? 10 : 5, cw = (r.w - 2 * pad) / per, chh = Math.min(86, (blockH - 40) / rows - 4);
    for (let f = 0; f < FRAMES; f++) {
      const row = Math.floor(f / per), col = f % per, x = r.x + pad + col * cw, y = y0 + 34 + row * (chh + 6);
      const cur = m.turn === p && m.frame === f && !m.over;
      if (v3.on) panel(ctx, x, y, cw - 4, chh, { r: 7, kind: cur ? 'cellOn' : 'cell' });
      else { ctx.fillStyle = cur ? '#fff0c2' : '#ffffff'; ctx.strokeStyle = '#2b3558'; ctx.lineWidth = 1.5; ctx.fillRect(x, y, cw - 4, chh); ctx.strokeRect(x, y, cw - 4, chh); }
      ctx.fillStyle = '#6b7396'; ctx.font = `700 14px ${FONT}`; ctx.textAlign = 'left'; ctx.fillText(String(f + 1), x + 5, y + 15);
      const fr = card.frames[f];
      ctx.fillStyle = '#16213a'; ctx.font = `800 ${Math.min(24, chh * 0.34)}px ${FONT}`; ctx.textAlign = 'right';
      const marks = fr.rolls.map((v, i) => {
        if (!fr.tenth) { if (fr.mark === 'X' && i === 0) return 'X'; if (fr.mark === '/' && i === 1) return '/'; }
        return v === 0 ? '-' : String(v);
      });
      ctx.fillText(marks.join(' '), x + cw - 10, y + chh * 0.46);
      ctx.fillStyle = '#7d1218'; ctx.font = `800 ${Math.min(28, chh * 0.4)}px ${FONT}`; ctx.textAlign = 'center';
      if (fr.total !== null) ctx.fillText(String(fr.total), x + (cw - 4) / 2, y + chh - 9);
    }
  }
  ctx.fillStyle = 'rgba(40,50,90,0.75)'; ctx.font = `400 20px ${FONT}`; ctx.textAlign = 'center';
  ctx.fillText('Tap anywhere to close', r.x + r.w / 2, r.y + r.h - 20);
  ctx.restore();
}
