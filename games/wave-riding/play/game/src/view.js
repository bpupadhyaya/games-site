// Wave Riding: the play screen. The scene (sky, wave, foam, rider) comes from art.js; this file adds the HUD, the line-up
// card, the paddle ring, the foam meter and the banners. It only reads state.
import { W, H, host, playLayout, TEXT_SCALES, clamp, inRect } from './layout.js';
import { PALS, makeCam, drawSky, drawWave, drawCurl, drawLine, drawBursts, drawFx, drawTrail, drawForeground, drawRider, drawBoard, smooth } from './art.js';
import { BOARDS, BEACHES, PADDLE, hollowAt, TUBE_D, FOAM_D, MAX_D, rankFor } from './sim.js';
import { FONT, DISPLAY, roundPath, paintButton, textShadow, wrapLines } from './ui.js';
import { drawLockup } from './brand.js';

const TAU = Math.PI * 2;
export const zoomOf = (state) => Math.min(1.6, TEXT_SCALES[state.settings.textIdx]);
export const layoutOf = (state) => playLayout(zoomOf(state));

// ---- the scene ---------------------------------------------------------------------------------------------------------------
export function drawScene(ctx, w, h, ws, opts = {}) {
  const r = ws.r, wave = ws.wave, pal = PALS[wave.beach], t = ws.t;
  const cam = makeCam(w, h, r, wave, opts);
  if (ws.rise !== undefined && ws.rise < 1) { cam.F0 *= 0.34 + 0.66 * ws.rise; }
  const sh = ws.shake || 0;
  ctx.save();
  if (sh > 0) ctx.translate(Math.sin(t * 90) * sh * 9, Math.cos(t * 77) * sh * 7);
  // the rider's place on the screen (needed before the sea is drawn: the board's spray is part of the 3D sea)
  const yShow = r.air ? 1 + 0.3 * Math.sin(Math.PI * clamp(r.air.t / r.air.dur, 0, 1)) : r.y;
  const size = cam.F0 * 0.36;
  const rx = cam.X0, ry = Math.max(cam.sy(yShow), (opts.topSafe || 0) + size * 0.95);
  const S3 = globalThis.__sea3d;
  let sea3d = false;
  if (S3 && !S3.pending && S3.render) {
    const m = ctx.getTransform();
    sea3d = S3.render(cam, pal, ws, t, {
      dpr: Math.hypot(m.a, m.b), rx, ry: ry + size * 0.02, mode: ws.phase === 'ride' && !r.wiped ? 'ride' : 'other',
      speed: clamp((r.v || 0) / 14, 0, 1.4), carve: r.vy || 0, tube: ws.tubeA || 0,
      burst: r.wiped ? { t: ws.wipeT || 0, x: rx, y: ry } : null,
    });
    if (sea3d) ctx.drawImage(S3.canvas, 0, 0, w, h);
  }
  if (!sea3d) {
    drawSky(ctx, cam, pal, t, r.s);
    drawForeground(ctx, cam, pal, t);
    drawWave(ctx, cam, pal, t);
  }
  drawBursts(ctx, cam, pal, t);
  if (!sea3d) drawCurl(ctx, cam, pal, t);
  drawTrail(ctx, cam, ws.trail);
  if (opts.line !== false) drawLine(ctx, cam, pal, t, !!opts.hint);
  // the rider
  const fig = ws.fig;
  if (ws.phase === 'paddle' || ws.phase === 'line') {
    const bob = Math.sin(t * 2.2) * 3 * cam.sc;
    drawRider(ctx, rx, cam.yB(0) - cam.fh(0) * 0.05 + bob, size, { mode: 'paddle', stroke: ws.paddle ? ws.paddle.stroke : t, pitch: 0.06, beach: wave.beach }, r.board, t);
  } else if (r.wiped) {
    drawRider(ctx, rx, cam.yB(0) - cam.fh(0) * Math.max(0, r.y - 0.1), size, { mode: 'wipe', t: Math.min(2.2, ws.wipeT || 0), beach: wave.beach }, r.board, t);
  } else if (ws.phase === 'ride' || ws.phase === 'done' || ws.phase === 'line') {
    drawRider(ctx, rx, ry, size, { mode: 'ride', crouch: fig.crouch, lean: fig.lean, arms: fig.arms, yaw: r.air ? r.air.rot : 0, pitch: fig.pitch, beach: wave.beach }, r.board, t);
  }
  drawFx(ctx, cam, ws.fx);
  if (opts.line !== false) drawLens(ctx, w, h, ws, r, t, cam.sc);
  // inside the tube: the lip hangs over the rider and the edges darken
  if (r.tubeNow || ws.tubeA > 0.02) {
    const a = clamp(ws.tubeA || 0, 0, 1);
    const cx = cam.X0 + 40 * cam.sc, cy = ry - size * 0.2;
    const vg = ctx.createRadialGradient(cx, cy, cam.F0 * 0.28, cx, cy, Math.max(w, h) * 0.75);
    vg.addColorStop(0, 'rgba(2,20,48,0)'); vg.addColorStop(1, `rgba(2,16,40,${0.5 * a})`);
    ctx.fillStyle = vg; ctx.fillRect(0, 0, w, h);
  }
  ctx.restore();
  return cam;
}

// Water on the lens: droplets that bead up in a wipeout, inside the tube and when the foam is close, then run down and fade.
const hz = (n) => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
function drawLens(ctx, w, h, ws, r, t, sc) {
  let a = 0;
  if (r.wiped) a = Math.max(a, clamp(1.1 - Math.max(0, (ws.wipeT || 0) - 0.15) / 2.4, 0, 1));
  if (r.tubeNow || ws.tubeA > 0.02) a = Math.max(a, 0.45 * clamp(ws.tubeA || 0, 0, 1));
  if (!r.wiped && r.d < 5) a = Math.max(a, 0.5 * smooth(5, 0.8, r.d));
  if (a < 0.02) return;
  ctx.save();
  for (let i = 0; i < 11; i++) {
    const fade = clamp(a * 1.6 - hz(i + 9) * 0.7, 0, 1);
    if (fade <= 0.02) continue;
    const x = hz(i * 1.3 + 1) * w, y0 = hz(i * 2.1 + 5) * h * 0.8, rad = (7 + 15 * hz(i + 3)) * sc;
    const y = y0 + (1 - fade) * 60 * sc * hz(i + 7);                       // drops slide down as they fade
    ctx.globalAlpha = fade * 0.9;
    const g = ctx.createRadialGradient(x - rad * 0.3, y - rad * 0.35, rad * 0.1, x, y, rad);
    g.addColorStop(0, 'rgba(255,255,255,0.55)'); g.addColorStop(0.55, 'rgba(210,235,250,0.16)'); g.addColorStop(0.9, 'rgba(10,40,70,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0.35)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y, rad * 0.9, rad, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.beginPath(); ctx.ellipse(x - rad * 0.3, y - rad * 0.4, rad * 0.22, rad * 0.14, -0.5, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = rad * 0.28; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x, y - (1 - fade) * 60 * sc * hz(i + 7)); ctx.lineTo(x, y - rad * 0.8); ctx.stroke();
  }
  ctx.restore();
}

// For the menus: the wave drawn into a rectangle of the screen (clipped), used as a living backdrop.
export function drawWorldState(ctx, rect, ws, o = {}) {
  ctx.save();
  ctx.beginPath(); ctx.rect(rect.x, rect.y, rect.w, rect.h); ctx.clip();
  ctx.translate(rect.x, rect.y);
  drawScene(ctx, rect.w, rect.h, ws, { line: o.line === true, fill: o.fill, base: o.base });
  ctx.restore();
}

// ---- small widgets --------------------------------------------------------------------------------------------------------------
function chip(ctx, r, text, o = {}) {
  roundPath(ctx, r.x, r.y, r.w, r.h, r.h / 2);
  ctx.fillStyle = o.fill || 'rgba(6,20,44,0.62)'; ctx.fill();
  if (o.stroke) { ctx.lineWidth = 2; ctx.strokeStyle = o.stroke; ctx.stroke(); }
  ctx.fillStyle = o.color || '#f4fbff'; ctx.font = `700 ${o.size || 20}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, r.x + r.w / 2, r.y + r.h / 2 + 1);
}
function hudButton(ctx, r, label, o = {}) {
  const { dy } = paintButton(ctx, r, o);
  ctx.fillStyle = o.disabled ? '#3a4658' : '#ffffff';
  ctx.font = `700 ${o.size || 22}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(label, r.x + r.w / 2, r.y + dy + r.h / 2);
}
function bigText(ctx, text, x, y, size, col = '#ffffff', stroke = 'rgba(4,24,56,0.85)') {
  ctx.font = `italic 800 ${size}px ${DISPLAY}`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(6, size * 0.16); ctx.strokeStyle = stroke; ctx.strokeText(text, x, y);
  ctx.fillStyle = col; ctx.fillText(text, x, y);
}
const fmt = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

// ---- the whole play screen -----------------------------------------------------------------------------------------------------
export function renderPlay(ctx, state) {
  const L = layoutOf(state), ws = state.ws, run = state.run, r = ws.r;
  const watch = run.mode === 'watch';
  const cam = drawScene(ctx, W, H, ws, { hint: !!state.hint, topSafe: L.top + L.hudH + 10 });
  const fs = L.fs;
  // ---- top bar
  if (!watch) hudButton(ctx, L.pause, 'II', { size: fs.btn, dark: true });
  else chip(ctx, L.pause, 'WATCH', { size: Math.max(13, fs.small), fill: 'rgba(240,180,76,0.9)', color: '#1c2536' });
  if (!watch) hudButton(ctx, L.think, 'Think', { size: Math.round(fs.btn * 0.9), active: !!state.hint, disabled: ws.phase !== 'ride' && ws.phase !== 'line' });
  else chip(ctx, L.think, `${run.idx + 1}/${state.ridesPer}`, { size: fs.small });
  const sc = L.score;
  roundPath(ctx, sc.x, sc.y, sc.w, sc.h, 22); ctx.fillStyle = 'rgba(6,20,44,0.55)'; ctx.fill();
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#ffffff'; ctx.font = `800 ${fs.big}px ${DISPLAY}`;
  const total = run.mode === 'free' ? 0 : run.total;
  ctx.fillText(fmt(total + state.scoreShown), sc.x + sc.w / 2, sc.y + fs.big * 0.86);
  ctx.font = `600 ${fs.small}px ${FONT}`; ctx.fillStyle = 'rgba(220,238,255,0.85)';
  const cap = run.mode === 'free' ? 'Free ride' : `Ride ${Math.min(run.idx + 1, state.ridesPer)} of ${state.ridesPer}`;
  ctx.fillText(`${cap} · ${BEACHES[run.beach].name}`, sc.x + sc.w / 2, sc.y + sc.h - fs.small * 0.5);
  // combo chip
  if (ws.phase === 'ride' && r.mult > 1) {
    const m = L.mult, w = Math.min(m.w, 220), x = m.x + (m.w - w) / 2;
    chip(ctx, { x, y: m.y, w, h: m.h }, `x${r.mult}   combo ${r.combo}`, { size: fs.small + 3, fill: 'rgba(255,196,70,0.95)', color: '#2a1a00' });
  }
  // ---- per phase
  if (ws.phase === 'line') drawLineup(ctx, state, L, cam);
  else if (ws.phase === 'paddle') drawPaddle(ctx, state, L, cam);
  else drawMeter(ctx, state, L);
  if (watch) drawDemoRow(ctx, state, L);
  // pops
  for (const p of state.pops) {
    const k = p.t / p.max, x = cam.X0 + p.dx * cam.sc, y = cam.sy(p.y) - 70 * cam.sc - k * 90 * cam.sc;
    ctx.save(); ctx.globalAlpha = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
    ctx.font = `800 ${Math.round(p.size * 34 * Math.max(0.8, cam.sc))}px ${DISPLAY}`; ctx.textAlign = 'center'; ctx.lineJoin = 'round';
    ctx.lineWidth = 7; ctx.strokeStyle = 'rgba(4,24,56,0.85)'; ctx.strokeText(p.text, x, y);
    ctx.fillStyle = p.col; ctx.fillText(p.text, x, y); ctx.restore();
  }
  // banner
  if (state.banner) {
    const b = state.banner, a = clamp(Math.min(b.t / 0.25, (b.max - b.t) / 0.4), 0, 1), sc2 = 0.8 + 0.2 * Math.min(1, b.t / 0.25);
    ctx.save(); ctx.globalAlpha = a; ctx.translate(W / 2, H * 0.36); ctx.scale(sc2, sc2);
    bigText(ctx, b.text, 0, 0, Math.round(Math.min(W, 900) * 0.15), b.col);
    ctx.font = `700 ${Math.round(Math.min(W, 900) * 0.045)}px ${FONT}`; ctx.textAlign = 'center';
    ctx.fillStyle = '#f4fbff'; textShadow(ctx, b.sub, 0, Math.round(Math.min(W, 900) * 0.085), '#f4fbff', 6);
    ctx.restore();
  }
  // toast
  if (state.toastT > 0 && state.toast) {
    const a = clamp(state.toastT / 0.4, 0, 1);
    ctx.save(); ctx.globalAlpha = a;
    ctx.font = `600 ${fs.toast}px ${FONT}`;
    // in the line-up the scouting card owns the top, so the toast rides just above the board tray (beside the panel in landscape)
    const lineUp = !watch && ws.phase !== 'ride';
    const cxT = lineUp && L.land ? L.px0 / 2 : W / 2, maxW = lineUp && L.land ? L.px0 - 30 : Math.min(W - 60, 700);
    const lines = wrapLines(ctx, state.toast, maxW - 20), lh = fs.toast * 1.3, bw = Math.min(maxW, 760), bh = lines.length * lh + 22;
    let y = watch ? L.demo.pause.y - bh - 14 : ws.phase === 'ride' ? L.meter.y - bh - 14 : (L.land ? L.go.y - bh - 14 : L.tray[0].y - bh - 12);
    if (!lineUp) y = Math.max(L.top + L.hudH + 60, y);
    roundPath(ctx, cxT - bw / 2, y, bw, bh, 18); ctx.fillStyle = 'rgba(6,20,44,0.8)'; ctx.fill();
    ctx.fillStyle = '#f4fbff'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    lines.forEach((l, i) => ctx.fillText(l, cxT, y + 11 + fs.toast * 0.95 + i * lh));
    ctx.restore();
  }
}

function drawDemoRow(ctx, state, L) {
  const D = L.demo, st = state.settings, fs = L.fs;
  const sz = Math.round(fs.btn * 0.9);
  hudButton(ctx, D.dec, 'Think −', { size: sz, dark: true, disabled: st.thinkIdx === 0 });
  hudButton(ctx, D.pause, state.paused ? 'Resume' : 'Pause', { size: sz, primary: true });
  hudButton(ctx, D.inc, 'Think +', { size: sz, dark: true, disabled: st.thinkIdx === 3 });
  hudButton(ctx, D.exit, 'Exit', { size: sz, dark: true });
}

// ---- the foam meter ---------------------------------------------------------------------------------------------------------------
function drawMeter(ctx, state, L) {
  const ws = state.ws, r = ws.r, m = L.meter, fs = L.fs;
  if (state.run.mode === 'watch') return;
  const hol = hollowAt(ws.wave, r.s + 6) > 0.35;
  // progress along the wave
  const pr = clamp(r.s / ws.wave.len, 0, 1);
  const py = m.y - 4;
  roundPath(ctx, m.x, py, m.w, 7, 3.5); ctx.fillStyle = 'rgba(6,20,44,0.5)'; ctx.fill();
  roundPath(ctx, m.x, py, Math.max(7, m.w * pr), 7, 3.5); ctx.fillStyle = '#ffd36a'; ctx.fill();
  // the zones: foam | tube | pocket | shoulder
  const barY = m.y + 12, barH = Math.max(18, m.h - 26);
  const xOf = (d) => m.x + (clamp(d, 0, MAX_D) / MAX_D) * m.w;
  roundPath(ctx, m.x, barY, m.w, barH, barH / 2); ctx.save(); ctx.clip();
  const zones = [[0, 6, '#e0503e'], [6, TUBE_D[1], hol ? '#27b6c4' : '#e6a83c'], [TUBE_D[1], 26, '#3fcf7a'], [26, MAX_D, '#8fa6bd']];
  for (const [a, b, col] of zones) { ctx.fillStyle = col; ctx.globalAlpha = 0.85; ctx.fillRect(xOf(a), barY, xOf(b) - xOf(a), barH); }
  ctx.globalAlpha = 1; ctx.restore();
  ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,0.65)'; roundPath(ctx, m.x, barY, m.w, barH, barH / 2); ctx.stroke();
  // the rider marker
  const mx = xOf(r.d);
  ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#0a2a52'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(mx, barY - 2); ctx.lineTo(mx - 10, barY - 14); ctx.lineTo(mx + 10, barY - 14); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.arc(mx, barY + barH / 2, barH * 0.36, 0, TAU); ctx.fill(); ctx.stroke();
  // labels
  ctx.font = `700 ${Math.max(11, fs.small - 3)}px ${FONT}`; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff';
  ctx.textAlign = 'left'; ctx.fillText('FOAM', m.x + 10, barY + barH / 2);
  ctx.textAlign = 'right'; ctx.fillText('OPEN WATER', m.x + m.w - 10, barY + barH / 2);
  if (hol) { ctx.textAlign = 'center'; ctx.fillText('TUBE', xOf(10), barY + barH / 2); }
  else { ctx.textAlign = 'center'; ctx.fillText('POCKET', xOf(19), barY + barH / 2); }
  void FOAM_D;
}

// ---- the line-up ---------------------------------------------------------------------------------------------------------------------
function drawLineup(ctx, state, L, cam) {
  const run = state.run, fs = L.fs, watch = run.mode === 'watch';
  // the scouting card: only as tall as its text, so the sea and the rider stay in view
  const sc = L.scout, B = BEACHES[run.beach];
  const lh = (fs.small + 2) * 1.32, headH = fs.mid * 2 + 8;
  ctx.font = `500 ${fs.small + 2}px ${FONT}`;
  const lines = (state.scoutLines || []).map((ln) => wrapLines(ctx, ln, sc.w - 56));
  const body = lines.length ? lines : [wrapLines(ctx, state.thinkText || B.blurb, sc.w - 40)];
  const maxRows = Math.max(1, Math.floor((sc.h - headH - 16) / lh));
  let rows = 0; const shown = [];
  for (const wrapped of body) { if (rows + wrapped.length > maxRows) break; shown.push(wrapped); rows += wrapped.length; }
  const cardH = Math.min(sc.h, headH + 16 + rows * lh + 6);
  roundPath(ctx, sc.x, sc.y, sc.w, cardH, 22); ctx.fillStyle = 'rgba(6,20,44,0.72)'; ctx.fill();
  ctx.fillStyle = '#ffe9a8'; ctx.font = `800 ${fs.mid + 2}px ${FONT}`; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.fillText(`${B.name} · ${B.time}`, sc.x + 20, sc.y + 14 + fs.mid);
  ctx.fillStyle = '#e6f3ff'; ctx.font = `500 ${fs.small + 2}px ${FONT}`;
  let y = sc.y + headH + 10 + (fs.small + 2);
  for (const wrapped of shown) {
    wrapped.forEach((w, k) => { ctx.fillText(w, sc.x + (lines.length ? 36 : 20), y); if (k === 0 && lines.length) { ctx.fillStyle = 'rgba(255,214,120,1)'; ctx.beginPath(); ctx.arc(sc.x + 22, y - (fs.small + 2) * 0.32, 3.5, 0, TAU); ctx.fill(); ctx.fillStyle = '#e6f3ff'; } y += lh; });
  }
  // the boards
  if (!watch) {
    const owned = state.ownedBoards;
    L.tray.forEach((rc, i) => {
      const has = owned[i], sel = state.aim.board === i;
      roundPath(ctx, rc.x, rc.y, rc.w, rc.h, 16);
      ctx.fillStyle = sel ? 'rgba(255,244,214,0.97)' : 'rgba(240,246,249,0.9)'; ctx.fill();
      ctx.lineWidth = sel ? 4 : 2; ctx.strokeStyle = sel ? '#1f9a8c' : 'rgba(40,60,80,0.5)'; ctx.stroke();
      ctx.save(); ctx.globalAlpha = has ? 1 : 0.35;
      ctx.translate(rc.x + rc.w / 2, rc.y + rc.h * 0.36); ctx.rotate(-0.1);
      drawBoard(ctx, rc.w * 0.8, Math.max(6, rc.w * 0.045), BOARDS[i].col);
      ctx.restore();
      ctx.fillStyle = '#14243a'; ctx.font = `700 ${fs.chip}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      ctx.fillText(BOARDS[i].name, rc.x + rc.w / 2, rc.y + rc.h - fs.chip * 0.55, rc.w - 8);
      if (!has) { ctx.fillStyle = '#14243a'; ctx.font = `700 ${fs.small}px ${FONT}`; ctx.fillText(`Ride ${BOARDS[i].need}`, rc.x + rc.w / 2, rc.y + rc.h * 0.62); }
    });
    hudButton(ctx, L.go, 'Paddle out', { size: Math.round(fs.btn * 1.15), primary: true });
  }
  void cam; void inRect;
}

// ---- the paddle and pop-up ------------------------------------------------------------------------------------------------------------
function drawPaddle(ctx, state, L, cam) {
  const ws = state.ws, p = ws.paddle, fs = L.fs;
  if (!p) return;
  const cx = W / 2, cy = Math.min(H * 0.5, cam.yB0 - cam.F0 * 0.5);
  const base = Math.min(W, H) * 0.2;
  const into = clamp((PADDLE.ideal - p.t) / PADDLE.ideal, 0, 1.2);
  const rad = base * (0.5 + 1.8 * into);
  const inWin = p.t >= PADDLE.ring[0] && p.t <= PADDLE.ring[1];
  ctx.save();
  ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.beginPath(); ctx.arc(cx, cy, base * 0.5, 0, TAU); ctx.stroke();
  ctx.strokeStyle = inWin ? '#7dffb0' : '#ffffff'; ctx.lineWidth = inWin ? 10 : 6;
  ctx.beginPath(); ctx.arc(cx, cy, rad, 0, TAU); ctx.stroke();
  ctx.fillStyle = inWin ? 'rgba(80,255,160,0.28)' : 'rgba(255,255,255,0.1)'; ctx.beginPath(); ctx.arc(cx, cy, base * 0.5, 0, TAU); ctx.fill();
  ctx.restore();
  const msg = p.t < PADDLE.ring[0] ? 'Tap to paddle' : inWin ? 'POP UP!' : 'Now!';
  bigText(ctx, msg, cx, cy + fs.big * 0.3, Math.round(Math.min(W, 800) * (inWin ? 0.11 : 0.08)), inWin ? '#9affc4' : '#ffffff');
  // paddle power
  const bw = Math.min(W - 80, 420), bx = cx - bw / 2, by = L.meter.y + 4;
  roundPath(ctx, bx, by, bw, 18, 9); ctx.fillStyle = 'rgba(6,20,44,0.6)'; ctx.fill();
  roundPath(ctx, bx, by, Math.max(18, bw * p.power), 18, 9); ctx.fillStyle = '#ffd36a'; ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = `600 ${fs.small}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  const hint = 'Paddle power: tap steadily, then pop up inside the green ring';
  const hw = ctx.measureText(hint).width, avail = W - 24;
  if (hw > avail) { ctx.font = `600 ${Math.max(10, Math.floor(fs.small * avail / hw))}px ${FONT}`; }
  ctx.save(); ctx.shadowColor = 'rgba(4,16,40,0.9)'; ctx.shadowBlur = 6; ctx.fillText(hint, cx, by + 44); ctx.fillText(hint, cx, by + 44); ctx.restore();
}

export const bestLabel = (n) => rankFor(n);
export { drawLockup, host, smooth };
