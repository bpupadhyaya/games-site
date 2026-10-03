// The in-play HUD: score, role banner, metronome, closing ring, LEFT / RIGHT buttons, reveal chips, Watch & Learn panel and the 2D fallback.
// Everything follows the text-size setting through a gentler multiplier (PLAY_M).
import { W, H, hudLayout, inRect } from './layout.js';
import { FONT, DISPLAY, C, roundPath, drawButton, paintButton, wrapLines, panel } from './ui.js';
import { RING_DUR, TIMING, AIR, JUMP_H, THINK_STEPS } from './consts.js';

const TAU = Math.PI * 2;
export const W_RECTS = { pause: { x: 14, y: 1196, w: 200, h: 66 }, shorter: { x: 226, y: 1196, w: 140, h: 66 }, longer: { x: 378, y: 1196, w: 140, h: 66 }, quit: { x: 530, y: 1196, w: 176, h: 66 } };
export const watchHit = (x, y) => { const k = ['pause', 'shorter', 'longer', 'quit']; for (let i = 0; i < 4; i++) if (inRect(W_RECTS[k[i]], x, y)) return i; return -1; };

function text(ctx, t, x, y, px, col = '#fff6e4', weight = 700, align = 'center', shadow = true) {
  ctx.save(); ctx.font = `${weight} ${px}px ${FONT}`; ctx.textAlign = align; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = col;
  if (shadow) { ctx.shadowColor = 'rgba(30,14,4,0.7)'; ctx.shadowBlur = 5; ctx.shadowOffsetY = 1; }
  ctx.fillText(t, x, y); ctx.restore();
}
function fitText(ctx, t, x, y, maxW, px, col, weight = 700) {
  ctx.save(); ctx.font = `${weight} ${px}px ${FONT}`;
  while (ctx.measureText(t).width > maxW && px > 12) { px -= 1; ctx.font = `${weight} ${px}px ${FONT}`; }
  ctx.restore();
  text(ctx, t, x, y, px, col, weight);
}

export function roleText(s, mine = 0) {
  const lead = s.leader === mine;
  return lead ? { head: 'You LEAD', tail: 'MATCH the feet', col: '#7fe8d6' } : { head: 'You FOLLOW', tail: 'DIFFER from the feet', col: '#ffc08a' };
}

function metronome(ctx, G, s, tD, lay, y) {
  const w = 420, x0 = W / 2 - w / 2;
  ctx.save();
  roundPath(ctx, x0, y - 12, w, 24, 12); ctx.fillStyle = 'rgba(30,14,4,0.55)'; ctx.fill();
  let pos = 0, lit = 0;
  const r = s.round;
  if (r && r.r0 > 0 && s.phase === 'run') {
    const ph = (tD - r.r0) / r.T;
    pos = Math.cos(Math.PI * ph);
    const near = Math.abs(ph - Math.round(ph));
    lit = Math.max(0, 1 - near * r.T / 0.09);
  }
  for (const sx of [-1, 1]) { ctx.beginPath(); ctx.arc(W / 2 + sx * (w / 2 - 14), y, 7, 0, TAU); ctx.fillStyle = (sx * pos > 0.92) ? '#ffd97a' : 'rgba(255,246,228,0.35)'; ctx.fill(); }
  ctx.beginPath(); ctx.arc(W / 2 + pos * (w / 2 - 14), y, 10 + 3 * lit, 0, TAU); ctx.fillStyle = lit > 0.2 ? '#fff6e4' : '#ffc94d'; ctx.fill();
  ctx.restore();
}

function ring(ctx, G, s, tD, lay) {
  const r = s.round; if (!r || s.over || s.phase !== 'run') return;
  const R = lay.ring, tim = TIMING[G.settings.timing === 'relaxed' ? 'relaxed' : 'standard'];
  const p = (r.tc - tD) / RING_DUR;
  const locked = r.foot[0] !== null && G.mode !== 'watch';
  ctx.save();
  // the target: a gold ring the closing ring must reach
  ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(255,217,122,0.95)'; ctx.beginPath(); ctx.arc(R.x, R.y, R.rt, 0, TAU); ctx.stroke();
  ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,246,228,0.35)'; ctx.beginPath(); ctx.arc(R.x, R.y, R.rt + 8, 0, TAU); ctx.stroke();
  if (p <= 1.0 && p > -tim.okLate / RING_DUR) {
    const rad = R.rt + (R.r0 - R.rt) * Math.max(0, p);
    const near = Math.abs(p * RING_DUR) <= tim.okEarly;
    ctx.lineWidth = near ? 9 : 6; ctx.strokeStyle = locked ? 'rgba(127,232,214,0.9)' : near ? '#ffffff' : 'rgba(255,246,228,0.8)';
    ctx.beginPath(); ctx.arc(R.x, R.y, rad, 0, TAU); ctx.stroke();
  }
  ctx.restore();
}

function feetChips(ctx, G, s, tD, view) {
  const r = s.round, P = s.prev;
  const src = r && r.resolved ? r : null;
  if (!src || !view.overlay || !view.overlay.feet || !view.overlay.feet[0]) return;
  const age = tD - src.tb;
  if (age < -0.08 || age > 1.1) return;
  const res = src.result;
  for (let i = 0; i < 2; i++) {
    const f = res.feet[i]; if (f === null) continue;
    const pt = view.overlay.feet[i] && view.overlay.feet[i][f === 0 ? 0 : 1]; if (!pt) continue;
    const a = Math.min(1, (age + 0.08) / 0.1) * (age > 0.8 ? Math.max(0, 1 - (age - 0.8) / 0.3) : 1);
    const col = i === 0 ? '#ffc94d' : '#35d1bd', dark = i === 0 ? '#9a6a00' : '#14756b';
    const lead = src.result.lead === i;
    ctx.save(); ctx.globalAlpha = a;
    // a glowing halo round the thrown foot, in the player's colour, so the foot reads at a glance
    const hr = 58 * (1 + 0.08 * Math.sin(age * 18));
    const gr = ctx.createRadialGradient(pt.x, pt.y, 6, pt.x, pt.y, hr);
    gr.addColorStop(0, col + 'cc'); gr.addColorStop(0.6, col + '55'); gr.addColorStop(1, col + '00');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(pt.x, pt.y, hr, 0, TAU); ctx.fill();
    ctx.lineWidth = 4; ctx.strokeStyle = col; ctx.beginPath(); ctx.arc(pt.x, pt.y, 40, 0, TAU); ctx.stroke();
    // chip: big letter, then who it is (LEADER / FOLLOWER)
    const rr = 32, cy = pt.y - 78;
    ctx.beginPath(); ctx.arc(pt.x, cy, rr, 0, TAU); ctx.fillStyle = dark; ctx.fill();
    ctx.lineWidth = 3.5; ctx.strokeStyle = '#fff6e4'; ctx.stroke();
    ctx.fillStyle = '#fffaf0'; ctx.font = `700 38px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(f === 0 ? 'L' : 'R', pt.x, cy + 1);
    const tag = lead ? 'LEADER' : 'FOLLOWER';
    ctx.font = `700 20px ${FONT}`;
    const tw = ctx.measureText(tag).width + 20;
    roundPath(ctx, pt.x - tw / 2, cy - rr - 28, tw, 26, 13); ctx.fillStyle = 'rgba(30,14,4,0.82)'; ctx.fill();
    ctx.fillStyle = col; ctx.fillText(tag, pt.x, cy - rr - 14);
    ctx.restore();
  }
}

function revealBanner(ctx, G, s, tD, lay) {
  const r = s.round; if (!r || !r.resolved) return;
  const age = tD - r.tb; if (age < 0 || age > 1.2) return;
  const res = r.result;
  const m = lay.m;
  let big, sub, col;
  if (res.miss[0] || res.miss[1]) { big = res.miss[0] && res.miss[1] ? 'BOTH MISSED' : res.miss[0] ? 'MISSED' : 'THEY MISSED'; col = '#ffb59a'; sub = res.scorer >= 0 ? (res.scorer === 0 ? 'You score' : 'Point to the other side') : 'Replay'; }
  else { big = res.match ? 'SAME FOOT' : 'DIFFERENT'; col = res.match ? '#ffe9a0' : '#9fe4ff'; sub = res.scorer < 0 ? (res.match ? 'Leader would score' : 'Follower would score') : (res.scorer === 0 ? (G.mode === 'watch' ? 'Gold scores' : 'You score!') : (G.mode === 'watch' ? 'Teal scores' : 'Computer scores')); }
  const a = Math.min(1, age / 0.1) * (age > 0.9 ? Math.max(0, 1 - (age - 0.9) / 0.3) : 1);
  const y = lay.topH + 130 + 6 * m;
  ctx.save(); ctx.globalAlpha = a;
  const sc = 0.85 + 0.15 * Math.min(1, age / 0.15);
  ctx.translate(W / 2, y); ctx.scale(sc, sc);
  text(ctx, big, 0, 0, Math.round(66 * Math.min(m, 1.3)), col, 700, 'center');
  text(ctx, sub, 0, 44 * Math.min(m, 1.3), Math.round(30 * Math.min(m, 1.3)), '#fff6e4', 700, 'center');
  ctx.restore();
}

export function renderHud(ctx, G, S, view) {
  const s = S.s, lay = hudLayout(G.settings.textIdx), m = lay.m;
  const tD = G.dispT ?? s.t;
  // ---- top bar
  const barH = Math.round(64 * m), by = 12;
  const names = G.mode === 'watch' ? ['GOLD', 'TEAL'] : ['YOU', 'COM'];
  const pill = (x, w, label, n, col, mine) => {
    roundPath(ctx, x, by, w, barH, 20); ctx.fillStyle = 'rgba(40,20,8,0.78)'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = col; ctx.stroke();
    text(ctx, label, x + 18, by + barH * 0.62, Math.round(22 * m), col, 700, 'left');
    text(ctx, String(n), x + w - 18, by + barH * 0.7, Math.round(44 * m), '#fff6e4', 700, 'right');
    if (mine) { ctx.beginPath(); ctx.arc(x + w - 18 - (String(n).length * 26 * m) - 10, by + barH / 2, 8, 0, TAU); ctx.fillStyle = '#ffd97a'; ctx.fill(); }
  };
  const pw = 250 * Math.min(1.1, m);
  pill(14, pw, names[0], s.score[0], '#ffd36a', s.leader === 0);
  pill(W - 14 - pw, pw, names[1], s.score[1], '#7fe8d6', s.leader === 1);
  const tgt = s.cfg.mode === 'practice' || s.cfg.mode === 'learn' ? (s.cfg.maxRounds ? `Round ${Math.min(s.n + 1, s.cfg.maxRounds)} / ${s.cfg.maxRounds}` : 'Practice') : `First to ${s.cfg.target}`;
  fitText(ctx, tgt, W / 2, by + barH * 0.64, W - 2 * (pw + 30), Math.round(22 * m), '#ffe9a0');
  fitText(ctx, `${Math.round(s.bpm)} BPM`, W / 2, by + barH * 0.98, W - 2 * (pw + 30), Math.round(20 * m), 'rgba(255,246,228,0.85)', 400);
  // ---- role banner
  if (G.mode !== 'watch') {
    const rl = roleText(s, 0), bh = Math.round(52 * m), by2 = by + barH + 10;
    roundPath(ctx, 14, by2, W - 28, bh, 18); ctx.fillStyle = 'rgba(40,20,8,0.7)'; ctx.fill();
    const label = G.mode === 'practice' || (s.cfg.mode === 'learn' && s.cfg.script) ? `${rl.head}: ${rl.tail}`.replace(/You (LEAD|FOLLOW)/, 'Round') : `${rl.head}: ${rl.tail}`;
    fitText(ctx, G.mode === 'practice' ? 'Tap in time with the ring' : label, W / 2, by2 + bh * 0.68, W - 60, Math.round(28 * m), G.mode === 'practice' ? '#ffe9a0' : rl.col);
  } else {
    const bh = Math.round(52 * m), by2 = by + barH + 10;
    roundPath(ctx, 14, by2, W - 28, bh, 18); ctx.fillStyle = 'rgba(40,20,8,0.7)'; ctx.fill();
    fitText(ctx, `${s.leader === 0 ? 'Gold' : 'Teal'} leads: wants the feet to match`, W / 2, by2 + bh * 0.68, W - 60, Math.round(26 * m), '#ffe9a0');
  }
  metronome(ctx, G, s, tD, lay, lay.topH + 30);
  revealBanner(ctx, G, s, tD, lay);
  feetChips(ctx, G, s, tD, view);
  // ---- controls
  if (G.mode === 'watch') { renderWatch(ctx, G, S); return; }
  ring(ctx, G, s, tD, lay);
  const r = s.round;
  const locked = r && r.foot[0] !== null && !r.resolved ? r.foot[0] : -1;
  const lastFoot = r && r.resolved && r.foot[0] !== null && tD - r.tb < 0.6 ? r.foot[0] : -1;
  const down = G.pressFlash;
  for (const [rect, label, f] of [[lay.left, 'LEFT', 0], [lay.right, 'RIGHT', 1]]) {
    const on = locked === f || lastFoot === f;
    paintButton(ctx, rect, { active: on, dark: !on });
    ctx.save(); ctx.fillStyle = '#fffaf0'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const px = Math.round(52 * Math.min(m, 1.4));
    ctx.font = `700 ${px}px ${FONT}`; ctx.fillText(label, rect.x + rect.w / 2, rect.y + rect.h * 0.42);
    ctx.font = `400 ${Math.round(22 * Math.min(m, 1.4))}px ${FONT}`; ctx.globalAlpha = 0.8; ctx.fillText(f === 0 ? 'left foot' : 'right foot', rect.x + rect.w / 2, rect.y + rect.h * 0.75);
    ctx.restore();
    void down;
  }
  // grade feedback above the ring
  if (G.fb && tD - G.fb.t < 0.7) {
    const a = 1 - (tD - G.fb.t) / 0.7;
    ctx.save(); ctx.globalAlpha = Math.max(0, Math.min(1, a * 1.5));
    text(ctx, G.fb.text, W / 2, lay.ring.y - lay.ring.r0 - 14 - (1 - a) * 0, Math.round(40 * Math.min(m, 1.4)), G.fb.col, 700, 'center');
    if (G.fb.d !== undefined) text(ctx, `${G.fb.d > 0 ? '+' : ''}${G.fb.d} ms`, W / 2, lay.ring.y - lay.ring.r0 + 18, Math.round(20 * Math.min(m, 1.4)), 'rgba(255,246,228,0.85)', 400);
    ctx.restore();
  }
  drawButton(ctx, lay.util.think, 'Think', { dark: true, size: Math.round(28 * Math.min(m, 1.5)) });
  drawButton(ctx, lay.util.pause, 'Pause', { dark: true, size: Math.round(28 * Math.min(m, 1.5)) });
}

function renderWatch(ctx, G, S) {
  const s = S.s, w = G.watch;
  const sc = [1, 1.2, 1.4, 1.6, 1.8][G.settings.textIdx];
  const x = 14, wd = W - 28, top = Math.round(895 - (sc - 1) * 100), bot = 1184;
  panel(ctx, x, top, wd, bot - top, { r: 24, fill: 'rgba(40,20,8,0.92)', stroke: 'rgba(255,246,228,0.4)' });
  const phase = s.phase === 'hold' ? w.phase : 'ACT';
  const col = phase === 'think' ? '#ffe9a0' : phase === 'reveal' ? '#7fe8d6' : '#ffb59a';
  const label = phase === 'think' ? `THINK  ${Math.max(0, Math.ceil(w.timer))}s` : phase === 'reveal' ? 'REVEAL' : 'ACT';
  const ly = top + 14 + 30 * sc;
  text(ctx, label, W / 2, ly, Math.round(30 * sc), col, 700);
  // the explanation scrolls (drag or wheel) when it is longer than the panel, and shows a scroll bar
  const fs = Math.round(23 * sc), lh = fs * 1.28, tt = ly + 14, tb = bot - 12, viewH = tb - tt;
  ctx.save(); ctx.font = `400 ${fs}px ${FONT}`;
  const lines = wrapLines(ctx, G.watchText || '', wd - 70);
  const total = lines.length * lh + 6, maxS = Math.max(0, total - viewH);
  if (G.watchKey !== G.watchText) { G.watchKey = G.watchText; G.watchScroll = 0; }
  G.watchScroll = Math.max(0, Math.min(G.watchScroll || 0, maxS)); G.watchMax = maxS; G.watchBox = { x, y: top, w: wd, h: bot - top };
  ctx.beginPath(); ctx.rect(x + 8, tt, wd - 16, viewH); ctx.clip();
  ctx.fillStyle = '#fff6e4'; ctx.textAlign = 'left';
  lines.forEach((l, k) => { const yy = tt + lh * (k + 0.85) - G.watchScroll; if (yy > tt - lh && yy < tb + lh) ctx.fillText(l, x + 26, yy); });
  ctx.restore();
  if (maxS > 0) {
    const th = Math.max(40, viewH * (viewH / total)), ty = tt + (G.watchScroll / maxS) * (viewH - th);
    roundPath(ctx, x + wd - 20, tt, 6, viewH, 3); ctx.fillStyle = 'rgba(255,246,228,0.16)'; ctx.fill();
    roundPath(ctx, x + wd - 20, ty, 6, th, 3); ctx.fillStyle = 'rgba(255,217,122,0.9)'; ctx.fill();
  }
  drawButton(ctx, W_RECTS.pause, w.paused ? 'Resume' : 'Pause', { dark: true, size: 26 });
  drawButton(ctx, W_RECTS.shorter, 'Faster', { dark: true, size: 24 });
  drawButton(ctx, W_RECTS.longer, 'Slower', { dark: true, size: 24 });
  drawButton(ctx, W_RECTS.quit, 'Quit', { dark: true, size: 26 });
  if (w.paused) text(ctx, 'PAUSED', W / 2, top - 22, 44, '#fff6e4', 700);
}

// ---- 2D fallback (no WebGL): flat figures on the same beat ------------------------------------------------------------------------
export function renderFallback(ctx, G, view) {
  const S = G.sim; if (!S) return;
  const s = S;
  ctx.save();
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#8fd0f0'); g.addColorStop(0.45, '#ffe6b0'); g.addColorStop(0.46, '#c98f58'); g.addColorStop(1, '#a8723f');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const tD = G.dispT ?? s.t;
  const jump = (apex, A, h) => { const d = tD - apex; return Math.abs(d) < A / 2 ? h * (1 - (d / (A / 2)) ** 2) : 0; };
  let dy = 0;
  if (s.round) { dy = jump(s.round.tb, AIR, JUMP_H); if (s.prev) dy = Math.max(dy, jump(s.prev.tb, AIR, JUMP_H)); if (s.round.r0 > 0) dy = Math.max(dy, jump(s.round.r0, 0.12, 0.02)); }
  const px = dy * 1300;
  for (const [i, x, col] of [[0, 190, '#f2a900'], [1, 530, '#1f9d8f']]) {
    const y = 700 - px;
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(x, 720, 70 - px * 0.15, 14, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#6b3a1e'; ctx.beginPath(); ctx.arc(x, y - 250, 34, 0, TAU); ctx.fill();
    roundPath(ctx, x - 48, y - 210, 96, 120, 26); ctx.fillStyle = col; ctx.fill();
    ctx.fillStyle = '#6b3a1e'; roundPath(ctx, x - 40, y - 92, 28, 92, 12); ctx.fill(); roundPath(ctx, x + 12, y - 92, 28, 92, 12); ctx.fill();
    const r = s.round;
    if (r && r.resolved && tD - r.tb < 0.7 && r.result.feet[i] !== null) {
      const f = r.result.feet[i], dir = i === 0 ? 1 : -1;
      ctx.fillStyle = '#fff3d6'; ctx.beginPath(); ctx.ellipse(x + dir * 70, y - 4 + (f === 0 ? -14 : 14), 30, 14, 0, 0, TAU); ctx.fill();
      text(ctx, f === 0 ? 'L' : 'R', x + dir * 70, y - 60, 30, '#fff6e4');
    }
  }
  ctx.restore();
}
