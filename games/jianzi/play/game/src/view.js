// The play screen: courtyard, figures, shuttle, effects, HUD, pads. Pure drawing; game.js owns state.
import { W, H, host, playLayout, TEXT_SCALES, THINK_STEPS } from './layout.js';
import { FONT, DISPLAY, C, roundPath, paintButton, drawButton, wrapLines, plaque } from './ui.js';
import { makeCam, drawBackdrop, drawAmbient, drawChalk, drawShuttle, drawShadow, drawKicker, drawFx, glowDraw, SHUTTLE_U, COSTUMES, YARDS } from './art.js';
import { PARTNERS, KINDS, inBand, windForecast, BAND_TOP } from './sim.js';
import { gl } from './glhook.js';

const TAU = Math.PI * 2;
export const layoutOf = (state) => playLayout(Math.min(TEXT_SCALES[state.settings.textIdx], 1.6), !!state.run && state.run.mode === 'watch');
export const camFor = (state, run) => makeCam(layoutOf(state).stage, !!(run && run.circle));

function chip(ctx, text, cx, cy, size, bg, fg, padX = 0.55) {
  ctx.save();
  ctx.font = `700 ${size}px ${FONT}`;
  const w = ctx.measureText(text).width + size * padX * 2, h = size * 1.55;
  roundPath(ctx, cx - w / 2, cy - h / 2, w, h, h / 2); ctx.fillStyle = bg; ctx.fill();
  ctx.fillStyle = fg; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, cx, cy + size * 0.04);
  ctx.restore();
}
const kindName = (k) => (k === 'outside' ? 'Outside' : k === 'inside' ? 'Inside' : k === 'knee' ? 'Knee' : 'Toe scoop');

// ---- the scene ------------------------------------------------------------------------------------------------------
export function drawScene(ctx, state, run, cam, opts = {}) {
  const yard = state.record.yardSel, t = state.t;
  const G3 = gl.active ? (gl.frame = { W, H, cam, yard, circle: run.circle, run, people: [], t, design: state.record.shuttleSel }) : null;
  if (!G3) { drawBackdrop(ctx, W, H, cam, yard); drawChalk(ctx, cam, run.circle); }
  if (!G3) drawAmbient(ctx, W, H, cam, yard, t);
  const sh = run.sh;
  // where the shuttle will come down (only while it falls toward someone)
  if (opts.ring && sh.vy < 0.2 && sh.y > 0.1) {
    const pr = opts.ring;
    const px = cam.X(pr.x, pr.z), py = cam.Y(0, pr.z), r = cam.s * cam.persp(pr.z) * 0.38;
    const pulse = 0.5 + 0.5 * Math.sin(state.t * 7);
    ctx.save(); ctx.fillStyle = `rgba(255,120,60,${0.16 + 0.1 * pulse})`; ctx.strokeStyle = 'rgba(255,90,40,0.9)'; ctx.lineWidth = Math.max(2.5, cam.s * 0.035);
    ctx.beginPath(); ctx.ellipse(px, py, r, r * 0.42, 0, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(px - r * 0.45, py); ctx.lineTo(px + r * 0.45, py); ctx.moveTo(px, py - r * 0.2); ctx.lineTo(px, py + r * 0.2); ctx.stroke(); ctx.restore();
  }
  // figures and the shuttle back to front by depth
  const seats = run.circle ? [0, 1, 2, 3] : [0];
  const trailDraw = () => {
    const tr = run.trail || [];
    for (let i = 0; i < tr.length; i++) {
      const q = tr[i], a = (i + 1) / (tr.length + 1);
      ctx.fillStyle = `rgba(255,255,255,${0.08 + 0.3 * a})`;
      ctx.beginPath(); ctx.arc(cam.X(q.x, q.z), cam.Y(q.y, q.z), Math.max(1.5, cam.s * 0.026 * a * 2), 0, TAU); ctx.fill();
    }
  };
  const shuttleDraw = () => {
    const sx = cam.X(sh.x, sh.z), sy = cam.Y(Math.max(0, sh.y), sh.z), f = cam.persp(sh.z);
    const h = Math.max(0, sh.y), sr = cam.s * f * (0.2 + 0.03 * Math.min(2.6, h));
    trailDraw();
    if (G3) { glowDraw(ctx, sx, sy, cam.s * f, state.t); return; }   // the 3D shuttle is drawn by the presenter, at real size
    drawShadow(ctx, sx, cam.Y(0, sh.z), sr * 1.1, sr * 0.38, 0.32 - Math.min(0.2, h * 0.07));
    const u = Math.max(4, cam.s * f * SHUTTLE_U);
    drawShuttle(ctx, sx, sy, u, sh.ang, state.record.shuttleSel, state.t);
  };
  const items = seats.map((i) => ({ z: run.pz[i], i }));
  items.push({ z: sh.z - 0.001, shuttle: true });
  items.sort((p, q) => q.z - p.z);
  for (const it of items) {
    if (it.shuttle) { shuttleDraw(); continue; }
    const i = it.i, p = { x: run.px[i], z: run.pz[i] };
    const look = run.expect === i ? sh.x : (run.circle ? run.spots[run.expect].x : sh.x);
    if (G3) G3.people.push({ i, x: p.x, z: p.z, anim: run.anim[i], look });
    else drawKicker(ctx, cam, i, p, run.anim[i], look, state.t, { mark: opts.mark === i });
    if (run.circle && i !== 0) {
      ctx.font = `700 ${Math.max(15, Math.round(cam.s * cam.persp(p.z) * 0.16))}px ${FONT}`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const nm = PARTNERS[i].name, tw = ctx.measureText(nm).width + 18, ty = cam.Y(0, p.z) + cam.s * cam.persp(p.z) * 0.28;
      roundPath(ctx, cam.X(p.x, p.z) - tw / 2, ty - 13, tw, 26, 13); ctx.fillStyle = 'rgba(14,18,40,0.55)'; ctx.fill();
      ctx.fillStyle = '#fff6e0'; ctx.fillText(nm, cam.X(p.x, p.z), ty + 1);
    }
  }
  drawFx(ctx, cam, run === state.run ? state.fx : state.attFx || []);
  // floating texts
  if (run === state.run) {
    for (const q of state.pops) {
      const k = q.t / q.max, y = cam.Y(q.y, q.z) - k * cam.s * 0.5, x = cam.X(q.x, q.z);
      ctx.save(); ctx.globalAlpha = Math.min(1, (1 - k) * 2.2); ctx.font = `800 ${Math.round(q.size * (0.9 + 0.2 * Math.min(1, k * 6)))}px ${DISPLAY}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(10,14,34,0.8)'; ctx.lineJoin = 'round'; ctx.strokeText(q.text, x, y); ctx.fillStyle = q.col; ctx.fillText(q.text, x, y);
      ctx.restore();
    }
  }
}

// The strike gauge beside you: three kick zones and where the shuttle is.
function drawGauge(ctx, cam, run, state, L) {
  const x = cam.X(run.circle ? run.spots[0].x - 0.95 : 1.5, 0), y0 = cam.Y(0, 0), y1 = cam.Y(BAND_TOP, 0), w = Math.max(16, cam.s * 0.16);
  const zone = (ya, yb, col) => { ctx.fillStyle = col; ctx.fillRect(x - w / 2, cam.Y(yb, 0), w, cam.Y(ya, 0) - cam.Y(yb, 0)); };
  const live = inBand(run);
  ctx.save();
  ctx.globalAlpha = live ? 1 : 0.62;
  roundPath(ctx, x - w / 2 - 4, y1 - 4, w + 8, y0 - y1 + 8, 8); ctx.fillStyle = 'rgba(14,18,40,0.55)'; ctx.fill();
  zone(0, 0.16, '#e0a43a'); zone(0.16, 0.48, '#2fae9a'); zone(0.48, BAND_TOP, '#7d68c8');
  for (const [c, col] of [[0.3, '#fff'], [0.66, '#fff']]) { ctx.fillStyle = col; ctx.fillRect(x - w / 2 - 3, cam.Y(c, 0) - 1.5, w + 6, 3); }
  ctx.fillStyle = '#fff6e0'; ctx.font = `700 ${Math.max(12, Math.round(cam.s * 0.11))}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const lx = x + w / 2 + Math.max(16, cam.s * 0.16);
  // labels sit right of the gauge; when that would run off the canvas (gauge near the right edge) they flip to its left side
  let rightEdge = Infinity; try { const m = ctx.getTransform(); if (m && ctx.canvas && ctx.canvas.width > 0) rightEdge = (ctx.canvas.width - m.e) / (m.a || 1); } catch { /* headless stub */ }
  const labW = ctx.measureText?.('Knee')?.width ?? 0, flip = lx - w * 0.2 + labW + 6 > rightEdge;
  const tx = flip ? x - w / 2 - 6 : lx - w * 0.2; ctx.textAlign = flip ? 'right' : 'left';
  ctx.fillText('Knee', tx, cam.Y(0.68, 0)); ctx.fillText('Foot', tx, cam.Y(0.32, 0)); ctx.fillText('Toe', tx, cam.Y(0.08, 0));
  // the shuttle height marker
  const sh = run.sh;
  if (sh.vy < 0.3 && sh.y < 1.8 && sh.y > 0) {
    const my = cam.Y(Math.min(sh.y, 1.4), 0);
    ctx.fillStyle = live ? '#fff' : 'rgba(255,255,255,0.7)';
    ctx.beginPath(); ctx.moveTo(x - w / 2 - 2, my); ctx.lineTo(x - w / 2 - 14, my - 8); ctx.lineTo(x - w / 2 - 14, my + 8); ctx.closePath(); ctx.fill();
    ctx.fillRect(x - w / 2 - 2, my - 1.5, w + 4, 3);
  }
  ctx.restore();
  void state; void L;
}

// ---- HUD -----------------------------------------------------------------------------------------------------------------
function drawWind(ctx, L, run) {
  const r = L.wind, fs = L.fs.wind;
  plaque(ctx, r.x, r.y, r.w, r.h, { r: r.h / 2, tone: 'slate' });
  const wx = run.wx, cy = r.y + r.h / 2, mag = Math.min(1, Math.abs(wx) / 1.6);
  // arrow
  const ax = r.x + r.h * 0.9, len = r.h * (0.3 + 0.6 * mag) * (wx >= 0 ? 1 : -1);
  ctx.strokeStyle = mag > 0.65 ? '#ffb18a' : '#cdeee8'; ctx.fillStyle = ctx.strokeStyle; ctx.lineWidth = Math.max(3, r.h * 0.1); ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(ax - len, cy); ctx.lineTo(ax + len, cy); ctx.stroke();
  const d = wx >= 0 ? 1 : -1;
  ctx.beginPath(); ctx.moveTo(ax + len + d * r.h * 0.2, cy); ctx.lineTo(ax + len, cy - r.h * 0.17); ctx.lineTo(ax + len, cy + r.h * 0.17); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#fff6e0'; ctx.font = `700 ${fs}px ${FONT}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  const label = `Wind ${Math.abs(wx).toFixed(1)} ${Math.abs(wx) < 0.15 ? '' : wx > 0 ? 'to the right' : 'to the left'}`.trim();
  ctx.fillText(label, r.x + r.h * 1.9, cy + 1);
  // forecast strip, only when the label leaves room for it
  const lw = ctx.measureText(label).width, lx0 = r.x + r.h * 1.9 + lw + 16, fw = Math.min(r.w * 0.34, 210), fx0 = r.x + r.w - fw - r.h * 0.4, n = 14;
  if (fx0 >= lx0) {
    const fc = windForecast(run, run.t, 7, n);
    ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(fx0, cy); ctx.lineTo(fx0 + fw, cy); ctx.stroke();
    ctx.strokeStyle = '#ffe08a'; ctx.lineWidth = 3; ctx.beginPath();
    fc.forEach((v, k) => { const px = fx0 + (k / (n - 1)) * fw, py = cy - Math.max(-1, Math.min(1, v / 1.6)) * r.h * 0.34; if (k) ctx.lineTo(px, py); else ctx.moveTo(px, py); });
    ctx.stroke();
    ctx.fillStyle = '#ffe08a'; ctx.beginPath(); ctx.arc(fx0, cy - Math.max(-1, Math.min(1, fc[0] / 1.6)) * r.h * 0.34, 4, 0, TAU); ctx.fill();
  }
}

function drawScore(ctx, L, state, run) {
  const r = L.score, fs = L.fs, cx = r.x + r.w / 2;
  plaque(ctx, r.x, r.y, r.w, r.h, { r: 22, tone: 'slate' });
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.font = `700 ${fs.small}px ${FONT}`; ctx.fillStyle = 'rgba(255,238,200,0.8)';
  ctx.fillText(run.circle ? 'CHAIN' : run.mode === 'daily' ? 'DAILY STREAK' : 'STREAK', cx, r.y + fs.small * 1.15);
  const bigSz = Math.min(fs.big, Math.max(24, r.h - fs.small * 2.9));
  ctx.fillStyle = '#fff6e0'; ctx.font = `800 ${bigSz}px ${DISPLAY}`;
  ctx.fillText(String(run.streak), cx, r.y + fs.small * 1.3 + bigSz * 0.82);
  const bestV = run.circle ? state.record.bestCircle : run.mode === 'daily' ? state.record.bestDaily : state.record.best;
  ctx.fillStyle = '#ffd97a';
  const sub = `${run.points.toLocaleString('en-US')} pts  ·  x${run.mult.toFixed(1)}  ·  best ${Math.max(bestV, 0)}`;
  let sz = fs.small; ctx.font = `700 ${sz}px ${FONT}`;
  while (ctx.measureText(sub).width > r.w - 20 && sz > 11) { sz -= 1; ctx.font = `700 ${sz}px ${FONT}`; }
  ctx.fillText(sub, cx, r.y + r.h - fs.small * 0.4);
}

function icon(ctx, kind, cx, cy, s, col) {
  ctx.save(); ctx.fillStyle = col; ctx.strokeStyle = col; ctx.lineWidth = s * 0.16; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (kind === 'pause') { ctx.fillRect(cx - s * 0.42, cy - s * 0.5, s * 0.28, s); ctx.fillRect(cx + s * 0.14, cy - s * 0.5, s * 0.28, s); }
  else if (kind === 'left' || kind === 'right') {
    const d = kind === 'left' ? -1 : 1;
    ctx.beginPath(); ctx.moveTo(cx + d * s * 0.6, cy); ctx.lineTo(cx - d * s * 0.1, cy - s * 0.55); ctx.lineTo(cx - d * s * 0.1, cy - s * 0.2); ctx.lineTo(cx - d * s * 0.6, cy - s * 0.2); ctx.lineTo(cx - d * s * 0.6, cy + s * 0.2); ctx.lineTo(cx - d * s * 0.1, cy + s * 0.2); ctx.lineTo(cx - d * s * 0.1, cy + s * 0.55); ctx.closePath(); ctx.fill();
  } else if (kind === 'up') {
    ctx.beginPath(); ctx.moveTo(cx, cy - s * 0.6); ctx.lineTo(cx + s * 0.55, cy + s * 0.1); ctx.lineTo(cx + s * 0.2, cy + s * 0.1); ctx.lineTo(cx + s * 0.2, cy + s * 0.55); ctx.lineTo(cx - s * 0.2, cy + s * 0.55); ctx.lineTo(cx - s * 0.2, cy + s * 0.1); ctx.lineTo(cx - s * 0.55, cy + s * 0.1); ctx.closePath(); ctx.fill();
  } else if (kind === 'bulb') {
    ctx.beginPath(); ctx.arc(cx, cy - s * 0.12, s * 0.38, 0, TAU); ctx.fill(); ctx.fillRect(cx - s * 0.2, cy + s * 0.26, s * 0.4, s * 0.12); ctx.fillRect(cx - s * 0.14, cy + s * 0.42, s * 0.28, s * 0.1);
  }
  ctx.restore();
}

export function drawPads(ctx, L, state, run) {
  const live = inBand(run) && !state.paused && !run.over, adv = state.think && state.think.adv;
  const circle = run.circle;
  const labels = circle ? [PARTNERS[1].name, PARTNERS[2].name, PARTNERS[3].name] : ['Left', 'Straight', 'Right'];
  const subs = circle ? [1, 2, 3].map((i) => (run.streak - run.lastTouch[i] >= 4 && run.streak > 3 ? 'waiting +10' : 'pass')) : ['nudge left', 'keep centred', 'nudge right'];
  const icons = ['left', 'up', 'right'];
  const padVal = circle ? [1, 2, 3] : [-1, 0, 1];
  L.pads.forEach((r, k) => {
    const rec = adv && adv.pad === padVal[k];
    const o = { primary: live && !rec, active: rec || (!live && false), dark: !live && !rec };
    const { dy } = paintButton(ctx, r, o);
    const cx = r.x + r.w / 2, big = Math.min(r.w, r.h);
    ctx.save();
    if (rec) { ctx.lineWidth = 5; ctx.strokeStyle = '#ffe08a'; roundPath(ctx, r.x - 3, r.y - 3 + dy, r.w + 6, r.h + 6, 20); ctx.stroke(); }
    const col = live || rec ? '#fffaf0' : 'rgba(255,255,255,0.7)';
    icon(ctx, icons[k], cx, r.y + dy + r.h * 0.38, Math.min(big * 0.34, 60), col);
    ctx.fillStyle = col; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    let sz = L.fs.pad; ctx.font = `800 ${sz}px ${FONT}`; while (ctx.measureText(labels[k]).width > r.w - 16 && sz > 12) { sz -= 1; ctx.font = `800 ${sz}px ${FONT}`; }
    ctx.fillText(labels[k], cx, r.y + dy + r.h * 0.7);
    ctx.font = `600 ${Math.max(L.fs.padSub, 11)}px ${FONT}`; ctx.globalAlpha = 0.85;
    let s2 = subs[k]; while (ctx.measureText(s2).width > r.w - 10 && s2.length > 4) s2 = s2.slice(0, -1);
    ctx.fillText(s2, cx, r.y + dy + r.h * 0.7 + L.fs.pad * 0.95);
    ctx.restore();
    if (circle) { ctx.fillStyle = COSTUMES[padVal[k]].tunic; ctx.beginPath(); ctx.arc(r.x + 16, r.y + 16 + dy, 8, 0, TAU); ctx.fill(); }
  });
}

function drawTopButtons(ctx, L, state, run) {
  const watch = run.mode === 'watch';
  if (watch) return;
  const { dy } = paintButton(ctx, L.pause, { dark: true });
  icon(ctx, 'pause', L.pause.x + L.pause.w / 2, L.pause.y + dy + L.pause.h / 2 - (L.land ? 0 : 0), Math.min(L.pause.h * 0.34, 34), '#fffaf0');
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

// The Watch & Learn think card, drawn over the top of the courtyard.
function drawDecision(ctx, L, state, run, cam) {
  const d = state.dec; if (!d || !d.active) return;
  const st = L.stage, pad = 14, w = Math.min(st.w - 2 * pad, 640), x = st.x + (st.w - w) / 2;
  const phase = d.phase === 'think' ? 'Thinking' : d.phase === 'reveal' ? 'Choosing' : 'Kicking';
  ctx.save();
  ctx.font = `600 ${Math.max(L.fs.mid, 14)}px ${FONT}`;
  const lines = wrapLines(ctx, d.adv.why, w - 36), lh = Math.max(L.fs.mid, 14) * 1.3;
  const h = 56 + lines.length * lh + 30, y = st.y + pad + (L.land ? 4 : 0);
  roundPath(ctx, x, y, w, h, 20); ctx.fillStyle = 'rgba(14,18,40,0.82)'; ctx.fill();
  ctx.strokeStyle = 'rgba(255,224,138,0.7)'; ctx.lineWidth = 2; ctx.stroke();
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#ffe08a'; ctx.font = `800 ${Math.max(L.fs.mid, 15)}px ${FONT}`; ctx.fillText(`${phase}…`, x + 18, y + 34);
  const k = d.phase === 'think' ? d.t / d.dur : d.phase === 'reveal' ? d.t / d.dur : 1;
  roundPath(ctx, x + 18, y + 44, w - 36, 8, 4); ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fill();
  roundPath(ctx, x + 18, y + 44, Math.max(8, (w - 36) * Math.min(1, k)), 8, 4); ctx.fillStyle = d.phase === 'think' ? '#7fd1c4' : '#ffb347'; ctx.fill();
  ctx.fillStyle = '#fff6e0'; ctx.font = `600 ${Math.max(L.fs.mid, 14)}px ${FONT}`;
  lines.forEach((l, i) => ctx.fillText(l, x + 18, y + 78 + i * lh));
  ctx.restore();
  void run; void cam;
}

function drawBanner(ctx, L, state) {
  const b = state.banner; if (!b) return;
  const st = L.stage, k = b.t / b.max, a = Math.min(1, (1 - k) * 3), sc = 0.8 + 0.25 * Math.min(1, k * 8);
  ctx.save(); ctx.globalAlpha = a; ctx.translate(st.x + st.w / 2, st.y + st.h * 0.26); ctx.scale(sc, sc);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const sz = Math.round(Math.min(78, st.w * 0.11) * Math.min(1.25, TEXT_SCALES[state.settings.textIdx] > 1.5 ? 1 : 1.15));
  ctx.font = `800 ${sz}px ${DISPLAY}`; ctx.lineWidth = 12; ctx.strokeStyle = 'rgba(10,14,34,0.85)'; ctx.lineJoin = 'round'; ctx.strokeText(b.text, 0, 0);
  const g = ctx.createLinearGradient(0, -sz / 2, 0, sz / 2); g.addColorStop(0, '#fff3c4'); g.addColorStop(1, b.col || '#f2a63a'); ctx.fillStyle = g; ctx.fillText(b.text, 0, 0);
  if (b.sub) { ctx.font = `700 ${Math.round(sz * 0.36)}px ${FONT}`; ctx.lineWidth = 6; ctx.strokeText(b.sub, 0, sz * 0.68); ctx.fillStyle = '#fff6e0'; ctx.fillText(b.sub, 0, sz * 0.68); }
  ctx.restore();
}

function drawToast(ctx, L, state) {
  if (!state.toast || state.toastT <= 0) return;
  const st = L.stage, fs = L.fs.toast, a = Math.min(1, state.toastT * 2);
  ctx.save(); ctx.globalAlpha = a; ctx.font = `700 ${fs}px ${FONT}`;
  const maxW = Math.min(st.w - 30, 640), lines = wrapLines(ctx, state.toast, maxW - 40), lh = fs * 1.3, h = lines.length * lh + 22;
  const x = st.x + st.w / 2, y = st.y + st.h - h - 14;
  roundPath(ctx, x - maxW / 2, y, maxW, h, 18); ctx.fillStyle = 'rgba(14,18,40,0.78)'; ctx.fill();
  ctx.fillStyle = '#fff6e0'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  lines.forEach((l, i) => ctx.fillText(l, x, y + 11 + lh * (i + 0.5)));
  ctx.restore();
}

export function renderPlay(ctx, state) {
  const run = state.run, L = layoutOf(state), cam = camFor(state, run);
  const watch = run.mode === 'watch';
  const dx = state.shake > 0 ? Math.sin(state.t * 90) * state.shake * 6 : 0, dy = state.shake > 0 ? Math.cos(state.t * 77) * state.shake * 5 : 0;
  ctx.save(); ctx.translate(dx, dy);
  const ring = state.ring;
  drawScene(ctx, state, run, cam, { ring, mark: run.expect === 0 ? -1 : run.expect });
  ctx.restore();
  if (state.settings.gauge && run.mode !== 'watch' && (run.expect === 0 || !run.circle)) drawGauge(ctx, cam, run, state, L);
  if (L.land) { ctx.save(); ctx.fillStyle = 'rgba(12,18,44,0.55)'; ctx.fillRect(L.px0 - 12, 0, W - L.px0 + 12, H); ctx.restore(); }
  drawWind(ctx, L, run);
  drawScore(ctx, L, state, run);
  drawTopButtons(ctx, L, state, run);
  if (watch) drawDemoBar(ctx, L, state); else drawPads(ctx, L, state, run);
  drawDecision(ctx, L, state, run, cam);
  drawBanner(ctx, L, state);
  drawToast(ctx, L, state);
  if (state.think && !watch) {
    ctx.save(); ctx.fillStyle = 'rgba(255,224,138,0.1)'; ctx.fillRect(0, 0, W, H); ctx.restore();
    const st = L.stage, w = Math.min(st.w - 28, 640);
    ctx.save(); ctx.font = `700 ${Math.max(L.fs.mid, 14)}px ${FONT}`;
    const lines = wrapLines(ctx, state.think.adv.why, w - 36), lh = Math.max(L.fs.mid, 14) * 1.3, h = lines.length * lh + 26;
    const x = st.x + st.w / 2 - w / 2, y = st.y + 10;
    roundPath(ctx, x, y, w, h, 18); ctx.fillStyle = 'rgba(14,18,40,0.82)'; ctx.fill(); ctx.strokeStyle = 'rgba(255,224,138,0.7)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#fff6e0'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    lines.forEach((l, i) => ctx.fillText(l, x + 18, y + 13 + lh * (i + 0.5)));
    ctx.restore();
  }
  if (run.over && state.overT > 0.15) {
    const k = Math.min(1, (state.overT - 0.15) * 3);
    ctx.save(); ctx.globalAlpha = 0.5 * k; ctx.fillStyle = '#0c1226'; ctx.fillRect(L.stage.x, L.stage.y, L.stage.w, L.stage.h); ctx.restore();
    ctx.save(); ctx.globalAlpha = k; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const cx = L.stage.x + L.stage.w / 2, cy = L.stage.y + L.stage.h * 0.4, sz = Math.round(Math.min(72, L.stage.w * 0.1));
    ctx.font = `800 ${sz}px ${DISPLAY}`; ctx.lineWidth = 10; ctx.strokeStyle = 'rgba(10,14,34,0.85)'; ctx.lineJoin = 'round'; ctx.strokeText('Dropped', cx, cy); ctx.fillStyle = '#ffd9b0'; ctx.fillText('Dropped', cx, cy);
    ctx.font = `700 ${Math.round(sz * 0.38)}px ${FONT}`; ctx.fillStyle = '#fff6e0'; ctx.fillText(state.overWhy || '', cx, cy + sz * 0.75);
    ctx.restore();
  }
}
export { YARDS, kindName, KINDS };
