// The play screen: the pond, the stone cradle with its protractor and power gauge, the HUD, the wind strip and the control panel.
// Pure drawing; game.js owns state and calls these every frame.
import { W, H, TEXT_SCALES, playLayout, cradleOf, trackOf, host, clamp } from './layout.js';
import { FONT, DISPLAY, C, roundPath, drawButton, panel, textShadow } from './ui.js';
import { drawWorld, makeCam, drawStoneProfile, PALS } from './art.js';
import { GL } from './glbridge.js';
import { STONES, PONDS, stoneAt, tiltOf, speedOf, spinOf, TILT_MAX, PWR_MIN, PWR_MAX, SESSION_THROWS, SPIN_MAX } from './sim.js';

const TAU = Math.PI * 2;

export const layoutOf = (state) => playLayout(TEXT_SCALES[state.settings.textIdx], state.run && state.run.mode === 'watch');
export const pullMax = (stage) => clamp(stage.h * 0.5, 200, 480);

// ---- the world from a world-state object ---------------------------------------------------------------------------------
// ws = { pond, cond, t, fly: { res, t, idx, spin0 } | null, camZ, ripples, parts, trail }
export function drawWorldState(ctx, rect, ws, kind = 'att') {
  if (GL.on) { GL.views.push({ kind, rect: { x: rect.x, y: rect.y, w: rect.w, h: rect.h }, ws }); return null; }
  const pond = PONDS[ws.pond];
  let stone = null;
  if (ws.fly) {
    const res = ws.fly.res, s = stoneAt(res, ws.fly.t);
    const sunk = ws.fly.t > res.dur ? ws.fly.t - res.dur : 0;
    const tilt = s.f > 0 && res.skips[Math.min(s.f, res.skips.length) - 1] ? res.skips[Math.min(s.f, res.skips.length) - 1].tilt : res.tilt0;
    stone = { z: s.z, y: sunk > 0 ? -sunk * 0.25 : s.y, tilt, spin: ws.fly.t * (res.spin0 || 0) * 0.5, idx: ws.fly.idx, alpha: sunk > 0 ? Math.max(0, 1 - sunk * 1.6) : 1 };
  }
  const sw = pond.swell > 0 ? { amp: pond.swell, lambda: pond.lambda, c: pond.c, phase: ws.cond ? ws.cond.phase : 0 } : null;
  return drawWorld(ctx, rect, { pond: ws.pond, camZ: ws.camZ, t: ws.t, swell: sw, chop: pond.chop, ripples: ws.ripples, parts: ws.parts, stone, trail: ws.trail });
}

// ---- small helpers --------------------------------------------------------------------------------------------------------------
const minF = () => (host.px > 0 ? Math.ceil(11 / host.px) : 0);
function fit(ctx, text, maxW, size, weight = 700) {
  let px = Math.max(size, minF());
  ctx.font = `${weight} ${px}px ${FONT}`;
  while (px > Math.max(10, minF()) && ctx.measureText(text).width > maxW) { px -= 1; ctx.font = `${weight} ${px}px ${FONT}`; }
  return px;
}
function pill(ctx, text, cx, cy, size, fill = 'rgba(10,26,48,0.8)', col = '#f4fbff') {
  ctx.save(); ctx.font = `700 ${size}px ${FONT}`;
  const w = ctx.measureText(text).width + size * 1.2, h = size * 1.9;
  roundPath(ctx, cx - w / 2, cy - h / 2, w, h, h / 2); ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = '#c9a85c'; ctx.stroke();
  ctx.fillStyle = col; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, cx, cy + 1); ctx.restore();
}

// ---- the cradle: the stone in profile with its angle, and the power gauge ---------------------------------------------------------
function drawCradle(ctx, L, state) {
  const A = state.aim, run = state.run, stage = L.stage, cr = cradleOf(stage);
  const tray = A.tray, idx = tray[A.sel];
  const tilt = tiltOf(A.tilt01), pm = pullMax(stage), pull = clamp(A.pull, 0, 1);
  const cx = cr.x + cr.w / 2, baseY = cr.y + cr.h * 0.55, lift = GL.on ? pull * cr.h * 0.34 : pull * pm * 0.55;
  if (GL.on) panel(ctx, cr.x, cr.y, cr.w, cr.h, { r: 20, fill: 'rgba(16,28,46,0.8)' });
  // ledge
  const ly = cr.y + cr.h - 26;
  ctx.save();
  roundPath(ctx, cr.x + 10, ly, cr.w - 20, 40, 14);
  const lg = ctx.createLinearGradient(0, ly, 0, ly + 40); lg.addColorStop(0, '#5a6674'); lg.addColorStop(1, '#2c3440'); ctx.fillStyle = lg; ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(cr.x + 26, ly + 3, cr.w - 52, 3);
  ctx.restore();
  // water plane through the stone and the angle arc
  const len = Math.min(cr.w * 0.5, 240, cr.h * 1.05), y = baseY - lift;
  ctx.save();
  ctx.setLineDash([8, 8]); ctx.strokeStyle = 'rgba(255,255,255,0.65)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(cx - len * 0.7, y); ctx.lineTo(cx + len * 0.8, y); ctx.stroke(); ctx.setLineDash([]);
  if (tilt > 0.5) {
    ctx.strokeStyle = '#ffd36a'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(cx, y, len * 0.62, -tilt * Math.PI / 180, 0); ctx.stroke();
  }
  ctx.restore();
  drawStoneProfile(ctx, cx, y, len, tilt, idx, { shadow: pull < 0.02 });
  const fs = Math.max(L.fs.small + 2, minF());
  pill(ctx, `${Math.round(tilt)}°`, cx + len * 0.72, y - Math.max(10, tilt * 0.9) - fs, fs, 'rgba(10,26,48,0.78)', '#ffd36a');
  // arrow hint while idle
  if (pull < 0.03 && !state.dec) {
    const a = 0.5 + 0.5 * Math.sin(state.t * 3);
    ctx.save(); ctx.globalAlpha = 0.5 + 0.4 * a; ctx.strokeStyle = '#fff'; ctx.fillStyle = '#fff'; ctx.lineWidth = 4; ctx.lineCap = 'round';
    const ax = cx, ay = y - len * 0.42 - 10 - a * 8;
    ctx.beginPath(); ctx.moveTo(ax, ay + 26); ctx.lineTo(ax, ay); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ax - 11, ay + 11); ctx.lineTo(ax, ay - 2); ctx.lineTo(ax + 11, ay + 11); ctx.stroke();
    ctx.restore();
    pill(ctx, 'Flick up to throw', cx, ay - fs * 1.4, fs, 'rgba(10,26,48,0.7)');
  }
  // power gauge on the right edge of the pond
  const gw = Math.max(26, Math.round(fs * 1.5)), gx = stage.x + stage.w - gw - 30, gy = stage.y + stage.h * 0.18, gh = cr.y + cr.h - 8 - gy;
  if (gh > 80) {
    roundPath(ctx, gx, gy, gw, gh, gw / 2); ctx.fillStyle = 'rgba(8,22,44,0.72)'; ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = '#c9a85c'; ctx.stroke();
    const fh = Math.max(0, gh * pull);
    if (fh > 2) { roundPath(ctx, gx + 3, gy + gh - fh, gw - 6, fh, (gw - 6) / 2); const pg = ctx.createLinearGradient(0, gy + gh, 0, gy); pg.addColorStop(0, '#39c1a8'); pg.addColorStop(0.6, '#f0c040'); pg.addColorStop(1, '#ec6a3c'); ctx.fillStyle = pg; ctx.fill(); }
    if (state.hint) {
      const hy = gy + gh - gh * state.hint.adv.power;
      ctx.fillStyle = '#ffd36a'; ctx.beginPath(); ctx.moveTo(gx - 10, hy); ctx.lineTo(gx - 1, hy - 8); ctx.lineTo(gx - 1, hy + 8); ctx.closePath(); ctx.fill();
      ctx.fillRect(gx - 1, hy - 2, gw + 2, 4);
    }
    const sp = speedOf(pull) * (1 - 0.34 * clamp(A.spin01, 0, 1));
    ctx.fillStyle = '#f4fbff'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.font = `700 ${Math.max(fs - 2, minF())}px ${FONT}`;
    ctx.fillText('Power', gx + gw / 2, gy - 8);
    if (pull > 0.01) { ctx.save(); ctx.font = `700 ${fs}px ${FONT}`; textShadow(ctx, `${sp.toFixed(0)} m/s`, gx + gw / 2 - gw * 0.3, gy + gh + 22, '#fff', 5); ctx.restore(); }
  }
  void run; void PWR_MIN; void PWR_MAX; void TILT_MAX;
}

// ---- panel: tray and sliders ------------------------------------------------------------------------------------------------------
function statBar(ctx, x, y, w, v, col) {
  roundPath(ctx, x, y, w, 6, 3); ctx.fillStyle = 'rgba(20,36,58,0.2)'; ctx.fill();
  roundPath(ctx, x, y, Math.max(6, w * v), 6, 3); ctx.fillStyle = col; ctx.fill();
}
function drawTray(ctx, L, state) {
  const A = state.aim, hint = state.hint, dec = state.dec;
  L.tray.forEach((r, i) => {
    const idx = A.tray[i];
    if (idx === undefined) return;
    const st = STONES[idx], sel = A.sel === i;
    const rec = hint && hint.adv.stone.id === idx || (dec && dec.adv && dec.phase !== 'think' && dec.adv.stone.id === idx);
    panel(ctx, r.x, r.y, r.w, r.h, { r: 18, fill: sel ? 'rgba(232,248,244,0.98)' : 'rgba(240,246,249,0.9)', stroke: sel ? '#1f9a8c' : 'rgba(40,60,80,0.5)' });
    if (sel) { ctx.save(); roundPath(ctx, r.x + 2, r.y + 2, r.w - 4, r.h - 4, 16); ctx.lineWidth = 4; ctx.strokeStyle = '#1f9a8c'; ctx.stroke(); ctx.restore(); }
    if (rec) { ctx.save(); roundPath(ctx, r.x - 3, r.y - 3, r.w + 6, r.h + 6, 20); ctx.lineWidth = 3; ctx.strokeStyle = '#ffc94a'; ctx.stroke(); ctx.restore(); }
    const len = Math.min(r.w * 0.62, r.h * 0.95);
    drawStoneProfile(ctx, r.x + r.w / 2, r.y + r.h * 0.34, len, 8, idx, { shadow: false });
    const fs = Math.round(Math.max(L.fs.small - 1, minF(), 12));
    ctx.fillStyle = C.ink; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    const px = fit(ctx, st.name, r.w - 14, fs + 2);
    ctx.font = `700 ${px}px ${FONT}`; ctx.fillText(st.name, r.x + r.w / 2, r.y + r.h * 0.67);
    const bx = r.x + r.w * 0.14, bw = r.w * 0.72;
    if (r.h > 112) {
      statBar(ctx, bx, r.y + r.h * 0.75, bw, st.flat, '#1f9a8c');
      statBar(ctx, bx, r.y + r.h * 0.84, bw, clamp((st.m - 0.02) / 0.14, 0.1, 1), '#5a7fa8');
    }
  });
}
function drawSlider(ctx, r, label, valueText, v01, o = {}) {
  const { disabled = false, hint = null, ticks = 4, fs = 20 } = o;
  panel(ctx, r.x, r.y, r.w, r.h, { r: 18, fill: 'rgba(14,32,58,0.82)', stroke: 'rgba(255,255,255,0.28)' });
  ctx.textBaseline = 'alphabetic';
  const size = Math.max(fs, minF());
  ctx.font = `700 ${size}px ${FONT}`; ctx.textAlign = 'left'; ctx.fillStyle = '#f4fbff'; ctx.fillText(label, r.x + 20, r.y + size + 8);
  ctx.textAlign = 'right'; ctx.fillStyle = '#ffd36a'; ctx.fillText(valueText, r.x + r.w - 20, r.y + size + 8);
  const t = trackOf(r), cy = t.y + t.h / 2, tr = Math.max(7, t.h * 0.26);
  roundPath(ctx, t.x, cy - tr / 2, t.w, tr, tr / 2); ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.fill();
  for (let i = 0; i <= ticks; i++) { ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(t.x + (t.w * i) / ticks - 1, cy - tr / 2 - 5, 2, tr + 10); }
  const fx = t.x + t.w * clamp(v01, 0, 1);
  roundPath(ctx, t.x, cy - tr / 2, Math.max(2, fx - t.x), tr, tr / 2);
  const g = ctx.createLinearGradient(t.x, 0, t.x + t.w, 0); g.addColorStop(0, '#39c1a8'); g.addColorStop(1, '#3a9be0'); ctx.fillStyle = g; ctx.fill();
  if (hint !== null) {
    const hx = t.x + t.w * clamp(hint, 0, 1);
    ctx.fillStyle = '#ffc94a'; ctx.beginPath(); ctx.moveTo(hx, cy - tr / 2 - 4); ctx.lineTo(hx - 9, cy - tr / 2 - 16); ctx.lineTo(hx + 9, cy - tr / 2 - 16); ctx.closePath(); ctx.fill();
  }
  const kr = Math.max(14, t.h * 0.46);
  ctx.beginPath(); ctx.arc(fx, cy, kr, 0, TAU);
  const kg = ctx.createRadialGradient(fx - kr * 0.3, cy - kr * 0.3, 2, fx, cy, kr);
  kg.addColorStop(0, disabled ? '#dfe6ea' : '#ffffff'); kg.addColorStop(1, disabled ? '#aab6bf' : '#bcd9ee'); ctx.fillStyle = kg; ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(8,24,48,0.6)'; ctx.stroke();
}

function drawWindStrip(ctx, L, state) {
  const r = L.wind, ws = state.ws, cond = ws.cond, pond = PONDS[ws.pond];
  panel(ctx, r.x, r.y, r.w, r.h, { r: 16, fill: 'rgba(12,30,56,0.78)', stroke: 'rgba(255,255,255,0.28)' });
  const wind = cond ? cond.wind : 0, tail = wind > 0;
  const cy = r.y + r.h / 2, ax = r.x + 34;
  ctx.save(); ctx.strokeStyle = tail ? '#8be8b0' : '#ffc27a'; ctx.fillStyle = ctx.strokeStyle; ctx.lineWidth = 4; ctx.lineCap = 'round';
  const dir = tail ? -1 : 1, sz = Math.min(18, r.h * 0.3);
  ctx.beginPath(); ctx.moveTo(ax, cy + dir * -sz); ctx.lineTo(ax, cy + dir * sz); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(ax - sz * 0.6, cy + dir * (sz - sz * 0.7)); ctx.lineTo(ax, cy + dir * sz); ctx.lineTo(ax + sz * 0.6, cy + dir * (sz - sz * 0.7)); ctx.stroke();
  ctx.restore();
  const fs = Math.max(L.fs.wind, minF());
  ctx.textBaseline = 'middle'; ctx.textAlign = 'left'; ctx.fillStyle = '#f4fbff';
  const label = `${tail ? 'Tailwind' : 'Headwind'} ${Math.abs(wind).toFixed(1)} m/s${pond.gust ? ' · gusty' : ''}`;
  const px = fit(ctx, label, r.w * 0.62 - 50, fs);
  ctx.font = `700 ${px}px ${FONT}`; ctx.fillText(label, ax + 28, cy);
  const wl = pond.swell >= 3 ? 'Big swell' : pond.swell > 0 ? 'Light swell' : 'Calm';
  const l2 = pond.chop >= 3 ? `${wl} · choppy` : wl;
  ctx.textAlign = 'right'; ctx.fillStyle = '#bfe1f5';
  const p2 = fit(ctx, l2, r.w * 0.34, Math.round(fs * 0.9));
  ctx.font = `600 ${p2}px ${FONT}`; ctx.fillText(l2, r.x + r.w - 16, cy);
}

function drawScoreBlock(ctx, L, state) {
  const r = L.score, run = state.run;
  panel(ctx, r.x, r.y, r.w, r.h, { r: 18, fill: 'rgba(12,30,56,0.78)', stroke: 'rgba(255,255,255,0.28)' });
  const cx = r.x + r.w / 2;
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  const sm = Math.max(L.fs.small, minF());
  const head = run.mode === 'free' ? `${PONDS[state.ws.pond].name} · free skip` : `${PONDS[state.ws.pond].name} · throw ${Math.min(run.idx + 1, SESSION_THROWS)} of ${SESSION_THROWS}`;
  const px = fit(ctx, head, r.w - 20, sm, 600);
  ctx.font = `600 ${px}px ${FONT}`; ctx.fillStyle = '#bfe1f5'; ctx.fillText(head, cx, r.y + px + 6);
  const big = Math.min(L.fs.big, r.h - px - 16);
  ctx.font = `800 ${big}px ${DISPLAY}`; ctx.fillStyle = '#fff'; ctx.fillText(String(state.scoreShown ?? 0), cx - (run.mode === 'free' ? 0 : 0), r.y + r.h - 10);
  ctx.font = `600 ${Math.max(sm - 1, minF())}px ${FONT}`; ctx.fillStyle = '#bfe1f5'; ctx.textAlign = 'right';
  if (state.run.mode !== 'free') ctx.fillText('skips', r.x + r.w - 12, r.y + r.h - 12);
  else ctx.fillText('this throw', r.x + r.w - 12, r.y + r.h - 12);
}

// ---- the whole play screen -----------------------------------------------------------------------------------------------------------
export function renderPlay(ctx, state) {
  const L = layoutOf(state), run = state.run, watch = run.mode === 'watch', stage = L.stage;
  // backdrop for any area outside the pond (landscape side panel)
  if (!GL.on) { ctx.fillStyle = PALS[state.ws.pond].water[2]; ctx.fillRect(0, 0, W, H); }
  let sx = 0, sy = 0;
  if (state.shake > 0) { const k = state.shake * 6; sx = Math.sin(state.t * 90) * k; sy = Math.cos(state.t * 77) * k; }
  ctx.save(); ctx.translate(sx, sy);
  const cam = drawWorldState(ctx, stage, state.ws, 'play');
  ctx.restore();
  // number pops over the splash
  for (const p of state.pops) {
    if (state.banner) break;   // the result banner owns the middle of the pond
    let x, y, size;
    if (cam) {
      const d = p.z - state.ws.camZ;
      if (d < 0.6) continue;
      x = cam.X(0, d); y = cam.Y(p.y, d) - 18; size = Math.round(clamp(cam.S(0.32, d) * p.size, 22, 56));
    } else if (GL.project) {
      if (p.z < (GL.camZ || -99) + 1.4) continue;
      const q = GL.project(0, p.y + 0.12, p.z);
      if (!q || q[2] > 1) continue;
      x = q[0]; y = q[1] - 14; size = Math.round(clamp(stage.h * 0.075 * p.size, 24, 56));
    } else continue;
    const k = p.t / p.max; y -= k * 46;
    ctx.save(); ctx.globalAlpha = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
    ctx.font = `800 ${size}px ${DISPLAY}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineWidth = Math.max(3, size * 0.14); ctx.strokeStyle = 'rgba(8,24,48,0.75)'; ctx.lineJoin = 'round';
    ctx.strokeText(p.text, x, y); ctx.fillStyle = p.col; ctx.fillText(p.text, x, y);
    ctx.restore();
  }
  // the cradle while choosing and throwing
  if (run.phase === 'aim') drawCradle(ctx, L, state);
  // HUD
  const big = L.fs.btn;
  if (!watch) {
    drawButton(ctx, L.pause, '❚❚', { dark: true, size: big });
    drawButton(ctx, L.think, state.hint ? 'Hint on' : 'Think', { primary: !state.hint, active: !!state.hint, size: Math.round(big * 0.9) });
  } else {
    drawButton(ctx, L.pause, 'Watch', { dark: true, size: Math.round(big * 0.8), disabled: true });
    drawButton(ctx, L.think, '', { dark: true, size: big, disabled: true });
  }
  drawScoreBlock(ctx, L, state);
  drawWindStrip(ctx, L, state);
  // panel
  drawTray(ctx, L, state);
  const A = state.aim, tilt = tiltOf(A.tilt01), idx = A.tray[A.sel];
  const spinRps = spinOf(STONES[idx], A.spin01, 0.5);
  const lockUi = run.phase !== 'aim';
  drawSlider(ctx, L.tilt, 'Tilt', `${Math.round(tilt)}°`, A.tilt01, { disabled: lockUi, hint: state.hint ? (state.hint.adv.tilt - 0) / TILT_MAX : (state.dec && state.dec.phase !== 'think' && state.dec.adv ? state.dec.adv.tilt / TILT_MAX : null), ticks: 4, fs: L.fs.lab });
  drawSlider(ctx, L.spin, 'Spin', `${Math.round(A.spin01 * 100)}%`, A.spin01, { disabled: lockUi, hint: state.hint ? state.hint.adv.spin : (state.dec && state.dec.phase !== 'think' && state.dec.adv ? state.dec.adv.spin : null), ticks: 4, fs: L.fs.lab });
  void spinRps; void SPIN_MAX;
  if (watch) {
    const D = L.demo, st = state.settings;
    drawButton(ctx, D.dec, '−', { size: big, disabled: st.thinkIdx === 0, dark: true });
    drawButton(ctx, D.pause, state.paused ? 'Resume' : 'Pause', { size: Math.round(big * 0.9), primary: true });
    drawButton(ctx, D.inc, '+', { size: big, disabled: false, dark: true });
    drawButton(ctx, D.exit, 'Exit', { size: Math.round(big * 0.9), dark: true });
    // phase label over the pond
    const dec = state.dec;
    if (dec) {
      const label = dec.phase === 'think' ? `Thinking… ${Math.max(0, Math.ceil(dec.dur - dec.t))} s` : dec.phase === 'reveal' ? 'My choice' : 'Throwing';
      pill(ctx, label, stage.x + stage.w / 2, stage.y + stage.h * 0.1, Math.max(L.fs.mid, minF()), 'rgba(10,26,48,0.78)', dec.phase === 'think' ? '#ffd36a' : '#8be8b0');
    }
  } else {
    const hr = L.hint;
    ctx.fillStyle = 'rgba(244,251,255,0.9)'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const msg = run.phase === 'aim' ? (state.hint ? 'Gold marks show the suggested tilt, spin and pull' : 'Pick a stone, set tilt and spin, then flick up from the stone') : run.phase === 'fly' ? 'Tap to watch faster' : '';
    const px = fit(ctx, msg, hr.w - 20, Math.max(L.fs.small + 1, minF()), 600);
    ctx.font = `600 ${px}px ${FONT}`; ctx.fillText(msg, hr.x + hr.w / 2, hr.y + hr.h / 2);
  }
  // the hint card
  if (state.hint && run.phase === 'aim') {
    const why = state.hint.why, px = Math.max(L.fs.small, minF());
    ctx.font = `600 ${px}px ${FONT}`;
    const maxW = Math.min(stage.w - 40, 620);
    const lines = wrap(ctx, `Think: ${why}.`, maxW - 28);
    const hh = lines.length * px * 1.3 + 22, hx = stage.x + (stage.w - maxW) / 2, hy = stage.y + 10;
    roundPath(ctx, hx, hy, maxW, hh, 16); ctx.fillStyle = 'rgba(10,26,48,0.84)'; ctx.fill(); ctx.strokeStyle = '#ffc94a'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#fff6d8'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    lines.forEach((l, i) => ctx.fillText(l, hx + 14, hy + 12 + px * (1 + i * 1.3)));
  }
  // banner for a finished throw
  if (state.banner) {
    const b = state.banner, k = clamp(b.t / 0.25, 0, 1), a = b.t > b.max - 0.4 ? clamp((b.max - b.t) / 0.4, 0, 1) : 1;
    const cx = stage.x + stage.w / 2, cy = stage.y + stage.h * 0.36;
    ctx.save(); ctx.globalAlpha = a; ctx.translate(cx, cy); ctx.scale(0.8 + 0.2 * k, 0.8 + 0.2 * k);
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.lineJoin = 'round';
    const bs = Math.round(Math.min(stage.w * 0.2, 130));
    roundPath(ctx, -bs * 1.55, -bs * 0.95, bs * 3.1, bs * 1.6, bs * 0.3); ctx.fillStyle = 'rgba(8,24,48,0.42)'; ctx.fill();
    ctx.font = `800 ${bs}px ${DISPLAY}`; ctx.lineWidth = bs * 0.14; ctx.strokeStyle = 'rgba(6,20,42,0.85)'; ctx.strokeText(b.text, 0, 0);
    ctx.fillStyle = b.col || '#fff'; ctx.fillText(b.text, 0, 0);
    ctx.font = `700 ${Math.round(bs * 0.26)}px ${FONT}`; ctx.lineWidth = bs * 0.06; ctx.strokeText(b.sub, 0, bs * 0.34); ctx.fillStyle = '#e6f6ff'; ctx.fillText(b.sub, 0, bs * 0.34);
    ctx.restore();
  }
  // toast
  if (state.toastT > 0 && state.toast) {
    const a = Math.min(1, state.toastT / 0.4);
    ctx.save(); ctx.globalAlpha = a;
    const px = Math.max(L.fs.toast, minF());
    ctx.font = `700 ${px}px ${FONT}`;
    const lines = wrap(ctx, state.toast, Math.min(stage.w - 50, 600));
    const w = Math.min(stage.w - 30, Math.max(...lines.map((l) => ctx.measureText(l).width)) + 40), h = lines.length * px * 1.3 + 22;
    const x = stage.x + (stage.w - w) / 2, y = stage.y + stage.h * 0.2;
    roundPath(ctx, x, y, w, h, 18); ctx.fillStyle = 'rgba(10,26,48,0.86)'; ctx.fill();
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    lines.forEach((l, i) => ctx.fillText(l, x + w / 2, y + 12 + px * (1 + i * 1.3)));
    ctx.restore();
  }
  void makeCam;
}

function wrap(ctx, text, maxW) {
  const words = String(text).split(' '), lines = [];
  let line = '';
  for (const wd of words) { const n = line ? `${line} ${wd}` : wd; if (line && ctx.measureText(n).width > maxW) { lines.push(line); line = wd; } else line = n; }
  if (line) lines.push(line);
  return lines;
}
