// Drawing the play screen: the scene, the HUD, the bottom controls and the overlays (countdown, hint,
// Think/Reveal/Act, round banner). Pure drawing; game.js owns state.
import { W, H, K, ANCHOR, stringPoints, windAt, clamp, pressureOf } from './sim.js';
import { drawSky, drawClouds, drawWindStreaks, drawLand, drawFlyer, drawKite, drawString, drawContact, drawParticles, KITE_PAL } from './art.js';
import { MODE_BTN, THINK_BTN, PAUSE_BTN, WATCH_BAR, WIND_PANEL, BANNER_BTN, THINK_STEPS } from './layout.js';
import { FONT, DISPLAY, C, roundPath, paintButton, drawButton, panel, textShadow, wrapLines } from './ui.js';
import { PROFILES, MODE_WORD } from './ai.js';

const TAU = Math.PI * 2;

export function nameOf(state, side) {
  const m = state.match;
  if (!m) return side === 0 ? 'You' : 'Rival';
  if (m.cfg.mode === 'watch') return PROFILES[side === 0 ? m.cfg.watchA : m.cfg.opp].name;
  return side === 0 ? 'You' : PROFILES[m.cfg.opp].name;
}
export const palsOf = (m) => (m.cfg.mode === 'watch' ? [KITE_PAL[1 + m.cfg.watchA], KITE_PAL[1 + m.cfg.opp]] : [KITE_PAL[0], KITE_PAL[1 + m.cfg.opp]]);

// ---- the scene --------------------------------------------------------------------------------
export function drawScene(ctx, state, w, sky, pals, o = {}) {
  const t = state.t, wp = state.wp, dir = w.wind.dir;
  drawSky(ctx, sky, t);
  drawClouds(ctx, sky, wp, dir);
  drawWindStreaks(ctx, wp, dir, w.wnow);
  drawLand(ctx, sky, wp, dir, w.wnow);
  if (!o.noFlyers) for (const k of w.k) drawFlyer(ctx, k.side, k, pals[k.side], t);
  // strings
  const pts = [];
  for (const k of w.k) {
    if (k.free) continue;
    k.dirHint = dir;
    stringPoints(k, pts);
    drawString(ctx, pts, k, t);
  }
  if (w.sever) drawSever(ctx, w, pals);
  if (w.contact && !w.over) drawContact(ctx, w.contact, t, Math.max(w.contact.rate[0], w.contact.rate[1]));
  for (const k of w.k) {
    if (k.free) {
      const away = clamp((k.y - (w.over ? w.over.y : 0)) / 600, 0, 1);
      drawKite(ctx, k, pals[k.side], t, { alpha: 1 - away * 0.7, scale: 1 });
      ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1.6; ctx.beginPath();
      for (let i = 0; i <= 10; i++) { const x = k.x - Math.sin(t * 5 + i * 0.6) * 6 - w.wind.dir * i * 3, y = k.y - i * 9; if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
      ctx.stroke();
    } else drawKite(ctx, k, pals[k.side], t, { scale: 1 });
  }
  drawParticles(ctx, state.parts);
}

function drawSever(ctx, w) {
  const s = w.sever, a = ANCHOR[s.side];
  ctx.strokeStyle = 'rgba(255,246,228,0.85)'; ctx.lineWidth = 2; ctx.lineCap = 'round';
  const sag = 30 + s.t * 40;
  ctx.beginPath(); ctx.moveTo(a.x, a.y);
  ctx.quadraticCurveTo((a.x + s.px) / 2 + w.wind.dir * 14, (a.y + s.py) / 2 + sag, s.px, s.py); ctx.stroke();
}

// ---- HUD --------------------------------------------------------------------------------------
function bar(ctx, x, y, bw, bh, frac, o = {}) {
  const f = clamp(frac, 0, 1);
  roundPath(ctx, x, y, bw, bh, bh / 2); ctx.fillStyle = 'rgba(8,10,40,0.55)'; ctx.fill();
  if (f > 0.004) {
    ctx.save(); roundPath(ctx, x, y, bw, bh, bh / 2); ctx.clip();
    ctx.fillStyle = o.col ?? (f > 0.5 ? '#3fd0a0' : f > 0.25 ? '#ffc94d' : '#ff5a44');
    const fw = Math.max(bh, bw * f);
    if (o.right) ctx.fillRect(x + bw - fw, y, fw, bh); else ctx.fillRect(x, y, fw, bh);
    ctx.restore();
  }
  roundPath(ctx, x, y, bw, bh, bh / 2); ctx.strokeStyle = 'rgba(255,246,228,0.55)'; ctx.lineWidth = 1.5; ctx.stroke();
}

function tensionBar(ctx, x, y, bw, k, right) {
  const f = clamp(k.T / 1.4, 0, 1), bh = 9;
  roundPath(ctx, x, y, bw, bh, 4.5); ctx.fillStyle = 'rgba(8,10,40,0.5)'; ctx.fill();
  const col = k.T > K.STRAIN_AT ? '#ff5a44' : k.T > 0.75 ? '#ffb347' : k.T > 0.35 ? '#fff0c0' : '#9fd0ff';
  ctx.save(); roundPath(ctx, x, y, bw, bh, 4.5); ctx.clip(); ctx.fillStyle = col;
  if (right) ctx.fillRect(x + bw - bw * f, y, bw * f, bh); else ctx.fillRect(x, y, bw * f, bh);
  ctx.restore();
  // band ticks
  ctx.strokeStyle = 'rgba(255,246,228,0.5)'; ctx.lineWidth = 1.5;
  for (const v of [0.35, 0.75, K.STRAIN_AT]) { const px = right ? x + bw - bw * v / 1.4 : x + bw * v / 1.4; ctx.beginPath(); ctx.moveTo(px, y); ctx.lineTo(px, y + bh); ctx.stroke(); }
}

function drawHud(ctx, state) {
  const { w, match: m } = state;
  const bw = 272;
  ctx.textBaseline = 'alphabetic';
  [0, 1].forEach((side) => {
    const k = w.k[side], x = side === 0 ? 24 : W - 24 - bw;
    ctx.font = `700 26px ${FONT}`; ctx.textAlign = side === 0 ? 'left' : 'right';
    textShadow(ctx, nameOf(state, side), side === 0 ? x : x + bw, 72, '#fff6e4', 5);
    ctx.font = `700 24px ${FONT}`; ctx.textAlign = side === 0 ? 'right' : 'left';
    textShadow(ctx, `${Math.max(0, Math.ceil(k.integ))}`, side === 0 ? x + bw : x, 72, k.integ < 25 ? '#ffb0a0' : '#fff6e4', 5);
    bar(ctx, x, 80, bw, 22, k.integ / 100, { right: side === 1 });
    tensionBar(ctx, x, 109, bw, k, side === 1);
  });
  // timer and round pips
  const left = Math.max(0, K.ROUND_TIME - w.t), mm = Math.floor(left / 60), ss = Math.floor(left % 60);
  ctx.textAlign = 'center'; ctx.font = `700 34px ${FONT}`;
  textShadow(ctx, `${mm}:${String(ss).padStart(2, '0')}`, W / 2, 78, left < 10 ? '#ffb0a0' : '#fff6e4', 6);
  if (m.cfg.rounds === 3) {
    for (let i = 0; i < 2; i++) {
      for (const [side, dx] of [[0, -34 - i * 24], [1, 34 + i * 24]]) {
        ctx.beginPath(); ctx.arc(W / 2 + dx, 106, 8, 0, TAU);
        ctx.fillStyle = m.wins[side] > i ? '#ffc94d' : 'rgba(8,10,40,0.5)'; ctx.fill();
        ctx.strokeStyle = 'rgba(255,246,228,0.7)'; ctx.lineWidth = 1.5; ctx.stroke();
      }
    }
  } else { ctx.font = `600 20px ${FONT}`; textShadow(ctx, m.cfg.mode === 'watch' ? 'Watch & Learn' : 'Quick Duel', W / 2, 108, 'rgba(255,246,228,0.85)', 4); }
  drawWindPanel(ctx, state);
}

export function drawWindPanel(ctx, state) {
  const { w } = state, P = WIND_PANEL;
  roundPath(ctx, P.x, P.y, P.w, P.h, 18); ctx.fillStyle = 'rgba(10,14,50,0.42)'; ctx.fill();
  ctx.strokeStyle = 'rgba(255,246,228,0.3)'; ctx.lineWidth = 1.5; ctx.stroke();
  // wind now: arrow and strength
  const cx = P.x + 44, cy = P.y + P.h / 2, dir = w.wind.dir;
  ctx.strokeStyle = '#fff6e4'; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.fillStyle = '#fff6e4';
  const len = 12 + 18 * clamp(w.wnow, 0, 1.3);
  ctx.beginPath(); ctx.moveTo(cx - dir * len, cy); ctx.lineTo(cx + dir * len, cy); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx + dir * (len + 10), cy); ctx.lineTo(cx + dir * (len - 4), cy - 9); ctx.lineTo(cx + dir * (len - 4), cy + 9); ctx.closePath(); ctx.fill();
  ctx.font = `700 24px ${FONT}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fff6e4'; ctx.fillText(`Wind ${w.wnow.toFixed(2)}`, P.x + 92, cy);
  // forecast curve: now at the left, the next six seconds to the right
  const x0 = P.x + 250, x1 = P.x + P.w - 18, y0 = P.y + P.h - 10, y1 = P.y + 10;
  ctx.beginPath();
  const n = 24;
  for (let i = 0; i <= n; i++) {
    const v = windAt(w.wind, w.t + (i / n) * 6), x = x0 + (x1 - x0) * (i / n), y = y0 - (y0 - y1) * clamp(v / 1.35, 0, 1);
    if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
  }
  const g = ctx.createLinearGradient(0, y1, 0, y0);
  g.addColorStop(0, 'rgba(255,246,228,0.5)'); g.addColorStop(1, 'rgba(255,246,228,0.06)');
  ctx.strokeStyle = '#fff6e4'; ctx.lineWidth = 2.5; ctx.lineJoin = 'round'; ctx.stroke();
  ctx.lineTo(x1, y0); ctx.lineTo(x0, y0); ctx.closePath(); ctx.fillStyle = g; ctx.fill();
  ctx.fillStyle = '#ffc94d'; ctx.beginPath(); ctx.arc(x0, y0 - (y0 - y1) * clamp(w.wnow / 1.35, 0, 1), 6, 0, TAU); ctx.fill();
  ctx.font = `600 16px ${FONT}`; ctx.textAlign = 'left'; ctx.fillStyle = 'rgba(255,246,228,0.75)'; ctx.fillText('next 6 s', x0 + 10, y1 + 6);
}

// ---- controls ---------------------------------------------------------------------------------
const MODE_LABEL = { '-1': ['Slack', 'let out'], '0': ['Steady', 'hold'], '1': ['Pull', 'reel in'] };
export function drawControls(ctx, state) {
  const { w } = state, k = w.k[0];
  const locked = k.lock;
  const hintMode = state.hint && state.hint.t < state.hint.dur ? state.hint.mode : null;
  MODE_BTN.forEach((r) => {
    const sel = k.mode === r.id && !(r.id === 1 && locked);
    const dis = r.id === 1 && locked;
    const { dy } = paintButton(ctx, r, { active: sel, disabled: dis });
    const [a, b] = MODE_LABEL[r.id];
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = dis ? 'rgba(235,238,255,0.6)' : sel ? '#fffaf0' : C.ink;
    ctx.font = `700 29px ${FONT}`; ctx.fillText(a, r.x + r.w / 2, r.y + dy + 38);
    ctx.font = `500 20px ${FONT}`; ctx.globalAlpha = 0.85; ctx.fillText(b, r.x + r.w / 2, r.y + dy + 62); ctx.globalAlpha = 1;
    if (r.id === 1) { // grip meter along the bottom edge of the Pull button
      roundPath(ctx, r.x + 14, r.y + r.h - 14, r.w - 28, 7, 3.5); ctx.fillStyle = 'rgba(8,10,40,0.35)'; ctx.fill();
      ctx.fillStyle = k.grip > 0.25 ? '#ffc94d' : '#ff5a44';
      roundPath(ctx, r.x + 14, r.y + r.h - 14, Math.max(4, (r.w - 28) * k.grip), 7, 3.5); ctx.fill();
    }
    if (hintMode === r.id) {
      ctx.strokeStyle = '#ffc94d'; ctx.lineWidth = 5; roundPath(ctx, r.x - 3, r.y - 3, r.w + 6, r.h + 6, 20); ctx.stroke();
    }
  });
  drawButton(ctx, THINK_BTN, 'Think', { dark: true, size: 26, disabled: state.hintBusy });
  drawButton(ctx, PAUSE_BTN, 'Pause', { dark: true, size: 26 });
}

export function drawWatchBar(ctx, state) {
  const st = state.settings;
  drawButton(ctx, WATCH_BAR.dec, 'Faster', { dark: true, size: 24, sub: `Think ${THINK_STEPS[st.thinkIdx]} s`, disabled: st.thinkIdx === 0 });
  drawButton(ctx, WATCH_BAR.pause, state.paused ? 'Resume' : 'Pause', { primary: true, size: 30 });
  drawButton(ctx, WATCH_BAR.inc, 'Slower', { dark: true, size: 24, sub: `Think ${THINK_STEPS[st.thinkIdx]} s`, disabled: st.thinkIdx === THINK_STEPS.length - 1 });
  drawButton(ctx, WATCH_BAR.exit, 'Leave', { dark: true, size: 26 });
}

// ---- overlays ---------------------------------------------------------------------------------
function ring(ctx, x, y, r, col, dash, t) {
  ctx.save();
  ctx.strokeStyle = col; ctx.lineWidth = 4;
  if (dash) { ctx.setLineDash([10, 8]); ctx.lineDashOffset = -t * 30; }
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = col; ctx.globalAlpha = 0.25; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  ctx.restore();
}
function ghostPath(ctx, k, tx, ty, col, t) {
  ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.setLineDash([4, 10]); ctx.lineCap = 'round'; ctx.lineDashOffset = -t * 40;
  ctx.beginPath(); ctx.moveTo(k.x, k.y); ctx.lineTo(tx, ty); ctx.stroke(); ctx.restore();
  ring(ctx, tx, ty, 22 + 3 * Math.sin(t * 6), col, true, t);
}

export function caption(ctx, lines, y, o = {}) {
  const w = o.w ?? 640, px = (W - w) / 2;
  ctx.font = `600 ${o.size ?? 26}px ${FONT}`;
  const wrapped = [];
  lines.forEach((l) => wrapLines(ctx, l.text, w - 44).forEach((t, i) => wrapped.push({ text: t, col: l.col, bold: l.bold, i })));
  const lh = (o.size ?? 26) * 1.32, h = wrapped.length * lh + 24;
  roundPath(ctx, px, y, w, h, 20); ctx.fillStyle = o.fill ?? 'rgba(10,14,50,0.74)'; ctx.fill();
  ctx.strokeStyle = 'rgba(255,246,228,0.35)'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  wrapped.forEach((l, i) => { ctx.font = `${l.bold ? 700 : 500} ${o.size ?? 26}px ${FONT}`; ctx.fillStyle = l.col ?? '#fff6e4'; ctx.fillText(l.text, W / 2, y + 12 + (i + 0.85) * lh); });
  return h;
}

export function renderPlay(ctx, state) {
  const { w, match: m } = state;
  const sky = m.cfg.sky, pals = palsOf(m);
  ctx.save();
  if (state.shake) { const k = 1 - state.shake.t / state.shake.dur; ctx.translate(Math.sin(state.t * 90) * state.shake.amp * k, Math.cos(state.t * 77) * state.shake.amp * k); }
  drawScene(ctx, state, w, sky, pals);
  const watch = m.cfg.mode === 'watch';
  // the player's heading point
  if (!watch && state.ph !== 'between' && !w.over) {
    const k = w.k[0], tx = clamp(k.tx, 50, 670), ty = clamp(k.ty, 280, 1040);
    ctx.save(); ctx.strokeStyle = 'rgba(255,246,228,0.45)'; ctx.lineWidth = 2; ctx.setLineDash([3, 9]); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(k.x, k.y); ctx.lineTo(tx, ty); ctx.stroke(); ctx.restore();
    ctx.strokeStyle = 'rgba(255,246,228,0.85)'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(tx, ty, 13 + 2 * Math.sin(state.t * 5), 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(tx - 7, ty); ctx.lineTo(tx + 7, ty); ctx.moveTo(tx, ty - 7); ctx.lineTo(tx, ty + 7); ctx.stroke();
  }
  // hint ghost
  if (state.hint && state.hint.t < state.hint.dur) ghostPath(ctx, w.k[0], state.hint.tx, state.hint.ty, '#ffc94d', state.t);
  ctx.restore();
  drawHud(ctx, state);
  if (watch) drawWatchBar(ctx, state); else drawControls(ctx, state);
  if (watch) drawWatchOverlay(ctx, state);
  if (state.hint && state.hint.t < state.hint.dur) caption(ctx, [{ text: `Think: ${state.hint.reason}`, bold: true, col: '#ffe9a0' }], 212, { size: 24 });
  else if (state.hintBusy) caption(ctx, [{ text: 'Thinking...', bold: true, col: '#ffe9a0' }], 212, { size: 24, w: 300 });
  else if (state.toastT > 0 && state.toast) caption(ctx, [{ text: state.toast, bold: true }], 212, { size: 24 });
  // countdown
  if (state.ph === 'ready' && !watch) {
    const left = K.ARM - w.t;
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    const word = left > 1.2 ? 'Ready' : left > 0.3 ? 'Steady' : 'Fly!';
    ctx.font = `italic 700 96px ${DISPLAY}`; textShadow(ctx, word, W / 2, 470, '#fff6e4', 18);
    ctx.font = `600 26px ${FONT}`; textShadow(ctx, `Round ${state.match.round}`, W / 2, 516, 'rgba(255,246,228,0.9)', 6);
  }
  if (state.paused && watch) {
    ctx.fillStyle = 'rgba(10,14,50,0.35)'; ctx.fillRect(0, 210, W, 900);
    ctx.textAlign = 'center'; ctx.font = `italic 700 80px ${DISPLAY}`; textShadow(ctx, 'Paused', W / 2, 640, '#fff6e4', 14);
  }
  if (state.flash > 0) { ctx.fillStyle = `rgba(255,255,240,${Math.min(0.55, state.flash)})`; ctx.fillRect(0, 0, W, H); }
}

// Watch & Learn overlay: the Think -> Reveal -> Act clock and what the rivals are weighing
function drawWatchOverlay(ctx, state) {
  const wt = state.wl, w = state.w;
  if (!wt) return;
  const m = state.match;
  const col = ['#7fe8d6', '#ff9a86'];
  if (wt.phase === 'think') {
    // the options the rivals are weighing appear one after another
    const cands = wt.show ?? [];
    const k = Math.min(cands.length, Math.floor(cands.length * Math.min(1, wt.t / Math.max(0.5, wt.dur * 0.85))));
    for (let i = 0; i < k; i++) {
      const c = cands[i];
      ctx.fillStyle = `rgba(255,246,228,${0.22 + 0.3 * (1 - i / Math.max(1, cands.length))})`;
      ctx.beginPath(); ctx.arc(c.tx, c.ty, 9, 0, TAU); ctx.fill();
    }
  } else if (wt.phase === 'reveal' && wt.plans) {
    for (const side of [0, 1]) {
      const p = wt.plans[side]; if (!p) continue;
      for (const alt of p.alts.slice(1, 4)) { ctx.fillStyle = 'rgba(255,246,228,0.25)'; ctx.beginPath(); ctx.arc(alt.tx, alt.ty, 10, 0, TAU); ctx.fill(); }
      ghostPath(ctx, w.k[side], p.params.tx, p.params.ty, col[side], state.t);
    }
  }
  const label = wt.phase === 'think' ? 'THINK' : wt.phase === 'reveal' ? 'REVEAL' : 'ACT';
  const secs = Math.max(0, wt.dur - wt.t);
  const pw = 600, px = (W - pw) / 2, py = 212;
  const lines = [];
  if (wt.phase === 'reveal' && wt.plans) {
    [0, 1].forEach((side) => { const p = wt.plans[side]; if (p) lines.push({ text: `${nameOf(state, side)}: ${p.reason}`, col: col[side] === '#7fe8d6' ? '#aaf3e6' : '#ffc0b2', bold: true }); });
  } else if (wt.phase === 'think') lines.push({ text: 'Both flyers read the wind and weigh their options.', col: '#fff6e4' });
  else lines.push({ text: `The kites fly the plan. ${nameOf(state, 0)} ${MODE_WORD[w.k[0].mode]}, ${nameOf(state, 1)} ${MODE_WORD[w.k[1].mode]}.`, col: '#fff6e4' });
  roundPath(ctx, px, py, pw, 62, 20); ctx.fillStyle = 'rgba(10,14,50,0.78)'; ctx.fill();
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.font = `700 28px ${FONT}`; ctx.fillStyle = wt.phase === 'think' ? '#ffe9a0' : wt.phase === 'reveal' ? '#7fe8d6' : '#ff9a86'; ctx.fillText(label, px + 24, py + 41);
  // progress bar
  const prog = clamp(wt.t / wt.dur, 0, 1);
  roundPath(ctx, px + 170, py + 24, pw - 280, 14, 7); ctx.fillStyle = 'rgba(255,246,228,0.2)'; ctx.fill();
  ctx.save(); roundPath(ctx, px + 170, py + 24, pw - 280, 14, 7); ctx.clip(); ctx.fillStyle = '#ffc94d'; ctx.fillRect(px + 170, py + 24, (pw - 280) * prog, 14); ctx.restore();
  ctx.textAlign = 'right'; ctx.font = `700 26px ${FONT}`; ctx.fillStyle = '#fff6e4'; ctx.fillText(`${secs.toFixed(1)} s`, px + pw - 22, py + 41);
  caption(ctx, lines, py + 74, { size: 23, w: pw });
  void m;
}

export function drawBanner(ctx, state) {
  const b = state.banner;
  if (!b) return;
  ctx.fillStyle = 'rgba(10,14,50,0.45)'; ctx.fillRect(0, 0, W, H);
  panel(ctx, 70, 320, 580, b.auto ? 400 : 520, { r: 30, fill: 'rgba(255,246,228,0.96)' });
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = b.win ? C.tealDark : C.vermDark; ctx.font = `italic 700 54px ${DISPLAY}`;
  wrapLines(ctx, b.title, 520).forEach((l, i) => ctx.fillText(l, W / 2, 412 + i * 60));
  ctx.fillStyle = C.ink; ctx.font = `500 28px ${FONT}`;
  wrapLines(ctx, b.line, 500).forEach((l, i) => ctx.fillText(l, W / 2, 500 + i * 38));
  ctx.font = `700 28px ${FONT}`; ctx.fillStyle = C.vermDark;
  ctx.fillText(b.score, W / 2, 620);
  if (!b.auto) drawButton(ctx, BANNER_BTN, b.last ? 'See result' : 'Next round', { primary: true, size: 32 });
  else { ctx.font = `500 24px ${FONT}`; ctx.fillStyle = 'rgba(28,37,82,0.7)'; ctx.fillText('Continuing...', W / 2, 680); }
}

export { pressureOf };
