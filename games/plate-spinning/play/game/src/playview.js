// The show screen: stage, poles and plates, HUD, coach panel (Watch and Learn), pause menu, banner.
import { PAL, UI, DISPLAY, drawStage, drawLights, drawLantern, drawPlate, drawPole, drawStand, drawGauge, plateOffset, drawParticles, rgba, clamp, clamp01, easeOut, plateColors } from './art.js';
import { txt, button, panel, rrect, chip, wrap } from './ui.js';
import { TUNE, TYPES, zoneOf, urgency, rateFor } from './engine.js';
import { menuRects, host } from './layout.js';
import { v3 } from './v3.js';

const TAU = Math.PI * 2;

// ---- one pole with its plate ----------------------------------------------------------------------------------------------------------------
function drawOne(ctx, st, pl, L, s, pole, num) {
  const show = pl.show, P = L.play, calm = st.prefs.calm, t = show.anim;
  const plate = pole.plate;
  if (!pole.on) {                                         // a stand waiting for a later act
    ctx.save(); ctx.globalAlpha = 0.28; drawStand(ctx, s.cx, s.base, s.rx, 0.1); ctx.restore();
    return;
  }
  const hot = plate && plate.st === 'spin' ? zoneOf(plate.e) : null;
  if (!v3.on) drawStand(ctx, s.cx, s.base, s.rx, hot === 'perfect' ? 1 : 0.5);
  // where the plate is right now
  let px = s.cx, py = s.top, scale = 1, a = 1;
  if (plate) {
    if (plate.st === 'fall') {
      const u = clamp01(plate.fallT / TUNE.fallTime);
      py = s.top + (s.base - 8 - s.top) * u * u; px = s.cx + Math.sin(u * 5) * s.rx * 0.5 * u; a = u > 0.92 ? 1 - (u - 0.92) / 0.08 : 1;
    } else if (plate.age < 0.6) {
      const u = easeOut(clamp01(plate.age / 0.6));
      py = s.base + (s.top - s.base) * u; scale = 0.5 + 0.5 * u;
    }
  }
  const snap = pl.poleSnap[s.i] || 0;
  const wobble = plate && plate.st === 'spin' ? plateOffset(plate, s.rx, calm) : { ox: 0, oy: 0 };
  const sway = snap * Math.sin(snap * 22) * s.rx * 0.35;
  const tipX = (plate && plate.st === 'fall' ? s.cx : px) + wobble.ox * 0.9 + sway, tipY = (plate && plate.st === 'fall' ? s.top : py) + wobble.oy + s.rx * 0.1;
  if (!v3.on) drawPole(ctx, s.cx, s.base - s.rx * 0.18, tipX, tipY, Math.max(4, s.rx * 0.11));
  if (!plate) {
    return;
  }
  // glow cues: gold in the Perfect band, amber in Good, red when very low
  let glow = null, glowA = 0;
  if (plate.st === 'spin') {
    const pulse = 0.5 + 0.5 * Math.sin(t * (hot === 'late' ? 14 : 8));
    if (hot === 'perfect') { glow = '#ffe27a'; glowA = 0.45 + 0.3 * pulse; }
    else if (hot === 'good') { glow = '#ffa83a'; glowA = 0.25 + 0.15 * pulse; }
    else if (hot === 'late') { glow = '#ff4a4a'; glowA = 0.35 + 0.3 * pulse; }
  }
  ctx.save(); ctx.globalAlpha = a;
  if (v3.on) { /* the plate is a lit 3D object */ }
  else if (plate.st === 'fall') { const u = plate.fallT / TUNE.fallTime; drawPlate(ctx, px, py, s.rx * scale, { ...plate, ph: plate.ph + u * 9, e: 0.5 + u * 0.5, jolt: 0, spinA: plate.spinA + u * 14 }, { calm: true }); }
  else drawPlate(ctx, px, py, s.rx * scale, plate, { glow, glowA, calm, scale: 1 });
  ctx.restore();
  // double-whip timer (jade): a ring that closes
  if (plate.charge > 0) {
    ctx.save(); ctx.strokeStyle = '#b8f0d4'; ctx.lineWidth = 5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.ellipse(px + wobble.ox, py + wobble.oy, s.rx * 1.25, s.rx * 0.6, 0, -Math.PI / 2, -Math.PI / 2 + TAU * clamp01(plate.charge / TUNE.jadeTime)); ctx.stroke(); ctx.restore();
  }
  if (st.prefs.gauges && plate.st === 'spin') drawGauge(ctx, s.cx, s.base + s.rx * 0.5 + 8, Math.min(s.rx * 2.0, 150), plate.e, hot === 'perfect');
  if (num && pl.mode === 'auto') {
    const r = Math.max(13, s.rx * 0.2), cy = s.base + s.rx * 0.5 + 8 + r * 2.2;
    ctx.fillStyle = 'rgba(8,2,6,0.7)'; ctx.beginPath(); ctx.arc(s.cx, cy, r, 0, TAU); ctx.fill();
    txt(ctx, String(num), s.cx, cy + 1, r * 1.35, PAL.text, { align: 'center', weight: 800 });
  }
}

function drawCue(ctx, st, pl, L, i, kind, t) {
  const s = L.play.slots[i], pole = pl.show.poles[i];
  if (!s || !pole || !pole.plate) return;
  const pulse = 0.5 + 0.5 * Math.sin(t * 7), r = s.rx * (1.55 + 0.18 * pulse);
  ctx.save();
  ctx.strokeStyle = kind === 'plan' ? '#ffe27a' : '#7fe8ff'; ctx.lineWidth = 5;
  ctx.shadowColor = ctx.strokeStyle; ctx.shadowBlur = 12;
  ctx.beginPath(); ctx.ellipse(s.cx, s.top, r, r * 0.62, 0, 0, TAU); ctx.stroke();
  ctx.shadowBlur = 0;
  // an arrow above
  ctx.fillStyle = ctx.strokeStyle; const ay = s.top - r * 0.62 - 14 - pulse * 6;
  ctx.beginPath(); ctx.moveTo(s.cx, ay + 12); ctx.lineTo(s.cx - 12, ay - 6); ctx.lineTo(s.cx + 12, ay - 6); ctx.closePath(); ctx.fill();
  ctx.restore();
}

// ---- HUD ------------------------------------------------------------------------------------------------------------------------------------------
function spareIcon(ctx, x, y, r, broken) {
  ctx.save(); ctx.translate(x, y);
  ctx.fillStyle = broken ? 'rgba(255,240,220,0.12)' : '#f4f1ea'; ctx.beginPath(); ctx.ellipse(0, 0, r, r * 0.45, 0, 0, TAU); ctx.fill();
  if (!broken) { ctx.strokeStyle = '#2c5aa8'; ctx.lineWidth = Math.max(1.5, r * 0.12); ctx.beginPath(); ctx.ellipse(0, 0, r * 0.62, r * 0.28, 0, 0, TAU); ctx.stroke(); }
  else { ctx.strokeStyle = 'rgba(255,107,107,0.9)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-r * 0.7, -r * 0.3); ctx.lineTo(r * 0.7, r * 0.3); ctx.moveTo(r * 0.7, -r * 0.3); ctx.lineTo(-r * 0.7, r * 0.3); ctx.stroke(); }
  ctx.restore();
}

function drawHud(ctx, st, pl, L) {
  const P = L.play, sh = pl.show, S = L.S;
  const hud = P.hud, wide = L.mode === 'wide';
  ctx.save();
  if (v3.on) {
    const g = ctx.createLinearGradient(0, 0, 0, hud.y + hud.h + 20);
    g.addColorStop(0, 'rgba(8,2,8,0.55)'); g.addColorStop(1, 'rgba(8,2,8,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, L.w, hud.y + hud.h + 20);
    const pw = Math.min(S.w - (P.think.w + P.pause.w + 60) - P.score.x + S.x - 12, wide ? 560 : 400);
    panel(ctx, { x: S.x + 8 + (P.score.x - S.x - 16), y: S.y + 6, w: Math.max(240, pw), h: hud.h - 18 }, { kind: 'plaque', rad: 22 });
  } else {
  const g = ctx.createLinearGradient(0, hud.y, 0, hud.y + hud.h);
  g.addColorStop(0, 'rgba(10,2,8,0.82)'); g.addColorStop(1, 'rgba(10,2,8,0.35)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, L.w, hud.y + hud.h);
  }
  ctx.restore();
  // score
  txt(ctx, 'SCORE', P.score.x, P.score.y + 12, 18, PAL.dim, { weight: 800 });
  txt(ctx, String(Math.round(sh.score)).replace(/\B(?=(\d{3})+(?!\d))/g, ','), P.score.x, P.score.y + 52, wide ? 46 : 56, PAL.gold, { font: DISPLAY, weight: 700, stroke: 6 });
  // act + combo
  const actLabel = pl.mode === 'practice' ? 'PRACTICE' : pl.mode === 'auto' ? `WATCH AND LEARN  ·  ACT ${sh.act}` : `ACT ${sh.act}`;
  txt(ctx, actLabel, P.act.x, P.act.y, 24, PAL.text, { weight: 800, maxW: wide ? 300 : S.w - 220 });
  const mult = Math.min(TUNE.maxMult, 1 + Math.floor(sh.combo / TUNE.comboStep));
  if (sh.combo > 0) chip(ctx, P.combo.x, P.combo.y, `x${mult}  COMBO ${sh.combo}`, 22, { align: P.combo.align, fill: mult > 1 ? 'rgba(244,207,106,0.28)' : 'rgba(255,240,220,0.12)', stroke: mult > 1 ? PAL.gold : null });
  // act progress
  if (pl.mode !== 'practice') {
    const bx = S.x + 16, bw = S.w - 32, by = hud.y + hud.h - 8;
    ctx.fillStyle = 'rgba(255,240,220,0.14)'; rrect(ctx, { x: bx, y: by, w: bw, h: 5 }, 3); ctx.fill();
    ctx.fillStyle = PAL.gold; rrect(ctx, { x: bx, y: by, w: Math.max(5, bw * clamp01(sh.actT / TUNE.actSeconds)), h: 5 }, 3); ctx.fill();
  }
  // spare plates (perform / watch)
  if (pl.mode !== 'practice') {
    const r = Math.min(26, P.pause.w * 0.45), step = r * 2.5, n = TUNE.maxBreaks;
    const right = P.spares.x;
    for (let i = 0; i < n; i++) spareIcon(ctx, right - r - (n - 1 - i) * step, P.spares.y, r, i < sh.breaks);
  }
  // buttons
  const dis = pl.mode === 'auto' || (sh.thinkCool > 0 && pl.mode !== 'practice') || pl.thinkT > 0;
  if (pl.mode !== 'auto') {
    button(ctx, P.think, '', { kind: dis ? 'disabled' : 'quiet', icon: 'think', rad: P.think.h * 0.3 });
    if (sh.thinkCool > 0 && pl.mode !== 'practice') {
      ctx.save(); ctx.fillStyle = 'rgba(244,207,106,0.55)'; const f = clamp01(sh.thinkCool / TUNE.thinkCooldown);
      ctx.fillRect(P.think.x + 8, P.think.y + P.think.h - 8, (P.think.w - 16) * (1 - f), 4); ctx.restore();
    }
  }
  button(ctx, P.pause, '', { kind: 'quiet', icon: 'pause', rad: P.pause.h * 0.3 });
}

// ---- the coach panel: what the computer is doing in Watch and Learn --------------------------------------------------------------------------
function drawCoach(ctx, st, pl, L) {
  const P = L.play, ai = pl.ai, sh = pl.show, c = P.coach;
  panel(ctx, c, { fill: 'rgba(14,4,14,0.84)', stroke: 'rgba(244,207,106,0.4)', rad: 20 });
  const pad = 20, tw = c.w - pad * 2 - (ai.phase === 'think' || ai.phase === 'reveal' ? P.skip.w + 10 : 0);
  const num = (i) => P.num[i];
  const strip = c.h < 100;
  if (strip) {                                         // landscape: one line along the bottom
    const cy = c.y + c.h / 2, hasBtn = ai.phase === 'think' || ai.phase === 'reveal', mw = tw - 10;
    if (ai.phase === 'think') {
      const x = urgency(sh)[0];
      txt(ctx, `THINK ${Math.ceil(Math.max(0, st.prefs.thinkSec - ai.t))}`, c.x + pad, cy, 24, PAL.gold, { weight: 800 });
      if (x) txt(ctx, `Most urgent: pole ${num(x.pole)} (${TYPES[x.type].name}), ${Math.round(x.e * 100)}%, falls in ${x.tFall.toFixed(1)} s`, c.x + pad + 120, cy, 22, PAL.text, { weight: 600, maxW: mw - 120 });
    } else if (ai.phase === 'reveal' || ai.phase === 'act') {
      const p = ai.plan, pt = p && sh.poles[p.pole].plate;
      txt(ctx, 'REVEAL', c.x + pad, cy, 24, '#ffe27a', { weight: 800 });
      if (p && pt) txt(ctx, `Whip pole ${num(p.pole)} now: ${Math.round(pt.e * 100)}% is inside the Perfect band, and it falls first.${pt.type === 'jade' ? ' Jade: tap twice.' : ''}`, c.x + pad + 120, cy, 22, PAL.text, { weight: 600, maxW: mw - 120 });
    } else {
      txt(ctx, 'WATCHING', c.x + pad, cy, 24, PAL.dim, { weight: 800 });
      txt(ctx, 'The computer whips each plate as it enters the gold band.', c.x + pad + 140, cy, 22, PAL.text, { weight: 500, maxW: mw - 140 });
    }
    if (hasBtn) button(ctx, P.skip, 'Next', { kind: 'primary', size: 22, icon: 'skip' });
    return;
  }
  if (ai.phase === 'think') {
    const left = Math.max(0, st.prefs.thinkSec - ai.t);
    txt(ctx, `THINK  ${Math.ceil(left)}`, c.x + pad, c.y + 30, 24, PAL.gold, { weight: 800 });
    const u = urgency(sh).slice(0, c.h > 150 ? 3 : 2);
    const size = c.h > 150 ? 24 : 20;
    u.forEach((x, k) => {
      const z = zoneOf(x.e), label = z === 'perfect' ? 'in the Perfect band' : z === 'good' ? 'in the sweet band' : z === 'late' ? 'very low' : z === 'early' ? 'a little early' : 'still fast';
      // shorter wording when the full line would not fit beside the Next button (narrow phone, big text zoom)
      const nm = `Pole ${num(x.pole)} (${TYPES[x.type].name})`, pc = `${Math.round(x.e * 100)}%`, ts = `${(x.tFall).toFixed(1)} s`;
      ctx.font = `600 ${Math.max(size, 11.5 / Math.max(0.2, host.px))}px ${UI}`;
      const opts = [`${k === 0 ? 'Most urgent: ' : ''}${nm}: ${pc}, falls in ${ts}, ${label}`, `${nm}: ${pc}, falls in ${ts}, ${label}`, `Pole ${num(x.pole)}: ${pc}, falls in ${ts}`, `Pole ${num(x.pole)}: ${pc}, ${ts}`];
      const line = opts.find((o) => ctx.measureText(o).width <= tw) ?? opts[opts.length - 1];
      txt(ctx, line, c.x + pad, c.y + 30 + (k + 1) * (size + 12), size, k === 0 ? PAL.text : PAL.dim, { weight: 600, maxW: tw });
    });
    ctx.fillStyle = 'rgba(255,240,220,0.14)'; rrect(ctx, { x: c.x + pad, y: c.y + c.h - 16, w: tw, h: 5 }, 3); ctx.fill();
    ctx.fillStyle = PAL.gold; rrect(ctx, { x: c.x + pad, y: c.y + c.h - 16, w: Math.max(5, tw * clamp01(ai.t / st.prefs.thinkSec)), h: 5 }, 3); ctx.fill();
  } else if (ai.phase === 'reveal' || ai.phase === 'act') {
    const p = ai.plan, pole = p && sh.poles[p.pole];
    const pt = pole && pole.plate ? pole.plate : null;
    txt(ctx, 'REVEAL', c.x + pad, c.y + 30, 24, '#ffe27a', { weight: 800 });
    if (p && pt) {
      const size = c.h > 150 ? 26 : 21;
      ctx.font = `600 ${size}px ${UI}`;
      const msg = `Whip pole ${num(p.pole)} now. Its ${TYPES[pt.type].name.toLowerCase()} plate is at ${Math.round(pt.e * 100)}%, inside the Perfect band (${Math.round(TUNE.perfLo * 100)}% to ${Math.round(TUNE.perfHi * 100)}%), and it falls first of ${Math.max(1, p.list.length)}.`;
      const lines = wrap(ctx, msg, tw).slice(0, c.h > 150 ? 3 : 2);
      lines.forEach((ln, k) => txt(ctx, ln, c.x + pad, c.y + 66 + k * (size + 8), size, PAL.text, { weight: 600 }));
      if (pt.type === 'jade') txt(ctx, 'Jade needs a double whip: two quick taps.', c.x + pad, c.y + c.h - 18, 19, '#b8f0d4', { weight: 700, maxW: tw });
    }
  } else {
    txt(ctx, 'WATCHING', c.x + pad, c.y + 30, 24, PAL.dim, { weight: 800 });
    const size = c.h > 150 ? 24 : 20;
    ctx.font = `600 ${size}px ${UI}`;
    wrap(ctx, 'The computer whips each plate as it enters the gold band. Lesson steps stop the clock and explain the choice.', tw).slice(0, 2).forEach((ln, k) => txt(ctx, ln, c.x + pad, c.y + 66 + k * (size + 8), size, PAL.text, { weight: 500 }));
  }
  if (ai.phase === 'think' || ai.phase === 'reveal') button(ctx, P.skip, 'Next', { kind: 'primary', size: 24, icon: 'skip' });
}

// ---- the whole show screen --------------------------------------------------------------------------------------------------------------------------
export function renderPlay(ctx, st, L, view, meta, pauseItems) {
  const pl = st.pl;
  if (!pl) return;
  const { w, h } = L, P = L.play, sh = pl.show, t = sh.anim;
  meta.previewBadge = { x: L.S.x + L.S.w / 2, y: P.hud.y + P.hud.h + 6, align: 'center' };
  ctx.save();
  if (pl.shake > 0 && !st.prefs.calm) ctx.translate(Math.sin(t * 70) * 5 * pl.shake, Math.cos(t * 83) * 4 * pl.shake);
  v3.scene = 'play'; v3.scrim = 0; v3.heroRect = null;
  if (v3.on) ctx.clearRect(-20, -20, w + 40, h + 40);
  else {
    drawStage(ctx, w + 20, h + 20, P.floorY);
    drawLights(ctx, w, h, P.floorY, t, st.prefs.calm);
    const lanternY = P.stage.y + Math.max(70, L.mode === 'wide' ? 56 : 90);
    drawLantern(ctx, L.S.x + Math.max(34, w * 0.07), lanternY, Math.min(30, w * 0.04), t, 0.6);
    drawLantern(ctx, L.S.x + L.S.w - Math.max(34, w * 0.07), lanternY, Math.min(30, w * 0.04), t + 2, 0.6);
  }
  // poles, back row first
  const order = P.slots.slice().sort((a, b) => b.row - a.row || a.cx - b.cx);
  for (const s of order) drawOne(ctx, st, pl, L, s, sh.poles[s.i], P.num[s.i]);
  // cues
  if (pl.hint && pl.mode !== 'auto') drawCue(ctx, st, pl, L, pl.hint.pole, 'hint', t);
  if (pl.ai && (pl.ai.phase === 'reveal' || pl.ai.phase === 'act') && pl.ai.plan) drawCue(ctx, st, pl, L, pl.ai.plan.pole, 'plan', t);
  if (pl.ai && pl.ai.phase === 'think') { const u = urgency(sh)[0]; if (u) drawCue(ctx, st, pl, L, u.pole, 'hint', t); }
  // tap rings
  for (const f of pl.tapFx) {
    const u = f.age / 0.45;
    ctx.save(); ctx.globalAlpha = 1 - u; ctx.strokeStyle = f.g === 'perfect' ? '#fff0b0' : f.g === 'jolt' ? '#ff6b6b' : '#ffc857'; ctx.lineWidth = 5 * (1 - u) + 1;
    ctx.beginPath(); ctx.ellipse(f.x, f.y, f.r * (1 + u * 1.2), f.r * (0.5 + u * 0.6), 0, 0, TAU); ctx.stroke(); ctx.restore();
  }
  if (!v3.on) drawParticles(ctx, pl.parts);
  // popups
  for (const p of pl.pops) {
    const u = p.age / 0.9, a = u < 0.15 ? u / 0.15 : 1 - Math.max(0, (u - 0.6) / 0.4);
    ctx.save(); ctx.globalAlpha = clamp01(a);
    const half = Math.min(w * 0.25, p.size * 0.36 * p.text.length) + 8, px = Math.min(L.S.x + L.S.w - half, Math.max(L.S.x + half, p.x));
    txt(ctx, p.text, px, p.y - u * 50, p.size, p.col, { align: 'center', weight: 800, font: DISPLAY, stroke: 7, maxW: w * 0.5 });
    ctx.restore();
  }
  ctx.restore();
  drawHud(ctx, st, pl, L);
  if (pl.ai) drawCoach(ctx, st, pl, L);
  else if (pl.thinkT > 0) {
    const c = P.coach; ctx.save(); ctx.globalAlpha = 0.9;
    chip(ctx, L.S.x + L.S.w / 2, P.hud.y + P.hud.h + 34, 'THINK: time slows. Whip the ringed plate.', 24, { align: 'center', fill: 'rgba(14,4,14,0.85)', stroke: '#7fe8ff' });
    ctx.restore(); void c;
  }
  // act banner
  if (pl.banner) {
    const b = pl.banner, u = b.t / 2, a = u < 0.12 ? u / 0.12 : u > 0.75 ? 1 - (u - 0.75) / 0.25 : 1;
    const x = P.banner.x, y = P.banner.y, sc = 0.9 + 0.1 * easeOut(clamp01(u * 5));
    ctx.save(); ctx.globalAlpha = clamp01(a); ctx.translate(x, y); ctx.scale(sc, sc);
    const bw = Math.min(w - 60, 560);
    if (v3.on) { v3.panels.push({ r: { x: x - bw / 2 * sc, y: y - 62 * sc, w: bw * sc, h: (b.sub ? 150 : 110) * sc }, rad: 26, kind: 'banner', a: clamp01(a) }); }
    else {
    ctx.fillStyle = 'rgba(14,2,10,0.55)';
    rrect(ctx, { x: -bw / 2, y: -62, w: bw, h: b.sub ? 150 : 110 }, 26); ctx.fill();
    ctx.strokeStyle = 'rgba(244,207,106,0.7)'; ctx.lineWidth = 3; rrect(ctx, { x: -bw / 2, y: -62, w: bw, h: b.sub ? 150 : 110 }, 26); ctx.stroke();
    }
    txt(ctx, b.text, 0, -8, 62, PAL.gold, { align: 'center', font: DISPLAY, weight: 700, stroke: 8, maxW: bw - 40 });
    if (b.sub) txt(ctx, b.sub, 0, 54, 28, PAL.text, { align: 'center', weight: 700 });
    ctx.restore();
  }
  if (pl.paused) renderPauseMenu(ctx, st, L, pauseItems(pl));
}

function renderPauseMenu(ctx, st, L, items) {
  const M = menuRects(L, items.length);
  if (v3.on) v3.scrim = 0.62; else { ctx.fillStyle = 'rgba(6,0,6,0.62)'; ctx.fillRect(0, 0, L.w, L.h); }
  panel(ctx, M.panel, { fill: 'rgba(24,6,16,0.95)', stroke: 'rgba(244,207,106,0.5)' });
  txt(ctx, 'Paused', M.panel.x + M.panel.w / 2, M.panel.y + 62, 54, PAL.gold, { align: 'center', font: DISPLAY, weight: 700, stroke: 7 });
  const labels = { resume: 'Resume', restart: 'Start again', rules: 'Rules', quit: 'Leave the show' };
  items.forEach((it, i) => button(ctx, M.btns[i], labels[it] ?? it, { kind: it === 'resume' ? 'primary' : 'ghost', size: 32 }));
}

export { plateColors, rateFor, rgba };
