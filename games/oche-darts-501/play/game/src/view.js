// Drawing the play screen: wall, board, darts in the board, the aim point, scoreboard, throw chips, checkout coach, banners.
// Pure drawing; game.js owns the state.
import { W, H, BOARD, BOARD_R0, PANEL, LEG_LINE, CHIPS, COACH, THINK_BTN, MENU_BTN, WATCH, AIM, HUD, THINK_STEPS } from './layout.js';
import { drawBackdrop, drawBoardAt, drawDart, regionPath, wobbleAng, dartIcon, TAU, DART_STYLE } from './art.js';
import { FONT, NUM, C, roundPath, drawButton, panel, textShadow, ease, wrapLines } from './ui.js';
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
export const shortName = (state, side) => {
  const c = state.m.cfg;
  if (c.mode === 'two') return side === 0 ? 'P1' : 'P2';
  if (c.mode === 'watch') return PROFILES[side === 0 ? c.watchA : c.opp].short;
  return side === 0 ? 'You' : PROFILES[c.opp].short;
};
// Dart sprites shrink a little with the board so they never hide it at big text sizes.
const dartScale = () => Math.max(0.62, Math.min(1, BOARD.R / BOARD_R0));

// Fits text to a box. Tries each candidate on one line (shrinking to minRatio of `size`), then the first candidate on up to
// maxLines lines, then the last candidate squeezed as small as it must go. Leaves the chosen font set on ctx.
// Returns { lines, fs }.
function fitCands(ctx, cands, maxW, maxH, size, o = {}) {
  const { minRatio = 0.7, maxLines = 1, weight = 700, fam = FONT, wrapMin = 0.55 } = o;
  const set = (fs) => { ctx.font = `${weight} ${fs}px ${fam}`; };
  for (const c of cands) {
    for (let fs = Math.round(size); fs >= Math.max(10, Math.round(size * minRatio)); fs--) {
      set(fs);
      if (ctx.measureText(c).width <= maxW && fs * 1.2 <= maxH) return { lines: [c], fs };
    }
  }
  if (maxLines > 1) {
    for (let fs = Math.round(size); fs >= Math.max(10, Math.round(size * wrapMin)); fs--) {
      set(fs);
      const lines = wrapLines(ctx, cands[0], maxW);
      if (lines.length <= maxLines && lines.length * fs * 1.15 <= maxH && lines.every((l) => ctx.measureText(l).width <= maxW)) return { lines, fs };
    }
  }
  const last = cands[cands.length - 1];
  let fs = Math.max(10, Math.round(size * minRatio));
  set(fs);
  while (ctx.measureText(last).width > maxW && fs > 8) { fs--; set(fs); }
  return { lines: [last], fs };
}

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
    drawDart(ctx, d.x + f.vx * f.age, d.y + f.vy * f.age + 600 * f.age * f.age, { scale: dartScale(), ang: -0.27 + f.rot * f.age, style: STYLE_OF[d.side] });
    ctx.restore();
    return;
  }
  const leave = d.leave ? ease.inOut(Math.min(1, d.leave / 0.45)) : 0;
  const a = wobbleAng(age, d.amp, d.ph);
  drawDart(ctx, d.x, d.y + leave * 40, { scale: dartScale(), ang: a, style: STYLE_OF[d.side], alpha: 1 - leave });
}

// Dart flying in: from the thrower's end (big, low) to the board (smaller, at the aim).
function drawFlight(ctx, f) {
  const k = Math.min(1, f.t / f.dur), e = ease.outCubic(k) * 0.55 + k * 0.45;
  const x = f.sx + (f.ex - f.sx) * e, arc = Math.sin(k * Math.PI) * 60;
  const y = f.sy + (f.ey - f.sy) * e - arc;
  const s = (1.7 - 0.7 * e) * (0.5 + 0.5 * dartScale());
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

const clampN = (v, a, b) => Math.max(a, Math.min(b, v));
const clampX = (x, m) => Math.max(m, Math.min(W - m, x));
function drawPops(ctx, pops) {
  for (const p of pops) {
    const k = p.t / 1.1;
    const s = ease.outBack(Math.min(1, k * 3)) * (k > 0.75 ? 1 - (k - 0.75) * 4 : 1);
    ctx.save();
    ctx.translate(clampX(p.x, 90 * HUD.ps), p.y - 30 * HUD.ps - k * 46); ctx.scale(Math.max(0.01, s), Math.max(0.01, s));
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const ps = HUD.ps; ctx.font = `800 ${(p.big ? 64 : 48) * ps}px ${NUM}`;
    ctx.lineWidth = 8; ctx.strokeStyle = 'rgba(0,0,0,0.75)'; ctx.lineJoin = 'round'; ctx.strokeText(p.text, 0, 0);
    ctx.fillStyle = p.col; ctx.fillText(p.text, 0, 0);
    if (p.sub) { ctx.font = `700 ${24 * ps}px ${NUM}`; ctx.lineWidth = 5; ctx.strokeText(p.sub, 0, 34 * ps); ctx.fillStyle = '#fff6df'; ctx.fillText(p.sub, 0, 34 * ps); }
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
// Every size below is the original 100% size times HUD.hs (the text-size setting); the geometry comes from layout.js.
function drawPanel(ctx, state, side) {
  const m = state.m, p = PANEL[side], active = m.turn === side && !m.over, hs = HUD.hs, st = HUD.stacked;
  const style = DART_STYLE[side];
  ctx.save();
  panel(ctx, p.x, p.y, p.w, p.h, { r: 22, fill: active ? 'rgba(33,24,14,0.94)' : 'rgba(20,16,12,0.86)', stroke: active ? '#e9c15f' : 'rgba(217,174,82,0.28)', lw: active ? 3.5 : 2 });
  const fn = 25 * hs, fa = 20 * hs;
  // the big remaining score first, so the left column knows how much room it has
  const remTxt = String(m.rem[side]);
  const fsc = (m.rem[side] >= 100 ? 88 : 92) * HUD.ns;
  ctx.font = `800 ${fsc}px ${NUM}`;
  const scoreW = ctx.measureText(remTxt).width;
  const colL = p.x + 18, colR = st ? p.x + p.w - 20 - scoreW - 26 : p.x + p.w - 14;
  // legs won pips
  const need = m.cfg.legs, pr = 9 * Math.min(hs, 2), pstep = pr * 2 + 8, pipsW = need * pstep;
  const pipY = p.y + 8 + 0.72 * fn;
  for (let i = 0; i < need; i++) {
    const cx = colR - pr - 1 - (need - 1 - i) * pstep;
    ctx.beginPath(); ctx.arc(cx, pipY, pr, 0, TAU);
    if (i < m.legsWon[side]) { ctx.fillStyle = '#e9c15f'; ctx.fill(); } else { ctx.strokeStyle = 'rgba(233,193,95,0.55)'; ctx.lineWidth = 2; ctx.stroke(); }
  }
  // name: full name shrinks first, then falls back to the short form
  ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  const nameMaxW = colR - colL - pipsW - 14;
  const nm = fitCands(ctx, [sideName(state, side), shortName(state, side)], nameMaxW, 1e9, fn, { minRatio: 0.62 });
  ctx.fillStyle = active ? '#fff2cf' : 'rgba(255,242,207,0.7)';
  ctx.fillText(nm.lines[0], colL, p.y + HUD.pan.nameBase);
  // a coloured flight dot so each side matches its darts
  ctx.fillStyle = style.flightA; ctx.beginPath(); ctx.arc(p.x + 8, pipY + 2, 4 * Math.min(hs, 2), 0, TAU); ctx.fill();
  // remaining
  ctx.font = `800 ${fsc}px ${NUM}`;
  ctx.fillStyle = active ? '#ffffff' : 'rgba(255,255,255,0.78)';
  const shake = 0;
  if (state.bustShake && active) {
    const k = Math.min(1, state.bustShake * 2), pulse = 0.5 + 0.5 * Math.sin(state.bustShake * 24);
    ctx.fillStyle = `rgb(255,${Math.round(255 - 150 * k * pulse)},${Math.round(255 - 170 * k * pulse)})`;
  }
  if (st) { ctx.textAlign = 'right'; ctx.fillText(remTxt, p.x + p.w - 20 + shake, p.y + HUD.pan.scoreBase); }
  else { ctx.textAlign = 'center'; ctx.fillText(remTxt, p.x + p.w / 2 + shake, p.y + HUD.pan.scoreBase); }
  // small stats: average on the left, darts left (or the last visit) on the right
  const by = p.y + HUD.pan.avgBase;
  ctx.font = `600 ${fa}px ${NUM}`; ctx.fillStyle = 'rgba(255,238,200,0.72)'; ctx.textAlign = 'left';
  const avgTxt = `Avg ${avg3(m.stats[side]).toFixed(1)}`;
  ctx.fillText(avgTxt, colL, by);
  const avgW = ctx.measureText(avgTxt).width;
  const dl = active ? dartsLeft(m) : 0;
  const dsz = 38 * Math.min(hs, 1.6), dstep = 22 * Math.min(hs, 1.6);
  if (active) {
    if (colR - colL - avgW > 3 * dstep + 20) for (let i = 0; i < 3; i++) dartIcon(ctx, colR - 8 - (2 - i) * dstep, p.y + p.h - 12 * Math.min(hs, 1.6) - 7 * (Math.min(hs, 1.6) - 1), dsz, side, i < dl ? 1 : 0.25);
  } else if (m.visit && m.turn !== side && state.lastVisit?.[side] !== undefined) {
    const lt = fitCands(ctx, [`Last ${state.lastVisit[side]}`, `L${state.lastVisit[side]}`], colR - colL - avgW - 18, 1e9, fa, { minRatio: 0.7, weight: 600, fam: NUM });
    ctx.textAlign = 'right'; ctx.fillStyle = 'rgba(255,238,200,0.72)';
    if (ctx.measureText(lt.lines[0]).width <= colR - colL - avgW - 14) ctx.fillText(lt.lines[0], colR, by);
  }
  ctx.restore();
}

function drawChips(ctx, state) {
  const m = state.m, v = m.visit, side = m.turn, cs = HUD.cs;
  const { cw, gap, x0 } = CHIPS;
  const fCL = 36 * cs, fCS = 20 * cs;
  for (let i = 0; i < 3; i++) {
    const r = { x: x0 + i * (cw + gap), y: CHIPS.y, w: cw, h: CHIPS.h };
    const d = v.darts[i];
    roundPath(ctx, r.x, r.y, r.w, r.h, 16);
    ctx.fillStyle = d ? (d.busted ? 'rgba(140,31,27,0.92)' : 'rgba(30,22,14,0.94)') : 'rgba(0,0,0,0.38)'; ctx.fill();
    ctx.lineWidth = 2;
    if (d) {
      ctx.strokeStyle = d.busted ? '#ff7a6b' : d.mult === 3 ? '#8fe0ff' : d.mult === 2 ? '#ffd36a' : 'rgba(233,193,95,0.5)'; ctx.stroke();
      ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = '#fff6df';
      const lab = fitCands(ctx, [d.label], r.w - 16, 1e9, fCL, { minRatio: 0.6, weight: 800, fam: NUM });
      ctx.fillText(lab.lines[0], r.x + r.w / 2, r.y + 1.056 * fCL);
      ctx.fillStyle = 'rgba(255,238,200,0.7)'; ctx.font = `600 ${fCS}px ${NUM}`;
      ctx.fillText(d.busted ? 'bust' : d.value ? `${d.value}` : '0', r.x + r.w / 2, r.y + 1.056 * fCL + 1.16 * fCS);
    } else {
      ctx.strokeStyle = 'rgba(233,193,95,0.25)'; ctx.setLineDash([6, 6]); ctx.stroke(); ctx.setLineDash([]);
      dartIcon(ctx, r.x + r.w / 2 + 6 * cs, r.y + r.h / 2 + 18 * cs, 40 * cs, side, 0.28);
    }
  }
  // visit total
  const tot = v.darts.reduce((s, d) => s + (d.busted ? 0 : d.value), 0);
  if (v.darts.length) {
    ctx.textAlign = 'left'; ctx.fillStyle = '#ffe08a'; ctx.textBaseline = 'middle';
    const t = fitCands(ctx, [v.bust ? '0' : `${tot}`], W - 10 - CHIPS.totalX, 1e9, 40 * cs, { minRatio: 0.6, weight: 800, fam: NUM });
    ctx.fillText(t.lines[0], CHIPS.totalX, CHIPS.y + CHIPS.h / 2 + 2);
  }
}

function routeW(ctx, labels, size) {
  let w = 0;
  ctx.font = `800 ${size}px ${NUM}`;
  labels.forEach((lb, i) => { w += Math.max(size * 1.7, ctx.measureText(lb).width + 24) + 10; if (i < labels.length - 1) w += 12; });
  return w - 10;
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
  const m = state.m, r = COACH, hs = HUD.hs;
  panel(ctx, r.x, r.y, r.w, r.h, { r: 18, fill: 'rgba(14,10,7,0.9)', stroke: 'rgba(233,193,95,0.4)', lw: 2, shadow: false });
  ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  const cy = r.y + r.h / 2, innerW = r.w - 40, innerH = r.h - 14;
  // Centred message: candidates from longest to shortest, then two lines, then squeezed.
  const say = (cands, size = 25, col = '#fff2cf') => {
    const list = Array.isArray(cands) ? cands : [cands];
    const f = fitCands(ctx, list, innerW, innerH, size * hs, { minRatio: 0.72, maxLines: 2 });
    ctx.fillStyle = col; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    f.lines.forEach((l, k) => ctx.fillText(l, r.x + r.w / 2, cy + (k - (f.lines.length - 1) / 2) * f.fs * 1.15));
  };
  // A label and a row of route chips: the label is dropped if it does not fit beside them.
  const labelAndChips = (labels, route, size, col) => {
    const cz = Math.min(28 * hs, 28 * 2.2, r.h - 30), rw = routeW(ctx, route, cz);
    const lab = fitCands(ctx, labels, innerW - rw - 16, 1e9, size * hs, { minRatio: 0.7 });
    ctx.textBaseline = 'middle';
    const lw = ctx.measureText(lab.lines[0]).width;
    if (lw <= innerW - rw - 16) {
      ctx.fillStyle = col; ctx.textAlign = 'left'; ctx.fillText(lab.lines[0], r.x + 20, cy);
      routeChips(ctx, route, r.x + 20 + lw + 16, cy, cz);
    } else routeChips(ctx, route, r.x + (r.w - rw) / 2, cy, cz);
  };
  if (state.toastT > 0 && state.toast) { say([state.toast], 25, '#ffe9a0'); return; }
  const th = state.think;
  if (th && m.cfg.mode === 'watch') {
    const prof = sideName(state, m.turn), pshort = shortName(state, m.turn);
    if (th.phase === 'think') {
      const dots = '.'.repeat(1 + Math.floor(state.t * 2.5) % 3);
      const f = fitCands(ctx, [`${prof} is thinking${dots}`, `${pshort} is thinking${dots}`, `Thinking${dots}`], innerW - 4, innerH * 0.55, 24 * hs, { minRatio: 0.7 });
      ctx.fillStyle = '#fff2cf'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText(f.lines[0], r.x + 22, cy - r.h * 0.17);
      const bh = Math.max(8, 8 * Math.min(hs, 2)), by = cy + r.h * 0.17 + 2;
      ctx.fillStyle = 'rgba(255,255,255,0.15)'; roundPath(ctx, r.x + 22, by, r.w - 44, bh, bh / 2); ctx.fill();
      ctx.fillStyle = '#e9c15f'; roundPath(ctx, r.x + 22, by, Math.max(bh, (r.w - 44) * Math.min(1, th.t / th.dur)), bh, bh / 2); ctx.fill();
    } else {
      // the plan in words; at normal size the target chip sits under it, at big sizes the words get the whole strip
      const one = hs < 1.5;
      const f = fitCands(ctx, [th.text], r.w - 30, one ? innerH - 30 : innerH, 21 * hs, { minRatio: 0.62, maxLines: one ? 1 : 2, wrapMin: 0.5 });
      ctx.fillStyle = '#fff2cf'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const cyT = one ? cy - 14 : cy;
      f.lines.forEach((l, k) => ctx.fillText(l, r.x + r.w / 2, cyT + (k - (f.lines.length - 1) / 2) * f.fs * 1.15));
      if (one) routeChips(ctx, [th.aim], r.x + r.w / 2 - 36, cy + 18, 22);
    }
    return;
  }
  if (state.phase === 'visitEnd' && state.pickup) { say(['Tap to continue'], 22, 'rgba(255,238,200,0.8)'); return; }
  if (state.aim && state.aim.cancel) { say(['Release to cancel'], 26, '#ff9a8a'); return; }
  if (!state.humanTurn) {
    const nm = sideName(state, m.turn), ns = shortName(state, m.turn);
    if (th) say([`${nm} is lining up...`, `${ns} is lining up`, 'Lining up...'], 24);
    else say(nm === 'You' ? ['You throw'] : [`${nm} throws`, `${ns} throws`, 'Throws'], 24);
    return;
  }
  const rem = m.rem[m.turn], dl = dartsLeft(m);
  if (state.hint) {
    labelAndChips([state.hint.kind === 'finish' ? 'Think: checkout' : state.hint.kind === 'setup' ? 'Think: set up' : 'Think: score', state.hint.kind === 'finish' ? 'Think:' : 'Try:'], state.hint.route, 22, '#ffe9a0');
    return;
  }
  if (state.settings.coach && state.coachRoute) {
    labelAndChips(['Checkout', 'Out'], state.coachRoute, 22, 'rgba(255,233,160,0.9)');
    return;
  }
  say(state.phase === 'aiming' ? ['Slide to line up, wait for it to settle, let go', 'Slide, settle, let go', 'Hold, settle, release'] : [`You need ${rem}. Touch and hold to aim.`, `You need ${rem}. Hold to aim.`, `You need ${rem}`, `${rem} to go`], 22, 'rgba(255,242,207,0.9)');
}

function drawBanner(ctx, b, state) {
  const k = b.t / b.dur, hs = HUD.hs;
  const inK = ease.outBack(Math.min(1, b.t / 0.28)), outK = k > 0.82 ? 1 - (k - 0.82) / 0.18 : 1;
  const s = Math.max(0.01, inK) * outK;
  const boxW = Math.round(Math.min(692, 620 + (hs - 1) * 36)), innerW = boxW - 60;
  const regTop = AIM.top + 16, regBot = CHIPS.y - 14, maxH = Math.max(150, (regBot - regTop) * (hs <= 1 ? 1 : 0.86));
  // largest title size whose wrapped lines (one line at 100%, up to three above) and sub-line fit the box
  const maxLines = hs <= 1 ? 1 : 3;
  const subSize = (b.sub ? 28 : 0) * hs;
  let fs = (b.size ?? 78) * hs, lines = [b.text], subLines = [], sfs = subSize;
  for (; fs >= 24; fs -= 2) {
    ctx.font = `800 ${fs}px ${NUM}`;
    lines = wrapLines(ctx, b.text, innerW);
    const wordsFit = lines.every((l) => ctx.measureText(l).width <= innerW);
    if (b.sub) {
      sfs = subSize; subLines = [];
      for (; sfs >= 16; sfs -= 2) { ctx.font = `700 ${sfs}px ${FONT}`; subLines = wrapLines(ctx, b.sub, innerW); if (subLines.length <= 2 && subLines.every((l) => ctx.measureText(l).width <= innerW)) break; }
    }
    const h = 60 + lines.length * fs * 1.05 + (b.sub ? 10 + subLines.length * sfs * 1.2 : 0);
    if (wordsFit && lines.length <= maxLines && h <= maxH) break;
  }
  ctx.font = `800 ${fs}px ${NUM}`;
  const hh = 60 + lines.length * fs * 1.05 + (b.sub ? 10 + subLines.length * sfs * 1.2 : 0);
  ctx.save();
  ctx.translate(W / 2, clampN(BOARD.cy + ((b.y ?? 600) - 592), regTop + hh / 2, regBot - hh / 2)); ctx.scale(s, s); ctx.globalAlpha = Math.min(1, outK * 1.4);
  roundPath(ctx, -boxW / 2, -hh / 2, boxW, hh, 26);
  ctx.fillStyle = b.kind === 'bust' ? 'rgba(120,20,18,0.95)' : b.kind === 'big' ? 'rgba(20,70,40,0.95)' : 'rgba(22,16,10,0.94)'; ctx.fill();
  ctx.lineWidth = 4; ctx.strokeStyle = b.kind === 'bust' ? '#ff8a7a' : '#e9c15f'; ctx.stroke();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  let y = -hh / 2 + 30;
  ctx.fillStyle = b.kind === 'bust' ? '#ffd0c8' : '#fff0c4'; ctx.font = `800 ${fs}px ${NUM}`;
  lines.forEach((l) => { ctx.fillText(l, 0, y + fs * 0.525 + 1); y += fs * 1.05; });
  if (b.sub) {
    y += 10;
    ctx.font = `700 ${sfs}px ${FONT}`; ctx.fillStyle = 'rgba(255,240,200,0.92)';
    subLines.forEach((l) => { ctx.fillText(l, 0, y + sfs * 0.6); y += sfs * 1.2; });
  }
  ctx.restore();
}

// Everything on the play screen. `time` is the animation clock.
export function renderPlay(ctx, state) {
  const m = state.m, t = state.t;
  drawBackdrop(ctx);
  // the board never moves; the dart wobbles in it and a spark marks the impact
  ctx.save();
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
  // scoreboard
  drawPanel(ctx, state, 0); drawPanel(ctx, state, 1);
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = 'rgba(255,238,200,0.78)';
  const legC = [`Leg ${m.legNo}  ·  First to ${m.cfg.legs}  ·  ${m.cfg.start}`, `Leg ${m.legNo}  ·  First to ${m.cfg.legs}`, `Leg ${m.legNo}`];
  const lf = fitCands(ctx, legC, W - 40, 1e9, 22 * HUD.hs, { minRatio: 0.8 });
  ctx.fillText(lf.lines[0], W / 2, LEG_LINE.y);
  drawChips(ctx, state);
  drawCoach(ctx, state);
  // buttons
  if (m.cfg.mode === 'watch') {
    drawButton(ctx, WATCH.pause, state.paused ? 'Resume' : 'Pause', { primary: true, size: HUD.btnFont });
    drawButton(ctx, WATCH.exit, 'Exit', { dark: true, size: HUD.btnFont * 0.875 });
    if (HUD.watchRow) {
      drawButton(ctx, WATCH.dec, '−', { size: HUD.watchFont, disabled: state.settings.thinkIdx === 0 });
      drawButton(ctx, WATCH.inc, '+', { size: HUD.watchFont, disabled: state.settings.thinkIdx === THINK_STEPS.length - 1 });
      const secs = THINK_STEPS[state.settings.thinkIdx], L = WATCH.label;
      const tf = fitCands(ctx, [`Thinking time: ${secs} s`, `Think time ${secs} s`, `${secs} s`], L.w - 12, L.h - 6, 24 * HUD.hs, { minRatio: 0.75 });
      ctx.fillStyle = '#fff2cf'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(tf.lines[0], L.x + L.w / 2, L.y + L.h / 2);
    }
    if (state.paused) {
      ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `800 ${40 * HUD.ps}px ${NUM}`;
      ctx.lineWidth = 8; ctx.lineJoin = 'round'; ctx.strokeStyle = 'rgba(0,0,0,0.8)'; ctx.strokeText('PAUSED', W / 2, BOARD.cy);
      ctx.fillStyle = '#ffe9a0'; ctx.fillText('PAUSED', W / 2, BOARD.cy); ctx.restore();
    }
  } else {
    const can = state.humanTurn && state.phase === 'ready';
    drawButton(ctx, THINK_BTN, 'Think', { disabled: !can, size: HUD.btnFont, dark: can });
    drawButton(ctx, MENU_BTN, 'Menu', { dark: true, size: HUD.btnFont });
  }
  if (state.banner) drawBanner(ctx, state.banner, state);
}
