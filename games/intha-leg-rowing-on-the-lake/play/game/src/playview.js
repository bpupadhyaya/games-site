// The playing screen: the lake stage, the oar pad, the stroke meter, the HUD card, the track strip and the Watch and Learn cards.
// renderStage is also used for the live menu backdrop (the performer rowing a course behind the menus).
import { PAL, UI, DISPLAY, clamp, rgba, makeView, toScreen, drawScene } from './art.js';
import { txt, button, panel, rrect, chip, icon, minUnits } from './ui.js';
import { PHYS, standings, planFor, laneTarget } from './sim.js';
import { LOOKS } from './courses.js';
import { v3 } from './v3.js';

const TAU = Math.PI * 2;
export const GRADE_COL = { catch: '#ffe08a', gate: '#8ef0dc', miss: '#ffb08a', hit: '#ffb43c', fall: '#ff8a7a', swell: '#9fd8ff' };
export const ordinal = (i) => ['1st', '2nd', '3rd', '4th'][i] ?? `${i + 1}th`;
export function fmtTime(s) { const m = Math.floor(s / 60), r = s - m * 60; return `${m}:${r < 10 ? '0' : ''}${r.toFixed(1)}`; }

// ---- the stage ----------------------------------------------------------------------------------------------------------------------------
export function renderStage(ctx, st, stage, t, o = {}) {
  const W = st.W, me = W.boats[0];
  const V = makeView(stage, st.camS ?? me.s, st.camN ?? me.n);
  const live = v3.on && v3.live;                       // the 3D lake is drawn behind this canvas: only the overlays are drawn here
  const P = live ? (s, n, y = 0) => v3.proj(s, n, y) : (s, n) => toScreen(V, s, n);
  const ppm = live ? v3.ppm : V.ppm;
  ctx.save();
  ctx.beginPath(); ctx.rect(stage.x, stage.y, stage.w, stage.h); ctx.clip();
  if (st.shake > 0) ctx.translate((Math.sin(t * 91) * 0.5) * st.shake * 8, (Math.sin(t * 57) * 0.5) * st.shake * 6);
  if (!live) {
    let reveal = null;
    if (st.reveal) {
      const path = [];
      for (let s = me.s; s <= Math.min(W.course.length, me.s + 26); s += 1.5) path.push([s, laneTarget(W, me, s)]);
      reveal = { path, target: st.reveal.target };
    }
    drawScene(ctx, V, W, t, st.parts, { reveal });
  }
  // the poise ring round the rower when balance runs low
  if (!o.noHud && me.poise < 0.7 && !me.finished) {
    const p = P(me.s - 1.75 * Math.cos(me.h), me.n - 1.75 * Math.sin(me.h), 0.9), r = (live ? 0.9 : 0.8) * ppm;
    const col = me.poise < 0.3 ? '#ff5a4a' : '#ffb43c', pulse = 0.55 + 0.45 * Math.sin(t * (me.poise < 0.3 ? 14 : 8));
    ctx.strokeStyle = rgba(col, 0.35 + 0.55 * pulse); ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(p.x, p.y, r, -Math.PI / 2, -Math.PI / 2 + TAU * clamp(me.poise, 0.02, 1)); ctx.stroke();
  }
  // name tags: you, and rivals in view
  for (const b of W.boats) {
    const inView = Math.abs(b.s - V.cs) < Math.max(V.ahead, V.behind) * 0.95 && Math.abs(b.n - V.cn) < V.lat * 0.95;
    if ((!inView && !live) || st.menuMode) continue;
    if (b.id !== 0 && b.finished) continue;
    const p = P(b.s - 0.2, b.n, live ? 2.7 : 0);
    if (p.x < stage.x || p.x > stage.x + stage.w || p.y < stage.y || p.y > stage.y + stage.h) continue;
    const label = b.id === 0 ? 'YOU' : b.name;
    chip(ctx, p.x, live ? p.y : p.y, label, Math.max(13, live ? 17 : 0.3 * ppm), { align: 'center', fill: b.id === 0 ? 'rgba(255,196,60,0.94)' : 'rgba(10,30,44,0.72)', color: b.id === 0 ? '#2a1606' : PAL.text });
  }
  // pops
  for (const pop of st.pops) {
    const a = 1 - pop.age / 1.0, p = P(pop.s, pop.n, live ? 1.5 : 0);
    ctx.save(); ctx.globalAlpha = clamp(a * 1.6, 0, 1);
    txt(ctx, pop.text, p.x, p.y - 20 - pop.age * 50, pop.size, pop.col, { align: 'center', font: DISPLAY, weight: 700, stroke: 7, maxW: stage.w - 40 });
    ctx.restore();
  }
  ctx.restore();
  return V;
}

// ---- pad and stroke meter -------------------------------------------------------------------------------------------------------------------
export function padX(r, a) { return r.x + r.w / 2 + clamp(a, -1.1, 1.1) * (r.w / 2 - 34); }
export function drawPad(ctx, r, me, st) {
  panel(ctx, r, { fill: 'rgba(8,36,52,0.78)', rad: 26, stroke: 'rgba(190,240,240,0.28)' });
  const cy = r.y + r.h * 0.52, x0 = r.x + 34, x1 = r.x + r.w - 34;
  // water lines
  ctx.save(); rrect(ctx, r, 26); ctx.clip();
  ctx.strokeStyle = 'rgba(160,230,240,0.12)'; ctx.lineWidth = 2;
  for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(r.x, r.y + r.h * (0.2 + i * 0.2)); ctx.quadraticCurveTo(r.x + r.w / 2, r.y + r.h * (0.12 + i * 0.2), r.x + r.w, r.y + r.h * (0.2 + i * 0.2)); ctx.stroke(); }
  ctx.restore();
  // bamboo rail
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 12; ctx.beginPath(); ctx.moveTo(x0, cy + 3); ctx.lineTo(x1, cy + 3); ctx.stroke();
  ctx.strokeStyle = '#d9b672'; ctx.lineWidth = 10; ctx.beginPath(); ctx.moveTo(x0, cy); ctx.lineTo(x1, cy); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x0, cy - 3); ctx.lineTo(x1, cy - 3); ctx.stroke();
  for (let i = -4; i <= 4; i++) {
    const x = r.x + r.w / 2 + i * (r.w / 2 - 34) / 4, big = i % 2 === 0;
    ctx.strokeStyle = i === 0 ? '#ffe08a' : 'rgba(255,245,220,0.55)'; ctx.lineWidth = i === 0 ? 4 : 2;
    ctx.beginPath(); ctx.moveTo(x, cy - (big ? 22 : 14)); ctx.lineTo(x, cy + (big ? 22 : 14)); ctx.stroke();
  }
  // the centre of your recent sweeps: this is where the boat steers to
  const ax = padX(r, me.aAvg);
  ctx.fillStyle = '#8ef0dc'; ctx.beginPath(); ctx.moveTo(ax, cy - 16); ctx.lineTo(ax + 10, cy - 34); ctx.lineTo(ax - 10, cy - 34); ctx.closePath(); ctx.fill();
  // the oar blade
  const bx = padX(r, me.a), active = me.inWater;
  ctx.fillStyle = active ? '#7a5a30' : 'rgba(122,90,48,0.55)';
  ctx.beginPath(); ctx.roundRect(bx - 11, cy - 30, 22, 60, 9); ctx.fill();
  ctx.strokeStyle = active ? '#ffe08a' : 'rgba(255,224,138,0.5)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(bx - 11, cy - 30, 22, 60, 9); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(bx - 3, cy - 24, 5, 46);
  txt(ctx, 'LEFT', x0 + 8, r.y + r.h - 16, 15, 'rgba(238,248,248,0.55)', { weight: 700 });
  txt(ctx, 'RIGHT', x1 - 8, r.y + r.h - 16, 15, 'rgba(238,248,248,0.55)', { align: 'right', weight: 700 });
  if (!active && st.t < 40) txt(ctx, 'Hold and drag left and right to scull', r.x + r.w / 2, r.y + 17, 17, '#fff7e6', { align: 'center', weight: 700, maxW: r.w - 30 });
  else if (active) txt(ctx, 'Sweep on the side you want to go', r.x + r.w / 2, r.y + 17, 16, 'rgba(255,247,230,0.7)', { align: 'center', weight: 600, maxW: r.w - 30 });
}
export function drawStrokeMeter(ctx, r, spd, active, frenzyZone = PHYS.FRENZY) {
  panel(ctx, r, { fill: 'rgba(8,36,52,0.7)', rad: r.h / 2 });
  ctx.font = `800 ${Math.max(14, minUnits())}px ${UI}`;
  const lw = Math.ceil(ctx.measureText('STROKE').width) + 26;
  const x0 = r.x + lw + 8, w = r.w - lw - 28, max = 9, y = r.y + r.h / 2, h = 12;
  txt(ctx, 'STROKE', r.x + 14, y, 14, PAL.dim, { weight: 800 });
  const zone = (a, b, col) => { ctx.fillStyle = col; rrect(ctx, { x: x0 + w * a / max, y: y - h / 2, w: w * (b - a) / max, h }, 3); ctx.fill(); };
  zone(0, 1.2, 'rgba(255,255,255,0.14)'); zone(1.2, 5.0, 'rgba(90,220,170,0.4)'); zone(5.0, frenzyZone, 'rgba(255,196,60,0.45)'); zone(frenzyZone, max, 'rgba(255,90,70,0.5)');
  const v = active ? Math.min(max, spd) : 0, col = v > frenzyZone ? '#ff5a4a' : v > 5 ? '#ffb43c' : '#8ef0dc';
  ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x0 + w * v / max, y, 9, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5; ctx.stroke();
}

// ---- the HUD -------------------------------------------------------------------------------------------------------------------------------
function drawTrack(ctx, r, W) {
  const C = W.course;
  ctx.save();
  ctx.fillStyle = 'rgba(8,36,52,0.72)'; rrect(ctx, r, r.h / 2); ctx.fill();
  const x0 = r.x + 18, x1 = r.x + r.w - 22, y = r.y + r.h / 2, X = (s) => x0 + (x1 - x0) * clamp(s / C.length, 0, 1);
  ctx.strokeStyle = 'rgba(200,240,240,0.3)'; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke();
  for (const w of C.swells) { ctx.strokeStyle = '#9fd8ff'; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(X(w.s0), y); ctx.lineTo(X(w.s1), y); ctx.stroke(); }
  for (const f of C.fences) { ctx.strokeStyle = '#c99557'; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(X(f.s0), y); ctx.lineTo(X(f.s1), y); ctx.stroke(); }
  for (const h of C.hyac) { ctx.fillStyle = '#7fcf5a'; ctx.beginPath(); ctx.arc(X(h.s), y, 4, 0, TAU); ctx.fill(); }
  W.shoals.forEach((sh) => { if (sh.caught) return; ctx.fillStyle = '#ffe08a'; ctx.beginPath(); ctx.moveTo(X(sh.s), y - 7); ctx.lineTo(X(sh.s) + 4, y); ctx.lineTo(X(sh.s), y + 7); ctx.lineTo(X(sh.s) - 4, y); ctx.closePath(); ctx.fill(); });
  ctx.fillStyle = '#fff'; ctx.fillRect(x1 + 2, y - 11, 3, 22);
  ctx.fillStyle = '#e8452c'; ctx.beginPath(); ctx.moveTo(x1 + 5, y - 11); ctx.lineTo(x1 + 15, y - 6); ctx.lineTo(x1 + 5, y - 1); ctx.closePath(); ctx.fill();
  const bs = [...W.boats].sort((a, b) => (a.id === 0) - (b.id === 0));
  for (const b of bs) {
    const x = X(b.s), look = LOOKS[b.look] ?? LOOKS[0];
    ctx.fillStyle = look.shirt; ctx.beginPath(); ctx.arc(x, y, b.id === 0 ? 10 : 7.5, 0, TAU); ctx.fill();
    ctx.lineWidth = b.id === 0 ? 3.5 : 2; ctx.strokeStyle = b.id === 0 ? '#fff' : 'rgba(10,6,20,0.8)'; ctx.stroke();
  }
  ctx.restore();
}

function fishChip(ctx, x, y, size, n, quota, align = 'left') {
  const col = n >= quota ? '#8ef0dc' : '#ffe08a';
  ctx.save();
  ctx.fillStyle = col; ctx.translate(x + (align === 'right' ? -size * 2.1 : 0), y);
  ctx.beginPath(); ctx.ellipse(size * 0.55, 0, size * 0.55, size * 0.3, 0, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.moveTo(size * 1.0, 0); ctx.lineTo(size * 1.45, -size * 0.3); ctx.lineTo(size * 1.45, size * 0.3); ctx.closePath(); ctx.fill();
  ctx.restore();
  txt(ctx, `${n} / ${quota}`, x + (align === 'right' ? 0 : size * 1.7), y, size * 1.1, col, { weight: 800, align: align === 'right' ? 'right' : 'left' });
}

const MODE_NAME = { practice: 'Practice', race: 'Race', auto: 'Watch and Learn' };

export function renderPlay(ctx, st, L, view, meta, pauseItems, drawPauseMenu) {
  const P = L.play, W = st.W, me = W.boats[0], t = st.t, C = W.course;
  if (!(v3.on && v3.live)) { ctx.fillStyle = '#0c2a3a'; ctx.fillRect(0, 0, L.w, L.h); }
  renderStage(ctx, st, P.stage, t, {});
  // danger vignette
  if (me.poise < 0.3 && !me.finished && me.down <= 0) {
    const a = (0.3 - me.poise) * 1.6 * (0.5 + 0.5 * Math.sin(t * 14));
    ctx.save(); ctx.globalAlpha = clamp(a, 0, 0.5); ctx.strokeStyle = '#ff3a2a'; ctx.lineWidth = 28; ctx.strokeRect(P.stage.x + 4, P.stage.y + 4, P.stage.w - 8, P.stage.h - 8); ctx.restore();
  }
  // HUD card
  const place = standings(W).findIndex((b) => b.id === 0), sc = P.score;
  panel(ctx, sc, { fill: 'rgba(8,36,52,0.78)', rad: 20, stroke: 'rgba(190,240,240,0.25)' });
  const poiseBar = (x, y, w, h) => {
    txt(ctx, 'POISE', x, y, 14, PAL.dim, { weight: 800 });
    ctx.font = `800 ${Math.max(14, minUnits())}px ${UI}`;
    const lw = Math.ceil(ctx.measureText('POISE').width) + 12, bx = x + lw, bw = w - lw;
    ctx.fillStyle = 'rgba(255,255,255,0.12)'; rrect(ctx, { x: bx, y: y - h / 2, w: bw, h }, h / 2); ctx.fill();
    const k = clamp(me.poise, 0, 1), col = k < 0.3 ? '#ff5a4a' : k < 0.6 ? '#ffb43c' : '#8ef0dc';
    ctx.fillStyle = col; rrect(ctx, { x: bx, y: y - h / 2, w: Math.max(h, bw * k), h }, h / 2); ctx.fill();
  };
  if (L.mode === 'wide') {
    const cx = sc.x + sc.w / 2;
    txt(ctx, ordinal(place), cx, sc.y + 54, 62, PAL.gold, { align: 'center', weight: 900, stroke: 6 });
    txt(ctx, `of ${W.boats.length}`, cx, sc.y + 100, 22, PAL.dim, { align: 'center', weight: 700 });
    txt(ctx, fmtTime(Math.max(0, me.finished ? me.finT : W.t)), cx, sc.y + 150, 34, PAL.text, { align: 'center', weight: 800 });
    txt(ctx, `${Math.max(0, Math.ceil(C.length - me.s))} m to go`, cx, sc.y + 190, 22, PAL.dim, { align: 'center', weight: 600, maxW: sc.w - 16 });
    fishChip(ctx, sc.x + 18, sc.y + 240, 20, me.fish, C.quota);
    txt(ctx, `Gates ${me.gates} / ${C.gates.length}`, cx, sc.y + 284, 21, PAL.tealHi, { align: 'center', weight: 700, maxW: sc.w - 16 });
    txt(ctx, `Splashes ${me.falls}`, cx, sc.y + 316, 21, PAL.rose, { align: 'center', weight: 700 });
    poiseBar(sc.x + 14, sc.y + 360, sc.w - 28, 12);
    txt(ctx, C.name, cx, sc.y + sc.h - 60, 20, PAL.dim, { align: 'center', weight: 700, maxW: sc.w - 16 });
    txt(ctx, MODE_NAME[st.mode], cx, sc.y + sc.h - 30, 18, PAL.gold, { align: 'center', weight: 800 });
  } else {
    txt(ctx, ordinal(place), sc.x + 16, sc.y + 34, 46, PAL.gold, { weight: 900, stroke: 6 });
    txt(ctx, fmtTime(Math.max(0, me.finished ? me.finT : W.t)), sc.x + sc.w - 16, sc.y + 30, 32, PAL.text, { align: 'right', weight: 800 });
    txt(ctx, `${Math.max(0, Math.ceil(C.length - me.s))} m to go`, sc.x + sc.w - 16, sc.y + 64, 21, PAL.dim, { align: 'right', weight: 600, maxW: sc.w * 0.45 });
    fishChip(ctx, sc.x + 16, sc.y + 64, 17, me.fish, C.quota);
    poiseBar(sc.x + 16, sc.y + sc.h - 18, sc.w - 32, 11);
  }
  button(ctx, P.pause, L.mode === 'wide' ? 'Pause' : '', { icon: 'pause', kind: 'quiet', size: 28 });
  if (st.mode === 'practice' || st.mode === 'auto') button(ctx, P.hint, L.mode === 'wide' ? 'Hint' : '', { icon: 'bulb', kind: st.mode === 'practice' ? 'quiet' : 'disabled', size: 28 });
  drawTrack(ctx, P.track, W);
  drawStrokeMeter(ctx, P.meter, me.oarSpeed, me.inWater);
  drawPad(ctx, P.pad, me, { t: W.t });
  // count-in
  if (W.go < 0 && !(st.auto && st.auto.phase !== 'act')) {
    const n = Math.ceil(-W.go), a = 1 - ((-W.go) % 1);
    ctx.save(); ctx.globalAlpha = clamp(1 - a * 0.7, 0, 1);
    txt(ctx, String(n), P.stage.x + P.stage.w / 2, P.stage.y + P.stage.h * 0.4, 190 * (0.8 + a * 0.3), PAL.gold, { align: 'center', weight: 900, stroke: 14 });
    ctx.restore();
  } else if (W.t < 1.0 && !(st.auto && st.auto.phase !== 'act')) {
    ctx.save(); ctx.globalAlpha = clamp(1 - W.t, 0, 1);
    txt(ctx, 'ROW!', P.stage.x + P.stage.w / 2, P.stage.y + P.stage.h * 0.4, 150, '#8ef0dc', { align: 'center', font: DISPLAY, weight: 700, stroke: 12 });
    ctx.restore();
  }
  // net hint when a shoal is alongside
  if (me.net > 0.01) txt(ctx, 'NETTING...', P.stage.x + P.stage.w / 2, P.stage.y + P.stage.h * 0.2, 30, '#ffe08a', { align: 'center', font: DISPLAY, weight: 700, stroke: 7 });
  if (st.banner) {
    const a = clamp(Math.min(st.banner.t / 0.15, (1.5 - st.banner.t) / 0.4), 0, 1);
    ctx.save(); ctx.globalAlpha = a;
    txt(ctx, st.banner.text, P.stage.x + P.stage.w / 2, P.stage.y + 66, 40, st.banner.col ?? PAL.gold, { align: 'center', font: DISPLAY, weight: 700, stroke: 8, maxW: P.stage.w - 40 });
    ctx.restore();
  }
  // Watch and Learn: Think / Reveal card
  const auto = st.auto;
  if (auto && auto.phase !== 'act') {
    const card = { x: P.stage.x + 16, y: P.stage.y + P.stage.h * 0.4, w: P.stage.w - 32, h: 150 };
    panel(ctx, card, { fill: 'rgba(6,26,40,0.88)', rad: 24, stroke: 'rgba(255,224,138,0.5)' });
    txt(ctx, auto.phase === 'think' ? 'THINK' : 'REVEAL', card.x + 24, card.y + 38, 36, PAL.gold, { font: DISPLAY, weight: 700, maxW: card.w - 150 });
    if (auto.phase === 'think') txt(ctx, `${Math.ceil(auto.timer)} s`, card.x + card.w - 24, card.y + 38, 38, PAL.gold, { align: 'right', weight: 900 });
    txt(ctx, auto.title, card.x + 24, card.y + 84, 26, PAL.text, { weight: 800, maxW: card.w - 48 });
    txt(ctx, auto.tip, card.x + 24, card.y + 118, 20, PAL.dim, { weight: 600, maxW: card.w - 48 });
  }
  if (st.hintCard) {
    const card = { x: P.stage.x + 16, y: P.stage.y + P.stage.h * 0.4, w: P.stage.w - 32, h: 120 };
    panel(ctx, card, { fill: 'rgba(6,26,40,0.88)', rad: 24, stroke: 'rgba(255,224,138,0.5)' });
    txt(ctx, 'HINT', card.x + 24, card.y + 34, 30, PAL.gold, { font: DISPLAY, weight: 700 });
    txt(ctx, st.hintCard.title, card.x + 24, card.y + 76, 22, PAL.text, { weight: 700, maxW: card.w - 48 });
  }
  if (st.mode === 'auto' && (!auto || auto.phase === 'act')) txt(ctx, 'WATCH AND LEARN', P.stage.x + P.stage.w / 2, P.stage.y + 22, 17, 'rgba(255,230,160,0.9)', { align: 'center', weight: 800, stroke: 5 });
  if (st.paused || st.over) drawPauseMenu(ctx, st, L, pauseItems(st), st);
  void UI; void planFor; void icon;
}
