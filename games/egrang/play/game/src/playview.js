// The playing screen: the road with its racers (four depth lanes), the step meter, the sideways rail, the progress track and the HUD.
import { PAL, UI, DISPLAY, rgba, clamp, ease, hash, makeCam, proj, laneScale, LANE_DY, drawBackdrop, drawRoad, drawTerrain, drawRoadside, drawParticles, drawForeground } from './art.js';
import { txt, button, panel, rrect, chip, icon } from './ui.js';
import { stageScale } from './layout.js';
import { PHYS, ZONES, wPredict, uPred, landingX, standings, bumpTarget, isGood, featureAhead, swingDur } from './sim.js';
import { tileAt, groundH, LOOKS } from './courses.js';
import { walkerJoints, drawWalker } from './figure.js';
import { COURSES } from './courses.js';
import { gl3d } from './gl.js';

const TAU = Math.PI * 2;
export const UMIN = -0.08, UMAX = PHYS.U_FALL + 0.05;
export const GRADE_TEXT = { perfect: 'PERFECT', good: 'GOOD', trip: 'TRIP', slip: 'SLIP', splash: 'SPLASH' };
export const GRADE_COL = { perfect: '#ffe07a', good: '#8ef0dc', trip: '#ffb43c', slip: '#9fd8ff', splash: '#7fd0ff' };
const ordinal = (n) => ['1st', '2nd', '3rd', '4th'][n] ?? `${n + 1}th`;
export { ordinal };

// ---- the step meter -----------------------------------------------------------------------------------------------------------------
export function drawMeter(ctx, r, u, o = {}) {
  const X = (v) => r.x + 14 + clamp((v - UMIN) / (UMAX - UMIN), 0, 1) * (r.w - 28);
  ctx.save();
  ctx.fillStyle = 'rgba(14,10,30,0.78)'; rrect(ctx, r, r.h / 2); ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,230,200,0.3)'; rrect(ctx, r, r.h / 2); ctx.stroke();
  const zones = [[UMIN, ZONES.slow, 'rgba(90,150,255,0.55)', 'SLOW'], [ZONES.slow, ZONES.steady, 'rgba(70,214,150,0.62)', 'STEADY'], [ZONES.steady, ZONES.push, 'rgba(255,190,60,0.7)', 'PUSH'], [ZONES.push, UMAX, 'rgba(240,70,60,0.72)', 'FALL']];
  const y = r.y + 7, h = r.h - 14;
  zones.forEach(([a, b, col, name], i) => {
    ctx.fillStyle = col; ctx.beginPath(); ctx.roundRect(X(a) + (i ? 1 : 0), y, X(b) - X(a) - 2, h, i === 0 ? [h / 2, 4, 4, h / 2] : i === 3 ? [4, h / 2, h / 2, 4] : 4); ctx.fill();
    if (!o.small) { ctx.font = `800 ${Math.max(11, h * 0.34)}px ${UI}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = 'rgba(10,6,20,0.62)'; if (X(b) - X(a) > 56) ctx.fillText(name, (X(a) + X(b)) / 2, y + h / 2); }
  });
  if (o.target !== undefined) {         // the performer's / hint's chosen moment
    const tx = X(o.target);
    ctx.fillStyle = '#ffe9a8'; ctx.beginPath(); ctx.moveTo(tx, y - 3); ctx.lineTo(tx + 8, y - 12); ctx.lineTo(tx - 8, y - 12); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#ffe9a8'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(tx, y - 3); ctx.lineTo(tx, y + h + 3); ctx.stroke();
  }
  const mx = X(u), warn = u > ZONES.push;
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.arc(mx + 1, r.y + r.h / 2 + 2, h * 0.5, 0, TAU); ctx.fill();
  ctx.fillStyle = warn ? '#ffd0c8' : '#fff7da'; ctx.beginPath(); ctx.arc(mx, r.y + r.h / 2, h * 0.5, 0, TAU); ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = '#3a2410'; ctx.stroke();
  ctx.restore();
}

// ---- the sideways rail ---------------------------------------------------------------------------------------------------------------
export function railX(r, w) { return r.x + r.w / 2 + clamp(w, -1.25, 1.25) * (r.w / 2 - 34); }
export function drawRail(ctx, r, wNow, wPred, o = {}) {
  const lim = o.limit ?? 1;
  ctx.save();
  ctx.fillStyle = 'rgba(14,10,30,0.78)'; rrect(ctx, r, r.h / 2); ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,230,200,0.3)'; rrect(ctx, r, r.h / 2); ctx.stroke();
  const y = r.y + 8, h = r.h - 16;
  // the bamboo bar itself
  const bg = ctx.createLinearGradient(0, y, 0, y + h); bg.addColorStop(0, '#c9d56a'); bg.addColorStop(0.5, '#a8b648'); bg.addColorStop(1, '#6d7a24');
  ctx.fillStyle = bg; ctx.beginPath(); ctx.roundRect(r.x + 16, y + h * 0.28, r.w - 32, h * 0.44, h * 0.22); ctx.fill();
  // fall zones
  ctx.fillStyle = 'rgba(240,70,60,0.5)';
  const lx = railX(r, -lim), rx = railX(r, lim);
  ctx.beginPath(); ctx.roundRect(r.x + 16, y + h * 0.28, lx - r.x - 16, h * 0.44, [h * 0.22, 0, 0, h * 0.22]); ctx.fill();
  ctx.beginPath(); ctx.roundRect(rx, y + h * 0.28, r.x + r.w - 16 - rx, h * 0.44, [0, h * 0.22, h * 0.22, 0]); ctx.fill();
  ctx.strokeStyle = 'rgba(40,24,6,0.6)'; ctx.lineWidth = 2;
  for (let i = -4; i <= 4; i++) { const X = railX(r, i * 0.25); ctx.beginPath(); ctx.moveTo(X, y + h * 0.28); ctx.lineTo(X, y + h * 0.72); ctx.stroke(); }
  // centre line
  ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(r.x + r.w / 2, y); ctx.lineTo(r.x + r.w / 2, y + h); ctx.stroke();
  // where it is now (faint) and where it will be when the stilt lands (bright)
  ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.arc(railX(r, wNow), r.y + r.h / 2, h * 0.24, 0, TAU); ctx.fill();
  const px = railX(r, wPred), bad = Math.abs(wPred) > lim * 0.8;
  ctx.fillStyle = bad ? '#ff7d6a' : '#ffe7a0'; ctx.beginPath(); ctx.arc(px, r.y + r.h / 2, h * 0.4, 0, TAU); ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = '#3a1608'; ctx.stroke();
  if (o.tap !== undefined && o.tapA > 0) { ctx.globalAlpha = o.tapA; ctx.fillStyle = '#7fe8ff'; ctx.beginPath(); ctx.arc(railX(r, o.tap), r.y + r.h / 2, h * 0.3, 0, TAU); ctx.fill(); }
  ctx.restore();
}

// ---- the world -----------------------------------------------------------------------------------------------------------------------
function racerFrame(r, cam, C) {
  const lane = r.lane, k = cam.ppm * laneScale(lane);
  const bx = cam.S.x + (r.x - cam.x) * cam.ppm, gy = cam.gy - (3 - lane) * cam.laneDy * cam.ppm;
  return { lane, k, bx, gy, T: { k, X: (m) => bx + (m - r.x) * k, Y: (m) => gy - m * k } };
}

function drawShadow(ctx, r, cam, C) {
  const F = racerFrame(r, cam, C), B = F.T;
  if (F.bx < cam.S.x - 4 * F.k || F.bx > cam.S.x + cam.S.w + 4 * F.k) return;
  ctx.fillStyle = 'rgba(30,14,4,0.3)'; ctx.beginPath(); ctx.ellipse(B.X(r.x), F.gy - groundH(C, r.x) * F.k + 3, 0.62 * F.k, 0.1 * F.k, 0, 0, TAU); ctx.fill();
}
function drawTag(ctx, r, cam, C, on) {
  if (!on) return;
  const F = racerFrame(r, cam, C), B = F.T;
  if (F.bx < cam.S.x - 4 * F.k || F.bx > cam.S.x + cam.S.w + 4 * F.k) return;
  const J = walkerJoints(r, C);
  const hy = B.Y(J.head[1]) - 0.35 * F.k;
  chip(ctx, B.X(J.head[0]), clamp(hy, cam.S.y + 40, 1e9), r.id === 0 ? 'YOU' : r.name, Math.max(13, 0.14 * F.k), { align: 'center', fill: r.id === 0 ? 'rgba(255,196,60,0.92)' : 'rgba(14,10,36,0.72)', color: r.id === 0 ? '#2a1606' : PAL.text });
}

function drawRacer(ctx, r, cam, C, st, t, opts = {}) {
  const F = racerFrame(r, cam, C), B = F.T;
  if (F.bx < cam.S.x - 4 * F.k || F.bx > cam.S.x + cam.S.w + 4 * F.k) return;
  const J = walkerJoints(r, C);
  const look = LOOKS[r.look] ?? LOOKS[0];
  // shadow on the road under the body, stretched by height above ground
  ctx.fillStyle = 'rgba(30,14,4,0.3)'; ctx.beginPath(); ctx.ellipse(B.X(r.x), F.gy - groundH(C, r.x) * F.k + 3, 0.62 * F.k, 0.1 * F.k, 0, 0, TAU); ctx.fill();
  ctx.save();
  if (r.phase === 'down') {
    const dur = st.W.mode === 'practice' && r.id === 0 ? PHYS.DOWN_T_PRACTICE : PHYS.DOWN_T, tt = r.standT;
    const sign = r.downKind === 'back' ? -1 : 1, mag = r.downKind === 'side' ? 1.25 : r.downKind === 'splash' ? 1.35 : 1.45;
    let a = sign * mag * ease(tt / 0.42);
    if (tt > dur - 0.5) a *= 1 - ease((tt - (dur - 0.5)) / 0.5);
    const px = B.X(J.pBase[0]), py = B.Y(J.pBase[1]);
    ctx.translate(px, py); ctx.rotate(a); ctx.translate(-px, -py);
  }
  const wob = r.phase !== 'down' ? Math.sin(t * 22) * Math.abs(r.w) * 0.012 * F.k : 0;
  ctx.translate(wob, 0);
  drawWalker(ctx, J, look, B, { flailT: t });
  ctx.restore();
  // name tag over rivals; the player gets a small marker
  if (opts.tag) {
    const hy = B.Y(J.head[1]) - 0.35 * F.k - (r.phase === 'down' ? 0 : 0);
    chip(ctx, B.X(J.head[0]), clamp(hy, cam.S.y + 40, 1e9), r.id === 0 ? 'YOU' : r.name, Math.max(13, 0.14 * F.k), { align: 'center', fill: r.id === 0 ? 'rgba(255,196,60,0.92)' : 'rgba(14,10,36,0.72)', color: r.id === 0 ? '#2a1606' : PAL.text });
  }
}

export function renderStage(ctx, st, stage, t, o = {}) {
  const W = st.W, C = W.course, me = W.racers[0];
  const ppm = stageScale(stage);
  const camTarget = me.x - (stage.w * (stage.w > stage.h * 1.1 ? 0.3 : 0.28)) / ppm;
  const cx = st.camX ?? camTarget;
  const cam = makeCam(stage, cx, ppm, stage.h > stage.w ? 0.86 : 0.82);
  ctx.save();
  ctx.beginPath(); ctx.rect(stage.x, stage.y, stage.w, stage.h); ctx.clip();
  if (st.shake > 0) ctx.translate((hash(t * 91) - 0.5) * st.shake * 10, (hash(t * 57) - 0.5) * st.shake * 8);
  drawBackdrop(ctx, stage, cam, C, t);
  drawRoad(ctx, stage, cam, C);
  drawTerrain(ctx, stage, cam, C, t);
  const excite = 0.25 + 0.6 * Math.min(1, st.cheer), g3 = gl3d();
  drawRoadside(ctx, stage, cam, C, t, { excite, pulse: st.pulse, crowd3d: g3 ? () => g3.drawCrowd(ctx, stage, cam, C, t, { excite }) : null });
  // racers back to front
  const order = [...W.racers].sort((a, b) => a.lane - b.lane);
  // guide for the player: where the next stilt will land
  if (o.guide && me.phase === 'stance' && !me.finished) {
    const lx = landingX(W, me), kind = tileAt(C, lx), good = isGood(kind), p = proj(cam, 3, lx, 0, C), k = p.k;
    const col = good ? (kind === 'mud' ? '#ffc766' : '#7dffa6') : '#ff6a5a';
    ctx.lineWidth = 4; ctx.strokeStyle = col; ctx.beginPath(); ctx.ellipse(p.x, p.y + 2, 0.34 * k, 0.09 * k, 0, 0, TAU); ctx.stroke();
    ctx.strokeStyle = rgba(good ? '#7dffa6' : '#ff6a5a', 0.4); ctx.lineWidth = 8; ctx.beginPath(); ctx.ellipse(p.x, p.y + 2, 0.42 * k, 0.11 * k, 0, 0, TAU); ctx.stroke();
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(p.x, p.y - 0.12 * k); ctx.lineTo(p.x + 0.1 * k, p.y - 0.34 * k); ctx.lineTo(p.x - 0.1 * k, p.y - 0.34 * k); ctx.closePath(); ctx.fill();
  }
  // the highlighted legal / chosen landing spots for Watch and Learn (Reveal) and the Practice hint
  if (st.reveal) {
    const x0 = me.x, x1 = me.x + 12;
    for (let m = Math.ceil(x0 / 0.15) * 0.15; m < x1; m += 0.15) {
      const good = isGood(tileAt(C, m)), p = proj(cam, 3, m, 0, C);
      ctx.fillStyle = good ? 'rgba(90,255,150,0.5)' : 'rgba(255,70,60,0.45)';
      ctx.fillRect(p.x - 3, p.y + 2, 6, 7);
    }
    if (st.reveal.x !== undefined) {
      const p = proj(cam, 3, st.reveal.x, 0, C), k = p.k, pulse = 0.6 + 0.4 * Math.sin(t * 8);
      ctx.strokeStyle = `rgba(255,226,120,${pulse})`; ctx.lineWidth = 6; ctx.beginPath(); ctx.ellipse(p.x, p.y + 2, 0.46 * k, 0.12 * k, 0, 0, TAU); ctx.stroke();
      ctx.fillStyle = '#ffe27a'; ctx.beginPath(); ctx.moveTo(p.x, p.y - 0.02 * k); ctx.lineTo(p.x + 0.14 * k, p.y - 0.4 * k); ctx.lineTo(p.x - 0.14 * k, p.y - 0.4 * k); ctx.closePath(); ctx.fill();
    }
  }
  const tagOf = (r) => r.id === 0 || (r.x > me.x - 1 && r.x < me.x + 12 && r.phase !== 'ready');
  if (g3) {
    // the people in 3D: soft shadows first (2D, on the road), then all walkers in one pass, then the name tags
    for (const r of order) drawShadow(ctx, r, cam, C);
    g3.drawRacers(ctx, stage, cam, C, order, W, t);
    for (const r of order) drawTag(ctx, r, cam, C, tagOf(r));
  } else for (const r of order) drawRacer(ctx, r, cam, C, st, t, { tag: tagOf(r) });
  drawParticles(ctx, st.parts, cam, C);
  drawForeground(ctx, stage, cam, C, t);
  // pops
  for (const pop of st.pops) {
    const a = 1 - pop.age / 0.9, p = proj(cam, pop.lane, pop.x, 3.5, C);
    ctx.save(); ctx.globalAlpha = clamp(a * 1.6, 0, 1);
    txt(ctx, pop.text, p.x + pop.dx, p.y - 40 - pop.age * 60, pop.size, pop.col, { align: 'center', font: DISPLAY, weight: 400, stroke: 7 });
    ctx.restore();
  }
  ctx.restore();
  return cam;
}

// ---- the HUD ----------------------------------------------------------------------------------------------------------------------------
function fmtTime(s) { const m = Math.floor(s / 60), r = s - m * 60; return `${m}:${r < 10 ? '0' : ''}${r.toFixed(1)}`; }
export { fmtTime };

function drawTrack(ctx, r, W) {
  const C = W.course;
  ctx.save();
  ctx.fillStyle = 'rgba(14,10,30,0.7)'; rrect(ctx, r, r.h / 2); ctx.fill();
  const x0 = r.x + 18, x1 = r.x + r.w - 22, y = r.y + r.h / 2;
  ctx.strokeStyle = 'rgba(255,240,210,0.35)'; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke();
  for (const f of C.features) {
    if (!(f.kind === 'stream' || f.kind === 'plank' || f.kind === 'mud' || f.kind === 'bund')) continue;
    const a = x0 + (x1 - x0) * f.x0 / C.length, b = x0 + (x1 - x0) * f.x1 / C.length;
    ctx.strokeStyle = f.kind === 'stream' ? '#5cc8e8' : f.kind === 'plank' ? '#d6a05a' : f.kind === 'mud' ? '#8a5a34' : '#7aa84a'; ctx.lineWidth = 8;
    ctx.beginPath(); ctx.moveTo(a, y); ctx.lineTo(b, y); ctx.stroke();
  }
  // finish flag
  ctx.fillStyle = '#fff'; ctx.fillRect(x1 + 2, y - 11, 3, 22);
  ctx.fillStyle = '#e8452c'; ctx.beginPath(); ctx.moveTo(x1 + 5, y - 11); ctx.lineTo(x1 + 15, y - 6); ctx.lineTo(x1 + 5, y - 1); ctx.closePath(); ctx.fill();
  const rs = [...W.racers].sort((a, b) => (a.id === 0) - (b.id === 0));
  for (const rc of rs) {
    const x = x0 + (x1 - x0) * clamp(rc.x / C.length, 0, 1);
    const look = LOOKS[rc.look] ?? LOOKS[0];
    ctx.fillStyle = look.shirt; ctx.beginPath(); ctx.arc(x, y, rc.id === 0 ? 10 : 7.5, 0, TAU); ctx.fill();
    ctx.lineWidth = rc.id === 0 ? 3.5 : 2; ctx.strokeStyle = rc.id === 0 ? '#fff' : 'rgba(10,6,20,0.8)'; ctx.stroke();
  }
  ctx.restore();
}

export function renderPlay(ctx, st, L, view, meta, pauseItems, drawPauseMenu) {
  const P = L.play, W = st.W, me = W.racers[0], t = st.t;
  // full-screen backdrop behind the HUD
  ctx.fillStyle = '#1a1030'; ctx.fillRect(0, 0, L.w, L.h);
  const cam = renderStage(ctx, st, P.stage, t, { guide: !st.auto || st.auto.phase !== 'act' ? true : true });
  // vignette when a fall is near
  const danger = me.phase === 'stance' ? Math.max(0, uPred(W, me) - ZONES.steady) / (PHYS.U_FALL - ZONES.steady) : 0;
  const wd = Math.abs(wPredict(me));
  if (danger > 0.35 || wd > 0.75) {
    const a = Math.max((danger - 0.35) * 0.6, (wd - 0.75) * 1.4) * (0.5 + 0.5 * Math.sin(t * 14));
    ctx.save(); ctx.globalAlpha = clamp(a, 0, 0.5); ctx.strokeStyle = '#ff3a2a'; ctx.lineWidth = 30; ctx.strokeRect(P.stage.x + 4, P.stage.y + 4, P.stage.w - 8, P.stage.h - 8); ctx.restore();
  }
  // HUD card
  const place = standings(W).findIndex((r) => r.id === 0);
  const sc = P.score;
  panel(ctx, sc, { fill: 'rgba(16,10,36,0.74)', rad: 20 });
  if (L.mode === 'wide') {
    const cx = sc.x + sc.w / 2;
    txt(ctx, ordinal(place), cx, sc.y + 54, 62, PAL.gold, { align: 'center', font: DISPLAY, weight: 400, stroke: 6 });
    txt(ctx, `of ${W.racers.length}`, cx, sc.y + 100, 22, PAL.dim, { align: 'center', weight: 700 });
    txt(ctx, fmtTime(Math.max(0, me.finished ? me.finT : W.t)), cx, sc.y + 150, 34, PAL.text, { align: 'center', weight: 800 });
    txt(ctx, `${Math.max(0, Math.ceil(W.course.length - me.x))} m to go`, cx, sc.y + 190, 22, PAL.dim, { align: 'center', weight: 600, maxW: sc.w - 16 });
    txt(ctx, `Steps ${me.steps}`, cx, sc.y + 240, 22, PAL.text, { align: 'center', weight: 700 });
    txt(ctx, `Perfect ${me.perfect}`, cx, sc.y + 270, 22, '#ffe07a', { align: 'center', weight: 700 });
    txt(ctx, `Chain ${me.chain}`, cx, sc.y + 300, 22, PAL.tealHi, { align: 'center', weight: 700 });
    txt(ctx, `Falls ${me.falls}`, cx, sc.y + 330, 22, PAL.rose, { align: 'center', weight: 700 });
    txt(ctx, W.course.name, cx, sc.y + sc.h - 60, 20, PAL.dim, { align: 'center', weight: 700, maxW: sc.w - 16 });
    txt(ctx, st.mode === 'practice' ? 'Practice' : st.mode === 'auto' ? 'Watch and Learn' : 'Race', cx, sc.y + sc.h - 30, 18, PAL.gold, { align: 'center', weight: 800 });
  } else {
    txt(ctx, ordinal(place), sc.x + 16, sc.y + 40, 54, PAL.gold, { font: DISPLAY, weight: 400, stroke: 6 });
    txt(ctx, fmtTime(Math.max(0, me.finished ? me.finT : W.t)), sc.x + sc.w - 16, sc.y + 34, 34, PAL.text, { align: 'right', weight: 800 });
    txt(ctx, `${Math.max(0, Math.ceil(W.course.length - me.x))} m to go  ·  chain ${me.chain}`, sc.x + sc.w - 16, sc.y + 72, 22, PAL.dim, { align: 'right', weight: 600, maxW: sc.w * 0.7 });
    txt(ctx, `${W.course.name}  ·  ${st.mode === 'practice' ? 'Practice' : st.mode === 'auto' ? 'Watch and Learn' : 'Race'}`, sc.x + 16, sc.y + sc.h - 18, 19, PAL.dim, { weight: 700, maxW: sc.w - 32 });
  }
  button(ctx, P.pause, L.mode === 'wide' ? 'Pause' : '', { icon: 'pause', kind: 'quiet', size: 28 });
  if (st.mode === 'practice' || st.mode === 'auto') button(ctx, P.hint, L.mode === 'wide' ? 'Hint' : '', { icon: 'bulb', kind: st.mode === 'practice' ? 'quiet' : 'disabled', size: 28 });
  drawTrack(ctx, P.track, W);
  // meter + rail
  const auto = st.auto, assist = W.mode === 'practice';
  const u = me.phase === 'stance' ? uPred(W, me) : me.phase === 'swing' ? me.tapU : 0;
  drawMeter(ctx, P.meter, u, { target: st.hintTarget ?? (auto && auto.phase !== 'act' ? st.autoTarget : undefined) });
  const lim = (tileAt(W.course, me.x) === 'plank' || tileAt(W.course, me.x) === 'bund' ? PHYS.W_FALL_PLANK : PHYS.W_FALL) * (assist ? 1.25 : 1);
  drawRail(ctx, P.rail, me.w, wPredict(me), { limit: lim, tap: st.tapMark?.p, tapA: st.tapMark ? 1 - st.tapMark.age / 0.6 : 0 });
  if (st.t < 20 || st.mode === 'practice') {
    txt(ctx, 'TAP when the marker is in the green', P.meter.x + P.meter.w / 2, P.meter.y - 14, 18, 'rgba(255,245,220,0.8)', { align: 'center', weight: 700, stroke: 5, maxW: P.meter.w });
  }
  txt(ctx, 'tap under the round marker', P.rail.x + P.rail.w / 2, P.rail.y + P.rail.h + (L.mode === 'wide' ? -4 : 12), 15, 'rgba(255,245,220,0.0)', { align: 'center' });
  // bump
  const target = bumpTarget(W, me);
  if (st.mode === 'race' && !me.finished) {
    const ready = target && me.bumpCool <= 0;
    button(ctx, P.bump, 'Bump', { icon: 'bump', kind: ready ? 'primary' : 'disabled', size: 26, sub: me.bumpCool > 0 ? `${Math.ceil(me.bumpCool)} s` : target ? 'alongside' : undefined });
  }
  // count-in
  if (W.go < 0) {
    const n = Math.ceil(-W.go), a = 1 - ((-W.go) % 1);
    ctx.save(); ctx.globalAlpha = clamp(1 - a * 0.7, 0, 1);
    txt(ctx, String(n), P.stage.x + P.stage.w / 2, P.stage.y + P.stage.h * 0.4, 190 * (0.8 + a * 0.3), PAL.gold, { align: 'center', font: DISPLAY, weight: 400, stroke: 14 });
    ctx.restore();
  } else if (W.t < 1.0) {
    ctx.save(); ctx.globalAlpha = clamp(1 - W.t, 0, 1);
    txt(ctx, 'GO!', P.stage.x + P.stage.w / 2, P.stage.y + P.stage.h * 0.4, 150, '#8ef0dc', { align: 'center', font: DISPLAY, weight: 400, stroke: 12 });
    ctx.restore();
  }
  if (st.banner) {
    const a = clamp(Math.min(st.banner.t / 0.15, (1.5 - st.banner.t) / 0.4), 0, 1);
    ctx.save(); ctx.globalAlpha = a;
    txt(ctx, st.banner.text, P.stage.x + P.stage.w / 2, P.stage.y + 70, 38, st.banner.col ?? PAL.gold, { align: 'center', font: DISPLAY, weight: 400, stroke: 8, maxW: P.stage.w - 40 });
    ctx.restore();
  }
  // Watch and Learn: Think / Reveal card
  if (auto && auto.phase !== 'act') {
    const card = { x: P.stage.x + 16, y: P.stage.y + P.stage.h * 0.42, w: P.stage.w - 32, h: 150 };
    panel(ctx, card, { fill: 'rgba(14,8,34,0.86)', rad: 24, stroke: 'rgba(255,214,150,0.5)' });
    txt(ctx, auto.phase === 'think' ? `THINK  ${Math.ceil(auto.timer)}` : 'REVEAL', card.x + 24, card.y + 38, 34, PAL.gold, { font: DISPLAY, weight: 400, maxW: card.w - 48 });
    txt(ctx, auto.title, card.x + 24, card.y + 82, 26, PAL.text, { weight: 800, maxW: card.w - 48 });
    txt(ctx, auto.tip, card.x + 24, card.y + 116, 20, PAL.dim, { weight: 600, maxW: card.w - 48 });
  }
  if (st.hintCard) {
    const card = { x: P.stage.x + 16, y: P.stage.y + P.stage.h * 0.42, w: P.stage.w - 32, h: 110 };
    panel(ctx, card, { fill: 'rgba(14,8,34,0.86)', rad: 24, stroke: 'rgba(255,214,150,0.5)' });
    txt(ctx, 'HINT', card.x + 24, card.y + 34, 30, PAL.gold, { font: DISPLAY, weight: 400 });
    txt(ctx, st.hintCard.title, card.x + 24, card.y + 74, 22, PAL.text, { weight: 700, maxW: card.w - 48 });
  }
  if (W.mode === 'auto' && (!auto || auto.phase === 'act')) txt(ctx, 'WATCH AND LEARN', P.stage.x + P.stage.w / 2, P.stage.y + 20, 17, 'rgba(255,230,160,0.85)', { align: 'center', weight: 800, stroke: 5 });
  if (st.paused || st.over) drawPauseMenu(ctx, st, L, pauseItems(st), st);
  void cam; void featureAhead; void swingDur; void COURSES; void icon; void UI; void LANE_DY;
}
