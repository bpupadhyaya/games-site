// The play screen's 2D layer: score, cue strip, closing ring on the receiving dancer, touch pads, popups and banners.
// The dancers, ball and plaza are drawn by the 3D presenter behind this canvas (or by the flat fallback below when WebGL is
// not available). Everything here projects through src/camera.js, the same maths the presenter renders with.
import { W, H, playLayout, TEXT_SCALES, host } from './layout.js';
import { rigFor, project } from './camera.js';
import { TOUCHES, TEMPOS, ROUND_TOUCHES, ROUNDS, WIN, N, spot, flightPos, harmony, stars, COMBOS } from './sim.js';
import { FONT, DISPLAY, roundPath, paintButton, textShadow, lacquerPlate } from './ui.js';

export const TOUCH_COL = ['#f0743f', '#e5b032', '#2fb5a1', '#7a67e0', '#e0558c'];
const TAU = Math.PI * 2;

// ---- the camera rig for the current screen shape ---------------------------------------------------------------------
let rigCache = { key: '', rig: null };
export function stageRig(state, L) {
  const key = `${W}x${H}|${Math.round(L.stage.x)},${Math.round(L.stage.y)},${Math.round(L.stage.w)},${Math.round(L.stage.h)}`;
  if (rigCache.key !== key) rigCache = { key, rig: rigFor(W, H, L.stage) };
  return rigCache.rig;
}
export const layoutOf = (state) => playLayout(Math.min(TEXT_SCALES[state.settings.textIdx], 1.6), state.run && state.run.mode === 'watch');

// ---- little pictograms ----------------------------------------------------------------------------------------------------
// A tiny standing figure with the touching body part marked: one glyph per touch, used on pads, cues and in the rules.
export function drawTouchIcon(ctx, id, cx, cy, size, col = '#fff', line = 'rgba(255,255,255,0.9)') {
  const s = size;
  ctx.save();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const head = { x: cx, y: cy - s * 0.38 };
  ctx.strokeStyle = line; ctx.lineWidth = Math.max(2, s * 0.075);
  ctx.beginPath(); ctx.arc(head.x, head.y, s * 0.11, 0, TAU); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx, cy - s * 0.26); ctx.lineTo(cx, cy + s * 0.06);                          // spine
  ctx.moveTo(cx, cy + s * 0.06); ctx.lineTo(cx - s * 0.10, cy + s * 0.44);              // standing leg
  ctx.moveTo(cx - s * 0.20, cy - s * 0.15); ctx.lineTo(cx, cy - s * 0.2); ctx.lineTo(cx + s * 0.20, cy - s * 0.15);   // arms
  ctx.stroke();
  // the working leg and the marked spot
  let hot = null;
  ctx.beginPath();
  if (id === 'foot') { ctx.moveTo(cx, cy + s * 0.06); ctx.lineTo(cx + s * 0.16, cy + s * 0.30); ctx.lineTo(cx + s * 0.30, cy + s * 0.42); hot = { x: cx + s * 0.30, y: cy + s * 0.42 }; }
  else if (id === 'knee') { ctx.moveTo(cx, cy + s * 0.06); ctx.lineTo(cx + s * 0.26, cy + s * 0.12); ctx.lineTo(cx + s * 0.22, cy + s * 0.40); hot = { x: cx + s * 0.26, y: cy + s * 0.12 }; }
  else if (id === 'heel') { ctx.moveTo(cx, cy + s * 0.06); ctx.lineTo(cx - s * 0.04, cy + s * 0.30); ctx.lineTo(cx - s * 0.30, cy + s * 0.22); hot = { x: cx - s * 0.30, y: cy + s * 0.22 }; }
  else { ctx.moveTo(cx, cy + s * 0.06); ctx.lineTo(cx + s * 0.10, cy + s * 0.44); }
  ctx.stroke();
  if (id === 'neck') hot = { x: cx - s * 0.02, y: cy - s * 0.27 };
  if (id === 'shoulder') hot = { x: cx + s * 0.20, y: cy - s * 0.18 };
  if (hot) {
    ctx.fillStyle = col; ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(hot.x, hot.y, s * 0.115, 0, TAU); ctx.fill(); ctx.stroke();
  }
  ctx.restore();
}

// ---- flat fallback for the scene (no WebGL, or 3D still loading) ------------------------------------------------------------
const SKIN = ['#b98a5e', '#c99a74', '#a9784f', '#e0b48c', '#c08a60', '#b4875f'];
const COST = ['#1f5f8b', '#7a1f3d', '#2f7d5b', '#a8431f', '#43366b', '#c28a1f'];
export function drawScene2D(ctx, run, rig) {
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#a9d2ef'); g.addColorStop(0.42, '#cfe4ef'); g.addColorStop(0.43, '#6f9a4a'); g.addColorStop(1, '#4f7a37');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const c = project(rig, 0, 0, 0), e = project(rig, 3.3, 0, 0), f = project(rig, 0, 0, -3.3), b2 = project(rig, 0, 0, 3.3);
  if (c && e && f && b2) {
    ctx.fillStyle = '#d9c9a4'; ctx.beginPath(); ctx.ellipse(c.x, (f.y + b2.y) / 2, Math.abs(e.x - c.x), Math.abs(f.y - b2.y) / 2, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#b4533a'; ctx.lineWidth = 4; ctx.stroke();
  }
  const order = [...Array(N).keys()].sort((p, q) => spot(q).z - spot(p).z);
  for (const j of order) {
    const sp = spot(j), foot = project(rig, sp.x, 0, sp.z), top = project(rig, sp.x, 1.7, sp.z);
    if (!foot || !top) continue;
    const h = foot.y - top.y, w = h * 0.17, x = foot.x;
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(x, foot.y, w * 1.5, w * 0.45, 0, 0, TAU); ctx.fill();
    // legs in trousers with shoes, then top, arms, head and hair (flat fallback: same people as the 3D scene)
    ctx.strokeStyle = COST[j]; ctx.lineWidth = Math.max(4, w * 0.62); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x - w * 0.42, top.y + h * 0.5); ctx.lineTo(x - w * 0.55, foot.y - h * 0.03); ctx.moveTo(x + w * 0.42, top.y + h * 0.5); ctx.lineTo(x + w * 0.55, foot.y - h * 0.03); ctx.stroke();
    ctx.fillStyle = '#eceae6'; ctx.beginPath(); ctx.ellipse(x - w * 0.6, foot.y - h * 0.01, w * 0.5, w * 0.24, 0, 0, TAU); ctx.ellipse(x + w * 0.6, foot.y - h * 0.01, w * 0.5, w * 0.24, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = SKIN[j]; ctx.lineWidth = Math.max(3, w * 0.45); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x - w * 1.0, top.y + h * 0.24); ctx.lineTo(x - w * 1.5, top.y + h * 0.5); ctx.moveTo(x + w * 1.0, top.y + h * 0.24); ctx.lineTo(x + w * 1.5, top.y + h * 0.5); ctx.stroke();
    ctx.fillStyle = '#f4efe0'; roundPath(ctx, x - w * 0.85, top.y + h * 0.17, w * 1.7, h * 0.36, w * 0.6); ctx.fill();
    ctx.fillStyle = SKIN[j]; ctx.beginPath(); ctx.arc(x, top.y + h * 0.09, h * 0.075, 0, TAU); ctx.fill();
    ctx.fillStyle = '#1a1410'; ctx.beginPath(); ctx.arc(x, top.y + h * 0.075, h * 0.078, Math.PI, TAU); ctx.fill();
  }
  const bp = project(rig, run.ball.x, run.ball.y, run.ball.z);
  if (bp) { ctx.fillStyle = '#e1b266'; ctx.strokeStyle = '#8f5622'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(bp.x, bp.y, Math.max(6, bp.s * 0.12), 0, TAU); ctx.fill(); ctx.stroke(); }
}

// ---- play screen ------------------------------------------------------------------------------------------------------------
const dim = (c, a) => { const m = /^#(..)(..)(..)$/.exec(c); return m ? `rgba(${parseInt(m[1], 16)},${parseInt(m[2], 16)},${parseInt(m[3], 16)},${a})` : c; };
function chip(ctx, r, label, id, active, alpha = 1, small = false) {
  ctx.save(); ctx.globalAlpha = alpha;
  const col = TOUCH_COL[TOUCHES.findIndex((t) => t.id === id)];
  // the next touch sits on a gold-leaf plaque with its colour as a lacquer inlay; the queue behind it is black lacquer
  lacquerPlate(ctx, r.x, r.y, r.w, r.h, 16, active ? 'plain' : 'dark');
  if (active) {
    roundPath(ctx, r.x + 5, r.y + 5, r.w - 10, r.h - 10, 12); ctx.fillStyle = 'rgba(255,244,214,0.96)'; ctx.fill();
    ctx.lineWidth = 4; ctx.strokeStyle = col; ctx.stroke();
  }
  // narrow queue chips (many cues, big text scale, landscape panel): the icon and the label shrink with the chip so nothing spills out
  const isz = Math.min(r.h * 0.78, r.w * 0.36), ix = r.x + Math.min(r.h * 0.5, r.w * 0.2), tx = r.x + Math.min(r.h * 0.95, r.w * 0.42);
  drawTouchIcon(ctx, id, ix, r.y + r.h * 0.5, isz, col, active ? '#3a2410' : 'rgba(255,240,205,0.9)');
  ctx.fillStyle = active ? '#3a2410' : '#ffeec4'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  let fs = Math.round(r.h * (small ? 0.2 : 0.24)); ctx.font = `700 ${fs}px ${FONT}`;
  const maxW = Math.max(6, r.x + r.w - 6 - tx);
  while (ctx.measureText(label).width > maxW && fs > 10) { fs -= 1; ctx.font = `700 ${fs}px ${FONT}`; }
  ctx.fillText(label, tx, r.y + r.h * 0.5, maxW);
  ctx.restore();
}

function drawScore(ctx, state, L, run) {
  const r = L.score, fs = L.fs;
  lacquerPlate(ctx, r.x, r.y, r.w, r.h, 20, 'dark');
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  const big = Math.min(fs.big, r.h - fs.small * 1.2 - 40);
  ctx.font = `800 ${big}px ${DISPLAY}`; textShadow(ctx, run.score.toLocaleString('en-US'), r.x + r.w / 2, r.y + big * 0.88 + 8, '#fff2c8', 5);
  ctx.font = `700 ${fs.small}px ${FONT}`; ctx.fillStyle = '#ffe6a8';
  const sub = run.mode === 'watch' ? `Watch & Learn · ${run.done} / ${run.total}` : `${TEMPOS[run.tempo].name} · Round ${run.round} / ${ROUNDS} · ${run.done % ROUND_TOUCHES} / ${ROUND_TOUCHES}`;
  ctx.fillText(sub, r.x + r.w / 2, r.y + big + fs.small * 1.15 + 8, r.w - 16);
  // flow bar with its multiplier at the right end (never on the line above, so narrow screens do not collide)
  const lab = `x${run.mult.toFixed(1)}`, lfs = Math.max(13, Math.round(fs.small * 0.95));
  ctx.font = `800 ${lfs}px ${FONT}`;
  const lw = ctx.measureText(lab).width + 10, by = r.y + r.h - 22, bx = r.x + 18, bw = r.w - 36 - lw;
  roundPath(ctx, bx, by, bw, 10, 5); ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fill(); ctx.strokeStyle = 'rgba(232,184,74,0.55)'; ctx.lineWidth = 1; ctx.stroke();
  const g = ctx.createLinearGradient(bx, 0, bx + bw, 0); g.addColorStop(0, '#2fb5a1'); g.addColorStop(0.6, '#e5b032'); g.addColorStop(1, '#f0743f');
  roundPath(ctx, bx, by, Math.max(10, bw * run.flow), 10, 5); ctx.fillStyle = g; ctx.fill();
  ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff6e0';
  ctx.fillText(lab, r.x + r.w - 18, by + 5);
}

function drawCues(ctx, state, L, run) {
  const r = L.cues, show = run.mode === 'watch' ? 3 : TEMPOS[run.tempo].preview;
  const list = [];
  if (run.fl && run.phase === 'flight') list.push(run.fl.cue);
  else if (run.cues[0]) list.push(run.cues[0]);
  for (let i = run.phase === 'flight' ? 1 : 1; i < run.cues.length && list.length < show + 1; i++) list.push(run.cues[i]);
  const n = Math.max(1, list.length), g = 8;
  const first = Math.min(r.w * 0.34, r.h * 3.0), rest = (r.w - first - g * (n - 1)) / Math.max(1, n - 1);
  let x = r.x;
  list.forEach((c, i) => {
    const w = i === 0 ? first : rest;
    chip(ctx, { x, y: r.y, w, h: r.h }, TOUCHES[c.touch].short, TOUCHES[c.touch].id, i === 0, i === 0 ? 1 : 0.9 - i * 0.1, i > 0);
    x += w + g;
  });
  if (run.comboName && run.comboQ && run.comboQ.length) {
    const fsz = Math.max(12, Math.round(L.fs.small * 0.85)), label = `${run.comboName} coming`;
    ctx.save(); ctx.font = `700 ${fsz}px ${FONT}`; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    const tw = ctx.measureText(label).width + 16, ph = fsz + 8, px = r.x + r.w - 6, py = r.y + r.h - ph * 0.55;
    lacquerPlate(ctx, px - tw, py, tw, ph, ph / 2, 'dark');
    ctx.fillStyle = '#ffd97a'; ctx.fillText(label, px - 8, py + ph / 2 + 1); ctx.restore();
  }
}

// the ring that closes on the receiving dancer, the touch name above them and the dotted path of the ball
function drawRing(ctx, state, L, run, rig) {
  if (run.phase !== 'flight' || !run.fl) return;
  const f = run.fl, c = f.cue, col = TOUCH_COL[c.touch], tH = f.t1 - WIN.lead;
  const P = project(rig, c.C.x, c.C.y, c.C.z); if (!P) return;
  // dotted path of the flight
  ctx.save(); ctx.fillStyle = 'rgba(255,244,200,0.75)';
  const n = 16;
  for (let i = 1; i < n; i++) {
    const tau = (f.t1 - f.t0) * (i / n), pp = flightPos(f, tau);
    if (run.t - f.t0 > tau) continue;
    const q = project(rig, pp.x, pp.y, pp.z); if (!q) continue;
    ctx.beginPath(); ctx.arc(q.x, q.y, Math.max(2.5, q.s * 0.035), 0, TAU); ctx.fill();
  }
  ctx.restore();
  const u = Math.max(0, Math.min(1, (run.t - f.t0) / Math.max(0.01, tH - f.t0)));
  const rad = P.s * (0.62 - 0.46 * u), r0 = P.s * 0.16;
  const near = Math.abs(run.t - tH) <= WIN.perfect;
  const inWin = run.t >= tH - WIN.early;
  ctx.save();
  ctx.lineWidth = Math.max(3, P.s * 0.05);
  ctx.strokeStyle = near ? '#ffffff' : dim(col, inWin ? 1 : 0.55);
  ctx.beginPath(); ctx.arc(P.x, P.y, Math.max(r0, rad), 0, TAU); ctx.stroke();
  ctx.lineWidth = Math.max(2, P.s * 0.03); ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.setLineDash([4, 5]);
  ctx.beginPath(); ctx.arc(P.x, P.y, r0 * 1.15, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
  if (near) { ctx.fillStyle = dim(col, 0.35); ctx.beginPath(); ctx.arc(P.x, P.y, r0 * 1.15, 0, TAU); ctx.fill(); }
  ctx.restore();
  // name bubble above the dancer's head
  const head = project(rig, spot(c.dancer).x, 1.95, spot(c.dancer).z);
  if (head && state.settings.names) {
    const fs = Math.max(L.fs.cue, Math.round(head.s * 0.15)), label = TOUCHES[c.touch].name;
    ctx.save(); ctx.font = `800 ${fs}px ${FONT}`;
    const w = ctx.measureText(label).width + fs * 2.4, h = fs * 1.9, x = Math.min(W - w / 2 - 6, Math.max(w / 2 + 6, head.x)), y = Math.max(h + 4, head.y - fs * 0.6);
    roundPath(ctx, x - w / 2, y - h, w, h, h / 2); ctx.fillStyle = 'rgba(255,248,226,0.96)'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = col; ctx.stroke();
    drawTouchIcon(ctx, TOUCHES[c.touch].id, x - w / 2 + h * 0.52, y - h / 2, h * 0.8, col, '#2a3350');
    ctx.fillStyle = '#22304f'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(label, x - w / 2 + h * 0.95, y - h / 2 + 1);
    ctx.restore();
  }
  // the dancer after this one gets a quiet marker so the route can be read
  const nx = run.cues[1];
  if (nx) {
    const q = project(rig, spot(nx.dancer).x, 0.05, spot(nx.dancer).z);
    if (q) { ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 3; ctx.setLineDash([3, 6]); ctx.beginPath(); ctx.ellipse(q.x, q.y, q.s * 0.5, q.s * 0.2, 0, 0, TAU); ctx.stroke(); ctx.restore(); }
  }
}

function drawPads(ctx, state, L, run) {
  const hot = state.think && state.think.adv ? state.think.adv.touch : -1;
  L.pads.forEach((r, k) => {
    const t = TOUCHES[k], col = TOUCH_COL[k], lit = hot === k;
    const pressed = state.padFlash && state.padFlash.k === k && state.padFlash.t > 0;
    const { dy } = paintButton(ctx, r, { dark: !lit, primary: lit });
    ctx.save(); ctx.strokeStyle = col; ctx.globalAlpha = 0.9; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(r.x + 22, r.y + 9 + dy); ctx.lineTo(r.x + r.w - 22, r.y + 9 + dy); ctx.lineCap = 'round'; ctx.stroke(); ctx.restore();
    ctx.save();
    ctx.translate(0, dy + (pressed ? 2 : 0));
    const ic = Math.min(r.w * 0.78, r.h * 0.6);
    drawTouchIcon(ctx, t.id, r.x + r.w / 2, r.y + r.h * 0.4, ic, col, '#fffaf0');
    ctx.fillStyle = '#fffaf0'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    let fs = L.fs.pad; ctx.font = `700 ${fs}px ${FONT}`;
    while (ctx.measureText(t.short).width > r.w - 10 && fs > 10) { fs -= 1; ctx.font = `700 ${fs}px ${FONT}`; }
    ctx.fillText(t.short, r.x + r.w / 2, r.y + r.h - Math.max(10, r.h * 0.08));
    ctx.restore();
    if (lit) { ctx.save(); ctx.strokeStyle = '#fff3b0'; ctx.lineWidth = 4; roundPath(ctx, r.x - 3, r.y - 3, r.w + 6, r.h + 6, 20); ctx.stroke(); ctx.restore(); }
  });
}

function drawButtons(ctx, state, L, run, watch) {
  const bt = (r, label, o = {}) => {
    const { dy } = paintButton(ctx, r, o);
    ctx.save(); ctx.fillStyle = '#fff3d2'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    let fs = o.size || L.fs.btn; ctx.font = `700 ${fs}px ${FONT}`;
    while (ctx.measureText(label).width > r.w - 14 && fs > 10) { fs -= 1; ctx.font = `700 ${fs}px ${FONT}`; }
    ctx.fillText(label, r.x + r.w / 2, r.y + r.h / 2 + dy); ctx.restore();
  };
  if (watch) {
    const D = L.demo;
    bt(D.pause, state.paused ? 'Resume' : 'Pause', { primary: true });
    bt(D.dec, 'Shorter think', { dark: true, size: Math.round(L.fs.btn * 0.9) });
    bt(D.inc, 'Longer think', { dark: true, size: Math.round(L.fs.btn * 0.9) });
    bt(D.exit, 'Back to menu', { dark: true });
    return;
  }
  bt(L.pause, 'Pause', { dark: true });
  bt(L.think, 'Think', { active: !!state.think });
}

function drawPops(ctx, state, rig) {
  for (const f of state.fx) {
    const q = project(rig, f.x, f.y, f.z); if (!q) continue;
    const u = f.t / f.max;
    ctx.save(); ctx.globalAlpha = 1 - u; ctx.strokeStyle = f.col; ctx.lineWidth = Math.max(3, q.s * 0.06 * (1 - u));
    ctx.beginPath(); ctx.arc(q.x, q.y, q.s * (0.15 + 0.55 * u), 0, TAU); ctx.stroke(); ctx.restore();
  }
  for (const p of state.pops) {
    const q = project(rig, p.x, p.y, p.z); if (!q) continue;
    const u = p.t / p.max, y = q.y - u * 46, a = u < 0.15 ? u / 0.15 : Math.max(0, 1 - (u - 0.55) / 0.45);
    ctx.save(); ctx.globalAlpha = Math.max(0, Math.min(1, a)); ctx.font = `800 ${p.size}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(12,16,32,0.8)'; ctx.lineJoin = 'round'; ctx.strokeText(p.text, Math.max(70, Math.min(W - 70, q.x)), y);
    ctx.fillStyle = p.col; ctx.fillText(p.text, Math.max(70, Math.min(W - 70, q.x)), y);
    ctx.restore();
  }
}

function drawBanner(ctx, state, L) {
  const b = state.banner; if (!b) return;
  const u = b.t / b.max, a = u < 0.15 ? u / 0.15 : u > 0.75 ? Math.max(0, 1 - (u - 0.75) / 0.25) : 1;
  const cx = L.land ? L.stage.x + L.stage.w / 2 : W / 2, cy = L.land ? H * 0.2 : L.stage.y + L.stage.h * 0.1;
  ctx.save(); ctx.globalAlpha = a; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const sz = Math.round(Math.min(L.land ? L.stage.w : W, 760) * 0.085);
  ctx.font = `italic 800 ${sz}px ${DISPLAY}`; ctx.lineWidth = 8; ctx.strokeStyle = 'rgba(12,16,32,0.85)'; ctx.lineJoin = 'round';
  ctx.strokeText(b.text, cx, cy); ctx.fillStyle = b.col || '#ffd97a'; ctx.fillText(b.text, cx, cy);
  if (b.sub) { ctx.font = `700 ${Math.round(sz * 0.4)}px ${FONT}`; textShadow(ctx, b.sub, cx, cy + sz * 0.7, '#fff6e0', 5); }
  ctx.restore();
}

function drawToast(ctx, state, L) {
  if (!(state.toastT > 0) || !state.toast) return;
  const fs = L.fs.toast, w = Math.min((L.land ? L.stage.w : W) - 40, 640), cx = L.land ? L.stage.x + L.stage.w / 2 : W / 2;
  ctx.save(); ctx.font = `600 ${fs}px ${FONT}`;
  const lines = []; let line = '';
  for (const word of state.toast.split(' ')) { const nx = line ? `${line} ${word}` : word; if (line && ctx.measureText(nx).width > w - 36) { lines.push(line); line = word; } else line = nx; }
  if (line) lines.push(line);
  const h = lines.length * fs * 1.25 + 22, y = L.land ? H - 24 - h : L.padTop - 16 - h;
  ctx.globalAlpha = Math.min(1, state.toastT * 2);
  lacquerPlate(ctx, cx - w / 2, y, w, h, 18, 'dark');
  ctx.fillStyle = '#fff6e0'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  lines.forEach((l, i) => ctx.fillText(l, cx, y + 11 + fs * 0.62 + i * fs * 1.25));
  ctx.restore();
}

// Think / Watch caption: the advice for the next touch, drawn over the ring.
function drawAdvice(ctx, state, L, run) {
  const text = state.dec && state.dec.active ? (state.dec.phase === 'think' ? `Thinking… ${Math.max(0, Math.ceil(state.dec.dur - state.dec.t))} s` : state.dec.phase === 'reveal' ? state.dec.adv.reason : '') : (state.think && state.think.adv ? state.think.adv.reason : '');
  if (!text) return;
  const w = Math.min((L.land ? L.stage.w : W) - 36, 660), cx = L.land ? L.stage.x + L.stage.w / 2 : W / 2, fs = Math.round(L.fs.toast * 0.95);
  ctx.save(); ctx.font = `600 ${fs}px ${FONT}`;
  const lines = []; let line = '';
  for (const word of text.split(' ')) { const nx = line ? `${line} ${word}` : word; if (line && ctx.measureText(nx).width > w - 32) { lines.push(line); line = word; } else line = nx; }
  if (line) lines.push(line);
  const h = lines.length * fs * 1.25 + 20, y = L.land ? 14 + host.t : L.stage.y + 6;
  lacquerPlate(ctx, cx - w / 2, y, w, h, 16, 'dark');
  ctx.fillStyle = '#ffeec4'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  lines.forEach((l, i) => ctx.fillText(l, cx, y + 10 + fs * 0.62 + i * fs * 1.25));
  ctx.restore();
}

export function renderPlay(ctx, state) {
  const run = state.run, L = layoutOf(state), rig = stageRig(state, L), watch = run.mode === 'watch';
  ctx.clearRect(0, 0, W, H);
  if (!state.has3d) drawScene2D(ctx, run, rig);
  else {
    // soft top and bottom shades so the HUD reads over the picture
    const g = ctx.createLinearGradient(0, 0, 0, H * 0.3); g.addColorStop(0, 'rgba(8,12,30,0.45)'); g.addColorStop(1, 'rgba(8,12,30,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H * 0.3);
    if (!L.land) { const g2 = ctx.createLinearGradient(0, L.padTop - 40, 0, H); g2.addColorStop(0, 'rgba(8,12,30,0)'); g2.addColorStop(0.3, 'rgba(8,12,30,0.62)'); g2.addColorStop(1, 'rgba(8,12,30,0.8)'); ctx.fillStyle = g2; ctx.fillRect(0, L.padTop - 40, W, H - L.padTop + 40); }
    else { const g2 = ctx.createLinearGradient(L.px0 - 30, 0, L.px0 + 10, 0); g2.addColorStop(0, 'rgba(8,12,30,0)'); g2.addColorStop(1, 'rgba(8,12,30,0.72)'); ctx.fillStyle = g2; ctx.fillRect(L.px0 - 30, 0, W - L.px0 + 30, H); }
  }
  drawRing(ctx, state, L, run, rig);
  drawPops(ctx, state, rig);
  drawScore(ctx, state, L, run);
  drawCues(ctx, state, L, run);
  if (!watch) drawPads(ctx, state, L, run);
  drawButtons(ctx, state, L, run, watch);
  drawAdvice(ctx, state, L, run);
  drawBanner(ctx, state, L);
  drawToast(ctx, state, L);
  if (run.phase === 'end') {
    const cx = L.land ? L.stage.x + L.stage.w / 2 : W / 2;
    ctx.save(); ctx.textAlign = 'center'; ctx.font = `italic 800 ${Math.round(Math.min(W, 640) * 0.1)}px ${DISPLAY}`; textShadow(ctx, 'Beautifully danced', cx, L.land ? H * 0.3 : L.stage.y + L.stage.h * 0.18, '#ffe7a0', 6); ctx.restore();
  }
  void harmony; void stars; void COMBOS;
}
