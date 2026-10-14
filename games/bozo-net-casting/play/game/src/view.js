// The play screen: the river, the aim marker and the opening gauge, the HUD, the river strip and the control panel.
// Pure drawing; game.js owns state and calls these every frame.
import { W, H, TEXT_SCALES, playLayout, depthSegs, host, clamp } from './layout.js';
import { FONT, DISPLAY, C, roundPath, drawButton, panel, textShadow } from './ui.js';
import { drawWorld, drawNetIcon, ringPts, scene3dActive } from './art.js';
import { NETS, DEPTHS, WATERS, SESSION_CASTS, WIDE_OPEN, openRadius } from './sim.js';

const TAU = Math.PI * 2;

export const layoutOf = (state) => playLayout(TEXT_SCALES[state.settings.textIdx], state.run && state.run.mode === 'watch');

// ---- the world from a world-state object ---------------------------------------------------------------------------------
export function drawWorldState(ctx, rect, ws, pose, overlay) {
  return drawWorld(ctx, rect, { water: ws.water, t: ws.t, world: ws.world, cast: ws.cast, ripples: ws.ripples, parts: ws.parts, pose, overlay });
}

// ---- small helpers --------------------------------------------------------------------------------------------------------------
const minF = () => (host.px > 0 ? Math.ceil(11 / host.px) : 0);
function fit(ctx, text, maxW, size, weight = 700) {
  let px = Math.max(size, minF());
  ctx.font = `${weight} ${px}px ${FONT}`;
  while (px > Math.max(10, minF()) && ctx.measureText(text).width > maxW) { px -= 1; ctx.font = `${weight} ${px}px ${FONT}`; }
  return px;
}
function pill(ctx, text, cx, cy, size, fill = 'rgba(30,16,8,0.8)', col = '#fff6e4') {
  ctx.save(); ctx.font = `700 ${size}px ${FONT}`;
  const w = ctx.measureText(text).width + size * 1.2, h = size * 1.9;
  roundPath(ctx, cx - w / 2, cy - h / 2, w, h, h / 2); ctx.fillStyle = fill; ctx.fill();
  ctx.fillStyle = col; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, cx, cy + 1); ctx.restore();
}
function wrap(ctx, text, maxW) {
  const words = String(text).split(' '), lines = [];
  let line = '';
  for (const wd of words) { const n = line ? `${line} ${wd}` : wd; if (line && ctx.measureText(n).width > maxW) { lines.push(line); line = wd; } else line = n; }
  if (line) lines.push(line);
  return lines;
}
const PANEL_FILL = 'rgba(46,26,14,0.84)', PANEL_EDGE = 'rgba(255,226,170,0.3)';

// ---- the aim marker and the gauge -------------------------------------------------------------------------------------------------
function dashedRing(ctx, pts, dash) {
  ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath();
  ctx.setLineDash(dash); ctx.stroke(); ctx.setLineDash([]);
}
function drawAim(ctx, cam, state) {
  const A = state.aim, run = state.run;
  if (!A.has || run.phase !== 'swing') return;
  const net = NETS[A.tray[A.sel]], R = openRadius(net, A.depth, A.open);
  const wide = A.open >= WIDE_OPEN, col = wide ? '#7dffb0' : '#ffd36a';
  ctx.save();
  if (!scene3dActive()) {
    const pts = ringPts(cam, A.x, A.z, 0, R, 36, state.t * 0.6);
    ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath();
    ctx.fillStyle = wide ? 'rgba(125,255,176,0.16)' : 'rgba(255,211,106,0.12)'; ctx.fill();
    ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(30,16,8,0.45)'; dashedRing(ctx, pts, [14, 10]);
    ctx.lineWidth = 3.2; ctx.strokeStyle = col; dashedRing(ctx, pts, [14, 10]);
    const full = ringPts(cam, A.x, A.z, 0, openRadius(net, A.depth, 1), 36, 0);
    ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(255,255,255,0.4)'; dashedRing(ctx, full, [3, 8]);
  }
  const cx = cam.X(A.x, A.z), cy = cam.Y(0, A.z);
  ctx.strokeStyle = col; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(cx - 9, cy); ctx.lineTo(cx + 9, cy); ctx.moveTo(cx, cy - 6); ctx.lineTo(cx, cy + 6); ctx.stroke();
  // the current's lean: where the net will have drifted by the time it closes
  const cur = state.ws.world ? state.ws.world.cur : { x: 0, z: 0 };
  const ex = cam.X(A.x + cur.x * 1.6, A.z + cur.z * 1.6), ey = cam.Y(0, A.z + cur.z * 1.6);
  if (Math.hypot(ex - cx, ey - cy) > 6) {
    ctx.strokeStyle = 'rgba(190,230,255,0.9)'; ctx.fillStyle = 'rgba(190,230,255,0.9)'; ctx.lineWidth = 2.6;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(ex, ey); ctx.stroke();
    const a = Math.atan2(ey - cy, ex - cx);
    ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(ex - 9 * Math.cos(a - 0.45), ey - 9 * Math.sin(a - 0.45)); ctx.lineTo(ex - 9 * Math.cos(a + 0.45), ey - 9 * Math.sin(a + 0.45)); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
  if (A.fx !== undefined && A.drag) {
    ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.setLineDash([4, 6]); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(A.fx, A.fy); ctx.lineTo(cx, cy); ctx.stroke(); ctx.restore();
  }
}
function drawGauge(ctx, L, state) {
  const A = state.aim, stage = L.stage;
  const fs = Math.max(L.fs.small + 1, minF());
  const gw = Math.max(26, Math.round(fs * 1.5)), gx = stage.x + stage.w - gw - 18, gy = stage.y + stage.h * 0.2, gh = stage.y + stage.h - 20 - gy;
  if (gh < 90) return;
  roundPath(ctx, gx, gy, gw, gh, gw / 2); ctx.fillStyle = 'rgba(30,16,8,0.6)'; ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,230,180,0.5)'; ctx.stroke();
  const bh = gh * (1 - WIDE_OPEN);
  roundPath(ctx, gx + 3, gy + 3, gw - 6, bh, (gw - 6) / 2); ctx.fillStyle = 'rgba(125,255,176,0.35)'; ctx.fill();
  ctx.strokeStyle = 'rgba(125,255,176,0.9)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(gx - 4, gy + bh + 3); ctx.lineTo(gx + gw + 4, gy + bh + 3); ctx.stroke();
  const v = clamp(A.open, 0, 1), fh = Math.max(0, (gh - 6) * v);
  if (fh > 2) {
    roundPath(ctx, gx + 3, gy + gh - 3 - fh, gw - 6, fh, (gw - 6) / 2);
    const g = ctx.createLinearGradient(0, gy + gh, 0, gy); g.addColorStop(0, '#d9893a'); g.addColorStop(0.7, '#f0c040'); g.addColorStop(1, '#7dffb0'); ctx.fillStyle = g; ctx.fill();
  }
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.font = `700 ${Math.max(fs - 2, minF())}px ${FONT}`;
  textShadow(ctx, 'Open', gx + gw / 2, gy - 8, '#fff6e4', 4);
}

// ---- panel: tray, depth ---------------------------------------------------------------------------------------------------------
function statBar(ctx, x, y, w, v, col) {
  roundPath(ctx, x, y, w, 6, 3); ctx.fillStyle = 'rgba(60,30,10,0.22)'; ctx.fill();
  roundPath(ctx, x, y, Math.max(6, w * v), 6, 3); ctx.fillStyle = col; ctx.fill();
}
function drawTray(ctx, L, state) {
  const A = state.aim, hint = state.hint, dec = state.dec;
  L.tray.forEach((r, i) => {
    const idx = A.tray[i];
    if (idx === undefined) return;
    const net = NETS[idx], sel = A.sel === i;
    const rec = (hint && hint.adv.net === idx) || (dec && dec.adv && dec.phase !== 'think' && dec.adv.net === idx);
    panel(ctx, r.x, r.y, r.w, r.h, { r: 18, fill: sel ? 'rgba(255,246,222,0.99)' : 'rgba(250,243,228,0.9)', stroke: sel ? '#b8501c' : 'rgba(80,50,20,0.5)' });
    if (sel) { ctx.save(); roundPath(ctx, r.x + 2, r.y + 2, r.w - 4, r.h - 4, 16); ctx.lineWidth = 4; ctx.strokeStyle = '#b8501c'; ctx.stroke(); ctx.restore(); }
    if (rec) { ctx.save(); roundPath(ctx, r.x - 3, r.y - 3, r.w + 6, r.h + 6, 20); ctx.lineWidth = 3; ctx.strokeStyle = '#ffc94a'; ctx.stroke(); ctx.restore(); }
    const rad = Math.min(r.w * 0.34, r.h * 0.3) * (0.7 + 0.3 * net.R / 3);
    drawNetIcon(ctx, r.x + r.w / 2, r.y + r.h * 0.34, rad, idx, { shadow: false });
    const fs = Math.round(Math.max(L.fs.small - 1, minF(), 12));
    ctx.fillStyle = C.ink; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    const px = fit(ctx, net.name, r.w - 14, fs + 2);
    ctx.font = `700 ${px}px ${FONT}`; ctx.fillText(net.name, r.x + r.w / 2, r.y + r.h * 0.7);
    const bx = r.x + r.w * 0.14, bw = r.w * 0.72;
    if (r.h > 112) {
      statBar(ctx, bx, r.y + r.h * 0.77, bw, clamp(net.R / 3.1, 0.2, 1), '#237a5c');
      statBar(ctx, bx, r.y + r.h * 0.86, bw, clamp(net.sink / 3.3, 0.1, 1), '#8a5a2a');
    }
  });
}
function drawDepthRow(ctx, L, state) {
  const r = L.depth, A = state.aim, hint = state.hint, dec = state.dec, lock = state.run.phase !== 'aim' && state.run.phase !== 'swing';
  panel(ctx, r.x, r.y, r.w, r.h, { r: 18, fill: PANEL_FILL, stroke: PANEL_EDGE });
  const fs = Math.max(L.fs.lab - 1, minF());
  ctx.fillStyle = '#fff6e4'; ctx.font = `700 ${fs}px ${FONT}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillText('Depth', r.x + 16, r.y + r.h / 2);
  depthSegs(r).forEach((s, i) => {
    const on = A.depth === i, rec = (hint && hint.adv.depth === i) || (dec && dec.adv && dec.phase !== 'think' && dec.adv.depth === i);
    roundPath(ctx, s.x, s.y, s.w, s.h, 14);
    ctx.fillStyle = on ? (lock ? '#8a5a3a' : '#c85f22') : 'rgba(255,240,210,0.14)'; ctx.fill();
    ctx.lineWidth = on ? 2.5 : 1.5; ctx.strokeStyle = on ? '#ffe2a8' : 'rgba(255,230,180,0.35)'; ctx.stroke();
    if (rec) { roundPath(ctx, s.x - 3, s.y - 3, s.w + 6, s.h + 6, 17); ctx.lineWidth = 3; ctx.strokeStyle = '#ffc94a'; ctx.stroke(); }
    ctx.fillStyle = on ? '#fff' : '#f3e4c4'; ctx.textAlign = 'center';
    const px = fit(ctx, DEPTHS[i].name, s.w - 10, fs);
    ctx.font = `700 ${px}px ${FONT}`; ctx.fillText(DEPTHS[i].name, s.x + s.w / 2, s.y + s.h / 2);
  });
}

function drawRiverStrip(ctx, L, state) {
  const r = L.river, world = state.ws.world;
  panel(ctx, r.x, r.y, r.w, r.h, { r: 16, fill: PANEL_FILL, stroke: PANEL_EDGE });
  const cur = world ? world.cur : { x: 0, z: 0 }, cy = r.y + r.h / 2, ax = r.x + 38;
  const sp = Math.hypot(cur.x, cur.z), dr = cur.x >= 0 ? 1 : -1;
  ctx.save(); ctx.strokeStyle = '#bfe6ff'; ctx.fillStyle = '#bfe6ff'; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const sz = Math.min(20, r.h * 0.32);
  ctx.beginPath(); ctx.moveTo(ax - dr * sz, cy); ctx.lineTo(ax + dr * sz, cy); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(ax + dr * sz * 0.2, cy - sz * 0.6); ctx.lineTo(ax + dr * sz, cy); ctx.lineTo(ax + dr * sz * 0.2, cy + sz * 0.6); ctx.stroke();
  ctx.restore();
  const fs = Math.max(L.fs.river, minF());
  ctx.textBaseline = 'middle'; ctx.textAlign = 'left'; ctx.fillStyle = '#fff6e4';
  const label = `Current ${sp.toFixed(1)} m/s ${dr > 0 ? 'to the right' : 'to the left'}`;
  const px = fit(ctx, label, r.w * 0.6 - 50, fs);
  ctx.font = `700 ${px}px ${FONT}`; ctx.fillText(label, ax + 32, cy);
  const vis = world ? world.vis : 1, l2 = vis > 0.8 ? 'Clear water' : vis > 0.55 ? 'Cloudy water' : 'Murky water';
  ctx.textAlign = 'right'; ctx.fillStyle = '#f0d9b0';
  const p2 = fit(ctx, l2, r.w * 0.34, Math.round(fs * 0.9));
  ctx.font = `600 ${p2}px ${FONT}`; ctx.fillText(l2, r.x + r.w - 16, cy);
}

function drawScoreBlock(ctx, L, state) {
  const r = L.score, run = state.run;
  panel(ctx, r.x, r.y, r.w, r.h, { r: 18, fill: PANEL_FILL, stroke: PANEL_EDGE });
  const cx = r.x + r.w / 2;
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  const sm = Math.max(L.fs.small, minF());
  const wn = WATERS[state.ws.water].name;
  const head = run.mode === 'free' ? `${wn} · free cast` : `${wn} · cast ${Math.min(run.idx + 1, SESSION_CASTS)} of ${SESSION_CASTS}`;
  const px = fit(ctx, head, r.w - 20, sm, 600);
  ctx.font = `600 ${px}px ${FONT}`; ctx.fillStyle = '#f0d9b0'; ctx.fillText(head, cx, r.y + px + 6);
  const big = Math.min(L.fs.big, r.h - px - 16);
  ctx.font = `800 ${big}px ${DISPLAY}`; ctx.fillStyle = '#fff'; ctx.fillText(String(state.scoreShown ?? 0), cx, r.y + r.h - 10);
  ctx.font = `600 ${Math.max(sm - 1, minF())}px ${FONT}`; ctx.fillStyle = '#f0d9b0'; ctx.textAlign = 'right';
  ctx.fillText(run.mode !== 'free' ? 'points' : 'this cast', r.x + r.w - 12, r.y + r.h - 12);
}

// ---- the whole play screen -----------------------------------------------------------------------------------------------------------
export function renderPlay(ctx, state) {
  const L = layoutOf(state), run = state.run, watch = run.mode === 'watch', stage = L.stage;
  ctx.fillStyle = '#1b1008'; ctx.fillRect(0, 0, W, H);
  let sx = 0, sy = 0;
  if (state.shake > 0) { const k = state.shake * 6; sx = Math.sin(state.t * 90) * k; sy = Math.cos(state.t * 77) * k; }
  ctx.save(); ctx.translate(sx, sy);
  const hadv = state.hint && run.phase === 'aim' ? state.hint.adv : (state.dec && state.dec.phase === 'reveal' && state.dec.adv ? state.dec.adv : null);
  let overlay = null;
  {
    const A = state.aim; overlay = {};
    if (A.has && run.phase === 'swing') { const net = NETS[A.tray[A.sel]]; overlay.aim = { x: A.x, z: A.z, r: openRadius(net, A.depth, A.open), rFull: openRadius(net, A.depth, 1), wide: A.open >= WIDE_OPEN }; }
    if (hadv) overlay.hint = { x: hadv.x, z: hadv.z, r: openRadius(NETS[hadv.net], hadv.depth, 1) };
  }
  const cam = drawWorldState(ctx, stage, state.ws, state.pose, overlay);
  // the hint's suggested landing spot
  if (hadv && !scene3dActive()) {
    const h = hadv, net = NETS[h.net], R = openRadius(net, h.depth, 1);
    const pts = ringPts(cam, h.x, h.z, 0, R, 36, 0);
    ctx.save(); ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(30,16,8,0.5)';
    ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath(); ctx.stroke();
    ctx.lineWidth = 3; ctx.strokeStyle = '#ffc94a'; ctx.setLineDash([10, 8]); ctx.stroke(); ctx.setLineDash([]);
    const cx = cam.X(h.x, h.z), cy = cam.Y(0, h.z); ctx.fillStyle = '#ffc94a'; ctx.beginPath(); ctx.arc(cx, cy, 6, 0, TAU); ctx.fill();
    ctx.restore();
  }
  drawAim(ctx, cam, state);
  ctx.restore();
  // score pops over the haul
  for (const p of state.pops) {
    const k = p.t / p.max, x = cam.X(p.x, p.z), y = cam.Y(p.y, p.z) - 18 - k * 46;
    const size = Math.round(clamp(cam.S(0.36, p.z) * p.size, 22, 56));
    ctx.save(); ctx.globalAlpha = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
    ctx.font = `800 ${size}px ${DISPLAY}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineWidth = Math.max(3, size * 0.14); ctx.strokeStyle = 'rgba(30,16,8,0.8)'; ctx.lineJoin = 'round';
    ctx.strokeText(p.text, x, y); ctx.fillStyle = p.col; ctx.fillText(p.text, x, y);
    ctx.restore();
  }
  if (run.phase === 'swing') drawGauge(ctx, L, state);
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
  drawRiverStrip(ctx, L, state);
  drawTray(ctx, L, state);
  drawDepthRow(ctx, L, state);
  if (watch) {
    const D = L.demo, st = state.settings;
    drawButton(ctx, D.dec, '−', { size: big, disabled: st.thinkIdx === 0, dark: true });
    drawButton(ctx, D.pause, state.paused ? 'Resume' : 'Pause', { size: Math.round(big * 0.9), primary: true });
    drawButton(ctx, D.inc, '+', { size: big, disabled: false, dark: true });
    drawButton(ctx, D.exit, 'Exit', { size: Math.round(big * 0.9), dark: true });
    const dec = state.dec;
    if (dec) {
      const label = dec.phase === 'think' ? `Thinking… ${Math.max(0, Math.ceil(dec.dur - dec.t))} s` : dec.phase === 'reveal' ? 'My choice' : 'Casting';
      pill(ctx, label, stage.x + stage.w / 2, stage.y + stage.h * 0.1, Math.max(L.fs.mid, minF()), 'rgba(30,16,8,0.8)', dec.phase === 'think' ? '#ffd36a' : '#8be8b0');
    }
  } else {
    const hr = L.hint;
    ctx.fillStyle = 'rgba(255,244,226,0.92)'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const msg = run.phase === 'aim' ? (state.hint ? 'Gold marks show the suggested net, depth and landing spot' : 'Press the water, hold to swing, let go when the net is wide open')
      : run.phase === 'swing' ? 'Let go when the gauge is in the green band' : run.phase === 'cast' ? 'Tap to watch faster' : '';
    let px = fit(ctx, msg, hr.w - 20, Math.max(L.fs.small + 1, minF()), 600), shown = msg;
    if (ctx.measureText(msg).width > hr.w - 16) {               // narrow phones: a shorter wording instead of a clipped line
      const short = { 'Press the water, hold to swing, let go when the net is wide open': 'Hold on the water, let go when open', 'Gold marks show the suggested net, depth and landing spot': 'Gold marks: suggested net and spot' }[msg];
      if (short) { shown = short; px = fit(ctx, short, hr.w - 20, Math.max(L.fs.small + 1, minF()), 600); }
    }
    ctx.font = `600 ${px}px ${FONT}`; ctx.fillText(shown, hr.x + hr.w / 2, hr.y + hr.h / 2);
  }
  // the hint card
  if (state.hint && run.phase === 'aim') {
    const why = state.hint.why, px = Math.max(L.fs.small, minF());
    ctx.font = `600 ${px}px ${FONT}`;
    const maxW = Math.min(stage.w - 40, 620);
    const lines = wrap(ctx, `Think: ${why}.`, maxW - 28);
    const hh = lines.length * px * 1.3 + 22, hx = stage.x + (stage.w - maxW) / 2, hy = stage.y + 10;
    roundPath(ctx, hx, hy, maxW, hh, 16); ctx.fillStyle = 'rgba(30,16,8,0.86)'; ctx.fill(); ctx.strokeStyle = '#ffc94a'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#fff6d8'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    lines.forEach((l, i) => ctx.fillText(l, hx + 14, hy + 12 + px * (1 + i * 1.3)));
  }
  // banner for a finished cast
  if (state.banner) {
    const b = state.banner, k = clamp(b.t / 0.25, 0, 1), a = b.t > b.max - 0.4 ? clamp((b.max - b.t) / 0.4, 0, 1) : 1;
    const cx = stage.x + stage.w / 2, cy = stage.y + stage.h * 0.34;
    ctx.save(); ctx.globalAlpha = a; ctx.translate(cx, cy); ctx.scale(0.8 + 0.2 * k, 0.8 + 0.2 * k);
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.lineJoin = 'round';
    const bs = Math.round(Math.min(stage.w * 0.2, stage.h * 0.2, 130));
    ctx.font = `800 ${bs}px ${DISPLAY}`; ctx.lineWidth = bs * 0.14; ctx.strokeStyle = 'rgba(30,16,8,0.85)'; ctx.strokeText(b.text, 0, 0);
    ctx.fillStyle = b.col || '#fff'; ctx.fillText(b.text, 0, 0);
    const subPx = fit(ctx, b.sub, stage.w * 0.9, Math.round(bs * 0.26));
    ctx.font = `700 ${subPx}px ${FONT}`; ctx.lineWidth = Math.max(3, subPx * 0.22); ctx.strokeText(b.sub, 0, bs * 0.34); ctx.fillStyle = '#fff3d8'; ctx.fillText(b.sub, 0, bs * 0.34);
    if (b.tally && b.tally.length) {
      const ts = Math.max(Math.round(bs * 0.2), minF());
      ctx.font = `700 ${ts}px ${FONT}`;
      b.tally.slice(0, 4).forEach((t, i) => { const yy = bs * 0.34 + ts * 1.5 * (i + 1.1); ctx.lineWidth = ts * 0.22; ctx.strokeStyle = 'rgba(30,16,8,0.85)'; ctx.strokeText(t, 0, yy); ctx.fillStyle = '#ffe9b8'; ctx.fillText(t, 0, yy); });
    }
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
    roundPath(ctx, x, y, w, h, 18); ctx.fillStyle = 'rgba(30,16,8,0.88)'; ctx.fill();
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    lines.forEach((l, i) => ctx.fillText(l, x + w / 2, y + 12 + px * (1 + i * 1.3)));
    ctx.restore();
  }
}
