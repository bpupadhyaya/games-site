// The play screen: the beach, the HUD chips, the rhythm bar, the DIVE button and the cards. Pure drawing; game.js owns state.
import { W, H, playLayout, TEXT_SCALES, THINK_STEPS } from './layout.js';
import { FONT, DISPLAY, roundPath, paintButton, drawButton, wrapLines } from './ui.js';
import { makeCam, proj, drawRound } from './art.js';
import { IDEAL_LO, IDEAL_HI, ordinal } from './sim.js';

const TAU = Math.PI * 2;
export const layoutOf = (state) => playLayout(Math.min(TEXT_SCALES[state.settings.textIdx], 1.6), !!state.round && state.round.auto != null && state.mode === 'watch');
export const camFor = (state, round, rect) => makeCam(rect || layoutOf(state).world, state.camX || 0, state.camZ == null ? -6 : state.camZ, 0.1);
export const RHYTHM_SPAN = 0.6;

function chipBg(ctx, r, rad = 22) { roundPath(ctx, r.x, r.y, r.w, r.h, rad); ctx.fillStyle = 'rgba(6,34,58,0.84)'; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.stroke(); }

// ---- the rhythm bar: time since your last stride; tap while the marker is in the gold window --------------------------------
function statusText(state, round) {
  const me = round.runners[round.you];
  if (!me) return '';
  if (round.over) return me.flag >= 0 ? 'SAFE' : 'OUT';
  if (!round.go) return me.phase === 'flinch' ? 'CAUTION: STAY FLAT' : 'WAIT FOR THE WHISTLE';
  if (me.phase === 'prone') return 'TAP TO SPIN UP';
  if (me.phase === 'spin') return 'UP AND GO';
  if (me.phase === 'dive' || me.phase === 'slide') return me.flag >= 0 ? 'GOT IT' : 'DIVING';
  if (me.phase === 'hold') return 'GOT IT';
  if (me.phase === 'down') return 'GET UP: TAP';
  return '';
}
function drawRhythm(ctx, L, state, round) {
  const r = L.gauge, fs = L.fs.gauge, me = round.runners[round.you];
  chipBg(ctx, r, Math.min(r.h / 2, 30));
  const pad = Math.max(16, r.h * 0.3), cy = r.y + r.h / 2;
  const txt = statusText(state, round);
  const running = round.go && me && me.phase === 'run' && !round.over;
  ctx.textBaseline = 'middle';
  if (!running) {
    ctx.fillStyle = txt === 'WAIT FOR THE WHISTLE' || txt === 'CAUTION: STAY FLAT' ? '#ffe9a0' : '#bff3ff';
    let sz = Math.round(fs * 1.15); ctx.font = `800 ${sz}px ${DISPLAY}`;
    while (ctx.measureText(txt).width > r.w - 2 * pad && sz > 11) { sz -= 1; ctx.font = `800 ${sz}px ${DISPLAY}`; }
    ctx.textAlign = 'center'; ctx.fillText(txt, r.x + r.w / 2, cy);
    return;
  }
  const lab = Math.max(11, Math.round(fs * 0.78));
  ctx.font = `700 ${lab}px ${FONT}`;
  const lw = ctx.measureText('RHYTHM').width;
  const x0 = r.x + pad + lw + 12, x1 = r.x + r.w - pad;
  ctx.fillStyle = 'rgba(190,236,255,0.92)'; ctx.textAlign = 'left'; ctx.fillText('RHYTHM', r.x + pad, cy);
  const th = Math.max(12, r.h * 0.3), u = (s) => x0 + (Math.min(RHYTHM_SPAN, s) / RHYTHM_SPAN) * (x1 - x0);
  roundPath(ctx, x0, cy - th / 2, x1 - x0, th, th / 2); ctx.fillStyle = 'rgba(255,255,255,0.14)'; ctx.fill();
  ctx.save(); roundPath(ctx, x0, cy - th / 2, x1 - x0, th, th / 2); ctx.clip();
  ctx.fillStyle = 'rgba(255,110,80,0.5)'; ctx.fillRect(x0, cy - th / 2, u(0.17) - x0, th);          // too fast: power is lost
  ctx.fillStyle = '#ffd35a'; ctx.fillRect(u(IDEAL_LO), cy - th / 2, u(IDEAL_HI) - u(IDEAL_LO), th);
  const since = Math.max(0, round.tgo - me.lastStride);
  ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.fillRect(x0, cy - th / 2, u(since) - x0, th);
  ctx.restore();
  const nx = u(since);
  ctx.fillStyle = '#ffffff'; ctx.strokeStyle = 'rgba(6,34,58,0.9)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(nx, cy - th * 0.9); ctx.lineTo(nx + th * 0.55, cy - th * 1.45); ctx.lineTo(nx - th * 0.55, cy - th * 1.45); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillRect(nx - 2, cy - th * 0.9, 4, th * 1.8);
  const fl = state.strideFlash;
  if (fl && fl.t < 0.25) { ctx.strokeStyle = fl.good ? `rgba(120,255,170,${1 - fl.t * 4})` : `rgba(255,150,120,${1 - fl.t * 4})`; ctx.lineWidth = 4; roundPath(ctx, r.x + 2, r.y + 2, r.w - 4, r.h - 4, Math.min(r.h / 2, 30)); ctx.stroke(); }
}
function drawScore(ctx, L, state, round) {
  const r = L.score, fs = L.fs, cx = r.x + r.w / 2;
  chipBg(ctx, r, 22);
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.font = `700 ${fs.small}px ${FONT}`; ctx.fillStyle = 'rgba(190,236,255,0.9)';
  const cup = state.cup;
  const head = state.mode === 'sudden' ? `SUDDEN DEATH  ·  STREAK ${cup ? cup.streak : 0}` : state.mode === 'watch' ? `WATCH & LEARN  ·  ROUND ${round.roundNo + 1}` : `ROUND ${round.roundNo + 1} OF ${cup ? cup.total : '?'}`;
  let hs = fs.small; ctx.font = `700 ${hs}px ${FONT}`;
  while (ctx.measureText(head).width > r.w - 16 && hs > 11) { hs -= 1; ctx.font = `700 ${hs}px ${FONT}`; }
  ctx.fillText(head, cx, r.y + hs * 1.2);
  const left = Math.max(0, round.m - round.claims);
  const bigSz = Math.min(fs.big, Math.max(22, r.h - fs.small * 2.8));
  ctx.fillStyle = '#fff8e6'; ctx.font = `800 ${bigSz}px ${DISPLAY}`;
  ctx.fillText(`${left} ${left === 1 ? 'FLAG' : 'FLAGS'} LEFT`, cx, r.y + hs * 1.3 + bigSz * 0.84);
  ctx.fillStyle = '#ffd35a';
  const sub = state.mode === 'watch' ? `${round.n} racers  ·  ${round.m} flags` : `${round.n} racers  ·  score ${cup ? cup.score : 0}`;
  let sz = fs.small; ctx.font = `700 ${sz}px ${FONT}`;
  while (ctx.measureText(sub).width > r.w - 20 && sz > 11) { sz -= 1; ctx.font = `700 ${sz}px ${FONT}`; }
  ctx.fillText(sub, cx, r.y + r.h - fs.small * 0.4);
}
function icon(ctx, kind, cx, cy, s, col) {
  ctx.save(); ctx.fillStyle = col; ctx.lineWidth = s * 0.16; ctx.lineCap = 'round';
  if (kind === 'pause') { ctx.fillRect(cx - s * 0.42, cy - s * 0.5, s * 0.28, s); ctx.fillRect(cx + s * 0.14, cy - s * 0.5, s * 0.28, s); }
  else if (kind === 'bulb') { ctx.beginPath(); ctx.arc(cx, cy - s * 0.12, s * 0.38, 0, TAU); ctx.fill(); ctx.fillRect(cx - s * 0.2, cy + s * 0.26, s * 0.4, s * 0.12); ctx.fillRect(cx - s * 0.14, cy + s * 0.42, s * 0.28, s * 0.1); }
  ctx.restore();
}
function drawTopButtons(ctx, L, state, round) {
  if (state.mode === 'watch') return;
  const { dy } = paintButton(ctx, L.pause, { dark: true });
  icon(ctx, 'pause', L.pause.x + L.pause.w / 2, L.pause.y + dy + L.pause.h / 2, Math.min(L.pause.h * 0.34, 34), '#fffdf4');
  const th = L.think, used = !!state.think;
  const q = paintButton(ctx, th, { active: used, dark: !used });
  icon(ctx, 'bulb', th.x + th.w / 2, th.y + q.dy + th.h * 0.36, Math.min(th.h * 0.3, 30), '#fffdf4');
  ctx.fillStyle = '#fffdf4'; ctx.font = `700 ${Math.max(L.fs.small, 12)}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('Think', th.x + th.w / 2, th.y + q.dy + th.h * 0.78);
  void round;
}
function drawDemoBar(ctx, L, state) {
  const D = L.demo, st = state.settings;
  drawButton(ctx, D.dec, 'Think −', { dark: true, size: Math.round(L.fs.btn * 0.9), disabled: st.thinkIdx === 0 });
  drawButton(ctx, D.pause, state.paused ? 'Resume' : 'Pause', { primary: !state.paused, active: state.paused, size: L.fs.btn });
  drawButton(ctx, D.inc, 'Think +', { dark: true, size: Math.round(L.fs.btn * 0.9), disabled: st.thinkIdx === THINK_STEPS.length - 1 });
  drawButton(ctx, D.exit, 'Stop watching', { dark: true, size: L.fs.btn });
}
// The DIVE band. It glows when a dive would pay off right now.
function drawDive(ctx, L, state, round, adv) {
  if (state.mode === 'watch') return;
  const r = L.dive, me = round.runners[round.you];
  const can = round.go && me && me.phase === 'run' && !round.over;
  const hot = can && adv && adv.act === 'dive';
  const { dy } = paintButton(ctx, r, { primary: can, disabled: !can && !hot, dark: false });
  ctx.save();
  if (hot) { ctx.strokeStyle = `rgba(255,255,255,${0.6 + 0.4 * Math.sin(state.t * 14)})`; ctx.lineWidth = 5; roundPath(ctx, r.x + 2, r.y + dy + 2, r.w - 4, r.h - 4, 17); ctx.stroke(); }
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const big = Math.min(Math.round(r.h * 0.42), L.fs.big * 1.1);
  ctx.fillStyle = can ? '#fffdf4' : 'rgba(40,60,80,0.6)'; ctx.font = `800 ${big}px ${DISPLAY}`;
  ctx.fillText('DIVE', r.x + r.w / 2, r.y + dy + r.h * (r.h > 90 ? 0.42 : 0.5));
  if (r.h > 90) { ctx.font = `700 ${Math.max(12, Math.round(L.fs.small))}px ${FONT}`; ctx.globalAlpha = 0.9; ctx.fillText('stretch for the flag when it is close', r.x + r.w / 2, r.y + dy + r.h * 0.76); }
  ctx.restore();
}
// Cards sit low on the screen, in the sand below the racers, so the flags at the far end of the beach are never covered.
function cardBottom(L, state) { return (L.land ? L.world.h - 14 : (state.mode === 'watch' ? L.barTop : L.dive.y)) - 8; }
const cardH = (L, n) => 40 + n * Math.max(L.fs.mid, 14) * 1.28 + 14;
function card(ctx, L, yBottom, w, lines, head, bar, col) {
  const fz = Math.max(L.fs.mid, 14), lh = fz * 1.28, h = cardH(L, lines.length), y = yBottom - h;
  const x = L.world.x + (L.world.w - w) / 2;
  roundPath(ctx, x, y, w, h, 20); ctx.fillStyle = 'rgba(6,34,58,0.92)'; ctx.fill(); ctx.strokeStyle = 'rgba(255,225,130,0.75)'; ctx.lineWidth = 2; ctx.stroke();
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#ffd35a'; ctx.font = `800 ${Math.max(L.fs.mid * 0.95, 14)}px ${FONT}`; ctx.fillText(head, x + 18, y + 27);
  if (bar != null) {
    roundPath(ctx, x + 18, y + 33, w - 36, 6, 3); ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fill();
    roundPath(ctx, x + 18, y + 33, Math.max(6, (w - 36) * Math.min(1, bar)), 6, 3); ctx.fillStyle = col; ctx.fill();
  }
  ctx.fillStyle = '#fff8e6'; ctx.font = `600 ${fz}px ${FONT}`;
  lines.forEach((l, i) => ctx.fillText(l, x + 18, y + 40 + fz * 1.05 + i * lh));
}
function drawDecision(ctx, L, state, round) {
  const d = state.dec; if (!d || !d.active) return;
  if (!round.go) return;                                   // before the whistle the three-step coach strip speaks instead
  const w = Math.min(L.world.w - 28, 640);
  ctx.save(); ctx.font = `600 ${Math.max(L.fs.mid, 14)}px ${FONT}`;
  const lines = wrapLines(ctx, d.adv.why, w - 36);
  const phase = d.phase === 'think' ? 'Reading the beach' : d.phase === 'reveal' ? "Coach's pick" : 'Now!';
  const k = d.phase === 'go' ? 1 : d.t / d.dur;
  card(ctx, L, cardBottom(L, state), w, lines, phase, k, d.phase === 'think' ? '#7fd1e4' : '#ffb347');
  ctx.restore();
}
// First-time explanation: three steps with icons, shown before the whistle (and until the first spin of the first rounds).
function stepIcon(ctx, kind, cx, cy, s) {
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (kind === 0) {                       // a racer lying face down, head away from the flags (flags drawn up at the far end)
    ctx.fillStyle = '#ffd35a'; ctx.beginPath(); ctx.arc(cx, cy + s * 0.34, s * 0.12, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fffdf4'; roundPath(ctx, cx - s * 0.11, cy - s * 0.3, s * 0.22, s * 0.58, s * 0.1); ctx.fill();
    ctx.strokeStyle = '#ffd35a'; ctx.lineWidth = s * 0.07; ctx.beginPath(); ctx.moveTo(cx + s * 0.46, cy + s * 0.32); ctx.lineTo(cx + s * 0.46, cy - s * 0.38); ctx.moveTo(cx + s * 0.34, cy - s * 0.24); ctx.lineTo(cx + s * 0.46, cy - s * 0.4); ctx.lineTo(cx + s * 0.58, cy - s * 0.24); ctx.stroke();
  } else if (kind === 1) {                // whistle + tap
    ctx.fillStyle = '#e4e9ef'; ctx.beginPath(); ctx.arc(cx + s * 0.08, cy + s * 0.04, s * 0.26, 0, TAU); ctx.fill();
    ctx.fillRect(cx - s * 0.5, cy - s * 0.12, s * 0.5, s * 0.24);
    ctx.fillStyle = '#06223a'; ctx.beginPath(); ctx.arc(cx + s * 0.1, cy + s * 0.04, s * 0.08, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#ffd35a'; ctx.lineWidth = s * 0.07;
    for (let j = 0; j < 2; j++) { ctx.beginPath(); ctx.arc(cx + s * 0.1, cy + s * 0.04, s * (0.42 + 0.16 * j), -0.9, 0.0); ctx.stroke(); }
  } else {                                // a flag on a pole in the sand
    ctx.strokeStyle = '#fffdf4'; ctx.lineWidth = s * 0.08; ctx.beginPath(); ctx.moveTo(cx - s * 0.2, cy + s * 0.46); ctx.lineTo(cx - s * 0.2, cy - s * 0.5); ctx.stroke();
    ctx.fillStyle = '#ff7a1a'; ctx.beginPath(); ctx.moveTo(cx - s * 0.2, cy - s * 0.5); ctx.lineTo(cx + s * 0.5, cy - s * 0.25); ctx.lineTo(cx - s * 0.2, cy); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#d9bf88'; ctx.beginPath(); ctx.ellipse(cx - s * 0.2, cy + s * 0.48, s * 0.4, s * 0.1, 0, 0, TAU); ctx.fill();
  }
  ctx.restore();
}
const COACH_STEPS = [['1', 'Lie flat', 'head away from the flags'], ['2', 'Whistle: tap', 'spin and get up'], ['3', 'Run: grab a flag', 'one fewer than racers']];
function coachWanted(state, round) {
  const me = round.runners[round.you];
  if (!me || round.over || state.pauseMenu) return false;
  if (round.go && !(me.phase === 'prone' && round.tgo < 3)) return false;
  return state.mode === 'watch' || round.roundNo < 2;
}
function drawCoach(ctx, L, state, round) {
  if (!coachWanted(state, round)) return;
  const wd = L.world, w = Math.min(wd.w - 20, 700), h = Math.round(Math.max(92, L.fs.small * 5.2)), x = wd.x + (wd.w - w) / 2, y = cardBottom(L, state) - h;
  const cw = w / 3;
  ctx.save();
  roundPath(ctx, x, y, w, h, 20); ctx.fillStyle = 'rgba(6,34,58,0.9)'; ctx.fill(); ctx.strokeStyle = 'rgba(255,225,130,0.75)'; ctx.lineWidth = 2; ctx.stroke();
  const ico = Math.min(h * 0.4, 40), fs = Math.max(12, Math.round(L.fs.small * 0.95));
  COACH_STEPS.forEach((st, i) => {
    const cx = x + cw * (i + 0.5);
    const on = !round.go ? (i === 0) : (i === 1);
    if (on) { roundPath(ctx, x + cw * i + 5, y + 5, cw - 10, h - 10, 16); ctx.fillStyle = 'rgba(255,211,90,0.16)'; ctx.fill(); }
    stepIcon(ctx, i, cx, y + h * 0.3, ico * (on ? 1 + 0.06 * Math.sin(state.t * 8) : 1));
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#ffd35a'; ctx.font = `800 ${fs}px ${FONT}`;
    let t1 = `${st[0]}. ${st[1]}`, z = fs; while (ctx.measureText(t1).width > cw - 10 && z > 10) { z--; ctx.font = `800 ${z}px ${FONT}`; }
    ctx.fillText(t1, cx, y + h * 0.72);
    ctx.fillStyle = '#fff8e6'; ctx.font = `600 ${Math.max(10, fs - 2)}px ${FONT}`; let z2 = fs - 2;
    while (ctx.measureText(st[2]).width > cw - 10 && z2 > 9) { z2--; ctx.font = `600 ${z2}px ${FONT}`; }
    ctx.fillText(st[2], cx, y + h * 0.72 + fs * 1.05);
  });
  ctx.restore();
}
function drawBanner(ctx, L, state) {
  const b = state.banner; if (!b) return;
  const wd = L.world, k = b.t / b.max, a = Math.min(1, (1 - k) * 3), sc = 0.8 + 0.25 * Math.min(1, k * 8);
  ctx.save(); ctx.globalAlpha = a; ctx.translate(wd.x + wd.w / 2, wd.y + wd.h * 0.4); ctx.scale(sc, sc);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const sz = Math.round(Math.min(92, wd.w * 0.13) * (TEXT_SCALES[state.settings.textIdx] > 1.5 ? 1 : 1.05));
  ctx.font = `800 ${sz}px ${DISPLAY}`; ctx.lineWidth = 12; ctx.strokeStyle = 'rgba(4,26,46,0.9)'; ctx.lineJoin = 'round'; ctx.strokeText(b.text, 0, 0);
  const g = ctx.createLinearGradient(0, -sz / 2, 0, sz / 2); g.addColorStop(0, '#fffbd0'); g.addColorStop(1, b.col || '#ff9a3a'); ctx.fillStyle = g; ctx.fillText(b.text, 0, 0);
  if (b.sub) { ctx.font = `700 ${Math.round(sz * 0.36)}px ${FONT}`; ctx.lineWidth = 6; ctx.strokeText(b.sub, 0, sz * 0.68); ctx.fillStyle = '#fff8e6'; ctx.fillText(b.sub, 0, sz * 0.68); }
  ctx.restore();
}
function drawToast(ctx, L, state) {
  if (!state.toast || state.toastT <= 0) return;
  const wd = L.world, fs = L.fs.toast, a = Math.min(1, state.toastT * 2);
  ctx.save(); ctx.globalAlpha = a; ctx.font = `700 ${fs}px ${FONT}`;
  const maxW = Math.min(wd.w - 30, 640), lines = wrapLines(ctx, state.toast, maxW - 40), lh = fs * 1.3, h = lines.length * lh + 22;
  const x = wd.x + wd.w / 2, y = cardBottom(L, state) - 110 - h - (state.think || state.dec ? 70 : 0);
  roundPath(ctx, x - maxW / 2, y, maxW, h, 18); ctx.fillStyle = 'rgba(6,34,58,0.86)'; ctx.fill();
  ctx.fillStyle = '#fff8e6'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  lines.forEach((l, i) => ctx.fillText(l, x, y + 11 + lh * (i + 0.5)));
  ctx.restore();
}
// "Lie flat" before the whistle, and a flash of GO! right after it.
function drawCue(ctx, L, state, round) {
  const wd = L.world;
  if (!round.go) {
    const me = round.runners[round.you];
    if (round.count > 0.9 || !me) return;
    ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const sz = Math.round(Math.min(64, wd.w * 0.09)), pulse = 0.6 + 0.4 * Math.sin(state.t * 10);
    ctx.globalAlpha = 0.55 + 0.45 * pulse; ctx.font = `800 ${sz}px ${DISPLAY}`; ctx.lineWidth = 10; ctx.lineJoin = 'round'; ctx.strokeStyle = 'rgba(4,26,46,0.85)';
    ctx.strokeText('ready…', wd.x + wd.w / 2, wd.y + wd.h * 0.4); ctx.fillStyle = '#ffe9a0'; ctx.fillText('ready…', wd.x + wd.w / 2, wd.y + wd.h * 0.4);
    ctx.restore();
    return;
  }
  if (round.tgo > 0.8) return;
  const k = round.tgo / 0.8, sz = Math.round(Math.min(150, wd.w * 0.21)), sc = 1 + 0.25 * (1 - Math.min(1, k * 3));
  ctx.save(); ctx.globalAlpha = Math.max(0, 1 - k); ctx.translate(wd.x + wd.w / 2, wd.y + wd.h * 0.36); ctx.scale(sc, sc);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `800 ${sz}px ${DISPLAY}`; ctx.lineJoin = 'round'; ctx.lineWidth = 16; ctx.strokeStyle = 'rgba(4,26,46,0.9)'; ctx.strokeText('GO!', 0, 0);
  const g = ctx.createLinearGradient(0, -sz / 2, 0, sz / 2); g.addColorStop(0, '#f4ffd0'); g.addColorStop(1, '#3fd96b'); ctx.fillStyle = g; ctx.fillText('GO!', 0, 0);
  ctx.restore();
}

export function renderPlay(ctx, state) {
  const round = state.round, L = layoutOf(state), cam = camFor(state, round);
  const watch = state.mode === 'watch';
  const adv = (state.think && state.think.adv) || (state.dec && state.dec.adv) || null;
  const dx = state.shake > 0 ? Math.sin(state.t * 90) * state.shake * 6 : 0, dy = state.shake > 0 ? Math.cos(state.t * 77) * state.shake * 5 : 0;
  ctx.fillStyle = '#06223a'; ctx.fillRect(0, 0, W, H);
  ctx.save(); ctx.translate(dx, dy);
  drawRound(ctx, cam, round, { t: state.t, fx: state.fx, hint: !round.over && adv && adv.flag >= 0 ? { flag: adv.flag } : null, youLook: state.youLook });
  // floating words
  for (const q of state.pops) {
    const k = q.t / q.max, p = proj(cam, q.x, q.y + k * 0.9, q.z);
    ctx.save(); ctx.globalAlpha = Math.min(1, (1 - k) * 2.2); ctx.font = `800 ${Math.round(q.size * (0.9 + 0.2 * Math.min(1, k * 6)))}px ${DISPLAY}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(4,26,46,0.85)'; ctx.lineJoin = 'round'; ctx.strokeText(q.text, p.x, p.y); ctx.fillStyle = q.col; ctx.fillText(q.text, p.x, p.y);
    ctx.restore();
  }
  ctx.restore();
  if (L.land) { ctx.save(); ctx.fillStyle = 'rgba(6,34,58,0.92)'; ctx.fillRect(L.px0 - 12, 0, W - L.px0 + 12, H); ctx.restore(); }
  drawScore(ctx, L, state, round);
  drawRhythm(ctx, L, state, round);
  drawTopButtons(ctx, L, state, round);
  if (watch) drawDemoBar(ctx, L, state); else drawDive(ctx, L, state, round, round.over ? null : adv);
  drawDecision(ctx, L, state, round);
  drawCoach(ctx, L, state, round);
  drawCue(ctx, L, state, round);
  drawBanner(ctx, L, state);
  drawToast(ctx, L, state);
  if (state.think && !watch) {
    const w = Math.min(L.world.w - 28, 640);
    ctx.save(); ctx.font = `600 ${Math.max(L.fs.mid, 14)}px ${FONT}`;
    card(ctx, L, cardBottom(L, state), w, wrapLines(ctx, state.think.adv.why, w - 36), 'Think', state.think.t / 2.5, '#ffd35a');
    ctx.restore();
  }
  if (round.over && state.overT > 0.35) {
    const k = Math.min(1, (state.overT - 0.35) * 3), o = round.over, me = round.runners[round.you];
    if (me) {
      const wd = L.world, cx = wd.x + wd.w / 2, cy = wd.y + wd.h * 0.5, sz = Math.round(Math.min(86, wd.w * 0.125));
      ctx.save(); ctx.globalAlpha = k; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const safe = me.flag >= 0;
      const txt = safe ? 'SAFE!' : 'OUT!';
      ctx.font = `800 ${sz}px ${DISPLAY}`; ctx.lineWidth = 12; ctx.strokeStyle = 'rgba(4,26,46,0.9)'; ctx.lineJoin = 'round'; ctx.strokeText(txt, cx, cy); ctx.fillStyle = safe ? '#9dffb0' : '#ffb09a'; ctx.fillText(txt, cx, cy);
      ctx.font = `700 ${Math.round(sz * 0.36)}px ${FONT}`; ctx.fillStyle = '#fff8e6';
      const sub = safe ? `${ordinal(o.youPlace)} to a flag${o.react != null ? `  ·  reaction ${Math.round(o.react * 1000)} ms` : ''}` : 'a rival got the last flag';
      ctx.lineWidth = 6; ctx.strokeText(sub, cx, cy + sz * 0.7); ctx.fillText(sub, cx, cy + sz * 0.7);
      ctx.restore();
    }
  }
}
