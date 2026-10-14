// The play screen: the scene plus the heads-up display (time, speed, place, hill strip, steering tiller, brake, hints).
import { drawScene } from './scene.js';
import { TEXT_SCALES, THINK_STEPS } from './layout.js';
import { FONT, DISPLAY, roundPath, drawButton, panel, wrapLines, textShadow } from './ui.js';
import { SURF, kmh, standings, T, ROAD } from './sim.js';
import { fmtTime } from './menus.js';

const TAU = Math.PI * 2;
const GOLD = '#ffd36a';
const ORD = ['1st', '2nd', '3rd', '4th'];

export function renderPlay(ctx, state, L) {
  const P = L.play, watch = state.mode === 'watch', race = state.race, c = race.course;
  const view = watch ? P.viewWatch : P.view;
  const me = race.racers[0].r;
  let mark = null;
  const plan = (watch && state.watch && state.watch.plan && state.watch.phase !== 'act') ? state.watch.plan : (state.hint ? state.hint.plan : null);
  if (plan && plan.target) mark = plan.target;
  const scn = { race, t: state.t, parts: state.parts, ghostS: state.ghostS, names: state.settings.names, mark, cheer: me.v > 2 ? 1 : 0.5, shake: !state.paused };
  drawScene(ctx, view, scn);

  // ---- top: time, speed, place, buttons ----
  const tg = ctx.createLinearGradient(0, 0, 0, P.strip.y + P.strip.h + 14);
  tg.addColorStop(0, 'rgba(30,14,4,0.82)'); tg.addColorStop(1, 'rgba(30,14,4,0.0)');
  ctx.fillStyle = tg; ctx.fillRect(0, 0, L.w, P.strip.y + P.strip.h + 14);
  const order = standings(race), place = order.indexOf(race.racers[0]);
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left'; ctx.font = `700 ${L.wide ? 38 : 44}px ${FONT}`; textShadow(ctx, fmtTime(race.go ? (me.done ? me.ft : race.t) : 0), P.time.x, P.time.y, '#fff', 6);
  ctx.textAlign = 'right'; ctx.font = `700 ${L.wide ? 34 : 40}px ${FONT}`; textShadow(ctx, `${Math.round(kmh(me.v))}`, P.speed.x + 14, P.speed.y + 18, '#fff', 6);
  ctx.textAlign = 'left'; ctx.font = `600 18px ${FONT}`; ctx.fillStyle = 'rgba(255,244,220,0.85)'; ctx.fillText('km/h', P.speed.x + 20, P.speed.y + 18);
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
    const sr = P.steer, br = P.brake;
    // the tiller: a rail with a knob that follows the steering (floats over the scene in landscape)
    if (!L.wide) panel(ctx, sr.x, sr.y, sr.w, sr.h, { r: 22, fill: 'rgba(60,32,12,0.82)', stroke: 'rgba(255,220,150,0.45)', shadow: false });
    else { roundPath(ctx, sr.x, sr.y, sr.w, sr.h, sr.h / 2); ctx.fillStyle = 'rgba(40,20,6,0.5)'; ctx.fill(); }
    const rail = { x: sr.x + 36, w: sr.w - 72, y: sr.y + sr.h * (L.wide ? 0.5 : 0.5) };
    ctx.strokeStyle = 'rgba(255,240,210,0.25)'; ctx.lineWidth = 10; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(rail.x, rail.y); ctx.lineTo(rail.x + rail.w, rail.y); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,240,210,0.5)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(rail.x + rail.w / 2, rail.y - 16); ctx.lineTo(rail.x + rail.w / 2, rail.y + 16); ctx.stroke();
    const kx = rail.x + rail.w / 2 + me.u * rail.w / 2, kr = Math.min(sr.h * 0.3, 40);
    const g = ctx.createRadialGradient(kx - kr * 0.3, rail.y - kr * 0.3, kr * 0.1, kx, rail.y, kr);
    g.addColorStop(0, '#ffe39a'); g.addColorStop(1, '#d58b1a');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(kx, rail.y, kr, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 2; ctx.stroke();
    if (!L.wide) { ctx.fillStyle = 'rgba(255,244,220,0.85)'; ctx.font = `600 20px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText('◀  slide anywhere to steer  ▶', sr.x + sr.w / 2, sr.y + sr.h - 14); }
    drawButton(ctx, br, state.brakeOn ? 'BRAKING' : 'BRAKE', { active: state.brakeOn, dark: !state.brakeOn, size: L.wide ? 30 : 36, sub: state.brakeOn ? 'tap to release' : 'tap, or hold' });
  } else {
    const d = P.demo, think = THINK_STEPS[state.settings.thinkIdx];
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
    panel(ctx, L.w / 2 - tw / 2, view.y + view.h * 0.62, tw, 52, { r: 26, fill: 'rgba(60,32,12,0.9)', stroke: 'rgba(255,255,255,0.4)' });
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(state.toast, L.w / 2, view.y + view.h * 0.62 + 27);
    ctx.restore();
  }
  // ---- start lights and finish ----
  if (!race.go && !(watch && state.watch && state.watch.phase !== 'act')) {
    const lit = race.count > 3 ? 0 : race.count > 2 ? 1 : race.count > 1 ? 2 : 3;
    const r0 = Math.max(18, Math.min(34, L.w / 14)), gx = L.w / 2, gy = view.y + view.h * 0.2;
    panel(ctx, gx - r0 * 3.6, gy - r0 * 1.5, r0 * 7.2, r0 * 3, { r: r0, fill: 'rgba(20,12,6,0.88)', stroke: 'rgba(255,255,255,0.3)', shadow: false });
    for (let i = 0; i < 3; i++) {
      const on = i < lit;
      ctx.fillStyle = on ? '#ff3b30' : 'rgba(255,255,255,0.12)'; ctx.shadowColor = '#ff3b30'; ctx.shadowBlur = on ? r0 * 0.9 : 0;
      ctx.beginPath(); ctx.arc(gx + (i - 1) * r0 * 2.1, gy, r0 * 0.78, 0, TAU); ctx.fill(); ctx.shadowBlur = 0;
    }
  } else if (race.go && race.goT < 0.9) {
    const a = 1 - race.goT / 0.9;
    ctx.save(); ctx.globalAlpha = a; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `800 ${Math.round(Math.min(150, L.w / 3))}px ${DISPLAY}`;
    textShadow(ctx, 'GO!', L.w / 2, view.y + view.h * 0.26, '#6fe0a4', 14); ctx.restore();
    if (race.goT < 0.45 && !race.launched && !watch) {
      ctx.save(); ctx.textAlign = 'center'; ctx.font = `800 ${Math.round(Math.min(44, L.w / 10))}px ${FONT}`; textShadow(ctx, 'TAP!', L.w / 2, view.y + view.h * 0.4, GOLD, 8); ctx.restore();
    }
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
  panel(ctx, x, y, w, h, { r: 22, fill: 'rgba(50,26,10,0.93)', stroke: 'rgba(255,211,106,0.6)' });
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.font = `600 ${Math.round(18 * Math.min(sc, 1.6))}px ${FONT}`; ctx.fillStyle = 'rgba(255,244,220,0.7)'; ctx.fillText(kicker.toUpperCase(), x + 20, y + 30);
  ctx.font = `700 ${hs}px ${FONT}`; ctx.fillStyle = GOLD; ctx.fillText(plan.head, x + 20, y + 30 + hs * 1.25);
  ctx.font = `400 ${fs}px ${FONT}`; ctx.fillStyle = '#fff8e6';
  lines.forEach((l, i) => ctx.fillText(l, x + 20, y + 40 + hs * 1.3 + fs * 1.15 + i * fs * 1.3));
  if (prog != null) { roundPath(ctx, x + 20, y + h - 14, w - 40, 6, 3); ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.fill(); roundPath(ctx, x + 20, y + h - 14, Math.max(6, (w - 40) * prog), 6, 3); ctx.fillStyle = GOLD; ctx.fill(); }
}

// the whole hill in one strip: profile, surfaces, bends, obstacles and every racer
function drawStrip(ctx, r, state, race, c) {
  const pad = 14, x0 = r.x + pad, x1 = r.x + r.w - pad, w = x1 - x0;
  roundPath(ctx, r.x, r.y, r.w, r.h, 16); ctx.fillStyle = 'rgba(40,20,6,0.7)'; ctx.fill();
  ctx.strokeStyle = 'rgba(255,230,180,0.25)'; ctx.lineWidth = 1.5; ctx.stroke();
  const n = Math.ceil(c.len / 8);
  let lo = 1e9, hi = -1e9;
  for (let i = 0; i <= n; i++) { const e = c.elevAt(Math.min(c.len, i * 8)); lo = Math.min(lo, e); hi = Math.max(hi, e); }
  const span = Math.max(4, hi - lo), top = r.y + 12, base = r.y + r.h - 16, hh = base - top;
  const px = (m) => x0 + (m / c.len) * w, py = (e) => base - ((e - lo) / span) * hh * 0.8 - 2;
  // surface bar
  for (const sg of c.segs) {
    ctx.fillStyle = SURF[sg.surf].road2;
    ctx.fillRect(px(sg.s0), base + 2, px(Math.min(c.len, sg.s1)) - px(sg.s0) - 1, 6);
  }
  ctx.beginPath(); ctx.moveTo(x0, base);
  for (let i = 0; i <= n; i++) { const m = Math.min(c.len, i * 8); ctx.lineTo(px(m), py(c.elevAt(m))); }
  ctx.lineTo(x1, base); ctx.closePath();
  ctx.fillStyle = 'rgba(255,214,150,0.25)'; ctx.fill();
  ctx.beginPath(); for (let i = 0; i <= n; i++) { const m = Math.min(c.len, i * 8), X = px(m), Y = py(c.elevAt(m)); i === 0 ? ctx.moveTo(X, Y) : ctx.lineTo(X, Y); }
  ctx.strokeStyle = 'rgba(255,240,210,0.9)'; ctx.lineWidth = 2; ctx.stroke();
  // bends (direction as a little arrow) and obstacles
  for (const b of c.bends) {
    const X = (px(b.s0) + px(b.s1)) / 2, Y = py(c.elevAt((b.s0 + b.s1) / 2)) - 11;
    ctx.fillStyle = '#ffcb2f'; ctx.beginPath(); ctx.moveTo(X + b.dir * 8, Y); ctx.lineTo(X - b.dir * 6, Y - 7); ctx.lineTo(X - b.dir * 6, Y + 7); ctx.closePath(); ctx.fill();
  }
  for (const o of c.obs) { const X = px(o.s), Y = py(c.elevAt(o.s)); ctx.fillStyle = o.kind === 'puddle' ? '#7fc4ff' : o.kind === 'bale' ? '#e8c35a' : '#fff'; ctx.fillRect(X - 2, Y - 5, 4, 4); }
  ctx.fillStyle = '#fff'; ctx.fillRect(x1 - 1, r.y + 6, 2, r.h - 12);
  if (state.ghostS != null) { const m = Math.min(c.len, state.ghostS); ctx.strokeStyle = '#d8ecff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(px(m), py(c.elevAt(m)) - 1, 6, 0, TAU); ctx.stroke(); }
  const list = race.racers.slice().reverse();
  for (const k of list) {
    const m = Math.min(c.len, k.r.s), X = px(m), Y = py(c.elevAt(m)) - 1;
    ctx.fillStyle = k.color; ctx.beginPath(); ctx.arc(X, Y, k.human ? 8 : 6, 0, TAU); ctx.fill();
    ctx.strokeStyle = k.human ? '#fff' : 'rgba(255,255,255,0.7)'; ctx.lineWidth = k.human ? 3 : 1.5; ctx.stroke();
  }
}
