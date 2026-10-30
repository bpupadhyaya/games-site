// The play screen: the street, HUD, rope strip, HOP pad, count-in, call card, guide ring, the Watch and Learn sheet, popups and pause menu.
import { PAL, DISPLAY, drawPassDot, drawTrickIcon, drawCoil, drawParticles, clamp, TAU, smooth } from './art.js';
import { txt, button, panel, rrect, chip, icon } from './ui.js';
import { drawStreet } from './stage.js';
import { geo3 } from './stage3d.js';
import { menuRects } from './layout.js';
import { TRICKS, TRICK_BY_ID, LIVES, COUNT_IN, THINK, comboMult, airOf } from './moves.js';

const JCOL = { perfect: '#ffc83d', good: '#7be26a', ok: '#8fd8ff', miss: '#ff5a5f' };

// The rope phase: pass n happens when Theta reaches n + 1.
export function thetaOf(r, stT) {
  if (r.phase !== 'play') return stT * 1.25;
  const n = r.nextHit, ps = r.passes, tPrev = n > 0 ? ps[n - 1].t : 0, tNext = ps[n] ? ps[n].t : tPrev + r.rt.beat;
  return n + clamp((r.t - tPrev) / Math.max(1e-3, tNext - tPrev), 0, 1.2);
}
export function pulseOf(r) {
  if (r.phase !== 'play') return 0;
  const n = r.nextHit, tPrev = n > 0 ? r.passes[n - 1].t : -9;
  return Math.pow(Math.max(0, 1 - (r.t - tPrev) / 0.22), 2);
}

// The rope strip: every pass as a mark sliding towards the NOW line. Marks fade out with the colour of their judgement.
function renderStrip(ctx, st, r, T) {
  panel(ctx, T, { wood: true, fill: 'rgba(26,15,51,0.9)', rad: 18 });
  ctx.save(); rrect(ctx, T, 18); ctx.clip();
  const beat = r.rt.beat, nowX = T.x + T.w * 0.17, ahead = 3.1 * beat * 2.2 / 2.2;
  const pps = (T.x + T.w - 14 - nowX) / (ahead + 0.5), cy = T.y + T.h * 0.5;
  const size = Math.min(T.h * 0.62, 70, Math.max(30, pps * beat * 0.8));
  const t = r.phase === 'play' ? r.t : 0;
  // the NOW line
  ctx.fillStyle = 'rgba(255,255,255,0.12)'; rrect(ctx, { x: nowX - size * 0.62, y: T.y + 8, w: size * 1.24, h: T.h - 16 }, 12); ctx.fill();
  ctx.fillStyle = 'rgba(255,244,228,0.85)'; ctx.fillRect(nowX - 1.5, T.y + 8, 3, T.h - 16);
  txt(ctx, 'NOW', nowX, T.y + 11, 12, PAL.gold, { align: 'center', weight: 800 });
  for (const p of r.passes) {
    const x = nowX + (p.t - t) * pps;
    if (x < T.x - size || x > T.x + T.w + size) continue;
    const done = p.scored && p.j, since = t - p.t;
    if (done && x < nowX - size * 2.5) continue;
    let a = 1; if (since > 0) a = clamp(1 - since / 0.9, 0, 1) * 0.9;
    ctx.save(); ctx.globalAlpha = a;
    if (!p.scored) {
      const label = String(COUNT_IN - p.n);
      ctx.fillStyle = 'rgba(255,255,255,0.14)'; ctx.beginPath(); ctx.arc(x, cy, size * 0.34, 0, TAU); ctx.fill();
      txt(ctx, label, x, cy, size * 0.46, PAL.gold, { align: 'center', weight: 800 });
    } else {
      const sc = Math.abs(x - nowX) < size * 0.6 && !p.j ? 1.12 : 1;
      drawPassDot(ctx, p, x, cy, size * sc);
      if (p.j) { ctx.lineWidth = 4; ctx.strokeStyle = JCOL[p.j]; ctx.beginPath(); ctx.arc(x, cy, size * 0.5, 0, TAU); ctx.stroke(); }
    }
    ctx.restore();
  }
  ctx.restore();
}

function renderHop(ctx, st, r, P) {
  const R = P.hop, live = r.mode !== 'auto' && r.phase === 'play';
  const next = r.scored.find((p) => !p.j);
  const near = next && live ? clamp(1 - Math.abs(next.t - airOf(next.gap) / 2 - r.t) / 0.25, 0, 1) : 0;
  const rad = Math.min(30, R.h * 0.22);
  ctx.save();
  ctx.fillStyle = 'rgba(6,2,16,0.45)'; rrect(ctx, { x: R.x, y: R.y + 6, w: R.w, h: R.h }, rad); ctx.fill();
  const g = ctx.createLinearGradient(0, R.y, 0, R.y + R.h);
  g.addColorStop(0, '#ff9d3a'); g.addColorStop(1, '#e8620a');
  ctx.fillStyle = g; rrect(ctx, { x: R.x, y: R.y, w: R.w, h: R.h - 2 }, rad); ctx.fill();
  if (near > 0) { ctx.fillStyle = `rgba(255,255,255,${0.35 * near})`; rrect(ctx, R, rad); ctx.fill(); }
  // hop mark and the four swipes
  const cx = R.x + R.w / 2, cy = R.y + R.h / 2, s = Math.min(R.h * 0.42, R.w * 0.22);
  const wide = R.w > R.h * 2.4;
  txt(ctx, 'TAP TO HOP', cx, cy - (wide ? 0 : R.h * 0.12), Math.min(R.h * 0.34, R.w * 0.11, 60), '#1a0f33', { align: 'center', weight: 800, maxW: R.w * 0.6 });
  const swy = wide ? cy : cy + R.h * 0.24;
  if (wide) {
    TRICKS.forEach((t, i) => drawTrickIcon(ctx, t.id, R.x + R.w * (i < 2 ? 0.09 + i * 0.1 : 0.81 + (i - 2) * 0.1), cy, Math.min(R.h * 0.46, 64), { fill: 'rgba(26,15,51,0.85)', arrow: t.col }));
  } else {
    const n = TRICKS.length, w = Math.min(s * 0.6, 44), gap = w * 0.45, tot = n * w + (n - 1) * gap;
    TRICKS.forEach((t, i) => drawTrickIcon(ctx, t.id, cx - tot / 2 + w / 2 + i * (w + gap), swy, w, { fill: 'rgba(26,15,51,0.85)', arrow: t.col }));
  }
  if (!live) { ctx.fillStyle = 'rgba(26,15,51,0.45)'; rrect(ctx, R, rad); ctx.fill(); }
  ctx.restore();
}

function renderHud(ctx, st, r, L) {
  const P = L.play, wide = L.mode === 'wide', S = L.S;
  const lx = S.x + 14 + L.backPad;
  const label = `${r.li + 1}. ${r.level.name}`.toUpperCase();
  const sw = S.w - L.backPad - (wide ? P.col.w + 40 : 250);
  txt(ctx, label, lx, P.strip.y + P.strip.h / 2, 34, PAL.text, { weight: 800, maxW: sw, stroke: 6 });
  ctx.font = `800 34px ${DISPLAY}`;
  const tw = Math.min(ctx.measureText(label).width, sw);
  if (r.mode !== 'play') chip(ctx, lx + tw + 14, P.strip.y + P.strip.h / 2, r.mode === 'auto' ? 'WATCH' : 'PRACTICE', 20, { fill: r.mode === 'auto' ? 'rgba(62,232,181,0.95)' : 'rgba(255,200,61,0.95)', color: '#1a0f33' });
  const H = P.hud, cy = H.y + H.h / 2;
  if (wide) panel(ctx, H, { wood: true, fill: 'rgba(26,15,51,0.9)', rad: 18 });
  const m = comboMult(r.combo);
  if (wide) {
    txt(ctx, String(r.score), H.x + H.w / 2, H.y + 50, 74, PAL.gold, { align: 'center', weight: 800, stroke: 8 });
    for (let i = 0; i < LIVES; i++) drawCoil(ctx, H.x + 46 + i * 62, H.y + H.h - 38, 52, r.mode === 'play' ? i < r.lives : true);
    if (r.combo >= 2) chip(ctx, H.x + H.w - 20, H.y + H.h - 38, `${r.combo}  x${m}`, 28, { align: 'right', fill: 'rgba(255,63,164,0.92)', color: '#fff' });
    if (r.mode !== 'play') txt(ctx, r.mode === 'auto' ? 'no tangles' : `${r.tangles} tangles`, H.x + 46 + LIVES * 62, H.y + H.h - 36, 20, PAL.dim, { weight: 700 });
  } else {
    for (let i = 0; i < LIVES; i++) drawCoil(ctx, H.x + 30 + i * 52, cy, 46, r.mode === 'play' ? i < r.lives : true);
    // score (and the streak chip) centred in the room between the coils and the Guide button, shrunk to fit on small phones
    const x0 = H.x + 30 + LIVES * 52 + 4, x1 = P.hint.x - 10, room = Math.max(60, x1 - x0);
    const combo = r.combo >= 2 ? `${r.combo} x${m}` : '', cs = 28;
    ctx.font = `700 ${cs}px ${DISPLAY}`; const chipW = combo ? ctx.measureText(combo).width + cs * 1.1 + 14 : 0;
    let fs = 64; ctx.font = `800 ${fs}px ${DISPLAY}`;
    let sw = ctx.measureText(String(r.score)).width; const gapC = combo ? 12 : 0;
    if (sw + gapC + chipW > room) { fs = Math.max(34, fs * (room - gapC - chipW) / sw); ctx.font = `800 ${fs}px ${DISPLAY}`; sw = ctx.measureText(String(r.score)).width; }
    const sx = x0 + Math.max(0, (room - (sw + gapC + chipW)) / 2);
    txt(ctx, String(r.score), sx + sw / 2, cy - 2, fs, PAL.gold, { align: 'center', weight: 800, stroke: 8 });
    if (combo) chip(ctx, sx + sw + gapC, cy, combo, cs, { fill: 'rgba(255,63,164,0.92)', color: '#fff', align: 'left' });
  }
  const hintIcon = r.mode === 'auto' ? (r.phase === 'think' ? 'play' : 'bulb') : 'bulb';
  const hintKind = r.mode === 'auto' ? (r.phase === 'think' ? 'gold' : 'disabled') : r.guide ? 'on' : 'quiet';
  if (wide) {
    button(ctx, P.hint, r.mode === 'auto' ? (r.phase === 'think' ? 'Skip' : 'Guide') : 'Guide', { icon: hintIcon, kind: hintKind, size: 30 });
    button(ctx, P.pause, 'Pause', { icon: 'pause', kind: 'quiet', size: 30 });
  } else {
    button(ctx, P.hint, '', { icon: hintIcon, kind: hintKind });
    button(ctx, P.pause, '', { icon: 'pause', kind: 'quiet' });
  }
}

// Watch and Learn: the whole routine laid out as rows of eight beats (THINK), lit one by one (REVEAL).
export function routineSheet(ctx, rt, x, y, w, h, o = {}) {
  const beats = rt.beats, cols = 8, rows = Math.ceil(beats / cols), cell = Math.min(w / cols, h / rows, 96);
  const ox = x + (w - cell * cols) / 2, oy = y + (h - cell * rows) / 2;
  const byBeat = new Map();
  rt.scored.forEach((p) => { if (!byBeat.has(p.beatIdx)) byBeat.set(p.beatIdx, []); byBeat.get(p.beatIdx).push(p); });
  const shown = o.shown ?? beats;
  for (let b = 0; b < beats; b++) {
    const ps = byBeat.get(b) ?? [], cx = ox + cell * (b % cols) + cell / 2, cy = oy + cell * Math.floor(b / cols) + cell / 2;
    ctx.save(); ctx.globalAlpha = b < shown ? 1 : 0.25;
    if (ps.length === 2) { drawPassDot(ctx, ps[0], cx - cell * 0.2, cy, cell * 0.5); drawPassDot(ctx, ps[1], cx + cell * 0.2, cy, cell * 0.5); }
    else if (ps[0]) drawPassDot(ctx, ps[0], cx, cy, cell * 0.82);
    ctx.restore();
    if (b % cols === 0) txt(ctx, String(b / cols + 1), ox - 4, cy, Math.max(12, cell * 0.22), PAL.dim, { align: 'right', weight: 800 });
  }
  return { cell, rows, h: rows * cell };
}
function renderRoutine(ctx, st, r, L) {
  const stg = L.play.stage, rt = r.rt;
  const W = Math.min(stg.w - 24, 760), rows = Math.ceil(rt.beats / 8), cell = Math.min((W - 40) / 8, 84);
  const pw = cell * 8 + 40, ph = rows * cell + 130;
  const x = stg.x + (stg.w - pw) / 2, y = stg.y + Math.max(8, (stg.h - ph) * 0.15);
  panel(ctx, { x, y, w: pw, h: ph }, { wood: true, fill: 'rgba(22,11,44,0.9)', rad: 22 });
  const left = r.phase === 'think' ? Math.max(0, st.prefs.thinkSec - r.phaseT) : Math.max(0, THINK.reveal - r.phaseT);
  txt(ctx, r.phase === 'think' ? 'THINK: READ THE ROUTINE' : 'REVEAL: HERE IT COMES', x + pw / 2, y + 36, 36, PAL.gold, { align: 'center', weight: 800, maxW: pw - 30 });
  txt(ctx, `${r.level.name}  -  ${rt.beats} beats  -  ${rt.calls} calls  -  ${Math.ceil(left)} s`, x + pw / 2, y + 74, 24, PAL.dim, { align: 'center', weight: 700, maxW: pw - 30 });
  const shown = r.phase === 'reveal' ? Math.floor((r.phaseT / THINK.reveal) * rt.beats * 1.05) : rt.beats;
  routineSheet(ctx, rt, x + 20, y + 100, pw - 40, rows * cell, { shown });
}

function renderPopups(ctx, r, head, g) {
  for (const p of r.pops) {
    const a = clamp(1 - p.age / 0.85, 0, 1), y = g.gy - g.k * 0.34 - p.age * 55 - (p.slot || 0) * 46;
    ctx.save(); ctx.globalAlpha = Math.min(1, a * 1.6);
    txt(ctx, p.text, head.hcx + head.headR * 3.4, y, 40 * p.size * (1 + 0.25 * Math.max(0, 1 - p.age * 6)), p.col, { align: 'left', weight: 800, stroke: 9 });
    ctx.restore();
  }
}

// The chalk card above the jumper: the next call, its arrow and the beat it comes.
function renderCall(ctx, st, r, head, g) {
  const p = r.scored.find((q) => q.call && (q.callOk === null) && (q.j === null || q.j !== 'miss') && q.t > r.t - 0.35);
  if (!p) return;
  const until = p.t - r.t, beats = until / r.rt.beat;
  if (beats > 2.3) return;
  const T = TRICK_BY_ID[p.call], w = Math.min(g.k * 0.9, 250), h = w * 0.42;
  const x = g.r.x + g.r.w / 2, y = g.r.y + h * 0.75 + 6;
  const pulse = until < 0.45 ? 1 + 0.08 * Math.sin(st.t * 28) : 1;
  ctx.save(); ctx.translate(x, y); ctx.scale(pulse, pulse);
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; rrect(ctx, { x: -w / 2 + 3, y: -h / 2 + 5, w, h }, h * 0.22); ctx.fill();
  ctx.fillStyle = '#231a33'; rrect(ctx, { x: -w / 2, y: -h / 2, w, h }, h * 0.22); ctx.fill();
  ctx.lineWidth = 4; ctx.strokeStyle = T.col; rrect(ctx, { x: -w / 2 + 3, y: -h / 2 + 3, w: w - 6, h: h - 6 }, h * 0.18); ctx.stroke();
  drawTrickIcon(ctx, p.call, -w / 2 + h * 0.6, 0, h * 0.7);
  txt(ctx, T.name.toUpperCase(), -w / 2 + h * 1.05, 0, h * 0.5, '#fff4e4', { weight: 800, maxW: w - h * 1.2 });
  ctx.restore();
}

// The guide: a ring that closes on the feet at the moment to tap.
function renderGuide(ctx, st, r, g) {
  const p = r.scored.find((q) => !q.j);
  if (!p) return;
  const d = p.t - airOf(p.gap) / 2 - r.t;
  if (d > 1.1 || d < -0.12) return;
  const f = clamp(d / 0.7, 0, 1), rad = g.k * (0.17 + 0.5 * f), on = d <= 0.04;
  ctx.save(); ctx.lineWidth = Math.max(4, g.k * 0.03); ctx.strokeStyle = on ? '#3ee8b5' : 'rgba(255,244,228,0.85)'; ctx.globalAlpha = 0.9;
  ctx.beginPath(); ctx.ellipse(g.jx, g.gy + 6, rad, rad * 0.32, 0, 0, TAU); ctx.stroke();
  if (on) { ctx.fillStyle = 'rgba(62,232,181,0.3)'; ctx.fill(); }
  ctx.restore();
}

let gGeo = null;
export function renderPlay(ctx, st, L, view, meta, pauseItems) {
  const r = st.run, P = L.play; meta.previewBadge = P.badge;
  const V = { Theta: thetaOf(r, st.t), tRun: r.phase === 'play' ? r.t : st.t * 0 + 0, J: r.J, pulse: pulseOf(r), hit: r.hit };
  if (r.phase !== 'play') { V.tRun = 0; V.J = { ...r.J, t0: -9 }; }
  ctx.save();
  if (r.shake > 0 && !st.prefs.calm) ctx.translate(Math.sin(st.t * 90) * 5 * r.shake, Math.cos(st.t * 70) * 3 * r.shake);
  let g, head;
  if (st.has3d) {      // the 3D presenter draws the street; the HUD only needs where the jumper stands
    g = geo3(P.stage); head = { hcx: g.jx, hcy: g.gy - g.k * 0.94, headR: g.k * 0.07 };
  } else ({ g, head } = drawStreet(ctx, L.w, L.h, P.stage, V, st.t));
  gGeo = g; if (!st.has3d) drawParticles(ctx, r.parts);
  if (r.mode !== 'auto' || r.phase === 'play') renderCall(ctx, st, r, head, g);
  if (r.guide && r.mode !== 'auto' && r.phase === 'play') renderGuide(ctx, st, r, g);
  renderPopups(ctx, r, head, g);
  ctx.restore();
  if (r.flash > 0.01 && !st.prefs.calm) { ctx.fillStyle = `rgba(255,236,190,${r.flash * 0.16})`; ctx.fillRect(0, 0, L.w, L.h); }
  if (L.mode === 'wide') panel(ctx, P.col, { fill: 'rgba(22,11,44,0.5)', rad: 22 });
  renderHud(ctx, st, r, L);
  renderStrip(ctx, st, r, P.sheet);
  renderHop(ctx, st, r, P);
  // count-in words
  if (r.phase === 'play' && r.t < r.rt.T0 + 0.5) {
    const n = r.nextHit - 1, words = ['READY', '3', '2', '1'];
    const word = r.t >= r.rt.T0 ? 'HOP!' : words[clamp(n, 0, 3)];
    const since = r.t - (n >= 0 && r.passes[n] ? r.passes[n].t : 0);
    const sc = 1 + 0.35 * Math.max(0, 1 - since * 4);
    ctx.save(); ctx.globalAlpha = r.t >= r.rt.T0 ? clamp(1 - (r.t - r.rt.T0) / 0.5, 0, 1) : 1;
    txt(ctx, word, P.stage.x + P.stage.w / 2, P.stage.y + P.stage.h * 0.24, Math.min(170, P.stage.h * 0.22) * sc, '#fff4e4', { align: 'center', weight: 800, stroke: 16, strokeColor: '#ff3fa4' });
    ctx.restore();
  }
  if (r.banner) {
    const a = clamp(Math.min(r.banner.t / 0.15, (1.4 - r.banner.t) / 0.3), 0, 1);
    ctx.save(); ctx.globalAlpha = a;
    const bs = Math.min(64, P.stage.w * 0.11), by = Math.min(P.stage.y + P.stage.h - bs * 0.6, gGeo.gy + bs * 0.75);
    txt(ctx, r.banner.text, P.stage.x + P.stage.w / 2, by, bs, PAL.gold, { align: 'center', weight: 800, stroke: 10 });
    ctx.restore();
  }
  if (r.mode === 'auto' && (r.phase === 'think' || r.phase === 'reveal')) renderRoutine(ctx, st, r, L);
  if (r.paused) {
    ctx.fillStyle = 'rgba(8,3,20,0.64)'; ctx.fillRect(0, 0, L.w, L.h);
    const items = pauseItems(r), M = menuRects(L, items.length);
    panel(ctx, M.panel, { wood: true, fill: 'rgba(26,15,51,0.9)' });
    txt(ctx, 'PAUSED', M.panel.x + M.panel.w / 2, M.panel.y + 64, 60, PAL.gold, { align: 'center', weight: 800, stroke: 8 });
    const names = { resume: 'Resume', restart: 'Restart', quit: 'Leave', replay: 'Watch again', next: 'Next block' };
    items.forEach((it, i) => button(ctx, M.btns[i], names[it], { kind: it === 'resume' ? 'primary' : 'quiet', size: 36, icon: it === 'resume' ? 'play' : it === 'restart' || it === 'replay' ? 'restart' : undefined }));
  }
}
void icon; void smooth;
