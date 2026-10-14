// The play screen: the court scene (backdrop, players, peteca, effects), the strike gauge, the HUD, the four pads and the cards.
// Pure drawing; game.js owns state.
import { W, H, TEXT_SCALES, THINK_STEPS, playLayout, clamp } from './layout.js';
import { FONT, DISPLAY, roundPath, paintButton, drawButton, wrapLines } from './ui.js';
import { makeCam, drawBackdrop, drawAmbient, drawPeteca, drawShadow, drawFx, PETECAS, COURTS, FX } from './art.js';
import { drawPerson } from './figure.js';
import { SHOTS, SHOT_ORDER, padShots, gradeFor, shotAvailable, ready, NET, COURT, RIVALS } from './sim.js';

const TAU = Math.PI * 2;
const ABBR = { lob: 'Lob', drive: 'Drv', drop: 'Drp', smash: 'Smsh' };
const ZONE = { lob: '#ffb54a', drive: '#38d6b9', drop: '#a98cff', smash: '#ff6a5a', set: '#ffb54a' };

export const layoutOf = (state) => playLayout(Math.min(TEXT_SCALES[state.settings.textIdx], 1.6), !!state.run && state.run.mode === 'watch');

// camera smoothing lives here (presentation only: it never feeds back into the sim)
const CAM = { x: 6, t: -1 };
export function resetCam() { CAM.x = 6; CAM.t = -1; }
export function camFor(state, run, L = layoutOf(state)) {
  const humans = run.players.filter((p) => p.team === 0);
  const hx = humans.reduce((a, p) => a + p.x, 0) / humans.length;
  const probe = makeCam(L.stage, 6);
  // keep your side's players and the peteca in view; if both cannot fit follow the peteca with a bias to your end
  const live = run.ball.alive || run.phase === 'point';
  const xs = humans.map((p) => p.x); if (live) xs.push(run.ball.x);
  const lo = Math.min(...xs) - 1.6, hi = Math.max(...xs) + 1.1;
  let target = (hi - lo) <= probe.visW ? (lo + hi) / 2 : (live ? run.ball.x * 0.6 + hx * 0.4 : hx + 2.5);
  target = clamp(Math.min(target, Math.min(...humans.map((p) => p.x)) - 1.6 + probe.visW / 2), 0, COURT);
  const dt = CAM.t < 0 ? 1 : clamp(state.t - CAM.t, 0, 0.1);
  CAM.t = state.t;
  CAM.x += (target - CAM.x) * (CAM.t >= 0 && dt >= 1 ? 1 : Math.min(1, dt * 3.2));
  return makeCam(L.stage, CAM.x);
}

// ---- small icons ---------------------------------------------------------------------------------------------------------------
export function icon(ctx, kind, cx, cy, s, col) {
  ctx.save(); ctx.translate(cx, cy); ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = Math.max(2, s * 0.12); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const arrowHead = (x, y, a) => { ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-s * 0.2, -s * 0.12); ctx.lineTo(-s * 0.2, s * 0.12); ctx.closePath(); ctx.fill(); ctx.restore(); };
  if (kind === 'lob') { ctx.beginPath(); ctx.moveTo(-s * 0.5, s * 0.3); ctx.quadraticCurveTo(-s * 0.1, -s * 0.9, s * 0.45, s * 0.2); ctx.stroke(); arrowHead(s * 0.47, s * 0.26, 1.2); }
  else if (kind === 'drive') { ctx.beginPath(); ctx.moveTo(-s * 0.5, s * 0.05); ctx.lineTo(s * 0.32, -s * 0.08); ctx.stroke(); arrowHead(s * 0.5, -s * 0.1, -0.15); ctx.lineWidth = Math.max(1.5, s * 0.07); ctx.beginPath(); ctx.moveTo(-s * 0.45, s * 0.28); ctx.lineTo(s * 0.1, s * 0.2); ctx.stroke(); }
  else if (kind === 'drop') { ctx.beginPath(); ctx.moveTo(-s * 0.5, s * 0.1); ctx.quadraticCurveTo(-s * 0.15, -s * 0.5, s * 0.1, s * 0.05); ctx.stroke(); ctx.beginPath(); ctx.moveTo(s * 0.3, -s * 0.5); ctx.lineTo(s * 0.3, s * 0.5); ctx.lineWidth = Math.max(1.5, s * 0.06); ctx.setLineDash([s * 0.12, s * 0.1]); ctx.stroke(); }
  else if (kind === 'smash') { ctx.beginPath(); ctx.moveTo(-s * 0.4, -s * 0.5); ctx.lineTo(s * 0.35, s * 0.35); ctx.stroke(); arrowHead(s * 0.48, s * 0.48, 0.8); ctx.beginPath(); ctx.arc(-s * 0.45, -s * 0.52, s * 0.1, 0, TAU); ctx.fill(); }
  else if (kind === 'set') { ctx.beginPath(); ctx.moveTo(-s * 0.5, s * 0.3); ctx.quadraticCurveTo(-s * 0.1, -s * 0.6, s * 0.25, s * 0.0); ctx.stroke(); arrowHead(s * 0.28, s * 0.03, 0.9); ctx.beginPath(); ctx.arc(s * 0.46, s * 0.2, s * 0.12, 0, TAU); ctx.fill(); }
  else if (kind === 'pause') { ctx.fillRect(-s * 0.3, -s * 0.38, s * 0.22, s * 0.76); ctx.fillRect(s * 0.08, -s * 0.38, s * 0.22, s * 0.76); }
  else if (kind === 'bulb') { ctx.beginPath(); ctx.arc(0, -s * 0.12, s * 0.38, 0, TAU); ctx.fill(); ctx.fillRect(-s * 0.2, s * 0.26, s * 0.4, s * 0.12); ctx.fillRect(-s * 0.14, s * 0.42, s * 0.28, s * 0.1); }
  ctx.restore();
}

// ---- the scene -------------------------------------------------------------------------------------------------------------------
export function drawScene(ctx, state, run, cam) {
  const st = cam.stage, s = cam.s, b = run.ball;
  drawBackdrop(ctx, cam, run.court ?? 0);
  drawAmbient(ctx, cam, run.court ?? 0, state.t);
  ctx.save(); ctx.beginPath(); ctx.rect(st.x, st.y, st.w, st.h); ctx.clip();
  const gy = cam.gy + 0.04 * s;
  // shadow of the peteca on the sand
  const bz = Math.max(0, b.z), sh = clamp(1 - bz / 7, 0.25, 1);
  drawShadow(ctx, cam.X(b.x), gy + 0.03 * s, s * 0.17 * (1.1 - sh * 0.4), s * 0.045, 0.12 + 0.2 * sh);
  // landing marker (feedback after a strike, or the Think hint)
  const mk = state.land;
  if (mk && mk.t < 1.3) {
    const a = 1 - mk.t / 1.3;
    ctx.save(); ctx.globalAlpha = 0.8 * a; ctx.strokeStyle = mk.col; ctx.lineWidth = Math.max(2, s * 0.045);
    ctx.beginPath(); ctx.ellipse(cam.X(mk.x), gy + 0.05 * s, s * 0.42 * (1 + (1 - a) * 0.2), s * 0.11, 0, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cam.X(mk.x) - s * 0.12, gy + 0.05 * s); ctx.lineTo(cam.X(mk.x) + s * 0.12, gy + 0.05 * s); ctx.stroke(); ctx.restore();
  }
  if (state.think && state.think.adv && state.think.adv.landX !== undefined) {
    const x = cam.X(state.think.adv.landX), pulse = 0.65 + 0.35 * Math.sin(state.t * 8);
    ctx.save(); ctx.globalAlpha = pulse; ctx.strokeStyle = '#ffe36a'; ctx.lineWidth = Math.max(3, s * 0.06);
    ctx.beginPath(); ctx.ellipse(x, gy + 0.05 * s, s * 0.5, s * 0.13, 0, 0, TAU); ctx.stroke(); ctx.restore();
  }
  // players: far side first
  const order = run.players.map((p, i) => i).sort((a, c) => run.players[c].team - run.players[a].team || run.players[a].x - run.players[c].x);
  for (const i of order) {
    const p = run.players[i];
    drawPerson(ctx, { x: cam.X(p.x), gy, s, f: p.dir, look: p.prof.look, run: p.run, v: p.v, ready: p.ready, anim: p.anim, jump: p.z, t: state.t, wx: p.x, ball: b.alive ? { x: b.x, z: b.z } : null, alpha: 1 });
  }
  // who am I playing (doubles): a small marker above the controlled player
  if (run.recv >= 0 && run.players[run.recv] && run.players[run.recv].human && run.phase !== 'point' && !state.paused) {
    const p = run.players[run.recv], x = cam.X(p.x), y = gy - 2.15 * s + Math.sin(state.t * 6) * 3;
    ctx.fillStyle = '#ffd23c'; ctx.strokeStyle = 'rgba(20,30,50,0.7)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x - s * 0.13, y - s * 0.16); ctx.lineTo(x + s * 0.13, y - s * 0.16); ctx.lineTo(x, y + s * 0.02); ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  // trail
  const tr = state.trail;
  if (tr && tr.length > 1) {
    for (let i = 1; i < tr.length; i++) {
      const a = tr[i - 1], c = tr[i], k = i / tr.length;
      ctx.strokeStyle = c.spin ? `rgba(255,236,150,${0.6 * k})` : `rgba(255,255,255,${0.35 * k})`;
      ctx.lineWidth = Math.max(1.5, s * 0.07 * k); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(cam.X(a.x), cam.Y(a.z)); ctx.lineTo(cam.X(c.x), cam.Y(c.z)); ctx.stroke();
    }
  }
  // the peteca itself, base first
  const ang = Math.atan2(b.vz, b.vx);
  const held = b.held;
  const showAng = held ? Math.PI / 2 : (b.alive || b.falling ? (b.tumble > 0 ? b.ang : ang) : Math.PI / 2 * 0.9);
  const guide = run.power && run.recv >= 0 && run.players[run.recv] && run.players[run.recv].human;
  if (guide) { const gx = cam.X(b.x), gz = cam.Y(b.z), r = s * 0.55 * (0.9 + 0.1 * Math.sin(state.t * 10)); const g = ctx.createRadialGradient(gx, gz, 1, gx, gz, r); g.addColorStop(0, 'rgba(255,220,90,0.7)'); g.addColorStop(1, 'rgba(255,160,40,0)'); ctx.fillStyle = g; ctx.fillRect(gx - r, gz - r, r * 2, r * 2); }
  drawPeteca(ctx, cam.X(b.x), cam.Y(b.z), s, showAng, state.record.petecaSel ?? 0, state.t, 1, !!b.spin && b.alive);
  drawFx(ctx, cam, state.fx);
  // world-anchored words
  for (const p of state.pops) {
    const k = p.t / p.max, a = Math.min(1, (1 - k) * 2.2);
    ctx.save(); ctx.globalAlpha = a; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const sz = Math.round(p.size * Math.max(0.8, Math.min(1.3, s / 80)));
    ctx.font = `800 ${sz}px ${DISPLAY}`; ctx.lineWidth = Math.max(4, sz * 0.2); ctx.lineJoin = 'round'; ctx.strokeStyle = 'rgba(8,24,40,0.85)';
    const y = cam.Y(p.z) - k * s * 0.9, x = keepOnScreen(ctx, cam.X(p.x), p.text);
    ctx.strokeText(p.text, x, y); ctx.fillStyle = p.col; ctx.fillText(p.text, x, y);
    ctx.restore();
  }
  ctx.restore();
}

// ---- the strike gauge ----------------------------------------------------------------------------------------------------------
// A slim ruler at the left edge of the court: one colour per stroke (the pads carry the same colour), the best height of each
// stroke marked on it and an arrow that follows the peteca while it is yours to strike.
function drawGauge(ctx, cam, run, state, L) {
  const st = cam.stage, s = cam.s, gx = st.x + 26 + (L.land ? 4 : 0), gy = cam.gy + 0.04 * s, top = 2.75;
  const live = ready(run), b = run.ball;
  ctx.save();
  roundPath(ctx, gx - 15, gy - top * s - 12, 46, top * s + 24, 15); ctx.fillStyle = 'rgba(10,30,50,0.34)'; ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(gx + 8, gy); ctx.lineTo(gx + 8, gy - top * s); ctx.stroke();
  for (const sh of SHOT_ORDER) {
    const S = SHOTS[sh], y = gy - S.zi * s;
    ctx.fillStyle = ZONE[sh]; roundPath(ctx, gx + 2, y - 7, 18, 14, 4); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 1.5; ctx.stroke();
  }
  if (b.alive && b.vz < 1.2 && (live || run.recv >= 0 && run.players[run.recv] && run.players[run.recv].human)) {
    const y = gy - clamp(b.z, 0, top) * s;
    ctx.fillStyle = live ? '#ffffff' : 'rgba(255,255,255,0.55)';
    ctx.beginPath(); ctx.moveTo(gx - 10, y - 8); ctx.lineTo(gx + 3, y); ctx.lineTo(gx - 10, y + 8); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
  void state;
}

// ---- HUD -----------------------------------------------------------------------------------------------------------------------
function drawScore(ctx, L, state, run) {
  const r = L.score, fs = L.fs;
  ctx.save();
  roundPath(ctx, r.x, r.y + 5, r.w, r.h, 24); ctx.fillStyle = 'rgba(6,20,36,0.4)'; ctx.fill();
  roundPath(ctx, r.x, r.y, r.w, r.h, 24);
  const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h); g.addColorStop(0, 'rgba(18,48,76,0.94)'); g.addColorStop(1, 'rgba(10,30,52,0.94)');
  ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,214,120,0.6)'; ctx.stroke();
  const cx = r.x + r.w / 2;
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  if (run.mode === 'rally') {
    ctx.fillStyle = '#ffe9b0'; ctx.font = `700 ${fs.small}px ${FONT}`; ctx.fillText('BEACH RALLY', cx, r.y + fs.small * 1.35);
    ctx.fillStyle = '#ffffff'; ctx.font = `800 ${fs.big}px ${DISPLAY}`; ctx.fillText(String(run.streak), cx - r.w * 0.2, r.y + r.h * 0.78);
    ctx.fillStyle = '#ffd23c'; ctx.fillText(String(run.points), cx + r.w * 0.2, r.y + r.h * 0.78);
    ctx.font = `700 ${fs.small}px ${FONT}`; ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillText('strikes', cx - r.w * 0.2, r.y + r.h * 0.78 + fs.small * 1.15); ctx.fillText('points', cx + r.w * 0.2, r.y + r.h * 0.78 + fs.small * 1.15);
  } else {
    const names = run.format === 'doubles' ? ['YOU + LIA', `${run.players[2].prof.name} + ${run.players[3].prof.name}`.toUpperCase()] : [run.mode === 'watch' ? 'THE GAME' : 'YOU', run.players[run.players.length - 1].prof.name.toUpperCase()];
    ctx.font = `700 ${fs.small}px ${FONT}`;
    ctx.fillStyle = run.server === 0 ? '#ffd23c' : 'rgba(255,255,255,0.8)'; ctx.fillText((run.server === 0 ? '● ' : '') + names[0], r.x + r.w * 0.24, r.y + fs.small * 1.4);
    ctx.fillStyle = run.server === 1 ? '#ffd23c' : 'rgba(255,255,255,0.8)'; ctx.fillText((run.server === 1 ? '● ' : '') + names[1], r.x + r.w * 0.76, r.y + fs.small * 1.4);
    ctx.fillStyle = '#ffffff'; ctx.font = `800 ${fs.big}px ${DISPLAY}`;
    ctx.fillText(String(run.score[0]), r.x + r.w * 0.24, r.y + r.h * 0.84);
    ctx.fillText(String(run.score[1]), r.x + r.w * 0.76, r.y + r.h * 0.84);
    ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.font = `700 ${Math.round(fs.big * 0.6)}px ${FONT}`; ctx.fillText('–', cx, r.y + r.h * 0.8);
    ctx.font = `600 ${Math.max(fs.small - 2, 11)}px ${FONT}`; ctx.fillStyle = 'rgba(255,233,176,0.8)';
    ctx.fillText(`to ${run.to}`, cx, r.y + fs.small * 1.4);
  }
  ctx.restore();
}

function drawStat(ctx, L, state, run) {
  const r = L.stat, fs = L.fs, p = run.flow;
  ctx.save();
  roundPath(ctx, r.x, r.y, r.w, r.h, r.h / 2); ctx.fillStyle = 'rgba(8,26,44,0.5)'; ctx.fill();
  const y = r.y + r.h / 2, pad = 14;
  // flow pips
  const w = run.wind, wt = Math.abs(w) < 0.12 ? 'Calm' : `${w > 0 ? '→' : '←'} ${Math.abs(w).toFixed(1)}`;
  const mid = run.format === 'doubles' && run.lastTeam === 0 && run.phase !== 'point' ? `Touch ${run.touches}/3` : `Rally ${run.rally}`;
  const right = `${mid}  ·  Wind ${wt}`, label = run.power ? 'POWER PALM' : 'FLOW';
  let f = fs.stat;
  ctx.textBaseline = 'middle';
  const need = (sz) => { ctx.font = `800 ${sz}px ${FONT}`; const a = ctx.measureText(label).width + 3 * sz * 0.95 + 18; ctx.font = `700 ${sz}px ${FONT}`; return a + ctx.measureText(right).width + pad * 2 + 8; };
  while (need(f) > r.w && f > 11) f -= 1;
  let x = r.x + pad;
  ctx.textAlign = 'left'; ctx.font = `800 ${f}px ${FONT}`; ctx.fillStyle = run.power ? '#ffd23c' : 'rgba(255,255,255,0.8)';
  ctx.fillText(label, x, y); x += ctx.measureText(label).width + 10;
  for (let i = 0; i < 3; i++) {
    const on = run.power || p > i;
    ctx.beginPath(); ctx.arc(x + f * 0.4, y, f * 0.36, 0, TAU);
    if (on) { const g = ctx.createRadialGradient(x + f * 0.3, y - 3, 1, x + f * 0.4, y, f * 0.4); g.addColorStop(0, '#fff6c0'); g.addColorStop(1, run.power ? '#ff8a1c' : '#ffc83c'); ctx.fillStyle = g; ctx.fill(); }
    else { ctx.fillStyle = 'rgba(255,255,255,0.14)'; ctx.fill(); }
    x += f * 0.95;
  }
  ctx.textAlign = 'right'; ctx.fillStyle = 'rgba(255,255,255,0.88)'; ctx.font = `700 ${f}px ${FONT}`;
  ctx.fillText(right, r.x + r.w - pad, y);
  ctx.restore();
  void state;
}

function padStatus(run, shot) {
  if (!ready(run)) return { live: false, grade: null, avail: true };
  const b = run.ball, avail = shotAvailable(run, shot, b.z);
  if (!avail) return { live: true, grade: null, avail: false };
  const g = gradeFor(shot, b.z, b.spinIn ? 0.65 : 1);
  return { live: true, grade: g.grade, avail: true, dz: g.dz };
}

export function drawPads(ctx, L, state, run) {
  const shots = padShots(run), adv = state.think && state.think.adv;
  L.pads.forEach((r, k) => {
    const shot = shots[k], S = SHOTS[shot], st = padStatus(run, shot);
    const rec = adv && adv.pad === k;
    const lit = st.grade === 'perfect', warm = st.grade === 'good';
    const opts = { primary: lit, active: warm || rec, dark: !lit && !warm && !rec };
    const { dy } = paintButton(ctx, r, { ...opts, disabled: false });
    ctx.save();
    if (lit) { ctx.lineWidth = 5; ctx.strokeStyle = '#ffffff'; roundPath(ctx, r.x - 3, r.y - 3 + dy, r.w + 6, r.h + 6, 21); ctx.stroke(); }
    if (rec) { ctx.lineWidth = 5; ctx.strokeStyle = '#ffe36a'; roundPath(ctx, r.x - 4, r.y - 4 + dy, r.w + 8, r.h + 8, 22); ctx.stroke(); }
    ctx.fillStyle = ZONE[shot]; roundPath(ctx, r.x + r.w * 0.2, r.y + dy + 6, r.w * 0.6, 7, 3.5); ctx.fill();
    const live = st.live && st.avail, col = lit || warm || rec ? '#fffaf0' : live ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.62)';
    const cx = r.x + r.w / 2, big = Math.min(r.w, r.h);
    icon(ctx, shot, cx, r.y + dy + r.h * 0.3, Math.min(big * 0.36, 58), col);
    ctx.fillStyle = col; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    let sz = L.fs.pad; ctx.font = `800 ${sz}px ${FONT}`; while (ctx.measureText(S.name).width > r.w - 10 && sz > 11) { sz -= 1; ctx.font = `800 ${sz}px ${FONT}`; }
    ctx.fillText(S.name, cx, r.y + dy + r.h * 0.57);
    // the aim ruler: short ... deep
    const rx0 = r.x + r.w * 0.14, rx1 = r.x + r.w * 0.86, ry = r.y + dy + r.h * 0.78;
    ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(rx0, ry); ctx.lineTo(rx1, ry); ctx.stroke();
    for (let i = 0; i <= 4; i++) { const x = rx0 + (rx1 - rx0) * (i / 4); ctx.beginPath(); ctx.moveTo(x, ry - 5); ctx.lineTo(x, ry + 5); ctx.stroke(); }
    const aim = state.aim[k] ?? 0.55, ax = rx0 + (rx1 - rx0) * aim;
    ctx.fillStyle = rec ? '#ffe36a' : '#ffffff'; ctx.beginPath(); ctx.moveTo(ax, ry - 12); ctx.lineTo(ax + 7, ry - 22); ctx.lineTo(ax - 7, ry - 22); ctx.closePath(); ctx.fill();
    if (adv && adv.pad === k) { const dx = rx0 + (rx1 - rx0) * adv.depth; ctx.fillStyle = '#ffe36a'; ctx.beginPath(); ctx.arc(dx, ry, 6, 0, TAU); ctx.fill(); }
    { // the two end labels shrink to fit the pad (never touch each other), and drop out when there is no room at all
      let fz = Math.max(L.fs.padSub - 3, 10); ctx.font = `600 ${fz}px ${FONT}`;
      while (fz > 8 && ctx.measureText('short').width + ctx.measureText('deep').width + 10 > r.w - 8) { fz -= 1; ctx.font = `600 ${fz}px ${FONT}`; }
      if (ctx.measureText('short').width + ctx.measureText('deep').width + 10 <= r.w - 8) {
        ctx.globalAlpha = 0.8; ctx.textAlign = 'left'; ctx.fillText('short', r.x + 6, ry + 16); ctx.textAlign = 'right'; ctx.fillText('deep', r.x + r.w - 6, ry + 16); ctx.globalAlpha = 1;
      }
    }
    if (live && !st.avail) { ctx.fillStyle = 'rgba(0,0,0,0.38)'; roundPath(ctx, r.x, r.y + dy, r.w, r.h, 18); ctx.fill(); }
    ctx.restore();
  });
}

function drawTopButtons(ctx, L, state, run) {
  if (run.mode === 'watch') return;
  const { dy } = paintButton(ctx, L.pause, { dark: true });
  icon(ctx, 'pause', L.pause.x + L.pause.w / 2, L.pause.y + dy + L.pause.h / 2, Math.min(L.pause.h * 0.34, 34), '#fffaf0');
  const th = L.think, used = !!state.think;
  const q = paintButton(ctx, th, { active: used, dark: !used });
  icon(ctx, 'bulb', th.x + th.w / 2, th.y + q.dy + th.h * 0.36, Math.min(th.h * 0.3, 30), '#fffaf0');
  ctx.fillStyle = '#fffaf0'; ctx.font = `700 ${Math.max(L.fs.small, 12)}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('Think', th.x + th.w / 2, th.y + q.dy + th.h * 0.78);
}

function drawDemoBar(ctx, L, state) {
  const D = L.demo, st = state.settings;
  drawButton(ctx, D.dec, 'Think −', { dark: true, size: Math.round(L.fs.btn * 0.9), disabled: st.thinkIdx === 0 });
  drawButton(ctx, D.pause, state.paused ? 'Resume' : 'Pause', { primary: !state.paused, active: state.paused, size: L.fs.btn });
  drawButton(ctx, D.inc, 'Think +', { dark: true, size: Math.round(L.fs.btn * 0.9), disabled: st.thinkIdx === THINK_STEPS.length - 1 });
  drawButton(ctx, D.exit, 'Stop watching', { dark: true, size: L.fs.btn });
}

function drawDecision(ctx, L, state) {
  const d = state.dec; if (!d || !d.active) return;
  const st = L.stage, pad = 14, w = Math.min(st.w - 2 * pad, 640), x = st.x + (st.w - w) / 2;
  const phase = d.phase === 'think' ? 'Thinking' : d.phase === 'reveal' ? 'Choosing' : 'Striking';
  ctx.save();
  ctx.font = `600 ${Math.max(L.fs.mid, 14)}px ${FONT}`;
  const full = `${SHOTS[d.adv.shot].name}, ${d.adv.depth > 0.66 ? 'deep' : d.adv.depth < 0.34 ? 'short' : 'to the middle'}. ${d.adv.why}`;
  const lines = wrapLines(ctx, full, w - 36), lh = Math.max(L.fs.mid, 14) * 1.3;
  const h = 56 + lines.length * lh + 30, y = st.y + pad + (L.land ? 4 : 0);
  roundPath(ctx, x, y, w, h, 20); ctx.fillStyle = 'rgba(8,26,44,0.88)'; ctx.fill();
  ctx.strokeStyle = 'rgba(255,224,138,0.7)'; ctx.lineWidth = 2; ctx.stroke();
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#ffe08a'; ctx.font = `800 ${Math.max(L.fs.mid, 15)}px ${FONT}`; ctx.fillText(`${phase}…`, x + 18, y + 34);
  const k = d.phase === 'go' ? 1 : d.t / d.dur;
  roundPath(ctx, x + 18, y + 44, w - 36, 8, 4); ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fill();
  roundPath(ctx, x + 18, y + 44, Math.max(8, (w - 36) * Math.min(1, k)), 8, 4); ctx.fillStyle = d.phase === 'think' ? '#7fd1c4' : '#ffb347'; ctx.fill();
  ctx.fillStyle = '#fff6e0'; ctx.font = `600 ${Math.max(L.fs.mid, 14)}px ${FONT}`;
  lines.forEach((l, i) => ctx.fillText(l, x + 18, y + 78 + i * lh));
  ctx.restore();
}

function drawBanner(ctx, L, state) {
  const b = state.banner; if (!b) return;
  const st = L.stage, k = b.t / b.max, a = Math.min(1, (1 - k) * 3), sc = 0.8 + 0.25 * Math.min(1, k * 8);
  ctx.save(); ctx.globalAlpha = a; ctx.translate(st.x + st.w / 2, st.y + st.h * 0.3); ctx.scale(sc, sc);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const sz = Math.round(Math.min(78, st.w * 0.11));
  ctx.font = `800 ${sz}px ${DISPLAY}`; ctx.lineWidth = 12; ctx.strokeStyle = 'rgba(8,24,40,0.88)'; ctx.lineJoin = 'round'; ctx.strokeText(b.text, 0, 0);
  const g = ctx.createLinearGradient(0, -sz / 2, 0, sz / 2); g.addColorStop(0, '#fff3c4'); g.addColorStop(1, b.col || '#ff9b2b'); ctx.fillStyle = g; ctx.fillText(b.text, 0, 0);
  if (b.sub) { ctx.font = `700 ${Math.round(sz * 0.36)}px ${FONT}`; ctx.lineWidth = 6; ctx.strokeText(b.sub, 0, sz * 0.68); ctx.fillStyle = '#fff6e0'; ctx.fillText(b.sub, 0, sz * 0.68); }
  ctx.restore();
}

function drawToast(ctx, L, state) {
  if (!state.toast || state.toastT <= 0) return;
  const st = L.stage, fs = L.fs.toast, a = Math.min(1, state.toastT * 2);
  ctx.save(); ctx.globalAlpha = a; ctx.font = `700 ${fs}px ${FONT}`;
  const maxW = Math.min(st.w - 30, 640), lines = wrapLines(ctx, state.toast, maxW - 40), lh = fs * 1.3, h = lines.length * lh + 22;
  const x = st.x + st.w / 2, y = st.y + st.h - h - 14;
  roundPath(ctx, x - maxW / 2, y, maxW, h, 18); ctx.fillStyle = 'rgba(8,26,44,0.82)'; ctx.fill();
  ctx.fillStyle = '#fff6e0'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  lines.forEach((l, i) => ctx.fillText(l, x, y + 11 + lh * (i + 0.5)));
  ctx.restore();
}

// In 3D (view3d/presenter.js) the court, the players, the peteca and the sand are real 3D drawn behind this canvas; only the words that
// float in the world and the marker above the player you control stay here, placed through the 3D camera's projection.
function drawOverlay3D(ctx, state, run, g3) {
  const s = g3.s;
  if (run.recv >= 0 && run.players[run.recv] && run.players[run.recv].human && run.phase !== 'point' && !state.paused) {
    const p = run.players[run.recv], depth = run.format === 'doubles' ? (p.k === 0 ? 0.55 : -0.55) : 0;
    const [x, y0] = g3.pr(p.x, 2.12, depth), y = y0 + Math.sin(state.t * 6) * 3;
    ctx.fillStyle = '#ffd23c'; ctx.strokeStyle = 'rgba(20,30,50,0.7)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x - s * 0.13, y - s * 0.16); ctx.lineTo(x + s * 0.13, y - s * 0.16); ctx.lineTo(x, y + s * 0.02); ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  for (const p of state.pops) {
    const k = p.t / p.max, a = Math.min(1, (1 - k) * 2.2);
    ctx.save(); ctx.globalAlpha = a; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const sz = Math.round(p.size * Math.max(0.8, Math.min(1.3, s / 80)));
    ctx.font = `800 ${sz}px ${DISPLAY}`; ctx.lineWidth = Math.max(4, sz * 0.2); ctx.lineJoin = 'round'; ctx.strokeStyle = 'rgba(8,24,40,0.85)';
    const [x00, y0] = g3.pr(p.x, p.z), y = y0 - k * s * 0.9, x = keepOnScreen(ctx, x00, p.text);
    ctx.strokeText(p.text, x, y); ctx.fillStyle = p.col; ctx.fillText(p.text, x, y);
    ctx.restore();
  }
}

export function renderPlay(ctx, state) {
  const run = state.run, L = layoutOf(state), cam = camFor(state, run, L);
  const watch = run.mode === 'watch';
  const g3 = FX.gl && FX.gl.active ? FX.gl.solve(cam, { yaw: -9, pitch: 7 }) : null;
  if (g3) drawOverlay3D(ctx, state, run, g3);
  else {
    // sky behind the HUD for tall screens
    ctx.fillStyle = COURTS[run.court ?? 0].sky[0]; ctx.fillRect(0, 0, W, H);
    drawScene(ctx, state, run, cam);
  }
  if (state.settings.gauge && !watch) drawGauge(ctx, cam, run, state, L);
  if (L.land) { ctx.save(); ctx.fillStyle = 'rgba(8,26,44,0.78)'; ctx.fillRect(L.px0 - 12, 0, W - L.px0 + 12, H); ctx.restore(); }
  else {
    // a soft shade behind the top HUD so text always reads
    const g = ctx.createLinearGradient(0, 0, 0, L.stat.y + L.stat.h + 14); g.addColorStop(0, 'rgba(8,26,44,0.35)'); g.addColorStop(1, 'rgba(8,26,44,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, L.stat.y + L.stat.h + 14);
    const g2 = ctx.createLinearGradient(0, L.padTop - 30, 0, H); g2.addColorStop(0, 'rgba(8,26,44,0)'); g2.addColorStop(0.35, 'rgba(8,26,44,0.6)'); g2.addColorStop(1, 'rgba(8,26,44,0.78)'); ctx.fillStyle = g2; ctx.fillRect(0, L.padTop - 30, W, H - L.padTop + 30);
  }
  drawScore(ctx, L, state, run);
  drawStat(ctx, L, state, run);
  drawTopButtons(ctx, L, state, run);
  if (watch) drawDemoBar(ctx, L, state); else drawPads(ctx, L, state, run);
  drawDecision(ctx, L, state);
  drawBanner(ctx, L, state);
  drawToast(ctx, L, state);
  if (state.think && !watch) {
    const adv = state.think.adv, st = L.stage, w = Math.min(st.w - 28, 640);
    ctx.save(); ctx.font = `700 ${Math.max(L.fs.mid, 14)}px ${FONT}`;
    const txt = `${SHOTS[adv.shot].name}, ${adv.depth > 0.66 ? 'deep' : adv.depth < 0.34 ? 'short' : 'to the middle'}. ${adv.why}`;
    const lines = wrapLines(ctx, txt, w - 36), lh = Math.max(L.fs.mid, 14) * 1.3, h = lines.length * lh + 26;
    const x = st.x + st.w / 2 - w / 2, y = st.y + 10;
    roundPath(ctx, x, y, w, h, 18); ctx.fillStyle = 'rgba(8,26,44,0.86)'; ctx.fill(); ctx.strokeStyle = 'rgba(255,224,138,0.7)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#fff6e0'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    lines.forEach((l, i) => ctx.fillText(l, x + 18, y + 13 + lh * (i + 0.5)));
    ctx.restore();
  }
  // point result card
  if ((run.phase === 'point' || run.phase === 'over') && run.pointWhy) {
    const st = L.stage, k = Math.min(1, run.phaseT * 4 + (run.phase === 'over' ? 1 : 0));
    const won = run.phase === 'over' && run.mode === 'rally' ? false : null;
    void won;
    ctx.save(); ctx.globalAlpha = k; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const cx = st.x + st.w / 2, cy = st.y + st.h * 0.26, sz = Math.round(Math.min(64, st.w * 0.09));
    let head = run.mode === 'rally' ? 'Dropped' : (run.lastWinner === 0 ? 'Point to you' : 'Point to the rival');
    const col = run.mode === 'rally' ? '#ffd9b0' : run.lastWinner === 0 ? '#9ff0c0' : '#ffd0b0';
    ctx.font = `800 ${sz}px ${DISPLAY}`; ctx.lineWidth = 10; ctx.strokeStyle = 'rgba(8,24,40,0.88)'; ctx.lineJoin = 'round'; ctx.strokeText(head, cx, cy); ctx.fillStyle = col; ctx.fillText(head, cx, cy);
    ctx.font = `700 ${Math.round(sz * 0.38)}px ${FONT}`; ctx.lineWidth = 6; ctx.strokeText(run.pointWhy, cx, cy + sz * 0.72); ctx.fillStyle = '#fff6e0'; ctx.fillText(run.pointWhy, cx, cy + sz * 0.72);
    ctx.restore();
  }
  void NET; void RIVALS; void PETECAS;
}

// Keeps a centred word fully inside the visible canvas (it is world-anchored, so near an edge it would be cut off).
function keepOnScreen(ctx, x, text) {
  if (typeof ctx.getTransform !== 'function' || typeof ctx.measureText !== 'function' || !ctx.canvas) return x;
  const m = ctx.getTransform();
  if (!m || !(ctx.canvas.width > 0)) return x;
  const a = m.a || 1, half = ctx.measureText(text).width / 2 + 6, lo = -m.e / a + half, hi = (ctx.canvas.width - m.e) / a - half;
  return hi > lo ? Math.max(lo, Math.min(hi, x)) : x;
}

