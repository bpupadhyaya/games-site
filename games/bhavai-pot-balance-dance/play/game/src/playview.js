// The playing screen: the courtyard stage (dancer, tower, drummer, effects), the step chart, the HUD and the overlays.
// Everything here only reads state; game.js owns the flow. `V` is the view-state (camera zoom, particles, falling pots, popups).
import { cam3 } from './cam3.js';
import { gl } from './layout.js';
import { PAL, UI, DISPLAY, TAU, clamp, ease, hash, makeCam, sx, sy, drawCourtyard, drawRain, drawParticles, rgba, mixHex } from './art.js';
import { drawDancer, drawTower, drawDrummer, drawFlyingPot, drawFallingPot, drawPotLocal } from './figure.js';
import { txt, button, panel, rrect, chip, icon } from './ui.js';
import { SLOTS } from './courses.js';
import { beatTime, catchX, fallLimit, mult, SCORE, windNow } from './sim.js';

export const newView = () => ({ evLog: [], evSeq: 0, ppm: 0, parts: [], falling: [], flyBack: null, pops: [], shake: 0, spin: 0, spinDir: 1, pulse: 0, banner: null, flash: 0, potPop: 0, lastBeat: -1, beatCount: 0, drummerHit: 0, t: 0 });

const GRADE = { perfect: ['PERFECT', '#ffe07a'], good: ['GOOD', '#8ff0e6'], miss: ['MISS', '#ff8a7a'] };

export function targetPpm(S, n, wide) {
  const need = 1.76 + 0.265 * Math.max(n, 4) + (wide ? 1.5 : 0.8);
  return clamp(Math.min((S.h * 0.8) / need, S.w / (wide ? 3.6 : 3.7)), 40, 240);
}

// ---- the stage ----------------------------------------------------------------------------------------------------------------------
export function renderStage(ctx, V, W, S, t, o = {}) {
  const ppm = V.ppm || targetPpm(S, W.n, S.w > S.h);
  const cam = makeCam(S, ppm);
  if (gl.on) {                                  // the WebGL stage draws the courtyard, people, pots and effects: only screen-space glass here
    const c3 = cam3(cam.ox, cam.oy, ppm);
    if (V.flash > 0.01 && !o.calm) { ctx.fillStyle = `rgba(255,120,100,${V.flash * 0.22})`; ctx.fillRect(S.x, S.y, S.w, S.h); }
    return Object.assign(cam, { proj: c3.proj });
  }
  ctx.save();
  ctx.beginPath(); ctx.rect(S.x, S.y, S.w, S.h); ctx.clip();
  if (V.shake > 0.01 && !o.calm) ctx.translate((hash(Math.floor(t * 60)) - 0.5) * V.shake * 10, (hash(Math.floor(t * 60) + 9) - 0.5) * V.shake * 8);
  const bl = W.bl, ph = ((W.t - W.t0) / bl) % 1, bp = ph < 0 ? ph + 1 : ph;
  drawCourtyard(ctx, cam, W.act, t, bp);
  if (W.act.rain) drawRain(ctx, S, t, ppm);
  // drummer (left) and a small audience at the edges
  const dpx = S.x + Math.max(0.55 * ppm, S.w * 0.14), floor = cam.oy + 0.38 * ppm;
  for (let i = 0; i < 6; i++) {
    const side = i < 3 ? -1 : 1, x = cam.ox + side * (1.55 + (i % 3) * 0.42) * ppm + (i % 2 ? 0.1 * ppm : 0), y = cam.oy + (0.55 + (i % 3) * 0.08) * ppm;
    const bob = Math.sin(t * 2.2 + i * 1.7 + bp * 3) * 0.015 * ppm, r = 0.17 * ppm;
    ctx.fillStyle = i % 2 ? '#0a1f3a' : '#12304f';
    ctx.beginPath(); ctx.arc(x, y - 0.5 * ppm + bob, r * 0.75, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x, y + bob, r * 1.4, r * 1.8, 0, Math.PI, TAU); ctx.fill();
    ctx.fillStyle = [PAL.marigold, PAL.rose, PAL.turq][i % 3]; ctx.beginPath(); ctx.ellipse(x, y - 0.5 * ppm + bob - r * 0.5, r * 0.8, r * 0.3, 0, Math.PI, TAU); ctx.fill();
  }
  // the drummer sits in front of the audience, never hidden behind a silhouette
  drawDrummer(ctx, dpx, floor, ppm * 0.62, t, V.beatCount, bp, true);
  // targets: the next two footprints glow on the floor
  if (!o.noTargets) {
    let shown = 0;
    for (let i = W.bi; i < W.beats.length && shown < 2; i++) {
      const b = W.beats[i];
      if (b.type !== 'step') continue;
      const tb = beatTime(W, i), k = clamp(1 - (tb - W.t) / (bl * 3), 0, 1), x = sx(cam, SLOTS[b.slot]), y = cam.oy - 0.06 * ppm;
      const a = shown === 0 ? 0.9 : 0.45, r = (0.2 + 0.1 * (1 - k)) * ppm;
      ctx.globalAlpha = a * (0.55 + 0.45 * k);
      ctx.fillStyle = shown === 0 ? PAL.marigoldHi : PAL.turqHi; ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.33, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(x, y, r * (1.0 + 0.5 * (1 - k)), r * 0.33 * (1.0 + 0.5 * (1 - k)), 0, 0, TAU); ctx.stroke();
      ctx.globalAlpha = 1; shown += 1;
    }
  }
  // the guide: the spot under the swaying tower
  if (o.guide) {
    const cx = catchX(W), gx = sx(cam, clamp(cx, -1.6, 1.6)), gy = cam.oy + 0.12 * ppm;
    ctx.fillStyle = 'rgba(255,224,122,0.95)'; ctx.strokeStyle = '#7a4a00'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(gx - 0.12 * ppm, gy + 0.2 * ppm); ctx.lineTo(gx + 0.12 * ppm, gy + 0.2 * ppm); ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  // dancer + tower
  const side = V.beatCount % 2 === 0 ? 1 : -1;
  const d = { x: W.x, v: W.v, th: W.th, om: W.om, t, bp, side, spin: V.spin, n: W.n, fall: V.shake, look: 0 };
  drawDancer(ctx, cam, d, W.ai % 2, true);
  const grow = 1 + V.potPop * 0.0;
  drawTower(ctx, cam, { x: W.x, th: W.th, om: W.om, n: W.n, t, lift: grow });
  // an incoming pot handed up before a pot beat
  for (let i = W.bi; i < Math.min(W.beats.length, W.bi + 2); i++) {
    if (W.beats[i].type !== 'pot') continue;
    const dtb = beatTime(W, i) - W.t, span = Math.min(0.55, bl * 0.9);
    if (dtb > span || dtb < 0) break;
    const u = ease(1 - dtb / span), from = (W.ai % 2 ? -1 : 1) * 2.2, topY = 1.76 + 0.265 * W.n + 0.14;
    drawFlyingPot(ctx, cam, from, W.x, topY, u, W.n);
    break;
  }
  if (V.flyBack) {
    const u = V.flyBack.age / 0.6;
    if (u < 1) drawFlyingPot(ctx, cam, V.flyBack.x, V.flyBack.to, 1.76 + 0.265 * V.flyBack.n + 0.14 + 0.2 * (1 - u), ease(u), V.flyBack.i);
  }
  for (const f of V.falling) drawFallingPot(ctx, cam, f);
  drawParticles(ctx, V.parts, cam);
  // soft vignette
  const vg = ctx.createRadialGradient(cam.ox, S.y + S.h * 0.5, Math.min(S.w, S.h) * 0.35, cam.ox, S.y + S.h * 0.5, Math.max(S.w, S.h) * 0.8);
  vg.addColorStop(0, 'rgba(5,10,30,0)'); vg.addColorStop(1, 'rgba(5,10,30,0.4)');
  ctx.fillStyle = vg; ctx.fillRect(S.x, S.y, S.w, S.h);
  if (V.flash > 0.01) { ctx.fillStyle = `rgba(255,120,100,${V.flash * 0.28})`; ctx.fillRect(S.x, S.y, S.w, S.h); }
  // wind streaks
  const wn = windNow(W);
  if (Math.abs(wn) > 0.05) {
    ctx.strokeStyle = `rgba(255,255,255,${Math.min(0.5, Math.abs(wn) * 1.4)})`; ctx.lineWidth = 2;
    for (let i = 0; i < 5; i++) { const y = S.y + S.h * (0.12 + 0.12 * i) + Math.sin(t + i) * 6, x = S.x + ((t * 120 * Math.sign(wn) + i * 160) % (S.w + 120) + S.w + 120) % (S.w + 120) - 60; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 46 * Math.sign(wn), y + Math.sin(t * 3 + i) * 3); ctx.stroke(); }
  }
  ctx.restore();
  return cam;
}

// ---- the step chart -----------------------------------------------------------------------------------------------------------------
function foot(ctx, x, y, s, col, rot = 0, left = false) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.fillStyle = col;
  ctx.beginPath(); ctx.ellipse(0, s * 0.35, s * 0.38, s * 0.62, 0, 0, TAU); ctx.fill();
  const m = left ? -1 : 1;
  for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc(m * (-0.28 + i * 0.14) * s, -s * (0.45 + (i === 0 || i === 4 ? 0 : 0.1) - Math.abs(i - 1.5) * 0.02), s * (i === 0 ? 0.16 : 0.12), 0, TAU); ctx.fill(); }
  ctx.restore();
}
export function chartX(C, xm, lane) { const half = C.w / 2 - 26; return C.x + C.w / 2 + (clamp(xm, -lane, lane) / lane) * half; }

export function renderChart(ctx, C, W, lane, o = {}) {
  panel(ctx, C, { rad: 22 });
  ctx.save(); rrect(ctx, C, 22); ctx.clip();
  const hitY = C.y + C.h * 0.8, look = o.look ?? 3.4, pps = (hitY - C.y - 26) / look;
  // lanes
  for (let i = 0; i < SLOTS.length; i++) {
    const x = chartX(C, SLOTS[i], lane);
    ctx.fillStyle = i % 2 ? 'rgba(143,240,230,0.05)' : 'rgba(255,255,255,0.025)';
    ctx.fillRect(x - (C.w - 52) / (SLOTS.length * 2 + 2) * 1.0, C.y, (C.w - 52) / (SLOTS.length + 1), C.h);
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.09)'; ctx.lineWidth = 1.5;
  for (let i = 0; i < SLOTS.length; i++) { const x = chartX(C, SLOTS[i], lane); ctx.beginPath(); ctx.moveTo(x, C.y); ctx.lineTo(x, C.y + C.h); ctx.stroke(); }
  // beat lines
  const b0 = Math.floor((W.t - W.t0) / W.bl);
  for (let b = b0 - 1; b < b0 + Math.ceil(look / W.bl) + 2; b++) {
    const tb = W.t0 + b * W.bl, y = hitY - (tb - W.t) * pps;
    if (y < C.y || y > C.y + C.h) continue;
    ctx.strokeStyle = b % 4 === 0 ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.07)'; ctx.lineWidth = b % 4 === 0 ? 2 : 1;
    ctx.beginPath(); ctx.moveTo(C.x + 10, y); ctx.lineTo(C.x + C.w - 10, y); ctx.stroke();
  }
  // path through the coming footprints
  let prev = null;
  ctx.setLineDash([6, 8]); ctx.lineWidth = o.reveal ? 4 : 2; ctx.strokeStyle = o.reveal ? 'rgba(255,224,122,0.85)' : 'rgba(255,224,122,0.28)';
  ctx.beginPath(); let started = false;
  for (let i = Math.max(0, W.bi - 1); i < W.beats.length; i++) {
    const tb = beatTime(W, i), y = hitY - (tb - W.t) * pps;
    if (y < C.y - 10) break;
    if (W.beats[i].type !== 'step' || y > hitY + 30) continue;
    const x = chartX(C, SLOTS[W.beats[i].slot], lane);
    if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
    prev = x;
  }
  ctx.stroke(); ctx.setLineDash([]); void prev;
  // the rows
  let n = 0;
  for (let i = Math.max(0, W.bi - 2); i < W.beats.length; i++) {
    const b = W.beats[i], tb = beatTime(W, i), y = hitY - (tb - W.t) * pps;
    if (y < C.y - 30) break;
    if (y > C.y + C.h + 30) continue;
    const past = i < W.bi, cx = chartX(C, SLOTS[b.slot ?? 2], lane), s = clamp(C.w * 0.055, 15, 26);
    const fade = past ? clamp(1 - (hitY - y) / -80 - 0, 0, 1) : 1;
    ctx.globalAlpha = past ? clamp(1 + (y - hitY) / 70, 0, 1) : 1;
    if (b.type === 'step') {
      let col = '#ffd45a';
      if (past) { const j = W.judged?.[i]; col = j === 'perfect' ? '#8ff0e6' : j === 'good' ? '#9be37a' : '#ff7a6a'; }
      else if (o.reveal) col = '#ffe9a0';
      ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.beginPath(); ctx.arc(cx, y, s * 1.15, 0, TAU); ctx.fill();
      foot(ctx, cx, y, s * 0.95, col, 0, i % 2 === 0);
      if (o.reveal && !past && n < 8) { txt(ctx, String(++n), cx + s * 1.2, y - s * 0.9, Math.max(14, s * 0.75), '#fff', { weight: 800, stroke: 4 }); }
    } else if (b.type === 'turn') {
      const ccx = C.x + C.w / 2, r = s * 1.15;
      ctx.strokeStyle = past ? 'rgba(255,255,255,0.3)' : '#ff6f9c'; ctx.lineWidth = Math.max(4, s * 0.28); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(ccx, y, r, b.dir > 0 ? -2.4 : -0.74, b.dir > 0 ? 0.6 : -3.9, b.dir < 0); ctx.stroke();
      const ax = ccx + Math.cos(b.dir > 0 ? 0.6 : -3.9) * r, ay = y + Math.sin(b.dir > 0 ? 0.6 : -3.9) * r;
      ctx.fillStyle = ctx.strokeStyle; ctx.beginPath(); ctx.arc(ax, ay, s * 0.34, 0, TAU); ctx.fill();
      txt(ctx, 'SPIN', ccx, y + r + s * 0.9, Math.max(13, s * 0.62), past ? 'rgba(255,255,255,0.35)' : '#ffb0c8', { align: 'center', weight: 800, stroke: 4 });
    } else if (b.type === 'pot') {
      const ccx = C.x + C.w / 2;
      ctx.save(); ctx.translate(ccx, y); ctx.globalAlpha *= past ? 0.45 : 1;
      drawPotLocal(ctx, s * 3.2, 0); ctx.restore();
      txt(ctx, 'POT', ccx + s * 2.4, y, Math.max(14, s * 0.8), past ? 'rgba(255,255,255,0.35)' : '#ffd45a', { weight: 800, stroke: 4 });
    } else if (b.type === 'rest') {
      ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(cx - s * 0.5, y); ctx.lineTo(cx + s * 0.5, y); ctx.stroke();
    }
    ctx.globalAlpha = 1; void fade;
  }
  // the hit line and the head marker
  const pulse = o.pulse ?? 0;
  const hg = ctx.createLinearGradient(0, hitY - 8, 0, hitY + 8); hg.addColorStop(0, 'rgba(255,224,122,0)'); hg.addColorStop(0.5, `rgba(255,224,122,${0.55 + 0.4 * pulse})`); hg.addColorStop(1, 'rgba(255,224,122,0)');
  ctx.fillStyle = hg; ctx.fillRect(C.x, hitY - 8, C.w, 16);
  const hx = chartX(C, W.x, lane);
  ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.beginPath(); ctx.arc(hx, hitY, 24, 0, TAU); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.strokeStyle = PAL.marigold; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(hx, hitY, 13, 0, TAU); ctx.fill(); ctx.stroke();
  // tilt gauge under the line: how far the tower leans against the limit
  const gy = C.y + C.h - 22, gw = C.w - 60, lim = fallLimit(W.n, W.practice), gx = C.x + C.w / 2;
  ctx.fillStyle = 'rgba(255,255,255,0.1)'; rrect(ctx, { x: gx - gw / 2, y: gy - 7, w: gw, h: 14 }, 7); ctx.fill();
  const warn = clamp(Math.abs(W.th) / lim, 0, 1);
  ctx.fillStyle = 'rgba(143,240,230,0.35)'; ctx.fillRect(gx - 2, gy - 9, 4, 18);
  ctx.fillStyle = warn > 0.75 ? PAL.warn : warn > 0.5 ? PAL.marigold : PAL.turqHi;
  ctx.beginPath(); ctx.arc(gx + (W.th / lim) * (gw / 2), gy, 11, 0, TAU); ctx.fill();
  ctx.restore();
}

// ---- HUD -----------------------------------------------------------------------------------------------------------------------------
export function renderHud(ctx, H, W, st) {
  panel(ctx, H, { rad: 22 });
  const pad = 14, big = clamp(H.h * 0.38, 28, 44);
  txt(ctx, String(W.score), H.x + pad, H.y + H.h * 0.34, big, PAL.cream, { font: DISPLAY, weight: 600, maxW: H.w * 0.5 });
  const m = mult(W.combo);
  if (W.combo > 1) chip(ctx, H.x + H.w - pad, H.y + H.h * 0.3, `x${m.toFixed(m % 1 ? 1 : 0)}  ${W.combo}`, clamp(H.h * 0.17, 14, 20), { align: 'right', fill: 'rgba(255,181,46,0.25)', stroke: 'rgba(255,224,122,0.6)', color: PAL.marigoldHi });
  // pots
  const target = st.target, cell = clamp(Math.min((H.w - pad * 2) / Math.max(target, 8), H.h * 0.32), 12, 26);
  for (let i = 0; i < target; i++) {
    const x = H.x + pad + cell * 0.5 + i * cell * 1.05, y = H.y + H.h * 0.74;
    ctx.save(); ctx.translate(x, y); ctx.globalAlpha = i < W.n ? 1 : 0.2;
    ctx.scale(1, 1); drawPotLocal(ctx, cell * 2.1, i); ctx.restore();
  }
  ctx.globalAlpha = 1;
  // progress
  const pr = clamp(W.beatCount / Math.max(1, W.beats.length), 0, 1);
  ctx.fillStyle = 'rgba(255,255,255,0.12)'; rrect(ctx, { x: H.x + pad, y: H.y + H.h - 8, w: H.w - pad * 2, h: 4 }, 2); ctx.fill();
  ctx.fillStyle = PAL.turqHi; rrect(ctx, { x: H.x + pad, y: H.y + H.h - 8, w: (H.w - pad * 2) * pr, h: 4 }, 2); ctx.fill();
}

const BANNER_COL = { good: '#8ff0e6', bad: '#ff9a8a', gold: '#ffe07a' };
export function renderOverlays(ctx, pl, L, cam) {
  const S = L.play.stage, V = pl.V, W = pl.W;
  // popups
  for (const p of V.pops) {
    const u = p.age / 0.85, pp = cam.proj ? cam.proj(p.x, 1.2 + p.rise, 0) : { x: sx(cam, p.x), y: sy(cam, 1.2 + p.rise) }, x = pp.x, y = pp.y - u * 46;
    ctx.globalAlpha = clamp(1 - u * u, 0, 1);
    txt(ctx, p.text, clamp(x, S.x + 70, S.x + S.w - 70), y, p.size, p.col, { align: 'center', font: DISPLAY, weight: 600, stroke: 7, strokeColor: 'rgba(7,24,44,0.9)' });
  }
  ctx.globalAlpha = 1;
  // count-in
  if (W.t < W.t0 && !pl.auto?.phase?.startsWith?.('th')) {
    const left = Math.ceil((W.t0 - W.t) / W.bl), u = ((W.t0 - W.t) / W.bl) % 1;
    if (left >= 1 && left <= 4 && W.t >= 0) txt(ctx, String(left), S.x + S.w / 2, S.y + S.h * 0.38, S.h * 0.2 * (0.8 + 0.3 * (1 - u)), PAL.marigoldHi, { align: 'center', font: DISPLAY, weight: 700, stroke: 12, strokeColor: 'rgba(7,24,44,0.8)' });
  }
  if (V.banner) {
    const b = V.banner, a = clamp(Math.min(b.t / 0.15, (1.6 - b.t) / 0.4), 0, 1);
    ctx.globalAlpha = a;
    txt(ctx, b.text, S.x + S.w / 2, S.y + S.h * 0.3, clamp(S.w * 0.095, 30, 66), BANNER_COL[b.kind] ?? '#fff', { align: 'center', font: DISPLAY, weight: 700, stroke: 10, strokeColor: 'rgba(7,24,44,0.85)', maxW: S.w - 40 });
    ctx.globalAlpha = 1;
  }
}

// The Think / Reveal / hint card across the top of the stage.
export function renderCard(ctx, pl, L) {
  const S = L.play.stage, a = pl.auto, card = a && a.phase !== 'act' ? a : null, hint = pl.hintCard;
  if (!card && !hint) return;
  const Hh = L.play.hud, w = Math.min(S.w - 32, 640), h = 112, x = S.x + (S.w - w) / 2, y = Math.max(S.y + 14, Hh.y + Hh.h + 8);
  panel(ctx, { x, y, w, h }, { fill: 'rgba(8,22,44,0.9)', rad: 20, stroke: 'rgba(255,224,122,0.6)' });
  if (card) {
    const label = card.phase === 'think' ? 'THINK' : 'REVEAL';
    txt(ctx, label, x + 22, y + 30, 22, card.phase === 'think' ? PAL.turqHi : PAL.marigoldHi, { weight: 800 });
    txt(ctx, `${Math.max(0, card.timer).toFixed(1)} s`, x + w - 22, y + 30, 22, PAL.text, { align: 'right', weight: 800 });
    txt(ctx, card.title, x + 22, y + 62, 24, PAL.cream, { weight: 800, maxW: w - 44 });
    txt(ctx, card.tip, x + 22, y + 92, 18, PAL.dim, { weight: 600, maxW: w - 44 });
  } else {
    txt(ctx, 'HINT', x + 22, y + 30, 22, PAL.marigoldHi, { weight: 800 });
    txt(ctx, hint.title, x + 22, y + 66, 21, PAL.cream, { weight: 700, maxW: w - 44 });
    txt(ctx, hint.tip, x + 22, y + 94, 17, PAL.dim, { weight: 600, maxW: w - 44 });
  }
}

export function renderPlay(ctx, pl, L, view, meta, pauseItems, drawPauseMenu, st) {
  const w = view?.width ?? meta.width, h = view?.height ?? meta.height, P = L.play, W = pl.W;
  if (!gl.on) { ctx.fillStyle = '#07182c'; ctx.fillRect(0, 0, w, h); }
  const guide = pl.mode === 'practice' || st.prefs.guide || !!pl.reveal;
  const cam = renderStage(ctx, pl.V, W, P.stage, st.t, { guide, calm: st.prefs.calm });
  renderHud(ctx, P.hud, W, { target: pl.target });
  renderChart(ctx, P.chart, W, P.lane, { reveal: !!pl.reveal, pulse: pl.V.pulse, look: pl.reveal ? 5.2 : 3.4 });
  renderOverlays(ctx, pl, L, cam);
  renderCard(ctx, pl, L);
  button(ctx, P.pause, '', { icon: 'pause', kind: 'quiet' });
  if (pl.mode === 'practice' || pl.mode === 'dance') button(ctx, P.hint, '', { icon: 'bulb', kind: pl.mode === 'practice' ? 'quiet' : 'disabled' });
  else button(ctx, P.hint, '', { icon: 'eye', kind: 'disabled' });
  if (pl.paused || pl.over) drawPauseMenu(ctx, st, L, pauseItems(), pl);
}

export const ordinal = (i) => ['1st', '2nd', '3rd', '4th'][i] ?? `${i + 1}th`;
export function fmtTime(s) { const m = Math.floor(s / 60), r = Math.floor(s % 60); return `${m}:${String(r).padStart(2, '0')}`; }
export { GRADE, rgba, mixHex, icon, SCORE, UI, lerpSafe };
function lerpSafe(a, b, t) { return a + (b - a) * t; }
