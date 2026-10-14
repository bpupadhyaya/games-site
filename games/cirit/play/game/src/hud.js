// In-play HUD: scoreboard, javelins, pace bar with stamina, aim ring with the flight arc, danger rings, LEAN, Think / Pause, popups,
// Watch & Learn panel and drill overlays. Everything follows the text size through PLAY_M; layout.playLayout gives one set of rectangles
// for drawing and hit-testing. Field points are projected through the same camera maths the 3D presenter renders with.
import { live, host, playLayout, inRect, MIN_FONT, fz } from './layout.js';
import { FONT, C, roundPath, drawButton, panel, wrapLines } from './ui.js';
import { project, toVirtual } from './camera.js';
import { LANES, LANE_NAMES, MARK_Y, JAV_N, LEVELS, REACH_MAX, GAITS, LEAN_T, MARK_BACK } from './consts.js';
import { previewArc } from './ballistics.js';
import { incoming } from './ai.js';

const TAU = Math.PI * 2;
export const TEAM_COL = ['#d4501e', '#2a79d4'];

// a field point (x lane axis, y up, z along) to virtual units of the live viewport
export function proj(G, x, y, z) {
  const W = G.viewW || 720, H = G.viewH || 1280;
  if (!G.rig) return null;
  const p = project(G.rig, W, H, x, y, z);
  if (!p) return null;
  const v = toVirtual(p.u, p.v, W, H, live.w, live.h);
  return { x: v.x, y: v.y, depth: p.depth };
}
// virtual units per metre on the ground around a field point
const scaleAt = (G, x, z) => { const a = proj(G, x, 0, z - 0.5), b = proj(G, x, 0, z + 0.5); return a && b ? Math.hypot(b.x - a.x, b.y - a.y) : 30; };

function ring(ctx, G, x, z, rm, col, lw = 4, fill = null, y = 0.03) {
  ctx.beginPath();
  for (let i = 0; i <= 32; i++) {
    const a = (i / 32) * TAU, q = proj(G, x + Math.cos(a) * rm, y, z + Math.sin(a) * rm);
    if (!q) return false;
    if (i) ctx.lineTo(q.x, q.y); else ctx.moveTo(q.x, q.y);
  }
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  ctx.lineWidth = lw; ctx.strokeStyle = col; ctx.stroke();
  return true;
}
function tag(ctx, x, y, text, col = '#ffd54a', size = 22) {
  size = Math.max(MIN_FONT, size);
  ctx.save(); ctx.font = `800 ${size}px ${FONT}`; const w = ctx.measureText(text).width + 22;
  x = Math.min(Math.max(x, w / 2 + 6), live.w - w / 2 - 6);
  roundPath(ctx, x - w / 2, y - size, w, size * 1.45, 11); ctx.fillStyle = 'rgba(34,16,6,0.86)'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = col; ctx.stroke();
  ctx.fillStyle = '#fff6e4'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.fillText(text, x, y - size * 0.1); ctx.restore();
}
const label = (ctx, t, x, y, size = 22, col = '#fff6e4', align = 'center') => {
  size = Math.max(MIN_FONT, size);
  ctx.save(); ctx.fillStyle = col; ctx.font = `700 ${size}px ${FONT}`; ctx.textAlign = align; ctx.textBaseline = 'alphabetic'; ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 4; ctx.shadowOffsetY = 1;
  if (align === 'center') { const hw = ctx.measureText(t).width / 2 + 6; x = Math.min(Math.max(x, hw), live.w - hw); }
  ctx.fillText(t, x, y); ctx.restore();
};

// ---- the aim ring and the flight arc (the chaser's thumb) ------------------------------------------------------------------------------
function drawAim(ctx, G, S, L) {
  const s = S.s, a = G.aim;
  if (!a || !a.show) return;
  const ch = s.riders[s.chaser], ru = s.riders[s.runner];
  const guide = G.settings.guide;
  const x = LANES[a.lane], z = a.z;
  const live_ = a.active, col = a.out ? '#ff5a4a' : live_ ? '#ffe27a' : 'rgba(255,226,122,0.7)';
  ctx.save();
  // the lane row under the ring and a line up to the target height, so the lane is readable in the picture
  ring(ctx, G, x, z, 1.15, 'rgba(0,0,0,0.35)', 8);
  ring(ctx, G, x, z, 1.15, col, live_ ? 5 : 3, live_ ? 'rgba(255,226,122,0.18)' : null);
  ring(ctx, G, x, z, 0.5, col, 3);
  const base = proj(G, x, 0.03, z), top = proj(G, x, MARK_Y, z);
  if (base && top) {
    ctx.setLineDash([6, 6]); ctx.lineWidth = 3; ctx.strokeStyle = col; ctx.beginPath(); ctx.moveTo(base.x, base.y); ctx.lineTo(top.x, top.y); ctx.stroke(); ctx.setLineDash([]);
    ctx.beginPath(); ctx.arc(top.x, top.y, 14, 0, TAU); ctx.lineWidth = 4; ctx.strokeStyle = col; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(top.x - 20, top.y); ctx.lineTo(top.x + 20, top.y); ctx.moveTo(top.x, top.y - 20); ctx.lineTo(top.x, top.y + 20); ctx.stroke();
  }
  // the arc of the real throw from the hand to the ring
  if (guide < 2 && G.arc) {
    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.setLineDash([10, 9]); ctx.beginPath();
    let started = false;
    for (const p of G.arc.pts) { const q = proj(G, p.x, p.y, p.z); if (!q) continue; if (!started) { ctx.moveTo(q.x, q.y); started = true; } else ctx.lineTo(q.x, q.y); }
    ctx.stroke(); ctx.setLineDash([]);
  }
  // the ghost: where a steady runner will be when the javelin arrives (Guided only)
  if (guide === 0 && G.ghost) {
    const g = proj(G, LANES[G.ghost.lane], MARK_Y, G.ghost.z);
    if (g) { ctx.globalAlpha = 0.9; ctx.lineWidth = 3; ctx.strokeStyle = '#7fe8d6'; ctx.beginPath(); ctx.arc(g.x, g.y, 20, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1; }
  }
  const t = proj(G, x, MARK_Y + 1.0, z);
  const gap = s.dir * (ru.z - ch.z);
  if (t) {
    const txt = a.out ? 'Out of reach' : live_ ? `${Math.max(0, Math.round(G.arc ? G.arc.dist : gap))} m · release to throw` : `${LANE_NAMES[a.lane]} lane`;
    tag(ctx, t.x, t.y - 4, txt, a.out ? '#ff8a7a' : '#ffd54a', 22);
  }
  ctx.restore();
}

// ---- danger: where the rival's javelin is heading ----------------------------------------------------------------------------------------
function drawDanger(ctx, G, S) {
  const s = S.s, me = G.myRider;
  if (!me || me.role !== 'run') return;
  const foe = s.riders[s.chaser];
  ctx.save();
  if (foe.sw.ph === 'wind' && foe.sw.aim) {
    const left = Math.max(0, (foe.sw.tc - s.tick) / 60);
    const x = LANES[foe.sw.aim.lane], z = foe.sw.aim.z, r = 1.3 + left * 2.0;
    ring(ctx, G, x, z, r, 'rgba(255,70,50,0.95)', 5, 'rgba(255,60,40,0.16)');
    ring(ctx, G, x, z, 0.5, 'rgba(255,70,50,0.95)', 3);
  }
  const th = incoming(s, me);
  if (th) {
    const r = 1.2 + th.t * 1.6;
    ring(ctx, G, th.jav.ax, th.jav.az, r, 'rgba(255,70,50,0.95)', 5, 'rgba(255,60,40,0.2)');
    const q = proj(G, th.jav.ax, 0.03, th.jav.az);
    if (q && th.t < 0.9) label(ctx, th.t < 0.55 ? 'LEAN NOW' : 'Incoming', q.x, q.y - 26, 22, '#ffd0c8');
  }
  ctx.restore();
}

// ---- widgets -------------------------------------------------------------------------------------------------------------------------------
function drawPaceBar(ctx, G, L, S) {
  const T = L.track, c = G.c, thr = c.thr;
  ctx.save();
  panel(ctx, T.x - 16, T.y - 94, T.w + 32, T.h + 132, { r: 28, fill: 'rgba(34,16,6,0.78)', stroke: 'rgba(255,246,228,0.3)' });
  // the slot: a routed channel with the gait zones painted in it
  roundPath(ctx, T.x, T.y, T.w, T.h, 16); ctx.fillStyle = '#120a05'; ctx.fill();
  const bands = [[0, 0.34, '#4fae85'], [0.34, 0.68, '#93c553'], [0.68, 0.86, '#e8b83a'], [0.86, 1, '#e5602a']];
  for (const [a, b, col] of bands) {
    const gy = ctx.createLinearGradient(T.x, 0, T.x + T.w, 0); gy.addColorStop(0, col); gy.addColorStop(0.5, '#ffffff22'); gy.addColorStop(1, col);
    roundPath(ctx, T.x + 6, T.y + T.h * (1 - b) + 3, T.w - 12, T.h * (b - a) - 6, 9); ctx.fillStyle = col; ctx.globalAlpha = 0.78; ctx.fill(); ctx.globalAlpha = 1;
  }
  if (G.drill && G.drill.band) { const [a, b] = G.drill.band; roundPath(ctx, T.x - 8, T.y + T.h * (1 - b), T.w + 16, T.h * (b - a), 8); ctx.lineWidth = 4; ctx.strokeStyle = '#2fe6a0'; ctx.stroke(); }
  // handle: a brass slider with a ridge
  const hy = T.y + T.h * (1 - thr), hx = T.x - 12, hw = T.w + 24;
  roundPath(ctx, hx, hy - 15, hw, 44, 14); ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fill();
  const gh = ctx.createLinearGradient(0, hy - 22, 0, hy + 20); gh.addColorStop(0, '#fff0b8'); gh.addColorStop(0.45, '#e3b559'); gh.addColorStop(1, '#a8741f');
  roundPath(ctx, hx, hy - 22, hw, 42, 14); ctx.fillStyle = gh; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#4a2c0c'; ctx.stroke();
  ctx.strokeStyle = 'rgba(70,40,10,0.65)'; ctx.lineWidth = 2; for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(hx + 12, hy - 1 + i * 8); ctx.lineTo(hx + hw - 12, hy - 1 + i * 8); ctx.stroke(); }
  // stamina
  const me = G.myRider;
  if (me) {
    const sx = T.x + T.w + 14; roundPath(ctx, sx, T.y, 10, T.h, 5); ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fill();
    const f = Math.max(0, Math.min(1, me.stam)); roundPath(ctx, sx, T.y + T.h * (1 - f), 10, T.h * f, 5); ctx.fillStyle = f > 0.25 ? '#7fe8d6' : '#ff7a4a'; ctx.fill();
  }
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  const gi = thr >= 0.9 ? 3 : thr >= 0.68 ? 2 : thr >= 0.34 ? 1 : 0;
  { const words = GAITS[gi].name.split(' '); words.forEach((wd, i) => label(ctx, wd, T.x + T.w / 2, T.y - 24 - (words.length - 1 - i) * (MIN_FONT + 4), MIN_FONT, '#ffe9b0')); }   // stacked: a two-word gait name is wider than the gauge
  ctx.restore();
  void S;
}

function drawJavs(ctx, L, me, s) {
  if (!me || me.role !== 'chase') return;
  const n = me.javs;
  const x0 = L.javs.x, y0 = L.javs.y;
  ctx.save(); ctx.lineCap = 'round';
  panel(ctx, x0 - 12, y0 - 8, 3 * 30 + 26, 78, { r: 18, fill: 'rgba(34,16,6,0.72)', stroke: 'rgba(255,246,228,0.3)' });
  for (let i = 0; i < JAV_N; i++) {
    const have = i < n, ax = x0 + 10 + i * 30, ay = y0 + 2;
    // a poplar stick drawn with a light edge, a dark grip wrap and a team ribbon
    ctx.strokeStyle = have ? '#2a160a' : 'rgba(0,0,0,0.3)'; ctx.lineWidth = 11; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ax + 12, ay + 58); ctx.stroke();
    ctx.strokeStyle = have ? '#ecd09a' : 'rgba(255,246,228,0.22)'; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ax + 12, ay + 58); ctx.stroke();
    if (have) {
      ctx.strokeStyle = '#4a2a14'; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(ax + 9, ay + 42); ctx.lineTo(ax + 12, ay + 58); ctx.stroke();
      ctx.strokeStyle = '#d4501e'; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(ax + 4, ay + 16); ctx.lineTo(ax + 5, ay + 24); ctx.stroke();
    }
  }
  ctx.restore();
  void s;
}

function drawLean(ctx, L, me) {
  if (!me || me.role !== 'run') return;
  const b = L.lean;
  const ready = me.lean.cool <= 0 && me.lean.t <= 0;
  ctx.save();
  // a lacquered round pad with a visible edge and a brass ring
  ctx.beginPath(); ctx.arc(b.x, b.y + 9, b.r, 0, TAU); ctx.fillStyle = 'rgba(14,6,0,0.4)'; ctx.fill();
  ctx.beginPath(); ctx.arc(b.x, b.y + 6, b.r, 0, TAU); ctx.fillStyle = ready ? '#6e1f08' : '#1c120e'; ctx.fill();
  const g = ctx.createRadialGradient(b.x - b.r * 0.3, b.y - b.r * 0.45, b.r * 0.1, b.x, b.y, b.r);
  if (ready) { g.addColorStop(0, '#ff8446'); g.addColorStop(0.6, '#d94c18'); g.addColorStop(1, '#a8340f'); } else { g.addColorStop(0, '#6a5248'); g.addColorStop(1, '#3a2822'); }
  ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.fillStyle = g; ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = '#e2b866'; ctx.beginPath(); ctx.arc(b.x, b.y, b.r - 6, 0, TAU); ctx.stroke();
  ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(20,8,0,0.8)'; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.stroke();
  if (me.lean.t > 0) { ctx.beginPath(); ctx.arc(b.x, b.y, b.r - 16, -Math.PI / 2, -Math.PI / 2 + TAU * (me.lean.t / LEAN_T)); ctx.strokeStyle = '#7fe8d6'; ctx.lineWidth = 8; ctx.stroke(); }
  else if (me.lean.cool > 0) { ctx.beginPath(); ctx.arc(b.x, b.y, b.r - 16, -Math.PI / 2, -Math.PI / 2 + TAU * (1 - me.lean.cool / 1.9)); ctx.strokeStyle = '#ffd15a'; ctx.lineWidth = 6; ctx.stroke(); }
  ctx.fillStyle = '#fff6e4'; ctx.font = `800 ${fz(26)}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(20,6,0,0.8)'; ctx.shadowBlur = 4; ctx.shadowOffsetY = 2; ctx.fillText('LEAN', b.x, b.y);
  ctx.restore();
}

function iconButton(ctx, r, kind, opts = {}) {
  drawButton(ctx, r, '', { dark: true, ...opts });
  ctx.save(); ctx.fillStyle = '#fff6e4'; ctx.strokeStyle = '#fff6e4';
  const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
  if (kind === 'pause') { ctx.fillRect(cx - 12, cy - 15, 9, 30); ctx.fillRect(cx + 4, cy - 15, 9, 30); }
  else if (kind === 'play') { ctx.beginPath(); ctx.moveTo(cx - 10, cy - 16); ctx.lineTo(cx + 16, cy); ctx.lineTo(cx - 10, cy + 16); ctx.closePath(); ctx.fill(); }
  else { ctx.font = `800 ${fz(40)}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('?', cx, cy + 2); }
  ctx.restore();
}

function drawBoard(ctx, G, S, L) {
  const s = S.s, B = L.board, watch = G.mode === 'watch';
  const names = [watch ? 'Left' : 'You', G.rivalName || 'Rivals'];
  ctx.save();
  panel(ctx, B.x, B.y, B.w, B.h, { r: 24, fill: 'rgba(34,16,6,0.78)', stroke: 'rgba(255,246,228,0.35)' });
  const cx = B.x + B.w / 2, mid = B.y + B.h / 2;
  const big = Math.min(B.h * 0.62, 64 * Math.min(L.m, 1.5));
  ctx.textBaseline = 'middle';
  ctx.font = `800 ${Math.round(big)}px ${FONT}`; ctx.textAlign = 'center';
  ctx.fillStyle = TEAM_COL[0]; ctx.fillText(String(s.score[0]), B.x + 56 + (big > 50 ? 8 : 0), mid - 4);
  ctx.fillStyle = TEAM_COL[1]; ctx.fillText(String(s.score[1]), B.x + B.w - 56 - (big > 50 ? 8 : 0), mid - 4);
  ctx.font = `700 ${fz(20 * Math.min(1.3, L.m))}px ${FONT}`; ctx.fillStyle = 'rgba(255,246,228,0.8)';
  const sub = G.practiceLabel ? G.practiceLabel : `Bout ${Math.min(s.bout + 1, s.cfg.bouts)} of ${s.cfg.bouts} · Pass ${Math.min(2, s.pass + 1)}`;
  const role = G.myRider ? (G.myRider.role === 'chase' ? 'You chase' : G.myRider.role === 'run' ? 'You flee' : '') : (watch ? `${s.chaser < 3 ? 'Left' : 'Right'} chases` : '');
  ctx.fillText(sub, cx, B.y + B.h * 0.33);
  ctx.fillStyle = '#ffd97a'; ctx.font = `800 ${fz(24 * Math.min(1.3, L.m))}px ${FONT}`;
  ctx.fillText(role, cx, B.y + B.h * 0.7);
  ctx.font = `700 ${fz(18)}px ${FONT}`; void names;
  ctx.restore();
}

function popups(ctx, G) {
  for (const p of G.pops) {
    const k = p.age / p.life, a = k < 0.15 ? k / 0.15 : k > 0.7 ? Math.max(0, (1 - k) / 0.3) : 1;
    ctx.save(); ctx.globalAlpha = a;
    const y = p.y - 60 * Math.min(1, k * 2);
    ctx.font = `900 ${fz(p.big ? 54 : 38)}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    const hw = ctx.measureText(p.text).width / 2 + 10, px = Math.min(Math.max(p.x, hw), live.w - hw);   // keep the whole popup on screen
    ctx.lineWidth = 8; ctx.strokeStyle = 'rgba(30,14,6,0.85)'; ctx.strokeText(p.text, px, y);
    ctx.fillStyle = p.col; ctx.fillText(p.text, px, y);
    if (p.sub) { ctx.font = `700 ${fz(24)}px ${FONT}`; ctx.lineWidth = 6; ctx.strokeText(p.sub, px, y + 34); ctx.fillStyle = '#fff6e4'; ctx.fillText(p.sub, px, y + 34); }
    ctx.restore();
  }
}

// ---- Watch & Learn --------------------------------------------------------------------------------------------------------------------
export function watchRects(L) {
  const wb = L.watchBox, h = 78, y = live.h - host.b - 14 - h, gap = 10, w = (wb.w - 3 * gap) / 4;
  return [0, 1, 2, 3].map((i) => ({ x: wb.x + i * (w + gap), y, w, h }));
}
export function watchHit(L, x, y) { const r = watchRects(L); for (let i = 0; i < r.length; i++) if (inRect(r[i], x, y)) return i; return -1; }
function drawWatch(ctx, G, S, L) {
  const R = watchRects(L), w = G.watch, s = S.s;
  const sec = [2, 5, 8, 10][G.settings.thinkIdx];
  ctx.save();
  drawButton(ctx, R[0], w.paused ? 'Resume' : 'Pause', { dark: true, size: 26, primary: w.paused });
  drawButton(ctx, R[1], 'Think −', { dark: true, size: 24, disabled: G.settings.thinkIdx === 0 });
  drawButton(ctx, R[2], 'Think +', { dark: true, size: 24, disabled: G.settings.thinkIdx === 3 });
  drawButton(ctx, R[3], 'Menu', { dark: true, size: 26 });
  if (s.hold && !s.hold.go) {
    const bw = Math.min(L.watchBox.w, live.w - 40), x = L.watchBox.x, wrap = (t, mw, fs) => { ctx.font = `400 ${fs}px ${FONT}`; return wrapLines(ctx, t, mw); };
    const fs = fz(26), why = wrap(s.hold.why || '', bw - 60, fs);
    const ph = 60 + why.length * fs * 1.3 + 40, y = R[0].y - 16 - ph;
    panel(ctx, x, y, bw, ph, { r: 26, fill: 'rgba(34,16,6,0.9)', stroke: 'rgba(255,246,228,0.45)' });
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#ffd97a'; ctx.font = `800 ${fz(26)}px ${FONT}`;
    ctx.fillText(w.phase === 'think' ? `THINK  ${Math.ceil(Math.max(0, w.timer))} s` : w.phase === 'reveal' ? 'REVEAL' : 'GO', x + 28, y + 42);
    ctx.fillStyle = '#fff6e4'; ctx.font = `400 ${fs}px ${FONT}`;
    why.forEach((l, i) => ctx.fillText(l, x + 28, y + 42 + fs * 1.35 * (i + 1)));
    const k = w.phase === 'think' ? 1 - Math.max(0, w.timer) / sec : w.phase === 'reveal' ? 1 : 1;
    roundPath(ctx, x + 28, y + ph - 26, bw - 56, 10, 5); ctx.fillStyle = 'rgba(255,246,228,0.2)'; ctx.fill();
    roundPath(ctx, x + 28, y + ph - 26, (bw - 56) * k, 10, 5); ctx.fillStyle = w.phase === 'reveal' ? '#7fe8d6' : '#ffd15a'; ctx.fill();
    // highlight the decision in the picture
    const h = s.hold;
    if (h.kind === 'throw') { const col = w.phase === 'reveal' || w.phase === 'act' ? '#7fe8d6' : '#ffd15a'; ring(ctx, G, LANES[h.aim.lane], h.aim.z, 1.3, col, 6, 'rgba(255,255,255,0.12)'); ring(ctx, G, LANES[h.aim.lane], h.aim.z, 0.5, col, 4); }
    else if (h.kind === 'dodge' && h.action) { const rr = s.riders[h.rider]; const col = '#7fe8d6'; if (h.action.lane !== undefined) ring(ctx, G, LANES[h.action.lane], rr.z + s.dir * 2, 1.2, col, 6); }
  } else {
    ctx.textAlign = 'center'; label(ctx, w.paused ? 'Paused' : 'Watch & Learn', live.w / 2, R[0].y - 18, 24, '#ffd97a');
  }
  ctx.restore();
}

// ---- Think hint card -----------------------------------------------------------------------------------------------------------------
function drawThink(ctx, G, L) {
  const t = G.think; if (!t) return;
  const bw = Math.min(L.thinkBox.w, live.w - 40), x = L.thinkBox.x, fs = fz(26);
  ctx.save(); ctx.font = `400 ${fs}px ${FONT}`;
  const lines = wrapLines(ctx, t.text, bw - 56);
  const ph = 70 + lines.length * fs * 1.3 + 110, y = Math.max(L.topH + 10, live.h - host.b - ph - 20);
  panel(ctx, x, y, bw, ph, { r: 28, fill: 'rgba(34,16,6,0.94)', stroke: '#ffd97a' });
  ctx.textAlign = 'left'; ctx.fillStyle = '#ffd97a'; ctx.font = `800 ${fz(30)}px ${FONT}`; ctx.fillText(t.title, x + 28, y + 48);
  ctx.fillStyle = '#fff6e4'; ctx.font = `400 ${fs}px ${FONT}`;
  lines.forEach((l, i) => ctx.fillText(l, x + 28, y + 48 + fs * 1.4 * (i + 1)));
  const close = { x: x + bw - 230, y: y + ph - 88, w: 200, h: 68 };
  drawButton(ctx, close, 'Got it', { primary: true, size: 28 });
  G.thinkRects = { close };
  if (t.aim) { ring(ctx, G, LANES[t.aim.lane], t.aim.z, 1.3, '#7fe8d6', 6, 'rgba(127,232,214,0.14)'); }
  ctx.restore();
}

// ---- the 2D fallback (no WebGL): flat field and figures through the same camera -------------------------------------------------------------
export function renderFallback(ctx, G, S) {
  const s = S.s, w = live.w, h = live.h;
  ctx.save();
  const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#9cc4e8'); g.addColorStop(0.45, '#d3e1ea'); g.addColorStop(0.46, '#c9ae7c'); g.addColorStop(1, '#a98f5c');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 3; i++) {
    const a = proj(G, LANES[i], 0, G.cam.z - 30), b = proj(G, LANES[i], 0, G.cam.z + 30);
    if (a && b) { ctx.strokeStyle = 'rgba(110,84,50,0.6)'; ctx.lineWidth = 18; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
  }
  for (const id of s.act) {
    const r = s.riders[id], p = proj(G, r.x, 0, r.z), q = proj(G, r.x, MARK_Y, r.z - s.dir * MARK_BACK); if (!p) continue;
    const sc = scaleAt(G, r.x, r.z);
    ctx.fillStyle = r.team === 0 ? TEAM_COL[0] : TEAM_COL[1]; roundPath(ctx, p.x - sc * 1.3, p.y - sc * 1.1, sc * 2.6, sc * 1.0, 10); ctx.fill();
    if (q) { ctx.beginPath(); ctx.arc(q.x, q.y, sc * 0.45, 0, TAU); ctx.fillStyle = '#fff6e4'; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = '#4a2c17'; ctx.stroke(); }
  }
  for (const j of s.javs) { const p = proj(G, j.x, j.y, j.z); if (p) { ctx.fillStyle = '#f2d39a'; ctx.fillRect(p.x - 10, p.y - 2, 20, 4); } }
  ctx.restore();
}

// ---- the whole HUD ---------------------------------------------------------------------------------------------------------------------
export function renderHud(ctx, G, S, v) {
  const L = playLayout(G.settings.textIdx), s = S.s, watch = G.mode === 'watch';
  void v;
  ctx.save();
  drawAim(ctx, G, S, L);
  if (!watch) drawDanger(ctx, G, S);
  drawBoard(ctx, G, S, L);
  iconButton(ctx, L.pause, watch ? (G.watch.paused ? 'play' : 'pause') : 'pause');
  if (!watch) {
    iconButton(ctx, L.think, 'hint');
    drawJavs(ctx, L, G.myRider, s);
    drawPaceBar(ctx, G, L, S);
    drawLean(ctx, L, G.myRider);
  } else drawWatch(ctx, G, S, L);
  popups(ctx, G);
  // banners
  if (G.banner && G.banner.age < G.banner.life) {
    const b = G.banner, k = b.age / b.life, a = k < 0.12 ? k / 0.12 : k > 0.75 ? (1 - k) / 0.25 : 1;
    ctx.save(); ctx.globalAlpha = a; ctx.textAlign = 'center'; ctx.font = `900 ${fz(46)}px ${FONT}`; ctx.lineWidth = 9; ctx.strokeStyle = 'rgba(30,14,6,0.9)';
    ctx.strokeText(b.text, L.banner.cx, L.banner.y); ctx.fillStyle = '#ffd97a'; ctx.fillText(b.text, L.banner.cx, L.banner.y);
    if (b.sub) { ctx.font = `700 ${fz(26)}px ${FONT}`; ctx.lineWidth = 6; ctx.strokeText(b.sub, L.banner.cx, L.banner.y + 40); ctx.fillStyle = '#fff6e4'; ctx.fillText(b.sub, L.banner.cx, L.banner.y + 40); }
    ctx.restore();
  }
  if (G.drill) {
    const d = G.drill, t = `${d.label}: ${d.score} / ${d.need}${d.left !== undefined ? `  ·  ${d.left} left` : ''}`;
    label(ctx, t, live.w / 2, L.topH + (live.land ? 30 : 160), 24, '#7fe8d6');
  }
  if (!watch) drawThink(ctx, G, L);
  if (s.fade > 0.01) { ctx.fillStyle = `rgba(20,10,4,${Math.min(1, s.fade)})`; ctx.fillRect(0, 0, live.w, live.h); }
  ctx.restore();
}
