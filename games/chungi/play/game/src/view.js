// The play screen: alley, kid, band ball, hoops, effects and HUD. Pure drawing; game.js owns state.
import { W, H, playLayout, TEXT_SCALES, THINK_STEPS } from './layout.js';
import { FONT, DISPLAY, roundPath, paintButton, drawButton, wrapLines } from './ui.js';
import { makeCam, drawBackdrop, drawChungi, drawBallShadow, drawLanding, drawHoop, drawKid, drawFx } from './art.js';
import { windForecast, canKick, REACH_X, kindAt, KINDS, TRICKS } from './sim.js';

const TAU = Math.PI * 2;
export const layoutOf = (state) => playLayout(Math.min(TEXT_SCALES[state.settings.textIdx], 1.6), !!state.run && state.run.mode === 'watch');
export const camFor = (state, run) => makeCam(layoutOf(state).stage, run.cam);

// ---- the scene ---------------------------------------------------------------------------------------------------------
export function drawScene(ctx, state, run, cam, opts = {}) {
  const t = state.t, band = state.record.bandSel;
  drawBackdrop(ctx, W, H, cam, run.half, t, run.wx);
  const b = run.ball;
  // where the ball will come down
  if (opts.landing != null && b.vy < 0.5 && b.y > 0.2) drawLanding(ctx, cam, opts.landing, t);
  if (run.hoop) drawHoop(ctx, cam, run.hoop, t, 'back', state.hoopGlow || 0);
  drawBallShadow(ctx, cam, b);
  drawKid(ctx, cam, run.kid, b, t);
  // a thin motion trail
  for (let i = 0; i < run.trail.length; i++) {
    const q = run.trail[i], a = (i + 1) / (run.trail.length + 1);
    ctx.fillStyle = `rgba(255,255,255,${0.05 + 0.18 * a})`;
    ctx.beginPath(); ctx.arc(cam.X(q.x), cam.Y(q.y), Math.max(1.5, cam.s * 0.1 * a), 0, TAU); ctx.fill();
  }
  // the reach zone around the kid's feet while the ball is low
  if (opts.reach && b.y < 2.2 && b.vy < 1) {
    const k = canKick(run) ? 1 : 0.55;
    ctx.save(); ctx.strokeStyle = `rgba(255,255,255,${0.25 * k})`; ctx.setLineDash([6, 6]); ctx.lineWidth = 2;
    ctx.strokeRect(cam.X(run.kid.x - REACH_X), cam.Y(1.3), 2 * REACH_X * cam.s, (1.3 + 0.3) * cam.s); ctx.restore();
  }
  drawChungi(ctx, cam, b, run.tuft, band, t);
  if (run.hoop) drawHoop(ctx, cam, run.hoop, t, 'front', state.hoopGlow || 0);
  drawFx(ctx, cam, run === state.run ? state.fx : state.attFx || []);
  if (run === state.run) {
    for (const q of state.pops) {
      const k = q.t / q.max, y = cam.Y(q.y) - k * cam.s * 0.6, x = cam.X(q.x);
      ctx.save(); ctx.globalAlpha = Math.min(1, (1 - k) * 2.2); ctx.font = `800 ${Math.round(q.size * (0.9 + 0.2 * Math.min(1, k * 6)))}px ${DISPLAY}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(20,8,40,0.85)'; ctx.lineJoin = 'round'; ctx.strokeText(q.text, x, y); ctx.fillStyle = q.col; ctx.fillText(q.text, x, y);
      ctx.restore();
    }
  }
}

// The Think hint: the arc the advised kick follows and where to tap.
function drawAdvice(ctx, cam, adv, t) {
  if (!adv) return;
  ctx.save();
  ctx.setLineDash([9, 8]); ctx.lineWidth = Math.max(3, cam.s * 0.045); ctx.strokeStyle = 'rgba(255,240,150,0.9)'; ctx.lineCap = 'round';
  ctx.beginPath(); (adv.path || []).forEach((p, i) => { const x = cam.X(p.x), y = cam.Y(p.y); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }); ctx.stroke();
  ctx.setLineDash([]);
  const px = cam.X(adv.fx + adv.aim * 1.6), py = cam.Y(Math.max(0.9, adv.y + 0.9)), p = 0.5 + 0.5 * Math.sin(t * 9), r = cam.s * (0.34 + 0.05 * p);
  ctx.fillStyle = 'rgba(255,230,120,0.28)'; ctx.strokeStyle = '#ffe07a'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.arc(px, py, r, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#ffe07a'; ctx.font = `800 ${Math.round(cam.s * 0.3)}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('TAP', px, py + 1);
  ctx.restore();
}

// ---- HUD ---------------------------------------------------------------------------------------------------------------
function chipBg(ctx, r, rad = 22) { roundPath(ctx, r.x, r.y, r.w, r.h, rad); ctx.fillStyle = 'rgba(28,14,56,0.82)'; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(255,255,255,0.14)'; ctx.stroke(); }
function drawWind(ctx, L, run) {
  const r = L.wind, fs = L.fs.wind;
  chipBg(ctx, r, r.h / 2);
  const wx = run.wx, cy = r.y + r.h / 2, mag = Math.min(1, Math.abs(wx) / 1.6);
  const ax = r.x + r.h * 0.9, len = r.h * (0.3 + 0.6 * mag) * (wx >= 0 ? 1 : -1);
  ctx.strokeStyle = mag > 0.65 ? '#ffb18a' : '#c8f4ee'; ctx.fillStyle = ctx.strokeStyle; ctx.lineWidth = Math.max(3, r.h * 0.1); ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(ax - len, cy); ctx.lineTo(ax + len, cy); ctx.stroke();
  const d = wx >= 0 ? 1 : -1;
  ctx.beginPath(); ctx.moveTo(ax + len + d * r.h * 0.2, cy); ctx.lineTo(ax + len, cy - r.h * 0.17); ctx.lineTo(ax + len, cy + r.h * 0.17); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#fff1e2'; ctx.font = `700 ${fs}px ${FONT}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  const label = `Breeze ${Math.abs(wx).toFixed(1)} ${Math.abs(wx) < 0.15 ? '' : wx > 0 ? 'to the right' : 'to the left'}`.trim();
  ctx.fillText(label, r.x + r.h * 1.9, cy + 1);
  const lw = ctx.measureText(label).width, lx0 = r.x + r.h * 1.9 + lw + 16, fw = Math.min(r.w * 0.34, 210), fx0 = r.x + r.w - fw - r.h * 0.4, n = 14;
  if (fx0 >= lx0) {
    const fc = windForecast(run, run.t, 7, n);
    ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(fx0, cy); ctx.lineTo(fx0 + fw, cy); ctx.stroke();
    ctx.strokeStyle = '#ffd35a'; ctx.lineWidth = 3; ctx.beginPath();
    fc.forEach((v, k) => { const px = fx0 + (k / (n - 1)) * fw, py = cy - Math.max(-1, Math.min(1, v / 1.6)) * r.h * 0.34; if (k) ctx.lineTo(px, py); else ctx.moveTo(px, py); });
    ctx.stroke();
  }
}
// Landscape only: the right-hand column has room between the breeze and the buttons, so it lists the five tricks with how many this run
// has landed (the goals the player can chase), instead of staying empty.
function drawTricks(ctx, L, run) {
  if (!L.land) return;
  const top = L.wind.y + L.wind.h + 12, bot = (L.watch ? L.demo.pause.y : L.pause.y) - 12, h = bot - top;
  const fs = L.fs, rowH = Math.max(fs.small * 2.1, 36), headH = Math.max(fs.small * 1.7, 30);
  const rows = Math.min(TRICKS.length, Math.floor((h - headH - 14) / rowH));
  if (rows < 3) return;
  const r = { x: L.px0, y: top, w: L.pw, h: Math.min(h, headH + 14 + rows * rowH) };
  chipBg(ctx, r, 22);
  ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(255,230,200,0.8)'; ctx.font = `700 ${fs.small}px ${FONT}`;
  ctx.fillText('TRICKS THIS RUN', r.x + 18, r.y + headH * 0.62);
  const counts = {}; for (const id of run.tricks) counts[id] = (counts[id] || 0) + 1;
  TRICKS.slice(0, rows).forEach((T, i) => {
    const y = r.y + headH + 6 + i * rowH + rowH / 2, n = counts[T.id] || 0;
    ctx.fillStyle = n ? 'rgba(255,211,90,0.16)' : 'rgba(255,255,255,0.05)'; roundPath(ctx, r.x + 10, y - rowH / 2 + 3, r.w - 20, rowH - 6, 12); ctx.fill();
    ctx.fillStyle = n ? '#ffd35a' : 'rgba(255,241,226,0.62)'; ctx.beginPath(); ctx.arc(r.x + 28, y, Math.max(5, rowH * 0.14), 0, TAU); n ? ctx.fill() : (ctx.lineWidth = 2, ctx.strokeStyle = ctx.fillStyle, ctx.stroke());
    let sz = fs.small; ctx.font = `${n ? 800 : 600} ${sz}px ${FONT}`; ctx.textAlign = 'left';
    const right = n ? `x${n}` : `+${T.pts}`;
    const rw = ctx.measureText(right).width + 18;
    while (ctx.measureText(T.name).width > r.w - 70 - rw && sz > 11) { sz -= 1; ctx.font = `${n ? 800 : 600} ${sz}px ${FONT}`; }
    ctx.fillStyle = n ? '#fff1e2' : 'rgba(255,241,226,0.72)'; ctx.fillText(T.name, r.x + 46, y + 1);
    ctx.textAlign = 'right'; ctx.font = `800 ${fs.small}px ${FONT}`; ctx.fillStyle = n ? '#ffd35a' : 'rgba(255,211,90,0.55)'; ctx.fillText(right, r.x + r.w - 20, y + 1);
  });
}
function drawScore(ctx, L, state, run) {
  const r = L.score, fs = L.fs, cx = r.x + r.w / 2;
  chipBg(ctx, r, 22);
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.font = `700 ${fs.small}px ${FONT}`; ctx.fillStyle = 'rgba(255,230,200,0.8)';
  const hoopy = run.mode !== 'street';
  ctx.fillText(run.mode === 'daily' ? 'DAILY' : hoopy ? 'HOOPS' : 'KICKS', cx, r.y + fs.small * 1.15);
  const bigSz = Math.min(fs.big, Math.max(24, r.h - fs.small * 2.9));
  ctx.fillStyle = '#fff1e2'; ctx.font = `800 ${bigSz}px ${DISPLAY}`;
  ctx.fillText(String(hoopy ? run.hoopsDone : run.streak), cx, r.y + fs.small * 1.3 + bigSz * 0.82);
  ctx.fillStyle = '#ffd35a';
  const bestV = run.mode === 'daily' ? state.record.bestDaily : run.mode === 'street' ? state.record.best : state.record.bestHoops;
  const sub = `${run.points.toLocaleString('en-US')} pts  ·  ${hoopy ? `${run.streak} kicks  ·  ` : ''}x${run.mult.toFixed(2).replace(/0$/, '')}  ·  best ${Math.max(bestV, 0)}`;
  let sz = fs.small; ctx.font = `700 ${sz}px ${FONT}`;
  while (ctx.measureText(sub).width > r.w - 20 && sz > 11) { sz -= 1; ctx.font = `700 ${sz}px ${FONT}`; }
  ctx.fillText(sub, cx, r.y + r.h - fs.small * 0.4);
}
function icon(ctx, kind, cx, cy, s, col) {
  ctx.save(); ctx.fillStyle = col; ctx.lineWidth = s * 0.16; ctx.lineCap = 'round';
  if (kind === 'pause') { ctx.fillRect(cx - s * 0.42, cy - s * 0.5, s * 0.28, s); ctx.fillRect(cx + s * 0.14, cy - s * 0.5, s * 0.28, s); }
  else if (kind === 'bulb') { ctx.beginPath(); ctx.arc(cx, cy - s * 0.12, s * 0.38, 0, TAU); ctx.fill(); ctx.fillRect(cx - s * 0.2, cy + s * 0.26, s * 0.4, s * 0.12); ctx.fillRect(cx - s * 0.14, cy + s * 0.42, s * 0.28, s * 0.1); }
  ctx.restore();
}
function drawTopButtons(ctx, L, state, run) {
  if (run.mode === 'watch') return;
  const { dy } = paintButton(ctx, L.pause, { dark: true });
  icon(ctx, 'pause', L.pause.x + L.pause.w / 2, L.pause.y + dy + L.pause.h / 2, Math.min(L.pause.h * 0.34, 34), '#fffaf0');
  const th = L.think, used = !!state.think;
  const q = paintButton(ctx, th, { active: used, dark: !used });
  icon(ctx, 'bulb', th.x + th.w / 2, th.y + q.dy + th.h * 0.36, Math.min(th.h * 0.3, 30), '#fffaf0');
  ctx.fillStyle = '#fffaf0'; ctx.font = `700 ${Math.max(L.fs.small, 12)}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('Think', th.x + th.w / 2, th.y + q.dy + th.h * 0.78);
}
function drawDemoBar(ctx, L, state) {
  const D = L.demo, st = state.settings;
  drawButton(ctx, D.dec, 'Think −', { dark: true, size: Math.round(L.fs.btn * 0.9), disabled: st.thinkIdx === 0 });
  drawButton(ctx, D.pause, state.paused ? 'Resume' : 'Pause', { primary: !state.paused, active: state.paused, size: L.fs.btn });
  drawButton(ctx, D.inc, 'Think +', { dark: true, size: Math.round(L.fs.btn * 0.9), disabled: st.thinkIdx === THINK_STEPS.length - 1 });
  drawButton(ctx, D.exit, 'Stop watching', { dark: true, size: L.fs.btn });
}
function card(ctx, L, y, w, lines, head, bar, col) {
  const st = L.stage, x = st.x + (st.w - w) / 2, fz = Math.max(L.fs.mid, 14), lh = fz * 1.3;
  const h = 56 + lines.length * lh + 22;
  roundPath(ctx, x, y, w, h, 20); ctx.fillStyle = 'rgba(24,12,50,0.86)'; ctx.fill(); ctx.strokeStyle = 'rgba(255,220,130,0.7)'; ctx.lineWidth = 2; ctx.stroke();
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#ffd35a'; ctx.font = `800 ${Math.max(L.fs.mid, 15)}px ${FONT}`; ctx.fillText(head, x + 18, y + 34);
  if (bar != null) {
    roundPath(ctx, x + 18, y + 44, w - 36, 8, 4); ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fill();
    roundPath(ctx, x + 18, y + 44, Math.max(8, (w - 36) * Math.min(1, bar)), 8, 4); ctx.fillStyle = col; ctx.fill();
  }
  ctx.fillStyle = '#fff1e2'; ctx.font = `600 ${fz}px ${FONT}`;
  lines.forEach((l, i) => ctx.fillText(l, x + 18, y + 78 + i * lh));
}
function drawDecision(ctx, L, state) {
  const d = state.dec; if (!d || !d.active) return;
  const st = L.stage, w = Math.min(st.w - 28, 640);
  ctx.save(); ctx.font = `600 ${Math.max(L.fs.mid, 14)}px ${FONT}`;
  const lines = wrapLines(ctx, d.adv.why, w - 36);
  const phase = d.phase === 'think' ? 'Thinking' : d.phase === 'reveal' ? 'Choosing' : 'Kicking';
  const k = d.phase === 'go' ? 1 : d.t / d.dur;
  card(ctx, L, st.y + 12, w, lines, `${phase}…`, k, d.phase === 'think' ? '#7fd1c4' : '#ffb347');
  ctx.restore();
}
function drawBanner(ctx, L, state) {
  const b = state.banner; if (!b) return;
  const st = L.stage, k = b.t / b.max, a = Math.min(1, (1 - k) * 3), sc = 0.8 + 0.25 * Math.min(1, k * 8);
  ctx.save(); ctx.globalAlpha = a; ctx.translate(st.x + st.w / 2, st.y + st.h * 0.22); ctx.scale(sc, sc);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const sz = Math.round(Math.min(52, st.w * 0.072) * (TEXT_SCALES[state.settings.textIdx] > 1.5 ? 0.9 : 1));   // a call, not a billboard: the alley and the kid stay in view
  ctx.font = `800 ${sz}px ${DISPLAY}`; ctx.lineWidth = 12; ctx.strokeStyle = 'rgba(20,8,40,0.88)'; ctx.lineJoin = 'round'; ctx.strokeText(b.text, 0, 0);
  const g = ctx.createLinearGradient(0, -sz / 2, 0, sz / 2); g.addColorStop(0, '#fff3c4'); g.addColorStop(1, b.col || '#ff7a9a'); ctx.fillStyle = g; ctx.fillText(b.text, 0, 0);
  if (b.sub) { ctx.font = `700 ${Math.round(sz * 0.36)}px ${FONT}`; ctx.lineWidth = 6; ctx.strokeText(b.sub, 0, sz * 0.68); ctx.fillStyle = '#fff1e2'; ctx.fillText(b.sub, 0, sz * 0.68); }
  ctx.restore();
}
function drawToast(ctx, L, state) {
  if (!state.toast || state.toastT <= 0) return;
  const st = L.stage, fs = L.fs.toast, a = Math.min(1, state.toastT * 2);
  ctx.save(); ctx.globalAlpha = a; ctx.font = `700 ${fs}px ${FONT}`;
  const maxW = Math.min(st.w - 30, 640), lines = wrapLines(ctx, state.toast, maxW - 40), lh = fs * 1.3, h = lines.length * lh + 22;
  const x = st.x + st.w / 2, y = st.y + 58;
  roundPath(ctx, x - maxW / 2, y, maxW, h, 18); ctx.fillStyle = 'rgba(24,12,50,0.82)'; ctx.fill();
  ctx.fillStyle = '#fff1e2'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  lines.forEach((l, i) => ctx.fillText(l, x, y + 11 + lh * (i + 0.5)));
  ctx.restore();
}

export function renderPlay(ctx, state) {
  const run = state.run, L = layoutOf(state), cam = camFor(state, run);
  const watch = run.mode === 'watch';
  const dx = state.shake > 0 ? Math.sin(state.t * 90) * state.shake * 6 : 0, dy = state.shake > 0 ? Math.cos(state.t * 77) * state.shake * 5 : 0;
  ctx.save(); ctx.translate(dx, dy);
  drawScene(ctx, state, run, cam, { landing: state.landing, reach: state.settings.guide });
  const adv = (state.think && state.think.adv) || (state.dec && state.dec.adv);
  if (adv && !run.over) drawAdvice(ctx, cam, adv, state.t);
  ctx.restore();
  if (L.land) { ctx.save(); ctx.fillStyle = 'rgba(22,10,46,0.78)'; ctx.fillRect(L.px0 - 12, 0, W - L.px0 + 12, H); ctx.restore(); }
  drawWind(ctx, L, run);
  drawScore(ctx, L, state, run);
  drawTricks(ctx, L, run);
  drawTopButtons(ctx, L, state, run);
  if (watch) drawDemoBar(ctx, L, state);
  drawDecision(ctx, L, state);
  drawBanner(ctx, L, state);
  drawToast(ctx, L, state);
  if (state.think && !watch) {
    const st = L.stage, w = Math.min(st.w - 28, 640);
    ctx.save(); ctx.font = `600 ${Math.max(L.fs.mid, 14)}px ${FONT}`;
    card(ctx, L, st.y + 12, w, wrapLines(ctx, state.think.adv.why, w - 36), 'Think', state.think.t / 2.5, '#ffd35a');
    ctx.restore();
  }
  if (run.over && state.overT > 0.15) {
    const k = Math.min(1, (state.overT - 0.15) * 3);
    ctx.save(); ctx.globalAlpha = 0.5 * k; ctx.fillStyle = '#12082a'; ctx.fillRect(L.stage.x, L.stage.y, L.stage.w, L.stage.h); ctx.restore();
    ctx.save(); ctx.globalAlpha = k; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const cx = L.stage.x + L.stage.w / 2, cy = L.stage.y + L.stage.h * 0.4, sz = Math.round(Math.min(72, L.stage.w * 0.1));
    const txt = run.over.done ? 'Session complete' : 'Dropped';
    ctx.font = `800 ${sz}px ${DISPLAY}`; ctx.lineWidth = 10; ctx.strokeStyle = 'rgba(20,8,40,0.88)'; ctx.lineJoin = 'round'; ctx.strokeText(txt, cx, cy); ctx.fillStyle = run.over.done ? '#9be8b0' : '#ffd0b0'; ctx.fillText(txt, cx, cy);
    ctx.font = `700 ${Math.round(sz * 0.38)}px ${FONT}`; ctx.fillStyle = '#fff1e2'; ctx.fillText(state.overWhy || '', cx, cy + sz * 0.75);
    ctx.restore();
  }
}
export { kindAt, KINDS };
