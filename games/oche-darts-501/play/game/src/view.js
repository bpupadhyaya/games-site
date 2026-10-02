// Drawing the play screen: wall, board, darts in the board, the aim point, scoreboard, throw chips, checkout coach, banners.
// Pure drawing; game.js owns the state.
import { W, H, BOARD, PANEL, LEG_LINE, CHIPS, COACH, THINK_BTN, MENU_BTN, WATCH, AIM, THINK_STEPS } from './layout.js';
import { drawBackdrop, drawBoardAt, drawDart, regionPath, wobbleAng, dartIcon, TAU, DART_STYLE } from './art.js';
import { FONT, NUM, C, roundPath, drawButton, panel, textShadow, ease } from './ui.js';
import { avg3, dartsLeft, targetByLabel } from './engine.js';
import { steadiness, tired } from './aim.js';
import { PROFILES } from './ai.js';

export const sideName = (state, side) => {
  const c = state.m.cfg;
  if (c.mode === 'two') return side === 0 ? 'Player 1' : 'Player 2';
  if (c.mode === 'watch') return PROFILES[side === 0 ? c.watchA : c.opp].name;
  return side === 0 ? 'You' : PROFILES[c.opp].name;
};
const STYLE_OF = [0, 1];

// ---- the board and what is in it -------------------------------------------------------------------
function highlight(ctx, label, kind, t) {
  if (!label) return;
  ctx.save();
  regionPath(ctx, label, BOARD.cx, BOARD.cy, BOARD.R);
  const pulse = 0.5 + 0.5 * Math.sin(t * 6);
  if (kind === 'main') {
    ctx.fillStyle = `rgba(255,214,90,${0.26 + 0.2 * pulse})`; ctx.fill();
    ctx.lineWidth = 4; ctx.strokeStyle = `rgba(255,232,130,${0.7 + 0.3 * pulse})`; ctx.shadowColor = 'rgba(255,200,60,0.9)'; ctx.shadowBlur = 14; ctx.stroke();
  } else if (kind === 'alt') {
    ctx.lineWidth = 2.5; ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.setLineDash([7, 6]); ctx.stroke();
  } else if (kind === 'flash') {
    ctx.fillStyle = `rgba(255,255,255,${0.5 * pulse})`; ctx.fill();
  }
  ctx.restore();
}

export function drawStuckDart(ctx, d, time) {
  const age = d.age;
  if (d.fall) {
    const f = d.fall;
    ctx.save();
    ctx.globalAlpha = Math.max(0, 1 - f.age / 0.7);
    drawDart(ctx, d.x + f.vx * f.age, d.y + f.vy * f.age + 600 * f.age * f.age, { scale: 1, ang: -0.27 + f.rot * f.age, style: STYLE_OF[d.side] });
    ctx.restore();
    return;
  }
  const leave = d.leave ? ease.inOut(Math.min(1, d.leave / 0.45)) : 0;
  const a = wobbleAng(age, d.amp, d.ph);
  drawDart(ctx, d.x, d.y + leave * 40, { scale: 1, ang: a, style: STYLE_OF[d.side], alpha: 1 - leave });
}

// Dart flying in: from the thrower's end (big, low) to the board (smaller, at the aim).
function drawFlight(ctx, f) {
  const k = Math.min(1, f.t / f.dur), e = ease.outCubic(k) * 0.55 + k * 0.45;
  const x = f.sx + (f.ex - f.sx) * e, arc = Math.sin(k * Math.PI) * 60;
  const y = f.sy + (f.ey - f.sy) * e - arc;
  const s = 1.7 - 0.7 * e;
  // streak
  ctx.save();
  const g = ctx.createLinearGradient(f.sx, f.sy, x, y);
  g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(255,240,200,0.28)');
  ctx.strokeStyle = g; ctx.lineWidth = 6 * s; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x - (x - f.sx) * 0.25, y - (y - f.sy) * 0.25); ctx.lineTo(x, y); ctx.stroke();
  ctx.restore();
  const dx = f.ex - f.sx, dy = f.ey - f.sy;
  drawDart(ctx, x, y, { scale: s, ang: -Math.atan2(dx, -dy) * 0.5 - 0.1, style: STYLE_OF[f.side], shadow: false });
}

function drawParticles(ctx, parts) {
  for (const p of parts) {
    const k = p.t / p.max, a = 1 - k;
    ctx.save();
    if (p.k === 'dust') { ctx.globalAlpha = a * 0.8; ctx.fillStyle = p.col; ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (1 + k), 0, TAU); ctx.fill(); }
    else if (p.k === 'spark') { ctx.globalAlpha = a; ctx.strokeStyle = '#ffe9a0'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.04, p.y - p.vy * 0.04); ctx.stroke(); }
    else if (p.k === 'conf') { ctx.globalAlpha = Math.min(1, a * 1.6); ctx.translate(p.x, p.y); ctx.rotate(p.rot + p.t * p.spin); ctx.fillStyle = p.col; ctx.fillRect(-p.size, -p.size * 0.5, p.size * 2, p.size); }
    else if (p.k === 'ring') { ctx.globalAlpha = a * 0.7; ctx.strokeStyle = p.col; ctx.lineWidth = 3 * a + 1; ctx.beginPath(); ctx.arc(p.x, p.y, 8 + k * p.size, 0, TAU); ctx.stroke(); }
    ctx.restore();
  }
}

function drawPops(ctx, pops) {
  for (const p of pops) {
    const k = p.t / 1.1;
    const s = ease.outBack(Math.min(1, k * 3)) * (k > 0.75 ? 1 - (k - 0.75) * 4 : 1);
    ctx.save();
    ctx.translate(p.x, p.y - 30 - k * 46); ctx.scale(Math.max(0.01, s), Math.max(0.01, s));
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `800 ${p.big ? 64 : 48}px ${NUM}`;
    ctx.lineWidth = 8; ctx.strokeStyle = 'rgba(0,0,0,0.75)'; ctx.lineJoin = 'round'; ctx.strokeText(p.text, 0, 0);
    ctx.fillStyle = p.col; ctx.fillText(p.text, 0, 0);
    if (p.sub) { ctx.font = `700 24px ${NUM}`; ctx.lineWidth = 5; ctx.strokeText(p.sub, 0, 34); ctx.fillStyle = '#fff6df'; ctx.fillText(p.sub, 0, 34); }
    ctx.restore();
  }
}

// The aim point: a ring as wide as the spread you will really get, colour from shaky to steady to tired, a thin string to the finger.
export function drawReticle(ctx, r, t) {
  const col = r.tired ? '#ff7a5c' : r.steady > 0.85 ? '#7dffa0' : r.steady > 0.45 ? '#ffe27a' : '#ffb347';
  ctx.save();
  if (r.fx !== undefined) {
    ctx.strokeStyle = 'rgba(255,255,255,0.28)'; ctx.lineWidth = 2; ctx.setLineDash([4, 6]);
    ctx.beginPath(); ctx.moveTo(r.fx, r.fy); ctx.lineTo(r.x, r.y); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(255,255,255,0.14)'; ctx.beginPath(); ctx.arc(r.fx, r.fy, 40, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 2; ctx.stroke();
  }
  const rho = Math.max(10, r.sigma * 1.5);
  ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.beginPath(); ctx.arc(r.x, r.y, rho, 0, TAU); ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = col; ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 5;
  ctx.beginPath(); ctx.arc(r.x, r.y, rho, 0, TAU); ctx.stroke();
  ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(r.x - rho - 10, r.y); ctx.lineTo(r.x - rho + 8, r.y); ctx.moveTo(r.x + rho - 8, r.y); ctx.lineTo(r.x + rho + 10, r.y);
  ctx.moveTo(r.x, r.y - rho - 10); ctx.lineTo(r.x, r.y - rho + 8); ctx.moveTo(r.x, r.y + rho - 8); ctx.lineTo(r.x, r.y + rho + 10); ctx.stroke();
  ctx.fillStyle = col; ctx.beginPath(); ctx.arc(r.x, r.y, 3.5, 0, TAU); ctx.fill();
  ctx.restore();
}

// ---- scoreboard --------------------------------------------------------------------------------------
function drawPanel(ctx, state, side) {
  const m = state.m, p = PANEL[side], active = m.turn === side && !m.over;
  const style = DART_STYLE[side];
  ctx.save();
  panel(ctx, p.x, p.y, p.w, p.h, { r: 22, fill: active ? 'rgba(33,24,14,0.94)' : 'rgba(20,16,12,0.86)', stroke: active ? '#e9c15f' : 'rgba(217,174,82,0.28)', lw: active ? 3.5 : 2 });
  // name and legs
  ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  ctx.fillStyle = active ? '#fff2cf' : 'rgba(255,242,207,0.7)'; ctx.font = `700 25px ${FONT}`;
  let name = sideName(state, side), fs = 25;
  while (ctx.measureText(name).width > p.w - 130 && fs > 14) { fs--; ctx.font = `700 ${fs}px ${FONT}`; }
  ctx.fillText(name, p.x + 18, p.y + 34);
  // legs won pips
  const need = m.cfg.legs;
  for (let i = 0; i < need; i++) {
    const cx = p.x + p.w - 24 - (need - 1 - i) * 26, cy = p.y + 26;
    ctx.beginPath(); ctx.arc(cx, cy, 9, 0, TAU);
    if (i < m.legsWon[side]) { ctx.fillStyle = '#e9c15f'; ctx.fill(); } else { ctx.strokeStyle = 'rgba(233,193,95,0.55)'; ctx.lineWidth = 2; ctx.stroke(); }
  }
  // remaining
  ctx.textAlign = 'center';
  ctx.font = `800 ${m.rem[side] >= 100 ? 88 : 92}px ${NUM}`;
  ctx.fillStyle = active ? '#ffffff' : 'rgba(255,255,255,0.78)';
  const shake = state.bustShake && active ? Math.sin(state.bustShake * 60) * 6 * Math.min(1, state.bustShake * 2) : 0;
  ctx.fillText(String(m.rem[side]), p.x + p.w / 2 + shake, p.y + 114);
  // small stats
  ctx.font = `600 20px ${NUM}`; ctx.fillStyle = 'rgba(255,238,200,0.72)'; ctx.textAlign = 'left';
  ctx.fillText(`Avg ${avg3(m.stats[side]).toFixed(1)}`, p.x + 18, p.y + p.h - 14);
  ctx.textAlign = 'right';
  const dl = active && m.turn === side ? dartsLeft(m) : 0;
  if (active) { for (let i = 0; i < 3; i++) dartIcon(ctx, p.x + p.w - 22 - (2 - i) * 22, p.y + p.h - 12, 38, side, i < dl ? 1 : 0.25); }
  else ctx.fillText(m.visit && m.turn !== side && state.lastVisit?.[side] !== undefined ? `Last ${state.lastVisit[side]}` : '', p.x + p.w - 18, p.y + p.h - 14);
  // a coloured flight dot so each side matches its darts
  ctx.fillStyle = style.flightA; ctx.beginPath(); ctx.arc(p.x + 8, p.y + 28, 4, 0, TAU); ctx.fill();
  ctx.restore();
}

function drawChips(ctx, state) {
  const m = state.m, v = m.visit, side = m.turn;
  const cw = 150, gap = 14, x0 = (W - (3 * cw + 2 * gap)) / 2;
  for (let i = 0; i < 3; i++) {
    const r = { x: x0 + i * (cw + gap), y: CHIPS.y, w: cw, h: CHIPS.h };
    const d = v.darts[i];
    roundPath(ctx, r.x, r.y, r.w, r.h, 16);
    ctx.fillStyle = d ? (d.busted ? 'rgba(140,31,27,0.92)' : 'rgba(30,22,14,0.94)') : 'rgba(0,0,0,0.38)'; ctx.fill();
    ctx.lineWidth = 2;
    if (d) {
      ctx.strokeStyle = d.busted ? '#ff7a6b' : d.mult === 3 ? '#8fe0ff' : d.mult === 2 ? '#ffd36a' : 'rgba(233,193,95,0.5)'; ctx.stroke();
      ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = '#fff6df'; ctx.font = `800 36px ${NUM}`;
      ctx.fillText(d.label === 'Out' ? 'Out' : d.label === 'Miss' ? 'Miss' : d.label, r.x + r.w / 2, r.y + 38);
      ctx.fillStyle = 'rgba(255,238,200,0.7)'; ctx.font = `600 20px ${NUM}`;
      ctx.fillText(d.busted ? 'bust' : d.value ? `${d.value}` : '0', r.x + r.w / 2, r.y + 61);
    } else {
      ctx.strokeStyle = 'rgba(233,193,95,0.25)'; ctx.setLineDash([6, 6]); ctx.stroke(); ctx.setLineDash([]);
      dartIcon(ctx, r.x + r.w / 2 + 6, r.y + r.h / 2 + 18, 40, side, 0.28);
    }
  }
  // visit total
  const tot = v.darts.reduce((s, d) => s + (d.busted ? 0 : d.value), 0);
  if (v.darts.length) {
    ctx.textAlign = 'left'; ctx.fillStyle = '#ffe08a'; ctx.font = `800 40px ${NUM}`; ctx.textBaseline = 'middle';
    ctx.fillText(v.bust ? '0' : `${tot}`, x0 + 3 * cw + 2 * gap + 14, CHIPS.y + CHIPS.h / 2 + 2);
  }
}

function routeChips(ctx, labels, x, y, size = 30) {
  let cx = x;
  labels.forEach((lb, i) => {
    ctx.font = `800 ${size}px ${NUM}`;
    const w = Math.max(size * 1.7, ctx.measureText(lb).width + 24), h = size + 14;
    roundPath(ctx, cx, y - h / 2, w, h, 12);
    ctx.fillStyle = lb === 'Bull' || lb[0] === 'D' ? '#8c1f1b' : lb[0] === 'T' ? '#1d5e37' : '#2a2018'; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = '#e9c15f'; ctx.stroke();
    ctx.fillStyle = '#fff6df'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(lb, cx + w / 2, y + 2);
    cx += w + 10;
    if (i < labels.length - 1) { ctx.fillStyle = 'rgba(255,238,200,0.6)'; ctx.font = `700 ${size}px ${NUM}`; ctx.fillText('›', cx - 5, y); cx += 12; }
  });
  return cx;
}

function drawCoach(ctx, state) {
  const m = state.m, r = COACH;
  panel(ctx, r.x, r.y, r.w, r.h, { r: 18, fill: 'rgba(14,10,7,0.9)', stroke: 'rgba(233,193,95,0.4)', lw: 2, shadow: false });
  ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  const cy = r.y + r.h / 2;
  const say = (text, size = 25, col = '#fff2cf') => {
    ctx.font = `700 ${size}px ${FONT}`; ctx.fillStyle = col; ctx.textAlign = 'center';
    let fs = size; while (ctx.measureText(text).width > r.w - 40 && fs > 15) { fs--; ctx.font = `700 ${fs}px ${FONT}`; }
    ctx.fillText(text, r.x + r.w / 2, cy);
  };
  if (state.toastT > 0 && state.toast) { say(state.toast, 25, '#ffe9a0'); return; }
  const th = state.think;
  if (th && m.cfg.mode === 'watch') {
    const prof = sideName(state, m.turn);
    if (th.phase === 'think') {
      ctx.font = `700 24px ${FONT}`; ctx.fillStyle = '#fff2cf'; ctx.textAlign = 'left';
      const dots = '.'.repeat(1 + Math.floor(state.t * 2.5) % 3);
      ctx.fillText(`${prof} is thinking${dots}`, r.x + 22, cy - 8);
      ctx.fillStyle = 'rgba(255,255,255,0.15)'; roundPath(ctx, r.x + 22, cy + 12, r.w - 44, 8, 4); ctx.fill();
      ctx.fillStyle = '#e9c15f'; roundPath(ctx, r.x + 22, cy + 12, Math.max(8, (r.w - 44) * Math.min(1, th.t / th.dur)), 8, 4); ctx.fill();
    } else {
      ctx.font = `700 21px ${FONT}`; ctx.fillStyle = '#fff2cf'; ctx.textAlign = 'center';
      let t = th.text, fs = 21;
      while (ctx.measureText(t).width > r.w - 30 && fs > 13) { fs--; ctx.font = `700 ${fs}px ${FONT}`; }
      ctx.fillText(t, r.x + r.w / 2, cy - 14);
      routeChips(ctx, [th.aim], r.x + r.w / 2 - 36, cy + 18, 22);
    }
    return;
  }
  if (!state.humanTurn) {
    if (th) { say(`${sideName(state, m.turn)} is lining up...`, 24); }
    else { const nm = sideName(state, m.turn); say(nm === 'You' ? 'You throw' : `${nm} throws`, 24); }
    return;
  }
  const rem = m.rem[m.turn], dl = dartsLeft(m);
  if (state.hint) {
    ctx.font = `700 22px ${FONT}`; ctx.fillStyle = '#ffe9a0'; ctx.textAlign = 'left';
    ctx.fillText(state.hint.kind === 'finish' ? 'Think: checkout' : state.hint.kind === 'setup' ? 'Think: set up' : 'Think: score', r.x + 20, cy);
    routeChips(ctx, state.hint.route, r.x + 220, cy, 28);
    return;
  }
  if (state.settings.coach && state.coachRoute) {
    ctx.font = `700 22px ${FONT}`; ctx.fillStyle = 'rgba(255,233,160,0.9)'; ctx.textAlign = 'left';
    ctx.fillText('Checkout', r.x + 20, cy);
    routeChips(ctx, state.coachRoute, r.x + 150, cy, 28);
    return;
  }
  say(state.phase === 'aiming' ? 'Slide to line up, wait for it to settle, let go' : `You need ${rem}. Touch and hold to aim.`, 22, 'rgba(255,242,207,0.9)');
}

function drawBanner(ctx, b) {
  const k = b.t / b.dur;
  const inK = ease.outBack(Math.min(1, b.t / 0.28)), outK = k > 0.82 ? 1 - (k - 0.82) / 0.18 : 1;
  const s = Math.max(0.01, inK) * outK;
  ctx.save();
  ctx.translate(W / 2, b.y ?? 600); ctx.scale(s, s); ctx.globalAlpha = Math.min(1, outK * 1.4);
  const hh = b.sub ? 190 : 150;
  roundPath(ctx, -310, -hh / 2, 620, hh, 26);
  ctx.fillStyle = b.kind === 'bust' ? 'rgba(120,20,18,0.95)' : b.kind === 'big' ? 'rgba(20,70,40,0.95)' : 'rgba(22,16,10,0.94)'; ctx.fill();
  ctx.lineWidth = 4; ctx.strokeStyle = b.kind === 'bust' ? '#ff8a7a' : '#e9c15f'; ctx.stroke();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  let bs = b.size ?? 78; ctx.font = `800 ${bs}px ${NUM}`;
  while (ctx.measureText(b.text).width > 560 && bs > 24) { bs -= 2; ctx.font = `800 ${bs}px ${NUM}`; }
  ctx.fillStyle = b.kind === 'bust' ? '#ffd0c8' : '#fff0c4';
  ctx.fillText(b.text, 0, b.sub ? -26 : 2);
  if (b.sub) { ctx.font = `700 28px ${FONT}`; ctx.fillStyle = 'rgba(255,240,200,0.92)'; ctx.fillText(b.sub, 0, 44); }
  ctx.restore();
}

// Everything on the play screen. `time` is the animation clock.
export function renderPlay(ctx, state) {
  const m = state.m, t = state.t;
  drawBackdrop(ctx);
  // board with a little shiver on impact
  const sh = state.shake ? state.shake.amp * Math.exp(-state.shake.t * 14) * Math.sin(state.shake.t * 90) : 0;
  ctx.save();
  ctx.translate(sh * 0.6, sh);
  drawBoardAt(ctx, BOARD.cx, BOARD.cy, BOARD.R);
  if (state.flash) highlight(ctx, state.flash.label, 'flash', state.flash.t * 3);
  if (state.hint) highlight(ctx, state.hint.route[0], 'main', t);
  if (state.think && state.think.phase !== 'think' && m.cfg.mode === 'watch') {
    for (const lb of state.think.alts.slice(1)) if (lb !== state.think.aim) highlight(ctx, lb, 'alt', t);
    highlight(ctx, state.think.aim, 'main', t);
  }
  for (const d of state.darts) drawStuckDart(ctx, d, t);
  ctx.restore();
  if (state.flight) drawFlight(ctx, state.flight);
  drawParticles(ctx, state.parts);
  drawPops(ctx, state.pops);
  if (state.reticle) drawReticle(ctx, state.reticle, t);
  if (state.aim && state.aim.cancel) {
    ctx.save(); ctx.textAlign = 'center'; ctx.font = `800 34px ${NUM}`; ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(0,0,0,0.8)';
    ctx.strokeText('Release to cancel', W / 2, 1120); ctx.fillStyle = '#ff9a8a'; ctx.fillText('Release to cancel', W / 2, 1120); ctx.restore();
  }
  // scoreboard
  drawPanel(ctx, state, 0); drawPanel(ctx, state, 1);
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.font = `700 22px ${FONT}`; ctx.fillStyle = 'rgba(255,238,200,0.78)';
  ctx.fillText(`Leg ${m.legNo}  ·  First to ${m.cfg.legs}  ·  ${m.cfg.start}`, W / 2, LEG_LINE.y);
  drawChips(ctx, state);
  drawCoach(ctx, state);
  // buttons
  if (m.cfg.mode === 'watch') {
    drawButton(ctx, WATCH.pause, state.paused ? 'Resume' : 'Pause', { primary: true, size: 32 });
    drawButton(ctx, WATCH.exit, 'Exit', { dark: true, size: 28 });
    drawButton(ctx, WATCH.dec, '−', { size: 40, disabled: state.settings.thinkIdx === 0 });
    drawButton(ctx, WATCH.inc, '+', { size: 40, disabled: state.settings.thinkIdx === THINK_STEPS.length - 1 });
    ctx.fillStyle = '#fff2cf'; ctx.font = `700 24px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(`Thinking time: ${THINK_STEPS[state.settings.thinkIdx]} s`, WATCH.label.x + WATCH.label.w / 2, WATCH.label.y + WATCH.label.h / 2);
    if (state.paused) { ctx.fillStyle = '#ffe9a0'; ctx.font = `800 40px ${NUM}`; ctx.fillText('PAUSED', W / 2, 1070); }
  } else {
    const can = state.humanTurn && state.phase === 'ready';
    drawButton(ctx, THINK_BTN, 'Think', { disabled: !can, size: 32, dark: can });
    drawButton(ctx, MENU_BTN, 'Menu', { dark: true, size: 32 });
  }
  if (state.banner) drawBanner(ctx, state.banner);
  if (state.pickup && state.phase === 'visitEnd') {
    ctx.textAlign = 'center'; ctx.font = `600 20px ${FONT}`; ctx.fillStyle = 'rgba(255,238,200,0.6)'; ctx.fillText('Tap to continue', W / 2, 1126);
  }
}
