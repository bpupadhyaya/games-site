// In-play HUD: scoreboard, controlled-player marker, strike bar, prompts, banners, the four round buttons and the floating stick,
// Think and Watch & Learn panels, and the flat 2D pitch used when WebGL is missing. Everything follows the text size (PLAY_M).
import { W, H, PLAY_M, hudLayout, inRect } from './layout.js';
import { FONT, C, roundPath, drawButton, panel, wrapLines, fitPx } from './ui.js';
import { HW, HL, GOAL_HW, BAR, ROLES, CHARGE_SEC, SWEET, LEVELS } from './consts.js';
import { projectV } from './camera.js';
import { LESSONS } from './content.js';

const TAU = Math.PI * 2;
export const TEAM_COL = ['#2f78e0', '#e8a82a'];
export const TEAM_NAME = ['Blues', 'Ambers'];
export const fmtScore = (sc) => `${sc.g}-${String(sc.p).padStart(2, '0')}`;
export const totalPts = (sc) => sc.g * 3 + sc.p;
export const fmtClock = (sec) => { const s = Math.max(0, Math.ceil(sec)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

const proj = (G, view, x, y, z) => projectV(G.sim.cam, view.cssW || 720, view.cssH || 1280, x, y, z);

function scoreboard(ctx, G, s, m0) {
  const th = hudLayout(G.settings.textIdx).topH;
  const m = m0, big = m0 > 1.3;
  const g = ctx.createLinearGradient(0, 0, 0, th + 24); g.addColorStop(0, 'rgba(4,16,10,0.9)'); g.addColorStop(1, 'rgba(4,16,10,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, th + 24);
  const colw = big ? 320 : 250;
  for (const i of [0, 1]) {
    const left = i === 0, x0 = left ? 16 : W - 16 - colw;
    ctx.fillStyle = TEAM_COL[i]; roundPath(ctx, x0, 14, 10, th - 40, 5); ctx.fill();
    ctx.textAlign = left ? 'left' : 'right'; ctx.textBaseline = 'alphabetic';
    const ax = left ? x0 + 22 : x0 + colw - 22;
    ctx.fillStyle = '#fff6e4'; ctx.font = `700 ${Math.round(22 * m)}px ${FONT}`;
    const nm = i === 0 ? (s.cfg.watch ? TEAM_NAME[0] : 'You') : TEAM_NAME[1];
    ctx.fillText(nm, ax, 14 + 24 * m);
    ctx.font = `800 ${Math.round(50 * m)}px ${FONT}`; ctx.fillText(fmtScore(s.score[i]), ax, 14 + 24 * m + 50 * m);
    ctx.font = `600 ${Math.round(18 * m)}px ${FONT}`; ctx.fillStyle = 'rgba(255,246,228,0.8)'; ctx.fillText(`${totalPts(s.score[i])} pts`, ax, 14 + 24 * m + 50 * m + 20 * m);
  }
  const cm = big ? m * 0.8 : m, cy = big ? 14 + 24 * m + 50 * m + 20 * m + 44 * cm : 14 + 24 * m + 40 * m;
  ctx.textAlign = 'center'; ctx.fillStyle = '#fff6e4'; ctx.font = `800 ${Math.round(46 * cm)}px ${FONT}`;
  const left = s.cfg.drill ? 0 : Math.max(0, s.cfg.halfSec - s.clock);
  ctx.fillText(s.cfg.drill ? '' : fmtClock(left), big ? W / 2 - 110 * cm * 0.6 : W / 2, cy);
  ctx.fillStyle = '#ffd97a'; ctx.font = `700 ${Math.round(19 * cm)}px ${FONT}`;
  const lbl = s.cfg.drill ? 'Practice' : s.cfg.halves === 1 ? 'Quick match' : s.half === 1 ? 'First half' : 'Second half';
  if (big) { ctx.textAlign = 'left'; ctx.fillText(lbl, W / 2 + 10, cy - 4 * cm); } else ctx.fillText(lbl, W / 2, cy + 24 * m);
}

// a thin ring around the ball so it never gets lost against the grass; the ring tightens with height
function ballRing(ctx, G, s, view) {
  const sn = G.snap, a = G.alpha ?? 1;
  const bx = sn && sn.cur ? sn.prev.b[0] + (sn.cur.b[0] - sn.prev.b[0]) * a : s.ball.x, by = sn && sn.cur ? sn.prev.b[1] + (sn.cur.b[1] - sn.prev.b[1]) * a : s.ball.y, bz = sn && sn.cur ? sn.prev.b[2] + (sn.cur.b[2] - sn.prev.b[2]) * a : s.ball.z;
  const c = proj(G, view, bx, by, bz), e = proj(G, view, bx + 0.42, by, bz);
  if (!c || !e) return;
  const r = Math.max(11, Math.abs(e.x - c.x));
  const g = proj(G, view, bx, 0.02, bz);
  ctx.save();
  if (g && by > 0.5) { ctx.strokeStyle = 'rgba(255,246,228,0.35)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(c.x, c.y + r); ctx.lineTo(g.x, g.y); ctx.stroke(); }
  ctx.strokeStyle = 'rgba(255,246,228,0.9)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(c.x, c.y, r, 0, TAU); ctx.stroke();
  ctx.restore();
}

function wrappedBox(ctx, text, y, size, o = {}) {
  const pw = o.w ?? W - 40;
  ctx.font = `${o.weight ?? 700} ${size}px ${FONT}`;
  const lines = wrapLines(ctx, text, pw - 32);
  const ph = lines.length * size * 1.25 + 18;
  roundPath(ctx, (W - pw) / 2, y, pw, ph, 16); ctx.fillStyle = o.bg ?? 'rgba(4,16,10,0.72)'; ctx.fill();
  ctx.fillStyle = o.color ?? '#fff6e4'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  lines.forEach((l, i) => ctx.fillText(l, W / 2, y + 10 + size * (0.95 + i * 1.25)));
  return ph;
}

// coach line: what the controls do right now
export function promptFor(G, s) {
  const p = s.players[s.cfg.human];
  if (G.mode === 'watch') return 'Watch & Learn: the computer plays both teams';
  if (G.mode === 'drill' && G.learn.tally) { const l = LESSONS[G.learn.cur]; return `${l.title.replace(/^\d+\. /, '')}: ${G.learn.tally.ok} good of ${G.learn.tally.n} tried (${l.n} in all)`; }
  if (!p) return '';
  const B = s.ball, has = B.holder === p.id;
  if (s.phase === 'ready') return 'Get set: the ball is thrown in';
  if (s.phase === 'restart' && s.restart) {
    if (s.restart.taker === p.id) return s.restart.kind === 'puckout' ? 'Your puck-out: hold STRIKE, release in a zone. Stick aims.' : 'Your free: RISE the ball, then STRIKE or PASS.';
    return s.restart.kind === 'puckout' ? 'Puck-out: get into space' : 'Free: get ready';
  }
  if (p.role === 0) return has ? 'You have the ball: hold STRIKE and release to puck it out' : 'Keeper: move with the stick, press SAVE as the ball comes';
  if (has) return B.hs === 'hand' ? 'In hand: STRIKE (quick = goal try, long = point) or PASS' : 'Solo run: STRIKE, PASS, or BURST to dodge';
  if (B.holder < 0 && B.mode === 'free' && Math.hypot(B.x - p.x, B.z - p.z) < 3.4 && B.y < 0.6) return 'Loose ball: press RISE to pick it up';
  if (B.holder >= 0 && s.players[B.holder].team !== p.team) return Math.hypot(s.players[B.holder].x - p.x, s.players[B.holder].z - p.z) < 2.6 ? 'Press HOOK when their ball bounces up' : 'Close the carrier down';
  return '';
}

// the controlled player's marker, the aim line and the strike bar above the head
function playerMarkers(ctx, G, s, view, m) {
  const p = s.players[s.cfg.human];
  if (!p) return;
  const pts = [];
  for (let i = 0; i < 20; i++) { const a = (i / 20) * TAU; const q = proj(G, view, p.x + Math.cos(a) * 0.85, 0.02, p.z + Math.sin(a) * 0.85); if (q) pts.push(q); }
  ctx.save();
  if (pts.length === 20) {
    ctx.beginPath(); pts.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y))); ctx.closePath();
    ctx.lineWidth = 4; ctx.strokeStyle = '#fff6e4'; ctx.fillStyle = 'rgba(255,246,228,0.18)'; ctx.fill(); ctx.stroke();
  }
  const top = proj(G, view, p.x, 2.55, p.z);
  if (top) {
    ctx.fillStyle = '#fff6e4'; ctx.strokeStyle = 'rgba(4,16,10,0.8)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(top.x, top.y); ctx.lineTo(top.x - 11, top.y - 17); ctx.lineTo(top.x + 11, top.y - 17); ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  // aim line while the stick is pushed or the bar is charging
  const aim = s.aimHint;
  if (aim && (aim.moving || s.charge)) {
    const a0 = proj(G, view, p.x, 0.05, p.z), a1 = proj(G, view, p.x + aim.x * 3.2, 0.05, p.z + aim.z * 3.2);
    if (a0 && a1) { ctx.setLineDash([10, 8]); ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(255,233,160,0.9)'; ctx.beginPath(); ctx.moveTo(a0.x, a0.y); ctx.lineTo(a1.x, a1.y); ctx.stroke(); ctx.setLineDash([]); }
  }
  if (s.charge && top) {
    const f = Math.min(1, (s.t - s.charge.t0) / CHARGE_SEC);
    const bw = 190 * Math.min(1.2, 0.8 + m * 0.25), bh = 20, bx = top.x - bw / 2, by = top.y - 62;
    roundPath(ctx, bx, by, bw, bh, 10); ctx.fillStyle = 'rgba(4,16,10,0.85)'; ctx.fill();
    for (const [k, col, lbl] of [['drive', '#ff9a6a', 'GOAL'], ['loft', '#7fe8d6', 'POINT']]) {
      const cx = bx + bw * SWEET[k], zw = bw * 0.2;
      roundPath(ctx, cx - zw / 2, by, zw, bh, 8); ctx.fillStyle = col; ctx.globalAlpha = 0.55; ctx.fill(); ctx.globalAlpha = 1;
      ctx.fillStyle = '#fff6e4'; ctx.font = `800 14px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText(lbl, cx, by - 5);
    }
    roundPath(ctx, bx, by, Math.max(10, bw * f), bh, 10); ctx.fillStyle = '#fff6e4'; ctx.fill();
    ctx.strokeStyle = 'rgba(255,246,228,0.9)'; ctx.lineWidth = 2; roundPath(ctx, bx, by, bw, bh, 10); ctx.stroke();
  }
  ctx.restore();
}

function circleButton(ctx, c, label, o = {}) {
  const { held = false, glow = false, disabled = false, primary = false, sub = '' } = o;
  ctx.save();
  const r = c.r * (held ? 0.94 : 1);
  ctx.beginPath(); ctx.arc(c.x, c.y + (held ? 2 : 5), r, 0, TAU); ctx.fillStyle = 'rgba(4,16,10,0.4)'; ctx.fill();
  ctx.beginPath(); ctx.arc(c.x, c.y, r, 0, TAU);
  ctx.fillStyle = disabled ? 'rgba(60,80,70,0.55)' : primary ? '#1e9a5f' : 'rgba(16,44,30,0.88)'; ctx.fill();
  if (held && !disabled) { ctx.fillStyle = 'rgba(255,246,228,0.22)'; ctx.fill(); }
  ctx.lineWidth = glow ? 5 : 2.5; ctx.strokeStyle = glow ? '#ffd97a' : 'rgba(255,246,228,0.5)'; ctx.stroke();
  ctx.fillStyle = disabled ? 'rgba(235,238,255,0.5)' : '#fffaf0'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const px = fitPx(ctx, label, 800, Math.round(c.r * 0.36), c.r * 1.55, 12);
  ctx.font = `800 ${px}px ${FONT}`; ctx.fillText(label, c.x, c.y - (sub ? px * 0.35 : 0));
  if (sub) { const sp = Math.max(11, Math.round(px * 0.55)); ctx.font = `600 ${sp}px ${FONT}`; ctx.globalAlpha = 0.85; ctx.fillText(sub, c.x, c.y + px * 0.62); ctx.globalAlpha = 1; }
  ctx.restore();
}

export function buttonLabels(s, p) {
  const gk = p && p.role === 0;
  const has = p && s.ball.holder === p.id;
  return { strike: gk ? 'CLEAR' : 'STRIKE', pass: 'PASS', rise: has ? 'BURST' : 'RISE', hook: gk ? 'SAVE' : 'HOOK' };
}

function controls(ctx, G, s, lay, ui) {
  const p = s.players[s.cfg.human];
  const L = buttonLabels(s, p);
  const B = s.ball;
  const has = p && B.holder === p.id;
  const loose = p && B.holder < 0 && B.mode === 'free' && Math.hypot(B.x - p.x, B.z - p.z) < 3.4 && B.y < 0.6;
  const carr = B.holder >= 0 ? s.players[B.holder] : null;
  const hookGlow = p && carr && carr.team !== p.team && Math.hypot(carr.x - p.x, carr.z - p.z) < 2.2 && B.hs === 'bal';
  const held = ui.held || {};
  // floating stick
  const st = ui.stick;
  const bx = st ? st.ox : lay.stick.x, by = st ? st.oy : lay.stick.y, R = lay.stick.r;
  ctx.save();
  ctx.beginPath(); ctx.arc(bx, by, R, 0, TAU); ctx.fillStyle = st ? 'rgba(16,44,30,0.55)' : 'rgba(16,44,30,0.32)'; ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,246,228,0.45)'; ctx.stroke();
  let kx = bx, ky = by;
  if (st) { const dx = st.x - st.ox, dy = st.y - st.oy, d = Math.hypot(dx, dy) || 1, k = Math.min(1, R / d); kx = bx + dx * k; ky = by + dy * k; }
  ctx.beginPath(); ctx.arc(kx, ky, R * 0.42, 0, TAU); ctx.fillStyle = st ? 'rgba(255,246,228,0.85)' : 'rgba(255,246,228,0.5)'; ctx.fill();
  if (!st) { ctx.fillStyle = 'rgba(255,246,228,0.8)'; ctx.font = `700 ${Math.round(18 * Math.min(lay.m, 1.5))}px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText('MOVE', bx, by + R + 24 * Math.min(lay.m, 1.5)); }
  ctx.restore();
  circleButton(ctx, lay.strike, L.strike, { primary: true, held: held.strike, glow: has || (loose && !has) });
  circleButton(ctx, lay.pass, L.pass, { held: held.pass, glow: has, disabled: !has || (p && p.role === 0 && false) });
  circleButton(ctx, lay.rise, L.rise, { held: held.rise, glow: loose });
  circleButton(ctx, lay.hook, L.hook, { held: held.hook, glow: hookGlow });
  // stamina bar above the stick
  if (p) {
    const sw = 170, sx0 = 20, sy0 = lay.stick.zone.y + 2 + 0;
    void sw; void sx0; void sy0;
  }
}

export function renderHud(ctx, G, view, ui) {
  const s = G.sim;
  const lay = hudLayout(G.settings.textIdx), m = lay.m;
  scoreboard(ctx, G, s, m);
  const watch = G.mode === 'watch';
  if (!watch && s.cfg.human >= 0) playerMarkers(ctx, G, s, view, m);
  ballRing(ctx, G, s, view);
  // utility buttons
  const sz = Math.round(24 * Math.min(m, 1.6));
  if (!watch) { drawButton(ctx, lay.util.pause, 'Pause', { dark: true, size: sz }); drawButton(ctx, lay.util.think, 'Think', { dark: true, size: sz }); }
  // prompt
  const pr = promptFor(G, s);
  let y = lay.util.pause.y + lay.util.pause.h + 12;
  if (pr) { const ps = Math.round(22 * Math.min(m, 1.6)); y += wrappedBox(ctx, pr, y, ps, { w: W - 40 }) + 8; }
  // banner for the last event
  const showLast = s.last && s.t - s.last.t < 2.6 && (s.phase === 'dead' || s.phase === 'restart' || s.phase === 'play');
  if (showLast) {
    const big = Math.round(54 * Math.min(m, 1.5));
    const a = Math.min(1, (2.6 - (s.t - s.last.t)) / 0.5);
    ctx.save(); ctx.globalAlpha = a;
    const txt = s.last.text;
    ctx.font = `900 ${big}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    const col = s.last.kind === 'goal' || s.last.kind === 'point' ? TEAM_COL[s.last.team] : '#fff6e4';
    const lines = wrapLines(ctx, txt, W - 90);
    const ph = lines.length * big * 1.15 + 24, py = y + 4;
    roundPath(ctx, 40, py, W - 80, ph, 20); ctx.fillStyle = 'rgba(4,16,10,0.8)'; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = col; ctx.stroke();
    ctx.fillStyle = '#fff6e4'; lines.forEach((l, i) => ctx.fillText(l, W / 2, py + 14 + big * (0.95 + i * 1.15)));
    ctx.restore();
  } else if (G.feedback && s.t - G.feedback.t < 1.2) {
    const f = G.feedback, big = Math.round(46 * Math.min(m, 1.5));
    ctx.font = `800 ${big}px ${FONT}`; ctx.textAlign = 'center'; ctx.fillStyle = f.col; ctx.shadowColor = 'rgba(0,0,0,0.75)'; ctx.shadowBlur = 8;
    ctx.fillText(f.text, W / 2, Math.max(y + big, 350)); ctx.shadowBlur = 0;
  }
  if (watch) renderWatchPanel(ctx, G, s, lay, m);
  else controls(ctx, G, s, lay, ui || {});
}

// ---- Watch & Learn ---------------------------------------------------------------------------------------------
export const W_RECTS = [];
export function watchHit(x, y) { return W_RECTS.findIndex((r) => inRect(r, x, y)); }
function renderWatchPanel(ctx, G, s, lay, m) {
  const w = G.watch;
  const sz = Math.round(24 * Math.min(m, 1.6));
  let msg;
  if (s.hold) {
    const d = s.hold.decision, tn = TEAM_NAME[s.hold.team];
    if (w.phase === 'think') msg = `THINK ${Math.ceil(w.timer)}s: ${tn} number ${s.players[s.hold.who].num} is weighing the options.`;
    else if (w.phase === 'reveal') msg = `REVEAL: ${d.summary}. ${d.reason}`;
    else msg = `ACT: ${d.summary}`;
  } else msg = 'ACT: the play continues.';
  const bh = Math.round(66 * Math.min(m, 1.6));
  const rows = m >= 1.4 ? 2 : 1;
  const bottom = H - 14;
  const byTop = bottom - rows * bh - (rows - 1) * 10;
  const ps = Math.round(21 * Math.min(m, 1.5)), pw = W - 40;
  ctx.font = `600 ${ps}px ${FONT}`;
  const lines = wrapLines(ctx, msg, pw - 30).slice(0, 9);
  const ph = lines.length * ps * 1.25 + 20, py = byTop - ph - 12;
  roundPath(ctx, 20, py, pw, ph, 16); ctx.fillStyle = 'rgba(4,16,10,0.88)'; ctx.fill();
  ctx.fillStyle = w.phase === 'think' ? '#ffe9a0' : w.phase === 'reveal' ? '#7fe8d6' : '#ff9a86'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  lines.forEach((l, i) => ctx.fillText(l, 36, py + 10 + ps * (0.95 + i * 1.25)));
  const labels = [w.paused ? 'Resume' : 'Pause', 'Think −', 'Think +', 'Exit'];
  const cols = rows === 2 ? 2 : 4, cw = (W - 28 - (cols - 1) * 10) / cols;
  W_RECTS.length = 0;
  labels.forEach((lb, i) => {
    const r = { x: 14 + (i % cols) * (cw + 10), y: byTop + Math.floor(i / cols) * (bh + 10), w: cw, h: bh };
    W_RECTS.push(r); drawButton(ctx, r, lb, { primary: i === 0, dark: i > 0, size: sz });
  });
  // highlight the decision's target on the pitch while revealed
  if (s.hold && w.phase !== 'think' && s.hold.decision.to != null && s.hold.decision.to >= 0) G.mark = s.hold.decision.to; else G.mark = -1;
}

// ---- Think -----------------------------------------------------------------------------------------------------
export function renderThink(ctx, G, view) {
  const t = G.think;
  ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(0, 0, W, H);
  const m = PLAY_M[G.settings.textIdx];
  const x = 30, w = W - 60;
  const size = Math.round(26 * Math.min(m, 2));
  ctx.font = `400 ${size}px ${FONT}`;
  const lines = wrapLines(ctx, t.reason, w - 60);
  const hh = size * 1.3 * lines.length + 60;
  const bh = Math.round(84 * Math.min(m, 1.5));
  const total = Math.min(H - 100, 70 + size * 1.5 + hh + bh + 50);
  const y = Math.max(30, (H - total) / 2);
  panel(ctx, x, y, w, total, { r: 26, fill: 'rgba(14,38,26,0.97)', stroke: 'rgba(255,246,228,0.5)' });
  ctx.textAlign = 'center'; ctx.fillStyle = '#ffe9a0'; ctx.font = `800 ${Math.round(34 * Math.min(m, 1.6))}px ${FONT}`; ctx.fillText('Coach says', W / 2, y + 56);
  ctx.fillStyle = '#7fe8d6'; ctx.font = `700 ${Math.round(28 * Math.min(m, 1.6))}px ${FONT}`;
  const sm = wrapLines(ctx, t.summary, w - 50); sm.forEach((l, i) => ctx.fillText(l, W / 2, y + 108 + i * 34 * Math.min(m, 1.6)));
  const off = y + 108 + sm.length * 34 * Math.min(m, 1.6) + 6;
  ctx.textAlign = 'left'; ctx.fillStyle = '#fff6e4'; ctx.font = `400 ${size}px ${FONT}`;
  lines.forEach((l, i) => ctx.fillText(l, x + 30, off + size * (1 + i * 1.3)));
  const by = y + total - bh - 30;
  G.thinkRects = { close: { x: x + 24, y: by, w: w - 48, h: bh } };
  drawButton(ctx, G.thinkRects.close, 'Close', { primary: true, size: Math.round(30 * Math.min(m, 1.5)) });
}

// marks used by Think / Watch on the pitch (a ring around the suggested teammate)
export function renderMarks(ctx, G, view) {
  const s = G.sim;
  const ids = [];
  if (G.think && G.think.to != null && G.think.to >= 0) ids.push(G.think.to);
  if (G.mark != null && G.mark >= 0) ids.push(G.mark);
  for (const id of ids) {
    const p = s.players[id]; const pts = [];
    for (let i = 0; i < 20; i++) { const a = (i / 20) * TAU; const q = proj(G, view, p.x + Math.cos(a) * 1.0, 0.02, p.z + Math.sin(a) * 1.0); if (q) pts.push(q); }
    if (pts.length < 20) continue;
    ctx.save(); ctx.beginPath(); pts.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y))); ctx.closePath(); ctx.lineWidth = 5; ctx.strokeStyle = '#7fe8d6'; ctx.stroke(); ctx.restore();
  }
}

// ---- 2D fallback when WebGL is missing ----------------------------------------------------------------------------
export function renderFallback(ctx, G, view) {
  const s = G.sim; if (!s) return;
  const Wd = view.cssW || 720, Hd = view.cssH || 1280;
  const P = (x, y, z) => projectV(s.cam, Wd, Hd, x, y, z);
  ctx.save();
  ctx.fillStyle = '#0c2216'; ctx.fillRect(0, 0, W, H);
  const corners = [[-HW, -HL], [HW, -HL], [HW, HL], [-HW, HL]].map(([x, z]) => P(x, 0, z));
  if (corners.every(Boolean)) {
    ctx.beginPath(); corners.forEach((c, i) => (i ? ctx.lineTo(c.x, c.y) : ctx.moveTo(c.x, c.y))); ctx.closePath();
    ctx.fillStyle = '#2f8a4a'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = '#f6f7fb'; ctx.stroke();
  }
  for (const gz of [-HL, HL]) {
    const a = P(-GOAL_HW, 0, gz), b = P(GOAL_HW, 0, gz), c = P(-GOAL_HW, BAR, gz), d = P(GOAL_HW, BAR, gz), e = P(-GOAL_HW, 7, gz), f = P(GOAL_HW, 7, gz);
    if (a && b && c && d && e && f) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(e.x, e.y); ctx.moveTo(b.x, b.y); ctx.lineTo(f.x, f.y); ctx.moveTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.stroke(); }
  }
  const list = s.players.map((p) => ({ p, a: P(p.x, 0, p.z), b: P(p.x, 1.75, p.z) })).filter((o) => o.a && o.b).sort((u, v) => v.a.depth - u.a.depth);
  for (const { p, a, b } of list) { ctx.strokeStyle = TEAM_COL[p.team]; ctx.lineWidth = Math.max(8, (a.y - b.y) * 0.24); ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); ctx.fillStyle = '#f2c9a0'; ctx.beginPath(); ctx.arc(b.x, b.y - 6, Math.max(6, (a.y - b.y) * 0.11), 0, TAU); ctx.fill(); }
  const bp = P(s.ball.x, s.ball.y, s.ball.z);
  if (bp) { const sh = P(s.ball.x, 0, s.ball.z); if (sh) { ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(sh.x, sh.y, 9, 4, 0, 0, TAU); ctx.fill(); } ctx.fillStyle = '#f2f2f2'; ctx.strokeStyle = '#a02020'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(bp.x, bp.y, Math.max(7, 90 / bp.depth), 0, TAU); ctx.fill(); ctx.stroke(); }
  ctx.restore();
}
void C; void ROLES; void LEVELS;
