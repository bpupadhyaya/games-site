// Drawing the play screen: the scene, the HUD, the bottom controls and the overlays (countdown, hint,
// Think/Reveal/Act, round banner). Pure drawing; game.js owns state.
import { W, H, K, ANCHOR, stringPoints, windAt, clamp, pressureOf } from './sim.js';
import { drawSky, drawClouds, drawWindStreaks, drawLand, drawFlyer, drawKite, drawString, drawContact, drawParticles, KITE_PAL } from './art.js';
import { THINK_STEPS, TEXT_SCALES, playLayout } from './layout.js';
import { FONT, DISPLAY, C, roundPath, paintButton, drawButton, panel, textShadow, wrapLines, fitPx } from './ui.js';
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

function tensionBar(ctx, x, y, bw, bh, k, right) {
  const f = clamp(k.T / 1.4, 0, 1);
  roundPath(ctx, x, y, bw, bh, bh / 2); ctx.fillStyle = 'rgba(8,10,40,0.5)'; ctx.fill();
  const col = k.T > K.STRAIN_AT ? '#ff5a44' : k.T > 0.75 ? '#ffb347' : k.T > 0.35 ? '#fff0c0' : '#9fd0ff';
  ctx.save(); roundPath(ctx, x, y, bw, bh, bh / 2); ctx.clip(); ctx.fillStyle = col;
  if (right) ctx.fillRect(x + bw - bw * f, y, bw * f, bh); else ctx.fillRect(x, y, bw * f, bh);
  ctx.restore();
  // band ticks
  ctx.strokeStyle = 'rgba(255,246,228,0.5)'; ctx.lineWidth = 1.5;
  for (const v of [0.35, 0.75, K.STRAIN_AT]) { const px = right ? x + bw - bw * v / 1.4 : x + bw * v / 1.4; ctx.beginPath(); ctx.moveTo(px, y); ctx.lineTo(px, y + bh); ctx.stroke(); }
}

// The HUD scales with the text-size setting: names, strength numbers, timer, bars, pips and the wind panel all grow,
// each fitted to its own slot so nothing overlaps (see playLayout in layout.js).
function drawHud(ctx, state, L) {
  const { w, match: m } = state, h = L.hud;
  ctx.textBaseline = 'alphabetic';
  [0, 1].forEach((side) => {
    const k = w.k[side], x = side === 0 ? h.lx : h.rx;
    const num = `${Math.max(0, Math.ceil(k.integ))}`;
    let name = nameOf(state, side);
    const fitRow = (nm) => {
      ctx.font = `700 100px ${FONT}`; const wn = ctx.measureText(nm).width / 100;
      ctx.font = `700 92px ${FONT}`; const wm = ctx.measureText(num).width / 100;
      return Math.max(12, Math.min(h.nameFs, Math.floor((h.bw - 14) / (wn + wm * 0.92))));
    };
    let fs = fitRow(name);
    if (fs < h.nameFs * 0.62 && name.includes(' ')) { name = name.split(' ')[0]; fs = fitRow(name); }
    ctx.font = `700 ${fs}px ${FONT}`; ctx.textAlign = side === 0 ? 'left' : 'right';
    textShadow(ctx, name, side === 0 ? x : x + h.bw, h.base, '#fff6e4', 5);
    ctx.font = `700 ${Math.round(fs * 0.92)}px ${FONT}`; ctx.textAlign = side === 0 ? 'right' : 'left';
    textShadow(ctx, num, side === 0 ? x + h.bw : x, h.base, k.integ < 25 ? '#ffb0a0' : '#fff6e4', 5);
    bar(ctx, x, h.barY, h.bw, h.barH, k.integ / 100, { right: side === 1 });
    tensionBar(ctx, x, h.tenY, h.bw, h.tenH, k, side === 1);
  });
  // timer and round pips
  const left = Math.max(0, K.ROUND_TIME - w.t), mm = Math.floor(left / 60), ss = Math.floor(left % 60);
  const ttxt = `${mm}:${String(ss).padStart(2, '0')}`;
  const tfs = fitPx(ctx, ttxt, 700, h.timerFs, h.centerW - 8);
  ctx.textAlign = 'center'; ctx.font = `700 ${tfs}px ${FONT}`;
  textShadow(ctx, ttxt, W / 2, h.base + 6 * h.m, left < 10 ? '#ffb0a0' : '#fff6e4', 6);
  const cy = h.barY + h.barH + 4 + 8 * h.pm * 0.9;
  if (m.cfg.rounds === 3) {
    const pp = Math.min(h.m, (h.centerW / 2 - 6) / 66);
    for (let i = 0; i < 2; i++) {
      for (const [side, dx] of [[0, -(34 + i * 24) * pp], [1, (34 + i * 24) * pp]]) {
        ctx.beginPath(); ctx.arc(W / 2 + dx, cy, 8 * pp, 0, TAU);
        ctx.fillStyle = m.wins[side] > i ? '#ffc94d' : 'rgba(8,10,40,0.5)'; ctx.fill();
        ctx.strokeStyle = 'rgba(255,246,228,0.7)'; ctx.lineWidth = 1.5; ctx.stroke();
      }
    }
  } else {
    const lab = m.cfg.mode === 'watch' ? 'Watch & Learn' : 'Quick Duel';
    const lfs = fitPx(ctx, lab, 600, 20 * h.m, h.centerW - 4);
    ctx.font = `600 ${lfs}px ${FONT}`; textShadow(ctx, lab, W / 2, cy + lfs * 0.35, 'rgba(255,246,228,0.85)', 4);
  }
  drawWindPanel(ctx, state, L);
}

export function drawWindPanel(ctx, state, L = playLayout(state.settings.textIdx)) {
  const { w } = state, P = L.panel, m = L.m, two = L.hud.twoRow;
  roundPath(ctx, P.x, P.y, P.w, P.h, 18); ctx.fillStyle = 'rgba(10,14,50,0.42)'; ctx.fill();
  ctx.strokeStyle = 'rgba(255,246,228,0.3)'; ctx.lineWidth = 1.5; ctx.stroke();
  // wind now: arrow and strength
  const row1H = two ? Math.round(P.h * 0.45) : P.h;
  const cx = P.x + 44, cy = P.y + row1H / 2, dir = w.wind.dir;
  const am = Math.min(m, 1.4);
  ctx.strokeStyle = '#fff6e4'; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.fillStyle = '#fff6e4';
  const len = (12 + 18 * clamp(w.wnow, 0, 1.3)) * am * 0.8;
  ctx.beginPath(); ctx.moveTo(cx - dir * len, cy); ctx.lineTo(cx + dir * len, cy); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx + dir * (len + 10 * am), cy); ctx.lineTo(cx + dir * (len - 4), cy - 9 * am); ctx.lineTo(cx + dir * (len - 4), cy + 9 * am); ctx.closePath(); ctx.fill();
  const wtxt = `Wind ${w.wnow.toFixed(2)}`, tx0 = P.x + 44 + 30 * am + 24;
  const wfs = fitPx(ctx, wtxt, 700, 24 * m, two ? P.w - (tx0 - P.x) - 20 : 200 * m);
  ctx.font = `700 ${wfs}px ${FONT}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fff6e4'; ctx.fillText(wtxt, tx0, cy);
  const wW = ctx.measureText(wtxt).width;
  // forecast curve: now at the left, the next six seconds to the right
  const lfs = Math.round(16 * m * (two ? 0.95 : 0.9)), lab = 'next 6 s';
  ctx.font = `600 ${lfs}px ${FONT}`; const lW = ctx.measureText(lab).width;
  let x0, x1, y0, y1;
  if (two) { y0 = P.y + P.h - 12; y1 = P.y + row1H + 6; x0 = P.x + 22 + lW + 16; x1 = P.x + P.w - 18; }
  else { x0 = Math.max(P.x + 250, tx0 + wW + 30); x1 = P.x + P.w - 18; y0 = P.y + P.h - 10; y1 = P.y + 10; }
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
  ctx.font = `600 ${lfs}px ${FONT}`; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = 'rgba(255,246,228,0.8)';
  if (two) ctx.fillText(lab, P.x + 22, (y0 + y1) / 2 + lfs * 0.35);
  else ctx.fillText(lab, x0 + 10, y1 + 6 * Math.max(1, m * 0.7));
}

// ---- controls ---------------------------------------------------------------------------------
const MODE_LABEL = { '-1': ['Slack', 'let out'], '0': ['Steady', 'hold'], '1': ['Pull', 'reel in'] };
export function drawControls(ctx, state, L = playLayout(state.settings.textIdx)) {
  const { w } = state, k = w.k[0];
  const locked = k.lock, m = L.m;
  const hintMode = state.hint && state.hint.t < state.hint.dur ? state.hint.mode : null;
  L.modes.forEach((r) => {
    const sel = k.mode === r.id && !(r.id === 1 && locked);
    const dis = r.id === 1 && locked;
    const { dy } = paintButton(ctx, r, { active: sel, disabled: dis });
    const [a, b] = MODE_LABEL[r.id];
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = dis ? 'rgba(235,238,255,0.6)' : sel ? '#fffaf0' : C.ink;
    const fa = fitPx(ctx, a, 700, 29 * m, r.w - 20), fb = Math.min(fitPx(ctx, b, 500, 20 * m, r.w - 20), Math.round(fa * 0.8));
    const grip = r.id === 1 ? 14 : 0, total = fa * 1.1 + fb * 1.15;
    const top = (r.h - 10 - total) / 2 + 4 * Math.min(m, 1.3);
    const y1 = r.y + dy + top + fa * 0.85, y2 = y1 + fb * 1.2;
    ctx.font = `700 ${fa}px ${FONT}`; ctx.fillText(a, r.x + r.w / 2, y1);
    ctx.font = `500 ${fb}px ${FONT}`; ctx.globalAlpha = 0.85; ctx.fillText(b, r.x + r.w / 2, y2); ctx.globalAlpha = 1;
    if (r.id === 1) { // grip meter along the bottom edge of the Pull button
      const gh = Math.round(7 * Math.min(m, 1.6));
      roundPath(ctx, r.x + 14, r.y + r.h - 7 - gh - 2, r.w - 28, gh, gh / 2); ctx.fillStyle = 'rgba(8,10,40,0.35)'; ctx.fill();
      ctx.fillStyle = k.grip > 0.25 ? '#ffc94d' : '#ff5a44';
      roundPath(ctx, r.x + 14, r.y + r.h - 7 - gh - 2, Math.max(gh, (r.w - 28) * k.grip), gh, gh / 2); ctx.fill();
    }
    void grip;
    if (hintMode === r.id) {
      ctx.strokeStyle = '#ffc94d'; ctx.lineWidth = 5; roundPath(ctx, r.x - 3, r.y - 3, r.w + 6, r.h + 6, 20); ctx.stroke();
    }
  });
  drawButton(ctx, L.think, 'Think', { dark: true, size: 26 * m, disabled: state.hintBusy });
  drawButton(ctx, L.pause, 'Pause', { dark: true, size: 26 * m });
}

export function drawWatchBar(ctx, state, L = playLayout(state.settings.textIdx)) {
  const st = state.settings, m = L.m, W_ = L.watch, sub = `Think ${THINK_STEPS[st.thinkIdx]} s`;
  drawButton(ctx, W_.dec, 'Faster', { dark: true, size: 24 * m, sub, disabled: st.thinkIdx === 0 });
  drawButton(ctx, W_.pause, state.paused ? 'Resume' : 'Pause', { primary: true, size: 30 * m });
  drawButton(ctx, W_.inc, 'Slower', { dark: true, size: 24 * m, sub, disabled: st.thinkIdx === THINK_STEPS.length - 1 });
  drawButton(ctx, W_.exit, 'Leave', { dark: true, size: 26 * m });
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
  const L = playLayout(state.settings.textIdx), cm = Math.min(L.m, 1.6), capY = L.hudBottom + 14;
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
  drawHud(ctx, state, L);
  if (watch) drawWatchBar(ctx, state, L); else drawControls(ctx, state, L);
  if (watch) drawWatchOverlay(ctx, state, L);
  if (state.hint && state.hint.t < state.hint.dur) caption(ctx, [{ text: `Think: ${state.hint.reason}`, bold: true, col: '#ffe9a0' }], capY, { size: 24 * cm });
  else if (state.hintBusy) caption(ctx, [{ text: 'Thinking...', bold: true, col: '#ffe9a0' }], capY, { size: 24 * cm, w: 300 * cm });
  else if (state.toastT > 0 && state.toast) caption(ctx, [{ text: state.toast, bold: true }], capY, { size: 24 * cm });
  // countdown
  if (state.ph === 'ready' && !watch) {
    const left = K.ARM - w.t, cs = Math.min(L.m, 1.3);
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    const word = left > 1.2 ? 'Ready' : left > 0.3 ? 'Steady' : 'Fly!';
    ctx.font = `italic 700 ${Math.round(96 * cs)}px ${DISPLAY}`; textShadow(ctx, word, W / 2, 470, '#fff6e4', 18);
    ctx.font = `600 ${Math.round(26 * L.m)}px ${FONT}`; textShadow(ctx, `Round ${state.match.round}`, W / 2, 470 + 20 + 26 * L.m, 'rgba(255,246,228,0.9)', 6);
  }
  if (state.paused && watch) {
    ctx.fillStyle = 'rgba(10,14,50,0.35)'; ctx.fillRect(0, L.sky.y, W, L.sky.h);
    ctx.textAlign = 'center'; ctx.font = `italic 700 ${Math.round(80 * Math.min(L.m, 1.3))}px ${DISPLAY}`; textShadow(ctx, 'Paused', W / 2, 640, '#fff6e4', 14);
  }
  if (state.flash > 0) { ctx.fillStyle = `rgba(255,255,240,${Math.min(0.55, state.flash)})`; ctx.fillRect(0, 0, W, H); }
}

// Watch & Learn overlay: the Think -> Reveal -> Act clock and what the rivals are weighing
function drawWatchOverlay(ctx, state, L) {
  const wt = state.wl, w = state.w;
  if (!wt) return;
  const col = ['#7fe8d6', '#ff9a86'], cm = Math.min(L.m, 1.6);
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
  const pw = 600, px = (W - pw) / 2, py = L.hudBottom + 16, ph = Math.round(62 * cm);
  const lines = [];
  if (wt.phase === 'reveal' && wt.plans) {
    [0, 1].forEach((side) => { const p = wt.plans[side]; if (p) lines.push({ text: `${nameOf(state, side)}: ${p.reason}`, col: col[side] === '#7fe8d6' ? '#aaf3e6' : '#ffc0b2', bold: true }); });
  } else if (wt.phase === 'think') lines.push({ text: 'Both flyers read the wind and weigh their options.', col: '#fff6e4' });
  else lines.push({ text: `The kites fly the plan. ${nameOf(state, 0)} ${MODE_WORD[w.k[0].mode]}, ${nameOf(state, 1)} ${MODE_WORD[w.k[1].mode]}.`, col: '#fff6e4' });
  roundPath(ctx, px, py, pw, ph, 20); ctx.fillStyle = 'rgba(10,14,50,0.78)'; ctx.fill();
  const lf = Math.round(28 * cm), sf = Math.round(26 * cm), by = py + ph / 2 + lf * 0.36;
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.font = `700 ${lf}px ${FONT}`; ctx.fillStyle = wt.phase === 'think' ? '#ffe9a0' : wt.phase === 'reveal' ? '#7fe8d6' : '#ff9a86'; ctx.fillText(label, px + 24, by);
  const lw = ctx.measureText('REVEAL').width;
  ctx.font = `700 ${sf}px ${FONT}`; const sw = ctx.measureText('10.0 s').width;
  // progress bar
  const bx = px + 24 + lw + 18, bw = Math.max(40, pw - 24 - lw - 18 - sw - 40), bh = Math.round(14 * Math.min(cm, 1.3)), byy = py + ph / 2 - bh / 2;
  const prog = clamp(wt.t / wt.dur, 0, 1);
  roundPath(ctx, bx, byy, bw, bh, bh / 2); ctx.fillStyle = 'rgba(255,246,228,0.2)'; ctx.fill();
  ctx.save(); roundPath(ctx, bx, byy, bw, bh, bh / 2); ctx.clip(); ctx.fillStyle = '#ffc94d'; ctx.fillRect(bx, byy, bw * prog, bh); ctx.restore();
  ctx.textAlign = 'right'; ctx.font = `700 ${sf}px ${FONT}`; ctx.fillStyle = '#fff6e4'; ctx.fillText(`${secs.toFixed(1)} s`, px + pw - 22, by);
  caption(ctx, lines, py + ph + 12, { size: 23 * cm, w: pw });
}

// The round banner follows the text-size setting up to 300%; if the panel would no longer fit the screen the text
// steps down a notch until it does.
export function bannerGeom(ctx, b, s) {
  const pw = s > 1 ? 650 : 580;
  for (let sc = s; ; sc = Math.max(1, sc - 0.25)) {
    const tFs = Math.round(54 * Math.min(sc, 1.7)), lFs = Math.round(28 * sc), sFs = Math.round(28 * Math.min(sc, 2));
    ctx.font = `italic 700 ${tFs}px ${DISPLAY}`; const tl = wrapLines(ctx, b.title, pw - 60);
    ctx.font = `500 ${lFs}px ${FONT}`; const ll = wrapLines(ctx, b.line, pw - 60);
    ctx.font = `700 ${sFs}px ${FONT}`; const sl = wrapLines(ctx, b.score, pw - 60);
    const bFs = Math.round(32 * Math.min(sc, 2.2)), bH = Math.max(92, Math.round(bFs * 1.15 + 44));
    const tH = tl.length * tFs * 1.14, lH = ll.length * lFs * 1.3, sH = sl.length * sFs * 1.2;
    const total = 34 + tH + 16 + lH + 14 + sH + 22 + (b.auto ? Math.round(24 * Math.min(sc, 2) * 1.5) : bH) + 30;
    if (total <= 1190 || sc <= 1) return { pw, sc, tFs, lFs, sFs, bFs, bH, tl, ll, sl, tH, lH, sH, total };
  }
}

export function drawBanner(ctx, state) {
  const b = state.banner;
  if (!b) return;
  const g = bannerGeom(ctx, b, TEXT_SCALES[state.settings.textIdx]);
  ctx.fillStyle = 'rgba(10,14,50,0.45)'; ctx.fillRect(0, 0, W, H);
  const px = (W - g.pw) / 2, py = Math.max(30, Math.min(320, (H - g.total) / 2));
  panel(ctx, px, py, g.pw, g.total, { r: 30, fill: 'rgba(255,246,228,0.96)' });
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  let y = py + 34;
  ctx.fillStyle = b.win ? C.tealDark : C.vermDark; ctx.font = `italic 700 ${g.tFs}px ${DISPLAY}`;
  g.tl.forEach((l, i) => ctx.fillText(l, W / 2, y + g.tFs * (0.86 + i * 1.14))); y += g.tH + 16;
  ctx.fillStyle = C.ink; ctx.font = `500 ${g.lFs}px ${FONT}`;
  g.ll.forEach((l, i) => ctx.fillText(l, W / 2, y + g.lFs * (0.95 + i * 1.3))); y += g.lH + 14;
  ctx.font = `700 ${g.sFs}px ${FONT}`; ctx.fillStyle = C.vermDark;
  g.sl.forEach((l, i) => ctx.fillText(l, W / 2, y + g.sFs * (0.9 + i * 1.2))); y += g.sH + 22;
  if (!b.auto) drawButton(ctx, { x: px + 40, y, w: g.pw - 80, h: g.bH }, b.last ? 'See result' : 'Next round', { primary: true, size: g.bFs });
  else { const f = Math.round(24 * Math.min(g.sc, 2)); ctx.font = `500 ${f}px ${FONT}`; ctx.fillStyle = 'rgba(28,37,82,0.7)'; ctx.fillText('Continuing...', W / 2, y + f); }
}

export { pressureOf };
