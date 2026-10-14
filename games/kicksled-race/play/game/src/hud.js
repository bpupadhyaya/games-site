// The play screen: the scene plus the heads-up display (time, speed, place, course strip, stamina, buttons, ring, hints).
import { drawScene, EXAG } from './scene.js';
import { drawRing } from './art.js';
import { TEXT_SCALES, THINK_STEPS } from './layout.js';
import { FONT, DISPLAY, C, roundPath, drawButton, panel, wrapLines, textShadow } from './ui.js';
import { SURF, kmh, standings, T } from './sim.js';
import { fmtTime } from './menus.js';

const TAU = Math.PI * 2;
const GOLD = '#ffd36a';
const ORD = ['1st', '2nd', '3rd', '4th'];

export const zoomFor = (L, view) => (L.wide ? Math.max(30, Math.min(100, Math.min(view.w / 12, view.h / 4.1))) : Math.max(34, Math.min(96, view.w / 8)));
export const anchorFor = (L) => (L.wide ? 0.4 : 0.37);
export const gyFor = (L) => (L.wide ? 0.56 : 0.65);

// where a racer's contact point is on the screen (the same maths the scene uses)
export function riderPoint(view, scn, x, lane = 0) {
  const s = scn.s, ox = view.x + view.w * scn.anchor, top = view.y + view.h * scn.gyF;
  const near = 2.0, ls = s * (1 - 0.055 * lane), dep = near - 0.28 - lane * 0.5;
  return { x: ox + (x - scn.camX) * s, y: top - (scn.course.elevAt(x) - scn.camE) * s * EXAG + (dep + 0.25) * s, ls };
}

export function renderPlay(ctx, state, L) {
  const P = L.play, watch = state.mode === 'watch', race = state.race, c = race.course;
  const view = watch ? P.viewWatch : P.view;
  const me = race.racers[0].r;
  const s = zoomFor(L, view), anchor = anchorFor(L);
  const gx = state.ghostX;
  const scn = { race, camX: state.cam.x, camE: state.cam.e, s, anchor, t: state.t, parts: state.parts, ghost: gx != null ? { x: gx } : null, noNames: !state.settings.names, course: c, gyF: gyFor(L) };
  drawScene(ctx, view, scn);

  // ---- feedback over the rider ----
  const me0 = riderPoint(view, scn, me.x, 0);
  if (!watch && state.race.go && !me.done) {
    const ringR = Math.max(18, s * 0.5);
    drawRing(ctx, Math.max(view.x + ringR + 10, me0.x - s * 1.5), me0.y - s * 0.55, ringR, me.p, me.late, me.kind);
  }
  if (me.qT > 0 && me.qLabel) {
    const a = Math.min(1, me.qT / 0.25), rise = (0.9 - me.qT) * s * 0.9;
    const col = me.kind === 'perfect' ? GOLD : me.kind === 'good' ? '#9fffd6' : '#ffb59f';
    ctx.save(); ctx.globalAlpha = a; ctx.textAlign = 'center';
    ctx.font = `800 ${Math.round(Math.max(26, Math.min(s * 0.8, 56)))}px ${FONT}`;
    const lw = ctx.measureText(me.qLabel).width;
    const lx = Math.max(view.x + lw / 2 + 12, Math.min(view.x + view.w - lw / 2 - 12, me0.x - s * 0.2));       // keep the label inside the picture
    // dark navy outline + soft backing so the call reads over pale trees and snow (contrast fix)
    const outlined = (txt, x, y, fill, lw) => { ctx.save(); ctx.lineJoin = 'round'; ctx.lineWidth = lw; ctx.strokeStyle = 'rgba(6,18,34,0.92)'; ctx.strokeText(txt, x, y); ctx.restore(); textShadow(ctx, txt, x, y, fill, 10); };
    outlined(me.qLabel, lx, me0.y - s * 3.9 - rise, col, 9);
    if (me.kind === 'perfect' && me.streak > 1) { ctx.font = `700 ${Math.round(Math.max(18, Math.min(s * 0.45, 34)))}px ${FONT}`; outlined(`streak ${me.streak}`, lx, me0.y - s * 3.35 - rise, '#ffffff', 7); }
    ctx.restore();
  }

  // ---- top: time, speed, place, buttons ----
  const tg = ctx.createLinearGradient(0, 0, 0, P.strip.y + P.strip.h + 14);
  tg.addColorStop(0, 'rgba(8,20,36,0.82)'); tg.addColorStop(1, 'rgba(8,20,36,0.0)');
  ctx.fillStyle = tg; ctx.fillRect(0, 0, L.w, P.strip.y + P.strip.h + 14);
  const order = standings(race), place = order.indexOf(race.racers[0]);
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left'; ctx.font = `700 ${L.wide ? 38 : 44}px ${FONT}`; textShadow(ctx, fmtTime(race.go ? (me.done ? me.ft : race.t) : 0), P.time.x, P.time.y, '#fff', 6);
  ctx.textAlign = 'right'; ctx.font = `700 ${L.wide ? 34 : 40}px ${FONT}`; textShadow(ctx, `${Math.round(kmh(me.v))}`, P.speed.x + 14, P.speed.y + 18, '#fff', 6);
  ctx.textAlign = 'left'; ctx.font = `600 18px ${FONT}`; ctx.fillStyle = 'rgba(230,243,251,0.85)'; ctx.fillText('km/h', P.speed.x + 20, P.speed.y + 18);
  if (race.racers.length > 1) {
    ctx.textAlign = 'right'; ctx.font = `800 ${L.wide ? 38 : 44}px ${FONT}`; textShadow(ctx, ORD[place] ?? `${place + 1}th`, P.pos.x, P.pos.y, place === 0 ? GOLD : '#fff', 6);
  }
  if (!watch) {
    drawButton(ctx, P.menu, '‖', { dark: true, size: 34 });
    drawButton(ctx, P.hint, '?', { dark: true, size: 34 });
  }
  drawStrip(ctx, P.strip, state, race, c);

  // ---- bottom: controls or the Watch & Learn bar ----
  if (!watch) {
    const tucked = state.tucked;
    const kr = P.kick, gr = P.glide;
    drawButton(ctx, gr, tucked ? 'Gliding' : 'GLIDE', { active: tucked, dark: !tucked, size: L.wide ? 34 : 36, sub: tucked ? 'tap to stand' : 'tap to crouch' });
    drawButton(ctx, kr, 'KICK', { primary: true, size: L.wide ? 48 : 54 });
    const rr = Math.min(kr.h * 0.32, 52);
    drawRing(ctx, kr.x + rr + 24, kr.y + kr.h / 2, rr, me.p, me.late, me.kind);
    // stamina
    const st = P.stam;
    roundPath(ctx, st.x, st.y, st.w, st.h, st.h / 2); ctx.fillStyle = 'rgba(8,20,36,0.55)'; ctx.fill();
    const f = Math.max(0, Math.min(1, me.stam));
    roundPath(ctx, st.x, st.y, Math.max(st.h, st.w * f), st.h, st.h / 2);
    ctx.fillStyle = f < T.TIRED_AT ? '#e85d4a' : f < 0.5 ? '#f2b53f' : '#4be0a0'; ctx.fill();
    ctx.font = `700 15px ${FONT}`; ctx.textAlign = 'left'; ctx.fillStyle = '#e6f3fb'; ctx.fillText('LEGS', st.x + 6, st.y - 4);
  } else {
    const d = P.demo, w = state.watch, think = THINK_STEPS[state.settings.thinkIdx];
    drawButton(ctx, d.dec, '−', { size: 40, disabled: state.settings.thinkIdx === 0 });
    drawButton(ctx, d.pause, state.paused ? 'Resume' : 'Pause', { primary: true, size: 32, sub: `think ${think} s` });
    drawButton(ctx, d.inc, '+', { size: 40, disabled: state.settings.thinkIdx === THINK_STEPS.length - 1 });
    drawButton(ctx, d.rules, 'Rules', { dark: true, size: 28 });
    if (d.howto) drawButton(ctx, d.howto, 'How to', { dark: true, size: 28 });
    drawButton(ctx, d.exit, 'Exit', { dark: true, size: 28 });
  }

  // ---- cards: the plan (watch) or a hint ----
  const sc = Math.min(2, TEXT_SCALES[state.settings.textIdx]);
  if (watch && state.watch && state.watch.plan && (state.watch.phase === 'think' || state.watch.phase === 'reveal')) {
    const w = state.watch;
    planCard(ctx, view, w.plan, sc, w.phase === 'think' ? `${state.paused ? 'Paused: ' : ''}${w.name} is thinking…` : `${w.name} chooses`, w.phase === 'think' ? w.t / w.dur : 1);
  } else if (state.hint && state.hint.t < state.hint.dur) {
    planCard(ctx, view, state.hint.plan, sc, 'Hint', null);
  }
  if (state.toastT > 0 && state.toast) {
    ctx.save(); ctx.globalAlpha = Math.min(1, state.toastT * 1.6);
    ctx.font = `700 26px ${FONT}`; const tw = ctx.measureText(state.toast).width + 44;
    panel(ctx, L.w / 2 - tw / 2, view.y + view.h * 0.2, tw, 52, { r: 26, fill: 'rgba(18,40,64,0.9)', stroke: 'rgba(255,255,255,0.4)' });
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(state.toast, L.w / 2, view.y + view.h * 0.2 + 27);
    ctx.restore();
  }
  // ---- countdown and finish ----
  if (!race.go && !(watch && state.watch && state.watch.phase !== 'act')) {
    const n = Math.ceil(race.count - 0.2);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const frac = race.count - Math.floor(race.count);
    ctx.save(); ctx.globalAlpha = 0.6 + 0.4 * frac; ctx.font = `800 ${Math.round(150 + 60 * frac)}px ${DISPLAY}`;
    textShadow(ctx, n > 0 ? String(Math.min(3, n)) : 'GO', L.w / 2, view.y + view.h * 0.32, n > 0 ? '#fff' : GOLD, 14);
    ctx.restore();
  } else if (race.go && race.goT < 0.9) {
    ctx.save(); ctx.globalAlpha = 1 - race.goT / 0.9; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `800 ${Math.round(150)}px ${DISPLAY}`;
    textShadow(ctx, 'GO!', L.w / 2, view.y + view.h * 0.32, GOLD, 14); ctx.restore();
  }
  if (me.done) {
    ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `800 ${Math.round(Math.min(110, L.w / 6))}px ${DISPLAY}`;
    textShadow(ctx, 'FINISH', L.w / 2, view.y + view.h * 0.3, GOLD, 14);
    ctx.font = `700 ${Math.round(Math.min(56, L.w / 12))}px ${FONT}`; textShadow(ctx, fmtTime(me.ft), L.w / 2, view.y + view.h * 0.3 + 76, '#fff', 8);
    ctx.restore();
  }
}

function planCard(ctx, view, plan, sc, kicker, prog) {
  const w = Math.min(view.w - 28, 640 + 60 * (sc - 1)), x = view.x + view.w / 2 - w / 2, y = view.y + 10;
  const fs = Math.round(24 * sc), hs = Math.round(30 * Math.min(sc, 1.5));
  ctx.font = `400 ${fs}px ${FONT}`;
  const lines = plan.lines.flatMap((l) => wrapLines(ctx, l, w - 40));
  const h = 40 + hs * 1.3 + lines.length * fs * 1.3 + 22;
  panel(ctx, x, y, w, h, { r: 22, fill: 'rgba(14,34,56,0.92)', stroke: 'rgba(255,211,106,0.6)' });
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.font = `600 ${Math.round(18 * Math.min(sc, 1.6))}px ${FONT}`; ctx.fillStyle = 'rgba(230,243,251,0.7)'; ctx.fillText(kicker.toUpperCase(), x + 20, y + 30);
  ctx.font = `700 ${hs}px ${FONT}`; ctx.fillStyle = GOLD; ctx.fillText(plan.head, x + 20, y + 30 + hs * 1.25);
  ctx.font = `400 ${fs}px ${FONT}`; ctx.fillStyle = '#f4fbff';
  lines.forEach((l, i) => ctx.fillText(l, x + 20, y + 40 + hs * 1.3 + fs * 1.15 + i * fs * 1.3));
  if (prog != null) { roundPath(ctx, x + 20, y + h - 14, w - 40, 6, 3); ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.fill(); roundPath(ctx, x + 20, y + h - 14, Math.max(6, (w - 40) * prog), 6, 3); ctx.fillStyle = GOLD; ctx.fill(); }
}

// the whole course in one strip: profile, surfaces, bends, bumps and every racer
function drawStrip(ctx, r, state, race, c) {
  const pad = 14, x0 = r.x + pad, x1 = r.x + r.w - pad, w = x1 - x0;
  roundPath(ctx, r.x, r.y, r.w, r.h, 16); ctx.fillStyle = 'rgba(8,24,44,0.66)'; ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = 1.5; ctx.stroke();
  let lo = 1e9, hi = -1e9;
  for (let i = 0; i < c.elev.length; i++) { lo = Math.min(lo, c.elev[i]); hi = Math.max(hi, c.elev[i]); }
  const span = Math.max(4, hi - lo), top = r.y + 12, base = r.y + r.h - 16, hh = base - top;
  const px = (m) => x0 + (m / c.len) * w, py = (e) => base - ((e - lo) / span) * hh * 0.8 - 2;
  // surface bar
  for (const sg of c.segs) {
    ctx.fillStyle = sg.surf === 'ice' ? '#7fd0ff' : sg.surf === 'fresh' ? '#ffffff' : sg.surf === 'slush' ? '#8f99a4' : '#c5d6e8';
    ctx.fillRect(px(sg.x0), base + 2, px(sg.x1) - px(sg.x0) - 1, 6);
  }
  // elevation
  ctx.beginPath(); ctx.moveTo(x0, base);
  for (let m = 0; m <= c.len; m += 8) ctx.lineTo(px(m), py(c.elevAt(m)));
  ctx.lineTo(x1, py(c.elevAt(c.len))); ctx.lineTo(x1, base); ctx.closePath();
  ctx.fillStyle = 'rgba(190,225,250,0.28)'; ctx.fill();
  ctx.beginPath(); for (let m = 0; m <= c.len; m += 8) { const X = px(m), Y = py(c.elevAt(m)); m === 0 ? ctx.moveTo(X, Y) : ctx.lineTo(X, Y); }
  ctx.strokeStyle = 'rgba(230,245,255,0.9)'; ctx.lineWidth = 2; ctx.stroke();
  // bends and bumps
  for (const sg of c.segs) if (sg.bend) { const X = (px(sg.x0) + px(sg.x1)) / 2, Y = py(c.elevAt((sg.x0 + sg.x1) / 2)) - 10; ctx.fillStyle = '#ffcb2f'; ctx.beginPath(); ctx.moveTo(X, Y - 8); ctx.lineTo(X + 8, Y + 6); ctx.lineTo(X - 8, Y + 6); ctx.closePath(); ctx.fill(); }
  for (const b of c.bumps) { const X = px(b), Y = py(c.elevAt(b)); ctx.fillStyle = '#fff'; ctx.fillRect(X - 2.5, Y - 6, 5, 5); }
  // finish flag
  ctx.fillStyle = '#fff'; ctx.fillRect(x1 - 1, r.y + 6, 2, r.h - 12);
  // ghost and racers
  if (state.ghostX != null) { ctx.strokeStyle = '#d8ecff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(px(Math.min(c.len, state.ghostX)), py(c.elevAt(Math.min(c.len, state.ghostX))) - 1, 6, 0, TAU); ctx.stroke(); }
  const list = race.racers.slice().reverse();
  for (const k of list) {
    const m = Math.min(c.len, k.r.x), X = px(m), Y = py(c.elevAt(m)) - 1;
    ctx.fillStyle = k.color; ctx.beginPath(); ctx.arc(X, Y, k.human ? 8 : 6, 0, TAU); ctx.fill();
    ctx.strokeStyle = k.human ? '#fff' : 'rgba(255,255,255,0.7)'; ctx.lineWidth = k.human ? 3 : 1.5; ctx.stroke();
  }
}
