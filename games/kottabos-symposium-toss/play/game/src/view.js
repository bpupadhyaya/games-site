// The play screen: the room, the player's cup, stands or basin, drops, aim guide, effects, scores, buttons and banners.
import { FONT, NUM, C, panel, roundPath, paintButton, wrapLines } from './ui.js';
import { FR, playLayout, TEXT_SCALES, inRect } from './layout.js';
import { drawRoom, drawPlayer, drawStand, drawBasin, drawDrop, drawFx, cameraFor, sx, sy, TEAM, PAL, SERIF } from './art.js';
import {
  HAND, NDROP, AIM, LEVELS, HUMAN, guidePath, spreadOf, cohesionOf, SNAP, dropAt, discPose, standGeom, BASIN, LADDER, aimToSwipe,
} from './sim.js';
import { sideNames, winLine } from './menus.js';
import { drawLockupImg } from './brand.js';
import { v3 } from './v3.js';
import { handPose } from './art.js';

const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

export const isHuman = (m, side) => {
  const c = m.cfg.mode;
  return c === 'two' || c === 'ladder' || (c === 'ai' && side === 0);
};
// the player's own hand: shake only; cohesion comes from the finger (set at release)
export const levelOf = (m, side) => (m.cfg.mode === 'watch' ? LEVELS[m.cfg.watch[side]] : m.cfg.mode === 'ai' ? LEVELS[m.cfg.opp] : null);
export const handOf = (m, side) => {
  const lv = isHuman(m, side) ? null : levelOf(m, side);
  return lv ? { c: lv.c, ta: lv.ta, tv: lv.tv } : { c: 0.9, ta: HUMAN.ta, tv: HUMAN.tv };
};
export const camOf = (state, L = playLayout()) => cameraFor(L.scene, state.m.sc, state.camZ || 0, state.m.focus);

function drawPath(ctx, cam, aim, xMax, col, width = 4, alpha = 0.9, dash = true) {
  const g = guidePath(aim.a, aim.v, xMax, 1 / 40);
  ctx.save(); if (dash) ctx.setLineDash([2, Math.max(8, cam.s * 3)]); ctx.lineCap = 'round'; ctx.lineWidth = width; ctx.strokeStyle = col; ctx.globalAlpha = alpha;
  ctx.beginPath();
  g.forEach((p, i) => { const X = sx(cam, p[0]), Y = sy(cam, p[1]); if (i === 0) ctx.moveTo(X, Y); else ctx.lineTo(X, Y); });
  ctx.stroke(); ctx.restore();
}

function drawAim(ctx, state, L, cam) {
  const m = state.m, side = m.turn, a = m.aim, xMax = m.sc.maxX + 30;
  if (state.settings.guide) {
    const last = m.lastAim[side];
    if (last && (last.a !== a.a || last.v !== a.v) && m.ph === 'aim') drawPath(ctx, cam, last, xMax, '#ffffff', 3, 0.28);
    const c = m.drag && m.drag.c != null ? m.drag.c : 0.85, sp = spreadOf(c);
    drawPath(ctx, cam, { a: a.a + sp.sa * 1.6, v: a.v * (1 + sp.sv * 0.016) }, xMax, TEAM[side].light, 2.5, 0.38);
    drawPath(ctx, cam, { a: a.a - sp.sa * 1.6, v: a.v * (1 - sp.sv * 0.016) }, xMax, TEAM[side].light, 2.5, 0.38);
    drawPath(ctx, cam, a, xMax, TEAM[side].light, 4.5, 0.95);
  }
}

function sideBlock(ctx, x, y, w, h, side, state, m, name, hs, active) {
  const tm = TEAM[side];
  ctx.save();
  panel(ctx, x, y, w, h, { r: 18, fill: 'rgba(22,12,7,0.96)' });
  if (active) { ctx.globalAlpha = 0.5 + 0.2 * Math.sin(state.t * 3.2); ctx.lineWidth = 4; ctx.strokeStyle = tm.light; roundPath(ctx, x + 3, y + 3, w - 6, h - 6, 15); ctx.stroke(); ctx.globalAlpha = 0.14; ctx.fillStyle = tm.main; roundPath(ctx, x + 6, y + 6, w - 12, h - 12, 12); ctx.fill(); ctx.globalAlpha = 1; }
  // a little cup seal in the side's colour
  ctx.fillStyle = tm.main; roundPath(ctx, x + 12, y + h * 0.5 - 16, 32, 32, 7); ctx.fill();
  ctx.strokeStyle = tm.light; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = '#1b100a'; ctx.beginPath(); ctx.moveTo(x + 17, y + h * 0.5 - 3); ctx.quadraticCurveTo(x + 28, y + h * 0.5 + 12, x + 39, y + h * 0.5 - 3); ctx.closePath(); ctx.fill();
  ctx.fillStyle = PAL.waterL; ctx.fillRect(x + 20, y + h * 0.5 - 4, 16, 2);
  ctx.textBaseline = 'middle'; ctx.textAlign = 'left'; ctx.fillStyle = '#fff1d2';
  ctx.font = `700 ${Math.round(25 * hs)}px ${FONT}`; ctx.fillText(name, x + 54, y + h * 0.3, w - 60 - 70 * hs);
  // pips: flicks left in this round
  const left = m.left[side], n = m.perRound;
  for (let i = 0; i < n; i++) {
    const px = x + 62 + i * 20, py = y + h * 0.72;
    ctx.fillStyle = i < left ? PAL.water : 'rgba(255,255,255,0.15)';
    ctx.beginPath(); ctx.moveTo(px, py - 8); ctx.quadraticCurveTo(px + 7, py + 1, px, py + 7); ctx.quadraticCurveTo(px - 7, py + 1, px, py - 8); ctx.fill();
  }
  ctx.textAlign = 'right'; ctx.font = `900 ${Math.round(46 * Math.min(hs, 1.15))}px ${SERIF}`; ctx.fillStyle = tm.light;
  ctx.fillText(String(m.score[side]), x + w - 16, y + h / 2 + 2);
  ctx.restore();
}

function drawHud(ctx, state, L) {
  const m = state.m, names = sideNames(m.cfg), hs = Math.min(1.35, TEXT_SCALES[state.settings.textIdx]);
  const solo = m.cfg.mode === 'ladder';
  const act = m.ph === 'over' ? -1 : m.turn;
  const roundLabel = solo ? `Level ${m.cfg.level + 1}` : `Round ${m.round}/${m.rounds + m.extra}`;
  const subLabel = solo ? LADDER[m.cfg.level].name : m.extra ? 'sudden death' : m.sc.kind === 'stands' ? 'disc stands' : 'basin of cups';
  if (!L.land) {
    const h = L.hud, mid = Math.max(176, 124 * hs), bw = (h.w - mid) / 2;
    if (solo) {
      sideBlock(ctx, h.x, h.y, h.w * 0.5 - 6, h.h, 0, state, m, 'You', hs, true);
      ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#ffe9b0';
      const cx = h.x + h.w * 0.75;
      { const pw = h.w * 0.46, ph = h.h * 0.86; roundPath(ctx, cx - pw / 2, h.y + (h.h - ph) / 2, pw, ph, 16); ctx.fillStyle = 'rgba(24,14,9,0.72)'; ctx.fill(); ctx.strokeStyle = 'rgba(214,170,90,0.7)'; ctx.lineWidth = 2; ctx.stroke(); ctx.fillStyle = '#ffe9b0'; }
      ctx.font = `800 ${Math.round(27 * hs)}px ${NUM}`; ctx.fillText(roundLabel, cx, h.y + h.h * 0.34, h.w * 0.46);
      ctx.font = `600 ${Math.round(23 * hs)}px ${NUM}`; ctx.fillStyle = 'rgba(255,241,210,0.85)'; ctx.fillText(subLabel, cx, h.y + h.h * 0.68, h.w * 0.46);
      ctx.restore();
    } else {
      sideBlock(ctx, h.x, h.y, bw - 6, h.h, 0, state, m, names[0] || 'You', hs, act === 0);
      sideBlock(ctx, h.x + bw + mid + 6, h.y, bw - 6, h.h, 1, state, m, names[1], hs, act === 1);
      ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#ffe9b0';
      const cx = h.x + h.w / 2;
      ctx.font = `800 ${Math.round(26 * hs)}px ${NUM}`; ctx.fillText(roundLabel, cx, h.y + h.h * 0.34, mid + bw * 0.2);
      ctx.font = `600 ${Math.round(22 * hs)}px ${NUM}`; ctx.fillStyle = 'rgba(255,241,210,0.8)';
      ctx.fillText(subLabel, cx, h.y + h.h * 0.68, mid + bw * 0.2);
      ctx.restore();
    }
  } else {
    const h = L.hud, bh = 100;
    sideBlock(ctx, h.x, h.y, h.w, bh, 0, state, m, names[0] || 'You', hs, act === 0);
    if (!solo) sideBlock(ctx, h.x, h.y + bh + 12, h.w, bh, 1, state, m, names[1], hs, act === 1);
    ctx.save(); ctx.textAlign = 'center'; ctx.fillStyle = '#ffe9b0'; ctx.textBaseline = 'middle';
    ctx.font = `800 ${Math.round(25 * hs)}px ${NUM}`; ctx.fillText(roundLabel, h.x + h.w / 2, h.y + (solo ? bh : bh * 2 + 12) + 30, h.w);
    ctx.font = `600 ${Math.round(22 * hs)}px ${NUM}`; ctx.fillText(subLabel, h.x + h.w / 2, h.y + (solo ? bh : bh * 2 + 12) + 30 + 26 * hs, h.w);
    ctx.restore();
  }
}

function button(ctx, r, label, o = {}) {
  const { dy } = paintButton(ctx, r, o);
  ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = o.disabled ? 'rgba(255,255,255,0.35)' : o.primary ? C.ink : '#fbecd0';
  let px = Math.min(30, Math.round(r.h * 0.36));
  ctx.font = `800 ${px}px ${FONT}`;
  while (ctx.measureText(label).width > r.w - 18 && px > 12) { px--; ctx.font = `800 ${px}px ${FONT}`; }
  ctx.fillText(label, r.x + r.w / 2, r.y + r.h / 2 + dy);
  ctx.restore();
}

export function hintRects(L) {
  const s = L.sheet;
  const uw = s ? Math.min(194, s.w - 96) : 0;
  return s ? { use: { x: s.x + s.w - uw - 14, y: L.land ? s.y + s.h - 58 : s.y + 8, w: uw, h: 48 }, close: { x: s.x + s.w - 52, y: s.y + 6, w: 46, h: 46 } } : {};
}

function drawSheet(ctx, state, L, text, title, withUse) {
  const s = L.sheet; if (!s) return;
  const hs = Math.min(1.5, TEXT_SCALES[state.settings.textIdx]);
  panel(ctx, s.x, s.y, s.w, s.h, { r: 20, fill: 'rgba(24,14,9,0.95)' });
  ctx.save(); ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  ctx.fillStyle = '#ffd98a'; ctx.font = `800 ${Math.round(26 * hs)}px ${FONT}`; ctx.fillText(title, s.x + 18, s.y + 14 + 22 * hs);
  const fs = Math.round(26 * hs); ctx.font = `500 ${fs}px ${FONT}`; ctx.fillStyle = '#fbecd0';
  const lines = wrapLines(ctx, text, s.w - 36), room = Math.floor((s.h - 60 - (withUse && L.land ? 60 : 0)) / (fs * 1.3));
  lines.slice(0, Math.max(2, room)).forEach((l, i) => ctx.fillText(l, s.x + 18, s.y + 14 + 22 * hs + 14 + fs * (i + 1) * 1.3));
  ctx.restore();
  if (withUse) { const h = hintRects(L); button(ctx, h.use, 'Use this flick', { primary: true }); }
}

// The aim panel while a human aims: angle, power and the Snap bar for the finger speed.
function drawMeter(ctx, state, L, m) {
  const r = L.sheet; if (!r) return;
  const hs = Math.min(1.2, TEXT_SCALES[state.settings.textIdx]), side = m.turn;
  panel(ctx, r.x, r.y, r.w, r.h, { r: 20, fill: 'rgba(24,14,9,0.9)' });
  const pow = Math.round(((m.aim.v - AIM.vMin) / (AIM.vMax - AIM.vMin)) * 100), c = m.drag && m.drag.c != null ? m.drag.c : null;
  ctx.save(); ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  ctx.fillStyle = '#ffd98a'; ctx.font = `800 ${Math.round(27 * hs)}px ${FONT}`;
  ctx.fillText(`Angle ${Math.round(m.aim.a)}°    Power ${pow}%`, r.x + 18, r.y + 25 * hs, r.w - 36);
  // snap bar
  const bx = r.x + 18, bw = r.w - 36, by = r.y + 40 * hs + 14, bh = Math.max(16, 20 * hs);
  roundPath(ctx, bx, by, bw, bh, bh / 2); ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fill();
  const v = c == null ? 0 : c;
  if (v > 0.01) { roundPath(ctx, bx, by, Math.max(bh, bw * v), bh, bh / 2); ctx.fillStyle = v > 0.75 ? PAL.water : v > 0.4 ? '#e0b64a' : '#d9553a'; ctx.fill(); }
  ctx.fillStyle = '#fbecd0'; ctx.font = `700 ${Math.round(22 * hs)}px ${NUM}`;
  const snapTxt = c == null ? 'Snap: slide, then lift quickly for a tight stream' : v > 0.75 ? 'Snap: tight stream' : v > 0.4 ? 'Snap: a little spread' : 'Snap: sprays, flick faster';
  wrapLines(ctx, snapTxt, bw).slice(0, 4).forEach((l, i) => ctx.fillText(l, bx, by + bh + 20 * hs + i * 27 * hs, bw));
  ctx.restore();
}

// The lower panel when nothing else is shown (flick in the air, opponent turns, camera close on the target): what is left to play.
function drawIdleCard(ctx, state, L, m) {
  const r = L.sheet; if (!r) return;
  const hs = Math.min(1.25, TEXT_SCALES[state.settings.textIdx]), names = sideNames(m.cfg), solo = m.cfg.mode === 'ladder';
  panel(ctx, r.x, r.y, r.w, r.h, { r: 20, fill: 'rgba(24,14,9,0.9)' });
  ctx.save(); ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  const title = m.cfg.mode === 'ladder' ? LADDER[m.cfg.level].name : `Round ${m.round} of ${m.rounds}`;
  ctx.fillStyle = '#ffd98a'; ctx.font = `800 ${Math.round(27 * hs)}px ${FONT}`; ctx.fillText(title, r.x + 18, r.y + 14 + 24 * hs, r.w - 36);
  const fs = Math.round(24 * hs); ctx.font = `600 ${fs}px ${FONT}`;
  const sc = m.sc, target = sc.kind === 'stands' ? (sc.stands.length > 1 ? `${sc.stands.length} disc stands` : 'One disc stand') : `Basin of ${sc.basin.bowls.length} floating cups`;
  const lines = [target];
  for (let i = 0; i < (solo ? 1 : 2); i++) { const n = m.left[i] | 0; lines.push(`${names[i]}: ${n} flick${n === 1 ? '' : 's'} left`); }
  const st = (m.ph === 'fly' || m.ph === 'settle') ? 'Drops in the air' : statusText(state).trim();
  if (st) lines.push(st);
  const room = Math.max(1, Math.floor((r.h - 40 - 24 * hs) / (fs * 1.35)));
  lines.slice(0, room).forEach((l, i) => { ctx.fillStyle = i === 0 ? '#fbecd0' : i === lines.length - 1 && st ? '#9fe3f5' : '#fbecd0'; ctx.fillText(l, r.x + 18, r.y + 14 + 24 * hs + 12 + fs * 1.35 * (i + 1), r.w - 36); });
  ctx.restore();
}


// What the targets look like right now, as plain numbers: shared by the 2D drawing here and the 3D presenter. Pure, reads state only.
export function targetsView(state, m = state.m) {
  const sc = m.sc, fl = m.fl, ft = fl ? fl.t : 0, res = fl ? fl.res : null;
  if (sc.kind === 'stands') {
    const stands = sc.stands.map((s, i) => {
      const sr = res ? res.stands[i] : null, pose = discPose(s, sr, ft);
      let ring = 0;
      if (res) for (const e of res.events) if (e.type === 'clang' && e.stand === i && ft >= e.t && ft - e.t < 0.7) ring = 1 - (ft - e.t) / 0.7;
      return { pose, ring, glow: sr && sr.result === 'clang' && ft >= sr.fall.tLand ? ring : 0, gone: false };
    });
    return { kind: 'stands', stands, clock: m.clock };
  }
  const clock = fl ? res.t0 + ft : m.clock;
  const sinking = {}, board = { vol: m.board.vol.slice(), sunk: m.board.sunk.slice() };
  if (res) {
    res.bowls.forEach((b) => {
      let v = b.vol - res.drops.filter((d) => d.end === 'bowl' && d.hit.bowl === b.i).length;
      v += res.drops.filter((d) => d.end === 'bowl' && d.hit.bowl === b.i && d.tEnd <= ft).length;
      if (!b.was) board.vol[b.i] = Math.max(board.vol[b.i], Math.min(sc.basin.bowls[b.i].cap, v));
      if (b.sunk && !b.was && ft >= b.sunkAt + 0.05) { sinking[b.i] = Math.min(1, (ft - b.sunkAt - 0.05) / 0.8); board.sunk[b.i] = sinking[b.i] < 1 ? false : true; }
    });
  }
  const bowls = sc.basin.bowls.map((b, i) => {
    const sk = sinking[i] || 0, bob = Math.sin(clock * 1.7 + i * 1.9) * 0.35;
    return { i, x: sc.basin.x + b.off + b.amp * Math.sin((2 * Math.PI * clock) / b.per + b.ph), y: BASIN.water + bob - sk * 7, fill: clamp((board.vol[i] || 0) / b.cap, 0, 1), cap: b.cap, w: b.w, sink: sk, gone: !!(board.sunk[i] && sk === 0), tilt: sk * 0.5 * (i % 2 ? 1 : -1) };
  });
  return { kind: 'basin', board, sinking, clock, basin: { x: sc.basin.x, bowls } };
}

// The player's cup arm: charge (0..1 wrist cocked while the slide is in progress), snap (0..1 through the flick), tilt of the cup in degrees (screen sense).
export function playerView(state) {
  const m = state.m, fl = m.fl, ft = fl ? fl.t : 0;
  const aimPhase = m.ph === 'aim' || m.ph === 'think' || m.ph === 'reveal' || m.ph === 'act';
  const snap = fl && m.ph === 'fly' ? clamp(1 - Math.abs(ft - 0.04) / 0.22, 0, 1) : 0;
  const charge = m.drag ? clamp((m.drag.dist || 0) / 300, 0, 1) : aimPhase ? 0.25 : 0;
  const hand = handPose(charge, snap);
  const tilt = -(m.aim.a - 20) * 0.45 - snap * 34 + charge * 8;
  return { snap, charge, hand, tilt, loaded: !fl || ft < 0.05, side: m.turn };
}

// Aim guides as point lists for the 3D presenter (same paths drawAim / the plan reveal / the hint draw in 2D).
export function aimPaths(state) {
  const m = state.m, sc = m.sc, out = [];
  const xMax = sc.maxX + 30, fl = m.fl;
  const aimPhase = m.ph === 'aim' || m.ph === 'think' || m.ph === 'reveal' || m.ph === 'act';
  const side = m.turn;
  if (aimPhase && !fl && (m.ph === 'aim' && isHuman(m, m.turn) || m.ph === 'act' || m.ph === 'reveal') && state.settings.guide) {
    const a = m.aim, last = m.lastAim[side];
    const c = m.drag && m.drag.c != null ? m.drag.c : 0.85, sp = spreadOf(c);
    out.push({ pts: guidePath(a.a, a.v, xMax, 1 / 40), col: TEAM[side].light, size: 0.034, alpha: 0.98 });
    out.push({ pts: guidePath(a.a + sp.sa * 1.6, a.v * (1 + sp.sv * 0.016), xMax, 1 / 40), col: TEAM[side].light, size: 0.022, alpha: 0.5 });
    out.push({ pts: guidePath(a.a - sp.sa * 1.6, a.v * (1 - sp.sv * 0.016), xMax, 1 / 40), col: TEAM[side].light, size: 0.022, alpha: 0.5 });
    if (last && (last.a !== a.a || last.v !== a.v) && m.ph === 'aim') out.push({ pts: guidePath(last.a, last.v, xMax, 1 / 40), col: '#ffffff', size: 0.02, alpha: 0.3 });
  }
  if (m.ph === 'reveal' && m.plan && m.plan.top) m.plan.top.slice(0, 2).forEach((c, i) => out.push({ pts: guidePath(c.a, c.v, xMax, 1 / 40), col: i === 0 ? '#7dffb0' : '#ffffff', size: i === 0 ? 0.036 : 0.024, alpha: i === 0 ? 1 : 0.6 }));
  if (state.hint && m.ph === 'aim') out.push({ pts: guidePath(state.hint.a, state.hint.v, xMax, 1 / 40), col: '#7dffb0', size: 0.038, alpha: 1 });
  return out;
}

export function renderPlay(ctx, state) {
  const m = state.m, L = playLayout(), cam = camOf(state, L), sc = m.sc;
  if (v3.on) {
    // the lit 3D scene is behind this canvas: draw only chrome and text; a soft vignette keeps the plaques readable
    ctx.clearRect(0, 0, FR.w, FR.h);
  } else {
    ctx.save();
    if (state.shake > 0.01) ctx.translate(Math.sin(state.t * 90) * state.shake * 5, Math.cos(state.t * 77) * state.shake * 4);
    drawRoom(ctx, FR.w, FR.h, state.t, cam);
    ctx.save(); ctx.beginPath(); ctx.rect(L.scene.x, 0, L.scene.w, FR.h); ctx.clip();
    const fl = m.fl, ft = fl ? fl.t : 0, res = fl ? fl.res : null;
    const aimPhase = m.ph === 'aim' || m.ph === 'think' || m.ph === 'reveal' || m.ph === 'act';
    // targets
    const tv = targetsView(state, m);
    if (sc.kind === 'stands') {
      sc.stands.forEach((st, i) => { const o = tv.stands[i]; drawStand(ctx, cam, st, o.pose, state.t, { dishFlash: o.ring, glow: o.glow }); });
    } else {
      drawBasin(ctx, cam, sc, tv.board, tv.clock, { ripples: state.ripples, sinking: tv.sinking, flash: {} });
    }
    // the ghost, guide and hint
    if (aimPhase && !fl && (m.ph === 'aim' && isHuman(m, m.turn) || m.ph === 'act' || m.ph === 'reveal')) drawAim(ctx, state, L, cam);
    if (m.ph === 'reveal' && m.plan && m.plan.top) {
      m.plan.top.forEach((c, i) => drawPath(ctx, cam, c, sc.maxX + 30, i === 0 ? '#7dffb0' : 'rgba(255,255,255,0.6)', i === 0 ? 5 : 3, i === 0 ? 1 : 0.7));
    }
    if (state.hint && m.ph === 'aim') drawPath(ctx, cam, state.hint, sc.maxX + 30, '#7dffb0', 5, 1);
    // the player
    const pv = playerView(state);
    drawPlayer(ctx, cam, { snap: pv.snap, aimA: m.aim.a, side: m.turn, charge: pv.charge, t: state.t, loaded: pv.loaded });
    // the drops
    if (res && m.ph === 'fly' || (res && m.ph === 'settle')) {
      for (const d of res.drops) { const p = dropAt(d, ft); if (p && !p.ended) drawDrop(ctx, cam, d, p); }
    }
    ctx.restore();
    drawFx(ctx, state.fx);
    ctx.restore();
    if (L.land) {
      const s0 = L.scene, cols = [[0, s0.x], [s0.x + s0.w, FR.w - s0.x - s0.w]];
      for (const [x0, w0] of cols) { ctx.fillStyle = 'rgba(16,9,5,0.95)'; ctx.fillRect(x0, 0, w0, FR.h); }
      ctx.fillStyle = 'rgba(216,168,69,0.75)'; ctx.fillRect(s0.x - 2, 0, 2, FR.h); ctx.fillRect(s0.x + s0.w, 0, 2, FR.h);
    }
  }
  for (const f of state.floats) {
    const k = f.t / f.life, y = f.y - 60 * Math.min(1, k * 1.6), sc2 = f.big ? 1.25 : 1;
    ctx.save(); ctx.globalAlpha = Math.max(0, 1 - Math.max(0, k - 0.6) / 0.4); ctx.font = `900 ${Math.round(f.size * sc2 * (1 + 0.3 * Math.max(0, 1 - k * 6)))}px ${SERIF}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 7; ctx.lineJoin = 'round'; ctx.strokeStyle = 'rgba(18,9,5,0.92)'; ctx.strokeText(f.text, f.x, y); ctx.fillStyle = f.col; ctx.fillText(f.text, f.x, y); ctx.restore();
  }
  drawHud(ctx, state, L);
  // message line
  ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const hs = Math.min(1.3, TEXT_SCALES[state.settings.textIdx]);
  ctx.font = `700 ${Math.round(25 * hs)}px ${FONT}`;
  const msg = statusText(state);
  if (msg.trim()) {
    const mw = Math.min(L.scene.w - 24, ctx.measureText(msg).width + 36);
    roundPath(ctx, L.msg.x - mw / 2, L.msg.y - 22 * hs, mw, 44 * hs, 22 * hs); ctx.fillStyle = 'rgba(24,14,9,0.84)'; ctx.fill();
    ctx.fillStyle = '#fbecd0'; ctx.fillText(msg, L.msg.x, L.msg.y + 1, mw - 20);
  }
  ctx.restore();
  // buttons
  const watch = m.cfg.mode === 'watch';
  if (watch) {
    button(ctx, L.think, state.paused ? 'Resume' : 'Pause', { primary: state.paused });
    button(ctx, L.pause, 'Menu', {});
  } else {
    const canThink = isHuman(m, m.turn) && m.ph === 'aim' && !state.paused;
    button(ctx, L.think, 'Think', { disabled: !canThink, active: !!state.hint });
    button(ctx, L.pause, 'Pause', {});
  }
  if (state.hint && m.ph === 'aim') drawSheet(ctx, state, L, state.hint.text, 'Think', true);
  else if (watch && m.plan && (m.ph === 'think' || m.ph === 'reveal' || m.ph === 'act') && m.plan.text) drawSheet(ctx, state, L, m.ph === 'think' ? 'Weighing up the target: simulating many flicks for each plan.' : m.plan.text, `${sideNames(m.cfg)[m.turn]} ${m.ph === 'think' ? 'is thinking' : 'chooses'}`, false);
  else if (m.ph === 'aim' && isHuman(m, m.turn) && !state.paused) drawMeter(ctx, state, L, m);
  else if (m.ph !== 'over' && m.ph !== 'intro') drawIdleCard(ctx, state, L, m);
  if (m.banner) {
    const b = m.banner, k = b.t / b.life, pop = Math.min(1, b.t / 0.2), a = k > 0.72 ? 1 - (k - 0.72) / 0.28 : 1;
    const cy = L.scene.top + (L.scene.floorY - L.scene.top) * 0.26;
    ctx.save(); ctx.globalAlpha = Math.max(0, a); ctx.translate(L.scene.x + L.scene.w / 2, cy); ctx.scale(0.7 + 0.3 * pop, 0.7 + 0.3 * pop);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const sz = Math.min(80, L.scene.w * 0.1 + 8);
    ctx.font = `900 ${sz}px ${SERIF}`; ctx.lineWidth = sz * 0.2; ctx.lineJoin = 'round'; ctx.strokeStyle = '#15100d'; ctx.strokeText(b.text, 0, 0, L.scene.w - 20);
    ctx.fillStyle = b.col; ctx.fillText(b.text, 0, 0, L.scene.w - 20);
    if (b.sub) { ctx.font = `800 ${Math.round(sz * 0.36)}px ${NUM}`; ctx.lineWidth = 7; ctx.strokeText(b.sub, 0, sz * 0.72, L.scene.w - 20); ctx.fillStyle = '#fff1d2'; ctx.fillText(b.sub, 0, sz * 0.72, L.scene.w - 20); }
    ctx.restore();
  }
}

export function statusText(state) {
  const m = state.m, names = sideNames(m.cfg);
  if (state.paused && m.cfg.mode === 'watch') return 'Paused';
  switch (m.ph) {
    case 'intro': return m.cfg.mode === 'ladder' ? LADDER[m.cfg.level].name : `Round ${m.round}`;
    case 'aim': return isHuman(m, m.turn) ? (m.cfg.mode === 'two' ? `${names[m.turn]}: slide toward the target, lift to flick` : 'Slide toward the target, lift to flick') : `${names[m.turn]} is thinking`;
    case 'think': return `${names[m.turn]} is thinking`;
    case 'reveal': return `${names[m.turn]} picks a flick`;
    case 'act': return `${names[m.turn]} flicks`;
    case 'fly': case 'settle': return ' ';
    case 'roundEnd': return `Round ${m.round} done`;
    case 'over': return m.cfg.mode === 'ladder' ? 'Level over' : m.winner >= 0 ? winLine(names[m.winner]) : 'Match over';
    default: return ' ';
  }
}
export { inRect, lerp, drawLockupImg, aimToSwipe, standGeom, BASIN, NDROP, HAND, cohesionOf, SNAP };
