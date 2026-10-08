// The play screen on the 2D layer: goal card, spin gauge, buttons, pops, toasts, the Think / Learn captions and the planner's arcs.
// The 3D scene sits behind (web/view3d); without WebGL this file also draws the 2D stand-in.
import { LAY, ACT_BTN, HINT_BTN, MENU_BTN, WATCH_BAR, THINK_STEPS } from './layout.js';
import { FONT, C, roundPath, drawButton, panel, wrapLines, textShadow } from './ui.js';
import { gfx, drawBackdrop, drawToy2D, drawSpinGauge } from './art.js';
import { TRICK_BY_ID, TOY_NAME, SHOW_SECONDS } from './tricks.js';

const TAU = Math.PI * 2;

// what the current goal needs, from the live bookkeeping
export function progress(state) {
  const w = state.w, id = state.mode === 'trick' || state.mode === 'watch' ? state.trickId : null;
  if (!id) return null;
  const a = w.att, d = w.db;
  switch (id) {
    case 'y-downup': return { text: w.yy.mode === 'home' ? 'Flick down to throw' : 'Flick up to bring it back', frac: w.yy.mode === 'home' ? 0 : 0.5 };
    case 'y-sleeper': return { text: `Sleep ${Math.min(a.sleepBest, 2.5).toFixed(1)} / 2.5 s`, frac: Math.min(1, a.sleepBest / 2.5) };
    case 'y-long': return { text: `Sleep ${Math.min(a.sleepBest, 6).toFixed(1)} / 6 s`, frac: Math.min(1, a.sleepBest / 6) };
    case 'y-walk': return { text: `Walked ${Math.min(a.walk, 0.9).toFixed(1)} / 0.9 m`, frac: Math.min(1, a.walk / 0.9) };
    case 'y-break': return { text: `Swing out ${Math.round(Math.min(1, a.reach / 0.9) * 100)}%`, frac: Math.min(1, a.reach / 0.9) };
    case 'y-around': return { text: `Circles ${Math.min(a.loops, 1)} / 1`, frac: Math.min(1, a.loops) };
    case 'y-double': return { text: `Circles ${Math.min(a.loops, 2)} / 2`, frac: Math.min(1, a.loops / 2) };
    case 'd-spin': return { text: `Hold the spin ${Math.min(d.spinT, 2).toFixed(1)} / 2 s`, frac: Math.min(1, d.spinT / 2) };
    case 'd-long': return { text: `Fast spin ${Math.min(d.longT, 1.5).toFixed(1)} / 1.5 s`, frac: Math.min(1, d.longT / 1.5) };
    case 'd-pend': return { text: `Swings ${Math.min(d.swingN, 4)} / 4`, frac: Math.min(1, d.swingN / 4) };
    case 'd-toss': return { text: d.air ? `Height ${d.peak.toFixed(1)} m` : 'Spin up, then flick up', frac: Math.min(1, d.peak / 0.8) };
    case 'd-side': return { text: d.air ? `Across ${Math.abs(d.x - d.x0).toFixed(1)} / 0.8 m` : 'Flick up and sideways', frac: Math.min(1, Math.abs(d.x - d.x0) / 0.8) };
    case 'd-high': return { text: d.air ? `Height ${d.peak.toFixed(1)} / 2.0 m` : 'Spin up, flick up hard', frac: Math.min(1, d.peak / 2) };
    case 'd-triple': return { text: `Catches ${Math.min(state.j.triple, 3)} / 3`, frac: Math.min(1, state.j.triple / 3) };
    default: return null;
  }
}

const mmss = (s) => `${Math.floor(Math.max(0, s) / 60)}:${String(Math.floor(Math.max(0, s) % 60)).padStart(2, '0')}`;

function hudCard(ctx, state) {
  const L = LAY, R = L.hud, pad = 18;
  panel(ctx, R.x, R.y, R.w, R.h, { r: 24, fill: 'rgba(8,28,36,0.78)', stroke: 'rgba(240,189,74,0.55)' });
  ctx.save(); ctx.beginPath(); roundPath(ctx, R.x, R.y, R.w, R.h, 24); ctx.clip();
  const g = ctx.createLinearGradient(R.x, 0, R.x + R.w, 0); g.addColorStop(0, '#6a5aa0'); g.addColorStop(0.5, '#3f6fb0'); g.addColorStop(1, '#2fb8b0'); ctx.fillStyle = g; ctx.globalAlpha = 0.85; ctx.fillRect(R.x, R.y, R.w, 3); ctx.restore();
  ctx.textBaseline = 'alphabetic';
  const w = state.w, mode = state.mode, x0 = R.x + pad, wInner = R.w - 2 * pad;
    const line = (txt, y, size, col, bold = true, maxLines = 1) => {
    let px = size;
    ctx.font = `${bold ? 700 : 500} ${px}px ${FONT}`;
    let lines = wrapLines(ctx, txt, wInner);
    while (lines.length > maxLines && px > 18) { px -= 1; ctx.font = `${bold ? 700 : 500} ${px}px ${FONT}`; lines = wrapLines(ctx, txt, wInner); }
    ctx.fillStyle = col; ctx.textAlign = 'left';
    lines.slice(0, maxLines).forEach((l, i) => ctx.fillText(l, x0, y + i * px * 1.18));
    return y + Math.min(lines.length, maxLines) * px * 1.18;
  };
  if (mode === 'trick' || mode === 'watch') {
    const tr = TRICK_BY_ID[state.trickId];
    let y = line(tr.name, R.y + 38, L.land ? 32 : 34, '#fff6e2');
    y = line(tr.goal, y + 2, 22, 'rgba(230,246,246,0.92)', false, L.land ? 4 : 2);
    const pr = progress(state);
    if (pr) {
      const by = Math.min(y + 6, L.spin.y - 46);
      ctx.font = `700 22px ${FONT}`; ctx.fillStyle = '#ffd97a'; ctx.textAlign = 'left'; ctx.fillText(pr.text, x0, by + 20);
      roundPath(ctx, x0, by + 28, wInner, 8, 4); ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fill();
      if (pr.frac > 0) { roundPath(ctx, x0, by + 28, Math.max(8, wInner * pr.frac), 8, 4); ctx.fillStyle = pr.frac >= 1 ? '#7be8a0' : '#f0bd4a'; ctx.fill(); }
    }
    if (mode === 'trick') { ctx.textAlign = 'right'; ctx.font = `600 20px ${FONT}`; ctx.fillStyle = 'rgba(255,233,191,0.85)'; ctx.fillText(`Drops ${state.drops}`, R.x + R.w - pad, L.land ? L.spin.y - 12 : R.y + 34); }
  } else if (mode === 'show') {
    const sh = state.show, ch = `Chain ${sh.chain}  x${Math.min(3, 1 + 0.25 * sh.chain).toFixed(2).replace(/0$/, '')}`;
    ctx.textAlign = 'left'; ctx.font = `800 ${L.land ? 50 : 52}px ${FONT}`; textShadow(ctx, String(sh.score), x0, R.y + 62, '#ffd45a', 6);
    ctx.font = `700 22px ${FONT}`; ctx.fillStyle = '#fff6e2'; ctx.fillText(ch, x0, R.y + (L.land ? 98 : 92));
    const tf = sh.time < 20 ? '#ff9a88' : '#e6f6f6', hearts = '♥ '.repeat(Math.max(0, sh.lives)).trim() || '·';
    if (!L.land) {
      ctx.textAlign = 'right'; ctx.font = `800 34px ${FONT}`; ctx.fillStyle = tf; ctx.fillText(mmss(sh.time), R.x + R.w - pad, R.y + 46);
      ctx.font = `700 28px ${FONT}`; ctx.fillStyle = '#ff6a54'; ctx.fillText(hearts, R.x + R.w - pad, R.y + 92);
    } else {
      ctx.textAlign = 'left'; ctx.font = `800 34px ${FONT}`; ctx.fillStyle = tf; ctx.fillText(mmss(sh.time), x0, R.y + 140);
      ctx.font = `700 28px ${FONT}`; ctx.fillStyle = '#ff6a54'; ctx.fillText(hearts, x0 + 110, R.y + 140);
      ctx.font = `500 20px ${FONT}`; ctx.fillStyle = 'rgba(230,246,246,0.8)'; wrapLines(ctx, 'Land tricks to score. A drop breaks the chain.', wInner).slice(0, 2).forEach((l, i) => ctx.fillText(l, x0, R.y + 176 + i * 24));
    }
  } else if (mode === 'daily') {
    const d = state.daily;
    let y = line("Today's challenge", R.y + 34, 26, '#fff6e2');
    ctx.font = `600 ${L.land ? 21 : 22}px ${FONT}`; ctx.textAlign = 'left';
    d.ids.forEach((id, i) => {
      const done = d.done.includes(id), yy = y + 6 + i * (L.land ? 30 : 24);
      ctx.fillStyle = done ? '#7be8a0' : 'rgba(230,246,246,0.9)'; ctx.fillText(`${done ? '✓' : '○'} ${TRICK_BY_ID[id].name}`, x0, yy + 18);
    });
    ctx.textAlign = 'right'; ctx.font = `700 22px ${FONT}`; ctx.fillStyle = '#ffd97a'; ctx.fillText(String(state.show.score), R.x + R.w - pad, R.y + 34);
    ctx.font = `600 20px ${FONT}`; ctx.fillStyle = '#ff9a88'; ctx.fillText(`Drops ${state.drops}/${state.show.lives + state.drops}`, R.x + R.w - pad, R.y + 62);
  } else {
    line(`${TOY_NAME[state.toy]}: free play`, R.y + 38, 30, '#fff6e2');
    line('No goal. Try anything. The names of tricks you land pop up.', R.y + 68, 21, 'rgba(230,246,246,0.9)', false, L.land ? 4 : 2);
  }
  drawSpinGauge(ctx, L.spin, w);
}

function arcs(ctx, cam, list, col) {
  ctx.save(); ctx.lineWidth = 3; ctx.lineJoin = 'round';
  list.forEach((a, k) => {
    if (!a.path.length) return;
    ctx.strokeStyle = a.ok ? 'rgba(123,232,160,0.75)' : col; ctx.globalAlpha = a.ok ? 0.8 : 0.22 + 0.3 * (k / list.length);
    ctx.beginPath(); a.path.forEach((p, i) => { const q = cam.project(p[0], p[1], 0); if (i) ctx.lineTo(q.x, q.y); else ctx.moveTo(q.x, q.y); }); ctx.stroke();
  });
  ctx.restore();
}
function caption(ctx, x, y, w, text, sub, col = '#bff8fa') {
  ctx.save(); ctx.font = `700 26px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  const lines = wrapLines(ctx, text, w - 40);
  ctx.font = `500 22px ${FONT}`; const sl = sub ? wrapLines(ctx, sub, w - 40) : [];
  const h = 24 + lines.length * 32 + sl.length * 28 + 16;
  panel(ctx, x - w / 2, y, w, h, { r: 22, fill: 'rgba(6,26,34,0.82)', stroke: 'rgba(111,232,238,0.5)' });
  ctx.font = `700 26px ${FONT}`; ctx.fillStyle = col; lines.forEach((l, i) => ctx.fillText(l, x, y + 40 + i * 32));
  ctx.font = `500 22px ${FONT}`; ctx.fillStyle = 'rgba(230,246,246,0.92)'; sl.forEach((l, i) => ctx.fillText(l, x, y + 40 + lines.length * 32 + 6 + i * 28));
  ctx.restore();
  return h;
}

export function renderPlay(ctx, state, cam) {
  const L = LAY, w = state.w, mode = state.mode;
  ctx.clearRect(0, 0, L.W, L.H);
  if (!gfx.has3d) { drawBackdrop(ctx, L, cam); drawToy2D(ctx, cam, w); if (state.ghost) { const f = state.ghost.frames[Math.min(state.ghost.frames.length - 1, state.ghost.idx | 0)]; if (f) { const gw = JSON.parse(JSON.stringify(w)); const t = gw.toy === 'yoyo' ? gw.yy : gw.db; t.x = f.x; t.y = f.y; gw.hand.x = f.hx; gw.hand.y = f.hy; drawToy2D(ctx, cam, gw, 0.4); } } }
  if (state.flash > 0) { ctx.fillStyle = `rgba(255,236,190,${Math.min(0.22, state.flash * 0.3)})`; ctx.fillRect(0, 0, L.W, L.H); }
  const wt = state.watch, hint = state.hint;
  if (mode === 'watch' && wt && wt.phase === 'think') arcs(ctx, cam, wt.arcs, 'rgba(255,214,140,1)');
  else if (hint && hint.phase === 'run') arcs(ctx, cam, hint.arcs, 'rgba(255,214,140,1)');
  hudCard(ctx, state);
  // pops float up from where the toy was
  for (const p of state.pops) {
    const k = p.t / p.max, q = cam.project(p.x, p.y, 0);
    ctx.save(); ctx.globalAlpha = Math.min(1, (1 - k) * 2); ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.font = `800 ${p.size ?? 40}px ${FONT}`;
    textShadow(ctx, p.text, Math.max(L.U.x0 + 120, Math.min(L.U.x1 - 120, q.x)), q.y - 60 * k - 20, p.col ?? '#ffe9bf', 8);
    ctx.restore();
  }
  const sx = L.stage.x + L.stage.w / 2;
  if (state.learn) {
    const h = state.hint;
    if (h && h.phase === 'run') caption(ctx, sx, L.stage.y + 16, Math.min(L.stage.w - 40, 560), 'Planning a demo…', 'The hand motion is found by simulating the real physics.');
    else if (h) caption(ctx, sx, L.stage.y + 16, Math.min(L.stage.w - 40, 600), `How to: ${TRICK_BY_ID[state.trickId].name}`, `${h.text} Tap anywhere to try it.`);
  } else if (hint && hint.phase === 'run') caption(ctx, sx, L.stage.y + 16, Math.min(L.stage.w - 40, 520), 'Thinking…', 'Trying many hand motions.');
  else if (hint && hint.phase === 'show') caption(ctx, sx, L.stage.y + 16, Math.min(L.stage.w - 40, 600), 'Think: ghost demo', `${hint.text} Touch to dismiss.`);
  if (mode === 'watch' && wt) {
    const lab = { think: 'Thinking', reveal: 'The plan', act: 'Performing', celebrate: 'Done' }[wt.phase];
    const sub = wt.phase === 'think' ? `${Math.max(0, Math.ceil(wt.dur - wt.t))} s. ${wt.note}` : wt.note;
    caption(ctx, sx, L.stage.y + 16, Math.min(L.stage.w - 40, 620), `${lab}: ${TRICK_BY_ID[state.trickId].name}`, sub, wt.phase === 'celebrate' ? '#7be8a0' : '#bff8fa');
    if (state.paused) { ctx.save(); ctx.fillStyle = 'rgba(4,16,22,0.55)'; ctx.fillRect(L.stage.x, L.stage.y, L.stage.w, L.stage.h); ctx.font = `800 56px ${FONT}`; ctx.fillStyle = '#fff6e2'; ctx.textAlign = 'center'; ctx.fillText('Paused', sx, L.stage.y + L.stage.h / 2); ctx.restore(); }
  }
  if (state.toastT > 0 && !state.learn) {
    const a = Math.min(1, state.toastT * 2);
    ctx.save(); ctx.globalAlpha = a; ctx.font = `600 24px ${FONT}`; ctx.textAlign = 'center';
    const tw = Math.min(L.stage.w - 40, 620), lines = wrapLines(ctx, state.toast, tw - 40), h = 24 + lines.length * 30;
    const ty = L.land ? L.U.y1 - 24 - h : L.toastY - h;
    panel(ctx, sx - tw / 2, ty, tw, h, { r: 20, fill: 'rgba(6,26,34,0.82)', stroke: 'rgba(240,189,74,0.5)' });
    ctx.fillStyle = '#fff6e2'; lines.forEach((l, i) => ctx.fillText(l, sx, ty + 33 + i * 30)); ctx.restore();
  }
  // buttons
  if (mode === 'watch') {
    drawButton(ctx, WATCH_BAR.pause, state.paused ? 'Resume' : 'Pause', { primary: true, size: 32 });
    drawButton(ctx, WATCH_BAR.dec, 'Think −', { dark: true, size: 24, disabled: state.settings.thinkIdx === 0 });
    drawButton(ctx, WATCH_BAR.inc, 'Think +', { dark: true, size: 24, disabled: state.settings.thinkIdx === THINK_STEPS.length - 1 });
    drawButton(ctx, WATCH_BAR.exit, 'Leave', { dark: true, size: 26 });
    ctx.save(); ctx.font = `600 22px ${FONT}`; ctx.textAlign = 'center'; ctx.fillStyle = '#e6f6f6'; textShadow(ctx, `Thinking time ${THINK_STEPS[state.settings.thinkIdx]} s`, WATCH_BAR.label.x, WATCH_BAR.label.y, '#e6f6f6', 4); ctx.restore();
  } else {
    const isY = w.toy === 'yoyo';
    drawButton(ctx, ACT_BTN, isY ? 'Return' : 'Toss', { primary: true, size: 32, sub: isY ? 'or flick up' : 'or flick up', disabled: !!state.learn });
    drawButton(ctx, HINT_BTN, 'Think', { dark: true, size: 28, active: !!(hint && hint.phase === 'show') });
    drawButton(ctx, MENU_BTN, 'Menu', { dark: true, size: 28 });
  }
  void TAU; void C; void SHOW_SECONDS;
}
