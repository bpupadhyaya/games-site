// The race HUD drawn over the 3D river: progress bar, place, sync and energy meters, tempo banner, the drum pad with its
// closing rings, the steering stick, the Surge button, pop-ups, countdown, the coach panel, hint, pause menu, tutorial prompts,
// and a top-down 2D fallback when WebGL is missing.
import { COL, FONT_D, R, icon } from './ui.js';
import { clamp, lerp, TIER_LABEL, fmtTime, placeName, HALF_LEN, laneX, spm } from './common.js';
import { project } from './cam.js';
import { COACH, TUT } from './content.js';
import { drawCredit } from './brand.js';

export const TIER_COL = { perfect: '#ffe27a', great: '#7dffb0', good: '#7fd0ff', ragged: '#ffa070', miss: '#ff6a6a', stray: '#a0a8b8' };
const CALL_COL = { up: '#ffc65a', settle: '#6fd8ff', sprint: '#ff6a4a' };
const CALL_TEXT = { up: 'UP', settle: 'SETTLE', sprint: 'SPRINT' };
const hsl = (h, s = 70, l = 52, a = 1) => `hsla(${h},${s}%,${l}%,${a})`;
const panel = (ctx, r, o = {}) => {
  ctx.save(); ctx.fillStyle = o.fill ?? 'rgba(6,16,30,0.62)'; ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, o.radius ?? 16); ctx.fill();
  if (o.edge !== false) { ctx.lineWidth = 1.5; ctx.strokeStyle = o.stroke ?? 'rgba(255,214,130,0.35)'; ctx.stroke(); }
  ctx.restore();
};

export const rankOf = (w) => {
  const me = w.boats[0]; let n = 0;
  for (let i = 1; i < w.boats.length; i++) if (w.boats[i].z > me.z + 0.001) n += 1;
  return n;
};

// ---- the drum pad ------------------------------------------------------------------------------------------------------
export function drawPad(ctx, cx, cy, r, o = {}) {
  ctx.save();
  // soft shadow and outer ring
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.arc(cx + 3, cy + 8, r * 1.02, 0, 6.3); ctx.fill();
  const rim = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.4, r * 0.2, cx, cy, r * 1.02);
  rim.addColorStop(0, '#d8483a'); rim.addColorStop(1, '#7a1414');
  ctx.fillStyle = rim; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 6.3); ctx.fill();
  ctx.lineWidth = r * 0.07; ctx.strokeStyle = '#e8b64a'; ctx.beginPath(); ctx.arc(cx, cy, r * 0.97, 0, 6.3); ctx.stroke();
  for (let i = 0; i < 20; i++) { const a = (i / 20) * 6.2832; ctx.fillStyle = '#ffd98a'; ctx.beginPath(); ctx.arc(cx + Math.cos(a) * r * 0.885, cy + Math.sin(a) * r * 0.885, r * 0.028, 0, 6.3); ctx.fill(); }
  const skin = ctx.createRadialGradient(cx - r * 0.2, cy - r * 0.25, r * 0.1, cx, cy, r * 0.8);
  skin.addColorStop(0, '#fbf0d6'); skin.addColorStop(1, '#dcc794');
  ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(cx, cy, r * 0.78, 0, 6.3); ctx.fill();
  if (o.flash) { ctx.fillStyle = o.flashCol ?? '#ffe27a'; ctx.globalAlpha = o.flash * 0.7; ctx.beginPath(); ctx.arc(cx, cy, r * 0.78, 0, 6.3); ctx.fill(); ctx.globalAlpha = 1; }
  // the target ring
  ctx.lineWidth = Math.max(3, r * 0.04); ctx.strokeStyle = o.glow ? '#fff3b0' : 'rgba(120,40,20,0.75)';
  ctx.beginPath(); ctx.arc(cx, cy, r * 0.62, 0, 6.3); ctx.stroke();
  // approach rings: o.rings = [{k: 0..1 (1 = about to hit), a: alpha, col}]
  for (const q of o.rings ?? []) {
    const rad = r * 0.62 * (1 + 1.55 * (1 - q.k));
    ctx.lineWidth = Math.max(3, r * 0.05) * (0.6 + 0.6 * q.k); ctx.strokeStyle = q.col ?? '#ffcf5a'; ctx.globalAlpha = q.a;
    ctx.beginPath(); ctx.arc(cx, cy, rad, 0, 6.3); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  if (o.label) { ctx.font = `800 ${r * 0.3}px ${FONT_D}`; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(120,40,20,0.65)'; ctx.fillText(o.label, cx, cy + r * 0.1); }
  ctx.restore();
}

function ringsFor(w, now) {
  const out = [];
  const LOOK = 1.25;
  for (const b of w.beats) {
    const d = b.t - now;
    if (d < -0.14 || d > LOOK) continue;
    if (b.judged && b.i >= 0 && b.q && d < 0) continue;
    const k = 1 - clamp(d / LOOK, 0, 1);
    out.push({ k, a: clamp(0.25 + 0.75 * k, 0, 1) * (b.i < 0 ? 0.55 : 1), col: b.i < 0 ? '#cfe6ff' : b.kind === 'up' ? '#ffc65a' : b.kind === 'sprint' ? '#ff7a4a' : b.kind === 'settle' ? '#8fe0ff' : '#ffcf5a' });
  }
  return out;
}

// ---- bits ----------------------------------------------------------------------------------------------------------------
function meterBar(ctx, ui, r, v, label, cols, pulse) {
  panel(ctx, r, { radius: r.h / 2, fill: 'rgba(4,12,24,0.7)' });
  const pad = 3, iw = Math.max(0, (r.w - pad * 2) * clamp(v, 0, 1));
  if (iw > 2) {
    const g = ctx.createLinearGradient(r.x, 0, r.x + r.w, 0); cols.forEach((c, i) => g.addColorStop(i / (cols.length - 1), c));
    ctx.save(); ctx.beginPath(); ctx.roundRect(r.x + pad, r.y + pad, iw, r.h - pad * 2, (r.h - pad * 2) / 2); ctx.clip();
    ctx.fillStyle = g; ctx.fillRect(r.x, r.y, r.w, r.h);
    if (pulse) { ctx.fillStyle = `rgba(255,255,255,${0.2 + 0.2 * Math.sin(ui.t * 10)})`; ctx.fillRect(r.x, r.y, r.w, r.h); }
    ctx.restore();
  }
  ui.text(ctx, label, r.x + 12, r.y + r.h * 0.5 + 6, 17, { disp: true, weight: 800, fixed: true, color: '#fff', shadow: true });
  ui.text(ctx, `${Math.round(v * 100)}%`, r.x + r.w - 12, r.y + r.h * 0.5 + 6, 17, { disp: true, weight: 800, fixed: true, align: 'right', color: '#fff', shadow: true });
}

function progressBar(ctx, ui, r, w) {
  panel(ctx, R(r.x - 6, r.y - 6, r.w + 12, r.h + 12), { radius: 20, fill: 'rgba(4,12,24,0.55)' });
  const y = r.y + r.h * 0.5 - 2;
  ctx.save();
  ctx.strokeStyle = 'rgba(180,215,255,0.35)'; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(r.x + 14, y); ctx.lineTo(r.x + r.w - 14, y); ctx.stroke();
  ctx.lineWidth = 2; for (let i = 1; i < 4; i++) { const x = r.x + 14 + (r.w - 28) * (i / 4); ctx.beginPath(); ctx.moveTo(x, y - 7); ctx.lineTo(x, y + 7); ctx.stroke(); }
  // checkered flag at the end
  const fx = r.x + r.w - 14;
  for (let a = 0; a < 3; a++) for (let b = 0; b < 2; b++) { ctx.fillStyle = (a + b) % 2 ? '#111' : '#fff'; ctx.fillRect(fx - 2 + a * 5, y - 22 + b * 5, 5, 5); }
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(fx - 2, y - 22); ctx.lineTo(fx - 2, y + 4); ctx.stroke();
  const order = w.boats.map((b, i) => i).reverse();
  for (const i of order) {
    const b = w.boats[i], f = clamp((b.z + HALF_LEN) / w.len, 0, 1), x = r.x + 14 + (r.w - 28) * f;
    ctx.fillStyle = hsl(b.hue, 70, 52); ctx.strokeStyle = '#fff'; ctx.lineWidth = b.mine ? 3 : 1.5;
    ctx.beginPath(); ctx.arc(x, y, b.mine ? 11 : 8, 0, 6.3); ctx.fill(); ctx.stroke();
    if (b.mine) { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(x, y + 16); ctx.lineTo(x - 5, y + 24); ctx.lineTo(x + 5, y + 24); ctx.fill(); }
  }
  ctx.restore();
  const left = Math.max(0, Math.round(w.len - (w.boats[0].z + HALF_LEN)));
  ui.text(ctx, `${left} m`, r.x + r.w / 2, r.y + r.h - 1, 17, { disp: true, weight: 800, fixed: true, align: 'center', color: 'rgba(235,245,255,0.9)', shadow: true });
}

function placeBadge(ctx, ui, r, w) {
  const p = w.phase === 'done' || me(w).finished ? me(w).place ?? rankOf(w) : rankOf(w);
  panel(ctx, r, { radius: 18, fill: 'rgba(120,20,16,0.82)', stroke: 'rgba(255,214,130,0.8)' });
  ui.text(ctx, placeName(p).toUpperCase(), r.x + r.w / 2, r.y + r.h * 0.5 + 15, 44, { disp: true, weight: 800, fixed: true, align: 'center', color: '#fff2c8', shadow: true });
}
const me = (w) => w.boats[0];

function banner(ctx, ui, L, w, state) {
  const H = L.hud, cx = L.U.x + L.U.w / 2, y = H.bannerY;
  const t = w.t;
  if (w.phase === 'count') {
    const txt = t < -1.8 ? 'READY' : t < -1.2 ? '3' : t < -0.6 ? '2' : '1';
    const k = (t < -1.8 ? 0 : ((t + 1.8) % 0.6) / 0.6);
    ui.text(ctx, txt, cx, L.h * 0.34, 150 * (1.25 - k * 0.25), { disp: true, weight: 800, fixed: true, align: 'center', color: '#fff3c2', stroke: 14, strokeColor: 'rgba(120,20,16,0.9)' });
    return;
  }
  if (w.phase === 'race' && t < 1.1) {
    ui.text(ctx, 'GO!', cx, L.h * 0.34, 170 * (1 + (t) * 0.3), { disp: true, weight: 800, fixed: true, align: 'center', color: '#ffe27a', stroke: 14, strokeColor: 'rgba(120,20,16,0.9)' });
  }
  const c = w.call;
  if (!c) return;
  if (w.mode === 'drum') {
    const d = w.drumMode;
    const txt = `${c.label}  ${c.lo}-${c.hi} spm`;
    panel(ctx, R(cx - 190, y - 34, 380, 52), { radius: 26, fill: 'rgba(4,12,24,0.7)' });
    ui.text(ctx, txt, cx, y + 4, 34, { disp: true, weight: 800, fixed: true, align: 'center', color: c.lift ? '#ffe27a' : '#fff' });
    if (c.lift && Math.sin(ui.t * 14) > -0.3) ui.text(ctx, 'LIFT!  TAP TWICE', cx, y + 58, 40, { disp: true, weight: 800, fixed: true, align: 'center', color: '#ffe27a', stroke: 8, strokeColor: 'rgba(120,20,16,0.9)' });
    return;
  }
  if (c.kind) {
    const col = CALL_COL[c.kind];
    const flash = c.inBeats <= 2 ? 0.55 + 0.45 * Math.sin(ui.t * 16) : 1;
    panel(ctx, R(cx - 200, y - 34, 400, 52), { radius: 26, fill: 'rgba(4,12,24,0.72)', stroke: col });
    ui.text(ctx, `${CALL_TEXT[c.kind]}  ${c.spm} spm  in ${c.inBeats}`, cx, y + 4, 33, { disp: true, weight: 800, fixed: true, align: 'center', color: col });
    ctx.globalAlpha = 1;
  } else {
    ui.text(ctx, `${c.spm} strokes/min`, cx, y + 2, 22, { disp: true, weight: 700, fixed: true, align: 'center', color: 'rgba(235,245,255,0.7)', shadow: true });
  }
}

function controls(ctx, ui, L, G) {
  const { state, sim } = G, w = sim.w, H = L.hud, pad = H.pad, now = w.t;
  const auto = !!w.auto && !state.noCoach;
  const last = state.lastTap;
  const flash = last ? clamp(1 - (state.t - last.at) / 0.22, 0, 1) : 0;
  const near = w.beats.find((b) => b.i >= 0 && Math.abs(b.t - now) < 0.08);
  const rings = w.mode === 'drum' && w.phase !== 'count' ? [] : ringsFor(w, now);
  drawPad(ctx, pad.cx, pad.cy, pad.r, { rings, flash, flashCol: last ? TIER_COL[last.tier] : null, glow: !!near, label: w.t < 4 && w.mode === 'race' ? 'TAP' : w.mode === 'drum' ? 'DRUM' : '' });
  if (w.mode === 'drum' && w.phase === 'count') {
    for (const g of w.drumMode.guide) if (g !== null && g - now < 1.2 && g - now > -0.1) { const k = 1 - clamp((g - now) / 1.2, 0, 1); ctx.save(); ctx.strokeStyle = '#cfe6ff'; ctx.lineWidth = 6 * (0.6 + 0.6 * k); ctx.globalAlpha = 0.3 + 0.7 * k; ctx.beginPath(); ctx.arc(pad.cx, pad.cy, pad.r * 0.62 * (1 + 1.55 * (1 - k)), 0, 6.3); ctx.stroke(); ctx.restore(); }
  }
  // timing strip with the last taps
  {
    const sw = pad.r * 2.1, sy = pad.cy - pad.r - 26, sx = pad.cx - sw / 2;
    ctx.save(); ctx.fillStyle = 'rgba(4,12,24,0.55)'; ctx.beginPath(); ctx.roundRect(sx, sy - 9, sw, 18, 9); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.fillRect(pad.cx - 1.5, sy - 13, 3, 26);
    ui.text(ctx, 'EARLY', sx + 8, sy + 4, 12, { weight: 700, fixed: true, color: 'rgba(200,220,255,0.55)' });
    ui.text(ctx, 'LATE', sx + sw - 8, sy + 4, 12, { weight: 700, fixed: true, align: 'right', color: 'rgba(200,220,255,0.55)' });
    const taps = state.tapLog.slice(-6);
    taps.forEach((tp, i) => {
      if (tp.tier === 'miss' || tp.tier === 'stray') return;
      const a = (i + 1) / taps.length, x = pad.cx + clamp(tp.err / (w.win[3] * 1.05), -1, 1) * (sw / 2 - 12);
      ctx.fillStyle = TIER_COL[tp.tier]; ctx.globalAlpha = 0.25 + 0.75 * a; ctx.beginPath(); ctx.arc(x, sy, 3 + 4 * a, 0, 6.3); ctx.fill();
    });
    ctx.restore();
  }
  // steering stick
  if (w.mode !== 'drum' && !auto) {
    const s = H.stick, ts = state.touchSteer;
    ctx.save();
    const cx = ts ? ts.ox : s.cx, cy = ts ? ts.oy : s.cy;
    ctx.fillStyle = 'rgba(4,12,24,0.45)'; ctx.beginPath(); ctx.arc(cx, cy, s.r, 0, 6.3); ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = ts ? 'rgba(255,214,130,0.9)' : 'rgba(255,214,130,0.4)'; ctx.stroke();
    const k = clamp(state.steer, -1, 1);
    ctx.fillStyle = ts ? '#ffd98a' : 'rgba(255,214,130,0.55)'; ctx.beginPath(); ctx.arc(cx + k * s.r * 0.8, cy, s.r * 0.36, 0, 6.3); ctx.fill();
    ctx.strokeStyle = 'rgba(235,245,255,0.8)'; ctx.lineWidth = 4; ctx.lineCap = 'round';
    for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(cx + sd * s.r * 0.56, cy - 12); ctx.lineTo(cx + sd * s.r * 0.7, cy); ctx.lineTo(cx + sd * s.r * 0.56, cy + 12); ctx.stroke(); }
    if (!ts && state.t % 1 < 2) ui.text(ctx, 'STEER', cx, cy + s.r + 26, 20, { disp: true, weight: 800, fixed: true, align: 'center', color: 'rgba(235,245,255,0.6)' });
    ctx.restore();
  }
  // surge button
  const sg = H.surge, ready = w.surge.meter >= 1 && w.surge.on <= 0, on = w.surge.on > 0;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.arc(sg.cx + 2, sg.cy + 5, sg.r, 0, 6.3); ctx.fill();
  const g = ctx.createRadialGradient(sg.cx - sg.r * 0.3, sg.cy - sg.r * 0.4, 4, sg.cx, sg.cy, sg.r);
  g.addColorStop(0, ready || on ? '#ffe9a0' : '#4a5468'); g.addColorStop(1, ready || on ? '#d99a1c' : '#252d3c');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(sg.cx, sg.cy, sg.r, 0, 6.3); ctx.fill();
  ctx.lineWidth = 7; ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.beginPath(); ctx.arc(sg.cx, sg.cy, sg.r + 4, 0, 6.3); ctx.stroke();
  ctx.strokeStyle = on ? '#fff3b0' : '#ffc23a'; ctx.beginPath(); ctx.arc(sg.cx, sg.cy, sg.r + 4, -1.5708, -1.5708 + 6.2832 * clamp(w.surge.meter, 0, 1)); ctx.stroke();
  if (ready) { ctx.strokeStyle = `rgba(255,243,176,${0.4 + 0.4 * Math.sin(ui.t * 9)})`; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(sg.cx, sg.cy, sg.r + 12 + 3 * Math.sin(ui.t * 9), 0, 6.3); ctx.stroke(); }
  ctx.restore();
  icon(ctx, 'bolt', sg.cx, sg.cy - sg.r * 0.12, sg.r * 0.9, ready || on ? '#6a3a00' : 'rgba(255,255,255,0.45)');
  ui.text(ctx, on ? `${w.surge.on.toFixed(1)}` : 'SURGE', sg.cx, sg.cy + sg.r * 0.62, 17, { disp: true, weight: 800, fixed: true, align: 'center', color: ready || on ? '#5a3000' : 'rgba(255,255,255,0.5)' });
  if (!auto) ui.hit('surge', R(sg.cx - sg.r - 8, sg.cy - sg.r - 8, sg.r * 2 + 16, sg.r * 2 + 16));
}

function pops(ctx, ui, L, state) {
  const pad = L.hud.pad;
  for (const p of state.pops) {
    const k = p.t / p.life, y = pad.cy - pad.r - 70 - k * 46;
    ctx.save(); ctx.globalAlpha = clamp(1.5 - k * 1.5, 0, 1);
    ui.text(ctx, p.text, pad.cx - pad.r * 0.55 + (p.dx ?? 0), y, (p.size ?? 1) * 36 * (1.15 - 0.15 * Math.min(1, k * 4)), { disp: true, weight: 800, fixed: true, align: 'center', color: p.color, stroke: 7, strokeColor: 'rgba(10,16,30,0.9)' });
    ctx.restore();
  }
}

function thinkPanel(ctx, ui, L, G) {
  const { state } = G, th = state.think;
  if (!th) return;
  const U = L.U, w = Math.min(U.w - 32, 640), x = U.x + (U.w - w) / 2;
  const info = COACH[th.id], z0 = ui.zoom; ui.zoom = Math.min(G.zoom, 1.5);
  const bodyH = ui.paraHeight(ctx, info.text, w - 40, 22);
  const h = 34 + ui.fs(24) + ui.fs(30) * 1.35 + bodyH + 40, y = L.hud.meters.y + L.hud.meters.h + 16;
  panel(ctx, R(x, y, w, h), { radius: 22, fill: 'rgba(4,12,24,0.88)', stroke: th.phase === 'think' ? 'rgba(255,214,130,0.9)' : 'rgba(125,255,176,0.9)' });
  ui.text(ctx, `${th.phase === 'think' ? 'THINK' : 'REVEAL'}  ${Math.max(0, Math.ceil(th.dur - th.t))}s`, x + 20, y + 20 + ui.fs(24) * 0.8, 24, { disp: true, weight: 800, color: th.phase === 'think' ? '#ffc65a' : '#7dffb0' });
  ui.text(ctx, info.title.toUpperCase(), x + 20, y + 28 + ui.fs(24) + ui.fs(30) * 0.85, 30, { disp: true, weight: 800, fit: w - 40 });
  ui.para(ctx, info.text, x + 20, y + 34 + ui.fs(24) + ui.fs(30) * 1.35, w - 40, 22, { color: COL.ink, weight: 500 });
  ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fillRect(x + 20, y + h - 22, w - 40, 6);
  ctx.fillStyle = th.phase === 'think' ? '#ffc65a' : '#7dffb0'; ctx.fillRect(x + 20, y + h - 22, (w - 40) * clamp(th.t / th.dur, 0, 1), 6);
  ui.zoom = z0;
}

function laneMarker(ctx, ui, L, G, x, text, col) {
  const cam = G.state.cam; if (!cam) return;
  const w = G.sim.w, me = w.boats[0];
  const p = project(cam, L, x, 1.2, me.z + 22);
  if (!p) return;
  ctx.save(); ctx.translate(p.x, p.y); ctx.fillStyle = col; ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 4;
  const bob = Math.sin(ui.t * 6) * 6;
  ctx.beginPath(); ctx.moveTo(0, bob + 28); ctx.lineTo(-22, bob); ctx.lineTo(-9, bob); ctx.lineTo(-9, bob - 26); ctx.lineTo(9, bob - 26); ctx.lineTo(9, bob); ctx.lineTo(22, bob); ctx.closePath(); ctx.stroke(); ctx.fill();
  ctx.restore();
  if (text) ui.text(ctx, text, p.x, p.y - 44, 22, { disp: true, weight: 800, fixed: true, align: 'center', color: col, stroke: 5, strokeColor: 'rgba(0,0,0,0.8)' });
}

function tutPrompt(ctx, ui, L, G) {
  const { state } = G, t = state.tut; if (!t) return;
  const U = L.U, w = Math.min(U.w - 32, 640), x = U.x + (U.w - w) / 2, z0 = ui.zoom; ui.zoom = Math.min(G.zoom, 1.5);
  const say = t.done ? 'Well done! You know the beat.' : TUT[t.step].say;
  const bodyH = ui.paraHeight(ctx, say, w - 40, 24), h = bodyH + 64, y = L.hud.meters.y + L.hud.meters.h + 16;
  panel(ctx, R(x, y, w, h), { radius: 20, fill: 'rgba(4,12,24,0.88)', stroke: 'rgba(125,255,176,0.8)' });
  for (let i = 0; i < TUT.length; i++) { ctx.fillStyle = i < t.step || t.done ? '#7dffb0' : i === t.step ? '#ffc65a' : 'rgba(255,255,255,0.25)'; ctx.beginPath(); ctx.arc(x + 24 + i * 22, y + 20, 6, 0, 6.3); ctx.fill(); }
  ui.para(ctx, say, x + 20, y + 28, w - 40, 24, { color: COL.ink, weight: 600 });
  ui.zoom = z0;
}

function hintPanel(ctx, ui, L, G) {
  const { state } = G, hn = state.hint; if (!hn) return;
  const U = L.U, w = Math.min(U.w - 32, 640), x = U.x + (U.w - w) / 2, z0 = ui.zoom; ui.zoom = Math.min(G.zoom, 1.5);
  const bodyH = ui.paraHeight(ctx, hn.text, w - 40, 22), h = bodyH + 40, y = L.hud.meters.y + L.hud.meters.h + 16;
  panel(ctx, R(x, y, w, h), { radius: 20, fill: 'rgba(4,12,24,0.88)', stroke: 'rgba(255,214,130,0.9)' });
  ui.para(ctx, hn.text, x + 20, y + 16, w - 40, 22, { color: COL.ink, weight: 600 });
  ui.zoom = z0;
  if (hn.x !== undefined) laneMarker(ctx, ui, L, G, hn.x, 'HERE', '#ffe27a');
}

// ---- the whole HUD ---------------------------------------------------------------------------------------------------------
export function drawRaceHud(ctx, G) {
  const { state, L, ui, sim } = G;
  const w = sim.w, H = L.hud, auto = !!w.auto && !state.noCoach, m = state.match;
  ui.zoom = 1;
  // readability gradients
  const g = ctx.createLinearGradient(0, 0, 0, L.h);
  g.addColorStop(0, 'rgba(3,10,20,0.62)'); g.addColorStop(0.22, 'rgba(3,10,20,0)'); g.addColorStop(0.72, 'rgba(3,10,20,0)'); g.addColorStop(1, 'rgba(3,10,20,0.62)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, L.w, L.h);
  if (state.intro) { introCard(ctx, ui, L, G); return; }
  progressBar(ctx, ui, H.prog, w);
  placeBadge(ctx, ui, H.place, w);
  ui.button(ctx, 'pause', H.pause, '', { kind: 'chip', icon: 'pause', size: 30, radius: 18 });
  if (!auto && m.kind !== 'lesson') ui.button(ctx, 'hint', H.hint, '', { kind: 'chip', icon: 'bulb', size: 30, radius: 18, disabled: state.hintsLeft <= 0 || w.phase !== 'race' });
  // meters
  const mr = H.meters, half = (mr.w - 12) / 2;
  const mine = w.boats[0];
  meterBar(ctx, ui, R(mr.x, mr.y, half, 30), mine.Sd, 'SYNC', ['#e04a3a', '#ffc23a', '#4fe08a'], mine.Sd < 0.3 && w.phase === 'race');
  meterBar(ctx, ui, R(mr.x + half + 12, mr.y, half, 30), mine.E, 'ENERGY', mine.E < 0.35 ? ['#ff9a3a', '#ffb25a', '#ffcf7a'] : ['#2f9be0', '#4fd0e8', '#7ff0f0'], false);
  if (w.streak >= 3) ui.text(ctx, `${w.streak} IN A ROW`, mr.x + mr.w / 2, mr.y + 52, 22, { disp: true, weight: 800, fixed: true, align: 'center', color: '#ffe27a', shadow: true });
  const flags = [];
  if (mine.draft > 0.02) flags.push(['DRAFT', '#8fe0ff']);
  if (mine.cur > 0.5) flags.push(['STREAM', '#7dffb0']);
  if (w.surge.on > 0) flags.push(['SURGE', '#ffd25a']);
  flags.forEach((f, i) => ui.text(ctx, f[0], mr.x + mr.w / 2 + (i - (flags.length - 1) / 2) * 120, mr.y + 80, 22, { disp: true, weight: 800, fixed: true, align: 'center', color: f[1], stroke: 5, strokeColor: 'rgba(0,0,0,0.7)' }));
  banner(ctx, ui, L, w, state);
  if (!state.paused || true) controls(ctx, ui, L, G);
  pops(ctx, ui, L, state);
  if (state.think) thinkPanel(ctx, ui, L, G);
  else if (state.tut) tutPrompt(ctx, ui, L, G);
  else if (state.hint) hintPanel(ctx, ui, L, G);
  if (state.think && state.think.phase === 'reveal') {
    const f = COACH[state.think.id].focus;
    if (f === 'pad') { ctx.save(); ctx.strokeStyle = '#7dffb0'; ctx.lineWidth = 6; ctx.globalAlpha = 0.5 + 0.5 * Math.sin(ui.t * 9); ctx.beginPath(); ctx.arc(H.pad.cx, H.pad.cy, H.pad.r * 1.15, 0, 6.3); ctx.stroke(); ctx.restore(); }
    else if (f === 'surge') { ctx.save(); ctx.strokeStyle = '#7dffb0'; ctx.lineWidth = 6; ctx.globalAlpha = 0.5 + 0.5 * Math.sin(ui.t * 9); ctx.beginPath(); ctx.arc(H.surge.cx, H.surge.cy, H.surge.r + 20, 0, 6.3); ctx.stroke(); ctx.restore(); }
    else if (f === 'lane') laneMarker(ctx, ui, L, G, w.boats[0].tx, 'THE PLAN', '#7dffb0');
    else if (f === 'banner') { ctx.save(); ctx.strokeStyle = '#7dffb0'; ctx.lineWidth = 5; ctx.globalAlpha = 0.5 + 0.5 * Math.sin(ui.t * 9); ctx.beginPath(); ctx.roundRect(L.U.x + L.U.w / 2 - 210, H.bannerY - 40, 420, 64, 30); ctx.stroke(); ctx.restore(); }
  }
  if (auto) coachControls(ctx, ui, L, G);
  if (state.paused && !state.think) pauseMenu(ctx, ui, L, G);
  if (state.confirm === 'leave') leaveDialog(ctx, ui, L, G);
  if (w.phase === 'finish' || w.phase === 'done') finishBanner(ctx, ui, L, w);
  // discreet Arcforge credit while the player is not busy (count-in)
  if (w.phase === 'count' && !auto) drawCredit(ctx, L.U.x + L.U.w / 2, L.U.y + L.U.h - 10 - L.ins.b * 0.2, 12, { dim: 0.6 });
}

function introCard(ctx, ui, L, G) {
  const { state } = G, m = state.match, w = G.sim.w;
  const U = L.U, cx = U.x + U.w / 2;
  const k = clamp(state.intro.t / state.intro.dur, 0, 1), a = k < 0.12 ? k / 0.12 : k > 0.86 ? (1 - k) / 0.14 : 1;
  ctx.save(); ctx.globalAlpha = a;
  ui.text(ctx, (m.title || 'RACE').toUpperCase(), cx, U.y + L.h * 0.12, 66, { disp: true, weight: 800, fixed: true, align: 'center', color: '#fff3c2', stroke: 10, strokeColor: 'rgba(120,20,16,0.9)', fit: U.w - 40 });
  ui.text(ctx, m.sub || `${w.len} metres`, cx, U.y + L.h * 0.12 + 44, 28, { disp: true, weight: 700, fixed: true, align: 'center', color: '#ffe27a', shadow: true });
  // the four crews
  const bw = Math.min(U.w - 40, 560), x0 = cx - bw / 2, y0 = U.y + L.h * 0.12 + 76, rh = 44;
  w.boats.forEach((b, i) => {
    const y = y0 + i * (rh + 8);
    panel(ctx, R(x0, y, bw, rh), { radius: 14, fill: b.mine ? 'rgba(120,20,16,0.7)' : 'rgba(4,12,24,0.66)', stroke: hsl(b.hue, 70, 60, 0.9) });
    ctx.fillStyle = hsl(b.hue, 70, 52); ctx.beginPath(); ctx.arc(x0 + 26, y + rh / 2, 11, 0, 6.3); ctx.fill();
    ui.text(ctx, b.name.toUpperCase(), x0 + 50, y + rh / 2 + 9, 26, { disp: true, weight: 800, fixed: true, fit: bw * 0.52 });
    ui.text(ctx, `LANE ${b.lane + 1}`, x0 + bw - 14, y + rh / 2 + 7, 20, { disp: true, weight: 700, fixed: true, align: 'right', color: COL.dim });
  });
  ctx.restore();
  ui.button(ctx, 'skipintro', R(cx - 90, U.y + U.h - 100 - L.ins.b * 0.3, 180, 56), 'SKIP', { kind: 'chip', size: 24 });
}

function coachControls(ctx, ui, L, G) {
  const { state } = G, H = L.hud, st = H.stick;
  const bw = 150, bh = 56, x = Math.max(L.U.x + 12, st.cx - bw), y = st.cy - bh * 1.6;
  ui.button(ctx, 'a:pause', R(x, y, bw, bh), state.paused ? 'RESUME' : 'PAUSE', { kind: 'primary', icon: state.paused ? 'play' : 'pause', size: 24, radius: 20 });
  ui.button(ctx, 'a:exit', R(x, y + bh + 10, bw, bh), 'EXIT', { kind: 'chip', icon: 'close', size: 24, radius: 20 });
  const ty = y + 2 * (bh + 10);
  ui.text(ctx, `THINK ${G.THINK_STEPS[state.prefs.thinkIdx]}s`, x + bw / 2, ty + 30, 22, { disp: true, weight: 800, fixed: true, align: 'center', color: COL.dim });
  ui.button(ctx, 'a:dec', R(x, ty + 40, 68, 46), '−', { kind: 'chip', size: 28, radius: 16, disabled: state.prefs.thinkIdx <= 0 });
  ui.button(ctx, 'a:inc', R(x + bw - 68, ty + 40, 68, 46), '+', { kind: 'chip', size: 28, radius: 16, disabled: state.prefs.thinkIdx >= G.THINK_STEPS.length - 1 });
  ui.text(ctx, 'COACH', L.U.x + L.U.w / 2, L.U.y + L.U.h - 18 - L.ins.b * 0.2, 18, { disp: true, weight: 800, fixed: true, align: 'center', color: 'rgba(235,245,255,0.5)' });
}

function pauseMenu(ctx, ui, L, G) {
  const { state } = G, U = L.U;
  ctx.fillStyle = 'rgba(2,8,16,0.55)'; ctx.fillRect(0, 0, L.w, L.h);
  const w = Math.min(U.w - 40, 520), h = 420, x = U.x + (U.w - w) / 2, y = U.y + (U.h - h) / 2;
  panel(ctx, R(x, y, w, h), { radius: 26, fill: 'rgba(8,18,34,0.96)', stroke: 'rgba(255,214,130,0.7)' });
  ui.text(ctx, 'PAUSED', x + w / 2, y + 76, 64, { disp: true, weight: 800, fixed: true, align: 'center', shadow: true });
  ui.button(ctx, 'resume', R(x + 30, y + 110, w - 60, 78), 'RESUME', { kind: 'primary', icon: 'play', size: 38 });
  ui.button(ctx, 'p:sound', R(x + 30, y + 204, (w - 72) / 2, 66), state.prefs.sound ? 'SOUND ON' : 'SOUND OFF', { kind: 'secondary', icon: state.prefs.sound ? 'sound' : 'mute', size: 24 });
  ui.button(ctx, 'p:click', R(x + 42 + (w - 72) / 2, y + 204, (w - 72) / 2, 66), state.prefs.click ? 'CLICK ON' : 'CLICK OFF', { kind: 'secondary', size: 24 });
  ui.button(ctx, 'leave', R(x + 30, y + 288, w - 60, 78), 'LEAVE RACE', { kind: 'danger', icon: 'close', size: 32 });
}
export function leaveDialog(ctx, ui, L, G) {
  const U = L.U;
  ctx.fillStyle = 'rgba(2,8,16,0.65)'; ctx.fillRect(0, 0, L.w, L.h);
  const w = Math.min(U.w - 40, 520), h = 300, x = U.x + (U.w - w) / 2, y = U.y + (U.h - h) / 2;
  panel(ctx, R(x, y, w, h), { radius: 26, fill: 'rgba(8,18,34,0.97)', stroke: 'rgba(255,120,100,0.8)' });
  ui.text(ctx, 'LEAVE THE RACE?', x + w / 2, y + 74, 46, { disp: true, weight: 800, fixed: true, align: 'center', fit: w - 40 });
  ui.text(ctx, 'Your progress in this race will be lost.', x + w / 2, y + 112, 22, { align: 'center', color: COL.dim, fixed: true, fit: w - 40 });
  ui.button(ctx, 'leave:no', R(x + 30, y + 150, w - 60, 66), 'KEEP RACING', { kind: 'primary', size: 30 });
  ui.button(ctx, 'leave:yes', R(x + 30, y + 226, w - 60, 56), 'LEAVE', { kind: 'secondary', size: 26 });
}

function finishBanner(ctx, ui, L, w) {
  const mine = w.boats[0];
  if (!mine.finished) return;
  const t = w.t - mine.finishT, p = mine.place ?? rankOf(w);
  const a = clamp(t / 0.3, 0, 1), cx = L.U.x + L.U.w / 2;
  ctx.save(); ctx.globalAlpha = a;
  ui.text(ctx, p === 0 ? 'WINNER!' : 'FINISHED', cx, L.h * 0.3, p === 0 ? 120 : 96, { disp: true, weight: 800, fixed: true, align: 'center', color: p === 0 ? '#ffe27a' : '#fff', stroke: 12, strokeColor: 'rgba(120,20,16,0.9)', fit: L.U.w - 30 });
  ui.text(ctx, fmtTime(mine.finishT), cx, L.h * 0.3 + 56, 42, { disp: true, weight: 800, fixed: true, align: 'center', color: '#fff', shadow: true });
  ctx.restore();
}

// ---- 2D fallback (no WebGL): a top-down picture of the course ------------------------------------------------------------
export function drawFallback(ctx, G) {
  const { L, sim } = G, w = sim.w, me = w.boats[0];
  const land = L.mode === 'wide';
  ctx.save();
  ctx.fillStyle = '#0c3d56'; ctx.fillRect(0, 0, L.w, L.h);
  const top = L.hud.bannerY + 70, bottom = L.hud.pad.cy - L.hud.pad.r - 70, cx = L.w / 2, span = land ? 26 : 25;
  const sx = Math.min(L.w * 0.9 / 25, (bottom - top) / 90 * 0.9);
  const scale = Math.min(L.w / (span + 4), 28), scaleY = Math.max(4, (bottom - top) / 110);
  const toX = (x) => cx + (x - me.x * 0.5) * scale * 0.9, toY = (z) => bottom - (z - me.z + 14) * scaleY;
  ctx.fillStyle = '#0f4c68'; ctx.fillRect(toX(-12.5), 0, 25 * scale * 0.9, L.h);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2;
  for (const lx of [-10, -5, 0, 5, 10]) { ctx.setLineDash([6, 10]); ctx.beginPath(); ctx.moveTo(toX(lx), 0); ctx.lineTo(toX(lx), L.h); ctx.stroke(); }
  ctx.setLineDash([]);
  for (const s of w.streams) { ctx.fillStyle = 'rgba(160,240,255,0.22)'; ctx.fillRect(toX(s.x - s.w / 2), toY(s.z1), s.w * scale * 0.9, (s.z1 - s.z0) * scaleY); }
  for (const f of w.flotsam) if (!f.hit) { ctx.fillStyle = f.kind === 'log' ? '#8a5a30' : f.kind === 'mat' ? '#3f9a4a' : '#e8661e'; ctx.beginPath(); ctx.arc(toX(f.x), toY(f.z), Math.max(5, scale * 0.45), 0, 6.3); ctx.fill(); }
  // finish line
  ctx.fillStyle = '#fff'; ctx.fillRect(toX(-12.5), toY(w.len), 25 * scale * 0.9, 5);
  for (const b of w.boats) {
    const x = toX(b.x), y = toY(b.z), bh = 12.4 * scaleY, bw = Math.max(10, 1.3 * scale);
    ctx.fillStyle = hsl(b.hue, 65, 45); ctx.strokeStyle = b.mine ? '#fff' : 'rgba(255,255,255,0.5)'; ctx.lineWidth = b.mine ? 3 : 1.5;
    ctx.beginPath(); ctx.roundRect(x - bw / 2, y - bh / 2, bw, bh, bw / 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ffd98a'; ctx.beginPath(); ctx.arc(x, y - bh / 2, bw * 0.5, 0, 6.3); ctx.fill();
  }
  ctx.restore();
}
