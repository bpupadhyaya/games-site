// Drawing of the playing screen: the pole stage with the performer, the move ribbon, the hold gauge and the HUD.
import { PAL, UI, DISPLAY, drawCourtyard, drawSpot, drawPole, drawParticles, drawStars, clamp, ease } from './art.js';
import { txt, button, panel, rrect, icon, chip, drawGauge, brassEdge } from './ui.js';
import { MOVES, GESTURE_NAMES, BAL, comboMult, ROUTINES } from './routine.js';
import { POSES, MOTION, animatePose, blend, sway, drawFigure, fitFigure, jointScreen, STANDING_PELVIS } from './figure.js';
import { stageCam } from './layout.js';
import { drawCredit } from './brand.js';
import { fitPose } from './thumbs.js';

const TAU = Math.PI * 2;
export const STEP_H = 70;                     // units of height per step up the pole
export const GRADE_TEXT = { perfect: 'PERFECT', great: 'GREAT', good: 'GOOD', miss: 'MISS', slip: 'SLIP' };
export const GRADE_COL = { perfect: '#ffe07a', great: '#8ef0dc', good: '#9fc4ff', miss: '#ff7d8f', slip: '#ff7d8f' };
const STAND = { ...POSES.salute, hl: [38, 70], hr: [78, 70], el: 1, er: -1 };
POSES.stand = STAND;
// The real 3D performer (web/view3d/performer.js, installed by main.js). Returns false when the 2D rig must be drawn instead.
export function draw3d(ctx, pose, o, t) {
  const f = globalThis.__figure3d;
  if (!f || !f.draw) return false;
  return f.draw(ctx, pose, o, t) !== false;
}
// The whole 3D set + performer. false when the 3D layer is absent or still loading (the caller draws the 2D set instead).
export function drawScene3d(ctx, w, h, p) {
  const f = globalThis.__figure3d;
  if (!f || !f.drawScene) return false;
  return f.drawScene(ctx, w, h, p) !== false;
}
export const scene3dPending = () => !!(globalThis.__figure3d && globalThis.__figure3d.pending);
const poseOf = (name) => POSES[name] ?? STAND;

// Poses over time are a pure function of the move list and the song clock: a transition event per move, plus a return to the neutral
// grip when a hold ends. The sim never reads this; it exists for the picture (and keeps Watch/Perform visually identical).
export function buildEvents(moves, beatDur) {
  const ev = [{ t: -1e9, pose: 'stand', dur: 0.001, H0: 0, H: 0, spin: 0, at: -1e9 }];
  const add = (t, pose, H0, H, spin, hold) => {
    const m = MOTION[pose], lead = m ? m.lead : 0.1, dur = m ? m.dur : 0.45;
    ev.push({ t: t - lead, at: t, pose, dur, H0, H, spin, hold });
  };
  for (const m of moves) {
    add(m.t, m.pose, m.H0, m.H, m.spin, m.g === 'hold' ? m.dur * beatDur : 0);
    if (m.g === 'hold') ev.push({ t: m.t + m.dur * beatDur + 0.06, at: m.t + m.dur * beatDur + 0.06, pose: 'grip', dur: 0.95, H0: m.H, H: m.H, spin: 0 });
  }
  for (let i = 2; i < ev.length; i++) if (ev[i].t < ev[i - 1].t + 0.12) ev[i].t = ev[i - 1].t + 0.12;   // never let clips reorder
  return ev;
}
// pose of the performer at song time t: each clip starts from wherever the previous clip had got to (no jumps when clips overlap)
function poseAt(ev, i, t) {
  if (i === 0) return poseOf('stand');
  const cur = ev[i], from = poseAt(ev, i - 1, cur.t);
  return animatePose(from, cur.pose, (t - cur.t) / cur.dur);
}
export function perfState(ev, t) {
  let i = 0;
  while (i + 1 < ev.length && ev[i + 1].t <= t) i += 1;
  const cur = ev[i];
  const pose = poseAt(ev, i, t);
  const hs = cur.at ?? cur.t;
  const H = cur.H0 + (cur.H - cur.H0) * ease((t - hs) / 0.55);
  // every spin keeps easing until it is done, even when the next clip has already started (no snap back to 0): `turn` is the pole's
  // accumulated rotation, `phi` the in-progress remainder (finished turns are whole circles and drop out exactly)
  let turn = 0, phi = 0;
  for (let j = 1; j <= i; j++) {
    const sp = ev[j].spin; if (!sp) continue;
    const u = clamp((t - ev[j].at) / 0.7, 0, 1), e = ease(u);
    turn += sp * TAU * e;
    if (u < 1) phi += sp * TAU * e;
  }
  return { pose, H, turn, phi, cur, i };
}

// ---- the stage ------------------------------------------------------------------------------------------------------------------
export function drawStage(ctx, w, h, st, pl, stage, time) {
  const cam = stageCam(stage), k = cam.k;
  const ps = perfState(pl.ev, pl.t), bal = pl.hold ? pl.hold.bal : 0;
  const slip = pl.slipT > 0 ? Math.sin(pl.slipT * 40) * Math.min(1, pl.slipT * 3) : 0;
  const swayV = clamp(bal * 0.8 + slip * 0.5, -1.2, 1.2);
  const breath = Math.sin(pl.clock * 2.1) * 1.6 - pl.pulse * 2.4;
  let pose = sway(ps.pose, swayV, breath);
  if (globalThis.__forcePose && POSES[globalThis.__forcePose]) pose = POSES[globalThis.__forcePose];   // dev: ?dev=1&pose=<name>
  const groundY = cam.anchorY + (STANDING_PELVIS + ps.H * STEP_H) * k;
  const ground0 = cam.anchorY + STANDING_PELVIS * k;
  const horizon = ground0 - stage.h * 0.2 + ps.H * STEP_H * k * 0.42;
  const excite = clamp(pl.flow * 0.6 + Math.min(pl.chain, 24) / 40, 0, 1);
  const bounce = pl.pulse * 1.5;
  const o = { x: cam.poleX, y: cam.anchorY + bounce, k, phi: ps.phi, chalk: pl.chalk };
  const ok3 = drawScene3d(ctx, w, h, { x: o.x, y: o.y, k, pose, phi: ps.phi, turn: ps.turn, climb: ps.H * STEP_H, excite, pulse: pl.pulse, t: time });
  if (!ok3) {
    drawCourtyard(ctx, w, h, time, { horizon, ground: groundY, poleX: cam.poleX, k }, pl.pulse, excite);
    drawSpot(ctx, cam.poleX, 0, groundY, Math.min(w, 700), 0.6 + excite * 0.7);
    drawPole(ctx, cam.poleX, groundY - 760 * k, groundY, 24 * k, ps.turn);
    // soft shadow of the performer on the pit
    ctx.fillStyle = 'rgba(20,6,6,0.35)'; ctx.beginPath(); ctx.ellipse(cam.poleX + pose.p[0] * k * 0.3, groundY + 8, 60 * k, 11 * k, 0, 0, TAU); ctx.fill();
    if (!scene3dPending()) drawFigure(ctx, pose, o);
  }
  drawParticles(ctx, pl.parts);
  // grade popups above the head
  for (const p of pl.pops) {
    const a = 1 - p.age / 0.85, rise = ease(p.age / 0.85) * 46;
    ctx.save(); ctx.globalAlpha = clamp(a * 1.4, 0, 1);
    txt(ctx, p.text, clamp(cam.poleX + p.dx, stage.x + 90, stage.x + stage.w - 90), cam.anchorY - 175 * k - rise, p.size, p.col, { align: 'center', font: DISPLAY, weight: 400, stroke: 7 });
    ctx.restore();
  }
  return { cam, ps, groundY };
}

// ---- the move ribbon --------------------------------------------------------------------------------------------------------------
function nodeCard(ctx, cx, cy, s, m, a, tint) {
  ctx.save(); ctx.globalAlpha *= a;
  const r = { x: cx - s / 2, y: cy - s / 2, w: s, h: s };
  ctx.fillStyle = 'rgba(16,10,36,0.9)'; rrect(ctx, r, s * 0.22); ctx.fill();
  ctx.lineWidth = Math.max(2, s * 0.045); ctx.strokeStyle = tint; rrect(ctx, r, s * 0.22); ctx.stroke();
  fitPose(ctx, POSES[m.pose] ? m.pose : 'stand', { x: r.x + s * 0.1, y: r.y + s * 0.04, w: s * 0.8, h: s * 0.64 }, { sil: 'rgba(253,241,220,0.92)' });
  // gesture badge across the bottom
  const g = m.g;
  const bx = cx, by = cy + s * 0.34, br = s * 0.17;
  ctx.fillStyle = g === 'hold' ? '#2fb6a3' : g === 'tap' ? '#f0b94a' : '#e8791c';
  ctx.beginPath(); ctx.arc(bx, by, br, 0, TAU); ctx.fill();
  icon(ctx, g, bx, by, br * 0.56, '#fff');
  ctx.restore();
}

export function drawRibbon(ctx, st, pl, rib, now) {
  const beatDur = pl.beatDur, nowX = rib.x + rib.w * 0.19, ppb = (rib.w * 0.78) / 4.6;
  const cy = rib.y + rib.h * 0.42, s = Math.min(rib.h * 0.62, 150);
  panel(ctx, rib, { fill: 'rgba(12,7,28,0.72)', rad: 26 });
  ctx.save(); rrect(ctx, rib, 26); ctx.clip();
  // beat ticks scrolling by
  const b0 = Math.floor(pl.t / beatDur) - 1;
  for (let b = b0; b < b0 + 10; b++) {
    const x = nowX + (b * beatDur - pl.t) / beatDur * ppb;
    if (x < rib.x || x > rib.x + rib.w) continue;
    ctx.fillStyle = b % 4 === 0 ? 'rgba(255,214,150,0.34)' : 'rgba(255,240,220,0.14)';
    ctx.fillRect(x - 1.5, cy + s * 0.62, 3, b % 4 === 0 ? rib.h * 0.12 : rib.h * 0.07);
  }
  // string the nodes hang on
  const tr = ctx.createLinearGradient(rib.x, 0, rib.x + rib.w, 0);
  tr.addColorStop(0, 'rgba(255,200,130,0)'); tr.addColorStop(0.19, 'rgba(255,200,130,0.5)'); tr.addColorStop(1, 'rgba(255,200,130,0.12)');
  ctx.fillStyle = tr; ctx.fillRect(rib.x, cy - 2, rib.w, 4);
  const reveal = pl.reveal; // set of move indexes lit by Reveal/hint
  for (const m of pl.moves) {
    const x = nowX + (m.t - pl.t) / beatDur * ppb, xe = m.g === 'hold' ? x + m.dur * ppb : x;
    if (xe < rib.x - s || x > rib.x + rib.w + s) continue;
    const resolved = !!m.j, lit = reveal && reveal.includes(m.i);
    let tint = lit ? '#ffe07a' : 'rgba(255,230,200,0.5)', a = 1;
    if (resolved) { tint = GRADE_COL[m.j] ?? '#fff'; a = clamp(1 - (pl.t - m.tj) / 0.9, 0, 1) * 0.9 + 0.1; if (a < 0.12) continue; }
    if (m.g === 'hold') {
      const bar = { x: x, y: cy - s * 0.17, w: Math.max(10, xe - x), h: s * 0.34 };
      ctx.save(); ctx.globalAlpha = a;
      ctx.fillStyle = 'rgba(47,182,163,0.28)'; rrect(ctx, bar, bar.h / 2); ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = resolved ? tint : '#8ef0dc'; rrect(ctx, bar, bar.h / 2); ctx.stroke();
      const hold = pl.hold && pl.hold.mi === m.i ? pl.hold : null;
      if (hold) { ctx.fillStyle = 'rgba(142,240,220,0.7)'; rrect(ctx, { x: bar.x, y: bar.y, w: Math.max(0, Math.min(bar.w, nowX - bar.x)), h: bar.h }, bar.h / 2); ctx.fill(); }
      ctx.restore();
    }
    nodeCard(ctx, x, cy, s, m, a, tint);
    if (lit || (!resolved && x < rib.x + rib.w * 0.7 && pl.labels)) txt(ctx, m.name, x, cy + s * 0.5 + Math.max(16, s * 0.2), Math.max(15, s * 0.17), lit ? '#ffe07a' : 'rgba(253,241,220,0.78)', { align: 'center', weight: 700, maxW: s * 1.5 });
  }
  ctx.restore();
  // the ring where a move should land
  const pr = s * 0.6 + pl.pulse * 4;
  ctx.save();
  ctx.lineWidth = 5; ctx.strokeStyle = `rgba(255,214,120,${0.75 + pl.pulse * 0.25})`; ctx.shadowColor = 'rgba(255,190,80,0.9)'; ctx.shadowBlur = 16;
  rrect(ctx, { x: nowX - pr, y: cy - pr, w: pr * 2, h: pr * 2 }, pr * 0.34); ctx.stroke();
  ctx.restore();
}

// ---- HUD ---------------------------------------------------------------------------------------------------------------------------
function flowBar(ctx, r, v) {
  const tg = ctx.createLinearGradient(0, r.y, 0, r.y + r.h); tg.addColorStop(0, 'rgba(8,3,2,0.92)'); tg.addColorStop(1, 'rgba(50,28,16,0.9)');
  ctx.fillStyle = tg; rrect(ctx, r, r.h / 2); ctx.fill();
  const fw = Math.max(r.h, r.w * clamp(v, 0, 1)), fr = { x: r.x + 2, y: r.y + 2, w: fw - 4, h: r.h - 4 };
  const g = ctx.createLinearGradient(r.x, 0, r.x + r.w, 0);
  g.addColorStop(0, '#e0502c'); g.addColorStop(0.5, '#ffb43c'); g.addColorStop(1, '#8ef0dc');
  ctx.fillStyle = g; rrect(ctx, fr, fr.h / 2); ctx.fill();
  const sp = ctx.createLinearGradient(0, fr.y, 0, fr.y + fr.h); sp.addColorStop(0, 'rgba(255,255,255,0.5)'); sp.addColorStop(0.5, 'rgba(255,255,255,0)'); sp.addColorStop(1, 'rgba(0,0,0,0.22)');
  ctx.fillStyle = sp; rrect(ctx, fr, fr.h / 2); ctx.fill();
  brassEdge(ctx, r, r.h / 2, 2.5);
}
function modeLabel(pl) { return pl.mode === 'learn' ? 'LEARN' : pl.mode === 'auto' ? 'WATCH AND LEARN' : 'PERFORM'; }

export function drawHud(ctx, st, pl, P, L) {
  const cfg = ROUTINES[pl.ri], mult = comboMult(pl.chain);
  const resolved = pl.moves.filter((m) => m.j).length;
  if (L.mode === 'wide') {
    panel(ctx, P.left, { rad: 24 }); panel(ctx, P.right, { rad: 24 });
    const x = P.score.x, w = P.score.w;
    let y = P.score.y;
    txt(ctx, modeLabel(pl), x, y + 12, 17, PAL.gold, { weight: 800, maxW: w });
    txt(ctx, cfg.name, x, y + 40, 24, PAL.text, { weight: 700, maxW: w });
    y += 84;
    txt(ctx, String(Math.round(pl.score)), x, y + 24, 54, PAL.cream, { weight: 800, font: DISPLAY, maxW: w });
    y += 76;
    txt(ctx, `Chain ${pl.chain}`, x, y, 26, PAL.text, { weight: 700 });
    txt(ctx, `x${mult}`, x + w, y, 34, mult > 1 ? PAL.gold : PAL.dim, { align: 'right', weight: 800 });
    y += 46;
    txt(ctx, 'FLOW', x, y, 17, PAL.dim, { weight: 700 });
    flowBar(ctx, { x, y: y + 18, w, h: 20 }, pl.flow);
    y += 70;
    txt(ctx, `Move ${Math.min(resolved + 1, pl.moves.length)} / ${pl.moves.length}`, x, y, 22, PAL.dim, { weight: 600 });
    y += 44;
    for (const [g, c] of [['perfect', pl.counts.perfect], ['great', pl.counts.great], ['good', pl.counts.good], ['miss', pl.counts.miss]]) { txt(ctx, GRADE_TEXT[g], x, y, 19, GRADE_COL[g], { weight: 700 }); txt(ctx, String(c), x + w, y, 22, PAL.text, { align: 'right', weight: 800 }); y += 34; }
    // right card: move info
    txt(ctx, 'NEXT', P.info.x, P.info.y + 12, 17, PAL.gold, { weight: 800 });
    nextCard(ctx, P.info, pl);
  } else {
    const S = P.score;
    panel(ctx, { x: S.x - 4, y: S.y, w: S.w + 4, h: S.h }, { rad: 22 });
    txt(ctx, modeLabel(pl) + '  ·  ' + cfg.name, S.x + 16, S.y + 22, 18, PAL.gold, { weight: 800, maxW: S.w - 32 - 70 });
    txt(ctx, String(Math.round(pl.score)), S.x + 16, S.y + 62, 46, PAL.cream, { weight: 800, font: DISPLAY, maxW: S.w * 0.5 });
    txt(ctx, `Chain ${pl.chain}`, S.x + S.w - 16 - 70, S.y + 52, 22, PAL.text, { align: 'right', weight: 700 });
    txt(ctx, `x${mult}`, S.x + S.w - 16, S.y + 52, 32, mult > 1 ? PAL.gold : PAL.dim, { align: 'right', weight: 800 });
    flowBar(ctx, { x: S.x + 16, y: S.y + S.h - 30, w: S.w - 32, h: 16 }, pl.flow);
    txt(ctx, `${Math.min(resolved + 1, pl.moves.length)}/${pl.moves.length}`, S.x + S.w - 16, S.y + 22, 18, PAL.dim, { align: 'right', weight: 600 });
  }
  button(ctx, P.pause, '', { icon: 'pause', kind: 'quiet', rad: P.pause.h * 0.3 });
  if (pl.mode === 'learn') button(ctx, P.hint, L.mode === 'wide' ? 'Hint' : '', { icon: 'bulb', kind: pl.hint ? 'on' : 'quiet', rad: P.hint.h * 0.3 });
  else if (pl.mode === 'auto' && L.mode !== 'wide') button(ctx, P.hint, '', { icon: 'eye', kind: 'disabled', rad: P.hint.h * 0.3 });
}
function nextCard(ctx, r, pl) {
  const nx = pl.moves.find((m) => !m.j);
  if (!nx) return;
  const m = MOVES[nx.id], cw = r.w, top = r.y + 30;
  fitPose(ctx, POSES[nx.pose] ? nx.pose : 'stand', { x: r.x, y: top, w: cw, h: Math.min(cw * 0.9, 150) }, { sil: 'rgba(253,241,220,0.92)' });
  const y = top + Math.min(cw * 0.9, 150) + 22;
  txt(ctx, m.name, r.x + cw / 2, y, 22, PAL.text, { align: 'center', weight: 800, maxW: cw });
  icon(ctx, nx.g, r.x + cw / 2, y + 40, 15, PAL.gold);
  txt(ctx, GESTURE_NAMES[nx.g], r.x + cw / 2, y + 74, 17, PAL.dim, { align: 'center', weight: 600, maxW: cw });
}

// ---- a whole playing frame ---------------------------------------------------------------------------------------------------------
export function renderPlay(ctx, st, L, view, meta, pauseItems, drawPauseMenu) {
  const w = view?.width ?? meta.width, h = view?.height ?? meta.height, pl = st.pl, P = L.play;
  if (!pl) return;
  const shake = pl.shake > 0 && !st.prefs.calm ? Math.sin(pl.clock * 90) * pl.shake * 5 : 0;
  ctx.save(); ctx.translate(shake, 0);
  drawStage(ctx, w, h, st, pl, P.stage, st.t);
  ctx.restore();
  drawRibbon(ctx, st, pl, P.ribbon, st.t);
  // hold gauge: shows while a hold is on, and fades in over the beat before it
  const hm = pl.hold ? pl.moves[pl.hold.mi] : null;
  const upcoming = pl.moves.find((m) => !m.j && m.g === 'hold' && m.t - pl.t < pl.beatDur * 1.1 && m.t - pl.t > -0.3);
  if (hm || upcoming) {
    const a = hm ? 1 : clamp(1 - (upcoming.t - pl.t) / (pl.beatDur * 1.1), 0.25, 0.9);
    ctx.save(); ctx.globalAlpha = a;
    drawGauge(ctx, P.gauge, hm ? pl.hold.bal : 0, { safe: BAL.safe, fall: BAL.fall });
    txt(ctx, hm ? (Math.abs(pl.hold.bal) <= BAL.safe ? 'IN LINE' : 'STEER') : 'HOLD AND STEER', P.gauge.x + P.gauge.w / 2, P.gauge.y - 20, 22, '#8ef0dc', { align: 'center', weight: 800, stroke: 5 });
    ctx.restore();
  }
  drawHud(ctx, st, pl, P, L);
  // phase banners: count-in numbers, Think / Reveal in Watch and Learn, hint
  const cx = P.stage.x + P.stage.w / 2, cy = P.stage.y + P.stage.h * 0.2;
  if (pl.t < pl.countEnd && !pl.auto?.phase?.startsWith?.('t') && pl.auto?.phase !== 'reveal') {
    const n = Math.ceil((pl.countEnd - pl.t) / pl.beatDur);
    const f = ((pl.countEnd - pl.t) / pl.beatDur) % 1;
    ctx.save(); ctx.globalAlpha = 0.5 + 0.5 * f;
    txt(ctx, String(n), cx, cy, 120 * (0.8 + 0.4 * f), PAL.gold, { align: 'center', font: DISPLAY, weight: 400, stroke: 10 });
    ctx.restore();
  }
  if (pl.auto && (pl.auto.phase === 'think' || pl.auto.phase === 'reveal')) {
    const a = pl.auto, think = a.phase === 'think';
    const bw = Math.min(P.stage.w - 40, 560), bh = 130, r = { x: cx - bw / 2, y: P.stage.y + 16, w: bw, h: bh };
    panel(ctx, r, { fill: 'rgba(14,8,34,0.86)', stroke: think ? 'rgba(255,214,120,0.6)' : 'rgba(142,240,220,0.7)' });
    txt(ctx, think ? 'THINK' : 'REVEAL', r.x + 24, r.y + 32, 30, think ? PAL.gold : PAL.tealHi, { font: DISPLAY, weight: 400 });
    txt(ctx, (Math.ceil(a.timer * 10) / 10).toFixed(1) + ' s', r.x + r.w - 24, r.y + 32, 30, PAL.text, { align: 'right', weight: 800 });
    const names = a.names.join('  >  ');
    txt(ctx, think ? 'Reading the next phrase...' : 'Plan for the next phrase:', r.x + 24, r.y + 70, 22, PAL.dim, { weight: 600, maxW: bw - 48 });
    txt(ctx, names, r.x + 24, r.y + 104, 22, PAL.text, { weight: 700, maxW: bw - 48 });
  }
  if (pl.hint) {
    const bw = Math.min(P.stage.w - 40, 560), r = { x: cx - bw / 2, y: P.stage.y + 16, w: bw, h: 100 };
    panel(ctx, r, { fill: 'rgba(14,8,34,0.86)', stroke: 'rgba(255,224,122,0.7)' });
    txt(ctx, 'HINT', r.x + 24, r.y + 30, 26, PAL.gold, { font: DISPLAY, weight: 400 });
    txt(ctx, pl.hint.names.join('  >  '), r.x + 24, r.y + 70, 22, PAL.text, { weight: 700, maxW: bw - 48 });
  }
  if (pl.banner) {
    const b = pl.banner, a = clamp(Math.min(b.t / 0.15, (1.5 - b.t) / 0.4), 0, 1);
    ctx.save(); ctx.globalAlpha = a;
    txt(ctx, b.text, cx, P.stage.y + P.stage.h * 0.8 - (1.5 - b.t) * 6, 54, PAL.gold, { align: 'center', font: DISPLAY, weight: 400, stroke: 9, maxW: P.stage.w - 40 });
    ctx.restore();
  }
  if (pl.paused || pl.over) drawPauseMenu(ctx, st, L, pauseItems(pl), pl);
}
