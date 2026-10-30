// The play screen: field, runners, tap zones, balance gauge and HUD. Pure drawing; game.js owns state.
import { W, H, playLayout, TEXT_SCALES, THINK_STEPS, meta } from './layout.js';
import { FONT, DISPLAY, roundPath, paintButton, drawButton, wrapLines, slab } from './ui.js';
import { makeCam, drawRace, glState } from './art.js';
import { TARGET, FALL_FWD, FALL_BACK, ordinal, fmtTime, placeNow, standings, COUNT, ghostX } from './sim.js';

const TAU = Math.PI * 2;
export const layoutOf = (state) => playLayout(Math.min(TEXT_SCALES[state.settings.textIdx], 1.6), !!state.race && state.race.mode === 'watch');
export const lanesOf = (race, ghost) => race.racers.length + (ghost ? 1 : 0);
export const camFor = (state, race) => makeCam(layoutOf(state).stage, state.camX || 0, lanesOf(race, !!(state.ghost && race.mode === 'clock')));

// ---- the scene ---------------------------------------------------------------------------------------------------------
// Over the 3D field: the "you" arrow and the rivals' name tags sit above the projected heads.
function drawGlMarks(ctx, state, race) {
  const gl = glState.gl, t = state.t;
  const tag = (txt, x, y, fs, col) => {
    ctx.save(); ctx.font = `700 ${fs}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const w = ctx.measureText(txt).width + 14;
    roundPath(ctx, x - w / 2, y - fs * 0.85, w, fs * 1.7, fs * 0.85); ctx.fillStyle = 'rgba(14,30,20,0.6)'; ctx.fill();
    ctx.fillStyle = col; ctx.fillText(txt, x, y + 1); ctx.restore();
  };
  for (const r of race.racers) {
    const hd = gl.heads[r.id]; if (!hd) continue;
    const sc = Math.max(20, gl.scale((r.lane + gl.off) || 0));
    if (r.player) {
      const b = Math.sin(t * 6) * sc * 0.04, s = sc * 0.16, x = hd.x, y = hd.y - sc * 0.06 + b;
      ctx.save(); ctx.fillStyle = '#ffd35a'; ctx.strokeStyle = 'rgba(40,20,0,0.75)'; ctx.lineWidth = Math.max(1.5, sc * 0.03);
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - s, y - s * 1.2); ctx.lineTo(x + s, y - s * 1.2); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
    } else tag(r.name, hd.x, hd.y - sc * 0.1, Math.max(11, Math.round(sc * 0.2)), '#fff6e0');
  }
  const gh = gl.heads.ghost;
  if (gh && race.mode === 'clock') tag('Best', gh.x, gh.y - 4, Math.max(11, Math.round(gl.scale(0) * 0.2)), '#cfe8ff');
}
export function drawScene(ctx, state, race, cam) {
  if (glState.gl) { drawGlMarks(ctx, state, race); return; }
  const g = state.ghost && race.mode === 'clock' ? ghostX(state.ghost, Math.max(0, race.t)) : null;
  drawRace(ctx, W, H, cam, race, { t: state.t, sack: state.record.sackSel, fx: state.fx, broke: state.broke, ghostX: g });
}

// ---- HUD ---------------------------------------------------------------------------------------------------------------
function chipBg(ctx, r, rad = 22) { slab(ctx, r.x, r.y, r.w, r.h, rad, 'dark', { fill: ['#1c4a35', '#0b241a'] }); }
function drawGauge(ctx, L, race, adv) {
  const r = L.gauge, fs = L.fs.gauge, me = race.racers[race.you];
  chipBg(ctx, r, Math.min(r.h / 2, 30));
  const pad = Math.max(14, r.h * 0.3), lab = Math.max(11, Math.round(fs * 0.78));
  const ty = r.y + r.h * 0.5, th = Math.max(12, r.h * 0.26);
  ctx.font = `700 ${lab}px ${FONT}`; ctx.textBaseline = 'middle';
  const lw = ctx.measureText('BACK').width, rw = ctx.measureText('FORWARD').width;
  const x0 = r.x + pad + lw + 12, x1 = r.x + r.w - pad - rw - 12;
  if (x1 - x0 < 90) { // very narrow: labels above
    const y2 = r.y + r.h * 0.72;
    drawGaugeBar(ctx, r.x + pad, r.x + r.w - pad, y2, th, me, adv);
    ctx.fillStyle = 'rgba(255,240,200,0.9)'; ctx.textAlign = 'left'; ctx.fillText('BACK', r.x + pad, r.y + r.h * 0.28); ctx.textAlign = 'right'; ctx.fillText('FORWARD', r.x + r.w - pad, r.y + r.h * 0.28);
    return;
  }
  ctx.fillStyle = 'rgba(255,240,200,0.9)'; ctx.textAlign = 'left'; ctx.fillText('BACK', r.x + pad, ty);
  ctx.textAlign = 'right'; ctx.fillText('FORWARD', r.x + r.w - pad, ty);
  drawGaugeBar(ctx, x0, x1, ty, th, me, adv);
}
function drawGaugeBar(ctx, x0, x1, cy, th, me, adv) {
  const lo = FALL_BACK, hi = FALL_FWD, u = (v) => x0 + ((Math.max(lo, Math.min(hi, v)) - lo) / (hi - lo)) * (x1 - x0);
  roundPath(ctx, x0, cy - th / 2, x1 - x0, th, th / 2); ctx.fillStyle = 'rgba(255,255,255,0.14)'; ctx.fill();
  ctx.save(); roundPath(ctx, x0, cy - th / 2, x1 - x0, th, th / 2); ctx.clip();
  ctx.fillStyle = 'rgba(255,92,70,0.6)'; ctx.fillRect(x0, cy - th / 2, u(-0.5) - x0, th); ctx.fillRect(u(0.68), cy - th / 2, x1 - u(0.68), th);
  ctx.fillStyle = 'rgba(255,200,70,0.35)'; ctx.fillRect(u(-0.5), cy - th / 2, u(0.68) - u(-0.5), th);
  ctx.fillStyle = '#ffd35a'; ctx.fillRect(u(TARGET - 0.13), cy - th / 2, u(TARGET + 0.13) - u(TARGET - 0.13), th);
  ctx.restore();
  // zero mark
  ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(u(0) - 1, cy - th * 0.7, 2, th * 1.4);
  // where you are heading
  const ahead = me.th + me.om * 0.2;
  ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(u(ahead), cy, th * 0.62, 0, TAU); ctx.stroke();
  // needle
  const nx = u(me.th), down = me.phase === 'down';
  ctx.fillStyle = down ? '#ff8a70' : '#ffffff'; ctx.strokeStyle = 'rgba(8,36,22,0.9)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(nx, cy - th * 0.95); ctx.lineTo(nx + th * 0.55, cy - th * 1.5); ctx.lineTo(nx - th * 0.55, cy - th * 1.5); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillRect(nx - 2.5, cy - th * 0.9, 5, th * 1.8);
  if (adv) { // the side to tap next
    ctx.fillStyle = '#ffe07a'; ctx.font = `800 ${Math.round(th * 0.9)}px ${FONT}`; ctx.textAlign = adv.side > 0 ? 'left' : 'right'; ctx.textBaseline = 'middle';
    ctx.fillText(adv.side > 0 ? '▶' : '◀', adv.side > 0 ? nx + th : nx - th, cy + th * 1.2);
  }
}
function drawScore(ctx, L, state, race) {
  const r = L.score, fs = L.fs, cx = r.x + r.w / 2, me = race.racers[race.you];
  chipBg(ctx, r, 22);
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.font = `700 ${fs.small}px ${FONT}`; ctx.fillStyle = 'rgba(255,240,200,0.85)';
  const name = race.mode === 'daily' ? 'DAILY FIELD' : race.mode === 'clock' ? 'CLOCK RUN' : race.mode === 'watch' ? 'WATCH & LEARN' : `HEAT ${race.level + 1}`;
  ctx.fillText(name, cx, r.y + fs.small * 1.15);
  const bigSz = Math.min(fs.big, Math.max(24, r.h - fs.small * 2.9));
  ctx.fillStyle = '#fff8e6'; ctx.font = `800 ${bigSz}px ${DISPLAY}`;
  const tt = me.finishT != null ? me.finishT : race.go ? race.t : 0;
  ctx.fillText(fmtTime(tt), cx, r.y + fs.small * 1.3 + bigSz * 0.82);
  ctx.fillStyle = '#ffd35a';
  const toGo = Math.max(0, race.len - me.x);
  const solo = race.mode === 'clock';
  const best = race.mode === 'daily' ? state.record.bestDaily : state.record.best;
  const sub = `${solo ? '' : `${ordinal(placeNow(race))} of ${race.racers.length}  ·  `}${me.finishT != null ? 'finished' : `${Math.ceil(toGo)} m to go`}${best ? `  ·  best ${fmtTime(best)}` : ''}`;
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
function drawTopButtons(ctx, L, state, race) {
  if (race.mode === 'watch') return;
  const { dy } = paintButton(ctx, L.pause, { dark: true });
  icon(ctx, 'pause', L.pause.x + L.pause.w / 2, L.pause.y + dy + L.pause.h / 2, Math.min(L.pause.h * 0.34, 34), '#fffdf4');
  const th = L.think, used = !!state.think;
  const q = paintButton(ctx, th, { active: used, dark: !used });
  icon(ctx, 'bulb', th.x + th.w / 2, th.y + q.dy + th.h * 0.36, Math.min(th.h * 0.3, 30), '#fffdf4');
  ctx.fillStyle = '#fffdf4'; ctx.font = `700 ${Math.max(L.fs.small, 12)}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('Think', th.x + th.w / 2, th.y + q.dy + th.h * 0.78);
}
function drawDemoBar(ctx, L, state) {
  const D = L.demo, st = state.settings;
  drawButton(ctx, D.dec, 'Think −', { dark: true, size: Math.round(L.fs.btn * 0.9), disabled: st.thinkIdx === 0 });
  drawButton(ctx, D.pause, state.paused ? 'Resume' : 'Pause', { primary: !state.paused, active: state.paused, size: L.fs.btn });
  drawButton(ctx, D.inc, 'Think +', { dark: true, size: Math.round(L.fs.btn * 0.9), disabled: st.thinkIdx === THINK_STEPS.length - 1 });
  drawButton(ctx, D.exit, 'Stop watching', { dark: true, size: L.fs.btn });
}
// Race progress along the top of the field.
function drawProgress(ctx, L, race) {
  const st = L.stage, h = Math.max(14, Math.round(st.h * 0.022)), x0 = st.x + 26, x1 = st.x + st.w - 26, y = st.y + 10 + h / 2;
  roundPath(ctx, x0 - 8, y - h / 2 - 5, x1 - x0 + 16, h + 10, (h + 10) / 2); ctx.fillStyle = 'rgba(8,36,22,0.6)'; ctx.fill();
  roundPath(ctx, x0, y - h / 4, x1 - x0, h / 2, h / 4); ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.fill();
  const cols = ['#ff7a8a', '#6ec3ff', '#8fe38f', '#c9a0ff', '#ffb36a'];
  const sorted = race.racers.slice().sort((a, b) => (a.player ? 1 : 0) - (b.player ? 1 : 0));
  for (const r of sorted) {
    const u = Math.max(0, Math.min(1, r.x / race.len)), x = x0 + u * (x1 - x0);
    ctx.fillStyle = r.player ? '#ffd35a' : cols[r.id % cols.length]; ctx.strokeStyle = 'rgba(8,36,22,0.9)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y, r.player ? h * 0.72 : h * 0.55, 0, TAU); ctx.fill(); ctx.stroke();
  }
  // flag at the end
  ctx.fillStyle = '#fff'; ctx.fillRect(x1 + 2, y - h * 0.9, 3, h * 1.8); ctx.fillStyle = '#e23a62'; ctx.fillRect(x1 + 5, y - h * 0.9, h * 0.9, h * 0.8);
}
// The two tap zones drawn on the field.
function drawZones(ctx, L, state, race, adv) {
  if (!state.settings.guide && !adv) return;
  const st = L.stage, h = Math.round(Math.max(64, Math.min(140, st.h * 0.14))), y = st.y + st.h - h - 12 - (L.land ? 0 : 4), gap = 10;
  const w = (st.w - 2 * 16 - gap) / 2, fs = Math.max(L.fs.mid * 0.9, 13);
  [-1, 1].forEach((side) => {
    const x = st.x + 16 + (side > 0 ? w + gap : 0);
    const fl = state.tapFlash && state.tapFlash.side === side ? Math.max(0, 1 - state.tapFlash.t / 0.2) : 0;
    const hint = adv && adv.side === side;
    ctx.save();
    roundPath(ctx, x, y, w, h, 22);
    ctx.fillStyle = hint ? `rgba(255,214,90,${0.34 + 0.18 * Math.sin(state.t * 8)})` : `rgba(8,36,22,${0.34 + 0.3 * fl})`; ctx.fill();
    ctx.lineWidth = hint ? 4 : 2; ctx.strokeStyle = hint ? '#ffe07a' : `rgba(255,255,255,${0.35 + 0.5 * fl})`; ctx.stroke();
    ctx.fillStyle = '#fff8e6'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `800 ${Math.round(fs * 1.25)}px ${DISPLAY}`;
    ctx.fillText(side > 0 ? 'PUSH FORWARD  ▶' : '◀  ROCK BACK', x + w / 2, y + h * 0.42);
    ctx.font = `600 ${Math.round(fs * 0.8)}px ${FONT}`; ctx.globalAlpha = 0.85;
    ctx.fillText(side > 0 ? 'tap right' : 'tap left', x + w / 2, y + h * 0.74);
    ctx.restore();
  });
}
function card(ctx, L, y, w, lines, head, bar, col) {
  const st = L.stage, x = st.x + (st.w - w) / 2, fz = Math.max(L.fs.mid, 14), lh = fz * 1.3;
  const h = 56 + lines.length * lh + 22;
  roundPath(ctx, x, y, w, h, 20); ctx.fillStyle = 'rgba(8,36,22,0.88)'; ctx.fill(); ctx.strokeStyle = 'rgba(255,225,130,0.75)'; ctx.lineWidth = 2; ctx.stroke();
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#ffd35a'; ctx.font = `800 ${Math.max(L.fs.mid, 15)}px ${FONT}`; ctx.fillText(head, x + 18, y + 34);
  if (bar != null) {
    roundPath(ctx, x + 18, y + 44, w - 36, 8, 4); ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fill();
    roundPath(ctx, x + 18, y + 44, Math.max(8, (w - 36) * Math.min(1, bar)), 8, 4); ctx.fillStyle = col; ctx.fill();
  }
  ctx.fillStyle = '#fff8e6'; ctx.font = `600 ${fz}px ${FONT}`;
  lines.forEach((l, i) => ctx.fillText(l, x + 18, y + 78 + i * lh));
}
function drawDecision(ctx, L, state) {
  const d = state.dec; if (!d || !d.active) return;
  const st = L.stage, w = Math.min(st.w - 28, 640), top = st.y + Math.max(30, st.h * 0.05) + 8;
  ctx.save(); ctx.font = `600 ${Math.max(L.fs.mid, 14)}px ${FONT}`;
  const lines = wrapLines(ctx, d.adv.why, w - 36);
  const phase = d.phase === 'think' ? 'Thinking' : d.phase === 'reveal' ? 'Choosing' : 'Tapping';
  const k = d.phase === 'go' ? 1 : d.t / d.dur;
  card(ctx, L, top, w, lines, `${phase}…`, k, d.phase === 'think' ? '#7fd1c4' : '#ffb347');
  ctx.restore();
}
function drawBanner(ctx, L, state) {
  const b = state.banner; if (!b) return;
  const st = L.stage, k = b.t / b.max, a = Math.min(1, (1 - k) * 3), sc = 0.8 + 0.25 * Math.min(1, k * 8);
  ctx.save(); ctx.globalAlpha = a; ctx.translate(st.x + st.w / 2, st.y + st.h * 0.2); ctx.scale(sc, sc);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const sz = Math.round(Math.min(78, st.w * 0.11) * (TEXT_SCALES[state.settings.textIdx] > 1.5 ? 1 : 1.1));
  ctx.font = `800 ${sz}px ${DISPLAY}`; ctx.lineWidth = 12; ctx.strokeStyle = 'rgba(6,28,18,0.9)'; ctx.lineJoin = 'round'; ctx.strokeText(b.text, 0, 0);
  const g = ctx.createLinearGradient(0, -sz / 2, 0, sz / 2); g.addColorStop(0, '#fffbd0'); g.addColorStop(1, b.col || '#ff9a3a'); ctx.fillStyle = g; ctx.fillText(b.text, 0, 0);
  if (b.sub) { ctx.font = `700 ${Math.round(sz * 0.36)}px ${FONT}`; ctx.lineWidth = 6; ctx.strokeText(b.sub, 0, sz * 0.68); ctx.fillStyle = '#fff8e6'; ctx.fillText(b.sub, 0, sz * 0.68); }
  ctx.restore();
}
function drawToast(ctx, L, state) {
  if (!state.toast || state.toastT <= 0) return;
  const st = L.stage, fs = L.fs.toast, a = Math.min(1, state.toastT * 2);
  ctx.save(); ctx.globalAlpha = a; ctx.font = `700 ${fs}px ${FONT}`;
  const maxW = Math.min(st.w - 30, 640), lines = wrapLines(ctx, state.toast, maxW - 40), lh = fs * 1.3, h = lines.length * lh + 22;
  const x = st.x + st.w / 2, y = st.y + st.h * 0.28;
  roundPath(ctx, x - maxW / 2, y, maxW, h, 18); ctx.fillStyle = 'rgba(8,36,22,0.84)'; ctx.fill();
  ctx.fillStyle = '#fff8e6'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  lines.forEach((l, i) => ctx.fillText(l, x, y + 11 + lh * (i + 0.5)));
  ctx.restore();
}
function drawCountdown(ctx, L, race, t) {
  if (race.go && race.t > 0.9) return;
  const st = L.stage, c = race.count, total = COUNT[0] + COUNT[1] + COUNT[2];
  let txt, k;
  if (!race.go) { const i = c < COUNT[0] ? 0 : c < COUNT[0] + COUNT[1] ? 1 : 2; txt = ['Ready', 'Set', 'Hop!'][i]; k = (c - [0, COUNT[0], COUNT[0] + COUNT[1]][i]) / COUNT[i]; }
  else { txt = 'Hop!'; k = race.t / 0.9; }
  void total;
  const sz = Math.round(Math.min(150, st.w * 0.2)), a = race.go ? Math.max(0, 1 - k) : 1, sc = 1 + 0.2 * (1 - Math.min(1, k * 3));
  ctx.save(); ctx.globalAlpha = a; ctx.translate(st.x + st.w / 2, st.y + st.h * 0.28); ctx.scale(sc, sc);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `800 ${sz}px ${DISPLAY}`; ctx.lineJoin = 'round'; ctx.lineWidth = 16; ctx.strokeStyle = 'rgba(6,28,18,0.9)'; ctx.strokeText(txt, 0, 0);
  const g = ctx.createLinearGradient(0, -sz / 2, 0, sz / 2);
  if (txt === 'Hop!') { g.addColorStop(0, '#f4ffd0'); g.addColorStop(1, '#4fd66b'); } else { g.addColorStop(0, '#fffbd0'); g.addColorStop(1, txt === 'Set' ? '#ffb02e' : '#ff7a4a'); }
  ctx.fillStyle = g; ctx.fillText(txt, 0, 0); ctx.restore();
  void t;
}

export function renderPlay(ctx, state) {
  const race = state.race, L = layoutOf(state), cam = camFor(state, race);
  state.glBandPlay = L.stage;
  const watch = race.mode === 'watch';
  // the kit's preview pill sits in the sky at the top-right corner of the field, clear of the HUD strips
  meta.previewBadge = { x: L.stage.x + L.stage.w - 10, y: L.stage.y + 8, align: 'right' };
  const dx = state.shake > 0 ? Math.sin(state.t * 90) * state.shake * 6 : 0, dy = state.shake > 0 ? Math.cos(state.t * 77) * state.shake * 5 : 0;
  ctx.save(); ctx.translate(dx, dy);
  drawScene(ctx, state, race, cam);
  // floating words
  for (const q of state.pops) {
    const k = q.t / q.max;
    let x, y;
    if (glState.gl) { const p = glState.gl.project(q.x, q.y + k * 0.8, q.lane); x = p.x; y = p.y; }
    else { y = cam.laneY(q.lane) - (q.y + k * 0.8) * cam.s * cam.laneSc(q.lane); x = cam.X(q.x); }
    ctx.save(); ctx.globalAlpha = Math.min(1, (1 - k) * 2.2); ctx.font = `800 ${Math.round(q.size * (0.9 + 0.2 * Math.min(1, k * 6)))}px ${DISPLAY}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(6,28,18,0.85)'; ctx.lineJoin = 'round'; ctx.strokeText(q.text, x, y); ctx.fillStyle = q.col; ctx.fillText(q.text, x, y);
    ctx.restore();
  }
  ctx.restore();
  const adv = (state.think && state.think.adv) || (state.dec && state.dec.adv) || null;
  drawProgress(ctx, L, race);
  drawZones(ctx, L, state, race, race.over ? null : adv);
  drawGauge(ctx, L, race, race.over ? null : adv);
  drawScore(ctx, L, state, race);
  drawTopButtons(ctx, L, state, race);
  if (watch) drawDemoBar(ctx, L, state);
  drawDecision(ctx, L, state);
  drawCountdown(ctx, L, race, state.t);
  drawBanner(ctx, L, state);
  drawToast(ctx, L, state);
  if (state.think && !watch) {
    const st = L.stage, w = Math.min(st.w - 28, 640), top = st.y + Math.max(30, st.h * 0.05) + 8;
    ctx.save(); ctx.font = `600 ${Math.max(L.fs.mid, 14)}px ${FONT}`;
    card(ctx, L, top, w, wrapLines(ctx, state.think.adv.why, w - 36), 'Think', state.think.t / 2.5, '#ffd35a');
    ctx.restore();
  }
  if (race.over && state.overT > 0.15) {
    const k = Math.min(1, (state.overT - 0.15) * 3), o = race.over;
    ctx.save(); ctx.globalAlpha = 0.35 * k; ctx.fillStyle = '#06241a'; ctx.fillRect(L.stage.x, L.stage.y, L.stage.w, L.stage.h); ctx.restore();
    ctx.save(); ctx.globalAlpha = k; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const cx = L.stage.x + L.stage.w / 2, cy = L.stage.y + L.stage.h * 0.3, sz = Math.round(Math.min(78, L.stage.w * 0.11));
    const solo = race.mode === 'clock';
    const txt = !o.done ? 'Time is up' : solo ? 'Finished!' : o.place === 1 ? 'You win!' : `${ordinal(o.place)} place`;
    ctx.font = `800 ${sz}px ${DISPLAY}`; ctx.lineWidth = 10; ctx.strokeStyle = 'rgba(6,28,18,0.9)'; ctx.lineJoin = 'round'; ctx.strokeText(txt, cx, cy); ctx.fillStyle = o.place === 1 || solo ? '#ffe074' : '#fff8e6'; ctx.fillText(txt, cx, cy);
    ctx.font = `700 ${Math.round(sz * 0.42)}px ${FONT}`; ctx.fillStyle = '#fff8e6'; ctx.fillText(o.time != null ? `${fmtTime(o.time)} s` : '', cx, cy + sz * 0.75);
    ctx.restore();
  }
  void standings;
}
