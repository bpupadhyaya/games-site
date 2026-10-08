// Pottery Wheel: drawing every screen on the 2D layer. In scenes that show the 3D pot the layer is transparent (clearRect) and only the
// furniture, finger, target outline and HUD are painted; elsewhere the warm backdrop is painted. Pure canvas.
import { PAL, UI, DISPLAY, drawBackdrop, drawPot2D, drawTarget, drawFinger, drawStars, rgba } from './art.js';
import { txt, wrap, button, iconButton, panel, rrect, chip, icon } from './ui.js';
import { inRect, menuRects } from './layout.js';
import { renderDoc } from './docview.js';
import { drawCredit, drawLockup, edgeStroke, drawMoreLine } from './brand.js';
import { project } from './cam.js';
import { STATIONS, TRADITIONS, CHALLENGES, MOTIF_NAMES, ABOUT, HOWTO, RULES, THINK_OPTS, WHEEL_OPTS, CAPTIONS } from './content.js';
import { potFromOutline, targetR, N } from './sim.js';
import { stationId, canAdvance, ready, FIRE_TIME } from './session.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const cardPots = new Map();
const cardPot = (ch) => { let p = cardPots.get(ch.id); if (!p) { p = potFromOutline((y) => targetR(ch, y), ch.H, 0.17, 0.16); cardPots.set(ch.id, p); } return p; };

export function render(ctx, st, L, view, meta, pauseItems, camNow) {
  const w = view?.width ?? meta.width, h = view?.height ?? meta.height, sc = st.scene, g3 = st.g3;
  if (g3.visible) ctx.clearRect(0, 0, w, h); else drawBackdrop(ctx, w, h, st.t);
  if (sc === 'title') renderTitle(ctx, st, L, camNow);
  else if (sc === 'pick') renderPick(ctx, st, L);
  else if (sc === 'play') renderPlay(ctx, st, L, camNow, pauseItems);
  else if (sc === 'result') renderResult(ctx, st, L, camNow);
  else if (sc === 'shelf') renderShelf(ctx, st, L);
  else if (sc === 'study') renderStudy(ctx, st, L, camNow);
  else if (sc === 'rules' || sc === 'about' || sc === 'howto' || sc === 'settings') renderDoc(ctx, st, L, docFor(st));
  else if (sc === 'demo-limit') renderDemoLimit(ctx, st, L);
  if (st.toast) {
    const a = clamp(1 - Math.max(0, st.toast.t - (st.toast.hold - 0.4)) / 0.4, 0, 1);
    ctx.save(); ctx.globalAlpha = a; ctx.font = `700 28px ${UI}`;
    const tw = ctx.measureText(st.toast.text).width + 56, r = { x: w / 2 - tw / 2, y: L.S.y + L.S.h * 0.5, w: tw, h: 58 };
    panel(ctx, r, { fill: 'rgba(20,12,8,0.9)', rad: 29 });
    txt(ctx, st.toast.text, w / 2, r.y + 29, 28, PAL.text, { align: 'center', weight: 700 });
    ctx.restore();
  }
}

// ---- documents -----------------------------------------------------------------------------------------------------------------------------------------
function docFor(st) {
  const k = st.docKey;
  if (k === 'rules') { const pg = RULES[st.rulesPage]; return { key: 'rules' + st.rulesPage, title: pg.title, blocks: pg.blocks, nav: true, page: st.rulesPage, pages: RULES.length }; }
  if (k === 'about') {
    let blocks = ABOUT;
    if (st.credits) {
      blocks = [...ABOUT, { h: 'Open-source credits' }];
      for (const para of st.credits.split(/\n\s*\n/)) { const t = para.trim(); if (!t) continue; if (t.startsWith('#')) blocks.push({ h: t.replace(/^#+\s*/, '') }); else blocks.push({ p: t.replace(/\s*\n\s*/g, ' ') }); }
    }
    return { key: 'about' + (st.credits ? 'c' : ''), title: 'About', blocks };
  }
  if (k === 'howto') return { key: 'howto', title: 'How to Play', blocks: HOWTO };
  const p = st.prefs;
  return { key: 'settings', title: 'Settings', blocks: [
    { h: 'Sound and feel' },
    { row: 'sound', label: 'Sound', kind: 'toggle', val: () => p.sound },
    { row: 'haptics', label: 'Haptics', hint: 'A small buzz as you touch the clay', kind: 'toggle', val: () => p.haptics },
    { row: 'calm', label: 'Calm mode', hint: 'No splashes or sparks', kind: 'toggle', val: () => p.calm },
    { row: 'wheel', label: 'Wheel speed', hint: 'Slower is gentler to follow', kind: 'cycle', val: () => ['Slow', 'Normal', 'Fast'][p.wheelIdx] },
    { h: 'Watch and Learn' },
    { row: 'think', label: 'Think time', hint: 'How long a caption shows before each stroke', kind: 'cycle', val: () => `${THINK_OPTS[p.thinkIdx]} s` },
    { h: 'Help' },
    { row: 'rules', label: 'Rules', hint: 'The full rules of the clay', kind: 'button', btn: 'Open' },
    { sp: 1 },
    { p: 'Use A- and A+ at the top to change the text size from 100 to 300 percent.' },
  ] };
}

// ---- title ----------------------------------------------------------------------------------------------------------------------------------------------------
function fallbackPot(ctx, st, camNow, pot, glaze, scene) {
  const cam = camNow(scene), p = project(cam, 0, 0, 0);
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(p.x, p.y + cam.sc * 0.05, cam.sc * 1.9, cam.sc * 0.5, 0, 0, 6.3); ctx.fill();
  ctx.fillStyle = '#2a2a2e'; ctx.beginPath(); ctx.ellipse(p.x, p.y + cam.sc * 0.05, cam.sc * 1.7, cam.sc * 0.4, 0, 0, 6.3); ctx.fill();
  const off = pot.ecc * Math.cos(pot.theta) * cam.sc;
  drawPot2D(ctx, pot, glaze, p.x + off, p.y, cam.sc, { tilt: 0.2, wet: true });
}
function renderTitle(ctx, st, L, camNow) {
  const T = L.title, S = L.S;
  if (!st.g3.visible) fallbackPot(ctx, st, camNow, st.showPot, null, 'title');
  const size = T.size;
  txt(ctx, 'POTTERY', T.titleX, T.titleY, size, PAL.cream, { align: 'center', font: DISPLAY, weight: 600, stroke: size * 0.16, maxW: (L.mode === 'wide' ? T.titleX - S.x : S.w) * 1.7 });
  txt(ctx, 'WHEEL', T.titleX, T.titleY + size * 0.82, size * 0.86, PAL.terraHi, { align: 'center', font: DISPLAY, weight: 600, stroke: size * 0.14 });
  txt(ctx, 'Centre. Pull. Shape. Glaze.', T.titleX, T.titleY + size * 1.42, Math.max(24, size * 0.2), PAL.text, { align: 'center', weight: 600, stroke: 5, maxW: S.w - 48 });
  button(ctx, T.throw, 'Throw a pot', { kind: 'primary', size: 42, icon: 'pot' });
  button(ctx, T.challenges, 'Challenges', { kind: 'quiet', size: 28 });
  button(ctx, T.shelf, 'Shelf', { kind: 'quiet', size: 28, icon: 'shelf' });
  button(ctx, T.watch, 'Watch and Learn', { kind: 'ghost', size: 28, icon: 'eye' });
  button(ctx, T.how, 'How to', { kind: 'ghost', size: 24 });
  button(ctx, T.rules, 'Rules', { kind: 'ghost', size: 24 });
  button(ctx, T.about, 'About', { kind: 'ghost', size: 24 });
  button(ctx, T.settings, 'Settings', { kind: 'ghost', size: 24 });
  const lw = Math.min(300, S.w * 0.55), lh = lw * 327 / 1200;
  if (!drawLockup(ctx, { x: T.credit.x - lw / 2, y: T.credit.y - lh + 8, w: lw, h: lh })) drawCredit(ctx, T.credit.x, T.credit.y, 12);
}

// ---- pick: studio, daily, 12 challenges ---------------------------------------------------------------------------------------------------------------
function renderPick(ctx, st, L) {
  const K = L.pick, S = L.S, sc = st.scroll.pick;
  button(ctx, L.back, 'Back', { icon: 'back', kind: 'ghost', size: 28 });
  txt(ctx, 'Choose a pot', S.x + S.w / 2, L.headTitleY, 40, PAL.gold, { align: 'center', font: DISPLAY, weight: 600, stroke: 6, maxW: S.w - 2 * (L.back.w + 30) });
  ctx.save(); ctx.beginPath(); ctx.rect(K.grid.x - 6, K.grid.y - 4, K.grid.w + 12, K.grid.h + 8); ctx.clip();
  for (let i = 0; i < 14; i++) {
    const c = i % K.cols, r = Math.floor(i / K.cols), R = { x: K.grid.x + c * (K.cw + K.gap), y: K.grid.y + r * (K.ch + K.gap) - sc, w: K.cw, h: K.ch };
    if (R.y + R.h < K.grid.y - 10 || R.y > K.grid.y + K.grid.h + 10) continue;
    panel(ctx, R, { fill: 'rgba(36,24,18,0.82)', rad: 22 }); edgeStroke(ctx, R, 22, 0.18);
    if (i < 2) {
      const daily = i === 1, ch = daily ? null : null;
      void ch;
      txt(ctx, daily ? 'Daily' : 'Studio', R.x + R.w / 2, R.y + R.h * 0.2, Math.min(34, R.w * 0.16), PAL.cream, { align: 'center', font: DISPLAY, weight: 600, maxW: R.w - 20 });
      icon(ctx, daily ? 'hint' : 'pot', R.x + R.w / 2, R.y + R.h * 0.5, Math.min(R.w, R.h) * 0.2, PAL.terraHi);
      ctx.font = `500 ${Math.min(22, R.w * 0.1)}px ${UI}`;
      wrap(ctx, daily ? 'One outline and one glaze for today' : 'Free throw, no target', R.w - 28).slice(0, 3).forEach((ln, k) => txt(ctx, ln, R.x + R.w / 2, R.y + R.h * 0.76 + k * 26, Math.min(22, R.w * 0.1), PAL.dim, { align: 'center', weight: 500 }));
      continue;
    }
    const ch = CHALLENGES[i - 2], pot = cardPot(ch), best = st.stars[ch.id] ?? 0, locked = st.demo && i - 2 >= 3;
    const scale = Math.min((R.h * 0.42) / 3.7, (R.w * 0.8) / 3.2);
    drawPot2D(ctx, pot, null, R.x + R.w / 2, R.y + R.h * 0.66, scale, { color: '#d8a373', tilt: 0.22 });
    txt(ctx, ch.name, R.x + R.w / 2, R.y + R.h * 0.1, Math.min(26, R.w * 0.13), PAL.cream, { align: 'center', font: DISPLAY, weight: 500, maxW: R.w - 18 });
    for (let k = 0; k < ch.tier; k++) { ctx.fillStyle = PAL.terracotta; ctx.beginPath(); ctx.arc(R.x + R.w / 2 + (k - (ch.tier - 1) / 2) * 18, R.y + R.h * 0.2, 5, 0, 6.3); ctx.fill(); }
    drawStars(ctx, R.x + R.w / 2, R.y + R.h - 28, 26, best);
    if (locked) { ctx.fillStyle = 'rgba(12,8,6,0.62)'; rrect(ctx, R, 22); ctx.fill(); txt(ctx, 'In the full game', R.x + R.w / 2, R.y + R.h / 2, 24, PAL.text, { align: 'center', weight: 800 }); }
  }
  ctx.restore();
}

// ---- play ------------------------------------------------------------------------------------------------------------------------------------------------------------
function stationBar(ctx, st, L) {
  const P = L.play, s = st.ses, B = P.bar, n = STATIONS.length, gap = 6, pw = (B.w - gap * (n - 1)) / n;
  for (let i = 0; i < n; i++) {
    const r = { x: B.x + i * (pw + gap), y: B.y, w: pw, h: B.h }, on = i === s.station, done = i < s.station;
    ctx.fillStyle = on ? PAL.terracotta : done ? 'rgba(73,181,164,0.45)' : 'rgba(255,240,220,0.09)';
    rrect(ctx, r, B.h / 2); ctx.fill();
    if (!on && !done) { ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(255,230,200,0.2)'; rrect(ctx, r, B.h / 2); ctx.stroke(); }
    txt(ctx, STATIONS[i].name, r.x + r.w / 2, r.y + r.h / 2 + 1, Math.min(22, B.h * 0.46), on ? '#fff' : done ? PAL.text : PAL.dim, { align: 'center', weight: on ? 800 : 600, maxW: r.w - 8 });
  }
}
function captionBox(ctx, L, title, body, o = {}) {
  const P = L.play, x = P.pot.x + 14, y = P.pot.y + 4 + (o.dy ?? 0), w = P.pot.w - 28;
  const ts = o.size ?? 24;
  ctx.font = `500 ${ts}px ${UI}`;
  const lines = wrap(ctx, body, w - 40).slice(0, o.lines ?? 3), th = title ? ts * 1.5 : 0, hgt = 22 + th + lines.length * ts * 1.3;
  panel(ctx, { x, y, w, h: hgt }, { fill: 'rgba(24,15,11,0.8)', rad: 18 });
  if (title) txt(ctx, title, x + 20, y + 18 + ts * 0.7, ts * 1.12, PAL.gold, { weight: 800, maxW: w - 40, font: DISPLAY });
  lines.forEach((ln, i) => txt(ctx, ln, x + 20, y + 14 + th + ts * 0.8 + i * ts * 1.3, ts, PAL.text, { weight: 500 }));
  return hgt;
}
function renderPlay(ctx, st, L, camNow, pauseItems) {
  const s = st.ses, P = L.play, cam = camNow('play'), id = stationId(s), g = st.g3, a = st.auto;
  if (!g.visible) fallbackPot(ctx, st, camNow, s.pot, g.glaze, 'play');
  stationBar(ctx, st, L);
  if (g.target) drawTarget(ctx, cam, g.target, st.t);
  // caption: the hint, the auto-play caption, or the station tip
  let capH = 0;
  if (a && a.step) {
    const c = a.step.caption;
    capH = captionBox(ctx, L, c[0], c[1], { lines: L.mode === 'wide' ? 4 : 4, size: 24 });
  } else if (st.hint) capH = captionBox(ctx, L, st.hint.caption[0], st.hint.caption[1], { lines: 3 });
  else if (!a && id === 'glaze') { const T = TRADITIONS[s.glaze.trad]; capH = captionBox(ctx, L, `${T.name}  (${s.glaze.bands.length}/4 bands)`, T.craft, { lines: 3, size: 22 }); }
  // centring gauges
  if (id === 'centre' && !a) {
    const gw = Math.min(360, P.pot.w - 60), gx = P.pot.x + (P.pot.w - gw) / 2, gy = P.pot.y + 20 + capH + (capH ? 12 : 0);
    gauge(ctx, gx, gy, gw, 'Wobble', clamp(s.pot.ecc / 0.45, 0, 1), s.pot.ecc < 0.02 ? PAL.teal : PAL.terracotta);
    pressureGauge(ctx, gx, gy + 44, gw, s.tel.contact ? s.tel.pressure : null);
  }
  // hint mark
  if (st.hint && st.hint.mark) ring(ctx, project(cam, st.hint.mark.X, st.hint.mark.Y, 0), st.t, 'Here');
  if (a && a.step && (a.phase === 'reveal' || a.phase === 'think')) {
    const m = a.step.mark?.();
    if (m) ring(ctx, project(cam, m.X, m.Y, 0), st.t, null, a.phase === 'reveal' ? 1 : 0.5);
  }
  // splashes
  for (const q of st.parts) { const p = project(cam, q.X ?? q.x, q.Y ?? q.y, 0); const al = 1 - q.life / q.max; ctx.fillStyle = `rgba(255,230,200,${0.6 * al})`; ctx.beginPath(); ctx.arc(p.x, p.y, 3 + 2 * al, 0, 6.3); ctx.fill(); }
  // the finger
  const fin = a ? (a.step && a.phase !== 'think' ? { X: a.fp.X, Y: a.fp.Y, down: s.finger.down, ghost: true } : null) : (s.finger.down ? { X: s.finger.X, Y: s.finger.Y, down: true } : null);
  if (fin) {
    const p = project(cam, fin.X, fin.Y, 0), size = clamp(cam.sc * 0.095, 9, 30);
    drawFinger(ctx, p.x, p.y, fin.X < 0 ? 1 : -1, size, fin.down ? Math.max(0.2, s.tel.pressure * 2.2) : 0, !!fin.ghost);
    if (s.warn && s.warnT > 0) txt(ctx, s.warn, p.x, p.y - size * 3, 26, '#ffd5a8', { align: 'center', weight: 800, stroke: 6 });
  }
  if (s.banner) {
    const al = clamp(1 - Math.max(0, s.banner.t - 1.2) / 0.6, 0, 1);
    ctx.save(); ctx.globalAlpha = al; txt(ctx, s.banner.text, P.pot.x + P.pot.w / 2, P.pot.y + P.pot.h * 0.5, 54, PAL.cream, { align: 'center', font: DISPLAY, weight: 600, stroke: 10, maxW: P.pot.w - 40 }); ctx.restore();
  }
  if (id === 'fire') fireOverlay(ctx, st, L);
  // panel
  panel(ctx, P.panel, { fill: 'rgba(30,20,15,0.86)', rad: 26 }); edgeStroke(ctx, P.panel, 26, 0.22);
  iconButton(ctx, P.pause, 'pause');
  if (a) autoPanel(ctx, st, L);
  else playPanel(ctx, st, L);
  if (st.paused) pauseMenu(ctx, st, L, pauseItems);
}
function gauge(ctx, x, y, w, label, v, col) {
  txt(ctx, label, x, y + 14, 21, PAL.text, { weight: 700 });
  const r = { x: x + 120, y: y + 3, w: w - 120, h: 22 };
  ctx.fillStyle = 'rgba(255,240,220,0.14)'; rrect(ctx, r, 11); ctx.fill();
  ctx.fillStyle = col; rrect(ctx, { x: r.x, y: r.y, w: Math.max(14, r.w * v), h: r.h }, 11); ctx.fill();
}
function pressureGauge(ctx, x, y, w, p) {
  txt(ctx, 'Pressure', x, y + 14, 21, PAL.text, { weight: 700 });
  const r = { x: x + 120, y: y + 3, w: w - 120, h: 22 };
  ctx.fillStyle = 'rgba(255,240,220,0.14)'; rrect(ctx, r, 11); ctx.fill();
  ctx.fillStyle = 'rgba(73,181,164,0.7)'; rrect(ctx, { x: r.x + r.w * (0.08 / 0.7), y: r.y, w: r.w * (0.32 / 0.7), h: r.h }, 8); ctx.fill();
  if (p !== null) { const px = r.x + r.w * clamp(p / 0.7, 0, 1); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(px, r.y + 11, 10, 0, 6.3); ctx.fill(); }
}
function ring(ctx, p, t, label, k = 1) {
  const r = 26 + 6 * Math.sin(t * 6);
  ctx.save(); ctx.globalAlpha = k; ctx.lineWidth = 5; ctx.strokeStyle = '#ffe3b5'; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 6.3); ctx.stroke();
  ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,200,120,0.5)'; ctx.beginPath(); ctx.arc(p.x, p.y, r + 9, 0, 6.3); ctx.stroke();
  if (label) txt(ctx, label, p.x, p.y - r - 22, 26, '#ffe3b5', { align: 'center', weight: 800, stroke: 6 });
  ctx.restore();
}
function fireOverlay(ctx, st, L) {
  const s = st.ses, P = L.play, f = clamp(s.fireT / FIRE_TIME, 0, 1);
  const glow = Math.sin(f * Math.PI);
  const g = ctx.createRadialGradient(P.pot.x + P.pot.w / 2, P.pot.y + P.pot.h * 0.6, 10, P.pot.x + P.pot.w / 2, P.pot.y + P.pot.h * 0.6, Math.max(P.pot.w, P.pot.h) * 0.7);
  g.addColorStop(0, `rgba(255,140,50,${0.28 * glow})`); g.addColorStop(1, 'rgba(255,80,20,0)');
  ctx.fillStyle = g; ctx.fillRect(P.pot.x, P.pot.y, P.pot.w, P.pot.h);
  const bw = Math.min(360, P.pot.w - 80), bx = P.pot.x + (P.pot.w - bw) / 2, by = P.pot.y + 24;
  txt(ctx, f < 0.5 ? 'Firing...' : f < 0.95 ? 'Glaze melting...' : 'Cooling', P.pot.x + P.pot.w / 2, by, 30, PAL.cream, { align: 'center', font: DISPLAY, weight: 600, stroke: 7 });
  ctx.fillStyle = 'rgba(255,240,220,0.16)'; rrect(ctx, { x: bx, y: by + 24, w: bw, h: 14 }, 7); ctx.fill();
  ctx.fillStyle = '#ff9a4a'; rrect(ctx, { x: bx, y: by + 24, w: Math.max(14, bw * f), h: 14 }, 7); ctx.fill();
}
function playPanel(ctx, st, L) {
  const s = st.ses, P = L.play, id = stationId(s), B = P.body;
  if (id === 'glaze') {
    const T = TRADITIONS[s.glaze.trad], G = P.glaze;
    G.trads.forEach((r, i) => {
      const t = TRADITIONS[i], on = i === s.glaze.trad, cx = r.x + r.w / 2, cy = r.y + r.h / 2, rad = Math.min(r.w, r.h) / 2 - 2;
      ctx.fillStyle = t.base[0]; ctx.beginPath(); ctx.arc(cx, cy, rad, 0, 6.3); ctx.fill();
      ctx.fillStyle = t.accent[0]; ctx.beginPath(); ctx.arc(cx, cy, rad * 0.5, 0, Math.PI * 1.0); ctx.fill();
      if (on) { ctx.lineWidth = 4; ctx.strokeStyle = '#fff'; ctx.beginPath(); ctx.arc(cx, cy, rad + 3, 0, 6.3); ctx.stroke(); }
    });
    G.bases.forEach((r, i) => swatch(ctx, r, T.base[i], i === s.glaze.base, 'Base'));
    G.accs.forEach((r, i) => swatch(ctx, r, T.accent[i], i === s.glaze.acc, 'Paint'));
    G.motifs.forEach((r, i) => {
      const on = T.motifs[i] === T.motifs[s.glaze.motif] && i === s.glaze.motif;
      ctx.fillStyle = on ? PAL.terracotta : 'rgba(255,240,220,0.1)'; rrect(ctx, r, 12); ctx.fill();
      txt(ctx, MOTIF_NAMES[T.motifs[i]], r.x + r.w / 2, r.y + r.h / 2, 20, on ? '#fff' : PAL.text, { align: 'center', weight: 700, maxW: r.w - 8 });
    });
  } else {
    const st0 = STATIONS[s.station];
    txt(ctx, st0.short, B.x + 4, B.y + 20, 28, PAL.gold, { weight: 800, font: DISPLAY, maxW: B.w - 8 });
    ctx.font = `500 24px ${UI}`;
    wrap(ctx, st0.tip, B.w - 8).slice(0, Math.max(1, Math.floor((B.h - 40) / 31))).forEach((ln, i) => txt(ctx, ln, B.x + 4, B.y + 58 + i * 31, 24, PAL.text, { weight: 500 }));
  }
  const rdy = id !== 'fire' && ready(s) && canAdvance(s);
  if (id !== 'fire') {
    button(ctx, P.undo, 'Undo', { kind: s.hist.length ? 'quiet' : 'disabled', size: 26, icon: 'undo', noShadow: true });
    button(ctx, P.hint, 'Hint', { kind: 'quiet', size: 26, icon: 'hint', noShadow: true });
  }
  const last = id === 'glaze';
  button(ctx, P.next, id === 'fire' ? 'Skip' : last ? 'Fire it' : 'Next', { kind: id === 'fire' || canAdvance(s) ? 'primary' : 'disabled', size: 28, icon: 'next', noShadow: true, pulse: rdy ? 0.5 + 0.5 * Math.sin(st.t * 5) : 0 });
}
function swatch(ctx, r, col, on, label) {
  ctx.fillStyle = col; rrect(ctx, r, 12); ctx.fill();
  ctx.lineWidth = on ? 4 : 1.5; ctx.strokeStyle = on ? '#fff' : 'rgba(255,255,255,0.25)'; rrect(ctx, r, 12); ctx.stroke();
  void label;
}
function autoPanel(ctx, st, L) {
  const P = L.play, a = st.auto, B = P.body, s = st.ses;
  const phase = a.step ? a.phase : 'wait';
  const label = !a.step ? (stationId(s) === 'fire' ? 'Firing' : 'Working') : phase === 'think' ? 'Think' : phase === 'reveal' ? 'Look' : 'Watch';
  txt(ctx, 'Watch and Learn', B.x + 4, B.y + 18, 26, PAL.gold, { weight: 800, font: DISPLAY, maxW: B.w - 8 });
  chip(ctx, B.x + 4, B.y + 62, label.toUpperCase(), 20, { fill: phase === 'act' ? PAL.teal : 'rgba(255,240,220,0.14)', color: phase === 'act' ? '#10201c' : PAL.text });
  if (a.step && (phase === 'think' || phase === 'reveal')) {
    const left = Math.max(0, (phase === 'think' ? a.thinkFor : a.revealFor) - a.t);
    txt(ctx, `${Math.ceil(left)} s`, B.x + B.w - 6, B.y + 62, 28, PAL.text, { align: 'right', weight: 800 });
  }
  button(ctx, P.close, 'Close', { kind: 'quiet', size: 26, icon: 'close', noShadow: true });
  button(ctx, P.skip, 'Skip', { kind: 'quiet', size: 26, icon: 'skip', noShadow: true });
  const next = { x: P.next.x, y: P.next.y, w: P.next.w, h: P.next.h };
  txt(ctx, `Station ${s.station + 1} of ${STATIONS.length}: ${STATIONS[s.station].name}`, next.x + next.w / 2, next.y + next.h / 2, 22, PAL.dim, { align: 'center', weight: 700, maxW: next.w - 8 });
}
function pauseMenu(ctx, st, L, pauseItems) {
  const items = pauseItems(), M = menuRects(L, items.length);
  ctx.fillStyle = 'rgba(8,4,2,0.66)'; ctx.fillRect(0, 0, L.w, L.h);
  panel(ctx, M.panel, { fill: 'rgba(32,21,16,0.96)' }); edgeStroke(ctx, M.panel, 24, 0.5);
  txt(ctx, 'Paused', M.panel.x + M.panel.w / 2, M.panel.y + 62, 46, PAL.gold, { align: 'center', font: DISPLAY, weight: 600, stroke: 6 });
  const names = { resume: ['Resume', 'primary', 'play'], skip: ['Skip this stroke', 'quiet', 'skip'], restart: ['Start over', 'quiet', 'restart'], quit: ['Leave', 'ghost', 'back'] };
  items.forEach((it, i) => button(ctx, M.btns[i], names[it][0], { kind: names[it][1], size: 32, icon: names[it][2] }));
}

// ---- result ------------------------------------------------------------------------------------------------------------------------------------------------------
function renderResult(ctx, st, L, camNow) {
  const r = st.result, K = L.result, p = K.panel, sc = r.scores;
  if (!st.g3.visible && st.ses) fallbackPot(ctx, st, camNow, st.ses.pot, st.ses.glaze, 'result');
  panel(ctx, p, { fill: 'rgba(28,18,14,0.9)', rad: 28 }); edgeStroke(ctx, p, 28, 0.5);
  const wide = L.mode === 'wide';
  txt(ctx, r.auto ? 'THE DEMONSTRATION' : 'OUT OF THE KILN', p.x + p.w / 2, p.y + 34, 20, PAL.dim, { align: 'center', weight: 800 });
  txt(ctx, r.name, p.x + p.w / 2, p.y + 76, 44, PAL.gold, { align: 'center', font: DISPLAY, weight: 600, stroke: 6, maxW: p.w - 40 });
  drawStars(ctx, p.x + p.w / 2, p.y + 134, wide ? 44 : 52, r.stars);
  if (r.newBest) chip(ctx, p.x + p.w / 2, p.y + 186, 'NEW BEST', 20, { align: 'center', fill: PAL.terracotta, color: '#fff' });
  const rows = [['Shape', sc.shape], ['Even walls', sc.even], ['Smooth', sc.smooth], ['Centred', sc.centre]].filter((q) => q[1] !== null);
  const top = p.y + 214, avail = K.btns[0].y - 12 - top, rh = clamp(avail / (rows.length + 1), 34, 52);
  const bx = p.x + 28, bw = p.w - 56;
  rows.forEach((q, i) => {
    const y = top + i * rh;
    txt(ctx, q[0], bx, y + rh / 2, Math.min(24, rh * 0.5), PAL.text, { weight: 700 });
    const tr = { x: bx + bw * 0.4, y: y + rh / 2 - 8, w: bw * 0.46, h: 16 };
    ctx.fillStyle = 'rgba(255,240,220,0.14)'; rrect(ctx, tr, 8); ctx.fill();
    ctx.fillStyle = q[1] >= 80 ? PAL.teal : q[1] >= 60 ? PAL.gold : PAL.terracotta; rrect(ctx, { x: tr.x, y: tr.y, w: Math.max(16, tr.w * q[1] / 100), h: 16 }, 8); ctx.fill();
    txt(ctx, String(q[1]), bx + bw, y + rh / 2, Math.min(26, rh * 0.52), PAL.text, { align: 'right', weight: 800 });
  });
  const ty = top + rows.length * rh;
  txt(ctx, 'Total', bx, ty + rh / 2, Math.min(28, rh * 0.56), PAL.gold, { weight: 800 });
  txt(ctx, String(sc.total), bx + bw, ty + rh / 2, Math.min(34, rh * 0.7), PAL.cream, { align: 'right', font: DISPLAY, weight: 600 });
  if (r.auto) {
    button(ctx, K.btns[0], 'Watch again', { kind: 'quiet', size: 26, noShadow: true }); button(ctx, K.btns[1], 'Try it', { kind: 'primary', size: 26, noShadow: true }); button(ctx, K.btns[2], 'Menu', { kind: 'ghost', size: 26, noShadow: true });
  } else {
    button(ctx, K.btns[0], r.saved ? 'On the shelf' : 'Put on shelf', { kind: r.saved ? 'disabled' : 'primary', size: r.saved ? 21 : 26, icon: 'shelf', noShadow: true });
    button(ctx, K.btns[1], 'Again', { kind: 'quiet', size: 26, icon: 'restart', noShadow: true });
    button(ctx, K.btns[2], r.mode === 'challenge' ? 'Challenges' : 'Menu', { kind: 'ghost', size: 26, noShadow: true });
  }
  if (wide) drawMoreLine(ctx, p.x + p.w / 2, p.y + p.h - 12, 13);
}

// ---- shelf and study ----------------------------------------------------------------------------------------------------------------------------------------------
function renderShelf(ctx, st, L) {
  const K = L.shelf, S = L.S, sc = st.scroll.shelf;
  button(ctx, L.back, 'Back', { icon: 'back', kind: 'ghost', size: 28 });
  txt(ctx, 'Your shelf', S.x + S.w / 2, L.headTitleY, 40, PAL.gold, { align: 'center', font: DISPLAY, weight: 600, stroke: 6, maxW: S.w - 2 * (L.back.w + 30) });
  if (!st.shelf.length) {
    txt(ctx, 'Nothing here yet.', S.x + S.w / 2, S.y + S.h * 0.42, 36, PAL.text, { align: 'center', font: DISPLAY, weight: 500 });
    txt(ctx, 'Throw a pot and put it on the shelf.', S.x + S.w / 2, S.y + S.h * 0.42 + 48, 24, PAL.dim, { align: 'center', weight: 500, maxW: S.w - 60 });
    return;
  }
  ctx.save(); ctx.beginPath(); ctx.rect(K.grid.x - 6, K.grid.y - 4, K.grid.w + 12, K.grid.h + 8); ctx.clip();
  st.shelf.forEach((pc, i) => {
    const c = i % K.cols, r = Math.floor(i / K.cols), R = { x: K.grid.x + c * (K.cw + K.gap), y: K.grid.y + r * (K.ch + K.gap) - sc, w: K.cw, h: K.ch };
    if (R.y + R.h < K.grid.y - 10 || R.y > K.grid.y + K.grid.h + 10) return;
    panel(ctx, R, { fill: 'rgba(36,24,18,0.82)', rad: 22 }); edgeStroke(ctx, R, 22, 0.18);
    const pot = pieceCache(pc);
    const scale = Math.min((R.h * 0.56) / Math.max(1.5, pot.H), (R.w * 0.8) / 3.2);
    drawPot2D(ctx, pot, pc.glaze, R.x + R.w / 2, R.y + R.h * 0.72, scale, { tilt: 0.22 });
    txt(ctx, pc.name, R.x + R.w / 2, R.y + 26, Math.min(24, R.w * 0.12), PAL.cream, { align: 'center', font: DISPLAY, weight: 500, maxW: R.w - 18 });
    drawStars(ctx, R.x + R.w / 2, R.y + R.h - 24, 24, pc.stars);
  });
  ctx.restore();
}
const pieceCaches = new WeakMap();
import { unpack } from './sim.js';
function pieceCache(pc) { let p = pieceCaches.get(pc); if (!p) { p = unpack(pc.pack); pieceCaches.set(pc, p); } return p; }
function renderStudy(ctx, st, L, camNow) {
  const K = L.study, S = L.S, sd = st.study;
  if (!sd) return;
  button(ctx, L.back, 'Shelf', { icon: 'back', kind: 'ghost', size: 28 });
  if (!st.g3.visible) fallbackPot(ctx, st, camNow, sd.pot, sd.glaze, 'study');
  const p = K.panel;
  panel(ctx, p, { fill: 'rgba(28,18,14,0.9)', rad: 28 }); edgeStroke(ctx, p, 28, 0.4);
  txt(ctx, sd.piece.name, p.x + p.w / 2, p.y + 56, 40, PAL.gold, { align: 'center', font: DISPLAY, weight: 600, stroke: 6, maxW: p.w - 40 });
  drawStars(ctx, p.x + p.w / 2, p.y + 112, 46, sd.piece.stars);
  txt(ctx, `Score ${sd.piece.total}`, p.x + p.w / 2, p.y + 166, 30, PAL.text, { align: 'center', weight: 800 });
  txt(ctx, TRADITIONS[sd.glaze.trad].name, p.x + p.w / 2, p.y + 206, 24, PAL.dim, { align: 'center', weight: 600, maxW: p.w - 40 });
  button(ctx, K.btns[0], 'Remove', { kind: 'danger', size: 26, noShadow: true });
  button(ctx, K.btns[1], 'Back', { kind: 'quiet', size: 26, noShadow: true });
  void S;
}

function renderDemoLimit(ctx, st, L) {
  const S = L.S, r = { x: S.x + S.w / 2 - Math.min(S.w - 40, 560) / 2, y: S.y + S.h / 2 - 220, w: Math.min(S.w - 40, 560), h: 440 };
  panel(ctx, r, { fill: 'rgba(28,18,14,0.92)' }); edgeStroke(ctx, r, 24, 0.6);
  txt(ctx, 'That is the preview', r.x + r.w / 2, r.y + 80, 44, PAL.gold, { align: 'center', font: DISPLAY, weight: 600, stroke: 6, maxW: r.w - 40 });
  ctx.font = `500 28px ${UI}`;
  wrap(ctx, 'Get the full Pottery Wheel on iPhone and Android: every challenge, all six glaze traditions and your shelf.', r.w - 70).forEach((ln, i) => txt(ctx, ln, r.x + r.w / 2, r.y + 170 + i * 40, 28, PAL.text, { align: 'center', weight: 500 }));
  txt(ctx, 'Tap to go back', r.x + r.w / 2, r.y + r.h - 40, 24, PAL.dim, { align: 'center', weight: 600 });
}
void inRect; void WHEEL_OPTS; void CAPTIONS; void N; void rgba; void project;
