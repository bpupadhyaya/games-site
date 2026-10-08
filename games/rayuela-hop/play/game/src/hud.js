// The in-play HUD: player pills, Pause / Think, a status line, the TOSS button with its sweep gauge, the PICK UP + LEFT FOOT | TWO FEET | RIGHT FOOT
// controls, the timing ring, big pop-ups (count-in, grade, toss result, foul), the Watch & Learn panel and the 2D fallback.
// Everything follows the text-size setting through a gentler multiplier (PLAY_M).
import { scr, hudFor, inRect } from './layout.js';
import { FONT, DISPLAY, roundPath, drawButton, paintButton, wrapLines, panel } from './ui.js';
import { RING_DUR, TIMING, TEJO_R, AIM_RANGE, COUNT_BEATS } from './consts.js';
import { getCourse } from './courses.js';
import { reticle, FOUL_TEXT } from './sim.js';
import { hopperAt, tejoAt, ringTarget } from './motion.js';

const TAU = Math.PI * 2;
const COL = ['#ff9a6c', '#5ee0d0'];
export const watchHit = (idx, x, y) => { const R = hudFor(idx, true).wbtn, k = ['pause', 'shorter', 'longer', 'quit']; for (let i = 0; i < 4; i++) if (inRect(R[k[i]], x, y)) return i; return -1; };

function text(ctx, t, x, y, px, col = '#fff6e4', weight = 700, align = 'center', shadow = true) {
  ctx.save(); ctx.font = `${weight} ${px}px ${FONT}`; ctx.textAlign = align; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = col;
  if (shadow) { ctx.shadowColor = 'rgba(8,16,30,0.75)'; ctx.shadowBlur = 5; ctx.shadowOffsetY = 1; }
  ctx.fillText(t, x, y); ctx.restore();
}
function fitText(ctx, t, x, y, maxW, px, col, weight = 700, align = 'center') {
  ctx.save(); ctx.font = `${weight} ${px}px ${FONT}`;
  while (ctx.measureText(t).width > maxW && px > 11) { px -= 1; ctx.font = `${weight} ${px}px ${FONT}`; }
  ctx.restore();
  text(ctx, t, x, y, px, col, weight, align);
}

// ---- foot icons ---------------------------------------------------------------------------------------------------------------------------
export function footIcon(ctx, cx, cy, s, side, col = '#fffaf0', alpha = 1) {
  ctx.save(); ctx.translate(cx, cy); ctx.globalAlpha = alpha; ctx.fillStyle = col;
  const m = side === 'L' ? 1 : -1;
  ctx.beginPath(); ctx.ellipse(m * 0.02 * s, -0.22 * s, 0.34 * s, 0.46 * s, m * 0.08, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.ellipse(-m * 0.01 * s, 0.4 * s, 0.24 * s, 0.3 * s, 0, 0, TAU); ctx.fill();
  ctx.fillRect(-0.2 * s, 0.0, 0.4 * s, 0.34 * s);
  for (let i = 0; i < 5; i++) { const px = m * (-0.2 + i * 0.1) * s, py = (-0.74 - (i === 0 ? 0.02 : 0.0) + Math.abs(i - 0.5) * 0.04) * s; ctx.beginPath(); ctx.arc(px, py, (i === 0 ? 0.095 : 0.07) * s, 0, TAU); ctx.fill(); }
  ctx.restore();
}
function handIcon(ctx, cx, cy, s, col = '#fffaf0') {
  ctx.save(); ctx.translate(cx, cy); ctx.fillStyle = col;
  roundPath(ctx, -0.36 * s, -0.08 * s, 0.72 * s, 0.52 * s, 0.18 * s); ctx.fill();
  for (let i = 0; i < 4; i++) { roundPath(ctx, (-0.36 + i * 0.19) * s, -0.5 * s, 0.14 * s, 0.5 * s, 0.07 * s); ctx.fill(); }
  roundPath(ctx, -0.54 * s, -0.04 * s, 0.14 * s, 0.4 * s, 0.07 * s); ctx.fill();
  ctx.restore();
}

function pill(ctx, r, label, prog, N, score, col, active, m, who) {
  const { x, y, w, h } = r;
  roundPath(ctx, x, y, w, h, 20); ctx.fillStyle = active ? 'rgba(10,24,40,0.9)' : 'rgba(10,24,40,0.66)'; ctx.fill();
  ctx.lineWidth = active ? 4 : 2; ctx.strokeStyle = active ? col : 'rgba(255,246,228,0.35)'; ctx.stroke();
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  const pad = 14;
  fitText(ctx, label, x + pad, y + h * 0.36, w * 0.6, Math.round(21 * m), col, 700, 'left');
  fitText(ctx, `${score} pts`, x + pad, y + h * 0.82, w * 0.5, Math.round(18 * m), 'rgba(255,246,228,0.85)', 400, 'left');
  text(ctx, String(prog), x + w - pad - (N ? Math.round(28 * m) * 1.9 : 0), y + h * 0.72, Math.round(44 * m), '#fff6e4', 700, 'right');
  if (N) text(ctx, `/${N}`, x + w - pad, y + h * 0.72, Math.round(24 * m), 'rgba(255,246,228,0.75)', 400, 'right');
  ctx.restore();
  void who;
}

function toleranceOf(C, T) {
  const cell = C.cells[T.cell] || C.cells[0];
  return { x: Math.max(0.05, (cell.w / 2 - TEJO_R) / AIM_RANGE.x), z: Math.max(0.05, (cell.d / 2 - TEJO_R) / AIM_RANGE.z) };
}

function sweepGauge(ctx, r, s, C, m) {
  const T = s.turn, rt = reticle(s), tol = toleranceOf(C, T);
  const z = s.phase === 'aimZ', tolv = z ? tol.z : tol.x, v = (z ? rt.z / AIM_RANGE.z : rt.x / AIM_RANGE.x);
  const gx = r.x + r.w * 0.1, gw = r.w * 0.8, gy = r.y + r.h * 0.72, gh = Math.max(12, 18 * m);
  roundPath(ctx, gx, gy, gw, gh, gh / 2); ctx.fillStyle = 'rgba(255,255,255,0.28)'; ctx.fill();
  const zx = gx + gw * (0.5 - tolv / 2), zw = gw * tolv;
  roundPath(ctx, zx, gy, zw, gh, gh / 2); ctx.fillStyle = 'rgba(127,232,214,0.95)'; ctx.fill();
  const px = gx + gw * (0.5 + v / 2);
  ctx.beginPath(); ctx.arc(px, gy + gh / 2, gh * 0.95, 0, TAU); ctx.fillStyle = '#fffaf0'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = '#8f2f14'; ctx.stroke();
}

function controls(ctx, G, S, lay, tD) {
  const s = S.s, m = lay.m, T = s.turn, C = S.C;
  const human = s.players[s.cur].human && G.mode !== 'watch';
  const aimNow = (s.phase === 'aimX' || s.phase === 'aimLock' || s.phase === 'aimZ');
  const runNow = s.phase === 'count' || s.phase === 'hop' || s.phase === 'foul' || s.phase === 'clean';
  const flash = G.pressFlash && tD - G.pressFlash.t < 0.16 ? G.pressFlash.act : '';
  const dis = !human;
  if (aimNow || (!runNow && s.phase !== 'hop')) {
    const r = lay.toss, big = Math.round(46 * Math.min(m, 1.4));
    const ok = human && (s.phase === 'aimX' || s.phase === 'aimZ');
    paintButton(ctx, r, { primary: ok, disabled: !ok && !aimNow ? false : false, dark: !ok });
    ctx.save(); ctx.globalAlpha = human ? 1 : 0.7;
    const lab = !human ? 'Waiting...' : s.phase === 'aimZ' ? 'TAP TO THROW' : s.phase === 'aimX' || s.phase === 'aimLock' ? 'TAP TO LOCK THE AIM' : 'GET READY';
    fitText(ctx, lab, r.x + r.w / 2, r.y + r.h * (aimNow ? 0.4 : 0.55), r.w - 40, big, '#fffaf0');
    if (aimNow && T && T.cell >= 0) {
      fitText(ctx, s.phase === 'aimZ' ? 'distance: tap when the dot is in the green' : 'sideways: tap when the dot is in the green', r.x + r.w / 2, r.y + r.h * 0.6, r.w - 40, Math.round(22 * Math.min(m, 1.3)), 'rgba(255,250,240,0.9)', 400);
      sweepGauge(ctx, r, s, C, Math.min(m, 1.4));
    }
    ctx.restore();
    return;
  }
  const dim = human ? 1 : 0.55;
  const st = ringTarget(s, tD);
  const btn = (rect, id, label, sub) => {
    ctx.save(); ctx.globalAlpha = dim;
    paintButton(ctx, rect, { active: flash === id, dark: flash !== id });
    const sc = Math.min(m, 1.4);
    const ico = Math.min(rect.h * 0.36, 52 * sc);
    if (id === 'L' || id === 'R') footIcon(ctx, rect.x + rect.w / 2, rect.y + rect.h * 0.34, ico, id);
    else if (id === 'B') { footIcon(ctx, rect.x + rect.w / 2 - ico * 0.62, rect.y + rect.h * 0.34, ico * 0.9, 'L'); footIcon(ctx, rect.x + rect.w / 2 + ico * 0.62, rect.y + rect.h * 0.34, ico * 0.9, 'R'); }
    if (lay.land && id !== 'B') { /* tall side buttons: text below the icon */ }
    fitText(ctx, label, rect.x + rect.w / 2, rect.y + rect.h * 0.82, rect.w - 16, Math.round(26 * sc), '#fffaf0');
    ctx.restore();
    void sub;
  };
  btn(lay.left, 'L', 'LEFT FOOT'); btn(lay.both, 'B', 'TWO FEET'); btn(lay.right, 'R', 'RIGHT FOOT');
  const p = lay.pick;
  ctx.save(); ctx.globalAlpha = dim;
  paintButton(ctx, p, { active: flash === 'P', dark: flash !== 'P' });
  const ps = Math.min(p.h * 0.5, 40);
  handIcon(ctx, p.x + p.w / 2 - Math.min(p.w * 0.3, 190), p.y + p.h * 0.62, ps);
  fitText(ctx, 'PICK UP', p.x + p.w / 2 + 20, p.y + p.h * 0.64, p.w - 140, Math.round(30 * Math.min(m, 1.4)), '#fffaf0');
  ctx.restore();
  if (!human) fitText(ctx, G.mode === 'watch' ? '' : `${s.players[s.cur].name}'s turn`, lay.both.x + lay.both.w / 2, lay.pick.y - 10, lay.both.w + 200, Math.round(26 * Math.min(m, 1.3)), '#ffe9a0');
  void st;
}

function ring(ctx, G, S, lay, tD) {
  const s = S.s, st = ringTarget(s, tD); if (!st) return;
  const R = lay.ring; if (!R) return;
  const tm = TIMING[s.cfg.timing], p = (st.t - tD) / RING_DUR;
  ctx.save();
  ctx.fillStyle = 'rgba(10,24,40,0.42)'; ctx.beginPath(); ctx.arc(R.x, R.y, R.r0 + 4, 0, TAU); ctx.fill();
  ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(255,217,122,0.95)'; ctx.beginPath(); ctx.arc(R.x, R.y, R.rt, 0, TAU); ctx.stroke();
  if (p <= 1.0 && p > -tm.ok / RING_DUR) {
    const rad = R.rt + (R.r0 - R.rt) * Math.max(0, p), near = Math.abs(p * RING_DUR) <= tm.ok;
    ctx.lineWidth = near ? 9 : 6; ctx.strokeStyle = Math.abs(p * RING_DUR) <= tm.perfect ? '#7fe8d6' : near ? '#ffffff' : 'rgba(255,246,228,0.75)';
    ctx.beginPath(); ctx.arc(R.x, R.y, rad, 0, TAU); ctx.stroke();
  }
  ctx.restore();
}

// big messages in the middle of the scene
function popups(ctx, G, S, lay, tD) {
  const s = S.s, T = s.turn, m = lay.m, k = Math.min(m, 1.3), cx = lay.pop.cx, y = lay.pop.y;
  const big = (t, col, px, yy = y, a = 1) => { ctx.save(); ctx.globalAlpha = a; text(ctx, t, cx, yy, Math.round(px * k), col, 700); ctx.restore(); };
  if (!T) return;
  if (s.phase === 'intro') {
    const age = s.t - s.phaseT, a = Math.min(1, age / 0.2) * (age > 1.0 ? Math.max(0, 1 - (age - 1.0) / 0.25) : 1);
    const pl = s.players[s.cur];
    big(G.mode === 'watch' || s.players.length > 1 ? `${pl.name}` : 'Your turn', COL[s.cur % 2], 54, y, a);
    if (s.mode !== 'lesson') big(`Number ${T.n}`, '#fff6e4', 40, y + 56 * k, a); else big(`Try ${s.lesson.tries + 1} of ${s.lesson.attempts}`, '#fff6e4', 36, y + 52 * k, a);
    return;
  }
  if (s.phase === 'count') {
    const i = Math.floor((tD - T.tc) / T.beat);
    if (i >= 0 && i < COUNT_BEATS) { const f = ((tD - T.tc) / T.beat) % 1, sc = 1 + 0.35 * Math.max(0, 1 - f * 3); ctx.save(); ctx.translate(cx, y + 20); ctx.scale(sc, sc); text(ctx, String(i + 1), 0, 0, Math.round(110 * k), '#fff6e4', 700); ctx.restore(); }
    return;
  }
  if (s.phase === 'landed' || s.phase === 'tossEnd') {
    const ok = T.toss.ok, msg = ok ? (T.toss.bull ? 'RIGHT IN THE MIDDLE!' : 'IN THE SQUARE!') : T.toss.reason === 'line' ? 'ON THE LINE' : T.toss.reason === 'wrong' ? 'WRONG SQUARE' : 'OFF THE COURSE';
    big(msg, ok ? '#7fe8d6' : '#ff9a86', 52, y, Math.min(1, (s.t - s.phaseT) / 0.15));
    if (!ok) big('Turn over', '#fff6e4', 34, y + 48 * k);
    return;
  }
  if (s.phase === 'foul') {
    const f = T.route.find((r) => r.state === 'foul'), age = s.t - s.phaseT, a = Math.min(1, age / 0.12);
    const txt = f ? FOUL_TEXT[f.reason] || 'Foul' : 'Foul';
    big(txt.toUpperCase(), '#ff9a86', 50, y, a);
    if (f && f.reason === 'line') big(f.d < 0 ? 'too early' : 'too late', '#fff6e4', 32, y + 46 * k, a);
    big('Turn over', '#fff6e4', 32, y + (f && f.reason === 'line' ? 90 : 46) * k, a);
    return;
  }
  if (s.phase === 'clean') {
    const age = s.t - s.phaseT;
    big('CLEAN RUN!', '#7fe8d6', 62, y, Math.min(1, age / 0.15));
    if (s.mode !== 'lesson') big(`Number ${T.n} done`, '#fff6e4', 36, y + 52 * k);
    return;
  }
  if (G.fb && tD - G.fb.t < 0.65) {
    const age = tD - G.fb.t, a = 1 - age / 0.65;
    ctx.save(); ctx.globalAlpha = Math.max(0, Math.min(1, a * 1.6));
    text(ctx, G.fb.text, cx, y - age * 20, Math.round(50 * k), G.fb.col, 700);
    if (G.fb.sub) text(ctx, G.fb.sub, cx, y + 36 * k - age * 20, Math.round(26 * k), 'rgba(255,246,228,0.9)', 400);
    ctx.restore();
  }
}

function statusLine(ctx, G, S, lay) {
  const s = S.s, T = s.turn, r = lay.status, m = lay.m;
  if (!T || !r) return;
  const pl = s.players[s.cur];
  let t = '';
  if (s.phase === 'intro') t = `${pl.name} · number ${T.n}`;
  else if (s.phase === 'hold') t = 'Thinking...';
  else if (s.phase === 'aimX' || s.phase === 'aimLock') t = `Toss to square ${T.n}: aim sideways`;
  else if (s.phase === 'aimZ') t = `Toss to square ${T.n}: aim the distance`;
  else if (s.phase === 'flight') t = 'Throw!';
  else if (s.phase === 'landed' || s.phase === 'tossEnd') t = `Toss to square ${T.n}`;
  else t = `${s.mode === 'lesson' ? 'Lesson' : `Number ${T.n}`} · ${T.bpm} BPM`;
  fitText(ctx, t, r.x + r.w / 2, r.y + r.h * 0.66, r.w, Math.round(24 * Math.min(m, 1.3)), '#ffe9a0');
}

export function renderHud(ctx, G, S, view) {
  const s = S.s, watch = G.mode === 'watch', lay = hudFor(G.settings.textIdx, watch), m = lay.m;
  const tD = G.dispT ?? s.t;
  const P = s.players, practice = s.mode === 'practice' || s.mode === 'lesson';
  // ---- player pills
  const lab = (i) => P[i].name.toUpperCase();
  pill(ctx, lay.pillL, practice ? (s.mode === 'lesson' ? 'LESSON' : 'PRACTICE') : lab(0), practice ? (s.mode === 'lesson' ? s.lesson.ok : P[0].done) : P[0].done, practice ? (s.mode === 'lesson' ? s.lesson.need : 0) : s.target, P[0].score, COL[0], s.cur === 0, m);
  if (P.length > 1 && !practice) pill(ctx, lay.pillR, lab(1), P[1].done, s.target, P[1].score, COL[1], s.cur === 1, m);
  else if (practice) { const r = lay.pillR; roundPath(ctx, r.x, r.y, r.w, r.h, 20); ctx.fillStyle = 'rgba(10,24,40,0.66)'; ctx.fill(); fitText(ctx, s.mode === 'lesson' ? `Try ${Math.min(s.lesson.tries + 1, s.lesson.attempts)} / ${s.lesson.attempts}` : `Clean runs ${P[0].stats.clean}`, r.x + r.w / 2, r.y + r.h * 0.62, r.w - 24, Math.round(26 * m), '#ffe9a0'); }
  statusLine(ctx, G, S, lay);
  popups(ctx, G, S, lay, tD);
  if (watch) { renderWatch(ctx, G, S, lay); return; }
  ring(ctx, G, S, lay, tD);
  controls(ctx, G, S, lay, tD);
  const sz = Math.round(26 * Math.min(m, 1.4));
  drawButton(ctx, lay.util.pause, 'Pause', { dark: true, size: sz });
  const human = P[s.cur].human;
  drawButton(ctx, lay.util.think, 'Think', { dark: true, size: sz, disabled: !human || s.phase === 'intro' });
}

function renderWatch(ctx, G, S, L) {
  const s = S.s, w = G.watch;
  const sc = Math.min([1, 1.2, 1.4, 1.6, 1.8][G.settings.textIdx], L.land ? 1.5 : 1.8);
  const { x, y: top, w: wd, h: ph } = L.panel, bot = top + ph, cx = x + wd / 2;
  panel(ctx, x, top, wd, ph, { r: 24, fill: 'rgba(10,24,40,0.92)', stroke: 'rgba(255,246,228,0.4)' });
  const phase = s.phase === 'hold' ? w.phase : 'ACT';
  const col = phase === 'think' ? '#ffe9a0' : phase === 'reveal' ? '#7fe8d6' : '#ffb59a';
  const label = phase === 'think' ? `THINK  ${Math.max(0, Math.ceil(w.timer))}s` : phase === 'reveal' ? 'REVEAL' : 'ACT';
  const ly = top + 14 + 30 * sc;
  text(ctx, label, cx, ly, Math.round(30 * sc), col, 700);
  const fs = Math.round(23 * sc), lh = fs * 1.28, tt = ly + 14, tb = bot - 12, viewH = tb - tt;
  ctx.save(); ctx.font = `400 ${fs}px ${FONT}`;
  const lines = wrapLines(ctx, G.watchText || '', wd - 70);
  const total = lines.length * lh + 6, maxS = Math.max(0, total - viewH);
  if (G.watchKey !== G.watchText) { G.watchKey = G.watchText; G.watchScroll = 0; }
  G.watchScroll = Math.max(0, Math.min(G.watchScroll || 0, maxS)); G.watchMax = maxS; G.watchBox = { x, y: top, w: wd, h: ph };
  ctx.beginPath(); ctx.rect(x + 8, tt, wd - 16, viewH); ctx.clip();
  ctx.fillStyle = '#fff6e4'; ctx.textAlign = 'left';
  lines.forEach((l, k) => { const yy = tt + lh * (k + 0.85) - G.watchScroll; if (yy > tt - lh && yy < tb + lh) ctx.fillText(l, x + 26, yy); });
  ctx.restore();
  if (maxS > 0) {
    const th = Math.max(40, viewH * (viewH / total)), ty = tt + (G.watchScroll / maxS) * (viewH - th);
    roundPath(ctx, x + wd - 20, tt, 6, viewH, 3); ctx.fillStyle = 'rgba(255,246,228,0.16)'; ctx.fill();
    roundPath(ctx, x + wd - 20, ty, 6, th, 3); ctx.fillStyle = 'rgba(255,217,122,0.9)'; ctx.fill();
  }
  const B = L.wbtn;
  drawButton(ctx, B.pause, w.paused ? 'Resume' : 'Pause', { dark: true, size: 26 });
  drawButton(ctx, B.shorter, 'Faster', { dark: true, size: 24 });
  drawButton(ctx, B.longer, 'Slower', { dark: true, size: 24 });
  drawButton(ctx, B.quit, 'Quit', { dark: true, size: 26 });
  if (w.paused) text(ctx, 'PAUSED', L.land ? (L.band.x + L.band.w / 2) : L.vw / 2, L.pausedY, L.land ? 40 : 44, '#fff6e4', 700);
}

// ---- 2D fallback (no WebGL): a top-down chalk course on the same beat ---------------------------------------------------------------
export function renderFallback(ctx, G, view) {
  const S = G.simObj; if (!S) return;
  const s = S.s, C = S.C, { vw: W, vh: H } = scr, L = hudFor(G.settings.textIdx, G.mode === 'watch'), B = L.band;
  ctx.save();
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#9ad4f2'); g.addColorStop(0.4, '#ffe6b8'); g.addColorStop(1, '#cdb48e');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const b = C.bounds, long = (b.z1 - b.z0) > (b.x1 - b.x0);
  void long;
  const bw = b.x1 - b.x0 + 0.5, bh = b.z1 - b.z0 + 0.5, sc = Math.min(B.w / bw, B.h / bh) * 0.96;
  const cx = B.x + B.w / 2, cy = B.y + B.h / 2, mx = (b.x0 + b.x1) / 2, mz = (b.z0 + b.z1) / 2;
  const X = (x) => cx - (x - mx) * sc, Y = (z) => cy - (z - mz) * sc;
  roundPath(ctx, X(b.x1) - 0.25 * sc, Y(b.z1) - 0.25 * sc, bw * sc, bh * sc, 18); ctx.fillStyle = '#8c8a86'; ctx.fill();
  ctx.lineWidth = Math.max(2, 0.03 * sc); ctx.strokeStyle = '#fff8ec';
  for (const c of C.cells) {
    ctx.save(); ctx.translate(X(c.x), Y(c.z)); ctx.rotate(-c.yaw);
    if (c.color && C.id === 'rainbow') { ctx.globalAlpha = 0.45; ctx.fillStyle = c.color; ctx.fillRect(-c.w * sc / 2, -c.d * sc / 2, c.w * sc, c.d * sc); ctx.globalAlpha = 1; }
    ctx.strokeRect(-c.w * sc / 2, -c.d * sc / 2, c.w * sc, c.d * sc);
    ctx.fillStyle = 'rgba(255,248,236,0.9)'; ctx.font = `700 ${Math.round(0.22 * sc)}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(c.num ? String(c.num) : 'CIELO', 0, 0);
    ctx.restore();
  }
  const tD = G.dispT ?? s.t, Hp = hopperAt(s, C, tD), tj = tejoAt(s, C, tD);
  if (tj.vis && !tj.hand) { ctx.beginPath(); ctx.arc(X(tj.x), Y(tj.z) - tj.y * sc * 0.3, Math.max(5, 0.06 * sc), 0, TAU); ctx.fillStyle = COL[s.cur % 2]; ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke(); }
  const st = ringTarget(s, tD);
  if (st) { const p = Math.max(0, (st.t - tD) / RING_DUR); ctx.beginPath(); ctx.arc(X(st.pos.x), Y(st.pos.z), (0.17 + 0.6 * p) * sc, 0, TAU); ctx.lineWidth = 4; ctx.strokeStyle = '#ffc94d'; ctx.stroke(); }
  if (s.phase === 'aimX' || s.phase === 'aimLock' || s.phase === 'aimZ') {
    const T = s.turn, cell = C.cells[T.cell], rt = reticle(s);
    const lx = rt.x, lz = s.phase === 'aimZ' ? rt.z : 0;
    const wx = cell.x + Math.cos(cell.yaw) * lx + Math.sin(cell.yaw) * lz, wz = cell.z - Math.sin(cell.yaw) * lx + Math.cos(cell.yaw) * lz;
    ctx.strokeStyle = '#7fe8d6'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(X(wx), Y(wz), 0.1 * sc, 0, TAU); ctx.stroke();
  }
  // the hopper as a simple figure
  const hx = X(Hp.x), hy = Y(Hp.z) - Hp.y * sc;
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(X(Hp.x), Y(Hp.z), 0.16 * sc, 0.1 * sc, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = COL[s.cur % 2]; ctx.beginPath(); ctx.arc(hx, hy - 0.2 * sc, 0.13 * sc, 0, TAU); ctx.fill();
  ctx.fillStyle = '#6b3a1e'; ctx.beginPath(); ctx.arc(hx, hy - 0.42 * sc, 0.08 * sc, 0, TAU); ctx.fill();
  ctx.restore();
  void DISPLAY;
}
