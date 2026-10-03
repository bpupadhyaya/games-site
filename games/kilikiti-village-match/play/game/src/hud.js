// The in-play HUD: scoreboard, radar, role controls, cues projected through the fixed cameras, banners, Think card, pause menu, Watch & Learn panel.
// All text follows the 100-300% text size setting (the in-play scale is capped at 200% so the field stays visible; every line also shrinks to fit).
import { W, H, PITCH, FIELD, END_Z, clamp, lerp, ease, DEG } from './core.js';
import { PAL, FONT, SANS, rr, textFill, wrapLines, glow } from './art.js';
import { drawButton, drawPill, panel, TEXT_SCALES } from './ui.js';
import { project, unproject } from './camera.js';
import { viewOf, DEAD_T, HOLD_VIEW } from './sim.js';
import { deliveryPos, trackPos, DELIVERIES, DELIVERY_KEYS, SPEED, BOUNCE } from './ball.js';
import { REACH } from './field.js';
import { levelOf, MATE } from './ai.js';

export const R = {
  pause: { x: 640, y: 38, w: 62, h: 58 }, think: { x: 572, y: 38, w: 62, h: 58 },
  run: { x: 110, y: 1112, w: 500, h: 128 }, ready: { x: 110, y: 1112, w: 500, h: 128 },
  throwA: { x: 18, y: 1112, w: 338, h: 128 }, throwB: { x: 364, y: 1112, w: 338, h: 128 },
  speed: { x: 18, y: 1180, w: 190, h: 72 }, skip: { x: 222, y: 1180, w: 190, h: 72 },
  chips: [0, 1, 2].map((i) => ({ k: DELIVERY_KEYS[i], rect: { x: 18 + i * 232, y: 1176, w: 224, h: 76 } })),
  radar: { x: 556, y: 168, w: 148, h: 196 },
  autoPause: { x: 238, y: 1180, w: 244, h: 72 }, autoDec: { x: 492, y: 1180, w: 66, h: 72 }, autoInc: { x: 566, y: 1180, w: 66, h: 72 }, exit: { x: 18, y: 1180, w: 140, h: 72 }, autoSpeed: { x: 640, y: 1180, w: 66, h: 72 },
  tapPad: { x: 0, y: 150, w: 720, h: 940 }, catchBtn: { x: 448, y: 1112, w: 254, h: 128 },
};
export const THINK_STEPS = [2, 5, 8, 10];
export const IN_PLAY_CAP = 2;
export const scaleOf = (G) => TEXT_SCALES[clamp(G.settings.textIdx, 0, TEXT_SCALES.length - 1)];
export const inPlayScale = (G) => Math.min(scaleOf(G), IN_PLAY_CAP);

function fitFont(ctx, text, size, maxW, weight = 600, family = SANS, minSize = 12) {
  let sz = size;
  ctx.font = `${weight} ${sz}px ${family}`;
  while (sz > minSize && ctx.measureText(text).width > maxW) { sz -= 1; ctx.font = `${weight} ${sz}px ${family}`; }
  return sz;
}
const fmtBalls = (i) => `${i.balls}/${i.maxBalls}`;

let hudBottom = 140;
export const hudBottomY = () => hudBottom;

// ---- scoreboard -------------------------------------------------------------------------------------------------------------------------
function scoreboard(ctx, G, s) {
  const i = s.inn, zs = inPlayScale(G);
  const batName = s.teams[i.bat].name;
  const rows = [];
  rows.push({ t: `${batName}  ${i.runs}/${i.wk}`, size: 38 * zs, w: 700, col: '#fff' });
  const left = i.maxBalls - i.balls;
  if (i.target != null) rows.push({ t: `Need ${Math.max(0, i.target - i.runs)} from ${left} ball${left === 1 ? '' : 's'}   (target ${i.target})`, size: 22 * zs, w: 700, col: PAL.gold });
  else rows.push({ t: `Balls ${fmtBalls(i)}   ${i.maxWk - i.wk} wicket${i.maxWk - i.wk === 1 ? '' : 's'} left`, size: 22 * zs, w: 700, col: PAL.gold });
  const st = i.batters[i.st];
  rows.push({ t: `${st.name}* ${st.runs} (${st.balls})   Bowling: ${s.teams[1 - i.bat].name}`, size: 19 * zs, w: 500, col: 'rgba(255,244,224,0.85)' });
  const maxW = 524;
  let h = 20;
  for (const r of rows) { r.fs = fitFont(ctx, r.t, r.size, maxW, r.w); h += r.fs * 1.2; }
  if (h > 205) { const k = 195 / h; h = 20; for (const r of rows) { r.fs = fitFont(ctx, r.t, r.size * k, maxW, r.w, SANS, 11); h += r.fs * 1.2; } }   // a fixed strip: it never grows over the picture
  hudBottom = 34 + h;
  panel(ctx, { x: 12, y: 34, w: 540 + 16, h }, { radius: 24, top: 'rgba(6,36,48,0.9)', bottom: 'rgba(4,24,32,0.92)' });
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  let y = 34 + 10;
  for (const r of rows) { y += r.fs * 1.2; ctx.font = `${r.w} ${r.fs}px ${SANS}`; ctx.fillStyle = r.col; ctx.fillText(r.t, 30, y - r.fs * 0.2); }
  drawPill(ctx, R.pause, G.paused ? '▶' : 'II', { size: 28 });
  if (G.scene === 'play' && !G.watch) drawPill(ctx, R.think, `?${s.hints > 90 ? '∞' : s.hints}`, { size: 26, disabled: s.hints <= 0 });
}

function overStrip(ctx, s) {
  const toks = s.inn.over.slice(-8);
  const y = 1262, n = Math.max(6, toks.length), x0 = 360 - (n * 40) / 2 + 20;
  for (let k = 0; k < n; k++) {
    const t = toks[k], x = x0 + k * 40;
    ctx.fillStyle = t ? (t === 'W' ? '#d8443a' : t === '6' ? '#9a52d9' : t === '4' ? '#2a8fd0' : t === '.' ? '#3d5a64' : t === 'Wd' ? '#d98a2a' : '#3f8f5a') : 'rgba(255,255,255,0.12)';
    ctx.beginPath(); ctx.arc(x, y, 15, 0, 7); ctx.fill();
    if (t) textFill(ctx, t, x, y + 6, t.length > 1 ? 13 : 17, { font: SANS, weight: 700, color: '#fff', shadow: false });
  }
}

// ---- radar: the whole ground from above, so the batter can see the gaps -----------------------------------------------------------------------
export function radarMap(rect) {
  const sx = rect.w / (FIELD.ax * 2 * 1.06), sz = rect.h / (FIELD.az * 2 * 1.06);
  return { to: (x, z) => [rect.x + rect.w / 2 + (x - FIELD.cx) * sx, rect.y + rect.h / 2 - (z - FIELD.cz) * sz], sx, sz };
}
function drawRadar(ctx, G, s, rect, opts = {}) {
  panel(ctx, { x: rect.x - 6, y: rect.y - 6, w: rect.w + 12, h: rect.h + 12 }, { radius: 16, top: 'rgba(6,36,48,0.78)', bottom: 'rgba(4,24,32,0.8)' });
  const m = radarMap(rect);
  ctx.save();
  ctx.beginPath(); ctx.ellipse(rect.x + rect.w / 2, rect.y + rect.h / 2, FIELD.ax * m.sx, FIELD.az * m.sz, 0, 0, 7); ctx.fillStyle = '#3f8f46'; ctx.fill(); ctx.strokeStyle = '#fff6e0'; ctx.lineWidth = 2; ctx.stroke();
  const [px0, pz0] = m.to(-1.3, 0), [px1, pz1] = m.to(1.3, PITCH);
  ctx.fillStyle = '#d9cdb0'; ctx.fillRect(px0, pz1, px1 - px0, pz0 - pz1);
  const col = ['#16a39a', '#ec6b2d'];
  const fcol = col[1 - s.inn.bat];
  for (const f of s.field) { const [x, y] = m.to(f.x, f.z); ctx.fillStyle = f.ctl ? PAL.gold : fcol; ctx.beginPath(); ctx.arc(x, y, f.ctl ? 5.5 : 3.6, 0, 7); ctx.fill(); if (f.ctl) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke(); } }
  const live = s.live;
  if (live) for (const r of live.rn) { const u = r.state === 'run' ? s.api.runU(r.tau) : r.state === 'out' ? (r.uOut ?? 0) : 0; const fromE = r.state === 'run' || r.state === 'out' ? r.from : r.end; const z = lerp(END_Z[fromE], END_Z[1 - fromE], u); const [x, y] = m.to(r.state === 'rest' ? (fromE === 0 ? 0.55 : -0.55) : (fromE === 0 ? 0.55 : -0.55), z); ctx.fillStyle = col[s.inn.bat]; ctx.beginPath(); ctx.arc(x, y, 3.4, 0, 7); ctx.fill(); }
  else { for (const [e, off] of [[0, 0.55], [1, -0.55]]) { const [x, y] = m.to(off, END_Z[e]); ctx.fillStyle = col[s.inn.bat]; ctx.beginPath(); ctx.arc(x, y, 3.4, 0, 7); ctx.fill(); } }
  if (opts.aim != null) {
    const a = opts.aim * DEG; const [x0, y0] = m.to(0, 0.4);
    ctx.strokeStyle = opts.aimColor ?? 'rgba(255,225,120,0.95)'; ctx.lineWidth = 3; ctx.setLineDash([6, 4]); ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0 + Math.sin(a) * m.sx * 24, y0 - Math.cos(a) * m.sz * 24); ctx.stroke(); ctx.setLineDash([]);
  }
  const bp = live ? s.api.ballPos() : null;
  if (bp) { const [x, y] = m.to(bp[0], bp[2]); ctx.fillStyle = '#ff8a3d'; ctx.beginPath(); ctx.arc(x, y, 4, 0, 7); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke(); }
  ctx.restore();
}

// ---- cues drawn through the fixed cameras -----------------------------------------------------------------------------------------------------
const groundRing = (ctx, cam, x, z, r, color, lw = 4, dash = null) => {
  const c = project(cam, x, 0, z); if (!c) return null;
  ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = lw; if (dash) ctx.setLineDash(dash);
  ctx.beginPath(); ctx.ellipse(c.x, c.y, r * c.k, r * c.k * (cam === 'field' ? 0.5 : 0.34), 0, 0, 7); ctx.stroke(); ctx.restore();
  return c;
};

function ballNow(s) {
  if (s.phase === 'flight' && s.d) return deliveryPos(s.d, clamp(s.ft, 0, s.d.n / 60 - 0.02));
  if (s.live && (s.phase === 'live' || (s.phase === 'dead' && s.deadFrom === 'live'))) { const b = s.api.ballPos(); return b; }
  return null;
}

function drawBallMarker(ctx, s, view) {
  const b = ballNow(s); if (!b) return;
  const p = project(view, b[0], b[1], b[2]); if (!p) return;
  const r = view === 'field' ? 24 : Math.max(20, 0.1 * p.k + 8);
  ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 3; ctx.setLineDash([5, 5]); ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 7); ctx.stroke(); ctx.restore();
  // where a lofted ball first lands
  const L = s.live;
  if (view === 'field' && L && L.bs === 'fly' && L.track.bounces.length && L.i < L.track.bounces[0] && L.track.bounces[0] > 10) {
    const bi = L.track.bounces[0], c = groundRing(ctx, 'field', L.track.p[bi * 3], L.track.p[bi * 3 + 2], 0.8, 'rgba(255,255,255,0.8)', 3, [4, 4]);
    void c;
  }
}

function drawFielderCues(ctx, G, s, t) {
  const L = s.live, uf = s.field.find((f) => f.ctl);
  if (!uf) return;
  const p = project('field', uf.x, 2.3, uf.z);
  if (p) { const w = 70; panel(ctx, { x: p.x - w / 2, y: p.y - 34, w, h: 30 }, { radius: 12, top: 'rgba(255,211,107,0.95)', bottom: 'rgba(255,190,70,0.95)' }); textFill(ctx, 'YOU', p.x, p.y - 12, 20, { font: SANS, weight: 800, color: '#3b2400', shadow: false }); }
  if (!L || L.dead) return;
  if (L.claim && L.bs === 'fly') {
    const pulse = 0.8 + 0.2 * Math.sin(t * 9);
    groundRing(ctx, 'field', L.claim.pos[0], L.claim.pos[2], 1.2 * pulse, 'rgba(255,225,120,0.95)', 5);
    groundRing(ctx, 'field', L.claim.pos[0], L.claim.pos[2], 0.5, 'rgba(255,255,255,0.9)', 3);
    // the catch ring: closes on the fielder as the ball arrives
    let eta = 9;
    for (let j = L.i; j < Math.min(L.track.n, L.i + 40); j++) { const q = trackPos(L.track, j); if (Math.hypot(q[0] - uf.x, q[2] - uf.z) <= REACH.catchR + 0.3) { eta = (j - L.i) / 60; break; } }
    if (eta < 0.8 && p) {
      const k = clamp(eta / 0.8, 0, 1), c = project('field', uf.x, 0, uf.z);
      const good = eta < 0.32 && eta > 0.06;
      ctx.save(); ctx.strokeStyle = good ? '#7dff9d' : '#ffd36b'; ctx.lineWidth = 6; ctx.beginPath(); ctx.ellipse(c.x, c.y, (0.9 + 2.2 * k) * c.k, (0.9 + 2.2 * k) * c.k * 0.5, 0, 0, 7); ctx.stroke(); ctx.restore();
      textFill(ctx, good ? 'TAP!' : 'ready', c.x, c.y - 70, 28, { font: SANS, weight: 800, color: good ? '#7dff9d' : '#ffe08a', stroke: 'rgba(0,30,20,0.8)' });
    }
  }
  const tg = s.ctl.target;
  if (tg) groundRing(ctx, 'field', tg.x, tg.z, 0.9, 'rgba(255,255,255,0.85)', 3);
}

// ---- banners -------------------------------------------------------------------------------------------------------------------------------------
function drawCall(ctx, G, s, y) {
  const c = s.call; if (!c || s.phase !== 'dead') return;
  const age = s.pt, dur = DEAD_T;
  if (age > dur) return;
  const a = clamp(1 - Math.max(0, age - (dur - 0.4)) / 0.4, 0, 1) * clamp(age / 0.08, 0, 1);
  const sc = c.big ? lerp(1.3, 1, ease.back(clamp(age / 0.3, 0, 1))) : lerp(0.92, 1, clamp(age / 0.2, 0, 1));
  const colors = { six: ['#fff3a8', '#ff9d2b'], four: ['#d4fff2', '#2ec4b6'], wicket: ['#ffd9d0', '#ff5a48'], run: ['#ffffff', '#ffe08a'], dot: ['#eeeaf6', '#b9b0d0'] };
  const col = colors[c.kind] ?? colors.run;
  ctx.save(); ctx.globalAlpha = a; ctx.translate(360, y); ctx.scale(sc, sc);
  const size = c.big ? 78 : 44;
  const w = Math.min(640, fitFont(ctx, c.text, size, 600, 800, FONT) * 0 + 600);
  void w;
  const fs = fitFont(ctx, c.text, size, 580, 800, FONT, 20);
  rr(ctx, -310, -fs * 0.85, 620, fs * 1.4 + (s.last && s.last.shot && c.big ? 40 : 0), 28); ctx.fillStyle = 'rgba(4,20,28,0.68)'; ctx.fill(); ctx.strokeStyle = col[1]; ctx.lineWidth = 3; ctx.stroke();
  textFill(ctx, c.text, 0, 0, fs, { italic: true, grad: [[0, col[0]], [1, col[1]]], stroke: 'rgba(40,10,10,0.75)' });
  if (s.last && s.last.shot && c.big) { ctx.font = `italic 600 26px ${FONT}`; ctx.fillStyle = '#fff4dc'; ctx.textAlign = 'center'; ctx.fillText(s.last.shot, 0, fs * 0.55 + 20); }
  ctx.restore();
}

function timingChip(ctx, s, y) {
  const r = s.sw && s.sw.res; if (!r || !r.label || !s.api.humanBats()) return;
  const age = (s.phase === 'live' ? s.live.t : s.phase === 'dead' ? 1 + s.pt : s.ft - s.sw.T_c);
  if (age < 0 || age > 1.5) return;
  const col = r.label.startsWith('PERFECT') ? '#ffd34d' : r.label.startsWith('GOOD') ? '#8be07a' : r.label.includes('WAY') ? '#ff6b57' : '#ffb347';
  ctx.save(); ctx.globalAlpha = clamp(1 - Math.max(0, age - 1.0) / 0.5, 0, 1); ctx.translate(360, y - Math.min(age, 0.4) * 30);
  textFill(ctx, r.contact ? r.label : (r.why === 'out of reach' ? 'OUT OF REACH' : r.label), 0, 0, 36, { italic: true, color: col, stroke: 'rgba(20,10,10,0.8)' });
  ctx.restore();
}

// ---- role controls ------------------------------------------------------------------------------------------------------------------------------------
function humanRing(ctx, G, s, view, t) {
  const cam = view;
  let pos = null;
  if (s.api.humanBats()) pos = s.live && (s.phase === 'live' || (s.phase === 'dead' && s.deadFrom === 'live')) && s.live.rn ? (() => { const r = s.live.rn[0]; const fe = r.state === 'rest' ? r.end : r.from; const u = r.state === 'run' ? s.api.runU(r.tau) : r.state === 'out' ? (r.uOut ?? 0) : 0; return [(fe === 0 ? 0.45 : -0.95), END_Z[fe] + (END_Z[1 - fe] - END_Z[fe]) * u]; })() : [-0.5, END_Z[0]];
  else if (s.api.humanBowls()) pos = [s.field[0].x, s.field[0].z];
  else if (s.api.humanFields()) { const f = s.field.find((q) => q.ctl); if (f) pos = [f.x, f.z]; }
  if (!pos && !G.ringPos) return;
  const c = G.ringPos || project(cam, pos[0], 0, pos[1]); if (!c) return;
  const rx = (cam === 'field' ? 0.9 : 0.8) * c.k * (1 + 0.05 * Math.sin(t * 6)), ry = rx * (cam === 'field' ? 0.5 : 0.28);
  ctx.save(); ctx.strokeStyle = 'rgba(255,211,77,0.95)'; ctx.lineWidth = cam === 'field' ? 5 : 8; ctx.beginPath(); ctx.ellipse(c.x, c.y, rx, ry, 0, 0, 7); ctx.stroke(); ctx.restore();
}

function roleBadge(ctx, G, s, y) {
  const names = { bat: 'You: batter', bowl: 'You: bowler', inner: 'You: inner fielder', deep: 'You: deep fielder' };
  if (!s.role) return;
  const idle = !(s.api.humanBats() || s.api.humanBowls() || s.api.humanFields());
  const txt = idle ? `${names[s.role]} (your side ${s.inn.bat === 0 ? 'bats' : 'fields'}: watching)` : names[s.role];
  const zs = inPlayScale(G);
  const fs = fitFont(ctx, txt, 22 * zs, 600, 700);
  const tw = ctx.measureText(txt).width;
  rr(ctx, 14, y - fs - 6, tw + 28, fs + 16, 14); ctx.fillStyle = 'rgba(4,24,32,0.78)'; ctx.fill();
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = idle ? 'rgba(255,244,224,0.85)' : PAL.gold; ctx.fillText(txt, 28, y);
}

function batterControls(ctx, G, s, t) {
  const tc = G.touch, L = s.live;
  const view = viewOf(s);
  if (view === 'bat' && (s.phase === 'ready' || s.phase === 'runup' || s.phase === 'flight') && !s.hold) {
    const zs = inPlayScale(G);
    const msg = s.phase === 'flight' ? 'SWIPE NOW' : s.phase === 'runup' ? 'Watch the ball...' : 'Read the field. Swipe to hit. Tap to defend.';
    fitFont(ctx, msg, 26 * zs, 680, 700); ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.shadowColor = 'rgba(0,20,30,0.8)'; ctx.shadowBlur = 6; ctx.fillText(msg, 360, 1110); ctx.shadowBlur = 0;
    if ((G.prefs.coach ?? 0) < 5 && !tc.down && s.phase !== 'runup') {
      const u = (t * 0.8) % 1.5, k = clamp(u / 0.8, 0, 1), e = ease.out(k);
      const x0 = 300, y0 = 960, x1 = 470, y1 = 740, gx = lerp(x0, x1, e), gy = lerp(y0, y1, e), al = u < 1.1 ? 1 : clamp(1 - (u - 1.1) / 0.4, 0, 1);
      ctx.save(); ctx.globalAlpha = 0.85 * al; ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 10; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(gx, gy); ctx.stroke(); ctx.fillStyle = 'rgba(255,244,220,0.9)'; ctx.beginPath(); ctx.arc(gx, gy, 30, 0, 7); ctx.fill(); ctx.strokeStyle = PAL.gold; ctx.lineWidth = 4; ctx.stroke(); ctx.restore();
    }
  }
  if (tc.down && tc.committed && tc.path.length > 1 && view === 'bat') {
    ctx.strokeStyle = 'rgba(255,207,107,0.95)'; ctx.lineWidth = 10; ctx.lineCap = 'round'; ctx.beginPath(); tc.path.slice(-8).forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.stroke();
  }
  if (s.phase === 'live' && L && !L.dead && !s.hold) {
    const rn = L.rn;
    const running = rn.some((r) => r.state === 'run');
    const label = !running ? (L.runsDone ? 'RUN AGAIN' : 'RUN') : (L.queue ? 'queued: tap to cancel' : 'RUN AGAIN?');
    const pulse = 1 + Math.sin(t * 8) * 0.03;
    ctx.save(); ctx.translate(R.run.x + R.run.w / 2, R.run.y + R.run.h / 2); ctx.scale(pulse, pulse); ctx.translate(-(R.run.x + R.run.w / 2), -(R.run.y + R.run.h / 2));
    drawButton(ctx, R.run, label, { primary: !running, active: L.queue, size: 40 * Math.min(1.4, inPlayScale(G)) });
    ctx.restore();
  }
}

export const aimOfPath = (G) => G.touch.aimDeg;

function bowlerControls(ctx, G, s, t) {
  if (s.phase !== 'aim' || s.hold) return;
  const A = G.bowl;
  // chips: the kind of delivery
  for (const c of R.chips) drawButton(ctx, c.rect, DELIVERIES[c.k].name, { active: G.aim.type === c.k, size: 24 * Math.min(1.3, inPlayScale(G)) });
  const zs = inPlayScale(G);
  fitFont(ctx, 'Flick up the screen to bowl: far = full, short = short; sideways = line.', 24 * zs, 690, 700);
  ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.shadowColor = 'rgba(0,20,30,0.8)'; ctx.shadowBlur = 6; ctx.fillText('Flick up the screen to bowl: far = full, short = short; sideways = line.', 360, 1150); ctx.shadowBlur = 0;
  // the predicted bounce spot
  const a = G.bowlPreview || { bx: G.aim.bx, bz: G.aim.bz, speed: G.aim.speed };
  const c = project('bat', a.bx, 0, a.bz);
  if (c) {
    const pace = (a.speed - SPEED.min) / (SPEED.max - SPEED.min);
    const ex = (0.05 + 0.1 + 0.34 * pace * 0.45) * c.k, ey = (0.15 + 0.5 * (0.12 + 0.34 * pace)) * c.k * 0.34;
    ctx.save(); ctx.strokeStyle = 'rgba(255,225,120,0.95)'; ctx.lineWidth = 4; ctx.setLineDash([8, 6]); ctx.beginPath(); ctx.ellipse(c.x, c.y, Math.max(26, ex), Math.max(12, ey * 1.6), 0, 0, 7); ctx.stroke(); ctx.restore();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(c.x, c.y, 14, 0, 7); ctx.moveTo(c.x - 26, c.y); ctx.lineTo(c.x + 26, c.y); ctx.stroke();
    ctx.font = `700 22px ${SANS}`; ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.fillText(`${Math.round(a.speed * 3.6)} km/h`, c.x, c.y - 24);
  }
  const tc = G.touch;
  if (tc.down && tc.path.length > 1) { ctx.strokeStyle = 'rgba(255,207,107,0.9)'; ctx.lineWidth = 10; ctx.lineCap = 'round'; ctx.beginPath(); tc.path.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.stroke(); }
  void A;
}

function fielderControls(ctx, G, s, t) {
  const L = s.live, uf = s.field.find((f) => f.ctl);
  if (!uf) return;
  const view = viewOf(s);
  if (view === 'field') { drawFielderCues(ctx, G, s, t); }
  if (s.phase === 'ready' && s.waitReady) {
    drawButton(ctx, R.ready, 'READY: bowl the ball', { primary: true, size: 36 * Math.min(1.3, inPlayScale(G)) });
    const zs = inPlayScale(G);
    const msg = 'Drag your gold fielder to where the batter may hit.';
    fitFont(ctx, msg, 24 * zs, 690, 700); ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.shadowColor = 'rgba(0,20,30,0.8)'; ctx.shadowBlur = 6; ctx.fillText(msg, 360, 1090); ctx.shadowBlur = 0;
  }
  if (L && !L.dead && L.bs === 'held' && L.holder === uf.id) {
    const best = s.api.bestThrowEnd(uf);
    drawButton(ctx, R.throwA, "Throw to batter's end", { primary: best === 0, size: 28 * Math.min(1.3, inPlayScale(G)) });
    drawButton(ctx, R.throwB, "Throw to bowler's end", { primary: best === 1, size: 28 * Math.min(1.3, inPlayScale(G)) });
  }
  if (L && !L.dead && !(L.bs === 'held' && L.holder === uf.id)) {
    // the CATCH button: the only way to catch or dive (a finger on the field only runs); its ring closes as the ball arrives
    let eta = 9;
    if (L.bs === 'fly') for (let j = L.i; j < Math.min(L.track.n, L.i + 50); j++) { const q = trackPos(L.track, j); if (Math.hypot(q[0] - uf.x, q[2] - uf.z) <= REACH.catchR + 0.5) { eta = (j - L.i) / 60; break; } }
    const R0 = R.catchBtn, good = eta < 0.4 && eta > 0.04;
    drawButton(ctx, R0, good ? 'CATCH!' : 'CATCH', { primary: good, size: 34 * Math.min(1.3, inPlayScale(G)) });
    if (eta < 1.0) { const k = clamp(eta / 1.0, 0, 1); ctx.save(); ctx.strokeStyle = good ? '#7dff9d' : '#ffd36b'; ctx.lineWidth = 6; rr(ctx, R0.x - 8 - 30 * k, R0.y - 8 - 20 * k, R0.w + 16 + 60 * k, R0.h + 16 + 40 * k, 30); ctx.stroke(); ctx.restore(); }
  }
  if (L && !L.dead && view === 'field' && !(L.bs === 'held' && L.holder === uf.id)) {
    const zs = inPlayScale(G);
    const msg = L.claim ? 'Touch the field to run there. Press CATCH as the ball reaches you.' : 'Touch the field to run there.';
    fitFont(ctx, msg, 24 * zs, 690, 700); ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.shadowColor = 'rgba(0,20,30,0.8)'; ctx.shadowBlur = 6; ctx.fillText(msg, 360, 1080); ctx.shadowBlur = 0;
  }
}

function idleBar(ctx, G, s) {
  const idle = !(s.api.humanBats() || s.api.humanBowls() || s.api.humanFields());
  if (!idle || G.watch) return;
  drawButton(ctx, R.speed, `Speed x${G.idleSpeed}`, { size: 26 });
  drawButton(ctx, R.skip, 'Skip ahead', { size: 26 });
}

// ---- Think / pause / Watch & Learn -----------------------------------------------------------------------------------------------------------------
export function drawThink(ctx, G) {
  const th = G.think;
  const zs = inPlayScale(G);
  const bottom = 1030, maxH = bottom - Math.max(hudBottom + 20, 200);
  let fs = 25 * zs, wrapped;
  for (;;) {
    ctx.font = `500 ${fs}px ${SANS}`;
    wrapped = th.lines.map((line) => wrapLines(ctx, line, 620));
    const n = wrapped.reduce((a, w) => a + w.length, 0);
    const need = 96 + n * fs * 1.32 + wrapped.length * 8;
    if (need <= maxH || fs <= 14) { wrapped.need = need; break; }
    fs -= 1;
  }
  const r = { x: 24, y: Math.min(700, bottom - wrapped.need - 10), w: 672, h: 0 };
  r.h = 1130 - r.y;
  const top0 = Math.max(190, hudBottom + 4);
  ctx.fillStyle = 'rgba(2,14,20,0.55)'; ctx.fillRect(0, top0, W, H - top0);
  panel(ctx, r, { radius: 30 });
  textFill(ctx, 'THINK', 360, r.y + 52, 38, { italic: true, grad: [[0, '#d4fff2'], [1, '#2ec4b6']], stroke: 'rgba(0,40,40,0.5)' });
  ctx.font = `500 ${fs}px ${SANS}`; ctx.fillStyle = '#fff4dc'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  let y = r.y + 100 + fs * 0.2;
  for (const ws of wrapped) { for (const l of ws) { ctx.fillText(l, 48, y); y += fs * 1.32; } y += 8; }
  drawButton(ctx, { x: 200, y: 1040, w: 320, h: 70 }, 'Got it', { primary: true, size: 30 });
}
export const THINK_OK = { x: 200, y: 1040, w: 320, h: 70 };

export const PAUSE_BTNS = {
  resume: { x: 160, y: 380, w: 400, h: 92 }, sound: { x: 160, y: 486, w: 400, h: 92 }, textDec: { x: 160, y: 592, w: 190, h: 92 }, textInc: { x: 370, y: 592, w: 190, h: 92 },
  rules: { x: 160, y: 698, w: 400, h: 92 }, quit: { x: 160, y: 804, w: 400, h: 92 },
};
export function drawPause(ctx, G) {
  ctx.fillStyle = 'rgba(2,14,20,0.74)'; ctx.fillRect(0, 0, W, H);
  textFill(ctx, 'Paused', 360, 310, 64, { italic: true, grad: [[0, '#fff3c2'], [1, '#ffb347']], stroke: 'rgba(60,20,10,0.5)' });
  const fs = 30 * Math.min(inPlayScale(G), 1.5);
  drawButton(ctx, PAUSE_BTNS.resume, 'Resume', { primary: true, size: fs });
  drawButton(ctx, PAUSE_BTNS.sound, G.settings.sound ? 'Sound: On' : 'Sound: Off', { size: fs });
  drawButton(ctx, PAUSE_BTNS.textDec, 'Text A−', { size: fs * 0.85, disabled: G.settings.textIdx === 0 });
  drawButton(ctx, PAUSE_BTNS.textInc, 'Text A+', { size: fs * 0.85, disabled: G.settings.textIdx === TEXT_SCALES.length - 1 });
  drawButton(ctx, PAUSE_BTNS.rules, 'Rules', { size: fs });
  drawButton(ctx, PAUSE_BTNS.quit, 'Save and quit', { danger: true, size: fs });
  ctx.font = `600 ${22}px ${SANS}`; ctx.fillStyle = 'rgba(255,244,224,0.85)'; ctx.textAlign = 'center'; ctx.fillText(`Text size ${Math.round(scaleOf(G) * 100)}%`, 360, 930);
}

function drawWatchPanel(ctx, G, s) {
  const a = G.auto;
  drawButton(ctx, R.exit, 'Exit', { size: 24 });
  drawButton(ctx, R.autoPause, G.paused ? 'RESUME' : 'PAUSE', { primary: G.paused, size: 28 });
  drawButton(ctx, R.autoDec, '−', { size: 32 }); drawButton(ctx, R.autoInc, '+', { size: 32 });
  drawButton(ctx, R.autoSpeed, `x${a.speed}`, { size: 24 });
  ctx.font = `500 16px ${SANS}`; ctx.fillStyle = 'rgba(255,244,224,0.8)'; ctx.textAlign = 'center'; ctx.fillText(`think ${THINK_STEPS[G.settings.thinkIdx]}s`, 530, 1268);
  const lines = a.lines;
  if (!lines.length) return;
  const phaseName = a.revealing ? 'REVEAL' : a.phase === 'think' ? 'THINK' : 'ACT';
  const phaseCol = a.revealing ? PAL.gold : a.phase === 'think' ? PAL.teal : '#fff';
  const zs = inPlayScale(G);
  let fs = 21 * zs, wrapped;
  const maxH = 1160 - Math.max(hudBottom + 160, 400);
  for (;;) {
    ctx.font = `500 ${fs}px ${SANS}`;
    wrapped = []; for (const l of lines) wrapped.push(...wrapLines(ctx, l, 640));
    if (58 + wrapped.length * fs * 1.33 + 14 <= maxH || fs <= 14) break;
    fs -= 1;
  }
  const r = { x: 18, y: 0, w: 684, h: 58 + wrapped.length * fs * 1.33 + 14 }; r.y = 1160 - r.h;
  panel(ctx, r, { radius: 22, top: 'rgba(4,22,30,0.88)', bottom: 'rgba(4,22,30,0.84)' });
  textFill(ctx, phaseName, r.x + 22, r.y + 42, 28, { align: 'left', color: phaseCol, italic: true, weight: 700 });
  const frac = a.total > 0 ? clamp(1 - a.timer / a.total, 0, 1) : 1;
  ctx.fillStyle = 'rgba(255,255,255,0.15)'; rr(ctx, r.x + 150, r.y + 28, r.w - 180, 10, 5); ctx.fill();
  ctx.fillStyle = phaseCol; rr(ctx, r.x + 150, r.y + 28, (r.w - 180) * frac, 10, 5); ctx.fill();
  ctx.font = `500 ${fs}px ${SANS}`; ctx.fillStyle = '#fff4dc'; ctx.textAlign = 'left'; let y = r.y + 58 + fs * 1.05;
  for (const l of wrapped) { ctx.fillText(l, r.x + 22, y); y += fs * 1.33; }
  if (G.paused) textFill(ctx, 'PAUSED', 360, 1000, 56, { italic: true, color: '#fff', stroke: 'rgba(10,30,40,0.7)' });
}

// the flat picture used when WebGL is unavailable: the ground from above
function drawFlat(ctx, G, s) {
  const view = viewOf(s);
  ctx.fillStyle = '#4c9a48'; ctx.fillRect(0, 0, W, H);
  const cam = view;
  ctx.beginPath(); for (let i = 0; i <= 72; i++) { const a = (i / 72) * Math.PI * 2; const p = project('field', FIELD.cx + Math.sin(a) * FIELD.ax, 0, FIELD.cz + Math.cos(a) * FIELD.az); if (p) (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); }
  ctx.fillStyle = '#6cb04a'; ctx.fill(); ctx.strokeStyle = '#fff6e0'; ctx.lineWidth = 5; ctx.stroke();
  const pa = project('field', -1.3, 0, 0), pb = project('field', 1.3, 0, PITCH);
  if (pa && pb) { ctx.fillStyle = '#d9cdb0'; ctx.fillRect(pa.x, pb.y, pb.x - pa.x, pa.y - pb.y); }
  const p = (x, z) => project('field', x, 0, z);
  for (const f of s.field) { const q = p(f.x, f.z); if (!q) continue; ctx.fillStyle = f.ctl ? PAL.gold : ['#16a39a', '#ec6b2d'][1 - s.inn.bat]; ctx.beginPath(); ctx.arc(q.x, q.y - 18, 12, 0, 7); ctx.fill(); ctx.fillRect(q.x - 8, q.y - 14, 16, 22); }
  const bats = [[-0.5, END_Z[0]], [-1.2, END_Z[1]]];
  if (s.live) for (const r of s.live.rn) { const fe = r.state === 'rest' ? r.end : r.from; const u = r.state === 'run' ? s.api.runU(r.tau) : r.state === 'out' ? (r.uOut ?? 0) : 0; bats.push([fe === 0 ? 0.45 : -0.95, lerp(END_Z[fe], END_Z[1 - fe], u)]); bats.splice(0, 2); }
  for (const [x, z] of bats) { const q = project('field', x, 0, z); if (q) { ctx.fillStyle = '#16a39a'; ctx.beginPath(); ctx.arc(q.x, q.y - 18, 12, 0, 7); ctx.fill(); ctx.fillRect(q.x - 8, q.y - 14, 16, 22); } }
  const b = ballNow(s); if (b) { const q = project('field', b[0], b[1], b[2]); if (q) { ctx.fillStyle = '#ff8a3d'; ctx.beginPath(); ctx.arc(q.x, q.y, 9, 0, 7); ctx.fill(); } }
  void cam;
}

// ---- the whole play screen ---------------------------------------------------------------------------------------------------------------------------
export function renderPlay(ctx, G) {
  const s = G.sim, t = G.t;
  const view = G.viewOverride ?? viewOf(s);
  if (G.gl && !G.gl.active) drawFlat(ctx, G, s);
  drawBallMarker(ctx, s, view);
  humanRing(ctx, G, s, view, t);
  scoreboard(ctx, G, s);
  roleBadge(ctx, G, s, hudBottom + 28);
  const showRadar = !G.watch && s.role && (s.phase === 'ready' || s.phase === 'runup' || s.phase === 'flight' || s.phase === 'aim') && view === 'bat';
  if (showRadar || (G.watch && view === 'bat' && (s.phase === 'ready' || s.phase === 'runup' || s.phase === 'flight'))) {
    const o = {};
    if (G.touch.aimDeg != null && s.api.humanBats()) o.aim = G.touch.aimDeg;
    if (G.watch && G.auto.revealing && s.plan && s.plan.kind === 'swing') o.aim = s.plan.angle;
    if (G.think && G.think.plan && G.think.plan.kind === 'swing') { o.aim = G.think.plan.angle; o.aimColor = 'rgba(120,255,200,0.9)'; }
    drawRadar(ctx, G, s, { ...R.radar, y: Math.max(R.radar.y, hudBottom + 44) }, o);
  }
  timingChip(ctx, s, view === 'bat' ? 760 : 300);
  if (!G.paused) drawCall(ctx, G, s, view === 'field' ? 960 : Math.max(330, hudBottom + 130));
  overStrip(ctx, s);
  if (G.scene === 'play' && !G.watch) {
    if (s.api.humanBats()) batterControls(ctx, G, s, t);
    else if (s.api.humanBowls()) bowlerControls(ctx, G, s, t);
    else if (s.api.humanFields()) fielderControls(ctx, G, s, t);
    idleBar(ctx, G, s);
  }
  if (G.watch) drawWatchPanel(ctx, G, s);
  if (G.think) drawThink(ctx, G);
  if (G.paused && !G.watch) drawPause(ctx, G);
  if (G.practice && !G.watch) {
    const pr = G.practice, zs = inPlayScale(G);
    const txt = `Practice: ${pr.goalText} (${pr.progress}/${pr.need})`;
    const fs = fitFont(ctx, txt, 22 * zs, 600, 700);
    ctx.textAlign = 'left'; ctx.fillStyle = PAL.teal; ctx.fillText(txt, 22, hudBottom + 28 + fs * 1.4);
  }
}
export { glow };
