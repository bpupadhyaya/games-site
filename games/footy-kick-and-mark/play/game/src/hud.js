// In-play HUD: scoreboard, pitch markers (you, your target, the landing spot), the stick and buttons, the set-shot meter, banners,
// Think and Pause. Everything follows the text size (through PLAY_M) and is laid out by layout.hudLayout so hit-testing and drawing agree.
import { W, H, PLAY_M, hudLayout, inRect } from './layout.js';
import { FONT, C, roundPath, drawButton, panel, wrapLines } from './ui.js';
import { projectV } from './camera.js';
import { predictBall, dirOf, inside } from './model.js';
import { ROLE_NAME, QUARTER } from './consts.js';
import * as KC from './consts.js';

const TAU = Math.PI * 2;
export const TEAM_COL = ['#e0443a', '#2f7be0'];
export const W_RECTS = [];
export const watchHit = (x, y) => W_RECTS.findIndex((r) => inRect(r, x, y));

const fmtClock = (sec) => { const s = Math.max(0, Math.ceil(sec)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const pts = (sc) => sc.g * 6 + sc.b;

function P(G, x, y, z) { return projectV(G.viewW || 720, G.viewH || 1280, x, y, z); }
function groundEllipse(ctx, G, x, z, r, fill, stroke, lw = 3) {
  const c = P(G, x, 0.02, z), a = P(G, x + r, 0.02, z), b = P(G, x, 0.02, z + r);
  if (!c || !a || !b) return null;
  const rx = Math.max(7, Math.abs(a.x - c.x)), ry = Math.max(4, Math.abs(b.y - c.y));
  ctx.save(); ctx.beginPath(); ctx.ellipse(c.x, c.y, rx, ry, 0, 0, TAU);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.lineWidth = lw; ctx.strokeStyle = stroke; ctx.stroke(); }
  ctx.restore();
  return { c, rx, ry };
}
function tag(ctx, x, y, text, col = '#ffd54a', size = 20) {
  ctx.save(); ctx.font = `800 ${size}px ${FONT}`; const w = ctx.measureText(text).width + 18;
  roundPath(ctx, x - w / 2, y - size * 0.95, w, size * 1.4, 10); ctx.fillStyle = 'rgba(6,24,16,0.86)'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = col; ctx.stroke();
  ctx.fillStyle = '#fff6e4'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, x, y - size * 0.25 + 1); ctx.restore();
}

function scoreboard(ctx, G, s, lay) {
  const m = lay.m, th = lay.topH;
  const g = ctx.createLinearGradient(0, 0, 0, th + 30); g.addColorStop(0, 'rgba(4,16,10,0.9)'); g.addColorStop(1, 'rgba(4,16,10,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, th + 30);
  const colw = 240;
  for (const i of [0, 1]) {
    const left = i === 0, x0 = left ? 16 : W - 16 - colw;
    ctx.fillStyle = TEAM_COL[i]; roundPath(ctx, x0, 14, 9, th - 40, 4); ctx.fill();
    const ax = left ? x0 + 20 : x0 + colw - 20;
    ctx.textAlign = left ? 'left' : 'right'; ctx.textBaseline = 'alphabetic';
    const m1 = Math.min(m, 1.6);
    ctx.fillStyle = '#fff6e4'; ctx.font = `700 ${Math.round(21 * m1)}px ${FONT}`;
    ctx.fillText(`${s.teams[i].name} ${s.score[i].g}.${s.score[i].b}`, ax, 14 + 22 * m1);
    ctx.font = `800 ${Math.round(54 * m)}px ${FONT}`; ctx.fillText(String(pts(s.score[i])), ax, 14 + 22 * m1 + 52 * m);
  }
  const mc = Math.min(m, 1.5);
  ctx.textAlign = 'center'; ctx.fillStyle = '#fff6e4'; ctx.font = `800 ${Math.round(42 * mc)}px ${FONT}`;
  ctx.fillText(fmtClock(s.clock), W / 2, 40 + 30 * mc);
  ctx.fillStyle = '#ffd97a'; ctx.font = `700 ${Math.round(19 * mc)}px ${FONT}`;
  ctx.fillText(s.siren ? 'Last play' : `Q${s.q + 1} of ${s.quarters}`, W / 2, 40 + 30 * mc + 24 * mc);
}

function stickAndButtons(ctx, G, s, lay, cs, ctxInfo) {
  const dn = cs && cs.down ? cs.down : { stick: null };
  // stick
  const sc = dn.stick ? { x: dn.stick.ox, y: dn.stick.oy } : { x: lay.stick.cx, y: lay.stick.cy };
  ctx.save();
  ctx.globalAlpha = dn.stick ? 0.95 : 0.55;
  ctx.beginPath(); ctx.arc(sc.x, sc.y, 84, 0, TAU); ctx.fillStyle = 'rgba(255,246,228,0.12)'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,246,228,0.7)'; ctx.stroke();
  let kx = sc.x, ky = sc.y;
  if (dn.stick) { const dx = dn.stick.x - dn.stick.ox, dy = dn.stick.y - dn.stick.oy, d = Math.hypot(dx, dy) || 1, k = Math.min(1, 80 / d); kx = sc.x + dx * k; ky = sc.y + dy * k; }
  ctx.beginPath(); ctx.arc(kx, ky, 38, 0, TAU); ctx.fillStyle = dn.stick ? '#fff6e4' : 'rgba(255,246,228,0.6)'; ctx.fill();
  ctx.restore();
  const btn = (c, label, sub, on, primary, down) => {
    ctx.save();
    const pressed = down ? 3 : 0;
    ctx.beginPath(); ctx.arc(c.cx, c.cy + 5, c.r, 0, TAU); ctx.fillStyle = 'rgba(4,16,10,0.4)'; ctx.fill();
    ctx.beginPath(); ctx.arc(c.cx, c.cy + pressed, c.r, 0, TAU);
    ctx.fillStyle = !on ? 'rgba(160,185,170,0.30)' : primary ? '#d8472c' : '#1f9d6a'; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = !on ? 'rgba(255,255,255,0.3)' : primary ? '#8f2a15' : '#146f4a'; ctx.stroke();
    if (down) { ctx.fillStyle = 'rgba(4,16,10,0.18)'; ctx.fill(); }
    ctx.fillStyle = on ? '#fffaf0' : 'rgba(235,245,238,0.6)'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    let px = Math.round(c.r * 0.36); ctx.font = `800 ${px}px ${FONT}`;
    while (ctx.measureText(label).width > c.r * 1.7 && px > 11) { px--; ctx.font = `800 ${px}px ${FONT}`; }
    ctx.fillText(label, c.cx, c.cy + pressed - (sub ? c.r * 0.08 : 0));
    if (sub) { ctx.font = `600 ${Math.round(c.r * 0.2)}px ${FONT}`; ctx.globalAlpha = 0.85; ctx.fillText(sub, c.cx, c.cy + pressed + c.r * 0.34); }
    ctx.restore();
  };
  btn(lay.a1, ctxInfo.a1 || 'ACT', '', !!ctxInfo.a1, true, dn.a1);
  btn(lay.a2, ctxInfo.a2 || '', '', !!ctxInfo.a2, false, dn.a2);
  btn(lay.spr, 'RUN', '', true, false, dn.spr);
  // stamina ring around the sprint button
  const pl = G.S && G.S.humanPlayer();
  if (pl) { ctx.save(); ctx.lineWidth = 6; ctx.strokeStyle = pl.stam > 0.25 ? '#ffd54a' : '#ff8a6a'; ctx.beginPath(); ctx.arc(lay.spr.cx, lay.spr.cy, lay.spr.r + 9, -Math.PI / 2, -Math.PI / 2 + TAU * pl.stam); ctx.stroke(); ctx.restore(); }
}

function meter(ctx, G, s, lay) {
  const set = s.set; if (!set || !G.S.humanPlayer() || set.id !== G.S.humanPlayer().id || s.phase !== 'setshot') return;
  const r = lay.meter, ph = Math.sin(set.meter * TAU / 1.5);
  roundPath(ctx, r.x, r.y, r.w, r.h, 20); ctx.fillStyle = 'rgba(6,24,16,0.85)'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,246,228,0.6)'; ctx.stroke();
  const cx = r.x + r.w / 2, half = r.w / 2 - 16;
  ctx.fillStyle = 'rgba(255,246,228,0.18)'; roundPath(ctx, r.x + 16, r.y + 18, r.w - 32, r.h - 36, 10); ctx.fill();
  ctx.fillStyle = 'rgba(31,157,106,0.55)'; ctx.fillRect(cx - half * 0.28, r.y + 18, half * 0.56, r.h - 36);
  ctx.fillStyle = 'rgba(31,157,106,0.9)'; ctx.fillRect(cx - half * 0.1, r.y + 18, half * 0.2, r.h - 36);
  const mx = cx + ph * half; ctx.fillStyle = '#fff6e4'; ctx.fillRect(mx - 4, r.y + 8, 8, r.h - 16);
}

// short flat rings and sparks where something just happened (drawn on the HUD layer; the pitch itself never moves)
function effects(ctx, G, s) {
  for (const e of s.events) {
    const age = s.t - e.t;
    if (age < 0 || age > 0.7) continue;
    let pos = null, col = '#fff6e4', big = 1, kind = 'ring';
    if (e.type === 'kick') { pos = [e.x, e.y, e.z]; big = 1.1; }
    else if (e.type === 'handball') { pos = [e.x, e.y, e.z]; big = 0.7; }
    else if (e.type === 'mark') { pos = [e.bx, e.by, e.bz]; col = '#ffd54a'; big = 1.5; kind = 'burst'; }
    else if (e.type === 'tackle') { pos = [e.x, 1.1, e.z]; big = 1.2; col = '#ffffff'; }
    else if (e.type === 'spoil') { pos = [e.x, e.y, e.z]; col = '#7fe8d6'; big = 1.1; }
    else if (e.type === 'goal') { pos = [0, 2.5, e.z]; col = e.team === 0 ? '#ff7a6a' : '#7fb2ff'; big = 3; kind = 'confetti'; }
    if (!pos) continue;
    const q = P(G, pos[0], pos[1], pos[2]); if (!q) continue;
    const k = age / 0.7, a = 1 - k;
    ctx.save(); ctx.globalAlpha = Math.max(0, a); ctx.strokeStyle = col; ctx.fillStyle = col;
    if (kind === 'ring') { ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(q.x, q.y, 6 + 26 * big * k, 0, TAU); ctx.stroke(); }
    else if (kind === 'burst') { ctx.lineWidth = 3; for (let i = 0; i < 10; i++) { const an = (i / 10) * TAU + (e.id % 7) * 0.3, r0 = 10 + 18 * k * big, r1 = 18 + 34 * k * big; ctx.beginPath(); ctx.moveTo(q.x + Math.cos(an) * r0, q.y + Math.sin(an) * r0); ctx.lineTo(q.x + Math.cos(an) * r1, q.y + Math.sin(an) * r1); ctx.stroke(); } }
    else { for (let i = 0; i < 26; i++) { const an = (i * 2.399 + e.id) % TAU, sp = 40 + ((i * 37) % 70), x = q.x + Math.cos(an) * sp * k * 1.6, y = q.y - 30 + Math.sin(an) * sp * k * 0.9 + 140 * k * k; ctx.fillStyle = i % 3 === 0 ? '#ffd54a' : i % 3 === 1 ? col : '#ffffff'; ctx.fillRect(x, y, 6, 4); } }
    ctx.restore();
  }
}

function pitchMarkers(ctx, G, s, lay, view) {
  effects(ctx, G, s);
  const S = G.S, B = s.ball, hp = S.humanPlayer();
  // ball: a ring so a small ball is always easy to follow
  const bp = P(G, B.x, B.y, B.z);
  if (bp && B.owner < 0 && s.phase !== 'ballup' || bp && s.phase === 'ballup') {
    ctx.save(); ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,224,96,0.95)'; ctx.beginPath(); ctx.arc(bp.x, bp.y, 17, 0, TAU); ctx.stroke(); ctx.restore();
  }
  // where a ball in the air will come down
  if (B.owner < 0 && B.y > 0.6 && (B.kind === 'kick' || B.kind === 'handball' || B.kind === 'tap' || B.kind === 'loose' || B.kind === 'ballup')) {
    const pr = predictBall(B, 150, 1 / 30); let q = null;
    for (const p of pr) if (p.y <= 2.1) { q = p; break; }
    if (!q && pr.length) q = pr[pr.length - 1];
    if (q) { const pulse = 0.5 + 0.5 * Math.sin(s.t * 9); groundEllipse(ctx, G, q.x, q.z, 1.1, `rgba(255,224,96,${0.15 + 0.1 * pulse})`, `rgba(255,224,96,${0.7 + 0.3 * pulse})`, 3); }
  }
  // who is who: a small letter above each of your teammates
  const LET = { ruck: 'R', mid: 'M', fwd: 'F', def: 'D' };
  for (const q of s.players) {
    if (q.team !== 0 || (hp && q.id === hp.id)) continue;
    const hd = P(G, q.x, 2.3 + q.jh, q.z); if (!hd) continue;
    ctx.save(); ctx.globalAlpha = 0.85; ctx.fillStyle = 'rgba(224,68,58,0.9)'; ctx.beginPath(); ctx.arc(hd.x, hd.y - 8, 7, 0, TAU); ctx.fill(); ctx.fillStyle = '#fff'; ctx.font = `800 10px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(LET[q.role], hd.x, hd.y - 7); ctx.restore();
  }
  if (!hp) return;
  const you = groundEllipse(ctx, G, hp.x, hp.z, 1.2, 'rgba(255,213,74,0.22)', '#ffd54a', 4);
  const hd = P(G, hp.x, 2.45, hp.z);
  if (hd) { ctx.save(); ctx.fillStyle = '#ffd54a'; ctx.beginPath(); ctx.moveTo(hd.x, hd.y + 6); ctx.lineTo(hd.x - 9, hd.y - 8); ctx.lineTo(hd.x + 9, hd.y - 8); ctx.closePath(); ctx.fill(); ctx.restore(); }
  void you;
  // the target a kick or handball would go to
  const info = G.aim;
  if (info && info.t) {
    const t = info.t, a = P(G, hp.x, 0.1, hp.z), b = P(G, t.x, 0.1, t.z);
    if (a && b) { ctx.save(); ctx.setLineDash([8, 8]); ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(127,232,214,0.85)'; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); ctx.restore(); }
    groundEllipse(ctx, G, t.x, t.z, t.type === 'goal' ? 1.6 : 1.0, 'rgba(127,232,214,0.2)', '#7fe8d6', 4);
    if (b) tag(ctx, b.x, b.y - 22, t.type === 'goal' ? 'GOAL' : t.type === 'mate' ? 'PASS' : 'KICK', '#7fe8d6', 17);
  }
  // hint target
  if (G.think && G.think.tx !== undefined) { groundEllipse(ctx, G, G.think.tx, G.think.tz, 1.4, 'rgba(255,233,160,0.25)', '#ffe9a0', 4); const q = P(G, G.think.tx, 0.1, G.think.tz); if (q) tag(ctx, q.x, q.y - 24, 'HERE', '#ffe9a0', 18); }
}

function banner(ctx, G, s, lay, m) {
  const showLast = s.last && s.t - s.last.t < 2.3;
  if (showLast) {
    const big = Math.round(44 * Math.min(m, 1.5)); ctx.font = `800 ${big}px ${FONT}`;
    const lines = wrapLines(ctx, s.last.text, W - 110);
    const ph = lines.length * big * 1.2 + 24, py = lay.bannerY;
    roundPath(ctx, 50, py, W - 100, ph, 20); ctx.fillStyle = 'rgba(6,24,16,0.82)'; ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = s.last.team >= 0 ? TEAM_COL[s.last.team] : '#ffd54a'; ctx.stroke();
    ctx.fillStyle = '#fff6e4'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; lines.forEach((l, i) => ctx.fillText(l, W / 2, py + 12 + big * (0.95 + i * 1.2)));
    return py + ph;
  }
  return lay.bannerY;
}

function promptLine(G, s, ctxInfo) {
  const hp = G.S.humanPlayer();
  if (G.mode === 'watch') return 'Watch & Learn: all computer players';
  if (G.mode === 'drill' && G.drill) return G.drill.prompt || '';
  if (s.phase === 'ballup') return s.ballup && (s.ballup.why === 'quarter' || s.ballup.why === 'center') ? 'Bounce at the centre: the rucks jump for it' : 'Ball-up: the nearest two players jump for it';
  if (s.phase === 'dead') return '';
  if (s.phase === 'setshot' && s.set) {
    if (hp && s.set.id === hp.id) return s.set.kind === 'mark' ? 'You took a mark: KICK (stop the bar in the middle) or PLAY ON' : s.set.kind === 'kickin' ? 'Kick-in: KICK to a teammate or PLAY ON' : 'Free kick: KICK or PLAY ON';
    return `${s.teams[s.set.team].name} ${s.set.kind === 'mark' ? 'have a mark' : 'have a free kick'}: stand your ground`;
  }
  if (hp && G.mode === 'ai' && (G.settings.tips | 0) <= 2 && s.phase === 'play' && s.t < 16) return TIPS[hp.role];
  return '';
}
const TIPS = {
  fwd: 'You are the gold ring. Drag the left stick to run into open space near goal; hold RUN to sprint. Teammates will kick to you: press MARK as the ball arrives.',
  mid: 'You are the gold ring. Drag the left stick to run; hold RUN to sprint. Run over the loose ball to pick it up, then HANDBALL or KICK to the teal ring.',
  def: 'You are the gold ring. Drag the left stick to run; stay between the ball and their forwards. Press SPOIL or MARK when a kick comes, TACKLE when a carrier is close.',
  ruck: 'You are the gold ring. Stand under the ball-up and press TAP as it comes down; steer with the stick. Then drop back behind the play.',
};

// the fixed top-down inset: live positions, and the replay of the last goal. It never moves.
function miniMap(ctx, G, s, lay) {
  const w = 92, h = Math.round(w * (KC.HL / KC.HW)), x = Math.round(W / 2 - w / 2), y = lay.topH + 6, sx = (w - 8) / (2 * KC.HW), cx = x + w / 2, cy = y + h / 2;
  let players = s.players.map((p) => [p.x, p.z]), ball = [s.ball.x, s.ball.z, s.ball.y], label = '';
  const R = G.replay;
  if (R && G.replayFrames.length) {
    const i = Math.floor((s.t - R.t0) / 0.05);
    if (i >= R.n) G.replay = null; else if (i >= 0) { const f = G.replayFrames[i]; players = f.p; ball = f.b; label = 'REPLAY'; }
  }
  ctx.save(); roundPath(ctx, x, y, w, h, 12); ctx.fillStyle = label ? 'rgba(20,30,50,0.82)' : 'rgba(6,24,16,0.62)'; ctx.fill(); ctx.lineWidth = label ? 3 : 1.5; ctx.strokeStyle = label ? '#ffd54a' : 'rgba(255,246,228,0.5)'; ctx.stroke();
  ctx.beginPath(); ctx.ellipse(cx, cy, KC.HW * sx, KC.HL * sx, 0, 0, TAU); ctx.fillStyle = 'rgba(47,138,74,0.8)'; ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.stroke();
  // the screen shows the far end at the top and screen-right is world -x: draw it the same way
  const mp = (px, pz) => [cx - px * sx, cy - pz * sx];
  ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); for (const gz of [-KC.ZG, KC.ZG]) { const a = mp(-KC.BHW, gz), b = mp(KC.BHW, gz); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); } ctx.stroke();
  const hp = G.S.humanPlayer();
  players.forEach((q, i) => { const m = mp(q[0], q[1]); ctx.fillStyle = TEAM_COL[i < 6 ? 0 : 1]; ctx.beginPath(); ctx.arc(m[0], m[1], 3.2, 0, TAU); ctx.fill(); if (!label && hp && i === hp.id) { ctx.strokeStyle = '#ffd54a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(m[0], m[1], 5.5, 0, TAU); ctx.stroke(); } });
  const bm = mp(ball[0], ball[1]); ctx.fillStyle = '#fff6e4'; ctx.beginPath(); ctx.arc(bm[0], bm[1], 2.6, 0, TAU); ctx.fill();
  if (label) { ctx.fillStyle = '#ffd54a'; ctx.font = `800 13px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText(label, cx, y + h + 15); }
  ctx.restore();
}

export function renderPlayHud(ctx, G, view, cs) {
  const S = G.S, s = S.s, lay = hudLayout(G.settings.textIdx), m = lay.m;
  const hp = S.humanPlayer();
  scoreboard(ctx, G, s, lay);
  pitchMarkers(ctx, G, s, lay, view);
  miniMap(ctx, G, s, lay);
  const prompt = promptLine(G, s);
  let by = banner(ctx, G, s, lay, m);
  if (prompt) {
    const ps = Math.round(22 * Math.min(m, 1.6)); ctx.font = `700 ${ps}px ${FONT}`;
    const lines = wrapLines(ctx, prompt, W - 80), ph = lines.length * ps * 1.25 + 16;
    const py = by + 8 > lay.bannerY + 8 && by !== lay.bannerY ? by + 10 : lay.bannerY + 0;
    const y2 = (s.last && s.t - s.last.t < 2.3) ? py : lay.bannerY;
    roundPath(ctx, 30, y2, W - 60, ph, 14); ctx.fillStyle = 'rgba(6,24,16,0.74)'; ctx.fill();
    ctx.fillStyle = '#fff6e4'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; lines.forEach((l, i) => ctx.fillText(l, W / 2, y2 + 8 + ps * (0.95 + i * 1.25)));
  }
  if (G.mode === 'watch') { watchButtons(ctx, G, s, lay, m); return; }
  const ctxInfo = hp ? S.contextOf(hp) : { a1: null, a2: null };
  const bg = ctx.createLinearGradient(0, lay.stick.y - 30, 0, H); bg.addColorStop(0, 'rgba(4,16,10,0)'); bg.addColorStop(0.3, 'rgba(4,16,10,0.55)'); bg.addColorStop(1, 'rgba(4,16,10,0.82)');
  ctx.fillStyle = bg; ctx.fillRect(0, lay.stick.y - 30, W, H - lay.stick.y + 30);
  meter(ctx, G, s, lay);
  stickAndButtons(ctx, G, s, lay, cs, ctxInfo);
  const sz = Math.round(24 * Math.min(m, 1.6));
  drawButton(ctx, lay.think, 'Think', { dark: true, size: sz });
  drawButton(ctx, lay.pause, 'Pause', { dark: true, size: sz });
  if (G.mode === 'drill') {
    const t = G.tally; if (t) { ctx.textAlign = 'center'; ctx.font = `700 ${Math.round(22 * Math.min(m, 1.6))}px ${FONT}`; ctx.fillStyle = '#ffe9a0'; ctx.fillText(`${G.lessonTitle}: ${t.ok} good of ${t.n} tried`, W / 2, lay.topH + 4 + 0); }
  }
}

function watchButtons(ctx, G, s, lay, m) {
  const w = G.watch, sz = Math.round(22 * Math.min(m, 1.7));
  let msg;
  if (s.hold) {
    const tn = s.teams[s.hold.team].name;
    if (w.phase === 'think') msg = `THINK ${Math.ceil(w.timer)}s: ${tn} are weighing their options. What would you do?`;
    else if (w.phase === 'reveal') msg = `REVEAL: ${tn}: ${s.hold.reason}`;
    else msg = `ACT: ${s.hold.summary}`;
  } else msg = 'ACT: the play continues.';
  const ps = Math.round(21 * Math.min(m, 1.5)), pw = W - 40;
  ctx.font = `600 ${ps}px ${FONT}`; const lines = wrapLines(ctx, msg, pw - 30).slice(0, 10);
  const ph = lines.length * ps * 1.25 + 20, py = 880;
  roundPath(ctx, 20, py, pw, ph, 16); ctx.fillStyle = 'rgba(6,24,16,0.88)'; ctx.fill();
  ctx.fillStyle = w.phase === 'think' ? '#ffe9a0' : w.phase === 'reveal' ? '#7fe8d6' : '#ff9a86'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  lines.forEach((l, i) => ctx.fillText(l, 36, py + 10 + ps * (0.95 + i * 1.25)));
  if (s.hold) { const hp0 = s.players[s.hold.id]; groundEllipse(ctx, G, hp0.x, hp0.z, 1.3, 'rgba(255,213,74,0.22)', '#ffd54a', 4); }
  if (s.hold && w.phase !== 'think') {
    const opts = s.hold.options || [];
    opts.forEach((o) => { if (o.tx === undefined) return; const chosen = s.hold.choice && o.label === s.hold.choice.label; const q = P(G, o.tx, 0.1, o.tz); if (!q) return; groundEllipse(ctx, G, o.tx, o.tz, chosen ? 1.5 : 1.0, chosen ? 'rgba(127,232,214,0.25)' : 'rgba(255,255,255,0.1)', chosen ? '#7fe8d6' : 'rgba(255,255,255,0.7)', chosen ? 4 : 2); tag(ctx, q.x, q.y - 20, `${o.label.replace('Kick to ', '').replace('Handball to ', 'HB ')}${chosen ? ' *' : ''}`, chosen ? '#7fe8d6' : '#fff6e4', 15); });
  }
  const y1 = Math.max(py + ph + 14, 1100), bh = Math.round(66 + 14 * (m - 1)), big = m >= 1.5;
  const rects = big ? [[14, y1, 345, bh], [361, y1, 345, bh], [14, y1 + bh + 10, 345, bh], [361, y1 + bh + 10, 345, bh]] : [[14, y1, 170, bh], [194, y1, 170, bh], [374, y1, 170, bh], [554, y1, 152, bh]];
  const labels = [w.paused ? 'Resume' : 'Pause', 'Think −', 'Think +', 'Exit'];
  W_RECTS.length = 0;
  rects.forEach((r, i) => { const rc = { x: r[0], y: r[1], w: r[2], h: r[3] }; W_RECTS.push(rc); drawButton(ctx, rc, labels[i], { primary: i === 0, dark: i > 0, size: sz }); });
}

// Think panel (modal): the coach's advice and its reason
export function renderThink(ctx, G) {
  const t = G.think;
  ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(0, 0, W, H);
  const m = PLAY_M[G.settings.textIdx];
  const x = 30, w = W - 60, size = Math.round(26 * Math.min(m, 2));
  ctx.font = `400 ${size}px ${FONT}`;
  const lines = wrapLines(ctx, t.reason, w - 60);
  const hh = size * 1.3 * lines.length + 60, bh = Math.round(84 * Math.min(m, 1.5));
  const total = Math.min(H - 120, 70 + size * 1.5 + hh + bh + 50);
  const y = Math.max(40, (H - total) / 2);
  panel(ctx, x, y, w, total, { r: 26, fill: 'rgba(14,48,36,0.97)', stroke: 'rgba(255,246,228,0.5)' });
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = '#ffe9a0'; ctx.font = `800 ${Math.round(34 * Math.min(m, 1.6))}px ${FONT}`; ctx.fillText('Coach says', W / 2, y + 56);
  ctx.fillStyle = '#7fe8d6'; ctx.font = `700 ${Math.round(28 * Math.min(m, 1.6))}px ${FONT}`;
  const sm = wrapLines(ctx, t.summary, w - 50); sm.forEach((l, i) => ctx.fillText(l, W / 2, y + 108 + i * 34 * Math.min(m, 1.6)));
  const off = y + 108 + sm.length * 34 * Math.min(m, 1.6) + 6;
  ctx.textAlign = 'left'; ctx.fillStyle = '#fff6e4'; ctx.font = `400 ${size}px ${FONT}`;
  lines.forEach((l, i) => ctx.fillText(l, x + 30, off + size * (1 + i * 1.3)));
  const by = y + total - bh - 30;
  G.thinkRects = { close: { x: x + 24, y: by, w: w - 48, h: bh } };
  drawButton(ctx, G.thinkRects.close, 'Got it: back to the game', { primary: true, size: Math.round(28 * Math.min(m, 1.5)) });
}

// 2D fallback when WebGL is missing: the oval and the players drawn through the same camera maths.
export function renderFallback(ctx, G, view) {
  const s = G.sim; if (!s) return;
  const Wd = view.cssW || 720, Hd = view.cssH || 1280;
  ctx.save();
  const bgc = ctx.createLinearGradient(0, 0, 0, H); bgc.addColorStop(0, '#16324a'); bgc.addColorStop(0.3, '#1d4a38'); bgc.addColorStop(1, '#10321f');
  ctx.fillStyle = bgc; ctx.fillRect(0, 0, W, H);
  const HW = KC.HW, HL = KC.HL;
  ctx.beginPath(); let first = true;
  for (let a = 0; a <= 360; a += 6) { const r = a * Math.PI / 180, q = projectV(Wd, Hd, HW * Math.cos(r), 0, HL * Math.sin(r)); if (!q) continue; if (first) { ctx.moveTo(q.x, q.y); first = false; } else ctx.lineTo(q.x, q.y); }
  ctx.closePath(); ctx.fillStyle = '#2f8a4a'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = '#f6f7fb'; ctx.stroke();
  for (const z of [-KC.ZG, KC.ZG]) for (const x of [-KC.BHW, -KC.GHW, KC.GHW, KC.BHW]) { const a = projectV(Wd, Hd, x, 0, z), b = projectV(Wd, Hd, x, Math.abs(x) < 4 ? 6 : 3, z); if (a && b) { ctx.strokeStyle = '#fff6e4'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); } }
  const list = s.players.map((p) => ({ p, a: projectV(Wd, Hd, p.x, 0, p.z), b: projectV(Wd, Hd, p.x, 1.8 + p.jh, p.z) })).filter((o) => o.a && o.b).sort((u, v) => v.a.depth - u.a.depth);
  for (const { p, a, b } of list) { ctx.strokeStyle = TEAM_COL[p.team]; ctx.lineWidth = Math.max(7, (a.y - b.y) * 0.3); ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); ctx.fillStyle = '#f2c9a0'; ctx.beginPath(); ctx.arc(b.x, b.y - 5, Math.max(5, (a.y - b.y) * 0.13), 0, TAU); ctx.fill(); }
  const B = s.ball, bp = projectV(Wd, Hd, B.x, B.y, B.z);
  if (bp) { const sh = projectV(Wd, Hd, B.x, 0, B.z); if (sh) { ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(sh.x, sh.y, 9, 4, 0, 0, TAU); ctx.fill(); } ctx.fillStyle = '#c8412e'; ctx.beginPath(); ctx.ellipse(bp.x, bp.y, 11, 7, 0.4, 0, TAU); ctx.fill(); }
  ctx.restore();
}
export { ROLE_NAME, QUARTER, dirOf, inside };
