// The play screen on top of the picture: scoreboard, buttons, stick, stamina, throw ring, banners, Think card and the Watch & Learn panel.
import { live, host, playLayout, MIN_FONT, fz, THINK_STEPS, TEXT_SCALES, PLAY_M, minHit } from './layout.js';
import { FONT, DISPLAY, C, roundPath, drawButton, panel, wrapLines, paintButton } from './ui.js';
import { TEAMS, GOAL_R, GRAB_R, TUG_R, CALLS, LEVELS, DROP_R, PERIODS } from './consts.js';
import { makeCam, drawWorld, drawOverlays, proj, kAt } from './scene.js';
import { throwPlan, goalCentre } from './phys.js';
import { bestPass, advise } from './ai.js';
import { clamp, hyp, lerp } from './util.js';

const TAU = Math.PI * 2;
export const STICK_R = 92;

// ---- pennants (original designs) --------------------------------------------------------------------------------------------------------
export function drawPennant(ctx, x, y, w, h, team) {
  const t = TEAMS[team];
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath();
  if (t.shape === 'swallow') { ctx.moveTo(0, 0); ctx.lineTo(w, 0); ctx.lineTo(w * 0.8, h / 2); ctx.lineTo(w, h); ctx.lineTo(0, h); }
  else if (t.shape === 'tri') { ctx.moveTo(0, 0); ctx.lineTo(w, h / 2); ctx.lineTo(0, h); }
  else { ctx.moveTo(0, 0); ctx.lineTo(w, 0); ctx.lineTo(w, h); ctx.lineTo(0, h); }
  ctx.closePath(); ctx.clip();
  ctx.fillStyle = t.c1; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = t.c2;
  const m = t.motif, cx = w * 0.42, cy = h / 2;
  if (m === 'paw') {
    ctx.beginPath(); ctx.ellipse(cx, cy + h * 0.1, w * 0.17, h * 0.2, 0, 0, TAU); ctx.fill();
    for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(cx + (i - 1.5) * w * 0.13, cy - h * 0.2 - (i === 1 || i === 2 ? h * 0.07 : 0), h * 0.08, 0, TAU); ctx.fill(); }
  } else if (m === 'chevron') {
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(w * (0.1 + i * 0.22), 0); ctx.lineTo(w * (0.3 + i * 0.22), cy); ctx.lineTo(w * (0.1 + i * 0.22), h); ctx.lineTo(w * (0.18 + i * 0.22), h); ctx.lineTo(w * (0.38 + i * 0.22), cy); ctx.lineTo(w * (0.18 + i * 0.22), 0); ctx.fill(); }
  } else if (m === 'peaks') {
    ctx.beginPath(); ctx.moveTo(0, h); ctx.lineTo(w * 0.22, h * 0.25); ctx.lineTo(w * 0.4, h * 0.65); ctx.lineTo(w * 0.62, h * 0.12); ctx.lineTo(w * 0.9, h); ctx.closePath(); ctx.fill();
  } else if (m === 'sun') {
    ctx.beginPath(); ctx.arc(cx, cy, h * 0.22, 0, TAU); ctx.fill();
    for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * h * 0.28, cy + Math.sin(a) * h * 0.28); ctx.lineTo(cx + Math.cos(a + 0.12) * h * 0.42, cy + Math.sin(a + 0.12) * h * 0.42); ctx.lineTo(cx + Math.cos(a - 0.12) * h * 0.42, cy + Math.sin(a - 0.12) * h * 0.42); ctx.closePath(); ctx.fill(); }
  } else if (m === 'wave') {
    ctx.lineWidth = h * 0.12; ctx.strokeStyle = t.c2;
    for (let i = 0; i < 3; i++) { ctx.beginPath(); for (let k = 0; k <= 12; k++) { const px = k / 12 * w, py = h * (0.25 + i * 0.25) + Math.sin(k * 0.9 + i) * h * 0.08; if (k) ctx.lineTo(px, py); else ctx.moveTo(px, py); } ctx.stroke(); }
  } else if (m === 'wing') {
    ctx.beginPath(); ctx.moveTo(w * 0.1, cy); ctx.quadraticCurveTo(w * 0.3, h * 0.05, w * 0.7, h * 0.18); ctx.quadraticCurveTo(w * 0.45, h * 0.35, w * 0.6, cy); ctx.quadraticCurveTo(w * 0.35, h * 0.6, w * 0.5, h * 0.85); ctx.quadraticCurveTo(w * 0.25, h * 0.7, w * 0.1, cy); ctx.fill();
  }
  ctx.fillStyle = t.trim; ctx.fillRect(0, 0, w, Math.max(2, h * 0.09)); ctx.fillRect(0, h - Math.max(2, h * 0.09), w, Math.max(2, h * 0.09));
  ctx.restore();
  ctx.save(); ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 1.5; ctx.translate(x, y);
  ctx.beginPath();
  if (t.shape === 'swallow') { ctx.moveTo(0, 0); ctx.lineTo(w, 0); ctx.lineTo(w * 0.8, h / 2); ctx.lineTo(w, h); ctx.lineTo(0, h); }
  else if (t.shape === 'tri') { ctx.moveTo(0, 0); ctx.lineTo(w, h / 2); ctx.lineTo(0, h); }
  else ctx.rect(0, 0, w, h);
  ctx.closePath(); ctx.stroke(); ctx.restore();
}

const mmss = (sec) => { const s = Math.max(0, Math.ceil(sec)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

function drawScoreboard(ctx, L, G, s) {
  const p = L.pill;
  const home = G.homeTeam, away = G.awayTeam;
  ctx.save();
  roundPath(ctx, p.x, p.y + 4, p.w, p.h, p.h / 2); ctx.fillStyle = 'rgba(8,12,30,0.4)'; ctx.fill();
  const g = ctx.createLinearGradient(p.x, p.y, p.x + p.w, p.y);
  g.addColorStop(0, '#1a2a52'); g.addColorStop(0.5, '#243b6b'); g.addColorStop(1, '#1a2a52');
  roundPath(ctx, p.x, p.y, p.w, p.h, p.h / 2); ctx.fillStyle = g; ctx.fill();
  ctx.lineWidth = 2.5; ctx.strokeStyle = 'rgba(244,188,74,0.9)'; ctx.stroke();
  const ph = p.h * 0.58, pw = ph * 1.4;
  drawPennant(ctx, p.x + p.h * 0.45, p.y + (p.h - ph) / 2, pw, ph, home);
  drawPennant(ctx, p.x + p.w - p.h * 0.45 - pw, p.y + (p.h - ph) / 2, pw, ph, away);
  const fs = Math.round(p.h * 0.5);
  ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
  ctx.fillStyle = '#fff4de'; ctx.font = `800 ${fs}px ${FONT}`;
  const cx = p.x + p.w / 2;
  ctx.fillText(`${s.score[0]}`, cx - p.w * 0.19, p.y + p.h / 2 + 2);
  ctx.fillText(`${s.score[1]}`, cx + p.w * 0.19, p.y + p.h / 2 + 2);
  ctx.font = `700 ${Math.round(fs * 0.62)}px ${FONT}`; ctx.fillStyle = '#ffe9a0';
  const label = s.golden ? 'GOLDEN GOAL' : mmss(s.clock);
  ctx.fillText(label, cx, p.y + p.h * 0.4);
  ctx.font = `600 ${Math.max(MIN_FONT, Math.round(fs * 0.4))}px ${FONT}`; ctx.fillStyle = 'rgba(255,244,222,0.8)';
  ctx.fillText(s.golden ? 'first goal wins' : `period ${Math.min(s.period, s.periods)} of ${s.periods}`, cx, p.y + p.h * 0.76);
  ctx.restore();
}

function drawStickVisual(ctx, L, G) {
  const c = G.c;
  ctx.save();
  if (c.stick) {
    const s = c.stick;
    ctx.fillStyle = 'rgba(255,244,222,0.14)'; ctx.beginPath(); ctx.arc(s.x0, s.y0, STICK_R, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(255,244,222,0.5)'; ctx.lineWidth = 3; ctx.stroke();
    const k = Math.min(1, s.mag) * STICK_R;
    const a = Math.atan2(-s.dz, s.dx);
    ctx.fillStyle = 'rgba(255,244,222,0.82)'; ctx.beginPath(); ctx.arc(s.x0 + Math.cos(a) * k, s.y0 + Math.sin(a) * k, 40, 0, TAU); ctx.fill();
  } else {
    const h = L.stickHint;
    ctx.strokeStyle = 'rgba(255,244,222,0.28)'; ctx.lineWidth = 3; ctx.setLineDash([8, 10]);
    ctx.beginPath(); ctx.arc(h.x, h.y, h.r, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(255,244,222,0.28)'; ctx.font = `700 ${MIN_FONT}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('RIDE', h.x, h.y);
  }
  ctx.restore();
}
function circleButton(ctx, c, label, o = {}) {
  const { active = false, disabled = false, fill = 0, mark = -1, sub = null, col = '#cf4a32' } = o;
  ctx.save();
  ctx.fillStyle = 'rgba(8,12,28,0.34)'; ctx.beginPath(); ctx.arc(c.x, c.y + 5, c.r, 0, TAU); ctx.fill();
  ctx.fillStyle = disabled ? 'rgba(120,130,160,0.55)' : active ? '#ff8a5a' : col;
  ctx.beginPath(); ctx.arc(c.x, c.y, c.r, 0, TAU); ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,244,222,0.75)'; ctx.stroke();
  if (fill > 0) {
    ctx.strokeStyle = '#ffe36a'; ctx.lineWidth = Math.max(7, c.r * 0.12);
    ctx.beginPath(); ctx.arc(c.x, c.y, c.r + 10, -Math.PI / 2, -Math.PI / 2 + TAU * Math.min(1, fill)); ctx.stroke();
  }
  if (mark >= 0) {
    const a = -Math.PI / 2 + TAU * mark;
    ctx.strokeStyle = '#4be28a'; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(c.x + Math.cos(a) * (c.r + 2), c.y + Math.sin(a) * (c.r + 2)); ctx.lineTo(c.x + Math.cos(a) * (c.r + 22), c.y + Math.sin(a) * (c.r + 22)); ctx.stroke();
  }
  ctx.fillStyle = disabled ? 'rgba(235,238,255,0.6)' : '#fff8ea';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const fs = Math.max(MIN_FONT, Math.round(c.r * (label.length > 5 ? 0.32 : 0.38)));
  ctx.font = `800 ${fs}px ${FONT}`; ctx.fillText(label, c.x, c.y - (sub ? fs * 0.18 : 0));
  if (sub) { ctx.font = `600 ${Math.max(MIN_FONT, Math.round(fs * 0.6))}px ${FONT}`; ctx.fillText(sub, c.x, c.y + fs * 0.62); }
  ctx.restore();
}

export function computePlan(s, ctl) {
  if (!ctl || !ctl.carry) return null;
  const pl = throwPlan(ctl, ctl.charge, null, ctl.team);
  const g = goalCentre(ctl.team);
  pl.hit = hyp(pl.lx - g.x, pl.lz - g.z) <= GOAL_R * 0.95 || pl.drop;
  return pl;
}

// the whole play screen
export function renderPlay(ctx, G, S) {
  const s = S.s, L = playLayout(G.settings.textIdx);
  const area = L.area;
  ctx.clearRect(0, 0, live.w, live.h);
  const cam = makeCam(area, G.view);
  G.cam = cam; G.L = L;
  const watchBot = G.mode === 'watch';
  drawWorld(ctx, cam, G.view, s, { noCtl: watchBot, homeTeam: G.homeTeam, awayTeam: G.awayTeam, cheerTeam: G.view.cheerTeam });
  const ctl = !watchBot && s.ctl >= 0 ? s.riders[s.ctl] : null;
  const plan = computePlan(s, ctl);
  const hint = G.think;
  drawOverlays(ctx, cam, G.view, s, { plan, noAim: watchBot, showAim: !!(hint && hint.kind === 'throw') });
  drawMarks(ctx, cam, G, s);
  drawOffscreen(ctx, cam, G, s);
  drawScoreboard(ctx, L, G, s);
  if (!watchBot) {
    drawButtons(ctx, L, G, s, ctl, plan);
  }
  drawBanner(ctx, L, G, s);
  if (G.think) drawThink(ctx, L, G);
  if (watchBot) drawWatch(ctx, L, G, s);
  if (G.paused && !G.pauseMenu && !watchBot) { /* think card handled above */ }
}

function drawMarks(ctx, c, G, s) {
  const marks = G.think ? G.think.marks : (G.mode === 'watch' && s.hold && G.watch.phase !== 'think' ? G.watch.marks : null);
  if (!marks) return;
  const t = G.view.t;
  for (const m of marks) {
    const p = proj(c, m.x, m.z, 0);
    const r = (1.1 + Math.sin(t * 5) * 0.12) * c.ppm * p.k;
    ctx.strokeStyle = '#ffe36a'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.ellipse(p.x, p.y, r, r * 0.34, 0, 0, TAU); ctx.stroke();
    ctx.fillStyle = 'rgba(255,227,106,0.2)'; ctx.fill();
    ctx.font = `800 ${fz(24)}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.fillStyle = '#10182c'; ctx.strokeStyle = '#ffe36a'; ctx.lineWidth = 5; ctx.strokeText(m.label, p.x, p.y - r * 0.45 - 6); ctx.fillText(m.label, p.x, p.y - r * 0.45 - 6);
  }
}
function drawOffscreen(ctx, c, G, s) {
  // little arrows for the ball and your team-mates when they are out of the picture
  const items = [{ x: s.ball.x, z: s.ball.z, col: '#ffe36a', big: true }];
  for (const r of s.riders) if (r.team === 0) items.push({ x: r.x, z: r.z, col: TEAMS[G.homeTeam].kit });
  const L = G.L;
  const y0 = L.area.y + 14, y1 = L.area.y + L.area.h * 0.97;
  for (const it of items) {
    const p = proj(c, it.x, it.z, 1);
    if (p.x > 14 && p.x < live.w - 14) continue;
    const left = p.x < 14;
    const x = left ? 24 + L.xl : live.w - 24 - (live.w - L.xr);
    const y = clamp(p.y, y0 + 60, y1 - 40);
    ctx.fillStyle = it.col; ctx.strokeStyle = 'rgba(10,14,30,0.85)'; ctx.lineWidth = 3;
    const s2 = it.big ? 16 : 11;
    ctx.beginPath(); ctx.moveTo(x + (left ? -s2 : s2), y); ctx.lineTo(x + (left ? s2 : -s2), y - s2); ctx.lineTo(x + (left ? s2 : -s2), y + s2); ctx.closePath(); ctx.stroke(); ctx.fill();
  }
}
function drawButtons(ctx, L, G, s, ctl, plan) {
  drawStickVisual(ctx, L, G);
  const carrying = !!(ctl && ctl.carry);
  const loose = !carrying && s.ball.owner < 0;
  const riv = s.carrier >= 0 && ctl && s.riders[s.carrier].team !== ctl.team;
  const label = carrying ? 'THROW' : riv ? 'TUG' : 'GRAB';
  const need = plan && !plan.drop ? clamp(plan.need, 0, 1) : -1;
  circleButton(ctx, L.act, label, { active: G.c.actHeld, fill: carrying ? ctl.charge : 0, mark: carrying ? need : -1, col: carrying ? '#cf4a32' : '#1b8f88' });
  circleButton(ctx, L.pass, 'PASS', { disabled: !carrying, col: '#22386b' });
  circleButton(ctx, L.sprint, 'SPRINT', { active: G.c.sprintOn, fill: ctl ? ctl.stam : 0, col: '#8a6a1a' });
  circleButton(ctx, L.swap, 'SWAP', { col: '#3a4a7a' });
  void loose;
  // stamina bar beside the stick
  const st = L.stamina;
  if (ctl) {
    ctx.fillStyle = 'rgba(8,12,28,0.45)'; roundPath(ctx, st.x, st.y, st.w, st.h, 6); ctx.fill();
    const f = clamp(ctl.stam, 0, 1);
    ctx.fillStyle = f > 0.3 ? '#ffe36a' : '#ff7a4a'; roundPath(ctx, st.x, st.y + st.h * (1 - f), st.w, st.h * f, 6); ctx.fill();
  }
  // think, pause, call chip
  drawButton(ctx, L.pause, 'Pause', { dark: true, size: fz(26) });
  drawButton(ctx, L.think, 'Think', { dark: true, size: fz(26) });
  drawButton(ctx, L.call, CALLS[s.call[0]], { dark: false, size: fz(24), sub: 'tap to change the call' });
}
function drawBanner(ctx, L, G, s) {
  let text = null, sub = null;
  const t = s.phaseT;
  if (s.phase === 'ready') { const left = Math.max(0, 1.9 - t); text = left > 1.2 ? 'Get ready' : left > 0.5 ? 'Ride!' : 'Go!'; sub = s.period === 1 && s.score[0] + s.score[1] === 0 && !s.golden ? `${TEAMS[G.homeTeam].name} v ${TEAMS[G.awayTeam].name}` : null; }
  else if (s.phase === 'goal') { text = 'GOAL!'; sub = `${TEAMS[s.lastScorer === 0 ? G.homeTeam : G.awayTeam].name} score`; }
  else if (s.phase === 'break') { text = 'Half time'; sub = `${s.score[0]} - ${s.score[1]}`; }
  else if (s.phase === 'end') { text = 'Full time'; }
  else if (s.golden && t < 2.5) { text = 'Golden goal'; sub = 'first to score wins'; }
  if (!text) return;
  const k = Math.min(1, t * 4);
  const y = L.area.y + L.area.h * 0.18;
  ctx.save();
  ctx.globalAlpha = Math.min(1, k * 1.5);
  const fs = Math.round(live.w * 0.115 * (0.8 + 0.2 * k));
  ctx.font = `900 italic ${fs}px ${DISPLAY}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineWidth = fs * 0.13; ctx.strokeStyle = '#1a2a52'; ctx.strokeText(text, live.w / 2, y);
  const g = ctx.createLinearGradient(0, y - fs / 2, 0, y + fs / 2); g.addColorStop(0, '#fff3c0'); g.addColorStop(1, '#f4bc4a');
  ctx.fillStyle = g; ctx.fillText(text, live.w / 2, y);
  if (sub) { ctx.font = `700 ${fz(32)}px ${FONT}`; ctx.fillStyle = '#fff4de'; ctx.lineWidth = 6; ctx.strokeStyle = '#1a2a52'; ctx.strokeText(sub, live.w / 2, y + fs * 0.75); ctx.fillText(sub, live.w / 2, y + fs * 0.75); }
  ctx.restore();
}

// the Think card: title, text, a button
export function thinkRects(L) {
  const w = Math.min(live.w - L.xl - (live.w - L.xr) - 24, 640), x = Math.round((live.w - w) / 2);
  return { x, w, y: 0 };
}
function drawThink(ctx, L, G) {
  const t = G.think, R = thinkRects(L), sc = TEXT_SCALES[G.settings.textIdx];
  const fs = Math.round(26 * Math.min(sc, 2));
  ctx.font = `400 ${fs}px ${FONT}`;
  const lines = wrapLines(ctx, t.text, R.w - 60);
  const h = 70 + fs * 1.35 * lines.length + 20 + 20 + Math.max(64, minHit());
  const y = Math.min(live.h - host.b - h - 12, L.land ? live.h * 0.3 : L.yb - h - 20);
  panel(ctx, R.x, y, R.w, h, { r: 26, fill: 'rgba(255,244,222,0.97)', stroke: 'rgba(34,56,107,0.6)' });
  ctx.fillStyle = C.vermDark; ctx.font = `800 ${Math.round(34 * Math.min(sc, 1.5))}px ${DISPLAY}`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillText(t.title, R.x + R.w / 2, y + 52);
  ctx.fillStyle = C.ink; ctx.font = `400 ${fs}px ${FONT}`; ctx.textAlign = 'left';
  lines.forEach((l, i) => ctx.fillText(l, R.x + 30, y + 90 + i * fs * 1.35));
  const bH = Math.max(64, minHit()), btn = { x: R.x + R.w / 2 - 130, y: y + h - 16 - bH, w: 260, h: bH };
  drawButton(ctx, btn, 'Got it', { primary: true, size: 30 });
  G.thinkRects = { close: btn, panel: { x: R.x, y, w: R.w, h } };
}
// the hit-test rect list for the Watch panel buttons (shared with game.js)
export function watchLayout(L) {
  const land = L.land;
  const w = Math.min(live.w - 24, land ? 640 : 660), x = Math.round((live.w - w) / 2);
  const bh0 = land ? 60 : 70, bh = Math.max(bh0, minHit()), ph = (land ? 262 : 396) + (bh - bh0);
  const y = live.h - host.b - ph - 10;
  const by = y + ph - bh - 14;
  const bw = land ? 130 : 150;
  return {
    panel: { x, y, w, h: ph }, land,
    pause: { x: x + 16, y: by, w: bw, h: bh }, less: { x: x + 16 + bw + 12, y: by, w: 100, h: bh }, more: { x: x + 16 + bw + 12 + 112, y: by, w: 100, h: bh }, exit: { x: x + w - 16 - bw, y: by, w: bw, h: bh },
  };
}
export function watchHit(L, px, py) {
  const W = watchLayout(L);
  const inR = (r) => px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
  if (inR(W.pause)) return 0; if (inR(W.less)) return 1; if (inR(W.more)) return 2; if (inR(W.exit)) return 3;
  return -1;
}
function drawWatch(ctx, L, G, s) {
  const W = watchLayout(L), w = G.watch;
  panel(ctx, W.panel.x, W.panel.y, W.panel.w, W.panel.h, { r: 26, fill: 'rgba(14,24,52,0.93)', stroke: 'rgba(255,227,106,0.6)' });
  const px = W.panel.x + 22, pw = W.panel.w - 44;
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  const sc = TEXT_SCALES[G.settings.textIdx];
  ctx.fillStyle = '#ffe36a'; ctx.font = `800 ${fz(28)}px ${FONT}`;
  const phase = !s.hold ? 'WATCHING' : w.phase === 'think' ? `THINK  ${Math.ceil(Math.max(0, w.timer))}s` : w.phase === 'reveal' ? `REVEAL  ${Math.ceil(Math.max(0, w.timer))}s` : 'ACT';
  ctx.fillText(w.paused ? `${phase}  (paused)` : phase, px, W.panel.y + 44);
  // progress
  const total = w.phase === 'think' ? THINK_STEPS[G.settings.thinkIdx] : 2;
  if (s.hold) { ctx.fillStyle = 'rgba(255,244,222,0.2)'; roundPath(ctx, px, W.panel.y + 58, pw, 12, 6); ctx.fill(); ctx.fillStyle = '#ffe36a'; roundPath(ctx, px, W.panel.y + 58, pw * clamp(1 - w.timer / total, 0, 1), 12, 6); ctx.fill(); }
  const info = w.info;
  ctx.fillStyle = '#fff4de'; const fs = Math.round(24 * Math.min(sc, 1.8)); ctx.font = `700 ${fs}px ${FONT}`;
  if (info) {
    ctx.fillText(info.title, px, W.panel.y + 104);
    ctx.font = `400 ${Math.round(fs * 0.92)}px ${FONT}`;
    const room = Math.max(1, Math.floor((W.pause.y - (W.panel.y + 118)) / (fs * 1.2)));
    const lines = wrapLines(ctx, info.text, pw).slice(0, Math.min(5, room));
    lines.forEach((l, i) => ctx.fillText(l, px, W.panel.y + 136 + i * fs * 1.2));
  } else { ctx.font = `400 ${fs}px ${FONT}`; ctx.fillText('Two computer teams are playing. The match stops at each key decision.', px, W.panel.y + 108); }
  drawButton(ctx, W.pause, w.paused ? 'Resume' : 'Pause', { primary: true, size: 26 });
  drawButton(ctx, W.less, 'Think −', { dark: true, size: 22 });
  drawButton(ctx, W.more, 'Think +', { dark: true, size: 22 });
  drawButton(ctx, W.exit, 'Exit', { dark: true, size: 26 });
}

export function renderFallback() {}
export { paintButton, kAt, advise, bestPass };
