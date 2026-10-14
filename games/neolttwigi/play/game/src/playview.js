// Drawing of the playing screen: the courtyard stage with the board and both girls, the timing rings, the heads-up display, the
// press pads and the Think / Reveal / hint panels. State comes from the sim round (sim.js) plus the animation state kept in game.js.
import { PAL, UI, DISPLAY, drawScene, drawBale, drawBoard, boardPoints, drawParticles, clamp, ease, lerp, rgba, BOARD } from './art.js';
import { txt, button, panel, rrect, icon, chip } from './ui.js';
import { drawGirl, OUTFITS } from './figure.js';
import { girlsAt, windows, forecast, LAG, COUNT_IN, HARMONY, PHRASE } from './sim.js';
import { stageCam } from './layout.js';
import { TILT } from './mini.js';

export const GRADE_TEXT = { perfect: 'PERFECT', great: 'GREAT', good: 'GOOD', miss: 'MISS' };
export const GRADE_COL = { perfect: '#ffe07a', great: '#8ae6da', good: '#a9c8ff', miss: '#ff8aa0' };
const TAU = Math.PI * 2;

// The camera as the picture needs it right now (the zoom follows the animation state).
export function camFor(stage, pl) {
  const cam = stageCam(stage, pl.anim.need), an = pl.anim;
  cam.sq = an.sq || 0; cam.flex = an.flex || 0;       // bale squash and board bend (spring-driven in game.js)
  return cam;
}

// Screen position and pose of one girl.
export function girlPose(pl, cam, p) {
  const r = pl.r, an = pl.anim, g = girlsAt(r)[p];
  const a = an.tilt, bp = boardPoints(cam, a);
  const rest = boardPoints(cam, p === 0 ? TILT : -TILT)[p === 0 ? 'left' : 'right'];   // her end when it is the raised one
  const end = bp[p === 0 ? 'left' : 'right'];
  const o = { x: g.air ? rest.x : end.x, y: g.air ? rest.y - g.y * cam.s : end.y, air: g.air, vy: g.vy, crouch: an.crouch[p], land: an.land[p], open: 0, face: p === 0 ? 1 : -1 };
  const lc = r.lastContact;
  let arm = 0.2 - 0.65 * an.crouch[p];
  if (g.air) {
    const u = g.u;
    arm = lerp(2.75, 1.3, ease(u)) + 0.12 * Math.sin(u * 9);
    if (u > 0.86) arm = lerp(arm, 0.5, ease((u - 0.86) / 0.14));
    o.open = u < 0.5 ? 1 : 0;
  } else if (lc && lc.lander !== p && r.t >= lc.t && r.t < lc.t + LAG + 0.1) {
    arm = lerp(arm, 2.4, ease((r.t - lc.t) / LAG));
  } else if (an.land[p] > 0.1) arm = lerp(arm, 0.35, an.land[p]);
  o.arm = arm;
  // the 3D arms use their own phase (swing / air / land): the ground crouch pose is the unchanged baseline
  o.armG = 0.2 - 0.65 * an.crouch[p];
  if (g.air) o.ph = { k: 'air', u: g.u };
  else if (lc && lc.lander !== p && r.t >= lc.t && r.t < lc.t + LAG + 0.1) o.ph = { k: 'swing', p: clamp((r.t - lc.t) / LAG, 0, 1) };
  else if (an.land[p] > 0.1) o.ph = { k: 'land', p: 1 - an.land[p] };
  o.H = g.air ? g.H : (r.maxApex || 1.0);
  o.rise = 0;
  return o;
}

// ---- the stage ------------------------------------------------------------------------------------------------------------------------
export function drawStage(ctx, w, h, st, pl, stage, time) {
  const r = pl.r, cam = camFor(stage, pl);
  const excite = clamp(r.harmony * 0.5 + Math.min(r.chain, 20) / 28, 0, 1);
  drawScene(ctx, w, h, time, cam, r.lvl.setting, excite, pl.anim);
  // height line of the best jump so far, drawn across the courtyard
  const baseY = boardPoints(cam, TILT).left.y;          // the raised end: heights are measured from here
  if (r.maxApex > r.lvl.start + 0.02) {
    const y = baseY - r.maxApex * cam.s;
    ctx.save(); ctx.setLineDash([10, 8]); ctx.strokeStyle = 'rgba(255,240,170,0.7)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(stage.x, y); ctx.lineTo(stage.x + stage.w, y); ctx.stroke(); ctx.restore();
    txt(ctx, `${r.maxApex.toFixed(2)} m`, stage.x + stage.w - 12, y - 14, 20, '#fff2b0', { align: 'right', weight: 800, stroke: 5 });
  }
  // star targets on the right edge
  r.lvl.stars.forEach((hgt, i) => {
    const y = baseY - hgt * cam.s, lit = r.maxApex >= hgt;
    ctx.fillStyle = lit ? '#ffd45a' : 'rgba(255,255,255,0.55)';
    ctx.beginPath(); ctx.arc(stage.x + stage.w - 18, y, 8, 0, TAU); ctx.fill();
    ctx.strokeStyle = lit ? '#a8741a' : 'rgba(60,40,20,0.5)'; ctx.lineWidth = 2; ctx.stroke();
    txt(ctx, String(i + 1), stage.x + stage.w - 18, y + 1, 11, lit ? '#6a4300' : '#503a22', { align: 'center', weight: 800 });
  });
  drawBale(ctx, cam.pivotX, cam.groundY, cam.s, cam.sq);
  drawBoard(ctx, cam, pl.anim.tilt, [OUTFITS[0].chima, OUTFITS[1].chima]);
  const gs = [girlPose(pl, cam, 0), girlPose(pl, cam, 1)];
  // shadows on the mat
  gs.forEach((g, p) => {
    const hgt = g.air ? Math.max(0, (boardPoints(cam, p === 0 ? TILT : -TILT)[p === 0 ? 'left' : 'right'].y - g.y) / cam.s) : 0;
    ctx.fillStyle = `rgba(30,15,5,${0.28 * (1 - Math.min(1, hgt / 4))})`;
    ctx.beginPath(); ctx.ellipse(g.x, cam.groundY + 0.07 * cam.s, 0.42 * cam.s * (1 - Math.min(0.5, hgt / 8)), 0.06 * cam.s, 0, 0, TAU); ctx.fill();
  });
  drawParticles(ctx, pl.parts);   // behind the girls: the dust and sparkle at the board end never speckle a skirt
  const out = [];
  // Real 3D girls when the presentation layer is ready (installed by main.js as globalThis.__girls3d); the 2D rig otherwise. The 2D call
  // still runs invisibly so the head positions for the grade pop-ups come from one place.
  const f3 = globalThis.__girls3d;
  let done = false;
  if (f3 && f3.draw && !f3.off) {
    const items = gs.map((g) => ({ x: g.x, y: g.y, s: cam.s, face: g.face, crouch: g.crouch, arm: g.arm, air: g.air, vy: g.vy, land: g.land, open: g.open, tilt: pl.anim.tilt, ph: g.ph, armG: g.armG, H: g.H }));
    done = f3.draw(ctx, { x: stage.x, y: stage.y, w: stage.w, h: stage.h }, items, time);
  }
  gs.forEach((g, p) => { ctx.save(); if (done) ctx.globalAlpha = 0; out.push(drawGirl(ctx, { ...g, s: cam.s * 0.98, outfit: p, t: time + p * 1.7 })); ctx.restore(); });
  drawRings(ctx, pl, cam, gs);
  // grade popups above the girls' heads
  for (const q of r.pops) {
    const a = 1 - q.age / 1.1, rise = ease(q.age / 1.1) * 40 * (cam.s / 120);
    const hd = out[q.p].head;
    ctx.save(); ctx.globalAlpha = clamp(a * 1.5, 0, 1);
    const x = clamp(hd[0], stage.x + 70, stage.x + stage.w - 70);
    const yy = Math.max(stage.y + 40, hd[1] - 0.45 * cam.s) - rise - (q.kind === 'spring' ? 0 : 26);
    txt(ctx, GRADE_TEXT[q.grade], x, yy, q.grade === 'perfect' ? 40 : 34, GRADE_COL[q.grade], { align: 'center', font: DISPLAY, weight: 700, stroke: 7 });
    const lab = (q.kind === 'stomp' ? 'stomp' : 'spring') + (q.grade !== 'perfect' && q.err !== null ? (q.err < 0 ? '  early' : '  late') : q.err === null ? '  missed' : '');
    txt(ctx, lab, x, yy + 24, 17, PAL.text, { align: 'center', weight: 700, stroke: 5 });
    ctx.restore();
  }
  return { cam, gs, out };
}

// The timing rings: a ring closes on the spot where the next contact will happen. The lander's ring says PRESS, the other girl's ring
// says RELEASE. A human sees the ring for their own role; in two-player and Watch and Learn both are shown.
function drawRings(ctx, pl, cam, gs) {
  const r = pl.r, ev = r.ev;
  if (r.done || r.t < COUNT_IN - 1.2) return;
  const tau = ev.t - r.t;
  if (tau > 1.25 || tau < -0.35) return;
  const w = windows(r.lvl, ev.H, r.learn);
  const a = clamp(Math.min((1.25 - tau) / 0.3, 1, (tau + 0.35) / 0.2), 0, 1);
  const draw = (x, y, role) => {
    const R = 0.1 * cam.s + 0.55 * cam.s * clamp(tau / 1.25, 0, 1) ** 0.9;
    const inPerfect = Math.abs(tau) <= w.perfect, inGood = Math.abs(tau) <= w.good;
    ctx.save(); ctx.globalAlpha = a;
    ctx.beginPath(); ctx.arc(x, y, 0.1 * cam.s + 0.04 * cam.s, 0, TAU);
    ctx.fillStyle = inPerfect ? 'rgba(255,230,120,0.5)' : 'rgba(255,255,255,0.14)'; ctx.fill();
    ctx.beginPath(); ctx.arc(x, y, Math.max(R, 4), 0, TAU);
    ctx.lineWidth = Math.max(3, cam.s * 0.035); ctx.strokeStyle = inPerfect ? '#fff2a0' : inGood ? '#ffd36b' : role === 'stomp' ? '#ffb13c' : '#8ae6da';
    ctx.shadowColor = 'rgba(255,200,90,0.8)'; ctx.shadowBlur = inPerfect ? 18 : 8; ctx.stroke();
    ctx.restore();
    ctx.save(); ctx.globalAlpha = a;
    icon(ctx, role === 'stomp' ? 'down' : 'up', x, y, Math.max(8, cam.s * 0.07), '#fff');
    ctx.restore();
  };
  const landerEnd = boardPoints(cam, ev.lander === 0 ? TILT : -TILT)[ev.lander === 0 ? 'left' : 'right'];
  const otherEnd = boardPoints(cam, ev.other === 0 ? -TILT : TILT)[ev.other === 0 ? 'left' : 'right'];
  const showStomp = pl.humans.some((h, p) => h && p === ev.lander) || pl.mode === 'auto' || pl.humans.every(Boolean);
  const showSpring = pl.humans.some((h, p) => h && p === ev.other) || pl.mode === 'auto' || pl.humans.every(Boolean);
  if (showStomp) draw(landerEnd.x, landerEnd.y - 0.06 * cam.s, 'stomp');
  if (showSpring) draw(otherEnd.x, otherEnd.y - 0.06 * cam.s, 'spring');
}

// ---- HUD ------------------------------------------------------------------------------------------------------------------------------
function harmonyBar(ctx, rc, v) {
  ctx.fillStyle = 'rgba(14,20,44,0.7)'; rrect(ctx, rc, rc.h / 2); ctx.fill();
  const g = ctx.createLinearGradient(rc.x, 0, rc.x + rc.w, 0);
  g.addColorStop(0, '#ff7d97'); g.addColorStop(0.5, '#ffd36b'); g.addColorStop(1, '#8ae6da');
  ctx.fillStyle = g; rrect(ctx, { x: rc.x, y: rc.y, w: Math.max(rc.h, rc.w * clamp(v, 0, 1)), h: rc.h }, rc.h / 2); ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,240,220,0.32)'; rrect(ctx, rc, rc.h / 2); ctx.stroke();
}
const MODE_LABEL = { solo: 'WITH A PARTNER', learn: 'LEARN', duel: 'TWO PLAYERS', auto: 'WATCH AND LEARN' };
const MODE_SHORT = { solo: 'PLAY', learn: 'LEARN', duel: '2 PLAYERS', auto: 'WATCH' };
export function names(pl) { return pl.mode === 'duel' ? ['Player 1', 'Player 2'] : pl.mode === 'auto' ? ['Mina', pl.r.lvl.partner] : ['You', pl.r.lvl.partner]; }

export function drawHud(ctx, st, pl, P, L) {
  const r = pl.r, lvl = r.lvl, nm = names(pl);
  const best = r.maxApex;
  if (L.mode === 'wide') {
    panel(ctx, P.left, { rad: 24 }); panel(ctx, P.right, { rad: 24 });
    const x = P.score.x, w = P.score.w;
    let y = P.score.y;
    txt(ctx, MODE_LABEL[pl.mode], x, y + 12, 17, PAL.gold, { weight: 800, maxW: w });
    txt(ctx, lvl.name, x, y + 40, 24, PAL.text, { weight: 700, maxW: w });
    y += 92;
    txt(ctx, 'HIGHEST', x, y - 20, 16, PAL.dim, { weight: 700 });
    txt(ctx, `${best.toFixed(2)} m`, x, y + 22, 54, PAL.cream, { weight: 700, font: DISPLAY, maxW: w });
    y += 84;
    txt(ctx, `Jump ${Math.min(r.contacts + 1, lvl.events)} / ${lvl.events}`, x, y, 24, PAL.text, { weight: 700 });
    y += 46;
    txt(ctx, 'HARMONY', x, y, 17, PAL.dim, { weight: 700 });
    harmonyBar(ctx, { x, y: y + 18, w, h: 20 }, r.harmony);
    y += 74;
    nm.forEach((n, p) => { txt(ctx, n, x, y, 20, p ? '#8ec1ff' : '#ffd36b', { weight: 800, maxW: w * 0.6 }); txt(ctx, String(r.score[p]), x + w, y, 26, PAL.text, { align: 'right', weight: 800 }); y += 38; });
    txt(ctx, 'FOCUS', P.info.x, P.info.y + 12, 17, PAL.gold, { weight: 800 });
    nextCard(ctx, P.info, pl);
  } else {
    const S = P.score;
    panel(ctx, { x: S.x - 4, y: S.y, w: S.w + 4, h: S.h }, { rad: 22 });
    txt(ctx, (S.w < 600 ? MODE_SHORT : MODE_LABEL)[pl.mode] + '  ·  ' + lvl.name, S.x + 16, S.y + 22, 17, PAL.gold, { weight: 800, maxW: S.w - 150 });
    txt(ctx, `${Math.min(r.contacts + 1, lvl.events)}/${lvl.events}`, S.x + S.w - 14, S.y + 22, 17, PAL.dim, { align: 'right', weight: 700 });
    txt(ctx, `${best.toFixed(2)} m`, S.x + 16, S.y + 64, 46, PAL.cream, { weight: 700, font: DISPLAY, maxW: S.w * 0.46 });
    const sx = S.x + S.w - 14;
    nm.forEach((n, p) => { txt(ctx, `${n}  ${r.score[p]}`, sx, S.y + 54 + p * 24, 19, p ? '#8ec1ff' : '#ffd36b', { align: 'right', weight: 800, maxW: S.w * 0.46 }); });
    harmonyBar(ctx, { x: S.x + 16, y: S.y + S.h - 28, w: S.w - 32, h: 14 }, r.harmony);
  }
  button(ctx, P.pause, '', { icon: 'pause', kind: 'quiet', rad: P.pause.h * 0.3 });
  if (pl.mode === 'learn') button(ctx, P.hint, L.mode === 'wide' ? 'Hint' : '', { icon: 'bulb', kind: pl.hint ? 'on' : 'quiet', rad: P.hint.h * 0.3 });
  else if (pl.mode === 'auto' && L.mode !== 'wide') button(ctx, P.hint, '', { icon: 'eye', kind: 'disabled', rad: P.hint.h * 0.3 });
}

function nextCard(ctx, rc, pl) {
  const r = pl.r, ev = r.ev, nm = names(pl);
  const youLand = pl.humans[ev.lander], y0 = rc.y + 44;
  const lines = r.done ? ['Round over'] : [
    `${nm[ev.lander]} lands next`, youLand || pl.mode === 'duel' ? 'Press as feet touch' : '', `${nm[ev.other]} releases as she lands`,
  ].filter(Boolean);
  lines.forEach((ln, i) => txt(ctx, ln, rc.x, y0 + i * 30, 19, i === 0 ? PAL.text : PAL.dim, { weight: i === 0 ? 800 : 600, maxW: rc.w }));
}

// ---- the press pads -------------------------------------------------------------------------------------------------------------------
function padOne(ctx, rc, pl, p, label) {
  const r = pl.r, ev = r.ev, human = pl.humans[p];
  const role = ev.lander === p ? 'stomp' : 'spring';
  const tau = ev.t - r.t, held = r.held[p];
  const pal = OUTFITS[p];
  panel(ctx, rc, { fill: 'rgba(16,22,48,0.78)', rad: 22, stroke: rgba(pal.jeo, human ? 0.7 : 0.3) });
  let main, sub, ic;
  if (r.done) { main = 'Round over'; sub = ''; ic = 'tap'; }
  else if (!human) { main = role === 'stomp' ? 'Lands, presses' : 'Crouches, releases'; sub = label; ic = 'eye'; }
  else if (role === 'stomp') { main = 'PRESS as you land'; sub = tau > 0 ? `in ${tau.toFixed(1)} s` : 'now'; ic = 'down'; }
  else if (held) { main = 'HOLD, release as she lands'; sub = tau > 0 ? `in ${tau.toFixed(1)} s` : 'now'; ic = 'hold'; }
  else { main = 'PRESS and HOLD to crouch'; sub = 'then release as she lands'; ic = 'down'; }
  const ih = Math.min(rc.h * 0.5, 40);
  icon(ctx, ic, rc.x + 18 + ih * 0.7, rc.y + rc.h * 0.4, ih * 0.5, human ? pal.jeo : PAL.dim);
  txt(ctx, main, rc.x + 22 + ih * 1.5, rc.y + rc.h * 0.34, Math.min(30, rc.h * 0.26), human ? PAL.text : PAL.dim, { weight: 800, maxW: rc.w - ih * 1.5 - 40 });
  txt(ctx, sub, rc.x + 22 + ih * 1.5, rc.y + rc.h * 0.62, Math.min(21, rc.h * 0.17), PAL.dim, { weight: 600, maxW: rc.w - ih * 1.5 - 40 });
  // a thin approach bar: it fills as the contact comes closer
  const bar = { x: rc.x + 18, y: rc.y + rc.h - 22, w: rc.w - 36, h: 8 };
  ctx.fillStyle = 'rgba(255,255,255,0.12)'; rrect(ctx, bar, 4); ctx.fill();
  if (!r.done) {
    const f = clamp(1 - tau / 1.4, 0, 1), w = windows(r.lvl, ev.H, r.learn);
    ctx.fillStyle = Math.abs(tau) <= w.perfect ? '#fff2a0' : role === 'stomp' ? '#ffb13c' : '#8ae6da';
    rrect(ctx, { x: bar.x, y: bar.y, w: Math.max(8, bar.w * f), h: bar.h }, 4); ctx.fill();
  }
}

export function drawPads(ctx, st, pl, P, L) {
  const rc = P.pad, nm = names(pl);
  if (pl.mode === 'duel') {
    const gap = 10, hw = (rc.w - gap) / 2;
    padOne(ctx, { x: rc.x, y: rc.y, w: hw, h: rc.h }, pl, 0, nm[0]);
    padOne(ctx, { x: rc.x + hw + gap, y: rc.y, w: hw, h: rc.h }, pl, 1, nm[1]);
  } else if (pl.mode === 'auto') {
    const gap = 10, hw = (rc.w - gap) / 2;
    padOne(ctx, { x: rc.x, y: rc.y, w: hw, h: rc.h }, pl, 0, nm[0]);
    padOne(ctx, { x: rc.x + hw + gap, y: rc.y, w: hw, h: rc.h }, pl, 1, nm[1]);
  } else padOne(ctx, rc, pl, 0, nm[0]);
}

// ---- a whole playing frame ------------------------------------------------------------------------------------------------------------
export function renderPlay(ctx, st, L, view, meta, pauseItems, drawPauseMenu) {
  const w = view?.width ?? meta.width, h = view?.height ?? meta.height, pl = st.pl, P = L.play;
  if (!pl) return;
  const r = pl.r;
  const shake = r.slipT > 0 && !st.prefs.calm ? Math.sin(pl.clock * 90) * r.slipT * 3 : 0;
  ctx.save(); ctx.translate(shake, 0);
  drawStage(ctx, w, h, st, pl, P.stage, st.t);
  ctx.restore();
  drawHud(ctx, st, pl, P, L);
  drawPads(ctx, st, pl, P, L);
  const cx = P.stage.x + P.stage.w / 2, top = P.stage.y + 14;
  // count-in numbers
  if (r.t < COUNT_IN && !(pl.auto && (pl.auto.phase === 'think' || pl.auto.phase === 'reveal'))) {
    const beat = COUNT_IN / 3, n = Math.ceil((COUNT_IN - r.t) / beat), f = ((COUNT_IN - r.t) / beat) % 1;
    ctx.save(); ctx.globalAlpha = 0.45 + 0.55 * f;
    txt(ctx, String(n), cx, P.stage.y + P.stage.h * 0.3, 130 * (0.8 + 0.4 * f), PAL.gold, { align: 'center', font: DISPLAY, weight: 700, stroke: 12 });
    ctx.restore();
  }
  const panelW = Math.min(P.stage.w - 28, 640);
  if (pl.auto && (pl.auto.phase === 'think' || pl.auto.phase === 'reveal')) {
    const a = pl.auto, think = a.phase === 'think';
    const rc = { x: cx - panelW / 2, y: top, w: panelW, h: 92 + planHeight(panelW - 36, a.plan.length) };
    panel(ctx, rc, { fill: 'rgba(14,20,44,0.9)', stroke: think ? 'rgba(255,214,120,0.6)' : 'rgba(138,230,218,0.7)' });
    txt(ctx, think ? 'THINK' : 'REVEAL', rc.x + 24, rc.y + 32, 32, think ? PAL.gold : PAL.tealHi, { font: DISPLAY, weight: 700 });
    txt(ctx, (Math.ceil(a.timer * 10) / 10).toFixed(1) + ' s', rc.x + rc.w - 24, rc.y + 32, 30, PAL.text, { align: 'right', weight: 800 });
    txt(ctx, think ? 'Study the next jumps before they happen...' : `The next ${a.plan.length} contacts, in order:`, rc.x + 24, rc.y + 70, 21, PAL.dim, { weight: 600, maxW: panelW - 48 });
    planStrip(ctx, { x: rc.x + 18, y: rc.y + 88, w: rc.w - 36, h: rc.h - 94 }, pl, a.plan, !think);
  }
  if (pl.hint) {
    const rc = { x: cx - panelW / 2, y: top, w: panelW, h: 62 + planHeight(panelW - 36, pl.hint.plan.length) };
    panel(ctx, rc, { fill: 'rgba(14,20,44,0.9)', stroke: 'rgba(255,224,122,0.7)' });
    txt(ctx, 'HINT', rc.x + 24, rc.y + 30, 28, PAL.gold, { font: DISPLAY, weight: 700 });
    planStrip(ctx, { x: rc.x + 18, y: rc.y + 56, w: rc.w - 36, h: rc.h - 62 }, pl, pl.hint.plan, true);
  }
  if (pl.banner) {
    const b = pl.banner, a = clamp(Math.min(b.t / 0.15, (1.6 - b.t) / 0.4), 0, 1);
    ctx.save(); ctx.globalAlpha = a;
    txt(ctx, b.text, cx, P.stage.y + P.stage.h * 0.18, 54, PAL.gold, { align: 'center', font: DISPLAY, weight: 700, stroke: 9, maxW: P.stage.w - 40 });
    ctx.restore();
  }
  if (pl.paused || pl.over) drawPauseMenu(ctx, st, L, pauseItems(pl), pl);
}

// The next contacts as a grid of cards: who lands, how high and how soon. `plan` is forecast() output.
const planCols = (w, n) => (w / n >= 210 ? n : Math.min(2, n));
const planHeight = (w, n) => 56 * Math.ceil(n / planCols(w, n)) + 8;
function planStrip(ctx, rc, pl, plan, lit) {
  const n = plan.length || 1, cols = planCols(rc.w, n), rows = Math.ceil(n / cols), cw = rc.w / cols, ch = (rc.h - 8) / rows, nm = names(pl);
  plan.forEach((q, i) => {
    const x = rc.x + (i % cols) * cw, y = rc.y + Math.floor(i / cols) * ch, cell = { x: x + 3, y, w: cw - 6, h: ch - 6 };
    ctx.fillStyle = lit ? 'rgba(255,230,140,0.16)' : 'rgba(255,255,255,0.06)'; rrect(ctx, cell, 12); ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = lit ? 'rgba(255,224,122,0.7)' : 'rgba(255,255,255,0.18)'; rrect(ctx, cell, 12); ctx.stroke();
    const col = q.lander === 0 ? '#ffd36b' : '#8ec1ff';
    icon(ctx, 'down', cell.x + 20, cell.y + cell.h * 0.5, 8, col);
    txt(ctx, nm[q.lander], cell.x + 38, cell.y + cell.h * 0.3, 19, col, { weight: 800, maxW: cell.w - 48 });
    txt(ctx, `${q.H.toFixed(2)} m  ·  ${q.in.toFixed(1)} s`, cell.x + 38, cell.y + cell.h * 0.7, 18, PAL.text, { weight: 600, maxW: cell.w - 48 });
  });
}
