// The play screen: the scene, the two balance bars, the score chip, the momentum bar and the control pad. Pure drawing;
// game.js owns state.
import { TEXT_SCALES, playLayout, sceneRect, meta } from './layout.js';
import { TUNE, VENUES, RIVALS, BOUTS, limitAt } from './sim.js';
import { THEMES, drawBackdrop, drawLog, drawLogWater, drawBirler, roundRectPath, LOG, glState } from './art.js';
import { FONT, DISPLAY, drawButton, textShadow, wrapLines, ease, plaque } from './ui.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const layoutOf = (state) => playLayout(Math.min(1.6, TEXT_SCALES[state.settings.textIdx]), !!(state.run && state.run.mode === 'watch'));
const YOU = '#ffcf5a', RIV = '#5fe0d0';

// ---- the scene (sky, water, log, people); used by play and by the menu backdrop ----------------------------------------------
// o: { fx, t }
export function drawScene(ctx, stage, w, t, o = {}) {
  const th = THEMES[w.venue], fx = o.fx;
  if (!o.mini) {
    // the 3D layer draws the pond, log and people behind this transparent canvas: it only needs to know where and which world
    glState.band = { x: stage.x, y: stage.y, w: stage.w, h: stage.h, wl: stage.wl, clear: stage.clear }; glState.world = w;
    if (glState.gl) return glState.gl.sr || sceneRect(stage);
  }
  const sr = sceneRect(stage);
  ctx.save();
  ctx.beginPath(); ctx.rect(stage.x, stage.y, stage.w, stage.h); ctx.clip();
  drawBackdrop(ctx, stage, sr, th, t);
  ctx.save();
  ctx.translate(sr.x, sr.y); ctx.scale(sr.s, sr.s);
  if (fx && fx.shake > 0) ctx.translate(Math.sin(t * 90) * fx.shake * 5, Math.cos(t * 77) * fx.shake * 4);
  drawLog(ctx, w, t);
  drawBirler(ctx, w, 1, t);
  drawBirler(ctx, w, 0, t);
  drawLogWater(ctx, w, th, t);
  // a ring of light where a kick landed
  if (fx) for (const f of fx.flash) {
    const a = 1 - f.t / f.max;
    ctx.strokeStyle = `rgba(255,244,190,${a})`; ctx.lineWidth = 6 * a + 1;
    ctx.beginPath(); ctx.ellipse(f.x, LOG.top + 40, 30 + f.t * 220, 10 + f.t * 60, 0, 0, TAU); ctx.stroke();
  }
  ctx.restore();
  ctx.restore();
  return sr;
}

// ---- HUD ----------------------------------------------------------------------------------------------------------------------
function hudText(ctx, text, x, y, size, o = {}) {
  ctx.font = `${o.weight ?? 700} ${size}px ${o.font ?? FONT}`; ctx.textAlign = o.align ?? 'center'; ctx.textBaseline = o.base ?? 'middle';
  if (o.shadow !== false) textShadow(ctx, text, x, y, o.col ?? '#ffffff', 5); else { ctx.fillStyle = o.col ?? '#ffffff'; ctx.fillText(text, x, y); }
}
function chip(ctx, r) { plaque(ctx, r.x, r.y, r.w, r.h, { r: Math.min(20, r.h / 2) }); }

// A domed brass-rimmed knob (marker / handle)
function knob(ctx, x, y, r, col) {
  ctx.save();
  ctx.fillStyle = 'rgba(2,8,18,0.45)'; ctx.beginPath(); ctx.ellipse(x, y + r * 0.35, r * 1.0, r * 0.8, 0, 0, TAU); ctx.fill();
  const rim = ctx.createLinearGradient(0, y - r, 0, y + r); rim.addColorStop(0, '#fff0b8'); rim.addColorStop(1, '#7a5a22');
  ctx.fillStyle = rim; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.4, r * 0.1, x, y, r * 0.8);
  g.addColorStop(0, '#ffffff'); g.addColorStop(0.35, col); g.addColorStop(1, '#2a2a2a');
  ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, r * 0.78, 0, TAU); ctx.fill();
  ctx.globalAlpha = 0.55; ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 0.78, 0, TAU); ctx.fill();
  ctx.restore();
}

// A balance bar: lean from the centre, the safe zone shrinking in the closing seconds.
function drawBalance(ctx, r, lean, thr, who, col, danger) {
  const h = r.h, pad = 8;
  plaque(ctx, r.x, r.y, r.w, h, { r: h / 2 });
  const x0 = r.x + pad, w = r.w - 2 * pad, cx = x0 + w / 2, by = r.y + h * 0.66, bh = Math.max(8, h * 0.28);
  ctx.save(); roundRectPath(ctx, x0, by - bh / 2, w, bh, bh / 2); ctx.clip();
  ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.fillRect(x0, by - bh / 2, w, bh);
  const g = ctx.createLinearGradient(x0, 0, x0 + w, 0); g.addColorStop(0, '#e24b3a'); g.addColorStop(0.2, '#f2b43a'); g.addColorStop(0.4, '#4fd07a'); g.addColorStop(0.6, '#4fd07a'); g.addColorStop(0.8, '#f2b43a'); g.addColorStop(1, '#e24b3a');
  ctx.globalAlpha = 0.65; ctx.fillStyle = g; ctx.fillRect(x0 + w * (0.5 - thr / 2), by - bh / 2, w * thr, bh); ctx.globalAlpha = 1;
  ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(x0, by - bh / 2, w * (0.5 - thr / 2), bh); ctx.fillRect(x0 + w * (0.5 + thr / 2), by - bh / 2, w * (0.5 - thr / 2), bh);
  ctx.restore();
  ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fillRect(cx - 1, by - bh / 2 - 3, 2, bh + 6);
  const mx = cx + clamp(lean / 1, -1, 1) * (w / 2) * 0.98;
  knob(ctx, mx, by, bh * 0.95, danger ? '#ff6a4a' : col);
  hudText(ctx, who, x0 + 4, r.y + h * 0.26, Math.max(12, Math.round(h * 0.36)), { align: 'left', weight: 800, col, shadow: false });
}

function drawMomentum(ctx, r, w, fs, ready, hintKick) {
  chip(ctx, r);
  const pad = 14, bh = Math.max(16, r.h * 0.34), bx = r.x + pad, bw = r.w - 2 * pad, by = r.y + r.h - pad * 0.5 - bh - 2;
  hudText(ctx, 'MOMENTUM', bx, r.y + r.h * 0.26, Math.max(10, Math.round(fs.lab * 0.62)), { align: 'left', weight: 800, col: 'rgba(200,230,255,0.85)', shadow: false });
  const m = w.mom[0], can = m >= TUNE.cost && w.cd[0] <= 0 && w.phase === 'go';
  const lfs = Math.max(10, Math.round(fs.lab * 0.62)), rfs = Math.max(11, Math.round(fs.lab * 0.72));
  ctx.font = `800 ${lfs}px ${FONT}`; const leftW = ctx.measureText('MOMENTUM').width;
  const full = can ? 'Kick ready: tap a side of the pad' : m >= TUNE.cost ? 'Kick resting…' : 'Stand steady to fill it';
  const short = can ? 'Kick ready' : m >= TUNE.cost ? 'Resting…' : 'Fill it';
  ctx.font = `700 ${rfs}px ${FONT}`;
  const label = ctx.measureText(full).width + leftW + 16 > bw ? short : full;
  hudText(ctx, label, bx + bw, r.y + r.h * 0.26, rfs, { align: 'right', weight: 700, col: can ? '#9be8b0' : '#ffe9a0', shadow: false });
  roundRectPath(ctx, bx, by, bw, bh, bh / 2); ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fill();
  ctx.save(); roundRectPath(ctx, bx, by, bw, bh, bh / 2); ctx.clip();
  const g = ctx.createLinearGradient(0, by, 0, by + bh); g.addColorStop(0, can ? '#c8ffd8' : '#a8d8ff'); g.addColorStop(1, can ? '#2fae5e' : '#3a86d8');
  ctx.fillStyle = g; ctx.fillRect(bx, by, bw * clamp(m, 0, 1), bh);
  ctx.restore();
  // the cost marks: one tick per kick the bar can pay for
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  for (let k = 1; k * TUNE.cost < 1.001; k++) ctx.fillRect(bx + bw * k * TUNE.cost - 1, by - 2, 2, bh + 4);
  ctx.lineWidth = 2; ctx.strokeStyle = hintKick && can ? '#fff1a0' : 'rgba(190,225,255,0.45)'; roundRectPath(ctx, bx, by, bw, bh, bh / 2); ctx.stroke();
  void ready;
}

// The pad: two halves to tap (tip the rival left or right) and a dragging handle (lean).
function drawPad(ctx, r, state, fs, w) {
  const watch = state.run.mode === 'watch', can = w.phase === 'go' && w.mom[0] >= TUNE.cost && w.cd[0] <= 0;
  const hint = state.hint, ctl = state.steer || 0;
  plaque(ctx, r.x, r.y, r.w, r.h, { r: 22, alpha: 0.9 });
  ctx.save(); roundRectPath(ctx, r.x, r.y, r.w, r.h, 22); ctx.clip();
  const half = r.w / 2;
  for (let k = 0; k < 2; k++) {
    const x = r.x + k * half, tip = k === 0 ? -1 : 1, pulse = 0.5 + 0.5 * Math.sin(state.t * 6);
    const rec = hint && hint.kick === tip, flash = state.padFlash && state.padFlash.tip === tip ? 1 - state.padFlash.t / 0.35 : 0;
    const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
    g.addColorStop(0, can ? 'rgba(60,140,210,0.55)' : 'rgba(60,90,120,0.3)'); g.addColorStop(1, can ? 'rgba(30,80,150,0.55)' : 'rgba(30,50,70,0.3)');
    ctx.fillStyle = g; ctx.fillRect(x + 3, r.y + 3, half - 6, r.h - 6);
    if (rec) { ctx.fillStyle = `rgba(255,236,130,${0.25 + 0.25 * pulse})`; ctx.fillRect(x + 3, r.y + 3, half - 6, r.h - 6); }
    if (flash > 0) { ctx.fillStyle = `rgba(255,255,255,${0.45 * flash})`; ctx.fillRect(x + 3, r.y + 3, half - 6, r.h - 6); }
    // arrow
    const ax = x + half / 2, ay = r.y + r.h * 0.34, sz = Math.min(half, r.h) * 0.16;
    ctx.fillStyle = can ? '#ffffff' : 'rgba(255,255,255,0.45)';
    ctx.beginPath(); ctx.moveTo(ax + tip * sz, ay); ctx.lineTo(ax - tip * sz * 0.2, ay - sz * 0.9); ctx.lineTo(ax - tip * sz * 0.2, ay - sz * 0.35); ctx.lineTo(ax - tip * sz * 1.1, ay - sz * 0.35); ctx.lineTo(ax - tip * sz * 1.1, ay + sz * 0.35); ctx.lineTo(ax - tip * sz * 0.2, ay + sz * 0.35); ctx.lineTo(ax - tip * sz * 0.2, ay + sz * 0.9); ctx.closePath(); ctx.fill();
    hudText(ctx, tip < 0 ? 'Tap: tip left' : 'Tap: tip right', ax, r.y + r.h * 0.58, Math.max(12, Math.round(fs.lab * 0.95)), { weight: 800, col: can ? '#ffffff' : 'rgba(255,255,255,0.5)', shadow: false });
  }
  ctx.fillStyle = 'rgba(190,225,255,0.3)'; ctx.fillRect(r.x + half - 1, r.y + 10, 2, r.h - 20);
  ctx.restore();
  // steering track with the handle (and the advised handle)
  const ty = r.y + r.h * 0.83, tx0 = r.x + r.w * 0.12, tw = r.w * 0.76, tc = tx0 + tw / 2;
  roundRectPath(ctx, tx0, ty - 5, tw, 10, 5); ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillRect(tc - 1.5, ty - 11, 3, 22);
  hudText(ctx, '◀ lean', tx0 + 2, ty - r.h * 0.12, Math.max(10, Math.round(fs.lab * 0.7)), { align: 'left', weight: 700, col: 'rgba(200,230,255,0.75)', shadow: false });
  hudText(ctx, 'lean ▶', tx0 + tw - 2, ty - r.h * 0.12, Math.max(10, Math.round(fs.lab * 0.7)), { align: 'right', weight: 700, col: 'rgba(200,230,255,0.75)', shadow: false });
  const cfs = Math.max(10, Math.round(fs.lab * 0.7));
  ctx.font = `700 ${cfs}px ${FONT}`;
  const sideW = Math.max(ctx.measureText('◀ lean').width, ctx.measureText('lean ▶').width) + 8;
  const full = watch ? 'the game plays your side' : 'drag to lean';
  const cLabel = ctx.measureText(full).width / 2 + sideW > tw / 2 ? (watch ? 'auto' : 'lean') : full;
  hudText(ctx, cLabel, tc, ty - r.h * 0.12, Math.max(10, Math.round(fs.lab * 0.7)), { weight: 700, col: 'rgba(200,230,255,0.75)', shadow: false });
  if (hint) {
    const hx = tc + clamp(hint.c, -1, 1) * tw / 2, pulse = 0.5 + 0.5 * Math.sin(state.t * 6);
    ctx.strokeStyle = `rgba(255,236,130,${0.7 + 0.3 * pulse})`; ctx.lineWidth = 4; ctx.setLineDash([6, 5]);
    ctx.beginPath(); ctx.arc(hx, ty, Math.max(16, r.h * 0.1) + pulse * 3, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
  }
  const hx = tc + clamp(ctl, -1, 1) * tw / 2, hr = Math.max(14, r.h * 0.085);
  knob(ctx, hx, ty, hr * 1.1, Math.abs(ctl) > 0.02 ? '#ffd24a' : '#e6f0fa');
}

export function renderPlay(ctx, state) {
  const L = layoutOf(state), w = state.ws, run = state.run, t = state.t, watch = run.mode === 'watch', fs = L.fs;
  const sr = drawScene(ctx, L.stage, w, t, { fx: state.fx });
  const R = RIVALS[w.rival];

  // balance bars across the top of the stage
  const bh = Math.max(40, Math.round(fs.small * 2.4)), gap = 12, bw = (L.stage.w - 2 * Math.max(14, L.M || 14) - gap) / 2, bx = L.stage.x + Math.max(14, L.M || 14), by = L.stage.y + 10 + (L.land ? 0 : 0) + (L.backClear && L.land ? 0 : 0);
  const thr = w.phase === 'go' || w.phase === 'fall' ? limitAt(w.t) : TUNE.limit;
  const danger = (i) => w.phase === 'go' && Math.abs(w.l[i]) > thr * 0.8;
  const yl = L.land ? Math.max(bx, L.backClear || 0) : bx;
  const bwL = (L.stage.x + L.stage.w - Math.max(14, L.M || 14) - yl - gap) / 2;
  drawBalance(ctx, { x: yl, y: by, w: bwL, h: bh }, w.l[0], thr, 'YOU', YOU, danger(0));
  drawBalance(ctx, { x: yl + bwL + gap, y: by, w: bwL, h: bh }, w.l[1], thr, R.name.toUpperCase(), RIV, danger(1));
  void bw;
  meta.previewBadge = { x: L.stage.x + L.stage.w / 2, y: by + bh + 8, align: 'center' };   // under the balance bars, clear of the HUD

  // score chip
  chip(ctx, L.score);
  const cx = L.score.x + L.score.w / 2;
  const mid = w.practice ? `${w.survive.toFixed(1)} s` : `${w.score[0]} : ${w.score[1]}`;
  hudText(ctx, mid, cx, L.score.y + L.score.h * 0.42, fs.big, { font: DISPLAY, weight: 800, col: '#ffffff' });
  const sub = w.practice ? `Practice · ${VENUES[w.venue].name}` : w.over ? 'Match over' : `${VENUES[w.venue].name} · bout ${Math.min(w.bout, w.bouts)} of ${w.bouts} · ${w.t.toFixed(0)} s`;
  hudText(ctx, sub, cx, L.score.y + L.score.h - fs.small * 1.15, fs.small, { weight: 600, col: 'rgba(225,240,255,0.88)' });

  if (!watch) {
    drawButton(ctx, L.pause, 'Pause', { dark: true, size: fs.btn });
    drawButton(ctx, L.think, state.hint ? 'Hide' : 'Think', { dark: true, size: fs.btn, active: !!state.hint });
  } else {
    const D = L.demo, st = state.settings, dis = st.thinkIdx;
    drawButton(ctx, D.dec, '−', { dark: true, size: fs.btn, disabled: dis === 0 });
    drawButton(ctx, D.pause, state.paused ? 'Resume' : 'Pause', { primary: !state.paused, active: state.paused, size: fs.btn });
    drawButton(ctx, D.inc, '+', { dark: true, size: fs.btn, disabled: dis >= 3 });
    drawButton(ctx, D.exit, 'Exit', { dark: true, size: fs.btn });
  }
  drawMomentum(ctx, L.mom, w, fs, true, !!(state.hint && state.hint.kick));
  drawPad(ctx, L.pad, state, fs, w);

  // floating words
  for (const p of state.pops) {
    const a = p.t / p.max, py = glState.gl ? -45 + (p.y - 190) : p.y, x = sr.x + p.x * sr.s, y = sr.y + (py - a * 60) * sr.s;
    ctx.save(); ctx.globalAlpha = Math.max(0, 1 - a * a); hudText(ctx, p.text, x, y, Math.round(34 * p.size * clamp(sr.s * 1.2, 0.8, 1.4)), { font: DISPLAY, weight: 800, col: p.col }); ctx.restore();
  }
  // banner (bout won, get set, go)
  if (state.banner) {
    const b = state.banner, a = b.t / b.max, k = a < 0.14 ? ease.outBack(a / 0.14) : 1, o = a > 0.8 ? 1 - (a - 0.8) / 0.2 : 1;
    const size = Math.round(clamp(L.stage.w * 0.1, 40, 84));
    ctx.save(); ctx.globalAlpha = o; ctx.translate(L.stage.x + L.stage.w / 2, L.stage.y + Math.max(size * 1.6, L.stage.h * 0.2)); ctx.scale(k, k);
    ctx.font = `800 ${size}px ${DISPLAY}`;
    const tw = ctx.measureText(b.text).width + 60, th = size * 1.9 + (b.sub ? 40 : 0);
    roundRectPath(ctx, -tw / 2, -th * 0.42, tw, th, 24); ctx.fillStyle = 'rgba(8,18,30,0.78)'; ctx.fill();
    hudText(ctx, b.text, 0, 0, size, { font: DISPLAY, weight: 800, col: b.col });
    if (b.sub) hudText(ctx, b.sub, 0, size * 0.78, Math.round(Math.max(18, fs.mid)), { weight: 700, col: '#ffffff' });
    ctx.restore();
  }
  // notes: Think text, Watch & Learn status, toast
  if (state.hint && !watch) drawNote(ctx, L.stage, state.hint.why, '#ffe9a0');
  else if (watch && state.dec) {
    const d = state.dec, left = Math.max(0, d.dur - d.t);
    const msg = d.phase === 'think' ? `Thinking… ${Math.ceil(left)} s` : d.phase === 'reveal' ? `Plan: ${d.why}` : 'Doing it…';
    drawNote(ctx, L.stage, msg, '#ffe9a0');
  } else if (state.toastT > 0 && state.toast) drawNote(ctx, L.stage, state.toast, '#ffffff');
  if (state.paused && watch) {
    ctx.fillStyle = 'rgba(6,14,24,0.45)'; ctx.fillRect(L.stage.x, L.stage.y, L.stage.w, L.stage.h);
    hudText(ctx, 'Paused', L.stage.x + L.stage.w / 2, L.stage.y + L.stage.h / 2, 64, { font: DISPLAY, weight: 800, col: '#ffffff' });
  }
  void BOUTS; void wrapLines;
}

function drawNote(ctx, st, text, col) {
  const size = Math.max(15, Math.round(st.w * 0.032)), pad = 12;
  ctx.font = `700 ${size}px ${FONT}`;
  const lines = wrapLines(ctx, text, st.w - 70), h = lines.length * size * 1.25 + pad * 2, w = Math.min(st.w - 24, Math.max(...lines.map((l) => ctx.measureText(l).width)) + pad * 2 + 6);
  const x = st.x + (st.w - w) / 2, y = st.y + st.h - h - 10;
  roundRectPath(ctx, x, y, w, h, 14); ctx.fillStyle = 'rgba(8,18,30,0.86)'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(190,225,255,0.5)'; ctx.stroke();
  ctx.fillStyle = col; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  lines.forEach((l, i) => ctx.fillText(l, st.x + st.w / 2, y + pad + size * 0.65 + i * size * 1.25));
}
