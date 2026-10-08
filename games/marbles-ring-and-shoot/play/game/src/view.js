// Everything drawn on the play screen: the table (backdrop, arena, marbles, aim guide, particles) and the HUD (score cards,
// info line, buttons, round banner). Pure drawing; game.js owns the state.
import { W, H, playLayout, TEXT_SCALES, inRect } from './layout.js';
import { RR, RA, RT, R_S, R_T, targets, shooterOf, valueOf, onLine } from './sim.js';
import { drawBackdrop, drawArena, drawMarble, specOf, SIDE, FONT } from './art.js';
import { PROFILES } from './opponents.js';
import { roundPath, panel, drawButton, wrapLines } from './ui.js';

const TAU = Math.PI * 2;
export const layoutOf = (state) => playLayout(TEXT_SCALES[state.settings.textIdx], !!(state.m && state.m.cfg.mode === 'watch'));
export const toScreen = (state, x, y) => { const b = layoutOf(state).board; return { x: b.cx + x * b.s, y: b.cy + y * b.s }; };

export function names(state) {
  const m = state.m, mode = m.cfg.mode;
  if (mode === 'two') return ['Player 1', 'Player 2'];
  if (mode === 'watch') return [PROFILES[m.cfg.watchA].name, PROFILES[m.cfg.opp].name];
  return ['You', PROFILES[m.cfg.opp].name];
}
const shortName = (n) => (n.length > 7 ? `${n.slice(0, 6)}.` : n);
function fitText(ctx, options, px, maxW, weight = 700) {
  ctx.font = `${weight} ${px}px ${FONT}`;
  for (const t of options) if (ctx.measureText(t).width <= maxW) return t;
  return options[options.length - 1];
}

// ---- the table ------------------------------------------------------------------------------------------------------
// o: { cx, cy, scale, hand (side whose shooter is in hand, glow the shooting line), over(ctx) }
export function drawTable(ctx, state, w, parts, o = {}) {
  const sc = o.scale ?? 1, cx = o.cx ?? W / 2, cy = o.cy ?? H / 2;
  drawBackdrop(ctx, W, H, cx, cy);
  ctx.save(); ctx.translate(cx, cy); ctx.scale(sc, sc);
  drawArena(ctx);
  if (o.hand !== undefined) drawLineGlow(ctx, state, o.hand);
  const list = w.balls.filter((b) => b.mode === 'live').sort((a, b) => a.y - b.y);
  const t = state.t;
  for (const b of list) {
    const act = o.active === b.id;
    drawMarble(ctx, b.x, b.y, b.r, specOf(b), { rot: b.rot, ra: b.ra, heat: b.heat, lift: act ? 4 + 1.6 * Math.sin(t * 5) : 0 });
    if (b.kind === 'shooter' && (b.vx !== 0 || b.vy !== 0 || true)) drawShooterTag(ctx, b, t, act);
  }
  if (o.over) o.over(ctx);
  drawParts(ctx, parts);
  ctx.restore();
}
function drawShooterTag(ctx, b, t, active) {
  const S = SIDE[b.side];
  ctx.save(); ctx.strokeStyle = S.glow; ctx.lineWidth = 2.4; ctx.globalAlpha = active ? 0.9 : 0.45;
  ctx.beginPath(); ctx.arc(b.x, b.y, b.r + 4 + (active ? Math.sin(t * 5) * 1.2 : 0), 0, TAU); ctx.stroke(); ctx.restore();
}
function drawLineGlow(ctx, state, side) {
  const S = SIDE[side], t = state.t;
  ctx.save(); ctx.lineCap = 'round';
  ctx.strokeStyle = S.glow.replace('0.95', String(0.22 + 0.12 * Math.sin(t * 4))); ctx.lineWidth = 34; ctx.beginPath(); ctx.arc(0, 0, RT, 0, TAU); ctx.stroke();
  ctx.setLineDash([2, 14]); ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, 0, RT, 0, TAU); ctx.stroke();
  ctx.restore();
}
function drawParts(ctx, parts) {
  for (const q of parts) {
    const k = q.t / q.max;
    ctx.save();
    if (q.kind === 0) {          // dust puff
      const r = q.size * (0.7 + k * 1.6);
      ctx.globalAlpha = (1 - k) * 0.4; const g = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, r);
      g.addColorStop(0, q.col); g.addColorStop(1, 'rgba(180,140,90,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(q.x, q.y, r, 0, TAU); ctx.fill();
    } else if (q.kind === 1) {   // glass spark
      const l = 7 * (1 - k), n = Math.hypot(q.vx, q.vy) || 1;
      ctx.globalAlpha = 1 - k; ctx.strokeStyle = '#fffbe8'; ctx.lineWidth = 2; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.lineTo(q.x - (q.vx / n) * l, q.y - (q.vy / n) * l); ctx.stroke();
    } else if (q.kind === 2) {   // ring pulse
      ctx.globalAlpha = (1 - k) * 0.85; ctx.strokeStyle = q.col; ctx.lineWidth = 3 * (1 - k) + 1; ctx.beginPath(); ctx.arc(q.x, q.y, q.size * (0.35 + k * 0.9), 0, TAU); ctx.stroke();
    } else {                     // sparkle
      ctx.globalAlpha = 1 - k; ctx.fillStyle = q.col; const s = q.size * (1 - k * 0.5);
      ctx.translate(q.x, q.y); ctx.rotate(q.t * 6);
      ctx.beginPath(); for (let i = 0; i < 8; i++) { const a = (i * Math.PI) / 4, r = i % 2 ? s * 0.35 : s; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }
}

// ---- aim guide ------------------------------------------------------------------------------------------------------
function dotted(ctx, pts, color, width, aFrom = 0.95, aTo = 0.45) {
  ctx.save(); ctx.lineCap = 'round'; ctx.lineWidth = width; ctx.setLineDash([0.1, width * 3.2]);
  const step = Math.max(1, Math.floor(pts.length / 60));
  for (let i = step; i < pts.length; i += step) {
    ctx.strokeStyle = color; ctx.globalAlpha = aFrom + (aTo - aFrom) * (i / pts.length);
    ctx.beginPath(); ctx.moveTo(pts[i - step].x, pts[i - step].y); ctx.lineTo(pts[i].x, pts[i].y); ctx.stroke();
  }
  ctx.restore();
}
function drawGuide(ctx, state, pv, color) {
  if (!pv) return;
  const calm = state.settings.calm;
  const end = calm || pv.first === null ? pv.path.length : pv.first + 1;
  dotted(ctx, pv.path.slice(0, Math.max(2, end)), color, 4.2);
  if (pv.contact) {
    ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = 2.6; ctx.setLineDash([5, 5]); ctx.globalAlpha = 0.9;
    ctx.beginPath(); ctx.arc(pv.contact.x, pv.contact.y, R_S, 0, TAU); ctx.stroke(); ctx.restore();
  }
  if (pv.out && pv.out.sp > 20) {   // where the struck marble is going
    const L = Math.min(150, pv.out.sp * 0.22);
    dotted(ctx, [{ x: pv.out.x0, y: pv.out.y0 }, { x: pv.out.x0 + pv.out.x * L, y: pv.out.y0 + pv.out.y * L }], '#ffe08a', 3.6, 0.95, 0.5);
  }
  if (pv.rest && calm) drawMarble(ctx, pv.rest.x, pv.rest.y, R_S, { kind: 'shooter', side: state.m.turn, variant: 0 }, { a: 0.4, ghost: true });
}

export function drawAim(ctx, state) {
  const m = state.m, a = state.aim, side = m.turn;
  if (m.phase !== 'aim' || !(state.humanTurn || state.think || state.aiDrag)) return;
  const sh = shooterOf(state.w, side);
  if (!sh) return;
  const dragging = !!(a.active || state.aiDrag);
  if (state.hintShot && !dragging) drawHintShot(ctx, state);
  if (dragging) {
    const Lb = 16 + a.power * 90, bx = sh.x - Math.cos(a.ang) * Lb, by = sh.y - Math.sin(a.ang) * Lb, perp = a.ang + Math.PI / 2;
    ctx.save(); ctx.lineCap = 'round';
    // a knuckle-and-thumb pull: two rubber strands and the thumb pad
    for (const sgn of [-1, 1]) {
      ctx.strokeStyle = 'rgba(40,24,8,0.4)'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(sh.x + Math.cos(perp) * sgn * 7 + 2, sh.y + Math.sin(perp) * sgn * 7 + 3); ctx.lineTo(bx + 2, by + 3); ctx.stroke();
      ctx.strokeStyle = SIDE[side].rib; ctx.lineWidth = 3.2; ctx.beginPath(); ctx.moveTo(sh.x + Math.cos(perp) * sgn * 7, sh.y + Math.sin(perp) * sgn * 7); ctx.lineTo(bx, by); ctx.stroke();
    }
    const fg = ctx.createRadialGradient(bx - 4, by - 5, 1, bx, by, 17);
    fg.addColorStop(0, '#ffe2c4'); fg.addColorStop(1, '#d99a6a');
    ctx.fillStyle = fg; ctx.beginPath(); ctx.ellipse(bx, by, 16, 13, a.ang, 0, TAU); ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(90,46,20,0.7)'; ctx.stroke();
    // power arc
    ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(30,18,6,0.45)'; ctx.beginPath(); ctx.arc(sh.x, sh.y, R_S + 14, 0, TAU); ctx.stroke();
    const g = ctx.createLinearGradient(sh.x - 30, sh.y, sh.x + 30, sh.y); g.addColorStop(0, '#6ee7a0'); g.addColorStop(0.6, '#ffd35a'); g.addColorStop(1, '#ff6a4a');
    ctx.strokeStyle = g; ctx.beginPath(); ctx.arc(sh.x, sh.y, R_S + 14, a.ang + Math.PI - a.power * Math.PI, a.ang + Math.PI + a.power * Math.PI); ctx.stroke();
    ctx.restore();
  }
  const pv = state.preview;
  if (pv && (dragging || state.kbOn || state.think)) drawGuide(ctx, state, pv, pv.first === null && !pv.out ? '#fff8e0' : '#ffffff');
}
function drawHintShot(ctx, state) {
  const h = state.hintShot;
  ctx.save();
  if (state.hintPreview) drawGuide(ctx, state, state.hintPreview, '#8fe9ff');
  if (h.pos) {
    ctx.globalAlpha = 0.6 + 0.25 * Math.sin(state.t * 6);
    drawMarble(ctx, h.pos.x, h.pos.y, R_S, { kind: 'shooter', side: state.m.turn, variant: 0 }, { ghost: true, a: 0.7 });
  }
  ctx.restore();
}

// ---- HUD ------------------------------------------------------------------------------------------------------------
function tinyRow(ctx, kinds, x, y, w, size) {
  const step = size * 1.7, maxN = Math.max(1, Math.floor(w / step));
  kinds.slice(0, maxN).forEach((k, i) => drawMarble(ctx, x + size + i * step, y, size, { kind: k, variant: i % 5, side: 0 }, { rot: i * 1.7, ra: 0.5 }));
}
function drawCard(ctx, state, side, L) {
  const m = state.m, r = L.cards[side], F = L.fs, S = SIDE[side], active = m.phase === 'aim' && m.turn === side, t = state.t, nm = names(state)[side];
  panel(ctx, r.x, r.y, r.w, r.h, { r: 22, fill: 'rgba(12,34,26,0.88)', stroke: active ? S.glow : 'rgba(255,240,200,0.25)' });
  if (active) { ctx.save(); roundPath(ctx, r.x - 3, r.y - 3, r.w + 6, r.h + 6, 25); ctx.lineWidth = 3; ctx.strokeStyle = S.glow.replace('0.95', String(0.3 + 0.25 * Math.sin(t * 5))); ctx.stroke(); ctx.restore(); }
  ctx.textBaseline = 'alphabetic';
  const total = m.scores[side] + m.rp[side] + (m.phase === 'clear' && state.res && m.turn === side ? state.res.total : 0);
  if (L.rows || r.h < F.score * 1.6) {
    const dr = Math.min(r.h * 0.38, 26);
    drawMarble(ctx, r.x + 16 + dr, r.y + r.h / 2, dr, { kind: 'shooter', side, variant: 0 }, { rot: t * 0.3 * 0 });
    const sc = String(total);
    ctx.font = `800 ${F.score}px ${FONT}`; const scW = ctx.measureText(sc).width;
    ctx.textAlign = 'right'; ctx.fillStyle = '#ffe08a'; ctx.fillText(sc, r.x + r.w - 16, r.y + r.h / 2 + F.score * 0.34);
    const nx = r.x + 30 + dr * 2, nw = r.x + r.w - 16 - scW - 14 - nx;
    ctx.textAlign = 'left'; ctx.fillStyle = '#fff8e0';
    ctx.fillText(fitText(ctx, [nm, shortName(nm)], F.name, nw), nx, r.y + r.h / 2 + F.name * 0.34, nw);
    return;
  }
  const dr = 22;
  drawMarble(ctx, r.x + 20 + dr, r.y + 18 + dr, dr, { kind: 'shooter', side, variant: 0 }, { rot: 0.4 });
  ctx.textAlign = 'left'; ctx.fillStyle = '#fff8e0';
  const nx = r.x + 30 + dr * 2, sc = String(total);
  ctx.font = `800 ${F.score}px ${FONT}`; const scW = ctx.measureText(sc).width;
  ctx.fillStyle = '#ffe08a'; ctx.textAlign = 'right'; ctx.fillText(sc, r.x + r.w - 16, r.y + 20 + F.score * 0.82);
  ctx.fillStyle = '#fff8e0'; ctx.textAlign = 'left';
  ctx.fillText(fitText(ctx, [nm, shortName(nm)], F.name, r.x + r.w - 16 - scW - 12 - nx), nx, r.y + 22 + F.name * 0.95, r.x + r.w - 16 - scW - 12 - nx);
  ctx.font = `600 ${F.sub}px ${FONT}`; ctx.fillStyle = 'rgba(255,240,205,0.78)';
  ctx.fillText(fitText(ctx, [`${m.got[side].length} marbles`, `${m.got[side].length}`], F.sub, r.x + r.w - 16 - scW - 12 - nx, 600), nx, r.y + 22 + F.name * 0.95 + F.sub * 1.25);
  tinyRow(ctx, m.got[side], r.x + 12, r.y + r.h - 16, r.w - 24, 7.5);
}
export function drawHud(ctx, state) {
  const L = layoutOf(state);
  drawCard(ctx, state, 0, L); drawCard(ctx, state, 1, L);
}
export function drawInfo(ctx, state) {
  const L = layoutOf(state), I = L.info, F = L.fs, m = state.m;
  roundPath(ctx, I.x, I.y, I.w, I.h, 20); ctx.fillStyle = 'rgba(12,34,26,0.82)'; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(255,240,200,0.3)'; ctx.stroke();
  ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
  const maxW = I.w - 28;
  if (state.toastT > 0 && state.toast) {
    const a = Math.min(1, state.toastT / 0.4);
    ctx.globalAlpha = a; let px = F.info, lines;
    for (; ; px = Math.max(Math.round(F.info * 0.75), px - 2)) { ctx.font = `700 ${px}px ${FONT}`; lines = wrapLines(ctx, state.toast, maxW); if (lines.length <= 2 || px <= Math.round(F.info * 0.75)) break; }
    lines = lines.slice(0, 2); ctx.fillStyle = '#fff8e0';
    lines.forEach((l, i) => ctx.fillText(l, I.x + I.w / 2, I.y + I.h / 2 + (i - (lines.length - 1) / 2) * px * 1.2, maxW));
    ctx.globalAlpha = 1;
    return;
  }
  const left = targets(state.w).reduce((s, b) => s + valueOf(b), 0), n = targets(state.w).length;
  const a = `Round ${m.round}${m.rounds > 1 ? ` of ${m.rounds}` : ''}`, b = `${n} marbles in the ring (${left} pts)`;
  ctx.fillStyle = '#fff8e0'; ctx.font = `700 ${F.info}px ${FONT}`;
  const txt = fitText(ctx, [`${a}  ·  ${b}`, b, `${n} marbles left`], F.info, maxW);
  ctx.fillText(txt, I.x + I.w / 2, I.y + I.h / 2, maxW);
}
// Landscape side panel filler: what is still in the ring, by kind.
function drawTally(ctx, state) {
  const L = layoutOf(state), T = L.tally;
  if (!T) return;
  const F = L.fs, tg = targets(state.w), cnt = { king: 0, glass: 0, clay: 0 };
  for (const b of tg) cnt[b.kind]++;
  roundPath(ctx, T.x, T.y, T.w, T.h, 20); ctx.fillStyle = 'rgba(12,34,26,0.82)'; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(255,240,200,0.3)'; ctx.stroke();
  const rows = [['king', 'King', 3], ['glass', 'Glass', 2], ['clay', 'Clay', 1]], pad = 14, rh = Math.min(F.info * 2.1, (T.h - 2 * pad - F.sub * 1.4) / 3);
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(255,240,205,0.8)'; ctx.font = `700 ${F.sub}px ${FONT}`; ctx.textAlign = 'left'; ctx.fillText('STILL IN THE RING', T.x + pad + 4, T.y + pad + F.sub * 0.5);
  rows.forEach(([k, nm, v], i) => {
    const y = T.y + pad + F.sub * 1.4 + rh * (i + 0.5), r = Math.min(rh * 0.4, 17);
    drawMarble(ctx, T.x + pad + 8 + r, y, r, { kind: k, variant: i * 2, side: 0 }, { rot: 0.8, ra: 0.5 });
    ctx.textAlign = 'right'; ctx.fillStyle = cnt[k] ? '#ffe08a' : 'rgba(255,240,205,0.4)'; ctx.font = `800 ${Math.round(F.info * 1.3)}px ${FONT}`; const cs = `× ${cnt[k]}`, cw = ctx.measureText(cs).width; ctx.fillText(cs, T.x + T.w - pad - 4, y);
    const lx = T.x + pad + 8 + r * 2 + 12, room = T.x + T.w - pad - 4 - cw - 8 - lx;
    ctx.textAlign = 'left'; ctx.fillStyle = '#fff8e0'; let fs = F.info, lab = `${nm}  ·  ${v} pt${v > 1 ? 's' : ''}`;
    ctx.font = `700 ${fs}px ${FONT}`; if (ctx.measureText(lab).width > room) { lab = `${nm} · ${v}`; }
    while (fs > 8 && ctx.measureText(lab).width > room) { fs -= 1; ctx.font = `700 ${fs}px ${FONT}`; }
    ctx.fillText(lab, lx, y);
  });
}
export function drawBar(ctx, state) {
  const m = state.m, watch = m.cfg.mode === 'watch', L = layoutOf(state), F = L.fs;
  if (m.phase === 'score') return;
  if (watch) {
    const D = L.demo;
    drawButton(ctx, D.dec, 'Think −', { size: F.demoBtn });
    drawButton(ctx, D.pause, state.paused ? 'Resume' : 'Pause', { primary: !state.paused, active: state.paused, size: Math.round(F.demoBtn * 1.12) });
    drawButton(ctx, D.inc, 'Think +', { size: F.demoBtn });
    drawButton(ctx, D.exit, L.z > 2 ? 'Leave' : 'Leave Watch & Learn', { dark: true, size: F.demoBtn });
    return;
  }
  const waiting = !state.humanTurn;
  drawButton(ctx, L.hint, state.hintBusy ? 'Thinking…' : 'Hint', { disabled: waiting || state.hintBusy || m.phase !== 'aim', size: F.btn });
  drawButton(ctx, L.menu, 'Menu', { dark: true, size: F.btn });
}
function drawChips(ctx, state) {
  for (const p of state.pops) {
    const k = p.t / p.max, s = toScreen(state, p.x, p.y), size = (p.size ?? 30);
    ctx.save(); ctx.globalAlpha = Math.min(1, (1 - k) * 2); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `800 ${size}px ${FONT}`; ctx.translate(s.x, s.y - 20 - k * 40);
    ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(5, size * 0.22); ctx.strokeStyle = 'rgba(20,34,18,0.92)'; ctx.strokeText(p.text, 0, 0);
    ctx.fillStyle = p.col ?? '#ffe08a'; ctx.fillText(p.text, 0, 0);
    ctx.restore();
  }
  // marbles flying to the score card of the side that won them
  const L = layoutOf(state);
  for (const f of state.flies) {
    const k = Math.min(1, f.t / f.max), e = 1 - Math.pow(1 - k, 3), s = toScreen(state, f.x, f.y), c = L.cards[f.side];
    const tx = c.x + 40, ty = c.y + Math.min(c.h / 2, 40);
    drawMarble(ctx, s.x + (tx - s.x) * e, s.y + (ty - s.y) * e - Math.sin(k * Math.PI) * 50, R_T * L.board.s * (1 - 0.35 * e) + 3, { kind: f.kind, variant: f.variant, side: 0 }, { rot: f.t * 9, lift: Math.sin(k * Math.PI) * 10 });
  }
}
function drawBanner(ctx, state) {
  const m = state.m;
  if (m.phase !== 'score' || !m.roundInfo) return;
  const info = m.roundInfo, k = Math.min(1, Math.max(0, (info.t - 0.3) / 0.5));
  if (k <= 0) return;
  const L = layoutOf(state), B = L.banner, nm = names(state), F = L.fs, y = B.y + (1 - k) * 24;
  ctx.save(); ctx.globalAlpha = k;
  roundPath(ctx, B.x, y, B.w, B.h, 28); ctx.fillStyle = 'rgba(10,30,24,0.95)'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,224,150,0.55)'; ctx.stroke();
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  const cx = B.x + B.w / 2;
  const y1 = y + 14 + F.bTitle, y2 = y1 + 10 + F.bScore * 1.05, y3 = y2 + 22 + F.bTap;
  ctx.fillStyle = '#fff8e0'; ctx.font = `800 ${F.bTitle}px ${FONT}`; ctx.fillText(fitText(ctx, [`Round ${info.round} done`, `Round ${info.round}`], F.bTitle, B.w - 30, 800), cx, y1, B.w - 30);
  ctx.font = `800 ${F.bScore}px ${FONT}`;
  const a = String(info.pts[0]), b = String(info.pts[1]), wa = ctx.measureText(a).width, wb = ctx.measureText(b).width, wc = ctx.measureText(' : ').width, mid = wa + wb + wc;
  ctx.textAlign = 'left'; ctx.fillStyle = SIDE[0].hud; ctx.fillText(a, cx - mid / 2, y2); ctx.fillStyle = '#ffe9bf'; ctx.fillText(' : ', cx - mid / 2 + wa, y2); ctx.fillStyle = SIDE[1].hud; ctx.fillText(b, cx - mid / 2 + wa + wc, y2);
  const sideW = (B.w - mid) / 2 - 16;
  ctx.fillStyle = 'rgba(255,240,205,0.9)';
  ctx.textAlign = 'right';
  ctx.font = `600 ${Math.round(F.bTap * 0.95)}px ${FONT}`;
  ctx.fillText(fitText(ctx, [nm[0], shortName(nm[0])], Math.round(F.bTap * 0.95), sideW, 600), cx - mid / 2 - 14, y2 - 4, sideW);
  ctx.textAlign = 'left'; ctx.fillText(fitText(ctx, [nm[1], shortName(nm[1])], Math.round(F.bTap * 0.95), sideW, 600), cx + mid / 2 + 14, y2 - 4, sideW);
  if (info.t > 1.2) { ctx.globalAlpha = k * (0.7 + 0.3 * Math.sin(state.t * 4)); ctx.textAlign = 'center'; ctx.fillStyle = '#fff8e0'; ctx.font = `500 ${F.bTap}px ${FONT}`; ctx.fillText(m.cfg.mode === 'watch' ? 'Next round starting…' : 'Tap to continue', cx, y3, B.w - 30); }
  ctx.restore();
}

export function renderPlay(ctx, state) {
  const m = state.m, w = state.w, L = layoutOf(state);
  const sh = m.phase === 'aim' ? shooterOf(w, m.turn) : null;
  const handSide = sh && sh.hand && state.humanTurn && !state.paused ? m.turn : undefined;
  drawTable(ctx, state, w, state.parts, {
    cx: L.board.cx + (state.sx || 0), cy: L.board.cy + (state.sy || 0), scale: L.board.s, hand: handSide, active: m.phase === 'aim' && sh ? sh.id : undefined,
    over: (c) => { drawAim(c, state); },
  });
  drawHud(ctx, state);
  drawInfo(ctx, state);
  drawTally(ctx, state);
  drawChips(ctx, state);
  drawBanner(ctx, state);
  if (state.think && m.phase === 'aim') {
    const th = state.think, r = L.cards[m.turn], frac = th.phase === 'think' ? Math.min(1, th.t / th.dur) : 1;
    roundPath(ctx, r.x + 22, r.y + r.h - 8, r.w - 44, 4, 2); ctx.fillStyle = 'rgba(255,255,255,0.16)'; ctx.fill();
    roundPath(ctx, r.x + 22, r.y + r.h - 8, Math.max(4, (r.w - 44) * frac), 4, 2); ctx.fillStyle = th.phase === 'think' ? '#ffd35a' : '#7ee8a8'; ctx.fill();
  }
  drawBar(ctx, state);
  void RR; void RA; void onLine; void inRect;
}
